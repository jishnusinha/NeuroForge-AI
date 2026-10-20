import { defineConfig } from '@playwright/test';
const storage = process.env.NEUROFORGE_E2E_STORAGE || 'database';
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/support/e2e-setup.mjs',
  timeout: 60000,
  expect: { timeout: 10000 },
  workers: 1,
  retries: 0,
  outputDir: `.artifacts/e2e-${storage}/test-results`,
  reporter: [['list'], ['json', { outputFile: `.artifacts/e2e-${storage}/results.json` }], ['html', { outputFolder: `.artifacts/e2e-${storage}/report`, open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${process.env.NEUROFORGE_E2E_PORT || 4179}`,
    browserName: 'chromium', reducedMotion: 'reduce',
    launchOptions: { args: ['--use-angle=swiftshader'] },
    trace: 'retain-on-failure', screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
