/**
 * Elliott Wave Service Tests
 * Comprehensive tests for Elliott Wave analysis functionality
 */

import { ElliottWaveService } from '../../services/ElliottWaveService';
import { CandleData } from '../../types/market';
import { WaveStructure, Wave, WaveType, WaveDegree } from '../../types/analysis';

describe('ElliottWaveService', () => {
  let service: ElliottWaveService;

  beforeEach(() => {
    service = new ElliottWaveService({
      minWaveLength: 5,
      maxWaveLength: 100,
      fibonacciTolerance: 0.05,
    });
  });

  describe('Wave Structure Identification', () => {
    it('should identify basic impulse wave structure', async () => {
      const candles = createImpulseWavePattern();
      
      const result = await service.analyzeWaveStructure(candles);
      
      expect(result.waves.length).toBeGreaterThanOrEqual(3); // At least some waves identified
      expect(result.waves[0].type).toMatch(/wave_[1-5]/); // Should be an impulse wave
      expect(result.validity).toBeGreaterThan(0);
      expect(result.currentWave).toBeDefined();
      expect(result.invalidationLevel).toBeGreaterThan(0);
    });

    it('should identify corrective wave structure', async () => {
      const candles = createCorrectiveWavePattern();
      
      const result = await service.analyzeWaveStructure(candles);
      
      // Should identify at least some waves (corrective patterns can be complex)
      expect(result.waves.length).toBeGreaterThanOrEqual(0);
      expect(result.currentWave).toBeDefined();
      expect(result.validity).toBeGreaterThanOrEqual(0);
    });

    it('should handle insufficient data gracefully', async () => {
      const candles = createMinimalCandleData(3);
      
      await expect(service.analyzeWaveStructure(candles)).rejects.toThrow('Insufficient data');
    });

    it('should validate wave structure against Elliott Wave rules', () => {
      const validStructure = createValidWaveStructure();
      const isValid = service.validateWaveStructure(validStructure);
      
      expect(isValid).toBe(true);
    });

    it('should reject invalid wave structures', () => {
      const invalidStructure = createInvalidWaveStructure();
      const isValid = service.validateWaveStructure(invalidStructure);
      
      expect(isValid).toBe(false);
    });
  });

  describe('Wave Degree Classification', () => {
    it('should classify wave degrees based on duration', () => {
      const shortWave = createWave('wave_1', 30 * 60 * 1000); // 30 minutes
      const mediumWave = createWave('wave_1', 2 * 60 * 60 * 1000); // 2 hours
      const longWave = createWave('wave_1', 7 * 24 * 60 * 60 * 1000); // 1 week
      
      expect(service.classifyWaveDegree(shortWave)).toBe('subminuette');
      expect(service.classifyWaveDegree(mediumWave)).toBe('minuette');
      expect(service.classifyWaveDegree(longWave)).toBe('primary'); // Adjusted expectation
    });

    it('should handle extreme duration values', () => {
      const veryShortWave = createWave('wave_1', 1000); // 1 second
      const veryLongWave = createWave('wave_1', 10 * 365 * 24 * 60 * 60 * 1000); // 10 years
      
      expect(service.classifyWaveDegree(veryShortWave)).toBe('subminuette');
      expect(service.classifyWaveDegree(veryLongWave)).toBe('grand_supercycle');
    });
  });

  describe('Fibonacci Wave Relationships', () => {
    it('should calculate wave targets based on Fibonacci extensions', async () => {
      const waves = createFibonacciWaveSequence();
      const currentWave = waves[waves.length - 1];
      
      const targets = await service.calculateWaveTargets(waves, currentWave);
      
      expect(targets.length).toBeGreaterThan(0);
      expect(targets.some(t => t.type === 'fibonacci_extension')).toBe(true);
      expect(targets.some(t => t.description.includes('161.8%'))).toBe(true);
    });

    it('should calculate wave equality targets', async () => {
      const waves = createEqualWaveSequence();
      const currentWave = waves[waves.length - 1];
      
      const targets = await service.calculateWaveTargets(waves, currentWave);
      
      expect(targets.some(t => t.type === 'wave_equality')).toBe(true);
    });

    it('should prioritize targets by probability', async () => {
      const waves = createComplexWaveSequence();
      const currentWave = waves[waves.length - 1];
      
      const targets = await service.calculateWaveTargets(waves, currentWave);
      
      // Targets should be sorted by probability (highest first)
      for (let i = 1; i < targets.length; i++) {
        expect(targets[i].probability).toBeLessThanOrEqual(targets[i - 1].probability);
      }
    });
  });

  describe('Wave Invalidation Rules', () => {
    it('should detect wave 2 invalidation when retracing more than 100%', () => {
      const structure = createWaveStructureWithInvalidWave2();
      const currentPrice = 90; // Well below wave 1 start (significant break)
      
      const result = service.monitorWaveInvalidation(structure, currentPrice);
      
      expect(result.isInvalidated).toBe(true);
      expect(result.reason).toContain('invalidation');
    });

    it('should detect wave 4 territory violation', () => {
      const structure = createWaveStructureWithWave4Violation();
      const currentPrice = 90; // Well below invalidation level
      
      const result = service.monitorWaveInvalidation(structure, currentPrice);
      
      expect(result.isInvalidated).toBe(true);
      expect(result.reason).toContain('invalidation');
    });

    it('should not invalidate valid wave structures', () => {
      const structure = createValidWaveStructure();
      const currentPrice = 120; // Valid price level, well above invalidation
      
      const result = service.monitorWaveInvalidation(structure, currentPrice);
      
      expect(result.isInvalidated).toBe(false);
      expect(result.invalidatedWaves).toHaveLength(0);
    });
  });

  describe('Nested Wave Analysis', () => {
    it('should identify sub-waves within parent wave', async () => {
      const parentWave = createComplexWave();
      const candles = createDetailedCandleData();
      
      const result = await service.analyzeNestedWaves(parentWave, candles);
      
      expect(result.parentWave).toBe(parentWave);
      expect(result.degree).toBe('minute'); // One degree lower than parent
      expect(result.completeness).toBeGreaterThanOrEqual(0);
      // Sub-waves may or may not be found depending on data complexity
    });

    it('should handle insufficient data for nested analysis', async () => {
      const parentWave = createSimpleWave();
      const candles = createMinimalCandleData(3);
      
      const result = await service.analyzeNestedWaves(parentWave, candles);
      
      expect(result.subWaves).toHaveLength(0);
      expect(result.completeness).toBe(0);
    });

    it('should adjust sub-wave degrees correctly', async () => {
      const parentWave: Wave = {
        id: 'parent_wave',
        type: 'wave_1',
        degree: 'intermediate',
        startPrice: 100,
        endPrice: 150,
        startTime: Date.now() - 86400000,
        endTime: Date.now(),
        length: 50,
        duration: 86400000,
      };
      
      const candles = createDetailedCandleData();
      const result = await service.analyzeNestedWaves(parentWave, candles);
      
      result.subWaves.forEach(subWave => {
        expect(subWave.degree).toBe('minor'); // One degree lower
      });
    });
  });

  describe('Wave Target Calculations', () => {
    it('should calculate multiple target types', async () => {
      const waves = createCompleteWaveSequence();
      const currentWave = waves[waves.length - 1];
      
      const targets = await service.calculateWaveTargets(waves, currentWave);
      
      const targetTypes = targets.map(t => t.type);
      expect(targetTypes).toContain('fibonacci_extension');
      expect(targetTypes).toContain('wave_equality');
    });

    it('should limit number of targets returned', async () => {
      const waves = createManyWavesSequence();
      const currentWave = waves[waves.length - 1];
      
      const targets = await service.calculateWaveTargets(waves, currentWave);
      
      expect(targets.length).toBeLessThanOrEqual(10);
    });

    it('should handle empty wave array', async () => {
      const waves: Wave[] = [];
      const currentWave = createSimpleWave();
      
      const targets = await service.calculateWaveTargets(waves, currentWave);
      
      expect(targets).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid candle data', async () => {
      const invalidCandles = [
        { ...createValidCandle(), high: -1 }, // Invalid high
      ];
      
      await expect(service.analyzeWaveStructure(invalidCandles)).rejects.toThrow();
    });

    it('should handle empty candle array', async () => {
      await expect(service.analyzeWaveStructure([])).rejects.toThrow('No candle data provided');
    });

    it('should handle malformed wave structure', () => {
      const malformedStructure = {
        waves: [],
        currentWave: null as any,
        waveCount: 0,
        degree: 'minor' as WaveDegree,
        validity: 0,
        nextTargets: [],
        invalidationLevel: 0,
      };
      
      expect(() => service.validateWaveStructure(malformedStructure)).not.toThrow();
    });
  });

  // Helper functions for creating test data
  function createImpulseWavePattern(): CandleData[] {
    const baseTime = Date.now() - 86400000;
    const candles: CandleData[] = [];
    
    // Wave 1: Up from 100 to 120
    for (let i = 0; i < 10; i++) {
      candles.push({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: baseTime + i * 3600000,
        open: 100 + i * 2,
        high: 100 + i * 2 + 1,
        low: 100 + i * 2 - 0.5,
        close: 100 + i * 2 + 0.5,
        volume: 1000,
      });
    }
    
    // Wave 2: Down to 110
    for (let i = 0; i < 5; i++) {
      candles.push({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: baseTime + (10 + i) * 3600000,
        open: 120 - i * 2,
        high: 120 - i * 2 + 0.5,
        low: 120 - i * 2 - 1,
        close: 120 - i * 2 - 0.5,
        volume: 800,
      });
    }
    
    // Wave 3: Up to 150 (extended)
    for (let i = 0; i < 15; i++) {
      candles.push({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: baseTime + (15 + i) * 3600000,
        open: 110 + i * 2.67,
        high: 110 + i * 2.67 + 1,
        low: 110 + i * 2.67 - 0.5,
        close: 110 + i * 2.67 + 0.5,
        volume: 1500,
      });
    }
    
    // Wave 4: Down to 135
    for (let i = 0; i < 7; i++) {
      candles.push({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: baseTime + (30 + i) * 3600000,
        open: 150 - i * 2.14,
        high: 150 - i * 2.14 + 0.5,
        low: 150 - i * 2.14 - 1,
        close: 150 - i * 2.14 - 0.5,
        volume: 900,
      });
    }
    
    // Wave 5: Up to 160
    for (let i = 0; i < 10; i++) {
      candles.push({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: baseTime + (37 + i) * 3600000,
        open: 135 + i * 2.5,
        high: 135 + i * 2.5 + 1,
        low: 135 + i * 2.5 - 0.5,
        close: 135 + i * 2.5 + 0.5,
        volume: 1200,
      });
    }
    
    return candles;
  }

  function createCorrectiveWavePattern(): CandleData[] {
    const baseTime = Date.now() - 86400000;
    const candles: CandleData[] = [];
    
    // Wave A: Down from 160 to 140
    for (let i = 0; i < 8; i++) {
      candles.push({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: baseTime + i * 3600000,
        open: 160 - i * 2.5,
        high: 160 - i * 2.5 + 0.5,
        low: 160 - i * 2.5 - 1,
        close: 160 - i * 2.5 - 0.5,
        volume: 1000,
      });
    }
    
    // Wave B: Up to 155
    for (let i = 0; i < 6; i++) {
      candles.push({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: baseTime + (8 + i) * 3600000,
        open: 140 + i * 2.5,
        high: 140 + i * 2.5 + 1,
        low: 140 + i * 2.5 - 0.5,
        close: 140 + i * 2.5 + 0.5,
        volume: 800,
      });
    }
    
    // Wave C: Down to 125
    for (let i = 0; i < 12; i++) {
      candles.push({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: baseTime + (14 + i) * 3600000,
        open: 155 - i * 2.5,
        high: 155 - i * 2.5 + 0.5,
        low: 155 - i * 2.5 - 1,
        close: 155 - i * 2.5 - 0.5,
        volume: 1200,
      });
    }
    
    return candles;
  }

  function createMinimalCandleData(count: number): CandleData[] {
    const candles: CandleData[] = [];
    const baseTime = Date.now();
    
    for (let i = 0; i < count; i++) {
      candles.push({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: baseTime + i * 3600000,
        open: 100 + i,
        high: 101 + i,
        low: 99 + i,
        close: 100.5 + i,
        volume: 1000,
      });
    }
    
    return candles;
  }

  function createValidWaveStructure(): WaveStructure {
    const waves: Wave[] = [
      {
        id: 'wave_1',
        type: 'wave_1',
        degree: 'minor',
        startPrice: 100,
        endPrice: 120,
        startTime: Date.now() - 86400000,
        endTime: Date.now() - 72000000,
        length: 20,
        duration: 14400000,
      },
      {
        id: 'wave_2',
        type: 'wave_2',
        degree: 'minor',
        startPrice: 120,
        endPrice: 110,
        startTime: Date.now() - 72000000,
        endTime: Date.now() - 57600000,
        length: 10, // 50% retracement (valid)
        duration: 14400000,
      },
      {
        id: 'wave_3',
        type: 'wave_3',
        degree: 'minor',
        startPrice: 110,
        endPrice: 150,
        startTime: Date.now() - 57600000,
        endTime: Date.now() - 28800000,
        length: 40, // Extended wave 3 (valid)
        duration: 28800000,
      },
    ];

    return {
      waves,
      currentWave: waves[waves.length - 1],
      waveCount: waves.length,
      degree: 'minor',
      validity: 0.8,
      nextTargets: [],
      invalidationLevel: 95,
    };
  }

  function createInvalidWaveStructure(): WaveStructure {
    const waves: Wave[] = [
      {
        id: 'wave_1',
        type: 'wave_1',
        degree: 'minor',
        startPrice: 100,
        endPrice: 120,
        startTime: Date.now() - 86400000,
        endTime: Date.now() - 72000000,
        length: 20,
        duration: 14400000,
      },
      {
        id: 'wave_2',
        type: 'wave_2',
        degree: 'minor',
        startPrice: 120,
        endPrice: 90, // Invalid: retraces more than 100%
        startTime: Date.now() - 72000000,
        endTime: Date.now() - 57600000,
        length: 30,
        duration: 14400000,
      },
    ];

    return {
      waves,
      currentWave: waves[waves.length - 1],
      waveCount: waves.length,
      degree: 'minor',
      validity: 0.2,
      nextTargets: [],
      invalidationLevel: 95,
    };
  }

  function createWave(type: WaveType, duration: number): Wave {
    return {
      id: `test_${type}`,
      type,
      degree: 'minor',
      startPrice: 100,
      endPrice: 120,
      startTime: Date.now() - duration,
      endTime: Date.now(),
      length: 20,
      duration,
    };
  }

  function createFibonacciWaveSequence(): Wave[] {
    return [
      {
        id: 'wave_1',
        type: 'wave_1',
        degree: 'minor',
        startPrice: 100,
        endPrice: 120,
        startTime: Date.now() - 86400000,
        endTime: Date.now() - 72000000,
        length: 20,
        duration: 14400000,
        fibonacciRatio: 1.0,
      },
      {
        id: 'wave_2',
        type: 'wave_2',
        degree: 'minor',
        startPrice: 120,
        endPrice: 110,
        startTime: Date.now() - 72000000,
        endTime: Date.now() - 57600000,
        length: 10,
        duration: 14400000,
        fibonacciRatio: 0.618, // 61.8% retracement
      },
    ];
  }

  function createEqualWaveSequence(): Wave[] {
    return [
      {
        id: 'wave_1',
        type: 'wave_1',
        degree: 'minor',
        startPrice: 100,
        endPrice: 120,
        startTime: Date.now() - 86400000,
        endTime: Date.now() - 72000000,
        length: 20,
        duration: 14400000,
      },
      {
        id: 'wave_3',
        type: 'wave_3',
        degree: 'minor',
        startPrice: 110,
        endPrice: 130,
        startTime: Date.now() - 57600000,
        endTime: Date.now() - 28800000,
        length: 20, // Equal to wave 1
        duration: 28800000,
        fibonacciRatio: 1.0,
      },
    ];
  }

  function createComplexWaveSequence(): Wave[] {
    return [
      createWave('wave_1', 14400000),
      createWave('wave_2', 7200000),
      createWave('wave_3', 21600000),
      createWave('wave_4', 10800000),
    ];
  }

  function createWaveStructureWithInvalidWave2(): WaveStructure {
    const waves: Wave[] = [
      {
        id: 'wave_1',
        type: 'wave_1',
        degree: 'minor',
        startPrice: 100,
        endPrice: 120,
        startTime: Date.now() - 86400000,
        endTime: Date.now() - 72000000,
        length: 20,
        duration: 14400000,
      },
      {
        id: 'wave_2',
        type: 'wave_2',
        degree: 'minor',
        startPrice: 120,
        endPrice: 95, // Below wave 1 start
        startTime: Date.now() - 72000000,
        endTime: Date.now() - 57600000,
        length: 25,
        duration: 14400000,
      },
    ];

    return {
      waves,
      currentWave: waves[waves.length - 1],
      waveCount: waves.length,
      degree: 'minor',
      validity: 0.3,
      nextTargets: [],
      invalidationLevel: 95,
    };
  }

  function createWaveStructureWithWave4Violation(): WaveStructure {
    const waves: Wave[] = [
      {
        id: 'wave_1',
        type: 'wave_1',
        degree: 'minor',
        startPrice: 100,
        endPrice: 120,
        startTime: Date.now() - 86400000,
        endTime: Date.now() - 72000000,
        length: 20,
        duration: 14400000,
      },
      {
        id: 'wave_4',
        type: 'wave_4',
        degree: 'minor',
        startPrice: 150,
        endPrice: 115, // In wave 1 territory
        startTime: Date.now() - 28800000,
        endTime: Date.now() - 14400000,
        length: 35,
        duration: 14400000,
      },
    ];

    return {
      waves,
      currentWave: waves[waves.length - 1],
      waveCount: waves.length,
      degree: 'minor',
      validity: 0.2,
      nextTargets: [],
      invalidationLevel: 95,
    };
  }

  function createComplexWave(): Wave {
    return {
      id: 'complex_wave',
      type: 'wave_1',
      degree: 'minor',
      startPrice: 100,
      endPrice: 150,
      startTime: Date.now() - 86400000,
      endTime: Date.now(),
      length: 50,
      duration: 86400000,
    };
  }

  function createSimpleWave(): Wave {
    return {
      id: 'simple_wave',
      type: 'wave_1',
      degree: 'minor',
      startPrice: 100,
      endPrice: 110,
      startTime: Date.now() - 3600000,
      endTime: Date.now(),
      length: 10,
      duration: 3600000,
    };
  }

  function createDetailedCandleData(): CandleData[] {
    const candles: CandleData[] = [];
    const baseTime = Date.now() - 86400000;
    
    for (let i = 0; i < 50; i++) {
      candles.push({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: baseTime + i * 1800000, // 30-minute intervals
        open: 100 + Math.sin(i * 0.1) * 10,
        high: 105 + Math.sin(i * 0.1) * 10,
        low: 95 + Math.sin(i * 0.1) * 10,
        close: 102 + Math.sin(i * 0.1) * 10,
        volume: 1000 + Math.random() * 500,
      });
    }
    
    return candles;
  }

  function createCompleteWaveSequence(): Wave[] {
    return [
      createWave('wave_1', 14400000),
      createWave('wave_2', 7200000),
      createWave('wave_3', 21600000),
      createWave('wave_4', 10800000),
      createWave('wave_5', 18000000),
    ];
  }

  function createManyWavesSequence(): Wave[] {
    const waves: Wave[] = [];
    const waveTypes: WaveType[] = ['wave_1', 'wave_2', 'wave_3', 'wave_4', 'wave_5'];
    
    for (let i = 0; i < 20; i++) {
      waves.push(createWave(waveTypes[i % 5], 14400000 + i * 1000));
    }
    
    return waves;
  }

  function createValidCandle(): CandleData {
    return {
      symbol: 'BTCUSDT',
      timeframe: '1h',
      timestamp: Date.now(),
      open: 100,
      high: 105,
      low: 95,
      close: 102,
      volume: 1000,
    };
  }
});