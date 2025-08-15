import { config as dotenvConfig } from 'dotenv';
import Joi from 'joi';

dotenvConfig();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'staging', 'production').default('development'),
  PORT: Joi.number().default(3000),
  
  // Database
  DATABASE_URL: Joi.string().required(),
  MONGODB_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  
  // JWT
  JWT_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  
  // External APIs
  ZERODHA_API_KEY: Joi.string(),
  ZERODHA_API_SECRET: Joi.string(),
  UPSTOX_API_KEY: Joi.string(),
  UPSTOX_API_SECRET: Joi.string(),
  
  // Email
  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().required(),
  SMTP_PASS: Joi.string().required(),
  
  // AWS
  AWS_REGION: Joi.string().default('ap-south-1'),
  AWS_ACCESS_KEY_ID: Joi.string(),
  AWS_SECRET_ACCESS_KEY: Joi.string(),
  AWS_S3_BUCKET: Joi.string(),
  
  // Kafka
  KAFKA_BROKERS: Joi.string().default('localhost:9092'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: Joi.number().default(100),
  
  // File Upload
  MAX_FILE_SIZE: Joi.number().default(10 * 1024 * 1024), // 10MB
  UPLOAD_PATH: Joi.string().default('./uploads'),
  
  // Frontend
  FRONTEND_URL: Joi.string().default('http://localhost:4000'),
  
  // Security
  BCRYPT_ROUNDS: Joi.number().default(12),
  SESSION_SECRET: Joi.string().required(),
  
  // Monitoring
  ENABLE_METRICS: Joi.boolean().default(true),
  METRICS_PORT: Joi.number().default(9090),
}).unknown();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
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
  
  brokers: {
    zerodha: {
      apiKey: envVars.ZERODHA_API_KEY,
      apiSecret: envVars.ZERODHA_API_SECRET,
    },
    upstox: {
      apiKey: envVars.UPSTOX_API_KEY,
      apiSecret: envVars.UPSTOX_API_SECRET,
    },
  },
  
  email: {
    host: envVars.SMTP_HOST,
    port: envVars.SMTP_PORT,
    user: envVars.SMTP_USER,
    pass: envVars.SMTP_PASS,
  },
  
  aws: {
    region: envVars.AWS_REGION,
    accessKeyId: envVars.AWS_ACCESS_KEY_ID,
    secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY,
    s3Bucket: envVars.AWS_S3_BUCKET,
  },
  
  kafka: {
    brokers: envVars.KAFKA_BROKERS.split(','),
  },
  
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    max: envVars.RATE_LIMIT_MAX,
  },
  
  upload: {
    maxFileSize: envVars.MAX_FILE_SIZE,
    path: envVars.UPLOAD_PATH,
  },
  
  frontend: {
    url: envVars.FRONTEND_URL,
  },
  
  security: {
    bcryptRounds: envVars.BCRYPT_ROUNDS,
    sessionSecret: envVars.SESSION_SECRET,
  },
  
  monitoring: {
    enabled: envVars.ENABLE_METRICS,
    port: envVars.METRICS_PORT,
  },
  
  cors: {
    origins: [envVars.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:4000'],
  },
  
  services: {
    userManagement: process.env.USER_MANAGEMENT_URL || 'http://localhost:3001',
    brokerIntegration: process.env.BROKER_INTEGRATION_URL || 'http://localhost:3002',
    taxEngine: process.env.TAX_ENGINE_URL || 'http://localhost:3003',
    complianceEngine: process.env.COMPLIANCE_ENGINE_URL || 'http://localhost:3004',
    portfolioService: process.env.PORTFOLIO_SERVICE_URL || 'http://localhost:3005',
    documentService: process.env.DOCUMENT_SERVICE_URL || 'http://localhost:3006',
    auditService: process.env.AUDIT_SERVICE_URL || 'http://localhost:3007',
    notificationService: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3008',
    aiService: process.env.AI_SERVICE_URL || 'http://localhost:3009',
    graphql: process.env.GRAPHQL_URL || 'http://localhost:4000/graphql',
  },
};