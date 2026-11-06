import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8888',
    browserName: 'chromium',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
      args: ['--no-sandbox'],
    },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'local', testIgnore: '**/canvas-sync.spec.ts' },
    { name: 'canvas-sync', testMatch: '**/canvas-sync.spec.ts', use: { baseURL: 'http://127.0.0.1:8890' } },
  ],
  webServer: [{
    command: 'npm --prefix .. run dev',
    url: 'http://127.0.0.1:8888/api/health',
    // Never reuse a personal session/server connected to a hosted project.
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NETLIFY_TELEMETRY_DISABLED: '1',
      CAMPUSFLOW_ENV_FILE: '',
      VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_API_BASE_URL: '',
      SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '', SUPABASE_OWNER_USER_ID: '',
      CANVAS_BASE_URL: '', CANVAS_API_TOKEN: '', CANVAS_SUBMISSIONS_ENABLED: 'false',
      PORT: '8080', APP_ALLOWED_ORIGINS: 'http://127.0.0.1:8888,http://localhost:8888',
    },
  }, {
    command: 'node ../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 8890 --strictPort',
    url: 'http://127.0.0.1:8890', reuseExistingServer: false, timeout: 60_000,
    env: {
      CAMPUSFLOW_ENV_FILE: '',
      VITE_SUPABASE_URL: 'http://127.0.0.1:15499', VITE_SUPABASE_PUBLISHABLE_KEY: 'fixture-public-key', VITE_API_BASE_URL: '',
      SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '', SUPABASE_OWNER_USER_ID: '',
      CANVAS_BASE_URL: '', CANVAS_API_TOKEN: '', CANVAS_SUBMISSIONS_ENABLED: 'false',
    },
  }],
})
