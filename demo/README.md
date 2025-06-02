# WalTodo Convergence Demo

Comprehensive demonstration of the complete WalTodo CLI-Frontend convergence infrastructure.

## Overview

This demo showcases the fully integrated WalTodo system with real-time synchronization between CLI and frontend, multi-wallet isolation, WebSocket event broadcasting, and performance validation.

## Demo Components

### 1. Complete Convergence Demo (`complete-convergence-demo.sh`)
Main demo script that orchestrates all services and runs comprehensive tests.

### 2. Test Scenarios (`test-scenarios.json`)
Predefined test data and scenarios for consistent demo execution.

### 3. Acceptance Criteria Validator (`../scripts/verify-acceptance-criteria.js`)
Automated validation of all acceptance criteria.

## Demo Phases

### Phase 1: Environment Setup
- Validates prerequisites (Node.js, pnpm, curl, jq)
- Checks CLI build status
- Loads test scenarios

### Phase 2: Service Startup
- Starts API server on port 3001
- Starts frontend on port 3000
- Validates service health endpoints

### Phase 3: CLI-Frontend Synchronization
- **CLI → Frontend**: Add todo via CLI, verify in frontend API
- **Frontend → CLI**: Complete todo via API, verify in CLI
- Validates sync timing ≤ 2 seconds

### Phase 4: Multi-Wallet Isolation
- Tests data isolation between different wallet addresses
- Verifies todos are scoped to specific wallets
- Confirms no cross-wallet data leakage

### Phase 5: WebSocket Events
- Tests WebSocket connection status
- Generates real-time events
- Validates event broadcasting and processing

### Phase 6: Performance Validation
- CLI response time testing (< 1000ms)
- API response time testing (< 500ms)
- Lighthouse performance testing (≥ 90 score)

### Phase 7: Acceptance Criteria Validation
- Automated validation of all acceptance criteria
- Manual checklist verification

### Phase 8: Demo Summary
- Results overview
- Service status report
- Next steps recommendations

## Running the Demo

### Prerequisites

```bash
# Install dependencies
pnpm install

# Build CLI
pnpm build

# Install CLI globally
pnpm run global-install
```

### Execute Demo

```bash
# Run complete demo
./demo/complete-convergence-demo.sh

# Or with custom ports
API_PORT=3001 FRONTEND_PORT=3000 ./demo/complete-convergence-demo.sh
```

### Manual Testing Scenarios

After running the automated demo, test these scenarios manually:

#### Scenario 1: Basic CLI-Frontend Sync
1. Open frontend at http://localhost:3000
2. Add todo via CLI: `waltodo add "Manual test todo"`
3. Verify todo appears in frontend within 2 seconds
4. Complete todo in frontend
5. Verify completion in CLI: `waltodo list`

#### Scenario 2: Multi-Wallet Switching
1. Set wallet 1: `export SUI_WALLET_ADDRESS=0x123...`
2. Add todos via CLI
3. Switch to wallet 2 in frontend
4. Verify different todo list
5. Add todos via frontend
6. Switch back to wallet 1 and verify isolation

#### Scenario 3: Real-time Updates
1. Open frontend in two browser tabs
2. Add todo in tab 1
3. Verify real-time update in tab 2
4. Complete todo in tab 2
5. Verify real-time update in tab 1

#### Scenario 4: Error Handling
1. Stop API server
2. Try adding todo via frontend
3. Verify error handling and user feedback
4. Restart API server
5. Verify automatic reconnection

## Test Data Structure

The demo uses structured test data defined in `test-scenarios.json`:

```json
{
  "wallets": [
    {
      "address": "0x1234567890abcdef1234567890abcdef12345678",
      "name": "Demo Wallet 1",
      "todos": [
        {
          "title": "Wallet 1 Todo 1",
          "list": "demo-list-1"
        }
      ]
    }
  ],
  "sync_tests": [
    {
      "name": "CLI to Frontend Sync",
      "action": "cli_add",
      "data": {
        "title": "CLI Sync Test",
        "list": "sync-test"
      },
      "verification": "frontend_api",
      "max_time_seconds": 2
    }
  ]
}
```

## Performance Benchmarks

### Acceptance Criteria
- **Sync Time**: CLI ↔ Frontend synchronization ≤ 2 seconds
- **CLI Response**: Command execution < 1000ms
- **API Response**: Endpoint response < 500ms
- **Frontend Score**: Lighthouse performance ≥ 90

### Monitoring

```bash
# Monitor API logs
tail -f api.log

# Monitor frontend logs
tail -f frontend.log

# Monitor WebSocket connections
curl http://localhost:3001/api/ws-status
```

## Troubleshooting

### Common Issues

#### Services Not Starting
```bash
# Check port availability
lsof -i :3000
lsof -i :3001

# Kill conflicting processes
pkill -f "next dev"
pkill -f "start-api-server"
```

#### Sync Not Working
```bash
# Check WebSocket connection
curl http://localhost:3001/api/ws-status

# Verify file watching
ls -la .waltodo-cache/

# Check sync engine logs
waltodo sync --status
```

#### Performance Issues
```bash
# Check system resources
top -p $(pgrep -f "node")

# Profile API performance
curl -w "@curl-format.txt" http://localhost:3001/api/v1/todos

# Check frontend bundle size
pnpm analyze
```

### Debug Mode

```bash
# Run demo with debug output
DEBUG=1 ./demo/complete-convergence-demo.sh

# Enable verbose CLI output
export WALTODO_DEBUG=1

# Enable API debug logs
export NODE_ENV=development
export DEBUG=api:*
```

## Integration with CI/CD

### GitHub Actions Integration

```yaml
# .github/workflows/convergence-demo.yml
name: Convergence Demo
on: [push, pull_request]

jobs:
  demo:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: pnpm install
      - run: pnpm build
      - run: ./demo/complete-convergence-demo.sh
      - uses: actions/upload-artifact@v3
        with:
          name: demo-results
          path: demo/results/
```

### Pre-deployment Validation

```bash
# Staging deployment validation
STAGING_URL=https://staging.waltodo.app ./demo/complete-convergence-demo.sh

# Production readiness check
PRODUCTION_MODE=1 ./demo/complete-convergence-demo.sh
```

## Results and Reporting

The demo generates comprehensive reports:

- **Performance Report**: `demo/lighthouse-report.json`
- **Sync Timing**: Console output with detailed timing
- **Error Log**: Any failures or warnings during demo
- **Coverage Report**: Test coverage of demo scenarios

## Next Steps

After successful demo completion:

1. **Review Results**: Check all acceptance criteria are met
2. **Manual Testing**: Perform additional manual scenarios
3. **E2E Testing**: Run full E2E test suite
4. **Performance Tuning**: Address any performance issues
5. **Deployment**: Deploy to staging/production environment

## Demo Video Recording

To record the demo for documentation:

```bash
# Install recording tools
brew install asciinema

# Record demo session
asciinema rec demo-recording.cast
./demo/complete-convergence-demo.sh
# Press Ctrl+D when finished

# Upload to asciinema.org
asciinema upload demo-recording.cast
```

## Contributing

To add new demo scenarios:

1. Update `test-scenarios.json` with new test data
2. Add scenario logic to `complete-convergence-demo.sh`
3. Update this README with scenario documentation
4. Test thoroughly before committing

## Support

For issues with the demo:

1. Check troubleshooting section above
2. Review logs in `demo/` directory
3. Create GitHub issue with demo output
4. Contact development team
