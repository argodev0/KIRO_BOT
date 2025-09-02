/**
 * Tests for Hummingbot Audit Logger Service
 */

import { HummingbotAuditLogger } from '../../services/HummingbotAuditLogger';
import { AuditLogService } from '../../services/AuditLogService';
import { HBStrategy, StrategyExecution, SimulatedOrder, SimulatedTrade, SafetyViolation } from '../../types';

// Mock dependencies
jest.mock('../../services/AuditLogService');

describe('HummingbotAuditLogger', () => {
  let auditLogger: HummingbotAuditLogger;
  let mockAuditService: jest.Mocked<AuditLogService>;

  beforeEach(() => {
    mockAuditService = {
      logTradingAuditEvent: jest.fn(),
      logAuditEvent: jest.fn(),
      logSecurityAuditEvent: jest.fn(),
      logConfigurationAuditEvent: jest.fn()
    } as any;

    (AuditLogService.getInstance as jest.Mock).mockReturnValue(mockAuditService);

    auditLogger = new HummingbotAuditLogger();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('logStrategyEvent', () => {
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

    it('should log strategy deployment event', () => {
      auditLogger.logStrategyEvent('deploy', mockStrategy, 'test-instance', true, {
        deploymentTime: 1000
      }, 'test-user');

      expect(mockAuditService.logTradingAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'hummingbot_strategy_deploy',
          resource: 'hummingbot_strategy',
          success: true,
          strategy: 'pure_market_making',
          paperTrade: true,
          userId: 'test-user'
        })
      );
    });

    it('should log strategy error event with high risk level', () => {
      auditLogger.logStrategyEvent('error', mockStrategy, 'test-instance', false, {
        errorMessage: 'Strategy execution failed'
      });

      // Verify that error events are logged with appropriate risk level
      const events = auditLogger.getRecentEvents(10);
      const errorEvent = events.find(e => e.action === 'error');
      
      expect(errorEvent).toBeDefined();
      expect(errorEvent!.riskLevel).toBe('high');
      expect(errorEvent!.success).toBe(false);
    });

    it('should sanitize sensitive strategy data', () => {
      const strategyWithSecrets: HBStrategy = {
        ...mockStrategy,
        parameters: {
          ...mockStrategy.parameters,
          apiKey: 'secret-api-key',
          apiSecret: 'secret-api-secret'
        }
      };

      auditLogger.logStrategyEvent('deploy', strategyWithSecrets, 'test-instance', true);

      const events = auditLogger.getRecentEvents(1);
      const event = events[0];
      
      expect(event.metadata.strategy.parameters).toBeUndefined(); // Sensitive data removed
      expect(event.metadata.strategy.type).toBe('pure_market_making');
    });
  });

  describe('logInstanceEvent', () => {
    const mockInstance = {
      id: 'test-instance-1',
      name: 'Test Instance',
      status: 'running' as const,
      containerId: 'container-123',
      config: {},
      strategies: [],
      resources: {
        cpuUsage: 50,
        memoryUsage: 60,
        networkIO: 1000,
        diskIO: 500
      },
      performance: {
        uptime: 3600000,
        totalStrategies: 2,
        activeStrategies: 1,
        totalTrades: 100,
        avgLatency: 150,
        errorRate: 0.01
      },
      createdAt: new Date(),
      lastHealthCheck: new Date()
    };

    it('should log instance creation event', () => {
      auditLogger.logInstanceEvent('create', mockInstance, true, {
        resourcesAllocated: { cpu: 1, memory: '512MB' }
      }, 'test-user');

      expect(mockAuditService.logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'hummingbot_instance_create',
          resource: 'hummingbot_instance',
          resourceId: 'test-instance-1',
          success: true,
          userId: 'test-user'
        })
      );
    });

    it('should log instance health check events', () => {
      auditLogger.logInstanceEvent('health_check', mockInstance, true, {
        healthScore: 95,
        issues: []
      });

      const events = auditLogger.getRecentEvents(1);
      const event = events[0];
      
      expect(event.action).toBe('health_check');
      expect(event.instanceId).toBe('test-instance-1');
      expect(event.success).toBe(true);
    });

    it('should handle instance errors appropriately', () => {
      auditLogger.logInstanceEvent('error', 'failed-instance', false, {
        errorType: 'connection_timeout',
        errorMessage: 'Failed to connect to instance'
      });

      const events = auditLogger.getRecentEvents(1);
      const event = events[0];
      
      expect(event.success).toBe(false);
      expect(event.riskLevel).toBe('medium');
    });
  });

  describe('logOrderEvent', () => {
    const mockOrder: SimulatedOrder = {
      id: 'order-123',
      strategyId: 'strategy-456',
      symbol: 'BTCUSDT',
      side: 'buy',
      type: 'limit',
      quantity: 0.1,
      price: 50000,
      status: 'pending',
      createdAt: new Date(),
      isPaperTrade: true,
      simulationMetadata: {
        expectedLatency: 100,
        expectedSlippage: 0.001,
        fillProbability: 0.8
      }
    };

    it('should log order creation event', () => {
      auditLogger.logOrderEvent('create', mockOrder, true, {
        orderValidation: 'passed'
      }, 'test-user');

      expect(mockAuditService.logTradingAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'hummingbot_order_create',
          resource: 'hummingbot_order',
          resourceId: 'order-123',
          success: true,
          symbol: 'BTCUSDT',
          exchange: 'simulation',
          orderType: 'limit',
          quantity: 0.1,
          price: 50000,
          orderId: 'order-123',
          strategy: 'strategy-456',
          paperTrade: true,
          userId: 'test-user'
        })
      );
    });

    it('should assess order risk level correctly', () => {
      const largeOrder: SimulatedOrder = {
        ...mockOrder,
        quantity: 100, // Large quantity
        price: 50000
      };

      auditLogger.logOrderEvent('create', largeOrder, true);

      const events = auditLogger.getRecentEvents(1);
      const event = events[0];
      
      expect(event.riskLevel).toBe('medium'); // Large order should be medium risk
    });

    it('should log order fill events', () => {
      auditLogger.logOrderEvent('fill', mockOrder, true, {
        fillPrice: 50050,
        fillQuantity: 0.1,
        slippage: 0.001
      });

      const events = auditLogger.getRecentEvents(1);
      const event = events[0];
      
      expect(event.action).toBe('fill');
      expect(event.details.fillPrice).toBe(50050);
      expect(event.details.slippage).toBe(0.001);
    });
  });

  describe('logTradeEvent', () => {
    const mockTrade: SimulatedTrade = {
      id: 'trade-789',
      orderId: 'order-123',
      strategyId: 'strategy-456',
      symbol: 'BTCUSDT',
      side: 'buy',
      quantity: 0.1,
      price: 50000,
      executedAt: new Date(),
      isPaperTrade: true,
      simulationMetadata: {
        slippage: 0.001,
        latency: 150,
        marketImpact: 0.0005
      }
    };

    it('should log trade execution event', () => {
      auditLogger.logTradeEvent('execute', mockTrade, true, {
        executionTime: 150
      }, 'test-user');

      expect(mockAuditService.logTradingAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'hummingbot_trade_execute',
          resource: 'hummingbot_trade',
          resourceId: 'trade-789',
          success: true,
          symbol: 'BTCUSDT',
          exchange: 'simulation',
          quantity: 0.1,
          price: 50000,
          orderId: 'order-123',
          tradeId: 'trade-789',
          strategy: 'strategy-456',
          paperTrade: true,
          userId: 'test-user'
        })
      );
    });

    it('should assess trade risk based on value', () => {
      const largeTrade: SimulatedTrade = {
        ...mockTrade,
        quantity: 10,
        price: 50000 // Total value: 500,000
      };

      auditLogger.logTradeEvent('execute', largeTrade, true);

      const events = auditLogger.getRecentEvents(1);
      const event = events[0];
      
      expect(event.riskLevel).toBe('medium'); // Large trade value
    });
  });

  describe('logSafetyEvent', () => {
    const mockViolation: SafetyViolation = {
      type: 'risk_limit_violation',
      severity: 'high',
      message: 'Position size exceeds limit',
      timestamp: Date.now(),
      strategyId: 'strategy-123',
      instanceId: 'instance-456'
    };

    it('should log safety violation event', () => {
      auditLogger.logSafetyEvent('violation', mockViolation, false, {
        violationDetails: 'Position size: 15000, Limit: 10000'
      }, 'test-user');

      expect(mockAuditService.logSecurityAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'hummingbot_safety_violation',
          resource: 'hummingbot_safety',
          resourceId: 'risk_limit_violation',
          success: false,
          eventType: 'suspicious_activity',
          severity: 'high',
          userId: 'test-user'
        })
      );
    });

    it('should log emergency shutdown events', () => {
      auditLogger.logSafetyEvent('emergency_shutdown', null, true, {
        reason: 'Critical system error',
        shutdownDuration: 5000
      });

      const events = auditLogger.getRecentEvents(1);
      const event = events[0];
      
      expect(event.action).toBe('emergency_shutdown');
      expect(event.riskLevel).toBe('medium'); // Default when no violation
    });

    it('should set risk level based on violation severity', () => {
      const criticalViolation: SafetyViolation = {
        ...mockViolation,
        severity: 'critical'
      };

      auditLogger.logSafetyEvent('violation', criticalViolation, false);

      const events = auditLogger.getRecentEvents(1);
      const event = events[0];
      
      expect(event.riskLevel).toBe('critical');
    });
  });

  describe('logConfigurationEvent', () => {
    it('should log configuration changes', () => {
      const oldConfig = { maxPositionSize: 1000 };
      const newConfig = { maxPositionSize: 2000 };

      auditLogger.logConfigurationEvent(
        'update',
        'risk_limits',
        'maxPositionSize',
        oldConfig,
        newConfig,
        true,
        'test-user'
      );

      expect(mockAuditService.logConfigurationAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'hummingbot_config_update',
          resource: 'hummingbot_configuration',
          resourceId: 'maxPositionSize',
          success: true,
          configType: 'bot_settings',
          configKey: 'maxPositionSize',
          userId: 'test-user'
        })
      );
    });

    it('should assess configuration risk level', () => {
      auditLogger.logConfigurationEvent(
        'delete',
        'security_settings',
        'apiKeyValidation',
        { enabled: true },
        null,
        true
      );

      const events = auditLogger.getRecentEvents(1);
      const event = events[0];
      
      expect(event.riskLevel).toBe('high'); // Deleting security config is high risk
    });

    it('should sanitize sensitive configuration values', () => {
      const configWithSecrets = {
        apiKey: 'secret-key-123',
        apiSecret: 'secret-secret-456',
        normalSetting: 'normal-value'
      };

      auditLogger.logConfigurationEvent(
        'update',
        'api_settings',
        'apiConfig',
        configWithSecrets,
        configWithSecrets,
        true
      );

      const events = auditLogger.getRecentEvents(1);
      const event = events[0];
      
      expect(event.metadata.oldValue.apiKey).toBe('[REDACTED]');
      expect(event.metadata.oldValue.apiSecret).toBe('[REDACTED]');
      expect(event.metadata.oldValue.normalSetting).toBe('normal-value');
    });
  });

  describe('queryEvents', () => {
    beforeEach(() => {
      // Add some test events
      auditLogger.logStrategyEvent('deploy', {
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
      }, 'instance-1', true, {}, 'user-1');

      auditLogger.logInstanceEvent('create', 'instance-2', true, {}, 'user-2');
      auditLogger.logSafetyEvent('violation', {
        type: 'risk_violation',
        severity: 'high',
        message: 'Test violation',
        timestamp: Date.now()
      }, false);
    });

    it('should query events by type', () => {
      const strategyEvents = auditLogger.queryEvents({ eventType: 'strategy' });
      const instanceEvents = auditLogger.queryEvents({ eventType: 'instance' });
      const safetyEvents = auditLogger.queryEvents({ eventType: 'safety' });

      expect(strategyEvents.length).toBe(1);
      expect(instanceEvents.length).toBe(1);
      expect(safetyEvents.length).toBe(1);
    });

    it('should query events by user', () => {
      const user1Events = auditLogger.queryEvents({ userId: 'user-1' });
      const user2Events = auditLogger.queryEvents({ userId: 'user-2' });

      expect(user1Events.length).toBe(1);
      expect(user2Events.length).toBe(1);
    });

    it('should query events by risk level', () => {
      const highRiskEvents = auditLogger.queryEvents({ riskLevel: 'high' });
      const lowRiskEvents = auditLogger.queryEvents({ riskLevel: 'low' });

      expect(highRiskEvents.length).toBeGreaterThan(0);
      expect(lowRiskEvents.length).toBeGreaterThan(0);
    });

    it('should apply pagination', () => {
      const firstPage = auditLogger.queryEvents({ limit: 2, offset: 0 });
      const secondPage = auditLogger.queryEvents({ limit: 2, offset: 2 });

      expect(firstPage.length).toBeLessThanOrEqual(2);
      expect(secondPage.length).toBeLessThanOrEqual(2);
    });

    it('should filter by time range', () => {
      const now = Date.now();
      const oneHourAgo = now - 3600000;

      const recentEvents = auditLogger.queryEvents({
        startTime: oneHourAgo,
        endTime: now
      });

      expect(recentEvents.length).toBeGreaterThan(0);
      recentEvents.forEach(event => {
        expect(event.timestamp).toBeGreaterThanOrEqual(oneHourAgo);
        expect(event.timestamp).toBeLessThanOrEqual(now);
      });
    });
  });

  describe('generateAuditReport', () => {
    beforeEach(() => {
      // Add various test events
      auditLogger.logStrategyEvent('deploy', {
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
      }, 'instance-1', true);

      auditLogger.logInstanceEvent('create', 'instance-1', true);
      auditLogger.logSafetyEvent('violation', {
        type: 'risk_violation',
        severity: 'high',
        message: 'Test violation',
        timestamp: Date.now()
      }, false);
    });

    it('should generate comprehensive audit report', () => {
      const report = auditLogger.generateAuditReport();

      expect(report.totalEvents).toBeGreaterThan(0);
      expect(report.eventsByType).toBeDefined();
      expect(report.eventsByRiskLevel).toBeDefined();
      expect(report.safetyViolations).toBeGreaterThanOrEqual(0);
      expect(report.paperTradeEvents).toBeGreaterThan(0);
      expect(report.realTradeAttempts).toBe(0); // All should be paper trades
      expect(report.timeRange).toBeDefined();
      expect(report.topInstances).toBeDefined();
      expect(report.topStrategies).toBeDefined();
    });

    it('should count events by type correctly', () => {
      const report = auditLogger.generateAuditReport();

      expect(report.eventsByType.strategy).toBeGreaterThan(0);
      expect(report.eventsByType.instance).toBeGreaterThan(0);
      expect(report.eventsByType.safety).toBeGreaterThan(0);
    });

    it('should identify safety violations', () => {
      const report = auditLogger.generateAuditReport();

      expect(report.safetyViolations).toBeGreaterThan(0);
    });

    it('should track top instances and strategies', () => {
      const report = auditLogger.generateAuditReport();

      expect(report.topInstances.length).toBeGreaterThan(0);
      expect(report.topInstances[0].instanceId).toBeDefined();
      expect(report.topInstances[0].eventCount).toBeGreaterThan(0);
    });
  });

  describe('event storage and cleanup', () => {
    it('should limit stored events to maximum', () => {
      // Create more events than the maximum
      for (let i = 0; i < 15000; i++) {
        auditLogger.logInstanceEvent('health_check', `instance-${i}`, true);
      }

      const allEvents = auditLogger.queryEvents({ limit: 20000 });
      expect(allEvents.length).toBeLessThanOrEqual(10000); // Max stored events
    });

    it('should clear old events', () => {
      // Add some events
      auditLogger.logInstanceEvent('create', 'test-instance', true);
      
      const eventsBefore = auditLogger.getRecentEvents(10);
      expect(eventsBefore.length).toBeGreaterThan(0);

      // Clear events older than 0ms (all events)
      auditLogger.clearOldEvents(0);

      const eventsAfter = auditLogger.getRecentEvents(10);
      expect(eventsAfter.length).toBe(0);
    });
  });

  describe('event emission', () => {
    it('should emit audit events', (done) => {
      auditLogger.on('audit:event', (event) => {
        expect(event).toBeDefined();
        expect(event.eventId).toBeDefined();
        expect(event.timestamp).toBeDefined();
        done();
      });

      auditLogger.logInstanceEvent('create', 'test-instance', true);
    });
  });
});