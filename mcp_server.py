"""
MCP server for the LinkedIn scraper.

Exposes scraper capabilities as tools for Claude Code (stdio transport).
Reuses existing app modules without modification.

Usage (Claude Code registers this via .claude/settings.json — no manual launch needed):
    .venv/bin/python mcp_server.py
"""
import functools
import threading
import time

import anyio
from mcp.server.fastmcp import FastMCP

from app.config import get_settings, save_override
from app.scorer import score_posts
from app.scraper import AuthenticationError, LinkedInScraper
from app.storage import PostStorage

mcp = FastMCP(
    name="linkedin-scraper",
    instructions=(
        "Tools for scraping the LinkedIn feed, retrieving and filtering stored posts, "
        "and managing keyword/scoring configuration."
    ),
)

_settings = get_settings()
_storage = PostStorage(_settings.posts_file)
_scraper = LinkedInScraper(_settings)
_scrape_lock = threading.Lock()  # threading.Lock because scrape() runs in a real OS thread


@mcp.tool()
async def scrape_feed(scroll_attempts: int | None = None) -> list[dict]:
    """
    Trigger a LinkedIn feed scrape. Blocks until complete (typically 30–90 seconds).
    Returns scored posts found in this session, plus a summary entry at index 0.

    Args:
        scroll_attempts: Number of scroll steps (each loads ~5-10 posts).
                         Defaults to max_scroll_attempts from config.
    """
    def _do_scrape() -> list[dict]:
        scraper = _scraper  # capture local ref before any concurrent update_interests call
        if not _scrape_lock.acquire(blocking=False):
            return [{"error": "A scrape is already in progress. Try again later."}]
        try:
            start = time.monotonic()
            posts = scraper.scrape(scroll_attempts)
            scored = score_posts(posts, _settings.interest_keywords)
            _storage.upsert_posts(scored)
            result = [p.model_dump(mode="json") for p in scored]
            result.insert(0, {
                "summary": {
                    "posts_found": len(scored),
                    "duration_seconds": round(time.monotonic() - start, 2),
                }
            })
            return result
        except AuthenticationError as exc:
            return [{"error": f"Authentication failed: {exc}"}]
        except Exception as exc:
            return [{"error": f"Unexpected error: {exc}"}]
        finally:
            _scrape_lock.release()

    return await anyio.to_thread.run_sync(
        functools.partial(_do_scrape), abandon_on_cancel=False
    )


@mcp.tool()
def get_posts(limit: int = 50, min_score: float = 0.0) -> list[dict]:
    """
    Retrieve stored posts from the local cache, sorted by relevance score (highest first).

    Args:
        limit: Maximum number of posts to return (default 50).
        min_score: Only return posts with score >= this value (default 0.0 = all posts).
    """
    all_posts = _storage.get_all()
    filtered = [p for p in all_posts if p.score >= min_score][:limit]
    return [p.model_dump(mode="json") for p in filtered]


@mcp.tool()
def get_interesting_posts(threshold: float | None = None) -> list[dict]:
    """
    Retrieve posts scoring at or above the relevance threshold.

    Args:
        threshold: Minimum score cutoff. Defaults to relevance_threshold from config.
    """
    t = threshold if threshold is not None else _settings.relevance_threshold
    return [p.model_dump(mode="json") for p in _storage.get_interesting(t)]


@mcp.tool()
def update_interests(keywords: list[str], threshold: float | None = None) -> dict:
    """
    Update interest keywords and optionally the relevance threshold.
    Persists changes to config_override.json and immediately re-scores all stored posts.

    Args:
        keywords: List of keywords/phrases to match. Multi-word phrases score higher per match.
        threshold: New relevance threshold for get_interesting_posts. Optional.
    """
    global _settings, _scraper

    updates: dict = {"interest_keywords": keywords}
    if threshold is not None:
        updates["relevance_threshold"] = threshold

    save_override(updates)
    _settings = get_settings()
    _scraper = LinkedInScraper(_settings)

    rescored = score_posts(_storage.get_all(), _settings.interest_keywords)
    _storage.upsert_posts(rescored)

    return {
        "interest_keywords": _settings.interest_keywords,
        "relevance_threshold": _settings.relevance_threshold,
        "rescored_posts": len(rescored),
    }


@mcp.tool()
def get_config() -> dict:
    """Return the current active configuration (merged from .env + config_override.json)."""
    return {
        "interest_keywords": _settings.interest_keywords,
        "relevance_threshold": _settings.relevance_threshold,
        "cookies_file": _settings.cookies_file,
        "posts_file": _settings.posts_file,
        "max_scroll_attempts": _settings.max_scroll_attempts,
        "headless": _settings.headless,
    }


if __name__ == "__main__":
    mcp.run(transport="stdio")
