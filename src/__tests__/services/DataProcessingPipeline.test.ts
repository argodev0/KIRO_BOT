/**
 * Data Processing Pipeline Tests
 * Comprehensive tests for the complete data processing pipeline
 */

import { DataProcessingPipeline, PipelineConfig } from '../../services/DataProcessingPipeline';
import { ExchangeManager } from '../../services/exchanges/ExchangeManager';
import { CandleData, TickerData, OrderBookData, TradeData, Timeframe } from '../../types/market';

// Mock ExchangeManager
jest.mock('../../services/exchanges/ExchangeManager');
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    setEx: jest.fn(),
    on: jest.fn(),
  })),
}));

describe('DataProcessingPipeline', () => {
  let pipeline: DataProcessingPipeline;
  let mockExchangeManager: jest.Mocked<ExchangeManager>;
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

    mockExchangeManager = new ExchangeManager({
      exchanges: {},
    }) as jest.Mocked<ExchangeManager>;

    // Mock exchange manager methods
    mockExchangeManager.initialize = jest.fn().mockResolvedValue(undefined);
    mockExchangeManager.shutdown = jest.fn().mockResolvedValue(undefined);
    mockExchangeManager.healthCheck = jest.fn().mockResolvedValue({ binance: true });
    mockExchangeManager.on = jest.fn();

    pipeline = new DataProcessingPipeline(mockExchangeManager, config);
  });

  afterEach(async () => {
    if (pipeline) {
      await pipeline.stop();
    }
  });

  describe('Pipeline Lifecycle', () => {
    it('should start and stop successfully', async () => {
      const startSpy = jest.fn();
      const stopSpy = jest.fn();
      
      pipeline.on('started', startSpy);
      pipeline.on('stopped', stopSpy);

      await pipeline.start();
      expect(startSpy).toHaveBeenCalled();

      await pipeline.stop();
      expect(stopSpy).toHaveBeenCalled();
    });

    it('should not start if already running', async () => {
      await pipeline.start();
      
      // Try to start again
      await expect(pipeline.start()).resolves.toBeUndefined();
      // Should not throw, just warn
    });

    it('should handle start failures gracefully', async () => {
      mockExchangeManager.initialize.mockRejectedValue(new Error('Connection failed'));
      
      await expect(pipeline.start()).rejects.toThrow('Connection failed');
    });
  });

  describe('Data Processing', () => {
    beforeEach(async () => {
      await pipeline.start();
    });

    describe('Candle Processing', () => {
      it('should process valid candle data', async () => {
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

        const result = await pipeline.processMarketData(validCandle, 'candle');
        expect(result).toBe(true);

        const metrics = pipeline.getMetrics();
        expect(metrics.processed.candles).toBe(1);
        expect(metrics.errors.validation).toBe(0);
      });

      it('should reject invalid candle data', async () => {
        const invalidCandle: CandleData = {
          symbol: '', // Invalid empty symbol
          timeframe: '1m',
          timestamp: Date.now(),
          open: -50000, // Invalid negative price
          high: 50100,
          low: 49900,
          close: 50050,
          volume: 1.5,
          exchange: 'binance',
        };

        const result = await pipeline.processMarketData(invalidCandle, 'candle');
        expect(result).toBe(false);

        const metrics = pipeline.getMetrics();
        expect(metrics.processed.candles).toBe(0);
        expect(metrics.errors.validation).toBe(1);
      });

      it('should emit events for processed data', (done) => {
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

        pipeline.on('dataProcessed', (event) => {
          expect(event.data).toEqual(validCandle);
          expect(event.type).toBe('candle');
          done();
        });

        pipeline.processMarketData(validCandle, 'candle');
      });
    });

    describe('Ticker Processing', () => {
      it('should process valid ticker data', async () => {
        const validTicker: TickerData = {
          symbol: 'BTCUSDT',
          exchange: 'binance',
          price: 50000,
          volume: 1000,
          timestamp: Date.now(),
          bid: 49995,
          ask: 50005,
        };

        const result = await pipeline.processMarketData(validTicker, 'ticker');
        expect(result).toBe(true);

        const metrics = pipeline.getMetrics();
        expect(metrics.processed.tickers).toBe(1);
      });

      it('should reject ticker with invalid spread', async () => {
        const invalidTicker: TickerData = {
          symbol: 'BTCUSDT',
          exchange: 'binance',
          price: 50000,
          volume: 1000,
          timestamp: Date.now(),
          bid: 50010, // Bid higher than ask
          ask: 50005,
        };

        const result = await pipeline.processMarketData(invalidTicker, 'ticker');
        expect(result).toBe(false);

        const metrics = pipeline.getMetrics();
        expect(metrics.errors.validation).toBe(1);
      });
    });

    describe('Order Book Processing', () => {
      it('should process valid order book data', async () => {
        const validOrderBook: OrderBookData = {
          symbol: 'BTCUSDT',
          exchange: 'binance',
          timestamp: Date.now(),
          bids: [
            [49995, 1.5],
            [49990, 2.0],
          ],
          asks: [
            [50005, 1.2],
            [50010, 1.8],
          ],
        };

        const result = await pipeline.processMarketData(validOrderBook, 'orderbook');
        expect(result).toBe(true);

        const metrics = pipeline.getMetrics();
        expect(metrics.processed.orderBooks).toBe(1);
      });

      it('should reject order book with crossed market', async () => {
        const invalidOrderBook: OrderBookData = {
          symbol: 'BTCUSDT',
          exchange: 'binance',
          timestamp: Date.now(),
          bids: [
            [50010, 1.5], // Bid higher than ask
          ],
          asks: [
            [50005, 1.2],
          ],
        };

        const result = await pipeline.processMarketData(invalidOrderBook, 'orderbook');
        expect(result).toBe(false);

        const metrics = pipeline.getMetrics();
        expect(metrics.errors.validation).toBe(1);
      });
    });

    describe('Trade Processing', () => {
      it('should process valid trade data', async () => {
        const validTrade: TradeData = {
          symbol: 'BTCUSDT',
          exchange: 'binance',
          timestamp: Date.now(),
          price: 50000,
          quantity: 1.5,
          side: 'buy',
          tradeId: '12345',
        };

        const result = await pipeline.processMarketData(validTrade, 'trade');
        expect(result).toBe(true);

        const metrics = pipeline.getMetrics();
        expect(metrics.processed.trades).toBe(1);
      });

      it('should reject trade with invalid side', async () => {
        const invalidTrade: TradeData = {
          symbol: 'BTCUSDT',
          exchange: 'binance',
          timestamp: Date.now(),
          price: 50000,
          quantity: 1.5,
          side: 'invalid' as any,
          tradeId: '12345',
        };

        const result = await pipeline.processMarketData(invalidTrade, 'trade');
        expect(result).toBe(false);

        const metrics = pipeline.getMetrics();
        expect(metrics.errors.validation).toBe(1);
      });
    });
  });

  describe('Bulk Processing', () => {
    beforeEach(async () => {
      await pipeline.start();
    });

    it('should handle bulk historical data processing', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT'];
      const timeframes: Timeframe[] = ['1m', '5m'];
      const startTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
      const endTime = Date.now();

      // Mock the market data service bulk fetch
      const mockBulkFetch = jest.fn().mockResolvedValue({
        BTCUSDT: {
          '1m': [
            {
              symbol: 'BTCUSDT',
              timeframe: '1m',
              timestamp: startTime,
              open: 50000,
              high: 50100,
              low: 49900,
              close: 50050,
              volume: 1.5,
              exchange: 'binance',
            },
          ],
          '5m': [],
        },
        ETHUSDT: {
          '1m': [],
          '5m': [],
        },
      });

      // Replace the method temporarily
      (pipeline as any).marketDataService.bulkHistoricalFetch = mockBulkFetch;

      const result = await pipeline.bulkProcessHistoricalData(
        symbols,
        timeframes,
        startTime,
        endTime
      );

      expect(result.success).toBe(true);
      expect(result.processed).toBeGreaterThan(0);
      expect(mockBulkFetch).toHaveBeenCalledWith(
        symbols,
        timeframes,
        startTime,
        endTime,
        undefined,
        expect.any(Function)
      );
    });

    it('should emit progress events during bulk processing', (done) => {
      const symbols = ['BTCUSDT'];
      const timeframes: Timeframe[] = ['1m'];
      const startTime = Date.now() - (60 * 60 * 1000);
      const endTime = Date.now();

      pipeline.on('bulkProgress', (progress) => {
        expect(progress).toHaveProperty('completed');
        expect(progress).toHaveProperty('total');
        expect(progress).toHaveProperty('current');
        done();
      });

      // Mock the bulk fetch to trigger progress
      (pipeline as any).marketDataService.bulkHistoricalFetch = jest.fn()
        .mockImplementation(async (_symbols, _timeframes, _startTime, _endTime, _exchange, onProgress) => {
          if (onProgress) {
            onProgress({ completed: 1, total: 1, current: 'BTCUSDT-1m' });
          }
          return { BTCUSDT: { '1m': [] } };
        });

      pipeline.bulkProcessHistoricalData(symbols, timeframes, startTime, endTime);
    });
  });

  describe('Metrics and Monitoring', () => {
    beforeEach(async () => {
      await pipeline.start();
    });

    it('should track processing metrics', async () => {
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

      await pipeline.processMarketData(validCandle, 'candle');

      const metrics = pipeline.getMetrics();
      expect(metrics.processed.candles).toBe(1);
      expect(metrics.performance.avgProcessingTime).toBeGreaterThan(0);
      expect(metrics.quality.validationRate).toBe(100);
      expect(metrics.quality.errorRate).toBe(0);
    });

    it('should calculate throughput correctly', async () => {
      const startTime = Date.now();
      
      // Process multiple items
      for (let i = 0; i < 5; i++) {
        const candle: CandleData = {
          symbol: 'BTCUSDT',
          timeframe: '1m',
          timestamp: startTime + (i * 60000),
          open: 50000,
          high: 50100,
          low: 49900,
          close: 50050,
          volume: 1.5,
          exchange: 'binance',
        };
        await pipeline.processMarketData(candle, 'candle');
      }

      const metrics = pipeline.getMetrics();
      expect(metrics.performance.throughput).toBeGreaterThan(0);
    });

    it('should track error rates', async () => {
      // Process valid data
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

      // Process invalid data
      const invalidCandle: CandleData = {
        symbol: '',
        timeframe: '1m',
        timestamp: Date.now(),
        open: -50000,
        high: 50100,
        low: 49900,
        close: 50050,
        volume: 1.5,
        exchange: 'binance',
      };

      await pipeline.processMarketData(validCandle, 'candle');
      await pipeline.processMarketData(invalidCandle, 'candle');

      const metrics = pipeline.getMetrics();
      expect(metrics.quality.errorRate).toBe(50); // 1 error out of 2 total
      expect(metrics.quality.validationRate).toBe(50); // 1 valid out of 2 total
    });
  });

  describe('Health Checks', () => {
    beforeEach(async () => {
      await pipeline.start();
    });

    it('should report healthy status when all systems are working', async () => {
      const health = await pipeline.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.checks.processing).toBe(true);
      expect(health.checks.marketDataService).toBe(true);
    });

    it('should report degraded status when some systems have issues', async () => {
      // Mock exchange connection failure
      mockExchangeManager.healthCheck.mockResolvedValue({ binance: false, kucoin: false });

      const health = await pipeline.healthCheck();
      
      expect(health.status).toBe('degraded');
      expect(health.checks.exchangeConnections).toBe(false);
    });

    it('should include metrics in health check', async () => {
      const health = await pipeline.healthCheck();
      
      expect(health.metrics).toBeDefined();
      expect(health.metrics.processed).toBeDefined();
      expect(health.metrics.errors).toBeDefined();
      expect(health.metrics.performance).toBeDefined();
      expect(health.metrics.quality).toBeDefined();
    });
  });

  describe('Data Quality Assessment', () => {
    beforeEach(async () => {
      await pipeline.start();
    });

    it('should generate data quality reports', async () => {
      const symbols = ['BTCUSDT'];
      const timeframes: Timeframe[] = ['1m', '5m'];

      // Mock the market data service quality assessment
      const mockAssessQuality = jest.fn().mockResolvedValue({
        completeness: 95.5,
        consistency: 98.2,
        freshness: 92.1,
        overall: 95.3,
        issues: ['Minor data lag detected'],
      });

      (pipeline as any).marketDataService.assessDataQuality = mockAssessQuality;

      const report = await pipeline.getDataQualityReport(symbols, timeframes);

      expect(report).toHaveProperty('BTCUSDT');
      expect(report.BTCUSDT).toHaveProperty('1m');
      expect(report.BTCUSDT).toHaveProperty('5m');
      expect(report.BTCUSDT['1m'].overall).toBe(95.3);
      expect(mockAssessQuality).toHaveBeenCalledTimes(2); // 1 symbol × 2 timeframes
    });

    it('should handle quality assessment errors gracefully', async () => {
      const symbols = ['BTCUSDT'];
      const timeframes: Timeframe[] = ['1m'];

      // Mock assessment failure
      const mockAssessQuality = jest.fn().mockRejectedValue(new Error('Assessment failed'));
      (pipeline as any).marketDataService.assessDataQuality = mockAssessQuality;

      const report = await pipeline.getDataQualityReport(symbols, timeframes);

      expect(report.BTCUSDT['1m']).toHaveProperty('error');
      expect(report.BTCUSDT['1m'].overall).toBe(0);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await pipeline.start();
    });

    it('should emit validation error events', (done) => {
      const invalidCandle: CandleData = {
        symbol: '',
        timeframe: '1m',
        timestamp: Date.now(),
        open: -50000,
        high: 50100,
        low: 49900,
        close: 50050,
        volume: 1.5,
        exchange: 'binance',
      };

      pipeline.on('validationError', (event) => {
        expect(event.data).toEqual(invalidCandle);
        expect(event.type).toBe('candle');
        done();
      });

      pipeline.processMarketData(invalidCandle, 'candle');
    });

    it('should emit processing error events', (done) => {
      // Mock processing to throw an error
      const originalProcessCandle = (pipeline as any).processCandle;
      (pipeline as any).processCandle = jest.fn().mockRejectedValue(new Error('Processing failed'));

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

      pipeline.on('processingError', (event) => {
        expect(event.data).toEqual(validCandle);
        expect(event.type).toBe('candle');
        expect(event.error).toBeDefined();
        
        // Restore original method
        (pipeline as any).processCandle = originalProcessCandle;
        done();
      });

      pipeline.processMarketData(validCandle, 'candle');
    });

    it('should handle unknown data types gracefully', async () => {
      const unknownData = { some: 'data' };
      
      const result = await pipeline.processMarketData(unknownData as any, 'unknown');
      expect(result).toBe(false);
    });
  });
});