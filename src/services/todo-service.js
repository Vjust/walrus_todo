"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TodoService = void 0;
var config_service_1 = require("./config-service");
var id_generator_1 = require("../utils/id-generator");
var error_1 = require("../types/error");
var TodoService = /** @class */ (function () {
    function TodoService() {
    }
    TodoService.prototype.createList = function (name, owner) {
        return __awaiter(this, void 0, void 0, function () {
            var list;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        list = {
                            id: (0, id_generator_1.generateId)(),
                            name: name,
                            owner: owner,
                            todos: [],
                            version: 1,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        };
                        return [4 /*yield*/, config_service_1.configService.saveListData(name, list)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, list];
                }
            });
        });
    };
    TodoService.prototype.getList = function (name) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, config_service_1.configService.getLocalTodos(name)];
            });
        });
    };
    TodoService.prototype.addTodo = function (listName, todo) {
        return __awaiter(this, void 0, void 0, function () {
            var list, newTodo;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getList(listName)];
                    case 1:
                        list = _a.sent();
                        if (!list) {
                            throw new error_1.CLIError("List \"".concat(listName, "\" not found"), 'LIST_NOT_FOUND');
                        }
                        newTodo = {
                            id: (0, id_generator_1.generateId)(),
                            title: todo.title || '',
                            completed: todo.completed || false,
                            description: todo.description,
                            priority: todo.priority || 'medium',
                            tags: todo.tags || [],
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                            private: true
                        };
                        list.todos.push(newTodo);
                        list.updatedAt = new Date().toISOString();
                        return [4 /*yield*/, config_service_1.configService.saveListData(listName, list)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, newTodo];
                }
            });
        });
    };
    TodoService.prototype.toggleItemStatus = function (listName, todoId, completed) {
        return __awaiter(this, void 0, void 0, function () {
            var list, todo;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getList(listName)];
                    case 1:
                        list = _a.sent();
                        if (!list) {
                            throw new error_1.CLIError("List \"".concat(listName, "\" not found"), 'LIST_NOT_FOUND');
                        }
                        todo = list.todos.find(function (t) { return t.id === todoId; });
                        if (!todo) {
                            throw new error_1.CLIError("Todo \"".concat(todoId, "\" not found in list \"").concat(listName, "\""), 'TODO_NOT_FOUND');
                        }
                        todo.completed = completed;
                        todo.updatedAt = new Date().toISOString();
                        if (completed) {
                            todo.completedAt = new Date().toISOString();
                        }
                        else {
                            delete todo.completedAt;
                        }
                        return [4 /*yield*/, config_service_1.configService.saveListData(listName, list)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return TodoService;
}());
exports.TodoService = TodoService;
