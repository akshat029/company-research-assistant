import re
from urllib.parse import urlparse
from typing import Tuple


def is_url(text: str) -> bool:
    """Check if the given text is a URL."""
    url_pattern = re.compile(
        r'^(?:http|ftp)s?://'  # http:// or https://
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+(?:[A-Z]{2,6}\.?|[A-Z0-9-]{2,}\.?)|'
        r'localhost|'
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'
        r'(?::\d+)?'
        r'(?:/?|[/?]\S+)$', re.IGNORECASE)
    if url_pattern.match(text):
        return True
    # Also check for domain-like patterns without http
    domain_pattern = re.compile(
        r'^(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+(?:[A-Z]{2,6})$',
        re.IGNORECASE
    )
    return bool(domain_pattern.match(text.strip()))


def normalize_url(url: str) -> str:
    """Ensure URL has https:// prefix."""
    url = url.strip()
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    return url


def extract_domain(url: str) -> str:
    """Extract clean domain from URL."""
    try:
        parsed = urlparse(normalize_url(url))
        domain = parsed.netloc
        # Remove www.
        if domain.startswith('www.'):
            domain = domain[4:]
        return domain
    except Exception:
        return url


def extract_company_name_from_domain(domain: str) -> str:
    """Best-effort company name extraction from domain."""
    # Remove TLD
    parts = domain.split('.')
    if len(parts) >= 2:
        name = parts[-2]  # e.g. 'openai' from 'openai.com'
    else:
        name = parts[0]
    # Capitalize nicely
    return name.replace('-', ' ').replace('_', ' ').title()


def resolve_query(query: str) -> Tuple[str, str, bool]:
    """
    Resolve a user query to (company_name, website_url, is_url_input).
    Returns:
        company_name: Best-guess company name for search queries
        website_url: URL if provided, else empty string
        is_url_input: Whether input was a URL
    """
    query = query.strip()

    if is_url(query):
        url = normalize_url(query)
        domain = extract_domain(url)
        company_name = extract_company_name_from_domain(domain)
        return company_name, url, True
    else:
        return query, "", False
