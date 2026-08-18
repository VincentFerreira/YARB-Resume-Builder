## Playwright: MCP vs test suite

Two distinct tools, two distinct purposes — don't conflate them.

- **Playwright MCP** (`.mcp.json`) is for interactive work in a real browser:
  exploring the app, finding the right selector for a new test, reproducing a
  reported bug step by step, or visually checking a change you just made.
  It is not a source of truth — nothing about correctness is established just
  because an MCP session looked right once.
- **`npx playwright test`** (`tests/e2e/`) is the source of truth for
  non-regression. It's what CI runs, and it's what determines whether a
  change broke the import → preview → export flow.

If an MCP session uncovers an interesting behavior — a bug, an edge case, a
selector that turns out to be flaky — turn it into a spec under `tests/e2e/`
before moving on. An interesting finding that only lived in an MCP session is
lost the moment the session ends.

## Debugging templates/cv.mustache (LaTeX/PDF layout)

- A custom template saved to `localStorage` (`cv-latex-template`, see
  `services/templateStorageService.ts`) overrides `templates/cv.mustache`
  for real exports too. If a fix doesn't show up in the app, reset it via
  the LaTeX panel's Template tab first.
- Don't "clean up" an inconsistent-looking `\vspace` without compiling —
  it may be an empirical compensation (`itemize` needs more negative space
  than `tabularx` to match visually, regardless of `topsep`).
- Verify layout changes by compiling: throwaway Vitest test calling
  `generateLatex()` on a real fixture → `pdflatex` → `pdftoppm` to inspect.
- `pdf-parse` only gives text, not positions — use `readPdfTextPositions`
  (`tests/helpers/pdf.ts`, via `pdfjs-dist`) for alignment/page-break checks.
- `cv-complet.json` is a deliberate 1-pager; use/extend
  `tests/fixtures/cv-page-break-edge.json` for page-break regressions.
