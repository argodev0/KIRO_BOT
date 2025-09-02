import { NKNProbabilityAnalyzer } from '../../services/NKNProbabilityAnalyzer';

describe('NKNProbabilityAnalyzer', () => {
  let analyzer: NKNProbabilityAnalyzer;

  beforeEach(() => {
    analyzer = new NKNProbabilityAnalyzer();
  });

  describe('analyzeProbability', () => {
    it('should analyze market probability with valid data', async () => {
      const marketData = [100, 101, 102, 103, 104, 105, 104, 103, 102, 101, 100, 99];
      const historicalData = [
        [95, 96, 97, 98, 99, 100],
        [100, 101, 102, 103, 104, 105]
      ];

      const result = await analyzer.analyzeProbability(marketData, historicalData);

      expect(result).toBeDefined();
      expect(result.entryProbability).toBeGreaterThanOrEqual(0);
      expect(result.entryProbability).toBeLessThanOrEqual(1);
      expect(result.exitProbability).toBeGreaterThanOrEqual(0);
      expect(result.exitProbability).toBeLessThanOrEqual(1);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(1);
      expect(result.timeHorizon).toBeGreaterThan(0);
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(1);
      expect(['trending', 'ranging', 'volatile', 'stable']).toContain(result.marketRegime);
    });

    it('should handle empty market data gracefully', async () => {
      const marketData: number[] = [];
      const historicalData: number[][] = [];

      const result = await analyzer.analyzeProbability(marketData, historicalData);

      expect(result).toBeDefined();
      expect(result.entryProbability).toBe(0.5);
      expect(result.exitProbability).toBe(0.5);
      expect(result.confidenceScore).toBe(0.3);
      expect(result.marketRegime).toBe('ranging');
    });

    it('should identify trending market regime', async () => {
      // Create strongly trending data
      const marketData = Array.from({length: 20}, (_, i) => 100 + i * 2);
      const historicalData: number[][] = [];

      const result = await analyzer.analyzeProbability(marketData, historicalData);

      expect(result.marketRegime).toBe('trending');
    });

    it('should identify volatile market regime', async () => {
      // Create highly volatile data
      const marketData = [100, 110, 90, 120, 80, 130, 70, 140, 60, 150];
      const historicalData: number[][] = [];

      const result = await analyzer.analyzeProbability(marketData, historicalData);

      expect(result.marketRegime).toBe('volatile');
    });

    it('should identify stable market regime', async () => {
      // Create stable data with minimal variation
      const marketData = [100, 100.1, 99.9, 100.05, 99.95, 100.02, 99.98];
      const historicalData: number[][] = [];

      const result = await analyzer.analyzeProbability(marketData, historicalData);

      expect(result.marketRegime).toBe('stable');
    });
  });

  describe('updateModel', () => {
    it('should update model with new training data', async () => {
      const features = [100, 101, 102, 103, 104, 105, 104, 103, 102, 101, 100, 99];
      const target = [0.8, 0.2, 0.9, 15, 0.3, 0.7];

      await expect(analyzer.updateModel(features, target)).resolves.not.toThrow();
    });

    it('should handle invalid training data gracefully', async () => {
      const features: number[] = [];
      const target: number[] = [];

      await expect(analyzer.updateModel(features, target)).resolves.not.toThrow();
    });
  });

  describe('getModelMetrics', () => {
    it('should return model performance metrics', () => {
      const metrics = analyzer.getModelMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.accuracy).toBeGreaterThanOrEqual(0);
      expect(metrics.accuracy).toBeLessThanOrEqual(1);
      expect(metrics.loss).toBeGreaterThanOrEqual(0);
      expect(metrics.trainingSteps).toBeGreaterThanOrEqual(0);
    });
  });

  describe('kolmogorovArnoldActivation', () => {
    it('should apply custom activation function correctly', async () => {
      // Test the activation function indirectly through probability analysis
      const marketData = [100, 101, 102];
      const historicalData: number[][] = [];

      const result = await analyzer.analyzeProbability(marketData, historicalData);

      // The activation function should produce bounded outputs
      expect(result.entryProbability).toBeGreaterThanOrEqual(0);
      expect(result.entryProbability).toBeLessThanOrEqual(1);
    });
  });

  describe('temporal smoothing', () => {
    it('should apply temporal smoothing to reduce noise', async () => {
      const noisyData = [100, 150, 50, 200, 25, 175, 75, 125];
      const historicalData: number[][] = [];

      const result = await analyzer.analyzeProbability(noisyData, historicalData);

      // Smoothed results should be within reasonable bounds
      expect(result.entryProbability).toBeGreaterThanOrEqual(0);
      expect(result.entryProbability).toBeLessThanOrEqual(1);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(1);
    });
  });

  describe('error handling', () => {
    it('should handle analysis errors gracefully', async () => {
      // Create data that might cause numerical issues
      const problematicData = [Infinity, -Infinity, NaN, 0];
      const historicalData: number[][] = [];

      const result = await analyzer.analyzeProbability(problematicData, historicalData);

      expect(result).toBeDefined();
      expect(result.entryProbability).toBe(0.5);
      expect(result.marketRegime).toBe('ranging');
    });
  });

  describe('market regime detection', () => {
    it('should correctly classify different market regimes', async () => {
      const testCases = [
        {
          data: Array.from({length: 10}, (_, i) => 100 + i * 5), // Strong uptrend
          expectedRegime: 'trending'
        },
        {
          data: [100, 105, 95, 110, 85, 115, 80, 120], // High volatility
          expectedRegime: 'volatile'
        },
        {
          data: Array.from({length: 10}, () => 100 + (Math.random() - 0.5) * 0.1), // Very stable
          expectedRegime: 'stable'
        }
      ];

      for (const testCase of testCases) {
        const result = await analyzer.analyzeProbability(testCase.data, []);
        expect(result.marketRegime).toBe(testCase.expectedRegime);
      }
    });
  });

  describe('probability bounds', () => {
    it('should always return probabilities within valid bounds', async () => {
      const extremeData = [-1000, 1000, -500, 2000, -2000, 5000];
      const historicalData: number[][] = [];

      const result = await analyzer.analyzeProbability(extremeData, historicalData);

      expect(result.entryProbability).toBeGreaterThanOrEqual(0);
      expect(result.entryProbability).toBeLessThanOrEqual(1);
      expect(result.exitProbability).toBeGreaterThanOrEqual(0);
      expect(result.exitProbability).toBeLessThanOrEqual(1);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(1);
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(1);
    });
  });
});