import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServiceLogger, ServiceBase } from '@finverse/shared-utils';
import { AppDataSource, Portfolio, initializeDatabase } from '@finverse/shared-database';

const logger = createServiceLogger('portfolio-service');

class PortfolioService extends ServiceBase {
  private app: express.Application;
  private server: any;

  constructor() {
    super('portfolio-service');
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  async initialize(): Promise<void> {
    try {
      await initializeDatabase();
      logger.info('✅ Portfolio Service initialized');
    } catch (error) {
      logger.error('❌ Portfolio Service initialization failed:', error);
      throw error;
    }
  }

  protected async cleanup(): Promise<void> {
    if (this.server) {
      this.server.close();
    }
  }

  protected async performHealthCheck(): Promise<any> {
    try {
      await AppDataSource.query('SELECT 1');
      return {
        database: 'healthy',
        uptime: process.uptime(),
      };
    } catch (error) {
      throw new Error(`Health check failed: ${error.message}`);
    }
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
        service: 'portfolio-service',
        timestamp: new Date().toISOString(),
      });
    });

    this.app.get('/', async (req, res) => {
      try {
        const userId = req.headers['x-user-id'] as string;
        
        if (!userId) {
          return res.status(400).json({
            success: false,
            error: { code: 'MISSING_USER_ID', message: 'User ID is required' },
          });
        }

        // Mock portfolio data
        const portfolio = {
          id: `portfolio_${userId}`,
          userId,
          name: 'Default Portfolio',
          totalValue: 250000,
          totalInvested: 200000,
          totalPnl: 50000,
          totalPnlPercentage: 25.0,
          holdings: [
            {
              symbol: 'RELIANCE',
              exchange: 'NSE',
              quantity: 50,
              averagePrice: 2500,
              currentPrice: 2650,
              marketValue: 132500,
              pnl: 7500,
              pnlPercentage: 6.0,
            },
            {
              symbol: 'TCS',
              exchange: 'NSE',
              quantity: 30,
              averagePrice: 3200,
              currentPrice: 3450,
              marketValue: 103500,
              pnl: 7500,
              pnlPercentage: 7.8,
            },
          ],
          riskScore: 65,
          diversificationScore: 70,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        res.json({
          success: true,
          data: portfolio,
        });
      } catch (error) {
        logger.error('Error fetching portfolio:', error);
        res.status(500).json({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch portfolio' },
        });
      }
    });

    this.app.get('/holdings', (req, res) => {
      const userId = req.headers['x-user-id'] as string;
      
      res.json({
        success: true,
        data: [
          {
            symbol: 'RELIANCE',
            exchange: 'NSE',
            quantity: 50,
            averagePrice: 2500,
            currentPrice: 2650,
            marketValue: 132500,
            pnl: 7500,
            pnlPercentage: 6.0,
          },
          {
            symbol: 'TCS',
            exchange: 'NSE',
            quantity: 30,
            averagePrice: 3200,
            currentPrice: 3450,
            marketValue: 103500,
            pnl: 7500,
            pnlPercentage: 7.8,
          },
        ],
      });
    });

    this.app.get('/performance', (req, res) => {
      const period = req.query.period || '1M';
      
      res.json({
        success: true,
        data: {
          period,
          totalReturn: 25.0,
          benchmarkReturn: 15.0,
          alpha: 10.0,
          beta: 1.2,
          sharpeRatio: 1.5,
          volatility: 18.5,
          maxDrawdown: -8.2,
          performance: Array.from({ length: 30 }, (_, i) => ({
            date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            value: 200000 + Math.random() * 50000,
          })),
        },
      });
    });
  }

  public async startServer(): Promise<void> {
    const port = 3005;
    this.server = this.app.listen(port, () => {
      logger.info(`✅ Portfolio Service running on port ${port}`);
    });
  }
}

async function main() {
  const service = new PortfolioService();
  try {
    await service.start();
    await service.startServer();
  } catch (error) {
    logger.error('Failed to start Portfolio Service:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { PortfolioService };