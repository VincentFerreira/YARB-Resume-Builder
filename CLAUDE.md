# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

REST API that scrapes the LinkedIn feed, scores posts by relevance, and exposes them via FastAPI. Authentication is exclusively by session cookies. Scraping uses `StealthyFetcher` (Scrapling + Patchright/Chromium headless).

## Stack

- Python 3.12+
- FastAPI + Uvicorn, Pydantic-settings + python-dotenv
- `scrapling[all]>=0.4.3` (StealthyFetcher with Patchright/Chromium)
- `mcp>=1.0.0` (FastMCP — MCP server for Claude Code integration)
- No Docker, no test suite yet

## Commands

```bash
# Setup (run once)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
patchright install chromium          # required — without this, scrapes return 0 posts silently

# Run the REST API
python main.py                       # listens on http://0.0.0.0:8000
# Swagger UI: http://localhost:8000/docs

# CLI scraper (bypasses the API)
python scrape.py                     # uses config defaults
python scrape.py --attempts 1 --keywords "QA,pytest" --min-score 2 --json

# Smoke-test the MCP server (expects a JSON-RPC response on stdout)
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}' \
  | .venv/bin/python mcp_server.py
```

## Actual project structure

```
main.py              # uvicorn entry point (runs app.api:app)
scrape.py            # standalone CLI scraper (no server needed)
mcp_server.py        # MCP server — exposes scraper as tools for Claude Code (stdio transport)
app/
  api.py             # ALL FastAPI routes + lifespan (singletons initialized here)
  config.py          # Settings (pydantic-settings), save_override(), get_settings()
  cookies.py         # load_cookies() — converts Cookie Editor JSON for Playwright
  models.py          # Pydantic models: Post, ScrapeResult, ScrapeRequest, ...
  scraper.py         # LinkedInScraper, _extract_posts(), AuthenticationError
  scorer.py          # score_post() and score_posts() — pure functions
  storage.py         # PostStorage — JSON file with upsert and dedup
.mcp.json            # MCP server registration for Claude Code (contains absolute paths)
cookies.json         # LinkedIn session cookies (git-ignored, must be created manually)
posts.json           # persisted posts (git-ignored, created automatically)
config_override.json # runtime config overrides written by PUT /config/interests (git-ignored)
.env                 # copy from .env.example (git-ignored)
```

## Architecture

`app/api.py` owns four module-level singletons (`_settings`, `_storage`, `_scraper`, `_scrape_lock`) initialized in the FastAPI `lifespan` context. All routes mutate these directly.

`POST /scrape` runs `LinkedInScraper.scrape()` in a thread via `loop.run_in_executor` (Patchright is synchronous). A `_scrape_lock` prevents concurrent scrapes (returns 409 if already running).

**MCP server** (`mcp_server.py`) mirrors the same singleton pattern (`_settings`, `_storage`, `_scraper`, `_scrape_lock`) but at module level. Uses `threading.Lock` (not asyncio) because `scrape_feed` dispatches to a real OS thread via `anyio.to_thread.run_sync`. The other four tools (`get_posts`, `get_interesting_posts`, `update_interests`, `get_config`) are plain `def` — they complete in milliseconds. Registered via `.mcp.json`; Claude Code spawns it as a stdio subprocess.

**Config layering**: `.env` → `config_override.json` → runtime. `PUT /config/interests` (and `update_interests` in the MCP server) write to `config_override.json` and call `get_settings.cache_clear()` to bust the `@lru_cache`.

**Scoring**: `score_post(post, keywords) -> (float, list[str])` — pure function. Each keyword occurrence adds `len(keyword.split())` points (multi-word keywords worth more). Applied at scrape time and re-applied on every `PUT /config/interests`.

**Post deduplication**: Posts get `urn:li:activity:ID` when comments are rendered on the page, otherwise a hash URN `urn:li:post:hash:HEX` (MD5 of author + text[:200]). `PostStorage.upsert_posts()` upgrades hash entries to real URNs when they arrive.

## Code conventions

- All FastAPI endpoints are `async def`; scraping itself runs in a thread executor
- `StealthyFetcher.fetch()` always called with `headless=True`, `network_idle=True`
- Cookies loaded via `load_cookies()` from `app/cookies.py` — `sameSite` is intentionally omitted to avoid Playwright rejecting `sameSite="None"` without `secure=True`
- All configurable values go through `Settings` — never `os.environ` directly
- `HTTPException` with appropriate codes: 401 for bad cookies, 409 for concurrent scrape, 503 for LinkedIn unreachable

## Critical rules

- **Never commit** `cookies.json`, `posts.json`, `config_override.json`, `.env`
- **Do not replace the scraping engine**: Scrapling/StealthyFetcher is intentional for bypassing LinkedIn anti-bot protections — do not migrate to requests/httpx/aiohttp
- **Storage stays file-based** (JSON) unless explicitly requested otherwise
- **MCP server registration belongs in `.mcp.json`**, not in `.claude/settings.json` (which does not accept a `mcpServers` key)
- **`.mcp.json` uses absolute paths** — update `command` and `cwd` if the project moves or is cloned on a new machine

## Cookie management

The critical cookie is `li_at` (session token). `load_cookies()` warns if it's missing. To renew:
1. Log into LinkedIn in Chrome/Firefox
2. Install **Cookie Editor** extension → Export as JSON
3. Save as `cookies.json` at project root, or upload via `POST /config/cookies`

Expired cookies show in logs as `302 → /uas/login` redirects. Valid cookies show `307 → 200` on `/feed/`.

## Endpoints

| Method | Route | Notes |
|--------|-------|-------|
| POST | `/scrape` | Body: `{"scroll_attempts": N}` (optional). Returns `ScrapeResult`. |
| GET | `/posts` | Query: `limit`, `offset`, `min_score` |
| GET | `/posts/interesting` | Query: `threshold` (defaults to `relevance_threshold`) |
| GET | `/config` | Full active config |
| PUT | `/config/interests` | Body: `{"keywords": [...], "threshold": N}`. Re-scores all stored posts. |
| POST | `/config/cookies` | Multipart file upload (Cookie Editor JSON format) |
| GET | `/health` | Returns `{"status": "ok", "version": "..."}` |
