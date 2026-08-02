export interface ResearchRequest {
  query: string;
  depth: 'quick' | 'standard' | 'deep';
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
  researched_at?: string;
}

export interface ResearchResponse {
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  query: string;
  result?: CompanyResearchResult;
  error?: string;
  duration_seconds?: number;
  cached: boolean;
}

export type DepthOption = 'quick' | 'standard' | 'deep';

export interface ExampleQuery {
  query: string;
  description: string;
}
