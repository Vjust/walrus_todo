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
var prompts_1 = require("@inquirer/prompts");
var chalk_1 = require("chalk");
// Removed unused Config import
var config_service_1 = require("../services/config-service");
var error_1 = require("../types/error");
var ConfigureCommand = /** @class */ (function (_super) {
    __extends(ConfigureCommand, _super);
    function ConfigureCommand() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ConfigureCommand.prototype.validateUserIdentifier = function (userId) {
        return userId.trim().length > 0;
    };
    ConfigureCommand.prototype.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var flags, network, walletAddress, encryptedStorage, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 11, , 12]);
                        return [4 /*yield*/, this.parse(ConfigureCommand)];
                    case 1:
                        flags = (_a.sent()).flags;
                        if (!flags.reset) return [3 /*break*/, 3];
                        return [4 /*yield*/, config_service_1.configService.saveConfig({
                                network: 'local',
                                walletAddress: '',
                                encryptedStorage: false
                            })];
                    case 2:
                        _a.sent();
                        this.log(chalk_1.default.green('✓ Configuration reset to defaults'));
                        return [2 /*return*/];
                    case 3:
                        network = flags.network;
                        walletAddress = flags.walletAddress;
                        if (!!network) return [3 /*break*/, 5];
                        return [4 /*yield*/, (0, prompts_1.select)({
                                message: 'Select network:',
                                choices: [
                                    { name: 'mainnet', value: 'mainnet' },
                                    { name: 'testnet', value: 'testnet' },
                                    { name: 'devnet', value: 'devnet' },
                                    { name: 'local', value: 'local' }
                                ]
                            })];
                    case 4:
                        network = _a.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        if (!['mainnet', 'testnet', 'devnet', 'local'].includes(network)) {
                            throw new error_1.CLIError('Invalid network specified. Use mainnet, testnet, devnet, or local.', 'INVALID_NETWORK');
                        }
                        _a.label = 6;
                    case 6:
                        if (!!walletAddress) return [3 /*break*/, 8];
                        return [4 /*yield*/, (0, prompts_1.input)({
                                message: 'Enter your wallet address (e.g., 0x123...):',
                            })];
                    case 7:
                        walletAddress = _a.sent();
                        if (!/^0x[a-fA-F0-9]{40,}$/.test(walletAddress)) {
                            throw new error_1.CLIError("Invalid wallet address format. Must be a valid hex address starting with 0x.", 'INVALID_WALLET_ADDRESS'); // Changed to double quotes for consistency
                        }
                        _a.label = 8;
                    case 8: return [4 /*yield*/, (0, prompts_1.confirm)({
                            message: 'Enable encryption for sensitive data?',
                            default: true
                        })];
                    case 9:
                        encryptedStorage = _a.sent();
                        return [4 /*yield*/, config_service_1.configService.saveConfig({
                                network: network,
                                walletAddress: walletAddress,
                                encryptedStorage: encryptedStorage
                            })];
                    case 10:
                        _a.sent();
                        this.log(chalk_1.default.green('\n✓ Configuration saved successfully'));
                        this.log(chalk_1.default.dim('Network:'), network);
                        this.log(chalk_1.default.dim('Wallet Address:'), walletAddress);
                        this.log(chalk_1.default.dim('Encryption:'), encryptedStorage ? 'Enabled' : 'Disabled');
                        return [3 /*break*/, 12];
                    case 11:
                        error_2 = _a.sent();
                        if (error_2 instanceof error_1.CLIError) {
                            throw error_2;
                        }
                        throw new error_1.CLIError("Configuration failed: ".concat(error_2 instanceof Error ? error_2.message : String(error_2)), 'CONFIG_FAILED');
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    ConfigureCommand.description = 'Configure CLI settings';
    ConfigureCommand.examples = [
        '<%= config.bin %> configure',
        '<%= config.bin %> configure --reset',
        '<%= config.bin %> configure --network testnet --wallet-address 0x1234567890abcdef',
        '<%= config.bin %> configure --network local'
    ];
    ConfigureCommand.flags = {
        reset: core_1.Flags.boolean({
            char: 'r',
            description: 'Reset all settings to defaults',
            default: false
        }),
        network: core_1.Flags.string({
            description: 'Network to use (mainnet, testnet, devnet, local)',
            options: ['mainnet', 'testnet', 'devnet', 'local']
        }),
        walletAddress: core_1.Flags.string({
            description: 'Wallet address for configuration'
        })
    };
    return ConfigureCommand;
}(core_1.Command));
exports.default = ConfigureCommand;
