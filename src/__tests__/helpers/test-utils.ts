import type { Mock } from 'jest-mock';
import { StorageLocation, Todo } from '../../types/todo';

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export const createMockTodo = (overrides?: DeepPartial<Todo>): Todo => ({
  id: 'test-todo-id',
  title: 'Test Todo',
  description: '',
  completed: false,
  priority: 'medium',
  tags: [] as string[],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  private: true,
  storageLocation: 'local' as StorageLocation,
  ...overrides
});

export type MockOf<T> = {
  [P in keyof T]: T[P] extends (...args: any[]) => any
    ? jest.Mock<ReturnType<T[P]>, Parameters<T[P]>>
    : T[P];
};