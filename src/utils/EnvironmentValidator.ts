/**
 * Environment Validator
 * Validates environment configuration for paper trading safety
 * Implements comprehensive safety score calculation and dangerous variable detection
 */

import { logger } from './logger';

export interface EnvironmentStatus {
  isPaperTradingMode: boolean;
  allowRealTrades: boolean;
  tradingSimulationOnly: boolean;
  environment: string;
  isProduction: boolean;
  configuredExchanges: string[];
  securityLevel: 'low' | 'medium' | 'high' | 'critical';
  safetyScore: number;
  dangerousVariables: string[];
  validationTimestamp: number;
}

export interface SafetyScoreBreakdown {
  totalScore: number;
  maxScore: number;
  components: {
    tradingSimulationOnly: { score: number; maxScore: number; passed: boolean };
    paperTradingMode: { score: number; maxScore: number; passed: boolean };
    realTradesDisabled: { score: number; maxScore: number; passed: boolean };
    dangerousVariables: { score: number; maxScore: number; passed: boolean };
    apiKeyRestrictions: { score: number; maxScore: number; passed: boolean };
    productionSafety: { score: number; maxScore: number; passed: boolean };
  };
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
  private readonly MINIMUM_SAFETY_SCORE = 90;
  private readonly DANGEROUS_VARIABLES = [
    'BINANCE_API_SECRET',
    'KUCOIN_API_SECRET',
    'COINBASE_API_SECRET',
    'ENABLE_REAL_TRADING',
    'PRODUCTION_TRADING',
    'ALLOW_WITHDRAWALS',
    'ENABLE_WITHDRAWALS',
    'REAL_MONEY_MODE',
    'LIVE_TRADING_MODE'
  ];

  private constructor() {
    logger.info('Environment Validator initialized', {
      nodeEnv: process.env.NODE_ENV,
      paperTradingMode: process.env.PAPER_TRADING_MODE,
      tradingSimulationOnly: process.env.TRADING_SIMULATION_ONLY,
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
    const safetyScore = this.calculateSafetyScore();
    
    // Critical validation: Safety score must exceed 90%
    if (safetyScore.totalScore < this.MINIMUM_SAFETY_SCORE) {
      throw new EnvironmentValidationError(
        `CRITICAL: Environment safety score ${safetyScore.totalScore}% is below required ${this.MINIMUM_SAFETY_SCORE}%`,
        'SAFETY_SCORE_TOO_LOW',
        'critical'
      );
    }

    // Critical validation: TRADING_SIMULATION_ONLY must be true
    if (process.env.TRADING_SIMULATION_ONLY !== 'true') {
      throw new EnvironmentValidationError(
        'CRITICAL: Environment safety check FAILED: TRADING_SIMULATION_ONLY must be true',
        'TRADING_SIMULATION_ONLY_REQUIRED',
        'critical'
      );
    }

    // Critical validation: Paper trading must be enabled
    if (process.env.PAPER_TRADING_MODE !== 'true') {
      throw new EnvironmentValidationError(
        'CRITICAL: Paper trading mode must be enabled (PAPER_TRADING_MODE=true)',
        'PAPER_TRADING_DISABLED',
        'critical'
      );
    }

    // Critical validation: Real trades must be disabled
    if (process.env.ALLOW_REAL_TRADES === 'true') {
      throw new EnvironmentValidationError(
        'CRITICAL: Real trades must be disabled (ALLOW_REAL_TRADES=false)',
        'REAL_TRADES_ENABLED',
        'critical'
      );
    }

    // Validate dangerous environment variables
    const dangerousVars = this.detectDangerousVariables();
    if (dangerousVars.length > 0) {
      throw new EnvironmentValidationError(
        `CRITICAL: Dangerous environment variables detected: ${dangerousVars.join(', ')}`,
        'DANGEROUS_VARIABLES_DETECTED',
        'critical'
      );
    }

    // Production-specific validations
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === 'production') {
      this.validateProductionEnvironment();
    }

    logger.info('Environment validation successful', {
      nodeEnv,
      safetyScore: safetyScore.totalScore,
      tradingSimulationOnly: process.env.TRADING_SIMULATION_ONLY === 'true',
      paperTradingMode: process.env.PAPER_TRADING_MODE === 'true',
      allowRealTrades: process.env.ALLOW_REAL_TRADES === 'true'
    });
  }

  /**
   * Calculate comprehensive safety score (must exceed 90%)
   */
  public calculateSafetyScore(): SafetyScoreBreakdown {
    const components = {
      tradingSimulationOnly: {
        score: process.env.TRADING_SIMULATION_ONLY === 'true' ? 25 : 0,
        maxScore: 25,
        passed: process.env.TRADING_SIMULATION_ONLY === 'true'
      },
      paperTradingMode: {
        score: process.env.PAPER_TRADING_MODE === 'true' ? 20 : 0,
        maxScore: 20,
        passed: process.env.PAPER_TRADING_MODE === 'true'
      },
      realTradesDisabled: {
        score: process.env.ALLOW_REAL_TRADES !== 'true' ? 20 : 0,
        maxScore: 20,
        passed: process.env.ALLOW_REAL_TRADES !== 'true'
      },
      dangerousVariables: {
        score: this.detectDangerousVariables().length === 0 ? 15 : 0,
        maxScore: 15,
        passed: this.detectDangerousVariables().length === 0
      },
      apiKeyRestrictions: {
        score: this.validateApiKeyRestrictions() ? 10 : 0,
        maxScore: 10,
        passed: this.validateApiKeyRestrictions()
      },
      productionSafety: {
        score: this.validateProductionSafetySettings() ? 10 : 0,
        maxScore: 10,
        passed: this.validateProductionSafetySettings()
      }
    };

    const totalScore = Object.values(components).reduce((sum, component) => sum + component.score, 0);
    const maxScore = Object.values(components).reduce((sum, component) => sum + component.maxScore, 0);

    return {
      totalScore,
      maxScore,
      components
    };
  }

  /**
   * Detect dangerous environment variables
   */
  public detectDangerousVariables(): string[] {
    const dangerousVars: string[] = [];
    
    for (const varName of this.DANGEROUS_VARIABLES) {
      if (process.env[varName] && process.env[varName] !== '' && !process.env[varName]?.startsWith('your-')) {
        dangerousVars.push(varName);
      }
    }

    return dangerousVars;
  }

  /**
   * Validate API key restrictions
   */
  private validateApiKeyRestrictions(): boolean {
    // Check if API keys are configured as read-only
    const binanceReadOnly = process.env.BINANCE_READ_ONLY === 'true';
    const kucoinReadOnly = process.env.KUCOIN_READ_ONLY === 'true';
    
    // If API keys are configured, they must be read-only
    const hasBinanceKeys = process.env.BINANCE_API_KEY && process.env.BINANCE_API_KEY !== '';
    const hasKucoinKeys = process.env.KUCOIN_API_KEY && process.env.KUCOIN_API_KEY !== '';
    
    if (hasBinanceKeys && !binanceReadOnly) return false;
    if (hasKucoinKeys && !kucoinReadOnly) return false;
    
    return true;
  }

  /**
   * Validate production safety settings
   */
  private validateProductionSafetySettings(): boolean {
    const nodeEnv = process.env.NODE_ENV || 'development';
    
    if (nodeEnv === 'production') {
      // Production must have additional safety settings
      const forcePaperTrading = process.env.FORCE_PAPER_TRADING === 'true';
      const paperTradingValidation = process.env.PAPER_TRADING_VALIDATION === 'strict';
      
      return forcePaperTrading && paperTradingValidation;
    }
    
    return true; // Non-production environments pass this check
  }

  /**
   * Validate production environment specific requirements
   */
  private validateProductionEnvironment(): void {
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new EnvironmentValidationError(
        'Production environment requires secure JWT secret (min 32 characters)',
        'INSECURE_JWT_SECRET',
        'high'
      );
    }

    // Ensure production has proper paper trading configuration
    if (process.env.PAPER_TRADING_MODE !== 'true' || process.env.ALLOW_REAL_TRADES === 'true') {
      throw new EnvironmentValidationError(
        'Production environment must have paper trading enabled and real trades disabled',
        'PRODUCTION_UNSAFE_CONFIG',
        'critical'
      );
    }

    // Validate production-specific safety settings
    if (process.env.FORCE_PAPER_TRADING !== 'true') {
      throw new EnvironmentValidationError(
        'Production environment must have FORCE_PAPER_TRADING=true',
        'PRODUCTION_FORCE_PAPER_TRADING_REQUIRED',
        'critical'
      );
    }
  }

  /**
   * Get comprehensive environment status
   */
  public getEnvironmentStatus(): EnvironmentStatus {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const paperTradingMode = process.env.PAPER_TRADING_MODE === 'true';
    const tradingSimulationOnly = process.env.TRADING_SIMULATION_ONLY === 'true';
    const allowRealTrades = process.env.ALLOW_REAL_TRADES === 'true';
    const isProduction = nodeEnv === 'production';
    const safetyScore = this.calculateSafetyScore().totalScore;
    const dangerousVariables = this.detectDangerousVariables();

    // Determine configured exchanges
    const configuredExchanges: string[] = [];
    if (process.env.BINANCE_API_KEY) configuredExchanges.push('binance');
    if (process.env.KUCOIN_API_KEY) configuredExchanges.push('kucoin');
    if (process.env.COINBASE_API_KEY) configuredExchanges.push('coinbase');

    // Calculate security level based on safety score
    let securityLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    if (safetyScore < 70 || dangerousVariables.length > 0) {
      securityLevel = 'critical';
    } else if (safetyScore < 90) {
      securityLevel = 'high';
    } else if (isProduction && configuredExchanges.length > 0) {
      securityLevel = 'medium';
    } else {
      securityLevel = 'low';
    }

    return {
      isPaperTradingMode: paperTradingMode,
      tradingSimulationOnly,
      allowRealTrades,
      environment: nodeEnv,
      isProduction,
      configuredExchanges,
      securityLevel,
      safetyScore,
      dangerousVariables,
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
      const safetyScore = this.calculateSafetyScore();
      return safetyScore.totalScore >= this.MINIMUM_SAFETY_SCORE;
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
    const safetyScore = this.calculateSafetyScore();
    const dangerousVars = this.detectDangerousVariables();

    // Check safety score
    if (safetyScore.totalScore < this.MINIMUM_SAFETY_SCORE) {
      warnings.push({
        type: 'SAFETY_SCORE_TOO_LOW',
        message: `Environment safety score ${safetyScore.totalScore}% is below required ${this.MINIMUM_SAFETY_SCORE}%`,
        severity: 'critical'
      });
    }

    // Check for TRADING_SIMULATION_ONLY
    if (process.env.TRADING_SIMULATION_ONLY !== 'true') {
      warnings.push({
        type: 'TRADING_SIMULATION_ONLY_MISSING',
        message: 'TRADING_SIMULATION_ONLY must be set to true',
        severity: 'critical'
      });
    }

    // Check for missing paper trading configuration
    if (process.env.PAPER_TRADING_MODE !== 'true') {
      warnings.push({
        type: 'PAPER_TRADING_NOT_ENABLED',
        message: 'Paper trading mode is not explicitly enabled',
        severity: 'critical'
      });
    }

    // Check for real trades enabled
    if (process.env.ALLOW_REAL_TRADES === 'true') {
      warnings.push({
        type: 'REAL_TRADES_ENABLED',
        message: 'Real trades are enabled - this is dangerous!',
        severity: 'critical'
      });
    }

    // Check for dangerous variables
    for (const dangerousVar of dangerousVars) {
      warnings.push({
        type: 'DANGEROUS_VARIABLE_DETECTED',
        message: `Dangerous environment variable detected: ${dangerousVar}`,
        severity: 'critical'
      });
    }

    // Check for development environment in production
    if (nodeEnv === 'development' && process.env.PORT === '80') {
      warnings.push({
        type: 'DEVELOPMENT_IN_PRODUCTION',
        message: 'Development environment detected on production port',
        severity: 'medium'
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

    // Check API key restrictions
    if (!this.validateApiKeyRestrictions()) {
      warnings.push({
        type: 'API_KEYS_NOT_READ_ONLY',
        message: 'API keys are not configured as read-only',
        severity: 'critical'
      });
    }

    return warnings;
  }

  /**
   * Generate environment report
   */
  public generateEnvironmentReport(): {
    status: EnvironmentStatus;
    safetyScore: SafetyScoreBreakdown;
    warnings: Array<{
      type: string;
      message: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
    }>;
    recommendations: string[];
    isSafe: boolean;
  } {
    const status = this.getEnvironmentStatus();
    const safetyScore = this.calculateSafetyScore();
    const warnings = this.getEnvironmentWarnings();
    const isSafe = this.isSafeForPaperTrading();

    const recommendations: string[] = [];

    if (!status.tradingSimulationOnly) {
      recommendations.push('Set TRADING_SIMULATION_ONLY=true for maximum safety');
    }

    if (!status.isPaperTradingMode) {
      recommendations.push('Enable paper trading mode by setting PAPER_TRADING_MODE=true');
    }

    if (status.allowRealTrades) {
      recommendations.push('Disable real trades by setting ALLOW_REAL_TRADES=false');
    }

    if (status.dangerousVariables.length > 0) {
      recommendations.push(`Remove dangerous environment variables: ${status.dangerousVariables.join(', ')}`);
    }

    if (safetyScore.totalScore < this.MINIMUM_SAFETY_SCORE) {
      recommendations.push(`Improve safety score from ${safetyScore.totalScore}% to at least ${this.MINIMUM_SAFETY_SCORE}%`);
    }

    if (status.isProduction && status.configuredExchanges.length === 0) {
      recommendations.push('Configure exchange API keys for production deployment');
    }

    if (warnings.some(w => w.type === 'WEAK_JWT_SECRET')) {
      recommendations.push('Set a strong JWT secret (minimum 32 characters)');
    }

    if (!this.validateApiKeyRestrictions()) {
      recommendations.push('Configure API keys as read-only (set BINANCE_READ_ONLY=true, KUCOIN_READ_ONLY=true)');
    }

    return {
      status,
      safetyScore,
      warnings,
      recommendations,
      isSafe
    };
  }
}

/**
 * Validate environment on startup
 */
export const validateEnvironmentOnStartup = (): void => {
  const validator = EnvironmentValidator.getInstance();
  
  try {
    validator.validateEnvironment();
    const report = validator.generateEnvironmentReport();
    
    logger.info('Environment validation completed successfully', {
      safetyScore: report.safetyScore.totalScore,
      isSafe: report.isSafe,
      warningCount: report.warnings.length,
      recommendationCount: report.recommendations.length
    });

    // Log warnings if any
    if (report.warnings.length > 0) {
      logger.warn('Environment validation warnings detected', {
        warnings: report.warnings
      });
    }

    // Log recommendations if any
    if (report.recommendations.length > 0) {
      logger.info('Environment recommendations', {
        recommendations: report.recommendations
      });
    }

  } catch (error) {
    logger.error('Environment validation failed on startup', error);
    throw error;
  }
};

// Export singleton instance
export const environmentValidator = EnvironmentValidator.getInstance();