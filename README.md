# 🚀 YARB — Yet Another Resume Builder
### *The precision of LaTeX, the intelligence of AI.*

[![CI](https://github.com/vincentferreira/latex-cv-builder/actions/workflows/ci.yml/badge.svg)](https://github.com/vincentferreira/latex-cv-builder/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/vincentferreira/latex-cv-builder/graph/badge.svg)](https://codecov.io/gh/vincentferreira/latex-cv-builder)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js ≥ 23](https://img.shields.io/badge/node-%E2%89%A523-brightgreen)](https://nodejs.org)

A web app to build, edit, and export professional resumes as PDF, and to track job applications with per-CV ATS scoring — powered by a LaTeX template and AI extraction.

## Features

### CV builder
- **Visual editor** with real-time preview — no LaTeX knowledge required
- **Bilingual** (FR / EN) — switch language with one click, all fields are translated independently
- **AI import** — drop an existing PDF resume and let Gemini or Claude extract all the data
- **PDF export** — compiles the LaTeX template locally via `pdflatex`
- **LaTeX export** — copy the raw `.tex` source to use in Overleaf or any LaTeX editor
- **JSON save / load** — persist your CV data as a portable JSON file
- **Photo support** — include a profile picture in the generated PDF
- **CVthèque** — keep multiple named CVs (e.g. tailored per role or language) and switch between them from one library view

### Job pipeline
- **Postes tracker** — log job postings (company, title, location, work mode, contract, salary, source) and move them through a pipeline of statuses from lead to offer/rejected
- **Table & Kanban views** — browse jobs as a filterable table or drag cards across status columns; the view choice is remembered between visits
- **AI import** — paste a raw job posting and let Gemini or Claude extract the structured fields; you always review and edit before saving, nothing is saved silently
- **ATS scoring** — associate a CV with a job and score the match (overall score, matched/missing keywords, section-by-section breakdown, formatting checks) using the same engine as the standalone ATS Checker
- **Staleness detection** — a job's score is flagged as out of date as soon as its linked CV changes, so you know to recalculate before relying on it
- **Duplicate CV & adapt** — spin off a copy of the CV attached to a job to tailor it for that specific posting without touching the original
- **Insights** — score distribution across your active jobs and the keywords most often missing from your CVs, to see what's worth improving
- **Follow-up reminders** — set a next-action date per job; a KPI tile surfaces everything due

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| AI extraction | Google Gemini (`@google/genai`), Anthropic Claude (`@anthropic-ai/sdk`) |
| PDF compilation | Express server → `pdflatex` |

## Prerequisites

- **Node.js** ≥ 23
- **LaTeX distribution** with `pdflatex` (e.g. [MacTeX](https://www.tug.org/mactex/), [TeX Live](https://tug.org/texlive/))
  The server expects `pdflatex` at `/Library/TeX/texbin/pdflatex` (macOS default). Override with the `PDFLATEX_PATH` environment variable for other systems.
- An **API key** for at least one AI provider:
  - [Google AI Studio](https://aistudio.google.com/app/apikey) → Gemini
  - [Anthropic Console](https://console.anthropic.com/) → Claude

## Getting started

```bash
# 1. Clone
git clone https://github.com/VincentFerreira/YARB-Resume-Builder.git
cd YARB-Resume-Builder

# 2. Install dependencies
npm install

# 3. Configure API keys
cp .env.local.example .env.local
# Edit .env.local and fill in your keys

# 4. Start both servers (Vite on :3000, LaTeX compiler on :3001)
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Create a `.env.local` file at the root (already gitignored):

```env
GEMINI_API_KEY=your_gemini_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

Both keys are optional — you only need the one(s) for the AI provider(s) you want to use.

Setting `VITE_ATS_PROVIDER=fake` exposes an offline, deterministic "🧪 Fake" provider option (job extraction and ATS scoring, no network call) alongside Gemini/Claude — used by the e2e test suite, and useful for trying the app without API keys.

## Usage

### Building a CV

1. **Fill in** your details in the left panel (personal info, skills, experience, education)
2. **Switch language** with FR / EN buttons to edit the translated version
3. **Import** an existing PDF resume to auto-fill all fields via AI
4. **Download PDF** to compile and save the result
5. **Export LaTeX** to get the raw `.tex` source for further customization
6. **Save** the CV to your CVthèque (`/cvs`) to reuse it later or attach it to a job

### Tracking a job search

1. Go to **Postes** (`/jobs`) and either paste a job posting via **Import** (AI-extracted, editable before saving) or fill in **New job** manually
2. Move the job through the pipeline — from the status dropdown on its detail page, or by dragging its card in the **Kanban** view
3. Assign one of your CVthèque CVs to the job and **Compute score** to get an ATS match score and a keyword breakdown
4. If you edit that CV later, the job's score is marked stale — **Recalculate** to refresh it, or **Duplicate CV & adapt** to tailor a copy specifically for that job
5. Check **Insights** (`/insights`) for a score distribution and the keywords most commonly missing across your active jobs

## Project structure

```
├── App.tsx                  # Root component — router shell
├── pages/                   # Route-level screens (EditorPage, CvsPage, JobsPage, JobDetailPage, InsightsPage)
├── components/
│   ├── Editor.tsx           # CV form editor
│   ├── Preview.tsx          # Live CV preview
│   ├── jobs/                # Job pipeline UI (table, kanban, detail, import dialog, form)
│   ├── matches/              # Shared ATS scoring UI (AtsReport, ScoreBadge)
│   └── layout/               # App shell (nav, header)
├── store/                   # Zustand stores (cvsStore, jobsStore)
├── services/
│   ├── aiService.ts         # Gemini + Claude PDF/job extraction, ATS scoring
│   ├── latexService.ts      # LaTeX template generation
│   ├── pdfService.ts        # PDF download via compilation server
│   ├── cvStorageService.ts  # CV CRUD (via /api/cvs)
│   └── jobService.ts        # Job CRUD (via /api/jobs)
├── server.js, server/        # Express server — pdflatex compilation, CV/Job persistence
├── types.ts                 # TypeScript interfaces (CVData, Job, AtsResult, etc.)
└── constants.ts             # Default CV data
```

Jobs and CVs persist as JSON files under `data/` (`YARB_DATA_DIR` to override), one file per record — no database.

## Running with Docker

If you don't want to install Node.js or a LaTeX distribution locally, Docker handles everything.

### Option A — `docker compose` (recommended for development, live-reload)

`docker build`'s `COPY . .` only snapshots your code at build time — restarting a container from that image won't pick up later edits. `docker-compose.yml` instead bind-mounts the project directory into the container, so the Vite dev server (already running in the image via `npm start`) picks up file changes immediately, same as running `npm run dev` locally.

```bash
docker compose up --build
```

- First run (or after changing `package.json`), use `--build` to rebuild the image; subsequent runs can just be `docker compose up`.
- Your local files are mounted read-write into the container; `node_modules` stays the one installed inside the image (see the anonymous volume in `docker-compose.yml`) so it doesn't get shadowed by your host's.
- Requires a `.env.local` file (see [Getting started](#getting-started)) — `docker-compose.yml` reads it via `env_file`.

### Option B — plain `docker run` (one-off, no live-reload)

Rebuild the image (`docker build -t yarb .`) after every code change — there's no volume, so the container only ever sees the code that was copied in at build time.

```bash
# Build the image once
docker build -t yarb .
```

If you already have a `.env.local` file configured, you can use it directly:

```bash
docker run --rm -it -p 3000:3000 -p 3001:3001 --env-file .env.local yarb
```

Otherwise, you can pass `ANTHROPIC_API_KEY` and/or `GEMINI_API_KEY`:

```bash
docker run --rm -it -p 3000:3000 -p 3001:3001 \
  -e ANTHROPIC_API_KEY=your_anthropic_api_key \
  -e GEMINI_API_KEY=your_gemini_api_key \
  yarb
```

To persist saved CVs between runs, mount the `data` directory:

```bash
docker run --rm -it -p 3000:3000 -p 3001:3001 --env-file .env.local -v "$(pwd)/data:/yarb/data" yarb
```

> **Upgrading from an older version?** Saved CVs used to live under `cvs/` (mounted via
> `-v "$(pwd)/cvs:/yarb/cvs"`). The app now stores data under `data/` (configurable via
> `YARB_DATA_DIR`) and migrates any existing `cvs/*.json` files into `data/cvs/` automatically
> on first start — the old `cvs/` directory is left untouched, so update your mount to
> `-v "$(pwd)/data:/yarb/data"` to persist new data going forward.

### Open the application

Open [http://localhost:3000](http://localhost:3000).

## Contributing

Pull requests are welcome. For larger changes, open an issue first to discuss what you'd like to change.

## License

[MIT](LICENSE)
