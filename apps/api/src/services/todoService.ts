import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Todo, CreateTodoRequest, UpdateTodoRequest, TodoListMetadata, TodoListInfo } from '../types';
import { config } from '../config';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/error';

export class TodoService {
  private dataPath: string;

  constructor() {
    this.dataPath = path.resolve(__dirname, config.todo.dataPath);
    this.ensureDataDirectory();
  }

  private async ensureDataDirectory(): Promise<void> {
    try {
      await fs.access(this.dataPath);
      logger.info('Using todo data directory', { path: this.dataPath });
    } catch (error) {
      // Try to create the directory if it doesn't exist
      try {
        await fs.mkdir(this.dataPath, { recursive: true });
        logger.info('Created todo data directory', { path: this.dataPath });
      } catch (mkdirError) {
        logger.error('Failed to create data directory', { path: this.dataPath, error: mkdirError });
        throw new ApiError('Failed to initialize data directory', 500);
      }
    }
  }

  private getWalletFileName(wallet: string): string {
    // Use wallet address as filename with .json extension
    return `${wallet}.json`;
  }

  private async readWalletTodos(wallet: string): Promise<Todo[]> {
    try {
      const filePath = path.join(this.dataPath, this.getWalletFileName(wallet));
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data.toString());

      // Handle both array format and object format
      if (Array.isArray(parsed)) {
        return parsed;
      } else if (parsed.todos && Array.isArray(parsed.todos)) {
        return parsed.todos;
      } else if (parsed.items && Array.isArray(parsed.items)) {
        return parsed.items;
      }

      return [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []; // File doesn't exist, return empty array
      }
      logger.error('Error reading wallet todos', { wallet, error });
      throw new ApiError('Failed to read todos', 500);
    }
  }

  private async writeWalletTodos(wallet: string, todos: Todo[]): Promise<void> {
    try {
      const filePath = path.join(this.dataPath, this.getWalletFileName(wallet));

      // Use the same format as the CLI (object with todos array)
      const data = {
        todos,
        metadata: {
          version: '1.0.0',
          lastModified: new Date().toISOString(),
          wallet,
          count: todos.length,
        },
      };

      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      logger.debug('Wrote wallet todos', { wallet, count: todos.length });
    } catch (error) {
      logger.error('Error writing wallet todos', { wallet, error });
      throw new ApiError('Failed to save todos', 500);
    }
  }

  async getTodos(
    wallet: string,
    options: {
      page?: number;
      limit?: number;
      category?: string;
      completed?: boolean;
    } = {}
  ): Promise<{ todos: Todo[]; total: number }> {
    const allTodos = await this.readWalletTodos(wallet);

    // Filter todos
    let filteredTodos = allTodos.filter(todo => todo.wallet === wallet);

    if (options.category) {
      filteredTodos = filteredTodos.filter(
        todo => todo.category === options.category
      );
    }

    if (options.completed !== undefined) {
      filteredTodos = filteredTodos.filter(
        todo => todo.completed === options.completed
      );
    }

    const total = filteredTodos.length;

    // Apply pagination
    if (options.page && options.limit) {
      const startIndex = (options.page - 1) * options.limit;
      filteredTodos = filteredTodos.slice(
        startIndex,
        startIndex + options.limit
      );
    }

    return { todos: filteredTodos, total };
  }

  async getTodoById(id: string, wallet: string): Promise<Todo | null> {
    const todos = await this.readWalletTodos(wallet);
    return todos.find(todo => todo.id === id && todo.wallet === wallet) || null;
  }

  // Alias for getTodoById to maintain compatibility
  async getTodo(id: string, wallet: string): Promise<Todo | null> {
    return this.getTodoById(id, wallet);
  }

  // Method for listing todos with pagination (used by AI and sync controllers)
  async listTodos(
    filters: { wallet: string; category?: string; completed?: boolean },
    page: number = 1,
    limit: number = 10
  ): Promise<{ data: Todo[]; total: number; page: number; limit: number }> {
    const { todos, total } = await this.getTodos(filters.wallet, {
      page,
      limit,
      category: filters.category,
      completed: filters.completed,
    });

    return {
      data: todos,
      total,
      page,
      limit,
    };
  }

  async createTodo(data: CreateTodoRequest, wallet: string): Promise<Todo> {
    const todos = await this.readWalletTodos(wallet);

    // Check wallet todo limit
    if (todos.length >= config.todo.maxTodosPerWallet) {
      throw new ApiError(
        `Maximum number of todos (${config.todo.maxTodosPerWallet}) reached for wallet`,
        400,
        'MAX_TODOS_EXCEEDED'
      );
    }

    const now = new Date().toISOString();
    const newTodo: Todo = {
      id: uuidv4(),
      title: data.description, // Map description to title for compatibility
      description: data.description,
      completed: false,
      priority: data.priority || 'medium',
      category: data.category,
      tags: data.tags || [],
      createdAt: now,
      updatedAt: now,
      wallet,
      listName: data.listName,
    };

    todos.push(newTodo);
    await this.writeWalletTodos(wallet, todos);

    logger.info('Todo created', { id: newTodo.id, wallet });
    return newTodo;
  }

  async updateTodo(
    id: string,
    data: UpdateTodoRequest,
    wallet: string
  ): Promise<Todo> {
    const todos = await this.readWalletTodos(wallet);
    const todoIndex = todos.findIndex(
      todo => todo.id === id && todo.wallet === wallet
    );

    if (todoIndex === -1) {
      throw new ApiError('Todo not found', 404, 'TODO_NOT_FOUND');
    }

    const existingTodo = todos[todoIndex];
    if (!existingTodo) {
      throw new ApiError('Todo not found', 404, 'TODO_NOT_FOUND');
    }

    const updatedTodo: Todo = {
      ...existingTodo,
      ...data,
      ...(data.description && { title: data.description }), // Sync title with description
      updatedAt: new Date().toISOString(),
      wallet: existingTodo.wallet, // Ensure wallet is preserved
      id: existingTodo.id, // Ensure id is preserved
      title: data.description || existingTodo.title, // Ensure title is always defined
      description: data.description || existingTodo.description, // Ensure description is always defined
      completed:
        data.completed !== undefined ? data.completed : existingTodo.completed,
      createdAt: existingTodo.createdAt, // Ensure createdAt is preserved
    };

    todos[todoIndex] = updatedTodo;
    await this.writeWalletTodos(wallet, todos);

    logger.info('Todo updated', { id, wallet });
    return updatedTodo;
  }

  async deleteTodo(id: string, wallet: string): Promise<Todo> {
    const todos = await this.readWalletTodos(wallet);
    const todoIndex = todos.findIndex(
      todo => todo.id === id && todo.wallet === wallet
    );

    if (todoIndex === -1) {
      throw new ApiError('Todo not found', 404, 'TODO_NOT_FOUND');
    }

    const deletedTodo = todos[todoIndex];
    if (!deletedTodo) {
      throw new ApiError('Todo not found', 404, 'TODO_NOT_FOUND');
    }

    todos.splice(todoIndex, 1);
    await this.writeWalletTodos(wallet, todos);

    logger.info('Todo deleted', { id, wallet });
    return deletedTodo;
  }

  async completeTodo(id: string, wallet: string): Promise<Todo> {
    return this.updateTodo(id, { completed: true }, wallet);
  }

  async getCategories(wallet: string): Promise<string[]> {
    const todos = await this.readWalletTodos(wallet);
    const categories = new Set<string>();

    todos
      .filter(todo => todo.wallet === wallet && todo.category)
      .forEach(todo => categories.add(todo.category!));

    return Array.from(categories).sort();
  }

  async getTags(wallet: string): Promise<string[]> {
    const todos = await this.readWalletTodos(wallet);
    const tags = new Set<string>();

    todos
      .filter(todo => todo.wallet === wallet)
      .forEach(todo => {
        if (todo.tags) {
          todo.tags.forEach(tag => tags.add(tag));
        }
      });

    return Array.from(tags).sort();
  }

  async getStats(wallet: string): Promise<{
    total: number;
    completed: number;
    pending: number;
    byPriority: Record<string, number>;
    byCategory: Record<string, number>;
  }> {
    const todos = await this.readWalletTodos(wallet);
    const walletTodos = todos.filter(todo => todo.wallet === wallet);

    const stats = {
      total: walletTodos.length,
      completed: walletTodos.filter(todo => todo.completed).length,
      pending: walletTodos.filter(todo => !todo.completed).length,
      byPriority: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
    };

    walletTodos.forEach(todo => {
      // Count by priority
      const priority = todo.priority || 'medium';
      stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;

      // Count by category
      const category = todo.category || 'uncategorized';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    });

    return stats;
  }

  // List management methods

  async getLists(wallet: string): Promise<TodoListMetadata[]> {
    try {
      const filePath = path.join(this.dataPath, this.getWalletFileName(wallet));
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data.toString());

      // Extract unique list names from todos
      const listMap = new Map<string, TodoListMetadata>();
      const todos = Array.isArray(parsed) ? parsed : (parsed.todos || parsed.items || []);

      // Group todos by listName
      todos.forEach((todo: Todo) => {
        if (todo.listName && todo.wallet === wallet) {
          if (!listMap.has(todo.listName)) {
            listMap.set(todo.listName, {
              name: todo.listName,
              todoCount: 0,
              createdAt: todo.createdAt,
              updatedAt: todo.updatedAt,
            });
          }
          const list = listMap.get(todo.listName)!;
          list.todoCount++;
          // Update timestamps to reflect the most recent todo
          if (todo.updatedAt > list.updatedAt) {
            list.updatedAt = todo.updatedAt;
          }
          if (todo.createdAt < list.createdAt) {
            list.createdAt = todo.createdAt;
          }
        }
      });

      // Also check for any list metadata stored separately
      const listsFilePath = path.join(this.dataPath, `${wallet}-lists.json`);
      try {
        const listsData = await fs.readFile(listsFilePath, 'utf-8');
        const listsMetadata = JSON.parse(listsData.toString());
        if (Array.isArray(listsMetadata)) {
          listsMetadata.forEach((listMeta: TodoListMetadata) => {
            if (!listMap.has(listMeta.name)) {
              listMap.set(listMeta.name, listMeta);
            } else {
              // Merge with existing data, preferring stored metadata
              const existing = listMap.get(listMeta.name)!;
              listMap.set(listMeta.name, {
                ...existing,
                ...listMeta,
                todoCount: existing.todoCount, // Keep actual count
              });
            }
          });
        }
      } catch (error) {
        // Lists metadata file doesn't exist yet, that's ok
        logger.debug('No lists metadata file found', { wallet });
      }

      return Array.from(listMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []; // No data for this wallet yet
      }
      logger.error('Error reading lists', { wallet, error });
      throw new ApiError('Failed to read lists', 500);
    }
  }

  async createList(wallet: string, name: string, description?: string): Promise<TodoListInfo> {
    // Validate list name doesn't already exist
    const existingLists = await this.getLists(wallet);
    if (existingLists.some(list => list.name === name)) {
      throw new ApiError(`List "${name}" already exists`, 400, 'LIST_EXISTS');
    }

    const now = new Date().toISOString();
    const listMetadata: TodoListMetadata = {
      name,
      description,
      todoCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    // Save list metadata
    const listsFilePath = path.join(this.dataPath, `${wallet}-lists.json`);
    let lists: TodoListMetadata[] = [];
    
    try {
      const existingData = await fs.readFile(listsFilePath, 'utf-8');
      lists = JSON.parse(existingData.toString());
      if (!Array.isArray(lists)) {
        lists = [];
      }
    } catch (error) {
      // File doesn't exist yet
      logger.debug('Creating new lists metadata file', { wallet });
    }

    lists.push(listMetadata);
    await fs.writeFile(listsFilePath, JSON.stringify(lists, null, 2));

    logger.info('List created', { wallet, name });
    return {
      name: listMetadata.name,
      description: listMetadata.description,
      todoCount: listMetadata.todoCount,
      todos: [],
      createdAt: listMetadata.createdAt,
      updatedAt: listMetadata.updatedAt,
    };
  }

  async deleteList(wallet: string, name: string): Promise<TodoListInfo> {
    // Get all todos for this wallet
    const todos = await this.readWalletTodos(wallet);
    
    // Find todos in this list
    const listTodos = todos.filter(todo => todo.listName === name && todo.wallet === wallet);
    if (listTodos.length === 0) {
      // Check if the list exists in metadata
      const lists = await this.getLists(wallet);
      const listExists = lists.some(list => list.name === name);
      if (!listExists) {
        throw new ApiError(`List "${name}" not found`, 404, 'LIST_NOT_FOUND');
      }
    }

    // Remove all todos in this list
    const remainingTodos = todos.filter(todo => !(todo.listName === name && todo.wallet === wallet));
    await this.writeWalletTodos(wallet, remainingTodos);

    // Remove list metadata
    const listsFilePath = path.join(this.dataPath, `${wallet}-lists.json`);
    try {
      const existingData = await fs.readFile(listsFilePath, 'utf-8');
      let lists = JSON.parse(existingData.toString());
      if (Array.isArray(lists)) {
        lists = lists.filter((list: TodoListMetadata) => list.name !== name);
        await fs.writeFile(listsFilePath, JSON.stringify(lists, null, 2));
      }
    } catch (error) {
      // Lists metadata file doesn't exist, ignore
      logger.debug('No lists metadata to update', { wallet });
    }

    logger.info('List deleted', { wallet, name, todosDeleted: listTodos.length });
    
    // Return the deleted list info
    const listMetadata = await this.getLists(wallet);
    const deletedList = listMetadata.find(list => list.name === name);
    
    return {
      name,
      description: deletedList?.description,
      todoCount: listTodos.length,
      todos: listTodos,
      createdAt: deletedList?.createdAt || listTodos[0]?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}
