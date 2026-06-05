from datetime import datetime
from pydantic import BaseModel


class Post(BaseModel):
    urn: str
    author: str
    text: str
    reactions: int = 0
    scraped_at: datetime
    score: float = 0.0
    matched_keywords: list[str] = []
    url: str = ""


class ScrapeResult(BaseModel):
    posts_found: int
    posts_new: int
    duration_seconds: float
    error: str | None = None


class ScrapeRequest(BaseModel):
    scroll_attempts: int | None = None


class InterestsUpdate(BaseModel):
    keywords: list[str]
    threshold: float | None = None


class CookiesUploadResponse(BaseModel):
    cookies_loaded: int
    path: str


class ConfigResponse(BaseModel):
    interest_keywords: list[str]
    relevance_threshold: float
    cookies_file: str
    posts_file: str
    max_scroll_attempts: int
    headless: bool
