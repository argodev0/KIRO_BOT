/**
 * Advanced Technical Analysis Engine Tests
 * Comprehensive unit tests for the advanced technical analysis system
 */

import { AdvancedTechnicalAnalysisEngine } from '../../services/AdvancedTechnicalAnalysisEngine';
import { CandleData } from '../../types/market';

// Mock data generator
const generateMockCandles = (count: number, basePrice: number = 100): CandleData[] => {
  const candles: CandleData[] = [];
  let currentPrice = basePrice;
  const startTime = Date.now() - (count * 3600000); // 1 hour intervals

  for (let i = 0; i < count; i++) {
    const volatility = 0.02; // 2% volatility
    const change = (Math.random() - 0.5) * volatility * currentPrice;
    
    const open = currentPrice;
    const close = currentPrice + change;
    const high = Math.max(open, close) + Math.random() * 0.01 * currentPrice;
    const low = Math.min(open, close) - Math.random() * 0.01 * currentPrice;
    const volume = 1000 + Math.random() * 5000;

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

// Generate trending data
const generateTrendingCandles = (count: number, trend: 'up' | 'down' = 'up'): CandleData[] => {
  const candles: CandleData[] = [];
  let currentPrice = 100;
  const startTime = Date.now() - (count * 3600000);
  const trendStrength = trend === 'up' ? 0.001 : -0.001; // 0.1% per candle

  for (let i = 0; i < count; i++) {
    const trendMove = currentPrice * trendStrength;
    const noise = (Math.random() - 0.5) * 0.01 * currentPrice;
    
    const open = currentPrice;
    const close = currentPrice + trendMove + noise;
    const high = Math.max(open, close) + Math.random() * 0.005 * currentPrice;
    const low = Math.min(open, close) - Math.random() * 0.005 * currentPrice;
    const volume = 1000 + Math.random() * 3000;

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

describe('AdvancedTechnicalAnalysisEngine', () => {
  let engine: AdvancedTechnicalAnalysisEngine;
  let mockCandles: CandleData[];

  beforeEach(() => {
    engine = new AdvancedTechnicalAnalysisEngine({
      indicators: {
        rsi: { period: 14, overbought: 70, oversold: 30 },
        waveTrend: { n1: 10, n2: 21 },
        pvt: { period: 14 },
      },
      patterns: {
        minBodySize: 0.1,
        minWickRatio: 0.3,
        lookbackPeriod: 50,
        comprehensiveAnalysis: true,
        multiTimeframeValidation: false, // Disable for testing
      },
      elliottWave: {
        minWaveLength: 5,
        maxWaveLength: 100,
        fibonacciTolerance: 0.05,
        probabilityThreshold: 0.6,
        degreeAnalysisDepth: 3,
      },
      fibonacci: {
        levels: [0.236, 0.382, 0.5, 0.618, 0.786, 1.272, 1.618, 2.618],
        confluenceDistance: 0.01,
        dynamicAdjustment: true,
        timeProjections: true,
      },
      pivotChannels: {
        lookbackPeriod: 50,
        minTouches: 3,
        channelWidth: 0.02,
        trendAnalysisDepth: 20,
      },
      linearRegression: {
        period: 20,
        confidenceInterval: 0.95,
        trendProbabilityThreshold: 0.7,
      },
      nkn: {
        enabled: false, // Disable NKN for basic tests
        networkDepth: 3,
        trainingPeriod: 100,
        predictionHorizon: 10,
        confidenceThreshold: 0.6,
      },
    });

    mockCandles = generateMockCandles(100);
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultEngine = new AdvancedTechnicalAnalysisEngine();
      const config = defaultEngine.getConfig();
      
      expect(config).toBeDefined();
      expect(config.indicators).toBeDefined();
      expect(config.elliottWave).toBeDefined();
      expect(config.fibonacci).toBeDefined();
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        elliottWave: {
          minWaveLength: 10,
          maxWaveLength: 200,
          fibonacciTolerance: 0.1,
          probabilityThreshold: 0.8,
          degreeAnalysisDepth: 5,
        },
      };

      const customEngine = new AdvancedTechnicalAnalysisEngine(customConfig);
      const config = customEngine.getConfig();
      
      expect(config.elliottWave.minWaveLength).toBe(10);
      expect(config.elliottWave.probabilityThreshold).toBe(0.8);
    });
  });

  describe('Advanced Analysis', () => {
    it('should perform comprehensive advanced analysis', async () => {
      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.timestamp).toBeGreaterThan(0);
      
      // Check basic analysis components
      expect(result.technical).toBeDefined();
      expect(result.patterns).toBeDefined();
      expect(result.elliottWave).toBeDefined();
      expect(result.fibonacci).toBeDefined();
      expect(result.confluence).toBeDefined();
      expect(result.marketRegime).toBeDefined();
      expect(result.volumeProfile).toBeDefined();
      
      // Check advanced analysis components
      expect(result.enhancedElliottWave).toBeDefined();
      expect(result.dynamicFibonacci).toBeDefined();
      expect(result.dynamicSupportResistance).toBeDefined();
      expect(result.comprehensivePatterns).toBeDefined();
      expect(result.pivotChannels).toBeDefined();
      expect(result.linearRegression).toBeDefined();
      expect(result.nknAnalysis).toBeDefined();
    });

    it('should handle insufficient data gracefully', async () => {
      const shortCandles = generateMockCandles(10);
      
      await expect(engine.performAdvancedAnalysis(shortCandles))
        .rejects.toThrow('Insufficient candle data for advanced analysis');
    });

    it('should emit analysis events', async () => {
      const analysisCompletePromise = new Promise((resolve) => {
        engine.once('analysisComplete', resolve);
      });

      const analysisPromise = engine.performAdvancedAnalysis(mockCandles);
      
      const [result, event] = await Promise.all([analysisPromise, analysisCompletePromise]);
      
      expect(result).toBeDefined();
      expect(event).toBeDefined();
    });
  });

  describe('Enhanced Elliott Wave Analysis', () => {
    it('should identify Elliott Wave structures with probability scores', async () => {
      const trendingCandles = generateTrendingCandles(100, 'up');
      const result = await engine.performAdvancedAnalysis(trendingCandles);
      
      expect(result.enhancedElliottWave).toBeDefined();
      expect(result.enhancedElliottWave.structure).toBeDefined();
      expect(result.enhancedElliottWave.probabilityScores).toBeDefined();
      expect(Array.isArray(result.enhancedElliottWave.probabilityScores)).toBe(true);
      
      if (result.enhancedElliottWave.probabilityScores.length > 0) {
        const score = result.enhancedElliottWave.probabilityScores[0];
        expect(score.waveId).toBeDefined();
        expect(score.probability).toBeGreaterThanOrEqual(0);
        expect(score.probability).toBeLessThanOrEqual(1);
        expect(score.confidence).toBeGreaterThanOrEqual(0);
        expect(score.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should perform nested wave analysis', async () => {
      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      expect(result.enhancedElliottWave.nestedAnalysis).toBeDefined();
      expect(Array.isArray(result.enhancedElliottWave.nestedAnalysis)).toBe(true);
    });

    it('should calculate invalidation levels', async () => {
      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      expect(result.enhancedElliottWave.invalidationLevels).toBeDefined();
      expect(Array.isArray(result.enhancedElliottWave.invalidationLevels)).toBe(true);
    });
  });

  describe('Dynamic Fibonacci Analysis', () => {
    it('should calculate dynamic Fibonacci adjustments', async () => {
      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      expect(result.dynamicFibonacci).toBeDefined();
      expect(result.dynamicFibonacci.levels).toBeDefined();
      expect(result.dynamicFibonacci.dynamicAdjustments).toBeDefined();
      expect(Array.isArray(result.dynamicFibonacci.dynamicAdjustments)).toBe(true);
    });

    it('should calculate confluence strength', async () => {
      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      expect(result.dynamicFibonacci.confluenceStrength).toBeDefined();
      expect(typeof result.dynamicFibonacci.confluenceStrength).toBe('number');
      expect(result.dynamicFibonacci.confluenceStrength).toBeGreaterThanOrEqual(0);
    });

    it('should generate time projections when enabled', async () => {
      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      expect(result.dynamicFibonacci.timeProjections).toBeDefined();
      expect(Array.isArray(result.dynamicFibonacci.timeProjections)).toBe(true);
    });
  });

  describe('Dynamic Support/Resistance Detection', () => {
    it('should detect dynamic support and resistance levels', async () => {
      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      expect(result.dynamicSupportResistance).toBeDefined();
      expect(result.dynamicSupportResistance.levels).toBeDefined();
      expect(Array.isArray(result.dynamicSupportResistance.levels)).toBe(true);
      
      if (result.dynamicSupportResistance.levels.length > 0) {
        const level = result.dynamicSupportResistance.levels[0];
        expect(level.price).toBeGreaterThan(0);
        expect(['support', 'resistance']).toContain(level.type);
        expect(level.strength).toBeGreaterThanOrEqual(0);
        expect(level.strength).toBeLessThanOrEqual(1);
      }
    });

    it('should provide volume confirmation', async () => {
      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      expect(result.dynamicSupportResistance.volumeConfirmation).toBeDefined();
      expect(Array.isArray(result.dynamicSupportResistance.volumeConfirmation)).toBe(true);
    });

    it('should provide price action confirmation', async () => {
      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      expect(result.dynamicSupportResistance.priceActionConfirmation).toBeDefined();
      expect(Array.isArray(result.dynamicSupportResistance.priceActionConfirmation)).toBe(true);
    });
  });

  describe('Comprehensive Pattern Recognition', () => {
    it('should detect candlestick patterns', async () => {
      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      expect(result.comprehensivePatterns).toBeDefined();
      expect(result.comprehensivePatterns.patterns).toBeDefined();
      expect(Array.isArray(result.comprehensivePatterns.patterns)).toBe(true);
    });

    it('should detect chart patterns', async () => {
      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      expect(result.comprehensivePatterns.chartPatterns).toBeDefined();
      expect(Array.isArray(result.comprehensivePatterns.chartPatterns)).toBe(true);
    });

    it('should provide multi-timeframe consensus when enabled', async () => {
      // Enable multi-timeframe validation
      engine.updateConfig({
        patterns: {
          minBodySize: 0.1,
          minWickRatio: 0.3,
          lookbackPeriod: 50,
          comprehensiveAnalysis: true,
          multiTimeframeValidation: true,
        },
      });

      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      expect(result.comprehensivePatterns.multiTimeframeConsensus).toBeDefined();
      expect(Array.isArray(result.comprehensivePatterns.multiTimeframeConsensus)).toBe(true);
    });
  });

  describe('Pivot Channel Detection', () => {
    it('should detect pivot channels', async () => {
      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      expect(result.pivotChannels).toBeDefined();
      expect(result.pivotChannels.channels).toBeDefined();
      expect(Array.isArray(result.pivotChannels.channels)).toBe(true);
    });

    it('should analyze trend', async () => {
      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      expect(result.pivotChannels.trendAnalysis).toBeDefined();
      expect(['bullish', 'bearish', 'sideways']).toContain(result.pivotChannels.trendAnalysis.direction);
      expect(result.pivotChannels.trendAnalysis.strength).toBeGreaterThanOrEqual(0);
      expect(result.pivotChannels.trendAnalysis.strength).toBeLessThanOrEqual(1);
    });

    it('should calculate breakout probability', async () => {
      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      expect(result.pivotChannels.breakoutProbability).toBeDefined();
      expect(typeof result.pivotChannels.breakoutProbability).toBe('number');
      expect(result.pivotChannels.breakoutProbability).toBeGreaterThanOrEqual(0);
      expect(result.pivotChannels.breakoutProbability).toBeLessThanOrEqual(1);
    });
  });

  describe('Linear Regression Analysis', () => {
    it('should calculate trend line', async () => {
      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      expect(result.linearRegression).toBeDefined();
      expect(result.linearRegression.trendLine).toBeDefined();
      expect(result.linearRegression.trendLine.slope).toBeDefined();
      expect(result.linearRegression.trendLine.intercept).toBeDefined();
      expect(result.linearRegression.trendLine.correlation).toBeGreaterThanOrEqual(-1);
      expect(result.linearRegression.trendLine.correlation).toBeLessThanOrEqual(1);
      expect(['bullish', 'bearish']).toContain(result.linearRegression.trendLine.direction);
    });

    it('should analyze trend probability', async () => {
      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      expect(result.linearRegression.probabilityAnalysis).toBeDefined();
      expect(result.linearRegression.probabilityAnalysis.continuationProbability).toBeGreaterThanOrEqual(0);
      expect(result.linearRegression.probabilityAnalysis.continuationProbability).toBeLessThanOrEqual(1);
      expect(result.linearRegression.probabilityAnalysis.reversalProbability).toBeGreaterThanOrEqual(0);
      expect(result.linearRegression.probabilityAnalysis.reversalProbability).toBeLessThanOrEqual(1);
    });

    it('should calculate confidence bands', async () => {
      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      expect(result.linearRegression.confidenceBands).toBeDefined();
      expect(Array.isArray(result.linearRegression.confidenceBands)).toBe(true);
      
      if (result.linearRegression.confidenceBands.length > 0) {
        const band = result.linearRegression.confidenceBands[0];
        expect(band.upper).toBeGreaterThan(band.lower);
        expect(band.confidence).toBeGreaterThan(0);
        expect(band.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('NKN Analysis', () => {
    it('should return empty NKN analysis when disabled', async () => {
      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      expect(result.nknAnalysis).toBeDefined();
      expect(result.nknAnalysis.probabilityPredictions).toEqual([]);
      expect(result.nknAnalysis.patternRecognition).toEqual([]);
      expect(result.nknAnalysis.confidenceScore).toBe(0);
    });

    it('should perform NKN analysis when enabled', async () => {
      // Enable NKN
      engine.updateConfig({
        nkn: {
          enabled: true,
          networkDepth: 2, // Smaller for testing
          trainingPeriod: 50,
          predictionHorizon: 5,
          confidenceThreshold: 0.5,
        },
      });

      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      expect(result.nknAnalysis).toBeDefined();
      expect(Array.isArray(result.nknAnalysis.probabilityPredictions)).toBe(true);
      expect(Array.isArray(result.nknAnalysis.patternRecognition)).toBe(true);
      expect(typeof result.nknAnalysis.confidenceScore).toBe('number');
    });
  });

  describe('Confluence Zone Creation', () => {
    it('should create advanced confluence zones', async () => {
      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      expect(result.confluence).toBeDefined();
      expect(Array.isArray(result.confluence)).toBe(true);
      
      if (result.confluence.length > 0) {
        const zone = result.confluence[0];
        expect(zone.priceLevel).toBeGreaterThan(0);
        expect(zone.strength).toBeGreaterThanOrEqual(0);
        expect(zone.strength).toBeLessThanOrEqual(1);
        expect(['support', 'resistance', 'reversal']).toContain(zone.type);
        expect(Array.isArray(zone.factors)).toBe(true);
      }
    });

    it('should sort confluence zones by strength', async () => {
      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      if (result.confluence.length > 1) {
        for (let i = 0; i < result.confluence.length - 1; i++) {
          expect(result.confluence[i].strength).toBeGreaterThanOrEqual(
            result.confluence[i + 1].strength
          );
        }
      }
    });
  });

  describe('Market Regime Analysis', () => {
    it('should determine advanced market regime', async () => {
      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      expect(result.marketRegime).toBeDefined();
      expect(['trending', 'ranging', 'breakout', 'reversal']).toContain(result.marketRegime.type);
      expect(result.marketRegime.strength).toBeGreaterThanOrEqual(0);
      expect(result.marketRegime.strength).toBeLessThanOrEqual(1);
      expect(result.marketRegime.confidence).toBeGreaterThanOrEqual(0);
      expect(result.marketRegime.confidence).toBeLessThanOrEqual(1);
      expect(['low', 'medium', 'high']).toContain(result.marketRegime.volatility);
      expect(['low', 'medium', 'high']).toContain(result.marketRegime.volume);
    });

    it('should identify trending regime in trending data', async () => {
      const trendingCandles = generateTrendingCandles(100, 'up');
      const result = await engine.performAdvancedAnalysis(trendingCandles);
      
      // Should have some indication of trending behavior
      expect(result.marketRegime.type).toBeDefined();
      expect(result.marketRegime.strength).toBeGreaterThan(0);
    });
  });

  describe('Volume Profile Calculation', () => {
    it('should calculate volume profile', async () => {
      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      expect(result.volumeProfile).toBeDefined();
      expect(Array.isArray(result.volumeProfile.volumeByPrice)).toBe(true);
      expect(result.volumeProfile.poc).toBeGreaterThan(0);
      expect(result.volumeProfile.valueAreaHigh).toBeGreaterThan(result.volumeProfile.valueAreaLow);
      expect(['increasing', 'decreasing', 'stable']).toContain(result.volumeProfile.volumeTrend);
      expect(result.volumeProfile.volumeStrength).toBeGreaterThanOrEqual(0);
    });

    it('should have valid volume nodes', async () => {
      const result = await engine.performAdvancedAnalysis(mockCandles);
      
      if (result.volumeProfile.volumeByPrice.length > 0) {
        const node = result.volumeProfile.volumeByPrice[0];
        expect(node.price).toBeGreaterThan(0);
        expect(node.volume).toBeGreaterThanOrEqual(0);
        expect(node.percentage).toBeGreaterThanOrEqual(0);
        expect(node.percentage).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig = {
        elliottWave: {
          minWaveLength: 15,
          probabilityThreshold: 0.8,
        },
      };

      engine.updateConfig(newConfig);
      const config = engine.getConfig();
      
      expect(config.elliottWave.minWaveLength).toBe(15);
      expect(config.elliottWave.probabilityThreshold).toBe(0.8);
    });

    it('should emit config update events', (done) => {
      engine.once('configUpdated', (config) => {
        expect(config).toBeDefined();
        expect(config.elliottWave.minWaveLength).toBe(20);
        done();
      });

      engine.updateConfig({
        elliottWave: {
          minWaveLength: 20,
        },
      });
    });

    it('should get current configuration', () => {
      const config = engine.getConfig();
      
      expect(config).toBeDefined();
      expect(config.indicators).toBeDefined();
      expect(config.elliottWave).toBeDefined();
      expect(config.fibonacci).toBeDefined();
      expect(config.patterns).toBeDefined();
      expect(config.pivotChannels).toBeDefined();
      expect(config.linearRegression).toBeDefined();
      expect(config.nkn).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle empty candle data', async () => {
      await expect(engine.performAdvancedAnalysis([]))
        .rejects.toThrow('No candle data provided');
    });

    it('should handle invalid candle data', async () => {
      const invalidCandles = [
        {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          timestamp: Date.now(),
          open: -100, // Invalid negative price
          high: 100,
          low: 50,
          close: 75,
          volume: 1000,
        },
      ] as CandleData[];

      await expect(engine.performAdvancedAnalysis(invalidCandles))
        .rejects.toThrow();
    });

    it('should emit error events', (done) => {
      engine.once('analysisError', (error) => {
        expect(error).toBeDefined();
        done();
      });

      // Trigger an error with invalid data
      engine.performAdvancedAnalysis([]).catch(() => {
        // Error is expected and handled by event listener
      });
    });
  });

  describe('Performance', () => {
    it('should complete analysis within reasonable time', async () => {
      const startTime = Date.now();
      await engine.performAdvancedAnalysis(mockCandles);
      const endTime = Date.now();
      
      const analysisTime = endTime - startTime;
      expect(analysisTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle large datasets', async () => {
      const largeDataset = generateMockCandles(500);
      
      const startTime = Date.now();
      const result = await engine.performAdvancedAnalysis(largeDataset);
      const endTime = Date.now();
      
      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(30000); // Should complete within 30 seconds
    });
  });
});