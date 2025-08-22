/**
 * Environment Validator
 * Validates that the environment is properly configured for paper trading safety
 */

import { logger } from './logger';
import { config } from '../config/config';

export interface EnvironmentValidation {
  isValid: boolean;
  isPaperTradingMode: boolean;
  violations: EnvironmentViolation[];
  warnings: EnvironmentWarning[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  environment: string;
}

export interface EnvironmentViolation {
  type: 'critical_safety' | 'configuration' | 'security' | 'production_safety';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  variable?: string;
  currentValue?: string;
  expectedValue?: string;
}

export interface EnvironmentWarning {
  type: 'configuration' | 'security' | 'performance';
  message: string;
  variable?: string;
  recommendation: string;
}

export class EnvironmentValidationError extends Error {
  public readonly violations: EnvironmentViolation[];
  public readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';

  constructor(message: string, violations: EnvironmentViolation[], riskLevel: 'low' | 'medium' | 'high' | 'critical') {
    super(message);
    this.name = 'EnvironmentValidationError';
    this.violations = violations;
    this.riskLevel = riskLevel;
  }
}

export class EnvironmentValidator {
  private static instance: EnvironmentValidator;

  // Critical environment variables that must be set correctly for paper trading
  // private readonly CRITICAL_PAPER_TRADING_VARS = {
  //   PAPER_TRADING_MODE: { expected: 'true', description: 'Must be enabled for safety' },
  //   ALLOW_REAL_TRADES: { expected: 'false', description: 'Must be disabled for paper trading' },
  //   NODE_ENV: { expected: ['development', 'production'], description: 'Must be valid environment' }
  // };

  // Security-related environment variables
  // private readonly SECURITY_VARS = {
  //   JWT_SECRET: { required: true, minLength: 32, description: 'JWT secret for authentication' },
  //   BCRYPT_ROUNDS: { expected: '12', description: 'Password hashing rounds' },
  //   RATE_LIMIT_MAX: { expected: '100', description: 'Rate limiting configuration' }
  // };

  // API key related variables that should be read-only
  // private readonly API_KEY_VARS = [
  //   'BINANCE_API_KEY',
  //   'BINANCE_API_SECRET',
  //   'KUCOIN_API_KEY',
  //   'KUCOIN_API_SECRET',
  //   'KUCOIN_PASSPHRASE'
  // ];

  private constructor() {
    logger.info('Environment Validator initialized', {
      isPaperTrading: true,
      nodeEnv: process.env.NODE_ENV
    });
  }

  public static getInstance(): EnvironmentValidator {
    if (!EnvironmentValidator.instance) {
      EnvironmentValidator.instance = new EnvironmentValidator();
    }
    return EnvironmentValidator.instance;
  }

  /**
   * Validate the entire environment for paper trading safety
   */
  public validateEnvironment(): EnvironmentValidation {
    const violations: EnvironmentViolation[] = [];
    const warnings: EnvironmentWarning[] = [];

    try {
      logger.info('Starting environment validation for paper trading safety');

      // Validate critical paper trading settings
      violations.push(...this.validatePaperTradingSettings());

      // Validate security settings
      violations.push(...this.validateSecuritySettings());

      // Validate API key configuration
      violations.push(...this.validateApiKeyConfiguration());

      // Validate production-specific settings
      if (config.environment.isProduction) {
        violations.push(...this.validateProductionSettings());
      }

      // Generate warnings
      warnings.push(...this.generateWarnings());

      // Calculate risk level
      const riskLevel = this.calculateRiskLevel(violations);

      // Determine if environment is valid
      const isValid = riskLevel !== 'critical' && violations.filter(v => v.severity === 'critical').length === 0;

      const validation: EnvironmentValidation = {
        isValid,
        isPaperTradingMode: true, // Always true for paper trading
        violations,
        warnings,
        riskLevel,
        environment: process.env.NODE_ENV || 'development'
      };

      this.logValidationResult(validation);

      // Throw error for critical violations
      if (!isValid) {
        throw new EnvironmentValidationError(
          `Environment validation failed with ${violations.length} violations`,
          violations,
          riskLevel
        );
      }

      return validation;
    } catch (error) {
      if (error instanceof EnvironmentValidationError) {
        throw error;
      }

      logger.error('Environment validation failed with unexpected error:', error);
      throw new EnvironmentValidationError(
        'Environment validation failed due to unexpected error',
        [{
          type: 'critical_safety',
          message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'critical'
        }],
        'critical'
      );
    }
  }

  /**
   * Validate critical paper trading settings
   */
  private validatePaperTradingSettings(): EnvironmentViolation[] {
    const violations: EnvironmentViolation[] = [];

    // Check PAPER_TRADING_MODE
    const paperTradingMode = process.env.PAPER_TRADING_MODE;
    if (paperTradingMode === 'false' || paperTradingMode === '0') {
      violations.push({
        type: 'critical_safety',
        message: 'CRITICAL: Paper trading mode is disabled - this is unsafe for production',
        severity: 'critical',
        variable: 'PAPER_TRADING_MODE',
        currentValue: paperTradingMode || 'undefined',
        expectedValue: 'true'
      });
    }

    // Check ALLOW_REAL_TRADES
    const allowRealTrades = process.env.ALLOW_REAL_TRADES;
    if (allowRealTrades === 'true' || allowRealTrades === '1') {
      violations.push({
        type: 'critical_safety',
        message: 'CRITICAL: Real trades are enabled - this violates paper trading safety',
        severity: 'critical',
        variable: 'ALLOW_REAL_TRADES',
        currentValue: allowRealTrades,
        expectedValue: 'false'
      });
    }

    // Check NODE_ENV
    const nodeEnv = process.env.NODE_ENV;
    if (!nodeEnv || !['development', 'production', 'test'].includes(nodeEnv)) {
      violations.push({
        type: 'configuration',
        message: 'NODE_ENV is not set to a valid value',
        severity: 'medium',
        variable: 'NODE_ENV',
        currentValue: nodeEnv || 'undefined',
        expectedValue: 'development|production|test'
      });
    }

    // Validate paper trading configuration values
    const initialBalance = process.env.INITIAL_VIRTUAL_BALANCE;
    if (initialBalance && (isNaN(Number(initialBalance)) || Number(initialBalance) <= 0)) {
      violations.push({
        type: 'configuration',
        message: 'Initial virtual balance must be a positive number',
        severity: 'medium',
        variable: 'INITIAL_VIRTUAL_BALANCE',
        currentValue: initialBalance,
        expectedValue: '>0'
      });
    }

    return violations;
  }

  /**
   * Validate security settings
   */
  private validateSecuritySettings(): EnvironmentViolation[] {
    const violations: EnvironmentViolation[] = [];

    // Check JWT_SECRET
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.length < 32) {
      violations.push({
        type: 'security',
        message: 'JWT_SECRET is missing or too short (minimum 32 characters)',
        severity: 'high',
        variable: 'JWT_SECRET',
        currentValue: jwtSecret ? `${jwtSecret.length} chars` : 'undefined',
        expectedValue: '>=32 chars'
      });
    }

    // Check if using default JWT secret
    if (jwtSecret === 'your-super-secret-jwt-key-change-in-production') {
      violations.push({
        type: 'security',
        message: 'Using default JWT secret - change this in production',
        severity: 'critical',
        variable: 'JWT_SECRET',
        currentValue: 'default',
        expectedValue: 'unique secret'
      });
    }

    // Check BCRYPT_ROUNDS
    const bcryptRounds = process.env.BCRYPT_ROUNDS;
    if (bcryptRounds && (isNaN(Number(bcryptRounds)) || Number(bcryptRounds) < 10)) {
      violations.push({
        type: 'security',
        message: 'BCRYPT_ROUNDS should be at least 10 for security',
        severity: 'medium',
        variable: 'BCRYPT_ROUNDS',
        currentValue: bcryptRounds,
        expectedValue: '>=10'
      });
    }

    return violations;
  }

  /**
   * Validate API key configuration
   */
  private validateApiKeyConfiguration(): EnvironmentViolation[] {
    const violations: EnvironmentViolation[] = [];

    // Check if API keys are present (they should be for mainnet data)
    const binanceKey = process.env.BINANCE_API_KEY;
    const kucoinKey = process.env.KUCOIN_API_KEY;

    if (!binanceKey && !kucoinKey) {
      violations.push({
        type: 'configuration',
        message: 'No exchange API keys configured - live market data will not be available',
        severity: 'medium',
        variable: 'API_KEYS',
        currentValue: 'none',
        expectedValue: 'at least one exchange'
      });
    }

    // Warn about API secrets (they might indicate trading permissions)
    const binanceSecret = process.env.BINANCE_API_SECRET;
    const kucoinSecret = process.env.KUCOIN_API_SECRET;
    const kucoinPassphrase = process.env.KUCOIN_PASSPHRASE;

    if (binanceSecret && binanceSecret.trim() !== '') {
      violations.push({
        type: 'security',
        message: 'Binance API secret is configured - ensure API key has read-only permissions',
        severity: 'medium',
        variable: 'BINANCE_API_SECRET',
        currentValue: 'present',
        expectedValue: 'read-only key preferred'
      });
    }

    if (kucoinSecret && kucoinSecret.trim() !== '') {
      violations.push({
        type: 'security',
        message: 'KuCoin API secret is configured - ensure API key has read-only permissions',
        severity: 'medium',
        variable: 'KUCOIN_API_SECRET',
        currentValue: 'present',
        expectedValue: 'read-only key preferred'
      });
    }

    if (kucoinPassphrase && kucoinPassphrase.trim() !== '') {
      violations.push({
        type: 'security',
        message: 'KuCoin passphrase is configured - this may indicate trading permissions',
        severity: 'high',
        variable: 'KUCOIN_PASSPHRASE',
        currentValue: 'present',
        expectedValue: 'not required for read-only'
      });
    }

    // Check sandbox settings
    const binanceSandbox = process.env.BINANCE_SANDBOX;
    const kucoinSandbox = process.env.KUCOIN_SANDBOX;

    if (config.environment.isProduction && (binanceSandbox === 'true' || kucoinSandbox === 'true')) {
      violations.push({
        type: 'configuration',
        message: 'Using sandbox APIs in production - switch to mainnet for live data',
        severity: 'medium',
        variable: 'SANDBOX_MODE',
        currentValue: 'enabled',
        expectedValue: 'disabled in production'
      });
    }

    return violations;
  }

  /**
   * Validate production-specific settings
   */
  private validateProductionSettings(): EnvironmentViolation[] {
    const violations: EnvironmentViolation[] = [];

    // In production, paper trading MUST be enabled
    const paperTradingEnabled = process.env.PAPER_TRADING_MODE !== 'false';
    if (!paperTradingEnabled) {
      violations.push({
        type: 'production_safety',
        message: 'CRITICAL: Paper trading is disabled in production environment',
        severity: 'critical',
        variable: 'PAPER_TRADING_ENABLED',
        currentValue: 'false',
        expectedValue: 'true'
      });
    }

    // Real trades MUST be disabled in production
    const allowRealTrades = process.env.ALLOW_REAL_TRADES === 'true';
    if (allowRealTrades) {
      violations.push({
        type: 'production_safety',
        message: 'CRITICAL: Real trades are allowed in production - this is unsafe',
        severity: 'critical',
        variable: 'ALLOW_REAL_TRADES',
        currentValue: 'true',
        expectedValue: 'false'
      });
    }

    // Check database URL for production
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl || databaseUrl.includes('localhost')) {
      violations.push({
        type: 'configuration',
        message: 'Database URL appears to be localhost in production',
        severity: 'high',
        variable: 'DATABASE_URL',
        currentValue: databaseUrl ? 'localhost' : 'undefined',
        expectedValue: 'production database'
      });
    }

    // Check Redis configuration
    const redisHost = process.env.REDIS_HOST;
    if (!redisHost || redisHost === 'localhost') {
      violations.push({
        type: 'configuration',
        message: 'Redis host appears to be localhost in production',
        severity: 'medium',
        variable: 'REDIS_HOST',
        currentValue: redisHost || 'localhost',
        expectedValue: 'production redis'
      });
    }

    return violations;
  }

  /**
   * Generate warnings for non-critical issues
   */
  private generateWarnings(): EnvironmentWarning[] {
    const warnings: EnvironmentWarning[] = [];

    // Check for development-specific warnings
    if (process.env.NODE_ENV !== 'production') {
      warnings.push({
        type: 'configuration',
        message: 'Running in development mode',
        recommendation: 'Ensure proper configuration before deploying to production'
      });
    }

    // Check for missing optional configurations
    if (!process.env.PROMETHEUS_PORT) {
      warnings.push({
        type: 'performance',
        message: 'Prometheus monitoring port not configured',
        variable: 'PROMETHEUS_PORT',
        recommendation: 'Configure monitoring for production deployment'
      });
    }

    if (!process.env.LOG_LEVEL) {
      warnings.push({
        type: 'configuration',
        message: 'Log level not explicitly set',
        variable: 'LOG_LEVEL',
        recommendation: 'Set LOG_LEVEL for better log management'
      });
    }

    return warnings;
  }

  /**
   * Calculate overall risk level
   */
  private calculateRiskLevel(violations: EnvironmentViolation[]): 'low' | 'medium' | 'high' | 'critical' {
    if (violations.length === 0) {
      return 'low';
    }

    const criticalViolations = violations.filter(v => v.severity === 'critical');
    const highViolations = violations.filter(v => v.severity === 'high');
    const mediumViolations = violations.filter(v => v.severity === 'medium');

    if (criticalViolations.length > 0) {
      return 'critical';
    }
    if (highViolations.length > 1) {
      return 'critical';
    }
    if (highViolations.length > 0) {
      return 'high';
    }
    if (mediumViolations.length > 3) {
      return 'high';
    }
    if (mediumViolations.length > 0) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Log validation result
   */
  private logValidationResult(validation: EnvironmentValidation): void {
    const logLevel = validation.riskLevel === 'critical' ? 'error' :
                    validation.riskLevel === 'high' ? 'warn' : 'info';

    logger[logLevel]('Environment validation completed', {
      isValid: validation.isValid,
      isPaperTradingMode: validation.isPaperTradingMode,
      riskLevel: validation.riskLevel,
      environment: validation.environment,
      violationCount: validation.violations.length,
      warningCount: validation.warnings.length,
      violations: validation.violations.map(v => ({
        type: v.type,
        severity: v.severity,
        variable: v.variable,
        message: v.message
      })),
      warnings: validation.warnings.map(w => ({
        type: w.type,
        variable: w.variable,
        message: w.message
      })),
      isPaperTrading: true
    });

    // Log individual critical violations
    validation.violations
      .filter(v => v.severity === 'critical')
      .forEach(violation => {
        logger.error(`CRITICAL ENVIRONMENT VIOLATION: ${violation.message}`, {
          type: violation.type,
          variable: violation.variable,
          currentValue: violation.currentValue,
          expectedValue: violation.expectedValue,
          isPaperTrading: true
        });
      });
  }

  /**
   * Validate environment on startup
   */
  public validateOnStartup(): void {
    try {
      const validation = this.validateEnvironment();
      
      if (validation.isValid) {
        logger.info('✅ Environment validation passed - paper trading mode is properly configured', {
          isPaperTradingMode: validation.isPaperTradingMode,
          riskLevel: validation.riskLevel,
          warningCount: validation.warnings.length
        });
      }
    } catch (error) {
      logger.error('❌ Environment validation failed - application startup blocked', error);
      
      // In production, we should exit the process for safety
      if (process.env.NODE_ENV === 'production') {
        logger.error('Exiting application due to critical environment validation failures in production');
        process.exit(1);
      }
      
      throw error;
    }
  }

  /**
   * Get current environment status
   */
  public getEnvironmentStatus(): {
    isPaperTradingMode: boolean;
    allowRealTrades: boolean;
    environment: string;
    isProduction: boolean;
    configuredExchanges: string[];
  } {
    const configuredExchanges: string[] = [];
    
    if (process.env.BINANCE_API_KEY) configuredExchanges.push('binance');
    if (process.env.KUCOIN_API_KEY) configuredExchanges.push('kucoin');

    return {
      isPaperTradingMode: process.env.PAPER_TRADING_MODE !== 'false',
      allowRealTrades: process.env.ALLOW_REAL_TRADES === 'true',
      environment: process.env.NODE_ENV || 'development',
      isProduction: process.env.NODE_ENV === 'production',
      configuredExchanges
    };
  }
}

// Export singleton instance and validation function
export const environmentValidator = EnvironmentValidator.getInstance();

export const validateEnvironmentOnStartup = (): void => {
  environmentValidator.validateOnStartup();
};