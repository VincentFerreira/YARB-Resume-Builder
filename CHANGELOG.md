# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- ATS Checker: keyword frequency display, estimated post-improvement score, formatting checks, accordion recommendations
- Bilingual CV support (FR / EN) with per-field language switching via `lib/i18n.ts`
- JSON save/load with automatic migration from single-language format
- PDF compilation via local Express server (`server.js`) with photo support
- `npm start` script to launch Vite dev server and LaTeX server concurrently
- `.nvmrc` to pin Node.js version (23)
- `LICENSE` file (MIT)
- `CONTRIBUTING.md` with setup guide and project structure
- Dynamic `html[lang]` attribute that follows the active CV language
- Rate limiting on `/compile` endpoint (10 req/min)
- `PDFLATEX_PATH` environment variable to override the pdflatex binary path

### Fixed
- English translation for `previewLanguages` was "LANGUES" (French) — corrected to "LANGUAGES"
- Missing TypeScript type definitions for React (added `@types/react`, `@types/react-dom`)
- Gemini `response.text` could be `undefined` — added null guard before JSON.parse
- Removed unused `isAnalyzing` and `missingImportant` variables caught by `noUnusedLocals`

### Security
- Fixed 10 npm audit vulnerabilities (1 critical, 5 high, 3 moderate, 1 low) via `npm audit fix`
- CORS restricted to `localhost:3000` / `127.0.0.1:3000` (was open wildcard)
- TypeScript strict mode enabled — catches implicit `any` and null-safety issues

### Changed
- `tsconfig.json`: enabled `strict`, `noUnusedLocals`, `noFallthroughCasesInSwitch`;
  removed unused `experimentalDecorators`, `useDefineForClassFields`, `allowJs`
