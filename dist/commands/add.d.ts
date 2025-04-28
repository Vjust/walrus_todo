import { Command } from '@oclif/core';
export default class AddCommand extends Command {
    static description: string;
    static examples: string[];
    static flags: {
        task: import("@oclif/core/lib/interfaces").OptionFlag<string[], import("@oclif/core/lib/interfaces").CustomOptions>;
        priority: import("@oclif/core/lib/interfaces").OptionFlag<string, import("@oclif/core/lib/interfaces").CustomOptions>;
        due: import("@oclif/core/lib/interfaces").OptionFlag<string | undefined, import("@oclif/core/lib/interfaces").CustomOptions>;
        tags: import("@oclif/core/lib/interfaces").OptionFlag<string | undefined, import("@oclif/core/lib/interfaces").CustomOptions>;
        private: import("@oclif/core/lib/interfaces").BooleanFlag<boolean>;
    };
    static args: {
        listName: import("@oclif/core/lib/interfaces").Arg<string, Record<string, unknown>>;
    };
    run(): Promise<void>;
}
