/**
 * Enhanced Support Resistance Detector Tests
 */

import { EnhancedSupportResistanceDetector } from '../../../services/indicators/EnhancedSupportResistanceDetector';
import { CandleData } from '../../../types/market';

describe('EnhancedSupportResistanceDetector', () => {
  let detector: EnhancedSupportResistanceDetector;
  let mockCandles: CandleData[];

  beforeEach(() => {
    detector = new EnhancedSupportResistanceDetector();
    
    // Create mock candle data with clear support/resistance levels
    mockCandles = [];
    const basePrice = 100;
    const supportLevel = 95;
    const resistanceLevel = 105;
    
    for (let i = 0; i < 100; i++) {
      const timestamp = Date.now() - (100 - i) * 60000; // 1 minute intervals
      let price = basePrice + Math.sin(i / 10) * 3; // Oscillating price
      
      // Add touches at support and resistance levels
      if (i % 15 === 0) {
        price = supportLevel + Math.random() * 0.5; // Touch support
      } else if (i % 20 === 0) {
        price = resistanceLevel - Math.random() * 0.5; // Touch resistance
      }
      
      const volume = 1000000 + Math.random() * 500000;
      
      mockCandles.push({
        symbol: 'BTCUSDT',
        timeframe: '1m',
        timestamp,
        open: price - 0.1,
        high: price + 0.2,
        low: price - 0.2,
        close: price,
        volume,
      });
    }
  });

  describe('detectEnhancedLevels', () => {
    it('should detect enhanced support and resistance levels', async () => {
      const levels = await detector.detectEnhancedLevels(mockCandles);
      
      expect(levels).toBeDefined();
      expect(Array.isArray(levels)).toBe(true);
      expect(levels.length).toBeGreaterThan(0);
      
      // Check that levels have enhanced properties
      levels.forEach(level => {
        expect(level).toHaveProperty('strengthScore');
        expect(level).toHaveProperty('liquidityGrab');
        expect(level).toHaveProperty('reversalPotential');
        expect(level).toHaveProperty('volumeConfirmation');
        expect(level).toHaveProperty('timeStrength');
        expect(level).toHaveProperty('priceActionStrength');
        
        expect(level.strengthScore).toBeGreaterThanOrEqual(0);
        expect(level.strengthScore).toBeLessThanOrEqual(1);
        expect(typeof level.liquidityGrab).toBe('boolean');
        expect(level.reversalPotential).toBeGreaterThanOrEqual(0);
        expect(level.reversalPotential).toBeLessThanOrEqual(1);
      });
    });

    it('should sort levels by strength score', async () => {
      const levels = await detector.detectEnhancedLevels(mockCandles);
      
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i - 1].strengthScore).toBeGreaterThanOrEqual(levels[i].strengthScore);
      }
    });

    it('should handle insufficient data gracefully', async () => {
      const shortCandles = mockCandles.slice(0, 10);
      
      await expect(detector.detectEnhancedLevels(shortCandles))
        .rejects.toThrow('Insufficient data for enhanced S/R detection');
    });
  });

  describe('detectLiquidityGrabs', () => {
    it('should detect liquidity grabs', async () => {
      // Create candles with clear liquidity grab pattern
      const grabCandles = [...mockCandles];
      
      // Add a liquidity grab at support level
      const supportLevel = 95;
      const grabIndex = 50;
      
      // Break below support then quickly recover
      grabCandles[grabIndex] = {
        ...grabCandles[grabIndex],
        low: supportLevel - 0.5,
        close: supportLevel + 0.3,
        volume: grabCandles[grabIndex].volume * 2, // Volume spike
      };
      
      const grabs = await detector.detectLiquidityGrabs(grabCandles);
      
      expect(grabs).toBeDefined();
      expect(Array.isArray(grabs)).toBe(true);
      
      grabs.forEach(grab => {
        expect(grab).toHaveProperty('timestamp');
        expect(grab).toHaveProperty('price');
        expect(grab).toHaveProperty('type');
        expect(grab).toHaveProperty('strength');
        expect(grab).toHaveProperty('reversalConfirmed');
        expect(grab).toHaveProperty('volumeSpike');
        
        expect(['support', 'resistance']).toContain(grab.type);
        expect(grab.strength).toBeGreaterThanOrEqual(0);
        expect(grab.strength).toBeLessThanOrEqual(1);
        expect(typeof grab.reversalConfirmed).toBe('boolean');
        expect(grab.volumeSpike).toBeGreaterThanOrEqual(0);
      });
    });

    it('should return empty array when no grabs detected', async () => {
      // Use smooth price action without grabs
      const smoothCandles = mockCandles.map((candle) => ({
        ...candle,
        low: candle.close - 0.1,
        high: candle.close + 0.1,
        volume: 1000000, // Consistent volume
      }));
      
      const grabs = await detector.detectLiquidityGrabs(smoothCandles);
      expect(grabs).toEqual([]);
    });
  });

  describe('calculateDynamicStrengthScore', () => {
    it('should calculate strength score within valid range', async () => {
      const levels = await detector.detectEnhancedLevels(mockCandles);
      
      if (levels.length > 0) {
        const level = levels[0];
        const volatility = 0.2;
        
        const score = detector.calculateDynamicStrengthScore(level, mockCandles, volatility);
        
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    });

    it('should adjust score based on market volatility', async () => {
      const levels = await detector.detectEnhancedLevels(mockCandles);
      
      if (levels.length > 0) {
        const level = levels[0];
        
        const lowVolScore = detector.calculateDynamicStrengthScore(level, mockCandles, 0.1);
        const highVolScore = detector.calculateDynamicStrengthScore(level, mockCandles, 0.5);
        
        // Scores should be different for different volatility levels
        expect(lowVolScore).not.toEqual(highVolScore);
      }
    });
  });

  describe('configuration', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        minTouches: 3,
        touchTolerance: 1.0,
        liquidityGrabThreshold: 2.0,
      };
      
      detector.updateConfig(newConfig);
      const config = detector.getConfig();
      
      expect(config.minTouches).toBe(3);
      expect(config.touchTolerance).toBe(1.0);
      expect(config.liquidityGrabThreshold).toBe(2.0);
    });

    it('should return current configuration', () => {
      const config = detector.getConfig();
      
      expect(config).toHaveProperty('minTouches');
      expect(config).toHaveProperty('touchTolerance');
      expect(config).toHaveProperty('minStrength');
      expect(config).toHaveProperty('lookbackPeriod');
      expect(config).toHaveProperty('volumeWeighting');
      expect(config).toHaveProperty('liquidityGrabThreshold');
      expect(config).toHaveProperty('reversalConfirmationPeriod');
      expect(config).toHaveProperty('strengthScoreWeights');
    });
  });

  describe('edge cases', () => {
    it('should handle empty candle array', async () => {
      await expect(detector.detectEnhancedLevels([]))
        .rejects.toThrow();
    });

    it('should handle candles with zero volume', async () => {
      const zeroVolumeCandles = mockCandles.map(candle => ({
        ...candle,
        volume: 0,
      }));
      
      const levels = await detector.detectEnhancedLevels(zeroVolumeCandles);
      expect(levels).toBeDefined();
      expect(Array.isArray(levels)).toBe(true);
    });

    it('should handle identical price levels', async () => {
      const flatCandles = mockCandles.map(candle => ({
        ...candle,
        open: 100,
        high: 100,
        low: 100,
        close: 100,
      }));
      
      const levels = await detector.detectEnhancedLevels(flatCandles);
      expect(levels).toBeDefined();
      expect(Array.isArray(levels)).toBe(true);
    });
  });
});