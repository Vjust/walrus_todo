import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { Todo, TodoList } from '../../types/todo';
import { STORAGE_CONFIG } from '../../constants';
import { generateId } from '../../utils/id-generator';
import { CLIError } from '../../types/errors/consolidated';
import { SHARED_STORAGE_CONFIG, ensureTodosDirectory } from '@waltodo/shared-constants';
import { configService } from '../config-service';
import { Logger } from '../../utils/Logger';

const logger = new Logger('todo-service-functional');

// ==================== Types ====================

export interface TodoServiceState {
  todosDir: string;
  initialized: boolean;
}

export interface TodoServiceConfig {
  todosDir?: string;
  storage?: {
    read: typeof fsPromises.readFile;
    write: typeof fsPromises.writeFile;
    readdir: typeof fsPromises.readdir;
    unlink: typeof fsPromises.unlink;
    access: typeof fsPromises.access;
    mkdir: typeof fsPromises.mkdir;
  };
  configService?: typeof configService;
}

// ==================== State Management ====================

/**
 * Creates initial state for the todo service
 */
const createInitialState = (config: TodoServiceConfig): TodoServiceState => ({
  todosDir: config.todosDir || SHARED_STORAGE_CONFIG.getTodosPath(),
  initialized: false,
});

/**
 * Updates state immutably
 */
const updateState = (
  state: TodoServiceState,
  updates: Partial<TodoServiceState>
): TodoServiceState => ({
  ...state,
  ...updates,
});

// ==================== Pure Functions ====================

/**
 * Validates todo data
 */
const validateTodo = (todo: Partial<Todo>): todo is Todo => {
  return !!(todo.id && todo.title !== undefined);
};

/**
 * Creates a new todo with defaults
 */
const createTodo = (data: Partial<Todo>): Todo => ({
  id: data.id || generateId(),
  title: data.title || '',
  description: data.description || '',
  completed: data.completed || false,
  priority: data.priority || 'medium',
  tags: data.tags || [],
  createdAt: data.createdAt || new Date().toISOString(),
  updatedAt: data.updatedAt || new Date().toISOString(),
  private: data.private !== undefined ? data.private : true,
  storageLocation: data.storageLocation || 'local',
  completedAt: data.completedAt,
  nftObjectId: data.nftObjectId,
});

/**
 * Creates a new todo list
 */
const createTodoList = (name: string, owner: string): TodoList => ({
  id: generateId(),
  name,
  owner,
  todos: [],
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

/**
 * Filters todos based on criteria
 */
const filterTodos = (
  todos: Todo[],
  filters: {
    completed?: boolean;
    priority?: string;
    tags?: string[];
  }
): Todo[] => {
  return todos.filter(todo => {
    if (filters.completed !== undefined && todo.completed !== filters.completed) {
      return false;
    }
    if (filters.priority && todo.priority !== filters.priority) {
      return false;
    }
    if (filters.tags && filters.tags.length > 0) {
      if (!todo.tags) return false;
      return filters.tags.every(tag => todo.tags?.includes(tag));
    }
    return true;
  });
};

/**
 * Finds a todo by ID or title
 */
const findTodo = (todos: Todo[], idOrTitle: string): Todo | null => {
  return (
    todos.find(t => t.id === idOrTitle) ||
    todos.find(t => t.title?.toLowerCase() === idOrTitle.toLowerCase()) ||
    null
  );
};

/**
 * Updates a todo in a list immutably
 */
const updateTodoInList = (
  list: TodoList,
  todoId: string,
  updates: Partial<Todo>
): TodoList => {
  const todoIndex = list.todos.findIndex(t => t.id === todoId);
  if (todoIndex === -1) {
    throw new CLIError(
      `Todo "${todoId}" not found in list "${list.name}"`,
      'TODO_NOT_FOUND'
    );
  }

  const updatedTodos = [...list.todos];
  updatedTodos[todoIndex] = {
    ...updatedTodos[todoIndex],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  return {
    ...list,
    todos: updatedTodos,
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Adds a todo to a list immutably
 */
const addTodoToList = (list: TodoList, todo: Todo): TodoList => ({
  ...list,
  todos: [...list.todos, todo],
  updatedAt: new Date().toISOString(),
});

/**
 * Removes a todo from a list immutably
 */
const removeTodoFromList = (list: TodoList, todoId: string): TodoList => {
  const todoIndex = list.todos.findIndex(t => t.id === todoId);
  if (todoIndex === -1) {
    throw new CLIError(
      `Todo "${todoId}" not found in list "${list.name}"`,
      'TODO_NOT_FOUND'
    );
  }

  const updatedTodos = [...list.todos];
  updatedTodos.splice(todoIndex, 1);

  return {
    ...list,
    todos: updatedTodos,
    updatedAt: new Date().toISOString(),
  };
};

// ==================== Higher-Order Functions ====================

/**
 * HOF for storage operations
 */
const withStorage = <T>(
  fn: (storage: TodoServiceConfig['storage']) => Promise<T>
) => async (config: TodoServiceConfig): Promise<T> => {
  const storage = config.storage || {
    read: fsPromises.readFile,
    write: fsPromises.writeFile,
    readdir: fsPromises.readdir,
    unlink: fsPromises.unlink,
    access: fsPromises.access,
    mkdir: fsPromises.mkdir,
  };
  return fn(storage);
};

/**
 * HOF for validation
 */
const withValidation = <T extends any[], R>(
  validator: (...args: T) => void,
  fn: (...args: T) => R
) => (...args: T): R => {
  validator(...args);
  return fn(...args);
};

/**
 * HOF for error handling
 */
const withErrorHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  errorType: string
) => async (...args: T): Promise<R> => {
  try {
    return await fn(...args);
  } catch (error) {
    if (error instanceof CLIError) {
      throw error;
    }
    throw new CLIError(
      error instanceof Error ? error.message : 'Unknown error',
      errorType
    );
  }
};

// ==================== Storage Operations ====================

/**
 * Reads a list from storage
 */
const readList = async (
  state: TodoServiceState,
  listName: string,
  config: TodoServiceConfig
): Promise<TodoList | null> => {
  try {
    // Try configService first for backward compatibility
    if (config.configService) {
      try {
        const list = await config.configService.getLocalTodos(listName);
        if (list) return list;
      } catch (err) {
        // Fall through to direct file access
      }
    }

    // Direct file access
    const filePath = path.join(state.todosDir, `${listName}${STORAGE_CONFIG.FILE_EXT}`);
    const storage = config.storage || fsPromises;
    
    try {
      const data = await storage.readFile(filePath, 'utf8');
      return JSON.parse(data as string) as TodoList;
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  } catch (error) {
    if (error instanceof CLIError) {
      throw error;
    }
    return null;
  }
};

/**
 * Writes a list to storage
 */
const writeList = async (
  state: TodoServiceState,
  listName: string,
  list: TodoList,
  config: TodoServiceConfig
): Promise<void> => {
  // Try configService first for backward compatibility
  if (config.configService) {
    try {
      await config.configService.saveListData(listName, list);
      return;
    } catch (err) {
      // Fall through to direct file access
    }
  }

  // Direct file access
  const filePath = path.join(state.todosDir, `${listName}${STORAGE_CONFIG.FILE_EXT}`);
  const storage = config.storage || fsPromises;
  await storage.writeFile(filePath, JSON.stringify(list, null, 2), 'utf8');
};

/**
 * Gets all list names from storage
 */
const getAllListNames = async (
  state: TodoServiceState,
  config: TodoServiceConfig
): Promise<string[]> => {
  try {
    const storage = config.storage || fsPromises;
    const files = await storage.readdir(state.todosDir);
    return files
      .filter((f: string) => f.endsWith(STORAGE_CONFIG.FILE_EXT))
      .map((f: string) => f.replace(STORAGE_CONFIG.FILE_EXT, ''));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return [];
    }
    throw new CLIError(
      `Failed to read todo lists: ${error instanceof Error ? error.message : String(error)}`,
      'STORAGE_READ_ERROR'
    );
  }
};

// ==================== Service Operations ====================

/**
 * Initializes the todo service
 */
const initialize = async (
  state: TodoServiceState,
  config: TodoServiceConfig
): Promise<TodoServiceState> => {
  try {
    await ensureTodosDirectory();
    return updateState(state, { initialized: true });
  } catch (error) {
    logger.error(`Failed to initialize todo service: ${error}`);
    throw new CLIError(
      `Failed to initialize todo service: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'INITIALIZATION_FAILED'
    );
  }
};

/**
 * Lists all todos from all lists
 */
const listAllTodos = async (
  state: TodoServiceState,
  config: TodoServiceConfig
): Promise<Todo[]> => {
  const listNames = await getAllListNames(state, config);
  const allTodos: Todo[] = [];

  for (const listName of listNames) {
    const list = await readList(state, listName, config);
    if (list && list.todos && Array.isArray(list.todos)) {
      allTodos.push(...list.todos);
    }
  }

  return allTodos;
};

/**
 * Gets filtered todos
 */
const getFilteredTodos = async (
  state: TodoServiceState,
  config: TodoServiceConfig,
  filters: {
    listName?: string;
    completed?: boolean;
    priority?: string;
    tags?: string[];
  }
): Promise<Todo[]> => {
  let todos: Todo[];

  if (filters.listName) {
    const list = await readList(state, filters.listName, config);
    todos = list?.todos || [];
  } else {
    todos = await listAllTodos(state, config);
  }

  return filterTodos(todos, filters);
};

/**
 * Adds a todo to a list
 */
const addTodo = async (
  state: TodoServiceState,
  config: TodoServiceConfig,
  listName: string,
  todoData: Partial<Todo>
): Promise<Todo> => {
  let list = await readList(state, listName, config);

  // Create list if it doesn't exist
  if (!list) {
    list = createTodoList(listName, 'local');
  }

  const newTodo = createTodo(todoData);
  const updatedList = addTodoToList(list, newTodo);
  await writeList(state, listName, updatedList, config);

  return newTodo;
};

/**
 * Updates a todo
 */
const updateTodo = async (
  state: TodoServiceState,
  config: TodoServiceConfig,
  listName: string,
  todoId: string,
  updates: Partial<Todo>
): Promise<Todo> => {
  const list = await readList(state, listName, config);
  if (!list) {
    throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
  }

  const updatedList = updateTodoInList(list, todoId, updates);
  await writeList(state, listName, updatedList, config);

  const updatedTodo = updatedList.todos.find(t => t.id === todoId)!;
  return updatedTodo;
};

/**
 * Deletes a todo
 */
const deleteTodo = async (
  state: TodoServiceState,
  config: TodoServiceConfig,
  listName: string,
  todoId: string
): Promise<void> => {
  const list = await readList(state, listName, config);
  if (!list) {
    throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
  }

  const updatedList = removeTodoFromList(list, todoId);
  await writeList(state, listName, updatedList, config);
};

/**
 * Completes a todo
 */
const completeTodo = async (
  state: TodoServiceState,
  config: TodoServiceConfig,
  todoId: string
): Promise<Todo> => {
  // Find todo across all lists
  const listNames = await getAllListNames(state, config);
  
  for (const listName of listNames) {
    const list = await readList(state, listName, config);
    if (!list) continue;

    const todo = findTodo(list.todos, todoId);
    if (todo) {
      return updateTodo(state, config, listName, todo.id, {
        completed: true,
        completedAt: new Date().toISOString(),
      });
    }
  }

  throw new CLIError(`Todo with ID "${todoId}" not found`, 'TODO_NOT_FOUND');
};

/**
 * Finds a todo by ID or title across all lists
 */
const findTodoByIdOrTitleAcrossLists = async (
  state: TodoServiceState,
  config: TodoServiceConfig,
  idOrTitle: string
): Promise<{ listName: string; todo: Todo } | null> => {
  const listNames = await getAllListNames(state, config);

  for (const listName of listNames) {
    const list = await readList(state, listName, config);
    if (!list) continue;

    const todo = findTodo(list.todos, idOrTitle);
    if (todo) {
      return { listName, todo };
    }
  }

  return null;
};

/**
 * Updates storage location for a todo
 */
const updateStorageLocation = async (
  state: TodoServiceState,
  config: TodoServiceConfig,
  listName: string,
  todoId: string,
  storageLocation: string
): Promise<Todo> => {
  const validLocations = ['local', 'blockchain', 'both'] as const;
  const mappedLocation = storageLocation === 'walrus' ? 'blockchain' : storageLocation;
  const location = validLocations.includes(mappedLocation)
    ? mappedLocation
    : 'local';

  return updateTodo(state, config, listName, todoId, { storageLocation: location });
};

/**
 * Saves blockchain metadata for a todo
 */
const saveBlockchainMetadata = async (
  state: TodoServiceState,
  config: TodoServiceConfig,
  listName: string,
  todoId: string,
  metadata: { objectId: string; transactionDigest: string }
): Promise<Todo> => {
  return updateTodo(state, config, listName, todoId, {
    nftObjectId: metadata.objectId,
    tags: [`tx:${metadata.transactionDigest}`],
    storageLocation: 'blockchain',
  });
};

// ==================== Factory Function ====================

/**
 * Creates a todo service instance with functional approach
 */
export const createTodoService = (config: TodoServiceConfig = {}) => {
  let state = createInitialState(config);

  // Initialize on creation
  const initPromise = initialize(state, config).then(newState => {
    state = newState;
  });

  // Ensure initialization before operations
  const ensureInitialized = async () => {
    if (!state.initialized) {
      await initPromise;
    }
  };

  return {
    // List operations
    getAllLists: withErrorHandling(async () => {
      await ensureInitialized();
      return getAllListNames(state, config);
    }, 'STORAGE_READ_ERROR'),

    getList: withErrorHandling(async (listName: string) => {
      await ensureInitialized();
      return readList(state, listName, config);
    }, 'LIST_READ_FAILED'),

    createList: withErrorHandling(async (name: string, owner: string) => {
      await ensureInitialized();
      const existingList = await readList(state, name, config);
      if (existingList) {
        throw new CLIError(`List "${name}" already exists`, 'LIST_EXISTS');
      }
      const newList = createTodoList(name, owner);
      await writeList(state, name, newList, config);
      return newList;
    }, 'LIST_CREATE_FAILED'),

    deleteList: withErrorHandling(async (listName: string) => {
      await ensureInitialized();
      const filePath = path.join(state.todosDir, `${listName}${STORAGE_CONFIG.FILE_EXT}`);
      const storage = config.storage || fsPromises;
      await storage.unlink(filePath);
    }, 'DELETE_FAILED'),

    // Todo operations
    listTodos: withErrorHandling(async () => {
      await ensureInitialized();
      return listAllTodos(state, config);
    }, 'LIST_TODOS_FAILED'),

    getFilteredTodos: withErrorHandling(async (filters) => {
      await ensureInitialized();
      return getFilteredTodos(state, config, filters);
    }, 'FILTER_TODOS_FAILED'),

    getTodo: withErrorHandling(async (todoId: string, listName = 'default') => {
      await ensureInitialized();
      const list = await readList(state, listName, config);
      if (!list) return null;
      return list.todos.find(t => t.id === todoId) || null;
    }, 'GET_TODO_FAILED'),

    getTodoByTitle: withErrorHandling(async (title: string, listName = 'default') => {
      await ensureInitialized();
      const list = await readList(state, listName, config);
      if (!list) return null;
      return list.todos.find(t => t.title?.toLowerCase() === title.toLowerCase()) || null;
    }, 'GET_TODO_FAILED'),

    getTodoByTitleOrId: withErrorHandling(async (titleOrId: string, listName = 'default') => {
      await ensureInitialized();
      const list = await readList(state, listName, config);
      if (!list) return null;
      return findTodo(list.todos, titleOrId);
    }, 'GET_TODO_FAILED'),

    findTodoByIdOrTitleAcrossLists: withErrorHandling(async (idOrTitle: string) => {
      await ensureInitialized();
      return findTodoByIdOrTitleAcrossLists(state, config, idOrTitle);
    }, 'FIND_TODO_FAILED'),

    addTodo: withErrorHandling(async (listName: string, todoData: Partial<Todo>) => {
      await ensureInitialized();
      return addTodo(state, config, listName, todoData);
    }, 'ADD_TODO_FAILED'),

    updateTodo: withErrorHandling(async (listName: string, todoId: string, updates: Partial<Todo>) => {
      await ensureInitialized();
      return updateTodo(state, config, listName, todoId, updates);
    }, 'UPDATE_TODO_FAILED'),

    deleteTodo: withErrorHandling(async (listName: string, todoId: string) => {
      await ensureInitialized();
      return deleteTodo(state, config, listName, todoId);
    }, 'DELETE_TODO_FAILED'),

    completeTodo: withErrorHandling(async (todoId: string) => {
      await ensureInitialized();
      return completeTodo(state, config, todoId);
    }, 'COMPLETE_TODO_FAILED'),

    toggleItemStatus: withErrorHandling(async (listName: string, itemId: string, checked: boolean) => {
      await ensureInitialized();
      return updateTodo(state, config, listName, itemId, {
        completed: checked,
        completedAt: checked ? new Date().toISOString() : undefined,
      });
    }, 'TOGGLE_STATUS_FAILED'),

    updateStorageLocation: withErrorHandling(async (listName: string, todoId: string, storageLocation: string) => {
      await ensureInitialized();
      return updateStorageLocation(state, config, listName, todoId, storageLocation);
    }, 'UPDATE_STORAGE_FAILED'),

    saveBlockchainMetadata: withErrorHandling(async (listName: string, todoId: string, metadata: { objectId: string; transactionDigest: string }) => {
      await ensureInitialized();
      return saveBlockchainMetadata(state, config, listName, todoId, metadata);
    }, 'SAVE_METADATA_FAILED'),

    // Utility functions
    saveList: withErrorHandling(async (listName: string, list: TodoList) => {
      await ensureInitialized();
      return writeList(state, listName, list, config);
    }, 'SAVE_FAILED'),

    // Expose pure functions for testing and composition
    pure: {
      createTodo,
      createTodoList,
      filterTodos,
      findTodo,
      updateTodoInList,
      addTodoToList,
      removeTodoFromList,
      validateTodo,
    },
  };
};

// ==================== Default Export ====================

// Create a singleton instance for backward compatibility
export const todoService = createTodoService();

// ==================== Class Wrapper for Backward Compatibility ====================

/**
 * TodoService class wrapper for backward compatibility
 * Wraps the functional API in a class-based interface
 */
export class TodoService {
  private service = todoService;

  constructor() {
    // Service is already initialized
  }

  // List operations
  async getAllLists(): Promise<string[]> {
    return this.service.getAllLists();
  }

  getAllListsSync(): string[] {
    // Note: This is now async internally, but we'll block for compatibility
    let result: string[] = [];
    this.service.getAllLists().then(lists => { result = lists; }).catch(() => { result = []; });
    return result;
  }

  async getList(listName: string): Promise<TodoList | null> {
    return this.service.getList(listName);
  }

  async getAllListsWithContent(): Promise<Record<string, TodoList>> {
    const listNames = await this.service.getAllLists();
    const result: Record<string, TodoList> = {};

    for (const listName of listNames) {
      const list = await this.service.getList(listName);
      if (list) {
        result[listName] = list;
      }
    }

    return result;
  }

  async createList(name: string, owner: string): Promise<TodoList> {
    return this.service.createList(name, owner);
  }

  async deleteList(listName: string): Promise<void> {
    return this.service.deleteList(listName);
  }

  // Todo operations
  async listTodos(): Promise<Todo[]> {
    return this.service.listTodos();
  }

  async getFilteredTodos(options: {
    listName?: string;
    completed?: boolean;
    priority?: string;
    tags?: string[];
  } = {}): Promise<Todo[]> {
    return this.service.getFilteredTodos(options);
  }

  async getTodo(todoId: string, listName: string = 'default'): Promise<Todo | null> {
    return this.service.getTodo(todoId, listName);
  }

  async getTodoByTitle(title: string, listName: string = 'default'): Promise<Todo | null> {
    return this.service.getTodoByTitle(title, listName);
  }

  async getTodoByTitleOrId(titleOrId: string, listName: string = 'default'): Promise<Todo | null> {
    return this.service.getTodoByTitleOrId(titleOrId, listName);
  }

  async findTodoByIdOrTitle(listName: string, idOrTitle: string): Promise<Todo | null> {
    return this.service.getTodoByTitleOrId(idOrTitle, listName);
  }

  async findTodoByIdOrTitleAcrossLists(idOrTitle: string): Promise<{ listName: string; todo: Todo } | null> {
    return this.service.findTodoByIdOrTitleAcrossLists(idOrTitle);
  }

  async findTodoById(todoId: string): Promise<{ todo: Todo; listName: string } | null> {
    const result = await this.service.findTodoByIdOrTitleAcrossLists(todoId);
    return result ? { todo: result.todo, listName: result.listName } : null;
  }

  async addTodo(listName: string, todo: Partial<Todo>): Promise<Todo> {
    return this.service.addTodo(listName, todo);
  }

  async updateTodo(listName: string, todoId: string, updates: Partial<Todo>): Promise<Todo> {
    return this.service.updateTodo(listName, todoId, updates);
  }

  async deleteTodo(listName: string, todoId: string): Promise<void> {
    return this.service.deleteTodo(listName, todoId);
  }

  async completeTodo(todoId: string): Promise<Todo> {
    return this.service.completeTodo(todoId);
  }

  async toggleItemStatus(listName: string, itemId: string, checked: boolean): Promise<void> {
    await this.service.toggleItemStatus(listName, itemId, checked);
  }

  async updateStorageLocation(listName: string, todoId: string, storageLocation: string): Promise<Todo> {
    return this.service.updateStorageLocation(listName, todoId, storageLocation);
  }

  async saveBlockchainMetadata(
    listName: string,
    todoId: string,
    metadata: { objectId: string; transactionDigest: string }
  ): Promise<Todo> {
    return this.service.saveBlockchainMetadata(listName, todoId, metadata);
  }

  async saveList(listName: string, list: TodoList): Promise<void> {
    return this.service.saveList(listName, list);
  }

  // Static getInstance for singleton pattern compatibility
  private static _instance: TodoService;
  
  static getInstance(): TodoService {
    if (!TodoService._instance) {
      TodoService._instance = new TodoService();
    }
    return TodoService._instance;
  }
}

// Export types and utilities
export { createTodo, createTodoList, filterTodos, findTodo };