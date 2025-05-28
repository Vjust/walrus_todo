import { Command, Flags } from '@oclif/core';
import { BaseCommand } from '../base-command';
import { SyncEngine, SyncEngineConfig } from '../services/syncEngine';
import { Logger } from '../utils/Logger';
import { join } from 'path';
import { homedir } from 'os';

export default class Daemon extends BaseCommand {
  static description = 'Start the WalTodo sync daemon for real-time synchronization';

  static examples = [
    `$ waltodo daemon --wallet 0x123...`,
    `$ waltodo daemon --api-url http://localhost:3001 --wallet 0x123...`,
    `$ waltodo daemon --background`,
  ];

  static flags = {
    ...BaseCommand.flags,
    wallet: Flags.string({
      char: 'w',
      description: 'Wallet address for sync operations',
      required: false,
    }),
    'api-url': Flags.string({
      description: 'API server URL',
      default: 'http://localhost:3001',
    }),
    'todos-dir': Flags.string({
      description: 'Directory containing todo files',
      default: join(process.cwd(), 'Todos'),
    }),
    'sync-interval': Flags.integer({
      description: 'Sync interval in seconds (0 to disable periodic sync)',
      default: 30,
    }),
    'conflict-resolution': Flags.string({
      description: 'Conflict resolution strategy',
      options: ['local', 'remote', 'newest', 'manual'],
      default: 'newest',
    }),
    'no-real-time': Flags.boolean({
      description: 'Disable real-time file watching',
      default: false,
    }),
    'max-concurrent': Flags.integer({
      description: 'Maximum concurrent sync operations',
      default: 3,
    }),
    detach: Flags.boolean({
      char: 'd',
      description: 'Run daemon in detached mode',
      default: false,
    }),
    stop: Flags.boolean({
      description: 'Stop running daemon',
      default: false,
    }),
    status: Flags.boolean({
      description: 'Show daemon status',
      default: false,
    }),
  };

  private syncEngine?: SyncEngine;
  private logger: Logger;
  private isShuttingDown = false;

  constructor(argv: string[], config: any) {
    super(argv, config);
    this.logger = new Logger('WalTodoDaemon');
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Daemon);

    // Handle stop command
    if (flags.stop) {
      await this.stopDaemon();
      return;
    }

    // Handle status command
    if (flags.status) {
      await this.showStatus();
      return;
    }

    // Get wallet from flags or configuration
    const wallet = flags.wallet || await this.getDefaultWallet();
    if (!wallet) {
      this.error('Wallet address is required. Use --wallet flag or configure a default wallet.');
    }

    const config: SyncEngineConfig = {
      todosDirectory: flags['todos-dir'],
      apiConfig: {
        baseURL: flags['api-url'],
        enableWebSocket: true,
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
      },
      syncInterval: flags['sync-interval'] * 1000, // Convert to milliseconds
      conflictResolution: flags['conflict-resolution'] as any,
      enableRealTimeSync: !flags['no-real-time'],
      maxConcurrentSyncs: flags['max-concurrent'],
      syncDebounceMs: 2000,
    };

    if (flags.detach) {
      await this.runDetached(config, wallet);
    } else {
      await this.runDaemon(config, wallet);
    }
  }

  private async runDaemon(config: SyncEngineConfig, wallet: string): Promise<void> {
    this.logger.info('Starting WalTodo sync daemon...', {
      wallet: wallet.substring(0, 8) + '...',
      apiURL: config.apiConfig.baseURL,
      todosDir: config.todosDirectory,
      realTimeSync: config.enableRealTimeSync,
    });

    try {
      // Create and initialize sync engine
      this.syncEngine = new SyncEngine(config);
      
      // Setup event handlers
      this.setupEventHandlers();
      
      // Initialize and start
      await this.syncEngine.initialize(wallet);
      await this.syncEngine.start();

      this.logger.info('✅ WalTodo sync daemon started successfully');
      this.logger.info('Press Ctrl+C to stop the daemon');

      // Setup graceful shutdown
      this.setupShutdownHandlers();

      // Keep the daemon running
      await this.keepAlive();

    } catch (error) {
      this.logger.error('Failed to start sync daemon:', error);
      throw error;
    }
  }

  private async runDetached(config: SyncEngineConfig, wallet: string): Promise<void> {
    this.logger.info('Starting daemon in detached mode...');
    
    // In a real implementation, this would fork a child process
    // For now, we'll run in background mode
    const { spawn } = await import('child_process');
    
    const child = spawn(process.execPath, [
      process.argv[1], // Script path
      'daemon',
      '--wallet', wallet,
      '--api-url', config.apiConfig.baseURL,
      '--todos-dir', config.todosDirectory,
      '--sync-interval', String(config.syncInterval! / 1000),
      '--conflict-resolution', config.conflictResolution!,
      ...(config.enableRealTimeSync ? [] : ['--no-real-time']),
      '--max-concurrent', String(config.maxConcurrentSyncs),
    ], {
      detached: true,
      stdio: 'ignore',
    });

    child.unref();

    this.logger.info(`✅ Daemon started in detached mode (PID: ${child.pid})`);
    
    // Save PID for stop command
    const pidFile = join(homedir(), '.waltodo-daemon.pid');
    await require('fs').promises.writeFile(pidFile, String(child.pid));
  }

  private async stopDaemon(): Promise<void> {
    const pidFile = join(homedir(), '.waltodo-daemon.pid');
    
    try {
      const pid = await require('fs').promises.readFile(pidFile, 'utf8');
      process.kill(parseInt(pid, 10), 'SIGTERM');
      
      // Remove PID file
      await require('fs').promises.unlink(pidFile);
      
      this.logger.info('✅ Daemon stopped successfully');
      
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        this.logger.warn('No daemon PID file found');
      } else if (error.code === 'ESRCH') {
        this.logger.warn('Daemon process not found');
        // Clean up stale PID file
        try {
          await require('fs').promises.unlink(pidFile);
        } catch {}
      } else {
        this.logger.error('Failed to stop daemon:', error);
        throw error;
      }
    }
  }

  private async showStatus(): Promise<void> {
    if (this.syncEngine) {
      // Running daemon
      const status = this.syncEngine.getSyncStatus();
      const apiStatus = this.syncEngine['apiClient']?.getStatus();
      
      this.log('🔄 WalTodo Sync Daemon Status');
      this.log('─'.repeat(40));
      this.log(`Status: ${status.isActive ? '🟢 Running' : '🔴 Stopped'}`);
      this.log(`Last Sync: ${status.lastSync ? new Date(status.lastSync).toLocaleString() : 'Never'}`);
      this.log(`Pending Changes: ${status.pendingChanges}`);
      this.log(`Conflicts: ${status.conflicts.length}`);
      
      if (apiStatus) {
        this.log(`API Connected: ${apiStatus.connected ? '🟢 Yes' : '🔴 No'}`);
        this.log(`WebSocket: ${apiStatus.websocketConnected ? '🟢 Connected' : '🔴 Disconnected'}`);
        this.log(`Wallet: ${apiStatus.wallet || 'None'}`);
        this.log(`API URL: ${apiStatus.baseURL}`);
      }
      
      if (status.conflicts.length > 0) {
        this.log('\n⚠️ Conflicts:');
        for (const conflict of status.conflicts) {
          this.log(`  - ${conflict.type}: ${conflict.itemId}`);
        }
      }
      
    } else {
      // Check for detached daemon
      const pidFile = join(homedir(), '.waltodo-daemon.pid');
      
      try {
        const pid = await require('fs').promises.readFile(pidFile, 'utf8');
        
        // Check if process is running
        try {
          process.kill(parseInt(pid, 10), 0);
          this.log('🟢 Daemon is running in detached mode');
          this.log(`PID: ${pid}`);
        } catch {
          this.log('🔴 Daemon not running (stale PID file)');
          // Clean up stale PID file
          await require('fs').promises.unlink(pidFile);
        }
        
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          this.log('🔴 Daemon not running');
        } else {
          throw error;
        }
      }
    }
  }

  private setupEventHandlers(): void {
    if (!this.syncEngine) return;

    this.syncEngine.on('initialized', () => {
      this.logger.info('Sync engine initialized');
    });

    this.syncEngine.on('started', () => {
      this.logger.info('Sync engine started');
    });

    this.syncEngine.on('file-changed', (event) => {
      this.logger.debug(`File changed: ${event.relativePath} (${event.type})`);
    });

    this.syncEngine.on('remote-change-applied', (event) => {
      this.logger.info(`Remote change applied: ${event.type}`);
    });

    this.syncEngine.on('sync-started', () => {
      this.logger.debug('Synchronization started');
    });

    this.syncEngine.on('sync-completed', (result) => {
      this.logger.info('Sync completed', {
        files: result.syncedFiles,
        conflicts: result.conflicts.length,
        errors: result.errors.length,
        duration: `${result.duration}ms`,
      });
    });

    this.syncEngine.on('sync-failed', (result) => {
      this.logger.error('Sync failed', {
        errors: result.errors,
        duration: `${result.duration}ms`,
      });
    });

    this.syncEngine.on('conflict-detected', (conflict) => {
      this.logger.warn(`Conflict detected: ${conflict.type} ${conflict.itemId}`);
    });

    this.syncEngine.on('error', (error) => {
      this.logger.error('Sync engine error:', error);
    });

    this.syncEngine.on('api-disconnected', () => {
      this.logger.warn('API disconnected, attempting to reconnect...');
    });
  }

  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      this.logger.info(`Received ${signal}, shutting down gracefully...`);

      try {
        if (this.syncEngine) {
          await this.syncEngine.shutdown();
        }
        this.logger.info('✅ Daemon shutdown complete');
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGHUP', () => shutdown('SIGHUP'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection:', { reason, promise });
      shutdown('unhandledRejection');
    });
  }

  private async keepAlive(): Promise<void> {
    // Keep the process alive until shutdown
    return new Promise((resolve) => {
      const keepAliveInterval = setInterval(() => {
        if (this.isShuttingDown) {
          clearInterval(keepAliveInterval);
          resolve();
        }
      }, 1000);
    });
  }

  private async getDefaultWallet(): Promise<string | null> {
    try {
      // Try to get wallet from configuration
      const configService = await import('../services/config-service');
      const config = await configService.ConfigService.getInstance().getConfig();
      return config.sui?.wallet || null;
    } catch {
      return null;
    }
  }
}