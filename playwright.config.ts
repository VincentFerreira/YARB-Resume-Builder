import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npm run server',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        // server.js defaults to a macOS MacTeX path; point it at the
        // Linux pdflatex binary for local dev and CI alike.
        PDFLATEX_PATH: process.env.PDFLATEX_PATH ?? '/usr/bin/pdflatex',
      },
    },
  ],
});
