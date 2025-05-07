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
var error_1 = require("../types/error");
var ShareCommand = /** @class */ (function (_super) {
    __extends(ShareCommand, _super);
    function ShareCommand() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.todoService = new todoService_1.TodoService();
        return _this;
    }
    ShareCommand.prototype.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, args, flags, listName, recipient, todoList, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, this.parse(ShareCommand)];
                    case 1:
                        _a = _b.sent(), args = _a.args, flags = _a.flags;
                        listName = args.listName || flags.list;
                        if (!listName) {
                            throw new error_1.CLIError('List name is required. Provide it as an argument or with --list flag', 'MISSING_LIST');
                        }
                        recipient = flags.recipient;
                        return [4 /*yield*/, this.todoService.getList(listName)];
                    case 2:
                        todoList = _b.sent();
                        if (!todoList) {
                            throw new error_1.CLIError("List \"".concat(listName, "\" not found"), 'LIST_NOT_FOUND');
                        }
                        // Update collaborators
                        todoList.collaborators = todoList.collaborators || [];
                        if (todoList.collaborators.includes(recipient)) {
                            throw new error_1.CLIError("User \"".concat(recipient, "\" already has access to list \"").concat(listName, "\""), 'ALREADY_SHARED');
                        }
                        todoList.collaborators.push(recipient);
                        todoList.updatedAt = new Date().toISOString();
                        return [4 /*yield*/, this.todoService.saveList(listName, todoList)];
                    case 3:
                        _b.sent();
                        this.log(chalk_1.default.green('✓'), "Todo list \"".concat(chalk_1.default.bold(listName), "\" shared successfully with ").concat(chalk_1.default.cyan(recipient)));
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _b.sent();
                        if (error_2 instanceof error_1.CLIError) {
                            throw error_2;
                        }
                        throw new error_1.CLIError("Failed to share list: ".concat(error_2 instanceof Error ? error_2.message : String(error_2)), 'SHARE_FAILED');
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    ShareCommand.description = 'Share a todo list with another user';
    ShareCommand.examples = [
        '<%= config.bin %> share --list my-list --recipient username',
        '<%= config.bin %> share my-list --recipient username'
    ];
    ShareCommand.flags = {
        list: core_1.Flags.string({
            char: 'l',
            description: 'Name of the todo list to share',
            required: false,
        }),
        recipient: core_1.Flags.string({
            char: 'r',
            description: 'Username to share with',
            required: true,
        }),
    };
    ShareCommand.args = {
        listName: core_1.Args.string({
            name: 'listName',
            description: 'Name of the todo list to share (alternative to --list flag)',
            required: false
        })
    };
    return ShareCommand;
}(core_1.Command));
exports.default = ShareCommand;
