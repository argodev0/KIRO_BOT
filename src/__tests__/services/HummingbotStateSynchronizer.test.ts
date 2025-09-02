import { HummingbotStateSynchronizer } from '../../services/HummingbotStateSynchronizer';
import { HummingbotBridgeService } from '../../services/HummingbotBridgeService';
import { SynchronizationConfig, StrategyExecution, StrategyState } from '../../types/hummingbot';

describe('HummingbotStateSynchronizer', () => {
  let stateSynchronizer: HummingbotStateSynchronizer;
  let mockHummingbotService: jest.Mocked<HummingbotBridgeService>;

  const config: SynchronizationConfig = {
    periodicSyncIntervalMs: 0, // Disable periodic sync for tests
    pnlToleranceThreshold: 0.01,
    tradeCountToleranceThreshold: 1,
    timestampToleranceMs: 5000,
    parameterToleranceThreshold: 0.001
  };

  const mockStrategy: StrategyExecution = {
    id: 'strategy-1',
    strategyType: 'pure_market_making',
    instanceId: 'instance-1',
    status: 'active',
    startTime: Date.now() - 60000,
    parameters: {
      bid_spread: 0.001,
      ask_spread: 0.001,
      order_amount: 0.01
    },
    performance: {
      totalTrades: 10,
      successfulTrades: 8,
      totalVolume: 0.1,
      totalPnL: 0.05,
      averageLatency: 100,
      averageSlippage: 0.001,
      fillRate: 0.8,
      maxDrawdown: 0.02,
      currentDrawdown: 0.01,
      profitFactor: 1.5,
      sharpeRatio: 1.2,
      winRate: 0.8
    },
    orders: [],
    trades: [],
    errors: []
  };

  beforeEach(() => {
    mockHummingbotService = {
      // Mock methods that would exist in a real implementation
      // For now, we'll mock the basic interface
    } as any;

    stateSynchronizer = new HummingbotStateSynchronizer(mockHummingbotService, config);
  });

  afterEach(() => {
    stateSynchronizer.cleanup();
  });

  describe('synchronizeAll', () => {
    it('should synchronize all strategies successfully', async () => {
      // Arrange
      mockHummingbotService.getActiveStrategies.mockResolvedValue([mockStrategy]);

      // Act
      const result = await stateSynchronizer.synchronizeAll();

      // Assert
      expect(result.success).toBe(true);
      expect(result.strategiesSynced).toBe(1);
      expect(result.inconsistenciesFound).toBe(0);
      expect(mockHummingbotService.getActiveStrategies).toHaveBeenCalledTimes(1);

      const localState = stateSynchronizer.getLocalState('strategy-1');
      expect(localState).toBeDefined();
      expect(localState?.status).toBe('active');
    });

    it('should detect and resolve inconsistencies', async () => {
      // Arrange
      const inconsistentStrategy = {
        ...mockStrategy,
        status: 'paused',
        performance: {
          ...mockStrategy.performance,
          totalPnL: 0.1 // Different from local state
        }
      };

      // Set up local state with different values
      const localState: StrategyState = {
        id: 'strategy-1',
        status: 'active',
        parameters: mockStrategy.parameters,
        performance: mockStrategy.performance,
        startTime: mockStrategy.startTime,
        lastUpdate: Date.now() - 30000,
        version: 1
      };

      (stateSynchronizer as any).localStrategyStates.set('strategy-1', localState);

      mockHummingbotService.getActiveStrategies.mockResolvedValue([inconsistentStrategy]);
      mockHummingbotService.getStrategyExecution.mockResolvedValue(inconsistentStrategy);

      // Act
      const result = await stateSynchronizer.synchronizeAll();

      // Assert
      expect(result.success).toBe(true);
      expect(result.inconsistenciesFound).toBeGreaterThan(0);
      expect(result.inconsistenciesResolved).toBe(result.inconsistenciesFound);

      const updatedLocalState = stateSynchronizer.getLocalState('strategy-1');
      expect(updatedLocalState?.status).toBe('paused');
      expect(updatedLocalState?.performance.totalPnL).toBe(0.1);
    });

    it('should handle synchronization failures', async () => {
      // Arrange
      mockHummingbotService.getActiveStrategies.mockRejectedValue(new Error('API connection failed'));

      // Act
      const result = await stateSynchronizer.synchronizeAll();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.strategiesSynced).toBe(0);
    });

    it('should skip strategies already being synchronized', async () => {
      // Arrange
      mockHummingbotService.getActiveStrategies.mockResolvedValue([mockStrategy, mockStrategy]);
      
      // Simulate one strategy already in progress
      (stateSynchronizer as any).syncInProgress.add('strategy-1');

      // Act
      const result = await stateSynchronizer.synchronizeAll();

      // Assert
      expect(result.success).toBe(true);
      expect(result.strategiesSynced).toBe(1); // Only one should be processed
    });
  });

  describe('synchronizeStrategy', () => {
    it('should create local state for new strategy', async () => {
      // Act
      const result = await stateSynchronizer.synchronizeStrategy(mockStrategy);

      // Assert
      expect(result.inconsistencies).toHaveLength(0);
      expect(result.resolved).toBe(true);

      const localState = stateSynchronizer.getLocalState('strategy-1');
      expect(localState).toBeDefined();
      expect(localState?.id).toBe('strategy-1');
      expect(localState?.status).toBe('active');
    });

    it('should detect status inconsistencies', async () => {
      // Arrange
      const localState: StrategyState = {
        id: 'strategy-1',
        status: 'paused', // Different from remote
        parameters: mockStrategy.parameters,
        performance: mockStrategy.performance,
        startTime: mockStrategy.startTime,
        lastUpdate: Date.now(),
        version: 1
      };

      (stateSynchronizer as any).localStrategyStates.set('strategy-1', localState);

      // Act
      const result = await stateSynchronizer.synchronizeStrategy(mockStrategy);

      // Assert
      expect(result.inconsistencies).toHaveLength(1);
      expect(result.inconsistencies[0].type).toBe('status_mismatch');
      expect(result.inconsistencies[0].localValue).toBe('paused');
      expect(result.inconsistencies[0].remoteValue).toBe('active');
    });

    it('should detect PnL inconsistencies', async () => {
      // Arrange
      const localState: StrategyState = {
        id: 'strategy-1',
        status: 'active',
        parameters: mockStrategy.parameters,
        performance: {
          ...mockStrategy.performance,
          totalPnL: 0.1 // Significant difference
        },
        startTime: mockStrategy.startTime,
        lastUpdate: Date.now(),
        version: 1
      };

      (stateSynchronizer as any).localStrategyStates.set('strategy-1', localState);

      // Act
      const result = await stateSynchronizer.synchronizeStrategy(mockStrategy);

      // Assert
      expect(result.inconsistencies).toHaveLength(1);
      expect(result.inconsistencies[0].type).toBe('pnl_mismatch');
    });

    it('should detect parameter inconsistencies', async () => {
      // Arrange
      const localState: StrategyState = {
        id: 'strategy-1',
        status: 'active',
        parameters: {
          bid_spread: 0.002, // Different value
          ask_spread: 0.001,
          // Missing order_amount parameter
        },
        performance: mockStrategy.performance,
        startTime: mockStrategy.startTime,
        lastUpdate: Date.now(),
        version: 1
      };

      (stateSynchronizer as any).localStrategyStates.set('strategy-1', localState);

      // Act
      const result = await stateSynchronizer.synchronizeStrategy(mockStrategy);

      // Assert
      expect(result.inconsistencies.length).toBeGreaterThan(0);
      
      const parameterInconsistencies = result.inconsistencies.filter(i => 
        i.type === 'parameter_mismatch' || i.type === 'parameter_missing'
      );
      expect(parameterInconsistencies.length).toBeGreaterThan(0);
    });
  });

  describe('inconsistency resolution', () => {
    it('should resolve inconsistencies using authoritative remote data', async () => {
      // Arrange
      const localState: StrategyState = {
        id: 'strategy-1',
        status: 'paused',
        parameters: { bid_spread: 0.002 },
        performance: { ...mockStrategy.performance, totalPnL: 0.1 },
        startTime: mockStrategy.startTime,
        lastUpdate: Date.now(),
        version: 1
      };

      (stateSynchronizer as any).localStrategyStates.set('strategy-1', localState);

      mockHummingbotService.getStrategyExecution.mockResolvedValue(mockStrategy);

      const inconsistencies = [
        {
          type: 'status_mismatch' as const,
          strategyId: 'strategy-1',
          localValue: 'paused',
          remoteValue: 'active',
          severity: 'high' as const,
          description: 'Status mismatch'
        }
      ];

      // Act
      const resolved = await (stateSynchronizer as any).resolveInconsistencies('strategy-1', inconsistencies);

      // Assert
      expect(resolved).toBe(true);
      
      const updatedState = stateSynchronizer.getLocalState('strategy-1');
      expect(updatedState?.status).toBe('active');
      expect(updatedState?.version).toBe(2); // Version should increment
    });

    it('should handle resolution failures', async () => {
      // Arrange
      mockHummingbotService.getStrategyExecution.mockRejectedValue(new Error('Strategy not found'));

      const inconsistencies = [
        {
          type: 'status_mismatch' as const,
          strategyId: 'strategy-1',
          localValue: 'paused',
          remoteValue: 'active',
          severity: 'high' as const,
          description: 'Status mismatch'
        }
      ];

      // Act
      const resolved = await (stateSynchronizer as any).resolveInconsistencies('strategy-1', inconsistencies);

      // Assert
      expect(resolved).toBe(false);
    });
  });

  describe('parameter value comparison', () => {
    it('should handle numeric parameter comparison with tolerance', () => {
      // Act & Assert
      expect((stateSynchronizer as any).areParameterValuesEqual(0.001, 0.0011)).toBe(true); // Within tolerance
      expect((stateSynchronizer as any).areParameterValuesEqual(0.001, 0.002)).toBe(false); // Outside tolerance
    });

    it('should handle non-numeric parameter comparison', () => {
      // Act & Assert
      expect((stateSynchronizer as any).areParameterValuesEqual('test', 'test')).toBe(true);
      expect((stateSynchronizer as any).areParameterValuesEqual('test1', 'test2')).toBe(false);
      expect((stateSynchronizer as any).areParameterValuesEqual({ a: 1 }, { a: 1 })).toBe(true);
      expect((stateSynchronizer as any).areParameterValuesEqual({ a: 1 }, { a: 2 })).toBe(false);
    });
  });

  describe('force synchronization', () => {
    it('should force synchronization for specific strategy', async () => {
      // Arrange
      mockHummingbotService.getStrategyExecution.mockResolvedValue(mockStrategy);

      // Act
      const result = await stateSynchronizer.forceSynchronization('strategy-1');

      // Assert
      expect(result).toBe(true);
      expect(mockHummingbotService.getStrategyExecution).toHaveBeenCalledWith('strategy-1');

      const localState = stateSynchronizer.getLocalState('strategy-1');
      expect(localState).toBeDefined();
    });

    it('should handle force synchronization failures', async () => {
      // Arrange
      mockHummingbotService.getStrategyExecution.mockRejectedValue(new Error('Strategy not found'));

      // Act
      const result = await stateSynchronizer.forceSynchronization('strategy-1');

      // Assert
      expect(result).toBe(false);
    });

    it('should handle missing remote strategy', async () => {
      // Arrange
      mockHummingbotService.getStrategyExecution.mockResolvedValue(null);

      // Act
      const result = await stateSynchronizer.forceSynchronization('strategy-1');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('local state management', () => {
    it('should manage local states correctly', () => {
      // Arrange
      const localState: StrategyState = {
        id: 'strategy-1',
        status: 'active',
        parameters: {},
        performance: mockStrategy.performance,
        startTime: Date.now(),
        lastUpdate: Date.now(),
        version: 1
      };

      // Act
      (stateSynchronizer as any).localStrategyStates.set('strategy-1', localState);

      // Assert
      expect(stateSynchronizer.getLocalState('strategy-1')).toEqual(localState);
      
      const allStates = stateSynchronizer.getAllLocalStates();
      expect(allStates.size).toBe(1);
      expect(allStates.get('strategy-1')).toEqual(localState);

      const removed = stateSynchronizer.removeLocalState('strategy-1');
      expect(removed).toBe(true);
      expect(stateSynchronizer.getLocalState('strategy-1')).toBeUndefined();
    });
  });

  describe('metrics tracking', () => {
    it('should track synchronization metrics', async () => {
      // Arrange
      mockHummingbotService.getActiveStrategies.mockResolvedValue([mockStrategy]);

      // Act
      await stateSynchronizer.synchronizeAll();
      await stateSynchronizer.synchronizeAll();

      // Assert
      const metrics = stateSynchronizer.getMetrics();
      expect(metrics.totalSyncs).toBe(2);
      expect(metrics.successfulSyncs).toBe(2);
      expect(metrics.averageSyncTime).toBeGreaterThan(0);
      expect(metrics.lastSyncTime).toBeDefined();
    });

    it('should track failed synchronizations', async () => {
      // Arrange
      mockHummingbotService.getActiveStrategies.mockRejectedValue(new Error('Connection failed'));

      // Act
      await stateSynchronizer.synchronizeAll();

      // Assert
      const metrics = stateSynchronizer.getMetrics();
      expect(metrics.totalSyncs).toBe(1);
      expect(metrics.failedSyncs).toBe(1);
      expect(metrics.successfulSyncs).toBe(0);
    });
  });

  describe('event emission', () => {
    it('should emit synchronization events', async () => {
      // Arrange
      const completedSpy = jest.fn();
      const stateUpdatedSpy = jest.fn();

      stateSynchronizer.on('synchronization-completed', completedSpy);
      stateSynchronizer.on('state-updated', stateUpdatedSpy);

      mockHummingbotService.getActiveStrategies.mockResolvedValue([mockStrategy]);

      // Act
      await stateSynchronizer.synchronizeAll();

      // Assert
      expect(completedSpy).toHaveBeenCalled();
      expect(stateUpdatedSpy).toHaveBeenCalled();
    });

    it('should emit inconsistency resolution events', async () => {
      // Arrange
      const resolvedSpy = jest.fn();
      stateSynchronizer.on('inconsistencies-resolved', resolvedSpy);

      const localState: StrategyState = {
        id: 'strategy-1',
        status: 'paused',
        parameters: mockStrategy.parameters,
        performance: mockStrategy.performance,
        startTime: mockStrategy.startTime,
        lastUpdate: Date.now(),
        version: 1
      };

      (stateSynchronizer as any).localStrategyStates.set('strategy-1', localState);

      mockHummingbotService.getActiveStrategies.mockResolvedValue([mockStrategy]);
      mockHummingbotService.getStrategyExecution.mockResolvedValue(mockStrategy);

      // Act
      await stateSynchronizer.synchronizeAll();

      // Assert
      expect(resolvedSpy).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources properly', () => {
      // Arrange
      const listenerCount = stateSynchronizer.listenerCount('synchronization-completed');

      // Act
      stateSynchronizer.cleanup();

      // Assert
      expect(stateSynchronizer.listenerCount('synchronization-completed')).toBe(0);
      expect(stateSynchronizer.getAllLocalStates().size).toBe(0);
    });
  });
});