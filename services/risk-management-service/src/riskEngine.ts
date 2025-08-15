import { Portfolio, Trade, User } from '@finverse/shared-types';
import { logger } from '../utils/logger';

export interface RiskLimits {
  maxPositionSize: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  maxLeverage: number;
  maxConcentration: number;
  maxCorrelation: number;
  sectorLimits: Map<string, number>;
  volatilityLimit: number;
  liquidityRequirement: number;
}

export interface RiskViolation {
  id: string;
  userId: string;
  type: RiskViolationType;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  currentValue: number;
  limitValue: number;
  recommendedAction: string;
  autoRemediation: boolean;
  timestamp: Date;
}

export enum RiskViolationType {
  POSITION_SIZE_EXCEEDED = 'POSITION_SIZE_EXCEEDED',
  DAILY_LOSS_LIMIT = 'DAILY_LOSS_LIMIT',
  DRAWDOWN_LIMIT = 'DRAWDOWN_LIMIT',
  LEVERAGE_EXCEEDED = 'LEVERAGE_EXCEEDED',
  CONCENTRATION_RISK = 'CONCENTRATION_RISK',
  CORRELATION_RISK = 'CORRELATION_RISK',
  VOLATILITY_EXCEEDED = 'VOLATILITY_EXCEEDED',
  LIQUIDITY_RISK = 'LIQUIDITY_RISK',
  MARGIN_SHORTFALL = 'MARGIN_SHORTFALL',
  EXPOSURE_LIMIT = 'EXPOSURE_LIMIT'
}

export interface RiskMetrics {
  var_1_day: number;
  var_10_day: number;
  expected_shortfall: number;
  beta: number;
  sharpe_ratio: number;
  max_drawdown: number;
  volatility: number;
  correlation_matrix: number[][];
  concentration_hhi: number;
  liquidity_score: number;
  leverage_ratio: number;
  margin_utilization: number;
}

export interface StressTestScenario {
  name: string;
  description: string;
  market_shock: number;
  sector_shocks: Map<string, number>;
  volatility_shock: number;
  correlation_shock: number;
  liquidity_shock: number;
}

export class RiskManagementEngine {
  private riskLimits: Map<string, RiskLimits> = new Map();
  private violations: Map<string, RiskViolation[]> = new Map();
  
  async initializeRiskLimits(userId: string, userProfile: User) {
    const limits: RiskLimits = this.determineRiskLimits(userProfile);
    this.riskLimits.set(userId, limits);
    logger.info(`Risk limits initialized for user ${userId}`);
  }

  private determineRiskLimits(userProfile: User): RiskLimits {
    // Determine risk limits based on user profile, experience, and preferences
    const baseCapital = this.getUserCapital(userProfile);
    const riskTolerance = this.getUserRiskTolerance(userProfile);
    const experience = this.getUserExperience(userProfile);
    
    const multiplier = this.getRiskMultiplier(riskTolerance, experience);
    
    return {
      maxPositionSize: baseCapital * 0.1 * multiplier, // 10% of capital per position
      maxDailyLoss: baseCapital * 0.02 * multiplier, // 2% daily loss limit
      maxDrawdown: baseCapital * 0.1 * multiplier, // 10% maximum drawdown
      maxLeverage: 2 * multiplier, // 2x leverage
      maxConcentration: 0.25 * multiplier, // 25% in single stock
      maxCorrelation: 0.7, // Maximum correlation between positions
      sectorLimits: new Map([
        ['TECHNOLOGY', 0.3 * multiplier],
        ['FINANCIAL', 0.3 * multiplier],
        ['HEALTHCARE', 0.2 * multiplier],
        ['ENERGY', 0.15 * multiplier],
        ['OTHERS', 0.2 * multiplier]
      ]),
      volatilityLimit: 0.3, // 30% maximum portfolio volatility
      liquidityRequirement: 0.1, // 10% cash reserve
    };
  }

  async evaluatePreTradeRisk(userId: string, proposedTrade: Trade): Promise<{
    approved: boolean;
    violations: RiskViolation[];
    recommendations: string[];
  }> {
    const limits = this.riskLimits.get(userId);
    if (!limits) {
      throw new Error(`Risk limits not found for user ${userId}`);
    }

    const violations: RiskViolation[] = [];
    const recommendations: string[] = [];

    // Get current portfolio
    const currentPortfolio = await this.getCurrentPortfolio(userId);
    
    // Simulate portfolio after trade
    const simulatedPortfolio = this.simulateTradeExecution(currentPortfolio, proposedTrade);
    
    // Check position size limit
    const positionValue = proposedTrade.quantity * proposedTrade.price;
    if (positionValue > limits.maxPositionSize) {
      violations.push({
        id: `violation_${Date.now()}`,
        userId,
        type: RiskViolationType.POSITION_SIZE_EXCEEDED,
        description: `Position size (${positionValue}) exceeds limit (${limits.maxPositionSize})`,
        severity: 'HIGH',
        currentValue: positionValue,
        limitValue: limits.maxPositionSize,
        recommendedAction: 'Reduce position size',
        autoRemediation: false,
        timestamp: new Date(),
      });
    }

    // Check concentration risk
    const concentration = this.calculateConcentration(simulatedPortfolio, proposedTrade.symbol);
    if (concentration > limits.maxConcentration) {
      violations.push({
        id: `violation_${Date.now()}`,
        userId,
        type: RiskViolationType.CONCENTRATION_RISK,
        description: `Concentration in ${proposedTrade.symbol} (${concentration}) exceeds limit (${limits.maxConcentration})`,
        severity: 'MEDIUM',
        currentValue: concentration,
        limitValue: limits.maxConcentration,
        recommendedAction: 'Diversify holdings',
        autoRemediation: false,
        timestamp: new Date(),
      });
    }

    // Check sector limits
    const sector = await this.getSymbolSector(proposedTrade.symbol);
    const sectorExposure = this.calculateSectorExposure(simulatedPortfolio, sector);
    const sectorLimit = limits.sectorLimits.get(sector) || 0.2;
    
    if (sectorExposure > sectorLimit) {
      violations.push({
        id: `violation_${Date.now()}`,
        userId,
        type: RiskViolationType.EXPOSURE_LIMIT,
        description: `Sector exposure (${sectorExposure}) exceeds limit (${sectorLimit})`,
        severity: 'MEDIUM',
        currentValue: sectorExposure,
        limitValue: sectorLimit,
        recommendedAction: 'Reduce sector exposure',
        autoRemediation: false,
        timestamp: new Date(),
      });
    }

    // Check correlation risk
    const correlationRisk = await this.calculateCorrelationRisk(simulatedPortfolio, proposedTrade);
    if (correlationRisk > limits.maxCorrelation) {
      violations.push({
        id: `violation_${Date.now()}`,
        userId,
        type: RiskViolationType.CORRELATION_RISK,
        description: `Portfolio correlation risk (${correlationRisk}) exceeds limit (${limits.maxCorrelation})`,
        severity: 'MEDIUM',
        currentValue: correlationRisk,
        limitValue: limits.maxCorrelation,
        recommendedAction: 'Add uncorrelated assets',
        autoRemediation: false,
        timestamp: new Date(),
      });
    }

    // Check margin requirements
    const marginRequirement = await this.calculateMarginRequirement(simulatedPortfolio);
    const availableMargin = await this.getAvailableMargin(userId);
    
    if (marginRequirement > availableMargin) {
      violations.push({
        id: `violation_${Date.now()}`,
        userId,
        type: RiskViolationType.MARGIN_SHORTFALL,
        description: `Insufficient margin. Required: ${marginRequirement}, Available: ${availableMargin}`,
        severity: 'CRITICAL',
        currentValue: marginRequirement,
        limitValue: availableMargin,
        recommendedAction: 'Add margin or reduce position',
        autoRemediation: true,
        timestamp: new Date(),
      });
    }

    // Generate recommendations
    if (violations.length > 0) {
      recommendations.push('Consider reducing position size');
      recommendations.push('Review portfolio diversification');
      recommendations.push('Monitor correlation with existing positions');
    }

    const approved = violations.filter(v => v.severity === 'CRITICAL').length === 0;

    return {
      approved,
      violations,
      recommendations,
    };
  }

  async monitorPostTradeRisk(userId: string, executedTrade: Trade): Promise<void> {
    const limits = this.riskLimits.get(userId);
    if (!limits) return;

    const currentPortfolio = await this.getCurrentPortfolio(userId);
    const violations: RiskViolation[] = [];

    // Check daily loss limit
    const dailyPnL = await this.calculateDailyPnL(userId);
    if (dailyPnL < -limits.maxDailyLoss) {
      violations.push({
        id: `violation_${Date.now()}`,
        userId,
        type: RiskViolationType.DAILY_LOSS_LIMIT,
        description: `Daily loss (${Math.abs(dailyPnL)}) exceeds limit (${limits.maxDailyLoss})`,
        severity: 'HIGH',
        currentValue: Math.abs(dailyPnL),
        limitValue: limits.maxDailyLoss,
        recommendedAction: 'Stop trading for the day',
        autoRemediation: true,
        timestamp: new Date(),
      });
    }

    // Check maximum drawdown
    const drawdown = await this.calculateMaxDrawdown(userId);
    if (drawdown > limits.maxDrawdown) {
      violations.push({
        id: `violation_${Date.now()}`,
        userId,
        type: RiskViolationType.DRAWDOWN_LIMIT,
        description: `Drawdown (${drawdown}) exceeds limit (${limits.maxDrawdown})`,
        severity: 'CRITICAL',
        currentValue: drawdown,
        limitValue: limits.maxDrawdown,
        recommendedAction: 'Review risk management strategy',
        autoRemediation: false,
        timestamp: new Date(),
      });
    }

    // Store violations
    if (violations.length > 0) {
      this.violations.set(userId, [...(this.violations.get(userId) || []), ...violations]);
      
      // Trigger alerts
      await this.triggerRiskAlerts(userId, violations);
      
      // Auto-remediation if enabled
      for (const violation of violations) {
        if (violation.autoRemediation) {
          await this.performAutoRemediation(userId, violation);
        }
      }
    }

    logger.info(`Post-trade risk monitoring completed for user ${userId}. Violations: ${violations.length}`);
  }

  async performStressTesting(userId: string, scenarios?: StressTestScenario[]): Promise<{
    results: Array<{
      scenario: StressTestScenario;
      portfolioImpact: {
        originalValue: number;
        stressedValue: number;
        loss: number;
        lossPercentage: number;
      };
      riskMetrics: RiskMetrics;
      worstCase: {
        symbol: string;
        loss: number;
        lossPercentage: number;
      };
    }>;
    overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    recommendations: string[];
  }> {
    const portfolio = await this.getCurrentPortfolio(userId);
    const defaultScenarios = this.getDefaultStressScenarios();
    const testScenarios = scenarios || defaultScenarios;
    
    const results = [];
    
    for (const scenario of testScenarios) {
      const stressedPortfolio = await this.applyStressScenario(portfolio, scenario);
      const riskMetrics = await this.calculateRiskMetrics(stressedPortfolio);
      
      const originalValue = this.calculatePortfolioValue(portfolio);
      const stressedValue = this.calculatePortfolioValue(stressedPortfolio);
      const loss = originalValue - stressedValue;
      const lossPercentage = (loss / originalValue) * 100;
      
      // Find worst performing position
      let worstCase = { symbol: '', loss: 0, lossPercentage: 0 };
      for (const holding of portfolio.holdings) {
        const originalHoldingValue = holding.marketValue;
        const stressedHolding = stressedPortfolio.holdings.find(h => h.symbol === holding.symbol);
        if (stressedHolding) {
          const holdingLoss = originalHoldingValue - stressedHolding.marketValue;
          const holdingLossPercentage = (holdingLoss / originalHoldingValue) * 100;
          
          if (holdingLossPercentage > worstCase.lossPercentage) {
            worstCase = {
              symbol: holding.symbol,
              loss: holdingLoss,
              lossPercentage: holdingLossPercentage,
            };
          }
        }
      }
      
      results.push({
        scenario,
        portfolioImpact: {
          originalValue,
          stressedValue,
          loss,
          lossPercentage,
        },
        riskMetrics,
        worstCase,
      });
    }
    
    // Assess overall risk
    const maxLoss = Math.max(...results.map(r => r.portfolioImpact.lossPercentage));
    const overallRisk = this.assessOverallRisk(maxLoss);
    
    // Generate recommendations
    const recommendations = this.generateStressTestRecommendations(results, overallRisk);
    
    return {
      results,
      overallRisk,
      recommendations,
    };
  }

  private getDefaultStressScenarios(): StressTestScenario[] {
    return [
      {
        name: 'Market Crash',
        description: 'Broad market decline of 20%',
        market_shock: -0.20,
        sector_shocks: new Map([
          ['TECHNOLOGY', -0.25],
          ['FINANCIAL', -0.30],
          ['HEALTHCARE', -0.15],
          ['ENERGY', -0.35],
        ]),
        volatility_shock: 2.0,
        correlation_shock: 0.8,
        liquidity_shock: 0.5,
      },
      {
        name: 'Sector Rotation',
        description: 'Technology selloff, financial sector rally',
        market_shock: -0.05,
        sector_shocks: new Map([
          ['TECHNOLOGY', -0.15],
          ['FINANCIAL', 0.10],
          ['HEALTHCARE', -0.05],
          ['ENERGY', 0.05],
        ]),
        volatility_shock: 1.5,
        correlation_shock: 0.3,
        liquidity_shock: 0.2,
      },
      {
        name: 'Interest Rate Shock',
        description: 'Sudden 200bps rate increase',
        market_shock: -0.12,
        sector_shocks: new Map([
          ['FINANCIAL', 0.05],
          ['REAL_ESTATE', -0.20],
          ['UTILITIES', -0.15],
          ['TECHNOLOGY', -0.10],
        ]),
        volatility_shock: 1.8,
        correlation_shock: 0.6,
        liquidity_shock: 0.3,
      },
      {
        name: 'Liquidity Crisis',
        description: 'Severe liquidity crunch',
        market_shock: -0.15,
        sector_shocks: new Map([
          ['FINANCIAL', -0.25],
          ['REAL_ESTATE', -0.30],
          ['SMALL_CAP', -0.40],
        ]),
        volatility_shock: 3.0,
        correlation_shock: 0.9,
        liquidity_shock: 0.8,
      },
    ];
  }

  private async performAutoRemediation(userId: string, violation: RiskViolation): Promise<void> {
    logger.info(`Performing auto-remediation for violation: ${violation.type}`);
    
    switch (violation.type) {
      case RiskViolationType.DAILY_LOSS_LIMIT:
        await this.suspendTradingForDay(userId);
        break;
        
      case RiskViolationType.MARGIN_SHORTFALL:
        await this.liquidateHighRiskPositions(userId);
        break;
        
      case RiskViolationType.LEVERAGE_EXCEEDED:
        await this.reducePositionSizes(userId);
        break;
        
      default:
        logger.warn(`No auto-remediation available for violation type: ${violation.type}`);
    }
  }

  private async suspendTradingForDay(userId: string): Promise<void> {
    // Implementation to suspend trading
    logger.info(`Trading suspended for user ${userId} due to daily loss limit`);
  }

  private async liquidateHighRiskPositions(userId: string): Promise<void> {
    // Implementation to liquidate high-risk positions
    logger.info(`Liquidating high-risk positions for user ${userId}`);
  }

  private async reducePositionSizes(userId: string): Promise<void> {
    // Implementation to reduce position sizes
    logger.info(`Reducing position sizes for user ${userId}`);
  }
}