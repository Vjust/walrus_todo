# Edge-Cases Test Validation Strategy

## Overview

This document outlines the comprehensive validation strategy for ensuring edge-cases tests work correctly after Jest configuration and command execution fixes.

## Current State Analysis

### Edge-Cases Test Structure
- **Location 1**: `/tests/edge-cases/transaction-edge-cases.test.ts` (root level)
- **Location 2**: `/apps/cli/src/__tests__/edge-cases/transaction-edge-cases.test.ts` (CLI app level)
- **Test Count**: 2 edge-cases test files
- **Current Status**: Not included in Jest testMatch patterns

### Jest Configuration Issues Identified
1. **testMatch patterns** missing edge-cases directories
2. **Projects configuration** not covering edge-cases paths
3. **Test execution scripts** lacking edge-cases target patterns

## Validation Strategy Components

### 1. Configuration Validation Phase

#### 1.1 Jest Discovery Validation
```bash
# Test 1: Verify Jest can discover all edge-cases tests
npx jest --listTests --testPathPattern=edge-cases

# Expected Output:
# /Users/angel/Documents/Projects/walrus_todo/tests/edge-cases/transaction-edge-cases.test.ts
# /Users/angel/Documents/Projects/walrus_todo/apps/cli/src/__tests__/edge-cases/transaction-edge-cases.test.ts

# Success Criteria: Both test files listed
# Failure Indicators: Empty list, missing files, or error messages
```

#### 1.2 Pattern Matching Validation
```bash
# Test 2: Verify updated testMatch patterns work
npx jest --listTests --testPathPattern="edge-cases" --passWithNoTests

# Expected Output: Clean exit code 0 with test files listed
# Success Criteria: No pattern matching errors, both edge-cases locations found
# Failure Indicators: "No tests found" warnings, pattern match failures
```

### 2. Execution Validation Phase

#### 2.1 Dry Run Validation
```bash
# Test 3: Dry run execution without actually running tests
npx jest --testPathPattern=edge-cases --passWithNoTests --listTests

# Expected Output: Test files listed without execution
# Success Criteria: Both edge-cases test files discovered
# Failure Indicators: Module resolution errors, import failures
```

#### 2.2 Individual Test File Execution
```bash
# Test 4a: Execute root-level edge-cases test
npx jest tests/edge-cases/transaction-edge-cases.test.ts --no-coverage --maxWorkers=1

# Test 4b: Execute CLI app-level edge-cases test  
npx jest apps/cli/src/__tests__/edge-cases/transaction-edge-cases.test.ts --no-coverage --maxWorkers=1

# Expected Output: Test execution results with pass/fail status
# Success Criteria: Tests execute without module/import errors
# Failure Indicators: Module not found, import errors, Jest configuration errors
```

#### 2.3 Pattern-Based Execution
```bash
# Test 5: Execute all edge-cases tests via pattern
npx jest --testPathPattern=edge-cases --maxWorkers=2 --no-coverage

# Expected Output: Both test files execute
# Success Criteria: Test discovery and execution of all edge-cases tests
# Failure Indicators: Only one test file runs, pattern matching issues
```

### 3. Coverage Validation Phase

#### 3.1 Coverage Integration Test
```bash
# Test 6: Verify coverage collection works with edge-cases
npx jest --testPathPattern=edge-cases --coverage --maxWorkers=2

# Expected Output: Coverage report including edge-cases test execution
# Success Criteria: Coverage data collected, no coverage collection errors
# Failure Indicators: Coverage collection failures, empty coverage reports
```

#### 3.2 Coverage Path Inclusion
```bash
# Test 7: Verify collectCoverageFrom patterns include relevant source files
npx jest --testPathPattern=edge-cases --coverage --collectCoverageFrom="apps/cli/src/**/*.ts"

# Expected Output: Coverage for CLI source files used by edge-cases tests
# Success Criteria: Non-zero coverage data for tested modules
# Failure Indicators: Zero coverage, exclusion warnings
```

### 4. Integration Validation Phase

#### 4.1 Multi-Type Test Execution
```bash
# Test 8: Verify edge-cases tests don't conflict with other test types
npx jest --testPathPattern="unit|integration|edge-cases" --coverage --maxWorkers=2

# Expected Output: All test types execute without conflicts
# Success Criteria: Unit, integration, and edge-cases tests all run
# Failure Indicators: Test type conflicts, resource conflicts, timing issues
```

#### 4.2 Full Test Suite Validation
```bash
# Test 9: Full test suite including edge-cases
npm run test -- --testPathPattern="edge-cases" --coverage

# Expected Output: Edge-cases tests run via npm script
# Success Criteria: npm script properly passes arguments to Jest
# Failure Indicators: Argument parsing errors, script execution failures
```

## Fallback Strategies

### Strategy 1: Direct Jest Execution
If npm scripts fail:
```bash
# Fallback 1a: Direct Jest binary
./node_modules/.bin/jest --testPathPattern=edge-cases --no-coverage

# Fallback 1b: NPX with explicit options
npx --node-options='--max-old-space-size=2048' jest --testPathPattern=edge-cases
```

### Strategy 2: Individual File Targeting
If pattern matching fails:
```bash
# Fallback 2a: Explicit file paths
npx jest "tests/edge-cases/transaction-edge-cases.test.ts" "apps/cli/src/__tests__/edge-cases/transaction-edge-cases.test.ts"

# Fallback 2b: Sequential execution
npx jest tests/edge-cases/transaction-edge-cases.test.ts
npx jest apps/cli/src/__tests__/edge-cases/transaction-edge-cases.test.ts
```

### Strategy 3: Jest Project Isolation
If conflicts arise:
```bash
# Fallback 3: Run edge-cases in isolated Jest project
npx jest --selectProjects=edge-cases --testPathPattern=edge-cases
```

## Success Criteria Definitions

### Phase 1 Success (Configuration)
- [ ] Jest discovers both edge-cases test files
- [ ] Pattern matching works without errors
- [ ] No Jest configuration warnings/errors

### Phase 2 Success (Execution)
- [ ] Both edge-cases test files execute individually
- [ ] Pattern-based execution includes both test files
- [ ] No module resolution or import errors
- [ ] Test assertions execute (pass or fail)

### Phase 3 Success (Coverage)
- [ ] Coverage collection works with edge-cases tests
- [ ] Coverage reports include relevant source files
- [ ] No coverage collection errors or warnings

### Phase 4 Success (Integration)
- [ ] Edge-cases tests run alongside other test types
- [ ] No resource conflicts or timing issues
- [ ] npm test scripts work with edge-cases patterns

## Validation Execution Sequence

### Sequential Validation Steps
1. **Configuration Check** → Verify Jest can discover edge-cases tests
2. **Execution Check** → Verify edge-cases tests can run individually
3. **Pattern Check** → Verify pattern-based execution works
4. **Coverage Check** → Verify coverage integration works
5. **Integration Check** → Verify compatibility with full test suite

### Parallel Validation (if sequential succeeds)
```bash
# Run multiple validation checks simultaneously
npx jest --testPathPattern=edge-cases --coverage &
npx jest --listTests --testPathPattern=edge-cases &
wait
```

## Expected Validation Outputs

### Successful Validation Output
```
✓ Configuration: 2 edge-cases test files discovered
✓ Execution: Individual test files run successfully
✓ Pattern Matching: Pattern-based execution finds both files
✓ Coverage: Coverage collection works without errors
✓ Integration: Edge-cases tests compatible with full suite
```

### Failure Detection Patterns
- "No tests found" → Pattern matching failure
- "Cannot resolve module" → Import/module resolution failure
- "Jest configuration error" → Configuration syntax error
- "Coverage collection failed" → Coverage integration failure
- "Resource exhaustion" → Memory/resource conflict

## Post-Validation Actions

### On Validation Success
1. Update Jest configuration with edge-cases patterns
2. Add edge-cases to npm test scripts
3. Document edge-cases test execution procedures
4. Mark validation strategy as complete

### On Validation Failure
1. Analyze specific failure points from validation logs
2. Apply appropriate fallback strategy
3. Iterate on Jest configuration fixes
4. Re-run validation sequence

## Validation Checklist

### Pre-Validation Setup
- [ ] Backup current Jest configuration
- [ ] Ensure all dependencies installed
- [ ] Clear Jest cache: `npx jest --clearCache`
- [ ] Verify test files exist and are syntactically valid

### Validation Execution
- [ ] Phase 1: Configuration validation completed
- [ ] Phase 2: Execution validation completed  
- [ ] Phase 3: Coverage validation completed
- [ ] Phase 4: Integration validation completed

### Post-Validation Verification
- [ ] All success criteria met
- [ ] No regression in existing test functionality
- [ ] Edge-cases tests discoverable and executable
- [ ] Documentation updated with validation results

## Memory and Performance Considerations

### Memory Management During Validation
- Use `--maxWorkers=1` for initial validation to avoid memory pressure
- Monitor heap usage during edge-cases test execution
- Apply memory limits: `--node-options='--max-old-space-size=2048'`

### Performance Benchmarks
- Configuration validation: < 5 seconds
- Individual test execution: < 30 seconds per file
- Pattern-based execution: < 60 seconds total
- Coverage collection: < 90 seconds total

## Validation Report Template

```
Edge-Cases Test Validation Report
================================

Validation Date: [DATE]
Jest Version: [VERSION]
Node Version: [VERSION]

Phase 1 - Configuration Validation:
- Test Discovery: [PASS/FAIL]
- Pattern Matching: [PASS/FAIL] 
- Configuration Syntax: [PASS/FAIL]

Phase 2 - Execution Validation:
- Individual File Execution: [PASS/FAIL]
- Pattern-Based Execution: [PASS/FAIL]
- Module Resolution: [PASS/FAIL]

Phase 3 - Coverage Validation:
- Coverage Collection: [PASS/FAIL]
- Coverage Path Inclusion: [PASS/FAIL]
- Coverage Report Generation: [PASS/FAIL]

Phase 4 - Integration Validation:
- Multi-Type Execution: [PASS/FAIL]
- Full Suite Compatibility: [PASS/FAIL]
- NPM Script Integration: [PASS/FAIL]

Overall Result: [PASS/FAIL]
Issues Identified: [LIST]
Fallback Strategies Used: [LIST]
Recommendations: [LIST]
```

This comprehensive validation strategy ensures edge-cases tests are properly integrated and functional within the Jest testing framework.