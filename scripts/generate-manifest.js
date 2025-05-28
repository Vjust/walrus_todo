#!/usr/bin/env node

// Simple console logger for script use
const logger = {
  info: msg => console.log(`[INFO] ${msg}`),
  error: msg => console.error(`[ERROR] ${msg}`),
  warn: msg => console.warn(`[WARN] ${msg}`),
};

/**
 * Improved OCLIF manifest generator script
 * This script recursively scans the command directory structure
 * and creates a proper manifest that includes all commands, including nested ones.
 */

const fs = require('fs');
const path = require('path');

// Color constants for output formatting
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// Package information
const packageJson = require('../package.json');
const version = packageJson.version || '1.0.0';

// Configuration - check multiple possible paths for commands directory
const rootDir = path.join(__dirname, '..');
const possibleCommandsPaths = [
  path.join(rootDir, 'dist', 'apps', 'cli', 'src', 'commands'), // Actual build output path (from tsconfig)
  path.join(rootDir, 'dist', 'src', 'commands'), // Desired simplified path
  path.join(rootDir, 'dist', 'apps', 'cli', 'apps', 'cli', 'src', 'commands'), // Legacy duplicate path
  path.join(rootDir, 'dist', 'commands'),
  path.join(rootDir, 'apps', 'cli', 'src', 'commands') // Fallback to source
];

// Find the first existing commands directory
let commandsDir = null;
let commandsBasePath = '';
for (const possiblePath of possibleCommandsPaths) {
  if (fs.existsSync(possiblePath)) {
    commandsDir = possiblePath;
    // Calculate relative path for command references
    commandsBasePath = path.relative(rootDir, possiblePath).replace(/\\/g, '/');
    break;
  }
}

const manifestPath = path.join(rootDir, 'oclif.manifest.json');

// Topic descriptions
const topics = {
  account: {
    description: 'Manage Sui accounts',
  },
  ai: {
    description: 'AI-powered todo management features',
  },
  image: {
    description: 'Manage todo images for storage on Walrus and NFT creation',
  },
  system: {
    description: 'Manage and view security audit logs',
  },
  simple: {
    description: 'Simple todo management commands',
  },
};

// Command descriptions - these will override the default "{command} command" descriptions
const commandDescriptions = {
  add: 'Add a new todo item to a specified list',
  ai: 'AI operations for todo management',
  check: 'Toggle completion status of a todo item',
  complete: 'Mark a todo as completed.',
  config: 'Display or validate environment configuration',
  configure:
    'Configure CLI settings, environment variables, and wallet preferences',
  create: 'Create a new todo item as an NFT on the Sui blockchain',
  delete: 'Delete a specific todo item or an entire list',
  deploy: 'Deploy the Todo NFT smart contract to the Sui blockchain',
  env: 'Manage environment variables and configuration',
  fetch: 'Fetch todos directly from blockchain or Walrus storage using IDs',
  image: 'Manage todo images for storage on Walrus and NFT creation',
  list: 'Display todo items or available todo lists',
  provider: 'Manage AI providers for blockchain verification',
  retrieve: 'Retrieve stored todos from blockchain or Walrus storage',
  share: 'Share a todo list with another user',
  simple: 'Manage todos with simplified commands for basic operations',
  storage: 'Manage Walrus storage for todos',
  store: 'Store a todo on blockchain with Walrus storage and create an NFT',
  suggest: 'Get intelligent task suggestions based on your current todo list',
  template: 'Template for creating new CLI commands - not for end users',
  update: 'Update properties of an existing todo item',
  verify: 'Manage blockchain verifications for AI operations',
};

// Initialize manifest structure
const manifest = {
  version,
  commands: {},
  topics,
};

/**
 * Get description for a command
 * @param {string} commandName - Name of the command
 * @returns {string} - Description for the command
 */
function getDescription(commandName) {
  return commandDescriptions[commandName] || `${commandName} command`;
}

/**
 * Recursively scan directories to find command files
 * @param {string} directory - Directory to scan
 * @param {string[]} pathSegments - Path segments for nested commands
 */
function scanDirectory(directory, pathSegments = []) {
  try {
    if (!fs.existsSync(directory)) {
      logger.info(
        `${colors.yellow}⚠ Directory does not exist: ${directory}${colors.reset}`
      );
      return;
    }

    const items = fs.readdirSync(directory);

    // First process direct .js files (commands)
    const commandFiles = items.filter(
      item =>
        item.endsWith('.js') &&
        !item.includes(' 2.js') &&
        !item.includes('.d.ts') &&
        !item.includes('.d.js') &&
        item !== 'index.js'
    );

    // Process each command file
    commandFiles.forEach(file => {
      const commandName = path.basename(file, '.js');
      const commandId = [...pathSegments, commandName].join(':');
      const relativePath = [...pathSegments, commandName].join('/');

      // Add command to manifest
      manifest.commands[commandId] = {
        id: commandId,
        description: getDescription(commandId) || getDescription(commandName),
        pluginName: 'waltodo',
        pluginType: 'core',
        aliases: [],
        flags: {},
        args: [],
        path: `./${commandsBasePath}/${relativePath}`,
      };
    });

    // Then recursively process subdirectories
    const subdirectories = items.filter(item => {
      const itemPath = path.join(directory, item);
      return fs.statSync(itemPath).isDirectory();
    });

    subdirectories.forEach(subdir => {
      const newPathSegments = [...pathSegments, subdir];
      scanDirectory(path.join(directory, subdir), newPathSegments);

      // Create topic entry for directory if it doesn't exist
      if (pathSegments.length === 0 && !topics[subdir]) {
        topics[subdir] = {
          description: `${subdir.charAt(0).toUpperCase() + subdir.slice(1)} management commands`,
        };
      }
    });
  } catch (error) {
    logger.error(
      `${colors.red}✗ Error scanning directory ${directory}:${colors.reset}`,
      error
    );
  }
}

/**
 * Main function to generate the manifest
 */
function generateManifest() {
  logger.info(
    `${colors.blue}Generating improved OCLIF manifest...${colors.reset}`
  );

  try {
    // Check if commands directory exists
    if (!commandsDir) {
      logger.warn(
        `${colors.yellow}⚠ No commands directory found in any of the expected locations:${colors.reset}`
      );
      possibleCommandsPaths.forEach(p => logger.info(`  - ${p}`));
      
      // Create a basic manifest with empty commands
      manifest.commands = {};
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      logger.info(
        `${colors.green}✓ Created empty manifest file${colors.reset}`
      );
      return;
    }

    logger.info(
      `${colors.blue}Using commands directory: ${commandsDir}${colors.reset}`
    );
    
    // Scan the commands directory recursively
    scanDirectory(commandsDir);

    // Special handling for nested command files
    // If there's an index.js in a directory, add it as a parent command
    Object.keys(topics).forEach(topic => {
      const topicDir = path.join(commandsDir, topic);
      const indexFile = path.join(topicDir, 'index.js');

      if (fs.existsSync(indexFile)) {
        manifest.commands[topic] = {
          id: topic,
          description: getDescription(topic),
          pluginName: 'waltodo',
          pluginType: 'core',
          aliases: [],
          flags: {},
          args: [],
          path: `./${commandsBasePath}/${topic}/index`,
        };
      }
    });

    // Write manifest to file
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const commandCount = Object.keys(manifest.commands).length;
    const topicCount = Object.keys(manifest.topics).length;

    logger.info(
      `${colors.green}✓ Successfully generated manifest with ${commandCount} commands and ${topicCount} topics${colors.reset}`
    );
  } catch (error) {
    logger.error(
      `${colors.red}✗ Failed to generate manifest:${colors.reset}`,
      error
    );
    process.exit(1);
  }
}

// Execute the manifest generation
generateManifest();
