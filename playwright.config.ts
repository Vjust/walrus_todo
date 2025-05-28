import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

/**
 * Enhanced Playwright configuration for CLI-Frontend E2E integration testing
 * Supports multiple test environments and comprehensive coverage
 */
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  
  /* Global test timeout */
  timeout: 30 * 1000,
  expect: {
    /* Global expect timeout */
    timeout: 5 * 1000,
  },
  
  /* Run tests in files in parallel */
  fullyParallel: !process.env.CI,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : 2,
  
  /* Reporter configuration for comprehensive output */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list']
  ],
  
  /* Global setup and teardown */
  globalSetup: path.join(__dirname, 'tests/e2e/setup/global-setup.ts'),
  globalTeardown: path.join(__dirname, 'tests/e2e/setup/global-teardown.ts'),
  
  /* Shared settings for all projects */
  use: {
    /* Base URL for frontend tests */
    baseURL: 'http://localhost:3000',

    /* Collect trace when retrying failed tests */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'retain-on-failure',
    
    /* Action and navigation timeouts */
    actionTimeout: 10 * 1000,
    navigationTimeout: 30 * 1000,
    
    /* Ignore HTTPS errors for local development */
    ignoreHTTPSErrors: true,
  },

  /* Configure projects for comprehensive testing */
  projects: [
    /* Desktop browsers for main integration tests */
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
      testMatch: '**/cli-frontend-sync.spec.ts'
    },
    
    /* API contract testing (headless) */
    {
      name: 'api-contracts',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/contracts/**/*.test.ts'
    },
    
    /* Performance testing with Lighthouse */
    {
      name: 'performance',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome'
      },
      testMatch: '**/performance/**/*.test.ts'
    },
    
    /* Cross-browser compatibility (optional) */
    {
      name: 'firefox',
      use: devices['Desktop Firefox'],
      testMatch: '**/cli-frontend-sync.spec.ts'
    },
    
    /* Mobile responsive testing */
    {
      name: 'mobile',
      use: devices['Pixel 5'],
      testMatch: '**/mobile/**/*.spec.ts'
    },
  ],

  /* Run multiple servers for comprehensive testing */
  webServer: [
    /* Frontend Next.js server */
    {
      command: 'cd waltodo-frontend && pnpm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        PORT: '3000',
        NODE_ENV: 'test'
      }
    },
    /* Backend API server for WebSocket testing */
    {
      command: 'pnpm run api:start',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000,
      env: {
        PORT: '3001',
        NODE_ENV: 'test',
        ENABLE_WEBSOCKET: 'true'
      }
    }
  ],
});