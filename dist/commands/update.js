"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.update = update;
const chalk_1 = __importDefault(require("chalk"));
const walrus_service_1 = require("../services/walrus-service");
const utils_1 = require("../utils");
async function update(options) {
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
        // Update description if provided or prompted
        if (options.description) {
            todo.description = options.description;
        }
        // Update priority if provided or prompted
        if (options.priority) {
            if (!(0, utils_1.validatePriority)(options.priority)) {
                console.error(chalk_1.default.red('Invalid priority. Must be high, medium, or low'));
                process.exit(1);
            }
            todo.priority = options.priority;
        }
        // Update due date if provided
        if (options.due) {
            if (!(0, utils_1.validateDate)(options.due)) {
                console.error(chalk_1.default.red('Invalid date format. Use YYYY-MM-DD'));
                process.exit(1);
            }
            todo.dueDate = options.due;
        }
        // Update tags if provided
        if (options.tags) {
            todo.tags = options.tags.split(',').map(tag => tag.trim());
        }
        await walrus_service_1.walrusService.updateTodo(list, todo);
        console.log(chalk_1.default.green('✔ Todo updated successfully'));
        console.log(chalk_1.default.dim('List:'), list);
        console.log(chalk_1.default.dim('ID:'), id);
    }
    catch (error) {
        console.error(chalk_1.default.red('Failed to update todo:'), error);
        process.exit(1);
    }
}
