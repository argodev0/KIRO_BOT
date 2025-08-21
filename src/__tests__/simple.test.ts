/**
 * Simple Test
 * Basic test to verify Jest setup and TypeScript compilation
 */

import { validateCandleData } from '../validation/market.validation';

describe('Simple Tests', () => {
  it('should validate a correct candle', () => {
    const validCandle = {
      symbol: 'BTCUSDT',
      timeframe: '1h',
      timestamp: 1640995200000,
      open: 47000,
      high: 47500,
      low: 46500,
      close: 47200,
      volume: 1234.56,
    };

    const { error } = validateCandleData(validCandle);
    expect(error).toBeUndefined();
  });

  it('should reject invalid candle data', () => {
    const invalidCandle = {
      symbol: 'BTCUSDT',
      timeframe: '1h',
      timestamp: 1640995200000,
      open: 47000,
      high: 46000, // High less than open
      low: 46500,
      close: 47200,
      volume: 1234.56,
    };

    const { error } = validateCandleData(invalidCandle);
    expect(error).toBeDefined();
  });

  it('should work with basic math', () => {
    expect(2 + 2).toBe(4);
  });
});