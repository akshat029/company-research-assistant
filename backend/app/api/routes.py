import logging
import time
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from typing import Optional
import json

from app.models import ResearchRequest, ResearchResponse, ResearchStatus, HealthResponse
from app.config import get_settings, Settings
from app.utils.cache import get_cache
from app.utils.url_resolver import resolve_query

logger = logging.getLogger(__name__)
router = APIRouter()


def get_research_agent():
    """Lazy-load the research agent to avoid slow startup."""
    from app.agent.research_agent import CompanyResearchAgent
    return CompanyResearchAgent()


@router.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check(settings: Settings = Depends(get_settings)):
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        version=settings.APP_VERSION,
        llm_provider=settings.LLM_PROVIDER,
        cache_enabled=settings.ENABLE_CACHE,
    )


@router.post("/research", response_model=ResearchResponse, tags=["Research"])
async def research_company(request: ResearchRequest, settings: Settings = Depends(get_settings)):
    """
    Research a company by name or website URL.
    
    - **query**: Company name (e.g. "OpenAI") or website URL (e.g. "https://openai.com")
    - **depth**: Research depth - "quick" (fast overview), "standard" (thorough), "deep" (exhaustive)
    - **include_analysis**: run the analyst stage. Costs one extra LLM call.
    """
    start_time = time.time()
    query = request.query.strip()
    depth = request.depth
    # The server-side switch wins: if analysis is disabled globally, a request
    # cannot turn it back on.
    include_analysis = bool(request.include_analysis and settings.ENABLE_ANALYSIS)

    logger.info(
        f"Research request: query='{query}', depth='{depth}', "
        f"analysis={include_analysis}"
    )

    # The analysis toggle is part of the cache identity. Without it, a cached
    # facts-only run would be served to a request that asked for analysis and
    # the Analysis tab would come back mysteriously empty.
    cache_variant = f"{depth}+analysis" if include_analysis else depth

    # Check cache
    if settings.ENABLE_CACHE:
        cache = get_cache(settings.CACHE_TTL_SECONDS)
        cached_result = cache.get(query, cache_variant)
        if cached_result:
            return ResearchResponse(
                status=ResearchStatus.COMPLETED,
                query=query,
                result=cached_result,
                duration_seconds=round(time.time() - start_time, 2),
                cached=True,
            )

    # Run research
    try:
        agent = get_research_agent()
        result = agent.research(
            query=query, depth=depth, include_analysis=include_analysis
        )

        # Cache result
        if settings.ENABLE_CACHE:
            cache = get_cache(settings.CACHE_TTL_SECONDS)
            cache.set(query, cache_variant, result)

        duration = round(time.time() - start_time, 2)
        logger.info(f"Research completed: query='{query}', duration={duration}s")

        return ResearchResponse(
            status=ResearchStatus.COMPLETED,
            query=query,
            result=result,
            duration_seconds=duration,
            cached=False,
        )

    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Configuration error: {str(e)}. Please check your API keys in .env"
        )
    except Exception as e:
        logger.error(f"Research failed for '{query}': {e}", exc_info=True)
        duration = round(time.time() - start_time, 2)
        return ResearchResponse(
            status=ResearchStatus.FAILED,
            query=query,
            result=None,
            error=str(e),
            duration_seconds=duration,
            cached=False,
        )


@router.get("/research/examples", tags=["Research"])
async def get_example_queries():
    """Get example company queries to try."""
    return {
        "examples": [
            {"query": "OpenAI", "description": "AI research company"},
            {"query": "Stripe", "description": "Payments infrastructure"},
            {"query": "notion.so", "description": "Productivity app (URL input)"},
            {"query": "Anthropic", "description": "AI safety company"},
            {"query": "Figma", "description": "Design tool"},
            {"query": "Vercel", "description": "Frontend deployment platform"},
            {"query": "https://linear.app", "description": "Issue tracking (URL input)"},
        ]
    }


@router.delete("/cache", tags=["System"])
async def clear_cache(settings: Settings = Depends(get_settings)):
    """Clear the research cache."""
    if settings.ENABLE_CACHE:
        cache = get_cache()
        cache.clear()
        return {"message": "Cache cleared successfully"}
    return {"message": "Cache is disabled"}


@router.get("/cache/stats", tags=["System"])
async def cache_stats(settings: Settings = Depends(get_settings)):
    """Get cache statistics."""
    if settings.ENABLE_CACHE:
        cache = get_cache()
        return {
            "enabled": True,
            "size": cache.size,
            "max_size": cache.max_size,
            "ttl_seconds": cache.ttl_seconds,
        }
    return {"enabled": False}
