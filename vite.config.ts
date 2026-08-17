/// <reference types="vitest" />
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      // Bind-mounted volumes (e.g. Docker on macOS/Windows) often don't propagate
      // inotify events, so file changes go unnoticed without polling.
      watch: process.env.CHOKIDAR_USEPOLLING === 'true' ? { usePolling: true } : undefined,
      proxy: {
        '/api/latex': {
          target: 'https://latexonline.cc',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/latex/, ''),
          secure: true,
        },
      },
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.ANTHROPIC_API_KEY': JSON.stringify(env.ANTHROPIC_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    test: {
      environment: 'node',
      exclude: ['**/node_modules/**', 'tests/e2e/**'],
      setupFiles: ['./tests/setup/serverTestData.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: [
          'lib/**/*.ts',
          'services/**/*.ts',
          'constants.ts',
        ],
        exclude: ['**/*.test.*', '**/*.d.ts'],
      },
    },
  };
});
