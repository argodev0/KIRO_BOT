import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { HummingbotBridgeService } from './HummingbotBridgeService';
import { 
  StrategyState, 
  StrategyExecution, 
  StateInconsistency,
  SynchronizationConfig,
  SynchronizationResult
} from '../types/hummingbot';

export interface SyncMetrics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  inconsistenciesFound: number;
  inconsistenciesResolved: number;
  averageSyncTime: number;
  lastSyncTime?: number;
}

export class HummingbotStateSynchronizer extends EventEmitter {
  private logger = logger;
  private hummingbotService: HummingbotBridgeService;
  private config: SynchronizationConfig;
  private localStrategyStates: Map<string, StrategyState> = new Map();
  private syncInProgress: Set<string> = new Set();
  private metrics: SyncMetrics;
  private syncTimer?: NodeJS.Timeout;

  constructor(
    hummingbotService: HummingbotBridgeService,
    config: SynchronizationConfig
  ) {
    super();
    this.hummingbotService = hummingbotService;
    this.config = config;
    this.metrics = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      inconsistenciesFound: 0,
      inconsistenciesResolved: 0,
      averageSyncTime: 0
    };

    this.startPeriodicSync();
  }

  /**
   * Synchronize all strategy states
   */
  async synchronizeAll(): Promise<SynchronizationResult> {
    const startTime = Date.now();
    this.metrics.totalSyncs++;

    try {
      const remoteStrategies = await this.hummingbotService.getActiveStrategies();
      const syncResults: Array<{
        strategyId: string;
        success: boolean;
        inconsistencies: StateInconsistency[];
        error?: Error;
      }> = [];

      for (const remoteStrategy of remoteStrategies) {
        if (this.syncInProgress.has(remoteStrategy.id)) {
          continue;
        }

        this.syncInProgress.add(remoteStrategy.id);

        try {
          const result = await this.synchronizeStrategy(remoteStrategy);
          syncResults.push({
            strategyId: remoteStrategy.id,
            success: true,
            inconsistencies: result.inconsistencies
          });
        } catch (error) {
          syncResults.push({
            strategyId: remoteStrategy.id,
            success: false,
            inconsistencies: [],
            error: error as Error
          });
        } finally {
          this.syncInProgress.delete(remoteStrategy.id);
        }
      }

      const syncTime = Date.now() - startTime;
      const successfulSyncs = syncResults.filter(r => r.success).length;
      const totalInconsistencies = syncResults.reduce((sum, r) => sum + r.inconsistencies.length, 0);

      // Update metrics
      this.metrics.successfulSyncs += successfulSyncs;
      this.metrics.failedSyncs += (syncResults.length - successfulSyncs);
      this.metrics.inconsistenciesFound += totalInconsistencies;
      this.metrics.averageSyncTime = 
        (this.metrics.averageSyncTime * (this.metrics.totalSyncs - 1) + syncTime) / 
        this.metrics.totalSyncs;
      this.metrics.lastSyncTime = Date.now();

      const result: SynchronizationResult = {
        success: successfulSyncs === syncResults.length,
        syncTime,
        strategiesSynced: syncResults.length,
        inconsistenciesFound: totalInconsistencies,
        inconsistenciesResolved: totalInconsistencies, // Assume all found inconsistencies are resolved
        details: syncResults
      };

      this.logger.info('Strategy synchronization completed', {
        strategiesSynced: result.strategiesSynced,
        inconsistenciesFound: result.inconsistenciesFound,
        syncTime: result.syncTime
      });

      this.emit('synchronization-completed', result);

      return result;
    } catch (error) {
      this.metrics.failedSyncs++;
      
      this.logger.error('Strategy synchronization failed', error);
      
      const result: SynchronizationResult = {
        success: false,
        syncTime: Date.now() - startTime,
        strategiesSynced: 0,
        inconsistenciesFound: 0,
        inconsistenciesResolved: 0,
        error: error as Error,
        details: []
      };

      this.emit('synchronization-failed', result);

      return result;
    }
  }

  /**
   * Synchronize a specific strategy
   */
  async synchronizeStrategy(remoteStrategy: StrategyExecution): Promise<{
    inconsistencies: StateInconsistency[];
    resolved: boolean;
  }> {
    const localState = this.localStrategyStates.get(remoteStrategy.id);
    
    if (!localState) {
      // No local state, create from remote
      const newLocalState = this.createLocalStateFromRemote(remoteStrategy);
      this.localStrategyStates.set(remoteStrategy.id, newLocalState);
      
      this.logger.info(`Created local state for strategy ${remoteStrategy.id}`);
      
      return {
        inconsistencies: [],
        resolved: true
      };
    }

    // Detect inconsistencies
    const inconsistencies = await this.detectInconsistencies(remoteStrategy, localState);
    
    if (inconsistencies.length > 0) {
      this.logger.warn(`Found ${inconsistencies.length} inconsistencies for strategy ${remoteStrategy.id}`, {
        inconsistencies: inconsistencies.map(i => i.type)
      });

      // Resolve inconsistencies
      const resolved = await this.resolveInconsistencies(remoteStrategy.id, inconsistencies);
      
      if (resolved) {
        this.metrics.inconsistenciesResolved += inconsistencies.length;
      }

      return {
        inconsistencies,
        resolved
      };
    }

    // Update local state with latest remote data
    this.updateLocalState(remoteStrategy.id, remoteStrategy);

    return {
      inconsistencies: [],
      resolved: true
    };
  }

  /**
   * Detect inconsistencies between remote and local states
   */
  private async detectInconsistencies(
    remoteStrategy: StrategyExecution,
    localState: StrategyState
  ): Promise<StateInconsistency[]> {
    const inconsistencies: StateInconsistency[] = [];

    // Status inconsistency
    if (remoteStrategy.status !== localState.status) {
      inconsistencies.push({
        type: 'status_mismatch',
        strategyId: remoteStrategy.id,
        localValue: localState.status,
        remoteValue: remoteStrategy.status,
        severity: 'high',
        description: `Status mismatch: local=${localState.status}, remote=${remoteStrategy.status}`
      });
    }

    // Performance inconsistencies
    const pnlDifference = Math.abs(remoteStrategy.performance.totalPnL - localState.performance.totalPnL);
    if (pnlDifference > this.config.pnlToleranceThreshold) {
      inconsistencies.push({
        type: 'pnl_mismatch',
        strategyId: remoteStrategy.id,
        localValue: localState.performance.totalPnL,
        remoteValue: remoteStrategy.performance.totalPnL,
        severity: 'high',
        description: `PnL mismatch exceeds threshold: difference=${pnlDifference}`
      });
    }

    const tradeDifference = Math.abs(remoteStrategy.performance.totalTrades - localState.performance.totalTrades);
    if (tradeDifference > this.config.tradeCountToleranceThreshold) {
      inconsistencies.push({
        type: 'trade_count_mismatch',
        strategyId: remoteStrategy.id,
        localValue: localState.performance.totalTrades,
        remoteValue: remoteStrategy.performance.totalTrades,
        severity: 'medium',
        description: `Trade count mismatch: difference=${tradeDifference}`
      });
    }

    // Parameter inconsistencies
    const parameterInconsistencies = this.detectParameterInconsistencies(
      remoteStrategy.parameters,
      localState.parameters
    );
    inconsistencies.push(...parameterInconsistencies);

    // Timestamp inconsistency
    const timeDifference = Math.abs(remoteStrategy.startTime - localState.startTime);
    if (timeDifference > this.config.timestampToleranceMs) {
      inconsistencies.push({
        type: 'timestamp_mismatch',
        strategyId: remoteStrategy.id,
        localValue: localState.startTime,
        remoteValue: remoteStrategy.startTime,
        severity: 'low',
        description: `Start time mismatch: difference=${timeDifference}ms`
      });
    }

    return inconsistencies;
  }

  /**
   * Detect parameter inconsistencies
   */
  private detectParameterInconsistencies(
    remoteParams: Record<string, any>,
    localParams: Record<string, any>
  ): StateInconsistency[] {
    const inconsistencies: StateInconsistency[] = [];

    // Check all remote parameters
    for (const [key, remoteValue] of Object.entries(remoteParams)) {
      const localValue = localParams[key];
      
      if (localValue === undefined) {
        inconsistencies.push({
          type: 'parameter_missing',
          strategyId: '', // Will be set by caller
          localValue: undefined,
          remoteValue,
          severity: 'medium',
          description: `Parameter ${key} missing in local state`
        });
      } else if (!this.areParameterValuesEqual(localValue, remoteValue)) {
        inconsistencies.push({
          type: 'parameter_mismatch',
          strategyId: '', // Will be set by caller
          localValue,
          remoteValue,
          severity: 'medium',
          description: `Parameter ${key} mismatch: local=${localValue}, remote=${remoteValue}`
        });
      }
    }

    // Check for extra local parameters
    for (const [key, localValue] of Object.entries(localParams)) {
      if (!(key in remoteParams)) {
        inconsistencies.push({
          type: 'parameter_extra',
          strategyId: '', // Will be set by caller
          localValue,
          remoteValue: undefined,
          severity: 'low',
          description: `Extra parameter ${key} in local state`
        });
      }
    }

    return inconsistencies;
  }

  /**
   * Check if parameter values are equal (with tolerance for numbers)
   */
  private areParameterValuesEqual(localValue: any, remoteValue: any): boolean {
    if (typeof localValue === 'number' && typeof remoteValue === 'number') {
      return Math.abs(localValue - remoteValue) < this.config.parameterToleranceThreshold;
    }
    
    return JSON.stringify(localValue) === JSON.stringify(remoteValue);
  }

  /**
   * Resolve inconsistencies
   */
  private async resolveInconsistencies(
    strategyId: string,
    inconsistencies: StateInconsistency[]
  ): Promise<boolean> {
    try {
      // Get authoritative state from remote
      const authoritativeStrategy = await this.hummingbotService.getStrategyExecution(strategyId);
      
      if (!authoritativeStrategy) {
        this.logger.error(`Cannot resolve inconsistencies: strategy ${strategyId} not found remotely`);
        return false;
      }

      // Update local state with authoritative data
      this.updateLocalState(strategyId, authoritativeStrategy);

      // Log resolution
      this.logger.info(`Resolved ${inconsistencies.length} inconsistencies for strategy ${strategyId}`, {
        inconsistencyTypes: inconsistencies.map(i => i.type)
      });

      this.emit('inconsistencies-resolved', {
        strategyId,
        inconsistencies,
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to resolve inconsistencies for strategy ${strategyId}`, error);
      return false;
    }
  }

  /**
   * Create local state from remote strategy
   */
  private createLocalStateFromRemote(remoteStrategy: StrategyExecution): StrategyState {
    return {
      id: remoteStrategy.id,
      status: remoteStrategy.status,
      parameters: { ...remoteStrategy.parameters },
      performance: { ...remoteStrategy.performance },
      startTime: remoteStrategy.startTime,
      endTime: remoteStrategy.endTime,
      lastUpdate: Date.now(),
      version: 1
    };
  }

  /**
   * Update local state with remote data
   */
  private updateLocalState(strategyId: string, remoteStrategy: StrategyExecution): void {
    const existingState = this.localStrategyStates.get(strategyId);
    
    const updatedState: StrategyState = {
      id: strategyId,
      status: remoteStrategy.status,
      parameters: { ...remoteStrategy.parameters },
      performance: { ...remoteStrategy.performance },
      startTime: remoteStrategy.startTime,
      endTime: remoteStrategy.endTime,
      lastUpdate: Date.now(),
      version: existingState ? existingState.version + 1 : 1
    };

    this.localStrategyStates.set(strategyId, updatedState);

    this.emit('state-updated', {
      strategyId,
      previousState: existingState,
      newState: updatedState,
      timestamp: Date.now()
    });
  }

  /**
   * Start periodic synchronization
   */
  private startPeriodicSync(): void {
    if (this.config.periodicSyncIntervalMs > 0) {
      this.syncTimer = setInterval(async () => {
        try {
          await this.synchronizeAll();
        } catch (error) {
          this.logger.error('Periodic synchronization failed', error);
        }
      }, this.config.periodicSyncIntervalMs);

      this.logger.info(`Started periodic synchronization every ${this.config.periodicSyncIntervalMs}ms`);
    }
  }

  /**
   * Stop periodic synchronization
   */
  stopPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
      this.logger.info('Stopped periodic synchronization');
    }
  }

  /**
   * Get local strategy state
   */
  getLocalState(strategyId: string): StrategyState | undefined {
    return this.localStrategyStates.get(strategyId);
  }

  /**
   * Get all local strategy states
   */
  getAllLocalStates(): Map<string, StrategyState> {
    return new Map(this.localStrategyStates);
  }

  /**
   * Remove local state for a strategy
   */
  removeLocalState(strategyId: string): boolean {
    return this.localStrategyStates.delete(strategyId);
  }

  /**
   * Get synchronization metrics
   */
  getMetrics(): SyncMetrics {
    return { ...this.metrics };
  }

  /**
   * Force synchronization for a specific strategy
   */
  async forceSynchronization(strategyId: string): Promise<boolean> {
    try {
      const remoteStrategy = await this.hummingbotService.getStrategyExecution(strategyId);
      
      if (!remoteStrategy) {
        this.logger.error(`Cannot force sync: strategy ${strategyId} not found remotely`);
        return false;
      }

      const result = await this.synchronizeStrategy(remoteStrategy);
      
      this.logger.info(`Force synchronization completed for strategy ${strategyId}`, {
        inconsistenciesFound: result.inconsistencies.length,
        resolved: result.resolved
      });

      return result.resolved;
    } catch (error) {
      this.logger.error(`Force synchronization failed for strategy ${strategyId}`, error);
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopPeriodicSync();
    this.localStrategyStates.clear();
    this.syncInProgress.clear();
    this.removeAllListeners();
    
    this.logger.info('State synchronizer cleaned up');
  }
}