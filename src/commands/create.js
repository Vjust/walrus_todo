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
var client_1 = require("@mysten/sui.js/client");
var transactions_1 = require("@mysten/sui.js/transactions");
var fs = require("fs");
// Removed unused path import
var sui_keystore_1 = require("../utils/sui-keystore");
var chalk_1 = require("chalk"); // Updated to import style for consistency
var error_handler_1 = require("../utils/error-handler");
var config_service_1 = require("../services/config-service");
var bcs_1 = require("@mysten/bcs");
var walrus_image_storage_1 = require("../utils/walrus-image-storage");
var CreateCommand = /** @class */ (function (_super) {
    __extends(CreateCommand, _super);
    function CreateCommand() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    CreateCommand.prototype.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var flags, title, description, image, isPrivate, config, networkUrl, suiClient, walrusStorage, imageUrl, error_1, blobId, txb, signer, tx, createdObjects, nftId, error_2;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.parse(CreateCommand)];
                    case 1:
                        flags = (_c.sent()).flags;
                        title = flags.title, description = flags.description, image = flags.image, isPrivate = flags.private;
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 13, , 14]);
                        return [4 /*yield*/, config_service_1.configService.getConfig()];
                    case 3:
                        config = _c.sent();
                        if (!((_a = config === null || config === void 0 ? void 0 : config.lastDeployment) === null || _a === void 0 ? void 0 : _a.packageId)) {
                            throw new error_handler_1.CLIError('Contract not deployed. Please run "waltodo deploy" first.', 'NOT_DEPLOYED');
                        }
                        networkUrl = config.network === 'testnet'
                            ? 'https://fullnode.testnet.sui.io:443'
                            : 'https://fullnode.devnet.sui.io:443';
                        suiClient = new client_1.SuiClient({ url: networkUrl });
                        walrusStorage = new walrus_image_storage_1.WalrusImageStorage(suiClient);
                        return [4 /*yield*/, walrusStorage.connect()];
                    case 4:
                        _c.sent(); // Ensure connection is established
                        imageUrl = void 0;
                        _c.label = 5;
                    case 5:
                        _c.trys.push([5, 10, , 11]);
                        if (!image) return [3 /*break*/, 7];
                        // Upload custom image
                        if (!fs.existsSync(image)) {
                            throw new error_handler_1.CLIError("Image file not found: ".concat(image), 'IMAGE_NOT_FOUND');
                        }
                        return [4 /*yield*/, walrusStorage.uploadImage(image)];
                    case 6:
                        imageUrl = _c.sent();
                        return [3 /*break*/, 9];
                    case 7: return [4 /*yield*/, walrusStorage.uploadDefaultImage().catch(function (err) {
                            if (err.message.includes('blob has not been registered')) {
                                throw new error_handler_1.CLIError("Walrus blob not registered. Ensure Walrus is configured and blobs are registered.", 'WALRUS_BLOB_ERROR');
                            }
                            else {
                                throw new error_handler_1.CLIError("Failed to upload default image: " + err.message, 'IMAGE_UPLOAD_FAILED'); // Changed to double quotes for consistency
                            }
                        })];
                    case 8:
                        // Use default image with retry and error handling
                        imageUrl = _c.sent();
                        _c.label = 9;
                    case 9: return [3 /*break*/, 11];
                    case 10:
                        error_1 = _c.sent();
                        throw new error_handler_1.CLIError("Failed to upload image to Walrus: ".concat(error_1 instanceof Error ? error_1.message : String(error_1)), 'IMAGE_UPLOAD_FAILED');
                    case 11:
                        blobId = imageUrl.split('/').pop();
                        if (!blobId) {
                            throw new error_handler_1.CLIError('Failed to extract blob ID from image URL', 'INVALID_URL');
                        }
                        txb = new transactions_1.TransactionBlock();
                        txb.moveCall({
                            target: "".concat(config.lastDeployment.packageId, "::todo_nft::create_todo"),
                            arguments: [txb.pure(bcs_1.bcs.string().serialize(isPrivate ? 'Untitled' : title).toBytes()), txb.pure(bcs_1.bcs.string().serialize(description).toBytes()), txb.pure(bcs_1.bcs.string().serialize(blobId).toBytes())],
                        });
                        signer = new sui_keystore_1.KeystoreSigner(suiClient);
                        return [4 /*yield*/, suiClient.signAndExecuteTransactionBlock({
                                signer: signer,
                                transactionBlock: txb,
                            })];
                    case 12:
                        tx = _c.sent();
                        if (((_b = tx.effects) === null || _b === void 0 ? void 0 : _b.status.status) !== 'success') { // Add optional chaining for null check
                            throw new error_handler_1.CLIError('Transaction failed', 'TX_FAILED');
                        }
                        createdObjects = tx.effects.created;
                        if (!createdObjects || createdObjects.length === 0) {
                            throw new error_handler_1.CLIError('No objects created in transaction', 'TX_PARSE_ERROR');
                        }
                        nftId = createdObjects[0].reference.objectId;
                        // Success output
                        this.log(chalk_1.default.green('\n✓ Todo NFT created successfully!'));
                        this.log(chalk_1.default.blue('Details:'));
                        this.log(chalk_1.default.dim("  Object ID: ".concat(nftId)));
                        this.log(chalk_1.default.dim("  Title: ".concat(title)));
                        this.log(chalk_1.default.dim("  Image URL: ".concat(imageUrl)));
                        this.log(chalk_1.default.dim("  Network: ".concat(config.network)));
                        this.log('\nView your NFT on Sui Explorer:');
                        this.log(chalk_1.default.cyan("  https://explorer.sui.io/object/".concat(nftId, "?network=").concat(config.network)));
                        return [3 /*break*/, 14];
                    case 13:
                        error_2 = _c.sent();
                        if (error_2 instanceof error_handler_1.CLIError) {
                            throw error_2;
                        }
                        throw new error_handler_1.CLIError("Transaction or creation failed: ".concat(error_2 instanceof Error ? error_2.message : String(error_2)), 'CREATE_FAILED');
                    case 14: return [2 /*return*/];
                }
            });
        });
    };
    CreateCommand.description = 'Create a new todo item as an NFT';
    CreateCommand.examples = [
        '<%= config.bin %> create --title "My first todo" --description "A test todo item" --image ./todo.png',
        '<%= config.bin %> create --title "Private todo" --description "Hidden task" --private',
    ];
    CreateCommand.flags = {
        title: core_1.Flags.string({
            char: 't',
            description: 'Title of the todo item',
            required: true,
        }),
        description: core_1.Flags.string({
            char: 'd',
            description: 'Description of the todo item',
            required: true,
        }),
        image: core_1.Flags.string({
            char: 'i',
            description: 'Path to an image file for the todo item. If not provided, uses default image.',
        }),
        private: core_1.Flags.boolean({
            char: 'p',
            description: 'Create a private todo (will show as "Untitled" in wallets)',
            default: false,
        }),
    };
    return CreateCommand;
}(core_1.Command));
exports.default = CreateCommand;
