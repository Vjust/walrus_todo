# Network Health Checking System

A comprehensive network health checking system for Walrus Sites deployment that ensures reliable operations through intelligent monitoring, automatic retry logic, endpoint failover, and pre-deployment validation.

## Overview

The system consists of several interconnected components that work together to provide robust network reliability:

- **NetworkHealthChecker**: Real-time health monitoring for Sui and Walrus endpoints
- **NetworkRetryManager**: Advanced retry logic with exponential backoff and circuit breakers
- **EndpointFallbackManager**: Intelligent endpoint switching and failover capabilities
- **PreDeploymentValidator**: Comprehensive validation before deployment attempts
- **NetworkMonitor**: Continuous monitoring with diagnostics and pattern detection
- **WalrusDeploymentHealthManager**: Unified interface combining all components

## Quick Start

### CLI Usage

The simplest way to use the network health system is through the enhanced deployment command:

```bash
# Basic deployment with health checking
waltodo deploy-with-health-check ./my-site --network testnet

# With monitoring and verbose output
waltodo deploy-with-health-check ./my-site --network testnet --monitor --verbose

# Strict validation mode
waltodo deploy-with-health-check ./my-site --network testnet --strict

# Force deployment despite warnings
waltodo deploy-with-health-check ./my-site --network testnet --force

# Custom retry configuration
waltodo deploy-with-health-check ./my-site --network testnet \
  --max-retries 10 --retry-delay 2000 --timeout 60000

# Generate diagnostic report
waltodo deploy-with-health-check ./my-site --network testnet \
  --output-report ./deployment-report.json
```

### Programmatic Usage

#### Basic Health Checking

```typescript
import { NetworkHealthChecker } from './utils/NetworkHealthChecker';

// Create health checker for testnet
const healthChecker = NetworkHealthChecker.forTestnet({
  timeout: 10000,
  verbose: true,
});

// Check network health
const health = await healthChecker.checkHealth();

console.log('Network Health:', {
  healthy: health.overall.healthy,
  score: health.overall.score,
  issues: health.overall.issues,
  recommendations: health.overall.recommendations,
});
```

#### Pre-Deployment Validation

```typescript
import { PreDeploymentValidator } from './utils/PreDeploymentValidator';

const validator = PreDeploymentValidator.forTestnet({
  strictMode: false,
  skipWalletCheck: false,
});

const context = {
  network: 'testnet' as const,
  sitePath: './my-site',
  force: false,
};

const summary = await validator.validate(context);

if (summary.overallStatus === 'ready') {
  console.log('✅ Ready for deployment');
} else {
  console.log('❌ Issues found:', summary.recommendedActions);
}
```

#### Complete Health Management

```typescript
import { WalrusDeploymentHealthManager } from './utils/WalrusDeploymentHealthManager';

// Create health manager with default testnet configuration
const healthManager = WalrusDeploymentHealthManager.forTestnet({
  enableMonitoring: true,
  enableAutomaticFailover: true,
});

// Set up event listeners
healthManager.on('network_event', (event) => {
  console.log(`${event.severity}: ${event.message}`);
});

healthManager.on('validation_completed', (summary) => {
  console.log(`Validation: ${summary.overallStatus}`);
});

try {
  // Initialize
  await healthManager.initialize();

  // Validate deployment
  const validation = await healthManager.validateDeployment({
    network: 'testnet',
    sitePath: './my-site',
    force: false,
  });

  if (validation.overallStatus === 'ready') {
    // Start monitoring
    await healthManager.startMonitoring();

    // Execute deployment with health management
    const result = await healthManager.executeWithHealthManagement(
      async (endpoint) => {
        // Your deployment logic here
        console.log(`Deploying to: ${endpoint.url}`);
        return { success: true };
      },
      'my-deployment'
    );

    console.log('Deployment completed successfully');
  }
} finally {
  healthManager.destroy();
}
```

## Components

### NetworkHealthChecker

Monitors the health of Sui and Walrus network endpoints in real-time.

**Key Features:**
- Parallel health checks across all endpoints
- Response time measurement
- WebSocket connectivity testing
- Chain ID verification
- Wallet and gas balance validation

**Configuration Options:**
```typescript
const options = {
  timeout: 10000,        // Request timeout in ms
  retries: 3,            // Number of retries
  parallelChecks: true,  // Run checks in parallel
  skipWallet: false,     // Skip wallet checks
  skipGasCheck: false,   // Skip gas balance checks
  verbose: false,        // Enable verbose logging
};
```

### NetworkRetryManager

Advanced retry logic with intelligent endpoint selection and circuit breaker patterns.

**Key Features:**
- Exponential backoff with jitter
- Circuit breaker protection
- Load balancing strategies (health, priority, round-robin, response-time)
- Adaptive delay based on network conditions
- Health score tracking per endpoint

**Usage:**
```typescript
const retryManager = new NetworkRetryManager(endpoints, {
  maxRetries: 5,
  initialDelay: 1000,
  maxDelay: 30000,
  timeoutMs: 10000,
  adaptiveDelay: true,
  loadBalancing: 'health',
});

const result = await retryManager.executeWithFailover(
  async (endpoint) => {
    // Your operation using the selected endpoint
    return await performOperation(endpoint.url);
  },
  'my-operation',
  ['sui-rpc'] // Optional: filter by endpoint types
);
```

### EndpointFallbackManager

Manages endpoint failover with automatic recovery and intelligent switching strategies.

**Key Features:**
- Sequential, parallel, or adaptive failover strategies
- Automatic primary endpoint recovery
- Circuit breaker integration
- Health monitoring and pattern detection

**Configuration:**
```typescript
const fallbackConfig = {
  primary: primaryEndpoint,
  fallbacks: fallbackEndpoints,
  strategy: 'adaptive',           // sequential | parallel | adaptive
  healthCheckInterval: 30000,     // Health check frequency
  failoverThreshold: 3,           // Failures before failover
  enableAutomaticRecovery: true,  // Auto-recover to primary
  maxConcurrentFallbacks: 3,      // Max parallel attempts
};
```

### PreDeploymentValidator

Comprehensive validation system that checks all prerequisites before deployment.

**Validation Categories:**
- **Dependencies**: CLI tools availability and versions
- **Configuration**: Network settings and config file validation
- **Deployment**: Site path, file structure, and size validation
- **Wallet**: Address configuration and gas balance
- **Network**: Endpoint connectivity and health
- **Permissions**: File access and directory permissions

**Validation Options:**
```typescript
const options = {
  skipNetworkCheck: false,        // Skip network connectivity checks
  skipWalletCheck: false,         // Skip wallet validation
  skipGasCheck: false,            // Skip gas balance check
  skipDependencyCheck: false,     // Skip CLI tools check
  skipConfigValidation: false,    // Skip config file validation
  strictMode: false,              // Enable strict validation
  timeout: 30000,                 // Operation timeout
  minGasBalance: 1000000,         // Minimum gas in MIST
  maxDeploymentSize: 104857600,   // Max deployment size (100MB)
  requiredDependencies: ['sui', 'walrus'], // Required CLI tools
};
```

### NetworkMonitor

Real-time monitoring with event detection, pattern analysis, and automatic remediation.

**Monitoring Features:**
- Performance metrics tracking (response time, error rate, throughput)
- Network event detection and categorization
- Error pattern analysis and suggestions
- Automatic remediation triggers
- Diagnostic report generation

**Event Types:**
- `endpoint_failure`: Endpoint becomes unavailable
- `endpoint_recovery`: Endpoint recovers from failure
- `network_degradation`: Overall network performance degrades
- `performance_alert`: Response time or error rate thresholds exceeded
- `connectivity_issue`: General connectivity problems

### WalrusDeploymentHealthManager

Unified interface that combines all components for comprehensive deployment health management.

**Key Benefits:**
- Single initialization and configuration point
- Coordinated component interaction
- Event aggregation and unified monitoring
- Automatic component lifecycle management
- Deployment metrics and reporting

## Configuration

### Network-Specific Configurations

The system includes pre-configured settings for different networks:

#### Testnet Configuration
```typescript
const config = {
  network: 'testnet',
  sui: {
    primaryUrl: 'https://fullnode.testnet.sui.io:443',
    fallbackUrls: [
      'https://sui-testnet-endpoint.blockvision.org/v1',
      'https://sui-testnet.publicnode.com',
      'https://testnet.sui.rpcpool.com',
    ],
    websocketUrl: 'wss://fullnode.testnet.sui.io:443',
    faucetUrl: 'https://faucet.testnet.sui.io',
    expectedChainId: '4c78adac',
  },
  walrus: {
    publisherUrl: 'https://publisher-testnet.walrus.site',
    aggregatorUrl: 'https://aggregator-testnet.walrus.site',
    fallbackPublisherUrls: [
      'https://walrus-testnet-publisher.nodes.guru',
      'https://walrus-testnet-publisher.blockscope.net',
    ],
  },
};
```

#### Mainnet Configuration
```typescript
const config = {
  network: 'mainnet',
  sui: {
    primaryUrl: 'https://fullnode.mainnet.sui.io:443',
    fallbackUrls: [
      'https://sui-mainnet-endpoint.blockvision.org/v1',
      'https://sui-mainnet.publicnode.com',
      'https://mainnet.sui.rpcpool.com',
    ],
    websocketUrl: 'wss://fullnode.mainnet.sui.io:443',
  },
  walrus: {
    publisherUrl: 'https://publisher.walrus.space',
    aggregatorUrl: 'https://aggregator.walrus.space',
    fallbackPublisherUrls: [],
  },
};
```

### Custom Configuration

You can also provide custom endpoint configurations:

```typescript
const customConfig = {
  network: 'testnet',
  enableMonitoring: true,
  enableAutomaticFailover: true,
  retryConfig: {
    maxRetries: 10,
    initialDelay: 2000,
    maxDelay: 60000,
    timeoutMs: 30000,
  },
  endpoints: {
    sui: {
      primary: 'https://custom-sui-rpc.example.com',
      fallbacks: ['https://backup-sui-rpc.example.com'],
    },
    walrus: {
      publisher: 'https://custom-walrus-publisher.example.com',
      aggregator: 'https://custom-walrus-aggregator.example.com',
      fallbackPublishers: ['https://backup-publisher.example.com'],
    },
  },
};

const healthManager = new WalrusDeploymentHealthManager(customConfig);
```

## Monitoring and Diagnostics

### Real-Time Monitoring

The system provides real-time monitoring capabilities:

```typescript
// Enable monitoring
await healthManager.startMonitoring();

// Listen for events
healthManager.on('metrics_updated', (metrics) => {
  console.log(`Network condition: ${metrics.networkCondition}`);
  console.log(`Error rate: ${(metrics.errorRate * 100).toFixed(1)}%`);
  console.log(`Response time: ${metrics.averageResponseTime}ms`);
});

healthManager.on('network_event', (event) => {
  console.log(`${event.severity}: ${event.message}`);
  if (event.suggestion) {
    console.log(`Suggestion: ${event.suggestion}`);
  }
});
```

### Diagnostic Reports

Generate comprehensive diagnostic reports:

```typescript
const report = healthManager.generateDiagnosticReport();

console.log('Diagnostic Report:', {
  networkCondition: report.metrics.networkCondition,
  healthScore: report.networkHealth.overall.score,
  activeEndpoints: report.metrics.activeEndpoints,
  failedEndpoints: report.metrics.failedEndpoints,
  recentEvents: report.events.length,
  patterns: report.patterns,
  recommendations: report.recommendations,
  estimatedImpact: report.estimatedImpact,
});
```

### Performance Metrics

Track deployment performance:

```typescript
// After deployment completion
const deploymentResult = healthManager.completeDeployment(true);

console.log('Deployment Metrics:', {
  duration: deploymentResult.duration,
  totalRequests: deploymentResult.networkMetrics.totalRequests,
  errorRate: deploymentResult.networkMetrics.errorRate,
  averageResponseTime: deploymentResult.networkMetrics.averageResponseTime,
  endpointSwitches: deploymentResult.networkMetrics.endpointSwitches,
});
```

## Error Handling and Recovery

### Automatic Recovery

The system includes several automatic recovery mechanisms:

1. **Circuit Breakers**: Temporarily disable failing endpoints
2. **Endpoint Failover**: Automatically switch to healthy endpoints
3. **Adaptive Retry**: Adjust retry timing based on network conditions
4. **Primary Recovery**: Automatically recover to primary endpoints when available

### Manual Intervention

You can also manually control the system:

```typescript
// Force switch to specific endpoint
fallbackManager.forceSwitchTo('https://backup-endpoint.example.com');

// Reset failed endpoints
fallbackManager.resetFailedEndpoints();

// Get current status
const status = fallbackManager.getStatus();
console.log('Current endpoint:', status.currentEndpoint);
console.log('Failed endpoints:', status.failedEndpoints);
```

## Best Practices

### 1. Configure Appropriate Timeouts

Set timeouts based on your network conditions and requirements:

```typescript
const config = {
  retryConfig: {
    timeoutMs: 30000,      // 30 seconds for operations
    maxRetries: 5,         // 5 retry attempts
    initialDelay: 1000,    // Start with 1 second delay
    maxDelay: 30000,       // Cap at 30 seconds
  },
};
```

### 2. Use Monitoring in Production

Always enable monitoring for production deployments:

```typescript
const healthManager = WalrusDeploymentHealthManager.forMainnet({
  enableMonitoring: true,
  enableAutomaticFailover: true,
  strictValidation: true,
});
```

### 3. Handle Events Appropriately

Set up proper event handling for your use case:

```typescript
healthManager.on('network_event', (event) => {
  // Log to your monitoring system
  if (event.severity === 'error') {
    logger.error(event.message, event.details);
    // Alert your operations team
  }
});
```

### 4. Validate Before Deployment

Always run pre-deployment validation:

```typescript
const validation = await healthManager.validateDeployment(context);

if (validation.overallStatus !== 'ready' && !force) {
  throw new Error('Deployment not ready: ' + validation.recommendedActions.join(', '));
}
```

### 5. Save Diagnostic Reports

Keep diagnostic reports for troubleshooting:

```typescript
const report = healthManager.generateDiagnosticReport();
fs.writeFileSync(`deployment-report-${Date.now()}.json`, JSON.stringify(report, null, 2));
```

## Troubleshooting

### Common Issues

#### High Error Rates
```typescript
// Check network metrics
const metrics = monitor.getCurrentMetrics();
if (metrics.errorRate > 0.2) {
  console.log('High error rate detected');
  console.log('Recommendations:', report.recommendations);
}
```

#### Endpoint Failures
```typescript
// Check endpoint health
const health = await healthChecker.checkHealth();
const failedEndpoints = [
  ...health.sui.fallbacks.filter(f => !f.available),
  ...health.walrus.fallbackPublishers.filter(f => !f.available),
];

if (failedEndpoints.length > 0) {
  console.log('Failed endpoints:', failedEndpoints.map(f => f.url));
}
```

#### Deployment Validation Failures
```typescript
const summary = await validator.validate(context);
const errors = summary.results.filter(r => !r.passed && r.severity === 'error');

for (const error of errors) {
  console.log(`❌ ${error.name}: ${error.message}`);
  if (error.suggestion) {
    console.log(`💡 ${error.suggestion}`);
  }
}
```

### Debug Mode

Enable verbose logging for debugging:

```typescript
const healthManager = WalrusDeploymentHealthManager.forTestnet({
  // ... other config
});

// Enable debug logging
process.env.DEBUG = 'NetworkHealthChecker,NetworkRetryManager,NetworkMonitor';
```

## Integration Examples

See `/examples/network-health-example.ts` for complete integration examples including:

1. Basic deployment with health checking
2. Standalone network health checking
3. Pre-deployment validation only
4. Custom configuration with monitoring
5. Quick health check for CI/CD

Run examples:
```bash
# Basic example
node examples/network-health-example.js 1

# Standalone health check
node examples/network-health-example.js 2

# Pre-validation only
node examples/network-health-example.js 3

# Custom configuration
node examples/network-health-example.js 4

# Quick CI/CD check
node examples/network-health-example.js 5
```

## API Reference

For complete API documentation, see the TypeScript interfaces and JSDoc comments in each component file:

- `/src/utils/NetworkHealthChecker.ts`
- `/src/utils/NetworkRetryManager.ts`
- `/src/utils/EndpointFallbackManager.ts`
- `/src/utils/PreDeploymentValidator.ts`
- `/src/utils/NetworkMonitor.ts`
- `/src/utils/WalrusDeploymentHealthManager.ts`