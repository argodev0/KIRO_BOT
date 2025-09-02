/**
 * Tests for Hummingbot Paper Trading Integration Service
 */

import { HummingbotPaperTradingIntegration } from '../../services/HummingbotPaperTradingIntegration';
import { HummingbotBridgeService } from '../../services/HummingbotBridgeService';
import { PaperTradingSafetyMonitor } from '../../services/PaperTradingSafetyMonitor';
import { TradingSignal } from '../../types';

// Mock dependencies
jest.mock('../../services/HummingbotBridgeService');
jest.mock('../../services/PaperTradingSafetyMonitor');
jest.mock('../../services/AuditLogService', () => ({
  AuditLogService: {
    getInstance: jest.fn(() => ({
      logTradingAuditEvent: jest.fn(),
      logAuditEvent: jest.fn(),
      logSecurityAuditEvent: jest.fn(),
      logConfigurationAuditEvent: jest.fn()
    }))
  }
}));
jest.mock('../../services/RiskManagementService', () => ({
  RiskManagementService: jest.fn(() => ({
    validateRiskLimits: jest.fn(() => ({
      isValid: true,
      violations: []
    }))
  }))
}));

describe('HummingbotPaperTradingIntegration', () => {
  let integration: HummingbotPaperTradingIntegration;
  let mockBridgeService: jest.Mocked<HummingbotBridgeService>;
  let mockSafetyMonitor: jest.Mocked<PaperTradingSafetyMonitor>;

  beforeEach(() => {
    mockBridgeService = new HummingbotBridgeService() as jest.Mocked<HummingbotBridgeService>;
    mockSafetyMonitor = {
      isPaperTradingModeEnabled: jest.fn().mockReturnValue(true),
      updateVirtualPortfolioBalance: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    (PaperTradingSafetyMonitor.getInstance as jest.Mock).mockReturnValue(mockSafetyMonitor);

    integration = new HummingbotPaperTradingIntegration(mockBridgeService, {
      enableHummingbotSimulation: true,
      simulationMode: 'full',
      virtualBalance: {
        USDT: 10000,
        BTC: 1,
        ETH: 10
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('simulateHummingbotStrategy', () => {
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

    it('should successfully simulate Hummingbot strategy when paper trading is enabled', async () => {
      const result = await integration.simulateHummingbotStrategy(mockSignal);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.simulationType).toBe('full');
      expect(result.executionId).toBeDefined();
      expect(mockSafetyMonitor.isPaperTradingModeEnabled).toHaveBeenCalled();
    });

    it('should throw error when paper trading mode is disabled', async () => {
      mockSafetyMonitor.isPaperTradingModeEnabled.mockReturnValue(false);

      await expect(integration.simulateHummingbotStrategy(mockSignal))
        .rejects.toThrow('Paper trading mode must be enabled for Hummingbot simulation');
    });

    it('should validate risk limits before simulation', async () => {
      const highRiskSignal: TradingSignal = {
        ...mockSignal,
        quantity: 100000 // Exceeds max position size
      };

      await expect(integration.simulateHummingbotStrategy(highRiskSignal))
        .rejects.toThrow('Position size 100000 exceeds maximum allowed');
    });

    it('should handle different simulation modes', async () => {
      // Test strategy-only mode
      integration = new HummingbotPaperTradingIntegration(mockBridgeService, {
        simulationMode: 'strategy_only'
      });

      const result = await integration.simulateHummingbotStrategy(mockSignal);
      expect(result.simulationType).toBe('strategy_only');
    });

    it('should update simulation metrics after successful simulation', async () => {
      const result = await integration.simulateHummingbotStrategy(mockSignal);
      
      const metrics = integration.getSimulationMetrics();
      expect(metrics.totalSimulatedTrades).toBeGreaterThan(0);
      expect(metrics.strategyPerformance.size).toBeGreaterThan(0);
    });
  });

  describe('createSimulatedOrder', () => {
    it('should create simulated order successfully', async () => {
      const orderParams = {
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'limit' as const,
        quantity: 0.1,
        price: 50000
      };

      const order = await integration.createSimulatedOrder('test-strategy', orderParams);

      expect(order).toBeDefined();
      expect(order.symbol).toBe(orderParams.symbol);
      expect(order.side).toBe(orderParams.side);
      expect(order.type).toBe(orderParams.type);
      expect(order.quantity).toBe(orderParams.quantity);
      expect(order.price).toBe(orderParams.price);
      expect(order.isPaperTrade).toBe(true);
      expect(order.status).toBe('pending');
    });

    it('should validate order against risk limits', async () => {
      const largeOrderParams = {
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'limit' as const,
        quantity: 100000, // Exceeds max position size
        price: 50000
      };

      await expect(integration.createSimulatedOrder('test-strategy', largeOrderParams))
        .rejects.toThrow('exceeds maximum position size');
    });

    it('should check virtual balance for buy orders', async () => {
      const orderParams = {
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'limit' as const,
        quantity: 1000, // Requires more USDT than available
        price: 50000
      };

      await expect(integration.createSimulatedOrder('test-strategy', orderParams))
        .rejects.toThrow('Insufficient virtual balance');
    });
  });

  describe('virtual balance management', () => {
    it('should return correct virtual balance', () => {
      const usdtBalance = integration.getVirtualBalance('USDT');
      expect(usdtBalance).toBe(10000);

      const btcBalance = integration.getVirtualBalance('BTC');
      expect(btcBalance).toBe(1);
    });

    it('should update virtual balance correctly', () => {
      integration.updateVirtualBalance('USDT', -1000);
      expect(integration.getVirtualBalance('USDT')).toBe(9000);

      integration.updateVirtualBalance('BTC', 0.5);
      expect(integration.getVirtualBalance('BTC')).toBe(1.5);
    });

    it('should not allow negative balances', () => {
      integration.updateVirtualBalance('USDT', -20000); // More than available
      expect(integration.getVirtualBalance('USDT')).toBe(10000); // Should remain unchanged
    });

    it('should update safety monitor when balance changes', () => {
      integration.updateVirtualBalance('USDT', -1000);
      expect(mockSafetyMonitor.updateVirtualPortfolioBalance).toHaveBeenCalledWith('default', 9000);
    });
  });

  describe('simulation metrics', () => {
    it('should initialize metrics correctly', () => {
      const metrics = integration.getSimulationMetrics();
      
      expect(metrics.totalSimulatedTrades).toBe(0);
      expect(metrics.totalSimulatedVolume).toBe(0);
      expect(metrics.simulatedPnL).toBe(0);
      expect(metrics.strategyPerformance).toBeInstanceOf(Map);
    });

    it('should track strategy-specific metrics', async () => {
      const signal: TradingSignal = {
        id: 'test-signal-1',
        symbol: 'BTCUSDT',
        type: 'buy',
        entryPrice: 50000,
        quantity: 0.1,
        confidence: 0.8,
        timestamp: Date.now(),
        source: 'test'
      };

      await integration.simulateHummingbotStrategy(signal);
      
      const metrics = integration.getSimulationMetrics();
      expect(metrics.strategyPerformance.size).toBeGreaterThan(0);
      
      const strategyMetrics = Array.from(metrics.strategyPerformance.values())[0];
      expect(strategyMetrics.strategyType).toBeDefined();
      expect(strategyMetrics.totalTrades).toBeGreaterThanOrEqual(0);
    });
  });

  describe('simulation reset', () => {
    it('should reset simulation state correctly', async () => {
      // Create some simulation data
      const signal: TradingSignal = {
        id: 'test-signal-1',
        symbol: 'BTCUSDT',
        type: 'buy',
        entryPrice: 50000,
        quantity: 0.1,
        confidence: 0.8,
        timestamp: Date.now(),
        source: 'test'
      };

      await integration.simulateHummingbotStrategy(signal);
      
      // Verify data exists
      expect(integration.getSimulatedStrategies().length).toBeGreaterThan(0);
      
      // Reset simulation
      integration.resetSimulation();
      
      // Verify data is cleared
      expect(integration.getSimulatedStrategies().length).toBe(0);
      expect(integration.getVirtualBalance('USDT')).toBe(10000); // Reset to initial
      
      const metrics = integration.getSimulationMetrics();
      expect(metrics.totalSimulatedTrades).toBe(0);
      expect(metrics.strategyPerformance.size).toBe(0);
    });
  });

  describe('safety event handling', () => {
    it('should handle critical safety violations', () => {
      const mockEvent = {
        type: 'paper_trading_disabled',
        message: 'Critical safety violation'
      };

      // Simulate safety violation event
      const eventHandler = mockSafetyMonitor.on.mock.calls.find(
        call => call[0] === 'critical_safety_violation'
      )?.[1];

      expect(eventHandler).toBeDefined();
      
      // This would trigger emergency stop in real implementation
      if (eventHandler) {
        eventHandler(mockEvent);
      }
    });

    it('should handle real trading attempt blocks', () => {
      const mockEvent = {
        userId: 'test-user',
        endpoint: 'hummingbot_strategy',
        reason: 'paper_trading_mode_active'
      };

      const eventHandler = mockSafetyMonitor.on.mock.calls.find(
        call => call[0] === 'real_trading_attempt_blocked'
      )?.[1];

      expect(eventHandler).toBeDefined();
      
      if (eventHandler) {
        eventHandler(mockEvent);
      }
    });
  });

  describe('error handling', () => {
    it('should handle simulation errors gracefully', async () => {
      // Mock an error in the simulation process
      const invalidSignal: TradingSignal = {
        id: 'invalid-signal',
        symbol: '', // Invalid symbol
        type: 'buy',
        entryPrice: 0, // Invalid price
        quantity: 0, // Invalid quantity
        confidence: 0.8,
        timestamp: Date.now(),
        source: 'test'
      };

      await expect(integration.simulateHummingbotStrategy(invalidSignal))
        .rejects.toThrow();
    });

    it('should emit error events on failures', async () => {
      const errorSpy = jest.fn();
      integration.on('simulation:failed', errorSpy);

      const invalidSignal: TradingSignal = {
        id: 'invalid-signal',
        symbol: '',
        type: 'buy',
        entryPrice: 0,
        quantity: 0,
        confidence: 0.8,
        timestamp: Date.now(),
        source: 'test'
      };

      try {
        await integration.simulateHummingbotStrategy(invalidSignal);
      } catch (error) {
        // Expected to throw
      }

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('configuration validation', () => {
    it('should use default configuration when none provided', () => {
      const defaultIntegration = new HummingbotPaperTradingIntegration(mockBridgeService);
      
      expect(defaultIntegration.getVirtualBalance('USDT')).toBe(10000);
      expect(defaultIntegration.getVirtualBalance('BTC')).toBe(1);
      expect(defaultIntegration.getVirtualBalance('ETH')).toBe(10);
    });

    it('should merge custom configuration with defaults', () => {
      const customIntegration = new HummingbotPaperTradingIntegration(mockBridgeService, {
        virtualBalance: {
          USDT: 50000,
          BTC: 5
        },
        simulationMode: 'execution_only'
      });
      
      expect(customIntegration.getVirtualBalance('USDT')).toBe(50000);
      expect(customIntegration.getVirtualBalance('BTC')).toBe(5);
      expect(customIntegration.getVirtualBalance('ETH')).toBe(10); // Default value
    });
  });
});