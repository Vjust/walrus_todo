"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var fs_1 = require("fs");
var promises_1 = require("fs/promises");
var path_1 = require("path");
var constants_1 = require("../constants");
var id_generator_1 = require("../utils/id-generator");
var error_1 = require("../types/error");
var TodoService = /** @class */ (function () {
    function TodoService() {
        this.todosDir = path_1.default.join(process.cwd(), constants_1.STORAGE_CONFIG.TODOS_DIR);
        promises_1.default.mkdir(this.todosDir, { recursive: true }).catch(function () { });
    }
    TodoService.prototype.getAllLists = function () {
        return __awaiter(this, void 0, void 0, function () {
            var files;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, promises_1.default.readdir(this.todosDir).catch(function () { return []; })];
                    case 1:
                        files = _a.sent();
                        return [2 /*return*/, files
                                .filter(function (f) { return f.endsWith(constants_1.STORAGE_CONFIG.FILE_EXT); })
                                .map(function (f) { return f.replace(constants_1.STORAGE_CONFIG.FILE_EXT, ''); })];
                }
            });
        });
    };
    TodoService.prototype.createList = function (name, owner) {
        return __awaiter(this, void 0, void 0, function () {
            var existingList, newList;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getList(name)];
                    case 1:
                        existingList = _a.sent();
                        if (existingList) {
                            throw new error_1.CLIError("List \"".concat(name, "\" already exists"), 'LIST_EXISTS');
                        }
                        newList = {
                            id: (0, id_generator_1.generateId)(),
                            name: name,
                            owner: owner,
                            todos: [],
                            version: 1,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        };
                        return [4 /*yield*/, this.saveList(name, newList)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, newList];
                }
            });
        });
    };
    TodoService.prototype.getList = function (listName) {
        return __awaiter(this, void 0, void 0, function () {
            var data, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, promises_1.default.readFile(path_1.default.join(this.todosDir, "".concat(listName).concat(constants_1.STORAGE_CONFIG.FILE_EXT)), 'utf8')];
                    case 1:
                        data = _a.sent();
                        return [2 /*return*/, JSON.parse(data)];
                    case 2:
                        err_1 = _a.sent();
                        return [2 /*return*/, null];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    TodoService.prototype.getTodo = function (todoId_1) {
        return __awaiter(this, arguments, void 0, function (todoId, listName) {
            var list;
            if (listName === void 0) { listName = 'default'; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getList(listName)];
                    case 1:
                        list = _a.sent();
                        if (!list)
                            return [2 /*return*/, null];
                        return [2 /*return*/, list.todos.find(function (t) { return t.id === todoId; }) || null];
                }
            });
        });
    };
    TodoService.prototype.getTodoByTitle = function (title_1) {
        return __awaiter(this, arguments, void 0, function (title, listName) {
            var list;
            if (listName === void 0) { listName = 'default'; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getList(listName)];
                    case 1:
                        list = _a.sent();
                        if (!list)
                            return [2 /*return*/, null];
                        // Find todo with exact title match (case-insensitive)
                        return [2 /*return*/, list.todos.find(function (t) { return t.title.toLowerCase() === title.toLowerCase(); }) || null];
                }
            });
        });
    };
    TodoService.prototype.getTodoByTitleOrId = function (titleOrId_1) {
        return __awaiter(this, arguments, void 0, function (titleOrId, listName) {
            var todoById;
            if (listName === void 0) { listName = 'default'; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getTodo(titleOrId, listName)];
                    case 1:
                        todoById = _a.sent();
                        if (todoById)
                            return [2 /*return*/, todoById];
                        // If not found by ID, try to find by title
                        return [2 /*return*/, this.getTodoByTitle(titleOrId, listName)];
                }
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
                            description: todo.description || '',
                            completed: false,
                            priority: todo.priority || 'medium',
                            tags: todo.tags || [],
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                            private: todo.private !== undefined ? todo.private : true,
                            storageLocation: todo.storageLocation || 'local'
                        };
                        list.todos.push(newTodo);
                        list.updatedAt = new Date().toISOString();
                        return [4 /*yield*/, this.saveList(listName, list)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, newTodo];
                }
            });
        });
    };
    TodoService.prototype.updateTodo = function (listName, todoId, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var list, todoIndex, todo, updatedTodo;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getList(listName)];
                    case 1:
                        list = _a.sent();
                        if (!list) {
                            throw new error_1.CLIError("List \"".concat(listName, "\" not found"), 'LIST_NOT_FOUND');
                        }
                        todoIndex = list.todos.findIndex(function (t) { return t.id === todoId; });
                        if (todoIndex === -1) {
                            throw new error_1.CLIError("Todo \"".concat(todoId, "\" not found in list \"").concat(listName, "\""), 'TODO_NOT_FOUND');
                        }
                        todo = list.todos[todoIndex];
                        updatedTodo = __assign(__assign(__assign({}, todo), updates), { updatedAt: new Date().toISOString() });
                        list.todos[todoIndex] = updatedTodo;
                        list.updatedAt = new Date().toISOString();
                        return [4 /*yield*/, this.saveList(listName, list)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, updatedTodo];
                }
            });
        });
    };
    TodoService.prototype.toggleItemStatus = function (listName, itemId, checked) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.updateTodo(listName, itemId, {
                            completed: checked,
                            completedAt: checked ? new Date().toISOString() : undefined
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    TodoService.prototype.deleteTodo = function (listName, todoId) {
        return __awaiter(this, void 0, void 0, function () {
            var list, todoIndex;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getList(listName)];
                    case 1:
                        list = _a.sent();
                        if (!list) {
                            throw new error_1.CLIError("List \"".concat(listName, "\" not found"), 'LIST_NOT_FOUND');
                        }
                        todoIndex = list.todos.findIndex(function (t) { return t.id === todoId; });
                        if (todoIndex === -1) {
                            throw new error_1.CLIError("Todo \"".concat(todoId, "\" not found in list \"").concat(listName, "\""), 'TODO_NOT_FOUND');
                        }
                        list.todos.splice(todoIndex, 1);
                        list.updatedAt = new Date().toISOString();
                        return [4 /*yield*/, this.saveList(listName, list)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    TodoService.prototype.saveList = function (listName, list) {
        return __awaiter(this, void 0, void 0, function () {
            var file, err_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        file = path_1.default.join(this.todosDir, "".concat(listName).concat(constants_1.STORAGE_CONFIG.FILE_EXT));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, promises_1.default.writeFile(file, JSON.stringify(list, null, 2), 'utf8')];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        err_2 = _a.sent();
                        throw new error_1.CLIError("Failed to save list \"".concat(listName, "\": ").concat(err_2 instanceof Error ? err_2.message : 'Unknown error'), 'SAVE_FAILED');
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    TodoService.prototype.deleteList = function (listName) {
        return __awaiter(this, void 0, void 0, function () {
            var file, err_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        file = path_1.default.join(this.todosDir, "".concat(listName).concat(constants_1.STORAGE_CONFIG.FILE_EXT));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        if (!fs_1.default.existsSync(file)) return [3 /*break*/, 3];
                        return [4 /*yield*/, promises_1.default.unlink(file)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [3 /*break*/, 5];
                    case 4:
                        err_3 = _a.sent();
                        throw new error_1.CLIError("Failed to delete list \"".concat(listName, "\": ").concat(err_3 instanceof Error ? err_3.message : 'Unknown error'), 'DELETE_FAILED');
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return TodoService;
}());
exports.TodoService = TodoService;
