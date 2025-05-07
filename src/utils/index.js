"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDate = validateDate;
exports.validatePriority = validatePriority;
exports.formatTodoOutput = formatTodoOutput;
exports.formatDate = formatDate;
exports.sleep = sleep;
__exportStar(require("./error-handler"), exports);
__exportStar(require("./id-generator"), exports);
__exportStar(require("./todo-serializer"), exports);
__exportStar(require("./walrus-storage"), exports);
function validateDate(dateStr) {
    var dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr))
        return false;
    var date = new Date(dateStr);
    return !isNaN(date.getTime());
}
function validatePriority(priority) {
    return ['high', 'medium', 'low'].includes(priority);
}
function formatTodoOutput(todo) {
    var status = todo.completed ? '✓' : '⃞';
    var priority = {
        high: '⚠️',
        medium: '•',
        low: '○'
    }[todo.priority] || '•';
    return "".concat(status, " ").concat(priority, " ").concat(todo.title).concat(todo.dueDate ? " (due: ".concat(todo.dueDate, ")") : '').concat(todo.tags.length ? " [".concat(todo.tags.join(', '), "]") : '');
}
function formatDate(date) {
    if (date === void 0) { date = new Date(); }
    return date.toISOString().split('.')[0] + 'Z';
}
function sleep(ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
}
