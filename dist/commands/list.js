"use strict";
/**
 * List Command Module
 * Displays todo items with filtering and formatting options
 * Supports both local and Walrus storage items
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.list = list;
const chalk_1 = __importDefault(require("chalk"));
const walrus_service_1 = require("../services/walrus-service");
const utils_1 = require("../utils");
/**
 * Lists todo items based on provided filters
 * @param options - Command line options for listing todos
 */
async function list(options) {
    try {
        const todoList = options.list
            ? await walrus_service_1.walrusService.getTodoList(options.list)
            : null;
        if (!todoList) {
            console.log(chalk_1.default.yellow('\nNo todos found. Use `waltodo add` to create one.'));
            return;
        }
        console.log(chalk_1.default.blue('Todo List'));
        if (options.list) {
            console.log(chalk_1.default.dim('List:'), options.list);
        }
        const todos = todoList.todos.filter(todo => {
            if (options.completed)
                return todo.completed;
            if (options.pending)
                return !todo.completed;
            return true;
        });
        if (todos.length === 0) {
            console.log(chalk_1.default.yellow('\nNo matching todos found.'));
            return;
        }
        todos.forEach(todo => {
            console.log((0, utils_1.formatTodoOutput)(todo));
        });
    }
    catch (error) {
        console.error(chalk_1.default.red('Failed to list todos:'), error);
        process.exit(1);
    }
}
