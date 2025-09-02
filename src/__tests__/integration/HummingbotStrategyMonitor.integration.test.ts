/**
 * Integration tests for HummingbotStrategyMonitor
 * Tests the complete monitoring workflow including real-time tracking,
 * anomaly detection, alerting, and automatic adjustments
 */

import { HummingbotStrategyMonitor } from '../../services/HummingbotStrategyMonitor';
import { HBStrategy, StrategyMetrics } from '../../types/hummingbot';
import { EventEmitter } from 'events';

// Mock dependencies
jest.mock('../../services/AnomalyDetectionService');
jest.mock('../../services/AlertNotificationService');
jest.mock('../../services/PerformanceMonitoringService');
jest.mock('../../utils/logger');
jest.mock('ws');

describe('HummingbotStrategyMonitor - Integration Tests', () => {
  let monitor: HummingbotStrategyMonitor;
  let mockStrategy: HBStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    
    monitor = new HummingbotStrategyMonitor({
      metricsCollectionInterval: 100, // Fast intervals for testing
      anomalyDetectionInterval: 200,
      alertCheckInterval: 300,
      websocketReconnectDelay: 50,
      performanceThresholds: {
        maxExecutionLatency: 500,
        minFillRate: 0.7,
        maxSlippage: 0.03,
        maxDrawdown: 0.15,
        minProfitability: -0.1,
        maxErrorRate: 0.1
      },
      anomalyThresholds: {
        latencyMultiplier: 2.0,
        fillRateDeviation: 0.2,
        slippageMultiplier: 1.5,
        volumeDeviation: 0.4,
        priceDeviation: 0.08,
        consecutiveErrors: 3
      }
    });

    mockStrategy = {
      id: 'integration-test-strategy',
      type: 'pure_market_making',
      exchange: 'binance',
      tradingPair: 'BTC/USDT',
      parameters: {
        bidSpread: 0.1,
        askSpread: 0.1,
        orderAmount: 100,
        orderLevels: 3
      },
      riskLimits: {
        maxPositionSize: 1000,
        maxDailyLoss: 200,
        maxOpenOrders: 15,
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

  describe('Complete Monitoring Workflow', () => {
    test('should handle complete strategy lifecycle with monitoring', async () => {
      const strategyId = 'integration-test-strategy';
      const instanceId = 'integration-test-instance';

      // Track all events
      const events: Array<{ type: string; data: any; timestamp: number }> = [];
      
      const eventTypes = [
        'monitoring_started',
        'websocket_connected',
        'metrics_updated',
        'anomaly_detected',
        'alert_triggered',
        'automatic_adjustment',
        'strategy_adjusted',
        'monitoring_stopped'
      ];

      eventTypes.forEach(eventType => {
        monitor.on(eventType, (data) => {
          events.push({ type: eventType, data, timestamp: Date.now() });
        });
      });

      // Start monitoring
      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      // Simulate normal operation with good metrics
      const normalMetrics: StrategyMetrics = {
        strategyId,
        instanceId,
        timestamp: Date.now(),
        executionLatency: 200,
        fillRate: 0.85,
        slippage: 0.015,
        profitLoss: 100,
        riskExposure: 0.4,
        orderBookDepth: 1500,
        spreadTightness: 0.002,
        inventoryBalance: 7500,
        activeOrders: 8,
        completedTrades: 45,
        errorCount: 0
      };

      (monitor as any).processMetricsUpdate(strategyId, normalMetrics);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify normal operation
      expect(events.some(e => e.type === 'monitoring_started')).toBe(true);
      expect(events.some(e => e.type === 'metrics_updated')).toBe(true);

      // Simulate performance degradation
      const degradedMetrics: StrategyMetrics = {
        strategyId,
        instanceId,
        timestamp: Date.now() + 1000,
        executionLatency: 800, // High latency
        fillRate: 0.5, // Low fill rate
        slippage: 0.04, // High slippage
        profitLoss: -50, // Loss
        riskExposure: 0.4,
        orderBookDepth: 1500,
        spreadTightness: 0.002,
        inventoryBalance: 7500,
        activeOrders: 8,
        completedTrades: 46,
        errorCount: 2 // Errors
      };

      (monitor as any).processMetricsUpdate(strategyId, degradedMetrics);

      // Trigger anomaly detection and alert checking
      (monitor as any).performAnomalyDetection();
      (monitor as any).checkAlertConditions();

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify alerts and anomalies were detected
      expect(events.some(e => e.type === 'alert_triggered')).toBe(true);

      const alerts = monitor.getStrategyAlerts(strategyId);
      expect(alerts.length).toBeGreaterThan(0);

      // Stop monitoring
      await monitor.stopStrategyMonitoring(strategyId);

      expect(events.some(e => e.type === 'monitoring_stopped')).toBe(true);

      // Verify final state
      const finalStatus = monitor.getMonitoringStatus();
      expect(finalStatus.totalStrategies).toBe(0);
      expect(finalStatus.activeStrategies).toBe(0);
    });

    test('should handle multiple strategies with different performance patterns', async () => {
      const strategy1Id = 'strategy-1';
      const strategy2Id = 'strategy-2';
      const strategy3Id = 'strategy-3';
      const instanceId = 'test-instance';

      // Start monitoring multiple strategies
      await Promise.all([
        monitor.startStrategyMonitoring(strategy1Id, instanceId, mockStrategy),
        monitor.startStrategyMonitoring(strategy2Id, instanceId, mockStrategy),
        monitor.startStrategyMonitoring(strategy3Id, instanceId, mockStrategy)
      ]);

      const alertTriggeredSpy = jest.fn();
      const anomalyDetectedSpy = jest.fn();
      monitor.on('alert_triggered', alertTriggeredSpy);
      monitor.on('anomaly_detected', anomalyDetectedSpy);

      // Strategy 1: Good performance
      const goodMetrics: StrategyMetrics = {
        strategyId: strategy1Id,
        instanceId,
        timestamp: Date.now(),
        executionLatency: 150,
        fillRate: 0.9,
        slippage: 0.01,
        profitLoss: 200,
        riskExposure: 0.3,
        orderBookDepth: 2000,
        spreadTightness: 0.001,
        inventoryBalance: 10000,
        activeOrders: 10,
        completedTrades: 100,
        errorCount: 0
      };

      // Strategy 2: Poor performance
      const poorMetrics: StrategyMetrics = {
        strategyId: strategy2Id,
        instanceId,
        timestamp: Date.now(),
        executionLatency: 1000, // High latency
        fillRate: 0.4, // Low fill rate
        slippage: 0.05, // High slippage
        profitLoss: -150, // Loss
        riskExposure: 0.8, // High risk
        orderBookDepth: 500,
        spreadTightness: 0.005,
        inventoryBalance: 3000,
        activeOrders: 3,
        completedTrades: 20,
        errorCount: 5 // Many errors
      };

      // Strategy 3: Average performance
      const averageMetrics: StrategyMetrics = {
        strategyId: strategy3Id,
        instanceId,
        timestamp: Date.now(),
        executionLatency: 300,
        fillRate: 0.75,
        slippage: 0.02,
        profitLoss: 50,
        riskExposure: 0.5,
        orderBookDepth: 1000,
        spreadTightness: 0.003,
        inventoryBalance: 6000,
        activeOrders: 6,
        completedTrades: 60,
        errorCount: 1
      };

      // Process metrics for all strategies
      (monitor as any).processMetricsUpdate(strategy1Id, goodMetrics);
      (monitor as any).processMetricsUpdate(strategy2Id, poorMetrics);
      (monitor as any).processMetricsUpdate(strategy3Id, averageMetrics);

      // Trigger analysis
      (monitor as any).checkAlertConditions();

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify different strategies triggered different numbers of alerts
      const strategy1Alerts = monitor.getStrategyAlerts(strategy1Id);
      const strategy2Alerts = monitor.getStrategyAlerts(strategy2Id);
      const strategy3Alerts = monitor.getStrategyAlerts(strategy3Id);

      expect(strategy1Alerts.length).toBe(0); // Good performance, no alerts
      expect(strategy2Alerts.length).toBeGreaterThan(3); // Poor performance, multiple alerts
      expect(strategy3Alerts.length).toBeLessThan(strategy2Alerts.length); // Average performance

      // Verify monitoring status
      const status = monitor.getMonitoringStatus();
      expect(status.totalStrategies).toBe(3);
      expect(status.activeStrategies).toBe(3);
      expect(status.totalAlerts).toBeGreaterThan(0);
    });
  });

  describe('Real-time Performance Tracking', () => {
    test('should track performance trends over time', async () => {
      const strategyId = 'trend-test-strategy';
      const instanceId = 'trend-test-instance';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const metricsUpdatedSpy = jest.fn();
      monitor.on('metrics_updated', metricsUpdatedSpy);

      // Simulate performance trend over time (degrading performance)
      const performanceTrend = [
        { latency: 100, fillRate: 0.95, trades: 10, profit: 100 },
        { latency: 150, fillRate: 0.90, trades: 18, profit: 180 },
        { latency: 200, fillRate: 0.85, trades: 25, profit: 240 },
        { latency: 300, fillRate: 0.80, trades: 30, profit: 280 },
        { latency: 450, fillRate: 0.70, trades: 33, profit: 300 },
        { latency: 600, fillRate: 0.60, trades: 35, profit: 310 },
        { latency: 800, fillRate: 0.50, trades: 36, profit: 300 }
      ];

      for (let i = 0; i < performanceTrend.length; i++) {
        const trend = performanceTrend[i];
        const metrics: StrategyMetrics = {
          strategyId,
          instanceId,
          timestamp: Date.now() + i * 1000,
          executionLatency: trend.latency,
          fillRate: trend.fillRate,
          slippage: 0.01 + (i * 0.002),
          profitLoss: trend.profit,
          riskExposure: 0.3 + (i * 0.05),
          orderBookDepth: 1000,
          spreadTightness: 0.002,
          inventoryBalance: 5000,
          activeOrders: 5,
          completedTrades: trend.trades,
          errorCount: Math.floor(i / 2)
        };

        (monitor as any).processMetricsUpdate(strategyId, metrics);
        
        // Small delay to simulate real-time updates
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      expect(metricsUpdatedSpy).toHaveBeenCalledTimes(7);

      const metricsHistory = monitor.getStrategyMetricsHistory(strategyId);
      expect(metricsHistory).toHaveLength(7);

      // Verify trend tracking
      expect(metricsHistory[0].executionLatency).toBe(100);
      expect(metricsHistory[6].executionLatency).toBe(800);
      expect(metricsHistory[0].fillRate).toBe(0.95);
      expect(metricsHistory[6].fillRate).toBe(0.50);

      // Trigger anomaly detection on the trend
      (monitor as any).performAnomalyDetection();

      const anomalies = monitor.getStrategyAnomalies(strategyId);
      expect(anomalies.length).toBeGreaterThan(0);

      // Should detect performance degradation
      const latencyAnomalies = anomalies.filter(a => a.type === 'high_latency');
      const fillRateAnomalies = anomalies.filter(a => a.type === 'low_fill_rate');
      
      expect(latencyAnomalies.length).toBeGreaterThan(0);
      expect(fillRateAnomalies.length).toBeGreaterThan(0);
    });

    test('should handle rapid metric updates without data loss', async () => {
      const strategyId = 'rapid-update-strategy';
      const instanceId = 'rapid-update-instance';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const updateCount = 200;
      const startTime = Date.now();

      // Send rapid updates
      for (let i = 0; i < updateCount; i++) {
        const metrics: StrategyMetrics = {
          strategyId,
          instanceId,
          timestamp: Date.now() + i,
          executionLatency: 100 + (i % 50),
          fillRate: 0.8 + (i % 20) * 0.01,
          slippage: 0.01 + (i % 10) * 0.001,
          profitLoss: i * 2,
          riskExposure: 0.3,
          orderBookDepth: 1000,
          spreadTightness: 0.002,
          inventoryBalance: 5000,
          activeOrders: 5,
          completedTrades: i,
          errorCount: i % 10 === 0 ? 1 : 0
        };

        (monitor as any).processMetricsUpdate(strategyId, metrics);
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should process all updates quickly
      expect(processingTime).toBeLessThan(2000);

      const metricsHistory = monitor.getStrategyMetricsHistory(strategyId);
      expect(metricsHistory).toHaveLength(updateCount);

      // Verify data integrity
      const latestMetrics = monitor.getStrategyMetrics(strategyId);
      expect(latestMetrics?.completedTrades).toBe(updateCount - 1);
      expect(latestMetrics?.profitLoss).toBe((updateCount - 1) * 2);
    });
  });

  describe('Automatic Adjustment Integration', () => {
    test('should trigger automatic adjustments based on performance patterns', async () => {
      const strategyId = 'auto-adjust-strategy';
      const instanceId = 'auto-adjust-instance';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const automaticAdjustmentSpy = jest.fn();
      monitor.on('automatic_adjustment', automaticAdjustmentSpy);

      // Simulate baseline performance
      for (let i = 0; i < 5; i++) {
        const baselineMetrics: StrategyMetrics = {
          strategyId,
          instanceId,
          timestamp: Date.now() + i * 1000,
          executionLatency: 150,
          fillRate: 0.85,
          slippage: 0.015,
          profitLoss: i * 20,
          riskExposure: 0.3,
          orderBookDepth: 1000,
          spreadTightness: 0.002,
          inventoryBalance: 5000,
          activeOrders: 5,
          completedTrades: i * 5,
          errorCount: 0
        };

        (monitor as any).processMetricsUpdate(strategyId, baselineMetrics);
      }

      // Simulate critical performance issue
      const criticalMetrics: StrategyMetrics = {
        strategyId,
        instanceId,
        timestamp: Date.now() + 6000,
        executionLatency: 500, // High latency (3.3x baseline)
        fillRate: 0.85,
        slippage: 0.015,
        profitLoss: 100,
        riskExposure: 0.3,
        orderBookDepth: 1000,
        spreadTightness: 0.002,
        inventoryBalance: 5000,
        activeOrders: 5,
        completedTrades: 25,
        errorCount: 0
      };

      (monitor as any).processMetricsUpdate(strategyId, criticalMetrics);

      // Trigger anomaly detection
      (monitor as any).performAnomalyDetection();

      // Wait for automatic adjustment processing
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(automaticAdjustmentSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          strategyId,
          adjustmentType: 'parameter_update',
          reason: 'High latency detected, increasing order refresh time'
        })
      );

      const adjustments = monitor.getStrategyAdjustments(strategyId);
      expect(adjustments).toHaveLength(1);
      expect(adjustments[0].parameters).toEqual({ orderRefreshTime: 60 });
    });

    test('should handle cascading adjustments for multiple issues', async () => {
      const strategyId = 'cascade-adjust-strategy';
      const instanceId = 'cascade-adjust-instance';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const automaticAdjustmentSpy = jest.fn();
      monitor.on('automatic_adjustment', automaticAdjustmentSpy);

      // Simulate multiple critical issues
      const criticalErrorData = {
        message: 'Exchange connection lost',
        severity: 'critical',
        timestamp: Date.now()
      };

      // Trigger error-based adjustment
      (monitor as any).checkForAutomaticAdjustments(strategyId, 'error', criticalErrorData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(automaticAdjustmentSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          strategyId,
          adjustmentType: 'stop',
          reason: 'Critical error detected: Exchange connection lost'
        })
      );

      const adjustments = monitor.getStrategyAdjustments(strategyId);
      expect(adjustments).toHaveLength(1);
      expect(adjustments[0].adjustmentType).toBe('stop');
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle monitoring errors gracefully', async () => {
      const strategyId = 'error-handling-strategy';
      const instanceId = 'error-handling-instance';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Simulate error in metrics processing
      const invalidMetrics = null as any;
      
      expect(() => {
        (monitor as any).processMetricsUpdate(strategyId, invalidMetrics);
      }).not.toThrow();

      // Simulate error in anomaly detection
      const originalDetectAnomalies = (monitor as any).detectStrategyAnomalies;
      (monitor as any).detectStrategyAnomalies = jest.fn().mockImplementation(() => {
        throw new Error('Anomaly detection failed');
      });

      expect(() => {
        (monitor as any).performAnomalyDetection();
      }).not.toThrow();

      // Restore original method
      (monitor as any).detectStrategyAnomalies = originalDetectAnomalies;
      consoleSpy.mockRestore();
    });

    test('should maintain monitoring state consistency during errors', async () => {
      const strategyId = 'consistency-test-strategy';
      const instanceId = 'consistency-test-instance';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      // Add some valid metrics
      const validMetrics: StrategyMetrics = {
        strategyId,
        instanceId,
        timestamp: Date.now(),
        executionLatency: 200,
        fillRate: 0.8,
        slippage: 0.02,
        profitLoss: 50,
        riskExposure: 0.4,
        orderBookDepth: 1000,
        spreadTightness: 0.002,
        inventoryBalance: 5000,
        activeOrders: 5,
        completedTrades: 10,
        errorCount: 0
      };

      (monitor as any).processMetricsUpdate(strategyId, validMetrics);

      // Verify state before error
      let status = monitor.getMonitoringStatus();
      expect(status.totalStrategies).toBe(1);
      expect(status.activeStrategies).toBe(1);

      const metricsBefore = monitor.getStrategyMetrics(strategyId);
      expect(metricsBefore).not.toBeNull();

      // Simulate processing error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      try {
        (monitor as any).processMetricsUpdate(strategyId, null);
      } catch (error) {
        // Error should be handled gracefully
      }

      // Verify state consistency after error
      status = monitor.getMonitoringStatus();
      expect(status.totalStrategies).toBe(1);
      expect(status.activeStrategies).toBe(1);

      const metricsAfter = monitor.getStrategyMetrics(strategyId);
      expect(metricsAfter).toEqual(metricsBefore);

      consoleSpy.mockRestore();
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle monitoring of many strategies efficiently', async () => {
      const strategyCount = 50;
      const instanceId = 'scalability-test-instance';

      const startTime = Date.now();

      // Start monitoring many strategies
      const monitoringPromises = [];
      for (let i = 0; i < strategyCount; i++) {
        const strategyId = `strategy-${i}`;
        monitoringPromises.push(
          monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy)
        );
      }

      await Promise.all(monitoringPromises);

      const setupTime = Date.now() - startTime;
      expect(setupTime).toBeLessThan(5000); // Should setup quickly

      // Verify all strategies are monitored
      const status = monitor.getMonitoringStatus();
      expect(status.totalStrategies).toBe(strategyCount);
      expect(status.activeStrategies).toBe(strategyCount);

      // Send metrics updates to all strategies
      const metricsStartTime = Date.now();

      for (let i = 0; i < strategyCount; i++) {
        const strategyId = `strategy-${i}`;
        const metrics: StrategyMetrics = {
          strategyId,
          instanceId,
          timestamp: Date.now(),
          executionLatency: 100 + i,
          fillRate: 0.8 + (i * 0.001),
          slippage: 0.01,
          profitLoss: i * 10,
          riskExposure: 0.3,
          orderBookDepth: 1000,
          spreadTightness: 0.002,
          inventoryBalance: 5000,
          activeOrders: 5,
          completedTrades: i,
          errorCount: 0
        };

        (monitor as any).processMetricsUpdate(strategyId, metrics);
      }

      const metricsTime = Date.now() - metricsStartTime;
      expect(metricsTime).toBeLessThan(2000); // Should process quickly

      // Verify all metrics were processed
      for (let i = 0; i < strategyCount; i++) {
        const strategyId = `strategy-${i}`;
        const retrievedMetrics = monitor.getStrategyMetrics(strategyId);
        expect(retrievedMetrics).not.toBeNull();
        expect(retrievedMetrics?.completedTrades).toBe(i);
      }
    });

    test('should maintain performance with large metrics history', async () => {
      const strategyId = 'large-history-strategy';
      const instanceId = 'large-history-instance';

      await monitor.startStrategyMonitoring(strategyId, instanceId, mockStrategy);

      const metricsCount = 2000;
      const startTime = Date.now();

      // Generate large metrics history
      for (let i = 0; i < metricsCount; i++) {
        const metrics: StrategyMetrics = {
          strategyId,
          instanceId,
          timestamp: Date.now() + i,
          executionLatency: 100 + (i % 100),
          fillRate: 0.8 + (i % 20) * 0.01,
          slippage: 0.01 + (i % 10) * 0.001,
          profitLoss: i,
          riskExposure: 0.3,
          orderBookDepth: 1000,
          spreadTightness: 0.002,
          inventoryBalance: 5000,
          activeOrders: 5,
          completedTrades: i,
          errorCount: i % 50 === 0 ? 1 : 0
        };

        (monitor as any).processMetricsUpdate(strategyId, metrics);
      }

      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(5000); // Should handle large volume

      // Verify history is properly limited
      const metricsHistory = monitor.getStrategyMetricsHistory(strategyId);
      expect(metricsHistory).toHaveLength(1000); // Should be limited

      // Verify latest metrics are preserved
      const latestMetrics = monitor.getStrategyMetrics(strategyId);
      expect(latestMetrics?.completedTrades).toBe(metricsCount - 1);

      // Performance check for retrieval
      const retrievalStartTime = Date.now();
      const history = monitor.getStrategyMetricsHistory(strategyId, 500);
      const retrievalTime = Date.now() - retrievalStartTime;

      expect(retrievalTime).toBeLessThan(100); // Should retrieve quickly
      expect(history).toHaveLength(500);
    });
  });
});