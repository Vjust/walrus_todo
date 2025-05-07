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
exports.WalrusTestService = void 0;
var error_1 = require("../types/error");
/**
 * Test implementation of Walrus service for development and testing.
 * Simulates Walrus storage behavior without network calls.
 */
var WalrusTestService = /** @class */ (function () {
    function WalrusTestService() {
        this.todos = new Map();
        this.lists = new Map();
    }
    WalrusTestService.prototype.storeTodo = function (todo) {
        return __awaiter(this, void 0, void 0, function () {
            var blobId;
            return __generator(this, function (_a) {
                try {
                    blobId = "mock_todo_".concat(todo.id);
                    this.todos.set(blobId, __assign(__assign({}, todo), { walrusBlobId: blobId }));
                    return [2 /*return*/, blobId];
                }
                catch (error) {
                    throw new error_1.CLIError("Failed to store todo: ".concat(error instanceof Error ? error.message : String(error)), 'STORE_TODO_FAILED');
                }
                return [2 /*return*/];
            });
        });
    };
    WalrusTestService.prototype.retrieveTodo = function (blobId) {
        return __awaiter(this, void 0, void 0, function () {
            var todo;
            return __generator(this, function (_a) {
                todo = this.todos.get(blobId);
                if (!todo) {
                    throw new error_1.CLIError("Todo with blob ID \"".concat(blobId, "\" not found"), 'TODO_NOT_FOUND');
                }
                return [2 /*return*/, todo];
            });
        });
    };
    WalrusTestService.prototype.storeTodoList = function (list) {
        return __awaiter(this, void 0, void 0, function () {
            var blobId;
            return __generator(this, function (_a) {
                try {
                    blobId = "mock_list_".concat(list.id);
                    this.lists.set(blobId, __assign(__assign({}, list), { walrusBlobId: blobId }));
                    return [2 /*return*/, blobId];
                }
                catch (error) {
                    throw new error_1.CLIError("Failed to store todo list: ".concat(error instanceof Error ? error.message : String(error)), 'STORE_LIST_FAILED');
                }
                return [2 /*return*/];
            });
        });
    };
    WalrusTestService.prototype.retrieveTodoList = function (blobId) {
        return __awaiter(this, void 0, void 0, function () {
            var list;
            return __generator(this, function (_a) {
                list = this.lists.get(blobId);
                if (!list) {
                    throw new error_1.CLIError("Todo list with blob ID \"".concat(blobId, "\" not found"), 'LIST_NOT_FOUND');
                }
                return [2 /*return*/, list];
            });
        });
    };
    return WalrusTestService;
}());
exports.WalrusTestService = WalrusTestService;
