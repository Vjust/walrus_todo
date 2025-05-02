"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configService = exports.ConfigService = void 0;
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const path_1 = tslib_1.__importDefault(require("path"));
const constants_1 = require("../constants");
const error_1 = require("../types/error");
class ConfigService {
    constructor() {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        this.configPath = path_1.default.join(homeDir, constants_1.CLI_CONFIG.CONFIG_FILE);
        this.todosPath = path_1.default.resolve(process.cwd(), 'Todos');
        this.config = this.loadConfig();
        this.ensureTodosDirectory();
    }
    ensureTodosDirectory() {
        try {
            if (!fs_1.default.existsSync(this.todosPath)) {
                fs_1.default.mkdirSync(this.todosPath, { recursive: true });
            }
        }
        catch (error) {
            throw new error_1.CLIError(`Failed to create Todos directory: ${error instanceof Error ? error.message : 'Unknown error'}`, 'DIRECTORY_CREATE_FAILED');
        }
    }
    getListPath(listName) {
        return path_1.default.join(this.todosPath, `${listName}.json`);
    }
    loadConfig() {
        try {
            if (fs_1.default.existsSync(this.configPath)) {
                const data = fs_1.default.readFileSync(this.configPath, 'utf8');
                return JSON.parse(data);
            }
        }
        catch (error) {
            throw new error_1.CLIError(`Failed to load config: ${error instanceof Error ? error.message : 'Unknown error'}`, 'CONFIG_LOAD_FAILED');
        }
        return {
            network: 'testnet',
            walletAddress: '',
            encryptedStorage: false
        };
    }
    getConfig() {
        return this.config;
    }
    async saveConfig(config) {
        this.config = { ...this.config, ...config };
        try {
            await fs_1.default.promises.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
        }
        catch (error) {
            throw new error_1.CLIError(`Failed to save config: ${error instanceof Error ? error.message : 'Unknown error'}`, 'CONFIG_SAVE_FAILED');
        }
    }
    async loadListData(listName) {
        const listPath = this.getListPath(listName);
        try {
            if (fs_1.default.existsSync(listPath)) {
                const data = await fs_1.default.promises.readFile(listPath, 'utf-8');
                return JSON.parse(data);
            }
        }
        catch (error) {
            throw new error_1.CLIError(`Failed to load list "${listName}": ${error instanceof Error ? error.message : 'Unknown error'}`, 'LIST_LOAD_FAILED');
        }
        return null;
    }
    async saveListData(listName, list) {
        const listPath = this.getListPath(listName);
        try {
            await fs_1.default.promises.writeFile(listPath, JSON.stringify(list, null, 2));
            return list;
        }
        catch (error) {
            throw new error_1.CLIError(`Failed to save list "${listName}": ${error instanceof Error ? error.message : 'Unknown error'}`, 'LIST_SAVE_FAILED');
        }
    }
    async getLocalTodos(listName) {
        return this.loadListData(listName);
    }
    async getAllLists() {
        try {
            const files = await fs_1.default.promises.readdir(this.todosPath);
            return files
                .filter(file => file.endsWith('.json'))
                .map(file => file.replace('.json', ''));
        }
        catch (error) {
            throw new error_1.CLIError(`Failed to read todo lists: ${error instanceof Error ? error.message : 'Unknown error'}`, 'LIST_READ_FAILED');
        }
    }
    async saveLocalTodo(listName, todo) {
        let list = await this.loadListData(listName);
        if (!list) {
            list = {
                id: listName,
                name: listName,
                owner: 'local',
                todos: [],
                version: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        }
        list.todos.push(todo);
        await this.saveListData(listName, list);
    }
    async updateLocalTodo(listName, todo) {
        const list = await this.loadListData(listName);
        if (!list) {
            throw new error_1.CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
        }
        const index = list.todos.findIndex(t => t.id === todo.id);
        if (index === -1) {
            throw new error_1.CLIError(`Todo "${todo.id}" not found in list "${listName}"`, 'TODO_NOT_FOUND');
        }
        list.todos[index] = todo;
        list.updatedAt = new Date().toISOString();
        await this.saveListData(listName, list);
    }
    async deleteLocalTodo(listName, todoId) {
        const list = await this.loadListData(listName);
        if (!list) {
            throw new error_1.CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
        }
        const todoIndex = list.todos.findIndex(t => t.id === todoId);
        if (todoIndex === -1) {
            throw new error_1.CLIError(`Todo "${todoId}" not found in list "${listName}"`, 'TODO_NOT_FOUND');
        }
        list.todos = list.todos.filter(t => t.id !== todoId);
        list.updatedAt = new Date().toISOString();
        await this.saveListData(listName, list);
    }
    async deleteList(listName) {
        const listPath = this.getListPath(listName);
        try {
            if (fs_1.default.existsSync(listPath)) {
                await fs_1.default.promises.unlink(listPath);
            }
        }
        catch (error) {
            throw new error_1.CLIError(`Failed to delete list "${listName}": ${error instanceof Error ? error.message : 'Unknown error'}`, 'LIST_DELETE_FAILED');
        }
    }
    async getLocalTodoById(todoId) {
        const lists = await this.getAllLists();
        for (const listName of lists) {
            const list = await this.loadListData(listName);
            if (list) {
                const todo = list.todos.find(t => t.id === todoId);
                if (todo)
                    return todo;
            }
        }
        return null;
    }
}
exports.ConfigService = ConfigService;
exports.configService = new ConfigService();
