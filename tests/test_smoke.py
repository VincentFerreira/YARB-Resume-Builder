"""
Smoke tests — integration tests requiring a valid cookies.json with li_at.

Usage:
    pytest tests/test_smoke.py -v -s

The scraper runs once (session-scoped fixture) so LinkedIn is only hit once.
Tests are skipped automatically when cookies.json is absent.
"""
import json
import logging
from pathlib import Path

import pytest

COOKIES_FILE = Path(__file__).parent.parent / "cookies.json"
# Number of scroll passes per scrape (each pass loads ~5-10 new posts).
# 5 passes × ~2.5s pause = ~12s scrolling + ~15s initial load = ~30s total.
SCROLL_ATTEMPTS = 7
MIN_POSTS = 20

pytestmark = pytest.mark.skipif(
    not COOKIES_FILE.exists(),
    reason="cookies.json not found — export your LinkedIn cookies with the Cookie Editor extension",
)


# ---------------------------------------------------------------------------
# Session-scoped fixture: runs the scraper exactly once for all tests below.
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def scraped_posts():
    from app.config import Settings
    from app.scraper import AuthenticationError, LinkedInScraper

    settings = Settings(
        cookies_file=str(COOKIES_FILE),
        max_scroll_attempts=SCROLL_ATTEMPTS,
        headless=True,
    )
    try:
        posts = LinkedInScraper(settings).scrape()
    except AuthenticationError as exc:
        pytest.fail(
            f"LinkedIn authentication failed — cookies are expired or invalid.\n"
            f"→ Re-export via the Cookie Editor extension and retry.\n"
            f"Detail: {exc}"
        )
    return posts


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_cookies_contain_li_at():
    """The li_at session cookie must be present in cookies.json."""
    cookies = json.loads(COOKIES_FILE.read_text())
    names = {c["name"] for c in cookies}
    assert "li_at" in names, (
        "Cookie 'li_at' missing — the LinkedIn session will be invalid. "
        "Export your cookies with Cookie Editor while logged in."
    )


def test_scraper_returns_enough_posts(scraped_posts):
    """The scraper must return at least MIN_POSTS posts without raising an auth error."""
    assert scraped_posts, (
        "No posts returned — check network connectivity and cookie validity."
    )
    assert len(scraped_posts) >= MIN_POSTS, (
        f"{len(scraped_posts)} posts returned, expected >= {MIN_POSTS}. "
        f"Increase SCROLL_ATTEMPTS (currently {SCROLL_ATTEMPTS}) "
        f"— each scroll pass adds ~2.5s and ~5-10 posts."
    )


def test_posts_have_valid_structure(scraped_posts):
    """Each post must have a valid URN, author, text, and timestamp."""
    for post in scraped_posts:
        assert post.urn, f"Post without URN: {post}"
        assert post.urn.startswith("urn:li:"), f"Malformed URN: {post.urn!r}"
        assert post.text.strip(), f"Post without text: {post.urn}"
        assert post.author, f"Post without author: {post.urn}"
        assert post.scraped_at is not None, f"Post without timestamp: {post.urn}"


def test_posts_have_no_duplicate_urns(scraped_posts):
    """URN-based deduplication must guarantee unique posts in the result."""
    urns = [p.urn for p in scraped_posts]
    assert len(urns) == len(set(urns)), (
        f"{len(urns) - len(set(urns))} duplicate URN(s) detected — "
        "deduplication in scrape() is not working correctly."
    )


def test_posts_have_no_duplicate_content(scraped_posts):
    """Two different URNs (e.g. a hash URN and a groupPost/activity URN) can
    still represent the same post — unique URN strings alone don't prove
    dedup worked. Content-key uniqueness catches that case."""
    keys = [(p.author.lower().strip(), p.text[:120].lower().strip()) for p in scraped_posts]
    assert len(keys) == len(set(keys)), (
        f"{len(keys) - len(set(keys))} duplicate content-key(s) detected — "
        "same post stored under different URNs."
    )
