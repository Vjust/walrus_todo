import { StorageLocation, Todo } from '../../types/todo';
import { run } from '../../index';
import * as childProcess from 'child_process';
import * as path from 'path';

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export const createMockTodo = (overrides?: DeepPartial<Todo>): Todo => ({
  id: 'test-todo-id',
  title: 'Test Todo',
  description: '',
  completed: false,
  priority: 'medium',
  tags: [] as string[],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  private: true,
  storageLocation: 'local' as StorageLocation,
  ...overrides,
});

export type MockOf<T> = {
  [P in keyof T]: T[P] extends (...args: any[]) => any
    ? jest.Mock<ReturnType<T[P]>, Parameters<T[P]>>
    : T[P];
};

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: Error;
}

// Functions are already exported below, so no need for this line

/**
 * Execute a CLI command directly from the src/index.ts implementation
 * This allows E2E tests to run commands without spawning a child process
 *
 * @param command The command to run (e.g. 'add', 'list')
 * @param args Array of arguments to pass to the command
 * @param options Additional options for command execution
 * @returns Promise that resolves with command execution result
 */
export async function runCommand(
  command: string,
  _args: string[] = [],
  options: {
    env?: NodeJS.ProcessEnv;
    mockStdout?: boolean;
    mockStderr?: boolean;
    timeout?: number;
  } = {}
): Promise<CommandResult> {
  const {
    env = {},
    mockStdout = true,
    mockStderr = true,
    timeout = 5000,
  } = options;

  // Setup environment variables for test
  const originalEnv = { ...process.env };
  const testEnv = {
    ...process.env,
    NODE_ENV: 'test',
    WALRUS_USE_MOCK: 'true', // Always use mock mode in tests
    ...env,
  };

  // Capture console output
  let stdout = '';
  let stderr = '';

  // Save original console methods
  // eslint-disable-next-line no-console
  const originalConsoleLog = console.log;
  // eslint-disable-next-line no-console
  const originalConsoleError = console.error;
  const originalProcessExit = process.exit;

  if (mockStdout) {
    // eslint-disable-next-line no-console
    console.log = (...args: any[]) => {
      // Capture stdout
      stdout += args.map(arg => String(arg)).join(' ') + '\n';
    };
  }

  if (mockStderr) {
    // eslint-disable-next-line no-console
    console.error = (...args: any[]) => {
      // Capture stderr
      stderr += args.map(arg => String(arg)).join(' ') + '\n';
    };
  }

  // Mock process.exit to prevent test from exiting but execute cleanup first
  let exitCode = 0;
  // Create a custom exit handler that will be called when process.exit is invoked
  const handleExit = (code: number = 0) => {
    exitCode = code;

    // Restore all original methods immediately to ensure cleanup hooks run
    // eslint-disable-next-line no-console
    if (mockStdout) console.log = originalConsoleLog;
    // eslint-disable-next-line no-console
    if (mockStderr) console.error = originalConsoleError;

    // Allow any cleanup or finally blocks to execute before throwing
    // By delaying the error throw via setTimeout, we ensure the current execution
    // context completes, allowing cleanup handlers to run
    setTimeout(() => {
      throw new Error(`EXIT_CODE_${code}`);
    }, 0);

    // Return a never-resolving promise to prevent further code execution
    return new Promise<never>(() => {});
  };

  process.exit = handleExit as any;

  let error: Error | undefined;

  // Set test environment
  Object.keys(testEnv).forEach(key => {
    process.env[key] = testEnv[key];
  });

  try {
    // Run with timeout
    await Promise.race([
      run().catch(err => {
        // Catch non-exit errors
        if (!err.message?.startsWith('EXIT_CODE_')) {
          error = err;
        }
      }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Command execution timed out')),
          timeout
        )
      ),
    ]);
  } catch (err) {
    // Ignore expected exit code errors
    if (err instanceof Error && !err.message.startsWith('EXIT_CODE_')) {
      error = err;
    }
  } finally {
    // Restore environment
    Object.keys(process.env).forEach(key => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    });

    // Ensure process.exit is restored
    process.exit = originalProcessExit;
  }

  return {
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    exitCode,
    error,
  };
}

/**
 * Execute a CLI command in a child process for more isolated testing
 *
 * @param command The command to run
 * @param args Array of arguments to pass to the command
 * @param options Additional options for command execution
 * @returns Promise that resolves with command execution result
 */
export async function runCommandInProcess(
  command: string,
  args: string[] = [],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeout?: number;
  } = {}
): Promise<CommandResult> {
  const { cwd = process.cwd(), env = {}, timeout = 10000 } = options;

  // Run CLI in separate process for more isolation
  const cliPath = path.join(process.cwd(), 'bin', 'run');

  return new Promise(resolve => {
    let stdout = '';
    let stderr = '';
    let error: Error | undefined;

    // Execute child process
    const child = childProcess.spawn(cliPath, [command, ...args], {
      cwd,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        WALRUS_USE_MOCK: 'true',
        ...env,
      },
      timeout,
    });

    // Collect output
    child.stdout.on('data', data => {
      stdout += data.toString();
    });

    child.stderr.on('data', data => {
      stderr += data.toString();
    });

    // Handle completion
    child.on('close', code => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? 0,
        error,
      });
    });

    // Handle errors
    child.on('error', err => {
      error = err;
    });
  });
}
