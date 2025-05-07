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
var error_handler_1 = require("../../utils/error-handler");
var todoService_1 = require("../../services/todoService");
var sui_nft_storage_1 = require("../../utils/sui-nft-storage");
var constants_1 = require("../../constants");
var client_1 = require("@mysten/sui.js/client");
// Removed unused chalk import
var config_service_1 = require("../../services/config-service");
var CreateNftCommand = /** @class */ (function (_super) {
    __extends(CreateNftCommand, _super);
    function CreateNftCommand() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    CreateNftCommand.prototype.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var config, flags, todoService, todoItem, blobId, suiClient, suiNftStorage, txDigest, error_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, config_service_1.configService.getConfig()];
                    case 1:
                        config = _b.sent();
                        return [4 /*yield*/, this.parse(CreateNftCommand)];
                    case 2:
                        flags = (_b.sent()).flags;
                        todoService = new todoService_1.TodoService();
                        _b.label = 3;
                    case 3:
                        _b.trys.push([3, 6, , 7]);
                        return [4 /*yield*/, todoService.getTodo(flags.todo, flags.list)];
                    case 4:
                        todoItem = _b.sent();
                        if (!todoItem) {
                            throw new error_handler_1.CLIError("Todo with ID ".concat(flags.todo, " not found in list ").concat(flags.list), 'TODO_NOT_FOUND');
                        }
                        if (!todoItem.imageUrl) {
                            throw new error_handler_1.CLIError('No image URL found for this todo. Please upload an image first using "image upload".', 'NO_IMAGE_URL');
                        }
                        blobId = todoItem.imageUrl.split('/').pop() || '';
                        if (!((_a = config.lastDeployment) === null || _a === void 0 ? void 0 : _a.packageId)) {
                            throw new error_handler_1.CLIError('Todo NFT module address not configured. Please deploy the NFT module first.', 'NOT_DEPLOYED');
                        }
                        suiClient = new client_1.SuiClient({ url: constants_1.NETWORK_URLS[config.network] });
                        suiNftStorage = new sui_nft_storage_1.SuiNftStorage(suiClient, {}, { address: config.lastDeployment.packageId, packageId: config.lastDeployment.packageId });
                        // Create NFT
                        this.log('Creating NFT on Sui blockchain...');
                        return [4 /*yield*/, suiNftStorage.createTodoNft(todoItem, blobId)];
                    case 5:
                        txDigest = _b.sent();
                        this.log("\u2705 NFT created successfully!");
                        this.log("\uD83D\uDCDD Transaction: ".concat(txDigest));
                        this.log("\uD83D\uDCDD Your NFT has been created with the following:");
                        this.log("   - Title: ".concat(todoItem.title));
                        this.log("   - Image URL: ".concat(todoItem.imageUrl));
                        this.log("   - Walrus Blob ID: ".concat(blobId));
                        this.log('\nYou can view this NFT in your wallet with the embedded image from Walrus.');
                        return [3 /*break*/, 7];
                    case 6:
                        error_1 = _b.sent();
                        if (error_1 instanceof error_handler_1.CLIError) {
                            throw error_1;
                        }
                        throw new error_handler_1.CLIError("Failed to create NFT: ".concat(error_1 instanceof Error ? error_1.message : String(error_1)), 'NFT_CREATE_FAILED');
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    CreateNftCommand.description = 'Create an NFT for a todo item with an existing image';
    CreateNftCommand.examples = [
        '<%= config.bin %> image create-nft --todo 123 --list my-todos',
    ];
    CreateNftCommand.flags = {
        todo: core_1.Flags.string({
            char: 't',
            description: 'ID of the todo to create NFT for',
            required: true,
        }),
        list: core_1.Flags.string({
            char: 'l',
            description: 'Name of the todo list',
            required: true,
        }),
    };
    return CreateNftCommand;
}(core_1.Command));
exports.default = CreateNftCommand;
