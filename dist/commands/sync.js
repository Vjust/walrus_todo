"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const core_1 = require("@oclif/core");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const sui_service_1 = require("../services/sui-service");
const walrus_service_1 = require("../services/walrus-service");
const error_handler_1 = require("../utils/error-handler");
class SyncCommand extends core_1.Command {
    async run() {
        const { args, flags } = await this.parse(SyncCommand);
        try {
            console.log(chalk_1.default.blue('\nSyncing list:'), chalk_1.default.bold(args.listName));
            // Get on-chain list state
            const onChainList = await sui_service_1.suiService.getListState(args.listName);
            if (!onChainList) {
                throw new error_handler_1.CLIError(`List "${args.listName}" not found on blockchain`, 'INVALID_LIST');
            }
            // Get local list
            const localList = await walrus_service_1.walrusService.getTodoList(args.listName);
            if (!localList) {
                console.log(chalk_1.default.yellow('No local list found, creating from blockchain state...'));
            }
            else if (!flags.force && localList.version > onChainList.version) {
                throw new error_handler_1.CLIError('Local list is ahead of blockchain state. Use --force to override local changes.', 'SYNC_CONFLICT');
            }
            // Sync Walrus data with blockchain state
            await walrus_service_1.walrusService.syncWithBlockchain(args.listName, onChainList);
            console.log(chalk_1.default.green('\n✓ List synchronized with blockchain state'));
            console.log(chalk_1.default.dim('List:'), args.listName);
            console.log(chalk_1.default.dim('Version:'), onChainList.version);
            console.log(chalk_1.default.dim('Items:'), onChainList.todos.length);
            console.log(chalk_1.default.dim('Last synced:'), new Date().toISOString());
        }
        catch (error) {
            throw error;
        }
    }
}
SyncCommand.description = 'Synchronize local todo list with blockchain state';
SyncCommand.examples = [
    '<%= config.bin %> sync my-list',
    '<%= config.bin %> sync my-list --force'
];
SyncCommand.flags = {
    force: core_1.Flags.boolean({
        char: 'f',
        description: 'Force sync even if local changes exist',
        default: false
    })
};
SyncCommand.args = {
    listName: core_1.Args.string({
        name: 'listName',
        description: 'Name of the todo list to sync',
        required: true
    })
};
exports.default = SyncCommand;
