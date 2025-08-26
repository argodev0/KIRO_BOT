import { Counter, Gauge, register } from 'prom-client';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

interface PaperTradingSafetyStatus {
  paperTradingModeEnabled: boolean;
  realTradingAttemptsBlocked: number;
  apiKeyPermissionViolations: number;
  paperTradesExecuted: number;
  virtualPortfolioBalances: Map<string, number>;
  lastSafetyCheck: number;
  safetyViolations: string[];
}

export class PaperTradingSafetyMonitor extends EventEmitter {
  private static instance: PaperTradingSafetyMonitor;
  
  // Paper Trading Safety Metrics
  private readonly paperTradingModeEnabled: Gauge<string>;
  private readonly realTradingAttemptsBlocked: Counter<string>;
  private readonly apiKeyPermissionViolations: Counter<string>;
  private readonly paperTradesExecuted: Counter<string>;
  private readonly virtualPortfolioBalance: Gauge<string>;
  private readonly paperTradingGuardValidations: Counter<string>;
  private readonly paperTradingGuardFailures: Counter<string>;
  private readonly environmentValidations: Counter<string>;
  private readonly environmentValidationFailures: Counter<string>;
  private readonly apiKeyValidations: Counter<string>;
  private readonly paperTradingAuditLogs: Counter<string>;
  private readonly virtualPortfolioInitialBalance: Gauge<string>;
  private readonly virtualPortfolioExpectedBalance: Gauge<string>;
  
  // Safety status tracking
  private safetyStatus: PaperTradingSafetyStatus;
  private safetyCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    
    // Initialize safety metrics
    this.paperTradingModeEnabled = new Gauge({
      name: 'paper_trading_mode_enabled',
      help: 'Whether paper trading mode is enabled (1) or disabled (0)'
    });

    this.realTradingAttemptsBlocked = new Counter({
      name: 'real_trading_attempts_blocked_total',
      help: 'Total number of real trading attempts that were blocked',
      labelNames: ['user_id', 'endpoint', 'reason']
    });

    this.apiKeyPermissionViolations = new Counter({
      name: 'api_key_permission_violations_total',
      help: 'Total number of API key permission violations detected',
      labelNames: ['exchange', 'permission_type', 'user_id']
    });

    this.paperTradesExecuted = new Counter({
      name: 'paper_trades_executed_total',
      help: 'Total number of paper trades executed',
      labelNames: ['symbol', 'side', 'exchange', 'user_id']
    });

    this.virtualPortfolioBalance = new Gauge({
      name: 'virtual_portfolio_balance',
      help: 'Current virtual portfolio balance in USD',
      labelNames: ['user_id']
    });

    this.paperTradingGuardValidations = new Counter({
      name: 'paper_trading_guard_validations_total',
      help: 'Total number of paper trading guard validations performed',
      labelNames: ['validation_type', 'result']
    });

    this.paperTradingGuardFailures = new Counter({
      name: 'paper_trading_guard_failures_total',
      help: 'Total number of paper trading guard failures',
      labelNames: ['failure_type', 'severity']
    });

    this.environmentValidations = new Counter({
      name: 'environment_validations_total',
      help: 'Total number of environment validations performed',
      labelNames: ['validation_type', 'result']
    });

    this.environmentValidationFailures = new Counter({
      name: 'environment_validation_failures_total',
      help: 'Total number of environment validation failures',
      labelNames: ['failure_type']
    });

    this.apiKeyValidations = new Counter({
      name: 'api_key_validations_total',
      help: 'Total number of API key validations performed',
      labelNames: ['exchange', 'result']
    });

    this.paperTradingAuditLogs = new Counter({
      name: 'paper_trading_audit_logs_total',
      help: 'Total number of paper trading audit log entries created',
      labelNames: ['log_type', 'user_id']
    });

    this.virtualPortfolioInitialBalance = new Gauge({
      name: 'virtual_portfolio_initial_balance',
      help: 'Initial virtual portfolio balance in USD',
      labelNames: ['user_id']
    });

    this.virtualPortfolioExpectedBalance = new Gauge({
      name: 'virtual_portfolio_expected_balance',
      help: 'Expected virtual portfolio balance in USD based on trades',
      labelNames: ['user_id']
    });

    // Initialize safety status
    this.safetyStatus = {
      paperTradingModeEnabled: true,
      realTradingAttemptsBlocked: 0,
      apiKeyPermissionViolations: 0,
      paperTradesExecuted: 0,
      virtualPortfolioBalances: new Map(),
      lastSafetyCheck: Date.now(),
      safetyViolations: []
    };

    // Register metrics
    this.registerMetrics();
    
    // Start safety monitoring
    this.startSafetyMonitoring();
    
    // Set initial paper trading mode
    this.setPaperTradingMode(true);
  }

  public static getInstance(): PaperTradingSafetyMonitor {
    if (!PaperTradingSafetyMonitor.instance) {
      PaperTradingSafetyMonitor.instance = new PaperTradingSafetyMonitor();
    }
    return PaperTradingSafetyMonitor.instance;
  }

  private registerMetrics(): void {
    const metrics = [
      this.paperTradingModeEnabled,
      this.realTradingAttemptsBlocked,
      this.apiKeyPermissionViolations,
      this.paperTradesExecuted,
      this.virtualPortfolioBalance,
      this.paperTradingGuardValidations,
      this.paperTradingGuardFailures,
      this.environmentValidations,
      this.environmentValidationFailures,
      this.apiKeyValidations,
      this.paperTradingAuditLogs,
      this.virtualPortfolioInitialBalance,
      this.virtualPortfolioExpectedBalance
    ];

    metrics.forEach(metric => register.registerMetric(metric));
  }

  // Paper Trading Mode Management
  public setPaperTradingMode(enabled: boolean): void {
    this.safetyStatus.paperTradingModeEnabled = enabled;
    this.paperTradingModeEnabled.set(enabled ? 1 : 0);
    
    if (!enabled) {
      const violation = 'Paper trading mode disabled - CRITICAL SAFETY VIOLATION';
      this.safetyStatus.safetyViolations.push(violation);
      this.emit('critical_safety_violation', {
        type: 'paper_trading_disabled',
        message: violation,
        timestamp: Date.now()
      });
      logger.error(violation);
    } else {
      logger.info('Paper trading mode enabled - system is safe');
    }
  }

  public isPaperTradingModeEnabled(): boolean {
    return this.safetyStatus.paperTradingModeEnabled;
  }

  // Real Trading Attempt Blocking
  public recordRealTradingAttemptBlocked(userId: string, endpoint: string, reason: string): void {
    this.realTradingAttemptsBlocked.inc({ user_id: userId, endpoint, reason });
    this.safetyStatus.realTradingAttemptsBlocked++;
    
    const violation = `Real trading attempt blocked: ${reason} for user ${userId} on ${endpoint}`;
    this.safetyStatus.safetyViolations.push(violation);
    
    this.emit('real_trading_attempt_blocked', {
      userId,
      endpoint,
      reason,
      timestamp: Date.now()
    });
    
    logger.warn(violation);
  }

  // API Key Permission Violations
  public recordApiKeyPermissionViolation(exchange: string, permissionType: string, userId: string): void {
    this.apiKeyPermissionViolations.inc({ exchange, permission_type: permissionType, user_id: userId });
    this.safetyStatus.apiKeyPermissionViolations++;
    
    const violation = `API key permission violation: ${permissionType} permission detected for ${exchange} (user: ${userId})`;
    this.safetyStatus.safetyViolations.push(violation);
    
    this.emit('api_key_permission_violation', {
      exchange,
      permissionType,
      userId,
      timestamp: Date.now()
    });
    
    logger.error(violation);
  }

  // Paper Trade Execution
  public recordPaperTradeExecution(symbol: string, side: string, exchange: string, userId: string, amount: number): void {
    this.paperTradesExecuted.inc({ symbol, side, exchange, user_id: userId });
    this.safetyStatus.paperTradesExecuted++;
    
    // Create audit log entry
    this.paperTradingAuditLogs.inc({ log_type: 'trade_execution', user_id: userId });
    
    this.emit('paper_trade_executed', {
      symbol,
      side,
      exchange,
      userId,
      amount,
      timestamp: Date.now()
    });
    
    logger.info(`Paper trade executed: ${side} ${amount} ${symbol} on ${exchange} for user ${userId}`);
  }

  // Virtual Portfolio Management
  public updateVirtualPortfolioBalance(userId: string, balance: number): void {
    this.virtualPortfolioBalance.set({ user_id: userId }, balance);
    this.safetyStatus.virtualPortfolioBalances.set(userId, balance);
    
    // Check for negative balance (corruption)
    if (balance < 0) {
      const violation = `Virtual portfolio balance corruption: negative balance ${balance} for user ${userId}`;
      this.safetyStatus.safetyViolations.push(violation);
      
      this.emit('virtual_portfolio_corruption', {
        userId,
        balance,
        timestamp: Date.now()
      });
      
      logger.error(violation);
    }
  }

  public setInitialVirtualBalance(userId: string, balance: number): void {
    this.virtualPortfolioInitialBalance.set({ user_id: userId }, balance);
  }

  public setExpectedVirtualBalance(userId: string, balance: number): void {
    this.virtualPortfolioExpectedBalance.set({ user_id: userId }, balance);
  }

  // Guard System Validation
  public recordGuardValidation(validationType: string, result: 'success' | 'failure'): void {
    this.paperTradingGuardValidations.inc({ validation_type: validationType, result });
    
    if (result === 'failure') {
      this.paperTradingGuardFailures.inc({ failure_type: validationType, severity: 'medium' });
      
      const violation = `Paper trading guard validation failed: ${validationType}`;
      this.safetyStatus.safetyViolations.push(violation);
      
      this.emit('guard_validation_failure', {
        validationType,
        timestamp: Date.now()
      });
      
      logger.warn(violation);
    }
  }

  public recordCriticalGuardFailure(failureType: string): void {
    this.paperTradingGuardFailures.inc({ failure_type: failureType, severity: 'critical' });
    
    const violation = `CRITICAL paper trading guard failure: ${failureType}`;
    this.safetyStatus.safetyViolations.push(violation);
    
    this.emit('critical_guard_failure', {
      failureType,
      timestamp: Date.now()
    });
    
    logger.error(violation);
  }

  // Environment Validation
  public recordEnvironmentValidation(validationType: string, result: 'success' | 'failure'): void {
    this.environmentValidations.inc({ validation_type: validationType, result });
    
    if (result === 'failure') {
      this.environmentValidationFailures.inc({ failure_type: validationType });
      
      const violation = `Environment validation failed: ${validationType}`;
      this.safetyStatus.safetyViolations.push(violation);
      
      this.emit('environment_validation_failure', {
        validationType,
        timestamp: Date.now()
      });
      
      logger.warn(violation);
    }
  }

  // API Key Validation
  public recordApiKeyValidation(exchange: string, result: 'success' | 'failure'): void {
    this.apiKeyValidations.inc({ exchange, result });
    
    if (result === 'failure') {
      const violation = `API key validation failed for ${exchange}`;
      this.safetyStatus.safetyViolations.push(violation);
      
      this.emit('api_key_validation_failure', {
        exchange,
        timestamp: Date.now()
      });
      
      logger.warn(violation);
    }
  }

  // Safety Monitoring
  private startSafetyMonitoring(): void {
    this.safetyCheckInterval = setInterval(() => {
      this.performSafetyCheck();
    }, 10000); // Check every 10 seconds
    
    logger.info('Paper trading safety monitoring started');
  }

  private performSafetyCheck(): void {
    this.safetyStatus.lastSafetyCheck = Date.now();
    
    // Check if paper trading mode is still enabled
    if (!this.safetyStatus.paperTradingModeEnabled) {
      this.emit('critical_safety_violation', {
        type: 'paper_trading_disabled',
        message: 'Paper trading mode is disabled',
        timestamp: Date.now()
      });
    }
    
    // Check for recent safety violations
    const recentViolations = this.safetyStatus.safetyViolations.length;
    if (recentViolations > 10) {
      this.emit('multiple_safety_violations', {
        count: recentViolations,
        timestamp: Date.now()
      });
    }
    
    // Clear old violations (keep last 100)
    if (this.safetyStatus.safetyViolations.length > 100) {
      this.safetyStatus.safetyViolations = this.safetyStatus.safetyViolations.slice(-100);
    }
  }

  // Get Safety Status
  public getSafetyStatus(): PaperTradingSafetyStatus {
    return { ...this.safetyStatus };
  }

  public getSafetyReport(): {
    status: 'safe' | 'warning' | 'critical';
    paperTradingEnabled: boolean;
    totalViolations: number;
    recentViolations: string[];
    lastCheck: number;
  } {
    const recentViolations = this.safetyStatus.safetyViolations.slice(-10);
    const totalViolations = this.safetyStatus.safetyViolations.length;
    
    let status: 'safe' | 'warning' | 'critical' = 'safe';
    
    if (!this.safetyStatus.paperTradingModeEnabled) {
      status = 'critical';
    } else if (totalViolations > 5) {
      status = 'warning';
    }
    
    return {
      status,
      paperTradingEnabled: this.safetyStatus.paperTradingModeEnabled,
      totalViolations,
      recentViolations,
      lastCheck: this.safetyStatus.lastSafetyCheck
    };
  }

  // Cleanup
  public stop(): void {
    if (this.safetyCheckInterval) {
      clearInterval(this.safetyCheckInterval);
      this.safetyCheckInterval = null;
    }
    
    logger.info('Paper trading safety monitoring stopped');
  }
}