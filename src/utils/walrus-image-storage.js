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
exports.WalrusImageStorage = void 0;
exports.createWalrusImageStorage = createWalrusImageStorage;
var walrus_1 = require("@mysten/walrus");
var fs = require("fs");
var path = require("path");
var path_utils_1 = require("./path-utils");
var error_handler_1 = require("./error-handler");
var child_process_1 = require("child_process");
var sui_keystore_1 = require("./sui-keystore");
var crypto_1 = require("crypto");
var error_1 = require("../types/error");
var image_size_1 = require("image-size");
var MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
var SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
var WalrusImageStorage = /** @class */ (function () {
    function WalrusImageStorage(suiClient, useMockMode) {
        if (useMockMode === void 0) { useMockMode = false; }
        this.isInitialized = false;
        this.signer = null;
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 10000
        };
        this.suiClient = suiClient;
        this.useMockMode = useMockMode;
    }
    WalrusImageStorage.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var envInfo;
            return __generator(this, function (_a) {
                try {
                    if (this.useMockMode) {
                        console.log('Using mock mode for Walrus image storage');
                        this.isInitialized = true;
                        return [2 /*return*/];
                    }
                    envInfo = (0, child_process_1.execSync)('sui client active-env').toString().trim();
                    if (!envInfo.includes('testnet')) {
                        throw new error_1.CLIError('Must be connected to testnet environment. Use "sui client switch --env testnet"', 'INVALID_ENVIRONMENT');
                    }
                    // Initialize Walrus client with network config
                    this.walrusClient = new walrus_1.WalrusClient({
                        network: 'testnet',
                        suiClient: this.suiClient,
                        storageNodeClientOptions: {
                            timeout: 30000,
                            onError: function (error) { return (0, error_handler_1.handleError)('Walrus storage node error:', error); }
                        }
                    });
                    // Create a signer that uses the active CLI keystore
                    this.signer = new sui_keystore_1.KeystoreSigner(this.suiClient);
                    this.isInitialized = true;
                }
                catch (error) {
                    (0, error_handler_1.handleError)('Failed to initialize Walrus client', error);
                    throw error;
                }
                return [2 /*return*/];
            });
        });
    };
    WalrusImageStorage.prototype.disconnect = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (this.useMockMode) {
                    console.log('Mock mode: No cleanup needed');
                    return [2 /*return*/];
                }
                // Clear instance variables
                this.walrusClient = {};
                this.signer = null;
                this.isInitialized = false;
                return [2 /*return*/];
            });
        });
    };
    WalrusImageStorage.prototype.getTransactionSigner = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this.signer) {
                    throw new Error('WalrusImageStorage not initialized. Call connect() first.');
                }
                return [2 /*return*/, this.signer];
            });
        });
    };
    WalrusImageStorage.prototype.getActiveAddress = function () {
        if (!this.signer) {
            throw new Error('WalrusImageStorage not initialized. Call connect() first.');
        }
        return this.signer.toSuiAddress();
    };
    WalrusImageStorage.prototype.uploadDefaultImage = function () {
        return __awaiter(this, void 0, void 0, function () {
            var imagePath, imageBuffer, signer, blobObject, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.isInitialized) {
                            throw new Error('WalrusImageStorage not initialized. Call connect() first.');
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        if (this.useMockMode) {
                            console.log('Using mock mode for default image upload');
                            return [2 /*return*/, 'https://testnet.wal.app/blob/mock-default-image-blob-id'];
                        }
                        imagePath = (0, path_utils_1.getAssetPath)('todo_bottle.jpeg');
                        if (!fs.existsSync(imagePath)) {
                            throw new Error("Default image not found at ".concat(imagePath));
                        }
                        imageBuffer = fs.readFileSync(imagePath);
                        return [4 /*yield*/, this.getTransactionSigner()];
                    case 2:
                        signer = _a.sent();
                        return [4 /*yield*/, this.walrusClient.writeBlob({
                                blob: new Uint8Array(imageBuffer),
                                deletable: false,
                                epochs: 52, // Store for ~6 months
                                signer: signer,
                                attributes: {
                                    contentType: 'image/jpeg',
                                    filename: 'todo_bottle.jpeg',
                                    type: 'todo-nft-default-image'
                                }
                            })];
                    case 3:
                        blobObject = (_a.sent()).blobObject;
                        // Return the Walrus URL format
                        return [2 /*return*/, "https://testnet.wal.app/blob/".concat(blobObject.blob_id)];
                    case 4:
                        error_2 = _a.sent();
                        (0, error_handler_1.handleError)('Failed to upload default image to Walrus', error_2);
                        throw error_2;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    WalrusImageStorage.prototype.calculateChecksum = function (data) {
        return crypto_1.default.createHash('sha256').update(data).digest('hex');
    };
    WalrusImageStorage.prototype.detectMimeType = function (buffer) {
        try {
            if (buffer.length < 4) {
                throw new error_1.CLIError('File too small to determine type', 'WALRUS_INVALID_IMAGE');
            }
            var header = buffer.toString('hex', 0, 4).toLowerCase();
            if (header.startsWith('89504e47'))
                return 'image/png';
            if (header.startsWith('ffd8'))
                return 'image/jpeg';
            if (header.startsWith('47494638'))
                return 'image/gif';
            throw new error_1.CLIError("Unsupported image format. Only PNG, JPEG, and GIF are supported.", 'WALRUS_UNSUPPORTED_FORMAT');
        }
        catch (error) {
            if (error instanceof error_1.CLIError)
                throw error;
            throw new error_1.CLIError("Failed to detect image type: ".concat(error instanceof Error ? error.message : String(error)), 'WALRUS_MIME_DETECTION_FAILED');
        }
    };
    WalrusImageStorage.prototype.validateImage = function (buffer, mimeType) {
        try {
            // Validate size
            if (buffer.length > MAX_IMAGE_SIZE) {
                throw new error_1.CLIError("Image size (".concat(buffer.length, " bytes) exceeds maximum allowed size (").concat(MAX_IMAGE_SIZE, " bytes)"), 'WALRUS_IMAGE_TOO_LARGE');
            }
            // Validate mime type
            if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
                throw new error_1.CLIError("Unsupported image type: ".concat(mimeType, ". Supported types: ").concat(SUPPORTED_MIME_TYPES.join(', ')), 'WALRUS_UNSUPPORTED_FORMAT');
            }
            // Basic image corruption check
            try {
                if (buffer.length < 24) {
                    throw new error_1.CLIError('Invalid image file: too small to be valid', 'WALRUS_INVALID_IMAGE');
                }
                // Use image-size to validate basic format
                var dimensions = (0, image_size_1.default)(buffer);
                if (!dimensions.width || !dimensions.height) {
                    throw new error_1.CLIError('Invalid image dimensions', 'WALRUS_INVALID_IMAGE');
                }
                // Basic dimension validation
                if (dimensions.width > 10000 || dimensions.height > 10000) {
                    throw new error_1.CLIError('Image dimensions too large. Maximum allowed is 10000x10000 pixels.', 'WALRUS_INVALID_DIMENSIONS');
                }
            }
            catch (error) {
                if (error instanceof error_1.CLIError)
                    throw error;
                throw new error_1.CLIError("Invalid image file: ".concat(error instanceof Error ? error.message : String(error)), 'WALRUS_INVALID_IMAGE');
            }
        }
        catch (error) {
            if (error instanceof error_1.CLIError)
                throw error;
            throw new error_1.CLIError("Image validation failed: ".concat(error instanceof Error ? error.message : String(error)), 'WALRUS_VALIDATION_FAILED');
        }
    };
    WalrusImageStorage.prototype.uploadImageInternal = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var imageBuffer, mimeType, dimensions, metadata, baseAttributes, attributes, signer, maxRetries, lastError, _loop_1, this_1, attempt, state_1, error_3;
            var _this = this;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.isInitialized) {
                            throw new error_1.CLIError('WalrusImageStorage not initialized. Call connect() first.', 'WALRUS_NOT_INITIALIZED');
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 8, , 9]);
                        if (this.useMockMode) {
                            console.log('Using mock mode for image upload');
                            return [2 /*return*/, "https://testnet.wal.app/blob/mock-image-blob-id-".concat(Date.now())];
                        }
                        // Validate input
                        if (!((_a = options.imagePath) === null || _a === void 0 ? void 0 : _a.trim())) {
                            throw new error_1.CLIError('Image path is required', 'WALRUS_INVALID_INPUT');
                        }
                        if (!fs.existsSync(options.imagePath)) {
                            throw new error_1.CLIError("Image not found at ".concat(options.imagePath), 'WALRUS_FILE_NOT_FOUND');
                        }
                        imageBuffer = fs.readFileSync(options.imagePath);
                        mimeType = this.detectMimeType(imageBuffer);
                        this.validateImage(imageBuffer, mimeType);
                        // Ensure storage is allocated before upload
                        return [4 /*yield*/, this.ensureStorageAllocated(imageBuffer.length + 1000)];
                    case 2:
                        // Ensure storage is allocated before upload
                        _b.sent();
                        dimensions = (0, image_size_1.default)(imageBuffer);
                        metadata = {
                            width: dimensions.width || 0,
                            height: dimensions.height || 0,
                            mimeType: mimeType,
                            size: imageBuffer.length,
                            checksum: this.calculateChecksum(imageBuffer)
                        };
                        baseAttributes = {
                            contentType: metadata.mimeType,
                            filename: path.basename(options.imagePath),
                            type: options.type,
                            checksum: metadata.checksum,
                            checksum_algo: 'sha256',
                            size: metadata.size.toString(),
                            uploadedAt: new Date().toISOString(),
                            width: metadata.width.toString(),
                            height: metadata.height.toString(),
                            encoding: 'binary'
                        };
                        attributes = options.metadata
                            ? __assign(__assign({}, baseAttributes), options.metadata) : baseAttributes;
                        return [4 /*yield*/, this.getTransactionSigner()];
                    case 3:
                        signer = _b.sent();
                        maxRetries = this.retryConfig.maxRetries;
                        lastError = null;
                        _loop_1 = function (attempt) {
                            var result, verified_1, verifyTimeout, verifyAttempt, uploadedContent, uploadedBuffer, uploadedChecksum, uploadedSize, error_4, error_5;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        _c.trys.push([0, 11, , 13]);
                                        console.log("Upload attempt ".concat(attempt, "/").concat(maxRetries, "..."));
                                        return [4 /*yield*/, this_1.walrusClient.writeBlob({
                                                blob: new Uint8Array(imageBuffer),
                                                deletable: false,
                                                epochs: 52,
                                                signer: signer,
                                                attributes: attributes
                                            })];
                                    case 1:
                                        result = _c.sent();
                                        verified_1 = false;
                                        verifyTimeout = setTimeout(function () {
                                            if (!verified_1) {
                                                throw new error_1.CLIError('Upload verification timed out', 'WALRUS_VERIFICATION_TIMEOUT');
                                            }
                                        }, 10000);
                                        _c.label = 2;
                                    case 2:
                                        _c.trys.push([2, 9, , 10]);
                                        verifyAttempt = 1;
                                        _c.label = 3;
                                    case 3:
                                        if (!(verifyAttempt <= 3)) return [3 /*break*/, 8];
                                        return [4 /*yield*/, this_1.walrusClient.readBlob({
                                                blobId: result.blobObject.blob_id
                                            })];
                                    case 4:
                                        uploadedContent = _c.sent();
                                        if (!!uploadedContent) return [3 /*break*/, 6];
                                        if (verifyAttempt === 3) {
                                            throw new error_1.CLIError('Failed to verify uploaded content', 'WALRUS_VERIFICATION_FAILED');
                                        }
                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                                    case 5:
                                        _c.sent();
                                        return [3 /*break*/, 7];
                                    case 6:
                                        uploadedBuffer = Buffer.from(uploadedContent);
                                        uploadedChecksum = this_1.calculateChecksum(uploadedBuffer);
                                        uploadedSize = uploadedBuffer.length;
                                        if (uploadedSize !== metadata.size) {
                                            throw new error_1.CLIError("Size mismatch: expected ".concat(metadata.size, ", got ").concat(uploadedSize), 'WALRUS_VERIFICATION_FAILED');
                                        }
                                        if (uploadedChecksum !== metadata.checksum) {
                                            throw new error_1.CLIError('Content integrity check failed', 'WALRUS_VERIFICATION_FAILED');
                                        }
                                        verified_1 = true;
                                        clearTimeout(verifyTimeout);
                                        return [2 /*return*/, { value: "https://testnet.wal.app/blob/".concat(result.blobObject.blob_id) }];
                                    case 7:
                                        verifyAttempt++;
                                        return [3 /*break*/, 3];
                                    case 8: return [3 /*break*/, 10];
                                    case 9:
                                        error_4 = _c.sent();
                                        lastError = error_4;
                                        if (attempt === maxRetries)
                                            throw error_4;
                                        return [3 /*break*/, 10];
                                    case 10: return [3 /*break*/, 13];
                                    case 11:
                                        error_5 = _c.sent();
                                        lastError = error_5;
                                        if (attempt === maxRetries)
                                            throw error_5;
                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, _this.retryConfig.baseDelay * attempt); })];
                                    case 12:
                                        _c.sent();
                                        return [3 /*break*/, 13];
                                    case 13: return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        attempt = 1;
                        _b.label = 4;
                    case 4:
                        if (!(attempt <= maxRetries)) return [3 /*break*/, 7];
                        return [5 /*yield**/, _loop_1(attempt)];
                    case 5:
                        state_1 = _b.sent();
                        if (typeof state_1 === "object")
                            return [2 /*return*/, state_1.value];
                        _b.label = 6;
                    case 6:
                        attempt++;
                        return [3 /*break*/, 4];
                    case 7: throw lastError || new error_1.CLIError('Upload failed after all retries', 'WALRUS_UPLOAD_FAILED');
                    case 8:
                        error_3 = _b.sent();
                        if (error_3 instanceof error_1.CLIError)
                            throw error_3;
                        throw new error_1.CLIError("Failed to upload image: ".concat(error_3 instanceof Error ? error_3.message : String(error_3)), 'WALRUS_UPLOAD_FAILED');
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    WalrusImageStorage.prototype.uploadImage = function (imagePath) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.uploadImageInternal({
                        imagePath: imagePath,
                        type: 'todo-nft-image'
                    })];
            });
        });
    };
    WalrusImageStorage.prototype.uploadTodoImage = function (imagePath, title, completed) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.uploadImageInternal({
                        imagePath: imagePath,
                        type: 'todo-nft-image',
                        metadata: {
                            title: title,
                            completed: completed
                        }
                    })];
            });
        });
    };
    WalrusImageStorage.prototype.ensureStorageAllocated = function () {
        return __awaiter(this, arguments, void 0, function (sizeBytes) {
            var address, epoch, balance, response, availableStorage, expiredStorage, _i, _a, item, content, fields, storage, size, endEpoch, requiredStorage, maxRetries, lastError, _loop_2, this_2, attempt, state_2, error_6;
            var _b;
            if (sizeBytes === void 0) { sizeBytes = 1073741824; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!this.isInitialized) {
                            throw new error_1.CLIError('WalrusImageStorage not initialized. Call connect() first.', 'WALRUS_NOT_INITIALIZED');
                        }
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 10, , 11]);
                        if (this.useMockMode) {
                            console.log('Using mock mode for storage allocation');
                            return [2 /*return*/];
                        }
                        console.log('Checking Walrus storage allocation...');
                        address = this.getActiveAddress();
                        return [4 /*yield*/, this.suiClient.getLatestSuiSystemState()];
                    case 2:
                        epoch = (_c.sent()).epoch;
                        console.log("Current epoch: ".concat(epoch));
                        return [4 /*yield*/, this.suiClient.getBalance({
                                owner: address,
                                coinType: 'WAL'
                            })];
                    case 3:
                        balance = _c.sent();
                        if (Number(balance.totalBalance) < 100) {
                            throw new error_1.CLIError('Insufficient WAL tokens for storage allocation', 'WALRUS_INSUFFICIENT_TOKENS');
                        }
                        return [4 /*yield*/, this.suiClient.getOwnedObjects({
                                owner: address,
                                filter: { StructType: "0x2::storage::Storage" },
                                options: { showContent: true }
                            })];
                    case 4:
                        response = _c.sent();
                        availableStorage = 0;
                        expiredStorage = 0;
                        for (_i = 0, _a = response.data; _i < _a.length; _i++) {
                            item = _a[_i];
                            content = (_b = item.data) === null || _b === void 0 ? void 0 : _b.content;
                            if ((content === null || content === void 0 ? void 0 : content.dataType) !== 'moveObject' || !content.hasPublicTransfer || !content.type)
                                continue;
                            fields = content.fields;
                            if (!fields)
                                continue;
                            storage = {
                                storage_size: fields.storage_size || '0',
                                end_epoch: fields.end_epoch || '0'
                            };
                            size = Number(storage.storage_size);
                            endEpoch = Number(storage.end_epoch);
                            if (endEpoch > Number(epoch)) {
                                availableStorage += size;
                            }
                            else {
                                expiredStorage += size;
                            }
                        }
                        console.log("Available storage: ".concat(availableStorage, " bytes"));
                        if (expiredStorage > 0) {
                            console.log("Expired storage: ".concat(expiredStorage, " bytes (not counted)"));
                        }
                        if (!(availableStorage < sizeBytes)) return [3 /*break*/, 9];
                        console.log("Insufficient storage. Required: ".concat(sizeBytes, " bytes"));
                        requiredStorage = sizeBytes - availableStorage;
                        maxRetries = 3;
                        lastError = null;
                        _loop_2 = function (attempt) {
                            var signer, verifyResponse, newTotal, error_7;
                            return __generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0:
                                        _d.trys.push([0, 4, , 6]);
                                        console.log("Allocation attempt ".concat(attempt, "/").concat(maxRetries, "..."));
                                        return [4 /*yield*/, this_2.getTransactionSigner()];
                                    case 1:
                                        signer = _d.sent();
                                        return [4 /*yield*/, this_2.walrusClient.executeCreateStorageTransaction({
                                                size: requiredStorage,
                                                epochs: 52, // ~6 months
                                                owner: address,
                                                signer: signer
                                            })];
                                    case 2:
                                        _d.sent();
                                        return [4 /*yield*/, this_2.suiClient.getOwnedObjects({
                                                owner: address,
                                                filter: { StructType: "0x2::storage::Storage" },
                                                options: { showContent: true }
                                            })];
                                    case 3:
                                        verifyResponse = _d.sent();
                                        newTotal = verifyResponse.data
                                            .filter(function (item) {
                                            var _a;
                                            var content = (_a = item.data) === null || _a === void 0 ? void 0 : _a.content;
                                            if (!content || typeof content === 'string')
                                                return false;
                                            return content.dataType === 'moveObject' && content.hasPublicTransfer && content.type;
                                        })
                                            .reduce(function (total, item) {
                                            var _a;
                                            var content = (_a = item.data) === null || _a === void 0 ? void 0 : _a.content;
                                            if (!content || typeof content === 'string' ||
                                                content.dataType !== 'moveObject' ||
                                                !content.hasPublicTransfer ||
                                                !content.type ||
                                                !content.fields) {
                                                return total;
                                            }
                                            var fields = content.fields;
                                            var storage_size = fields.storage_size;
                                            return total + (storage_size ? Number(storage_size) : 0);
                                        }, 0);
                                        if (newTotal < sizeBytes) {
                                            throw new Error('Allocation verification failed');
                                        }
                                        console.log("Successfully allocated ".concat(requiredStorage, " bytes of storage"));
                                        return [2 /*return*/, { value: void 0 }];
                                    case 4:
                                        error_7 = _d.sent();
                                        lastError = error_7;
                                        if (attempt === maxRetries)
                                            return [2 /*return*/, "break"];
                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000 * attempt); })];
                                    case 5:
                                        _d.sent();
                                        return [3 /*break*/, 6];
                                    case 6: return [2 /*return*/];
                                }
                            });
                        };
                        this_2 = this;
                        attempt = 1;
                        _c.label = 5;
                    case 5:
                        if (!(attempt <= maxRetries)) return [3 /*break*/, 8];
                        return [5 /*yield**/, _loop_2(attempt)];
                    case 6:
                        state_2 = _c.sent();
                        if (typeof state_2 === "object")
                            return [2 /*return*/, state_2.value];
                        if (state_2 === "break")
                            return [3 /*break*/, 8];
                        _c.label = 7;
                    case 7:
                        attempt++;
                        return [3 /*break*/, 5];
                    case 8: throw lastError || new Error('Storage allocation failed after all retries');
                    case 9:
                        console.log("Sufficient storage available: ".concat(availableStorage, " bytes"));
                        return [3 /*break*/, 11];
                    case 10:
                        error_6 = _c.sent();
                        if (error_6 instanceof error_1.CLIError)
                            throw error_6;
                        throw new error_1.CLIError("Failed to ensure storage allocation: ".concat(error_6 instanceof Error ? error_6.message : String(error_6)), 'WALRUS_ALLOCATION_FAILED');
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    return WalrusImageStorage;
}());
exports.WalrusImageStorage = WalrusImageStorage;
function createWalrusImageStorage(suiClient, useMockMode) {
    if (useMockMode === void 0) { useMockMode = false; }
    return new WalrusImageStorage(suiClient, useMockMode);
}
