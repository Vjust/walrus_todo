#!/usr/bin/env node
"use strict";
/**
 * Main CLI Application Entry Point for Walrus Todo
 * =================================================
 *
 * This file serves as the primary entry point for the CLI application and establishes
 * the command-line interface using Commander.js. It defines the application's command
 * structure, options, and routes user input to the appropriate command handlers.
 *
 * Key responsibilities:
 * 1. Define the CLI program and its metadata
 * 2. Register all available commands with their options and descriptions
 * 3. Implement dynamic command loading via ES modules
 * 4. Handle errors at the command execution level
 * 5. Parse command-line arguments and execute the appropriate handlers
 */
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
/**
 * Initialize the main CLI program
 * Commander.js is used for parsing arguments, automatically generating help text,
 * and providing a structured way to define commands and their options.
 */
const program = new commander_1.Command();
/**
 * Set up basic CLI metadata
 * - name: The command name shown in help output
 * - description: High-level description of the CLI tool
 * - version: Current version, displayed with --version flag
 */
program
    .name(constants_1.CLI_CONFIG.APP_NAME)
    .description('A CLI todo application using Sui blockchain and Walrus storage')
    .version(constants_1.CLI_CONFIG.VERSION);
/**
 * Command: add
 * ---------------
 * Adds a new todo item with optional encryption and privacy settings.
 *
 * Implementation notes:
 * - Uses dynamic import to load the command handler only when needed
 * - Wraps execution in try/catch for error handling
 * - All options are passed to the command handler as a single object
 *
 * Options:
 * - list: Target todo list name
 * - task: Todo item description
 * - priority: Priority level (high/medium/low)
 * - due: Due date in YYYY-MM-DD format
 * - tags: Comma-separated tags
 * - encrypt: Enable Seal protocol encryption
 * - private: Store locally without blockchain sync
 */
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
        // Dynamic import avoids loading all command modules at startup
        // This improves performance for large applications
        const { add } = await Promise.resolve().then(() => __importStar(require('./commands/add')));
        await add(options);
    }
    catch (error) {
        console.error(chalk_1.default.red('Error adding todo:'), error);
    }
});
/**
 * Command: list
 * ---------------
 * Displays todos with various filtering options.
 *
 * Implementation notes:
 * - Provides multiple filtering mechanisms for user convenience
 * - Handles both local and blockchain-stored todos
 *
 * Options:
 * - list: Filter by specific list name
 * - completed: Show only completed items
 * - pending: Show only pending items
 * - encrypted: Show encrypted items (requires auth)
 */
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
/**
 * Command: update
 * ---------------
 * Updates existing todo items.
 *
 * Implementation notes:
 * - Uses requiredOption for mandatory parameters
 * - Only specified fields will be updated (partial updates)
 * - Handles both local and blockchain-stored todos
 *
 * Required Options:
 * - list: Todo list name
 * - id: Todo item identifier
 *
 * Optional Options:
 * - task: New description
 * - priority: New priority level
 * - due: New due date
 * - tags: New tags
 */
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
/**
 * Command: complete
 * ---------------
 * Marks a todo item as completed.
 *
 * Implementation notes:
 * - Simple command that only requires the list and todo identifier
 * - Updates the 'completed' status in both local storage and blockchain if applicable
 *
 * Required Options:
 * - list: Todo list name
 * - id: Todo item identifier
 */
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
/**
 * Command: delete
 * ---------------
 * Removes a todo item.
 *
 * Implementation notes:
 * - Includes a confirmation prompt for safety (unless --force is used)
 * - Handles deletion from both local storage and blockchain if applicable
 *
 * Required Options:
 * - list: Todo list name
 * - id: Todo item identifier
 *
 * Optional:
 * - force: Skip deletion confirmation prompt
 */
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
/**
 * Command: configure
 * ---------------
 * Sets up blockchain connection and wallet configuration.
 *
 * Implementation notes:
 * - Uses interactive prompts for better user experience
 * - Stores configuration securely for future CLI sessions
 * - Sets up the connection to Sui blockchain and Walrus storage
 *
 * No options required - fully interactive prompt-based
 */
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
/**
 * Command: publish
 * ---------------
 * Publishes a local todo list to the blockchain.
 *
 * Implementation notes:
 * - Handles the transfer of todo data from local storage to blockchain
 * - Uses Sui smart contracts for storing and managing todo lists
 * - Requires user to have previously configured blockchain connection details
 *
 * Required Options:
 * - list: Todo list name to publish
 */
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
/**
 * Command: sync
 * ---------------
 * Synchronizes local state with blockchain.
 *
 * Implementation notes:
 * - Bidirectional synchronization between local storage and blockchain
 * - Handles conflict resolution for divergent changes
 * - Updates local Walrus storage with blockchain data
 *
 * Required Options:
 * - list: Todo list name to sync
 */
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
/**
 * Parse and execute commands
 * This must be the last line in the file
 * Commander.js will read the process.argv array and route to the appropriate command handler
 * If no matching command is found, the help text will be displayed
 */
program.parse();
