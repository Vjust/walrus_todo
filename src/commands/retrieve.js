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
var todoService_1 = require("../services/todoService");
var walrus_storage_1 = require("../utils/walrus-storage");
var sui_nft_storage_1 = require("../utils/sui-nft-storage");
var constants_1 = require("../constants");
var error_1 = require("../types/error");
var config_service_1 = require("../services/config-service");
var chalk_1 = require("chalk");
var RetrieveCommand = /** @class */ (function (_super) {
    __extends(RetrieveCommand, _super);
    function RetrieveCommand() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.todoService = new todoService_1.TodoService();
        _this.spinner = null;
        return _this;
    }
    RetrieveCommand.prototype.startSpinner = function (text) {
        if (this.spinner) {
            this.spinner.text = text;
        }
        else {
            this.log(chalk_1.default.blue(text));
        }
    };
    RetrieveCommand.prototype.stopSpinner = function (success, text) {
        if (success === void 0) { success = true; }
        if (text) {
            this.log(success ? chalk_1.default.green("\u2713 ".concat(text)) : chalk_1.default.red("\u2717 ".concat(text)));
        }
    };
    RetrieveCommand.prototype.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var flags, config, network, mockMode, blobId, objectId, localTodo, networkUrl, suiClient, error_2, walrusStorage, _a, connectError_1, todo, blobError_1, signer, suiNftStorage, nftData, todo, nftError_1, cleanupError_1, error_3;
            var _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 34, , 35]);
                        return [4 /*yield*/, this.parse(RetrieveCommand)];
                    case 1:
                        flags = (_e.sent()).flags;
                        this.startSpinner('Loading configuration...');
                        return [4 /*yield*/, config_service_1.configService.getConfig()];
                    case 2:
                        config = _e.sent();
                        network = flags.network || config.network || 'testnet';
                        mockMode = flags.mock || false;
                        // Validate network configuration
                        if (!constants_1.NETWORK_URLS[network]) {
                            throw new error_1.CLIError("Invalid network: ".concat(network, ". Available networks: ").concat(Object.keys(constants_1.NETWORK_URLS).join(', ')), 'INVALID_NETWORK');
                        }
                        this.stopSpinner(true, 'Configuration validated');
                        blobId = void 0;
                        objectId = void 0;
                        // Look up IDs from local todo if title/id provided
                        this.startSpinner('Looking up todo information...');
                        if (!flags.todo) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.todoService.getTodoByTitleOrId(flags.todo, flags.list)];
                    case 3:
                        localTodo = _e.sent();
                        if (!localTodo) {
                            this.stopSpinner(false);
                            throw new error_1.CLIError("Todo \"".concat(flags.todo, "\" not found in list \"").concat(flags.list, "\""), 'TODO_NOT_FOUND');
                        }
                        blobId = localTodo.walrusBlobId;
                        objectId = localTodo.nftObjectId;
                        if (!blobId && !objectId) {
                            throw new error_1.CLIError("Todo \"".concat(flags.todo, "\" exists locally but has no blockchain or Walrus storage IDs. You need to store it first."), 'NOT_STORED');
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        // Validate input if not using todo lookup
                        if (!flags['blob-id'] && !flags['object-id']) {
                            // Make the error message more helpful
                            this.log(chalk_1.default.yellow('⚠️'), 'You must specify either a todo title/ID, Walrus blob ID, or Sui object ID to retrieve');
                            this.log(chalk_1.default.dim('\nExamples:'));
                            this.log(chalk_1.default.dim("  ".concat(this.config.bin, " retrieve --todo \"My Task\" --list ").concat(flags.list)));
                            this.log(chalk_1.default.dim("  ".concat(this.config.bin, " retrieve --blob-id <walrus-blob-id> --list ").concat(flags.list)));
                            this.log(chalk_1.default.dim("  ".concat(this.config.bin, " retrieve --object-id <sui-object-id> --list ").concat(flags.list)));
                            // If the user is in test mode, provide sample test IDs
                            if (mockMode) {
                                this.log(chalk_1.default.blue('\nSince you specified --mock, you can use these test IDs:'));
                                this.log(chalk_1.default.dim('  --blob-id mock-blob-123'));
                                this.log(chalk_1.default.dim('  --object-id mock-object-456'));
                            }
                            throw new error_1.CLIError('No retrieval identifier specified', 'MISSING_PARAMETER');
                        }
                        blobId = flags['blob-id'];
                        objectId = flags['object-id'];
                        _e.label = 5;
                    case 5:
                        // Check deployment status if retrieving from blockchain
                        if (objectId && !((_b = config === null || config === void 0 ? void 0 : config.lastDeployment) === null || _b === void 0 ? void 0 : _b.packageId)) {
                            throw new error_1.CLIError('Contract not deployed. Please run "waltodo deploy --network ' + network + '" first.', 'NOT_DEPLOYED');
                        }
                        networkUrl = constants_1.NETWORK_URLS[network];
                        suiClient = new client_1.SuiClient({ url: networkUrl });
                        if (!!mockMode) return [3 /*break*/, 9];
                        this.startSpinner('Verifying network connection...');
                        _e.label = 6;
                    case 6:
                        _e.trys.push([6, 8, , 9]);
                        return [4 /*yield*/, suiClient.getLatestCheckpointSequenceNumber()];
                    case 7:
                        _e.sent();
                        this.stopSpinner(true, 'Network connection verified');
                        return [3 /*break*/, 9];
                    case 8:
                        error_2 = _e.sent();
                        this.stopSpinner(false);
                        throw new error_1.CLIError("Unable to connect to network ".concat(network, ": ").concat(error_2 instanceof Error ? error_2.message : String(error_2)), 'NETWORK_ERROR');
                    case 9:
                        // Initialize and connect to Walrus storage
                        this.startSpinner('Connecting to Walrus storage...');
                        walrusStorage = (0, walrus_storage_1.createWalrusStorage)(mockMode);
                        _e.label = 10;
                    case 10:
                        _e.trys.push([10, 14, , 15]);
                        return [4 /*yield*/, walrusStorage.connect()];
                    case 11:
                        _e.sent();
                        _a = !mockMode;
                        if (!_a) return [3 /*break*/, 13];
                        return [4 /*yield*/, walrusStorage.isConnected()];
                    case 12:
                        _a = !(_e.sent());
                        _e.label = 13;
                    case 13:
                        if (_a) {
                            throw new error_1.CLIError('Failed to establish connection with Walrus storage', 'WALRUS_CONNECTION_FAILED');
                        }
                        this.stopSpinner(true, 'Connected to Walrus storage');
                        return [3 /*break*/, 15];
                    case 14:
                        connectError_1 = _e.sent();
                        this.stopSpinner(false);
                        throw new error_1.CLIError("Failed to connect to Walrus storage: ".concat(connectError_1 instanceof Error ? connectError_1.message : String(connectError_1)), 'WALRUS_CONNECTION_FAILED');
                    case 15:
                        _e.trys.push([15, , 28, 33]);
                        this.startSpinner('Preparing to retrieve data...');
                        if (!blobId) return [3 /*break*/, 21];
                        // Retrieve todo from Walrus directly
                        this.startSpinner("Retrieving todo from Walrus (blob ID: ".concat(blobId, ")..."));
                        _e.label = 16;
                    case 16:
                        _e.trys.push([16, 19, , 20]);
                        return [4 /*yield*/, walrusStorage.retrieveTodo(blobId)];
                    case 17:
                        todo = _e.sent();
                        // Save to local list
                        return [4 /*yield*/, this.todoService.addTodo(flags.list, __assign(__assign({}, todo), { walrusBlobId: blobId }))];
                    case 18:
                        // Save to local list
                        _e.sent();
                        this.stopSpinner(true, 'Todo retrieved successfully from Walrus');
                        this.log(chalk_1.default.dim('Details:'));
                        this.log("  Title: ".concat(chalk_1.default.bold(todo.title)));
                        this.log("  Status: ".concat(todo.completed ? chalk_1.default.green('Completed') : chalk_1.default.yellow('Pending')));
                        this.log("  Priority: ".concat(getColoredPriority(todo.priority)));
                        this.log("  List: ".concat(chalk_1.default.cyan(flags.list)));
                        this.log("  Walrus Blob ID: ".concat(chalk_1.default.dim(blobId)));
                        if ((_c = todo.tags) === null || _c === void 0 ? void 0 : _c.length) {
                            this.log("  Tags: ".concat(todo.tags.map(function (tag) { return chalk_1.default.blue(tag); }).join(', ')));
                        }
                        return [3 /*break*/, 20];
                    case 19:
                        blobError_1 = _e.sent();
                        throw new error_1.CLIError("Failed to retrieve todo from Walrus with blob ID ".concat(blobId, ": ").concat(blobError_1 instanceof Error ? blobError_1.message : String(blobError_1)), 'WALRUS_RETRIEVAL_FAILED');
                    case 20: return [3 /*break*/, 27];
                    case 21:
                        if (!objectId) return [3 /*break*/, 27];
                        signer = {};
                        suiNftStorage = new sui_nft_storage_1.SuiNftStorage(suiClient, signer, { address: config.lastDeployment.packageId, packageId: config.lastDeployment.packageId, collectionId: '' });
                        // Retrieve NFT from blockchain
                        this.startSpinner("Retrieving NFT from blockchain (object ID: ".concat(objectId, ")..."));
                        _e.label = 22;
                    case 22:
                        _e.trys.push([22, 26, , 27]);
                        return [4 /*yield*/, suiNftStorage.getTodoNft(objectId)];
                    case 23:
                        nftData = _e.sent();
                        if (!nftData.walrusBlobId) {
                            throw new error_1.CLIError('NFT does not contain a valid Walrus blob ID. This might not be a todo NFT.', 'INVALID_NFT');
                        }
                        // Retrieve todo data from Walrus
                        this.startSpinner("Retrieving todo data from Walrus (blob ID: ".concat(nftData.walrusBlobId, ")..."));
                        return [4 /*yield*/, walrusStorage.retrieveTodo(nftData.walrusBlobId).catch(function (error) {
                                if (error.message.includes('not found')) {
                                    throw new error_1.CLIError("Todo data not found in Walrus storage. The data may have expired or been deleted.", 'DATA_NOT_FOUND');
                                }
                                throw error;
                            })];
                    case 24:
                        todo = _e.sent();
                        // Save to local list
                        return [4 /*yield*/, this.todoService.addTodo(flags.list, __assign(__assign({}, todo), { nftObjectId: objectId, walrusBlobId: nftData.walrusBlobId }))];
                    case 25:
                        // Save to local list
                        _e.sent();
                        this.stopSpinner(true, "Todo retrieved successfully from blockchain and Walrus");
                        this.log(chalk_1.default.dim("Details:"));
                        this.log("  Title: ".concat(chalk_1.default.bold(todo.title)));
                        this.log("  Status: ".concat(todo.completed ? chalk_1.default.green('Completed') : chalk_1.default.yellow('Pending')));
                        this.log("  Priority: ".concat(getColoredPriority(todo.priority)));
                        this.log("  List: ".concat(chalk_1.default.cyan(flags.list)));
                        this.log("  NFT Object ID: ".concat(chalk_1.default.cyan(objectId)));
                        this.log("  Walrus Blob ID: ".concat(chalk_1.default.dim(nftData.walrusBlobId)));
                        if (todo.dueDate) {
                            this.log("  Due Date: ".concat(chalk_1.default.blue(todo.dueDate)));
                        }
                        if ((_d = todo.tags) === null || _d === void 0 ? void 0 : _d.length) {
                            this.log("  Tags: ".concat(todo.tags.map(function (tag) { return chalk_1.default.blue(tag); }).join(', ')));
                        }
                        // Add a link to view the NFT on Sui Explorer
                        if (!mockMode) {
                            this.log(chalk_1.default.blue('\nView your NFT on Sui Explorer:'));
                            this.log(chalk_1.default.cyan("  https://explorer.sui.io/object/".concat(objectId, "?network=").concat(network)));
                        }
                        return [3 /*break*/, 27];
                    case 26:
                        nftError_1 = _e.sent();
                        if (nftError_1 instanceof error_1.CLIError) {
                            throw nftError_1;
                        }
                        throw new error_1.CLIError("Failed to retrieve NFT with object ID ".concat(objectId, ": ").concat(nftError_1 instanceof Error ? nftError_1.message : String(nftError_1)), 'NFT_RETRIEVAL_FAILED');
                    case 27: return [3 /*break*/, 33];
                    case 28:
                        // Enhanced cleanup with proper error handling
                        this.startSpinner('Cleaning up resources...');
                        _e.label = 29;
                    case 29:
                        _e.trys.push([29, 31, , 32]);
                        return [4 /*yield*/, walrusStorage.disconnect()];
                    case 30:
                        _e.sent();
                        this.stopSpinner(true, 'Resources cleaned up');
                        return [3 /*break*/, 32];
                    case 31:
                        cleanupError_1 = _e.sent();
                        this.stopSpinner(false, 'Resource cleanup encountered issues');
                        console.warn("Warning: Failed to disconnect from Walrus storage: ".concat(cleanupError_1 instanceof Error ? cleanupError_1.message : String(cleanupError_1)));
                        return [3 /*break*/, 32];
                    case 32: return [7 /*endfinally*/];
                    case 33: return [3 /*break*/, 35];
                    case 34:
                        error_3 = _e.sent();
                        if (error_3 instanceof error_1.CLIError) {
                            throw error_3;
                        }
                        throw new error_1.CLIError("Failed to retrieve todo: ".concat(error_3 instanceof Error ? error_3.message : String(error_3)), 'RETRIEVE_FAILED');
                    case 35: return [2 /*return*/];
                }
            });
        });
    };
    RetrieveCommand.description = 'Retrieve todos from blockchain or Walrus storage';
    RetrieveCommand.examples = [
        '<%= config.bin %> retrieve --todo "Buy groceries" --list my-todos',
        '<%= config.bin %> retrieve --blob-id QmXyz --list my-todos',
        '<%= config.bin %> retrieve --object-id 0x123 --list my-todos',
        '<%= config.bin %> retrieve --object-id 0x123 --network testnet --list my-todos',
        '<%= config.bin %> retrieve --blob-id QmXyz --mock --list my-todos',
    ];
    RetrieveCommand.flags = {
        todo: core_1.Flags.string({
            char: 't',
            description: 'Title or ID of the todo to retrieve',
            exclusive: ['blob-id', 'object-id'],
        }),
        'blob-id': core_1.Flags.string({
            description: 'Walrus blob ID to retrieve',
            exclusive: ['object-id', 'todo'],
        }),
        'object-id': core_1.Flags.string({
            description: 'NFT object ID to retrieve',
            exclusive: ['blob-id', 'todo'],
        }),
        list: core_1.Flags.string({
            char: 'l',
            description: 'Save to this todo list',
            default: 'default'
        }),
        mock: core_1.Flags.boolean({
            description: 'Use mock Walrus storage for testing',
            default: false
        }),
        network: core_1.Flags.string({
            char: 'n',
            description: 'Network to use (defaults to configured network)',
            options: ['localnet', 'devnet', 'testnet', 'mainnet'],
        }),
    };
    return RetrieveCommand;
}(core_1.Command));
exports.default = RetrieveCommand;
// Helper function for colored priority output
function getColoredPriority(priority) {
    switch (priority === null || priority === void 0 ? void 0 : priority.toLowerCase()) {
        case 'high':
            return chalk_1.default.red('High');
        case 'medium':
            return chalk_1.default.yellow('Medium');
        case 'low':
            return chalk_1.default.green('Low');
        default:
            return chalk_1.default.dim(priority || 'None');
    }
}
