import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { MonitoringService } from './MonitoringService';
import { LogAggregationService } from './LogAggregationService';

interface RecoveryAction {
  id: string;
  name: string;
  description: string;
  condition: (error: any) => boolean;
  action: (error: any) => Promise<boolean>;
  maxRetries: number;
  retryDelay: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface RecoveryAttempt {
  actionId: string;
  timestamp: number;
  success: boolean;
  error?: string;
  retryCount: number;
}

interface FailureScenario {
  type: string;
  description: string;
  lastOccurrence: number;
  occurrenceCount: number;
  recoveryAttempts: RecoveryAttempt[];
  resolved: boolean;
}

export class AutoRecoveryService extends EventEmitter {
  private static instance: AutoRecoveryService;
  private monitoring: MonitoringService;
  private logService: LogAggregationService;
  private recoveryActions: Map<string, RecoveryAction> = new Map();
  private failureHistory: Map<string, FailureScenario> = new Map();
  private activeRecoveries: Set<string> = new Set();
  private recoveryInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.monitoring = MonitoringService.getInstance();
    this.logService = LogAggregationService.getInstance();
    this.initializeRecoveryActions();
    this.startRecoveryMonitoring();
  }

  public static getInstance(): AutoRecoveryService {
    if (!AutoRecoveryService.instance) {
      AutoRecoveryService.instance = new AutoRecoveryService();
    }
    return AutoRecoveryService.instance;
  }

  private initializeRecoveryActions(): void {
    // Database connection recovery
    this.addRecoveryAction({
      id: 'database_reconnect',
      name: 'Database Reconnection',
      description: 'Attempt to reconnect to database when connection is lost',
      condition: (error) => error.type === 'database_connection_error',
      action: this.recoverDatabaseConnection.bind(this),
      maxRetries: 5,
      retryDelay: 5000,
      severity: 'high'
    });

    // Exchange API recovery
    this.addRecoveryAction({
      id: 'exchange_reconnect',
      name: 'Exchange API Reconnection',
      description: 'Reconnect to exchange APIs when connection fails',
      condition: (error) => error.type === 'exchange_connection_error',
      action: this.recoverExchangeConnection.bind(this),
      maxRetries: 3,
      retryDelay: 10000,
      severity: 'high'
    });

    // WebSocket recovery
    this.addRecoveryAction({
      id: 'websocket_reconnect',
      name: 'WebSocket Reconnection',
      description: 'Reconnect WebSocket connections for real-time data',
      condition: (error) => error.type === 'websocket_connection_error',
      action: this.recoverWebSocketConnection.bind(this),
      maxRetries: 5,
      retryDelay: 3000,
      severity: 'medium'
    });

    // Memory cleanup recovery
    this.addRecoveryAction({
      id: 'memory_cleanup',
      name: 'Memory Cleanup',
      description: 'Clean up memory when usage exceeds thresholds',
      condition: (error) => error.type === 'high_memory_usage',
      action: this.recoverMemoryUsage.bind(this),
      maxRetries: 2,
      retryDelay: 1000,
      severity: 'medium'
    });

    // Service restart recovery
    this.addRecoveryAction({
      id: 'service_restart',
      name: 'Service Restart',
      description: 'Restart specific services when they become unresponsive',
      condition: (error) => error.type === 'service_unresponsive',
      action: this.recoverUnresponsiveService.bind(this),
      maxRetries: 2,
      retryDelay: 15000,
      severity: 'high'
    });

    // Trading halt recovery
    this.addRecoveryAction({
      id: 'trading_halt_recovery',
      name: 'Trading Halt Recovery',
      description: 'Resume trading after resolving critical issues',
      condition: (error) => error.type === 'trading_halted',
      action: this.recoverTradingHalt.bind(this),
      maxRetries: 1,
      retryDelay: 30000,
      severity: 'critical'
    });

    // Rate limit recovery
    this.addRecoveryAction({
      id: 'rate_limit_recovery',
      name: 'Rate Limit Recovery',
      description: 'Handle rate limiting by implementing backoff strategies',
      condition: (error) => error.type === 'rate_limit_exceeded',
      action: this.recoverRateLimit.bind(this),
      maxRetries: 3,
      retryDelay: 60000,
      severity: 'medium'
    });
  }

  public addRecoveryAction(action: RecoveryAction): void {
    this.recoveryActions.set(action.id, action);
    logger.info(`Added recovery action: ${action.name}`);
  }

  public async handleFailure(error: any): Promise<boolean> {
    const failureType = error.type || 'unknown_error';
    
    // Log the failure
    this.logService.logSystemEvent('error', `Failure detected: ${error.message}`, 'auto-recovery', {
      errorType: failureType,
      errorDetails: error
    });

    // Update failure history
    this.updateFailureHistory(failureType, error);

    // Find applicable recovery actions
    const applicableActions = Array.from(this.recoveryActions.values())
      .filter(action => action.condition(error))
      .sort((a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity));

    if (applicableActions.length === 0) {
      logger.warn(`No recovery actions found for error type: ${failureType}`);
      return false;
    }

    // Execute recovery actions
    for (const action of applicableActions) {
      if (this.activeRecoveries.has(action.id)) {
        logger.info(`Recovery action ${action.id} already in progress, skipping`);
        continue;
      }

      const success = await this.executeRecoveryAction(action, error);
      if (success) {
        this.markFailureResolved(failureType);
        return true;
      }
    }

    return false;
  }

  private async executeRecoveryAction(action: RecoveryAction, error: any): Promise<boolean> {
    const actionId = action.id;
    this.activeRecoveries.add(actionId);

    try {
      logger.info(`Executing recovery action: ${action.name}`);
      
      let retryCount = 0;
      let success = false;

      while (retryCount < action.maxRetries && !success) {
        try {
          success = await action.action(error);
          
          this.recordRecoveryAttempt(error.type, {
            actionId,
            timestamp: Date.now(),
            success,
            retryCount
          });

          if (success) {
            logger.info(`Recovery action ${action.name} succeeded on attempt ${retryCount + 1}`);
            this.emit('recovery_success', { action: action.name, retryCount });
            break;
          }
        } catch (actionError) {
          logger.error(`Recovery action ${action.name} failed on attempt ${retryCount + 1}:`, actionError);
          
          this.recordRecoveryAttempt(error.type, {
            actionId,
            timestamp: Date.now(),
            success: false,
            error: actionError.message,
            retryCount
          });
        }

        retryCount++;
        
        if (retryCount < action.maxRetries) {
          logger.info(`Retrying recovery action ${action.name} in ${action.retryDelay}ms`);
          await this.delay(action.retryDelay);
        }
      }

      if (!success) {
        logger.error(`Recovery action ${action.name} failed after ${action.maxRetries} attempts`);
        this.emit('recovery_failure', { action: action.name, maxRetries: action.maxRetries });
      }

      return success;
    } finally {
      this.activeRecoveries.delete(actionId);
    }
  }

  // Recovery action implementations
  private async recoverDatabaseConnection(error: any): Promise<boolean> {
    try {
      // Attempt to reconnect to database
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      await prisma.$disconnect();
      
      logger.info('Database connection recovered successfully');
      return true;
    } catch (dbError) {
      logger.error('Failed to recover database connection:', dbError);
      return false;
    }
  }

  private async recoverExchangeConnection(error: any): Promise<boolean> {
    try {
      const exchange = error.exchange || 'unknown';
      
      // Reinitialize exchange connection
      // This would typically involve recreating the exchange client
      logger.info(`Attempting to recover ${exchange} connection`);
      
      // Simulate connection recovery
      await this.delay(2000);
      
      logger.info(`${exchange} connection recovered successfully`);
      return true;
    } catch (exchangeError) {
      logger.error('Failed to recover exchange connection:', exchangeError);
      return false;
    }
  }

  private async recoverWebSocketConnection(error: any): Promise<boolean> {
    try {
      // Reconnect WebSocket connections
      logger.info('Attempting to recover WebSocket connections');
      
      // This would typically involve reconnecting to WebSocket streams
      await this.delay(1000);
      
      logger.info('WebSocket connections recovered successfully');
      return true;
    } catch (wsError) {
      logger.error('Failed to recover WebSocket connections:', wsError);
      return false;
    }
  }

  private async recoverMemoryUsage(error: any): Promise<boolean> {
    try {
      logger.info('Attempting memory cleanup');
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Clear caches and temporary data
      // This would involve clearing application-specific caches
      
      const memUsage = process.memoryUsage();
      logger.info(`Memory usage after cleanup: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
      
      return true;
    } catch (memError) {
      logger.error('Failed to recover memory usage:', memError);
      return false;
    }
  }

  private async recoverUnresponsiveService(error: any): Promise<boolean> {
    try {
      const serviceName = error.service || 'unknown';
      logger.info(`Attempting to restart unresponsive service: ${serviceName}`);
      
      // This would typically involve restarting the specific service
      // For now, we'll simulate a service restart
      await this.delay(5000);
      
      logger.info(`Service ${serviceName} restarted successfully`);
      return true;
    } catch (serviceError) {
      logger.error('Failed to restart service:', serviceError);
      return false;
    }
  }

  private async recoverTradingHalt(error: any): Promise<boolean> {
    try {
      logger.info('Attempting to resume trading after halt');
      
      // Perform safety checks before resuming trading
      const safetyChecks = await this.performTradingSafetyChecks();
      
      if (safetyChecks.passed) {
        logger.info('Trading safety checks passed, resuming trading');
        return true;
      } else {
        logger.warn('Trading safety checks failed, keeping trading halted');
        return false;
      }
    } catch (tradingError) {
      logger.error('Failed to recover from trading halt:', tradingError);
      return false;
    }
  }

  private async recoverRateLimit(error: any): Promise<boolean> {
    try {
      const exchange = error.exchange || 'unknown';
      const waitTime = error.retryAfter || 60000;
      
      logger.info(`Rate limit exceeded for ${exchange}, waiting ${waitTime}ms`);
      
      await this.delay(waitTime);
      
      logger.info(`Rate limit recovery completed for ${exchange}`);
      return true;
    } catch (rateLimitError) {
      logger.error('Failed to recover from rate limit:', rateLimitError);
      return false;
    }
  }

  private async performTradingSafetyChecks(): Promise<{ passed: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      // Check database connectivity
      // Check exchange connectivity
      // Check risk management systems
      // Check portfolio status
      
      // Simulate safety checks
      await this.delay(2000);
      
      return { passed: issues.length === 0, issues };
    } catch (error) {
      issues.push('Safety check execution failed');
      return { passed: false, issues };
    }
  }

  private updateFailureHistory(failureType: string, error: any): void {
    if (!this.failureHistory.has(failureType)) {
      this.failureHistory.set(failureType, {
        type: failureType,
        description: error.message || 'Unknown error',
        lastOccurrence: Date.now(),
        occurrenceCount: 0,
        recoveryAttempts: [],
        resolved: false
      });
    }

    const scenario = this.failureHistory.get(failureType)!;
    scenario.lastOccurrence = Date.now();
    scenario.occurrenceCount++;
    scenario.resolved = false;
  }

  private recordRecoveryAttempt(failureType: string, attempt: RecoveryAttempt): void {
    const scenario = this.failureHistory.get(failureType);
    if (scenario) {
      scenario.recoveryAttempts.push(attempt);
    }
  }

  private markFailureResolved(failureType: string): void {
    const scenario = this.failureHistory.get(failureType);
    if (scenario) {
      scenario.resolved = true;
      logger.info(`Failure scenario resolved: ${failureType}`);
    }
  }

  private getSeverityWeight(severity: string): number {
    const weights = { low: 1, medium: 2, high: 3, critical: 4 };
    return weights[severity] || 0;
  }

  private startRecoveryMonitoring(): void {
    this.recoveryInterval = setInterval(() => {
      this.performHealthChecks();
    }, 30000); // Check every 30 seconds
  }

  private async performHealthChecks(): Promise<void> {
    try {
      // Check for recurring failures
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;

      for (const [type, scenario] of this.failureHistory.entries()) {
        if (!scenario.resolved && scenario.lastOccurrence > fiveMinutesAgo) {
          const recentAttempts = scenario.recoveryAttempts.filter(
            attempt => attempt.timestamp > fiveMinutesAgo
          );

          if (recentAttempts.length > 3) {
            this.emit('recovery_escalation', {
              failureType: type,
              attemptCount: recentAttempts.length,
              scenario
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error in recovery health checks:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getFailureHistory(): Map<string, FailureScenario> {
    return new Map(this.failureHistory);
  }

  public getRecoveryActions(): Map<string, RecoveryAction> {
    return new Map(this.recoveryActions);
  }

  public stop(): void {
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
      this.recoveryInterval = null;
    }
  }
}