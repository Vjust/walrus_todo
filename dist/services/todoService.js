"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TodoService = void 0;
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const promises_1 = tslib_1.__importDefault(require("fs/promises"));
const path_1 = tslib_1.__importDefault(require("path"));
/**
 * Simple local‑file Todo service.
 *  - Each list is stored as ./Todos/<list>.json
 *  - No blockchain / Walrus logic here (keeps TypeScript happy)
 */
class TodoService {
    constructor() {
        this.todosDir = path_1.default.join(process.cwd(), 'Todos');
        // ensure directory exists
        promises_1.default.mkdir(this.todosDir, { recursive: true }).catch(() => { });
    }
    /* ------------------------------------------------------------------ */
    /*  Public helpers                                                    */
    /* ------------------------------------------------------------------ */
    async getAllLists() {
        const files = await promises_1.default.readdir(this.todosDir).catch(() => []);
        return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
    }
    async getList(listName) {
        try {
            const data = await promises_1.default.readFile(path_1.default.join(this.todosDir, `${listName}.json`), 'utf8');
            return JSON.parse(data);
        }
        catch (err) {
            return null; // file not found or invalid JSON
        }
    }
    async toggleItemStatus(listName, itemId, checked) {
        const list = await this.getList(listName);
        if (!list)
            throw new Error(`List "${listName}" not found`);
        const item = list.todos.find(t => t.id === itemId);
        if (!item)
            throw new Error(`Todo "${itemId}" not found in list "${listName}"`);
        item.completed = checked;
        await this.saveList(listName, list);
    }
    async saveList(listName, list) {
        const file = path_1.default.join(this.todosDir, `${listName}.json`);
        await promises_1.default.writeFile(file, JSON.stringify(list, null, 2), 'utf8');
    }
    async deleteList(listName) {
        const file = path_1.default.join(this.todosDir, `${listName}.json`);
        if (fs_1.default.existsSync(file)) {
            await promises_1.default.unlink(file);
        }
    }
}
exports.TodoService = TodoService;
