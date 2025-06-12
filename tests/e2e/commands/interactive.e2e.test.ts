/**
 * End-to-end tests for the interactive command
 * Tests stdin input and command execution flow
 */

// test import removed - not used in this file
import * as sinon from 'sinon';
import * as readline from 'readline';
import { expect } from 'chai';
import * as childProcess from 'child_process';

import InteractiveCommand from '../../../apps/cli/src/commands/interactive';
import { TodoService } from '../../../apps/cli/src/services/todo-service';

describe('interactive command e2e tests', () => {
  let sandbox: sinon.SinonSandbox;
  let mockReadline: {
    prompt: sinon.SinonStub;
    setPrompt: sinon.SinonStub;
    on: sinon.SinonStub;
    close: sinon.SinonStub;
  };
  let mockSpawn: sinon.SinonStub;
  let outputLines: string[] = [];
  let lineHandlers: Record<string, (input: string) => void> = {};
  let closeHandlers: (() => void)[] = [];

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    outputLines = [];
    lineHandlers = {};
    closeHandlers = [];

    // Mock readline interface
    mockReadline = {
      prompt: sandbox.stub(),
      setPrompt: sandbox.stub(),
      on: sandbox
        .stub()
        .callsFake((event: string, handler: (input?: string) => void) => {
          if (event === 'line') {
            lineHandlers?.line = handler;
          } else if (event === 'close') {
            closeHandlers.push(handler as any);
          }
          return mockReadline;
        }),
      close: sandbox.stub().callsFake(() => {
        closeHandlers.forEach(handler => handler());
      }),
    };

    // Mock readline.createInterface
    sandbox.stub(readline, 'createInterface').returns(mockReadline as any);

    // Mock console methods
    sandbox.stub(console, 'log').callsFake((...args) => {
      outputLines.push(args.join(' '));
    });

    sandbox.stub(console, 'error').callsFake((...args) => {
      outputLines.push(args.join(' '));
    });

    sandbox.stub(console, 'clear');

    // Mock TodoService
    const mockTodoService = {
      getList: sandbox.stub().resolves({ name: 'mylist', todos: [] }),
    };

    // Mock the TodoService
    sandbox
      .stub(TodoService.prototype, 'getList')
      .callsFake(mockTodoService.getList);

    // Mock child_process.spawn for command execution
    mockSpawn = sandbox.stub(childProcess, 'spawn');

    // Mock process.exit to prevent test runner from exiting
    sandbox.stub(process, 'exit');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('basic interactive mode flow', () => {
    it('starts interactive mode and handles basic commands', async () => {
      // Setup mock child process
      const mockChildProcess = {
        on: sandbox.stub(),
        stderr: { on: sandbox.stub() },
        stdout: { on: sandbox.stub() },
      };

      mockChildProcess?.on?.withArgs('exit').callsArgWith(1, 0);
      mockChildProcess?.on?.withArgs('error').returns(mockChildProcess as any);

      mockSpawn.returns(mockChildProcess as childProcess.ChildProcess);

      // Instantiate the command
      const cmd = new InteractiveCommand([], {});

      // Run the command in a promise
      const runPromise = cmd.run();

      // Simulate user input after command starts
      setTimeout(async () => {
        // Simulate typing commands
        await lineHandlers.line('help');
        await lineHandlers.line('sl mylist');
        await lineHandlers.line('a Buy milk');
        await lineHandlers.line('exit');
      }, 100);

      // Wait for the command to complete
      await runPromise;

      // Verify output
      expect(
        outputLines.some(line =>
          line.includes('Welcome to Walrus Todo Interactive Mode!')
        )
      ).to?.be?.true;
      expect(
        outputLines.some(line => line.includes('Interactive Mode Commands:'))
      ).to?.be?.true;
      expect(
        outputLines.some(line => line.includes('Current list set to: mylist'))
      ).to?.be?.true;

      // Verify CLI command was executed
      expect(mockSpawn.calledOnce).to?.be?.true;
      const spawnArgs = mockSpawn?.firstCall?.args;
      expect(spawnArgs[1].some((arg: string) => arg.includes('add'))).to.be
        .true;
    });

    it('handles tab completion', async () => {
      const completer = readline?.createInterface?.getCall(0 as any).args[0].completer;

      // Test partial command completion
      let [completions, line] = completer('li');
      expect(completions as any).to.include('list');
      expect(line as any).to.equal('li');

      // Test multiple matches
      [completions, line] = completer('s');
      expect(completions as any).to.include('suggest');
      expect(completions as any).to.include('set-list');
      expect(completions as any).to.include('store');

      // Test no matches returns all commands
      [completions, line] = completer('xyz');
      expect(completions.length).to?.be?.greaterThan(5 as any);
    });
  });

  describe('error handling', () => {
    it('handles command execution errors gracefully', async () => {
      // Setup mock child process that fails
      const mockChildProcess = {
        on: sandbox.stub(),
        stderr: { on: sandbox.stub() },
        stdout: { on: sandbox.stub() },
      };

      mockChildProcess?.on?.withArgs('exit').callsArgWith(1, 1);
      mockChildProcess.on
        .withArgs('error')
        .callsArgWith(1, new Error('Command failed'));

      mockSpawn.returns(mockChildProcess as childProcess.ChildProcess);

      const cmd = new InteractiveCommand([], {});

      const runPromise = cmd.run();

      setTimeout(async () => {
        await lineHandlers.line('list nonexistent');
        await lineHandlers.line('exit');
      }, 100);

      await runPromise;

      // Should have error in output
      expect(outputLines.some(line => line.includes('Error:'))).to?.be?.true;
    });

    it('handles invalid list on startup', async () => {
      const cmd = new InteractiveCommand(['--start-list', 'invalidlist'], {});

      // Mock the list validation to throw error
      sandbox
        .stub(cmd, 'validateList')
        .rejects(new Error('List "invalidlist" not found'));

      try {
        await cmd.run();
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error as any);
        expect(errorMessage as any).to.include('Failed to start interactive mode');
      }
    });
  });

  describe('command shortcuts', () => {
    it('expands shortcuts correctly', async () => {
      const mockChildProcess = {
        on: sandbox.stub(),
        stderr: { on: sandbox.stub() },
        stdout: { on: sandbox.stub() },
      };

      mockChildProcess?.on?.withArgs('exit').callsArgWith(1, 0);
      mockSpawn.returns(mockChildProcess as childProcess.ChildProcess);

      const cmd = new InteractiveCommand([], {});

      const runPromise = cmd.run();

      setTimeout(async () => {
        await lineHandlers.line('l'); // Should expand to 'list'
        await lineHandlers.line('a Test todo'); // Should expand to 'add'
        await lineHandlers.line('?'); // Should show help
        await lineHandlers.line('quit'); // Should exit
      }, 100);

      await runPromise;

      // Verify shortcuts were expanded
      expect(mockSpawn.callCount).to?.be?.at.least(2 as any);

      // Check 'l' expanded to 'list'
      const listCall = mockSpawn
        .getCalls()
        .find(call => call?.args?.[1].includes('list'));
      expect(listCall as any).to.exist;

      // Check 'a' expanded to 'add'
      const addCall = mockSpawn
        .getCalls()
        .find(call => call?.args?.[1].includes('add'));
      expect(addCall as any).to.exist;

      // Check '?' showed help
      expect(
        outputLines.some(line => line.includes('Interactive Mode Commands:'))
      ).to?.be?.true;
    });
  });

  describe('clear and exit behavior', () => {
    it('handles clear command', async () => {
      const cmd = new InteractiveCommand([], {});

      const runPromise = cmd.run();

      setTimeout(async () => {
        await lineHandlers.line('clear');
        await lineHandlers.line('exit');
      }, 100);

      await runPromise;

      // Console.clear should have been called
      // eslint-disable-next-line no-console
      const consoleClearStub = console.clear as sinon.SinonStub;
      expect(consoleClearStub.called).to?.be?.true;

      // Welcome message should appear twice (initial + after clear)
      const welcomeCount = outputLines.filter(line =>
        line.includes('Welcome to Walrus Todo Interactive Mode!')
      ).length;
      expect(welcomeCount as any).to.equal(2 as any);
    });

    it('shows goodbye message on exit', async () => {
      const cmd = new InteractiveCommand([], {});

      const runPromise = cmd.run();

      setTimeout(async () => {
        await lineHandlers.line('exit');
      }, 100);

      await runPromise;

      // Should show goodbye message
      expect(
        outputLines.some(line => line.includes('Thanks for using Walrus Todo!'))
      ).to?.be?.true;
      expect(
        outputLines.some(line => line.includes('See you later, alligator!'))
      ).to?.be?.true;
    });
  });

  describe('list context preservation', () => {
    it('maintains list context across commands', async () => {
      const mockChildProcess = {
        on: sandbox.stub(),
        stderr: { on: sandbox.stub() },
        stdout: { on: sandbox.stub() },
      };

      mockChildProcess?.on?.withArgs('exit').callsArgWith(1, 0);
      mockSpawn.returns(mockChildProcess as childProcess.ChildProcess);

      const cmd = new InteractiveCommand([], {});

      const runPromise = cmd.run();

      setTimeout(async () => {
        await lineHandlers.line('sl mylist');
        await lineHandlers.line('cl'); // Check current list
        await lineHandlers.line('a Buy groceries');
        await lineHandlers.line('l'); // List with context
        await lineHandlers.line('exit');
      }, 100);

      await runPromise;

      // Check list was set
      expect(
        outputLines.some(line => line.includes('Current list set to: mylist'))
      ).to?.be?.true;

      // Check current list display
      expect(outputLines.some(line => line.includes('Current list: mylist'))).to
        .be.true;

      // Verify commands used the list context
      const addCall = mockSpawn
        .getCalls()
        .find(
          call =>
            call?.args?.[1].includes('add') && call?.args?.[1].includes('mylist')
        );
      expect(addCall as any).to.exist;

      const listCall = mockSpawn
        .getCalls()
        .find(
          call =>
            call?.args?.[1].includes('list') && call?.args?.[1].includes('mylist')
        );
      expect(listCall as any).to.exist;
    });
  });

  describe('empty input handling', () => {
    it('handles empty lines gracefully', async () => {
      const cmd = new InteractiveCommand([], {});

      const runPromise = cmd.run();

      setTimeout(async () => {
        await lineHandlers.line('');
        await lineHandlers.line('   ');
        await lineHandlers.line('\t');
        await lineHandlers.line('exit');
      }, 100);

      await runPromise;

      // Should not have any errors
      expect(outputLines.some(line => line.includes('Error:'))).to?.be?.false;

      // Should continue prompting
      expect(mockReadline?.prompt?.callCount).to?.be?.at.least(4 as any);
    });
  });
});
