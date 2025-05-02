"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const core_1 = require("@oclif/core");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const todoService_1 = require("../services/todoService");
const error_1 = require("../types/error");
class CompleteCommand extends core_1.Command {
    constructor() {
        super(...arguments);
        this.todoService = new todoService_1.TodoService();
    }
    async run() {
        try {
            const { args, flags } = await this.parse(CompleteCommand);
            const list = await this.todoService.getList(args.list);
            if (!list) {
                throw new error_1.CLIError(`List "${args.list}" not found`, 'LIST_NOT_FOUND');
            }
            const todo = list.todos.find(t => t.id === flags.id);
            if (!todo) {
                throw new error_1.CLIError(`Todo "${flags.id}" not found in list "${args.list}"`, 'TODO_NOT_FOUND');
            }
            await this.todoService.toggleItemStatus(args.list, flags.id, true);
            this.log(chalk_1.default.green(`\n✓ Marked todo as completed`));
            this.log(chalk_1.default.dim('Details:'));
            this.log(`  ${chalk_1.default.bold(todo.title)}`);
        }
        catch (error) {
            if (error instanceof error_1.CLIError) {
                throw error;
            }
            throw new error_1.CLIError(`Failed to complete todo: ${error instanceof Error ? error.message : String(error)}`, 'COMPLETE_FAILED');
        }
    }
}
CompleteCommand.description = 'Mark a todo as completed';
CompleteCommand.examples = [
    '<%= config.bin %> complete my-list -i todo-123'
];
CompleteCommand.flags = {
    id: core_1.Flags.string({
        char: 'i',
        description: 'Todo ID to mark as completed',
        required: true
    })
};
CompleteCommand.args = {
    list: core_1.Args.string({
        name: 'list',
        description: 'List name',
        default: 'default'
    })
};
exports.default = CompleteCommand;
