"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const core_1 = require("@oclif/core");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const todoService_1 = require("../services/todoService");
const error_handler_1 = require("../utils/error-handler");
class ListCommand extends core_1.Command {
    async run() {
        const { args, flags } = await this.parse(ListCommand);
        const todoService = new todoService_1.TodoService();
        try {
            if (args.listName) {
                const list = await todoService.getList(args.listName);
                if (!list) {
                    throw new error_handler_1.CLIError(`List "${args.listName}" not found`, 'INVALID_LIST');
                }
                // Display list header
                console.log(chalk_1.default.blue('\n📋 List:'), chalk_1.default.bold(args.listName));
                const completed = list.todos.filter(t => t.completed).length;
                console.log(chalk_1.default.dim(`${completed}/${list.todos.length} completed\n`));
                // Filter and display todos
                let todos = list.todos;
                if (flags.completed)
                    todos = todos.filter(t => t.completed);
                if (flags.pending)
                    todos = todos.filter(t => !t.completed);
                if (todos.length === 0) {
                    console.log(chalk_1.default.yellow('No matching todos found'));
                }
                else {
                    todos.forEach((todo) => {
                        var _a;
                        const status = todo.completed ? chalk_1.default.green('✓') : chalk_1.default.yellow('☐');
                        const priority = {
                            high: chalk_1.default.red('⚡'),
                            medium: chalk_1.default.yellow('○'),
                            low: chalk_1.default.blue('▿')
                        }[todo.priority];
                        console.log(`${status} ${priority} ${todo.task}`);
                        const details = [
                            todo.dueDate && `Due: ${todo.dueDate}`,
                            ((_a = todo.tags) === null || _a === void 0 ? void 0 : _a.length) && `Tags: ${todo.tags.join(', ')}`,
                            todo.private && 'Private'
                        ].filter(Boolean);
                        if (details.length) {
                            console.log(chalk_1.default.dim(`   ${details.join(' | ')}`));
                        }
                    });
                }
            }
            else {
                // List all todo lists
                const lists = await todoService.getAllLists();
                if (lists.length === 0) {
                    console.log(chalk_1.default.yellow('\nNo todo lists found'));
                    console.log(chalk_1.default.dim('\nCreate your first list:'));
                    console.log(`$ ${this.config.bin} add my-list -t "My first task"`);
                    return;
                }
                console.log(chalk_1.default.blue('\n📚 Available Lists:'));
                for (const listName of lists) {
                    const list = await todoService.getList(listName);
                    if (list) {
                        const completed = list.todos.filter(t => t.completed).length;
                        console.log(`${chalk_1.default.white('•')} ${listName} ${chalk_1.default.dim(`(${completed}/${list.todos.length} completed)`)}`);
                    }
                }
            }
            console.log(); // Add newline at end
        }
        catch (error) {
            throw error;
        }
    }
}
ListCommand.description = 'List todos or todo lists';
ListCommand.examples = [
    '<%= config.bin %> list',
    '<%= config.bin %> list my-list',
    '<%= config.bin %> list my-list --completed',
    '<%= config.bin %> list my-list --pending'
];
ListCommand.flags = {
    completed: core_1.Flags.boolean({
        description: 'Show only completed items',
        exclusive: ['pending']
    }),
    pending: core_1.Flags.boolean({
        description: 'Show only pending items',
        exclusive: ['completed']
    })
};
ListCommand.args = {
    listName: core_1.Args.string({
        name: 'listName',
        description: 'Name of the todo list to display',
        required: false
    })
};
exports.default = ListCommand;
