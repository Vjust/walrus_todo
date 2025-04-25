import { Todo, TodoList } from '../types';
import { configService } from './config-service';

class WalrusService {
  private async encryptData(data: any): Promise<string> {
    // TODO: Implement encryption using Seal protocol when available
    return JSON.stringify(data);
  }

  private async decryptData(encryptedData: string): Promise<any> {
    // TODO: Implement decryption using Seal protocol when available
    return JSON.parse(encryptedData);
  }

  public async storeTodo(listId: string, todo: Todo): Promise<string> {
    try {
      if (todo.private) {
        await configService.saveLocalTodo(listId, todo);
        return `local-${todo.id}`;
      }

      const data = todo.encrypted ? await this.encryptData(todo) : JSON.stringify(todo);
      // TODO: Store data using Walrus SDK
      // For now, just return a mock blob ID
      return `walrus-blob-${Date.now()}`;
    } catch (error) {
      console.error('Error storing todo:', error);
      throw error;
    }
  }

  public async getTodoList(listId: string): Promise<TodoList | null> {
    try {
      // First, get local private todos
      const localList = await configService.getLocalTodos(listId);
      
      // TODO: Implement actual Walrus storage retrieval
      // For now, return mock data merged with local todos
      const walrusList: TodoList = {
        id: listId,
        name: listId,
        owner: 'current-user',
        todos: [] as Todo[],
        version: 1
      };

      if (localList) {
        // Merge local private todos with Walrus todos
        walrusList.todos = [
          ...localList.todos.filter(todo => todo.private)
        ];
      }

      return walrusList;
    } catch (error) {
      console.error('Error retrieving todo list:', error);
      throw error;
    }
  }

  public async updateTodo(listId: string, todo: Todo): Promise<void> {
    try {
      if (todo.private) {
        await configService.updateLocalTodo(listId, todo);
        return;
      }

      const data = todo.encrypted ? await this.encryptData(todo) : JSON.stringify(todo);
      // TODO: Implement actual Walrus storage update
    } catch (error) {
      console.error('Error updating todo:', error);
      throw error;
    }
  }

  public async deleteTodo(listId: string, todoId: string): Promise<void> {
    try {
      // Try to delete from local storage first
      await configService.deleteLocalTodo(listId, todoId);
      
      // TODO: Implement actual Walrus storage deletion if not found locally
    } catch (error) {
      console.error('Error deleting todo:', error);
      throw error;
    }
  }

  public async syncWithBlockchain(listId: string, onChainList: TodoList): Promise<void> {
    try {
      const localList = await this.getTodoList(listId);
      if (!localList) {
        // If local list doesn't exist, create it from blockchain state
        // but exclude syncing private todos
        const newList = {
          ...onChainList,
          todos: onChainList.todos.filter(todo => !todo.private)
        };
        // TODO: Implement with actual Walrus SDK
        return;
      }

      // Sync versions if blockchain version is newer
      if (onChainList.version > localList.version) {
        // Preserve private todos during sync
        const privateTodos = localList.todos.filter(todo => todo.private);
        const publicTodos = onChainList.todos.filter(todo => !todo.private);
        
        // Merge while keeping private todos
        const mergedTodos = [...publicTodos, ...privateTodos];
        
        // TODO: Implement actual sync logic with Walrus SDK
        // This should merge changes from blockchain while preserving local private todos
      }
    } catch (error) {
      console.error('Error syncing with blockchain:', error);
      throw error;
    }
  }
}

export const walrusService = new WalrusService();