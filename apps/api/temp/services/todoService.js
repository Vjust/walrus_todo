"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TodoService = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
const error_1 = require("../middleware/error");
class TodoService {
    constructor() {
        this.dataPath = path_1.default.resolve(__dirname, config_1.config.todo.dataPath);
        this.ensureDataDirectory();
    }
    async ensureDataDirectory() {
        try {
            await fs_1.promises.access(this.dataPath);
        }
        catch {
            await fs_1.promises.mkdir(this.dataPath, { recursive: true });
            logger_1.logger.info('Created todo data directory', { path: this.dataPath });
        }
    }
    getWalletFileName(wallet) {
        // Use wallet address as filename with .json extension
        return `${wallet}.json`;
    }
    async readWalletTodos(wallet) {
        try {
            const filePath = path_1.default.join(this.dataPath, this.getWalletFileName(wallet));
            const data = await fs_1.promises.readFile(filePath, 'utf-8');
            const parsed = JSON.parse(data);
            // Handle both array format and object format
            if (Array.isArray(parsed)) {
                return parsed;
            }
            else if (parsed.todos && Array.isArray(parsed.todos)) {
                return parsed.todos;
            }
            else if (parsed.items && Array.isArray(parsed.items)) {
                return parsed.items;
            }
            return [];
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return []; // File doesn't exist, return empty array
            }
            logger_1.logger.error('Error reading wallet todos', { wallet, error });
            throw new error_1.ApiError('Failed to read todos', 500);
        }
    }
    async writeWalletTodos(wallet, todos) {
        try {
            const filePath = path_1.default.join(this.dataPath, this.getWalletFileName(wallet));
            // Use the same format as the CLI (object with todos array)
            const data = {
                todos,
                metadata: {
                    version: '1.0.0',
                    lastModified: new Date().toISOString(),
                    wallet,
                    count: todos.length
                }
            };
            await fs_1.promises.writeFile(filePath, JSON.stringify(data, null, 2));
            logger_1.logger.debug('Wrote wallet todos', { wallet, count: todos.length });
        }
        catch (error) {
            logger_1.logger.error('Error writing wallet todos', { wallet, error });
            throw new error_1.ApiError('Failed to save todos', 500);
        }
    }
    async getTodos(wallet, options = {}) {
        const allTodos = await this.readWalletTodos(wallet);
        // Filter todos
        let filteredTodos = allTodos.filter(todo => todo.wallet === wallet);
        if (options.category) {
            filteredTodos = filteredTodos.filter(todo => todo.category === options.category);
        }
        if (options.completed !== undefined) {
            filteredTodos = filteredTodos.filter(todo => todo.completed === options.completed);
        }
        const total = filteredTodos.length;
        // Apply pagination
        if (options.page && options.limit) {
            const startIndex = (options.page - 1) * options.limit;
            filteredTodos = filteredTodos.slice(startIndex, startIndex + options.limit);
        }
        return { todos: filteredTodos, total };
    }
    async getTodoById(id, wallet) {
        const todos = await this.readWalletTodos(wallet);
        return todos.find(todo => todo.id === id && todo.wallet === wallet) || null;
    }
    async createTodo(data, wallet) {
        const todos = await this.readWalletTodos(wallet);
        // Check wallet todo limit
        if (todos.length >= config_1.config.todo.maxTodosPerWallet) {
            throw new error_1.ApiError(`Maximum number of todos (${config_1.config.todo.maxTodosPerWallet}) reached for wallet`, 400, 'MAX_TODOS_EXCEEDED');
        }
        const now = new Date().toISOString();
        const newTodo = {
            id: (0, uuid_1.v4)(),
            title: data.content, // Map content to title for compatibility
            content: data.content,
            completed: false,
            priority: data.priority || 'medium',
            category: data.category,
            tags: data.tags || [],
            createdAt: now,
            updatedAt: now,
            wallet
        };
        todos.push(newTodo);
        await this.writeWalletTodos(wallet, todos);
        logger_1.logger.info('Todo created', { id: newTodo.id, wallet });
        return newTodo;
    }
    async updateTodo(id, data, wallet) {
        const todos = await this.readWalletTodos(wallet);
        const todoIndex = todos.findIndex(todo => todo.id === id && todo.wallet === wallet);
        if (todoIndex === -1) {
            throw new error_1.ApiError('Todo not found', 404, 'TODO_NOT_FOUND');
        }
        const updatedTodo = {
            ...todos[todoIndex],
            ...data,
            ...(data.content && { title: data.content }), // Sync title with content
            updatedAt: new Date().toISOString(),
            wallet: todos[todoIndex].wallet, // Ensure wallet is preserved
            id: todos[todoIndex].id, // Ensure id is preserved
            title: data.content || todos[todoIndex].title, // Ensure title is always defined
            content: data.content || todos[todoIndex].content, // Ensure content is always defined
            completed: data.completed !== undefined ? data.completed : todos[todoIndex].completed,
            createdAt: todos[todoIndex].createdAt // Ensure createdAt is preserved
        };
        todos[todoIndex] = updatedTodo;
        await this.writeWalletTodos(wallet, todos);
        logger_1.logger.info('Todo updated', { id, wallet });
        return updatedTodo;
    }
    async deleteTodo(id, wallet) {
        const todos = await this.readWalletTodos(wallet);
        const todoIndex = todos.findIndex(todo => todo.id === id && todo.wallet === wallet);
        if (todoIndex === -1) {
            throw new error_1.ApiError('Todo not found', 404, 'TODO_NOT_FOUND');
        }
        const deletedTodo = todos[todoIndex];
        todos.splice(todoIndex, 1);
        await this.writeWalletTodos(wallet, todos);
        logger_1.logger.info('Todo deleted', { id, wallet });
        return deletedTodo;
    }
    async completeTodo(id, wallet) {
        return this.updateTodo(id, { completed: true }, wallet);
    }
    async getCategories(wallet) {
        const todos = await this.readWalletTodos(wallet);
        const categories = new Set();
        todos
            .filter(todo => todo.wallet === wallet && todo.category)
            .forEach(todo => categories.add(todo.category));
        return Array.from(categories).sort();
    }
    async getTags(wallet) {
        const todos = await this.readWalletTodos(wallet);
        const tags = new Set();
        todos
            .filter(todo => todo.wallet === wallet)
            .forEach(todo => {
            if (todo.tags) {
                todo.tags.forEach(tag => tags.add(tag));
            }
        });
        return Array.from(tags).sort();
    }
    async getStats(wallet) {
        const todos = await this.readWalletTodos(wallet);
        const walletTodos = todos.filter(todo => todo.wallet === wallet);
        const stats = {
            total: walletTodos.length,
            completed: walletTodos.filter(todo => todo.completed).length,
            pending: walletTodos.filter(todo => !todo.completed).length,
            byPriority: {},
            byCategory: {}
        };
        walletTodos.forEach(todo => {
            // Count by priority
            const priority = todo.priority || 'medium';
            stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;
            // Count by category
            const category = todo.category || 'uncategorized';
            stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
        });
        return stats;
    }
}
exports.TodoService = TodoService;
