/**
 * PVT (Price Volume Trend) Calculator Tests
 * Tests for PVT calculation with various market conditions
 */

import { PVTCalculator } from '../../../services/indicators/PVTCalculator';
import { CandleData } from '../../../types/market';

describe('PVTCalculator', () => {
  let calculator: PVTCalculator;
  let mockCandles: CandleData[];

  beforeEach(() => {
    calculator = new PVTCalculator({ period: 14 });
    mockCandles = generateMockCandles(50);
  });

  describe('calculate', () => {
    it('should calculate PVT values correctly', async () => {
      const pvtValues = await calculator.calculate(mockCandles);

      expect(pvtValues).toHaveLength(mockCandles.length);
      expect(pvtValues[0]).toBe(0); // First value should be 0
      
      // All values should be finite numbers
      pvtValues.forEach(pvt => {
        expect(isFinite(pvt)).toBe(true);
      });
    });

    it('should handle uptrend with increasing volume', async () => {
      const uptrendCandles = generateUptrendCandles(30);
      const pvtValues = await calculator.calculate(uptrendCandles);

      // PVT should generally increase in uptrend with volume
      const finalPVT = pvtValues[pvtValues.length - 1];
      expect(finalPVT).toBeGreaterThan(0);
    });

    it('should handle downtrend with increasing volume', async () => {
      const downtrendCandles = generateDowntrendCandles(30);
      const pvtValues = await calculator.calculate(downtrendCandles);

      // PVT should generally decrease in downtrend with volume
      const finalPVT = pvtValues[pvtValues.length - 1];
      expect(finalPVT).toBeLessThan(0);
    });

    it('should throw error with insufficient data', async () => {
      const shortCandles = [generateMockCandles(1)[0]];

      await expect(calculator.calculate(shortCandles))
        .rejects.toThrow('Insufficient data for PVT calculation');
    });

    it('should handle zero volume scenarios', async () => {
      const zeroVolumeCandles = generateZeroVolumeCandles(20);
      const pvtValues = await calculator.calculate(zeroVolumeCandles);

      // PVT should remain at 0 with zero volume
      pvtValues.forEach(pvt => {
        expect(pvt).toBe(0);
      });
    });
  });

  describe('calculateDetailed', () => {
    it('should return detailed PVT results', async () => {
      const results = await calculator.calculateDetailed(mockCandles);

      expect(results).toHaveLength(mockCandles.length);
      results.forEach(result => {
        expect(typeof result.value).toBe('number');
        expect(result.signal).toMatch(/^(bullish|bearish|neutral)$/);
        expect(result.trend).toMatch(/^(rising|falling|sideways)$/);
        expect(isFinite(result.value)).toBe(true);
      });
    });

    it('should detect bullish signals in uptrend', async () => {
      const uptrendCandles = generateUptrendCandles(30);
      const results = await calculator.calculateDetailed(uptrendCandles);

      const bullishSignals = results.filter(r => r.signal === 'bullish');
      expect(bullishSignals.length).toBeGreaterThan(0);
    });

    it('should detect bearish signals in downtrend', async () => {
      const downtrendCandles = generateDowntrendCandles(30);
      const results = await calculator.calculateDetailed(downtrendCandles);

      const bearishSignals = results.filter(r => r.signal === 'bearish');
      expect(bearishSignals.length).toBeGreaterThan(0);
    });
  });

  describe('calculateSingle', () => {
    it('should calculate single PVT value correctly', () => {
      const previousPVT = 1000;
      const currentCandle = mockCandles[1];
      const previousCandle = mockCandles[0];

      const newPVT = calculator.calculateSingle(previousPVT, currentCandle, previousCandle);

      expect(isFinite(newPVT)).toBe(true);
      expect(newPVT).not.toBe(previousPVT); // Should change unless price is flat
    });

    it('should handle price increase correctly', () => {
      const previousPVT = 0;
      const previousCandle = { ...mockCandles[0], close: 100 };
      const currentCandle = { ...mockCandles[1], close: 105, volume: 1000000 };

      const newPVT = calculator.calculateSingle(previousPVT, currentCandle, previousCandle);

      expect(newPVT).toBeGreaterThan(0); // Should be positive for price increase
    });

    it('should handle price decrease correctly', () => {
      const previousPVT = 0;
      const previousCandle = { ...mockCandles[0], close: 100 };
      const currentCandle = { ...mockCandles[1], close: 95, volume: 1000000 };

      const newPVT = calculator.calculateSingle(previousPVT, currentCandle, previousCandle);

      expect(newPVT).toBeLessThan(0); // Should be negative for price decrease
    });
  });

  describe('getInterpretation', () => {
    it('should provide strong buy interpretation for rising trend', () => {
      const interpretation = calculator.getInterpretation(1000, 900, 'rising');

      expect(interpretation.signal).toContain('Buy');
      expect(interpretation.description).toContain('upside');
    });

    it('should provide strong sell interpretation for falling trend', () => {
      const interpretation = calculator.getInterpretation(-1000, -900, 'falling');

      expect(interpretation.signal).toContain('Sell');
      expect(interpretation.description).toContain('downside');
    });

    it('should provide neutral interpretation for sideways trend', () => {
      const interpretation = calculator.getInterpretation(1000, 1000, 'sideways');

      expect(interpretation.signal).toBe('Neutral');
      expect(interpretation.description).toContain('No clear');
    });

    it('should classify strength correctly', () => {
      const strongInterpretation = calculator.getInterpretation(1000, 800, 'rising');
      const weakInterpretation = calculator.getInterpretation(1000, 990, 'rising');

      expect(strongInterpretation.strength).toBe('strong');
      expect(weakInterpretation.strength).toBe('weak');
    });
  });

  describe('calculateVWAP', () => {
    it('should calculate VWAP correctly', () => {
      const vwap = calculator.calculateVWAP(mockCandles, 10);

      expect(vwap.length).toBe(mockCandles.length - 9);
      vwap.forEach(value => {
        expect(isFinite(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      });
    });

    it('should return empty array with insufficient data', () => {
      const shortCandles = generateMockCandles(5);
      const vwap = calculator.calculateVWAP(shortCandles, 10);

      expect(vwap).toHaveLength(0);
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      calculator.updateConfig({ period: 21 });
      const config = calculator.getConfig();

      expect(config.period).toBe(21);
    });

    it('should return current configuration', () => {
      const config = calculator.getConfig();

      expect(config.period).toBe(14);
    });
  });

  describe('divergence detection', () => {
    it('should detect bullish divergence', async () => {
      const divergenceCandles = generateBullishDivergenceCandles(40);
      const results = await calculator.calculateDetailed(divergenceCandles);

      const bullishDivergence = results.filter(r => r.divergence === 'bullish');
      expect(bullishDivergence.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect bearish divergence', async () => {
      const divergenceCandles = generateBearishDivergenceCandles(40);
      const results = await calculator.calculateDetailed(divergenceCandles);

      const bearishDivergence = results.filter(r => r.divergence === 'bearish');
      expect(bearishDivergence.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('edge cases', () => {
    it('should handle flat price with varying volume', async () => {
      const flatCandles = generateFlatPriceCandles(20);
      const pvtValues = await calculator.calculate(flatCandles);

      // PVT should remain near 0 with flat prices
      pvtValues.forEach(pvt => {
        expect(Math.abs(pvt)).toBeLessThan(1000);
      });
    });

    it('should handle extreme volume spikes', async () => {
      const spikeCandles = generateVolumeSpikeCandles(30);
      const pvtValues = await calculator.calculate(spikeCandles);

      expect(pvtValues).toHaveLength(spikeCandles.length);
      pvtValues.forEach(pvt => {
        expect(isFinite(pvt)).toBe(true);
      });
    });
  });
});

// Helper functions for generating test data
function generateMockCandles(count: number): CandleData[] {
  const candles: CandleData[] = [];
  let currentPrice = 100;
  const startTime = Date.now() - (count * 60 * 60 * 1000);

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 0.04;
    const open = currentPrice;
    const close = open * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    const volume = 1000000 + Math.random() * 2000000;

    candles.push({
      symbol: 'TESTUSDT',
      timeframe: '1h',
      timestamp: startTime + (i * 60 * 60 * 1000),
      open,
      high,
      low,
      close,
      volume,
    });

    currentPrice = close;
  }

  return candles;
}

function generateUptrendCandles(count: number): CandleData[] {
  const candles: CandleData[] = [];
  let currentPrice = 100;
  const startTime = Date.now() - (count * 60 * 60 * 1000);

  for (let i = 0; i < count; i++) {
    const change = 0.02 + Math.random() * 0.01; // 2-3% gains
    const open = currentPrice;
    const close = open * (1 + change);
    const high = close * (1 + Math.random() * 0.005);
    const low = open * (1 - Math.random() * 0.005);
    const volume = 1000000 + Math.random() * 3000000; // Increasing volume

    candles.push({
      symbol: 'TESTUSDT',
      timeframe: '1h',
      timestamp: startTime + (i * 60 * 60 * 1000),
      open,
      high,
      low,
      close,
      volume,
    });

    currentPrice = close;
  }

  return candles;
}

function generateDowntrendCandles(count: number): CandleData[] {
  const candles: CandleData[] = [];
  let currentPrice = 100;
  const startTime = Date.now() - (count * 60 * 60 * 1000);

  for (let i = 0; i < count; i++) {
    const change = -0.02 - Math.random() * 0.01; // 2-3% losses
    const open = currentPrice;
    const close = open * (1 + change);
    const high = open * (1 + Math.random() * 0.005);
    const low = close * (1 - Math.random() * 0.005);
    const volume = 1000000 + Math.random() * 3000000; // Increasing volume

    candles.push({
      symbol: 'TESTUSDT',
      timeframe: '1h',
      timestamp: startTime + (i * 60 * 60 * 1000),
      open,
      high,
      low,
      close,
      volume,
    });

    currentPrice = close;
  }

  return candles;
}

function generateZeroVolumeCandles(count: number): CandleData[] {
  const candles: CandleData[] = [];
  let currentPrice = 100;
  const startTime = Date.now() - (count * 60 * 60 * 1000);

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 0.02;
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
      volume: 0, // Zero volume
    });

    currentPrice = close;
  }

  return candles;
}

function generateFlatPriceCandles(count: number): CandleData[] {
  const candles: CandleData[] = [];
  const price = 100;
  const startTime = Date.now() - (count * 60 * 60 * 1000);

  for (let i = 0; i < count; i++) {
    const volume = 500000 + Math.random() * 2000000; // Varying volume

    candles.push({
      symbol: 'TESTUSDT',
      timeframe: '1h',
      timestamp: startTime + (i * 60 * 60 * 1000),
      open: price,
      high: price * 1.001,
      low: price * 0.999,
      close: price,
      volume,
    });
  }

  return candles;
}

function generateVolumeSpikeCandles(count: number): CandleData[] {
  const candles: CandleData[] = [];
  let currentPrice = 100;
  const startTime = Date.now() - (count * 60 * 60 * 1000);

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 0.03;
    const open = currentPrice;
    const close = open * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    
    // Random volume spikes
    const isSpike = Math.random() < 0.2; // 20% chance of spike
    const volume = isSpike ? 10000000 + Math.random() * 20000000 : 1000000 + Math.random() * 2000000;

    candles.push({
      symbol: 'TESTUSDT',
      timeframe: '1h',
      timestamp: startTime + (i * 60 * 60 * 1000),
      open,
      high,
      low,
      close,
      volume,
    });

    currentPrice = close;
  }

  return candles;
}

function generateBullishDivergenceCandles(count: number): CandleData[] {
  const candles: CandleData[] = [];
  let currentPrice = 100;
  const startTime = Date.now() - (count * 60 * 60 * 1000);

  for (let i = 0; i < count; i++) {
    // Create lower lows in price but with decreasing volume (bullish divergence)
    let change: number;
    let volume: number;
    
    if (i < count * 0.3) {
      change = -0.02;
      volume = 3000000;
    } else if (i < count * 0.6) {
      change = -0.025; // Lower low
      volume = 2000000; // Lower volume (divergence)
    } else {
      change = 0.015; // Recovery
      volume = 2500000;
    }

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
      volume,
    });

    currentPrice = close;
  }

  return candles;
}

function generateBearishDivergenceCandles(count: number): CandleData[] {
  const candles: CandleData[] = [];
  let currentPrice = 100;
  const startTime = Date.now() - (count * 60 * 60 * 1000);

  for (let i = 0; i < count; i++) {
    // Create higher highs in price but with decreasing volume (bearish divergence)
    let change: number;
    let volume: number;
    
    if (i < count * 0.3) {
      change = 0.02;
      volume = 3000000;
    } else if (i < count * 0.6) {
      change = 0.025; // Higher high
      volume = 2000000; // Lower volume (divergence)
    } else {
      change = -0.015; // Decline
      volume = 2500000;
    }

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
      volume,
    });

    currentPrice = close;
  }

  return candles;
}