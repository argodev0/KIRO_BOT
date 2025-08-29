import { Router, Request, Response } from 'express';
import { loggingConfigService } from '@/services/LoggingConfigService';
import { logRetentionService } from '@/services/LogRetentionService';
import { auditLogService } from '@/services/AuditLogService';
import { logger } from '@/utils/logger';
import { authenticate as auth } from '@/middleware/auth';
import { validate } from '@/middleware/validation';
import Joi from 'joi';

const router = Router();

// Validation schemas
const configUpdateSchema = Joi.object({
  level: Joi.string().valid('error', 'warn', 'info', 'http', 'debug', 'trace').optional(),
  enableConsoleLogging: Joi.boolean().optional(),
  enableFileLogging: Joi.boolean().optional(),
  enableElasticsearchLogging: Joi.boolean().optional(),
  enableAuditLogging: Joi.boolean().optional(),
  enablePerformanceLogging: Joi.boolean().optional(),
  enableSecurityLogging: Joi.boolean().optional(),
  enableTradingLogging: Joi.boolean().optional(),
  logRotation: Joi.object({
    enabled: Joi.boolean().optional(),
    maxSize: Joi.string().pattern(/^\d+[kmg]$/i).optional(),
    maxFiles: Joi.string().optional()
  }).optional(),
  retention: Joi.object({
    enabled: Joi.boolean().optional(),
    defaultDays: Joi.number().min(1).max(3650).optional()
  }).optional(),
  elasticsearch: Joi.object({
    host: Joi.string().uri().optional(),
    index: Joi.string().optional(),
    enabled: Joi.boolean().optional()
  }).optional(),
  sensitiveFields: Joi.array().items(Joi.string()).optional(),
  excludePaths: Joi.array().items(Joi.string()).optional()
});

const retentionPolicySchema = Joi.object({
  logType: Joi.string().required(),
  retentionDays: Joi.number().min(1).max(3650).required(),
  compressionEnabled: Joi.boolean().required(),
  archiveLocation: Joi.string().optional()
});

/**
 * @swagger
 * /api/logging/config:
 *   get:
 *     summary: Get current logging configuration
 *     tags: [Logging]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current logging configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 config:
 *                   type: object
 *                 statistics:
 *                   type: object
 */
router.get('/config', auth, async (req: Request, res: Response) => {
  try {
    const config = loggingConfigService.getConfiguration();
    const statistics = await loggingConfigService.getLoggingStatistics();

    auditLogService.logConfigurationAuditEvent({
      action: 'logging_config_viewed',
      resource: 'logging_configuration',
      success: true,
      configType: 'environment',
      configKey: 'logging_config',
      ...auditLogService.extractRequestContext(req)
    });

    res.json({
      success: true,
      data: {
        config,
        statistics
      }
    });
  } catch (error) {
    logger.error('Failed to get logging configuration', { error: error.message });
    
    auditLogService.logConfigurationAuditEvent({
      action: 'logging_config_view_failed',
      resource: 'logging_configuration',
      success: false,
      configType: 'environment',
      configKey: 'logging_config',
      reason: error.message,
      ...auditLogService.extractRequestContext(req)
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get logging configuration'
    });
  }
});

/**
 * @swagger
 * /api/logging/config:
 *   put:
 *     summary: Update logging configuration
 *     tags: [Logging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               level:
 *                 type: string
 *                 enum: [error, warn, info, http, debug, trace]
 *               enableConsoleLogging:
 *                 type: boolean
 *               enableFileLogging:
 *                 type: boolean
 *               enableElasticsearchLogging:
 *                 type: boolean
 *               enableAuditLogging:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Configuration updated successfully
 *       400:
 *         description: Invalid configuration
 */
router.put('/config', auth, validate({ body: configUpdateSchema }), async (req: Request, res: Response) => {
  try {
    const oldConfig = loggingConfigService.getConfiguration();
    
    // Validate the new configuration
    const validation = loggingConfigService.validateConfiguration(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration',
        details: validation.errors
      });
    }

    // Update configuration
    loggingConfigService.updateConfiguration(req.body);
    const newConfig = loggingConfigService.getConfiguration();

    auditLogService.logConfigurationChange(
      'environment',
      'logging_config',
      oldConfig,
      newConfig,
      req,
      true
    );

    res.json({
      success: true,
      message: 'Logging configuration updated successfully',
      data: { config: newConfig }
    });
  } catch (error) {
    logger.error('Failed to update logging configuration', { error: error.message });
    
    auditLogService.logConfigurationChange(
      'environment',
      'logging_config',
      req.body,
      null,
      req,
      false,
      error.message
    );

    res.status(500).json({
      success: false,
      error: 'Failed to update logging configuration'
    });
  }
});

/**
 * @swagger
 * /api/logging/health:
 *   get:
 *     summary: Check logging system health
 *     tags: [Logging]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logging system health status
 */
router.get('/health', auth, async (req: Request, res: Response) => {
  try {
    const healthStatus = await loggingConfigService.testLoggingHealth();

    auditLogService.logSystemHealthEvent(
      'logging_system',
      healthStatus.healthy ? 'healthy' : 'unhealthy',
      healthStatus.tests,
      healthStatus.issues.length > 0 ? healthStatus.issues.join('; ') : undefined
    );

    res.json({
      success: true,
      data: healthStatus
    });
  } catch (error) {
    logger.error('Failed to check logging health', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to check logging system health'
    });
  }
});

/**
 * @swagger
 * /api/logging/retention/policies:
 *   get:
 *     summary: Get log retention policies
 *     tags: [Logging]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current retention policies
 */
router.get('/retention/policies', auth, async (req: Request, res: Response) => {
  try {
    const policies = Array.from(logRetentionService['retentionPolicies'].entries()).map(
      ([logType, policy]) => ({ logType, ...policy })
    );

    res.json({
      success: true,
      data: { policies }
    });
  } catch (error) {
    logger.error('Failed to get retention policies', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get retention policies'
    });
  }
});

/**
 * @swagger
 * /api/logging/retention/policies:
 *   post:
 *     summary: Add or update retention policy
 *     tags: [Logging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [logType, retentionDays, compressionEnabled]
 *             properties:
 *               logType:
 *                 type: string
 *               retentionDays:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 3650
 *               compressionEnabled:
 *                 type: boolean
 *               archiveLocation:
 *                 type: string
 *     responses:
 *       200:
 *         description: Retention policy updated successfully
 */
router.post('/retention/policies', auth, validate({ body: retentionPolicySchema }), async (req: Request, res: Response) => {
  try {
    const { logType, retentionDays, compressionEnabled, archiveLocation } = req.body;
    
    const oldPolicy = logRetentionService.getRetentionPolicy(logType);
    
    logRetentionService.setRetentionPolicy({
      logType,
      retentionDays,
      compressionEnabled,
      archiveLocation
    });

    auditLogService.logConfigurationChange(
      'environment',
      `retention_policy_${logType}`,
      oldPolicy,
      req.body,
      req,
      true
    );

    res.json({
      success: true,
      message: 'Retention policy updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update retention policy', { error: error.message });
    
    auditLogService.logConfigurationChange(
      'environment',
      `retention_policy_${req.body.logType}`,
      req.body,
      null,
      req,
      false,
      error.message
    );

    res.status(500).json({
      success: false,
      error: 'Failed to update retention policy'
    });
  }
});

/**
 * @swagger
 * /api/logging/retention/cleanup:
 *   post:
 *     summary: Force log cleanup
 *     tags: [Logging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               logType:
 *                 type: string
 *                 description: Specific log type to clean up (optional)
 *     responses:
 *       200:
 *         description: Cleanup completed successfully
 */
router.post('/retention/cleanup', auth, async (req: Request, res: Response) => {
  try {
    const { logType } = req.body;
    
    let result;
    if (logType) {
      result = await logRetentionService.forceCleanup(logType);
    } else {
      result = await logRetentionService.performCleanup();
    }

    auditLogService.logDataRetentionEvent(
      'cleanup_completed',
      logType || 'all_logs',
      result.filesDeleted + result.filesArchived,
      result.errors.length === 0,
      result.errors.length > 0 ? result.errors.join('; ') : 'Manual cleanup completed successfully'
    );

    res.json({
      success: true,
      message: 'Log cleanup completed successfully',
      data: result
    });
  } catch (error) {
    logger.error('Failed to perform log cleanup', { error: error.message });
    
    auditLogService.logDataRetentionEvent(
      'cleanup_completed',
      req.body.logType || 'all_logs',
      0,
      false,
      `Manual cleanup failed: ${error.message}`
    );

    res.status(500).json({
      success: false,
      error: 'Failed to perform log cleanup'
    });
  }
});

/**
 * @swagger
 * /api/logging/retention/statistics:
 *   get:
 *     summary: Get log cleanup statistics
 *     tags: [Logging]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Log cleanup statistics
 */
router.get('/retention/statistics', auth, async (req: Request, res: Response) => {
  try {
    const statistics = await logRetentionService.getCleanupStatistics();

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    logger.error('Failed to get cleanup statistics', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get cleanup statistics'
    });
  }
});

/**
 * @swagger
 * /api/logging/config/export:
 *   get:
 *     summary: Export logging configuration
 *     tags: [Logging]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuration exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/config/export', auth, async (req: Request, res: Response) => {
  try {
    const configJson = loggingConfigService.exportConfiguration();

    auditLogService.logConfigurationAuditEvent({
      action: 'logging_config_exported',
      resource: 'logging_configuration',
      success: true,
      configType: 'environment',
      configKey: 'logging_config',
      ...auditLogService.extractRequestContext(req)
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="logging-config.json"');
    res.send(configJson);
  } catch (error) {
    logger.error('Failed to export logging configuration', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to export logging configuration'
    });
  }
});

/**
 * @swagger
 * /api/logging/config/import:
 *   post:
 *     summary: Import logging configuration
 *     tags: [Logging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               config:
 *                 type: string
 *                 description: JSON string of the configuration to import
 *     responses:
 *       200:
 *         description: Configuration imported successfully
 *       400:
 *         description: Invalid configuration format
 */
router.post('/config/import', auth, async (req: Request, res: Response) => {
  try {
    const { config: configJson } = req.body;
    
    if (!configJson || typeof configJson !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration format. Expected JSON string.'
      });
    }

    loggingConfigService.importConfiguration(configJson);

    auditLogService.logConfigurationAuditEvent({
      action: 'logging_config_imported',
      resource: 'logging_configuration',
      success: true,
      configType: 'environment',
      configKey: 'logging_config',
      ...auditLogService.extractRequestContext(req)
    });

    res.json({
      success: true,
      message: 'Logging configuration imported successfully'
    });
  } catch (error) {
    logger.error('Failed to import logging configuration', { error: error.message });
    
    auditLogService.logConfigurationAuditEvent({
      action: 'logging_config_import_failed',
      resource: 'logging_configuration',
      success: false,
      configType: 'environment',
      configKey: 'logging_config',
      reason: error.message,
      ...auditLogService.extractRequestContext(req)
    });

    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

export default router;