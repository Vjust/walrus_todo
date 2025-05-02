"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const core_1 = require("@oclif/core");
const prompts_1 = require("@inquirer/prompts");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const config_service_1 = require("../services/config-service");
const error_1 = require("../types/error");
class ConfigureCommand extends core_1.Command {
    validateUserIdentifier(userId) {
        return userId.trim().length > 0;
    }
    async run() {
        try {
            const { flags } = await this.parse(ConfigureCommand);
            if (flags.reset) {
                await config_service_1.configService.saveConfig({
                    network: 'local',
                    walletAddress: '',
                    encryptedStorage: false
                });
                this.log(chalk_1.default.green('✓ Configuration reset to defaults'));
                return;
            }
            const userId = await (0, prompts_1.input)({
                message: 'Enter your user identifier:',
            });
            if (!this.validateUserIdentifier(userId)) {
                throw new error_1.CLIError('Invalid user identifier format', 'INVALID_USER_ID');
            }
            const encryptedStorage = await (0, prompts_1.confirm)({
                message: 'Enable encryption for sensitive data?',
                default: true
            });
            await config_service_1.configService.saveConfig({
                network: 'local',
                walletAddress: userId,
                encryptedStorage
            });
            this.log(chalk_1.default.green('\n✓ Configuration saved successfully'));
            this.log(chalk_1.default.dim('User ID:'), userId);
            this.log(chalk_1.default.dim('Encryption:'), encryptedStorage ? 'Enabled' : 'Disabled');
        }
        catch (error) {
            if (error instanceof error_1.CLIError) {
                throw error;
            }
            throw new error_1.CLIError(`Configuration failed: ${error instanceof Error ? error.message : String(error)}`, 'CONFIG_FAILED');
        }
    }
}
ConfigureCommand.description = 'Configure CLI settings';
ConfigureCommand.examples = [
    '<%= config.bin %> configure',
    '<%= config.bin %> configure --reset'
];
ConfigureCommand.flags = {
    reset: core_1.Flags.boolean({
        char: 'r',
        description: 'Reset all settings to defaults',
        default: false
    })
};
exports.default = ConfigureCommand;
