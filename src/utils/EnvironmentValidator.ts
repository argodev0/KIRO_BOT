/**
 * Environment Validator
 * Validates environment configuration for paper trading safety
 */

import { logger } from './logger';

export interface EnvironmentStatus {
  isPaperTradingMode: boolean;
  allowRealTrades: boolean;
  environment: string;
  isProduction: boolean;
  configuredExchanges: string[];
  securityLevel: 'low' | 'medium' | 'high' | 'critical';
  validationTimestamp: number;
}

export class EnvironmentValidationError extends Error {
  public readonly code: string;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';

  constructor(message: string, code: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'critical') {
    super(message);
    this.name = 'EnvironmentValidationError';
    this.code = code;
    this.severity = severity;
  }
}

export class EnvironmentValidator {
  private static instance: EnvironmentValidator;

  private constructor() {
    logger.info('Environment Validator initialized', {
      nodeEnv: process.env.NODE_ENV,
      paperTradingMode: process.env.PAPER_TRADING_MODE,
      allowRealTrades: process.env.ALLOW_REAL_TRADES
    });
  }

  public static getInstance(): EnvironmentValidator {
    if (!EnvironmentValidator.instance) {
      EnvironmentValidator.instance = new EnvironmentValidator();
    }
    return EnvironmentValidator.instance;
  }

  /**
   * Validate environment configuration for paper trading safety
   */
  public validateEnvironment(): void {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const paperTradingMode = process.env.PAPER_TRADING_MODE;
    const allowRealTrades = process.env.ALLOW_REAL_TRADES;
    const jwtSecret = process.env.JWT_SECRET;

    // Critical validation: Paper trading must be enabled
    if (paperTradingMode !== 'true') {
      throw new EnvironmentValidationError(
        'CRITICAL: Paper trading mode must be enabled (PAPER_TRADING_MODE=true)',
        'PAPER_TRADING_DISABLED',
        'critical'
      );
    }

    // Critical validation: Real trades must be disabled
    if (allowRealTrades === 'true') {
      throw new EnvironmentValidationError(
        'CRITICAL: Real trades must be disabled (ALLOW_REAL_TRADES=false)',
        'REAL_TRADES_ENABLED',
        'critical'
      );
    }

    // Production-specific validations
    if (nodeEnv === 'production') {
      if (!jwtSecret || jwtSecret.length < 32) {
        throw new EnvironmentValidationError(
          'Production environment requires secure JWT secret (min 32 characters)',
          'INSECURE_JWT_SECRET',
          'high'
        );
      }

      // Ensure production has proper paper trading configuration
      if (paperTradingMode !== 'true' || allowRealTrades === 'true') {
        throw new EnvironmentValidationError(
          'Production environment must have paper trading enabled and real trades disabled',
          'PRODUCTION_UNSAFE_CONFIG',
          'critical'
        );
      }
    }

    logger.info('Environment validation successful', {
      nodeEnv,
      paperTradingMode: paperTradingMode === 'true',
      allowRealTrades: allowRealTrades === 'true',
      isProduction: nodeEnv === 'production'
    });
  }

  /**
   * Get comprehensive environment status
   */
  public getEnvironmentStatus(): EnvironmentStatus {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const paperTradingMode = process.env.PAPER_TRADING_MODE === 'true';
    const allowRealTrades = process.env.ALLOW_REAL_TRADES === 'true';
    const isProduction = nodeEnv === 'production';

    // Determine configured exchanges
    const configuredExchanges: string[] = [];
    if (process.env.BINANCE_API_KEY) configuredExchanges.push('binance');
    if (process.env.KUCOIN_API_KEY) configuredExchanges.push('kucoin');
    if (process.env.COINBASE_API_KEY) configuredExchanges.push('coinbase');

    // Calculate security level
    let securityLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    if (!paperTradingMode || allowRealTrades) {
      securityLevel = 'critical';
    } else if (isProduction && configuredExchanges.length > 0) {
      securityLevel = 'medium';
    } else if (configuredExchanges.length > 0) {
      securityLevel = 'low';
    }

    return {
      isPaperTradingMode: paperTradingMode,
      allowRealTrades,
      environment: nodeEnv,
      isProduction,
      configuredExchanges,
      securityLevel,
      validationTimestamp: Date.now()
    };
  }

  /**
   * Validate specific environment variable
   */
  public validateEnvironmentVariable(
    name: string, 
    expectedValue?: string, 
    required: boolean = false
  ): boolean {
    const value = process.env[name];

    if (required && (!value || value.trim() === '')) {
      throw new EnvironmentValidationError(
        `Required environment variable ${name} is not set`,
        'MISSING_REQUIRED_ENV_VAR',
        'high'
      );
    }

    if (expectedValue && value !== expectedValue) {
      throw new EnvironmentValidationError(
        `Environment variable ${name} has unexpected value. Expected: ${expectedValue}, Got: ${value}`,
        'UNEXPECTED_ENV_VAR_VALUE',
        'medium'
      );
    }

    return true;
  }

  /**
   * Check if environment is safe for paper trading
   */
  public isSafeForPaperTrading(): boolean {
    try {
      this.validateEnvironment();
      return true;
    } catch (error) {
      logger.error('Environment is not safe for paper trading:', error);
      return false;
    }
  }

  /**
   * Get environment warnings
   */
  public getEnvironmentWarnings(): Array<{
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }> {
    const warnings: Array<{
      type: string;
      message: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
    }> = [];

    const nodeEnv = process.env.NODE_ENV || 'development';
    const paperTradingMode = process.env.PAPER_TRADING_MODE;
    const allowRealTrades = process.env.ALLOW_REAL_TRADES;

    // Check for development environment in production
    if (nodeEnv === 'development' && process.env.PORT === '80') {
      warnings.push({
        type: 'DEVELOPMENT_IN_PRODUCTION',
        message: 'Development environment detected on production port',
        severity: 'medium'
      });
    }

    // Check for missing paper trading configuration
    if (paperTradingMode !== 'true') {
      warnings.push({
        type: 'PAPER_TRADING_NOT_ENABLED',
        message: 'Paper trading mode is not explicitly enabled',
        severity: 'critical'
      });
    }

    // Check for real trades enabled
    if (allowRealTrades === 'true') {
      warnings.push({
        type: 'REAL_TRADES_ENABLED',
        message: 'Real trades are enabled - this is dangerous!',
        severity: 'critical'
      });
    }

    // Check for weak JWT secret
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.length < 32) {
      warnings.push({
        type: 'WEAK_JWT_SECRET',
        message: 'JWT secret is missing or too short',
        severity: nodeEnv === 'production' ? 'high' : 'medium'
      });
    }

    return warnings;
  }

  /**
   * Generate environment report
   */
  public generateEnvironmentReport(): {
    status: EnvironmentStatus;
    warnings: Array<{
      type: string;
      message: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
    }>;
    recommendations: string[];
    isSafe: boolean;
  } {
    const status = this.getEnvironmentStatus();
    const warnings = this.getEnvironmentWarnings();
    const isSafe = this.isSafeForPaperTrading();

    const recommendations: string[] = [];

    if (!status.isPaperTradingMode) {
      recommendations.push('Enable paper trading mode by setting PAPER_TRADING_MODE=true');
    }

    if (status.allowRealTrades) {
      recommendations.push('Disable real trades by setting ALLOW_REAL_TRADES=false');
    }

    if (status.isProduction && status.configuredExchanges.length === 0) {
      recommendations.push('Configure exchange API keys for production deployment');
    }

    if (warnings.some(w => w.type === 'WEAK_JWT_SECRET')) {
      recommendations.push('Set a strong JWT secret (minimum 32 characters)');
    }

    return {
      status,
      warnings,
      recommendations,
      isSafe
    };
  }
}

// Export singleton instance
export const environmentValidator = EnvironmentValidator.getInstance();