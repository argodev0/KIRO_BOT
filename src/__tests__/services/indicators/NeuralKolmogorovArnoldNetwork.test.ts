/**
 * Neural Kolmogorov-Arnold Network Tests
 * Unit tests for NKN pattern recognition and probability analysis
 */

import { NeuralKolmogorovArnoldNetwork } from '../../../services/indicators/NeuralKolmogorovArnoldNetwork';
import { CandleData } from '../../../types/market';

// Mock data generators
const generateMockCandles = (count: number, pattern: 'trending' | 'volatile' | 'stable' = 'stable'): CandleData[] => {
  const candles: CandleData[] = [];
  let currentPrice = 100;
  const startTime = Date.now() - (count * 3600000);

  for (let i = 0; i < count; i++) {
    let change = 0;
    
    switch (pattern) {
      case 'trending':
        change = 0.005 + (Math.random() - 0.3) * 0.01; // Slight upward bias with noise
        break;
      case 'volatile':
        change = (Math.random() - 0.5) * 0.05; // High volatility
        break;
      case 'stable':
        change = (Math.random() - 0.5) * 0.01; // Low volatility
        break;
    }

    const open = currentPrice;
    const close = currentPrice * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low = Math.min(open, close) * (1 - Math.random() * 0.005);
    const volume = 1000 + Math.random() * 4000;

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

describe('NeuralKolmogorovArnoldNetwork', () => {
  let nkn: NeuralKolmogorovArnoldNetwork;
  let mockCandles: CandleData[];

  beforeEach(() => {
    nkn = new NeuralKolmogorovArnoldNetwork({
      enabled: true,
      networkDepth: 2, // Smaller for testing
      trainingPeriod: 50,
      predictionHorizon: 5,
      confidenceThreshold: 0.6,
    });

    mockCandles = generateMockCandles(100, 'stable');
  });

  describe('Initialization', () => {
    it('should initialize with configuration', () => {
      const config = nkn.getConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.networkDepth).toBe(2);
      expect(config.trainingPeriod).toBe(50);
      expect(config.predictionHorizon).toBe(5);
      expect(config.confidenceThreshold).toBe(0.6);
    });

    it('should initialize disabled network', () => {
      const disabledNKN = new NeuralKolmogorovArnoldNetwork({
        enabled: false,
        networkDepth: 3,
        trainingPeriod: 100,
        predictionHorizon: 10,
        confidenceThreshold: 0.7,
      });

      const config = disabledNKN.getConfig();
      expect(config.enabled).toBe(false);
    });

    it('should update configuration', () => {
      nkn.updateConfig({
        predictionHorizon: 10,
        confidenceThreshold: 0.8,
      });

      const config = nkn.getConfig();
      expect(config.predictionHorizon).toBe(10);
      expect(config.confidenceThreshold).toBe(0.8);
      expect(config.networkDepth).toBe(2); // Should remain unchanged
    });
  });

  describe('Network Statistics', () => {
    it('should provide network statistics', () => {
      const stats = nkn.getNetworkStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats.isInitialized).toBe('boolean');
      expect(typeof stats.trainingEpochs).toBe('number');
      expect(typeof stats.lastError).toBe('number');
      expect(typeof stats.convergenceRate).toBe('number');
      expect(typeof stats.layerCount).toBe('number');
    });

    it('should show uninitialized state initially', () => {
      const freshNKN = new NeuralKolmogorovArnoldNetwork({
        enabled: false,
        networkDepth: 3,
        trainingPeriod: 100,
        predictionHorizon: 10,
        confidenceThreshold: 0.7,
      });

      const stats = freshNKN.getNetworkStats();
      expect(stats.isInitialized).toBe(false);
      expect(stats.trainingEpochs).toBe(0);
      expect(stats.layerCount).toBe(0);
    });
  });

  describe('Prediction Generation', () => {
    it('should return empty predictions when disabled', async () => {
      const disabledNKN = new NeuralKolmogorovArnoldNetwork({
        enabled: false,
        networkDepth: 3,
        trainingPeriod: 100,
        predictionHorizon: 10,
        confidenceThreshold: 0.7,
      });

      const predictions = await disabledNKN.generatePredictions(mockCandles);
      expect(predictions).toEqual([]);
    });

    it('should generate predictions when enabled', async () => {
      const predictions = await nkn.generatePredictions(mockCandles);
      
      expect(Array.isArray(predictions)).toBe(true);
      expect(predictions.length).toBe(5); // Should match predictionHorizon

      for (const prediction of predictions) {
        expect(prediction.timestamp).toBeGreaterThan(0);
        expect(prediction.predictedPrice).toBeGreaterThan(0);
        expect(prediction.probability).toBeGreaterThanOrEqual(0);
        expect(prediction.probability).toBeLessThanOrEqual(1);
        expect(prediction.confidence).toBeGreaterThanOrEqual(0);
        expect(prediction.confidence).toBeLessThanOrEqual(1);
        expect(prediction.horizon).toBeGreaterThan(0);
        expect(prediction.horizon).toBeLessThanOrEqual(5);
      }
    });

    it('should have decreasing confidence for longer horizons', async () => {
      const predictions = await nkn.generatePredictions(mockCandles);
      
      if (predictions.length > 1) {
        for (let i = 0; i < predictions.length - 1; i++) {
          expect(predictions[i].confidence).toBeGreaterThanOrEqual(predictions[i + 1].confidence);
        }
      }
    });

    it('should throw error for insufficient data', async () => {
      const shortCandles = generateMockCandles(30); // Less than trainingPeriod
      
      await expect(nkn.generatePredictions(shortCandles))
        .rejects.toThrow('Insufficient data for NKN predictions');
    });
  });

  describe('Pattern Recognition', () => {
    it('should return empty patterns when disabled', async () => {
      const disabledNKN = new NeuralKolmogorovArnoldNetwork({
        enabled: false,
        networkDepth: 3,
        trainingPeriod: 100,
        predictionHorizon: 10,
        confidenceThreshold: 0.7,
      });

      const patterns = await disabledNKN.recognizePatterns(mockCandles);
      expect(patterns).toEqual([]);
    });

    it('should recognize patterns when enabled', async () => {
      const patterns = await nkn.recognizePatterns(mockCandles);
      
      expect(Array.isArray(patterns)).toBe(true);

      for (const pattern of patterns) {
        expect(pattern.pattern).toBeDefined();
        expect(typeof pattern.pattern).toBe('string');
        expect(pattern.probability).toBeGreaterThanOrEqual(0);
        expect(pattern.probability).toBeLessThanOrEqual(1);
        expect(pattern.confidence).toBeGreaterThanOrEqual(0);
        expect(pattern.confidence).toBeLessThanOrEqual(1);
        expect(pattern.description).toBeDefined();
        expect(pattern.timeframe).toBeGreaterThan(0);
      }
    });

    it('should only return patterns above confidence threshold', async () => {
      const patterns = await nkn.recognizePatterns(mockCandles);
      
      for (const pattern of patterns) {
        expect(pattern.probability).toBeGreaterThan(0.6); // Should be above threshold
      }
    });

    it('should sort patterns by probability', async () => {
      const patterns = await nkn.recognizePatterns(mockCandles);
      
      if (patterns.length > 1) {
        for (let i = 0; i < patterns.length - 1; i++) {
          expect(patterns[i].probability).toBeGreaterThanOrEqual(patterns[i + 1].probability);
        }
      }
    });

    it('should recognize different pattern types', async () => {
      const trendingCandles = generateMockCandles(100, 'trending');
      const volatileCandles = generateMockCandles(100, 'volatile');
      
      const trendingPatterns = await nkn.recognizePatterns(trendingCandles);
      const volatilePatterns = await nkn.recognizePatterns(volatileCandles);
      
      // Should potentially recognize different patterns for different data types
      expect(Array.isArray(trendingPatterns)).toBe(true);
      expect(Array.isArray(volatilePatterns)).toBe(true);
    });
  });

  describe('Confidence Score Calculation', () => {
    it('should return 0 confidence when disabled', async () => {
      const disabledNKN = new NeuralKolmogorovArnoldNetwork({
        enabled: false,
        networkDepth: 3,
        trainingPeriod: 100,
        predictionHorizon: 10,
        confidenceThreshold: 0.7,
      });

      const confidence = await disabledNKN.calculateConfidenceScore(mockCandles);
      expect(confidence).toBe(0);
    });

    it('should calculate confidence score when enabled', async () => {
      const confidence = await nkn.calculateConfidenceScore(mockCandles);
      
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });

    it('should have higher confidence with more data', async () => {
      const shortCandles = generateMockCandles(60);
      const longCandles = generateMockCandles(200);
      
      const shortConfidence = await nkn.calculateConfidenceScore(shortCandles);
      const longConfidence = await nkn.calculateConfidenceScore(longCandles);
      
      expect(longConfidence).toBeGreaterThanOrEqual(shortConfidence);
    });
  });

  describe('Network Training', () => {
    it('should throw error when disabled', async () => {
      const disabledNKN = new NeuralKolmogorovArnoldNetwork({
        enabled: false,
        networkDepth: 3,
        trainingPeriod: 100,
        predictionHorizon: 10,
        confidenceThreshold: 0.7,
      });

      await expect(disabledNKN.trainNetwork(mockCandles))
        .rejects.toThrow('NKN is disabled');
    });

    it('should train network when enabled', async () => {
      const trainingResult = await nkn.trainNetwork(mockCandles);
      
      expect(trainingResult).toBeDefined();
      expect(trainingResult.epochs).toBeGreaterThan(0);
      expect(trainingResult.finalError).toBeGreaterThanOrEqual(0);
      expect(trainingResult.convergenceRate).toBeGreaterThanOrEqual(0);
      expect(trainingResult.trainingTime).toBeGreaterThan(0);
    });

    it('should update network statistics after training', async () => {
      const statsBefore = nkn.getNetworkStats();
      await nkn.trainNetwork(mockCandles);
      const statsAfter = nkn.getNetworkStats();
      
      expect(statsAfter.isInitialized).toBe(true);
      expect(statsAfter.trainingEpochs).toBeGreaterThan(statsBefore.trainingEpochs);
      expect(statsAfter.layerCount).toBeGreaterThan(0);
    });

    it('should complete training within reasonable time', async () => {
      const startTime = Date.now();
      await nkn.trainNetwork(mockCandles);
      const endTime = Date.now();
      
      const trainingTime = endTime - startTime;
      expect(trainingTime).toBeLessThan(30000); // Should complete within 30 seconds
    });
  });

  describe('Feature Extraction', () => {
    it('should handle different market patterns', async () => {
      const stableCandles = generateMockCandles(100, 'stable');
      const trendingCandles = generateMockCandles(100, 'trending');
      const volatileCandles = generateMockCandles(100, 'volatile');
      
      // Should not throw errors for different patterns
      const stablePredictions = await nkn.generatePredictions(stableCandles);
      const trendingPredictions = await nkn.generatePredictions(trendingCandles);
      const volatilePredictions = await nkn.generatePredictions(volatileCandles);
      
      expect(Array.isArray(stablePredictions)).toBe(true);
      expect(Array.isArray(trendingPredictions)).toBe(true);
      expect(Array.isArray(volatilePredictions)).toBe(true);
    });

    it('should handle edge cases in data', async () => {
      // Create candles with extreme values
      const extremeCandles = mockCandles.map((candle, i) => ({
        ...candle,
        volume: i === 0 ? 0 : candle.volume, // Zero volume
        high: i === 1 ? candle.high * 2 : candle.high, // Price spike
      }));
      
      // Should handle gracefully without throwing
      const predictions = await nkn.generatePredictions(extremeCandles);
      expect(Array.isArray(predictions)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty candle data', async () => {
      await expect(nkn.generatePredictions([]))
        .rejects.toThrow('Insufficient data for NKN predictions');
      
      const patterns = await nkn.recognizePatterns([]);
      expect(patterns).toEqual([]);
      
      const confidence = await nkn.calculateConfidenceScore([]);
      expect(confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle invalid candle data', async () => {
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

      // Should handle gracefully
      const confidence = await nkn.calculateConfidenceScore(invalidCandles);
      expect(confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle network initialization errors gracefully', async () => {
      // Create NKN with extreme configuration
      const extremeNKN = new NeuralKolmogorovArnoldNetwork({
        enabled: true,
        networkDepth: 0, // Invalid depth
        trainingPeriod: 10,
        predictionHorizon: 1,
        confidenceThreshold: 0.5,
      });

      // Should not throw during initialization
      const stats = extremeNKN.getNetworkStats();
      expect(stats).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should complete predictions within reasonable time', async () => {
      const startTime = Date.now();
      await nkn.generatePredictions(mockCandles);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should complete pattern recognition within reasonable time', async () => {
      const startTime = Date.now();
      await nkn.recognizePatterns(mockCandles);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle large datasets efficiently', async () => {
      const largeDataset = generateMockCandles(500);
      
      const startTime = Date.now();
      const predictions = await nkn.generatePredictions(largeDataset);
      const endTime = Date.now();
      
      expect(predictions).toBeDefined();
      expect(endTime - startTime).toBeLessThan(15000); // Should complete within 15 seconds
    });
  });

  describe('Configuration Impact', () => {
    it('should respect confidence threshold', async () => {
      // Set high confidence threshold
      nkn.updateConfig({ confidenceThreshold: 0.9 });
      
      const patterns = await nkn.recognizePatterns(mockCandles);
      
      // Should return fewer patterns with high threshold
      for (const pattern of patterns) {
        expect(pattern.probability).toBeGreaterThan(0.9);
      }
    });

    it('should respect prediction horizon', async () => {
      nkn.updateConfig({ predictionHorizon: 3 });
      
      const predictions = await nkn.generatePredictions(mockCandles);
      
      expect(predictions.length).toBe(3);
      expect(predictions[predictions.length - 1].horizon).toBe(3);
    });

    it('should handle configuration changes during runtime', async () => {
      // Generate initial predictions
      const initialPredictions = await nkn.generatePredictions(mockCandles);
      
      // Change configuration
      nkn.updateConfig({ predictionHorizon: 2 });
      
      // Generate new predictions
      const newPredictions = await nkn.generatePredictions(mockCandles);
      
      expect(initialPredictions.length).toBe(5);
      expect(newPredictions.length).toBe(2);
    });
  });

  describe('Activation Functions', () => {
    it('should handle different activation functions', async () => {
      // Test that the network can handle its custom Kolmogorov activation
      const predictions = await nkn.generatePredictions(mockCandles);
      
      // Should produce valid outputs
      expect(Array.isArray(predictions)).toBe(true);
      
      for (const prediction of predictions) {
        expect(isFinite(prediction.predictedPrice)).toBe(true);
        expect(isFinite(prediction.probability)).toBe(true);
        expect(isFinite(prediction.confidence)).toBe(true);
      }
    });
  });

  describe('Memory Management', () => {
    it('should not cause memory leaks with repeated operations', async () => {
      // Perform multiple operations to test memory stability
      for (let i = 0; i < 10; i++) {
        await nkn.generatePredictions(mockCandles);
        await nkn.recognizePatterns(mockCandles);
        await nkn.calculateConfidenceScore(mockCandles);
      }
      
      // Should complete without issues
      const finalPredictions = await nkn.generatePredictions(mockCandles);
      expect(Array.isArray(finalPredictions)).toBe(true);
    });
  });
});