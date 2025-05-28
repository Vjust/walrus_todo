import { chromium, FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Global setup for Playwright E2E tests
 * Prepares CLI, builds frontend, and sets up test environment
 */
async function globalSetup(config: FullConfig) {
  const projectRoot = path.join(__dirname, '../../..');

  console.log('🔧 Setting up E2E test environment...');

  try {
    // 1. Build CLI for testing
    console.log('📦 Building CLI...');
    execSync('pnpm run build:dev', {
      cwd: projectRoot,
      stdio: 'inherit',
      timeout: 120000,
    });

    // 2. Install frontend dependencies
    const frontendPath = path.join(projectRoot, 'waltodo-frontend');
    if (fs.existsSync(frontendPath)) {
      console.log('📦 Installing frontend dependencies...');
      execSync('pnpm install', {
        cwd: frontendPath,
        stdio: 'inherit',
        timeout: 180000,
      });
    }

    // 3. Generate frontend configuration
    console.log('⚙️ Generating frontend configuration...');
    try {
      execSync('pnpm run config:generate', {
        cwd: projectRoot,
        stdio: 'inherit',
        timeout: 60000,
      });
    } catch (error) {
      console.warn(
        '⚠️ Frontend config generation failed, continuing with existing config'
      );
    }

    // 4. Create test data directories
    const testDataDirs = [
      path.join(projectRoot, 'test-results'),
      path.join(projectRoot, 'playwright-report'),
      path.join(projectRoot, '.waltodo-cache/test'),
    ];

    testDataDirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // 5. Verify CLI is functional
    console.log('🧪 Verifying CLI functionality...');
    const cliVersion = execSync('./bin/waltodo --version', {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: 30000,
    });
    console.log(`✅ CLI version: ${cliVersion.trim()}`);

    // 6. Set up browser for global state (if needed)
    const browser = await chromium.launch();
    await browser.close();

    console.log('✅ E2E test environment setup complete!');
  } catch (error) {
    console.error('❌ Failed to set up E2E test environment:', error);
    throw error;
  }
}

export default globalSetup;
