import { config as dotenvConfig } from 'dotenv';
import Joi from 'joi';
import path from 'path';

// Load environment variables
dotenvConfig({ path: path.resolve(process.cwd(), '.env') });

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'staging', 'production').default('development'),
  PORT: Joi.number().default(3000),
  
  // Database
  DATABASE_URL: Joi.string().default('postgresql://finverse_user:finverse_password@localhost:5432/finverse_db'),
  MONGODB_URL: Joi.string().default('mongodb://finverse_user:finverse_password@localhost:27017/finverse_documents'),
  REDIS_URL: Joi.string().default('redis://localhost:6379'),
  
  // JWT
  JWT_SECRET: Joi.string().default('finverse-jwt-secret-2025'),
  JWT_REFRESH_SECRET: Joi.string().default('finverse-refresh-secret-2025'),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  
  // Email
  SMTP_HOST: Joi.string().default('smtp.gmail.com'),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().default('noreply@finversecompliance.com'),
  SMTP_PASS: Joi.string().default('password'),
  
  // Security
  BCRYPT_ROUNDS: Joi.number().default(12),
  SESSION_SECRET: Joi.string().default('finverse-session-secret-2025'),
  
  // Frontend
  FRONTEND_URL: Joi.string().default('http://localhost:4000'),
}).unknown();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  console.warn(`Config validation warning: ${error.message}`);
}

export const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  
  database: {
    url: envVars.DATABASE_URL,
    mongodb: envVars.MONGODB_URL,
    redis: envVars.REDIS_URL,
  },
  
  jwt: {
    secret: envVars.JWT_SECRET,
    refreshSecret: envVars.JWT_REFRESH_SECRET,
    expiresIn: envVars.JWT_EXPIRES_IN,
    refreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN,
  },
  
  email: {
    host: envVars.SMTP_HOST,
    port: envVars.SMTP_PORT,
    user: envVars.SMTP_USER,
    pass: envVars.SMTP_PASS,
  },
  
  security: {
    bcryptRounds: envVars.BCRYPT_ROUNDS,
    sessionSecret: envVars.SESSION_SECRET,
  },
  
  frontend: {
    url: envVars.FRONTEND_URL,
  },
  
  cors: {
    origins: [envVars.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:4000'],
  },
  
  services: {
    userManagement: 'http://localhost:3001',
    brokerIntegration: 'http://localhost:3002',
    taxEngine: 'http://localhost:3003',
    complianceEngine: 'http://localhost:3004',
    portfolioService: 'http://localhost:3005',
    documentService: 'http://localhost:3006',
    aiTradingAssistant: 'http://localhost:3009',
  },
};