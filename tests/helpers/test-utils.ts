import type { Mock } from 'jest-mock';
import { StorageLocation, Todo } from '../../src/types/todo';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execPromise = promisify(exec);

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
  ...overrides
});

export type MockOf<T> = {
  [P in keyof T]: T[P] extends (...args: any[]) => any
    ? jest.Mock<ReturnType<T[P]>, Parameters<T[P]>>
    : T[P];
};

/**
 * Utility service for testing command execution
 */
export class TestService {
  /**
   * Run a CLI command and return the output
   * 
   * @param args Command arguments
   * @returns The command output (stdout and stderr)
   */
  static async runCommand(args: string[]): Promise<{ stdout: string; stderr: string }> {
    // Mock implementation for Jest tests
    if (process.env.NODE_ENV === 'test') {
      // This is simplified for testing purposes
      // In a real implementation, you would use oclif test utilities
      const command = args[0];
      
      try {
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
      } catch (error) {
        throw error;
      }
    }
    
    // Actual CLI execution for integration tests
    const projectRoot = path.resolve(__dirname, '../../');
    const cmd = `node ${projectRoot}/bin/run ${args.join(' ')}`;
    
    return execPromise(cmd);
  }
}