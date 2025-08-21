/**
 * Timeframe Aggregator
 * Aggregates market data across multiple timeframes
 */

import { EventEmitter } from 'events';
import { CandleData, Timeframe } from '../types/market';
import { logger } from '../utils/logger';

export interface AggregationConfig {
  sourceTimeframes: Timeframe[];
  targetTimeframes: Timeframe[];
  maxCandlesPerTimeframe: number;
}

export interface TimeframeCandles {
  [key: string]: CandleData[]; // timeframe -> candles
}

export class TimeframeAggregator extends EventEmitter {
  private candleBuffers: Map<string, Map<Timeframe, CandleData[]>> = new Map(); // symbol -> timeframe -> candles
  private timeframeMultipliers: Record<Timeframe, number>;
  private config: AggregationConfig;

  constructor(config?: Partial<AggregationConfig>) {
    super();
    
    this.config = {
      sourceTimeframes: ['1m'],
      targetTimeframes: ['1m', '5m', '15m', '30m', '1h', '4h', '1d'],
      maxCandlesPerTimeframe: 1000,
      ...config,
    };

    // Define timeframe multipliers in minutes
    this.timeframeMultipliers = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '30m': 30,
      '1h': 60,
      '4h': 240,
      '1d': 1440,
      '1w': 10080,
      '1M': 43200, // Approximate
    };
  }

  /**
   * Process incoming candle and generate aggregated timeframes
   */
  processCandle(candle: CandleData): void {
    try {
      const symbol = candle.symbol;
      
      // Initialize symbol buffers if not exists
      if (!this.candleBuffers.has(symbol)) {
        this.candleBuffers.set(symbol, new Map());
      }
      
      const symbolBuffers = this.candleBuffers.get(symbol)!;
      
      // Store the source candle
      this.addCandleToBuffer(symbolBuffers, candle.timeframe as Timeframe, candle);
      
      // Generate aggregated timeframes
      this.generateAggregatedTimeframes(symbol, candle);
      
    } catch (error) {
      logger.error('Error processing candle for aggregation:', error);
    }
  }

  /**
   * Get candles for specific symbol and timeframe
   */
  getCandles(symbol: string, timeframe: Timeframe, limit?: number): CandleData[] {
    const symbolBuffers = this.candleBuffers.get(symbol);
    if (!symbolBuffers) {
      return [];
    }
    
    const candles = symbolBuffers.get(timeframe) || [];
    
    if (limit && limit > 0) {
      return candles.slice(-limit);
    }
    
    return [...candles];
  }

  /**
   * Get all available timeframes for a symbol
   */
  getAvailableTimeframes(symbol: string): Timeframe[] {
    const symbolBuffers = this.candleBuffers.get(symbol);
    if (!symbolBuffers) {
      return [];
    }
    
    return Array.from(symbolBuffers.keys());
  }

  /**
   * Get multi-timeframe data for a symbol
   */
  getMultiTimeframeCandles(symbol: string, timeframes?: Timeframe[], limit?: number): TimeframeCandles {
    const result: TimeframeCandles = {};
    const targetTimeframes = timeframes || this.config.targetTimeframes;
    
    for (const timeframe of targetTimeframes) {
      result[timeframe] = this.getCandles(symbol, timeframe, limit);
    }
    
    return result;
  }

  /**
   * Clear old candles to manage memory
   */
  cleanup(symbol?: string): void {
    if (symbol) {
      this.cleanupSymbol(symbol);
    } else {
      for (const symbolKey of this.candleBuffers.keys()) {
        this.cleanupSymbol(symbolKey);
      }
    }
  }

  /**
   * Get aggregation statistics
   */
  getStatistics(): Record<string, any> {
    const stats: Record<string, any> = {
      totalSymbols: this.candleBuffers.size,
      symbolStats: {},
    };
    
    for (const [symbol, buffers] of this.candleBuffers.entries()) {
      stats.symbolStats[symbol] = {
        timeframes: buffers.size,
        totalCandles: 0,
        timeframeDetails: {},
      };
      
      for (const [timeframe, candles] of buffers.entries()) {
        stats.symbolStats[symbol].totalCandles += candles.length;
        stats.symbolStats[symbol].timeframeDetails[timeframe] = {
          candleCount: candles.length,
          oldestCandle: candles.length > 0 ? new Date(candles[0].timestamp).toISOString() : null,
          newestCandle: candles.length > 0 ? new Date(candles[candles.length - 1].timestamp).toISOString() : null,
        };
      }
    }
    
    return stats;
  }

  // Private methods
  private generateAggregatedTimeframes(symbol: string, sourceCandle: CandleData): void {
    const sourceTimeframe = sourceCandle.timeframe as Timeframe;
    const sourceMultiplier = this.timeframeMultipliers[sourceTimeframe];
    
    if (!sourceMultiplier) {
      logger.warn(`Unknown source timeframe: ${sourceTimeframe}`);
      return;
    }
    
    // Generate higher timeframes
    for (const targetTimeframe of this.config.targetTimeframes) {
      const targetMultiplier = this.timeframeMultipliers[targetTimeframe];
      
      if (!targetMultiplier || targetMultiplier <= sourceMultiplier) {
        continue; // Skip same or lower timeframes
      }
      
      this.aggregateToTimeframe(symbol, sourceCandle, targetTimeframe, sourceMultiplier, targetMultiplier);
    }
  }

  private aggregateToTimeframe(
    symbol: string,
    sourceCandle: CandleData,
    targetTimeframe: Timeframe,
    _sourceMultiplier: number,
    targetMultiplier: number
  ): void {
    const symbolBuffers = this.candleBuffers.get(symbol)!;
    
    // Calculate the target candle timestamp (aligned to timeframe)
    const targetTimestamp = this.alignTimestamp(sourceCandle.timestamp, targetMultiplier);
    
    // Get or create target timeframe buffer
    if (!symbolBuffers.has(targetTimeframe)) {
      symbolBuffers.set(targetTimeframe, []);
    }
    
    const targetBuffer = symbolBuffers.get(targetTimeframe)!;
    
    // Find existing candle or create new one
    let targetCandle = targetBuffer.find(c => c.timestamp === targetTimestamp);
    
    if (!targetCandle) {
      // Create new aggregated candle
      targetCandle = {
        symbol: sourceCandle.symbol,
        timeframe: targetTimeframe,
        timestamp: targetTimestamp,
        open: sourceCandle.open,
        high: sourceCandle.high,
        low: sourceCandle.low,
        close: sourceCandle.close,
        volume: sourceCandle.volume,
        exchange: sourceCandle.exchange || 'unknown',
      };
      
      // Insert in correct position (maintain chronological order)
      this.insertCandleInOrder(targetBuffer, targetCandle!);
    } else {
      // Update existing candle
      targetCandle.high = Math.max(targetCandle.high, sourceCandle.high);
      targetCandle.low = Math.min(targetCandle.low, sourceCandle.low);
      targetCandle.close = sourceCandle.close; // Latest close
      targetCandle.volume += sourceCandle.volume;
    }
    
    // Emit aggregated candle
    this.emit('aggregatedCandle', targetCandle);
    
    // Cleanup old candles if buffer is too large
    if (targetBuffer.length > this.config.maxCandlesPerTimeframe) {
      targetBuffer.splice(0, targetBuffer.length - this.config.maxCandlesPerTimeframe);
    }
  }

  private alignTimestamp(timestamp: number, timeframeMinutes: number): number {
    const timeframeMs = timeframeMinutes * 60 * 1000;
    return Math.floor(timestamp / timeframeMs) * timeframeMs;
  }

  private insertCandleInOrder(buffer: CandleData[], candle: CandleData): void {
    // Find insertion point using binary search
    let left = 0;
    let right = buffer.length;
    
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (buffer[mid].timestamp < candle.timestamp) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    
    buffer.splice(left, 0, candle);
  }

  private addCandleToBuffer(symbolBuffers: Map<Timeframe, CandleData[]>, timeframe: Timeframe, candle: CandleData): void {
    if (!symbolBuffers.has(timeframe)) {
      symbolBuffers.set(timeframe, []);
    }
    
    const buffer = symbolBuffers.get(timeframe)!;
    
    // Check if this candle already exists (by timestamp)
    const existingIndex = buffer.findIndex(c => c.timestamp === candle.timestamp);
    
    if (existingIndex >= 0) {
      // Update existing candle
      buffer[existingIndex] = candle;
    } else {
      // Add new candle in chronological order
      this.insertCandleInOrder(buffer, candle);
    }
    
    // Cleanup old candles
    if (buffer.length > this.config.maxCandlesPerTimeframe) {
      buffer.splice(0, buffer.length - this.config.maxCandlesPerTimeframe);
    }
  }

  private cleanupSymbol(symbol: string): void {
    const symbolBuffers = this.candleBuffers.get(symbol);
    if (!symbolBuffers) {
      return;
    }
    
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [timeframe, buffer] of symbolBuffers.entries()) {
      // Remove candles older than cutoff time
      const validCandles = buffer.filter(candle => candle.timestamp > cutoffTime);
      symbolBuffers.set(timeframe, validCandles);
    }
    
    // Remove empty timeframe buffers
    for (const [timeframe, buffer] of symbolBuffers.entries()) {
      if (buffer.length === 0) {
        symbolBuffers.delete(timeframe);
      }
    }
    
    // Remove symbol if no timeframes left
    if (symbolBuffers.size === 0) {
      this.candleBuffers.delete(symbol);
    }
  }

  /**
   * Aggregate historical candles from lower to higher timeframes
   */
  aggregateHistoricalCandles(
    candles: CandleData[],
    sourceTimeframe: Timeframe,
    targetTimeframe: Timeframe
  ): CandleData[] {
    if (candles.length === 0) {
      return [];
    }
    
    const sourceMultiplier = this.timeframeMultipliers[sourceTimeframe];
    const targetMultiplier = this.timeframeMultipliers[targetTimeframe];
    
    if (!sourceMultiplier || !targetMultiplier || targetMultiplier <= sourceMultiplier) {
      throw new Error(`Invalid timeframe aggregation: ${sourceTimeframe} -> ${targetTimeframe}`);
    }
    
    // Sort candles by timestamp
    const sortedCandles = [...candles].sort((a, b) => a.timestamp - b.timestamp);
    const aggregatedCandles: CandleData[] = [];
    
    // Group candles by target timeframe periods
    const candleGroups = new Map<number, CandleData[]>();
    
    for (const candle of sortedCandles) {
      const alignedTimestamp = this.alignTimestamp(candle.timestamp, targetMultiplier);
      
      if (!candleGroups.has(alignedTimestamp)) {
        candleGroups.set(alignedTimestamp, []);
      }
      
      candleGroups.get(alignedTimestamp)!.push(candle);
    }
    
    // Create aggregated candles
    for (const [timestamp, groupCandles] of candleGroups.entries()) {
      if (groupCandles.length === 0) continue;
      
      // Sort group candles by timestamp
      groupCandles.sort((a, b) => a.timestamp - b.timestamp);
      
      const aggregatedCandle: CandleData = {
        symbol: groupCandles[0].symbol,
        timeframe: targetTimeframe,
        timestamp: timestamp,
        open: groupCandles[0].open,
        high: Math.max(...groupCandles.map(c => c.high)),
        low: Math.min(...groupCandles.map(c => c.low)),
        close: groupCandles[groupCandles.length - 1].close,
        volume: groupCandles.reduce((sum, c) => sum + c.volume, 0),
        exchange: groupCandles[0].exchange || 'unknown',
      };
      
      aggregatedCandles.push(aggregatedCandle);
    }
    
    // Sort final result by timestamp
    return aggregatedCandles.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Validate that candles can be aggregated
   */
  canAggregate(sourceTimeframe: Timeframe, targetTimeframe: Timeframe): boolean {
    const sourceMultiplier = this.timeframeMultipliers[sourceTimeframe];
    const targetMultiplier = this.timeframeMultipliers[targetTimeframe];
    
    if (!sourceMultiplier || !targetMultiplier) {
      return false;
    }
    
    // Target timeframe must be larger and evenly divisible
    return targetMultiplier > sourceMultiplier && targetMultiplier % sourceMultiplier === 0;
  }

  /**
   * Get supported timeframes
   */
  getSupportedTimeframes(): Timeframe[] {
    return Object.keys(this.timeframeMultipliers) as Timeframe[];
  }
}