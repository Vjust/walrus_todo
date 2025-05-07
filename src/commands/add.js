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
var chalk_1 = require("chalk"); // Changed from import * as chalk
var todoService_1 = require("../services/todoService");
var error_1 = require("../types/error");
var walrus_storage_1 = require("../utils/walrus-storage");
// Removed unused configService import
var AddCommand = /** @class */ (function (_super) {
    __extends(AddCommand, _super);
    function AddCommand() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.todoService = new todoService_1.TodoService();
        _this.walrusStorage = (0, walrus_storage_1.createWalrusStorage)(false); // Use real Walrus storage
        return _this;
    }
    AddCommand.prototype.validateDate = function (date) {
        var regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(date))
            return false;
        var d = new Date(date);
        return d instanceof Date && !isNaN(d.getTime());
    };
    AddCommand.prototype.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, args, flags, listName, todoTitle, storageLocation, todo, listExists, addedTodo, error_2, blobId, error_3, error_4, error_5, error_6, priorityColor, storageInfo, outputLines, error_7;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 26, , 27]);
                        return [4 /*yield*/, this.parse(AddCommand)];
                    case 1:
                        _a = _b.sent(), args = _a.args, flags = _a.flags;
                        if (flags.due && !this.validateDate(flags.due)) {
                            throw new error_1.CLIError("Invalid date format. Use YYYY-MM-DD", 'INVALID_DATE'); // No change, already fixed
                        }
                        listName = flags.list || 'default';
                        todoTitle = void 0;
                        if (args.title) {
                            // Use the title argument directly
                            todoTitle = args.title;
                        }
                        else if (flags.task && flags.task.length > 0) {
                            // Use the task flag(s)
                            todoTitle = flags.task.join(' ');
                        }
                        else {
                            throw new error_1.CLIError('Todo title is required. Provide it as an argument or with -t flag', 'MISSING_TITLE');
                        }
                        storageLocation = flags.storage;
                        todo = {
                            title: todoTitle,
                            priority: flags.priority,
                            dueDate: flags.due,
                            tags: flags.tags ? flags.tags.split(',').map(function (t) { return t.trim(); }) : [],
                            private: flags.private,
                            storageLocation: storageLocation
                        };
                        return [4 /*yield*/, this.todoService.getList(listName)];
                    case 2:
                        listExists = _b.sent();
                        if (!!listExists) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.todoService.createList(listName, 'default-owner')];
                    case 3:
                        _b.sent();
                        this.log(chalk_1.default.blue('ℹ') + ' Created new list: ' + chalk_1.default.cyan(listName));
                        _b.label = 4;
                    case 4: return [4 /*yield*/, this.todoService.addTodo(listName, todo)];
                    case 5:
                        addedTodo = _b.sent();
                        if (!(storageLocation === 'blockchain' || storageLocation === 'both')) return [3 /*break*/, 25];
                        // Warn about public access
                        this.log(chalk_1.default.yellow('⚠') + ' Note: Blockchain storage will make the todo data publicly accessible');
                        this.log(chalk_1.default.blue('ℹ') + ' Storing todo on blockchain...');
                        _b.label = 6;
                    case 6:
                        _b.trys.push([6, 24, , 25]);
                        _b.label = 7;
                    case 7:
                        _b.trys.push([7, 9, , 10]);
                        return [4 /*yield*/, this.walrusStorage.connect()];
                    case 8:
                        _b.sent();
                        return [3 /*break*/, 10];
                    case 9:
                        error_2 = _b.sent();
                        throw new error_1.CLIError("Failed to connect to blockchain storage: ".concat(error_2 instanceof Error ? error_2.message : String(error_2)), 'BLOCKCHAIN_CONNECTION_FAILED');
                    case 10:
                        blobId = void 0;
                        _b.label = 11;
                    case 11:
                        _b.trys.push([11, 13, , 14]);
                        return [4 /*yield*/, this.walrusStorage.storeTodo(addedTodo)];
                    case 12:
                        // Store todo on Walrus
                        blobId = _b.sent();
                        return [3 /*break*/, 14];
                    case 13:
                        error_3 = _b.sent();
                        throw new error_1.CLIError("Failed to store todo on blockchain: ".concat(error_3 instanceof Error ? error_3.message : String(error_3)), 'BLOCKCHAIN_STORE_FAILED');
                    case 14:
                        if (!(storageLocation === 'both')) return [3 /*break*/, 18];
                        _b.label = 15;
                    case 15:
                        _b.trys.push([15, 17, , 18]);
                        return [4 /*yield*/, this.todoService.updateTodo(listName, addedTodo.id, {
                                walrusBlobId: blobId,
                                updatedAt: new Date().toISOString()
                            })];
                    case 16:
                        _b.sent();
                        return [3 /*break*/, 18];
                    case 17:
                        error_4 = _b.sent();
                        this.log(chalk_1.default.yellow('⚠') + ' Warning: Successfully stored on blockchain but failed to update local copy');
                        return [3 /*break*/, 18];
                    case 18:
                        if (!(storageLocation === 'blockchain')) return [3 /*break*/, 22];
                        _b.label = 19;
                    case 19:
                        _b.trys.push([19, 21, , 22]);
                        return [4 /*yield*/, this.todoService.deleteTodo(listName, addedTodo.id)];
                    case 20:
                        _b.sent();
                        return [3 /*break*/, 22];
                    case 21:
                        error_5 = _b.sent();
                        this.log(chalk_1.default.yellow('⚠') + ' Warning: Failed to remove local copy after blockchain storage');
                        return [3 /*break*/, 22];
                    case 22:
                        this.log(chalk_1.default.green('✓') + ' Todo stored on blockchain with blob ID: ' + chalk_1.default.dim(blobId));
                        this.log(chalk_1.default.dim('  Public URL: https://testnet.wal.app/blob/' + blobId));
                        // Cleanup
                        return [4 /*yield*/, this.walrusStorage.disconnect()];
                    case 23:
                        // Cleanup
                        _b.sent();
                        return [3 /*break*/, 25];
                    case 24:
                        error_6 = _b.sent();
                        if (error_6 instanceof error_1.CLIError)
                            throw error_6;
                        // If blockchain-only storage failed, keep it locally
                        if (storageLocation === 'blockchain') {
                            this.log(chalk_1.default.yellow('⚠') + ' Storage failed - keeping todo locally instead');
                            todo.storageLocation = 'local';
                        }
                        else {
                            throw new error_1.CLIError("Failed to store todo on blockchain: ".concat(error_6 instanceof Error ? error_6.message : String(error_6)), 'BLOCKCHAIN_STORE_FAILED');
                        }
                        return [3 /*break*/, 25];
                    case 25:
                        priorityColor = {
                            high: chalk_1.default.red,
                            medium: chalk_1.default.yellow,
                            low: chalk_1.default.green
                        }[todo.priority || 'medium'];
                        storageInfo = {
                            local: { color: chalk_1.default.green, icon: '💻', text: 'Local only' },
                            blockchain: { color: chalk_1.default.blue, icon: '🔗', text: 'Blockchain only' },
                            both: { color: chalk_1.default.magenta, icon: '🔄', text: 'Local & Blockchain' }
                        }[addedTodo.storageLocation || 'local'];
                        outputLines = [
                            chalk_1.default.green('✓') + ' Added todo: ' + chalk_1.default.bold(todoTitle),
                            "  \uD83D\uDCCB List: ".concat(chalk_1.default.cyan(listName)),
                            "  \uD83D\uDD04 Priority: ".concat(priorityColor(todo.priority || 'medium')),
                        ];
                        if (todo.dueDate) {
                            outputLines.push("  \uD83D\uDCC5 Due: ".concat(chalk_1.default.blue(todo.dueDate)));
                        }
                        if (todo.tags && todo.tags.length > 0) {
                            outputLines.push("  \uD83C\uDFF7\uFE0F  Tags: ".concat(todo.tags.join(', ')));
                        }
                        outputLines.push("  \uD83D\uDD12 Private: ".concat(todo.private ? chalk_1.default.yellow('Yes') : chalk_1.default.green('No')));
                        outputLines.push("  ".concat(storageInfo.icon, " Storage: ").concat(storageInfo.color(storageInfo.text)));
                        this.log(outputLines.join('\n'));
                        return [3 /*break*/, 27];
                    case 26:
                        error_7 = _b.sent();
                        if (error_7 instanceof error_1.CLIError) {
                            throw error_7;
                        }
                        throw new error_1.CLIError("Failed to add todo: ".concat(error_7 instanceof Error ? error_7.message : String(error_7)), 'ADD_FAILED');
                    case 27: return [2 /*return*/];
                }
            });
        });
    };
    AddCommand.description = 'Add new todo items to a list';
    AddCommand.examples = [
        '<%= config.bin %> add "Buy groceries"',
        '<%= config.bin %> add "Important task" -p high',
        '<%= config.bin %> add "Meeting" --due 2024-05-01',
        '<%= config.bin %> add my-list -t "Buy groceries"',
        '<%= config.bin %> add -t "Task 1" -t "Task 2"',
        '<%= config.bin %> add "Blockchain task" -s blockchain',
        '<%= config.bin %> add "Hybrid task" -s both'
    ];
    AddCommand.flags = {
        task: core_1.Flags.string({
            char: 't',
            description: 'Task description (can be used multiple times)',
            required: false,
            multiple: true
        }),
        priority: core_1.Flags.string({
            char: 'p',
            description: 'Task priority (high, medium, low)',
            options: ['high', 'medium', 'low'],
            default: 'medium'
        }),
        due: core_1.Flags.string({
            char: 'd',
            description: 'Due date (YYYY-MM-DD)'
        }),
        tags: core_1.Flags.string({
            char: 'g',
            description: 'Comma-separated tags'
        }),
        private: core_1.Flags.boolean({
            description: 'Mark todo as private',
            default: false
        }),
        list: core_1.Flags.string({
            char: 'l',
            description: 'Name of the todo list',
            default: 'default'
        }),
        storage: core_1.Flags.string({
            char: 's',
            description: "Storage location for the todo:\n        local: Store only in local JSON files\n        blockchain: Store on Walrus/Sui blockchain (data will be publicly accessible)\n        both: Keep both local copy and blockchain storage\n      NOTE: Blockchain storage uses Walrus for data and can be publicly accessed.",
            options: ['local', 'blockchain', 'both'],
            default: 'local',
            helpGroup: 'Storage Options'
        })
    };
    AddCommand.args = {
        title: core_1.Args.string({
            name: 'title',
            description: 'Todo title (alternative to -t flag)',
            required: false
        })
    };
    return AddCommand;
}(core_1.Command));
exports.default = AddCommand;
