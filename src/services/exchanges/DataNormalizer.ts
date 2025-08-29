/**
 * Data Normalizer
 * Normalizes market data from different exchanges to a common format
 */

import { CandleData, TickerData, OrderBookData, TradeData, Timeframe } from '../../types/market';
import { logger } from '../../utils/logger';

export interface NormalizationConfig {
  precision: {
    price: number;
    volume: number;
    percentage: number;
  };
  validation: {
    enabled: boolean;
    strictMode: boolean;
  };
}

export class DataNormalizer {
  private config: NormalizationConfig;

  constructor(config: NormalizationConfig = {
    precision: {
      price: 8,
      volume: 8,
      percentage: 4
    },
    validation: {
      enabled: true,
      strictMode: false
    }
  }) {
    this.config = config;
  }

  /**
   * Normalize ticker data from any exchange
   */
  normalizeTicker(data: any, exchange: string): TickerData {
    try {
      let normalized: TickerData;

      switch (exchange.toLowerCase()) {
        case 'binance':
          normalized = this.normalizeBinanceTicker(data);
          break;
        case 'kucoin':
          normalized = this.normalizeKuCoinTicker(data);
          break;
        default:
          throw new Error(`Unsupported exchange for ticker normalization: ${exchange}`);
      }

      if (this.config.validation.enabled) {
        this.validateTicker(normalized);
      }

      return this.applyPrecision(normalized, 'ticker') as TickerData;
    } catch (error) {
      logger.error(`Failed to normalize ticker data from ${exchange}:`, error);
      throw error;
    }
  }

  /**
   * Normalize candle data from any exchange
   */
  normalizeCandle(data: any, exchange: string, timeframe: Timeframe): CandleData {
    try {
      let normalized: CandleData;

      switch (exchange.toLowerCase()) {
        case 'binance':
          normalized = this.normalizeBinanceCandle(data, timeframe);
          break;
        case 'kucoin':
          normalized = this.normalizeKuCoinCandle(data, timeframe);
          break;
        default:
          throw new Error(`Unsupported exchange for candle normalization: ${exchange}`);
      }

      if (this.config.validation.enabled) {
        this.validateCandle(normalized);
      }

      return this.applyPrecision(normalized, 'candle') as CandleData;
    } catch (error) {
      logger.error(`Failed to normalize candle data from ${exchange}:`, error);
      throw error;
    }
  }

  /**
   * Normalize order book data from any exchange
   */
  normalizeOrderBook(data: any, exchange: string): OrderBookData {
    try {
      let normalized: OrderBookData;

      switch (exchange.toLowerCase()) {
        case 'binance':
          normalized = this.normalizeBinanceOrderBook(data);
          break;
        case 'kucoin':
          normalized = this.normalizeKuCoinOrderBook(data);
          break;
        default:
          throw new Error(`Unsupported exchange for order book normalization: ${exchange}`);
      }

      if (this.config.validation.enabled) {
        this.validateOrderBook(normalized);
      }

      return this.applyPrecision(normalized, 'orderbook') as OrderBookData;
    } catch (error) {
      logger.error(`Failed to normalize order book data from ${exchange}:`, error);
      throw error;
    }
  }

  /**
   * Normalize trade data from any exchange
   */
  normalizeTrade(data: any, exchange: string): TradeData {
    try {
      let normalized: TradeData;

      switch (exchange.toLowerCase()) {
        case 'binance':
          normalized = this.normalizeBinanceTrade(data);
          break;
        case 'kucoin':
          normalized = this.normalizeKuCoinTrade(data);
          break;
        default:
          throw new Error(`Unsupported exchange for trade normalization: ${exchange}`);
      }

      if (this.config.validation.enabled) {
        this.validateTrade(normalized);
      }

      return this.applyPrecision(normalized, 'trade') as TradeData;
    } catch (error) {
      logger.error(`Failed to normalize trade data from ${exchange}:`, error);
      throw error;
    }
  }

  // Private normalization methods for specific exchanges

  private normalizeBinanceTicker(data: any): TickerData {
    return {
      symbol: data.s || data.symbol,
      exchange: 'binance',
      price: parseFloat(data.c || data.price || data.lastPrice),
      volume: parseFloat(data.v || data.volume),
      timestamp: parseInt(data.E || data.closeTime || Date.now()),
      bid: parseFloat(data.b || data.bidPrice || 0),
      ask: parseFloat(data.a || data.askPrice || 0),
      change24h: parseFloat(data.P || data.priceChange || 0),
      changePercent24h: parseFloat(data.p || data.priceChangePercent || 0)
    };
  }

  private normalizeKuCoinTicker(data: any): TickerData {
    const tickerData = data.data || data;
    
    return {
      symbol: data.subject || tickerData.symbol,
      exchange: 'kucoin',
      price: parseFloat(tickerData.price || tickerData.lastPrice),
      volume: parseFloat(tickerData.vol || tickerData.volume),
      timestamp: parseInt(tickerData.time || Date.now()),
      bid: parseFloat(tickerData.bestBid || 0),
      ask: parseFloat(tickerData.bestAsk || 0),
      change24h: parseFloat(tickerData.changePrice || 0),
      changePercent24h: parseFloat(tickerData.changeRate || 0) * 100
    };
  }

  private normalizeBinanceCandle(data: any, timeframe: Timeframe): CandleData {
    const kline = data.k || data;
    
    return {
      symbol: kline.s || kline.symbol,
      timeframe,
      timestamp: parseInt(kline.t || kline.openTime),
      open: parseFloat(kline.o || kline.open),
      high: parseFloat(kline.h || kline.high),
      low: parseFloat(kline.l || kline.low),
      close: parseFloat(kline.c || kline.close),
      volume: parseFloat(kline.v || kline.volume),
      exchange: 'binance'
    };
  }

  private normalizeKuCoinCandle(data: any, timeframe: Timeframe): CandleData {
    const candleData = data.data || data;
    
    return {
      symbol: data.subject?.split('_')[0] || candleData.symbol,
      timeframe,
      timestamp: parseInt(candleData.time || candleData.timestamp) * 1000,
      open: parseFloat(candleData.open),
      high: parseFloat(candleData.high),
      low: parseFloat(candleData.low),
      close: parseFloat(candleData.close),
      volume: parseFloat(candleData.volume),
      exchange: 'kucoin'
    };
  }

  private normalizeBinanceOrderBook(data: any): OrderBookData {
    return {
      symbol: data.s || data.symbol,
      exchange: 'binance',
      timestamp: parseInt(data.E || Date.now()),
      bids: (data.b || data.bids || []).map((bid: any) => [
        parseFloat(Array.isArray(bid) ? bid[0] : bid.price),
        parseFloat(Array.isArray(bid) ? bid[1] : bid.quantity)
      ]),
      asks: (data.a || data.asks || []).map((ask: any) => [
        parseFloat(Array.isArray(ask) ? ask[0] : ask.price),
        parseFloat(Array.isArray(ask) ? ask[1] : ask.quantity)
      ])
    };
  }

  private normalizeKuCoinOrderBook(data: any): OrderBookData {
    const orderBookData = data.data || data;
    
    return {
      symbol: data.subject || orderBookData.symbol,
      exchange: 'kucoin',
      timestamp: parseInt(orderBookData.time || Date.now()),
      bids: (orderBookData.bids || []).map((bid: string[]) => [
        parseFloat(bid[0]),
        parseFloat(bid[1])
      ]),
      asks: (orderBookData.asks || []).map((ask: string[]) => [
        parseFloat(ask[0]),
        parseFloat(ask[1])
      ])
    };
  }

  private normalizeBinanceTrade(data: any): TradeData {
    return {
      symbol: data.s || data.symbol,
      exchange: 'binance',
      timestamp: parseInt(data.T || data.time),
      price: parseFloat(data.p || data.price),
      quantity: parseFloat(data.q || data.qty),
      side: data.m ? 'sell' : 'buy',
      tradeId: (data.t || data.id || Date.now()).toString()
    };
  }

  private normalizeKuCoinTrade(data: any): TradeData {
    const tradeData = data.data || data;
    
    return {
      symbol: data.subject || tradeData.symbol,
      exchange: 'kucoin',
      timestamp: parseInt(tradeData.time),
      price: parseFloat(tradeData.price),
      quantity: parseFloat(tradeData.size),
      side: tradeData.side,
      tradeId: tradeData.tradeId || tradeData.sequence?.toString() || Date.now().toString()
    };
  }

  // Validation methods

  private validateTicker(ticker: TickerData): void {
    if (!ticker.symbol || typeof ticker.symbol !== 'string') {
      throw new Error('Invalid ticker: symbol is required');
    }
    
    if (!ticker.exchange || typeof ticker.exchange !== 'string') {
      throw new Error('Invalid ticker: exchange is required');
    }
    
    if (typeof ticker.price !== 'number' || ticker.price <= 0) {
      throw new Error('Invalid ticker: price must be a positive number');
    }
    
    if (typeof ticker.volume !== 'number' || ticker.volume < 0) {
      throw new Error('Invalid ticker: volume must be a non-negative number');
    }
    
    if (typeof ticker.timestamp !== 'number' || ticker.timestamp <= 0) {
      throw new Error('Invalid ticker: timestamp must be a positive number');
    }
  }

  private validateCandle(candle: CandleData): void {
    if (!candle.symbol || typeof candle.symbol !== 'string') {
      throw new Error('Invalid candle: symbol is required');
    }
    
    if (!candle.timeframe || typeof candle.timeframe !== 'string') {
      throw new Error('Invalid candle: timeframe is required');
    }
    
    const prices = [candle.open, candle.high, candle.low, candle.close];
    if (prices.some(price => typeof price !== 'number' || price <= 0)) {
      throw new Error('Invalid candle: all prices must be positive numbers');
    }
    
    if (candle.high < Math.max(candle.open, candle.close) || 
        candle.low > Math.min(candle.open, candle.close)) {
      throw new Error('Invalid candle: high/low prices are inconsistent');
    }
    
    if (typeof candle.volume !== 'number' || candle.volume < 0) {
      throw new Error('Invalid candle: volume must be a non-negative number');
    }
  }

  private validateOrderBook(orderBook: OrderBookData): void {
    if (!orderBook.symbol || typeof orderBook.symbol !== 'string') {
      throw new Error('Invalid order book: symbol is required');
    }
    
    if (!Array.isArray(orderBook.bids) || !Array.isArray(orderBook.asks)) {
      throw new Error('Invalid order book: bids and asks must be arrays');
    }
    
    // Validate bid/ask format
    for (const bid of orderBook.bids) {
      if (!Array.isArray(bid) || bid.length !== 2 || 
          typeof bid[0] !== 'number' || typeof bid[1] !== 'number') {
        throw new Error('Invalid order book: bid format is incorrect');
      }
    }
    
    for (const ask of orderBook.asks) {
      if (!Array.isArray(ask) || ask.length !== 2 || 
          typeof ask[0] !== 'number' || typeof ask[1] !== 'number') {
        throw new Error('Invalid order book: ask format is incorrect');
      }
    }
  }

  private validateTrade(trade: TradeData): void {
    if (!trade.symbol || typeof trade.symbol !== 'string') {
      throw new Error('Invalid trade: symbol is required');
    }
    
    if (!trade.exchange || typeof trade.exchange !== 'string') {
      throw new Error('Invalid trade: exchange is required');
    }
    
    if (typeof trade.price !== 'number' || trade.price <= 0) {
      throw new Error('Invalid trade: price must be a positive number');
    }
    
    if (typeof trade.quantity !== 'number' || trade.quantity <= 0) {
      throw new Error('Invalid trade: quantity must be a positive number');
    }
    
    if (!['buy', 'sell'].includes(trade.side)) {
      throw new Error('Invalid trade: side must be "buy" or "sell"');
    }
  }

  // Precision application

  private applyPrecision(data: any, type: string): any {
    const result = { ...data };
    
    switch (type) {
      case 'ticker':
        result.price = this.roundToPrecision(result.price, this.config.precision.price);
        result.volume = this.roundToPrecision(result.volume, this.config.precision.volume);
        result.bid = this.roundToPrecision(result.bid, this.config.precision.price);
        result.ask = this.roundToPrecision(result.ask, this.config.precision.price);
        if (result.change24h !== undefined) {
          result.change24h = this.roundToPrecision(result.change24h, this.config.precision.price);
        }
        if (result.changePercent24h !== undefined) {
          result.changePercent24h = this.roundToPrecision(result.changePercent24h, this.config.precision.percentage);
        }
        break;
        
      case 'candle':
        result.open = this.roundToPrecision(result.open, this.config.precision.price);
        result.high = this.roundToPrecision(result.high, this.config.precision.price);
        result.low = this.roundToPrecision(result.low, this.config.precision.price);
        result.close = this.roundToPrecision(result.close, this.config.precision.price);
        result.volume = this.roundToPrecision(result.volume, this.config.precision.volume);
        break;
        
      case 'orderbook':
        result.bids = result.bids.map((bid: [number, number]) => [
          this.roundToPrecision(bid[0], this.config.precision.price),
          this.roundToPrecision(bid[1], this.config.precision.volume)
        ]);
        result.asks = result.asks.map((ask: [number, number]) => [
          this.roundToPrecision(ask[0], this.config.precision.price),
          this.roundToPrecision(ask[1], this.config.precision.volume)
        ]);
        break;
        
      case 'trade':
        result.price = this.roundToPrecision(result.price, this.config.precision.price);
        result.quantity = this.roundToPrecision(result.quantity, this.config.precision.volume);
        break;
    }
    
    return result;
  }

  private roundToPrecision(value: number, precision: number): number {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }
}