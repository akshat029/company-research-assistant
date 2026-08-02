import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Company Research Assistant"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # API Keys
    OPENAI_API_KEY: str = ""
    TAVILY_API_KEY: str = ""
    GROQ_API_KEY: str = ""  # free-tier alternative to OpenAI

    # LLM Settings
    LLM_PROVIDER: str = "openai"  # openai | groq
    OPENAI_MODEL: str = "gpt-4o"
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    LLM_TEMPERATURE: float = 0.0
    LLM_MAX_TOKENS: int = 4096

    # Research Settings
    MAX_SEARCH_RESULTS: int = 8
    MAX_SCRAPE_PAGES: int = 3
    RESEARCH_TIMEOUT_SECONDS: int = 120

    # Cache
    ENABLE_CACHE: bool = True
    CACHE_TTL_SECONDS: int = 3600  # 1 hour

    # CORS
    CORS_ORIGINS: list = ["http://localhost:5173", "http://localhost:3000", "*"]

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
