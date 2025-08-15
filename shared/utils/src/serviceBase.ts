import { EventEmitter } from 'events';
import { createServiceLogger } from './logger';

export abstract class ServiceBase extends EventEmitter {
  protected serviceName: string;
  protected isInitialized = false;
  protected isHealthy = true;
  protected logger: any;

  constructor(serviceName: string) {
    super();
    this.serviceName = serviceName;
    this.logger = createServiceLogger(serviceName);
  }

  async start(): Promise<void> {
    try {
      this.logger.info(`Starting ${this.serviceName} service...`);
      await this.initialize();
      this.isInitialized = true;
      this.emit('started');
      this.logger.info(`✅ ${this.serviceName} service started successfully`);
    } catch (error) {
      this.logger.error(`❌ Failed to start ${this.serviceName} service:`, error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.logger.info(`Stopping ${this.serviceName} service...`);
      await this.cleanup();
      this.isInitialized = false;
      this.emit('stopped');
      this.logger.info(`✅ ${this.serviceName} service stopped successfully`);
    } catch (error) {
      this.logger.error(`❌ Error stopping ${this.serviceName} service:`, error);
      throw error;
    }
  }

  async getHealth(): Promise<{
    service: string;
    status: 'healthy' | 'unhealthy' | 'degraded';
    uptime: number;
    timestamp: Date;
    details?: any;
  }> {
    try {
      const healthDetails = await this.performHealthCheck();
      return {
        service: this.serviceName,
        status: this.isHealthy ? 'healthy' : 'unhealthy',
        uptime: process.uptime(),
        timestamp: new Date(),
        details: healthDetails,
      };
    } catch (error) {
      this.logger.error(`Health check failed for ${this.serviceName}:`, error);
      return {
        service: this.serviceName,
        status: 'unhealthy',
        uptime: process.uptime(),
        timestamp: new Date(),
        details: { error: error.message },
      };
    }
  }

  abstract initialize(): Promise<void>;
  protected abstract cleanup(): Promise<void>;
  protected abstract performHealthCheck(): Promise<any>;

  public isReady(): boolean {
    return this.isInitialized && this.isHealthy;
  }

  public getServiceInfo(): {
    name: string;
    initialized: boolean;
    healthy: boolean;
    uptime: number;
  } {
    return {
      name: this.serviceName,
      initialized: this.isInitialized,
      healthy: this.isHealthy,
      uptime: process.uptime(),
    };
  }
}