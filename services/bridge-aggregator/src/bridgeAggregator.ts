import { ethers } from 'ethers';
import { logger } from '../utils/logger';

export interface BridgeRoute {
  id: string;
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  bridges: BridgeStep[];
  totalFee: number;
  estimatedTime: number; // minutes
  securityScore: number; // 0-100
  slippageImpact: number;
  gasEstimate: number;
  mevProtection: boolean;
  confidence: number;
  insuranceCoverage: number;
  liquidityDepth: number;
}

export interface BridgeStep {
  bridgeProtocol: string;
  fromAmount: number;
  toAmount: number;
  fee: number;
  gasEstimate: number;
  timeEstimate: number;
  securityAudit: SecurityAudit;
  liquiditySource: string;
  slippage: number;
  priceImpact: number;
}

export interface SecurityAudit {
  auditor: string;
  date: Date;
  score: number;
  vulnerabilities: Vulnerability[];
  certifications: string[];
  insuranceProvider?: string;
  coverageAmount?: number;
}

export interface Vulnerability {
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  status: 'OPEN' | 'MITIGATED' | 'FIXED';
  cve?: string;
}

export interface CrossChainTransaction {
  id: string;
  userId: string;
  route: BridgeRoute;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  fromTxHash?: string;
  toTxHash?: string;
  fromBlockNumber?: number;
  toBlockNumber?: number;
  actualFee: number;
  actualTime: number; // minutes
  slippageExperienced: number;
  mevAttacked: boolean;
  gasUsed: number;
  errorMessage?: string;
  refundTxHash?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface BridgeProtocol {
  name: string;
  type: 'LOCK_MINT' | 'BURN_MINT' | 'LIQUIDITY_POOL' | 'ATOMIC_SWAP' | 'OPTIMISTIC';
  supportedChains: string[];
  supportedTokens: TokenSupport[];
  tvl: number;
  volume24h: number;
  fees: FeeStructure;
  securityModel: SecurityModel;
  finalizationTime: Record<string, number>; // chain -> minutes
  maxTransactionSize: Record<string, number>; // token -> amount
  minTransactionSize: Record<string, number>;
  slashingConditions: SlashingCondition[];
  governanceToken?: string;
  insuranceProviders: InsuranceProvider[];
}

export interface TokenSupport {
  symbol: string;
  chains: string[];
  contracts: Record<string, string>; // chain -> contract address
  decimals: Record<string, number>;
  isNative: Record<string, boolean>;
  liquidity: Record<string, number>; // chain -> liquidity amount
}

export interface FeeStructure {
  baseFee: number; // percentage
  variableFee: number; // percentage based on amount
  minimumFee: number; // absolute minimum in USD
  maximumFee: number; // absolute maximum in USD
  gasCoverage: boolean;
  feeToken: string;
}

export interface SecurityModel {
  validatorSet: 'TRUSTED' | 'SEMI_TRUSTED' | 'TRUSTLESS';
  validatorCount: number;
  slashingAmount: number;
  challengePeriod: number; // minutes
  disputeResolution: 'GOVERNANCE' | 'ORACLE' | 'MULTI_SIG';
  emergencyPause: boolean;
  upgradeable: boolean;
  timelock: number; // hours
}

export interface SlashingCondition {
  condition: string;
  penalty: number; // percentage
  evidenceRequired: string[];
  cooldownPeriod: number; // hours
}

export interface InsuranceProvider {
  name: string;
  coverage: number; // USD
  premium: number; // percentage
  claimProcess: string;
  payoutTime: number; // days
  conditions: string[];
}

export class BridgeAggregatorService {
  private bridges: Map<string, BridgeProtocol> = new Map();
  private routes: Map<string, BridgeRoute[]> = new Map();
  private transactions: Map<string, CrossChainTransaction> = new Map();
  private providers: Map<string, ethers.providers.Provider> = new Map();
  private priceFeeds: Map<string, any> = new Map();

  constructor() {
    this.initializeProviders();
    this.initializePriceFeeds();
  }

  async initialize(): Promise<void> {
    await this.loadBridgeProtocols();
    await this.startRouteDiscovery();
    await this.startTransactionMonitoring();
    logger.info('Bridge Aggregator Service initialized');
  }

  private async loadBridgeProtocols(): Promise<void> {
    const bridgeConfigs = [
      {
        name: 'LayerZero',
        type: 'LOCK_MINT' as const,
        supportedChains: ['ethereum', 'polygon', 'bsc', 'avalanche', 'arbitrum', 'optimism'],
        tvl: 5000000000,
        volume24h: 500000000,
        securityModel: {
          validatorSet: 'SEMI_TRUSTED' as const,
          validatorCount: 21,
          slashingAmount: 1000000,
          challengePeriod: 1440,
          disputeResolution: 'ORACLE' as const,
          emergencyPause: true,
          upgradeable: true,
          timelock: 48,
        },
      },
      {
        name: 'Wormhole',
        type: 'LOCK_MINT' as const,
        supportedChains: ['ethereum', 'solana', 'polygon', 'bsc', 'avalanche', 'fantom'],
        tvl: 3000000000,
        volume24h: 300000000,
        securityModel: {
          validatorSet: 'SEMI_TRUSTED' as const,
          validatorCount: 19,
          slashingAmount: 500000,
          challengePeriod: 720,
          disputeResolution: 'GOVERNANCE' as const,
          emergencyPause: true,
          upgradeable: false,
          timelock: 24,
        },
      },
      {
        name: 'Hop Protocol',
        type: 'LIQUIDITY_POOL' as const,
        supportedChains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'gnosis'],
        tvl: 500000000,
        volume24h: 50000000,
        securityModel: {
          validatorSet: 'TRUSTLESS' as const,
          validatorCount: 0,
          slashingAmount: 0,
          challengePeriod: 0,
          disputeResolution: 'GOVERNANCE' as const,
          emergencyPause: false,
          upgradeable: true,
          timelock: 72,
        },
      },
      {
        name: 'Synapse',
        type: 'LIQUIDITY_POOL' as const,
        supportedChains: ['ethereum', 'polygon', 'bsc', 'avalanche', 'arbitrum', 'fantom'],
        tvl: 800000000,
        volume24h: 80000000,
        securityModel: {
          validatorSet: 'SEMI_TRUSTED' as const,
          validatorCount: 15,
          slashingAmount: 200000,
          challengePeriod: 360,
          disputeResolution: 'MULTI_SIG' as const,
          emergencyPause: true,
          upgradeable: true,
          timelock: 24,
        },
      },
      {
        name: 'Stargate',
        type: 'LIQUIDITY_POOL' as const,
        supportedChains: ['ethereum', 'polygon', 'bsc', 'avalanche', 'arbitrum', 'optimism', 'fantom'],
        tvl: 2000000000,
        volume24h: 200000000,
        securityModel: {
          validatorSet: 'SEMI_TRUSTED' as const,
          validatorCount: 21,
          slashingAmount: 1000000,
          challengePeriod: 1440,
          disputeResolution: 'ORACLE' as const,
          emergencyPause: true,
          upgradeable: true,
          timelock: 48,
        },
      },
    ];

    for (const config of bridgeConfigs) {
      const bridge = await this.createBridgeProtocol(config);
      this.bridges.set(bridge.name, bridge);
    }
  }

  async findOptimalRoute(
    fromChain: string,
    toChain: string,
    fromToken: string,
    toToken: string,
    amount: number,
    preferences: RoutePreferences
  ): Promise<BridgeRoute[]> {
    const cacheKey = `${fromChain}-${toChain}-${fromToken}-${toToken}-${amount}`;
    
    // Check cache first
    let routes = this.routes.get(cacheKey);
    if (!routes || this.isRouteCacheStale(cacheKey)) {
      routes = await this.discoverRoutes(fromChain, toChain, fromToken, toToken, amount);
      this.routes.set(cacheKey, routes);
    }

    // Filter and sort by preferences
    return this.optimizeRoutes(routes, preferences);
  }

  private async discoverRoutes(
    fromChain: string,
    toChain: string,
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<BridgeRoute[]> {
    const routes: BridgeRoute[] = [];

    // Direct routes (single bridge)
    for (const [name, bridge] of this.bridges) {
      if (this.supportsBridging(bridge, fromChain, toChain, fromToken, toToken)) {
        const route = await this.createDirectRoute(bridge, fromChain, toChain, fromToken, toToken, amount);
        if (route) routes.push(route);
      }
    }

    // Multi-hop routes (through intermediate chains/tokens)
    const multiHopRoutes = await this.findMultiHopRoutes(fromChain, toChain, fromToken, toToken, amount);
    routes.push(...multiHopRoutes);

    // Aggregated routes (split across multiple bridges)
    const aggregatedRoutes = await this.findAggregatedRoutes(fromChain, toChain, fromToken, toToken, amount);
    routes.push(...aggregatedRoutes);

    return routes;
  }

  private async createDirectRoute(
    bridge: BridgeProtocol,
    fromChain: string,
    toChain: string,
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<BridgeRoute | null> {
    try {
      const fee = this.calculateBridgeFee(bridge, amount);
      const gasEstimate = await this.estimateBridgeGas(bridge, fromChain, toChain, amount);
      const timeEstimate = bridge.finalizationTime[toChain] || 30;
      const securityScore = this.calculateSecurityScore(bridge);
      const slippageImpact = await this.calculateSlippageImpact(bridge, fromToken, toToken, amount);
      const liquidityDepth = await this.getLiquidityDepth(bridge, fromToken, toToken);

      const step: BridgeStep = {
        bridgeProtocol: bridge.name,
        fromAmount: amount,
        toAmount: amount - fee,
        fee,
        gasEstimate,
        timeEstimate,
        securityAudit: await this.getLatestSecurityAudit(bridge.name),
        liquiditySource: bridge.type === 'LIQUIDITY_POOL' ? 'AMM' : 'LOCKED',
        slippage: slippageImpact,
        priceImpact: slippageImpact * 0.5, // Estimate
      };

      return {
        id: `direct_${bridge.name}_${fromChain}_${toChain}_${Date.now()}`,
        fromChain,
        toChain,
        fromToken,
        toToken,
        bridges: [step],
        totalFee: fee,
        estimatedTime: timeEstimate,
        securityScore,
        slippageImpact,
        gasEstimate,
        mevProtection: this.hasMEVProtection(bridge),
        confidence: this.calculateRouteConfidence([step]),
        insuranceCoverage: this.getTotalInsuranceCoverage(bridge),
        liquidityDepth,
      };
    } catch (error) {
      logger.error(`Error creating direct route for ${bridge.name}:`, error);
      return null;
    }
  }

  private async findMultiHopRoutes(
    fromChain: string,
    toChain: string,
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<BridgeRoute[]> {
    const routes: BridgeRoute[] = [];
    const intermediateChains = ['ethereum', 'polygon', 'bsc', 'avalanche'];
    const stablecoins = ['USDC', 'USDT', 'DAI'];

    // Try routing through major chains with stablecoins
    for (const intermediateChain of intermediateChains) {
      if (intermediateChain === fromChain || intermediateChain === toChain) continue;

      for (const stablecoin of stablecoins) {
        try {
          // First hop: fromChain -> intermediateChain (fromToken -> stablecoin)
          const firstHopRoutes = await this.discoverRoutes(fromChain, intermediateChain, fromToken, stablecoin, amount);
          
          for (const firstHop of firstHopRoutes.slice(0, 3)) { // Limit to top 3 for performance
            const intermediateAmount = firstHop.bridges[firstHop.bridges.length - 1].toAmount;
            
            // Second hop: intermediateChain -> toChain (stablecoin -> toToken)
            const secondHopRoutes = await this.discoverRoutes(intermediateChain, toChain, stablecoin, toToken, intermediateAmount);
            
            for (const secondHop of secondHopRoutes.slice(0, 2)) { // Limit to top 2
              const combinedRoute: BridgeRoute = {
                id: `multihop_${firstHop.id}_${secondHop.id}`,
                fromChain,
                toChain,
                fromToken,
                toToken,
                bridges: [...firstHop.bridges, ...secondHop.bridges],
                totalFee: firstHop.totalFee + secondHop.totalFee,
                estimatedTime: firstHop.estimatedTime + secondHop.estimatedTime,
                securityScore: Math.min(firstHop.securityScore, secondHop.securityScore),
                slippageImpact: firstHop.slippageImpact + secondHop.slippageImpact,
                gasEstimate: firstHop.gasEstimate + secondHop.gasEstimate,
                mevProtection: firstHop.mevProtection && secondHop.mevProtection,
                confidence: (firstHop.confidence + secondHop.confidence) / 2 * 0.8, // Reduced confidence for multi-hop
                insuranceCoverage: Math.min(firstHop.insuranceCoverage, secondHop.insuranceCoverage),
                liquidityDepth: Math.min(firstHop.liquidityDepth, secondHop.liquidityDepth),
              };

              routes.push(combinedRoute);
            }
          }
        } catch (error) {
          logger.debug(`Multi-hop route discovery failed for ${intermediateChain}/${stablecoin}:`, error);
        }
      }
    }

    return routes.sort((a, b) => this.compareRoutes(a, b));
  }

  async executeBridge(
    userId: string,
    route: BridgeRoute,
    amount: number,
    slippageTolerance: number = 0.005
  ): Promise<CrossChainTransaction> {
    const transaction: CrossChainTransaction = {
      id: `bridge_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      route,
      status: 'PENDING',
      actualFee: 0,
      actualTime: 0,
      slippageExperienced: 0,
      mevAttacked: false,
      gasUsed: 0,
      createdAt: new Date(),
    };

    this.transactions.set(transaction.id, transaction);

    try {
      // Validate route and liquidity
      const validation = await this.validateRoute(route, amount);
      if (!validation.valid) {
        transaction.status = 'FAILED';
        transaction.errorMessage = validation.reason;
        return transaction;
      }

      // Execute bridge steps sequentially
      transaction.status = 'IN_PROGRESS';
      
      for (let i = 0; i < route.bridges.length; i++) {
        const step = route.bridges[i];
        const stepResult = await this.executeBridgeStep(transaction, step, i === 0 ? amount : undefined);
        
        if (!stepResult.success) {
          transaction.status = 'FAILED';
          transaction.errorMessage = stepResult.error;
          
          // Attempt recovery/refund
          await this.attemptRecovery(transaction, i);
          break;
        }

        // Update transaction with step results
        transaction.actualFee += stepResult.fee;
        transaction.gasUsed += stepResult.gasUsed;
        
        if (i === 0) {
          transaction.fromTxHash = stepResult.txHash;
          transaction.fromBlockNumber = stepResult.blockNumber;
        }
        if (i === route.bridges.length - 1) {
          transaction.toTxHash = stepResult.txHash;
          transaction.toBlockNumber = stepResult.blockNumber;
        }
      }

      if (transaction.status === 'IN_PROGRESS') {
        transaction.status = 'COMPLETED';
        transaction.completedAt = new Date();
        transaction.actualTime = (transaction.completedAt.getTime() - transaction.createdAt.getTime()) / (1000 * 60);
      }

    } catch (error) {
      logger.error(`Bridge execution failed for transaction ${transaction.id}:`, error);
      transaction.status = 'FAILED';
      transaction.errorMessage = error.message;
    }

    return transaction;
  }

  private async executeBridgeStep(
    transaction: CrossChainTransaction,
    step: BridgeStep,
    inputAmount?: number
  ): Promise<{ success: boolean; txHash?: string; blockNumber?: number; fee: number; gasUsed: number; error?: string }> {
    try {
      // Get bridge contract and execute
      const bridge = this.bridges.get(step.bridgeProtocol);
      if (!bridge) {
        return { success: false, error: 'Bridge protocol not found', fee: 0, gasUsed: 0 };
      }

      // Simulate the bridge transaction first
      const simulation = await this.simulateBridgeTransaction(bridge, step, inputAmount);
      if (!simulation.success) {
        return { success: false, error: simulation.error, fee: 0, gasUsed: 0 };
      }

      // Execute the actual bridge transaction
      const result = await this.sendBridgeTransaction(bridge, step, inputAmount);
      
      return {
        success: true,
        txHash: result.txHash,
        blockNumber: result.blockNumber,
        fee: result.fee,
        gasUsed: result.gasUsed,
      };

    } catch (error) {
      logger.error(`Bridge step execution failed:`, error);
      return { success: false, error: error.message, fee: 0, gasUsed: 0 };
    }
  }

  async monitorCrossChainTransaction(transactionId: string): Promise<CrossChainTransaction | null> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return null;

    if (transaction.status === 'IN_PROGRESS') {
      // Check transaction status on both chains
      const statusUpdate = await this.checkTransactionStatus(transaction);
      Object.assign(transaction, statusUpdate);
    }

    return transaction;
  }

  private optimizeRoutes(routes: BridgeRoute[], preferences: RoutePreferences): BridgeRoute[] {
    return routes
      .filter(route => this.meetsPreferences(route, preferences))
      .sort((a, b) => this.scoreRoute(b, preferences) - this.scoreRoute(a, preferences))
      .slice(0, preferences.maxResults || 10);
  }

  private scoreRoute(route: BridgeRoute, preferences: RoutePreferences): number {
    let score = 0;
    
    // Weight factors based on preferences
    const weights = {
      cost: preferences.prioritizeCost || 0.3,
      speed: preferences.prioritizeSpeed || 0.3,
      security: preferences.prioritizeSecurity || 0.2,
      simplicity: preferences.prioritizeSimplicity || 0.2,
    };

    // Cost score (lower fee = higher score)
    score += weights.cost * (1 - Math.min(route.totalFee / 1000, 1));
    
    // Speed score (lower time = higher score)
    score += weights.speed * (1 - Math.min(route.estimatedTime / 1440, 1)); // Max 24 hours
    
    // Security score
    score += weights.security * (route.securityScore / 100);
    
    // Simplicity score (fewer bridges = higher score)
    score += weights.simplicity * (1 - Math.min(route.bridges.length / 5, 1));

    return score;
  }
}

export interface RoutePreferences {
  maxFee?: number;
  maxTime?: number; // minutes
  minSecurity?: number; // 0-100
  maxBridges?: number;
  prioritizeCost?: number; // 0-1
  prioritizeSpeed?: number; // 0-1
  prioritizeSecurity?: number; // 0-1
  prioritizeSimplicity?: number; // 0-1
  requireInsurance?: boolean;
  requireMEVProtection?: boolean;
  maxResults?: number;
}