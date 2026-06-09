# Decker Agent

Decker Agent is your LinkedIn presence co-pilot. It silently monitors your feed, surfaces the posts most worth engaging with based on your interests, evaluates them with an LLM to filter out noise, and helps you draft sharp, contextual comments — so you show up consistently on LinkedIn without spending hours scrolling.

Instead of opening LinkedIn and getting lost, you open Telegram: Decker has already scraped your feed, ranked the posts, run them through Claude to identify the ones where your voice adds value, and queued them up for you one card at a time. You read, decide — Comment / Keep / Skip / Not relevant — and move on. The research is done; you just bring the insight.

The system is built around two cooperating components:

- **Scraper API** — a FastAPI service that drives a real Chromium browser (via Scrapling/Patchright) to scrape your LinkedIn feed without triggering anti-bot protections, scores posts by keyword relevance, and persists them locally.
- **Decker bot** — a Telegram bot that orchestrates the full workflow: trigger a scrape, send posts to Claude for LLM-based relevance evaluation, present them as triage cards, and help you craft comments directly from the chat.

It also ships an **MCP server** so Claude Code can call the scraper directly as tools — useful for ad-hoc exploration or scripting from a Claude Code session.

```
POST /scrape             → trigger a LinkedIn feed scrape
GET  /posts              → list all saved posts
GET  /posts/interesting  → posts above the relevance threshold
GET  /config             → active configuration
PUT  /config/interests   → update interest keywords
POST /config/cookies     → upload a new cookies file
GET  /health             → API status
```

The scraper uses [Scrapling](https://github.com/D4Vinci/Scrapling) with `StealthyFetcher` (Patchright/Chromium headless) to bypass LinkedIn's anti-bot protections. Authentication is exclusively via session cookies.

## Requirements

- Python 3.12+
- Chromium (installed via Patchright, see below)

## Installation

```bash
# 1. Create and activate the virtualenv
python -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Install the Chromium browser (required)
patchright install chromium
```

> **Important**: without `patchright install chromium`, all scrapes fail silently with 0 posts found.

## Configuration

Copy `.env.example` to `.env` and adjust:

```env
COOKIES_FILE=cookies.json          # path to the cookies file
POSTS_FILE=posts.json              # local posts database
INTEREST_KEYWORDS=QA,testing,quality assurance,automation,selenium,pytest
RELEVANCE_THRESHOLD=2.0            # minimum score for /posts/interesting
MAX_SCROLL_ATTEMPTS=3              # number of scraping passes
HEADLESS=true                      # false to show the browser
```

Settings can also be overridden via `config_override.json` (automatically created by `PUT /config/interests`).

## Cookie-based Authentication

The scraper uses LinkedIn session cookies. **They must be renewed regularly** (Cloudflare's `__cf_bm` cookie expires in ~30 minutes, and the full session expires after a few weeks).

### Getting valid cookies

1. Log into LinkedIn in Chrome/Firefox
2. Install the **Cookie Editor** extension ([Chrome](https://chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm) / [Firefox](https://addons.mozilla.org/en/firefox/addon/cookie-editor/))
3. On `linkedin.com`, open Cookie Editor → **Export → Export as JSON**
4. Save the file as `cookies.json` at the project root

The critical cookie is `li_at` (session token). The `__cf_bm` and `lidc` cookies expire quickly but remain useful as long as they are sent.

### Checking cookie validity

A scrape returning `error: "LinkedIn session expired or cookies invalid."` means the cookies are no longer accepted. Renew them by following the steps above.

**Expired cookie indicators in logs:**
```
Fetched (302) <GET https://www.linkedin.com/feed/>
Fetched (307) <GET https://www.linkedin.com/uas/login?...>
Fetched (200) <GET https://www.linkedin.com/login/...>
```

**Valid cookie indicators:**
```
Fetched (307) <GET https://www.linkedin.com/feed/>
Fetched (200) <GET https://www.linkedin.com/feed/>
```

### Upload via API (without restarting)

```bash
curl -X POST http://localhost:8000/config/cookies \
  -F "file=@/path/to/new_cookies.json"
```

## Starting the Server

```bash
python main.py
```

The API listens on `http://0.0.0.0:8000`. Interactive Swagger documentation: `http://localhost:8000/docs`.

## MCP Server (Claude Code integration)

The project includes an MCP (Model Context Protocol) server that lets Claude Code call the scraper directly as tools — no need to run the REST API.

### Setup

`.mcp.json` is gitignored because it contains machine-specific absolute paths. Create it from the provided example:

```bash
cp .mcp.json.example .mcp.json
# then edit the three paths to match your local clone
```

When you open this project in Claude Code, it will detect the file and ask you to approve the `linkedin-scraper` server. Approve it once, and the tools become available in every session.

### Available tools

| Tool | Arguments | Description |
|------|-----------|-------------|
| `scrape_feed` | `scroll_attempts?` | Trigger a LinkedIn scrape, returns scored posts |
| `get_posts` | `limit=50`, `min_score=0.0` | Read posts from the local cache |
| `get_interesting_posts` | `threshold?` | Posts at or above the relevance threshold |
| `update_interests` | `keywords`, `threshold?` | Update keywords + re-score all stored posts |
| `get_config` | — | View the active configuration |

### Usage examples (from a Claude Code session)

```
Scrape LinkedIn with 2 passes and show me the most relevant posts.
→ calls scrape_feed(scroll_attempts=2), then get_interesting_posts()

Update my keywords to ["Python", "testing", "CI/CD"] with a threshold of 3.
→ calls update_interests(keywords=["Python", "testing", "CI/CD"], threshold=3.0)
```

### Manual launch (for testing)

```bash
# The server communicates via stdio — useful to verify it starts cleanly
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}' \
  | .venv/bin/python mcp_server.py
```

> **Note**: `.mcp.json` is gitignored. Copy `.mcp.json.example` to `.mcp.json` and replace the placeholder paths with your actual project directory before using Claude Code integration.

## Usage

### Running a scrape

```bash
# With the default number of passes (MAX_SCROLL_ATTEMPTS)
curl -X POST http://localhost:8000/scrape

# With a custom number of passes
curl -X POST http://localhost:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{"scroll_attempts": 5}'
```

Response:
```json
{
  "posts_found": 6,
  "posts_new": 6,
  "duration_seconds": 86.7,
  "error": null
}
```

### Reading posts

```bash
# All posts, sorted by descending score
curl "http://localhost:8000/posts?limit=50&offset=0"

# Only relevant posts (above the threshold)
curl "http://localhost:8000/posts/interesting"

# With a custom threshold
curl "http://localhost:8000/posts/interesting?threshold=5.0"
```

Example post returned:
```json
{
  "urn": "urn:li:activity:7468153814831996928",
  "author": "Julian LUNEAU 🧬",
  "text": "France just signed a massive deal...",
  "reactions": 1,
  "scraped_at": "2026-06-04T19:26:18Z",
  "score": 0.0,
  "matched_keywords": [],
  "url": "https://www.linkedin.com/feed/update/urn:li:activity:7468153814831996928/"
}
```

> **Note**: if no comments are rendered on the page for a given post, the URN will be in the format `urn:li:post:hash:{hex}` and the URL will be empty. The URL becomes available once a real LinkedIn URN is retrieved in a subsequent scrape.

### Managing interest keywords

```bash
# View the current config
curl http://localhost:8000/config

# Update keywords (re-scores all existing posts)
curl -X PUT http://localhost:8000/config/interests \
  -H "Content-Type: application/json" \
  -d '{"keywords": ["QA", "automation", "Playwright", "pytest"], "threshold": 3.0}'
```

## Scoring Algorithm

Each post receives a score based on the frequency and weight of keywords found in its text:

- Each keyword occurrence adds `number_of_words_in_keyword` points
- A multi-word keyword (e.g. "quality assurance") is worth more than a single word
- Posts are sorted by descending score
- `score = 0` if no keyword matches

Example: the text contains "testing" (×2) and "quality assurance" (×1):
- "testing" (1 word) × 2 occurrences = 2 pts
- "quality assurance" (2 words) × 1 occurrence = 2 pts
- **total score = 4.0** → appears in `/posts/interesting` with `RELEVANCE_THRESHOLD=2.0`

## Post Identifiers (URN)

LinkedIn migrated its DOM in 2025 and no longer directly exposes activity URNs in post containers. The scraper uses a hybrid strategy:

1. **Real URN** (`urn:li:activity:ID`): extracted from comment metadata when comments are rendered on the page. Allows building the direct post URL.
2. **Hash URN** (`urn:li:post:hash:HEX`): generated from `MD5(author + text[:200])` when no real URN is available. Stable across scrapes for the same content, but without a LinkedIn URL.

## Persistence

Posts are saved to `posts.json` (path configurable via `POSTS_FILE`). Re-scrapes upsert existing posts with URN-based deduplication. Scores are recalculated on every `PUT /config/interests`.

## Project Structure

```
linkedin_scraper/
├── main.py              # uvicorn entry point (REST API)
├── scrape.py            # standalone CLI scraper
├── mcp_server.py        # MCP server (Claude Code integration)
├── app/
│   ├── api.py           # FastAPI routes
│   ├── config.py        # Settings (pydantic-settings + .env)
│   ├── cookies.py       # cookie loading and conversion
│   ├── models.py        # Pydantic models
│   ├── scraper.py       # scraping logic (Scrapling/Patchright)
│   ├── scorer.py        # keyword scoring
│   └── storage.py       # JSON persistence
├── .mcp.json            # MCP server registration for Claude Code
├── cookies.json         # LinkedIn cookies (to be created, git-ignored)
├── posts.json           # local database (created automatically)
├── .env                 # local configuration (to be created from .env.example)
└── requirements.txt
```

## Troubleshooting

| Symptom | Likely Cause | Solution |
|---------|-------------|---------|
| `error: "LinkedIn session expired..."` | Expired or invalid cookies | Re-export cookies via Cookie Editor |
| `posts_found: 0` without error, duration ~0.3s | Chromium not installed | `patchright install chromium` |
| `posts_found: 0` without error, duration ~8s | LinkedIn DOM changed or cookies rejected | Check server logs |
| Posts with `url: ""` | URN not available (no visible comments) | Normal — the URN will be resolved on the next scrape if comments appear |
| Duplicates of the same post | Post scraped with hash URN then real URN on two passes | Known — resolved by re-scraping (upsert will consolidate) |
| Port 8000 already in use | Instance already running | `lsof -i :8000` then `kill <PID>` |

## Technical Notes

- The `sameSite` field is **intentionally omitted** during cookie conversion. Playwright/Patchright rejects cookies with `sameSite="None"` without `secure=True`, which causes silent authentication failures. Without this field, the browser sends all cookies correctly.
- Each scraping pass (`scroll_attempts`) is a full page load with an increasing delay (5s, 7s, 9s, …) to let the feed load.
- LinkedIn renders between 3 and 8 posts per page load depending on the session context and network speed.
