import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { Todo, TodoList } from '../types/todo';
import { STORAGE_CONFIG } from '../constants';
import { generateId } from '../utils/id-generator';
import { CLIError } from '../types/error';

export class TodoService {
  private readonly todosDir: string = path.join(process.cwd(), STORAGE_CONFIG.TODOS_DIR);

  constructor() {
    fsPromises.mkdir(this.todosDir, { recursive: true }).catch(() => {/* ignore */});
  }

  async getAllLists(): Promise<string[]> {
    const files = await fsPromises.readdir(this.todosDir).catch(() => []);
    return files
      .filter(f => f.endsWith(STORAGE_CONFIG.FILE_EXT))
      .map(f => f.replace(STORAGE_CONFIG.FILE_EXT, ''));
  }

  async createList(name: string, owner: string): Promise<TodoList> {
    const existingList = await this.getList(name);
    if (existingList) {
      throw new CLIError(`List "${name}" already exists`, 'LIST_EXISTS');
    }

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

  async getList(listName: string): Promise<TodoList | null> {
    try {
      const data = await fsPromises.readFile(
        path.join(this.todosDir, `${listName}${STORAGE_CONFIG.FILE_EXT}`),
        'utf8'
      );
      return JSON.parse(data) as TodoList;
    } catch (err) {
      return null;
    }
  }

  async getTodo(todoId: string, listName: string = 'default'): Promise<Todo | null> {
    const list = await this.getList(listName);
    if (!list) return null;
    return list.todos.find(t => t.id === todoId) || null;
  }

  async addTodo(listName: string, todo: Partial<Todo>): Promise<Todo> {
    const list = await this.getList(listName);
    if (!list) {
      throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
    }

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

    list.todos.push(newTodo);
    list.updatedAt = new Date().toISOString();
    await this.saveList(listName, list);
    return newTodo;
  }

  async updateTodo(listName: string, todoId: string, updates: Partial<Todo>): Promise<Todo> {
    const list = await this.getList(listName);
    if (!list) {
      throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
    }

    const todoIndex = list.todos.findIndex(t => t.id === todoId);
    if (todoIndex === -1) {
      throw new CLIError(`Todo "${todoId}" not found in list "${listName}"`, 'TODO_NOT_FOUND');
    }

    const todo = list.todos[todoIndex];
    const updatedTodo: Todo = {
      ...todo,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    list.todos[todoIndex] = updatedTodo;
    list.updatedAt = new Date().toISOString();
    await this.saveList(listName, list);
    return updatedTodo;
  }

  async toggleItemStatus(listName: string, itemId: string, checked: boolean): Promise<void> {
    await this.updateTodo(listName, itemId, {
      completed: checked,
      completedAt: checked ? new Date().toISOString() : undefined
    });
  }

  async deleteTodo(listName: string, todoId: string): Promise<void> {
    const list = await this.getList(listName);
    if (!list) {
      throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
    }

    const todoIndex = list.todos.findIndex(t => t.id === todoId);
    if (todoIndex === -1) {
      throw new CLIError(`Todo "${todoId}" not found in list "${listName}"`, 'TODO_NOT_FOUND');
    }

    list.todos.splice(todoIndex, 1);
    list.updatedAt = new Date().toISOString();
    await this.saveList(listName, list);
  }

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
}
