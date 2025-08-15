export interface Trade {
  id: string;
  userId: string;
  symbol: string;
  exchange: string;
  segment: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  amount: number;
  orderType: string;
  productType: string;
  timestamp: Date;
  status: string;
  brokerage: number;
  stt: number;
  exchangeCharge: number;
  gst: number;
  sebiCharge: number;
  stampDuty: number;
  brokerOrderId: string;
  brokerTradeId: string;
  isin?: string;
  metadata?: Record<string, any>;
}

export interface TradeFilter {
  startDate?: Date;
  endDate?: Date;
  symbol?: string;
  exchange?: string;
  side?: 'buy' | 'sell';
  minAmount?: number;
  maxAmount?: number;
}