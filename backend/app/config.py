from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Company Research Assistant"
    APP_VERSION: str = "1.2.0"
    DEBUG: bool = False

    # API Keys
    OPENAI_API_KEY: str = ""
    TAVILY_API_KEY: str = ""
    GROQ_API_KEY: str = ""  # free-tier alternative to OpenAI

    # LLM Settings
    LLM_PROVIDER: str = "openai"  # openai | groq
    OPENAI_MODEL: str = "gpt-4o"
    # Stage 1 drives the ReAct tool loop, where reliable function calling matters
    # far more than raw reasoning. llama-3.3-70b is the proven choice for that.
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    # Stages 2 and 4 carry no tool history and reason over text that has already
    # been retrieved, so they can afford a stronger model. Blank = use GROQ_MODEL.
    GROQ_EXTRACTION_MODEL: str = "openai/gpt-oss-120b"
    GROQ_ANALYSIS_MODEL: str = "openai/gpt-oss-120b"
    # Blank = use OPENAI_MODEL.
    OPENAI_ANALYSIS_MODEL: str = ""
    LLM_TEMPERATURE: float = 0.0
    # The analyst stage is the one place a little sampling helps: it is asked for
    # judgement, not transcription. Everything else stays deterministic.
    ANALYSIS_TEMPERATURE: float = 0.3
    # Output budget for the research stage. Reserved output tokens count
    # against Groq's tokens-per-minute quota (free tier: 12,000 TPM), and the
    # research stage only needs to write a plain-text brief.
    LLM_MAX_TOKENS: int = 2048
    # Output budget for the extraction stage. This call carries no tool history,
    # so it can afford a larger budget — and it needs one, because the full
    # result schema does not fit in 2048 tokens.
    EXTRACTION_MAX_TOKENS: int = 4096
    # Output budget for the analyst stage.
    ANALYSIS_MAX_TOKENS: int = 4096

    # Analysis (stage 4)
    # Master switch. Individual requests can still opt out via the API.
    ENABLE_ANALYSIS: bool = True
    # gpt-oss models accept low | medium | high. Ignored by non-reasoning models.
    ANALYSIS_REASONING_EFFORT: str = "medium"
    # How many verified sources the analyst is shown. Each one costs tokens, and
    # past ~15 the marginal source stops changing the conclusions.
    ANALYSIS_MAX_EVIDENCE: int = 14

    # Research Settings
    # How many results Tavily returns. These all feed the source collector, so
    # raising it improves provenance without costing prompt tokens.
    MAX_SEARCH_RESULTS: int = 8
    # How many of those results are actually shown to the model. This is the
    # only one of the two that costs tokens — lower it first on HTTP 413.
    SEARCH_RESULTS_IN_PROMPT: int = 4
    # Characters of snippet per shown result.
    SEARCH_SNIPPET_CHARS: int = 350
    # Recency window for the news tool, in days.
    NEWS_RECENCY_DAYS: int = 180
    # Upper bound on tracked sources per run.
    MAX_SOURCES: int = 25
    # Character budget for a single scraped page.
    MAX_SCRAPE_CHARS: int = 4000
    MAX_SCRAPE_PAGES: int = 3
    RESEARCH_TIMEOUT_SECONDS: int = 120
    # Max ReAct turns before LangGraph aborts. Each turn resends the full
    # message history, so raising this increases token usage superlinearly.
    AGENT_RECURSION_LIMIT: int = 8

    # Cache
    ENABLE_CACHE: bool = True
    CACHE_TTL_SECONDS: int = 3600  # 1 hour

    # CORS
    CORS_ORIGINS: list = ["http://localhost:5173", "http://localhost:3000", "*"]

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
