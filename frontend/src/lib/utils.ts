import { clsx, type ClassValue } from 'clsx';

/** Tailwind-friendly conditional class joiner. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

const NULLISH = new Set(['', '-', 'n/a', 'na', 'none', 'null', 'unknown', 'tbd']);

/**
 * Second line of defence for links.
 *
 * The backend already canonicalises every URL it returns, but the UI must never
 * emit `<a href="www.notion.so">` — a browser reads that as a *relative* path and
 * navigates to `localhost:5173/www.notion.so`. That single missing scheme is what
 * made every source link look broken. Returning `null` lets callers render plain
 * text instead of a dead link.
 */
export function normalizeHref(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const raw = url.trim().replace(/^[<(["']+/, '').replace(/[>)\]"'.,;:]+$/, '');
  if (!raw || NULLISH.has(raw.toLowerCase())) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  // Any other scheme (mailto:, tel:, javascript:, data:) is not a web page.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  if (!raw.includes('.') || raw.includes(' ')) return null;
  return `https://${raw}`;
}

/** Bare hostname for display, or null when the value is not a usable link. */
export function hostOf(url?: string | null): string | null {
  const href = normalizeHref(url);
  if (!href) return null;
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Readable label for a source chip: host + trimmed first path segment. */
export function sourceLabel(url?: string | null): string | null {
  const href = normalizeHref(url);
  if (!href) return null;
  try {
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, '');
    const seg = u.pathname.split('/').filter(Boolean)[0];
    if (!seg || seg.length > 24) return host;
    return `${host}/${seg}`;
  } catch {
    return hostOf(url);
  }
}

export function faviconUrl(url?: string | null, size = 64): string | null {
  const host = hostOf(url);
  return host ? `https://www.google.com/s2/favicons?domain=${host}&sz=${size}` : null;
}

function toDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value?: string | null): string | null {
  const d = toDate(value);
  if (!d) return null;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function relativeTime(value?: string | null): string | null {
  const d = toDate(value);
  if (!d) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 0) return 'upcoming';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  const years = days / 365;
  return `${years < 10 ? years.toFixed(1) : Math.round(years)}y ago`;
}

/** Rough staleness bucket used to colour date chips. */
export function ageTone(value?: string | null): 'fresh' | 'recent' | 'stale' | 'unknown' {
  const d = toDate(value);
  if (!d) return 'unknown';
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 90) return 'fresh';
  if (days <= 730) return 'recent';
  return 'stale';
}

export function initials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Deterministic accent per string so avatars/chips stay stable across renders. */
export function hashHue(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

export function isNonEmpty<T>(value: T[] | undefined | null): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

export function hasText(value?: string | null): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !NULLISH.has(value.trim().toLowerCase());
}
