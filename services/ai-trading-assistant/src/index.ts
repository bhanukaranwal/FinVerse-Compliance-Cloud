import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import OpenAI from 'openai';
import { createServiceLogger, ServiceBase } from '@finverse/shared-utils';

const logger = createServiceLogger('ai-trading-assistant');

class AITradingAssistantService extends ServiceBase {
  private app: express.Application;
  private server: any;
  private openai?: OpenAI;

  constructor() {
    super('ai-trading-assistant');
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  async initialize(): Promise<void> {
    try {
      // Initialize OpenAI if API key is provided
      if (process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        logger.info('OpenAI client initialized');
      } else {
        logger.warn('OpenAI API key not provided, using mock responses');
      }
      
      logger.info('✅ AI Trading Assistant Service initialized');
    } catch (error) {
      logger.error('❌ AI Trading Assistant Service initialization failed:', error);
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
      openaiEnabled: !!this.openai,
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
        service: 'ai-trading-assistant',
        timestamp: new Date().toISOString(),
      });
    });

    this.app.post('/recommendations', async (req, res) => {
      try {
        const { symbol, userProfile } = req.body;
        
        let recommendation;
        
        if (this.openai) {
          // Use real OpenAI API
          const completion = await this.openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: "You are an expert financial analyst. Provide trading recommendations based on the given information."
              },
              {
                role: "user",
                content: `Analyze ${symbol} for a trader with risk tolerance: ${userProfile?.riskTolerance || 'MODERATE'}`
              }
            ],
            max_tokens: 500,
            temperature: 0.3,
          });

          recommendation = {
            symbol,
            action: 'HOLD',
            confidence: 75,
            targetPrice: 2750,
            stopLoss: 2400,
            reasoning: completion.choices[0]?.message?.content || 'AI analysis unavailable',
            aiPowered: true,
          };
        } else {
          // Mock recommendation
          recommendation = {
            symbol,
            action: 'BUY',
            confidence: 78,
            targetPrice: 2750,
            stopLoss: 2400,
            reasoning: `Based on technical analysis, ${symbol} shows strong momentum with good support levels. Consider buying with a target of ₹2,750 and stop loss at ₹2,400.`,
            aiPowered: false,
          };
        }

        res.json({
          success: true,
          data: recommendation,
        });
      } catch (error) {
        logger.error('Error generating recommendation:', error);
        res.status(500).json({
          success: false,
          error: { code: 'AI_ERROR', message: 'Failed to generate recommendation' },
        });
      }
    });

    this.app.get('/market-analysis', async (req, res) => {
      try {
        const analysis = {
          marketTrend: 'BULLISH',
          volatility: 'MEDIUM',
          sentiment: 'POSITIVE',
          topGainers: [
            { symbol: 'RELIANCE', change: 3.5 },
            { symbol: 'TCS', change: 2.8 },
            { symbol: 'HDFC', change: 2.1 },
          ],
          topLosers: [
            { symbol: 'BHARTIARTL', change: -1.8 },
            { symbol: 'ICICIBANK', change: -1.2 },
          ],
          aiInsights: 'Market showing positive momentum with technology and banking sectors leading. Consider defensive positions in volatile times.',
          lastUpdated: new Date().toISOString(),
        };

        res.json({
          success: true,
          data: analysis,
        });
      } catch (error) {
        logger.error('Error generating market analysis:', error);
        res.status(500).json({
          success: false,
          error: { code: 'AI_ERROR', message: 'Failed to generate market analysis' },
        });
      }
    });

    this.app.get('/dashboard/:userId', async (req, res) => {
      try {
        const { userId } = req.params;
        
        const dashboard = {
          userId,
          personalizedInsights: [
            'Your portfolio is well-diversified across sectors',
            'Consider rebalancing your tech holdings',
            'Good time to book profits in banking stocks',
          ],
          riskScore: 65,
          recommendations: [
            {
              type: 'REBALANCE',
              message: 'Consider reducing exposure to banking sector',
              priority: 'MEDIUM',
            },
            {
              type: 'OPPORTUNITY',
              message: 'FMCG stocks showing good value',
              priority: 'LOW',
            },
          ],
          marketOpportunities: [
            { symbol: 'NESTLEIND', reason: 'Undervalued with strong fundamentals' },
            { symbol: 'HDFCBANK', reason: 'Good entry point after recent correction' },
          ],
          generatedAt: new Date().toISOString(),
        };

        res.json({
          success: true,
          data: dashboard,
        });
      } catch (error) {
        logger.error('Error generating personalized dashboard:', error);
        res.status(500).json({
          success: false,
          error: { code: 'AI_ERROR', message: 'Failed to generate dashboard' },
        });
      }
    });
  }

  public async startServer(): Promise<void> {
    const port = 3009;
    this.server = this.app.listen(port, () => {
      logger.info(`✅ AI Trading Assistant Service running on port ${port}`);
    });
  }
}

async function main() {
  const service = new AITradingAssistantService();
  try {
    await service.start();
    await service.startServer();
  } catch (error) {
    logger.error('Failed to start AI Trading Assistant Service:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { AITradingAssistantService };