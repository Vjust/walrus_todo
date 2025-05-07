import { TodoList, Todo } from '../types';

// Mock type for Config
export interface MockConfig {
  network: string;
  walletAddress: string;
  encryptedStorage: boolean;
  lastDeployment?: {
    packageId: string;
  } | null;
}

// Mock types for WalrusStorage
export interface MockWalrusStorage {
  connect: jest.Mock<Promise<void>, []>;
  disconnect: jest.Mock<Promise<void>, []>;
  storeTodo: jest.Mock<Promise<string>, [Todo]>;
}

export const createMockTodoList = (overrides?: Partial<TodoList>): TodoList => ({
  id: 'default',
  name: 'default',
  owner: 'default-owner',
  todos: [],
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

export const createMockTodo = (overrides?: Partial<Todo>): Todo => ({
  id: 'test-todo-id',
  title: 'Test Todo',
  description: '',
  completed: false,
  priority: 'medium',
  tags: [] as string[],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  private: true,
  storageLocation: 'local',
  ...overrides
});