# Jest Mock Type Issues Analysis

## Overview
Analysis of Jest mocking issues causing exit code 134 in GitHub Actions. Focus on readline interface mocking, MockedObject type mismatches, and Jest mock function signature problems.

## 1. Readline Interface Mocking Issues

### Problem Location: `/tests/e2e/commands/interactive.e2e.test.ts`
- **Issue**: Using Sinon for readline mocking instead of Jest
- **Code Problems**:
  ```typescript
  import * as readline from 'readline';
  import * as sinon from 'sinon';
  
  // Mock readline interface with Sinon - incompatible with Jest setup
  mockReadline = {
    prompt: sandbox.stub(),
    setPrompt: sandbox.stub(),
    on: sandbox.stub().callsFake((event: string, handler: (input?: string) => void) => {
      // Complex callback handling that may fail in CI
    }),
    close: sandbox.stub().callsFake(() => {
      closeHandlers.forEach(handler => handler());
    }),
  };
  
  sandbox.stub(readline, 'createInterface').returns(mockReadline);
  ```

### Issues Identified:
1. **Mixed Testing Libraries**: Using Sinon with Jest (line 7-8)
2. **Type Mismatch**: `mockReadline` type doesn't match actual readline interface
3. **Callback Type Issues**: Handler signatures not properly typed
4. **Async Handler Problems**: Line handlers may not handle async properly

## 2. Undefined Mock Variables

### Problem Location: `/apps/cli/src/__tests__/unit/SafeAIService.test.ts`
- **Critical Issue**: Mock variables used without declaration
- **Lines 53-85**: Using `mockLogger` and `mockAIService` without proper declaration:
  ```typescript
  // Line 53: mockLogger used but never declared
  mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    // ...
  };
  
  // Line 66: mockAIService used but never declared  
  mockAIService = {
    summarize: jest.fn(),
    categorize: jest.fn(),
    // ...
  };
  ```

### Problem Location: `/apps/cli/src/__tests__/commands/complete.test.ts`
- **Critical Issue**: Multiple undefined mock variables
- **Lines 59-61, 74-86**: Using `mockTodoService`, `mockSuiClient`, `mockSuiNftStorage` without declaration

## 3. Jest Mock Function Signature Mismatches

### General Pattern Issues:
1. **Mock Implementation Types**: Inconsistent typing of jest.fn() returns
2. **Prototype Mocking**: Accessing `.prototype` on mock constructors incorrectly
3. **Method Signature Mismatches**: Mock methods don't match real implementations

### Example from complete.test.ts:
```typescript
// Line 59: Undefined mockTodoService
mockTodoService.prototype.getList.mockResolvedValue(defaultList);
// Should be: jest.spyOn(TodoService.prototype, 'getList').mockResolvedValue(defaultList);
```

## 4. Global Mock Setup Problems

### Problem Location: `/jest.setup.ts`
- **Missing Mock Declarations**: Global setup doesn't establish proper mock types
- **Jest Global Exposure**: Complex global variable assignments may cause issues
- **Lines 35-43**: Type casting that may not work in CI environment

### Issues:
1. **Type Safety**: Global jest assignments use `as unknown as Record<string, unknown>`
2. **Mock Cleanup**: Missing proper mock reset between tests
3. **Environment Variables**: Reset logic may not work in CI (lines 52-58)

## 5. Jest Mock Type Annotation Issues

### Common Patterns Causing Problems:
1. **Missing Type Annotations**: Many `jest.fn()` calls lack proper typing
2. **Constructor Mocking**: Improper mocking of class constructors
3. **Method Chaining**: Mock method chains not properly typed

### Example Issues:
```typescript
// Missing proper type annotation
const mockFunction = jest.fn(); // Should specify return type

// Incorrect constructor mocking
(AIService as jest.Mock).mockImplementation(() => mockAIService);
// Should use jest.mocked() or proper type assertion

// Prototype method access without proper setup
mockTodoService.prototype.getList // Error: mockTodoService not defined
```

## 6. Mock Object Type Conflicts

### Type System Issues:
1. **Jest Types vs Real Types**: Mocks don't match actual interface signatures
2. **Return Type Mismatches**: Mock return values don't match expected types
3. **Generic Type Problems**: Jest generic types not properly specified

## 7. Proposed Jest Mock Type Improvements

### 1. Fix Undefined Mock Variables
```typescript
// In SafeAIService.test.ts - Add proper declarations
let mockLogger: jest.Mocked<Logger>;
let mockAIService: jest.Mocked<AIService>;

beforeEach(() => {
  mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    addHandler: jest.fn(),
    clearHandlers: jest.fn(),
    getInstance: jest.fn(() => mockLogger),
  } as jest.Mocked<Logger>;
  
  // Proper Jest.mocked usage
  jest.mocked(Logger.getInstance).mockReturnValue(mockLogger);
});
```

### 2. Replace Sinon with Jest in Interactive Tests
```typescript
// Replace Sinon readline mocking with Jest
const mockReadlineInterface = {
  prompt: jest.fn(),
  setPrompt: jest.fn(),
  on: jest.fn(),
  close: jest.fn(),
} as jest.Mocked<readline.Interface>;

jest.spyOn(readline, 'createInterface').mockReturnValue(mockReadlineInterface);
```

### 3. Fix Constructor and Prototype Mocking
```typescript
// Instead of undefined mockTodoService
const mockTodoService = {
  getList: jest.fn(),
  getTodo: jest.fn(),
  toggleItemStatus: jest.fn(),
} as jest.Mocked<Partial<TodoService>>;

// Proper spying on prototype methods
jest.spyOn(TodoService.prototype, 'getList').mockImplementation(mockTodoService.getList);
```

### 4. Improve Global Mock Setup
```typescript
// Enhanced jest.setup.ts
declare global {
  var mockLogger: jest.Mocked<Logger>;
  var mockTodoService: jest.Mocked<TodoService>;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  // Proper mock initialization
});
```

### 5. Add Proper Type Annotations
```typescript
// Type-safe mock functions
const mockSummarize = jest.fn<Promise<string>, [Todo[]]>();
const mockCategorize = jest.fn<Promise<Record<string, string[]>>, [Todo[]]>();
```

## Critical Issues Summary

1. **High Priority**: Undefined mock variables in 3+ test files
2. **High Priority**: Sinon/Jest mixing in interactive tests  
3. **Medium Priority**: Missing type annotations on jest.fn()
4. **Medium Priority**: Prototype method mocking patterns
5. **Low Priority**: Global mock setup improvements

These issues are likely causing the exit code 134 failures in CI due to:
- ReferenceError from undefined variables
- Type conflicts between Sinon and Jest
- Async callback handling problems in readline mocking
- Missing mock cleanup between tests