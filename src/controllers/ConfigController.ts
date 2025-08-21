import { Response } from 'express';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import { PrismaClient } from '@prisma/client';
import { 
  BotConfig, 
  BotControlAction, 
  BotControlState, 
  ConfigBackup, 
  ConfigValidation,
  ConfigTemplate,
  BotStatus
} from '@/types/config';

const prisma = new PrismaClient();

export class ConfigController {
  /**
   * Get bot configurations
   */
  static async getConfigs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { page = 1, limit = 20, status } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where: any = { userId: req.user.userId };
      if (status) where.isActive = status === 'active';

      const [configs, total] = await Promise.all([
        prisma.botConfig.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { updatedAt: 'desc' }
        }),
        prisma.botConfig.count({ where })
      ]);

      res.json({
        success: true,
        data: configs,
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
      logger.error('Get configs error:', error);
      res.status(500).json({
        error: 'CONFIGS_FETCH_FAILED',
        message: 'Failed to fetch bot configurations'
      });
    }
  }

  /**
   * Get specific bot configuration
   */
  static async getConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { id } = req.params;

      const config = await prisma.botConfig.findFirst({
        where: {
          id,
          userId: req.user.userId
        }
      });

      if (!config) {
        res.status(404).json({
          error: 'CONFIG_NOT_FOUND',
          message: 'Bot configuration not found'
        });
        return;
      }

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      logger.error('Get config error:', error);
      res.status(500).json({
        error: 'CONFIG_FETCH_FAILED',
        message: 'Failed to fetch bot configuration'
      });
    }
  }

  /**
   * Create new bot configuration
   */
  static async createConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const configData: BotConfig = req.body;

      // Validate configuration
      const validation = await ConfigController.validateConfig(configData);
      if (!validation.isValid) {
        res.status(400).json({
          error: 'CONFIG_VALIDATION_FAILED',
          message: 'Configuration validation failed',
          errors: validation.errors
        });
        return;
      }

      // Create configuration in database
      const config = await prisma.botConfig.create({
        data: {
          userId: req.user.userId,
          name: configData.name,
          description: configData.description,
          isActive: false, // Start inactive for safety
          strategy: configData.strategy,
          riskManagement: configData.riskManagement,
          signalFilters: configData.signalFilters,
          gridConfig: configData.gridConfig,
          exchanges: configData.exchanges,
          notifications: configData.notifications
        }
      });

      res.status(201).json({
        success: true,
        message: 'Bot configuration created successfully',
        data: config
      });
    } catch (error) {
      logger.error('Create config error:', error);
      res.status(500).json({
        error: 'CONFIG_CREATION_FAILED',
        message: 'Failed to create bot configuration'
      });
    }
  }

  /**
   * Update bot configuration
   */
  static async updateConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const configData: Partial<BotConfig> = req.body;

      const existingConfig = await prisma.botConfig.findFirst({
        where: {
          id,
          userId: req.user.userId
        }
      });

      if (!existingConfig) {
        res.status(404).json({
          error: 'CONFIG_NOT_FOUND',
          message: 'Bot configuration not found'
        });
        return;
      }

      // Check if bot is running - prevent updates to critical settings
      const botStatus = await ConfigController.getBotStatus(id);
      if (botStatus.status === 'running' && ConfigController.hasCriticalChanges(existingConfig, configData)) {
        res.status(400).json({
          error: 'CONFIG_UPDATE_BLOCKED',
          message: 'Cannot update critical settings while bot is running. Stop the bot first.'
        });
        return;
      }

      // Validate updated configuration
      const mergedConfig = { ...existingConfig, ...configData };
      const validation = await ConfigController.validateConfig(mergedConfig);
      if (!validation.isValid) {
        res.status(400).json({
          error: 'CONFIG_VALIDATION_FAILED',
          message: 'Configuration validation failed',
          errors: validation.errors,
          warnings: validation.warnings
        });
        return;
      }

      // Update configuration
      const updatedConfig = await prisma.botConfig.update({
        where: { id },
        data: {
          ...configData,
          updatedAt: new Date()
        }
      });

      res.json({
        success: true,
        message: 'Bot configuration updated successfully',
        data: updatedConfig,
        validation: validation.warnings.length > 0 ? { warnings: validation.warnings } : undefined
      });
    } catch (error) {
      logger.error('Update config error:', error);
      res.status(500).json({
        error: 'CONFIG_UPDATE_FAILED',
        message: 'Failed to update bot configuration'
      });
    }
  }

  /**
   * Delete bot configuration
   */
  static async deleteConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { id } = req.params;

      const config = await prisma.botConfig.findFirst({
        where: {
          id,
          userId: req.user.userId
        }
      });

      if (!config) {
        res.status(404).json({
          error: 'CONFIG_NOT_FOUND',
          message: 'Bot configuration not found'
        });
        return;
      }

      // Check if bot is running
      const botStatus = await ConfigController.getBotStatus(id);
      if (botStatus.status === 'running') {
        res.status(400).json({
          error: 'CONFIG_DELETE_BLOCKED',
          message: 'Cannot delete configuration while bot is running. Stop the bot first.'
        });
        return;
      }

      await prisma.botConfig.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Bot configuration deleted successfully'
      });
    } catch (error) {
      logger.error('Delete config error:', error);
      res.status(500).json({
        error: 'CONFIG_DELETE_FAILED',
        message: 'Failed to delete bot configuration'
      });
    }
  }

  /**
   * Control bot (start/stop/pause)
   */
  static async controlBot(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const { action, confirmation, reason }: BotControlAction = req.body;

      const config = await prisma.botConfig.findFirst({
        where: {
          id,
          userId: req.user.userId
        }
      });

      if (!config) {
        res.status(404).json({
          error: 'CONFIG_NOT_FOUND',
          message: 'Bot configuration not found'
        });
        return;
      }

      // Get current bot status
      const currentStatus = await ConfigController.getBotStatus(id);

      // Validate action based on current status
      const validationResult = ConfigController.validateBotAction(currentStatus.status, action);
      if (!validationResult.isValid) {
        res.status(400).json({
          error: 'INVALID_BOT_ACTION',
          message: validationResult.message
        });
        return;
      }

      // Check for confirmation requirement
      if (ConfigController.requiresConfirmation(action, currentStatus) && !confirmation) {
        res.status(400).json({
          error: 'CONFIRMATION_REQUIRED',
          message: 'This action requires confirmation',
          confirmationRequired: true,
          warningMessage: ConfigController.getConfirmationMessage(action, currentStatus)
        });
        return;
      }

      // Execute bot control action
      const result = await ConfigController.executeBotAction(id, action, reason);

      res.json({
        success: true,
        message: `Bot ${action} executed successfully`,
        data: result
      });
    } catch (error) {
      logger.error('Control bot error:', error);
      res.status(500).json({
        error: 'BOT_CONTROL_FAILED',
        message: 'Failed to control bot'
      });
    }
  }

  /**
   * Get bot status
   */
  static async getBotStatusEndpoint(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { id } = req.params;

      const config = await prisma.botConfig.findFirst({
        where: {
          id,
          userId: req.user.userId
        }
      });

      if (!config) {
        res.status(404).json({
          error: 'CONFIG_NOT_FOUND',
          message: 'Bot configuration not found'
        });
        return;
      }

      const status = await ConfigController.getBotStatus(id);

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Get bot status error:', error);
      res.status(500).json({
        error: 'BOT_STATUS_FAILED',
        message: 'Failed to get bot status'
      });
    }
  }

  /**
   * Validate configuration
   */
  static async validateConfigEndpoint(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const configData: BotConfig = req.body;
      const validation = await ConfigController.validateConfig(configData);

      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      logger.error('Validate config error:', error);
      res.status(500).json({
        error: 'CONFIG_VALIDATION_FAILED',
        message: 'Failed to validate configuration'
      });
    }
  }

  /**
   * Backup configuration
   */
  static async backupConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const { name, description } = req.body;

      const config = await prisma.botConfig.findFirst({
        where: {
          id,
          userId: req.user.userId
        }
      });

      if (!config) {
        res.status(404).json({
          error: 'CONFIG_NOT_FOUND',
          message: 'Bot configuration not found'
        });
        return;
      }

      const backup: ConfigBackup = {
        id: `backup_${Date.now()}`,
        name: name || `Backup of ${config.name}`,
        description,
        config: config as BotConfig,
        createdAt: Date.now(),
        version: '1.0.0'
      };

      // Store backup (in production, this would be in a separate table)
      await prisma.configBackup.create({
        data: {
          userId: req.user.userId,
          configId: id,
          name: backup.name,
          description: backup.description,
          backupData: backup
        }
      });

      res.json({
        success: true,
        message: 'Configuration backed up successfully',
        data: backup
      });
    } catch (error) {
      logger.error('Backup config error:', error);
      res.status(500).json({
        error: 'CONFIG_BACKUP_FAILED',
        message: 'Failed to backup configuration'
      });
    }
  }

  /**
   * Restore configuration from backup
   */
  static async restoreConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const { backupId } = req.body;

      const backup = await prisma.configBackup.findFirst({
        where: {
          id: backupId,
          userId: req.user.userId
        }
      });

      if (!backup) {
        res.status(404).json({
          error: 'BACKUP_NOT_FOUND',
          message: 'Configuration backup not found'
        });
        return;
      }

      const config = await prisma.botConfig.findFirst({
        where: {
          id,
          userId: req.user.userId
        }
      });

      if (!config) {
        res.status(404).json({
          error: 'CONFIG_NOT_FOUND',
          message: 'Bot configuration not found'
        });
        return;
      }

      // Check if bot is running
      const botStatus = await ConfigController.getBotStatus(id);
      if (botStatus.status === 'running') {
        res.status(400).json({
          error: 'CONFIG_RESTORE_BLOCKED',
          message: 'Cannot restore configuration while bot is running. Stop the bot first.'
        });
        return;
      }

      const backupData = backup.backupData as ConfigBackup;
      
      // Restore configuration
      const restoredConfig = await prisma.botConfig.update({
        where: { id },
        data: {
          ...backupData.config,
          id: config.id, // Keep original ID
          userId: req.user.userId, // Keep original user ID
          updatedAt: new Date()
        }
      });

      res.json({
        success: true,
        message: 'Configuration restored successfully',
        data: restoredConfig
      });
    } catch (error) {
      logger.error('Restore config error:', error);
      res.status(500).json({
        error: 'CONFIG_RESTORE_FAILED',
        message: 'Failed to restore configuration'
      });
    }
  }

  /**
   * Get configuration templates
   */
  static async getTemplates(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { category } = req.query;

      const templates = await ConfigController.getConfigTemplates(category as string);

      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      logger.error('Get templates error:', error);
      res.status(500).json({
        error: 'TEMPLATES_FETCH_FAILED',
        message: 'Failed to fetch configuration templates'
      });
    }
  }

  // Private helper methods

  private static async validateConfig(config: BotConfig): Promise<ConfigValidation> {
    const errors: any[] = [];
    const warnings: any[] = [];

    // Validate required fields
    if (!config.name || config.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Configuration name is required', code: 'REQUIRED' });
    }

    if (!config.strategy) {
      errors.push({ field: 'strategy', message: 'Strategy configuration is required', code: 'REQUIRED' });
    }

    // Validate risk management
    if (config.riskManagement) {
      if (config.riskManagement.maxRiskPerTrade > 10) {
        warnings.push({ 
          field: 'riskManagement.maxRiskPerTrade', 
          message: 'Risk per trade exceeds 10%', 
          suggestion: 'Consider reducing to 3-5% for better risk management' 
        });
      }

      if (config.riskManagement.maxDailyLoss > 20) {
        errors.push({ 
          field: 'riskManagement.maxDailyLoss', 
          message: 'Daily loss limit cannot exceed 20%', 
          code: 'INVALID_VALUE' 
        });
      }
    }

    // Validate exchanges
    if (!config.exchanges || config.exchanges.length === 0) {
      errors.push({ field: 'exchanges', message: 'At least one exchange must be configured', code: 'REQUIRED' });
    }

    // Validate strategy parameters
    if (config.strategy.symbols.length === 0) {
      errors.push({ field: 'strategy.symbols', message: 'At least one trading symbol must be specified', code: 'REQUIRED' });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private static hasCriticalChanges(existing: any, updates: any): boolean {
    const criticalFields = [
      'strategy.type',
      'riskManagement.maxRiskPerTrade',
      'riskManagement.maxDailyLoss',
      'exchanges'
    ];

    return criticalFields.some(field => {
      const existingValue = ConfigController.getNestedValue(existing, field);
      const updateValue = ConfigController.getNestedValue(updates, field);
      return updateValue !== undefined && existingValue !== updateValue;
    });
  }

  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private static async getBotStatus(configId: string): Promise<BotControlState> {
    // In a real implementation, this would check the actual bot status
    // For now, return a mock status
    return {
      status: 'stopped' as BotStatus,
      runningTime: 0,
      totalTrades: 0,
      activePositions: 0,
      totalProfit: 0,
      currentDrawdown: 0
    };
  }

  private static validateBotAction(currentStatus: BotStatus, action: string): { isValid: boolean; message?: string } {
    const validTransitions: Record<BotStatus, string[]> = {
      'stopped': ['start'],
      'starting': [],
      'running': ['stop', 'pause'],
      'pausing': [],
      'paused': ['resume', 'stop'],
      'stopping': [],
      'error': ['start', 'stop']
    };

    const validActions = validTransitions[currentStatus] || [];
    
    if (!validActions.includes(action)) {
      return {
        isValid: false,
        message: `Cannot ${action} bot when status is ${currentStatus}`
      };
    }

    return { isValid: true };
  }

  private static requiresConfirmation(action: string, status: BotControlState): boolean {
    return action === 'stop' && status.activePositions > 0;
  }

  private static getConfirmationMessage(action: string, status: BotControlState): string {
    if (action === 'stop' && status.activePositions > 0) {
      return `Bot has ${status.activePositions} active positions. Stopping will close all positions. Are you sure?`;
    }
    return `Are you sure you want to ${action} the bot?`;
  }

  private static async executeBotAction(configId: string, action: string, reason?: string): Promise<BotControlState> {
    // In a real implementation, this would actually control the bot
    logger.info(`Executing bot action: ${action} for config ${configId}`, { reason });
    
    // Mock implementation
    const newStatus: BotStatus = action === 'start' ? 'running' : 
                                action === 'stop' ? 'stopped' : 
                                action === 'pause' ? 'paused' : 'running';

    return {
      status: newStatus,
      lastStarted: action === 'start' ? Date.now() : undefined,
      lastStopped: action === 'stop' ? Date.now() : undefined,
      runningTime: 0,
      totalTrades: 0,
      activePositions: 0,
      totalProfit: 0,
      currentDrawdown: 0
    };
  }

  private static async getConfigTemplates(category?: string): Promise<ConfigTemplate[]> {
    // Mock templates - in production, these would be stored in database
    const templates: ConfigTemplate[] = [
      {
        id: 'conservative',
        name: 'Conservative Trading',
        description: 'Low-risk configuration with strict risk management',
        category: 'conservative',
        config: {
          name: 'Conservative Bot',
          strategy: {
            type: 'technical_analysis',
            parameters: {
              technicalAnalysis: {
                indicators: {
                  rsi: { enabled: true, period: 14, overbought: 70, oversold: 30 },
                  waveTrend: { enabled: true, n1: 10, n2: 21 },
                  pvt: { enabled: true, period: 14 }
                },
                patterns: { enabled: true, minConfidence: 80, patternTypes: ['hammer', 'doji'] },
                confluence: { minFactors: 3, requiredIndicators: ['rsi', 'waveTrend'] }
              }
            },
            timeframes: ['1h', '4h'],
            symbols: ['BTCUSDT'],
            maxConcurrentTrades: 2
          },
          riskManagement: {
            maxRiskPerTrade: 1,
            maxDailyLoss: 3,
            maxTotalExposure: 2,
            maxDrawdown: 5,
            stopLossRequired: true,
            maxLeverage: 1,
            emergencyStop: {
              enabled: true,
              triggers: {
                maxDailyLoss: true,
                maxDrawdown: true,
                consecutiveLosses: { enabled: true, count: 3 },
                marketVolatility: { enabled: true, threshold: 0.05 }
              },
              actions: {
                closeAllPositions: true,
                pauseTrading: true,
                sendNotification: true
              }
            },
            positionSizing: {
              method: 'percentage',
              baseSize: 1,
              maxSize: 2,
              volatilityAdjustment: true,
              correlationAdjustment: true
            },
            correlationLimits: {
              enabled: true,
              maxCorrelatedPositions: 1,
              correlationThreshold: 0.7,
              timeframe: '1h'
            },
            drawdownProtection: {
              enabled: true,
              maxDrawdown: 5,
              reductionSteps: [
                { threshold: 3, action: 'reduce_size', parameter: 50 },
                { threshold: 5, action: 'pause_trading', parameter: 60 }
              ],
              recoveryThreshold: 2
            }
          },
          signalFilters: {
            confidence: {
              enabled: true,
              minConfidence: 75,
              maxSignalsPerHour: 2,
              cooldownPeriod: 30
            },
            technical: {
              enabled: true,
              requiredIndicators: ['rsi', 'waveTrend'],
              indicatorThresholds: { rsi: 70 },
              trendAlignment: true
            },
            patterns: {
              enabled: true,
              allowedPatterns: ['hammer', 'doji', 'engulfing_bullish'],
              minPatternStrength: 70,
              multiTimeframeConfirmation: true
            },
            confluence: {
              enabled: true,
              minConfluenceFactors: 3,
              requiredFactorTypes: ['technical', 'pattern'],
              confluenceWeight: 0.8
            },
            timeframe: {
              enabled: true,
              primaryTimeframe: '1h',
              confirmationTimeframes: ['4h'],
              alignmentRequired: true
            },
            volume: {
              enabled: true,
              minVolumeRatio: 1.2,
              volumeTrendRequired: false,
              unusualVolumeDetection: true
            }
          },
          exchanges: [
            {
              name: 'binance',
              enabled: true,
              testnet: true,
              rateLimits: { ordersPerSecond: 1, requestsPerMinute: 60 },
              fees: { maker: 0.001, taker: 0.001 },
              symbols: ['BTCUSDT']
            }
          ],
          notifications: {
            email: { enabled: true, events: ['risk_violation', 'emergency_stop'] },
            webhook: { enabled: false, events: [] },
            inApp: { enabled: true, events: ['signal_generated', 'trade_executed'], sound: true }
          },
          isActive: false
        } as BotConfig,
        tags: ['safe', 'beginner', 'low-risk']
      }
    ];

    return category ? templates.filter(t => t.category === category) : templates;
  }
}