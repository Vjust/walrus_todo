import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { Todo, TodoList } from '../types/todo';
import { STORAGE_CONFIG } from '../constants';
import { generateId } from '../utils/id-generator';
import { CLIError } from '../types/error';

/**
 * TodoService - A service class for managing Todo lists and items locally.
 * 
 * This class provides a comprehensive set of methods to handle Todo data, including creating and
 * managing Todo lists, adding, updating, and deleting individual Todo items. It uses the local
 * file system to store Todo data persistently, making it suitable for a CLI-based Todo management
 * application. Key features include list and item retrieval by various criteria, status toggling,
 * and error handling for common scenarios like missing lists or items.
 * 
 * @class TodoService
 */
export class TodoService {
  /**
   * Directory path where todo list files are stored
   * @private
   */
  private readonly todosDir: string = path.join(process.cwd(), STORAGE_CONFIG.TODOS_DIR);

  /**
   * Initializes a new instance of TodoService and ensures the todos directory exists
   */
  constructor() {
    fsPromises.mkdir(this.todosDir, { recursive: true }).catch(() => {/* ignore */});
  }

  /**
   * Retrieves all available todo list names from the storage directory
   * 
   * @returns {Promise<string[]>} Array of todo list names without file extensions
   */
  async getAllLists(): Promise<string[]> {
    try {
      const files = await fsPromises.readdir(this.todosDir);
      return files
        .filter(f => f.endsWith(STORAGE_CONFIG.FILE_EXT))
        .map(f => f.replace(STORAGE_CONFIG.FILE_EXT, ''));
    } catch (error) {
      // If directory doesn't exist, return empty array but log the error
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      // For other errors, throw them up
      throw new CLIError(
        `Failed to read todo lists: ${error instanceof Error ? error.message : String(error)}`,
        'STORAGE_READ_ERROR'
      );
    }
  }

  /**
   * Synchronously retrieves all available todo list names from the storage directory
   * 
   * @returns {string[]} Array of todo list names without file extensions
   */
  getAllListsSync(): string[] {
    try {
      const files = fs.readdirSync(this.todosDir);
      return files
        .filter(f => f.endsWith(STORAGE_CONFIG.FILE_EXT))
        .map(f => f.replace(STORAGE_CONFIG.FILE_EXT, ''));
    } catch (error) {
      // If directory doesn't exist, return empty array but log the error
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      // For other errors, throw them up
      throw new CLIError(
        `Failed to read todo lists: ${error instanceof Error ? error.message : String(error)}`,
        'STORAGE_READ_ERROR'
      );
    }
  }

  /**
   * Lists all todos from all available todo lists
   * 
   * @returns {Promise<Todo[]>} Aggregated array of todos from all lists
   */
  async listTodos(): Promise<Todo[]> {
    const lists = await this.getAllLists();
    const allTodos: Todo[] = [];

    for (const listName of lists) {
      const list = await this.getList(listName);
      if (list && list.todos && Array.isArray(list.todos)) {
        allTodos.push(...list.todos);
      }
    }

    return allTodos;
  }

  /**
   * Creates a new todo list with the specified name and owner
   * 
   * @param {string} name - Name of the new todo list
   * @param {string} owner - Owner identifier for the list
   * @returns {Promise<TodoList>} The newly created todo list
   * @throws {CLIError} If a list with the given name already exists
   */
  async createList(name: string, owner: string): Promise<TodoList> {
    const existingList = await this.getList(name);
    if (existingList) {
      throw new CLIError(`List "${name}" already exists`, 'LIST_EXISTS');
    }

    // Initialize new list with metadata
    const newList: TodoList = {
      id: generateId(),
      name,
      owner,
      todos: [],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.saveList(name, newList);
    return newList;
  }

  /**
   * Retrieves a todo list by name
   * 
   * @param {string} listName - Name of the todo list to retrieve
   * @returns {Promise<TodoList | null>} The todo list if found, null otherwise
   */
  async getList(listName: string): Promise<TodoList | null> {
    try {
      const data = await fsPromises.readFile(
        path.join(this.todosDir, `${listName}${STORAGE_CONFIG.FILE_EXT}`),
        'utf8'
      );
      return JSON.parse(data) as TodoList;
    } catch (err) {
      // Return null instead of throwing if list doesn't exist
      return null;
    }
  }

  /**
   * Gets a todo item by its ID from a specified list
   * 
   * @param {string} todoId - ID of the todo to retrieve
   * @param {string} [listName='default'] - Name of the list containing the todo
   * @returns {Promise<Todo | null>} The todo if found, null otherwise
   */
  async getTodo(todoId: string, listName: string = 'default'): Promise<Todo | null> {
    const list = await this.getList(listName);
    if (!list) return null;
    return list.todos.find(t => t.id === todoId) || null;
  }

  /**
   * Gets a todo item by its title from a specified list (case-insensitive match)
   * 
   * @param {string} title - Title of the todo to retrieve
   * @param {string} [listName='default'] - Name of the list containing the todo
   * @returns {Promise<Todo | null>} The todo if found, null otherwise
   */
  async getTodoByTitle(title: string, listName: string = 'default'): Promise<Todo | null> {
    const list = await this.getList(listName);
    if (!list) return null;
    // Find todo with exact title match (case-insensitive)
    return list.todos.find(t => t.title.toLowerCase() === title.toLowerCase()) || null;
  }

  /**
   * Gets a todo item by either its ID or title from a specified list
   * Attempts to find by ID first, then falls back to finding by title
   * 
   * @param {string} titleOrId - ID or title of the todo to retrieve
   * @param {string} [listName='default'] - Name of the list containing the todo
   * @returns {Promise<Todo | null>} The todo if found, null otherwise
   */
  async getTodoByTitleOrId(titleOrId: string, listName: string = 'default'): Promise<Todo | null> {
    // First try to find by ID (for backward compatibility)
    const todoById = await this.getTodo(titleOrId, listName);
    if (todoById) return todoById;
    
    // If not found by ID, try to find by title
    return this.getTodoByTitle(titleOrId, listName);
  }

  /**
   * Adds a new todo to a specified list
   * 
   * @param {string} listName - Name of the list to add the todo to
   * @param {Partial<Todo>} todo - Todo data (partial, missing fields will be set to defaults)
   * @returns {Promise<Todo>} The newly created todo with complete data
   * @throws {CLIError} If the specified list doesn't exist
   */
  async addTodo(listName: string, todo: Partial<Todo>): Promise<Todo> {
    const list = await this.getList(listName);
    if (!list) {
      throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
    }

    // Create a complete todo from the partial input
    const newTodo: Todo = {
      id: generateId(),
      title: todo.title || '',
      description: todo.description || '',
      completed: false,
      priority: todo.priority || 'medium',
      tags: todo.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      private: todo.private !== undefined ? todo.private : true,
      storageLocation: todo.storageLocation || 'local'
    };

    // Add to list and persist changes
    list.todos.push(newTodo);
    list.updatedAt = new Date().toISOString();
    await this.saveList(listName, list);
    return newTodo;
  }

  /**
   * Updates an existing todo in a specified list
   * 
   * @param {string} listName - Name of the list containing the todo
   * @param {string} todoId - ID of the todo to update
   * @param {Partial<Todo>} updates - Partial todo data with fields to update
   * @returns {Promise<Todo>} The updated todo with complete data
   * @throws {CLIError} If the list or todo doesn't exist
   */
  async updateTodo(listName: string, todoId: string, updates: Partial<Todo>): Promise<Todo> {
    const list = await this.getList(listName);
    if (!list) {
      throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
    }

    const todoIndex = list.todos.findIndex(t => t.id === todoId);
    if (todoIndex === -1) {
      throw new CLIError(`Todo "${todoId}" not found in list "${listName}"`, 'TODO_NOT_FOUND');
    }

    // Create updated todo by merging existing data with updates
    const todo = list.todos[todoIndex];
    const updatedTodo: Todo = {
      ...todo,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // Update in list and persist changes
    list.todos[todoIndex] = updatedTodo;
    list.updatedAt = new Date().toISOString();
    await this.saveList(listName, list);
    return updatedTodo;
  }

  /**
   * Toggles the completion status of a todo item
   * 
   * @param {string} listName - Name of the list containing the todo
   * @param {string} itemId - ID of the todo to toggle status
   * @param {boolean} checked - New completion status (true = completed, false = not completed)
   * @returns {Promise<void>}
   */
  async toggleItemStatus(listName: string, itemId: string, checked: boolean): Promise<void> {
    await this.updateTodo(listName, itemId, {
      completed: checked,
      completedAt: checked ? new Date().toISOString() : undefined
    });
  }

  /**
   * Deletes a todo from a specified list
   * 
   * @param {string} listName - Name of the list containing the todo
   * @param {string} todoId - ID of the todo to delete
   * @returns {Promise<void>}
   * @throws {CLIError} If the list or todo doesn't exist
   */
  async deleteTodo(listName: string, todoId: string): Promise<void> {
    const list = await this.getList(listName);
    if (!list) {
      throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
    }

    const todoIndex = list.todos.findIndex(t => t.id === todoId);
    if (todoIndex === -1) {
      throw new CLIError(`Todo "${todoId}" not found in list "${listName}"`, 'TODO_NOT_FOUND');
    }

    // Remove todo from list and persist changes
    list.todos.splice(todoIndex, 1);
    list.updatedAt = new Date().toISOString();
    await this.saveList(listName, list);
  }

  /**
   * Saves a todo list to persistent storage
   * 
   * @param {string} listName - Name of the list to save
   * @param {TodoList} list - Todo list data to save
   * @returns {Promise<void>}
   * @throws {CLIError} If saving fails due to file system errors
   */
  async saveList(listName: string, list: TodoList): Promise<void> {
    const file = path.join(this.todosDir, `${listName}${STORAGE_CONFIG.FILE_EXT}`);
    try {
      await fsPromises.writeFile(file, JSON.stringify(list, null, 2), 'utf8');
    } catch (err) {
      throw new CLIError(
        `Failed to save list "${listName}": ${err instanceof Error ? err.message : 'Unknown error'}`,
        'SAVE_FAILED'
      );
    }
  }

  /**
   * Deletes a todo list from persistent storage
   * 
   * @param {string} listName - Name of the list to delete
   * @returns {Promise<void>}
   * @throws {CLIError} If deletion fails due to file system errors
   */
  async deleteList(listName: string): Promise<void> {
    const file = path.join(this.todosDir, `${listName}${STORAGE_CONFIG.FILE_EXT}`);
    try {
      if (fs.existsSync(file)) {
        await fsPromises.unlink(file);
      }
    } catch (err) {
      throw new CLIError(
        `Failed to delete list "${listName}": ${err instanceof Error ? err.message : 'Unknown error'}`,
        'DELETE_FAILED'
      );
    }
  }

  /**
   * Finds a todo by ID or title in a specified list
   * 
   * @param {string} listName - Name of the list to search
   * @param {string} idOrTitle - ID or title of the todo to find
   * @returns {Promise<Todo | null>} The found todo or null if not found
   * @throws {CLIError} If the list doesn't exist
   */
  async findTodoByIdOrTitle(listName: string, idOrTitle: string): Promise<Todo | null> {
    const list = await this.getList(listName);
    if (!list) {
      throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
    }

    // Try to find by ID first, then by title
    const todo = list.todos.find(t => t.id === idOrTitle) || 
                  list.todos.find(t => t.title.toLowerCase() === idOrTitle.toLowerCase());
    
    return todo || null;
  }
}