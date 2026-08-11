import logging
import json
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import List, Optional

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

from app.config import get_settings
from app.models import (
    CompanyAnalysis,
    CompanyBasicInfo,
    CompanyResearchExtraction,
    CompanyResearchResult,
    SourceRef,
)
from app.utils.url_resolver import resolve_query
from app.agent.tools import (
    SourceCollector,
    build_search_queries,
    canonicalize_url,
    days_since,
    domain_of,
    format_search_results,
    humanize_age,
    parse_date,
    scrape_website,
    to_iso_date,
)
from app.agent.prompts import (
    analysis_prompt,
    extraction_prompt,
    research_system_prompt,
)

logger = logging.getLogger(__name__)
settings = get_settings()


def get_llm(
    max_tokens: Optional[int] = None,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    extra: Optional[dict] = None,
):
    """Get the configured LLM.

    Provider SDKs are imported lazily so that a missing optional dependency
    (e.g. langchain_openai when running on Groq) cannot break this module.

    Args:
        max_tokens: override the output token budget. The stages have very
            different needs, so they each build their own client.
        model: override the model id. The tool-calling loop and the reasoning
            stages want different models entirely - see the GROQ_*_MODEL
            settings for why.
        temperature: override sampling. Only the analyst stage raises it.
        extra: provider-specific model kwargs, e.g. ``reasoning_effort``.
    """
    tokens = max_tokens if max_tokens is not None else settings.LLM_MAX_TOKENS
    temp = temperature if temperature is not None else settings.LLM_TEMPERATURE
    # Provider knobs ride through here instead of becoming named parameters,
    # because not every provider or SDK version accepts them and an unknown
    # keyword is a hard TypeError at construction time.
    kwargs = {"model_kwargs": extra} if extra else {}

    if settings.LLM_PROVIDER == "groq" and settings.GROQ_API_KEY:
        from langchain_groq import ChatGroq
        return ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model=model or settings.GROQ_MODEL,
            temperature=temp,
            max_tokens=tokens,
            **kwargs,
        )
    elif settings.OPENAI_API_KEY:
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            api_key=settings.OPENAI_API_KEY,
            model=model or settings.OPENAI_MODEL,
            temperature=temp,
            max_tokens=tokens,
            **kwargs,
        )
    else:
        raise ValueError(
            "No LLM API key configured. Set OPENAI_API_KEY or GROQ_API_KEY in .env"
        )


def extraction_model_id() -> Optional[str]:
    """Model id for stage 2. Falls back to the stage 1 model when unset."""
    if settings.LLM_PROVIDER == "groq" and settings.GROQ_API_KEY:
        return settings.GROQ_EXTRACTION_MODEL or settings.GROQ_MODEL
    return settings.OPENAI_MODEL


def analysis_model_id() -> Optional[str]:
    """Model id for stage 4.

    Split out because the jobs genuinely differ. Stage 1 needs dependable
    function calling above all else; stage 4 needs reasoning and never touches
    a tool. Pinning both to one model means losing on one of the two.
    """
    if settings.LLM_PROVIDER == "groq" and settings.GROQ_API_KEY:
        return settings.GROQ_ANALYSIS_MODEL or settings.GROQ_MODEL
    return settings.OPENAI_ANALYSIS_MODEL or settings.OPENAI_MODEL


def get_tavily_client():
    """Get Tavily search client."""
    from tavily import TavilyClient
    if not settings.TAVILY_API_KEY:
        raise ValueError("TAVILY_API_KEY not set in .env")
    return TavilyClient(api_key=settings.TAVILY_API_KEY)


def _tavily_search(
    query: str,
    topic: Optional[str] = None,
    days: Optional[int] = None,
) -> List[dict]:
    """Run one Tavily query and return the raw results.

    Deliberately does not touch the collector. Keeping the network call free of
    shared mutable state is what makes the deterministic sweep safe to run on a
    thread pool: results come back to the main thread and are banked there, in a
    fixed order, so the citation list stays reproducible and no two threads ever
    write to the collector at once.
    """
    client = get_tavily_client()
    params = {
        "query": query,
        "search_depth": "basic",
        "max_results": settings.MAX_SEARCH_RESULTS,
        "include_answer": False,
    }
    if topic:
        params["topic"] = topic

    if days is not None:
        try:
            # tavily-python defaults topic="news" to days=3, so "recent news"
            # silently meant "the last 72 hours". Ask for a real window.
            response = client.search(**params, days=days)
            return (response or {}).get("results", []) or []
        except TypeError:
            # Older tavily-python builds do not accept `days`.
            pass

    response = client.search(**params)
    return (response or {}).get("results", []) or []


# ─── LangChain Tools ────────────────────

def build_research_tools(collector: SourceCollector) -> list:
    """Build the tool set for one research run.

    The tools are closures over a run-scoped ``SourceCollector`` instead of
    module-level functions. Every URL the agent actually retrieves is recorded
    as a side effect, which is what lets the server publish a citation list it
    can prove rather than the one the model claims at the end of its brief.

    Because routes.py constructs a new ``CompanyResearchAgent`` per request,
    each run gets its own collector — no globals, no locks, no cross-request
    bleed under concurrency.
    """

    @tool
    def web_search(query: str) -> str:
        """Search the web for information about a company. Use for general research."""
        try:
            results = _tavily_search(query)
            # Every result is banked for provenance; only a slice is shown to
            # the model. Provenance is free, prompt tokens are not.
            collector.add_many(results, kind="web")
            return format_search_results(
                results,
                max_results=settings.SEARCH_RESULTS_IN_PROMPT,
                snippet_chars=settings.SEARCH_SNIPPET_CHARS,
            )
        except Exception as e:
            logger.error(f"Web search error: {e}")
            return f"Search error: {str(e)}"

    @tool
    def search_news(company_name: str) -> str:
        """Search for recent news articles about the company."""
        try:
            results = _tavily_search(
                f"{company_name} news",
                topic="news",
                days=settings.NEWS_RECENCY_DAYS,
            )
            collector.add_many(results, kind="news")
            return format_search_results(
                results,
                max_results=settings.SEARCH_RESULTS_IN_PROMPT,
                snippet_chars=settings.SEARCH_SNIPPET_CHARS,
            )
        except Exception as e:
            logger.error(f"News search error: {e}")
            return f"News search error: {str(e)}"

    @tool
    def scrape_url(url: str) -> str:
        """Scrape and extract text content from a website URL. Use for company websites."""
        content = scrape_website(url, max_chars=settings.MAX_SCRAPE_CHARS)
        if not content.startswith("Error:"):
            collector.add(url, kind="scrape")
        return content

    return [web_search, search_news, scrape_url]


# ─── Main Research Agent ────────────────────

class CompanyResearchAgent:
    """Orchestrates company research as three stages.

    Stage 1 (gather): a ReAct agent calls search/scrape tools and writes a
    plain-text research brief. No JSON schema is sent into this loop, so the
    prompt is not re-transmitted on every turn.

    Stage 2 (extract): a single tool-free call converts that brief into a
    CompanyResearchExtraction. Structured output is bound to the Pydantic
    model, so the provider fills the schema via function calling instead of the
    model hand-writing JSON that can be truncated mid-string.

    Stage 3 (verify): the server overwrites everything it can establish itself
    — the citation list, news URLs, publication dates, link formatting and the
    confidence rating. This is the stage that turns "plausible" into "checked".
    """

    def __init__(self):
        self.collector = SourceCollector(max_sources=settings.MAX_SOURCES)
        self._degraded = False
        # Written by the direct sweep, read back when the brief is rebuilt.
        self._searches_run: List[str] = []
        self._site_text = ""

        self.llm = get_llm()
        self.tools = build_research_tools(self.collector)
        self.agent = create_react_agent(
            model=self.llm,
            tools=self.tools,
        )

        # Separate client for extraction: no tools, larger output budget.
        self.extraction_llm = get_llm(max_tokens=settings.EXTRACTION_MAX_TOKENS)
        try:
            # Bound to the extraction subset, not the full result model: the
            # server-owned fields (sources, timestamps, confidence) are absent
            # from this schema, so the model is never given the chance to
            # invent them and the schema costs fewer tokens.
            self.extractor = self.extraction_llm.with_structured_output(
                CompanyResearchExtraction
            )
        except Exception as e:
            # Some providers reject complex nested schemas. Fall back to
            # free-text JSON plus manual parsing.
            logger.warning(f"Structured output unavailable, using text fallback: {e}")
            self.extractor = None

    # ─── Public API ────────────────────

    def research(
        self,
        query: str,
        depth: str = "standard",
        include_analysis: Optional[bool] = None,
    ) -> CompanyResearchResult:
        """Execute the full research pipeline.

        Args:
            include_analysis: run stage 4. None defers to ENABLE_ANALYSIS so
                that existing callers keep working unchanged.
        """
        start_time = time.time()
        self.collector.reset()
        self._degraded = False
        self._searches_run = []
        self._site_text = ""

        company_name, website_url, is_url = resolve_query(query)
        logger.info(
            f"Researching: '{company_name}' | URL: '{website_url}' | Depth: {depth}"
        )

        brief = self._gather(company_name, website_url, depth)
        logger.info(
            f"Research brief: {len(brief)} chars | "
            f"{len(self.collector)} sources across "
            f"{len(self.collector.domains)} domains"
        )

        extraction = self._extract(brief, company_name, website_url)
        result = self._apply_source_truth(extraction, company_name, website_url)

        run_analysis = (
            settings.ENABLE_ANALYSIS if include_analysis is None else include_analysis
        )
        if run_analysis:
            result.analysis = self._analyze(result, company_name)

        elapsed = time.time() - start_time
        logger.info(
            f"Research completed in {elapsed:.1f}s "
            f"(confidence={result.research_confidence}, "
            f"analysis={'yes' if result.analysis else 'no'})"
        )
        return result

    # ─── Stage 1: gather ────────────────────

    def _gather(self, company_name: str, website_url: str, depth: str) -> str:
        """Collect evidence and return the brief that stage 2 reads.

        Three strategies, selected by GATHER_MODE.

        ``direct`` (default) runs the planned queries straight from Python.
        ``build_search_queries`` already decides what to search for; handing
        that list to a model so it can read it back as tool calls added a
        failure mode and nothing else. Groq's Llama tool parser intermittently
        emits ``<function=web_search {...}>`` where the API expects
        ``<function=web_search>{...}``, and rejects the whole request with a
        400 ``tool_use_failed`` before a single search has run.

        It is also better research. The ReAct loop had a budget of 3-8 tool
        calls and spent them on the descriptive queries, so the signal queries -
        hiring, executive departures, pricing changes, layoffs, complaints -
        usually never ran. Those are the only queries that give stage 4 anything
        to reason from. Now every one of them runs, every time.

        ``agent`` is the original ReAct loop, kept intact and reachable.

        ``hybrid`` sweeps first, then lets the loop chase follow-ups. A failure
        in the follow-up is logged and discarded, because the sweep already
        stands on its own.
        """
        mode = (settings.GATHER_MODE or "direct").strip().lower()
        if mode not in ("direct", "agent", "hybrid"):
            logger.warning(f"Unknown GATHER_MODE '{mode}'; using direct")
            mode = "direct"

        if mode == "agent":
            return self._gather_agent(company_name, website_url, depth)

        brief = self._gather_direct(company_name, website_url, depth)

        if mode == "hybrid":
            before = len(self.collector)
            try:
                self._gather_agent(company_name, website_url, depth)
            except Exception as exc:
                logger.warning(
                    f"Hybrid follow-up failed, keeping the sweep "
                    f"({type(exc).__name__}: {exc})"
                )
            gained = len(self.collector) - before
            if gained:
                logger.info(f"Hybrid follow-up added {gained} sources")
                brief = self._brief_from_collector(company_name, website_url)

        return brief

    def _gather_agent(self, company_name: str, website_url: str, depth: str) -> str:
        """Run the tool-using agent and return a plain-text research brief."""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        url_context = f" Their website is {website_url}." if website_url else ""

        # Budgets are stated in tool calls, not "searches", and they are kept
        # inside the graph's recursion limit. The previous prompt asked for
        # "8-10 searches" (and "12+" on deep) while the graph aborted after 8
        # super-steps, i.e. roughly 3 tool calls.
        budget = {"quick": 3, "standard": 5, "deep": 8}.get(depth, 5)
        recursion_limit = max(settings.AGENT_RECURSION_LIMIT, budget * 2 + 3)

        suggested = build_search_queries(company_name, website_url, depth)
        suggested_block = "\n".join(f"- {q}" for q in suggested[:budget + 2])

        research_task = f"""Research the company: "{company_name}".{url_context}

Today is {today}. Use at most {budget} tool calls, then write the brief.

Suggested starting queries (adapt them, never repeat one):
{suggested_block}

Investigate and report on:
1. Company overview (description, industry, founding year, HQ, size, type)
2. Products and services
3. Leadership team (CEO, CTO, founders)
4. Recent news (most recent first, with the published date of each item)
5. Funding and financial info (state the date of every figure)
6. Competitors
7. Tech stack (if findable)
8. Social media links
9. Culture and values
10. Hiring/jobs status

Write your findings as a concise plain-text brief organised under those
headings. Put the source URL next to each fact where you have one, and copy
both URLs and dates exactly as they appear in the tool results. Write
"not found" for anything the searches did not turn up.

Do NOT output JSON. A separate step handles formatting.
"""

        messages = [
            SystemMessage(content=research_system_prompt(today)),
            HumanMessage(content=research_task),
        ]

        try:
            result = self.agent.invoke(
                {"messages": messages},
                config={"recursion_limit": recursion_limit},
            )
            return result["messages"][-1].content or self._brief_from_sources(company_name)
        except Exception as exc:
            # Nothing retrieved means the failure happened before any tool ran
            # (bad API key, no network). Let routes.py surface that properly.
            if len(self.collector) == 0:
                raise
            # Otherwise the loop hit its recursion limit or the provider
            # rate-limited us mid-run. We already hold real evidence, so build
            # the brief from that instead of throwing the run away.
            logger.warning(
                f"Research loop ended early ({type(exc).__name__}: {exc}). "
                f"Falling back to {len(self.collector)} collected sources."
            )
            return self._brief_from_sources(company_name)

    def _gather_direct(self, company_name: str, website_url: str, depth: str) -> str:
        """Deterministic evidence sweep. No model, no tool calling, no chance
        of a malformed function call.
        """
        budget = {
            "quick": settings.DIRECT_SEARCHES_QUICK,
            "standard": settings.DIRECT_SEARCHES_STANDARD,
            "deep": settings.DIRECT_SEARCHES_DEEP,
        }.get(depth, settings.DIRECT_SEARCHES_STANDARD)

        planned = build_search_queries(company_name, website_url, depth)
        planned = planned[: max(1, int(budget))]

        jobs: List[dict] = [{"kind": "web", "label": q, "query": q} for q in planned]
        jobs.append(
            {
                "kind": "news",
                "label": f"{company_name} news (last {settings.NEWS_RECENCY_DAYS} days)",
                "query": f"{company_name} news",
                "topic": "news",
                "days": settings.NEWS_RECENCY_DAYS,
            }
        )

        def run(job: dict):
            try:
                results = _tavily_search(
                    job["query"], topic=job.get("topic"), days=job.get("days")
                )
                return job, results, None
            except Exception as exc:  # noqa: BLE001 - reported per query below
                return job, [], exc

        workers = max(1, min(int(settings.GATHER_CONCURRENCY or 1), len(jobs)))
        started = time.time()
        with ThreadPoolExecutor(max_workers=workers) as pool:
            # map preserves input order, so the citation list is deterministic
            # even though the calls themselves race.
            outcomes = list(pool.map(run, jobs))

        config_error = None
        succeeded = []
        self._searches_run = []
        for job, results, exc in outcomes:
            if exc is not None:
                if isinstance(exc, ValueError):
                    config_error = exc
                logger.warning(
                    f"Search failed [{job['label']}]: {type(exc).__name__}: {exc}"
                )
                continue
            succeeded.append((job, results))
            self._searches_run.append(job["label"])

        # Bank round-robin, not query by query. MAX_SOURCES caps the collector
        # and the signal queries are planned last, so a sequential bank would
        # spend the entire budget on the descriptive queries and discard exactly
        # the evidence stage 4 needs. This way every query lands its top hit
        # before any query lands its second.
        rank = 0
        while succeeded:
            progressed = False
            for job, results in succeeded:
                if rank < len(results):
                    self.collector.add_many([results[rank]], kind=job["kind"])
                    progressed = True
            if not progressed:
                break
            rank += 1

        logger.info(
            f"Direct sweep: {len(self._searches_run)}/{len(jobs)} searches in "
            f"{time.time() - started:.1f}s -> {len(self.collector)} unique sources "
            f"across {len(self.collector.domains)} domains"
        )

        self._site_text = ""
        if website_url and settings.SCRAPE_HOMEPAGE:
            content = scrape_website(website_url, max_chars=settings.MAX_SCRAPE_CHARS)
            if content and not content.startswith("Error:"):
                self.collector.add(website_url, kind="scrape")
                self._site_text = content
            else:
                logger.info(f"Homepage fetch skipped: {str(content)[:140]}")

        if len(self.collector) == 0 and not self._site_text:
            # Nothing came back at all. A missing or rejected Tavily key is by
            # far the most common cause, and routes.py renders ValueError as a
            # configuration problem rather than a research failure.
            if config_error is not None:
                raise config_error
            raise ValueError(
                "No sources retrieved: every search failed. Check TAVILY_API_KEY "
                "and outbound network access."
            )

        return self._brief_from_collector(company_name, website_url)

    def _brief_from_collector(self, company_name: str, website_url: str) -> str:
        """Render the retrieved evidence as the brief stage 2 will transcribe.

        This replaces a model-written summary with the retrieved text itself.
        The old pipeline had two lossy hops - the loop paraphrased search results
        into prose, then the extractor transcribed that prose - so every fact had
        two chances to drift. Stage 2 now reads what the index actually returned.
        """
        details = self.collector.details()
        web = [r for r in details if r.get("kind") != "news"]
        news = [r for r in details if r.get("kind") == "news"]
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        lines: List[str] = [
            f"Evidence brief for {company_name}, assembled {today}.",
            (
                f"{len(details)} unique sources across "
                f"{len(self.collector.domains)} domains, retrieved by "
                f"{len(self._searches_run)} live searches."
            ),
            "",
            "Every URL, title, date and snippet below was returned by a search",
            "index or fetched from the page itself. Nothing here is recalled from",
            "memory, so an absent fact was genuinely not retrieved.",
            "",
        ]

        if self._searches_run:
            lines.append("=== SEARCHES RUN ===")
            lines.extend(f"- {label}" for label in self._searches_run)
            lines.append("")

        index = 0
        for heading, group in (("WEB RESULTS", web), ("NEWS RESULTS", news)):
            if not group:
                continue
            lines.append(f"=== {heading} ===")
            for record in group:
                index += 1
                lines.append(f"[{index}] {record.get('title') or 'Untitled'}")
                lines.append(f"URL: {record['url']}")
                published = record.get("published_date")
                if published:
                    age = humanize_age(days_since(published))
                    suffix = f" ({age})" if age else ""
                    lines.append(f"Published: {published}{suffix}")
                else:
                    lines.append("Published: not stated by the source")
                if record.get("snippet"):
                    lines.append(record["snippet"])
                lines.append("")
            lines.append("")

        if self._site_text:
            lines.append("=== COMPANY WEBSITE (fetched directly) ===")
            lines.append(self._site_text)
            lines.append("")

        brief = "\n".join(lines).strip()
        cap = max(2000, int(settings.BRIEF_MAX_CHARS or 14000))
        if len(brief) > cap:
            brief = brief[:cap].rsplit("\n", 1)[0]
            brief += "\n[Evidence brief truncated to fit the model input budget.]"
        return brief

    def _brief_from_sources(self, company_name: str) -> str:
        """Assemble a brief straight from retrieved evidence.

        Used when the ReAct loop dies after doing useful work. Everything here
        came from a search index, so it is strictly more trustworthy than a
        model-written brief — just less organised.
        """
        lines = [
            f"Research brief for {company_name} assembled from retrieved sources "
            f"(the research loop ended before writing its own summary).",
            "",
        ]
        for index, record in enumerate(self.collector.details(), 1):
            lines.append(f"[{index}] {record.get('title') or 'Untitled'}")
            lines.append(f"URL: {record['url']}")
            if record.get("published_date"):
                lines.append(f"Published: {record['published_date']}")
            if record.get("snippet"):
                lines.append(record["snippet"])
            lines.append("")
        return "\n".join(lines)

    # ─── Stage 2: extract ────────────────────

    def _extract(
        self, brief: str, company_name: str, website_url: str
    ) -> CompanyResearchExtraction:
        """Convert a research brief into a validated extraction."""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        payload = f"Company: {company_name}\n\nResearch brief:\n\n{brief}"

        # Preferred path: provider fills the Pydantic schema directly.
        if self.extractor is not None:
            try:
                result = self.extractor.invoke(
                    [
                        SystemMessage(content=extraction_prompt(today)),
                        HumanMessage(content=payload),
                    ]
                )
                if isinstance(result, CompanyResearchExtraction):
                    return result
                if isinstance(result, dict):
                    return CompanyResearchExtraction(**result)
                logger.warning(f"Unexpected extractor return type: {type(result)}")
            except Exception as e:
                logger.warning(f"Structured extraction failed, falling back: {e}")

        # Fallback path: ask for raw JSON and parse it by hand.
        try:
            raw = self.extraction_llm.invoke(
                [
                    SystemMessage(
                        content=extraction_prompt(today)
                        + "\n\nReturn ONLY valid JSON, no other text."
                    ),
                    HumanMessage(content=payload),
                ]
            ).content
            return CompanyResearchExtraction(**self._parse_json_response(raw))
        except Exception as e:
            logger.error(f"Extraction failed entirely: {e}")
            return self._degraded_extraction(brief, company_name, website_url)

    def _degraded_extraction(
        self, brief: str, company_name: str, website_url: str
    ) -> CompanyResearchExtraction:
        """Last resort: surface what we know instead of a blank 'Unknown' card."""
        self._degraded = True
        return CompanyResearchExtraction(
            basic_info=CompanyBasicInfo(
                name=company_name,
                website=website_url or None,
                description="Structured extraction failed. Raw research below.",
            ),
            ai_summary=brief[:1000] if brief else None,
        )

    def _parse_json_response(self, text: str) -> dict:
        """Parse JSON from an LLM response, handling markdown code blocks."""
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1:
            text = text[start:end + 1]

        return json.loads(text)

    # ─── Stage 3: verify against retrieved evidence ────────────────────

    def _apply_source_truth(
        self,
        extraction: CompanyResearchExtraction,
        company_name: str,
        website_url: str,
    ) -> CompanyResearchResult:
        """Replace every model-asserted fact the server can establish itself."""
        result = CompanyResearchResult.model_validate(extraction.model_dump())
        collector = self.collector

        # 1. Citations are ground truth, not a model output.
        result.sources = collector.urls
        result.source_details = [
            SourceRef(
                url=record["url"],
                title=record.get("title"),
                domain=record.get("domain"),
                published_date=record.get("published_date"),
                kind=record.get("kind"),
            )
            for record in collector.details()
        ]

        # 2. News: verify each link, repair dates from the search index.
        result.recent_news = self._verify_news(result.recent_news)

        # 3. Make every outbound link absolute so the browser stops treating
        #    "www.example.com" as a relative path.
        if result.basic_info is None:
            result.basic_info = CompanyBasicInfo(name=company_name)
        info = result.basic_info
        info.name = info.name or company_name
        info.website = canonicalize_url(info.website) or canonicalize_url(website_url)
        info.logo_url = canonicalize_url(info.logo_url)

        if result.social_media:
            for field_name in type(result.social_media).model_fields:
                setattr(
                    result.social_media,
                    field_name,
                    canonicalize_url(getattr(result.social_media, field_name)),
                )

        for competitor in result.competitors or []:
            competitor.website = canonicalize_url(competitor.website)

        for member in result.leadership or []:
            profile = canonicalize_url(member.linkedin_url)
            # A "LinkedIn URL" that is not on linkedin.com is a hallucination.
            member.linkedin_url = (
                profile if profile and (domain_of(profile) or "").endswith("linkedin.com") else None
            )

        # 4. Drop a SWOT that came back completely empty rather than rendering
        #    four blank columns.
        swot = result.swot_analysis
        if swot and not any(
            [swot.strengths, swot.weaknesses, swot.opportunities, swot.threats]
        ):
            result.swot_analysis = None

        # 5. Provenance metadata the UI can show.
        newest = collector.newest_published()
        result.data_freshness = humanize_age(days_since(newest)) if newest else None
        result.research_confidence = self._derive_confidence(result)
        result.researched_at = (
            datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        )
        return result

    def _verify_news(self, items) -> Optional[List]:
        """Check each news link against what was actually retrieved.

        A URL the agent never fetched is dropped rather than shipped as a dead
        link. The headline survives, because a real headline with no link still
        carries information; a 404 does not.
        """
        if not items:
            return None

        verified = []
        for item in items:
            record = self.collector.record(item.url)
            if record is None:
                # The model may have copied a real headline but mangled the URL.
                record = self.collector.match_title(item.title, kinds=("news", "web"))

            if record:
                item.url = record["url"]
                item.verified = True
                if record.get("published_date"):
                    item.date = record["published_date"]
                item.source = item.source or record.get("domain")
            else:
                item.url = None
                item.verified = False
                item.date = to_iso_date(item.date) or item.date
            verified.append(item)

        # Verified items first, each group newest first. A confirmed headline
        # outranks an unconfirmed one even when the unconfirmed one claims a
        # more recent date — that claimed date is exactly what we distrust.
        floor = datetime.min.replace(tzinfo=timezone.utc)
        verified.sort(
            key=lambda i: (1 if i.verified else 0, parse_date(i.date) or floor),
            reverse=True,
        )
        return verified or None

    def _derive_confidence(self, result: CompanyResearchResult) -> str:
        """Rate confidence from evidence rather than asking the model how sure it feels.

        Self-reported confidence is worthless — a model that invented a fact
        will happily rate it "high". Distinct source domains and section
        coverage are things the server can count.
        """
        if self._degraded:
            return "low"

        domains = len(self.collector.domains)
        financials = result.financial_info
        populated = sum(
            1
            for section in (
                result.basic_info.description if result.basic_info else None,
                result.products_and_services,
                result.leadership,
                result.recent_news,
                (
                    financials.total_funding
                    or financials.revenue
                    or financials.funding_rounds
                )
                if financials
                else None,
                result.competitors,
            )
            if section
        )

        if domains >= 6 and populated >= 5:
            return "high"
        if domains >= 3 and populated >= 3:
            return "medium"
        return "low"

    # ─── Stage 4: analyze the verified result ────────────────────

    def _analyze(
        self, result: CompanyResearchResult, company_name: str
    ) -> Optional[CompanyAnalysis]:
        """Reason over the verified result and return a consultant-style read.

        Runs last, deliberately. By this point every fact has been transcribed
        from a page that was actually retrieved and every link has been checked,
        so the analyst cannot launder an invented fact through an opinion. It is
        shown the clean result and the numbered evidence list, and nothing else:
        not the raw brief, not the tool transcript, and explicitly not its own
        recollection of the company.

        Failure here is never fatal. Analysis is an enhancement, and a run that
        produced good verified facts must not be discarded because one extra
        call timed out or hit a rate limit.
        """
        if self._degraded:
            logger.info("Skipping analysis: extraction ran in degraded mode")
            return None

        evidence = self._evidence_list(result)
        if not evidence:
            logger.info("Skipping analysis: no verified sources to reason from")
            return None

        model_id = analysis_model_id()
        try:
            analyst = self._build_analyst(model_id)
        except Exception as e:
            logger.warning(f"Analyst unavailable, skipping analysis: {e}")
            return None

        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        payload = (
            f"Company: {company_name}\n\n"
            f"=== VERIFIED FACT SHEET ===\n{self._fact_sheet(result)}\n\n"
            f"=== EVIDENCE (cite these index numbers) ===\n{evidence}"
        )

        try:
            analysis = analyst.invoke(
                [
                    SystemMessage(content=analysis_prompt(today)),
                    HumanMessage(content=payload),
                ]
            )
        except Exception as e:
            logger.error(f"Analysis failed ({model_id}): {e}")
            return None

        if not isinstance(analysis, CompanyAnalysis):
            logger.warning("Analyst returned an unexpected type; dropping analysis")
            return None

        analysis.generated_by = model_id
        return self._sanitize_analysis(analysis, len(result.source_details or []))

    def _build_analyst(self, model_id: Optional[str]):
        """Structured-output client for stage 4.

        ``reasoning_effort`` is understood only by gpt-oss style models and by
        recent langchain-groq releases. An unsupported keyword raises at
        construction time, so it gets its own attempt and a clean retry without
        it rather than being allowed to disable the whole stage.
        """
        base = dict(
            max_tokens=settings.ANALYSIS_MAX_TOKENS,
            model=model_id,
            temperature=settings.ANALYSIS_TEMPERATURE,
        )
        effort = (settings.ANALYSIS_REASONING_EFFORT or "").strip().lower()

        if effort in ("low", "medium", "high"):
            try:
                llm = get_llm(**base, extra={"reasoning_effort": effort})
                return llm.with_structured_output(CompanyAnalysis)
            except Exception as e:
                logger.info(f"reasoning_effort rejected, retrying without it: {e}")

        return get_llm(**base).with_structured_output(CompanyAnalysis)

    def _evidence_list(self, result: CompanyResearchResult) -> str:
        """Numbered source list. These indices are what analysis points cite."""
        details = result.source_details or []
        if not details:
            return ""

        rows = []
        for i, s in enumerate(details[: settings.ANALYSIS_MAX_EVIDENCE]):
            title = s.title or s.domain or s.url
            rows.append(
                f"[{i}] {s.published_date or 'undated'} | {s.domain or '?'} | {title}"
            )
        return "\n".join(rows)

    def _fact_sheet(self, result: CompanyResearchResult) -> str:
        """Compact text rendering of the verified result.

        Sending the raw JSON would spend tokens on nulls and punctuation. Empty
        fields are still worth stating: "not found" is information the analyst
        can legitimately turn into an ``unknowns`` entry, whereas an omitted key
        just looks like it was never considered.
        """
        lines: List[str] = []

        def add(label: str, value) -> None:
            lines.append(f"{label}: {value if value else 'not found'}")

        info = result.basic_info
        if info:
            add("Name", info.name)
            add("Website", info.website)
            add("Industry", info.industry)
            add("Founded", info.founded)
            add("Headquarters", info.headquarters)
            add("Size", info.company_size)
            add("Type", info.company_type)
            add("Description", info.description)

        add("Market position", result.market_position)
        add("Target market", result.target_market)
        add("Hiring status", result.hiring_status)
        add("Open roles", result.open_roles_summary)
        add("Culture", result.culture_and_values)

        if result.products_and_services:
            lines.append("Products and services:")
            for p in result.products_and_services[:10]:
                lines.append(f"  - {p.name}: {p.description or 'no description'}")

        if result.leadership:
            lines.append("Leadership:")
            for m in result.leadership[:10]:
                lines.append(f"  - {m.name}, {m.title}")

        fin = result.financial_info
        if fin:
            lines.append("Financials:")
            lines.append(f"  total funding: {fin.total_funding or 'not found'}")
            lines.append(f"  last valuation: {fin.last_valuation or 'not found'}")
            lines.append(f"  revenue: {fin.revenue or 'not found'}")
            lines.append(f"  ipo status: {fin.ipo_status or 'not found'}")
            for r in (fin.funding_rounds or [])[:8]:
                lines.append(
                    f"  round: {r.round_type or '?'} | "
                    f"{r.amount or '?'} | {r.date or '?'}"
                )

        if result.competitors:
            lines.append(
                "Competitors: " + ", ".join(c.name for c in result.competitors[:10])
            )

        if result.tech_stack:
            for t in result.tech_stack[:6]:
                lines.append(f"Tech ({t.category}): {', '.join(t.technologies[:10])}")

        if result.recent_news:
            lines.append("Recent news:")
            for n in result.recent_news[:10]:
                flag = "verified" if n.verified else "unverified"
                lines.append(f"  - {n.date or 'undated'} [{flag}] {n.title}")

        swot = result.swot_analysis
        if swot:
            for label, items in (
                ("Strengths", swot.strengths),
                ("Weaknesses", swot.weaknesses),
                ("Opportunities", swot.opportunities),
                ("Threats", swot.threats),
            ):
                if items:
                    lines.append(f"{label}: {'; '.join(items[:6])}")

        add("Data freshness", result.data_freshness)
        add("Evidence confidence", result.research_confidence)
        return "\n".join(lines)

    def _sanitize_analysis(
        self, analysis: CompanyAnalysis, source_count: int
    ) -> CompanyAnalysis:
        """Drop citations pointing at sources that do not exist.

        The analyst cites by index. A model under output pressure will
        occasionally cite [7] when only five sources were supplied, and an index
        resolving to nothing would render as a broken reference - the same class
        of defect as the unverified links this project set out to eliminate.
        """

        def clean(indices) -> List[int]:
            kept: List[int] = []
            for i in indices or []:
                if isinstance(i, int) and 0 <= i < source_count and i not in kept:
                    kept.append(i)
            return kept

        for group in (
            analysis.why_now,
            analysis.competitive_position,
            analysis.moat,
            analysis.non_obvious,
        ):
            for point in group:
                point.derived_from = clean(point.derived_from)

        for risk in analysis.risks:
            risk.derived_from = clean(risk.derived_from)

        return analysis
