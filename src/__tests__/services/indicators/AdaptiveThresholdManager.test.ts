/**
 * Adaptive Threshold Manager Tests
 */

import { AdaptiveThresholdManager, AdaptiveThresholds, MarketConditions } from '../../../services/indicators/AdaptiveThresholdManager';
import { CandleData } from '../../../types/market';
import { TechnicalIndicators, MarketRegime } from '../../../types/analysis';

describe('AdaptiveThresholdManager', () => {
  let thresholdManager: AdaptiveThresholdManager;
  let baseThresholds: AdaptiveThresholds;
  let mockCandles: CandleData[];
  let mockIndicators: TechnicalIndicators[];
  let mockMarketConditions: MarketConditions;

  beforeEach(() => {
    baseThresholds = {
      rsi: { oversold: 30, overbought: 70, neutral: [40, 60] },
      waveTrend: { buyThreshold: -60, sellThreshold: 60, extremeLevel: 80 },
      volume: { spikeThreshold: 2.0, lowVolumeThreshold: 0.5 },
      volatility: { lowVolatility: 0.1, highVolatility: 0.4 },
      confidence: { minConfidence: 0.3, strongConfidence: 0.8 },
    };

    thresholdManager = new AdaptiveThresholdManager(baseThresholds);

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
    mockIndicators = [];
    for (let i = 0; i < 30; i++) {
      mockIndicators.push({
        rsi: 30 + Math.random() * 40,
        waveTrend: {
          wt1: -80 + Math.random() * 160,
          wt2: -80 + Math.random() * 160,
          signal: Math.random() > 0.5 ? 'buy' : Math.random() > 0.5 ? 'sell' : 'neutral',
          divergence: null,
        },
        pvt: 1000000 + Math.random() * 1000000,
        supportLevels: [95, 98],
        resistanceLevels: [105, 108],
        trend: Math.random() > 0.5 ? 'bullish' : Math.random() > 0.5 ? 'bearish' : 'sideways',
        momentum: Math.random() > 0.5 ? 'strong' : Math.random() > 0.5 ? 'weak' : 'neutral',
        volatility: 0.1 + Math.random() * 0.3,
      });
    }

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
  });

  describe('updateThresholds', () => {
    it('should update thresholds based on market conditions', async () => {
      const updatedThresholds = await thresholdManager.updateThresholds(
        mockCandles,
        mockIndicators,
        mockMarketConditions
      );

      expect(updatedThresholds).toBeDefined();
      expect(updatedThresholds).toHaveProperty('rsi');
      expect(updatedThresholds).toHaveProperty('waveTrend');
      expect(updatedThresholds).toHaveProperty('volume');
      expect(updatedThresholds).toHaveProperty('volatility');
      expect(updatedThresholds).toHaveProperty('confidence');

      // Thresholds should be within reasonable ranges
      expect(updatedThresholds.rsi.oversold).toBeGreaterThan(10);
      expect(updatedThresholds.rsi.oversold).toBeLessThan(50);
      expect(updatedThresholds.rsi.overbought).toBeGreaterThan(50);
      expect(updatedThresholds.rsi.overbought).toBeLessThan(90);
    });

    it('should adjust RSI thresholds based on volatility', async () => {
      // Test with high volatility
      const highVolConditions = {
        ...mockMarketConditions,
        volatility: 0.6,
      };

      const highVolThresholds = await thresholdManager.updateThresholds(
        mockCandles,
        mockIndicators,
        highVolConditions
      );

      // Test with low volatility
      const lowVolConditions = {
        ...mockMarketConditions,
        volatility: 0.05,
      };

      const lowVolThresholds = await thresholdManager.updateThresholds(
        mockCandles,
        mockIndicators,
        lowVolConditions
      );

      // High volatility should generally lead to wider thresholds
      expect(highVolThresholds.rsi.overbought).toBeGreaterThanOrEqual(lowVolThresholds.rsi.overbought);
      expect(highVolThresholds.rsi.oversold).toBeLessThanOrEqual(lowVolThresholds.rsi.oversold);
    });

    it('should adjust thresholds based on market regime', async () => {
      // Test trending market
      const trendingConditions = {
        ...mockMarketConditions,
        regime: { ...mockMarketConditions.regime, type: 'trending' as const },
      };

      const trendingThresholds = await thresholdManager.updateThresholds(
        mockCandles,
        mockIndicators,
        trendingConditions
      );

      // Test ranging market
      const rangingConditions = {
        ...mockMarketConditions,
        regime: { ...mockMarketConditions.regime, type: 'ranging' as const },
      };

      const rangingThresholds = await thresholdManager.updateThresholds(
        mockCandles,
        mockIndicators,
        rangingConditions
      );

      // Thresholds should be different for different regimes
      expect(trendingThresholds).not.toEqual(rangingThresholds);
    });

    it('should adjust thresholds based on time of day', async () => {
      // Test London session
      const londonConditions = {
        ...mockMarketConditions,
        timeOfDay: 'london' as const,
      };

      const londonThresholds = await thresholdManager.updateThresholds(
        mockCandles,
        mockIndicators,
        londonConditions
      );

      // Test Asian session
      const asianConditions = {
        ...mockMarketConditions,
        timeOfDay: 'asian' as const,
      };

      const asianThresholds = await thresholdManager.updateThresholds(
        mockCandles,
        mockIndicators,
        asianConditions
      );

      // Different sessions should produce different thresholds
      expect(londonThresholds).not.toEqual(asianThresholds);
    });

    it('should handle insufficient data gracefully', async () => {
      const shortCandles = mockCandles.slice(0, 5);
      const shortIndicators = mockIndicators.slice(0, 5);

      const thresholds = await thresholdManager.updateThresholds(
        shortCandles,
        shortIndicators,
        mockMarketConditions
      );

      // Should return current thresholds without updates
      expect(thresholds).toBeDefined();
    });
  });

  describe('threshold adjustment logic', () => {
    it('should not exceed maximum adjustment limits', async () => {
      // Create extreme market conditions
      const extremeConditions = {
        ...mockMarketConditions,
        volatility: 2.0, // Very high volatility
        regime: { ...mockMarketConditions.regime, type: 'breakout' as const },
        timeOfDay: 'overlap' as const,
      };

      const adjustedThresholds = await thresholdManager.updateThresholds(
        mockCandles,
        mockIndicators,
        extremeConditions
      );

      // Check that adjustments are within reasonable bounds
      const maxAdjustment = 0.5; // 50% max adjustment from config
      
      expect(adjustedThresholds.rsi.oversold).toBeGreaterThan(baseThresholds.rsi.oversold * (1 - maxAdjustment));
      expect(adjustedThresholds.rsi.oversold).toBeLessThan(baseThresholds.rsi.oversold * (1 + maxAdjustment));
      expect(adjustedThresholds.rsi.overbought).toBeGreaterThan(baseThresholds.rsi.overbought * (1 - maxAdjustment));
      expect(adjustedThresholds.rsi.overbought).toBeLessThan(baseThresholds.rsi.overbought * (1 + maxAdjustment));
    });

    it('should smooth threshold changes over time', async () => {
      const initialThresholds = thresholdManager.getCurrentThresholds();
      
      // Apply multiple updates
      for (let i = 0; i < 5; i++) {
        await thresholdManager.updateThresholds(
          mockCandles,
          mockIndicators,
          mockMarketConditions
        );
      }

      const finalThresholds = thresholdManager.getCurrentThresholds();
      
      // Changes should be gradual, not sudden
      const rsiChange = Math.abs(finalThresholds.rsi.oversold - initialThresholds.rsi.oversold);
      expect(rsiChange).toBeLessThan(10); // Should not change drastically
    });
  });

  describe('configuration management', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        adaptationSpeed: 0.5,
        maxAdjustment: 0.3,
        volatilityWindow: 30,
      };

      thresholdManager.updateConfig(newConfig);
      const config = thresholdManager.getConfig();

      expect(config.adaptationSpeed).toBe(0.5);
      expect(config.maxAdjustment).toBe(0.3);
      expect(config.volatilityWindow).toBe(30);
    });

    it('should return current configuration', () => {
      const config = thresholdManager.getConfig();

      expect(config).toHaveProperty('volatilityWindow');
      expect(config).toHaveProperty('adaptationSpeed');
      expect(config).toHaveProperty('maxAdjustment');
      expect(config).toHaveProperty('minDataPoints');
      expect(config).toHaveProperty('sessionAdjustments');
      expect(config).toHaveProperty('regimeAdjustments');
    });
  });

  describe('threshold retrieval', () => {
    it('should return current thresholds', () => {
      const currentThresholds = thresholdManager.getCurrentThresholds();

      expect(currentThresholds).toHaveProperty('rsi');
      expect(currentThresholds).toHaveProperty('waveTrend');
      expect(currentThresholds).toHaveProperty('volume');
      expect(currentThresholds).toHaveProperty('volatility');
      expect(currentThresholds).toHaveProperty('confidence');
    });

    it('should return base thresholds', () => {
      const baseThresholdsReturned = thresholdManager.getBaseThresholds();

      expect(baseThresholdsReturned).toEqual(baseThresholds);
    });

    it('should track adjustment history', async () => {
      await thresholdManager.updateThresholds(
        mockCandles,
        mockIndicators,
        mockMarketConditions
      );

      const history = thresholdManager.getAdjustmentHistory();

      expect(Array.isArray(history)).toBe(true);
      
      history.forEach(adjustment => {
        expect(adjustment).toHaveProperty('indicator');
        expect(adjustment).toHaveProperty('originalValue');
        expect(adjustment).toHaveProperty('adjustedValue');
        expect(adjustment).toHaveProperty('adjustmentFactor');
        expect(adjustment).toHaveProperty('reason');
      });
    });
  });

  describe('reset functionality', () => {
    it('should reset thresholds to base values', async () => {
      // Make some adjustments
      await thresholdManager.updateThresholds(
        mockCandles,
        mockIndicators,
        mockMarketConditions
      );

      const adjustedThresholds = thresholdManager.getCurrentThresholds();
      
      // Reset
      thresholdManager.resetThresholds();
      
      const resetThresholds = thresholdManager.getCurrentThresholds();
      const history = thresholdManager.getAdjustmentHistory();

      expect(resetThresholds).toEqual(baseThresholds);
      expect(history).toEqual([]);
    });
  });

  describe('effectiveness metrics', () => {
    it('should calculate effectiveness metrics', async () => {
      // Make some adjustments to generate history
      for (let i = 0; i < 3; i++) {
        await thresholdManager.updateThresholds(
          mockCandles,
          mockIndicators,
          mockMarketConditions
        );
      }

      const metrics = thresholdManager.getEffectivenessMetrics();

      expect(metrics).toHaveProperty('totalAdjustments');
      expect(metrics).toHaveProperty('averageAdjustment');
      expect(metrics).toHaveProperty('mostAdjustedIndicator');
      expect(metrics).toHaveProperty('stabilityScore');

      expect(metrics.totalAdjustments).toBeGreaterThanOrEqual(0);
      expect(metrics.averageAdjustment).toBeGreaterThanOrEqual(0);
      expect(typeof metrics.mostAdjustedIndicator).toBe('string');
      expect(metrics.stabilityScore).toBeGreaterThanOrEqual(0);
      expect(metrics.stabilityScore).toBeLessThanOrEqual(1);
    });

    it('should return default metrics when no adjustments made', () => {
      const metrics = thresholdManager.getEffectivenessMetrics();

      expect(metrics.totalAdjustments).toBe(0);
      expect(metrics.averageAdjustment).toBe(0);
      expect(metrics.mostAdjustedIndicator).toBe('none');
      expect(metrics.stabilityScore).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle extreme volatility values', async () => {
      const extremeConditions = {
        ...mockMarketConditions,
        volatility: 10.0, // Extremely high volatility
      };

      const thresholds = await thresholdManager.updateThresholds(
        mockCandles,
        mockIndicators,
        extremeConditions
      );

      expect(thresholds).toBeDefined();
      expect(thresholds.rsi.oversold).toBeGreaterThan(0);
      expect(thresholds.rsi.overbought).toBeLessThan(100);
    });

    it('should handle missing time of day', async () => {
      const conditionsWithoutTime = {
        ...mockMarketConditions,
        timeOfDay: undefined,
      };

      const thresholds = await thresholdManager.updateThresholds(
        mockCandles,
        mockIndicators,
        conditionsWithoutTime
      );

      expect(thresholds).toBeDefined();
    });

    it('should handle zero volatility', async () => {
      const zeroVolConditions = {
        ...mockMarketConditions,
        volatility: 0,
      };

      const thresholds = await thresholdManager.updateThresholds(
        mockCandles,
        mockIndicators,
        zeroVolConditions
      );

      expect(thresholds).toBeDefined();
    });
  });
});