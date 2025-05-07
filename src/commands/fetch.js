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
var core_1 = require("@oclif/core");
var todoService_1 = require("../services/todoService");
var walrus_storage_1 = require("../utils/walrus-storage");
var sui_nft_storage_1 = require("../utils/sui-nft-storage");
var constants_1 = require("../constants");
var error_1 = require("../types/error");
var config_service_1 = require("../services/config-service");
var chalk_1 = require("chalk");
var FetchCommand = /** @class */ (function (_super) {
    __extends(FetchCommand, _super);
    function FetchCommand() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.todoService = new todoService_1.TodoService();
        _this.walrusStorage = (0, walrus_storage_1.createWalrusStorage)(true); // Use mock mode for testing
        return _this;
    }
    FetchCommand.prototype.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var flags, configInner, todo, suiClient, signer, suiNftStorage, nftData, todo, error_2;
            var _this = this;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 14, , 15]);
                        return [4 /*yield*/, this.parse(FetchCommand)];
                    case 1:
                        flags = (_d.sent()).flags;
                        // Removed unused configFetch variable
                        // Validate input
                        if (!flags['blob-id'] && !flags['object-id']) {
                            throw new error_1.CLIError('Either --blob-id or --object-id must be specified', 'MISSING_PARAMETER');
                        }
                        return [4 /*yield*/, config_service_1.configService.getConfig()];
                    case 2:
                        configInner = _d.sent();
                        if (!((_a = configInner === null || configInner === void 0 ? void 0 : configInner.lastDeployment) === null || _a === void 0 ? void 0 : _a.packageId)) {
                            throw new error_1.CLIError('Contract not deployed. Please run "waltodo deploy" first.', 'NOT_DEPLOYED');
                        }
                        if (!flags['blob-id']) return [3 /*break*/, 7];
                        // Initialize Walrus storage
                        return [4 /*yield*/, this.walrusStorage.connect()];
                    case 3:
                        // Initialize Walrus storage
                        _d.sent();
                        // Retrieve todo from Walrus
                        this.log(chalk_1.default.blue("Retrieving todo from Walrus (blob ID: ".concat(flags['blob-id'], ")...")));
                        return [4 /*yield*/, this.walrusStorage.retrieveTodo(flags['blob-id'])];
                    case 4:
                        todo = _d.sent();
                        // Save to local list
                        return [4 /*yield*/, this.todoService.addTodo(flags.list, todo)];
                    case 5:
                        // Save to local list
                        _d.sent(); // Removed unused savedTodo variable
                        this.log(chalk_1.default.green("✓ Todo retrieved successfully"));
                        this.log(chalk_1.default.dim("Details:"));
                        this.log("  Title: ".concat(todo.title));
                        this.log("  Status: ".concat(todo.completed ? 'Completed' : 'Pending'));
                        this.log("  Priority: ".concat(todo.priority));
                        if ((_b = todo.tags) === null || _b === void 0 ? void 0 : _b.length) {
                            this.log("  Tags: ".concat(todo.tags.join(', ')));
                        }
                        // Cleanup
                        return [4 /*yield*/, this.walrusStorage.disconnect()];
                    case 6:
                        // Cleanup
                        _d.sent();
                        return [3 /*break*/, 13];
                    case 7:
                        if (!flags['object-id']) return [3 /*break*/, 13];
                        suiClient = {
                            url: constants_1.NETWORK_URLS[configInner.network],
                            core: {},
                            jsonRpc: {},
                            signAndExecuteTransaction: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/];
                            }); }); },
                            getEpochMetrics: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, null];
                            }); }); },
                            getObject: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, null];
                            }); }); },
                            getTransactionBlock: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, null];
                            }); }); }
                        };
                        // Initialize Sui NFT storage
                        if (!configInner.lastDeployment) {
                            throw new error_1.CLIError('Contract not deployed. Please run "waltodo deploy" first.', 'NOT_DEPLOYED');
                        }
                        signer = {};
                        suiNftStorage = new sui_nft_storage_1.SuiNftStorage(suiClient, signer, {
                            address: configInner.lastDeployment.packageId,
                            packageId: configInner.lastDeployment.packageId,
                            collectionId: ''
                        });
                        // Retrieve NFT from blockchain
                        this.log(chalk_1.default.blue("Retrieving NFT from blockchain (object ID: ".concat(flags['object-id'], ")...")));
                        return [4 /*yield*/, suiNftStorage.getTodoNft(flags['object-id'])];
                    case 8:
                        nftData = _d.sent();
                        if (!nftData.walrusBlobId) {
                            throw new error_1.CLIError('NFT does not contain a Walrus blob ID', 'INVALID_NFT');
                        }
                        // Initialize Walrus storage
                        return [4 /*yield*/, this.walrusStorage.connect()];
                    case 9:
                        // Initialize Walrus storage
                        _d.sent();
                        // Retrieve todo data from Walrus
                        this.log(chalk_1.default.blue("Retrieving todo data from Walrus (blob ID: ".concat(nftData.walrusBlobId, ")...")));
                        return [4 /*yield*/, this.walrusStorage.retrieveTodo(nftData.walrusBlobId)];
                    case 10:
                        todo = _d.sent();
                        // Save to local list
                        return [4 /*yield*/, this.todoService.addTodo(flags.list, __assign(__assign({}, todo), { nftObjectId: flags['object-id'], walrusBlobId: nftData.walrusBlobId }))];
                    case 11:
                        // Save to local list
                        _d.sent();
                        this.log(chalk_1.default.green("\u2713 Todo retrieved successfully from blockchain and Walrus"));
                        this.log(chalk_1.default.dim('Details:'));
                        this.log("  Title: ".concat(todo.title));
                        this.log("  Status: ".concat(todo.completed ? 'Completed' : 'Pending'));
                        this.log("  Priority: ".concat(todo.priority));
                        this.log("  NFT Object ID: ".concat(flags['object-id']));
                        this.log("  Walrus Blob ID: ".concat(nftData.walrusBlobId));
                        if ((_c = todo.tags) === null || _c === void 0 ? void 0 : _c.length) {
                            this.log("  Tags: ".concat(todo.tags.join(', ')));
                        }
                        // Cleanup
                        return [4 /*yield*/, this.walrusStorage.disconnect()];
                    case 12:
                        // Cleanup
                        _d.sent();
                        _d.label = 13;
                    case 13: return [3 /*break*/, 15];
                    case 14:
                        error_2 = _d.sent();
                        if (error_2 instanceof error_1.CLIError) {
                            throw error_2;
                        }
                        throw new error_1.CLIError("Failed to retrieve todo: ".concat(error_2 instanceof Error ? error_2.message : String(error_2)), 'RETRIEVE_FAILED');
                    case 15: return [2 /*return*/];
                }
            });
        });
    };
    FetchCommand.description = 'Fetch todos from blockchain or Walrus storage';
    FetchCommand.examples = [
        '<%= config.bin %> fetch --blob-id QmXyz --list my-todos',
        '<%= config.bin %> fetch --object-id 0x123 --list my-todos',
    ];
    FetchCommand.flags = {
        'blob-id': core_1.Flags.string({
            description: 'Walrus blob ID to retrieve',
            exclusive: ['object-id'],
        }),
        'object-id': core_1.Flags.string({
            description: 'NFT object ID to retrieve',
            exclusive: ['blob-id'],
        }),
        list: core_1.Flags.string({
            char: 'l',
            description: 'Save to this todo list',
            default: 'default'
        }),
    };
    return FetchCommand;
}(core_1.Command));
exports.default = FetchCommand;
