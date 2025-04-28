import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { Todo, TodoList } from '../types/todo';

/**
 * Simple local‑file Todo service.
 *  - Each list is stored as ./Todos/<list>.json
 *  - No blockchain / Walrus logic here (keeps TypeScript happy)
 */
export class TodoService {
  private readonly todosDir: string = path.join(process.cwd(), 'Todos');

  constructor() {
    // ensure directory exists
    fsPromises.mkdir(this.todosDir, { recursive: true }).catch(() => {/* ignore */});
  }

  /* ------------------------------------------------------------------ */
  /*  Public helpers                                                    */
  /* ------------------------------------------------------------------ */

  async getAllLists(): Promise<string[]> {
    const files = await fsPromises.readdir(this.todosDir).catch(() => []);
    return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  }

  async getList(listName: string): Promise<TodoList | null> {
    try {
      const data = await fsPromises.readFile(path.join(this.todosDir, `${listName}.json`), 'utf8');
      return JSON.parse(data) as TodoList;
    } catch (err) {
      return null; // file not found or invalid JSON
    }
  }

  async toggleItemStatus(listName: string, itemId: string, checked: boolean): Promise<void> {
    const list = await this.getList(listName);
    if (!list) throw new Error(`List "${listName}" not found`);

    const item = list.todos.find(t => t.id === itemId);
    if (!item) throw new Error(`Todo "${itemId}" not found in list "${listName}"`);

    item.completed = checked;
    await this.saveList(listName, list);
  }

  async saveList(listName: string, list: TodoList): Promise<void> {
    const file = path.join(this.todosDir, `${listName}.json`);
    await fsPromises.writeFile(file, JSON.stringify(list, null, 2), 'utf8');
  }

  async deleteList(listName: string): Promise<void> {
    const file = path.join(this.todosDir, `${listName}.json`);
    if (fs.existsSync(file)) {
      await fsPromises.unlink(file);
    }
  }
}