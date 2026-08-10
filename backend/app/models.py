from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class ResearchStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class ResearchRequest(BaseModel):
    query: str = Field(..., description="Company name or website URL", min_length=1, max_length=500)
    depth: str = Field(default="standard", description="Research depth: quick | standard | deep")

    class Config:
        json_schema_extra = {
            "example": {
                "query": "OpenAI",
                "depth": "standard"
            }
        }


class CompanyBasicInfo(BaseModel):
    name: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None
    industry: Optional[str] = None
    founded: Optional[str] = None
    headquarters: Optional[str] = None
    company_size: Optional[str] = None
    company_type: Optional[str] = None  # Public, Private, Startup, etc.
    stock_ticker: Optional[str] = None
    logo_url: Optional[str] = None
    tagline: Optional[str] = None


class ProductService(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None


class LeadershipMember(BaseModel):
    name: str
    title: str
    linkedin_url: Optional[str] = None
    bio: Optional[str] = None


class NewsItem(BaseModel):
    title: str
    summary: Optional[str] = None
    url: Optional[str] = None
    date: Optional[str] = None
    source: Optional[str] = None
    sentiment: Optional[str] = None  # positive | neutral | negative
    # Server-controlled. The extraction model must leave this alone; the agent
    # overwrites it after checking the URL against the pages actually fetched.
    verified: Optional[bool] = Field(
        default=None,
        description="Leave null. Set by the server after source verification.",
    )


class FundingRound(BaseModel):
    round_type: Optional[str] = None  # Seed, Series A, B, C, IPO etc.
    amount: Optional[str] = None
    date: Optional[str] = None
    investors: Optional[List[str]] = None


class FinancialInfo(BaseModel):
    total_funding: Optional[str] = None
    last_valuation: Optional[str] = None
    revenue: Optional[str] = None
    funding_rounds: Optional[List[FundingRound]] = None
    investors: Optional[List[str]] = None
    ipo_status: Optional[str] = None


class Competitor(BaseModel):
    name: str
    website: Optional[str] = None
    description: Optional[str] = None


class TechStackItem(BaseModel):
    category: str
    technologies: List[str]


class SocialMedia(BaseModel):
    linkedin: Optional[str] = None
    twitter: Optional[str] = None
    facebook: Optional[str] = None
    instagram: Optional[str] = None
    youtube: Optional[str] = None
    github: Optional[str] = None


class SwotAnalysis(BaseModel):
    """Four explicit lists instead of ``Dict[str, List[str]]``.

    An open-ended mapping compiles to a JSON Schema with no fixed properties,
    which Groq rejects for structured output. That rejection is what triggered
    the "Structured output unavailable, using text fallback" log line and sent
    every request down the fragile hand-written-JSON path. The wire format is
    unchanged, so the frontend needs no migration.
    """

    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    opportunities: List[str] = Field(default_factory=list)
    threats: List[str] = Field(default_factory=list)


class SourceRef(BaseModel):
    """A page the agent actually retrieved. Built by the server, never by the LLM."""

    url: str
    title: Optional[str] = None
    domain: Optional[str] = None
    published_date: Optional[str] = None
    kind: Optional[str] = None  # web | news | scrape


class CompanyResearchExtraction(BaseModel):
    """The schema the LLM is asked to fill.

    Deliberately excludes sources, timestamps and confidence. Those are facts
    about the *research run*, not about the company, and the server knows them
    exactly. Leaving them out removes the model's opportunity to invent them
    and shrinks the schema that has to survive the token budget.
    """

    basic_info: Optional[CompanyBasicInfo] = None
    products_and_services: Optional[List[ProductService]] = None
    leadership: Optional[List[LeadershipMember]] = None
    recent_news: Optional[List[NewsItem]] = None
    financial_info: Optional[FinancialInfo] = None
    competitors: Optional[List[Competitor]] = None
    market_position: Optional[str] = None
    target_market: Optional[str] = None
    tech_stack: Optional[List[TechStackItem]] = None
    social_media: Optional[SocialMedia] = None
    culture_and_values: Optional[str] = None
    hiring_status: Optional[str] = None
    open_roles_summary: Optional[str] = None
    swot_analysis: Optional[SwotAnalysis] = None
    ai_summary: Optional[str] = None


class CompanyResearchResult(CompanyResearchExtraction):
    """What the API returns: the extraction plus server-computed provenance."""

    research_confidence: Optional[str] = None  # high | medium | low
    sources: Optional[List[str]] = None
    source_details: Optional[List[SourceRef]] = None
    data_freshness: Optional[str] = None
    researched_at: Optional[str] = None


class ResearchResponse(BaseModel):
    status: ResearchStatus
    query: str
    result: Optional[CompanyResearchResult] = None
    error: Optional[str] = None
    duration_seconds: Optional[float] = None
    cached: bool = False


class HealthResponse(BaseModel):
    status: str
    version: str
    llm_provider: str
    cache_enabled: bool
