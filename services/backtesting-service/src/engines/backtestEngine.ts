import { Trade, Portfolio } from '@finverse/shared-types';
import { logger } from '../utils/logger';

export interface BacktestStrategy {
  id: string;
  name: string;
  description: string;
  type: 'TECHNICAL' | 'FUNDAMENTAL' | 'QUANTITATIVE' | 'HYBRID';
  parameters: Record<string, any>;
  entryConditions: TradingCondition[];
  exitConditions: TradingCondition[];
  riskManagement: {
    stopLoss: number;
    takeProfit: number;
    positionSizing: 'FIXED' | 'PERCENT_RISK' | 'KELLY' | 'OPTIMAL_F';
    maxPositions: number;
  };
  universe: string[]; // Symbols to trade
  benchmark: string;
}

export interface TradingCondition {
  indicator: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | 'CROSSOVER' | 'CROSSUNDER';
  value: number | string;
  lookback?: number;
}

export interface BacktestResult {
  strategy: BacktestStrategy;
  period: {
    start: Date;
    end: Date;
  };
  performance: {
    totalReturn: number;
    annualizedReturn: number;
    volatility: number;
    sharpeRatio: number;
    sortinoRatio: number;
    calmarRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
    averageWin: number;
    averageLoss: number;
    largestWin: number;
    largestLoss: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    averageHoldingPeriod: number;
  };
  trades: BacktestTrade[];
  equity_curve: Array<{
    date: Date;
    equity: number;
    drawdown: number;
  }>;
  monthly_returns: Array<{
    month: string;
    return: number;
  }>;
  risk_metrics: {
    var_95: number;
    var_99: number;
    expected_shortfall: number;
    beta: number;
    alpha: number;
    correlation_with_market: number;
  };
  benchmark_comparison: {
    strategy_return: number;
    benchmark_return: number;
    excess_return: number;
    tracking_error: number;
    information_ratio: number;
  };
}

export interface BacktestTrade {
  symbol: string;
  entryDate: Date;
  exitDate: Date;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  side: 'LONG' | 'SHORT';
  pnl: number;
  pnlPercent: number;
  holdingDays: number;
  entrySignal: string;
  exitSignal: string;
  commission: number;
  slippage: number;
}

export class AdvancedBacktestEngine {
  private marketData: Map<string, any[]> = new Map();
  private indicators: Map<string, Function> = new Map();

  constructor() {
    this.initializeIndicators();
  }

  async runBacktest(
    strategy: BacktestStrategy,
    startDate: Date,
    endDate: Date,
    initialCapital: number = 1000000
  ): Promise<BacktestResult> {
    logger.info(`Starting backtest for strategy: ${strategy.name}`);

    // Load market data for strategy universe
    await this.loadMarketData(strategy.universe, startDate, endDate);

    // Initialize portfolio
    let portfolio = this.initializePortfolio(initialCapital);
    const trades: BacktestTrade[] = [];
    const equityCurve: BacktestResult['equity_curve'] = [];
    
    let openPositions: Map<string, {
      entryDate: Date;
      entryPrice: number;
      quantity: number;
      side: 'LONG' | 'SHORT';
      entrySignal: string;
    }> = new Map();

    // Get trading dates
    const tradingDates = this.getTradingDates(startDate, endDate);
    
    for (const currentDate of tradingDates) {
      // Update portfolio values with current market prices
      portfolio = this.updatePortfolioValues(portfolio, currentDate);
      
      // Check exit conditions for open positions
      const exitTrades = await this.checkExitConditions(
        openPositions, 
        strategy, 
        currentDate
      );
      
      for (const exitTrade of exitTrades) {
        trades.push(exitTrade);
        openPositions.delete(exitTrade.symbol);
        portfolio = this.executeExitTrade(portfolio, exitTrade);
      }

      // Check entry conditions for new positions
      if (openPositions.size < strategy.riskManagement.maxPositions) {
        const entrySignals = await this.checkEntryConditions(
          strategy, 
          currentDate, 
          Array.from(openPositions.keys())
        );
        
        for (const signal of entrySignals) {
          const position = this.calculatePositionSize(
            portfolio, 
            signal, 
            strategy.riskManagement
          );
          
          if (position.quantity > 0) {
            openPositions.set(signal.symbol, {
              entryDate: currentDate,
              entryPrice: signal.price,
              quantity: position.quantity,
              side: signal.side,
              entrySignal: signal.reason,
            });
            
            portfolio = this.executeEntryTrade(portfolio, signal, position.quantity);
          }
        }
      }

      // Record equity curve point
      const drawdown = this.calculateDrawdown(portfolio, equityCurve);
      equityCurve.push({
        date: currentDate,
        equity: portfolio.totalValue,
        drawdown,
      });
    }

    // Close any remaining open positions at the end
    for (const [symbol, position] of openPositions) {
      const exitPrice = this.getPrice(symbol, endDate);
      const exitTrade: BacktestTrade = {
        symbol,
        entryDate: position.entryDate,
        exitDate: endDate,
        entryPrice: position.entryPrice,
        exitPrice,
        quantity: position.quantity,
        side: position.side,
        pnl: this.calculatePnL(position, exitPrice),
        pnlPercent: ((exitPrice - position.entryPrice) / position.entryPrice) * 100,
        holdingDays: this.calculateHoldingDays(position.entryDate, endDate),
        entrySignal: position.entrySignal,
        exitSignal: 'END_OF_BACKTEST',
        commission: this.calculateCommission(position.quantity, exitPrice),
        slippage: this.calculateSlippage(symbol, position.quantity),
      };
      
      trades.push(exitTrade);
    }

    // Calculate performance metrics
    const performance = this.calculatePerformanceMetrics(
      trades, 
      equityCurve, 
      initialCapital
    );
    
    const monthlyReturns = this.calculateMonthlyReturns(equityCurve);
    const riskMetrics = this.calculateRiskMetrics(equityCurve, trades);
    const benchmarkComparison = await this.calculateBenchmarkComparison(
      strategy.benchmark,
      startDate,
      endDate,
      equityCurve
    );

    logger.info(`Backtest completed. Total trades: ${trades.length}, Final return: ${performance.totalReturn}%`);

    return {
      strategy,
      period: { start: startDate, end: endDate },
      performance,
      trades,
      equity_curve: equityCurve,
      monthly_returns: monthlyReturns,
      risk_metrics: riskMetrics,
      benchmark_comparison: benchmarkComparison,
    };
  }

  async optimizeStrategy(
    baseStrategy: BacktestStrategy,
    parameterRanges: Record<string, { min: number; max: number; step: number }>,
    startDate: Date,
    endDate: Date,
    optimizationMetric: 'SHARPE' | 'RETURN' | 'CALMAR' | 'PROFIT_FACTOR' = 'SHARPE'
  ): Promise<{
    bestStrategy: BacktestStrategy;
    bestResult: BacktestResult;
    optimizationResults: Array<{
      parameters: Record<string, any>;
      metric: number;
      result: BacktestResult;
    }>;
  }> {
    logger.info(`Starting strategy optimization for: ${baseStrategy.name}`);

    const parameterCombinations = this.generateParameterCombinations(parameterRanges);
    const optimizationResults = [];
    
    let bestMetric = -Infinity;
    let bestStrategy = baseStrategy;
    let bestResult: BacktestResult | null = null;

    for (const parameters of parameterCombinations) {
      try {
        const testStrategy = { ...baseStrategy, parameters: { ...baseStrategy.parameters, ...parameters } };
        const result = await this.runBacktest(testStrategy, startDate, endDate);
        
        const metric = this.getOptimizationMetric(result, optimizationMetric);
        
        optimizationResults.push({
          parameters,
          metric,
          result,
        });
        
        if (metric > bestMetric) {
          bestMetric = metric;
          bestStrategy = testStrategy;
          bestResult = result;
        }
        
        logger.debug(`Tested parameters: ${JSON.stringify(parameters)}, Metric: ${metric}`);
      } catch (error) {
        logger.error(`Error testing parameters ${JSON.stringify(parameters)}:`, error);
      }
    }

    logger.info(`Optimization completed. Best ${optimizationMetric}: ${bestMetric}`);

    return {
      bestStrategy,
      bestResult: bestResult!,
      optimizationResults: optimizationResults.sort((a, b) => b.metric - a.metric),
    };
  }

  async runMonteCarloSimulation(
    strategy: BacktestStrategy,
    baseResult: BacktestResult,
    numSimulations: number = 1000
  ): Promise<{
    simulations: Array<{
      finalReturn: number;
      maxDrawdown: number;
      sharpeRatio: number;
    }>;
    statistics: {
      mean_return: number;
      std_return: number;
      percentile_5: number;
      percentile_25: number;
      percentile_50: number;
      percentile_75: number;
      percentile_95: number;
      probability_of_loss: number;
      var_95: number;
      expected_shortfall: number;
    };
  }> {
    logger.info(`Running Monte Carlo simulation with ${numSimulations} iterations`);

    const simulations = [];
    const tradeReturns = baseResult.trades.map(t => t.pnlPercent / 100);
    
    for (let i = 0; i < numSimulations; i++) {
      const shuffledReturns = this.shuffleArray([...tradeReturns]);
      const simulation = this.simulateStrategy(shuffledReturns, baseResult.trades.length);
      simulations.push(simulation);
    }

    const finalReturns = simulations.map(s => s.finalReturn).sort((a, b) => a - b);
    const statistics = {
      mean_return: this.mean(finalReturns),
      std_return: this.standardDeviation(finalReturns),
      percentile_5: this.percentile(finalReturns, 0.05),
      percentile_25: this.percentile(finalReturns, 0.25),
      percentile_50: this.percentile(finalReturns, 0.50),
      percentile_75: this.percentile(finalReturns, 0.75),
      percentile_95: this.percentile(finalReturns, 0.95),
      probability_of_loss: finalReturns.filter(r => r < 0).length / finalReturns.length,
      var_95: -this.percentile(finalReturns, 0.05),
      expected_shortfall: -this.mean(finalReturns.slice(0, Math.floor(finalReturns.length * 0.05))),
    };

    return { simulations, statistics };
  }

  private initializeIndicators() {
    // Simple Moving Average
    this.indicators.set('SMA', (data: number[], period: number) => {
      if (data.length < period) return null;
      const sum = data.slice(-period).reduce((a, b) => a + b, 0);
      return sum / period;
    });

    // Exponential Moving Average
    this.indicators.set('EMA', (data: number[], period: number) => {
      if (data.length < period) return null;
      const multiplier = 2 / (period + 1);
      let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
      
      for (let i = period; i < data.length; i++) {
        ema = (data[i] - ema) * multiplier + ema;
      }
      return ema;
    });

    // Relative Strength Index
    this.indicators.set('RSI', (data: number[], period: number = 14) => {
      if (data.length < period + 1) return null;
      
      const changes = [];
      for (let i = 1; i < data.length; i++) {
        changes.push(data[i] - data[i - 1]);
      }
      
      const gains = changes.map(c => c > 0 ? c : 0);
      const losses = changes.map(c => c < 0 ? -c : 0);
      
      const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
      
      if (avgLoss === 0) return 100;
      const rs = avgGain / avgLoss;
      return 100 - (100 / (1 + rs));
    });

    // MACD
    this.indicators.set('MACD', (data: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) => {
      const emaFast = this.indicators.get('EMA')!(data, fastPeriod);
      const emaSlow = this.indicators.get('EMA')!(data, slowPeriod);
      
      if (!emaFast || !emaSlow) return null;
      
      const macdLine = emaFast - emaSlow;
      return macdLine;
    });

    // Bollinger Bands
    this.indicators.set('BOLLINGER', (data: number[], period: number = 20, stdDev: number = 2) => {
      const sma = this.indicators.get('SMA')!(data, period);
      if (!sma) return null;
      
      const slice = data.slice(-period);
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
      const std = Math.sqrt(variance);
      
      return {
        upper: sma + (std * stdDev),
        middle: sma,
        lower: sma - (std * stdDev),
      };
    });
  }

  private async checkEntryConditions(
    strategy: BacktestStrategy,
    date: Date,
    excludeSymbols: string[]
  ): Promise<Array<{
    symbol: string;
    price: number;
    side: 'LONG' | 'SHORT';
    reason: string;
  }>> {
    const signals = [];
    
    for (const symbol of strategy.universe) {
      if (excludeSymbols.includes(symbol)) continue;
      
      const data = this.getHistoricalData(symbol, date, 100); // Get last 100 data points
      if (!data || data.length < 50) continue;
      
      let conditionsMet = true;
      let side: 'LONG' | 'SHORT' = 'LONG';
      const reasons = [];
      
      for (const condition of strategy.entryConditions) {
        const result = this.evaluateCondition(condition, data, date);
        if (!result.met) {
          conditionsMet = false;
          break;
        }
        reasons.push(result.reason);
        if (result.side) side = result.side;
      }
      
      if (conditionsMet) {
        signals.push({
          symbol,
          price: data[data.length - 1].close,
          side,
          reason: reasons.join(', '),
        });
      }
    }
    
    return signals;
  }

  private evaluateCondition(
    condition: TradingCondition,
    data: any[],
    date: Date
  ): { met: boolean; reason: string; side?: 'LONG' | 'SHORT' } {
    const prices = data.map(d => d.close);
    const indicator = this.indicators.get(condition.indicator);
    
    if (!indicator) {
      return { met: false, reason: `Unknown indicator: ${condition.indicator}` };
    }
    
    const currentValue = indicator(prices, condition.lookback || 14);
    if (currentValue === null || currentValue === undefined) {
      return { met: false, reason: `Insufficient data for ${condition.indicator}` };
    }
    
    let met = false;
    let side: 'LONG' | 'SHORT' | undefined;
    
    switch (condition.operator) {
      case '>':
        met = currentValue > condition.value;
        side = 'LONG';
        break;
      case '<':
        met = currentValue < condition.value;
        side = 'SHORT';
        break;
      case '>=':
        met = currentValue >= condition.value;
        side = 'LONG';
        break;
      case '<=':
        met = currentValue <= condition.value;
        side = 'SHORT';
        break;
      case '==':
        met = Math.abs(currentValue - Number(condition.value)) < 0.001;
        break;
      case 'CROSSOVER':
        // Implement crossover logic
        if (data.length >= 2) {
          const prevValue = indicator(prices.slice(0, -1), condition.lookback || 14);
          met = prevValue !== null && prevValue <= condition.value && currentValue > condition.value;
          side = 'LONG';
        }
        break;
      case 'CROSSUNDER':
        // Implement crossunder logic
        if (data.length >= 2) {
          const prevValue = indicator(prices.slice(0, -1), condition.lookback || 14);
          met = prevValue !== null && prevValue >= condition.value && currentValue < condition.value;
          side = 'SHORT';
        }
        break;
    }
    
    return {
      met,
      reason: `${condition.indicator} ${condition.operator} ${condition.value} (${currentValue.toFixed(2)})`,
      side,
    };
  }

  private calculatePositionSize(
    portfolio: any,
    signal: any,
    riskManagement: BacktestStrategy['riskManagement']
  ): { quantity: number } {
    const availableCash = portfolio.cash;
    const portfolioValue = portfolio.totalValue;
    
    let positionValue = 0;
    
    switch (riskManagement.positionSizing) {
      case 'FIXED':
        positionValue = portfolioValue / riskManagement.maxPositions;
        break;
        
      case 'PERCENT_RISK':
        const riskAmount = portfolioValue * 0.02; // 2% risk per trade
        const stopLossDistance = signal.price * (riskManagement.stopLoss / 100);
        positionValue = riskAmount / stopLossDistance;
        break;
        
      case 'KELLY':
        // Simplified Kelly criterion (would need historical win/loss data)
        const winRate = 0.6; // Assume 60% win rate
        const avgWin = 0.05; // 5% average win
        const avgLoss = 0.03; // 3% average loss
        const kellyPercent = winRate - ((1 - winRate) / (avgWin / avgLoss));
        positionValue = portfolioValue * Math.max(0, Math.min(kellyPercent, 0.25)); // Cap at 25%
        break;
        
      case 'OPTIMAL_F':
        // Simplified Optimal F (would need more complex calculation)
        positionValue = portfolioValue * 0.1; // 10% default
        break;
        
      default:
        positionValue = portfolioValue / riskManagement.maxPositions;
    }
    
    const quantity = Math.floor(Math.min(positionValue, availableCash) / signal.price);
    return { quantity: Math.max(0, quantity) };
  }

  private generateParameterCombinations(
    parameterRanges: Record<string, { min: number; max: number; step: number }>
  ): Array<Record<string, number>> {
    const combinations: Array<Record<string, number>> = [];
    const parameterNames = Object.keys(parameterRanges);
    
    function generateCombos(index: number, currentCombo: Record<string, number>) {
      if (index === parameterNames.length) {
        combinations.push({ ...currentCombo });
        return;
      }
      
      const paramName = parameterNames[index];
      const range = parameterRanges[paramName];
      
      for (let value = range.min; value <= range.max; value += range.step) {
        currentCombo[paramName] = value;
        generateCombos(index + 1, currentCombo);
      }
    }
    
    generateCombos(0, {});
    return combinations;
  }

  private getOptimizationMetric(result: BacktestResult, metric: string): number {
    switch (metric) {
      case 'SHARPE':
        return result.performance.sharpeRatio;
      case 'RETURN':
        return result.performance.annualizedReturn;
      case 'CALMAR':
        return result.performance.calmarRatio;
      case 'PROFIT_FACTOR':
        return result.performance.profitFactor;
      default:
        return result.performance.sharpeRatio;
    }
  }

  // Additional utility methods...
  private mean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private standardDeviation(values: number[]): number {
    const avg = this.mean(values);
    const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
    return Math.sqrt(this.mean(squaredDiffs));
  }

  private percentile(sortedValues: number[], percentile: number): number {
    const index = Math.ceil(sortedValues.length * percentile) - 1;
    return sortedValues[Math.max(0, index)];
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}