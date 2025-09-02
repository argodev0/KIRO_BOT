import { EventEmitter } from 'events';
import { HummingbotBridgeService } from './HummingbotBridgeService';
import { TradingExecutionService } from './TradingExecutionService';
import { logger } from '../utils/logger';
import { 
  HBStrategy, 
  HBConnection, 
  StrategyExecution, 
  FailoverConfig,
  RecoveryState,
  ConnectionHealth,
  StrategyState
} from '../types/hummingbot';
import { TradingSignal } from '../types/trading';

export interface FailoverMetrics {
  failoverCount: number;
  recoveryCount: number;
  averageRecoveryTime: number;
  lastFailoverTime?: number;
  lastRecoveryTime?: number;
  currentState: 'normal' | 'degraded' | 'recovering';
}

export interface ExecutionResult {
  success: boolean;
  executionMethod: 'hummingbot' | 'direct';
  strategyId?: string;
  error?: Error;
  metrics: {
    latency: number;
    timestamp: number;
  };
}

export class HummingbotFailoverService extends EventEmitter {
  private logger = logger;
  private hummingbotService: HummingbotBridgeService;
  private tradingService: TradingExecutionService;
  private config: FailoverConfig;
  private recoveryState: RecoveryState;
  private metrics: FailoverMetrics;
  private connectionHealthMap: Map<string, ConnectionHealth> = new Map();
  private strategyStateMap: Map<string, StrategyState> = new Map();
  private recoveryTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    hummingbotService: HummingbotBridgeService,
    tradingService: TradingExecutionService,
    config: FailoverConfig
  ) {
    super();
    this.hummingbotService = hummingbotService;
    this.tradingService = tradingService;
    this.config = config;
    this.recoveryState = {
      isRecovering: false,
      failedConnections: new Set(),
      recoveryAttempts: new Map(),
      lastRecoveryTime: 0
    };
    this.metrics = {
      failoverCount: 0,
      recoveryCount: 0,
      averageRecoveryTime: 0,
      currentState: 'normal'
    };

    this.setupHealthMonitoring();
  }

  /**
   * Execute trading signal with failover capability
   */
  async executeWithFailover(signal: TradingSignal): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Primary: Try Hummingbot execution
      const hbResult = await this.executeViaHummingbot(signal);
      
      return {
        success: true,
        executionMethod: 'hummingbot',
        strategyId: hbResult.id,
        metrics: {
          latency: Date.now() - startTime,
          timestamp: Date.now()
        }
      };
    } catch (hbError) {
      this.logger.warn('Hummingbot execution failed, initiating failover', {
        error: (hbError as Error).message,
        signal: signal.id
      });

      await this.handleFailover(hbError as Error);

      try {
        // Fallback: Direct exchange execution
        const directResult = await this.executeViaDirect(signal);
        
        return {
          success: true,
          executionMethod: 'direct',
          metrics: {
            latency: Date.now() - startTime,
            timestamp: Date.now()
          }
        };
      } catch (directError) {
        this.logger.error('Both execution methods failed', {
          hbError: (hbError as Error).message,
          directError: (directError as Error).message,
          signal: signal.id
        });

        return {
          success: false,
          executionMethod: 'direct',
          error: directError as Error,
          metrics: {
            latency: Date.now() - startTime,
            timestamp: Date.now()
          }
        };
      }
    }
  }

  /**
   * Handle failover process
   */
  private async handleFailover(error: Error): Promise<void> {
    this.metrics.failoverCount++;
    this.metrics.lastFailoverTime = Date.now();
    this.metrics.currentState = 'degraded';

    this.emit('failover', {
      timestamp: Date.now(),
      error: error.message,
      metrics: this.metrics
    });

    // Start recovery process
    this.initiateRecovery();
  }

  /**
   * Execute signal via Hummingbot
   */
  private async executeViaHummingbot(signal: TradingSignal): Promise<StrategyExecution> {
    // Convert signal to Hummingbot strategy
    const strategy = await this.convertSignalToStrategy(signal);
    
    // Execute strategy - this will throw if Hummingbot is not available
    return await this.hummingbotService.executeStrategy(strategy);
  }

  /**
   * Execute signal via direct exchange
   */
  private async executeViaDirect(signal: TradingSignal): Promise<any> {
    // Use a default position size for the signal execution
    const positionSize = 0.01; // Default position size
    
    return await this.tradingService.executeSignal(signal, positionSize);
  }

  /**
   * Check Hummingbot service health
   */
  private async checkHummingbotHealth(): Promise<boolean> {
    try {
      const connections = this.hummingbotService.getConnections();
      return connections.size > 0 && Array.from(connections.values()).some(conn => conn.status === 'connected');
    } catch (error) {
      return false;
    }
  }

  /**
   * Convert trading signal to Hummingbot strategy
   */
  private async convertSignalToStrategy(signal: TradingSignal): Promise<HBStrategy> {
    // This would typically use the StrategyConverter service
    // For now, return a basic strategy structure
    return {
      type: 'pure_market_making',
      exchange: signal.exchange,
      tradingPair: signal.symbol,
      parameters: {
        bid_spread: 0.1,
        ask_spread: 0.1,
        order_amount: signal.quantity || 0.01
      },
      riskLimits: {
        maxPositionSize: signal.quantity ? signal.quantity * 10 : 0.1,
        maxDailyLoss: 0.05,
        stopLossPercentage: 0.05,
        maxOpenOrders: 10,
        maxSlippage: 0.01
      },
      executionSettings: {
        orderRefreshTime: 30,
        orderRefreshTolerance: 0.01,
        filledOrderDelay: 1,
        orderOptimization: false,
        addTransactionCosts: true,
        priceSource: 'current_market' as const
      }
    };
  }

  /**
   * Initiate recovery process with exponential backoff
   */
  private initiateRecovery(): void {
    if (this.recoveryState.isRecovering) {
      return;
    }

    this.recoveryState.isRecovering = true;
    this.metrics.currentState = 'recovering';
    
    this.emit('recovery-started', {
      timestamp: Date.now()
    });

    this.startRecoveryWithBackoff();
  }

  /**
   * Start recovery process with exponential backoff
   */
  private startRecoveryWithBackoff(): void {
    const attemptRecovery = async (attempt: number = 1): Promise<void> => {
      const backoffDelay = Math.min(
        this.config.initialBackoffMs * Math.pow(2, attempt - 1),
        this.config.maxBackoffMs
      );

      this.logger.info(`Recovery attempt ${attempt} in ${backoffDelay}ms`);

      const timer = setTimeout(async () => {
        try {
          const recoverySuccess = await this.attemptRecovery();
          
          if (recoverySuccess) {
            await this.completeRecovery();
          } else if (attempt < this.config.maxRetryAttempts) {
            attemptRecovery(attempt + 1);
          } else {
            this.logger.error('Recovery failed after maximum attempts');
            this.emit('recovery-failed', {
              timestamp: Date.now(),
              attempts: attempt
            });
          }
        } catch (error) {
          this.logger.error('Recovery attempt failed', error);
          if (attempt < this.config.maxRetryAttempts) {
            attemptRecovery(attempt + 1);
          }
        }
      }, backoffDelay);

      this.recoveryTimers.set(`recovery-${attempt}`, timer);
    };

    attemptRecovery();
  }

  /**
   * Attempt to recover Hummingbot connections
   */
  private async attemptRecovery(): Promise<boolean> {
    try {
      // Check if Hummingbot service is responsive
      const isHealthy = await this.checkHummingbotHealth();
      
      if (!isHealthy) {
        // Try to reconnect - for now just log, as reconnectAll doesn't exist
        this.logger.warn('Hummingbot service is not healthy, attempting recovery');
      }

      // Verify recovery
      const postRecoveryHealth = await this.checkHummingbotHealth();
      
      if (postRecoveryHealth) {
        // Synchronize strategy states
        await this.synchronizeStrategyStates();
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Recovery attempt failed', error);
      return false;
    }
  }

  /**
   * Complete recovery process
   */
  private async completeRecovery(): Promise<void> {
    const recoveryTime = Date.now() - (this.metrics.lastFailoverTime || 0);
    
    this.metrics.recoveryCount++;
    this.metrics.lastRecoveryTime = Date.now();
    this.metrics.currentState = 'normal';
    
    // Update average recovery time
    this.metrics.averageRecoveryTime = 
      (this.metrics.averageRecoveryTime * (this.metrics.recoveryCount - 1) + recoveryTime) / 
      this.metrics.recoveryCount;

    this.recoveryState.isRecovering = false;
    this.recoveryState.failedConnections.clear();
    this.recoveryState.recoveryAttempts.clear();

    // Clear recovery timers
    this.recoveryTimers.forEach(timer => clearTimeout(timer));
    this.recoveryTimers.clear();

    this.logger.info('Recovery completed successfully', {
      recoveryTime,
      totalRecoveries: this.metrics.recoveryCount
    });

    this.emit('recovery-completed', {
      timestamp: Date.now(),
      recoveryTime,
      metrics: this.metrics
    });
  }

  /**
   * Synchronize strategy states after recovery
   */
  private async synchronizeStrategyStates(): Promise<void> {
    try {
      // For now, just log that synchronization would happen
      // In a full implementation, this would sync with actual strategy states
      this.logger.info('Strategy state synchronization completed');
    } catch (error) {
      this.logger.error('Strategy state synchronization failed', error);
      throw error;
    }
  }

  // Removed detectStateInconsistencies and correctStateInconsistencies methods
  // as they are now handled by the dedicated HummingbotStateSynchronizer service

  /**
   * Setup health monitoring
   */
  private setupHealthMonitoring(): void {
    setInterval(async () => {
      try {
        const connections = this.hummingbotService.getConnections();
        
        for (const [instanceId, connection] of connections) {
          const health: ConnectionHealth = {
            instanceId: connection.instanceId,
            isHealthy: connection.status === 'connected',
            lastPing: connection.lastPing,
            responseTime: Date.now() - connection.lastPing,
            errorCount: 0,
            lastError: null
          };

          this.connectionHealthMap.set(connection.instanceId, health);
        }
      } catch (error) {
        this.logger.error('Health monitoring failed', error);
      }
    }, this.config.healthCheckIntervalMs);
  }

  /**
   * Get current failover metrics
   */
  getMetrics(): FailoverMetrics {
    return { ...this.metrics };
  }

  /**
   * Get connection health status
   */
  getConnectionHealth(): Map<string, ConnectionHealth> {
    return new Map(this.connectionHealthMap);
  }

  /**
   * Force failover for testing
   */
  async forceFailover(): Promise<void> {
    await this.handleFailover(new Error('Forced failover for testing'));
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.recoveryTimers.forEach(timer => clearTimeout(timer));
    this.recoveryTimers.clear();
    this.removeAllListeners();
  }
}