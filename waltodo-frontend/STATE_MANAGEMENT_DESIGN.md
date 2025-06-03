# WalTodo Frontend State Management Architecture Design

## Executive Summary

This document outlines a comprehensive state management architecture design for the WalTodo frontend, transitioning from scattered local state to a centralized, type-safe, and performant solution using Zustand with React Query for server state management.

## Current State Analysis

### Identified Pain Points

#### 1. **Scattered State Management**
- **HomeContent.tsx**: Local state for form data, stats, UI state (mounted, showCreateForm, isCreating)
- **TodoList.tsx**: Complex local state with 6+ useState hooks for todos, loading states, component lifecycle
- **CreateTodoForm.tsx**: 10+ useState hooks for form state and UI state
- **WalletContext.tsx**: Massive context with 20+ state variables mixing different concerns

#### 2. **State Duplication & Synchronization Issues**
- Todo data duplicated across local storage, blockchain cache, and component state
- Wallet state scattered between context and individual components
- Manual cache invalidation and synchronization logic
- No single source of truth for application state

#### 3. **Performance Concerns**
- Excessive re-renders due to large context objects
- No memoization strategy for expensive computations
- Cache management spread across multiple components
- Inefficient data fetching patterns

#### 4. **Type Safety Issues**
- Optional chaining everywhere due to uncertain state shapes
- Manual null checks and fallbacks throughout components
- Inconsistent error handling patterns

#### 5. **SSR/Hydration Complexity**
- Complex mounted state tracking in every component
- Manual hydration safety checks
- Inconsistent initialization patterns

## Proposed State Management Architecture

### Architecture Choice: Zustand + React Query

**Why Zustand:**
- Minimal boilerplate compared to Redux Toolkit
- Excellent TypeScript support
- Built-in SSR support
- Middleware ecosystem (persist, devtools)
- Easy to incrementally adopt

**Why React Query (TanStack Query):**
- Best-in-class server state management
- Built-in caching, synchronization, and background updates
- Optimistic updates support
- SSR/hydration support
- Perfect complement to Zustand for client state

### State Categories & Boundaries

#### 1. **Client State (Zustand Stores)**

##### A. **UI State Store**
```typescript
interface UIState {
  // Modal management
  modals: {
    createTodo: boolean;
    walletConnect: boolean;
    todoDetail: string | null;
    nftGallery: boolean;
  };
  
  // Loading states
  loading: {
    app: boolean;
    blockchain: boolean;
    transactions: Record<string, boolean>;
  };
  
  // Form state
  forms: {
    createTodo: CreateTodoFormState;
    editTodo: EditTodoFormState;
  };
  
  // Navigation & layout
  navigation: {
    currentPage: string;
    sidebarOpen: boolean;
    mobileMenuOpen: boolean;
  };
  
  // Theme & preferences
  preferences: {
    theme: 'light' | 'dark' | 'system';
    currency: string;
    language: string;
  };
  
  // Error handling
  errors: {
    global: string | null;
    form: Record<string, string>;
    transaction: Record<string, string>;
  };
}
```

##### B. **Wallet State Store**
```typescript
interface WalletState {
  // Connection state
  connection: {
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    address: string | null;
    network: NetworkType;
    chainId: string | null;
    name: string | null;
  };
  
  // Session management
  session: {
    lastActivity: number;
    expired: boolean;
    timeoutWarning: boolean;
  };
  
  // Transaction state
  transactions: {
    history: TransactionRecord[];
    pending: Record<string, TransactionRecord>;
  };
  
  // Capabilities
  capabilities: {
    signAndExecute: boolean;
    nftSupport: boolean;
    walrusSupport: boolean;
  };
}
```

##### C. **App State Store**
```typescript
interface AppState {
  // Initialization
  initialized: boolean;
  hydrated: boolean;
  
  // Network health
  network: {
    sui: {
      status: 'healthy' | 'degraded' | 'offline';
      latency: number;
    };
    walrus: {
      status: 'healthy' | 'degraded' | 'offline';
      latency: number;
    };
  };
  
  // Feature flags
  features: {
    aiEnabled: boolean;
    blockchainVerification: boolean;
    encryptedStorage: boolean;
  };
  
  // Cache management
  cache: {
    lastClearTime: number;
    size: number;
    maxSize: number;
  };
}
```

#### 2. **Server State (React Query)**

##### A. **Todo Queries**
```typescript
// Local todos
useLocalTodos(listName: string, walletAddress?: string)
useLocalTodo(todoId: string, walletAddress?: string)

// Blockchain todos
useBlockchainTodos(address: string, options?: QueryOptions)
useBlockchainTodo(objectId: string)

// Merged todos (local + blockchain)
useMergedTodos(listName: string, address?: string)

// NFT specific
useNFTMetadata(objectId: string)
useNFTImage(objectId: string)
```

##### B. **Wallet Queries**
```typescript
// Account data
useWalletBalance(address: string)
useWalletNFTs(address: string)
useTransactionHistory(address: string)

// Network queries
useNetworkStatus()
useSuiClient()
```

##### C. **Mutations**
```typescript
// Todo operations
useCreateTodo()
useUpdateTodo()
useCompleteTodo()
useDeleteTodo()

// Blockchain operations
useCreateNFT()
useTransferNFT()
useStoreOnBlockchain()
```

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)
**Goal**: Set up Zustand stores and React Query foundation

**Tasks**:
1. **Install and configure dependencies**
   ```bash
   npm install zustand @tanstack/react-query immer
   npm install -D @tanstack/react-query-devtools
   ```

2. **Create store structure**
   ```
   src/stores/
   ├── index.ts              # Store exports and types
   ├── ui-store.ts           # UI state management
   ├── wallet-store.ts       # Wallet state management
   ├── app-store.ts          # App-level state
   └── middleware/
       ├── persist.ts        # Persistence middleware
       ├── devtools.ts       # Development tools
       └── logger.ts         # Action logging
   ```

3. **Set up React Query**
   ```
   src/lib/queries/
   ├── index.ts              # Query client setup
   ├── todo-queries.ts       # Todo-related queries
   ├── wallet-queries.ts     # Wallet-related queries
   └── mutations/
       ├── todo-mutations.ts
       └── wallet-mutations.ts
   ```

4. **Create provider setup**
   ```typescript
   // src/providers/StateProvider.tsx
   export function StateProvider({ children }: { children: ReactNode }) {
     return (
       <QueryClientProvider client={queryClient}>
         <Hydrate state={pageProps?.dehydratedState}>
           {children}
         </Hydrate>
         <ReactQueryDevtools />
       </QueryClientProvider>
     );
   }
   ```

### Phase 2: UI State Migration (Week 2)
**Goal**: Migrate form state and UI state from components to Zustand

**Tasks**:
1. **Migrate HomeContent.tsx**
   - Move form state to UI store
   - Replace useState with store selectors
   - Implement optimistic updates

2. **Migrate CreateTodoForm.tsx**
   - Centralize form validation logic
   - Add form state persistence
   - Implement field-level error handling

3. **Update TodoList.tsx**
   - Remove component-level loading states
   - Use store selectors for UI state
   - Implement proper error boundaries

### Phase 3: Server State Integration (Week 3)
**Goal**: Replace manual data fetching with React Query

**Tasks**:
1. **Implement todo queries**
   ```typescript
   // Example query implementation
   export function useMergedTodos(listName: string, address?: string) {
     const localQuery = useLocalTodos(listName, address);
     const blockchainQuery = useBlockchainTodos(address, {
       enabled: !!address
     });
     
     return useQuery({
       queryKey: ['todos', 'merged', listName, address],
       queryFn: () => mergeTodos(localQuery.data, blockchainQuery.data),
       enabled: localQuery.isSuccess && (!address || blockchainQuery.isSuccess)
     });
   }
   ```

2. **Implement mutations with optimistic updates**
   ```typescript
   export function useCreateTodo() {
     const queryClient = useQueryClient();
     
     return useMutation({
       mutationFn: createTodoAPI,
       onMutate: async (newTodo) => {
         // Optimistic update
         await queryClient.cancelQueries(['todos']);
         const previousTodos = queryClient.getQueryData(['todos']);
         queryClient.setQueryData(['todos'], old => [...old, newTodo]);
         return { previousTodos };
       },
       onError: (err, newTodo, context) => {
         // Rollback on error
         queryClient.setQueryData(['todos'], context.previousTodos);
       },
       onSettled: () => {
         queryClient.invalidateQueries(['todos']);
       }
     });
   }
   ```

3. **Add background synchronization**
   - Implement automatic cache invalidation
   - Add periodic data refetching
   - Handle network reconnection

### Phase 4: Wallet Integration (Week 4)
**Goal**: Centralize wallet state and integrate with stores

**Tasks**:
1. **Migrate WalletContext to Zustand**
   - Split large context into focused stores
   - Implement session management
   - Add transaction tracking

2. **Add wallet persistence**
   ```typescript
   export const walletStore = create<WalletState>()(
     persist(
       (set, get) => ({
         // ... state and actions
       }),
       {
         name: 'wallet-storage',
         partialize: (state) => ({
           connection: pick(state.connection, ['address', 'network']),
           session: pick(state.session, ['lastActivity'])
         })
       }
     )
   );
   ```

3. **Implement automatic session management**
   - Session timeout handling
   - Activity tracking
   - Graceful disconnection

### Phase 5: Performance Optimization (Week 5)
**Goal**: Optimize renders and implement advanced caching

**Tasks**:
1. **Add selective subscriptions**
   ```typescript
   // Only subscribe to specific slice of state
   const showCreateForm = useUIStore(state => state.modals.createTodo);
   const toggleCreateForm = useUIStore(state => state.actions.toggleModal);
   ```

2. **Implement cache strategies**
   - Stale-while-revalidate for todos
   - Cache time optimization
   - Memory management

3. **Add performance monitoring**
   - Render tracking
   - Cache hit/miss metrics
   - Network request monitoring

## Type Safety Strategy

### Store Type Definitions
```typescript
// src/stores/types.ts
export interface StoreActions<T> {
  set: (partial: Partial<T> | ((state: T) => Partial<T>)) => void;
  get: () => T;
  reset: () => void;
}

export interface UIActions {
  // Modal actions
  openModal: (modal: keyof UIState['modals'], data?: any) => void;
  closeModal: (modal: keyof UIState['modals']) => void;
  
  // Form actions
  updateForm: <K extends keyof UIState['forms']>(
    form: K, 
    updates: Partial<UIState['forms'][K]>
  ) => void;
  resetForm: (form: keyof UIState['forms']) => void;
  
  // Error actions
  setError: (key: string, error: string | null) => void;
  clearErrors: () => void;
}
```

### Query Type Safety
```typescript
// Strongly typed query keys
export const todoKeys = {
  all: ['todos'] as const,
  lists: () => [...todoKeys.all, 'list'] as const,
  list: (listName: string, address?: string) => 
    [...todoKeys.lists(), listName, address] as const,
  details: () => [...todoKeys.all, 'detail'] as const,
  detail: (id: string) => [...todoKeys.details(), id] as const,
} as const;
```

## Performance Considerations

### Render Optimization
1. **Selective subscriptions**: Use shallow comparisons and specific selectors
2. **Memoization**: React.memo for expensive components
3. **Virtual scrolling**: For large todo lists and NFT galleries
4. **Code splitting**: Lazy load non-critical components

### Cache Management
1. **Smart invalidation**: Only invalidate affected queries
2. **Background updates**: Keep data fresh without blocking UI
3. **Garbage collection**: Automatic cleanup of unused cache entries
4. **Persistence**: Strategic state persistence to reduce loading times

### Network Optimization
1. **Request deduplication**: Automatic with React Query
2. **Optimistic updates**: For immediate UI feedback
3. **Retry strategies**: Exponential backoff for failed requests
4. **Parallel queries**: Fetch independent data simultaneously

## Migration Strategy

### Incremental Adoption
1. **Component-by-component**: Migrate one component at a time
2. **Coexistence**: New state management alongside existing patterns
3. **Progressive enhancement**: Add features without breaking existing functionality
4. **Gradual cleanup**: Remove old patterns after new ones are stable

### Testing Strategy
1. **Store testing**: Unit tests for store logic
2. **Query testing**: Mock queries for component tests
3. **Integration testing**: End-to-end state management flows
4. **Performance testing**: Render count and cache efficiency

## Expected Benefits

### Developer Experience
- **Reduced complexity**: Fewer useState hooks and manual state management
- **Better debugging**: Zustand devtools and React Query devtools
- **Type safety**: Compile-time error detection
- **Predictable patterns**: Consistent state management across components

### Performance Improvements
- **Fewer re-renders**: Selective subscriptions and memoization
- **Better caching**: Intelligent cache management with React Query
- **Optimistic updates**: Immediate UI feedback
- **Background sync**: Fresh data without loading states

### Maintainability
- **Centralized logic**: Single source of truth for each state domain
- **Reusable patterns**: Consistent query and mutation patterns
- **Easy testing**: Isolated, testable state logic
- **Clear boundaries**: Separation between client and server state

This architecture provides a solid foundation for scaling the WalTodo frontend while maintaining excellent developer experience and performance characteristics.