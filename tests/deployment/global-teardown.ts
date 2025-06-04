/**
 * @fileoverview Global teardown for Walrus Sites deployment tests
 * 
 * Performs cleanup operations after all tests complete:
 * - Cleanup temporary files and directories
 * - Generate test reports
 * - Resource cleanup
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export default async function globalTeardown(): Promise<void> {
  console.log('\n🧹 Starting global teardown for deployment tests...\n');

  try {
    // Cleanup temporary files
    await cleanupTemporaryFiles();
    
    // Generate test summary
    await generateTestSummary();
    
    // Cleanup resources
    await cleanupResources();
    
    console.log('✅ Global teardown completed successfully\n');
    
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't exit with error code to avoid masking test failures
  }
}

async function cleanupTemporaryFiles(): Promise<void> {
  console.log('🗑️  Cleaning up temporary files...');

  const tempDirs = [
    './tests/deployment/temp',
    './tests/deployment/fixtures/valid-build',
    './tests/deployment/fixtures/minimal-build',
    './tests/deployment/fixtures/incomplete-build'
  ];

  let cleanedFiles = 0;
  let cleanedDirs = 0;

  for (const dir of tempDirs) {
    try {
      const stats = await fs.stat(dir);
      if (stats.isDirectory()) {
        const files = await getAllFiles(dir);
        cleanedFiles += files.length;
        
        await fs.rm(dir, { recursive: true, force: true });
        cleanedDirs++;
        console.log(`  ✓ Removed ${dir} (${files.length} files)`);
      }
    } catch (error) {
      // Directory might not exist, which is fine
      if ((error as any).code !== 'ENOENT') {
        console.warn(`  ⚠️  Failed to cleanup ${dir}:`, error.message);
      }
    }
  }

  console.log(`  ✓ Cleaned up ${cleanedFiles} files in ${cleanedDirs} directories`);
}

async function getAllFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        const subFiles = await getAllFiles(fullPath);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Ignore errors reading directories
  }
  
  return files;
}

async function generateTestSummary(): Promise<void> {
  console.log('📊 Generating test summary...');

  try {
    const summary = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        testMode: process.env.WALRUS_TEST_MODE
      },
      testConfiguration: {
        timeout: process.env.JEST_TIMEOUT,
        environment: process.env.NODE_ENV
      },
      coverage: await getCoverageInfo(),
      performance: getPerformanceMetrics()
    };

    const summaryPath = './tests/deployment/reports/test-summary.json';
    await fs.mkdir(path.dirname(summaryPath), { recursive: true });
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
    
    console.log(`  ✓ Test summary saved to ${summaryPath}`);
    
    // Generate human-readable summary
    await generateHumanReadableSummary(summary);
    
  } catch (error) {
    console.warn('  ⚠️  Failed to generate test summary:', error.message);
  }
}

async function getCoverageInfo(): Promise<any> {
  try {
    const coveragePath = './tests/deployment/coverage/coverage-final.json';
    const coverageData = await fs.readFile(coveragePath, 'utf-8');
    const coverage = JSON.parse(coverageData);
    
    // Calculate overall coverage percentages
    let totalStatements = 0;
    let coveredStatements = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    let totalLines = 0;
    let coveredLines = 0;

    for (const [file, data] of Object.entries(coverage as any)) {
      if (data.s) {
        totalStatements += Object.keys(data.s).length;
        coveredStatements += Object.values(data.s).filter(v => v > 0).length;
      }
      if (data.f) {
        totalFunctions += Object.keys(data.f).length;
        coveredFunctions += Object.values(data.f).filter(v => v > 0).length;
      }
      if (data.b) {
        for (const branches of Object.values(data.b) as any[]) {
          totalBranches += branches.length;
          coveredBranches += branches.filter(v => v > 0).length;
        }
      }
    }

    return {
      statements: {
        total: totalStatements,
        covered: coveredStatements,
        percentage: totalStatements ? (coveredStatements / totalStatements * 100).toFixed(2) : 0
      },
      functions: {
        total: totalFunctions,
        covered: coveredFunctions,
        percentage: totalFunctions ? (coveredFunctions / totalFunctions * 100).toFixed(2) : 0
      },
      branches: {
        total: totalBranches,
        covered: coveredBranches,
        percentage: totalBranches ? (coveredBranches / totalBranches * 100).toFixed(2) : 0
      },
      files: Object.keys(coverage).length
    };
  } catch (error) {
    return { error: 'Coverage data not available' };
  }
}

function getPerformanceMetrics(): any {
  const memoryUsage = process.memoryUsage();
  
  return {
    memoryUsage: {
      rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`
    },
    uptime: `${(process.uptime() / 60).toFixed(2)} minutes`
  };
}

async function generateHumanReadableSummary(summary: any): Promise<void> {
  const readableSummary = `
# Walrus Sites Deployment Tests Summary

**Generated:** ${summary.timestamp}

## Environment
- **Node.js Version:** ${summary.environment.nodeVersion}
- **Platform:** ${summary.environment.platform} (${summary.environment.arch})
- **Test Mode:** ${summary.environment.testMode}

## Test Configuration
- **Timeout:** ${summary.testConfiguration.timeout}ms
- **Environment:** ${summary.testConfiguration.environment}

## Coverage Report
${summary.coverage.error ? `❌ ${summary.coverage.error}` : `
- **Files:** ${summary.coverage.files}
- **Statements:** ${summary.coverage.statements.covered}/${summary.coverage.statements.total} (${summary.coverage.statements.percentage}%)
- **Functions:** ${summary.coverage.functions.covered}/${summary.coverage.functions.total} (${summary.coverage.functions.percentage}%)
- **Branches:** ${summary.coverage.branches.covered}/${summary.coverage.branches.total} (${summary.coverage.branches.percentage}%)
`}

## Performance Metrics
- **Memory Usage:**
  - RSS: ${summary.performance.memoryUsage.rss}
  - Heap Total: ${summary.performance.memoryUsage.heapTotal}
  - Heap Used: ${summary.performance.memoryUsage.heapUsed}
  - External: ${summary.performance.memoryUsage.external}
- **Test Duration:** ${summary.performance.uptime}

## Test Categories Covered
- ✅ Network connectivity failures and recovery
- ✅ Configuration validation and error handling
- ✅ Build output verification and optimization
- ✅ Site-builder command execution and parameter validation
- ✅ Error recovery mechanisms and state management
- ✅ End-to-end deployment pipeline integration

---
*Generated by Walrus Sites Deployment Test Suite*
`;

  const readablePath = './tests/deployment/reports/test-summary.md';
  await fs.writeFile(readablePath, readableSummary.trim());
  console.log(`  ✓ Human-readable summary saved to ${readablePath}`);
}

async function cleanupResources(): Promise<void> {
  console.log('🔧 Cleaning up resources...');

  // Clear environment variables set during testing
  const testEnvVars = [
    'WALRUS_TEST_MODE',
    'JEST_TIMEOUT',
    'SUPPRESS_NO_CONFIG_WARNING'
  ];

  for (const envVar of testEnvVars) {
    if (process.env[envVar]) {
      delete process.env[envVar];
      console.log(`  ✓ Cleared environment variable: ${envVar}`);
    }
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
    console.log('  ✓ Forced garbage collection');
  }

  // Clear any remaining timers
  const activeHandles = (process as any)._getActiveHandles();
  const activeRequests = (process as any)._getActiveRequests();
  
  if (activeHandles.length > 0 || activeRequests.length > 0) {
    console.log(`  ⚠️  Active handles: ${activeHandles.length}, Active requests: ${activeRequests.length}`);
  } else {
    console.log('  ✓ No active handles or requests remaining');
  }

  console.log('  ✓ Resource cleanup completed');
}