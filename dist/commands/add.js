"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const core_1 = require("@oclif/core");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const todoService_1 = require("../services/todoService");
const utils_1 = require("../utils");
const error_handler_1 = require("../utils/error-handler");
class AddCommand extends core_1.Command {
    async run() {
        const { args, flags } = await this.parse(AddCommand);
        const todoService = new todoService_1.TodoService();
        try {
            // Create or get the list
            let list = await todoService.getList(args.listName);
            if (!list) {
                list = {
                    id: args.listName,
                    name: args.listName,
                    owner: 'local',
                    todos: [],
                    version: 1
                };
                console.log(chalk_1.default.blue('✨ Created new list:'), chalk_1.default.bold(args.listName));
            }
            console.log(chalk_1.default.blue('\nAdding tasks to:'), chalk_1.default.bold(args.listName));
            // Add each task from the -t flags
            for (const taskText of flags.task) {
                const todo = {
                    id: (0, utils_1.generateId)(),
                    task: taskText,
                    completed: false,
                    priority: flags.priority,
                    tags: flags.tags ? flags.tags.split(',').map(t => t.trim()) : [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    private: flags.private
                };
                if (flags.due) {
                    if (!(0, utils_1.validateDate)(flags.due)) {
                        throw new error_handler_1.CLIError('Invalid date format. Use YYYY-MM-DD', 'INVALID_DATE');
                    }
                    todo.dueDate = flags.due;
                }
                list.todos.push(todo);
                // Enhanced feedback with emoji indicators
                const priorityEmoji = {
                    high: '⚡',
                    medium: '○',
                    low: '▿'
                }[todo.priority];
                console.log(chalk_1.default.green('✓'), 'Added:', chalk_1.default.bold(taskText));
                const details = [
                    `${priorityEmoji} Priority: ${todo.priority}`,
                    flags.due && `📅 Due: ${flags.due}`,
                    todo.tags.length > 0 && `🏷️  Tags: ${todo.tags.join(', ')}`,
                    flags.private && '🔒 Private'
                ].filter(Boolean);
                if (details.length) {
                    console.log(chalk_1.default.dim(`  ${details.join(' | ')}`));
                }
            }
            await todoService.saveList(args.listName, list);
            console.log(chalk_1.default.blue('\nSummary:'));
            console.log(chalk_1.default.dim(`• List: ${args.listName}`));
            console.log(chalk_1.default.dim(`• Total items: ${list.todos.length}`));
            console.log(chalk_1.default.dim(`• Added: ${flags.task.length} task(s)`));
        }
        catch (error) {
            throw error;
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
    listName: core_1.Args.string({
        name: 'listName',
        description: 'Name of the todo list',
        required: true
    })
};
exports.default = AddCommand;
