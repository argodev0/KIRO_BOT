/**
 * Data Normalizer Tests
 * Tests for data normalization across exchanges
 */

import { DataNormalizer } from '../../../services/exchanges/DataNormalizer';
import { Timeframe } from '../../../types/market';

describe('DataNormalizer', () => {
  describe('Symbol Normalization', () => {
    it('should normalize symbols for Binance', () => {
      expect(DataNormalizer.normalizeSymbol('BTC-USDT', 'binance')).toBe('BTCUSDT');
      expect(DataNormalizer.normalizeSymbol('btc_usdt', 'binance')).toBe('BTCUSDT');
      expect(DataNormalizer.normalizeSymbol('ETH/USDT', 'binance')).toBe('ETHUSDT');
    });

    it('should normalize symbols for KuCoin', () => {
      expect(DataNormalizer.normalizeSymbol('BTCUSDT', 'kucoin')).toBe('BTC-USDT');
      expect(DataNormalizer.normalizeSymbol('ETHUSDT', 'kucoin')).toBe('ETH-USDT');
      expect(DataNormalizer.normalizeSymbol('ADABTC', 'kucoin')).toBe('ADA-BTC');
    });

    it('should validate symbol format', () => {
      expect(DataNormalizer.validateSymbol('BTCUSDT')).toBe(true);
      expect(DataNormalizer.validateSymbol('BTC-USDT')).toBe(true);
      expect(DataNormalizer.validateSymbol('BTC_USDT')).toBe(true);
      expect(DataNormalizer.validateSymbol('INVALID')).toBe(false); // Too short
      expect(DataNormalizer.validateSymbol('123')).toBe(false); // Too short and only numbers
      expect(DataNormalizer.validateSymbol('123456')).toBe(false); // Only numbers
      expect(DataNormalizer.validateSymbol('AB')).toBe(false); // Too short
    });

    it('should parse symbol into base and quote', () => {
      expect(DataNormalizer.parseSymbol('BTCUSDT')).toEqual({
        base: 'BTC',
        quote: 'USDT',
      });
      
      expect(DataNormalizer.parseSymbol('ETH-BTC')).toEqual({
        base: 'ETH',
        quote: 'BTC',
      });
      
      expect(DataNormalizer.parseSymbol('ADA_USDC')).toEqual({
        base: 'ADA',
        quote: 'USDC',
      });
    });
  });

  describe('Timeframe Normalization', () => {
    it('should normalize timeframes for Binance', () => {
      expect(DataNormalizer.normalizeTimeframe('1m', 'binance')).toBe('1m');
      expect(DataNormalizer.normalizeTimeframe('1h', 'binance')).toBe('1h');
      expect(DataNormalizer.normalizeTimeframe('1d', 'binance')).toBe('1d');
    });

    it('should normalize timeframes for KuCoin', () => {
      expect(DataNormalizer.normalizeTimeframe('1m', 'kucoin')).toBe('1min');
      expect(DataNormalizer.normalizeTimeframe('1h', 'kucoin')).toBe('1hour');
      expect(DataNormalizer.normalizeTimeframe('1d', 'kucoin')).toBe('1day');
    });
  });

  describe('Ticker Data Normalization', () => {
    it('should normalize Binance ticker data', () => {
      const binanceData = {
        symbol: 'BTCUSDT',
        lastPrice: '50000.00',
        volume: '1000.00',
        closeTime: 1640995200000,
        bidPrice: '49999.00',
        askPrice: '50001.00',
        priceChange: '500.00',
        priceChangePercent: '1.00',
      };

      const normalized = DataNormalizer.normalizeTicker(binanceData, 'binance');

      expect(normalized).toEqual({
        symbol: 'BTCUSDT',
        exchange: 'binance',
        price: 50000,
        volume: 1000,
        timestamp: 1640995200000,
        bid: 49999,
        ask: 50001,
        change24h: 500,
        changePercent24h: 1,
      });
    });

    it('should normalize KuCoin ticker data', () => {
      const kucoinData = {
        symbol: 'BTC-USDT',
        last: '50000.00',
        vol: '1000.00',
        time: 1640995200000,
        buy: '49999.00',
        sell: '50001.00',
        changePrice: '500.00',
        changeRate: '0.01',
      };

      const normalized = DataNormalizer.normalizeTicker(kucoinData, 'kucoin');

      expect(normalized).toEqual({
        symbol: 'BTC-USDT',
        exchange: 'kucoin',
        price: 50000,
        volume: 1000,
        timestamp: 1640995200000,
        bid: 49999,
        ask: 50001,
        change24h: 500,
        changePercent24h: 1,
      });
    });

    it('should handle missing ticker fields gracefully', () => {
      const incompleteData = {
        symbol: 'BTCUSDT',
        lastPrice: '50000.00',
        // Missing other fields
      };

      const normalized = DataNormalizer.normalizeTicker(incompleteData, 'binance');

      expect(normalized.symbol).toBe('BTCUSDT');
      expect(normalized.price).toBe(50000);
      expect(normalized.volume).toBe(0); // Default value
      expect(normalized.exchange).toBe('binance');
    });
  });

  describe('Order Book Data Normalization', () => {
    it('should normalize Binance order book data', () => {
      const binanceData = {
        lastUpdateId: 123456,
        bids: [['49999.00', '1.00'], ['49998.00', '2.00']],
        asks: [['50001.00', '1.50'], ['50002.00', '2.50']],
      };

      const normalized = DataNormalizer.normalizeOrderBook(binanceData, 'binance', 'BTCUSDT');

      expect(normalized).toEqual({
        symbol: 'BTCUSDT',
        exchange: 'binance',
        timestamp: 123456,
        bids: [[49999, 1], [49998, 2]],
        asks: [[50001, 1.5], [50002, 2.5]],
      });
    });

    it('should normalize KuCoin order book data', () => {
      const kucoinData = {
        time: 1640995200000,
        bids: [['49999.00', '1.00'], ['49998.00', '2.00']],
        asks: [['50001.00', '1.50'], ['50002.00', '2.50']],
      };

      const normalized = DataNormalizer.normalizeOrderBook(kucoinData, 'kucoin', 'BTC-USDT');

      expect(normalized).toEqual({
        symbol: 'BTC-USDT',
        exchange: 'kucoin',
        timestamp: 1640995200000,
        bids: [[49999, 1], [49998, 2]],
        asks: [[50001, 1.5], [50002, 2.5]],
      });
    });
  });

  describe('Candle Data Normalization', () => {
    it('should normalize Binance candle data (array format)', () => {
      const binanceData = [1640995200000, '50000.00', '51000.00', '49000.00', '50500.00', '100.00'];

      const normalized = DataNormalizer.normalizeCandle(binanceData, 'binance', 'BTCUSDT', '1h' as Timeframe);

      expect(normalized).toEqual({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        exchange: 'binance',
        timestamp: 1640995200000,
        open: 50000,
        high: 51000,
        low: 49000,
        close: 50500,
        volume: 100,
      });
    });

    it('should normalize Binance candle data (WebSocket format)', () => {
      const binanceData = {
        t: 1640995200000,
        o: '50000.00',
        h: '51000.00',
        l: '49000.00',
        c: '50500.00',
        v: '100.00',
      };

      const normalized = DataNormalizer.normalizeCandle(binanceData, 'binance', 'BTCUSDT', '1h' as Timeframe);

      expect(normalized).toEqual({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        exchange: 'binance',
        timestamp: 1640995200000,
        open: 50000,
        high: 51000,
        low: 49000,
        close: 50500,
        volume: 100,
      });
    });

    it('should normalize KuCoin candle data (array format)', () => {
      const kucoinData = ['1640995200', '50000.00', '50500.00', '51000.00', '49000.00', '100.00', '5000000.00'];

      const normalized = DataNormalizer.normalizeCandle(kucoinData, 'kucoin', 'BTC-USDT', '1h' as Timeframe);

      expect(normalized).toEqual({
        symbol: 'BTC-USDT',
        timeframe: '1h',
        exchange: 'kucoin',
        timestamp: 1640995200000,
        open: 50000,
        high: 51000,
        low: 49000,
        close: 50500,
        volume: 100,
      });
    });

    it('should normalize KuCoin candle data (WebSocket format)', () => {
      const kucoinData = {
        time: '1640995200',
        open: '50000.00',
        close: '50500.00',
        high: '51000.00',
        low: '49000.00',
        volume: '100.00',
      };

      const normalized = DataNormalizer.normalizeCandle(kucoinData, 'kucoin', 'BTC-USDT', '1h' as Timeframe);

      expect(normalized).toEqual({
        symbol: 'BTC-USDT',
        timeframe: '1h',
        exchange: 'kucoin',
        timestamp: 1640995200000,
        open: 50000,
        high: 51000,
        low: 49000,
        close: 50500,
        volume: 100,
      });
    });
  });

  describe('Trade Data Normalization', () => {
    it('should normalize Binance trade data', () => {
      const binanceData = {
        T: 1640995200000,
        p: '50000.00',
        q: '0.001',
        m: false, // buyer is not market maker (buy order)
        t: 123456,
      };

      const normalized = DataNormalizer.normalizeTrade(binanceData, 'binance', 'BTCUSDT');

      expect(normalized).toEqual({
        symbol: 'BTCUSDT',
        exchange: 'binance',
        timestamp: 1640995200000,
        price: 50000,
        quantity: 0.001,
        side: 'buy',
        tradeId: '123456',
      });
    });

    it('should normalize KuCoin trade data', () => {
      const kucoinData = {
        time: '1640995200000',
        price: '50000.00',
        size: '0.001',
        side: 'buy',
        tradeId: 'trade123',
      };

      const normalized = DataNormalizer.normalizeTrade(kucoinData, 'kucoin', 'BTC-USDT');

      expect(normalized).toEqual({
        symbol: 'BTC-USDT',
        exchange: 'kucoin',
        timestamp: 1640995200000,
        price: 50000,
        quantity: 0.001,
        side: 'buy',
        tradeId: 'trade123',
      });
    });
  });

  describe('Order Status Normalization', () => {
    it('should normalize Binance order statuses', () => {
      expect(DataNormalizer.normalizeOrderStatus('NEW', 'binance')).toBe('new');
      expect(DataNormalizer.normalizeOrderStatus('PARTIALLY_FILLED', 'binance')).toBe('partially_filled');
      expect(DataNormalizer.normalizeOrderStatus('FILLED', 'binance')).toBe('filled');
      expect(DataNormalizer.normalizeOrderStatus('CANCELED', 'binance')).toBe('cancelled');
      expect(DataNormalizer.normalizeOrderStatus('REJECTED', 'binance')).toBe('rejected');
      expect(DataNormalizer.normalizeOrderStatus('EXPIRED', 'binance')).toBe('expired');
    });

    it('should normalize KuCoin order statuses', () => {
      expect(DataNormalizer.normalizeOrderStatus('active', 'kucoin')).toBe('new');
      expect(DataNormalizer.normalizeOrderStatus('done', 'kucoin')).toBe('filled');
      expect(DataNormalizer.normalizeOrderStatus('cancel', 'kucoin')).toBe('cancelled');
    });

    it('should handle unknown statuses', () => {
      expect(DataNormalizer.normalizeOrderStatus('UNKNOWN', 'binance')).toBe('new');
      expect(DataNormalizer.normalizeOrderStatus('UNKNOWN', 'kucoin')).toBe('new');
    });
  });

  describe('Utility Functions', () => {
    it('should sanitize numeric values', () => {
      expect(DataNormalizer.sanitizeNumeric('123.45')).toBe(123.45);
      expect(DataNormalizer.sanitizeNumeric('invalid')).toBe(0);
      expect(DataNormalizer.sanitizeNumeric(null)).toBe(0);
      expect(DataNormalizer.sanitizeNumeric(undefined)).toBe(0);
      expect(DataNormalizer.sanitizeNumeric(Infinity)).toBe(0);
      expect(DataNormalizer.sanitizeNumeric(NaN)).toBe(0);
      expect(DataNormalizer.sanitizeNumeric('invalid', 100)).toBe(100);
    });

    it('should normalize timestamps', () => {
      // Binance timestamp (milliseconds)
      expect(DataNormalizer.normalizeTimestamp(1640995200000, 'binance')).toBe(1640995200000);
      
      // KuCoin timestamp (seconds)
      expect(DataNormalizer.normalizeTimestamp(1640995200, 'kucoin')).toBe(1640995200000);
      
      // KuCoin timestamp (already in milliseconds)
      expect(DataNormalizer.normalizeTimestamp(1640995200000, 'kucoin')).toBe(1640995200000);
      
      // Invalid timestamp
      expect(DataNormalizer.normalizeTimestamp(null, 'binance')).toBeGreaterThan(0);
      expect(DataNormalizer.normalizeTimestamp(undefined, 'kucoin')).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw errors for unsupported exchanges', () => {
      expect(() => {
        DataNormalizer.normalizeTicker({}, 'unsupported');
      }).toThrow('Unsupported exchange for ticker normalization: unsupported');

      expect(() => {
        DataNormalizer.normalizeOrderBook({}, 'unsupported', 'BTCUSDT');
      }).toThrow('Unsupported exchange for order book normalization: unsupported');

      expect(() => {
        DataNormalizer.normalizeCandle({}, 'unsupported', 'BTCUSDT', '1h' as Timeframe);
      }).toThrow('Unsupported exchange for candle normalization: unsupported');

      expect(() => {
        DataNormalizer.normalizeTrade({}, 'unsupported', 'BTCUSDT');
      }).toThrow('Unsupported exchange for trade normalization: unsupported');

      expect(() => {
        DataNormalizer.normalizeOrderResponse({}, 'unsupported');
      }).toThrow('Unsupported exchange for order response normalization: unsupported');
    });
  });
});