import { test } from '@oclif/test';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { TodoService } from '../../apps/cli/src/services/todoService';
import * as fs from 'fs';
import StoreCommand from '../../apps/cli/src/commands/store';

import * as walrusStorage from '../../apps/cli/src/utils/walrus-storage';
import * as performanceCache from '../../apps/cli/src/utils/performance-cache';
import { WalrusStorage } from '../../apps/cli/src/utils/walrus-storage';
import { PerformanceCache } from '../../apps/cli/src/utils/performance-cache';

describe('store command batch processing', () => {
  let sandbox: sinon.SinonSandbox;
  let todoServiceStub: sinon.SinonStubbedInstance<TodoService>;
  let walrusStorageStub: WalrusStorage;
  let cacheStub: PerformanceCache<unknown>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock TodoService
    todoServiceStub = sandbox.createStubInstance(TodoService);
    todoServiceStub.getList.resolves({
      name: 'test-list',
      todos: [
        { id: '1', title: 'Todo 1', completed: false },
        { id: '2', title: 'Todo 2', completed: false },
        { id: '3', title: 'Todo 3', completed: true },
        { id: '4', title: 'Todo 4', completed: false },
        { id: '5', title: 'Todo 5', completed: false },
      ],
    });
    todoServiceStub.updateTodo.resolves();

    // Mock Walrus storage
    walrusStorageStub = {
      connect: sandbox.stub().resolves(),
      disconnect: sandbox.stub().resolves(),
      storeTodo: sandbox.stub().resolves('mock-blob-id'),
    };
    sandbox
      .stub(walrusStorage, 'createWalrusStorage')
      .returns(walrusStorageStub);

    // Mock cache
    cacheStub = {
      get: sandbox.stub().resolves(null),
      set: sandbox.stub().resolves(),
      shutdown: sandbox.stub().resolves(),
    };
    sandbox.stub(performanceCache, 'createCache').returns(cacheStub);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('--all flag', () => {
    test
      .stdout()
      .stub(TodoService.prototype, 'getList', () => todoServiceStub.getList)
      .stub(
        TodoService.prototype,
        'updateTodo',
        () => todoServiceStub.updateTodo
      )
      .command(['store', '--all', '--list', 'test-list', '--mock'])
      .it('uploads all todos in batch', ctx => {
        expect(ctx.stdout).to.contain('Found 5 todo(s) to store');
        expect(ctx.stdout).to.contain('Starting batch upload of 5 todos');
        expect(ctx.stdout).to.contain('Batch Upload Summary');
        expect(ctx.stdout).to.contain('Total todos: 5');
        expect(ctx.stdout).to.contain('Successful: 5');
        expect(walrusStorageStub.storeTodo.callCount).to.equal(5);
      });

    test
      .stdout()
      .stub(TodoService.prototype, 'getList', () => todoServiceStub.getList)
      .stub(
        TodoService.prototype,
        'updateTodo',
        () => todoServiceStub.updateTodo
      )
      .command([
        'store',
        '--all',
        '--list',
        'test-list',
        '--batch-size',
        '2',
        '--mock',
      ])
      .it('respects batch size configuration', ctx => {
        expect(ctx.stdout).to.contain('Starting batch upload of 5 todos');
        expect(ctx.stdout).to.contain('Batch Upload Summary');
      });
  });

  describe('caching', () => {
    test
      .stdout()
      .stub(TodoService.prototype, 'getList', () => todoServiceStub.getList)
      .stub(
        TodoService.prototype,
        'updateTodo',
        () => todoServiceStub.updateTodo
      )
      .command(['store', '--todo', 'Todo 1', '--list', 'test-list', '--mock'])
      .it('caches uploaded todos', ctx => {
        expect(cacheStub.set.called).to.be.true;
        expect(ctx.stdout).to.contain('Todo stored successfully on Walrus');
      });

    test
      .stdout()
      .do(() => {
        // Simulate cache hit
        cacheStub.get.resolves('cached-blob-id');
      })
      .stub(TodoService.prototype, 'getList', () => todoServiceStub.getList)
      .stub(
        TodoService.prototype,
        'updateTodo',
        () => todoServiceStub.updateTodo
      )
      .command(['store', '--todo', 'Todo 1', '--list', 'test-list', '--mock'])
      .it('uses cached blob IDs when available', ctx => {
        expect(cacheStub.get.called).to.be.true;
        expect(walrusStorageStub.storeTodo.called).to.be.false;
        expect(ctx.stdout).to.contain('Using cached blob ID');
      });
  });

  describe('error handling', () => {
    test
      .stdout()
      .stderr()
      .do(() => {
        // Simulate some uploads failing
        walrusStorageStub.storeTodo
          .onCall(0)
          .resolves('blob-1')
          .onCall(1)
          .rejects(new Error('Upload failed'))
          .onCall(2)
          .resolves('blob-3')
          .onCall(3)
          .rejects(new Error('Network error'))
          .onCall(4)
          .resolves('blob-5');
      })
      .stub(TodoService.prototype, 'getList', () => todoServiceStub.getList)
      .stub(
        TodoService.prototype,
        'updateTodo',
        () => todoServiceStub.updateTodo
      )
      .command(['store', '--all', '--list', 'test-list', '--mock'])
      .it('reports failed uploads in batch summary', ctx => {
        expect(ctx.stdout).to.contain('Successful: 3');
        expect(ctx.stdout).to.contain('Failed: 2');
        expect(ctx.stdout).to.contain('Failed uploads:');
        expect(ctx.stdout).to.contain('Upload failed');
        expect(ctx.stdout).to.contain('Network error');
      });
  });

  describe('progress reporting', () => {
    test
      .stdout()
      .stub(TodoService.prototype, 'getList', () => todoServiceStub.getList)
      .stub(
        TodoService.prototype,
        'updateTodo',
        () => todoServiceStub.updateTodo
      )
      .command(['store', '--all', '--list', 'test-list', '--mock'])
      .it('shows progress during batch upload', ctx => {
        expect(ctx.stdout).to.contain('Progress:');
        expect(ctx.stdout).to.match(/\d+%/);
      });
  });

  describe('blob mapping saves', () => {
    test
      .stdout()
      .stub(TodoService.prototype, 'getList', () => todoServiceStub.getList)
      .stub(
        TodoService.prototype,
        'updateTodo',
        () => todoServiceStub.updateTodo
      )
      .do(() => {
        // Mock filesystem operations
        // Use imported fs module
        const fsStub = sandbox.stub(fs, 'existsSync');
        sandbox.stub(fs, 'writeFileSync');
        const fsReadStub = sandbox.stub(fs, 'readFileSync');

        // Mock existing config directory
        fsStub.withArgs(sinon.match(/\.config.*waltodo/)).returns(true);
        fsStub.withArgs(sinon.match(/blob-mappings\.json/)).returns(false);
        fsReadStub.returns('{}');

        // Mock BaseCommand methods
        // Use imported StoreCommand - cast to any for protected methods
        sandbox.spy(StoreCommand.prototype as unknown as { writeFileSafe: unknown }, 'writeFileSafe');
        sandbox.spy(StoreCommand.prototype as unknown as { getConfigDir: unknown }, 'getConfigDir');
      })
      .command(['store', '--todo', 'Todo 1', '--list', 'test-list', '--mock'])
      .it('calls writeFileSafe to save blob mappings', ctx => {
        // Use imported StoreCommand - cast to any for protected methods
        expect((StoreCommand.prototype as unknown as { writeFileSafe: { called: boolean } }).writeFileSafe.called).to.be.true;
        expect(ctx.stdout).to.contain('Todo stored successfully on Walrus');
      });
  });

  describe('validation', () => {
    test
      .stderr()
      .command(['store'])
      .exit(1)
      .it('requires either --todo or --all flag', ctx => {
        expect(ctx.stderr).to.contain(
          'Either --todo or --all must be specified'
        );
      });

    test
      .stderr()
      .command(['store', '--todo', 'test', '--all'])
      .exit(1)
      .it('prevents using both --todo and --all flags', ctx => {
        expect(ctx.stderr).to.contain('Cannot specify both --todo and --all');
      });

    test
      .stderr()
      .stub(TodoService.prototype, 'getList', () => todoServiceStub.getList)
      .do(() => {
        todoServiceStub.getList.resolves({ name: 'empty-list', todos: [] });
      })
      .command(['store', '--all', '--list', 'empty-list'])
      .exit(1)
      .it('errors when no todos are found with --all flag', ctx => {
        expect(ctx.stderr).to.contain('No todos found in list');
      });
  });
});
