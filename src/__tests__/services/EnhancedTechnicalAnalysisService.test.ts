/**
 * Enhanced Technical Analysis Service Tests
 */

import { TechnicalAnalysisService, EnhancedAnalysisResults } from '../../services/TechnicalAnalysisService';
import { CandleData } from '../../types/market';

describe('Enhanced Technical Analysis Service', () => {
  let service: TechnicalAnalysisService;
  let mockCandles: CandleData[];

  beforeEach(() => {
    service = new TechnicalAnalysisService();

    // Create comprehensive mock candle data
    mockCandles = [];
    const basePrice = 50000; // BTC price
    
    for (let i = 0; i < 100; i++) {
      const timestamp = Date.now() - (100 - i) * 60000; // 1 minute intervals
      
      // Create realistic price movement with trends and patterns
      let price = basePrice;
      
      // Add trend component
      price += (i - 50) * 10; // Gradual uptrend
      
      // Add volatility
      price += Math.sin(i / 10) * 500; // Cyclical movement
      price += (Math.random() - 0.5) * 200; // Random noise
      
      // Add support/resistance touches
      if (i % 20 === 0) {
        price = 49000 + Math.random() * 100; // Support level
      } else if (i % 25 === 0) {
        price = 51000 + Math.random() * 100; // Resistance level
      }
      
      const volume = 1000 + Math.random() * 2000; // BTC volume
      
      mockCandles.push({
        symbol: 'BTCUSDT',
        timeframe: '1m',
        timestamp,
        open: price - 50 + Math.random() * 100,
        high: price + 100 + Math.random() * 100,
        low: price - 100 - Math.random() * 100,
        close: price,
        volume,
      });
    }
  });

  describe('performEnhancedAnalysis', () => {
    it('should perform comprehensive enhanced analysis', async () => {
      const results = await service.performEnhancedAnalysis(mockCandles);

      expect(results).toBeDefined();
      expect(results).toHaveProperty('basic');
      expect(results).toHaveProperty('enhanced');

      // Validate basic results
      expect(results.basic).toHaveProperty('rsi');
      expect(results.basic).toHaveProperty('waveTrend');
      expect(results.basic).toHaveProperty('pvt');
      expect(results.basic).toHaveProperty('supportLevels');
      expect(results.basic).toHaveProperty('resistanceLevels');

      // Validate enhanced results
      expect(results.enhanced).toHaveProperty('supportResistance');
      expect(results.enhanced).toHaveProperty('liquidityGrabs');
      expect(results.enhanced).toHaveProperty('indicatorMatrix');
      expect(results.enhanced).toHaveProperty('adaptiveThresholds');
      expect(results.enhanced).toHaveProperty('weightedConfidence');

      // Validate enhanced support/resistance
      expect(Array.isArray(results.enhanced.supportResistance)).toBe(true);
      results.enhanced.supportResistance.forEach(level => {
        expect(level).toHaveProperty('strengthScore');
        expect(level).toHaveProperty('liquidityGrab');
        expect(level).toHaveProperty('reversalPotential');
        expect(level.strengthScore).toBeGreaterThanOrEqual(0);
        expect(level.strengthScore).toBeLessThanOrEqual(1);
      });

      // Validate liquidity grabs
      expect(Array.isArray(results.enhanced.liquidityGrabs)).toBe(true);
      results.enhanced.liquidityGrabs.forEach(grab => {
        expect(grab).toHaveProperty('timestamp');
        expect(grab).toHaveProperty('price');
        expect(grab).toHaveProperty('type');
        expect(grab).toHaveProperty('strength');
        expect(['support', 'resistance']).toContain(grab.type);
      });

      // Validate indicator matrix
      expect(results.enhanced.indicatorMatrix).toHaveProperty('scores');
      expect(results.enhanced.indicatorMatrix).toHaveProperty('correlationMatrix');
      expect(results.enhanced.indicatorMatrix).toHaveProperty('overallScore');
      expect(results.enhanced.indicatorMatrix).toHaveProperty('dominantSignal');
      expect(results.enhanced.indicatorMatrix.overallScore).toBeGreaterThanOrEqual(0);
      expect(results.enhanced.indicatorMatrix.overallScore).toBeLessThanOrEqual(1);

      // Validate adaptive thresholds
      expect(results.enhanced.adaptiveThresholds).toHaveProperty('rsi');
      expect(results.enhanced.adaptiveThresholds).toHaveProperty('waveTrend');
      expect(results.enhanced.adaptiveThresholds).toHaveProperty('volume');
      expect(results.enhanced.adaptiveThresholds).toHaveProperty('volatility');
      expect(results.enhanced.adaptiveThresholds).toHaveProperty('confidence');

      // Validate weighted confidence
      expect(results.enhanced.weightedConfidence).toHaveProperty('overallConfidence');
      expect(results.enhanced.weightedConfidence).toHaveProperty('factors');
      expect(results.enhanced.weightedConfidence).toHaveProperty('weights');
      expect(results.enhanced.weightedConfidence).toHaveProperty('reliability');
      expect(results.enhanced.weightedConfidence).toHaveProperty('riskLevel');
      expect(results.enhanced.weightedConfidence.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(results.enhanced.weightedConfidence.overallConfidence).toBeLessThanOrEqual(1);
      expect(['low', 'medium', 'high']).toContain(results.enhanced.weightedConfidence.riskLevel);
    });

    it('should handle insufficient data gracefully', async () => {
      const shortCandles = mockCandles.slice(0, 15);

      await expect(service.performEnhancedAnalysis(shortCandles))
        .rejects.toThrow('Insufficient candle data for analysis');
    });

    it('should maintain historical indicators for correlation analysis', async () => {
      // Perform multiple analyses to build history
      await service.performEnhancedAnalysis(mockCandles);
      await service.performEnhancedAnalysis(mockCandles.slice(10));
      const results = await service.performEnhancedAnalysis(mockCandles.slice(20));

      // Should have correlation data from historical indicators
      expect(results.enhanced.indicatorMatrix.correlationMatrix.pairs.length).toBeGreaterThan(0);
    });
  });

  describe('detectLiquidityGrabs', () => {
    it('should detect liquidity grabs independently', async () => {
      const grabs = await service.detectLiquidityGrabs(mockCandles);

      expect(Array.isArray(grabs)).toBe(true);
      grabs.forEach(grab => {
        expect(grab).toHaveProperty('timestamp');
        expect(grab).toHaveProperty('price');
        expect(grab).toHaveProperty('type');
        expect(grab).toHaveProperty('strength');
        expect(grab).toHaveProperty('reversalConfirmed');
        expect(grab).toHaveProperty('volumeSpike');
        expect(['support', 'resistance']).toContain(grab.type);
        expect(grab.strength).toBeGreaterThanOrEqual(0);
        expect(grab.strength).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('getEnhancedSupportResistance', () => {
    it('should return enhanced support and resistance levels', async () => {
      const levels = await service.getEnhancedSupportResistance(mockCandles);

      expect(Array.isArray(levels)).toBe(true);
      expect(levels.length).toBeGreaterThan(0);

      levels.forEach(level => {
        expect(level).toHaveProperty('price');
        expect(level).toHaveProperty('strength');
        expect(level).toHaveProperty('type');
        expect(level).toHaveProperty('touches');
        expect(level).toHaveProperty('strengthScore');
        expect(level).toHaveProperty('liquidityGrab');
        expect(level).toHaveProperty('reversalPotential');
        expect(level).toHaveProperty('volumeConfirmation');
        expect(level).toHaveProperty('timeStrength');
        expect(level).toHaveProperty('priceActionStrength');

        expect(['support', 'resistance']).toContain(level.type);
        expect(level.price).toBeGreaterThan(0);
        expect(level.strengthScore).toBeGreaterThanOrEqual(0);
        expect(level.strengthScore).toBeLessThanOrEqual(1);
        expect(level.touches).toBeGreaterThanOrEqual(1);
      });

      // Levels should be sorted by strength score (descending)
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i - 1].strengthScore).toBeGreaterThanOrEqual(levels[i].strengthScore);
      }
    });
  });

  describe('calculateIndicatorScoringMatrix', () => {
    it('should calculate comprehensive indicator scoring matrix', async () => {
      const matrix = await service.calculateIndicatorScoringMatrix(mockCandles);

      expect(matrix).toBeDefined();
      expect(matrix).toHaveProperty('timestamp');
      expect(matrix).toHaveProperty('symbol');
      expect(matrix).toHaveProperty('scores');
      expect(matrix).toHaveProperty('correlationMatrix');
      expect(matrix).toHaveProperty('overallScore');
      expect(matrix).toHaveProperty('dominantSignal');
      expect(matrix).toHaveProperty('confidence');
      expect(matrix).toHaveProperty('divergences');

      expect(matrix.symbol).toBe('BTCUSDT');
      expect(Array.isArray(matrix.scores)).toBe(true);
      expect(matrix.scores.length).toBeGreaterThan(0);
      expect(['bullish', 'bearish', 'neutral']).toContain(matrix.dominantSignal);
      expect(matrix.overallScore).toBeGreaterThanOrEqual(0);
      expect(matrix.overallScore).toBeLessThanOrEqual(1);
      expect(matrix.confidence).toBeGreaterThanOrEqual(0);
      expect(matrix.confidence).toBeLessThanOrEqual(1);

      // Validate individual scores
      matrix.scores.forEach(score => {
        expect(score).toHaveProperty('indicator');
        expect(score).toHaveProperty('score');
        expect(score).toHaveProperty('signal');
        expect(score).toHaveProperty('strength');
        expect(score).toHaveProperty('confidence');
        expect(score).toHaveProperty('reasoning');

        expect(score.score).toBeGreaterThanOrEqual(0);
        expect(score.score).toBeLessThanOrEqual(1);
        expect(['bullish', 'bearish', 'neutral']).toContain(score.signal);
        expect(['weak', 'moderate', 'strong']).toContain(score.strength);
        expect(Array.isArray(score.reasoning)).toBe(true);
      });
    });

    it('should accept custom indicators', async () => {
      const customIndicators = await service.getCurrentIndicators(mockCandles);
      const matrix = await service.calculateIndicatorScoringMatrix(mockCandles, customIndicators);

      expect(matrix).toBeDefined();
      expect(matrix.scores.length).toBeGreaterThan(0);
    });
  });

  describe('getAdaptiveThresholds', () => {
    it('should return adaptive thresholds based on market conditions', async () => {
      const thresholds = await service.getAdaptiveThresholds(mockCandles);

      expect(thresholds).toBeDefined();
      expect(thresholds).toHaveProperty('rsi');
      expect(thresholds).toHaveProperty('waveTrend');
      expect(thresholds).toHaveProperty('volume');
      expect(thresholds).toHaveProperty('volatility');
      expect(thresholds).toHaveProperty('confidence');

      // RSI thresholds should be within reasonable ranges
      expect(thresholds.rsi.oversold).toBeGreaterThan(10);
      expect(thresholds.rsi.oversold).toBeLessThan(50);
      expect(thresholds.rsi.overbought).toBeGreaterThan(50);
      expect(thresholds.rsi.overbought).toBeLessThan(90);
      expect(thresholds.rsi.neutral[0]).toBeLessThan(thresholds.rsi.neutral[1]);

      // Volume thresholds should be positive
      expect(thresholds.volume.spikeThreshold).toBeGreaterThan(1);
      expect(thresholds.volume.lowVolumeThreshold).toBeGreaterThan(0);
      expect(thresholds.volume.lowVolumeThreshold).toBeLessThan(1);

      // Confidence thresholds should be between 0 and 1
      expect(thresholds.confidence.minConfidence).toBeGreaterThanOrEqual(0);
      expect(thresholds.confidence.minConfidence).toBeLessThanOrEqual(1);
      expect(thresholds.confidence.strongConfidence).toBeGreaterThanOrEqual(0);
      expect(thresholds.confidence.strongConfidence).toBeLessThanOrEqual(1);
      expect(thresholds.confidence.minConfidence).toBeLessThan(thresholds.confidence.strongConfidence);
    });
  });

  describe('calculateWeightedConfidence', () => {
    it('should calculate weighted confidence for analysis results', async () => {
      const confidence = await service.calculateWeightedConfidence(mockCandles);

      expect(confidence).toBeDefined();
      expect(confidence).toHaveProperty('overallConfidence');
      expect(confidence).toHaveProperty('factors');
      expect(confidence).toHaveProperty('weights');
      expect(confidence).toHaveProperty('adjustments');
      expect(confidence).toHaveProperty('reliability');
      expect(confidence).toHaveProperty('riskLevel');

      expect(confidence.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(confidence.overallConfidence).toBeLessThanOrEqual(1);
      expect(confidence.reliability).toBeGreaterThanOrEqual(0);
      expect(confidence.reliability).toBeLessThanOrEqual(1);
      expect(['low', 'medium', 'high']).toContain(confidence.riskLevel);

      // Validate confidence factors
      const factors = confidence.factors;
      Object.values(factors).forEach(factor => {
        expect(factor).toBeGreaterThanOrEqual(0);
        expect(factor).toBeLessThanOrEqual(1);
      });

      // Validate weights sum to 1
      const weights = confidence.weights;
      const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
      expect(totalWeight).toBeCloseTo(1, 2);
    });

    it('should accept custom indicators', async () => {
      const customIndicators = await service.getCurrentIndicators(mockCandles);
      const confidence = await service.calculateWeightedConfidence(mockCandles, customIndicators);

      expect(confidence).toBeDefined();
      expect(confidence.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(confidence.overallConfidence).toBeLessThanOrEqual(1);
    });
  });

  describe('configuration management', () => {
    it('should return enhanced configuration', () => {
      const config = service.getEnhancedConfig();

      expect(config).toBeDefined();
      expect(config).toHaveProperty('thresholds');
      expect(config).toHaveProperty('scoringConfig');
      expect(config).toHaveProperty('confidenceConfig');

      expect(config.thresholds).toHaveProperty('rsi');
      expect(config.thresholds).toHaveProperty('waveTrend');
      expect(config.thresholds).toHaveProperty('volume');
    });

    it('should update enhanced configuration', () => {
      const newConfig = {
        thresholds: {
          rsi: { oversold: 25, overbought: 75, neutral: [35, 65] },
        },
        scoringConfig: {
          weights: {
            rsi: 0.3,
            waveTrend: 0.3,
            pvt: 0.2,
            momentum: 0.1,
            trend: 0.1,
            volume: 0.0,
          },
        },
      };

      service.updateEnhancedConfig(newConfig);
      const config = service.getEnhancedConfig();

      expect(config.scoringConfig.weights.rsi).toBe(0.3);
      expect(config.scoringConfig.weights.volume).toBe(0.0);
    });
  });

  describe('integration with existing methods', () => {
    it('should maintain compatibility with existing calculateIndicators method', async () => {
      const basicResults = await service.calculateIndicators(mockCandles);
      const enhancedResults = await service.performEnhancedAnalysis(mockCandles);

      // Basic results should be included in enhanced results
      expect(enhancedResults.basic).toEqual(basicResults);
    });

    it('should maintain compatibility with existing getCurrentIndicators method', async () => {
      const currentIndicators = await service.getCurrentIndicators(mockCandles);

      expect(currentIndicators).toBeDefined();
      expect(currentIndicators).toHaveProperty('rsi');
      expect(currentIndicators).toHaveProperty('waveTrend');
      expect(currentIndicators).toHaveProperty('pvt');
      expect(currentIndicators).toHaveProperty('trend');
      expect(currentIndicators).toHaveProperty('momentum');
      expect(currentIndicators).toHaveProperty('volatility');
    });

    it('should maintain compatibility with existing detectSupportResistance method', async () => {
      const basicSR = await service.detectSupportResistance(mockCandles);
      const enhancedSR = await service.getEnhancedSupportResistance(mockCandles);

      expect(Array.isArray(basicSR)).toBe(true);
      expect(Array.isArray(enhancedSR)).toBe(true);
      
      // Enhanced SR should have additional properties
      if (enhancedSR.length > 0) {
        expect(enhancedSR[0]).toHaveProperty('strengthScore');
        expect(enhancedSR[0]).toHaveProperty('liquidityGrab');
      }
    });
  });

  describe('performance and reliability', () => {
    it('should complete enhanced analysis within reasonable time', async () => {
      const startTime = Date.now();
      await service.performEnhancedAnalysis(mockCandles);
      const endTime = Date.now();

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should produce consistent results for same input', async () => {
      const result1 = await service.performEnhancedAnalysis(mockCandles);
      const result2 = await service.performEnhancedAnalysis(mockCandles);

      // Basic results should be identical
      expect(result1.basic).toEqual(result2.basic);
      
      // Enhanced results should be very similar (allowing for small variations due to timestamps)
      expect(result1.enhanced.supportResistance.length).toBe(result2.enhanced.supportResistance.length);
      expect(result1.enhanced.indicatorMatrix.overallScore).toBeCloseTo(result2.enhanced.indicatorMatrix.overallScore, 2);
    });

    it('should handle edge cases gracefully', async () => {
      // Test with minimal data
      const minimalCandles = mockCandles.slice(0, 25);
      
      await expect(service.performEnhancedAnalysis(minimalCandles))
        .rejects.toThrow();

      // Test with flat price data
      const flatCandles = mockCandles.map(candle => ({
        ...candle,
        open: 50000,
        high: 50000,
        low: 50000,
        close: 50000,
      }));

      const flatResults = await service.performEnhancedAnalysis(flatCandles);
      expect(flatResults).toBeDefined();

      // Test with zero volume
      const zeroVolumeCandles = mockCandles.map(candle => ({
        ...candle,
        volume: 0,
      }));

      const zeroVolResults = await service.performEnhancedAnalysis(zeroVolumeCandles);
      expect(zeroVolResults).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle invalid candle data', async () => {
      const invalidCandles = [
        {
          symbol: 'INVALID',
          timeframe: '1m',
          timestamp: Date.now(),
          open: NaN,
          high: NaN,
          low: NaN,
          close: NaN,
          volume: NaN,
        },
      ];

      await expect(service.performEnhancedAnalysis(invalidCandles as CandleData[]))
        .rejects.toThrow();
    });

    it('should handle empty candle array', async () => {
      await expect(service.performEnhancedAnalysis([]))
        .rejects.toThrow();
    });

    it('should provide meaningful error messages', async () => {
      try {
        await service.performEnhancedAnalysis([]);
      } catch (error) {
        expect(error.message).toContain('candle data');
      }
    });
  });
});