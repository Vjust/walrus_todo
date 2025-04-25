"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sync = sync;
const chalk_1 = __importDefault(require("chalk"));
const sui_service_1 = require("../services/sui-service");
const walrus_service_1 = require("../services/walrus-service");
async function sync(options) {
    try {
        const { list } = options;
        // Get on-chain list state
        const onChainList = await sui_service_1.suiService.getListState(list);
        if (!onChainList) {
            console.error(chalk_1.default.red(`Todo list '${list}' not found on blockchain`));
            process.exit(1);
        }
        // Sync Walrus data with blockchain state
        await walrus_service_1.walrusService.syncWithBlockchain(list, onChainList);
        console.log(chalk_1.default.green('✔ List synchronized with blockchain state'));
        console.log(chalk_1.default.dim('List:'), list);
    }
    catch (error) {
        console.error(chalk_1.default.red('Failed to sync list:'), error);
        process.exit(1);
    }
}
