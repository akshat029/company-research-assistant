import logging
import json
import time
from datetime import datetime, timezone
from typing import List, Optional

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

from app.config import get_settings
from app.models import (
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
from app.agent.prompts import extraction_prompt, research_system_prompt

logger = logging.getLogger(__name__)
settings = get_settings()


def get_llm(max_tokens: Optional[int] = None):
    """Get the configured LLM.

    Provider SDKs are imported lazily so that a missing optional dependency
    (e.g. langchain_openai when running on Groq) cannot break this module.

    Args:
        max_tokens: override the output token budget. The research stage and
            the extraction stage have very different needs, so they each build
            their own client.
    """
    tokens = max_tokens if max_tokens is not None else settings.LLM_MAX_TOKENS

    if settings.LLM_PROVIDER == "groq" and settings.GROQ_API_KEY:
        from langchain_groq import ChatGroq
        return ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model=settings.GROQ_MODEL,
            temperature=settings.LLM_TEMPERATURE,
            max_tokens=tokens,
        )
    elif settings.OPENAI_API_KEY:
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            api_key=settings.OPENAI_API_KEY,
            model=settings.OPENAI_MODEL,
            temperature=settings.LLM_TEMPERATURE,
            max_tokens=tokens,
        )
    else:
        raise ValueError(
            "No LLM API key configured. Set OPENAI_API_KEY or GROQ_API_KEY in .env"
        )


def get_tavily_client():
    """Get Tavily search client."""
    from tavily import TavilyClient
    if not settings.TAVILY_API_KEY:
        raise ValueError("TAVILY_API_KEY not set in .env")
    return TavilyClient(api_key=settings.TAVILY_API_KEY)


# ─── LangChain Tools ──────────────────────────────────────────────────────────

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
            client = get_tavily_client()
            response = client.search(
                query=query,
                search_depth="basic",
                max_results=settings.MAX_SEARCH_RESULTS,
                include_answer=False,
            )
            results = response.get("results", []) or []
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
            client = get_tavily_client()
            params = {
                # No hardcoded years. The old query pinned "2024 2025" into the
                # search string, which biased the index toward stale articles.
                "query": f"{company_name} news",
                "topic": "news",
                "search_depth": "basic",
                "max_results": settings.MAX_SEARCH_RESULTS,
                "include_answer": False,
            }
            try:
                # tavily-python defaults topic="news" to days=3, so "recent
                # news" silently meant "the last 72 hours" and usually returned
                # nothing. Ask for a real window.
                response = client.search(**params, days=settings.NEWS_RECENCY_DAYS)
            except TypeError:
                # Older tavily-python builds do not accept `days`.
                response = client.search(**params)

            results = response.get("results", []) or []
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


# ─── Main Research Agent ───────────────────────────────────────────────────

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

    # ─── Public API ─────────────────────────────────────

    def research(self, query: str, depth: str = "standard") -> CompanyResearchResult:
        """Execute the full research pipeline."""
        start_time = time.time()
        self.collector.reset()
        self._degraded = False

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

        elapsed = time.time() - start_time
        logger.info(
            f"Research completed in {elapsed:.1f}s "
            f"(confidence={result.research_confidence})"
        )
        return result

    # ─── Stage 1: gather ──────────────────────────────────

    def _gather(self, company_name: str, website_url: str, depth: str) -> str:
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

    # ─── Stage 2: extract ────────────────────────────────

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
