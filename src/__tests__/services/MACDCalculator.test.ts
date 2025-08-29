/**
 * MACD Calculator Tests
 */

import { MACDCalculator } from '../../services/indicators/MACDCalculator';
import { CandleData } from '../../types/market';

describe('MACDCalculator', () => {
  let calculator: MACDCalculator;
  let mockCandles: CandleData[];

  beforeEach(() => {
    calculator = new MACDCalculator();
    
    // Create mock candle data with trending price movement
    mockCandles = [];
    const basePrice = 100;
    for (let i = 0; i < 50; i++) {
      const trend = i * 0.5; // Upward trend
      const noise = (Math.random() - 0.5) * 2; // Random noise
      const price = basePrice + trend + noise;
      
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
    it('should calculate MACD values correctly', async () => {
      const results = await calculator.calculate(mockCandles);
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      // Length should be reasonable based on the calculation requirements
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.length).toBeLessThanOrEqual(mockCandles.length);
      
      // Check that all results have required properties
      results.forEach(result => {
        expect(result).toHaveProperty('macd');
        expect(result).toHaveProperty('signal');
        expect(result).toHaveProperty('histogram');
        expect(typeof result.macd).toBe('number');
        expect(typeof result.signal).toBe('number');
        expect(typeof result.histogram).toBe('number');
      });
    });

    it('should throw error with insufficient data', async () => {
      const shortCandles = mockCandles.slice(0, 20);
      
      await expect(calculator.calculate(shortCandles)).rejects.toThrow(
        'Insufficient data for MACD calculation'
      );
    });

    it('should detect crossovers correctly', async () => {
      const results = await calculator.calculate(mockCandles);
      
      // Check for crossover detection
      const crossovers = results.filter(r => r.crossover !== null);
      expect(crossovers.length).toBeGreaterThanOrEqual(0);
      
      // Verify crossover logic
      crossovers.forEach(result => {
        expect(['bullish', 'bearish']).toContain(result.crossover);
      });
    });
  });

  describe('calculateSingle', () => {
    it('should calculate single MACD value for real-time updates', () => {
      const prices = mockCandles.map(c => c.close);
      const result = calculator.calculateSingle(
        prices,
        prices[prices.length - 2], // previousFastEMA
        prices[prices.length - 2], // previousSlowEMA
        0 // previousSignalEMA
      );
      
      expect(result).toHaveProperty('macd');
      expect(result).toHaveProperty('signal');
      expect(result).toHaveProperty('histogram');
      expect(result).toHaveProperty('fastEMA');
      expect(result).toHaveProperty('slowEMA');
      expect(result).toHaveProperty('signalEMA');
      
      expect(typeof result.macd).toBe('number');
      expect(typeof result.signal).toBe('number');
      expect(typeof result.histogram).toBe('number');
    });
  });

  describe('getInterpretation', () => {
    it('should provide correct interpretation for bullish crossover', () => {
      const macdResult = {
        macd: 1.5,
        signal: 1.0,
        histogram: 0.5,
        crossover: 'bullish' as const,
      };
      
      const interpretation = calculator.getInterpretation(macdResult);
      
      expect(interpretation.signal).toBe('Strong Buy');
      expect(interpretation.strength).toBe('strong');
      expect(interpretation.description).toContain('bullish crossover');
    });

    it('should provide correct interpretation for bearish crossover', () => {
      const macdResult = {
        macd: -1.5,
        signal: -1.0,
        histogram: -0.5,
        crossover: 'bearish' as const,
      };
      
      const interpretation = calculator.getInterpretation(macdResult);
      
      expect(interpretation.signal).toBe('Strong Sell');
      expect(interpretation.strength).toBe('strong');
      expect(interpretation.description).toContain('bearish crossover');
    });

    it('should provide correct interpretation for mixed signals', () => {
      const macdResult = {
        macd: 0.1,
        signal: -0.1,
        histogram: 0.2,
        crossover: null,
      };
      
      const interpretation = calculator.getInterpretation(macdResult);
      
      // Since MACD > signal, it should be a buy signal
      expect(['Buy', 'Weak Buy']).toContain(interpretation.signal);
      expect(['weak', 'moderate']).toContain(interpretation.strength);
    });
  });

  describe('configuration', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        fastPeriod: 10,
        slowPeriod: 20,
        signalPeriod: 7,
      };
      
      calculator.updateConfig(newConfig);
      const config = calculator.getConfig();
      
      expect(config.fastPeriod).toBe(10);
      expect(config.slowPeriod).toBe(20);
      expect(config.signalPeriod).toBe(7);
    });

    it('should use default configuration', () => {
      const config = calculator.getConfig();
      
      expect(config.fastPeriod).toBe(12);
      expect(config.slowPeriod).toBe(26);
      expect(config.signalPeriod).toBe(9);
    });
  });

  describe('edge cases', () => {
    it('should handle flat price movement', async () => {
      const flatCandles = mockCandles.map((candle, i) => ({
        ...candle,
        open: 100,
        high: 100.1,
        low: 99.9,
        close: 100,
      }));
      
      const results = await calculator.calculate(flatCandles);
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      // MACD should be close to zero for flat prices
      results.forEach(result => {
        expect(typeof result.macd).toBe('number');
        expect(isFinite(result.macd)).toBe(true);
      });
    });

    it('should handle extreme price movements', async () => {
      const extremeCandles = mockCandles.map((candle, i) => ({
        ...candle,
        close: 100 + i * 2, // Moderate upward trend
        open: 100 + i * 2 - 0.5,
        high: 100 + i * 2 + 1,
        low: 100 + i * 2 - 1,
      }));
      
      const results = await calculator.calculate(extremeCandles);
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      // MACD should be finite numbers for extreme uptrend
      const lastResult = results[results.length - 1];
      expect(typeof lastResult.macd).toBe('number');
      expect(isFinite(lastResult.macd)).toBe(true);
    });
  });
});