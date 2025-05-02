"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDate = validateDate;
exports.validatePriority = validatePriority;
exports.formatTodoOutput = formatTodoOutput;
exports.formatDate = formatDate;
exports.sleep = sleep;
const tslib_1 = require("tslib");
tslib_1.__exportStar(require("./error-handler"), exports);
tslib_1.__exportStar(require("./id-generator"), exports);
function validateDate(dateStr) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr))
        return false;
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
}
function validatePriority(priority) {
    return ['high', 'medium', 'low'].includes(priority);
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
function formatDate(date = new Date()) {
    return date.toISOString().split('.')[0] + 'Z';
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
