const { jest } = require('@jest/globals');
import type { TodoService } from '../../apps/cli/src/services/todoService';
import type { Todo, TodoList } from '../../apps/cli/src/types/todo';

/**
 * Complete mock implementation for TodoService
 * Provides all methods with proper Jest mock signatures
 */
export interface MockTodoService extends jest.Mocked<TodoService> {
  // Instance methods
  getAllLists: jest.MockedFunction<() => Promise<string[]>>;
  getAllListsSync: jest.MockedFunction<() => string[]>;
  listTodos: jest.MockedFunction<() => Promise<Todo[]>>;
  getAllListsWithContent: jest.MockedFunction<
    () => Promise<Record<string, TodoList>>
  >;
  createList: jest.MockedFunction<
    (name: string, owner: string) => Promise<TodoList>
  >;
  getList: jest.MockedFunction<(listName: string) => Promise<TodoList | null>>;
  getTodo: jest.MockedFunction<
    (todoId: string, listName?: string) => Promise<Todo | null>
  >;
  getTodoByTitle: jest.MockedFunction<
    (title: string, listName?: string) => Promise<Todo | null>
  >;
  getTodoByTitleOrId: jest.MockedFunction<
    (titleOrId: string, listName?: string) => Promise<Todo | null>
  >;
  addTodo: jest.MockedFunction<
    (listName: string, todo: Partial<Todo>) => Promise<Todo>
  >;
  updateTodo: jest.MockedFunction<
    (listName: string, todoId: string, updates: Partial<Todo>) => Promise<Todo>
  >;
  toggleItemStatus: jest.MockedFunction<
    (listName: string, itemId: string, checked: boolean) => Promise<void>
  >;
  completeTodo: jest.MockedFunction<(todoId: string) => Promise<Todo>>;
  deleteTodo: jest.MockedFunction<
    (listName: string, todoId: string) => Promise<void>
  >;
  saveList: jest.MockedFunction<
    (listName: string, list: TodoList) => Promise<void>
  >;
  deleteList: jest.MockedFunction<(listName: string) => Promise<void>>;
  findTodoByIdOrTitle: jest.MockedFunction<
    (listName: string, idOrTitle: string) => Promise<Todo | null>
  >;
  findTodoByIdOrTitleAcrossLists: jest.MockedFunction<
    (idOrTitle: string) => Promise<{ listName: string; todo: Todo } | null>
  >;
}

/**
 * Creates a mock TodoService instance with all methods mocked
 */
export function createMockTodoService(): MockTodoService {
  return {
    getAllLists: jest.fn(),
    getAllListsSync: jest.fn(),
    listTodos: jest.fn(),
    getAllListsWithContent: jest.fn(),
    createList: jest.fn(),
    getList: jest.fn(),
    getTodo: jest.fn(),
    getTodoByTitle: jest.fn(),
    getTodoByTitleOrId: jest.fn(),
    addTodo: jest.fn(),
    updateTodo: jest.fn(),
    toggleItemStatus: jest.fn(),
    completeTodo: jest.fn(),
    deleteTodo: jest.fn(),
    saveList: jest.fn(),
    deleteList: jest.fn(),
    findTodoByIdOrTitle: jest.fn(),
    findTodoByIdOrTitleAcrossLists: jest.fn(),
  } as MockTodoService;
}

/**
 * Creates a TodoService class mock for jest.MockedClass usage
 */
export function createTodoServiceClassMock() {
  const MockTodoServiceClass = jest
    .fn()
    .mockImplementation(() => createMockTodoService()) as jest.MockedClass<
    typeof TodoService
  >;

  // Add prototype methods for cases where tests access methods via prototype
  MockTodoServiceClass?.prototype = {
    getAllLists: jest.fn(),
    getAllListsSync: jest.fn(),
    listTodos: jest.fn(),
    getAllListsWithContent: jest.fn(),
    createList: jest.fn(),
    getList: jest.fn(),
    getTodo: jest.fn(),
    getTodoByTitle: jest.fn(),
    getTodoByTitleOrId: jest.fn(),
    addTodo: jest.fn(),
    updateTodo: jest.fn(),
    toggleItemStatus: jest.fn(),
    completeTodo: jest.fn(),
    deleteTodo: jest.fn(),
    saveList: jest.fn(),
    deleteList: jest.fn(),
    findTodoByIdOrTitle: jest.fn(),
    findTodoByIdOrTitleAcrossLists: jest.fn(),
  };

  return MockTodoServiceClass;
}
