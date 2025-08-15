import { Request, Response, NextFunction } from 'express';
import { createServiceLogger } from '@finverse/shared-utils';

const logger = createServiceLogger('ai-trading-assistant');

export interface ServiceError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export const errorHandler = (
  error: ServiceError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = error.statusCode || 500;
  let code = error.code || 'INTERNAL_ERROR';
  let message = error.message || 'Internal server error';
  let details = error.details;

  // Log error
  const logLevel = statusCode >= 500 ? 'error' : 'warn';
  logger[logLevel]('Service Error:', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      statusCode,
      code,
    },
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    message = 'Internal server error';
    details = undefined;
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
    timestamp: new Date().toISOString(),
    service: 'ai-trading-assistant',
  });
};