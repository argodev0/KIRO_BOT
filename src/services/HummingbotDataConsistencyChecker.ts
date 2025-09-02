import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { HummingbotBridgeService } from './HummingbotBridgeService';
import { 
  StrategyExecution, 
  DataConsistencyConfig,
  ConsistencyCheckResult,
  DataInconsistency,
  ConsistencyMetrics
} from '../types/hummingbot';

export interface CheckResult {
  strategyId: string;
  isConsistent: boolean;
  inconsistencies: DataInconsistency[];
  checkTime: number;
  correctionApplied: boolean;
}

export class HummingbotDataConsistencyChecker extends EventEmitter {
  private logger = logger;
  private hummingbotService: HummingbotBridgeService;
  private config: DataConsistencyConfig;
  private metrics: ConsistencyMetrics;
  private checkTimer?: NodeJS.Timeout;
  private checksInProgress: Set<string> = new Set();

  constructor(
    hummingbotService: HummingbotBridgeService,
    config: DataConsistencyConfig
  ) {
    super();
    this.hummingbotService = hummingbotService;
    this.config = config;
    this.metrics = {
      totalChecks: 0,
      inconsistenciesFound: 0,
      inconsistenciesResolved: 0,
      averageCheckTime: 0,
      lastCheckTime: 0
    };

    this.startPeriodicChecks();
  }

  /**
   * Perform comprehensive data consistency check
   */
  async performConsistencyCheck(): Promise<ConsistencyCheckResult> {
    const startTime = Date.now();
    this.metrics.totalChecks++;

    try {
      const strategies = await this.hummingbotService.getActiveStrategies();
      const checkResults: CheckResult[] = [];

      for (const strategy of strategies) {
        if (this.checksInProgress.has(strategy.id)) {
          continue;
        }

        this.checksInProgress.add(strategy.id);

        try {
          const result = await this.checkStrategyConsistency(strategy);
          checkResults.push(result);
        } catch (error) {
          this.logger.error(`Consistency check failed for strategy ${strategy.id}`, error);
          checkResults.push({
            strategyId: strategy.id,
            isConsistent: false,
            inconsistencies: [{
              type: 'check_error',
              severity: 'high',
              description: `Consistency check failed: ${error.message}`,
              affectedData: 'strategy',
              detectedAt: Date.now()
            }],
            checkTime: Date.now() - startTime,
            correctionApplied: false
          });
        } finally {
          this.checksInProgress.delete(strategy.id);
        }
      }

      const checkTime = Date.now() - startTime;
      const totalInconsistencies = checkResults.reduce((sum, r) => sum + r.inconsistencies.length, 0);
      const resolvedInconsistencies = checkResults.reduce((sum, r) => sum + (r.correctionApplied ? r.inconsistencies.length : 0), 0);

      // Update metrics
      this.metrics.inconsistenciesFound += totalInconsistencies;
      this.metrics.inconsistenciesResolved += resolvedInconsistencies;
      this.metrics.averageCheckTime = 
        (this.metrics.averageCheckTime * (this.metrics.totalChecks - 1) + checkTime) / 
        this.metrics.totalChecks;
      this.metrics.lastCheckTime = Date.now();

      const result: ConsistencyCheckResult = {
        success: checkResults.every(r => r.isConsistent),
        checkTime,
        strategiesChecked: checkResults.length,
        inconsistenciesFound: totalInconsistencies,
        inconsistenciesResolved: resolvedInconsistencies,
        details: checkResults
      };

      this.logger.info('Data consistency check completed', {
        strategiesChecked: result.strategiesChecked,
        inconsistenciesFound: result.inconsistenciesFound,
        inconsistenciesResolved: result.inconsistenciesResolved,
        checkTime: result.checkTime
      });

      this.emit('consistency-check-completed', result);

      return result;
    } catch (error) {
      const checkTime = Date.now() - startTime;
      
      this.logger.error('Data consistency check failed', error);
      
      const result: ConsistencyCheckResult = {
        success: false,
        checkTime,
        strategiesChecked: 0,
        inconsistenciesFound: 0,
        inconsistenciesResolved: 0,
        error: error as Error,
        details: []
      };

      this.emit('consistency-check-failed', result);

      return result;
    }
  }

  /**
   * Check consistency for a specific strategy
   */
  async checkStrategyConsistency(strategy: StrategyExecution): Promise<CheckResult> {
    const startTime = Date.now();
    const inconsistencies: DataInconsistency[] = [];

    // Check performance data consistency
    const performanceInconsistencies = await this.checkPerformanceConsistency(strategy);
    inconsistencies.push(...performanceInconsistencies);

    // Check parameter consistency
    const parameterInconsistencies = await this.checkParameterConsistency(strategy);
    inconsistencies.push(...parameterInconsistencies);

    // Check execution data consistency
    const executionInconsistencies = await this.checkExecutionConsistency(strategy);
    inconsistencies.push(...executionInconsistencies);

    // Check timestamp consistency
    const timestampInconsistencies = await this.checkTimestampConsistency(strategy);
    inconsistencies.push(...timestampInconsistencies);

    // Apply corrections if enabled and inconsistencies found
    let correctionApplied = false;
    if (this.config.autoCorrect && inconsistencies.length > 0) {
      correctionApplied = await this.applyCorrections(strategy.id, inconsistencies);
    }

    const result: CheckResult = {
      strategyId: strategy.id,
      isConsistent: inconsistencies.length === 0,
      inconsistencies,
      checkTime: Date.now() - startTime,
      correctionApplied
    };

    if (inconsistencies.length > 0) {
      this.logger.warn(`Found ${inconsistencies.length} inconsistencies for strategy ${strategy.id}`, {
        inconsistencyTypes: inconsistencies.map(i => i.type)
      });

      this.emit('inconsistencies-detected', {
        strategyId: strategy.id,
        inconsistencies,
        timestamp: Date.now()
      });
    }

    return result;
  }

  /**
   * Check performance data consistency
   */
  private async checkPerformanceConsistency(strategy: StrategyExecution): Promise<DataInconsistency[]> {
    const inconsistencies: DataInconsistency[] = [];
    const performance = strategy.performance;

    // Check if total trades matches successful trades
    if (performance.totalTrades < performance.successfulTrades) {
      inconsistencies.push({
        type: 'performance_logic_error',
        severity: 'high',
        description: `Total trades (${performance.totalTrades}) less than successful trades (${performance.successfulTrades})`,
        affectedData: 'performance.totalTrades',
        detectedAt: Date.now(),
        expectedValue: performance.successfulTrades,
        actualValue: performance.totalTrades
      });
    }

    // Check if PnL calculation is reasonable
    if (performance.totalTrades > 0 && performance.totalPnL === 0) {
      inconsistencies.push({
        type: 'performance_calculation_error',
        severity: 'medium',
        description: `Zero PnL with ${performance.totalTrades} trades executed`,
        affectedData: 'performance.totalPnL',
        detectedAt: Date.now(),
        expectedValue: 'non-zero',
        actualValue: 0
      });
    }

    // Check if volume is consistent with trade count
    if (performance.totalTrades > 0 && performance.totalVolume === 0) {
      inconsistencies.push({
        type: 'performance_volume_error',
        severity: 'medium',
        description: `Zero volume with ${performance.totalTrades} trades executed`,
        affectedData: 'performance.totalVolume',
        detectedAt: Date.now(),
        expectedValue: 'positive',
        actualValue: 0
      });
    }

    // Check latency values
    if (performance.averageLatency < 0) {
      inconsistencies.push({
        type: 'performance_latency_error',
        severity: 'low',
        description: `Negative average latency: ${performance.averageLatency}`,
        affectedData: 'performance.averageLatency',
        detectedAt: Date.now(),
        expectedValue: 'positive',
        actualValue: performance.averageLatency
      });
    }

    // Check fill rate
    if (performance.fillRate < 0 || performance.fillRate > 1) {
      inconsistencies.push({
        type: 'performance_fillrate_error',
        severity: 'medium',
        description: `Invalid fill rate: ${performance.fillRate} (should be 0-1)`,
        affectedData: 'performance.fillRate',
        detectedAt: Date.now(),
        expectedValue: '0-1',
        actualValue: performance.fillRate
      });
    }

    return inconsistencies;
  }

  /**
   * Check parameter consistency
   */
  private async checkParameterConsistency(strategy: StrategyExecution): Promise<DataInconsistency[]> {
    const inconsistencies: DataInconsistency[] = [];
    const parameters = strategy.parameters;

    // Check for required parameters based on strategy type
    const requiredParams = this.getRequiredParameters(strategy.strategyType);
    
    for (const param of requiredParams) {
      if (!(param in parameters)) {
        inconsistencies.push({
          type: 'parameter_missing',
          severity: 'high',
          description: `Required parameter '${param}' missing for ${strategy.strategyType} strategy`,
          affectedData: `parameters.${param}`,
          detectedAt: Date.now(),
          expectedValue: 'defined',
          actualValue: undefined
        });
      }
    }

    // Check parameter value ranges
    const parameterValidations = this.getParameterValidations(strategy.strategyType);
    
    for (const [param, validation] of Object.entries(parameterValidations)) {
      const value = parameters[param];
      
      if (value !== undefined && !validation.isValid(value)) {
        inconsistencies.push({
          type: 'parameter_invalid_value',
          severity: 'medium',
          description: `Invalid value for parameter '${param}': ${value}. ${validation.description}`,
          affectedData: `parameters.${param}`,
          detectedAt: Date.now(),
          expectedValue: validation.description,
          actualValue: value
        });
      }
    }

    return inconsistencies;
  }

  /**
   * Check execution data consistency
   */
  private async checkExecutionConsistency(strategy: StrategyExecution): Promise<DataInconsistency[]> {
    const inconsistencies: DataInconsistency[] = [];

    // Check status consistency
    const validStatuses = ['pending', 'active', 'paused', 'stopped', 'error'];
    if (!validStatuses.includes(strategy.status)) {
      inconsistencies.push({
        type: 'execution_invalid_status',
        severity: 'high',
        description: `Invalid strategy status: ${strategy.status}`,
        affectedData: 'status',
        detectedAt: Date.now(),
        expectedValue: validStatuses.join('|'),
        actualValue: strategy.status
      });
    }

    // Check if strategy has been running for reasonable time
    if (strategy.status === 'active' && strategy.startTime) {
      const runningTime = Date.now() - strategy.startTime;
      const minRunningTime = 60000; // 1 minute
      
      if (runningTime > minRunningTime && strategy.performance.totalTrades === 0) {
        inconsistencies.push({
          type: 'execution_no_activity',
          severity: 'medium',
          description: `Strategy active for ${Math.round(runningTime / 1000)}s but no trades executed`,
          affectedData: 'performance.totalTrades',
          detectedAt: Date.now(),
          expectedValue: 'positive',
          actualValue: 0
        });
      }
    }

    return inconsistencies;
  }

  /**
   * Check timestamp consistency
   */
  private async checkTimestampConsistency(strategy: StrategyExecution): Promise<DataInconsistency[]> {
    const inconsistencies: DataInconsistency[] = [];

    // Check if start time is in the past
    if (strategy.startTime > Date.now()) {
      inconsistencies.push({
        type: 'timestamp_future_start',
        severity: 'high',
        description: `Strategy start time is in the future: ${new Date(strategy.startTime).toISOString()}`,
        affectedData: 'startTime',
        detectedAt: Date.now(),
        expectedValue: 'past timestamp',
        actualValue: strategy.startTime
      });
    }

    // Check if end time is after start time
    if (strategy.endTime && strategy.startTime && strategy.endTime < strategy.startTime) {
      inconsistencies.push({
        type: 'timestamp_end_before_start',
        severity: 'high',
        description: `Strategy end time (${new Date(strategy.endTime).toISOString()}) is before start time (${new Date(strategy.startTime).toISOString()})`,
        affectedData: 'endTime',
        detectedAt: Date.now(),
        expectedValue: 'after start time',
        actualValue: strategy.endTime
      });
    }

    return inconsistencies;
  }

  /**
   * Apply corrections to inconsistencies
   */
  private async applyCorrections(strategyId: string, inconsistencies: DataInconsistency[]): Promise<boolean> {
    try {
      let correctionCount = 0;

      for (const inconsistency of inconsistencies) {
        const corrected = await this.applySingleCorrection(strategyId, inconsistency);
        if (corrected) {
          correctionCount++;
        }
      }

      this.logger.info(`Applied ${correctionCount}/${inconsistencies.length} corrections for strategy ${strategyId}`);

      this.emit('corrections-applied', {
        strategyId,
        totalInconsistencies: inconsistencies.length,
        correctionCount,
        timestamp: Date.now()
      });

      return correctionCount > 0;
    } catch (error) {
      this.logger.error(`Failed to apply corrections for strategy ${strategyId}`, error);
      return false;
    }
  }

  /**
   * Apply a single correction
   */
  private async applySingleCorrection(strategyId: string, inconsistency: DataInconsistency): Promise<boolean> {
    try {
      switch (inconsistency.type) {
        case 'performance_logic_error':
          // Correct total trades to match successful trades
          if (inconsistency.affectedData === 'performance.totalTrades') {
            await this.hummingbotService.updateStrategyPerformance(strategyId, {
              totalTrades: inconsistency.expectedValue as number
            });
            return true;
          }
          break;

        case 'performance_fillrate_error':
          // Clamp fill rate to valid range
          const clampedFillRate = Math.max(0, Math.min(1, inconsistency.actualValue as number));
          await this.hummingbotService.updateStrategyPerformance(strategyId, {
            fillRate: clampedFillRate
          });
          return true;

        case 'parameter_missing':
          // Add default value for missing parameter
          const defaultValue = this.getDefaultParameterValue(inconsistency.affectedData);
          if (defaultValue !== undefined) {
            await this.hummingbotService.updateStrategyParameter(strategyId, inconsistency.affectedData, defaultValue);
            return true;
          }
          break;

        case 'execution_invalid_status':
          // Reset to a valid status
          await this.hummingbotService.updateStrategyStatus(strategyId, 'error');
          return true;

        default:
          this.logger.warn(`No correction available for inconsistency type: ${inconsistency.type}`);
          return false;
      }

      return false;
    } catch (error) {
      this.logger.error(`Failed to apply correction for ${inconsistency.type}`, error);
      return false;
    }
  }

  /**
   * Get required parameters for strategy type
   */
  private getRequiredParameters(strategyType: string): string[] {
    const parameterMap: Record<string, string[]> = {
      'pure_market_making': ['bid_spread', 'ask_spread', 'order_amount'],
      'cross_exchange_market_making': ['min_profitability', 'order_amount'],
      'arbitrage': ['min_profitability'],
      'grid_trading': ['grid_price_ceiling', 'grid_price_floor', 'grid_price_step']
    };

    return parameterMap[strategyType] || [];
  }

  /**
   * Get parameter validations for strategy type
   */
  private getParameterValidations(strategyType: string): Record<string, {
    isValid: (value: any) => boolean;
    description: string;
  }> {
    return {
      'bid_spread': {
        isValid: (value) => typeof value === 'number' && value > 0 && value < 1,
        description: 'Should be a positive number less than 1'
      },
      'ask_spread': {
        isValid: (value) => typeof value === 'number' && value > 0 && value < 1,
        description: 'Should be a positive number less than 1'
      },
      'order_amount': {
        isValid: (value) => typeof value === 'number' && value > 0,
        description: 'Should be a positive number'
      },
      'min_profitability': {
        isValid: (value) => typeof value === 'number' && value > 0,
        description: 'Should be a positive number'
      }
    };
  }

  /**
   * Get default parameter value
   */
  private getDefaultParameterValue(parameterPath: string): any {
    const defaults: Record<string, any> = {
      'parameters.bid_spread': 0.001,
      'parameters.ask_spread': 0.001,
      'parameters.order_amount': 0.01,
      'parameters.min_profitability': 0.001
    };

    return defaults[parameterPath];
  }

  /**
   * Start periodic consistency checks
   */
  private startPeriodicChecks(): void {
    if (this.config.periodicCheckIntervalMs > 0) {
      this.checkTimer = setInterval(async () => {
        try {
          await this.performConsistencyCheck();
        } catch (error) {
          this.logger.error('Periodic consistency check failed', error);
        }
      }, this.config.periodicCheckIntervalMs);

      this.logger.info(`Started periodic consistency checks every ${this.config.periodicCheckIntervalMs}ms`);
    }
  }

  /**
   * Stop periodic checks
   */
  stopPeriodicChecks(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
      this.logger.info('Stopped periodic consistency checks');
    }
  }

  /**
   * Get consistency metrics
   */
  getMetrics(): ConsistencyMetrics {
    return { ...this.metrics };
  }

  /**
   * Force consistency check for specific strategy
   */
  async forceCheck(strategyId: string): Promise<CheckResult> {
    try {
      const strategy = await this.hummingbotService.getStrategyExecution(strategyId);
      
      if (!strategy) {
        throw new Error(`Strategy ${strategyId} not found`);
      }

      return await this.checkStrategyConsistency(strategy);
    } catch (error) {
      this.logger.error(`Force consistency check failed for strategy ${strategyId}`, error);
      
      return {
        strategyId,
        isConsistent: false,
        inconsistencies: [{
          type: 'check_error',
          severity: 'high',
          description: `Force check failed: ${error.message}`,
          affectedData: 'strategy',
          detectedAt: Date.now()
        }],
        checkTime: 0,
        correctionApplied: false
      };
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopPeriodicChecks();
    this.checksInProgress.clear();
    this.removeAllListeners();
    
    this.logger.info('Data consistency checker cleaned up');
  }
}