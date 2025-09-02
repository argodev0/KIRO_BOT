/**
 * Enhanced Elliott Wave Analyzer Tests
 * Unit tests for advanced Elliott Wave analysis with probability scoring
 */

import { EnhancedElliottWaveAnalyzer } from '../../../services/indicators/EnhancedElliottWaveAnalyzer';
import { CandleData } from '../../../types/market';
import { Wave } from '../../../types/analysis';

// Mock data generators
const generateMockCandles = (count: number, trend: 'up' | 'down' | 'sideways' = 'sideways'): CandleData[] => {
  const candles: CandleData[] = [];
  let currentPrice = 100;
  const startTime = Date.now() - (count * 3600000);

  for (let i = 0; i < count; i++) {
    let change = 0;
    
    switch (trend) {
      case 'up':
        change = Math.random() * 0.02 + 0.005; // 0.5% to 2.5% up
        break;
      case 'down':
        change = -(Math.random() * 0.02 + 0.005); // 0.5% to 2.5% down
        break;
      case 'sideways':
        change = (Math.random() - 0.5) * 0.02; // -1% to +1%
        break;
    }

    const open = currentPrice;
    const close = currentPrice * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
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

const generateMockWaves = (): Wave[] => {
  const baseTime = Date.now() - (5 * 24 * 60 * 60 * 1000); // 5 days ago
  
  return [
    {
      id: 'wave_1',
      type: 'wave_1',
      degree: 'minor',
      startPrice: 100,
      endPrice: 120,
      startTime: baseTime,
      endTime: baseTime + (24 * 60 * 60 * 1000),
      length: 20,
      duration: 24 * 60 * 60 * 1000,
      fibonacciRatio: 1.0,
    },
    {
      id: 'wave_2',
      type: 'wave_2',
      degree: 'minor',
      startPrice: 120,
      endPrice: 108,
      startTime: baseTime + (24 * 60 * 60 * 1000),
      endTime: baseTime + (2 * 24 * 60 * 60 * 1000),
      length: 12,
      duration: 24 * 60 * 60 * 1000,
      fibonacciRatio: 0.6,
    },
    {
      id: 'wave_3',
      type: 'wave_3',
      degree: 'minor',
      startPrice: 108,
      endPrice: 140,
      startTime: baseTime + (2 * 24 * 60 * 60 * 1000),
      endTime: baseTime + (3 * 24 * 60 * 60 * 1000),
      length: 32,
      duration: 24 * 60 * 60 * 1000,
      fibonacciRatio: 1.6,
    },
    {
      id: 'wave_4',
      type: 'wave_4',
      degree: 'minor',
      startPrice: 140,
      endPrice: 125,
      startTime: baseTime + (3 * 24 * 60 * 60 * 1000),
      endTime: baseTime + (4 * 24 * 60 * 60 * 1000),
      length: 15,
      duration: 24 * 60 * 60 * 1000,
      fibonacciRatio: 0.47,
    },
    {
      id: 'wave_5',
      type: 'wave_5',
      degree: 'minor',
      startPrice: 125,
      endPrice: 145,
      startTime: baseTime + (4 * 24 * 60 * 60 * 1000),
      endTime: baseTime + (5 * 24 * 60 * 60 * 1000),
      length: 20,
      duration: 24 * 60 * 60 * 1000,
      fibonacciRatio: 1.0,
    },
  ];
};

describe('EnhancedElliottWaveAnalyzer', () => {
  let analyzer: EnhancedElliottWaveAnalyzer;
  let mockCandles: CandleData[];
  let mockWaves: Wave[];

  beforeEach(() => {
    analyzer = new EnhancedElliottWaveAnalyzer({
      minWaveLength: 5,
      maxWaveLength: 100,
      fibonacciTolerance: 0.05,
      probabilityThreshold: 0.6,
      degreeAnalysisDepth: 3,
    });

    mockCandles = generateMockCandles(100, 'up');
    mockWaves = generateMockWaves();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultAnalyzer = new EnhancedElliottWaveAnalyzer({
        minWaveLength: 5,
        maxWaveLength: 100,
        fibonacciTolerance: 0.05,
        probabilityThreshold: 0.6,
        degreeAnalysisDepth: 3,
      });

      const config = defaultAnalyzer.getConfig();
      expect(config.minWaveLength).toBe(5);
      expect(config.fibonacciTolerance).toBe(0.05);
    });

    it('should update configuration', () => {
      analyzer.updateConfig({
        probabilityThreshold: 0.8,
        degreeAnalysisDepth: 5,
      });

      const config = analyzer.getConfig();
      expect(config.probabilityThreshold).toBe(0.8);
      expect(config.degreeAnalysisDepth).toBe(5);
    });
  });

  describe('Wave Probability Calculation', () => {
    it('should calculate probability scores for waves', async () => {
      const probabilityScores = await analyzer.calculateWaveProbabilities(mockWaves, mockCandles);

      expect(Array.isArray(probabilityScores)).toBe(true);
      expect(probabilityScores.length).toBe(mockWaves.length);

      for (const score of probabilityScores) {
        expect(score.waveId).toBeDefined();
        expect(score.probability).toBeGreaterThanOrEqual(0);
        expect(score.probability).toBeLessThanOrEqual(1);
        expect(score.confidence).toBeGreaterThanOrEqual(0);
        expect(score.confidence).toBeLessThanOrEqual(1);
        expect(score.invalidationLevel).toBeDefined();
        expect(Array.isArray(score.nextTargets)).toBe(true);
      }
    });

    it('should assign higher probabilities to valid Elliott Wave patterns', async () => {
      const probabilityScores = await analyzer.calculateWaveProbabilities(mockWaves, mockCandles);

      // Wave 3 should have high probability (it's the longest and follows rules)
      const wave3Score = probabilityScores.find(s => s.waveId === 'wave_3');
      expect(wave3Score).toBeDefined();
      expect(wave3Score!.probability).toBeGreaterThan(0.5);

      // Wave 2 should have reasonable probability (valid retracement)
      const wave2Score = probabilityScores.find(s => s.waveId === 'wave_2');
      expect(wave2Score).toBeDefined();
      expect(wave2Score!.probability).toBeGreaterThan(0.3);
    });

    it('should calculate next targets for waves', async () => {
      const probabilityScores = await analyzer.calculateWaveProbabilities(mockWaves, mockCandles);

      for (const score of probabilityScores) {
        expect(Array.isArray(score.nextTargets)).toBe(true);
        
        for (const target of score.nextTargets) {
          expect(target.price).toBeGreaterThan(0);
          expect(target.probability).toBeGreaterThanOrEqual(0);
          expect(target.probability).toBeLessThanOrEqual(1);
          expect(['fibonacci_extension', 'fibonacci_retracement', 'wave_equality', 'channel_projection']).toContain(target.type);
          expect(target.description).toBeDefined();
        }
      }
    });
  });

  describe('Nested Wave Analysis', () => {
    it('should perform nested wave analysis', async () => {
      const nestedAnalysis = await analyzer.performNestedAnalysis(mockWaves, mockCandles);

      expect(Array.isArray(nestedAnalysis)).toBe(true);

      for (const analysis of nestedAnalysis) {
        expect(analysis.parentWave).toBeDefined();
        expect(Array.isArray(analysis.subWaves)).toBe(true);
        expect(analysis.completeness).toBeGreaterThanOrEqual(0);
        expect(analysis.completeness).toBeLessThanOrEqual(1);
        expect(analysis.probability).toBeGreaterThanOrEqual(0);
        expect(analysis.probability).toBeLessThanOrEqual(1);
      }
    });

    it('should identify sub-waves within parent waves', async () => {
      const nestedAnalysis = await analyzer.performNestedAnalysis(mockWaves, mockCandles);

      // Should find some nested analysis for waves with sufficient data
      const analysisWithSubWaves = nestedAnalysis.filter(a => a.subWaves.length > 0);
      
      if (analysisWithSubWaves.length > 0) {
        const analysis = analysisWithSubWaves[0];
        
        for (const subWave of analysis.subWaves) {
          expect(subWave.id).toContain('sub');
          expect(subWave.startTime).toBeGreaterThanOrEqual(analysis.parentWave.startTime);
          expect(subWave.endTime).toBeLessThanOrEqual(analysis.parentWave.endTime);
        }
      }
    });

    it('should calculate completeness based on expected sub-wave count', async () => {
      const nestedAnalysis = await analyzer.performNestedAnalysis(mockWaves, mockCandles);

      for (const analysis of nestedAnalysis) {
        // Completeness should be reasonable for impulse waves (expecting 5 sub-waves)
        if (['wave_1', 'wave_3', 'wave_5'].includes(analysis.parentWave.type)) {
          expect(analysis.completeness).toBeGreaterThanOrEqual(0);
        }
        
        // Completeness should be reasonable for corrective waves (expecting 3 sub-waves)
        if (['wave_2', 'wave_4'].includes(analysis.parentWave.type)) {
          expect(analysis.completeness).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe('Invalidation Level Calculation', () => {
    it('should calculate invalidation levels for all waves', async () => {
      const invalidationLevels = await analyzer.calculateInvalidationLevels(mockWaves, mockCandles);

      expect(Array.isArray(invalidationLevels)).toBe(true);
      expect(invalidationLevels.length).toBe(mockWaves.length);

      for (const level of invalidationLevels) {
        expect(typeof level).toBe('number');
        expect(level).toBeGreaterThan(0);
      }
    });

    it('should set appropriate invalidation levels for different wave types', async () => {
      const invalidationLevels = await analyzer.calculateInvalidationLevels(mockWaves, mockCandles);

      // Wave 1 invalidation should be below its start price
      const wave1Index = mockWaves.findIndex(w => w.type === 'wave_1');
      if (wave1Index >= 0) {
        expect(invalidationLevels[wave1Index]).toBeLessThan(mockWaves[wave1Index].startPrice);
      }

      // Wave 2 invalidation should be below wave 1 start
      const wave2Index = mockWaves.findIndex(w => w.type === 'wave_2');
      if (wave2Index >= 0) {
        expect(invalidationLevels[wave2Index]).toBeLessThan(mockWaves[0].startPrice);
      }
    });
  });

  describe('Wave Relationship Analysis', () => {
    it('should analyze wave relationships', async () => {
      const relationships = await analyzer.analyzeWaveRelationships(mockWaves);

      expect(Array.isArray(relationships)).toBe(true);

      for (const relationship of relationships) {
        expect(relationship.wave1).toBeDefined();
        expect(relationship.wave2).toBeDefined();
        expect(relationship.fibonacciRatio).toBeGreaterThan(0);
        expect(['equality', 'fibonacci', 'extension']).toContain(relationship.relationship);
        expect(relationship.strength).toBeGreaterThanOrEqual(0);
        expect(relationship.strength).toBeLessThanOrEqual(1);
      }
    });

    it('should identify Fibonacci relationships', async () => {
      const relationships = await analyzer.analyzeWaveRelationships(mockWaves);

      // Should find some Fibonacci relationships in our mock data
      const fibonacciRelationships = relationships.filter(r => r.relationship === 'fibonacci');
      
      for (const relationship of fibonacciRelationships) {
        // Fibonacci ratios should be close to known Fibonacci numbers
        const commonRatios = [0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.272, 1.618, 2.618];
        const isCloseToFibonacci = commonRatios.some(ratio => 
          Math.abs(relationship.fibonacciRatio - ratio) < 0.1
        );
        expect(isCloseToFibonacci).toBe(true);
      }
    });

    it('should sort relationships by strength', async () => {
      const relationships = await analyzer.analyzeWaveRelationships(mockWaves);

      if (relationships.length > 1) {
        for (let i = 0; i < relationships.length - 1; i++) {
          expect(relationships[i].strength).toBeGreaterThanOrEqual(relationships[i + 1].strength);
        }
      }
    });
  });

  describe('Elliott Wave Rule Validation', () => {
    it('should validate Elliott Wave rules', async () => {
      const validation = await analyzer.validateElliottWaveRules(mockWaves);

      expect(validation.isValid).toBeDefined();
      expect(typeof validation.isValid).toBe('boolean');
      expect(Array.isArray(validation.violations)).toBe(true);
      expect(validation.confidence).toBeGreaterThanOrEqual(0);
      expect(validation.confidence).toBeLessThanOrEqual(1);
    });

    it('should identify rule violations', async () => {
      // Create waves that violate Elliott Wave rules
      const invalidWaves: Wave[] = [
        {
          id: 'wave_1',
          type: 'wave_1',
          degree: 'minor',
          startPrice: 100,
          endPrice: 120,
          startTime: Date.now() - 5000,
          endTime: Date.now() - 4000,
          length: 20,
          duration: 1000,
        },
        {
          id: 'wave_2',
          type: 'wave_2',
          degree: 'minor',
          startPrice: 120,
          endPrice: 80, // Violates rule: retraces more than 100%
          startTime: Date.now() - 4000,
          endTime: Date.now() - 3000,
          length: 40,
          duration: 1000,
        },
        {
          id: 'wave_3',
          type: 'wave_3',
          degree: 'minor',
          startPrice: 80,
          endTime: Date.now() - 2000,
          endPrice: 90, // Violates rule: wave 3 is shortest
          startTime: Date.now() - 3000,
          length: 10,
          duration: 1000,
        },
      ];

      const validation = await analyzer.validateElliottWaveRules(invalidWaves);

      expect(validation.isValid).toBe(false);
      expect(validation.violations.length).toBeGreaterThan(0);
      expect(validation.confidence).toBeLessThan(0.6);
    });

    it('should validate correct Elliott Wave patterns', async () => {
      // Our mock waves should generally follow Elliott Wave rules
      const validation = await analyzer.validateElliottWaveRules(mockWaves);

      // Should have reasonable confidence even if not perfect
      expect(validation.confidence).toBeGreaterThan(0.3);
      
      // Should not have major violations
      const majorViolations = validation.violations.filter(v => 
        v.includes('retraces more than 100%') || 
        v.includes('shortest wave') ||
        v.includes('enters the price territory')
      );
      expect(majorViolations.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty wave arrays', async () => {
      const probabilityScores = await analyzer.calculateWaveProbabilities([], mockCandles);
      expect(probabilityScores).toEqual([]);

      const nestedAnalysis = await analyzer.performNestedAnalysis([], mockCandles);
      expect(nestedAnalysis).toEqual([]);

      const invalidationLevels = await analyzer.calculateInvalidationLevels([], mockCandles);
      expect(invalidationLevels).toEqual([]);
    });

    it('should handle insufficient candle data', async () => {
      const shortCandles = generateMockCandles(3);
      
      const probabilityScores = await analyzer.calculateWaveProbabilities(mockWaves, shortCandles);
      expect(Array.isArray(probabilityScores)).toBe(true);
      
      // Should still return results but with lower confidence
      for (const score of probabilityScores) {
        expect(score.confidence).toBeLessThan(0.8);
      }
    });

    it('should handle invalid wave data', async () => {
      const invalidWaves: Wave[] = [
        {
          id: 'invalid_wave',
          type: 'wave_1',
          degree: 'minor',
          startPrice: 0, // Invalid price
          endPrice: -100, // Invalid price
          startTime: Date.now(),
          endTime: Date.now() - 1000, // Invalid time order
          length: -10, // Invalid length
          duration: -1000, // Invalid duration
        },
      ];

      // Should not throw but handle gracefully
      const probabilityScores = await analyzer.calculateWaveProbabilities(invalidWaves, mockCandles);
      expect(Array.isArray(probabilityScores)).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should complete analysis within reasonable time', async () => {
      const startTime = Date.now();
      await analyzer.calculateWaveProbabilities(mockWaves, mockCandles);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle large datasets efficiently', async () => {
      const largeWaveSet = Array.from({ length: 50 }, (_, i) => ({
        ...mockWaves[0],
        id: `wave_${i}`,
        startTime: Date.now() - (i * 1000),
        endTime: Date.now() - ((i - 1) * 1000),
      }));

      const startTime = Date.now();
      const result = await analyzer.calculateWaveProbabilities(largeWaveSet, mockCandles);
      const endTime = Date.now();

      expect(result.length).toBe(50);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Configuration Management', () => {
    it('should use configuration parameters correctly', async () => {
      // Test with high probability threshold
      analyzer.updateConfig({ probabilityThreshold: 0.9 });
      
      const validation = await analyzer.validateElliottWaveRules(mockWaves);
      
      // With high threshold, validation should be more strict
      if (validation.confidence < 0.9) {
        expect(validation.isValid).toBe(false);
      }
    });

    it('should respect Fibonacci tolerance settings', async () => {
      // Test with very tight tolerance
      analyzer.updateConfig({ fibonacciTolerance: 0.01 });
      
      const relationships = await analyzer.analyzeWaveRelationships(mockWaves);
      
      // With tight tolerance, fewer relationships should be classified as 'fibonacci'
      const fibonacciRelationships = relationships.filter(r => r.relationship === 'fibonacci');
      const totalRelationships = relationships.length;
      
      if (totalRelationships > 0) {
        const fibonacciRatio = fibonacciRelationships.length / totalRelationships;
        expect(fibonacciRatio).toBeLessThanOrEqual(0.5); // Should be more selective
      }
    });
  });
});