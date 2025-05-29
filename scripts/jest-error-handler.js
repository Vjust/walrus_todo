#!/usr/bin/env node

/**
 * Comprehensive Jest Error Handler
 * 
 * This module provides robust error handling for Jest execution
 * across different environments, platforms, and failure scenarios.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class JestErrorHandler {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.errorHistory = [];
    this.recoveryStrategies = new Map();
    this.setupRecoveryStrategies();
  }

  /**
   * Set up recovery strategies for different error types
   */
  setupRecoveryStrategies() {
    // Binary execution errors
    this.recoveryStrategies.set('ENOENT', {
      description: 'Command not found',
      recovery: [
        'Check if Jest is installed: npm list jest',
        'Reinstall dependencies: pnpm install',
        'Try npx jest instead of direct binary',
        'Use Node.js to run Jest: node node_modules/jest/bin/jest.js'
      ]
    });

    this.recoveryStrategies.set('EACCES', {
      description: 'Permission denied',
      recovery: [
        'Fix file permissions: chmod +x node_modules/.bin/jest',
        'Run with sudo (not recommended): sudo npm test',
        'Check directory permissions',
        'Use npx to bypass permission issues'
      ]
    });

    // Memory errors
    this.recoveryStrategies.set('ENOMEM', {
      description: 'Out of memory',
      recovery: [
        'Increase Node.js memory: NODE_OPTIONS="--max-old-space-size=8192"',
        'Run tests in smaller batches',
        'Close other applications',
        'Use fewer Jest workers: --maxWorkers=1'
      ]
    });

    this.recoveryStrategies.set('ERR_WORKER_OUT_OF_MEMORY', {
      description: 'Jest worker out of memory',
      recovery: [
        'Reduce Jest workers: --maxWorkers=1',
        'Increase memory per worker',
        'Run tests sequentially: --runInBand',
        'Split test suites into smaller groups'
      ]
    });

    // TypeScript/Module errors
    this.recoveryStrategies.set('MODULE_NOT_FOUND', {
      description: 'Module resolution error',
      recovery: [
        'Install missing dependencies: pnpm install',
        'Check tsconfig.json paths',
        'Clear Jest cache: npx jest --clearCache',
        'Rebuild project: pnpm build'
      ]
    });

    this.recoveryStrategies.set('TS_NODE_ERROR', {
      description: 'TypeScript compilation error',
      recovery: [
        'Check TypeScript configuration',
        'Install ts-node: pnpm add -D ts-node',
        'Use compiled JavaScript instead',
        'Fix TypeScript syntax errors'
      ]
    });

    // Jest configuration errors
    this.recoveryStrategies.set('JEST_CONFIG_ERROR', {
      description: 'Jest configuration invalid',
      recovery: [
        'Check jest.config.js syntax',
        'Validate configuration against Jest schema',
        'Use default configuration temporarily',
        'Check for conflicting Jest versions'
      ]
    });

    // Platform-specific errors
    this.recoveryStrategies.set('PLATFORM_ERROR', {
      description: 'Platform-specific execution error',
      recovery: [
        'Check platform compatibility',
        'Use platform-specific binaries',
        'Set shell environment: shell: true',
        'Try different execution strategy'
      ]
    });

    // Network/timeout errors
    this.recoveryStrategies.set('TIMEOUT_ERROR', {
      description: 'Test execution timeout',
      recovery: [
        'Increase test timeout: --testTimeout=60000',
        'Optimize slow tests',
        'Run fewer tests concurrently',
        'Check for infinite loops or deadlocks'
      ]
    });

    // CI-specific errors
    this.recoveryStrategies.set('CI_ERROR', {
      description: 'CI environment error',
      recovery: [
        'Check CI environment variables',
        'Increase CI timeout limits',
        'Use CI-optimized Jest configuration',
        'Enable debug logging'
      ]
    });
  }

  /**
   * Analyze error and determine recovery strategy
   */
  analyzeError(error, context = {}) {
    const analysis = {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        code: error.code || 'UNKNOWN',
        stack: error.stack,
        name: error.name
      },
      context,
      environment: this.getEnvironmentInfo(),
      classification: this.classifyError(error),
      recoveryStrategy: null,
      severity: 'unknown'
    };

    // Determine recovery strategy
    analysis.recoveryStrategy = this.getRecoveryStrategy(analysis.classification);
    analysis.severity = this.assessSeverity(error, context);

    // Store in history
    this.errorHistory.push(analysis);

    return analysis;
  }

  /**
   * Classify error type for appropriate recovery
   */
  classifyError(error) {
    const message = error.message.toLowerCase();
    const code = error.code;

    // Direct code mapping
    if (this.recoveryStrategies.has(code)) {
      return code;
    }

    // Message-based classification
    if (message.includes('command not found') || message.includes('enoent')) {
      return 'ENOENT';
    }

    if (message.includes('permission denied') || message.includes('eacces')) {
      return 'EACCES';
    }

    if (message.includes('out of memory') || message.includes('heap')) {
      return 'ENOMEM';
    }

    if (message.includes('worker') && message.includes('memory')) {
      return 'ERR_WORKER_OUT_OF_MEMORY';
    }

    if (message.includes('cannot find module') || message.includes('module not found')) {
      return 'MODULE_NOT_FOUND';
    }

    if (message.includes('typescript') || message.includes('ts-node')) {
      return 'TS_NODE_ERROR';
    }

    if (message.includes('jest') && message.includes('config')) {
      return 'JEST_CONFIG_ERROR';
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      return 'TIMEOUT_ERROR';
    }

    if (process.env.CI && (message.includes('ci') || message.includes('build'))) {
      return 'CI_ERROR';
    }

    // Platform-specific detection
    if (message.includes('spawn') || message.includes('platform')) {
      return 'PLATFORM_ERROR';
    }

    return 'UNKNOWN';
  }

  /**
   * Get recovery strategy for error classification
   */
  getRecoveryStrategy(classification) {
    return this.recoveryStrategies.get(classification) || {
      description: 'Unknown error',
      recovery: [
        'Check error message for specific details',
        'Ensure all dependencies are installed',
        'Try running tests with different options',
        'Check Jest and Node.js versions'
      ]
    };
  }

  /**
   * Assess error severity
   */
  assessSeverity(error, context) {
    const message = error.message.toLowerCase();

    // Critical errors that prevent all execution
    if (message.includes('cannot find module jest') ||
        message.includes('node: command not found') ||
        message.includes('fatal error')) {
      return 'critical';
    }

    // High severity errors that affect most functionality
    if (message.includes('out of memory') ||
        message.includes('permission denied') ||
        message.includes('jest config')) {
      return 'high';
    }

    // Medium severity errors that affect some functionality
    if (message.includes('timeout') ||
        message.includes('worker failed') ||
        message.includes('compilation error')) {
      return 'medium';
    }

    // Low severity errors that might be transient
    return 'low';
  }

  /**
   * Get environment information for error context
   */
  getEnvironmentInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      npmVersion: this.getNpmVersion(),
      pnpmVersion: this.getPnpmVersion(),
      jestVersion: this.getJestVersion(),
      workingDirectory: process.cwd(),
      environment: process.env.NODE_ENV,
      ci: Boolean(process.env.CI),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  /**
   * Get NPM version
   */
  getNpmVersion() {
    try {
      const { execSync } = require('child_process');
      return execSync('npm --version', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get pnpm version
   */
  getPnpmVersion() {
    try {
      const { execSync } = require('child_process');
      return execSync('pnpm --version', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get Jest version
   */
  getJestVersion() {
    try {
      const packagePath = path.join(this.projectRoot, 'node_modules', 'jest', 'package.json');
      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        return pkg.version;
      }
    } catch {}
    return 'unknown';
  }

  /**
   * Handle error with comprehensive recovery suggestions
   */
  handleError(error, context = {}) {
    const analysis = this.analyzeError(error, context);
    
    console.error('\n🚨 Jest Execution Error Detected');
    console.error('════════════════════════════════════');
    console.error(`Timestamp: ${analysis.timestamp}`);
    console.error(`Severity: ${analysis.severity.toUpperCase()}`);
    console.error(`Classification: ${analysis.classification}`);
    console.error(`Description: ${analysis.recoveryStrategy.description}`);
    console.error('\n📋 Error Details:');
    console.error(`Message: ${error.message}`);
    if (error.code) {
      console.error(`Code: ${error.code}`);
    }

    console.error('\n🔧 Suggested Recovery Steps:');
    analysis.recoveryStrategy.recovery.forEach((step, index) => {
      console.error(`  ${index + 1}. ${step}`);
    });

    console.error('\n🖥️  Environment Information:');
    console.error(`Platform: ${analysis.environment.platform} (${analysis.environment.arch})`);
    console.error(`Node.js: ${analysis.environment.nodeVersion}`);
    console.error(`Jest: ${analysis.environment.jestVersion}`);
    console.error(`Memory: ${Math.round(analysis.environment.memoryUsage.heapUsed / 1024 / 1024)}MB used`);

    // Specific recommendations based on error pattern
    this.provideSpecificRecommendations(analysis);

    return analysis;
  }

  /**
   * Provide specific recommendations based on error patterns
   */
  provideSpecificRecommendations(analysis) {
    console.error('\n💡 Specific Recommendations:');

    switch (analysis.classification) {
      case 'ENOENT':
        console.error('  • Try: npx jest instead of direct jest command');
        console.error('  • Verify: ls node_modules/.bin/jest');
        break;

      case 'ENOMEM':
        console.error('  • Try: NODE_OPTIONS="--max-old-space-size=8192" npm test');
        console.error('  • Try: npm test -- --maxWorkers=1');
        break;

      case 'MODULE_NOT_FOUND':
        console.error('  • Try: rm -rf node_modules && pnpm install');
        console.error('  • Try: npx jest --clearCache');
        break;

      case 'TIMEOUT_ERROR':
        console.error('  • Try: npm test -- --testTimeout=60000');
        console.error('  • Try: npm test -- --runInBand');
        break;

      default:
        console.error('  • Check the error message for specific guidance');
        console.error('  • Consider running with --verbose for more details');
    }

    // Check for common patterns in recent errors
    if (this.errorHistory.length > 1) {
      const recentErrors = this.errorHistory.slice(-3);
      const repeatedError = recentErrors.every(e => e.classification === analysis.classification);
      
      if (repeatedError) {
        console.error('\n⚠️  Repeated Error Pattern Detected:');
        console.error('  • This error has occurred multiple times recently');
        console.error('  • Consider a more comprehensive fix');
        console.error('  • Try: pnpm run test:diagnostic for detailed analysis');
      }
    }
  }

  /**
   * Generate error report
   */
  generateErrorReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalErrors: this.errorHistory.length,
        criticalErrors: this.errorHistory.filter(e => e.severity === 'critical').length,
        mostCommonError: this.getMostCommonError(),
        environment: this.getEnvironmentInfo()
      },
      errorHistory: this.errorHistory,
      recommendations: this.generateGlobalRecommendations()
    };

    const reportPath = path.join(this.projectRoot, 'jest-error-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📊 Error report saved to: ${reportPath}`);
    return report;
  }

  /**
   * Get most common error classification
   */
  getMostCommonError() {
    if (this.errorHistory.length === 0) return null;

    const counts = {};
    this.errorHistory.forEach(error => {
      counts[error.classification] = (counts[error.classification] || 0) + 1;
    });

    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)[0][0];
  }

  /**
   * Generate global recommendations based on error history
   */
  generateGlobalRecommendations() {
    const recommendations = [];

    if (this.errorHistory.some(e => e.classification === 'ENOMEM')) {
      recommendations.push('Consider running tests in smaller batches to reduce memory usage');
    }

    if (this.errorHistory.some(e => e.classification === 'ENOENT')) {
      recommendations.push('Consider using npx for all Jest commands to avoid binary issues');
    }

    if (this.errorHistory.some(e => e.classification === 'MODULE_NOT_FOUND')) {
      recommendations.push('Consider clearing and reinstalling dependencies regularly');
    }

    if (this.errorHistory.filter(e => e.severity === 'critical').length > 0) {
      recommendations.push('Address critical errors immediately as they prevent test execution');
    }

    return recommendations;
  }

  /**
   * Attempt automatic recovery for certain error types
   */
  async attemptRecovery(error, context = {}) {
    const analysis = this.analyzeError(error, context);
    
    console.log(`🔄 Attempting automatic recovery for: ${analysis.classification}`);

    switch (analysis.classification) {
      case 'JEST_CACHE_ERROR':
        return this.clearJestCache();
      
      case 'MODULE_NOT_FOUND':
        return this.reinstallDependencies();
      
      case 'TIMEOUT_ERROR':
        return this.adjustTimeouts();
        
      default:
        console.log('🚫 No automatic recovery available for this error type');
        return false;
    }
  }

  /**
   * Clear Jest cache
   */
  async clearJestCache() {
    try {
      const { execSync } = require('child_process');
      console.log('🗑️  Clearing Jest cache...');
      execSync('npx jest --clearCache', { cwd: this.projectRoot });
      console.log('✅ Jest cache cleared successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to clear Jest cache:', error.message);
      return false;
    }
  }

  /**
   * Reinstall dependencies
   */
  async reinstallDependencies() {
    try {
      const { execSync } = require('child_process');
      console.log('📦 Reinstalling dependencies...');
      
      // Try pnpm first, then npm
      try {
        execSync('pnpm install', { cwd: this.projectRoot, stdio: 'inherit' });
      } catch {
        execSync('npm install', { cwd: this.projectRoot, stdio: 'inherit' });
      }
      
      console.log('✅ Dependencies reinstalled successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to reinstall dependencies:', error.message);
      return false;
    }
  }

  /**
   * Adjust timeouts in Jest configuration
   */
  async adjustTimeouts() {
    try {
      console.log('⏱️  Adjusting Jest timeouts...');
      // This would modify Jest config or suggest timeout adjustments
      console.log('💡 Consider running tests with: --testTimeout=60000');
      return true;
    } catch (error) {
      console.error('❌ Failed to adjust timeouts:', error.message);
      return false;
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const handler = new JestErrorHandler();

  if (args.includes('--report')) {
    handler.generateErrorReport();
    process.exit(0);
  }

  if (args.includes('--help')) {
    console.log(`
Jest Error Handler - Comprehensive error handling and recovery for Jest

Usage:
  node jest-error-handler.js [options]

Options:
  --report     Generate error history report
  --help       Show this help

This module provides:
- Error classification and analysis
- Recovery strategy suggestions
- Automatic recovery attempts
- Error history tracking
- Environment-specific recommendations
`);
    process.exit(0);
  }

  console.log('Jest Error Handler initialized and ready');
}

module.exports = JestErrorHandler;