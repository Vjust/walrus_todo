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
waltodo add -l "my-list" -t "Buy groceries" -p high --tags "shopping,errands" -d "2025-05-01" [--encrypt] [--private]
```

Options:
- `-l, --list`: Name of the todo list
- `-t, --task`: Task description
- `-p, --priority`: Priority level (high/medium/low)
- `-d, --due`: Due date (YYYY-MM-DD)
- `--tags`: Comma-separated tags
- `--encrypt`: Encrypt this todo item using the Seal protocol
- `--private`: Mark todo as private (stored locally only)

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

### Publish a list to blockchain
```bash
waltodo publish -l "my-list"
```

Options:
- `-l, --list`: Name of the todo list to publish

### Sync with blockchain
```bash
waltodo sync -l "my-list"
```

Options:
- `-l, --list`: Name of the todo list to synchronize

### Share a list
```bash
waltodo share -l "my-list" --recipient "0x123...abc"
```

Options:
- `-l, --list`: Name of the todo list to share
- `--recipient`: Sui address of the recipient

### View account information
```bash
waltodo account
```

### Switch network
```bash
waltodo network [testnet|mainnet]
```

## Storage

Tasks are stored using Walrus storage for data persistence and the Sui blockchain for decentralized access control. Private todos are stored locally only, while shared todos leverage blockchain capabilities for collaborative management.

## Encryption

Sensitive todos can be encrypted using the Seal protocol, ensuring that only authorized users can view their contents.