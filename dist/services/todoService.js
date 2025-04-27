"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TodoService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
class TodoService {
    constructor() {
        this.todosDir = path_1.default.join(process.cwd(), 'Todos'); // Note the capital T
    }
    async getAllLists() {
        try {
            await promises_1.default.mkdir(this.todosDir, { recursive: true });
            const files = await promises_1.default.readdir(this.todosDir);
            return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
        }
        catch (error) {
            throw new Error(`Failed to read todo lists: ${error}`);
        }
    }
    async getList(name) {
        try {
            const filePath = path_1.default.join(this.todosDir, `${name}.json`);
            const content = await promises_1.default.readFile(filePath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }
            throw new Error(`Failed to read todo list ${name}: ${error}`);
        }
    }
    async toggleItemStatus(listName, itemId, checked) {
        const list = await this.getList(listName);
        if (!list) {
            throw new Error(`List "${listName}" not found`);
        }
        const item = list.todos.find(i => i.id === itemId);
        if (!item) {
            throw new Error(`Item "${itemId}" not found in list "${listName}"`);
        }
        item.completed = checked;
        await promises_1.default.writeFile(path_1.default.join(this.todosDir, `${listName}.json`), JSON.stringify(list, null, 2));
    }
}
exports.TodoService = TodoService;
