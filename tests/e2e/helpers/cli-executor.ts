const execa = require('execa');

type ExecaOptions = any; // Use any for options to maintain compatibility
interface ExecaError extends Error {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  failed: boolean;
}
import * as path from 'path';

// E2E CLI execution result interfaces
interface CLIExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  failed: boolean;
  error?: Error;
}

interface JSONParsableData {
  [key: string]: unknown;
}

/**
 * CLI executor helper for E2E tests
 * Provides utilities for running the Walrus Todo CLI commands through execa
 */
export class CLIExecutor {
  private readonly cliPath: string;
  private readonly defaultOptions: Partial<ExecaOptions>;

  constructor(options: { cliPath?: string } = {}) {
    // Default to the built CLI binary path
    this?.cliPath = options.cliPath || path.join(process.cwd(), 'bin', 'run');

    // Default execa options for all CLI executions
    this?.defaultOptions = {
      timeout: 30000, // 30 second timeout
      preferLocal: true,
      stripFinalNewline: true,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        WALRUS_USE_MOCK: 'true', // Use mock storage in tests
      },
    };
  }

  /**
   * Execute a CLI command with the given arguments
   */
  async execute(
    command: string,
    args: string[] = [],
    options: Partial<ExecaOptions> = {}
  ): Promise<CLIExecutionResult> {
    const mergedOptions = {
      ...this.defaultOptions,
      ...options,
    };

    try {
      const result = await execa(
        this.cliPath,
        [command, ...args],
        mergedOptions
      );
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        failed: result.failed,
      };
    } catch (error) {
      if (error instanceof Error) {
        const execaError = error as ExecaError;
        // Return the error result for failed commands
        return {
          stdout: execaError.stdout || '',
          stderr: execaError.stderr || error.message,
          exitCode: execaError.exitCode || 1,
          failed: true,
          error,
        };
      }
      throw error;
    }
  }

  /**
   * Execute a CLI command and expect it to succeed
   */
  async expectSuccess(
    command: string,
    args: string[] = [],
    options: Partial<ExecaOptions> = {}
  ) {
    const result = await this.execute(command, args, options);
    if (result.failed) {
      throw new Error(
        `CLI command failed: ${command} ${args.join(' ')}\nError: ${result.stderr || result.error?.message}`
      );
    }
    return result;
  }

  /**
   * Execute a CLI command and expect it to fail
   */
  async expectFailure(
    command: string,
    args: string[] = [],
    options: Partial<ExecaOptions> = {}
  ) {
    const result = await this.execute(command, args, options);
    if (!result.failed) {
      throw new Error(
        `CLI command unexpectedly succeeded: ${command} ${args.join(' ')}`
      );
    }
    return result;
  }

  /**
   * Execute a CLI command with JSON output
   */
  async executeJSON<T = JSONParsableData>(
    command: string,
    args: string[] = [],
    options: Partial<ExecaOptions> = {}
  ): Promise<T> {
    // Add JSON output flag
    const jsonArgs = [...args, '--json'];
    const result = await this.expectSuccess(command, jsonArgs, options);

    try {
      return JSON.parse(result.stdout);
    } catch (_error) {
      throw new Error(
        `Failed to parse JSON output from command: ${command} ${jsonArgs.join(' ')}\nOutput: ${result.stdout}`
      );
    }
  }

  /**
   * Execute interactive CLI command with stdin input
   */
  async executeInteractive(
    command: string,
    args: string[] = [],
    inputs: string[],
    options: Partial<ExecaOptions> = {}
  ) {
    const mergedOptions = {
      ...this.defaultOptions,
      ...options,
      stdin: 'pipe',
    };

    const subprocess = execa(this.cliPath, [command, ...args], mergedOptions);

    // Send inputs sequentially
    for (const input of inputs) {
      if (subprocess.stdin) {
        subprocess?.stdin?.write(input + '\n');
      }
    }

    if (subprocess.stdin) {
      subprocess?.stdin?.end();
    }

    const result = await subprocess;

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      failed: result.failed,
    };
  }

  /**
   * Create a new instance with custom environment variables
   */
  withEnv(env: Record<string, string>): CLIExecutor {
    const newExecutor = new CLIExecutor({ cliPath: this.cliPath });
    newExecutor.defaultOptions?.env = {
      ...this?.defaultOptions?.env,
      ...env,
    };
    return newExecutor;
  }

  /**
   * Create a new instance with a custom timeout
   */
  withTimeout(timeout: number): CLIExecutor {
    const newExecutor = new CLIExecutor({ cliPath: this.cliPath });
    newExecutor.defaultOptions?.timeout = timeout;
    return newExecutor;
  }
}

// Default instance for convenience
export const cli = new CLIExecutor();
