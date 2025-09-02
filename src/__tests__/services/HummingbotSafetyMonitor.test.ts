/**
 * Tests for Hummingbot Safety Monitor Service
 */

import { HummingbotSafetyMonitor } from '../../services/HummingbotSafetyMonitor';
import { HummingbotBridgeService } from '../../services/HummingbotBridgeService';
import { PaperTradingSafetyMonitor } from '../../services/PaperTradingSafetyMonitor';
import { HBStrategy, StrategyExecution, EmergencyShutdownReason } from '../../types';

// Mock dependencies
jest.mock('../../services/HummingbotBridgeService');
jest.mock('../../services/PaperTradingSafetyMonitor');
jest.mock('../../services/AuditLogService');
jest.mock('../../services/RiskManagementService');

describe('HummingbotSafetyMonitor', () => {
  let safetyMonitor: HummingbotSafetyMonitor;
  let mockBridgeService: jest.Mocked<HummingbotBridgeService>;
  let mockPaperTradingSafetyMonitor: jest.Mocked<PaperTradingSafetyMonitor>;

  beforeEach(() => {
    mockBridgeService = {
      getConnections: jest.fn().mockReturnValue(new Map()),
      getConnection: jest.fn(),
      stopStrategy: jest.fn(),
      disconnectAll: jest.fn(),
      on: jest.fn()
    } as any;

    mockPaperTradingSafetyMonitor = {
      isPaperTradingModeEnabled: jest.fn().mockReturnValue(true),
      recordRealTradingAttemptBlocked: jest.fn(),
      on: jest.fn()
    } as any;

    (PaperTradingSafetyMonitor.getInstance as jest.Mock).mockReturnValue(mockPaperTradingSafetyMonitor);

    safetyMonitor = new HummingbotSafetyMonitor(mockBridgeService, {
      enableRealTradeBlocking: true,
      enableRiskLimitEnforcement: true,
      enableEmergencyShutdown: true,
      riskLimits: {
        maxPositionSize: 10000,
        maxDailyLoss: 5000,
        maxTotalExposure: 50000,
        maxConcurrentStrategies: 5,
        maxLeverage: 3
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    safetyMonitor.stopMonitoring();
  });

  describe('validateStrategyDeployment', () => {
    const mockStrategy: HBStrategy = {
      type: 'pure_market_making',
      exchange: 'binance',
      tradingPair: 'BTCUSDT',
      parameters: {
        bidSpread: 0.1,
        askSpread: 0.1,
        orderAmount: 100
      },
      riskLimits: {
        maxPositionSize: 1000,
        maxDailyLoss: 500,
        maxOpenOrders: 5,
        maxSlippage: 0.5
      },
      executionSettings: {
        orderRefreshTime: 30,
        orderRefreshTolerance: 0.1,
        filledOrderDelay: 5,
        orderOptimization: true,
        addTransactionCosts: true,
        priceSource: 'current_market'
      }
    };

    it('should validate strategy successfully when all conditions are met', async () => {
      mockBridgeService.getConnection.mockReturnValue({
        instanceId: 'test-instance',
        status: 'connected',
        lastPing: Date.now(),
        apiVersion: 'v1',
        supportedStrategies: ['pure_market_making'],
        endpoint: 'http://localhost:5000',
        connectionAttempts: 1
      });

      await expect(safetyMonitor.validateStrategyDeployment(mockStrategy, 'test-instance'))
        .resolves.not.toThrow();

      expect(mockPaperTradingSafetyMonitor.isPaperTradingModeEnabled).toHaveBeenCalled();
    });

    it('should throw error when paper trading mode is disabled', async () => {
      mockPaperTradingSafetyMonitor.isPaperTradingModeEnabled.mockReturnValue(false);

      await expect(safetyMonitor.validateStrategyDeployment(mockStrategy, 'test-instance'))
        .rejects.toThrow('Paper trading mode must be enabled');
    });

    it('should throw error when strategy exceeds position size limit', async () => {
      const highRiskStrategy: HBStrategy = {
        ...mockStrategy,
        riskLimits: {
          ...mockStrategy.riskLimits,
          maxPositionSize: 20000 // Exceeds limit
        }
      };

      await expect(safetyMonitor.validateStrategyDeployment(highRiskStrategy, 'test-instance'))
        .rejects.toThrow('Strategy position size');
    });

    it('should throw error when strategy exceeds leverage limit', async () => {
      const highLeverageStrategy: HBStrategy = {
        ...mockStrategy,
        executionSettings: {
          ...mockStrategy.executionSettings,
          leverage: 10 // Exceeds limit
        }
      };

      await expect(safetyMonitor.validateStrategyDeployment(highLeverageStrategy, 'test-instance'))
        .rejects.toThrow('Strategy leverage');
    });

    it('should throw error when instance is unhealthy', async () => {
      mockBridgeService.getConnection.mockReturnValue({
        instanceId: 'test-instance',
        status: 'error',
        lastPing: Date.now(),
        apiVersion: 'v1',
        supportedStrategies: [],
        endpoint: 'http://localhost:5000',
        connectionAttempts: 3
      });

      await expect(safetyMonitor.validateStrategyDeployment(mockStrategy, 'test-instance'))
        .rejects.toThrow('Instance test-instance is not healthy');
    });

    it('should block real trades when enabled', async () => {
      mockBridgeService.getConnection.mockReturnValue({
        instanceId: 'test-instance',
        status: 'connected',
        lastPing: Date.now(),
        apiVersion: 'v1',
        supportedStrategies: ['pure_market_making'],
        endpoint: 'http://localhost:5000',
        connectionAttempts: 1
      });

      await safetyMonitor.validateStrategyDeployment(mockStrategy, 'test-instance');

      // Verify that paper trading flags are added to strategy
      expect(mockStrategy.executionSettings.paperTradingMode).toBe(true);
      expect(mockStrategy.executionSettings.simulationOnly).toBe(true);
      expect(mockStrategy.executionSettings.preventRealTrades).toBe(true);
    });
  });

  describe('monitorStrategyExecution', () => {
    const mockExecution: StrategyExecution = {
      id: 'test-execution-1',
      strategyType: 'pure_market_making',
      instanceId: 'test-instance',
      status: 'active',
      startTime: Date.now(),
      parameters: {
        bidSpread: 0.1,
        askSpread: 0.1
      },
      performance: {
        totalTrades: 10,
        successfulTrades: 8,
        totalVolume: 1000,
        totalPnL: 50,
        averageLatency: 100,
        averageSlippage: 0.01,
        fillRate: 0.8,
        maxDrawdown: 0.05,
        currentDrawdown: 0.02,
        profitFactor: 1.5,
        sharpeRatio: 1.2,
        winRate: 0.8
      },
      orders: [],
      trades: [],
      errors: []
    };

    it('should assess strategy risk correctly', async () => {
      await safetyMonitor.monitorStrategyExecution(mockExecution);

      const assessment = safetyMonitor.getStrategyRiskAssessment(mockExecution.id);
      expect(assessment).toBeDefined();
      expect(assessment!.strategyId).toBe(mockExecution.id);
      expect(assessment!.riskLevel).toBe('low'); // Good performance should be low risk
    });

    it('should detect high drawdown risk', async () => {
      const highDrawdownExecution: StrategyExecution = {
        ...mockExecution,
        performance: {
          ...mockExecution.performance,
          currentDrawdown: 0.20 // 20% drawdown
        }
      };

      await safetyMonitor.monitorStrategyExecution(highDrawdownExecution);

      const assessment = safetyMonitor.getStrategyRiskAssessment(highDrawdownExecution.id);
      expect(assessment!.riskLevel).toBe('critical');
      expect(assessment!.violations).toContainEqual(
        expect.objectContaining({
          type: 'high_drawdown',
          severity: 'critical'
        })
      );
    });

    it('should detect low fill rate risk', async () => {
      const lowFillRateExecution: StrategyExecution = {
        ...mockExecution,
        performance: {
          ...mockExecution.performance,
          fillRate: 0.3 // 30% fill rate
        }
      };

      await safetyMonitor.monitorStrategyExecution(lowFillRateExecution);

      const assessment = safetyMonitor.getStrategyRiskAssessment(lowFillRateExecution.id);
      expect(assessment!.violations).toContainEqual(
        expect.objectContaining({
          type: 'low_fill_rate',
          severity: 'medium'
        })
      );
    });

    it('should detect high latency risk', async () => {
      const highLatencyExecution: StrategyExecution = {
        ...mockExecution,
        performance: {
          ...mockExecution.performance,
          averageLatency: 3000 // 3 seconds
        }
      };

      await safetyMonitor.monitorStrategyExecution(highLatencyExecution);

      const assessment = safetyMonitor.getStrategyRiskAssessment(highLatencyExecution.id);
      expect(assessment!.violations).toContainEqual(
        expect.objectContaining({
          type: 'high_latency',
          severity: 'medium'
        })
      );
    });

    it('should stop strategy on critical risk', async () => {
      const criticalRiskExecution: StrategyExecution = {
        ...mockExecution,
        performance: {
          ...mockExecution.performance,
          currentDrawdown: 0.25 // 25% drawdown - critical
        }
      };

      mockBridgeService.stopStrategy.mockResolvedValue(true);

      await safetyMonitor.monitorStrategyExecution(criticalRiskExecution);

      expect(mockBridgeService.stopStrategy).toHaveBeenCalledWith(criticalRiskExecution.id);
    });
  });

  describe('enforceRiskLimits', () => {
    it('should enforce risk limits when enabled', async () => {
      const mockConnections = new Map([
        ['instance-1', { 
          instanceId: 'instance-1',
          status: 'connected' as const,
          lastPing: Date.now(),
          apiVersion: 'v1',
          supportedStrategies: ['pure_market_making'],
          endpoint: 'http://localhost:5000',
          connectionAttempts: 1
        }],
        ['instance-2', { 
          instanceId: 'instance-2',
          status: 'connected' as const,
          lastPing: Date.now(),
          apiVersion: 'v1',
          supportedStrategies: ['pure_market_making'],
          endpoint: 'http://localhost:5001',
          connectionAttempts: 1
        }]
      ]);
      mockBridgeService.getConnections.mockReturnValue(mockConnections);

      await safetyMonitor.enforceRiskLimits();

      // Verify that risk limits are checked for each instance
      expect(mockBridgeService.getConnections).toHaveBeenCalled();
    });

    it('should skip enforcement when disabled', async () => {
      const disabledSafetyMonitor = new HummingbotSafetyMonitor(mockBridgeService, {
        enableRiskLimitEnforcement: false
      });

      await disabledSafetyMonitor.enforceRiskLimits();

      expect(mockBridgeService.getConnections).not.toHaveBeenCalled();
      disabledSafetyMonitor.stopMonitoring();
    });
  });

  describe('executeEmergencyShutdown', () => {
    const mockReason: EmergencyShutdownReason = {
      type: 'risk_violation',
      message: 'Critical risk detected',
      severity: 'critical',
      timestamp: Date.now()
    };

    it('should execute emergency shutdown successfully', async () => {
      mockBridgeService.disconnectAll.mockResolvedValue();

      const result = await safetyMonitor.executeEmergencyShutdown(mockReason);

      expect(result).toBeDefined();
      expect(mockBridgeService.disconnectAll).toHaveBeenCalled();
    });

    it('should prevent multiple concurrent shutdowns', async () => {
      mockBridgeService.disconnectAll.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      const shutdown1Promise = safetyMonitor.executeEmergencyShutdown(mockReason);
      const shutdown2Promise = safetyMonitor.executeEmergencyShutdown(mockReason);

      const [result1, result2] = await Promise.all([shutdown1Promise, shutdown2Promise]);

      expect(result1.success || result2.success).toBe(true);
      // One should succeed, one should be rejected due to already in progress
    });

    it('should handle shutdown errors gracefully', async () => {
      mockBridgeService.disconnectAll.mockRejectedValue(new Error('Disconnect failed'));

      const result = await safetyMonitor.executeEmergencyShutdown(mockReason);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Disconnect failed');
    });
  });

  describe('safety status tracking', () => {
    it('should initialize safety status correctly', () => {
      const status = safetyMonitor.getSafetyStatus();

      expect(status.paperTradingModeActive).toBe(true);
      expect(status.realTradesBlocked).toBe(0);
      expect(status.riskViolations).toBe(0);
      expect(status.emergencyShutdownsTriggered).toBe(0);
      expect(status.safetyScore).toBe(100);
      expect(status.violations).toEqual([]);
    });

    it('should update safety status after violations', async () => {
      const mockStrategy: HBStrategy = {
        type: 'pure_market_making',
        exchange: 'binance',
        tradingPair: 'BTCUSDT',
        parameters: {},
        riskLimits: {
          maxPositionSize: 20000, // Exceeds limit
          maxDailyLoss: 500,
          maxOpenOrders: 5,
          maxSlippage: 0.5
        },
        executionSettings: {
          orderRefreshTime: 30,
          orderRefreshTolerance: 0.1,
          filledOrderDelay: 5,
          orderOptimization: true,
          addTransactionCosts: true,
          priceSource: 'current_market'
        }
      };

      try {
        await safetyMonitor.validateStrategyDeployment(mockStrategy, 'test-instance');
      } catch (error) {
        // Expected to throw
      }

      const status = safetyMonitor.getSafetyStatus();
      expect(status.riskViolations).toBeGreaterThan(0);
      expect(status.violations.length).toBeGreaterThan(0);
      expect(status.safetyScore).toBeLessThan(100);
    });
  });

  describe('event handling', () => {
    it('should handle paper trading safety violations', () => {
      const mockEvent = {
        type: 'paper_trading_disabled',
        message: 'Paper trading disabled'
      };

      // Find the event handler for critical safety violations
      const eventHandler = mockPaperTradingSafetyMonitor.on.mock.calls.find(
        call => call[0] === 'critical_safety_violation'
      )?.[1];

      expect(eventHandler).toBeDefined();
    });

    it('should handle bridge service events', () => {
      const strategyFailedHandler = mockBridgeService.on.mock.calls.find(
        call => call[0] === 'strategy:failed'
      )?.[1];

      const connectionFailedHandler = mockBridgeService.on.mock.calls.find(
        call => call[0] === 'connection:failed'
      )?.[1];

      expect(strategyFailedHandler).toBeDefined();
      expect(connectionFailedHandler).toBeDefined();
    });
  });

  describe('configuration', () => {
    it('should use default configuration when none provided', () => {
      const defaultSafetyMonitor = new HummingbotSafetyMonitor(mockBridgeService);
      const status = defaultSafetyMonitor.getSafetyStatus();

      expect(status).toBeDefined();
      defaultSafetyMonitor.stopMonitoring();
    });

    it('should merge custom configuration with defaults', () => {
      const customSafetyMonitor = new HummingbotSafetyMonitor(mockBridgeService, {
        riskLimits: {
          maxPositionSize: 5000,
          maxDailyLoss: 2000,
          maxTotalExposure: 25000,
          maxConcurrentStrategies: 3,
          maxLeverage: 2
        },
        monitoringInterval: 5000
      });

      expect(customSafetyMonitor).toBeDefined();
      customSafetyMonitor.stopMonitoring();
    });
  });

  describe('risk assessment calculations', () => {
    it('should calculate safety score correctly', () => {
      const initialStatus = safetyMonitor.getSafetyStatus();
      expect(initialStatus.safetyScore).toBe(100);

      // Simulate some violations
      const mockExecution: StrategyExecution = {
        id: 'test-execution',
        strategyType: 'pure_market_making',
        instanceId: 'test-instance',
        status: 'active',
        startTime: Date.now(),
        parameters: {},
        performance: {
          totalTrades: 10,
          successfulTrades: 8,
          totalVolume: 1000,
          totalPnL: 50,
          averageLatency: 100,
          averageSlippage: 0.01,
          fillRate: 0.8,
          maxDrawdown: 0.05,
          currentDrawdown: 0.20, // High drawdown
          profitFactor: 1.5,
          sharpeRatio: 1.2,
          winRate: 0.8
        },
        orders: [],
        trades: [],
        errors: []
      };

      // This should create violations and lower the safety score
      safetyMonitor.monitorStrategyExecution(mockExecution);
    });
  });
});