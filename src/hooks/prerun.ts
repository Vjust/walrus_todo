import { Hook } from '@oclif/core';
import { CommandShortcuts } from '../utils/command-shortcuts';
// chalk imported but not used
import { Logger } from '../utils/Logger';

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
        Logger.getInstance().debug(`✓ Expanded shortcut: ${originalCommand} → ${expandedCommand}`);
      }
    }
  }
};

export default prerunHook;