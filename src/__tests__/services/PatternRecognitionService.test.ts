/**
 * Pattern Recognition Service Tests
 * Comprehensive test suite for candlestick pattern detection and analysis
 */

import { PatternRecognitionService } from '../../services/PatternRecognitionService';
import { CandleData, MarketContext } from '../../types/market';
import { CandlestickPattern } from '../../types/analysis';

describe('PatternRecognitionService', () => {
  // Test data factory
  const createCandle = (
    open: number,
    high: number,
    low: number,
    close: number,
    volume: number = 1000,
    timestamp: number = Date.now()
  ): CandleData => ({
    symbol: 'BTCUSDT',
    timeframe: '1h',
    timestamp,
    open,
    high,
    low,
    close,
    volume,
  });

  const createMarketContext = (
    trend: 'bullish' | 'bearish' | 'sideways' = 'sideways',
    volatility: 'low' | 'medium' | 'high' = 'medium'
  ): MarketContext => ({
    symbol: 'BTCUSDT',
    timeframe: '1h',
    trend,
    volatility,
    volume: 'medium',
    marketRegime: 'ranging',
  });

  describe('detectPatterns', () => {
    it('should detect hammer pattern', async () => {
      const candles = [
        createCandle(100, 105, 95, 98), // Previous candle (bearish)
        createCandle(98, 99, 90, 97),   // Hammer pattern
        createCandle(97, 102, 96, 101), // Next candle
      ];

      const patterns = await PatternRecognitionService.detectPatterns(candles);
      const hammerPattern = patterns.find(p => p.type === 'hammer');

      expect(hammerPattern).toBeDefined();
      expect(hammerPattern?.direction).toBe('bullish');
      expect(hammerPattern?.confidence).toBeGreaterThan(0.7);
      expect(hammerPattern?.startIndex).toBe(1);
      expect(hammerPattern?.endIndex).toBe(1);
    });

    it('should detect doji pattern', async () => {
      const candles = [
        createCandle(100, 105, 95, 98),
        createCandle(98, 102, 94, 98.1), // Doji pattern (small body)
        createCandle(98, 103, 96, 101),
      ];

      const patterns = await PatternRecognitionService.detectPatterns(candles);
      const dojiPattern = patterns.find(p => p.type === 'long_legged_doji');

      expect(dojiPattern).toBeDefined();
      expect(dojiPattern?.confidence).toBeGreaterThan(0.6);
    });

    it('should detect dragonfly doji pattern', async () => {
      const candles = [
        createCandle(100, 105, 95, 98),
        createCandle(98, 98.5, 90, 98.1), // Dragonfly doji (long lower wick)
        createCandle(98, 103, 96, 101),
      ];

      const patterns = await PatternRecognitionService.detectPatterns(candles);
      const dragonflyPattern = patterns.find(p => p.type === 'dragonfly_doji');

      expect(dragonflyPattern).toBeDefined();
      expect(dragonflyPattern?.direction).toBe('bullish');
      expect(dragonflyPattern?.confidence).toBeGreaterThan(0.7);
    });

    it('should detect gravestone doji pattern', async () => {
      const candles = [
        createCandle(100, 105, 95, 102),
        createCandle(102, 110, 101.5, 102.1), // Gravestone doji (long upper wick)
        createCandle(102, 103, 96, 99),
      ];

      const patterns = await PatternRecognitionService.detectPatterns(candles);
      const gravestonePattern = patterns.find(p => p.type === 'gravestone_doji');

      expect(gravestonePattern).toBeDefined();
      expect(gravestonePattern?.confidence).toBeGreaterThan(0.7);
    });

    it('should detect shooting star pattern', async () => {
      const candles = [
        createCandle(95, 100, 94, 99),   // Previous uptrend candle
        createCandle(99, 108, 98, 100),  // Shooting star (long upper wick)
        createCandle(100, 102, 96, 97),
      ];

      const patterns = await PatternRecognitionService.detectPatterns(candles);
      const shootingStarPattern = patterns.find(p => p.type === 'shooting_star');

      expect(shootingStarPattern).toBeDefined();
      expect(shootingStarPattern?.direction).toBe('bearish');
      expect(shootingStarPattern?.confidence).toBeGreaterThan(0.7);
    });

    it('should detect inverted hammer pattern', async () => {
      const candles = [
        createCandle(100, 102, 95, 96),  // Previous downtrend candle
        createCandle(96, 104, 95, 97),   // Inverted hammer (long upper wick)
        createCandle(97, 102, 96, 101),
      ];

      const patterns = await PatternRecognitionService.detectPatterns(candles);
      const invertedHammerPattern = patterns.find(p => p.type === 'inverted_hammer');

      expect(invertedHammerPattern).toBeDefined();
      expect(invertedHammerPattern?.direction).toBe('bullish');
      expect(invertedHammerPattern?.confidence).toBeGreaterThan(0.7);
    });

    it('should detect spinning top pattern', async () => {
      const candles = [
        createCandle(100, 105, 95, 98),
        createCandle(98, 102, 94, 99),   // Spinning top (small body, long wicks)
        createCandle(99, 104, 96, 101),
      ];

      const patterns = await PatternRecognitionService.detectPatterns(candles);
      const spinningTopPattern = patterns.find(p => p.type === 'spinning_top');

      expect(spinningTopPattern).toBeDefined();
      expect(spinningTopPattern?.confidence).toBeGreaterThan(0.5);
    });

    it('should detect bullish marubozu pattern', async () => {
      const candles = [
        createCandle(100, 105, 95, 98),
        createCandle(98, 108, 98, 108),  // Bullish marubozu (no wicks)
        createCandle(108, 112, 106, 110),
      ];

      const patterns = await PatternRecognitionService.detectPatterns(candles);
      const marubozuPattern = patterns.find(p => p.type === 'marubozu_bullish');

      expect(marubozuPattern).toBeDefined();
      expect(marubozuPattern?.direction).toBe('bullish');
      expect(marubozuPattern?.confidence).toBeGreaterThan(0.8);
      expect(marubozuPattern?.strength).toBe('strong');
    });

    it('should detect bearish marubozu pattern', async () => {
      const candles = [
        createCandle(100, 105, 95, 102),
        createCandle(102, 102, 92, 92),  // Bearish marubozu (no wicks)
        createCandle(92, 95, 88, 90),
      ];

      const patterns = await PatternRecognitionService.detectPatterns(candles);
      const marubozuPattern = patterns.find(p => p.type === 'marubozu_bearish');

      expect(marubozuPattern).toBeDefined();
      expect(marubozuPattern?.direction).toBe('bearish');
      expect(marubozuPattern?.confidence).toBeGreaterThan(0.8);
      expect(marubozuPattern?.strength).toBe('strong');
    });

    it('should detect bullish engulfing pattern', async () => {
      const candles = [
        createCandle(100, 102, 98, 99),  // Small bearish candle
        createCandle(98, 105, 97, 104),  // Large bullish candle engulfing previous
        createCandle(104, 108, 102, 106),
      ];

      const patterns = await PatternRecognitionService.detectPatterns(candles);
      const engulfingPattern = patterns.find(p => p.type === 'engulfing_bullish');

      expect(engulfingPattern).toBeDefined();
      expect(engulfingPattern?.direction).toBe('bullish');
      expect(engulfingPattern?.confidence).toBeGreaterThan(0.8);
      expect(engulfingPattern?.startIndex).toBe(0);
      expect(engulfingPattern?.endIndex).toBe(1);
    });

    it('should detect bearish engulfing pattern', async () => {
      const candles = [
        createCandle(100, 103, 99, 102),  // Small bullish candle
        createCandle(103, 104, 96, 97),   // Large bearish candle engulfing previous
        createCandle(97, 99, 94, 95),
      ];

      const patterns = await PatternRecognitionService.detectPatterns(candles);
      const engulfingPattern = patterns.find(p => p.type === 'engulfing_bearish');

      expect(engulfingPattern).toBeDefined();
      expect(engulfingPattern?.direction).toBe('bearish');
      expect(engulfingPattern?.confidence).toBeGreaterThan(0.8);
    });

    it('should detect bullish harami pattern', async () => {
      const candles = [
        createCandle(100, 102, 95, 96),   // Large bearish candle
        createCandle(97, 99, 96.5, 98.5), // Small bullish candle inside previous
        createCandle(98, 102, 97, 101),
      ];

      const patterns = await PatternRecognitionService.detectPatterns(candles);
      const haramiPattern = patterns.find(p => p.type === 'harami_bullish');

      expect(haramiPattern).toBeDefined();
      expect(haramiPattern?.direction).toBe('bullish');
      expect(haramiPattern?.confidence).toBeGreaterThan(0.7);
    });

    it('should detect bearish harami pattern', async () => {
      const candles = [
        createCandle(95, 105, 94, 104),   // Large bullish candle
        createCandle(103, 103.5, 101, 102), // Small bearish candle inside previous
        createCandle(102, 103, 98, 99),
      ];

      const patterns = await PatternRecognitionService.detectPatterns(candles);
      const haramiPattern = patterns.find(p => p.type === 'harami_bearish');

      expect(haramiPattern).toBeDefined();
      expect(haramiPattern?.direction).toBe('bearish');
      expect(haramiPattern?.confidence).toBeGreaterThan(0.7);
    });

    it('should detect morning star pattern', async () => {
      const candles = [
        createCandle(100, 102, 95, 96),   // Large bearish candle
        createCandle(95, 96, 93, 94),     // Small star candle (gap down)
        createCandle(95, 103, 94, 102),   // Large bullish candle
        createCandle(102, 106, 101, 105),
      ];

      const patterns = await PatternRecognitionService.detectPatterns(candles);
      const morningStarPattern = patterns.find(p => p.type === 'morning_star');

      expect(morningStarPattern).toBeDefined();
      expect(morningStarPattern?.direction).toBe('bullish');
      expect(morningStarPattern?.confidence).toBeGreaterThan(0.8);
      expect(morningStarPattern?.strength).toBe('strong');
      expect(morningStarPattern?.startIndex).toBe(0);
      expect(morningStarPattern?.endIndex).toBe(2);
    });

    it('should detect evening star pattern', async () => {
      const candles = [
        createCandle(95, 105, 94, 104),   // Large bullish candle
        createCandle(105, 107, 104, 106), // Small star candle (gap up)
        createCandle(105, 106, 98, 99),   // Large bearish candle
        createCandle(99, 101, 96, 97),
      ];

      const patterns = await PatternRecognitionService.detectPatterns(candles);
      const eveningStarPattern = patterns.find(p => p.type === 'evening_star');

      expect(eveningStarPattern).toBeDefined();
      expect(eveningStarPattern?.direction).toBe('bearish');
      expect(eveningStarPattern?.confidence).toBeGreaterThan(0.8);
      expect(eveningStarPattern?.strength).toBe('strong');
    });

    it('should handle insufficient candle data', async () => {
      const candles = [
        createCandle(100, 105, 95, 98),
        createCandle(98, 102, 96, 101),
      ];

      await expect(PatternRecognitionService.detectPatterns(candles))
        .rejects.toThrow('Minimum 3 candles required for pattern detection');
    });

    it('should filter weak patterns when requested', async () => {
      const candles = [
        createCandle(100, 105, 95, 98),
        createCandle(98, 102, 94, 99),   // Spinning top (moderate strength)
        createCandle(99, 104, 96, 101),
      ];

      const patternsWithWeak = await PatternRecognitionService.detectPatterns(candles, {
        includeWeakPatterns: true
      });
      
      const patternsWithoutWeak = await PatternRecognitionService.detectPatterns(candles, {
        includeWeakPatterns: false
      });

      expect(patternsWithWeak.length).toBeGreaterThanOrEqual(patternsWithoutWeak.length);
    });
  });

  describe('scorePatternStrength', () => {
    it('should increase score for high volume confirmation', () => {
      const pattern: CandlestickPattern = {
        type: 'hammer',
        confidence: 0.8,
        startIndex: 1,
        endIndex: 1,
        direction: 'bullish',
        strength: 'strong',
        description: 'Test hammer',
        reliability: 0.8,
      };

      const context = createMarketContext('bearish', 'medium');
      
      // High volume candles
      const highVolumeCandles = [
        createCandle(100, 105, 95, 98, 1000),
        createCandle(98, 99, 90, 97, 2000), // High volume on pattern candle
        createCandle(97, 102, 96, 101, 1000),
      ];

      const score = PatternRecognitionService.scorePatternStrength(pattern, context, highVolumeCandles);
      expect(score).toBeGreaterThan(pattern.confidence);
    });

    it('should increase score for trend alignment with reversal patterns', () => {
      const bullishPattern: CandlestickPattern = {
        type: 'hammer',
        confidence: 0.8,
        startIndex: 1,
        endIndex: 1,
        direction: 'bullish',
        strength: 'strong',
        description: 'Test hammer',
        reliability: 0.8,
      };

      const bearishContext = createMarketContext('bearish', 'medium');
      const candles = [
        createCandle(100, 105, 95, 98),
        createCandle(98, 99, 90, 97),
        createCandle(97, 102, 96, 101),
      ];

      const score = PatternRecognitionService.scorePatternStrength(bullishPattern, bearishContext, candles);
      expect(score).toBeGreaterThan(bullishPattern.confidence);
    });

    it('should adjust score based on market volatility', () => {
      const pattern: CandlestickPattern = {
        type: 'doji',
        confidence: 0.7,
        startIndex: 1,
        endIndex: 1,
        direction: 'bullish',
        strength: 'moderate',
        description: 'Test doji',
        reliability: 0.7,
      };

      const candles = [
        createCandle(100, 105, 95, 98),
        createCandle(98, 102, 94, 98.1),
        createCandle(98, 103, 96, 101),
      ];

      const lowVolContext = createMarketContext('sideways', 'low');
      const highVolContext = createMarketContext('sideways', 'high');

      const lowVolScore = PatternRecognitionService.scorePatternStrength(pattern, lowVolContext, candles);
      const highVolScore = PatternRecognitionService.scorePatternStrength(pattern, highVolContext, candles);

      expect(lowVolScore).toBeGreaterThan(highVolScore);
    });
  });

  describe('getPatternStatistics', () => {
    it('should calculate correct pattern statistics', () => {
      const patterns: CandlestickPattern[] = [
        {
          type: 'hammer',
          confidence: 0.8,
          startIndex: 1,
          endIndex: 1,
          direction: 'bullish',
          strength: 'strong',
          description: 'Test hammer',
          reliability: 0.8,
        },
        {
          type: 'doji',
          confidence: 0.6,
          startIndex: 2,
          endIndex: 2,
          direction: 'bullish',
          strength: 'moderate',
          description: 'Test doji',
          reliability: 0.6,
        },
        {
          type: 'hammer',
          confidence: 0.7,
          startIndex: 3,
          endIndex: 3,
          direction: 'bearish',
          strength: 'moderate',
          description: 'Test hammer 2',
          reliability: 0.7,
        },
      ];

      const stats = PatternRecognitionService.getPatternStatistics(patterns);

      expect(stats.totalPatterns).toBe(3);
      expect(stats.byType.hammer).toBe(2);
      expect(stats.byType.doji).toBe(1);
      expect(stats.byDirection.bullish).toBe(2);
      expect(stats.byDirection.bearish).toBe(1);
      expect(stats.byStrength.strong).toBe(1);
      expect(stats.byStrength.moderate).toBe(2);
      expect(stats.averageConfidence).toBeCloseTo(0.7);
    });

    it('should handle empty pattern array', () => {
      const stats = PatternRecognitionService.getPatternStatistics([]);
      
      expect(stats.totalPatterns).toBe(0);
      expect(stats.averageConfidence).toBe(0);
      expect(Object.keys(stats.byType)).toHaveLength(0);
    });
  });

  describe('filterPatterns', () => {
    const testPatterns: CandlestickPattern[] = [
      {
        type: 'hammer',
        confidence: 0.8,
        startIndex: 1,
        endIndex: 1,
        direction: 'bullish',
        strength: 'strong',
        description: 'Test hammer',
        reliability: 0.8,
      },
      {
        type: 'doji',
        confidence: 0.6,
        startIndex: 2,
        endIndex: 2,
        direction: 'bullish',
        strength: 'moderate',
        description: 'Test doji',
        reliability: 0.6,
      },
      {
        type: 'shooting_star',
        confidence: 0.7,
        startIndex: 3,
        endIndex: 3,
        direction: 'bearish',
        strength: 'moderate',
        description: 'Test shooting star',
        reliability: 0.7,
      },
    ];

    it('should filter by pattern types', () => {
      const filtered = PatternRecognitionService.filterPatterns(testPatterns, {
        types: ['hammer', 'doji']
      });

      expect(filtered).toHaveLength(2);
      expect(filtered.every(p => ['hammer', 'doji'].includes(p.type))).toBe(true);
    });

    it('should filter by minimum confidence', () => {
      const filtered = PatternRecognitionService.filterPatterns(testPatterns, {
        minConfidence: 0.75
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe('hammer');
    });

    it('should filter by direction', () => {
      const filtered = PatternRecognitionService.filterPatterns(testPatterns, {
        direction: 'bullish'
      });

      expect(filtered).toHaveLength(2);
      expect(filtered.every(p => p.direction === 'bullish')).toBe(true);
    });

    it('should filter by strength', () => {
      const filtered = PatternRecognitionService.filterPatterns(testPatterns, {
        strength: ['strong']
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].strength).toBe('strong');
    });

    it('should apply multiple filters', () => {
      const filtered = PatternRecognitionService.filterPatterns(testPatterns, {
        direction: 'bullish',
        minConfidence: 0.7,
        strength: ['strong']
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe('hammer');
    });
  });
});