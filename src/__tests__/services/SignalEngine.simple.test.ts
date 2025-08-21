/**
 * Simple Signal Engine Tests
 * Basic tests for the signal generation engine
 */

import { SignalEngine } from '../../services/SignalEngine';

// Mock the dependencies
jest.mock('../../models/TradingSignal', () => ({
  TradingSignalModel: {
    create: jest.fn(),
    updateStatus: jest.fn(),
    findByConfidenceRange: jest.fn(),
  },
}));

jest.mock('../../validation/trading.validation', () => ({
  validateTradingSignal: jest.fn(() => ({ error: null })),
}));

describe('SignalEngine - Basic Tests', () => {
  let signalEngine: SignalEngine;

  beforeEach(() => {
    signalEngine = new SignalEngine();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const engine = new SignalEngine();
      expect(engine).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const engine = new SignalEngine({
        minConfidence: 0.8,
        requireStopLoss: false,
      });
      expect(engine).toBeDefined();
    });
  });

  describe('calculateConfidence', () => {
    it('should calculate confidence from component scores', () => {
      const mockSignal = {
        symbol: 'BTCUSDT',
        direction: 'long' as const,
        confidence: 0.8,
        entryPrice: 50000,
        takeProfit: [51000],
        reasoning: {
          technical: { indicators: [], confluence: 0.7, trend: 'bullish' },
          patterns: { detected: [], strength: 0.6 },
          elliottWave: { currentWave: 'wave_1', wavePosition: 'Wave 1', validity: 0.8 },
          fibonacci: { levels: [], confluence: 0.7 },
          volume: { profile: 'increasing', strength: 0.6 },
          summary: 'Test signal',
        },
        timestamp: Date.now(),
        technicalScore: 0.8,
        patternScore: 0.7,
        elliottWaveScore: 0.9,
        fibonacciScore: 0.6,
        volumeScore: 0.5,
      };

      const confidence = signalEngine.calculateConfidence(mockSignal);
      
      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });

    it('should handle missing component scores', () => {
      const mockSignal = {
        symbol: 'BTCUSDT',
        direction: 'long' as const,
        confidence: 0.8,
        entryPrice: 50000,
        takeProfit: [51000],
        reasoning: {
          technical: { indicators: [], confluence: 0.7, trend: 'bullish' },
          patterns: { detected: [], strength: 0.6 },
          elliottWave: { currentWave: 'wave_1', wavePosition: 'Wave 1', validity: 0.8 },
          fibonacci: { levels: [], confluence: 0.7 },
          volume: { profile: 'increasing', strength: 0.6 },
          summary: 'Test signal',
        },
        timestamp: Date.now(),
      };

      const confidence = signalEngine.calculateConfidence(mockSignal);
      
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('updateConfiguration', () => {
    it('should update configuration without errors', () => {
      expect(() => {
        signalEngine.updateConfiguration({
          minConfidence: 0.7,
          requireStopLoss: false,
        });
      }).not.toThrow();
    });

    it('should update weights', () => {
      expect(() => {
        signalEngine.updateConfiguration({
          weights: {
            technical: 0.5,
            patterns: 0.3,
            elliottWave: 0.2,
          },
        });
      }).not.toThrow();
    });
  });

  describe('filterSignals', () => {
    it('should filter signals by confidence', () => {
      const mockSignals = [
        {
          symbol: 'BTCUSDT',
          direction: 'long' as const,
          confidence: 0.8,
          entryPrice: 50000,
          takeProfit: [51000],
          reasoning: {
            technical: { indicators: [], confluence: 0.8, trend: 'bullish' },
            patterns: { detected: [], strength: 0.6 },
            elliottWave: { currentWave: 'wave_1', wavePosition: 'Wave 1', validity: 0.8 },
            fibonacci: { levels: [], confluence: 0.8 },
            volume: { profile: 'increasing', strength: 0.6 },
            summary: 'High confidence signal',
          },
          timestamp: Date.now(),
        },
        {
          symbol: 'ETHUSDT',
          direction: 'short' as const,
          confidence: 0.5,
          entryPrice: 3000,
          takeProfit: [2900],
          reasoning: {
            technical: { indicators: [], confluence: 0.5, trend: 'bearish' },
            patterns: { detected: [], strength: 0.4 },
            elliottWave: { currentWave: 'wave_a', wavePosition: 'Wave A', validity: 0.6 },
            fibonacci: { levels: [], confluence: 0.5 },
            volume: { profile: 'decreasing', strength: 0.4 },
            summary: 'Low confidence signal',
          },
          timestamp: Date.now(),
        },
      ];

      const filters = [{ minConfidence: 0.7, minConfluence: 0 }];
      const filtered = signalEngine.filterSignals(mockSignals, filters);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].symbol).toBe('BTCUSDT');
    });
  });
});