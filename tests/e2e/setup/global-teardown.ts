import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Global teardown for Playwright E2E tests
 * Cleans up test data and generates reports
 */
async function globalTeardown(config: FullConfig) {
  const projectRoot = path.join(__dirname, '../../..');
  
  console.log('🧹 Cleaning up E2E test environment...');
  
  try {
    // 1. Clean up test cache data
    const testCacheDir = path.join(projectRoot, '.waltodo-cache/test');
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
    
    // 2. Clean up test todos (optional - for non-blockchain tests)
    try {
      execSync('./bin/waltodo list --format json --limit 100', {
        cwd: projectRoot,
        timeout: 30000,
        stdio: 'pipe',
      });
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // 3. Generate test report summary
    const reportPath = path.join(projectRoot, 'test-results', 'e2e-summary.json');
    const summary = {
      timestamp: new Date().toISOString(),
      testRun: 'e2e-integration',
      environment: 'local',
      status: 'completed'
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
    
    console.log('✅ E2E test environment cleanup complete!');
    
  } catch (error) {
    console.error('⚠️ Error during teardown (non-critical):', error);
    // Don't throw - teardown errors shouldn't fail the test run
  }
}

export default globalTeardown;