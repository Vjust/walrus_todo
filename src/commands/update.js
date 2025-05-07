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
var todoService_1 = require("../services/todoService");
var utils_1 = require("../utils");
var error_handler_1 = require("../utils/error-handler");
var UpdateCommand = /** @class */ (function (_super) {
    __extends(UpdateCommand, _super);
    function UpdateCommand() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    UpdateCommand.prototype.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, args, flags, todoService, list, todo, changes, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.parse(UpdateCommand)];
                    case 1:
                        _a = _b.sent(), args = _a.args, flags = _a.flags;
                        todoService = new todoService_1.TodoService();
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 6, , 7]);
                        return [4 /*yield*/, todoService.getList(args.listName)];
                    case 3:
                        list = _b.sent();
                        if (!list) {
                            throw new error_handler_1.CLIError("List \"".concat(args.listName, "\" not found"), 'INVALID_LIST');
                        }
                        return [4 /*yield*/, todoService.getTodoByTitleOrId(flags.id, args.listName)];
                    case 4:
                        todo = _b.sent();
                        if (!todo) {
                            throw new error_handler_1.CLIError("Todo \"".concat(flags.id, "\" not found in list \"").concat(args.listName, "\""), 'INVALID_TASK_ID');
                        }
                        changes = 0;
                        // Update task if provided
                        if (flags.task) {
                            todo.title = flags.task;
                            changes++;
                        }
                        // Update priority if provided
                        if (flags.priority) {
                            if (!(0, utils_1.validatePriority)(flags.priority)) {
                                throw new error_handler_1.CLIError("Invalid priority. Must be high, medium, or low", 'INVALID_PRIORITY'); // Changed to double quotes for consistency
                            }
                            todo.priority = flags.priority;
                            changes++;
                        }
                        // Update due date if provided
                        if (flags.due) {
                            if (!(0, utils_1.validateDate)(flags.due)) {
                                throw new error_handler_1.CLIError('Invalid date format. Use YYYY-MM-DD', 'INVALID_DATE');
                            }
                            todo.dueDate = flags.due;
                            changes++;
                        }
                        // Update tags if provided
                        if (flags.tags) {
                            todo.tags = flags.tags.split(',').map(function (tag) { return tag.trim(); });
                            changes++;
                        }
                        // Update private flag if provided
                        if (flags.private !== undefined) {
                            todo.private = flags.private;
                            changes++;
                        }
                        if (changes === 0) {
                            this.log(chalk_1.default.yellow('No changes specified. Use -h to see available options.'));
                            return [2 /*return*/];
                        }
                        todo.updatedAt = new Date().toISOString();
                        return [4 /*yield*/, todoService.saveList(args.listName, list)];
                    case 5:
                        _b.sent();
                        this.log(chalk_1.default.green('✓') + ' Updated todo: ' + chalk_1.default.bold(todo.title));
                        this.log(chalk_1.default.dim('List: ') + args.listName);
                        this.log(chalk_1.default.dim('ID: ') + todo.id);
                        this.log(chalk_1.default.dim("Changes made: ".concat(changes)));
                        return [3 /*break*/, 7];
                    case 6:
                        error_1 = _b.sent();
                        if (error_1 instanceof error_handler_1.CLIError) {
                            throw error_1;
                        }
                        throw new error_handler_1.CLIError("Failed to update todo: ".concat(error_1 instanceof Error ? error_1.message : String(error_1)), 'UPDATE_FAILED');
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    UpdateCommand.description = 'Update an existing todo item';
    UpdateCommand.examples = [
        '<%= config.bin %> update my-list -i task-123 -t "Updated task"',
        '<%= config.bin %> update my-list -i "Buy groceries" -p high',
        '<%= config.bin %> update my-list -i task-123 -d 2024-05-01'
    ];
    UpdateCommand.flags = {
        id: core_1.Flags.string({
            char: 'i',
            description: 'Todo ID or title to update',
            required: true
        }),
        task: core_1.Flags.string({
            char: 't',
            description: 'New task description'
        }),
        priority: core_1.Flags.string({
            char: 'p',
            description: 'New priority (high, medium, low)',
            options: ['high', 'medium', 'low']
        }),
        due: core_1.Flags.string({
            char: 'd',
            description: 'New due date (YYYY-MM-DD)'
        }),
        tags: core_1.Flags.string({
            char: 'g',
            description: 'New comma-separated tags'
        }),
        private: core_1.Flags.boolean({
            description: 'Mark todo as private'
        })
    };
    UpdateCommand.args = {
        listName: core_1.Args.string({
            name: 'listName',
            description: 'Name of the todo list',
            required: true
        })
    };
    return UpdateCommand;
}(core_1.Command));
exports.default = UpdateCommand;
