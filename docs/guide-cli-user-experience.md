# CLI User Experience Guide

*Date: May 10, 2025*

This guide outlines best practices for creating a clean, user-friendly, and intuitive command-line interface (CLI) for the WalTodo application. These principles will help create a consistent and pleasant experience for users interacting with the CLI.

## Core Principles

1. **Consistency**: Maintain consistent patterns, icons, colors, and terminology
2. **Progressive Disclosure**: Show basic information first, with details available when needed
3. **Guided Experience**: Provide helpful prompts, suggestions, and next steps
4. **Visual Organization**: Use visual hierarchy, spacing, and formatting to enhance readability
5. **Error Recovery**: Provide clear error messages with actionable suggestions 

## Visual Elements

### Color System

The WalTodo CLI uses a consistent color system to convey meaning:

| Element | Color | Purpose |
|---------|-------|---------|
| Success | Green | Completed items, successful operations |
| Warning | Yellow | Warnings, pending items, medium priority |
| Error | Red | Errors, high priority items |
| Info | Blue | Information, low priority, dates |
| Dim | Gray | Secondary information, hints, inactive items |
| Cyan | Cyan | List names, tags, commands |
| White | White | Regular text, bullets |

### Icons

Icons provide visual cues that help users quickly understand information:

```
// Status icons
SUCCESS: '✓',  // Completed items, successful operations
ERROR: '✖',    // Errors
WARNING: '⚠',  // Warnings
INFO: 'ℹ',     // Information
PENDING: '○',  // Pending items
ACTIVE: '●',   // Active items

// Object icons
TODO: '📝',    // Todo items
LIST: '📋',    // Single todo list
LISTS: '📚',   // Multiple todo lists
TAG: '🏷️',     // Tags
PRIORITY: '⚡', // Priority
DATE: '📅',    // Due date
```

### Text Formatting

Text formatting enhances readability and establishes visual hierarchy:

- **Bold** for important information, headings, and key data
- **Regular** for standard content and descriptions
- **Dim** for secondary information, hints, and help text
- **Boxes** for grouping related information and highlighting important content
- **Lists** for displaying multiple related items with clear visual separation

## Interactive Elements

### Progress Indicators

For long-running operations, provide clear progress indicators:

- **Spinners** for operations with unknown duration
- **Progress bars** for operations with known steps or percentage completion
- **Completion messages** when operations finish successfully

### Command Examples

When showing example commands:

- Include a brief description after each example using `#` comments
- Show common use cases first, progressing to more advanced examples
- Format examples to be copy-paste friendly

## Error Handling

Errors should be informative and actionable:

- **Clear titles** that identify the error category
- **Concise descriptions** of what went wrong
- **Actionable suggestions** for resolving the issue
- **Troubleshooting steps** for more complex errors

### Example Error Format

```
 ERROR  Missing Title
✖ Todo title is required

ℹ Suggestion:
  Provide a title as an argument or with the -t flag:
  waltodo add "Buy groceries"
  waltodo add -t "Buy groceries"
```

## Command Organization

### Help Text

Help text should be well-structured and informative:

- **Clear descriptions** of what each command does
- **Concise examples** that show common usage patterns
- **Organized flags** grouped by purpose (e.g., Storage Options, AI Options)
- **Formatted examples** with explanatory comments

### Natural Command Syntax

Commands should follow natural language patterns where possible:

- **Positional arguments** should have intuitive meanings based on context
- **Flag arguments** should be used for attributes and modifiers
- **Multiple flags** should be supported for bulk operations
- **Context-sensitive interpretation** of arguments based on flag presence

### Output Structure

Command output should follow a consistent structure:

1. **Operation header**: What's being done
2. **Progress indicators**: For long-running operations
3. **Main results**: Primary information the user is looking for
4. **Details**: Additional information in a clear, organized format
5. **Next steps**: Suggestions for what to do next

## Implementation Guidelines

### Base Command Class

Standardize CLI behavior using a consistent base command:

- **Define constants** for icons, colors, and formatting
- **Create helper methods** for common output patterns (success, warning, error)
- **Implement consistent error handling** with helpful messages
- **Provide structured output methods** (section, simpleList, etc.)

### Command Structure

Organize commands with a consistent structure:

- Extract complex logic into separate methods
- Handle special cases (JSON output) with dedicated methods
- Follow a predictable flow: input validation → processing → output
- Provide consistent success and error messaging

## Specific UI Patterns

### Enhanced Command Syntax

The CLI supports enhanced command syntax for adding multiple todos to a list:

```bash
# Add multiple todos to a list with different priorities
waltodo add "my-list" -t "High priority task" -p high -t "Low priority task" -p low

# Add multiple todos with different tags
waltodo add "work-list" -t "Task with tags" -g "work,urgent" -t "Another task" -g "home,relax"
```

The command syntax follows these principles:

1. **Context-aware argument interpretation**: The first positional argument is interpreted as the list name when task flags (`-t`) are present
2. **Paired attributes**: Each task can have its own set of attributes (priority, due date, tags)
3. **Fallback behavior**: If fewer attributes than tasks are provided, the last attribute is used for remaining tasks
4. **Backward compatibility**: Traditional syntax with explicit `-l` flag still works

### Section Boxes

Use boxes to group related information:

```
┌─[ Title ]──────────────────────────┐
│ Content line 1                     │
│ Content line 2                     │
└───────────────────────────────────┘
```

### Progress Indicators

Show progress for long-running operations:

```
⏳ Operation in progress...
✓ Operation completed successfully
```

### Lists with Titles

Format lists with clear titles and bullet points:

```
Next Steps:
  • Command 1 - Description
  • Command 2 - Description
```

### Detailed Item Display

Show item details with consistent formatting:

```
○ [abc123] MEDIUM    Buy groceries
   📅 Due: 2023-05-15 | 🏷️ Tags: shopping, food | 🔒 Private
```

## Applying These Principles

When adding new commands or modifying existing ones:

1. **Follow the patterns** established in the base command
2. **Reuse existing components** for consistent appearance
3. **Test with realistic data** to ensure good formatting
4. **Consider different terminal sizes** and color schemes
5. **Provide helpful next steps** after command completion

By following these guidelines, the WalTodo CLI will provide a clean, user-friendly, and intuitive experience that makes managing todos from the command line a pleasure rather than a chore.

## Command Syntax Evolution

The WalTodo CLI has evolved to support increasingly natural command syntax:

### Basic Syntax (v1.0)

```bash
# Original syntax with explicit flags
waltodo add --title "Buy groceries" --list shopping --priority high
```

### Improved Syntax (v1.1)

```bash
# Short flags and positional argument for title
waltodo add "Buy groceries" -l shopping -p high
```

### Enhanced Multi-Todo Syntax (v1.2+)

```bash
# First argument as list name with multiple todo items
waltodo add "shopping" -t "Milk" -t "Eggs" -t "Bread"

# Multiple todos with different attributes
waltodo add "work" -t "Urgent task" -p high -t "Normal task" -p medium
```

This evolution follows our principle of making the CLI more intuitive and closer to natural language patterns, while maintaining backward compatibility with earlier syntax versions.

### Implementation Considerations

When implementing new syntax features:

1. **Context-aware argument parsing**: Determine the meaning of arguments based on the presence and values of other flags
2. **Clear disambiguation rules**: Establish unambiguous rules for interpreting user input
3. **Helpful error messages**: Provide clear guidance when syntax is incorrect
4. **Consistent behavior**: Ensure similar commands follow similar patterns
5. **Documentation**: Update help text and examples to showcase the new syntax