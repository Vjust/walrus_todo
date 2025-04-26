"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.formatDate = formatDate;
exports.formatTodoOutput = formatTodoOutput;
exports.validateDate = validateDate;
exports.validatePriority = validatePriority;
exports.retryWithBackoff = retryWithBackoff;
const chalk_1 = __importDefault(require("chalk"));
function generateId() {
    return Math.random().toString(36).substring(2, 15);
}
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}
function formatTodoOutput(todo) {
    const status = todo.completed ? chalk_1.default.green('✔') : chalk_1.default.yellow('○');
    const description = todo.completed ? chalk_1.default.dim(todo.description) : todo.description;
    let output = `${status} ${description}`;
    if (todo.priority) {
        const priorityColors = {
            high: chalk_1.default.red,
            medium: chalk_1.default.yellow,
            low: chalk_1.default.green,
        };
        output += ` ${priorityColors[todo.priority](`[${todo.priority}]`)}`;
    }
    if (todo.dueDate) {
        output += ` ${chalk_1.default.blue(`(due: ${formatDate(todo.dueDate)})`)}`;
    }
    if (todo.tags && todo.tags.length > 0) {
        output += ` ${chalk_1.default.cyan(todo.tags.map((tag) => `#${tag}`).join(' '))}`;
    }
    return output;
}
function validateDate(date) {
    const parsedDate = new Date(date);
    return parsedDate.toString() !== 'Invalid Date';
}
function validatePriority(priority) {
    return ['high', 'medium', 'low'].includes(priority.toLowerCase());
}
/**
 * Utility to retry an async operation with exponential backoff
 *
 * @param operation - The async operation to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param baseDelay - Base delay in milliseconds between retries
 * @returns The result of the operation
 */
async function retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
    let lastError = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await operation();
        }
        catch (error) {
            console.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries}):`, error);
            lastError = error instanceof Error ? error : new Error(String(error));
            // Calculate exponential backoff delay
            const delay = baseDelay * Math.pow(2, attempt);
            // Add some jitter to prevent multiple retries happening at exactly the same time
            const jitter = Math.random() * 100;
            // Wait before next attempt
            await new Promise(resolve => setTimeout(resolve, delay + jitter));
        }
    }
    // If we've reached this point, all retries failed
    throw lastError || new Error('Operation failed after maximum retry attempts');
}
