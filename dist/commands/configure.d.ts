/**
 * Configure Command Module
 * Handles wallet and blockchain connection setup
 * Manages authentication and encryption settings
 */
import { Command } from '@oclif/core';
export default class ConfigureCommand extends Command {
    static description: string;
    static examples: string[];
    static flags: {
        reset: import("@oclif/core/lib/interfaces").BooleanFlag<boolean>;
    };
    run(): Promise<void>;
}
