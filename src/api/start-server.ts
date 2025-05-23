#!/usr/bin/env node
import { createApiServer } from './server';
import { Logger } from '../utils/Logger';

const logger = new Logger('ApiStartup');

async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const portArg = args.find(arg => arg.startsWith('--port='));
    const port = portArg ? parseInt(portArg.split('=')[1], 10) : undefined;

    // Create and start server
    const server = await createApiServer({ port });
    
    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT signal received: closing HTTP server');
      await server.stop();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start API server', error);
    process.exit(1);
  }
}

// Start the server
main();