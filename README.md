# 🚀 YARB — Yet Another Resume Builder
### *The precision of LaTeX, the intelligence of AI.*

[![CI](https://github.com/vincentferreira/latex-cv-builder/actions/workflows/ci.yml/badge.svg)](https://github.com/vincentferreira/latex-cv-builder/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/vincentferreira/latex-cv-builder/graph/badge.svg)](https://codecov.io/gh/vincentferreira/latex-cv-builder)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js ≥ 23](https://img.shields.io/badge/node-%E2%89%A523-brightgreen)](https://nodejs.org)

A web app to build, edit, and export professional resumes as PDF — powered by a LaTeX template and AI extraction.

## Features

- **Visual editor** with real-time preview — no LaTeX knowledge required
- **Bilingual** (FR / EN) — switch language with one click, all fields are translated independently
- **AI import** — drop an existing PDF resume and let Gemini or Claude extract all the data
- **PDF export** — compiles the LaTeX template locally via `pdflatex`
- **LaTeX export** — copy the raw `.tex` source to use in Overleaf or any LaTeX editor
- **JSON save / load** — persist your CV data as a portable JSON file
- **Photo support** — include a profile picture in the generated PDF

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| AI extraction | Google Gemini (`@google/genai`), Anthropic Claude (`@anthropic-ai/sdk`) |
| PDF compilation | Express server → `pdflatex` |

## Prerequisites

- **Node.js** ≥ 18
- **LaTeX distribution** with `pdflatex` (e.g. [MacTeX](https://www.tug.org/mactex/), [TeX Live](https://tug.org/texlive/))  
  The server expects `pdflatex` at `/Library/TeX/texbin/pdflatex` (macOS default). Edit `server.js` for other paths.
- An **API key** for at least one AI provider:
  - [Google AI Studio](https://aistudio.google.com/app/apikey) → Gemini
  - [Anthropic Console](https://console.anthropic.com/) → Claude

## Getting started

```bash
# 1. Clone
git clone https://github.com/vincentferreira/latex-cv-builder.git
cd latex-cv-builder

# 2. Install dependencies
npm install

# 3. Configure API keys
cp .env.local.example .env.local
# Edit .env.local and fill in your keys

# 4. Start both servers
npm run server   # LaTeX compilation server on :3001
npm run dev      # Vite dev server on :3000
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Create a `.env.local` file at the root (already gitignored):

```env
GEMINI_API_KEY=your_gemini_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

Both keys are optional — you only need the one(s) for the AI provider(s) you want to use.

## Usage

1. **Fill in** your details in the left panel (personal info, skills, experience, education)
2. **Switch language** with FR / EN buttons to edit the translated version
3. **Import** an existing PDF resume to auto-fill all fields via AI
4. **Download PDF** to compile and save the result
5. **Export LaTeX** to get the raw `.tex` source for further customization

## Project structure

```
├── App.tsx                  # Root component, toolbar actions
├── components/
│   ├── Editor.tsx           # Left panel — form editor
│   └── Preview.tsx          # Right panel — live preview
├── services/
│   ├── aiService.ts         # Gemini + Claude PDF extraction
│   ├── latexService.ts      # LaTeX template generation
│   └── pdfService.ts        # PDF download via compilation server
├── server.js                # Express server — runs pdflatex
├── types.ts                 # TypeScript interfaces (CVData, etc.)
└── constants.ts             # Default CV data
```

## Contributing

Pull requests are welcome. For larger changes, open an issue first to discuss what you'd like to change.

## License

[MIT](LICENSE)
