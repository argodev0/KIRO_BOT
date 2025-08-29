/**
 * Cache Configuration
 * Provides configuration for market data caching system
 */

import { CacheConfig } from '../services/MarketDataCacheService';
import { CacheManagerConfig } from '../services/CacheManager';
import { config } from './config';

/**
 * Create market data cache configuration
 */
export function createCacheConfig(): CacheConfig {
  return {
    redis: {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      keyPrefix: 'market'
    },
    ttl: {
      ticker: 30,        // 30 seconds for ticker data
      candle: 300,       // 5 minutes for candle data
      orderbook: 10,     // 10 seconds for order book data
      trade: 60,         // 1 minute for trade data
      aggregated: 600,   // 10 minutes for aggregated data
      historical: 3600   // 1 hour for historical data
    },
    aggregation: {
      enabled: true,
      timeframes: ['1m', '5m', '15m', '30m', '1h', '4h', '1d'],
      batchSize: 100,
      flushInterval: 30000 // 30 seconds
    },
    persistence: {
      enabled: true,
      batchSize: 50,
      flushInterval: 60000, // 1 minute
      retentionDays: 30
    }
  };
}

/**
 * Create cache manager configuration
 */
export function createCacheManagerConfig(): CacheManagerConfig {
  return {
    marketData: createCacheConfig(),
    layers: {
      memory: {
        enabled: true,
        maxSize: 100, // 100 MB
        ttl: 300      // 5 minutes
      },
      redis: {
        enabled: true
      },
      database: {
        enabled: true
      }
    },
    strategies: {
      writeThrough: true,  // Write to all layers immediately
      writeBack: false,    // Don't use write-back strategy for now
      readThrough: true    // Populate higher layers on cache miss
    }
  };
}

/**
 * Get cache configuration based on environment
 */
export function getCacheConfig(): CacheManagerConfig {
  const baseConfig = createCacheManagerConfig();
  
  // Adjust configuration based on environment
  if (config.env === 'production') {
    // Production optimizations
    baseConfig.marketData.ttl.ticker = 15; // Faster ticker updates
    baseConfig.marketData.aggregation.flushInterval = 15000; // 15 seconds
    baseConfig.marketData.persistence.flushInterval = 30000; // 30 seconds
    baseConfig.layers.memory.maxSize = 200; // 200 MB for production
  } else if (config.env === 'development') {
    // Development settings
    baseConfig.marketData.ttl.ticker = 60; // Slower updates for dev
    baseConfig.marketData.aggregation.enabled = false; // Disable aggregation in dev
    baseConfig.layers.memory.maxSize = 50; // 50 MB for development
  }
  
  // Disable persistence if database is not available
  if (!config.database.url) {
    baseConfig.marketData.persistence.enabled = false;
  }
  
  return baseConfig;
}

/**
 * Cache key generators
 */
export const CacheKeys = {
  ticker: (symbol: string, exchange?: string) => 
    `ticker:${symbol}:${exchange || 'default'}`,
  
  candle: (symbol: string, timeframe: string, exchange?: string) => 
    `candle:${symbol}:${exchange || 'default'}:${timeframe}`,
  
  orderbook: (symbol: string, exchange?: string) => 
    `orderbook:${symbol}:${exchange || 'default'}`,
  
  history: (symbol: string, timeframe: string, exchange?: string) => 
    `history:${symbol}:${exchange || 'default'}:${timeframe}`,
  
  aggregated: (symbol: string, exchange?: string) => 
    `aggregated:${symbol}:${exchange || 'default'}`,
  
  pattern: (type: string, symbol?: string, exchange?: string) => {
    const parts = [type];
    if (symbol) parts.push(symbol);
    if (exchange) parts.push(exchange);
    parts.push('*');
    return parts.join(':');
  }
};

/**
 * Cache TTL constants
 */
export const CacheTTL = {
  TICKER: 30,
  CANDLE: 300,
  ORDERBOOK: 10,
  TRADE: 60,
  AGGREGATED: 600,
  HISTORICAL: 3600,
  
  // Dynamic TTL based on timeframe
  getTimeframeTTL: (timeframe: string): number => {
    const timeframeMap: Record<string, number> = {
      '1m': 60,      // 1 minute
      '5m': 300,     // 5 minutes
      '15m': 900,    // 15 minutes
      '30m': 1800,   // 30 minutes
      '1h': 3600,    // 1 hour
      '4h': 14400,   // 4 hours
      '1d': 86400,   // 1 day
      '1w': 604800,  // 1 week
      '1M': 2592000  // 30 days
    };
    return timeframeMap[timeframe] || 300;
  }
};

/**
 * Cache size limits
 */
export const CacheLimits = {
  MAX_MEMORY_SIZE: 500 * 1024 * 1024, // 500 MB
  MAX_REDIS_KEYS: 1000000,             // 1 million keys
  MAX_BATCH_SIZE: 1000,                // Maximum batch size for operations
  MAX_HISTORY_LENGTH: 10000,           // Maximum candles to keep in history
  
  // Per-symbol limits
  MAX_CANDLES_PER_SYMBOL: 1000,
  MAX_TRADES_PER_SYMBOL: 500,
  MAX_ORDERBOOK_LEVELS: 100
};

/**
 * Cache monitoring configuration
 */
export const CacheMonitoring = {
  STATS_UPDATE_INTERVAL: 30000,    // 30 seconds
  HEALTH_CHECK_INTERVAL: 60000,    // 1 minute
  CLEANUP_INTERVAL: 300000,        // 5 minutes
  
  // Alert thresholds
  MEMORY_USAGE_THRESHOLD: 0.8,     // 80%
  HIT_RATE_THRESHOLD: 0.7,         // 70%
  ERROR_RATE_THRESHOLD: 0.05,      // 5%
  
  // Performance thresholds
  MAX_GET_LATENCY: 10,             // 10ms
  MAX_SET_LATENCY: 50,             // 50ms
  MAX_QUEUE_SIZE: 10000            // 10k items
};