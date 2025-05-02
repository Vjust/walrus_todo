"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const core_1 = require("@oclif/core");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const todoService_1 = require("../services/todoService");
const utils_1 = require("../utils");
const error_handler_1 = require("../utils/error-handler");
class UpdateCommand extends core_1.Command {
    async run() {
        const { args, flags } = await this.parse(UpdateCommand);
        const todoService = new todoService_1.TodoService();
        try {
            const list = await todoService.getList(args.listName);
            if (!list) {
                throw new error_handler_1.CLIError(`List "${args.listName}" not found`, 'INVALID_LIST');
            }
            const todo = list.todos.find(t => t.id === flags.id);
            if (!todo) {
                throw new error_handler_1.CLIError(`Todo with ID "${flags.id}" not found`, 'INVALID_TASK_ID');
            }
            let changes = 0;
            // Update task if provided
            if (flags.task) {
                todo.task = flags.task;
                changes++;
            }
            // Update priority if provided
            if (flags.priority) {
                if (!(0, utils_1.validatePriority)(flags.priority)) {
                    throw new error_handler_1.CLIError('Invalid priority. Must be high, medium, or low', 'INVALID_PRIORITY');
                }
                todo.priority = flags.priority;
                changes++;
            }
            // Update due date if provided
            if (flags.due) {
                if (!(0, utils_1.validateDate)(flags.due)) {
                    throw new error_handler_1.CLIError('Invalid date format. Use YYYY-MM-DD', 'INVALID_DATE');
                }
                todo.dueDate = flags.due;
                changes++;
            }
            // Update tags if provided
            if (flags.tags) {
                todo.tags = flags.tags.split(',').map(tag => tag.trim());
                changes++;
            }
            // Update private flag if provided
            if (flags.private !== undefined) {
                todo.private = flags.private;
                changes++;
            }
            if (changes === 0) {
                this.log(chalk_1.default.yellow('No changes specified. Use -h to see available options.'));
                return;
            }
            todo.updatedAt = new Date().toISOString();
            await todoService.saveList(args.listName, list);
            this.log(chalk_1.default.green('✓') + ' Updated todo: ' + chalk_1.default.bold(todo.task));
            this.log(chalk_1.default.dim('List: ') + args.listName);
            this.log(chalk_1.default.dim('ID: ') + flags.id);
            this.log(chalk_1.default.dim(`Changes made: ${changes}`));
        }
        catch (error) {
            throw error;
        }
    }
}
UpdateCommand.description = 'Update an existing todo item';
UpdateCommand.examples = [
    '<%= config.bin %> update my-list -i task-123 -t "Updated task"',
    '<%= config.bin %> update my-list -i task-123 -p high',
    '<%= config.bin %> update my-list -i task-123 -d 2024-05-01'
];
UpdateCommand.flags = {
    id: core_1.Flags.string({
        char: 'i',
        description: 'Todo ID to update',
        required: true
    }),
    task: core_1.Flags.string({
        char: 't',
        description: 'New task description'
    }),
    priority: core_1.Flags.string({
        char: 'p',
        description: 'New priority (high, medium, low)',
        options: ['high', 'medium', 'low']
    }),
    due: core_1.Flags.string({
        char: 'd',
        description: 'New due date (YYYY-MM-DD)'
    }),
    tags: core_1.Flags.string({
        char: 'g',
        description: 'New comma-separated tags'
    }),
    private: core_1.Flags.boolean({
        description: 'Mark todo as private'
    })
};
UpdateCommand.args = {
    listName: core_1.Args.string({
        name: 'listName',
        description: 'Name of the todo list',
        required: true
    })
};
exports.default = UpdateCommand;
