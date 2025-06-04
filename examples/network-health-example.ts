/**
 * Network Health System Usage Examples
 * 
 * This file demonstrates how to use the network health checking system
 * for Walrus Sites deployment with various configurations and scenarios.
 */

import { WalrusDeploymentHealthManager } from '../apps/cli/src/utils/WalrusDeploymentHealthManager';
import { NetworkHealthChecker } from '../apps/cli/src/utils/NetworkHealthChecker';
import { PreDeploymentValidator } from '../apps/cli/src/utils/PreDeploymentValidator';

/**
 * Example 1: Basic deployment with health checking
 */
async function basicDeploymentExample() {
  console.log('🔍 Example 1: Basic deployment with health checking');

  // Create health manager for testnet
  const healthManager = WalrusDeploymentHealthManager.forTestnet({
    enableMonitoring: true,
    enableAutomaticFailover: true,
    enablePreValidation: true,
  });

  try {
    // Initialize the health management system
    await healthManager.initialize();

    // Set up event listeners
    healthManager.on('validation_completed', (summary) => {
      console.log(`✅ Validation completed: ${summary.overallStatus}`);
      console.log(`📊 Readiness score: ${summary.readinessScore}/100`);
    });

    healthManager.on('network_event', (event) => {
      console.log(`🔔 Network event: ${event.message}`);
    });

    // Perform pre-deployment validation
    const context = {
      network: 'testnet' as const,
      sitePath: './example-site',
      force: false,
    };

    const validation = await healthManager.validateDeployment(context);
    
    if (validation.overallStatus === 'ready') {
      console.log('✅ Ready for deployment');
      
      // Start monitoring
      await healthManager.startMonitoring();
      
      // Simulate deployment operation
      const result = await healthManager.executeWithHealthManagement(
        async (endpoint) => {
          console.log(`📤 Deploying to endpoint: ${endpoint.url}`);
          // Simulate deployment work
          await new Promise(resolve => setTimeout(resolve, 2000));
          return { success: true, siteId: 'example123' };
        },
        'example-deployment'
      );
      
      console.log('🎉 Deployment completed successfully');
    } else {
      console.log('❌ Deployment not ready:', validation.recommendedActions);
    }

  } catch (error) {
    console.error('❌ Deployment failed:', error instanceof Error ? error.message : String(error));
  } finally {
    healthManager.destroy();
  }
}

/**
 * Example 2: Standalone network health checking
 */
async function standaloneHealthCheckExample() {
  console.log('🔍 Example 2: Standalone network health checking');

  // Create health checker for testnet
  const healthChecker = NetworkHealthChecker.forTestnet({
    timeout: 10000,
    verbose: true,
  });

  try {
    const health = await healthChecker.checkHealth();
    
    console.log('📊 Network Health Report:');
    console.log(`Overall healthy: ${health.overall.healthy}`);
    console.log(`Health score: ${health.overall.score}/100`);
    
    console.log('\n🔗 Sui Endpoints:');
    console.log(`Primary: ${health.sui.primary.available ? '✅' : '❌'} ${health.sui.primary.url}`);
    console.log(`Fallbacks: ${health.sui.fallbacks.filter(f => f.available).length}/${health.sui.fallbacks.length} available`);
    
    console.log('\n🌊 Walrus Endpoints:');
    console.log(`Publisher: ${health.walrus.publisher.available ? '✅' : '❌'} ${health.walrus.publisher.url}`);
    console.log(`Aggregator: ${health.walrus.aggregator.available ? '✅' : '❌'} ${health.walrus.aggregator.url}`);
    
    if (health.overall.issues.length > 0) {
      console.log('\n⚠️ Issues detected:');
      health.overall.issues.forEach(issue => console.log(`  • ${issue}`));
    }
    
    if (health.overall.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      health.overall.recommendations.forEach(rec => console.log(`  • ${rec}`));
    }

  } catch (error) {
    console.error('❌ Health check failed:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Example 3: Pre-deployment validation only
 */
async function preValidationExample() {
  console.log('🔍 Example 3: Pre-deployment validation');

  const validator = PreDeploymentValidator.forTestnet({
    strictMode: false,
    skipWalletCheck: false,
    skipGasCheck: false,
  });

  try {
    const context = {
      network: 'testnet' as const,
      sitePath: './example-site',
      force: false,
    };

    console.log('🔍 Running pre-deployment validation...');
    const summary = await validator.validate(context);
    
    console.log('\n📋 Validation Results:');
    console.log(`Status: ${summary.overallStatus}`);
    console.log(`Score: ${summary.readinessScore}/100`);
    console.log(`Passed: ${summary.passedChecks}/${summary.totalChecks}`);
    console.log(`Warnings: ${summary.warnings}`);
    console.log(`Errors: ${summary.errors}`);
    
    if (summary.estimatedDeploymentTime) {
      console.log(`Estimated deployment time: ${Math.round(summary.estimatedDeploymentTime / 1000)}s`);
    }
    
    // Show detailed results by category
    const categories = ['network', 'wallet', 'configuration', 'dependencies', 'deployment'];
    
    for (const category of categories) {
      const categoryResults = summary.results.filter(r => r.category === category);
      if (categoryResults.length > 0) {
        console.log(`\n📂 ${category.toUpperCase()}:`);
        categoryResults.forEach(result => {
          const icon = result.passed ? '✅' : (result.severity === 'error' ? '❌' : '⚠️');
          console.log(`  ${icon} ${result.name}: ${result.message}`);
          if (result.suggestion && !result.passed) {
            console.log(`     💡 ${result.suggestion}`);
          }
        });
      }
    }
    
    // Show recommendations
    if (summary.recommendedActions.length > 0) {
      console.log('\n💡 Recommended Actions:');
      summary.recommendedActions.forEach(action => console.log(`  • ${action}`));
    }

  } catch (error) {
    console.error('❌ Validation failed:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Example 4: Custom configuration with monitoring
 */
async function customConfigExample() {
  console.log('🔍 Example 4: Custom configuration with monitoring');

  // Create custom health manager configuration
  const healthManager = new WalrusDeploymentHealthManager({
    network: 'testnet',
    enableMonitoring: true,
    enableAutomaticFailover: true,
    enablePreValidation: true,
    strictValidation: false,
    monitoringInterval: 15000, // 15 seconds
    retryConfig: {
      maxRetries: 3,
      initialDelay: 500,
      maxDelay: 10000,
      timeoutMs: 15000,
    },
    endpoints: {
      sui: {
        primary: 'https://fullnode.testnet.sui.io:443',
        fallbacks: [
          'https://sui-testnet-endpoint.blockvision.org/v1',
          'https://sui-testnet.publicnode.com',
        ],
        websocket: 'wss://fullnode.testnet.sui.io:443',
        faucet: 'https://faucet.testnet.sui.io',
      },
      walrus: {
        publisher: 'https://publisher-testnet.walrus.site',
        aggregator: 'https://aggregator-testnet.walrus.site',
        fallbackPublishers: [
          'https://walrus-testnet-publisher.nodes.guru',
        ],
      },
    },
  });

  try {
    await healthManager.initialize();

    // Set up detailed event monitoring
    healthManager.on('metrics_updated', (metrics) => {
      console.log(`📊 Metrics update - Network condition: ${metrics.networkCondition}, Error rate: ${(metrics.errorRate * 100).toFixed(1)}%`);
    });

    healthManager.on('network_event', (event) => {
      const timestamp = new Date(event.timestamp).toISOString();
      console.log(`🔔 [${timestamp}] ${event.severity.toUpperCase()}: ${event.message}`);
      if (event.endpoint) {
        console.log(`   Endpoint: ${event.endpoint}`);
      }
      if (event.suggestion) {
        console.log(`   💡 ${event.suggestion}`);
      }
    });

    // Start monitoring and let it run for a bit
    await healthManager.startMonitoring();
    console.log('📡 Monitoring started, collecting metrics...');
    
    // Wait for some metrics to be collected
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Get current status
    const status = healthManager.getStatus();
    console.log('\n📊 Current Status:');
    console.log(`Phase: ${status.phase}`);
    console.log(`Readiness: ${status.deploymentReadiness}`);
    console.log(`Network health score: ${status.networkHealth.overall?.score || 'N/A'}`);
    
    // Generate diagnostic report
    const report = healthManager.generateDiagnosticReport();
    if (report) {
      console.log('\n📋 Diagnostic Report:');
      console.log(`Network condition: ${report.metrics.networkCondition}`);
      console.log(`Active endpoints: ${report.metrics.activeEndpoints}`);
      console.log(`Recent events: ${report.events.length}`);
      console.log(`Estimated impact: ${report.estimatedImpact}`);
      
      if (report.patterns.length > 0) {
        console.log('\n🔍 Error Patterns:');
        report.patterns.forEach(pattern => {
          console.log(`  • ${pattern.errorPattern}: ${pattern.frequency} occurrences`);
          console.log(`    💡 ${pattern.suggestion}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Custom config example failed:', error instanceof Error ? error.message : String(error));
  } finally {
    healthManager.destroy();
  }
}

/**
 * Example 5: Quick health check for CI/CD
 */
async function quickHealthCheckExample() {
  console.log('🔍 Example 5: Quick health check for CI/CD');

  const validator = PreDeploymentValidator.forTestnet();

  try {
    const context = {
      network: 'testnet' as const,
      sitePath: './example-site',
      force: false,
    };

    // Quick validation check
    const quickCheck = await validator.quickValidate(context);
    
    if (quickCheck.ready) {
      console.log('✅ Quick check passed - system ready for deployment');
      process.exit(0);
    } else {
      console.log('❌ Quick check failed:');
      quickCheck.issues.forEach(issue => console.log(`  • ${issue}`));
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Quick check failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Run examples based on command line argument
 */
async function main() {
  const example = process.argv[2] || '1';

  switch (example) {
    case '1':
      await basicDeploymentExample();
      break;
    case '2':
      await standaloneHealthCheckExample();
      break;
    case '3':
      await preValidationExample();
      break;
    case '4':
      await customConfigExample();
      break;
    case '5':
      await quickHealthCheckExample();
      break;
    default:
      console.log('Usage: node network-health-example.js <1|2|3|4|5>');
      console.log('1: Basic deployment with health checking');
      console.log('2: Standalone network health checking');
      console.log('3: Pre-deployment validation only');
      console.log('4: Custom configuration with monitoring');
      console.log('5: Quick health check for CI/CD');
      break;
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  basicDeploymentExample,
  standaloneHealthCheckExample,
  preValidationExample,
  customConfigExample,
  quickHealthCheckExample,
};