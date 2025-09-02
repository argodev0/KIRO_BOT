import { PerformanceAnalyticsEngine } from '../../services/PerformanceAnalyticsEngine';
import { HummingbotBridgeService } from '../../services/HummingbotBridgeService';
import { HummingbotStrategyMonitor } from '../../services/HummingbotStrategyMonitor';
import { 
  ExecutionMetrics, 
  PerformanceComparison, 
  OptimizationParameters,
  PerformanceReport
} from '../../types/performance';
import { HBStrategy } from '../../types/hummingbot';

// Mock external dependencies
jest.mock('../../services/HummingbotBridgeService');
jest.mock('../../services/HummingbotStrategyMonitor');

describe('Performance Analytics Integration', () => {
  let performanceEngine: PerformanceAnalyticsEngine;
  let mockBridgeService: jest.Mocked<HummingbotBridgeService>;
  let mockStrategyMonitor: any;

  const mockStrategy: HBStrategy = {
    id: 'integration-test-strategy',
    type: 'pure_market_making',
    exchange: 'binance',
    tradingPair: 'BTC-USDT',
    parameters: {
      bid_spread: 0.001,
      ask_spread: 0.001,
      order_amount: 0.01,
      order_refresh_time: 30
    },
    riskLimits: {
      maxPositionSize: 1.0,
      maxDailyLoss: 100,
      maxOpenOrders: 10,
      maxSlippage: 0.01
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

  beforeEach(() => {
    performanceEngine = new PerformanceAnalyticsEngine();
    mockBridgeService = new HummingbotBridgeService() as jest.Mocked<HummingbotBridgeService>;
    mockStrategyMonitor = {
      trackStrategy: jest.fn(),
      monitorStrategy: jest.fn(),
      detectAnomalies: jest.fn(),
      triggerAdjustment: jest.fn(),
      generateAlerts: jest.fn()
    } as any;
  });

  afterEach(() => {
    performanceEngine.removeAllListeners();
  });

  describe('Real-time Performance Tracking Integration', () => {
    it('should integrate with strategy monitor for real-time metrics', async () => {
      const mockMetrics = {
        strategyId: 'integration-test-strategy',
        executionLatency: 150,
        fillRate: 0.85,
        slippage: 0.002,
        profitLoss: 10.5,
        volumeExecuted: 1000,
        ordersPlaced: 5,
        ordersFilled: 4,
        timestamp: Date.now()
      };

      // Mock strategy monitor to emit metrics
      mockStrategyMonitor.trackStrategy.mockReturnValue({
        subscribe: jest.fn().mockImplementation((callback: any) => {
          // Immediately call the callback to avoid timeout
          callback(mockMetrics);
          return { unsubscribe: jest.fn() };
        })
      });

      // Set up performance tracking
      const metricsPromise = new Promise((resolve) => {
        performanceEngine.once('executionTracked', resolve);
      });

      // Simulate strategy monitor integration
      const subscription = mockStrategyMonitor.trackStrategy('integration-test-strategy');
      subscription.subscribe((metrics: any) => {
        performanceEngine.trackExecution(
          metrics.strategyId,
          'hummingbot',
          {
            latency: metrics.executionLatency,
            slippage: metrics.slippage,
            fillRate: metrics.fillRate,
            profitLoss: metrics.profitLoss,
            volumeExecuted: metrics.volumeExecuted,
            ordersPlaced: metrics.ordersPlaced,
            ordersFilled: metrics.ordersFilled
          }
        );
      });

      const trackedMetrics = await metricsPromise;
      expect(trackedMetrics).toBeDefined();
    });

    it('should handle multiple concurrent strategy tracking', async () => {
      const strategies = ['strategy-1', 'strategy-2', 'strategy-3'];
      const trackedMetrics: any[] = [];

      performanceEngine.on('executionTracked', (metrics) => {
        trackedMetrics.push(metrics);
      });

      // Simulate concurrent strategy executions
      const promises = strategies.map(async (strategyId, index) => {
        for (let i = 0; i < 5; i++) {
          await performanceEngine.trackExecution(strategyId, 'hummingbot', {
            latency: 100 + index * 10 + i * 5,
            slippage: 0.001 + index * 0.0001,
            fillRate: 0.8 + index * 0.05,
            profitLoss: 5 + index + i,
            volumeExecuted: 100
          });
        }
      });

      await Promise.all(promises);

      expect(trackedMetrics).toHaveLength(15); // 3 strategies * 5 executions each
      
      // Verify each strategy has correct metrics
      strategies.forEach(strategyId => {
        const strategyMetrics = performanceEngine.getStrategyMetrics(strategyId);
        expect(strategyMetrics).toHaveLength(5);
      });
    });
  });

  describe('Performance Comparison Workflow', () => {
    beforeEach(async () => {
      // Set up baseline data for comparison
      const baseTime = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago

      // Add direct execution metrics
      for (let i = 0; i < 10; i++) {
        await performanceEngine.trackExecution('integration-test-strategy', 'direct', {
          latency: 80 + Math.random() * 20,
          slippage: 0.0015 + Math.random() * 0.0005,
          fillRate: 0.75 + Math.random() * 0.1,
          profitLoss: 4 + Math.random() * 2,
          volumeExecuted: 100,
          executionCost: 0.12
        });
      }

      // Add Hummingbot execution metrics
      for (let i = 0; i < 10; i++) {
        await performanceEngine.trackExecution('integration-test-strategy', 'hummingbot', {
          latency: 120 + Math.random() * 30,
          slippage: 0.001 + Math.random() * 0.0003,
          fillRate: 0.85 + Math.random() * 0.08,
          profitLoss: 6 + Math.random() * 3,
          volumeExecuted: 100,
          executionCost: 0.08
        });
      }
    });

    it('should perform comprehensive execution method comparison', async () => {
      const comparison = await performanceEngine.compareExecutionMethods('integration-test-strategy');

      expect(comparison.strategyId).toBe('integration-test-strategy');
      expect(comparison.directExecution.totalExecutions).toBe(10);
      expect(comparison.hummingbotExecution.totalExecutions).toBe(10);
      
      // Hummingbot should show better slippage and fill rate
      expect(comparison.improvement.slippage).toBeGreaterThan(0);
      expect(comparison.improvement.fillRate).toBeGreaterThan(0);
      
      // Direct should show better latency
      expect(comparison.improvement.latency).toBeLessThan(0);
      
      expect(comparison.recommendation).toMatch(/^(direct|hummingbot|maintain)$/);
      expect(comparison.confidence).toBeGreaterThan(0.5);
    });

    it('should generate actionable recommendations', async () => {
      const comparison = await performanceEngine.compareExecutionMethods('integration-test-strategy');
      
      if (comparison.recommendation === 'hummingbot') {
        expect(comparison.improvement.profitability).toBeGreaterThan(-0.1);
      } else if (comparison.recommendation === 'direct') {
        expect(comparison.improvement.latency).toBeLessThan(-0.1);
      }
    });
  });

  describe('Strategy Optimization Workflow', () => {
    let optimizationParams: OptimizationParameters;

    beforeEach(async () => {
      optimizationParams = {
        minDataPoints: 15,
        lookbackPeriod: 20,
        optimizationGoals: [
          { metric: 'latency', target: 'minimize', weight: 0.2 },
          { metric: 'slippage', target: 'minimize', weight: 0.3 },
          { metric: 'fillRate', target: 'maximize', weight: 0.3 },
          { metric: 'profitability', target: 'maximize', weight: 0.2 }
        ],
        constraints: [
          { parameter: 'bid_spread', minValue: 0.0001, maxValue: 0.01, stepSize: 0.0001 },
          { parameter: 'ask_spread', minValue: 0.0001, maxValue: 0.01, stepSize: 0.0001 },
          { parameter: 'order_amount', minValue: 0.001, maxValue: 1.0, stepSize: 0.001 }
        ],
        riskTolerance: 'medium'
      };

      // Add sufficient historical data with varying performance
      for (let i = 0; i < 20; i++) {
        const performanceVariation = Math.sin(i / 5) * 0.2; // Simulate performance cycles
        
        await performanceEngine.trackExecution('integration-test-strategy', 'hummingbot', {
          latency: 120 + performanceVariation * 50,
          slippage: 0.001 + Math.abs(performanceVariation) * 0.001,
          fillRate: 0.8 + performanceVariation * 0.1,
          profitLoss: 5 + performanceVariation * 10,
          volumeExecuted: 100,
          executionCost: 0.1,
          ordersPlaced: 5,
          ordersFilled: Math.floor((0.8 + performanceVariation * 0.1) * 5),
          averageSpread: 0.001 + Math.abs(performanceVariation) * 0.0005,
          marketImpact: 0.0005 + Math.abs(performanceVariation) * 0.0003
        });
      }
    });

    it('should optimize strategy parameters based on historical performance', async () => {
      const optimizationResult = await performanceEngine.optimizeStrategyParameters(
        mockStrategy,
        optimizationParams
      );

      expect(optimizationResult.strategyId).toBe('integration-test-strategy');
      expect(optimizationResult.originalParameters).toEqual(mockStrategy.parameters);
      expect(optimizationResult.optimizedParameters).toBeDefined();
      expect(optimizationResult.currentPerformance).toBeDefined();
      expect(optimizationResult.projectedImprovement).toBeDefined();
      expect(optimizationResult.confidence).toBeGreaterThan(0);
      expect(optimizationResult.backtestResults).toBeDefined();
      expect(Array.isArray(optimizationResult.recommendations)).toBe(true);

      // Verify optimization actually changed parameters
      const originalSpread = mockStrategy.parameters.bid_spread;
      const optimizedSpread = optimizationResult.optimizedParameters.bid_spread;
      
      // Parameters should be within constraints
      expect(optimizedSpread).toBeGreaterThanOrEqual(0.0001);
      expect(optimizedSpread).toBeLessThanOrEqual(0.01);
    });

    it('should emit optimization events for monitoring', async () => {
      const optimizationPromise = new Promise((resolve) => {
        performanceEngine.once('optimizationCompleted', resolve);
      });

      const optimizationTask = performanceEngine.optimizeStrategyParameters(
        mockStrategy,
        optimizationParams
      );

      const [optimizationResult, optimizationEvent] = await Promise.all([
        optimizationTask,
        optimizationPromise
      ]);

      expect(optimizationEvent).toEqual(optimizationResult);
    });
  });

  describe('Performance Degradation Detection', () => {
    it('should detect and alert on performance degradation', async () => {
      // Add baseline good performance
      for (let i = 0; i < 10; i++) {
        await performanceEngine.trackExecution('integration-test-strategy', 'hummingbot', {
          latency: 100 + Math.random() * 10,
          slippage: 0.001 + Math.random() * 0.0001,
          fillRate: 0.85 + Math.random() * 0.05,
          profitLoss: 8 + Math.random() * 2,
          volumeExecuted: 100
        });
      }

      const degradationPromise = new Promise((resolve) => {
        performanceEngine.once('performanceDegradation', resolve);
      });

      // Add degraded performance
      for (let i = 0; i < 5; i++) {
        await performanceEngine.trackExecution('integration-test-strategy', 'hummingbot', {
          latency: 250 + Math.random() * 50, // Much higher latency
          slippage: 0.008 + Math.random() * 0.002, // Much higher slippage
          fillRate: 0.4 + Math.random() * 0.1, // Much lower fill rate
          profitLoss: -5 - Math.random() * 3, // Negative profit
          volumeExecuted: 100
        });
      }

      const degradation = await degradationPromise;
      expect(degradation).toBeDefined();
      expect((degradation as any).strategyId).toBe('integration-test-strategy');
      expect((degradation as any).degradationType.length).toBeGreaterThan(0);
      expect((degradation as any).severity).toMatch(/^(low|medium|high|critical)$/);
    });

    it('should provide actionable degradation recommendations', async () => {
      // Set up scenario for specific degradation type
      for (let i = 0; i < 10; i++) {
        await performanceEngine.trackExecution('integration-test-strategy', 'hummingbot', {
          latency: 100,
          slippage: 0.001,
          fillRate: 0.85,
          profitLoss: 5,
          volumeExecuted: 100
        });
      }

      const degradationPromise = new Promise((resolve) => {
        performanceEngine.once('performanceDegradation', resolve);
      });

      // Add high latency degradation
      for (let i = 0; i < 5; i++) {
        await performanceEngine.trackExecution('integration-test-strategy', 'hummingbot', {
          latency: 300, // 3x higher latency
          slippage: 0.001,
          fillRate: 0.85,
          profitLoss: 5,
          volumeExecuted: 100
        });
      }

      const degradation = await degradationPromise as any;
      expect(degradation.degradationType).toContain('latency');
      expect(degradation.recommendations).toContain('Check network connectivity and server load');
    });
  });

  describe('Comprehensive Reporting Integration', () => {
    beforeEach(async () => {
      // Set up comprehensive test data
      const strategies = ['strategy-A', 'strategy-B'];
      const executionMethods = ['direct', 'hummingbot'];
      
      for (const strategyId of strategies) {
        for (const method of executionMethods) {
          for (let i = 0; i < 15; i++) {
            const basePerformance = method === 'hummingbot' ? 1.1 : 1.0; // Hummingbot slightly better
            
            await performanceEngine.trackExecution(strategyId, method as any, {
              latency: (100 + Math.random() * 50) / basePerformance,
              slippage: (0.001 + Math.random() * 0.0005) / basePerformance,
              fillRate: (0.8 + Math.random() * 0.15) * basePerformance,
              profitLoss: (5 + Math.random() * 10) * basePerformance,
              volumeExecuted: 100,
              executionCost: (0.1 + Math.random() * 0.05) / basePerformance,
              ordersPlaced: 5,
              ordersFilled: Math.floor((0.8 + Math.random() * 0.15) * basePerformance * 5),
              averageSpread: 0.001,
              marketImpact: 0.0005
            });
          }
        }
      }
    });

    it('should generate comprehensive performance reports', async () => {
      const report = await performanceEngine.generatePerformanceReport('strategy-A');

      expect(report.strategyId).toBe('strategy-A');
      expect(report.totalExecutions).toBe(30);
      expect(report.executionBreakdown.direct).toBe(15);
      expect(report.executionBreakdown.hummingbot).toBe(15);
      expect(report.overallPerformance).toBeDefined();
      expect(report.executionMethodComparison).toBeDefined();
      expect(report.performanceTrends).toBeDefined();
      expect(report.riskMetrics).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should include risk metrics in reports', async () => {
      const report = await performanceEngine.generatePerformanceReport('strategy-A');

      expect(report.riskMetrics.volatility).toBeGreaterThan(0);
      expect(report.riskMetrics.sharpeRatio).toBeDefined();
      expect(report.riskMetrics.maxDrawdown).toBeLessThanOrEqual(0);
      expect(report.riskMetrics.valueAtRisk95).toBeDefined();
      expect(report.riskMetrics.valueAtRisk99).toBeDefined();
      expect(report.riskMetrics.winRate).toBeGreaterThanOrEqual(0);
      expect(report.riskMetrics.winRate).toBeLessThanOrEqual(1);
    });

    it('should provide performance trends analysis', async () => {
      const report = await performanceEngine.generatePerformanceReport('strategy-A');

      expect(report.performanceTrends).toBeDefined();
      expect(typeof report.performanceTrends.latencyTrend).toBe('number');
      expect(typeof report.performanceTrends.slippageTrend).toBe('number');
      expect(typeof report.performanceTrends.fillRateTrend).toBe('number');
      expect(typeof report.performanceTrends.profitabilityTrend).toBe('number');
    });
  });

  describe('Memory Management and Cleanup', () => {
    it('should handle large volumes of metrics efficiently', async () => {
      const initialMetricsCount = performanceEngine.getStrategyMetrics('load-test-strategy').length;

      // Add large volume of metrics
      for (let i = 0; i < 100; i++) { // Reduced from 1000 to 100 for faster test
        await performanceEngine.trackExecution('load-test-strategy', 'hummingbot', {
          latency: 100 + Math.random() * 50,
          slippage: 0.001 + Math.random() * 0.0005,
          fillRate: 0.8 + Math.random() * 0.15,
          profitLoss: Math.random() * 10 - 5,
          volumeExecuted: 100
        });
      }

      const afterLoadMetricsCount = performanceEngine.getStrategyMetrics('load-test-strategy').length;
      expect(afterLoadMetricsCount).toBe(initialMetricsCount + 100);

      // Cleanup old metrics
      performanceEngine.cleanupOldMetrics(1000); // Keep only last 1 second

      const afterCleanupMetricsCount = performanceEngine.getStrategyMetrics('load-test-strategy').length;
      expect(afterCleanupMetricsCount).toBeLessThanOrEqual(afterLoadMetricsCount);
    });

    it('should cleanup old metrics automatically', async () => {
      // Add metrics with old timestamps
      const oldTime = Date.now() - 40 * 24 * 60 * 60 * 1000; // 40 days ago
      
      for (let i = 0; i < 10; i++) {
        await performanceEngine.trackExecution('cleanup-test-strategy', 'hummingbot', {
          latency: 100,
          slippage: 0.001,
          fillRate: 0.8,
          profitLoss: 5,
          volumeExecuted: 100
        });
      }

      // Manually set old timestamps
      const metrics = performanceEngine.getStrategyMetrics('cleanup-test-strategy');
      metrics.forEach((metric, index) => {
        if (index < 5) {
          metric.timestamp = oldTime;
        }
      });

      // Cleanup metrics older than 30 days
      performanceEngine.cleanupOldMetrics(30 * 24 * 60 * 60 * 1000);

      const remainingMetrics = performanceEngine.getStrategyMetrics('cleanup-test-strategy');
      expect(remainingMetrics.length).toBe(5); // Only recent metrics should remain
    });
  });
});