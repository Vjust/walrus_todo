"use strict";
/**
 * Add Command Module
 * Handles the creation and storage of new todo items
 * Supports both local and Walrus storage with encryption options
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.add = add;
const prompts_1 = require("@inquirer/prompts");
const chalk_1 = __importDefault(require("chalk"));
const config_service_1 = require("../services/config-service");
const walrus_service_1 = require("../services/walrus-service");
const utils_1 = require("../utils");
/**
 * Adds a new todo item to either local storage or Walrus storage
 * Handles interactive prompts if required options are not provided
 * Supports encryption and private storage options
 *
 * @param options - Command line options for adding a todo
 * @throws Will throw an error if storage operations fail
 */
async function add(options) {
    try {
        // Get list name if not provided
        const listName = options.list || await (0, prompts_1.input)({
            message: 'Enter the name of the todo list:',
            validate: (input) => input.length > 0
        });
        // Get task description if not provided
        const description = options.task || await (0, prompts_1.input)({
            message: 'What do you need to do?',
            validate: (input) => input.length > 0
        });
        // Create todo data with metadata
        const todo = {
            id: (0, utils_1.generateId)(),
            description,
            priority: options.priority || 'medium',
            dueDate: options.due,
            tags: options.tags ? options.tags.split(',').map(tag => tag.trim()) : [],
            createdAt: new Date().toISOString(),
            completed: false,
            private: options.private || false,
            encrypted: options.encrypt || false,
            walrusBlobId: ''
        };
        // Handle storage based on privacy setting
        if (!todo.private) {
            const blobId = await walrus_service_1.walrusService.storeTodo(listName, todo);
            todo.walrusBlobId = blobId;
        }
        else {
            await config_service_1.configService.saveLocalTodo(listName, todo);
        }
        // Provide user feedback
        console.log(chalk_1.default.green('✔ Todo added successfully'));
        console.log(chalk_1.default.dim('List:'), listName);
        console.log(chalk_1.default.dim('Task:'), description);
        if (todo.private) {
            console.log(chalk_1.default.dim('Storage:'), 'Local only');
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('Failed to add todo:'), error);
        process.exit(1);
    }
}
