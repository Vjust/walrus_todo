/**
 * Memory Test Processor for Jest
 * Monitors memory usage and provides warnings when tests consume excessive memory
 */

const fs = require('fs');
const path = require('path');

module.exports = (testResults) => {
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  const externalMB = Math.round(memoryUsage.external / 1024 / 1024);
  
  // Memory thresholds (in MB)
  const HEAP_WARNING_THRESHOLD = 1024; // 1GB
  const HEAP_CRITICAL_THRESHOLD = 2048; // 2GB
  
  // Log memory usage
  console.log(`\n📊 Memory Usage Summary:`);
  console.log(`   Heap Used: ${heapUsedMB}MB`);
  console.log(`   Heap Total: ${heapTotalMB}MB`);
  console.log(`   External: ${externalMB}MB`);
  
  // Check for memory warnings
  if (heapUsedMB > HEAP_CRITICAL_THRESHOLD) {
    console.warn(`🚨 CRITICAL: Memory usage (${heapUsedMB}MB) exceeds critical threshold (${HEAP_CRITICAL_THRESHOLD}MB)`);
    console.warn(`   Consider running tests with fewer workers or in smaller batches`);
  } else if (heapUsedMB > HEAP_WARNING_THRESHOLD) {
    console.warn(`⚠️  WARNING: Memory usage (${heapUsedMB}MB) exceeds warning threshold (${HEAP_WARNING_THRESHOLD}MB)`);
  } else {
    console.log(`✅ Memory usage is within acceptable limits`);
  }
  
  // Log test summary with memory context
  const { numTotalTests, numPassedTests, numFailedTests } = testResults;
  console.log(`\n🧪 Test Results:`);
  console.log(`   Total: ${numTotalTests}`);
  console.log(`   Passed: ${numPassedTests}`);
  console.log(`   Failed: ${numFailedTests}`);
  
  // Write memory report to file
  const reportPath = path.join(__dirname, '..', 'memory-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    memoryUsage: {
      heapUsedMB,
      heapTotalMB,
      externalMB,
      thresholds: {
        warning: HEAP_WARNING_THRESHOLD,
        critical: HEAP_CRITICAL_THRESHOLD
      }
    },
    testResults: {
      total: numTotalTests,
      passed: numPassedTests,
      failed: numFailedTests
    }
  };
  
  try {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Memory report saved to: ${reportPath}`);
  } catch (error) {
    console.warn(`Failed to write memory report: ${error.message}`);
  }
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
    console.log(`🗑️  Forced garbage collection completed`);
  }
  
  return testResults;
};