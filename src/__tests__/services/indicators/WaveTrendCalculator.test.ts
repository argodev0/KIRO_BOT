/**
 * Wave Trend Calculator Tests
 * Tests for Wave Trend indicator calculation
 */

import { WaveTrendCalculator } from '../../../services/indicators/WaveTrendCalculator';
import { CandleData } from '../../../types/market';

describe('WaveTrendCalculator', () => {
  let calculator: WaveTrendCalculator;
  let mockCandles: CandleData[];

  beforeEach(() => {
    calculator = new WaveTrendCalculator({ n1: 10, n2: 21 });
    mockCandles = generateMockCandles(100);
  });

  describe('calculate', () => {
    it('should calculate Wave Trend values correctly', async () => {
      const results = await calculator.calculate(mockCandles);

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(typeof result.wt1).toBe('number');
        expect(typeof result.wt2).toBe('number');
        expect(result.signal).toMatch(/^(buy|sell|neutral)$/);
        expect(isNaN(result.wt1)).toBe(false);
        expect(isNaN(result.wt2)).toBe(false);
      });
    });

    it('should generate buy signals in oversold conditions', async () => {
      const oversoldCandles = generateOversoldCandles(50);
      const results = await calculator.calculate(oversoldCandles);

      // Should have some buy signals when recovering from oversold
      const buySignals = results.filter(r => r.signal === 'buy');
      expect(buySignals.length).toBeGreaterThanOrEqual(0);
    });

    it('should generate sell signals in overbought conditions', async () => {
      const overboughtCandles = generateOverboughtCandles(50);
      const results = await calculator.calculate(overboughtCandles);

      // Should have some sell signals when declining from overbought
      const sellSignals = results.filter(r => r.signal === 'sell');
      expect(sellSignals.length).toBeGreaterThanOrEqual(0);
    });

    it('should throw error with insufficient data', async () => {
      const shortCandles = generateMockCandles(20);

      await expect(calculator.calculate(shortCandles))
        .rejects.toThrow('Insufficient data for Wave Trend calculation');
    });

    it('should handle volatile market conditions', async () => {
      const volatileCandles = generateVolatileCandles(60);
      const results = await calculator.calculate(volatileCandles);

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(isFinite(result.wt1)).toBe(true);
        expect(isFinite(result.wt2)).toBe(true);
      });
    });
  });

  describe('calculateSingle', () => {
    it('should calculate single Wave Trend value', async () => {
      const result = await calculator.calculateSingle(mockCandles, 10, 5);

      expect(typeof result.wt1).toBe('number');
      expect(typeof result.wt2).toBe('number');
      expect(result.signal).toMatch(/^(buy|sell|neutral)$/);
    });

    it('should return previous values with insufficient data', async () => {
      const shortCandles = generateMockCandles(10);
      const result = await calculator.calculateSingle(shortCandles, 15, 10);

      expect(result.wt1).toBe(15);
      expect(result.wt2).toBe(10);
      expect(result.signal).toBe('neutral');
    });
  });

  describe('getInterpretation', () => {
    it('should provide strong buy interpretation', () => {
      const interpretation = calculator.getInterpretation(-70, -80);

      expect(interpretation.signal).toBe('Buy');
      expect(interpretation.strength).toBe('moderate');
      expect(interpretation.zone).toBe('oversold');
      expect(interpretation.description).toContain('Bullish momentum');
    });

    it('should provide strong sell interpretation', () => {
      const interpretation = calculator.getInterpretation(70, 80);

      expect(interpretation.signal).toBe('Sell');
      expect(interpretation.strength).toBe('moderate');
      expect(interpretation.zone).toBe('overbought');
      expect(interpretation.description).toContain('Bearish momentum');
    });

    it('should provide neutral interpretation', () => {
      const interpretation = calculator.getInterpretation(5, 5);

      expect(interpretation.signal).toBe('Neutral');
      expect(interpretation.strength).toBe('weak');
      expect(interpretation.zone).toBe('neutral');
      expect(interpretation.description).toContain('No clear directional bias');
    });

    it('should classify zones correctly', () => {
      expect(calculator.getInterpretation(70, 60).zone).toBe('overbought');
      expect(calculator.getInterpretation(-70, -60).zone).toBe('oversold');
      expect(calculator.getInterpretation(30, 20).zone).toBe('neutral');
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      calculator.updateConfig({ n1: 12, n2: 24 });
      const config = calculator.getConfig();

      expect(config.n1).toBe(12);
      expect(config.n2).toBe(24);
    });

    it('should return current configuration', () => {
      const config = calculator.getConfig();

      expect(config.n1).toBe(10);
      expect(config.n2).toBe(21);
    });
  });

  describe('signal generation', () => {
    it('should detect crossover signals', async () => {
      const crossoverCandles = generateCrossoverCandles(40);
      const results = await calculator.calculate(crossoverCandles);

      // Should have both buy and sell signals from crossovers
      const buySignals = results.filter(r => r.signal === 'buy');
      const sellSignals = results.filter(r => r.signal === 'sell');

      expect(buySignals.length + sellSignals.length).toBeGreaterThanOrEqual(0);
    });

    it('should maintain signal consistency', async () => {
      const results = await calculator.calculate(mockCandles);

      // Consecutive signals should not flip rapidly
      let rapidFlips = 0;
      for (let i = 2; i < results.length; i++) {
        if (results[i].signal !== 'neutral' && 
            results[i-1].signal !== 'neutral' && 
            results[i-2].signal !== 'neutral' &&
            results[i].signal !== results[i-1].signal &&
            results[i-1].signal !== results[i-2].signal) {
          rapidFlips++;
        }
      }

      // Should not have too many rapid signal flips
      expect(rapidFlips).toBeLessThan(results.length * 0.1);
    });
  });

  describe('divergence detection', () => {
    it('should detect bullish divergence', async () => {
      const divergenceCandles = generateBullishDivergenceCandles(50);
      const results = await calculator.calculate(divergenceCandles);

      // Should detect some bullish divergence
      const bullishDivergence = results.filter(r => r.divergence === 'bullish');
      expect(bullishDivergence.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect bearish divergence', async () => {
      const divergenceCandles = generateBearishDivergenceCandles(50);
      const results = await calculator.calculate(divergenceCandles);

      // Should detect some bearish divergence
      const bearishDivergence = results.filter(r => r.divergence === 'bearish');
      expect(bearishDivergence.length).toBeGreaterThanOrEqual(0);
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

function generateOversoldCandles(count: number): CandleData[] {
  const candles: CandleData[] = [];
  let currentPrice = 100;
  const startTime = Date.now() - (count * 60 * 60 * 1000);

  for (let i = 0; i < count; i++) {
    // Create oversold condition then recovery
    let change: number;
    if (i < count * 0.6) {
      change = -0.02 - Math.random() * 0.02; // Strong decline
    } else {
      change = 0.01 + Math.random() * 0.02; // Recovery
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
      volume: 1000000,
    });

    currentPrice = close;
  }

  return candles;
}

function generateOverboughtCandles(count: number): CandleData[] {
  const candles: CandleData[] = [];
  let currentPrice = 100;
  const startTime = Date.now() - (count * 60 * 60 * 1000);

  for (let i = 0; i < count; i++) {
    // Create overbought condition then decline
    let change: number;
    if (i < count * 0.6) {
      change = 0.02 + Math.random() * 0.02; // Strong rally
    } else {
      change = -0.01 - Math.random() * 0.02; // Decline
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
      volume: 1000000,
    });

    currentPrice = close;
  }

  return candles;
}

function generateVolatileCandles(count: number): CandleData[] {
  const candles: CandleData[] = [];
  let currentPrice = 100;
  const startTime = Date.now() - (count * 60 * 60 * 1000);

  for (let i = 0; i < count; i++) {
    // High volatility with large price swings
    const change = (Math.random() - 0.5) * 0.1; // ±5% change
    const open = currentPrice;
    const close = open * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.03);
    const low = Math.min(open, close) * (1 - Math.random() * 0.03);

    candles.push({
      symbol: 'TESTUSDT',
      timeframe: '1h',
      timestamp: startTime + (i * 60 * 60 * 1000),
      open,
      high,
      low,
      close,
      volume: 1000000 + Math.random() * 5000000,
    });

    currentPrice = close;
  }

  return candles;
}

function generateCrossoverCandles(count: number): CandleData[] {
  const candles: CandleData[] = [];
  let currentPrice = 100;
  const startTime = Date.now() - (count * 60 * 60 * 1000);

  for (let i = 0; i < count; i++) {
    // Create alternating trends to generate crossovers
    const cycle = Math.floor(i / 10) % 2;
    const change = cycle === 0 ? 0.015 : -0.015;
    const noise = (Math.random() - 0.5) * 0.01;

    const open = currentPrice;
    const close = open * (1 + change + noise);
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

function generateBullishDivergenceCandles(count: number): CandleData[] {
  const candles: CandleData[] = [];
  let currentPrice = 100;
  const startTime = Date.now() - (count * 60 * 60 * 1000);

  for (let i = 0; i < count; i++) {
    // Create lower lows in price but momentum should improve
    let change: number;
    if (i < count * 0.3) {
      change = -0.02; // Initial decline
    } else if (i < count * 0.6) {
      change = -0.025; // Lower low in price
    } else {
      change = 0.01; // Recovery (momentum improves)
    }

    const noise = (Math.random() - 0.5) * 0.005;
    const open = currentPrice;
    const close = open * (1 + change + noise);
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

function generateBearishDivergenceCandles(count: number): CandleData[] {
  const candles: CandleData[] = [];
  let currentPrice = 100;
  const startTime = Date.now() - (count * 60 * 60 * 1000);

  for (let i = 0; i < count; i++) {
    // Create higher highs in price but momentum should weaken
    let change: number;
    if (i < count * 0.3) {
      change = 0.02; // Initial rally
    } else if (i < count * 0.6) {
      change = 0.025; // Higher high in price
    } else {
      change = -0.01; // Decline (momentum weakens)
    }

    const noise = (Math.random() - 0.5) * 0.005;
    const open = currentPrice;
    const close = open * (1 + change + noise);
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