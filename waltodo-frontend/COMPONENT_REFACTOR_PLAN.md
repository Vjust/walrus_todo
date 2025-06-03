# Component Decomposition Plan

## Overview
This document outlines the decomposition strategy for three large React components in the WalTodo frontend that have grown beyond maintainable size and complexity.

## Components Analyzed

### 1. TodoNFTListView.tsx (925 lines)
### 2. CreateTodoNFTForm.tsx (747 lines)
### 3. todo-list.tsx (670 lines)

---

## 1. TodoNFTListView.tsx Decomposition

### Current Issues
- **925 lines** with multiple responsibilities
- Complex table configuration mixed with UI rendering
- Bulk operations and individual actions in same component
- Export functionality embedded within component
- Modal management spread throughout

### Proposed Structure

#### Core Component
**`TodoNFTListView.tsx`** (150-200 lines)
- Main orchestration component
- State management coordination
- Props interface and main render logic

#### Table Components
**`components/table/`**
- `NFTTable.tsx` - Core table rendering with react-table
- `NFTTableColumns.tsx` - Column definitions and configurations
- `NFTTableHeader.tsx` - Table header with sorting and filters
- `NFTTableRow.tsx` - Individual row rendering
- `NFTTableControls.tsx` - Pagination, search, column visibility

#### Action Components
**`components/actions/`**
- `BulkActions.tsx` - Bulk selection and operations
- `RowActions.tsx` - Individual row action buttons
- `ExportActions.tsx` - Export functionality (JSON/CSV)

#### Modal Components
**`components/modals/`**
- `TransferNFTModal.tsx` - NFT transfer modal
- `ExpandedRowContent.tsx` - Detailed view for expanded rows

#### Hook Extractions
**`hooks/`**
- `useNFTTableState.ts` - Table state management
- `useNFTBulkOperations.ts` - Bulk action logic
- `useNFTKeyboardNav.ts` - Keyboard navigation
- `useNFTExport.ts` - Export functionality

### Migration Strategy
1. Extract column definitions first (low risk)
2. Move modal components to separate files
3. Extract bulk operations logic
4. Separate table controls
5. Create custom hooks for state management

---

## 2. CreateTodoNFTForm.tsx Decomposition

### Current Issues
- **747 lines** handling multiple concerns
- Form state, validation, and submission mixed
- Image processing embedded within form
- Template system integrated into main component
- Complex cost estimation logic

### Proposed Structure

#### Core Component
**`CreateTodoNFTForm.tsx`** (200-250 lines)
- Main form orchestration
- Form submission workflow
- Error handling coordination

#### Form Sections
**`components/form/`**
- `TodoBasicFields.tsx` - Title, description, priority, category
- `TodoAdvancedOptions.tsx` - Privacy, expiration settings
- `TodoTemplateSelector.tsx` - Template selection and application
- `TodoFormActions.tsx` - Submit/cancel buttons with status

#### Media Components
**`components/media/`**
- `ImageUploader.tsx` - Image selection and preview
- `ImageProcessor.tsx` - Image compression and validation
- `ImagePreview.tsx` - Image preview with remove option

#### Utility Components
**`components/utility/`**
- `StorageCostEstimator.tsx` - Cost calculation and display
- `ProgressIndicator.tsx` - Upload progress visualization
- `FormValidation.tsx` - Client-side validation feedback

#### Hook Extractions
**`hooks/`**
- `useFormState.ts` - Form state management
- `useImageProcessing.ts` - Image upload and compression
- `useCostEstimation.ts` - Storage cost calculation
- `useTemplates.ts` - Template management
- `useTodoSubmission.ts` - Submission workflow

### Migration Strategy
1. Extract template system first (self-contained)
2. Move image processing to separate components
3. Extract cost estimation logic
4. Separate form sections into components
5. Create custom hooks for complex logic

---

## 3. todo-list.tsx Decomposition

### Current Issues
- **670 lines** with mixed responsibilities
- Blockchain and local storage logic intermingled
- Loading states scattered throughout
- Action handlers embedded in main component
- Complex todo merging logic

### Proposed Structure

#### Core Component
**`TodoList.tsx`** (150-200 lines)
- Main orchestration and data fetching
- State coordination between local and blockchain
- Render decision logic

#### Display Components
**`components/display/`**
- `TodoItem.tsx` - Individual todo rendering
- `TodoEmptyState.tsx` - Empty state with action prompts
- `TodoLoadingState.tsx` - Loading skeletons and spinners
- `TodoErrorState.tsx` - Error display and recovery options

#### Status Components
**`components/status/`**
- `ConnectionStatus.tsx` - Wallet and blockchain connection indicators
- `SyncStatus.tsx` - Data synchronization status
- `LoadingIndicators.tsx` - Various loading states

#### Action Components
**`components/actions/`**
- `TodoActions.tsx` - Edit, delete, store as NFT actions
- `QuickActions.tsx` - Quick create buttons in empty state

#### Hook Extractions
**`hooks/`**
- `useTodoData.ts` - Data fetching and merging logic
- `useTodoActions.ts` - Action handlers (complete, delete, etc.)
- `useBlockchainSync.ts` - Blockchain synchronization
- `useTodoMerging.ts` - Local/blockchain todo merging

### Migration Strategy
1. Extract empty and loading states first (visual components)
2. Move connection status to separate component
3. Extract todo actions into dedicated component
4. Create data management hooks
5. Separate blockchain sync logic

---

## Shared Components & Utilities

### New Shared Components
**`components/shared/`**
- `LoadingSkeleton.tsx` - Reusable skeleton for all loading states
- `ErrorDisplay.tsx` - Standardized error display
- `ConnectionIndicator.tsx` - Wallet/blockchain status
- `ActionButton.tsx` - Consistent action button styling
- `Modal.tsx` - Base modal component
- `ProgressBar.tsx` - Reusable progress indicator

### Utility Hooks
**`hooks/shared/`**
- `useComponentMount.ts` - SSR/hydration safety
- `useErrorHandling.ts` - Centralized error management
- `useToastNotifications.ts` - Toast notification logic
- `useWalletSafety.ts` - Wallet connection safety checks

---

## Implementation Plan

### Phase 1: Foundation (Week 1)
1. Create shared utility hooks and components
2. Extract loading/error/empty states
3. Set up new directory structure

### Phase 2: Form Decomposition (Week 2)
1. Decompose CreateTodoNFTForm
2. Extract image processing
3. Separate template system

### Phase 3: List Decomposition (Week 3)
1. Decompose todo-list.tsx
2. Extract action handlers
3. Separate blockchain sync logic

### Phase 4: Table Decomposition (Week 4)
1. Decompose TodoNFTListView
2. Extract table components
3. Separate bulk operations

### Phase 5: Integration & Testing (Week 5)
1. Integration testing
2. Performance optimization
3. Documentation updates

---

## Benefits Expected

### Maintainability
- Components under 200 lines each
- Single responsibility principle
- Easier to locate and fix bugs
- Improved code readability

### Reusability
- Shared components across the application
- Modular functionality
- Easier to add new features

### Testing
- Smaller components easier to test
- Isolated logic in custom hooks
- Better test coverage possible

### Performance
- Better code splitting opportunities
- Reduced bundle size per component
- Optimized re-rendering

### Developer Experience
- Faster development cycles
- Clearer component responsibilities
- Easier onboarding for new developers

---

## Risk Mitigation

### Backward Compatibility
- Maintain existing prop interfaces
- Gradual migration approach
- Comprehensive testing at each phase

### State Management
- Careful coordination of shared state
- Clear data flow documentation
- Proper prop drilling vs context usage

### Bundle Size
- Monitor bundle size during decomposition
- Implement proper code splitting
- Lazy load heavy components

### Testing Strategy
- Unit tests for extracted hooks
- Integration tests for component coordination
- E2E tests for complete workflows

---

## Success Metrics

### Code Quality
- Average component size < 200 lines
- Cyclomatic complexity reduction
- ESLint rule compliance

### Performance
- Bundle size reduction
- Faster component load times
- Improved Core Web Vitals

### Developer Velocity
- Reduced time to implement new features
- Faster bug resolution
- Improved code review efficiency

### User Experience
- Maintained functionality
- No regression in user flows
- Improved accessibility