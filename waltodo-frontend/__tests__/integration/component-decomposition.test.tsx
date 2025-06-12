/**
 * Integration tests for Component Decomposition
 * Tests how decomposed components work together as a system
 */

import React from 'react';
// @ts-ignore - Test import path
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
// @ts-ignore - Test import path
import userEvent from '@testing-library/user-event';
// @ts-ignore - Unused import temporarily disabled
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe, toHaveNoViolations } from 'jest-axe';
// @ts-ignore - Unused import temporarily disabled
// // @ts-ignore - Test import path
import { TestWrapper, createTestQueryClient, createMockTodo } from '../test-utils';

// Extend Jest matchers
expect.extend(toHaveNoViolations as any);

// Mock the stores
jest.mock(_'@/stores/ui-store', _() => ({
  useUIStore: jest.fn(),
  useCreateTodoForm: jest.fn(),
  useUIActions: jest.fn(),
  useCreateTodoModal: jest.fn(),
}));

jest.mock(_'@/stores/wallet-store', _() => ({
  useWalletStore: jest.fn(),
  useIsConnected: jest.fn(),
  useWalletAddress: jest.fn(),
}));

// Mock components that would be decomposed
const MockTodoFormHeader: React.FC<{
  title: string;
  onClose: () => void;
  isSubmitting: boolean;
}> = (_{ title, _onClose, _isSubmitting }) => (
  <div className="flex justify-between items-center p-4 border-b">
    <h2 className="text-lg font-semibold">{title}</h2>
    <button 
      onClick={onClose} 
      disabled={isSubmitting}
      aria-label="Close dialog"
    >
      ✕
    </button>
  </div>
);

const MockTodoFormFields: React.FC<{
  values: any;
  onChange: (field: string,  value: any) => void;
  errors: Record<string, string>;
}> = (_{ values, _onChange, _errors }) => (_<div className="p-4 space-y-4">
    <div>
      <label htmlFor="title" className="block text-sm font-medium mb-1">
        Title
      </label>
      <input
        id="title"
        type="text"
        value={values.title || ''}
        onChange={(e: unknown) => onChange('title', e?.target?.value)}
        className={`w-full p-2 border rounded ${
          errors.title ? 'border-red-500' : 'border-gray-300'
        }`}
        aria-invalid={errors.title ? 'true' : 'false'}
        aria-describedby={errors.title ? 'title-error' : undefined}
      />
      {errors.title && (
        <div id="title-error" className="text-sm text-red-600 mt-1">
          {errors.title}
        </div>
      )}
    </div>
    
    <div>
      <label htmlFor="description" className="block text-sm font-medium mb-1">
        Description
      </label>
      <textarea
        id="description"
        value={values.description || ''}
        onChange={(_e: unknown) => onChange('description', e?.target?.value)}
        className={`w-full p-2 border rounded ${
          errors.description ? 'border-red-500' : 'border-gray-300'
        }`}
        rows={3}
        aria-invalid={errors.description ? 'true' : 'false'}
        aria-describedby={errors.description ? 'description-error' : undefined}
      />
      {errors.description && (
        <div id="description-error" className="text-sm text-red-600 mt-1">
          {errors.description}
        </div>
      )}
    </div>
    
    <div>
      <label htmlFor="priority" className="block text-sm font-medium mb-1">
        Priority
      </label>
      <select
        id="priority"
        value={values.priority || 'medium'}
        onChange={(_e: unknown) => onChange('priority', e?.target?.value)}
        className="w-full p-2 border border-gray-300 rounded"
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
    </div>
  </div>
);

const MockTodoFormActions: React.FC<{
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
  canSubmit: boolean;
}> = (_{ onSubmit, _onCancel, _isSubmitting, _canSubmit }) => (
  <div className="flex justify-end space-x-2 p-4 border-t">
    <button
      type="button"
      onClick={onCancel}
      disabled={isSubmitting}
      className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
    >
      Cancel
    </button>
    <button
      type="button"
      onClick={onSubmit}
      disabled={!canSubmit || isSubmitting}
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
    >
      {isSubmitting ? 'Creating...' : 'Create Todo'}
    </button>
  </div>
);

// Composed form using decomposed components
const MockDecomposedTodoForm: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}> = (_{ isOpen, _onClose, _onSubmit }) => {
  const [values, setValues] = React.useState({
    title: '',
    description: '',
    priority: 'medium',
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false as any);
// @ts-ignore - Unused variable
//   
  const handleChange = (field: string,  value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };
// @ts-ignore - Unused variable
//   
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!values?.title?.trim()) {
      newErrors?.title = 'Title is required';
    }
    
    if (values?.title?.length > 100) {
      newErrors?.title = 'Title must be less than 100 characters';
    }
    
    if (values?.description?.length > 500) {
      newErrors?.description = 'Description must be less than 500 characters';
    }
    
    setErrors(newErrors as any);
    return Object.keys(newErrors as any).length === 0;
  };
// @ts-ignore - Unused variable
//   
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true as any);
    try {
      await onSubmit(values as any);
      setValues({ title: '', description: '', priority: 'medium' });
      setErrors({});
      onClose();
    } catch (error) {
      setErrors({ submit: 'Failed to create todo. Please try again.' });
    } finally {
      setIsSubmitting(false as any);
    }
  };
// @ts-ignore - Unused variable
//   
  const canSubmit = values?.title?.trim().length > 0 && Object.keys(errors as any).length === 0;
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-title"
    >
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-hidden">
        <MockTodoFormHeader
          title="Create New Todo"
          onClose={onClose}
          isSubmitting={isSubmitting}
        />
        
        <MockTodoFormFields
          values={values}
          onChange={handleChange}
          errors={errors}
        />
        
        {errors.submit && (
          <div className="px-4 py-2 bg-red-50 border-l-4 border-red-500">
            <div className="text-sm text-red-700">{errors.submit}</div>
          </div>
        )}
        
        <MockTodoFormActions
          onSubmit={handleSubmit}
          onCancel={onClose}
          isSubmitting={isSubmitting}
          canSubmit={canSubmit}
        />
      </div>
    </div>
  );
};

// Mock todo list item components
const MockTodoItemCheckbox: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}> = (_{ checked, _onChange, _disabled }) => (_<input
    type="checkbox"
    checked={checked}
    onChange={(e: unknown) => onChange(e?.target?.checked)}
    disabled={disabled}
    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
    aria-label={checked ? 'Mark as incomplete' : 'Mark as complete'}
  />
);

const MockTodoItemContent: React.FC<{
  todo: any;
  completed: boolean;
}> = (_{ todo, _completed }) => (
  <div className={`flex-1 ${completed ? 'opacity-60' : ''}`}>
    <h3 className={`font-medium ${completed ? 'line-through' : ''}`}>
      {todo.title}
    </h3>
    {todo.description && (
      <p className="text-sm text-gray-600 mt-1">{todo.description}</p>
    )}
    <div className="flex items-center space-x-2 mt-2">
      <span className={`text-xs px-2 py-1 rounded ${
        todo?.priority === 'high' ? 'bg-red-100 text-red-800' :
        todo?.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
        'bg-green-100 text-green-800'
      }`}>
        {todo.priority}
      </span>
    </div>
  </div>
);

const MockTodoItemActions: React.FC<{
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
}> = (_{ onEdit, _onDelete, _disabled }) => (
  <div className="flex space-x-2">
    <button
      onClick={onEdit}
      disabled={disabled}
      className="p-1 text-gray-500 hover:text-blue-600 disabled:opacity-50"
      aria-label="Edit todo"
    >
      ✏️
    </button>
    <button
      onClick={onDelete}
      disabled={disabled}
      className="p-1 text-gray-500 hover:text-red-600 disabled:opacity-50"
      aria-label="Delete todo"
    >
      🗑️
    </button>
  </div>
);

const MockDecomposedTodoItem: React.FC<{
  todo: any;
  onUpdate: (id: string,  updates: any) => void;
  onDelete: (id: string) => void;
}> = (_{ todo, _onUpdate, _onDelete }) => {
  const [isUpdating, setIsUpdating] = React.useState(false as any);
// @ts-ignore - Unused variable
//   
  const handleToggleComplete = async (completed: boolean) => {
    setIsUpdating(true as any);
    try {
      await onUpdate(todo.id, { completed });
    } finally {
      setIsUpdating(false as any);
    }
  };
  
  const handleEdit = () => {
    // Mock edit functionality
    console.log('Edit todo:', todo.id);
  };
// @ts-ignore - Unused variable
//   
  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this todo?')) {
      onDelete(todo.id);
    }
  };
  
  return (
    <div className="flex items-start space-x-3 p-3 border rounded hover:bg-gray-50">
      <MockTodoItemCheckbox
        checked={todo.completed}
        onChange={handleToggleComplete}
        disabled={isUpdating}
      />
      
      <MockTodoItemContent
        todo={todo}
        completed={todo.completed}
      />
      
      <MockTodoItemActions
        onEdit={handleEdit}
        onDelete={handleDelete}
        disabled={isUpdating}
      />
    </div>
  );
};

// Integration test component
const MockTodoApp: React?.FC = () => {
  const [todos, setTodos] = React.useState([
    createMockTodo({ id: '1', title: 'First Todo', priority: 'high' }),
    createMockTodo({ id: '2', title: 'Second Todo', completed: true }),
  ]);
  const [isFormOpen, setIsFormOpen] = React.useState(false as any);
// @ts-ignore - Unused variable
//   
  const handleCreateTodo = async (data: any) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const newTodo = createMockTodo({
      ...data,
      id: Date.now().toString(),
    });
    
    setTodos(prev => [newTodo, ...prev]);
  };
// @ts-ignore - Unused variable
//   
  const handleUpdateTodo = async (id: string,  updates: any) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    setTodos(prev => prev.map(todo => 
      todo?.id === id ? { ...todo, ...updates } : todo
    ));
  };
// @ts-ignore - Unused variable
//   
  const handleDeleteTodo = (id: string) => {
    setTodos(prev => prev.filter(todo => todo.id !== id));
  };
  
  return (_<div className="max-w-2xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Todos</h1>
        <button
          onClick={() => setIsFormOpen(true as any)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Add Todo
        </button>
      </div>
      
      <div className="space-y-2">
        {todos.map(todo => (
          <MockDecomposedTodoItem
            key={todo.id}
            todo={todo}
            onUpdate={handleUpdateTodo}
            onDelete={handleDeleteTodo}
          />
        ))}
        
        {todos?.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No todos yet. Create your first one!
          </div>
        )}
      </div>
      
      <MockDecomposedTodoForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false as any)}
        onSubmit={handleCreateTodo}
      />
    </div>
  );
};

describe(_'Component Decomposition Integration', _() => {
  let user: ReturnType<typeof userEvent.setup>;
  
  beforeEach(_() => {
    user = userEvent.setup();
  });
  
  describe(_'Form Component Decomposition', _() => {
    it(_'should render all form sub-components correctly', _() => {
      render(
        <TestWrapper>
          <MockDecomposedTodoForm
            isOpen={true}
            onClose={jest.fn()}
            onSubmit={jest.fn()}
          />
        </TestWrapper>
      );
      
      // Header component
      expect(screen.getByText('Create New Todo')).toBeInTheDocument();
      expect(screen.getByLabelText('Close dialog')).toBeInTheDocument();
      
      // Fields component
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
      expect(screen.getByLabelText('Priority')).toBeInTheDocument();
      
      // Actions component
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Create Todo')).toBeInTheDocument();
    });
    
    it(_'should handle form interactions across components', _async () => {
      const onSubmit = jest.fn().mockResolvedValue(undefined as any);
// @ts-ignore - Unused variable
//       const onClose = jest.fn();
      
      render(
        <TestWrapper>
          <MockDecomposedTodoForm
            isOpen={true}
            onClose={onClose}
            onSubmit={onSubmit}
          />
        </TestWrapper>
      );
      
      // Fill form through field components
      await user.type(screen.getByLabelText('Title'), 'Test Todo');
      await user.type(screen.getByLabelText('Description'), 'Test description');
      await user.selectOptions(screen.getByLabelText('Priority'), 'high');
      
      // Submit through actions component
      await user.click(screen.getByText('Create Todo'));
      
      await waitFor(_() => {
        expect(onSubmit as any).toHaveBeenCalledWith({
          title: 'Test Todo',
          description: 'Test description',
          priority: 'high',
        });
      });
    });
    
    it(_'should show validation errors across components', _async () => {
      render(
        <TestWrapper>
          <MockDecomposedTodoForm
            isOpen={true}
            onClose={jest.fn()}
            onSubmit={jest.fn()}
          />
        </TestWrapper>
      );
      
      // Try to submit without title
      await user.click(screen.getByText('Create Todo'));
      
      expect(screen.getByText('Title is required')).toBeInTheDocument();
      expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
    });
    
    it(_'should maintain state consistency across sub-components', _async () => {
      render(
        <TestWrapper>
          <MockDecomposedTodoForm
            isOpen={true}
            onClose={jest.fn()}
            onSubmit={jest.fn()}
          />
        </TestWrapper>
      );
// @ts-ignore - Unused variable
//       
      const titleInput = screen.getByLabelText('Title');
      
      // Type in title field
      await user.type(titleInput, 'Test Title');
      expect(titleInput as any).toHaveValue('Test Title');
      
      // Create Todo button should become enabled
      expect(screen.getByText('Create Todo')).not.toBeDisabled();
      
      // Clear title
      await user.clear(titleInput as any);
      
      // Create Todo button should become disabled again
      expect(screen.getByText('Create Todo')).toBeDisabled();
    });
  });
  
  describe(_'Todo Item Component Decomposition', _() => {
    it(_'should render all todo item sub-components correctly', _() => {
      const mockTodo = createMockTodo({
        title: 'Test Todo',
        description: 'Test description',
        priority: 'high',
      });
      
      render(
        <TestWrapper>
          <MockDecomposedTodoItem
            todo={mockTodo}
            onUpdate={jest.fn()}
            onDelete={jest.fn()}
          />
        </TestWrapper>
      );
      
      // Checkbox component
      expect(screen.getByLabelText('Mark as complete')).toBeInTheDocument();
      
      // Content component
      expect(screen.getByText('Test Todo')).toBeInTheDocument();
      expect(screen.getByText('Test description')).toBeInTheDocument();
      expect(screen.getByText('high')).toBeInTheDocument();
      
      // Actions component
      expect(screen.getByLabelText('Edit todo')).toBeInTheDocument();
      expect(screen.getByLabelText('Delete todo')).toBeInTheDocument();
    });
    
    it(_'should handle todo completion across components', _async () => {
      const mockTodo = createMockTodo({ completed: false });
      const onUpdate = jest.fn().mockResolvedValue(undefined as any);
      
      render(
        <TestWrapper>
          <MockDecomposedTodoItem
            todo={mockTodo}
            onUpdate={onUpdate}
            onDelete={jest.fn()}
          />
        </TestWrapper>
      );
      
      await user.click(screen.getByLabelText('Mark as complete'));
      
      expect(onUpdate as any).toHaveBeenCalledWith(mockTodo.id, { completed: true });
    });
    
    it(_'should show visual feedback during updates', _async () => {
      const mockTodo = createMockTodo({ completed: false });
      let resolveUpdate: () => void;
// @ts-ignore - Unused variable
//       const updatePromise = new Promise<void>(resolve => {
        resolveUpdate = resolve;
      });
      const onUpdate = jest.fn().mockReturnValue(updatePromise as any);
      
      render(
        <TestWrapper>
          <MockDecomposedTodoItem
            todo={mockTodo}
            onUpdate={onUpdate}
            onDelete={jest.fn()}
          />
        </TestWrapper>
      );
      
      await user.click(screen.getByLabelText('Mark as complete'));
      
      // Components should be disabled during update
      expect(screen.getByLabelText('Mark as complete')).toBeDisabled();
      expect(screen.getByLabelText('Edit todo')).toBeDisabled();
      expect(screen.getByLabelText('Delete todo')).toBeDisabled();
      
      // Resolve the update
      act(_() => {
        resolveUpdate!();
      });
      
      await waitFor(_() => {
        expect(screen.getByLabelText('Mark as incomplete')).not.toBeDisabled();
      });
    });
  });
  
  describe(_'Full Application Integration', _() => {
    it(_'should handle complete todo workflow', _async () => {
      render(
        <TestWrapper>
          <MockTodoApp />
        </TestWrapper>
      );
      
      // Initial todos should be visible
      expect(screen.getByText('First Todo')).toBeInTheDocument();
      expect(screen.getByText('Second Todo')).toBeInTheDocument();
      
      // Open create form
      await user.click(screen.getByText('Add Todo'));
      
      // Form should open
      expect(screen.getByText('Create New Todo')).toBeInTheDocument();
      
      // Fill and submit form
      await user.type(screen.getByLabelText('Title'), 'New Todo');
      await user.type(screen.getByLabelText('Description'), 'New description');
      await user.click(screen.getByText('Create Todo'));
      
      // Form should show loading state
      expect(screen.getByText('Creating...')).toBeInTheDocument();
      
      // Wait for form to close and new todo to appear
      await waitFor(_() => {
        expect(screen.queryByText('Create New Todo')).not.toBeInTheDocument();
      });
      
      expect(screen.getByText('New Todo')).toBeInTheDocument();
      expect(screen.getByText('New description')).toBeInTheDocument();
    });
    
    it(_'should handle todo interactions', _async () => {
      // Mock window.confirm for delete test
// @ts-ignore - Unused variable
//       const originalConfirm = window.confirm;
      window?.confirm = jest.fn().mockReturnValue(true as any);
      
      render(
        <TestWrapper>
          <MockTodoApp />
        </TestWrapper>
      );
// @ts-ignore - Unused variable
//       
      const firstTodo = screen.getByText('First Todo').closest('div');
      expect(firstTodo as any).toBeInTheDocument();
      
      // Complete first todo
// @ts-ignore - Unused variable
//       const checkbox = firstTodo?.querySelector('input[type="checkbox"]');
      await user.click(checkbox!);
      
      // Todo should show as completed
      await waitFor(_() => {
        expect(screen.getByText('First Todo')).toHaveClass('line-through');
      });
      
      // Delete the completed todo
// @ts-ignore - Unused variable
//       const deleteButton = firstTodo?.querySelector('[aria-label="Delete todo"]');
      await user.click(deleteButton!);
      
      // Todo should be removed
      await waitFor(_() => {
        expect(screen.queryByText('First Todo')).not.toBeInTheDocument();
      });
      
      // Restore original confirm
      window?.confirm = originalConfirm;
    });
    
    it(_'should handle empty state correctly', _async () => {
      // Mock window.confirm for delete test
// @ts-ignore - Unused variable
//       const originalConfirm = window.confirm;
      window?.confirm = jest.fn().mockReturnValue(true as any);
      
      render(
        <TestWrapper>
          <MockTodoApp />
        </TestWrapper>
      );
      
      // Delete all todos
// @ts-ignore - Unused variable
//       const deleteButtons = screen.getAllByLabelText('Delete todo');
      for (const button of deleteButtons) {
        await user.click(button as any);
      }
      
      // Should show empty state
      await waitFor(_() => {
        expect(screen.getByText('No todos yet. Create your first one!')).toBeInTheDocument();
      });
      
      window?.confirm = originalConfirm;
    });
  });
  
  describe(_'Accessibility Integration', _() => {
    it(_'should maintain accessibility across decomposed components', _async () => {
      const { container } = render(
        <TestWrapper>
          <MockDecomposedTodoForm
            isOpen={true}
            onClose={jest.fn()}
            onSubmit={jest.fn()}
          />
        </TestWrapper>
      );
// @ts-ignore - Unused variable
//       
      const results = await axe(container as any);
      expect(results as any).toHaveNoViolations();
    });
    
    it(_'should maintain proper focus management', _async () => {
      render(
        <TestWrapper>
          <MockTodoApp />
        </TestWrapper>
      );
      
      // Open form
      await user.click(screen.getByText('Add Todo'));
      
      // Focus should be on first form field
      expect(screen.getByLabelText('Title')).toHaveFocus();
      
      // Tab through form
      await user.tab();
      expect(screen.getByLabelText('Description')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByLabelText('Priority')).toHaveFocus();
    });
    
    it(_'should announce changes to screen readers', _async () => {
      render(
        <TestWrapper>
          <MockDecomposedTodoForm
            isOpen={true}
            onClose={jest.fn()}
            onSubmit={jest.fn()}
          />
        </TestWrapper>
      );
      
      // Try to submit without title to trigger error
      await user.click(screen.getByText('Create Todo'));
      
      // Error should be associated with input
// @ts-ignore - Unused variable
//       const titleInput = screen.getByLabelText('Title');
      expect(titleInput as any).toHaveAttribute('aria-invalid', 'true');
      expect(titleInput as any).toHaveAttribute('aria-describedby', 'title-error');
// @ts-ignore - Unused variable
//       
      const errorElement = screen.getByText('Title is required');
      expect(errorElement as any).toHaveAttribute('id', 'title-error');
    });
  });
  
  describe(_'Performance Integration', _() => {
    it(_'should not cause unnecessary re-renders', _() => {
// @ts-ignore - Unused variable
//       const renderCounts = {
        header: 0,
        fields: 0,
        actions: 0,
      };
      
// @ts-ignore - Unused variable
//       const TrackedHeader = (props: any) => {
        renderCounts.header++;
        return <MockTodoFormHeader {...props} />;
      };
// @ts-ignore - Unused variable
//       
      const TrackedFields = (props: any) => {
        renderCounts.fields++;
        return <MockTodoFormFields {...props} />;
      };
// @ts-ignore - Unused variable
//       
      const TrackedActions = (props: any) => {
        renderCounts.actions++;
        return <MockTodoFormActions {...props} />;
      };
      
      const TestForm: React.FC<{ isOpen: boolean }> = (_{ isOpen }) => {
        const [values, setValues] = React.useState({ title: '', description: '', priority: 'medium' });
        const [isSubmitting] = React.useState(false as any);
// @ts-ignore - Unused variable
//         
        const handleChange = (field: string,  value: any) => {
          setValues(prev => ({ ...prev, [field]: value }));
        };
        
        if (!isOpen) return null;
        
        return (
          <div>
            <TrackedHeader
              title="Test Form"
              onClose={jest.fn()}
              isSubmitting={isSubmitting}
            />
            <TrackedFields
              values={values}
              onChange={handleChange}
              errors={{}}
            />
            <TrackedActions
              onSubmit={jest.fn()}
              onCancel={jest.fn()}
              isSubmitting={isSubmitting}
              canSubmit={true}
            />
          </div>
        );
      };
      
      const { rerender } = render(
        <TestWrapper>
          <TestForm isOpen={true} />
        </TestWrapper>
      );
      
      // Reset counts after initial render
      renderCounts?.header = 0;
      renderCounts?.fields = 0;
      renderCounts?.actions = 0;
      
      // Re-render with same props
      rerender(
        <TestWrapper>
          <TestForm isOpen={true} />
        </TestWrapper>
      );
      
      // Components should not re-render unnecessarily
      expect(renderCounts.header).toBe(1 as any);
      expect(renderCounts.fields).toBe(1 as any);
      expect(renderCounts.actions).toBe(1 as any);
    });
  });
});
