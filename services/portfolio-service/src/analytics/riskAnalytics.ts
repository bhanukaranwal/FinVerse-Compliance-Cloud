import { Portfolio, Holding, Trade } from '@finverse/shared-types';
import { logger } from '../utils/logger';

export interface RiskMetrics {
  value_at_risk: {
    daily_var_95: number;
    daily_var_99: number;
    weekly_var_95: number;
    weekly_var_99: number;
  };
  expected_shortfall: {
    daily_es_95: number;
    daily_es_99: number;
  };
  beta: number;
  alpha: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  information_ratio: number;
  maximum_drawdown: number;
  calmar_ratio: number;
  treynor_ratio: number;
  volatility: {
    daily: number;
    annualized: number;
  };
  correlation_with_market: number;
  concentration_risk: {
    herfindahl_index: number;
    top_5_concentration: number;
    sector_concentration: number;
  };
  liquidity_risk: {
    average_bid_ask_spread: number;
    liquidity_score: number;
    days_to_liquidate: number;
  };
}

export interface PortfolioOptimization {
  current_allocation: Record<string, number>;
  optimal_allocation: Record<string, number>;
  expected_return: number;
  expected_risk: number;
  improvement_metrics: {
    return_improvement: number;
    risk_reduction: number;
    sharpe_improvement: number;
  };
  rebalancing_suggestions: Array<{
    symbol: string;
    current_weight: number;
    target_weight: number;
    action: 'buy' | 'sell' | 'hold';
    quantity_change: number;
    amount_change: number;
  }>;
}

export interface StressTestResult {
  scenario: string;
  description: string;
  portfolio_impact: {
    value_change: number;
    percentage_change: number;
    new_portfolio_value: number;
  };
  individual_impacts: Array<{
    symbol: string;
    current_value: number;
    stressed_value: number;
    impact: number;
    percentage_impact: number;
  }>;
  risk_metrics_change: {
    var_change: number;
    beta_change: number;
    correlation_change: number;
  };
}

export class RiskAnalyticsEngine {
  private marketData: Map<string, number[]> = new Map();
  private benchmarkReturns: number[] = [];

  async calculateComprehensiveRisk(portfolio: Portfolio): Promise<RiskMetrics> {
    const returns = await this.calculatePortfolioReturns(portfolio);
    const marketReturns = await this.getMarketReturns();
    
    return {
      value_at_risk: this.calculateVaR(returns),
      expected_shortfall: this.calculateExpectedShortfall(returns),
      beta: this.calculateBeta(returns, marketReturns),
      alpha: this.calculateAlpha(returns, marketReturns),
      sharpe_ratio: this.calculateSharpeRatio(returns),
      sortino_ratio: this.calculateSortinoRatio(returns),
      information_ratio: this.calculateInformationRatio(returns, marketReturns),
      maximum_drawdown: this.calculateMaximumDrawdown(returns),
      calmar_ratio: this.calculateCalmarRatio(returns),
      treynor_ratio: this.calculateTreynorRatio(returns, marketReturns),
      volatility: this.calculateVolatility(returns),
      correlation_with_market: this.calculateCorrelation(returns, marketReturns),
      concentration_risk: this.calculateConcentrationRisk(portfolio),
      liquidity_risk: await this.calculateLiquidityRisk(portfolio),
    };
  }

  async optimizePortfolio(
    portfolio: Portfolio,
    constraints: {
      max_weight_per_stock?: number;
      max_sector_allocation?: number;
      min_diversification?: number;
      target_return?: number;
      max_risk?: number;
    }
  ): Promise<PortfolioOptimization> {
    const currentWeights = this.calculateCurrentWeights(portfolio);
    const expectedReturns = await this.calculateExpectedReturns(portfolio.holdings);
    const covarianceMatrix = await this.calculateCovarianceMatrix(portfolio.holdings);
    
    // Modern Portfolio Theory optimization
    const optimization = this.solveOptimization({
      expectedReturns,
      covarianceMatrix,
      constraints,
      currentWeights,
    });

    return {
      current_allocation: currentWeights,
      optimal_allocation: optimization.optimalWeights,
      expected_return: optimization.expectedReturn,
      expected_risk: optimization.expectedRisk,
      improvement_metrics: this.calculateImprovementMetrics(
        currentWeights,
        optimization.optimalWeights,
        expectedReturns,
        covarianceMatrix
      ),
      rebalancing_suggestions: this.generateRebalancingSuggestions(
        portfolio,
        currentWeights,
        optimization.optimalWeights
      ),
    };
  }

  async performStressTesting(portfolio: Portfolio): Promise<StressTestResult[]> {
    const stressScenarios = [
      {
        name: 'Market Crash (-20%)',
        description: 'Broad market decline of 20%',
        factorChanges: { market: -0.20 },
      },
      {
        name: 'Interest Rate Shock (+200bps)',
        description: 'Interest rates increase by 2%',
        factorChanges: { interest_rate: 0.02 },
      },
      {
        name: 'Sector Rotation',
        description: 'Technology sector decline, financial sector rise',
        factorChanges: { tech: -0.15, financial: 0.10 },
      },
      {
        name: 'Currency Devaluation',
        description: 'INR weakens by 10%',
        factorChanges: { currency: -0.10 },
      },
      {
        name: 'Volatility Spike',
        description: 'VIX increases to 40',
        factorChanges: { volatility: 2.0 },
      },
      {
        name: 'Credit Spread Widening',
        description: 'Corporate bond spreads widen by 100bps',
        factorChanges: { credit_spread: 0.01 },
      },
    ];

    const results: StressTestResult[] = [];

    for (const scenario of stressScenarios) {
      const stressResult = await this.applyStressScenario(portfolio, scenario);
      results.push(stressResult);
    }

    return results;
  }

  private calculateVaR(returns: number[]): RiskMetrics['value_at_risk'] {
    const sortedReturns = [...returns].sort((a, b) => a - b);
    
    return {
      daily_var_95: -sortedReturns[Math.floor(returns.length * 0.05)],
      daily_var_99: -sortedReturns[Math.floor(returns.length * 0.01)],
      weekly_var_95: -sortedReturns[Math.floor(returns.length * 0.05)] * Math.sqrt(5),
      weekly_var_99: -sortedReturns[Math.floor(returns.length * 0.01)] * Math.sqrt(5),
    };
  }

  private calculateExpectedShortfall(returns: number[]): RiskMetrics['expected_shortfall'] {
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const var95Index = Math.floor(returns.length * 0.05);
    const var99Index = Math.floor(returns.length * 0.01);
    
    const es95 = sortedReturns.slice(0, var95Index).reduce((sum, ret) => sum + ret, 0) / var95Index;
    const es99 = sortedReturns.slice(0, var99Index).reduce((sum, ret) => sum + ret, 0) / var99Index;
    
    return {
      daily_es_95: -es95,
      daily_es_99: -es99,
    };
  }

  private calculateBeta(portfolioReturns: number[], marketReturns: number[]): number {
    const n = Math.min(portfolioReturns.length, marketReturns.length);
    const portfolioMean = portfolioReturns.slice(0, n).reduce((sum, ret) => sum + ret, 0) / n;
    const marketMean = marketReturns.slice(0, n).reduce((sum, ret) => sum + ret, 0) / n;
    
    let covariance = 0;
    let marketVariance = 0;
    
    for (let i = 0; i < n; i++) {
      const portfolioDeviation = portfolioReturns[i] - portfolioMean;
      const marketDeviation = marketReturns[i] - marketMean;
      
      covariance += portfolioDeviation * marketDeviation;
      marketVariance += marketDeviation * marketDeviation;
    }
    
    return covariance / marketVariance;
  }

  private calculateAlpha(portfolioReturns: number[], marketReturns: number[]): number {
    const beta = this.calculateBeta(portfolioReturns, marketReturns);
    const portfolioMean = portfolioReturns.reduce((sum, ret) => sum + ret, 0) / portfolioReturns.length;
    const marketMean = marketReturns.reduce((sum, ret) => sum + ret, 0) / marketReturns.length;
    const riskFreeRate = 0.06 / 252; // Assuming 6% annual risk-free rate
    
    return portfolioMean - riskFreeRate - beta * (marketMean - riskFreeRate);
  }

  private calculateSharpeRatio(returns: number[]): number {
    const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const stdDev = this.calculateStandardDeviation(returns);
    const riskFreeRate = 0.06 / 252; // Daily risk-free rate
    
    return (meanReturn - riskFreeRate) / stdDev;
  }

  private calculateSortinoRatio(returns: number[]): number {
    const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const negativeReturns = returns.filter(ret => ret < 0);
    const downwardDeviation = Math.sqrt(
      negativeReturns.reduce((sum, ret) => sum + ret * ret, 0) / returns.length
    );
    const riskFreeRate = 0.06 / 252;
    
    return (meanReturn - riskFreeRate) / downwardDeviation;
  }

  private calculateMaximumDrawdown(returns: number[]): number {
    let peak = 1;
    let maxDrawdown = 0;
    let currentValue = 1;
    
    for (const ret of returns) {
      currentValue *= (1 + ret);
      if (currentValue > peak) {
        peak = currentValue;
      }
      const drawdown = (peak - currentValue) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    
    return maxDrawdown;
  }

  private calculateConcentrationRisk(portfolio: Portfolio): RiskMetrics['concentration_risk'] {
    const totalValue = portfolio.totalValue;
    const weights = portfolio.holdings.map(h => h.marketValue / totalValue);
    
    // Herfindahl-Hirschman Index
    const herfindahlIndex = weights.reduce((sum, w) => sum + w * w, 0);
    
    // Top 5 concentration
    const sortedWeights = [...weights].sort((a, b) => b - a);
    const top5Concentration = sortedWeights.slice(0, 5).reduce((sum, w) => sum + w, 0);
    
    // Sector concentration (simplified - would need sector mapping in real implementation)
    const sectorConcentration = this.calculateSectorConcentration(portfolio.holdings);
    
    return {
      herfindahl_index: herfindahlIndex,
      top_5_concentration: top5Concentration,
      sector_concentration: sectorConcentration,
    };
  }

  private async calculateLiquidityRisk(portfolio: Portfolio): Promise<RiskMetrics['liquidity_risk']> {
    // This would integrate with market data providers for real-time bid-ask spreads
    let totalSpread = 0;
    let liquidityScore = 0;
    let daysToLiquidate = 0;
    
    for (const holding of portfolio.holdings) {
      const marketCap = await this.getMarketCap(holding.symbol);
      const avgVolume = await this.getAverageVolume(holding.symbol);
      const bidAskSpread = await this.getBidAskSpread(holding.symbol);
      
      totalSpread += bidAskSpread * (holding.marketValue / portfolio.totalValue);
      
      // Simple liquidity scoring
      const score = Math.min(1, (marketCap * avgVolume) / 1000000000); // Normalize
      liquidityScore += score * (holding.marketValue / portfolio.totalValue);
      
      // Days to liquidate calculation
      const positionSize = holding.quantity;
      const dailyVolume = avgVolume;
      const daysForThisHolding = positionSize / (dailyVolume * 0.1); // Assume 10% of volume
      daysToLiquidate = Math.max(daysToLiquidate, daysForThisHolding);
    }
    
    return {
      average_bid_ask_spread: totalSpread,
      liquidity_score: liquidityScore,
      days_to_liquidate: daysToLiquidate,
    };
  }

  // Helper methods
  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length);
  }

  private async calculatePortfolioReturns(portfolio: Portfolio): Promise<number[]> {
    // This would calculate historical returns based on price data
    // Placeholder implementation
    return Array.from({ length: 252 }, () => (Math.random() - 0.5) * 0.04);
  }

  private async getMarketReturns(): Promise<number[]> {
    // This would fetch market index returns (e.g., NIFTY 50)
    return Array.from({ length: 252 }, () => (Math.random() - 0.5) * 0.03);
  }
}