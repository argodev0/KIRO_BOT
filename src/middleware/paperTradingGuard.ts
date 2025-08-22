/**
 * Paper Trading Guard Middleware
 * Ensures all trading operations are intercepted and converted to paper trades
 * Provides multiple layers of protection against real money operations
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface PaperTradingConfig {
  enabled: boolean;
  allowRealTrades: boolean;
  initialVirtualBalance: number;
  maxVirtualLeverage: number;
  virtualTradingFee: number;
  slippageSimulation: boolean;
}

export interface SecurityValidation {
  isValid: boolean;
  violations: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export class PaperTradingError extends Error {
  public readonly code: string;
  public readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';

  constructor(message: string, code: string, riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'critical') {
    super(message);
    this.name = 'PaperTradingError';
    this.code = code;
    this.riskLevel = riskLevel;
  }
}

// Error codes for different paper trading violations
export const PAPER_TRADING_ERRORS = {
  REAL_TRADE_ATTEMPTED: 'CRITICAL: Real trading attempted while in paper mode',
  API_PERMISSIONS_INVALID: 'DANGER: API key has trading permissions',
  PAPER_MODE_DISABLED: 'CRITICAL: Paper trading mode must be enabled',
  VIRTUAL_BALANCE_INSUFFICIENT: 'Insufficient virtual balance for trade',
  WITHDRAWAL_BLOCKED: 'CRITICAL: Withdrawal operations are blocked in paper mode',
  TRANSFER_BLOCKED: 'CRITICAL: Transfer operations are blocked in paper mode',
  REAL_MONEY_OPERATION: 'CRITICAL: Real money operation detected and blocked'
} as const;

export class PaperTradingGuard {
  private static instance: PaperTradingGuard;
  private paperTradingConfig: PaperTradingConfig;
  private securityAuditLog: Array<{
    timestamp: number;
    event: string;
    details: any;
    riskLevel: string;
  }> = [];

  private constructor() {
    this.paperTradingConfig = {
      enabled: true, // Always enabled for safety
      allowRealTrades: false, // Never allow real trades
      initialVirtualBalance: 10000, // $10,000 virtual balance
      maxVirtualLeverage: 3,
      virtualTradingFee: 0.001, // 0.1% fee
      slippageSimulation: true
    };

    this.validatePaperTradingMode();
  }

  public static getInstance(): PaperTradingGuard {
    if (!PaperTradingGuard.instance) {
      PaperTradingGuard.instance = new PaperTradingGuard();
    }
    return PaperTradingGuard.instance;
  }

  /**
   * Middleware to intercept all trading operations
   */
  public interceptTradingOperations() {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        // Validate paper trading mode is active
        this.validatePaperTradingMode();

        // Block real money operations first (before checking if it's a trading endpoint)
        this.blockRealMoneyOperations(req);

        // Check if this is a trading-related endpoint
        if (this.isTradingEndpoint(req.path)) {
          this.logSecurityEvent('trading_operation_intercepted', {
            path: req.path,
            method: req.method,
            body: req.body,
            userAgent: req.get('User-Agent'),
            ip: req.ip
          }, 'medium');

          // Convert to paper trade
          this.convertToPaperTrade(req);
        }

        next();
      } catch (error) {
        this.handlePaperTradingError(error as Error, res);
      }
    };
  }

  /**
   * Validate that paper trading mode is properly configured
   */
  public validatePaperTradingMode(): void {
    // Check environment variables
    const nodeEnv = process.env.NODE_ENV;
    const allowReal = process.env.ALLOW_REAL_TRADES;

    // Critical validation: paper trading must be enabled
    if (!this.paperTradingConfig.enabled) {
      throw new PaperTradingError(
        PAPER_TRADING_ERRORS.PAPER_MODE_DISABLED,
        'PAPER_MODE_DISABLED',
        'critical'
      );
    }

    // Critical validation: real trades must be disabled
    if (this.paperTradingConfig.allowRealTrades || allowReal === 'true') {
      throw new PaperTradingError(
        PAPER_TRADING_ERRORS.REAL_TRADE_ATTEMPTED,
        'REAL_TRADES_ENABLED',
        'critical'
      );
    }

    // Log successful validation
    this.logSecurityEvent('paper_trading_validation_success', {
      paperModeEnabled: this.paperTradingConfig.enabled,
      realTradesAllowed: this.paperTradingConfig.allowRealTrades,
      environment: nodeEnv
    }, 'low');

    logger.info('Paper trading mode validation successful', {
      paperMode: this.paperTradingConfig.enabled,
      realTrades: this.paperTradingConfig.allowRealTrades
    });
  }

  /**
   * Validate API key permissions to ensure they are read-only
   */
  public validateApiPermissions(apiKey: string, exchange: string): SecurityValidation {
    const violations: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Check if API key is empty (safer)
    if (!apiKey || apiKey.trim() === '') {
      return {
        isValid: true,
        violations: [],
        riskLevel: 'low'
      };
    }

    // For production paper trading, we should only use read-only keys
    // This is a placeholder - in real implementation, you'd check with exchange APIs
    const suspiciousPatterns = [
      'trade', 'withdraw', 'transfer', 'futures', 'margin'
    ];

    // Check for suspicious permissions in key metadata (if available)
    const keyLower = apiKey.toLowerCase();
    for (const pattern of suspiciousPatterns) {
      if (keyLower.includes(pattern)) {
        violations.push(`API key may have ${pattern} permissions`);
        riskLevel = 'critical';
      }
    }

    // Log API key validation attempt
    this.logSecurityEvent('api_key_validation', {
      exchange,
      hasViolations: violations.length > 0,
      violationCount: violations.length,
      riskLevel
    }, riskLevel);

    if (violations.length > 0) {
      throw new PaperTradingError(
        `${PAPER_TRADING_ERRORS.API_PERMISSIONS_INVALID}: ${violations.join(', ')}`,
        'API_PERMISSIONS_INVALID',
        'critical'
      );
    }

    return {
      isValid: violations.length === 0,
      violations,
      riskLevel
    };
  }

  /**
   * Block all real money operations
   */
  public blockRealMoneyOperations(req: Request): never | void {
    const dangerousOperations = [
      'withdraw',
      'transfer',
      'deposit',
      'futures',
      'margin',
      'lending',
      'staking'
    ];

    const path = req.path.toLowerCase();
    const body = JSON.stringify(req.body || {}).toLowerCase();

    for (const operation of dangerousOperations) {
      if (path.includes(operation) || body.includes(operation)) {
        this.logSecurityEvent('real_money_operation_blocked', {
          operation,
          path: req.path,
          method: req.method,
          body: req.body,
          ip: req.ip
        }, 'critical');

        throw new PaperTradingError(
          `${PAPER_TRADING_ERRORS.REAL_MONEY_OPERATION}: ${operation} operation blocked`,
          'REAL_MONEY_OPERATION',
          'critical'
        );
      }
    }
  }

  /**
   * Convert trading request to paper trade
   */
  public convertToPaperTrade(req: Request): void {
    // Mark request as paper trade
    (req as any).isPaperTrade = true;
    (req as any).paperTradingMode = true;

    // Add paper trading headers
    if (req.body) {
      req.body.isPaperTrade = true;
      req.body.paperTradingMode = true;
      req.body.virtualTrade = true;
    }

    this.logSecurityEvent('trade_converted_to_paper', {
      originalPath: req.path,
      method: req.method,
      convertedAt: Date.now()
    }, 'low');

    logger.info('Trading operation converted to paper trade', {
      path: req.path,
      method: req.method
    });
  }

  /**
   * Check if endpoint is trading-related
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
   * Handle paper trading errors
   */
  private handlePaperTradingError(error: Error, res: Response): void {
    if (error instanceof PaperTradingError) {
      this.logSecurityEvent('paper_trading_error', {
        code: error.code,
        message: error.message,
        riskLevel: error.riskLevel,
        stack: error.stack
      }, error.riskLevel);

      // For critical errors, return 403 Forbidden
      const statusCode = error.riskLevel === 'critical' ? 403 : 400;

      res.status(statusCode).json({
        error: error.code,
        message: error.message,
        riskLevel: error.riskLevel,
        paperTradingMode: true,
        timestamp: Date.now()
      });
    } else {
      // Handle other errors
      logger.error('Unexpected error in paper trading guard:', error);
      res.status(500).json({
        error: 'PAPER_TRADING_GUARD_ERROR',
        message: 'An unexpected error occurred in paper trading protection',
        paperTradingMode: true,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Log security events for audit trail
   */
  private logSecurityEvent(
    event: string, 
    details: any, 
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  ): void {
    const logEntry = {
      timestamp: Date.now(),
      event,
      details,
      riskLevel
    };

    this.securityAuditLog.push(logEntry);

    // Keep only last 1000 entries
    if (this.securityAuditLog.length > 1000) {
      this.securityAuditLog = this.securityAuditLog.slice(-1000);
    }

    // Log to application logger based on risk level
    const logLevel = riskLevel === 'critical' ? 'error' : 
                    riskLevel === 'high' ? 'warn' : 'info';

    logger[logLevel](`Paper Trading Security Event: ${event}`, {
      event,
      details,
      riskLevel,
      timestamp: logEntry.timestamp
    });
  }

  /**
   * Get security audit log
   */
  public getSecurityAuditLog(limit: number = 100): typeof this.securityAuditLog {
    return this.securityAuditLog.slice(-limit);
  }

  /**
   * Get paper trading configuration
   */
  public getConfig(): PaperTradingConfig {
    return { ...this.paperTradingConfig };
  }

  /**
   * Force paper trading mode (cannot be disabled)
   */
  public forcePaperTradingMode(): void {
    this.paperTradingConfig.enabled = true;
    this.paperTradingConfig.allowRealTrades = false;

    this.logSecurityEvent('paper_trading_forced', {
      forcedAt: Date.now(),
      reason: 'Security enforcement'
    }, 'medium');

    logger.warn('Paper trading mode has been forced for security');
  }
}

// Export middleware function
export const paperTradingGuard = PaperTradingGuard.getInstance().interceptTradingOperations();

// Export validation functions
export const validatePaperTradingMode = (): void => {
  PaperTradingGuard.getInstance().validatePaperTradingMode();
};

export const validateApiPermissions = (apiKey: string, exchange: string): SecurityValidation => {
  return PaperTradingGuard.getInstance().validateApiPermissions(apiKey, exchange);
};