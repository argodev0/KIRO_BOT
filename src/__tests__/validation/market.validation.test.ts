/**
 * Market Data Validation Tests
 * Unit tests for market data validation schemas
 */

import {
  validateCandleData,
  validateTickerData,
  validateOrderBookData,
  validateTradeData,
  validateMarketContext,
  validateSupportResistanceLevel,
  validateExchangeInfo,
} from '../../validation/market.validation';

describe('Market Data Validation', () => {
  describe('validateCandleData', () => {
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

    it('should validate correct candle data', () => {
      const { error } = validateCandleData(validCandle);
      expect(error).toBeUndefined();
    });

    it('should reject invalid OHLC relationships', () => {
      const invalidCandle = {
        ...validCandle,
        high: 46000, // High less than open/close
      };
      const { error } = validateCandleData(invalidCandle);
      expect(error).toBeDefined();
      expect(error?.details?.[0]?.message).toContain('High must be >= max(open, close)');
    });

    it('should reject negative prices', () => {
      const invalidCandle = {
        ...validCandle,
        open: -100,
      };
      const { error } = validateCandleData(invalidCandle);
      expect(error).toBeDefined();
    });

    it('should reject invalid timeframes', () => {
      const invalidCandle = {
        ...validCandle,
        timeframe: '2h', // Invalid timeframe
      };
      const { error } = validateCandleData(invalidCandle);
      expect(error).toBeDefined();
    });

    it('should reject missing required fields', () => {
      const { symbol, ...incompleteCandle } = validCandle;
      const { error } = validateCandleData(incompleteCandle);
      expect(error).toBeDefined();
      expect(error?.message).toContain('symbol');
    });
  });

  describe('validateTickerData', () => {
    const validTicker = {
      symbol: 'BTCUSDT',
      exchange: 'binance',
      price: 47000,
      volume: 1234.56,
      timestamp: 1640995200000,
      bid: 46999,
      ask: 47001,
      change24h: 500,
      changePercent24h: 1.08,
    };

    it('should validate correct ticker data', () => {
      const { error } = validateTickerData(validTicker);
      expect(error).toBeUndefined();
    });

    it('should reject invalid bid/ask spread', () => {
      const invalidTicker = {
        ...validTicker,
        bid: 47002, // Bid higher than ask
      };
      const { error } = validateTickerData(invalidTicker);
      expect(error).toBeDefined();
      expect(error?.details?.[0]?.message).toContain('Bid must be less than ask');
    });

    it('should allow optional fields to be missing', () => {
      const { change24h, changePercent24h, ...minimalTicker } = validTicker;
      const { error } = validateTickerData(minimalTicker);
      expect(error).toBeUndefined();
    });
  });

  describe('validateOrderBookData', () => {
    const validOrderBook = {
      symbol: 'BTCUSDT',
      exchange: 'binance',
      timestamp: 1640995200000,
      bids: [
        [46999, 1.5],
        [46998, 2.0],
      ],
      asks: [
        [47001, 1.2],
        [47002, 1.8],
      ],
    };

    it('should validate correct order book data', () => {
      const { error } = validateOrderBookData(validOrderBook);
      expect(error).toBeUndefined();
    });

    it('should reject crossed order book', () => {
      const invalidOrderBook = {
        ...validOrderBook,
        bids: [[47005, 1.0]], // Bid higher than lowest ask
      };
      const { error } = validateOrderBookData(invalidOrderBook);
      expect(error).toBeDefined();
      expect(error?.details?.[0]?.message).toContain('Highest bid must be less than lowest ask');
    });

    it('should reject empty bids or asks', () => {
      const invalidOrderBook = {
        ...validOrderBook,
        bids: [],
      };
      const { error } = validateOrderBookData(invalidOrderBook);
      expect(error).toBeDefined();
    });
  });

  describe('validateTradeData', () => {
    const validTrade = {
      symbol: 'BTCUSDT',
      exchange: 'binance',
      timestamp: 1640995200000,
      price: 47000,
      quantity: 0.5,
      side: 'buy',
      tradeId: 'trade123',
    };

    it('should validate correct trade data', () => {
      const { error } = validateTradeData(validTrade);
      expect(error).toBeUndefined();
    });

    it('should reject invalid side', () => {
      const invalidTrade = {
        ...validTrade,
        side: 'invalid',
      };
      const { error } = validateTradeData(invalidTrade);
      expect(error).toBeDefined();
    });
  });

  describe('validateMarketContext', () => {
    const validContext = {
      symbol: 'BTCUSDT',
      timeframe: '1h',
      trend: 'bullish',
      volatility: 'medium',
      volume: 'high',
      marketRegime: 'trending',
    };

    it('should validate correct market context', () => {
      const { error } = validateMarketContext(validContext);
      expect(error).toBeUndefined();
    });

    it('should reject invalid enum values', () => {
      const invalidContext = {
        ...validContext,
        trend: 'invalid',
      };
      const { error } = validateMarketContext(invalidContext);
      expect(error).toBeDefined();
    });
  });

  describe('validateSupportResistanceLevel', () => {
    const validLevel = {
      price: 47000,
      strength: 0.8,
      type: 'support',
      touches: 3,
      lastTouch: 1640995200000,
    };

    it('should validate correct support/resistance level', () => {
      const { error } = validateSupportResistanceLevel(validLevel);
      expect(error).toBeUndefined();
    });

    it('should reject invalid strength values', () => {
      const invalidLevel = {
        ...validLevel,
        strength: 1.5, // Strength > 1
      };
      const { error } = validateSupportResistanceLevel(invalidLevel);
      expect(error).toBeDefined();
    });
  });

  describe('validateExchangeInfo', () => {
    const validExchangeInfo = {
      name: 'binance',
      status: 'online',
      rateLimits: {
        requests: 1200,
        interval: 60000,
      },
      symbols: ['BTCUSDT', 'ETHUSDT'],
      fees: {
        maker: 0.001,
        taker: 0.001,
      },
    };

    it('should validate correct exchange info', () => {
      const { error } = validateExchangeInfo(validExchangeInfo);
      expect(error).toBeUndefined();
    });

    it('should reject invalid status', () => {
      const invalidExchangeInfo = {
        ...validExchangeInfo,
        status: 'invalid',
      };
      const { error } = validateExchangeInfo(invalidExchangeInfo);
      expect(error).toBeDefined();
    });

    it('should reject invalid fee values', () => {
      const invalidExchangeInfo = {
        ...validExchangeInfo,
        fees: {
          maker: 1.5, // Fee > 1 (100%)
          taker: 0.001,
        },
      };
      const { error } = validateExchangeInfo(invalidExchangeInfo);
      expect(error).toBeDefined();
    });
  });
});