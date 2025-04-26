"use strict";
/**
 * Delete Command Module
 * Handles removal of todo items
 * Supports deletion from both local and Walrus storage
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTodo = deleteTodo;
const chalk_1 = __importDefault(require("chalk"));
const prompts_1 = require("@inquirer/prompts");
const walrus_service_1 = require("../services/walrus-service");
/**
 * Deletes a todo item with optional confirmation
 * @param options - Command line options for deleting todo
 */
async function deleteTodo(options) {
    try {
        const { list, id, force } = options;
        if (!force) {
            const shouldDelete = await (0, prompts_1.confirm)({
                message: 'Are you sure you want to delete this todo?',
                default: false
            });
            if (!shouldDelete) {
                console.log(chalk_1.default.yellow('Operation cancelled'));
                return;
            }
        }
        await walrus_service_1.walrusService.deleteTodo(list, id);
        console.log(chalk_1.default.green('✔ Todo deleted successfully'));
        console.log(chalk_1.default.dim('List:'), list);
        console.log(chalk_1.default.dim('ID:'), id);
    }
    catch (error) {
        console.error(chalk_1.default.red('Failed to delete todo:'), error);
        process.exit(1);
    }
}
