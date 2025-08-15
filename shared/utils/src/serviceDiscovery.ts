import { EventEmitter } from 'events';
import { logger } from '../logger';

export interface ServiceEndpoint {
  id: string;
  name: string;
  version: string;
  host: string;
  port: number;
  health: string;
  metadata: Record<string, any>;
  registeredAt: Date;
  lastHeartbeat: Date;
}

export interface ServiceRegistry {
  register(endpoint: ServiceEndpoint): Promise<void>;
  deregister(serviceId: string): Promise<void>;
  discover(serviceName: string): Promise<ServiceEndpoint[]>;
  getHealthyEndpoints(serviceName: string): Promise<ServiceEndpoint[]>;
  startHealthCheck(): void;
  stopHealthCheck(): void;
}

export class InMemoryServiceRegistry extends EventEmitter implements ServiceRegistry {
  private services: Map<string, ServiceEndpoint> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private readonly healthCheckIntervalMs = 30000; // 30 seconds

  async register(endpoint: ServiceEndpoint): Promise<void> {
    this.services.set(endpoint.id, {
      ...endpoint,
      registeredAt: new Date(),
      lastHeartbeat: new Date(),
    });
    
    logger.info(`Service registered: ${endpoint.name} (${endpoint.id})`);
    this.emit('serviceRegistered', endpoint);
  }

  async deregister(serviceId: string): Promise<void> {
    const service = this.services.get(serviceId);
    if (service) {
      this.services.delete(serviceId);
      logger.info(`Service deregistered: ${service.name} (${serviceId})`);
      this.emit('serviceDeregistered', service);
    }
  }

  async discover(serviceName: string): Promise<ServiceEndpoint[]> {
    const endpoints: ServiceEndpoint[] = [];
    
    for (const service of this.services.values()) {
      if (service.name === serviceName) {
        endpoints.push(service);
      }
    }
    
    return endpoints;
  }

  async getHealthyEndpoints(serviceName: string): Promise<ServiceEndpoint[]> {
    const allEndpoints = await this.discover(serviceName);
    return allEndpoints.filter(endpoint => this.isHealthy(endpoint));
  }

  startHealthCheck(): void {
    if (this.healthCheckInterval) {
      return;
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.healthCheckIntervalMs);

    logger.info('Service discovery health checks started');
  }

  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      logger.info('Service discovery health checks stopped');
    }
  }

  private async performHealthChecks(): Promise<void> {
    const now = new Date();
    const unhealthyServices: string[] = [];

    for (const [serviceId, service] of this.services) {
      try {
        const isHealthy = await this.checkServiceHealth(service);
        
        if (isHealthy) {
          service.lastHeartbeat = now;
        } else {
          const timeSinceLastHeartbeat = now.getTime() - service.lastHeartbeat.getTime();
          
          // Remove service if no heartbeat for 2 minutes
          if (timeSinceLastHeartbeat > 120000) {
            unhealthyServices.push(serviceId);
          }
        }
      } catch (error) {
        logger.error(`Health check failed for service ${service.name}:`, error);
        unhealthyServices.push(serviceId);
      }
    }

    // Remove unhealthy services
    for (const serviceId of unhealthyServices) {
      await this.deregister(serviceId);
    }
  }

  private async checkServiceHealth(service: ServiceEndpoint): Promise<boolean> {
    try {
      const response = await fetch(service.health, {
        method: 'GET',
        timeout: 5000,
      });
      
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private isHealthy(endpoint: ServiceEndpoint): boolean {
    const now = new Date();
    const timeSinceLastHeartbeat = now.getTime() - endpoint.lastHeartbeat.getTime();
    
    // Consider service healthy if heartbeat is within last 60 seconds
    return timeSinceLastHeartbeat < 60000;
  }

  // Get service statistics
  getStats(): {
    totalServices: number;
    healthyServices: number;
    servicesByName: Record<string, number>;
  } {
    const stats = {
      totalServices: this.services.size,
      healthyServices: 0,
      servicesByName: {} as Record<string, number>,
    };

    for (const service of this.services.values()) {
      if (this.isHealthy(service)) {
        stats.healthyServices++;
      }

      stats.servicesByName[service.name] = (stats.servicesByName[service.name] || 0) + 1;
    }

    return stats;
  }
}

// Singleton instance
export const serviceRegistry = new InMemoryServiceRegistry();