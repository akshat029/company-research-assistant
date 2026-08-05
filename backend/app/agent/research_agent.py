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


def get_llm():
    """Get the configured LLM.

    Provider SDKs are imported lazily so that a missing optional dependency
    (e.g. langchain_openai when running on Groq) cannot break this module.
    """
    if settings.LLM_PROVIDER == "groq" and settings.GROQ_API_KEY:
        from langchain_groq import ChatGroq
        return ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model=settings.GROQ_MODEL,
            temperature=settings.LLM_TEMPERATURE,
            max_tokens=settings.LLM_MAX_TOKENS,
        )
    elif settings.OPENAI_API_KEY:
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            api_key=settings.OPENAI_API_KEY,
            model=settings.OPENAI_MODEL,
            temperature=settings.LLM_TEMPERATURE,
            max_tokens=settings.LLM_MAX_TOKENS,
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
            max_results=8,
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
    """Main agent that orchestrates company research."""

    def __init__(self):
        self.llm = get_llm()
        self.tools = [web_search, search_news, scrape_url]
        self.agent = create_react_agent(
            model=self.llm,
            tools=self.tools,
        )

    def research(self, query: str, depth: str = "standard") -> CompanyResearchResult:
        """Execute full company research pipeline."""
        start_time = time.time()
        company_name, website_url, is_url = resolve_query(query)

        logger.info(f"Researching: '{company_name}' | URL: '{website_url}' | Depth: {depth}")

        # Build research instruction
        url_context = f" Their website is {website_url}." if website_url else ""
        depth_instruction = {
            "quick": "Do a quick focused overview (5-6 searches max).",
            "standard": "Do thorough research (8-10 searches).",
            "deep": "Do an exhaustive deep-dive (12+ searches, scrape the website).",
        }.get(depth, "Do thorough research (8-10 searches).")

        research_task = f"""
Research the company: "{company_name}".{url_context}

{depth_instruction}

Gather:
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

After gathering all info, compile everything into a comprehensive JSON matching 
this exact structure (use null for missing fields):

{{
  "basic_info": {{
    "name": "...",
    "website": "...",
    "description": "...",
    "industry": "...",
    "founded": "...",
    "headquarters": "...",
    "company_size": "...",
    "company_type": "...",
    "stock_ticker": null,
    "tagline": "..."
  }},
  "products_and_services": [
    {{"name": "...", "description": "...", "category": "..."}}
  ],
  "leadership": [
    {{"name": "...", "title": "...", "bio": "..."}}
  ],
  "recent_news": [
    {{"title": "...", "summary": "...", "url": "...", "date": "...", "source": "...", "sentiment": "positive|neutral|negative"}}
  ],
  "financial_info": {{
    "total_funding": "...",
    "last_valuation": "...",
    "revenue": null,
    "funding_rounds": [
      {{"round_type": "...", "amount": "...", "date": "...", "investors": [...]}}
    ],
    "investors": [...],
    "ipo_status": "..."
  }},
  "competitors": [
    {{"name": "...", "website": "...", "description": "..."}}
  ],
  "market_position": "...",
  "target_market": "...",
  "tech_stack": [
    {{"category": "...", "technologies": [...]}}
  ],
  "social_media": {{
    "linkedin": "...",
    "twitter": "...",
    "github": "..."
  }},
  "culture_and_values": "...",
  "hiring_status": "...",
  "open_roles_summary": "...",
  "swot_analysis": {{
    "strengths": [...],
    "weaknesses": [...],
    "opportunities": [...],
    "threats": [...]
  }},
  "ai_summary": "3-4 sentence executive summary",
  "research_confidence": "high|medium|low",
  "sources": ["url1", "url2", ...]
}}

Return ONLY the JSON object, no other text.
"""

        # Run the agent
        messages = [HumanMessage(content=research_task)]
        result = self.agent.invoke(
            {"messages": messages},
            config={"recursion_limit": 8},
        )

        # Extract the final message
        final_message = result["messages"][-1].content

        # Parse JSON from the response
        research_data = self._parse_json_response(final_message)
        research_data["researched_at"] = datetime.utcnow().isoformat() + "Z"

        elapsed = time.time() - start_time
        logger.info(f"Research completed in {elapsed:.1f}s")

        return CompanyResearchResult(**research_data)

    def _parse_json_response(self, text: str) -> dict:
        """Parse JSON from LLM response, handling code blocks."""
        # Remove markdown code blocks if present
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        # Find JSON object
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1:
            text = text[start:end+1]

        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}")
            # Return minimal valid structure
            return {
                "basic_info": {"name": "Unknown", "description": "Research completed but JSON parsing failed."},
                "ai_summary": text[:500],
                "research_confidence": "low"
            }
