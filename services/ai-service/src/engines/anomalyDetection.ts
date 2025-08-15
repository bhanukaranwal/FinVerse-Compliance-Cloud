import * as tf from '@tensorflow/tfjs-node';
import { Trade, Portfolio, User } from '@finverse/shared-types';
import { logger } from '../utils/logger';

export interface AnomalyScore {
  score: number;
  confidence: number;
  factors: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendations: string[];
}

export interface TradingPattern {
  userId: string;
  pattern: string;
  frequency: number;
  riskLevel: number;
  profitability: number;
  consistency: number;
}

export class AnomalyDetectionEngine {
  private model: tf.LayersModel | null = null;
  private isInitialized = false;

  async initialize() {
    try {
      // Load pre-trained model or create new one
      this.model = await this.loadOrCreateModel();
      this.isInitialized = true;
      logger.info('Anomaly detection engine initialized');
    } catch (error) {
      logger.error('Failed to initialize anomaly detection engine:', error);
      throw error;
    }
  }

  async detectTradingAnomalies(trades: Trade[], user: User): Promise<AnomalyScore> {
    if (!this.isInitialized || !this.model) {
      throw new Error('Anomaly detection engine not initialized');
    }

    const features = this.extractTradingFeatures(trades, user);
    const prediction = this.model.predict(features) as tf.Tensor;
    const scores = await prediction.data();
    
    const anomalyScore = scores[0];
    const severity = this.calculateSeverity(anomalyScore);
    const factors = this.identifyAnomalyFactors(trades, user);
    const recommendations = this.generateRecommendations(factors, severity);

    return {
      score: anomalyScore,
      confidence: Math.min(0.95, 0.7 + (Math.abs(anomalyScore - 0.5) * 0.5)),
      factors,
      severity,
      recommendations,
    };
  }

  async detectPortfolioRiskAnomalies(portfolio: Portfolio): Promise<AnomalyScore> {
    const riskMetrics = this.calculateRiskMetrics(portfolio);
    const features = this.extractPortfolioFeatures(portfolio, riskMetrics);
    
    // Use ensemble of models for better accuracy
    const predictions = await Promise.all([
      this.detectConcentrationRisk(portfolio),
      this.detectVolatilityAnomaly(portfolio),
      this.detectCorrelationAnomaly(portfolio),
      this.detectLiquidityRisk(portfolio),
    ]);

    const aggregatedScore = predictions.reduce((sum, pred) => sum + pred.score, 0) / predictions.length;
    const factors = predictions.flatMap(pred => pred.factors);
    const severity = this.calculateSeverity(aggregatedScore);

    return {
      score: aggregatedScore,
      confidence: 0.85,
      factors: [...new Set(factors)],
      severity,
      recommendations: this.generatePortfolioRecommendations(predictions),
    };
  }

  async predictTradingBehavior(trades: Trade[], timeframe: number): Promise<{
    nextTradesPrediction: Array<{
      symbol: string;
      side: 'buy' | 'sell';
      probability: number;
      suggestedQuantity: number;
      riskScore: number;
    }>;
    behaviorChanges: Array<{
      metric: string;
      currentValue: number;
      predictedValue: number;
      changePercentage: number;
    }>;
  }> {
    const patterns = this.analyzeTradingPatterns(trades);
    const behaviorMetrics = this.calculateBehaviorMetrics(trades);
    
    // Predict next trades using sequence modeling
    const nextTradesPrediction = await this.predictNextTrades(patterns, timeframe);
    
    // Predict behavior changes
    const behaviorChanges = await this.predictBehaviorChanges(behaviorMetrics, timeframe);

    return {
      nextTradesPrediction,
      behaviorChanges,
    };
  }

  private extractTradingFeatures(trades: Trade[], user: User): tf.Tensor {
    const features = [];
    
    // Temporal features
    const tradingHours = trades.map(t => t.timestamp.getHours());
    features.push(this.calculateMean(tradingHours));
    features.push(this.calculateStdDev(tradingHours));
    
    // Volume features
    const volumes = trades.map(t => t.quantity);
    features.push(this.calculateMean(volumes));
    features.push(this.calculateStdDev(volumes));
    features.push(Math.max(...volumes) / Math.min(...volumes)); // Volume ratio
    
    // Frequency features
    const dailyTrades = this.groupTradesByDay(trades);
    features.push(Object.keys(dailyTrades).length); // Trading days
    features.push(trades.length / Object.keys(dailyTrades).length); // Avg trades per day
    
    // Risk features
    const riskScores = trades.map(t => this.calculateTradeRiskScore(t));
    features.push(this.calculateMean(riskScores));
    features.push(this.calculateStdDev(riskScores));
    
    // Behavioral features
    const buyTrades = trades.filter(t => t.side === 'buy');
    const sellTrades = trades.filter(t => t.side === 'sell');
    features.push(buyTrades.length / trades.length); // Buy ratio
    features.push(this.calculateAverageHoldingPeriod(trades));
    
    // User profile features
    features.push(this.getUserExperienceScore(user));
    features.push(this.getUserRiskTolerance(user));
    
    return tf.tensor2d([features]);
  }

  private async loadOrCreateModel(): Promise<tf.LayersModel> {
    try {
      // Try to load existing model
      return await tf.loadLayersModel('file://./models/anomaly_detection/model.json');
    } catch {
      // Create new model if none exists
      return this.createAnomalyDetectionModel();
    }
  }

  private createAnomalyDetectionModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [20], // 20 features
          units: 64,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.01 }),
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 32,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.01 }),
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 16,
          activation: 'relu',
        }),
        tf.layers.dense({
          units: 1,
          activation: 'sigmoid', // Anomaly probability
        }),
      ],
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy'],
    });

    return model;
  }

  private calculateSeverity(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score < 0.3) return 'LOW';
    if (score < 0.6) return 'MEDIUM';
    if (score < 0.8) return 'HIGH';
    return 'CRITICAL';
  }

  private identifyAnomalyFactors(trades: Trade[], user: User): string[] {
    const factors: string[] = [];
    
    // Check for unusual trading patterns
    const tradingHours = trades.map(t => t.timestamp.getHours());
    const afterHoursTrading = tradingHours.filter(h => h < 9 || h > 15.5).length;
    if (afterHoursTrading / trades.length > 0.1) {
      factors.push('Unusual trading hours detected');
    }
    
    // Check for high-frequency trading
    const avgTradesPerDay = trades.length / this.getUniqueTradingDays(trades);
    if (avgTradesPerDay > 50) {
      factors.push('High-frequency trading pattern');
    }
    
    // Check for large position sizes
    const avgPositionSize = this.calculateMean(trades.map(t => t.amount));
    const maxPositionSize = Math.max(...trades.map(t => t.amount));
    if (maxPositionSize > avgPositionSize * 10) {
      factors.push('Unusually large position sizes');
    }
    
    // Check for concentration risk
    const symbolConcentration = this.calculateSymbolConcentration(trades);
    if (symbolConcentration > 0.5) {
      factors.push('High concentration in few symbols');
    }
    
    return factors;
  }

  private generateRecommendations(factors: string[], severity: string): string[] {
    const recommendations: string[] = [];
    
    if (factors.includes('Unusual trading hours detected')) {
      recommendations.push('Review trading schedule and consider market impact');
      recommendations.push('Ensure compliance with after-hours trading regulations');
    }
    
    if (factors.includes('High-frequency trading pattern')) {
      recommendations.push('Monitor for wash trading violations');
      recommendations.push('Consider transaction cost analysis');
      recommendations.push('Review compliance with HFT regulations');
    }
    
    if (factors.includes('Unusually large position sizes')) {
      recommendations.push('Implement position sizing controls');
      recommendations.push('Review risk management policies');
    }
    
    if (severity === 'CRITICAL') {
      recommendations.push('Immediate manual review required');
      recommendations.push('Consider temporary trading restrictions');
      recommendations.push('Contact compliance team');
    }
    
    return recommendations;
  }

  // Additional helper methods...
  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateStdDev(values: number[]): number {
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return Math.sqrt(this.calculateMean(squaredDiffs));
  }

  private groupTradesByDay(trades: Trade[]): Record<string, Trade[]> {
    return trades.reduce((groups, trade) => {
      const day = trade.timestamp.toISOString().split('T')[0];
      if (!groups[day]) groups[day] = [];
      groups[day].push(trade);
      return groups;
    }, {} as Record<string, Trade[]>);
  }

  private calculateTradeRiskScore(trade: Trade): number {
    // Simplified risk scoring based on amount, volatility, etc.
    const sizeScore = Math.min(trade.amount / 100000, 1); // Normalize by 1L
    const timeScore = this.isMarketHours(trade.timestamp) ? 0 : 0.5;
    return (sizeScore + timeScore) / 2;
  }

  private isMarketHours(timestamp: Date): boolean {
    const hour = timestamp.getHours();
    const minute = timestamp.getMinutes();
    return hour >= 9 && (hour < 15 || (hour === 15 && minute <= 30));
  }

  private calculateAverageHoldingPeriod(trades: Trade[]): number {
    // Simplified calculation - in reality, you'd need to match buy/sell pairs
    const buyTrades = trades.filter(t => t.side === 'buy');
    const sellTrades = trades.filter(t => t.side === 'sell');
    
    if (buyTrades.length === 0 || sellTrades.length === 0) return 0;
    
    // Approximate holding period calculation
    const avgBuyTime = buyTrades.reduce((sum, t) => sum + t.timestamp.getTime(), 0) / buyTrades.length;
    const avgSellTime = sellTrades.reduce((sum, t) => sum + t.timestamp.getTime(), 0) / sellTrades.length;
    
    return Math.abs(avgSellTime - avgBuyTime) / (1000 * 60 * 60 * 24); // Days
  }

  private getUserExperienceScore(user: User): number {
    const accountAge = Date.now() - user.createdAt.getTime();
    const ageInYears = accountAge / (1000 * 60 * 60 * 24 * 365);
    return Math.min(ageInYears / 5, 1); // Normalize to 0-1 over 5 years
  }

  private getUserRiskTolerance(user: User): number {
    // This would come from user preferences/questionnaire
    return 0.5; // Default moderate risk tolerance
  }

  private getUniqueTradingDays(trades: Trade[]): number {
    const uniqueDays = new Set(trades.map(t => t.timestamp.toISOString().split('T')[0]));
    return uniqueDays.size;
  }

  private calculateSymbolConcentration(trades: Trade[]): number {
    const symbolAmounts = trades.reduce((acc, trade) => {
      acc[trade.symbol] = (acc[trade.symbol] || 0) + trade.amount;
      return acc;
    }, {} as Record<string, number>);
    
    const totalAmount = Object.values(symbolAmounts).reduce((sum, amount) => sum + amount, 0);
    const maxSymbolAmount = Math.max(...Object.values(symbolAmounts));
    
    return maxSymbolAmount / totalAmount;
  }
}