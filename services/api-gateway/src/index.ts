import app from './app';
import { config } from '@finverse/shared-config';
import { createServiceLogger } from '@finverse/shared-utils';

const logger = createServiceLogger('api-gateway');

const port = config.port;

const server = app.listen(port, () => {
  logger.info(`🚀 API Gateway running on port ${port}`);
  logger.info(`📊 Environment: ${config.env}`);
  logger.info(`🔗 Health check: http://localhost:${port}/health`);
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown:', err);
      process.exit(1);
    }
    
    logger.info('Server closed successfully');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));