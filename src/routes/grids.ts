import { Router } from 'express';
import { GridController } from '@/controllers/GridController';
import { authenticate, requirePermission } from '@/middleware/auth';
import { validate } from '@/middleware/inputValidation';
import { gridSchemas, commonSchemas } from '@/middleware/validation';
import { tradingRateLimit } from '@/middleware/rateLimiter';
import { Permission } from '@/types/auth';

const router = Router();

// Apply authentication to all grid routes
router.use(authenticate);

/**
 * @swagger
 * /api/v1/grids:
 *   get:
 *     summary: Get user's grids
 *     tags: [Grid Trading]
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
 *           enum: [ACTIVE, PAUSED, CLOSED, ERROR]
 *         description: Filter by grid status
 *       - in: query
 *         name: symbol
 *         schema:
 *           type: string
 *         description: Filter by trading symbol
 *       - in: query
 *         name: strategy
 *         schema:
 *           type: string
 *           enum: [elliott-wave, fibonacci, standard, dynamic]
 *         description: Filter by grid strategy
 *     responses:
 *       200:
 *         description: Grids retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/',
  requirePermission(Permission.GRID_VIEW),
  validate({ query: commonSchemas.pagination }),
  GridController.getGrids
);

/**
 * @swagger
 * /api/v1/grids/{id}:
 *   get:
 *     summary: Get specific grid
 *     tags: [Grid Trading]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Grid ID
 *     responses:
 *       200:
 *         description: Grid retrieved successfully
 *       404:
 *         description: Grid not found
 */
router.get('/:id',
  requirePermission(Permission.GRID_VIEW),
  validate({ params: commonSchemas.id }),
  GridController.getGrid
);

/**
 * @swagger
 * /api/v1/grids:
 *   post:
 *     summary: Create new grid
 *     tags: [Grid Trading]
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
 *               - strategy
 *               - basePrice
 *               - spacing
 *               - levels
 *             properties:
 *               symbol:
 *                 type: string
 *               strategy:
 *                 type: string
 *                 enum: [elliott-wave, fibonacci, standard, dynamic]
 *               basePrice:
 *                 type: number
 *                 minimum: 0
 *               spacing:
 *                 type: number
 *                 minimum: 0
 *               levels:
 *                 type: array
 *                 minItems: 2
 *                 items:
 *                   type: object
 *                   required:
 *                     - price
 *                     - quantity
 *                     - side
 *                   properties:
 *                     price:
 *                       type: number
 *                       minimum: 0
 *                     quantity:
 *                       type: number
 *                       minimum: 0
 *                     side:
 *                       type: string
 *                       enum: [buy, sell]
 *     responses:
 *       201:
 *         description: Grid created successfully
 *       400:
 *         description: Invalid grid parameters
 */
router.post('/',
  tradingRateLimit,
  requirePermission(Permission.GRID_CREATE),
  validate(gridSchemas.createGrid),
  GridController.createGrid
);

/**
 * @swagger
 * /api/v1/grids/{id}:
 *   put:
 *     summary: Update grid
 *     tags: [Grid Trading]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Grid ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, paused, closed]
 *               levels:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - price
 *                     - quantity
 *                     - side
 *                   properties:
 *                     price:
 *                       type: number
 *                       minimum: 0
 *                     quantity:
 *                       type: number
 *                       minimum: 0
 *                     side:
 *                       type: string
 *                       enum: [buy, sell]
 *     responses:
 *       200:
 *         description: Grid updated successfully
 *       404:
 *         description: Grid not found
 */
router.put('/:id',
  requirePermission(Permission.GRID_MANAGE),
  validate(gridSchemas.updateGrid),
  GridController.updateGrid
);

/**
 * @swagger
 * /api/v1/grids/{id}/close:
 *   post:
 *     summary: Close grid
 *     tags: [Grid Trading]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Grid ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for closing the grid
 *     responses:
 *       200:
 *         description: Grid closed successfully
 *       404:
 *         description: Grid not found or already closed
 */
router.post('/:id/close',
  requirePermission(Permission.GRID_MANAGE),
  validate({ params: commonSchemas.id }),
  GridController.closeGrid
);

/**
 * @swagger
 * /api/v1/grids/{id}/performance:
 *   get:
 *     summary: Get grid performance
 *     tags: [Grid Trading]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Grid ID
 *     responses:
 *       200:
 *         description: Grid performance retrieved successfully
 *       404:
 *         description: Grid not found
 */
router.get('/:id/performance',
  requirePermission(Permission.GRID_VIEW),
  validate({ params: commonSchemas.id }),
  GridController.getGridPerformance
);

/**
 * @swagger
 * /api/v1/grids/stats:
 *   get:
 *     summary: Get grid statistics
 *     tags: [Grid Trading]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Grid statistics retrieved successfully
 */
router.get('/stats',
  requirePermission(Permission.GRID_VIEW),
  GridController.getGridStats
);

export default router;