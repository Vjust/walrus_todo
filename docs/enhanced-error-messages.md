# Enhanced Error Messaging System

## Overview

The WalTodo CLI now includes an enhanced error messaging system that provides:

1. **Context-aware error messages** - Errors are tailored to the specific command and situation
2. **Helpful action suggestions** - Clear steps to resolve the issue
3. **Emoji indicators** - Visual cues for different error types
4. **User-friendly formatting** - Clean, readable error output
5. **"Did you mean?" suggestions** - Help for typos and misspellings
6. **Quick tips** - Additional guidance for common scenarios

## Features

### 1. Context-Aware Error Messages

Errors now understand the context in which they occur:

```typescript
// Validation error for the 'add' command
const error = new ValidationError('Invalid date format', {
  field: 'due',
  value: '31-12-2024'
});

// Output:
⚠️ Invalid Input
Invalid value for due: Invalid date format

💡 How to fix:
  1. Review the command syntax
  2. Check the input format  
  3. Use --help to see valid options
  4. Date format should be: YYYY-MM-DD
```

### 2. Command-Specific Guidance

Different commands get tailored error messages:

```typescript
// Storage error for the 'store' command
💾 Storage Operation Failed
Failed to store: Insufficient WAL tokens

💡 How to fix:
  1. Ensure Walrus CLI is installed: curl -sSf https://docs.wal.app/setup/walrus-install.sh | sh
  2. Check Walrus configuration: cat ~/.config/walrus/client_config.yaml
  3. Use --mock flag for testing without real storage

💡 Quick tips:
  • Get WAL tokens: walrus --context testnet get-wal
  • Test with local storage first: walrus store --storage local
```

### 3. Typo Detection

The system detects common misspellings and suggests corrections:

```typescript
// Command typo
❌ Command not found
'lst' is not a valid command

Did you mean:
  → walrus list

💡 How to fix:
  1. Check available commands: walrus --help
  2. Use tab completion for commands
  3. Review command documentation
```

### 4. Network Error Handling

Network errors include retry information and status:

```typescript
🌐 Network Connection Issue
Failed to upload: Connection timeout (attempt 2/3)

💡 How to fix:
  1. Check your internet connection
  2. Verify that the service is accessible
  3. Try again in a few moments

💡 Quick tips:
  • You can retry this command with the --retry flag
  • Check service status at status.walrus.io
```

### 5. Error Urgency Levels

Errors are categorized by urgency:

- **🔴 High urgency** - Authentication errors, blockchain failures
- **🟡 Medium urgency** - Network issues, storage problems  
- **🔵 Low urgency** - Validation errors, input issues

High urgency errors include encouragement:

```
Don't worry, we'll get through this! 💪
```

## Implementation

The enhanced error messaging system is integrated with:

1. **BaseCommand** - All commands inherit enhanced error handling
2. **Error types** - NetworkError, ValidationError, StorageError, etc.
3. **Command registry** - Provides command suggestions for typos
4. **Context system** - Captures relevant error context

### Usage in Commands

Commands automatically get enhanced error handling:

```typescript
// In a command
if (!isValidDate(date)) {
  throw new ValidationError('Invalid date format', {
    field: 'due',
    value: date
  });
}

// The error system will automatically:
// 1. Format the error nicely
// 2. Add command-specific suggestions
// 3. Include helpful quick tips
// 4. Display with appropriate urgency
```

### Error Context

The system automatically extracts context from errors:

```typescript
export interface ErrorContext {
  command?: string;       // Current command being run
  resource?: string;      // Resource being operated on
  field?: string;         // Field with invalid value
  value?: any;           // The invalid value
  operation?: string;    // Operation being performed
  transactionId?: string; // Blockchain transaction ID
  blobId?: string;       // Storage blob ID
  attempt?: number;      // Retry attempt number
  maxAttempts?: number;  // Maximum retry attempts
}
```

## Examples

See [error-messages-examples.ts](../src/utils/error-messages-examples.ts) for detailed examples of:

1. Validation errors with field context
2. Network errors with retry information
3. Command typos with suggestions
4. Storage errors with specific guidance

## Benefits

1. **Reduced user frustration** - Clear guidance on how to fix issues
2. **Faster problem resolution** - Specific suggestions for each error type
3. **Better discoverability** - Command suggestions help users learn
4. **Consistent experience** - All errors follow the same format
5. **Context preservation** - Errors include relevant details

## Future Enhancements

1. **Localization** - Support for multiple languages
2. **Error analytics** - Track common errors to improve UX
3. **Interactive fixes** - Offer to automatically fix certain issues
4. **Error history** - Show previous errors and resolutions
5. **Community suggestions** - Learn from user-reported fixes