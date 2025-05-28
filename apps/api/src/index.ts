#!/usr/bin/env node
import { ApiServer } from './server';
import { logger } from './utils/logger';
import { config } from './config';

async function main(): Promise<void> {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const portArg = args.find(arg => arg.startsWith('--port='));
    const port = portArg ? parseInt(portArg.split('=')[1] || '3000', 10) : config.port;

    // Validate port
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid port: ${port}. Port must be between 1 and 65535.`);
    }

    // Create logs directory
    const fs = await import('fs').then(m => m.promises);
    try {
      await fs.mkdir('logs', { recursive: true });
    } catch {
      // Directory already exists or permission denied
    }

    // Create and start server
    const server = new ApiServer();
    await server.start(port);

    // Handle graceful shutdown
    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} signal received: closing HTTP server`);
      try {
        await server.stop();
        logger.info('HTTP server closed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', error);
        process.exit(1);
      }
    };

    // Register signal handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at Promise', { promise, reason });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start WalTodo API server', error);
    process.exit(1);
  }
}

// Export server class for testing
export { ApiServer } from './server';
export { WebSocketService } from './services/websocketService';
export { TodoService } from './services/todoService';

// Start server if this file is run directly
if (require.main === module) {
  main();
}