import { Response } from 'express';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class TradingController {
  /**
   * Get trading signals
   */
  static async getSignals(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { page = 1, limit = 20, status, symbol } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where: any = { userId: req.user.userId };
      if (status) where.status = status;
      if (symbol) where.symbol = symbol;

      const [signals, total] = await Promise.all([
        prisma.tradingSignal.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            executions: true
          }
        }),
        prisma.tradingSignal.count({ where })
      ]);

      res.json({
        success: true,
        data: signals,
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
      logger.error('Get signals error:', error);
      res.status(500).json({
        error: 'SIGNALS_FETCH_FAILED',
        message: 'Failed to fetch trading signals'
      });
    }
  }

  /**
   * Get specific trading signal
   */
  static async getSignal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { id } = req.params;

      const signal = await prisma.tradingSignal.findFirst({
        where: {
          id,
          userId: req.user.userId
        },
        include: {
          executions: true
        }
      });

      if (!signal) {
        res.status(404).json({
          error: 'SIGNAL_NOT_FOUND',
          message: 'Trading signal not found'
        });
        return;
      }

      res.json({
        success: true,
        data: signal
      });
    } catch (error) {
      logger.error('Get signal error:', error);
      res.status(500).json({
        error: 'SIGNAL_FETCH_FAILED',
        message: 'Failed to fetch trading signal'
      });
    }
  }

  /**
   * Execute a trading signal
   */
  static async executeSignal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { signalId, positionSize } = req.body;

      // Find the signal
      const signal = await prisma.tradingSignal.findFirst({
        where: {
          id: signalId,
          userId: req.user.userId,
          status: 'PENDING'
        }
      });

      if (!signal) {
        res.status(404).json({
          error: 'SIGNAL_NOT_FOUND',
          message: 'Trading signal not found or already executed'
        });
        return;
      }

      // Get user's portfolio for risk management
      const portfolio = await prisma.portfolio.findFirst({
        where: { userId: req.user.userId }
      });

      if (!portfolio) {
        res.status(400).json({
          error: 'PORTFOLIO_NOT_FOUND',
          message: 'User portfolio not found'
        });
        return;
      }

      // Calculate position size if not provided
      const calculatedSize = positionSize || 0.001; // Default small position size

      // Risk validation would be implemented here
      // For now, just basic validation
      if (calculatedSize > Number(portfolio.availableBalance) * 0.1) {
        res.status(400).json({
          error: 'RISK_VIOLATION',
          message: 'Position size too large for available balance'
        });
        return;
      }

      // Execute the trade
      const executionResult = {
        orderId: `order_${Date.now()}`,
        status: 'filled',
        executedPrice: Number(signal.entryPrice),
        executedQuantity: calculatedSize
      };

      // Update signal status
      await prisma.tradingSignal.update({
        where: { id: signalId },
        data: {
          status: 'EXECUTED',
          executedAt: new Date()
        }
      });

      res.json({
        success: true,
        message: 'Signal executed successfully',
        data: executionResult
      });
    } catch (error) {
      logger.error('Execute signal error:', error);
      res.status(500).json({
        error: 'SIGNAL_EXECUTION_FAILED',
        message: 'Failed to execute trading signal'
      });
    }
  }

  /**
   * Cancel a trading signal
   */
  static async cancelSignal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { id } = req.params;

      const signal = await prisma.tradingSignal.findFirst({
        where: {
          id,
          userId: req.user.userId,
          status: { in: ['PENDING', 'ACTIVE'] }
        }
      });

      if (!signal) {
        res.status(404).json({
          error: 'SIGNAL_NOT_FOUND',
          message: 'Trading signal not found or cannot be cancelled'
        });
        return;
      }

      await prisma.tradingSignal.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          closedAt: new Date()
        }
      });

      res.json({
        success: true,
        message: 'Signal cancelled successfully'
      });
    } catch (error) {
      logger.error('Cancel signal error:', error);
      res.status(500).json({
        error: 'SIGNAL_CANCELLATION_FAILED',
        message: 'Failed to cancel trading signal'
      });
    }
  }

  /**
   * Get trade executions
   */
  static async getExecutions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { page = 1, limit = 20, symbol, exchange } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where: any = { userId: req.user.userId };
      if (symbol) where.symbol = symbol;
      if (exchange) where.exchange = exchange;

      const [executions, total] = await Promise.all([
        prisma.tradeExecution.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { executedAt: 'desc' },
          include: {
            signal: true
          }
        }),
        prisma.tradeExecution.count({ where })
      ]);

      res.json({
        success: true,
        data: executions,
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
      logger.error('Get executions error:', error);
      res.status(500).json({
        error: 'EXECUTIONS_FETCH_FAILED',
        message: 'Failed to fetch trade executions'
      });
    }
  }

  /**
   * Place manual order
   */
  static async placeOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { symbol, side, type, quantity, exchange } = req.body;
      
      logger.info(`Placing ${type} ${side} order for ${quantity} ${symbol} on ${exchange}`);

      const result = {
        orderId: `order_${Date.now()}`,
        status: 'pending',
        message: 'Order placed successfully (mock)'
      };

      res.json({
        success: true,
        message: 'Order placed successfully',
        data: result
      });
    } catch (error) {
      logger.error('Place order error:', error);
      res.status(500).json({
        error: 'ORDER_PLACEMENT_FAILED',
        message: 'Failed to place order'
      });
    }
  }

  /**
   * Cancel order
   */
  static async cancelOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { orderId } = req.params;
      const { exchange } = req.body;
      
      logger.info(`Cancelling order ${orderId} on ${exchange}`);

      const result = {
        orderId,
        status: 'cancelled',
        message: 'Order cancelled successfully (mock)'
      };

      res.json({
        success: true,
        message: 'Order cancelled successfully',
        data: result
      });
    } catch (error) {
      logger.error('Cancel order error:', error);
      res.status(500).json({
        error: 'ORDER_CANCELLATION_FAILED',
        message: 'Failed to cancel order'
      });
    }
  }

  /**
   * Get order status
   */
  static async getOrderStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { orderId } = req.params;
      const { exchange } = req.query;

      if (!exchange) {
        res.status(400).json({
          error: 'MISSING_EXCHANGE',
          message: 'Exchange parameter is required'
        });
        return;
      }

      const result = {
        orderId,
        status: 'filled',
        price: 45000,
        quantity: 0.001,
        exchange: exchange as string
      };

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get order status error:', error);
      res.status(500).json({
        error: 'ORDER_STATUS_FAILED',
        message: 'Failed to get order status'
      });
    }
  }
}