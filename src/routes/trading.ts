import { Router } from 'express';
import { TradingController } from '@/controllers/TradingController';
import { authenticate, requirePermission } from '@/middleware/auth';
import { validate } from '@/middleware/inputValidation';
import { tradingSchemas, commonSchemas } from '@/middleware/validation';
import { tradingRateLimit } from '@/middleware/rateLimiter';
import { Permission } from '@/types/auth';

const router = Router();

// Apply authentication to all trading routes
router.use(authenticate);

/**
 * @swagger
 * /api/v1/trading/signals:
 *   get:
 *     summary: Get trading signals
 *     tags: [Trading]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, ACTIVE, EXECUTED, CANCELLED, EXPIRED, CLOSED]
 *         description: Filter by signal status
 *       - in: query
 *         name: symbol
 *         schema:
 *           type: string
 *         description: Filter by trading symbol
 *     responses:
 *       200:
 *         description: Trading signals retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/signals',
  requirePermission(Permission.TRADE_VIEW),
  validate({ query: commonSchemas.pagination }),
  TradingController.getSignals
);

/**
 * @swagger
 * /api/v1/trading/signals/{id}:
 *   get:
 *     summary: Get specific trading signal
 *     tags: [Trading]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Signal ID
 *     responses:
 *       200:
 *         description: Trading signal retrieved successfully
 *       404:
 *         description: Signal not found
 */
router.get('/signals/:id',
  requirePermission(Permission.TRADE_VIEW),
  validate({ params: commonSchemas.id }),
  TradingController.getSignal
);

/**
 * @swagger
 * /api/v1/trading/signals/execute:
 *   post:
 *     summary: Execute a trading signal
 *     tags: [Trading]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - signalId
 *             properties:
 *               signalId:
 *                 type: string
 *               positionSize:
 *                 type: number
 *                 minimum: 0
 *               customStopLoss:
 *                 type: number
 *                 minimum: 0
 *               customTakeProfit:
 *                 type: array
 *                 items:
 *                   type: number
 *                   minimum: 0
 *     responses:
 *       200:
 *         description: Signal executed successfully
 *       400:
 *         description: Risk violation or invalid signal
 *       404:
 *         description: Signal not found
 */
router.post('/signals/execute',
  tradingRateLimit,
  requirePermission(Permission.TRADE_EXECUTE),
  validate(tradingSchemas.executeSignal),
  TradingController.executeSignal
);

/**
 * @swagger
 * /api/v1/trading/signals/{id}/cancel:
 *   post:
 *     summary: Cancel a trading signal
 *     tags: [Trading]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Signal ID
 *     responses:
 *       200:
 *         description: Signal cancelled successfully
 *       404:
 *         description: Signal not found or cannot be cancelled
 */
router.post('/signals/:id/cancel',
  requirePermission(Permission.TRADE_CANCEL),
  validate({ params: commonSchemas.id }),
  TradingController.cancelSignal
);

/**
 * @swagger
 * /api/v1/trading/executions:
 *   get:
 *     summary: Get trade executions
 *     tags: [Trading]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *       - in: query
 *         name: symbol
 *         schema:
 *           type: string
 *         description: Filter by trading symbol
 *       - in: query
 *         name: exchange
 *         schema:
 *           type: string
 *           enum: [binance, kucoin]
 *         description: Filter by exchange
 *     responses:
 *       200:
 *         description: Trade executions retrieved successfully
 */
router.get('/executions',
  requirePermission(Permission.TRADE_VIEW),
  validate({ query: commonSchemas.pagination }),
  TradingController.getExecutions
);

/**
 * @swagger
 * /api/v1/trading/orders:
 *   post:
 *     summary: Place manual order
 *     tags: [Trading]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - symbol
 *               - side
 *               - type
 *               - quantity
 *               - exchange
 *             properties:
 *               symbol:
 *                 type: string
 *               side:
 *                 type: string
 *                 enum: [buy, sell]
 *               type:
 *                 type: string
 *                 enum: [market, limit, stop]
 *               quantity:
 *                 type: number
 *                 minimum: 0
 *               price:
 *                 type: number
 *                 minimum: 0
 *               stopPrice:
 *                 type: number
 *                 minimum: 0
 *               exchange:
 *                 type: string
 *                 enum: [binance, kucoin]
 *     responses:
 *       200:
 *         description: Order placed successfully
 *       400:
 *         description: Invalid order parameters
 */
router.post('/orders',
  tradingRateLimit,
  requirePermission(Permission.TRADE_EXECUTE),
  validate(tradingSchemas.placeOrder),
  TradingController.placeOrder
);

/**
 * @swagger
 * /api/v1/trading/orders/{orderId}/cancel:
 *   post:
 *     summary: Cancel order
 *     tags: [Trading]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - exchange
 *             properties:
 *               exchange:
 *                 type: string
 *                 enum: [binance, kucoin]
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 *       400:
 *         description: Invalid parameters
 */
router.post('/orders/:orderId/cancel',
  requirePermission(Permission.TRADE_CANCEL),
  validate(tradingSchemas.cancelOrder),
  TradingController.cancelOrder
);

/**
 * @swagger
 * /api/v1/trading/orders/{orderId}/status:
 *   get:
 *     summary: Get order status
 *     tags: [Trading]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *       - in: query
 *         name: exchange
 *         required: true
 *         schema:
 *           type: string
 *           enum: [binance, kucoin]
 *         description: Exchange name
 *     responses:
 *       200:
 *         description: Order status retrieved successfully
 *       400:
 *         description: Missing exchange parameter
 */
router.get('/orders/:orderId/status',
  requirePermission(Permission.TRADE_VIEW),
  validate({ params: commonSchemas.id }),
  TradingController.getOrderStatus
);

/**
 * @swagger
 * /api/v1/trading/portfolio:
 *   get:
 *     summary: Get virtual portfolio summary
 *     tags: [Trading]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Virtual portfolio retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/portfolio',
  requirePermission(Permission.TRADE_VIEW),
  TradingController.getVirtualPortfolio
);

/**
 * @swagger
 * /api/v1/trading/portfolio/history:
 *   get:
 *     summary: Get paper trading history
 *     tags: [Trading]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *       - in: query
 *         name: symbol
 *         schema:
 *           type: string
 *         description: Filter by trading symbol
 *     responses:
 *       200:
 *         description: Paper trading history retrieved successfully
 */
router.get('/portfolio/history',
  requirePermission(Permission.TRADE_VIEW),
  validate({ query: commonSchemas.pagination }),
  TradingController.getPaperTradingHistory
);

/**
 * @swagger
 * /api/v1/trading/portfolio/performance:
 *   get:
 *     summary: Get portfolio performance metrics
 *     tags: [Trading]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance metrics retrieved successfully
 */
router.get('/portfolio/performance',
  requirePermission(Permission.TRADE_VIEW),
  TradingController.getPortfolioPerformance
);

/**
 * @swagger
 * /api/v1/trading/portfolio/positions:
 *   get:
 *     summary: Get current virtual positions
 *     tags: [Trading]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Virtual positions retrieved successfully
 */
router.get('/portfolio/positions',
  requirePermission(Permission.TRADE_VIEW),
  TradingController.getVirtualPositions
);

export default router;