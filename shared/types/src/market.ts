export interface MarketData {
  symbol: string;
  exchange: string;
  ltp: number; // Last Traded Price
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  close: number;
  timestamp: Date;
  bid: number;
  ask: number;
  bidQty: number;
  askQty: number;
  ohlc?: OHLC[];
}

export interface OHLC {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketIndex {
  name: string;
  value: number;
  change: number;
  changePercent: number;
  timestamp: Date;
}

export interface MarketNews {
  id: string;
  headline: string;
  summary: string;
  content: string;
  source: string;
  publishedAt: Date;
  symbols: string[];
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  url?: string;
}