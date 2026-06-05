import asyncio
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse

from . import __version__
from .config import Settings, get_settings, save_override
from .cookies import load_cookies
from .models import (
    ConfigResponse,
    CookiesUploadResponse,
    InterestsUpdate,
    Post,
    ScrapeRequest,
    ScrapeResult,
)
from .scorer import score_posts
from .scraper import AuthenticationError, LinkedInScraper
from .storage import PostStorage

logger = logging.getLogger(__name__)

# Module-level singletons initialised in lifespan.
_settings: Settings
_storage: PostStorage
_scraper: LinkedInScraper
_scrape_lock: asyncio.Lock


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _settings, _storage, _scraper, _scrape_lock
    _settings = get_settings()
    _storage = PostStorage(_settings.posts_file)
    _scraper = LinkedInScraper(_settings)
    _scrape_lock = asyncio.Lock()
    logger.info("LinkedIn Scraper API started (v%s)", __version__)
    yield


app = FastAPI(
    title="LinkedIn Feed Scraper",
    description="Scrape LinkedIn feed and surface the most relevant posts based on configurable interests.",
    version=__version__,
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok", "version": __version__}


# ---------------------------------------------------------------------------
# Scraping
# ---------------------------------------------------------------------------

@app.post("/scrape", response_model=ScrapeResult, tags=["scraping"])
async def scrape(body: ScrapeRequest | None = None):
    """
    Trigger a LinkedIn feed scrape. Blocks until done (runs in a thread so the
    event loop stays responsive). Returns a summary with post counts.
    """
    if _scrape_lock.locked():
        raise HTTPException(status_code=409, detail="A scrape is already in progress.")

    async with _scrape_lock:
        scroll_attempts = (body.scroll_attempts if body else None)
        start = time.monotonic()
        try:
            loop = asyncio.get_event_loop()
            posts = await loop.run_in_executor(
                None,
                lambda: _scraper.scrape(scroll_attempts),
            )
        except AuthenticationError as exc:
            elapsed = time.monotonic() - start
            return ScrapeResult(
                posts_found=0,
                posts_new=0,
                duration_seconds=round(elapsed, 2),
                error=str(exc),
            )
        except Exception as exc:
            logger.exception("Scrape failed unexpectedly")
            elapsed = time.monotonic() - start
            return ScrapeResult(
                posts_found=0,
                posts_new=0,
                duration_seconds=round(elapsed, 2),
                error=f"Unexpected error: {exc}",
            )

        # Score with current keywords before persisting.
        scored = score_posts(posts, _settings.interest_keywords)
        posts_new = _storage.upsert_posts(scored)
        elapsed = time.monotonic() - start

        return ScrapeResult(
            posts_found=len(scored),
            posts_new=posts_new,
            duration_seconds=round(elapsed, 2),
        )


# ---------------------------------------------------------------------------
# Posts
# ---------------------------------------------------------------------------

@app.get("/posts", response_model=list[Post], tags=["posts"])
async def get_posts(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    min_score: float = Query(0.0, ge=0.0),
):
    """Return all stored posts sorted by relevance score."""
    all_posts = _storage.get_all()
    filtered = [p for p in all_posts if p.score >= min_score]
    return filtered[offset: offset + limit]


@app.get("/posts/interesting", response_model=list[Post], tags=["posts"])
async def get_interesting_posts(
    threshold: float | None = Query(None, ge=0.0),
):
    """Return posts above the relevance threshold (default from config)."""
    t = threshold if threshold is not None else _settings.relevance_threshold
    return _storage.get_interesting(t)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

@app.get("/config", response_model=ConfigResponse, tags=["config"])
async def get_config():
    return ConfigResponse(
        interest_keywords=_settings.interest_keywords,
        relevance_threshold=_settings.relevance_threshold,
        cookies_file=_settings.cookies_file,
        posts_file=_settings.posts_file,
        max_scroll_attempts=_settings.max_scroll_attempts,
        headless=_settings.headless,
    )


@app.put("/config/interests", tags=["config"])
async def update_interests(body: InterestsUpdate):
    """Update interest keywords and optional threshold. Persists across restarts."""
    global _settings, _scraper

    updates: dict = {"interest_keywords": body.keywords}
    if body.threshold is not None:
        updates["relevance_threshold"] = body.threshold

    save_override(updates)
    _settings = get_settings()
    _scraper = LinkedInScraper(_settings)

    # Re-score all stored posts with the new keywords.
    all_posts = _storage.get_all()
    rescored = score_posts(all_posts, _settings.interest_keywords)
    _storage.upsert_posts(rescored)

    return {
        "interest_keywords": _settings.interest_keywords,
        "relevance_threshold": _settings.relevance_threshold,
        "rescored_posts": len(rescored),
    }


@app.post("/config/cookies", response_model=CookiesUploadResponse, tags=["config"])
async def upload_cookies(file: UploadFile):
    """Upload a Cookie Editor JSON export to authenticate future scrapes."""
    content = await file.read()
    target_path = _settings.cookies_file

    # Validate format before saving.
    import json as _json
    try:
        raw = _json.loads(content)
        if not isinstance(raw, list):
            raise ValueError("Expected a JSON array of cookie objects.")
        if not all(isinstance(c, dict) and "name" in c and "value" in c for c in raw):
            raise ValueError("Each cookie must have at least 'name' and 'value' fields.")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid cookies file: {exc}")

    with open(target_path, "wb") as f:
        f.write(content)

    try:
        loaded = load_cookies(target_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Saved but failed to parse: {exc}")

    return CookiesUploadResponse(cookies_loaded=len(loaded), path=target_path)
