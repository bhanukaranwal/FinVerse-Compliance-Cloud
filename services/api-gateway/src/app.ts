import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from '@finverse/shared-config';
import { createServiceLogger } from '@finverse/shared-utils';
import { errorHandler, notFoundHandler } from './middleware/error';
import { authMiddleware } from './middleware/auth';

const app = express();
const logger = createServiceLogger('api-gateway');

// Trust proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: config.cors.origins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Compression
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
  });
});

// Service proxy configuration
const createServiceProxy = (serviceName: string, serviceUrl: string) => {
  return createProxyMiddleware({
    target: serviceUrl,
    changeOrigin: true,
    pathRewrite: {
      [`^/api/${serviceName}`]: '',
    },
    timeout: 30000,
    proxyTimeout: 30000,
    onError: (err, req, res) => {
      logger.error(`Proxy error for ${serviceName}:`, err);
      res.status(503).json({
        error: 'Service temporarily unavailable',
        service: serviceName,
      });
    },
    onProxyReq: (proxyReq, req, res) => {
      proxyReq.setHeader('X-Gateway-Source', 'finverse-api-gateway');
      proxyReq.setHeader('X-Request-ID', req.headers['x-request-id'] || 'unknown');
    },
  });
};

// Authentication routes (no auth required)
app.use('/api/auth', createServiceProxy('auth', config.services.userManagement));

// Protected routes (auth required)
app.use('/api/users', authMiddleware, createServiceProxy('users', config.services.userManagement));
app.use('/api/portfolio', authMiddleware, createServiceProxy('portfolio', config.services.portfolioService));
app.use('/api/trades', authMiddleware, createServiceProxy('trades', config.services.brokerIntegration));
app.use('/api/tax', authMiddleware, createServiceProxy('tax', config.services.taxEngine));
app.use('/api/compliance', authMiddleware, createServiceProxy('compliance', config.services.complianceEngine));
app.use('/api/ai', authMiddleware, createServiceProxy('ai', config.services.aiTradingAssistant));

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;