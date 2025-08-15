import { Trade, User, Portfolio } from '@finverse/shared-types';
import { logger } from '../utils/logger';

export interface TraderProfile {
  userId: string;
  displayName: string;
  avatar: string;
  verified: boolean;
  stats: {
    totalReturn: number;
    annualizedReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
    followers: number;
    following: number;
    copiers: number;
    aum: number; // Assets Under Management from copiers
  };
  performance_history: Array<{
    date: Date;
    return: number;
    benchmark_return: number;
  }>;
  strategy: {
    description: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    timeHorizon: 'SHORT' | 'MEDIUM' | 'LONG';
    categories: string[];
    avgHoldingPeriod: number;
  };
  subscription: {
    feeStructure: 'FREE' | 'FIXED' | 'PERFORMANCE';
    fixedFee?: number;
    performanceFee?: number;
    minInvestment: number;
    maxCapacity: number;
    currentCapacity: number;
  };
  ratings: {
    overall: number;
    consistency: number;
    riskManagement: number;
    communication: number;
    transparency: number;
  };
  badges: Array<{
    type: string;
    name: string;
    description: string;
    earnedDate: Date;
  }>;
}

export interface CopyTradingSetup {
  id: string;
  copyerId: string;
  traderId: string;
  isActive: boolean;
  allocation: number; // Amount allocated to copy trading
  copyRatio: number; // Percentage of trader's position to copy (1-100%)
  riskLimits: {
    maxPositionSize: number;
    maxDailyLoss: number;
    maxDrawdown: number;
    stopCopyOnLoss: number;
  };
  filters: {
    includeSymbols: string[];
    excludeSymbols: string[];
    minTradeSize: number;
    maxTradeSize: number;
    onlyProfitableTrades: boolean;
  };
  createdAt: Date;
  performance: {
    totalReturn: number;
    totalFees: number;
    tradesCopied: number;
    successRate: number;
  };
}

export interface SocialFeed {
  posts: SocialPost[];
  trades: SocialTrade[];
  insights: MarketInsight[];
}

export interface SocialPost {
  id: string;
  userId: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'TRADE_IDEA' | 'MARKET_ANALYSIS';
  attachments: string[];
  tags: string[];
  likes: number;
  comments: Comment[];
  shares: number;
  createdAt: Date;
  engagement: {
    views: number;
    reactions: Record<string, number>;
  };
}

export interface SocialTrade {
  id: string;
  traderId: string;
  trade: Trade;
  reasoning: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number; // 1-10
  timeHorizon: 'INTRADAY' | 'SWING' | 'POSITION';
  likes: number;
  comments: Comment[];
  performance: {
    currentPnL: number;
    currentPnLPercent: number;
    isOpen: boolean;
  };
  copiedBy: number; // Number of users who copied this trade
}

export interface MarketInsight {
  id: string;
  userId: string;
  title: string;
  content: string;
  category: 'TECHNICAL' | 'FUNDAMENTAL' | 'NEWS' | 'SENTIMENT';
  symbols: string[];
  accuracy: number; // Historical accuracy of user's insights
  followers: number;
  createdAt: Date;
  predictions: Array<{
    symbol: string;
    direction: 'UP' | 'DOWN' | 'SIDEWAYS';
    timeframe: string;
    confidence: number;
    targetPrice?: number;
  }>;
}

export interface Leaderboard {
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'ALL_TIME';
  category: 'RETURN' | 'SHARPE' | 'CONSISTENCY' | 'SOCIAL_SCORE';
  traders: Array<{
    rank: number;
    userId: string;
    displayName: string;
    avatar: string;
    metric: number;
    change: number; // Change in rank
    badge?: string;
  }>;
  lastUpdated: Date;
}

export class SocialTradingEngine {
  private traderProfiles: Map<string, TraderProfile> = new Map();
  private copySetups: Map<string, CopyTradingSetup[]> = new Map();
  private socialFeed: SocialFeed = { posts: [], trades: [], insights: [] };

  async registerTrader(userId: string): Promise<TraderProfile> {
    const user = await this.getUser(userId);
    const portfolio = await this.getUserPortfolio(userId);
    const trades = await this.getUserTrades(userId);

    const stats = await this.calculateTraderStats(trades, portfolio);
    const performance_history = await this.calculatePerformanceHistory(userId);

    const profile: TraderProfile = {
      userId,
      displayName: `${user.firstName} ${user.lastName}`,
      avatar: user.avatar || '',
      verified: false,
      stats,
      performance_history,
      strategy: {
        description: '',
        riskLevel: this.assessRiskLevel(stats),
        timeHorizon: this.assessTimeHorizon(trades),
        categories: this.identifyCategories(trades),
        avgHoldingPeriod: this.calculateAvgHoldingPeriod(trades),
      },
      subscription: {
        feeStructure: 'FREE',
        minInvestment: 10000,
        maxCapacity: 1000000,
        currentCapacity: 0,
      },
      ratings: {
        overall: 0,
        consistency: 0,
        riskManagement: 0,
        communication: 0,
        transparency: 0,
      },
      badges: [],
    };

    this.traderProfiles.set(userId, profile);
    await this.checkAndAwardBadges(userId, profile);

    logger.info(`Trader profile created for user ${userId}`);
    return profile;
  }

  async setupCopyTrading(setup: Omit<CopyTradingSetup, 'id' | 'createdAt' | 'performance'>): Promise<CopyTradingSetup> {
    const copySetup: CopyTradingSetup = {
      ...setup,
      id: `copy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      performance: {
        totalReturn: 0,
        totalFees: 0,
        tradesCopied: 0,
        successRate: 0,
      },
    };

    // Validate the setup
    await this.validateCopySetup(copySetup);

    // Add to copier's setups
    const existingSetups = this.copySetups.get(setup.copyerId) || [];
    existingSetups.push(copySetup);
    this.copySetups.set(setup.copyerId, existingSetups);

    // Update trader's capacity
    const traderProfile = this.traderProfiles.get(setup.traderId);
    if (traderProfile) {
      traderProfile.subscription.currentCapacity += setup.allocation;
      traderProfile.stats.copiers += 1;
    }

    logger.info(`Copy trading setup created: ${copySetup.id}`);
    return copySetup;
  }

  async executeCopyTrade(originalTrade: Trade): Promise<void> {
    const traderId = originalTrade.userId;
    const copiers = await this.getActiveCopiers(traderId);

    for (const copySetup of copiers) {
      try {
        // Check if trade meets filters
        if (!this.passesFilters(originalTrade, copySetup.filters)) {
          continue;
        }

        // Check risk limits
        if (!await this.passesRiskLimits(copySetup, originalTrade)) {
          continue;
        }

        // Calculate copy trade size
        const copyTradeSize = this.calculateCopyTradeSize(originalTrade, copySetup);
        
        if (copyTradeSize.quantity <= 0) {
          continue;
        }

        // Execute copy trade
        const copyTrade: Trade = {
          ...originalTrade,
          id: `copy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: copySetup.copyerId,
          quantity: copyTradeSize.quantity,
          amount: copyTradeSize.amount,
          metadata: {
            ...originalTrade.metadata,
            isCopyTrade: true,
            originalTradeId: originalTrade.id,
            originalTraderId: traderId,
            copySetupId: copySetup.id,
          },
        };

        await this.executeTrade(copyTrade);
        
        // Update copy setup performance
        copySetup.performance.tradesCopied += 1;
        
        // Calculate and charge fees
        await this.calculateAndChargeFees(copySetup, copyTrade);

        logger.info(`Copy trade executed: ${copyTrade.id} for copier ${copySetup.copyerId}`);
      } catch (error) {
        logger.error(`Error executing copy trade for copier ${copySetup.copyerId}:`, error);
      }
    }
  }

  async createSocialPost(
    userId: string,
    content: string,
    type: SocialPost['type'],
    attachments: string[] = [],
    tags: string[] = []
  ): Promise<SocialPost> {
    const post: SocialPost = {
      id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      content,
      type,
      attachments,
      tags,
      likes: 0,
      comments: [],
      shares: 0,
      createdAt: new Date(),
      engagement: {
        views: 0,
        reactions: {},
      },
    };

    this.socialFeed.posts.push(post);
    
    // Notify followers
    await this.notifyFollowers(userId, 'NEW_POST', post);

    logger.info(`Social post created: ${post.id}`);
    return post;
  }

  async shareTrade(userId: string, trade: Trade, reasoning: string, sentiment: SocialTrade['sentiment'], confidence: number): Promise<SocialTrade> {
    const socialTrade: SocialTrade = {
      id: `social_trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      traderId: userId,
      trade,
      reasoning,
      sentiment,
      confidence,
      timeHorizon: this.determineTimeHorizon(trade),
      likes: 0,
      comments: [],
      performance: {
        currentPnL: 0,
        currentPnLPercent: 0,
        isOpen: true,
      },
      copiedBy: 0,
    };

    this.socialFeed.trades.push(socialTrade);
    
    // Update real-time performance
    this.startPerformanceTracking(socialTrade);

    // Notify followers
    await this.notifyFollowers(userId, 'NEW_TRADE', socialTrade);

    logger.info(`Trade shared: ${socialTrade.id}`);
    return socialTrade;
  }

  async publishMarketInsight(userId: string, insight: Omit<MarketInsight, 'id' | 'userId' | 'createdAt' | 'accuracy' | 'followers'>): Promise<MarketInsight> {
    const userAccuracy = await this.calculateUserAccuracy(userId);
    const followers = await this.getFollowerCount(userId);

    const marketInsight: MarketInsight = {
      ...insight,
      id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      createdAt: new Date(),
      accuracy: userAccuracy,
      followers,
    };

    this.socialFeed.insights.push(marketInsight);
    
    // Notify interested users based on symbols
    await this.notifyInterestedUsers(marketInsight);

    logger.info(`Market insight published: ${marketInsight.id}`);
    return marketInsight;
  }

  async generateLeaderboard(period: Leaderboard['period'], category: Leaderboard['category']): Promise<Leaderboard> {
    const traders = Array.from(this.traderProfiles.values());
    
    // Filter and sort based on period and category
    const rankedTraders = traders
      .filter(trader => this.isEligibleForLeaderboard(trader, period))
      .sort((a, b) => this.compareTraders(a, b, category))
      .slice(0, 100) // Top 100
      .map((trader, index) => ({
        rank: index + 1,
        userId: trader.userId,
        displayName: trader.displayName,
        avatar: trader.avatar,
        metric: this.getMetricValue(trader, category),
        change: 0, // Would calculate from previous leaderboard
        badge: this.getLeaderboardBadge(index + 1),
      }));

    return {
      period,
      category,
      traders: rankedTraders,
      lastUpdated: new Date(),
    };
  }

  async getPersonalizedFeed(userId: string, page: number = 1, limit: number = 20): Promise<{
    posts: SocialPost[];
    trades: SocialTrade[];
    insights: MarketInsight[];
    recommendations: TraderProfile[];
  }> {
    const userInterests = await this.getUserInterests(userId);
    const following = await this.getFollowing(userId);
    
    // Get posts from followed users and trending content
    const posts = this.socialFeed.posts
      .filter(post => 
        following.includes(post.userId) || 
        this.isRelevantToUser(post, userInterests)
      )
      .sort((a, b) => this.calculateEngagementScore(b) - this.calculateEngagementScore(a))
      .slice((page - 1) * limit, page * limit);

    // Get trades from followed traders and similar strategies
    const trades = this.socialFeed.trades
      .filter(trade => 
        following.includes(trade.traderId) || 
        this.isRelevantTrade(trade, userInterests)
      )
      .sort((a, b) => b.performance.currentPnLPercent - a.performance.currentPnLPercent)
      .slice((page - 1) * limit, page * limit);

    // Get relevant market insights
    const insights = this.socialFeed.insights
      .filter(insight => 
        following.includes(insight.userId) || 
        insight.symbols.some(symbol => userInterests.symbols.includes(symbol))
      )
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice((page - 1) * limit, page * limit);

    // Get trader recommendations
    const recommendations = await this.getTraderRecommendations(userId, 10);

    return {
      posts,
      trades,
      insights,
      recommendations,
    };
  }

  private async calculateTraderStats(trades: Trade[], portfolio: Portfolio) {
    const returns = this.calculateReturns(trades);
    const totalReturn = returns.reduce((sum, ret) => sum + ret, 0);
    const annualizedReturn = this.annualizeReturn(totalReturn, trades);
    
    const wins = trades.filter(t => this.calculateTradePnL(t) > 0);
    const winRate = (wins.length / trades.length) * 100;
    
    return {
      totalReturn,
      annualizedReturn,
      sharpeRatio: this.calculateSharpeRatio(returns),
      maxDrawdown: this.calculateMaxDrawdown(returns),
      winRate,
      totalTrades: trades.length,
      followers: 0,
      following: 0,
      copiers: 0,
      aum: 0,
    };
  }

  private async checkAndAwardBadges(userId: string, profile: TraderProfile): Promise<void> {
    const badges = [];

    // Performance badges
    if (profile.stats.totalReturn > 50) {
      badges.push({
        type: 'PERFORMANCE',
        name: 'Star Performer',
        description: 'Achieved 50%+ returns',
        earnedDate: new Date(),
      });
    }

    // Consistency badges
    if (profile.stats.sharpeRatio > 2) {
      badges.push({
        type: 'CONSISTENCY',
        name: 'Consistent Trader',
        description: 'Sharpe ratio above 2.0',
        earnedDate: new Date(),
      });
    }

    // Social badges
    if (profile.stats.followers > 1000) {
      badges.push({
        type: 'SOCIAL',
        name: 'Influencer',
        description: '1000+ followers',
        earnedDate: new Date(),
      });
    }

    profile.badges = badges;
  }

  private passesFilters(trade: Trade, filters: CopyTradingSetup['filters']): boolean {
    // Include/exclude symbols
    if (filters.includeSymbols.length > 0 && !filters.includeSymbols.includes(trade.symbol)) {
      return false;
    }
    
    if (filters.excludeSymbols.includes(trade.symbol)) {
      return false;
    }

    // Trade size limits
    if (trade.amount < filters.minTradeSize || trade.amount > filters.maxTradeSize) {
      return false;
    }

    return true;
  }

  private calculateCopyTradeSize(originalTrade: Trade, copySetup: CopyTradingSetup): { quantity: number; amount: number } {
    const baseRatio = copySetup.copyRatio / 100;
    const allocation = copySetup.allocation;
    
    // Calculate proportional size based on available allocation
    const tradeValue = originalTrade.quantity * originalTrade.price;
    const proportionalValue = Math.min(tradeValue * baseRatio, allocation * 0.1); // Max 10% of allocation per trade
    
    const quantity = Math.floor(proportionalValue / originalTrade.price);
    const amount = quantity * originalTrade.price;
    
    return { quantity, amount };
  }

  private calculateEngagementScore(post: SocialPost): number {
    const ageHours = (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60);
    const ageFactor = Math.exp(-ageHours / 24); // Decay over 24 hours
    
    const engagementScore = (post.likes * 1 + post.comments.length * 2 + post.shares * 3) * ageFactor;
    return engagementScore;
  }

  // Additional helper methods would be implemented here...
}