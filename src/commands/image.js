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
var core_1 = require("@oclif/core"); // Added Args to import
var error_handler_1 = require("../utils/error-handler");
var todoService_1 = require("../services/todoService");
var sui_nft_storage_1 = require("../utils/sui-nft-storage");
var config_service_1 = require("../services/config-service");
var walrus_image_storage_1 = require("../utils/walrus-image-storage");
var constants_1 = require("../constants");
// Removed unused chalk import
var path = require("path");
var ImageCommand = /** @class */ (function (_super) {
    __extends(ImageCommand, _super);
    function ImageCommand() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ImageCommand.prototype.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var config, _a, args, flags, todoService, suiClient, walrusImageStorage, allLists, foundImages, _i, allLists_1, listName, list, todosWithImages, todoItem, imageUrl, absoluteImagePath, blobId, updatedTodo, blobId, nftStorage, txDigest, error_1;
            var _this = this;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, config_service_1.configService.getConfig()];
                    case 1:
                        config = _c.sent();
                        return [4 /*yield*/, this.parse(ImageCommand)];
                    case 2:
                        _a = _c.sent(), args = _a.args, flags = _a.flags;
                        todoService = new todoService_1.TodoService();
                        _c.label = 3;
                    case 3:
                        _c.trys.push([3, 21, , 22]);
                        suiClient = {
                            url: constants_1.NETWORK_URLS[config.network],
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
                        walrusImageStorage = new walrus_image_storage_1.WalrusImageStorage(suiClient);
                        if (!(args.action === 'list')) return [3 /*break*/, 9];
                        return [4 /*yield*/, todoService.getAllLists()];
                    case 4:
                        allLists = _c.sent();
                        foundImages = false;
                        this.log('📷 Todos with associated images:');
                        _i = 0, allLists_1 = allLists;
                        _c.label = 5;
                    case 5:
                        if (!(_i < allLists_1.length)) return [3 /*break*/, 8];
                        listName = allLists_1[_i];
                        return [4 /*yield*/, todoService.getList(listName)];
                    case 6:
                        list = _c.sent();
                        if (list) {
                            todosWithImages = list.todos.filter(function (todo) { return todo.imageUrl; });
                            if (todosWithImages.length > 0) {
                                this.log("\n\uD83D\uDCDD List: ".concat(listName));
                                todosWithImages.forEach(function (todo) {
                                    _this.log("   - [".concat(todo.id, "] ").concat(todo.title, ": ").concat(todo.imageUrl));
                                });
                                foundImages = true;
                            }
                        }
                        _c.label = 7;
                    case 7:
                        _i++;
                        return [3 /*break*/, 5];
                    case 8:
                        if (!foundImages) {
                            this.log('⚠️ No todos with images found');
                            this.log('\nTo add an image to a todo, use:');
                            this.log('  waltodo image upload --todo <id> --list <list> [--image <path>]');
                        }
                        return [2 /*return*/];
                    case 9:
                        // For upload and create-nft actions, we need a todo item
                        if (!flags.todo || !flags.list) {
                            throw new error_handler_1.CLIError("Todo ID (--todo) and list name (--list) are required for ".concat(args.action, " action"), 'MISSING_PARAMETERS');
                        }
                        return [4 /*yield*/, todoService.getTodo(flags.todo, flags.list)];
                    case 10:
                        todoItem = _c.sent();
                        if (!todoItem) {
                            throw new error_handler_1.CLIError("Todo with ID ".concat(flags.todo, " not found in list ").concat(flags.list), 'TODO_NOT_FOUND');
                        }
                        // Connect to Walrus
                        this.log('Connecting to Walrus storage...');
                        return [4 /*yield*/, walrusImageStorage.connect()];
                    case 11:
                        _c.sent();
                        this.log('Connected to Walrus storage');
                        if (!(args.action === 'upload')) return [3 /*break*/, 17];
                        // Upload image logic
                        this.log('Uploading image to Walrus...');
                        imageUrl = void 0;
                        if (!flags.image) return [3 /*break*/, 13];
                        absoluteImagePath = path.resolve(process.cwd(), flags.image);
                        return [4 /*yield*/, walrusImageStorage.uploadTodoImage(absoluteImagePath, todoItem.title, todoItem.completed)];
                    case 12:
                        imageUrl = _c.sent();
                        return [3 /*break*/, 15];
                    case 13: return [4 /*yield*/, walrusImageStorage.uploadDefaultImage()];
                    case 14:
                        // Use default image
                        imageUrl = _c.sent();
                        _c.label = 15;
                    case 15:
                        blobId = imageUrl.split('/').pop() || '';
                        updatedTodo = __assign(__assign({}, todoItem), { imageUrl: imageUrl });
                        return [4 /*yield*/, todoService.updateTodo(flags.todo, flags.list, updatedTodo)];
                    case 16:
                        _c.sent();
                        if (flags['show-url']) {
                            // Only show the URL if requested
                            this.log(imageUrl);
                            return [2 /*return*/];
                        }
                        this.log("\u2705 Image uploaded successfully to Walrus");
                        this.log("\uD83D\uDCDD Image URL: ".concat(imageUrl));
                        this.log("\uD83D\uDCDD Blob ID: ".concat(blobId));
                        return [3 /*break*/, 20];
                    case 17:
                        if (!(args.action === 'create-nft')) return [3 /*break*/, 19];
                        // Create NFT logic (requires image URL and blob ID)
                        if (!todoItem.imageUrl) {
                            throw new error_handler_1.CLIError('No image URL found for this todo. Please upload an image first using "upload" action.', 'NO_IMAGE_URL');
                        }
                        blobId = todoItem.imageUrl.split('/').pop() || '';
                        if (!((_b = config.lastDeployment) === null || _b === void 0 ? void 0 : _b.packageId)) {
                            throw new error_handler_1.CLIError('Todo NFT module address is not configured. Please deploy the NFT module first.');
                        }
                        this.log('Creating NFT on Sui blockchain...');
                        nftStorage = new sui_nft_storage_1.SuiNftStorage(suiClient, {}, { address: config.lastDeployment.packageId, packageId: config.lastDeployment.packageId });
                        return [4 /*yield*/, nftStorage.createTodoNft(todoItem, blobId)];
                    case 18:
                        txDigest = _c.sent();
                        this.log("\u2705 NFT created successfully!");
                        this.log("\uD83D\uDCDD Transaction: ".concat(txDigest));
                        this.log("\uD83D\uDCDD Your NFT has been created with the following:");
                        this.log("   - Title: ".concat(todoItem.title));
                        this.log("   - Image URL: ".concat(todoItem.imageUrl));
                        this.log("   - Walrus Blob ID: ".concat(blobId));
                        this.log('\nYou can view this NFT in your wallet with the embedded image from Walrus.');
                        return [3 /*break*/, 20];
                    case 19: throw new error_handler_1.CLIError("Invalid action: ".concat(args.action, ". Use 'upload', 'create-nft', or 'list'."), 'INVALID_ACTION');
                    case 20: return [3 /*break*/, 22];
                    case 21:
                        error_1 = _c.sent();
                        if (error_1 instanceof error_handler_1.CLIError) {
                            throw error_1;
                        }
                        throw new error_handler_1.CLIError("Failed to process image: ".concat(error_1 instanceof Error ? error_1.message : String(error_1)), 'IMAGE_FAILED');
                    case 22: return [2 /*return*/];
                }
            });
        });
    };
    ImageCommand.description = 'Manage images for todos and NFTs';
    ImageCommand.examples = [
        '<%= config.bin %> image upload --todo 123 --list my-todos --image ./custom.png',
        '<%= config.bin %> image create-nft --todo 123 --list my-todos',
    ];
    ImageCommand.args = {
        action: core_1.Args.string({
            name: 'action',
            description: 'Action to perform (upload, create-nft, or list)',
            required: true,
            options: ['upload', 'create-nft', 'list'],
        }),
    };
    ImageCommand.flags = {
        todo: core_1.Flags.string({
            char: 't',
            description: 'ID of the todo to create an image for',
            required: false, // Changed from true to false
            dependsOn: ['list'], // Only makes sense with list specified
        }),
        list: core_1.Flags.string({
            char: 'l',
            description: 'Name of the todo list',
        }),
        image: core_1.Flags.string({
            char: 'i',
            description: 'Path to a custom image file',
        }),
        'show-url': core_1.Flags.boolean({
            description: 'Display only the image URL',
        }),
    };
    return ImageCommand;
}(core_1.Command));
exports.default = ImageCommand;
