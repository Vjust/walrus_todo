# WalTodo CLI Commands Reference

This document provides a comprehensive reference for all commands available in the WalTodo CLI.

## Basic Commands

### Help

Display help information for the CLI or a specific command.

```bash
# Display general help
waltodo --help

# Display help for a specific command
waltodo add --help
waltodo list --help
```

### Version

Display the current version of the CLI.

```bash
waltodo --version
```

## Todo Management Commands

### Add

Add new todo items to a list. If the list doesn't exist, it will be created automatically.

```bash
waltodo add "TITLE" [options]
waltodo add [options]
```

**Arguments:**
- `TITLE`: Todo title (can contain spaces)

**Flags:**
- `-t, --task=<value>`: Task description (can be used multiple times)
- `-l, --list=<value>`: Name of the todo list (default: "default")
- `-p, --priority=<option>`: Task priority (options: high, medium, low; default: medium)
- `-d, --due=<value>`: Due date in YYYY-MM-DD format
- `-g, --tags=<value>`: Comma-separated tags
- `--private`: Mark todo as private

**Examples:**
```bash
# Add a todo with spaces in the title
waltodo add "Buy groceries"

# Add a todo with title and priority
waltodo add "Important task" -p high

# Add a todo to a specific list
waltodo add "Buy milk" -l shopping

# Add a todo using the task flag (alternative)
waltodo add -t "Buy groceries" -l shopping

# Add a high priority todo with tags
waltodo add "Finish report" -l work -p high -g "urgent,project"

# Add a todo with a due date
waltodo add "Submit proposal" -l work -d 2024-05-15

# Add multiple todos at once
waltodo add -l shopping -t "Milk" -t "Eggs" -t "Bread"
```

### List

List todos or todo lists.

```bash
waltodo list [LIST] [options]
```

**Arguments:**
- `LIST`: Name of the todo list (optional)

**Flags:**
- `-c, --completed`: Show only completed todos
- `-p, --pending`: Show only pending todos
- `-a, --all`: Show all todos

**Examples:**
```bash
# List all todo lists
waltodo list

# List all todos in a specific list
waltodo list shopping

# List only completed todos
waltodo list shopping --completed

# List only pending todos
waltodo list work --pending
```

### Account

Manage Sui account for todos.

```bash
waltodo account [options]
```

**Flags:**
- `--show`: Show account information
- `-v, --verbose`: Show verbose output

**Examples:**
```bash
# Show account information
waltodo account --show

# Show verbose account information
waltodo account --show --verbose
```



## Advanced Commands

The following commands are available in the codebase but may not be fully implemented or accessible through the CLI help:

### Check/Complete

Mark a todo item as complete or incomplete.

```bash
waltodo check [LIST] --id <todo-id>
waltodo complete [LIST] --id <todo-id>
```

### Configure

Configure CLI settings such as network, API keys, etc.

```bash
waltodo configure
```

### Delete

Delete a todo item or list.

```bash
waltodo delete [LIST] --id <todo-id>
waltodo delete [LIST] --all
```

### Deploy

Deploy the Todo NFT smart contract to the Sui blockchain.

```bash
waltodo deploy --network <network>
```

### Image

Manage images for todos and NFTs.

```bash
waltodo image upload <path>
waltodo image generate --for <todo-id>
```

### Retrieve

Retrieve todos from blockchain or Walrus storage.

```bash
waltodo retrieve --by-nft <nft-id>
waltodo retrieve --all
```

### Share

Share a todo list with another user.

```bash
waltodo share [LIST] --with <address>
```

### Simple

Simple todo management with a more straightforward interface.

```bash
waltodo simple create <list>
waltodo simple add <list> <title> [options]
waltodo simple list <list> [options]
waltodo simple complete <list> --id <todo-id>
```

### Store

Store todos on blockchain and Walrus. This command always creates an NFT with the todo data stored on Walrus and the NFT reference stored on the Sui blockchain.

```bash
waltodo store --todo <todo-id> --list <list> [--image <path>]
```

**Arguments:**
- None

**Flags:**
- `-t, --todo=<value>`: ID of the todo to store (required)
- `-l, --list=<value>`: Name of the list containing the todo (default: "default")
- `-i, --image=<value>`: Path to a custom image for the NFT (optional)

**Examples:**
```bash
# Store a todo with the default image
waltodo store --todo 123 --list my-todos

# Store a todo with a custom image
waltodo store --todo 123 --list my-todos --image ./custom-image.png
```

### Update

Update an existing todo item.

```bash
waltodo update [LIST] --id <todo-id> [options]
```

## Environment Variables

The CLI can be configured using the following environment variables:

```
NETWORK=testnet
PACKAGE_ID=<package-id>
WALRUS_API_KEY=<key>
```

## Configuration File

The CLI stores configuration in a `.waltodo.json` file in your home directory. This file contains:

- Network configuration (testnet, mainnet, devnet)
- Sui address
- Walrus API key
- Package ID of deployed smart contract

You can edit this file manually or use the `configure` command to update it.
