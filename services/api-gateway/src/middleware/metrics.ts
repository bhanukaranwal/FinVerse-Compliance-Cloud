import { Request, Response, NextFunction } from 'express';
import { createServiceLogger } from '@finverse/shared-utils';

const logger = createServiceLogger('api-gateway-metrics');

// Simple in-memory metrics store (in production, use Redis or external metrics service)
const metrics = {
  requests: new Map<string, number>(),
  responses: new Map<string, number>(),
  errors: new Map<string, number>(),
  responseTime: new Map<string, number[]>(),
};

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const requestKey = `${req.method} ${req.route?.path || req.path}`;

  // Increment request counter
  metrics.requests.set(requestKey, (metrics.requests.get(requestKey) || 0) + 1);

  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Record response metrics
    const responseKey = `${requestKey} ${res.statusCode}`;
    metrics.responses.set(responseKey, (metrics.responses.get(responseKey) || 0) + 1);
    
    // Record response times
    if (!metrics.responseTime.has(requestKey)) {
      metrics.responseTime.set(requestKey, []);
    }
    metrics.responseTime.get(requestKey)!.push(responseTime);
    
    // Keep only last 100 response times per endpoint
    const times = metrics.responseTime.get(requestKey)!;
    if (times.length > 100) {
      times.shift();
    }
    
    // Record errors
    if (res.statusCode >= 400) {
      const errorKey = `${requestKey} ERROR`;
      metrics.errors.set(errorKey, (metrics.errors.get(errorKey) || 0) + 1);
    }
    
    // Log request details
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id,
    });
    
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Metrics endpoint
export const getMetrics = (req: Request, res: Response) => {
  const metricsData = {
    requests: Object.fromEntries(metrics.requests),
    responses: Object.fromEntries(metrics.responses),
    errors: Object.fromEntries(metrics.errors),
    averageResponseTimes: Object.fromEntries(
      Array.from(metrics.responseTime.entries()).map(([key, times]) => [
        key,
        times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0
      ])
    ),
    timestamp: new Date().toISOString(),
  };

  res.json(metricsData);
};