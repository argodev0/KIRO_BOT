/**
 * RSI Calculator Tests
 * Tests for RSI calculation with various market conditions
 */

import { RSICalculator } from '../../../services/indicators/RSICalculator';
import { CandleData } from '../../../types/market';

describe('RSICalculator', () => {
  let calculator: RSICalculator;
  let mockCandles: CandleData[];

  beforeEach(() => {
    calculator = new RSICalculator({ period: 14, overbought: 70, oversold: 30 });
    mockCandles = generateMockCandles(50);
  });

  describe('calculate', () => {
    it('should calculate RSI values correctly', async () => {
      const rsiValues = await calculator.calculate(mockCandles);

      expect(rsiValues).toHaveLength(mockCandles.length - 14); // Period adjustment
      rsiValues.forEach(rsi => {
        expect(rsi).toBeGreaterThanOrEqual(0);
        expect(rsi).toBeLessThanOrEqual(100);
      });
    });

    it('should handle trending up market', async () => {
      const trendingCandles = generateTrendingCandles(30, 'up');
      const rsiValues = await calculator.calculate(trendingCandles);

      // In an uptrend, RSI should generally be above 50
      const avgRSI = rsiValues.reduce((sum, rsi) => sum + rsi, 0) / rsiValues.length;
      expect(avgRSI).toBeGreaterThan(50);
    });

    it('should handle trending down market', async () => {
      const trendingCandles = generateTrendingCandles(30, 'down');
      const rsiValues = await calculator.calculate(trendingCandles);

      // In a downtrend, RSI should generally be below 50
      const avgRSI = rsiValues.reduce((sum, rsi) => sum + rsi, 0) / rsiValues.length;
      expect(avgRSI).toBeLessThan(50);
    });

    it('should throw error with insufficient data', async () => {
      const shortCandles = generateMockCandles(10);

      await expect(calculator.calculate(shortCandles))
        .rejects.toThrow('Insufficient data for RSI calculation');
    });

    it('should handle extreme price movements', async () => {
      const extremeCandles = generateExtremeCandles(20);
      const rsiValues = await calculator.calculate(extremeCandles);

      expect(rsiValues).toHaveLength(extremeCandles.length - 14);
      rsiValues.forEach(rsi => {
        expect(rsi).toBeGreaterThanOrEqual(0);
        expect(rsi).toBeLessThanOrEqual(100);
        expect(isNaN(rsi)).toBe(false);
      });
    });
  });

  describe('calculateDetailed', () => {
    it('should return detailed RSI results', async () => {
      const results = await calculator.calculateDetailed(mockCandles);

      expect(results).toHaveLength(mockCandles.length - 14);
      results.forEach(result => {
        expect(result.value).toBeGreaterThanOrEqual(0);
        expect(result.value).toBeLessThanOrEqual(100);
        expect(result.signal).toMatch(/^(overbought|oversold|neutral)$/);
        expect(result.divergence === null || result.divergence === 'bullish' || result.divergence === 'bearish').toBe(true);
      });
    });
  });

  describe('getSignal', () => {
    it('should return overbought signal', () => {
      const signal = calculator.getSignal(75);
      expect(signal).toBe('overbought');
    });

    it('should return oversold signal', () => {
      const signal = calculator.getSignal(25);
      expect(signal).toBe('oversold');
    });

    it('should return neutral signal', () => {
      const signal = calculator.getSignal(50);
      expect(signal).toBe('neutral');
    });
  });

  describe('calculateSingle', () => {
    it('should calculate single RSI value', () => {
      const result = calculator.calculateSingle(50, 10, 8, 5, 3);

      expect(result.rsi).toBeGreaterThanOrEqual(0);
      expect(result.rsi).toBeLessThanOrEqual(100);
      expect(result.avgGain).toBeGreaterThanOrEqual(0);
      expect(result.avgLoss).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getInterpretation', () => {
    it('should provide correct interpretation for overbought', () => {
      const interpretation = calculator.getInterpretation(85);

      expect(interpretation.signal).toBe('Strong Sell');
      expect(interpretation.strength).toBe('strong');
      expect(interpretation.description).toContain('overbought');
    });

    it('should provide correct interpretation for oversold', () => {
      const interpretation = calculator.getInterpretation(15);

      expect(interpretation.signal).toBe('Strong Buy');
      expect(interpretation.strength).toBe('strong');
      expect(interpretation.description).toContain('oversold');
    });

    it('should provide correct interpretation for neutral', () => {
      const interpretation = calculator.getInterpretation(50);

      expect(interpretation.signal).toBe('Neutral');
      expect(interpretation.strength).toBe('weak');
      expect(interpretation.description).toContain('Neutral');
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      calculator.updateConfig({ period: 21, overbought: 75 });
      const config = calculator.getConfig();

      expect(config.period).toBe(21);
      expect(config.overbought).toBe(75);
      expect(config.oversold).toBe(30); // Should remain unchanged
    });

    it('should return current configuration', () => {
      const config = calculator.getConfig();

      expect(config.period).toBe(14);
      expect(config.overbought).toBe(70);
      expect(config.oversold).toBe(30);
    });
  });

  describe('edge cases', () => {
    it('should handle all gains scenario', async () => {
      const allGainsCandles = generateAllGainsCandles(20);
      const rsiValues = await calculator.calculate(allGainsCandles);

      // RSI should approach 100 with all gains
      const lastRSI = rsiValues[rsiValues.length - 1];
      expect(lastRSI).toBeGreaterThan(80);
    });

    it('should handle all losses scenario', async () => {
      const allLossesCandles = generateAllLossesCandles(20);
      const rsiValues = await calculator.calculate(allLossesCandles);

      // RSI should approach 0 with all losses
      const lastRSI = rsiValues[rsiValues.length - 1];
      expect(lastRSI).toBeLessThan(20);
    });

    it('should handle no price change scenario', async () => {
      const flatCandles = generateFlatCandles(20);
      const rsiValues = await calculator.calculate(flatCandles);

      // RSI should be around 50 with no price changes, but may not be exactly 50 due to small variations
      const avgRSI = rsiValues.reduce((sum, rsi) => sum + rsi, 0) / rsiValues.length;
      expect(avgRSI).toBeGreaterThan(40);
      expect(avgRSI).toBeLessThan(60);
    });
  });
});

// Helper functions for generating test data
function generateMockCandles(count: number): CandleData[] {
  const candles: CandleData[] = [];
  let currentPrice = 100;
  const startTime = Date.now() - (count * 60 * 60 * 1000);

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 0.04; // ±2% change
    const open = currentPrice;
    const close = open * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);

    candles.push({
      symbol: 'TESTUSDT',
      timeframe: '1h',
      timestamp: startTime + (i * 60 * 60 * 1000),
      open,
      high,
      low,
      close,
      volume: 1000000,
    });

    currentPrice = close;
  }

  return candles;
}

function generateTrendingCandles(count: number, direction: 'up' | 'down'): CandleData[] {
  const candles: CandleData[] = [];
  let currentPrice = 100;
  const startTime = Date.now() - (count * 60 * 60 * 1000);
  const trendStrength = direction === 'up' ? 0.02 : -0.02;

  for (let i = 0; i < count; i++) {
    const noise = (Math.random() - 0.5) * 0.01;
    const change = trendStrength + noise;
    
    const open = currentPrice;
    const close = open * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low = Math.min(open, close) * (1 - Math.random() * 0.005);

    candles.push({
      symbol: 'TESTUSDT',
      timeframe: '1h',
      timestamp: startTime + (i * 60 * 60 * 1000),
      open,
      high,
      low,
      close,
      volume: 1000000,
    });

    currentPrice = close;
  }

  return candles;
}

function generateExtremeCandles(count: number): CandleData[] {
  const candles: CandleData[] = [];
  let currentPrice = 100;
  const startTime = Date.now() - (count * 60 * 60 * 1000);

  for (let i = 0; i < count; i++) {
    // Extreme price movements (±10%)
    const change = (Math.random() - 0.5) * 0.2;
    const open = currentPrice;
    const close = open * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.05);
    const low = Math.min(open, close) * (1 - Math.random() * 0.05);

    candles.push({
      symbol: 'TESTUSDT',
      timeframe: '1h',
      timestamp: startTime + (i * 60 * 60 * 1000),
      open,
      high,
      low,
      close,
      volume: 1000000,
    });

    currentPrice = close;
  }

  return candles;
}

function generateAllGainsCandles(count: number): CandleData[] {
  const candles: CandleData[] = [];
  let currentPrice = 100;
  const startTime = Date.now() - (count * 60 * 60 * 1000);

  for (let i = 0; i < count; i++) {
    const change = Math.random() * 0.02 + 0.01; // 1-3% gains
    const open = currentPrice;
    const close = open * (1 + change);
    const high = close * (1 + Math.random() * 0.005);
    const low = open * (1 - Math.random() * 0.005);

    candles.push({
      symbol: 'TESTUSDT',
      timeframe: '1h',
      timestamp: startTime + (i * 60 * 60 * 1000),
      open,
      high,
      low,
      close,
      volume: 1000000,
    });

    currentPrice = close;
  }

  return candles;
}

function generateAllLossesCandles(count: number): CandleData[] {
  const candles: CandleData[] = [];
  let currentPrice = 100;
  const startTime = Date.now() - (count * 60 * 60 * 1000);

  for (let i = 0; i < count; i++) {
    const change = -(Math.random() * 0.02 + 0.01); // 1-3% losses
    const open = currentPrice;
    const close = open * (1 + change);
    const high = open * (1 + Math.random() * 0.005);
    const low = close * (1 - Math.random() * 0.005);

    candles.push({
      symbol: 'TESTUSDT',
      timeframe: '1h',
      timestamp: startTime + (i * 60 * 60 * 1000),
      open,
      high,
      low,
      close,
      volume: 1000000,
    });

    currentPrice = close;
  }

  return candles;
}

function generateFlatCandles(count: number): CandleData[] {
  const candles: CandleData[] = [];
  const price = 100;
  const startTime = Date.now() - (count * 60 * 60 * 1000);

  for (let i = 0; i < count; i++) {
    // Add tiny random variations to avoid division by zero
    const variation = (Math.random() - 0.5) * 0.0001; // 0.01% variation
    const currentPrice = price * (1 + variation);
    
    candles.push({
      symbol: 'TESTUSDT',
      timeframe: '1h',
      timestamp: startTime + (i * 60 * 60 * 1000),
      open: currentPrice,
      high: currentPrice * 1.0001,
      low: currentPrice * 0.9999,
      close: currentPrice,
      volume: 1000000,
    });
  }

  return candles;
}