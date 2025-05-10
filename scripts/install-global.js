#!/usr/bin/env node

/**
 * Cross-platform script to install the CLI globally
 * This replaces the shell script with a more portable Node.js version
 */

const { spawnSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

// Print colored message
function print(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Main installation function
async function installGlobally() {
  print('blue', 'Installing waltodo CLI globally...');
  
  // First, ensure the build is up to date
  print('blue', 'Building the package first...');
  const buildResult = spawnSync('node', ['scripts/run-build.js', '--transpile-only'], {
    stdio: 'inherit',
    shell: true
  });
  
  if (buildResult.status !== 0) {
    print('red', 'Build failed. Cannot install CLI globally.');
    process.exit(1);
  }
  
  // Check for npm or pnpm
  const hasPnpm = spawnSync('which', ['pnpm'], { shell: true }).status === 0;
  const packageManager = hasPnpm ? 'pnpm' : 'npm';
  
  print('blue', `Using ${packageManager} to install globally...`);
  
  // Check if we're on Windows
  const isWindows = os.platform() === 'win32';
  
  // On Windows, we don't need to worry about sudo
  if (!isWindows) {
    // On Unix, check if we need sudo for global install
    const npmPrefix = spawnSync('npm', ['config', 'get', 'prefix'], { 
      shell: true,
      encoding: 'utf8'
    }).stdout.trim();
    
    const globalBin = path.join(npmPrefix, 'bin');
    const needsSudo = npmPrefix === '/usr/local' && !fs.accessSync(globalBin, fs.constants.W_OK);
    
    if (needsSudo) {
      print('yellow', 'You don\'t have write permission to global bin directory.');
      print('yellow', `Using sudo to install globally with ${packageManager}...`);
      
      // Use sudo for the installation
      const installResult = spawnSync('sudo', [packageManager, 'link'], {
        stdio: 'inherit',
        shell: true
      });
      
      if (installResult.status !== 0) {
        print('red', 'Installation failed. Try running with sudo manually.');
        process.exit(1);
      }
    } else {
      // No sudo needed
      const installResult = spawnSync(packageManager, ['link'], {
        stdio: 'inherit',
        shell: true
      });
      
      if (installResult.status !== 0) {
        print('red', 'Installation failed.');
        process.exit(1);
      }
    }
  } else {
    // Windows installation
    const installResult = spawnSync(packageManager, ['link'], {
      stdio: 'inherit',
      shell: true
    });
    
    if (installResult.status !== 0) {
      print('red', 'Installation failed. Try running as administrator.');
      process.exit(1);
    }
  }
  
  // Verify the installation
  print('blue', 'Verifying installation...');
  
  const verifyCmd = isWindows ? 'where' : 'which';
  const verifyResult = spawnSync(verifyCmd, ['waltodo'], {
    shell: true,
    encoding: 'utf8'
  });
  
  if (verifyResult.status === 0) {
    print('green', 'Successfully installed waltodo CLI globally!');
    print('green', 'You can now use \'waltodo\' from any directory.');
    
    // Show version
    const versionResult = spawnSync('waltodo', ['--version'], {
      shell: true,
      encoding: 'utf8'
    });
    
    print('blue', 'Installed version:');
    console.log(versionResult.stdout);
  } else {
    print('red', 'Installation verification failed. \'waltodo\' command not found.');
    if (!isWindows) {
      print('yellow', 'Try running with sudo: sudo node scripts/install-global.js');
    } else {
      print('yellow', 'Try running as administrator');
    }
    process.exit(1);
  }
}

// Run the installation
installGlobally().catch(err => {
  print('red', `Installation error: ${err.message}`);
  process.exit(1);
});