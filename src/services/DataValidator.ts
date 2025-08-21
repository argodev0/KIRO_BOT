/**
 * Data Validator
 * Validates and ensures quality of market data
 */

import { CandleData, TickerData, OrderBookData, TradeData } from '../types/market';
import { logger } from '../utils/logger';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DataQualityMetrics {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  validationRate: number;
  commonErrors: Record<string, number>;
}

export class DataValidator {
  private qualityMetrics: Map<string, DataQualityMetrics> = new Map();
  private readonly MAX_PRICE_CHANGE_PERCENT = 50; // 50% max price change between candles
  private readonly MIN_VOLUME = 0;
  private readonly MAX_SPREAD_PERCENT = 10; // 10% max bid-ask spread

  /**
   * Validate candle data
   */
  validateCandle(candle: CandleData): boolean {
    const result = this.validateCandleDetailed(candle);
    this.updateQualityMetrics('candles', result);
    
    if (!result.isValid) {
      logger.debug(`Invalid candle data for ${candle.symbol}:`, result.errors);
    }
    
    return result.isValid;
  }

  /**
   * Detailed candle validation with error reporting
   */
  validateCandleDetailed(candle: CandleData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!candle.symbol || typeof candle.symbol !== 'string') {
      errors.push('Missing or invalid symbol');
    }

    if (!candle.timeframe || typeof candle.timeframe !== 'string') {
      errors.push('Missing or invalid timeframe');
    }

    if (!candle.timestamp || !this.isValidTimestamp(candle.timestamp)) {
      errors.push('Missing or invalid timestamp');
    }

    // OHLCV validation
    const prices = [candle.open, candle.high, candle.low, candle.close];
    const priceFields = ['open', 'high', 'low', 'close'];

    for (let i = 0; i < prices.length; i++) {
      const price = prices[i];
      const field = priceFields[i];

      if (!this.isValidPrice(price)) {
        errors.push(`Invalid ${field} price: ${price}`);
      }
    }

    if (!this.isValidVolume(candle.volume)) {
      errors.push(`Invalid volume: ${candle.volume}`);
    }

    // OHLC relationship validation
    if (prices.every(p => this.isValidPrice(p))) {
      if (candle.high < candle.low) {
        errors.push('High price is less than low price');
      }

      if (candle.high < candle.open || candle.high < candle.close) {
        errors.push('High price is less than open or close price');
      }

      if (candle.low > candle.open || candle.low > candle.close) {
        errors.push('Low price is greater than open or close price');
      }

      // Check for suspicious price movements
      const priceRange = candle.high - candle.low;
      const avgPrice = (candle.open + candle.close) / 2;
      const rangePercent = (priceRange / avgPrice) * 100;

      if (rangePercent > this.MAX_PRICE_CHANGE_PERCENT) {
        warnings.push(`Suspicious price range: ${rangePercent.toFixed(2)}%`);
      }

      // Check for zero price range (potential data issue)
      if (priceRange === 0) {
        warnings.push('Zero price range - all prices are identical');
      }
    }

    // Volume validation
    if (candle.volume < this.MIN_VOLUME) {
      warnings.push(`Very low volume: ${candle.volume}`);
    }

    // Timestamp validation
    if (candle.timestamp > Date.now() + 60000) { // 1 minute future tolerance
      warnings.push('Timestamp is in the future');
    }

    const isValid = errors.length === 0;
    return { isValid, errors, warnings };
  }

  /**
   * Validate ticker data
   */
  validateTicker(ticker: TickerData): boolean {
    const result = this.validateTickerDetailed(ticker);
    this.updateQualityMetrics('tickers', result);
    
    if (!result.isValid) {
      logger.debug(`Invalid ticker data for ${ticker.symbol}:`, result.errors);
    }
    
    return result.isValid;
  }

  /**
   * Detailed ticker validation
   */
  validateTickerDetailed(ticker: TickerData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!ticker.symbol || typeof ticker.symbol !== 'string') {
      errors.push('Missing or invalid symbol');
    }

    if (!ticker.exchange || typeof ticker.exchange !== 'string') {
      errors.push('Missing or invalid exchange');
    }

    if (!this.isValidTimestamp(ticker.timestamp)) {
      errors.push('Missing or invalid timestamp');
    }

    // Price validation
    if (!this.isValidPrice(ticker.price)) {
      errors.push(`Invalid price: ${ticker.price}`);
    }

    if (!this.isValidPrice(ticker.bid)) {
      errors.push(`Invalid bid price: ${ticker.bid}`);
    }

    if (!this.isValidPrice(ticker.ask)) {
      errors.push(`Invalid ask price: ${ticker.ask}`);
    }

    if (!this.isValidVolume(ticker.volume)) {
      errors.push(`Invalid volume: ${ticker.volume}`);
    }

    // Bid-ask spread validation
    if (this.isValidPrice(ticker.bid) && this.isValidPrice(ticker.ask)) {
      if (ticker.ask <= ticker.bid) {
        errors.push('Ask price is less than or equal to bid price');
      }

      const spread = ticker.ask - ticker.bid;
      const spreadPercent = (spread / ticker.price) * 100;

      if (spreadPercent > this.MAX_SPREAD_PERCENT) {
        warnings.push(`Large bid-ask spread: ${spreadPercent.toFixed(2)}%`);
      }
    }

    // Price consistency validation
    if (this.isValidPrice(ticker.price) && this.isValidPrice(ticker.bid) && this.isValidPrice(ticker.ask)) {
      if (ticker.price < ticker.bid || ticker.price > ticker.ask) {
        warnings.push('Price is outside bid-ask range');
      }
    }

    const isValid = errors.length === 0;
    return { isValid, errors, warnings };
  }

  /**
   * Validate order book data
   */
  validateOrderBook(orderBook: OrderBookData): boolean {
    const result = this.validateOrderBookDetailed(orderBook);
    this.updateQualityMetrics('orderbooks', result);
    
    if (!result.isValid) {
      logger.debug(`Invalid order book data for ${orderBook.symbol}:`, result.errors);
    }
    
    return result.isValid;
  }

  /**
   * Detailed order book validation
   */
  validateOrderBookDetailed(orderBook: OrderBookData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!orderBook.symbol || typeof orderBook.symbol !== 'string') {
      errors.push('Missing or invalid symbol');
    }

    if (!orderBook.exchange || typeof orderBook.exchange !== 'string') {
      errors.push('Missing or invalid exchange');
    }

    if (!this.isValidTimestamp(orderBook.timestamp)) {
      errors.push('Missing or invalid timestamp');
    }

    // Bids and asks validation
    if (!Array.isArray(orderBook.bids)) {
      errors.push('Bids is not an array');
    } else {
      const bidErrors = this.validateOrderBookSide(orderBook.bids, 'bids');
      errors.push(...bidErrors);
    }

    if (!Array.isArray(orderBook.asks)) {
      errors.push('Asks is not an array');
    } else {
      const askErrors = this.validateOrderBookSide(orderBook.asks, 'asks');
      errors.push(...askErrors);
    }

    // Cross-validation between bids and asks
    if (Array.isArray(orderBook.bids) && Array.isArray(orderBook.asks) && 
        orderBook.bids.length > 0 && orderBook.asks.length > 0) {
      
      const bestBid = orderBook.bids[0][0];
      const bestAsk = orderBook.asks[0][0];

      if (bestBid >= bestAsk) {
        errors.push('Best bid is greater than or equal to best ask');
      }

      // Check for reasonable spread
      const spread = bestAsk - bestBid;
      const spreadPercent = (spread / bestBid) * 100;

      if (spreadPercent > this.MAX_SPREAD_PERCENT) {
        warnings.push(`Large spread: ${spreadPercent.toFixed(2)}%`);
      }
    }

    const isValid = errors.length === 0;
    return { isValid, errors, warnings };
  }

  /**
   * Validate trade data
   */
  validateTrade(trade: TradeData): boolean {
    const result = this.validateTradeDetailed(trade);
    this.updateQualityMetrics('trades', result);
    
    if (!result.isValid) {
      logger.debug(`Invalid trade data for ${trade.symbol}:`, result.errors);
    }
    
    return result.isValid;
  }

  /**
   * Detailed trade validation
   */
  validateTradeDetailed(trade: TradeData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!trade.symbol || typeof trade.symbol !== 'string') {
      errors.push('Missing or invalid symbol');
    }

    if (!trade.exchange || typeof trade.exchange !== 'string') {
      errors.push('Missing or invalid exchange');
    }

    if (!trade.tradeId || typeof trade.tradeId !== 'string') {
      errors.push('Missing or invalid trade ID');
    }

    if (!this.isValidTimestamp(trade.timestamp)) {
      errors.push('Missing or invalid timestamp');
    }

    // Price and quantity validation
    if (!this.isValidPrice(trade.price)) {
      errors.push(`Invalid price: ${trade.price}`);
    }

    if (!this.isValidQuantity(trade.quantity)) {
      errors.push(`Invalid quantity: ${trade.quantity}`);
    }

    // Side validation
    if (!trade.side || !['buy', 'sell'].includes(trade.side)) {
      errors.push(`Invalid side: ${trade.side}`);
    }

    const isValid = errors.length === 0;
    return { isValid, errors, warnings };
  }

  /**
   * Validate sequence of candles for consistency
   */
  validateCandleSequence(candles: CandleData[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (candles.length < 2) {
      return { isValid: true, errors, warnings };
    }

    // Sort by timestamp
    const sortedCandles = [...candles].sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 1; i < sortedCandles.length; i++) {
      const prev = sortedCandles[i - 1];
      const curr = sortedCandles[i];

      // Check for duplicate timestamps
      if (prev.timestamp === curr.timestamp) {
        warnings.push(`Duplicate timestamp at ${new Date(curr.timestamp).toISOString()}`);
      }

      // Check for reasonable price continuity
      const priceChange = Math.abs(curr.open - prev.close) / prev.close;
      if (priceChange > this.MAX_PRICE_CHANGE_PERCENT / 100) {
        warnings.push(`Large price gap between candles: ${(priceChange * 100).toFixed(2)}%`);
      }

      // Check for missing candles (gaps in time)
      const timeframe = this.parseTimeframe(curr.timeframe);
      const expectedNextTime = prev.timestamp + timeframe;
      const timeDiff = Math.abs(curr.timestamp - expectedNextTime);
      
      if (timeDiff > timeframe * 0.1) { // 10% tolerance
        warnings.push(`Potential missing candle between ${new Date(prev.timestamp).toISOString()} and ${new Date(curr.timestamp).toISOString()}`);
      }
    }

    const isValid = errors.length === 0;
    return { isValid, errors, warnings };
  }

  /**
   * Get data quality metrics
   */
  getQualityMetrics(dataType?: string): DataQualityMetrics | Record<string, DataQualityMetrics> {
    if (dataType) {
      return this.qualityMetrics.get(dataType) || this.createEmptyMetrics();
    }
    
    const allMetrics: Record<string, DataQualityMetrics> = {};
    for (const [type, metrics] of this.qualityMetrics.entries()) {
      allMetrics[type] = metrics;
    }
    
    return allMetrics;
  }

  /**
   * Reset quality metrics
   */
  resetQualityMetrics(dataType?: string): void {
    if (dataType) {
      this.qualityMetrics.delete(dataType);
    } else {
      this.qualityMetrics.clear();
    }
  }

  // Private helper methods
  private isValidPrice(price: any): boolean {
    return typeof price === 'number' && 
           !isNaN(price) && 
           isFinite(price) && 
           price > 0;
  }

  private isValidVolume(volume: any): boolean {
    return typeof volume === 'number' && 
           !isNaN(volume) && 
           isFinite(volume) && 
           volume >= 0;
  }

  private isValidQuantity(quantity: any): boolean {
    return typeof quantity === 'number' && 
           !isNaN(quantity) && 
           isFinite(quantity) && 
           quantity > 0;
  }

  private isValidTimestamp(timestamp: any): boolean {
    if (typeof timestamp !== 'number') return false;
    
    const date = new Date(timestamp);
    return !isNaN(date.getTime()) && 
           timestamp > 0 && 
           timestamp <= Date.now() + 60000; // 1 minute future tolerance
  }

  private validateOrderBookSide(side: [number, number][], sideName: string): string[] {
    const errors: string[] = [];

    for (let i = 0; i < side.length; i++) {
      const level = side[i];

      if (!Array.isArray(level) || level.length !== 2) {
        errors.push(`Invalid ${sideName} level format at index ${i}`);
        continue;
      }

      const [price, quantity] = level;

      if (!this.isValidPrice(price)) {
        errors.push(`Invalid ${sideName} price at index ${i}: ${price}`);
      }

      if (!this.isValidQuantity(quantity)) {
        errors.push(`Invalid ${sideName} quantity at index ${i}: ${quantity}`);
      }

      // Check price ordering (bids descending, asks ascending)
      if (i > 0) {
        const prevPrice = side[i - 1][0];
        if (sideName === 'bids' && price >= prevPrice) {
          errors.push(`${sideName} prices not in descending order at index ${i}`);
        } else if (sideName === 'asks' && price <= prevPrice) {
          errors.push(`${sideName} prices not in ascending order at index ${i}`);
        }
      }
    }

    return errors;
  }

  private parseTimeframe(timeframe: string): number {
    const timeframeMap: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
    };

    return timeframeMap[timeframe] || 60 * 1000; // Default to 1 minute
  }

  private updateQualityMetrics(dataType: string, result: ValidationResult): void {
    let metrics = this.qualityMetrics.get(dataType);
    
    if (!metrics) {
      metrics = this.createEmptyMetrics();
      this.qualityMetrics.set(dataType, metrics);
    }

    metrics.totalRecords++;
    
    if (result.isValid) {
      metrics.validRecords++;
    } else {
      metrics.invalidRecords++;
      
      // Track common errors
      for (const error of result.errors) {
        metrics.commonErrors[error] = (metrics.commonErrors[error] || 0) + 1;
      }
    }

    metrics.validationRate = (metrics.validRecords / metrics.totalRecords) * 100;
  }

  private createEmptyMetrics(): DataQualityMetrics {
    return {
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 0,
      validationRate: 0,
      commonErrors: {},
    };
  }
}