"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const core_1 = require("@oclif/core");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const prompts_1 = require("@inquirer/prompts");
const todoService_1 = require("../services/todoService");
const error_1 = require("../types/error");
class DeleteCommand extends core_1.Command {
    constructor() {
        super(...arguments);
        this.todoService = new todoService_1.TodoService();
    }
    async run() {
        try {
            const { args, flags } = await this.parse(DeleteCommand);
            const list = await this.todoService.getList(args.listName);
            if (!list) {
                throw new error_1.CLIError(`List "${args.listName}" not found`, 'LIST_NOT_FOUND');
            }
            if (flags.all) {
                if (!flags.force) {
                    const shouldDelete = await (0, prompts_1.confirm)({
                        message: `Are you sure you want to delete the entire list "${args.listName}"?`,
                        default: false
                    });
                    if (!shouldDelete) {
                        this.log(chalk_1.default.yellow('Operation cancelled'));
                        return;
                    }
                }
                await this.todoService.deleteList(args.listName);
                this.log(chalk_1.default.green('✓'), `Deleted list: ${chalk_1.default.bold(args.listName)}`);
                this.log(chalk_1.default.dim(`Items removed: ${list.todos.length}`));
                return;
            }
            if (!flags.id) {
                throw new error_1.CLIError('Either --id or --all must be specified', 'MISSING_PARAMETER');
            }
            const todo = list.todos.find(t => t.id === flags.id);
            if (!todo) {
                throw new error_1.CLIError(`Todo "${flags.id}" not found in list "${args.listName}"`, 'TODO_NOT_FOUND');
            }
            if (!flags.force) {
                const shouldDelete = await (0, prompts_1.confirm)({
                    message: `Are you sure you want to delete todo "${todo.task}"?`,
                    default: false
                });
                if (!shouldDelete) {
                    this.log(chalk_1.default.yellow('Operation cancelled'));
                    return;
                }
            }
            await this.todoService.deleteTodo(args.listName, flags.id);
            this.log(chalk_1.default.green('✓'), 'Deleted todo:', chalk_1.default.bold(todo.task));
            this.log(chalk_1.default.dim('List:'), args.listName);
            this.log(chalk_1.default.dim('ID:'), flags.id);
        }
        catch (error) {
            if (error instanceof error_1.CLIError) {
                throw error;
            }
            throw new error_1.CLIError(`Failed to delete todo: ${error instanceof Error ? error.message : String(error)}`, 'DELETE_FAILED');
        }
    }
}
DeleteCommand.description = 'Delete a todo item or list';
DeleteCommand.examples = [
    '<%= config.bin %> delete my-list -i task-123',
    '<%= config.bin %> delete my-list -i task-123 --force',
    '<%= config.bin %> delete my-list --all'
];
DeleteCommand.flags = {
    id: core_1.Flags.string({
        char: 'i',
        description: 'Todo ID to delete',
        exclusive: ['all']
    }),
    all: core_1.Flags.boolean({
        char: 'a',
        description: 'Delete entire list',
        exclusive: ['id']
    }),
    force: core_1.Flags.boolean({
        char: 'f',
        description: 'Skip confirmation prompt',
        default: false
    })
};
DeleteCommand.args = {
    listName: core_1.Args.string({
        name: 'listName',
        description: 'Name of the todo list',
        required: true
    })
};
exports.default = DeleteCommand;
