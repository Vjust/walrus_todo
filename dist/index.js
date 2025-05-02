#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const core_1 = require("@oclif/core");
const Commands = tslib_1.__importStar(require("./commands"));
class WalTodo extends core_1.Command {
    async run() {
        const { flags } = await this.parse(WalTodo);
        this.log(WalTodo.description);
        this.log('\nUsage:');
        this.log(WalTodo.examples.join('\n'));
    }
}
WalTodo.description = 'A CLI for managing todos with Sui blockchain and Walrus storage';
WalTodo.examples = [
    '$ waltodo add -t "Buy groceries"',
    '$ waltodo list',
    '$ waltodo complete 123'
];
WalTodo.commandIds = Object.values(Commands)
    .map(command => typeof command === 'function' && command.prototype instanceof core_1.Command ? command : null)
    .filter(Boolean);
exports.default = WalTodo;
const run = async () => {
    const project = await Promise.resolve(`${require.resolve('../package.json')}`).then(s => tslib_1.__importStar(require(s)));
    await WalTodo.run(process.argv.slice(2));
};
if (require.main === module) {
    run().catch(require('@oclif/core/handle'));
}
