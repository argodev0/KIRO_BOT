import { Router } from 'express';
import { UserController } from '@/controllers/UserController';
import { authenticate, adminOnly } from '@/middleware/auth';
import { validate, userSchemas, commonSchemas } from '@/middleware/validation';
import { adminRateLimit } from '@/middleware/rateLimiter';

const router = Router();

// Apply authentication to all user routes
router.use(authenticate);

/**
 * @swagger
 * /api/v1/users/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       404:
 *         description: User not found
 */
router.get('/profile',
  UserController.getProfile
);

/**
 * @swagger
 * /api/v1/users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *               lastName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       409:
 *         description: Email already taken
 */
router.put('/profile',
  validate(userSchemas.updateProfile),
  UserController.updateProfile
);

/**
 * @swagger
 * /api/v1/users/settings:
 *   get:
 *     summary: Get user settings
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User settings retrieved successfully
 */
router.get('/settings',
  UserController.getSettings
);

/**
 * @swagger
 * /api/v1/users/settings/risk:
 *   put:
 *     summary: Update risk management settings
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maxRiskPerTrade:
 *                 type: number
 *                 minimum: 0.1
 *                 maximum: 10
 *                 description: Maximum risk per trade as percentage
 *               maxDailyLoss:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 20
 *                 description: Maximum daily loss as percentage
 *               maxTotalExposure:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 10
 *                 description: Maximum total exposure multiplier
 *               stopLossPercentage:
 *                 type: number
 *                 minimum: 0.5
 *                 maximum: 10
 *                 description: Default stop loss percentage
 *               takeProfitRatio:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 10
 *                 description: Take profit to stop loss ratio
 *     responses:
 *       200:
 *         description: Risk settings updated successfully
 */
router.put('/settings/risk',
  UserController.updateRiskSettings
);

/**
 * @swagger
 * /api/v1/users/settings/api-keys:
 *   put:
 *     summary: Update API keys
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - exchange
 *               - apiKey
 *               - apiSecret
 *             properties:
 *               exchange:
 *                 type: string
 *                 enum: [binance, kucoin]
 *               apiKey:
 *                 type: string
 *               apiSecret:
 *                 type: string
 *               passphrase:
 *                 type: string
 *                 description: Required for KuCoin
 *     responses:
 *       200:
 *         description: API keys updated successfully
 *       400:
 *         description: Invalid exchange or missing parameters
 */
router.put('/settings/api-keys',
  UserController.updateApiKeys
);

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: Get all users (admin only)
 *     tags: [Users]
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
 *         name: role
 *         schema:
 *           type: string
 *           enum: [USER, ADMIN, SUPER_ADMIN]
 *         description: Filter by user role
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       403:
 *         description: Admin access required
 */
router.get('/',
  adminOnly,
  adminRateLimit,
  validate({ query: commonSchemas.pagination }),
  UserController.getUsers
);

/**
 * @swagger
 * /api/v1/users/{id}/role:
 *   put:
 *     summary: Update user role (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [USER, ADMIN, SUPER_ADMIN]
 *     responses:
 *       200:
 *         description: User role updated successfully
 *       400:
 *         description: Invalid role or self-demotion attempt
 *       403:
 *         description: Admin access required
 */
router.put('/:id/role',
  adminOnly,
  validate(userSchemas.updateUserRole),
  UserController.updateUserRole
);

/**
 * @swagger
 * /api/v1/users/{id}/deactivate:
 *   post:
 *     summary: Deactivate user (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deactivated successfully
 *       400:
 *         description: Cannot deactivate own account
 *       403:
 *         description: Admin access required
 */
router.post('/:id/deactivate',
  adminOnly,
  validate({ params: commonSchemas.id }),
  UserController.deactivateUser
);

/**
 * @swagger
 * /api/v1/users/audit-logs:
 *   get:
 *     summary: Get audit logs
 *     tags: [Users]
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
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID (admin only)
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 */
router.get('/audit-logs',
  validate({ query: commonSchemas.pagination }),
  UserController.getAuditLogs
);

export default router;