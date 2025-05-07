import { CLIError } from '../../types/error';

export class MockTodoListContract {
  private storage: Map<string, any> = new Map();
  private errors = {
    ListNotFound: 'List not found',
    ItemNotFound: 'Item not found',
    Unauthorized: 'Unauthorized operation',
    InvalidOperation: 'Invalid operation'
  };

  constructor(private moduleId: string) {}

  // Simulates Move contract entry functions
  async entry_create_list(ctx: { sender: string }): Promise<string> {
    const objectId = `${this.moduleId}_${Math.random().toString(36).slice(2)}`;
    this.storage.set(objectId, {
      owner: ctx.sender,
      items: [],
      created_at: Date.now(),
      updated_at: Date.now()
    });
    return objectId;
  }

  async entry_add_item(ctx: { sender: string }, listId: string, text: string): Promise<string> {
    const list = this.storage.get(listId);
    if (!list) {
      throw new CLIError(this.errors.ListNotFound, 'CONTRACT_ERROR');
    }
    if (list.owner !== ctx.sender) {
      throw new CLIError(this.errors.Unauthorized, 'CONTRACT_ERROR');
    }

    const itemId = `${listId}_item_${Math.random().toString(36).slice(2)}`;
    list.items.push({
      id: itemId,
      text,
      completed: false,
      created_at: Date.now()
    });
    list.updated_at = Date.now();
    this.storage.set(listId, list);
    return itemId;
  }

  async entry_complete_item(ctx: { sender: string }, listId: string, itemId: string): Promise<void> {
    const list = this.storage.get(listId);
    if (!list) {
      throw new CLIError(this.errors.ListNotFound, 'CONTRACT_ERROR');
    }
    if (list.owner !== ctx.sender) {
      throw new CLIError(this.errors.Unauthorized, 'CONTRACT_ERROR');
    }

    const item = list.items.find((i: any) => i.id === itemId);
    if (!item) {
      throw new CLIError(this.errors.ItemNotFound, 'CONTRACT_ERROR');
    }

    item.completed = true;
    item.completed_at = Date.now();
    list.updated_at = Date.now();
    this.storage.set(listId, list);
  }

  async entry_delete_list(ctx: { sender: string }, listId: string): Promise<void> {
    const list = this.storage.get(listId);
    if (!list) {
      throw new CLIError(this.errors.ListNotFound, 'CONTRACT_ERROR');
    }
    if (list.owner !== ctx.sender) {
      throw new CLIError(this.errors.Unauthorized, 'CONTRACT_ERROR');
    }

    this.storage.delete(listId);
  }

  // View functions
  async view_get_list(listId: string): Promise<any> {
    const list = this.storage.get(listId);
    if (!list) {
      throw new CLIError(this.errors.ListNotFound, 'CONTRACT_ERROR');
    }
    return list;
  }

  async view_get_items(listId: string): Promise<any[]> {
    const list = this.storage.get(listId);
    if (!list) {
      throw new CLIError(this.errors.ListNotFound, 'CONTRACT_ERROR');
    }
    return list.items;
  }

  // Helper to simulate contract events
  private emitEvent(eventType: string, data: any) {
    // In a real contract, this would emit blockchain events
    console.log('Contract Event:', { type: eventType, data });
  }
}