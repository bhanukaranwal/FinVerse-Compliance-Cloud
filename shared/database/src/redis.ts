import { createClient } from 'redis';
import { config } from '../../config';
import { logger } from '../../utils/logger';

export const redis = createClient({
  url: config.database.redis,
});

redis.on('error', (err) => {
  logger.error('Redis error:', err);
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('disconnect', () => {
  logger.warn('Redis disconnected');
});

export const initializeRedis = async () => {
  try {
    await redis.connect();
    logger.info('Redis initialized successfully');
  } catch (error) {
    logger.error('Redis initialization failed:', error);
    throw error;
  }
};