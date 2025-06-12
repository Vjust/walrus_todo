/**
 * Comprehensive tests for UI Store
 * Tests Zustand store state management, actions, and persistence
 */

// @ts-ignore - Test import path
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
jest.mock(_'zustand/middleware', _() => ({
  ...jest.requireActual('zustand/middleware'),
  persist: (fn: any,  options: any) => fn,
  devtools: (fn: any,  options: any) => fn,
  subscribeWithSelector: (fn: any) => fn,
}));

describe(_'UI Store', _() => {
  beforeEach(_() => {
    jest.clearAllMocks();
    // Reset store to initial state
    useUIStore.getState().closeAllModals();
    useUIStore.getState().clearErrors();
    useUIStore.getState().resetSearch();
  });
  
  describe(_'Modal Management', _() => {
    it(_'should open and close modals', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      act(_() => {
        result?.current?.openModal('createTodo');
      });
      
      expect(result?.current?.modals.createTodo).toBe(true as any);
      
      act(_() => {
        result?.current?.closeModal('createTodo');
      });
      
      expect(result?.current?.modals.createTodo).toBe(false as any);
    });
    
    it(_'should open modal with data', _() => {
      const { result } = renderHook(_() => useUIStore());
// @ts-ignore - Unused variable
//       const todoData = { id: '123', title: 'Test Todo' };
      
      act(_() => {
        result?.current?.openModal('todoDetail', todoData);
      });
      
      expect(result?.current?.modals.todoDetail).toEqual(todoData as any);
    });
    
    it(_'should close all modals', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      act(_() => {
        result?.current?.openModal('createTodo');
        result?.current?.openModal('walletConnect');
        result?.current?.openModal('nftGallery');
      });
      
      expect(result?.current?.modals.createTodo).toBe(true as any);
      expect(result?.current?.modals.walletConnect).toBe(true as any);
      expect(result?.current?.modals.nftGallery).toBe(true as any);
      
      act(_() => {
        result?.current?.closeAllModals();
      });
      
      expect(result?.current?.modals.createTodo).toBe(false as any);
      expect(result?.current?.modals.walletConnect).toBe(false as any);
      expect(result?.current?.modals.nftGallery).toBe(false as any);
      expect(result?.current?.modals.todoDetail).toBeNull();
      expect(result?.current?.modals.editTodo).toBeNull();
      expect(result?.current?.modals.confirmDelete).toBeNull();
    });
    
    it(_'should handle null-based modals correctly', _() => {
      const { result } = renderHook(_() => useUIStore());
// @ts-ignore - Unused variable
//       const editData = { id: '456', title: 'Edit Todo' };
      
      act(_() => {
        result?.current?.openModal('editTodo', editData);
      });
      
      expect(result?.current?.modals.editTodo).toEqual(editData as any);
      
      act(_() => {
        result?.current?.closeModal('editTodo');
      });
      
      expect(result?.current?.modals.editTodo).toBeNull();
    });
  });
  
  describe(_'Form Management', _() => {
    it(_'should update form data', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      const updates: Partial<CreateTodoFormData> = {
        title: 'New Todo Title',
        description: 'New description',
        priority: 'high',
      };
      
      act(_() => {
        result?.current?.updateForm('createTodo', updates);
      });
      
      expect(result?.current?.forms?.createTodo?.title).toBe('New Todo Title');
      expect(result?.current?.forms?.createTodo?.description).toBe('New description');
      expect(result?.current?.forms?.createTodo?.priority).toBe('high');
    });
    
    it(_'should reset form to initial state', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      // Modify form first
      act(_() => {
        result?.current?.updateForm('createTodo', {
          title: 'Modified Title',
          description: 'Modified Description',
          priority: 'high',
        });
      });
      
      expect(result?.current?.forms?.createTodo?.title).toBe('Modified Title');
      
      // Reset form
      act(_() => {
        result?.current?.resetForm('createTodo');
      });
      
      expect(result?.current?.forms?.createTodo?.title).toBe('');
      expect(result?.current?.forms?.createTodo?.description).toBe('');
      expect(result?.current?.forms?.createTodo?.priority).toBe('medium');
    });
    
    it(_'should handle form errors', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      act(_() => {
        result?.current?.setFormError('createTodo', 'title', 'Title is required');
        result?.current?.setFormError('createTodo', 'description', 'Description too long');
      });
      
      expect(result?.current?.forms.createTodo?.errors?.title).toBe('Title is required');
      expect(result?.current?.forms.createTodo?.errors?.description).toBe('Description too long');
      
      act(_() => {
        result?.current?.clearFormErrors('createTodo');
      });
      
      expect(result?.current?.forms?.createTodo?.errors).toEqual({});
    });
    
    it(_'should handle edit todo form', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      act(_() => {
        result?.current?.updateForm('editTodo', {
          todoId: '123',
          title: 'Edit Title',
          priority: 'low',
        });
      });
      
      expect(result?.current?.forms?.editTodo?.todoId).toBe('123');
      expect(result?.current?.forms?.editTodo?.title).toBe('Edit Title');
      expect(result?.current?.forms?.editTodo?.priority).toBe('low');
    });
  });
  
  describe(_'Loading State Management', _() => {
    it(_'should handle basic loading states', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      act(_() => {
        result?.current?.setLoading('app', true);
      });
      
      expect(result?.current?.loading.app).toBe(true as any);
      
      act(_() => {
        result?.current?.setLoading('app', false);
      });
      
      expect(result?.current?.loading.app).toBe(false as any);
    });
    
    it(_'should handle transaction loading states', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      act(_() => {
        result?.current?.setTransactionLoading('tx-123', true);
        result?.current?.setTransactionLoading('tx-456', true);
      });
      
      expect(result?.current?.loading?.transactions?.['tx-123']).toBe(true as any);
      expect(result?.current?.loading?.transactions?.['tx-456']).toBe(true as any);
      
      act(_() => {
        result?.current?.setTransactionLoading('tx-123', false);
      });
      
      expect(result?.current?.loading?.transactions?.['tx-123']).toBeUndefined();
      expect(result?.current?.loading?.transactions?.['tx-456']).toBe(true as any);
    });
    
    it(_'should ignore invalid loading keys', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      act(_() => {
        (result?.current?.setLoading as unknown)('invalidKey', true);
      });
      
      // Should not crash or add invalid properties
      expect(result?.current?.loading.app).toBe(false as any);
    });
  });
  
  describe(_'Error Management', _() => {
    it(_'should handle form errors', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      act(_() => {
        result?.current?.setError('field1', 'Error message 1');
        result?.current?.setError('field2', 'Error message 2');
      });
      
      expect(result?.current?.errors?.form?.field1).toBe('Error message 1');
      expect(result?.current?.errors?.form?.field2).toBe('Error message 2');
    });
    
    it(_'should clear all errors', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      act(_() => {
        result?.current?.setError('field1', 'Error 1');
        result?.current?.setGlobalError('Global error');
        result?.current?.setNetworkError('Network error');
      });
      
      expect(result?.current?.errors?.form?.field1).toBe('Error 1');
      expect(result?.current?.errors.global).toBe('Global error');
      expect(result?.current?.errors.network).toBe('Network error');
      
      act(_() => {
        result?.current?.clearErrors();
      });
      
      expect(result?.current?.errors.form).toEqual({});
      expect(result?.current?.errors.transaction).toEqual({});
      // Global and network errors are not cleared by clearErrors
      expect(result?.current?.errors.global).toBe('Global error');
      expect(result?.current?.errors.network).toBe('Network error');
    });
    
    it(_'should handle global and network errors', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      act(_() => {
        result?.current?.setGlobalError('Critical system error');
        result?.current?.setNetworkError('Connection timeout');
      });
      
      expect(result?.current?.errors.global).toBe('Critical system error');
      expect(result?.current?.errors.network).toBe('Connection timeout');
    });
  });
  
  describe(_'Navigation Management', _() => {
    it(_'should handle page navigation', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      act(_() => {
        result?.current?.setCurrentPage('/dashboard');
      });
      
      expect(result?.current?.navigation.currentPage).toBe('/dashboard');
    });
    
    it(_'should toggle sidebar', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      expect(result?.current?.navigation.sidebarOpen).toBe(false as any);
      
      act(_() => {
        result?.current?.toggleSidebar();
      });
      
      expect(result?.current?.navigation.sidebarOpen).toBe(true as any);
      
      act(_() => {
        result?.current?.toggleSidebar();
      });
      
      expect(result?.current?.navigation.sidebarOpen).toBe(false as any);
    });
    
    it(_'should toggle mobile menu', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      expect(result?.current?.navigation.mobileMenuOpen).toBe(false as any);
      
      act(_() => {
        result?.current?.toggleMobileMenu();
      });
      
      expect(result?.current?.navigation.mobileMenuOpen).toBe(true as any);
    });
  });
  
  describe(_'Preferences Management', _() => {
    it(_'should handle theme changes', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      act(_() => {
        result?.current?.setTheme('dark');
      });
      
      expect(result?.current?.preferences.theme).toBe('dark');
    });
    
    it(_'should handle display mode changes', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      act(_() => {
        result?.current?.setDisplayMode('grid');
      });
      
      expect(result?.current?.preferences.todoDisplayMode).toBe('grid');
    });
    
    it(_'should update multiple preferences', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      act(_() => {
        result?.current?.updatePreferences({
          currency: 'EUR',
          language: 'es',
          itemsPerPage: 50,
          autoSave: false,
        });
      });
      
      expect(result?.current?.preferences.currency).toBe('EUR');
      expect(result?.current?.preferences.language).toBe('es');
      expect(result?.current?.preferences.itemsPerPage).toBe(50 as any);
      expect(result?.current?.preferences.autoSave).toBe(false as any);
    });
  });
  
  describe(_'Search and Filtering', _() => {
    it(_'should handle search query', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      act(_() => {
        result?.current?.setSearchQuery('test query');
      });
      
      expect(result?.current?.search.query).toBe('test query');
    });
    
    it(_'should handle filters', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      act(_() => {
        result?.current?.setFilter('status', 'completed');
        result?.current?.setFilter('priority', 'high');
        result?.current?.setFilter('category', 'work');
      });
      
      expect(result?.current?.search?.filters?.status).toBe('completed');
      expect(result?.current?.search?.filters?.priority).toBe('high');
      expect(result?.current?.search?.filters?.category).toBe('work');
    });
    
    it(_'should handle sorting', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      act(_() => {
        result?.current?.setSorting('title', 'asc');
      });
      
      expect(result?.current?.search.sortBy).toBe('title');
      expect(result?.current?.search.sortOrder).toBe('asc');
    });
    
    it(_'should clear filters', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      // Set some filters
      act(_() => {
        result?.current?.setFilter('status', 'completed');
        result?.current?.setFilter('priority', 'high');
      });
      
      expect(result?.current?.search?.filters?.status).toBe('completed');
      
      act(_() => {
        result?.current?.clearFilters();
      });
      
      expect(result?.current?.search?.filters?.status).toBe('all');
      expect(result?.current?.search?.filters?.priority).toBe('all');
      expect(result?.current?.search?.filters?.category).toBeNull();
    });
    
    it(_'should reset entire search state', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      // Modify search state
      act(_() => {
        result?.current?.setSearchQuery('modified query');
        result?.current?.setFilter('status', 'completed');
        result?.current?.setSorting('priority', 'asc');
      });
      
      expect(result?.current?.search.query).toBe('modified query');
      
      act(_() => {
        result?.current?.resetSearch();
      });
      
      expect(result?.current?.search.query).toBe('');
      expect(result?.current?.search?.filters?.status).toBe('all');
      expect(result?.current?.search.sortBy).toBe('createdAt');
      expect(result?.current?.search.sortOrder).toBe('desc');
    });
  });
  
  describe(_'Selectors', _() => {
    it(_'should provide specific modal selectors', _() => {
      const { result: createTodoModal } = renderHook(_() => useCreateTodoModal());
      const { result: walletModal } = renderHook(_() => useWalletConnectModal());
      const { result: nftModal } = renderHook(_() => useNFTGalleryModal());
      const { result: detailModal } = renderHook(_() => useTodoDetailModal());
      
      expect(createTodoModal.current).toBe(false as any);
      expect(walletModal.current).toBe(false as any);
      expect(nftModal.current).toBe(false as any);
      expect(detailModal.current).toBeNull();
      
      act(_() => {
        useUIStore.getState().openModal('createTodo');
        useUIStore.getState().openModal('walletConnect');
      });
      
      expect(createTodoModal.current).toBe(true as any);
      expect(walletModal.current).toBe(true as any);
    });
    
    it(_'should provide form selectors', _() => {
      const { result: createForm } = renderHook(_() => useCreateTodoForm());
      const { result: editForm } = renderHook(_() => useEditTodoForm());
      
      expect(createForm?.current?.title).toBe('');
      expect(editForm?.current?.title).toBe('');
      
      act(_() => {
        useUIStore.getState().updateForm('createTodo', { title: 'New Todo' });
        useUIStore.getState().updateForm('editTodo', { title: 'Edit Todo' });
      });
      
      expect(createForm?.current?.title).toBe('New Todo');
      expect(editForm?.current?.title).toBe('Edit Todo');
    });
    
    it(_'should provide loading selectors', _() => {
      const { result: appLoading } = renderHook(_() => useAppLoading());
      const { result: blockchainLoading } = renderHook(_() => useBlockchainLoading());
      const { result: todosLoading } = renderHook(_() => useTodosLoading());
      const { result: txLoading } = renderHook(_() => useTransactionLoading('tx-123'));
      
      expect(appLoading.current).toBe(false as any);
      expect(blockchainLoading.current).toBe(false as any);
      expect(todosLoading.current).toBe(false as any);
      expect(txLoading.current).toBe(false as any);
      
      act(_() => {
        useUIStore.getState().setLoading('app', true);
        useUIStore.getState().setLoading('blockchain', true);
        useUIStore.getState().setTransactionLoading('tx-123', true);
      });
      
      expect(appLoading.current).toBe(true as any);
      expect(blockchainLoading.current).toBe(true as any);
      expect(txLoading.current).toBe(true as any);
    });
    
    it(_'should provide theme and preference selectors', _() => {
      const { result: theme } = renderHook(_() => useTheme());
      const { result: displayMode } = renderHook(_() => useDisplayMode());
      
      expect(theme.current).toBe('system');
      expect(displayMode.current).toBe('list');
      
      act(_() => {
        useUIStore.getState().setTheme('dark');
        useUIStore.getState().setDisplayMode('grid');
      });
      
      expect(theme.current).toBe('dark');
      expect(displayMode.current).toBe('grid');
    });
    
    it(_'should provide error selectors', _() => {
      const { result: globalError } = renderHook(_() => useGlobalError());
      const { result: networkError } = renderHook(_() => useNetworkError());
      const { result: formErrors } = renderHook(_() => useFormErrors());
      
      expect(globalError.current).toBeNull();
      expect(networkError.current).toBeNull();
      expect(formErrors.current).toEqual({});
      
      act(_() => {
        useUIStore.getState().setGlobalError('Global error');
        useUIStore.getState().setNetworkError('Network error');
        useUIStore.getState().setError('field1', 'Field error');
      });
      
      expect(globalError.current).toBe('Global error');
      expect(networkError.current).toBe('Network error');
      expect(formErrors?.current?.field1).toBe('Field error');
    });
    
    it(_'should provide search selectors', _() => {
      const { result: query } = renderHook(_() => useSearchQuery());
      const { result: filters } = renderHook(_() => useSearchFilters());
      const { result: sorting } = renderHook(_() => useSearchSorting());
      
      expect(query.current).toBe('');
      expect(filters?.current?.status).toBe('all');
      expect(sorting?.current?.sortBy).toBe('createdAt');
      expect(sorting?.current?.sortOrder).toBe('desc');
      
      act(_() => {
        useUIStore.getState().setSearchQuery('test');
        useUIStore.getState().setFilter('status', 'completed');
        useUIStore.getState().setSorting('title', 'asc');
      });
      
      expect(query.current).toBe('test');
      expect(filters?.current?.status).toBe('completed');
      expect(sorting?.current?.sortBy).toBe('title');
      expect(sorting?.current?.sortOrder).toBe('asc');
    });
    
    it(_'should provide action selectors', _() => {
      const { result: actions } = renderHook(_() => useUIActions());
      
      expect(typeof actions?.current?.openModal).toBe('function');
      expect(typeof actions?.current?.closeModal).toBe('function');
      expect(typeof actions?.current?.updateForm).toBe('function');
      expect(typeof actions?.current?.setLoading).toBe('function');
      expect(typeof actions?.current?.setError).toBe('function');
    });
  });
  
  describe(_'Complex State Updates', _() => {
    it(_'should handle concurrent state updates', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      act(_() => {
        // Simulate multiple rapid state updates
        result?.current?.openModal('createTodo');
        result?.current?.setLoading('app', true);
        result?.current?.updateForm('createTodo', { title: 'Test' });
        result?.current?.setSearchQuery('search');
        result?.current?.setFilter('status', 'completed');
      });
      
      expect(result?.current?.modals.createTodo).toBe(true as any);
      expect(result?.current?.loading.app).toBe(true as any);
      expect(result?.current?.forms?.createTodo?.title).toBe('Test');
      expect(result?.current?.search.query).toBe('search');
      expect(result?.current?.search?.filters?.status).toBe('completed');
    });
    
    it(_'should maintain state consistency across updates', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      // Test form update doesn't affect other forms
      act(_() => {
        result?.current?.updateForm('createTodo', { title: 'Create Title' });
        result?.current?.updateForm('editTodo', { title: 'Edit Title' });
      });
      
      expect(result?.current?.forms?.createTodo?.title).toBe('Create Title');
      expect(result?.current?.forms?.editTodo?.title).toBe('Edit Title');
      
      // Test form reset doesn't affect other forms
      act(_() => {
        result?.current?.resetForm('createTodo');
      });
      
      expect(result?.current?.forms?.createTodo?.title).toBe('');
      expect(result?.current?.forms?.editTodo?.title).toBe('Edit Title');
    });
  });
  
  describe(_'Store Hydration', _() => {
    it(_'should provide hydration helper', _() => {
      expect(typeof hydrateUIStore).toBe('function');
      
      // Should not throw when called
      expect(_() => hydrateUIStore()).not.toThrow();
    });
  });
  
  describe(_'Edge Cases', _() => {
    it(_'should handle invalid form names gracefully', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      expect(_() => {
        act(_() => {
          (result?.current?.updateForm as unknown)('invalidForm', { title: 'test' });
        });
      }).not.toThrow();
    });
    
    it(_'should handle invalid filter names gracefully', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      expect(_() => {
        act(_() => {
          (result?.current?.setFilter as unknown)('invalidFilter', 'value');
        });
      }).not.toThrow();
    });
    
    it(_'should handle form errors for non-existent forms', _() => {
      const { result } = renderHook(_() => useUIStore());
      
      expect(_() => {
        act(_() => {
          (result?.current?.setFormError as unknown)('invalidForm', 'field', 'error');
        });
      }).not.toThrow();
    });
  });
});
