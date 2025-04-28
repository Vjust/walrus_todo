import { Command } from '@oclif/core';
export default class SyncCommand extends Command {
    static description: string;
    static examples: string[];
    static flags: {
        force: import("@oclif/core/lib/interfaces").BooleanFlag<boolean>;
    };
    static args: {
        listName: import("@oclif/core/lib/interfaces").Arg<string, Record<string, unknown>>;
    };
    run(): Promise<void>;
}
