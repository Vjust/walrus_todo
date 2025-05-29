import { Flags } from '@oclif/core';
import chalk from 'chalk';
import { BaseCommand } from '../base-command';
import { ApiServer, createApiServer } from '../api/server';
import { ApiConfig } from '../api/config';
import { TodoService } from '../services/todoService.consolidated';
import { configService } from '../services/config-service';
import { Logger } from '../utils/Logger';

export default class ServeCommand extends BaseCommand {
  static description = 'Start the WalTodo API server';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --port 4000',
    '<%= config.bin %> <%= command.id %> --dev',
    '<%= config.bin %> <%= command.id %> --no-auth',
  ];

  static flags = {
    ...BaseCommand.flags,
    port: Flags.integer({
      char: 'p',
      description: 'Port to run the server on',
      default: 3001,
      env: 'API_PORT',
    }),
    dev: Flags.boolean({
      description: 'Run in development mode',
      default: false,
    }),
    'no-auth': Flags.boolean({
      description: 'Disable API key authentication',
      default: false,
    }),
    'cors-origins': Flags.string({
      description: 'Comma-separated list of allowed CORS origins',
      default: 'http://localhost:3000,http://localhost:3001',
      env: 'API_CORS_ORIGINS',
    }),
  };

  private server: ApiServer | null = null;
  private logger = new Logger('ServeCommand');

  async run(): Promise<void> {
    const { flags } = await this.parse(ServeCommand);

    try {
      // Configure the API server
      const config: Partial<ApiConfig> = {
        port: flags.port,
        env: flags.dev ? 'development' : process.env.NODE_ENV || 'production',
        auth: {
          required: !flags['no-auth'],
          apiKeys: process.env.API_KEYS?.split(',') || [],
        },
        cors: {
          origins: flags['cors-origins'].split(',').map(origin => origin.trim()),
        },
        logging: {
          enabled: !flags.quiet,
          level: flags.verbose ? 'debug' : 'info',
        },
      };

      // Initialize services required by the API
      await this.initializeServices();

      // Create and start the server
      this.startSpinner('Starting API server');
      this.server = await createApiServer(config);
      this.stopSpinner(true, 'API server started successfully');

      // Display server information
      this.displayServerInfo(config);

      // Setup graceful shutdown handlers
      this.setupShutdownHandlers();

      // Keep the process running
      await this.keepAlive();
    } catch (error) {
      this.stopSpinner(false, 'Failed to start API server');
      this.handleError(error, 'Starting API server');
    }
  }

  private async initializeServices(): Promise<void> {
    this.verbose('Initializing services...');

    // Ensure TodoService is properly initialized
    const todoService = TodoService.getInstance();
    
    // Configuration service is already initialized as singleton
    // Just access it to ensure it's loaded
    const config = configService.getConfig();

    this.verbose('Services initialized successfully');
  }

  private displayServerInfo(config: Partial<ApiConfig>): void {
    const baseUrl = `http://localhost:${config.port}`;
    
    this.section('API Server Information', 
      `${chalk.green('Server Status:')} Running\n` +
      `${chalk.green('Port:')} ${config.port}\n` +
      `${chalk.green('Environment:')} ${config.env}\n` +
      `${chalk.green('Authentication:')} ${config.auth?.required ? 'Enabled' : 'Disabled'}\n` +
      `${chalk.green('CORS Origins:')} ${config.cors?.origins.join(', ')}`
    );

    this.section('Available Endpoints',
      `${chalk.cyan('Health Check:')}\n` +
      `  GET ${baseUrl}/health\n\n` +
      
      `${chalk.cyan('Todo Operations:')}\n` +
      `  GET    ${baseUrl}/api/v1/todos - List all todos\n` +
      `  GET    ${baseUrl}/api/v1/todos/:id - Get a specific todo\n` +
      `  POST   ${baseUrl}/api/v1/todos - Create a new todo\n` +
      `  PUT    ${baseUrl}/api/v1/todos/:id - Update a todo\n` +
      `  DELETE ${baseUrl}/api/v1/todos/:id - Delete a todo\n` +
      `  POST   ${baseUrl}/api/v1/todos/:id/complete - Complete a todo\n\n` +
      
      `${chalk.cyan('Sync Operations:')}\n` +
      `  POST   ${baseUrl}/api/v1/sync - Sync todos with storage\n` +
      `  GET    ${baseUrl}/api/v1/sync/status - Get sync status\n`
    );

    if (config.auth?.required) {
      this.warning('API key authentication is enabled. Include X-API-Key header in requests.');
    }

    if (config.env === 'development') {
      this.info(`API Documentation available at: ${baseUrl}/api-docs`);
    }

    this.log(chalk.gray('\nPress CTRL+C to stop the server'));
  }

  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      this.logger.info(`${signal} received, shutting down gracefully...`);
      
      if (this.server) {
        try {
          await this.server.stop();
          this.success('Server stopped successfully');
        } catch (error) {
          this.logger.error('Error stopping server', error as Error);
        }
      }
      
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', error);
      shutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason) => {
      this.logger.error('Unhandled rejection', new Error(String(reason)));
      shutdown('unhandledRejection');
    });
  }

  private async keepAlive(): Promise<void> {
    // Keep the process running
    return new Promise(() => {
      // This promise never resolves, keeping the process alive
      // The shutdown handlers will handle process termination
    });
  }
}