import { motion } from 'framer-motion';
import { Check, Loader2, Search, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { Card, Skeleton } from './ui/primitives';
import type { ResearchPhase } from '../hooks/useResearch';

interface Props {
  progress: string;
  query: string;
  phases?: ResearchPhase[];
  phaseIndex?: number;
  elapsed?: number;
  onCancel?: () => void;
}

export function LoadingState({ progress, query, phases, phaseIndex = 0, elapsed = 0, onCancel }: Props) {
  const steps = phases ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-5xl"
    >
      <Card className="overflow-hidden">
        {/* Indeterminate sweep: honest about not knowing the real percentage. */}
        <div className="relative h-0.5 w-full overflow-hidden bg-white/[0.05]">
          <div className="animate-sweep absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-accent-violet to-transparent" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-violet/10 ring-1 ring-inset ring-accent-violet/25">
              <Search className="h-4 w-4 text-accent-violet" />
              <span className="absolute inset-0 animate-ping rounded-xl bg-accent-violet/10" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">
                Researching <span className="text-accent-cyan">{query}</span>
              </p>
              <p className="truncate text-xs text-slate-500">{progress || 'Working…'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xs tabular-nums text-slate-500">
              {String(Math.floor(elapsed / 60)).padStart(2, '0')}:
              {String(elapsed % 60).padStart(2, '0')}
            </span>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:border-white/20 hover:text-slate-100"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            )}
          </div>
        </div>

        {steps.length > 0 && (
          <ol className="mt-5 space-y-1 px-6">
            {steps.map((step, i) => {
              const done = i < phaseIndex;
              const active = i === phaseIndex;
              return (
                <li
                  key={step.label}
                  className={cn(
                    'flex items-start gap-3 rounded-lg px-2 py-1.5 transition-colors',
                    active && 'bg-white/[0.04]',
                  )}
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                    {done ? (
                      <Check className="h-3.5 w-3.5 text-accent-lime" />
                    ) : active ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-cyan" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'block text-xs font-medium',
                        done && 'text-slate-500',
                        active && 'text-slate-100',
                        !done && !active && 'text-slate-600',
                      )}
                    >
                      {step.label}
                    </span>
                    {active && <span className="block text-[11px] text-slate-500">{step.hint}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        <div className="hairline mx-6 mt-5 h-px" />

        {/* Skeleton preview of the report shape, so the wait feels purposeful. */}
        <div className="grid gap-4 p-6 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-2">
            <Skeleton className="h-6 w-2/5" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      </Card>

      <p className="mt-3 text-center text-xs text-slate-600">
        Every fact is pulled from a live web search, then each link is verified against what was
        actually retrieved.
      </p>
    </motion.div>
  );
}
