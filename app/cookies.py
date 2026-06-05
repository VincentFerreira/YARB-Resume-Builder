import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

def _convert_cookie(raw: dict) -> dict:
    # Playwright requires sameSite="None" to be paired with secure=True.
    # Since we only need the browser to *send* these cookies (not set them),
    # omitting sameSite is the safest approach — Playwright defaults to "Lax".
    return {
        "name": raw["name"],
        "value": raw["value"],
        "domain": raw.get("domain", ""),
        "path": raw.get("path", "/"),
    }


def load_cookies(path: str) -> list[dict]:
    data = json.loads(Path(path).read_text())
    cookies = [_convert_cookie(c) for c in data]
    names = {c["name"] for c in cookies}
    if "li_at" not in names:
        logger.warning(
            "Cookie 'li_at' not found in %s — LinkedIn session will likely fail. "
            "Export your cookies with the 'Cookie Editor' browser extension while logged in.",
            path,
        )
    else:
        logger.info("Loaded %d cookies from %s (li_at present)", len(cookies), path)
    return cookies
