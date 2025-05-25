/**
import { Logger } from './Logger';

const logger = new Logger('error-messages-examples');
 * Example usage of the enhanced error messaging system
 * Demonstrates how the new error system provides better user experience
 */

import { ValidationError, NetworkError, StorageError } from '../types/errors';
import { displayFriendlyError, ErrorContext } from './error-messages';

// Example 1: Validation error with field context
const validationExample = () => {
  const error = new ValidationError('Invalid date format', {
    field: 'due',
    value: '31-12-2024',
  });

  const context: ErrorContext = {
    command: 'add',
    field: 'due',
    value: '31-12-2024',
  };

  logger.info(displayFriendlyError(error, context));

  /* Output:
  
  ⚠️ Invalid Input
  Invalid value for due: Invalid date format
  
  💡 How to fix:
    1. Review the command syntax
    2. Check the input format  
    3. Use --help to see valid options
    4. Date format should be: YYYY-MM-DD
  */
};

// Example 2: Network error with retry context
const networkExample = () => {
  const error = new NetworkError('Connection timeout', {
    operation: 'store',
    recoverable: true,
  });

  const context: ErrorContext = {
    command: 'store',
    operation: 'upload',
    attempt: 2,
    maxAttempts: 3,
  };

  logger.info(displayFriendlyError(error, context));

  /* Output:
  
  🌐 Network Connection Issue
  Failed to upload: Connection timeout (attempt 2/3)
  
  💡 How to fix:
    1. Check your internet connection
    2. Verify that the service is accessible
    3. Try again in a few moments
  
  💡 Quick tips:
    • You can retry this command with the --retry flag
    • Check service status at status.walrus.io
  */
};

// Example 3: Command typo with suggestions
const typoExample = () => {
  const error = new Error("Command 'lst' not found");

  const context: ErrorContext = {
    command: 'lst',
  };

  logger.info(displayFriendlyError(error, context));

  /* Output:
  
  ❌ Unexpected Error
  Command 'lst' not found
  
  Did you mean:
    → walrus list
  
  💡 How to fix:
    1. Try running the command again
    2. Check the logs with --verbose flag  
    3. Report this issue if it persists
  */
};

// Example 4: Storage error with specific guidance
const storageExample = () => {
  const error = new StorageError('Insufficient WAL tokens', {
    operation: 'store',
    blobId: 'abc123',
  });

  const context: ErrorContext = {
    command: 'store',
    operation: 'store',
    blobId: 'abc123',
  };

  logger.info(displayFriendlyError(error, context));

  /* Output:
  
  💾 Storage Operation Failed
  Failed to store: Insufficient WAL tokens
  
  💡 How to fix:
    1. Ensure Walrus CLI is installed: curl -sSf https://docs.wal.app/setup/walrus-install.sh | sh
    2. Check Walrus configuration: cat ~/.config/walrus/client_config.yaml
    3. Use --mock flag for testing without real storage
    4. Verify blob exists: walrus storage:check abc123
  
  💡 Quick tips:
    • Get WAL tokens: walrus --context testnet get-wal
    • Test with local storage first: walrus store --storage local
  */
};

export { validationExample, networkExample, typoExample, storageExample };
