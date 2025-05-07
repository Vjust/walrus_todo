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
var chalk_1 = require("chalk");
var prompts_1 = require("@inquirer/prompts");
var todoService_1 = require("../services/todoService");
var error_1 = require("../types/error");
var DeleteCommand = /** @class */ (function (_super) {
    __extends(DeleteCommand, _super);
    function DeleteCommand() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.todoService = new todoService_1.TodoService();
        return _this;
    }
    DeleteCommand.prototype.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, args, flags, list, shouldDelete, shouldDeleteAll, todo, shouldDelete, error_2;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 15, , 16]);
                        return [4 /*yield*/, this.parse(DeleteCommand)];
                    case 1:
                        _a = _b.sent(), args = _a.args, flags = _a.flags;
                        return [4 /*yield*/, this.todoService.getList(args.listName)];
                    case 2:
                        list = _b.sent();
                        if (!list) {
                            throw new error_1.CLIError("List \"".concat(args.listName, "\" not found"), 'LIST_NOT_FOUND');
                        }
                        if (!flags.all) return [3 /*break*/, 6];
                        if (!!flags.force) return [3 /*break*/, 4];
                        return [4 /*yield*/, (0, prompts_1.confirm)({
                                message: "Are you sure you want to delete the entire list \"".concat(args.listName, "\"?"),
                                default: false
                            })];
                    case 3:
                        shouldDelete = _b.sent();
                        if (!shouldDelete) {
                            this.log(chalk_1.default.yellow('Operation cancelled'));
                            return [2 /*return*/];
                        }
                        _b.label = 4;
                    case 4: return [4 /*yield*/, this.todoService.deleteList(args.listName)];
                    case 5:
                        _b.sent();
                        this.log(chalk_1.default.green('✓'), "Deleted list: ".concat(chalk_1.default.bold(args.listName)));
                        this.log(chalk_1.default.dim("Items removed: ".concat(list.todos.length)));
                        return [2 /*return*/];
                    case 6:
                        if (!(!flags.id && !flags.all)) return [3 /*break*/, 10];
                        // Instead of throwing an error, ask the user what they want to delete
                        this.log(chalk_1.default.yellow('⚠️'), "You must specify either a todo ID (--id) or --all to delete the entire list");
                        // Provide a helpful example
                        this.log(chalk_1.default.dim('\nExamples:'));
                        this.log(chalk_1.default.dim("  ".concat(this.config.bin, " delete ").concat(args.listName, " --id <todo-id>     # Delete a specific todo")));
                        this.log(chalk_1.default.dim("  ".concat(this.config.bin, " delete ").concat(args.listName, " --all              # Delete the entire list\n")));
                        return [4 /*yield*/, (0, prompts_1.confirm)({
                                message: "Do you want to delete the entire \"".concat(args.listName, "\" list?"),
                                default: false
                            })];
                    case 7:
                        shouldDeleteAll = _b.sent();
                        if (!shouldDeleteAll) return [3 /*break*/, 9];
                        // Rather than recursively calling run() which causes the issue we're seeing,
                        // just directly call the delete list function
                        return [4 /*yield*/, this.todoService.deleteList(args.listName)];
                    case 8:
                        // Rather than recursively calling run() which causes the issue we're seeing,
                        // just directly call the delete list function
                        _b.sent();
                        this.log(chalk_1.default.green('✓'), "Deleted list: ".concat(chalk_1.default.bold(args.listName)));
                        this.log(chalk_1.default.dim("Items removed: ".concat(list.todos.length)));
                        return [2 /*return*/];
                    case 9:
                        // Show available todos in the list to help user pick an ID
                        this.log(chalk_1.default.blue('\nAvailable todos in list:'));
                        list.todos.forEach(function (todo) {
                            _this.log("  ".concat(chalk_1.default.dim(todo.id), ": ").concat(todo.title));
                        });
                        this.log(chalk_1.default.yellow('\nPlease run the command again with a specific ID'));
                        return [2 /*return*/];
                    case 10:
                        // At this point, if flags.id is defined, it should be a string
                        // But let's make sure it's not undefined to satisfy TypeScript
                        if (!flags.id) {
                            throw new error_1.CLIError('Todo ID is required', 'MISSING_PARAMETER');
                        }
                        return [4 /*yield*/, this.todoService.getTodoByTitleOrId(flags.id, args.listName)];
                    case 11:
                        todo = _b.sent();
                        if (!todo) {
                            throw new error_1.CLIError("Todo \"".concat(flags.id, "\" not found in list \"").concat(args.listName, "\""), 'TODO_NOT_FOUND');
                        }
                        if (!!flags.force) return [3 /*break*/, 13];
                        return [4 /*yield*/, (0, prompts_1.confirm)({
                                message: "Are you sure you want to delete todo \"".concat(todo.title, "\"?"),
                                default: false
                            })];
                    case 12:
                        shouldDelete = _b.sent();
                        if (!shouldDelete) {
                            this.log(chalk_1.default.yellow('Operation cancelled'));
                            return [2 /*return*/];
                        }
                        _b.label = 13;
                    case 13: 
                    // Use todo.id which is the actual ID (in case user provided a title)
                    return [4 /*yield*/, this.todoService.deleteTodo(args.listName, todo.id)];
                    case 14:
                        // Use todo.id which is the actual ID (in case user provided a title)
                        _b.sent();
                        this.log(chalk_1.default.green('✓'), 'Deleted todo:', chalk_1.default.bold(todo.title));
                        this.log(chalk_1.default.dim('List:'), args.listName);
                        this.log(chalk_1.default.dim('ID:'), todo.id);
                        return [3 /*break*/, 16];
                    case 15:
                        error_2 = _b.sent();
                        if (error_2 instanceof error_1.CLIError) {
                            throw error_2;
                        }
                        throw new error_1.CLIError("Failed to delete todo: ".concat(error_2 instanceof Error ? error_2.message : String(error_2)), 'DELETE_FAILED');
                    case 16: return [2 /*return*/];
                }
            });
        });
    };
    DeleteCommand.description = 'Delete a todo item or list';
    DeleteCommand.examples = [
        '<%= config.bin %> delete my-list -i task-123',
        '<%= config.bin %> delete my-list -i "Buy groceries"',
        '<%= config.bin %> delete my-list -i task-123 --force',
        '<%= config.bin %> delete my-list --all'
    ];
    DeleteCommand.flags = {
        id: core_1.Flags.string({
            char: 'i',
            description: 'Todo ID or title to delete',
            exclusive: ['all']
        }),
        all: core_1.Flags.boolean({
            char: 'a',
            description: 'Delete entire list',
            exclusive: ['id']
        }),
        force: core_1.Flags.boolean({
            char: 'f',
            description: 'Skip confirmation prompt',
            default: false
        })
    };
    DeleteCommand.args = {
        listName: core_1.Args.string({
            name: 'listName',
            description: 'Name of the todo list',
            required: true
        })
    };
    return DeleteCommand;
}(core_1.Command));
exports.default = DeleteCommand;
