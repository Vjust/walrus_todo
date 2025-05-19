# CLI Command Linting and Validation

This document describes the tools and processes for linting, validating, and fixing CLI commands in the WalTodo project.

## Overview

The WalTodo CLI uses OCLIF (Open CLI Framework) to manage commands. To ensure consistency and quality across all commands, we've implemented several tools to:

1. Lint command implementations
2. Validate command descriptions
3. Test command execution
4. Fix common issues automatically

## Available Tools

### CLI Command Linter

The CLI command linter checks all command files to ensure they follow best practices:

- Proper descriptions
- Examples
- Error handling
- Extension of BaseCommand
- Registration in the manifest

```bash
# Run the linter
pnpm run lint:cli

# Run the linter with automatic fixes (when implemented)
pnpm run lint:cli:fix
```

### Command Description Fixer

This tool updates command descriptions in the manifest file by extracting them from the command source files:

```bash
pnpm run fix:cli:descriptions
```

### CLI Command Checker

The CLI command checker tests each command to ensure it executes without errors:

```bash
pnpm run check:cli
```

### Comprehensive Check

To run all checks and fixes in sequence:

```bash
pnpm run check:cli:all
```

## Shell Fallback

For environments without Node.js, we provide a shell fallback implementation with basic functionality:

```bash
./bin/waltodo-shell help
```

The shell fallback supports these commands:
- `add`: Add a new todo
- `list`: List todos or available lists
- `complete`: Mark a todo as completed
- `delete`: Delete a todo
- `help`: Show help information

## Best Practices for CLI Commands

When creating or modifying CLI commands, follow these guidelines:

1. **Extend BaseCommand**: All commands should extend the BaseCommand class
   ```typescript
   export default class MyCommand extends BaseCommand {
     // ...
   }
   ```

2. **Provide a Description**: Include a static description property
   ```typescript
   static description = 'A clear, concise description of what the command does';
   ```

3. **Include Examples**: Add examples showing how to use the command
   ```typescript
   static examples = [
     '<%= config.bin %> my-command',
     '<%= config.bin %> my-command --flag value'
   ];
   ```

4. **Implement Error Handling**: Use try/catch blocks and provide helpful error messages
   ```typescript
   try {
     // Command implementation
   } catch (error) {
     this.handleError(error, 'my-command');
   }
   ```

5. **Use Consistent Flag Names**: Follow these conventions:
   - Use kebab-case for flag names (e.g., `--my-flag`)
   - Use single-letter shortcuts for common flags (e.g., `-h` for help)
   - Group related flags together

6. **Provide Feedback**: Use the BaseCommand methods for consistent output
   ```typescript
   this.success('Operation completed successfully');
   this.info('Helpful information');
   this.warning('Something to be aware of');
   this.error('Something went wrong');
   ```

## Troubleshooting

If you encounter issues with the CLI commands:

1. **Command not found in manifest**: Run `pnpm run manifest` to regenerate the manifest file
2. **Node.js not found**: Install Node.js or use the shell fallback
3. **Build errors**: Run `pnpm run build` to rebuild the project
4. **Permission issues**: Run `pnpm run fix:permissions` to fix file permissions
