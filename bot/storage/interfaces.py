"""Persistence contracts for Decker's data.

Handlers depend only on these interfaces, never on a concrete backend — swap
a JSON-backed implementation for a SQL-backed one later by writing a new
class that implements the same contract and wiring it in `bot/storage/__init__.py`.
"""
from abc import ABC, abstractmethod


class SettingsStore(ABC):
    """Stores the criteria that condition which posts Decker surfaces."""

    @abstractmethod
    def get_interests(self) -> list[str]:
        """Return the list of topics/keywords Decker should look for."""

    @abstractmethod
    def set_interests(self, interests: list[str]) -> None:
        """Replace the list of topics/keywords Decker should look for."""


class PostsStore(ABC):
    """Tracks every post Decker has scraped, plus Decker-specific state:
    whether it's been shown to the user (`notified`), whether Claude judged
    it relevant (`relevant`/`score`/`reason`), whether the user commented on it
    (`commented`), bookmarked it for later (`kept`), and whether the user chose
    to ignore it (`ignored`). This is what lets Decker diff "new vs
    already-seen", "relevant vs not", and "commented vs not yet", and
    permanently ignore posts the user discards — even across future scrapes
    that re-detect the very same post.
    """

    @abstractmethod
    def record_scrape(self, posts: list[dict]) -> None:
        """Persist freshly scraped posts, merging with what's already known.

        Existing posts keep their Decker-owned state (`notified`, `relevant`,
        `reason`, `commented`, `ignored`, `first_seen_at`); their scraped
        content (text, reactions, ...) is refreshed.
        """

    @abstractmethod
    def get_unnotified(self) -> list[dict]:
        """Posts scraped but never evaluated/surfaced yet — the "new" ones."""

    @abstractmethod
    def mark_notified(self, urns: list[str]) -> None:
        """Flag posts as already surfaced to the user."""

    @abstractmethod
    def set_relevance(self, urn: str, relevant: bool, reason: str = "", score: int | None = None) -> None:
        """Persist Claude's relevance verdict (score and short reason) for a post."""

    @abstractmethod
    def get_found(self) -> list[dict]:
        """Posts judged relevant and not ignored — the "found" posts to browse."""

    @abstractmethod
    def mark_commented(self, urn: str) -> None:
        """Flag a single post as commented on."""

    @abstractmethod
    def keep(self, urn: str) -> None:
        """Bookmark a post for later — distinct from commenting on or ignoring it."""

    @abstractmethod
    def ignore(self, urn: str) -> None:
        """Permanently ignore a post — Decker will never resurface it again,
        even if a future scrape re-detects it."""
