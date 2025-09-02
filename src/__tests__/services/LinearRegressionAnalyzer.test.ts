import { LinearRegressionAnalyzer } from '../../services/LinearRegressionAnalyzer';

describe('LinearRegressionAnalyzer', () => {
  let analyzer: LinearRegressionAnalyzer;

  beforeEach(() => {
    analyzer = new LinearRegressionAnalyzer();
  });

  describe('analyzeRegression', () => {
    it('should analyze linear regression with trending data', async () => {
      // Create upward trending data
      const trendingData = Array.from({length: 20}, (_, i) => 100 + i * 2);

      const result = await analyzer.analyzeRegression(trendingData);

      expect(result).toBeDefined();
      expect(result.slope).toBeGreaterThan(0);
      expect(result.directionalBias).toBe('bullish');
      expect(result.trendStrength).toBeGreaterThan(0.5);
      expect(result.rSquared).toBeGreaterThan(0.8);
      expect(result.supportLevel).toBeGreaterThan(0);
      expect(result.resistanceLevel).toBeGreaterThan(result.supportLevel);
    });

    it('should analyze linear regression with declining data', async () => {
      // Create downward trending data
      const decliningData = Array.from({length: 20}, (_, i) => 200 - i * 3);

      const result = await analyzer.analyzeRegression(decliningData);

      expect(result).toBeDefined();
      expect(result.slope).toBeLessThan(0);
      expect(result.directionalBias).toBe('bearish');
      expect(result.trendStrength).toBeGreaterThan(0.5);
      expect(result.rSquared).toBeGreaterThan(0.8);
    });

    it('should identify neutral bias with sideways data', async () => {
      // Create sideways/ranging data
      const sidewaysData = Array.from({length: 20}, () => 100 + (Math.random() - 0.5) * 2);

      const result = await analyzer.analyzeRegression(sidewaysData);

      expect(result).toBeDefined();
      expect(result.directionalBias).toBe('neutral');
      expect(result.trendStrength).toBeLessThan(0.3);
    });

    it('should handle insufficient data gracefully', async () => {
      const insufficientData = [100, 101];

      const result = await analyzer.analyzeRegression(insufficientData, 20);

      expect(result).toBeDefined();
      expect(result.slope).toBe(0);
      expect(result.intercept).toBe(0);
      expect(result.rSquared).toBe(0);
      expect(result.directionalBias).toBe('neutral');
    });

    it('should calculate correct R-squared values', async () => {
      // Perfect linear data should have R-squared close to 1
      const perfectLinearData = Array.from({length: 10}, (_, i) => i * 2);

      const result = await analyzer.analyzeRegression(perfectLinearData);

      expect(result.rSquared).toBeGreaterThan(0.99);
    });

    it('should calculate support and resistance levels', async () => {
      const priceData = [100, 102, 104, 106, 108, 110, 112, 114, 116, 118];

      const result = await analyzer.analyzeRegression(priceData);

      expect(result.supportLevel).toBeGreaterThan(0);
      expect(result.resistanceLevel).toBeGreaterThan(0);
      expect(result.resistanceLevel).toBeGreaterThan(result.supportLevel);
    });
  });

  describe('analyzeMultiTimeframe', () => {
    it('should analyze multiple timeframes correctly', async () => {
      const priceData = Array.from({length: 60}, (_, i) => 100 + i * 0.5 + Math.sin(i * 0.1) * 2);

      const result = await analyzer.analyzeMultiTimeframe(priceData);

      expect(result).toBeDefined();
      expect(result.short).toBeDefined();
      expect(result.medium).toBeDefined();
      expect(result.long).toBeDefined();
      expect(['bullish', 'bearish', 'neutral']).toContain(result.consensus);
    });

    it('should determine consensus correctly', async () => {
      // Create data with clear upward trend across all timeframes
      const strongUptrend = Array.from({length: 60}, (_, i) => 100 + i * 2);

      const result = await analyzer.analyzeMultiTimeframe(strongUptrend);

      expect(result.consensus).toBe('bullish');
      expect(result.short.directionalBias).toBe('bullish');
      expect(result.medium.directionalBias).toBe('bullish');
      expect(result.long.directionalBias).toBe('bullish');
    });

    it('should handle conflicting timeframe signals', async () => {
      // Create data with mixed signals
      const mixedData = [
        ...Array.from({length: 20}, (_, i) => 100 + i), // Uptrend
        ...Array.from({length: 20}, (_, i) => 120 - i), // Downtrend
        ...Array.from({length: 20}, () => 100 + (Math.random() - 0.5) * 2) // Sideways
      ];

      const result = await analyzer.analyzeMultiTimeframe(mixedData);

      expect(['bullish', 'bearish', 'neutral']).toContain(result.consensus);
    });
  });

  describe('calculateVolatilityMetrics', () => {
    it('should calculate volatility metrics correctly', () => {
      const priceData = [100, 102, 98, 105, 95, 108, 92, 110, 90, 112];

      const result = analyzer.calculateVolatilityMetrics(priceData);

      expect(result).toBeDefined();
      expect(result.currentVolatility).toBeGreaterThan(0);
      expect(result.historicalVolatility).toBeGreaterThan(0);
      expect(result.volatilityRatio).toBeGreaterThan(0);
      expect(['increasing', 'decreasing', 'stable']).toContain(result.volatilityTrend);
      expect(result.atr).toBeGreaterThanOrEqual(0);
      expect(result.bollingerBandWidth).toBeGreaterThanOrEqual(0);
    });

    it('should identify increasing volatility trend', () => {
      // Create data with increasing volatility
      const increasingVolData = [
        100, 100.1, 99.9, // Low volatility start
        100.5, 99.5, 101, 99, // Medium volatility
        102, 98, 104, 96, 106, 94 // High volatility end
      ];

      const result = analyzer.calculateVolatilityMetrics(increasingVolData);

      expect(result.volatilityTrend).toBe('increasing');
    });

    it('should handle insufficient data for volatility calculation', () => {
      const insufficientData = [100, 101];

      const result = analyzer.calculateVolatilityMetrics(insufficientData);

      expect(result.currentVolatility).toBe(0.02);
      expect(result.historicalVolatility).toBe(0.02);
      expect(result.volatilityTrend).toBe('stable');
    });

    it('should calculate ATR correctly', () => {
      const priceData = Array.from({length: 20}, (_, i) => 100 + Math.sin(i) * 5);

      const result = analyzer.calculateVolatilityMetrics(priceData);

      expect(result.atr).toBeGreaterThan(0);
    });

    it('should calculate Bollinger Band width', () => {
      const priceData = Array.from({length: 25}, (_, i) => 100 + i + Math.random() * 2);

      const result = analyzer.calculateVolatilityMetrics(priceData);

      expect(result.bollingerBandWidth).toBeGreaterThanOrEqual(0);
    });
  });

  describe('trend strength calculation', () => {
    it('should calculate high trend strength for strong trends', async () => {
      const strongTrend = Array.from({length: 20}, (_, i) => 100 + i * 5);

      const result = await analyzer.analyzeRegression(strongTrend);

      expect(result.trendStrength).toBeGreaterThan(0.7);
    });

    it('should calculate low trend strength for weak trends', async () => {
      const weakTrend = Array.from({length: 20}, () => 100 + (Math.random() - 0.5) * 0.5);

      const result = await analyzer.analyzeRegression(weakTrend);

      expect(result.trendStrength).toBeLessThan(0.3);
    });
  });

  describe('trend probability calculation', () => {
    it('should calculate higher probability for strong trends', async () => {
      const strongTrend = Array.from({length: 20}, (_, i) => 100 + i * 3);

      const result = await analyzer.analyzeRegression(strongTrend);

      expect(result.trendProbability).toBeGreaterThan(0.7);
    });

    it('should calculate lower probability for weak trends', async () => {
      const weakTrend = Array.from({length: 20}, () => 100 + (Math.random() - 0.5));

      const result = await analyzer.analyzeRegression(weakTrend);

      expect(result.trendProbability).toBeLessThan(0.7);
    });
  });

  describe('addHistoricalData', () => {
    it('should add historical data for analysis', () => {
      const historicalData = [100, 101, 102, 103, 104];

      analyzer.addHistoricalData(historicalData);

      // Should not throw and should maintain data within limits
      expect(() => analyzer.addHistoricalData(historicalData)).not.toThrow();
    });

    it('should maintain maximum history length', () => {
      // Add more data than the maximum limit
      for (let i = 0; i < 1100; i++) {
        analyzer.addHistoricalData([100 + i]);
      }

      // Should not throw and should handle the limit gracefully
      expect(() => analyzer.addHistoricalData([200])).not.toThrow();
    });
  });

  describe('getHistoricalAccuracy', () => {
    it('should return historical accuracy metric', () => {
      const accuracy = analyzer.getHistoricalAccuracy();

      expect(accuracy).toBeGreaterThanOrEqual(0);
      expect(accuracy).toBeLessThanOrEqual(1);
    });
  });

  describe('error handling', () => {
    it('should handle empty price data', async () => {
      const emptyData: number[] = [];

      const result = await analyzer.analyzeRegression(emptyData);

      expect(result.slope).toBe(0);
      expect(result.directionalBias).toBe('neutral');
    });

    it('should handle NaN and Infinity values', async () => {
      const problematicData = [100, NaN, Infinity, -Infinity, 101];

      const result = await analyzer.analyzeRegression(problematicData);

      expect(result).toBeDefined();
      expect(isFinite(result.slope)).toBe(true);
      expect(isFinite(result.intercept)).toBe(true);
    });
  });

  describe('statistical calculations', () => {
    it('should calculate standard deviation correctly', () => {
      const data = [100, 102, 98, 105, 95];
      const volatilityMetrics = analyzer.calculateVolatilityMetrics(data);

      expect(volatilityMetrics.currentVolatility).toBeGreaterThan(0);
      expect(isFinite(volatilityMetrics.currentVolatility)).toBe(true);
    });

    it('should handle zero variance data', () => {
      const constantData = Array.from({length: 20}, () => 100);
      const volatilityMetrics = analyzer.calculateVolatilityMetrics(constantData);

      expect(volatilityMetrics.currentVolatility).toBe(0);
      expect(volatilityMetrics.volatilityTrend).toBe('stable');
    });
  });
});