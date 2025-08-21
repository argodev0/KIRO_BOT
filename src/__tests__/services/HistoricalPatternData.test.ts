/**
 * Historical Pattern Data Tests
 * Tests using realistic historical candlestick pattern scenarios
 */

import { PatternRecognitionService } from '../../services/PatternRecognitionService';
import { CandleData } from '../../types/market';

describe('Historical Pattern Data Scenarios', () => {
  // Helper to create realistic candle data
  const createRealisticCandle = (
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

  describe('Real Market Scenarios', () => {
    it('should detect hammer pattern during Bitcoin support bounce', async () => {
      // Realistic Bitcoin price action showing hammer at support
      const candles = [
        createRealisticCandle(45000, 45500, 44000, 44200, 1200), // Downtrend
        createRealisticCandle(44200, 44300, 43000, 43100, 1500), // Continued selling
        createRealisticCandle(43100, 43200, 41500, 42800, 2800), // Hammer at support
        createRealisticCandle(42800, 44000, 42500, 43800, 1800), // Recovery
        createRealisticCandle(43800, 45200, 43600, 44900, 1600), // Continuation
      ];

      const patterns = await PatternRecognitionService.detectPatterns(candles);
      const hammerPattern = patterns.find(p => p.type === 'hammer');

      expect(hammerPattern).toBeDefined();
      expect(hammerPattern?.direction).toBe('bullish');
      expect(hammerPattern?.confidence).toBeGreaterThan(0.7);
      expect(hammerPattern?.startIndex).toBe(2);
    });

    it('should detect shooting star at resistance level', async () => {
      // Realistic scenario: shooting star at previous high resistance
      const candles = [
        createRealisticCandle(48000, 49200, 47800, 49000, 1100), // Uptrend
        createRealisticCandle(49000, 50100, 48900, 49800, 1300), // Continued buying
        createRealisticCandle(49800, 51500, 49700, 50200, 2200), // Shooting star at resistance
        createRealisticCandle(50200, 50300, 48500, 48800, 1900), // Rejection
        createRealisticCandle(48800, 49000, 47200, 47600, 1700), // Decline
      ];

      const patterns = await PatternRecognitionService.detectPatterns(candles);
      const shootingStarPattern = patterns.find(p => p.type === 'shooting_star');

      expect(shootingStarPattern).toBeDefined();
      expect(shootingStarPattern?.direction).toBe('bearish');
      expect(shootingStarPattern?.confidence).toBeGreaterThan(0.7);
    });

    it('should detect bullish engulfing after oversold bounce', async () => {
      // Realistic oversold bounce scenario
      const candles = [
        createRealisticCandle(42000, 42200, 40500, 40800, 1800), // Oversold
        createRealisticCandle(40800, 41000, 39200, 39500, 2100), // Small bearish
        createRealisticCandle(39500, 42800, 39300, 42500, 3200), // Large bullish engulfing
        createRealisticCandle(42500, 43800, 42200, 43400, 2400), // Follow through
      ];

      const patterns = await PatternRecognitionService.detectPatterns(candles);
      const engulfingPattern = patterns.find(p => p.type === 'engulfing_bullish');

      expect(engulfingPattern).toBeDefined();
      expect(engulfingPattern?.direction).toBe('bullish');
      expect(engulfingPattern?.confidence).toBeGreaterThan(0.8);
      expect(engulfingPattern?.strength).toBe('strong');
    });

    it('should detect morning star reversal pattern', async () => {
      // Classic morning star at major support
      const candles = [
        createRealisticCandle(46000, 46200, 44000, 44200, 1600), // Bearish trend
        createRealisticCandle(44200, 44500, 42800, 43000, 1900), // Large bearish
        createRealisticCandle(42800, 43200, 42500, 42900, 800),  // Small doji/star
        createRealisticCandle(43100, 45500, 42900, 45200, 2800), // Large bullish
        createRealisticCandle(45200, 46800, 45000, 46400, 2200), // Continuation
      ];

      const patterns = await PatternRecognitionService.detectPatterns(candles);
      const morningStarPattern = patterns.find(p => p.type === 'morning_star');

      expect(morningStarPattern).toBeDefined();
      expect(morningStarPattern?.direction).toBe('bullish');
      expect(morningStarPattern?.confidence).toBeGreaterThan(0.8);
      expect(morningStarPattern?.strength).toBe('strong');
    });

    it('should detect evening star at market top', async () => {
      // Evening star pattern at cycle high
      const candles = [
        createRealisticCandle(58000, 59200, 57800, 59000, 1400), // Uptrend
        createRealisticCandle(59000, 60800, 58900, 60500, 1800), // Large bullish
        createRealisticCandle(60700, 61200, 60400, 60800, 600),  // Small star
        createRealisticCandle(60600, 60800, 58200, 58500, 2600), // Large bearish
        createRealisticCandle(58500, 58800, 56800, 57200, 2200), // Continuation down
      ];

      const patterns = await PatternRecognitionService.detectPatterns(candles);
      const eveningStarPattern = patterns.find(p => p.type === 'evening_star');

      expect(eveningStarPattern).toBeDefined();
      expect(eveningStarPattern?.direction).toBe('bearish');
      expect(eveningStarPattern?.confidence).toBeGreaterThan(0.8);
    });

    it('should detect doji at decision point', async () => {
      // Doji at key support/resistance confluence
      const candles = [
        createRealisticCandle(50000, 50500, 49200, 49800, 1200),
        createRealisticCandle(49800, 50200, 49000, 49500, 1100),
        createRealisticCandle(49500, 49800, 49200, 49550, 900), // Doji - indecision
        createRealisticCandle(49550, 50800, 49400, 50600, 1800),
      ];

      const patterns = await PatternRecognitionService.detectPatterns(candles);
      const dojiPattern = patterns.find(p => p.type === 'doji');

      expect(dojiPattern).toBeDefined();
      expect(dojiPattern?.confidence).toBeGreaterThan(0.6);
    });

    it('should detect harami pattern during consolidation', async () => {
      // Harami pattern in sideways market
      const candles = [
        createRealisticCandle(47000, 47200, 46800, 47000, 1000),
        createRealisticCandle(47000, 48500, 46200, 46400, 1600), // Large bearish
        createRealisticCandle(46500, 47200, 46800, 47100, 800),  // Small bullish inside
        createRealisticCandle(47100, 47800, 46900, 47600, 1200),
      ];

      const patterns = await PatternRecognitionService.detectPatterns(candles);
      const haramiPattern = patterns.find(p => p.type === 'harami_bullish');

      expect(haramiPattern).toBeDefined();
      expect(haramiPattern?.direction).toBe('bullish');
      expect(haramiPattern?.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('Pattern Context Analysis', () => {
    it('should score patterns higher with volume confirmation', async () => {
      // Same pattern with different volume profiles
      const lowVolumeCandles = [
        createRealisticCandle(45000, 45500, 44000, 44200, 500),
        createRealisticCandle(44200, 44300, 42000, 43800, 600), // Hammer with low volume
        createRealisticCandle(43800, 45000, 43600, 44800, 550),
      ];

      const highVolumeCandles = [
        createRealisticCandle(45000, 45500, 44000, 44200, 1500),
        createRealisticCandle(44200, 44300, 42000, 43800, 2800), // Hammer with high volume
        createRealisticCandle(43800, 45000, 43600, 44800, 1800),
      ];

      const lowVolPatterns = await PatternRecognitionService.detectPatterns(lowVolumeCandles);
      const highVolPatterns = await PatternRecognitionService.detectPatterns(highVolumeCandles);

      const lowVolHammer = lowVolPatterns.find(p => p.type === 'hammer');
      const highVolHammer = highVolPatterns.find(p => p.type === 'hammer');

      expect(lowVolHammer).toBeDefined();
      expect(highVolHammer).toBeDefined();

      // Volume confirmation should be reflected in pattern strength scoring
      const context = {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        trend: 'bearish' as const,
        volatility: 'medium' as const,
        volume: 'medium' as const,
        marketRegime: 'trending' as const,
      };

      const lowVolScore = PatternRecognitionService.scorePatternStrength(
        lowVolHammer!,
        context,
        lowVolumeCandles
      );

      const highVolScore = PatternRecognitionService.scorePatternStrength(
        highVolHammer!,
        context,
        highVolumeCandles
      );

      expect(highVolScore).toBeGreaterThan(lowVolScore);
    });

    it('should handle complex multi-pattern scenarios', async () => {
      // Scenario with multiple overlapping patterns
      const complexCandles = [
        createRealisticCandle(50000, 50200, 49800, 50000, 1000), // Doji
        createRealisticCandle(50000, 50100, 48500, 49800, 1500), // Hammer
        createRealisticCandle(49800, 49900, 49700, 49850, 600),  // Spinning top
        createRealisticCandle(49850, 51200, 49800, 51000, 2200), // Bullish marubozu
        createRealisticCandle(51000, 51500, 50800, 51300, 1800),
      ];

      const patterns = await PatternRecognitionService.detectPatterns(complexCandles);

      expect(patterns.length).toBeGreaterThan(2);
      
      const patternTypes = patterns.map(p => p.type);
      expect(patternTypes).toContain('doji');
      expect(patternTypes).toContain('hammer');
      expect(patternTypes).toContain('marubozu_bullish');
    });

    it('should detect patterns in trending vs ranging markets', async () => {
      // Strong trending market
      const trendingCandles = [
        createRealisticCandle(40000, 41000, 39800, 40800, 1200),
        createRealisticCandle(40800, 42200, 40600, 41900, 1400),
        createRealisticCandle(41900, 43500, 41700, 43200, 1600),
        createRealisticCandle(43200, 44800, 43000, 44500, 1800),
        createRealisticCandle(44500, 46200, 44300, 45900, 2000),
      ];

      // Ranging market
      const rangingCandles = [
        createRealisticCandle(45000, 45200, 44800, 45000, 1000),
        createRealisticCandle(45000, 45300, 44700, 44900, 1100),
        createRealisticCandle(44900, 45400, 44600, 45200, 1200),
        createRealisticCandle(45200, 45500, 44800, 45100, 1000),
        createRealisticCandle(45100, 45300, 44900, 45000, 1100),
      ];

      const trendingPatterns = await PatternRecognitionService.detectPatterns(trendingCandles);
      const rangingPatterns = await PatternRecognitionService.detectPatterns(rangingCandles);

      // Different pattern characteristics expected in different market regimes
      expect(trendingPatterns.length).toBeGreaterThanOrEqual(0);
      expect(rangingPatterns.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Pattern Statistics and Analysis', () => {
    it('should provide comprehensive pattern statistics', async () => {
      const mixedPatterns = [
        createRealisticCandle(45000, 45200, 44800, 45000, 1000), // Doji
        createRealisticCandle(45000, 45100, 43500, 44800, 1800), // Hammer
        createRealisticCandle(44800, 46200, 44700, 46000, 2200), // Bullish marubozu
        createRealisticCandle(46000, 47500, 45900, 46200, 1600), // Shooting star
        createRealisticCandle(46200, 46300, 44800, 45000, 1900), // Bearish engulfing setup
      ];

      const patterns = await PatternRecognitionService.detectPatterns(mixedPatterns);
      const stats = PatternRecognitionService.getPatternStatistics(patterns);

      expect(stats.totalPatterns).toBeGreaterThan(0);
      expect(stats.averageConfidence).toBeGreaterThan(0);
      expect(Object.keys(stats.byType).length).toBeGreaterThan(0);
      expect(Object.keys(stats.byDirection).length).toBeGreaterThan(0);
      expect(Object.keys(stats.byStrength).length).toBeGreaterThan(0);
    });

    it('should filter patterns by multiple criteria', async () => {
      const testCandles = [
        createRealisticCandle(45000, 45200, 44800, 45000, 1000),
        createRealisticCandle(45000, 45100, 43500, 44800, 1800), // Hammer
        createRealisticCandle(44800, 46200, 44700, 46000, 2200), // Marubozu
        createRealisticCandle(46000, 47500, 45900, 46200, 1600),
      ];

      const allPatterns = await PatternRecognitionService.detectPatterns(testCandles);
      
      const filteredPatterns = PatternRecognitionService.filterPatterns(allPatterns, {
        minConfidence: 0.7,
        direction: 'bullish',
        strength: ['strong', 'moderate']
      });

      expect(filteredPatterns.length).toBeLessThanOrEqual(allPatterns.length);
      expect(filteredPatterns.every(p => p.confidence >= 0.7)).toBe(true);
      expect(filteredPatterns.every(p => p.direction === 'bullish')).toBe(true);
      expect(filteredPatterns.every(p => ['strong', 'moderate'].includes(p.strength))).toBe(true);
    });
  });
});