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
var fs = require("fs");
var path = require("path");
var os = require("os");
var child_process_1 = require("child_process");
var chalk_1 = require("chalk");
var error_handler_1 = require("../utils/error-handler");
var config_service_1 = require("../services/config-service");
var DeployCommand = /** @class */ (function (_super) {
    __extends(DeployCommand, _super);
    function DeployCommand() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    DeployCommand.prototype.getNetworkUrl = function (network) {
        var networkUrls = {
            localnet: 'http://localhost:9000',
            devnet: 'https://fullnode.devnet.sui.io:443',
            testnet: 'https://fullnode.testnet.sui.io:443',
            mainnet: 'https://fullnode.mainnet.sui.io:443'
        };
        var url = networkUrls[network];
        if (!url) {
            throw new error_handler_1.CLIError("Invalid network: ".concat(network), 'INVALID_NETWORK');
        }
        return url;
    };
    DeployCommand.prototype.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var flags, network, address, gasBudget, deployAddress, activeAddressOutput, error_1, networkUrl, tempDir, sourcesDir, moveTomlSource, moveTomlDest, contractFiles, _i, contractFiles_1, file, sourcePath, destPath, publishCommand, publishOutput, publishResult, packageObj, packageId, deploymentInfo, currentConfig, execError_1, errorOutput, error, error_2;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.parse(DeployCommand)];
                    case 1:
                        flags = (_c.sent()).flags;
                        network = flags.network, address = flags.address, gasBudget = flags["gas-budget"];
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 15, , 16]);
                        // Check if sui client is installed
                        try {
                            (0, child_process_1.execSync)('sui --version', { stdio: 'ignore' });
                        }
                        catch (error) {
                            throw new error_handler_1.CLIError('Sui CLI not found. Please install it first: cargo install --locked --git https://github.com/MystenLabs/sui.git sui', 'SUI_CLI_NOT_FOUND');
                        }
                        deployAddress = address;
                        if (!!deployAddress) return [3 /*break*/, 8];
                        _c.label = 3;
                    case 3:
                        _c.trys.push([3, 7, , 8]);
                        return [4 /*yield*/, config_service_1.configService.getConfig()];
                    case 4:
                        deployAddress = (_c.sent()).walletAddress;
                        if (!!deployAddress) return [3 /*break*/, 6];
                        activeAddressOutput = (0, child_process_1.execSync)('sui client active-address', { encoding: 'utf8' }).trim();
                        if (!(activeAddressOutput && activeAddressOutput.startsWith('0x'))) return [3 /*break*/, 6];
                        deployAddress = activeAddressOutput;
                        // Save it to config for future use
                        return [4 /*yield*/, config_service_1.configService.saveConfig({
                                walletAddress: deployAddress,
                            })];
                    case 5:
                        // Save it to config for future use
                        _c.sent();
                        _c.label = 6;
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        error_1 = _c.sent();
                        return [3 /*break*/, 8];
                    case 8:
                        if (!deployAddress) {
                            throw new error_handler_1.CLIError('No wallet address configured. Please run "waltodo configure" first or provide --address flag.', 'NO_WALLET_ADDRESS');
                        }
                        this.log(chalk_1.default.blue("\nDeploying to ".concat(network, " network with address ").concat(deployAddress, "...")));
                        networkUrl = this.getNetworkUrl(network);
                        this.log(chalk_1.default.dim("Network URL: ".concat(networkUrl)));
                        tempDir = fs.mkdtempSync(path.join(path.resolve(os.tmpdir()), 'todo_nft_deploy_'));
                        this.log(chalk_1.default.dim("Created temporary directory for deployment: ".concat(tempDir)));
                        sourcesDir = path.join(tempDir, 'sources');
                        fs.mkdirSync(sourcesDir, { recursive: true });
                        moveTomlSource = path.resolve(__dirname, '../../src/move/Move.toml');
                        moveTomlDest = path.join(tempDir, 'Move.toml');
                        if (!fs.existsSync(moveTomlSource)) {
                            throw new error_handler_1.CLIError('Move.toml not found in src/move. Ensure the file exists.', 'FILE_NOT_FOUND');
                        }
                        fs.copyFileSync(moveTomlSource, moveTomlDest);
                        this.log(chalk_1.default.dim('Copied Move.toml to temporary directory'));
                        contractFiles = ['todo_nft.move'];
                        for (_i = 0, contractFiles_1 = contractFiles; _i < contractFiles_1.length; _i++) {
                            file = contractFiles_1[_i];
                            sourcePath = path.resolve(__dirname, "../../src/move/sources/".concat(file));
                            destPath = path.join(sourcesDir, file);
                            if (!fs.existsSync(sourcePath)) {
                                throw new error_handler_1.CLIError("Contract file ".concat(file, " not found in src/move/sources. Ensure the file exists."), 'FILE_NOT_FOUND');
                            }
                            fs.copyFileSync(sourcePath, destPath);
                            this.log(chalk_1.default.dim("Copied ".concat(file, " to temporary directory")));
                        }
                        this.log(chalk_1.default.blue('\nPublishing package to the Sui blockchain...'));
                        _c.label = 9;
                    case 9:
                        _c.trys.push([9, 12, 13, 14]);
                        publishCommand = "sui client publish --skip-dependency-verification --gas-budget ".concat(gasBudget, " --json ").concat(tempDir);
                        this.log(chalk_1.default.dim("Executing: ".concat(publishCommand)));
                        publishOutput = (0, child_process_1.execSync)(publishCommand, { encoding: 'utf8' });
                        publishResult = void 0;
                        try {
                            publishResult = JSON.parse(publishOutput);
                        }
                        catch (parseError) {
                            throw new error_handler_1.CLIError("Failed to parse Sui CLI output: ".concat(publishOutput), 'INVALID_OUTPUT');
                        }
                        if (!((_a = publishResult.effects) === null || _a === void 0 ? void 0 : _a.created)) {
                            throw new error_handler_1.CLIError('Could not extract package ID from publish result. Transaction may have failed.', 'DEPLOYMENT_FAILED');
                        }
                        packageObj = publishResult.effects.created.find(function (obj) { return obj.owner === 'Immutable'; });
                        if (!packageObj) {
                            throw new error_handler_1.CLIError('Could not find package ID in created objects. Transaction may have succeeded but package creation failed.', 'DEPLOYMENT_FAILED');
                        }
                        packageId = packageObj.reference.objectId;
                        deploymentInfo = {
                            packageId: packageId,
                            digest: publishResult.digest,
                            network: network,
                            timestamp: new Date().toISOString()
                        };
                        return [4 /*yield*/, config_service_1.configService.getConfig()];
                    case 10:
                        currentConfig = _c.sent();
                        return [4 /*yield*/, config_service_1.configService.saveConfig(__assign(__assign({}, currentConfig), { // Preserve other settings
                                network: network, walletAddress: deployAddress, lastDeployment: deploymentInfo }))];
                    case 11:
                        _c.sent();
                        this.log(chalk_1.default.green('\n✓ Smart contract deployed successfully!'));
                        this.log(chalk_1.default.blue('Deployment Info:'));
                        this.log(chalk_1.default.bold(chalk_1.default.cyan("  Package ID: ".concat(packageId))));
                        this.log(chalk_1.default.dim("  Digest: ".concat(publishResult.digest)));
                        this.log(chalk_1.default.dim("  Network: ".concat(network)));
                        this.log(chalk_1.default.dim("  Address: ".concat(deployAddress)));
                        this.log('\nConfiguration has been saved. You can now use other commands without specifying the package ID.');
                        this.log(chalk_1.default.blue('\nView your package on Sui Explorer:'));
                        this.log(chalk_1.default.cyan("  https://explorer.sui.io/object/".concat(packageId, "?network=").concat(network)));
                        return [3 /*break*/, 14];
                    case 12:
                        execError_1 = _c.sent();
                        if (execError_1.status === 1) {
                            errorOutput = ((_b = execError_1.stderr) === null || _b === void 0 ? void 0 : _b.toString()) || execError_1.message;
                            if (errorOutput.includes('gas budget')) {
                                throw new error_handler_1.CLIError("Insufficient gas budget. Try increasing with --gas-budget flag. Error: ".concat(errorOutput), 'INSUFFICIENT_GAS');
                            }
                            else if (errorOutput.includes('Balance insufficient')) {
                                throw new error_handler_1.CLIError("Insufficient balance for deployment. Add funds to your wallet address. Error: ".concat(errorOutput), 'INSUFFICIENT_BALANCE');
                            }
                            else {
                                throw new error_handler_1.CLIError("Sui CLI execution failed: ".concat(errorOutput), 'SUI_CLI_ERROR');
                            }
                        }
                        throw execError_1; // Re-throw if it's not a CLI execution error
                    case 13:
                        // Clean up temporary directory
                        try {
                            fs.rmSync(tempDir, { recursive: true });
                            this.log(chalk_1.default.dim('Cleaned up temporary deployment directory'));
                        }
                        catch (cleanupError) {
                            error = cleanupError;
                            this.warn("Warning: Failed to clean up temporary directory: ".concat(error.message));
                        }
                        return [7 /*endfinally*/];
                    case 14: return [3 /*break*/, 16];
                    case 15:
                        error_2 = _c.sent();
                        if (error_2 instanceof error_handler_1.CLIError) {
                            throw error_2;
                        }
                        throw new error_handler_1.CLIError("Deployment failed: ".concat(error_2 instanceof Error ? error_2.message : String(error_2)), 'DEPLOYMENT_FAILED');
                    case 16: return [2 /*return*/];
                }
            });
        });
    };
    DeployCommand.description = 'Deploy the Todo NFT smart contract to the Sui blockchain';
    DeployCommand.examples = [
        '<%= config.bin %> deploy --network testnet',
        '<%= config.bin %> deploy --network devnet --address 0x123456...',
    ];
    DeployCommand.flags = {
        network: core_1.Flags.string({
            char: 'n',
            description: 'Network to deploy to (localnet, devnet, testnet, mainnet)',
            required: true,
            options: ['localnet', 'devnet', 'testnet', 'mainnet'],
            default: 'devnet'
        }),
        address: core_1.Flags.string({
            char: 'a',
            description: 'Sui address to use (defaults to active address in Sui CLI)',
        }),
        'gas-budget': core_1.Flags.string({
            description: 'Gas budget for the deployment transaction',
            default: '100000000'
        })
    };
    return DeployCommand;
}(core_1.Command));
exports.default = DeployCommand;
