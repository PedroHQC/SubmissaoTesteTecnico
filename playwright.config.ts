// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import process from 'node:process';

// Se o seu Vite rodar na 5173 por padrão, altere esta constante para 5173
const PORT = 4175;
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],
  use: {
    channel: 'chromium',
    deviceScaleFactor: 1,
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    },
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 5'],
        hasTouch: true,
      },
    },
    {
      name: 'chromium-mobile-landscape',
      use: { ...devices['Pixel 5'], viewport: { width: 851, height: 393 }, hasTouch: true },
    },
  ],
  webServer: {
    // Força o Vite a escutar em 127.0.0.1 na porta especificada sem alternar
    command: `npx vite build --mode test --outDir .test-build && npx vite preview --outDir .test-build --host ${HOST} --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
