import { Command } from '@oclif/core';
export default class ListCommand extends Command {
    static description: string;
    static examples: string[];
    static flags: {
        completed: import("@oclif/core/lib/interfaces").BooleanFlag<boolean>;
        pending: import("@oclif/core/lib/interfaces").BooleanFlag<boolean>;
    };
    static args: {
        listName: import("@oclif/core/lib/interfaces").Arg<string | undefined, Record<string, unknown>>;
    };
    run(): Promise<void>;
}
