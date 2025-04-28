"use strict";
/**
 * Configuration Service
 * Handles local configuration and private todo storage
 * Manages user preferences and local-only todo items
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.configService = exports.ConfigService = void 0;
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const path_1 = tslib_1.__importDefault(require("path"));
const constants_1 = require("../constants");
/**
 * Manages application configuration and local storage
 * Provides methods for handling private todos and user settings
 */
class ConfigService {
    constructor() {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        this.configPath = path_1.default.join(homeDir, constants_1.CLI_CONFIG.CONFIG_FILE);
        // Always use absolute path from current directory for Todos folder
        this.todosPath = path_1.default.resolve(process.cwd(), 'Todos');
        this.config = this.loadConfig();
        this.ensureTodosDirectory();
    }
    /**
     * Ensures the todos directory exists
     */
    ensureTodosDirectory() {
        try {
            if (!fs_1.default.existsSync(this.todosPath)) {
                fs_1.default.mkdirSync(this.todosPath, { recursive: true });
                console.log(`Created Todos directory at: ${this.todosPath}`);
            }
        }
        catch (error) {
            console.error('Error creating Todos directory:', error);
            throw error;
        }
    }
    /**
     * Gets the path for a specific todo list file
     */
    getListPath(listName) {
        return path_1.default.join(this.todosPath, `${listName}.json`);
    }
    /**
     * Loads configuration from disk
     * Creates default configuration if none exists
     * @returns Config object with application settings
     */
    loadConfig() {
        try {
            if (fs_1.default.existsSync(this.configPath)) {
                const data = fs_1.default.readFileSync(this.configPath, 'utf8');
                return JSON.parse(data);
            }
        }
        catch (error) {
            console.error('Error loading config:', error);
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
            console.error('Error saving config:', error);
            throw error;
        }
    }
    // Handle local todos in todos directory
    async loadListData(listName) {
        const listPath = this.getListPath(listName);
        try {
            if (fs_1.default.existsSync(listPath)) {
                const data = await fs_1.default.promises.readFile(listPath, 'utf-8');
                return JSON.parse(data);
            }
        }
        catch (error) {
            console.error(`Error loading todo list ${listName}:`, error);
        }
        return null;
    }
    async saveListData(listName, list) {
        const listPath = this.getListPath(listName);
        try {
            await fs_1.default.promises.writeFile(listPath, JSON.stringify(list, null, 2));
        }
        catch (error) {
            console.error(`Error saving todo list ${listName}:`, error);
            throw error;
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
            console.error('Error reading todo lists:', error);
            return [];
        }
    }
    async saveLocalTodo(listName, todo) {
        let list = await this.loadListData(listName);
        if (!list) {
            list = {
                id: listName,
                name: listName,
                owner: this.config.walletAddress || 'local',
                todos: [],
                version: 1
            };
        }
        list.todos.push(todo);
        await this.saveListData(listName, list);
    }
    async updateLocalTodo(listName, todo) {
        const list = await this.loadListData(listName);
        if (!list)
            return;
        const index = list.todos.findIndex(t => t.id === todo.id);
        if (index !== -1) {
            list.todos[index] = todo;
            await this.saveListData(listName, list);
        }
    }
    async deleteLocalTodo(listName, todoId) {
        const list = await this.loadListData(listName);
        if (!list)
            return;
        list.todos = list.todos.filter(t => t.id !== todoId);
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
            console.error(`Error deleting list ${listName}:`, error);
            throw error;
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
// Singleton instance
exports.configService = new ConfigService();
