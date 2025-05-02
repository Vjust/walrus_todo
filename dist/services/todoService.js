"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TodoService = void 0;
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const promises_1 = tslib_1.__importDefault(require("fs/promises"));
const path_1 = tslib_1.__importDefault(require("path"));
const constants_1 = require("../constants");
const id_generator_1 = require("../utils/id-generator");
const error_1 = require("../types/error");
class TodoService {
    constructor() {
        this.todosDir = path_1.default.join(process.cwd(), constants_1.STORAGE_CONFIG.TODOS_DIR);
        promises_1.default.mkdir(this.todosDir, { recursive: true }).catch(() => { });
    }
    async getAllLists() {
        const files = await promises_1.default.readdir(this.todosDir).catch(() => []);
        return files
            .filter(f => f.endsWith(constants_1.STORAGE_CONFIG.FILE_EXT))
            .map(f => f.replace(constants_1.STORAGE_CONFIG.FILE_EXT, ''));
    }
    async createList(name, owner) {
        const existingList = await this.getList(name);
        if (existingList) {
            throw new error_1.CLIError(`List "${name}" already exists`, 'LIST_EXISTS');
        }
        const newList = {
            id: (0, id_generator_1.generateId)(),
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
    async getList(listName) {
        try {
            const data = await promises_1.default.readFile(path_1.default.join(this.todosDir, `${listName}${constants_1.STORAGE_CONFIG.FILE_EXT}`), 'utf8');
            return JSON.parse(data);
        }
        catch (err) {
            return null;
        }
    }
    async getTodo(todoId, listName = 'default') {
        const list = await this.getList(listName);
        if (!list)
            return null;
        return list.todos.find(t => t.id === todoId) || null;
    }
    async addTodo(listName, todo) {
        const list = await this.getList(listName);
        if (!list) {
            throw new error_1.CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
        }
        const newTodo = {
            id: (0, id_generator_1.generateId)(),
            title: todo.title || '',
            task: todo.task || todo.title || '',
            description: todo.description,
            completed: false,
            priority: todo.priority || 'medium',
            tags: todo.tags || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            private: true
        };
        list.todos.push(newTodo);
        list.updatedAt = new Date().toISOString();
        await this.saveList(listName, list);
        return newTodo;
    }
    async updateTodo(listName, todoId, updates) {
        const list = await this.getList(listName);
        if (!list) {
            throw new error_1.CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
        }
        const todoIndex = list.todos.findIndex(t => t.id === todoId);
        if (todoIndex === -1) {
            throw new error_1.CLIError(`Todo "${todoId}" not found in list "${listName}"`, 'TODO_NOT_FOUND');
        }
        const todo = list.todos[todoIndex];
        const updatedTodo = {
            ...todo,
            ...updates,
            updatedAt: new Date().toISOString()
        };
        list.todos[todoIndex] = updatedTodo;
        list.updatedAt = new Date().toISOString();
        await this.saveList(listName, list);
        return updatedTodo;
    }
    async toggleItemStatus(listName, itemId, checked) {
        await this.updateTodo(listName, itemId, {
            completed: checked,
            completedAt: checked ? new Date().toISOString() : undefined
        });
    }
    async deleteTodo(listName, todoId) {
        const list = await this.getList(listName);
        if (!list) {
            throw new error_1.CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
        }
        const todoIndex = list.todos.findIndex(t => t.id === todoId);
        if (todoIndex === -1) {
            throw new error_1.CLIError(`Todo "${todoId}" not found in list "${listName}"`, 'TODO_NOT_FOUND');
        }
        list.todos.splice(todoIndex, 1);
        list.updatedAt = new Date().toISOString();
        await this.saveList(listName, list);
    }
    async saveList(listName, list) {
        const file = path_1.default.join(this.todosDir, `${listName}${constants_1.STORAGE_CONFIG.FILE_EXT}`);
        try {
            await promises_1.default.writeFile(file, JSON.stringify(list, null, 2), 'utf8');
        }
        catch (err) {
            throw new error_1.CLIError(`Failed to save list "${listName}": ${err instanceof Error ? err.message : 'Unknown error'}`, 'SAVE_FAILED');
        }
    }
    async deleteList(listName) {
        const file = path_1.default.join(this.todosDir, `${listName}${constants_1.STORAGE_CONFIG.FILE_EXT}`);
        try {
            if (fs_1.default.existsSync(file)) {
                await promises_1.default.unlink(file);
            }
        }
        catch (err) {
            throw new error_1.CLIError(`Failed to delete list "${listName}": ${err instanceof Error ? err.message : 'Unknown error'}`, 'DELETE_FAILED');
        }
    }
}
exports.TodoService = TodoService;
