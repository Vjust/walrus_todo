"use strict";
/**
 * Check Command Module
 * Toggles completion status of todo items
 * Supports both local and Walrus-stored items
 */
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const core_1 = require("@oclif/core");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const todoService_1 = require("../services/todoService");
const error_handler_1 = require("../utils/error-handler");
const dotenv_1 = tslib_1.__importDefault(require("dotenv"));
dotenv_1.default.config();
class CheckCommand extends core_1.Command {
    async run() {
        const { args, flags } = await this.parse(CheckCommand);
        const todoService = new todoService_1.TodoService();
        try {
            const list = await todoService.getList(args.listName);
            if (!list) {
                throw new error_handler_1.CLIError(`List "${args.listName}" not found`, 'INVALID_LIST');
            }
            const todo = list.todos.find(t => t.id === flags.id);
            if (!todo) {
                throw new error_handler_1.CLIError(`Todo with ID "${flags.id}" not found in list "${args.listName}"`, 'INVALID_TASK_ID');
            }
            todo.completed = !flags.uncheck;
            todo.updatedAt = new Date().toISOString();
            await todoService.saveList(args.listName, list);
            const status = todo.completed ? chalk_1.default.green('✓') : chalk_1.default.yellow('☐');
            console.log(`${status} Todo ${chalk_1.default.bold(todo.task)} marked as ${todo.completed ? 'complete' : 'incomplete'}`);
            console.log(chalk_1.default.dim(`List: ${args.listName}`));
            console.log(chalk_1.default.dim(`ID: ${flags.id}`));
        }
        catch (error) {
            throw error;
        }
    }
}
CheckCommand.description = 'Mark a todo item as complete/incomplete';
CheckCommand.examples = [
    '<%= config.bin %> check my-list -i task-123',
    '<%= config.bin %> check my-list -i task-123 --uncheck'
];
CheckCommand.flags = {
    id: core_1.Flags.string({
        char: 'i',
        description: 'Todo ID',
        required: true
    }),
    uncheck: core_1.Flags.boolean({
        char: 'u',
        description: 'Uncheck the todo instead of checking it',
        default: false
    })
};
CheckCommand.args = {
    listName: core_1.Args.string({
        name: 'listName',
        description: 'Name of the todo list',
        required: true
    })
};
exports.default = CheckCommand;
