/**
 * Safety Score Enforcement Middleware
 * Enforces 90%+ paper trading safety score requirement
 * Blocks system operation if safety score is insufficient
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { paperTradingSafetyScoreValidator } from '../services/PaperTradingSafetyScoreValidator';

export interface SafetyScoreEnforcementConfig {
  enforceOnStartup: boolean;
  enforceOnTradingEndpoints: boolean;
  enforceOnCriticalEndpoints: boolean;
  minimumScore: number;
  blockSystemOnFailure: boolean;
  logViolations: boolean;
}

export class SafetyScoreEnforcementError extends Error {
  public readonly code: string;
  public readonly safetyScore: number;
  public readonly minimumRequired: number;

  constructor(message: string, code: string, safetyScore: number, minimumRequired: number) {
    super(message);
    this.name = 'SafetyScoreEnforcementError';
    this.code = code;
    this.safetyScore = safetyScore;
    this.minimumRequired = minimumRequired;
  }
}

export class SafetyScoreEnforcementMiddleware {
  private static instance: SafetyScoreEnforcementMiddleware;
  private config: SafetyScoreEnforcementConfig;
  private lastValidationTime: number = 0;
  private lastSafetyScore: number = 0;
  private validationCacheMs: number = 60000; // 1 minute cache
  private systemBlocked: boolean = false;
  private blockReason: string = '';

  private constructor() {
    this.config = {
      enforceOnStartup: true,
      enforceOnTradingEndpoints: true,
      enforceOnCriticalEndpoints: true,
      minimumScore: 90,
      blockSystemOnFailure: true,
      logViolations: true
    };
  }

  public static getInstance(): SafetyScoreEnforcementMiddleware {
    if (!SafetyScoreEnforcementMiddleware.instance) {
      SafetyScoreEnforcementMiddleware.instance = new SafetyScoreEnforcementMiddleware();
    }
    return SafetyScoreEnforcementMiddleware.instance;
  }

  /**
   * Validate safety score on system startup
   */
  public async validateOnStartup(): Promise<void> {
    if (!this.config.enforceOnStartup) {
      logger.info('Safety score enforcement on startup is disabled');
      return;
    }

    logger.info('Validating paper trading safety score on startup...');

    try {
      await this.performSafetyScoreValidation();
      logger.info('Startup safety score validation passed');
    } catch (error) {
      const errorMessage = `CRITICAL: System startup blocked due to insufficient paper trading safety score`;
      logger.error(errorMessage, error);
      
      if (this.config.blockSystemOnFailure) {
        this.systemBlocked = true;
        this.blockReason = error instanceof Error ? error.message : 'Unknown safety score validation error';
        throw new SafetyScoreEnforcementError(
          errorMessage,
          'STARTUP_SAFETY_SCORE_INSUFFICIENT',
          this.lastSafetyScore,
          this.config.minimumScore
        );
      }
    }
  }

  /**
   * Middleware for all requests
   */
  public enforceGlobalSafetyScore() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Check if system is blocked
        if (this.systemBlocked) {
          this.handleSystemBlocked(req, res);
          return;
        }

        // Skip validation for health checks and non-critical endpoints
        if (this.isHealthCheckEndpoint(req.path) || this.isStaticAsset(req.path)) {
          next();
          return;
        }

        // Validate safety score for critical operations
        if (this.isCriticalEndpoint(req.path) && this.config.enforceOnCriticalEndpoints) {
          await this.validateSafetyScoreForRequest(req);
        }

        next();
      } catch (error) {
        this.handleSafetyScoreError(error as Error, req, res);
      }
    };
  }

  /**
   * Middleware specifically for trading endpoints
   */
  public enforceTradingSafetyScore() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Always validate for trading endpoints
        await this.validateSafetyScoreForRequest(req);
        next();
      } catch (error) {
        this.handleSafetyScoreError(error as Error, req, res);
      }
    };
  }

  /**
   * Perform safety score validation
   */
  private async performSafetyScoreValidation(): Promise<void> {
    const now = Date.now();
    
    // Use cached result if available and not expired
    if ((now - this.lastValidationTime) < this.validationCacheMs && this.lastSafetyScore > 0) {
      if (this.lastSafetyScore < this.config.minimumScore) {
        throw new SafetyScoreEnforcementError(
          `Cached safety score ${this.lastSafetyScore}% is below required ${this.config.minimumScore}%`,
          'CACHED_SAFETY_SCORE_INSUFFICIENT',
          this.lastSafetyScore,
          this.config.minimumScore
        );
      }
      return;
    }

    // Perform fresh validation
    const report = await paperTradingSafetyScoreValidator.getSafetyScoreReport();
    
    this.lastValidationTime = now;
    this.lastSafetyScore = report.percentage;

    if (!report.passed) {
      const criticalViolations = report.violations.filter(v => v.severity === 'critical');
      const errorMessage = `Paper trading safety score ${report.percentage}% is below required ${this.config.minimumScore}%. Critical violations: ${criticalViolations.length}`;
      
      if (this.config.logViolations) {
        logger.error('Safety score validation failed', {
          score: report.percentage,
          required: this.config.minimumScore,
          violations: report.violations.length,
          criticalViolations: criticalViolations.length,
          violations_detail: report.violations
        });
      }

      throw new SafetyScoreEnforcementError(
        errorMessage,
        'SAFETY_SCORE_INSUFFICIENT',
        report.percentage,
        this.config.minimumScore
      );
    }

    if (this.config.logViolations) {
      logger.info('Safety score validation passed', {
        score: report.percentage,
        required: this.config.minimumScore,
        violations: report.violations.length
      });
    }
  }

  /**
   * Validate safety score for a specific request
   */
  private async validateSafetyScoreForRequest(req: Request): Promise<void> {
    try {
      await this.performSafetyScoreValidation();
    } catch (error) {
      if (this.config.logViolations) {
        logger.error('Safety score validation failed for request', {
          path: req.path,
          method: req.method,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      throw error;
    }
  }

  /**
   * Check if endpoint is a trading endpoint
   */
  private isTradingEndpoint(path: string): boolean {
    const tradingPaths = [
      '/api/trading',
      '/api/orders',
      '/api/positions',
      '/api/signals/execute',
      '/trade',
      '/order',
      '/position'
    ];

    return tradingPaths.some(tradingPath => path.includes(tradingPath));
  }

  /**
   * Check if endpoint is critical
   */
  private isCriticalEndpoint(path: string): boolean {
    const criticalPaths = [
      '/api/trading',
      '/api/orders',
      '/api/positions',
      '/api/signals/execute',
      '/api/config',
      '/api/admin',
      '/trade',
      '/order',
      '/position',
      '/config',
      '/admin'
    ];

    return criticalPaths.some(criticalPath => path.includes(criticalPath));
  }

  /**
   * Check if endpoint is a health check
   */
  private isHealthCheckEndpoint(path: string): boolean {
    const healthPaths = [
      '/health',
      '/status',
      '/ping',
      '/ready',
      '/live'
    ];

    return healthPaths.some(healthPath => path.includes(healthPath));
  }

  /**
   * Check if request is for static assets
   */
  private isStaticAsset(path: string): boolean {
    const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf'];
    return staticExtensions.some(ext => path.endsWith(ext));
  }

  /**
   * Handle system blocked state
   */
  private handleSystemBlocked(req: Request, res: Response): void {
    const errorResponse = {
      error: 'SYSTEM_BLOCKED',
      message: 'System is blocked due to insufficient paper trading safety score',
      reason: this.blockReason,
      safetyScore: this.lastSafetyScore,
      minimumRequired: this.config.minimumScore,
      timestamp: Date.now(),
      path: req.path,
      method: req.method
    };

    if (this.config.logViolations) {
      logger.error('Request blocked due to system safety block', {
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        blockReason: this.blockReason
      });
    }

    res.status(503).json(errorResponse);
  }

  /**
   * Handle safety score errors
   */
  private handleSafetyScoreError(error: Error, req: Request, res: Response): void {
    if (error instanceof SafetyScoreEnforcementError) {
      const statusCode = 403; // Forbidden
      
      const errorResponse = {
        error: error.code,
        message: error.message,
        safetyScore: error.safetyScore,
        minimumRequired: error.minimumRequired,
        paperTradingMode: true,
        timestamp: Date.now(),
        path: req.path,
        method: req.method
      };

      if (this.config.logViolations) {
        logger.error('Request blocked due to insufficient safety score', {
          path: req.path,
          method: req.method,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          safetyScore: error.safetyScore,
          minimumRequired: error.minimumRequired,
          code: error.code
        });
      }

      res.status(statusCode).json(errorResponse);
    } else {
      // Handle unexpected errors
      logger.error('Unexpected error in safety score enforcement:', error);
      
      res.status(500).json({
        error: 'SAFETY_SCORE_ENFORCEMENT_ERROR',
        message: 'An unexpected error occurred during safety score validation',
        paperTradingMode: true,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get current safety score status
   */
  public async getSafetyScoreStatus(): Promise<{
    score: number;
    passed: boolean;
    minimumRequired: number;
    lastValidation: number;
    systemBlocked: boolean;
    blockReason: string;
  }> {
    try {
      const report = await paperTradingSafetyScoreValidator.getSafetyScoreReport();
      return {
        score: report.percentage,
        passed: report.passed,
        minimumRequired: this.config.minimumScore,
        lastValidation: this.lastValidationTime,
        systemBlocked: this.systemBlocked,
        blockReason: this.blockReason
      };
    } catch (error) {
      return {
        score: this.lastSafetyScore,
        passed: false,
        minimumRequired: this.config.minimumScore,
        lastValidation: this.lastValidationTime,
        systemBlocked: this.systemBlocked,
        blockReason: this.blockReason || (error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }

  /**
   * Force refresh safety score validation
   */
  public async refreshSafetyScore(): Promise<void> {
    this.lastValidationTime = 0; // Force refresh
    await this.performSafetyScoreValidation();
  }

  /**
   * Unblock system (for emergency use only)
   */
  public unblockSystem(reason: string): void {
    this.systemBlocked = false;
    this.blockReason = '';
    
    logger.warn('System unblocked manually', {
      reason,
      timestamp: Date.now()
    });
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<SafetyScoreEnforcementConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    logger.info('Safety score enforcement configuration updated', {
      config: this.config
    });
  }

  /**
   * Get current configuration
   */
  public getConfig(): SafetyScoreEnforcementConfig {
    return { ...this.config };
  }
}

// Export middleware functions
export const safetyScoreEnforcementMiddleware = SafetyScoreEnforcementMiddleware.getInstance().enforceGlobalSafetyScore();
export const tradingSafetyScoreEnforcementMiddleware = SafetyScoreEnforcementMiddleware.getInstance().enforceTradingSafetyScore();

// Class is already exported above, no need to re-export

// Export startup validation function
export const validateSafetyScoreOnStartup = async (): Promise<void> => {
  await SafetyScoreEnforcementMiddleware.getInstance().validateOnStartup();
};