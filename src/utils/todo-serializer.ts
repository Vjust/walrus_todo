import { Todo, TodoList } from '../types/todo';

/**
 * Serializer utility for converting todos to/from various formats
 */
export class TodoSerializer {
  static todoToBuffer(todo: Todo): Buffer {
    return Buffer.from(JSON.stringify(todo));
  }

  static bufferToTodo(buffer: Buffer): Todo {
    return JSON.parse(buffer.toString());
  }

  static todoListToBuffer(todoList: TodoList): Buffer {
    return Buffer.from(JSON.stringify(todoList));
  }

  static bufferToTodoList(buffer: Buffer): TodoList {
    return JSON.parse(buffer.toString());
  }
}