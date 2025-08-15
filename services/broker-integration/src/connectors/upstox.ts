import axios from 'axios';
import { BrokerConnector } from './base';
import { Trade, Holding, Position } from '../types';
import { logger } from '../utils/logger';

export class UpstoxConnector extends BrokerConnector {
  private apiKey: string;
  private apiSecret: string;
  private accessToken: string;
  private baseUrl = 'https://api.upstox.com/v2';

  constructor(config: {
    apiKey: string;
    apiSecret: string;
    accessToken?: string;
  }) {
    super('upstox');
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.accessToken = config.accessToken || '';
  }

  async authenticate(authCode: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const response = await axios.post(`${this.baseUrl}/login/authorization/token`, {
        code: authCode,
        client_id: this.apiKey,
        client_secret: this.apiSecret,
        redirect_uri: process.env.UPSTOX_REDIRECT_URI,
        grant_type: 'authorization_code',
      });

      this.accessToken = response.data.access_token;
      
      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
      };
    } catch (error) {
      logger.error('Upstox authentication error:', error);
      throw new Error('Failed to authenticate with Upstox');
    }
  }

  async getTrades(startDate: Date, endDate: Date): Promise<Trade[]> {
    try {
      const response = await this.makeRequest('/order/trades');
      const trades = response.data;

      return trades.map((trade: any) => this.mapToTrade(trade));
    } catch (error) {
      logger.error('Failed to fetch trades from Upstox:', error);
      throw error;
    }
  }

  async getHoldings(): Promise<Holding[]> {
    try {
      const response = await this.makeRequest('/portfolio/long-term-holdings');
      const holdings = response.data;

      return holdings.map((holding: any) => this.mapToHolding(holding));
    } catch (error) {
      logger.error('Failed to fetch holdings from Upstox:', error);
      throw error;
    }
  }

  async getPositions(): Promise<Position[]> {
    try {
      const response = await this.makeRequest('/portfolio/short-term-positions');
      const positions = response.data;

      return positions.map((position: any) => this.mapToPosition(position));
    } catch (error) {
      logger.error('Failed to fetch positions from Upstox:', error);
      throw error;
    }
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: any) {
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const config = {
      method,
      url: `${this.baseUrl}${endpoint}`,
      headers,
      ...(data && { data }),
    };

    return axios(config);
  }

  private mapToTrade(trade: any): Trade {
    return {
      id: trade.trade_id,
      symbol: trade.instrument_token,
      exchange: trade.exchange,
      segment: this.getSegment(trade.segment),
      side: trade.transaction_type.toLowerCase() as 'buy' | 'sell',
      quantity: trade.quantity,
      price: trade.price,
      amount: trade.quantity * trade.price,
      orderType: trade.order_type?.toLowerCase() || 'market',
      productType: trade.product?.toLowerCase() || 'mis',
      timestamp: new Date(trade.trade_date),
      status: 'executed',
      brokerage: 0,
      taxes: {
        stt: 0,
        exchangeCharge: 0,
        gst: 0,
        sebiCharge: 0,
        stampDuty: 0,
      },
      brokerOrderId: trade.order_id,
      brokerTradeId: trade.trade_id,
      isin: trade.isin || '',
      metadata: trade,
    };
  }

  private mapToHolding(holding: any): Holding {
    return {
      symbol: holding.instrument_token,
      exchange: holding.exchange,
      isin: holding.isin,
      quantity: holding.quantity,
      averagePrice: holding.average_price,
      currentPrice: holding.last_price,
      marketValue: holding.quantity * holding.last_price,
      investedValue: holding.quantity * holding.average_price,
      pnl: (holding.quantity * holding.last_price) - (holding.quantity * holding.average_price),
      pnlPercentage: ((holding.last_price - holding.average_price) / holding.average_price) * 100,
      collateralQuantity: 0,
      collateralType: '',
      metadata: holding,
    };
  }

  private mapToPosition(position: any): Position {
    return {
      symbol: position.instrument_token,
      exchange: position.exchange,
      segment: this.getSegment(position.segment),
      netQuantity: position.quantity,
      buyQuantity: position.buy_quantity || 0,
      sellQuantity: position.sell_quantity || 0,
      averagePrice: position.average_price,
      currentPrice: position.last_price,
      pnl: position.unrealised + position.realised,
      realizedPnl: position.realised,
      unrealizedPnl: position.unrealised,
      productType: position.product?.toLowerCase() || 'mis',
      metadata: position,
    };
  }

  private getSegment(segment: string): string {
    const segmentMap: { [key: string]: string } = {
      'EQ': 'EQUITY',
      'FO': 'F&O',
      'CD': 'COMMODITY',
      'MF': 'MUTUAL_FUND',
    };
    return segmentMap[segment] || segment;
  }
}