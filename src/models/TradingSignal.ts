/**
 * Trading Signal Model
 * Database model and business logic for trading signals
 */

import { SignalDirection, SignalStatus as PrismaSignalStatus } from '@prisma/client';
import { db } from './database';
import { TradingSignal, SignalStatus } from '../types/trading';
import { validateTradingSignal } from '../validation/trading.validation';
// import { logger } from '../utils/logger';

// Temporary logger for testing
const logger = {
  info: (msg: string, data?: any) => console.log(`INFO: ${msg}`, data),
  error: (msg: string, data?: any) => console.error(`ERROR: ${msg}`, data),
  debug: (msg: string, data?: any) => console.log(`DEBUG: ${msg}`, data),
};

export class TradingSignalModel {
  /**
   * Create a new trading signal
   */
  static async create(signalData: Omit<TradingSignal, 'id'> & { userId: string }): Promise<TradingSignal> {
    // Validate input data (exclude userId from validation as it's not part of TradingSignal type)
    const { userId, ...signalForValidation } = signalData;
    const { error } = validateTradingSignal(signalForValidation);
    if (error) {
      throw new Error(`Invalid signal data: ${error.message}`);
    }

    try {
      const signal = await db.tradingSignal.create({
        data: {
          userId: userId,
          symbol: signalData.symbol,
          direction: signalData.direction.toUpperCase() as SignalDirection,
          confidence: signalData.confidence,
          entryPrice: signalData.entryPrice,
          stopLoss: signalData.stopLoss || null,
          takeProfit: signalData.takeProfit,
          reasoning: signalData.reasoning as any,
          status: 'PENDING',
          technicalScore: signalData.technicalScore || null,
          patternScore: signalData.patternScore || null,
          elliottWaveScore: signalData.elliottWaveScore || null,
          fibonacciScore: signalData.fibonacciScore || null,
          volumeScore: signalData.volumeScore || null,
        },
        include: {
          user: true,
          executions: true,
        },
      });

      logger.info('Trading signal created', {
        signalId: signal.id,
        symbol: signal.symbol,
        direction: signal.direction,
        confidence: signal.confidence.toNumber(),
      });

      return this.mapToTradingSignal(signal);
    } catch (error) {
      logger.error('Failed to create trading signal', { error, signalData });
      throw error;
    }
  }

  /**
   * Get trading signal by ID
   */
  static async findById(id: string): Promise<TradingSignal | null> {
    try {
      const signal = await db.tradingSignal.findUnique({
        where: { id },
        include: {
          user: true,
          executions: true,
        },
      });

      return signal ? this.mapToTradingSignal(signal) : null;
    } catch (error) {
      logger.error('Failed to find trading signal', { error, id });
      throw error;
    }
  }

  /**
   * Get trading signals by user ID
   */
  static async findByUserId(
    userId: string,
    options: {
      status?: SignalStatus;
      symbol?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<TradingSignal[]> {
    try {
      const where: any = {
        userId,
        ...(options.status && { status: options.status.toUpperCase() as PrismaSignalStatus }),
        ...(options.symbol && { symbol: options.symbol }),
      };

      const signals = await db.tradingSignal.findMany({
        where,
        include: {
          user: true,
          executions: true,
        },
        orderBy: { createdAt: 'desc' },
        take: options.limit || 50,
        skip: options.offset || 0,
      });

      return signals.map(this.mapToTradingSignal);
    } catch (error) {
      logger.error('Failed to find trading signals by user', { error, userId, options });
      throw error;
    }
  }

  /**
   * Update trading signal status
   */
  static async updateStatus(id: string, status: SignalStatus): Promise<TradingSignal> {
    try {
      const signal = await db.tradingSignal.update({
        where: { id },
        data: {
          status: status.toUpperCase() as PrismaSignalStatus,
          ...(status === 'executed' && { executedAt: new Date() }),
          ...(status === 'closed' && { closedAt: new Date() }),
        },
        include: {
          user: true,
          executions: true,
        },
      });

      logger.info('Trading signal status updated', {
        signalId: id,
        status,
      });

      return this.mapToTradingSignal(signal);
    } catch (error) {
      logger.error('Failed to update trading signal status', { error, id, status });
      throw error;
    }
  }

  /**
   * Get active signals for a symbol
   */
  static async getActiveSignals(symbol: string): Promise<TradingSignal[]> {
    try {
      const signals = await db.tradingSignal.findMany({
        where: {
          symbol,
          status: {
            in: ['PENDING', 'ACTIVE', 'EXECUTED'],
          },
        },
        include: {
          user: true,
          executions: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return signals.map(this.mapToTradingSignal);
    } catch (error) {
      logger.error('Failed to get active signals', { error, symbol });
      throw error;
    }
  }

  /**
   * Get signals by confidence range
   */
  static async findByConfidenceRange(
    minConfidence: number,
    maxConfidence: number = 1.0,
    limit: number = 100
  ): Promise<TradingSignal[]> {
    try {
      const signals = await db.tradingSignal.findMany({
        where: {
          confidence: {
            gte: minConfidence,
            lte: maxConfidence,
          },
        },
        include: {
          user: true,
          executions: true,
        },
        orderBy: { confidence: 'desc' },
        take: limit,
      });

      return signals.map(this.mapToTradingSignal);
    } catch (error) {
      logger.error('Failed to find signals by confidence range', {
        error,
        minConfidence,
        maxConfidence,
      });
      throw error;
    }
  }

  /**
   * Delete trading signal
   */
  static async delete(id: string): Promise<boolean> {
    try {
      await db.tradingSignal.delete({
        where: { id },
      });

      logger.info('Trading signal deleted', { signalId: id });
      return true;
    } catch (error) {
      logger.error('Failed to delete trading signal', { error, id });
      return false;
    }
  }

  /**
   * Get signal statistics
   */
  static async getStatistics(userId?: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byDirection: Record<string, number>;
    averageConfidence: number;
  }> {
    try {
      const where = userId ? { userId } : {};

      const [total, byStatus, byDirection, avgConfidence] = await Promise.all([
        db.tradingSignal.count({ where }),
        db.tradingSignal.groupBy({
          by: ['status'],
          where,
          _count: { status: true },
        }),
        db.tradingSignal.groupBy({
          by: ['direction'],
          where,
          _count: { direction: true },
        }),
        db.tradingSignal.aggregate({
          where,
          _avg: { confidence: true },
        }),
      ]);

      return {
        total,
        byStatus: byStatus.reduce((acc: Record<string, number>, item: any) => {
          acc[item.status.toLowerCase()] = item._count.status;
          return acc;
        }, {} as Record<string, number>),
        byDirection: byDirection.reduce((acc: Record<string, number>, item: any) => {
          acc[item.direction.toLowerCase()] = item._count.direction;
          return acc;
        }, {} as Record<string, number>),
        averageConfidence: avgConfidence._avg.confidence?.toNumber() || 0,
      };
    } catch (error) {
      logger.error('Failed to get signal statistics', { error, userId });
      throw error;
    }
  }

  /**
   * Map database record to TradingSignal type
   */
  private static mapToTradingSignal(signal: any): TradingSignal {
    return {
      id: signal.id,
      symbol: signal.symbol,
      direction: signal.direction.toLowerCase() as 'long' | 'short',
      confidence: signal.confidence.toNumber(),
      entryPrice: signal.entryPrice.toNumber(),
      stopLoss: signal.stopLoss?.toNumber(),
      takeProfit: signal.takeProfit as number[],
      reasoning: signal.reasoning,
      timestamp: signal.createdAt.getTime(),
      status: signal.status.toLowerCase() as SignalStatus,
      technicalScore: signal.technicalScore?.toNumber(),
      patternScore: signal.patternScore?.toNumber(),
      elliottWaveScore: signal.elliottWaveScore?.toNumber(),
      fibonacciScore: signal.fibonacciScore?.toNumber(),
      volumeScore: signal.volumeScore?.toNumber(),
    };
  }
}