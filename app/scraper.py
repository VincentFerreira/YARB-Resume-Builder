import hashlib
import logging
import re
from datetime import datetime, timedelta, timezone

from scrapling.fetchers import StealthyFetcher

from .config import Settings
from .cookies import load_cookies
from .models import Post

logger = logging.getLogger(__name__)

FEED_URL = "https://www.linkedin.com/feed/"

# Regex to extract reaction/like counts from text like "78 réactions", "12 likes"
_REACTION_RE = re.compile(
    r"^(\d[\d\s,\.]*)\s*(?:réaction|reaction|like)",
    re.IGNORECASE,
)
# Regex to extract author from aria-label like "Ouvrir le menu de commandes pour le post de Name"
# Supports both French and English LinkedIn interfaces.
_MENU_LABEL_RE = re.compile(
    r"(?:menu de commandes pour le post de|Open control menu for post by)\s+(.+)$",
    re.IGNORECASE,
)


# Matches LinkedIn's relative post age text, e.g. "2 h •", "3 j •", "1 sem. •".
# The bullet separator (•/·) must follow the unit — it distinguishes the timestamp
# span from other short texts like the connection-degree badge "• 1er".
_RELATIVE_AGE_RE = re.compile(r"(\d+)\s*([a-zà-ÿ]+)\.?\s*[•·]", re.IGNORECASE)

# Ordered so ambiguous single-letter prefixes ("m", "s") are tried AFTER the
# longer, more specific ones ("mo"/"mois" before "m"; "sem" before "s").
_UNIT_TO_DAYS: tuple[tuple[str, float], ...] = (
    ("a", 365.0),    # an, ans, années, année
    ("y", 365.0),    # year, years, yr
    ("mo", 30.0),    # mois, month, months, mo   — before bare "m"
    ("sem", 7.0),    # semaine, semaines, sem     — before bare "s"
    ("w", 7.0),      # week, weeks, w
    ("j", 1.0),      # jour, jours, j
    ("d", 1.0),      # day, days, d
    ("h", 1 / 24),   # heure, heures, h, hour, hours, hr, hrs
    ("m", 1 / 1440), # minute, minutes, min, mins, m   — after "mo"
    ("s", 1 / 86400), # seconde, secondes, sec, secs, s — after "sem"
)


def _parse_relative_age(text: str, now: datetime) -> datetime | None:
    """Convert LinkedIn's relative post age (e.g. '2 h •', '3 j •') to an
    absolute UTC datetime by subtracting the interval from `now`."""
    m = _RELATIVE_AGE_RE.search(text)
    if not m:
        return None
    amount, unit = int(m.group(1)), m.group(2).lower()
    for prefix, days in _UNIT_TO_DAYS:
        if unit.startswith(prefix):
            return now - timedelta(days=amount * days)
    return None


class AuthenticationError(Exception):
    pass


def _check_auth_failure(page) -> bool:
    if page.status in (401, 403):
        return True
    url = page.url or ""
    if any(seg in url for seg in ("/login", "/authwall", "/uas/authenticate")):
        return True
    if page.css("input[name='session_key']"):
        return True
    return False


def _parse_count(text: str) -> int:
    try:
        clean = re.sub(r"[\s,\.]", "", text.strip().split()[0])
        return int(clean)
    except Exception:
        return 0


def _extract_posts(page) -> list[Post]:
    posts: list[Post] = []
    now = datetime.now(tz=timezone.utc)

    # LinkedIn's new DOM (2025+): post text lives inside
    #   <p componentkey="feed-commentary_{UUID}">
    #     <span data-testid="expandable-text-box">…</span>
    #   </p>
    # The author's menu button precedes the text element in document order.
    commentary_elements = page.xpath(
        "//*[starts-with(@componentkey, 'feed-commentary_')]"
    )

    if not commentary_elements:
        # Fallback: legacy DOM used data-urn / data-id attributes.
        commentary_elements = page.xpath(
            "//*[@data-urn[contains(., 'urn:li:activity')] or "
            "@data-id[contains(., 'urn:li:activity')]]"
        )
        if not commentary_elements:
            logger.warning("No post containers found on page — LinkedIn DOM may have changed")
            return posts

    seen_urns: set[str] = set()

    for el in commentary_elements:
        try:
            # --- Text ---
            text_parts = el.xpath(
                ".//span[@data-testid='expandable-text-box']//text()"
            )
            text = " ".join(str(t).strip() for t in text_parts if str(t).strip())

            if not text:
                # Legacy fallback selectors
                text_parts = el.xpath(
                    ".//div[contains(@class,'feed-shared-text')]//span[@class='break-words']//text() | "
                    ".//div[contains(@class,'update-components-text')]//span[@class='break-words']//text()"
                )
                text = " ".join(str(t).strip() for t in text_parts if str(t).strip())

            if not text:
                continue

            # --- Author ---
            # The menu button for the post appears before the text element in the DOM.
            author_labels = el.xpath(
                "preceding::button[contains(@aria-label, 'menu de commandes pour le post de') "
                "or contains(@aria-label, 'Open control menu for post by')][1]/@aria-label"
            )
            author = "Unknown"
            if author_labels:
                label = str(author_labels[0]) if isinstance(author_labels, list) else str(author_labels)
                m = _MENU_LABEL_RE.search(label)
                if m:
                    author = m.group(1).strip()

            if author == "Unknown":
                # Legacy fallback
                author_parts = el.xpath(
                    ".//span[contains(@class,'update-components-actor__name')]//span[@aria-hidden='true']//text() | "
                    ".//span[contains(@class,'feed-shared-actor__name')]//text()"
                )
                author = " ".join(str(a).strip() for a in author_parts if str(a).strip()) or "Unknown"

            # --- Stable ID ---
            # Try to get the real activity URN (only available when comments are rendered).
            # Prefer attributes scoped to *this* post (its own element, then its
            # container ancestor) — an unbounded forward search can wander into a
            # neighbouring post's subtree and return the wrong URN, which then
            # produces an "Open on LinkedIn" link pointing at the wrong post.
            urn = ""
            legacy_urn = (
                el.attrib.get("data-urn", "") or el.attrib.get("data-id", "")
            )
            if legacy_urn and "urn:li:activity" in legacy_urn:
                urn = legacy_urn
            else:
                container_urns = el.xpath(
                    "ancestor::*[@data-urn[contains(., 'urn:li:activity')] "
                    "or @data-id[contains(., 'urn:li:activity')]][1]"
                )
                if container_urns:
                    container = container_urns[0]
                    container_urn = container.attrib.get("data-urn", "") or container.attrib.get("data-id", "")
                    if "urn:li:activity" in container_urn:
                        urn = container_urn

            if not urn:
                urn_candidates = el.xpath(
                    "following::*[contains(@componentkey, 'urn:li:activity')][1]/@componentkey"
                )
                if urn_candidates:
                    raw = str(urn_candidates[0]) if isinstance(urn_candidates, list) else str(urn_candidates)
                    m = re.search(r"(urn:li:activity:\d+)", raw)
                    if m:
                        urn = m.group(1)

            if not urn:
                # Hash-based fallback — stable across pages for the same content.
                digest = hashlib.md5(f"{author}:{text[:200]}".encode()).hexdigest()[:16]
                urn = f"urn:li:post:hash:{digest}"

            if urn in seen_urns:
                continue
            seen_urns.add(urn)

            # --- Reactions ---
            # Reaction counts appear after the text in document order.
            reaction_texts = el.xpath(
                "following::*[contains(text(), 'réaction') or contains(text(), 'reaction') "
                "or contains(text(), 'like')][1]/text()"
            )
            reactions = 0
            for rt in (reaction_texts if isinstance(reaction_texts, list) else [reaction_texts]):
                m = _REACTION_RE.match(str(rt).strip())
                if m:
                    reactions = _parse_count(m.group(1))
                    break

            # Legacy reaction selector
            if reactions == 0:
                reaction_parts = el.xpath(
                    ".//span[contains(@class,'social-counts-reactions__count-value')]//text()"
                )
                reactions_text = "".join(str(r) for r in reaction_parts).strip()
                if reactions_text:
                    reactions = _parse_count(reactions_text)

            # --- URL ---
            if "urn:li:activity" in urn and not urn.startswith("urn:li:post:hash:"):
                url = f"https://www.linkedin.com/feed/update/{urn}/"
            else:
                url = ""

            # --- Publish date ---
            # LinkedIn shows a relative age next to the author (e.g. "2 h •",
            # "3 j • Modifié •") instead of an exact timestamp. Parse the
            # nearest preceding bullet-containing span to recover an absolute UTC
            # datetime; fall back to None when parsing fails or the span is absent.
            posted_at: datetime | None = None
            age_candidates = el.xpath(
                "preceding::span[contains(text(), '•') or contains(text(), '·')][position() <= 5]/text()"
            )
            for candidate in (age_candidates if isinstance(age_candidates, list) else [age_candidates]):
                posted_at = _parse_relative_age(str(candidate), now)
                if posted_at:
                    break

            posts.append(Post(
                urn=urn,
                author=author,
                text=text,
                reactions=reactions,
                scraped_at=now,
                posted_at=posted_at,
                url=url,
            ))
        except Exception as exc:
            logger.debug("Skipped element: %s", exc)

    logger.info("Extracted %d posts from page", len(posts))
    return posts


# JS injected into the live page at each scroll step.
# Returns only the fields we need — no full HTML strings, no lxml trees.
_JS_EXTRACT_POSTS = r"""
() => {
    const AUTHOR_RE = /(?:menu de commandes pour le post de|Open control menu for post by)\s+(.+)$/i;
    const REACTION_RE = /^(\d[\d\s,\.]*?)\s*(?:réaction|reaction|like)/i;
    // Matches relative age spans like "2 h •", "3 j •", "1 sem. •" — the
    // trailing bullet is what distinguishes them from connection-degree badges.
    const TIME_RE = /\d+\s*[a-zà-ÿ]+\s*[•·]/i;

    const authorBtns = Array.from(document.querySelectorAll('button[aria-label]'))
        .filter(b => AUTHOR_RE.test(b.getAttribute('aria-label')));
    const timeSpans = Array.from(document.querySelectorAll('span'))
        .filter(s => TIME_RE.test((s.textContent || '').trim()));

    const results = [];
    for (const el of document.querySelectorAll('[componentkey^="feed-commentary_"]')) {
        const textEl = el.querySelector('[data-testid="expandable-text-box"]');
        const text = textEl ? textEl.innerText.trim() : '';
        if (!text) continue;

        // Last matching button that precedes this element in document order
        let author = 'Unknown';
        for (let i = authorBtns.length - 1; i >= 0; i--) {
            if (authorBtns[i].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
                const m = (authorBtns[i].getAttribute('aria-label') || '').match(AUTHOR_RE);
                if (m) author = m[1].trim();
                break;
            }
        }

        // Real activity URN — prefer attributes scoped to *this* post (its own
        // element, then its container ancestor). Falling back straight to a
        // forward sibling search can wander into a neighbouring post's subtree
        // and grab the wrong URN, producing an "Open on LinkedIn" link that
        // points at a different post than the one shown.
        let urn = el.getAttribute('data-urn') || el.getAttribute('data-id') || '';
        if (!urn || !urn.includes('urn:li:activity')) {
            const container = el.closest('[data-urn*="urn:li:activity"], [data-id*="urn:li:activity"]');
            if (container) {
                urn = container.getAttribute('data-urn') || container.getAttribute('data-id') || '';
            }
        }
        if (!urn || !urn.includes('urn:li:activity')) {
            for (let n = el.nextElementSibling, i = 0; n && i < 10; n = n.nextElementSibling, i++) {
                const m = (n.getAttribute('componentkey') || '').match(/(urn:li:activity:\d+)/);
                if (m) { urn = m[1]; break; }
            }
        }
        if (!urn || !urn.includes('urn:li:')) {
            // djb2 hash — deterministic, cheap, consistent within a session
            let h = 5381;
            const src = author + ':' + text.slice(0, 200);
            for (let i = 0; i < src.length; i++) h = ((h << 5) + h + src.charCodeAt(i)) | 0;
            urn = 'urn:li:post:hash:' + (h >>> 0).toString(16).padStart(8, '0');
        }

        let reactions = 0;
        for (let n = el.nextElementSibling, i = 0; n && i < 5; n = n.nextElementSibling, i++) {
            const m = REACTION_RE.exec(n.innerText || '');
            if (m) { reactions = parseInt(m[1].replace(/[\s,\.]/g, ''), 10) || 0; break; }
        }

        // Nearest preceding span whose text matches the relative-age pattern —
        // same direction & logic as the author-button search above.
        let ageText = '';
        for (let i = timeSpans.length - 1; i >= 0; i--) {
            if (timeSpans[i].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
                ageText = (timeSpans[i].textContent || '').trim();
                break;
            }
        }

        results.push({
            urn, author, text, reactions, ageText,
            componentkey: el.getAttribute('componentkey') || '',
            url: urn.includes('urn:li:activity:')
                ? 'https://www.linkedin.com/feed/update/' + urn + '/' : '',
        });
    }
    return results;
}
"""


def _extract_posts_js(page, now: datetime) -> list[tuple[Post, str]]:
    """Extract post data via JS evaluation — returns only the fields we need, no full HTML.

    Returns `(Post, componentkey)` pairs — the componentkey lets the caller
    locate this exact post's "more options" button later, to resolve a real
    permalink when the DOM-derived `url` came up empty (see _resolve_post_url).
    """
    try:
        raw = page.evaluate(_JS_EXTRACT_POSTS)
    except Exception as exc:
        logger.warning("JS extraction failed: %s", exc)
        return []
    return [
        (
            Post(urn=p["urn"], author=p["author"], text=p["text"],
                 reactions=p.get("reactions", 0), scraped_at=now,
                 posted_at=_parse_relative_age(p.get("ageText", ""), now),
                 url=p.get("url", "")),
            p.get("componentkey", ""),
        )
        for p in (raw or []) if p.get("text")
    ]


_COPY_LINK_LOCATOR = (
    '[role="menuitem"]:has-text("Copier le lien vers le post"), '
    '[role="menuitem"]:has-text("Copy link to post")'
)


def _resolve_post_url(page, componentkey: str) -> str:
    """Resolve a working permalink for a post via its "more options" → "Copy
    link to post" menu, reading the result back from the clipboard.

    LinkedIn's current feed DOM almost never exposes a real `urn:li:activity`
    id in its attributes (see the comments in _extract_posts/_extract_posts_js)
    — every post falls back to a content-hash URN with no derivable URL. The
    share menu is the one place LinkedIn still hands out a canonical permalink
    (e.g. https://www.linkedin.com/posts/<author-slug>_..._-share-<id>-<rand>/),
    so this is the reliable way to guarantee an "Open on LinkedIn" link.

    Scoped via the post's own `componentkey` (XPath `preceding::` from that
    exact element) rather than matching on author name, so two posts by the
    same author can't resolve to each other's link.
    """
    if not componentkey:
        return ""
    try:
        menu_btn = page.locator(
            f'xpath=//*[@componentkey="{componentkey}"]'
            "/preceding::button[contains(@aria-label, 'menu de commandes pour le post de') "
            "or contains(@aria-label, 'Open control menu for post by')][1]"
        ).first
        if menu_btn.count() == 0:
            return ""

        menu_btn.scroll_into_view_if_needed(timeout=5000)
        menu_btn.click(timeout=5000)
        page.wait_for_timeout(400)

        copy_item = page.locator(_COPY_LINK_LOCATOR).first
        if copy_item.count() == 0:
            page.keyboard.press("Escape")
            return ""

        copy_item.click(timeout=5000)
        page.wait_for_timeout(400)
        link = page.evaluate("() => navigator.clipboard.readText()")
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)

        if link and "linkedin.com" in link:
            return link.split("?")[0]  # drop utm_*/rcm tracking params
    except Exception as exc:
        logger.debug("Link resolution failed for componentkey %s: %s", componentkey, exc)
        try:
            page.keyboard.press("Escape")
        except Exception:
            pass
    return ""


def _merge_resolved(accumulated: dict[str, Post], extractions: list[tuple[Post, str]], page) -> None:
    """Merge freshly-extracted posts into `accumulated`, resolving a real
    permalink for any post whose DOM-derived `url` is empty. Resolution runs
    at most once per post — a previously-resolved url is carried forward when
    the same post is re-extracted on a later scroll step."""
    for post, componentkey in extractions:
        if not post.url:
            prior = accumulated.get(post.urn)
            if prior and prior.url:
                post = post.model_copy(update={"url": prior.url})
            else:
                resolved = _resolve_post_url(page, componentkey)
                if resolved:
                    post = post.model_copy(update={"url": resolved})
        accumulated[post.urn] = post


class LinkedInScraper:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def scrape(self, scroll_attempts: int | None = None) -> list[Post]:
        """Fetch the LinkedIn feed with in-page scrolling to accumulate posts.

        LinkedIn uses a virtual scroller: posts leave the DOM when they scroll
        out of view. We extract after each scroll step via JS evaluation
        (no full HTML strings or lxml trees) and accumulate in a shared dict.
        scroll_attempts = number of scroll steps (each loads ~5-10 new posts).
        """
        max_scrolls = scroll_attempts if scroll_attempts is not None else self._settings.max_scroll_attempts
        cookies = load_cookies(self._settings.cookies_file)
        accumulated: dict[str, Post] = {}
        now = datetime.now(tz=timezone.utc)

        def scroll_and_collect(page) -> None:
            # Needed to read back the permalink that LinkedIn's "Copy link to
            # post" menu item writes to the clipboard (see _resolve_post_url).
            try:
                page.context.grant_permissions(["clipboard-read", "clipboard-write"])
            except Exception:
                pass

            # LinkedIn is a React SPA — wait for the first posts to render.
            try:
                page.wait_for_selector(
                    '[componentkey^="feed-commentary_"]',
                    timeout=20_000,
                )
            except Exception:
                logger.warning("Feed posts not visible after 20s — page may not have loaded")
                return

            _merge_resolved(accumulated, _extract_posts_js(page, now), page)
            logger.info("Initial extraction: %d posts", len(accumulated))

            consecutive_empty = 0
            for step in range(max_scrolls):
                prev_count = len(accumulated)

                # Snapshot the last visible post's key to detect when the virtual scroll shifts.
                last_key = page.evaluate(
                    "() => { const p = document.querySelectorAll('[componentkey^=\"feed-commentary_\"]');"
                    " return p.length ? p[p.length-1].getAttribute('componentkey') : ''; }"
                )

                # scrollIntoView puts the last post at top of viewport, then scrollBy pushes past it
                # so the loading sentinel below all posts enters the viewport and fires the
                # IntersectionObserver that triggers LinkedIn's API call for more posts.
                page.evaluate(
                    "() => { const p = document.querySelectorAll('[componentkey^=\"feed-commentary_\"]');"
                    " if (p.length) {"
                    "   p[p.length-1].scrollIntoView({ behavior: 'instant', block: 'start' });"
                    "   window.scrollBy(0, window.innerHeight * 2);"
                    " } }"
                )

                # Wait up to 7s for the virtual scroll to shift — stops early when new posts arrive.
                try:
                    page.wait_for_function(
                        f"() => {{ const p = document.querySelectorAll('[componentkey^=\"feed-commentary_\"]');"
                        f" const last = p.length ? p[p.length-1].getAttribute('componentkey') : '';"
                        f" return last !== {repr(last_key)}; }}",
                        timeout=7000,
                    )
                except Exception:
                    pass  # timeout ≠ exhausted; the feed may just be slow

                _merge_resolved(accumulated, _extract_posts_js(page, now), page)

                gained = len(accumulated) - prev_count
                logger.info("Scroll %d/%d — %d posts total (+%d)", step + 1, max_scrolls, len(accumulated), gained)

                if gained == 0:
                    consecutive_empty += 1
                    if consecutive_empty >= 2:
                        logger.info("No new posts for 2 consecutive steps — stopping early")
                        break
                else:
                    consecutive_empty = 0

            # One last live extraction — catches posts that finished loading
            # since the last scroll checkpoint, while the page is still
            # interactive enough to resolve their permalinks (the static
            # snapshot used by _extract_posts() below isn't).
            _merge_resolved(accumulated, _extract_posts_js(page, now), page)

        logger.info("Scraping LinkedIn feed (%d scroll steps)…", max_scrolls)
        try:
            page = StealthyFetcher.fetch(
                FEED_URL,
                headless=self._settings.headless,
                cookies=cookies,
                network_idle=False,
                page_action=scroll_and_collect,
                wait=500,
            )
        except Exception as exc:
            logger.error("Fetch failed: %s", exc)
            return list(accumulated.values())

        if _check_auth_failure(page):
            raise AuthenticationError(
                "LinkedIn session expired or cookies invalid. "
                "Re-export your cookies with the 'Cookie Editor' extension while logged in."
            )

        # Also extract from the final DOM snapshot to catch any remaining posts.
        for post in _extract_posts(page):
            accumulated.setdefault(post.urn, post)

        logger.info("Total unique posts: %d", len(accumulated))
        return list(accumulated.values())
