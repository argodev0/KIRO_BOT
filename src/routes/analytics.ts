/**
 * Analytics Routes
 * API routes for performance analytics and reporting
 */

import { Router } from 'express';
import { AnalyticsController } from '../controllers/AnalyticsController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { analyticsValidation } from '../validation/analytics.validation';

const router = Router();
const analyticsController = new AnalyticsController();

// Apply authentication to all analytics routes
router.use(authenticateToken);

/**
 * @swagger
 * /api/analytics/performance:
 *   get:
 *     summary: Get comprehensive performance analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, quarterly, yearly, all_time, custom]
 *         description: Analytics period
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for custom period
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for custom period
 *     responses:
 *       200:
 *         description: Performance analytics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/performance', 
  validateRequest(analyticsValidation.getPerformanceAnalytics),
  analyticsController.getPerformanceAnalytics
);

/**
 * @swagger
 * /api/analytics/patterns:
 *   get:
 *     summary: Get pattern-specific analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, quarterly, yearly, all_time, custom]
 *       - in: query
 *         name: patternType
 *         schema:
 *           type: string
 *         description: Filter by specific pattern type
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Pattern analytics retrieved successfully
 */
router.get('/patterns',
  validateRequest(analyticsValidation.getPatternAnalytics),
  analyticsController.getPatternAnalytics
);

/**
 * @swagger
 * /api/analytics/elliott-wave:
 *   get:
 *     summary: Get Elliott Wave analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, quarterly, yearly, all_time, custom]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Elliott Wave analytics retrieved successfully
 */
router.get('/elliott-wave',
  validateRequest(analyticsValidation.getElliottWaveAnalytics),
  analyticsController.getElliottWaveAnalytics
);

/**
 * @swagger
 * /api/analytics/fibonacci:
 *   get:
 *     summary: Get Fibonacci analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, quarterly, yearly, all_time, custom]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Fibonacci analytics retrieved successfully
 */
router.get('/fibonacci',
  validateRequest(analyticsValidation.getFibonacciAnalytics),
  analyticsController.getFibonacciAnalytics
);

/**
 * @swagger
 * /api/analytics/grid:
 *   get:
 *     summary: Get grid trading analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, quarterly, yearly, all_time, custom]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Grid analytics retrieved successfully
 */
router.get('/grid',
  validateRequest(analyticsValidation.getGridAnalytics),
  analyticsController.getGridAnalytics
);

/**
 * @swagger
 * /api/analytics/portfolio:
 *   get:
 *     summary: Get portfolio performance over time
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, quarterly, yearly, all_time, custom]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Portfolio performance retrieved successfully
 */
router.get('/portfolio',
  validateRequest(analyticsValidation.getPortfolioPerformance),
  analyticsController.getPortfolioPerformance
);

/**
 * @swagger
 * /api/analytics/charts:
 *   get:
 *     summary: Get performance visualization charts
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: chartType
 *         schema:
 *           type: string
 *           enum: [line, bar, pie, doughnut, scatter, area, candlestick, heatmap]
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, quarterly, yearly, all_time, custom]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Performance charts retrieved successfully
 */
router.get('/charts',
  validateRequest(analyticsValidation.getPerformanceCharts),
  analyticsController.getPerformanceCharts
);

/**
 * @swagger
 * /api/analytics/trades:
 *   get:
 *     summary: Get trade execution analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: symbol
 *         schema:
 *           type: string
 *         description: Filter by trading symbol
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *     responses:
 *       200:
 *         description: Trade analytics retrieved successfully
 */
router.get('/trades',
  validateRequest(analyticsValidation.getTradeExecutionAnalytics),
  analyticsController.getTradeExecutionAnalytics
);

/**
 * @swagger
 * /api/analytics/risk:
 *   get:
 *     summary: Get risk metrics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, quarterly, yearly, all_time, custom]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Risk metrics retrieved successfully
 */
router.get('/risk',
  validateRequest(analyticsValidation.getRiskMetrics),
  analyticsController.getRiskMetrics
);

/**
 * @swagger
 * /api/analytics/comparison:
 *   get:
 *     summary: Get performance comparison across periods
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: comparePeriods
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [daily, weekly, monthly, quarterly, yearly]
 *         description: Periods to compare
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Performance comparison retrieved successfully
 */
router.get('/comparison',
  validateRequest(analyticsValidation.getPerformanceComparison),
  analyticsController.getPerformanceComparison
);

/**
 * @swagger
 * /api/analytics/reports:
 *   post:
 *     summary: Generate analytics report
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reportType:
 *                 type: string
 *                 enum: [performance_summary, pattern_analysis, elliott_wave_analysis, fibonacci_analysis, grid_analysis, risk_analysis, portfolio_analysis]
 *               period:
 *                 type: string
 *                 enum: [daily, weekly, monthly, quarterly, yearly, all_time, custom]
 *               format:
 *                 type: string
 *                 enum: [json, pdf, csv]
 *                 default: json
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *             required:
 *               - reportType
 *               - period
 *     responses:
 *       200:
 *         description: Report generated successfully
 */
router.post('/reports',
  validateRequest(analyticsValidation.generateReport),
  analyticsController.generateReport
);

export default router;