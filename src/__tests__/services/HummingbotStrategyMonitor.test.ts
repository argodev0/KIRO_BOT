/**
 * Unit tests for HummingbotStrategyMonitor
 */

import { HummingbotStrategyMonitor } from '../../services/HummingbotStrategyMonitor';
import { HBStrategy, StrategyMetrics, Anomaly } from '../../types/hummingbot';
import { EventEmitter } from 'events';

// Mock dependencies
jest.mock('../../services/AnomalyDetectionService', () => ({
  AnomalyDetectionService: {
    getInstance: jest.fn(() => ({
      analyzeSignal: jest.fn(() => []),
      analyzeTradeExecution: jest.fn(() => []),
      analyzePortfolio: jest.fn(() => [])
    }))
  }
}));

jest.mock('../../services/AlertNotificationService', () => ({
  AlertNotificationService: {
    getInstance: jest.fn(() => ({
      processAlert: jest.fn(),
      addAlertRule: jest.fn()
    }))
  }
}));

jest.mock('../../services/PerformanceMonitoringService', () => ({
  PerformanceMonitoringService: {
    getInstance: jest.fn(() => ({
      recordLatency: jest.fn(),
      recordThroughput: jest.fn()
    }))
  }
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('ws', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn(),
    send: jest.fn()
  }));
});

describe('HummingbotStrategyMonitor', () => {
  let monitor: HummingbotStrategyMonitor;
  let mockStrategy: HBStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    
    monitor = new HummingbotStrategyMonitor({
      metricsCollectionInterval: 1000,
      anomalyDetectionInterval: 2000,
      alertCheckInterval: 3000
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

  describe('Strategy Monitoring Lifecycle', () => {
    test('should start monitoring a strategy successfully', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      const monitoringStartedSpy = jest.fn();
      monitor.on('monitoring_started', monitoringStartedSpy);

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      expect(monitoringStartedSpy).toHaveBeenCalledWith({
        strategyId,
        instanceId,
        timestamp: expect.any(Number)
      });

      const status = monitor.getMonitoringStatus();
      expect(status.totalStrategies).toBe(1);
      expect(status.activeStrategies).toBe(1);
    });

    test('should stop monitoring a strategy successfully', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const monitoringStoppedSpy = jest.fn();
      monitor.on('monitoring_stopped', monitoringStoppedSpy);

      await monitor.stopStrategyMonitoring(strategyId);

      expect(monitoringStoppedSpy).toHaveBeenCalledWith({
        strategyId,
        timestamp: expect.any(Number)
      });

      const status = monitor.getMonitoringStatus();
      expect(status.totalStrategies).toBe(0);
      expect(status.activeStrategies).toBe(0);
    });

    test('should handle stopping non-existent strategy gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await monitor.stopStrategyMonitoring('non-existent-strategy');
      
      // Should not throw error
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Metrics Collection and Processing', () => {
    test('should process metrics updates correctly', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const metricsUpdatedSpy = jest.fn();
      monitor.on('metrics_updated', metricsUpdatedSpy);

      // Simulate metrics update
      const mockMetrics: StrategyMetrics = {
        strategyId,
        instanceId,
        timestamp: Date.now(),
        executionLatency: 150,
        fillRate: 0.85,
        slippage: 0.01,
        profitLoss: 50,
        riskExposure: 0.3,
        orderBookDepth: 1000,
        spreadTightness: 0.002,
        inventoryBalance: 5000,
        activeOrders: 5,
        completedTrades: 25,
        errorCount: 0
      };

      // Trigger metrics processing (simulate WebSocket message)
      (monitor as any).processMetricsUpdate(strategyId, mockMetrics);

      expect(metricsUpdatedSpy).toHaveBeenCalledWith({
        strategyId,
        metrics: expect.objectContaining({
          executionLatency: 150,
          fillRate: 0.85,
          slippage: 0.01
        })
      });

      const retrievedMetrics = monitor.getStrategyMetrics(strategyId);
      expect(retrievedMetrics).toMatchObject({
        executionLatency: 150,
        fillRate: 0.85,
        slippage: 0.01
      });
    });

    test('should maintain metrics history with size limit', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      // Add many metrics to test history limit
      for (let i = 0; i < 1100; i++) {
        const mockMetrics: StrategyMetrics = {
          strategyId,
          instanceId,
          timestamp: Date.now() + i,
          executionLatency: 100 + i,
          fillRate: 0.8,
          slippage: 0.01,
          profitLoss: i,
          riskExposure: 0.3,
          orderBookDepth: 1000,
          spreadTightness: 0.002,
          inventoryBalance: 5000,
          activeOrders: 5,
          completedTrades: i,
          errorCount: 0
        };

        (monitor as any).processMetricsUpdate(strategyId, mockMetrics);
      }

      const history = monitor.getStrategyMetricsHistory(strategyId);
      expect(history.length).toBe(1000); // Should be limited to 1000
      expect(history[history.length - 1].completedTrades).toBe(1099); // Should have latest metrics
    });

    test('should return empty array for non-existent strategy metrics', () => {
      const metrics = monitor.getStrategyMetrics('non-existent');
      expect(metrics).toBeNull();

      const history = monitor.getStrategyMetricsHistory('non-existent');
      expect(history).toEqual([]);
    });
  });

  describe('Anomaly Detection', () => {
    test('should detect high latency anomaly', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const anomalyDetectedSpy = jest.fn();
      monitor.on('anomaly_detected', anomalyDetectedSpy);

      // Add baseline metrics
      for (let i = 0; i < 5; i++) {
        const baselineMetrics: StrategyMetrics = {
          strategyId,
          instanceId,
          timestamp: Date.now() + i * 1000,
          executionLatency: 100, // Normal latency
          fillRate: 0.8,
          slippage: 0.01,
          profitLoss: 10,
          riskExposure: 0.3,
          orderBookDepth: 1000,
          spreadTightness: 0.002,
          inventoryBalance: 5000,
          activeOrders: 5,
          completedTrades: i,
          errorCount: 0
        };

        (monitor as any).processMetricsUpdate(strategyId, baselineMetrics);
      }

      // Add high latency metrics
      const highLatencyMetrics: StrategyMetrics = {
        strategyId,
        instanceId,
        timestamp: Date.now() + 6000,
        executionLatency: 500, // High latency (5x normal)
        fillRate: 0.8,
        slippage: 0.01,
        profitLoss: 10,
        riskExposure: 0.3,
        orderBookDepth: 1000,
        spreadTightness: 0.002,
        inventoryBalance: 5000,
        activeOrders: 5,
        completedTrades: 6,
        errorCount: 0
      };

      (monitor as any).processMetricsUpdate(strategyId, highLatencyMetrics);

      // Trigger anomaly detection
      (monitor as any).performAnomalyDetection();

      expect(anomalyDetectedSpy).toHaveBeenCalledWith({
        strategyId,
        anomaly: expect.objectContaining({
          type: 'high_latency',
          severity: 'high'
        })
      });

      const anomalies = monitor.getStrategyAnomalies(strategyId);
      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe('high_latency');
    });

    test('should detect low fill rate anomaly', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const anomalyDetectedSpy = jest.fn();
      monitor.on('anomaly_detected', anomalyDetectedSpy);

      // Add baseline metrics with good fill rate
      for (let i = 0; i < 5; i++) {
        const baselineMetrics: StrategyMetrics = {
          strategyId,
          instanceId,
          timestamp: Date.now() + i * 1000,
          executionLatency: 100,
          fillRate: 0.9, // Good fill rate
          slippage: 0.01,
          profitLoss: 10,
          riskExposure: 0.3,
          orderBookDepth: 1000,
          spreadTightness: 0.002,
          inventoryBalance: 5000,
          activeOrders: 5,
          completedTrades: i,
          errorCount: 0
        };

        (monitor as any).processMetricsUpdate(strategyId, baselineMetrics);
      }

      // Add low fill rate metrics
      const lowFillRateMetrics: StrategyMetrics = {
        strategyId,
        instanceId,
        timestamp: Date.now() + 6000,
        executionLatency: 100,
        fillRate: 0.5, // Low fill rate (0.4 below average)
        slippage: 0.01,
        profitLoss: 10,
        riskExposure: 0.3,
        orderBookDepth: 1000,
        spreadTightness: 0.002,
        inventoryBalance: 5000,
        activeOrders: 5,
        completedTrades: 6,
        errorCount: 0
      };

      (monitor as any).processMetricsUpdate(strategyId, lowFillRateMetrics);

      // Trigger anomaly detection
      (monitor as any).performAnomalyDetection();

      expect(anomalyDetectedSpy).toHaveBeenCalledWith({
        strategyId,
        anomaly: expect.objectContaining({
          type: 'low_fill_rate',
          severity: 'medium'
        })
      });
    });

    test('should detect high error rate anomaly', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const anomalyDetectedSpy = jest.fn();
      monitor.on('anomaly_detected', anomalyDetectedSpy);

      // Add metrics with errors
      for (let i = 0; i < 6; i++) {
        const errorMetrics: StrategyMetrics = {
          strategyId,
          instanceId,
          timestamp: Date.now() + i * 1000,
          executionLatency: 100,
          fillRate: 0.8,
          slippage: 0.01,
          profitLoss: 10,
          riskExposure: 0.3,
          orderBookDepth: 1000,
          spreadTightness: 0.002,
          inventoryBalance: 5000,
          activeOrders: 5,
          completedTrades: i,
          errorCount: 1 // Each metric has errors
        };

        (monitor as any).processMetricsUpdate(strategyId, errorMetrics);
      }

      // Trigger anomaly detection
      (monitor as any).performAnomalyDetection();

      expect(anomalyDetectedSpy).toHaveBeenCalledWith({
        strategyId,
        anomaly: expect.objectContaining({
          type: 'high_error_rate',
          severity: 'critical'
        })
      });
    });
  });

  describe('Alert System', () => {
    test('should trigger alerts for performance thresholds', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const alertTriggeredSpy = jest.fn();
      monitor.on('alert_triggered', alertTriggeredSpy);

      // Add metrics that exceed thresholds
      const thresholdExceedingMetrics: StrategyMetrics = {
        strategyId,
        instanceId,
        timestamp: Date.now(),
        executionLatency: 2000, // Exceeds default threshold of 1000ms
        fillRate: 0.5, // Below default threshold of 0.8
        slippage: 0.05, // Exceeds default threshold of 0.02
        profitLoss: -100,
        riskExposure: 0.3,
        orderBookDepth: 1000,
        spreadTightness: 0.002,
        inventoryBalance: 5000,
        activeOrders: 5,
        completedTrades: 10,
        errorCount: 3 // Has errors
      };

      (monitor as any).processMetricsUpdate(strategyId, thresholdExceedingMetrics);

      // Trigger alert checking
      (monitor as any).checkAlertConditions();

      expect(alertTriggeredSpy).toHaveBeenCalledTimes(4); // Should trigger 4 alerts

      const alerts = monitor.getStrategyAlerts(strategyId);
      expect(alerts.length).toBeGreaterThan(0);
      
      const alertTypes = alerts.map(alert => alert.title);
      expect(alertTypes).toContain('High Execution Latency');
      expect(alertTypes).toContain('Low Fill Rate');
      expect(alertTypes).toContain('High Slippage');
      expect(alertTypes).toContain('Strategy Errors Detected');
    });

    test('should limit alerts history', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      // Generate many alerts
      for (let i = 0; i < 60; i++) {
        const alertMetrics: StrategyMetrics = {
          strategyId,
          instanceId,
          timestamp: Date.now() + i * 1000,
          executionLatency: 2000, // Always exceeds threshold
          fillRate: 0.8,
          slippage: 0.01,
          profitLoss: 10,
          riskExposure: 0.3,
          orderBookDepth: 1000,
          spreadTightness: 0.002,
          inventoryBalance: 5000,
          activeOrders: 5,
          completedTrades: i,
          errorCount: 0
        };

        (monitor as any).processMetricsUpdate(strategyId, alertMetrics);
        (monitor as any).checkAlertConditions();
      }

      const alerts = monitor.getStrategyAlerts(strategyId);
      expect(alerts.length).toBe(50); // Should be limited to 50
    });
  });

  describe('Strategy Adjustments', () => {
    test('should execute manual strategy adjustment', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const strategyAdjustedSpy = jest.fn();
      monitor.on('strategy_adjusted', strategyAdjustedSpy);

      const adjustment = {
        strategyId,
        adjustmentType: 'parameter_update' as const,
        parameters: { bidSpread: 0.2 },
        reason: 'Manual adjustment for testing'
      };

      await monitor.triggerStrategyAdjustment(strategyId, adjustment);

      expect(strategyAdjustedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ...adjustment,
          timestamp: expect.any(Number)
        })
      );

      const adjustments = monitor.getStrategyAdjustments(strategyId);
      expect(adjustments).toHaveLength(1);
      expect(adjustments[0].adjustmentType).toBe('parameter_update');
    });

    test('should trigger automatic adjustment on critical anomaly', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const automaticAdjustmentSpy = jest.fn();
      monitor.on('automatic_adjustment', automaticAdjustmentSpy);

      // Create a critical anomaly
      const criticalAnomaly: Anomaly = {
        id: 'test-anomaly',
        strategyId,
        type: 'high_error_rate',
        severity: 'critical',
        description: 'Critical error rate detected',
        detectedAt: Date.now(),
        metrics: { errorCount: 10 },
        threshold: 5,
        actualValue: 10,
        resolved: false
      };

      // Trigger automatic adjustment check
      (monitor as any).checkForAutomaticAdjustments(strategyId, 'anomaly', criticalAnomaly);

      // Wait for async adjustment execution
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(automaticAdjustmentSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          strategyId,
          adjustmentType: 'pause',
          reason: 'Critical anomaly detected: high_error_rate'
        })
      );
    });

    test('should handle adjustment execution failure gracefully', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      // Mock executeStrategyAdjustment to throw error
      const originalExecute = (monitor as any).executeStrategyAdjustment;
      (monitor as any).executeStrategyAdjustment = jest.fn().mockRejectedValue(new Error('Adjustment failed'));

      const adjustment = {
        strategyId,
        adjustmentType: 'stop' as const,
        reason: 'Test adjustment failure'
      };

      await expect(monitor.triggerStrategyAdjustment(strategyId, adjustment))
        .rejects.toThrow('Adjustment failed');

      // Restore original method
      (monitor as any).executeStrategyAdjustment = originalExecute;
    });
  });

  describe('Configuration Management', () => {
    test('should update configuration correctly', () => {
      const newConfig = {
        metricsCollectionInterval: 2000,
        performanceThresholds: {
          maxExecutionLatency: 500,
          minFillRate: 0.9,
          maxSlippage: 0.01,
          maxDrawdown: 0.05,
          minProfitability: 0,
          maxErrorRate: 0.02
        }
      };

      monitor.updateConfig(newConfig);

      const currentConfig = monitor.getConfig();
      expect(currentConfig.metricsCollectionInterval).toBe(2000);
      expect(currentConfig.performanceThresholds.maxExecutionLatency).toBe(500);
      expect(currentConfig.performanceThresholds.minFillRate).toBe(0.9);
    });

    test('should return current configuration', () => {
      const config = monitor.getConfig();
      
      expect(config).toHaveProperty('metricsCollectionInterval');
      expect(config).toHaveProperty('anomalyDetectionInterval');
      expect(config).toHaveProperty('alertCheckInterval');
      expect(config).toHaveProperty('performanceThresholds');
      expect(config).toHaveProperty('anomalyThresholds');
    });
  });

  describe('Monitoring Status', () => {
    test('should return correct monitoring status', async () => {
      const strategy1Id = 'test-strategy-1';
      const strategy2Id = 'test-strategy-2';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategy1Id, instanceId, mockStrategy);
      await monitor.startStrategyMonitoring(strategy2Id, instanceId, mockStrategy);

      const status = monitor.getMonitoringStatus();
      expect(status.totalStrategies).toBe(2);
      expect(status.activeStrategies).toBe(2);
      expect(status.totalAnomalies).toBe(0);
      expect(status.totalAlerts).toBe(0);
      expect(status.totalAdjustments).toBe(0);

      // Stop one strategy
      await monitor.stopStrategyMonitoring(strategy1Id);

      const updatedStatus = monitor.getMonitoringStatus();
      expect(updatedStatus.totalStrategies).toBe(1);
      expect(updatedStatus.activeStrategies).toBe(1);
    });
  });

  describe('WebSocket Handling', () => {
    test('should handle WebSocket messages correctly', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const metricsUpdatedSpy = jest.fn();
      const orderUpdatedSpy = jest.fn();
      const tradeUpdatedSpy = jest.fn();
      const strategyErrorSpy = jest.fn();

      monitor.on('metrics_updated', metricsUpdatedSpy);
      monitor.on('order_updated', orderUpdatedSpy);
      monitor.on('trade_updated', tradeUpdatedSpy);
      monitor.on('strategy_error', strategyErrorSpy);

      // Test metrics update message
      (monitor as any).handleWebSocketMessage(strategyId, {
        type: 'metrics_update',
        data: {
          executionLatency: 150,
          fillRate: 0.85,
          slippage: 0.01
        }
      });

      expect(metricsUpdatedSpy).toHaveBeenCalled();

      // Test order update message
      (monitor as any).handleWebSocketMessage(strategyId, {
        type: 'order_update',
        data: { orderId: 'order-1', status: 'filled' }
      });

      expect(orderUpdatedSpy).toHaveBeenCalledWith({
        strategyId,
        order: { orderId: 'order-1', status: 'filled' }
      });

      // Test trade update message
      (monitor as any).handleWebSocketMessage(strategyId, {
        type: 'trade_update',
        data: { tradeId: 'trade-1', amount: 100 }
      });

      expect(tradeUpdatedSpy).toHaveBeenCalledWith({
        strategyId,
        trade: { tradeId: 'trade-1', amount: 100 }
      });

      // Test error message
      (monitor as any).handleWebSocketMessage(strategyId, {
        type: 'error',
        data: { message: 'Connection lost', severity: 'high' }
      });

      expect(strategyErrorSpy).toHaveBeenCalledWith({
        strategyId,
        error: { message: 'Connection lost', severity: 'high' }
      });
    });

    test('should handle WebSocket disconnection and reconnection', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const websocketDisconnectedSpy = jest.fn();
      monitor.on('websocket_disconnected', websocketDisconnectedSpy);

      // Simulate WebSocket disconnection
      (monitor as any).handleWebSocketDisconnection(strategyId);

      expect(websocketDisconnectedSpy).toHaveBeenCalledWith({ strategyId });
    });
  });

  describe('Cleanup and Shutdown', () => {
    test('should stop monitoring cleanly', () => {
      const status = monitor.getMonitoringStatus();
      expect(status.totalStrategies).toBe(0);

      monitor.stop();

      // Should not throw any errors
      expect(() => monitor.getMonitoringStatus()).not.toThrow();
    });

    test('should clear all monitoring sessions on stop', async () => {
      const strategyId = 'test-strategy-1';
      const instanceId = 'test-instance-1';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      let status = monitor.getMonitoringStatus();
      expect(status.totalStrategies).toBe(1);

      monitor.stop();

      status = monitor.getMonitoringStatus();
      expect(status.totalStrategies).toBe(0);
    });
  });
});