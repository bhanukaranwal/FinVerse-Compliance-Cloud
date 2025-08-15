import express from 'express';
import { WebSocket } from 'ws';
import { createClient } from 'redis';
import { MarketDataProvider } from './providers/marketDataProvider';
import { PriceAlertEngine } from './engines/priceAlertEngine';
import { TechnicalIndicatorEngine } from './engines/technicalIndicatorEngine';
import { logger } from './utils/logger';

const app = express();

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
  ohlc: {
    '1m': OHLC[];
    '5m': OHLC[];
    '15m': OHLC[];
    '1h': OHLC[];
    '1d': OHLC[];
  };
}

export interface OHLC {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  sma: { [period: string]: number };
  ema: { [period: string]: number };
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollinger_bands: {
    upper: number;
    middle: number;
    lower: number;
  };
  stochastic: {
    k: number;
    d: number;
  };
  atr: number;
  adx: number;
  williams_r: number;
  momentum: number;