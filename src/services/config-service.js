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
exports.configService = exports.ConfigService = void 0;
var fs_1 = require("fs");
var path_1 = require("path");
var constants_1 = require("../constants");
var error_1 = require("../types/error");
var ConfigService = /** @class */ (function () {
    function ConfigService() {
        // Look for config file in current directory first, then in home directory
        var currentDirConfig = path_1.default.join(process.cwd(), constants_1.CLI_CONFIG.CONFIG_FILE);
        var homeDir = process.env.HOME || process.env.USERPROFILE || '';
        var homeDirConfig = path_1.default.join(homeDir, constants_1.CLI_CONFIG.CONFIG_FILE);
        // Use current directory config if it exists, otherwise use home directory
        this.configPath = fs_1.default.existsSync(currentDirConfig) ? currentDirConfig : homeDirConfig;
        this.todosPath = path_1.default.resolve(process.cwd(), 'Todos');
        this.config = this.loadConfig();
        this.ensureTodosDirectory();
    }
    ConfigService.prototype.ensureTodosDirectory = function () {
        try {
            if (!fs_1.default.existsSync(this.todosPath)) {
                fs_1.default.mkdirSync(this.todosPath, { recursive: true });
            }
        }
        catch (error) {
            throw new error_1.CLIError("Failed to create Todos directory: ".concat(error instanceof Error ? error.message : 'Unknown error'), 'DIRECTORY_CREATE_FAILED');
        }
    };
    ConfigService.prototype.getListPath = function (listName) {
        return path_1.default.join(this.todosPath, "".concat(listName, ".json"));
    };
    ConfigService.prototype.loadConfig = function () {
        try {
            if (fs_1.default.existsSync(this.configPath)) {
                var data = fs_1.default.readFileSync(this.configPath, 'utf8');
                return JSON.parse(data);
            }
        }
        catch (error) {
            throw new error_1.CLIError("Failed to load config: ".concat(error instanceof Error ? error.message : 'Unknown error'), 'CONFIG_LOAD_FAILED');
        }
        return {
            network: 'testnet',
            walletAddress: '',
            encryptedStorage: false
        };
    };
    ConfigService.prototype.getConfig = function () {
        return this.config;
    };
    ConfigService.prototype.saveConfig = function (config) {
        return __awaiter(this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.config = __assign(__assign({}, this.config), config);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, fs_1.default.promises.writeFile(this.configPath, JSON.stringify(this.config, null, 2))];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        throw new error_1.CLIError("Failed to save config: ".concat(error_2 instanceof Error ? error_2.message : 'Unknown error'), 'CONFIG_SAVE_FAILED');
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    ConfigService.prototype.loadListData = function (listName) {
        return __awaiter(this, void 0, void 0, function () {
            var listPath, data, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        listPath = this.getListPath(listName);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        if (!fs_1.default.existsSync(listPath)) return [3 /*break*/, 3];
                        return [4 /*yield*/, fs_1.default.promises.readFile(listPath, 'utf-8')];
                    case 2:
                        data = _a.sent();
                        return [2 /*return*/, JSON.parse(data)];
                    case 3: return [3 /*break*/, 5];
                    case 4:
                        error_3 = _a.sent();
                        throw new error_1.CLIError("Failed to load list \"".concat(listName, "\": ").concat(error_3 instanceof Error ? error_3.message : 'Unknown error'), 'LIST_LOAD_FAILED');
                    case 5: return [2 /*return*/, null];
                }
            });
        });
    };
    ConfigService.prototype.saveListData = function (listName, list) {
        return __awaiter(this, void 0, void 0, function () {
            var listPath, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        listPath = this.getListPath(listName);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, fs_1.default.promises.writeFile(listPath, JSON.stringify(list, null, 2))];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, list];
                    case 3:
                        error_4 = _a.sent();
                        throw new error_1.CLIError("Failed to save list \"".concat(listName, "\": ").concat(error_4 instanceof Error ? error_4.message : 'Unknown error'), 'LIST_SAVE_FAILED');
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    ConfigService.prototype.getLocalTodos = function (listName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.loadListData(listName)];
            });
        });
    };
    ConfigService.prototype.getAllLists = function () {
        return __awaiter(this, void 0, void 0, function () {
            var files, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, fs_1.default.promises.readdir(this.todosPath)];
                    case 1:
                        files = _a.sent();
                        return [2 /*return*/, files
                                .filter(function (file) { return file.endsWith('.json'); })
                                .map(function (file) { return file.replace('.json', ''); })];
                    case 2:
                        error_5 = _a.sent();
                        throw new error_1.CLIError("Failed to read todo lists: ".concat(error_5 instanceof Error ? error_5.message : 'Unknown error'), 'LIST_READ_FAILED');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    ConfigService.prototype.saveLocalTodo = function (listName, todo) {
        return __awaiter(this, void 0, void 0, function () {
            var list;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.loadListData(listName)];
                    case 1:
                        list = _a.sent();
                        if (!list) {
                            list = {
                                id: listName,
                                name: listName,
                                owner: 'local',
                                todos: [],
                                version: 1,
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            };
                        }
                        list.todos.push(todo);
                        return [4 /*yield*/, this.saveListData(listName, list)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ConfigService.prototype.updateLocalTodo = function (listName, todo) {
        return __awaiter(this, void 0, void 0, function () {
            var list, index;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.loadListData(listName)];
                    case 1:
                        list = _a.sent();
                        if (!list) {
                            throw new error_1.CLIError("List \"".concat(listName, "\" not found"), 'LIST_NOT_FOUND');
                        }
                        index = list.todos.findIndex(function (t) { return t.id === todo.id; });
                        if (index === -1) {
                            throw new error_1.CLIError("Todo \"".concat(todo.id, "\" not found in list \"").concat(listName, "\""), 'TODO_NOT_FOUND');
                        }
                        list.todos[index] = todo;
                        list.updatedAt = new Date().toISOString();
                        return [4 /*yield*/, this.saveListData(listName, list)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ConfigService.prototype.deleteLocalTodo = function (listName, todoId) {
        return __awaiter(this, void 0, void 0, function () {
            var list, todoIndex;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.loadListData(listName)];
                    case 1:
                        list = _a.sent();
                        if (!list) {
                            throw new error_1.CLIError("List \"".concat(listName, "\" not found"), 'LIST_NOT_FOUND');
                        }
                        todoIndex = list.todos.findIndex(function (t) { return t.id === todoId; });
                        if (todoIndex === -1) {
                            throw new error_1.CLIError("Todo \"".concat(todoId, "\" not found in list \"").concat(listName, "\""), 'TODO_NOT_FOUND');
                        }
                        list.todos = list.todos.filter(function (t) { return t.id !== todoId; });
                        list.updatedAt = new Date().toISOString();
                        return [4 /*yield*/, this.saveListData(listName, list)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ConfigService.prototype.deleteList = function (listName) {
        return __awaiter(this, void 0, void 0, function () {
            var listPath, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        listPath = this.getListPath(listName);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        if (!fs_1.default.existsSync(listPath)) return [3 /*break*/, 3];
                        return [4 /*yield*/, fs_1.default.promises.unlink(listPath)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [3 /*break*/, 5];
                    case 4:
                        error_6 = _a.sent();
                        throw new error_1.CLIError("Failed to delete list \"".concat(listName, "\": ").concat(error_6 instanceof Error ? error_6.message : 'Unknown error'), 'LIST_DELETE_FAILED');
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    ConfigService.prototype.getLocalTodoById = function (todoId) {
        return __awaiter(this, void 0, void 0, function () {
            var lists, _i, lists_1, listName, list, todo;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getAllLists()];
                    case 1:
                        lists = _a.sent();
                        _i = 0, lists_1 = lists;
                        _a.label = 2;
                    case 2:
                        if (!(_i < lists_1.length)) return [3 /*break*/, 5];
                        listName = lists_1[_i];
                        return [4 /*yield*/, this.loadListData(listName)];
                    case 3:
                        list = _a.sent();
                        if (list) {
                            todo = list.todos.find(function (t) { return t.id === todoId; });
                            if (todo)
                                return [2 /*return*/, todo];
                        }
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/, null];
                }
            });
        });
    };
    return ConfigService;
}());
exports.ConfigService = ConfigService;
exports.configService = new ConfigService();
