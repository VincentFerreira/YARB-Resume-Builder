import json
import logging
from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

OVERRIDE_FILE = Path(__file__).parent.parent / "config_override.json"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    cookies_file: str = "cookies.json"
    posts_file: str = "posts.json"
    interest_keywords: list[str] = ["QA", "testing", "quality assurance"]
    relevance_threshold: float = 2.0
    max_scroll_attempts: int = 3
    headless: bool = True

    @field_validator("interest_keywords", mode="before")
    @classmethod
    def parse_keywords(cls, v: object) -> list[str]:
        if isinstance(v, str):
            return [kw.strip() for kw in v.split(",") if kw.strip()]
        return v  # type: ignore[return-value]


def _apply_override(settings: Settings) -> Settings:
    if not OVERRIDE_FILE.exists():
        return settings
    try:
        overrides = json.loads(OVERRIDE_FILE.read_text())
        data = settings.model_dump()
        data.update(overrides)
        return Settings.model_validate(data)
    except Exception as exc:
        logger.warning("Could not read config_override.json: %s", exc)
        return settings


def save_override(updates: dict) -> None:
    existing: dict = {}
    if OVERRIDE_FILE.exists():
        try:
            existing = json.loads(OVERRIDE_FILE.read_text())
        except Exception:
            pass
    existing.update(updates)
    OVERRIDE_FILE.write_text(json.dumps(existing, indent=2))
    # Bust the cache so next get_settings() picks up the changes.
    get_settings.cache_clear()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return _apply_override(Settings())
