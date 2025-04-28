"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const core_1 = require("@oclif/core");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const sui_service_1 = require("../services/sui-service");
const walrus_service_1 = require("../services/walrus-service");
const error_handler_1 = require("../utils/error-handler");
class PublishCommand extends core_1.Command {
    async run() {
        const { args, flags } = await this.parse(PublishCommand);
        try {
            const list = await walrus_service_1.walrusService.getTodoList(args.listName);
            if (!list) {
                throw new error_handler_1.CLIError(`List "${args.listName}" not found`, 'INVALID_LIST');
            }
            console.log(chalk_1.default.blue('\nPublishing list to blockchain:'), chalk_1.default.bold(args.listName));
            if (flags.encrypt) {
                console.log(chalk_1.default.dim('Encryption enabled'));
                // TODO: Implement encryption
            }
            // Publish to blockchain
            const tx = await sui_service_1.suiService.publishList(args.listName, list);
            console.log(chalk_1.default.green('\n✓ List published successfully'));
            console.log(chalk_1.default.dim('Transaction Hash:'), tx.digest);
            console.log(chalk_1.default.dim('Items:'), list.todos.length);
            console.log(chalk_1.default.dim('Gas used:'), tx.effects.gasUsed.computationCost);
        }
        catch (error) {
            throw error;
        }
    }
}
PublishCommand.description = 'Publish a todo list to the blockchain';
PublishCommand.examples = [
    '<%= config.bin %> publish my-list',
    '<%= config.bin %> publish my-list --encrypt'
];
PublishCommand.flags = {
    encrypt: core_1.Flags.boolean({
        char: 'e',
        description: 'Encrypt list data before publishing',
        default: false
    })
};
PublishCommand.args = {
    listName: core_1.Args.string({
        name: 'listName',
        description: 'Name of the todo list to publish',
        required: true
    })
};
exports.default = PublishCommand;
