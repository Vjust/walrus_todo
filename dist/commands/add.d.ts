import { Command } from '@oclif/core';
export default class AddCommand extends Command {
    static description: string;
    static examples: string[];
    static flags: {
        task: import("@oclif/core/lib/interfaces").OptionFlag<string[], import("@oclif/core/lib/interfaces/parser").CustomOptions>;
        priority: import("@oclif/core/lib/interfaces").OptionFlag<string, import("@oclif/core/lib/interfaces/parser").CustomOptions>;
        due: import("@oclif/core/lib/interfaces").OptionFlag<string | undefined, import("@oclif/core/lib/interfaces/parser").CustomOptions>;
        tags: import("@oclif/core/lib/interfaces").OptionFlag<string | undefined, import("@oclif/core/lib/interfaces/parser").CustomOptions>;
        private: import("@oclif/core/lib/interfaces").BooleanFlag<boolean>;
    };
    static args: {
        list: import("@oclif/core/lib/interfaces/parser").Arg<string, Record<string, unknown>>;
    };
    private todoService;
    private validateDate;
    run(): Promise<void>;
}
