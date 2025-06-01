/**
 * Tests for BlockchainTodoManager component
 * Ensures proper blockchain integration and error handling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '../test-utils';
import BlockchainTodoManager from '../../src/components/BlockchainTodoManager';
import { useWalletContext } from '../../src/contexts/WalletContext';
import { useSuiTodos, useTodoOperation } from '../../src/hooks/useSuiTodos';
import toast from 'react-hot-toast';

// Import centralized mocks
import '../mocks';

// Mock the hooks
jest.mock('../../src/contexts/WalletContext');
jest.mock('../../src/hooks/useSuiTodos');
jest.mock('react-hot-toast');

describe('BlockchainTodoManager', () => {
  // Mock implementations
  const mockCreateTodo = jest.fn();
  const mockUpdateTodo = jest.fn();
  const mockDeleteTodo = jest.fn();
  const mockCompleteTodo = jest.fn();
  const mockTransferTodo = jest.fn();
  
  const mockTodos = [
    {
      id: '1',
      objectId: '0x123',
      title: 'Test Todo 1',
      description: 'Description 1',
      completed: false,
      priority: 'high' as const,
      owner: '0xowner123',
      createdAt: Date.now(),
      tags: ['test'],
      dueDate: undefined,
      completedAt: undefined,
      transactionDigest: '0xdigest123',
      networkId: 'testnet' as const,
    },
  ];

  const defaultWalletContext = {
    connected: true,
    address: '0xowner123',
    chainId: 'testnet',
    connect: jest.fn(),
    disconnect: jest.fn(),
    error: null,
  };

  const defaultSuiTodosHook = {
    todos: mockTodos,
    loading: false,
    error: null,
    network: 'testnet' as const,
    refetch: jest.fn(),
  };

  const defaultTodoOperation = {
    createTodo: mockCreateTodo,
    updateTodo: mockUpdateTodo,
    deleteTodo: mockDeleteTodo,
    completeTodo: mockCompleteTodo,
    transferTodo: mockTransferTodo,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    (useWalletContext as jest.Mock).mockReturnValue(defaultWalletContext);
    (useSuiTodos as jest.Mock).mockReturnValue(defaultSuiTodosHook);
    (useTodoOperation as jest.Mock).mockReturnValue(defaultTodoOperation);
    
    // Mock toast
    (toast.success as jest.Mock).mockImplementation(() => {});
    (toast.error as jest.Mock).mockImplementation(() => {});
  });

  describe('Rendering', () => {
    it('should render when wallet is connected', () => {
      render(<BlockchainTodoManager />);
      
      expect(screen.getByText('Create TodoNFT')).toBeInTheDocument();
      expect(screen.getByText('Your TodoNFTs')).toBeInTheDocument();
    });

    it('should show connect wallet message when disconnected', () => {
      (useWalletContext as jest.Mock).mockReturnValue({
        ...defaultWalletContext,
        connected: false,
        address: null,
      });

      render(<BlockchainTodoManager />);
      
      expect(screen.getByText(/Please connect your wallet/i)).toBeInTheDocument();
    });

    it('should display loading state', () => {
      (useSuiTodos as jest.Mock).mockReturnValue({
        ...defaultSuiTodosHook,
        loading: true,
        todos: [],
      });

      render(<BlockchainTodoManager />);
      
      expect(screen.getByText(/Loading TodoNFTs/i)).toBeInTheDocument();
    });

    it('should display error state', () => {
      const error = new Error('Failed to fetch todos');
      (useSuiTodos as jest.Mock).mockReturnValue({
        ...defaultSuiTodosHook,
        error,
        todos: [],
      });

      render(<BlockchainTodoManager />);
      
      expect(screen.getByText(/Error loading TodoNFTs/i)).toBeInTheDocument();
      expect(screen.getByText(error.message)).toBeInTheDocument();
    });
  });

  describe('Todo Creation', () => {
    it('should create todo with valid data', async () => {
      mockCreateTodo.mockResolvedValue({
        digest: '0xnewdigest',
        effects: { status: { status: 'success' } },
      });

      render(<BlockchainTodoManager />);
      
      // Fill in the form
      fireEvent.change(screen.getByLabelText(/title/i), {
        target: { value: 'New Todo' },
      });
      
      fireEvent.change(screen.getByLabelText(/description/i), {
        target: { value: 'New Description' },
      });
      
      fireEvent.change(screen.getByLabelText(/priority/i), {
        target: { value: 'high' },
      });

      // Submit form
      fireEvent.click(screen.getByText('Create Todo'));

      await waitFor(() => {
        expect(mockCreateTodo).toHaveBeenCalledWith({
          title: 'New Todo',
          description: 'New Description',
          priority: 'high',
          dueDate: undefined,
          tags: [],
        });
      });

      expect(toast.success).toHaveBeenCalledWith(
        'TodoNFT created successfully!',
        expect.any(Object)
      );
    });

    it('should validate required fields', async () => {
      render(<BlockchainTodoManager />);
      
      // Try to submit without title
      fireEvent.click(screen.getByText('Create Todo'));

      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument();
      });

      expect(mockCreateTodo).not.toHaveBeenCalled();
    });

    it('should handle creation errors', async () => {
      const error = new Error('Insufficient gas');
      mockCreateTodo.mockRejectedValue(error);

      render(<BlockchainTodoManager />);
      
      // Fill and submit form
      fireEvent.change(screen.getByLabelText(/title/i), {
        target: { value: 'New Todo' },
      });
      
      fireEvent.click(screen.getByText('Create Todo'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Insufficient gas',
          expect.any(Object)
        );
      });
    });

    it('should disable form during submission', async () => {
      mockCreateTodo.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      render(<BlockchainTodoManager />);
      
      fireEvent.change(screen.getByLabelText(/title/i), {
        target: { value: 'New Todo' },
      });
      
      fireEvent.click(screen.getByText('Create Todo'));

      // Button should be disabled
      expect(screen.getByText('Creating...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
    });
  });

  describe('Todo Operations', () => {
    it('should complete a todo', async () => {
      mockCompleteTodo.mockResolvedValue({
        digest: '0xcompletedigest',
        effects: { status: { status: 'success' } },
      });

      render(<BlockchainTodoManager />);
      
      const completeButton = screen.getByTestId('complete-todo-1');
      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(mockCompleteTodo).toHaveBeenCalledWith('1');
      });

      expect(toast.success).toHaveBeenCalledWith(
        'Todo completed!',
        expect.any(Object)
      );
    });

    it('should delete a todo with confirmation', async () => {
      mockDeleteTodo.mockResolvedValue({
        digest: '0xdeletedigest',
        effects: { status: { status: 'success' } },
      });

      // Mock window.confirm
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

      render(<BlockchainTodoManager />);
      
      const deleteButton = screen.getByTestId('delete-todo-1');
      fireEvent.click(deleteButton);

      expect(confirmSpy).toHaveBeenCalledWith(
        'Are you sure you want to delete this TodoNFT? This action cannot be undone.'
      );

      await waitFor(() => {
        expect(mockDeleteTodo).toHaveBeenCalledWith('1');
      });

      expect(toast.success).toHaveBeenCalledWith(
        'Todo deleted!',
        expect.any(Object)
      );
    });

    it('should cancel delete when not confirmed', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

      render(<BlockchainTodoManager />);
      
      const deleteButton = screen.getByTestId('delete-todo-1');
      fireEvent.click(deleteButton);

      expect(mockDeleteTodo).not.toHaveBeenCalled();
    });

    it('should handle operation errors gracefully', async () => {
      const error = new Error('Network error');
      mockCompleteTodo.mockRejectedValue(error);

      render(<BlockchainTodoManager />);
      
      const completeButton = screen.getByTestId('complete-todo-1');
      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Failed to complete todo: Network error',
          expect.any(Object)
        );
      });
    });
  });

  describe('Network Handling', () => {
    it('should show network mismatch warning', () => {
      (useWalletContext as jest.Mock).mockReturnValue({
        ...defaultWalletContext,
        chainId: 'mainnet',
      });

      (useSuiTodos as jest.Mock).mockReturnValue({
        ...defaultSuiTodosHook,
        network: 'testnet',
      });

      render(<BlockchainTodoManager />);
      
      expect(screen.getByText(/Network mismatch/i)).toBeInTheDocument();
      expect(screen.getByText(/Please switch to testnet/i)).toBeInTheDocument();
    });

    it('should refetch todos on network change', async () => {
      const { rerender } = render(<BlockchainTodoManager />);

      // Change network
      (useWalletContext as jest.Mock).mockReturnValue({
        ...defaultWalletContext,
        chainId: 'mainnet',
      });

      rerender(<BlockchainTodoManager />);

      await waitFor(() => {
        expect(defaultSuiTodosHook.refetch).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<BlockchainTodoManager />);
      
      expect(screen.getByRole('form', { name: /create todo/i })).toBeInTheDocument();
      expect(screen.getByRole('list', { name: /todo list/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      render(<BlockchainTodoManager />);
      
      const titleInput = screen.getByLabelText(/title/i);
      titleInput.focus();
      
      expect(document.activeElement).toBe(titleInput);
      
      // Tab to next element
      fireEvent.keyDown(titleInput, { key: 'Tab' });
      
      const descriptionInput = screen.getByLabelText(/description/i);
      expect(document.activeElement).toBe(descriptionInput);
    });
  });
});