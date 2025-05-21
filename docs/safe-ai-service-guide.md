# Safe AI Service Guide

## Overview

The **SafeAIService** is a robust wrapper around the core AI service that prevents AI failures from halting the core todo management system. It provides comprehensive error handling, graceful degradation, and fallback responses when AI services are unavailable.

## Key Features

- **Error Isolation**: Catches all AI service errors without throwing exceptions
- **Graceful Fallbacks**: Provides meaningful fallback responses when AI is unavailable
- **Health Monitoring**: Automatic health checking and monitoring of AI service status
- **API Key Validation**: Handles credential issues without system crashes
- **Non-blocking Operations**: Makes all AI operations optional and non-blocking
- **Comprehensive Logging**: Detailed logging for debugging and monitoring

## Installation

The SafeAIService is automatically exported from the AI services module:

```typescript
import { safeAIService, SafeAIResult } from '../services/ai';
```

## Basic Usage

### Checking AI Availability

```typescript
// Check if AI service is available before using
const isAvailable = await safeAIService.isAIAvailable();
console.log(`AI Available: ${isAvailable}`);

// Get detailed status information
const status = safeAIService.getAIStatus();
console.log('AI Status:', status);
// Output: { initialized: true, healthy: true, error: null, lastHealthCheck: Date }
```

### Safe AI Operations

All AI operations return a `SafeAIResult<T>` object that contains success status, results, and error information:

```typescript
interface SafeAIResult<T> {
  success: boolean;        // Whether operation was successful
  result?: T;             // The result data if successful
  error?: string;         // Error message if failed
  aiAvailable: boolean;   // Whether AI was available during operation
  usedFallback: boolean;  // Whether fallback response was used
  operation: string;      // The operation that was attempted
}
```

### Summarizing Todos

```typescript
const todos = [
  { id: '1', title: 'Buy groceries', completed: false },
  { id: '2', title: 'Walk the dog', completed: true }
];

const summaryResult = await safeAIService.summarize(todos);

if (summaryResult.success) {
  console.log('Summary:', summaryResult.result);
  
  if (summaryResult.usedFallback) {
    console.log('Used fallback response due to AI unavailability');
  } else {
    console.log('AI-generated summary');
  }
} else {
  console.error('Summary failed:', summaryResult.error);
}

// Example outputs:
// AI Available: "Your 2 todos focus on daily tasks and personal care..."
// Fallback: "Summary: You have 2 todos in your list. Consider reviewing and prioritizing them."
```

### Categorizing Todos

```typescript
const categoriesResult = await safeAIService.categorize(todos);

if (categoriesResult.success) {
  console.log('Categories:', categoriesResult.result);
  // AI Result: { "Personal": ["1"], "Household": ["2"] }
  // Fallback: { "General": ["1", "2"] }
}
```

### Prioritizing Todos

```typescript
const prioritiesResult = await safeAIService.prioritize(todos);

if (prioritiesResult.success) {
  console.log('Priorities:', prioritiesResult.result);
  // AI Result: { "1": 7, "2": 4 } (1-10 scale)
  // Fallback: Uses existing todo priority levels (high=8, medium=5, low=3)
}
```

### Getting Suggestions

```typescript
const suggestionsResult = await safeAIService.suggest(todos);

if (suggestionsResult.success) {
  console.log('Suggestions:', suggestionsResult.result);
  // AI Result: ["Set specific times for each task", "Add deadline reminders"]
  // Fallback: ["Review completed tasks for insights", "Set realistic deadlines for pending items", ...]
}
```

### Analyzing Todos

```typescript
const analysisResult = await safeAIService.analyze(todos);

if (analysisResult.success) {
  console.log('Analysis:', analysisResult.result);
  // Contains keyThemes, totalTasks, suggestions, workflow recommendations
}
```

### Single Todo Operations

```typescript
const todo = { id: '1', title: 'Learn TypeScript', description: 'Complete online course' };

// Suggest tags
const tagsResult = await safeAIService.suggestTags(todo);
// AI Result: ["learning", "programming", "typescript"]
// Fallback: ["general", "task"]

// Suggest priority
const priorityResult = await safeAIService.suggestPriority(todo);
// AI Result: "medium" | "high" | "low"
// Fallback: "medium"
```

## Advanced Features

### Provider Management

```typescript
// Change AI provider safely
const providerResult = await safeAIService.setProvider('openai', 'gpt-4');

if (providerResult.success) {
  console.log('Provider changed successfully');
} else {
  console.error('Provider change failed:', providerResult.error);
  // System continues working with existing provider or fallbacks
}
```

### Blockchain Verification

The SafeAIService also supports blockchain-verified AI operations:

```typescript
const verifiedSummary = await safeAIService.summarizeWithVerification(todos);

if (verifiedSummary.success) {
  const { result, verified, verificationId } = verifiedSummary.result!;
  console.log('Summary:', result);
  console.log('Blockchain Verified:', verified);
  console.log('Verification ID:', verificationId);
}
```

### Operation Cancellation

```typescript
// Cancel all pending AI operations safely
safeAIService.cancelAllOperations('User cancelled');
// This never throws errors, even if cancellation fails
```

## Error Handling Strategies

### 1. Automatic Fallbacks

```typescript
// The service automatically provides fallbacks for all operations
const result = await safeAIService.summarize(todos);

// result.success is always true because fallbacks ensure operation completion
// Check result.usedFallback to know if AI was actually used
if (result.usedFallback) {
  console.log('Using fallback response due to:', result.error);
}
```

### 2. Health Monitoring

```typescript
// Health checks are performed automatically every 30 seconds
// Manual health check:
const healthy = await safeAIService.isAIAvailable();

if (!healthy) {
  console.log('AI service is unhealthy, operations will use fallbacks');
}
```

### 3. Status Monitoring

```typescript
const status = safeAIService.getAIStatus();

if (!status.initialized) {
  console.log('AI service failed to initialize:', status.error);
}

if (!status.healthy) {
  console.log('AI service is unhealthy, last check:', status.lastHealthCheck);
}
```

## Fallback Responses

The SafeAIService provides intelligent fallback responses for each operation:

### Summarize Fallback
```
"Summary: You have X todo(s) in your list. Consider reviewing and prioritizing them."
```

### Categorize Fallback
```javascript
{ "General": ["todo-id-1", "todo-id-2", ...] }
```

### Prioritize Fallback
Based on existing todo priority fields:
- `high` priority todos → score of 8
- `medium` priority todos → score of 5  
- `low` priority todos → score of 3
- No priority → score of 5

### Suggest Fallback
```javascript
[
  "Review completed tasks for insights",
  "Set realistic deadlines for pending items", 
  "Break down complex tasks into smaller steps"
]
```

### Analyze Fallback
```javascript
{
  keyThemes: ['Task management', 'Productivity'],
  totalTasks: X,
  completedTasks: 0,
  suggestions: ['Consider organizing tasks by priority', 'Review and update task descriptions'],
  workflow: 'Review → Prioritize → Execute → Complete'
}
```

## Integration with Commands

Use SafeAIService in command handlers to ensure commands never fail due to AI issues:

```typescript
// In a command handler
import { safeAIService } from '../services/ai';

export class SuggestCommand extends BaseCommand {
  async run(): Promise<void> {
    const todos = await this.loadTodos();
    
    // This will never throw or crash the command
    const suggestions = await safeAIService.suggest(todos);
    
    if (suggestions.usedFallback) {
      this.warn('AI suggestions unavailable, showing default suggestions');
    }
    
    this.displaySuggestions(suggestions.result!);
  }
}
```

## Best Practices

1. **Always Check Success**: Even though operations don't throw, check the success flag for complete error handling
2. **Handle Fallbacks Gracefully**: Inform users when fallback responses are used
3. **Monitor AI Health**: Periodically check AI availability for user feedback
4. **Use Appropriate Timeouts**: All operations have built-in 15-second timeouts
5. **Log Appropriately**: The service logs warnings for AI failures, not errors

## Configuration

The SafeAIService uses these default configurations:

- **Health Check Interval**: 30 seconds
- **Operation Timeout**: 15 seconds  
- **Health Check Timeout**: 5 seconds
- **Cache TTL**: 1 minute

These can be adjusted by modifying the service constants if needed.

## Migration from Direct AI Service

Replace direct AI service usage:

```typescript
// Before (risky)
try {
  const summary = await aiService.summarize(todos);
  console.log(summary);
} catch (error) {
  console.error('AI failed:', error);
  // Command crashes or shows error
}

// After (safe)
const result = await safeAIService.summarize(todos);
console.log(result.result!); // Always available due to fallbacks

if (result.usedFallback) {
  console.log('Note: AI unavailable, showing basic summary');
}
```

This ensures your application continues to function smoothly even when AI services experience issues.