import { Command } from '@oclif/core';
export default class ConfigureCommand extends Command {
    static description: string;
    static examples: string[];
    static flags: {
        reset: import("@oclif/core/lib/interfaces").BooleanFlag<boolean>;
    };
    private validateUserIdentifier;
    run(): Promise<void>;
}
