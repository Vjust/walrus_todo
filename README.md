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

### Add a todo
```bash
waltodo add -l "my-list" -t "Buy groceries" -p high --tags "shopping,errands" -d "2025-05-01"
```

Options:
- `-l, --list`: Name of the todo list
- `-t, --task`: Task description
- `-p, --priority`: Priority level (high/medium/low)
- `-d, --due`: Due date (YYYY-MM-DD)
- `--tags`: Comma-separated tags
- `--encrypt`: Encrypt this todo item

### List todos
```bash
waltodo list -l "my-list" [--completed|--pending]
```

Options:
- `-l, --list`: Filter by list name
- `--completed`: Show only completed items
- `--pending`: Show only pending items

### Complete a todo
```bash
waltodo complete -l "my-list" -i "todo-id"
```

Options:
- `-l, --list`: Name of the todo list
- `-i, --id`: ID of the todo

### Update a todo
```bash
waltodo update -l "my-list" -i "todo-id" [-t "New description"] [-p "high"] [-d "2025-05-01"] [--tags "updated,tags"]
```

Options:
- `-l, --list`: Name of the todo list
- `-i, --id`: ID of the todo
- `-t, --task`: New task description
- `-p, --priority`: New priority level
- `-d, --due`: New due date
- `--tags`: New comma-separated tags

### Delete a todo
```bash
waltodo delete -l "my-list" -i "todo-id" [-f]
```

Options:
- `-l, --list`: Name of the todo list
- `-i, --id`: ID of the todo
- `-f, --force`: Skip confirmation prompt

## Storage

Tasks are stored using Walrus storage for data persistence and the Sui blockchain for decentralized access control.