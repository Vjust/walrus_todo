#!/usr/bin/env node

/**
 * Verify workspace setup and dependencies
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function print(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkPackage(pkgPath, name) {
  const fullPath = path.join(__dirname, '..', pkgPath);
  if (fs.existsSync(path.join(fullPath, 'package.json'))) {
    print('green', `✓ Found ${name} at ${pkgPath}`);
    
    // Check if it has a build script
    const pkg = JSON.parse(fs.readFileSync(path.join(fullPath, 'package.json'), 'utf8'));
    if (pkg.scripts && pkg.scripts.build) {
      print('cyan', `  - Has build script`);
    } else {
      print('yellow', `  - Missing build script`);
    }
    
    // Check if it uses workspace protocol
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const workspaceDeps = Object.entries(deps || {})
      .filter(([_, version]) => version.startsWith('workspace:'))
      .map(([name]) => name);
    
    if (workspaceDeps.length > 0) {
      print('cyan', `  - Uses workspace dependencies: ${workspaceDeps.join(', ')}`);
    }
    
    return true;
  } else {
    print('red', `✗ Missing ${name} at ${pkgPath}`);
    return false;
  }
}

print('blue', '\n=== Verifying Workspace Setup ===\n');

// Check shared packages
print('yellow', 'Shared Packages:');
checkPackage('packages/shared-types', '@waltodo/shared-types');
checkPackage('packages/shared-constants', '@waltodo/shared-constants');
checkPackage('packages/config-loader', '@waltodo/config-loader');
checkPackage('packages/sui-client', '@waltodo/sui-client');
checkPackage('packages/walrus-client', '@waltodo/walrus-client');

// Check apps
print('yellow', '\nApplication Packages:');
checkPackage('apps/cli', '@waltodo/cli');
checkPackage('apps/api', '@waltodo/api');

// Check frontend
print('yellow', '\nFrontend:');
checkPackage('waltodo-frontend', '@walrus-todo/frontend');

// Check workspace configuration
print('yellow', '\nWorkspace Configuration:');
if (fs.existsSync(path.join(__dirname, '..', 'pnpm-workspace.yaml'))) {
  print('green', '✓ pnpm-workspace.yaml exists');
} else {
  print('red', '✗ pnpm-workspace.yaml missing');
}

// Try to list workspace packages
print('yellow', '\nWorkspace Packages (via pnpm):');
try {
  const result = execSync('pnpm list -r --depth -1', { encoding: 'utf8' });
  const packages = result.split('\n')
    .filter(line => line.includes('@waltodo/') || line.includes('@walrus-todo/'))
    .map(line => line.trim());
  
  packages.forEach(pkg => print('cyan', `  - ${pkg}`));
} catch (error) {
  print('red', 'Failed to list workspace packages');
}

print('blue', '\n=== Build Order ===\n');
print('cyan', '1. Shared packages (in order):');
print('cyan', '   - @waltodo/shared-types');
print('cyan', '   - @waltodo/shared-constants');
print('cyan', '   - @waltodo/config-loader');
print('cyan', '   - @waltodo/sui-client');
print('cyan', '   - @waltodo/walrus-client');
print('cyan', '2. Applications:');
print('cyan', '   - @waltodo/cli');
print('cyan', '   - @waltodo/api');
print('cyan', '3. Frontend:');
print('cyan', '   - @walrus-todo/frontend');

print('green', '\n✓ Workspace verification complete\n');