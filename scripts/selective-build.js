#!/usr/bin/env node

/**
 * Selective Build System for Waltodo CLI
 * Compiles only essential commands while bypassing problematic files
 */

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function print(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Essential commands that must work
const ESSENTIAL_COMMANDS = [
  'jobs',
  'status', 
  'cancel',
  'store',
  'add',
  'list',
  'complete',
  'config',
  'help'
];

// Core files required for all commands
const CORE_FILES = [
  'src/index.ts',
  'src/base-command.ts',
  'src/constants.ts',
  'src/hooks/init.ts',
  'src/hooks/prerun.ts'
];

// Essential utils and services
const ESSENTIAL_UTILS = [
  'src/utils/cli-helpers.ts',
  'src/utils/config-loader.ts',
  'src/utils/error-handler.ts',
  'src/utils/Logger.ts',
  'src/utils/path-utils.ts',
  'src/utils/input-validator.ts',
  'src/utils/progress-indicators.ts',
  'src/services/config-service.ts',
  'src/types/command-types.ts',
  'src/types/config.ts',
  'src/types/todo.ts',
  'src/types/errors.ts'
];

// Files to exclude (known problematic ones)
const EXCLUDED_FILES = [
  'src/services/ai/**/*',
  'src/commands/ai/**/*',
  'src/commands/ai.ts',
  'src/commands/image/**/*',
  'src/commands/image.ts',
  'src/commands/deploy.ts',
  'src/commands/sync.ts',
  'src/utils/walrus-storage.ts',
  'src/utils/sui-nft-storage.ts',
  'src/utils/blockchain-*',
  'src/move/**/*'
];

function createTypeScriptConfig() {
  const tsConfig = {
    compilerOptions: {
      target: "ES2020",
      module: "commonjs",
      lib: ["ES2020"],
      outDir: "./dist",
      rootDir: "./",
      strict: false,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      moduleResolution: "node",
      resolveJsonModule: true,
      declaration: false,
      sourceMap: false,
      removeComments: true,
      noImplicitAny: false,
      noImplicitReturns: false,
      noImplicitThis: false,
      noUnusedLocals: false,
      noUnusedParameters: false,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      allowJs: true
    },
    include: [],
    exclude: [
      "node_modules",
      "**/*.test.ts",
      "**/*.spec.ts", 
      "tests/**/*",
      "__tests__/**/*",
      "**/*.d.ts"
    ]
  };

  return tsConfig;
}

function getEssentialFiles() {
  const essentialFiles = [...CORE_FILES, ...ESSENTIAL_UTILS];
  
  // Add essential command files
  ESSENTIAL_COMMANDS.forEach(cmd => {
    const cmdFile = `src/commands/${cmd}.ts`;
    if (fs.existsSync(cmdFile)) {
      essentialFiles.push(cmdFile);
    }
  });

  // Add essential type files
  const typeFiles = [
    'src/types/errors/consolidated/index.ts',
    'src/types/errors/BaseError.ts',
    'src/types/errors/ValidationError.ts'
  ];

  typeFiles.forEach(file => {
    if (fs.existsSync(file)) {
      essentialFiles.push(file);
    }
  });

  return essentialFiles.filter(file => fs.existsSync(file));
}

function createSelectiveTsConfig() {
  print('blue', 'Creating selective TypeScript configuration...');
  
  const tsConfig = createTypeScriptConfig();
  const essentialFiles = getEssentialFiles();
  
  tsConfig.include = essentialFiles;
  
  // Add excluded patterns
  tsConfig.exclude.push(...EXCLUDED_FILES);
  
  const configPath = path.join(process.cwd(), 'tsconfig.selective.json');
  fs.writeFileSync(configPath, JSON.stringify(tsConfig, null, 2));
  
  print('green', `Created selective config with ${essentialFiles.length} files`);
  return configPath;
}

function cleanDist() {
  print('blue', 'Cleaning dist directory...');
  const distPath = path.join(process.cwd(), 'dist');
  
  if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { recursive: true, force: true });
  }
  
  fs.mkdirSync(distPath, { recursive: true });
  print('green', 'Dist directory cleaned');
}

function copyStaticFiles() {
  print('blue', 'Copying static files...');
  
  // Copy package.json
  const srcPackage = path.join(process.cwd(), 'package.json');
  const distPackage = path.join(process.cwd(), 'dist', 'package.json');
  
  if (fs.existsSync(srcPackage)) {
    fs.copyFileSync(srcPackage, distPackage);
  }
  
  // Create basic oclif manifest
  const manifest = {
    version: "1.0.0",
    commands: {}
  };
  
  ESSENTIAL_COMMANDS.forEach(cmd => {
    manifest.commands[cmd] = {
      id: cmd,
      pluginName: "waltodo",
      pluginType: "core"
    };
  });
  
  const manifestPath = path.join(process.cwd(), 'oclif.manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  print('green', 'Static files copied');
}

function compileEssentials() {
  print('blue', 'Compiling essential commands...');
  
  try {
    const configPath = createSelectiveTsConfig();
    
    // Use TypeScript compiler directly
    const result = spawnSync('npx', ['tsc', '--project', configPath], {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd()
    });
    
    // Clean up config file
    fs.unlinkSync(configPath);
    
    if (result.status !== 0) {
      print('red', 'TypeScript compilation failed');
      return false;
    }
    
    print('green', 'Essential commands compiled successfully');
    return true;
  } catch (error) {
    print('red', `Compilation error: ${error.message}`);
    return false;
  }
}

function createCommandStubs() {
  print('blue', 'Creating command stubs for missing commands...');
  
  const commandsDir = path.join(process.cwd(), 'dist', 'src', 'commands');
  fs.mkdirSync(commandsDir, { recursive: true });
  
  // Create minimal stubs for commands that might be referenced
  const stubCommands = ['ai', 'image', 'deploy', 'sync'];
  
  stubCommands.forEach(cmd => {
    const stubPath = path.join(commandsDir, `${cmd}.js`);
    const stubContent = `
// Stub command - functionality disabled in selective build
const { Command } = require('@oclif/core');

class ${cmd.charAt(0).toUpperCase() + cmd.slice(1)}Command extends Command {
  static description = '${cmd} command (disabled in selective build)';
  
  async run() {
    this.log('This command is not available in the selective build.');
    this.log('Please use the full build for ${cmd} functionality.');
    this.exit(1);
  }
}

module.exports = ${cmd.charAt(0).toUpperCase() + cmd.slice(1)}Command;
`;
    
    fs.writeFileSync(stubPath, stubContent);
  });
  
  print('green', 'Command stubs created');
}

function fixPermissions() {
  print('blue', 'Fixing file permissions...');
  
  try {
    const result = spawnSync('node', ['scripts/fix-permissions.js'], {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd()
    });
    
    if (result.status === 0) {
      print('green', 'Permissions fixed');
      return true;
    } else {
      print('yellow', 'Warning: Could not fix permissions');
      return false;
    }
  } catch (error) {
    print('yellow', `Warning: Permission fix failed: ${error.message}`);
    return false;
  }
}

function validateBuild() {
  print('blue', 'Validating essential commands...');
  
  const failures = [];
  
  ESSENTIAL_COMMANDS.forEach(cmd => {
    const cmdPath = path.join(process.cwd(), 'dist', 'src', 'commands', `${cmd}.js`);
    if (!fs.existsSync(cmdPath)) {
      failures.push(cmd);
    }
  });
  
  if (failures.length > 0) {
    print('red', `Missing commands: ${failures.join(', ')}`);
    return false;
  }
  
  print('green', 'All essential commands present');
  return true;
}

function testCommand() {
  print('blue', 'Testing jobs command...');
  
  try {
    const result = spawnSync('./bin/waltodo', ['jobs', '--help'], {
      stdio: 'pipe',
      shell: true,
      cwd: process.cwd()
    });
    
    if (result.status === 0) {
      print('green', 'Jobs command test passed');
      return true;
    } else {
      print('yellow', 'Jobs command test failed - but build may still be usable');
      return false;
    }
  } catch (error) {
    print('yellow', `Command test failed: ${error.message}`);
    return false;
  }
}

function main() {
  print('magenta', 'Starting Selective Build System for Waltodo CLI');
  print('blue', `Building essential commands: ${ESSENTIAL_COMMANDS.join(', ')}`);
  
  // Step 1: Clean
  cleanDist();
  
  // Step 2: Copy static files
  copyStaticFiles();
  
  // Step 3: Compile essentials
  const compileSuccess = compileEssentials();
  if (!compileSuccess) {
    print('red', 'Selective build failed at compilation stage');
    process.exit(1);
  }
  
  // Step 4: Create stubs
  createCommandStubs();
  
  // Step 5: Fix permissions
  fixPermissions();
  
  // Step 6: Validate
  const validateSuccess = validateBuild();
  if (!validateSuccess) {
    print('red', 'Build validation failed');
    process.exit(1);
  }
  
  // Step 7: Test
  testCommand();
  
  print('green', 'Selective build completed successfully!');
  print('cyan', 'Available commands: ' + ESSENTIAL_COMMANDS.join(', '));
  print('yellow', 'Note: AI, image, and blockchain features are disabled in this build');
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  print('magenta', 'Selective Build System for Waltodo CLI');
  console.log(`
Usage: node scripts/selective-build.js [options]

Options:
  --help, -h    Show this help message
  
This script builds only the essential CLI commands:
  ${ESSENTIAL_COMMANDS.join(', ')}
  
Excluded features:
  - AI commands
  - Image/NFT commands  
  - Blockchain deployment
  - Walrus storage integration
  
Use this build when you need basic todo functionality
without the full feature set.
`);
  process.exit(0);
}

main();