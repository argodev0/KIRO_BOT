/**
 * Market Data Cache Service
 * Implements Redis caching for high-frequency market data with aggregation,
 * invalidation mechanisms, and historical persistence
 */

import { EventEmitter } from 'events';
import { createClient, RedisClientType } from 'redis';
import { PrismaClient } from '@prisma/client';
import { CandleData, TickerData, OrderBookData, TradeData, Timeframe } from '../types/market';
import { logger } from '../utils/logger';

export interface CacheConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix?: string;
  };
  ttl: {
    ticker: number;        // seconds
    candle: number;        // seconds
    orderbook: number;     // seconds
    trade: number;         // seconds
    aggregated: number;    // seconds
    historical: number;    // seconds
  };
  aggregation: {
    enabled: boolean;
    timeframes: Timeframe[];
    batchSize: number;
    flushInterval: number; // milliseconds
  };
  persistence: {
    enabled: boolean;
    batchSize: number;
    flushInterval: number; // milliseconds
    retentionDays: number;
  };
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage: number;
  connections: number;
  operations: {
    gets: number;
    sets: number;
    deletes: number;
    flushes: number;
  };
}

export interface AggregatedData {
  symbol: string;
  timeframes: Record<Timeframe, CandleData[]>;
  lastUpdate: number;
  dataQuality: {
    completeness: number;
    consistency: number;
    freshness: number;
  };
}

export class MarketDataCacheService extends EventEmitter {
  private redis: RedisClientType;
  private prisma: PrismaClient;
  private config: CacheConfig;
  private isRunning: boolean = false;
  
  // Cache statistics
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalKeys: 0,
    memoryUsage: 0,
    connections: 0,
    operations: {
      gets: 0,
      sets: 0,
      deletes: 0,
      flushes: 0
    }
  };

  // Data queues for batch processing
  private persistenceQueue: Map<string, any[]> = new Map();
  private aggregationQueue: Map<string, CandleData[]> = new Map();
  
  // Timers for batch processing
  private persistenceTimer?: NodeJS.Timeout;
  private aggregationTimer?: NodeJS.Timeout;
  private statsTimer?: NodeJS.Timeout;

  constructor(config: CacheConfig) {
    super();
    this.config = config;
    
    // Initialize Redis client
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
    
    this.setupEventHandlers();
    this.initializeQueues();
  }

  /**
   * Start the cache service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('MarketDataCacheService is already running');
      return;
    }

    try {
      logger.info('🚀 Starting Market Data Cache Service...');
      
      // Connect to Redis
      await this.redis.connect();
      
      // Start batch processing timers
      this.startBatchProcessing();
      
      // Start statistics collection
      this.startStatsCollection();
      
      this.isRunning = true;
      this.emit('started');
      
      logger.info('✅ Market Data Cache Service started successfully');
    } catch (error) {
      logger.error('❌ Failed to start MarketDataCacheService:', error);
      throw error;
    }
  }

  /**
   * Stop the cache service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info('🛑 Stopping Market Data Cache Service...');
      
      // Stop timers
      this.stopBatchProcessing();
      this.stopStatsCollection();
      
      // Flush remaining data
      await this.flushAllQueues();
      
      // Close connections
      await this.redis.disconnect();
      await this.prisma.$disconnect();
      
      this.isRunning = false;
      this.emit('stopped');
      
      logger.info('✅ Market Data Cache Service stopped');
    } catch (error) {
      logger.error('❌ Error stopping MarketDataCacheService:', error);
      throw error;
    }
  }

  /**
   * Cache ticker data
   */
  async cacheTicker(ticker: TickerData): Promise<void> {
    try {
      const key = this.getKey('ticker', ticker.symbol, ticker.exchange);
      const value = JSON.stringify(ticker);
      
      await this.redis.setEx(key, this.config.ttl.ticker, value);
      this.stats.operations.sets++;
      
      // Add to persistence queue if enabled
      if (this.config.persistence.enabled) {
        this.addToPersistenceQueue('tickers', ticker);
      }
      
      this.emit('cached', { type: 'ticker', symbol: ticker.symbol, exchange: ticker.exchange });
    } catch (error) {
      logger.error('Failed to cache ticker data:', error);
      throw error;
    }
  }

  /**
   * Get cached ticker data
   */
  async getTicker(symbol: string, exchange?: string): Promise<TickerData | null> {
    try {
      const key = this.getKey('ticker', symbol, exchange);
      const cached = await this.redis.get(key);
      this.stats.operations.gets++;
      
      if (cached) {
        this.stats.hits++;
        return JSON.parse(cached);
      }
      
      this.stats.misses++;
      return null;
    } catch (error) {
      logger.error('Failed to get cached ticker:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Cache candle data
   */
  async cacheCandle(candle: CandleData): Promise<void> {
    try {
      const key = this.getKey('candle', candle.symbol, candle.exchange, candle.timeframe);
      const value = JSON.stringify(candle);
      
      await this.redis.setEx(key, this.config.ttl.candle, value);
      this.stats.operations.sets++;
      
      // Add to aggregation queue if enabled
      if (this.config.aggregation.enabled) {
        this.addToAggregationQueue(candle);
      }
      
      // Add to persistence queue if enabled
      if (this.config.persistence.enabled) {
        this.addToPersistenceQueue('candles', candle);
      }
      
      this.emit('cached', { 
        type: 'candle', 
        symbol: candle.symbol, 
        exchange: candle.exchange,
        timeframe: candle.timeframe 
      });
    } catch (error) {
      logger.error('Failed to cache candle data:', error);
      throw error;
    }
  }

  /**
   * Get cached candle data
   */
  async getCandle(symbol: string, timeframe: Timeframe, exchange?: string): Promise<CandleData | null> {
    try {
      const key = this.getKey('candle', symbol, exchange, timeframe);
      const cached = await this.redis.get(key);
      this.stats.operations.gets++;
      
      if (cached) {
        this.stats.hits++;
        return JSON.parse(cached);
      }
      
      this.stats.misses++;
      return null;
    } catch (error) {
      logger.error('Failed to get cached candle:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Cache multiple candles for a symbol/timeframe
   */
  async cacheCandleHistory(symbol: string, timeframe: Timeframe, candles: CandleData[], exchange?: string): Promise<void> {
    try {
      const key = this.getKey('history', symbol, exchange, timeframe);
      const value = JSON.stringify(candles);
      
      await this.redis.setEx(key, this.config.ttl.historical, value);
      this.stats.operations.sets++;
      
      // Cache individual candles as well
      const cachePromises = candles.map(candle => this.cacheCandle(candle));
      await Promise.all(cachePromises);
      
      this.emit('cached', { 
        type: 'history', 
        symbol, 
        exchange,
        timeframe,
        count: candles.length 
      });
    } catch (error) {
      logger.error('Failed to cache candle history:', error);
      throw error;
    }
  }

  /**
   * Get cached candle history
   */
  async getCandleHistory(symbol: string, timeframe: Timeframe, exchange?: string): Promise<CandleData[] | null> {
    try {
      const key = this.getKey('history', symbol, exchange, timeframe);
      const cached = await this.redis.get(key);
      this.stats.operations.gets++;
      
      if (cached) {
        this.stats.hits++;
        return JSON.parse(cached);
      }
      
      this.stats.misses++;
      return null;
    } catch (error) {
      logger.error('Failed to get cached candle history:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Cache order book data
   */
  async cacheOrderBook(orderbook: OrderBookData): Promise<void> {
    try {
      const key = this.getKey('orderbook', orderbook.symbol, orderbook.exchange);
      const value = JSON.stringify(orderbook);
      
      await this.redis.setEx(key, this.config.ttl.orderbook, value);
      this.stats.operations.sets++;
      
      this.emit('cached', { 
        type: 'orderbook', 
        symbol: orderbook.symbol, 
        exchange: orderbook.exchange 
      });
    } catch (error) {
      logger.error('Failed to cache orderbook data:', error);
      throw error;
    }
  }

  /**
   * Get cached order book data
   */
  async getOrderBook(symbol: string, exchange?: string): Promise<OrderBookData | null> {
    try {
      const key = this.getKey('orderbook', symbol, exchange);
      const cached = await this.redis.get(key);
      this.stats.operations.gets++;
      
      if (cached) {
        this.stats.hits++;
        return JSON.parse(cached);
      }
      
      this.stats.misses++;
      return null;
    } catch (error) {
      logger.error('Failed to get cached orderbook:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Cache aggregated multi-timeframe data
   */
  async cacheAggregatedData(symbol: string, data: AggregatedData, exchange?: string): Promise<void> {
    try {
      const key = this.getKey('aggregated', symbol, exchange);
      const value = JSON.stringify(data);
      
      await this.redis.setEx(key, this.config.ttl.aggregated, value);
      this.stats.operations.sets++;
      
      this.emit('cached', { 
        type: 'aggregated', 
        symbol, 
        exchange,
        timeframes: Object.keys(data.timeframes).length 
      });
    } catch (error) {
      logger.error('Failed to cache aggregated data:', error);
      throw error;
    }
  }

  /**
   * Get cached aggregated data
   */
  async getAggregatedData(symbol: string, exchange?: string): Promise<AggregatedData | null> {
    try {
      const key = this.getKey('aggregated', symbol, exchange);
      const cached = await this.redis.get(key);
      this.stats.operations.gets++;
      
      if (cached) {
        this.stats.hits++;
        return JSON.parse(cached);
      }
      
      this.stats.misses++;
      return null;
    } catch (error) {
      logger.error('Failed to get cached aggregated data:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Invalidate cache for a symbol
   */
  async invalidateSymbol(symbol: string, exchange?: string): Promise<void> {
    try {
      const pattern = this.getKey('*', symbol, exchange);
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(keys);
        this.stats.operations.deletes += keys.length;
        
        logger.info(`Invalidated ${keys.length} cache keys for ${symbol}${exchange ? ` on ${exchange}` : ''}`);
        this.emit('invalidated', { symbol, exchange, keysRemoved: keys.length });
      }
    } catch (error) {
      logger.error('Failed to invalidate symbol cache:', error);
      throw error;
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string): Promise<void> {
    try {
      const fullPattern = `${this.config.redis.keyPrefix || 'market'}:${pattern}`;
      const keys = await this.redis.keys(fullPattern);
      
      if (keys.length > 0) {
        await this.redis.del(keys);
        this.stats.operations.deletes += keys.length;
        
        logger.info(`Invalidated ${keys.length} cache keys matching pattern: ${pattern}`);
        this.emit('invalidated', { pattern, keysRemoved: keys.length });
      }
    } catch (error) {
      logger.error('Failed to invalidate cache by pattern:', error);
      throw error;
    }
  }

  /**
   * Refresh cache for expired data
   */
  async refreshExpiredData(): Promise<void> {
    try {
      // This would typically be called by a scheduler
      // Implementation would check for expired keys and refresh them
      logger.info('Refreshing expired cache data...');
      
      // Get all keys that are about to expire (within 10% of TTL)
      const allKeys = await this.redis.keys(`${this.config.redis.keyPrefix || 'market'}:*`);
      const expiringSoon: string[] = [];
      
      for (const key of allKeys) {
        const ttl = await this.redis.ttl(key);
        const keyType = this.getKeyType(key);
        const maxTtl = this.config.ttl[keyType as keyof typeof this.config.ttl] || 300;
        
        if (ttl > 0 && ttl < maxTtl * 0.1) {
          expiringSoon.push(key);
        }
      }
      
      if (expiringSoon.length > 0) {
        logger.info(`Found ${expiringSoon.length} keys expiring soon`);
        this.emit('refreshNeeded', { keys: expiringSoon });
      }
    } catch (error) {
      logger.error('Failed to refresh expired data:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    this.stats.hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
      : 0;
    
    return { ...this.stats };
  }

  /**
   * Clear all cache data
   */
  async clearCache(): Promise<void> {
    try {
      const pattern = `${this.config.redis.keyPrefix || 'market'}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(keys);
        this.stats.operations.deletes += keys.length;
        
        logger.info(`Cleared ${keys.length} cache keys`);
        this.emit('cleared', { keysRemoved: keys.length });
      }
    } catch (error) {
      logger.error('Failed to clear cache:', error);
      throw error;
    }
  }

  // Private methods

  private setupEventHandlers(): void {
    this.redis.on('error', (error) => {
      logger.error('Redis error:', error);
      this.emit('error', error);
    });

    this.redis.on('connect', () => {
      logger.info('Redis connected');
      this.emit('connected');
    });

    this.redis.on('disconnect', () => {
      logger.warn('Redis disconnected');
      this.emit('disconnected');
    });
  }

  private initializeQueues(): void {
    this.persistenceQueue.set('tickers', []);
    this.persistenceQueue.set('candles', []);
    this.persistenceQueue.set('orderbooks', []);
    this.persistenceQueue.set('trades', []);
    
    // Initialize aggregation queues for each timeframe
    for (const timeframe of this.config.aggregation.timeframes) {
      this.aggregationQueue.set(timeframe, []);
    }
  }

  private startBatchProcessing(): void {
    if (this.config.persistence.enabled) {
      this.persistenceTimer = setInterval(() => {
        this.flushPersistenceQueues();
      }, this.config.persistence.flushInterval);
    }

    if (this.config.aggregation.enabled) {
      this.aggregationTimer = setInterval(() => {
        this.processAggregationQueues();
      }, this.config.aggregation.flushInterval);
    }
  }

  private stopBatchProcessing(): void {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
      this.persistenceTimer = undefined;
    }

    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = undefined;
    }
  }

  private startStatsCollection(): void {
    this.statsTimer = setInterval(async () => {
      await this.updateStats();
    }, 30000); // Update every 30 seconds
  }

  private stopStatsCollection(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = undefined;
    }
  }

  private async updateStats(): Promise<void> {
    try {
      // Get Redis info
      const info = await this.redis.info('memory');
      const memoryMatch = info.match(/used_memory:(\d+)/);
      if (memoryMatch) {
        this.stats.memoryUsage = parseInt(memoryMatch[1]);
      }

      // Count total keys
      const keys = await this.redis.keys(`${this.config.redis.keyPrefix || 'market'}:*`);
      this.stats.totalKeys = keys.length;
      
      // Update connections (simplified)
      this.stats.connections = 1; // Single connection for now
      
      this.emit('statsUpdated', this.stats);
    } catch (error) {
      logger.error('Failed to update cache stats:', error);
    }
  }

  private addToPersistenceQueue(type: string, data: any): void {
    const queue = this.persistenceQueue.get(type);
    if (queue) {
      queue.push(data);
      
      // Flush if queue is full
      if (queue.length >= this.config.persistence.batchSize) {
        this.flushPersistenceQueue(type);
      }
    }
  }

  private addToAggregationQueue(candle: CandleData): void {
    const queue = this.aggregationQueue.get(candle.timeframe);
    if (queue) {
      queue.push(candle);
      
      // Process if queue is full
      if (queue.length >= this.config.aggregation.batchSize) {
        this.processAggregationQueue(candle.timeframe);
      }
    }
  }

  private async flushPersistenceQueues(): Promise<void> {
    for (const type of this.persistenceQueue.keys()) {
      await this.flushPersistenceQueue(type);
    }
  }

  private async flushPersistenceQueue(type: string): Promise<void> {
    const queue = this.persistenceQueue.get(type);
    if (!queue || queue.length === 0) return;

    const batch = queue.splice(0, this.config.persistence.batchSize);
    
    try {
      switch (type) {
        case 'candles':
          await this.persistCandles(batch);
          break;
        case 'tickers':
          await this.persistTickers(batch);
          break;
        // Add other types as needed
      }
      
      this.stats.operations.flushes++;
      logger.debug(`Persisted ${batch.length} ${type} records`);
    } catch (error) {
      logger.error(`Failed to persist ${type} batch:`, error);
      // Re-add failed items to queue for retry
      queue.unshift(...batch);
    }
  }

  private async processAggregationQueues(): Promise<void> {
    for (const timeframe of this.aggregationQueue.keys()) {
      await this.processAggregationQueue(timeframe);
    }
  }

  private async processAggregationQueue(timeframe: string): Promise<void> {
    const queue = this.aggregationQueue.get(timeframe);
    if (!queue || queue.length === 0) return;

    const batch = queue.splice(0, this.config.aggregation.batchSize);
    
    try {
      // Group by symbol
      const symbolGroups = new Map<string, CandleData[]>();
      
      for (const candle of batch) {
        const key = `${candle.symbol}:${candle.exchange || 'default'}`;
        if (!symbolGroups.has(key)) {
          symbolGroups.set(key, []);
        }
        symbolGroups.get(key)!.push(candle);
      }
      
      // Process each symbol group
      for (const [symbolKey, candles] of symbolGroups) {
        const [symbol, exchange] = symbolKey.split(':');
        await this.processSymbolAggregation(symbol, exchange, candles);
      }
      
      logger.debug(`Processed aggregation for ${batch.length} candles in ${timeframe}`);
    } catch (error) {
      logger.error(`Failed to process aggregation queue for ${timeframe}:`, error);
      // Re-add failed items to queue for retry
      queue.unshift(...batch);
    }
  }

  private async processSymbolAggregation(symbol: string, exchange: string, candles: CandleData[]): Promise<void> {
    try {
      // Get existing aggregated data or create new
      let aggregated = await this.getAggregatedData(symbol, exchange);
      
      if (!aggregated) {
        aggregated = {
          symbol,
          timeframes: {} as Record<Timeframe, CandleData[]>,
          lastUpdate: Date.now(),
          dataQuality: {
            completeness: 0,
            consistency: 0,
            freshness: 0
          }
        };
      }
      
      // Update timeframes with new candles
      for (const candle of candles) {
        if (!aggregated.timeframes[candle.timeframe]) {
          aggregated.timeframes[candle.timeframe] = [];
        }
        
        // Add candle and keep only recent ones (e.g., last 1000)
        aggregated.timeframes[candle.timeframe].push(candle);
        aggregated.timeframes[candle.timeframe] = aggregated.timeframes[candle.timeframe]
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 1000);
      }
      
      // Update metadata
      aggregated.lastUpdate = Date.now();
      aggregated.dataQuality = this.calculateDataQuality(aggregated);
      
      // Cache the updated aggregated data
      await this.cacheAggregatedData(symbol, aggregated, exchange);
      
      this.emit('aggregated', { symbol, exchange, timeframes: Object.keys(aggregated.timeframes) });
    } catch (error) {
      logger.error(`Failed to process symbol aggregation for ${symbol}:`, error);
      throw error;
    }
  }

  private calculateDataQuality(data: AggregatedData): { completeness: number; consistency: number; freshness: number } {
    // Simplified data quality calculation
    const now = Date.now();
    const timeframes = Object.keys(data.timeframes);
    
    let totalCompleteness = 0;
    let totalConsistency = 0;
    let totalFreshness = 0;
    
    for (const timeframe of timeframes) {
      const candles = data.timeframes[timeframe as Timeframe];
      if (candles.length === 0) continue;
      
      // Completeness: ratio of actual vs expected candles
      const completeness = Math.min(100, (candles.length / 100) * 100);
      
      // Consistency: check for gaps in timestamps
      let consistency = 100;
      for (let i = 1; i < candles.length; i++) {
        const expectedGap = this.getTimeframeMs(timeframe as Timeframe);
        const actualGap = candles[i-1].timestamp - candles[i].timestamp;
        if (Math.abs(actualGap - expectedGap) > expectedGap * 0.1) {
          consistency -= 5; // Penalize gaps
        }
      }
      consistency = Math.max(0, consistency);
      
      // Freshness: how recent is the latest data
      const latestCandle = candles[0];
      const age = now - latestCandle.timestamp;
      const maxAge = this.getTimeframeMs(timeframe as Timeframe) * 2; // Allow 2 periods
      const freshness = Math.max(0, 100 - (age / maxAge) * 100);
      
      totalCompleteness += completeness;
      totalConsistency += consistency;
      totalFreshness += freshness;
    }
    
    const count = timeframes.length || 1;
    return {
      completeness: Math.round(totalCompleteness / count),
      consistency: Math.round(totalConsistency / count),
      freshness: Math.round(totalFreshness / count)
    };
  }

  private async persistCandles(candles: CandleData[]): Promise<void> {
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
      logger.error('Failed to persist candles:', error);
      throw error;
    }
  }

  private async persistTickers(tickers: TickerData[]): Promise<void> {
    // Implementation for persisting ticker data
    // This would depend on your database schema
    logger.debug(`Would persist ${tickers.length} tickers to database`);
  }

  private async flushAllQueues(): Promise<void> {
    await this.flushPersistenceQueues();
    await this.processAggregationQueues();
  }

  private getKey(type: string, symbol: string, exchange?: string, timeframe?: string): string {
    const prefix = this.config.redis.keyPrefix || 'market';
    const parts = [prefix, type, symbol];
    
    if (exchange) parts.push(exchange);
    if (timeframe) parts.push(timeframe);
    
    return parts.join(':');
  }

  private getKeyType(key: string): string {
    const parts = key.split(':');
    return parts[1] || 'unknown';
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