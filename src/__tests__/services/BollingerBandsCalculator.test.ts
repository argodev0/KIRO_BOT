/**
 * Bollinger Bands Calculator Tests
 */

import { BollingerBandsCalculator } from '../../services/indicators/BollingerBandsCalculator';
import { CandleData } from '../../types/market';

describe('BollingerBandsCalculator', () => {
  let calculator: BollingerBandsCalculator;
  let mockCandles: CandleData[];

  beforeEach(() => {
    calculator = new BollingerBandsCalculator();
    
    // Create mock candle data
    mockCandles = [];
    const basePrice = 100;
    for (let i = 0; i < 30; i++) {
      const volatility = Math.sin(i * 0.3) * 5; // Cyclical volatility
      const trend = i * 0.2; // Slight upward trend
      const price = basePrice + trend + volatility;
      
      mockCandles.push({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: Date.now() + i * 3600000,
        open: price - 0.5,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000 + Math.random() * 500,
      });
    }
  });

  describe('calculate', () => {
    it('should calculate Bollinger Bands correctly', async () => {
      const results = await calculator.calculate(mockCandles);
      
      expect(results).toBeDefined();
      expect(results.length).toBe(mockCandles.length - 20 + 1); // period - 1
      
      results.forEach(result => {
        expect(result).toHaveProperty('upperBand');
        expect(result).toHaveProperty('middleBand');
        expect(result).toHaveProperty('lowerBand');
        expect(result).toHaveProperty('bandwidth');
        expect(result).toHaveProperty('percentB');
        
        // Upper band should be above middle band
        expect(result.upperBand).toBeGreaterThan(result.middleBand);
        // Lower band should be below middle band
        expect(result.lowerBand).toBeLessThan(result.middleBand);
        // Bandwidth should be positive
        expect(result.bandwidth).toBeGreaterThan(0);
      });
    });

    it('should throw error with insufficient data', async () => {
      const shortCandles = mockCandles.slice(0, 15);
      
      await expect(calculator.calculate(shortCandles)).rejects.toThrow(
        'Insufficient data for Bollinger Bands calculation'
      );
    });
  });

  describe('calculateSingle', () => {
    it('should calculate single Bollinger Bands value', () => {
      const prices = mockCandles.map(c => c.close);
      const result = calculator.calculateSingle(prices);
      
      expect(result).toHaveProperty('upperBand');
      expect(result).toHaveProperty('middleBand');
      expect(result).toHaveProperty('lowerBand');
      expect(result).toHaveProperty('bandwidth');
      expect(result).toHaveProperty('percentB');
      
      expect(result.upperBand).toBeGreaterThan(result.middleBand);
      expect(result.lowerBand).toBeLessThan(result.middleBand);
    });
  });

  describe('getInterpretation', () => {
    it('should provide correct interpretation for upper band breakout', () => {
      const bbResult = {
        upperBand: 110,
        middleBand: 100,
        lowerBand: 90,
        bandwidth: 0.2,
        percentB: 1.1,
        breakout: 'upper' as const,
      };
      
      const interpretation = calculator.getInterpretation(bbResult);
      
      expect(interpretation.signal).toBe('Strong Buy');
      expect(interpretation.strength).toBe('strong');
      expect(interpretation.description).toContain('breaking above upper');
    });

    it('should provide correct interpretation for squeeze', () => {
      const bbResult = {
        upperBand: 102,
        middleBand: 100,
        lowerBand: 98,
        bandwidth: 0.04,
        percentB: 0.5,
        squeeze: true,
      };
      
      const interpretation = calculator.getInterpretation(bbResult);
      
      expect(interpretation.signal).toBe('Neutral');
      expect(interpretation.strength).toBe('moderate');
      expect(interpretation.description).toContain('squeeze detected');
    });
  });

  describe('configuration', () => {
    it('should update configuration correctly', () => {
      const newConfig = { period: 15, standardDeviations: 2.5 };
      
      calculator.updateConfig(newConfig);
      const config = calculator.getConfig();
      
      expect(config.period).toBe(15);
      expect(config.standardDeviations).toBe(2.5);
    });
  });
});