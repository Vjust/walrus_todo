"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configService = exports.ConfigService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class ConfigService {
    constructor() {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        this.configPath = path_1.default.join(homeDir, '.waltodo.json');
        this.localDataPath = path_1.default.join(homeDir, '.waltodo-data.json');
        this.config = this.loadConfig();
    }
    loadConfig() {
        try {
            if (fs_1.default.existsSync(this.configPath)) {
                const configData = fs_1.default.readFileSync(this.configPath, 'utf-8');
                return JSON.parse(configData);
            }
        }
        catch (error) {
            console.error('Error loading config:', error);
        }
        return {
            network: 'devnet'
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
    // Handle local-only private todos
    async loadLocalData() {
        try {
            if (fs_1.default.existsSync(this.localDataPath)) {
                const data = await fs_1.default.promises.readFile(this.localDataPath, 'utf-8');
                return JSON.parse(data);
            }
        }
        catch (error) {
            console.error('Error loading local data:', error);
        }
        return {};
    }
    async saveLocalData(data) {
        try {
            await fs_1.default.promises.writeFile(this.localDataPath, JSON.stringify(data, null, 2));
        }
        catch (error) {
            console.error('Error saving local data:', error);
            throw error;
        }
    }
    async getLocalTodos(listName) {
        const data = await this.loadLocalData();
        return data[listName] || null;
    }
    async saveLocalTodo(listName, todo) {
        const data = await this.loadLocalData();
        if (!data[listName]) {
            data[listName] = {
                id: listName,
                name: listName,
                owner: this.config.walletAddress || 'local',
                todos: [],
                version: 1
            };
        }
        data[listName].todos.push(todo);
        await this.saveLocalData(data);
    }
    async updateLocalTodo(listName, todo) {
        const data = await this.loadLocalData();
        if (!data[listName])
            return;
        const index = data[listName].todos.findIndex(t => t.id === todo.id);
        if (index !== -1) {
            data[listName].todos[index] = todo;
            await this.saveLocalData(data);
        }
    }
    async deleteLocalTodo(listName, todoId) {
        const data = await this.loadLocalData();
        if (!data[listName])
            return;
        data[listName].todos = data[listName].todos.filter(t => t.id !== todoId);
        await this.saveLocalData(data);
    }
}
exports.ConfigService = ConfigService;
exports.configService = new ConfigService();
