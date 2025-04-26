"use strict";
/**
 * Configure Command Module
 * Handles wallet and blockchain connection setup
 * Manages authentication and encryption settings
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configure = configure;
const prompts_1 = require("@inquirer/prompts");
const chalk_1 = __importDefault(require("chalk"));
const config_service_1 = require("../services/config-service");
/**
 * Configures blockchain connection and wallet settings
 * Handles interactive configuration process
 */
async function configure() {
    try {
        // Select network
        const network = await (0, prompts_1.select)({
            message: 'Select network:',
            choices: [
                { value: 'testnet', name: 'Testnet' },
                { value: 'mainnet', name: 'Mainnet' }
            ]
        });
        // Get wallet address
        const walletAddress = await (0, prompts_1.input)({
            message: 'Enter your Sui wallet address:',
            validate: (input) => input.length > 0
        });
        // Ask if user wants to store private key
        const shouldStoreKey = await (0, prompts_1.confirm)({
            message: 'Would you like to store your private key? (Not recommended for production)',
            default: false
        });
        let privateKey;
        if (shouldStoreKey) {
            privateKey = await (0, prompts_1.input)({
                message: 'Enter your private key:',
                transformer: (input) => '*'.repeat(input.length)
            });
        }
        // Save configuration
        const config = {
            network,
            walletAddress,
            privateKey
        };
        await config_service_1.configService.saveConfig(config);
        console.log(chalk_1.default.green('✔ Configuration saved successfully'));
        console.log(chalk_1.default.dim('Network:'), network);
        console.log(chalk_1.default.dim('Wallet Address:'), walletAddress);
    }
    catch (error) {
        console.error(chalk_1.default.red('Failed to save configuration:'), error);
        process.exit(1);
    }
}
