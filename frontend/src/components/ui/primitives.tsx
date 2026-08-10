import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { cn, normalizeHref } from '../../lib/utils';

/* ------------------------------------------------------------------ links */

/**
 * The single most important component in this redesign.
 *
 * v1 rendered `<a href={src}>` directly. When the model returned
 * `www.notion.so` with no scheme, the browser treated it as a relative path
 * and the link silently 404'd inside the SPA — which is what “the links are
 * not even showing up” actually meant. This component refuses to emit an
 * anchor unless the href survives normalisation, so a bad value degrades to
 * plain text instead of a trap.
 */
export function LinkOut({
  href,
  children,
  className,
  icon = true,
  title,
}: {
  href?: string | null;
  children: ReactNode;
  className?: string;
  icon?: boolean;
  title?: string;
}) {
  const safe = normalizeHref(href);

  if (!safe) {
    return (
      <span className={cn('text-slate-500', className)} title="No verified link available">
        {children}
      </span>
    );
  }

  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      title={title ?? safe}
      className={cn(
        'group/link inline-flex items-center gap-1 text-accent-indigo transition-colors hover:text-accent-cyan',
        className,
      )}
    >
      <span className="underline-offset-4 group-hover/link:underline">{children}</span>
      {icon && <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />}
    </a>
  );
}

/* ------------------------------------------------------------------ cards */

export function Card({
  children,
  className,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        'glass rounded-2xl',
        hover &&
          'transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-white/[0.05] hover:shadow-lift',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionCard({
  title,
  icon,
  count,
  actions,
  children,
  className,
}: {
  title: string;
  icon?: ReactNode;
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-accent-violet">{icon}</span>}
          <h3 className="text-sm font-semibold tracking-wide text-slate-100">{title}</h3>
          {typeof count === 'number' && count > 0 && (
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-slate-400">
              {count}
            </span>
          )}
        </div>
        {actions}
      </div>
      <div className="hairline mx-5 mt-4 h-px" />
      <div className="p-5">{children}</div>
    </Card>
  );
}

/* ----------------------------------------------------------------- badges */

type Tone = 'neutral' | 'violet' | 'cyan' | 'lime' | 'amber' | 'rose';

const TONES: Record<Tone, string> = {
  neutral: 'bg-white/[0.06] text-slate-300 ring-white/[0.08]',
  violet: 'bg-accent-violet/10 text-accent-violet ring-accent-violet/25',
  cyan: 'bg-accent-cyan/10 text-accent-cyan ring-accent-cyan/25',
  lime: 'bg-accent-lime/10 text-accent-lime ring-accent-lime/25',
  amber: 'bg-accent-amber/10 text-accent-amber ring-accent-amber/25',
  rose: 'bg-accent-rose/10 text-accent-rose ring-accent-rose/25',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
  icon,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ misc */

export function Field({ label, value }: { label: string; value?: ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-1 truncate text-sm text-slate-200">{value}</dd>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="text-sm italic text-slate-500">{children}</p>;
}
