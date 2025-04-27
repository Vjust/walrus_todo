"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryWithBackoff = retryWithBackoff;
exports.generateId = generateId;
exports.formatDate = formatDate;
exports.isValidListName = isValidListName;
exports.parseTags = parseTags;
exports.sleep = sleep;
exports.formatTodo = formatTodo;
exports.validateDate = validateDate;
exports.validatePriority = validatePriority;
exports.formatTodoOutput = formatTodoOutput;
/**
 * Utility functions
 */
/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param maxRetries Maximum number of retries
 * @param baseDelay Base delay in milliseconds
 * @param maxDelay Maximum delay in milliseconds
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000, maxDelay = 10000) {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt === maxRetries - 1)
                break;
            // Calculate delay with exponential backoff
            const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
            // Add some jitter
            const jitter = Math.random() * 100;
            await new Promise(resolve => setTimeout(resolve, delay + jitter));
        }
    }
    throw lastError;
}
/**
 * Generate a unique ID
 * @returns string A unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
/**
 * Format a date to ISO string without milliseconds
 * @param date Date to format
 * @returns string Formatted date
 */
function formatDate(date = new Date()) {
    return date.toISOString().split('.')[0] + 'Z';
}
/**
 * Validate a todo list name
 * @param name Name to validate
 * @returns boolean Whether the name is valid
 */
function isValidListName(name) {
    return /^[a-zA-Z0-9-_]+$/.test(name);
}
/**
 * Parse tags string into array
 * @param tags Comma-separated tags string
 * @returns string[] Array of tags
 */
function parseTags(tags) {
    return tags
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean);
}
/**
 * Sleep for specified milliseconds
 * @param ms Milliseconds to sleep
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Format a todo for display
 * @param todo Todo to format
 * @returns string Formatted todo string
 */
function formatTodo(todo) {
    const status = todo.completed ? '✓' : '☐';
    const priority = todo.priority.toUpperCase();
    const dueDate = todo.dueDate ? ` (due: ${todo.dueDate})` : '';
    const tags = todo.tags.length ? ` [${todo.tags.join(', ')}]` : '';
    return `${status} ${todo.task} - ${priority}${dueDate}${tags}`;
}
function validateDate(date) {
    const parsedDate = new Date(date);
    return parsedDate.toString() !== 'Invalid Date';
}
function validatePriority(priority) {
    return ['high', 'medium', 'low'].includes(priority.toLowerCase());
}
function formatTodoOutput(todo) {
    const status = todo.completed ? '✓' : '⃞';
    const priority = {
        high: '⚠️',
        medium: '•',
        low: '○'
    }[todo.priority] || '•';
    return `${status} ${priority} ${todo.task}${todo.dueDate ? ` (due: ${todo.dueDate})` : ''}${todo.tags.length ? ` [${todo.tags.join(', ')}]` : ''}`;
}
