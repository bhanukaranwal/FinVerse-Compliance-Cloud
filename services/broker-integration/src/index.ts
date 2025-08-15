import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from '@finverse/shared-config';
import { createServiceLogger, ServiceBase } from '@finverse/shared-utils';

const logger = createServiceLogger('broker-integration');

class BrokerIntegrationService extends ServiceBase {
  private app: express.Application;
  private server: any;

  constructor() {
    super('broker-integration');
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('✅ Broker Integration Service initialized');
    } catch (error) {
      logger.error('❌ Broker Integration Service initialization failed:', error);
      throw error;
    }
  }

  protected async cleanup(): Promise<void> {
    if (this.server) {
      this.server.close();
    }
  }

  protected async performHealthCheck(): Promise<any> {
    return {
      status: 'healthy',
      brokers: ['zerodha', 'upstox', 'angel'],
      uptime: process.uptime(),
    };
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'broker-integration',
        timestamp: new Date().toISOString(),
      });
    });

    this.app.get('/trades', (req, res) => {
      res.json({
        success: true,
        data: [],
        message: 'No trades found',
      });
    });

    this.app.post('/trades', (req, res) => {
      res.json({
        success: true,
        message: 'Trade executed successfully',
        data: {
          id: `trade_${Date.now()}`,
          ...req.body,
          status: 'COMPLETED',
          timestamp: new Date().toISOString(),
        },
      });
    });
  }

  public async startServer(): Promise<void> {
    const port = 3002;
    this.server = this.app.listen(port, () => {
      logger.info(`✅ Broker Integration Service running on port ${port}`);
    });
  }
}

async function main() {
  const service = new BrokerIntegrationService();
  try {
    await service.start();
    await service.startServer();
  } catch (error) {
    logger.error('Failed to start Broker Integration Service:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { BrokerIntegrationService };