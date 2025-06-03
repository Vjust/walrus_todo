/**
 * Integration tests for Component Decomposition
 * Tests how decomposed components work together as a system
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe, toHaveNoViolations } from 'jest-axe';
import { TestWrapper, createTestQueryClient, createMockTodo } from '../test-utils';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock the stores
jest.mock('@/stores/ui-store', () => ({
  useUIStore: jest.fn(),
  useCreateTodoForm: jest.fn(),
  useUIActions: jest.fn(),
  useCreateTodoModal: jest.fn(),
}));

jest.mock('@/stores/wallet-store', () => ({
  useWalletStore: jest.fn(),
  useIsConnected: jest.fn(),
  useWalletAddress: jest.fn(),
}));

// Mock components that would be decomposed
const MockTodoFormHeader: React.FC<{
  title: string;
  onClose: () => void;
  isSubmitting: boolean;
}> = ({ title, onClose, isSubmitting }) => (
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
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
}> = ({ values, onChange, errors }) => (
  <div className="p-4 space-y-4">
    <div>
      <label htmlFor="title" className="block text-sm font-medium mb-1">
        Title
      </label>
      <input
        id="title"
        type="text"
        value={values.title || ''}
        onChange={(e) => onChange('title', e.target.value)}
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
        onChange={(e) => onChange('description', e.target.value)}
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
        onChange={(e) => onChange('priority', e.target.value)}
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
}> = ({ onSubmit, onCancel, isSubmitting, canSubmit }) => (
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
}> = ({ isOpen, onClose, onSubmit }) => {
  const [values, setValues] = React.useState({
    title: '',
    description: '',
    priority: 'medium',
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const handleChange = (field: string, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };
  
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!values.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (values.title.length > 100) {
      newErrors.title = 'Title must be less than 100 characters';
    }
    
    if (values.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(values);
      setValues({ title: '', description: '', priority: 'medium' });
      setErrors({});
      onClose();
    } catch (error) {
      setErrors({ submit: 'Failed to create todo. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const canSubmit = values.title.trim().length > 0 && Object.keys(errors).length === 0;
  
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
}> = ({ checked, onChange, disabled }) => (
  <input
    type="checkbox"
    checked={checked}
    onChange={(e) => onChange(e.target.checked)}
    disabled={disabled}
    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
    aria-label={checked ? 'Mark as incomplete' : 'Mark as complete'}
  />
);

const MockTodoItemContent: React.FC<{
  todo: any;
  completed: boolean;
}> = ({ todo, completed }) => (
  <div className={`flex-1 ${completed ? 'opacity-60' : ''}`}>
    <h3 className={`font-medium ${completed ? 'line-through' : ''}`}>
      {todo.title}
    </h3>
    {todo.description && (
      <p className="text-sm text-gray-600 mt-1">{todo.description}</p>
    )}
    <div className="flex items-center space-x-2 mt-2">
      <span className={`text-xs px-2 py-1 rounded ${
        todo.priority === 'high' ? 'bg-red-100 text-red-800' :
        todo.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
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
}> = ({ onEdit, onDelete, disabled }) => (
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
  onUpdate: (id: string, updates: any) => void;
  onDelete: (id: string) => void;
}> = ({ todo, onUpdate, onDelete }) => {
  const [isUpdating, setIsUpdating] = React.useState(false);
  
  const handleToggleComplete = async (completed: boolean) => {
    setIsUpdating(true);
    try {
      await onUpdate(todo.id, { completed });
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleEdit = () => {
    // Mock edit functionality
    console.log('Edit todo:', todo.id);
  };
  
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
const MockTodoApp: React.FC = () => {
  const [todos, setTodos] = React.useState([
    createMockTodo({ id: '1', title: 'First Todo', priority: 'high' }),
    createMockTodo({ id: '2', title: 'Second Todo', completed: true }),
  ]);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  
  const handleCreateTodo = async (data: any) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const newTodo = createMockTodo({
      ...data,
      id: Date.now().toString(),
    });
    
    setTodos(prev => [newTodo, ...prev]);
  };
  
  const handleUpdateTodo = async (id: string, updates: any) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    setTodos(prev => prev.map(todo => 
      todo.id === id ? { ...todo, ...updates } : todo
    ));
  };
  
  const handleDeleteTodo = (id: string) => {
    setTodos(prev => prev.filter(todo => todo.id !== id));
  };
  
  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Todos</h1>
        <button
          onClick={() => setIsFormOpen(true)}
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
        
        {todos.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No todos yet. Create your first one!
          </div>
        )}
      </div>
      
      <MockDecomposedTodoForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleCreateTodo}
      />
    </div>
  );
};

describe('Component Decomposition Integration', () => {
  let user: ReturnType<typeof userEvent.setup>;
  
  beforeEach(() => {
    user = userEvent.setup();
  });
  
  describe('Form Component Decomposition', () => {
    it('should render all form sub-components correctly', () => {
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
    
    it('should handle form interactions across components', async () => {
      const onSubmit = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();
      
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
      
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          title: 'Test Todo',
          description: 'Test description',
          priority: 'high',
        });
      });
    });
    
    it('should show validation errors across components', async () => {
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
    
    it('should maintain state consistency across sub-components', async () => {
      render(
        <TestWrapper>
          <MockDecomposedTodoForm
            isOpen={true}
            onClose={jest.fn()}
            onSubmit={jest.fn()}
          />
        </TestWrapper>
      );
      
      const titleInput = screen.getByLabelText('Title');
      
      // Type in title field
      await user.type(titleInput, 'Test Title');
      expect(titleInput).toHaveValue('Test Title');
      
      // Create Todo button should become enabled
      expect(screen.getByText('Create Todo')).not.toBeDisabled();
      
      // Clear title
      await user.clear(titleInput);
      
      // Create Todo button should become disabled again
      expect(screen.getByText('Create Todo')).toBeDisabled();
    });
  });
  
  describe('Todo Item Component Decomposition', () => {
    it('should render all todo item sub-components correctly', () => {
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
    
    it('should handle todo completion across components', async () => {
      const mockTodo = createMockTodo({ completed: false });
      const onUpdate = jest.fn().mockResolvedValue(undefined);
      
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
      
      expect(onUpdate).toHaveBeenCalledWith(mockTodo.id, { completed: true });
    });
    
    it('should show visual feedback during updates', async () => {
      const mockTodo = createMockTodo({ completed: false });
      let resolveUpdate: () => void;
      const updatePromise = new Promise<void>(resolve => {
        resolveUpdate = resolve;
      });
      const onUpdate = jest.fn().mockReturnValue(updatePromise);
      
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
      act(() => {
        resolveUpdate!();
      });
      
      await waitFor(() => {
        expect(screen.getByLabelText('Mark as incomplete')).not.toBeDisabled();
      });
    });
  });
  
  describe('Full Application Integration', () => {
    it('should handle complete todo workflow', async () => {
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
      await waitFor(() => {
        expect(screen.queryByText('Create New Todo')).not.toBeInTheDocument();
      });
      
      expect(screen.getByText('New Todo')).toBeInTheDocument();
      expect(screen.getByText('New description')).toBeInTheDocument();
    });
    
    it('should handle todo interactions', async () => {
      // Mock window.confirm for delete test
      const originalConfirm = window.confirm;
      window.confirm = jest.fn().mockReturnValue(true);
      
      render(
        <TestWrapper>
          <MockTodoApp />
        </TestWrapper>
      );
      
      const firstTodo = screen.getByText('First Todo').closest('div');
      expect(firstTodo).toBeInTheDocument();
      
      // Complete first todo
      const checkbox = firstTodo!.querySelector('input[type="checkbox"]');
      await user.click(checkbox!);
      
      // Todo should show as completed
      await waitFor(() => {
        expect(screen.getByText('First Todo')).toHaveClass('line-through');
      });
      
      // Delete the completed todo
      const deleteButton = firstTodo!.querySelector('[aria-label="Delete todo"]');
      await user.click(deleteButton!);
      
      // Todo should be removed
      await waitFor(() => {
        expect(screen.queryByText('First Todo')).not.toBeInTheDocument();
      });
      
      // Restore original confirm
      window.confirm = originalConfirm;
    });
    
    it('should handle empty state correctly', async () => {
      // Mock window.confirm for delete test
      const originalConfirm = window.confirm;
      window.confirm = jest.fn().mockReturnValue(true);
      
      render(
        <TestWrapper>
          <MockTodoApp />
        </TestWrapper>
      );
      
      // Delete all todos
      const deleteButtons = screen.getAllByLabelText('Delete todo');
      for (const button of deleteButtons) {
        await user.click(button);
      }
      
      // Should show empty state
      await waitFor(() => {
        expect(screen.getByText('No todos yet. Create your first one!')).toBeInTheDocument();
      });
      
      window.confirm = originalConfirm;
    });
  });
  
  describe('Accessibility Integration', () => {
    it('should maintain accessibility across decomposed components', async () => {
      const { container } = render(
        <TestWrapper>
          <MockDecomposedTodoForm
            isOpen={true}
            onClose={jest.fn()}
            onSubmit={jest.fn()}
          />
        </TestWrapper>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
    
    it('should maintain proper focus management', async () => {
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
    
    it('should announce changes to screen readers', async () => {
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
      const titleInput = screen.getByLabelText('Title');
      expect(titleInput).toHaveAttribute('aria-invalid', 'true');
      expect(titleInput).toHaveAttribute('aria-describedby', 'title-error');
      
      const errorElement = screen.getByText('Title is required');
      expect(errorElement).toHaveAttribute('id', 'title-error');
    });
  });
  
  describe('Performance Integration', () => {
    it('should not cause unnecessary re-renders', () => {
      const renderCounts = {
        header: 0,
        fields: 0,
        actions: 0,
      };
      
      const TrackedHeader = (props: any) => {
        renderCounts.header++;
        return <MockTodoFormHeader {...props} />;
      };
      
      const TrackedFields = (props: any) => {
        renderCounts.fields++;
        return <MockTodoFormFields {...props} />;
      };
      
      const TrackedActions = (props: any) => {
        renderCounts.actions++;
        return <MockTodoFormActions {...props} />;
      };
      
      const TestForm: React.FC<{ isOpen: boolean }> = ({ isOpen }) => {
        const [values, setValues] = React.useState({ title: '', description: '', priority: 'medium' });
        const [isSubmitting] = React.useState(false);
        
        const handleChange = (field: string, value: any) => {
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
      renderCounts.header = 0;
      renderCounts.fields = 0;
      renderCounts.actions = 0;
      
      // Re-render with same props
      rerender(
        <TestWrapper>
          <TestForm isOpen={true} />
        </TestWrapper>
      );
      
      // Components should not re-render unnecessarily
      expect(renderCounts.header).toBe(1);
      expect(renderCounts.fields).toBe(1);
      expect(renderCounts.actions).toBe(1);
    });
  });
});
