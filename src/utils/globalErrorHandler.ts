import { logger } from './logger';

export class GlobalErrorHandler {
  static setup(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      });

      // Graceful shutdown
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('Unhandled Rejection at:', {
        promise,
        reason: reason instanceof Error ? {
          name: reason.name,
          message: reason.message,
          stack: reason.stack,
        } : reason,
      });

      // Graceful shutdown
      process.exit(1);
    });

    // Handle SIGTERM
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received. Starting graceful shutdown...');
      GlobalErrorHandler.gracefulShutdown();
    });

    // Handle SIGINT
    process.on('SIGINT', () => {
      logger.info('SIGINT received. Starting graceful shutdown...');
      GlobalErrorHandler.gracefulShutdown();
    });

    logger.info('Global error handlers initialized');
  }

  static gracefulShutdown(): void {
    // Perform cleanup operations here
    setTimeout(() => {
      logger.info('Graceful shutdown completed');
      process.exit(0);
    }, 10000); // 10 seconds timeout for cleanup
  }
}