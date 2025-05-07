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
exports.SuiNftStorage = void 0;
var transactions_1 = require("@mysten/sui.js/transactions");
var error_1 = require("../types/error");
var SuiNftStorage = /** @class */ (function () {
    function SuiNftStorage(client, signer, config) {
        this.retryAttempts = 3;
        this.retryDelay = 1000; // ms
        this.client = client;
        this.signer = signer;
        this.config = config;
    }
    SuiNftStorage.prototype.checkConnectionHealth = function () {
        return __awaiter(this, void 0, void 0, function () {
            var systemState, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.getLatestSuiSystemState()];
                    case 1:
                        systemState = _a.sent();
                        if (!systemState || !systemState.epoch) {
                            console.warn('Invalid system state response:', systemState);
                            return [2 /*return*/, false];
                        }
                        return [2 /*return*/, true];
                    case 2:
                        error_2 = _a.sent();
                        console.warn('Failed to check network health:', error_2);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    SuiNftStorage.prototype.executeWithRetry = function (operation, validateResponse, errorMessage) {
        return __awaiter(this, void 0, void 0, function () {
            var lastError, isHealthy, _loop_1, this_1, attempt, state_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        lastError = null;
                        return [4 /*yield*/, this.checkConnectionHealth()];
                    case 1:
                        isHealthy = _a.sent();
                        if (!isHealthy) {
                            throw new error_1.CLIError('Failed to check network health. Please verify your Sui RPC endpoint configuration.', 'SUI_NETWORK_ERROR');
                        }
                        _loop_1 = function (attempt) {
                            var response, error_3;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 2, , 5]);
                                        return [4 /*yield*/, operation()];
                                    case 1:
                                        response = _b.sent();
                                        if (!validateResponse(response)) {
                                            throw new Error('Invalid response from network');
                                        }
                                        return [2 /*return*/, { value: response }];
                                    case 2:
                                        error_3 = _b.sent();
                                        lastError = error_3;
                                        if (!(attempt < this_1.retryAttempts)) return [3 /*break*/, 4];
                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, _this.retryDelay * attempt); })];
                                    case 3:
                                        _b.sent();
                                        return [2 /*return*/, "continue"];
                                    case 4: return [3 /*break*/, 5];
                                    case 5: return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        attempt = 1;
                        _a.label = 2;
                    case 2:
                        if (!(attempt <= this.retryAttempts)) return [3 /*break*/, 5];
                        return [5 /*yield**/, _loop_1(attempt)];
                    case 3:
                        state_1 = _a.sent();
                        if (typeof state_1 === "object")
                            return [2 /*return*/, state_1.value];
                        _a.label = 4;
                    case 4:
                        attempt++;
                        return [3 /*break*/, 2];
                    case 5: throw new error_1.CLIError("".concat(errorMessage, ": ").concat(lastError instanceof Error ? lastError.message : 'Unknown error'), 'SUI_NETWORK_ERROR');
                }
            });
        });
    };
    SuiNftStorage.prototype.createTodoNft = function (todo, walrusBlobId) {
        return __awaiter(this, void 0, void 0, function () {
            var tx_1, error_4;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!todo.title) {
                            throw new error_1.CLIError('Todo title is required', 'INVALID_TODO');
                        }
                        if (!walrusBlobId) {
                            throw new error_1.CLIError('A valid Walrus blob ID must be provided', 'INVALID_BLOB_ID');
                        }
                        if (todo.title.length > 100) {
                            throw new error_1.CLIError('Todo title must be less than 100 characters', 'INVALID_TITLE');
                        }
                        console.log('Preparing Todo NFT creation...');
                        console.log('Title:', todo.title);
                        console.log('Walrus Blob ID:', walrusBlobId);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        tx_1 = new transactions_1.TransactionBlock();
                        tx_1.moveCall({
                            target: "".concat(this.config.packageId, "::todo_nft::create_todo_nft"),
                            arguments: [
                                tx_1.pure(todo.title),
                                tx_1.pure(todo.description || ''),
                                tx_1.pure(walrusBlobId),
                                tx_1.pure(false), // completed
                                tx_1.object(this.config.collectionId || ''),
                            ],
                        });
                        return [4 /*yield*/, this.executeWithRetry(function () { return __awaiter(_this, void 0, void 0, function () {
                                var response;
                                var _a, _b, _c, _d, _e;
                                return __generator(this, function (_f) {
                                    switch (_f.label) {
                                        case 0: return [4 /*yield*/, this.client.signAndExecuteTransactionBlock({
                                                transactionBlock: tx_1,
                                                signer: this.signer,
                                                requestType: 'WaitForLocalExecution',
                                                options: {
                                                    showEffects: true,
                                                },
                                            })];
                                        case 1:
                                            response = _f.sent();
                                            if (!((_b = (_a = response.effects) === null || _a === void 0 ? void 0 : _a.status) === null || _b === void 0 ? void 0 : _b.status) || response.effects.status.status !== 'success') {
                                                throw new Error(((_d = (_c = response.effects) === null || _c === void 0 ? void 0 : _c.status) === null || _d === void 0 ? void 0 : _d.error) || 'Unknown error');
                                            }
                                            if (!((_e = response.effects.created) === null || _e === void 0 ? void 0 : _e.length)) {
                                                throw new Error('NFT creation failed: no NFT was created');
                                            }
                                            return [2 /*return*/, response.digest];
                                    }
                                });
                            }); }, function (response) { return Boolean(response && response.length > 0); }, 'Failed to create Todo NFT')];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        error_4 = _a.sent();
                        throw new error_1.CLIError("Failed to create Todo NFT: ".concat(error_4 instanceof Error ? error_4.message : String(error_4)), 'SUI_CREATION_FAILED');
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    SuiNftStorage.prototype.getTodoNft = function (nftId) {
        return __awaiter(this, void 0, void 0, function () {
            var objectId;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!nftId) {
                            throw new error_1.CLIError('NFT object ID is required', 'INVALID_NFT_ID');
                        }
                        return [4 /*yield*/, this.normalizeObjectId(nftId)];
                    case 1:
                        objectId = _a.sent();
                        console.log('Retrieving Todo NFT with object ID:', objectId);
                        console.log('Retrieving NFT object data...');
                        return [4 /*yield*/, this.executeWithRetry(function () { return __awaiter(_this, void 0, void 0, function () {
                                var response, content, fields;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.client.getObject({
                                                id: objectId,
                                                options: {
                                                    showContent: true,
                                                },
                                            })];
                                        case 1:
                                            response = _a.sent();
                                            if (!response.data) {
                                                throw new error_1.CLIError("Todo NFT not found: ".concat(objectId, ". The NFT may have been deleted."), 'SUI_OBJECT_NOT_FOUND');
                                            }
                                            content = response.data.content;
                                            if (!content || !content.fields) {
                                                throw new error_1.CLIError('Invalid NFT data format', 'SUI_INVALID_DATA');
                                            }
                                            fields = content.fields;
                                            return [2 /*return*/, {
                                                    objectId: objectId,
                                                    title: fields.title || '',
                                                    description: fields.description || '',
                                                    completed: fields.completed || false,
                                                    walrusBlobId: fields.walrus_blob_id || fields.walrusBlobId || '',
                                                }];
                                    }
                                });
                            }); }, function (response) { return Boolean(response && response.objectId); }, 'Failed to fetch Todo NFT')];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    SuiNftStorage.prototype.updateTodoNftCompletionStatus = function (nftId) {
        return __awaiter(this, void 0, void 0, function () {
            var tx;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!nftId) {
                            throw new error_1.CLIError('NFT object ID is required', 'INVALID_NFT_ID');
                        }
                        tx = new transactions_1.TransactionBlock();
                        tx.moveCall({
                            target: "".concat(this.config.packageId, "::todo_nft::update_completion_status"),
                            arguments: [
                                tx.object(nftId),
                                tx.pure(true),
                            ],
                        });
                        return [4 /*yield*/, this.executeWithRetry(function () { return __awaiter(_this, void 0, void 0, function () {
                                var response;
                                var _a, _b, _c, _d;
                                return __generator(this, function (_e) {
                                    switch (_e.label) {
                                        case 0: return [4 /*yield*/, this.client.signAndExecuteTransactionBlock({
                                                transactionBlock: tx,
                                                signer: this.signer,
                                                requestType: 'WaitForLocalExecution',
                                                options: {
                                                    showEffects: true,
                                                },
                                            })];
                                        case 1:
                                            response = _e.sent();
                                            if (!((_b = (_a = response.effects) === null || _a === void 0 ? void 0 : _a.status) === null || _b === void 0 ? void 0 : _b.status) || response.effects.status.status !== 'success') {
                                                throw new Error(((_d = (_c = response.effects) === null || _c === void 0 ? void 0 : _c.status) === null || _d === void 0 ? void 0 : _d.error) || 'Unknown error');
                                            }
                                            return [2 /*return*/, response.digest];
                                    }
                                });
                            }); }, function (response) { return Boolean(response && response.length > 0); }, 'Failed to update Todo NFT completion status')];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    SuiNftStorage.prototype.normalizeObjectId = function (idOrDigest) {
        return __awaiter(this, void 0, void 0, function () {
            var tx, nftObject, objectId;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!(idOrDigest.length === 44)) return [3 /*break*/, 2];
                        console.log('Object ID', idOrDigest, 'appears to be a transaction digest, not an object ID');
                        console.log('Attempting to get the actual object ID from the transaction effects...');
                        return [4 /*yield*/, this.client.getTransactionBlock({
                                digest: idOrDigest,
                                options: {
                                    showEffects: true,
                                },
                            })];
                    case 1:
                        tx = _d.sent();
                        if (!((_b = (_a = tx.effects) === null || _a === void 0 ? void 0 : _a.created) === null || _b === void 0 ? void 0 : _b.length)) {
                            throw new error_1.CLIError('No NFT was created in this transaction', 'SUI_INVALID_TRANSACTION');
                        }
                        nftObject = tx.effects.created.find(function (obj) { var _a; return (_a = obj.reference) === null || _a === void 0 ? void 0 : _a.objectId; });
                        if (!((_c = nftObject === null || nftObject === void 0 ? void 0 : nftObject.reference) === null || _c === void 0 ? void 0 : _c.objectId)) {
                            throw new error_1.CLIError('Could not find created NFT in transaction', 'SUI_INVALID_TRANSACTION');
                        }
                        objectId = nftObject.reference.objectId;
                        console.log('Found TodoNFT object:', objectId);
                        return [2 /*return*/, objectId];
                    case 2: return [2 /*return*/, idOrDigest];
                }
            });
        });
    };
    return SuiNftStorage;
}());
exports.SuiNftStorage = SuiNftStorage;
