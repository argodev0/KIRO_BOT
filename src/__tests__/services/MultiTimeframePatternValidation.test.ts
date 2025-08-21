/**
 * Multi-Timeframe Pattern Validation Tests
 * Tests for validating patterns across multiple timeframes
 */

import { PatternRecognitionService } from '../../services/PatternRecognitionService';
import { CandlestickPattern } from '../../types/analysis';
import { MarketDataService } from '../../services/MarketDataService';

// Mock MarketDataService
jest.mock('../../services/MarketDataService');
const mockMarketDataService = MarketDataService as jest.Mocked<typeof MarketDataService>;

describe('Multi-Timeframe Pattern Validation', () => {
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

  const createMockCandles = (count: number = 100) => {
    return Array.from({ length: count }, (_, index) => ({
      symbol: 'BTCUSDT',
      timeframe: '1h',
      timestamp: Date.now() + index * 3600000,
      open: 100 + Math.random() * 10,
      high: 105 + Math.random() * 10,
      low: 95 + Math.random() * 10,
      close: 100 + Math.random() * 10,
      volume: 1000 + Math.random() * 500,
    }));
  };

  const createMockCandlesWithPattern = (patternType: string, count: number = 100) => {
    const candles = createMockCandles(count);
    
    // Add a specific pattern in the middle of the data
    const midIndex = Math.floor(count / 2);
    
    if (patternType === 'hammer') {
      candles[midIndex] = {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: Date.now() + midIndex * 3600000,
        open: 100,
        high: 101,
        low: 90, // Long lower wick
        close: 99,
        volume: 1500,
      };
    } else if (patternType === 'doji') {
      candles[midIndex] = {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: Date.now() + midIndex * 3600000,
        open: 100,
        high: 105,
        low: 95,
        close: 100.1, // Very small body
        volume: 1200,
      };
    }
    
    return candles;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validatePatternAcrossTimeframes', () => {
    it('should validate pattern with high consensus across timeframes', async () => {
      const pattern = createTestPattern('hammer', 'bullish', 0.8);
      
      // Mock similar patterns found on higher timeframes
      mockMarketDataService.getHistoricalCandles
        .mockResolvedValueOnce(createMockCandlesWithPattern('hammer')) // 5m
        .mockResolvedValueOnce(createMockCandlesWithPattern('hammer')); // 15m

      // Mock pattern detection to return similar patterns
      const originalDetectPatterns = PatternRecognitionService.detectPatterns;
      jest.spyOn(PatternRecognitionService, 'detectPatterns').mockImplementation(async (candles) => {
        return [createTestPattern('hammer', 'bullish', 0.75)];
      });

      const result = await PatternRecognitionService.validatePatternAcrossTimeframes(
        pattern,
        'BTCUSDT',
        '1m',
        mockMarketDataService
      );

      expect(result.isValid).toBe(true);
      expect(result.timeframeConsensus).toBeGreaterThan(0.5);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.invalidationLevel).toBeDefined();

      // Restore original method
      jest.restoreAllMocks();
    });

    it('should invalidate pattern with low consensus across timeframes', async () => {
      const pattern = createTestPattern('hammer', 'bullish', 0.8);
      
      // Mock no similar patterns found on higher timeframes
      mockMarketDataService.getHistoricalCandles
        .mockResolvedValueOnce(createMockCandles()) // 5m - no pattern
        .mockResolvedValueOnce(createMockCandles()); // 15m - no pattern

      // Mock pattern detection to return no similar patterns
      jest.spyOn(PatternRecognitionService, 'detectPatterns').mockResolvedValue([]);

      const result = await PatternRecognitionService.validatePatternAcrossTimeframes(
        pattern,
        'BTCUSDT',
        '1m',
        mockMarketDataService
      );

      expect(result.isValid).toBe(false);
      expect(result.timeframeConsensus).toBe(0);
      expect(result.confidence).toBe(0);

      jest.restoreAllMocks();
    });

    it('should handle mixed consensus across timeframes', async () => {
      const pattern = createTestPattern('doji', 'bullish', 0.7);
      
      mockMarketDataService.getHistoricalCandles
        .mockResolvedValueOnce(createMockCandlesWithPattern('doji')) // 5m - has pattern
        .mockResolvedValueOnce(createMockCandles()); // 15m - no pattern

      // Mock pattern detection to return pattern for first call, none for second
      jest.spyOn(PatternRecognitionService, 'detectPatterns')
        .mockResolvedValueOnce([createTestPattern('doji', 'bullish', 0.65)])
        .mockResolvedValueOnce([]);

      const result = await PatternRecognitionService.validatePatternAcrossTimeframes(
        pattern,
        'BTCUSDT',
        '1m',
        mockMarketDataService
      );

      expect(result.timeframeConsensus).toBe(0.5); // 1 out of 2 timeframes
      expect(result.isValid).toBe(true); // 50% consensus is enough
      expect(result.confidence).toBeGreaterThan(0);

      jest.restoreAllMocks();
    });

    it('should handle different base timeframes correctly', async () => {
      const pattern = createTestPattern('engulfing_bullish', 'bullish', 0.85);
      
      // Test with 1h base timeframe (should check 4h and 1d)
      mockMarketDataService.getHistoricalCandles
        .mockResolvedValue(createMockCandles());

      jest.spyOn(PatternRecognitionService, 'detectPatterns')
        .mockResolvedValue([createTestPattern('engulfing_bullish', 'bullish', 0.8)]);

      const result = await PatternRecognitionService.validatePatternAcrossTimeframes(
        pattern,
        'BTCUSDT',
        '1h',
        mockMarketDataService
      );

      expect(result).toBeDefined();
      expect(mockMarketDataService.getHistoricalCandles).toHaveBeenCalledWith('BTCUSDT', '4h', 100);
      expect(mockMarketDataService.getHistoricalCandles).toHaveBeenCalledWith('BTCUSDT', '1d', 100);

      jest.restoreAllMocks();
    });

    it('should handle data access errors gracefully', async () => {
      const pattern = createTestPattern('hammer', 'bullish', 0.8);
      
      // Mock API failure
      mockMarketDataService.getHistoricalCandles.mockRejectedValue(
        new Error('API connection failed')
      );

      const result = await PatternRecognitionService.validatePatternAcrossTimeframes(
        pattern,
        'BTCUSDT',
        '1m',
        mockMarketDataService
      );

      expect(result.isValid).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.timeframeConsensus).toBe(0);
      expect(result.reason).toContain('Validation failed due to data access error');
    });

    it('should handle partial data access errors', async () => {
      const pattern = createTestPattern('shooting_star', 'bearish', 0.75);
      
      // Mock one successful call and one failure
      mockMarketDataService.getHistoricalCandles
        .mockResolvedValueOnce(createMockCandlesWithPattern('shooting_star'))
        .mockRejectedValueOnce(new Error('Timeout'));

      jest.spyOn(PatternRecognitionService, 'detectPatterns')
        .mockResolvedValue([createTestPattern('shooting_star', 'bearish', 0.7)]);

      const result = await PatternRecognitionService.validatePatternAcrossTimeframes(
        pattern,
        'BTCUSDT',
        '1m',
        mockMarketDataService
      );

      // Should still provide results based on available data
      expect(result).toBeDefined();
      expect(result.timeframeConsensus).toBeGreaterThan(0);

      jest.restoreAllMocks();
    });

    it('should calculate appropriate confidence scores', async () => {
      const pattern = createTestPattern('morning_star', 'bullish', 0.9);
      
      mockMarketDataService.getHistoricalCandles
        .mockResolvedValue(createMockCandles());

      // Mock high confidence patterns on higher timeframes
      jest.spyOn(PatternRecognitionService, 'detectPatterns')
        .mockResolvedValue([createTestPattern('morning_star', 'bullish', 0.85)]);

      const result = await PatternRecognitionService.validatePatternAcrossTimeframes(
        pattern,
        'BTCUSDT',
        '1m',
        mockMarketDataService
      );

      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.isValid).toBe(true);

      jest.restoreAllMocks();
    });

    it('should handle patterns with different confidence levels', async () => {
      const pattern = createTestPattern('harami_bullish', 'bullish', 0.6);
      
      mockMarketDataService.getHistoricalCandles
        .mockResolvedValue(createMockCandles());

      // Mock patterns with varying confidence levels
      jest.spyOn(PatternRecognitionService, 'detectPatterns')
        .mockResolvedValueOnce([createTestPattern('harami_bullish', 'bullish', 0.9)])
        .mockResolvedValueOnce([createTestPattern('harami_bullish', 'bullish', 0.4)]);

      const result = await PatternRecognitionService.validatePatternAcrossTimeframes(
        pattern,
        'BTCUSDT',
        '1m',
        mockMarketDataService
      );

      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.confidence).toBeLessThan(0.8);

      jest.restoreAllMocks();
    });

    it('should handle unsupported base timeframes', async () => {
      const pattern = createTestPattern('doji', 'bullish', 0.7);
      
      const result = await PatternRecognitionService.validatePatternAcrossTimeframes(
        pattern,
        'BTCUSDT',
        '1w', // Unsupported base timeframe
        mockMarketDataService
      );

      // Should still work but with limited validation
      expect(result).toBeDefined();
      expect(result.timeframeConsensus).toBe(0); // No higher timeframes to check
    });
  });

  describe('Multi-Timeframe Validation Edge Cases', () => {
    it('should handle empty pattern arrays from higher timeframes', async () => {
      const pattern = createTestPattern('spinning_top', 'bullish', 0.6);
      
      mockMarketDataService.getHistoricalCandles
        .mockResolvedValue(createMockCandles());

      jest.spyOn(PatternRecognitionService, 'detectPatterns')
        .mockResolvedValue([]); // No patterns found

      const result = await PatternRecognitionService.validatePatternAcrossTimeframes(
        pattern,
        'BTCUSDT',
        '5m',
        mockMarketDataService
      );

      expect(result.isValid).toBe(false);
      expect(result.timeframeConsensus).toBe(0);

      jest.restoreAllMocks();
    });

    it('should handle patterns with opposite directions', async () => {
      const pattern = createTestPattern('engulfing_bullish', 'bullish', 0.8);
      
      mockMarketDataService.getHistoricalCandles
        .mockResolvedValue(createMockCandles());

      // Mock opposite direction pattern found on higher timeframe
      jest.spyOn(PatternRecognitionService, 'detectPatterns')
        .mockResolvedValue([createTestPattern('engulfing_bearish', 'bearish', 0.8)]);

      const result = await PatternRecognitionService.validatePatternAcrossTimeframes(
        pattern,
        'BTCUSDT',
        '15m',
        mockMarketDataService
      );

      expect(result.timeframeConsensus).toBe(0); // Different pattern type
      expect(result.isValid).toBe(false);

      jest.restoreAllMocks();
    });

    it('should handle very low confidence patterns', async () => {
      const pattern = createTestPattern('hammer', 'bullish', 0.1);
      
      mockMarketDataService.getHistoricalCandles
        .mockResolvedValue(createMockCandles());

      jest.spyOn(PatternRecognitionService, 'detectPatterns')
        .mockResolvedValue([createTestPattern('hammer', 'bullish', 0.05)]);

      const result = await PatternRecognitionService.validatePatternAcrossTimeframes(
        pattern,
        'BTCUSDT',
        '1m',
        mockMarketDataService
      );

      expect(result.confidence).toBeLessThan(0.2);
      expect(result.isValid).toBe(true); // Still valid if consensus is met

      jest.restoreAllMocks();
    });
  });
});