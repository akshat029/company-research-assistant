import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Boxes,
  Building2,
  Calendar,
  Check,
  Clock,
  Copy,
  Cpu,
  Database,
  Github,
  Globe,
  Instagram,
  Landmark,
  Lightbulb,
  Linkedin,
  MapPin,
  Newspaper,
  ShieldAlert,
  ShieldCheck,
  Swords,
  Target,
  TrendingUp,
  Twitter,
  Users,
  Wallet,
  Youtube,
} from 'lucide-react';
import {
  ageTone,
  cn,
  faviconUrl,
  formatDate,
  hasText,
  hashHue,
  hostOf,
  initials,
  isNonEmpty,
  normalizeHref,
  relativeTime,
  sourceLabel,
} from '../lib/utils';
import { Badge, Card, EmptyHint, Field, LinkOut, SectionCard } from './ui/primitives';
import type { CompanyResearchResult, NewsItem, SocialMedia, SourceRef } from '../types';

interface Props {
  result: CompanyResearchResult;
  query: string;
  duration?: number;
  cached?: boolean;
}

const CONFIDENCE = {
  high: { pct: 1, tone: 'text-accent-lime', stroke: '#A3E635', label: 'High confidence' },
  medium: { pct: 0.62, tone: 'text-accent-amber', stroke: '#FBBF24', label: 'Medium confidence' },
  low: { pct: 0.28, tone: 'text-accent-rose', stroke: '#FB7185', label: 'Low confidence' },
} as const;

function ConfidenceRing({ level }: { level: 'high' | 'medium' | 'low' }) {
  const conf = CONFIDENCE[level];
  const r = 22;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
      <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <motion.circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={conf.stroke}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - conf.pct) }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <span className={cn('absolute text-[10px] font-bold uppercase', conf.tone)}>{level}</span>
    </div>
  );
}

const SOCIALS: Array<{ key: keyof SocialMedia; icon: typeof Globe; label: string }> = [
  { key: 'linkedin', icon: Linkedin, label: 'LinkedIn' },
  { key: 'twitter', icon: Twitter, label: 'X' },
  { key: 'github', icon: Github, label: 'GitHub' },
  { key: 'youtube', icon: Youtube, label: 'YouTube' },
  { key: 'instagram', icon: Instagram, label: 'Instagram' },
];

/** News card. The verified flag comes from the server, never from the model. */
function NewsCard({ item }: { item: NewsItem }) {
  const href = normalizeHref(item.url);
  const tone = ageTone(item.date);
  const rel = relativeTime(item.date);
  const host = hostOf(item.url) ?? item.source;

  return (
    <li className="group relative rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]">
      <div className="flex items-start justify-between gap-3">
        <h4 className="min-w-0 text-sm font-medium leading-snug text-slate-100">
          {href ? (
            <LinkOut href={href} className="text-slate-100 hover:text-accent-cyan" icon={false}>
              {item.title}
            </LinkOut>
          ) : (
            item.title
          )}
        </h4>
        {item.verified === false ? (
          <Badge tone="amber" icon={<ShieldAlert className="h-3 w-3" />} className="shrink-0">
            Unverified
          </Badge>
        ) : item.verified ? (
          <Badge tone="lime" icon={<ShieldCheck className="h-3 w-3" />} className="shrink-0">
            Verified
          </Badge>
        ) : null}
      </div>

      {hasText(item.summary) && (
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.summary}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
        {rel && (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 ring-1 ring-inset',
              tone === 'fresh' && 'bg-accent-lime/10 text-accent-lime ring-accent-lime/20',
              tone === 'recent' && 'bg-white/[0.05] text-slate-400 ring-white/10',
              tone === 'stale' && 'bg-accent-amber/10 text-accent-amber ring-accent-amber/20',
            )}
          >
            <Calendar className="h-3 w-3" />
            {formatDate(item.date)} · {rel}
          </span>
        )}
        {host && <span className="text-slate-500">{host}</span>}
        {item.verified === false && (
          <span className="text-slate-600">no retrieved source — link withheld</span>
        )}
      </div>
    </li>
  );
}

export function CompanyProfile({ result, query, duration, cached }: Props) {
  const [tab, setTab] = useState('overview');
  const [copied, setCopied] = useState(false);

  const info = result.basic_info ?? {};
  const level = (result.research_confidence ?? 'low') as 'high' | 'medium' | 'low';
  const swot = result.swot_analysis;
  const hue = hashHue(info.name ?? query);

  // Annotated so both branches collapse to one type. Without this the union
  // makes `s.title` infer as `unknown` and `tsc && vite build` fails.
  const sources = useMemo<SourceRef[]>(() => {
    if (isNonEmpty(result.source_details)) return result.source_details;
    return (result.sources ?? []).map((url) => ({ url }));
  }, [result.source_details, result.sources]);

  const unverifiedCount = (result.recent_news ?? []).filter((n) => n.verified === false).length;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Building2 },
    { id: 'products', label: 'Products', icon: Boxes, count: result.products_and_services?.length },
    { id: 'people', label: 'People', icon: Users, count: result.leadership?.length },
    { id: 'news', label: 'News', icon: Newspaper, count: result.recent_news?.length },
    { id: 'market', label: 'Market', icon: TrendingUp, count: result.competitors?.length },
    { id: 'sources', label: 'Sources', icon: Database, count: sources.length },
  ].filter((t) => t.count === undefined || t.count > 0 || t.id === 'overview');

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto w-full max-w-6xl space-y-5"
    >
      {/* ------------------------------------------------------------ hero */}
      <Card className="relative overflow-hidden">
        <div
          className="absolute inset-x-0 top-0 h-28 opacity-25"
          style={{
            background: `radial-gradient(60% 120% at 20% 0%, hsl(${hue} 85% 60% / 0.55), transparent 70%)`,
          }}
        />

        <div className="relative p-6">
          <div className="flex flex-wrap items-start gap-5">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white ring-1 ring-inset ring-white/15"
              style={{ background: `linear-gradient(140deg, hsl(${hue} 70% 45%), hsl(${hue + 45} 70% 32%))` }}
            >
              {initials(info.name ?? query)}
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
                {info.name ?? query}
              </h1>
              {hasText(info.tagline) && (
                <p className="mt-1 text-sm text-accent-cyan">{info.tagline}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {hasText(info.website) && (
                  <LinkOut href={info.website}>
                    <span className="inline-flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5" />
                      {hostOf(info.website)}
                    </span>
                  </LinkOut>
                )}
                {hasText(info.industry) && <Badge tone="violet">{info.industry}</Badge>}
                {hasText(info.company_type) && <Badge>{info.company_type}</Badge>}
                {hasText(info.stock_ticker) && <Badge tone="lime">{info.stock_ticker}</Badge>}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <ConfidenceRing level={level} />
              <button
                type="button"
                onClick={copyJson}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:border-white/20 hover:text-slate-100"
              >
                {copied ? <Check className="h-3 w-3 text-accent-lime" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'JSON'}
              </button>
            </div>
          </div>

          {hasText(info.description) && (
            <p className="mt-5 max-w-3xl text-pretty text-sm leading-relaxed text-slate-300">
              {info.description}
            </p>
          )}

          <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Founded" value={info.founded} />
            <Field
              label="Headquarters"
              value={
                hasText(info.headquarters) ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-slate-500" />
                    {info.headquarters}
                  </span>
                ) : undefined
              }
            />
            <Field label="Size" value={info.company_size} />
            <Field label="Sources" value={sources.length ? `${sources.length} retrieved` : undefined} />
          </dl>
        </div>

        {/* --------------------------------------------------- provenance bar */}
        <div className="hairline mx-6 h-px" />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Activity className="h-3 w-3" />
            {CONFIDENCE[level].label}
          </span>
          {hasText(result.data_freshness) && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              Freshest source {result.data_freshness}
            </span>
          )}
          {result.researched_at && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              Run {relativeTime(result.researched_at)}
            </span>
          )}
          {typeof duration === 'number' && <span>{duration.toFixed(1)}s</span>}
          {cached && <Badge tone="cyan">cached</Badge>}
          {unverifiedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-accent-amber">
              <AlertTriangle className="h-3 w-3" />
              {unverifiedCount} claim{unverifiedCount > 1 ? 's' : ''} could not be linked to a source
            </span>
          )}
        </div>
      </Card>

      {hasText(result.ai_summary) && (
        <Card className="border-accent-violet/20 bg-accent-violet/[0.04] p-5">
          <div className="flex items-start gap-3">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent-violet" />
            <p className="text-pretty text-sm leading-relaxed text-slate-200">{result.ai_summary}</p>
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------------ tabs */}
      <div className="sticky top-2 z-20">
        <div className="glass-strong flex gap-1 overflow-x-auto rounded-xl p-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'relative inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                  active ? 'text-white' : 'text-slate-400 hover:text-slate-200',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-lg bg-white/[0.09] ring-1 ring-inset ring-white/10"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className="relative h-3.5 w-3.5" />
                <span className="relative">{t.label}</span>
                {typeof t.count === 'number' && t.count > 0 && (
                  <span className="relative text-[10px] text-slate-500">{t.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
          className="grid gap-5 lg:grid-cols-2"
        >
          {/* ------------------------------------------------------ overview */}
          {tab === 'overview' && (
            <>
              <SectionCard title="Market position" icon={<Target className="h-4 w-4" />}>
                {hasText(result.market_position) ? (
                  <p className="text-sm leading-relaxed text-slate-300">{result.market_position}</p>
                ) : (
                  <EmptyHint>No sourced positioning statement was found.</EmptyHint>
                )}
                {hasText(result.target_market) && (
                  <>
                    <div className="hairline my-4 h-px" />
                    <p className="text-[11px] uppercase tracking-wider text-slate-500">Target market</p>
                    <p className="mt-1 text-sm text-slate-300">{result.target_market}</p>
                  </>
                )}
              </SectionCard>

              <SectionCard title="Culture and hiring" icon={<Users className="h-4 w-4" />}>
                {hasText(result.culture_and_values) ? (
                  <p className="text-sm leading-relaxed text-slate-300">{result.culture_and_values}</p>
                ) : (
                  <EmptyHint>No sourced culture information was found.</EmptyHint>
                )}
                {hasText(result.hiring_status) && (
                  <div className="mt-3">
                    <Badge tone="lime">{result.hiring_status}</Badge>
                  </div>
                )}
                {hasText(result.open_roles_summary) && (
                  <p className="mt-3 text-sm text-slate-400">{result.open_roles_summary}</p>
                )}
              </SectionCard>

              {swot && (
                <div className="lg:col-span-2">
                  <SectionCard title="SWOT" icon={<Swords className="h-4 w-4" />}>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {(
                        [
                          ['Strengths', swot.strengths, 'lime'],
                          ['Weaknesses', swot.weaknesses, 'rose'],
                          ['Opportunities', swot.opportunities, 'cyan'],
                          ['Threats', swot.threats, 'amber'],
                        ] as const
                      ).map(([label, items, tone]) =>
                        isNonEmpty(items) ? (
                          <div key={label}>
                            <Badge tone={tone}>{label}</Badge>
                            <ul className="mt-2 space-y-1.5">
                              {items.map((s) => (
                                <li key={s} className="text-xs leading-relaxed text-slate-400">
                                  • {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null,
                      )}
                    </div>
                  </SectionCard>
                </div>
              )}

              {isNonEmpty(SOCIALS.filter((s) => hasText(result.social_media?.[s.key]))) && (
                <div className="lg:col-span-2">
                  <SectionCard title="Official channels" icon={<Globe className="h-4 w-4" />}>
                    <div className="flex flex-wrap gap-2">
                      {SOCIALS.map(({ key, icon: Icon, label }) => {
                        const value = result.social_media?.[key];
                        if (!hasText(value)) return null;
                        return (
                          <LinkOut
                            key={key}
                            href={value}
                            icon={false}
                            className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-xs hover:border-white/20"
                          >
                            <span className="inline-flex items-center gap-2">
                              <Icon className="h-3.5 w-3.5" />
                              {label}
                            </span>
                          </LinkOut>
                        );
                      })}
                    </div>
                  </SectionCard>
                </div>
              )}
            </>
          )}

          {/* ------------------------------------------------------ products */}
          {tab === 'products' && (
            <>
              <SectionCard
                title="Products and services"
                icon={<Boxes className="h-4 w-4" />}
                count={result.products_and_services?.length}
                className="lg:col-span-2"
              >
                {isNonEmpty(result.products_and_services) ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {result.products_and_services.map((p) => (
                      <div
                        key={p.name}
                        className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 transition-colors hover:border-white/[0.12]"
                      >
                        <p className="text-sm font-medium text-slate-100">{p.name}</p>
                        {hasText(p.category) && (
                          <span className="mt-1 inline-block text-[11px] text-accent-violet">
                            {p.category}
                          </span>
                        )}
                        {hasText(p.description) && (
                          <p className="mt-2 text-xs leading-relaxed text-slate-400">{p.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyHint>No products were confirmed by the retrieved sources.</EmptyHint>
                )}
              </SectionCard>

              {isNonEmpty(result.tech_stack) && (
                <div className="lg:col-span-2">
                  <SectionCard title="Tech stack" icon={<Cpu className="h-4 w-4" />}>
                    <div className="space-y-3">
                      {result.tech_stack.map((t) => (
                        <div key={t.category}>
                          <p className="text-[11px] uppercase tracking-wider text-slate-500">
                            {t.category}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {t.technologies.map((tech) => (
                              <Badge key={tech}>{tech}</Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                </div>
              )}
            </>
          )}

          {/* -------------------------------------------------------- people */}
          {tab === 'people' && (
            <div className="lg:col-span-2">
              <SectionCard
                title="Leadership"
                icon={<Users className="h-4 w-4" />}
                count={result.leadership?.length}
              >
                {isNonEmpty(result.leadership) ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {result.leadership.map((person) => (
                      <div
                        key={`${person.name}-${person.title}`}
                        className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4"
                      >
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{
                            background: `linear-gradient(140deg, hsl(${hashHue(person.name)} 65% 45%), hsl(${
                              hashHue(person.name) + 40
                            } 65% 30%))`,
                          }}
                        >
                          {initials(person.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-100">{person.name}</p>
                          <p className="truncate text-xs text-slate-400">{person.title}</p>
                          {hasText(person.bio) && (
                            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{person.bio}</p>
                          )}
                          {hasText(person.linkedin_url) && (
                            <LinkOut href={person.linkedin_url} className="mt-1.5 text-xs" icon={false}>
                              <span className="inline-flex items-center gap-1">
                                <Linkedin className="h-3 w-3" />
                                Profile
                              </span>
                            </LinkOut>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyHint>No named executives were confirmed by the retrieved sources.</EmptyHint>
                )}
              </SectionCard>
            </div>
          )}

          {/* ---------------------------------------------------------- news */}
          {tab === 'news' && (
            <div className="lg:col-span-2">
              <SectionCard
                title="Recent news"
                icon={<Newspaper className="h-4 w-4" />}
                count={result.recent_news?.length}
                actions={
                  <span className="text-[11px] text-slate-500">Verified against retrieved sources</span>
                }
              >
                {isNonEmpty(result.recent_news) ? (
                  <ul className="space-y-3">
                    {result.recent_news.map((item) => (
                      <NewsCard key={`${item.title}-${item.date ?? ''}`} item={item} />
                    ))}
                  </ul>
                ) : (
                  <EmptyHint>No recent news was found in the recency window.</EmptyHint>
                )}
              </SectionCard>
            </div>
          )}

          {/* -------------------------------------------------------- market */}
          {tab === 'market' && (
            <>
              <SectionCard
                title="Competitors"
                icon={<Swords className="h-4 w-4" />}
                count={result.competitors?.length}
              >
                {isNonEmpty(result.competitors) ? (
                  <ul className="space-y-2">
                    {result.competitors.map((c) => {
                      const favicon = faviconUrl(c.website);
                      return (
                        <li
                          key={c.name}
                          className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.015] p-3"
                        >
                          {favicon ? (
                            <img
                              src={favicon}
                              alt=""
                              width={16}
                              height={16}
                              loading="lazy"
                              className="mt-0.5 h-4 w-4 shrink-0 rounded-sm"
                            />
                          ) : (
                            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-100">{c.name}</p>
                            {hasText(c.description) && (
                              <p className="text-xs text-slate-500">{c.description}</p>
                            )}
                            {hasText(c.website) && (
                              <LinkOut href={c.website} className="text-xs">
                                {hostOf(c.website)}
                              </LinkOut>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyHint>No competitors were confirmed by the retrieved sources.</EmptyHint>
                )}
              </SectionCard>

              <SectionCard title="Funding and financials" icon={<Wallet className="h-4 w-4" />}>
                {result.financial_info ? (
                  <>
                    <dl className="grid grid-cols-2 gap-4">
                      <Field label="Total funding" value={result.financial_info.total_funding} />
                      <Field label="Valuation" value={result.financial_info.last_valuation} />
                      <Field label="Revenue" value={result.financial_info.revenue} />
                      <Field label="IPO status" value={result.financial_info.ipo_status} />
                    </dl>

                    {isNonEmpty(result.financial_info.funding_rounds) && (
                      <>
                        <div className="hairline my-4 h-px" />
                        <ol className="space-y-2">
                          {result.financial_info.funding_rounds.map((round, i) => (
                            <li
                              key={`${round.round_type ?? 'round'}-${i}`}
                              className="flex items-center justify-between gap-3 text-sm"
                            >
                              <span className="inline-flex items-center gap-2 text-slate-300">
                                <Landmark className="h-3.5 w-3.5 text-slate-600" />
                                {round.round_type ?? 'Round'}
                              </span>
                              <span className="text-slate-400">{round.amount}</span>
                              <span className="text-xs text-slate-600">{round.date}</span>
                            </li>
                          ))}
                        </ol>
                      </>
                    )}

                    {isNonEmpty(result.financial_info.investors) && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {result.financial_info.investors.map((inv) => (
                          <Badge key={inv}>{inv}</Badge>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyHint>No financial data was confirmed by the retrieved sources.</EmptyHint>
                )}
              </SectionCard>
            </>
          )}

          {/* ------------------------------------------------------- sources */}
          {tab === 'sources' && (
            <div className="lg:col-span-2">
              <SectionCard
                title="Retrieved sources"
                icon={<Database className="h-4 w-4" />}
                count={sources.length}
                actions={
                  <span className="text-[11px] text-slate-500">
                    Every link below was actually returned by a search
                  </span>
                }
              >
                {sources.length > 0 ? (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {sources.map((s) => {
                      const favicon = faviconUrl(s.url);
                      const published = s.published_date;
                      return (
                        <li
                          key={s.url}
                          className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.015] p-3 transition-colors hover:border-white/[0.12]"
                        >
                          {favicon ? (
                            <img
                              src={favicon}
                              alt=""
                              width={16}
                              height={16}
                              loading="lazy"
                              className="mt-0.5 h-4 w-4 shrink-0 rounded-sm"
                            />
                          ) : (
                            <Globe className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                          )}
                          <div className="min-w-0">
                            <LinkOut href={s.url} className="text-xs" icon={false}>
                              {hasText(s.title) ? s.title : sourceLabel(s.url)}
                            </LinkOut>
                            <p className="mt-0.5 truncate text-[11px] text-slate-600">
                              {hostOf(s.url)}
                              {published ? ` · ${formatDate(published)}` : ''}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyHint>No sources were recorded for this run.</EmptyHint>
                )}
              </SectionCard>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
