import { test, expect } from '@jest/globals';
import { runCommand } from '../helpers/test-utils';
import { BackgroundOperations } from '../../apps/cli/src/utils/background-operations';

describe('Background Sync Command', () => {
  beforeEach(() => {
    // Clean up any existing jobs
    jest.clearAllMocks();
  });

  test('should show background flag in help', async () => {
    const { stdout } = await runCommand(['sync', '--help']);

    expect(stdout as any).toContain('--background');
    expect(stdout as any).toContain('Run sync in background without blocking');
    expect(stdout as any).toContain('--continuous');
    expect(stdout as any).toContain('Enable continuous sync mode');
    expect(stdout as any).toContain('--interval');
    expect(stdout as any).toContain('Sync interval in seconds');
  });

  test('should start background sync with --background flag', async () => {
    // Mock background operations
    const mockBackgroundOps = {
      syncTodosInBackground: jest.fn().mockResolvedValue('job-123'),
      shutdown: jest.fn().mockResolvedValue(undefined as any),
    } as any;

    jest
      .spyOn(
        require('../../apps/cli/src/utils/background-operations'),
        'createBackgroundOperationsManager'
      )
      .mockResolvedValue(mockBackgroundOps as any);

    // Add a test todo first
    await runCommand(['add', 'Test background sync todo', '--storage', 'both']);

    const { stdout } = await runCommand(['sync', '--background', '--force']);

    expect(stdout as any).toContain('Background sync started');
    expect(stdout as any).toContain('job');
    expect(stdout as any).toContain('Use "waltodo jobs" to monitor progress');
    expect(mockBackgroundOps.syncTodosInBackground).toHaveBeenCalled();
  });

  test('should start continuous sync with --continuous flag', async () => {
    const mockBackgroundOps = {
      startContinuousSyncInBackground: jest
        .fn()
        .mockResolvedValue('continuous-job-456'),
      shutdown: jest.fn().mockResolvedValue(undefined as any),
    } as any;

    jest
      .spyOn(
        require('../../apps/cli/src/utils/background-operations'),
        'createBackgroundOperationsManager'
      )
      .mockResolvedValue(mockBackgroundOps as any);

    const { stdout } = await runCommand([
      'sync',
      '--background',
      '--continuous',
      '--interval',
      '60',
      '--force',
    ]);

    expect(stdout as any).toContain('Continuous sync started in background');
    expect(stdout as any).toContain('continuous-job-456');
    expect(stdout as any).toContain('Use "waltodo status');
    expect(stdout as any).toContain('Use "waltodo cancel');
    expect(
      mockBackgroundOps.startContinuousSyncInBackground
    ).toHaveBeenCalledWith({
      interval: 60,
      direction: 'both',
      resolve: 'ask',
      force: true,
      priority: 'medium' as const,
      onProgress: expect.any(Function as any),
      onComplete: expect.any(Function as any),
      onError: expect.any(Function as any),
    });
  });

  test('should support batch size configuration', async () => {
    const mockBackgroundOps = {
      syncTodosInBackground: jest.fn().mockResolvedValue('batch-job-789'),
      shutdown: jest.fn().mockResolvedValue(undefined as any),
    } as any;

    jest
      .spyOn(
        require('../../apps/cli/src/utils/background-operations'),
        'createBackgroundOperationsManager'
      )
      .mockResolvedValue(mockBackgroundOps as any);

    // Add multiple test todos
    await runCommand(['add', 'Todo 1', '--storage', 'both']);
    await runCommand(['add', 'Todo 2', '--storage', 'both']);
    await runCommand(['add', 'Todo 3', '--storage', 'both']);

    const { stdout } = await runCommand([
      'sync',
      '--background',
      '--batch-size',
      '2',
      '--force',
    ]);

    expect(stdout as any).toContain('Background sync started');
    // Should create multiple batches for 3 todos with batch size 2
    expect(mockBackgroundOps.syncTodosInBackground).toHaveBeenCalled();
  });

  test('should support priority configuration', async () => {
    const mockBackgroundOps = {
      syncTodosInBackground: jest.fn().mockResolvedValue('priority-job-101'),
      shutdown: jest.fn().mockResolvedValue(undefined as any),
    } as any;

    jest
      .spyOn(
        require('../../apps/cli/src/utils/background-operations'),
        'createBackgroundOperationsManager'
      )
      .mockResolvedValue(mockBackgroundOps as any);

    await runCommand(['add', 'High priority sync todo', '--storage', 'both']);

    const { stdout } = await runCommand([
      'sync',
      '--background',
      '--priority',
      'high',
      '--force',
    ]);

    expect(stdout as any).toContain('Background sync started');
    expect(mockBackgroundOps.syncTodosInBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        priority: 'high' as const,
      })
    );
  });

  test('should require --background flag for continuous mode', async () => {
    const { stderr } = await runCommand(['sync', '--continuous'], {
      expectError: true,
    });

    expect(stderr as any).toContain('--continuous depends on --background');
  });

  test('should validate interval minimum value', async () => {
    const { stderr } = await runCommand(
      ['sync', '--background', '--continuous', '--interval', '10'],
      { expectError: true }
    );

    expect(stderr as any).toContain('Expected --interval=10 to be >= 30');
  });

  test('should handle sync direction in background mode', async () => {
    const mockBackgroundOps = {
      syncTodosInBackground: jest.fn().mockResolvedValue('direction-job-202'),
      shutdown: jest.fn().mockResolvedValue(undefined as any),
    } as any;

    jest
      .spyOn(
        require('../../apps/cli/src/utils/background-operations'),
        'createBackgroundOperationsManager'
      )
      .mockResolvedValue(mockBackgroundOps as any);

    await runCommand(['add', 'Direction test todo', '--storage', 'both']);

    const { stdout } = await runCommand([
      'sync',
      '--background',
      '--direction',
      'push',
      '--force',
    ]);

    expect(stdout as any).toContain('Background sync started');
    expect(mockBackgroundOps.syncTodosInBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'push',
      })
    );
  });

  test('should handle conflict resolution in background mode', async () => {
    const mockBackgroundOps = {
      syncTodosInBackground: jest.fn().mockResolvedValue('resolve-job-303'),
      shutdown: jest.fn().mockResolvedValue(undefined as any),
    } as any;

    jest
      .spyOn(
        require('../../apps/cli/src/utils/background-operations'),
        'createBackgroundOperationsManager'
      )
      .mockResolvedValue(mockBackgroundOps as any);

    await runCommand(['add', 'Resolve test todo', '--storage', 'both']);

    const { stdout } = await runCommand([
      'sync',
      '--background',
      '--resolve',
      'newest',
      '--force',
    ]);

    expect(stdout as any).toContain('Background sync started');
    expect(mockBackgroundOps.syncTodosInBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        resolve: 'newest',
      })
    );
  });

  test('should work with specific list in background mode', async () => {
    const mockBackgroundOps = {
      syncTodosInBackground: jest.fn().mockResolvedValue('list-job-404'),
      shutdown: jest.fn().mockResolvedValue(undefined as any),
    } as any;

    jest
      .spyOn(
        require('../../apps/cli/src/utils/background-operations'),
        'createBackgroundOperationsManager'
      )
      .mockResolvedValue(mockBackgroundOps as any);

    await runCommand([
      'add',
      'Work todo',
      '--storage',
      'both',
      '--list',
      'work',
    ]);

    const { stdout } = await runCommand([
      'sync',
      'work',
      '--background',
      '--force',
    ]);

    expect(stdout as any).toContain('Background sync started');
    expect(mockBackgroundOps.syncTodosInBackground).toHaveBeenCalled();
  });

  test('should gracefully handle no todos to sync in background mode', async () => {
    const mockBackgroundOps = {
      syncTodosInBackground: jest.fn(),
      shutdown: jest.fn().mockResolvedValue(undefined as any),
    } as any;

    jest
      .spyOn(
        require('../../apps/cli/src/utils/background-operations'),
        'createBackgroundOperationsManager'
      )
      .mockResolvedValue(mockBackgroundOps as any);

    const { stdout } = await runCommand(['sync', '--background', '--force']);

    expect(stdout as any).toContain('No todos found with "both" storage mode');
    expect(mockBackgroundOps.syncTodosInBackground).not.toHaveBeenCalled();
  });
});

describe('Background Operations Integration', () => {
  test('should handle background operation callbacks', async () => {
    const mockCacheManager = {
      queueOperation: jest.fn().mockResolvedValue('callback-job-505'),
      on: jest.fn(),
      off: jest.fn(),
      shutdown: jest.fn(),
    } as any;

    jest
      .spyOn(
        require('../../apps/cli/src/utils/BackgroundCacheManager'),
        'createBackgroundCacheManager'
      )
      .mockReturnValue(mockCacheManager as any);

    const backgroundOps = new BackgroundOperations(mockCacheManager as any);

    const progressCallback = jest.fn();
    const completeCallback = jest.fn();
    const errorCallback = jest.fn();

    await backgroundOps.syncTodosInBackground({
      todos: [],
      onProgress: progressCallback,
      onComplete: completeCallback,
      onError: errorCallback,
    });

    expect(mockCacheManager.on).toHaveBeenCalledWith(
      'operationProgress',
      expect.any(Function as any)
    );
    expect(mockCacheManager.on).toHaveBeenCalledWith(
      'operationCompleted',
      expect.any(Function as any)
    );
    expect(mockCacheManager.on).toHaveBeenCalledWith(
      'operationFailed',
      expect.any(Function as any)
    );
  });

  test('should handle continuous sync configuration', async () => {
    const mockCacheManager = {
      queueOperation: jest.fn().mockResolvedValue('continuous-config-606'),
      on: jest.fn(),
      off: jest.fn(),
      shutdown: jest.fn(),
    } as any;

    jest
      .spyOn(
        require('../../apps/cli/src/utils/BackgroundCacheManager'),
        'createBackgroundCacheManager'
      )
      .mockReturnValue(mockCacheManager as any);

    const backgroundOps = new BackgroundOperations(mockCacheManager as any);

    await backgroundOps.startContinuousSyncInBackground({
      interval: 120,
      direction: 'pull',
      resolve: 'local',
      priority: 'high' as const,
    });

    expect(mockCacheManager.queueOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'continuous-sync',
        data: expect.objectContaining({
          interval: 120000, // Should be converted to milliseconds
          direction: 'pull',
          resolve: 'local',
        }),
        priority: 'high' as const,
        timeout: undefined, // No timeout for continuous operations
      })
    );
  });
});
