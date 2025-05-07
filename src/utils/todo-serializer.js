"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TodoSerializer = void 0;
/**
 * Serializer utility for converting todos to/from various formats
 */
var TodoSerializer = /** @class */ (function () {
    function TodoSerializer() {
    }
    TodoSerializer.todoToBuffer = function (todo) {
        return Buffer.from(JSON.stringify(todo));
    };
    TodoSerializer.bufferToTodo = function (buffer) {
        return JSON.parse(buffer.toString());
    };
    TodoSerializer.todoListToBuffer = function (todoList) {
        return Buffer.from(JSON.stringify(todoList));
    };
    TodoSerializer.bufferToTodoList = function (buffer) {
        return JSON.parse(buffer.toString());
    };
    return TodoSerializer;
}());
exports.TodoSerializer = TodoSerializer;
