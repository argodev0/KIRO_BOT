/**
 * Pattern Invalidation Monitoring Tests
 * Tests for pattern invalidation detection and alerting system
 */

import { PatternRecognitionService } from '../../services/PatternRecognitionService';
import { CandlestickPattern } from '../../types/analysis';
import { MarketDataService } from '../../services/MarketDataService';

// Mock MarketDataService
jest.mock('../../services/MarketDataService');
const mockMarketDataService = MarketDataService as jest.Mocked<typeof MarketDataService>;

describe('Pattern Invalidation Monitoring', () => {
  const createTestPattern = (
    type: any,
    direction: 'bullish' | 'bearish',
    confidence: number = 0.8
  ): CandlestickPattern => ({
    type,
    confidence,
    startIndex: 1,
    endIndex: 1,
    direction,
    strength: 'strong',
    description: `Test ${type} pattern`,
    reliability: confidence,
  });

  const createMockCandles = (prices: number[]) => {
    return prices.map((price, index) => ({
      symbol: 'BTCUSDT',
      timeframe: '1h',
      timestamp: Date.now() + index * 3600000,
      open: price,
      high: price + 2,
      low: price - 2,
      close: price,
      volume: 1000,
    }));
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('monitorPatternInvalidation', () => {
    it('should detect invalidated bullish hammer pattern', async () => {
      const patterns = [createTestPattern('hammer', 'bullish')];
      
      // Mock candles showing price breaking below invalidation level
      const mockCandles = createMockCandles([100, 99, 98, 97, 96, 95, 94, 93, 92, 85]);
      mockMarketDataService.getHistoricalCandles.mockResolvedValue(mockCandles);

      const result = await PatternRecognitionService.monitorPatternInvalidation(
        patterns,
        'BTCUSDT',
        '1h',
        mockMarketDataService
      );

      expect(result.invalidatedPatterns).toHaveLength(1);
      expect(result.invalidatedPatterns[0].type).toBe('hammer');
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0]).toContain('Pattern hammer invalidated');
    });

    it('should detect invalidated bearish shooting star pattern', async () => {
      const patterns = [createTestPattern('shooting_star', 'bearish')];
      
      // Mock candles showing price breaking above invalidation level
      const mockCandles = createMockCandles([100, 101, 102, 103, 104, 105, 106, 107, 108, 115]);
      mockMarketDataService.getHistoricalCandles.mockResolvedValue(mockCandles);

      const result = await PatternRecognitionService.monitorPatternInvalidation(
        patterns,
        'BTCUSDT',
        '1h',
        mockMarketDataService
      );

      expect(result.invalidatedPatterns).toHaveLength(1);
      expect(result.invalidatedPatterns[0].type).toBe('shooting_star');
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0]).toContain('Pattern shooting_star invalidated');
    });

    it('should not invalidate patterns within acceptable range', async () => {
      const patterns = [
        createTestPattern('hammer', 'bullish'),
        createTestPattern('doji', 'bullish'),
      ];
      
      // Mock candles showing price staying within acceptable range
      const mockCandles = createMockCandles([100, 99, 98, 99, 100, 101, 100, 99, 98, 99]);
      mockMarketDataService.getHistoricalCandles.mockResolvedValue(mockCandles);

      const result = await PatternRecognitionService.monitorPatternInvalidation(
        patterns,
        'BTCUSDT',
        '1h',
        mockMarketDataService
      );

      expect(result.invalidatedPatterns).toHaveLength(0);
      expect(result.alerts).toHaveLength(0);
    });

    it('should handle multiple pattern invalidations', async () => {
      const patterns = [
        createTestPattern('hammer', 'bullish'),
        createTestPattern('engulfing_bullish', 'bullish'),
        createTestPattern('morning_star', 'bullish'),
      ];
      
      // Mock candles showing significant price drop invalidating all bullish patterns
      const mockCandles = createMockCandles([100, 99, 98, 97, 96, 95, 90, 85, 80, 75]);
      mockMarketDataService.getHistoricalCandles.mockResolvedValue(mockCandles);

      const result = await PatternRecognitionService.monitorPatternInvalidation(
        patterns,
        'BTCUSDT',
        '1h',
        mockMarketDataService
      );

      expect(result.invalidatedPatterns.length).toBeGreaterThan(0);
      expect(result.alerts.length).toBeGreaterThan(0);
      expect(result.invalidatedPatterns.every(p => p.direction === 'bullish')).toBe(true);
    });

    it('should handle data access errors gracefully', async () => {
      const patterns = [createTestPattern('hammer', 'bullish')];
      
      mockMarketDataService.getHistoricalCandles.mockRejectedValue(
        new Error('API connection failed')
      );

      const result = await PatternRecognitionService.monitorPatternInvalidation(
        patterns,
        'BTCUSDT',
        '1h',
        mockMarketDataService
      );

      expect(result.invalidatedPatterns).toHaveLength(0);
      expect(result.alerts).toHaveLength(0);
    });

    it('should handle empty candle data', async () => {
      const patterns = [createTestPattern('hammer', 'bullish')];
      
      mockMarketDataService.getHistoricalCandles.mockResolvedValue([]);

      const result = await PatternRecognitionService.monitorPatternInvalidation(
        patterns,
        'BTCUSDT',
        '1h',
        mockMarketDataService
      );

      expect(result.invalidatedPatterns).toHaveLength(0);
      expect(result.alerts).toHaveLength(0);
    });

    it('should calculate different invalidation levels for different pattern types', async () => {
      const hammerPattern = createTestPattern('hammer', 'bullish');
      const shootingStarPattern = createTestPattern('shooting_star', 'bearish');
      
      const mockCandles = createMockCandles([100, 99, 98, 97, 96, 95, 94, 93, 92, 91]);
      mockMarketDataService.getHistoricalCandles.mockResolvedValue(mockCandles);

      // Test hammer invalidation
      const hammerResult = await PatternRecognitionService.monitorPatternInvalidation(
        [hammerPattern],
        'BTCUSDT',
        '1h',
        mockMarketDataService
      );

      // Test shooting star invalidation (should require price to go up, not down)
      const shootingStarResult = await PatternRecognitionService.monitorPatternInvalidation(
        [shootingStarPattern],
        'BTCUSDT',
        '1h',
        mockMarketDataService
      );

      // Hammer should be invalidated by downward price movement
      expect(hammerResult.invalidatedPatterns).toHaveLength(1);
      
      // Shooting star should NOT be invalidated by downward price movement
      expect(shootingStarResult.invalidatedPatterns).toHaveLength(0);
    });

    it('should provide detailed alert messages', async () => {
      const pattern = createTestPattern('engulfing_bullish', 'bullish', 0.85);
      
      const mockCandles = createMockCandles([100, 99, 98, 97, 96, 95, 90, 85, 80, 75]);
      mockMarketDataService.getHistoricalCandles.mockResolvedValue(mockCandles);

      const result = await PatternRecognitionService.monitorPatternInvalidation(
        [pattern],
        'BTCUSDT',
        '1h',
        mockMarketDataService
      );

      expect(result.alerts).toHaveLength(1);
      const alert = result.alerts[0];
      
      expect(alert).toContain('Pattern engulfing_bullish invalidated');
      expect(alert).toContain('BTCUSDT');
      expect(alert).toContain('price 75');
      expect(alert).toContain('Invalidation level');
    });
  });

  describe('Pattern Invalidation Edge Cases', () => {
    it('should handle patterns with zero confidence', async () => {
      const pattern = createTestPattern('doji', 'bullish', 0);
      
      const mockCandles = createMockCandles([100, 95, 90, 85, 80]);
      mockMarketDataService.getHistoricalCandles.mockResolvedValue(mockCandles);

      const result = await PatternRecognitionService.monitorPatternInvalidation(
        [pattern],
        'BTCUSDT',
        '1h',
        mockMarketDataService
      );

      // Should still process the pattern even with zero confidence
      expect(result).toBeDefined();
      expect(Array.isArray(result.invalidatedPatterns)).toBe(true);
      expect(Array.isArray(result.alerts)).toBe(true);
    });

    it('should handle very volatile market conditions', async () => {
      const pattern = createTestPattern('hammer', 'bullish');
      
      // Highly volatile candles with large price swings
      const mockCandles = [
        { symbol: 'BTCUSDT', timeframe: '1h', timestamp: Date.now(), open: 100, high: 120, low: 80, close: 110, volume: 1000 },
        { symbol: 'BTCUSDT', timeframe: '1h', timestamp: Date.now(), open: 110, high: 130, low: 90, close: 95, volume: 1000 },
        { symbol: 'BTCUSDT', timeframe: '1h', timestamp: Date.now(), open: 95, high: 115, low: 75, close: 105, volume: 1000 },
      ];
      mockMarketDataService.getHistoricalCandles.mockResolvedValue(mockCandles);

      const result = await PatternRecognitionService.monitorPatternInvalidation(
        [pattern],
        'BTCUSDT',
        '1h',
        mockMarketDataService
      );

      // Should handle volatile conditions without throwing errors
      expect(result).toBeDefined();
      expect(typeof result.invalidatedPatterns).toBe('object');
      expect(typeof result.alerts).toBe('object');
    });

    it('should handle patterns at market extremes', async () => {
      const pattern = createTestPattern('hammer', 'bullish');
      
      // Candles with extreme price levels
      const mockCandles = createMockCandles([0.001, 0.0009, 0.0008, 0.0007, 0.0006]);
      mockMarketDataService.getHistoricalCandles.mockResolvedValue(mockCandles);

      const result = await PatternRecognitionService.monitorPatternInvalidation(
        [pattern],
        'BTCUSDT',
        '1h',
        mockMarketDataService
      );

      expect(result).toBeDefined();
      expect(result.invalidatedPatterns).toBeDefined();
      expect(result.alerts).toBeDefined();
    });
  });
});