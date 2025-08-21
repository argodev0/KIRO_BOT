/**
 * Fibonacci Service Tests
 * Comprehensive test suite for Fibonacci analysis and confluence detection
 */

import { FibonacciService } from '../../services/FibonacciService';
import { Wave, FibonacciLevel } from '../../types/analysis';
import { CandleData } from '../../types/market';

describe('FibonacciService', () => {
  let fibonacciService: FibonacciService;

  beforeEach(() => {
    fibonacciService = new FibonacciService();
  });

  describe('calculateRetracements', () => {
    it('should calculate standard Fibonacci retracement levels', () => {
      const input = { high: 100, low: 50 };
      const retracements = fibonacciService.calculateRetracements(input);

      expect(retracements).toHaveLength(5);
      
      // Verify specific levels
      const levels = retracements.map(r => ({ ratio: r.ratio, price: r.price }));
      
      expect(levels).toContainEqual({ ratio: 0.236, price: 88.2 }); // 100 - (50 * 0.236)
      expect(levels).toContainEqual({ ratio: 0.382, price: 80.9 }); // 100 - (50 * 0.382)
      expect(levels).toContainEqual({ ratio: 0.5, price: 75 });     // 100 - (50 * 0.5)
      expect(levels).toContainEqual({ ratio: 0.618, price: 69.1 }); // 100 - (50 * 0.618)
      expect(levels).toContainEqual({ ratio: 0.786, price: 60.699999999999996 }); // 100 - (50 * 0.786)
    });

    it('should assign correct strength to golden ratio levels', () => {
      const input = { high: 100, low: 50 };
      const retracements = fibonacciService.calculateRetracements(input);

      const goldenRatioLevel = retracements.find(r => Math.abs(r.ratio - 0.618) < 0.001);
      const fiftyPercentLevel = retracements.find(r => Math.abs(r.ratio - 0.5) < 0.001);
      const standardLevel = retracements.find(r => Math.abs(r.ratio - 0.236) < 0.001);

      expect(goldenRatioLevel?.strength).toBe(1.0);
      expect(fiftyPercentLevel?.strength).toBe(0.9);
      expect(standardLevel?.strength).toBe(0.8);
    });

    it('should include proper descriptions for levels', () => {
      const input = { high: 100, low: 50 };
      const retracements = fibonacciService.calculateRetracements(input);

      const goldenRatioLevel = retracements.find(r => Math.abs(r.ratio - 0.618) < 0.001);
      const fiftyPercentLevel = retracements.find(r => Math.abs(r.ratio - 0.5) < 0.001);

      expect(goldenRatioLevel?.description).toBe('61.8% retracement (Golden Ratio)');
      expect(fiftyPercentLevel?.description).toBe('50.0% retracement (50% Level)');
    });
  });

  describe('calculateExtensions', () => {
    it('should calculate Fibonacci extension levels correctly', () => {
      const wave1: Wave = {
        id: 'wave1',
        type: 'wave_1',
        degree: 'minor',
        startPrice: 50,
        endPrice: 100,
        startTime: 1000,
        endTime: 2000,
        length: 50,
        duration: 1000
      };

      const wave2: Wave = {
        id: 'wave2',
        type: 'wave_2',
        degree: 'minor',
        startPrice: 100,
        endPrice: 80,
        startTime: 2000,
        endTime: 3000,
        length: 20,
        duration: 1000
      };

      const extensions = fibonacciService.calculateExtensions(wave1, wave2);

      expect(extensions).toHaveLength(3);
      
      // Wave1 length = 50, direction = up, extension base = 80
      const levels = extensions.map(e => ({ ratio: e.ratio, price: e.price }));
      
      expect(levels).toContainEqual({ ratio: 1.272, price: 143.6 }); // 80 + (50 * 1.272)
      expect(levels).toContainEqual({ ratio: 1.618, price: 160.9 }); // 80 + (50 * 1.618)
      expect(levels).toContainEqual({ ratio: 2.618, price: 210.9 }); // 80 + (50 * 2.618)
    });

    it('should handle downward extensions correctly', () => {
      const wave1: Wave = {
        id: 'wave1',
        type: 'wave_1',
        degree: 'minor',
        startPrice: 100,
        endPrice: 50, // Downward wave
        startTime: 1000,
        endTime: 2000,
        length: 50,
        duration: 1000
      };

      const wave2: Wave = {
        id: 'wave2',
        type: 'wave_2',
        degree: 'minor',
        startPrice: 50,
        endPrice: 70,
        startTime: 2000,
        endTime: 3000,
        length: 20,
        duration: 1000
      };

      const extensions = fibonacciService.calculateExtensions(wave1, wave2);

      // Wave1 length = 50, direction = down, extension base = 70
      const firstExtension = extensions.find(e => Math.abs(e.ratio - 1.272) < 0.001);
      expect(firstExtension?.price).toBeCloseTo(6.4); // 70 - (50 * 1.272)
    });
  });

  describe('calculateTimeFibonacci', () => {
    it('should calculate time-based Fibonacci projections', () => {
      const startTime = 1000;
      const endTime = 2000;

      const timeProjections = fibonacciService.calculateTimeFibonacci(startTime, endTime);

      expect(timeProjections).toHaveLength(5);

      const projections = timeProjections.map(t => ({ ratio: t.ratio, timestamp: t.timestamp }));
      
      expect(projections).toContainEqual({ ratio: 0.382, timestamp: 2382 }); // 2000 + (1000 * 0.382)
      expect(projections).toContainEqual({ ratio: 0.618, timestamp: 2618 }); // 2000 + (1000 * 0.618)
      expect(projections).toContainEqual({ ratio: 1.0, timestamp: 3000 });   // 2000 + (1000 * 1.0)
      expect(projections).toContainEqual({ ratio: 1.618, timestamp: 3618 }); // 2000 + (1000 * 1.618)
      expect(projections).toContainEqual({ ratio: 2.618, timestamp: 4618 }); // 2000 + (1000 * 2.618)
    });

    it('should include proper descriptions for time projections', () => {
      const timeProjections = fibonacciService.calculateTimeFibonacci(1000, 2000);

      const goldenRatioProjection = timeProjections.find(t => Math.abs(t.ratio - 0.618) < 0.001);
      const oneToOneProjection = timeProjections.find(t => Math.abs(t.ratio - 1.0) < 0.001);

      expect(goldenRatioProjection?.description).toContain('Golden Ratio');
      expect(oneToOneProjection?.description).toContain('1:1');
    });
  });

  describe('findConfluenceZones', () => {
    it('should detect confluence zones from overlapping levels', () => {
      const levels: FibonacciLevel[] = [
        { ratio: 0.618, price: 75.0, type: 'retracement', strength: 1.0, description: 'Level 1' },
        { ratio: 1.272, price: 75.1, type: 'extension', strength: 0.8, description: 'Level 2' },
        { ratio: 0.382, price: 75.05, type: 'retracement', strength: 0.8, description: 'Level 3' },
        { ratio: 0.5, price: 90.0, type: 'retracement', strength: 0.9, description: 'Level 4' }
      ];

      const confluenceZones = fibonacciService.findConfluenceZones(levels);

      expect(confluenceZones).toHaveLength(1);
      
      const zone = confluenceZones[0];
      expect(zone.priceLevel).toBeCloseTo(75.05, 1);
      expect(zone.factors.length).toBeGreaterThanOrEqual(2); // At least 2 factors for confluence
      expect(zone.strength).toBeGreaterThanOrEqual(1.0);
      expect(['support', 'resistance', 'reversal']).toContain(zone.type);
    });

    it('should not create confluence zones for single levels', () => {
      const levels: FibonacciLevel[] = [
        { ratio: 0.618, price: 75.0, type: 'retracement', strength: 1.0, description: 'Level 1' },
        { ratio: 0.382, price: 90.0, type: 'retracement', strength: 0.8, description: 'Level 2' }
      ];

      const confluenceZones = fibonacciService.findConfluenceZones(levels);

      expect(confluenceZones).toHaveLength(0);
    });

    it('should sort confluence zones by strength', () => {
      const levels: FibonacciLevel[] = [
        // First confluence zone (weaker) - need closer prices for confluence
        { ratio: 0.236, price: 80.0, type: 'retracement', strength: 0.8, description: 'Level 1' },
        { ratio: 0.382, price: 80.05, type: 'retracement', strength: 0.8, description: 'Level 2' },
        
        // Second confluence zone (stronger)
        { ratio: 0.618, price: 75.0, type: 'retracement', strength: 1.0, description: 'Level 3' },
        { ratio: 1.618, price: 75.05, type: 'extension', strength: 1.0, description: 'Level 4' },
        { ratio: 0.5, price: 75.02, type: 'retracement', strength: 0.9, description: 'Level 5' }
      ];

      const confluenceZones = fibonacciService.findConfluenceZones(levels);

      expect(confluenceZones.length).toBeGreaterThanOrEqual(1);
      
      // If multiple zones exist, they should be sorted by strength
      if (confluenceZones.length > 1) {
        expect(confluenceZones[0].strength).toBeGreaterThanOrEqual(confluenceZones[1].strength);
      }
    });
  });

  describe('identifyGoldenRatioZones', () => {
    it('should identify golden ratio levels and give them extra strength', () => {
      const levels: FibonacciLevel[] = [
        { ratio: 0.618, price: 75.0, type: 'retracement', strength: 1.0, description: 'Golden Ratio' },
        { ratio: 1.618, price: 120.0, type: 'extension', strength: 1.0, description: 'Inverse Golden Ratio' },
        { ratio: 0.382, price: 85.0, type: 'retracement', strength: 0.8, description: 'Standard Level' }
      ];

      const goldenRatioZones = fibonacciService.identifyGoldenRatioZones(levels);

      expect(goldenRatioZones).toHaveLength(2);
      
      goldenRatioZones.forEach(zone => {
        expect(zone.type).toBe('golden_ratio');
        expect(zone.strength).toBe(1.5); // 1.0 * 1.5 multiplier
      });
    });
  });

  describe('analyzeFibonacciClusters', () => {
    it('should analyze clusters from multiple swing points', () => {
      const candles: CandleData[] = []; // Not used in this test
      
      const swingPoints = [
        { high: 100, low: 50, highTime: 1000, lowTime: 1500 },
        { high: 120, low: 60, highTime: 2000, lowTime: 2500 },
        { high: 110, low: 70, highTime: 3000, lowTime: 3500 }
      ];

      const clusters = fibonacciService.analyzeFibonacciClusters(candles, swingPoints);

      expect(clusters.length).toBeGreaterThan(0);
      
      // Clusters should be sorted by strength
      for (let i = 0; i < clusters.length - 1; i++) {
        expect(clusters[i].strength).toBeGreaterThanOrEqual(clusters[i + 1].strength);
      }

      // Each cluster should have at least 2 levels
      clusters.forEach(cluster => {
        expect(cluster.levels.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('generateFibonacciAnalysis', () => {
    it('should generate complete Fibonacci analysis', () => {
      const high = 100;
      const low = 50;
      const startTime = 1000;
      const endTime = 2000;

      const analysis = fibonacciService.generateFibonacciAnalysis(high, low, startTime, endTime);

      expect(analysis.retracements).toHaveLength(5);
      expect(analysis.extensions).toHaveLength(3);
      expect(analysis.timeProjections).toHaveLength(5);
      expect(analysis.highPrice).toBe(high);
      expect(analysis.lowPrice).toBe(low);
      expect(analysis.swingHigh).toBe(high);
      expect(analysis.swingLow).toBe(low);
      
      // Should include confluence zones if any levels overlap
      expect(Array.isArray(analysis.confluenceZones)).toBe(true);
    });

    it('should include additional levels in confluence analysis', () => {
      const additionalLevels: FibonacciLevel[] = [
        { ratio: 0.618, price: 69.0, type: 'retracement', strength: 1.0, description: 'Additional Level' }
      ];

      const analysis = fibonacciService.generateFibonacciAnalysis(100, 50, 1000, 2000, additionalLevels);

      // Should detect confluence between calculated 61.8% level (69.1) and additional level (69.0)
      expect(analysis.confluenceZones.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle identical high and low prices', () => {
      const input = { high: 100, low: 100 };
      const retracements = fibonacciService.calculateRetracements(input);

      retracements.forEach(level => {
        expect(level.price).toBe(100);
      });
    });

    it('should handle very small price ranges', () => {
      const input = { high: 100.001, low: 100.000 };
      const retracements = fibonacciService.calculateRetracements(input);

      expect(retracements).toHaveLength(5);
      retracements.forEach(level => {
        expect(level.price).toBeGreaterThanOrEqual(100.000);
        expect(level.price).toBeLessThanOrEqual(100.001);
      });
    });

    it('should handle empty levels array for confluence detection', () => {
      const confluenceZones = fibonacciService.findConfluenceZones([]);
      expect(confluenceZones).toHaveLength(0);
    });

    it('should handle single level for confluence detection', () => {
      const levels: FibonacciLevel[] = [
        { ratio: 0.618, price: 75.0, type: 'retracement', strength: 1.0, description: 'Single Level' }
      ];

      const confluenceZones = fibonacciService.findConfluenceZones(levels);
      expect(confluenceZones).toHaveLength(0);
    });
  });

  describe('mathematical accuracy', () => {
    it('should maintain precision in calculations', () => {
      const input = { high: 1.23456789, low: 0.98765432 };
      const retracements = fibonacciService.calculateRetracements(input);

      const range = input.high - input.low;
      const goldenRatioLevel = retracements.find(r => Math.abs(r.ratio - 0.618) < 0.001);
      
      const expectedPrice = input.high - (range * 0.618);
      expect(goldenRatioLevel?.price).toBeCloseTo(expectedPrice, 8);
    });

    it('should handle negative price movements in extensions', () => {
      const wave1: Wave = {
        id: 'wave1',
        type: 'wave_1',
        degree: 'minor',
        startPrice: 100,
        endPrice: 80, // Negative movement
        startTime: 1000,
        endTime: 2000,
        length: 20,
        duration: 1000
      };

      const wave2: Wave = {
        id: 'wave2',
        type: 'wave_2',
        degree: 'minor',
        startPrice: 80,
        endPrice: 90,
        startTime: 2000,
        endTime: 3000,
        length: 10,
        duration: 1000
      };

      const extensions = fibonacciService.calculateExtensions(wave1, wave2);

      extensions.forEach(extension => {
        expect(typeof extension.price).toBe('number');
        expect(isFinite(extension.price)).toBe(true);
      });
    });
  });
});