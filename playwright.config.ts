import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30 * 1000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
  },
  webServer: {
    // T009 fix (FINDING-T009-02): plain `npm run dev` binds Vite to
    // [::1]:5173 only on this VM, so the 127.0.0.1 baseURL never
    // connected and `npm run test:e2e` timed out after 60 s without
    // running a single test. Binding the dev server to 127.0.0.1
    // explicitly makes the shipped config runnable; baseURL unchanged.
    command: 'npm run dev -- --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
    timeout: 60 * 1000,
  },
})
