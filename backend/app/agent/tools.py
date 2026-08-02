import logging
import requests
from typing import Optional
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


def scrape_website(url: str, timeout: int = 15) -> str:
    """
    Scrape text content from a website URL.
    Returns cleaned text content or error message.
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) "
                          "Chrome/120.0.0.0 Safari/537.36"
        }
        response = requests.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        # Remove script, style, nav, footer elements
        for tag in soup(["script", "style", "nav", "footer", "header",
                         "aside", "noscript", "iframe", "svg"]):
            tag.decompose()

        # Extract meta description
        meta_desc = ""
        meta = soup.find("meta", attrs={"name": "description"})
        if meta and meta.get("content"):
            meta_desc = f"Meta Description: {meta['content']}\n\n"

        # Get page title
        title = ""
        if soup.title:
            title = f"Page Title: {soup.title.string}\n\n"

        # Get main text
        text = soup.get_text(separator='\n', strip=True)

        # Clean up excessive whitespace
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        cleaned = '\n'.join(lines)[:4000]

        # Limit to 6000 chars (~1500 tokens) to stay under Groq free-tier limits
        content = title + meta_desc + cleaned
        if len(content) > 6000:
            content = content[:6000] + "\n[Content truncated...]"

        return content

    except requests.exceptions.RequestException as e:
        logger.error(f"Error scraping {url}: {e}")
        return f"Error: Could not scrape {url}. Reason: {str(e)}"
    except Exception as e:
        logger.error(f"Unexpected error scraping {url}: {e}")
        return f"Error: Unexpected error scraping {url}. Reason: {str(e)}"


def format_search_results(results: list, max_results: int = 3) -> str:
    """Format Tavily search results into readable text.
    Limits to top results with truncated snippets to reduce token usage."""
    if not results:
        return "No results found."

    formatted = []
    for i, result in enumerate(results[:max_results], 1):
        title = result.get('title', 'No title')
        url = result.get('url', '')
        content = result.get('content', '')
        score = result.get('score', 0)

        formatted.append(
            f"[Result {i}] {title}\n"
            f"URL: {url}\n"
            f"Content: {content[:300]}\n"
            f"Relevance: {score:.2f}\n"
        )

    return "\n---\n".join(formatted)


def build_search_queries(company_name: str, website_url: str, depth: str) -> list:
    """Build a list of search queries for the research agent."""
    queries = [
        f"{company_name} company overview description industry",
        f"{company_name} products services offering",
        f"{company_name} CEO leadership executive team founders",
        f"{company_name} latest news 2024 2025",
        f"{company_name} funding valuation revenue investors",
        f"{company_name} competitors market analysis",
    ]

    if depth == "deep":
        queries.extend([
            f"{company_name} tech stack technology engineering",
            f"{company_name} culture values mission vision",
            f"{company_name} hiring jobs openings careers",
            f"{company_name} SWOT analysis strengths weaknesses",
            f"{company_name} social media LinkedIn Twitter GitHub",
        ])

    return queries
