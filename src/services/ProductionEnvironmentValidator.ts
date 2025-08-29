/**
 * Production Environment Validator Service
 * 
 * Comprehensive validation service for production environment configuration
 * Ensures all critical settings are properly configured for secure paper trading
 */

import { logger } from '../utils/logger';
import { EnvironmentValidator, EnvironmentValidationError } from '../utils/EnvironmentValidator';
import fs from 'fs';
import path from 'path';

export interface ProductionValidationResult {
  isValid: boolean;
  errors: Array<{
    category: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    code: string;
  }>;
  warnings: Array<{
    category: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    code: string;
  }>;
  validationSummary: {
    paperTradingSafety: boolean;
    monitoringConfiguration: boolean;
    sslConfiguration: boolean;
    databaseConfiguration: boolean;
    securityCompliance: boolean;
    exchangeConfiguration: boolean;
  };
  safetyScore: number;
  timestamp: Date;
}

export class ProductionEnvironmentValidator {
  private static instance: ProductionEnvironmentValidator;
  private environmentValidator: EnvironmentValidator;
  private errors: Array<{
    category: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    code: string;
  }> = [];
  private warnings: Array<{
    category: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    code: string;
  }> = [];

  private constructor() {
    this.environmentValidator = EnvironmentValidator.getInstance();
  }

  public static getInstance(): ProductionEnvironmentValidator {
    if (!ProductionEnvironmentValidator.instance) {
      ProductionEnvironmentValidator.instance = new ProductionEnvironmentValidator();
    }
    return ProductionEnvironmentValidator.instance;
  }

  /**
   * Comprehensive production environment validation
   */
  public async validateProductionEnvironment(): Promise<ProductionValidationResult> {
    logger.info('Starting comprehensive production environment validation');
    
    this.errors = [];
    this.warnings = [];

    try {
      // Core environment validation
      await this.validateCoreEnvironment();
      
      // Paper trading safety validation
      await this.validatePaperTradingSafety();
      
      // Monitoring configuration validation
      await this.validateMonitoringConfiguration();
      
      // SSL configuration validation
      await this.validateSSLConfiguration();
      
      // Database configuration validation
      await this.validateDatabaseConfiguration();
      
      // Security compliance validation
      await this.validateSecurityCompliance();
      
      // Exchange configuration validation
      await this.validateExchangeConfiguration();
      
      // Calculate overall safety score
      const safetyScore = this.calculateOverallSafetyScore();
      
      const validationSummary = {
        paperTradingSafety: this.errors.filter(e => e.category === 'paperTradingSafety').length === 0,
        monitoringConfiguration: this.errors.filter(e => e.category === 'monitoringConfiguration').length === 0,
        sslConfiguration: this.errors.filter(e => e.category === 'sslConfiguration').length === 0,
        databaseConfiguration: this.errors.filter(e => e.category === 'databaseConfiguration').length === 0,
        securityCompliance: this.errors.filter(e => e.category === 'securityCompliance').length === 0,
        exchangeConfiguration: this.errors.filter(e => e.category === 'exchangeConfiguration').length === 0,
      };

      const isValid = this.errors.length === 0 && safetyScore >= 90;

      const result: ProductionValidationResult = {
        isValid,
        errors: this.errors,
        warnings: this.warnings,
        validationSummary,
        safetyScore,
        timestamp: new Date()
      };

      logger.info('Production environment validation completed', {
        isValid,
        errorCount: this.errors.length,
        warningCount: this.warnings.length,
        safetyScore
      });

      return result;

    } catch (error) {
      logger.error('Production environment validation failed', error);
      throw new EnvironmentValidationError(
        `Production environment validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PRODUCTION_VALIDATION_FAILED',
        'critical'
      );
    }
  }

  /**
   * Validate core environment settings
   */
  private async validateCoreEnvironment(): Promise<void> {
    // Ensure NODE_ENV is production
    if (process.env.NODE_ENV !== 'production') {
      this.addError('coreEnvironment', 'NODE_ENV must be set to "production"', 'critical', 'NODE_ENV_NOT_PRODUCTION');
    }

    // Validate TRADING_SIMULATION_ONLY
    if (process.env.TRADING_SIMULATION_ONLY !== 'true') {
      this.addError('coreEnvironment', 'TRADING_SIMULATION_ONLY must be true for production safety', 'critical', 'TRADING_SIMULATION_ONLY_REQUIRED');
    }

    // Use existing environment validator for comprehensive checks
    try {
      this.environmentValidator.validateEnvironment();
    } catch (error) {
      if (error instanceof EnvironmentValidationError) {
        this.addError('coreEnvironment', error.message, error.severity, error.code);
      }
    }
  }

  /**
   * Validate paper trading safety configuration
   */
  private async validatePaperTradingSafety(): Promise<void> {
    const criticalSettings = {
      'PAPER_TRADING_MODE': 'true',
      'ALLOW_REAL_TRADES': 'false',
      'FORCE_PAPER_TRADING': 'true',
      'PAPER_TRADING_VALIDATION': 'strict',
      'TRADING_SIMULATION_ONLY': 'true'
    };

    for (const [key, expectedValue] of Object.entries(criticalSettings)) {
      if (process.env[key] !== expectedValue) {
        this.addError(
          'paperTradingSafety',
          `${key} must be ${expectedValue} for paper trading safety`,
          'critical',
          `PAPER_TRADING_${key}_INVALID`
        );
      }
    }

    // Validate virtual balances
    const virtualBalances = ['VIRTUAL_BALANCE_USD', 'VIRTUAL_BALANCE_BTC', 'VIRTUAL_BALANCE_ETH'];
    for (const balance of virtualBalances) {
      const value = process.env[balance];
      if (!value || parseFloat(value) <= 0) {
        this.addError(
          'paperTradingSafety',
          `${balance} must be set to a positive value for paper trading`,
          'high',
          `VIRTUAL_BALANCE_${balance}_INVALID`
        );
      }
    }

    // Validate paper trading audit logging
    if (process.env.PAPER_TRADE_AUDIT_LOG !== 'true') {
      this.addWarning(
        'paperTradingSafety',
        'PAPER_TRADE_AUDIT_LOG should be enabled for compliance',
        'medium',
        'PAPER_TRADE_AUDIT_LOG_DISABLED'
      );
    }
  }

  /**
   * Validate monitoring configuration
   */
  private async validateMonitoringConfiguration(): Promise<void> {
    // Critical: MONITORING_ENABLED must be true
    if (process.env.MONITORING_ENABLED !== 'true') {
      this.addError(
        'monitoringConfiguration',
        'MONITORING_ENABLED must be true for production monitoring',
        'critical',
        'MONITORING_DISABLED'
      );
    }

    // Validate monitoring components
    const monitoringSettings = {
      'METRICS_ENABLED': 'true',
      'HEALTH_CHECK_ENABLED': 'true',
      'LOG_FORMAT': 'json'
    };

    for (const [key, expectedValue] of Object.entries(monitoringSettings)) {
      if (process.env[key] !== expectedValue) {
        this.addWarning(
          'monitoringConfiguration',
          `${key} should be ${expectedValue} for proper monitoring`,
          'medium',
          `MONITORING_${key}_INVALID`
        );
      }
    }

    // Validate Prometheus configuration
    const prometheusPort = process.env.PROMETHEUS_PORT;
    if (!prometheusPort || isNaN(parseInt(prometheusPort))) {
      this.addError(
        'monitoringConfiguration',
        'PROMETHEUS_PORT must be a valid port number',
        'high',
        'PROMETHEUS_PORT_INVALID'
      );
    }

    // Validate Grafana configuration
    const grafanaPort = process.env.GRAFANA_PORT;
    if (!grafanaPort || isNaN(parseInt(grafanaPort))) {
      this.addError(
        'monitoringConfiguration',
        'GRAFANA_PORT must be a valid port number',
        'high',
        'GRAFANA_PORT_INVALID'
      );
    }

    const grafanaPassword = process.env.GRAFANA_PASSWORD;
    if (!grafanaPassword || grafanaPassword.length < 8) {
      this.addError(
        'monitoringConfiguration',
        'GRAFANA_PASSWORD must be at least 8 characters long',
        'high',
        'GRAFANA_PASSWORD_WEAK'
      );
    }

    // Validate log level
    const logLevel = process.env.LOG_LEVEL;
    const validLogLevels = ['error', 'warn', 'info', 'debug'];
    if (!logLevel || !validLogLevels.includes(logLevel)) {
      this.addWarning(
        'monitoringConfiguration',
        `LOG_LEVEL should be one of: ${validLogLevels.join(', ')}`,
        'low',
        'LOG_LEVEL_INVALID'
      );
    }
  }

  /**
   * Validate SSL configuration
   */
  private async validateSSLConfiguration(): Promise<void> {
    // SSL must be enabled in production
    if (process.env.SSL_ENABLED !== 'true') {
      this.addError(
        'sslConfiguration',
        'SSL_ENABLED must be true for production security',
        'critical',
        'SSL_DISABLED'
      );
    }

    // Validate domain name
    const domainName = process.env.DOMAIN_NAME;
    if (!domainName || domainName === 'localhost' || domainName === 'your-domain.com') {
      this.addError(
        'sslConfiguration',
        'DOMAIN_NAME must be set to a valid production domain',
        'high',
        'DOMAIN_NAME_INVALID'
      );
    }

    // Validate Let's Encrypt email
    const letsEncryptEmail = process.env.LETSENCRYPT_EMAIL;
    if (!letsEncryptEmail || !letsEncryptEmail.includes('@') || letsEncryptEmail === 'your-email@example.com') {
      this.addError(
        'sslConfiguration',
        'LETSENCRYPT_EMAIL must be set to a valid email address',
        'high',
        'LETSENCRYPT_EMAIL_INVALID'
      );
    }

    // Validate SSL certificate paths
    const sslPaths = {
      'SSL_CERT_PATH': process.env.SSL_CERT_PATH,
      'SSL_KEY_PATH': process.env.SSL_KEY_PATH,
      'SSL_CA_PATH': process.env.SSL_CA_PATH
    };

    for (const [key, path] of Object.entries(sslPaths)) {
      if (!path) {
        this.addError(
          'sslConfiguration',
          `${key} must be configured for SSL`,
          'high',
          `${key}_MISSING`
        );
      } else {
        // Check if SSL files exist (for self-signed certificates)
        const absolutePath = path.startsWith('/') ? path : `./docker/ssl/${path.split('/').pop()}`;
        try {
          if (fs.existsSync(absolutePath)) {
            this.addWarning(
              'sslConfiguration',
              `${key} points to existing certificate file`,
              'low',
              `${key}_EXISTS`
            );
          }
        } catch (error) {
          // File check failed, but path is configured
          this.addWarning(
            'sslConfiguration',
            `${key} is configured but file accessibility could not be verified`,
            'medium',
            `${key}_UNVERIFIED`
          );
        }
      }
    }

    // Validate CORS origin for HTTPS
    const corsOrigin = process.env.CORS_ORIGIN;
    if (corsOrigin && !corsOrigin.startsWith('https://')) {
      this.addWarning(
        'sslConfiguration',
        'CORS_ORIGIN should use HTTPS in production',
        'medium',
        'CORS_ORIGIN_NOT_HTTPS'
      );
    }
  }

  /**
   * Validate database configuration
   */
  private async validateDatabaseConfiguration(): Promise<void> {
    // Validate DATABASE_URL
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl || !databaseUrl.startsWith('postgresql://')) {
      this.addError(
        'databaseConfiguration',
        'DATABASE_URL must be a valid PostgreSQL connection string',
        'critical',
        'DATABASE_URL_INVALID'
      );
    }

    // SSL must be enabled for database
    if (process.env.DATABASE_SSL !== 'true') {
      this.addError(
        'databaseConfiguration',
        'DATABASE_SSL must be true for production security',
        'critical',
        'DATABASE_SSL_DISABLED'
      );
    }

    // Validate PostgreSQL password
    const postgresPassword = process.env.POSTGRES_PASSWORD;
    if (!postgresPassword || postgresPassword.length < 16) {
      this.addError(
        'databaseConfiguration',
        'POSTGRES_PASSWORD must be at least 16 characters long',
        'high',
        'POSTGRES_PASSWORD_WEAK'
      );
    }

    // Validate connection pool settings
    const poolSize = parseInt(process.env.DATABASE_POOL_SIZE || '0');
    if (poolSize < 10 || poolSize > 50) {
      this.addWarning(
        'databaseConfiguration',
        'DATABASE_POOL_SIZE should be between 10 and 50 for optimal performance',
        'medium',
        'DATABASE_POOL_SIZE_SUBOPTIMAL'
      );
    }

    const connectionTimeout = parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '0');
    if (connectionTimeout < 10000) {
      this.addWarning(
        'databaseConfiguration',
        'DATABASE_CONNECTION_TIMEOUT should be at least 10000ms',
        'medium',
        'DATABASE_CONNECTION_TIMEOUT_LOW'
      );
    }
  }

  /**
   * Validate security compliance
   */
  private async validateSecurityCompliance(): Promise<void> {
    // JWT Secret validation
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.length < 32) {
      this.addError(
        'securityCompliance',
        'JWT_SECRET must be at least 32 characters long',
        'critical',
        'JWT_SECRET_WEAK'
      );
    }

    // Encryption key validation
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey || encryptionKey.length < 32) {
      this.addError(
        'securityCompliance',
        'ENCRYPTION_KEY must be at least 32 characters long',
        'critical',
        'ENCRYPTION_KEY_WEAK'
      );
    }

    // Security features validation
    const securityFeatures = {
      'HELMET_ENABLED': 'true',
      'CSRF_PROTECTION': 'true',
      'SECURITY_HARDENING_ENABLED': 'true',
      'RATE_LIMITING_ENABLED': 'true'
    };

    for (const [key, expectedValue] of Object.entries(securityFeatures)) {
      if (process.env[key] !== expectedValue) {
        this.addError(
          'securityCompliance',
          `${key} must be ${expectedValue} for security compliance`,
          'high',
          `SECURITY_${key}_DISABLED`
        );
      }
    }

    // Validate password strengths
    const passwords = ['REDIS_PASSWORD', 'RABBITMQ_PASSWORD'];
    for (const passwordKey of passwords) {
      const password = process.env[passwordKey];
      if (!password || password.length < 16) {
        this.addError(
          'securityCompliance',
          `${passwordKey} must be at least 16 characters long`,
          'high',
          `${passwordKey}_WEAK`
        );
      }
    }

    // BCRYPT rounds validation
    const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '0');
    if (bcryptRounds < 12) {
      this.addWarning(
        'securityCompliance',
        'BCRYPT_ROUNDS should be at least 12 for security',
        'medium',
        'BCRYPT_ROUNDS_LOW'
      );
    }

    // Rate limiting validation
    const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '0');
    const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX || '0');
    if (!rateLimitWindowMs || !rateLimitMax) {
      this.addWarning(
        'securityCompliance',
        'Rate limiting should be configured for security',
        'medium',
        'RATE_LIMITING_NOT_CONFIGURED'
      );
    }
  }

  /**
   * Validate exchange configuration
   */
  private async validateExchangeConfiguration(): Promise<void> {
    // Critical: All exchanges must be in read-only mode
    const readOnlySettings = {
      'BINANCE_READ_ONLY': 'true',
      'KUCOIN_READ_ONLY': 'true',
      'BINANCE_SANDBOX': 'false',
      'KUCOIN_SANDBOX': 'false',
      'BINANCE_MAINNET': 'true',
      'KUCOIN_MAINNET': 'true'
    };

    for (const [key, expectedValue] of Object.entries(readOnlySettings)) {
      if (process.env[key] !== expectedValue) {
        this.addError(
          'exchangeConfiguration',
          `${key} must be ${expectedValue} for paper trading safety`,
          'critical',
          `EXCHANGE_${key}_INVALID`
        );
      }
    }

    // Check if any exchange APIs are configured
    const exchanges = ['BINANCE', 'KUCOIN'];
    let configuredExchanges = 0;

    for (const exchange of exchanges) {
      const apiKey = process.env[`${exchange}_API_KEY`];
      const apiSecret = process.env[`${exchange}_API_SECRET`];

      if (apiKey && apiSecret && !apiKey.startsWith('your-') && !apiSecret.startsWith('your-')) {
        configuredExchanges++;

        // Additional validation for KuCoin passphrase
        if (exchange === 'KUCOIN') {
          const passphrase = process.env.KUCOIN_PASSPHRASE;
          if (!passphrase || passphrase.startsWith('your-')) {
            this.addWarning(
              'exchangeConfiguration',
              'KUCOIN_PASSPHRASE should be configured if using KuCoin API',
              'medium',
              'KUCOIN_PASSPHRASE_MISSING'
            );
          }
        }
      }
    }

    if (configuredExchanges === 0) {
      this.addWarning(
        'exchangeConfiguration',
        'No exchange APIs configured - market data will be limited',
        'low',
        'NO_EXCHANGE_APIS_CONFIGURED'
      );
    }
  }

  /**
   * Calculate overall safety score
   */
  private calculateOverallSafetyScore(): number {
    const baseScore = this.environmentValidator.calculateSafetyScore().totalScore;
    
    // Deduct points for critical errors
    const criticalErrors = this.errors.filter(e => e.severity === 'critical').length;
    const highErrors = this.errors.filter(e => e.severity === 'high').length;
    const mediumErrors = this.errors.filter(e => e.severity === 'medium').length;
    
    const deductions = (criticalErrors * 20) + (highErrors * 10) + (mediumErrors * 5);
    
    return Math.max(0, baseScore - deductions);
  }

  /**
   * Add error to validation results
   */
  private addError(
    category: string,
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    code: string
  ): void {
    this.errors.push({ category, message, severity, code });
  }

  /**
   * Add warning to validation results
   */
  private addWarning(
    category: string,
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    code: string
  ): void {
    this.warnings.push({ category, message, severity, code });
  }

  /**
   * Generate comprehensive validation report
   */
  public async generateValidationReport(result: ProductionValidationResult): Promise<string> {
    const reportPath = path.join(process.cwd(), 'production-environment-validation-report.json');
    
    const reportData = {
      ...result,
      generatedAt: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      validationVersion: '1.0.0'
    };

    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    
    logger.info('Production environment validation report generated', { reportPath });
    
    return reportPath;
  }

  /**
   * Validate and throw if environment is not safe
   */
  public async validateAndThrow(): Promise<void> {
    const result = await this.validateProductionEnvironment();
    
    if (!result.isValid) {
      const criticalErrors = result.errors.filter(e => e.severity === 'critical');
      const errorMessage = criticalErrors.length > 0 
        ? `Critical production environment errors: ${criticalErrors.map(e => e.message).join('; ')}`
        : `Production environment validation failed with ${result.errors.length} errors`;
      
      throw new EnvironmentValidationError(
        errorMessage,
        'PRODUCTION_ENVIRONMENT_INVALID',
        'critical'
      );
    }
  }
}

// Export singleton instance
export const productionEnvironmentValidator = ProductionEnvironmentValidator.getInstance();