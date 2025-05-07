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
exports.SuiTestService = void 0;
var crypto_1 = require("crypto");
var client_1 = require("@mysten/sui/client");
var constants_1 = require("../constants");
var error_1 = require("../types/error");
/**
 * Test implementation of SUI service for development and testing.
 * Simulates blockchain behavior without network calls.
 */
var SuiTestService = /** @class */ (function () {
    function SuiTestService(config) {
        var _a;
        this.lists = new Map();
        if (typeof config === 'string') {
            this.config = {
                network: 'testnet',
                walletAddress: config,
                encryptedStorage: false
            };
        }
        else if (config) {
            this.config = config;
        }
        else {
            this.config = {
                network: 'testnet',
                walletAddress: '',
                encryptedStorage: false
            };
        }
        this.client = new client_1.SuiClient({ url: constants_1.NETWORK_URLS[this.config.network] });
        this.walletAddress =
            (_a = this.config.walletAddress) !== null && _a !== void 0 ? _a : "0x".concat(crypto_1.default.randomBytes(20).toString("hex").toLowerCase());
    }
    SuiTestService.prototype.getWalletAddress = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.walletAddress];
            });
        });
    };
    SuiTestService.prototype.createTodoList = function () {
        return __awaiter(this, void 0, void 0, function () {
            var id, now;
            return __generator(this, function (_a) {
                id = this.generateId("list");
                now = Date.now();
                this.lists.set(id, {
                    id: id,
                    owner: this.walletAddress,
                    items: new Map(),
                    createdAt: now,
                    updatedAt: now,
                });
                return [2 /*return*/, id];
            });
        });
    };
    SuiTestService.prototype.addTodo = function (listId, text) {
        return __awaiter(this, void 0, void 0, function () {
            var list, id, item;
            return __generator(this, function (_a) {
                list = this.assertList(listId);
                id = this.generateId("todo");
                item = {
                    id: id,
                    text: text,
                    completed: false,
                    updatedAt: Date.now(),
                };
                list.items.set(id, item);
                list.updatedAt = Date.now();
                return [2 /*return*/, id];
            });
        });
    };
    SuiTestService.prototype.getTodos = function (listId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.assertList(listId).items.values())];
            });
        });
    };
    SuiTestService.prototype.updateTodo = function (listId, itemId, changes) {
        return __awaiter(this, void 0, void 0, function () {
            var list, item;
            return __generator(this, function (_a) {
                list = this.assertList(listId);
                item = list.items.get(itemId);
                if (!item) {
                    throw new error_1.CLIError("Todo \"".concat(itemId, "\" not found in list \"").concat(listId, "\""), 'TODO_NOT_FOUND');
                }
                Object.assign(item, changes, { updatedAt: Date.now() });
                list.updatedAt = Date.now();
                return [2 /*return*/];
            });
        });
    };
    SuiTestService.prototype.deleteTodoList = function (listId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this.lists.delete(listId)) {
                    throw new error_1.CLIError("Todo list \"".concat(listId, "\" does not exist"), 'LIST_NOT_FOUND');
                }
                return [2 /*return*/];
            });
        });
    };
    SuiTestService.prototype.getAccountInfo = function () {
        return __awaiter(this, void 0, void 0, function () {
            var balanceResponse, objectsResponse, objects, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        if (!this.config.walletAddress) {
                            throw new error_1.CLIError('Wallet address not configured', 'NO_WALLET_ADDRESS');
                        }
                        return [4 /*yield*/, this.client.getBalance({
                                owner: this.config.walletAddress
                            })];
                    case 1:
                        balanceResponse = _a.sent();
                        return [4 /*yield*/, this.client.getOwnedObjects({
                                owner: this.config.walletAddress,
                                limit: 5
                            })];
                    case 2:
                        objectsResponse = _a.sent();
                        objects = objectsResponse.data.map(function (obj) {
                            var _a, _b;
                            return {
                                objectId: ((_a = obj.data) === null || _a === void 0 ? void 0 : _a.objectId) || 'unknown',
                                type: ((_b = obj.data) === null || _b === void 0 ? void 0 : _b.type) || 'unknown'
                            };
                        });
                        return [2 /*return*/, {
                                address: this.config.walletAddress,
                                balance: balanceResponse.totalBalance,
                                objects: objects
                            }];
                    case 3:
                        error_2 = _a.sent();
                        throw new error_1.CLIError("Failed to get account info: ".concat(error_2 instanceof Error ? error_2.message : String(error_2)), 'ACCOUNT_INFO_FAILED');
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    SuiTestService.prototype.assertList = function (listId) {
        var list = this.lists.get(listId);
        if (!list) {
            throw new error_1.CLIError("Todo list \"".concat(listId, "\" not found"), 'LIST_NOT_FOUND');
        }
        if (list.owner !== this.walletAddress) {
            throw new error_1.CLIError('Unauthorized access to todo list', 'UNAUTHORIZED');
        }
        return list;
    };
    SuiTestService.prototype.generateId = function (prefix) {
        return "".concat(prefix, "_").concat(crypto_1.default.randomBytes(6).toString("hex"));
    };
    return SuiTestService;
}());
exports.SuiTestService = SuiTestService;
