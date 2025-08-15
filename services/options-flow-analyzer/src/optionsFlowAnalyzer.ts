import { OptionsChain, OptionContract } from '@finverse/shared-types';
import { WebSocket } from 'ws';
import { logger } from '../utils/logger';

export interface OptionsFlow {
  id: string;
  timestamp: Date;
  symbol: string;
  strike: number;
  expiry: Date;
  type: 'CALL' | 'PUT';
  side: 'BUY' | 'SELL';
  volume: number;
  openInterest: number;
  premiumValue: number;
  impliedVolatility: number;
  unusualActivity: boolean;
  flowType: 'SWEEP' | 'BLOCK' | 'SPLIT' | 'REGULAR';
  confidence: number;
  institutionalLikelihood: number;
  marketImpact: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  spotPriceBias: number;
  timeDecayImpact: number;
  gammaExposure: number;
  deltaHedging: DeltaHedgingInfo;
}

export interface DeltaHedgingInfo {
  estimatedShares: number;
  hedgingDirection: 'BUY' | 'SELL';
  marketMakerFlow: boolean;
  expectedSpotImpact: number;
}

export interface UnusualOptionsActivity {
  symbol: string;
  totalVolume: number;
  avgVolume: number;
  volumeRatio: number;
  largestTrades: OptionsFlow[];
  dominantFlow: 'CALL_BUYING' | 'PUT_BUYING' | 'CALL_SELLING' | 'PUT_SELLING';
  institutionalActivity: number;
  retailActivity: number;
  darkPoolActivity: number;
  sentiment: 'EXTREMELY_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'EXTREMELY_BEARISH';
  priceTargets: PriceTarget[];
  expirationAnalysis: ExpirationAnalysis;
}

export interface PriceTarget {
  price: number;
  probability: number;
  reasoning: string;
  timeframe: string;
  support: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ExpirationAnalysis {
  weeklyExpiry: OptionsExpiryData;
  monthlyExpiry: OptionsExpiryData;
  quarterlyExpiry: OptionsExpiryData;
  gamma_squeeze_risk: number;
  pin_risk: PinRiskData[];
}

export interface OptionsExpiryData {
  expiry: Date;
  totalOI: number;
  callOI: number;
  putOI: number;
  maxPain: number;
  gammaWall: number;
  supportLevels: number[];
  resistanceLevels: number[];
}

export interface PinRiskData {
  strike: number;
  openInterest: number;
  pinProbability: number;
  magnet_effect: number;
}

export class AdvancedOptionsFlowAnalyzer {
  private wsConnections: Map<string, WebSocket> = new Map();
  private optionsFlows: Map<string, OptionsFlow[]> = new Map();
  private realTimeData: Map<string, any> = new Map();
  private algorithms: FlowDetectionAlgorithm[] = [];

  constructor() {
    this.initializeAlgorithms();
  }

  async initialize(): Promise<void> {
    await this.connectToDataFeeds();
    this.startFlowDetection();
    this.startUnusualActivityDetection();
    logger.info('Advanced Options Flow Analyzer initialized');
  }

  private async connectToDataFeeds(): Promise<void> {
    // Connect to multiple options data feeds
    await Promise.all([
      this.connectToNSEOptionsData(),
      this.connectToInstitutionalFlowData(),
      this.connectToDarkPoolData(),
      this.connectToMarketMakerData(),
    ]);
  }

  private async connectToNSEOptionsData(): Promise<void> {
    const ws = new WebSocket('wss://nseindia.com/options/live');
    
    ws.on('message', (data) => {
      try {
        const optionsData = JSON.parse(data.toString());
        this.processOptionsData(optionsData);
      } catch (error) {
        logger.error('Error processing NSE options data:', error);
      }
    });

    this.wsConnections.set('NSE_OPTIONS', ws);
  }

  private processOptionsData(data: any): void {
    const flow = this.analyzeOptionsFlow(data);
    
    if (flow.unusualActivity) {
      this.detectUnusualActivity(flow);
    }

    this.updateFlowDatabase(flow);
    this.analyzeMarketImpact(flow);
  }

  private analyzeOptionsFlow(data: any): OptionsFlow {
    const flow: OptionsFlow = {
      id: `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      symbol: data.symbol,
      strike: data.strike,
      expiry: new Date(data.expiry),
      type: data.type,
      side: this.determineSide(data),
      volume: data.volume,
      openInterest: data.openInterest,
      premiumValue: data.premium * data.volume,
      impliedVolatility: data.iv,
      unusualActivity: false,
      flowType: 'REGULAR',
      confidence: 0,
      institutionalLikelihood: 0,
      marketImpact: 'NEUTRAL',
      spotPriceBias: 0,
      timeDecayImpact: 0,
      gammaExposure: 0,
      deltaHedging: {
        estimatedShares: 0,
        hedgingDirection: 'BUY',
        marketMakerFlow: false,
        expectedSpotImpact: 0,
      },
    };

    // Apply detection algorithms
    for (const algorithm of this.algorithms) {
      algorithm.analyze(flow, data);
    }

    return flow;
  }

  private detectUnusualActivity(flow: OptionsFlow): void {
    const symbol = flow.symbol;
    const recentFlows = this.getRecentFlows(symbol, 3600000); // Last hour
    
    const analysis = this.analyzeFlowPatterns(recentFlows);
    
    if (analysis.unusualScore > 0.7) {
      this.generateUnusualActivityAlert(symbol, analysis);
    }
  }

  private analyzeFlowPatterns(flows: OptionsFlow[]): any {
    const totalVolume = flows.reduce((sum, flow) => sum + flow.volume, 0);
    const avgVolume = this.getAverageVolume(flows[0]?.symbol);
    const volumeRatio = totalVolume / avgVolume;
    
    const callVolume = flows.filter(f => f.type === 'CALL').reduce((sum, f) => sum + f.volume, 0);
    const putVolume = flows.filter(f => f.type === 'PUT').reduce((sum, f) => sum + f.volume, 0);
    
    const buyVolume = flows.filter(f => f.side === 'BUY').reduce((sum, f) => sum + f.volume, 0);
    const sellVolume = flows.filter(f => f.side === 'SELL').reduce((sum, f) => sum + f.volume, 0);
    
    const institutionalVolume = flows
      .filter(f => f.institutionalLikelihood > 0.7)
      .reduce((sum, f) => sum + f.volume, 0);

    return {
      unusualScore: this.calculateUnusualScore(volumeRatio, flows),
      volumeRatio,
      callPutRatio: callVolume / (putVolume || 1),
      buyVsSellRatio: buyVolume / (sellVolume || 1),
      institutionalPercentage: institutionalVolume / totalVolume,
      darkPoolPercentage: this.calculateDarkPoolPercentage(flows),
      avgPremium: flows.reduce((sum, f) => sum + f.premiumValue, 0) / flows.length,
      dominantExpiry: this.findDominantExpiry(flows),
      concentrationRisk: this.calculateConcentrationRisk(flows),
    };
  }

  async generateOptionsFlowReport(symbol: string, timeframe: string): Promise<OptionsFlowReport> {
    const flows = this.getFlowsForTimeframe(symbol, timeframe);
    const chains = await this.getOptionsChains(symbol);
    
    const analysis = {
      totalVolume: flows.reduce((sum, f) => sum + f.volume, 0),
      totalPremium: flows.reduce((sum, f) => sum + f.premiumValue, 0),
      callVolume: flows.filter(f => f.type === 'CALL').reduce((sum, f) => sum + f.volume, 0),
      putVolume: flows.filter(f => f.type === 'PUT').reduce((sum, f) => sum + f.volume, 0),
      institutionalFlows: flows.filter(f => f.institutionalLikelihood > 0.7),
      retailFlows: flows.filter(f => f.institutionalLikelihood < 0.3),
      unusualFlows: flows.filter(f => f.unusualActivity),
      sweeps: flows.filter(f => f.flowType === 'SWEEP'),
      blocks: flows.filter(f => f.flowType === 'BLOCK'),
    };

    const sentiment = this.calculateSentimentFromFlows(flows);
    const priceTargets = this.extractPriceTargets(flows, chains);
    const riskMetrics = this.calculateRiskMetrics(flows, chains);
    
    return {
      symbol,
      timeframe,
      generatedAt: new Date(),
      summary: analysis,
      sentiment,
      priceTargets,
      riskMetrics,
      keyInsights: await this.generateAIInsights(symbol, flows, chains),
      tradingSignals: this.generateTradingSignals(flows, chains),
      alertsGenerated: this.getGeneratedAlerts(symbol, timeframe),
    };
  }

  private generateTradingSignals(flows: OptionsFlow[], chains: OptionsChain[]): TradingSignal[] {
    const signals: TradingSignal[] = [];
    
    // Gamma squeeze detection
    const gammaSignal = this.detectGammaSqueeze(flows, chains);
    if (gammaSignal) signals.push(gammaSignal);
    
    // Unusual call buying
    const callBuyingSignal = this.detectUnusualCallBuying(flows);
    if (callBuyingSignal) signals.push(callBuyingSignal);
    
    // Put wall detection
    const putWallSignal = this.detectPutWall(flows, chains);
    if (putWallSignal) signals.push(putWallSignal);
    
    // Institutional positioning
    const institutionalSignal = this.detectInstitutionalPositioning(flows);
    if (institutionalSignal) signals.push(institutionalSignal);
    
    return signals;
  }

  private initializeAlgorithms(): void {
    this.algorithms = [
      new SweepDetectionAlgorithm(),
      new BlockTradeDetectionAlgorithm(),
      new InstitutionalFlowDetectionAlgorithm(),
      new DarkPoolDetectionAlgorithm(),
      new GammaSqueezeDetectionAlgorithm(),
      new PinRiskDetectionAlgorithm(),
      new VolatilitySkewDetectionAlgorithm(),
    ];
  }
}

interface FlowDetectionAlgorithm {
  analyze(flow: OptionsFlow, rawData: any): void;
}

class SweepDetectionAlgorithm implements FlowDetectionAlgorithm {
  analyze(flow: OptionsFlow, rawData: any): void {
    // Detect options sweeps across multiple exchanges
    const volumeThreshold = this.getVolumeThreshold(flow.symbol);
    const speedThreshold = 10000; // 10 seconds
    
    if (flow.volume > volumeThreshold && this.isExecutedQuickly(rawData, speedThreshold)) {
      flow.flowType = 'SWEEP';
      flow.unusualActivity = true;
      flow.institutionalLikelihood = 0.8;
      flow.confidence = 0.9;
      
      // Calculate market impact
      flow.marketImpact = this.determineSweepImpact(flow);
    }
  }

  private getVolumeThreshold(symbol: string): number {
    // Dynamic threshold based on symbol's average volume
    return 1000; // Simplified
  }

  private isExecutedQuickly(rawData: any, threshold: number): boolean {
    return rawData.executionTime < threshold;
  }

  private determineSweepImpact(flow: OptionsFlow): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    if (flow.type === 'CALL' && flow.side === 'BUY') return 'BULLISH';
    if (flow.type === 'PUT' && flow.side === 'BUY') return 'BEARISH';
    return 'NEUTRAL';
  }
}

class GammaSqueezeDetectionAlgorithm implements FlowDetectionAlgorithm {
  analyze(flow: OptionsFlow, rawData: any): void {
    // Detect conditions that could lead to gamma squeeze
    const gammaExposure = this.calculateGammaExposure(flow);
    const deltaHedgingNeed = this.calculateDeltaHedgingNeed(flow);
    
    flow.gammaExposure = gammaExposure;
    flow.deltaHedging = {
      estimatedShares: deltaHedgingNeed.shares,
      hedgingDirection: deltaHedgingNeed.direction,
      marketMakerFlow: deltaHedgingNeed.isMarketMaker,
      expectedSpotImpact: deltaHedgingNeed.spotImpact,
    };
    
    if (gammaExposure > 0.5 && deltaHedgingNeed.isSignificant) {
      flow.unusualActivity = true;
      flow.confidence = 0.85;
    }
  }

  private calculateGammaExposure(flow: OptionsFlow): number {
    // Simplified gamma calculation
    return Math.random() * 0.8; // Placeholder
  }

  private calculateDeltaHedgingNeed(flow: OptionsFlow): any {
    return {
      shares: flow.volume * 100 * 0.5, // Simplified delta
      direction: flow.side === 'BUY' ? 'BUY' : 'SELL',
      isMarketMaker: Math.random() > 0.6,
      spotImpact: flow.volume * 0.001,
      isSignificant: flow.volume > 5000,
    };
  }
}

export interface TradingSignal {
  id: string;
  type: 'GAMMA_SQUEEZE' | 'UNUSUAL_CALL_BUYING' | 'PUT_WALL' | 'INSTITUTIONAL_FLOW';
  symbol: string;
  strength: number; // 0-10
  timeframe: string;
  description: string;
  actionable: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  expectedMove: number;
  probability: number;
}

export interface OptionsFlowReport {
  symbol: string;
  timeframe: string;
  generatedAt: Date;
  summary: any;
  sentiment: string;
  priceTargets: PriceTarget[];
  riskMetrics: any;
  keyInsights: string[];
  tradingSignals: TradingSignal[];
  alertsGenerated: any[];
}