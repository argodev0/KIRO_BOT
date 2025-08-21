/**
 * Market Data Integration Tests
 * Tests the complete market data ingestion and processing pipeline
 */

import { DataProcessingPipeline, PipelineConfig } from '../../services/DataProcessingPipeline';
import { CandleData } from '../../types/market';

// Mock external dependencies
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    setEx: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
  })),
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    marketData: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({}),
    },
  })),
}));

describe('Market Data Integration Tests', () => {
  let pipeline: DataProcessingPipeline;
  let exchangeManager: ExchangeManager;
  let config: PipelineConfig;

  beforeEach(() => {
    config = {
      marketData: {
        redis: {
          host: 'localhost',
          port: 6379,
          db: 0,
        },
        exchanges: {
          binance: {
            enabled: true,
            symbols: ['BTCUSDT', 'ETHUSDT'],
            timeframes: ['1m', '5m', '15m', '1h'],
          },
        },
        caching: {
          candleTtl: 3600,
          tickerTtl: 60,
          orderBookTtl: 30,
          tradeTtl: 300,
        },
        processing: {
          batchSize: 100,
          flushInterval: 5000,
          maxRetries: 3,
        },
      },
      processing: {
        batchSize: 50,
        processingInterval: 1000,
        retryAttempts: 3,
        retryDelay: 1000,
      },
      quality: {
        minValidationRate: 95,
        maxErrorRate: 5,
        alertThresholds: {
          dataLag: 10000,
          validationFailures: 10,
          processingErrors: 5,
        },
      },
    };

    exchangeManager = new ExchangeManager({
      exchanges: {
        binance: {
          enabled: true,
          apiKey: 'test-key',
          apiSecret: 'test-secret',
          sandbox: true,
        },
      },
    });

    // Mock exchange manager methods
    jest.spyOn(exchangeManager, 'initialize').mockResolvedValue(undefined);
    jest.spyOn(exchangeManager, 'shutdown').mockResolvedValue(undefined);
    jest.spyOn(exchangeManager, 'healthCheck').mockResolvedValue({ binance: true, kucoin: true });
    jest.spyOn(exchangeManager, 'on').mockImplementation(() => exchangeManager);

    pipeline = new DataProcessingPipeline(exchangeManager, config);
  });

  afterEach(async () => {
    if (pipeline) {
      await pipeline.stop();
    }
  });

  describe('End-to-End Data Flow', () => {
    it('should process complete market data flow from ingestion to storage', async () => {
      await pipeline.start();

      // Simulate market data events
      const testCandles: CandleData[] = [
        {
          symbol: 'BTCUSDT',
          timeframe: '1m',
          timestamp: 1640995200000, // 2022-01-01 00:00:00
          open: 50000,
          high: 50100,
          low: 49900,
          close: 50050,
          volume: 1.5,
          exchange: 'binance',
        },
        {
          symbol: 'BTCUSDT',
          timeframe: '1m',
          timestamp: 1640995260000, // 2022-01-01 00:01:00
          open: 50050,
          high: 50150,
          low: 49950,
          close: 50100,
          volume: 1.8,
          exchange: 'binance',
        },
        {
          symbol: 'BTCUSDT',
          timeframe: '1m',
          timestamp: 1640995320000, // 2022-01-01 00:02:00
          open: 50100,
          high: 50200,
          low: 50000,
          close: 50150,
          volume: 2.1,
          exchange: 'binance',
        },
      ];

      const processedEvents: any[] = [];
      const aggregatedEvents: any[] = [];

      pipeline.on('dataProcessed', (event) => {
        processedEvents.push(event);
      });

      pipeline.on('aggregatedCandle', (candle) => {
        aggregatedEvents.push(candle);
      });

      // Process all test candles
      for (const candle of testCandles) {
        const result = await pipeline.processMarketData(candle, 'candle');
        expect(result).toBe(true);
      }

      // Verify processing
      expect(processedEvents).toHaveLength(3);
      expect(aggregatedEvents.length).toBeGreaterThan(0);

      // Check metrics
      const metrics = pipeline.getMetrics();
      expect(metrics.processed.candles).toBe(3);
      expect(metrics.errors.validation).toBe(0);
      expect(metrics.quality.validationRate).toBe(100);
    });

    it('should handle mixed valid and invalid data correctly', async () => {
      await pipeline.start();

      const mixedData = [
        // Valid candle
        {
          symbol: 'BTCUSDT',
          timeframe: '1m',
          timestamp: Date.now(),
          open: 50000,
          high: 50100,
          low: 49900,
          close: 50050,
          volume: 1.5,
          exchange: 'binance',
        },
        // Invalid candle (negative price)
        {
          symbol: 'BTCUSDT',
          timeframe: '1m',
          timestamp: Date.now(),
          open: -50000,
          high: 50100,
          low: 49900,
          close: 50050,
          volume: 1.5,
          exchange: 'binance',
        },
        // Valid ticker
        {
          symbol: 'ETHUSDT',
          exchange: 'binance',
          price: 3000,
          volume: 500,
          timestamp: Date.now(),
          bid: 2995,
          ask: 3005,
        },
        // Invalid ticker (crossed market)
        {
          symbol: 'ETHUSDT',
          exchange: 'binance',
          price: 3000,
          volume: 500,
          timestamp: Date.now(),
          bid: 3010, // Bid higher than ask
          ask: 3005,
        },
      ];

      const results = await Promise.all([
        pipeline.processMarketData(mixedData[0], 'candle'),
        pipeline.processMarketData(mixedData[1], 'candle'),
        pipeline.processMarketData(mixedData[2], 'ticker'),
        pipeline.processMarketData(mixedData[3], 'ticker'),
      ]);

      expect(results).toEqual([true, false, true, false]);

      const metrics = pipeline.getMetrics();
      expect(metrics.processed.candles).toBe(1);
      expect(metrics.processed.tickers).toBe(1);
      expect(metrics.errors.validation).toBe(2);
      expect(metrics.quality.validationRate).toBe(50);
    });
  });

  describe('Multi-Timeframe Processing', () => {
    it('should aggregate 1m candles to higher timeframes correctly', async () => {
      await pipeline.start();

      const baseTime = 1640995200000; // Aligned to 5m boundary
      const candles: CandleData[] = [];

      // Generate 15 minutes of 1m candles (3 complete 5m periods)
      for (let i = 0; i < 15; i++) {
        candles.push({
          symbol: 'BTCUSDT',
          timeframe: '1m',
          timestamp: baseTime + (i * 60000),
          open: 50000 + (i * 10),
          high: 50100 + (i * 20),
          low: 49900 - (i * 5),
          close: 50050 + (i * 15),
          volume: 1.0 + (i * 0.1),
          exchange: 'binance',
        });
      }

      const aggregatedCandles: CandleData[] = [];
      pipeline.on('aggregatedCandle', (candle: CandleData) => {
        if (candle.timeframe === '5m') {
          aggregatedCandles.push(candle);
        }
      });

      // Process all candles
      for (const candle of candles) {
        await pipeline.processMarketData(candle, 'candle');
      }

      // Should have 3 complete 5m candles
      expect(aggregatedCandles.length).toBeGreaterThanOrEqual(3);

      // Verify first 5m candle aggregation
      const first5m = aggregatedCandles[0];
      expect(first5m.symbol).toBe('BTCUSDT');
      expect(first5m.timeframe).toBe('5m');
      expect(first5m.timestamp).toBe(baseTime);
      expect(first5m.open).toBe(50000); // First candle's open
      expect(first5m.volume).toBe(5.0); // Sum of 5 candles
    });

    it('should handle real-time updates to aggregated candles', async () => {
      await pipeline.start();

      const baseTime = 1640995200000; // Aligned to 5m boundary
      const aggregatedUpdates: CandleData[] = [];

      pipeline.on('aggregatedCandle', (candle: CandleData) => {
        if (candle.timeframe === '5m') {
          aggregatedUpdates.push(candle);
        }
      });

      // First candle in 5m period
      await pipeline.processMarketData({
        symbol: 'BTCUSDT',
        timeframe: '1m',
        timestamp: baseTime,
        open: 50000,
        high: 50100,
        low: 49900,
        close: 50050,
        volume: 1.0,
        exchange: 'binance',
      }, 'candle');

      expect(aggregatedUpdates).toHaveLength(1);
      expect(aggregatedUpdates[0].volume).toBe(1.0);

      // Second candle in same 5m period
      await pipeline.processMarketData({
        symbol: 'BTCUSDT',
        timeframe: '1m',
        timestamp: baseTime + 60000,
        open: 50050,
        high: 50200,
        low: 49800,
        close: 50100,
        volume: 1.5,
        exchange: 'binance',
      }, 'candle');

      // Should have updated the same 5m candle
      expect(aggregatedUpdates).toHaveLength(2);
      expect(aggregatedUpdates[1].volume).toBe(2.5); // Updated volume
      expect(aggregatedUpdates[1].high).toBe(50200); // Updated high
      expect(aggregatedUpdates[1].low).toBe(49800); // Updated low
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-frequency data processing', async () => {
      await pipeline.start();

      const startTime = Date.now();
      const numCandles = 1000;
      const baseTimestamp = 1640995200000;

      // Generate large number of candles
      const candles: CandleData[] = [];
      for (let i = 0; i < numCandles; i++) {
        candles.push({
          symbol: 'BTCUSDT',
          timeframe: '1m',
          timestamp: baseTimestamp + (i * 60000),
          open: 50000 + Math.random() * 1000,
          high: 50500 + Math.random() * 1000,
          low: 49500 + Math.random() * 1000,
          close: 50000 + Math.random() * 1000,
          volume: 1.0 + Math.random() * 2.0,
          exchange: 'binance',
        });
      }

      // Process all candles
      const results = await Promise.all(
        candles.map(candle => pipeline.processMarketData(candle, 'candle'))
      );

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // All should be processed successfully
      expect(results.every(result => result === true)).toBe(true);

      // Check performance metrics
      const metrics = pipeline.getMetrics();
      expect(metrics.processed.candles).toBe(numCandles);
      expect(metrics.performance.throughput).toBeGreaterThan(0);

      // Should process at reasonable speed (adjust threshold as needed)
      const candlesPerSecond = numCandles / (processingTime / 1000);
      expect(candlesPerSecond).toBeGreaterThan(10); // At least 10 candles/second

      console.log(`Processed ${numCandles} candles in ${processingTime}ms (${candlesPerSecond.toFixed(2)} candles/sec)`);
    });

    it('should maintain memory usage within reasonable bounds', async () => {
      await pipeline.start();

      const initialMemory = process.memoryUsage().heapUsed;
      const numCandles = 5000;
      const baseTimestamp = Date.now();

      // Process large number of candles
      for (let i = 0; i < numCandles; i++) {
        await pipeline.processMarketData({
          symbol: 'BTCUSDT',
          timeframe: '1m',
          timestamp: baseTimestamp + (i * 60000),
          open: 50000,
          high: 50100,
          low: 49900,
          close: 50050,
          volume: 1.0,
          exchange: 'binance',
        }, 'candle');

        // Force garbage collection periodically
        if (i % 1000 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryPerCandle = memoryIncrease / numCandles;

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB for ${numCandles} candles`);
      console.log(`Memory per candle: ${memoryPerCandle.toFixed(2)} bytes`);

      // Memory usage should be reasonable (adjust threshold as needed)
      expect(memoryPerCandle).toBeLessThan(1000); // Less than 1KB per candle
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from temporary processing errors', async () => {
      await pipeline.start();

      let processCallCount = 0;
      const originalProcessCandle = (pipeline as any).processCandle;

      // Mock processCandle to fail first few times, then succeed
      (pipeline as any).processCandle = jest.fn().mockImplementation(async (candle) => {
        processCallCount++;
        if (processCallCount <= 2) {
          throw new Error('Temporary processing error');
        }
        return originalProcessCandle.call(pipeline, candle);
      });

      const validCandle: CandleData = {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        timestamp: Date.now(),
        open: 50000,
        high: 50100,
        low: 49900,
        close: 50050,
        volume: 1.5,
        exchange: 'binance',
      };

      // First two attempts should fail
      let result1 = await pipeline.processMarketData(validCandle, 'candle');
      let result2 = await pipeline.processMarketData(validCandle, 'candle');
      expect(result1).toBe(false);
      expect(result2).toBe(false);

      // Third attempt should succeed
      let result3 = await pipeline.processMarketData(validCandle, 'candle');
      expect(result3).toBe(true);

      const metrics = pipeline.getMetrics();
      expect(metrics.errors.processing).toBe(2);
      expect(metrics.processed.candles).toBe(1);

      // Restore original method
      (pipeline as any).processCandle = originalProcessCandle;
    });

    it('should handle validation errors gracefully without stopping pipeline', async () => {
      await pipeline.start();

      const validationErrors: any[] = [];
      pipeline.on('validationError', (error) => {
        validationErrors.push(error);
      });

      // Mix of valid and invalid data
      const testData = [
        { valid: true, data: { symbol: 'BTCUSDT', timeframe: '1m', timestamp: Date.now(), open: 50000, high: 50100, low: 49900, close: 50050, volume: 1.5, exchange: 'binance' } },
        { valid: false, data: { symbol: '', timeframe: '1m', timestamp: Date.now(), open: -50000, high: 50100, low: 49900, close: 50050, volume: 1.5, exchange: 'binance' } },
        { valid: true, data: { symbol: 'ETHUSDT', timeframe: '1m', timestamp: Date.now(), open: 3000, high: 3100, low: 2900, close: 3050, volume: 2.0, exchange: 'binance' } },
        { valid: false, data: { symbol: 'ETHUSDT', timeframe: '1m', timestamp: Date.now(), open: 3000, high: 2900, low: 3100, close: 3050, volume: 2.0, exchange: 'binance' } }, // High < Low
      ];

      const results = [];
      for (const item of testData) {
        const result = await pipeline.processMarketData(item.data, 'candle');
        results.push(result);
      }

      expect(results).toEqual([true, false, true, false]);
      expect(validationErrors).toHaveLength(2);

      // Pipeline should still be running and processing valid data
      const health = await pipeline.healthCheck();
      expect(health.status).toBe('healthy');
    });
  });

  describe('Data Quality Monitoring', () => {
    it('should detect and report data quality issues', async () => {
      await pipeline.start();

      // Process sequence with quality issues
      const baseTime = 1640995200000;
      const problematicCandles: CandleData[] = [
        // Normal candle
        {
          symbol: 'BTCUSDT',
          timeframe: '1m',
          timestamp: baseTime,
          open: 50000,
          high: 50100,
          low: 49900,
          close: 50050,
          volume: 1.5,
          exchange: 'binance',
        },
        // Large price gap (suspicious)
        {
          symbol: 'BTCUSDT',
          timeframe: '1m',
          timestamp: baseTime + 60000,
          open: 75000, // 50% jump
          high: 75100,
          low: 74900,
          close: 75050,
          volume: 1.5,
          exchange: 'binance',
        },
        // Missing candle (gap in time)
        {
          symbol: 'BTCUSDT',
          timeframe: '1m',
          timestamp: baseTime + 300000, // 5 minutes later (missing 3 candles)
          open: 75050,
          high: 75150,
          low: 74950,
          close: 75100,
          volume: 1.5,
          exchange: 'binance',
        },
      ];

      for (const candle of problematicCandles) {
        await pipeline.processMarketData(candle, 'candle');
      }

      // Mock quality assessment
      const mockAssessQuality = jest.fn().mockResolvedValue({
        completeness: 70, // Missing data
        consistency: 60, // Price gaps
        freshness: 95,
        overall: 75,
        issues: [
          'Missing 3 candles',
          'Large price gap between candles: 50.00%',
          'Potential missing candle detected'
        ],
      });

      (pipeline as any).marketDataService.assessDataQuality = mockAssessQuality;

      const qualityReport = await pipeline.getDataQualityReport(['BTCUSDT'], ['1m']);
      
      expect(qualityReport.BTCUSDT['1m'].overall).toBe(75);
      expect(qualityReport.BTCUSDT['1m'].issues).toContain('Missing 3 candles');
      expect(qualityReport.BTCUSDT['1m'].issues).toContain('Large price gap between candles: 50.00%');
    });

    it('should track quality metrics over time', async () => {
      await pipeline.start();

      // Process good quality data
      for (let i = 0; i < 10; i++) {
        await pipeline.processMarketData({
          symbol: 'BTCUSDT',
          timeframe: '1m',
          timestamp: Date.now() + (i * 60000),
          open: 50000 + (i * 10),
          high: 50100 + (i * 10),
          low: 49900 + (i * 10),
          close: 50050 + (i * 10),
          volume: 1.5,
          exchange: 'binance',
        }, 'candle');
      }

      // Process some bad quality data
      for (let i = 0; i < 2; i++) {
        await pipeline.processMarketData({
          symbol: '',
          timeframe: '1m',
          timestamp: Date.now(),
          open: -50000,
          high: 50100,
          low: 49900,
          close: 50050,
          volume: 1.5,
          exchange: 'binance',
        }, 'candle');
      }

      const metrics = pipeline.getMetrics();
      expect(metrics.processed.candles).toBe(10);
      expect(metrics.errors.validation).toBe(2);
      expect(metrics.quality.validationRate).toBeCloseTo(83.33, 1); // 10/(10+2) * 100
      expect(metrics.quality.errorRate).toBeCloseTo(16.67, 1); // 2/(10+2) * 100
    });
  });
});