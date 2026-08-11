import json
import logging
import os
from pathlib import Path

from .dedup import content_key, dedup_by_content, is_canonical_urn
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

    def upsert_posts(self, new_posts: list[Post]) -> int:
        # Self-heals stray duplicates left by past bugs (mismatched hash
        # algorithms, groupPost vs activity URNs for the same post) without a
        # separate migration step — runs every time, including with an empty list.
        existing = dedup_by_content(self.load_all())
        content_index: dict[str, str] = {
            content_key(p): urn for urn, p in existing.items()
        }

        added = 0
        for post in new_posts:
            key = content_key(post)
            prior_urn = content_index.get(key)
            carried_delivered = False

            if prior_urn and prior_urn != post.urn:
                prior_entry = existing.get(prior_urn)
                prior_ok = is_canonical_urn(prior_urn)
                post_ok = is_canonical_urn(post.urn)
                if post_ok and not prior_ok:
                    # Upgrade: drop the shadow entry, carry its delivered flag forward.
                    logger.debug("Dedup: replacing %s with %s", prior_urn, post.urn)
                    existing.pop(prior_urn, None)
                    carried_delivered = bool(prior_entry and prior_entry.delivered)
                else:
                    # Duplicate of content we already track under an equal-or-more
                    # canonical URN — drop it.
                    continue
            else:
                prior_entry = existing.get(post.urn)
                carried_delivered = bool(prior_entry and prior_entry.delivered)

            if carried_delivered:
                post = post.model_copy(update={"delivered": True})
            if post.urn not in existing:
                added += 1
            existing[post.urn] = post
            content_index[key] = post.urn

        self.save_all(existing)
        return added

    def get_all(self) -> list[Post]:
        posts = list(self.load_all().values())
        return sorted(posts, key=lambda p: p.score, reverse=True)

    def get_interesting(self, threshold: float) -> list[Post]:
        return [p for p in self.get_all() if p.score >= threshold]

    def get_new_relevant(self, threshold: float) -> list[Post]:
        return [p for p in self.get_all() if p.score >= threshold and not p.delivered]

    def mark_delivered(self, urns: list[str]) -> None:
        """Never reset to False elsewhere — once delivered, always delivered."""
        existing = self.load_all()
        changed = False
        for urn in urns:
            if urn in existing and not existing[urn].delivered:
                existing[urn] = existing[urn].model_copy(update={"delivered": True})
                changed = True
        if changed:
            self.save_all(existing)
