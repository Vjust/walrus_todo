import { Todo, TodoList } from '../types';
import { configService } from './config-service';
import { generateId } from '../utils/id-generator';
import { CLIError } from '../types/error';

export class TodoService {
  async createList(name: string, owner: string): Promise<TodoList> {
    const list: TodoList = {
      id: generateId(),
      name,
      owner,
      todos: [],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await configService.saveListData(name, list);
    return list;
  }

  async getList(name: string): Promise<TodoList | null> {
    return configService.getLocalTodos(name);
  }

  async addTodo(listName: string, todo: Partial<Todo>): Promise<Todo> {
    const list = await this.getList(listName);
    if (!list) {
      throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
    }

    const newTodo: Todo = {
      id: generateId(),
      title: todo.title || '',
      completed: todo.completed || false,
      description: todo.description,
      priority: todo.priority || 'medium',
      tags: todo.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      private: true
    };

    list.todos.push(newTodo);
    list.updatedAt = new Date().toISOString();
    await configService.saveListData(listName, list);
    return newTodo;
  }

  async toggleItemStatus(listName: string, todoId: string, completed: boolean): Promise<void> {
    const list = await this.getList(listName);
    if (!list) {
      throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
    }

    const todo = list.todos.find(t => t.id === todoId);
    if (!todo) {
      throw new CLIError(`Todo "${todoId}" not found in list "${listName}"`, 'TODO_NOT_FOUND');
    }

    todo.completed = completed;
    todo.updatedAt = new Date().toISOString();
    if (completed) {
      todo.completedAt = new Date().toISOString();
    } else {
      delete todo.completedAt;
    }

    await configService.saveListData(listName, list);
  }
}