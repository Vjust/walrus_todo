import { Command } from '@oclif/core';
export default class CompleteCommand extends Command {
    static description: string;
    static examples: string[];
    static flags: {
        id: import("@oclif/core/lib/interfaces").OptionFlag<string, import("@oclif/core/lib/interfaces/parser").CustomOptions>;
    };
    static args: {
        list: import("@oclif/core/lib/interfaces/parser").Arg<string, Record<string, unknown>>;
    };
    private todoService;
    run(): Promise<void>;
}
