/**
 * Data Normalization Service
 * Standardizes data formats across different exchanges
 */

import { CandleData, TickerData, OrderBookData, TradeData, Timeframe } from '../../types/market';
import { OrderResponse, OrderStatus } from '../../types/trading';

export class DataNormalizer {
  /**
   * Normalize symbol format across exchanges
   */
  static normalizeSymbol(symbol: string, exchange: string): string {
    const cleanSymbol = symbol.replace(/[-_/]/g, '').toUpperCase();
    
    switch (exchange) {
      case 'binance':
        return cleanSymbol;
      case 'kucoin':
        // KuCoin uses dash-separated symbols
        if (cleanSymbol.includes('USDT')) {
          return cleanSymbol.replace('USDT', '-USDT');
        }
        if (cleanSymbol.includes('BTC')) {
          return cleanSymbol.replace('BTC', '-BTC');
        }
        if (cleanSymbol.includes('ETH')) {
          return cleanSymbol.replace('ETH', '-ETH');
        }
        return cleanSymbol;
      default:
        return cleanSymbol;
    }
  }

  /**
   * Normalize timeframe format across exchanges
   */
  static normalizeTimeframe(timeframe: string, exchange: string): string {
    const mapping: Record<string, Record<string, string>> = {
      binance: {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '30m': '30m',
        '1h': '1h',
        '4h': '4h',
        '1d': '1d',
        '1w': '1w',
        '1M': '1M',
      },
      kucoin: {
        '1m': '1min',
        '5m': '5min',
        '15m': '15min',
        '30m': '30min',
        '1h': '1hour',
        '4h': '4hour',
        '1d': '1day',
        '1w': '1week',
      },
    };

    return mapping[exchange]?.[timeframe] || timeframe;
  }

  /**
   * Normalize ticker data
   */
  static normalizeTicker(data: any, exchange: string): TickerData {
    const baseData = {
      exchange,
      timestamp: Date.now(),
    };

    switch (exchange) {
      case 'binance':
        return {
          ...baseData,
          symbol: data.symbol,
          price: this.sanitizeNumeric(data.lastPrice || data.price),
          volume: this.sanitizeNumeric(data.volume),
          timestamp: data.closeTime || data.timestamp || Date.now(),
          bid: this.sanitizeNumeric(data.bidPrice),
          ask: this.sanitizeNumeric(data.askPrice),
          change24h: this.sanitizeNumeric(data.priceChange, 0),
          changePercent24h: this.sanitizeNumeric(data.priceChangePercent, 0),
        };

      case 'kucoin':
        return {
          ...baseData,
          symbol: data.symbol,
          price: this.sanitizeNumeric(data.last || data.price),
          volume: this.sanitizeNumeric(data.vol || data.volume),
          timestamp: data.time || Date.now(),
          bid: this.sanitizeNumeric(data.buy || data.bid),
          ask: this.sanitizeNumeric(data.sell || data.ask),
          change24h: this.sanitizeNumeric(data.changePrice, 0),
          changePercent24h: this.sanitizeNumeric(data.changeRate, 0) * 100,
        };

      default:
        throw new Error(`Unsupported exchange for ticker normalization: ${exchange}`);
    }
  }

  /**
   * Normalize order book data
   */
  static normalizeOrderBook(data: any, exchange: string, symbol: string): OrderBookData {
    const baseData = {
      exchange,
      symbol,
      timestamp: Date.now(),
    };

    switch (exchange) {
      case 'binance':
        return {
          ...baseData,
          timestamp: data.lastUpdateId || Date.now(),
          bids: data.bids.map((bid: string[]) => [parseFloat(bid[0]), parseFloat(bid[1])]),
          asks: data.asks.map((ask: string[]) => [parseFloat(ask[0]), parseFloat(ask[1])]),
        };

      case 'kucoin':
        return {
          ...baseData,
          timestamp: data.time || Date.now(),
          bids: data.bids.map((bid: string[]) => [parseFloat(bid[0]), parseFloat(bid[1])]),
          asks: data.asks.map((ask: string[]) => [parseFloat(ask[0]), parseFloat(ask[1])]),
        };

      default:
        throw new Error(`Unsupported exchange for order book normalization: ${exchange}`);
    }
  }

  /**
   * Normalize candle data
   */
  static normalizeCandle(data: any, exchange: string, symbol: string, timeframe: Timeframe): CandleData {
    const baseData = {
      symbol,
      timeframe,
      exchange,
    };

    switch (exchange) {
      case 'binance':
        // Binance kline format: [timestamp, open, high, low, close, volume, ...]
        if (Array.isArray(data)) {
          return {
            ...baseData,
            timestamp: data[0],
            open: parseFloat(data[1]),
            high: parseFloat(data[2]),
            low: parseFloat(data[3]),
            close: parseFloat(data[4]),
            volume: parseFloat(data[5]),
          };
        }
        // WebSocket format
        return {
          ...baseData,
          timestamp: data.t,
          open: parseFloat(data.o),
          high: parseFloat(data.h),
          low: parseFloat(data.l),
          close: parseFloat(data.c),
          volume: parseFloat(data.v),
        };

      case 'kucoin':
        // KuCoin format: [timestamp, open, close, high, low, volume, turnover]
        if (Array.isArray(data)) {
          return {
            ...baseData,
            timestamp: parseInt(data[0]) * 1000,
            open: parseFloat(data[1]),
            high: parseFloat(data[3]),
            low: parseFloat(data[4]),
            close: parseFloat(data[2]),
            volume: parseFloat(data[5]),
          };
        }
        // WebSocket format
        return {
          ...baseData,
          timestamp: parseInt(data.time) * 1000,
          open: parseFloat(data.open),
          high: parseFloat(data.high),
          low: parseFloat(data.low),
          close: parseFloat(data.close),
          volume: parseFloat(data.volume),
        };

      default:
        throw new Error(`Unsupported exchange for candle normalization: ${exchange}`);
    }
  }

  /**
   * Normalize trade data
   */
  static normalizeTrade(data: any, exchange: string, symbol: string): TradeData {
    const baseData = {
      symbol,
      exchange,
    };

    switch (exchange) {
      case 'binance':
        return {
          ...baseData,
          timestamp: data.T || data.time,
          price: parseFloat(data.p || data.price),
          quantity: parseFloat(data.q || data.qty),
          side: data.m ? 'sell' : 'buy', // m = true means buyer is market maker (sell)
          tradeId: (data.t || data.id).toString(),
        };

      case 'kucoin':
        return {
          ...baseData,
          timestamp: parseInt(data.time),
          price: parseFloat(data.price),
          quantity: parseFloat(data.size),
          side: data.side,
          tradeId: data.tradeId || data.sequence,
        };

      default:
        throw new Error(`Unsupported exchange for trade normalization: ${exchange}`);
    }
  }

  /**
   * Normalize order status
   */
  static normalizeOrderStatus(status: string, exchange: string): OrderStatus {
    const statusMapping: Record<string, Record<string, OrderStatus>> = {
      binance: {
        'NEW': 'new',
        'PARTIALLY_FILLED': 'partially_filled',
        'FILLED': 'filled',
        'CANCELED': 'cancelled',
        'REJECTED': 'rejected',
        'EXPIRED': 'expired',
      },
      kucoin: {
        'active': 'new',
        'done': 'filled',
        'cancel': 'cancelled',
      },
    };

    return statusMapping[exchange]?.[status] || 'new';
  }

  /**
   * Normalize order response
   */
  static normalizeOrderResponse(data: any, exchange: string): OrderResponse {
    const baseData = {
      exchange,
      timestamp: Date.now(),
    };

    switch (exchange) {
      case 'binance':
        return {
          ...baseData,
          orderId: data.orderId.toString(),
          clientOrderId: data.clientOrderId,
          symbol: data.symbol,
          side: data.side.toLowerCase(),
          type: data.type.toLowerCase(),
          quantity: parseFloat(data.origQty || data.quantity),
          price: parseFloat(data.price || '0'),
          status: this.normalizeOrderStatus(data.status, exchange),
          timestamp: data.transactTime || data.time || Date.now(),
        };

      case 'kucoin':
        return {
          ...baseData,
          orderId: data.orderId || data.id,
          clientOrderId: data.clientOid,
          symbol: data.symbol,
          side: data.side,
          type: data.type,
          quantity: parseFloat(data.size || data.quantity),
          price: parseFloat(data.price || '0'),
          status: this.normalizeOrderStatus(data.isActive ? 'active' : 'done', exchange),
          timestamp: data.createdAt || Date.now(),
        };

      default:
        throw new Error(`Unsupported exchange for order response normalization: ${exchange}`);
    }
  }

  /**
   * Validate and sanitize numeric values
   */
  static sanitizeNumeric(value: any, defaultValue: number = 0): number {
    const parsed = parseFloat(value);
    return isNaN(parsed) || !isFinite(parsed) ? defaultValue : parsed;
  }

  /**
   * Validate timestamp and convert to milliseconds
   */
  static normalizeTimestamp(timestamp: any, exchange: string): number {
    if (!timestamp) return Date.now();
    
    const ts = parseInt(timestamp);
    
    // KuCoin timestamps are in seconds, convert to milliseconds
    if (exchange === 'kucoin' && ts < 1e12) {
      return ts * 1000;
    }
    
    return ts;
  }

  /**
   * Validate and normalize symbol pair
   */
  static validateSymbol(symbol: string): boolean {
    const upperSymbol = symbol.toUpperCase();
    
    // Should not be just numbers or too short
    if (/^\d+$/.test(upperSymbol) || upperSymbol.length < 6) {
      return false;
    }
    
    // Check for valid trading pair patterns
    const patterns = [
      /^[A-Z0-9]{3,10}[-_/][A-Z0-9]{3,10}$/, // With separator (BTC-USDT, ETH_BTC)
      /^[A-Z0-9]{3,10}(USDT|USDC|BTC|ETH|BNB|BUSD)$/, // Common quote currencies
    ];
    
    return patterns.some(pattern => pattern.test(upperSymbol));
  }

  /**
   * Extract base and quote currencies from symbol
   */
  static parseSymbol(symbol: string): { base: string; quote: string } {
    const cleanSymbol = symbol.replace(/[-_]/g, '');
    
    // Common quote currencies
    const quotes = ['USDT', 'USDC', 'BTC', 'ETH', 'BNB', 'BUSD'];
    
    for (const quote of quotes) {
      if (cleanSymbol.endsWith(quote)) {
        return {
          base: cleanSymbol.slice(0, -quote.length),
          quote: quote,
        };
      }
    }
    
    // Fallback: assume last 3-4 characters are quote
    const quoteLength = cleanSymbol.length > 6 ? 4 : 3;
    return {
      base: cleanSymbol.slice(0, -quoteLength),
      quote: cleanSymbol.slice(-quoteLength),
    };
  }
}