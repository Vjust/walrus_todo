import { WalrusClientInterface } from '../../types';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Todo, TodoList } from '../../types';
import { setupMockTodos, WalrusClient } from '../../__mocks__/@mysten/walrus';
import { setupMockObject, mockSuiClient } from '../../__mocks__/@mysten/sui';

export interface TestContext {
  walrusClient: WalrusClient;
  suiClient: typeof mockSuiClient;
  todoList?: TodoList;
  mockTodoId?: string;
}

export const createTestContext = (): TestContext => {
  return {
    walrusClient: new WalrusClient(),
    suiClient: mockSuiClient
  };
};

export const setupMockTodoList = (context: TestContext, todos: Todo[] = []): string => {
  const todoList: TodoList = {
    id: 'mock-list-id',
    name: 'Mock Todo List',
    owner: 'mock-owner',
    todos,
    version: 1
  };
  
  // Setup in both Walrus and Sui
  const blobId = setupMockTodos(todos);
  setupMockObject(todoList.id, todoList);
  
  context.todoList = todoList;
  context.mockTodoId = blobId;
  
  return todoList.id;
};

export const createMockTodo = (overrides: Partial<Todo> = {}): Todo => {
  return {
    id: `mock-todo-${Math.random().toString(36).substr(2, 9)}`,
    task: 'Mock Todo Task',
    completed: false,
    priority: 'medium',
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
};

export const waitForSync = async (ms: number = 100): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const mockNetworkError = (client: WalrusClientInterface | typeof mockSuiClient, method: string): void => {
  const mockMethod = client[method as keyof typeof client];
  if (typeof mockMethod === 'function') {
    (mockMethod as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));
  }
};

export const mockNetworkLatency = (client: WalrusClientInterface | typeof mockSuiClient, method: string, latencyMs: number): void => {
  const mockMethod = client[method as keyof typeof client];
  if (typeof mockMethod === 'function') {
    const originalImpl = (mockMethod as jest.Mock).getMockImplementation();
    (mockMethod as jest.Mock).mockImplementationOnce(async (...args: any[]) => {
      await waitForSync(latencyMs);
      return originalImpl?.(...args);
    });
  }
}; 