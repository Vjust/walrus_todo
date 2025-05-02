import { Todo, TodoList } from '../types/todo';
import { CLIError } from '../types/error';

export interface IWalrusService {
  storeTodo(todo: Todo): Promise<string>;
  retrieveTodo(blobId: string): Promise<Todo>;
  storeTodoList(list: TodoList): Promise<string>;
  retrieveTodoList(blobId: string): Promise<TodoList>;
}

/**
 * Test implementation of Walrus service for development and testing.
 * Simulates Walrus storage behavior without network calls.
 */
export class WalrusTestService implements IWalrusService {
  private todos = new Map<string, Todo>();
  private lists = new Map<string, TodoList>();

  async storeTodo(todo: Todo): Promise<string> {
    try {
      const blobId = `mock_todo_${todo.id}`;
      this.todos.set(blobId, {...todo, walrusBlobId: blobId});
      return blobId;
    } catch (error) {
      throw new CLIError(
        `Failed to store todo: ${error instanceof Error ? error.message : String(error)}`,
        'STORE_TODO_FAILED'
      );
    }
  }

  async retrieveTodo(blobId: string): Promise<Todo> {
    const todo = this.todos.get(blobId);
    if (!todo) {
      throw new CLIError(`Todo with blob ID "${blobId}" not found`, 'TODO_NOT_FOUND');
    }
    return todo;
  }

  async storeTodoList(list: TodoList): Promise<string> {
    try {
      const blobId = `mock_list_${list.id}`;
      this.lists.set(blobId, {...list, walrusBlobId: blobId});
      return blobId;
    } catch (error) {
      throw new CLIError(
        `Failed to store todo list: ${error instanceof Error ? error.message : String(error)}`,
        'STORE_LIST_FAILED'
      );
    }
  }

  async retrieveTodoList(blobId: string): Promise<TodoList> {
    const list = this.lists.get(blobId);
    if (!list) {
      throw new CLIError(`Todo list with blob ID "${blobId}" not found`, 'LIST_NOT_FOUND');
    }
    return list;
  }
}