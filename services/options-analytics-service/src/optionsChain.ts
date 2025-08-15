import { MarketData } from '../types';
import { logger } from '../utils/logger';

export interface OptionContract {
  symbol: string;
  strike: number;
  expiry: Date;
  type: 'CALL' | 'PUT';
  ltp: number;
  change: number;
  changePercent: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  intrinsicValue: number;
  timeValue: number;
  bid: number;
  ask: number;
  bidQty: number;
  askQty: number;
}

export interface OptionsChain {
  underlying: string;
  underlyingPrice: number;
  expiries: Date[];
  strikes: number[];
  calls: Map<string, OptionContract>; // key: strike_expiry
  puts: Map<string, OptionContract>;
  maxPain: number;
  pcr: number; // Put-Call Ratio
  impliedVolatility: number;
  volatilitySkew: Array<{
    strike: number;
    callIV: number;
    putIV: number;
    skew: number;
  }>;
  greeksProfile: {
    totalDelta: number;
    totalGamma: number;
    totalTheta: number;
    totalVega: number;
  };
  support_resistance: {
    support: number[];
    resistance: number[];
  };
}

export interface OptionStrategy {
  name: string;
  type: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  complexity: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
  legs: Array<{
    action: 'BUY' | 'SELL';
    contract: OptionContract;
    quantity: number;
  }>;
  maxProfit: number;
  maxLoss: number;
  breakeven: number[];
  probability: number;
  margin: number;
  collateral: number;
  riskReward: number;
  payoffChart: Array<{
    underlyingPrice: number;
    pnl: number;
  }>;
}

export class OptionsChainAnalyzer {
  private riskFreeRate = 0.06; // 6% risk-free rate
  
  async getOptionsChain(underlying: string, expiry?: Date): Promise<OptionsChain> {
    const underlyingPrice = await this.getUnderlyingPrice(underlying);
    const contracts = await this.getOptionContracts(underlying, expiry);
    
    const chain: OptionsChain = {
      underlying,
      underlyingPrice,
      expiries: this.getUniqueExpiries(contracts),
      strikes: this.getUniqueStrikes(contracts),
      calls: new Map(),
      puts: new Map(),
      maxPain: 0,
      pcr: 0,
      impliedVolatility: 0,
      volatilitySkew: [],
      greeksProfile: {
        totalDelta: 0,
        totalGamma: 0,
        totalTheta: 0,
        totalVega: 0,
      },
      support_resistance: {
        support: [],
        resistance: [],
      },
    };

    // Organize contracts by type
    for (const contract of contracts) {
      const key = `${contract.strike}_${contract.expiry.toISOString()}`;
      
      // Calculate Greeks if not provided
      if (contract.delta === 0) {
        const greeks = this.calculateGreeks(contract, underlyingPrice);
        Object.assign(contract, greeks);
      }
      
      if (contract.type === 'CALL') {
        chain.calls.set(key, contract);
      } else {
        chain.puts.set(key, contract);
      }
    }

    // Calculate derived metrics
    chain.maxPain = this.calculateMaxPain(chain);
    chain.pcr = this.calculatePCR(chain);
    chain.impliedVolatility = this.calculateATMImpliedVolatility(chain);
    chain.volatilitySkew = this.calculateVolatilitySkew(chain);
    chain.greeksProfile = this.calculateGreeksProfile(chain);
    chain.support_resistance = this.calculateSupportResistance(chain);

    return chain;
  }

  private calculateGreeks(contract: OptionContract, underlyingPrice: number) {
    const S = underlyingPrice;
    const K = contract.strike;
    const r = this.riskFreeRate;
    const T = this.getTimeToExpiry(contract.expiry);
    const sigma = contract.impliedVolatility || 0.2; // Default 20% IV
    
    const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    
    const N = this.normalCDF;
    const n = this.normalPDF;
    
    let delta, gamma, theta, vega, rho;
    
    if (contract.type === 'CALL') {
      delta = N(d1);
      theta = (-S * n(d1) * sigma / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * N(d2)) / 365;
      rho = K * T * Math.exp(-r * T) * N(d2) / 100;
    } else {
      delta = N(d1) - 1;
      theta = (-S * n(d1) * sigma / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * N(-d2)) / 365;
      rho = -K * T * Math.exp(-r * T) * N(-d2) / 100;
    }
    
    gamma = n(d1) / (S * sigma * Math.sqrt(T));
    vega = S * n(d1) * Math.sqrt(T) / 100;
    
    return { delta, gamma, theta, vega, rho };
  }

  private calculateMaxPain(chain: OptionsChain): number {
    let maxPain = 0;
    let minPain = Infinity;
    
    for (const strike of chain.strikes) {
      let totalPain = 0;
      
      // Calculate pain for calls
      for (const [key, call] of chain.calls) {
        if (call.strike === strike) continue;
        
        const intrinsicValue = Math.max(0, strike - call.strike);
        totalPain += intrinsicValue * call.openInterest;
      }
      
      // Calculate pain for puts
      for (const [key, put] of chain.puts) {
        if (put.strike === strike) continue;
        
        const intrinsicValue = Math.max(0, put.strike - strike);
        totalPain += intrinsicValue * put.openInterest;
      }
      
      if (totalPain < minPain) {
        minPain = totalPain;
        maxPain = strike;
      }
    }
    
    return maxPain;
  }

  private calculatePCR(chain: OptionsChain): number {
    let totalPutOI = 0;
    let totalCallOI = 0;
    
    for (const put of chain.puts.values()) {
      totalPutOI += put.openInterest;
    }
    
    for (const call of chain.calls.values()) {
      totalCallOI += call.openInterest;
    }
    
    return totalCallOI > 0 ? totalPutOI / totalCallOI : 0;
  }

  private calculateVolatilitySkew(chain: OptionsChain): OptionsChain['volatilitySkew'] {
    const skew: OptionsChain['volatilitySkew'] = [];
    
    for (const strike of chain.strikes) {
      const callKey = `${strike}_${chain.expiries[0]?.toISOString()}`;
      const putKey = `${strike}_${chain.expiries[0]?.toISOString()}`;
      
      const call = chain.calls.get(callKey);
      const put = chain.puts.get(putKey);
      
      if (call && put) {
        const skewValue = put.impliedVolatility - call.impliedVolatility;
        
        skew.push({
          strike,
          callIV: call.impliedVolatility,
          putIV: put.impliedVolatility,
          skew: skewValue,
        });
      }
    }
    
    return skew.sort((a, b) => a.strike - b.strike);
  }

  async analyzeOptionStrategies(
    underlying: string,
    marketOutlook: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
    riskTolerance: 'LOW' | 'MEDIUM' | 'HIGH'
  ): Promise<OptionStrategy[]> {
    const chain = await this.getOptionsChain(underlying);
    const strategies: OptionStrategy[] = [];
    
    switch (marketOutlook) {
      case 'BULLISH':
        strategies.push(
          ...this.generateBullishStrategies(chain, riskTolerance)
        );
        break;
        
      case 'BEARISH':
        strategies.push(
          ...this.generateBearishStrategies(chain, riskTolerance)
        );
        break;
        
      case 'NEUTRAL':
        strategies.push(
          ...this.generateNeutralStrategies(chain, riskTolerance)
        );
        break;
    }
    
    // Sort by risk-reward ratio
    return strategies.sort((a, b) => b.riskReward - a.riskReward);
  }

  private generateBullishStrategies(chain: OptionsChain, riskTolerance: string): OptionStrategy[] {
    const strategies: OptionStrategy[] = [];
    const atmStrike = this.getATMStrike(chain);
    const nearExpiry = chain.expiries[0];
    
    // Long Call
    const atmCall = chain.calls.get(`${atmStrike}_${nearExpiry.toISOString()}`);
    if (atmCall) {
      strategies.push(this.createLongCallStrategy(atmCall, chain.underlyingPrice));
    }
    
    // Bull Call Spread
    const otmStrike = this.getOTMStrike(chain, 'CALL', 1);
    const otmCall = chain.calls.get(`${otmStrike}_${nearExpiry.toISOString()}`);
    if (atmCall && otmCall) {
      strategies.push(this.createBullCallSpreadStrategy(atmCall, otmCall, chain.underlyingPrice));
    }
    
    // Cash Secured Put (if risk tolerance allows)
    if (riskTolerance === 'HIGH') {
      const otmPutStrike = this.getOTMStrike(chain, 'PUT', 1);
      const otmPut = chain.puts.get(`${otmPutStrike}_${nearExpiry.toISOString()}`);
      if (otmPut) {
        strategies.push(this.createCashSecuredPutStrategy(otmPut, chain.underlyingPrice));
      }
    }
    
    return strategies;
  }

  private generateBearishStrategies(chain: OptionsChain, riskTolerance: string): OptionStrategy[] {
    const strategies: OptionStrategy[] = [];
    const atmStrike = this.getATMStrike(chain);
    const nearExpiry = chain.expiries[0];
    
    // Long Put
    const atmPut = chain.puts.get(`${atmStrike}_${nearExpiry.toISOString()}`);
    if (atmPut) {
      strategies.push(this.createLongPutStrategy(atmPut, chain.underlyingPrice));
    }
    
    // Bear Put Spread
    const otmStrike = this.getOTMStrike(chain, 'PUT', 1);
    const otmPut = chain.puts.get(`${otmStrike}_${nearExpiry.toISOString()}`);
    if (atmPut && otmPut) {
      strategies.push(this.createBearPutSpreadStrategy(atmPut, otmPut, chain.underlyingPrice));
    }
    
    // Covered Call (if risk tolerance allows)
    if (riskTolerance === 'HIGH') {
      const otmCallStrike = this.getOTMStrike(chain, 'CALL', 1);
      const otmCall = chain.calls.get(`${otmCallStrike}_${nearExpiry.toISOString()}`);
      if (otmCall) {
        strategies.push(this.createCoveredCallStrategy(otmCall, chain.underlyingPrice));
      }
    }
    
    return strategies;
  }

  private generateNeutralStrategies(chain: OptionsChain, riskTolerance: string): OptionStrategy[] {
    const strategies: OptionStrategy[] = [];
    const atmStrike = this.getATMStrike(chain);
    const nearExpiry = chain.expiries[0];
    
    // Iron Condor
    const strategies_complex = this.createIronCondorStrategy(chain, atmStrike, nearExpiry);
    if (strategies_complex) {
      strategies.push(strategies_complex);
    }
    
    // Straddle
    const atmCall = chain.calls.get(`${atmStrike}_${nearExpiry.toISOString()}`);
    const atmPut = chain.puts.get(`${atmStrike}_${nearExpiry.toISOString()}`);
    if (atmCall && atmPut) {
      strategies.push(this.createStraddleStrategy(atmCall, atmPut, chain.underlyingPrice));
    }
    
    // Butterfly Spread
    const butterfly = this.createButterflySpreadStrategy(chain, atmStrike, nearExpiry);
    if (butterfly) {
      strategies.push(butterfly);
    }
    
    return strategies;
  }

  private createLongCallStrategy(call: OptionContract, underlyingPrice: number): OptionStrategy {
    const maxLoss = call.ltp;
    const breakeven = call.strike + call.ltp;
    
    return {
      name: 'Long Call',
      type: 'BULLISH',
      complexity: 'BASIC',
      legs: [{
        action: 'BUY',
        contract: call,
        quantity: 1
      }],
      maxProfit: Infinity,
      maxLoss,
      breakeven: [breakeven],
      probability: this.calculateProbability(underlyingPrice, breakeven, call.expiry),
      margin: maxLoss,
      collateral: 0,
      riskReward: Infinity,
      payoffChart: this.generatePayoffChart([{
        action: 'BUY',
        contract: call,
        quantity: 1
      }], underlyingPrice)
    };
  }

  private calculateProbability(currentPrice: number, targetPrice: number, expiry: Date): number {
    // Simplified probability calculation using normal distribution
    const timeToExpiry = this.getTimeToExpiry(expiry);
    const volatility = 0.2; // Assume 20% annual volatility
    
    const drift = Math.log(targetPrice / currentPrice);
    const variance = volatility * volatility * timeToExpiry;
    const standardError = Math.sqrt(variance);
    
    const z = drift / standardError;
    return this.normalCDF(z);
  }

  private generatePayoffChart(legs: OptionStrategy['legs'], underlyingPrice: number): OptionStrategy['payoffChart'] {
    const chart: OptionStrategy['payoffChart'] = [];
    const priceRange = underlyingPrice * 0.4; // ±40% of current price
    const step = priceRange / 50; // 50 points on the chart
    
    for (let price = underlyingPrice - priceRange; price <= underlyingPrice + priceRange; price += step) {
      let totalPnL = 0;
      
      for (const leg of legs) {
        const contract = leg.contract;
        let optionValue = 0;
        
        if (contract.type === 'CALL') {
          optionValue = Math.max(0, price - contract.strike);
        } else {
          optionValue = Math.max(0, contract.strike - price);
        }
        
        const legPnL = leg.action === 'BUY' 
          ? (optionValue - contract.ltp) * leg.quantity
          : (contract.ltp - optionValue) * leg.quantity;
          
        totalPnL += legPnL;
      }
      
      chart.push({ underlyingPrice: price, pnl: totalPnL });
    }
    
    return chart;
  }

  // Helper methods
  private normalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  private normalPDF(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  private erf(x: number): number {
    // Approximation of error function
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  private getTimeToExpiry(expiry: Date): number {
    const now = new Date();
    const timeToExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365);
    return Math.max(0.001, timeToExpiry); // Minimum 1 day
  }

  private getATMStrike(chain: OptionsChain): number {
    return chain.strikes.reduce((prev, curr) => 
      Math.abs(curr - chain.underlyingPrice) < Math.abs(prev - chain.underlyingPrice) ? curr : prev
    );
  }

  private getOTMStrike(chain: OptionsChain, type: 'CALL' | 'PUT', steps: number): number {
    const atmStrike = this.getATMStrike(chain);
    const sortedStrikes = [...chain.strikes].sort((a, b) => a - b);
    const atmIndex = sortedStrikes.indexOf(atmStrike);
    
    if (type === 'CALL') {
      return sortedStrikes[Math.min(atmIndex + steps, sortedStrikes.length - 1)];
    } else {
      return sortedStrikes[Math.max(atmIndex - steps, 0)];
    }
  }

  // Additional helper methods would be implemented here...
}