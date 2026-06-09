"""JSON-file backed implementation of PostsStore."""
import json
from datetime import datetime, timezone
from pathlib import Path

from bot.storage.interfaces import PostsStore

DEFAULT_PATH = Path(__file__).resolve().parent.parent.parent / "bot_posts.json"

# Decker-owned fields — preserved across re-scrapes of the same post (only its
# scraped content gets refreshed). Missing fields on legacy entries (written by
# an older schema) are backfilled with these defaults rather than raising.
_TRACKING_DEFAULTS = {
    "notified": False,
    "relevant": None,
    "score": None,
    "reason": "",
    "commented": False,
    "kept": False,
    "ignored": False,
}


class JSONPostsStore(PostsStore):
    """Reads and writes Decker's tracked posts to a flat JSON file on disk."""

    def __init__(self, path: Path | str = DEFAULT_PATH):
        self._path = Path(path)

    def record_scrape(self, posts: list[dict]) -> None:
        known = {p["urn"]: p for p in self._read()}
        now = datetime.now(tz=timezone.utc).isoformat()

        for post in posts:
            urn = post["urn"]
            if urn in known:
                existing = known[urn]
                tracking = {field: existing.get(field, default) for field, default in _TRACKING_DEFAULTS.items()}
                tracking["first_seen_at"] = existing.get("first_seen_at") or now
                known[urn] = {**post, **tracking}
            else:
                known[urn] = {**post, "first_seen_at": now, **_TRACKING_DEFAULTS}

        self._write(list(known.values()))

    def get_unnotified(self) -> list[dict]:
        return [p for p in self._read() if not p.get("notified")]

    def mark_notified(self, urns: list[str]) -> None:
        urns_set = set(urns)
        posts = self._read()
        for post in posts:
            if post["urn"] in urns_set:
                post["notified"] = True
        self._write(posts)

    def set_relevance(self, urn: str, relevant: bool, reason: str = "", score: int | None = None) -> None:
        posts = self._read()
        for post in posts:
            if post["urn"] == urn:
                post["relevant"] = relevant
                post["score"] = score
                post["reason"] = reason
                break
        self._write(posts)

    def get_found(self) -> list[dict]:
        found = [p for p in self._read() if p.get("relevant") and not p.get("ignored")]
        return sorted(found, key=lambda p: p.get("first_seen_at", ""), reverse=True)

    def mark_commented(self, urn: str) -> None:
        posts = self._read()
        for post in posts:
            if post["urn"] == urn:
                post["commented"] = True
                break
        self._write(posts)

    def keep(self, urn: str) -> None:
        posts = self._read()
        for post in posts:
            if post["urn"] == urn:
                post["kept"] = True
                break
        self._write(posts)

    def ignore(self, urn: str) -> None:
        posts = self._read()
        for post in posts:
            if post["urn"] == urn:
                post["ignored"] = True
                break
        self._write(posts)

    def _read(self) -> list[dict]:
        if not self._path.exists():
            return []
        try:
            return json.loads(self._path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return []

    def _write(self, posts: list[dict]) -> None:
        self._path.write_text(
            json.dumps(posts, indent=2, ensure_ascii=False), encoding="utf-8"
        )
