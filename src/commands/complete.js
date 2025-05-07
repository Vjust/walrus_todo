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
var client_1 = require("@mysten/sui.js/client");
var transactions_1 = require("@mysten/sui.js/transactions");
var todoService_1 = require("../services/todoService");
var walrus_storage_1 = require("../utils/walrus-storage");
var sui_nft_storage_1 = require("../utils/sui-nft-storage");
var constants_1 = require("../constants");
var error_1 = require("../types/error");
var config_service_1 = require("../services/config-service");
var chalk_1 = require("chalk");
var error_handler_1 = require("../utils/error-handler");
var CompleteCommand = /** @class */ (function (_super) {
    __extends(CompleteCommand, _super);
    function CompleteCommand() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.todoService = new todoService_1.TodoService();
        _this.walrusStorage = (0, walrus_storage_1.createWalrusStorage)(false); // Use real Walrus storage
        return _this;
    }
    CompleteCommand.prototype.validateNetwork = function (network) {
        var validNetworks = ['localnet', 'devnet', 'testnet', 'mainnet'];
        if (!validNetworks.includes(network)) {
            throw new error_1.CLIError("Invalid network: ".concat(network, ". Valid networks are: ").concat(validNetworks.join(', ')), 'INVALID_NETWORK');
        }
        return constants_1.NETWORK_URLS[network] || '';
    };
    CompleteCommand.prototype.validateBlockchainConfig = function (network) {
        return __awaiter(this, void 0, void 0, function () {
            var config;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, config_service_1.configService.getConfig()];
                    case 1:
                        config = _b.sent();
                        if (!((_a = config.lastDeployment) === null || _a === void 0 ? void 0 : _a.packageId)) {
                            throw new error_1.CLIError('Contract not deployed. Run "waltodo deploy --network ' + network + '" first.', 'NOT_DEPLOYED');
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    CompleteCommand.prototype.getNetworkStatus = function (suiClient) {
        return __awaiter(this, void 0, void 0, function () {
            var state, error_2;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, suiClient.getLatestSuiSystemState()];
                    case 1:
                        state = _b.sent();
                        return [2 /*return*/, ((_a = state.protocolVersion) === null || _a === void 0 ? void 0 : _a.toString()) || 'unknown'];
                    case 2:
                        error_2 = _b.sent();
                        throw new error_1.CLIError("Failed to connect to network: ".concat(error_2 instanceof Error ? error_2.message : String(error_2)), 'NETWORK_CONNECTION_FAILED');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    CompleteCommand.prototype.validateNftState = function (suiClient, nftObjectId) {
        return __awaiter(this, void 0, void 0, function () {
            var result, content, expectedType, error_3;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, suiClient.getObject({
                                id: nftObjectId,
                                options: { showContent: true }
                            })];
                    case 1:
                        result = _c.sent();
                        if (result.error) {
                            throw new error_1.CLIError("Failed to fetch NFT: ".concat(result.error.code), 'NFT_FETCH_FAILED');
                        }
                        if (!((_a = result.data) === null || _a === void 0 ? void 0 : _a.content)) {
                            throw new error_1.CLIError('NFT data not found or inaccessible', 'NFT_NOT_FOUND');
                        }
                        content = result.data.content;
                        expectedType = "".concat(constants_1.TODO_NFT_CONFIG.MODULE_ADDRESS, "::").concat(constants_1.TODO_NFT_CONFIG.MODULE_NAME, "::").concat(constants_1.TODO_NFT_CONFIG.STRUCT_NAME);
                        if (content.type !== expectedType) {
                            throw new error_1.CLIError("Invalid NFT type. Expected ".concat(expectedType), 'INVALID_NFT_TYPE');
                        }
                        if ((_b = content.fields) === null || _b === void 0 ? void 0 : _b.completed) {
                            throw new error_1.CLIError('NFT is already marked as completed', 'NFT_ALREADY_COMPLETED');
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_3 = _c.sent();
                        if (error_3 instanceof error_1.CLIError)
                            throw error_3;
                        throw new error_1.CLIError("Failed to validate NFT state: ".concat(error_3 instanceof Error ? error_3.message : String(error_3)), 'NFT_VALIDATION_FAILED');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    CompleteCommand.prototype.estimateGasForNftUpdate = function (suiClient, nftObjectId, packageId) {
        return __awaiter(this, void 0, void 0, function () {
            var txb, dryRunResult, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        txb = new transactions_1.TransactionBlock();
                        txb.moveCall({
                            target: "".concat(packageId, "::").concat(constants_1.TODO_NFT_CONFIG.MODULE_NAME, "::complete_todo"),
                            arguments: [txb.pure(nftObjectId)]
                        });
                        return [4 /*yield*/, suiClient.dryRunTransactionBlock({
                                transactionBlock: txb.serialize().toString()
                            })];
                    case 1:
                        dryRunResult = _a.sent();
                        return [2 /*return*/, {
                                computationCost: dryRunResult.effects.gasUsed.computationCost,
                                storageCost: dryRunResult.effects.gasUsed.storageCost
                            }];
                    case 2:
                        error_4 = _a.sent();
                        throw new error_1.CLIError("Failed to estimate gas: ".concat(error_4 instanceof Error ? error_4.message : String(error_4)), 'GAS_ESTIMATION_FAILED');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    CompleteCommand.prototype.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var lastWalrusError, _a, args, flags, config, network, networkUrl, list, todo_1, suiClient_1, suiNftStorage_1, protocolVersion, signer, gasEstimate, txDigest, blockchainError_1, timeout, updatedTodo, maxRetries, _loop_1, this_1, attempt, state_1, disconnectError_1, walrusUpdateStatus, error_5;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        lastWalrusError = null;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 28, , 29]);
                        return [4 /*yield*/, this.parse(CompleteCommand)];
                    case 2:
                        _a = _b.sent(), args = _a.args, flags = _a.flags;
                        return [4 /*yield*/, config_service_1.configService.getConfig()];
                    case 3:
                        config = _b.sent();
                        network = flags.network || config.network || 'testnet';
                        networkUrl = this.validateNetwork(network);
                        return [4 /*yield*/, this.todoService.getList(args.list)];
                    case 4:
                        list = _b.sent();
                        if (!list) {
                            throw new error_1.CLIError("List \"".concat(args.list, "\" not found"), 'LIST_NOT_FOUND');
                        }
                        return [4 /*yield*/, this.todoService.getTodoByTitleOrId(flags.id, args.list)];
                    case 5:
                        todo_1 = _b.sent();
                        if (!todo_1) {
                            throw new error_1.CLIError("Todo \"".concat(flags.id, "\" not found in list \"").concat(args.list, "\""), 'TODO_NOT_FOUND');
                        }
                        // Verify not already completed
                        if (todo_1.completed) {
                            this.log(chalk_1.default.yellow("Todo \"".concat(todo_1.title, "\" is already marked as completed")));
                            return [2 /*return*/];
                        }
                        if (!(todo_1.nftObjectId || todo_1.walrusBlobId)) return [3 /*break*/, 10];
                        // Validate deployment config first
                        return [4 /*yield*/, this.validateBlockchainConfig(network)];
                    case 6:
                        // Validate deployment config first
                        _b.sent();
                        // Initialize and check network connection
                        suiClient_1 = new client_1.SuiClient({ url: networkUrl });
                        return [4 /*yield*/, this.getNetworkStatus(suiClient_1)];
                    case 7:
                        protocolVersion = _b.sent();
                        this.log(chalk_1.default.dim("Connected to ".concat(network, " (protocol version ").concat(protocolVersion, ")")));
                        if (!todo_1.nftObjectId) return [3 /*break*/, 10];
                        return [4 /*yield*/, this.validateNftState(suiClient_1, todo_1.nftObjectId)];
                    case 8:
                        _b.sent();
                        signer = {};
                        suiNftStorage_1 = new sui_nft_storage_1.SuiNftStorage(suiClient_1, signer, { address: config.lastDeployment.packageId, packageId: config.lastDeployment.packageId });
                        return [4 /*yield*/, this.estimateGasForNftUpdate(suiClient_1, todo_1.nftObjectId, config.lastDeployment.packageId)];
                    case 9:
                        gasEstimate = _b.sent();
                        this.log(chalk_1.default.dim("Estimated gas cost: ".concat(Number(gasEstimate.computationCost) + Number(gasEstimate.storageCost), " MIST")));
                        _b.label = 10;
                    case 10:
                        // Update local todo first
                        this.log(chalk_1.default.blue("Marking todo \"".concat(todo_1.title, "\" as completed...")));
                        return [4 /*yield*/, this.todoService.toggleItemStatus(args.list, todo_1.id, true)];
                    case 11:
                        _b.sent();
                        this.log(chalk_1.default.green('\u2713 Local update successful'));
                        if (!(todo_1.nftObjectId && suiNftStorage_1)) return [3 /*break*/, 27];
                        _b.label = 12;
                    case 12:
                        _b.trys.push([12, 15, , 16]);
                        this.log(chalk_1.default.blue('Updating NFT on blockchain...'));
                        return [4 /*yield*/, (0, error_handler_1.withRetry)(function () { return suiNftStorage_1.updateTodoNftCompletionStatus(todo_1.nftObjectId); }, 3, 1000)];
                    case 13:
                        txDigest = _b.sent();
                        this.log(chalk_1.default.green('\u2713 Todo NFT updated on blockchain'));
                        this.log(chalk_1.default.dim("Transaction: ".concat(txDigest)));
                        // Verify NFT update
                        return [4 /*yield*/, (0, error_handler_1.withRetry)(function () { return __awaiter(_this, void 0, void 0, function () {
                                var result, content;
                                var _a, _b;
                                return __generator(this, function (_c) {
                                    switch (_c.label) {
                                        case 0: return [4 /*yield*/, suiClient_1.getObject({
                                                id: todo_1.nftObjectId,
                                                options: { showContent: true }
                                            })];
                                        case 1:
                                            result = _c.sent();
                                            content = (_a = result.data) === null || _a === void 0 ? void 0 : _a.content;
                                            if (!((_b = content === null || content === void 0 ? void 0 : content.fields) === null || _b === void 0 ? void 0 : _b.completed)) {
                                                throw new Error('NFT update verification failed');
                                            }
                                            return [2 /*return*/];
                                    }
                                });
                            }); }, 3, 2000)];
                    case 14:
                        // Verify NFT update
                        _b.sent();
                        return [3 /*break*/, 16];
                    case 15:
                        blockchainError_1 = _b.sent();
                        // Keep local update but throw error for blockchain update
                        throw new error_1.CLIError("Failed to update NFT on blockchain: ".concat(blockchainError_1 instanceof Error ? blockchainError_1.message : String(blockchainError_1), "\nLocal update was successful, but blockchain state may be out of sync."), 'BLOCKCHAIN_UPDATE_FAILED');
                    case 16:
                        if (!todo_1.walrusBlobId) return [3 /*break*/, 27];
                        _b.label = 17;
                    case 17:
                        _b.trys.push([17, , 23, 27]);
                        this.log(chalk_1.default.blue('Connecting to Walrus storage...'));
                        return [4 /*yield*/, this.walrusStorage.connect()];
                    case 18:
                        _b.sent();
                        timeout = new Promise(function (_, reject) {
                            setTimeout(function () { return reject(new Error('Walrus operation timed out')); }, 30000);
                        });
                        // Update todo on Walrus with retries
                        this.log(chalk_1.default.blue('Updating todo on Walrus...'));
                        updatedTodo = __assign(__assign({}, todo_1), { completed: true, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
                        maxRetries = 3;
                        _loop_1 = function (attempt) {
                            var newBlobId, error_6;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        _c.trys.push([0, 5, , 7]);
                                        return [4 /*yield*/, Promise.race([
                                                this_1.walrusStorage.updateTodo(updatedTodo, todo_1.walrusBlobId),
                                                timeout
                                            ])];
                                    case 1:
                                        newBlobId = _c.sent();
                                        if (!(typeof newBlobId === 'string')) return [3 /*break*/, 3];
                                        // Update local todo with new blob ID
                                        return [4 /*yield*/, this_1.todoService.updateTodo(args.list, todo_1.id, {
                                                walrusBlobId: newBlobId,
                                                completedAt: updatedTodo.completedAt,
                                                updatedAt: updatedTodo.updatedAt
                                            })];
                                    case 2:
                                        // Update local todo with new blob ID
                                        _c.sent();
                                        this_1.log(chalk_1.default.green('\u2713 Todo updated on Walrus'));
                                        this_1.log(chalk_1.default.dim("New blob ID: ".concat(newBlobId)));
                                        this_1.log(chalk_1.default.dim("Public URL: https://testnet.wal.app/blob/".concat(newBlobId)));
                                        return [2 /*return*/, "break"];
                                    case 3: throw new Error('Invalid blob ID returned from Walrus');
                                    case 4: return [3 /*break*/, 7];
                                    case 5:
                                        error_6 = _c.sent();
                                        lastWalrusError = error_6 instanceof Error ? error_6 : new Error(String(error_6));
                                        if (attempt === maxRetries) {
                                            this_1.log(chalk_1.default.yellow('\u26a0\ufe0f Failed to update Walrus storage after all retries'));
                                            this_1.log(chalk_1.default.yellow('The todo has been marked as completed locally and on-chain, but Walrus blob is out of sync.'));
                                            return [2 /*return*/, "break"];
                                        }
                                        this_1.log(chalk_1.default.yellow("Attempt ".concat(attempt, " failed, retrying...")));
                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000 * attempt); })];
                                    case 6:
                                        _c.sent();
                                        return [3 /*break*/, 7];
                                    case 7: return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        attempt = 1;
                        _b.label = 19;
                    case 19:
                        if (!(attempt <= maxRetries)) return [3 /*break*/, 22];
                        return [5 /*yield**/, _loop_1(attempt)];
                    case 20:
                        state_1 = _b.sent();
                        if (state_1 === "break")
                            return [3 /*break*/, 22];
                        _b.label = 21;
                    case 21:
                        attempt++;
                        return [3 /*break*/, 19];
                    case 22: return [3 /*break*/, 27];
                    case 23:
                        _b.trys.push([23, 25, , 26]);
                        return [4 /*yield*/, this.walrusStorage.disconnect()];
                    case 24:
                        _b.sent();
                        return [3 /*break*/, 26];
                    case 25:
                        disconnectError_1 = _b.sent();
                        // Just log this error, it's not critical
                        this.warn('Warning: Failed to disconnect from Walrus');
                        return [3 /*break*/, 26];
                    case 26: return [7 /*endfinally*/];
                    case 27:
                        // Show final success message with appropriate details
                        this.log(chalk_1.default.green('\n\u2713 Todo completion summary:'));
                        this.log(chalk_1.default.dim('Title:'));
                        this.log("  ".concat(chalk_1.default.bold(todo_1.title)));
                        this.log(chalk_1.default.dim('\nUpdates:'));
                        this.log("  ".concat(chalk_1.default.green('\u2713'), " Local storage"));
                        if (todo_1.nftObjectId) {
                            this.log("  ".concat(chalk_1.default.green('\u2713'), " Blockchain NFT"));
                            this.log(chalk_1.default.blue('\nView your updated NFT:'));
                            this.log(chalk_1.default.cyan("  https://explorer.sui.io/object/".concat(todo_1.nftObjectId, "?network=").concat(network)));
                        }
                        if (todo_1.walrusBlobId) {
                            walrusUpdateStatus = lastWalrusError ? chalk_1.default.yellow('\u26a0\ufe0f') : chalk_1.default.green('\u2713');
                            this.log("  ".concat(walrusUpdateStatus, " Walrus storage"));
                        }
                        return [3 /*break*/, 29];
                    case 28:
                        error_5 = _b.sent();
                        if (error_5 instanceof error_1.CLIError) {
                            throw error_5;
                        }
                        throw new error_1.CLIError("Failed to complete todo: ".concat(error_5 instanceof Error ? error_5.message : String(error_5)), 'COMPLETE_FAILED');
                    case 29: return [2 /*return*/];
                }
            });
        });
    };
    CompleteCommand.description = "Mark a todo as completed.\n  If the todo has an associated NFT or Walrus blob, updates blockchain storage as well.\n  NFT updates may require gas tokens on the configured network.";
    CompleteCommand.examples = [
        '<%= config.bin %> complete my-list -i todo-123',
        '<%= config.bin %> complete my-list -i "Buy groceries"'
    ];
    CompleteCommand.flags = {
        id: core_1.Flags.string({
            char: 'i',
            description: 'Todo ID or title to mark as completed',
            required: true
        }),
        network: core_1.Flags.string({
            char: 'n',
            description: 'Network to use (defaults to configured network)',
            options: ['localnet', 'devnet', 'testnet', 'mainnet'],
        })
    };
    CompleteCommand.args = {
        list: core_1.Args.string({
            name: 'list',
            description: 'List name',
            default: 'default'
        })
    };
    return CompleteCommand;
}(core_1.Command));
exports.default = CompleteCommand;
