import { AnimatePresence, motion } from 'framer-motion';
import { Radar, ShieldCheck, Sparkles } from 'lucide-react';
import { Aurora } from './components/Aurora';
import { CompanyProfile } from './components/CompanyProfile';
import { ErrorState } from './components/ErrorState';
import { LoadingState } from './components/LoadingState';
import { SearchBar } from './components/SearchBar';
import { useHealth } from './hooks/useHealth';
import { useResearch } from './hooks/useResearch';
import { cn } from './lib/utils';
import type { DepthOption } from './types';

const STATUS_STYLES = {
  checking: { dot: 'bg-slate-500', text: 'text-slate-500', label: 'checking API' },
  online: { dot: 'bg-accent-lime', text: 'text-accent-lime', label: 'API online' },
  offline: { dot: 'bg-accent-rose', text: 'text-accent-rose', label: 'API offline' },
} as const;

function App() {
  const { data, loading, error, progress, phases, phaseIndex, elapsed, research, reset, cancel } =
    useResearch();
  const { status, health } = useHealth();

  const handleSearch = (query: string, depth: DepthOption) => {
    void research({ query, depth });
  };

  const showHero = !data && !loading && !error;
  const statusStyle = STATUS_STYLES[status];

  return (
    <div className="relative min-h-screen">
      <Aurora />

      {/* ---------------------------------------------------------- header */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-ink-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={reset}
            className="group flex items-center gap-2.5 text-left"
            aria-label="Reset search"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-accent-indigo to-accent-violet shadow-glow">
              <Radar className="h-4 w-4 text-white" />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-tight text-slate-100">
                Company Research
              </span>
              <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-600">
                Sourced intelligence
              </span>
            </span>
          </button>

          <div className="flex items-center gap-3">
            <span
              className={cn(
                'hidden items-center gap-1.5 rounded-full border border-white/[0.07] px-2.5 py-1 text-[11px] sm:inline-flex',
                statusStyle.text,
              )}
              title={
                health ? `provider: ${health.llm_provider} \u00b7 v${health.version}` : undefined
              }
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', statusStyle.dot)} />
              {statusStyle.label}
            </span>
            {health?.llm_provider && (
              <span className="hidden text-[11px] text-slate-600 md:inline">
                {health.llm_provider}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------ main */}
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6">
        <AnimatePresence mode="wait">
          {showHero && (
            <motion.div
              key="hero"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              className="mx-auto max-w-3xl pt-8 text-center"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] text-slate-400">
                <Sparkles className="h-3 w-3 text-accent-violet" />
                Live web research, not model memory
              </span>

              <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-6xl">
                <span className="text-gradient">Know any company</span>
                <br />
                <span className="text-slate-400">in under a minute</span>
              </h1>

              <p className="mx-auto mt-5 max-w-xl text-pretty text-sm leading-relaxed text-slate-400 sm:text-base">
                Enter a name or a domain. Every claim is grounded in a live search, every date comes
                from the source itself, and any link the agent cannot prove it retrieved is withheld
                rather than guessed.
              </p>

              <div className="mt-9 text-left">
                <SearchBar onSearch={handleSearch} loading={loading} />
              </div>

              <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
                {[
                  {
                    icon: ShieldCheck,
                    title: 'Verified links',
                    body: 'Each URL is checked against what the search actually returned.',
                  },
                  {
                    icon: Radar,
                    title: 'Real dates',
                    body: 'Publication dates come from the index, not from the model.',
                  },
                  {
                    icon: Sparkles,
                    title: 'Honest gaps',
                    body: 'Unsupported claims are flagged instead of quietly invented.',
                  },
                ].map((f) => (
                  <div
                    key={f.title}
                    className="glass rounded-xl p-4 transition-colors hover:border-white/[0.12]"
                  >
                    <f.icon className="h-4 w-4 text-accent-cyan" />
                    <p className="mt-2 text-sm font-medium text-slate-200">{f.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{f.body}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {!showHero && (
            <motion.div
              key="searchbar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mx-auto mb-8 max-w-4xl"
            >
              <SearchBar onSearch={handleSearch} loading={loading} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {loading && (
            <LoadingState
              key="loading"
              progress={progress}
              query={data?.query ?? ''}
              phases={phases}
              phaseIndex={phaseIndex}
              elapsed={elapsed}
              onCancel={cancel}
            />
          )}

          {!loading && error && <ErrorState key="error" error={error} onRetry={reset} />}

          {!loading && !error && data?.result && (
            <CompanyProfile
              key="result"
              result={data.result}
              query={data.query}
              duration={data.duration_seconds}
              cached={data.cached}
            />
          )}
        </AnimatePresence>
      </main>

      {/* ---------------------------------------------------------- footer */}
      <footer className="border-t border-white/[0.06] py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-1 px-4 text-center sm:px-6">
          <p className="text-[11px] text-slate-600">
            FastAPI + LangGraph ReAct agent · Tavily retrieval · React + Vite
          </p>
          <p className="text-[11px] text-slate-700">
            Results are grounded in live search and may still be incomplete. Verify anything critical.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
