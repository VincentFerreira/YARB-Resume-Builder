"""Content-based deduplication helpers, shared between the in-session merge in
app/scraper.py (a single scrape() call can capture the same post twice — once
under a fallback hash URN before its real activity URN is resolvable, once
after) and the cross-session merge in app/storage.py (PostStorage)."""
from .models import Post


def content_key(post: Post) -> str:
    """Stable key based on content, used to detect duplicates across URN types."""
    return f"{post.author.lower().strip()}|{post.text[:120].lower().strip()}"


def is_canonical_urn(urn: str) -> bool:
    """A real, stable LinkedIn activity URN. Anything else (hash fallback,
    groupPost, or any other non-activity URN type LinkedIn's DOM exposes) is
    a shadow identity, eligible to be replaced once a canonical URN for the
    same content shows up."""
    return urn.startswith("urn:li:activity:")


def pick_canonical(a: Post, b: Post) -> Post:
    """Resolve two posts sharing a content-key down to one: prefer a real
    activity URN, then a resolved url, then the earliest scraped_at. Always
    OR the delivered flag so healing duplicates never un-delivers a post."""
    a_ok, b_ok = is_canonical_urn(a.urn), is_canonical_urn(b.urn)
    if a_ok != b_ok:
        winner = a if a_ok else b
    elif bool(a.url) != bool(b.url):
        winner = a if a.url else b
    else:
        winner = a if a.scraped_at <= b.scraped_at else b
    return winner.model_copy(update={"delivered": a.delivered or b.delivered})


def dedup_by_content(posts: dict[str, Post]) -> dict[str, Post]:
    """Collapse posts sharing a content-key into one."""
    by_key: dict[str, Post] = {}
    for post in posts.values():
        key = content_key(post)
        prior = by_key.get(key)
        by_key[key] = post if prior is None else pick_canonical(post, prior)
    return {p.urn: p for p in by_key.values()}
