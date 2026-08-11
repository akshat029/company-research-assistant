import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Command,
  Gauge,
  Lightbulb,
  Loader2,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { DepthOption } from '../types';

interface Props {
  onSearch: (query: string, depth: DepthOption, includeAnalysis: boolean) => void;
  loading: boolean;
}

const DEPTHS: Array<{
  id: DepthOption;
  label: string;
  blurb: string;
  time: string;
  icon: typeof Zap;
}> = [
  { id: 'quick', label: 'Quick', blurb: '5 searches', time: '~20s', icon: Zap },
  { id: 'standard', label: 'Standard', blurb: '10 searches', time: '~40s', icon: Gauge },
  { id: 'deep', label: 'Deep', blurb: '17 searches', time: '~80s', icon: Sparkles },
];

const EXAMPLES = ['Stripe', 'notion.so', 'Anthropic', 'Figma', 'Vercel'];

export function SearchBar({ onSearch, loading }: Props) {
  const [query, setQuery] = useState('');
  const [depth, setDepth] = useState<DepthOption>('standard');
  // On by default: the analyst read is the point of the tool. It is a toggle
  // rather than always-on because it costs an extra model call, which matters
  // on a free tier with a per-minute token budget.
  const [analysis, setAnalysis] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl+K focuses the field, the way every modern tool behaves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = (e?: { preventDefault: () => void }) => {
    e?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || loading) return;
    onSearch(trimmed, depth, analysis);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full"
    >
      <form onSubmit={submit}>
        <div className="ring-conic glass-strong relative rounded-2xl shadow-glow">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <Search className="h-5 w-5 shrink-0 text-slate-500" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
              placeholder="Company name or website — e.g. Stripe or notion.so"
              aria-label="Company name or website"
              className="min-w-0 flex-1 bg-transparent text-base text-slate-100 placeholder:text-slate-600 focus:outline-none disabled:opacity-60"
            />
            <kbd className="hidden items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-1 text-[10px] text-slate-500 sm:flex">
              <Command className="h-3 w-3" />K
            </kbd>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all',
                'bg-gradient-to-r from-accent-indigo to-accent-violet text-white',
                'hover:shadow-glow-lg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none',
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">Researching</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Research</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Research depth"
        >
          {DEPTHS.map((d) => {
            const Icon = d.icon;
            const active = depth === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setDepth(d.id)}
                disabled={loading}
                aria-pressed={active}
                title={`${d.blurb} · ${d.time}`}
                className={cn(
                  'group relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all disabled:opacity-50',
                  active
                    ? 'bg-white/[0.09] text-white ring-1 ring-inset ring-white/15'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200',
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', active && 'text-accent-cyan')} />
                {d.label}
                <span className="text-[10px] text-slate-500">{d.time}</span>
              </button>
            );
          })}

          <span className="mx-1 hidden h-4 w-px bg-white/10 sm:block" />

          <button
            type="button"
            onClick={() => setAnalysis((v) => !v)}
            disabled={loading}
            aria-pressed={analysis}
            title="Adds a consultant-style read on top of the facts: thesis, competitive position, ranked risks and non-obvious signals. Costs one extra model call."
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all disabled:opacity-50',
              analysis
                ? 'bg-accent-violet/[0.14] text-accent-violet ring-1 ring-inset ring-accent-violet/30'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200',
            )}
          >
            <Lightbulb className="h-3.5 w-3.5" />
            Analysis
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full transition-colors',
                analysis ? 'bg-accent-violet' : 'bg-slate-600',
              )}
            />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wider text-slate-600">Try</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={loading}
              onClick={() => {
                setQuery(ex);
                onSearch(ex, depth, analysis);
              }}
              className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-xs text-slate-400 transition-colors hover:border-white/15 hover:text-slate-100 disabled:opacity-50"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
