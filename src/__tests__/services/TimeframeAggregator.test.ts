/**
 * Timeframe Aggregator Tests
 */

import { TimeframeAggregator } from '../../services/TimeframeAggregator';
import { CandleData, Timeframe } from '../../types/market';

describe('TimeframeAggregator', () => {
  let aggregator: TimeframeAggregator;

  beforeEach(() => {
    aggregator = new TimeframeAggregator({
      sourceTimeframes: ['1m'],
      targetTimeframes: ['1m', '5m', '15m', '1h'],
      maxCandlesPerTimeframe: 100,
    });
  });

  describe('processCandle', () => {
    const baseCandle: CandleData = {
      symbol: 'BTCUSDT',
      timeframe: '1m',
      timestamp: 1640995200000, // 2022-01-01 00:00:00 UTC
      open: 50000,
      high: 50100,
      low: 49900,
      close: 50050,
      volume: 1.5,
      exchange: 'binance',
    };

    it('should process and store 1m candle', () => {
      aggregator.processCandle(baseCandle);

      const candles = aggregator.getCandles('BTCUSDT', '1m');
      expect(candles).toHaveLength(1);
      expect(candles[0]).toEqual(baseCandle);
    });

    it('should generate 5m aggregated candle from 1m candles', () => {
      // Process 5 consecutive 1m candles
      for (let i = 0; i < 5; i++) {
        const candle = {
          ...baseCandle,
          timestamp: baseCandle.timestamp + (i * 60000), // 1 minute intervals
          open: 50000 + (i * 10),
          high: 50100 + (i * 20),
          low: 49900 - (i * 20),
          close: 50050 + (i * 25),
          volume: 1.5,
        };
        aggregator.processCandle(candle);
      }

      const candles5m = aggregator.getCandles('BTCUSDT', '5m');
      expect(candles5m).toHaveLength(1);
      
      const aggregated = candles5m[0];
      expect(aggregated.symbol).toBe('BTCUSDT');
      expect(aggregated.timeframe).toBe('5m');
      expect(aggregated.timestamp).toBe(1640995200000); // Aligned to 5m boundary
      expect(aggregated.open).toBe(50000); // First candle's open
      expect(aggregated.close).toBe(50150); // Last candle's close
      expect(aggregated.high).toBe(50180); // Highest high
      expect(aggregated.low).toBe(49820); // Lowest low
      expect(aggregated.volume).toBe(7.5); // Sum of volumes
    });

    it('should update existing aggregated candle when new data arrives', () => {
      const firstCandle = { ...baseCandle };
      const secondCandle = {
        ...baseCandle,
        timestamp: baseCandle.timestamp + 60000, // 1 minute later
        open: 50050,
        high: 50200,
        low: 50000,
        close: 50150,
        volume: 2.0,
      };

      aggregator.processCandle(firstCandle);
      aggregator.processCandle(secondCandle);

      const candles5m = aggregator.getCandles('BTCUSDT', '5m');
      expect(candles5m).toHaveLength(1);
      
      const aggregated = candles5m[0];
      expect(aggregated.open).toBe(50000); // First candle's open
      expect(aggregated.close).toBe(50150); // Last candle's close
      expect(aggregated.high).toBe(50200); // Max high
      expect(aggregated.low).toBe(49900); // Min low
      expect(aggregated.volume).toBe(3.5); // Sum of volumes
    });

    it('should maintain chronological order', () => {
      const candles = [
        { ...baseCandle, timestamp: baseCandle.timestamp + 120000 }, // 2 minutes later
        { ...baseCandle, timestamp: baseCandle.timestamp + 60000 },  // 1 minute later
        { ...baseCandle, timestamp: baseCandle.timestamp },          // Original time
      ];

      candles.forEach(candle => aggregator.processCandle(candle));

      const stored = aggregator.getCandles('BTCUSDT', '1m');
      expect(stored).toHaveLength(3);
      
      // Should be sorted by timestamp
      for (let i = 1; i < stored.length; i++) {
        expect(stored[i].timestamp).toBeGreaterThan(stored[i - 1].timestamp);
      }
    });

    it('should handle multiple symbols independently', () => {
      const btcCandle = { ...baseCandle, symbol: 'BTCUSDT' };
      const ethCandle = { ...baseCandle, symbol: 'ETHUSDT' };

      aggregator.processCandle(btcCandle);
      aggregator.processCandle(ethCandle);

      expect(aggregator.getCandles('BTCUSDT', '1m')).toHaveLength(1);
      expect(aggregator.getCandles('ETHUSDT', '1m')).toHaveLength(1);
      expect(aggregator.getAvailableTimeframes('BTCUSDT')).toContain('1m');
      expect(aggregator.getAvailableTimeframes('ETHUSDT')).toContain('1m');
    });
  });

  describe('getCandles', () => {
    const baseCandle: CandleData = {
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

    it('should return empty array for unknown symbol', () => {
      const candles = aggregator.getCandles('UNKNOWN', '1m');
      expect(candles).toHaveLength(0);
    });

    it('should return limited number of candles when limit specified', () => {
      // Add multiple candles
      for (let i = 0; i < 10; i++) {
        aggregator.processCandle({
          ...baseCandle,
          timestamp: baseCandle.timestamp + (i * 60000),
        });
      }

      const candles = aggregator.getCandles('BTCUSDT', '1m', 5);
      expect(candles).toHaveLength(5);
      
      // Should return the most recent candles
      expect(candles[candles.length - 1].timestamp).toBe(baseCandle.timestamp + (9 * 60000));
    });

    it('should return all candles when no limit specified', () => {
      for (let i = 0; i < 5; i++) {
        aggregator.processCandle({
          ...baseCandle,
          timestamp: baseCandle.timestamp + (i * 60000),
        });
      }

      const candles = aggregator.getCandles('BTCUSDT', '1m');
      expect(candles).toHaveLength(5);
    });
  });

  describe('getMultiTimeframeCandles', () => {
    const baseCandle: CandleData = {
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

    it('should return data for multiple timeframes', () => {
      // Process enough candles to generate 5m and 15m data
      for (let i = 0; i < 15; i++) {
        aggregator.processCandle({
          ...baseCandle,
          timestamp: baseCandle.timestamp + (i * 60000),
          close: 50000 + i,
        });
      }

      const multiData = aggregator.getMultiTimeframeCandles('BTCUSDT', ['1m', '5m', '15m']);
      
      expect(multiData['1m']).toHaveLength(15);
      expect(multiData['5m']).toHaveLength(3); // 15 minutes / 5 = 3
      expect(multiData['15m']).toHaveLength(1); // 15 minutes / 15 = 1
    });

    it('should use default timeframes when none specified', () => {
      aggregator.processCandle(baseCandle);

      const multiData = aggregator.getMultiTimeframeCandles('BTCUSDT');
      
      expect(multiData).toHaveProperty('1m');
      expect(multiData).toHaveProperty('5m');
      expect(multiData).toHaveProperty('15m');
      expect(multiData).toHaveProperty('1h');
    });

    it('should apply limit to all timeframes', () => {
      for (let i = 0; i < 20; i++) {
        aggregator.processCandle({
          ...baseCandle,
          timestamp: baseCandle.timestamp + (i * 60000),
        });
      }

      const multiData = aggregator.getMultiTimeframeCandles('BTCUSDT', ['1m', '5m'], 3);
      
      expect(multiData['1m']).toHaveLength(3);
      expect(multiData['5m']).toHaveLength(3);
    });
  });

  describe('aggregateHistoricalCandles', () => {
    it('should aggregate 1m candles to 5m', () => {
      const candles1m: CandleData[] = [];
      const baseTime = 1640995200000; // Aligned to 5m boundary

      // Create 5 consecutive 1m candles
      for (let i = 0; i < 5; i++) {
        candles1m.push({
          symbol: 'BTCUSDT',
          timeframe: '1m',
          timestamp: baseTime + (i * 60000),
          open: 50000 + (i * 10),
          high: 50100 + (i * 20),
          low: 49900 - (i * 10),
          close: 50050 + (i * 15),
          volume: 2.0, // Fixed volume for easier calculation
          exchange: 'binance',
        });
      }

      const candles5m = aggregator.aggregateHistoricalCandles(candles1m, '1m', '5m');
      
      expect(candles5m).toHaveLength(1);
      
      const aggregated = candles5m[0];
      expect(aggregated.symbol).toBe('BTCUSDT');
      expect(aggregated.timeframe).toBe('5m');
      expect(aggregated.timestamp).toBe(baseTime);
      expect(aggregated.open).toBe(50000); // First candle's open
      expect(aggregated.close).toBe(50110); // Last candle's close
      expect(aggregated.high).toBe(50180); // Highest high
      expect(aggregated.low).toBe(49860); // Lowest low
      expect(aggregated.volume).toBe(10); // Sum of all volumes (5 * 2.0)
    });

    it('should handle multiple 5m periods', () => {
      const candles1m: CandleData[] = [];
      const baseTime = 1640995200000;

      // Create 10 consecutive 1m candles (2 x 5m periods)
      for (let i = 0; i < 10; i++) {
        candles1m.push({
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

      const candles5m = aggregator.aggregateHistoricalCandles(candles1m, '1m', '5m');
      
      expect(candles5m).toHaveLength(2);
      expect(candles5m[0].timestamp).toBe(baseTime);
      expect(candles5m[1].timestamp).toBe(baseTime + (5 * 60000));
    });

    it('should throw error for invalid timeframe aggregation', () => {
      const candles: CandleData[] = [
        {
          symbol: 'BTCUSDT',
          timeframe: '5m',
          timestamp: Date.now(),
          open: 50000,
          high: 50100,
          low: 49900,
          close: 50050,
          volume: 1.5,
          exchange: 'binance',
        }
      ];
      
      expect(() => {
        aggregator.aggregateHistoricalCandles(candles, '5m', '1m'); // Cannot aggregate to lower timeframe
      }).toThrow('Invalid timeframe aggregation');
    });

    it('should handle empty candle array', () => {
      const result = aggregator.aggregateHistoricalCandles([], '1m', '5m');
      expect(result).toHaveLength(0);
    });

    it('should sort input candles by timestamp', () => {
      const baseTime = 1640995200000;
      const candles1m: CandleData[] = [
        {
          symbol: 'BTCUSDT',
          timeframe: '1m',
          timestamp: baseTime + 120000, // 2 minutes
          open: 50020,
          high: 50120,
          low: 49920,
          close: 50070,
          volume: 1.0,
          exchange: 'binance',
        },
        {
          symbol: 'BTCUSDT',
          timeframe: '1m',
          timestamp: baseTime, // 0 minutes
          open: 50000,
          high: 50100,
          low: 49900,
          close: 50050,
          volume: 1.0,
          exchange: 'binance',
        },
        {
          symbol: 'BTCUSDT',
          timeframe: '1m',
          timestamp: baseTime + 60000, // 1 minute
          open: 50050,
          high: 50110,
          low: 49910,
          close: 50060,
          volume: 1.0,
          exchange: 'binance',
        },
      ];

      const candles5m = aggregator.aggregateHistoricalCandles(candles1m, '1m', '5m');
      
      expect(candles5m).toHaveLength(1);
      expect(candles5m[0].open).toBe(50000); // Should use first chronological candle's open
      expect(candles5m[0].close).toBe(50070); // Should use last chronological candle's close
    });
  });

  describe('canAggregate', () => {
    it('should return true for valid aggregations', () => {
      expect(aggregator.canAggregate('1m', '5m')).toBe(true);
      expect(aggregator.canAggregate('1m', '15m')).toBe(true);
      expect(aggregator.canAggregate('5m', '15m')).toBe(true);
      expect(aggregator.canAggregate('15m', '1h')).toBe(true);
    });

    it('should return false for invalid aggregations', () => {
      expect(aggregator.canAggregate('5m', '1m')).toBe(false); // Cannot aggregate to lower timeframe
      expect(aggregator.canAggregate('1m', '1h')).toBe(true); // Valid aggregation
      expect(aggregator.canAggregate('invalid' as Timeframe, '5m')).toBe(false);
    });
  });

  describe('cleanup', () => {
    const baseCandle: CandleData = {
      symbol: 'BTCUSDT',
      timeframe: '1m',
      timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
      open: 50000,
      high: 50100,
      low: 49900,
      close: 50050,
      volume: 1.5,
      exchange: 'binance',
    };

    it('should remove old candles for specific symbol', () => {
      const oldCandle = { ...baseCandle };
      const newCandle = { ...baseCandle, timestamp: Date.now() };

      aggregator.processCandle(oldCandle);
      aggregator.processCandle(newCandle);

      expect(aggregator.getCandles('BTCUSDT', '1m')).toHaveLength(2);

      aggregator.cleanup('BTCUSDT');

      const remaining = aggregator.getCandles('BTCUSDT', '1m');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].timestamp).toBe(newCandle.timestamp);
    });

    it('should remove old candles for all symbols when no symbol specified', () => {
      const oldCandle1 = { ...baseCandle, symbol: 'BTCUSDT' };
      const oldCandle2 = { ...baseCandle, symbol: 'ETHUSDT' };
      const newCandle = { ...baseCandle, symbol: 'BTCUSDT', timestamp: Date.now() };

      aggregator.processCandle(oldCandle1);
      aggregator.processCandle(oldCandle2);
      aggregator.processCandle(newCandle);

      aggregator.cleanup();

      expect(aggregator.getCandles('BTCUSDT', '1m')).toHaveLength(1);
      expect(aggregator.getCandles('ETHUSDT', '1m')).toHaveLength(0);
    });
  });

  describe('getStatistics', () => {
    it('should return aggregation statistics', () => {
      const candle1 = {
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

      const candle2 = {
        ...candle1,
        symbol: 'ETHUSDT',
      };

      aggregator.processCandle(candle1);
      aggregator.processCandle(candle2);

      const stats = aggregator.getStatistics();

      expect(stats.totalSymbols).toBe(2);
      expect(stats.symbolStats).toHaveProperty('BTCUSDT');
      expect(stats.symbolStats).toHaveProperty('ETHUSDT');
      expect(stats.symbolStats.BTCUSDT.timeframes).toBeGreaterThan(0);
      expect(stats.symbolStats.BTCUSDT.totalCandles).toBeGreaterThan(0);
    });
  });
});