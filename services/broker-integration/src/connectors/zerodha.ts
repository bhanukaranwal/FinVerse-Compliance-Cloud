import axios from 'axios';
import crypto from 'crypto';
import { BrokerConnector } from './base';
import { Trade, Holding, Position } from '../types';
import { logger } from '../utils/logger';

export class ZerodhaConnector extends BrokerConnector {
  private apiKey: string;
  private apiSecret: string;
  private accessToken: string;
  private baseUrl = 'https://api.kite.trade';

  constructor(config: {
    apiKey: string;
    apiSecret: string;
    accessToken?: string;
  }) {
    super('zerodha');
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.accessToken = config.accessToken || '';
  }

  async authenticate(requestToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const checksum = crypto
        .createHash('sha256')
        .update(this.apiKey + requestToken + this.apiSecret)
        .digest('hex');

      const response = await axios.post(`${this.baseUrl}/session/token`, {
        api_key: this.apiKey,
        request_token: requestToken,
        checksum: checksum,
      });

      this.accessToken = response.data.data.access_token;
      
      return {
        accessToken: response.data.data.access_token,
        refreshToken: response.data.data.refresh_token,
      };
    } catch (error) {
      logger.error('Zerodha authentication error:', error);
      throw new Error('Failed to authenticate with Zerodha');
    }
  }

  async getTrades(startDate: Date, endDate: Date): Promise<Trade[]> {
    try {
      const response = await this.makeRequest('/orders');
      const orders = response.data;

      return orders
        .filter((order: any) => order.status === 'COMPLETE')
        .map((order: any) => this.mapOrderToTrade(order));
    } catch (error) {
      logger.error('Failed to fetch trades from Zerodha:', error);
      throw error;
    }
  }

  async getHoldings(): Promise<Holding[]> {
    try {
      const response = await this.makeRequest('/portfolio/holdings');
      const holdings = response.data;

      return holdings.map((holding: any) => this.mapToHolding(holding));
    } catch (error) {
      logger.error('Failed to fetch holdings from Zerodha:', error);
      throw error;
    }
  }

  async getPositions(): Promise<Position[]> {
    try {
      const response = await this.makeRequest('/portfolio/positions');
      const positions = response.data;

      return [...positions.net, ...positions.day].map((position: any) => 
        this.mapToPosition(position)
      );
    } catch (error) {
      logger.error('Failed to fetch positions from Zerodha:', error);
      throw error;
    }
  }

  async getProfile(): Promise<any> {
    try {
      const response = await this.makeRequest('/user/profile');
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch profile from Zerodha:', error);
      throw error;
    }
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: any) {
    const headers = {
      'Authorization': `token ${this.apiKey}:${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    const config = {
      method,
      url: `${this.baseUrl}${endpoint}`,
      headers,
      ...(data && { data }),
    };

    return axios(config);
  }

  private mapOrderToTrade(order: any): Trade {
    return {
      id: order.order_id,
      symbol: order.tradingsymbol,
      exchange: order.exchange,
      segment: this.getSegment(order.exchange, order.tradingsymbol),
      side: order.transaction_type.toLowerCase() as 'buy' | 'sell',
      quantity: order.filled_quantity || order.quantity,
      price: order.average_price || order.price,
      amount: (order.filled_quantity || order.quantity) * (order.average_price || order.price),
      orderType: order.order_type.toLowerCase(),
      productType: order.product.toLowerCase(),
      timestamp: new Date(order.order_timestamp),
      status: order.status.toLowerCase(),
      brokerage: 0, // Calculate separately
      taxes: {
        stt: 0,
        exchangeCharge: 0,
        gst: 0,
        sebiCharge: 0,
        stampDuty: 0,
      },
      brokerOrderId: order.order_id,
      brokerTradeId: order.order_id,
      isin: order.isin || '',
      metadata: {
        validity: order.validity,
        variety: order.variety,
        tag: order.tag,
      },
    };
  }

  private mapToHolding(holding: any): Holding {
    return {
      symbol: holding.tradingsymbol,
      exchange: holding.exchange,
      isin: holding.isin,
      quantity: holding.quantity,
      averagePrice: holding.average_price,
      currentPrice: holding.last_price,
      marketValue: holding.quantity * holding.last_price,
      investedValue: holding.quantity * holding.average_price,
      pnl: (holding.quantity * holding.last_price) - (holding.quantity * holding.average_price),
      pnlPercentage: ((holding.last_price - holding.average_price) / holding.average_price) * 100,
      collateralQuantity: holding.collateral_quantity || 0,
      collateralType: holding.collateral_type || '',
      metadata: {
        instrumentToken: holding.instrument_token,
        authorisedDate: holding.authorised_date,
        authorisedQuantity: holding.authorised_quantity,
      },
    };
  }

  private mapToPosition(position: any): Position {
    return {
      symbol: position.tradingsymbol,
      exchange: position.exchange,
      segment: this.getSegment(position.exchange, position.tradingsymbol),
      netQuantity: position.net_quantity,
      buyQuantity: position.buy_quantity,
      sellQuantity: position.sell_quantity,
      averagePrice: position.average_price,
      currentPrice: position.last_price,
      pnl: position.pnl,
      realizedPnl: position.realised,
      unrealizedPnl: position.unrealised,
      productType: position.product.toLowerCase(),
      metadata: {
        instrumentToken: position.instrument_token,
        multiplier: position.multiplier,
        buyPrice: position.buy_price,
        sellPrice: position.sell_price,
        buyValue: position.buy_value,
        sellValue: position.sell_value,
      },
    };
  }

  private getSegment(exchange: string, symbol: string): string {
    if (exchange === 'NSE' || exchange === 'BSE') {
      if (symbol.includes('FUT') || symbol.includes('CE') || symbol.includes('PE')) {
        return 'F&O';
      }
      return 'EQUITY';
    }
    if (exchange === 'MCX') {
      return 'COMMODITY';
    }
    return 'OTHER';
  }
}