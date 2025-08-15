import { DataSource } from 'typeorm';
import { config } from '@finverse/shared-config';
import { createServiceLogger } from '@finverse/shared-utils';
import { User } from './models/User';
import { Trade } from './models/Trade';
import { Portfolio } from './models/Portfolio';
import { createClient } from 'redis';

const logger = createServiceLogger('database');

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: config.database.url,
  entities: [User, Trade, Portfolio],
  synchronize: config.env === 'development',
  logging: config.env === 'development',
  ssl: config.env === 'production' ? { rejectUnauthorized: false } : false,
});

export const initializeDatabase = async (): Promise<void> => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      logger.info('✅ Database connection established successfully');
    }
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw new Error(`Database initialization failed: ${error.message}`);
  }
};

export const redis = createClient({
  url: config.database.redis,
});

export const initializeRedis = async (): Promise<void> => {
  try {
    await redis.connect();
    logger.info('✅ Redis connection established successfully');
  } catch (error) {
    logger.error('❌ Redis connection failed:', error);
    throw new Error(`Redis initialization failed: ${error.message}`);
  }
};