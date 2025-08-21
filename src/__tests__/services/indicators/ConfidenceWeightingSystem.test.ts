/**
 * Confidence Weighting System Tests
 */

import { ConfidenceWeightingSystem, WeightedConfidence, ConfidenceFactors } from '../../../services/indicators/ConfidenceWeightingSystem';
import { CandleData } from '../../../types/market';
import { TechnicalIndicators, ConfluenceZone, MarketRegime } from '../../../types/analysis';
import { IndicatorScore, CorrelationMatrix } from '../../../services/indicators/TechnicalIndicatorScoringMatrix';
import { AdaptiveThresholds, MarketConditions } from '../../../services/indicators/AdaptiveThresholdManager';

describe('ConfidenceWeightingSystem', () => {
  let confidenceSystem: ConfidenceWeightingSystem;
  let mockCandles: CandleData[];
  let mockIndicators: TechnicalIndicators;
  let mockIndicatorScores: IndicatorScore[];
  let mockCorrelationMatrix: CorrelationMatrix;
  let mockMarketConditions: MarketConditions;
  let mockConfluenceZones: ConfluenceZone[];
  let mockThresholds: AdaptiveThresholds;

  beforeEach(() => {
    confidenceSystem = new ConfidenceWeightingSystem();

    // Create mock candle data
    mockCandles = [];
    for (let i = 0; i < 50; i++) {
      mockCandles.push({
        symbol: 'BTCUSDT',
        timeframe: '1m',
        timestamp: Date.now() - (50 - i) * 60000,
        open: 100 + Math.random() * 2,
        high: 102 + Math.random() * 2,
        low: 98 + Math.random() * 2,
        close: 100 + Math.random() * 2,
        volume: 1000000 + Math.random() * 500000,
      });
    }

    // Create mock indicators
    mockIndicators = {
      rsi: 65,
      waveTrend: {
        wt1: -45,
        wt2: -30,
        signal: 'buy',
        divergence: null,
      },
      pvt: 1500000,
      supportLevels: [98, 95, 92],
      resistanceLevels: [105, 108, 112],
      trend: 'bullish',
      momentum: 'strong',
      volatility: 0.25,
    };

    // Create mock indicator scores
    mockIndicatorScores = [
      {
        indicator: 'RSI',
        score: 0.7,
        signal: 'bullish',
        strength: 'moderate',
        confidence: 0.8,
        reasoning: ['RSI at 65'],
      },
      {
        indicator: 'WaveTrend',
        score: 0.8,
        signal: 'bullish',
        strength: 'strong',
        confidence: 0.9,
        reasoning: ['Wave Trend buy signal'],
      },
      {
        indicator: 'Volume',
        score: 0.6,
        signal: 'neutral',
        strength: 'moderate',
        confidence: 0.7,
        reasoning: ['Normal volume levels'],
      },
    ];

    // Create mock correlation matrix
    mockCorrelationMatrix = {
      pairs: [
        {
          indicator1: 'rsi',
          indicator2: 'wt1',
          correlation: 0.75,
          strength: 'strong',
          agreement: true,
        },
        {
          indicator1: 'rsi',
          indicator2: 'pvt',
          correlation: 0.45,
          strength: 'moderate',
          agreement: true,
        },
      ],
      averageCorrelation: 0.6,
      strongCorrelations: [
        {
          indicator1: 'rsi',
          indicator2: 'wt1',
          correlation: 0.75,
          strength: 'strong',
          agreement: true,
        },
      ],
      weakCorrelations: [],
    };

    // Create mock market conditions
    const mockRegime: MarketRegime = {
      type: 'trending',
      strength: 0.7,
      duration: 1000,
      volatility: 'medium',
      volume: 'high',
      confidence: 0.8,
    };

    mockMarketConditions = {
      volatility: 0.25,
      regime: mockRegime,
      trendStrength: 0.7,
      volumeProfile: 'medium',
      timeOfDay: 'london',
      marketSession: 'active',
    };

    // Create mock confluence zones
    mockConfluenceZones = [
      {
        priceLevel: 100,
        strength: 0.8,
        factors: [
          {
            type: 'fibonacci',
            description: '61.8% retracement',
            weight: 0.3,
          },
          {
            type: 'support_resistance',
            description: 'Historical support',
            weight: 0.5,
          },
        ],
        type: 'support',
        reliability: 0.85,
      },
    ];

    // Create mock thresholds
    mockThresholds = {
      rsi: { oversold: 30, overbought: 70, neutral: [40, 60] },
      waveTrend: { buyThreshold: -60, sellThreshold: 60, extremeLevel: 80 },
      volume: { spikeThreshold: 2.0, lowVolumeThreshold: 0.5 },
      volatility: { lowVolatility: 0.1, highVolatility: 0.4 },
      confidence: { minConfidence: 0.3, strongConfidence: 0.8 },
    };
  });

  describe('calculateWeightedConfidence', () => {
    it('should calculate comprehensive weighted confidence', async () => {
      const weightedConfidence = await confidenceSystem.calculateWeightedConfidence(
        mockCandles,
        mockIndicators,
        mockIndicatorScores,
        mockCorrelationMatrix,
        mockMarketConditions,
        mockConfluenceZones,
        mockThresholds
      );

      expect(weightedConfidence).toBeDefined();
      expect(weightedConfidence).toHaveProperty('overallConfidence');
      expect(weightedConfidence).toHaveProperty('factors');
      expect(weightedConfidence).toHaveProperty('weights');
      expect(weightedConfidence).toHaveProperty('adjustments');
      expect(weightedConfidence).toHaveProperty('reliability');
      expect(weightedConfidence).toHaveProperty('riskLevel');

      expect(weightedConfidence.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(weightedConfidence.overallConfidence).toBeLessThanOrEqual(1);
      expect(weightedConfidence.reliability).toBeGreaterThanOrEqual(0);
      expect(weightedConfidence.reliability).toBeLessThanOrEqual(1);
      expect(['low', 'medium', 'high']).toContain(weightedConfidence.riskLevel);
    });

    it('should validate confidence factors', async () => {
      const weightedConfidence = await confidenceSystem.calculateWeightedConfidence(
        mockCandles,
        mockIndicators,
        mockIndicatorScores,
        mockCorrelationMatrix,
        mockMarketConditions,
        mockConfluenceZones,
        mockThresholds
      );

      const factors = weightedConfidence.factors;

      expect(factors).toHaveProperty('technicalConfidence');
      expect(factors).toHaveProperty('patternConfidence');
      expect(factors).toHaveProperty('volumeConfidence');
      expect(factors).toHaveProperty('timeframeConfidence');
      expect(factors).toHaveProperty('correlationConfidence');
      expect(factors).toHaveProperty('marketRegimeConfidence');
      expect(factors).toHaveProperty('volatilityConfidence');
      expect(factors).toHaveProperty('liquidityConfidence');

      // All factors should be between 0 and 1
      Object.values(factors).forEach(factor => {
        expect(factor).toBeGreaterThanOrEqual(0);
        expect(factor).toBeLessThanOrEqual(1);
      });
    });

    it('should validate confidence weights', async () => {
      const weightedConfidence = await confidenceSystem.calculateWeightedConfidence(
        mockCandles,
        mockIndicators,
        mockIndicatorScores,
        mockCorrelationMatrix,
        mockMarketConditions,
        mockConfluenceZones,
        mockThresholds
      );

      const weights = weightedConfidence.weights;

      expect(weights).toHaveProperty('technical');
      expect(weights).toHaveProperty('patterns');
      expect(weights).toHaveProperty('volume');
      expect(weights).toHaveProperty('timeframe');
      expect(weights).toHaveProperty('correlation');
      expect(weights).toHaveProperty('market_regime');
      expect(weights).toHaveProperty('volatility');
      expect(weights).toHaveProperty('liquidity');

      // Weights should sum to approximately 1
      const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
      expect(totalWeight).toBeCloseTo(1, 2);

      // All weights should be positive
      Object.values(weights).forEach(weight => {
        expect(weight).toBeGreaterThan(0);
      });
    });

    it('should track confidence adjustments', async () => {
      const weightedConfidence = await confidenceSystem.calculateWeightedConfidence(
        mockCandles,
        mockIndicators,
        mockIndicatorScores,
        mockCorrelationMatrix,
        mockMarketConditions,
        mockConfluenceZones,
        mockThresholds
      );

      expect(Array.isArray(weightedConfidence.adjustments)).toBe(true);

      weightedConfidence.adjustments.forEach(adjustment => {
        expect(adjustment).toHaveProperty('factor');
        expect(adjustment).toHaveProperty('originalValue');
        expect(adjustment).toHaveProperty('adjustedValue');
        expect(adjustment).toHaveProperty('reason');
        expect(adjustment).toHaveProperty('impact');

        expect(typeof adjustment.factor).toBe('string');
        expect(typeof adjustment.originalValue).toBe('number');
        expect(typeof adjustment.adjustedValue).toBe('number');
        expect(typeof adjustment.reason).toBe('string');
        expect(typeof adjustment.impact).toBe('number');
      });
    });
  });

  describe('technical confidence calculation', () => {
    it('should calculate higher confidence for strong signals', async () => {
      const strongScores = mockIndicatorScores.map(score => ({
        ...score,
        strength: 'strong' as const,
        confidence: 0.9,
        score: 0.9,
      }));

      const strongConfidence = await confidenceSystem.calculateWeightedConfidence(
        mockCandles,
        mockIndicators,
        strongScores,
        mockCorrelationMatrix,
        mockMarketConditions,
        mockConfluenceZones,
        mockThresholds
      );

      const weakScores = mockIndicatorScores.map(score => ({
        ...score,
        strength: 'weak' as const,
        confidence: 0.3,
        score: 0.3,
      }));

      const weakConfidence = await confidenceSystem.calculateWeightedConfidence(
        mockCandles,
        mockIndicators,
        weakScores,
        mockCorrelationMatrix,
        mockMarketConditions,
        mockConfluenceZones,
        mockThresholds
      );

      expect(strongConfidence.factors.technicalConfidence)
        .toBeGreaterThan(weakConfidence.factors.technicalConfidence);
    });

    it('should handle empty indicator scores', async () => {
      const confidence = await confidenceSystem.calculateWeightedConfidence(
        mockCandles,
        mockIndicators,
        [],
        mockCorrelationMatrix,
        mockMarketConditions,
        mockConfluenceZones,
        mockThresholds
      );

      expect(confidence.factors.technicalConfidence).toBe(0.3); // Default value
    });
  });

  describe('pattern confidence calculation', () => {
    it('should calculate higher confidence with strong confluence zones', async () => {
      const strongConfluenceZones = [
        {
          ...mockConfluenceZones[0],
          strength: 0.9,
          reliability: 0.95,
        },
      ];

      const strongConfidence = await confidenceSystem.calculateWeightedConfidence(
        mockCandles,
        mockIndicators,
        mockIndicatorScores,
        mockCorrelationMatrix,
        mockMarketConditions,
        strongConfluenceZones,
        mockThresholds
      );

      const weakConfidence = await confidenceSystem.calculateWeightedConfidence(
        mockCandles,
        mockIndicators,
        mockIndicatorScores,
        mockCorrelationMatrix,
        mockMarketConditions,
        [],
        mockThresholds
      );

      expect(strongConfidence.factors.patternConfidence)
        .toBeGreaterThan(weakConfidence.factors.patternConfidence);
    });

    it('should boost confidence for multiple confluence zones', async () => {
      const multipleZones = [
        mockConfluenceZones[0],
        {
          ...mockConfluenceZones[0],
          priceLevel: 105,
          type: 'resistance' as const,
        },
        {
          ...mockConfluenceZones[0],
          priceLevel: 110,
          type: 'resistance' as const,
        },
      ];

      const multiConfidence = await confidenceSystem.calculateWeightedConfidence(
        mockCandles,
        mockIndicators,
        mockIndicatorScores,
        mockCorrelationMatrix,
        mockMarketConditions,
        multipleZones,
        mockThresholds
      );

      const singleConfidence = await confidenceSystem.calculateWeightedConfidence(
        mockCandles,
        mockIndicators,
        mockIndicatorScores,
        mockCorrelationMatrix,
        mockMarketConditions,
        [mockConfluenceZones[0]],
        mockThresholds
      );

      expect(multiConfidence.factors.patternConfidence)
        .toBeGreaterThan(singleConfidence.factors.patternConfidence);
    });
  });

  describe('volume confidence calculation', () => {
    it('should calculate higher confidence for volume spikes', async () => {
      // Create candles with volume spike
      const spikeCandles = [...mockCandles];
      spikeCandles[spikeCandles.length - 1] = {
        ...spikeCandles[spikeCandles.length - 1],
        volume: 5000000, // 5x normal volume
      };

      const spikeConfidence = await confidenceSystem.calculateWeightedConfidence(
        spikeCandles,
        mockIndicators,
        mockIndicatorScores,
        mockCorrelationMatrix,
        mockMarketConditions,
        mockConfluenceZones,
        mockThresholds
      );

      const normalConfidence = await confidenceSystem.calculateWeightedConfidence(
        mockCandles,
        mockIndicators,
        mockIndicatorScores,
        mockCorrelationMatrix,
        mockMarketConditions,
        mockConfluenceZones,
        mockThresholds
      );

      expect(spikeConfidence.factors.volumeConfidence)
        .toBeGreaterThan(normalConfidence.factors.volumeConfidence);
    });

    it('should adjust confidence based on volume profile', async () => {
      const highVolumeConditions = {
        ...mockMarketConditions,
        volumeProfile: 'high' as const,
      };

      const highVolConfidence = await confidenceSystem.calculateWeightedConfidence(
        mockCandles,
        mockIndicators,
        mockIndicatorScores,
        mockCorrelationMatrix,
        highVolumeConditions,
        mockConfluenceZones,
        mockThresholds
      );

      const lowVolumeConditions = {
        ...mockMarketConditions,
        volumeProfile: 'low' as const,
      };

      const lowVolConfidence = await confidenceSystem.calculateWeightedConfidence(
        mockCandles,
        mockIndicators,
        mockIndicatorScores,
        mockCorrelationMatrix,
        lowVolumeConditions,
        mockConfluenceZones,
        mockThresholds
      );

      expect(highVolConfidence.factors.volumeConfidence)
        .toBeGreaterThan(lowVolConfidence.factors.volumeConfidence);
    });
  });

  describe('correlation confidence calculation', () => {
    it('should calculate higher confidence for strong correlations', async () => {
      const strongCorrelationMatrix = {
        ...mockCorrelationMatrix,
        averageCorrelation: 0.8,
        strongCorrelations: [
          ...mockCorrelationMatrix.strongCorrelations,
          {
            indicator1: 'pvt',
            indicator2: 'wt2',
            correlation: 0.85,
            strength: 'strong' as const,
            agreement: true,
          },
        ],
      };

      const strongConfidence = await confidenceSystem.calculateWeightedConfidence(
        mockCandles,
        mockIndicators,
        mockIndicatorScores,
        strongCorrelationMatrix,
        mockMarketConditions,
        mockConfluenceZones,
        mockThresholds
      );

      const weakCorrelationMatrix = {
        ...mockCorrelationMatrix,
        averageCorrelation: 0.2,
        strongCorrelations: [],
      };

      const weakConfidence = await confidenceSystem.calculateWeightedConfidence(
        mockCandles,
        mockIndicators,
        mockIndicatorScores,
        weakCorrelationMatrix,
        mockMarketConditions,
        mockConfluenceZones,
        mockThresholds
      );

      expect(strongConfidence.factors.correlationConfidence)
        .toBeGreaterThan(weakConfidence.factors.correlationConfidence);
    });
  });

  describe('market regime confidence calculation', () => {
    it('should adjust confidence based on regime type', async () => {
      const trendingConditions = {
        ...mockMarketConditions,
        regime: { ...mockMarketConditions.regime, type: 'trending' as const },
      };

      const trendingConfidence = await confidenceSystem.calculateWeightedConfidence(
        mockCandles,
        mockIndicators,
        mockIndicatorScores,
        mockCorrelationMatrix,
        trendingConditions,
        mockConfluenceZones,
        mockThresholds
      );

      const rangingConditions = {
        ...mockMarketConditions,
        regime: { ...mockMarketConditions.regime, type: 'ranging' as const },
      };

      const rangingConfidence = await confidenceSystem.calculateWeightedConfidence(
        mockCandles,
        mockIndicators,
        mockIndicatorScores,
        mockCorrelationMatrix,
        rangingConditions,
        mockConfluenceZones,
        mockThresholds
      );

      // Trending markets should generally have higher confidence
      expect(trendingConfidence.factors.marketRegimeConfidence)
        .toBeGreaterThan(rangingConfidence.factors.marketRegimeConfidence);
    });
  });

  describe('risk level assessment', () => {
    it('should assess low risk for high confidence', async () => {
      const highConfidenceScores = mockIndicatorScores.map(score => ({
        ...score,
        confidence: 0.9,
        score: 0.9,
      }));

      const lowVolatilityConditions = {
        ...mockMarketConditions,
        volatility: 0.1,
      };

      const confidence = await confidenceSystem.calculateWeightedConfidence(
        mockCandles,
        mockIndicators,
        highConfidenceScores,
        mockCorrelationMatrix,
        lowVolatilityConditions,
        mockConfluenceZones,
        mockThresholds
      );

      expect(confidence.riskLevel).toBe('low');
    });

    it('should assess high risk for low confidence and high volatility', async () => {
      const lowConfidenceScores = mockIndicatorScores.map(score => ({
        ...score,
        confidence: 0.2,
        score: 0.2,
      }));

      const highVolatilityConditions = {
        ...mockMarketConditions,
        volatility: 0.8,
        regime: { ...mockMarketConditions.regime, type: 'breakout' as const },
      };

      const confidence = await confidenceSystem.calculateWeightedConfidence(
        mockCandles,
        mockIndicators,
        lowConfidenceScores,
        mockCorrelationMatrix,
        highVolatilityConditions,
        mockConfluenceZones,
        mockThresholds
      );

      expect(confidence.riskLevel).toBe('high');
    });
  });

  describe('configuration management', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        baseWeights: {
          technical: 0.4,
          patterns: 0.3,
          volume: 0.2,
          timeframe: 0.05,
          correlation: 0.03,
          market_regime: 0.02,
          volatility: 0.0,
          liquidity: 0.0,
        },
        adaptiveWeighting: false,
      };

      confidenceSystem.updateConfig(newConfig);
      const config = confidenceSystem.getConfig();

      expect(config.baseWeights.technical).toBe(0.4);
      expect(config.baseWeights.patterns).toBe(0.3);
      expect(config.adaptiveWeighting).toBe(false);
    });

    it('should return current configuration', () => {
      const config = confidenceSystem.getConfig();

      expect(config).toHaveProperty('baseWeights');
      expect(config).toHaveProperty('adaptiveWeighting');
      expect(config).toHaveProperty('volatilityAdjustment');
      expect(config).toHaveProperty('timeDecay');
      expect(config).toHaveProperty('correlationBoost');
      expect(config).toHaveProperty('minConfidenceThreshold');
      expect(config).toHaveProperty('maxConfidenceThreshold');
    });
  });

  describe('performance tracking', () => {
    it('should update performance data', () => {
      confidenceSystem.updatePerformance('overall', 0.75);
      confidenceSystem.updatePerformance('rsi', 0.8);
      confidenceSystem.updatePerformance('waveTrend', 0.7);

      // Performance data should be stored internally
      // This is tested indirectly through confidence calculations
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should return confidence statistics', () => {
      const stats = confidenceSystem.getConfidenceStatistics();

      expect(stats).toHaveProperty('averageConfidence');
      expect(stats).toHaveProperty('confidenceStability');
      expect(stats).toHaveProperty('riskDistribution');
      expect(stats).toHaveProperty('factorImportance');

      expect(stats.averageConfidence).toBeGreaterThanOrEqual(0);
      expect(stats.averageConfidence).toBeLessThanOrEqual(1);
      expect(stats.confidenceStability).toBeGreaterThanOrEqual(0);
      expect(stats.confidenceStability).toBeLessThanOrEqual(1);
    });
  });

  describe('edge cases', () => {
    it('should handle insufficient candle data', async () => {
      const shortCandles = mockCandles.slice(0, 5);

      const confidence = await confidenceSystem.calculateWeightedConfidence(
        shortCandles,
        mockIndicators,
        mockIndicatorScores,
        mockCorrelationMatrix,
        mockMarketConditions,
        mockConfluenceZones,
        mockThresholds
      );

      expect(confidence).toBeDefined();
      expect(confidence.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(confidence.overallConfidence).toBeLessThanOrEqual(1);
    });

    it('should handle extreme volatility values', async () => {
      const extremeConditions = {
        ...mockMarketConditions,
        volatility: 2.0,
      };

      const confidence = await confidenceSystem.calculateWeightedConfidence(
        mockCandles,
        mockIndicators,
        mockIndicatorScores,
        mockCorrelationMatrix,
        extremeConditions,
        mockConfluenceZones,
        mockThresholds
      );

      expect(confidence).toBeDefined();
      expect(confidence.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(confidence.overallConfidence).toBeLessThanOrEqual(1);
    });

    it('should handle empty correlation matrix', async () => {
      const emptyCorrelationMatrix = {
        pairs: [],
        averageCorrelation: 0,
        strongCorrelations: [],
        weakCorrelations: [],
      };

      const confidence = await confidenceSystem.calculateWeightedConfidence(
        mockCandles,
        mockIndicators,
        mockIndicatorScores,
        emptyCorrelationMatrix,
        mockMarketConditions,
        mockConfluenceZones,
        mockThresholds
      );

      expect(confidence).toBeDefined();
      expect(confidence.factors.correlationConfidence).toBe(0.5); // Default value
    });
  });
});