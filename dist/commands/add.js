"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const core_1 = require("@oclif/core");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const todoService_1 = require("../services/todoService");
const utils_1 = require("../utils");
const error_1 = require("../types/error");
class AddCommand extends core_1.Command {
    constructor() {
        super(...arguments);
        this.todoService = new todoService_1.TodoService();
    }
    validateDate(date) {
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(date))
            return false;
        const d = new Date(date);
        return d instanceof Date && !isNaN(d.getTime());
    }
    async run() {
        try {
            const { args, flags } = await this.parse(AddCommand);
            if (flags.due && !this.validateDate(flags.due)) {
                throw new error_1.CLIError('Invalid date format. Use YYYY-MM-DD', 'INVALID_DATE');
            }
            const now = new Date().toISOString();
            const todo = {
                id: (0, utils_1.generateId)(),
                title: flags.task[0], // Use first task string as title
                task: flags.task.join(' '), // Join all task strings for backward compatibility
                completed: false,
                priority: flags.priority,
                tags: flags.tags ? flags.tags.split(',').map(t => t.trim()) : [],
                createdAt: now,
                updatedAt: now,
                private: flags.private
            };
            if (flags.due) {
                todo.dueDate = flags.due;
            }
            await this.todoService.addTodo(args.list, todo);
            // Get priority color
            const priorityColors = {
                high: chalk_1.default.red,
                medium: chalk_1.default.yellow,
                low: chalk_1.default.green
            }[todo.priority];
            // Success message
            this.log(chalk_1.default.green('\n✓ Todo added successfully'));
            this.log(chalk_1.default.dim('Details:'));
            this.log([
                `  ${chalk_1.default.bold(todo.title)}`,
                `  ${priorityColors(`⚡ Priority: ${todo.priority}`)}`,
                flags.due && `  📅 Due: ${flags.due}`,
                todo.tags.length > 0 && `  🏷️  Tags: ${todo.tags.join(', ')}`,
                flags.private && '  🔒 Private'
            ].filter(Boolean).join('\n'));
        }
        catch (error) {
            if (error instanceof error_1.CLIError) {
                throw error;
            }
            throw new error_1.CLIError(`Failed to add todo: ${error instanceof Error ? error.message : String(error)}`, 'ADD_FAILED');
        }
    }
}
AddCommand.description = 'Add new todo items to a list';
AddCommand.examples = [
    '<%= config.bin %> add my-list -t "Buy groceries"',
    '<%= config.bin %> add my-list -t "Important task" -p high',
    '<%= config.bin %> add my-list -t "Meeting" --due 2024-05-01'
];
AddCommand.flags = {
    task: core_1.Flags.string({
        char: 't',
        description: 'Task description',
        required: true,
        multiple: true
    }),
    priority: core_1.Flags.string({
        char: 'p',
        description: 'Task priority (high, medium, low)',
        options: ['high', 'medium', 'low'],
        default: 'medium'
    }),
    due: core_1.Flags.string({
        char: 'd',
        description: 'Due date (YYYY-MM-DD)'
    }),
    tags: core_1.Flags.string({
        char: 'g',
        description: 'Comma-separated tags'
    }),
    private: core_1.Flags.boolean({
        description: 'Mark todo as private',
        default: false
    })
};
AddCommand.args = {
    list: core_1.Args.string({
        name: 'list',
        description: 'Name of the todo list',
        default: 'default'
    })
};
exports.default = AddCommand;
