export class MarketDataProvider {
  private wsConnections: Map<string, WebSocket> = new Map();
  private redis = createClient();
  private priceAlertEngine: PriceAlertEngine;
  private technicalEngine: TechnicalIndicatorEngine;
  private subscribers: Map<string, Set<string>> = new Map(); // symbol -> userIds

  constructor() {
    this.priceAlertEngine = new PriceAlertEngine();
    this.technicalEngine = new TechnicalIndicatorEngine();
  }

  async initialize() {
    await this.redis.connect();
    await this.connectToDataFeeds();
    this.startPriceUpdateBroadcast();
    logger.info('Market data provider initialized');
  }

  private async connectToDataFeeds() {
    // Connect to NSE WebSocket
    await this.connectToNSE();
    
    // Connect to BSE WebSocket
    await this.connectToBSE();
    
    // Connect to MCX WebSocket
    await this.connectToMCX();
    
    // Connect to cryptocurrency feeds
    await this.connectToCryptoFeeds();
  }

  private async connectToNSE() {
    const nseWs = new WebSocket('wss://nseindia.com/live_market/dynaContent/live_watch/stock_watch/liveWatchData.json');
    
    nseWs.on('open', () => {
      logger.info('Connected to NSE WebSocket');
      this.wsConnections.set('NSE', nseWs);
      
      // Subscribe to market data
      nseWs.send(JSON.stringify({
        type: 'subscribe',
        symbols: ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'TCS', 'INFY', 'HDFCBANK']
      }));
    });

    nseWs.on('message', async (data) => {
      try {
        const marketData = JSON.parse(data.toString());
        await this.processMarketData(marketData, 'NSE');
      } catch (error) {
        logger.error('Error processing NSE data:', error);
      }
    });

    nseWs.on('error', (error) => {
      logger.error('NSE WebSocket error:', error);
      this.reconnectAfterDelay('NSE', () => this.connectToNSE(), 5000);
    });

    nseWs.on('close', () => {
      logger.warn('NSE WebSocket disconnected');
      this.reconnectAfterDelay('NSE', () => this.connectToNSE(), 5000);
    });
  }

  private async connectToBSE() {
    const bseWs = new WebSocket('wss://api.bseindia.com/BseWatch/ScripWatch.asmx');
    
    bseWs.on('open', () => {
      logger.info('Connected to BSE WebSocket');
      this.wsConnections.set('BSE', bseWs);
    });

    bseWs.on('message', async (data) => {
      try {
        const marketData = JSON.parse(data.toString());
        await this.processMarketData(marketData, 'BSE');
      } catch (error) {
        logger.error('Error processing BSE data:', error);
      }
    });
  }

  private async connectToMCX() {
    const mcxWs = new WebSocket('wss://mcxindia.com/live_market');
    
    mcxWs.on('open', () => {
      logger.info('Connected to MCX WebSocket');
      this.wsConnections.set('MCX', mcxWs);
    });

    mcxWs.on('message', async (data) => {
      try {
        const marketData = JSON.parse(data.toString());
        await this.processMarketData(marketData, 'MCX');
      } catch (error) {
        logger.error('Error processing MCX data:', error);
      }
    });
  }

  private async connectToCryptoFeeds() {
    // Connect to Binance for crypto data
    const binanceWs = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker');
    
    binanceWs.on('open', () => {
      logger.info('Connected to Binance WebSocket');
      this.wsConnections.set('BINANCE', binanceWs);
    });

    binanceWs.on('message', async (data) => {
      try {
        const cryptoData = JSON.parse(data.toString());
        await this.processCryptoData(cryptoData);
      } catch (error) {
        logger.error('Error processing crypto data:', error);
      }
    });

    // Connect to WazirX for INR crypto pairs
    const wazirxWs = new WebSocket('wss://stream.wazirx.com/stream');
    
    wazirxWs.on('open', () => {
      logger.info('Connected to WazirX WebSocket');
      this.wsConnections.set('WAZIRX', wazirxWs);
      
      wazirxWs.send(JSON.stringify({
        event: 'subscribe',
        streams: ['btcinr@ticker', 'ethinr@ticker', 'adainr@ticker']
      }));
    });
  }

  private async processMarketData(data: any, exchange: string) {
    const marketData: MarketData = this.normalizeMarketData(data, exchange);
    
    // Store in Redis for real-time access
    await this.redis.setEx(
      `market:${exchange}:${marketData.symbol}`,
      60, // TTL 60 seconds
      JSON.stringify(marketData)
    );

    // Update OHLC data
    await this.updateOHLCData(marketData);

    // Calculate technical indicators
    const indicators = await this.technicalEngine.calculateIndicators(marketData.symbol);
    
    // Store indicators
    await this.redis.setEx(
      `indicators:${exchange}:${marketData.symbol}`,
      300, // TTL 5 minutes
      JSON.stringify(indicators)
    );

    // Check price alerts
    await this.priceAlertEngine.checkAlerts(marketData);

    // Broadcast to subscribers
    await this.broadcastToSubscribers(marketData, indicators);

    // Store historical data for backtesting
    await this.storeHistoricalData(marketData);
  }

  private normalizeMarketData(data: any, exchange: string): MarketData {
    // Normalize different exchange data formats
    switch (exchange) {
      case 'NSE':
        return {
          symbol: data.symbol,
          exchange: 'NSE',
          ltp: parseFloat(data.lastPrice),
          change: parseFloat(data.change),
          changePercent: parseFloat(data.pChange),
          volume: parseInt(data.totalTradedVolume),
          high: parseFloat(data.dayHigh),
          low: parseFloat(data.dayLow),
          open: parseFloat(data.open),
          close: parseFloat(data.previousClose),
          timestamp: new Date(),
          bid: parseFloat(data.bidPrice),
          ask: parseFloat(data.askPrice),
          bidQty: parseInt(data.bidQty),
          askQty: parseInt(data.askQty),
          ohlc: {
            '1m': [],
            '5m': [],
            '15m': [],
            '1h': [],
            '1d': []
          }
        };
      
      case 'BSE':
        return {
          symbol: data.scrip_cd,
          exchange: 'BSE',
          ltp: parseFloat(data.ltp),
          change: parseFloat(data.chg),
          changePercent: parseFloat(data.per_chg),
          volume: parseInt(data.volume),
          high: parseFloat(data.high),
          low: parseFloat(data.low),
          open: parseFloat(data.open),
          close: parseFloat(data.close),
          timestamp: new Date(),
          bid: parseFloat(data.bid),
          ask: parseFloat(data.ask),
          bidQty: parseInt(data.bid_qty),
          askQty: parseInt(data.ask_qty),
          ohlc: {
            '1m': [],
            '5m': [],
            '15m': [],
            '1h': [],
            '1d': []
          }
        };
      
      default:
        throw new Error(`Unsupported exchange: ${exchange}`);
    }
  }

  private async updateOHLCData(marketData: MarketData) {
    const timeframes = ['1m', '5m', '15m', '1h', '1d'];
    
    for (const timeframe of timeframes) {
      const key = `ohlc:${marketData.exchange}:${marketData.symbol}:${timeframe}`;
      const currentCandle = await this.getCurrentCandle(key, timeframe);
      
      if (this.shouldCreateNewCandle(currentCandle, timeframe, marketData.timestamp)) {
        // Create new candle
        const newCandle: OHLC = {
          timestamp: this.alignTimestamp(marketData.timestamp, timeframe),
          open: marketData.ltp,
          high: marketData.ltp,
          low: marketData.ltp,
          close: marketData.ltp,
          volume: marketData.volume
        };
        
        await this.redis.lPush(key, JSON.stringify(newCandle));
        await this.redis.lTrim(key, 0, 1000); // Keep last 1000 candles
      } else {
        // Update existing candle
        if (currentCandle) {
          currentCandle.high = Math.max(currentCandle.high, marketData.ltp);
          currentCandle.low = Math.min(currentCandle.low, marketData.ltp);
          currentCandle.close = marketData.ltp;
          currentCandle.volume = marketData.volume;
          
          await this.redis.lSet(key, 0, JSON.stringify(currentCandle));
        }
      }
    }
  }

  private async broadcastToSubscribers(marketData: MarketData, indicators: TechnicalIndicators) {
    const subscribers = this.subscribers.get(marketData.symbol) || new Set();
    
    const message = {
      type: 'market_update',
      data: {
        marketData,
        indicators,
        timestamp: new Date().toISOString()
      }
    };

    // Publish to Redis pub/sub for horizontal scaling
    await this.redis.publish(
      `market_updates:${marketData.symbol}`,
      JSON.stringify(message)
    );

    // Also broadcast directly to connected WebSocket clients
    for (const userId of subscribers) {
      // This would be handled by the WebSocket service
      this.broadcastToUser(userId, message);
    }
  }

  async subscribeToSymbol(userId: string, symbol: string) {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set());
    }
    this.subscribers.get(symbol)!.add(userId);
    
    // Send current market data immediately
    const currentData = await this.getCurrentMarketData(symbol);
    if (currentData) {
      const indicators = await this.getCurrentIndicators(symbol);
      this.broadcastToUser(userId, {
        type: 'market_update',
        data: { marketData: currentData, indicators }
      });
    }
  }

  async unsubscribeFromSymbol(userId: string, symbol: string) {
    const subscribers = this.subscribers.get(symbol);
    if (subscribers) {
      subscribers.delete(userId);
      if (subscribers.size === 0) {
        this.subscribers.delete(symbol);
      }
    }
  }

  private broadcastToUser(userId: string, message: any) {
    // This would integrate with the WebSocket service
    // For now, we'll just log it
    logger.debug(`Broadcasting to user ${userId}:`, message);
  }
}