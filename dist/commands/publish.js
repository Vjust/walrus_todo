"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publish = publish;
const chalk_1 = __importDefault(require("chalk"));
const sui_service_1 = require("../services/sui-service");
const walrus_service_1 = require("../services/walrus-service");
async function publish(options) {
    try {
        const { list } = options;
        const todoList = await walrus_service_1.walrusService.getTodoList(list);
        if (!todoList) {
            console.error(chalk_1.default.red(`Todo list '${list}' not found`));
            process.exit(1);
        }
        // Publish to blockchain - store only references
        await sui_service_1.suiService.publishList(list, todoList);
        console.log(chalk_1.default.green('✔ List published successfully to blockchain'));
        console.log(chalk_1.default.dim('List:'), list);
    }
    catch (error) {
        console.error(chalk_1.default.red('Failed to publish list:'), error);
        process.exit(1);
    }
}
