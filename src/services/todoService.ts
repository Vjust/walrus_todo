import { TodoList, Todo } from '../types';
import fs from 'fs/promises';
import path from 'path';

export class TodoService {
  private todosDir: string;

  constructor() {
    this.todosDir = path.join(process.cwd(), 'Todos'); // Note the capital T
  }

  async getAllLists(): Promise<string[]> {
    try {
      await fs.mkdir(this.todosDir, { recursive: true });
      const files = await fs.readdir(this.todosDir);
      return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
    } catch (error) {
      throw new Error(`Failed to read todo lists: ${error}`);
    }
  }

  async getList(name: string): Promise<TodoList | null> {
    try {
      const filePath = path.join(this.todosDir, `${name}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as TodoList;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw new Error(`Failed to read todo list ${name}: ${error}`);
    }
  }

  async toggleItemStatus(listName: string, itemId: string, checked: boolean): Promise<void> {
    const list = await this.getList(listName);
    if (!list) {
      throw new Error(`List "${listName}" not found`);
    }

    const item = list.todos.find(i => i.id === itemId);
    if (!item) {
      throw new Error(`Item "${itemId}" not found in list "${listName}"`);
    }

    item.completed = checked;
    
    await fs.writeFile(
      path.join(this.todosDir, `${listName}.json`),
      JSON.stringify(list, null, 2)
    );
  }
}
