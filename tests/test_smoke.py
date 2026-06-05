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
# Nombre de pas de scroll dans la page (chaque pas charge ~5-10 nouveaux posts).
# 5 pas × ~2.5s de pause = ~12s de scroll + ~15s de chargement initial = ~30s total.
SCROLL_ATTEMPTS = 7
MIN_POSTS = 20

pytestmark = pytest.mark.skipif(
    not COOKIES_FILE.exists(),
    reason="cookies.json introuvable — exportez vos cookies LinkedIn avec l'extension Cookie Editor",
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
            f"Authentification LinkedIn échouée — cookies expirés ou invalides.\n"
            f"→ Ré-exportez via l'extension Cookie Editor et relancez.\n"
            f"Détail : {exc}"
        )
    return posts


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_cookies_contain_li_at():
    """Le cookie de session li_at doit être présent dans cookies.json."""
    cookies = json.loads(COOKIES_FILE.read_text())
    names = {c["name"] for c in cookies}
    assert "li_at" in names, (
        "Cookie 'li_at' absent — la session LinkedIn sera invalide. "
        "Exportez vos cookies avec Cookie Editor en étant connecté."
    )


def test_scraper_returns_enough_posts(scraped_posts):
    """Le scraper doit retourner au moins MIN_POSTS posts sans lever d'erreur d'auth."""
    assert scraped_posts, (
        "Aucun post retourné — vérifiez la connexion réseau et la validité des cookies."
    )
    assert len(scraped_posts) >= MIN_POSTS, (
        f"{len(scraped_posts)} posts retournés, attendu >= {MIN_POSTS}. "
        f"Augmentez SCROLL_ATTEMPTS (actuellement {SCROLL_ATTEMPTS}) "
        f"— chaque pas de scroll ajoute ~2.5s et ~5-10 posts."
    )


def test_posts_have_valid_structure(scraped_posts):
    """Chaque post doit avoir un URN valide, un auteur, un texte et un timestamp."""
    for post in scraped_posts:
        assert post.urn, f"Post sans URN : {post}"
        assert post.urn.startswith("urn:li:"), f"URN mal formé : {post.urn!r}"
        assert post.text.strip(), f"Post sans texte : {post.urn}"
        assert post.author, f"Post sans auteur : {post.urn}"
        assert post.scraped_at is not None, f"Post sans timestamp : {post.urn}"


def test_posts_have_no_duplicate_urns(scraped_posts):
    """La déduplication par URN doit garantir l'unicité des posts retournés."""
    urns = [p.urn for p in scraped_posts]
    assert len(urns) == len(set(urns)), (
        f"{len(urns) - len(set(urns))} URN(s) en doublon détectés — "
        "la déduplication dans scrape() ne fonctionne pas correctement."
    )
