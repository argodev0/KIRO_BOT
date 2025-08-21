/**
 * Data Validator Tests
 */

import { DataValidator } from '../../services/DataValidator';
import { CandleData, TickerData, OrderBookData, TradeData } from '../../types/market';

describe('DataValidator', () => {
  let validator: DataValidator;

  beforeEach(() => {
    validator = new DataValidator();
  });

  describe('validateCandle', () => {
    const validCandle: CandleData = {
      symbol: 'BTCUSDT',
      timeframe: '1m',
      timestamp: Date.now() - 60000,
      open: 50000,
      high: 50100,
      low: 49900,
      close: 50050,
      volume: 1.5,
      exchange: 'binance',
    };

    it('should validate correct candle data', () => {
      const result = validator.validateCandle(validCandle);
      expect(result).toBe(true);
    });

    it('should reject candle with missing symbol', () => {
      const invalidCandle = { ...validCandle, symbol: '' };
      const result = validator.validateCandle(invalidCandle);
      expect(result).toBe(false);
    });

    it('should reject candle with invalid prices', () => {
      const invalidCandle = { ...validCandle, open: -100 };
      const result = validator.validateCandle(invalidCandle);
      expect(result).toBe(false);
    });

    it('should reject candle with high < low', () => {
      const invalidCandle = { ...validCandle, high: 49000, low: 50000 };
      const result = validator.validateCandle(invalidCandle);
      expect(result).toBe(false);
    });

    it('should reject candle with invalid OHLC relationships', () => {
      const invalidCandle = { ...validCandle, high: 49000, open: 50000 };
      const result = validator.validateCandle(invalidCandle);
      expect(result).toBe(false);
    });

    it('should reject candle with negative volume', () => {
      const invalidCandle = { ...validCandle, volume: -1 };
      const result = validator.validateCandle(invalidCandle);
      expect(result).toBe(false);
    });

    it('should reject candle with invalid timestamp', () => {
      const invalidCandle = { ...validCandle, timestamp: NaN };
      const result = validator.validateCandle(invalidCandle);
      expect(result).toBe(false);
    });

    it('should reject candle with future timestamp', () => {
      const invalidCandle = { ...validCandle, timestamp: Date.now() + 120000 }; // 2 minutes in future
      const result = validator.validateCandle(invalidCandle);
      expect(result).toBe(false);
    });
  });

  describe('validateCandleDetailed', () => {
    const validCandle: CandleData = {
      symbol: 'BTCUSDT',
      timeframe: '1m',
      timestamp: Date.now() - 60000,
      open: 50000,
      high: 50100,
      low: 49900,
      close: 50050,
      volume: 1.5,
      exchange: 'binance',
    };

    it('should return detailed validation results for valid candle', () => {
      const result = validator.validateCandleDetailed(validCandle);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return detailed errors for invalid candle', () => {
      const invalidCandle = { ...validCandle, symbol: '', open: -100, high: 49000 };
      const result = validator.validateCandleDetailed(invalidCandle);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('Missing or invalid symbol');
      expect(result.errors).toContain('Invalid open price: -100');
    });

    it('should detect suspicious price movements', () => {
      const suspiciousCandle = { 
        ...validCandle, 
        high: 100000, // 100% increase
        low: 25000,   // 50% decrease
      };
      const result = validator.validateCandleDetailed(suspiciousCandle);
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('Suspicious price range'))).toBe(true);
    });

    it('should detect zero price range', () => {
      const flatCandle = { 
        ...validCandle, 
        open: 50000,
        high: 50000,
        low: 50000,
        close: 50000,
      };
      const result = validator.validateCandleDetailed(flatCandle);
      
      expect(result.warnings).toContain('Zero price range - all prices are identical');
    });
  });

  describe('validateTicker', () => {
    const validTicker: TickerData = {
      symbol: 'BTCUSDT',
      exchange: 'binance',
      price: 50000,
      volume: 1000,
      timestamp: Date.now(),
      bid: 49995,
      ask: 50005,
      change24h: 500,
      changePercent24h: 1.0,
    };

    it('should validate correct ticker data', () => {
      const result = validator.validateTicker(validTicker);
      expect(result).toBe(true);
    });

    it('should reject ticker with missing required fields', () => {
      const invalidTicker = { ...validTicker, symbol: '' };
      const result = validator.validateTicker(invalidTicker);
      expect(result).toBe(false);
    });

    it('should reject ticker with invalid prices', () => {
      const invalidTicker = { ...validTicker, price: 0 };
      const result = validator.validateTicker(invalidTicker);
      expect(result).toBe(false);
    });

    it('should reject ticker with ask <= bid', () => {
      const invalidTicker = { ...validTicker, bid: 50000, ask: 49999 };
      const result = validator.validateTicker(invalidTicker);
      expect(result).toBe(false);
    });

    it('should warn about large spreads', () => {
      const largeSpreaTicker = { ...validTicker, bid: 45000, ask: 55000 }; // 20% spread
      const result = validator.validateTickerDetailed(largeSpreaTicker);
      
      expect(result.warnings.some(w => w.includes('Large bid-ask spread'))).toBe(true);
    });

    it('should warn when price is outside bid-ask range', () => {
      const inconsistentTicker = { ...validTicker, price: 60000, bid: 49995, ask: 50005 };
      const result = validator.validateTickerDetailed(inconsistentTicker);
      
      expect(result.warnings).toContain('Price is outside bid-ask range');
    });
  });

  describe('validateOrderBook', () => {
    const validOrderBook: OrderBookData = {
      symbol: 'BTCUSDT',
      exchange: 'binance',
      timestamp: Date.now(),
      bids: [
        [49995, 1.5],
        [49990, 2.0],
        [49985, 1.0],
      ],
      asks: [
        [50005, 1.2],
        [50010, 1.8],
        [50015, 0.5],
      ],
    };

    it('should validate correct order book data', () => {
      const result = validator.validateOrderBook(validOrderBook);
      expect(result).toBe(true);
    });

    it('should reject order book with missing required fields', () => {
      const invalidOrderBook = { ...validOrderBook, symbol: '' };
      const result = validator.validateOrderBook(invalidOrderBook);
      expect(result).toBe(false);
    });

    it('should reject order book with invalid bid/ask arrays', () => {
      const invalidOrderBook = { ...validOrderBook, bids: 'invalid' as any };
      const result = validator.validateOrderBook(invalidOrderBook);
      expect(result).toBe(false);
    });

    it('should reject order book with best bid >= best ask', () => {
      const invalidOrderBook = {
        ...validOrderBook,
        bids: [[50010, 1.0]] as [number, number][],
        asks: [[50005, 1.0]] as [number, number][],
      };
      const result = validator.validateOrderBook(invalidOrderBook);
      expect(result).toBe(false);
    });

    it('should reject order book with incorrect price ordering', () => {
      const invalidOrderBook = {
        ...validOrderBook,
        bids: [
          [49990, 1.5], // Should be descending
          [49995, 2.0],
        ] as [number, number][],
      };
      const result = validator.validateOrderBook(invalidOrderBook);
      expect(result).toBe(false);
    });

    it('should validate individual order book levels', () => {
      const invalidOrderBook = {
        ...validOrderBook,
        bids: [
          [0, 1.5], // Invalid price
          [49990, -1.0], // Invalid quantity
        ] as [number, number][],
      };
      const result = validator.validateOrderBook(invalidOrderBook);
      expect(result).toBe(false);
    });
  });

  describe('validateTrade', () => {
    const validTrade: TradeData = {
      symbol: 'BTCUSDT',
      exchange: 'binance',
      timestamp: Date.now(),
      price: 50000,
      quantity: 1.5,
      side: 'buy',
      tradeId: '12345',
    };

    it('should validate correct trade data', () => {
      const result = validator.validateTrade(validTrade);
      expect(result).toBe(true);
    });

    it('should reject trade with missing required fields', () => {
      const invalidTrade = { ...validTrade, tradeId: '' };
      const result = validator.validateTrade(invalidTrade);
      expect(result).toBe(false);
    });

    it('should reject trade with invalid price', () => {
      const invalidTrade = { ...validTrade, price: 0 };
      const result = validator.validateTrade(invalidTrade);
      expect(result).toBe(false);
    });

    it('should reject trade with invalid quantity', () => {
      const invalidTrade = { ...validTrade, quantity: -1 };
      const result = validator.validateTrade(invalidTrade);
      expect(result).toBe(false);
    });

    it('should reject trade with invalid side', () => {
      const invalidTrade = { ...validTrade, side: 'invalid' as any };
      const result = validator.validateTrade(invalidTrade);
      expect(result).toBe(false);
    });
  });

  describe('validateCandleSequence', () => {
    const baseCandle: CandleData = {
      symbol: 'BTCUSDT',
      timeframe: '1m',
      timestamp: Date.now() - 180000, // 3 minutes ago
      open: 50000,
      high: 50100,
      low: 49900,
      close: 50050,
      volume: 1.5,
      exchange: 'binance',
    };

    it('should validate correct candle sequence', () => {
      const candles = [
        baseCandle,
        { ...baseCandle, timestamp: baseCandle.timestamp + 60000, open: 50050, close: 50100 },
        { ...baseCandle, timestamp: baseCandle.timestamp + 120000, open: 50100, close: 50075 },
      ];

      const result = validator.validateCandleSequence(candles);
      expect(result.isValid).toBe(true);
    });

    it('should detect duplicate timestamps', () => {
      const candles = [
        baseCandle,
        { ...baseCandle }, // Same timestamp
      ];

      const result = validator.validateCandleSequence(candles);
      expect(result.warnings.some(w => w.includes('Duplicate timestamp'))).toBe(true);
    });

    it('should detect large price gaps', () => {
      const candles = [
        baseCandle,
        { 
          ...baseCandle, 
          timestamp: baseCandle.timestamp + 60000, 
          open: 100000, // 100% price jump
          close: 100050 
        },
      ];

      const result = validator.validateCandleSequence(candles);
      expect(result.warnings.some(w => w.includes('Large price gap'))).toBe(true);
    });

    it('should detect missing candles', () => {
      const candles = [
        baseCandle,
        { 
          ...baseCandle, 
          timestamp: baseCandle.timestamp + 300000, // 5 minutes gap for 1m timeframe
          open: 50050, 
          close: 50100 
        },
      ];

      const result = validator.validateCandleSequence(candles);
      expect(result.warnings.some(w => w.includes('Potential missing candle'))).toBe(true);
    });

    it('should handle empty or single candle sequences', () => {
      expect(validator.validateCandleSequence([]).isValid).toBe(true);
      expect(validator.validateCandleSequence([baseCandle]).isValid).toBe(true);
    });
  });

  describe('quality metrics', () => {
    const validCandle: CandleData = {
      symbol: 'BTCUSDT',
      timeframe: '1m',
      timestamp: Date.now() - 60000,
      open: 50000,
      high: 50100,
      low: 49900,
      close: 50050,
      volume: 1.5,
      exchange: 'binance',
    };

    it('should track validation metrics', () => {
      // Validate some candles
      validator.validateCandle(validCandle);
      validator.validateCandle({ ...validCandle, open: -100 }); // Invalid
      validator.validateCandle(validCandle);

      const metrics = validator.getQualityMetrics('candles');
      
      expect(metrics.totalRecords).toBe(3);
      expect(metrics.validRecords).toBe(2);
      expect(metrics.invalidRecords).toBe(1);
      expect(metrics.validationRate).toBeCloseTo(66.67, 1);
    });

    it('should track common errors', () => {
      validator.validateCandle({ ...validCandle, symbol: '' });
      validator.validateCandle({ ...validCandle, symbol: '' });
      validator.validateCandle({ ...validCandle, open: -100 });

      const metrics = validator.getQualityMetrics('candles');
      
      expect((metrics as any).commonErrors['Missing or invalid symbol']).toBe(2);
      expect((metrics as any).commonErrors['Invalid open price: -100']).toBe(1);
    });

    it('should reset metrics', () => {
      validator.validateCandle(validCandle);
      validator.resetQualityMetrics('candles');

      const metrics = validator.getQualityMetrics('candles');
      expect(metrics.totalRecords).toBe(0);
    });

    it('should get all metrics', () => {
      validator.validateCandle(validCandle);
      validator.validateTicker({
        symbol: 'BTCUSDT',
        exchange: 'binance',
        price: 50000,
        volume: 1000,
        timestamp: Date.now(),
        bid: 49995,
        ask: 50005,
      });

      const allMetrics = validator.getQualityMetrics();
      
      expect(allMetrics).toHaveProperty('candles');
      expect(allMetrics).toHaveProperty('tickers');
    });
  });
});