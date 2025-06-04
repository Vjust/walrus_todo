# Walrus Sites Deployment Diagnostics System

## Overview

The Walrus Sites Deployment Diagnostics System is a comprehensive solution for identifying, diagnosing, and recovering from deployment failures. It provides detailed error analysis, troubleshooting guides, and automated recovery capabilities.

## Components

### 1. Deployment Diagnostics (`deployment-diagnostics.ts`)

The core diagnostic engine that performs comprehensive checks before and during deployment.

#### Features:
- **Pre-deployment validation** - Environment, network, configuration checks
- **Real-time error analysis** - Pattern matching for common error types
- **Categorized diagnostics** - Network, authentication, build, configuration issues
- **Severity levels** - Critical, warning, and info classifications
- **Recovery recommendations** - Specific steps to resolve each issue

#### Usage:
```typescript
const diagnostics = new DeploymentDiagnostics();
const results = await diagnostics.runDiagnostics(config);
const report = diagnostics.generateReport(results, config);
```

### 2. Deployment Logger (`deployment-logger.ts`)

Advanced logging system for tracking deployment progress and performance.

#### Features:
- **Session tracking** - Unique session IDs with complete deployment lifecycle
- **Performance metrics** - Build times, upload duration, file sizes
- **Error correlation** - Links errors to specific deployment phases
- **Structured logging** - JSON format for easy analysis
- **Report generation** - Summary reports with recommendations

#### Usage:
```typescript
const logger = new DeploymentLogger({
  network: 'testnet',
  siteName: 'my-app',
  buildDir: 'out'
});

logger.info(DeploymentLogCategory.BUILD, 'Starting build process');
logger.startTiming('build');
// ... deployment logic
logger.endTiming('build');
```

### 3. Troubleshooting Guide (`deployment-troubleshooting.ts`)

Comprehensive troubleshooting guides for different error categories.

#### Features:
- **Error pattern matching** - Automatic guide selection based on error messages
- **Step-by-step solutions** - Detailed recovery procedures
- **Difficulty ratings** - Easy, medium, hard classifications
- **Time estimates** - Expected resolution times
- **Command examples** - Ready-to-run commands for fixes

#### Usage:
```typescript
const troubleshooting = new DeploymentTroubleshooting();
const guide = troubleshooting.getGuideForError(errorMessage);
const markdown = troubleshooting.generateMarkdownGuide(guide);
```

### 4. Recovery System (`deployment-recovery.ts`)

Automated recovery system for common deployment failures.

#### Features:
- **Strategy-based recovery** - Multiple recovery approaches per error type
- **Auto-executable strategies** - Safe automated fixes
- **Manual intervention** - Guided steps for complex issues
- **Priority ordering** - Most effective strategies first
- **Rollback capability** - Safe recovery with minimal risk

#### Usage:
```typescript
const recovery = new DeploymentRecoverySystem(logger);
const result = await recovery.attemptRecovery(diagnostic, config, autoExecute);
```

### 5. Enhanced Deployment Command (`deploy/enhanced.ts`)

CLI command that integrates all diagnostic capabilities.

#### Features:
- **Pre-deployment diagnostics** - Comprehensive system checks
- **Retry mechanisms** - Configurable retry logic with exponential backoff
- **Automatic recovery** - Integration with recovery system
- **Detailed logging** - Complete deployment tracking
- **Progress indicators** - Real-time status updates

## Error Categories

### Network Connectivity
- Connection refused errors
- Timeouts during deployment
- DNS resolution failures
- Firewall blocking connections

**Common Fixes:**
- Network connectivity tests
- Firewall configuration
- DNS cache clearing
- Alternative endpoints

### Authentication & Wallet
- Wallet file missing or corrupted
- Insufficient SUI balance
- Wrong network configuration
- Permission issues

**Common Fixes:**
- Wallet verification and import
- Balance checks and funding
- Network switching
- Permission corrections

### Build & Configuration
- Build process failures
- Missing configuration files
- Invalid YAML/JSON syntax
- Build output validation

**Common Fixes:**
- Clean rebuilds
- Configuration file creation
- Syntax validation
- Dependency installation

### Environment Setup
- Missing CLI tools
- Incorrect PATH configuration
- Version compatibility issues
- System requirements

**Common Fixes:**
- CLI installation
- Environment variable setup
- Version upgrades
- Dependency resolution

## Usage Examples

### Basic Diagnostics
```bash
# Run diagnostics only
waltodo deploy:diagnostics

# Analyze specific error
waltodo deploy:diagnostics --analyze-error "connection refused"

# Save diagnostic report
waltodo deploy:diagnostics --save-report diagnostics.md
```

### Enhanced Deployment
```bash
# Deploy with auto-recovery
waltodo deploy:enhanced --auto-recover

# Force rebuild and save logs
waltodo deploy:enhanced --force-rebuild --save-logs

# Diagnostics only mode
waltodo deploy:enhanced --diagnostics-only
```

### Recovery Operations
```bash
# Attempt automatic fixes
waltodo deploy:diagnostics --fix

# Test recovery strategy
waltodo deploy:diagnostics --test-strategy rebuild-application
```

## Configuration

### Deployment Config Structure
```typescript
interface DeploymentConfig {
  network: 'testnet' | 'mainnet';
  buildDir: string;
  siteConfigFile: string;
  walletPath?: string;
  configDir: string;
  siteName: string;
}
```

### Logging Configuration
```typescript
interface LoggerConfig {
  network: string;
  siteName: string;
  buildDir: string;
  logDir?: string;
}
```

## Diagnostic Categories

| Category | Description | Common Issues |
|----------|-------------|---------------|
| `NETWORK` | Connectivity and network issues | Connection refused, timeouts |
| `AUTHENTICATION` | Wallet and credential issues | Missing wallet, insufficient funds |
| `CONFIGURATION` | Config file and setup issues | Missing files, invalid syntax |
| `BUILD` | Build process and output issues | Build failures, missing files |
| `BLOCKCHAIN` | Sui network and RPC issues | Network congestion, RPC errors |
| `ENVIRONMENT` | System and tool setup issues | Missing tools, PATH issues |
| `PERMISSIONS` | File and directory access issues | Permission denied, EACCES |
| `RESOURCES` | System resource constraints | Memory, disk space, CPU |

## Recovery Strategies

### Automatic Recovery
Safe operations that can be performed without user intervention:
- Clean and rebuild application
- Create default configuration files
- Fix file permissions (with caution)
- Network retry with backoff
- Environment variable setup

### Manual Recovery
Operations requiring user confirmation or input:
- Wallet creation and import
- System-level software installation
- Network configuration changes
- Security-sensitive operations

## Best Practices

### 1. Pre-deployment Checks
Always run diagnostics before deployment:
```bash
waltodo deploy:diagnostics --network testnet
```

### 2. Enable Logging
Use detailed logging for troubleshooting:
```bash
waltodo deploy:enhanced --save-logs --verbose
```

### 3. Auto-recovery for CI/CD
Enable auto-recovery in automated environments:
```bash
waltodo deploy:enhanced --auto-recover --max-retries 5
```

### 4. Regular Diagnostics
Run diagnostics regularly to catch issues early:
```bash
# Add to CI pipeline
waltodo deploy:diagnostics --network testnet --save-report
```

## Error Patterns and Solutions

### Connection Refused
**Pattern:** `connection refused|ECONNREFUSED`
**Solution:** Network connectivity check → Firewall check → Endpoint verification

### Build Failures
**Pattern:** `build failed|compilation error`
**Solution:** Clean build → Dependency check → Configuration validation

### Authentication Issues
**Pattern:** `authentication failed|unauthorized`
**Solution:** Wallet verification → Balance check → Network configuration

### Configuration Errors
**Pattern:** `config.*not found|configuration error`
**Solution:** File existence check → Syntax validation → Default creation

## Integration

### CLI Integration
The diagnostic system is integrated into the main CLI through:
- `deploy:diagnostics` - Standalone diagnostics command
- `deploy:enhanced` - Enhanced deployment with diagnostics
- Built-in error analysis in all deployment commands

### Programmatic Usage
```typescript
import { 
  DeploymentDiagnostics, 
  DeploymentLogger, 
  DeploymentRecoverySystem 
} from '../utils/deployment-diagnostics';

// Create diagnostic instance
const diagnostics = new DeploymentDiagnostics();

// Run diagnostics
const results = await diagnostics.runDiagnostics(config);

// Attempt recovery
const recovery = new DeploymentRecoverySystem();
const recoveryResult = await recovery.attemptRecovery(result, config);
```

## Monitoring and Analytics

### Session Tracking
Each deployment creates a unique session with:
- Session ID for correlation
- Start/end timestamps
- Complete error history
- Performance metrics
- Recovery attempts

### Performance Metrics
Tracked metrics include:
- Build duration
- Upload time
- Publish duration
- Total deployment time
- Build size and file count
- Network latency
- Retry count

### Error Analytics
Error tracking provides:
- Error categorization
- Frequency analysis
- Recovery success rates
- Common failure patterns
- Resolution time tracking

## Troubleshooting Common Issues

### "site-builder not found"
1. Check if Walrus CLI is installed
2. Verify PATH configuration
3. Install from official source
4. Set SITE_BUILDER_PATH environment variable

### "Connection refused"
1. Check internet connectivity
2. Verify Walrus endpoint accessibility
3. Check firewall settings
4. Try alternative networks

### "Build directory empty"
1. Run build process: `pnpm run build`
2. Check for build errors
3. Verify build configuration
4. Check output directory path

### "Authentication failed"
1. Verify wallet file exists
2. Check wallet permissions (600)
3. Ensure sufficient SUI balance
4. Verify network configuration

## Future Enhancements

### Planned Features
- Machine learning for error prediction
- Integration with monitoring systems
- Automated performance optimization
- Advanced recovery strategies
- Cloud-based diagnostic sharing

### Community Contributions
- Custom recovery strategies
- Additional error patterns
- Troubleshooting guides
- Performance optimizations
- Testing scenarios

## Support and Resources

### Documentation
- [Walrus Sites Documentation](https://docs.walrus.site)
- [Sui Network Documentation](https://docs.sui.io)
- [WalTodo CLI Guide](./cli-plan.md)

### Community
- GitHub Issues for bug reports
- Discord for real-time support
- Community forums for discussions

### Monitoring
- Deployment logs in `logs/deployments/`
- Session files for historical analysis
- Performance metrics for optimization