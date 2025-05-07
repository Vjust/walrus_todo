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
var error_handler_1 = require("../../utils/error-handler");
var todoService_1 = require("../../services/todoService");
var walrus_image_storage_1 = require("../../utils/walrus-image-storage"); // Import WalrusImageStorage type
var constants_1 = require("../../constants");
var client_1 = require("@mysten/sui/client");
// Removed unused chalk import
var path = require("path");
var config_service_1 = require("../../services/config-service");
var UploadCommand = /** @class */ (function (_super) {
    __extends(UploadCommand, _super);
    function UploadCommand() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    UploadCommand.prototype.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var config, flags, todoService, walrusImageStorage, todoItem, suiClient, imageUrl, blobId, updatedTodo, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, config_service_1.configService.getConfig()];
                    case 1:
                        config = _a.sent();
                        return [4 /*yield*/, this.parse(UploadCommand)];
                    case 2:
                        flags = (_a.sent()).flags;
                        todoService = new todoService_1.TodoService();
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 8, 9, 10]);
                        return [4 /*yield*/, todoService.getTodo(flags.todo, flags.list)];
                    case 4:
                        todoItem = _a.sent();
                        if (!todoItem) {
                            throw new error_handler_1.CLIError("Todo with ID ".concat(flags.todo, " not found in list ").concat(flags.list));
                        }
                        suiClient = new client_1.SuiClient({ url: constants_1.NETWORK_URLS[config.network] });
                        // Initialize WalrusImageStorage - ensuring variable is defined and assigned correctly
                        walrusImageStorage = (0, walrus_image_storage_1.createWalrusImageStorage)(suiClient); // No change, but confirming assignment
                        // Connect to Walrus
                        this.log('Connecting to Walrus storage...');
                        return [4 /*yield*/, walrusImageStorage.connect()];
                    case 5:
                        _a.sent();
                        this.log('Connected to Walrus storage');
                        // Upload image
                        this.log('Uploading image to Walrus...');
                        return [4 /*yield*/, walrusImageStorage.uploadTodoImage(path.resolve(process.cwd(), flags.image), todoItem.title, todoItem.completed)];
                    case 6:
                        imageUrl = _a.sent();
                        blobId = imageUrl.split('/').pop() || '';
                        updatedTodo = __assign(__assign({}, todoItem), { imageUrl: imageUrl });
                        return [4 /*yield*/, todoService.updateTodo(flags.list, flags.todo, updatedTodo)];
                    case 7:
                        _a.sent();
                        if (flags['show-url']) {
                            this.log(imageUrl);
                            return [2 /*return*/];
                        }
                        this.log("\u2705 Image uploaded successfully to Walrus");
                        this.log("\uD83D\uDCDD Image URL: ".concat(imageUrl));
                        this.log("\uD83D\uDCDD Blob ID: ".concat(blobId));
                        return [3 /*break*/, 10];
                    case 8:
                        error_1 = _a.sent();
                        if (error_1 instanceof error_handler_1.CLIError) {
                            throw error_1;
                        }
                        throw new error_handler_1.CLIError("Failed to upload image: ".concat(error_1 instanceof Error ? error_1.message : String(error_1)), 'IMAGE_UPLOAD_FAILED');
                    case 9:
                        // Check if walrusImageStorage was initialized before trying to use it
                        if (walrusImageStorage) {
                            // No disconnect method exists on WalrusImageStorage, so no action needed here.
                            // If cleanup is required in the future, add it here.
                            this.log('Walrus storage cleanup (if any) would happen here.');
                        }
                        else {
                            this.log('Walrus storage was not initialized, skipping cleanup.');
                        }
                        return [7 /*endfinally*/];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    UploadCommand.description = 'Upload an image for a todo item';
    UploadCommand.examples = [
        '<%= config.bin %> image upload --todo 123 --list my-todos --image ./custom.png',
    ];
    UploadCommand.flags = {
        todo: core_1.Flags.string({
            char: 't',
            description: 'ID of the todo to upload image for',
            required: true,
        }),
        list: core_1.Flags.string({
            char: 'l',
            description: 'Name of the todo list',
            required: true,
        }),
        image: core_1.Flags.string({
            char: 'i',
            description: 'Path to a custom image file',
            required: true,
        }),
        'show-url': core_1.Flags.boolean({
            description: 'Display only the image URL',
        }),
    };
    return UploadCommand;
}(core_1.Command));
exports.default = UploadCommand;
