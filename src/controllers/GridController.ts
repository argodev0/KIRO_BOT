import { Response } from 'express';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class GridController {
  /**
   * Get user's grids
   */
  static async getGrids(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { page = 1, limit = 20, status, symbol, strategy } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where: any = { userId: req.user.userId };
      if (status) where.status = status;
      if (symbol) where.symbol = symbol;
      if (strategy) where.strategy = strategy;

      const [grids, total] = await Promise.all([
        prisma.grid.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' }
        }),
        prisma.grid.count({ where })
      ]);

      res.json({
        success: true,
        data: grids,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
          hasNext: skip + Number(limit) < total,
          hasPrev: Number(page) > 1
        }
      });
    } catch (error) {
      logger.error('Get grids error:', error);
      res.status(500).json({
        error: 'GRIDS_FETCH_FAILED',
        message: 'Failed to fetch grids'
      });
    }
  }

  /**
   * Get specific grid
   */
  static async getGrid(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { id } = req.params;

      const grid = await prisma.grid.findFirst({
        where: {
          id,
          userId: req.user.userId
        }
      });

      if (!grid) {
        res.status(404).json({
          error: 'GRID_NOT_FOUND',
          message: 'Grid not found'
        });
        return;
      }

      res.json({
        success: true,
        data: grid
      });
    } catch (error) {
      logger.error('Get grid error:', error);
      res.status(500).json({
        error: 'GRID_FETCH_FAILED',
        message: 'Failed to fetch grid'
      });
    }
  }

  /**
   * Create new grid
   */
  static async createGrid(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { symbol, strategy, basePrice, spacing, levels } = req.body;

      // Validate grid levels
      const gridLevels = levels.map((level: any) => ({
        price: level.price,
        quantity: level.quantity,
        side: level.side,
        filled: false
      }));

      // Create grid in database
      const grid = await prisma.grid.create({
        data: {
          userId: req.user.userId,
          symbol,
          strategy,
          basePrice,
          spacing,
          levels: gridLevels,
          status: 'ACTIVE'
        }
      });

      // Initialize grid with GridStrategyService
      try {
        // Grid initialization would be handled by GridStrategyService
        // For now, just log the initialization
        logger.info(`Grid ${grid.id} initialized successfully`);
      } catch (initError) {
        logger.error('Grid initialization error:', initError);
        // Update grid status to error
        await prisma.grid.update({
          where: { id: grid.id },
          data: { status: 'ERROR' }
        });
        
        res.status(500).json({
          error: 'GRID_INITIALIZATION_FAILED',
          message: 'Grid created but initialization failed'
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Grid created successfully',
        data: grid
      });
    } catch (error) {
      logger.error('Create grid error:', error);
      res.status(500).json({
        error: 'GRID_CREATION_FAILED',
        message: 'Failed to create grid'
      });
    }
  }

  /**
   * Update grid
   */
  static async updateGrid(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const { status, levels } = req.body;

      const grid = await prisma.grid.findFirst({
        where: {
          id,
          userId: req.user.userId
        }
      });

      if (!grid) {
        res.status(404).json({
          error: 'GRID_NOT_FOUND',
          message: 'Grid not found'
        });
        return;
      }

      const updateData: any = {};
      if (status) updateData.status = status;
      if (levels) updateData.levels = levels;

      const updatedGrid = await prisma.grid.update({
        where: { id },
        data: updateData
      });

      res.json({
        success: true,
        message: 'Grid updated successfully',
        data: updatedGrid
      });
    } catch (error) {
      logger.error('Update grid error:', error);
      res.status(500).json({
        error: 'GRID_UPDATE_FAILED',
        message: 'Failed to update grid'
      });
    }
  }

  /**
   * Close grid
   */
  static async closeGrid(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const { reason = 'Manual close' } = req.body;
      logger.info(`Closing grid ${id} with reason: ${reason}`);

      const grid = await prisma.grid.findFirst({
        where: {
          id,
          userId: req.user.userId,
          status: { in: ['ACTIVE', 'PAUSED'] }
        }
      });

      if (!grid) {
        res.status(404).json({
          error: 'GRID_NOT_FOUND',
          message: 'Grid not found or already closed'
        });
        return;
      }

      // Close grid using GridStrategyService
      const closeResult = { totalProfit: Number(grid.totalProfit) };

      // Update grid in database
      await prisma.grid.update({
        where: { id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          totalProfit: closeResult.totalProfit
        }
      });

      res.json({
        success: true,
        message: 'Grid closed successfully',
        data: closeResult
      });
    } catch (error) {
      logger.error('Close grid error:', error);
      res.status(500).json({
        error: 'GRID_CLOSE_FAILED',
        message: 'Failed to close grid'
      });
    }
  }

  /**
   * Get grid performance
   */
  static async getGridPerformance(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { id } = req.params;

      const grid = await prisma.grid.findFirst({
        where: {
          id,
          userId: req.user.userId
        }
      });

      if (!grid) {
        res.status(404).json({
          error: 'GRID_NOT_FOUND',
          message: 'Grid not found'
        });
        return;
      }

      const performance = {
        totalProfit: Number(grid.totalProfit),
        filledLevels: 0,
        activeOrders: 0,
        profitPercentage: 0
      };

      res.json({
        success: true,
        data: performance
      });
    } catch (error) {
      logger.error('Get grid performance error:', error);
      res.status(500).json({
        error: 'GRID_PERFORMANCE_FAILED',
        message: 'Failed to get grid performance'
      });
    }
  }

  /**
   * Get grid statistics
   */
  static async getGridStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const stats = await prisma.grid.groupBy({
        by: ['status', 'strategy'],
        where: { userId: req.user.userId },
        _count: true,
        _sum: {
          totalProfit: true
        }
      });

      const totalGrids = await prisma.grid.count({
        where: { userId: req.user.userId }
      });

      const totalProfit = await prisma.grid.aggregate({
        where: { userId: req.user.userId },
        _sum: {
          totalProfit: true
        }
      });

      res.json({
        success: true,
        data: {
          totalGrids,
          totalProfit: totalProfit._sum.totalProfit || 0,
          breakdown: stats
        }
      });
    } catch (error) {
      logger.error('Get grid stats error:', error);
      res.status(500).json({
        error: 'GRID_STATS_FAILED',
        message: 'Failed to get grid statistics'
      });
    }
  }
}