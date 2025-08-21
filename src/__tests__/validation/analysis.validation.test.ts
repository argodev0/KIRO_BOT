/**
 * Analysis Validation Tests
 * Unit tests for technical analysis validation schemas
 */

import {
  validateTechnicalIndicators,
  validateCandlestickPattern,
  validateWaveStructure,
  validateFibonacciLevels,
  validateConfluenceZone,
  validateMarketRegime,
  validateVolumeProfile,
  validateAnalysisResults,
  validateSignalFilter,
  validateAnalysisConfig,
} from '../../validation/analysis.validation';

describe('Analysis Validation', () => {
  describe('validateTechnicalIndicators', () => {
    const validIndicators = {
      rsi: 65.5,
      waveTrend: {
        wt1: -15.2,
        wt2: -18.7,
        signal: 'buy',
        divergence: 'bullish',
      },
      pvt: 1234567,
      supportLevels: [46000, 45500],
      resistanceLevels: [48000, 48500],
      trend: 'bullish',
      momentum: 'strong',
      volatility: 0.25,
    };

    it('should validate correct technical indicators', () => {
      const { error } = validateTechnicalIndicators(validIndicators);
      expect(error).toBeUndefined();
    });

    it('should reject RSI out of range', () => {
      const invalidIndicators = {
        ...validIndicators,
        rsi: 150, // RSI > 100
      };
      const { error } = validateTechnicalIndicators(invalidIndicators);
      expect(error).toBeDefined();
    });

    it('should reject invalid wave trend signal', () => {
      const invalidIndicators = {
        ...validIndicators,
        waveTrend: {
          ...validIndicators.waveTrend,
          signal: 'invalid',
        },
      };
      const { error } = validateTechnicalIndicators(invalidIndicators);
      expect(error).toBeDefined();
    });
  });

  describe('validateCandlestickPattern', () => {
    const validPattern = {
      type: 'hammer',
      confidence: 0.8,
      startIndex: 10,
      endIndex: 12,
      direction: 'bullish',
      strength: 'strong',
      description: 'Bullish hammer pattern at support level',
      reliability: 0.75,
    };

    it('should validate correct candlestick pattern', () => {
      const { error } = validateCandlestickPattern(validPattern);
      expect(error).toBeUndefined();
    });

    it('should reject invalid pattern type', () => {
      const invalidPattern = {
        ...validPattern,
        type: 'invalid_pattern',
      };
      const { error } = validateCandlestickPattern(invalidPattern);
      expect(error).toBeDefined();
    });

    it('should reject end index <= start index', () => {
      const invalidPattern = {
        ...validPattern,
        endIndex: 10, // Same as start index
      };
      const { error } = validateCandlestickPattern(invalidPattern);
      expect(error).toBeDefined();
      expect(error?.message).toContain('End index must be greater than start index');
    });

    it('should reject confidence out of range', () => {
      const invalidPattern = {
        ...validPattern,
        confidence: 1.5, // > 1
      };
      const { error } = validateCandlestickPattern(invalidPattern);
      expect(error).toBeDefined();
    });
  });

  describe('validateWaveStructure', () => {
    const validWave = {
      id: 'wave1',
      type: 'wave_1',
      degree: 'minor',
      startPrice: 46000,
      endPrice: 48000,
      startTime: 1640995200000,
      endTime: 1641081600000,
      length: 2000,
      duration: 86400000,
      fibonacciRatio: 1.618,
    };

    const validWaveStructure = {
      waves: [validWave],
      currentWave: validWave,
      waveCount: 1,
      degree: 'minor',
      validity: 0.85,
      nextTargets: [
        {
          price: 49000,
          probability: 0.7,
          type: 'fibonacci_extension',
          description: 'Wave 3 target at 1.618 extension',
        },
      ],
      invalidationLevel: 45000,
    };

    it('should validate correct wave structure', () => {
      const { error } = validateWaveStructure(validWaveStructure);
      expect(error).toBeUndefined();
    });

    it('should reject invalid wave type', () => {
      const invalidWaveStructure = {
        ...validWaveStructure,
        currentWave: {
          ...validWave,
          type: 'invalid_wave',
        },
      };
      const { error } = validateWaveStructure(invalidWaveStructure);
      expect(error).toBeDefined();
    });

    it('should reject invalid wave degree', () => {
      const invalidWaveStructure = {
        ...validWaveStructure,
        degree: 'invalid_degree',
      };
      const { error } = validateWaveStructure(invalidWaveStructure);
      expect(error).toBeDefined();
    });
  });

  describe('validateFibonacciLevels', () => {
    const validFibonacci = {
      retracements: [
        {
          ratio: 0.618,
          price: 46800,
          type: 'retracement',
          strength: 0.8,
          description: '61.8% retracement level',
        },
      ],
      extensions: [
        {
          ratio: 1.618,
          price: 49000,
          type: 'extension',
          strength: 0.9,
          description: '161.8% extension level',
        },
      ],
      timeProjections: [
        {
          ratio: 1.0,
          timestamp: 1641081600000,
          description: 'Time projection at 1:1 ratio',
        },
      ],
      confluenceZones: [],
      highPrice: 48000,
      lowPrice: 46000,
      swingHigh: 48000,
      swingLow: 46000,
    };

    it('should validate correct fibonacci levels', () => {
      const { error } = validateFibonacciLevels(validFibonacci);
      expect(error).toBeUndefined();
    });

    it('should reject low >= high price', () => {
      const invalidFibonacci = {
        ...validFibonacci,
        lowPrice: 49000, // Low > high
      };
      const { error } = validateFibonacciLevels(invalidFibonacci);
      expect(error).toBeDefined();
      expect(error?.message).toContain('Low price must be less than high price');
    });
  });

  describe('validateConfluenceZone', () => {
    const validConfluenceZone = {
      priceLevel: 47000,
      strength: 0.85,
      factors: [
        {
          type: 'fibonacci',
          description: '61.8% retracement level',
          weight: 0.3,
        },
        {
          type: 'support_resistance',
          description: 'Previous support level',
          weight: 0.4,
        },
      ],
      type: 'support',
      reliability: 0.8,
    };

    it('should validate correct confluence zone', () => {
      const { error } = validateConfluenceZone(validConfluenceZone);
      expect(error).toBeUndefined();
    });

    it('should require at least one factor', () => {
      const invalidConfluenceZone = {
        ...validConfluenceZone,
        factors: [],
      };
      const { error } = validateConfluenceZone(invalidConfluenceZone);
      expect(error).toBeDefined();
    });
  });

  describe('validateMarketRegime', () => {
    const validMarketRegime = {
      type: 'trending',
      strength: 0.8,
      duration: 86400000,
      volatility: 'medium',
      volume: 'high',
      confidence: 0.85,
    };

    it('should validate correct market regime', () => {
      const { error } = validateMarketRegime(validMarketRegime);
      expect(error).toBeUndefined();
    });

    it('should reject invalid regime type', () => {
      const invalidMarketRegime = {
        ...validMarketRegime,
        type: 'invalid',
      };
      const { error } = validateMarketRegime(invalidMarketRegime);
      expect(error).toBeDefined();
    });
  });

  describe('validateVolumeProfile', () => {
    const validVolumeProfile = {
      volumeByPrice: [
        {
          price: 47000,
          volume: 1000,
          percentage: 25.5,
        },
        {
          price: 47100,
          volume: 800,
          percentage: 20.2,
        },
      ],
      poc: 47000,
      valueAreaHigh: 47200,
      valueAreaLow: 46800,
      volumeTrend: 'increasing',
      volumeStrength: 0.8,
    };

    it('should validate correct volume profile', () => {
      const { error } = validateVolumeProfile(validVolumeProfile);
      expect(error).toBeUndefined();
    });

    it('should reject value area low >= high', () => {
      const invalidVolumeProfile = {
        ...validVolumeProfile,
        valueAreaLow: 47300, // Low > high
      };
      const { error } = validateVolumeProfile(invalidVolumeProfile);
      expect(error).toBeDefined();
      expect(error?.message).toContain('Value area low must be less than value area high');
    });
  });

  describe('validateAnalysisResults', () => {
    const validAnalysisResults = {
      symbol: 'BTCUSDT',
      timeframe: '1h',
      timestamp: 1640995200000,
      technical: {
        rsi: 65.5,
        waveTrend: {
          wt1: -15.2,
          wt2: -18.7,
          signal: 'buy',
        },
        pvt: 1234567,
        supportLevels: [46000],
        resistanceLevels: [48000],
        trend: 'bullish',
        momentum: 'strong',
        volatility: 0.25,
      },
      patterns: [],
      elliottWave: {
        waves: [],
        currentWave: {
          id: 'wave1',
          type: 'wave_1',
          degree: 'minor',
          startPrice: 46000,
          endPrice: 48000,
          startTime: 1640995200000,
          endTime: 1641081600000,
          length: 2000,
          duration: 86400000,
        },
        waveCount: 1,
        degree: 'minor',
        validity: 0.85,
        nextTargets: [],
        invalidationLevel: 45000,
      },
      fibonacci: {
        retracements: [],
        extensions: [],
        timeProjections: [],
        confluenceZones: [],
        highPrice: 48000,
        lowPrice: 46000,
        swingHigh: 48000,
        swingLow: 46000,
      },
      confluence: [],
      marketRegime: {
        type: 'trending',
        strength: 0.8,
        duration: 86400000,
        volatility: 'medium',
        volume: 'high',
        confidence: 0.85,
      },
      volumeProfile: {
        volumeByPrice: [
          {
            price: 47000,
            volume: 1000,
            percentage: 100,
          },
        ],
        poc: 47000,
        valueAreaHigh: 47200,
        valueAreaLow: 46800,
        volumeTrend: 'increasing',
        volumeStrength: 0.8,
      },
    };

    it('should validate correct analysis results', () => {
      const { error } = validateAnalysisResults(validAnalysisResults);
      expect(error).toBeUndefined();
    });
  });

  describe('validateSignalFilter', () => {
    const validSignalFilter = {
      minConfidence: 0.7,
      requiredPatterns: ['hammer', 'engulfing_bullish'],
      requiredIndicators: ['RSI', 'MACD'],
      minConfluence: 0.6,
      timeframes: ['1h', '4h'],
    };

    it('should validate correct signal filter', () => {
      const { error } = validateSignalFilter(validSignalFilter);
      expect(error).toBeUndefined();
    });

    it('should allow optional fields to be missing', () => {
      const minimalFilter = {
        minConfidence: 0.7,
        minConfluence: 0.6,
      };
      const { error } = validateSignalFilter(minimalFilter);
      expect(error).toBeUndefined();
    });
  });

  describe('validateAnalysisConfig', () => {
    const validAnalysisConfig = {
      indicators: {
        rsi: {
          period: 14,
          overbought: 70,
          oversold: 30,
        },
        waveTrend: {
          n1: 10,
          n2: 21,
        },
        pvt: {
          period: 14,
        },
      },
      patterns: {
        minBodySize: 0.1,
        minWickRatio: 2.0,
        lookbackPeriod: 20,
      },
      elliottWave: {
        minWaveLength: 0.01,
        maxWaveLength: 0.5,
        fibonacciTolerance: 0.05,
      },
      fibonacci: {
        levels: [0.236, 0.382, 0.5, 0.618, 0.786],
        confluenceDistance: 0.001,
      },
    };

    it('should validate correct analysis config', () => {
      const { error } = validateAnalysisConfig(validAnalysisConfig);
      expect(error).toBeUndefined();
    });

    it('should reject invalid RSI parameters', () => {
      const invalidConfig = {
        ...validAnalysisConfig,
        indicators: {
          ...validAnalysisConfig.indicators,
          rsi: {
            period: 14,
            overbought: 40, // Overbought < 50
            oversold: 30,
          },
        },
      };
      const { error } = validateAnalysisConfig(invalidConfig);
      expect(error).toBeDefined();
    });
  });
});