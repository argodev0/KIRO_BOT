/**
 * Market Data Caching System Demo
 * Demonstrates the usage of the market data caching system with Redis,
 * multi-timeframe aggregation, and historical persistence
 */

import { CacheManager } from '../services/CacheManager';
import { MarketDataCacheService } from '../services/MarketDataCacheService';
import { getCacheConfig, CacheKeys, CacheTTL } from '../config/cache';
import { CandleData, TickerData, OrderBookData, Timeframe } from '../types/market';
import { logger } from '../utils/logger';

class MarketDataCachingDemo {
  private cacheManager: CacheManager;
  private cacheService: MarketDataCacheService;

  constructor() {
    const config = getCacheConfig();
    this.cacheManager = new CacheManager(config);
    this.cacheService = new MarketDataCacheService(config.marketData);
    
    this.setupEventHandlers();
  }

  /**
   * Run the complete caching demo
   */
  async runDemo(): Promise<void> {
    try {
      logger.info('🚀 Starting Market Data Caching Demo...');
      
      // Start services
      await this.startServices();
      
      // Demo basic caching operations
      await this.demoBasicCaching();
      
      // Demo multi-timeframe aggregation
      await this.demoAggregation();
      
      // Demo cache invalidation
      await this.demoCacheInvalidation();
      
      // Demo performance monitoring
      await this.demoPerformanceMonitoring();
      
      // Demo cache warm-up
      await this.demoCacheWarmUp();
      
      logger.info('✅ Market Data Caching Demo completed successfully');
    } catch (error) {
      logger.error('❌ Demo failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Start cache services
   */
  private async startServices(): Promise<void> {
    logger.info('📡 Starting cache services...');
    
    await this.cacheManager.start();
    await this.cacheService.start();
    
    logger.info('✅ Cache services started');
  }

  /**
   * Demo basic caching operations
   */
  private async demoBasicCaching(): Promise<void> {
    logger.info('📊 Demonstrating basic caching operations...');
    
    // Create sample ticker data
    const ticker: TickerData = {
      symbol: 'BTCUSDT',
      exchange: 'binance',
      price: 50000,
      bid: 49999,
      ask: 50001,
      volume: 1000,
      timestamp: Date.now(),
      change24h: 1000,
      changePercent24h: 2.0
    };
    
    // Cache ticker data
    logger.info('💾 Caching ticker data...');
    await this.cacheManager.cacheTicker(ticker);
    
    // Retrieve ticker data
    logger.info('🔍 Retrieving ticker data...');
    const cachedTicker = await this.cacheManager.getTicker('BTCUSDT', 'binance');
    logger.info('Retrieved ticker:', cachedTicker);
    
    // Create sample candle data
    const candle: CandleData = {
      symbol: 'BTCUSDT',
      exchange: 'binance',
      timeframe: '1m',
      timestamp: Date.now(),
      open: 50000,
      high: 50100,
      low: 49900,
      close: 50050,
      volume: 100
    };
    
    // Cache candle data
    logger.info('💾 Caching candle data...');
    await this.cacheManager.cacheCandle(candle);
    
    // Retrieve candle data
    logger.info('🔍 Retrieving candle data...');
    const cachedCandle = await this.cacheManager.getCandle('BTCUSDT', '1m', 'binance');
    logger.info('Retrieved candle:', cachedCandle);
    
    // Create sample order book data
    const orderBook: OrderBookData = {
      symbol: 'BTCUSDT',
      exchange: 'binance',
      timestamp: Date.now(),
      bids: [
        [49999, 1.0],
        [49998, 2.0],
        [49997, 1.5]
      ],
      asks: [
        [50001, 1.5],
        [50002, 2.5],
        [50003, 1.0]
      ]
    };
    
    // Cache order book data
    logger.info('💾 Caching order book data...');
    await this.cacheManager.cacheOrderBook(orderBook);
    
    // Retrieve order book data
    logger.info('🔍 Retrieving order book data...');
    const cachedOrderBook = await this.cacheManager.getOrderBook('BTCUSDT', 'binance');
    logger.info('Retrieved order book:', cachedOrderBook);
    
    logger.info('✅ Basic caching operations completed');
  }

  /**
   * Demo multi-timeframe aggregation
   */
  private async demoAggregation(): Promise<void> {
    logger.info('📈 Demonstrating multi-timeframe aggregation...');
    
    const symbol = 'ETHUSDT';
    const exchange = 'binance';
    const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h'];
    
    // Generate sample candle data for different timeframes
    const now = Date.now();
    const candleHistory: Record<Timeframe, CandleData[]> = {} as Record<Timeframe, CandleData[]>;
    
    for (const timeframe of timeframes) {
      const candles: CandleData[] = [];
      const timeframeMs = this.getTimeframeMs(timeframe);
      
      // Generate 10 candles for each timeframe
      for (let i = 0; i < 10; i++) {
        const timestamp = now - (i * timeframeMs);
        const basePrice = 3000 + Math.random() * 100;
        
        candles.push({
          symbol,
          exchange,
          timeframe,
          timestamp,
          open: basePrice,
          high: basePrice + Math.random() * 50,
          low: basePrice - Math.random() * 50,
          close: basePrice + (Math.random() - 0.5) * 20,
          volume: Math.random() * 1000
        });
      }
      
      candleHistory[timeframe] = candles.reverse(); // Oldest first
      
      // Cache the candle history
      logger.info(`💾 Caching ${timeframe} candle history for ${symbol}...`);
      await this.cacheManager.cacheCandleHistory(symbol, timeframe, candles, exchange);
    }
    
    // Retrieve aggregated data
    logger.info('🔍 Retrieving aggregated multi-timeframe data...');
    for (const timeframe of timeframes) {
      const history = await this.cacheManager.getCandleHistory(symbol, timeframe, exchange);
      logger.info(`Retrieved ${timeframe} history: ${history?.length || 0} candles`);
    }
    
    // Demo aggregated data caching
    const aggregatedData = {
      symbol,
      timeframes: candleHistory,
      lastUpdate: Date.now(),
      dataQuality: {
        completeness: 95,
        consistency: 98,
        freshness: 92
      }
    };
    
    logger.info('💾 Caching aggregated data...');
    await this.cacheService.cacheAggregatedData(symbol, aggregatedData, exchange);
    
    logger.info('🔍 Retrieving aggregated data...');
    const cachedAggregated = await this.cacheService.getAggregatedData(symbol, exchange);
    logger.info('Retrieved aggregated data quality:', cachedAggregated?.dataQuality);
    
    logger.info('✅ Multi-timeframe aggregation completed');
  }

  /**
   * Demo cache invalidation mechanisms
   */
  private async demoCacheInvalidation(): Promise<void> {
    logger.info('🗑️ Demonstrating cache invalidation...');
    
    const symbol = 'ADAUSDT';
    const exchange = 'binance';
    
    // Cache some data first
    const ticker: TickerData = {
      symbol,
      exchange,
      price: 1.5,
      bid: 1.499,
      ask: 1.501,
      volume: 5000,
      timestamp: Date.now()
    };
    
    await this.cacheManager.cacheTicker(ticker);
    logger.info('💾 Cached ticker for invalidation demo');
    
    // Verify data is cached
    const cachedBefore = await this.cacheManager.getTicker(symbol, exchange);
    logger.info('🔍 Data before invalidation:', cachedBefore ? 'Found' : 'Not found');
    
    // Invalidate symbol cache
    logger.info('🗑️ Invalidating symbol cache...');
    await this.cacheManager.invalidateSymbol(symbol, exchange);
    
    // Verify data is invalidated
    const cachedAfter = await this.cacheManager.getTicker(symbol, exchange);
    logger.info('🔍 Data after invalidation:', cachedAfter ? 'Found' : 'Not found');
    
    // Demo pattern-based invalidation
    logger.info('🗑️ Demonstrating pattern-based invalidation...');
    
    // Cache multiple tickers
    const symbols = ['DOTUSDT', 'LINKUSDT', 'UNIUSDT'];
    for (const sym of symbols) {
      await this.cacheManager.cacheTicker({
        ...ticker,
        symbol: sym
      });
    }
    
    // Invalidate by pattern
    await this.cacheService.invalidateByPattern('ticker:*USDT:*');
    logger.info('🗑️ Invalidated all USDT pairs');
    
    logger.info('✅ Cache invalidation completed');
  }

  /**
   * Demo performance monitoring
   */
  private async demoPerformanceMonitoring(): Promise<void> {
    logger.info('📊 Demonstrating performance monitoring...');
    
    // Perform various cache operations to generate statistics
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'DOTUSDT'];
    
    logger.info('🔄 Performing cache operations for statistics...');
    
    for (const symbol of symbols) {
      // Cache operations
      const ticker: TickerData = {
        symbol,
        exchange: 'binance',
        price: Math.random() * 1000,
        bid: Math.random() * 1000,
        ask: Math.random() * 1000,
        volume: Math.random() * 10000,
        timestamp: Date.now()
      };
      
      await this.cacheManager.cacheTicker(ticker);
      
      // Read operations (some will hit, some will miss)
      await this.cacheManager.getTicker(symbol, 'binance');
      await this.cacheManager.getTicker(symbol, 'kucoin'); // Likely miss
    }
    
    // Get comprehensive statistics
    logger.info('📈 Cache Statistics:');
    const stats = this.cacheManager.getCacheStats();
    
    logger.info('Market Data Cache Stats:', {
      hitRate: `${stats.marketData.hitRate.toFixed(2)}%`,
      totalKeys: stats.marketData.totalKeys,
      memoryUsage: `${(stats.marketData.memoryUsage / 1024 / 1024).toFixed(2)} MB`,
      operations: stats.marketData.operations
    });
    
    logger.info('Cache Layers:', stats.layers.map(layer => ({
      name: layer.name,
      priority: layer.priority,
      stats: layer.stats
    })));
    
    // Get individual cache service stats
    const cacheServiceStats = this.cacheService.getCacheStats();
    logger.info('Cache Service Stats:', {
      hitRate: `${cacheServiceStats.hitRate.toFixed(2)}%`,
      hits: cacheServiceStats.hits,
      misses: cacheServiceStats.misses,
      totalOperations: Object.values(cacheServiceStats.operations).reduce((a, b) => a + b, 0)
    });
    
    logger.info('✅ Performance monitoring completed');
  }

  /**
   * Demo cache warm-up functionality
   */
  private async demoCacheWarmUp(): Promise<void> {
    logger.info('🔥 Demonstrating cache warm-up...');
    
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
    const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h'];
    const exchanges = ['binance', 'kucoin'];
    
    // Clear cache first
    await this.cacheService.clearCache();
    logger.info('🗑️ Cleared cache for warm-up demo');
    
    // Warm up cache
    logger.info('🔥 Starting cache warm-up...');
    await this.cacheManager.warmUp(symbols, timeframes, exchanges);
    
    // Verify warm-up by checking cache stats
    const statsAfterWarmUp = this.cacheManager.getCacheStats();
    logger.info('📊 Stats after warm-up:', {
      totalKeys: statsAfterWarmUp.marketData.totalKeys,
      layers: statsAfterWarmUp.layers.length
    });
    
    logger.info('✅ Cache warm-up completed');
  }

  /**
   * Setup event handlers for monitoring
   */
  private setupEventHandlers(): void {
    // Cache Manager events
    this.cacheManager.on('started', () => {
      logger.info('🟢 Cache Manager started');
    });
    
    this.cacheManager.on('stopped', () => {
      logger.info('🔴 Cache Manager stopped');
    });
    
    this.cacheManager.on('cached', (data) => {
      logger.debug('💾 Data cached:', data);
    });
    
    this.cacheManager.on('invalidated', (data) => {
      logger.debug('🗑️ Cache invalidated:', data);
    });
    
    this.cacheManager.on('warmedUp', (data) => {
      logger.info('🔥 Cache warmed up:', data);
    });
    
    // Cache Service events
    this.cacheService.on('started', () => {
      logger.info('🟢 Cache Service started');
    });
    
    this.cacheService.on('stopped', () => {
      logger.info('🔴 Cache Service stopped');
    });
    
    this.cacheService.on('cached', (data) => {
      logger.debug('💾 Service cached:', data);
    });
    
    this.cacheService.on('aggregated', (data) => {
      logger.debug('📊 Data aggregated:', data);
    });
    
    this.cacheService.on('statsUpdated', (stats) => {
      logger.debug('📈 Stats updated:', {
        hitRate: `${stats.hitRate.toFixed(2)}%`,
        totalKeys: stats.totalKeys
      });
    });
    
    this.cacheService.on('error', (error) => {
      logger.error('❌ Cache Service error:', error);
    });
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    logger.info('🧹 Cleaning up resources...');
    
    try {
      await this.cacheManager.stop();
      await this.cacheService.stop();
      logger.info('✅ Cleanup completed');
    } catch (error) {
      logger.error('❌ Cleanup failed:', error);
    }
  }

  /**
   * Get timeframe in milliseconds
   */
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

/**
 * Run the demo if this file is executed directly
 */
if (require.main === module) {
  const demo = new MarketDataCachingDemo();
  
  demo.runDemo()
    .then(() => {
      logger.info('🎉 Demo completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Demo failed:', error);
      process.exit(1);
    });
}

export { MarketDataCachingDemo };