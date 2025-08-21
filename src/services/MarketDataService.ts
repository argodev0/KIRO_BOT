/**
 * Market Data Service
 * Handles market data ingestion, processing, and caching
 */

import { EventEmitter } from 'events';
import { createClient, RedisClientType } from 'redis';
import { PrismaClient } from '@prisma/client';
import { ExchangeManager, ExchangeName } from './exchanges/ExchangeManager';
import { DataNormalizer } from './exchanges/DataNormalizer';
import { DataValidator } from './DataValidator';
import { TimeframeAggregator } from './TimeframeAggregator';
import { CandleData, TickerData, OrderBookData, TradeData, Timeframe } from '../types/market';
// import { config } from '../config/config';
import { logger } from '../utils/logger';

export interface MarketDataServiceConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  exchanges: {
    [key in ExchangeName]?: {
      enabled: boolean;
      symbols: string[];
      timeframes: Timeframe[];
    };
  };
  caching: {
    candleTtl: number; // seconds
    tickerTtl: number;
    orderBookTtl: number;
    tradeTtl: number;
  };
  processing: {
    batchSize: number;
    flushInterval: number; // milliseconds
    maxRetries: number;
  };
}

export class MarketDataService extends EventEmitter {
  private redis: RedisClientType;
  private prisma: PrismaClient;
  private exchangeManager: ExchangeManager;
  private dataValidator: DataValidator;
  private timeframeAggregator: TimeframeAggregator;
  private config: MarketDataServiceConfig;
  
  private subscriptions: Map<string, Set<string>> = new Map(); // exchange -> symbols
  private processingQueue: Map<string, any[]> = new Map(); // dataType -> data[]
  private flushTimers: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;

  constructor(
    exchangeManager: ExchangeManager,
    config: MarketDataServiceConfig
  ) {
    super();
    this.exchangeManager = exchangeManager;
    this.config = config;
    
    const redisConfig: any = {
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      database: config.redis.db,
    };
    
    if (config.redis.password) {
      redisConfig.password = config.redis.password;
    }
    
    this.redis = createClient(redisConfig);
    
    this.prisma = new PrismaClient();
    this.dataValidator = new DataValidator();
    this.timeframeAggregator = new TimeframeAggregator();
    
    this.setupEventHandlers();
    this.initializeProcessingQueues();
  }

  /**
   * Start the market data service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('MarketDataService is already running');
      return;
    }

    try {
      // Connect to Redis
      await this.redis.connect();
      
      // Initialize exchange manager
      await this.exchangeManager.initialize();
      
      // Start data subscriptions
      await this.startDataSubscriptions();
      
      // Start processing timers
      this.startProcessingTimers();
      
      this.isRunning = true;
      this.emit('started');
      logger.info('MarketDataService started successfully');
    } catch (error) {
      logger.error('Failed to start MarketDataService:', error);
      throw error;
    }
  }

  /**
   * Stop the market data service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop processing timers
      this.stopProcessingTimers();
      
      // Flush remaining data
      await this.flushAllQueues();
      
      // Shutdown exchange manager
      await this.exchangeManager.shutdown();
      
      // Close connections
      await this.redis.disconnect();
      await this.prisma.$disconnect();
      
      this.isRunning = false;
      this.emit('stopped');
      logger.info('MarketDataService stopped successfully');
    } catch (error) {
      logger.error('Error stopping MarketDataService:', error);
      throw error;
    }
  }

  /**
   * Subscribe to market data for specific symbols
   */
  async subscribeToSymbols(symbols: string[], exchanges?: ExchangeName[]): Promise<void> {
    const targetExchanges = exchanges || this.exchangeManager.getAvailableExchanges();
    
    for (const exchange of targetExchanges) {
      if (!this.config.exchanges[exchange]?.enabled) {
        continue;
      }
      
      const exchangeSymbols = this.subscriptions.get(exchange) || new Set();
      
      for (const symbol of symbols) {
        if (!exchangeSymbols.has(symbol)) {
          await this.subscribeToSymbolData(symbol, exchange);
          exchangeSymbols.add(symbol);
        }
      }
      
      this.subscriptions.set(exchange, exchangeSymbols);
    }
  }

  /**
   * Get historical candle data
   */
  async getHistoricalCandles(
    symbol: string,
    timeframe: Timeframe,
    limit: number = 1000,
    startTime?: number,
    endTime?: number,
    exchange?: ExchangeName
  ): Promise<CandleData[]> {
    try {
      // Try cache first
      const cacheKey = this.getCacheKey('candles', symbol, timeframe, exchange);
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        const data = JSON.parse(cached);
        logger.debug(`Retrieved ${data.length} cached candles for ${symbol} ${timeframe}`);
        return data;
      }
      
      // Fetch from exchange
      const candles = await this.exchangeManager.getCandles(
        symbol,
        timeframe,
        limit,
        startTime,
        endTime,
        exchange
      );
      
      // Validate and normalize data
      const validatedCandles = candles
        .map(candle => DataNormalizer.normalizeCandle(candle, exchange || 'binance', symbol, timeframe))
        .filter(candle => this.dataValidator.validateCandle(candle));
      
      // Cache the data
      await this.redis.setEx(
        cacheKey,
        this.config.caching.candleTtl,
        JSON.stringify(validatedCandles)
      );
      
      // Store in database for historical analysis
      await this.storeHistoricalCandles(validatedCandles);
      
      logger.info(`Fetched ${validatedCandles.length} historical candles for ${symbol} ${timeframe}`);
      return validatedCandles;
    } catch (error) {
      logger.error(`Failed to get historical candles for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get current ticker data
   */
  async getTicker(symbol: string, exchange?: ExchangeName): Promise<TickerData> {
    try {
      const cacheKey = this.getCacheKey('ticker', symbol, undefined, exchange);
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      const ticker = await this.exchangeManager.getTicker(symbol, exchange);
      const normalizedTicker = DataNormalizer.normalizeTicker(ticker, exchange || 'binance');
      
      if (this.dataValidator.validateTicker(normalizedTicker)) {
        await this.redis.setEx(
          cacheKey,
          this.config.caching.tickerTtl,
          JSON.stringify(normalizedTicker)
        );
        
        return normalizedTicker;
      }
      
      throw new Error(`Invalid ticker data for ${symbol}`);
    } catch (error) {
      logger.error(`Failed to get ticker for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get aggregated data across multiple timeframes
   */
  async getMultiTimeframeData(
    symbol: string,
    timeframes: Timeframe[],
    limit: number = 100,
    exchange?: ExchangeName
  ): Promise<Record<Timeframe, CandleData[]>> {
    const results: Partial<Record<Timeframe, CandleData[]>> = {};
    
    const promises = timeframes.map(async (timeframe) => {
      try {
        const candles = await this.getHistoricalCandles(symbol, timeframe, limit, undefined, undefined, exchange);
        results[timeframe] = candles;
      } catch (error) {
        logger.error(`Failed to get ${timeframe} data for ${symbol}:`, error);
        results[timeframe] = [];
      }
    });
    
    await Promise.all(promises);
    return results as Record<Timeframe, CandleData[]>;
  }

  /**
   * Get real-time market data stream
   */
  async getRealtimeData(symbol: string, exchange?: ExchangeName): Promise<{
    ticker: TickerData;
    orderBook: OrderBookData;
    recentTrades: TradeData[];
  }> {
    try {
      const [ticker, orderBook, trades] = await Promise.all([
        this.getTicker(symbol, exchange),
        this.exchangeManager.getOrderBook(symbol, 20, exchange),
        this.exchangeManager.getRecentTrades(symbol, 50, exchange)
      ]);

      return {
        ticker,
        orderBook,
        recentTrades: trades
      };
    } catch (error) {
      logger.error(`Failed to get realtime data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Bulk historical data fetching with progress tracking
   */
  async bulkHistoricalFetch(
    symbols: string[],
    timeframes: Timeframe[],
    startTime: number,
    endTime: number,
    exchange?: ExchangeName,
    onProgress?: (progress: { completed: number; total: number; current: string }) => void
  ): Promise<Record<string, Partial<Record<Timeframe, CandleData[]>>>> {
    const results: Record<string, Partial<Record<Timeframe, CandleData[]>>> = {};
    const total = symbols.length * timeframes.length;
    let completed = 0;

    for (const symbol of symbols) {
      results[symbol] = {};
      
      for (const timeframe of timeframes) {
        try {
          const candles = await this.getHistoricalCandles(
            symbol, 
            timeframe, 
            1000, 
            startTime, 
            endTime, 
            exchange
          );
          
          results[symbol][timeframe] = candles;
          completed++;
          
          if (onProgress) {
            onProgress({ completed, total, current: `${symbol}-${timeframe}` });
          }
          
          // Rate limiting - small delay between requests
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          logger.error(`Failed to fetch ${symbol} ${timeframe}:`, error);
          results[symbol][timeframe] = [];
          completed++;
        }
      }
    }

    return results;
  }

  /**
   * Data quality assessment
   */
  async assessDataQuality(symbol: string, timeframe: Timeframe, exchange?: ExchangeName): Promise<{
    completeness: number;
    consistency: number;
    freshness: number;
    overall: number;
    issues: string[];
  }> {
    try {
      const candles = await this.getHistoricalCandles(symbol, timeframe, 100, undefined, undefined, exchange);
      const issues: string[] = [];
      
      // Completeness check
      const expectedCandles = 100;
      const actualCandles = candles.length;
      const completeness = (actualCandles / expectedCandles) * 100;
      
      if (completeness < 95) {
        issues.push(`Missing ${expectedCandles - actualCandles} candles`);
      }

      // Consistency check (validate sequence)
      const sequenceValidation = this.dataValidator.validateCandleSequence(candles);
      const consistency = sequenceValidation.isValid ? 100 : 
        Math.max(0, 100 - (sequenceValidation.errors.length * 10));
      
      if (!sequenceValidation.isValid) {
        issues.push(...sequenceValidation.errors);
      }

      // Freshness check
      const latestCandle = candles[candles.length - 1];
      const now = Date.now();
      const timeframeMs = this.getTimeframeMs(timeframe);
      const expectedLatestTime = Math.floor(now / timeframeMs) * timeframeMs;
      const freshnessDelay = Math.abs(expectedLatestTime - latestCandle.timestamp);
      const freshness = Math.max(0, 100 - (freshnessDelay / timeframeMs) * 100);
      
      if (freshness < 90) {
        issues.push(`Data is ${Math.round(freshnessDelay / 1000)}s behind expected`);
      }

      // Overall score
      const overall = (completeness + consistency + freshness) / 3;

      return {
        completeness: Math.round(completeness * 100) / 100,
        consistency: Math.round(consistency * 100) / 100,
        freshness: Math.round(freshness * 100) / 100,
        overall: Math.round(overall * 100) / 100,
        issues
      };
    } catch (error) {
      logger.error(`Failed to assess data quality for ${symbol}:`, error);
      return {
        completeness: 0,
        consistency: 0,
        freshness: 0,
        overall: 0,
        issues: [`Failed to assess: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  // Private methods
  private setupEventHandlers(): void {
    // Handle exchange data events
    this.exchangeManager.on('ticker', ({ exchange, data }) => {
      this.processTickerData(data, exchange);
    });
    
    this.exchangeManager.on('candle', ({ exchange, data }) => {
      this.processCandleData(data, exchange);
    });
    
    this.exchangeManager.on('orderbook', ({ exchange, data }) => {
      this.processOrderBookData(data, exchange);
    });
    
    this.exchangeManager.on('trade', ({ exchange, data }) => {
      this.processTradeData(data, exchange);
    });
    
    // Handle exchange connection events
    this.exchangeManager.on('exchangeConnected', (exchange) => {
      logger.info(`Exchange ${exchange} connected`);
      this.emit('exchangeConnected', exchange);
    });
    
    this.exchangeManager.on('exchangeDisconnected', (exchange) => {
      logger.warn(`Exchange ${exchange} disconnected`);
      this.emit('exchangeDisconnected', exchange);
    });
    
    this.exchangeManager.on('exchangeError', ({ exchange, error }) => {
      logger.error(`Exchange ${exchange} error:`, error);
      this.emit('exchangeError', { exchange, error });
    });
  }

  private initializeProcessingQueues(): void {
    this.processingQueue.set('candles', []);
    this.processingQueue.set('tickers', []);
    this.processingQueue.set('orderbooks', []);
    this.processingQueue.set('trades', []);
  }

  private async startDataSubscriptions(): Promise<void> {
    for (const [exchange, config] of Object.entries(this.config.exchanges)) {
      if (!config.enabled) continue;
      
      for (const symbol of config.symbols) {
        await this.subscribeToSymbolData(symbol, exchange as ExchangeName);
      }
    }
  }

  private async subscribeToSymbolData(symbol: string, exchange: ExchangeName): Promise<void> {
    try {
      // Subscribe to ticker updates
      await this.exchangeManager.subscribeToTicker(symbol, exchange);
      
      // Subscribe to candle updates for configured timeframes
      const timeframes = this.config.exchanges[exchange]?.timeframes || ['1m', '5m', '15m', '1h'];
      for (const timeframe of timeframes) {
        await this.exchangeManager.subscribeToCandles(symbol, timeframe, exchange);
      }
      
      // Subscribe to order book updates
      await this.exchangeManager.subscribeToOrderBook(symbol, exchange);
      
      // Subscribe to trade updates
      await this.exchangeManager.subscribeToTrades(symbol, exchange);
      
      logger.info(`Subscribed to ${symbol} data on ${exchange}`);
    } catch (error) {
      logger.error(`Failed to subscribe to ${symbol} on ${exchange}:`, error);
    }
  }

  private processTickerData(data: TickerData, exchange: ExchangeName): void {
    try {
      const normalizedData = DataNormalizer.normalizeTicker(data, exchange);
      
      if (this.dataValidator.validateTicker(normalizedData)) {
        // Add to processing queue
        this.processingQueue.get('tickers')?.push(normalizedData);
        
        // Cache immediately for real-time access
        const cacheKey = this.getCacheKey('ticker', normalizedData.symbol, undefined, exchange);
        this.redis.setEx(cacheKey, this.config.caching.tickerTtl, JSON.stringify(normalizedData));
        
        // Emit for real-time consumers
        this.emit('ticker', normalizedData);
      }
    } catch (error) {
      logger.error('Error processing ticker data:', error);
    }
  }

  private processCandleData(data: CandleData, exchange: ExchangeName): void {
    try {
      const normalizedData = DataNormalizer.normalizeCandle(data, exchange, data.symbol, data.timeframe as Timeframe);
      
      if (this.dataValidator.validateCandle(normalizedData)) {
        // Add to processing queue
        this.processingQueue.get('candles')?.push(normalizedData);
        
        // Generate aggregated timeframes
        this.timeframeAggregator.processCandle(normalizedData);
        
        // Cache for quick access
        const cacheKey = this.getCacheKey('candles', normalizedData.symbol, normalizedData.timeframe, exchange);
        this.redis.setEx(cacheKey, this.config.caching.candleTtl, JSON.stringify([normalizedData]));
        
        // Emit for real-time consumers
        this.emit('candle', normalizedData);
      }
    } catch (error) {
      logger.error('Error processing candle data:', error);
    }
  }

  private processOrderBookData(data: OrderBookData, exchange: ExchangeName): void {
    try {
      const normalizedData = DataNormalizer.normalizeOrderBook(data, exchange, data.symbol);
      
      if (this.dataValidator.validateOrderBook(normalizedData)) {
        // Add to processing queue
        this.processingQueue.get('orderbooks')?.push(normalizedData);
        
        // Cache for quick access
        const cacheKey = this.getCacheKey('orderbook', normalizedData.symbol, undefined, exchange);
        this.redis.setEx(cacheKey, this.config.caching.orderBookTtl, JSON.stringify(normalizedData));
        
        // Emit for real-time consumers
        this.emit('orderbook', normalizedData);
      }
    } catch (error) {
      logger.error('Error processing order book data:', error);
    }
  }

  private processTradeData(data: TradeData, exchange: ExchangeName): void {
    try {
      const normalizedData = DataNormalizer.normalizeTrade(data, exchange, data.symbol);
      
      if (this.dataValidator.validateTrade(normalizedData)) {
        // Add to processing queue
        this.processingQueue.get('trades')?.push(normalizedData);
        
        // Emit for real-time consumers
        this.emit('trade', normalizedData);
      }
    } catch (error) {
      logger.error('Error processing trade data:', error);
    }
  }

  private startProcessingTimers(): void {
    // Start flush timers for each data type
    for (const dataType of this.processingQueue.keys()) {
      const timer = setInterval(() => {
        this.flushQueue(dataType);
      }, this.config.processing.flushInterval);
      
      this.flushTimers.set(dataType, timer);
    }
  }

  private stopProcessingTimers(): void {
    for (const timer of this.flushTimers.values()) {
      clearInterval(timer);
    }
    this.flushTimers.clear();
  }

  private async flushQueue(dataType: string): Promise<void> {
    const queue = this.processingQueue.get(dataType);
    if (!queue || queue.length === 0) return;
    
    const batch = queue.splice(0, this.config.processing.batchSize);
    
    try {
      switch (dataType) {
        case 'candles':
          await this.storeHistoricalCandles(batch);
          break;
        // Add other data type storage as needed
      }
      
      logger.debug(`Flushed ${batch.length} ${dataType} records to database`);
    } catch (error) {
      logger.error(`Failed to flush ${dataType} queue:`, error);
      // Re-add failed items to queue for retry
      queue.unshift(...batch);
    }
  }

  private async flushAllQueues(): Promise<void> {
    const promises = Array.from(this.processingQueue.keys()).map(dataType => 
      this.flushQueue(dataType)
    );
    
    await Promise.all(promises);
  }

  private async storeHistoricalCandles(candles: CandleData[]): Promise<void> {
    if (candles.length === 0) return;
    
    try {
      const data = candles.map(candle => ({
        symbol: candle.symbol,
        exchange: candle.exchange || 'unknown',
        timeframe: candle.timeframe,
        timestamp: new Date(candle.timestamp),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      }));
      
      await this.prisma.marketData.createMany({
        data,
        skipDuplicates: true,
      });
    } catch (error) {
      logger.error('Failed to store historical candles:', error);
      throw error;
    }
  }

  private getCacheKey(type: string, symbol: string, timeframe?: string, exchange?: ExchangeName): string {
    const parts = ['market', type, symbol];
    if (timeframe) parts.push(timeframe);
    if (exchange) parts.push(exchange);
    return parts.join(':');
  }

  private getTimeframeMs(timeframe: Timeframe): number {
    const timeframeMap: Record<Timeframe, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000,
    };
    return timeframeMap[timeframe] || 60 * 1000;
  }
}