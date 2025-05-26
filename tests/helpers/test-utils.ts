// import type { _Mock } from 'jest-mock';
import { StorageLocation, Todo } from '../../src/types/todo';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'path';

/**
 * Promisified version of child_process.exec for async/await usage
 */
const execPromise = promisify(exec);

/**
 * Utility type that makes all properties of a type optional and recursive
 *
 * @template T - The type to make partially optional
 * @example
 * ```typescript
 * interface User {
 *   id: string;
 *   profile: {
 *     name: string;
 *     age: number;
 *   };
 * }
 *
 * // Can be used like:
 * const partialUser: DeepPartial<User> = {
 *   profile: { name: 'John' } // age is optional
 * };
 * ```
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Creates a mock Todo object with default values that can be overridden
 *
 * @param overrides - Optional partial Todo properties to override default values
 * @returns A complete Todo object with default values for unspecified properties
 *
 * @example
 * ```typescript
 * // Create a basic todo with defaults
 * const basicTodo = createMockTodo();
 *
 * // Create a completed high priority todo
 * const completedTodo = createMockTodo({
 *   completed: true,
 *   priority: 'high',
 *   title: 'Completed high priority task'
 * });
 * ```
 */
export const createMockTodo = (overrides?: DeepPartial<Todo>): Todo => ({
  id: 'test-todo-id',
  title: 'Test Todo',
  description: '',
  completed: false,
  priority: 'medium',
  tags: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  private: true,
  storageLocation: 'local' as StorageLocation,
  ...overrides,
});

/**
 * Utility type that converts all methods of a class/interface into Jest mock functions
 * while preserving non-method properties.
 *
 * @template T - The type to create mocks for
 * @example
 * ```typescript
 * interface UserService {
 *   getUser(id: string): Promise<User>;
 *   isAdmin: boolean;
 * }
 *
 * // Usage:
 * const mockUserService: MockOf<UserService> = {
 *   getUser: jest.fn().mockResolvedValue({ id: '123', name: 'Test User' }),
 *   isAdmin: false
 * };
 * ```
 */
export type MockOf<T> = {
  [P in keyof T]: T[P] extends (...args: infer Args) => infer Return
    ? jest.Mock<Return, Args>
    : T[P];
};

/**
 * Utility service for testing command execution in both unit tests and integration tests.
 * This service provides a way to run CLI commands and capture their output.
 */
export class TestService {
  /**
   * Run a CLI command and return the output.
   * In test environment, this will mock the command execution.
   * In non-test environment, this will execute the actual CLI command.
   *
   * @param args - Array of command arguments (first element is the command name, remaining are options)
   * @returns Object containing stdout and stderr output strings
   * @throws Will throw an error if command execution fails
   *
   * @example
   * ```typescript
   * // Run 'list' command with '--all' flag
   * const result = await TestService.runCommand(['list', '--all']);
   * expect(result.stdout).toContain('Task list:');
   *
   * // Run 'add' command with title and description
   * const addResult = await TestService.runCommand([
   *   'add',
   *   '--title', 'New test todo',
   *   '--description', 'Testing add command'
   * ]);
   * ```
   */
  static async runCommand(
    args: string[]
  ): Promise<{ stdout: string; stderr: string }> {
    // Mock implementation for Jest tests
    if (process.env.NODE_ENV === 'test') {
      // This is simplified for testing purposes
      // In a real implementation, you would use oclif test utilities
      const command = args[0];

      // Dynamically import the command module
      const CommandClass = await import(`../../src/commands/${command}`);
      const instance = new CommandClass.default();

      // Mock stdout
      let stdout = '';
      instance.log = jest.fn().mockImplementation((msg: string) => {
        stdout += msg + '\n';
      });

      // Run the command with the remaining args
      await instance.run(args.slice(1));

      return { stdout, stderr: '' };
    }

    // Actual CLI execution for integration tests
    const projectRoot = path.resolve(__dirname, '../../');
    const cmd = `node ${projectRoot}/bin/run ${args.join(' ')}`;

    return execPromise(cmd);
  }
}
