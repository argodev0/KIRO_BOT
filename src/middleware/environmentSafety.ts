/**
 * Environment Safety Middleware
 * Blocks unsafe configurations and validates environment safety on each request
 */

import { Request, Response, NextFunction } from 'express';
import { environmentValidator, EnvironmentValidationError } from '../utils/EnvironmentValidator';
import { logger } from '../utils/logger';

export interface EnvironmentSafetyConfig {
  enforceOnEveryRequest: boolean;
  blockUnsafeConfigurations: boolean;
  minimumSafetyScore: number;
  logViolations: boolean;
}

export class EnvironmentSafetyMiddleware {
  private static instance: EnvironmentSafetyMiddleware;
  private config: EnvironmentSafetyConfig;
  private lastValidationTime: number = 0;
  private validationCacheMs: number = 30000; // 30 seconds cache

  private constructor() {
    this.config = {
      enforceOnEveryRequest: false, // Performance optimization
      blockUnsafeConfigurations: true,
      minimumSafetyScore: 90,
      logViolations: true
    };
  }

  public static getInstance(): EnvironmentSafetyMiddleware {
    if (!EnvironmentSafetyMiddleware.instance) {
      EnvironmentSafetyMiddleware.instance = new EnvironmentSafetyMiddleware();
    }
    return EnvironmentSafetyMiddleware.instance;
  }

  /**
   * Middleware to validate environment safety
   */
  public validateEnvironmentSafety() {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        // Check if we need to validate (cache for performance)
        const now = Date.now();
        const shouldValidate = this.config.enforceOnEveryRequest || 
                              (now - this.lastValidationTime) > this.validationCacheMs;

        if (shouldValidate) {
          this.performEnvironmentValidation(req);
          this.lastValidationTime = now;
        }

        next();
      } catch (error) {
        this.handleEnvironmentSafetyError(error as Error, req, res);
      }
    };
  }

  /**
   * Middleware specifically for trading endpoints
   */
  public validateTradingEnvironmentSafety() {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        // Always validate for trading endpoints
        this.performEnvironmentValidation(req);
        
        // Additional trading-specific validations
        this.validateTradingSpecificSafety(req);

        next();
      } catch (error) {
        this.handleEnvironmentSafetyError(error as Error, req, res);
      }
    };
  }

  /**
   * Perform comprehensive environment validation
   */
  private performEnvironmentValidation(req: Request): void {
    // Validate basic environment safety
    environmentValidator.validateEnvironment();

    // Check safety score
    const safetyScore = environmentValidator.calculateSafetyScore();
    if (safetyScore.totalScore < this.config.minimumSafetyScore) {
      throw new EnvironmentValidationError(
        `Environment safety score ${safetyScore.totalScore}% is below required ${this.config.minimumSafetyScore}%`,
        'SAFETY_SCORE_TOO_LOW',
        'critical'
      );
    }

    // Check for dangerous variables
    const dangerousVars = environmentValidator.detectDangerousVariables();
    if (dangerousVars.length > 0 && this.config.blockUnsafeConfigurations) {
      throw new EnvironmentValidationError(
        `Dangerous environment variables detected: ${dangerousVars.join(', ')}`,
        'DANGEROUS_VARIABLES_DETECTED',
        'critical'
      );
    }

    // Log validation success
    if (this.config.logViolations) {
      logger.debug('Environment safety validation passed', {
        path: req.path,
        method: req.method,
        safetyScore: safetyScore.totalScore,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
    }
  }

  /**
   * Validate trading-specific environment safety
   */
  private validateTradingSpecificSafety(req: Request): void {
    // Ensure TRADING_SIMULATION_ONLY is true
    if (process.env.TRADING_SIMULATION_ONLY !== 'true') {
      throw new EnvironmentValidationError(
        'CRITICAL: Trading operations require TRADING_SIMULATION_ONLY=true',
        'TRADING_SIMULATION_ONLY_REQUIRED',
        'critical'
      );
    }

    // Ensure paper trading mode is enabled
    if (process.env.PAPER_TRADING_MODE !== 'true') {
      throw new EnvironmentValidationError(
        'CRITICAL: Trading operations require PAPER_TRADING_MODE=true',
        'PAPER_TRADING_MODE_REQUIRED',
        'critical'
      );
    }

    // Ensure real trades are disabled
    if (process.env.ALLOW_REAL_TRADES === 'true') {
      throw new EnvironmentValidationError(
        'CRITICAL: Trading operations blocked - ALLOW_REAL_TRADES must be false',
        'REAL_TRADES_MUST_BE_DISABLED',
        'critical'
      );
    }

    // Log trading-specific validation
    if (this.config.logViolations) {
      logger.info('Trading environment safety validation passed', {
        path: req.path,
        method: req.method,
        tradingSimulationOnly: process.env.TRADING_SIMULATION_ONLY,
        paperTradingMode: process.env.PAPER_TRADING_MODE,
        allowRealTrades: process.env.ALLOW_REAL_TRADES,
        ip: req.ip
      });
    }
  }

  /**
   * Handle environment safety errors
   */
  private handleEnvironmentSafetyError(error: Error, req: Request, res: Response): void {
    if (error instanceof EnvironmentValidationError) {
      // Log the security violation
      if (this.config.logViolations) {
        logger.error('Environment safety violation detected', {
          error: error.message,
          code: error.code,
          severity: error.severity,
          path: req.path,
          method: req.method,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          timestamp: Date.now()
        });
      }

      // Return appropriate error response
      const statusCode = error.severity === 'critical' ? 403 : 400;
      
      res.status(statusCode).json({
        error: 'ENVIRONMENT_SAFETY_VIOLATION',
        code: error.code,
        message: error.message,
        severity: error.severity,
        safetyMode: 'PAPER_TRADING_ONLY',
        timestamp: Date.now(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } else {
      // Handle unexpected errors
      logger.error('Unexpected error in environment safety middleware:', error);
      
      res.status(500).json({
        error: 'ENVIRONMENT_SAFETY_ERROR',
        message: 'An unexpected error occurred during environment safety validation',
        safetyMode: 'PAPER_TRADING_ONLY',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): EnvironmentSafetyConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<EnvironmentSafetyConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    logger.info('Environment safety middleware configuration updated', {
      config: this.config
    });
  }

  /**
   * Force immediate validation (bypass cache)
   */
  public forceValidation(): void {
    this.lastValidationTime = 0;
  }

  /**
   * Get validation status
   */
  public getValidationStatus(): {
    lastValidationTime: number;
    cacheExpiresAt: number;
    isValidationCached: boolean;
  } {
    const now = Date.now();
    const cacheExpiresAt = this.lastValidationTime + this.validationCacheMs;
    
    return {
      lastValidationTime: this.lastValidationTime,
      cacheExpiresAt,
      isValidationCached: now < cacheExpiresAt
    };
  }
}

// Export middleware functions
export const environmentSafetyMiddleware = EnvironmentSafetyMiddleware.getInstance().validateEnvironmentSafety();
export const tradingEnvironmentSafetyMiddleware = EnvironmentSafetyMiddleware.getInstance().validateTradingEnvironmentSafety();

// Export class for advanced usage
export { EnvironmentSafetyMiddleware };