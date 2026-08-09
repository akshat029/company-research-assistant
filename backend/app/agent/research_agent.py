import logging
import json
import time
from datetime import datetime
from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

from app.config import get_settings
from app.models import CompanyResearchResult, CompanyBasicInfo, ProductService
from app.models import LeadershipMember, NewsItem, FinancialInfo, FundingRound
from app.models import Competitor, TechStackItem, SocialMedia, ResearchStatus
from app.utils.url_resolver import resolve_query
from app.agent.tools import scrape_website, format_search_results, build_search_queries
from app.agent.prompts import RESEARCH_SYSTEM_PROMPT, EXTRACTION_PROMPT

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

@tool
def web_search(query: str) -> str:
    """Search the web for information about a company. Use for general research."""
    try:
        client = get_tavily_client()
        results = client.search(
            query=query,
            search_depth="basic",
            max_results=settings.MAX_SEARCH_RESULTS,
            include_answer=False,
        )
        answer = results.get('answer', '')
        raw_results = results.get('results', [])
        formatted = format_search_results(raw_results)
        if answer:
            return f"AI Answer: {answer}\n\nDetailed Results:\n{formatted}"
        return formatted
    except Exception as e:
        logger.error(f"Web search error: {e}")
        return f"Search error: {str(e)}"


@tool
def search_news(company_name: str) -> str:
    """Search for recent news articles about the company."""
    try:
        client = get_tavily_client()
        results = client.search(
            query=f"{company_name} latest news announcements 2024 2025",
            search_depth="basic",
            max_results=settings.MAX_SEARCH_RESULTS,
            topic="news",
        )
        return format_search_results(results.get('results', []))
    except Exception as e:
        logger.error(f"News search error: {e}")
        return f"News search error: {str(e)}"


@tool
def scrape_url(url: str) -> str:
    """Scrape and extract text content from a website URL. Use for company websites."""
    return scrape_website(url)


# ─── Main Research Agent ──────────────────────────────────────────────────────

class CompanyResearchAgent:
    """Orchestrates company research as two decoupled stages.

    Stage 1 (gather): a ReAct agent calls search/scrape tools and writes a
    plain-text research brief. No JSON schema is sent into this loop, so the
    prompt is not re-transmitted on every turn.

    Stage 2 (extract): a single tool-free call converts that brief into a
    CompanyResearchResult. Structured output is bound to the Pydantic model,
    so the provider fills the schema via function calling instead of the model
    hand-writing JSON that can be truncated mid-string.
    """

    def __init__(self):
        self.llm = get_llm()
        self.tools = [web_search, search_news, scrape_url]
        self.agent = create_react_agent(
            model=self.llm,
            tools=self.tools,
        )

        # Separate client for extraction: no tools, larger output budget.
        self.extraction_llm = get_llm(max_tokens=settings.EXTRACTION_MAX_TOKENS)
        try:
            self.extractor = self.extraction_llm.with_structured_output(
                CompanyResearchResult
            )
        except Exception as e:
            # Some providers reject complex nested schemas. Fall back to
            # free-text JSON plus manual parsing.
            logger.warning(f"Structured output unavailable, using text fallback: {e}")
            self.extractor = None

    # ─── Public API ────────────────────────────────────────────────────

    def research(self, query: str, depth: str = "standard") -> CompanyResearchResult:
        """Execute the full research pipeline."""
        start_time = time.time()
        company_name, website_url, is_url = resolve_query(query)

        logger.info(
            f"Researching: '{company_name}' | URL: '{website_url}' | Depth: {depth}"
        )

        brief = self._gather(company_name, website_url, depth)
        logger.info(f"Research brief: {len(brief)} chars")

        result = self._extract(brief, company_name, website_url)
        result.researched_at = datetime.utcnow().isoformat() + "Z"

        elapsed = time.time() - start_time
        logger.info(f"Research completed in {elapsed:.1f}s")

        return result

    # ─── Stage 1: gather ────────────────────────────────────────────────

    def _gather(self, company_name: str, website_url: str, depth: str) -> str:
        """Run the tool-using agent and return a plain-text research brief."""
        url_context = f" Their website is {website_url}." if website_url else ""
        depth_instruction = {
            "quick": "Do a quick focused overview (5-6 searches max).",
            "standard": "Do thorough research (8-10 searches).",
            "deep": "Do an exhaustive deep-dive (12+ searches, scrape the website).",
        }.get(depth, "Do thorough research (8-10 searches).")

        research_task = f"""Research the company: "{company_name}".{url_context}

{depth_instruction}

Investigate and report on:
1. Company overview (description, industry, founding year, HQ, size, type)
2. Products and services
3. Leadership team (CEO, CTO, founders)
4. Recent news (last 6 months)
5. Funding and financial info
6. Competitors
7. Tech stack (if findable)
8. Social media links
9. Culture and values
10. Hiring/jobs status

Write your findings as a concise plain-text brief organised under those
headings. Put the source URL next to each fact where you have one, and list
every URL you used at the end under "Sources:".

Do NOT output JSON. A separate step handles formatting.
"""

        messages = [
            SystemMessage(content=RESEARCH_SYSTEM_PROMPT),
            HumanMessage(content=research_task),
        ]

        result = self.agent.invoke(
            {"messages": messages},
            config={"recursion_limit": settings.AGENT_RECURSION_LIMIT},
        )
        return result["messages"][-1].content

    # ─── Stage 2: extract ───────────────────────────────────────────────

    def _extract(
        self, brief: str, company_name: str, website_url: str
    ) -> CompanyResearchResult:
        """Convert a research brief into a validated CompanyResearchResult."""
        payload = f"Company: {company_name}\n\nResearch brief:\n\n{brief}"

        # Preferred path: provider fills the Pydantic schema directly.
        if self.extractor is not None:
            try:
                result = self.extractor.invoke(
                    [
                        SystemMessage(content=EXTRACTION_PROMPT),
                        HumanMessage(content=payload),
                    ]
                )
                if isinstance(result, CompanyResearchResult):
                    return result
                if isinstance(result, dict):
                    return CompanyResearchResult(**result)
                logger.warning(f"Unexpected extractor return type: {type(result)}")
            except Exception as e:
                logger.warning(f"Structured extraction failed, falling back: {e}")

        # Fallback path: ask for raw JSON and parse it by hand.
        try:
            raw = self.extraction_llm.invoke(
                [
                    SystemMessage(
                        content=EXTRACTION_PROMPT
                        + "\n\nReturn ONLY valid JSON, no other text."
                    ),
                    HumanMessage(content=payload),
                ]
            ).content
            return CompanyResearchResult(**self._parse_json_response(raw))
        except Exception as e:
            logger.error(f"Extraction failed entirely: {e}")
            return self._degraded_result(brief, company_name, website_url)

    def _degraded_result(
        self, brief: str, company_name: str, website_url: str
    ) -> CompanyResearchResult:
        """Last resort: surface what we know instead of a blank 'Unknown' card."""
        return CompanyResearchResult(
            basic_info=CompanyBasicInfo(
                name=company_name,
                website=website_url or None,
                description="Structured extraction failed. Raw research below.",
            ),
            ai_summary=brief[:1000] if brief else None,
            research_confidence="low",
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
