/**
 * API Permission Enforcement Service
 * Centralized service for enforcing API key restrictions across all exchange integrations
 */

import { logger } from '../utils/logger';
import { 
  apiPermissionValidator, 
  ApiKeyValidation, 
  ExchangeApiInfo 
} from '../utils/ApiPermissionValidator';
import { apiPermissionGuard } from '../middleware/apiPermissionGuard';

export interface ExchangeConfig {
  exchange: string;
  apiKey: string;
  apiSecret?: string;
  passphrase?: string;
  sandbox: boolean;
  enabled: boolean;
  lastValidation?: Date;
  validationResult?: ApiKeyValidation;
}

export interface EnforcementConfig {
  strictMode: boolean;
  allowTradingPermissions: boolean;
  maxRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiredSandboxMode: boolean;
  validationInterval: number; // in milliseconds
  autoDisableUnsafeKeys: boolean;
}

export interface EnforcementReport {
  timestamp: Date;
  totalExchanges: number;
  validExchanges: number;
  invalidExchanges: number;
  disabledExchanges: number;
  criticalViolations: number;
  overallSafetyScore: number;
  exchanges: Array<{
    exchange: string;
    status: 'valid' | 'invalid' | 'disabled' | 'error';
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    violations: string[];
    lastValidated: Date;
  }>;
}

export class ApiPermissionEnforcementService {
  private static instance: ApiPermissionEnforcementService;
  private exchangeConfigs: Map<string, ExchangeConfig> = new Map();
  private enforcementConfig: EnforcementConfig;
  private validationTimer: NodeJS.Timeout | null = null;
  private lastEnforcementReport: EnforcementReport | null = null;

  private constructor() {
    this.enforcementConfig = {
      strictMode: true,
      allowTradingPermissions: false,
      maxRiskLevel: 'medium',
      requiredSandboxMode: true,
      validationInterval: 5 * 60 * 1000, // 5 minutes
      autoDisableUnsafeKeys: true
    };

    this.initializeFromEnvironment();
    this.startPeriodicValidation();

    logger.info('API Permission Enforcement Service initialized', {
      strictMode: this.enforcementConfig.strictMode,
      allowTradingPermissions: this.enforcementConfig.allowTradingPermissions,
      maxRiskLevel: this.enforcementConfig.maxRiskLevel,
      validationInterval: this.enforcementConfig.validationInterval
    });
  }

  public static getInstance(): ApiPermissionEnforcementService {
    if (!ApiPermissionEnforcementService.instance) {
      ApiPermissionEnforcementService.instance = new ApiPermissionEnforcementService();
    }
    return ApiPermissionEnforcementService.instance;
  }

  /**
   * Initialize exchange configurations from environment variables
   */
  private initializeFromEnvironment(): void {
    // Binance configuration
    if (process.env.BINANCE_API_KEY) {
      this.exchangeConfigs.set('binance', {
        exchange: 'binance',
        apiKey: process.env.BINANCE_API_KEY,
        apiSecret: process.env.BINANCE_API_SECRET,
        sandbox: process.env.BINANCE_TESTNET === 'true',
        enabled: true
      });
    }

    // KuCoin configuration
    if (process.env.KUCOIN_API_KEY) {
      this.exchangeConfigs.set('kucoin', {
        exchange: 'kucoin',
        apiKey: process.env.KUCOIN_API_KEY,
        apiSecret: process.env.KUCOIN_API_SECRET,
        passphrase: process.env.KUCOIN_PASSPHRASE,
        sandbox: process.env.KUCOIN_SANDBOX === 'true',
        enabled: true
      });
    }

    logger.info('Exchange configurations initialized from environment', {
      exchanges: Array.from(this.exchangeConfigs.keys()),
      totalConfigs: this.exchangeConfigs.size
    });
  }

  /**
   * Add or update exchange configuration
   */
  public addExchangeConfig(config: ExchangeConfig): void {
    this.exchangeConfigs.set(config.exchange, config);
    
    logger.info(`Exchange configuration added/updated: ${config.exchange}`, {
      exchange: config.exchange,
      sandbox: config.sandbox,
      enabled: config.enabled
    });
  }

  /**
   * Remove exchange configuration
   */
  public removeExchangeConfig(exchange: string): boolean {
    const removed = this.exchangeConfigs.delete(exchange);
    
    if (removed) {
      logger.info(`Exchange configuration removed: ${exchange}`);
    }
    
    return removed;
  }

  /**
   * Get exchange configuration
   */
  public getExchangeConfig(exchange: string): ExchangeConfig | null {
    return this.exchangeConfigs.get(exchange) || null;
  }

  /**
   * Get all exchange configurations
   */
  public getAllExchangeConfigs(): ExchangeConfig[] {
    return Array.from(this.exchangeConfigs.values());
  }

  /**
   * Validate all configured exchanges
   */
  public async validateAllExchanges(): Promise<EnforcementReport> {
    const report: EnforcementReport = {
      timestamp: new Date(),
      totalExchanges: this.exchangeConfigs.size,
      validExchanges: 0,
      invalidExchanges: 0,
      disabledExchanges: 0,
      criticalViolations: 0,
      overallSafetyScore: 0,
      exchanges: []
    };

    for (const [exchangeName, config] of this.exchangeConfigs) {
      try {
        const exchangeReport = await this.validateExchange(config);
        report.exchanges.push(exchangeReport);

        switch (exchangeReport.status) {
          case 'valid':
            report.validExchanges++;
            break;
          case 'invalid':
            report.invalidExchanges++;
            if (exchangeReport.riskLevel === 'critical') {
              report.criticalViolations++;
            }
            break;
          case 'disabled':
            report.disabledExchanges++;
            break;
          case 'error':
            report.invalidExchanges++;
            break;
        }
      } catch (error) {
        logger.error(`Failed to validate exchange ${exchangeName}:`, error);
        
        report.exchanges.push({
          exchange: exchangeName,
          status: 'error',
          riskLevel: 'critical',
          violations: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
          lastValidated: new Date()
        });
        
        report.invalidExchanges++;
        report.criticalViolations++;
      }
    }

    // Calculate overall safety score
    if (report.totalExchanges > 0) {
      const safetyScore = (report.validExchanges / report.totalExchanges) * 100;
      const criticalPenalty = (report.criticalViolations / report.totalExchanges) * 50;
      report.overallSafetyScore = Math.max(0, Math.round(safetyScore - criticalPenalty));
    } else {
      report.overallSafetyScore = 100; // No exchanges configured is considered safe
    }

    this.lastEnforcementReport = report;

    logger.info('Exchange validation completed', {
      totalExchanges: report.totalExchanges,
      validExchanges: report.validExchanges,
      invalidExchanges: report.invalidExchanges,
      criticalViolations: report.criticalViolations,
      overallSafetyScore: report.overallSafetyScore
    });

    return report;
  }

  /**
   * Validate a single exchange
   */
  private async validateExchange(config: ExchangeConfig): Promise<{
    exchange: string;
    status: 'valid' | 'invalid' | 'disabled' | 'error';
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    violations: string[];
    lastValidated: Date;
  }> {
    if (!config.enabled) {
      return {
        exchange: config.exchange,
        status: 'disabled',
        riskLevel: 'low',
        violations: [],
        lastValidated: new Date()
      };
    }

    try {
      const apiInfo: ExchangeApiInfo = {
        exchange: config.exchange,
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
        passphrase: config.passphrase,
        sandbox: config.sandbox,
        testConnection: false
      };

      const validation = await apiPermissionValidator.validateApiKey(apiInfo);

      // Update config with validation result
      config.lastValidation = new Date();
      config.validationResult = validation;

      // Check if validation meets enforcement requirements
      const violations: string[] = [];
      let status: 'valid' | 'invalid' = 'valid';

      // Check if trading permissions are allowed
      if (!this.enforcementConfig.allowTradingPermissions && !validation.isReadOnly) {
        violations.push('Trading permissions detected - not allowed in paper trading mode');
        status = 'invalid';
      }

      // Check risk level
      if (this.isRiskLevelTooHigh(validation.riskLevel)) {
        violations.push(`Risk level ${validation.riskLevel} exceeds maximum allowed ${this.enforcementConfig.maxRiskLevel}`);
        status = 'invalid';
      }

      // Check sandbox requirement
      if (this.enforcementConfig.requiredSandboxMode && !config.sandbox) {
        violations.push('Sandbox mode required but not enabled');
        status = 'invalid';
      }

      // Add validation violations
      validation.violations.forEach(violation => {
        violations.push(violation.message);
      });

      // Auto-disable unsafe keys if configured
      if (status === 'invalid' && this.enforcementConfig.autoDisableUnsafeKeys && validation.riskLevel === 'critical') {
        config.enabled = false;
        violations.push('Exchange automatically disabled due to critical security violations');
        
        logger.warn(`Exchange ${config.exchange} automatically disabled due to critical violations`, {
          exchange: config.exchange,
          violations: violations
        });
      }

      return {
        exchange: config.exchange,
        status: config.enabled ? status : 'disabled',
        riskLevel: validation.riskLevel,
        violations,
        lastValidated: new Date()
      };

    } catch (error) {
      logger.error(`Exchange validation error for ${config.exchange}:`, error);
      
      return {
        exchange: config.exchange,
        status: 'error',
        riskLevel: 'critical',
        violations: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        lastValidated: new Date()
      };
    }
  }

  /**
   * Check if risk level is too high
   */
  private isRiskLevelTooHigh(riskLevel: 'low' | 'medium' | 'high' | 'critical'): boolean {
    const riskLevels = ['low', 'medium', 'high', 'critical'];
    const maxIndex = riskLevels.indexOf(this.enforcementConfig.maxRiskLevel);
    const currentIndex = riskLevels.indexOf(riskLevel);
    
    return currentIndex > maxIndex;
  }

  /**
   * Start periodic validation
   */
  private startPeriodicValidation(): void {
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
    }

    this.validationTimer = setInterval(async () => {
      try {
        await this.validateAllExchanges();
      } catch (error) {
        logger.error('Periodic validation failed:', error);
      }
    }, this.enforcementConfig.validationInterval);

    logger.info('Periodic validation started', {
      interval: this.enforcementConfig.validationInterval
    });
  }

  /**
   * Stop periodic validation
   */
  public stopPeriodicValidation(): void {
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
      this.validationTimer = null;
      logger.info('Periodic validation stopped');
    }
  }

  /**
   * Get enforcement configuration
   */
  public getEnforcementConfig(): EnforcementConfig {
    return { ...this.enforcementConfig };
  }

  /**
   * Update enforcement configuration
   */
  public updateEnforcementConfig(updates: Partial<EnforcementConfig>): void {
    this.enforcementConfig = { ...this.enforcementConfig, ...updates };
    
    // Restart periodic validation with new interval if changed
    if (updates.validationInterval) {
      this.startPeriodicValidation();
    }

    logger.info('Enforcement configuration updated', {
      config: this.enforcementConfig
    });
  }

  /**
   * Enable strict paper trading mode
   */
  public enableStrictPaperTradingMode(): void {
    this.enforcementConfig = {
      ...this.enforcementConfig,
      strictMode: true,
      allowTradingPermissions: false,
      maxRiskLevel: 'low',
      requiredSandboxMode: true,
      autoDisableUnsafeKeys: true
    };

    // Also enforce on the API permission guard
    apiPermissionGuard.enforceReadOnlyApiKeys();

    logger.warn('Strict paper trading mode enabled', {
      config: this.enforcementConfig
    });
  }

  /**
   * Get last enforcement report
   */
  public getLastEnforcementReport(): EnforcementReport | null {
    return this.lastEnforcementReport;
  }

  /**
   * Check if exchange is safe to use
   */
  public async isExchangeSafe(exchange: string): Promise<boolean> {
    const config = this.exchangeConfigs.get(exchange);
    if (!config || !config.enabled) {
      return false;
    }

    try {
      const exchangeReport = await this.validateExchange(config);
      return exchangeReport.status === 'valid' && exchangeReport.riskLevel !== 'critical';
    } catch (error) {
      logger.error(`Failed to check exchange safety for ${exchange}:`, error);
      return false;
    }
  }

  /**
   * Get safe exchanges only
   */
  public async getSafeExchanges(): Promise<string[]> {
    const safeExchanges: string[] = [];
    
    for (const exchangeName of this.exchangeConfigs.keys()) {
      if (await this.isExchangeSafe(exchangeName)) {
        safeExchanges.push(exchangeName);
      }
    }
    
    return safeExchanges;
  }

  /**
   * Block all trading operations if any exchange is unsafe
   */
  public async enforceGlobalTradingBlock(): Promise<boolean> {
    const report = await this.validateAllExchanges();
    
    if (report.criticalViolations > 0 || report.overallSafetyScore < 90) {
      logger.critical('Global trading block enforced due to unsafe API keys', {
        criticalViolations: report.criticalViolations,
        safetyScore: report.overallSafetyScore
      });
      
      // Disable all exchanges with critical violations
      for (const exchangeReport of report.exchanges) {
        if (exchangeReport.riskLevel === 'critical') {
          const config = this.exchangeConfigs.get(exchangeReport.exchange);
          if (config) {
            config.enabled = false;
            logger.warn(`Exchange ${exchangeReport.exchange} disabled due to critical violations`);
          }
        }
      }
      
      return true; // Trading blocked
    }
    
    return false; // Trading allowed
  }

  /**
   * Shutdown the service
   */
  public shutdown(): void {
    this.stopPeriodicValidation();
    this.exchangeConfigs.clear();
    logger.info('API Permission Enforcement Service shutdown');
  }
}

// Export singleton instance
export const apiPermissionEnforcementService = ApiPermissionEnforcementService.getInstance();