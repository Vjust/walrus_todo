# Walrus Sites Build Validation System

This directory contains a comprehensive build validation and optimization system specifically designed for Walrus Sites deployment. The system ensures your Next.js static export is fully compatible with Walrus Sites hosting requirements.

## Overview

The build validation system consists of three main components:

1. **Build Validator** (`scripts/build-validator.sh`) - Comprehensive validation of static export output
2. **Asset Optimizer** (`scripts/asset-optimizer.sh`) - Optimization of assets for better performance
3. **Build Recovery** (`scripts/build-recovery.sh`) - Recovery mechanisms for build issues

## Quick Start

### Basic Validation
```bash
# Run build validation
pnpm run validate:build

# Optimize assets
pnpm run optimize:assets

# Deploy with validation
pnpm run deploy:walrus
```

### Build and Deploy with Optimization
```bash
# Build with automatic validation
pnpm run build:export

# Deploy with automatic optimization
cd walrus-site-waltodo
./scripts/deploy-walrus-site.sh --optimize
```

### Recovery Operations
```bash
# Diagnose build issues
pnpm run recover:diagnose

# Clean and rebuild
pnpm run recover:rebuild

# Emergency recovery
pnpm run recover:emergency
```

## Build Validator

### Features

- **Essential Files Validation**: Checks for required files (`index.html`, `404.html`, `_next`, `manifest.json`)
- **HTML Integrity**: Validates HTML structure, meta tags, and Walrus Sites compatibility
- **Asset Validation**: Checks CSS and JavaScript files for integrity and size
- **Performance Analysis**: Monitors build size, file count, and nesting depth
- **Walrus Sites Compatibility**: Validates SPA routing, service workers, and relative paths
- **Optimization Recommendations**: Suggests improvements for better performance

### Usage

```bash
# Basic validation
./scripts/build-validator.sh

# Validation with debug output
./scripts/build-validator.sh --debug

# Validate specific build directory
./scripts/build-validator.sh --build-dir ./custom-build
```

### Output

The validator generates a detailed JSON report (`build-validation-report.json`) containing:

- Validation results for each check
- Performance metrics
- Walrus Sites compatibility analysis
- Optimization recommendations
- Recovery suggestions

### Example Report Structure

```json
{
  "timestamp": "2025-06-02T10:30:00Z",
  "checks": {
    "build_exists": {
      "status": "pass",
      "message": "Build directory exists with 150 files"
    },
    "essential_files": {
      "status": "pass",
      "message": "All essential and optional files present"
    }
  },
  "summary": {
    "total_checks": 6,
    "passed": 5,
    "warnings": 1,
    "errors": 0
  },
  "recommendations": [
    {
      "message": "Consider optimizing large images",
      "priority": "medium"
    }
  ]
}
```

## Asset Optimizer

### Features

- **Image Optimization**: Compresses and resizes images using ImageMagick/FFmpeg
- **CSS Minification**: Removes whitespace, comments, and optimizes CSS
- **JavaScript Optimization**: Basic minification for non-minified JS files
- **Compression**: Creates gzip and optionally Brotli compressed versions
- **Backup System**: Automatically creates backups before optimization
- **Validation**: Ensures optimized files maintain integrity

### Usage

```bash
# Basic optimization
./scripts/asset-optimizer.sh

# Preview optimizations without applying
./scripts/asset-optimizer.sh --dry-run

# Optimize with custom settings
./scripts/asset-optimizer.sh --max-width 1280 --jpeg-quality 80

# Skip specific optimizations
./scripts/asset-optimizer.sh --no-images --no-js

# Enable Brotli compression
./scripts/asset-optimizer.sh --enable-brotli
```

### Configuration Options

- `--max-width WIDTH`: Maximum image width (default: 1920)
- `--max-height HEIGHT`: Maximum image height (default: 1080)
- `--jpeg-quality QUALITY`: JPEG quality 1-100 (default: 85)
- `--no-images`: Skip image optimization
- `--no-css`: Skip CSS minification
- `--no-js`: Skip JavaScript optimization
- `--enable-brotli`: Enable Brotli compression

### Recovery

If optimization causes issues, you can recover from the automatic backup:

```bash
# Recover from backup
./scripts/asset-optimizer.sh --recover
```

## Build Recovery

### Recovery Modes

1. **diagnose**: Analyze build issues without making changes
2. **clean**: Remove all build artifacts and caches
3. **rebuild**: Clean rebuild from scratch
4. **restore**: Restore from backup
5. **fix-missing**: Create missing essential files
6. **fix-corruption**: Fix corrupted files
7. **fix-dependencies**: Resolve dependency conflicts
8. **emergency**: Comprehensive recovery (all fixes)

### Usage

```bash
# Diagnose issues
./scripts/build-recovery.sh diagnose

# Clean rebuild (with confirmation)
./scripts/build-recovery.sh rebuild

# Automatic clean rebuild
./scripts/build-recovery.sh rebuild --auto

# Emergency recovery
./scripts/build-recovery.sh emergency --auto

# Preview recovery actions
./scripts/build-recovery.sh emergency --dry-run

# Restore from specific backup
./scripts/build-recovery.sh restore --backup-dir ./backup-20250602-103000
```

### Recovery Features

- **Automatic Diagnosis**: Identifies common build problems
- **Backup Restoration**: Restores from optimization or manual backups
- **Missing File Recovery**: Creates basic fallback files
- **Dependency Resolution**: Fixes package manager conflicts
- **Corruption Repair**: Attempts to repair corrupted files
- **Emergency Fallback**: Creates minimal working build as last resort

## Integration with Deployment

### Automatic Validation

The deployment script automatically runs validation:

```bash
# Deploy with automatic validation
./scripts/deploy-walrus-site.sh

# Deploy with automatic optimization
./scripts/deploy-walrus-site.sh --optimize
```

### Build Pipeline Integration

The build process includes validation:

```bash
# Build with validation
pnpm run build:export
```

This runs:
1. `pnpm run setup-config` - Configure for static export
2. `NEXT_EXPORT=true next build` - Build with static export
3. `pnpm run validate:build` - Validate output

### Package.json Scripts

Available npm scripts:

```json
{
  "build:export": "Setup config, build, and validate",
  "validate:build": "Run build validation",
  "optimize:assets": "Optimize build assets",
  "deploy:walrus": "Deploy to Walrus Sites",
  "recover:diagnose": "Diagnose build issues",
  "recover:clean": "Clean build artifacts",
  "recover:rebuild": "Clean rebuild",
  "recover:emergency": "Emergency recovery"
}
```

## Walrus Sites Compatibility

### Validation Checks

The system specifically validates for Walrus Sites requirements:

- **Static Export**: Ensures proper Next.js static export configuration
- **Relative Paths**: Validates no absolute URLs that won't work on Walrus
- **SPA Routing**: Checks for proper client-side routing setup
- **Service Worker**: Validates service worker compatibility
- **Manifest**: Ensures valid PWA manifest
- **404 Handling**: Checks for proper error page setup

### Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Absolute URLs in CSS/JS | Use relative paths or CDN |
| Missing 404 page | Create custom 404.html |
| Large bundle size | Enable code splitting and compression |
| Image optimization disabled | Enable `unoptimized: true` for static export |
| Service worker issues | Use relative URLs in service worker |

## Performance Thresholds

### Default Limits

- **Maximum build size**: 150MB
- **Maximum single file**: 25MB
- **Minimum required files**: 5
- **Maximum nesting depth**: 10 levels

### Customization

You can modify thresholds in the validator script:

```bash
# In build-validator.sh
MAX_BUILD_SIZE_MB=150
MAX_SINGLE_FILE_MB=25
MIN_REQUIRED_FILES=5
MAX_NESTING_DEPTH=10
```

## Troubleshooting

### Common Issues

1. **Build directory not found**
   ```bash
   pnpm run recover:diagnose
   pnpm run recover:rebuild
   ```

2. **Validation fails**
   ```bash
   # Check detailed report
   cat walrus-site-waltodo/build-validation-report.json
   
   # Fix issues automatically
   pnpm run optimize:assets
   ```

3. **Optimization corrupts files**
   ```bash
   # Recover from backup
   cd walrus-site-waltodo
   ./scripts/asset-optimizer.sh --recover
   ```

4. **Dependencies broken**
   ```bash
   pnpm run recover:diagnose
   ./scripts/build-recovery.sh fix-dependencies
   ```

### Debug Mode

Enable debug output for detailed information:

```bash
# Enable debug for all tools
DEBUG=true ./scripts/build-validator.sh
DEBUG=true ./scripts/asset-optimizer.sh
DEBUG=true ./scripts/build-recovery.sh diagnose
```

### Log Files

The system generates log files for troubleshooting:

- `build-validation-report.json` - Validation results
- `optimization-report.json` - Optimization results
- `recovery.log` - Recovery operations log

## Advanced Usage

### Custom Build Directory

```bash
# Validate custom build directory
./scripts/build-validator.sh --build-dir /path/to/custom/build

# Optimize custom build
./scripts/asset-optimizer.sh --build-dir /path/to/custom/build
```

### CI/CD Integration

```bash
# In CI/CD pipeline
pnpm run build:export || exit 1
pnpm run optimize:assets || echo "Optimization failed, continuing..."
pnpm run deploy:walrus --network mainnet
```

### Backup Management

```bash
# List available backups
find . -name "backup-*" -type d

# Restore from specific backup
./scripts/build-recovery.sh restore --backup-dir ./backup-20250602-103000

# Clean old backups (keep last 5)
find . -name "backup-*" -type d | sort | head -n -5 | xargs rm -rf
```

## Contributing

To enhance the validation system:

1. **Add new validation checks** in `build-validator.sh`
2. **Extend optimization features** in `asset-optimizer.sh`
3. **Add recovery mechanisms** in `build-recovery.sh`
4. **Update thresholds** based on Walrus Sites requirements
5. **Add new package.json scripts** for common operations

## Support

For issues with the build validation system:

1. Run `pnpm run recover:diagnose` for automated analysis
2. Check log files for detailed error information
3. Use `--debug` flag for verbose output
4. Try emergency recovery for critical issues
5. Create an issue with validation report attached

The build validation system ensures your WalTodo frontend is optimally configured for Walrus Sites deployment while providing comprehensive recovery mechanisms for any issues that may arise.