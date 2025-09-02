/**
 * Linear Regression Analyzer Tests
 * Unit tests for linear regression analysis and trend probability calculation
 */

import { LinearRegressionAnalyzer } from '../../../services/indicators/LinearRegressionAnalyzer';
import { CandleData } from '../../../types/market';

// Mock data generators
const generateTrendingCandles = (count: number, trend: 'up' | 'down' = 'up', strength: number = 0.01): CandleData[] => {
  const candles: CandleData[] = [];
  let currentPrice = 100;
  const startTime = Date.now() - (count * 3600000);
  const trendDirection = trend === 'up' ? 1 : -1;

  for (let i = 0; i < count; i++) {
    const trendMove = currentPrice * strength * trendDirection;
    const noise = (Math.random() - 0.5) * 0.005 * currentPrice; // 0.5% noise
    
    const open = currentPrice;
    const close = currentPrice + trendMove + noise;
    const high = Math.max(open, close) + Math.random() * 0.002 * currentPrice;
    const low = Math.min(open, close) - Math.random() * 0.002 * currentPrice;
    const volume = 1000 + Math.random() * 2000;

    candles.push({
      symbol: 'BTCUSDT',
      timeframe: '1h',
      timestamp: startTime + (i * 3600000),
      open,
      high,
      low,
      close,
      volume,
    });

    currentPrice = close;
  }

  return candles;
};

const generateSidewaysCandles = (count: number): CandleData[] => {
  const candles: CandleData[] = [];
  const basePrice = 100;
  const startTime = Date.now() - (count * 3600000);

  for (let i = 0; i < count; i++) {
    const noise = (Math.random() - 0.5) * 0.02 * basePrice; // 2% noise around base price
    
    const open = basePrice + noise;
    const close = basePrice + (Math.random() - 0.5) * 0.01 * basePrice;
    const high = Math.max(open, close) + Math.random() * 0.005 * basePrice;
    const low = Math.min(open, close) - Math.random() * 0.005 * basePrice;
    const volume = 1000 + Math.random() * 2000;

    candles.push({
      symbol: 'BTCUSDT',
      timeframe: '1h',
      timestamp: startTime + (i * 3600000),
      open,
      high,
      low,
      close,
      volume,
    });
  }

  return candles;
};

describe('LinearRegressionAnalyzer', () => {
  let analyzer: LinearRegressionAnalyzer;

  beforeEach(() => {
    analyzer = new LinearRegressionAnalyzer({
      period: 20,
      confidenceInterval: 0.95,
      trendProbabilityThreshold: 0.7,
    });
  });

  describe('Initialization', () => {
    it('should initialize with configuration', () => {
      const config = analyzer.getConfig();
      
      expect(config.period).toBe(20);
      expect(config.confidenceInterval).toBe(0.95);
      expect(config.trendProbabilityThreshold).toBe(0.7);
    });

    it('should update configuration', () => {
      analyzer.updateConfig({
        period: 30,
        trendProbabilityThreshold: 0.8,
      });

      const config = analyzer.getConfig();
      expect(config.period).toBe(30);
      expect(config.trendProbabilityThreshold).toBe(0.8);
      expect(config.confidenceInterval).toBe(0.95); // Should remain unchanged
    });
  });

  describe('Trend Line Calculation', () => {
    it('should calculate trend line for uptrending data', async () => {
      const upTrendCandles = generateTrendingCandles(50, 'up', 0.01);
      const trendLine = await analyzer.calculateTrendLine(upTrendCandles);

      expect(trendLine).toBeDefined();
      expect(trendLine.slope).toBeGreaterThan(0); // Positive slope for uptrend
      expect(trendLine.direction).toBe('bullish');
      expect(trendLine.correlation).toBeGreaterThan(0.5); // Should have positive correlation
      expect(trendLine.rSquared).toBeGreaterThan(0.3); // Should have reasonable fit
      expect(trendLine.strength).toBeGreaterThan(0.5); // Should be reasonably strong
      expect(trendLine.startPrice).toBeDefined();
      expect(trendLine.endPrice).toBeGreaterThan(trendLine.startPrice);
    });

    it('should calculate trend line for downtrending data', async () => {
      const downTrendCandles = generateTrendingCandles(50, 'down', 0.01);
      const trendLine = await analyzer.calculateTrendLine(downTrendCandles);

      expect(trendLine.slope).toBeLessThan(0); // Negative slope for downtrend
      expect(trendLine.direction).toBe('bearish');
      expect(trendLine.correlation).toBeLessThan(-0.5); // Should have negative correlation
      expect(trendLine.endPrice).toBeLessThan(trendLine.startPrice);
    });

    it('should calculate trend line for sideways data', async () => {
      const sidewaysCandles = generateSidewaysCandles(50);
      const trendLine = await analyzer.calculateTrendLine(sidewaysCandles);

      expect(Math.abs(trendLine.slope)).toBeLessThan(0.1); // Should have small slope
      expect(Math.abs(trendLine.correlation)).toBeLessThan(0.5); // Should have weak correlation
      expect(trendLine.rSquared).toBeLessThan(0.3); // Should have poor fit for random data
    });

    it('should throw error for insufficient data', async () => {
      const shortCandles = generateTrendingCandles(10); // Less than required period
      
      await expect(analyzer.calculateTrendLine(shortCandles))
        .rejects.toThrow('Insufficient data for linear regression');
    });
  });

  describe('Trend Probability Analysis', () => {
    it('should analyze trend probabilities for strong uptrend', async () => {
      const strongUpTrend = generateTrendingCandles(50, 'up', 0.02);
      const trendLine = await analyzer.calculateTrendLine(strongUpTrend);
      const probability = await analyzer.analyzeTrendProbability(strongUpTrend, trendLine);

      expect(probability).toBeDefined();
      expect(probability.continuationProbability).toBeGreaterThan(0.6); // High continuation probability
      expect(probability.reversalProbability).toBeLessThan(0.4); // Low reversal probability
      expect(probability.breakoutProbability).toBeGreaterThanOrEqual(0);
      expect(probability.confidence).toBeGreaterThan(0.5);
      expect(probability.timeHorizon).toBeGreaterThan(0);
    });

    it('should analyze trend probabilities for weak trend', async () => {
      const weakTrend = generateTrendingCandles(50, 'up', 0.001); // Very weak trend
      const trendLine = await analyzer.calculateTrendLine(weakTrend);
      const probability = await analyzer.analyzeTrendProbability(weakTrend, trendLine);

      expect(probability.continuationProbability).toBeLessThan(0.8); // Lower continuation probability
      expect(probability.reversalProbability).toBeGreaterThan(0.2); // Higher reversal probability
      expect(probability.confidence).toBeLessThan(0.9); // Lower confidence
    });

    it('should analyze trend probabilities for sideways market', async () => {
      const sidewaysCandles = generateSidewaysCandles(50);
      const trendLine = await analyzer.calculateTrendLine(sidewaysCandles);
      const probability = await analyzer.analyzeTrendProbability(sidewaysCandles, trendLine);

      expect(probability.breakoutProbability).toBeGreaterThan(0.3); // Higher breakout probability
      expect(probability.continuationProbability).toBeLessThan(0.7); // Lower continuation probability
      expect(probability.confidence).toBeLessThan(0.8); // Lower confidence for sideways
    });

    it('should have probabilities that sum to reasonable range', async () => {
      const candles = generateTrendingCandles(50, 'up');
      const trendLine = await analyzer.calculateTrendLine(candles);
      const probability = await analyzer.analyzeTrendProbability(candles, trendLine);

      // Probabilities don't need to sum to 1 as they represent different scenarios
      expect(probability.continuationProbability).toBeGreaterThanOrEqual(0);
      expect(probability.continuationProbability).toBeLessThanOrEqual(1);
      expect(probability.reversalProbability).toBeGreaterThanOrEqual(0);
      expect(probability.reversalProbability).toBeLessThanOrEqual(1);
      expect(probability.breakoutProbability).toBeGreaterThanOrEqual(0);
      expect(probability.breakoutProbability).toBeLessThanOrEqual(1);
    });
  });

  describe('Confidence Bands Calculation', () => {
    it('should calculate confidence bands', async () => {
      const candles = generateTrendingCandles(50, 'up');
      const trendLine = await analyzer.calculateTrendLine(candles);
      const confidenceBands = await analyzer.calculateConfidenceBands(candles, trendLine);

      expect(Array.isArray(confidenceBands)).toBe(true);
      expect(confidenceBands.length).toBe(20); // Should match the period

      for (const band of confidenceBands) {
        expect(band.upper).toBeGreaterThan(band.lower);
        expect(band.confidence).toBe(0.95); // Should match configured confidence interval
        expect(band.timestamp).toBeGreaterThan(0);
      }
    });

    it('should have wider bands for more volatile data', async () => {
      const stableCandles = generateTrendingCandles(50, 'up', 0.005); // Low volatility
      const volatileCandles = generateTrendingCandles(50, 'up', 0.02); // High volatility

      const stableTrendLine = await analyzer.calculateTrendLine(stableCandles);
      const volatileTrendLine = await analyzer.calculateTrendLine(volatileCandles);

      const stableBands = await analyzer.calculateConfidenceBands(stableCandles, stableTrendLine);
      const volatileBands = await analyzer.calculateConfidenceBands(volatileCandles, volatileTrendLine);

      // Calculate average band width
      const stableWidth = stableBands.reduce((sum, band) => sum + (band.upper - band.lower), 0) / stableBands.length;
      const volatileWidth = volatileBands.reduce((sum, band) => sum + (band.upper - band.lower), 0) / volatileBands.length;

      expect(volatileWidth).toBeGreaterThan(stableWidth);
    });
  });

  describe('Trend Change Point Detection', () => {
    it('should detect trend change points', async () => {
      // Create data with a trend change in the middle
      const upTrend = generateTrendingCandles(25, 'up', 0.01);
      const downTrend = generateTrendingCandles(25, 'down', 0.01);
      
      // Adjust timestamps to be continuous
      const adjustedDownTrend = downTrend.map((candle, i) => ({
        ...candle,
        timestamp: upTrend[upTrend.length - 1].timestamp + ((i + 1) * 3600000),
      }));

      const combinedCandles = [...upTrend, ...adjustedDownTrend];
      const changePoints = await analyzer.detectTrendChangePoints(combinedCandles);

      expect(Array.isArray(changePoints)).toBe(true);
      
      if (changePoints.length > 0) {
        for (const changePoint of changePoints) {
          expect(changePoint.timestamp).toBeGreaterThan(0);
          expect(changePoint.price).toBeGreaterThan(0);
          expect(['acceleration', 'deceleration', 'reversal']).toContain(changePoint.changeType);
          expect(changePoint.significance).toBeGreaterThanOrEqual(0);
          expect(changePoint.significance).toBeLessThanOrEqual(1);
          expect(changePoint.confidence).toBeGreaterThanOrEqual(0);
          expect(changePoint.confidence).toBeLessThanOrEqual(1);
        }

        // Should be sorted by significance
        for (let i = 0; i < changePoints.length - 1; i++) {
          expect(changePoints[i].significance).toBeGreaterThanOrEqual(changePoints[i + 1].significance);
        }
      }
    });

    it('should detect reversal change points', async () => {
      // Create clear reversal pattern
      const upTrend = generateTrendingCandles(30, 'up', 0.02);
      const downTrend = generateTrendingCandles(30, 'down', 0.02);
      
      const adjustedDownTrend = downTrend.map((candle, i) => ({
        ...candle,
        timestamp: upTrend[upTrend.length - 1].timestamp + ((i + 1) * 3600000),
      }));

      const combinedCandles = [...upTrend, ...adjustedDownTrend];
      const changePoints = await analyzer.detectTrendChangePoints(combinedCandles);

      // Should detect at least one reversal
      const reversals = changePoints.filter(cp => cp.changeType === 'reversal');
      expect(reversals.length).toBeGreaterThan(0);
    });
  });

  describe('Regression Channel Calculation', () => {
    it('should calculate regression channel', async () => {
      const candles = generateTrendingCandles(50, 'up');
      const channel = await analyzer.calculateRegressionChannel(candles, 2);

      expect(channel).toBeDefined();
      expect(channel.centerLine).toBeDefined();
      expect(Array.isArray(channel.upperBound)).toBe(true);
      expect(Array.isArray(channel.lowerBound)).toBe(true);
      expect(channel.channelWidth).toBeGreaterThan(0);

      expect(channel.upperBound.length).toBe(20); // Should match period
      expect(channel.lowerBound.length).toBe(20);

      // Upper bound should be above lower bound
      for (let i = 0; i < channel.upperBound.length; i++) {
        expect(channel.upperBound[i]).toBeGreaterThan(channel.lowerBound[i]);
      }
    });

    it('should adjust channel width based on standard deviations', async () => {
      const candles = generateTrendingCandles(50, 'up');
      
      const narrowChannel = await analyzer.calculateRegressionChannel(candles, 1);
      const wideChannel = await analyzer.calculateRegressionChannel(candles, 3);

      expect(wideChannel.channelWidth).toBeGreaterThan(narrowChannel.channelWidth);
    });
  });

  describe('Multi-Timeframe Analysis', () => {
    it('should perform multi-timeframe analysis', async () => {
      const candlesByTimeframe = {
        '1h': generateTrendingCandles(50, 'up', 0.01),
        '4h': generateTrendingCandles(50, 'up', 0.008),
        '1d': generateTrendingCandles(50, 'up', 0.005),
      };

      const results = await analyzer.performMultiTimeframeAnalysis(candlesByTimeframe);

      expect(results).toBeDefined();
      expect(results['1h']).toBeDefined();
      expect(results['4h']).toBeDefined();
      expect(results['1d']).toBeDefined();

      for (const timeframe in results) {
        const result = results[timeframe];
        expect(result.trendLine).toBeDefined();
        expect(result.probability).toBeDefined();
        expect(result.consensus).toBeGreaterThanOrEqual(0);
        expect(result.consensus).toBeLessThanOrEqual(1);
      }
    });

    it('should calculate consensus across timeframes', async () => {
      const bullishCandles = generateTrendingCandles(50, 'up', 0.01);
      const bearishCandles = generateTrendingCandles(50, 'down', 0.01);

      const candlesByTimeframe = {
        '1h': bullishCandles,
        '4h': bullishCandles,
        '1d': bearishCandles, // Conflicting trend
      };

      const results = await analyzer.performMultiTimeframeAnalysis(candlesByTimeframe);

      // Consensus should be less than 1 due to conflicting trends
      expect(results['1h'].consensus).toBeLessThan(1);
      expect(results['4h'].consensus).toBeLessThan(1);
      expect(results['1d'].consensus).toBeLessThan(1);
    });

    it('should handle insufficient data in some timeframes', async () => {
      const candlesByTimeframe = {
        '1h': generateTrendingCandles(50, 'up'),
        '4h': generateTrendingCandles(10, 'up'), // Insufficient data
        '1d': generateTrendingCandles(50, 'up'),
      };

      const results = await analyzer.performMultiTimeframeAnalysis(candlesByTimeframe);

      // Should only include timeframes with sufficient data
      expect(results['1h']).toBeDefined();
      expect(results['4h']).toBeUndefined();
      expect(results['1d']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle empty candle arrays', async () => {
      await expect(analyzer.calculateTrendLine([]))
        .rejects.toThrow('Insufficient data for linear regression');
    });

    it('should handle invalid candle data gracefully', async () => {
      const invalidCandles = [
        {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          timestamp: Date.now(),
          open: NaN,
          high: 100,
          low: 50,
          close: 75,
          volume: 1000,
        },
      ] as CandleData[];

      // Should handle NaN values gracefully
      await expect(analyzer.calculateTrendLine(invalidCandles))
        .rejects.toThrow();
    });

    it('should handle zero variance data', async () => {
      // Create candles with identical prices
      const flatCandles: CandleData[] = Array.from({ length: 30 }, (_, i) => ({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: Date.now() - ((30 - i) * 3600000),
        open: 100,
        high: 100,
        low: 100,
        close: 100,
        volume: 1000,
      }));

      const trendLine = await analyzer.calculateTrendLine(flatCandles);
      
      expect(trendLine.slope).toBe(0);
      expect(trendLine.correlation).toBe(0);
      expect(trendLine.rSquared).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should complete analysis within reasonable time', async () => {
      const candles = generateTrendingCandles(100, 'up');
      
      const startTime = Date.now();
      await analyzer.calculateTrendLine(candles);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle large datasets efficiently', async () => {
      const largeDataset = generateTrendingCandles(1000, 'up');
      
      const startTime = Date.now();
      const trendLine = await analyzer.calculateTrendLine(largeDataset);
      const endTime = Date.now();

      expect(trendLine).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Statistical Accuracy', () => {
    it('should produce accurate regression statistics for known data', async () => {
      // Create perfectly linear data
      const perfectLinearCandles: CandleData[] = Array.from({ length: 50 }, (_, i) => {
        const price = 100 + i; // Perfect linear increase
        return {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          timestamp: Date.now() - ((50 - i) * 3600000),
          open: price,
          high: price,
          low: price,
          close: price,
          volume: 1000,
        };
      });

      const trendLine = await analyzer.calculateTrendLine(perfectLinearCandles);

      expect(trendLine.slope).toBeCloseTo(1, 1); // Should be close to 1
      expect(Math.abs(trendLine.correlation)).toBeCloseTo(1, 1); // Should be close to perfect correlation
      expect(trendLine.rSquared).toBeCloseTo(1, 1); // Should be close to perfect fit
      expect(trendLine.direction).toBe('bullish');
    });

    it('should handle noisy but trending data correctly', async () => {
      const noisyTrendCandles = generateTrendingCandles(100, 'up', 0.01);
      const trendLine = await analyzer.calculateTrendLine(noisyTrendCandles);

      expect(trendLine.slope).toBeGreaterThan(0);
      expect(trendLine.correlation).toBeGreaterThan(0.5);
      expect(trendLine.direction).toBe('bullish');
      expect(trendLine.strength).toBeGreaterThan(0.3);
    });
  });
});