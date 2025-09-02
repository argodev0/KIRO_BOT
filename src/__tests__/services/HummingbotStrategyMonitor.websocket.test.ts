/**
 * WebSocket-specific unit tests for HummingbotStrategyMonitor
 */

import { HummingbotStrategyMonitor } from '../../services/HummingbotStrategyMonitor';
import { HBStrategy } from '../../types/hummingbot';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

// Mock WebSocket
jest.mock('ws');
const MockWebSocket = WebSocket as jest.MockedClass<typeof WebSocket>;

// Mock dependencies
jest.mock('../../services/AnomalyDetectionService');
jest.mock('../../services/AlertNotificationService');
jest.mock('../../services/PerformanceMonitoringService');
jest.mock('../../utils/logger');

describe('HummingbotStrategyMonitor - WebSocket Functionality', () => {
  let monitor: HummingbotStrategyMonitor;
  let mockStrategy: HBStrategy;
  let mockWebSocket: jest.Mocked<WebSocket>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a mock WebSocket instance
    mockWebSocket = new EventEmitter() as any;
    mockWebSocket.close = jest.fn();
    mockWebSocket.send = jest.fn();
    Object.defineProperty(mockWebSocket, 'readyState', { value: WebSocket.OPEN, writable: true });

    MockWebSocket.mockImplementation(() => mockWebSocket);

    monitor = new HummingbotStrategyMonitor({
      metricsCollectionInterval: 1000,
      websocketReconnectDelay: 100,
      maxReconnectAttempts: 3
    });

    mockStrategy = {
      id: 'test-strategy-1',
      type: 'pure_market_making',
      exchange: 'binance',
      tradingPair: 'BTC/USDT',
      parameters: {
        bidSpread: 0.1,
        askSpread: 0.1,
        orderAmount: 100
      },
      riskLimits: {
        maxPositionSize: 1000,
        maxDailyLoss: 100,
        maxOpenOrders: 10,
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
  });

  afterEach(() => {
    monitor.stop();
  });

  describe('WebSocket Connection Management', () => {
    test('should establish WebSocket connection on strategy monitoring start', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      const websocketConnectedSpy = jest.fn();
      monitor.on('websocket_connected', websocketConnectedSpy);

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      // Simulate WebSocket open event
      mockWebSocket.emit('open');

      expect(MockWebSocket).toHaveBeenCalledWith(`ws://localhost:8080/strategies/${strategyId}/stream`);
      expect(websocketConnectedSpy).toHaveBeenCalledWith({
        strategyId,
        instanceId
      });
    });

    test('should handle WebSocket connection failure gracefully', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      const websocketErrorSpy = jest.fn();
      monitor.on('websocket_error', websocketErrorSpy);

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const error = new Error('Connection failed');
      mockWebSocket.emit('error', error);

      expect(websocketErrorSpy).toHaveBeenCalledWith({
        strategyId,
        error
      });
    });

    test('should close WebSocket connection when stopping strategy monitoring', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);
      await monitor.stopStrategyMonitoring(strategyId);

      expect(mockWebSocket.close).toHaveBeenCalled();
    });

    test('should handle WebSocket disconnection and attempt reconnection', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const websocketDisconnectedSpy = jest.fn();
      monitor.on('websocket_disconnected', websocketDisconnectedSpy);

      // Simulate WebSocket close event
      mockWebSocket.emit('close');

      expect(websocketDisconnectedSpy).toHaveBeenCalledWith({ strategyId });

      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should attempt to create new WebSocket connection
      expect(MockWebSocket).toHaveBeenCalledTimes(2);
    });
  });

  describe('Real-time Message Processing', () => {
    test('should process metrics update messages', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const metricsUpdatedSpy = jest.fn();
      monitor.on('metrics_updated', metricsUpdatedSpy);

      const metricsMessage = {
        type: 'metrics_update',
        data: {
          executionLatency: 200,
          fillRate: 0.9,
          slippage: 0.015,
          profitLoss: 75,
          riskExposure: 0.4,
          orderBookDepth: 1200,
          spreadTightness: 0.003,
          inventoryBalance: 6000,
          activeOrders: 8,
          completedTrades: 30,
          errorCount: 1
        }
      };

      // Simulate receiving WebSocket message
      mockWebSocket.emit('message', JSON.stringify(metricsMessage));

      expect(metricsUpdatedSpy).toHaveBeenCalledWith({
        strategyId,
        metrics: expect.objectContaining({
          executionLatency: 200,
          fillRate: 0.9,
          slippage: 0.015,
          profitLoss: 75
        })
      });

      const retrievedMetrics = monitor.getStrategyMetrics(strategyId);
      expect(retrievedMetrics).toMatchObject({
        executionLatency: 200,
        fillRate: 0.9,
        slippage: 0.015
      });
    });

    test('should process order update messages', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const orderUpdatedSpy = jest.fn();
      monitor.on('order_updated', orderUpdatedSpy);

      const orderMessage = {
        type: 'order_update',
        data: {
          orderId: 'order-123',
          symbol: 'BTC/USDT',
          side: 'buy',
          amount: 0.1,
          price: 45000,
          status: 'filled',
          timestamp: Date.now()
        }
      };

      mockWebSocket.emit('message', JSON.stringify(orderMessage));

      expect(orderUpdatedSpy).toHaveBeenCalledWith({
        strategyId,
        order: orderMessage.data
      });
    });

    test('should process trade update messages', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const tradeUpdatedSpy = jest.fn();
      monitor.on('trade_updated', tradeUpdatedSpy);

      const tradeMessage = {
        type: 'trade_update',
        data: {
          tradeId: 'trade-456',
          orderId: 'order-123',
          symbol: 'BTC/USDT',
          side: 'buy',
          amount: 0.1,
          price: 45000,
          fee: 4.5,
          timestamp: Date.now()
        }
      };

      mockWebSocket.emit('message', JSON.stringify(tradeMessage));

      expect(tradeUpdatedSpy).toHaveBeenCalledWith({
        strategyId,
        trade: tradeMessage.data
      });
    });

    test('should process error messages and trigger automatic adjustments', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const strategyErrorSpy = jest.fn();
      const automaticAdjustmentSpy = jest.fn();
      monitor.on('strategy_error', strategyErrorSpy);
      monitor.on('automatic_adjustment', automaticAdjustmentSpy);

      const errorMessage = {
        type: 'error',
        data: {
          message: 'Exchange connection lost',
          severity: 'critical',
          timestamp: Date.now()
        }
      };

      mockWebSocket.emit('message', JSON.stringify(errorMessage));

      expect(strategyErrorSpy).toHaveBeenCalledWith({
        strategyId,
        error: errorMessage.data
      });

      // Wait for automatic adjustment processing
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(automaticAdjustmentSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          strategyId,
          adjustmentType: 'stop',
          reason: 'Critical error detected: Exchange connection lost'
        })
      );
    });

    test('should handle malformed WebSocket messages gracefully', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Send malformed JSON
      mockWebSocket.emit('message', 'invalid json');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('should handle unknown message types', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();

      const unknownMessage = {
        type: 'unknown_type',
        data: { someData: 'value' }
      };

      mockWebSocket.emit('message', JSON.stringify(unknownMessage));

      expect(consoleSpy).toHaveBeenCalledWith('Unknown WebSocket message type: unknown_type');
      consoleSpy.mockRestore();
    });
  });

  describe('Real-time Performance Tracking', () => {
    test('should track performance metrics in real-time', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const performanceData = [
        { executionLatency: 100, fillRate: 0.8, completedTrades: 10 },
        { executionLatency: 120, fillRate: 0.85, completedTrades: 15 },
        { executionLatency: 90, fillRate: 0.9, completedTrades: 20 },
        { executionLatency: 110, fillRate: 0.88, completedTrades: 25 }
      ];

      for (let i = 0; i < performanceData.length; i++) {
        const metricsMessage = {
          type: 'metrics_update',
          data: {
            ...performanceData[i],
            slippage: 0.01,
            profitLoss: i * 10,
            riskExposure: 0.3,
            orderBookDepth: 1000,
            spreadTightness: 0.002,
            inventoryBalance: 5000,
            activeOrders: 5,
            errorCount: 0
          }
        };

        mockWebSocket.emit('message', JSON.stringify(metricsMessage));
        
        // Small delay to simulate real-time updates
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const metricsHistory = monitor.getStrategyMetricsHistory(strategyId);
      expect(metricsHistory).toHaveLength(4);

      // Verify metrics progression
      expect(metricsHistory[0].completedTrades).toBe(10);
      expect(metricsHistory[1].completedTrades).toBe(15);
      expect(metricsHistory[2].completedTrades).toBe(20);
      expect(metricsHistory[3].completedTrades).toBe(25);

      // Verify latest metrics
      const latestMetrics = monitor.getStrategyMetrics(strategyId);
      expect(latestMetrics?.completedTrades).toBe(25);
      expect(latestMetrics?.fillRate).toBe(0.88);
    });

    test('should detect performance degradation in real-time', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const alertTriggeredSpy = jest.fn();
      monitor.on('alert_triggered', alertTriggeredSpy);

      // Send good performance metrics first
      const goodMetricsMessage = {
        type: 'metrics_update',
        data: {
          executionLatency: 100,
          fillRate: 0.9,
          slippage: 0.01,
          profitLoss: 50,
          riskExposure: 0.3,
          orderBookDepth: 1000,
          spreadTightness: 0.002,
          inventoryBalance: 5000,
          activeOrders: 5,
          completedTrades: 10,
          errorCount: 0
        }
      };

      mockWebSocket.emit('message', JSON.stringify(goodMetricsMessage));

      // Trigger alert checking
      (monitor as any).checkAlertConditions();

      expect(alertTriggeredSpy).not.toHaveBeenCalled();

      // Send degraded performance metrics
      const degradedMetricsMessage = {
        type: 'metrics_update',
        data: {
          executionLatency: 2000, // High latency
          fillRate: 0.5, // Low fill rate
          slippage: 0.05, // High slippage
          profitLoss: -100, // Loss
          riskExposure: 0.3,
          orderBookDepth: 1000,
          spreadTightness: 0.002,
          inventoryBalance: 5000,
          activeOrders: 5,
          completedTrades: 11,
          errorCount: 3 // Errors
        }
      };

      mockWebSocket.emit('message', JSON.stringify(degradedMetricsMessage));

      // Trigger alert checking
      (monitor as any).checkAlertConditions();

      expect(alertTriggeredSpy).toHaveBeenCalledTimes(4); // Should trigger multiple alerts

      const alerts = monitor.getStrategyAlerts(strategyId);
      expect(alerts.length).toBeGreaterThan(0);
      
      const alertTitles = alerts.map(alert => alert.title);
      expect(alertTitles).toContain('High Execution Latency');
      expect(alertTitles).toContain('Low Fill Rate');
      expect(alertTitles).toContain('High Slippage');
      expect(alertTitles).toContain('Strategy Errors Detected');
    });

    test('should handle rapid message updates without performance issues', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const startTime = Date.now();

      // Send 100 rapid updates
      for (let i = 0; i < 100; i++) {
        const metricsMessage = {
          type: 'metrics_update',
          data: {
            executionLatency: 100 + i,
            fillRate: 0.8 + (i * 0.001),
            slippage: 0.01,
            profitLoss: i,
            riskExposure: 0.3,
            orderBookDepth: 1000,
            spreadTightness: 0.002,
            inventoryBalance: 5000,
            activeOrders: 5,
            completedTrades: i,
            errorCount: 0
          }
        };

        mockWebSocket.emit('message', JSON.stringify(metricsMessage));
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should process all messages quickly (under 1 second)
      expect(processingTime).toBeLessThan(1000);

      const metricsHistory = monitor.getStrategyMetricsHistory(strategyId);
      expect(metricsHistory).toHaveLength(100);

      const latestMetrics = monitor.getStrategyMetrics(strategyId);
      expect(latestMetrics?.completedTrades).toBe(99);
      expect(latestMetrics?.executionLatency).toBe(199);
    });
  });

  describe('WebSocket Reconnection Logic', () => {
    test('should attempt reconnection on WebSocket close', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      // Simulate WebSocket close
      mockWebSocket.emit('close');

      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should have attempted to create a new WebSocket connection
      expect(MockWebSocket).toHaveBeenCalledTimes(2);
    });

    test('should not attempt reconnection for inactive strategies', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);
      await monitor.stopStrategyMonitoring(strategyId);

      // Reset mock call count
      MockWebSocket.mockClear();

      // Simulate WebSocket close after strategy is stopped
      mockWebSocket.emit('close');

      // Wait for potential reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should not attempt reconnection
      expect(MockWebSocket).not.toHaveBeenCalled();
    });

    test('should handle reconnection failure gracefully', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      // Mock WebSocket constructor to throw error on second call
      MockWebSocket.mockImplementationOnce(() => mockWebSocket)
        .mockImplementationOnce(() => {
          throw new Error('Reconnection failed');
        });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Simulate WebSocket close
      mockWebSocket.emit('close');

      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to reconnect WebSocket'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Multiple Strategy WebSocket Management', () => {
    test('should manage WebSocket connections for multiple strategies', async () => {
      const strategy1Id = 'test-strategy-1';
      const strategy2Id = 'test-strategy-2';
      const instanceId = 'test-instance-1';

      const mockWebSocket2 = new EventEmitter() as any;
      mockWebSocket2.close = jest.fn();
      mockWebSocket2.send = jest.fn();
      Object.defineProperty(mockWebSocket2, 'readyState', { value: WebSocket.OPEN, writable: true });

      MockWebSocket.mockImplementationOnce(() => mockWebSocket)
        .mockImplementationOnce(() => mockWebSocket2);

      await monitor.startStrategyMonitoring(strategy1Id, instanceId, mockStrategy);
      await monitor.startStrategyMonitoring(strategy2Id, instanceId, mockStrategy);

      expect(MockWebSocket).toHaveBeenCalledTimes(2);
      expect(MockWebSocket).toHaveBeenNthCalledWith(1, `ws://localhost:8080/strategies/${strategy1Id}/stream`);
      expect(MockWebSocket).toHaveBeenNthCalledWith(2, `ws://localhost:8080/strategies/${strategy2Id}/stream`);

      // Test that messages are routed to correct strategies
      const metricsUpdatedSpy = jest.fn();
      monitor.on('metrics_updated', metricsUpdatedSpy);

      const metrics1Message = {
        type: 'metrics_update',
        data: { executionLatency: 100, fillRate: 0.8, completedTrades: 10 }
      };

      const metrics2Message = {
        type: 'metrics_update',
        data: { executionLatency: 200, fillRate: 0.9, completedTrades: 20 }
      };

      mockWebSocket.emit('message', JSON.stringify(metrics1Message));
      mockWebSocket2.emit('message', JSON.stringify(metrics2Message));

      expect(metricsUpdatedSpy).toHaveBeenCalledTimes(2);

      const strategy1Metrics = monitor.getStrategyMetrics(strategy1Id);
      const strategy2Metrics = monitor.getStrategyMetrics(strategy2Id);

      expect(strategy1Metrics?.completedTrades).toBe(10);
      expect(strategy2Metrics?.completedTrades).toBe(20);
    });

    test('should close all WebSocket connections on monitor stop', async () => {
      const strategy1Id = 'test-strategy-1';
      const strategy2Id = 'test-strategy-2';
      const instanceId = 'test-instance-1';

      const mockWebSocket2 = new EventEmitter() as any;
      mockWebSocket2.close = jest.fn();

      MockWebSocket.mockImplementationOnce(() => mockWebSocket)
        .mockImplementationOnce(() => mockWebSocket2);

      await monitor.startStrategyMonitoring(strategy1Id, instanceId, mockStrategy);
      await monitor.startStrategyMonitoring(strategy2Id, instanceId, mockStrategy);

      monitor.stop();

      expect(mockWebSocket.close).toHaveBeenCalled();
      expect(mockWebSocket2.close).toHaveBeenCalled();
    });
  });
});