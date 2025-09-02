/**
 * Integration Tests for Hummingbot Safety and Paper Trading Integration
 * Tests all safety components working together
 */

import { HummingbotPaperTradingIntegration } from '../../services/HummingbotPaperTradingIntegration';
import { HummingbotSafetyMonitor } from '../../services/HummingbotSafetyMonitor';
import { HummingbotAuditLogger } from '../../services/HummingbotAuditLogger';
import { HummingbotEmergencyShutdown } from '../../services/HummingbotEmergencyShutdown';
import { HummingbotBridgeService } from '../../services/HummingbotBridgeService';
import { HummingbotManager } from '../../services/HummingbotManager';
import { PaperTradingSafetyMonitor } from '../../services/PaperTradingSafetyMonitor';
import { TradingSignal, HBStrategy, StrategyExecution, EmergencyShutdownReason } from '../../types';

// Mock external dependencies
jest.mock('../../services/HummingbotBridgeService');
jest.mock('../../services/HummingbotManager');
jest.mock('../../services/PaperTradingSafetyMonitor');
jest.mock('../../services/AuditLogService');
jest.mock('../../services/RiskManagementService');

describe('Hummingbot Safety Integration', () => {
  let paperTradingIntegration: HummingbotPaperTradingIntegration;
  let safetyMonitor: HummingbotSafetyMonitor;
  let auditLogger: HummingbotAuditLogger;
  let emergencyShutdown: HummingbotEmergencyShutdown;
  let mockBridgeService: jest.Mocked<HummingbotBridgeService>;
  let mockHummingbotManager: jest.Mocked<HummingbotManager>;
  let mockPaperTradingSafetyMonitor: jest.Mocked<PaperTradingSafetyMonitor>;

  beforeEach(() => {
    // Setup mocks
    mockBridgeService = {
      getConnections: jest.fn().mockReturnValue(new Map()),
      getConnection: jest.fn(),
      stopStrategy: jest.fn(),
      disconnectAll: jest.fn(),
      on: jest.fn()
    } as any;

    mockHummingbotManager = {
      getAllInstances: jest.fn().mockReturnValue([]),
      cleanup: jest.fn()
    } as any;

    mockPaperTradingSafetyMonitor = {
      isPaperTradingModeEnabled: jest.fn().mockReturnValue(true),
      recordRealTradingAttemptBlocked: jest.fn(),
      updateVirtualPortfolioBalance: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      setPaperTradingMode: jest.fn()
    } as any;

    (PaperTradingSafetyMonitor.getInstance as jest.Mock).mockReturnValue(mockPaperTradingSafetyMonitor);

    // Initialize services
    paperTradingIntegration = new HummingbotPaperTradingIntegration(mockBridgeService, {
      enableHummingbotSimulation: true,
      simulationMode: 'full',
      virtualBalance: {
        USDT: 10000,
        BTC: 1,
        ETH: 10
      }
    });

    safetyMonitor = new HummingbotSafetyMonitor(mockBridgeService, {
      enableRealTradeBlocking: true,
      enableRiskLimitEnforcement: true,
      enableEmergencyShutdown: true
    });

    auditLogger = new HummingbotAuditLogger();

    emergencyShutdown = new HummingbotEmergencyShutdown(
      mockBridgeService,
      mockHummingbotManager,
      {
        enableAutoShutdown: true,
        shutdownTimeoutMs: 30000
      }
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    safetyMonitor.stopMonitoring();
  });

  describe('End-to-End Paper Trading Safety Flow', () => {
    const mockSignal: TradingSignal = {
      id: 'test-signal-1',
      symbol: 'BTCUSDT',
      type: 'buy',
      entryPrice: 50000,
      quantity: 0.1,
      confidence: 0.8,
      timestamp: Date.now(),
      source: 'test',
      exchange: 'binance'
    };

    it('should execute complete paper trading flow with safety checks', async () => {
      // Mock healthy connection
      mockBridgeService.getConnection.mockReturnValue({
        instanceId: 'test-instance',
        status: 'connected',
        lastPing: Date.now(),
        apiVersion: 'v1',
        supportedStrategies: ['pure_market_making'],
        endpoint: 'http://localhost:5000',
        connectionAttempts: 1
      });

      // Step 1: Simulate Hummingbot strategy
      const simulationResult = await paperTradingIntegration.simulateHummingbotStrategy(mockSignal);
      
      expect(simulationResult.success).toBe(true);
      expect(simulationResult.simulationType).toBe('full');

      // Step 2: Validate strategy deployment through safety monitor
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

      await expect(safetyMonitor.validateStrategyDeployment(mockStrategy, 'test-instance'))
        .resolves.not.toThrow();

      // Step 3: Monitor strategy execution
      const mockExecution: StrategyExecution = {
        id: simulationResult.executionId,
        strategyType: 'pure_market_making',
        instanceId: 'test-instance',
        status: 'active',
        startTime: Date.now(),
        parameters: mockStrategy.parameters,
        performance: {
          totalTrades: 5,
          successfulTrades: 5,
          totalVolume: 500,
          totalPnL: 25,
          averageLatency: 100,
          averageSlippage: 0.01,
          fillRate: 1.0,
          maxDrawdown: 0.02,
          currentDrawdown: 0.01,
          profitFactor: 2.0,
          sharpeRatio: 1.5,
          winRate: 1.0
        },
        orders: [],
        trades: [],
        errors: []
      };

      await safetyMonitor.monitorStrategyExecution(mockExecution);

      const riskAssessment = safetyMonitor.getStrategyRiskAssessment(mockExecution.id);
      expect(riskAssessment).toBeDefined();
      expect(riskAssessment!.riskLevel).toBe('low');

      // Step 4: Verify audit logging
      const auditEvents = auditLogger.getRecentEvents(10);
      expect(auditEvents.length).toBeGreaterThan(0);

      // Step 5: Check safety status
      const safetyStatus = safetyMonitor.getSafetyStatus();
      expect(safetyStatus.paperTradingModeActive).toBe(true);
      expect(safetyStatus.safetyScore).toBeGreaterThan(90);
    });

    it('should block real trades and trigger safety violations', async () => {
      // Disable paper trading mode to trigger safety violation
      mockPaperTradingSafetyMonitor.isPaperTradingModeEnabled.mockReturnValue(false);

      const mockStrategy: HBStrategy = {
        type: 'pure_market_making',
        exchange: 'binance',
        tradingPair: 'BTCUSDT',
        parameters: {},
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

      // Should throw error when paper trading is disabled
      await expect(safetyMonitor.validateStrategyDeployment(mockStrategy, 'test-instance'))
        .rejects.toThrow('Paper trading mode must be enabled');

      // Should also fail simulation
      await expect(paperTradingIntegration.simulateHummingbotStrategy(mockSignal))
        .rejects.toThrow('Paper trading mode must be enabled');

      // Verify safety status reflects violations
      const safetyStatus = safetyMonitor.getSafetyStatus();
      expect(safetyStatus.riskViolations).toBeGreaterThan(0);
      expect(safetyStatus.safetyScore).toBeLessThan(100);
    });

    it('should trigger emergency shutdown on critical violations', async () => {
      mockBridgeService.disconnectAll.mockResolvedValue();
      mockBridgeService.stopStrategy.mockResolvedValue(true);

      // Create a critical risk scenario
      const criticalExecution: StrategyExecution = {
        id: 'critical-execution',
        strategyType: 'pure_market_making',
        instanceId: 'test-instance',
        status: 'active',
        startTime: Date.now(),
        parameters: {},
        performance: {
          totalTrades: 100,
          successfulTrades: 20,
          totalVolume: 10000,
          totalPnL: -2000,
          averageLatency: 5000, // Very high latency
          averageSlippage: 0.1, // High slippage
          fillRate: 0.2, // Very low fill rate
          maxDrawdown: 0.30, // 30% drawdown - critical
          currentDrawdown: 0.25, // 25% current drawdown
          profitFactor: 0.2,
          sharpeRatio: -0.5,
          winRate: 0.2
        },
        orders: [],
        trades: [],
        errors: []
      };

      // Monitor the critical execution - should trigger emergency actions
      await safetyMonitor.monitorStrategyExecution(criticalExecution);

      const riskAssessment = safetyMonitor.getStrategyRiskAssessment(criticalExecution.id);
      expect(riskAssessment!.riskLevel).toBe('critical');

      // Verify strategy was stopped due to critical risk
      expect(mockBridgeService.stopStrategy).toHaveBeenCalledWith(criticalExecution.id);

      // Verify audit logging of critical events
      const auditEvents = auditLogger.getEventsByRiskLevel('critical', 10);
      expect(auditEvents.length).toBeGreaterThan(0);
    });

    it('should handle emergency shutdown cascade', async () => {
      mockBridgeService.disconnectAll.mockResolvedValue();

      const emergencyReason: EmergencyShutdownReason = {
        type: 'risk_violation',
        message: 'Multiple critical safety violations detected',
        severity: 'critical',
        timestamp: Date.now()
      };

      // Execute emergency shutdown
      const shutdownResult = await emergencyShutdown.executeEmergencyShutdown(emergencyReason);

      expect(shutdownResult.success).toBe(true);
      expect(shutdownResult.steps.length).toBeGreaterThan(0);

      // Verify all systems were properly shut down
      expect(mockBridgeService.disconnectAll).toHaveBeenCalled();

      // Verify audit logging of emergency shutdown
      const auditEvents = auditLogger.queryEvents({ 
        eventType: 'safety',
        action: 'emergency_shutdown'
      });
      expect(auditEvents.length).toBeGreaterThan(0);

      // Verify shutdown status
      const shutdownStatus = emergencyShutdown.getShutdownStatus();
      expect(shutdownStatus.isActive).toBe(true);
      expect(shutdownStatus.completedAt).toBeDefined();
    });
  });

  describe('Risk Limit Enforcement Integration', () => {
    it('should enforce position size limits across all components', async () => {
      const largePositionSignal: TradingSignal = {
        id: 'large-position-signal',
        symbol: 'BTCUSDT',
        type: 'buy',
        entryPrice: 50000,
        quantity: 100, // Very large position
        confidence: 0.9,
        timestamp: Date.now(),
        source: 'test'
      };

      // Should fail in paper trading integration
      await expect(paperTradingIntegration.simulateHummingbotStrategy(largePositionSignal))
        .rejects.toThrow('Maximum concurrent strategies limit reached');

      // Should also fail in safety monitor validation
      const largePositionStrategy: HBStrategy = {
        type: 'pure_market_making',
        exchange: 'binance',
        tradingPair: 'BTCUSDT',
        parameters: {},
        riskLimits: {
          maxPositionSize: 50000, // Exceeds safety monitor limits
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

      await expect(safetyMonitor.validateStrategyDeployment(largePositionStrategy, 'test-instance'))
        .rejects.toThrow('Strategy position size');
    });

    it('should enforce leverage limits', async () => {
      const highLeverageStrategy: HBStrategy = {
        type: 'pure_market_making',
        exchange: 'binance',
        tradingPair: 'BTCUSDT',
        parameters: {},
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
          priceSource: 'current_market',
          leverage: 20 // Exceeds safety limits
        }
      };

      await expect(safetyMonitor.validateStrategyDeployment(highLeverageStrategy, 'test-instance'))
        .rejects.toThrow('Strategy leverage');
    });
  });

  describe('Audit Trail Integration', () => {
    it('should maintain comprehensive audit trail across all operations', async () => {
      const mockSignal: TradingSignal = {
        id: 'audit-test-signal',
        symbol: 'ETHUSDT',
        type: 'sell',
        entryPrice: 3000,
        quantity: 1,
        confidence: 0.7,
        timestamp: Date.now(),
        source: 'test'
      };

      // Execute operations that should be audited
      await paperTradingIntegration.simulateHummingbotStrategy(mockSignal);

      const mockOrder = await paperTradingIntegration.createSimulatedOrder('test-strategy', {
        symbol: 'ETHUSDT',
        side: 'sell',
        type: 'limit',
        quantity: 1,
        price: 3000
      });

      // Log various events
      auditLogger.logStrategyEvent('deploy', {
        type: 'pure_market_making',
        exchange: 'binance',
        tradingPair: 'ETHUSDT',
        parameters: {},
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
      }, 'test-instance', true, {}, 'test-user');

      auditLogger.logOrderEvent('create', mockOrder, true, {}, 'test-user');

      // Generate comprehensive audit report
      const auditReport = auditLogger.generateAuditReport();

      expect(auditReport.totalEvents).toBeGreaterThan(0);
      expect(auditReport.paperTradeEvents).toBeGreaterThan(0);
      expect(auditReport.realTradeAttempts).toBe(0); // All should be paper trades
      expect(auditReport.eventsByType.strategy).toBeGreaterThan(0);
      expect(auditReport.eventsByType.order).toBeGreaterThan(0);

      // Verify audit trail completeness
      const allEvents = auditLogger.getRecentEvents(100);
      const strategyEvents = allEvents.filter(e => e.eventType === 'strategy');
      const orderEvents = allEvents.filter(e => e.eventType === 'order');

      expect(strategyEvents.length).toBeGreaterThan(0);
      expect(orderEvents.length).toBeGreaterThan(0);

      // Verify all events are marked as paper trades
      allEvents.forEach(event => {
        expect(event.paperTrade).toBe(true);
      });
    });

    it('should track safety violations in audit trail', async () => {
      // Create a scenario that triggers safety violations
      const violatingStrategy: HBStrategy = {
        type: 'pure_market_making',
        exchange: 'binance',
        tradingPair: 'BTCUSDT',
        parameters: {},
        riskLimits: {
          maxPositionSize: 100000, // Violates limits
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
        await safetyMonitor.validateStrategyDeployment(violatingStrategy, 'test-instance');
      } catch (error) {
        // Expected to throw
      }

      // Check audit trail for safety violations
      const safetyEvents = auditLogger.queryEvents({ eventType: 'safety' });
      const highRiskEvents = auditLogger.getEventsByRiskLevel('high', 10);

      expect(safetyEvents.length).toBeGreaterThan(0);
      expect(highRiskEvents.length).toBeGreaterThan(0);

      // Verify safety status reflects in audit report
      const auditReport = auditLogger.generateAuditReport();
      expect(auditReport.safetyViolations).toBeGreaterThan(0);
    });
  });

  describe('Virtual Balance Management Integration', () => {
    it('should maintain consistent virtual balances across operations', async () => {
      const initialUSDT = paperTradingIntegration.getVirtualBalance('USDT');
      const initialBTC = paperTradingIntegration.getVirtualBalance('BTC');

      // Create and execute a simulated order
      const buyOrder = await paperTradingIntegration.createSimulatedOrder('test-strategy', {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        price: 50000
      });

      // Simulate order fill by updating balances
      paperTradingIntegration.updateVirtualBalance('USDT', -5000); // Spent USDT
      paperTradingIntegration.updateVirtualBalance('BTC', 0.1); // Received BTC

      const finalUSDT = paperTradingIntegration.getVirtualBalance('USDT');
      const finalBTC = paperTradingIntegration.getVirtualBalance('BTC');

      expect(finalUSDT).toBe(initialUSDT - 5000);
      expect(finalBTC).toBe(initialBTC + 0.1);

      // Verify safety monitor was notified of balance changes
      expect(mockPaperTradingSafetyMonitor.updateVirtualPortfolioBalance).toHaveBeenCalled();
    });

    it('should prevent negative balances', () => {
      const initialBalance = paperTradingIntegration.getVirtualBalance('USDT');

      // Try to spend more than available
      paperTradingIntegration.updateVirtualBalance('USDT', -20000);

      // Balance should remain unchanged
      expect(paperTradingIntegration.getVirtualBalance('USDT')).toBe(initialBalance);
    });
  });

  describe('System Recovery and Resilience', () => {
    it('should handle partial system failures gracefully', async () => {
      // Simulate bridge service failure
      mockBridgeService.getConnection.mockReturnValue(null);

      const mockStrategy: HBStrategy = {
        type: 'pure_market_making',
        exchange: 'binance',
        tradingPair: 'BTCUSDT',
        parameters: {},
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

      // Should fail gracefully with proper error handling
      await expect(safetyMonitor.validateStrategyDeployment(mockStrategy, 'test-instance'))
        .rejects.toThrow('Instance test-instance is not healthy');

      // Paper trading integration should still work
      const mockSignal: TradingSignal = {
        id: 'resilience-test',
        symbol: 'BTCUSDT',
        type: 'buy',
        entryPrice: 50000,
        quantity: 0.1,
        confidence: 0.8,
        timestamp: Date.now(),
        source: 'test'
      };

      const simulationResult = await paperTradingIntegration.simulateHummingbotStrategy(mockSignal);
      expect(simulationResult.success).toBe(true);

      // Audit logging should continue to work
      const auditEvents = auditLogger.getRecentEvents(10);
      expect(auditEvents.length).toBeGreaterThan(0);
    });

    it('should maintain safety even during system stress', async () => {
      // Simulate multiple concurrent operations
      const signals: TradingSignal[] = Array.from({ length: 5 }, (_, i) => ({
        id: `stress-test-${i}`,
        symbol: 'BTCUSDT',
        type: 'buy',
        entryPrice: 50000 + i * 100,
        quantity: 0.1,
        confidence: 0.8,
        timestamp: Date.now() + i,
        source: 'stress-test'
      }));

      // Execute multiple simulations concurrently
      const simulationPromises = signals.map(signal => 
        paperTradingIntegration.simulateHummingbotStrategy(signal)
      );

      const results = await Promise.allSettled(simulationPromises);

      // Some may succeed, some may fail due to limits, but system should remain stable
      const successfulResults = results.filter(r => r.status === 'fulfilled');
      const failedResults = results.filter(r => r.status === 'rejected');

      expect(successfulResults.length + failedResults.length).toBe(signals.length);

      // Safety status should remain reasonable
      const safetyStatus = safetyMonitor.getSafetyStatus();
      expect(safetyStatus.paperTradingModeActive).toBe(true);
      expect(safetyStatus.safetyScore).toBeGreaterThan(0);

      // Audit trail should capture all operations
      const auditEvents = auditLogger.getRecentEvents(20);
      expect(auditEvents.length).toBeGreaterThan(0);
    });
  });
});