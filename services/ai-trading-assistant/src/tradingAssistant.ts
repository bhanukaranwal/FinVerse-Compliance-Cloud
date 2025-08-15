import OpenAI from 'openai';
import { TechnicalIndicatorEngine } from './technicalAnalysis';
import { MarketSentimentAnalyzer } from './sentimentAnalysis';
import { NewsAnalyzer } from './newsAnalysis';
import { RiskAssessment } from './riskAssessment';
import { logger } from '../utils/logger';

export interface TradingRecommendation {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD' | 'AVOID';
  confidence: number; // 0-100
  targetPrice: number;
  stopLoss: number;
  timeHorizon: 'INTRADAY' | 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM';
  reasoning: {
    technical: string[];
    fundamental: string[];
    sentiment: string[];
    risk: string[];
  };
  aiAnalysis: string;
  expectedReturn: number;
  riskScore: number;
  marketConditions: MarketCondition;
  alternativeOptions: AlternativeOption[];
  complianceChecks: ComplianceCheck[];
  taxImplications: TaxImplication[];
}

export interface MarketCondition {
  trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  volatility: 'LOW' | 'MEDIUM' | 'HIGH';
  liquidity: 'LOW' | 'MEDIUM' | 'HIGH';
  sentiment: 'FEAR' | 'GREED' | 'NEUTRAL';
  economicIndicators: EconomicIndicator[];
}

export interface AlternativeOption {
  symbol: string;
  reason: string;
  similarity: number;
  potentialReturn: number;
  riskLevel: number;
}

export interface EconomicIndicator {
  name: string;
  value: number;
  trend: 'IMPROVING' | 'DECLINING' | 'STABLE';
  impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}

export class AdvancedTradingAssistant {
  private openai: OpenAI;
  private technicalEngine: TechnicalIndicatorEngine;
  private sentimentAnalyzer: MarketSentimentAnalyzer;
  private newsAnalyzer: NewsAnalyzer;
  private riskAssessment: RiskAssessment;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.technicalEngine = new TechnicalIndicatorEngine();
    this.sentimentAnalyzer = new MarketSentimentAnalyzer();
    this.newsAnalyzer = new NewsAnalyzer();
    this.riskAssessment = new RiskAssessment();
  }

  async generateTradingRecommendation(
    symbol: string,
    userProfile: UserTradingProfile,
    marketData: ExtendedMarketData
  ): Promise<TradingRecommendation> {
    logger.info(`Generating trading recommendation for ${symbol}`);

    try {
      // Parallel analysis for performance
      const [
        technicalAnalysis,
        fundamentalAnalysis,
        sentimentAnalysis,
        newsAnalysis,
        riskAnalysis,
        marketConditions,
        economicData,
        sectorAnalysis,
        competitorAnalysis,
        optionsData
      ] = await Promise.all([
        this.performTechnicalAnalysis(symbol, marketData),
        this.performFundamentalAnalysis(symbol),
        this.sentimentAnalyzer.analyzeSentiment(symbol),
        this.newsAnalyzer.analyzeRecentNews(symbol, 24), // Last 24 hours
        this.riskAssessment.assessRisk(symbol, userProfile),
        this.analyzeMarketConditions(),
        this.getEconomicIndicators(),
        this.analyzeSectorTrends(symbol),
        this.analyzeCompetitors(symbol),
        this.getOptionsChainAnalysis(symbol)
      ]);

      // Generate AI-powered analysis using GPT-4
      const aiAnalysis = await this.generateAIAnalysis({
        symbol,
        technicalAnalysis,
        fundamentalAnalysis,
        sentimentAnalysis,
        newsAnalysis,
        riskAnalysis,
        marketConditions,
        userProfile,
        sectorAnalysis,
        competitorAnalysis,
        optionsData
      });

      // Compile comprehensive recommendation
      const recommendation = await this.compileRecommendation({
        symbol,
        analyses: {
          technical: technicalAnalysis,
          fundamental: fundamentalAnalysis,
          sentiment: sentimentAnalysis,
          news: newsAnalysis,
          risk: riskAnalysis,
          ai: aiAnalysis
        },
        marketConditions,
        userProfile,
        economicData,
        sectorAnalysis,
        competitorAnalysis,
        optionsData
      });

      // Validate recommendation against compliance rules
      const complianceChecks = await this.validateCompliance(recommendation, userProfile);
      recommendation.complianceChecks = complianceChecks;

      // Calculate tax implications
      const taxImplications = await this.calculateTaxImplications(recommendation, userProfile);
      recommendation.taxImplications = taxImplications;

      logger.info(`Generated recommendation for ${symbol}: ${recommendation.action} with ${recommendation.confidence}% confidence`);
      return recommendation;

    } catch (error) {
      logger.error(`Error generating recommendation for ${symbol}:`, error);
      throw new Error(`Failed to generate trading recommendation: ${error.message}`);
    }
  }

  private async generateAIAnalysis(data: any): Promise<string> {
    const prompt = this.constructAnalysisPrompt(data);
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: `You are an expert financial analyst and trading advisor specializing in Indian stock markets. 
            Provide detailed, actionable trading insights considering technical analysis, fundamental analysis, 
            market sentiment, news impact, and risk factors. Always include specific reasoning and be aware of 
            Indian market regulations and tax implications.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.3 // Lower temperature for more focused analysis
      });

      return completion.choices[0]?.message?.content || "Unable to generate AI analysis";
    } catch (error) {
      logger.error('Error generating AI analysis:', error);
      return "AI analysis temporarily unavailable";
    }
  }

  private constructAnalysisPrompt(data: any): string {
    return `
Analyze the following trading opportunity for ${data.symbol}:

TECHNICAL ANALYSIS:
- Current Price: ₹${data.marketData?.ltp}
- RSI: ${data.technicalAnalysis?.rsi}
- MACD: ${data.technicalAnalysis?.macd}
- Moving Averages: SMA20=${data.technicalAnalysis?.sma20}, SMA50=${data.technicalAnalysis?.sma50}
- Support Levels: ${data.technicalAnalysis?.support?.join(', ')}
- Resistance Levels: ${data.technicalAnalysis?.resistance?.join(', ')}
- Volume Trend: ${data.technicalAnalysis?.volumeTrend}

FUNDAMENTAL ANALYSIS:
- P/E Ratio: ${data.fundamentalAnalysis?.peRatio}
- P/B Ratio: ${data.fundamentalAnalysis?.pbRatio}
- Debt-to-Equity: ${data.fundamentalAnalysis?.debtToEquity}
- ROE: ${data.fundamentalAnalysis?.roe}%
- Revenue Growth: ${data.fundamentalAnalysis?.revenueGrowth}%
- Profit Growth: ${data.fundamentalAnalysis?.profitGrowth}%

MARKET SENTIMENT:
- Overall Sentiment: ${data.sentimentAnalysis?.overall}
- Social Media Sentiment: ${data.sentimentAnalysis?.socialMedia}
- News Sentiment: ${data.sentimentAnalysis?.news}
- Institutional Activity: ${data.sentimentAnalysis?.institutional}

NEWS ANALYSIS:
${data.newsAnalysis?.recentNews?.map((news: any) => `- ${news.headline} (Impact: ${news.impact})`).join('\n')}

SECTOR ANALYSIS:
- Sector Performance: ${data.sectorAnalysis?.performance}
- Sector Outlook: ${data.sectorAnalysis?.outlook}
- Peer Comparison: ${data.sectorAnalysis?.peerComparison}

RISK FACTORS:
- Overall Risk Score: ${data.riskAnalysis?.overallRisk}/10
- Liquidity Risk: ${data.riskAnalysis?.liquidityRisk}
- Volatility Risk: ${data.riskAnalysis?.volatilityRisk}
- Market Risk: ${data.riskAnalysis?.marketRisk}

USER PROFILE:
- Risk Tolerance: ${data.userProfile?.riskTolerance}
- Investment Horizon: ${data.userProfile?.investmentHorizon}
- Portfolio Size: ₹${data.userProfile?.portfolioSize}
- Experience Level: ${data.userProfile?.experienceLevel}

Please provide:
1. Clear BUY/SELL/HOLD recommendation with confidence level
2. Target price and stop-loss levels
3. Key reasoning points (technical, fundamental, sentiment)
4. Risk assessment and mitigation strategies
5. Time horizon for the trade
6. Alternative investment options
7. Specific considerations for Indian market regulations
8. Tax optimization strategies
9. Position sizing recommendations
10. Market timing considerations

Format your response in a clear, structured manner suitable for both novice and experienced traders.
`;
  }

  async performRealTimeMarketAnalysis(): Promise<RealTimeMarketInsights> {
    const [
      topGainers,
      topLosers,
      volumeBuzzers,
      breakoutStocks,
      sectorPerformance,
      marketSentiment,
      fiiDiiData,
      globalMarkets,
      economicCalendar,
      newsFlow
    ] = await Promise.all([
      this.getTopGainers(),
      this.getTopLosers(),
      this.getVolumeBuzzers(),
      this.detectBreakouts(),
      this.analyzeSectorPerformance(),
      this.getMarketSentiment(),
      this.getFIIDIIData(),
      this.getGlobalMarketData(),
      this.getEconomicCalendar(),
      this.getMarketNewsFlow()
    ]);

    const aiInsights = await this.generateMarketCommentary({
      topGainers,
      topLosers,
      volumeBuzzers,
      breakoutStocks,
      sectorPerformance,
      marketSentiment,
      fiiDiiData,
      globalMarkets,
      economicCalendar,
      newsFlow
    });

    return {
      timestamp: new Date(),
      marketOverview: {
        nifty: await this.getIndexData('NIFTY'),
        sensex: await this.getIndexData('SENSEX'),
        bankNifty: await this.getIndexData('BANKNIFTY'),
        trend: this.determineMarketTrend(),
        volatility: this.calculateVIX(),
      },
      topGainers,
      topLosers,
      volumeBuzzers,
      breakoutStocks,
      sectorPerformance,
      marketSentiment,
      fiiDiiData,
      globalMarkets,
      economicCalendar,
      newsFlow,
      aiInsights,
      tradingOpportunities: await this.identifyTradingOpportunities(),
      riskAlerts: await this.generateRiskAlerts(),
    };
  }

  async generatePersonalizedDashboard(userId: string): Promise<PersonalizedDashboard> {
    const userProfile = await this.getUserTradingProfile(userId);
    const portfolio = await this.getUserPortfolio(userId);
    const watchlist = await this.getUserWatchlist(userId);
    const recentTrades = await this.getUserRecentTrades(userId);

    const [
      portfolioAnalysis,
      watchlistAnalysis,
      personalizationInsights,
      recommendedActions,
      riskAssessment,
      performanceAnalysis,
      goalProgress,
      learningRecommendations
    ] = await Promise.all([
      this.analyzePortfolioHealth(portfolio),
      this.analyzeWatchlist(watchlist),
      this.generatePersonalizationInsights(userProfile, portfolio),
      this.generateRecommendedActions(userProfile, portfolio),
      this.assessPortfolioRisk(portfolio),
      this.analyzePerformance(recentTrades, portfolio),
      this.trackGoalProgress(userId),
      this.generateLearningRecommendations(userProfile)
    ]);

    return {
      userId,
      generatedAt: new Date(),
      portfolio: {
        totalValue: portfolio.totalValue,
        dayPnL: portfolioAnalysis.dayPnL,
        totalPnL: portfolioAnalysis.totalPnL,
        allocation: portfolioAnalysis.allocation,
        riskScore: riskAssessment.overallScore,
        diversificationScore: portfolioAnalysis.diversificationScore,
      },
      insights: personalizationInsights,
      recommendations: recommendedActions,
      alerts: await this.generatePersonalizedAlerts(userId),
      performance: performanceAnalysis,
      goals: goalProgress,
      learning: learningRecommendations,
      marketOpportunities: await this.findPersonalizedOpportunities(userProfile),
    };
  }
}

export interface UserTradingProfile {
  userId: string;
  riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  investmentHorizon: 'SHORT' | 'MEDIUM' | 'LONG';
  portfolioSize: number;
  experienceLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  tradingStyle: 'INTRADAY' | 'SWING' | 'POSITIONAL' | 'INVESTMENT';
  preferredSectors: string[];
  blacklistedStocks: string[];
  maxPositionSize: number;
  stopLossPreference: number;
  targetReturnExpectation: number;
  goals: InvestmentGoal[];
}

export interface InvestmentGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: Date;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'RETIREMENT' | 'HOUSE' | 'EDUCATION' | 'EMERGENCY' | 'WEALTH_CREATION';
}