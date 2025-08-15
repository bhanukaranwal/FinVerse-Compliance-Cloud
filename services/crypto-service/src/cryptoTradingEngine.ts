import { Trade, Portfolio } from '@finverse/shared-types';
import { logger } from '../utils/logger';

export interface CryptoAsset {
  id: string;
  symbol: string;
  name: string;
  network: string;
  contractAddress?: string;
  decimals: number;
  marketCap: number;
  volume24h: number;
  priceUSD: number;
  priceINR: number;
  change24h: number;
  change7d: number;
  rank: number;
  isStablecoin: boolean;
  isDeFi: boolean;
  category: string[];
  tags: string[];
}

export interface CryptoExchange {
  name: string;
  url: string;
  apiUrl: string;
  supportedPairs: string[];
  fees: {
    maker: number;
    taker: number;
    withdrawal: Record<string, number>;
  };
  limits: {
    min_order_size: Record<string, number>;
    max_order_size: Record<string, number>;
    daily_withdrawal: Record<string, number>;
  };
  features: {
    spot_trading: boolean;
    margin_trading: boolean;
    futures_trading: boolean;
    staking: boolean;
    lending: boolean;
  };
}

export interface DeFiPosition {
  id: string;
  protocol: string;
  type: 'LENDING' | 'BORROWING' | 'LIQUIDITY_POOL' | 'STAKING' | 'YIELD_FARMING';
  asset: string;
  amount: number;
  valueUSD: number;
  apr: number;
  apy: number;
  rewards: Array<{
    token: string;
    amount: number;
    valueUSD: number;
  }>;
  lockPeriod?: number;
  unlockDate?: Date;
  impermanentLoss?: number;
  health_factor?: number;
}

export interface CryptoTaxEvent {
  id: string;
  userId: string;
  type: 'BUY' | 'SELL' | 'TRANSFER' | 'MINING' | 'STAKING' | 'AIRDROP' | 'FORK' | 'DEFI';
  timestamp: Date;
  asset: string;
  quantity: number;
  priceUSD: number;
  priceINR: number;
  feeAsset?: string;
  feeAmount?: number;
  exchange?: string;
  txHash?: string;
  costBasisMethod: 'FIFO' | 'LIFO' | 'HIFO' | 'AVERAGE';
  taxImplications: {
    shortTermGain?: number;
    longTermGain?: number;
    income?: number;
    category: 'CAPITAL_GAINS' | 'BUSINESS_INCOME' | 'OTHER_INCOME';
  };
}

export class CryptoTradingEngine {
  private supportedExchanges: Map<string, CryptoExchange> = new Map();
  private cryptoAssets: Map<string, CryptoAsset> = new Map();
  private defiProtocols: Map<string, any> = new Map();

  async initialize() {
    await this.loadSupportedExchanges();
    await this.loadCryptoAssets();
    await this.loadDeFiProtocols();
    this.startPriceUpdates();
    logger.info('Crypto trading engine initialized');
  }

  async getIndianCryptoMarkets(): Promise<{
    exchanges: CryptoExchange[];
    topAssets: CryptoAsset[];
    regulatoryStatus: {
      legal_status: string;
      tax_treatment: string;
      gst_applicable: boolean;
      tds_rate: number;
      latest_updates: Array<{
        date: Date;
        title: string;
        description: string;
        impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
      }>;
    };
  }> {
    const indianExchanges = Array.from(this.supportedExchanges.values())
      .filter(exchange => this.isIndianExchange(exchange.name));

    const topAssets = Array.from(this.cryptoAssets.values())
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 50);

    const regulatoryStatus = await this.getIndianCryptoRegulation();

    return {
      exchanges: indianExchanges,
      topAssets,
      regulatoryStatus,
    };
  }

  async executeCryptoTrade(
    userId: string,
    exchange: string,
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number,
    orderType: 'market' | 'limit',
    price?: number
  ): Promise<Trade> {
    // Validate exchange and symbol
    const exchangeConfig = this.supportedExchanges.get(exchange);
    if (!exchangeConfig) {
      throw new Error(`Unsupported exchange: ${exchange}`);
    }

    const asset = this.cryptoAssets.get(symbol);
    if (!asset) {
      throw new Error(`Unsupported crypto asset: ${symbol}`);
    }

    // Check regulatory compliance
    await this.checkCryptoCompliance(userId, symbol, side, quantity);

    // Execute trade on exchange
    const trade = await this.executeExchangeTrade(exchangeConfig, {
      symbol,
      side,
      quantity,
      orderType,
      price,
    });

    // Calculate tax implications
    const taxEvent = await this.calculateCryptoTaxEvent(userId, trade);
    
    // Store transaction
    await this.storeCryptoTransaction(userId, trade, taxEvent);

    // Update portfolio
    await this.updateCryptoPortfolio(userId, trade);

    logger.info(`Crypto trade executed: ${trade.id} for user ${userId}`);
    return trade;
  }

  async trackDeFiPositions(userId: string, walletAddresses: string[]): Promise<DeFiPosition[]> {
    const positions: DeFiPosition[] = [];

    for (const address of walletAddresses) {
      // Check major DeFi protocols
      const protocolPositions = await Promise.all([
        this.checkAavePositions(address),
        this.checkCompoundPositions(address),
        this.checkUniswapPositions(address),
        this.checkSushiswapPositions(address),
        this.checkCurvePositions(address),
        this.checkYearnPositions(address),
      ]);

      positions.push(...protocolPositions.flat());
    }

    // Calculate total DeFi portfolio value
    const totalValue = positions.reduce((sum, pos) => sum + pos.valueUSD, 0);
    
    // Store positions for tax calculation
    await this.storeDeFiPositions(userId, positions);

    logger.info(`Tracked ${positions.length} DeFi positions worth $${totalValue} for user ${userId}`);
    return positions;
  }

  async calculateCryptoTaxes(userId: string, financialYear: string): Promise<{
    capitalGains: {
      shortTerm: number;
      longTerm: number;
      total: number;
    };
    businessIncome: number;
    otherIncome: number;
    tdsDeducted: number;
    netTaxLiability: number;
    transactions: CryptoTaxEvent[];
    recommendations: string[];
  }> {
    const transactions = await this.getCryptoTransactions(userId, financialYear);
    
    let shortTermGains = 0;
    let longTermGains = 0;
    let businessIncome = 0;
    let otherIncome = 0;
    let tdsDeducted = 0;

    for (const transaction of transactions) {
      switch (transaction.taxImplications.category) {
        case 'CAPITAL_GAINS':
          if (transaction.taxImplications.shortTermGain) {
            shortTermGains += transaction.taxImplications.shortTermGain;
          }
          if (transaction.taxImplications.longTermGain) {
            longTermGains += transaction.taxImplications.longTermGain;
          }
          break;
          
        case 'BUSINESS_INCOME':
          businessIncome += transaction.taxImplications.income || 0;
          break;
          
        case 'OTHER_INCOME':
          otherIncome += transaction.taxImplications.income || 0;
          break;
      }

      // Calculate TDS (1% on crypto transactions as per Indian law)
      if (transaction.type === 'SELL' && transaction.priceINR > 50000) {
        tdsDeducted += transaction.priceINR * 0.01;
      }
    }

    const totalCapitalGains = shortTermGains + longTermGains;
    
    // Apply crypto tax rates (30% flat rate as per Indian law)
    const netTaxLiability = (totalCapitalGains + businessIncome + otherIncome) * 0.30 - tdsDeducted;

    const recommendations = this.generateCryptoTaxRecommendations({
      shortTermGains,
      longTermGains,
      businessIncome,
      otherIncome,
      transactions,
    });

    return {
      capitalGains: {
        shortTerm: shortTermGains,
        longTerm: longTermGains,
        total: totalCapitalGains,
      },
      businessIncome,
      otherIncome,
      tdsDeducted,
      netTaxLiability,
      transactions,
      recommendations,
    };
  }

  private async checkCryptoCompliance(
    userId: string,
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number
  ): Promise<void> {
    // Check if crypto trading is allowed for user
    const userProfile = await this.getUserProfile(userId);
    if (!userProfile.cryptoTradingEnabled) {
      throw new Error('Crypto trading not enabled for user');
    }

    // Check daily limits
    const dailyVolume = await this.getDailyTradingVolume(userId);
    const tradeValue = quantity * (await this.getCurrentPrice(symbol));
    
    if (dailyVolume + tradeValue > userProfile.dailyCryptoLimit) {
      throw new Error('Daily crypto trading limit exceeded');
    }

    // Check banned assets
    const bannedAssets = await this.getBannedCryptoAssets();
    if (bannedAssets.includes(symbol)) {
      throw new Error(`Trading ${symbol} is not allowed`);
    }

    // AML/KYC checks for large transactions
    if (tradeValue > 100000) { // 1 Lakh INR
      await this.performAMLCheck(userId, symbol, tradeValue);
    }
  }

  private generateCryptoTaxRecommendations(taxData: any): string[] {
    const recommendations: string[] = [];

    if (taxData.shortTermGains > taxData.longTermGains) {
      recommendations.push(
        'Consider holding assets for longer periods to benefit from long-term capital gains treatment'
      );
    }

    if (taxData.businessIncome > 0) {
      recommendations.push(
        'Maintain detailed records of business-related crypto activities for proper deduction claims'
      );
    }

    if (taxData.transactions.some((t: CryptoTaxEvent) => t.type === 'MINING' || t.type === 'STAKING')) {
      recommendations.push(
        'Mining and staking rewards are taxable as income at the time of receipt'
      );
    }

    recommendations.push(
      'Consider tax-loss harvesting opportunities before the financial year ends'
    );

    recommendations.push(
      'Maintain detailed records of all crypto transactions for compliance'
    );

    return recommendations;
  }

  private async getIndianCryptoRegulation(): Promise<any> {
    return {
      legal_status: 'Legal but regulated',
      tax_treatment: '30% flat tax on crypto gains, 1% TDS on transactions above ₹50,000',
      gst_applicable: true,
      tds_rate: 0.01,
      latest_updates: [
        {
          date: new Date('2024-07-01'),
          title: 'Updated Crypto Tax Guidelines',
          description: 'Clarifications on DeFi taxation and NFT transactions',
          impact: 'NEUTRAL' as const,
        },
        {
          date: new Date('2024-06-15'),
          title: 'Exchange Registration Requirements',
          description: 'New compliance requirements for crypto exchanges',
          impact: 'POSITIVE' as const,
        },
      ],
    };
  }
}