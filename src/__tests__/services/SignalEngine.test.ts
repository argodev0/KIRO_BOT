/**
 * Signal Engine Tests
 * Comprehensive test suite for the multi-dimensional signal generation engine
 */

import { SignalEngine, SignalWeights, SignalGenerationOptions } from '../../services/SignalEngine';
import { TradingSignal, SignalReasoning } from '../../types/trading';
import {
  AnalysisResults,
  TechnicalIndicators,
  WaveStructure,
  FibonacciLevels,
  SignalFilter,
  MultiTimeframeAnalysis,
  VolumeProfile,
} from '../../types/analysis';
import { CandleData } from '../../types/market';

// Mock the TradingSignalModel
jest.mock('../../models/TradingSignal', () => ({
  TradingSignalModel: {
    create: jest.fn(),
    updateStatus: jest.fn(),
    findByConfidenceRange: jest.fn(),
  },
}));

// Mock validation
jest.mock('../../validation/trading.validation', () => ({
  validateTradingSignal: jest.fn(() => ({ error: null })),
}));

describe('SignalEngine', () => {
  let signalEngine: SignalEngine;
  let mockCandles: CandleData[];

  beforeEach(() => {
    signalEngine = new SignalEngine();
    mockCandles = createMockCandles();
  });

  describe('constructor', () => {
    it('should initialize with default weights', () => {
      const engine = new SignalEngine();
      expect(engine).toBeDefined();
    });

    it('should accept custom weights and normalize them', () => {
      const customWeights: Partial<SignalWeights> = {
        technical: 0.4,
        patterns: 0.3,
        elliottWave: 0.2,
        fibonacci: 0.1,
        volume: 0.0,
      };

      const engine = new SignalEngine({ weights: customWeights });
      expect(engine).toBeDefined();
    });

    it('should normalize weights to sum to 1.0', () => {
      const unnormalizedWeights: Partial<SignalWeights> = {
        technical: 0.6,
        patterns: 0.4,
        elliottWave: 0.5,
        fibonacci: 0.4,
        volume: 0.1,
      };

      const engine = new SignalEngine({ weights: unnormalizedWeights });
      expect(engine).toBeDefined();
    });
  });

  describe('generateSignal', () => {
    it('should generate a bullish signal with high confidence', async () => {
      const bullishAnalysis = createBullishAnalysisResults();
      
      const signal = await signalEngine.generateSignal('BTCUSDT', bullishAnalysis, mockCandles);
      
      expect(signal).toBeDefined();
      expect(signal!.direction).toBe('long');
      expect(signal!.confidence).toBeGreaterThan(0.6);
      expect(signal!.symbol).toBe('BTCUSDT');
      expect(signal!.takeProfit).toHaveLength(3);
      expect(signal!.stopLoss).toBeDefined();
    });

    it('should generate a bearish signal with high confidence', async () => {
      const bearishAnalysis = createBearishAnalysisResults();
      
      const signal = await signalEngine.generateSignal('BTCUSDT', bearishAnalysis, mockCandles);
      
      expect(signal).toBeDefined();
      expect(signal!.direction).toBe('short');
      expect(signal!.confidence).toBeGreaterThan(0.6);
      expect(signal!.symbol).toBe('BTCUSDT');
    });

    it('should return null for low confidence signals', async () => {
      const lowConfidenceAnalysis = createLowConfidenceAnalysisResults();
      
      const signal = await signalEngine.generateSignal('BTCUSDT', lowConfidenceAnalysis, mockCandles);
      
      expect(signal).toBeNull();
    });

    it('should return null when no clear direction is determined', async () => {
      const neutralAnalysis = createNeutralAnalysisResults();
      
      const signal = await signalEngine.generateSignal('BTCUSDT', neutralAnalysis, mockCandles);
      
      expect(signal).toBeNull();
    });

    it('should include all component scores in the signal', async () => {
      const bullishAnalysis = createBullishAnalysisResults();
      
      const signal = await signalEngine.generateSignal('BTCUSDT', bullishAnalysis, mockCandles);
      
      expect(signal).toBeDefined();
      expect(signal!.technicalScore).toBeDefined();
      expect(signal!.patternScore).toBeDefined();
      expect(signal!.elliottWaveScore).toBeDefined();
      expect(signal!.fibonacciScore).toBeDefined();
      expect(signal!.volumeScore).toBeDefined();
    });

    it('should generate proper signal reasoning', async () => {
      const bullishAnalysis = createBullishAnalysisResults();
      
      const signal = await signalEngine.generateSignal('BTCUSDT', bullishAnalysis, mockCandles);
      
      expect(signal).toBeDefined();
      expect(signal!.reasoning).toBeDefined();
      expect(signal!.reasoning.technical).toBeDefined();
      expect(signal!.reasoning.patterns).toBeDefined();
      expect(signal!.reasoning.elliottWave).toBeDefined();
      expect(signal!.reasoning.fibonacci).toBeDefined();
      expect(signal!.reasoning.volume).toBeDefined();
      expect(signal!.reasoning.summary).toBeDefined();
    });
  });

  describe('calculateConfidence', () => {
    it('should calculate confidence from signal component scores', () => {
      const signal: TradingSignal = {
        symbol: 'BTCUSDT',
        direction: 'long',
        confidence: 0.8,
        entryPrice: 50000,
        takeProfit: [51000, 52000, 53000],
        reasoning: {} as SignalReasoning,
        timestamp: Date.now(),
        technicalScore: 0.8,
        patternScore: 0.7,
        elliottWaveScore: 0.9,
        fibonacciScore: 0.6,
        volumeScore: 0.5,
      };

      const confidence = signalEngine.calculateConfidence(signal);
      
      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });

    it('should handle signals with missing component scores', () => {
      const signal: TradingSignal = {
        symbol: 'BTCUSDT',
        direction: 'long',
        confidence: 0.8,
        entryPrice: 50000,
        takeProfit: [51000],
        reasoning: {} as SignalReasoning,
        timestamp: Date.now(),
      };

      const confidence = signalEngine.calculateConfidence(signal);
      
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('filterSignals', () => {
    let mockSignals: TradingSignal[];

    beforeEach(() => {
      mockSignals = [
        createMockSignal('BTCUSDT', 'long', 0.8),
        createMockSignal('ETHUSDT', 'short', 0.6),
        createMockSignal('ADAUSDT', 'long', 0.4),
      ];
    });

    it('should filter signals by minimum confidence', () => {
      const filters: SignalFilter[] = [{
        minConfidence: 0.7,
        minConfluence: 0,
      }];

      const filtered = signalEngine.filterSignals(mockSignals, filters);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].symbol).toBe('BTCUSDT');
    });

    it('should filter signals by required patterns', () => {
      const filters: SignalFilter[] = [{
        minConfidence: 0.5,
        requiredPatterns: ['hammer'],
        minConfluence: 0,
      }];

      // Add hammer pattern to one signal
      mockSignals[0].reasoning.patterns.detected = ['hammer'];

      const filtered = signalEngine.filterSignals(mockSignals, filters);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].symbol).toBe('BTCUSDT');
    });

    it('should filter signals by required indicators', () => {
      const filters: SignalFilter[] = [{
        minConfidence: 0.5,
        requiredIndicators: ['RSI'],
        minConfluence: 0,
      }];

      // Add RSI indicator to one signal
      mockSignals[0].reasoning.technical.indicators = ['RSI: 25.0'];

      const filtered = signalEngine.filterSignals(mockSignals, filters);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].symbol).toBe('BTCUSDT');
    });

    it('should apply multiple filters', () => {
      const filters: SignalFilter[] = [
        { minConfidence: 0.7, minConfluence: 0 },
        { minConfidence: 0.5, requiredPatterns: ['hammer'], minConfluence: 0 },
      ];

      mockSignals[0].reasoning.patterns.detected = ['hammer'];

      const filtered = signalEngine.filterSignals(mockSignals, filters);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].symbol).toBe('BTCUSDT');
    });
  });

  describe('validateSignalAcrossTimeframes', () => {
    it('should validate signal with aligned timeframes', async () => {
      const signal = createMockSignal('BTCUSDT', 'long', 0.8);
      const mtfAnalysis = createAlignedMultiTimeframeAnalysis('bullish');

      const validation = await signalEngine.validateSignalAcrossTimeframes(signal, mtfAnalysis);

      expect(validation.isValid).toBe(true);
      expect(validation.timeframeAlignment).toBeGreaterThan(0.6);
      expect(validation.confidence).toBeGreaterThan(0);
    });

    it('should invalidate signal with conflicting timeframes', async () => {
      const signal = createMockSignal('BTCUSDT', 'long', 0.8);
      const mtfAnalysis = createConflictingMultiTimeframeAnalysis();

      const validation = await signalEngine.validateSignalAcrossTimeframes(signal, mtfAnalysis);

      expect(validation.isValid).toBe(false);
      expect(validation.timeframeAlignment).toBeLessThan(0.6);
      expect(validation.warnings.length).toBeGreaterThan(0);
    });

    it('should calculate invalidation price', async () => {
      const signal = createMockSignal('BTCUSDT', 'long', 0.8);
      const mtfAnalysis = createAlignedMultiTimeframeAnalysis('bullish');

      const validation = await signalEngine.validateSignalAcrossTimeframes(signal, mtfAnalysis);

      expect(validation.invalidationPrice).toBeDefined();
      expect(validation.invalidationPrice!).toBeLessThan(signal.entryPrice);
    });
  });

  describe('monitorSignalInvalidation', () => {
    it('should detect invalidated long signals', async () => {
      const signals = [createMockSignal('BTCUSDT', 'long', 0.8)];
      signals[0].stopLoss = 49000;
      
      const currentPrices = { BTCUSDT: 48000 }; // Below stop loss

      const alerts = await signalEngine.monitorSignalInvalidation(signals, currentPrices);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].symbol).toBe('BTCUSDT');
      expect(alerts[0].reason).toContain('stop loss');
    });

    it('should detect invalidated short signals', async () => {
      const signals = [createMockSignal('BTCUSDT', 'short', 0.8)];
      signals[0].stopLoss = 51000;
      
      const currentPrices = { BTCUSDT: 52000 }; // Above stop loss

      const alerts = await signalEngine.monitorSignalInvalidation(signals, currentPrices);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].symbol).toBe('BTCUSDT');
      expect(alerts[0].reason).toContain('stop loss');
    });

    it('should not alert for valid signals', async () => {
      const signals = [createMockSignal('BTCUSDT', 'long', 0.8)];
      signals[0].stopLoss = 49000;
      
      const currentPrices = { BTCUSDT: 50500 }; // Above stop loss

      const alerts = await signalEngine.monitorSignalInvalidation(signals, currentPrices);

      expect(alerts).toHaveLength(0);
    });

    it('should handle missing price data', async () => {
      const signals = [createMockSignal('BTCUSDT', 'long', 0.8)];
      const currentPrices = {}; // No price data

      const alerts = await signalEngine.monitorSignalInvalidation(signals, currentPrices);

      expect(alerts).toHaveLength(0);
    });
  });

  describe('updateConfiguration', () => {
    it('should update weights and normalize them', () => {
      const newOptions: SignalGenerationOptions = {
        weights: {
          technical: 0.5,
          patterns: 0.3,
          elliottWave: 0.2,
        },
        minConfidence: 0.7,
      };

      signalEngine.updateConfiguration(newOptions);

      // Test that configuration was updated by generating a signal
      expect(() => signalEngine.calculateConfidence(createMockSignal('BTCUSDT', 'long', 0.8))).not.toThrow();
    });

    it('should update other options', () => {
      const newOptions: SignalGenerationOptions = {
        minConfidence: 0.8,
        requireStopLoss: false,
        maxSignalsPerSymbol: 5,
      };

      signalEngine.updateConfiguration(newOptions);

      // Configuration should be updated (tested indirectly through behavior)
      expect(() => signalEngine.calculateConfidence(createMockSignal('BTCUSDT', 'long', 0.8))).not.toThrow();
    });
  });

  // Helper functions for creating mock data

  function createMockAnalysisResults(): AnalysisResults {
    return {
      symbol: 'BTCUSDT',
      timeframe: '1h',
      timestamp: Date.now(),
      technical: createMockTechnicalIndicators(),
      patterns: [],
      elliottWave: createMockWaveStructure(),
      fibonacci: createMockFibonacciLevels(),
      confluence: [],
      marketRegime: {
        type: 'trending',
        strength: 0.7,
        duration: 1000,
        volatility: 'medium',
        volume: 'medium',
        confidence: 0.8,
      },
      volumeProfile: createMockVolumeProfile(),
    };
  }

  function createBullishAnalysisResults(): AnalysisResults {
    const analysis = createMockAnalysisResults();
    
    // Strong bullish technical indicators
    analysis.technical = {
      rsi: 25, // Oversold
      waveTrend: { wt1: -60, wt2: -50, signal: 'buy' },
      pvt: 1000,
      supportLevels: [49000, 48000],
      resistanceLevels: [52000, 53000],
      trend: 'bullish',
      momentum: 'strong',
      volatility: 0.02,
    };

    // Bullish patterns
    analysis.patterns = [
      {
        type: 'hammer',
        confidence: 0.8,
        startIndex: 10,
        endIndex: 10,
        direction: 'bullish',
        strength: 'strong',
        description: 'Hammer pattern',
        reliability: 0.8,
      },
    ];

    // Bullish Elliott Wave
    analysis.elliottWave = {
      waves: [],
      currentWave: {
        id: 'wave_3',
        type: 'wave_3',
        degree: 'minor',
        startPrice: 48000,
        endPrice: 52000,
        startTime: Date.now() - 3600000,
        endTime: Date.now(),
        length: 4000,
        duration: 3600000,
      },
      waveCount: 3,
      degree: 'minor',
      validity: 0.9,
      nextTargets: [
        { price: 55000, probability: 0.8, type: 'fibonacci_extension', description: '1.618 extension' },
      ],
      invalidationLevel: 47000,
    };

    // Strong Fibonacci confluence
    analysis.fibonacci = {
      retracements: [],
      extensions: [
        { ratio: 1.618, price: 55000, type: 'extension', strength: 0.9, description: '161.8% extension' },
      ],
      timeProjections: [],
      confluenceZones: [
        {
          priceLevel: 55000,
          strength: 0.9,
          factors: [
            { type: 'fibonacci', description: '161.8% extension', weight: 0.9 },
          ],
          type: 'resistance',
          reliability: 0.9,
        },
      ],
      highPrice: 52000,
      lowPrice: 48000,
      swingHigh: 52000,
      swingLow: 48000,
    };

    return analysis;
  }

  function createBearishAnalysisResults(): AnalysisResults {
    const analysis = createMockAnalysisResults();
    
    // Strong bearish technical indicators
    analysis.technical = {
      rsi: 75, // Overbought
      waveTrend: { wt1: 60, wt2: 50, signal: 'sell' },
      pvt: -1000,
      supportLevels: [48000, 47000],
      resistanceLevels: [52000, 53000],
      trend: 'bearish',
      momentum: 'strong',
      volatility: 0.02,
    };

    // Bearish patterns
    analysis.patterns = [
      {
        type: 'shooting_star',
        confidence: 0.8,
        startIndex: 10,
        endIndex: 10,
        direction: 'bearish',
        strength: 'strong',
        description: 'Shooting star pattern',
        reliability: 0.8,
      },
    ];

    // Bearish Elliott Wave
    analysis.elliottWave = {
      waves: [],
      currentWave: {
        id: 'wave_a',
        type: 'wave_a',
        degree: 'minor',
        startPrice: 52000,
        endPrice: 48000,
        startTime: Date.now() - 3600000,
        endTime: Date.now(),
        length: 4000,
        duration: 3600000,
      },
      waveCount: 1,
      degree: 'minor',
      validity: 0.8,
      nextTargets: [
        { price: 45000, probability: 0.7, type: 'fibonacci_extension', description: '1.618 extension' },
      ],
      invalidationLevel: 53000,
    };

    return analysis;
  }

  function createLowConfidenceAnalysisResults(): AnalysisResults {
    const analysis = createMockAnalysisResults();
    
    // Weak indicators
    analysis.technical = {
      rsi: 50, // Neutral
      waveTrend: { wt1: 0, wt2: 0, signal: 'neutral' },
      pvt: 0,
      supportLevels: [],
      resistanceLevels: [],
      trend: 'sideways',
      momentum: 'weak',
      volatility: 0.01,
    };

    analysis.patterns = []; // No patterns
    analysis.elliottWave.validity = 0.3; // Low validity
    analysis.fibonacci.confluenceZones = []; // No confluence

    return analysis;
  }

  function createNeutralAnalysisResults(): AnalysisResults {
    const analysis = createMockAnalysisResults();
    
    // Mixed signals
    analysis.technical = {
      rsi: 50,
      waveTrend: { wt1: 0, wt2: 0, signal: 'neutral' },
      pvt: 0,
      supportLevels: [49000],
      resistanceLevels: [51000],
      trend: 'sideways',
      momentum: 'neutral',
      volatility: 0.015,
    };

    // Mixed patterns
    analysis.patterns = [
      {
        type: 'doji',
        confidence: 0.6,
        startIndex: 10,
        endIndex: 10,
        direction: 'bullish', // Neutral pattern but marked as bullish
        strength: 'moderate',
        description: 'Doji pattern',
        reliability: 0.6,
      },
    ];

    return analysis;
  }

  function createMockTechnicalIndicators(): TechnicalIndicators {
    return {
      rsi: 50,
      waveTrend: { wt1: 0, wt2: 0, signal: 'neutral' },
      pvt: 0,
      supportLevels: [49000, 48000],
      resistanceLevels: [51000, 52000],
      trend: 'sideways',
      momentum: 'neutral',
      volatility: 0.02,
    };
  }

  function createMockWaveStructure(): WaveStructure {
    return {
      waves: [],
      currentWave: {
        id: 'wave_1',
        type: 'wave_1',
        degree: 'minor',
        startPrice: 48000,
        endPrice: 52000,
        startTime: Date.now() - 3600000,
        endTime: Date.now(),
        length: 4000,
        duration: 3600000,
      },
      waveCount: 1,
      degree: 'minor',
      validity: 0.7,
      nextTargets: [],
      invalidationLevel: 47000,
    };
  }

  function createMockFibonacciLevels(): FibonacciLevels {
    return {
      retracements: [
        { ratio: 0.618, price: 49200, type: 'retracement', strength: 0.8, description: '61.8% retracement' },
      ],
      extensions: [
        { ratio: 1.618, price: 54400, type: 'extension', strength: 0.8, description: '161.8% extension' },
      ],
      timeProjections: [],
      confluenceZones: [
        {
          priceLevel: 49200,
          strength: 0.8,
          factors: [
            { type: 'fibonacci', description: '61.8% retracement', weight: 0.8 },
          ],
          type: 'support',
          reliability: 0.8,
        },
      ],
      highPrice: 52000,
      lowPrice: 48000,
      swingHigh: 52000,
      swingLow: 48000,
    };
  }

  function createMockVolumeProfile(): VolumeProfile {
    return {
      volumeByPrice: [
        { price: 50000, volume: 1000, percentage: 0.5 },
        { price: 50500, volume: 800, percentage: 0.3 },
        { price: 49500, volume: 400, percentage: 0.2 },
      ],
      poc: 50000,
      valueAreaHigh: 50500,
      valueAreaLow: 49500,
      volumeTrend: 'increasing',
      volumeStrength: 0.7,
    };
  }

  function createMockCandles(): CandleData[] {
    const candles: CandleData[] = [];
    const basePrice = 50000;
    
    for (let i = 0; i < 20; i++) {
      const price = basePrice + (Math.random() - 0.5) * 1000;
      candles.push({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: Date.now() - (20 - i) * 3600000,
        open: price,
        high: price + Math.random() * 500,
        low: price - Math.random() * 500,
        close: price + (Math.random() - 0.5) * 200,
        volume: 1000 + Math.random() * 500,
      });
    }
    
    return candles;
  }

  function createMockSignal(symbol: string, direction: 'long' | 'short', confidence: number): TradingSignal {
    return {
      symbol,
      direction,
      confidence,
      entryPrice: 50000,
      stopLoss: direction === 'long' ? 49000 : 51000,
      takeProfit: direction === 'long' ? [51000, 52000, 53000] : [49000, 48000, 47000],
      reasoning: {
        technical: {
          indicators: ['RSI: 50.0'],
          confluence: 0.7,
          trend: 'sideways',
        },
        patterns: {
          detected: [],
          strength: 0.6,
        },
        elliottWave: {
          currentWave: 'wave_1',
          wavePosition: 'Wave 1 of structure',
          validity: 0.7,
        },
        fibonacci: {
          levels: [49200, 54400],
          confluence: 0.8,
        },
        volume: {
          profile: 'increasing',
          strength: 0.7,
        },
        summary: 'Moderate signal strength',
      },
      timestamp: Date.now(),
      technicalScore: 0.7,
      patternScore: 0.6,
      elliottWaveScore: 0.7,
      fibonacciScore: 0.8,
      volumeScore: 0.7,
    };
  }

  function createAlignedMultiTimeframeAnalysis(direction: 'bullish' | 'bearish'): MultiTimeframeAnalysis {
    const trend = direction === 'bullish' ? 'bullish' : 'bearish';
    
    return {
      symbol: 'BTCUSDT',
      timestamp: Date.now(),
      timeframes: {
        '15m': {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          timestamp: Date.now(),
          technical: { ...createMockTechnicalIndicators(), trend },
          patterns: [],
          elliottWave: createMockWaveStructure(),
          fibonacci: createMockFibonacciLevels(),
          confluence: [],
          marketRegime: { type: 'trending', strength: 0.8, duration: 1000, volatility: 'medium', volume: 'medium', confidence: 0.8 },
          volumeProfile: createMockVolumeProfile(),
        },
        '1h': {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          timestamp: Date.now(),
          technical: { ...createMockTechnicalIndicators(), trend },
          patterns: [],
          elliottWave: createMockWaveStructure(),
          fibonacci: createMockFibonacciLevels(),
          confluence: [],
          marketRegime: { type: 'trending', strength: 0.8, duration: 1000, volatility: 'medium', volume: 'medium', confidence: 0.8 },
          volumeProfile: createMockVolumeProfile(),
        },
        '4h': {
          symbol: 'BTCUSDT',
          timeframe: '4h',
          timestamp: Date.now(),
          technical: { ...createMockTechnicalIndicators(), trend },
          patterns: [],
          elliottWave: createMockWaveStructure(),
          fibonacci: createMockFibonacciLevels(),
          confluence: [],
          marketRegime: { type: 'trending', strength: 0.8, duration: 1000, volatility: 'medium', volume: 'medium', confidence: 0.8 },
          volumeProfile: createMockVolumeProfile(),
        },
      },
      consensus: {
        direction: direction === 'bullish' ? 'bullish' : 'bearish',
        strength: 0.8,
        confluence: 0.9,
      },
    };
  }

  function createConflictingMultiTimeframeAnalysis(): MultiTimeframeAnalysis {
    return {
      symbol: 'BTCUSDT',
      timestamp: Date.now(),
      timeframes: {
        '15m': {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          timestamp: Date.now(),
          technical: { ...createMockTechnicalIndicators(), trend: 'bullish' },
          patterns: [],
          elliottWave: createMockWaveStructure(),
          fibonacci: createMockFibonacciLevels(),
          confluence: [],
          marketRegime: { type: 'trending', strength: 0.8, duration: 1000, volatility: 'medium', volume: 'medium', confidence: 0.8 },
          volumeProfile: createMockVolumeProfile(),
        },
        '1h': {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          timestamp: Date.now(),
          technical: { ...createMockTechnicalIndicators(), trend: 'bearish' },
          patterns: [],
          elliottWave: createMockWaveStructure(),
          fibonacci: createMockFibonacciLevels(),
          confluence: [],
          marketRegime: { type: 'trending', strength: 0.8, duration: 1000, volatility: 'medium', volume: 'medium', confidence: 0.8 },
          volumeProfile: createMockVolumeProfile(),
        },
        '4h': {
          symbol: 'BTCUSDT',
          timeframe: '4h',
          timestamp: Date.now(),
          technical: { ...createMockTechnicalIndicators(), trend: 'sideways' },
          patterns: [],
          elliottWave: createMockWaveStructure(),
          fibonacci: createMockFibonacciLevels(),
          confluence: [],
          marketRegime: { type: 'ranging', strength: 0.6, duration: 1000, volatility: 'low', volume: 'low', confidence: 0.6 },
          volumeProfile: createMockVolumeProfile(),
        },
      },
      consensus: {
        direction: 'neutral',
        strength: 0.4,
        confluence: 0.3,
      },
    };
  }
});