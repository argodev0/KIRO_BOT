/**
 * Advanced Fibonacci and Pivot Channel System Tests
 * Comprehensive test suite for the advanced Fibonacci and pivot channel analysis system
 */

import { AdvancedFibonacciPivotSystem, AdvancedFibonacciPivotConfig } from '../../services/AdvancedFibonacciPivotSystem';
import { CandleData } from '../../types/market';
import { VolumeProfile } from '../../types/analysis';

describe('AdvancedFibonacciPivotSystem', () => {
  let system: AdvancedFibonacciPivotSystem;
  let mockConfig: AdvancedFibonacciPivotConfig;
  let mockCandles: CandleData[];

  beforeEach(() => {
    mockConfig = {
      fibonacci: {
        retracementLevels: [0.236, 0.382, 0.5, 0.618, 0.786],
        extensionLevels: [1.272, 1.618, 2.618],
        confluenceThreshold: 0.01,
        dynamicAdjustment: true
      },
      pivotChannels: {
        lookbackPeriod: 50,
        minTouches: 3,
        channelWidth: 0.02,
        trendAnalysisDepth: 20
      },
      confluenceZones: {
        minFactors: 2,
        priceTolerancePercent: 1.0,
        volumeWeighting: true,
        timeframeWeighting: true
      },
      multiTimeframe: {
        timeframes: ['1h', '4h', '1d'],
        consensusThreshold: 0.7,
        weightingScheme: 'higher_priority'
      },
      breakoutDetection: {
        volumeThreshold: 1.5,
        priceThreshold: 0.02,
        confirmationCandles: 3
      }
    };

    system = new AdvancedFibonacciPivotSystem(mockConfig);

    // Create mock candle data
    mockCandles = [];
    const basePrice = 50000;
    const baseTime = Date.now() - (100 * 60 * 60 * 1000); // 100 hours ago

    for (let i = 0; i < 100; i++) {
      const price = basePrice + (Math.sin(i * 0.1) * 2000) + (Math.random() * 1000 - 500);
      const volume = 1000000 + (Math.random() * 500000);
      
      mockCandles.push({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: baseTime + (i * 60 * 60 * 1000),
        open: price + (Math.random() * 200 - 100),
        high: price + Math.random() * 300,
        low: price - Math.random() * 300,
        close: price,
        volume
      });
    }
  });

  describe('Comprehensive Fibonacci Analysis', () => {
    it('should calculate comprehensive Fibonacci levels with enhancements', async () => {
      const swingHigh = 52000;
      const swingLow = 48000;
      const startTime = mockCandles[0].timestamp;
      const endTime = mockCandles[mockCandles.length - 1].timestamp;

      const result = await system.calculateComprehensiveFibonacci(
        mockCandles,
        swingHigh,
        swingLow,
        startTime,
        endTime
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Check enhanced properties
      result.forEach(level => {
        expect(level).toHaveProperty('ratio');
        expect(level).toHaveProperty('price');
        expect(level).toHaveProperty('type');
        expect(level).toHaveProperty('strength');
        expect(level).toHaveProperty('volumeConfirmation');
        expect(level).toHaveProperty('timeframeConsensus');
        expect(level).toHaveProperty('dynamicAdjustment');
        expect(level).toHaveProperty('priceActionConfirmation');
        
        expect(typeof level.volumeConfirmation).toBe('number');
        expect(typeof level.timeframeConsensus).toBe('number');
        expect(typeof level.dynamicAdjustment).toBe('number');
        expect(typeof level.priceActionConfirmation).toBe('number');
      });
    });

    it('should include both retracement and extension levels', async () => {
      const swingHigh = 52000;
      const swingLow = 48000;
      const startTime = mockCandles[0].timestamp;
      const endTime = mockCandles[mockCandles.length - 1].timestamp;

      const result = await system.calculateComprehensiveFibonacci(
        mockCandles,
        swingHigh,
        swingLow,
        startTime,
        endTime
      );

      const retracements = result.filter(level => level.type === 'retracement');
      const extensions = result.filter(level => level.type === 'extension');

      expect(retracements.length).toBeGreaterThan(0);
      expect(extensions.length).toBeGreaterThan(0);
    });

    it('should apply dynamic adjustments when enabled', async () => {
      const swingHigh = 52000;
      const swingLow = 48000;
      const startTime = mockCandles[0].timestamp;
      const endTime = mockCandles[mockCandles.length - 1].timestamp;

      const result = await system.calculateComprehensiveFibonacci(
        mockCandles,
        swingHigh,
        swingLow,
        startTime,
        endTime
      );

      // Check that some levels have dynamic adjustments
      const adjustedLevels = result.filter(level => level.dynamicAdjustment > 0);
      expect(adjustedLevels.length).toBeGreaterThan(0);
    });
  });

  describe('Dynamic Pivot Channel Detection', () => {
    it('should detect pivot channels with dynamic levels', async () => {
      const result = await system.detectDynamicPivotChannels(mockCandles);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      if (result.length > 0) {
        result.forEach(channel => {
          expect(channel).toHaveProperty('upperChannel');
          expect(channel).toHaveProperty('lowerChannel');
          expect(channel).toHaveProperty('centerLine');
          expect(channel).toHaveProperty('strength');
          expect(channel).toHaveProperty('dynamicLevels');
          expect(channel).toHaveProperty('volumeProfile');
          expect(channel).toHaveProperty('breakoutProbability');
          expect(channel).toHaveProperty('supportResistanceLevels');

          expect(typeof channel.upperChannel).toBe('number');
          expect(typeof channel.lowerChannel).toBe('number');
          expect(typeof channel.strength).toBe('number');
          expect(Array.isArray(channel.dynamicLevels)).toBe(true);
          expect(Array.isArray(channel.volumeProfile)).toBe(true);
          expect(typeof channel.breakoutProbability).toBe('number');
        });
      }
    });

    it('should calculate dynamic channel levels based on Fibonacci ratios', async () => {
      const result = await system.detectDynamicPivotChannels(mockCandles);

      if (result.length > 0) {
        const channel = result[0];
        expect(channel.dynamicLevels.length).toBe(5); // 5 Fibonacci ratios
        
        // Check that levels are between channel boundaries
        channel.dynamicLevels.forEach(level => {
          expect(level).toBeGreaterThanOrEqual(channel.lowerChannel);
          expect(level).toBeLessThanOrEqual(channel.upperChannel);
        });
      }
    });

    it('should calculate volume profile for channels', async () => {
      const result = await system.detectDynamicPivotChannels(mockCandles);

      if (result.length > 0) {
        const channel = result[0];
        expect(channel.volumeProfile.length).toBe(20); // 20 price levels
        
        channel.volumeProfile.forEach(node => {
          expect(node).toHaveProperty('price');
          expect(node).toHaveProperty('volume');
          expect(node).toHaveProperty('percentage');
          expect(typeof node.price).toBe('number');
          expect(typeof node.volume).toBe('number');
          expect(typeof node.percentage).toBe('number');
        });
      }
    });
  });

  describe('Confluence Zone Analysis', () => {
    it('should build comprehensive confluence zone analysis', async () => {
      const swingHigh = 52000;
      const swingLow = 48000;
      const startTime = mockCandles[0].timestamp;
      const endTime = mockCandles[mockCandles.length - 1].timestamp;

      const fibonacciLevels = await system.calculateComprehensiveFibonacci(
        mockCandles,
        swingHigh,
        swingLow,
        startTime,
        endTime
      );

      const pivotChannels = await system.detectDynamicPivotChannels(mockCandles);

      const result = await system.buildConfluenceZoneAnalysis(
        mockCandles,
        fibonacciLevels,
        pivotChannels
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('zones');
      expect(result).toHaveProperty('totalZones');
      expect(result).toHaveProperty('strongZones');
      expect(result).toHaveProperty('criticalLevels');
      expect(result).toHaveProperty('marketBias');
      expect(result).toHaveProperty('confidenceScore');

      expect(Array.isArray(result.zones)).toBe(true);
      expect(Array.isArray(result.strongZones)).toBe(true);
      expect(Array.isArray(result.criticalLevels)).toBe(true);
      expect(['bullish', 'bearish', 'neutral']).toContain(result.marketBias);
      expect(typeof result.confidenceScore).toBe('number');
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(1);
    });

    it('should create enhanced confluence zones with additional properties', async () => {
      const swingHigh = 52000;
      const swingLow = 48000;
      const startTime = mockCandles[0].timestamp;
      const endTime = mockCandles[mockCandles.length - 1].timestamp;

      const fibonacciLevels = await system.calculateComprehensiveFibonacci(
        mockCandles,
        swingHigh,
        swingLow,
        startTime,
        endTime
      );

      const pivotChannels = await system.detectDynamicPivotChannels(mockCandles);

      const result = await system.buildConfluenceZoneAnalysis(
        mockCandles,
        fibonacciLevels,
        pivotChannels
      );

      if (result.zones.length > 0) {
        const zone = result.zones[0];
        expect(zone).toHaveProperty('priceLevel');
        expect(zone).toHaveProperty('strength');
        expect(zone).toHaveProperty('factors');
        expect(zone).toHaveProperty('type');
        expect(zone).toHaveProperty('reliability');
        expect(zone).toHaveProperty('volumeProfile');
        expect(zone).toHaveProperty('timeframeConsensus');
        expect(zone).toHaveProperty('dynamicSupport');
        expect(zone).toHaveProperty('breakoutProbability');
        expect(zone).toHaveProperty('historicalSignificance');

        expect(Array.isArray(zone.factors)).toBe(true);
        expect(Array.isArray(zone.volumeProfile)).toBe(true);
        expect(Array.isArray(zone.timeframeConsensus)).toBe(true);
        expect(typeof zone.dynamicSupport).toBe('boolean');
        expect(typeof zone.breakoutProbability).toBe('number');
        expect(typeof zone.historicalSignificance).toBe('number');
      }
    });

    it('should filter zones by minimum factors requirement', async () => {
      const swingHigh = 52000;
      const swingLow = 48000;
      const startTime = mockCandles[0].timestamp;
      const endTime = mockCandles[mockCandles.length - 1].timestamp;

      const fibonacciLevels = await system.calculateComprehensiveFibonacci(
        mockCandles,
        swingHigh,
        swingLow,
        startTime,
        endTime
      );

      const pivotChannels = await system.detectDynamicPivotChannels(mockCandles);

      const result = await system.buildConfluenceZoneAnalysis(
        mockCandles,
        fibonacciLevels,
        pivotChannels
      );

      // All zones should have at least minFactors
      result.zones.forEach(zone => {
        expect(zone.factors.length).toBeGreaterThanOrEqual(mockConfig.confluenceZones.minFactors);
      });
    });
  });

  describe('Dynamic Level Adjustment', () => {
    it('should adjust levels dynamically based on price action and volume', async () => {
      const swingHigh = 52000;
      const swingLow = 48000;
      const startTime = mockCandles[0].timestamp;
      const endTime = mockCandles[mockCandles.length - 1].timestamp;

      const fibonacciLevels = await system.calculateComprehensiveFibonacci(
        mockCandles,
        swingHigh,
        swingLow,
        startTime,
        endTime
      );

      const result = await system.adjustLevelsDynamically(fibonacciLevels, mockCandles);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      result.forEach(adjustment => {
        expect(adjustment).toHaveProperty('originalLevel');
        expect(adjustment).toHaveProperty('adjustedLevel');
        expect(adjustment).toHaveProperty('adjustmentFactor');
        expect(adjustment).toHaveProperty('reason');
        expect(adjustment).toHaveProperty('confidence');

        expect(typeof adjustment.originalLevel).toBe('number');
        expect(typeof adjustment.adjustedLevel).toBe('number');
        expect(typeof adjustment.adjustmentFactor).toBe('number');
        expect(typeof adjustment.reason).toBe('string');
        expect(typeof adjustment.confidence).toBe('number');
        expect(adjustment.confidence).toBeGreaterThanOrEqual(0);
        expect(adjustment.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should provide meaningful adjustment reasons', async () => {
      const swingHigh = 52000;
      const swingLow = 48000;
      const startTime = mockCandles[0].timestamp;
      const endTime = mockCandles[mockCandles.length - 1].timestamp;

      const fibonacciLevels = await system.calculateComprehensiveFibonacci(
        mockCandles,
        swingHigh,
        swingLow,
        startTime,
        endTime
      );

      const result = await system.adjustLevelsDynamically(fibonacciLevels, mockCandles);

      result.forEach(adjustment => {
        expect(adjustment.reason.length).toBeGreaterThan(0);
        expect(adjustment.reason).not.toBe('');
      });
    });
  });

  describe('Multi-Timeframe Analysis', () => {
    it('should perform multi-timeframe analysis', async () => {
      const candlesByTimeframe = new Map<string, CandleData[]>();
      candlesByTimeframe.set('1h', mockCandles);
      // Ensure we have enough candles for each timeframe (minimum 50)
      candlesByTimeframe.set('4h', mockCandles); // Use full dataset
      candlesByTimeframe.set('1d', mockCandles); // Use full dataset

      const swingPoints = {
        high: 52000,
        low: 48000,
        highTime: mockCandles[0].timestamp,
        lowTime: mockCandles[mockCandles.length - 1].timestamp
      };

      const result = await system.performMultiTimeframeAnalysis(candlesByTimeframe, swingPoints);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3); // 3 timeframes

      result.forEach(analysis => {
        expect(analysis).toHaveProperty('timeframe');
        expect(analysis).toHaveProperty('fibonacciLevels');
        expect(analysis).toHaveProperty('pivotChannels');
        expect(analysis).toHaveProperty('confluenceZones');
        expect(analysis).toHaveProperty('marketStructure');

        expect(typeof analysis.timeframe).toBe('string');
        expect(Array.isArray(analysis.fibonacciLevels)).toBe(true);
        expect(Array.isArray(analysis.pivotChannels)).toBe(true);
        expect(Array.isArray(analysis.confluenceZones)).toBe(true);
        expect(analysis.marketStructure).toHaveProperty('trend');
        expect(analysis.marketStructure).toHaveProperty('strength');
        expect(analysis.marketStructure).toHaveProperty('phase');
        expect(analysis.marketStructure).toHaveProperty('volatility');
        expect(analysis.marketStructure).toHaveProperty('volume');
      });
    });

    it('should analyze market structure for each timeframe', async () => {
      const candlesByTimeframe = new Map<string, CandleData[]>();
      candlesByTimeframe.set('1h', mockCandles);

      const swingPoints = {
        high: 52000,
        low: 48000,
        highTime: mockCandles[0].timestamp,
        lowTime: mockCandles[mockCandles.length - 1].timestamp
      };

      const result = await system.performMultiTimeframeAnalysis(candlesByTimeframe, swingPoints);

      const analysis = result[0];
      const marketStructure = analysis.marketStructure;

      expect(['bullish', 'bearish', 'sideways']).toContain(marketStructure.trend);
      expect(['accumulation', 'markup', 'distribution', 'markdown']).toContain(marketStructure.phase);
      expect(['high', 'medium', 'low']).toContain(marketStructure.volume);
      expect(typeof marketStructure.strength).toBe('number');
      expect(typeof marketStructure.volatility).toBe('number');
      expect(marketStructure.strength).toBeGreaterThanOrEqual(0);
      expect(marketStructure.strength).toBeLessThanOrEqual(1);
    });
  });

  describe('Pivot Channel Breakout Detection', () => {
    it('should detect pivot channel breakouts with probability scoring', async () => {
      const pivotChannels = await system.detectDynamicPivotChannels(mockCandles);

      if (pivotChannels.length > 0) {
        // Create a breakout scenario by modifying the last candle
        const breakoutCandles = [...mockCandles];
        const lastCandle = { ...breakoutCandles[breakoutCandles.length - 1] };
        lastCandle.close = pivotChannels[0].upperChannel * 1.05; // 5% above upper channel
        lastCandle.high = lastCandle.close;
        lastCandle.volume = lastCandle.volume * 2; // Double volume for confirmation
        breakoutCandles[breakoutCandles.length - 1] = lastCandle;

        const result = await system.detectPivotChannelBreakouts(breakoutCandles, pivotChannels);

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);

        if (result.length > 0) {
          result.forEach(breakout => {
            expect(breakout).toHaveProperty('type');
            expect(breakout).toHaveProperty('price');
            expect(breakout).toHaveProperty('timestamp');
            expect(breakout).toHaveProperty('strength');
            expect(breakout).toHaveProperty('target');
            expect(breakout).toHaveProperty('probabilityScore');
            expect(breakout).toHaveProperty('volumeConfirmation');

            expect(['upper', 'lower']).toContain(breakout.type);
            expect(typeof breakout.price).toBe('number');
            expect(typeof breakout.timestamp).toBe('number');
            expect(typeof breakout.strength).toBe('number');
            expect(typeof breakout.target).toBe('number');
            expect(typeof breakout.probabilityScore).toBe('number');
            expect(typeof breakout.volumeConfirmation).toBe('number');

            expect(breakout.probabilityScore).toBeGreaterThanOrEqual(0);
            expect(breakout.probabilityScore).toBeLessThanOrEqual(1);
          });
        }
      }
    });

    it('should calculate breakout targets correctly', async () => {
      const pivotChannels = await system.detectDynamicPivotChannels(mockCandles);

      if (pivotChannels.length > 0) {
        const channel = pivotChannels[0];
        const channelWidth = channel.upperChannel - channel.lowerChannel;

        // Create upper breakout
        const breakoutCandles = [...mockCandles];
        const lastCandle = { ...breakoutCandles[breakoutCandles.length - 1] };
        lastCandle.close = channel.upperChannel * 1.05;
        lastCandle.high = lastCandle.close;
        breakoutCandles[breakoutCandles.length - 1] = lastCandle;

        const result = await system.detectPivotChannelBreakouts(breakoutCandles, pivotChannels);

        if (result.length > 0) {
          const upperBreakout = result.find(b => b.type === 'upper');
          if (upperBreakout) {
            const expectedTarget = channel.upperChannel + channelWidth;
            expect(upperBreakout.target).toBeCloseTo(expectedTarget, 2);
          }
        }
      }
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        fibonacci: {
          retracementLevels: [0.382, 0.618],
          extensionLevels: [1.618],
          confluenceThreshold: 0.02,
          dynamicAdjustment: false
        }
      };

      system.updateConfig(newConfig);
      const updatedConfig = system.getConfig();

      expect(updatedConfig.fibonacci.retracementLevels).toEqual([0.382, 0.618]);
      expect(updatedConfig.fibonacci.extensionLevels).toEqual([1.618]);
      expect(updatedConfig.fibonacci.confluenceThreshold).toBe(0.02);
      expect(updatedConfig.fibonacci.dynamicAdjustment).toBe(false);

      // Other config should remain unchanged
      expect(updatedConfig.pivotChannels).toEqual(mockConfig.pivotChannels);
      expect(updatedConfig.confluenceZones).toEqual(mockConfig.confluenceZones);
    });

    it('should return current configuration', () => {
      const config = system.getConfig();

      expect(config).toEqual(mockConfig);
      expect(config).not.toBe(mockConfig); // Should be a copy
    });
  });

  describe('Error Handling', () => {
    it('should handle insufficient data gracefully', async () => {
      const insufficientCandles = mockCandles.slice(0, 5); // Only 5 candles

      try {
        await system.detectDynamicPivotChannels(insufficientCandles);
        // If no error is thrown, the method should return empty array or handle gracefully
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('Insufficient data');
      }
    });

    it('should handle empty candle arrays', async () => {
      const emptyCandles: CandleData[] = [];

      const fibonacciResult = await system.calculateComprehensiveFibonacci(
        emptyCandles,
        52000,
        48000,
        Date.now() - 1000000,
        Date.now()
      );

      expect(fibonacciResult).toBeDefined();
      expect(Array.isArray(fibonacciResult)).toBe(true);
    });

    it('should handle invalid swing points', async () => {
      const result = await system.calculateComprehensiveFibonacci(
        mockCandles,
        48000, // Low as high
        52000, // High as low (inverted)
        mockCandles[0].timestamp,
        mockCandles[mockCandles.length - 1].timestamp
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Performance and Optimization', () => {
    it('should complete analysis within reasonable time', async () => {
      const startTime = Date.now();

      const swingHigh = 52000;
      const swingLow = 48000;
      const startTimestamp = mockCandles[0].timestamp;
      const endTimestamp = mockCandles[mockCandles.length - 1].timestamp;

      const fibonacciLevels = await system.calculateComprehensiveFibonacci(
        mockCandles,
        swingHigh,
        swingLow,
        startTimestamp,
        endTimestamp
      );

      const pivotChannels = await system.detectDynamicPivotChannels(mockCandles);

      await system.buildConfluenceZoneAnalysis(
        mockCandles,
        fibonacciLevels,
        pivotChannels
      );

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should complete within 5 seconds for 100 candles
      expect(executionTime).toBeLessThan(5000);
    });

    it('should handle large datasets efficiently', async () => {
      // Create larger dataset
      const largeCandles: CandleData[] = [];
      const basePrice = 50000;
      const baseTime = Date.now() - (1000 * 60 * 60 * 1000);

      for (let i = 0; i < 1000; i++) {
        const price = basePrice + (Math.sin(i * 0.01) * 5000) + (Math.random() * 2000 - 1000);
        const volume = 1000000 + (Math.random() * 1000000);
        
        largeCandles.push({
          symbol: 'BTCUSDT',
          timeframe: '1h',
          timestamp: baseTime + (i * 60 * 60 * 1000),
          open: price + (Math.random() * 400 - 200),
          high: price + Math.random() * 600,
          low: price - Math.random() * 600,
          close: price,
          volume
        });
      }

      const startTime = Date.now();

      const result = await system.calculateComprehensiveFibonacci(
        largeCandles,
        55000,
        45000,
        largeCandles[0].timestamp,
        largeCandles[largeCandles.length - 1].timestamp
      );

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // Should complete within 10 seconds for 1000 candles
      expect(executionTime).toBeLessThan(10000);
    });
  });
});