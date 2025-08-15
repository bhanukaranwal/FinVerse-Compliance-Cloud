import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { brokerRoutes } from './routes/brokers';
import { tradesRoutes } from './routes/trades';
import { holdingsRoutes } from './routes/holdings';
import { syncRoutes } from './routes/sync';
import { errorHandler } from './middleware/error';
import { logger } from './utils/logger';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/brokers', brokerRoutes);
app.use('/trades', tradesRoutes);
app.use('/holdings', holdingsRoutes);
app.use('/sync', syncRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'broker-integration',
    timestamp: new Date().toISOString(),
  });
});

// Error handling
app.use(errorHandler);

export default app;