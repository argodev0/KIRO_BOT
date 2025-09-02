/**
 * Hummingbot Configuration Manager
 * Manages configurations for multiple Hummingbot instances
 */

import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import { 
  HBConfig, 
  ConfigTemplate, 
  ConfigParams, 
  ValidationResult, 
  HBInstance,
  InstanceSettings,
  StrategyConfig,
  ExchangeSettings,
  RiskSettings,
  HBStrategy,
  HBStrategyType
} from '../types';
import { EncryptionService } from './EncryptionService';

export interface ConfigurationManagerOptions {
  encryptSensitiveData: boolean;
  validateOnSave: boolean;
  enableVersioning: boolean;
  maxVersionsPerConfig: number;
  enableTemplates: boolean;
}

export class HummingbotConfigurationManager extends EventEmitter {
  private prisma: PrismaClient;
  private encryptionService: EncryptionService;
  private options: ConfigurationManagerOptions;
  private templates: Map<string, ConfigTemplate> = new Map();

  constructor(
    prisma: PrismaClient,
    encryptionService: EncryptionService,
    options: Partial<ConfigurationManagerOptions> = {}
  ) {
    super();

    this.prisma = prisma;
    this.encryptionService = encryptionService;
    this.options = {
      encryptSensitiveData: true,
      validateOnSave: true,
      enableVersioning: true,
      maxVersionsPerConfig: 10,
      enableTemplates: true,
      ...options
    };

    this.initializeDefaultTemplates();
  }

  /**
   * Create a new configuration
   */
  async createConfiguration(
    userId: string,
    template: ConfigTemplate,
    params: ConfigParams
  ): Promise<HBConfig> {
    try {
      // Get template
      const configTemplate = this.templates.get(template.id) || template;
      
      // Merge template with custom parameters
      const config = await this.buildConfigFromTemplate(configTemplate, params);

      // Validate configuration
      if (this.options.validateOnSave) {
        const validation = await this.validateConfiguration(config);
        if (!validation.isValid) {
          throw new Error(`Configuration validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
        }
      }

      // Encrypt sensitive data
      const configData = this.options.encryptSensitiveData 
        ? await this.encryptSensitiveFields(config)
        : config;

      // Save to database
      const savedConfig = await this.prisma.hummingbotConfiguration.create({
        data: {
          userId,
          name: `${configTemplate.name}_${Date.now()}`,
          description: `Configuration based on ${configTemplate.name} template`,
          configType: 'instance',
          configData: configData as any,
          version: '1.0.0',
          isActive: true
        }
      });

      this.emit('configuration:created', { configId: savedConfig.id, userId, template: configTemplate.name });

      return config;
    } catch (error) {
      this.emit('configuration:create_failed', { userId, template: template.name, error });
      throw error;
    }
  }

  /**
   * Load configuration by ID
   */
  async loadConfiguration(configId: string): Promise<HBConfig> {
    try {
      const config = await this.prisma.hummingbotConfiguration.findUnique({
        where: { id: configId }
      });

      if (!config) {
        throw new Error(`Configuration not found: ${configId}`);
      }

      // Decrypt sensitive data
      const configData = this.options.encryptSensitiveData
        ? await this.decryptSensitiveFields(config.configData as any)
        : config.configData as any;

      this.emit('configuration:loaded', { configId, userId: config.userId });

      return configData;
    } catch (error) {
      this.emit('configuration:load_failed', { configId, error });
      throw error;
    }
  }

  /**
   * Save configuration
   */
  async saveConfiguration(configId: string, config: HBConfig): Promise<string> {
    try {
      // Validate configuration
      if (this.options.validateOnSave) {
        const validation = await this.validateConfiguration(config);
        if (!validation.isValid) {
          throw new Error(`Configuration validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
        }
      }

      // Handle versioning
      if (this.options.enableVersioning) {
        await this.createConfigVersion(configId);
      }

      // Encrypt sensitive data
      const configData = this.options.encryptSensitiveData
        ? await this.encryptSensitiveFields(config)
        : config;

      // Update configuration
      const updatedConfig = await this.prisma.hummingbotConfiguration.update({
        where: { id: configId },
        data: {
          configData: configData as any,
          updatedAt: new Date()
        }
      });

      this.emit('configuration:saved', { configId, userId: updatedConfig.userId });

      return configId;
    } catch (error) {
      this.emit('configuration:save_failed', { configId, error });
      throw error;
    }
  }

  /**
   * Validate configuration
   */
  async validateConfiguration(config: HBConfig): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];
    const suggestions: any[] = [];

    try {
      // Validate instance settings
      if (!config.instanceSettings) {
        errors.push({
          field: 'instanceSettings',
          message: 'Instance settings are required',
          code: 'REQUIRED',
          severity: 'error'
        });
      } else {
        const instanceValidation = this.validateInstanceSettings(config.instanceSettings);
        errors.push(...instanceValidation.errors);
        warnings.push(...instanceValidation.warnings);
      }

      // Validate strategy configurations
      if (!config.strategyConfigs || config.strategyConfigs.length === 0) {
        warnings.push({
          field: 'strategyConfigs',
          message: 'No strategy configurations defined',
          code: 'EMPTY',
          impact: 'medium'
        });
      } else {
        for (const strategyConfig of config.strategyConfigs) {
          const strategyValidation = this.validateStrategyConfig(strategyConfig);
          errors.push(...strategyValidation.errors);
          warnings.push(...strategyValidation.warnings);
        }
      }

      // Validate exchange settings
      if (!config.exchangeSettings) {
        errors.push({
          field: 'exchangeSettings',
          message: 'Exchange settings are required',
          code: 'REQUIRED',
          severity: 'error'
        });
      } else {
        const exchangeValidation = this.validateExchangeSettings(config.exchangeSettings);
        errors.push(...exchangeValidation.errors);
        warnings.push(...exchangeValidation.warnings);
      }

      // Validate risk settings
      if (config.riskSettings) {
        const riskValidation = this.validateRiskSettings(config.riskSettings);
        errors.push(...riskValidation.errors);
        warnings.push(...riskValidation.warnings);
        suggestions.push(...riskValidation.suggestions);
      }

      // Version compatibility check
      const versionCheck = await this.checkVersionCompatibility(config.version);
      if (!versionCheck.compatible) {
        warnings.push({
          field: 'version',
          message: `Configuration version ${config.version} may not be compatible with current Hummingbot version`,
          code: 'VERSION_MISMATCH',
          impact: 'high'
        });
      }
      
      // Add version-specific issues as warnings
      for (const issue of versionCheck.issues) {
        warnings.push({
          field: 'version',
          message: issue,
          code: 'VERSION_ISSUE',
          impact: 'medium'
        });
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions
      };
    } catch (error) {
      errors.push({
        field: 'general',
        message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'VALIDATION_ERROR',
        severity: 'error'
      });

      return {
        isValid: false,
        errors,
        warnings,
        suggestions
      };
    }
  }

  /**
   * Migrate configuration to new version
   */
  async migrateConfiguration(configId: string, targetVersion: string): Promise<HBConfig> {
    try {
      const config = await this.loadConfiguration(configId);
      
      // Create backup before migration
      await this.createConfigVersion(configId);

      // Perform migration based on version differences
      const migratedConfig = await this.performVersionMigration(config, targetVersion);

      // Save migrated configuration
      await this.saveConfiguration(configId, migratedConfig);

      this.emit('configuration:migrated', { configId, fromVersion: config.version, toVersion: targetVersion });

      return migratedConfig;
    } catch (error) {
      this.emit('configuration:migration_failed', { configId, targetVersion, error });
      throw error;
    }
  }

  /**
   * Get available configuration templates
   */
  getConfigurationTemplates(): ConfigTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Add custom configuration template
   */
  addConfigurationTemplate(template: ConfigTemplate): void {
    // Validate template before adding
    const validation = this.validateTemplate(template);
    if (!validation.isValid) {
      throw new Error(`Template validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    this.templates.set(template.id, template);
    this.emit('template:added', { templateId: template.id, name: template.name });
  }

  /**
   * Validate configuration template
   */
  private validateTemplate(template: ConfigTemplate): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];
    const suggestions: any[] = [];

    // Required fields validation
    if (!template.id) {
      errors.push({
        field: 'id',
        message: 'Template ID is required',
        code: 'REQUIRED',
        severity: 'error'
      });
    }

    if (!template.name) {
      errors.push({
        field: 'name',
        message: 'Template name is required',
        code: 'REQUIRED',
        severity: 'error'
      });
    }

    if (!template.strategyType) {
      errors.push({
        field: 'strategyType',
        message: 'Strategy type is required',
        code: 'REQUIRED',
        severity: 'error'
      });
    } else {
      // Validate strategy type is supported by Hummingbot
      const supportedStrategies = [
        'pure_market_making',
        'cross_exchange_market_making',
        'arbitrage',
        'grid_trading',
        'perpetual_market_making',
        'liquidity_mining',
        'spot_perpetual_arbitrage'
      ];

      if (!supportedStrategies.includes(template.strategyType)) {
        errors.push({
          field: 'strategyType',
          message: `Strategy type '${template.strategyType}' is not supported by Hummingbot`,
          code: 'UNSUPPORTED_STRATEGY',
          severity: 'error'
        });
      }
    }

    // Validate required parameters
    if (!template.requiredParameters || template.requiredParameters.length === 0) {
      warnings.push({
        field: 'requiredParameters',
        message: 'No required parameters defined - template may be too generic',
        code: 'NO_REQUIRED_PARAMS',
        impact: 'medium'
      });
    }

    // Validate default parameters
    if (template.defaultParameters) {
      for (const [key, value] of Object.entries(template.defaultParameters)) {
        if (typeof value === 'number' && value < 0 && (key.toLowerCase().includes('spread') || key.toLowerCase().includes('amount') || key.toLowerCase().includes('profitability'))) {
          errors.push({
            field: `defaultParameters.${key}`,
            message: `Default parameter '${key}' cannot be negative`,
            code: 'INVALID_DEFAULT',
            severity: 'error'
          });
        }
      }
    }

    // Validate risk profile
    const validRiskProfiles = ['conservative', 'moderate', 'aggressive'];
    if (template.riskProfile && !validRiskProfiles.includes(template.riskProfile)) {
      errors.push({
        field: 'riskProfile',
        message: `Risk profile must be one of: ${validRiskProfiles.join(', ')}`,
        code: 'INVALID_RISK_PROFILE',
        severity: 'error'
      });
    }

    // Validate minimum capital
    if (template.minimumCapital !== undefined) {
      if (template.minimumCapital < 0) {
        errors.push({
          field: 'minimumCapital',
          message: 'Minimum capital cannot be negative',
          code: 'INVALID_VALUE',
          severity: 'error'
        });
      } else if (template.minimumCapital < 100) {
        warnings.push({
          field: 'minimumCapital',
          message: 'Very low minimum capital may not be practical for most exchanges',
          code: 'LOW_CAPITAL',
          impact: 'medium'
        });
      }
    }

    // Strategy-specific template validation
    this.validateTemplateByStrategy(template, errors, warnings, suggestions);

    return { isValid: errors.length === 0, errors, warnings, suggestions };
  }

  private validateTemplateByStrategy(
    template: ConfigTemplate,
    errors: any[],
    warnings: any[],
    suggestions: any[]
  ): void {
    switch (template.strategyType) {
      case 'pure_market_making':
        this.validateMarketMakingTemplate(template, errors, warnings, suggestions);
        break;
      case 'grid_trading':
        this.validateGridTradingTemplate(template, errors, warnings, suggestions);
        break;
      case 'arbitrage':
        this.validateArbitrageTemplate(template, errors, warnings, suggestions);
        break;
      case 'cross_exchange_market_making':
        this.validateCrossExchangeTemplate(template, errors, warnings, suggestions);
        break;
    }
  }

  private validateMarketMakingTemplate(
    template: ConfigTemplate,
    errors: any[],
    warnings: any[],
    suggestions: any[]
  ): void {
    const requiredParams = ['bidSpread', 'askSpread', 'orderAmount'];
    const missingParams = requiredParams.filter(param => 
      !template.requiredParameters.includes(param) && 
      !template.defaultParameters[param]
    );

    if (missingParams.length > 0) {
      errors.push({
        field: 'requiredParameters',
        message: `Market making strategy requires parameters: ${missingParams.join(', ')}`,
        code: 'MISSING_REQUIRED_PARAMS',
        severity: 'error'
      });
    }

    if (template.defaultParameters.bidSpread && template.defaultParameters.askSpread) {
      if (template.defaultParameters.bidSpread !== template.defaultParameters.askSpread) {
        suggestions.push({
          field: 'defaultParameters',
          currentValue: { bid: template.defaultParameters.bidSpread, ask: template.defaultParameters.askSpread },
          suggestedValue: 'Equal spreads',
          reason: 'Symmetric spreads are typically recommended for market making',
          impact: 'Consider using equal bid and ask spreads for balanced market making'
        });
      }
    }
  }

  private validateGridTradingTemplate(
    template: ConfigTemplate,
    errors: any[],
    warnings: any[],
    suggestions: any[]
  ): void {
    const requiredParams = ['gridLevels', 'gridSpacing', 'orderAmount'];
    const missingParams = requiredParams.filter(param => 
      !template.requiredParameters.includes(param) && 
      !template.defaultParameters[param]
    );

    if (missingParams.length > 0) {
      errors.push({
        field: 'requiredParameters',
        message: `Grid trading strategy requires parameters: ${missingParams.join(', ')}`,
        code: 'MISSING_REQUIRED_PARAMS',
        severity: 'error'
      });
    }

    if (template.defaultParameters.gridLevels && template.defaultParameters.gridLevels > 15) {
      warnings.push({
        field: 'defaultParameters.gridLevels',
        message: 'High default grid levels may require significant capital',
        code: 'HIGH_CAPITAL_REQUIREMENT',
        impact: 'high'
      });
    }
  }

  private validateArbitrageTemplate(
    template: ConfigTemplate,
    errors: any[],
    warnings: any[],
    suggestions: any[]
  ): void {
    const requiredParams = ['minProfitability', 'orderAmount'];
    const missingParams = requiredParams.filter(param => 
      !template.requiredParameters.includes(param) && 
      !template.defaultParameters[param]
    );

    if (missingParams.length > 0) {
      errors.push({
        field: 'requiredParameters',
        message: `Arbitrage strategy requires parameters: ${missingParams.join(', ')}`,
        code: 'MISSING_REQUIRED_PARAMS',
        severity: 'error'
      });
    }

    if (template.suitableMarkets && template.suitableMarkets.length < 2) {
      warnings.push({
        field: 'suitableMarkets',
        message: 'Arbitrage strategies typically require multiple markets',
        code: 'INSUFFICIENT_MARKETS',
        impact: 'high'
      });
    }
  }

  private validateCrossExchangeTemplate(
    template: ConfigTemplate,
    errors: any[],
    warnings: any[],
    suggestions: any[]
  ): void {
    const requiredParams = ['bidSpread', 'askSpread', 'orderAmount', 'minProfitability'];
    const missingParams = requiredParams.filter(param => 
      !template.requiredParameters.includes(param) && 
      !template.defaultParameters[param]
    );

    if (missingParams.length > 0) {
      errors.push({
        field: 'requiredParameters',
        message: `Cross-exchange market making requires parameters: ${missingParams.join(', ')}`,
        code: 'MISSING_REQUIRED_PARAMS',
        severity: 'error'
      });
    }

    if (template.minimumCapital && template.minimumCapital < 5000) {
      warnings.push({
        field: 'minimumCapital',
        message: 'Cross-exchange strategies typically require higher capital due to exchange requirements',
        code: 'LOW_CAPITAL_FOR_STRATEGY',
        impact: 'high'
      });
    }
  }

  /**
   * Remove configuration template
   */
  removeConfigurationTemplate(templateId: string): boolean {
    const removed = this.templates.delete(templateId);
    if (removed) {
      this.emit('template:removed', { templateId });
    }
    return removed;
  }

  /**
   * Get user configurations
   */
  async getUserConfigurations(userId: string): Promise<any[]> {
    return this.prisma.hummingbotConfiguration.findMany({
      where: { userId, isActive: true },
      orderBy: { updatedAt: 'desc' }
    });
  }

  /**
   * Delete configuration
   */
  async deleteConfiguration(configId: string): Promise<boolean> {
    try {
      await this.prisma.hummingbotConfiguration.update({
        where: { id: configId },
        data: { isActive: false }
      });

      this.emit('configuration:deleted', { configId });
      return true;
    } catch (error) {
      this.emit('configuration:delete_failed', { configId, error });
      return false;
    }
  }

  /**
   * Create a backup of configuration
   */
  async backupConfiguration(configId: string, backupName?: string): Promise<string> {
    try {
      const config = await this.prisma.hummingbotConfiguration.findUnique({
        where: { id: configId }
      });

      if (!config) {
        throw new Error(`Configuration not found: ${configId}`);
      }

      const backupConfig = await this.prisma.hummingbotConfiguration.create({
        data: {
          userId: config.userId,
          name: backupName || `${config.name}_backup_${Date.now()}`,
          description: `Backup of ${config.name} created on ${new Date().toISOString()}`,
          configType: 'backup',
          configData: config.configData,
          version: config.version,
          parentId: configId,
          isActive: false
        }
      });

      this.emit('configuration:backup_created', { 
        configId, 
        backupId: backupConfig.id, 
        backupName: backupConfig.name 
      });

      return backupConfig.id;
    } catch (error) {
      this.emit('configuration:backup_failed', { configId, error });
      throw error;
    }
  }

  /**
   * Restore configuration from backup
   */
  async restoreConfiguration(configId: string, backupId: string): Promise<HBConfig> {
    try {
      const backup = await this.prisma.hummingbotConfiguration.findUnique({
        where: { id: backupId }
      });

      if (!backup) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      if (backup.parentId !== configId) {
        throw new Error(`Backup ${backupId} is not associated with configuration ${configId}`);
      }

      // Create a new version backup before restoring
      await this.createConfigVersion(configId);

      // Restore the configuration
      const restoredConfig = backup.configData as HBConfig;
      await this.saveConfiguration(configId, restoredConfig);

      this.emit('configuration:restored', { 
        configId, 
        backupId, 
        restoredVersion: restoredConfig.version 
      });

      return restoredConfig;
    } catch (error) {
      this.emit('configuration:restore_failed', { configId, backupId, error });
      throw error;
    }
  }

  /**
   * List all backups for a configuration
   */
  async listConfigurationBackups(configId: string): Promise<any[]> {
    try {
      const backups = await this.prisma.hummingbotConfiguration.findMany({
        where: { 
          parentId: configId,
          configType: 'backup'
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          version: true,
          createdAt: true
        }
      });

      return backups;
    } catch (error) {
      this.emit('configuration:backup_list_failed', { configId, error });
      throw error;
    }
  }

  /**
   * Export configuration to JSON
   */
  async exportConfiguration(configId: string): Promise<{ config: HBConfig; metadata: any }> {
    try {
      const config = await this.loadConfiguration(configId);
      const dbConfig = await this.prisma.hummingbotConfiguration.findUnique({
        where: { id: configId }
      });

      if (!dbConfig) {
        throw new Error(`Configuration not found: ${configId}`);
      }

      const exportData = {
        config,
        metadata: {
          exportedAt: new Date().toISOString(),
          exportedBy: 'HummingbotConfigurationManager',
          originalId: configId,
          originalName: dbConfig.name,
          originalVersion: config.version,
          exportVersion: '1.0.0'
        }
      };

      this.emit('configuration:exported', { configId, exportSize: JSON.stringify(exportData).length });

      return exportData;
    } catch (error) {
      this.emit('configuration:export_failed', { configId, error });
      throw error;
    }
  }

  /**
   * Import configuration from JSON
   */
  async importConfiguration(
    userId: string, 
    exportData: { config: HBConfig; metadata: any },
    importName?: string
  ): Promise<string> {
    try {
      const { config, metadata } = exportData;

      // Validate import data
      if (!config || !metadata) {
        throw new Error('Invalid import data format');
      }

      // Validate configuration
      const validation = await this.validateConfiguration(config);
      if (!validation.isValid) {
        throw new Error(`Imported configuration is invalid: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Create new configuration from import
      const importedConfig = await this.prisma.hummingbotConfiguration.create({
        data: {
          userId,
          name: importName || `${metadata.originalName}_imported_${Date.now()}`,
          description: `Imported from ${metadata.originalName} (exported ${metadata.exportedAt})`,
          configType: 'instance',
          configData: config as any,
          version: config.version,
          isActive: true
        }
      });

      this.emit('configuration:imported', { 
        configId: importedConfig.id, 
        userId, 
        originalId: metadata.originalId,
        importName: importedConfig.name
      });

      return importedConfig.id;
    } catch (error) {
      this.emit('configuration:import_failed', { userId, error });
      throw error;
    }
  }

  /**
   * Clone configuration
   */
  async cloneConfiguration(configId: string, cloneName?: string): Promise<string> {
    try {
      const config = await this.loadConfiguration(configId);
      const originalConfig = await this.prisma.hummingbotConfiguration.findUnique({
        where: { id: configId }
      });

      if (!originalConfig) {
        throw new Error(`Configuration not found: ${configId}`);
      }

      // Create clone with new instance ID
      const clonedConfig = {
        ...config,
        instanceSettings: {
          ...config.instanceSettings,
          instanceId: `${config.instanceSettings.instanceId}_clone_${Date.now()}`,
          name: cloneName || `${config.instanceSettings.name} (Clone)`
        }
      };

      const cloneRecord = await this.prisma.hummingbotConfiguration.create({
        data: {
          userId: originalConfig.userId,
          name: cloneName || `${originalConfig.name}_clone_${Date.now()}`,
          description: `Clone of ${originalConfig.name}`,
          configType: 'instance',
          configData: clonedConfig as any,
          version: config.version,
          isActive: true
        }
      });

      this.emit('configuration:cloned', { 
        originalId: configId, 
        cloneId: cloneRecord.id,
        cloneName: cloneRecord.name
      });

      return cloneRecord.id;
    } catch (error) {
      this.emit('configuration:clone_failed', { configId, error });
      throw error;
    }
  }

  // Private methods

  private async buildConfigFromTemplate(template: ConfigTemplate, params: ConfigParams): Promise<HBConfig> {
    const config: HBConfig = {
      version: '1.0.0',
      instanceSettings: this.buildInstanceSettings(template, params),
      strategyConfigs: this.buildStrategyConfigs(template, params),
      exchangeSettings: this.buildExchangeSettings(params),
      riskSettings: this.buildRiskSettings(template, params)
    };

    return config;
  }

  private buildInstanceSettings(template: ConfigTemplate, params: ConfigParams): InstanceSettings {
    return {
      instanceId: `hb-${Date.now()}`,
      name: `${template.name} Instance`,
      description: `Instance based on ${template.name} template`,
      dockerImage: 'hummingbot/hummingbot',
      dockerTag: 'latest',
      resources: {
        memory: '1Gi',
        cpu: '0.5',
        storage: '2Gi'
      },
      networking: {
        port: 5000,
        exposedPorts: [5000, 8080, 9090],
        networkMode: 'bridge'
      },
      environment: {
        HUMMINGBOT_LOG_LEVEL: 'INFO',
        HUMMINGBOT_GATEWAY_ENABLED: 'true',
        PAPER_TRADING_MODE: 'true'
      }
    };
  }

  private buildStrategyConfigs(template: ConfigTemplate, params: ConfigParams): StrategyConfig[] {
    const strategyConfig: StrategyConfig = {
      strategyName: template.name,
      enabled: true,
      parameters: {
        // Default StrategyParameters
        bidSpread: 0.1,
        askSpread: 0.1,
        orderAmount: 100,
        orderLevels: 1,
        orderRefreshTime: 30,
        maxOrderAge: 1800,
        inventorySkewEnabled: false,
        inventoryTargetBasePercent: 50,
        inventoryRangeMultiplier: 1.0,
        hangingOrdersEnabled: false,
        hangingOrdersCancelPct: 10,
        orderOptimizationEnabled: false,
        askOrderOptimizationDepth: 0,
        bidOrderOptimizationDepth: 0,
        addTransactionCosts: false,
        priceType: 'mid_price' as const,
        takeLiquidity: false,
        priceSource: 'current_market',
        priceBandEnabled: false,
        priceCeilingPct: 100,
        priceFloorPct: -100,
        pingPongEnabled: false,
        orderRefreshTolerance: 0.2,
        filledOrderDelay: 60,
        jumpOrdersEnabled: false,
        jumpOrdersDepth: 0,
        jumpOrdersDelay: 10,
        // Override with template defaults
        ...template.defaultParameters,
        // Override with custom parameters
        ...params.customParameters
      },
      markets: [{
        exchange: 'binance',
        tradingPair: 'BTC-USDT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT'
      }],
      riskManagement: {
        killSwitchEnabled: true,
        killSwitchRate: -100,
        maxOrderAge: 1800,
        maxOrderRefreshTime: 30,
        orderRefreshTolerance: 0.2,
        inventorySkewEnabled: false,
        inventoryTargetBasePercent: 50,
        inventoryRangeMultiplier: 1.0
      }
    };

    return [strategyConfig];
  }

  private buildExchangeSettings(params: ConfigParams): ExchangeSettings {
    return {
      exchanges: [
        {
          name: 'binance',
          apiKey: '', // Will be encrypted
          apiSecret: '', // Will be encrypted
          sandbox: true,
          rateLimit: 1200,
          testnet: false
        }
      ],
      defaultExchange: 'binance'
    };
  }

  private buildRiskSettings(template: ConfigTemplate, params: ConfigParams): RiskSettings {
    return {
      globalRiskEnabled: true,
      maxTotalExposure: 10000,
      maxDailyLoss: 1000,
      maxDrawdown: 20,
      emergencyStopEnabled: true,
      emergencyStopLoss: 5
    };
  }

  private validateInstanceSettings(settings: InstanceSettings): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];

    if (!settings.instanceId) {
      errors.push({
        field: 'instanceId',
        message: 'Instance ID is required',
        code: 'REQUIRED',
        severity: 'error'
      });
    }

    if (!settings.dockerImage) {
      errors.push({
        field: 'dockerImage',
        message: 'Docker image is required',
        code: 'REQUIRED',
        severity: 'error'
      });
    }

    // Validate resource limits
    if (settings.resources) {
      const memoryMatch = settings.resources.memory.match(/^(\d+)(Mi|Gi)$/);
      if (!memoryMatch) {
        errors.push({
          field: 'resources.memory',
          message: 'Invalid memory format. Use format like "512Mi" or "1Gi"',
          code: 'INVALID_FORMAT',
          severity: 'error'
        });
      }

      const cpuValue = parseFloat(settings.resources.cpu);
      if (isNaN(cpuValue) || cpuValue <= 0) {
        errors.push({
          field: 'resources.cpu',
          message: 'CPU must be a positive number',
          code: 'INVALID_VALUE',
          severity: 'error'
        });
      }
    }

    return { isValid: errors.length === 0, errors, warnings, suggestions: [] };
  }

  private validateStrategyConfig(config: StrategyConfig): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];
    const suggestions: any[] = [];

    if (!config.strategyName) {
      errors.push({
        field: 'strategyName',
        message: 'Strategy name is required',
        code: 'REQUIRED',
        severity: 'error'
      });
    }

    if (!config.markets || config.markets.length === 0) {
      errors.push({
        field: 'markets',
        message: 'At least one market configuration is required',
        code: 'REQUIRED',
        severity: 'error'
      });
    }

    // Validate strategy parameters with Hummingbot compatibility
    if (config.parameters) {
      // Spread validation
      if (config.parameters.bidSpread !== undefined) {
        if (config.parameters.bidSpread <= 0) {
          errors.push({
            field: 'parameters.bidSpread',
            message: 'Bid spread must be positive',
            code: 'INVALID_VALUE',
            severity: 'error'
          });
        } else if (config.parameters.bidSpread < 0.01) {
          warnings.push({
            field: 'parameters.bidSpread',
            message: 'Bid spread below 0.01% may result in frequent order cancellations',
            code: 'LOW_SPREAD',
            impact: 'medium'
          });
        } else if (config.parameters.bidSpread > 5) {
          warnings.push({
            field: 'parameters.bidSpread',
            message: 'Bid spread above 5% may reduce trading opportunities',
            code: 'HIGH_SPREAD',
            impact: 'medium'
          });
        }
      }

      if (config.parameters.askSpread !== undefined) {
        if (config.parameters.askSpread <= 0) {
          errors.push({
            field: 'parameters.askSpread',
            message: 'Ask spread must be positive',
            code: 'INVALID_VALUE',
            severity: 'error'
          });
        } else if (config.parameters.askSpread < 0.01) {
          warnings.push({
            field: 'parameters.askSpread',
            message: 'Ask spread below 0.01% may result in frequent order cancellations',
            code: 'LOW_SPREAD',
            impact: 'medium'
          });
        } else if (config.parameters.askSpread > 5) {
          warnings.push({
            field: 'parameters.askSpread',
            message: 'Ask spread above 5% may reduce trading opportunities',
            code: 'HIGH_SPREAD',
            impact: 'medium'
          });
        }
      }

      // Order amount validation
      if (config.parameters.orderAmount !== undefined) {
        if (config.parameters.orderAmount <= 0) {
          errors.push({
            field: 'parameters.orderAmount',
            message: 'Order amount must be positive',
            code: 'INVALID_VALUE',
            severity: 'error'
          });
        } else if (config.parameters.orderAmount < 10) {
          warnings.push({
            field: 'parameters.orderAmount',
            message: 'Order amount below $10 may not meet minimum exchange requirements',
            code: 'LOW_ORDER_AMOUNT',
            impact: 'high'
          });
        }
      }

      // Order levels validation
      if (config.parameters.orderLevels !== undefined) {
        if (config.parameters.orderLevels < 1 || config.parameters.orderLevels > 10) {
          errors.push({
            field: 'parameters.orderLevels',
            message: 'Order levels must be between 1 and 10',
            code: 'INVALID_RANGE',
            severity: 'error'
          });
        } else if (config.parameters.orderLevels > 5) {
          warnings.push({
            field: 'parameters.orderLevels',
            message: 'High order levels may increase capital requirements',
            code: 'HIGH_ORDER_LEVELS',
            impact: 'medium'
          });
        }
      }

      // Order refresh time validation
      if (config.parameters.orderRefreshTime !== undefined) {
        if (config.parameters.orderRefreshTime < 10) {
          errors.push({
            field: 'parameters.orderRefreshTime',
            message: 'Order refresh time must be at least 10 seconds to avoid rate limits',
            code: 'INVALID_VALUE',
            severity: 'error'
          });
        } else if (config.parameters.orderRefreshTime < 30) {
          warnings.push({
            field: 'parameters.orderRefreshTime',
            message: 'Order refresh time below 30 seconds may trigger rate limits',
            code: 'LOW_REFRESH_TIME',
            impact: 'high'
          });
        }
      }

      // Inventory skew validation
      if (config.parameters.inventoryTargetBasePercent !== undefined) {
        if (config.parameters.inventoryTargetBasePercent < 0 || config.parameters.inventoryTargetBasePercent > 100) {
          errors.push({
            field: 'parameters.inventoryTargetBasePercent',
            message: 'Inventory target base percent must be between 0 and 100',
            code: 'INVALID_RANGE',
            severity: 'error'
          });
        }
      }

      // Hanging orders validation
      if (config.parameters.hangingOrdersEnabled && config.parameters.hangingOrdersCancelPct !== undefined) {
        if (config.parameters.hangingOrdersCancelPct < 1 || config.parameters.hangingOrdersCancelPct > 50) {
          errors.push({
            field: 'parameters.hangingOrdersCancelPct',
            message: 'Hanging orders cancel percentage must be between 1 and 50',
            code: 'INVALID_RANGE',
            severity: 'error'
          });
        }
      }

      // Price band validation
      if (config.parameters.priceBandEnabled) {
        if (config.parameters.priceCeilingPct !== undefined && config.parameters.priceCeilingPct <= 0) {
          errors.push({
            field: 'parameters.priceCeilingPct',
            message: 'Price ceiling percentage must be positive',
            code: 'INVALID_VALUE',
            severity: 'error'
          });
        }

        if (config.parameters.priceFloorPct !== undefined && config.parameters.priceFloorPct >= 0) {
          errors.push({
            field: 'parameters.priceFloorPct',
            message: 'Price floor percentage must be negative',
            code: 'INVALID_VALUE',
            severity: 'error'
          });
        }
      }

      // Strategy-specific validations
      this.validateStrategySpecificParameters(config, errors, warnings, suggestions);
    }

    // Validate markets
    if (config.markets) {
      for (const market of config.markets) {
        if (!market.exchange) {
          errors.push({
            field: 'market.exchange',
            message: 'Exchange is required for each market',
            code: 'REQUIRED',
            severity: 'error'
          });
        }

        if (!market.tradingPair) {
          errors.push({
            field: 'market.tradingPair',
            message: 'Trading pair is required for each market',
            code: 'REQUIRED',
            severity: 'error'
          });
        } else {
          // Validate trading pair format
          if (!market.tradingPair.includes('-') && !market.tradingPair.includes('/')) {
            warnings.push({
              field: 'market.tradingPair',
              message: 'Trading pair should be in format BASE-QUOTE or BASE/QUOTE',
              code: 'INVALID_FORMAT',
              impact: 'medium'
            });
          }
        }
      }
    }

    return { isValid: errors.length === 0, errors, warnings, suggestions };
  }

  private validateStrategySpecificParameters(
    config: StrategyConfig, 
    errors: any[], 
    warnings: any[], 
    suggestions: any[]
  ): void {
    const strategyName = config.strategyName.toLowerCase();
    const params = config.parameters as any; // Use any to access strategy-specific parameters

    if (strategyName.includes('market_making')) {
      // Market making specific validations
      if (params.bidSpread && params.askSpread) {
        const spreadDiff = Math.abs(params.bidSpread - params.askSpread);
        if (spreadDiff > 0.5) {
          warnings.push({
            field: 'parameters.spreads',
            message: 'Large difference between bid and ask spreads may indicate asymmetric strategy',
            code: 'ASYMMETRIC_SPREADS',
            impact: 'medium'
          });
        }
      }

      if (params.inventorySkewEnabled && !params.inventoryTargetBasePercent) {
        errors.push({
          field: 'parameters.inventoryTargetBasePercent',
          message: 'Inventory target base percent is required when inventory skew is enabled',
          code: 'REQUIRED_CONDITIONAL',
          severity: 'error'
        });
      }
    }

    if (strategyName.includes('grid')) {
      // Grid trading specific validations
      if (params.gridLevels && params.gridLevels > 20) {
        warnings.push({
          field: 'parameters.gridLevels',
          message: 'High grid levels may require significant capital',
          code: 'HIGH_CAPITAL_REQUIREMENT',
          impact: 'high'
        });
      }

      if (params.gridSpacing && params.gridSpacing < 0.1) {
        warnings.push({
          field: 'parameters.gridSpacing',
          message: 'Tight grid spacing may result in frequent rebalancing',
          code: 'FREQUENT_REBALANCING',
          impact: 'medium'
        });
      }
    }

    if (strategyName.includes('arbitrage')) {
      // Arbitrage specific validations
      if (params.minProfitability && params.minProfitability < 0.05) {
        warnings.push({
          field: 'parameters.minProfitability',
          message: 'Low minimum profitability may result in unprofitable trades after fees',
          code: 'LOW_PROFITABILITY',
          impact: 'high'
        });
      }

      if (params.maxOrderAge && params.maxOrderAge > 300) {
        warnings.push({
          field: 'parameters.maxOrderAge',
          message: 'Long order age may miss arbitrage opportunities',
          code: 'SLOW_EXECUTION',
          impact: 'medium'
        });
      }
    }
  }

  private validateExchangeSettings(settings: ExchangeSettings): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];

    if (!settings.exchanges || settings.exchanges.length === 0) {
      errors.push({
        field: 'exchanges',
        message: 'At least one exchange configuration is required',
        code: 'REQUIRED',
        severity: 'error'
      });
    }

    if (!settings.defaultExchange) {
      errors.push({
        field: 'defaultExchange',
        message: 'Default exchange is required',
        code: 'REQUIRED',
        severity: 'error'
      });
    }

    // Validate each exchange configuration
    for (const exchange of settings.exchanges) {
      if (!exchange.name) {
        errors.push({
          field: 'exchange.name',
          message: 'Exchange name is required',
          code: 'REQUIRED',
          severity: 'error'
        });
      }

      if (!exchange.apiKey && !exchange.sandbox) {
        warnings.push({
          field: 'exchange.apiKey',
          message: `API key not set for ${exchange.name}`,
          code: 'MISSING_CREDENTIALS',
          impact: 'high'
        });
      }
    }

    return { isValid: errors.length === 0, errors, warnings, suggestions: [] };
  }

  private validateRiskSettings(settings: RiskSettings): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];
    const suggestions: any[] = [];

    if (settings.maxTotalExposure <= 0) {
      errors.push({
        field: 'maxTotalExposure',
        message: 'Max total exposure must be positive',
        code: 'INVALID_VALUE',
        severity: 'error'
      });
    }

    if (settings.maxDailyLoss <= 0) {
      errors.push({
        field: 'maxDailyLoss',
        message: 'Max daily loss must be positive',
        code: 'INVALID_VALUE',
        severity: 'error'
      });
    }

    if (settings.maxDrawdown <= 0 || settings.maxDrawdown > 100) {
      errors.push({
        field: 'maxDrawdown',
        message: 'Max drawdown must be between 0 and 100',
        code: 'INVALID_RANGE',
        severity: 'error'
      });
    }

    // Risk level suggestions
    if (settings.maxDrawdown > 50) {
      suggestions.push({
        field: 'maxDrawdown',
        currentValue: settings.maxDrawdown,
        suggestedValue: 20,
        reason: 'High drawdown limit increases risk',
        impact: 'Consider reducing to 20% for better risk management'
      });
    }

    return { isValid: errors.length === 0, errors, warnings, suggestions };
  }

  private async checkVersionCompatibility(version: string): Promise<{ compatible: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    // Define known compatible versions
    const compatibleVersions = [
      '1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0', '1.5.0',
      '2.0.0', '2.1.0', '2.2.0', '2.3.0'
    ];
    
    const deprecatedVersions = ['0.9.0', '0.8.0', '0.7.0'];
    const unsupportedVersions = ['0.6.0', '0.5.0', '0.4.0'];
    
    // Check if version is supported
    if (unsupportedVersions.includes(version)) {
      issues.push(`Version ${version} is no longer supported and must be upgraded`);
      return { compatible: false, issues };
    }
    
    // Check if version is deprecated
    if (deprecatedVersions.includes(version)) {
      issues.push(`Version ${version} is deprecated and should be upgraded soon`);
    }
    
    // Check if version is compatible
    const compatible = compatibleVersions.includes(version) || deprecatedVersions.includes(version);
    
    if (!compatible && !unsupportedVersions.includes(version)) {
      // Unknown version - assume compatible but warn
      issues.push(`Version ${version} is unknown - compatibility cannot be guaranteed`);
      return { compatible: true, issues };
    }
    
    // Check for version-specific compatibility issues
    if (version === '1.0.0') {
      issues.push('Version 1.0.0 has limited strategy support - consider upgrading');
    }
    
    if (version.startsWith('2.')) {
      // Version 2.x has enhanced features
      issues.push('Version 2.x includes enhanced risk management features');
    }
    
    return { compatible, issues };
  }

  private async performVersionMigration(config: HBConfig, targetVersion: string): Promise<HBConfig> {
    // Create a copy of the config
    const migratedConfig = JSON.parse(JSON.stringify(config));
    const currentVersion = config.version;
    
    // Update version
    migratedConfig.version = targetVersion;

    // Perform version-specific migrations
    if (this.shouldMigrate(currentVersion, '1.1.0', targetVersion)) {
      // Migration from 1.0.0 to 1.1.0: Add new risk management fields
      for (const strategyConfig of migratedConfig.strategyConfigs) {
        if (!strategyConfig.riskManagement.inventorySkewEnabled) {
          strategyConfig.riskManagement.inventorySkewEnabled = false;
        }
        if (!strategyConfig.riskManagement.inventoryTargetBasePercent) {
          strategyConfig.riskManagement.inventoryTargetBasePercent = 50;
        }
      }
    }
    
    if (this.shouldMigrate(currentVersion, '1.2.0', targetVersion)) {
      // Migration from 1.1.0 to 1.2.0: Add order optimization settings
      for (const strategyConfig of migratedConfig.strategyConfigs) {
        if (strategyConfig.parameters.orderOptimizationEnabled === undefined) {
          strategyConfig.parameters.orderOptimizationEnabled = false;
        }
        if (strategyConfig.parameters.addTransactionCosts === undefined) {
          strategyConfig.parameters.addTransactionCosts = false;
        }
      }
    }
    
    if (this.shouldMigrate(currentVersion, '1.3.0', targetVersion)) {
      // Migration from 1.2.0 to 1.3.0: Add hanging orders support
      for (const strategyConfig of migratedConfig.strategyConfigs) {
        if (strategyConfig.parameters.hangingOrdersEnabled === undefined) {
          strategyConfig.parameters.hangingOrdersEnabled = false;
        }
        if (strategyConfig.parameters.hangingOrdersCancelPct === undefined) {
          strategyConfig.parameters.hangingOrdersCancelPct = 10;
        }
      }
    }
    
    if (this.shouldMigrate(currentVersion, '2.0.0', targetVersion)) {
      // Migration from 1.x to 2.0.0: Enhanced risk settings
      if (!migratedConfig.riskSettings.emergencyStopEnabled) {
        migratedConfig.riskSettings.emergencyStopEnabled = true;
        migratedConfig.riskSettings.emergencyStopLoss = 5;
      }
      
      // Add new instance environment variables
      if (!migratedConfig.instanceSettings.environment.HUMMINGBOT_GATEWAY_ENABLED) {
        migratedConfig.instanceSettings.environment.HUMMINGBOT_GATEWAY_ENABLED = 'true';
      }
    }
    
    if (this.shouldMigrate(currentVersion, '2.1.0', targetVersion)) {
      // Migration from 2.0.0 to 2.1.0: Add price band settings
      for (const strategyConfig of migratedConfig.strategyConfigs) {
        if (strategyConfig.parameters.priceBandEnabled === undefined) {
          strategyConfig.parameters.priceBandEnabled = false;
        }
        if (strategyConfig.parameters.priceCeilingPct === undefined) {
          strategyConfig.parameters.priceCeilingPct = 100;
        }
        if (strategyConfig.parameters.priceFloorPct === undefined) {
          strategyConfig.parameters.priceFloorPct = -100;
        }
      }
    }
    
    return migratedConfig;
  }
  
  private shouldMigrate(currentVersion: string, migrationVersion: string, targetVersion: string): boolean {
    return this.compareVersions(currentVersion, migrationVersion) < 0 && 
           this.compareVersions(targetVersion, migrationVersion) >= 0;
  }
  
  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part < v2Part) return -1;
      if (v1Part > v2Part) return 1;
    }
    
    return 0;
  }

  private async createConfigVersion(configId: string): Promise<void> {
    const config = await this.prisma.hummingbotConfiguration.findUnique({
      where: { id: configId }
    });

    if (!config) return;

    // Create version backup
    await this.prisma.hummingbotConfiguration.create({
      data: {
        userId: config.userId,
        name: `${config.name}_backup_${Date.now()}`,
        description: `Backup of ${config.name}`,
        configType: config.configType,
        configData: config.configData,
        version: config.version,
        parentId: configId,
        isActive: false
      }
    });

    // Clean up old versions if needed
    if (this.options.maxVersionsPerConfig > 0) {
      const versions = await this.prisma.hummingbotConfiguration.findMany({
        where: { parentId: configId },
        orderBy: { createdAt: 'desc' },
        skip: this.options.maxVersionsPerConfig
      });

      if (versions.length > 0) {
        await this.prisma.hummingbotConfiguration.deleteMany({
          where: {
            id: { in: versions.map(v => v.id) }
          }
        });
      }
    }
  }

  private async encryptSensitiveFields(config: HBConfig): Promise<HBConfig> {
    const encryptedConfig = JSON.parse(JSON.stringify(config));

    // Encrypt exchange API keys
    if (encryptedConfig.exchangeSettings?.exchanges) {
      for (const exchange of encryptedConfig.exchangeSettings.exchanges) {
        if (exchange.apiKey) {
          const encrypted = EncryptionService.encrypt(exchange.apiKey);
          exchange.apiKey = JSON.stringify(encrypted);
        }
        if (exchange.apiSecret) {
          const encrypted = EncryptionService.encrypt(exchange.apiSecret);
          exchange.apiSecret = JSON.stringify(encrypted);
        }
        if (exchange.passphrase) {
          const encrypted = EncryptionService.encrypt(exchange.passphrase);
          exchange.passphrase = JSON.stringify(encrypted);
        }
      }
    }

    return encryptedConfig;
  }

  private async decryptSensitiveFields(config: HBConfig): Promise<HBConfig> {
    const decryptedConfig = JSON.parse(JSON.stringify(config));

    // Decrypt exchange API keys
    if (decryptedConfig.exchangeSettings?.exchanges) {
      for (const exchange of decryptedConfig.exchangeSettings.exchanges) {
        if (exchange.apiKey) {
          try {
            const encryptedData = JSON.parse(exchange.apiKey);
            exchange.apiKey = EncryptionService.decrypt(encryptedData);
          } catch (error) {
            // If parsing fails, assume it's already decrypted or plain text
            // This handles backward compatibility
          }
        }
        if (exchange.apiSecret) {
          try {
            const encryptedData = JSON.parse(exchange.apiSecret);
            exchange.apiSecret = EncryptionService.decrypt(encryptedData);
          } catch (error) {
            // If parsing fails, assume it's already decrypted or plain text
          }
        }
        if (exchange.passphrase) {
          try {
            const encryptedData = JSON.parse(exchange.passphrase);
            exchange.passphrase = EncryptionService.decrypt(encryptedData);
          } catch (error) {
            // If parsing fails, assume it's already decrypted or plain text
          }
        }
      }
    }

    return decryptedConfig;
  }

  private initializeDefaultTemplates(): void {
    if (!this.options.enableTemplates) return;

    // Pure Market Making Template
    this.templates.set('pure_market_making', {
      id: 'pure_market_making',
      name: 'Pure Market Making',
      description: 'Basic market making strategy with bid/ask spreads',
      category: 'market_making',
      strategyType: 'pure_market_making' as HBStrategyType,
      defaultParameters: {
        bidSpread: 0.1,
        askSpread: 0.1,
        orderAmount: 100,
        orderLevels: 1,
        orderRefreshTime: 30,
        orderRefreshTolerance: 0.2,
        inventorySkewEnabled: false,
        filledOrderDelay: 60,
        hangingOrdersEnabled: false,
        orderOptimizationEnabled: false,
        addTransactionCosts: false
      },
      requiredParameters: ['bidSpread', 'askSpread', 'orderAmount'],
      optionalParameters: ['orderLevels', 'orderRefreshTime', 'inventorySkewEnabled'],
      riskProfile: 'moderate',
      suitableMarkets: ['BTC-USDT', 'ETH-USDT', 'BNB-USDT'],
      minimumCapital: 1000,
      tags: ['market_making', 'liquidity', 'basic']
    });

    // Grid Trading Template
    this.templates.set('grid_trading', {
      id: 'grid_trading',
      name: 'Grid Trading',
      description: 'Grid trading strategy with multiple price levels',
      category: 'grid',
      strategyType: 'grid_trading' as HBStrategyType,
      defaultParameters: {
        gridLevels: 10,
        gridSpacing: 0.5,
        orderAmount: 50,
        startPrice: 0,
        endPrice: 0,
        gridMode: 'arithmetic'
      },
      requiredParameters: ['gridLevels', 'gridSpacing', 'orderAmount'],
      optionalParameters: ['startPrice', 'endPrice', 'gridMode'],
      riskProfile: 'moderate',
      suitableMarkets: ['BTC-USDT', 'ETH-USDT'],
      minimumCapital: 2000,
      tags: ['grid', 'automated', 'range_bound']
    });

    // Arbitrage Template
    this.templates.set('arbitrage', {
      id: 'arbitrage',
      name: 'Cross Exchange Arbitrage',
      description: 'Arbitrage opportunities between exchanges',
      category: 'arbitrage',
      strategyType: 'arbitrage' as HBStrategyType,
      defaultParameters: {
        minProfitability: 0.1,
        orderAmount: 100,
        maxOrderAge: 300,
        slippageTolerance: 0.1
      },
      requiredParameters: ['minProfitability', 'orderAmount'],
      optionalParameters: ['maxOrderAge', 'slippageTolerance'],
      riskProfile: 'aggressive',
      suitableMarkets: ['BTC-USDT', 'ETH-USDT'],
      minimumCapital: 5000,
      tags: ['arbitrage', 'cross_exchange', 'advanced']
    });
  }
}

export default HummingbotConfigurationManager;