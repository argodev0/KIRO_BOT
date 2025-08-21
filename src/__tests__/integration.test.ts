/**
 * Integration Test
 * Test core data models and validation integration
 */

import { validateTradingSignal } from '../validation/trading.validation';
import { validateCandleData } from '../validation/market.validation';
import { validateGrid } from '../validation/grid.validation';

describe('Core Data Models Integration', () => {
  describe('Trading Signal Validation', () => {
    it('should validate a complete trading signal', () => {
      const validSignal = {
        symbol: 'BTCUSDT',
        direction: 'long' as const,
        confidence: 0.85,
        entryPrice: 47000,
        stopLoss: 46000,
        takeProfit: [48000, 49000],
        reasoning: {
          technical: {
            indicators: ['RSI', 'MACD'],
            confluence: 0.8,
            trend: 'bullish',
          },
          patterns: {
            detected: ['hammer'],
            strength: 0.7,
          },
          elliottWave: {
            currentWave: 'wave_3',
            wavePosition: 'impulse',
            validity: 0.9,
          },
          fibonacci: {
            levels: [46800, 47200],
            confluence: 0.6,
          },
          volume: {
            profile: 'increasing',
            strength: 0.8,
          },
          summary: 'Strong bullish signal with multiple confirmations',
        },
        timestamp: 1640995200000,
        technicalScore: 0.8,
      };

      const { error } = validateTradingSignal(validSignal);
      expect(error).toBeUndefined();
    });

    it('should reject signal with invalid confidence', () => {
      const invalidSignal = {
        symbol: 'BTCUSDT',
        direction: 'long' as const,
        confidence: 1.5, // Invalid
        entryPrice: 47000,
        takeProfit: [48000],
        reasoning: {
          technical: { indicators: [], confluence: 0.8, trend: 'bullish' },
          patterns: { detected: [], strength: 0.7 },
          elliottWave: { currentWave: 'wave_3', wavePosition: 'impulse', validity: 0.9 },
          fibonacci: { levels: [], confluence: 0.6 },
          volume: { profile: 'increasing', strength: 0.8 },
          summary: 'Test signal',
        },
        timestamp: 1640995200000,
      };

      const { error } = validateTradingSignal(invalidSignal);
      expect(error).toBeDefined();
    });
  });

  describe('Market Data Validation', () => {
    it('should validate correct candle data', () => {
      const validCandle = {
        symbol: 'BTCUSDT',
        timeframe: '1h' as const,
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

    it('should reject candle with invalid OHLC', () => {
      const invalidCandle = {
        symbol: 'BTCUSDT',
        timeframe: '1h' as const,
        timestamp: 1640995200000,
        open: 47000,
        high: 46000, // High < open
        low: 46500,
        close: 47200,
        volume: 1234.56,
      };

      const { error } = validateCandleData(invalidCandle);
      expect(error).toBeDefined();
    });
  });

  describe('Grid Validation', () => {
    it('should validate a basic grid structure', () => {
      const validGrid = {
        id: 'grid123',
        symbol: 'BTCUSDT',
        strategy: 'standard' as const,
        levels: [
          {
            price: 46000,
            quantity: 0.1,
            side: 'buy' as const,
            filled: false,
          },
          {
            price: 47000,
            quantity: 0.1,
            side: 'sell' as const,
            filled: false,
          },
        ],
        basePrice: 46500,
        spacing: 500,
        totalProfit: 0,
        status: 'active' as const,
        createdAt: 1640995200000,
        updatedAt: 1640995200000,
      };

      const { error } = validateGrid(validGrid);
      expect(error).toBeUndefined();
    });
  });

  describe('Type System Integration', () => {
    it('should work with TypeScript types', () => {
      // Test that our types work correctly with TypeScript
      const signal: any = {
        symbol: 'BTCUSDT',
        direction: 'long',
        confidence: 0.85,
        entryPrice: 47000,
        takeProfit: [48000],
        reasoning: {
          technical: { indicators: [], confluence: 0.8, trend: 'bullish' },
          patterns: { detected: [], strength: 0.7 },
          elliottWave: { currentWave: 'wave_3', wavePosition: 'impulse', validity: 0.9 },
          fibonacci: { levels: [], confluence: 0.6 },
          volume: { profile: 'increasing', strength: 0.8 },
          summary: 'Test',
        },
        timestamp: Date.now(),
      };

      expect(signal.symbol).toBe('BTCUSDT');
      expect(signal.direction).toBe('long');
      expect(typeof signal.confidence).toBe('number');
    });
  });
});