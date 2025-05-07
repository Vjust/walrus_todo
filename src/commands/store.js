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
var todoService_1 = require("../services/todoService");
var walrus_storage_1 = require("../utils/walrus-storage");
var walrus_image_storage_1 = require("../utils/walrus-image-storage");
var sui_nft_storage_1 = require("../utils/sui-nft-storage");
var error_1 = require("../types/error");
var constants_1 = require("../constants");
var config_service_1 = require("../services/config-service");
var chalk_1 = require("chalk");
var fs = require("fs");
var path = require("path");
var StoreCommand = /** @class */ (function (_super) {
    __extends(StoreCommand, _super);
    function StoreCommand() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.todoService = new todoService_1.TodoService();
        _this.walrusStorage = (0, walrus_storage_1.createWalrusStorage)(false);
        _this.spinner = null;
        return _this;
    }
    StoreCommand.prototype.startSpinner = function (text) {
        if (this.spinner) {
            this.spinner.text = text;
        }
        else {
            this.log(chalk_1.default.blue(text));
        }
    };
    StoreCommand.prototype.stopSpinner = function (success, text) {
        if (success === void 0) { success = true; }
        if (text) {
            this.log(success ? chalk_1.default.green("\u2713 ".concat(text)) : chalk_1.default.red("\u2717 ".concat(text)));
        }
    };
    StoreCommand.prototype.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var flags, config, network, mockMode, todo, networkUrl, suiClient, isConnected, blobId, originalBlobId, uploadedTodo, walrusError_1, errorMessage, rollbackError_1, walrusImageStorage, imageUrl, originalImageUrl, imagePath, stats, ext, response, verifyError_1, error_2, rollbackError_2, errorMessage, signer, suiNftStorage, networkStatus, txDigest, existingNftId, existingNft, updateNeeded, nftError_1, errorMessage, txResponse, nftObjectId, createdObjects, txError_1, cleanupError_1, error_3;
            var _this = this;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 61, , 62]);
                        return [4 /*yield*/, this.parse(StoreCommand)];
                    case 1:
                        flags = (_e.sent()).flags;
                        this.startSpinner('Loading configuration...');
                        return [4 /*yield*/, config_service_1.configService.getConfig()];
                    case 2:
                        config = _e.sent();
                        network = flags.network || config.network || 'testnet';
                        mockMode = flags.mock || false;
                        this.walrusStorage = (0, walrus_storage_1.createWalrusStorage)(mockMode);
                        // Validate network configuration
                        if (!constants_1.NETWORK_URLS[network]) {
                            throw new error_1.CLIError("Invalid network: ".concat(network, ". Available networks: ").concat(Object.keys(constants_1.NETWORK_URLS).join(', ')), 'INVALID_NETWORK');
                        }
                        // Validate deployment information
                        if (!((_a = config.lastDeployment) === null || _a === void 0 ? void 0 : _a.packageId)) {
                            throw new error_1.CLIError("Contract not deployed on network \"".concat(network, "\". Please run \"waltodo deploy --network ").concat(network, "\" first."), 'NOT_DEPLOYED');
                        }
                        this.stopSpinner(true, 'Configuration validated');
                        return [4 /*yield*/, this.todoService.getTodoByTitleOrId(flags.todo, flags.list)];
                    case 3:
                        todo = _e.sent();
                        if (!todo) {
                            throw new error_1.CLIError("Todo \"".concat(flags.todo, "\" not found in list \"").concat(flags.list, "\""), 'TODO_NOT_FOUND');
                        }
                        networkUrl = constants_1.NETWORK_URLS[network];
                        if (!networkUrl) {
                            throw new error_1.CLIError("Invalid network: ".concat(network), 'INVALID_NETWORK');
                        }
                        suiClient = {
                            url: networkUrl,
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
                        // Initialize and validate Walrus storage connection
                        this.startSpinner('Connecting to Walrus storage...');
                        return [4 /*yield*/, this.walrusStorage.connect()];
                    case 4:
                        _e.sent();
                        return [4 /*yield*/, this.walrusStorage.isConnected()];
                    case 5:
                        isConnected = _e.sent();
                        if (!isConnected) {
                            throw new error_1.CLIError('Failed to establish connection with Walrus storage', 'WALRUS_CONNECTION_FAILED');
                        }
                        this.stopSpinner(true, 'Connected to Walrus storage');
                        // Store todo on Walrus with enhanced error handling and rollback
                        this.startSpinner("Storing todo \"".concat(todo.title, "\" on Walrus..."));
                        blobId = void 0;
                        originalBlobId = todo.walrusBlobId;
                        _e.label = 6;
                    case 6:
                        _e.trys.push([6, 11, , 16]);
                        // Pre-upload validation
                        this.startSpinner('Validating todo data...');
                        if (!todo.title || typeof todo.title !== 'string') {
                            throw new error_1.CLIError('Invalid todo: missing or invalid title', 'VALIDATION_ERROR');
                        }
                        this.stopSpinner(true, 'Todo data validated');
                        // Storage verification
                        this.startSpinner('Verifying storage capacity...');
                        return [4 /*yield*/, this.walrusStorage.ensureStorageAllocated()];
                    case 7:
                        _e.sent();
                        this.stopSpinner(true, 'Storage capacity verified');
                        // Attempt upload with enhanced monitoring
                        this.startSpinner('Uploading to Walrus storage...');
                        return [4 /*yield*/, this.walrusStorage.storeTodo(todo)];
                    case 8:
                        blobId = _e.sent();
                        // Verify upload success
                        this.startSpinner('Verifying upload...');
                        return [4 /*yield*/, this.walrusStorage.retrieveTodo(blobId)];
                    case 9:
                        uploadedTodo = _e.sent();
                        if (!uploadedTodo || uploadedTodo.id !== todo.id) {
                            throw new error_1.CLIError('Upload verification failed: content mismatch', 'VERIFICATION_ERROR');
                        }
                        this.stopSpinner(true, 'Todo data stored and verified on Walrus');
                        this.log(chalk_1.default.dim("Blob ID: " + blobId));
                        // Update local state only after successful verification
                        return [4 /*yield*/, this.todoService.updateTodo(flags.list, todo.id, {
                                walrusBlobId: blobId,
                                updatedAt: new Date().toISOString()
                            })];
                    case 10:
                        // Update local state only after successful verification
                        _e.sent();
                        return [3 /*break*/, 16];
                    case 11:
                        walrusError_1 = _e.sent();
                        this.stopSpinner(false);
                        errorMessage = walrusError_1 instanceof Error ? walrusError_1.message : String(walrusError_1);
                        if (!(blobId && blobId !== originalBlobId)) return [3 /*break*/, 15];
                        this.startSpinner('Upload failed. Rolling back to previous state...');
                        _e.label = 12;
                    case 12:
                        _e.trys.push([12, 14, , 15]);
                        return [4 /*yield*/, this.todoService.updateTodo(flags.list, todo.id, {
                                walrusBlobId: originalBlobId,
                                updatedAt: new Date().toISOString()
                            })];
                    case 13:
                        _e.sent();
                        this.stopSpinner(true, 'Rollback successful');
                        return [3 /*break*/, 15];
                    case 14:
                        rollbackError_1 = _e.sent();
                        this.stopSpinner(false, 'Rollback failed');
                        console.error(chalk_1.default.red('Warning: Local state may be inconsistent'));
                        return [3 /*break*/, 15];
                    case 15:
                        // Categorized error handling with detailed messages
                        if (errorMessage.includes('timeout') || errorMessage.includes('connection')) {
                            throw new error_1.CLIError('Network error while storing todo. Please check your connection and try again.\n' +
                                "Details: ".concat(errorMessage), 'NETWORK_ERROR');
                        }
                        else if (errorMessage.includes('storage') || errorMessage.includes('capacity')) {
                            throw new error_1.CLIError('Storage allocation failed. Please ensure you have sufficient WAL tokens.\n' +
                                "Details: ".concat(errorMessage), 'STORAGE_ERROR');
                        }
                        else if (errorMessage.includes('validation')) {
                            throw new error_1.CLIError('Todo data validation failed. Please check the data format.\n' +
                                "Details: ".concat(errorMessage), 'VALIDATION_ERROR');
                        }
                        else if (errorMessage.includes('verification')) {
                            throw new error_1.CLIError('Upload verification failed. The todo may not have been stored correctly.\n' +
                                "Details: ".concat(errorMessage), 'VERIFICATION_ERROR');
                        }
                        else {
                            throw new error_1.CLIError('Failed to store todo. Please try again.\n' +
                                "Details: ".concat(errorMessage), 'WALRUS_STORAGE_FAILED');
                        }
                        return [3 /*break*/, 16];
                    case 16:
                        // Initialize and validate image storage connection
                        this.startSpinner('Initializing image storage...');
                        walrusImageStorage = new walrus_image_storage_1.WalrusImageStorage(suiClient, mockMode);
                        return [4 /*yield*/, walrusImageStorage.connect()];
                    case 17:
                        _e.sent();
                        // Connection is validated through the connect() call - it will throw if connection fails
                        this.stopSpinner(true, 'Image storage initialized');
                        imageUrl = todo.imageUrl || '';
                        originalImageUrl = todo.imageUrl;
                        _e.label = 18;
                    case 18:
                        _e.trys.push([18, 28, , 33]);
                        this.startSpinner('Preparing image upload...');
                        if (!flags.image) return [3 /*break*/, 20];
                        imagePath = path.resolve(process.cwd(), flags.image);
                        if (!fs.existsSync(imagePath)) {
                            throw new error_1.CLIError("Image file not found: ".concat(flags.image), 'FILE_NOT_FOUND');
                        }
                        stats = fs.statSync(imagePath);
                        if (stats.size > 10 * 1024 * 1024) { // 10MB limit
                            throw new error_1.CLIError('Image file size exceeds 10MB limit', 'FILE_SIZE_ERROR');
                        }
                        ext = path.extname(imagePath).toLowerCase();
                        if (!['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
                            throw new error_1.CLIError('Invalid image format. Supported formats: JPG, PNG, GIF', 'FILE_FORMAT_ERROR');
                        }
                        // Upload custom image with verification
                        this.startSpinner('Uploading custom image to Walrus...');
                        return [4 /*yield*/, walrusImageStorage.uploadTodoImage(imagePath, todo.title, todo.completed || false)];
                    case 19:
                        imageUrl = _e.sent();
                        return [3 /*break*/, 22];
                    case 20:
                        // Use default image with verification
                        this.startSpinner('Uploading default image to Walrus...');
                        return [4 /*yield*/, walrusImageStorage.uploadDefaultImage()];
                    case 21:
                        imageUrl = _e.sent();
                        _e.label = 22;
                    case 22:
                        // Verify image URL is accessible
                        this.startSpinner('Verifying image accessibility...');
                        _e.label = 23;
                    case 23:
                        _e.trys.push([23, 25, , 26]);
                        return [4 /*yield*/, fetch(imageUrl)];
                    case 24:
                        response = _e.sent();
                        if (!response.ok) {
                            throw new Error("Image verification failed: ".concat(response.statusText));
                        }
                        return [3 /*break*/, 26];
                    case 25:
                        verifyError_1 = _e.sent();
                        throw new error_1.CLIError("Image accessibility check failed: ".concat(verifyError_1 instanceof Error ? verifyError_1.message : String(verifyError_1)), 'IMAGE_VERIFICATION_ERROR');
                    case 26:
                        this.stopSpinner(true, "Image uploaded and verified: ".concat(imageUrl));
                        return [4 /*yield*/, this.todoService.updateTodo(flags.list, todo.id, {
                                imageUrl: imageUrl,
                                updatedAt: new Date().toISOString()
                            })];
                    case 27:
                        _e.sent();
                        return [3 /*break*/, 33];
                    case 28:
                        error_2 = _e.sent();
                        this.stopSpinner(false);
                        if (!(imageUrl && imageUrl !== originalImageUrl)) return [3 /*break*/, 32];
                        this.startSpinner('Image upload failed. Rolling back to previous state...');
                        _e.label = 29;
                    case 29:
                        _e.trys.push([29, 31, , 32]);
                        return [4 /*yield*/, this.todoService.updateTodo(flags.list, todo.id, {
                                imageUrl: originalImageUrl,
                                updatedAt: new Date().toISOString()
                            })];
                    case 30:
                        _e.sent();
                        this.stopSpinner(true, 'Image rollback successful');
                        return [3 /*break*/, 32];
                    case 31:
                        rollbackError_2 = _e.sent();
                        this.stopSpinner(false, 'Image rollback failed');
                        console.error(chalk_1.default.red('Warning: Local image state may be inconsistent'));
                        return [3 /*break*/, 32];
                    case 32:
                        if (error_2 instanceof error_1.CLIError) {
                            throw error_2;
                        }
                        errorMessage = error_2 instanceof Error ? error_2.message : String(error_2);
                        if (errorMessage.includes('size')) {
                            throw new error_1.CLIError('Image file size exceeds limit: Maximum size is 10MB', 'FILE_SIZE_ERROR');
                        }
                        else if (errorMessage.includes('format')) {
                            throw new error_1.CLIError('Invalid image format. Supported formats: JPG, PNG, GIF', 'FILE_FORMAT_ERROR');
                        }
                        else if (errorMessage.includes('verification')) {
                            throw new error_1.CLIError('Image upload verification failed. Please try again', 'IMAGE_VERIFICATION_ERROR');
                        }
                        else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
                            throw new error_1.CLIError('Network error during image upload. Please check your connection', 'NETWORK_ERROR');
                        }
                        else {
                            throw new error_1.CLIError("Failed to upload image to Walrus: ".concat(errorMessage), 'IMAGE_UPLOAD_FAILED');
                        }
                        return [3 /*break*/, 33];
                    case 33:
                        // Initialize Sui NFT storage with mock mode
                        // Initialize NFT storage with validation
                        this.startSpinner('Initializing NFT storage...');
                        signer = {};
                        suiNftStorage = new sui_nft_storage_1.SuiNftStorage(suiClient, signer, { address: config.lastDeployment.packageId, packageId: config.lastDeployment.packageId, collectionId: '' });
                        if (!!mockMode) return [3 /*break*/, 35];
                        return [4 /*yield*/, suiClient.getLatestCheckpointSequenceNumber().catch(function () { return null; })];
                    case 34:
                        networkStatus = _e.sent();
                        if (!networkStatus) {
                            throw new error_1.CLIError("Unable to connect to Sui network: ".concat(network), 'NETWORK_ERROR');
                        }
                        _e.label = 35;
                    case 35:
                        this.stopSpinner(true, 'NFT storage initialized');
                        txDigest = void 0;
                        existingNftId = todo.nftObjectId;
                        _e.label = 36;
                    case 36:
                        _e.trys.push([36, 47, , 48]);
                        if (!existingNftId) return [3 /*break*/, 44];
                        this.startSpinner('Found existing NFT, checking for updates...');
                        return [4 /*yield*/, suiNftStorage.getTodoNft(existingNftId)];
                    case 37:
                        existingNft = _e.sent();
                        updateNeeded = false;
                        if (!(existingNft.title !== todo.title)) return [3 /*break*/, 39];
                        this.startSpinner('Updating NFT title...');
                        return [4 /*yield*/, suiNftStorage.createTodoNft(todo, todo.walrusBlobId)];
                    case 38:
                        _e.sent();
                        updateNeeded = true;
                        _e.label = 39;
                    case 39:
                        if (!(existingNft.description !== (todo.description || ''))) return [3 /*break*/, 41];
                        this.startSpinner('Updating NFT description...');
                        return [4 /*yield*/, suiNftStorage.createTodoNft(todo, todo.walrusBlobId)];
                    case 40:
                        _e.sent();
                        updateNeeded = true;
                        _e.label = 41;
                    case 41:
                        if (!(existingNft.walrusBlobId !== blobId)) return [3 /*break*/, 43];
                        this.startSpinner('Updating NFT image...');
                        return [4 /*yield*/, suiNftStorage.createTodoNft(todo, blobId)];
                    case 42:
                        txDigest = _e.sent();
                        updateNeeded = true;
                        _e.label = 43;
                    case 43:
                        if (updateNeeded) {
                            this.stopSpinner(true, 'NFT updated successfully');
                        }
                        else {
                            this.stopSpinner(true, 'NFT is already up to date');
                        }
                        return [3 /*break*/, 46];
                    case 44:
                        // Create new NFT if none exists
                        this.startSpinner('Creating new NFT on Sui blockchain...');
                        return [4 /*yield*/, suiNftStorage.createTodoNft(todo, blobId)];
                    case 45:
                        txDigest = _e.sent();
                        _e.label = 46;
                    case 46:
                        this.stopSpinner(true, 'NFT creation transaction submitted');
                        return [3 /*break*/, 48];
                    case 47:
                        nftError_1 = _e.sent();
                        this.stopSpinner(false);
                        errorMessage = nftError_1 instanceof Error ? nftError_1.message : String(nftError_1);
                        if (errorMessage.includes('gas')) {
                            throw new error_1.CLIError('Insufficient gas for NFT creation. Please add funds to your wallet.', 'INSUFFICIENT_GAS');
                        }
                        else if (errorMessage.includes('network')) {
                            throw new error_1.CLIError("Network error during NFT creation: ".concat(errorMessage), 'NETWORK_ERROR');
                        }
                        else {
                            throw new error_1.CLIError("Failed to create NFT: ".concat(errorMessage), 'NFT_CREATION_FAILED');
                        }
                        return [3 /*break*/, 48];
                    case 48:
                        txResponse = void 0;
                        nftObjectId = void 0;
                        _e.label = 49;
                    case 49:
                        _e.trys.push([49, 54, 55, 60]);
                        if (!flags.mock) return [3 /*break*/, 50];
                        // In mock mode, generate a mock NFT object ID
                        nftObjectId = "0xmock-nft-".concat(Date.now());
                        return [3 /*break*/, 52];
                    case 50:
                        if (!txDigest) return [3 /*break*/, 52];
                        return [4 /*yield*/, suiClient.getTransactionBlock({
                                digest: txDigest,
                            })];
                    case 51:
                        // In real mode, get the object ID from transaction
                        txResponse = _e.sent();
                        if (((_b = txResponse.effects) === null || _b === void 0 ? void 0 : _b.status.status) !== 'success') {
                            throw new error_1.CLIError("Transaction failed with status: ".concat(((_c = txResponse.effects) === null || _c === void 0 ? void 0 : _c.status.status) || 'unknown'), 'TX_FAILED');
                        }
                        createdObjects = txResponse.effects.created;
                        if (!createdObjects || createdObjects.length === 0) {
                            throw new error_1.CLIError('No objects created in transaction', 'TX_PARSE_ERROR');
                        }
                        nftObjectId = createdObjects[0].reference.objectId;
                        _e.label = 52;
                    case 52: 
                    // Update local todo with NFT Object ID
                    return [4 /*yield*/, this.todoService.updateTodo(flags.list, todo.id, {
                            nftObjectId: nftObjectId,
                            walrusBlobId: blobId,
                            imageUrl: imageUrl
                        })];
                    case 53:
                        // Update local todo with NFT Object ID
                        _e.sent();
                        // Display success messages and retrieval instructions
                        this.log('\n' + chalk_1.default.green.bold('✨ Todo successfully stored! ✨'));
                        this.log('\n' + chalk_1.default.blue.bold('Storage Summary:'));
                        this.log(chalk_1.default.dim('----------------------------------------'));
                        this.log(chalk_1.default.green('✓ Stored locally in list:'), chalk_1.default.cyan(flags.list));
                        this.log(chalk_1.default.green('✓ Stored on Walrus with blob ID:'), chalk_1.default.dim(blobId));
                        this.log(chalk_1.default.green('✓ Created NFT with object ID:'), chalk_1.default.cyan(nftObjectId));
                        this.log('\n' + chalk_1.default.blue.bold('How to Retrieve:'));
                        this.log(chalk_1.default.dim('----------------------------------------'));
                        this.log(chalk_1.default.yellow('1. By todo title/ID (recommended):'));
                        this.log(chalk_1.default.dim("   ".concat(this.config.bin, " retrieve --todo \"").concat(todo.title, "\" --list ").concat(flags.list)));
                        this.log(chalk_1.default.yellow('2. By Walrus blob ID:'));
                        this.log(chalk_1.default.dim("   ".concat(this.config.bin, " retrieve --blob-id ").concat(blobId, " --list ").concat(flags.list)));
                        this.log(chalk_1.default.yellow('3. By NFT object ID:'));
                        this.log(chalk_1.default.dim("   ".concat(this.config.bin, " retrieve --object-id ").concat(nftObjectId, " --list ").concat(flags.list)));
                        if (!flags.mock) {
                            this.log('\n' + chalk_1.default.blue.bold('View on Sui Explorer:'));
                            this.log(chalk_1.default.dim('----------------------------------------'));
                            this.log(chalk_1.default.cyan("  https://explorer.sui.io/object/".concat(nftObjectId, "?network=").concat(network)));
                            this.log(chalk_1.default.cyan("  https://explorer.sui.io/txblock/".concat(txDigest, "?network=").concat(network)));
                        }
                        return [3 /*break*/, 60];
                    case 54:
                        txError_1 = _e.sent();
                        if (txError_1 instanceof error_1.CLIError) {
                            throw txError_1;
                        }
                        throw new error_1.CLIError("Failed to process transaction: ".concat(txError_1 instanceof Error ? txError_1.message : String(txError_1)), 'TX_PROCESSING_FAILED');
                    case 55:
                        // Enhanced cleanup with proper error handling
                        this.startSpinner('Cleaning up resources...');
                        _e.label = 56;
                    case 56:
                        _e.trys.push([56, 58, , 59]);
                        return [4 /*yield*/, Promise.all([
                                this.walrusStorage.disconnect(),
                                (_d = walrusImageStorage.disconnect) === null || _d === void 0 ? void 0 : _d.call(walrusImageStorage)
                            ])];
                    case 57:
                        _e.sent();
                        this.stopSpinner(true, 'Resources cleaned up');
                        return [3 /*break*/, 59];
                    case 58:
                        cleanupError_1 = _e.sent();
                        this.stopSpinner(false, 'Resource cleanup encountered issues');
                        console.warn("Warning: Some resources may not have been properly cleaned up: ".concat(cleanupError_1 instanceof Error ? cleanupError_1.message : String(cleanupError_1)));
                        return [3 /*break*/, 59];
                    case 59: return [7 /*endfinally*/];
                    case 60: return [3 /*break*/, 62];
                    case 61:
                        error_3 = _e.sent();
                        if (error_3 instanceof error_1.CLIError) {
                            throw error_3;
                        }
                        throw new error_1.CLIError("Failed to store todo: ".concat(error_3 instanceof Error ? error_3.message : String(error_3)), 'STORE_FAILED');
                    case 62: return [2 /*return*/];
                }
            });
        });
    };
    StoreCommand.description = 'Store todos on blockchain and Walrus (always creates an NFT)';
    StoreCommand.examples = [
        '<%= config.bin %> store --todo 123 --list my-todos',
        '<%= config.bin %> store --todo "Buy groceries" --list my-todos',
        '<%= config.bin %> store --todo 123 --list my-todos --image ./custom-image.png',
        '<%= config.bin %> store --todo 123 --list my-todos --mock'
    ];
    StoreCommand.flags = {
        mock: core_1.Flags.boolean({
            description: 'Use mock mode for testing',
            default: false
        }),
        todo: core_1.Flags.string({
            char: 't',
            description: 'ID or title of the todo to store',
            required: true,
        }),
        list: core_1.Flags.string({
            char: 'l',
            description: 'Todo list name',
            default: 'default'
        }),
        image: core_1.Flags.string({
            char: 'i',
            description: 'Path to a custom image for the NFT',
            required: false
        }),
        network: core_1.Flags.string({
            char: 'n',
            description: 'Network to use (defaults to configured network)',
            options: ['localnet', 'devnet', 'testnet', 'mainnet'],
        }),
    };
    return StoreCommand;
}(core_1.Command));
exports.default = StoreCommand;
