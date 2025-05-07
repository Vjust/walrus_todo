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
exports.WalrusStorage = void 0;
exports.createWalrusStorage = createWalrusStorage;
var error_handler_1 = require("./error-handler");
var todo_serializer_1 = require("./todo-serializer");
var error_1 = require("../types/error");
var client_1 = require("@mysten/sui.js/client");
var client_2 = require("@mysten/sui.js/client");
var walrus_1 = require("@mysten/walrus");
var sui_keystore_1 = require("./sui-keystore");
var child_process_1 = require("child_process");
var error_handler_2 = require("./error-handler");
var crypto_1 = require("crypto");
// Import node-fetch dynamically to avoid ESM issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
var fetch;
var WalrusStorage = /** @class */ (function () {
    function WalrusStorage(useMockMode) {
        if (useMockMode === void 0) { useMockMode = false; }
        this.connectionState = 'disconnected';
        this.signer = null;
        this.lastHealthCheck = 0;
        this.healthCheckInterval = 30000; // 30 seconds
        this.useMockMode = useMockMode;
        var options = {
            url: (0, client_2.getFullnodeUrl)('testnet')
        };
        this.suiClient = new client_1.SuiClient(options);
    }
    WalrusStorage.prototype.checkConnectionHealth = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.suiClient.getLatestSuiSystemState()];
                    case 1:
                        _a.sent();
                        this.lastHealthCheck = Date.now();
                        return [2 /*return*/, true];
                    case 2:
                        error_2 = _a.sent();
                        console.warn('Connection health check failed:', error_2);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    WalrusStorage.prototype.calculateChecksum = function (data) {
        return crypto_1.default.createHash('sha256').update(data).digest('hex');
    };
    WalrusStorage.prototype.validateTodoData = function (todo) {
        if (!todo.id || typeof todo.id !== 'string') {
            throw new Error('Invalid todo: missing or invalid id');
        }
        if (!todo.title || typeof todo.title !== 'string') {
            throw new Error('Invalid todo: missing or invalid title');
        }
        if (typeof todo.completed !== 'boolean') {
            throw new Error('Invalid todo: invalid completed status');
        }
        if (!todo.createdAt || isNaN(Date.parse(todo.createdAt))) {
            throw new Error('Invalid todo: invalid createdAt date');
        }
        if (!todo.updatedAt || isNaN(Date.parse(todo.updatedAt))) {
            throw new Error('Invalid todo: invalid updatedAt date');
        }
    };
    WalrusStorage.prototype.validateTodoListData = function (todoList) {
        var _this = this;
        if (!todoList.id || typeof todoList.id !== 'string') {
            throw new Error('Invalid todo list: missing or invalid id');
        }
        if (!todoList.name || typeof todoList.name !== 'string') {
            throw new Error('Invalid todo list: missing or invalid name');
        }
        if (!Array.isArray(todoList.todos)) {
            throw new Error('Invalid todo list: todos must be an array');
        }
        todoList.todos.forEach(function (todo) { return _this.validateTodoData(todo); });
    };
    WalrusStorage.prototype.executeWithRetry = function (operation_1, context_1) {
        return __awaiter(this, arguments, void 0, function (operation, context, maxRetries) {
            var isHealthy;
            if (maxRetries === void 0) { maxRetries = 3; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(Date.now() - this.lastHealthCheck > this.healthCheckInterval)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.checkConnectionHealth()];
                    case 1:
                        isHealthy = _a.sent();
                        if (!isHealthy) {
                            this.connectionState = 'failed';
                            throw new Error("Connection health check failed before ".concat(context));
                        }
                        _a.label = 2;
                    case 2: return [4 /*yield*/, (0, error_handler_1.withRetry)(operation, maxRetries, 1000)];
                    case 3: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    WalrusStorage.prototype.init = function () {
        return __awaiter(this, void 0, void 0, function () {
            var envInfo, nodeFetch, fetchError_1, address, isHealthy, error_3;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.useMockMode) {
                            this.connectionState = 'connected';
                            return [2 /*return*/];
                        }
                        console.log('Initializing WalrusStorage connection...');
                        this.connectionState = 'connecting';
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 8, , 9]);
                        return [4 /*yield*/, this.executeWithRetry(function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, (0, child_process_1.execSync)('sui client active-env').toString().trim()];
                            }); }); }, 'environment check')];
                    case 2:
                        envInfo = _a.sent();
                        if (!envInfo.includes('testnet')) {
                            this.connectionState = 'failed';
                            throw new Error('Must be connected to testnet environment. Use "sui client switch --env testnet"');
                        }
                        console.log('Environment validation successful, initializing clients...');
                        if (!!fetch) return [3 /*break*/, 6];
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('node-fetch'); })];
                    case 4:
                        nodeFetch = _a.sent();
                        fetch = nodeFetch.default;
                        console.log('Successfully imported node-fetch');
                        return [3 /*break*/, 6];
                    case 5:
                        fetchError_1 = _a.sent();
                        console.warn('Failed to import node-fetch, falling back to global fetch');
                        fetch = globalThis.fetch;
                        return [3 /*break*/, 6];
                    case 6:
                        this.walrusClient = new walrus_1.WalrusClient({
                            network: 'testnet',
                            suiClient: this.suiClient,
                            storageNodeClientOptions: {
                                timeout: 60000,
                                onError: function (error) {
                                    console.error('Storage node error:', error);
                                    if (_this.connectionState === 'connected') {
                                        _this.connectionState = 'failed';
                                    }
                                    (0, error_handler_2.handleError)('Walrus storage node error:', error);
                                }
                            }
                        });
                        this.signer = new sui_keystore_1.KeystoreSigner(this.suiClient);
                        address = this.signer.toSuiAddress();
                        if (!address) {
                            this.connectionState = 'failed';
                            throw new Error('Failed to initialize signer - no active address found');
                        }
                        return [4 /*yield*/, this.checkConnectionHealth()];
                    case 7:
                        isHealthy = _a.sent();
                        if (!isHealthy) {
                            this.connectionState = 'failed';
                            throw new Error('Initial connection health check failed');
                        }
                        console.log('WalrusStorage initialization successful');
                        this.connectionState = 'connected';
                        return [3 /*break*/, 9];
                    case 8:
                        error_3 = _a.sent();
                        this.connectionState = 'failed';
                        throw new error_1.CLIError("Failed to initialize Walrus storage: ".concat(error_3 instanceof Error ? error_3.message : String(error_3)), 'WALRUS_INIT_FAILED');
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    WalrusStorage.prototype.isConnected = function () {
        return __awaiter(this, void 0, void 0, function () {
            var isHealthy;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(this.connectionState === 'connected' &&
                            Date.now() - this.lastHealthCheck > this.healthCheckInterval)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.checkConnectionHealth()];
                    case 1:
                        isHealthy = _a.sent();
                        if (!isHealthy) {
                            this.connectionState = 'failed';
                            return [2 /*return*/, false];
                        }
                        _a.label = 2;
                    case 2: return [2 /*return*/, this.connectionState === 'connected'];
                }
            });
        });
    };
    WalrusStorage.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(this.connectionState === 'disconnected' || this.connectionState === 'failed')) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.init()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    WalrusStorage.prototype.disconnect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                if (this.connectionState !== 'disconnected') {
                    console.log('Disconnecting WalrusStorage...');
                    this.connectionState = 'disconnected';
                    (_a = this.walrusClient) === null || _a === void 0 ? void 0 : _a.reset();
                    this.signer = null;
                }
                return [2 /*return*/];
            });
        });
    };
    WalrusStorage.prototype.getTransactionSigner = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this.signer) {
                    throw new Error('WalrusStorage not initialized. Call connect() first.');
                }
                return [2 /*return*/, this.signer];
            });
        });
    };
    WalrusStorage.prototype.getActiveAddress = function () {
        if (!this.signer) {
            throw new Error('WalrusStorage not initialized. Call connect() first.');
        }
        return this.signer.toSuiAddress();
    };
    /**
     * Store a todo item in Walrus blob storage.
     *
     * This method performs several steps:
     * 1. Validates todo data format and fields
     * 2. Serializes the todo and generates a SHA-256 checksum
     * 3. Ensures sufficient storage space is allocated
     * 4. Uploads the todo data with metadata as a Walrus blob
     * 5. Verifies the uploaded content with retries
     *
     * @param todo - The todo item to store
     * @returns A Promise resolving to the Walrus blob ID
     * @throws {CLIError} with specific error codes for:
     *   - WALRUS_VALIDATION_FAILED: Todo data validation failed
     *   - WALRUS_SERIALIZATION_FAILED: Failed to serialize todo data
     *   - WALRUS_DATA_TOO_LARGE: Todo data exceeds size limit (10MB)
     *   - WALRUS_INSUFFICIENT_TOKENS: Not enough WAL tokens
     *   - WALRUS_STORAGE_ALLOCATION_FAILED: Failed to allocate storage
     *   - WALRUS_VERIFICATION_FAILED: Content verification failed
     *   - WALRUS_STORE_FAILED: Other storage failures
     */
    WalrusStorage.prototype.storeTodo = function (todo) {
        return __awaiter(this, void 0, void 0, function () {
            var buffer_1, sizeBytes_1, checksum_1, storage, epoch, balance, error_4, signer_1, blobObject, verifiedContent, uploadAttempt, maxAttempts, failureReason, uploadedContent, uploadedBuffer, uploadedSize, uploadedChecksum, uploadedTodo, error_5, error_6;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 17, , 18]);
                        if (this.useMockMode) {
                            console.log('Using mock mode for storing todo');
                            return [2 /*return*/, "mock-blob-".concat(todo.id)];
                        }
                        if (this.connectionState !== 'connected' || !this.walrusClient) {
                            throw new Error('WalrusStorage not connected. Call connect() first.');
                        }
                        // Validate todo data
                        try {
                            this.validateTodoData(todo);
                        }
                        catch (error) {
                            throw new error_1.CLIError("Todo validation failed: ".concat(error instanceof Error ? error.message : String(error)), 'WALRUS_VALIDATION_FAILED');
                        }
                        console.log("Serializing todo \"".concat(todo.title, "\" for storage..."));
                        try {
                            buffer_1 = todo_serializer_1.TodoSerializer.todoToBuffer(todo);
                        }
                        catch (error) {
                            throw new error_1.CLIError("Failed to serialize todo: ".concat(error instanceof Error ? error.message : String(error)), 'WALRUS_SERIALIZATION_FAILED');
                        }
                        sizeBytes_1 = buffer_1.length;
                        if (sizeBytes_1 > 10 * 1024 * 1024) { // 10MB limit
                            throw new error_1.CLIError('Todo data is too large. Maximum size is 10MB.', 'WALRUS_DATA_TOO_LARGE');
                        }
                        checksum_1 = this.calculateChecksum(buffer_1);
                        return [4 /*yield*/, this.ensureStorageAllocated(sizeBytes_1 + 1000)];
                    case 1:
                        storage = _a.sent();
                        if (!!storage) return [3 /*break*/, 6];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 5, , 6]);
                        return [4 /*yield*/, this.suiClient.getLatestSuiSystemState()];
                    case 3:
                        epoch = (_a.sent()).epoch;
                        return [4 /*yield*/, this.suiClient.getBalance({
                                owner: this.getActiveAddress(),
                                coinType: 'WAL'
                            })];
                    case 4:
                        balance = _a.sent();
                        if (Number(balance.totalBalance) < 100) { // Minimum WAL needed
                            throw new error_1.CLIError('Insufficient WAL tokens. Please acquire WAL tokens to store your todo.', 'WALRUS_INSUFFICIENT_TOKENS');
                        }
                        return [3 /*break*/, 6];
                    case 5:
                        error_4 = _a.sent();
                        // If we can't determine balance, use a generic error
                        throw new error_1.CLIError('Failed to allocate storage for todo. Please check your WAL token balance and try again.', 'WALRUS_STORAGE_ALLOCATION_FAILED');
                    case 6: return [4 /*yield*/, this.getTransactionSigner()];
                    case 7:
                        signer_1 = _a.sent();
                        return [4 /*yield*/, this.executeWithRetry(function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    return [2 /*return*/, this.walrusClient.writeBlob({
                                            blob: new Uint8Array(buffer_1),
                                            deletable: false,
                                            epochs: 52,
                                            signer: signer_1,
                                            attributes: {
                                                contentType: 'application/json',
                                                filename: "todo-".concat(todo.id, ".json"),
                                                type: 'todo-data',
                                                title: todo.title,
                                                completed: todo.completed.toString(),
                                                checksum_algo: 'sha256',
                                                checksum: checksum_1,
                                                size: sizeBytes_1.toString(),
                                                version: '1',
                                                schemaVersion: '1',
                                                encoding: 'utf-8'
                                            }
                                        })];
                                });
                            }); }, 'todo storage', 5)];
                    case 8:
                        blobObject = (_a.sent()).blobObject;
                        verifiedContent = false;
                        uploadAttempt = 1;
                        maxAttempts = 3;
                        failureReason = '';
                        _a.label = 9;
                    case 9:
                        if (!(!verifiedContent && uploadAttempt <= maxAttempts)) return [3 /*break*/, 16];
                        _a.label = 10;
                    case 10:
                        _a.trys.push([10, 14, , 15]);
                        console.log("Verifying upload attempt ".concat(uploadAttempt, "..."));
                        return [4 /*yield*/, this.walrusClient.readBlob({ blobId: blobObject.blob_id })];
                    case 11:
                        uploadedContent = _a.sent();
                        if (!!uploadedContent) return [3 /*break*/, 13];
                        failureReason = 'Content not found';
                        uploadAttempt++;
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                    case 12:
                        _a.sent(); // Wait before retry
                        return [3 /*break*/, 9];
                    case 13:
                        uploadedBuffer = Buffer.from(uploadedContent);
                        uploadedSize = uploadedBuffer.length;
                        uploadedChecksum = this.calculateChecksum(uploadedBuffer);
                        // Verify size and checksum
                        if (uploadedSize !== sizeBytes_1) {
                            failureReason = "Size mismatch: expected ".concat(sizeBytes_1, ", got ").concat(uploadedSize);
                            uploadAttempt++;
                            return [3 /*break*/, 9];
                        }
                        if (uploadedChecksum !== checksum_1) {
                            failureReason = 'Checksum mismatch';
                            uploadAttempt++;
                            return [3 /*break*/, 9];
                        }
                        // Additional verification: parse and validate todo
                        try {
                            uploadedTodo = JSON.parse(uploadedBuffer.toString('utf-8'));
                            if (uploadedTodo.id !== todo.id || uploadedTodo.title !== todo.title) {
                                failureReason = 'Todo data mismatch';
                                uploadAttempt++;
                                return [3 /*break*/, 9];
                            }
                        }
                        catch (error) {
                            failureReason = 'Invalid todo data format';
                            uploadAttempt++;
                            return [3 /*break*/, 9];
                        }
                        verifiedContent = true;
                        return [3 /*break*/, 15];
                    case 14:
                        error_5 = _a.sent();
                        failureReason = error_5 instanceof Error ? error_5.message : String(error_5);
                        uploadAttempt++;
                        return [3 /*break*/, 15];
                    case 15: return [3 /*break*/, 9];
                    case 16:
                        if (!verifiedContent) {
                            throw new error_1.CLIError("Failed to verify uploaded content after ".concat(maxAttempts, " attempts: ").concat(failureReason), 'WALRUS_VERIFICATION_FAILED');
                        }
                        console.log("Todo successfully stored with blob ID: ".concat(blobObject.blob_id));
                        return [2 /*return*/, blobObject.blob_id];
                    case 17:
                        error_6 = _a.sent();
                        throw new error_1.CLIError("Failed to store todo: ".concat(error_6 instanceof Error ? error_6.message : String(error_6)), 'WALRUS_STORE_FAILED');
                    case 18: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Retrieve a todo item from Walrus blob storage.
     *
     * This method attempts to retrieve the todo data in this order:
     * 1. Check in-memory cache
     * 2. Try direct retrieval from Walrus client
     * 3. Fall back to public aggregator with retries
     *
     * @param blobId - The Walrus blob ID to retrieve
     * @returns A Promise resolving to the Todo item
     * @throws {CLIError} with specific error codes for various failure scenarios
     */
    WalrusStorage.prototype.retrieveTodo = function (blobId) {
        return __awaiter(this, void 0, void 0, function () {
            var cached, failures, blobContent, todo, error_7, maxRetries, _loop_1, this_1, attempt, state_1, error_8;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 11, , 12]);
                        if (this.useMockMode) {
                            console.log('Using mock mode for retrieving todo');
                            return [2 /*return*/, {
                                    id: 'mock-id',
                                    title: 'Mock task',
                                    description: 'Mock description',
                                    completed: false,
                                    priority: 'medium',
                                    tags: [],
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString(),
                                    walrusBlobId: blobId,
                                    private: true
                                }];
                        }
                        if (!(blobId === null || blobId === void 0 ? void 0 : blobId.trim())) {
                            throw new error_1.CLIError('Blob ID is required', 'WALRUS_INVALID_INPUT');
                        }
                        if (this.connectionState !== 'connected' || !this.walrusClient) {
                            throw new error_1.CLIError('WalrusStorage not connected. Call connect() first.', 'WALRUS_NOT_CONNECTED');
                        }
                        cached = WalrusStorage.todoCache.get(blobId);
                        if (cached && cached.expires > Date.now()) {
                            console.log('Retrieved todo from cache');
                            return [2 /*return*/, cached.data];
                        }
                        console.log("Retrieving todo from Walrus with blob ID: ".concat(blobId, "..."));
                        failures = [];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 6]);
                        return [4 /*yield*/, this.executeWithRetry(function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, this.walrusClient.readBlob({ blobId: blobId })];
                            }); }); }, 'todo retrieval')];
                    case 2:
                        blobContent = _a.sent();
                        if (!blobContent) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.parseTodoData(blobContent)];
                    case 3:
                        todo = _a.sent();
                        this.cacheTodo(blobId, todo);
                        console.log('Successfully retrieved todo data from Walrus');
                        return [2 /*return*/, todo];
                    case 4:
                        failures.push('Direct retrieval returned null');
                        return [3 /*break*/, 6];
                    case 5:
                        error_7 = _a.sent();
                        failures.push("Direct retrieval failed: ".concat(error_7 instanceof Error ? error_7.message : String(error_7)));
                        return [3 /*break*/, 6];
                    case 6:
                        // Fallback to public aggregator with retries
                        console.log('Attempting to retrieve from public aggregator...');
                        maxRetries = 3;
                        _loop_1 = function (attempt) {
                            var response, buffer, todo, error_9;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 7, , 10]);
                                        return [4 /*yield*/, fetch("https://aggregator.walrus-testnet.walrus.space/v1/blobs/".concat(blobId), {
                                                method: 'GET',
                                                headers: { 'Accept': 'application/json' }
                                            })];
                                    case 1:
                                        response = _b.sent();
                                        if (!!response.ok) return [3 /*break*/, 4];
                                        failures.push("Aggregator attempt ".concat(attempt, " failed: ").concat(response.statusText));
                                        if (!(attempt < maxRetries)) return [3 /*break*/, 3];
                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000 * attempt); })];
                                    case 2:
                                        _b.sent();
                                        return [2 /*return*/, "continue"];
                                    case 3: return [2 /*return*/, "break"];
                                    case 4: return [4 /*yield*/, response.arrayBuffer()];
                                    case 5:
                                        buffer = _b.sent();
                                        return [4 /*yield*/, this_1.parseTodoData(new Uint8Array(buffer))];
                                    case 6:
                                        todo = _b.sent();
                                        this_1.cacheTodo(blobId, todo);
                                        console.log('Successfully retrieved todo data from public aggregator');
                                        return [2 /*return*/, { value: todo }];
                                    case 7:
                                        error_9 = _b.sent();
                                        failures.push("Aggregator attempt ".concat(attempt, " error: ").concat(error_9 instanceof Error ? error_9.message : String(error_9)));
                                        if (!(attempt < maxRetries)) return [3 /*break*/, 9];
                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000 * attempt); })];
                                    case 8:
                                        _b.sent();
                                        return [2 /*return*/, "continue"];
                                    case 9: return [3 /*break*/, 10];
                                    case 10: return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        attempt = 1;
                        _a.label = 7;
                    case 7:
                        if (!(attempt <= maxRetries)) return [3 /*break*/, 10];
                        return [5 /*yield**/, _loop_1(attempt)];
                    case 8:
                        state_1 = _a.sent();
                        if (typeof state_1 === "object")
                            return [2 /*return*/, state_1.value];
                        if (state_1 === "break")
                            return [3 /*break*/, 10];
                        _a.label = 9;
                    case 9:
                        attempt++;
                        return [3 /*break*/, 7];
                    case 10: throw new error_1.CLIError("Failed to retrieve todo after all attempts. Failures:\n".concat(failures.join('\n')), 'WALRUS_RETRIEVE_FAILED');
                    case 11:
                        error_8 = _a.sent();
                        if (error_8 instanceof error_1.CLIError) {
                            throw error_8;
                        }
                        throw new error_1.CLIError("Failed to retrieve todo: ".concat(error_8 instanceof Error ? error_8.message : String(error_8)), 'WALRUS_RETRIEVE_FAILED');
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    WalrusStorage.prototype.cacheTodo = function (blobId, todo) {
        WalrusStorage.todoCache.set(blobId, {
            data: todo,
            expires: Date.now() + WalrusStorage.CACHE_TTL
        });
        // Clean expired entries
        for (var _i = 0, _a = WalrusStorage.todoCache.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            if (value.expires <= Date.now()) {
                WalrusStorage.todoCache.delete(key);
            }
        }
    };
    /**
     * Parse and validate todo data from raw bytes.
     * @throws {CLIError} if data is invalid
     */
    WalrusStorage.prototype.parseTodoData = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var todoData, todo;
            return __generator(this, function (_a) {
                try {
                    todoData = new TextDecoder().decode(data);
                    todo = JSON.parse(todoData);
                    // Validate parsed data
                    this.validateTodoData(todo);
                    // Additional validation specific to retrieved todos
                    if (!todo.walrusBlobId) {
                        throw new Error('Missing walrusBlobId field');
                    }
                    return [2 /*return*/, todo];
                }
                catch (error) {
                    if (error instanceof Error && error.message.includes('Invalid todo:')) {
                        throw new error_1.CLIError("Retrieved todo data is invalid: ".concat(error.message), 'WALRUS_INVALID_TODO_DATA');
                    }
                    throw new error_1.CLIError("Failed to parse todo data: ".concat(error instanceof Error ? error.message : String(error)), 'WALRUS_PARSE_FAILED');
                }
                return [2 /*return*/];
            });
        });
    };
    WalrusStorage.prototype.updateTodo = function (todo, blobId) {
        return __awaiter(this, void 0, void 0, function () {
            var newBlobId, error_10;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        if (this.useMockMode) {
                            console.log('Using mock mode for updating todo');
                            return [2 /*return*/, "mock-updated-blob-".concat(todo.id)];
                        }
                        console.log("Updating todo \"".concat(todo.title, "\" on Walrus..."));
                        console.log('Note: Walrus blobs are immutable, so a new blob will be created');
                        return [4 /*yield*/, this.storeTodo(todo)];
                    case 1:
                        newBlobId = _a.sent();
                        console.log("Todo updated with new blob ID: ".concat(newBlobId));
                        console.log("Previous blob ID ".concat(blobId, " will remain but can be ignored"));
                        return [2 /*return*/, newBlobId];
                    case 2:
                        error_10 = _a.sent();
                        throw new error_1.CLIError("Failed to update todo: ".concat(error_10 instanceof Error ? error_10.message : String(error_10)), 'WALRUS_UPDATE_FAILED');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    WalrusStorage.prototype.storeTodoList = function (todoList) {
        return __awaiter(this, void 0, void 0, function () {
            var buffer_2, checksum_2, sizeBytes_2, signer_2, blobObject, uploadedContent, uploadedChecksum, error_11;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        if (this.useMockMode) {
                            console.log('Using mock mode for storing todo list');
                            return [2 /*return*/, "mock-blob-list-".concat(todoList.id)];
                        }
                        if (this.connectionState !== 'connected' || !this.walrusClient) {
                            throw new Error('WalrusStorage not connected. Call connect() first.');
                        }
                        // Validate todo list data
                        this.validateTodoListData(todoList);
                        return [4 /*yield*/, this.ensureStorageAllocated()];
                    case 1:
                        _a.sent();
                        console.log("Serializing todo list \"".concat(todoList.name, "\" for storage..."));
                        buffer_2 = todo_serializer_1.TodoSerializer.todoListToBuffer(todoList);
                        checksum_2 = this.calculateChecksum(buffer_2);
                        sizeBytes_2 = buffer_2.length;
                        return [4 /*yield*/, this.getTransactionSigner()];
                    case 2:
                        signer_2 = _a.sent();
                        return [4 /*yield*/, this.executeWithRetry(function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    return [2 /*return*/, this.walrusClient.writeBlob({
                                            blob: new Uint8Array(buffer_2),
                                            deletable: false,
                                            epochs: 52,
                                            signer: signer_2,
                                            attributes: {
                                                contentType: 'application/json',
                                                filename: "todolist-".concat(todoList.id, ".json"),
                                                type: 'todolist-data',
                                                name: todoList.name,
                                                checksum: checksum_2,
                                                size: sizeBytes_2.toString(),
                                                version: '1',
                                                todoCount: todoList.todos.length.toString()
                                            }
                                        })];
                                });
                            }); }, 'todo list storage', 5)];
                    case 3:
                        blobObject = (_a.sent()).blobObject;
                        return [4 /*yield*/, this.walrusClient.readBlob({ blobId: blobObject.blob_id })];
                    case 4:
                        uploadedContent = _a.sent();
                        if (!uploadedContent) {
                            throw new Error('Failed to verify uploaded content');
                        }
                        uploadedChecksum = this.calculateChecksum(Buffer.from(uploadedContent));
                        if (uploadedChecksum !== checksum_2) {
                            throw new Error('Content integrity check failed after upload');
                        }
                        console.log("Todo list successfully stored with blob ID: ".concat(blobObject.blob_id));
                        return [2 /*return*/, blobObject.blob_id];
                    case 5:
                        error_11 = _a.sent();
                        throw new error_1.CLIError("Failed to store todo list: ".concat(error_11 instanceof Error ? error_11.message : String(error_11)), 'WALRUS_STORE_FAILED');
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    WalrusStorage.prototype.retrieveTodoList = function (blobId) {
        return __awaiter(this, void 0, void 0, function () {
            var blobContent, todoListData_1, response, todoListData, _a, _b, error_12, error_13;
            var _this = this;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 7, , 8]);
                        if (this.useMockMode) {
                            console.log('Using mock mode for retrieving todo list');
                            return [2 /*return*/, {
                                    id: 'mock-list-id',
                                    name: 'Mock List',
                                    owner: 'mock-owner',
                                    todos: [],
                                    version: 1,
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString(),
                                    walrusBlobId: blobId
                                }];
                        }
                        if (this.connectionState !== 'connected' || !this.walrusClient) {
                            throw new Error('WalrusStorage not connected. Call connect() first.');
                        }
                        console.log("Retrieving todo list from Walrus with blob ID: ".concat(blobId, "..."));
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 5, , 6]);
                        return [4 /*yield*/, this.executeWithRetry(function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, this.walrusClient.readBlob({ blobId: blobId })];
                            }); }); }, 'todo list retrieval')];
                    case 2:
                        blobContent = _c.sent();
                        if (blobContent) {
                            console.log('Successfully retrieved todo list data');
                            todoListData_1 = new TextDecoder().decode(blobContent);
                            return [2 /*return*/, JSON.parse(todoListData_1)];
                        }
                        // Fallback to public aggregator
                        console.log('Attempting to retrieve from public aggregator...');
                        return [4 /*yield*/, fetch("https://aggregator.walrus-testnet.walrus.space/v1/blobs/".concat(blobId), {
                                method: 'GET'
                            })];
                    case 3:
                        response = _c.sent();
                        if (!response.ok) {
                            throw new Error("Failed to retrieve blob from aggregator: ".concat(response.statusText));
                        }
                        console.log('Successfully retrieved todo list data from public aggregator');
                        _b = (_a = new TextDecoder()).decode;
                        return [4 /*yield*/, response.arrayBuffer()];
                    case 4:
                        todoListData = _b.apply(_a, [_c.sent()]);
                        return [2 /*return*/, JSON.parse(todoListData)];
                    case 5:
                        error_12 = _c.sent();
                        throw new Error("Failed to retrieve todo list data: ".concat(error_12 instanceof Error ? error_12.message : String(error_12)));
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        error_13 = _c.sent();
                        throw new error_1.CLIError("Failed to retrieve todo list: ".concat(error_13 instanceof Error ? error_13.message : String(error_13)), 'WALRUS_RETRIEVE_FAILED');
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    WalrusStorage.prototype.ensureStorageAllocated = function () {
        return __awaiter(this, arguments, void 0, function (sizeBytes) {
            var address_1, epochs_1, _a, storageCost, writeCost, totalCost, epoch, currentEpoch, signer_3, storage, error_14, formattedError;
            var _this = this;
            if (sizeBytes === void 0) { sizeBytes = 1073741824; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.useMockMode) {
                            return [2 /*return*/, null];
                        }
                        if (this.connectionState !== 'connected' || !this.walrusClient) {
                            throw new Error('WalrusStorage not connected. Call connect() first.');
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 6, , 7]);
                        console.log('Checking Walrus storage allocation...');
                        address_1 = this.getActiveAddress();
                        console.log("Using address ".concat(address_1, " for storage operations"));
                        epochs_1 = 52;
                        return [4 /*yield*/, this.walrusClient.storageCost(sizeBytes, epochs_1)];
                    case 2:
                        _a = _b.sent(), storageCost = _a.storageCost, writeCost = _a.writeCost, totalCost = _a.totalCost;
                        console.log("Storage cost for ".concat(sizeBytes, " bytes for ").concat(epochs_1, " epochs:"));
                        console.log("  Storage cost: ".concat(storageCost, " WAL"));
                        console.log("  Write cost: ".concat(writeCost, " WAL"));
                        console.log("  Total cost: ".concat(totalCost, " WAL"));
                        return [4 /*yield*/, this.suiClient.getLatestSuiSystemState()];
                    case 3:
                        epoch = (_b.sent()).epoch;
                        currentEpoch = Number(epoch);
                        console.log("Current epoch: ".concat(currentEpoch));
                        return [4 /*yield*/, this.getTransactionSigner()];
                    case 4:
                        signer_3 = _b.sent();
                        return [4 /*yield*/, this.executeWithRetry(function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    return [2 /*return*/, this.walrusClient.executeCreateStorageTransaction({
                                            size: sizeBytes,
                                            epochs: epochs_1,
                                            owner: address_1,
                                            signer: signer_3
                                        })];
                                });
                            }); }, 'storage creation')];
                    case 5:
                        storage = (_b.sent()).storage;
                        console.log('Storage allocated successfully:');
                        console.log("  Storage ID: ".concat(storage.id.id));
                        console.log("  Start epoch: ".concat(storage.start_epoch));
                        console.log("  End epoch: ".concat(storage.end_epoch));
                        console.log("  Storage size: ".concat(storage.storage_size));
                        return [2 /*return*/, {
                                id: storage.id,
                                storage_size: storage.storage_size,
                                used_size: 0,
                                end_epoch: storage.end_epoch,
                                start_epoch: storage.start_epoch
                            }];
                    case 6:
                        error_14 = _b.sent();
                        formattedError = this.handleWalrusError(error_14, 'storage allocation');
                        console.warn('Storage allocation failed:', formattedError.message);
                        return [2 /*return*/, null];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    WalrusStorage.prototype.checkExistingStorage = function () {
        return __awaiter(this, void 0, void 0, function () {
            var address, response, existingStorage, epoch, currentEpoch_1, suitableStorage, error_15;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        if (this.useMockMode) {
                            return [2 /*return*/, null];
                        }
                        address = this.getActiveAddress();
                        console.log("Checking existing storage for address ".concat(address, "..."));
                        return [4 /*yield*/, this.suiClient.getOwnedObjects({
                                owner: address,
                                filter: {
                                    StructType: "0x2::storage::Storage"
                                },
                                options: {
                                    showContent: true
                                }
                            })];
                    case 1:
                        response = _a.sent();
                        existingStorage = response.data
                            .filter(function (item) { var _a, _b; return ((_b = (_a = item.data) === null || _a === void 0 ? void 0 : _a.content) === null || _b === void 0 ? void 0 : _b.dataType) === 'moveObject'; })
                            .map(function (item) {
                            var _a, _b, _c, _d, _e;
                            var content = (_a = item.data) === null || _a === void 0 ? void 0 : _a.content;
                            return {
                                id: { id: ((_b = item.data) === null || _b === void 0 ? void 0 : _b.objectId) || '' },
                                storage_size: Number(((_c = content === null || content === void 0 ? void 0 : content.fields) === null || _c === void 0 ? void 0 : _c.storage_size) || 0),
                                used_size: Number(((_d = content === null || content === void 0 ? void 0 : content.fields) === null || _d === void 0 ? void 0 : _d.used_size) || 0),
                                end_epoch: Number(((_e = content === null || content === void 0 ? void 0 : content.fields) === null || _e === void 0 ? void 0 : _e.end_epoch) || 0),
                                start_epoch: 0
                            };
                        });
                        if (!(existingStorage.length > 0)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.suiClient.getLatestSuiSystemState()];
                    case 2:
                        epoch = (_a.sent()).epoch;
                        currentEpoch_1 = Number(epoch);
                        suitableStorage = existingStorage.find(function (storage) {
                            var remainingSize = Number(storage.storage_size) - (storage.used_size || 0);
                            var remainingEpochs = storage.end_epoch - currentEpoch_1;
                            return remainingSize >= 1000000 && remainingEpochs >= 10;
                        });
                        if (suitableStorage) {
                            console.log("Found suitable existing storage: ".concat(suitableStorage.id.id));
                            return [2 /*return*/, suitableStorage];
                        }
                        _a.label = 3;
                    case 3:
                        console.log('No suitable existing storage found');
                        return [2 /*return*/, null];
                    case 4:
                        error_15 = _a.sent();
                        console.warn('Error checking existing storage:', error_15);
                        return [2 /*return*/, null];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    WalrusStorage.prototype.handleWalrusError = function (error, operation) {
        if (error instanceof Error) {
            if (error.message.includes('insufficient')) {
                return new error_1.CLIError("Insufficient WAL tokens for ".concat(operation, ". Please acquire WAL tokens and try again."), 'WALRUS_INSUFFICIENT_TOKENS');
            }
            else if (error.message.includes('Storage object not found')) {
                return new error_1.CLIError("Storage allocation failed. The transaction was submitted but the storage object was not found. This may be due to network issues or insufficient gas.", 'WALRUS_STORAGE_NOT_FOUND');
            }
            else if (error.message.includes('gas budget')) {
                return new error_1.CLIError("Insufficient gas budget for ".concat(operation, ". Please increase the gas budget and try again."), 'WALRUS_INSUFFICIENT_GAS');
            }
        }
        return new error_1.CLIError("Failed during ".concat(operation, ": ").concat(error instanceof Error ? error.message : String(error)), 'WALRUS_OPERATION_FAILED');
    };
    // In-memory cache with entries that expire after 5 minutes
    WalrusStorage.todoCache = new Map();
    WalrusStorage.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    return WalrusStorage;
}());
exports.WalrusStorage = WalrusStorage;
function createWalrusStorage(useMockMode) {
    if (useMockMode === void 0) { useMockMode = false; }
    return new WalrusStorage(useMockMode);
}
