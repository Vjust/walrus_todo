# TypeScript Strict Mode Guide

**Date: May 10, 2025**

This guide documents our approach to handling TypeScript strict mode compliance in the WalTodo CLI project. TypeScript's strict mode provides additional safety and better type checking, but it can also introduce challenges, especially when working with external libraries or the OCLIF framework.

## Common TypeScript Strict Mode Issues

### 1. OCLIF Flag Default Value Type Issues

When defining flag default values with OCLIF, TypeScript strict mode may raise type compatibility issues, especially for array flags.

#### Problem:

```typescript
// Type error: Type 'string' is not assignable to type 'FlagDefault<string[], CustomOptions>'
priority: Flags.string({
  char: 'p',
  multiple: true,
  default: 'medium',
})
```

#### Solution:

For multiple flags (array values), use a function that returns an array:

```typescript
// Correct approach for multiple flags
priority: Flags.string({
  char: 'p',
  multiple: true,
  default: () => ['medium'],
})

// Alternatively, remove the default and handle it in your code:
priority: Flags.string({
  char: 'p',
  multiple: true,
})

// Then in your command logic:
const priorities = flags.priority || ['medium'];
```

### 2. Command Context Access Issues

Accessing command context variables in error handlers can cause TypeScript errors when the variable might be undefined.

#### Problem:

```typescript
// Error: Property 'listName' does not exist on type 'ListCommand'
// Or: Cannot find name 'args'
this.errorWithHelp(
  'List not found',
  `List "${args?.listName}" not found`,
  `Try running '${this.config.bin} list' to see all available lists`
);
```

#### Solution:

Define class properties to store these values explicitly:

```typescript
export default class ListCommand extends BaseCommand {
  // Define a class property
  private listName: string = '';

  async run(): Promise<void> {
    const { args } = await this.parse(ListCommand);
    
    // Store parsed values in class properties
    if (args.listName) {
      this.listName = args.listName;
      // Rest of the implementation
    }
    
    // Now you can use this.listName safely in error handlers
  }
}
```

### 3. Object Property Access with Potential undefined

TypeScript strict mode enforces null checks when accessing properties that might be undefined.

#### Problem:

```typescript
// Error: Object is possibly 'undefined'
const todoTitle = todoTitles[i];
```

#### Solution:

Add explicit null checks or use optional chaining:

```typescript
// Option 1: Explicit check
if (todoTitles && i < todoTitles.length) {
  const todoTitle = todoTitles[i];
}

// Option 2: Optional chaining with default
const todoTitle = todoTitles?.[i] || 'Default Title';
```

### 4. Type Assertions for External Libraries

When working with external libraries that have complex or incompatible type definitions:

#### Problem:

```typescript
// Error: Type 'unknown' is not assignable to type 'Transaction'
const transaction = this.walrusClient.createTransaction();
```

#### Solution:

Use type assertions to bridge incompatible types:

```typescript
// Type assertion to handle incompatible types
const transaction = this.walrusClient.createTransaction() as unknown as Transaction;
```

## Best Practices for Strict Mode Compliance

1. **Define Default Values Carefully**:
   - For array flags, always use a function returning an array, not a direct value
   - Be explicit about return types for default value functions

2. **Store Command Context in Class Properties**:
   - Create explicit class properties to store parsed arguments and flags
   - Initialize these properties with sensible defaults

3. **Prefer Early Returns for Undefined Handling**:
   - Use early returns with clear error messages when values might be undefined
   - Structure your code to minimize the need for null checks

4. **Use Type Guards Liberally**:
   - Implement type guards and runtime checks for complex type hierarchies
   - Use `instanceof` and `typeof` checks to narrow types

5. **Isolate Type Assertions**:
   - Keep type assertions (`as`) in adapter layers or boundary code
   - Document why assertions are necessary with comments
   - Create typed wrapper functions around assertion points

6. **Enable Incremental Strict Mode Adoption**:
   - Start with `strictNullChecks` before enabling full `strict` mode
   - Focus on one file or module at a time

## Handling Multiple Flag Values in OCLIF

The OCLIF framework supports multiple occurrences of the same flag using the `multiple: true` option:

```typescript
static flags = {
  task: Flags.string({
    char: 't',
    description: 'Task description (can be used multiple times)',
    multiple: true
  }),
  priority: Flags.string({
    char: 'p',
    description: 'Task priority (high, medium, low)',
    options: ['high', 'medium', 'low'],
    multiple: true
  }),
}
```

This allows commands like:

```bash
waltodo add -t "Task 1" -t "Task 2" -p high -p low
```

When handling multiple flag instances in your command implementation:

```typescript
// Values are returned as arrays
const taskTitles = flags.task || [];
const priorities = flags.priority || [];

// Map attributes to todos intelligently
for (let i = 0; i < taskTitles.length; i++) {
  const priority = priorities[i] !== undefined 
    ? priorities[i] 
    : priorities[priorities.length - 1];
  
  // Use the mapped attribute for this specific todo
}
```

## Implementation Notes

### Smart Attribute Mapping

When adding multiple todos with different attributes, we need to map each attribute to the corresponding todo:

```typescript
// Get attribute arrays
const priorities = flags.priority || ['medium'];
const dueDates = flags.due || [];
const tagSets = flags.tags || [];

// Process each todo
for (let i = 0; i < todoTitles.length; i++) {
  // Map attributes to this todo
  // Use from the corresponding index, or use the last one as default
  const priority = priorities[i] !== undefined ? priorities[i] : priorities[priorities.length - 1];
  const dueDate = dueDates[i] !== undefined ? CommandSanitizer.sanitizeDate(dueDates[i]) : undefined;
  const tags = tagSets[i] !== undefined ? CommandSanitizer.sanitizeTags(tagSets[i]) : [];

  // Create todo with mapped attributes
}
```

### Command Syntax Disambiguation 

The code must disambiguate between different command syntax patterns:

```typescript
// Check if there's an argument and task flags
if (args.listOrTitle && flags.task && flags.task.length > 0) {
  // First argument is treated as the list name when tasks are provided with -t
  listName = CommandSanitizer.sanitizeString(args.listOrTitle);
  todoTitles = flags.task.map(t => CommandSanitizer.sanitizeString(t));
}
// Check if there's an argument but no task flags
else if (args.listOrTitle && (!flags.task || flags.task.length === 0)) {
  // If the list flag is explicitly provided, the argument is the title
  if (flags.list) {
    listName = CommandSanitizer.sanitizeString(flags.list);
    todoTitles = [CommandSanitizer.sanitizeString(args.listOrTitle)];
  } 
  // Otherwise, the argument is the title and list is default
  else {
    listName = 'default';
    todoTitles = [CommandSanitizer.sanitizeString(args.listOrTitle)];
  }
}
```

## Build Modes

The project supports different build modes to accommodate development workflow:

1. **Production Build**: Full type checking and strict mode validation
   ```bash
   pnpm run build
   ```

2. **Development Build**: Skips type checking for faster iterations
   ```bash
   pnpm run build:dev
   ```

This allows for rapid development while ensuring production code meets all TypeScript strict mode requirements.