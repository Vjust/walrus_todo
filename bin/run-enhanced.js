import { Logger } from '../src/utils/Logger';

const logger = new Logger('run-enhanced');
#!/usr/bin/env node

/**
 * Enhanced OCLIF runner with robust error handling
 * This script properly initializes OCLIF and handles errors gracefully
 */

// Configure Node.js to avoid loading cached versions of modules
// This helps prevent stale module cache issues with OCLIF
process.env.NODE_NO_REQUIRE_CACHE = 'oclif';

// Add helpful globals for troubleshooting if needed
const DEBUG_MODE = process.env.WALTODO_DEBUG === 'true' || false;
const SUPPRESS_WARNINGS = process.env.WALTODO_SUPPRESS_WARNINGS !== 'false';

// Maintain original console methods
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Custom error handling - process uncaught exceptions
process.on('uncaughtException', (error) => {
  // Restore original console functions in case they were modified
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
  
  logger.error(`Uncaught Exception: ${error.message}`);
  if (DEBUG_MODE) {
    logger.error(error.stack);
  }
  
  process.exit(1);
});

// Setup console interceptors to filter unwanted messages if not in debug mode
if (SUPPRESS_WARNINGS) {
  // Filter console.warn
  console.warn = function(message, ...args) {
    // Skip warning messages we want to suppress
    if (typeof message === 'string' && 
       (message.includes('SyntaxError') || 
        message.includes('ModuleLoadError') ||
        message.includes('MODULE_NOT_FOUND') ||
        message.includes('readManifest') ||
        message.includes('Unexpected end of JSON input') ||
        message.includes('SINGLE_COMMAND_CLI'))) {
      return; // Suppress these warnings
    }
    
    // Let other warnings through
    originalConsoleWarn(message, ...args);
  };
  
  // Filter console.error for certain patterns
  console.error = function(message, ...args) {
    // Skip error messages we want to suppress
    if (typeof message === 'string' && 
       (message.includes('readManifest') && message.includes('SyntaxError')) ||
       message.includes('SINGLE_COMMAND_CLI')) {
      return; // Suppress these errors
    }
    
    // Let other errors through
    originalConsoleError(message, ...args);
  };
  
  // Suppress node warning events for specific patterns
  const originalEmit = process.emit;
  process.emit = function(event, error, ...args) {
    if (event === 'warning' && 
       (error && (error.message?.includes('SyntaxError') || 
                 error.message?.includes('Unexpected end of JSON input') ||
                 error.code === 'MODULE_NOT_FOUND'))) {
      return false; // Suppress these warning events
    }
    return originalEmit.call(this, event, error, ...args);
  };
}

// Load the OCLIF framework
let OclifCore;
try {
  OclifCore = require('@oclif/core');
} catch (error) {
  logger.error(`Failed to load @oclif/core module: ${error.message}`);
  if (DEBUG_MODE) {
    logger.error(error.stack);
  }
  process.exit(1);
}

// Extract run, flush, and handle functions from OCLIF
const { run, flush, handle } = OclifCore;

// Process CLI arguments
function processArguments() {
  // Process any -h flags to convert them to --help
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-h') {
      args[i] = '--help';
    }
  }
  process.argv = [...process.argv.slice(0, 2), ...args];
}

// Main function to initialize and run the CLI
async function main() {
  // Process command-line arguments
  processArguments();
  
  try {
    // Run the CLI command
    await run().then(flush).catch(handle);
  } catch (error) {
    // Last resort error handler
    logger.error(`WalTodo CLI execution failed: ${error.message}`);
    if (DEBUG_MODE) {
      logger.error(error.stack);
    }
    process.exit(1);
  }
}

// Execute the CLI
main();