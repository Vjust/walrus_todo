# Service Constructor and Dependency Injection Analysis

**Agent**: 01-diagnose-9  
**Scope**: Service constructor parameter mismatches and dependency injection issues  
**Date**: 2025-01-28

## Executive Summary

Analysis of service classes reveals multiple constructor parameter mismatches between service implementations and their corresponding tests. The main issues stem from inconsistent dependency injection patterns, missing constructor parameters in tests, and varying service initialization approaches across the codebase.

## Key Findings

### 1. Constructor Pattern Inconsistencies

#### A. Singleton vs Direct Instantiation
- **AuthenticationService**: Uses singleton pattern with `getInstance()` but tests try to instantiate directly
- **ConfigService**: Uses direct instantiation in both service and tests ✅
- **TodoService**: Inconsistent - multiple implementations with different constructor signatures

#### B. Parameter-less vs Parameterized Constructors
```typescript
// Pattern 1: No parameters (auto-initialized)
class TodoService {
  constructor() { /* auto-init */ }
}

// Pattern 2: Dependency injection
class SafeAIService {
  constructor(/* no required params but accepts optional ones */) {}
}

// Pattern 3: Mixed approaches
class AuthenticationService {
  private constructor() { /* singleton */ }
  static getInstance(): AuthenticationService
}
```

### 2. Specific Service Constructor Issues

#### A. TodoService (Multiple Implementations)
**File**: `/apps/cli/src/services/todo-service.ts`
```typescript
constructor() {
  // Gets storage path from configService singleton
  this.todosPath = configService.getTodosDirectory();
}
```

**File**: `/apps/cli/src/services/todoService.ts` 
```typescript
constructor() {
  // Uses STORAGE_CONFIG constant directly
  this.todosDir = path.join(process.cwd(), STORAGE_CONFIG.TODOS_DIR);
}
```

**Issue**: Two different TodoService implementations with same constructor signature but different initialization logic.

#### B. SafeAIService
**Implementation**:
```typescript
constructor() {
  this.logger = Logger.getInstance();
  this.initializeAIService();
}
```

**Test**: 
```typescript
// Tests have missing mock variables (line 53, 66)
mockLogger = { /* incomplete mock */ } as unknown as jest.Mocked<Logger>;
mockAIService = { /* methods list */ } as unknown as jest.Mocked<AIService>;
```

**Issue**: Tests declare mock variables but don't properly initialize them before use.

#### C. AuthenticationService
**Implementation**:
```typescript
private constructor() {
  this.logger = Logger.getInstance();
}

public static getInstance(): AuthenticationService {
  if (!AuthenticationService.instance) {
    AuthenticationService.instance = new AuthenticationService();
  }
  return AuthenticationService.instance;
}
```

**Test**:
```typescript
// Line 76: Direct instantiation attempt
authService = AuthenticationService.getInstance(); // ✅ Correct
```

**Issue**: Tests correctly use singleton pattern.

#### D. AIService
**Implementation**:
```typescript
constructor(
  provider?: AIProvider,
  modelName?: string,
  options: AIModelOptions = {},
  verificationService?: AIVerificationService
) {
  // Complex initialization with optional parameters
}
```

**Test**:
```typescript
// Line 20: Uses factory method instead of constructor
service = createMockAIService(testApiKey);
```

**Issue**: Tests bypass constructor completely using factory method.

### 3. Dependency Injection Pattern Issues

#### A. Service Dependencies
```typescript
// ConfigService (self-contained)
constructor() {
  // No external dependencies ✅
}

// TodoService (depends on configService)
constructor() {
  this.todosPath = configService.getTodosDirectory(); // Tight coupling
}

// AuthenticationService (depends on permissionService)
// Uses external service calls throughout methods, not constructor injection
```

#### B. Logger Dependency Pattern
```typescript
// Pattern 1: Singleton access (most common)
this.logger = Logger.getInstance();

// Pattern 2: Direct instantiation
const logger = new Logger('service-name');

// Pattern 3: Factory method
this.logger = Logger.getInstance();
```

### 4. Test Instantiation Mismatches

#### A. Missing Mock Initialization
**SafeAIService Test** (lines 53-86):
```typescript
// Variables declared but not properly initialized
let mockLogger: jest.Mocked<Logger>;
let mockAIService: jest.Mocked<AIService>;

beforeEach(() => {
  // mockLogger and mockAIService used but not defined here
  safeAIService = new SafeAIService();
});
```

#### B. Incomplete Mock Objects
**AuthenticationService Test**:
```typescript
const mockUser: PermissionUser = {
  id: 'user-123',
  username: 'testuser',
  // ... complete mock ✅
};
```

**ConfigService Test**:
```typescript
const mockConfig: Config = {
  network: 'testnet',
  // ... complete mock ✅
};
```

### 5. Service Interface Changes

#### A. TodoService Evolution
- Original: Simple file-based storage
- Current: Multiple implementations with different storage strategies
- Tests: Written for original implementation

#### B. AI Service Hierarchy
- AIService: Core implementation
- SafeAIService: Wrapper with error handling
- Tests: Mix of direct testing and factory-based testing

## Proposed Service Constructor Standardization

### 1. Dependency Injection Pattern
```typescript
interface ServiceDependencies {
  logger?: Logger;
  configService?: ConfigService;
  // ... other dependencies
}

class StandardService {
  constructor(dependencies: ServiceDependencies = {}) {
    this.logger = dependencies.logger ?? Logger.getInstance();
    this.configService = dependencies.configService ?? configService;
  }
}
```

### 2. Test Infrastructure
```typescript
interface MockDependencies {
  mockLogger: jest.Mocked<Logger>;
  mockConfigService: jest.Mocked<ConfigService>;
}

function createServiceWithMocks(overrides: Partial<MockDependencies> = {}): {
  service: StandardService;
  mocks: MockDependencies;
} {
  const mocks = {
    mockLogger: createMockLogger(),
    mockConfigService: createMockConfigService(),
    ...overrides
  };
  
  const service = new StandardService(mocks);
  return { service, mocks };
}
```

### 3. Service Registration Pattern
```typescript
// Service registry for dependency injection
class ServiceRegistry {
  private static services = new Map<string, any>();
  
  static register<T>(name: string, instance: T): void {
    this.services.set(name, instance);
  }
  
  static get<T>(name: string): T {
    return this.services.get(name) as T;
  }
}
```

## Test Instantiation Fixes Needed

### 1. SafeAIService Test
```typescript
// Fix missing mock initialization
beforeEach(() => {
  mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    getInstance: jest.fn(() => mockLogger),
  } as jest.Mocked<Logger>;

  mockAIService = {
    summarize: jest.fn(),
    categorize: jest.fn(),
    // ... all required methods
  } as jest.Mocked<AIService>;

  (Logger.getInstance as jest.Mock).mockReturnValue(mockLogger);
  (AIService as jest.Mock).mockImplementation(() => mockAIService);
});
```

### 2. TodoService Test Consolidation
```typescript
// Standardize on single TodoService implementation
// Choose either todo-service.ts or todoService.ts
// Update tests to match chosen implementation
```

### 3. Authentication Service Test
```typescript
// Already correctly implemented ✅
authService = AuthenticationService.getInstance();
```

## Recommendations

1. **Consolidate TodoService implementations** - Choose one and remove the other
2. **Standardize dependency injection** - Use constructor injection pattern consistently
3. **Fix SafeAIService test mocks** - Properly initialize mock variables
4. **Implement service factory pattern** - For complex services with multiple dependencies
5. **Create service interface contracts** - Define clear interfaces for all services
6. **Add service lifecycle management** - For proper initialization and cleanup

## Critical Issues Requiring Immediate Attention

1. **Missing mock variables in SafeAIService tests** (causing undefined references)
2. **Duplicate TodoService implementations** (causing confusion and potential conflicts)
3. **Inconsistent singleton usage** (some tests bypass singleton pattern)
4. **Missing dependency injection** (services tightly coupled to global singletons)

These issues are likely contributing to the GitHub Actions exit code 134 failures due to runtime errors from undefined mock objects and inconsistent service instantiation patterns.