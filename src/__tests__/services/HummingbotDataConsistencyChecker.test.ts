import { HummingbotDataConsistencyChecker } from '../../services/HummingbotDataConsistencyChecker';
import { HummingbotBridgeService } from '../../services/HummingbotBridgeService';
import { DataConsistencyConfig, StrategyExecution } from '../../types/hummingbot';

describe('HummingbotDataConsistencyChecker', () => {
  let consistencyChecker: HummingbotDataConsistencyChecker;
  let mockHummingbotService: jest.Mocked<HummingbotBridgeService>;

  const config: DataConsistencyConfig = {
    periodicCheckIntervalMs: 0, // Disable periodic checks for tests
    autoCorrect: true
  };

  const validStrategy: StrategyExecution = {
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

    consistencyChecker = new HummingbotDataConsistencyChecker(mockHummingbotService, config);
  });

  afterEach(() => {
    consistencyChecker.cleanup();
  });

  describe('performConsistencyCheck', () => {
    it('should pass consistency check for valid strategies', async () => {
      // Arrange
      mockHummingbotService.getActiveStrategies.mockResolvedValue([validStrategy]);

      // Act
      const result = await consistencyChecker.performConsistencyCheck();

      // Assert
      expect(result.success).toBe(true);
      expect(result.strategiesChecked).toBe(1);
      expect(result.inconsistenciesFound).toBe(0);
      expect(result.inconsistenciesResolved).toBe(0);
    });

    it('should detect and resolve inconsistencies', async () => {
      // Arrange
      const inconsistentStrategy: StrategyExecution = {
        ...validStrategy,
        performance: {
          ...validStrategy.performance,
          totalTrades: 5,
          successfulTrades: 10, // Inconsistent: successful > total
          fillRate: 1.5, // Invalid: > 1
          averageLatency: -50 // Invalid: negative
        },
        parameters: {
          bid_spread: 0.001,
          ask_spread: 0.001
          // Missing required order_amount
        }
      };

      mockHummingbotService.getActiveStrategies.mockResolvedValue([inconsistentStrategy]);
      mockHummingbotService.updateStrategyPerformance.mockResolvedValue(true);
      mockHummingbotService.updateStrategyParameter.mockResolvedValue(true);

      // Act
      const result = await consistencyChecker.performConsistencyCheck();

      // Assert
      expect(result.success).toBe(false); // Should be false due to inconsistencies
      expect(result.inconsistenciesFound).toBeGreaterThan(0);
      expect(result.inconsistenciesResolved).toBeGreaterThan(0);
      
      // Verify corrections were attempted
      expect(mockHummingbotService.updateStrategyPerformance).toHaveBeenCalled();
      expect(mockHummingbotService.updateStrategyParameter).toHaveBeenCalled();
    });

    it('should handle consistency check failures', async () => {
      // Arrange
      mockHummingbotService.getActiveStrategies.mockRejectedValue(new Error('Database connection failed'));

      // Act
      const result = await consistencyChecker.performConsistencyCheck();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.strategiesChecked).toBe(0);
    });
  });

  describe('checkStrategyConsistency', () => {
    it('should detect performance logic errors', async () => {
      // Arrange
      const inconsistentStrategy: StrategyExecution = {
        ...validStrategy,
        performance: {
          ...validStrategy.performance,
          totalTrades: 5,
          successfulTrades: 10 // More successful than total
        }
      };

      // Act
      const result = await consistencyChecker.checkStrategyConsistency(inconsistentStrategy);

      // Assert
      expect(result.isConsistent).toBe(false);
      expect(result.inconsistencies).toHaveLength(1);
      expect(result.inconsistencies[0].type).toBe('performance_logic_error');
      expect(result.inconsistencies[0].severity).toBe('high');
    });

    it('should detect invalid fill rates', async () => {
      // Arrange
      const inconsistentStrategy: StrategyExecution = {
        ...validStrategy,
        performance: {
          ...validStrategy.performance,
          fillRate: 1.5 // Invalid: > 1
        }
      };

      // Act
      const result = await consistencyChecker.checkStrategyConsistency(inconsistentStrategy);

      // Assert
      expect(result.isConsistent).toBe(false);
      const fillRateError = result.inconsistencies.find(i => i.type === 'performance_fillrate_error');
      expect(fillRateError).toBeDefined();
      expect(fillRateError?.severity).toBe('medium');
    });

    it('should detect missing required parameters', async () => {
      // Arrange
      const inconsistentStrategy: StrategyExecution = {
        ...validStrategy,
        parameters: {
          bid_spread: 0.001
          // Missing ask_spread and order_amount
        }
      };

      // Act
      const result = await consistencyChecker.checkStrategyConsistency(inconsistentStrategy);

      // Assert
      expect(result.isConsistent).toBe(false);
      const missingParams = result.inconsistencies.filter(i => i.type === 'parameter_missing');
      expect(missingParams.length).toBeGreaterThan(0);
    });

    it('should detect invalid parameter values', async () => {
      // Arrange
      const inconsistentStrategy: StrategyExecution = {
        ...validStrategy,
        parameters: {
          bid_spread: -0.001, // Invalid: negative
          ask_spread: 2.0, // Invalid: > 1
          order_amount: 0 // Invalid: zero
        }
      };

      // Act
      const result = await consistencyChecker.checkStrategyConsistency(inconsistentStrategy);

      // Assert
      expect(result.isConsistent).toBe(false);
      const invalidParams = result.inconsistencies.filter(i => i.type === 'parameter_invalid_value');
      expect(invalidParams.length).toBeGreaterThan(0);
    });

    it('should detect invalid strategy status', async () => {
      // Arrange
      const inconsistentStrategy: StrategyExecution = {
        ...validStrategy,
        status: 'invalid_status' as any
      };

      // Act
      const result = await consistencyChecker.checkStrategyConsistency(inconsistentStrategy);

      // Assert
      expect(result.isConsistent).toBe(false);
      const statusError = result.inconsistencies.find(i => i.type === 'execution_invalid_status');
      expect(statusError).toBeDefined();
      expect(statusError?.severity).toBe('high');
    });

    it('should detect timestamp inconsistencies', async () => {
      // Arrange
      const futureTime = Date.now() + 60000;
      const inconsistentStrategy: StrategyExecution = {
        ...validStrategy,
        startTime: futureTime, // Future timestamp
        endTime: Date.now() - 120000 // End before start
      };

      // Act
      const result = await consistencyChecker.checkStrategyConsistency(inconsistentStrategy);

      // Assert
      expect(result.isConsistent).toBe(false);
      const timestampErrors = result.inconsistencies.filter(i => 
        i.type === 'timestamp_future_start' || i.type === 'timestamp_end_before_start'
      );
      expect(timestampErrors.length).toBeGreaterThan(0);
    });

    it('should detect inactive strategy with no trades', async () => {
      // Arrange
      const inactiveStrategy: StrategyExecution = {
        ...validStrategy,
        startTime: Date.now() - 300000, // 5 minutes ago
        performance: {
          ...validStrategy.performance,
          totalTrades: 0 // No trades after running for 5 minutes
        }
      };

      // Act
      const result = await consistencyChecker.checkStrategyConsistency(inactiveStrategy);

      // Assert
      expect(result.isConsistent).toBe(false);
      const inactivityError = result.inconsistencies.find(i => i.type === 'execution_no_activity');
      expect(inactivityError).toBeDefined();
      expect(inactivityError?.severity).toBe('medium');
    });
  });

  describe('correction application', () => {
    it('should correct performance logic errors', async () => {
      // Arrange
      const inconsistentStrategy: StrategyExecution = {
        ...validStrategy,
        performance: {
          ...validStrategy.performance,
          totalTrades: 5,
          successfulTrades: 10
        }
      };

      mockHummingbotService.updateStrategyPerformance.mockResolvedValue(true);

      // Act
      const result = await consistencyChecker.checkStrategyConsistency(inconsistentStrategy);

      // Assert
      expect(result.correctionApplied).toBe(true);
      expect(mockHummingbotService.updateStrategyPerformance).toHaveBeenCalledWith(
        'strategy-1',
        { totalTrades: 10 }
      );
    });

    it('should correct invalid fill rates', async () => {
      // Arrange
      const inconsistentStrategy: StrategyExecution = {
        ...validStrategy,
        performance: {
          ...validStrategy.performance,
          fillRate: 1.5
        }
      };

      mockHummingbotService.updateStrategyPerformance.mockResolvedValue(true);

      // Act
      const result = await consistencyChecker.checkStrategyConsistency(inconsistentStrategy);

      // Assert
      expect(result.correctionApplied).toBe(true);
      expect(mockHummingbotService.updateStrategyPerformance).toHaveBeenCalledWith(
        'strategy-1',
        { fillRate: 1.0 } // Clamped to maximum valid value
      );
    });

    it('should add default values for missing parameters', async () => {
      // Arrange
      const inconsistentStrategy: StrategyExecution = {
        ...validStrategy,
        parameters: {
          bid_spread: 0.001
          // Missing ask_spread and order_amount
        }
      };

      mockHummingbotService.updateStrategyParameter.mockResolvedValue(true);

      // Act
      const result = await consistencyChecker.checkStrategyConsistency(inconsistentStrategy);

      // Assert
      expect(result.correctionApplied).toBe(true);
      expect(mockHummingbotService.updateStrategyParameter).toHaveBeenCalled();
    });

    it('should reset invalid status', async () => {
      // Arrange
      const inconsistentStrategy: StrategyExecution = {
        ...validStrategy,
        status: 'invalid_status' as any
      };

      mockHummingbotService.updateStrategyStatus.mockResolvedValue(true);

      // Act
      const result = await consistencyChecker.checkStrategyConsistency(inconsistentStrategy);

      // Assert
      expect(result.correctionApplied).toBe(true);
      expect(mockHummingbotService.updateStrategyStatus).toHaveBeenCalledWith(
        'strategy-1',
        'error'
      );
    });

    it('should handle correction failures gracefully', async () => {
      // Arrange
      const inconsistentStrategy: StrategyExecution = {
        ...validStrategy,
        performance: {
          ...validStrategy.performance,
          fillRate: 1.5
        }
      };

      mockHummingbotService.updateStrategyPerformance.mockRejectedValue(new Error('Update failed'));

      // Act
      const result = await consistencyChecker.checkStrategyConsistency(inconsistentStrategy);

      // Assert
      expect(result.correctionApplied).toBe(false);
    });
  });

  describe('force consistency check', () => {
    it('should perform force check for specific strategy', async () => {
      // Arrange
      mockHummingbotService.getStrategyExecution.mockResolvedValue(validStrategy);

      // Act
      const result = await consistencyChecker.forceCheck('strategy-1');

      // Assert
      expect(result.strategyId).toBe('strategy-1');
      expect(result.isConsistent).toBe(true);
      expect(mockHummingbotService.getStrategyExecution).toHaveBeenCalledWith('strategy-1');
    });

    it('should handle missing strategy in force check', async () => {
      // Arrange
      mockHummingbotService.getStrategyExecution.mockResolvedValue(null);

      // Act
      const result = await consistencyChecker.forceCheck('strategy-1');

      // Assert
      expect(result.strategyId).toBe('strategy-1');
      expect(result.isConsistent).toBe(false);
      expect(result.inconsistencies).toHaveLength(1);
      expect(result.inconsistencies[0].type).toBe('check_error');
    });

    it('should handle force check errors', async () => {
      // Arrange
      mockHummingbotService.getStrategyExecution.mockRejectedValue(new Error('Strategy not found'));

      // Act
      const result = await consistencyChecker.forceCheck('strategy-1');

      // Assert
      expect(result.strategyId).toBe('strategy-1');
      expect(result.isConsistent).toBe(false);
      expect(result.inconsistencies[0].description).toContain('Strategy not found');
    });
  });

  describe('parameter validation', () => {
    it('should get required parameters for strategy types', () => {
      // Act & Assert
      const pmmParams = (consistencyChecker as any).getRequiredParameters('pure_market_making');
      expect(pmmParams).toContain('bid_spread');
      expect(pmmParams).toContain('ask_spread');
      expect(pmmParams).toContain('order_amount');

      const arbitrageParams = (consistencyChecker as any).getRequiredParameters('arbitrage');
      expect(arbitrageParams).toContain('min_profitability');

      const unknownParams = (consistencyChecker as any).getRequiredParameters('unknown_strategy');
      expect(unknownParams).toEqual([]);
    });

    it('should validate parameter values correctly', () => {
      // Arrange
      const validations = (consistencyChecker as any).getParameterValidations('pure_market_making');

      // Act & Assert
      expect(validations.bid_spread.isValid(0.001)).toBe(true);
      expect(validations.bid_spread.isValid(-0.001)).toBe(false);
      expect(validations.bid_spread.isValid(2.0)).toBe(false);

      expect(validations.order_amount.isValid(0.01)).toBe(true);
      expect(validations.order_amount.isValid(0)).toBe(false);
      expect(validations.order_amount.isValid(-0.01)).toBe(false);
    });

    it('should provide default parameter values', () => {
      // Act & Assert
      expect((consistencyChecker as any).getDefaultParameterValue('parameters.bid_spread')).toBe(0.001);
      expect((consistencyChecker as any).getDefaultParameterValue('parameters.order_amount')).toBe(0.01);
      expect((consistencyChecker as any).getDefaultParameterValue('parameters.unknown')).toBeUndefined();
    });
  });

  describe('metrics tracking', () => {
    it('should track consistency check metrics', async () => {
      // Arrange
      mockHummingbotService.getActiveStrategies.mockResolvedValue([validStrategy]);

      // Act
      await consistencyChecker.performConsistencyCheck();
      await consistencyChecker.performConsistencyCheck();

      // Assert
      const metrics = consistencyChecker.getMetrics();
      expect(metrics.totalChecks).toBe(2);
      expect(metrics.averageCheckTime).toBeGreaterThan(0);
      expect(metrics.lastCheckTime).toBeDefined();
    });

    it('should track inconsistencies found and resolved', async () => {
      // Arrange
      const inconsistentStrategy: StrategyExecution = {
        ...validStrategy,
        performance: {
          ...validStrategy.performance,
          fillRate: 1.5
        }
      };

      mockHummingbotService.getActiveStrategies.mockResolvedValue([inconsistentStrategy]);
      mockHummingbotService.updateStrategyPerformance.mockResolvedValue(true);

      // Act
      await consistencyChecker.performConsistencyCheck();

      // Assert
      const metrics = consistencyChecker.getMetrics();
      expect(metrics.inconsistenciesFound).toBeGreaterThan(0);
      expect(metrics.inconsistenciesResolved).toBeGreaterThan(0);
    });
  });

  describe('event emission', () => {
    it('should emit consistency check events', async () => {
      // Arrange
      const completedSpy = jest.fn();
      const detectedSpy = jest.fn();
      const correctedSpy = jest.fn();

      consistencyChecker.on('consistency-check-completed', completedSpy);
      consistencyChecker.on('inconsistencies-detected', detectedSpy);
      consistencyChecker.on('corrections-applied', correctedSpy);

      const inconsistentStrategy: StrategyExecution = {
        ...validStrategy,
        performance: {
          ...validStrategy.performance,
          fillRate: 1.5
        }
      };

      mockHummingbotService.getActiveStrategies.mockResolvedValue([inconsistentStrategy]);
      mockHummingbotService.updateStrategyPerformance.mockResolvedValue(true);

      // Act
      await consistencyChecker.performConsistencyCheck();

      // Assert
      expect(completedSpy).toHaveBeenCalled();
      expect(detectedSpy).toHaveBeenCalled();
      expect(correctedSpy).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources properly', () => {
      // Arrange
      const listenerCount = consistencyChecker.listenerCount('consistency-check-completed');

      // Act
      consistencyChecker.cleanup();

      // Assert
      expect(consistencyChecker.listenerCount('consistency-check-completed')).toBe(0);
    });
  });
});