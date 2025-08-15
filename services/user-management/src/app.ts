import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { profileRoutes } from './routes/profile';
import { errorHandler } from './middleware/error';
import { validateRequest } from './middleware/validation';
import { logger } from './utils/logger';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/profile', profileRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'user-management',
    timestamp: new Date().toISOString(),
  });
});

// Error handling
app.use(errorHandler);

export default app;