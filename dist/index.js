#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const constants_1 = require("./constants");
const program = new commander_1.Command();
program
    .name(constants_1.CLI_CONFIG.APP_NAME)
    .description('A CLI todo application using Sui blockchain and Walrus storage')
    .version(constants_1.CLI_CONFIG.VERSION);
program
    .command('add')
    .description('Add a new todo item')
    .option('-l, --list <name>', 'name of the todo list')
    .option('-t, --task <description>', 'task description')
    .option('-p, --priority <level>', 'priority level (high|medium|low)')
    .option('-d, --due <date>', 'due date (YYYY-MM-DD)')
    .option('--tags <tags>', 'comma-separated tags')
    .option('--encrypt', 'encrypt this todo item using the Seal protocol')
    .option('--private', 'mark todo as private (stored locally only)')
    .action(async (options) => {
    try {
        const { add } = await Promise.resolve().then(() => __importStar(require('./commands/add')));
        await add(options);
    }
    catch (error) {
        console.error(chalk_1.default.red('Error adding todo:'), error);
    }
});
program
    .command('list')
    .description('List all todos')
    .option('-l, --list <name>', 'filter by list name')
    .option('--completed', 'show only completed items')
    .option('--pending', 'show only pending items')
    .option('--encrypted', 'show encrypted items (requires authentication)')
    .action(async (options) => {
    try {
        const { list } = await Promise.resolve().then(() => __importStar(require('./commands/list')));
        await list(options);
    }
    catch (error) {
        console.error(chalk_1.default.red('Error listing todos:'), error);
    }
});
program
    .command('update')
    .description('Update a todo item')
    .requiredOption('-l, --list <name>', 'name of the todo list')
    .requiredOption('-i, --id <id>', 'id of the todo')
    .option('-t, --task <description>', 'new task description')
    .option('-p, --priority <level>', 'new priority level (high|medium|low)')
    .option('-d, --due <date>', 'new due date (YYYY-MM-DD)')
    .option('--tags <tags>', 'new comma-separated tags')
    .action(async (options) => {
    try {
        const { update } = await Promise.resolve().then(() => __importStar(require('./commands/update')));
        await update(options);
    }
    catch (error) {
        console.error(chalk_1.default.red('Error updating todo:'), error);
    }
});
program
    .command('complete')
    .description('Mark a todo as complete')
    .requiredOption('-l, --list <name>', 'name of the todo list')
    .requiredOption('-i, --id <id>', 'id of the todo')
    .action(async (options) => {
    try {
        const { complete } = await Promise.resolve().then(() => __importStar(require('./commands/complete')));
        await complete(options);
    }
    catch (error) {
        console.error(chalk_1.default.red('Error completing todo:'), error);
    }
});
program
    .command('delete')
    .description('Delete a todo item')
    .requiredOption('-l, --list <name>', 'name of the todo list')
    .requiredOption('-i, --id <id>', 'id of the todo')
    .option('-f, --force', 'skip confirmation prompt')
    .action(async (options) => {
    try {
        const { deleteTodo } = await Promise.resolve().then(() => __importStar(require('./commands/delete')));
        await deleteTodo(options);
    }
    catch (error) {
        console.error(chalk_1.default.red('Error deleting todo:'), error);
    }
});
program
    .command('configure')
    .description('Configure blockchain connection and wallet settings')
    .action(async () => {
    try {
        const { configure } = await Promise.resolve().then(() => __importStar(require('./commands/configure')));
        await configure();
    }
    catch (error) {
        console.error(chalk_1.default.red('Error configuring:'), error);
    }
});
program
    .command('publish')
    .description('Publish list to blockchain')
    .requiredOption('-l, --list <name>', 'name of the todo list')
    .action(async (options) => {
    try {
        const { publish } = await Promise.resolve().then(() => __importStar(require('./commands/publish')));
        await publish(options);
    }
    catch (error) {
        console.error(chalk_1.default.red('Error publishing list:'), error);
    }
});
program
    .command('sync')
    .description('Sync with blockchain state')
    .requiredOption('-l, --list <name>', 'name of the todo list')
    .action(async (options) => {
    try {
        const { sync } = await Promise.resolve().then(() => __importStar(require('./commands/sync')));
        await sync(options);
    }
    catch (error) {
        console.error(chalk_1.default.red('Error syncing:'), error);
    }
});
program.parse();
