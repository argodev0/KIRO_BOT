/**
 * Market Data Service Tests
 * Comprehensive tests for market data ingestion and processing pipeline
 */

import { DataValidator } from '../../services/DataValidator';
import { TimeframeAggregator } from '../../services/TimeframeAggregator';
import { CandleData, TickerData, OrderBookData, TradeData } from '../../types/market';

describe('MarketDataService Core Components', () => {
  describe('DataValidator Integration', () => {
    let validator: DataValidator;

    beforeEach(() => {
      validator = new DataValidator();
    });

    it('should validate market data correctly', () => {
      const validCandle: CandleData = {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        timestamp: Date.now() - 60000,
        open: 50000,
        high: 50100,
        low: 49900,
        close: 50050,
        volume: 1.5,
        exchange: 'binance',
      };

      expect(validator.validateCandle(validCandle)).toBe(true);
    });

    it('should reject invalid market data', () => {
      const invalidCandle: CandleData = {
        symbol: '',
        timeframe: '1m',
        timestamp: Date.now() - 60000,
        open: -50000, // Invalid negative price
        high: 50100,
        low: 49900,
        close: 50050,
        volume: 1.5,
        exchange: 'binance',
      };

      expect(validator.validateCandle(invalidCandle)).toBe(false);
    });

    it('should validate ticker data', () => {
      const validTicker: TickerData = {
        symbol: 'BTCUSDT',
        exchange: 'binance',
        price: 50000,
        volume: 1000,
        timestamp: Date.now(),
        bid: 49995,
        ask: 50005,
      };

      expect(validator.validateTicker(validTicker)).toBe(true);
    });

    it('should validate order book data', () => {
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

      expect(validator.validateOrderBook(validOrderBook)).toBe(true);
    });

    it('should validate trade data', () => {
      const validTrade: TradeData = {
        symbol: 'BTCUSDT',
        exchange: 'binance',
        timestamp: Date.now(),
        price: 50000,
        quantity: 1.5,
        side: 'buy',
        tradeId: '12345',
      };

      expect(validator.validateTrade(validTrade)).toBe(true);
    });
  });

  describe('TimeframeAggregator Integration', () => {
    let aggregator: TimeframeAggregator;

    beforeEach(() => {
      aggregator = new TimeframeAggregator({
        sourceTimeframes: ['1m'],
        targetTimeframes: ['1m', '5m', '15m', '1h'],
        maxCandlesPerTimeframe: 100,
      });
    });

    it('should process and store candles', () => {
      const candle: CandleData = {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        timestamp: 1640995200000, // Aligned timestamp
        open: 50000,
        high: 50100,
        low: 49900,
        close: 50050,
        volume: 1.5,
        exchange: 'binance',
      };

      aggregator.processCandle(candle);

      const stored = aggregator.getCandles('BTCUSDT', '1m');
      expect(stored).toHaveLength(1);
      expect(stored[0]).toEqual(candle);
    });

    it('should aggregate candles to higher timeframes', () => {
      const baseTime = 1640995200000; // Aligned to 5m boundary

      // Process 5 consecutive 1m candles
      for (let i = 0; i < 5; i++) {
        const candle: CandleData = {
          symbol: 'BTCUSDT',
          timeframe: '1m',
          timestamp: baseTime + (i * 60000),
          open: 50000 + (i * 10),
          high: 50100 + (i * 20),
          low: 49900 - (i * 10),
          close: 50050 + (i * 15),
          volume: 1.0,
          exchange: 'binance',
        };
        aggregator.processCandle(candle);
      }

      const candles1m = aggregator.getCandles('BTCUSDT', '1m');
      const candles5m = aggregator.getCandles('BTCUSDT', '5m');

      expect(candles1m).toHaveLength(5);
      expect(candles5m).toHaveLength(1);

      const aggregated = candles5m[0];
      expect(aggregated.symbol).toBe('BTCUSDT');
      expect(aggregated.timeframe).toBe('5m');
      expect(aggregated.open).toBe(50000); // First candle's open
      expect(aggregated.close).toBe(50110); // Last candle's close
      expect(aggregated.volume).toBe(5.0); // Sum of volumes
    });

    it('should handle multi-timeframe data retrieval', () => {
      const candle: CandleData = {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        timestamp: 1640995200000,
        open: 50000,
        high: 50100,
        low: 49900,
        close: 50050,
        volume: 1.5,
        exchange: 'binance',
      };

      aggregator.processCandle(candle);

      const multiData = aggregator.getMultiTimeframeCandles('BTCUSDT', ['1m', '5m']);
      
      expect(multiData).toHaveProperty('1m');
      expect(multiData).toHaveProperty('5m');
      expect(multiData['1m']).toHaveLength(1);
    });

    it('should validate timeframe aggregation capabilities', () => {
      expect(aggregator.canAggregate('1m', '5m')).toBe(true);
      expect(aggregator.canAggregate('5m', '15m')).toBe(true);
      expect(aggregator.canAggregate('5m', '1m')).toBe(false); // Cannot aggregate to lower timeframe
    });
  });

  describe('Data Processing Pipeline', () => {
    let validator: DataValidator;
    let aggregator: TimeframeAggregator;

    beforeEach(() => {
      validator = new DataValidator();
      aggregator = new TimeframeAggregator();
    });

    it('should process valid data through the pipeline', () => {
      const rawCandle: CandleData = {
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

      // Validate data
      const isValid = validator.validateCandle(rawCandle);
      expect(isValid).toBe(true);

      // Process through aggregator if valid
      if (isValid) {
        aggregator.processCandle(rawCandle);
        const stored = aggregator.getCandles('BTCUSDT', '1m');
        expect(stored).toHaveLength(1);
      }
    });

    it('should reject invalid data in the pipeline', () => {
      const invalidCandle: CandleData = {
        symbol: '',
        timeframe: '1m',
        timestamp: Date.now(),
        open: -50000, // Invalid
        high: 50100,
        low: 49900,
        close: 50050,
        volume: 1.5,
        exchange: 'binance',
      };

      // Validate data
      const isValid = validator.validateCandle(invalidCandle);
      expect(isValid).toBe(false);

      // Should not process invalid data
      if (!isValid) {
        // Data would be rejected before reaching aggregator
        const stored = aggregator.getCandles('BTCUSDT', '1m');
        expect(stored).toHaveLength(0);
      }
    });

    it('should track data quality metrics', () => {
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

      // Process both valid and invalid data
      validator.validateCandle(validCandle);
      validator.validateCandle(invalidCandle);

      const metrics = validator.getQualityMetrics('candles');
      expect(metrics.totalRecords).toBe(2);
      expect(metrics.validRecords).toBe(1);
      expect(metrics.invalidRecords).toBe(1);
      expect(metrics.validationRate).toBe(50);
    });
  });

  describe('Advanced Data Validation', () => {
    let validator: DataValidator;

    beforeEach(() => {
      validator = new DataValidator();
    });

    describe('Candle Sequence Validation', () => {
      it('should validate proper candle sequence', () => {
        const candles: CandleData[] = [
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
        ];

        const result = validator.validateCandleSequence(candles);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect duplicate timestamps', () => {
        const candles: CandleData[] = [
          {
            symbol: 'BTCUSDT',
            timeframe: '1m',
            timestamp: 1640995200000,
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
            timestamp: 1640995200000, // Same timestamp
            open: 50050,
            high: 50150,
            low: 49950,
            close: 50100,
            volume: 1.8,
            exchange: 'binance',
          },
        ];

        const result = validator.validateCandleSequence(candles);
        expect(result.warnings.some(w => w.includes('Duplicate timestamp'))).toBe(true);
      });

      it('should detect large price gaps', () => {
        const candles: CandleData[] = [
          {
            symbol: 'BTCUSDT',
            timeframe: '1m',
            timestamp: 1640995200000,
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
            timestamp: 1640995260000,
            open: 100000, // 100% price jump (more than 50% threshold)
            high: 100100,
            low: 99900,
            close: 100050,
            volume: 1.8,
            exchange: 'binance',
          },
        ];

        const result = validator.validateCandleSequence(candles);
        expect(result.warnings.some(w => w.includes('Large price gap'))).toBe(true);
      });
    });

    describe('Order Book Validation', () => {
      it('should validate proper bid-ask ordering', () => {
        const orderBook: OrderBookData = {
          symbol: 'BTCUSDT',
          exchange: 'binance',
          timestamp: Date.now(),
          bids: [
            [50000, 1.5], // Highest bid first
            [49995, 2.0],
            [49990, 1.8],
          ],
          asks: [
            [50005, 1.2], // Lowest ask first
            [50010, 1.8],
            [50015, 2.1],
          ],
        };

        const result = validator.validateOrderBookDetailed(orderBook);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect incorrect bid ordering', () => {
        const orderBook: OrderBookData = {
          symbol: 'BTCUSDT',
          exchange: 'binance',
          timestamp: Date.now(),
          bids: [
            [49990, 1.5], // Should be descending
            [50000, 2.0], // This is wrong order
          ],
          asks: [
            [50005, 1.2],
            [50010, 1.8],
          ],
        };

        const result = validator.validateOrderBookDetailed(orderBook);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('not in descending order'))).toBe(true);
      });

      it('should detect crossed market (bid >= ask)', () => {
        const orderBook: OrderBookData = {
          symbol: 'BTCUSDT',
          exchange: 'binance',
          timestamp: Date.now(),
          bids: [
            [50010, 1.5], // Bid higher than ask
          ],
          asks: [
            [50005, 1.2], // Ask lower than bid
          ],
        };

        const result = validator.validateOrderBookDetailed(orderBook);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('greater than or equal to best ask'))).toBe(true);
      });
    });

    describe('Data Quality Metrics', () => {
      it('should track validation metrics across data types', () => {
        const validTicker: TickerData = {
          symbol: 'BTCUSDT',
          exchange: 'binance',
          price: 50000,
          volume: 1000,
          timestamp: Date.now(),
          bid: 49995,
          ask: 50005,
        };

        const invalidTicker: TickerData = {
          symbol: '',
          exchange: 'binance',
          price: -50000, // Invalid
          volume: 1000,
          timestamp: Date.now(),
          bid: 49995,
          ask: 50005,
        };

        validator.validateTicker(validTicker);
        validator.validateTicker(invalidTicker);

        const tickerMetrics = validator.getQualityMetrics('tickers');
        expect(tickerMetrics.totalRecords).toBe(2);
        expect(tickerMetrics.validRecords).toBe(1);
        expect(tickerMetrics.invalidRecords).toBe(1);
        expect(tickerMetrics.validationRate).toBe(50);
        expect(tickerMetrics.commonErrors).toHaveProperty('Missing or invalid symbol');
      });

      it('should reset metrics when requested', () => {
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

        validator.validateCandle(validCandle);
        let metrics = validator.getQualityMetrics('candles');
        expect(metrics.totalRecords).toBe(1);

        validator.resetQualityMetrics('candles');
        metrics = validator.getQualityMetrics('candles');
        expect(metrics.totalRecords).toBe(0);
      });
    });
  });

  describe('Multi-Timeframe Aggregation', () => {
    let aggregator: TimeframeAggregator;

    beforeEach(() => {
      aggregator = new TimeframeAggregator({
        sourceTimeframes: ['1m'],
        targetTimeframes: ['1m', '5m', '15m', '1h'],
        maxCandlesPerTimeframe: 100,
      });
    });

    describe('Historical Aggregation', () => {
      it('should aggregate 1m candles to 5m', () => {
        const baseTime = 1640995200000; // Aligned to 5m boundary
        const sourceCandles: CandleData[] = [];

        // Create 5 consecutive 1m candles
        for (let i = 0; i < 5; i++) {
          sourceCandles.push({
            symbol: 'BTCUSDT',
            timeframe: '1m',
            timestamp: baseTime + (i * 60000),
            open: 50000 + (i * 10),
            high: 50100 + (i * 20),
            low: 49900 - (i * 10),
            close: 50050 + (i * 15),
            volume: 1.0,
            exchange: 'binance',
          });
        }

        const aggregated = aggregator.aggregateHistoricalCandles(sourceCandles, '1m', '5m');
        
        expect(aggregated).toHaveLength(1);
        
        const candle = aggregated[0];
        expect(candle.symbol).toBe('BTCUSDT');
        expect(candle.timeframe).toBe('5m');
        expect(candle.timestamp).toBe(baseTime);
        expect(candle.open).toBe(50000); // First candle's open
        expect(candle.close).toBe(50110); // Last candle's close
        expect(candle.high).toBe(50180); // Max of all highs
        expect(candle.low).toBe(49860); // Min of all lows
        expect(candle.volume).toBe(5.0); // Sum of all volumes
      });

      it('should handle partial periods correctly', () => {
        const baseTime = 1640995200000;
        const sourceCandles: CandleData[] = [];

        // Create 7 candles (1 complete 5m + 2 partial)
        for (let i = 0; i < 7; i++) {
          sourceCandles.push({
            symbol: 'BTCUSDT',
            timeframe: '1m',
            timestamp: baseTime + (i * 60000),
            open: 50000,
            high: 50100,
            low: 49900,
            close: 50050,
            volume: 1.0,
            exchange: 'binance',
          });
        }

        const aggregated = aggregator.aggregateHistoricalCandles(sourceCandles, '1m', '5m');
        
        expect(aggregated).toHaveLength(2);
        expect(aggregated[0].volume).toBe(5.0); // Complete period
        expect(aggregated[1].volume).toBe(2.0); // Partial period
      });

      it('should validate aggregation compatibility', () => {
        expect(aggregator.canAggregate('1m', '5m')).toBe(true);
        expect(aggregator.canAggregate('5m', '15m')).toBe(true);
        expect(aggregator.canAggregate('1h', '4h')).toBe(true);
        expect(aggregator.canAggregate('5m', '1m')).toBe(false); // Cannot aggregate down
      });
    });

    describe('Real-time Aggregation', () => {
      it('should update existing candles when new data arrives', () => {
        const baseTime = 1640995200000; // Aligned to 5m boundary

        // First candle in the 5m period
        const candle1: CandleData = {
          symbol: 'BTCUSDT',
          timeframe: '1m',
          timestamp: baseTime,
          open: 50000,
          high: 50100,
          low: 49900,
          close: 50050,
          volume: 1.0,
          exchange: 'binance',
        };

        aggregator.processCandle(candle1);
        let candles5m = aggregator.getCandles('BTCUSDT', '5m');
        expect(candles5m).toHaveLength(1);
        expect(candles5m[0].volume).toBe(1.0);

        // Second candle in the same 5m period
        const candle2: CandleData = {
          symbol: 'BTCUSDT',
          timeframe: '1m',
          timestamp: baseTime + 60000,
          open: 50050,
          high: 50200,
          low: 49800,
          close: 50100,
          volume: 1.5,
          exchange: 'binance',
        };

        aggregator.processCandle(candle2);
        candles5m = aggregator.getCandles('BTCUSDT', '5m');
        expect(candles5m).toHaveLength(1);
        expect(candles5m[0].volume).toBe(2.5); // Updated volume
        expect(candles5m[0].high).toBe(50200); // Updated high
        expect(candles5m[0].low).toBe(49800); // Updated low
        expect(candles5m[0].close).toBe(50100); // Latest close
      });

      it('should emit events for aggregated candles', (done) => {
        const baseTime = 1640995200000;

        aggregator.on('aggregatedCandle', (candle: CandleData) => {
          expect(candle.timeframe).toBe('5m');
          expect(candle.symbol).toBe('BTCUSDT');
          done();
        });

        const candle: CandleData = {
          symbol: 'BTCUSDT',
          timeframe: '1m',
          timestamp: baseTime,
          open: 50000,
          high: 50100,
          low: 49900,
          close: 50050,
          volume: 1.0,
          exchange: 'binance',
        };

        aggregator.processCandle(candle);
      });
    });

    describe('Memory Management', () => {
      it('should limit candles per timeframe', () => {
        const baseTime = 1640995200000;

        // Add more candles than the limit
        for (let i = 0; i < 150; i++) {
          const candle: CandleData = {
            symbol: 'BTCUSDT',
            timeframe: '1m',
            timestamp: baseTime + (i * 60000),
            open: 50000,
            high: 50100,
            low: 49900,
            close: 50050,
            volume: 1.0,
            exchange: 'binance',
          };
          aggregator.processCandle(candle);
        }

        const candles = aggregator.getCandles('BTCUSDT', '1m');
        expect(candles.length).toBeLessThanOrEqual(100); // Should respect limit
      });

      it('should provide cleanup functionality', () => {
        const candle: CandleData = {
          symbol: 'BTCUSDT',
          timeframe: '1m',
          timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
          open: 50000,
          high: 50100,
          low: 49900,
          close: 50050,
          volume: 1.0,
          exchange: 'binance',
        };

        aggregator.processCandle(candle);
        expect(aggregator.getCandles('BTCUSDT', '1m')).toHaveLength(1);

        aggregator.cleanup('BTCUSDT');
        expect(aggregator.getCandles('BTCUSDT', '1m')).toHaveLength(0); // Old data cleaned up
      });
    });

    describe('Statistics and Monitoring', () => {
      it('should provide aggregation statistics', () => {
        const candle: CandleData = {
          symbol: 'BTCUSDT',
          timeframe: '1m',
          timestamp: Date.now(),
          open: 50000,
          high: 50100,
          low: 49900,
          close: 50050,
          volume: 1.0,
          exchange: 'binance',
        };

        aggregator.processCandle(candle);

        const stats = aggregator.getStatistics();
        expect(stats.totalSymbols).toBe(1);
        expect(stats.symbolStats).toHaveProperty('BTCUSDT');
        expect(stats.symbolStats.BTCUSDT.timeframes).toBeGreaterThan(0);
        expect(stats.symbolStats.BTCUSDT.totalCandles).toBeGreaterThan(0);
      });
    });
  });
});