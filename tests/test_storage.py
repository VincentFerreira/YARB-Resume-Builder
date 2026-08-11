"""
Unit tests for PostStorage deduplication — no cookies or network needed.

Usage:
    pytest tests/test_storage.py -v
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.dedup import dedup_by_content
from app.models import Post
from app.storage import PostStorage

AUTHOR = "Jane Doe"
TEXT = "This is a post about Playwright automation testing."
NOW = datetime(2026, 8, 11, tzinfo=timezone.utc)


def make_post(urn: str, *, scraped_at: datetime = NOW, url: str = "", delivered: bool = False) -> Post:
    return Post(
        urn=urn,
        author=AUTHOR,
        text=TEXT,
        scraped_at=scraped_at,
        url=url,
        delivered=delivered,
    )


@pytest.fixture
def storage(tmp_path) -> PostStorage:
    return PostStorage(str(tmp_path / "posts.json"))


def test_upsert_collapses_batch_duplicates(storage):
    """Two different shadow URNs for identical content arriving in one batch
    (e.g. two hash algorithms disagreeing) collapse into a single entry."""
    hash_a = make_post("urn:li:post:hash:aaaa")
    hash_b = make_post("urn:li:post:hash:bbbb")

    added = storage.upsert_posts([hash_a, hash_b])

    assert added == 1
    assert len(storage.get_all()) == 1


def test_upsert_upgrades_shadow_to_canonical(storage):
    """A real activity URN arriving later for content stored under a hash URN
    replaces the shadow entry rather than creating a duplicate."""
    storage.upsert_posts([make_post("urn:li:post:hash:aaaa")])

    canonical = make_post("urn:li:activity:12345", url="https://www.linkedin.com/feed/update/urn:li:activity:12345/")
    storage.upsert_posts([canonical])

    all_posts = storage.get_all()
    assert len(all_posts) == 1
    assert all_posts[0].urn == "urn:li:activity:12345"


def test_upgrade_carries_delivered_flag_forward(storage):
    """If the shadow entry was already delivered, upgrading it to a canonical
    URN must not silently un-deliver the post."""
    storage.upsert_posts([make_post("urn:li:post:hash:aaaa")])
    storage.mark_delivered(["urn:li:post:hash:aaaa"])

    canonical = make_post("urn:li:activity:12345")
    storage.upsert_posts([canonical])

    all_posts = storage.get_all()
    assert len(all_posts) == 1
    assert all_posts[0].delivered is True


def test_delivered_survives_reupsert_of_same_urn(storage):
    storage.upsert_posts([make_post("urn:li:activity:1")])
    storage.mark_delivered(["urn:li:activity:1"])

    # Re-scraping the same post later (same URN) must not reset delivered.
    storage.upsert_posts([make_post("urn:li:activity:1", scraped_at=NOW + timedelta(days=1))])

    assert storage.get_all()[0].delivered is True


def test_get_new_relevant_excludes_delivered(storage):
    p1 = make_post("urn:li:activity:1")
    p1.score = 5.0
    p2 = make_post("urn:li:activity:2")
    p2.score = 5.0
    p2 = p2.model_copy(update={"text": TEXT + " other post"})
    storage.upsert_posts([p1, p2])

    new_relevant = storage.get_new_relevant(threshold=1.0)
    assert {p.urn for p in new_relevant} == {"urn:li:activity:1", "urn:li:activity:2"}

    storage.mark_delivered(["urn:li:activity:1"])
    new_relevant = storage.get_new_relevant(threshold=1.0)
    assert {p.urn for p in new_relevant} == {"urn:li:activity:2"}


def test_dedup_by_content_prefers_canonical_and_nonempty_url(storage):
    shadow = make_post("urn:li:post:hash:aaaa", url="")
    canonical_no_url = make_post("urn:li:activity:1", url="")
    canonical_with_url = make_post(
        "urn:li:activity:2", url="https://www.linkedin.com/feed/update/urn:li:activity:2/"
    )

    posts = {p.urn: p for p in [shadow, canonical_no_url, canonical_with_url]}
    deduped = dedup_by_content(posts)

    assert len(deduped) == 1
    winner = next(iter(deduped.values()))
    assert winner.urn.startswith("urn:li:activity:")
    assert winner.url != ""
