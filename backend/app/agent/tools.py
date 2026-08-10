"""Deterministic helpers for the research agent.

Nothing in this module talks to an LLM. URL hygiene, source tracking, search
result formatting and query planning are all plain Python, which is deliberate:
every accuracy bug this module fixes was caused by letting the model produce
data the server could have produced itself.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


# ─── URL hygiene ──────────────────────────────────────────────────────────────

_TRACKING_PREFIXES = ("utm_", "mc_", "pk_", "hsa_")
_TRACKING_KEYS = {
    "fbclid", "gclid", "igshid", "mkt_tok", "ref", "ref_src", "referrer",
    "spm", "cmpid", "cmp", "scid", "s_kwcid",
}
_PLACEHOLDER_HOSTS = {
    "example.com", "example.org", "example.net", "company.com", "website.com",
    "domain.com", "yourcompany.com", "acme.com", "test.com",
}
_NULLISH = {"", "-", "n/a", "na", "none", "null", "unknown", "not available", "tbd"}
# Schemes that can never be a research source. javascript: and data: matter
# beyond correctness: these strings are rendered straight into href attributes.
_NON_WEB_SCHEMES = (
    "mailto:", "tel:", "sms:", "callto:", "skype:", "whatsapp:",
    "javascript:", "data:", "file:", "blob:", "about:",
)
# Models routinely emit bare filenames where a URL belongs ("logo.png").
# "logo.png" parses as a perfectly valid hostname, so the TLD has to be checked.
_FILE_TLDS = {
    "png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp", "pdf", "html",
    "htm", "css", "js", "json", "xml", "txt", "csv", "md", "doc", "docx",
    "xls", "xlsx", "ppt", "pptx", "mp3", "mp4", "webm", "woff", "woff2",
}


_WRAP_OPEN = "<([{\"'"


def _unwrap(raw: str) -> str:
    """Peel markdown/bracket wrappers and sentence punctuation off a URL.

    A trailing ``)`` is kept when it balances an opening ``(`` so that links
    like ``en.wikipedia.org/wiki/Notion_(app)`` survive intact.
    """
    changed = True
    while changed and raw:
        changed = False
        if raw[0] in _WRAP_OPEN:
            raw = raw[1:].strip()
            changed = True
        trimmed = raw.rstrip(".,;:!?")
        if trimmed != raw:
            raw = trimmed
            changed = True
        if raw.endswith((">", "]", "}", '"', "'")):
            raw = raw[:-1].strip()
            changed = True
        elif raw.endswith(")") and raw.count("(") < raw.count(")"):
            raw = raw[:-1].strip()
            changed = True
    return raw


def canonicalize_url(url: Optional[str]) -> Optional[str]:
    """Return an absolute, de-tracked URL, or None when it is not usable.

    The UI renders ``<a href={url}>``. A value like ``www.notion.so`` has no
    scheme, so the browser treats it as a *relative* path and navigates to
    ``http://localhost:5173/www.notion.so`` — that is the "links don't work"
    bug. Forcing an absolute scheme here fixes it at the source rather than
    patching every render site.
    """
    if not url or not isinstance(url, str):
        return None

    # Models like to wrap URLs in markdown/brackets/quotes and trail punctuation.
    raw = _unwrap(url.strip())
    if raw.lower() in _NULLISH:
        return None

    if raw.startswith("//"):
        raw = "https:" + raw
    if raw.lower().startswith(_NON_WEB_SCHEMES):
        return None
    if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.\-]*://", raw):
        raw = "https://" + raw

    try:
        parsed = urlparse(raw)
    except ValueError:
        return None

    if parsed.scheme not in ("http", "https"):
        return None

    # Reject embedded credentials: "https://notion.so@evil.com" renders as a
    # trustworthy-looking link that navigates somewhere else entirely.
    if "@" in parsed.netloc:
        return None

    host = (parsed.hostname or "").lower()
    if not host or "." not in host or host.endswith("."):
        return None
    if host.rsplit(".", 1)[-1] in _FILE_TLDS:
        return None
    bare_host = host[4:] if host.startswith("www.") else host
    if host in _PLACEHOLDER_HOSTS or bare_host in _PLACEHOLDER_HOSTS:
        return None
    # Reject obvious non-domains such as "3.5" or "v1.2".
    if not re.match(r"^[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9\-]+)*\.[a-z]{2,}$", host):
        return None

    netloc = parsed.netloc.lower()
    pairs = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if not k.lower().startswith(_TRACKING_PREFIXES) and k.lower() not in _TRACKING_KEYS
    ]
    query = urlencode(pairs)

    path = parsed.path or "/"
    if len(path) > 1 and path.endswith("/"):
        path = path.rstrip("/")

    return urlunparse((parsed.scheme, netloc, path, "", query, ""))


def url_key(url: Optional[str]) -> Optional[str]:
    """Scheme/www-insensitive identity for a URL, used for dedup and lookup."""
    canonical = canonicalize_url(url)
    if not canonical:
        return None
    parsed = urlparse(canonical)
    host = (parsed.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    path = (parsed.path or "/").rstrip("/") or "/"
    return f"{host}{path}?{parsed.query}" if parsed.query else f"{host}{path}"


def domain_of(url: Optional[str]) -> Optional[str]:
    canonical = canonicalize_url(url)
    if not canonical:
        return None
    host = (urlparse(canonical).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


# ─── Date helpers ─────────────────────────────────────────────────────────────

_DATE_FORMATS = (
    "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%a, %d %b %Y %H:%M:%S %Z",
    "%a, %d %b %Y %H:%M:%S %z", "%d %b %Y", "%B %d, %Y", "%b %d, %Y",
)


def parse_date(value: Optional[str]) -> Optional[datetime]:
    """Best-effort parse of the many date shapes Tavily and news sites emit."""
    if not value or not isinstance(value, str):
        return None
    text = value.strip()
    if not text or text.lower() in _NULLISH:
        return None
    iso_candidate = text.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(iso_candidate)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        pass
    for fmt in _DATE_FORMATS:
        try:
            parsed = datetime.strptime(text, fmt)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def to_iso_date(value: Optional[str]) -> Optional[str]:
    parsed = parse_date(value)
    return parsed.date().isoformat() if parsed else None


def days_since(value: Optional[str], now: Optional[datetime] = None) -> Optional[int]:
    parsed = parse_date(value)
    if not parsed:
        return None
    reference = now or datetime.now(timezone.utc)
    if reference.tzinfo is None:
        reference = reference.replace(tzinfo=timezone.utc)
    return max((reference - parsed).days, 0)


def humanize_age(days: Optional[int]) -> Optional[str]:
    if days is None:
        return None
    if days <= 0:
        return "today"
    if days == 1:
        return "1 day old"
    if days < 31:
        return f"{days} days old"
    if days < 365:
        months = max(round(days / 30), 1)
        return f"{months} month{'s' if months > 1 else ''} old"
    years = round(days / 365, 1)
    return f"{years:g} year{'s' if years != 1 else ''} old"


# ─── Title matching ───────────────────────────────────────────────────────────

_STOPWORDS = {
    "a", "an", "and", "as", "at", "be", "by", "for", "from", "in", "is", "it",
    "of", "on", "or", "the", "to", "with", "its", "new", "says", "after",
}


def _title_key(title: Optional[str]) -> str:
    cleaned = re.sub(r"[^a-z0-9 ]+", " ", (title or "").lower())
    return " ".join(cleaned.split())


def _title_tokens(title: Optional[str]) -> set:
    return {t for t in _title_key(title).split() if t not in _STOPWORDS and len(t) > 2}


# ─── Source collector ─────────────────────────────────────────────────────────

def _clean_snippet(text: Optional[str], limit: int = 320) -> Optional[str]:
    """Compact a result snippet for the offline fallback brief."""
    if not text:
        return None
    collapsed = re.sub(r"\s+", " ", str(text)).strip()
    if not collapsed:
        return None
    if len(collapsed) > limit:
        collapsed = collapsed[:limit].rsplit(" ", 1)[0] + "\u2026"
    return collapsed


class SourceCollector:
    """Records every URL the tools actually retrieved.

    This is the backbone of the accuracy fix. Previously ``sources`` was
    whatever the model wrote at the end of its brief, so it could list pages it
    never opened. Now the tools append real result URLs here and the server
    overwrites the model's list, which makes a fabricated source structurally
    impossible rather than merely discouraged.

    One instance per research run, owned by the agent, so concurrent requests
    cannot bleed into each other.
    """

    def __init__(self, max_sources: int = 25) -> None:
        self.max_sources = max_sources
        self._order: List[str] = []
        self._records: Dict[str, Dict[str, Any]] = {}

    # -- writes ---------------------------------------------------------------

    def add(
        self,
        url: Optional[str],
        *,
        title: Optional[str] = None,
        published_date: Optional[str] = None,
        kind: str = "web",
        score: Optional[float] = None,
        snippet: Optional[str] = None,
    ) -> Optional[str]:
        """Record a retrieved URL. Returns the canonical URL, or None if unusable."""
        canonical = canonicalize_url(url)
        key = url_key(canonical)
        if not canonical or not key:
            return None

        existing = self._records.get(key)
        if existing is None:
            if len(self._order) >= self.max_sources:
                return canonical
            self._order.append(key)
            self._records[key] = {
                "url": canonical,
                "title": (title or "").strip() or None,
                "published_date": to_iso_date(published_date),
                "kind": kind,
                "domain": domain_of(canonical),
                "score": score,
                "snippet": _clean_snippet(snippet),
            }
            return canonical

        # Enrich an existing record rather than duplicating it.
        if title and not existing.get("title"):
            existing["title"] = title.strip()
        if published_date and not existing.get("published_date"):
            existing["published_date"] = to_iso_date(published_date)
        if snippet and not existing.get("snippet"):
            existing["snippet"] = _clean_snippet(snippet)
        if kind == "news":
            existing["kind"] = "news"
        if score is not None and (existing.get("score") is None or score > existing["score"]):
            existing["score"] = score
        return existing["url"]

    def add_many(self, results: Iterable[Dict[str, Any]], kind: str = "web") -> int:
        added = 0
        for result in results or []:
            if not isinstance(result, dict):
                continue
            before = len(self._order)
            self.add(
                result.get("url"),
                title=result.get("title"),
                published_date=result.get("published_date") or result.get("published_time"),
                kind=kind,
                score=result.get("score"),
                snippet=result.get("content"),
            )
            if len(self._order) > before:
                added += 1
        return added

    def reset(self) -> None:
        self._order.clear()
        self._records.clear()

    # -- reads ----------------------------------------------------------------

    def has(self, url: Optional[str]) -> bool:
        key = url_key(url)
        return bool(key and key in self._records)

    def resolve(self, url: Optional[str]) -> Optional[str]:
        """Canonical URL for a model-supplied link, but only if we truly fetched it."""
        key = url_key(url)
        record = self._records.get(key) if key else None
        return record["url"] if record else None

    def record(self, url: Optional[str]) -> Optional[Dict[str, Any]]:
        key = url_key(url)
        return self._records.get(key) if key else None

    def match_title(self, title: Optional[str], kinds: Optional[Iterable[str]] = None):
        """Find a retrieved result whose headline matches ``title``.

        Used to repair a news item whose URL the model invented but whose
        headline it copied from a real search result.
        """
        target = _title_key(title)
        if not target:
            return None
        allowed = set(kinds) if kinds else None
        candidates = [
            r for r in (self._records[k] for k in self._order)
            if allowed is None or r.get("kind") in allowed
        ]

        for record in candidates:
            if _title_key(record.get("title")) == target:
                return record

        target_tokens = _title_tokens(title)
        if len(target_tokens) < 3:
            return None
        best, best_score = None, 0.0
        for record in candidates:
            tokens = _title_tokens(record.get("title"))
            if len(tokens) < 3:
                continue
            overlap = len(target_tokens & tokens)
            score = overlap / max(len(target_tokens | tokens), 1)
            if overlap >= 3 and score > best_score:
                best, best_score = record, score
        return best if best_score >= 0.5 else None

    @property
    def urls(self) -> List[str]:
        return [self._records[k]["url"] for k in self._order]

    @property
    def domains(self) -> List[str]:
        seen, ordered = set(), []
        for key in self._order:
            domain = self._records[key].get("domain")
            if domain and domain not in seen:
                seen.add(domain)
                ordered.append(domain)
        return ordered

    def details(self) -> List[Dict[str, Any]]:
        return [dict(self._records[k]) for k in self._order]

    def newest_published(self) -> Optional[str]:
        dates = [r.get("published_date") for r in self._records.values() if r.get("published_date")]
        return max(dates) if dates else None

    def __len__(self) -> int:
        return len(self._order)


# ─── Search result formatting ─────────────────────────────────────────────────

def format_search_results(
    results: Optional[List[Dict[str, Any]]],
    max_results: int = 4,
    snippet_chars: int = 350,
    include_dates: bool = True,
) -> str:
    """Render Tavily results as compact text for the ReAct loop.

    Two fixes over the previous version:

    1. ``max_results`` is now supplied by the caller. It used to default to 3
       while the search asked Tavily for ``MAX_SEARCH_RESULTS`` (8), so five of
       every eight paid-for results were silently thrown away.
    2. The publication date is included. Tavily returns ``published_date`` and
       the old formatter dropped it, which left the model free to invent dates
       — and it did.

    What the model sees stays deliberately lean; the *collector* keeps the full
    set. Accuracy comes from the collector, not from stuffing the prompt.
    """
    if not results:
        return "No results found."

    limit = max(1, int(max_results or 1))
    width = max(80, int(snippet_chars or 350))

    blocks: List[str] = []
    for index, result in enumerate(results[:limit], 1):
        if not isinstance(result, dict):
            continue
        title = (result.get("title") or "Untitled").strip()
        url = canonicalize_url(result.get("url")) or (result.get("url") or "").strip()
        content = re.sub(r"\s+", " ", (result.get("content") or "").strip())
        if len(content) > width:
            content = content[:width].rsplit(" ", 1)[0] + "…"

        meta: List[str] = []
        if include_dates:
            published = to_iso_date(result.get("published_date") or result.get("published_time"))
            age = humanize_age(days_since(published)) if published else None
            meta.append(f"published {published} ({age})" if age else f"published {published}" if published else "published date unknown")
        domain = domain_of(url)
        if domain:
            meta.append(domain)
        score = result.get("score")
        if isinstance(score, (int, float)):
            meta.append(f"relevance {score:.2f}")

        blocks.append(
            f"[{index}] {title}\n"
            f"URL: {url}\n"
            f"{' | '.join(meta)}\n"
            f"{content}"
        )

    if not blocks:
        return "No results found."

    total = len([r for r in results if isinstance(r, dict)])
    header = f"Showing {len(blocks)} of {total} results." if total > len(blocks) else ""
    body = "\n---\n".join(blocks)
    return f"{header}\n{body}".strip()


# ─── Query planning ───────────────────────────────────────────────────────────

def build_search_queries(
    company_name: str,
    website_url: str = "",
    depth: str = "standard",
    today: Optional[datetime] = None,
) -> List[str]:
    """Targeted search queries for one company.

    Previously this existed but was never called, and it hardcoded "2024 2025",
    which actively steered the agent toward stale articles. The year is now
    derived from the clock, and ``website_url`` is finally used.
    """
    name = (company_name or "").strip()
    if not name:
        return []

    now = today or datetime.now(timezone.utc)
    year = now.year

    queries = [
        f"{name} company overview what it does industry",
        f"{name} products services pricing",
        f"{name} CEO founders executive leadership team",
        f"{name} news {year}",
        f"{name} funding round valuation investors total raised",
        f"{name} competitors alternatives market share",
    ]

    domain = domain_of(website_url)
    if domain:
        queries.insert(1, f"{name} {domain} about company")

    if depth == "deep":
        queries.extend([
            f"{name} employees headcount company size {year}",
            f"{name} tech stack engineering blog architecture",
            f"{name} culture values mission careers",
            f"{name} revenue annual recurring revenue {year}",
            f"{name} risks challenges criticism lawsuit",
        ])
    elif depth == "quick":
        queries = queries[:4]

    return queries


# ─── Scraping ─────────────────────────────────────────────────────────────────

_STRIP_TAGS = (
    "script", "style", "nav", "footer", "header", "aside",
    "noscript", "iframe", "svg", "form", "button",
)


def scrape_website(url: str, timeout: int = 15, max_chars: int = 4000) -> str:
    """Fetch a page and return cleaned text, or a readable error string.

    The old version sliced the body to 4000 chars and then tested
    ``len(content) > 6000`` — a branch that could never fire. The budget is now
    applied once, to the assembled document, and is caller-controlled.
    """
    canonical = canonicalize_url(url)
    if not canonical:
        return f"Error: '{url}' is not a valid http(s) URL."

    budget = max(500, int(max_chars or 4000))
    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9",
        }
        response = requests.get(canonical, headers=headers, timeout=timeout)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        for tag in soup(list(_STRIP_TAGS)):
            tag.decompose()

        head: List[str] = [f"Source: {canonical}"]
        if soup.title and soup.title.string:
            head.append(f"Page Title: {soup.title.string.strip()}")
        meta = soup.find("meta", attrs={"name": "description"})
        if meta and meta.get("content"):
            head.append(f"Meta Description: {meta['content'].strip()}")

        text = soup.get_text(separator="\n", strip=True)
        lines = [line.strip() for line in text.splitlines() if len(line.strip()) > 1]

        # Collapse repeated nav/menu lines that survive tag stripping.
        deduped, seen = [], set()
        for line in lines:
            marker = line.lower()
            if marker in seen:
                continue
            seen.add(marker)
            deduped.append(line)

        document = "\n".join(head) + "\n\n" + "\n".join(deduped)
        if len(document) > budget:
            document = document[:budget].rsplit("\n", 1)[0] + "\n[Content truncated…]"
        return document

    except requests.exceptions.RequestException as exc:
        logger.error("Error scraping %s: %s", canonical, exc)
        return f"Error: Could not scrape {canonical}. Reason: {exc}"
    except Exception as exc:  # noqa: BLE001 - tool must never raise into the loop
        logger.error("Unexpected error scraping %s: %s", canonical, exc)
        return f"Error: Unexpected error scraping {canonical}. Reason: {exc}"
