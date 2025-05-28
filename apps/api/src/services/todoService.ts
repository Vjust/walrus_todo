import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Todo, CreateTodoRequest, UpdateTodoRequest } from '../types';
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
    } catch {
      await fs.mkdir(this.dataPath, { recursive: true });
      logger.info('Created todo data directory', { path: this.dataPath });
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
      const parsed = JSON.parse(data);
      
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
          count: todos.length
        }
      };
      
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      logger.debug('Wrote wallet todos', { wallet, count: todos.length });
    } catch (error) {
      logger.error('Error writing wallet todos', { wallet, error });
      throw new ApiError('Failed to save todos', 500);
    }
  }

  async getTodos(wallet: string, options: { 
    page?: number; 
    limit?: number; 
    category?: string;
    completed?: boolean;
  } = {}): Promise<{ todos: Todo[]; total: number }> {
    const allTodos = await this.readWalletTodos(wallet);
    
    // Filter todos
    let filteredTodos = allTodos.filter(todo => todo.wallet === wallet);
    
    if (options.category) {
      filteredTodos = filteredTodos.filter(todo => todo.category === options.category);
    }
    
    if (options.completed !== undefined) {
      filteredTodos = filteredTodos.filter(todo => todo.completed === options.completed);
    }
    
    const total = filteredTodos.length;
    
    // Apply pagination
    if (options.page && options.limit) {
      const startIndex = (options.page - 1) * options.limit;
      filteredTodos = filteredTodos.slice(startIndex, startIndex + options.limit);
    }
    
    return { todos: filteredTodos, total };
  }

  async getTodoById(id: string, wallet: string): Promise<Todo | null> {
    const todos = await this.readWalletTodos(wallet);
    return todos.find(todo => todo.id === id && todo.wallet === wallet) || null;
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
      title: data.content, // Map content to title for compatibility
      content: data.content,
      completed: false,
      priority: data.priority || 'medium',
      category: data.category,
      tags: data.tags || [],
      createdAt: now,
      updatedAt: now,
      wallet
    };
    
    todos.push(newTodo);
    await this.writeWalletTodos(wallet, todos);
    
    logger.info('Todo created', { id: newTodo.id, wallet });
    return newTodo;
  }

  async updateTodo(id: string, data: UpdateTodoRequest, wallet: string): Promise<Todo> {
    const todos = await this.readWalletTodos(wallet);
    const todoIndex = todos.findIndex(todo => todo.id === id && todo.wallet === wallet);
    
    if (todoIndex === -1) {
      throw new ApiError('Todo not found', 404, 'TODO_NOT_FOUND');
    }
    
    const updatedTodo: Todo = {
      ...todos[todoIndex],
      ...data,
      ...(data.content && { title: data.content }), // Sync title with content
      updatedAt: new Date().toISOString()
    };
    
    todos[todoIndex] = updatedTodo;
    await this.writeWalletTodos(wallet, todos);
    
    logger.info('Todo updated', { id, wallet });
    return updatedTodo;
  }

  async deleteTodo(id: string, wallet: string): Promise<Todo> {
    const todos = await this.readWalletTodos(wallet);
    const todoIndex = todos.findIndex(todo => todo.id === id && todo.wallet === wallet);
    
    if (todoIndex === -1) {
      throw new ApiError('Todo not found', 404, 'TODO_NOT_FOUND');
    }
    
    const deletedTodo = todos[todoIndex];
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
      byCategory: {} as Record<string, number>
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
}