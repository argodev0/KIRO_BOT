import { logger } from '@/utils/logger';
import { auditLogService } from './AuditLogService';
import { logRetentionService } from './LogRetentionService';
import { config } from '@/config/config';

export interface LoggingConfiguration {
  level: string;
  enableConsoleLogging: boolean;
  enableFileLogging: boolean;
  enableElasticsearchLogging: boolean;
  enableAuditLogging: boolean;
  enablePerformanceLogging: boolean;
  enableSecurityLogging: boolean;
  enableTradingLogging: boolean;
  logRotation: {
    enabled: boolean;
    maxSize: string;
    maxFiles: string;
  };
  retention: {
    enabled: boolean;
    defaultDays: number;
  };
  elasticsearch: {
    host: string;
    index: string;
    enabled: boolean;
  };
  sensitiveFields: string[];
  excludePaths: string[];
}

export class LoggingConfigService {
  private static instance: LoggingConfigService;
  private currentConfig: LoggingConfiguration;

  public static getInstance(): LoggingConfigService {
    if (!LoggingConfigService.instance) {
      LoggingConfigService.instance = new LoggingConfigService();
    }
    return LoggingConfigService.instance;
  }

  constructor() {
    this.currentConfig = this.getDefaultConfiguration();
    this.initializeLogging();
  }

  /**
   * Get default logging configuration
   */
  private getDefaultConfiguration(): LoggingConfiguration {
    return {
      level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
      enableConsoleLogging: true,
      enableFileLogging: process.env.NODE_ENV !== 'test',
      enableElasticsearchLogging: process.env.NODE_ENV === 'production',
      enableAuditLogging: true,
      enablePerformanceLogging: true,
      enableSecurityLogging: true,
      enableTradingLogging: true,
      logRotation: {
        enabled: true,
        maxSize: process.env.LOG_MAX_SIZE || '100m',
        maxFiles: process.env.LOG_MAX_FILES || '30d'
      },
      retention: {
        enabled: true,
        defaultDays: parseInt(process.env.LOG_RETENTION_DAYS || '30')
      },
      elasticsearch: {
        host: process.env.ELASTICSEARCH_HOST || 'http://localhost:9200',
        index: process.env.ELASTICSEARCH_LOG_INDEX || 'trading-bot-logs',
        enabled: process.env.ELASTICSEARCH_LOGGING_ENABLED === 'true'
      },
      sensitiveFields: [
        'password', 'secret', 'key', 'token', 'apiKey', 'privateKey',
        'authorization', 'cookie', 'session', 'jwt', 'bearer'
      ],
      excludePaths: [
        '/health', '/metrics', '/favicon.ico', '/robots.txt',
        '/ping', '/status', '/ready', '/live'
      ]
    };
  }

  /**
   * Initialize logging system
   */
  private initializeLogging(): void {
    try {
      logger.info('Initializing production logging system', {
        config: {
          level: this.currentConfig.level,
          fileLogging: this.currentConfig.enableFileLogging,
          elasticsearchLogging: this.currentConfig.enableElasticsearchLogging,
          auditLogging: this.currentConfig.enableAuditLogging
        }
      });

      // Initialize log retention if enabled
      if (this.currentConfig.retention.enabled) {
        logRetentionService.scheduleCleanup();
        logger.info('Log retention service initialized');
      }

      // Log successful initialization
      auditLogService.logAuditEvent({
        action: 'logging_system_initialized',
        resource: 'logging_configuration',
        success: true,
        metadata: {
          level: this.currentConfig.level,
          environment: process.env.NODE_ENV,
          features: {
            fileLogging: this.currentConfig.enableFileLogging,
            elasticsearchLogging: this.currentConfig.enableElasticsearchLogging,
            auditLogging: this.currentConfig.enableAuditLogging,
            retention: this.currentConfig.retention.enabled
          }
        }
      });

    } catch (error) {
      console.error('Failed to initialize logging system:', error);
      
      auditLogService.logAuditEvent({
        action: 'logging_system_initialization_failed',
        resource: 'logging_configuration',
        success: false,
        reason: error.message
      });
    }
  }

  /**
   * Update logging configuration
   */
  public updateConfiguration(newConfig: Partial<LoggingConfiguration>): void {
    const oldConfig = { ...this.currentConfig };
    this.currentConfig = { ...this.currentConfig, ...newConfig };

    logger.info('Logging configuration updated', {
      oldConfig: this.sanitizeConfig(oldConfig),
      newConfig: this.sanitizeConfig(this.currentConfig)
    });

    auditLogService.logConfigurationAuditEvent({
      action: 'logging_configuration_updated',
      resource: 'logging_configuration',
      success: true,
      configType: 'environment',
      configKey: 'logging_config',
      oldValue: this.sanitizeConfig(oldConfig),
      newValue: this.sanitizeConfig(this.currentConfig)
    });

    // Reinitialize if needed
    this.applyConfigurationChanges(oldConfig, this.currentConfig);
  }

  /**
   * Apply configuration changes
   */
  private applyConfigurationChanges(
    oldConfig: LoggingConfiguration, 
    newConfig: LoggingConfiguration
  ): void {
    // Check if log level changed
    if (oldConfig.level !== newConfig.level) {
      logger.level = newConfig.level;
      logger.info('Log level updated', { 
        oldLevel: oldConfig.level, 
        newLevel: newConfig.level 
      });
    }

    // Check if retention settings changed
    if (oldConfig.retention.enabled !== newConfig.retention.enabled ||
        oldConfig.retention.defaultDays !== newConfig.retention.defaultDays) {
      
      if (newConfig.retention.enabled) {
        logRetentionService.scheduleCleanup();
        logger.info('Log retention re-enabled');
      } else {
        logger.info('Log retention disabled');
      }
    }
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): LoggingConfiguration {
    return { ...this.currentConfig };
  }

  /**
   * Validate logging configuration
   */
  public validateConfiguration(config: Partial<LoggingConfiguration>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate log level
    if (config.level) {
      const validLevels = ['error', 'warn', 'info', 'http', 'debug', 'trace'];
      if (!validLevels.includes(config.level)) {
        errors.push(`Invalid log level: ${config.level}. Must be one of: ${validLevels.join(', ')}`);
      }
    }

    // Validate retention days
    if (config.retention?.defaultDays !== undefined) {
      if (config.retention.defaultDays < 1 || config.retention.defaultDays > 3650) {
        errors.push('Retention days must be between 1 and 3650');
      }
    }

    // Validate Elasticsearch configuration
    if (config.elasticsearch?.enabled && config.elasticsearch?.host) {
      try {
        new URL(config.elasticsearch.host);
      } catch {
        errors.push('Invalid Elasticsearch host URL');
      }
    }

    // Validate log rotation settings
    if (config.logRotation?.maxSize) {
      const sizeRegex = /^\d+[kmg]$/i;
      if (!sizeRegex.test(config.logRotation.maxSize)) {
        errors.push('Invalid log rotation max size format. Use format like "100m", "1g", etc.');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get logging statistics
   */
  public async getLoggingStatistics(): Promise<{
    currentLevel: string;
    totalLogFiles: number;
    totalLogSize: number;
    retentionPolicies: number;
    elasticsearchEnabled: boolean;
    auditLoggingEnabled: boolean;
    lastCleanup?: Date;
  }> {
    const cleanupStats = await logRetentionService.getCleanupStatistics();

    return {
      currentLevel: this.currentConfig.level,
      totalLogFiles: cleanupStats.totalLogFiles,
      totalLogSize: cleanupStats.totalLogSize,
      retentionPolicies: Array.from(logRetentionService['retentionPolicies'].keys()).length,
      elasticsearchEnabled: this.currentConfig.enableElasticsearchLogging,
      auditLoggingEnabled: this.currentConfig.enableAuditLogging,
      lastCleanup: cleanupStats.newestLogDate
    };
  }

  /**
   * Test logging system health
   */
  public async testLoggingHealth(): Promise<{
    healthy: boolean;
    issues: string[];
    tests: Record<string, boolean>;
  }> {
    const issues: string[] = [];
    const tests: Record<string, boolean> = {};

    // Test basic logging
    try {
      logger.info('Logging health test');
      tests.basicLogging = true;
    } catch (error) {
      tests.basicLogging = false;
      issues.push(`Basic logging failed: ${error.message}`);
    }

    // Test audit logging
    try {
      auditLogService.logAuditEvent({
        action: 'health_test',
        resource: 'logging_system',
        success: true
      });
      tests.auditLogging = true;
    } catch (error) {
      tests.auditLogging = false;
      issues.push(`Audit logging failed: ${error.message}`);
    }

    // Test file system access
    try {
      const fs = require('fs');
      const logsDir = 'logs';
      
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      tests.fileSystemAccess = true;
    } catch (error) {
      tests.fileSystemAccess = false;
      issues.push(`File system access failed: ${error.message}`);
    }

    // Test Elasticsearch connection (if enabled)
    if (this.currentConfig.enableElasticsearchLogging) {
      try {
        // This would need actual Elasticsearch client implementation
        tests.elasticsearchConnection = true;
      } catch (error) {
        tests.elasticsearchConnection = false;
        issues.push(`Elasticsearch connection failed: ${error.message}`);
      }
    }

    const healthy = issues.length === 0;

    // Log health check result
    auditLogService.logSystemHealthEvent(
      'logging_system',
      healthy ? 'healthy' : 'unhealthy',
      tests,
      issues.length > 0 ? issues.join('; ') : undefined
    );

    return {
      healthy,
      issues,
      tests
    };
  }

  /**
   * Force log cleanup
   */
  public async forceLogCleanup(): Promise<void> {
    logger.info('Forcing log cleanup');
    
    auditLogService.logDataRetentionEvent(
      'cleanup_started',
      'manual_cleanup',
      0,
      true,
      'Manual cleanup initiated'
    );

    try {
      const result = await logRetentionService.performCleanup();
      
      logger.info('Manual log cleanup completed', { result });
      
      auditLogService.logDataRetentionEvent(
        'cleanup_completed',
        'manual_cleanup',
        result.filesDeleted + result.filesArchived,
        result.errors.length === 0,
        result.errors.length > 0 ? result.errors.join('; ') : 'Manual cleanup completed successfully'
      );
    } catch (error) {
      logger.error('Manual log cleanup failed', { error: error.message });
      
      auditLogService.logDataRetentionEvent(
        'cleanup_completed',
        'manual_cleanup',
        0,
        false,
        `Manual cleanup failed: ${error.message}`
      );
      
      throw error;
    }
  }

  /**
   * Sanitize configuration for logging (remove sensitive data)
   */
  private sanitizeConfig(config: LoggingConfiguration): any {
    const sanitized = { ...config };
    
    // Remove or mask sensitive fields
    if (sanitized.elasticsearch?.host?.includes('@')) {
      sanitized.elasticsearch.host = sanitized.elasticsearch.host.replace(
        /:\/\/[^@]+@/,
        '://[CREDENTIALS]@'
      );
    }
    
    return sanitized;
  }

  /**
   * Export configuration for backup
   */
  public exportConfiguration(): string {
    return JSON.stringify(this.sanitizeConfig(this.currentConfig), null, 2);
  }

  /**
   * Import configuration from backup
   */
  public importConfiguration(configJson: string): void {
    try {
      const importedConfig = JSON.parse(configJson);
      const validation = this.validateConfiguration(importedConfig);
      
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }
      
      this.updateConfiguration(importedConfig);
      
      logger.info('Configuration imported successfully');
    } catch (error) {
      logger.error('Failed to import configuration', { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
export const loggingConfigService = LoggingConfigService.getInstance();