#!/usr/bin/env node

import { Command } from '@oclif/core';
import * as Commands from './commands';

export default class WalTodo extends Command {
  static description = 'A CLI for managing todos with Sui blockchain and Walrus storage';

  static examples = [
    '$ waltodo add -t "Buy groceries"',
    '$ waltodo list',
    '$ waltodo complete 123'
  ];

  static commandIds = Object.values(Commands)
    .map(command => typeof command === 'function' && command.prototype instanceof Command ? command : null)
    .filter(Boolean);

  async run(): Promise<void> {
    const { flags } = await this.parse(WalTodo);
    this.log(WalTodo.description);
    this.log('\nUsage:');
    this.log(WalTodo.examples.join('\n'));
  }
}

const run = async () => {
  const project = await import(require.resolve('../package.json'));
  await WalTodo.run(process.argv.slice(2));
};

if (require.main === module) {
  run().catch(require('@oclif/core/handle'));
}