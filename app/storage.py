import json
import logging
import os
from pathlib import Path

from .models import Post

logger = logging.getLogger(__name__)


class PostStorage:
    def __init__(self, path: str) -> None:
        self._path = Path(path)

    def load_all(self) -> dict[str, Post]:
        if not self._path.exists():
            return {}
        try:
            raw = json.loads(self._path.read_text())
            return {item["urn"]: Post.model_validate(item) for item in raw}
        except Exception as exc:
            logger.error("Failed to load posts from %s: %s", self._path, exc)
            return {}

    def save_all(self, posts: dict[str, Post]) -> None:
        tmp = self._path.with_suffix(".json.tmp")
        data = [p.model_dump(mode="json") for p in posts.values()]
        tmp.write_text(json.dumps(data, indent=2, default=str))
        os.replace(tmp, self._path)

    @staticmethod
    def _content_key(post: Post) -> str:
        """Stable key based on content, used to detect duplicates across URN types."""
        return f"{post.author.lower().strip()}|{post.text[:120].lower().strip()}"

    def upsert_posts(self, new_posts: list[Post]) -> int:
        existing = self.load_all()

        # Build a reverse index: content_key -> urn, for hash-based entries only.
        # When a real URN arrives for the same content, the hash entry is dropped.
        hash_index: dict[str, str] = {
            self._content_key(p): urn
            for urn, p in existing.items()
            if urn.startswith("urn:li:post:hash:")
        }

        added = 0
        for post in new_posts:
            key = self._content_key(post)
            existing_urn = existing.get(post.urn)
            shadow_urn = hash_index.get(key)

            if post.urn not in existing:
                if shadow_urn and shadow_urn != post.urn:
                    # Real URN arrived for a post we stored under a hash URN — replace it.
                    logger.debug("Dedup: replacing %s with %s", shadow_urn, post.urn)
                    del existing[shadow_urn]
                    hash_index.pop(key, None)
                added += 1

            existing[post.urn] = post

        self.save_all(existing)
        return added

    def get_all(self) -> list[Post]:
        posts = list(self.load_all().values())
        return sorted(posts, key=lambda p: p.score, reverse=True)

    def get_interesting(self, threshold: float) -> list[Post]:
        return [p for p in self.get_all() if p.score >= threshold]
