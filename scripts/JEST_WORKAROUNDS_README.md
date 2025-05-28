# Jest Execution Workarounds

This directory contains a comprehensive system for handling Jest execution issues across different environments, platforms, and failure scenarios.

## 🚀 Quick Start

```bash
# Setup the workarounds (one-time)
pnpm run test:setup

# Run tests with automatic fallbacks
pnpm test

# Validate your environment
pnpm run test:validate:quick
```

## 📁 Files Overview

### Core Scripts

- **`test-runner.js`** - Main test runner with multiple execution strategies
- **`jest-environment-setup.js`** - Environment configuration and optimization
- **`jest-error-handler.js`** - Comprehensive error handling and recovery
- **`jest-validation.js`** - Validation script to test all execution methods
- **`setup-jest-workarounds.sh`** - One-time setup script

## 🎯 Execution Strategies

The test runner tries multiple strategies in order:

1. **pnpm Jest** - Use pnpm to run Jest (preferred)
2. **npx Jest** - Use npx to run Jest (fallback)
3. **Node.js Direct** - Run Jest via Node.js directly
4. **Direct Binary** - Execute Jest binary directly
5. **Fallback Runner** - Custom test execution without Jest framework

## 📋 Available Commands

### Basic Testing
```bash
pnpm test                    # Robust test runner (automatic fallbacks)
pnpm test:legacy             # Original Jest execution method
pnpm test:unit               # Unit tests with fallbacks
pnpm test:integration        # Integration tests with fallbacks
```

### Strategy Selection
```bash
pnpm test:pnpm               # Force pnpm strategy
pnpm test:npx                # Force npx strategy  
pnpm test:direct             # Force direct binary execution
pnpm test:fallback           # Force fallback custom runner
```

### Diagnostics & Validation
```bash
pnpm test:diagnostic         # Generate diagnostic report
pnpm test:validate           # Full validation of all strategies
pnpm test:validate:quick     # Quick validation check
pnpm test:setup              # Setup and validate environment
```

### Advanced Options
```bash
pnpm test:verbose            # Verbose output
pnpm test:watch              # Watch mode with fallbacks
pnpm test:coverage           # Coverage with fallbacks
pnpm test:bailout            # Stop on first failure
```

## 🔧 Environment Configuration

The system automatically configures:

- **Memory Settings** - Optimized for CI vs local development
- **Worker Configuration** - Adaptive based on CPU cores and environment
- **Timeout Settings** - Different timeouts for different test types
- **Platform Optimizations** - Windows, macOS, Linux specific settings

### Manual Environment Setup

```bash
# Check environment requirements
node scripts/jest-environment-setup.js --validate

# Generate environment report
node scripts/jest-environment-setup.js --report

# Apply environment configuration
node scripts/jest-environment-setup.js
```

## 🛡️ Error Handling

The error handler provides:

- **Error Classification** - Categorizes errors for appropriate recovery
- **Recovery Strategies** - Specific suggestions for each error type
- **Automatic Recovery** - Attempts to fix certain issues automatically
- **Error History** - Tracks patterns for better diagnosis

### Error Types Handled

- **ENOENT** - Command not found (missing binaries)
- **EACCES** - Permission denied (file permissions)
- **ENOMEM** - Out of memory (memory optimization)
- **MODULE_NOT_FOUND** - Module resolution errors
- **TIMEOUT_ERROR** - Test execution timeouts
- **JEST_CONFIG_ERROR** - Configuration issues

### Manual Error Analysis

```bash
# Generate error report
node scripts/jest-error-handler.js --report

# Get error classification help
node scripts/jest-error-handler.js --help
```

## 🧪 Validation System

The validation system tests:

- Environment requirements
- All execution strategies
- Error handling mechanisms
- Real-world scenarios
- Configuration validity

```bash
# Full validation (recommended for setup)
node scripts/jest-validation.js

# Quick validation (for regular checks)
node scripts/jest-validation.js --quick

# Help and options
node scripts/jest-validation.js --help
```

## 📊 Diagnostic Reports

Several diagnostic reports are generated:

- **`jest-runner-diagnostic.json`** - Test runner environment analysis
- **`jest-environment-report.json`** - Environment configuration details
- **`jest-error-report.json`** - Error history and patterns
- **`jest-validation-report.json`** - Validation results and recommendations

## 🔍 Troubleshooting

### Common Issues

1. **"jest: command not found"**
   ```bash
   # Solution: Use npx strategy
   pnpm test:npx
   ```

2. **"Out of memory" errors**
   ```bash
   # Solution: Reduce workers or increase memory
   NODE_OPTIONS="--max-old-space-size=8192" pnpm test
   # Or use fallback
   pnpm test:fallback
   ```

3. **Permission denied**
   ```bash
   # Solution: Fix permissions or use npx
   chmod +x node_modules/.bin/jest
   # Or
   pnpm test:npx
   ```

4. **Module not found**
   ```bash
   # Solution: Clear cache and reinstall
   rm -rf node_modules
   pnpm install
   npx jest --clearCache
   ```

### Debug Mode

```bash
# Enable verbose logging
DEBUG=1 pnpm test

# Generate full diagnostic
pnpm test:diagnostic

# Check specific strategy
node scripts/test-runner.js --strategy=npx --help
```

## 🏗️ CI/CD Integration

The system is optimized for CI environments:

```yaml
# GitHub Actions example
- name: Setup Jest Workarounds
  run: pnpm run test:setup

- name: Run Tests with Fallbacks
  run: pnpm test
  env:
    CI: true

- name: Generate Reports on Failure
  if: failure()
  run: |
    pnpm test:diagnostic
    pnpm test:validate
```

## 🔧 Customization

### Adding New Strategies

1. Add method to `JestTestRunner` class in `test-runner.js`
2. Add strategy name to `this.strategies` array
3. Update package.json scripts
4. Add validation tests

### Environment Variables

- `NODE_ENV` - Environment mode (test/development/production)
- `CI` - CI environment detection
- `DEBUG` - Enable debug logging
- `JEST_MAX_WORKERS` - Override worker count
- `NODE_OPTIONS` - Node.js runtime options

## 📈 Performance Optimization

The system includes several optimizations:

- **Memory Management** - Dynamic memory allocation based on environment
- **Worker Allocation** - Adaptive worker count based on CPU and memory
- **Caching** - Intelligent caching of configuration and results
- **Timeout Management** - Environment-specific timeout settings

## 🤝 Contributing

When adding new features:

1. Update the appropriate script(s)
2. Add validation tests in `jest-validation.js`
3. Update error handling in `jest-error-handler.js`
4. Add package.json scripts if needed
5. Update this documentation

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [Node.js Memory Management](https://nodejs.org/en/docs/guides/debugging-getting-started/)
- [CI Environment Best Practices](https://docs.github.com/en/actions/using-workflows)

---

For more information, run `pnpm test:setup` or check the diagnostic reports generated in the project root.