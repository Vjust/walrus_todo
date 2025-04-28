"use strict";
/**
 * Configure Command Module
 * Handles wallet and blockchain connection setup
 * Manages authentication and encryption settings
 */
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const core_1 = require("@oclif/core");
const prompts_1 = require("@inquirer/prompts");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const config_service_1 = require("../services/config-service");
const constants_1 = require("../constants");
class ConfigureCommand extends core_1.Command {
    async run() {
        const { flags } = await this.parse(ConfigureCommand);
        try {
            if (flags.reset) {
                await config_service_1.configService.saveConfig({
                    network: 'testnet',
                    walletAddress: '',
                    encryptedStorage: false
                });
                console.log(chalk_1.default.green('✓ Configuration reset to defaults'));
                return;
            }
            const network = await (0, prompts_1.select)({
                message: 'Select network:',
                choices: constants_1.SUPPORTED_NETWORKS.map(n => ({ name: n, value: n }))
            });
            const walletAddress = await (0, prompts_1.input)({
                message: 'Enter your wallet address:',
            });
            const encryptedStorage = await (0, prompts_1.confirm)({
                message: 'Enable encryption for sensitive data?',
                default: true
            });
            await config_service_1.configService.saveConfig({
                network,
                walletAddress,
                encryptedStorage
            });
            console.log(chalk_1.default.green('\n✓ Configuration saved successfully'));
            console.log(chalk_1.default.dim('Network:'), network);
            console.log(chalk_1.default.dim('Wallet:'), walletAddress);
            console.log(chalk_1.default.dim('Encryption:'), encryptedStorage ? 'Enabled' : 'Disabled');
        }
        catch (error) {
            console.error(chalk_1.default.red('Configuration failed:'), error);
            this.exit(1);
        }
    }
}
ConfigureCommand.description = 'Configure wallet and blockchain settings';
ConfigureCommand.examples = [
    '<%= config.bin %> configure'
];
ConfigureCommand.flags = {
    reset: core_1.Flags.boolean({
        char: 'r',
        description: 'Reset all settings to defaults',
        default: false
    })
};
exports.default = ConfigureCommand;
