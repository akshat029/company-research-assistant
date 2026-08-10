export interface ResearchRequest {
  query: string;
  depth: 'quick' | 'standard' | 'deep';
  /** Run the analyst stage. Costs one extra LLM call on the backend. */
  include_analysis?: boolean;
}

export interface CompanyBasicInfo {
  name?: string;
  website?: string;
  description?: string;
  industry?: string;
  founded?: string;
  headquarters?: string;
  company_size?: string;
  company_type?: string;
  stock_ticker?: string;
  logo_url?: string;
  tagline?: string;
}

export interface ProductService {
  name: string;
  description?: string;
  category?: string;
}

export interface LeadershipMember {
  name: string;
  title: string;
  linkedin_url?: string;
  bio?: string;
}

export interface NewsItem {
  title: string;
  summary?: string;
  url?: string;
  date?: string;
  source?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  /**
   * Set by the backend, never by the model. `true` means the link was actually
   * returned by the search index; `false` means the model asserted the story
   * but no retrieved source backs it, so the UI must not render it as a link.
   */
  verified?: boolean;
}

export interface FundingRound {
  round_type?: string;
  amount?: string;
  date?: string;
  investors?: string[];
}

export interface FinancialInfo {
  total_funding?: string;
  last_valuation?: string;
  revenue?: string;
  funding_rounds?: FundingRound[];
  investors?: string[];
  ipo_status?: string;
}

export interface Competitor {
  name: string;
  website?: string;
  description?: string;
}

export interface TechStackItem {
  category: string;
  technologies: string[];
}

export interface SocialMedia {
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  instagram?: string;
  youtube?: string;
  github?: string;
}

export interface SwotAnalysis {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

/** A source the backend actually retrieved, with its real publication date. */
export interface SourceRef {
  url: string;
  title?: string;
  domain?: string;
  published_date?: string;
  kind?: string;
}

/**
 * One analytical claim.
 *
 * `derived_from` holds indices into `source_details`. The backend drops any
 * index that does not resolve, so an index present here always points at a
 * real, retrieved source.
 */
export interface AnalysisPoint {
  point: string;
  rationale?: string;
  derived_from: number[];
  confidence?: 'high' | 'medium' | 'low';
}

export interface RiskItem {
  risk: string;
  severity?: 'high' | 'medium' | 'low';
  rationale?: string;
  derived_from: number[];
}

/**
 * Stage 4 output: inference, deliberately kept in its own object.
 *
 * Every other field on `CompanyResearchResult` was transcribed from a page that
 * was actually retrieved. Everything here is judgement derived from those
 * facts. They are modelled apart so the UI can keep the distinction visible
 * rather than blending sourced fact and opinion into one page.
 */
export interface CompanyAnalysis {
  thesis?: string;
  why_now: AnalysisPoint[];
  competitive_position: AnalysisPoint[];
  moat: AnalysisPoint[];
  risks: RiskItem[];
  non_obvious: AnalysisPoint[];
  questions_to_ask: string[];
  unknowns: string[];
  analyst_confidence?: 'high' | 'medium' | 'low';
  /** Which model produced this read. */
  generated_by?: string;
}

export interface CompanyResearchResult {
  basic_info?: CompanyBasicInfo;
  products_and_services?: ProductService[];
  leadership?: LeadershipMember[];
  recent_news?: NewsItem[];
  financial_info?: FinancialInfo;
  competitors?: Competitor[];
  market_position?: string;
  target_market?: string;
  tech_stack?: TechStackItem[];
  social_media?: SocialMedia;
  culture_and_values?: string;
  hiring_status?: string;
  open_roles_summary?: string;
  swot_analysis?: SwotAnalysis;
  ai_summary?: string;
  research_confidence?: 'high' | 'medium' | 'low';
  sources?: string[];
  /** Richer view of `sources`, including titles and real publication dates. */
  source_details?: SourceRef[];
  /** Human-readable age of the freshest retrieved source, e.g. "12 days old". */
  data_freshness?: string;
  researched_at?: string;
  /** Present only when the analyst stage ran and succeeded. */
  analysis?: CompanyAnalysis;
}

export interface ResearchResponse {
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  query: string;
  result?: CompanyResearchResult;
  error?: string;
  duration_seconds?: number;
  cached: boolean;
}

export interface HealthResponse {
  status: string;
  version: string;
  llm_provider: string;
  cache_enabled: boolean;
}

export type DepthOption = 'quick' | 'standard' | 'deep';

export interface ExampleQuery {
  query: string;
  description: string;
}
