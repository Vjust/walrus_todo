# 🚨 URGENT: Disable BackgroundOrchestrator for Local Commands

## Problem Analysis
The BackgroundOrchestrator is:
1. **Initializing for ALL commands** (even simple local todos)
2. **Not actually running in background** (blocking terminal)
3. **Consuming excessive memory** for local file operations
4. **Creating unnecessary complexity** for basic operations

## Root Causes Found

### 1. **Global Initialization**
```typescript
// In BackgroundCommandOrchestrator.ts line 704
export const backgroundOrchestrator = new BackgroundCommandOrchestrator();
```
This creates a singleton that initializes immediately when ANY command loads.

### 2. **Heavy Resource Monitoring**
```typescript
// Lines 480-495: Resource monitoring runs every 5 seconds
this.resourceMonitor = setInterval(() => {
  const usage = this.getCurrentResourceUsage();
  // Memory monitoring causing performance issues
}, 5000);
```

### 3. **Auto-Background Logic Broken**
```typescript
// Lines 164-191: shouldRunInBackground() is complex but broken
// It's supposed to detect but actually blocks the terminal
```

## Immediate Fix Needed

### Option 1: Environment Variable Bypass (FASTEST)
```bash
export WALTODO_SKIP_ORCHESTRATOR=true
waltodo add "fast todo"
```

### Option 2: Conditional Loading
Only load BackgroundOrchestrator for specific commands:
- `store`, `deploy`, `create-nft`, `image`
- NOT for: `add`, `list`, `complete`, `delete`

### Option 3: Lazy Initialization
Don't create singleton until actually needed.

## Files to Modify

1. **apps/cli/src/base-command.ts** - Remove auto-initialization
2. **apps/cli/src/utils/BackgroundCommandOrchestrator.ts** - Add environment checks
3. **apps/cli/src/commands/add.ts** - Skip orchestrator for local operations

## Expected Performance Improvement

| Command | Before | After |
|---------|--------|-------|
| `waltodo add "todo"` | 30+ seconds | <1 second |
| `waltodo list` | 10+ seconds | <0.5 seconds |
| Terminal availability | Blocked | Immediate |

This fix is critical for basic usability!