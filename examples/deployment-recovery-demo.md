# Walrus Sites Deployment Recovery Demo

This demo showcases the robust deployment recovery system for Walrus Sites, demonstrating how to handle various failure scenarios and recover gracefully.

## Demo Scenarios

### Scenario 1: Basic Deployment with Recovery

```bash
# Start a new deployment
waltodo deploy-site out/ --site-name demo-app --network testnet --progress

# If deployment fails, you'll see recovery options:
# ❌ Deployment Failed
# 💡 Recovery Options:
#   • Resume: waltodo deploy-site --resume deploy_1640995200000_a1b2
#   • Status: waltodo deploy-site --deployment-status deploy_1640995200000_a1b2
#   • Cancel: waltodo deploy-site --cancel deploy_1640995200000_a1b2
```

### Scenario 2: Network Interruption Recovery

```bash
# Simulate network interruption during deployment
# (Network goes down during file uploads)

# Check deployment status
waltodo deploy-site --deployment-status deploy_1640995200000_a1b2

# Resume from last checkpoint
waltodo deploy-site --resume deploy_1640995200000_a1b2

# The system will:
# 1. Validate existing uploads
# 2. Skip already uploaded files
# 3. Resume from interruption point
# 4. Continue with remaining files
```

### Scenario 3: Partial Upload Recovery

```bash
# Start deployment
waltodo deploy-site out/ --site-name partial-demo --network testnet

# If some files fail to upload:
# - System tracks individual file status
# - Failed files are retried automatically
# - Successful uploads are preserved

# Check detailed status
waltodo deploy-site --deployment-status deploy_1640995200000_a1b2
# Shows:
# Progress: 60% (18/30 files)
# Uploaded Files: 18
# Failed Files: 2 (style.css, logo.png)
# Current File: app.js

# Resume will retry only failed files
waltodo deploy-site --resume deploy_1640995200000_a1b2
```

### Scenario 4: Blockchain Transaction Failure

```bash
# Deployment succeeds but site creation fails
# (Insufficient gas, network congestion, etc.)

# Status shows:
waltodo deploy-site --deployment-status deploy_1640995200000_a1b2
# File uploads: ✅ Completed (100%)
# Manifest creation: ✅ Completed
# Site registration: ❌ Failed (insufficient gas)

# Resume will retry blockchain operations
waltodo deploy-site --resume deploy_1640995200000_a1b2 --timeout 600
```

### Scenario 5: Rollback to Previous Version

```bash
# Deploy new version
waltodo deploy-site out/ --site-name prod-app --network mainnet

# If deployment has issues, rollback quickly
waltodo deploy-site --rollback deploy_1640995200000_a1b2

# System will:
# 1. Restore previous site configuration
# 2. Clean up failed deployment artifacts
# 3. Update site to point to previous version
# 4. Confirm rollback success
```

### Scenario 6: Monitoring and Management

```bash
# List all deployments
waltodo deploy-site --list-deployments

# Output:
# 📋 Active and Recent Deployments
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# COMPLETED    deploy_1640995100000_x1y2
#    Site: demo-app
#    Started: 12/31/2023, 2:00:00 PM

# FAILED       deploy_1640995200000_a1b2
#    Site: prod-app
#    Started: 12/31/2023, 2:10:00 PM (45%)

# UPLOADING    deploy_1640995300000_z3w4
#    Site: test-app
#    Started: 12/31/2023, 2:15:00 PM (75%)

# Get detailed status
waltodo deploy-site --deployment-status deploy_1640995200000_a1b2

# Cancel active deployment
waltodo deploy-site --cancel deploy_1640995300000_z3w4

# Clean up old deployments
waltodo deploy-site --cleanup-old 7
```

## Using the Enhanced Deployment Script

The enhanced script provides a user-friendly interface to all recovery features:

### Basic Usage

```bash
# Navigate to frontend directory
cd waltodo-frontend/walrus-site-waltodo

# Make script executable (if not already)
chmod +x scripts/deploy-walrus-site-enhanced.sh

# Basic deployment
./scripts/deploy-walrus-site-enhanced.sh --site-name my-app --network testnet

# Deploy with custom settings
./scripts/deploy-walrus-site-enhanced.sh \
  --site-name prod-app \
  --network mainnet \
  --epochs 10 \
  --max-retries 5 \
  --timeout 600 \
  --verbose
```

### Recovery Operations

```bash
# Resume failed deployment
./scripts/deploy-walrus-site-enhanced.sh --resume deploy_1640995200000_a1b2

# Rollback deployment
./scripts/deploy-walrus-site-enhanced.sh --rollback deploy_1640995200000_a1b2

# Monitor deployment progress
./scripts/deploy-walrus-site-enhanced.sh --monitor --status deploy_1640995200000_a1b2

# List all deployments
./scripts/deploy-walrus-site-enhanced.sh --list-deployments

# Clean up old deployments
./scripts/deploy-walrus-site-enhanced.sh --cleanup-old 7
```

## Recovery Scenarios in Detail

### Network Interruption Handling

```typescript
// The system automatically detects network issues
// and creates recovery checkpoints

const recoveryManager = new DeploymentRecoveryManager();

// During upload failure
await recoveryManager.recordError(deploymentId, {
  type: 'network',
  message: 'Connection timeout during upload',
  recoverable: true
});

// Resume process validates existing uploads
const recovered = await recoveryManager.recoverDeployment(deploymentId);
if (recovered) {
  // Continue from last successful point
  await deploymentService.resumeDeployment(deploymentId);
}
```

### State Persistence

```bash
# Deployment state is saved to disk
~/.walrus-deployment/
├── state/
│   ├── deploy_1640995200000_a1b2.json
│   └── deploy_1640995300000_z3w4.json
├── checkpoints/
│   ├── deploy_1640995200000_a1b2/
│   │   ├── initialization_1640995201000.json
│   │   └── upload_progress_1640995210000.json
│   └── deploy_1640995300000_z3w4/
└── temp/
    └── deploy_1640995200000_a1b2/
```

### Error Recovery Patterns

```typescript
// Different error types have different recovery strategies

interface ErrorRecoveryStrategy {
  network: {
    maxRetries: 3;
    backoffMultiplier: 2;
    retryDelay: 5000;
  };
  storage: {
    validateExisting: true;
    skipCompleted: true;
    maxRetries: 2;
  };
  blockchain: {
    gasMultiplier: 1.2;
    maxRetries: 3;
    retryDelay: 10000;
  };
  validation: {
    requiresFix: true;
    canResume: false;
  };
}
```

## Testing Recovery Scenarios

### Simulated Failures

```bash
# Test network interruption
# (Disconnect network during deployment)
sudo ifconfig en0 down
waltodo deploy-site out/ --site-name test-app
# Wait for upload to start, then:
sudo ifconfig en0 up
waltodo deploy-site --resume <deployment-id>

# Test insufficient gas
# (Use low gas budget)
waltodo deploy-site out/ --site-name test-app --network testnet
# Edit gas budget in Sui config to very low value
# Resume with normal gas budget

# Test storage failures
# (Use invalid Walrus endpoint)
export WALRUS_AGGREGATOR_URL=https://invalid.endpoint
waltodo deploy-site out/ --site-name test-app
# Fix endpoint and resume
export WALRUS_AGGREGATOR_URL=https://aggregator-testnet.walrus.space
waltodo deploy-site --resume <deployment-id>
```

### Recovery Validation

```bash
# Verify recovery capabilities
./scripts/deploy-walrus-site-enhanced.sh --help

# Test CLI availability
waltodo deploy-site --help

# Check state directory
ls -la ~/.walrus-deployment/

# Validate configuration
waltodo configure --network testnet
```

## Best Practices Demo

### 1. Always Enable Progress Tracking

```bash
# Good: Shows progress and enables monitoring
waltodo deploy-site out/ --site-name my-app --progress --verbose

# Better: Use enhanced script with monitoring
./scripts/deploy-walrus-site-enhanced.sh \
  --site-name my-app \
  --progress \
  --verbose \
  --monitor
```

### 2. Test on Testnet First

```bash
# Deploy to testnet first
./scripts/deploy-walrus-site-enhanced.sh \
  --site-name my-app-test \
  --network testnet

# If successful, deploy to mainnet
./scripts/deploy-walrus-site-enhanced.sh \
  --site-name my-app \
  --network mainnet
```

### 3. Regular Cleanup

```bash
# Clean up weekly
./scripts/deploy-walrus-site-enhanced.sh --cleanup-old 7

# Or set up cron job
echo "0 2 * * 0 cd $PWD && ./scripts/deploy-walrus-site-enhanced.sh --cleanup-old 7" | crontab -
```

### 4. Monitor Large Deployments

```bash
# For large deployments, use monitoring
./scripts/deploy-walrus-site-enhanced.sh \
  --site-name large-app \
  --network mainnet \
  --timeout 1800 \
  --max-retries 5 &

# Get deployment ID and monitor
DEPLOY_ID=$(waltodo deploy-site --list-deployments | grep "large-app" | awk '{print $2}')
./scripts/deploy-walrus-site-enhanced.sh --monitor --status $DEPLOY_ID
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Deploy to Walrus Sites
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: |
          cd waltodo-frontend
          npm install
          
      - name: Build
        run: |
          cd waltodo-frontend
          npm run build:export
          
      - name: Deploy with Recovery
        run: |
          cd waltodo-frontend/walrus-site-waltodo
          ./scripts/deploy-walrus-site-enhanced.sh \
            --site-name production-app \
            --network mainnet \
            --timeout 1800 \
            --max-retries 3
        env:
          WALRUS_CONFIG_PATH: ${{ secrets.WALRUS_CONFIG_PATH }}
          WALRUS_WALLET_PATH: ${{ secrets.WALRUS_WALLET_PATH }}
          
      - name: Rollback on Failure
        if: failure()
        run: |
          # Get last successful deployment
          LAST_DEPLOY=$(waltodo deploy-site --list-deployments | grep "COMPLETED" | head -1 | awk '{print $2}')
          if [ ! -z "$LAST_DEPLOY" ]; then
            waltodo deploy-site --rollback $LAST_DEPLOY
          fi
```

## Conclusion

The Walrus Sites deployment recovery system provides:

✅ **Robust Error Handling**: Automatic recovery from common failure scenarios
✅ **State Persistence**: Never lose deployment progress
✅ **Flexible Recovery**: Resume, rollback, or retry as needed
✅ **Real-time Monitoring**: Track progress and health
✅ **Easy Management**: Simple CLI commands for all operations
✅ **Production Ready**: Battle-tested recovery mechanisms

The system ensures that deployment failures are temporary setbacks rather than permanent roadblocks, providing confidence in production deployments to Walrus Sites.