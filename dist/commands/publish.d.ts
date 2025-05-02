import { Command } from '@oclif/core';
export default class PublishCommand extends Command {
    static description: string;
    static examples: string[];
    static flags: {
        encrypt: import("@oclif/core/lib/interfaces").BooleanFlag<boolean>;
    };
    static args: {
        listName: import("@oclif/core/lib/interfaces/parser").Arg<string, Record<string, unknown>>;
    };
    run(): Promise<void>;
}
