# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

**All outputs must be in English** — code, comments, docstrings, commit messages, and conversational responses. No French or other languages.

## Overview

Two cooperating systems share this repo:

1. **Scraper API** — FastAPI REST service that scrapes the LinkedIn feed, scores posts by keyword relevance, and persists them to `posts.json`. Authentication via session cookies only. Scraping uses `StealthyFetcher` (Scrapling + Patchright/Chromium headless).
2. **Decker** — Telegram bot (`bot/`) that triggers scrapes, sends new posts to Claude Code for LLM-based relevance evaluation, and lets the user triage them one card at a time (Comment / Keep / Skip / Not relevant).

## Stack

- Python 3.12+
- FastAPI + Uvicorn, Pydantic-settings + python-dotenv
- `scrapling[all]>=0.4.8` (StealthyFetcher with Patchright/Chromium)
- `mcp>=2.0.0` (MCPServer — MCP server for Claude Code integration)
- `python-telegram-bot>=20.0` (async, long-polling)
- `pytest>=8.0.0` (integration smoke tests)
- No Docker

## Commands

```bash
# Setup (run once)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
patchright install chromium          # required — without this, scrapes return 0 posts silently

# Scraper REST API
python main.py                       # listens on http://0.0.0.0:8000
# Swagger UI: http://localhost:8000/docs

# CLI scraper (bypasses the API)
python scrape.py --json
python scrape.py --attempts 1 --keywords "QA,pytest" --min-score 2 --json

# Telegram bot (Decker) — two equivalent entry points:
python telegram_bot.py               # thin shim, delegates to bot.main
python -m bot.main                   # canonical form

# MCP server (stdio, spawned automatically by Claude Code via .mcp.json)
python mcp_server.py

# Tests
pytest -q                            # all tests (skipped automatically if cookies.json absent)
pytest tests/test_smoke.py -v -s     # verbose with live logs
```

## Project structure

```
main.py              # uvicorn entry point (runs app.api:app)
scrape.py            # standalone CLI scraper (no server needed)
mcp_server.py        # MCP server — exposes scraper as tools for Claude Code (stdio)
telegram_bot.py      # thin shim → delegates to bot.main (either entry point works)

app/                 # Scraper REST API
  api.py             # ALL FastAPI routes + lifespan singletons
  config.py          # Settings (pydantic-settings), save_override(), get_settings()
  cookies.py         # load_cookies() — converts Cookie Editor JSON for Playwright
  models.py          # Pydantic models: Post, ScrapeResult, ScrapeRequest, ...
  scraper.py         # LinkedInScraper, _extract_posts(), AuthenticationError
  scorer.py          # score_post() / score_posts() — keyword-based, pure functions
  storage.py         # PostStorage — JSON file (posts.json) with upsert and dedup

bot/                 # Decker — the Telegram bot
  main.py            # bot entry point: builds Application, registers handlers, runs polling
  config.py          # BOT_TOKEN + AUTHORIZED_USER_ID from env — distinct from app/config.py
  auth.py            # @restricted decorator — silently drops updates from unknown users
  formatting.py      # shared helpers (format_age, etc.) for Telegram message rendering
  relevance.py       # LLM-based scoring: calls `claude -p` as a subprocess to judge posts
                     #   ↳ distinct from app/scorer.py which is pure keyword matching
  handlers/
    __init__.py      # register_handlers() — wires all CommandHandler / CallbackQueryHandler
    start.py         # /start → main menu keyboard
    feed.py          # feed:scan — triggers scrape + Claude eval + browse-card triage flow
    found.py         # found:list — paginated list of Claude-relevant posts
    config.py        # config:show / config:edit + text handler for interests input
  storage/           # bot-side persistence (bot_posts.json, bot_settings.json)
                     #   ↳ distinct from app/storage.py which backs the REST API
    interfaces.py    # SettingsStore + PostsStore ABCs
    json_store.py    # SettingsStore backed by bot_settings.json
    json_posts_store.py  # PostsStore backed by bot_posts.json

tests/
  test_smoke.py      # integration tests: real scrape via cookies.json; auto-skipped if absent
pytest.ini           # pythonpath=. + live log config

.mcp.json            # MCP server registration for Claude Code (absolute paths)
cookies.json         # LinkedIn session cookies (git-ignored, create manually)
posts.json           # scraper-side persisted posts (git-ignored, created automatically)
bot_posts.json       # bot-side persisted posts with triage state (git-ignored)
bot_settings.json    # bot-side interests config (git-ignored)
config_override.json # runtime config overrides (git-ignored, written by PUT /config/interests)
.env                 # copy from .env.example (git-ignored)
```

## Architecture

### Scraper API (`app/`)

`app/api.py` owns four module-level singletons (`_settings`, `_storage`, `_scraper`, `_scrape_lock`) initialized in the FastAPI `lifespan` context.

`POST /scrape` runs `LinkedInScraper.scrape()` in a thread via `loop.run_in_executor` (Patchright is synchronous). `_scrape_lock` prevents concurrent scrapes (returns 409).

**Config layering**: `.env` → `config_override.json` → runtime. `PUT /config/interests` and `update_interests` (MCP) write to `config_override.json` and call `get_settings.cache_clear()`.

**Keyword scoring** (`app/scorer.py`): pure function, each keyword occurrence adds `len(keyword.split())` points. Applied at scrape time and re-applied on every `PUT /config/interests`.

**Post deduplication**: `urn:li:activity:ID` when the comment count renders, otherwise `urn:li:post:hash:HEX` (MD5 of author + text[:200]). `PostStorage.upsert_posts()` upgrades hash URNs to real ones when they arrive.

### MCP server (`mcp_server.py`)

Mirrors the singleton pattern (`_settings`, `_storage`, `_scraper`, `_scrape_lock`) at module level. Uses `threading.Lock` (not asyncio) because `scrape_feed` dispatches via `anyio.to_thread.run_sync`. The other four tools (`get_posts`, `get_interesting_posts`, `update_interests`, `get_config`) are plain `def`. Registered via `.mcp.json`; Claude Code spawns it as a stdio subprocess.

### Decker bot (`bot/`)

Entry: `bot/main.py` builds the `Application`, calls `register_handlers()`, runs long-polling.

**LLM relevance** (`bot/relevance.py`): `evaluate_posts()` calls `claude -p <prompt> --output-format json` as a subprocess. It sends a batch of post excerpts and receives `[{urn, relevant, score, reason}]`. This is intentionally separate from `app/scorer.py` — keyword matching is fast and used by the REST API; LLM evaluation is slow and used only by the bot. Call from a thread executor — it blocks.

**Triage flow** (`bot/handlers/feed.py`): `feed:scan` callback scrapes, runs LLM eval, then presents posts one card at a time. Each card is edited in place; actions are Comment / Keep / Skip / Not relevant. State is persisted immediately via `PostsStore`.

**Storage split**:
- `app/storage.py` / `posts.json` — owned by the REST API and MCP server
- `bot/storage/` / `bot_posts.json` + `bot_settings.json` — owned exclusively by the bot; includes triage state (`notified`, `relevant`, `commented`, `kept`, `ignored`)

**Auth**: `@restricted` in `bot/auth.py` silently drops any update not from `TELEGRAM_USER_ID`.

## Code conventions

- All FastAPI endpoints are `async def`; scraping itself runs in a thread executor
- `StealthyFetcher.fetch()` always called with `headless=True`, `network_idle=True`
- Cookies loaded via `load_cookies()` from `app/cookies.py` — `sameSite` intentionally omitted to avoid Playwright rejecting `sameSite="None"` without `secure=True`
- All configurable values go through `Settings` — never `os.environ` directly (except `bot/config.py` which uses `os.environ` directly for the two bot-only vars)
- `HTTPException` codes: 401 for bad cookies, 409 for concurrent scrape, 503 for LinkedIn unreachable

## Critical rules

- **Never commit** `cookies.json`, `posts.json`, `bot_posts.json`, `bot_settings.json`, `config_override.json`, `.env`
- **Do not replace the scraping engine**: Scrapling/StealthyFetcher is intentional for bypassing LinkedIn anti-bot — do not migrate to requests/httpx/aiohttp
- **Storage stays file-based** (JSON) unless explicitly requested otherwise
- **Do not merge `bot/relevance.py` and `app/scorer.py`** — they serve different purposes (LLM vs keyword), different callers, and different performance profiles
- **MCP server registration belongs in `.mcp.json`**, not in `.claude/settings.json`
- **`.mcp.json` uses absolute paths** — update `command` and `cwd` if the project moves

## Cookie management

The critical cookie is `li_at` (session token). `load_cookies()` warns if it's missing. To renew:
1. Log into LinkedIn in Chrome/Firefox
2. Install **Cookie Editor** extension → Export as JSON
3. Save as `cookies.json` at project root, or upload via `POST /config/cookies`

Expired cookies: logs show `302 → /uas/login`. Valid cookies: `307 → 200` on `/feed/`.

## REST API endpoints

| Method | Route | Notes |
|--------|-------|-------|
| POST | `/scrape` | Body: `{"scroll_attempts": N}` (optional). Returns `ScrapeResult`. |
| GET | `/posts` | Query: `limit`, `offset`, `min_score` |
| GET | `/posts/interesting` | Query: `threshold` (defaults to `relevance_threshold`) |
| GET | `/config` | Full active config |
| PUT | `/config/interests` | Body: `{"keywords": [...], "threshold": N}`. Re-scores all stored posts. |
| POST | `/config/cookies` | Multipart file upload (Cookie Editor JSON format) |
| GET | `/health` | Returns `{"status": "ok", "version": "..."}` |
