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
const error_handler_1 = require("../utils/error-handler");
/**
 * Adds new todo items to either local storage or Walrus storage
 * Handles interactive prompts if required options are not provided
 * Supports encryption and private storage options
 *
 * @param options - Command line options for adding todos
 * @throws Will throw an error if storage operations fail
 */
async function add(options) {
    try {
        // Get list name if not provided
        const listName = options.list || await (0, prompts_1.input)({
            message: 'Enter the name of the todo list:',
            validate: (input) => input.length > 0 || 'List name cannot be empty'
        });
        // Get tasks if not provided
        const tasks = options.task || [await (0, prompts_1.input)({
                message: 'What do you need to do?',
                validate: (input) => input.length > 0 || 'Task description cannot be empty'
            })];
        // Get todo list
        let todoList = await config_service_1.configService.getLocalTodos(listName);
        if (!todoList) {
            // Initialize new list
            todoList = {
                id: (0, utils_1.generateId)(),
                name: listName,
                owner: config_service_1.configService.getConfig().walletAddress || 'local',
                todos: [],
                version: 1
            };
        }
        // Validate priority if provided
        if (options.priority && !['high', 'medium', 'low'].includes(options.priority.toLowerCase())) {
            throw new error_handler_1.CLIError(`Invalid priority level: ${options.priority}`, 'INVALID_PRIORITY');
        }
        // Validate date if provided
        if (options.due) {
            const date = new Date(options.due);
            if (isNaN(date.getTime()) || !options.due.match(/^\d{4}-\d{2}-\d{2}$/)) {
                throw new error_handler_1.CLIError(`Invalid date format: ${options.due}. Use YYYY-MM-DD format.`, 'INVALID_DATE');
            }
        }
        // Add each task as a separate todo
        for (const description of tasks) {
            if (!description.trim()) {
                throw new error_handler_1.CLIError('Task description cannot be empty', 'INVALID_TASK');
            }
            // Create todo data with metadata
            const todo = {
                id: (0, utils_1.generateId)(),
                task: description,
                priority: options.priority?.toLowerCase() || 'medium',
                dueDate: options.due,
                tags: options.tags ? options.tags.split(',').map(tag => tag.trim()) : [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                completed: false,
                private: options.private || false,
                isEncrypted: options.encrypt || false,
                isTest: options.test || false,
                walrusBlobId: ''
            };
            // Add the new todo to the list
            todoList.todos.push(todo);
            // Save the updated list
            if (todo.private || todo.isTest) {
                await config_service_1.configService.saveLocalTodo(listName, todo).catch((error) => {
                    throw new error_handler_1.CLIError(`Failed to save todo: ${error.message}`, 'SAVE_ERROR');
                });
            }
            else {
                try {
                    // For non-private todos, store in Walrus and get blob ID
                    const blobId = await walrus_service_1.walrusService.storeTodo(listName, todo);
                    todo.walrusBlobId = blobId;
                    // Also save locally for immediate access
                    await config_service_1.configService.saveLocalTodo(listName, todo);
                }
                catch (error) {
                    if (error instanceof error_handler_1.CLIError) {
                        throw error;
                    }
                    const message = error instanceof Error ? error.message : String(error);
                    throw new error_handler_1.CLIError(`Failed to store todo: ${message}`, 'STORAGE_ERROR');
                }
            }
            // Provide user feedback for each task
            console.log(chalk_1.default.green('✔ Todo added successfully'));
            console.log(chalk_1.default.dim('Task:'), description);
        }
        // Summary feedback
        console.log(chalk_1.default.dim('\nList:'), listName);
        console.log(chalk_1.default.dim('Total tasks added:'), tasks.length);
        if (options.private || options.test) {
            console.log(chalk_1.default.dim('Storage:'), options.test ? 'Local (Test)' : 'Local only');
        }
    }
    catch (error) {
        if (error instanceof error_handler_1.CLIError) {
            throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        throw new error_handler_1.CLIError(`Failed to add todos: ${message}`);
    }
}
