"use strict";
/**
 * Complete Command Module
 * Handles marking todo items as completed
 * Updates both local and blockchain state
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.complete = complete;
const chalk_1 = __importDefault(require("chalk"));
const walrus_service_1 = require("../services/walrus-service");
/**
 * Marks a todo item as completed
 * @param options - Command line options for completing todo
 */
async function complete(options) {
    try {
        const { list, id } = options;
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
        todo.completed = true;
        await walrus_service_1.walrusService.updateTodo(list, todo);
        console.log(chalk_1.default.green(`✔ Marked todo ${id} as complete`));
        console.log(chalk_1.default.dim('List:'), list);
        console.log(chalk_1.default.dim('Task:'), todo.task);
    }
    catch (error) {
        console.error(chalk_1.default.red('Failed to complete todo:'), error);
        process.exit(1);
    }
}
