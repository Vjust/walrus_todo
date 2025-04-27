"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIError = void 0;
exports.handleError = handleError;
const chalk_1 = __importDefault(require("chalk"));
class CLIError extends Error {
    constructor(message, code = 'GENERAL_ERROR') {
        super(message);
        this.code = code;
        this.name = 'CLIError';
    }
}
exports.CLIError = CLIError;
function handleError(error) {
    if (error instanceof CLIError) {
        console.error(chalk_1.default.red('\nError:'), error.message);
        // Add helpful suggestions based on error code
        switch (error.code) {
            case 'INVALID_LIST':
                console.log(chalk_1.default.yellow('\nSuggestions:'));
                console.log('• Check if the list name is correct');
                console.log('• Use "waltodo list" to see all available lists');
                console.log('• Create the list first using "waltodo add <list-name> -t <task>"');
                break;
            case 'INVALID_TASK_ID':
                console.log(chalk_1.default.yellow('\nSuggestions:'));
                console.log('• Check if the task ID is correct');
                console.log('• Use "waltodo list <list-name>" to see all tasks and their IDs');
                break;
            case 'INVALID_PRIORITY':
                console.log(chalk_1.default.yellow('\nSuggestions:'));
                console.log('• Priority must be one of: high, medium, low');
                console.log('• Example: waltodo add "my-list" -t "task" -p high');
                break;
            case 'INVALID_DATE':
                console.log(chalk_1.default.yellow('\nSuggestions:'));
                console.log('• Date must be in YYYY-MM-DD format');
                console.log('• Example: waltodo add "my-list" -t "task" -d 2024-12-31');
                break;
            case 'NO_TASKS':
                console.log(chalk_1.default.yellow('\nSuggestions:'));
                console.log('• Add at least one task using -t flag');
                console.log('• Example: waltodo add "my-list" -t "task1" -t "task2"');
                break;
            case 'MISSING_LIST':
                console.log(chalk_1.default.yellow('\nSuggestions:'));
                console.log('• Specify a list name using -l flag or as first argument');
                console.log('• Example: waltodo add "my-list" -t "task"');
                console.log('• Or: waltodo add -l "my-list" -t "task"');
                break;
        }
    }
    else if (error?.message?.includes('Unknown command')) {
        console.error(chalk_1.default.red('\nError: Unknown command'));
        console.log(chalk_1.default.yellow('\nAvailable commands:'));
        console.log('• add     - Add new todo(s)');
        console.log('• list    - List todos or todo lists');
        console.log('• update  - Update a todo');
        console.log('• check   - Mark a todo as complete/incomplete');
        console.log('• delete  - Delete a todo or list');
        console.log('• publish - Publish list to blockchain');
        console.log('• sync    - Sync with blockchain');
        console.log('\nRun "waltodo --help" for more information');
    }
    else if (error?.message?.includes('unknown option')) {
        console.error(chalk_1.default.red('\nError:'), error.message);
        console.log(chalk_1.default.yellow('\nRun "waltodo <command> --help" to see available options'));
    }
    else {
        console.error(chalk_1.default.red('\nError:'), error?.message || 'An unknown error occurred');
    }
    process.exit(1);
}
