/**
 * Comprehensive tests for UI Store
 * Tests Zustand store state management, actions, and persistence
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import {
  useUIStore,
  useUIModals,
  useUILoading,
  useUIErrors,
  useUINavigation,
  useUIPreferences,
  useUISearch,
  useUIForms,
  useCreateTodoModal,
  useWalletConnectModal,
  useNFTGalleryModal,
  useTodoDetailModal,
  useCreateTodoForm,
  useEditTodoForm,
  useUIActions,
  useTheme,
  useDisplayMode,
  useAppLoading,
  useBlockchainLoading,
  useTodosLoading,
  useTransactionLoading,
  useGlobalError,
  useNetworkError,
  useFormErrors,
  useSearchQuery,
  useSearchFilters,
  useSearchSorting,
  hydrateUIStore,
} from '@/stores/ui-store';
import type { UIState, CreateTodoFormData } from '@/stores/types';

// Mock localStorage for persistence testing
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock zustand persist middleware
jest.mock('zustand/middleware', () => ({
  ...jest.requireActual('zustand/middleware'),
  persist: (fn: any, options: any) => fn,
  devtools: (fn: any, options: any) => fn,
  subscribeWithSelector: (fn: any) => fn,
}));

describe('UI Store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store to initial state
    useUIStore.getState().closeAllModals();
    useUIStore.getState().clearErrors();
    useUIStore.getState().resetSearch();
  });
  
  describe('Modal Management', () => {
    it('should open and close modals', () => {
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        result.current.openModal('createTodo');
      });
      
      expect(result.current.modals.createTodo).toBe(true);
      
      act(() => {
        result.current.closeModal('createTodo');
      });
      
      expect(result.current.modals.createTodo).toBe(false);
    });
    
    it('should open modal with data', () => {
      const { result } = renderHook(() => useUIStore());
      const todoData = { id: '123', title: 'Test Todo' };
      
      act(() => {
        result.current.openModal('todoDetail', todoData);
      });
      
      expect(result.current.modals.todoDetail).toEqual(todoData);
    });
    
    it('should close all modals', () => {
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        result.current.openModal('createTodo');
        result.current.openModal('walletConnect');
        result.current.openModal('nftGallery');
      });
      
      expect(result.current.modals.createTodo).toBe(true);
      expect(result.current.modals.walletConnect).toBe(true);
      expect(result.current.modals.nftGallery).toBe(true);
      
      act(() => {
        result.current.closeAllModals();
      });
      
      expect(result.current.modals.createTodo).toBe(false);
      expect(result.current.modals.walletConnect).toBe(false);
      expect(result.current.modals.nftGallery).toBe(false);
      expect(result.current.modals.todoDetail).toBeNull();
      expect(result.current.modals.editTodo).toBeNull();
      expect(result.current.modals.confirmDelete).toBeNull();
    });
    
    it('should handle null-based modals correctly', () => {
      const { result } = renderHook(() => useUIStore());
      const editData = { id: '456', title: 'Edit Todo' };
      
      act(() => {
        result.current.openModal('editTodo', editData);
      });
      
      expect(result.current.modals.editTodo).toEqual(editData);
      
      act(() => {
        result.current.closeModal('editTodo');
      });
      
      expect(result.current.modals.editTodo).toBeNull();
    });
  });
  
  describe('Form Management', () => {
    it('should update form data', () => {
      const { result } = renderHook(() => useUIStore());
      
      const updates: Partial<CreateTodoFormData> = {
        title: 'New Todo Title',
        description: 'New description',
        priority: 'high',
      };
      
      act(() => {
        result.current.updateForm('createTodo', updates);
      });
      
      expect(result.current.forms.createTodo.title).toBe('New Todo Title');
      expect(result.current.forms.createTodo.description).toBe('New description');
      expect(result.current.forms.createTodo.priority).toBe('high');
    });
    
    it('should reset form to initial state', () => {
      const { result } = renderHook(() => useUIStore());
      
      // Modify form first
      act(() => {
        result.current.updateForm('createTodo', {
          title: 'Modified Title',
          description: 'Modified Description',
          priority: 'high',
        });
      });
      
      expect(result.current.forms.createTodo.title).toBe('Modified Title');
      
      // Reset form
      act(() => {
        result.current.resetForm('createTodo');
      });
      
      expect(result.current.forms.createTodo.title).toBe('');
      expect(result.current.forms.createTodo.description).toBe('');
      expect(result.current.forms.createTodo.priority).toBe('medium');
    });
    
    it('should handle form errors', () => {
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        result.current.setFormError('createTodo', 'title', 'Title is required');
        result.current.setFormError('createTodo', 'description', 'Description too long');
      });
      
      expect(result.current.forms.createTodo.errors.title).toBe('Title is required');
      expect(result.current.forms.createTodo.errors.description).toBe('Description too long');
      
      act(() => {
        result.current.clearFormErrors('createTodo');
      });
      
      expect(result.current.forms.createTodo.errors).toEqual({});
    });
    
    it('should handle edit todo form', () => {
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        result.current.updateForm('editTodo', {
          todoId: '123',
          title: 'Edit Title',
          priority: 'low',
        });
      });
      
      expect(result.current.forms.editTodo.todoId).toBe('123');
      expect(result.current.forms.editTodo.title).toBe('Edit Title');
      expect(result.current.forms.editTodo.priority).toBe('low');
    });
  });
  
  describe('Loading State Management', () => {
    it('should handle basic loading states', () => {
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        result.current.setLoading('app', true);
      });
      
      expect(result.current.loading.app).toBe(true);
      
      act(() => {
        result.current.setLoading('app', false);
      });
      
      expect(result.current.loading.app).toBe(false);
    });
    
    it('should handle transaction loading states', () => {
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        result.current.setTransactionLoading('tx-123', true);
        result.current.setTransactionLoading('tx-456', true);
      });
      
      expect(result.current.loading.transactions['tx-123']).toBe(true);
      expect(result.current.loading.transactions['tx-456']).toBe(true);
      
      act(() => {
        result.current.setTransactionLoading('tx-123', false);
      });
      
      expect(result.current.loading.transactions['tx-123']).toBeUndefined();
      expect(result.current.loading.transactions['tx-456']).toBe(true);
    });
    
    it('should ignore invalid loading keys', () => {
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        (result.current.setLoading as any)('invalidKey', true);
      });
      
      // Should not crash or add invalid properties
      expect(result.current.loading.app).toBe(false);
    });
  });
  
  describe('Error Management', () => {
    it('should handle form errors', () => {
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        result.current.setError('field1', 'Error message 1');
        result.current.setError('field2', 'Error message 2');
      });
      
      expect(result.current.errors.form.field1).toBe('Error message 1');
      expect(result.current.errors.form.field2).toBe('Error message 2');
    });
    
    it('should clear all errors', () => {
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        result.current.setError('field1', 'Error 1');
        result.current.setGlobalError('Global error');
        result.current.setNetworkError('Network error');
      });
      
      expect(result.current.errors.form.field1).toBe('Error 1');
      expect(result.current.errors.global).toBe('Global error');
      expect(result.current.errors.network).toBe('Network error');
      
      act(() => {
        result.current.clearErrors();
      });
      
      expect(result.current.errors.form).toEqual({});
      expect(result.current.errors.transaction).toEqual({});
      // Global and network errors are not cleared by clearErrors
      expect(result.current.errors.global).toBe('Global error');
      expect(result.current.errors.network).toBe('Network error');
    });
    
    it('should handle global and network errors', () => {
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        result.current.setGlobalError('Critical system error');
        result.current.setNetworkError('Connection timeout');
      });
      
      expect(result.current.errors.global).toBe('Critical system error');
      expect(result.current.errors.network).toBe('Connection timeout');
    });
  });
  
  describe('Navigation Management', () => {
    it('should handle page navigation', () => {
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        result.current.setCurrentPage('/dashboard');
      });
      
      expect(result.current.navigation.currentPage).toBe('/dashboard');
    });
    
    it('should toggle sidebar', () => {
      const { result } = renderHook(() => useUIStore());
      
      expect(result.current.navigation.sidebarOpen).toBe(false);
      
      act(() => {
        result.current.toggleSidebar();
      });
      
      expect(result.current.navigation.sidebarOpen).toBe(true);
      
      act(() => {
        result.current.toggleSidebar();
      });
      
      expect(result.current.navigation.sidebarOpen).toBe(false);
    });
    
    it('should toggle mobile menu', () => {
      const { result } = renderHook(() => useUIStore());
      
      expect(result.current.navigation.mobileMenuOpen).toBe(false);
      
      act(() => {
        result.current.toggleMobileMenu();
      });
      
      expect(result.current.navigation.mobileMenuOpen).toBe(true);
    });
  });
  
  describe('Preferences Management', () => {
    it('should handle theme changes', () => {
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        result.current.setTheme('dark');
      });
      
      expect(result.current.preferences.theme).toBe('dark');
    });
    
    it('should handle display mode changes', () => {
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        result.current.setDisplayMode('grid');
      });
      
      expect(result.current.preferences.todoDisplayMode).toBe('grid');
    });
    
    it('should update multiple preferences', () => {
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        result.current.updatePreferences({
          currency: 'EUR',
          language: 'es',
          itemsPerPage: 50,
          autoSave: false,
        });
      });
      
      expect(result.current.preferences.currency).toBe('EUR');
      expect(result.current.preferences.language).toBe('es');
      expect(result.current.preferences.itemsPerPage).toBe(50);
      expect(result.current.preferences.autoSave).toBe(false);
    });
  });
  
  describe('Search and Filtering', () => {
    it('should handle search query', () => {
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        result.current.setSearchQuery('test query');
      });
      
      expect(result.current.search.query).toBe('test query');
    });
    
    it('should handle filters', () => {
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        result.current.setFilter('status', 'completed');
        result.current.setFilter('priority', 'high');
        result.current.setFilter('category', 'work');
      });
      
      expect(result.current.search.filters.status).toBe('completed');
      expect(result.current.search.filters.priority).toBe('high');
      expect(result.current.search.filters.category).toBe('work');
    });
    
    it('should handle sorting', () => {
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        result.current.setSorting('title', 'asc');
      });
      
      expect(result.current.search.sortBy).toBe('title');
      expect(result.current.search.sortOrder).toBe('asc');
    });
    
    it('should clear filters', () => {
      const { result } = renderHook(() => useUIStore());
      
      // Set some filters
      act(() => {
        result.current.setFilter('status', 'completed');
        result.current.setFilter('priority', 'high');
      });
      
      expect(result.current.search.filters.status).toBe('completed');
      
      act(() => {
        result.current.clearFilters();
      });
      
      expect(result.current.search.filters.status).toBe('all');
      expect(result.current.search.filters.priority).toBe('all');
      expect(result.current.search.filters.category).toBeNull();
    });
    
    it('should reset entire search state', () => {
      const { result } = renderHook(() => useUIStore());
      
      // Modify search state
      act(() => {
        result.current.setSearchQuery('modified query');
        result.current.setFilter('status', 'completed');
        result.current.setSorting('priority', 'asc');
      });
      
      expect(result.current.search.query).toBe('modified query');
      
      act(() => {
        result.current.resetSearch();
      });
      
      expect(result.current.search.query).toBe('');
      expect(result.current.search.filters.status).toBe('all');
      expect(result.current.search.sortBy).toBe('createdAt');
      expect(result.current.search.sortOrder).toBe('desc');
    });
  });
  
  describe('Selectors', () => {
    it('should provide specific modal selectors', () => {
      const { result: createTodoModal } = renderHook(() => useCreateTodoModal());
      const { result: walletModal } = renderHook(() => useWalletConnectModal());
      const { result: nftModal } = renderHook(() => useNFTGalleryModal());
      const { result: detailModal } = renderHook(() => useTodoDetailModal());
      
      expect(createTodoModal.current).toBe(false);
      expect(walletModal.current).toBe(false);
      expect(nftModal.current).toBe(false);
      expect(detailModal.current).toBeNull();
      
      act(() => {
        useUIStore.getState().openModal('createTodo');
        useUIStore.getState().openModal('walletConnect');
      });
      
      expect(createTodoModal.current).toBe(true);
      expect(walletModal.current).toBe(true);
    });
    
    it('should provide form selectors', () => {
      const { result: createForm } = renderHook(() => useCreateTodoForm());
      const { result: editForm } = renderHook(() => useEditTodoForm());
      
      expect(createForm.current.title).toBe('');
      expect(editForm.current.title).toBe('');
      
      act(() => {
        useUIStore.getState().updateForm('createTodo', { title: 'New Todo' });
        useUIStore.getState().updateForm('editTodo', { title: 'Edit Todo' });
      });
      
      expect(createForm.current.title).toBe('New Todo');
      expect(editForm.current.title).toBe('Edit Todo');
    });
    
    it('should provide loading selectors', () => {
      const { result: appLoading } = renderHook(() => useAppLoading());
      const { result: blockchainLoading } = renderHook(() => useBlockchainLoading());
      const { result: todosLoading } = renderHook(() => useTodosLoading());
      const { result: txLoading } = renderHook(() => useTransactionLoading('tx-123'));
      
      expect(appLoading.current).toBe(false);
      expect(blockchainLoading.current).toBe(false);
      expect(todosLoading.current).toBe(false);
      expect(txLoading.current).toBe(false);
      
      act(() => {
        useUIStore.getState().setLoading('app', true);
        useUIStore.getState().setLoading('blockchain', true);
        useUIStore.getState().setTransactionLoading('tx-123', true);
      });
      
      expect(appLoading.current).toBe(true);
      expect(blockchainLoading.current).toBe(true);
      expect(txLoading.current).toBe(true);
    });
    
    it('should provide theme and preference selectors', () => {
      const { result: theme } = renderHook(() => useTheme());
      const { result: displayMode } = renderHook(() => useDisplayMode());
      
      expect(theme.current).toBe('system');
      expect(displayMode.current).toBe('list');
      
      act(() => {
        useUIStore.getState().setTheme('dark');
        useUIStore.getState().setDisplayMode('grid');
      });
      
      expect(theme.current).toBe('dark');
      expect(displayMode.current).toBe('grid');
    });
    
    it('should provide error selectors', () => {
      const { result: globalError } = renderHook(() => useGlobalError());
      const { result: networkError } = renderHook(() => useNetworkError());
      const { result: formErrors } = renderHook(() => useFormErrors());
      
      expect(globalError.current).toBeNull();
      expect(networkError.current).toBeNull();
      expect(formErrors.current).toEqual({});
      
      act(() => {
        useUIStore.getState().setGlobalError('Global error');
        useUIStore.getState().setNetworkError('Network error');
        useUIStore.getState().setError('field1', 'Field error');
      });
      
      expect(globalError.current).toBe('Global error');
      expect(networkError.current).toBe('Network error');
      expect(formErrors.current.field1).toBe('Field error');
    });
    
    it('should provide search selectors', () => {
      const { result: query } = renderHook(() => useSearchQuery());
      const { result: filters } = renderHook(() => useSearchFilters());
      const { result: sorting } = renderHook(() => useSearchSorting());
      
      expect(query.current).toBe('');
      expect(filters.current.status).toBe('all');
      expect(sorting.current.sortBy).toBe('createdAt');
      expect(sorting.current.sortOrder).toBe('desc');
      
      act(() => {
        useUIStore.getState().setSearchQuery('test');
        useUIStore.getState().setFilter('status', 'completed');
        useUIStore.getState().setSorting('title', 'asc');
      });
      
      expect(query.current).toBe('test');
      expect(filters.current.status).toBe('completed');
      expect(sorting.current.sortBy).toBe('title');
      expect(sorting.current.sortOrder).toBe('asc');
    });
    
    it('should provide action selectors', () => {
      const { result: actions } = renderHook(() => useUIActions());
      
      expect(typeof actions.current.openModal).toBe('function');
      expect(typeof actions.current.closeModal).toBe('function');
      expect(typeof actions.current.updateForm).toBe('function');
      expect(typeof actions.current.setLoading).toBe('function');
      expect(typeof actions.current.setError).toBe('function');
    });
  });
  
  describe('Complex State Updates', () => {
    it('should handle concurrent state updates', () => {
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        // Simulate multiple rapid state updates
        result.current.openModal('createTodo');
        result.current.setLoading('app', true);
        result.current.updateForm('createTodo', { title: 'Test' });
        result.current.setSearchQuery('search');
        result.current.setFilter('status', 'completed');
      });
      
      expect(result.current.modals.createTodo).toBe(true);
      expect(result.current.loading.app).toBe(true);
      expect(result.current.forms.createTodo.title).toBe('Test');
      expect(result.current.search.query).toBe('search');
      expect(result.current.search.filters.status).toBe('completed');
    });
    
    it('should maintain state consistency across updates', () => {
      const { result } = renderHook(() => useUIStore());
      
      // Test form update doesn't affect other forms
      act(() => {
        result.current.updateForm('createTodo', { title: 'Create Title' });
        result.current.updateForm('editTodo', { title: 'Edit Title' });
      });
      
      expect(result.current.forms.createTodo.title).toBe('Create Title');
      expect(result.current.forms.editTodo.title).toBe('Edit Title');
      
      // Test form reset doesn't affect other forms
      act(() => {
        result.current.resetForm('createTodo');
      });
      
      expect(result.current.forms.createTodo.title).toBe('');
      expect(result.current.forms.editTodo.title).toBe('Edit Title');
    });
  });
  
  describe('Store Hydration', () => {
    it('should provide hydration helper', () => {
      expect(typeof hydrateUIStore).toBe('function');
      
      // Should not throw when called
      expect(() => hydrateUIStore()).not.toThrow();
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle invalid form names gracefully', () => {
      const { result } = renderHook(() => useUIStore());
      
      expect(() => {
        act(() => {
          (result.current.updateForm as any)('invalidForm', { title: 'test' });
        });
      }).not.toThrow();
    });
    
    it('should handle invalid filter names gracefully', () => {
      const { result } = renderHook(() => useUIStore());
      
      expect(() => {
        act(() => {
          (result.current.setFilter as any)('invalidFilter', 'value');
        });
      }).not.toThrow();
    });
    
    it('should handle form errors for non-existent forms', () => {
      const { result } = renderHook(() => useUIStore());
      
      expect(() => {
        act(() => {
          (result.current.setFormError as any)('invalidForm', 'field', 'error');
        });
      }).not.toThrow();
    });
  });
});
