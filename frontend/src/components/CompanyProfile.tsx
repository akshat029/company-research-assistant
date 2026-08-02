import React, { useState } from 'react';
import {
  Building2, Globe, Calendar, MapPin, Users, Briefcase,
  TrendingUp, Newspaper, Code2, Link2, Star, Target,
  ChevronDown, ChevronUp, ExternalLink, Twitter, Linkedin,
  Github, ShieldCheck, AlertTriangle, Lightbulb, Zap,
  DollarSign, Award, Clock
} from 'lucide-react';
import clsx from 'clsx';
import { CompanyResearchResult, NewsItem } from '../types';

interface CompanyProfileProps {
  result: CompanyResearchResult;
  query: string;
  duration?: number;
  cached?: boolean;
}

function Section({ title, icon: Icon, color, children }: {
  title: string;
  icon: React.ElementType;
  color: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white rounded-2xl border border-surface-200 shadow-soft overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon size={16} className="text-white" />
          </div>
          <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && <div className="px-6 pb-6 border-t border-surface-100">{children}</div>}
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment?: string }) {
  if (!sentiment) return null;
  const map = {
    positive: 'bg-green-100 text-green-700',
    neutral: 'bg-gray-100 text-gray-600',
    negative: 'bg-red-100 text-red-700',
  };
  return (
    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium capitalize', map[sentiment as keyof typeof map] || map.neutral)}>
      {sentiment}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence?: string }) {
  const map = {
    high: { label: 'High Confidence', cls: 'bg-green-100 text-green-700' },
    medium: { label: 'Medium Confidence', cls: 'bg-yellow-100 text-yellow-700' },
    low: { label: 'Low Confidence', cls: 'bg-red-100 text-red-700' },
  };
  const cfg = map[confidence as keyof typeof map] || map.medium;
  return <span className={clsx('text-xs px-2.5 py-1 rounded-full font-medium', cfg.cls)}>{cfg.label}</span>;
}

export function CompanyProfile({ result, query, duration, cached }: CompanyProfileProps) {
  const { basic_info, ai_summary, products_and_services, leadership, recent_news,
    financial_info, competitors, tech_stack, social_media, swot_analysis,
    culture_and_values, hiring_status, open_roles_summary, market_position,
    target_market, sources, research_confidence, researched_at } = result;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 animate-slide-up pb-16">

      {/* ── HERO HEADER ── */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-8 text-white shadow-lg">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{basic_info?.name || query}</h1>
              {basic_info?.stock_ticker && (
                <span className="text-xs px-2 py-1 bg-white/20 rounded-full font-mono">{basic_info.stock_ticker}</span>
              )}
            </div>
            {basic_info?.tagline && (
              <p className="text-blue-100 text-sm italic mb-3">{basic_info.tagline}</p>
            )}
            {basic_info?.description && (
              <p className="text-blue-50 text-sm leading-relaxed max-w-2xl">{basic_info.description}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 ml-4">
            <ConfidenceBadge confidence={research_confidence} />
            {cached && <span className="text-xs px-2 py-0.5 bg-white/20 rounded-full">Cached</span>}
            {duration && <span className="text-xs text-blue-200">{duration}s</span>}
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          {basic_info?.industry && (
            <div className="bg-white/10 rounded-xl p-3">
              <div className="text-xs text-blue-200 mb-1">Industry</div>
              <div className="text-sm font-medium">{basic_info.industry}</div>
            </div>
          )}
          {basic_info?.founded && (
            <div className="bg-white/10 rounded-xl p-3">
              <div className="text-xs text-blue-200 mb-1">Founded</div>
              <div className="text-sm font-medium">{basic_info.founded}</div>
            </div>
          )}
          {basic_info?.headquarters && (
            <div className="bg-white/10 rounded-xl p-3">
              <div className="text-xs text-blue-200 mb-1">HQ</div>
              <div className="text-sm font-medium">{basic_info.headquarters}</div>
            </div>
          )}
          {basic_info?.company_size && (
            <div className="bg-white/10 rounded-xl p-3">
              <div className="text-xs text-blue-200 mb-1">Size</div>
              <div className="text-sm font-medium">{basic_info.company_size}</div>
            </div>
          )}
        </div>

        {/* Links */}
        <div className="flex flex-wrap gap-3 mt-4">
          {basic_info?.website && (
            <a href={basic_info.website} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full transition-colors">
              <Globe size={12} /> {basic_info.website.replace(/^https?:\/\//, '')}
            </a>
          )}
          {social_media?.linkedin && (
            <a href={social_media.linkedin} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full transition-colors">
              <Linkedin size={12} /> LinkedIn
            </a>
          )}
          {social_media?.twitter && (
            <a href={social_media.twitter} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full transition-colors">
              <Twitter size={12} /> Twitter/X
            </a>
          )}
          {social_media?.github && (
            <a href={social_media.github} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full transition-colors">
              <Github size={12} /> GitHub
            </a>
          )}
        </div>
      </div>

      {/* ── AI SUMMARY ── */}
      {ai_summary && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={16} className="text-blue-600" />
            <span className="font-semibold text-blue-900 text-sm">AI Executive Summary</span>
          </div>
          <p className="text-blue-800 text-sm leading-relaxed">{ai_summary}</p>
        </div>
      )}

      {/* ── TWO COLUMN LAYOUT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Products & Services */}
        {products_and_services && products_and_services.length > 0 && (
          <Section title="Products & Services" icon={Briefcase} color="bg-purple-500">
            <div className="space-y-3 mt-4">
              {products_and_services.map((p, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-purple-600">{i + 1}</span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{p.name}</div>
                    {p.description && <div className="text-xs text-gray-500 mt-0.5">{p.description}</div>}
                    {p.category && <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full">{p.category}</span>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Leadership */}
        {leadership && leadership.length > 0 && (
          <Section title="Leadership Team" icon={Users} color="bg-green-500">
            <div className="space-y-3 mt-4">
              {leadership.map((person, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center flex-shrink-0 text-white text-sm font-bold">
                    {person.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 text-sm truncate">{person.name}</span>
                      {person.linkedin_url && (
                        <a href={person.linkedin_url} target="_blank" rel="noopener noreferrer">
                          <Linkedin size={12} className="text-blue-500" />
                        </a>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{person.title}</div>
                    {person.bio && <div className="text-xs text-gray-400 mt-1 line-clamp-2">{person.bio}</div>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Financials */}
        {financial_info && (
          <Section title="Funding & Financials" icon={DollarSign} color="bg-yellow-500">
            <div className="space-y-3 mt-4">
              {financial_info.total_funding && (
                <div className="flex justify-between items-center py-2 border-b border-surface-100">
                  <span className="text-sm text-gray-500">Total Funding</span>
                  <span className="font-semibold text-gray-900 text-sm">{financial_info.total_funding}</span>
                </div>
              )}
              {financial_info.last_valuation && (
                <div className="flex justify-between items-center py-2 border-b border-surface-100">
                  <span className="text-sm text-gray-500">Valuation</span>
                  <span className="font-semibold text-gray-900 text-sm">{financial_info.last_valuation}</span>
                </div>
              )}
              {financial_info.revenue && (
                <div className="flex justify-between items-center py-2 border-b border-surface-100">
                  <span className="text-sm text-gray-500">Revenue</span>
                  <span className="font-semibold text-gray-900 text-sm">{financial_info.revenue}</span>
                </div>
              )}
              {financial_info.ipo_status && (
                <div className="flex justify-between items-center py-2 border-b border-surface-100">
                  <span className="text-sm text-gray-500">IPO Status</span>
                  <span className="font-semibold text-gray-900 text-sm">{financial_info.ipo_status}</span>
                </div>
              )}
              {financial_info.investors && financial_info.investors.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">Key Investors</div>
                  <div className="flex flex-wrap gap-1.5">
                    {financial_info.investors.slice(0, 8).map((inv, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded-full border border-yellow-100">{inv}</span>
                    ))}
                  </div>
                </div>
              )}
              {financial_info.funding_rounds && financial_info.funding_rounds.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">Funding Rounds</div>
                  <div className="space-y-2">
                    {financial_info.funding_rounds.slice(0, 5).map((round, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">{round.round_type}</span>
                        {round.amount && <span className="font-semibold text-gray-900">{round.amount}</span>}
                        {round.date && <span className="text-gray-400">{round.date}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Competitors */}
        {competitors && competitors.length > 0 && (
          <Section title="Competitors" icon={Target} color="bg-red-500">
            <div className="space-y-2 mt-4">
              {competitors.map((comp, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                    <Building2 size={14} className="text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 text-sm">{comp.name}</span>
                      {comp.website && (
                        <a href={comp.website} target="_blank" rel="noopener noreferrer">
                          <ExternalLink size={11} className="text-gray-400" />
                        </a>
                      )}
                    </div>
                    {comp.description && <div className="text-xs text-gray-500 truncate">{comp.description}</div>}
                  </div>
                </div>
              ))}
            </div>
            {market_position && (
              <div className="mt-4 pt-4 border-t border-surface-100">
                <div className="text-xs text-gray-500 mb-1">Market Position</div>
                <p className="text-sm text-gray-700">{market_position}</p>
              </div>
            )}
          </Section>
        )}
      </div>

      {/* ── FULL WIDTH SECTIONS ── */}

      {/* Recent News */}
      {recent_news && recent_news.length > 0 && (
        <Section title="Recent News" icon={Newspaper} color="bg-orange-500">
          <div className="space-y-3 mt-4">
            {recent_news.map((item, i) => (
              <div key={i} className="flex gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-surface-100">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                  <span className="text-xs font-bold text-orange-500">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer"
                          className="font-medium text-gray-900 text-sm hover:text-blue-600 transition-colors">
                          {item.title}
                        </a>
                      ) : (
                        <div className="font-medium text-gray-900 text-sm">{item.title}</div>
                      )}
                      {item.summary && <p className="text-xs text-gray-500 mt-1">{item.summary}</p>}
                    </div>
                    <SentimentBadge sentiment={item.sentiment} />
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    {item.source && <span className="text-xs text-gray-400">{item.source}</span>}
                    {item.date && <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={10} />{item.date}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* SWOT Analysis */}
      {swot_analysis && (
        <Section title="SWOT Analysis" icon={Award} color="bg-indigo-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {[{
              key: 'strengths', label: 'Strengths', icon: ShieldCheck,
              cls: 'bg-green-50 border-green-200', titleCls: 'text-green-700', dotCls: 'bg-green-400'
            }, {
              key: 'weaknesses', label: 'Weaknesses', icon: AlertTriangle,
              cls: 'bg-red-50 border-red-200', titleCls: 'text-red-700', dotCls: 'bg-red-400'
            }, {
              key: 'opportunities', label: 'Opportunities', icon: Lightbulb,
              cls: 'bg-blue-50 border-blue-200', titleCls: 'text-blue-700', dotCls: 'bg-blue-400'
            }, {
              key: 'threats', label: 'Threats', icon: Zap,
              cls: 'bg-orange-50 border-orange-200', titleCls: 'text-orange-700', dotCls: 'bg-orange-400'
            }].map(({ key, label, icon: Icon, cls, titleCls, dotCls }) => {
              const items = swot_analysis[key as keyof typeof swot_analysis] || [];
              return (
                <div key={key} className={`rounded-xl border p-4 ${cls}`}>
                  <div className={`flex items-center gap-2 mb-3 font-semibold text-sm ${titleCls}`}>
                    <Icon size={14} /> {label}
                  </div>
                  <ul className="space-y-1.5">
                    {items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dotCls}`} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Tech Stack */}
      {tech_stack && tech_stack.length > 0 && (
        <Section title="Tech Stack" icon={Code2} color="bg-cyan-500">
          <div className="space-y-4 mt-4">
            {tech_stack.map((stack, i) => (
              <div key={i}>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{stack.category}</div>
                <div className="flex flex-wrap gap-2">
                  {stack.technologies.map((tech, j) => (
                    <span key={j} className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg font-medium border border-surface-200">{tech}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Culture & Hiring */}
      {(culture_and_values || hiring_status || open_roles_summary) && (
        <Section title="Culture & Hiring" icon={Star} color="bg-pink-500">
          <div className="space-y-4 mt-4">
            {culture_and_values && (
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Culture & Values</div>
                <p className="text-sm text-gray-700">{culture_and_values}</p>
              </div>
            )}
            {hiring_status && (
              <div className="flex items-center gap-2">
                <Briefcase size={14} className="text-pink-500" />
                <span className="text-sm text-gray-700">{hiring_status}</span>
              </div>
            )}
            {open_roles_summary && (
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Open Roles</div>
                <p className="text-sm text-gray-700">{open_roles_summary}</p>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Sources */}
      {sources && sources.length > 0 && (
        <div className="bg-gray-50 rounded-xl border border-surface-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Link2 size={14} className="text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sources ({sources.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {sources.slice(0, 15).map((src, i) => (
              <a key={i} href={src} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800 hover:underline truncate max-w-xs">
                {src.replace(/^https?:\/\//, '').split('/')[0]}
              </a>
            ))}
          </div>
          {researched_at && (
            <div className="mt-3 text-xs text-gray-400 flex items-center gap-1">
              <Clock size={10} />
              Researched at {new Date(researched_at).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
