import { ApiServer } from './server';
import { config } from './config';
import { logger } from './utils/logger';

async function startServer() {
  try {
    const server = new ApiServer();
    const port = config.server.port || 3001;
    
    await server.start(port);
    logger.info(`API server started on port ${port}`);
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await server.stop();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      await server.stop();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

export { ApiServer } from './server';