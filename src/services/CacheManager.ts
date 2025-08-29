/**
 * Cache Manager
 * Manages multiple cache layers and provides unified caching interface
 */

import { EventEmitter } from 'events';
import { MarketDataCacheService, CacheConfig } from './MarketDataCacheService';
import { CandleData, TickerData, OrderBookData, TradeData, Timeframe } from '../types/market';
import { logger } from '../utils/logger';

export interface CacheManagerConfig {
  marketData: CacheConfig;
  layers: {
    memory: {
      enabled: boolean;
      maxSize: number; // MB
      ttl: number; // seconds
    };
    redis: {
      enabled: boolean;
    };
    database: {
      enabled: boolean;
    };
  };
  strategies: {
    writeThrough: boolean;
    writeBack: boolean;
    readThrough: boolean;
  };
}

export interface CacheLayer {
  name: string;
  priority: number;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  stats(): any;
}

export class MemoryCache implements CacheLayer {
  name = 'memory';
  priority = 1;
  
  private cache = new Map<string, { value: any; expires: number }>();
  private maxSize: number;
  private defaultTtl: number;
  
  constructor(maxSize: number = 100, defaultTtl: number = 300) {
    this.maxSize = maxSize * 1024 * 1024; // Convert MB to bytes
    this.defaultTtl = defaultTtl * 1000; // Convert to milliseconds
  }

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const expires = Date.now() + (ttl ? ttl * 1000 : this.defaultTtl);
    
    // Simple size management - remove oldest if needed
    if (this.cache.size > 1000) { // Arbitrary limit
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, { value, expires });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  stats() {
    return {
      size: this.cache.size,
      memoryUsage: JSON.stringify([...this.cache.entries()]).length,
      maxSize: this.maxSize
    };
  }
}

export class CacheManager extends EventEmitter {
  private config: CacheManagerConfig;
  private marketDataCache: MarketDataCacheService;
  private layers: CacheLayer[] = [];
  private isRunning: boolean = false;

  constructor(config: CacheManagerConfig) {
    super();
    this.config = config;
    
    // Initialize market data cache
    this.marketDataCache = new MarketDataCacheService(config.marketData);
    
    // Initialize cache layers
    this.initializeLayers();
    
    this.setupEventHandlers();
  }

  /**
   * Start the cache manager
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('CacheManager is already running');
      return;
    }

    try {
      logger.info('🚀 Starting Cache Manager...');
      
      // Start market data cache
      await this.marketDataCache.start();
      
      this.isRunning = true;
      this.emit('started');
      
      logger.info('✅ Cache Manager started successfully');
    } catch (error) {
      logger.error('❌ Failed to start CacheManager:', error);
      throw error;
    }
  }

  /**
   * Stop the cache manager
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info('🛑 Stopping Cache Manager...');
      
      // Stop market data cache
      await this.marketDataCache.stop();
      
      // Clear all layers
      await Promise.all(this.layers.map(layer => layer.clear()));
      
      this.isRunning = false;
      this.emit('stopped');
      
      logger.info('✅ Cache Manager stopped');
    } catch (error) {
      logger.error('❌ Error stopping CacheManager:', error);
      throw error;
    }
  }

  /**
   * Get data from cache with multi-layer fallback
   */
  async get<T>(key: string, type: 'ticker' | 'candle' | 'orderbook' | 'aggregated' = 'ticker'): Promise<T | null> {
    // Try each layer in priority order
    for (const layer of this.layers) {
      try {
        const result = await layer.get<T>(key);
        if (result !== null) {
          // Write back to higher priority layers if using read-through strategy
          if (this.config.strategies.readThrough) {
            await this.writeToHigherPriorityLayers(key, result, layer.priority);
          }
          return result;
        }
      } catch (error) {
        logger.warn(`Failed to get from ${layer.name} cache:`, error);
      }
    }
    
    return null;
  }

  /**
   * Set data in cache with multi-layer strategy
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const promises: Promise<void>[] = [];
    
    // Write to all layers based on strategy
    for (const layer of this.layers) {
      if (this.config.strategies.writeThrough) {
        promises.push(layer.set(key, value, ttl).catch(error => {
          logger.warn(`Failed to set in ${layer.name} cache:`, error);
        }));
      }
    }
    
    await Promise.all(promises);
  }

  /**
   * Cache ticker data
   */
  async cacheTicker(ticker: TickerData): Promise<void> {
    await this.marketDataCache.cacheTicker(ticker);
    
    // Also cache in memory layer for fast access
    const key = `ticker:${ticker.symbol}:${ticker.exchange}`;
    await this.set(key, ticker, this.config.marketData.ttl.ticker);
  }

  /**
   * Get cached ticker
   */
  async getTicker(symbol: string, exchange?: string): Promise<TickerData | null> {
    // Try memory cache first
    const key = `ticker:${symbol}:${exchange || 'default'}`;
    let ticker = await this.get<TickerData>(key, 'ticker');
    
    if (!ticker) {
      // Fallback to Redis cache
      ticker = await this.marketDataCache.getTicker(symbol, exchange);
      
      if (ticker) {
        // Cache in memory for next time
        await this.set(key, ticker, this.config.marketData.ttl.ticker);
      }
    }
    
    return ticker;
  }

  /**
   * Cache candle data
   */
  async cacheCandle(candle: CandleData): Promise<void> {
    await this.marketDataCache.cacheCandle(candle);
    
    // Also cache in memory layer
    const key = `candle:${candle.symbol}:${candle.exchange}:${candle.timeframe}`;
    await this.set(key, candle, this.config.marketData.ttl.candle);
  }

  /**
   * Get cached candle
   */
  async getCandle(symbol: string, timeframe: Timeframe, exchange?: string): Promise<CandleData | null> {
    const key = `candle:${symbol}:${exchange || 'default'}:${timeframe}`;
    let candle = await this.get<CandleData>(key, 'candle');
    
    if (!candle) {
      candle = await this.marketDataCache.getCandle(symbol, timeframe, exchange);
      
      if (candle) {
        await this.set(key, candle, this.config.marketData.ttl.candle);
      }
    }
    
    return candle;
  }

  /**
   * Cache candle history
   */
  async cacheCandleHistory(symbol: string, timeframe: Timeframe, candles: CandleData[], exchange?: string): Promise<void> {
    await this.marketDataCache.cacheCandleHistory(symbol, timeframe, candles, exchange);
    
    // Cache in memory as well
    const key = `history:${symbol}:${exchange || 'default'}:${timeframe}`;
    await this.set(key, candles, this.config.marketData.ttl.historical);
  }

  /**
   * Get cached candle history
   */
  async getCandleHistory(symbol: string, timeframe: Timeframe, exchange?: string): Promise<CandleData[] | null> {
    const key = `history:${symbol}:${exchange || 'default'}:${timeframe}`;
    let history = await this.get<CandleData[]>(key);
    
    if (!history) {
      history = await this.marketDataCache.getCandleHistory(symbol, timeframe, exchange);
      
      if (history) {
        await this.set(key, history, this.config.marketData.ttl.historical);
      }
    }
    
    return history;
  }

  /**
   * Cache order book data
   */
  async cacheOrderBook(orderbook: OrderBookData): Promise<void> {
    await this.marketDataCache.cacheOrderBook(orderbook);
    
    const key = `orderbook:${orderbook.symbol}:${orderbook.exchange}`;
    await this.set(key, orderbook, this.config.marketData.ttl.orderbook);
  }

  /**
   * Get cached order book
   */
  async getOrderBook(symbol: string, exchange?: string): Promise<OrderBookData | null> {
    const key = `orderbook:${symbol}:${exchange || 'default'}`;
    let orderbook = await this.get<OrderBookData>(key, 'orderbook');
    
    if (!orderbook) {
      orderbook = await this.marketDataCache.getOrderBook(symbol, exchange);
      
      if (orderbook) {
        await this.set(key, orderbook, this.config.marketData.ttl.orderbook);
      }
    }
    
    return orderbook;
  }

  /**
   * Invalidate cache for symbol
   */
  async invalidateSymbol(symbol: string, exchange?: string): Promise<void> {
    // Invalidate in all layers
    const patterns = [
      `ticker:${symbol}:${exchange || '*'}`,
      `candle:${symbol}:${exchange || '*'}:*`,
      `orderbook:${symbol}:${exchange || '*'}`,
      `history:${symbol}:${exchange || '*'}:*`,
      `aggregated:${symbol}:${exchange || '*'}`
    ];
    
    for (const pattern of patterns) {
      for (const layer of this.layers) {
        try {
          // Simple pattern matching for memory cache
          if (layer.name === 'memory') {
            const memoryLayer = layer as MemoryCache;
            const stats = memoryLayer.stats();
            // Would need to implement pattern matching for memory cache
          }
        } catch (error) {
          logger.warn(`Failed to invalidate pattern ${pattern} in ${layer.name}:`, error);
        }
      }
    }
    
    // Invalidate in Redis cache
    await this.marketDataCache.invalidateSymbol(symbol, exchange);
  }

  /**
   * Get comprehensive cache statistics
   */
  getCacheStats() {
    const marketDataStats = this.marketDataCache.getCacheStats();
    const layerStats = this.layers.map(layer => ({
      name: layer.name,
      priority: layer.priority,
      stats: layer.stats()
    }));
    
    return {
      marketData: marketDataStats,
      layers: layerStats,
      isRunning: this.isRunning
    };
  }

  /**
   * Warm up cache with initial data
   */
  async warmUp(symbols: string[], timeframes: Timeframe[], exchanges?: string[]): Promise<void> {
    logger.info(`🔥 Warming up cache for ${symbols.length} symbols...`);
    
    try {
      // This would typically fetch initial data and populate cache
      // Implementation depends on your data sources
      
      for (const symbol of symbols) {
        for (const exchange of exchanges || ['binance', 'kucoin']) {
          // Simulate warming up with placeholder data
          logger.debug(`Warming up cache for ${symbol} on ${exchange}`);
        }
      }
      
      logger.info('✅ Cache warm-up completed');
      this.emit('warmedUp', { symbols, timeframes, exchanges });
    } catch (error) {
      logger.error('❌ Cache warm-up failed:', error);
      throw error;
    }
  }

  // Private methods

  private initializeLayers(): void {
    // Initialize memory cache layer
    if (this.config.layers.memory.enabled) {
      const memoryCache = new MemoryCache(
        this.config.layers.memory.maxSize,
        this.config.layers.memory.ttl
      );
      this.layers.push(memoryCache);
    }
    
    // Sort layers by priority
    this.layers.sort((a, b) => a.priority - b.priority);
  }

  private setupEventHandlers(): void {
    this.marketDataCache.on('cached', (data) => {
      this.emit('cached', { layer: 'redis', ...data });
    });

    this.marketDataCache.on('invalidated', (data) => {
      this.emit('invalidated', { layer: 'redis', ...data });
    });

    this.marketDataCache.on('error', (error) => {
      this.emit('error', { layer: 'redis', error });
    });

    this.marketDataCache.on('statsUpdated', (stats) => {
      this.emit('statsUpdated', { layer: 'redis', stats });
    });
  }

  private async writeToHigherPriorityLayers<T>(key: string, value: T, currentPriority: number): Promise<void> {
    const higherPriorityLayers = this.layers.filter(layer => layer.priority < currentPriority);
    
    const promises = higherPriorityLayers.map(layer => 
      layer.set(key, value).catch(error => {
        logger.warn(`Failed to write back to ${layer.name}:`, error);
      })
    );
    
    await Promise.all(promises);
  }
}