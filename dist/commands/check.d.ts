/**
 * Check Command Module
 * Toggles completion status of todo items
 * Supports both local and Walrus-stored items
 */
import { Command } from '@oclif/core';
export default class CheckCommand extends Command {
    static description: string;
    static examples: string[];
    static flags: {
        id: import("@oclif/core/lib/interfaces").OptionFlag<string, import("@oclif/core/lib/interfaces/parser").CustomOptions>;
        uncheck: import("@oclif/core/lib/interfaces").BooleanFlag<boolean>;
    };
    static args: {
        listName: import("@oclif/core/lib/interfaces/parser").Arg<string, Record<string, unknown>>;
    };
    run(): Promise<void>;
}
