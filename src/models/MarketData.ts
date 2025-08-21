/**
 * Market Data Model
 * Database model and business logic for market data storage and retrieval
 */

import { db } from './database';
import { CandleData, Timeframe } from '../types/market';
import { validateCandleData } from '../validation/market.validation';
// import { logger } from '../utils/logger';

// Temporary logger for testing
const logger = {
  info: (msg: string, data?: any) => console.log(`INFO: ${msg}`, data),
  error: (msg: string, data?: any) => console.error(`ERROR: ${msg}`, data),
  debug: (msg: string, data?: any) => console.log(`DEBUG: ${msg}`, data),
};

export class MarketDataModel {
  /**
   * Store candle data
   */
  static async storeCandles(candles: CandleData[]): Promise<void> {
    if (candles.length === 0) return;

    try {
      // Validate all candles
      for (const candle of candles) {
        const { error } = validateCandleData(candle);
        if (error) {
          throw new Error(`Invalid candle data: ${error.message}`);
        }
      }

      // Use upsert to handle duplicates
      const operations = candles.map(candle => 
        db.marketData.upsert({
          where: {
            symbol_exchange_timeframe_timestamp: {
              symbol: candle.symbol,
              exchange: 'binance', // Default exchange, should be parameterized
              timeframe: candle.timeframe,
              timestamp: new Date(candle.timestamp),
            },
          },
          update: {
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
          },
          create: {
            symbol: candle.symbol,
            exchange: 'binance',
            timeframe: candle.timeframe,
            timestamp: new Date(candle.timestamp),
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
          },
        })
      );

      await db.$transaction(operations);

      logger.debug('Stored candle data', {
        count: candles.length,
        symbol: candles[0]?.symbol,
        timeframe: candles[0]?.timeframe,
      });
    } catch (error) {
      logger.error('Failed to store candle data', { error, count: candles.length });
      throw error;
    }
  }

  /**
   * Get historical candles
   */
  static async getCandles(
    symbol: string,
    timeframe: Timeframe,
    options: {
      exchange?: string;
      startTime?: number;
      endTime?: number;
      limit?: number;
    } = {}
  ): Promise<CandleData[]> {
    try {
      const where: any = {
        symbol,
        timeframe,
        exchange: options.exchange || 'binance',
        ...(options.startTime && {
          timestamp: { gte: new Date(options.startTime) },
        }),
        ...(options.endTime && {
          timestamp: { lte: new Date(options.endTime) },
        }),
        ...(options.startTime && options.endTime && {
          timestamp: {
            gte: new Date(options.startTime),
            lte: new Date(options.endTime),
          },
        }),
      };

      const marketData = await db.marketData.findMany({
        where,
        orderBy: { timestamp: 'asc' },
        take: options.limit || 1000,
      });

      return marketData.map(this.mapToCandleData);
    } catch (error) {
      logger.error('Failed to get candles', { error, symbol, timeframe, options });
      throw error;
    }
  }

  /**
   * Get latest candle for a symbol
   */
  static async getLatestCandle(
    symbol: string,
    timeframe: Timeframe,
    exchange: string = 'binance'
  ): Promise<CandleData | null> {
    try {
      const marketData = await db.marketData.findFirst({
        where: { symbol, timeframe, exchange },
        orderBy: { timestamp: 'desc' },
      });

      return marketData ? this.mapToCandleData(marketData) : null;
    } catch (error) {
      logger.error('Failed to get latest candle', { error, symbol, timeframe, exchange });
      throw error;
    }
  }

  /**
   * Get candles for multiple symbols
   */
  static async getCandlesMultiSymbol(
    symbols: string[],
    timeframe: Timeframe,
    options: {
      exchange?: string;
      startTime?: number;
      endTime?: number;
      limit?: number;
    } = {}
  ): Promise<Record<string, CandleData[]>> {
    try {
      const where: any = {
        symbol: { in: symbols },
        timeframe,
        exchange: options.exchange || 'binance',
        ...(options.startTime && options.endTime && {
          timestamp: {
            gte: new Date(options.startTime),
            lte: new Date(options.endTime),
          },
        }),
      };

      const marketData = await db.marketData.findMany({
        where,
        orderBy: [{ symbol: 'asc' }, { timestamp: 'asc' }],
        take: options.limit || 1000,
      });

      // Group by symbol
      const result: Record<string, CandleData[]> = {};
      for (const data of marketData) {
        if (!result[data.symbol]) {
          result[data.symbol] = [];
        }
        result[data.symbol].push(this.mapToCandleData(data));
      }

      return result;
    } catch (error) {
      logger.error('Failed to get candles for multiple symbols', {
        error,
        symbols,
        timeframe,
        options,
      });
      throw error;
    }
  }

  /**
   * Store technical indicators
   */
  static async storeIndicators(
    symbol: string,
    timeframe: Timeframe,
    timestamp: number,
    indicators: Record<string, any>,
    exchange: string = 'binance'
  ): Promise<void> {
    try {
      await db.marketData.update({
        where: {
          symbol_exchange_timeframe_timestamp: {
            symbol,
            exchange,
            timeframe,
            timestamp: new Date(timestamp),
          },
        },
        data: {
          indicators,
        },
      });

      logger.debug('Stored technical indicators', {
        symbol,
        timeframe,
        timestamp,
        indicatorCount: Object.keys(indicators).length,
      });
    } catch (error) {
      logger.error('Failed to store indicators', {
        error,
        symbol,
        timeframe,
        timestamp,
      });
      throw error;
    }
  }

  /**
   * Get candles with indicators
   */
  static async getCandlesWithIndicators(
    symbol: string,
    timeframe: Timeframe,
    options: {
      exchange?: string;
      startTime?: number;
      endTime?: number;
      limit?: number;
    } = {}
  ): Promise<Array<CandleData & { indicators?: Record<string, any> }>> {
    try {
      const where: any = {
        symbol,
        timeframe,
        exchange: options.exchange || 'binance',
        indicators: { not: null },
        ...(options.startTime && options.endTime && {
          timestamp: {
            gte: new Date(options.startTime),
            lte: new Date(options.endTime),
          },
        }),
      };

      const marketData = await db.marketData.findMany({
        where,
        orderBy: { timestamp: 'asc' },
        take: options.limit || 1000,
      });

      return marketData.map(data => ({
        ...this.mapToCandleData(data),
        indicators: data.indicators as Record<string, any>,
      }));
    } catch (error) {
      logger.error('Failed to get candles with indicators', {
        error,
        symbol,
        timeframe,
        options,
      });
      throw error;
    }
  }

  /**
   * Delete old market data
   */
  static async deleteOldData(
    olderThanDays: number,
    timeframes?: Timeframe[]
  ): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const where: any = {
        timestamp: { lt: cutoffDate },
        ...(timeframes && { timeframe: { in: timeframes } }),
      };

      const result = await db.marketData.deleteMany({ where });

      logger.info('Deleted old market data', {
        deletedCount: result.count,
        olderThanDays,
        timeframes,
      });

      return result.count;
    } catch (error) {
      logger.error('Failed to delete old market data', {
        error,
        olderThanDays,
        timeframes,
      });
      throw error;
    }
  }

  /**
   * Get data statistics
   */
  static async getStatistics(): Promise<{
    totalRecords: number;
    bySymbol: Record<string, number>;
    byTimeframe: Record<string, number>;
    dateRange: { earliest: Date | null; latest: Date | null };
  }> {
    try {
      const [total, bySymbol, byTimeframe, dateRange] = await Promise.all([
        db.marketData.count(),
        db.marketData.groupBy({
          by: ['symbol'],
          _count: { symbol: true },
        }),
        db.marketData.groupBy({
          by: ['timeframe'],
          _count: { timeframe: true },
        }),
        db.marketData.aggregate({
          _min: { timestamp: true },
          _max: { timestamp: true },
        }),
      ]);

      return {
        totalRecords: total,
        bySymbol: bySymbol.reduce((acc: Record<string, number>, item: any) => {
          acc[item.symbol] = item._count.symbol;
          return acc;
        }, {} as Record<string, number>),
        byTimeframe: byTimeframe.reduce((acc: Record<string, number>, item: any) => {
          acc[item.timeframe] = item._count.timeframe;
          return acc;
        }, {} as Record<string, number>),
        dateRange: {
          earliest: dateRange._min.timestamp,
          latest: dateRange._max.timestamp,
        },
      };
    } catch (error) {
      logger.error('Failed to get market data statistics', { error });
      throw error;
    }
  }

  /**
   * Map database record to CandleData type
   */
  private static mapToCandleData(data: any): CandleData {
    return {
      symbol: data.symbol,
      timeframe: data.timeframe,
      timestamp: data.timestamp.getTime(),
      open: data.open.toNumber(),
      high: data.high.toNumber(),
      low: data.low.toNumber(),
      close: data.close.toNumber(),
      volume: data.volume.toNumber(),
    };
  }
}