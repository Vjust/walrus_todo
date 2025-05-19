import { Hook } from '@oclif/core';
import { CommandShortcuts } from '../utils/command-shortcuts';
import chalk from 'chalk';

/**
 * Pre-run hook to process command shortcuts
 */
const prerunHook: Hook<'prerun'> = async function(opts) {
  if (opts.argv.length > 0) {
    const originalCommand = opts.argv[0];
    const expandedCommand = CommandShortcuts.expand(originalCommand);
    
    // If a shortcut was expanded, update the argv array
    if (expandedCommand !== originalCommand) {
      opts.argv[0] = expandedCommand;
      
      // Show expansion in debug mode
      if (process.env.DEBUG || process.env.VERBOSE) {
        console.log(chalk.dim(`✓ Expanded shortcut: ${originalCommand} → ${expandedCommand}`));
      }
    }
  }
};

export default prerunHook;