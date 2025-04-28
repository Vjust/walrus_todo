"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIError = void 0;
exports.handleError = handleError;
const tslib_1 = require("tslib");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const types_1 = require("../types");
class CLIError extends Error {
    constructor(message, code = 'GENERAL_ERROR') {
        super(message);
        this.code = code;
        this.name = 'CLIError';
    }
}
exports.CLIError = CLIError;
function handleError(error) {
    var _a, _b, _c;
    if (error instanceof types_1.WalrusError) {
        console.error(chalk_1.default.red('\nStorage Error:'), error.message);
        if (error.hint) {
            console.log(chalk_1.default.yellow('\nHint:'), error.hint);
        }
    }
    else if (error instanceof types_1.SuiError) {
        console.error(chalk_1.default.red('\nBlockchain Error:'), error.message);
        if (error.txHash) {
            console.log(chalk_1.default.dim('Transaction Hash:'), error.txHash);
        }
    }
    else if (error instanceof CLIError) {
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
    else if ((_a = error === null || error === void 0 ? void 0 : error.message) === null || _a === void 0 ? void 0 : _a.includes('Missing required flag')) {
        console.error(chalk_1.default.red('\nError:'), error.message);
        console.log(chalk_1.default.yellow('\nExample usage:'));
        console.log('• waltodo add -l "my-list" -t "my task"');
        console.log('• waltodo list -l "my-list"');
    }
    else if ((_b = error === null || error === void 0 ? void 0 : error.message) === null || _b === void 0 ? void 0 : _b.includes('Unknown command')) {
        console.error(chalk_1.default.red('\nError: Unknown command'));
        console.log(chalk_1.default.yellow('\nAvailable commands:'));
        console.log('• add      - Add new todo(s)');
        console.log('• list     - List todos or todo lists');
        console.log('• update   - Update a todo');
        console.log('• check    - Mark a todo as complete/incomplete');
        console.log('• delete   - Delete a todo or list');
        console.log('• publish  - Publish list to blockchain');
        console.log('• sync     - Sync with blockchain');
        console.log('• configure- Configure CLI settings');
        console.log('\nRun "waltodo --help" for more information');
    }
    else if ((_c = error === null || error === void 0 ? void 0 : error.message) === null || _c === void 0 ? void 0 : _c.includes('unknown option')) {
        console.error(chalk_1.default.red('\nError:'), error.message);
        console.log(chalk_1.default.yellow('\nUse --help to see available options'));
    }
    else {
        console.error(chalk_1.default.red('\nError:'), (error === null || error === void 0 ? void 0 : error.message) || 'An unknown error occurred');
        console.log(chalk_1.default.yellow('\nIf this persists, try:'));
        console.log('1. Run "waltodo configure" to check your settings');
        console.log('2. Check your network connection');
        console.log('3. Ensure you have proper permissions');
    }
    process.exit(1);
}
