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
  REAL_MONEY_OPERATION: 'CRITICAL: Real money operation detected and blocked',
  TRADING_SIMULATION_ONLY_REQUIRED: 'CRITICAL: TRADING_SIMULATION_ONLY environment variable must be true',
  PAPER_TRADING_MODE_REQUIRED: 'CRITICAL: PAPER_TRADING_MODE environment variable must be true',
  UNSAFE_OPERATION_BLOCKED: 'CRITICAL: Unsafe trading operation pattern detected and blocked',
  REAL_MONEY_INDICATOR_DETECTED: 'CRITICAL: Real money transaction indicator detected',
  VIRTUAL_TRADE_LIMIT_EXCEEDED: 'WARNING: Virtual trade amount exceeds safety limits',
  MISSING_PAPER_TRADE_MARKERS: 'WARNING: Trading operation missing required paper trade markers'
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

    // Don't validate immediately - let it be called when needed
    // This prevents issues during module loading and testing
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
          // Comprehensive logging for all paper trade attempts
          this.logPaperTradeAttempt(req);

          // Validate trade request and block real money transactions
          this.validateTradeRequest(req);

          // Throw error for any unsafe operations
          this.throwRealTradeErrorIfUnsafe(req);

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
    const tradingSimulationOnly = process.env.TRADING_SIMULATION_ONLY;
    const paperTradingMode = process.env.PAPER_TRADING_MODE;

    // CRITICAL: TRADING_SIMULATION_ONLY must be true
    if (tradingSimulationOnly !== 'true') {
      throw new PaperTradingError(
        'CRITICAL: TRADING_SIMULATION_ONLY must be set to true for safe operation',
        'TRADING_SIMULATION_ONLY_REQUIRED',
        'critical'
      );
    }

    // CRITICAL: PAPER_TRADING_MODE must be true
    if (paperTradingMode !== 'true') {
      throw new PaperTradingError(
        'CRITICAL: PAPER_TRADING_MODE must be set to true for safe operation',
        'PAPER_TRADING_MODE_REQUIRED',
        'critical'
      );
    }

    // Critical validation: paper trading must be enabled
    if (!this.paperTradingConfig.enabled) {
      throw new PaperTradingError(
        PAPER_TRADING_ERRORS.PAPER_MODE_DISABLED,
        'PAPER_MODE_DISABLED',
        'critical'
      );
    }

    // Critical validation: real trades must be disabled
    if (this.paperTradingConfig.allowRealTrades === true || allowReal === 'true') {
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
      tradingSimulationOnly,
      paperTradingMode,
      environment: nodeEnv
    }, 'low');

    logger.info('Paper trading mode validation successful', {
      paperMode: this.paperTradingConfig.enabled,
      realTrades: this.paperTradingConfig.allowRealTrades,
      tradingSimulationOnly,
      paperTradingMode
    });
  }

  /**
   * Validate API key permissions to ensure they are read-only
   * Now integrates with the comprehensive ApiPermissionValidator
   */
  public async validateApiPermissions(apiKey: string, exchange: string, apiSecret?: string, passphrase?: string): Promise<SecurityValidation> {
    try {
      // Import the API permission validator
      const { validateExchangeApiKey } = await import('./apiPermissionGuard');
      
      // Use the comprehensive validator
      const validation = await validateExchangeApiKey(
        exchange, 
        apiKey, 
        apiSecret, 
        passphrase,
        true // Always use sandbox mode for paper trading
      );

      // Convert to our SecurityValidation format
      const securityValidation: SecurityValidation = {
        isValid: validation.isValid && validation.isReadOnly,
        violations: validation.violations.map(v => v.message),
        riskLevel: validation.riskLevel
      };

      // Log API key validation attempt
      this.logSecurityEvent('api_key_validation_comprehensive', {
        exchange,
        isValid: securityValidation.isValid,
        isReadOnly: validation.isReadOnly,
        violationCount: securityValidation.violations.length,
        riskLevel: securityValidation.riskLevel,
        permissions: validation.permissions
      }, securityValidation.riskLevel);

      // Throw error if not read-only or has violations
      if (!validation.isReadOnly || !securityValidation.isValid) {
        throw new PaperTradingError(
          `${PAPER_TRADING_ERRORS.API_PERMISSIONS_INVALID}: ${securityValidation.violations.join(', ')}`,
          'API_PERMISSIONS_INVALID',
          'critical'
        );
      }

      return securityValidation;
    } catch (error) {
      // Fallback to basic validation if comprehensive validator fails
      logger.warn('Comprehensive API validation failed, using fallback validation', { error: error instanceof Error ? error.message : 'Unknown error' });
      
      return this.validateApiPermissionsBasic(apiKey, exchange);
    }
  }

  /**
   * Basic API key validation as fallback
   */
  private validateApiPermissionsBasic(apiKey: string, exchange: string): SecurityValidation {
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
    this.logSecurityEvent('api_key_validation_basic', {
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
   * Comprehensive logging for all paper trade attempts
   */
  public logPaperTradeAttempt(req: Request): void {
    const tradeData = {
      timestamp: Date.now(),
      path: req.path,
      method: req.method,
      body: req.body,
      query: req.query,
      headers: {
        userAgent: req.get('User-Agent'),
        contentType: req.get('Content-Type'),
        authorization: req.get('Authorization') ? '[REDACTED]' : undefined
      },
      ip: req.ip,
      sessionId: (req as any).sessionID || 'unknown',
      userId: (req as any).user?.id || 'anonymous'
    };

    this.logSecurityEvent('paper_trade_attempt_logged', tradeData, 'medium');

    logger.info('Paper trade attempt logged', {
      path: req.path,
      method: req.method,
      userId: tradeData.userId,
      ip: req.ip,
      timestamp: tradeData.timestamp
    });
  }

  /**
   * Validate trade request and block real money transactions
   */
  public validateTradeRequest(req: Request): void {
    const body = req.body || {};
    const query = req.query || {};
    const path = req.path.toLowerCase();

    // Check for real money transaction indicators
    const realMoneyIndicators = [
      'real_trade',
      'live_trade',
      'production_trade',
      'mainnet',
      'withdraw',
      'transfer',
      'deposit'
    ];

    // Check path for real money indicators
    for (const indicator of realMoneyIndicators) {
      if (path.includes(indicator)) {
        throw new PaperTradingError(
          `${PAPER_TRADING_ERRORS.REAL_MONEY_OPERATION}: Real money indicator '${indicator}' detected in path`,
          'REAL_MONEY_INDICATOR_IN_PATH',
          'critical'
        );
      }
    }

    // Check body for real money indicators
    const bodyStr = JSON.stringify(body).toLowerCase();
    for (const indicator of realMoneyIndicators) {
      if (bodyStr.includes(indicator)) {
        throw new PaperTradingError(
          `${PAPER_TRADING_ERRORS.REAL_MONEY_OPERATION}: Real money indicator '${indicator}' detected in request body`,
          'REAL_MONEY_INDICATOR_IN_BODY',
          'critical'
        );
      }
    }

    // Check query parameters for real money indicators
    const queryStr = JSON.stringify(query).toLowerCase();
    for (const indicator of realMoneyIndicators) {
      if (queryStr.includes(indicator)) {
        throw new PaperTradingError(
          `${PAPER_TRADING_ERRORS.REAL_MONEY_OPERATION}: Real money indicator '${indicator}' detected in query parameters`,
          'REAL_MONEY_INDICATOR_IN_QUERY',
          'critical'
        );
      }
    }

    // Validate that trade amount is within virtual limits
    if (body.amount && typeof body.amount === 'number') {
      const maxVirtualTradeAmount = 100000; // $100,000 max virtual trade
      if (body.amount > maxVirtualTradeAmount) {
        throw new PaperTradingError(
          `Trade amount ${body.amount} exceeds maximum virtual trade limit of ${maxVirtualTradeAmount}`,
          'VIRTUAL_TRADE_LIMIT_EXCEEDED',
          'high'
        );
      }
    }

    this.logSecurityEvent('trade_request_validated', {
      path: req.path,
      method: req.method,
      validationPassed: true,
      timestamp: Date.now()
    }, 'low');
  }

  /**
   * Throw error for any unsafe operations
   */
  public throwRealTradeErrorIfUnsafe(req: Request): void {
    // Check if any unsafe operation patterns are detected
    const unsafePatterns = [
      'execute_real_trade',
      'place_live_order',
      'withdraw_funds',
      'transfer_funds',
      'margin_trade',
      'futures_trade',
      'spot_trade_live'
    ];

    const requestContent = JSON.stringify({
      path: req.path,
      body: req.body,
      query: req.query
    }).toLowerCase();

    for (const pattern of unsafePatterns) {
      if (requestContent.includes(pattern)) {
        // Log the unsafe operation attempt
        this.logSecurityEvent('unsafe_operation_blocked', {
          pattern,
          path: req.path,
          method: req.method,
          body: req.body,
          ip: req.ip,
          timestamp: Date.now()
        }, 'critical');

        // Throw critical error to block the operation
        throw new PaperTradingError(
          `${PAPER_TRADING_ERRORS.REAL_TRADE_ATTEMPTED}: Unsafe operation pattern '${pattern}' detected and blocked`,
          'UNSAFE_OPERATION_BLOCKED',
          'critical'
        );
      }
    }

    // Additional check for any trading operation without proper paper trading markers
    if (this.isTradingEndpoint(req.path)) {
      const hasPaperMarkers = req.body?.isPaperTrade || 
                             req.body?.paperTradingMode || 
                             req.body?.virtualTrade ||
                             req.query?.paper_trade === 'true';

      if (!hasPaperMarkers && req.method !== 'GET') {
        this.logSecurityEvent('missing_paper_trade_markers', {
          path: req.path,
          method: req.method,
          body: req.body,
          timestamp: Date.now()
        }, 'high');

        logger.warn('Trading operation missing paper trade markers - will be converted', {
          path: req.path,
          method: req.method
        });
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
    (req as any).virtualTrade = true;
    (req as any).simulationOnly = true;

    // Add paper trading headers
    if (req.body) {
      req.body.isPaperTrade = true;
      req.body.paperTradingMode = true;
      req.body.virtualTrade = true;
      req.body.simulationOnly = true;
      req.body.realTrade = false;
      req.body.tradingMode = 'PAPER_ONLY';
    }

    // Add paper trading query parameters
    if (req.query) {
      (req.query as any).paper_trade = 'true';
      (req.query as any).simulation_only = 'true';
    }

    this.logSecurityEvent('trade_converted_to_paper', {
      originalPath: req.path,
      method: req.method,
      convertedAt: Date.now(),
      paperTradeMarkers: {
        isPaperTrade: true,
        paperTradingMode: true,
        virtualTrade: true,
        simulationOnly: true
      }
    }, 'low');

    logger.info('Trading operation converted to paper trade', {
      path: req.path,
      method: req.method,
      paperTradeMarkers: ['isPaperTrade', 'paperTradingMode', 'virtualTrade', 'simulationOnly']
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
   * Get comprehensive paper trading statistics
   */
  public getPaperTradingStats(): {
    totalInterceptions: number;
    criticalBlocks: number;
    paperTradeConversions: number;
    unsafeOperationsBlocked: number;
    lastValidationTime: number;
    safetyScore: number;
  } {
    const criticalEvents = this.securityAuditLog.filter(log => log.riskLevel === 'critical');
    const paperTradeEvents = this.securityAuditLog.filter(log => log.event === 'trade_converted_to_paper');
    const unsafeBlocks = this.securityAuditLog.filter(log => log.event === 'unsafe_operation_blocked');
    const interceptions = this.securityAuditLog.filter(log => log.event === 'trading_operation_intercepted');

    // Calculate safety score based on successful validations vs violations
    const totalEvents = this.securityAuditLog.length;
    const violationEvents = criticalEvents.length + unsafeBlocks.length;
    const safetyScore = totalEvents > 0 ? Math.max(0, 100 - (violationEvents / totalEvents * 100)) : 100;

    return {
      totalInterceptions: interceptions.length,
      criticalBlocks: criticalEvents.length,
      paperTradeConversions: paperTradeEvents.length,
      unsafeOperationsBlocked: unsafeBlocks.length,
      lastValidationTime: Date.now(),
      safetyScore: Math.round(safetyScore)
    };
  }

  /**
   * Export security audit log for external analysis
   */
  public exportSecurityAuditLog(): {
    exportTime: number;
    totalEvents: number;
    criticalEvents: number;
    events: Array<{
      timestamp: number;
      event: string;
      details: any;
      riskLevel: string;
    }>;
    summary: {
      paperTradingEnabled: boolean;
      realTradesBlocked: boolean;
      safetyScore: number;
      lastValidation: number;
    };
  } {
    const stats = this.getPaperTradingStats();
    
    return {
      exportTime: Date.now(),
      totalEvents: this.securityAuditLog.length,
      criticalEvents: stats.criticalBlocks,
      events: [...this.securityAuditLog],
      summary: {
        paperTradingEnabled: this.paperTradingConfig.enabled,
        realTradesBlocked: !this.paperTradingConfig.allowRealTrades,
        safetyScore: stats.safetyScore,
        lastValidation: stats.lastValidationTime
      }
    };
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

export const validateApiPermissions = async (apiKey: string, exchange: string): Promise<SecurityValidation> => {
  return await PaperTradingGuard.getInstance().validateApiPermissions(apiKey, exchange);
};