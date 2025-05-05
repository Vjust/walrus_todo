# WalTodo CLI Usage Guide

This guide provides instructions on how to use the WalTodo CLI, a command-line interface for managing todos with Sui blockchain and Walrus storage.

For a comprehensive reference of all CLI commands, see [CLI-COMMANDS.md](CLI-COMMANDS.md).

## Installation

### Option 1: Global Installation

To install the CLI globally, run:

```bash
npm run global-install
```

This will:
1. Set the correct permissions on bin files
2. Clean and rebuild the project
3. Install the CLI globally using npm link

After installation, you can use the `waltodo` command from anywhere without needing to modify your PATH.

### Option 2: Local Installation

To install the CLI locally, run:

```bash
./fix-cli.sh
```

This will:
1. Set the correct permissions on bin files
2. Clean and rebuild the project
3. Install the CLI to your local bin directory (~/.local/bin)

The local installation will make the `waltodo` command available in your `~/.local/bin` directory.

## Basic Commands

### Get Help

```bash
waltodo --help
```

### List All Todo Lists

```bash
waltodo list
```

### List Todos in a Specific List

```bash
waltodo list <list-name>
```

### Add a Todo

You can add a todo in several ways:

```bash
# Add a todo with spaces in the title
waltodo add "Your todo item with spaces"

# Add a todo with spaces and options
waltodo add "Your todo item with spaces" -p high -g "tag1,tag2"

# Add a todo to a specific list
waltodo add "Your todo item with spaces" -l <list-name>

# Add a todo using the task flag (alternative)
waltodo add -t "Your todo item"
```

If the list doesn't exist, it will be created automatically. No need to use a separate create command!

### Add a Todo with Priority and Tags

```bash
waltodo add "Your todo item" -p high -g "tag1,tag2"
```

### Add Multiple Todo Items at Once

You can add multiple todo items by using the `-t` flag multiple times:

```bash
waltodo add -l <list-name> -t "First todo" -t "Second todo"
```

### Show Account Information

```bash
waltodo account --show
```

## Troubleshooting

If you encounter any issues with the CLI, try the following:

1. Make sure the CLI is properly installed:
   ```bash
   which waltodo
   ```

2. If the command is not found, you can run it directly using:
   ```bash
   ~/.local/bin/waltodo
   ```

3. If you still have issues, reinstall the CLI:
   ```bash
   ./fix-cli.sh
   ```

4. Test all CLI commands:
   ```bash
   ./test-all-commands.sh
   ```

## Advanced Usage

For more advanced usage, including blockchain integration and NFT creation, please refer to the main README.md file.

## Complete Command Reference

For a comprehensive reference of all CLI commands, including detailed explanations and examples, see [CLI-COMMANDS.md](CLI-COMMANDS.md).
