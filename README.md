# Waltodo CLI

A command-line todo application using Sui blockchain and Walrus storage.

## Installation

```bash
npm install -g waltodo
```

## Configuration

First, configure your Sui wallet:

```bash
waltodo configure
```

This will prompt you to:
- Select a network (devnet/testnet/mainnet)
- Enter your Sui wallet address
- Optionally store your private key (not recommended for production)

## Usage

### Add todos
Add one or more todos to a list:

```bash
# Add a single todo
waltodo add "my-list" -t "Buy groceries" -p high --tags "shopping,errands" -d "2025-05-01"

# Add multiple todos at once
waltodo add "shopping-list" -t "Buy milk" -t "Buy eggs" -t "Buy bread" -p high
```

Options:
- First argument or `--list, -l`: Name of the todo list (required)
- `-t, --task`: Task description (required, can be used multiple times)
- `-p, --priority`: Priority level (high/medium/low)
- `-d, --due`: Due date (YYYY-MM-DD format)
- `--tags`: Comma-separated tags
- `--encrypt`: Encrypt these todo items using the Seal protocol
- `--private`: Mark todos as private (stored locally only)
- `--test`: Mark todos as test items (stored locally only)

Validation:
- Priority must be one of: high, medium, low (case insensitive)
- Due date must be in YYYY-MM-DD format
- List name and at least one task are required

### List todos
```bash
waltodo list              # List all todo lists
waltodo list "my-list"    # Show tasks in a specific list
```

Options:
- `[listName]`: Optional name of list to display
- `--completed`: Show only completed items
- `--pending`: Show only pending items
- `--encrypted`: Show encrypted items (requires authentication)

### Update todos
```bash
waltodo update -l "my-list" -i "todo-id" [-t "New description"] [-p "high"] [-d "2025-05-01"] [--tags "updated,tags"]
```

Required Options:
- `-l, --list`: Name of the todo list
- `-i, --id`: ID of the todo

Optional Updates:
- `-t, --task`: New task description
- `-p, --priority`: New priority level (high/medium/low)
- `-d, --due`: New due date (YYYY-MM-DD)
- `--tags`: New comma-separated tags

### Complete todos
```bash
waltodo complete -l "my-list" -i "todo-id"
```

Required Options:
- `-l, --list`: Name of the todo list
- `-i, --id`: ID of the todo

### Check/Uncheck todos
```bash
# Check a todo
waltodo check -l "my-list" -i "todo-id"

# Uncheck a todo
waltodo uncheck -l "my-list" -i "todo-id"
```

Required Options:
- `-l, --list`: Name of the todo list
- `-i, --id`: ID of the todo

## Storage

Todo lists are stored in JSON files in the `Todos` directory, with each list having its own file (e.g., `Todos/my-list.json`).

Storage behavior depends on the todo type:
- Regular todos: Synchronized with both Walrus storage and Sui blockchain
- Private todos: Stored only in local files
- Test todos: Stored only in local files
- Encrypted todos: Stored encrypted in Walrus storage with Seal protocol

### Storage Locations
- Local todos: `./Todos/*.json` files
- Configuration: `~/.waltodo.json`
- Blockchain: Sui network (references only)
- Decentralized Storage: Walrus protocol (encrypted todo data)

## Error Handling

The CLI provides detailed error messages for common issues:
- Invalid priority levels
- Incorrect date formats
- Missing required fields
- Authentication failures
- Network connectivity issues

Each error includes:
- A descriptive message explaining the issue
- An error code for troubleshooting
- Suggested solutions where applicable

## Dependencies

The CLI uses the following key dependencies:
- @mysten/sui: ^1.28.2 - Sui blockchain integration
- @mysten/walrus: latest - Walrus storage protocol
- commander: ^11.1.0 - CLI framework
- chalk: ^4.1.2 - Terminal styling
- inquirer: ^8.2.5 - Interactive prompts

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start in development mode
npm run dev

# Create symlink for local testing
npm link
```