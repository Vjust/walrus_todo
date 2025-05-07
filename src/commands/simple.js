"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
var core_1 = require("@oclif/core");
var todoService_1 = require("../services/todoService");
var error_1 = require("../types/error");
// Removed unused Todo import
var chalk_1 = require("chalk");
var SimpleCommand = /** @class */ (function (_super) {
    __extends(SimpleCommand, _super);
    function SimpleCommand() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.todoService = new todoService_1.TodoService();
        return _this;
    }
    SimpleCommand.prototype.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, args, flags, _b, todo, todoList, filteredTodos, error_2;
            var _this = this;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.parse(SimpleCommand)];
                    case 1:
                        _a = _c.sent(), args = _a.args, flags = _a.flags;
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 13, , 14]);
                        _b = args.action;
                        switch (_b) {
                            case 'create': return [3 /*break*/, 3];
                            case 'add': return [3 /*break*/, 5];
                            case 'list': return [3 /*break*/, 7];
                            case 'complete': return [3 /*break*/, 9];
                        }
                        return [3 /*break*/, 11];
                    case 3: return [4 /*yield*/, this.todoService.createList(args.list, 'local-user')];
                    case 4:
                        _c.sent(); // Removed unused list variable assignment
                        this.log("✅ Todo list \"" + args.list + "\" created successfully");
                        return [3 /*break*/, 12];
                    case 5:
                        if (!args.title) {
                            throw new Error('Title is required for add command');
                        }
                        return [4 /*yield*/, this.todoService.addTodo(args.list, {
                                title: args.title,
                                completed: false,
                                priority: flags.priority,
                                tags: flags.tags ? flags.tags.split(',').map(function (t) { return t.trim(); }) : [],
                                private: true
                            })];
                    case 6:
                        todo = _c.sent();
                        this.log("✅ Added todo \"" + todo.title + "\" to list \"" + args.list + "\""); // Changed to double quotes for consistency
                        return [3 /*break*/, 12];
                    case 7: return [4 /*yield*/, this.todoService.getList(args.list)];
                    case 8:
                        todoList = _c.sent();
                        if (!todoList) {
                            this.log("List \"".concat(args.list, "\" not found"));
                            return [2 /*return*/];
                        }
                        this.log("\n".concat(chalk_1.default.bold(todoList.name), " (").concat(todoList.todos.length, " todos):"));
                        filteredTodos = todoList.todos;
                        // Apply filter if specified
                        if (flags.filter) {
                            if (flags.filter === 'completed') {
                                filteredTodos = filteredTodos.filter(function (todo) { return todo.completed; });
                            }
                            else if (flags.filter === 'incomplete') {
                                filteredTodos = filteredTodos.filter(function (todo) { return !todo.completed; });
                            }
                            else {
                                this.warn("Unknown filter: ".concat(flags.filter, ". Ignoring."));
                            }
                        }
                        // Apply sort if specified
                        if (flags.sort) {
                            if (flags.sort === 'priority') {
                                filteredTodos.sort(function (a, b) {
                                    var priorityOrder = { high: 3, medium: 2, low: 1 };
                                    return priorityOrder[b.priority] - priorityOrder[a.priority];
                                });
                            }
                            else if (flags.sort === 'title') {
                                filteredTodos.sort(function (a, b) { return a.title.localeCompare(b.title); });
                            }
                            else {
                                this.warn("Unknown sort field: ".concat(flags.sort, ". Ignoring."));
                            }
                        }
                        // Display the todos
                        filteredTodos.forEach(function (todo) {
                            var status = todo.completed ? chalk_1.default.green('✓') : chalk_1.default.gray('☐');
                            var priority = todo.priority === 'high' ? chalk_1.default.red('⚠️') :
                                todo.priority === 'medium' ? chalk_1.default.yellow('•') :
                                    chalk_1.default.green('○');
                            _this.log("".concat(status, " ").concat(priority, " ").concat(todo.title, " (").concat(todo.id, ")"));
                            if (todo.tags.length > 0) {
                                _this.log("   ".concat(chalk_1.default.dim("Tags: " + todo.tags.join(', ')))); // Changed to double quotes for consistency
                            }
                        });
                        return [3 /*break*/, 12];
                    case 9:
                        if (!flags.id) {
                            throw new Error('Todo ID is required for complete command (use --id)');
                        }
                        return [4 /*yield*/, this.todoService.toggleItemStatus(args.list, flags.id, true)];
                    case 10:
                        _c.sent();
                        this.log("✅ Marked todo as completed"); // Changed to double quotes for consistency
                        return [3 /*break*/, 12];
                    case 11:
                        this.error("Unknown action: ".concat(args.action));
                        _c.label = 12;
                    case 12: return [3 /*break*/, 14];
                    case 13:
                        error_2 = _c.sent();
                        if (error_2 instanceof error_1.CLIError) {
                            throw error_2;
                        }
                        throw new error_1.CLIError("Failed in simple command: ".concat(error_2 instanceof Error ? error_2.message : String(error_2)), 'SIMPLE_FAILED');
                    case 14: return [2 /*return*/];
                }
            });
        });
    };
    SimpleCommand.description = 'Simple todo management';
    SimpleCommand.examples = [
        'waltodo simple create shopping-list',
        'waltodo simple add shopping-list "Buy milk" -p high -t grocery,important',
        'waltodo simple list shopping-list',
        'waltodo simple complete shopping-list --id todo-123'
    ];
    SimpleCommand.flags = {
        priority: core_1.Flags.string({
            char: 'p',
            description: 'Priority (high, medium, low)',
            options: ['high', 'medium', 'low'],
            default: 'medium'
        }),
        tags: core_1.Flags.string({
            char: 't',
            description: 'Comma-separated tags'
        }),
        id: core_1.Flags.string({
            char: 'i',
            description: 'Todo ID (for complete command)'
        }),
        sort: core_1.Flags.string({
            char: 's',
            description: 'Sort by field (e.g., priority, title)',
            options: ['priority', 'title']
        }),
        filter: core_1.Flags.string({
            char: 'f',
            description: 'Filter by status (e.g., completed, incomplete)',
            options: ['completed', 'incomplete']
        })
    };
    SimpleCommand.args = {
        action: core_1.Args.string({
            description: 'Action to perform',
            required: true,
            options: ['create', 'add', 'list', 'complete']
        }),
        list: core_1.Args.string({
            description: 'List name',
            required: true
        }),
        title: core_1.Args.string({
            description: 'Todo title (for add command)',
            required: false
        })
    };
    return SimpleCommand;
}(core_1.Command));
exports.default = SimpleCommand;
