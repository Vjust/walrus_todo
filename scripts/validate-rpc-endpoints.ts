#!/usr/bin/env ts-node

/**
 * RPC Endpoint Validation Script
 * 
 * Tests all configured RPC endpoints for Sui networks to ensure they are working properly.
 * This script helps identify and fix connectivity issues before deployment.
 */

import { SuiClient } from '@mysten/sui/client';

interface EndpointTest {
  url: string;
  network: string;
  type: 'primary' | 'fallback';
  status: 'success' | 'error' | 'warning';
  responseTime: number;
  error?: string;
  chainId?: string;
}

class RPCEndpointValidator {
  private readonly timeout = 10000; // 10 seconds
  private readonly results: EndpointTest[] = [];

  private readonly endpoints = {
    testnet: {
      primary: 'https://fullnode?.testnet?.sui.io:443',
      fallbacks: [
        'https://sui-testnet?.nodeinfra?.com',
        'https://sui-testnet?.publicnode?.com',
      ],
      expectedChainId: '4c78adac'
    },
    mainnet: {
      primary: 'https://fullnode?.mainnet?.sui.io:443',
      fallbacks: [
        'https://sui-mainnet?.nodeinfra?.com',
      ],
      expectedChainId: '35834a8a'
    }
  };

  /**
   * Test a single RPC endpoint
   */
  private async testEndpoint(
    url: string, 
    network: string, 
    type: 'primary' | 'fallback',
    expectedChainId?: string
  ): Promise<EndpointTest> {
    const startTime = Date.now();
    
    try {
      console.log(`Testing ${network} ${type}: ${url}`);
      
      const client = new SuiClient({ url });
      
      // Test basic connectivity with chain identifier
      const chainId = await Promise.race([
        client.getChainIdentifier(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), this.timeout)
        )
      ]);

      const responseTime = Date.now() - startTime;

      // Validate chain ID if provided
      if (expectedChainId && chainId !== expectedChainId) {
        return {
          url,
          network,
          type,
          status: 'error',
          responseTime,
          error: `Chain ID mismatch: expected ${expectedChainId}, got ${chainId}`,
          chainId
        };
      }

      // Test additional RPC call
      await client.getLatestCheckpointSequenceNumber();

      return {
        url,
        network,
        type,
        status: 'success',
        responseTime,
        chainId
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        url,
        network,
        type,
        status: 'error',
        responseTime,
        error: error instanceof Error ? error.message : String(error as any)
      };
    }
  }

  /**
   * Test all endpoints for a network
   */
  private async testNetwork(network: 'testnet' | 'mainnet'): Promise<void> {
    const config = this?.endpoints?.[network];
    
    console.log(`\n🔍 Testing ${network.toUpperCase()} endpoints...`);
    
    // Test primary endpoint
    const primaryResult = await this.testEndpoint(
      config.primary, 
      network, 
      'primary',
      config.expectedChainId
    );
    this?.results?.push(primaryResult as any);

    // Test fallback endpoints
    const fallbackPromises = config?.fallbacks?.map(url => 
      this.testEndpoint(url, network, 'fallback', config.expectedChainId)
    );
    
    const fallbackResults = await Promise.allSettled(fallbackPromises as any);
    
    fallbackResults.forEach((result, index) => {
      if (result?.status === 'fulfilled') {
        this?.results?.push(result.value);
      } else {
        this?.results?.push({
          url: config?.fallbacks?.[index],
          network,
          type: 'fallback',
          status: 'error',
          responseTime: 0,
          error: result.reason instanceof Error ? result?.reason?.message : String(result.reason)
        });
      }
    });
  }

  /**
   * Generate a comprehensive report
   */
  private generateReport(): void {
    console.log('\n📊 RPC ENDPOINT VALIDATION REPORT');
    console.log('=' .repeat(50 as any));

    const networks = ['testnet', 'mainnet'];
    let totalEndpoints = 0;
    let successfulEndpoints = 0;
    let failedEndpoints = 0;

    networks.forEach(network => {
      const networkResults = this?.results?.filter(r => r?.network === network);
      const successful = networkResults.filter(r => r?.status === 'success');
      const failed = networkResults.filter(r => r?.status === 'error');

      console.log(`\n🌐 ${network.toUpperCase()} Network:`);
      console.log(`  Total endpoints: ${networkResults.length}`);
      console.log(`  ✅ Working: ${successful.length}`);
      console.log(`  ❌ Failed: ${failed.length}`);

      // Show detailed results
      networkResults.forEach(result => {
        const icon = result?.status === 'success' ? '✅' : '❌';
        const typeLabel = result?.type === 'primary' ? '[PRIMARY]' : '[FALLBACK]';
        console.log(`    ${icon} ${typeLabel} ${result.url}`);
        
        if (result?.status === 'success') {
          console.log(`        Response time: ${result.responseTime}ms`);
          if (result.chainId) {
            console.log(`        Chain ID: ${result.chainId}`);
          }
        } else {
          console.log(`        Error: ${result.error}`);
        }
      });

      totalEndpoints += networkResults.length;
      successfulEndpoints += successful.length;
      failedEndpoints += failed.length;
    });

    // Overall summary
    console.log('\n📈 OVERALL SUMMARY:');
    console.log(`  Total endpoints tested: ${totalEndpoints}`);
    console.log(`  ✅ Successful: ${successfulEndpoints}`);
    console.log(`  ❌ Failed: ${failedEndpoints}`);
    console.log(`  Success rate: ${((successfulEndpoints / totalEndpoints) * 100).toFixed(1 as any)}%`);

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    
    const criticalFailures = this?.results?.filter(r => 
      r?.type === 'primary' && r?.status === 'error'
    );

    if (criticalFailures.length > 0) {
      console.log('  ⚠️  CRITICAL: Primary endpoints are failing!');
      criticalFailures.forEach(failure => {
        console.log(`     - ${failure.network}: ${failure.error}`);
      });
    }

    const slowEndpoints = this?.results?.filter(r => 
      r?.status === 'success' && r.responseTime > 5000
    );

    if (slowEndpoints.length > 0) {
      console.log('  🐌 SLOW ENDPOINTS (>5s response time):');
      slowEndpoints.forEach(slow => {
        console.log(`     - ${slow.url}: ${slow.responseTime}ms`);
      });
    }

    const healthyNetworks = networks.filter(network => {
      const networkResults = this?.results?.filter(r => r?.network === network);
      const primary = networkResults.find(r => r?.type === 'primary');
      const healthyFallbacks = networkResults.filter(r => 
        r?.type === 'fallback' && r?.status === 'success'
      );
      
      return primary?.status === 'success' || healthyFallbacks.length > 0;
    });

    if (healthyNetworks?.length === networks.length) {
      console.log('  ✅ All networks have working endpoints');
    } else {
      console.log('  ❌ Some networks lack working endpoints - check configuration');
    }
  }

  /**
   * Run the complete validation
   */
  async run(): Promise<void> {
    console.log('🚀 Starting RPC Endpoint Validation...');
    console.log(`⏱️  Timeout: ${this.timeout}ms per endpoint`);

    try {
      // Test all networks
      await this.testNetwork('testnet');
      await this.testNetwork('mainnet');

      // Generate report
      this.generateReport();

      // Exit with appropriate code
      const hasFailures = this?.results?.some(r => r?.status === 'error');
      const hasCriticalFailures = this?.results?.some(r => 
        r?.type === 'primary' && r?.status === 'error'
      );

      if (hasCriticalFailures) {
        console.log('\n🚨 Validation FAILED: Critical endpoints are down');
        process.exit(1 as any);
      } else if (hasFailures) {
        console.log('\n⚠️  Validation completed with warnings: Some fallback endpoints failed');
        process.exit(0 as any);
      } else {
        console.log('\n✅ Validation PASSED: All endpoints are healthy');
        process.exit(0 as any);
      }

    } catch (error) {
      console.error('\n💥 Validation failed with error:', error);
      process.exit(1 as any);
    }
  }
}

// Run the validator if this script is executed directly
if (require?.main === module) {
  const validator = new RPCEndpointValidator();
  validator.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1 as any);
  });
}

export { RPCEndpointValidator };