from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List, Dict, Any
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


class CompanyResearchResult(BaseModel):
    # Core
    basic_info: Optional[CompanyBasicInfo] = None
    
    # Products & Services
    products_and_services: Optional[List[ProductService]] = None
    
    # People
    leadership: Optional[List[LeadershipMember]] = None
    
    # News
    recent_news: Optional[List[NewsItem]] = None
    
    # Financial
    financial_info: Optional[FinancialInfo] = None
    
    # Market
    competitors: Optional[List[Competitor]] = None
    market_position: Optional[str] = None
    target_market: Optional[str] = None
    
    # Tech
    tech_stack: Optional[List[TechStackItem]] = None
    
    # Social
    social_media: Optional[SocialMedia] = None
    
    # Culture
    culture_and_values: Optional[str] = None
    
    # Jobs
    hiring_status: Optional[str] = None
    open_roles_summary: Optional[str] = None
    
    # Analysis
    swot_analysis: Optional[Dict[str, List[str]]] = None  # strengths, weaknesses, opportunities, threats
    ai_summary: Optional[str] = None
    research_confidence: Optional[str] = None  # high | medium | low
    
    # Meta
    sources: Optional[List[str]] = None
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
