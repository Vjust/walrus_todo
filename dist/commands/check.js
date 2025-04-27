"use strict";
/**
 * Check Command Module
 * Toggles completion status of todo items
 * Supports both local and Walrus-stored items
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.check = check;
exports.setupCheckCommands = setupCheckCommands;
const chalk_1 = __importDefault(require("chalk"));
const walrus_service_1 = require("../services/walrus-service");
const todoService_1 = require("../services/todoService");
/**
 * Toggles or sets the completion status of a todo item
 * @param options - Command line options for checking/unchecking todo
 */
async function check(options) {
    try {
        const { list, id, uncheck } = options;
        const todoList = await walrus_service_1.walrusService.getTodoList(list);
        if (!todoList) {
            console.error(chalk_1.default.red(`Todo list '${list}' not found`));
            process.exit(1);
        }
        const todo = todoList.todos.find(t => t.id === id);
        if (!todo) {
            console.error(chalk_1.default.red(`Todo with id '${id}' not found`));
            process.exit(1);
        }
        // Toggle or set completion status
        todo.completed = uncheck ? false : true;
        await walrus_service_1.walrusService.updateTodo(list, todo);
        const status = todo.completed ? 'checked' : 'unchecked';
        console.log(chalk_1.default.green(`✔ Marked todo as ${status}`));
        console.log(chalk_1.default.dim('List:'), list);
        console.log(chalk_1.default.dim('Task:'), todo.task);
    }
    catch (error) {
        console.error(chalk_1.default.red('Failed to update todo status:'), error);
        process.exit(1);
    }
}
function setupCheckCommands(program) {
    // Check command with list subcommand
    program
        .command('check')
        .argument('[list]', 'list command or list name')
        .argument('[listName]', 'name of the list')
        .argument('[itemNumber]', 'number or ID of the item')
        .option('--uncheck', 'uncheck instead of check')
        .description('Check/uncheck a todo item')
        .action(async (list, listName, itemNumber, options) => {
        if (list === 'list') {
            await handleCheckByNumber(listName, parseInt(itemNumber) || itemNumber, !options.uncheck);
        }
    });
    // Uncheck command with list subcommand
    program
        .command('uncheck')
        .argument('[list]', 'list command or list name')
        .argument('[listName]', 'name of the list')
        .argument('[itemNumber]', 'number or ID of the item')
        .description('Uncheck a todo item')
        .action(async (list, listName, itemNumber) => {
        if (list === 'list') {
            await handleCheckByNumber(listName, parseInt(itemNumber) || itemNumber, false);
        }
    });
}
async function handleCheckByNumber(listName, itemNumber, checked) {
    try {
        const todoService = new todoService_1.TodoService();
        const list = await todoService.getList(listName);
        if (!list) {
            throw new Error(`List "${listName}" not found`);
        }
        let item;
        if (typeof itemNumber === 'number') {
            // Use array index if number provided
            item = list.todos[itemNumber - 1];
        }
        else {
            // Use item ID if string provided
            item = list.todos.find((i) => i.id === itemNumber);
        }
        if (!item) {
            throw new Error(`Item ${itemNumber} not found in list "${listName}"`);
        }
        await todoService.toggleItemStatus(listName, item.id, checked);
        console.log(chalk_1.default.green(`Item ${itemNumber} ${checked ? 'checked' : 'unchecked'} ✓`));
    }
    catch (error) {
        console.error(chalk_1.default.red('Error:'), error);
        process.exit(1);
    }
}
