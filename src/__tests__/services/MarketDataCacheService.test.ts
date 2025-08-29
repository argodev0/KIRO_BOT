/**
 * Market Data Cache Service Tests
 */

import { MarketDataCacheService, CacheConfig } from '../../services/MarketDataCacheService';
import { CandleData, TickerData, OrderBookData, Timeframe } from '../../types/market';

// Mock Redis
const mockRedisClient = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  setEx: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  ttl: jest.fn(),
  info: jest.fn(),
  on: jest.fn()
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient)
}));

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    marketData: {
      createMany: jest.fn()
    },
    $disconnect: jest.fn()
  }))
}));

describe('MarketDataCacheService', () => {
  let cacheService: MarketDataCacheService;
  let mockConfig: CacheConfig;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Set default mock return values
    mockRedisClient.keys.mockResolvedValue([]);
    mockRedisClient.ttl.mockResolvedValue(300);
    mockRedisClient.info.mockResolvedValue('used_memory:1024');
    
    mockConfig = {
      redis: {
        host: 'localhost',
        port: 6379,
        db: 0,
        keyPrefix: 'test'
      },
      ttl: {
        ticker: 30,
        candle: 300,
        orderbook: 10,
        trade: 60,
        aggregated: 600,
        historical: 3600
      },
      aggregation: {
        enabled: true,
        timeframes: ['1m', '5m', '15m', '1h'],
        batchSize: 10,
        flushInterval: 1000
      },
      persistence: {
        enabled: true,
        batchSize: 10,
        flushInterval: 1000,
        retentionDays: 30
      }
    };

    cacheService = new MarketDataCacheService(mockConfig);
  });

  afterEach(async () => {
    if (cacheService) {
      await cacheService.stop();
    }
  });

  describe('Service Lifecycle', () => {
    it('should start successfully', async () => {
      await expect(cacheService.start()).resolves.not.toThrow();
    });

    it('should stop successfully', async () => {
      await cacheService.start();
      await expect(cacheService.stop()).resolves.not.toThrow();
    });

    it('should not start twice', async () => {
      await cacheService.start();
      
      // Mock logger.warn to capture the warning
      const loggerWarnSpy = jest.spyOn(require('../../utils/logger').logger, 'warn').mockImplementation();
      
      await cacheService.start();
      
      // Should log warning about already running
      expect(loggerWarnSpy).toHaveBeenCalledWith('MarketDataCacheService is already running');
      
      loggerWarnSpy.mockRestore();
    });
  });

  describe('Ticker Caching', () => {
    const mockTicker: TickerData = {
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

    beforeEach(async () => {
      await cacheService.start();
    });

    it('should cache ticker data', async () => {
      await expect(cacheService.cacheTicker(mockTicker)).resolves.not.toThrow();
    });

    it('should retrieve cached ticker data', async () => {
      // Mock Redis get to return the ticker
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockTicker));

      await cacheService.cacheTicker(mockTicker);
      const result = await cacheService.getTicker('BTCUSDT', 'binance');

      expect(result).toEqual(mockTicker);
    });

    it('should return null for non-existent ticker', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await cacheService.getTicker('NONEXISTENT', 'binance');
      expect(result).toBeNull();
    });
  });

  describe('Candle Caching', () => {
    const mockCandle: CandleData = {
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

    beforeEach(async () => {
      await cacheService.start();
    });

    it('should cache candle data', async () => {
      await expect(cacheService.cacheCandle(mockCandle)).resolves.not.toThrow();
    });

    it('should retrieve cached candle data', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockCandle));

      await cacheService.cacheCandle(mockCandle);
      const result = await cacheService.getCandle('BTCUSDT', '1m', 'binance');

      expect(result).toEqual(mockCandle);
    });

    it('should cache candle history', async () => {
      const candles = [mockCandle, { ...mockCandle, timestamp: mockCandle.timestamp + 60000 }];
      
      await expect(
        cacheService.cacheCandleHistory('BTCUSDT', '1m', candles, 'binance')
      ).resolves.not.toThrow();
    });

    it('should retrieve cached candle history', async () => {
      const candles = [mockCandle];
      mockRedisClient.get.mockResolvedValue(JSON.stringify(candles));

      const result = await cacheService.getCandleHistory('BTCUSDT', '1m', 'binance');
      expect(result).toEqual(candles);
    });
  });

  describe('Order Book Caching', () => {
    const mockOrderBook: OrderBookData = {
      symbol: 'BTCUSDT',
      exchange: 'binance',
      timestamp: Date.now(),
      bids: [
        [49999, 1.0],
        [49998, 2.0]
      ],
      asks: [
        [50001, 1.5],
        [50002, 2.5]
      ]
    };

    beforeEach(async () => {
      await cacheService.start();
    });

    it('should cache order book data', async () => {
      await expect(cacheService.cacheOrderBook(mockOrderBook)).resolves.not.toThrow();
    });

    it('should retrieve cached order book data', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockOrderBook));

      await cacheService.cacheOrderBook(mockOrderBook);
      const result = await cacheService.getOrderBook('BTCUSDT', 'binance');

      expect(result).toEqual(mockOrderBook);
    });
  });

  describe('Cache Invalidation', () => {
    beforeEach(async () => {
      await cacheService.start();
    });

    it('should invalidate symbol cache', async () => {
      mockRedisClient.keys.mockResolvedValue(['test:ticker:BTCUSDT:binance', 'test:candle:BTCUSDT:binance:1m']);
      mockRedisClient.del.mockResolvedValue(2);

      await expect(cacheService.invalidateSymbol('BTCUSDT', 'binance')).resolves.not.toThrow();
      expect(mockRedisClient.del).toHaveBeenCalled();
    });

    it('should invalidate by pattern', async () => {
      mockRedisClient.keys.mockResolvedValue(['test:ticker:BTCUSDT:binance']);
      mockRedisClient.del.mockResolvedValue(1);

      await expect(cacheService.invalidateByPattern('ticker:*')).resolves.not.toThrow();
      expect(mockRedisClient.del).toHaveBeenCalled();
    });

    it('should clear all cache', async () => {
      mockRedisClient.keys.mockResolvedValue(['test:ticker:BTCUSDT:binance']);
      mockRedisClient.del.mockResolvedValue(1);

      await expect(cacheService.clearCache()).resolves.not.toThrow();
      expect(mockRedisClient.del).toHaveBeenCalled();
    });
  });

  describe('Cache Statistics', () => {
    beforeEach(async () => {
      await cacheService.start();
    });

    it('should return cache statistics', () => {
      const stats = cacheService.getCacheStats();
      
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('totalKeys');
      expect(stats).toHaveProperty('operations');
    });

    it('should calculate hit rate correctly', async () => {
      // Simulate cache hit
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ test: 'data' }));
      await cacheService.getTicker('BTCUSDT', 'binance');
      
      // Simulate cache miss
      mockRedisClient.get.mockResolvedValueOnce(null);
      await cacheService.getTicker('ETHUSDT', 'binance');
      
      const stats = cacheService.getCacheStats();
      expect(stats.hitRate).toBe(50); // 1 hit out of 2 requests
    });
  });

  describe('Aggregated Data', () => {
    beforeEach(async () => {
      await cacheService.start();
    });

    it('should cache aggregated data', async () => {
      const aggregatedData = {
        symbol: 'BTCUSDT',
        timeframes: {
          '1m': [],
          '5m': [],
          '15m': [],
          '30m': [],
          '1h': [],
          '4h': [],
          '1d': [],
          '1w': [],
          '1M': []
        } as Record<Timeframe, CandleData[]>,
        lastUpdate: Date.now(),
        dataQuality: {
          completeness: 100,
          consistency: 100,
          freshness: 100
        }
      };

      await expect(
        cacheService.cacheAggregatedData('BTCUSDT', aggregatedData, 'binance')
      ).resolves.not.toThrow();
    });

    it('should retrieve aggregated data', async () => {
      const aggregatedData = {
        symbol: 'BTCUSDT',
        timeframes: {},
        lastUpdate: Date.now(),
        dataQuality: {
          completeness: 100,
          consistency: 100,
          freshness: 100
        }
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(aggregatedData));

      const result = await cacheService.getAggregatedData('BTCUSDT', 'binance');
      expect(result).toEqual(aggregatedData);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await cacheService.start();
    });

    it('should handle Redis connection errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await cacheService.getTicker('BTCUSDT', 'binance');
      expect(result).toBeNull();
    });

    it('should handle cache set errors gracefully', async () => {
      mockRedisClient.setEx.mockRejectedValue(new Error('Redis set failed'));

      const mockTicker: TickerData = {
        symbol: 'BTCUSDT',
        exchange: 'binance',
        price: 50000,
        bid: 49999,
        ask: 50001,
        volume: 1000,
        timestamp: Date.now()
      };

      await expect(cacheService.cacheTicker(mockTicker)).rejects.toThrow();
    });
  });

  describe('Batch Processing', () => {
    beforeEach(async () => {
      await cacheService.start();
    });

    it('should process data in batches', async () => {
      // This test would verify that the batch processing timers work correctly
      // For now, we'll just verify the service can handle multiple operations
      
      const mockTicker: TickerData = {
        symbol: 'BTCUSDT',
        exchange: 'binance',
        price: 50000,
        bid: 49999,
        ask: 50001,
        volume: 1000,
        timestamp: Date.now()
      };

      // Cache multiple tickers
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(cacheService.cacheTicker({
          ...mockTicker,
          symbol: `BTC${i}USDT`
        }));
      }

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });
});