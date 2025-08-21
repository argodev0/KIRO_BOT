/**
 * Grid Trading Model
 * Database model and business logic for grid trading strategies
 */

import { GridStrategy as PrismaGridStrategy, GridStatus as PrismaGridStatus } from '@prisma/client';
import { db } from './database';
import { Grid, GridStatus, GridStrategy, GridLevel } from '../types/grid';
import { validateGrid } from '../validation/grid.validation';
// import { logger } from '../utils/logger';

// Temporary logger for testing
const logger = {
  info: (msg: string, data?: any) => console.log(`INFO: ${msg}`, data),
  error: (msg: string, data?: any) => console.error(`ERROR: ${msg}`, data),
  debug: (msg: string, data?: any) => console.log(`DEBUG: ${msg}`, data),
};

export class GridModel {
  /**
   * Create a new grid
   */
  static async create(gridData: Omit<Grid, 'id' | 'createdAt' | 'updatedAt'> & { userId: string }): Promise<Grid> {
    // Validate input data
    const { error } = validateGrid({ ...gridData, id: 'temp', createdAt: Date.now(), updatedAt: Date.now() });
    if (error) {
      throw new Error(`Invalid grid data: ${error.message}`);
    }

    try {
      const grid = await db.grid.create({
        data: {
          userId: gridData.userId,
          symbol: gridData.symbol,
          strategy: gridData.strategy.toUpperCase() as PrismaGridStrategy,
          levels: gridData.levels as any,
          basePrice: gridData.basePrice,
          spacing: gridData.spacing,
          totalProfit: gridData.totalProfit,
          status: gridData.status.toUpperCase() as PrismaGridStatus,
          metadata: (gridData.metadata || {}) as any,
        },
        include: {
          user: true,
        },
      });

      logger.info('Grid created', {
        gridId: grid.id,
        symbol: grid.symbol,
        strategy: grid.strategy,
        levels: gridData.levels.length,
      });

      return this.mapToGrid(grid);
    } catch (error) {
      logger.error('Failed to create grid', { error, gridData });
      throw error;
    }
  }

  /**
   * Get grid by ID
   */
  static async findById(id: string): Promise<Grid | null> {
    try {
      const grid = await db.grid.findUnique({
        where: { id },
        include: {
          user: true,
        },
      });

      return grid ? this.mapToGrid(grid) : null;
    } catch (error) {
      logger.error('Failed to find grid', { error, id });
      throw error;
    }
  }

  /**
   * Get grids by user ID
   */
  static async findByUserId(
    userId: string,
    options: {
      status?: GridStatus;
      symbol?: string;
      strategy?: GridStrategy;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Grid[]> {
    try {
      const where: any = {
        userId,
        ...(options.status && { status: options.status.toUpperCase() as PrismaGridStatus }),
        ...(options.symbol && { symbol: options.symbol }),
        ...(options.strategy && { strategy: options.strategy.toUpperCase() as PrismaGridStrategy }),
      };

      const grids = await db.grid.findMany({
        where,
        include: {
          user: true,
        },
        orderBy: { createdAt: 'desc' },
        take: options.limit || 50,
        skip: options.offset || 0,
      });

      return grids.map(this.mapToGrid);
    } catch (error) {
      logger.error('Failed to find grids by user', { error, userId, options });
      throw error;
    }
  }

  /**
   * Update grid status
   */
  static async updateStatus(id: string, status: GridStatus): Promise<Grid> {
    try {
      const grid = await db.grid.update({
        where: { id },
        data: {
          status: status.toUpperCase() as PrismaGridStatus,
          ...(status === 'closed' && { closedAt: new Date() }),
        },
        include: {
          user: true,
        },
      });

      logger.info('Grid status updated', {
        gridId: id,
        status,
      });

      return this.mapToGrid(grid);
    } catch (error) {
      logger.error('Failed to update grid status', { error, id, status });
      throw error;
    }
  }

  /**
   * Update grid levels
   */
  static async updateLevels(id: string, levels: GridLevel[]): Promise<Grid> {
    try {
      const grid = await db.grid.update({
        where: { id },
        data: {
          levels: levels as any,
          updatedAt: new Date(),
        },
        include: {
          user: true,
        },
      });

      logger.info('Grid levels updated', {
        gridId: id,
        levelCount: levels.length,
      });

      return this.mapToGrid(grid);
    } catch (error) {
      logger.error('Failed to update grid levels', { error, id, levels });
      throw error;
    }
  }

  /**
   * Update grid profit
   */
  static async updateProfit(id: string, totalProfit: number): Promise<Grid> {
    try {
      const grid = await db.grid.update({
        where: { id },
        data: {
          totalProfit: totalProfit,
          updatedAt: new Date(),
        },
        include: {
          user: true,
        },
      });

      logger.info('Grid profit updated', {
        gridId: id,
        totalProfit,
      });

      return this.mapToGrid(grid);
    } catch (error) {
      logger.error('Failed to update grid profit', { error, id, totalProfit });
      throw error;
    }
  }

  /**
   * Get active grids for a symbol
   */
  static async getActiveGrids(symbol: string): Promise<Grid[]> {
    try {
      const grids = await db.grid.findMany({
        where: {
          symbol,
          status: 'ACTIVE',
        },
        include: {
          user: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return grids.map(this.mapToGrid);
    } catch (error) {
      logger.error('Failed to get active grids', { error, symbol });
      throw error;
    }
  }

  /**
   * Get grids by strategy
   */
  static async findByStrategy(
    strategy: GridStrategy,
    options: {
      status?: GridStatus;
      limit?: number;
    } = {}
  ): Promise<Grid[]> {
    try {
      const where: any = {
        strategy: strategy.toUpperCase() as PrismaGridStrategy,
        ...(options.status && { status: options.status.toUpperCase() as PrismaGridStatus }),
      };

      const grids = await db.grid.findMany({
        where,
        include: {
          user: true,
        },
        orderBy: { createdAt: 'desc' },
        take: options.limit || 100,
      });

      return grids.map(this.mapToGrid);
    } catch (error) {
      logger.error('Failed to find grids by strategy', { error, strategy, options });
      throw error;
    }
  }

  /**
   * Delete grid
   */
  static async delete(id: string): Promise<boolean> {
    try {
      await db.grid.delete({
        where: { id },
      });

      logger.info('Grid deleted', { gridId: id });
      return true;
    } catch (error) {
      logger.error('Failed to delete grid', { error, id });
      return false;
    }
  }

  /**
   * Get grid statistics
   */
  static async getStatistics(userId?: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byStrategy: Record<string, number>;
    totalProfit: number;
    averageProfit: number;
  }> {
    try {
      const where = userId ? { userId } : {};

      const [total, byStatus, byStrategy, profitStats] = await Promise.all([
        db.grid.count({ where }),
        db.grid.groupBy({
          by: ['status'],
          where,
          _count: { status: true },
        }),
        db.grid.groupBy({
          by: ['strategy'],
          where,
          _count: { strategy: true },
        }),
        db.grid.aggregate({
          where,
          _sum: { totalProfit: true },
          _avg: { totalProfit: true },
        }),
      ]);

      return {
        total,
        byStatus: byStatus.reduce((acc: Record<string, number>, item: any) => {
          acc[item.status.toLowerCase()] = item._count.status;
          return acc;
        }, {} as Record<string, number>),
        byStrategy: byStrategy.reduce((acc: Record<string, number>, item: any) => {
          acc[item.strategy.toLowerCase()] = item._count.strategy;
          return acc;
        }, {} as Record<string, number>),
        totalProfit: profitStats._sum.totalProfit?.toNumber() || 0,
        averageProfit: profitStats._avg.totalProfit?.toNumber() || 0,
      };
    } catch (error) {
      logger.error('Failed to get grid statistics', { error, userId });
      throw error;
    }
  }

  /**
   * Update grid metadata
   */
  static async updateMetadata(id: string, metadata: Record<string, any>): Promise<Grid> {
    try {
      const grid = await db.grid.update({
        where: { id },
        data: {
          metadata,
          updatedAt: new Date(),
        },
        include: {
          user: true,
        },
      });

      logger.info('Grid metadata updated', { gridId: id });
      return this.mapToGrid(grid);
    } catch (error) {
      logger.error('Failed to update grid metadata', { error, id, metadata });
      throw error;
    }
  }

  /**
   * Map database record to Grid type
   */
  private static mapToGrid(grid: any): Grid {
    return {
      id: grid.id,
      symbol: grid.symbol,
      strategy: grid.strategy.toLowerCase() as GridStrategy,
      levels: grid.levels as GridLevel[],
      basePrice: grid.basePrice.toNumber(),
      spacing: grid.spacing.toNumber(),
      totalProfit: grid.totalProfit.toNumber(),
      status: grid.status.toLowerCase() as GridStatus,
      metadata: grid.metadata as any,
      createdAt: grid.createdAt.getTime(),
      updatedAt: grid.updatedAt.getTime(),
      closedAt: grid.closedAt?.getTime(),
    };
  }
}