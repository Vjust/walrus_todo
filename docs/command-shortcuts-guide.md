# WalTodo Command Shortcuts Guide

The WalTodo CLI now includes a comprehensive command shortcuts system that makes the interface more user-friendly and efficient.

## Overview

Instead of typing full commands, you can use shorter aliases:
- Single-letter shortcuts for frequently used commands
- Common abbreviations for longer commands
- Smart shortcuts that use natural language
- Unix-style shortcuts for familiar commands

## Available Shortcuts

### Single-Letter Shortcuts
- `a` → `add` - Add a new todo
- `l` → `list` - List todos
- `c` → `complete` - Complete a todo
- `d` → `delete` - Delete a todo
- `s` → `store` - Store on blockchain
- `u` → `update` - Update a todo
- `h` → `help` - Show help
- `r` → `retrieve` - Retrieve from storage
- `i` → `image` - Image operations
- `p` → `deploy` - Deploy contract
- `g` → `suggest` - Get AI suggestions
- `v` → `verify` - Verify todos

### Common Abbreviations
- `del` → `delete`
- `comp` → `complete`
- `conf` → `configure`
- `cfg` → `config`
- `ls` → `list` (Unix-style)
- `rm` → `delete` (Unix-style)
- `up` → `update`
- `ret` → `retrieve`
- `img` → `image`
- `dep` → `deploy`
- `sugg` → `suggest`
- `chk` → `check`
- `acc` → `account`

### Smart Shortcuts
- `todo` → `add` - Natural language for adding
- `done` → `complete` - Natural language for completing
- `new` → `create` - Natural language for creating
- `show` → `list` - Natural language for listing
- `all` → `list` - Show all todos
- `status` → `list` - Check status
- `upload` → `store` - Upload to storage
- `download` → `retrieve` - Download from storage
- `fetch` → `retrieve` - Alternative for download
- `nft` → `image:create-nft` - Direct NFT creation

### AI Shortcuts
- `analyze` → `ai:analyze`
- `suggest` → `ai:suggest`
- `summarize` → `ai:summarize`
- `categorize` → `ai:categorize`
- `prioritize` → `ai:prioritize`
- `enhance` → `ai:enhance`

### Account Shortcuts
- `login` → `account:auth`
- `auth` → `account:auth`
- `perm` → `account:permissions`
- `perms` → `account:permissions`
- `switch` → `account:switch`
- `whoami` → `account:show`

### Storage Shortcuts
- `local` → `store:simple`
- `chain` → `store:list`
- `blockchain` → `store:list`

### System Shortcuts
- `audit` → `system:audit`
- `log` → `system:audit`
- `logs` → `system:audit`

## Usage Examples

### Basic Usage
```bash
# Add a todo
waltodo a "Buy groceries"  # Same as: waltodo add "Buy groceries"

# List todos
waltodo l                  # Same as: waltodo list

# Complete a todo
waltodo c 123             # Same as: waltodo complete 123

# Delete a todo
waltodo d 456             # Same as: waltodo delete 456
```

### Smart Shortcuts
```bash
# Natural language for adding todos
waltodo todo "Call mom"    # Same as: waltodo add "Call mom"

# Natural language for completing
waltodo done 789          # Same as: waltodo complete 789

# Show all todos
waltodo all               # Same as: waltodo list

# Check status
waltodo status            # Same as: waltodo list
```

### Unix-Style Shortcuts
```bash
# List todos
waltodo ls                # Same as: waltodo list

# Remove a todo
waltodo rm 123            # Same as: waltodo delete 123
```

### AI Shortcuts
```bash
# Analyze todos
waltodo analyze           # Same as: waltodo ai:analyze

# Get suggestions
waltodo suggest           # Same as: waltodo ai:suggest

# Summarize todos
waltodo summarize         # Same as: waltodo ai:summarize
```

### Direct Operations
```bash
# Create NFT directly
waltodo nft               # Same as: waltodo image:create-nft

# Check current account
waltodo whoami            # Same as: waltodo account:show

# Use local storage
waltodo local             # Same as: waltodo store:simple

# Use blockchain storage
waltodo chain             # Same as: waltodo store:list
```

## Getting Help

### View All Shortcuts
```bash
waltodo help --shortcuts
# or
waltodo h -s
```

### Get Help for Specific Command
```bash
# These all show help for the 'add' command
waltodo help add
waltodo help a
waltodo h a
```

### See Available Commands
```bash
waltodo help
# or simply
waltodo h
```

## Debug Mode

To see shortcut expansions in real-time:
```bash
DEBUG=1 waltodo a "Test todo"
# Output: ✓ Expanded shortcut: a → add
```

## Tips

1. **Single-letter shortcuts** are perfect for frequently used commands like `add`, `list`, and `complete`
2. **Smart shortcuts** make the CLI feel more natural - use `todo` instead of `add`
3. **Unix-style shortcuts** (`ls`, `rm`) are familiar to terminal users
4. **Combine shortcuts with flags** - they work just like regular commands
5. **Use tab completion** - shortcuts integrate with shell completion

## Implementation Details

The shortcuts system is implemented through:
- A centralized `CommandShortcuts` class that manages all mappings
- A prerun hook that processes shortcuts before command execution
- Integration with the help system to show available shortcuts
- Support for debugging to show expansions

This makes the CLI more accessible to new users while maintaining power for advanced users.