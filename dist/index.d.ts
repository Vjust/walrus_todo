#!/usr/bin/env node
import { Command } from '@oclif/core';
import * as Commands from './commands';
export default class WalTodo extends Command {
    static description: string;
    static examples: string[];
    static commandIds: (typeof Commands.SimpleCommand | null)[];
    run(): Promise<void>;
}
