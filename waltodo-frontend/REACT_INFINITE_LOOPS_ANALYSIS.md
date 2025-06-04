# React Infinite Loop Analysis - WalTodo Frontend

## Executive Summary

The WalTodo frontend has multiple "Maximum update depth exceeded" errors caused by React infinite loops. This analysis identifies the root causes and provides specific fixes ordered by priority.

## Critical Infinite Loop Sources

### 1. HIGH PRIORITY: HomeContent.tsx - Lines 72, 187-190

**Location**: `/src/components/HomeContent.tsx`
**Problem**: 
- Line 72: `useEffect` dependency `statsLoading` causes infinite re-renders
- Lines 187-190: Cost estimation effect creates new dependency on every render

```typescript
// PROBLEMATIC CODE
useEffect(() => {
  // statsLoading.execute creates new function reference on every render
}, [isReady, statsLoading]); // statsLoading changes every render

// PROBLEMATIC CODE  
React.useEffect(() => {
  const timer = setTimeout(updateCostEstimate, 500);
  return () => clearTimeout(timer);
}, [updateCostEstimate]); // updateCostEstimate recreated every render
```

**Root Cause**: `useLoadingStates` hook returns new object instances on every render, causing `statsLoading` to have a different reference each time.

**Fix**:
```typescript
// FIXED VERSION
const statsLoading = useLoadingStates('home-stats', { minLoadingTime: 500 });

// Memoize the execute function
const executeStatsLoading = useCallback(async (fn: () => Promise<void>) => {
  return statsLoading.execute(fn);
}, [statsLoading.execute]);

// Use memoized version in useEffect
useEffect(() => {
  if (!isReady) return;
  
  const loadStats = async () => {
    await executeStatsLoading(async () => {
      // ... stats loading logic
    });
  };
  
  loadStats();
  const interval = setInterval(loadStats, 30000);
  return () => clearInterval(interval);
}, [isReady, executeStatsLoading]); // Now stable

// Fix cost estimation effect
const updateCostEstimate = useCallback(async () => {
  // ... cost estimation logic
}, [connected, address, estimatedSize, setEstimatedCost]); // Add missing dependencies

useEffect(() => {
  const timer = setTimeout(updateCostEstimate, 500);
  return () => clearTimeout(timer);
}, [updateCostEstimate]);
```

### 2. HIGH PRIORITY: useLoadingStates.ts - Lines 94-98

**Location**: `/src/hooks/useLoadingStates.ts`
**Problem**: Global UI store integration creates circular dependencies

```typescript
// PROBLEMATIC CODE
useEffect(() => {
  if (key) {
    setGlobalLoading(key, state === 'loading');
  }
}, [key, state, setGlobalLoading]); // setGlobalLoading may trigger store updates
```

**Root Cause**: Store selector `setGlobalLoading` can cause re-renders that trigger this effect again.

**Fix**:
```typescript
// FIXED VERSION
const setGlobalLoadingRef = useRef(setGlobalLoading);
setGlobalLoadingRef.current = setGlobalLoading;

useEffect(() => {
  if (key) {
    setGlobalLoadingRef.current(key, state === 'loading');
  }
}, [key, state]); // Remove setGlobalLoading from dependencies
```

### 3. HIGH PRIORITY: useAsyncError.ts - Lines 396-398

**Location**: `/src/hooks/useAsyncError.ts`
**Problem**: Dependencies array causes infinite re-execution

```typescript
// PROBLEMATIC CODE
useEffect(() => {
  result.execute();
}, dependencies); // dependencies array triggers on every dependency change
```

**Root Cause**: The `dependencies` array often contains values that change on every render.

**Fix**:
```typescript
// FIXED VERSION
const dependenciesRef = useRef(dependencies);
const hasChangedDeps = useMemo(() => {
  return !dependenciesRef.current || 
    dependencies.length !== dependenciesRef.current.length ||
    dependencies.some((dep, i) => dep !== dependenciesRef.current![i]);
}, [dependencies]);

useEffect(() => {
  if (hasChangedDeps) {
    dependenciesRef.current = dependencies;
    result.execute();
  }
}, [hasChangedDeps, result.execute]);
```

### 4. MEDIUM PRIORITY: TodoNFTGrid.tsx - Lines 170-174, 242-247

**Location**: `/src/components/TodoNFTGrid.tsx`
**Problem**: Object creation in render and effect dependency issues

```typescript
// PROBLEMATIC CODE
const columns = useMemo(() => {
  if (viewMode === 'list') return 1;
  // window.innerWidth access in render
  return Math.floor((window.innerWidth - 64) / (CARD_WIDTH + GRID_GAP)) || 1;
}, [viewMode]); // Missing window size dependency

// PROBLEMATIC CODE
useEffect(() => {
  if (filteredAndSortedNFTs.length !== allNFTs.length) {
    const message = `Filtered to ${filteredAndSortedNFTs.length} of ${allNFTs.length} NFTs`;
    announceStatus(message);
  }
}, [filteredAndSortedNFTs.length, allNFTs.length, announceStatus]); // announceStatus changes
```

**Root Cause**: 
1. Window size access without proper dependency tracking
2. Function references change on every render

**Fix**:
```typescript
// FIXED VERSION
const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);

useEffect(() => {
  if (typeof window === 'undefined') return;
  
  const handleResize = () => setWindowWidth(window.innerWidth);
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);

const columns = useMemo(() => {
  if (viewMode === 'list') return 1;
  return Math.floor((windowWidth - 64) / (CARD_WIDTH + GRID_GAP)) || 1;
}, [viewMode, windowWidth]);

// Memoize announcement function
const announceStatusRef = useRef(announceStatus);
announceStatusRef.current = announceStatus;

useEffect(() => {
  if (filteredAndSortedNFTs.length !== allNFTs.length) {
    const message = `Filtered to ${filteredAndSortedNFTs.length} of ${allNFTs.length} NFTs`;
    announceStatusRef.current(message);
  }
}, [filteredAndSortedNFTs.length, allNFTs.length]);
```

### 5. MEDIUM PRIORITY: CreateTodoNFTForm.tsx - Lines 186-190

**Location**: `/src/components/CreateTodoNFTForm.tsx`
**Problem**: Cost estimation effect dependency chain

```typescript
// PROBLEMATIC CODE
const updateCostEstimate = useCallback(async () => {
  // ... logic
}, [connected, address, estimatedSize]); // estimatedSize changes frequently

React.useEffect(() => {
  const timer = setTimeout(updateCostEstimate, 500);
  return () => clearTimeout(timer);
}, [updateCostEstimate]);
```

**Root Cause**: `estimatedSize` recalculates on every form input change, causing `updateCostEstimate` to be recreated.

**Fix**:
```typescript
// FIXED VERSION
const debouncedEstimatedSize = useDebounce(estimatedSize, 300);

const updateCostEstimate = useCallback(async () => {
  // ... cost estimation logic
}, [connected, address, debouncedEstimatedSize, setEstimatedCost]);

useEffect(() => {
  const timer = setTimeout(updateCostEstimate, 500);
  return () => clearTimeout(timer);
}, [updateCostEstimate]);
```

### 6. MEDIUM PRIORITY: useSuiTodos.ts - Lines 1147, 1154

**Location**: `/src/hooks/useSuiTodos.ts`
**Problem**: Multiple effects with overlapping dependencies

```typescript
// PROBLEMATIC CODE
useEffect(() => {
  // refreshTodos and checkHealth can trigger each other
}, [isWalletReady, address, currentFilter, refreshTodos, checkHealth]);

useEffect(() => {
  if (address) {
    invalidateCache(); // Can trigger other effects
  }
}, [address, invalidateCache]);
```

**Root Cause**: Function dependencies create circular effect triggering.

**Fix**:
```typescript
// FIXED VERSION
const refreshTodosRef = useRef(refreshTodos);
const checkHealthRef = useRef(checkHealth);
const invalidateCacheRef = useRef(invalidateCache);

// Update refs on each render
refreshTodosRef.current = refreshTodos;
checkHealthRef.current = checkHealth;
invalidateCacheRef.current = invalidateCache;

useEffect(() => {
  if (!isWalletReady) return;
  
  let isMounted = true;
  
  const loadInitialTodos = async () => {
    if (!isMounted) return;
    
    await refreshTodosRef.current();
    if (isMounted) {
      await checkHealthRef.current();
    }
  };

  loadInitialTodos();
  
  return () => {
    isMounted = false;
  };
}, [isWalletReady, address, currentFilter]); // Remove function dependencies

useEffect(() => {
  if (address) {
    invalidateCacheRef.current();
  }
}, [address]); // Remove function dependency
```

## Store-Related Infinite Loops

### 7. LOW PRIORITY: Zustand Store Selectors

**Problem**: Store selectors creating new objects on every call

**Affected Files**: All components using `useUIStore`, `useWalletStore`

**Root Cause**: Components select entire objects instead of specific values:

```typescript
// PROBLEMATIC
const { setLoading, setError } = useUIActions(); // New object every time
```

**Fix**:
```typescript
// FIXED VERSION
const setLoading = useUIStore(state => state.setLoading);
const setError = useUIStore(state => state.setError);
```

## Object Creation in Render

### 8. LOW PRIORITY: Multiple Components

**Problem**: Creating objects/arrays in render without memoization

**Examples**:
- `TodoNFTGrid.tsx`: Filter objects created inline
- `CreateTodoNFTForm.tsx`: Template arrays, validation objects
- `HomeContent.tsx`: Quick actions array

**Fix Pattern**:
```typescript
// PROBLEMATIC
const config = { option1: true, option2: false }; // New object every render

// FIXED
const config = useMemo(() => ({ 
  option1: true, 
  option2: false 
}), []); // Memoized object
```

## Priority Fix Order

1. **CRITICAL**: Fix `useLoadingStates` hook store integration (affects all components using it)
2. **HIGH**: Fix HomeContent.tsx effects and dependencies
3. **HIGH**: Fix useAsyncError.ts dependencies array handling  
4. **MEDIUM**: Fix TodoNFTGrid window resize and announcement functions
5. **MEDIUM**: Fix CreateTodoNFTForm cost estimation debouncing
6. **MEDIUM**: Fix useSuiTodos circular effect dependencies
7. **LOW**: Optimize Zustand store selectors across components
8. **LOW**: Memoize object creation in render

## Testing Strategy

1. **React DevTools Profiler**: Use to identify components re-rendering excessively
2. **Console Warnings**: Monitor for "Maximum update depth exceeded" errors
3. **Performance Tests**: Measure render counts before/after fixes
4. **Memory Profiling**: Check for memory leaks from infinite renders

## Implementation Notes

- **Test each fix individually** to ensure it doesn't break functionality
- **Use React DevTools** to verify render counts decrease
- **Add ESLint rules** to prevent future infinite loop patterns:
  - `react-hooks/exhaustive-deps`
  - Custom rules for object creation in render
- **Consider useCallback/useMemo** patterns but don't over-optimize
- **Profile after each fix** to measure actual impact

The most critical fixes are in the `useLoadingStates` hook and `HomeContent` component, as these affect multiple parts of the application and are likely causing the most severe performance issues.