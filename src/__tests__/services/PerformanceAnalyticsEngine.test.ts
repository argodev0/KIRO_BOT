import { PerformanceAnalyticsEngine } from '../../services/PerformanceAnalyticsEngine';
import { 
  ExecutionMetrics, 
  PerformanceComparison, 
  OptimizationResult,
  OptimizationParameters,
  PerformanceDegradation,
  PerformanceReport
} from '../../types/performance';
import { HBStrategy } from '../../types/hummingbot';

describe('PerformanceAnalyticsEngine', () => {
  let engine: PerformanceAnalyticsEngine;
  let mockStrategy: HBStrategy;

  beforeEach(() => {
    engine = new PerformanceAnalyticsEngine();
    mockStrategy = {
      id: 'test-strategy-1',
      type: 'pure_market_making',
      exchange: 'binance',
      tradingPair: 'BTC-USDT',
      parameters: {
        bid_spread: 0.001,
        ask_spread: 0.001,
        order_amount: 0.01
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
  });

  afterEach(() => {
    engine.removeAllListeners();
  });

  describe('trackExecution', () => {
    it('should track execution metrics correctly', async () => {
      const metrics: Partial<ExecutionMetrics> = {
        latency: 150,
        slippage: 0.002,
        fillRate: 0.85,
        executionCost: 0.5,
        profitLoss: 10.5,
        volumeExecuted: 1000,
        ordersPlaced: 5,
        ordersFilled: 4,
        averageSpread: 0.001,
        marketImpact: 0.0005
      };

      await engine.trackExecution('test-strategy-1', 'hummingbot', metrics);

      const storedMetrics = engine.getStrategyMetrics('test-strategy-1');
      expect(storedMetrics).toHaveLength(1);
      expect(storedMetrics[0].strategyId).toBe('test-strategy-1');
      expect(storedMetrics[0].executionMethod).toBe('hummingbot');
      expect(storedMetrics[0].latency).toBe(150);
      expect(storedMetrics[0].slippage).toBe(0.002);
    });

    it('should emit executionTracked event', async () => {
      const eventPromise = new Promise((resolve) => {
        engine.once('executionTracked', resolve);
      });

      await engine.trackExecution('test-strategy-1', 'direct', {
        latency: 100,
        slippage: 0.001,
        fillRate: 0.9
      });

      const event = await eventPromise;
      expect(event).toBeDefined();
    });

    it('should handle multiple executions for same strategy', async () => {
      await engine.trackExecution('test-strategy-1', 'direct', { latency: 100 });
      await engine.trackExecution('test-strategy-1', 'hummingbot', { latency: 120 });
      await engine.trackExecution('test-strategy-1', 'direct', { latency: 110 });

      const metrics = engine.getStrategyMetrics('test-strategy-1');
      expect(metrics).toHaveLength(3);
      expect(metrics[0].executionMethod).toBe('direct');
      expect(metrics[1].executionMethod).toBe('hummingbot');
      expect(metrics[2].executionMethod).toBe('direct');
    });
  });

  describe('compareExecutionMethods', () => {
    beforeEach(async () => {
      // Add sample data for both execution methods
      const baseTime = Date.now() - 60 * 60 * 1000; // 1 hour ago

      // Direct execution metrics
      for (let i = 0; i < 5; i++) {
        await engine.trackExecution('test-strategy-1', 'direct', {
          latency: 100 + i * 10,
          slippage: 0.001 + i * 0.0001,
          fillRate: 0.8 + i * 0.02,
          profitLoss: 5 + i,
          volumeExecuted: 100,
          executionCost: 0.1
        });
      }

      // Hummingbot execution metrics
      for (let i = 0; i < 5; i++) {
        await engine.trackExecution('test-strategy-1', 'hummingbot', {
          latency: 120 + i * 5,
          slippage: 0.0008 + i * 0.0001,
          fillRate: 0.85 + i * 0.01,
          profitLoss: 6 + i,
          volumeExecuted: 100,
          executionCost: 0.08
        });
      }
    });

    it('should compare execution methods correctly', async () => {
      const comparison = await engine.compareExecutionMethods('test-strategy-1');

      expect(comparison.strategyId).toBe('test-strategy-1');
      expect(comparison.directExecution).toBeDefined();
      expect(comparison.hummingbotExecution).toBeDefined();
      expect(comparison.improvement).toBeDefined();
      expect(comparison.recommendation).toMatch(/^(direct|hummingbot|maintain)$/);
      expect(comparison.confidence).toBeGreaterThan(0);
      expect(comparison.confidence).toBeLessThanOrEqual(1);
    });

    it('should calculate improvements correctly', async () => {
      const comparison = await engine.compareExecutionMethods('test-strategy-1');

      // Hummingbot should have better slippage (lower)
      expect(comparison.improvement.slippage).toBeGreaterThan(0);
      
      // Direct should have better latency (lower)
      expect(comparison.improvement.latency).toBeLessThan(0);
    });

    it('should throw error with insufficient data', async () => {
      await expect(
        engine.compareExecutionMethods('non-existent-strategy')
      ).rejects.toThrow('Insufficient data for comparison');
    });

    it('should respect timeframe parameter', async () => {
      // Add old data that should be excluded
      const oldTime = Date.now() - 48 * 60 * 60 * 1000; // 48 hours ago
      
      const oldMetrics = engine.getStrategyMetrics('test-strategy-1');
      oldMetrics.forEach(metric => {
        metric.timestamp = oldTime;
      });

      // Should throw error because no recent data
      await expect(
        engine.compareExecutionMethods('test-strategy-1', 24 * 60 * 60 * 1000)
      ).rejects.toThrow('Insufficient data for comparison');
    });
  });

  describe('optimizeStrategyParameters', () => {
    let optimizationParams: OptimizationParameters;

    beforeEach(async () => {
      optimizationParams = {
        minDataPoints: 10,
        lookbackPeriod: 20,
        optimizationGoals: [
          { metric: 'latency', target: 'minimize', weight: 0.3 },
          { metric: 'slippage', target: 'minimize', weight: 0.3 },
          { metric: 'fillRate', target: 'maximize', weight: 0.4 }
        ],
        constraints: [
          { parameter: 'bid_spread', minValue: 0.0001, maxValue: 0.01 },
          { parameter: 'ask_spread', minValue: 0.0001, maxValue: 0.01 }
        ],
        riskTolerance: 'medium'
      };

      // Add sufficient historical data
      for (let i = 0; i < 15; i++) {
        await engine.trackExecution('test-strategy-1', 'hummingbot', {
          latency: 100 + Math.random() * 50,
          slippage: 0.001 + Math.random() * 0.001,
          fillRate: 0.7 + Math.random() * 0.2,
          profitLoss: Math.random() * 10 - 5,
          volumeExecuted: 100,
          executionCost: 0.1
        });
      }
    });

    it('should optimize strategy parameters', async () => {
      const result = await engine.optimizeStrategyParameters(mockStrategy, optimizationParams);

      expect(result.strategyId).toBe('test-strategy-1');
      expect(result.originalParameters).toEqual(mockStrategy.parameters);
      expect(result.optimizedParameters).toBeDefined();
      expect(result.currentPerformance).toBeDefined();
      expect(result.projectedImprovement).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.backtestResults).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should emit optimizationCompleted event', async () => {
      const eventPromise = new Promise((resolve) => {
        engine.once('optimizationCompleted', resolve);
      });

      await engine.optimizeStrategyParameters(mockStrategy, optimizationParams);

      const event = await eventPromise;
      expect(event).toBeDefined();
    });

    it('should throw error with insufficient data', async () => {
      const insufficientParams = { ...optimizationParams, minDataPoints: 50 };

      await expect(
        engine.optimizeStrategyParameters(mockStrategy, insufficientParams)
      ).rejects.toThrow('Insufficient data for optimization');
    });

    it('should optimize different strategy types', async () => {
      const gridStrategy: HBStrategy = {
        ...mockStrategy,
        type: 'grid_trading',
        parameters: {
          grid_price_ceiling: 50000,
          grid_price_floor: 45000,
          n_levels: 10
        }
      };

      const result = await engine.optimizeStrategyParameters(gridStrategy, optimizationParams);
      expect(result.optimizedParameters).toBeDefined();
      expect(result.optimizedParameters.grid_price_ceiling).toBeDefined();
      expect(result.optimizedParameters.grid_price_floor).toBeDefined();
      expect(result.optimizedParameters.n_levels).toBeDefined();
    });
  });

  describe('performance degradation detection', () => {
    beforeEach(async () => {
      // Add baseline metrics (good performance)
      for (let i = 0; i < 10; i++) {
        await engine.trackExecution('test-strategy-1', 'hummingbot', {
          latency: 100 + Math.random() * 10,
          slippage: 0.001 + Math.random() * 0.0001,
          fillRate: 0.85 + Math.random() * 0.05,
          profitLoss: 5 + Math.random() * 2,
          volumeExecuted: 100
        });
      }
    });

    it('should detect latency degradation', async () => {
      const degradationPromise = new Promise<PerformanceDegradation>((resolve) => {
        engine.once('performanceDegradation', resolve);
      });

      // Add degraded metrics (high latency)
      for (let i = 0; i < 5; i++) {
        await engine.trackExecution('test-strategy-1', 'hummingbot', {
          latency: 200 + Math.random() * 50, // Much higher latency
          slippage: 0.001,
          fillRate: 0.85,
          profitLoss: 5,
          volumeExecuted: 100
        });
      }

      const degradation = await degradationPromise;
      expect(degradation.strategyId).toBe('test-strategy-1');
      expect(degradation.degradationType).toContain('latency');
      expect(degradation.severity).toMatch(/^(low|medium|high|critical)$/);
      expect(Array.isArray(degradation.recommendations)).toBe(true);
    });

    it('should detect slippage degradation', async () => {
      const degradationPromise = new Promise<PerformanceDegradation>((resolve) => {
        engine.once('performanceDegradation', resolve);
      });

      // Add degraded metrics (high slippage)
      for (let i = 0; i < 5; i++) {
        await engine.trackExecution('test-strategy-1', 'hummingbot', {
          latency: 100,
          slippage: 0.005 + Math.random() * 0.002, // Much higher slippage
          fillRate: 0.85,
          profitLoss: 5,
          volumeExecuted: 100
        });
      }

      const degradation = await degradationPromise;
      expect(degradation.degradationType).toContain('slippage');
    });

    it('should detect fill rate degradation', async () => {
      const degradationPromise = new Promise<PerformanceDegradation>((resolve) => {
        engine.once('performanceDegradation', resolve);
      });

      // Add degraded metrics (low fill rate)
      for (let i = 0; i < 5; i++) {
        await engine.trackExecution('test-strategy-1', 'hummingbot', {
          latency: 100,
          slippage: 0.001,
          fillRate: 0.5 + Math.random() * 0.1, // Much lower fill rate
          profitLoss: 5,
          volumeExecuted: 100
        });
      }

      const degradation = await degradationPromise;
      expect(degradation.degradationType).toContain('fillRate');
    });

    it('should detect profitability degradation', async () => {
      const degradationPromise = new Promise<PerformanceDegradation>((resolve) => {
        engine.once('performanceDegradation', resolve);
      });

      // Add degraded metrics (negative profitability)
      for (let i = 0; i < 5; i++) {
        await engine.trackExecution('test-strategy-1', 'hummingbot', {
          latency: 100,
          slippage: 0.001,
          fillRate: 0.85,
          profitLoss: -10 - Math.random() * 5, // Negative profit
          volumeExecuted: 100
        });
      }

      const degradation = await degradationPromise;
      expect(degradation.degradationType).toContain('profitability');
    });
  });

  describe('generatePerformanceReport', () => {
    beforeEach(async () => {
      // Add mixed execution data
      const baseTime = Date.now() - 6 * 24 * 60 * 60 * 1000; // 6 days ago

      for (let i = 0; i < 10; i++) {
        await engine.trackExecution('test-strategy-1', 'direct', {
          latency: 100 + i * 5,
          slippage: 0.001 + i * 0.0001,
          fillRate: 0.8 + i * 0.01,
          profitLoss: 5 + i,
          volumeExecuted: 100,
          executionCost: 0.1
        });

        await engine.trackExecution('test-strategy-1', 'hummingbot', {
          latency: 120 + i * 3,
          slippage: 0.0008 + i * 0.0001,
          fillRate: 0.85 + i * 0.005,
          profitLoss: 6 + i,
          volumeExecuted: 100,
          executionCost: 0.08
        });
      }
    });

    it('should generate comprehensive performance report', async () => {
      const report = await engine.generatePerformanceReport('test-strategy-1');

      expect(report.strategyId).toBe('test-strategy-1');
      expect(report.timeframe).toBe(7 * 24 * 60 * 60 * 1000);
      expect(report.generatedAt).toBeGreaterThan(0);
      expect(report.totalExecutions).toBe(20);
      expect(report.executionBreakdown.direct).toBe(10);
      expect(report.executionBreakdown.hummingbot).toBe(10);
      expect(report.overallPerformance).toBeDefined();
      expect(report.executionMethodComparison).toBeDefined();
      expect(report.performanceTrends).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(report.riskMetrics).toBeDefined();
    });

    it('should handle custom timeframe', async () => {
      const customTimeframe = 3 * 24 * 60 * 60 * 1000; // 3 days
      const report = await engine.generatePerformanceReport('test-strategy-1', customTimeframe);

      expect(report.timeframe).toBe(customTimeframe);
    });

    it('should throw error with no data', async () => {
      await expect(
        engine.generatePerformanceReport('non-existent-strategy')
      ).rejects.toThrow('No data available for the specified timeframe');
    });

    it('should calculate risk metrics correctly', async () => {
      const report = await engine.generatePerformanceReport('test-strategy-1');

      expect(report.riskMetrics.volatility).toBeGreaterThan(0);
      expect(report.riskMetrics.sharpeRatio).toBeDefined();
      expect(report.riskMetrics.maxDrawdown).toBeLessThanOrEqual(0);
      expect(report.riskMetrics.valueAtRisk95).toBeDefined();
      expect(report.riskMetrics.valueAtRisk99).toBeDefined();
      expect(report.riskMetrics.winRate).toBeGreaterThanOrEqual(0);
      expect(report.riskMetrics.winRate).toBeLessThanOrEqual(1);
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      // Add some test data
      for (let i = 0; i < 5; i++) {
        await engine.trackExecution('test-strategy-1', 'hummingbot', {
          latency: 100 + i * 10,
          slippage: 0.001,
          fillRate: 0.8,
          profitLoss: 5,
          volumeExecuted: 100
        });
      }
    });

    it('should get strategy metrics', () => {
      const metrics = engine.getStrategyMetrics('test-strategy-1');
      expect(metrics).toHaveLength(5);
      expect(metrics[0].strategyId).toBe('test-strategy-1');
    });

    it('should return empty array for non-existent strategy', () => {
      const metrics = engine.getStrategyMetrics('non-existent');
      expect(metrics).toHaveLength(0);
    });

    it('should cleanup old metrics', async () => {
      // Add old metrics
      const oldTime = Date.now() - 40 * 24 * 60 * 60 * 1000; // 40 days ago
      const metrics = engine.getStrategyMetrics('test-strategy-1');
      metrics[0].timestamp = oldTime;

      engine.cleanupOldMetrics(30 * 24 * 60 * 60 * 1000); // 30 days

      const remainingMetrics = engine.getStrategyMetrics('test-strategy-1');
      expect(remainingMetrics).toHaveLength(4); // One old metric removed
    });
  });

  describe('Hummingbot-specific metrics tracking', () => {
    it('should track Hummingbot-specific metrics', async () => {
      const hbMetrics = {
        strategyType: 'pure_market_making',
        instanceId: 'hb-instance-1',
        configurationHash: 'abc123',
        hummingbotVersion: '1.15.0',
        gatewayLatency: 50,
        strategyRestarts: 0,
        errorCount: 2,
        warningCount: 5,
        inventorySkew: 0.1,
        spreadUtilization: 0.8,
        orderBookDepth: 1000,
        competitorAnalysis: {
          competitorCount: 3,
          averageCompetitorSpread: 0.0012,
          marketShareEstimate: 0.15
        },
        connectionStability: 0.95,
        apiResponseTime: 80,
        orderBookSyncLatency: 30,
        strategyHealthScore: 0.85
      };

      const eventPromise = new Promise((resolve) => {
        engine.once('hummingbotMetricsTracked', resolve);
      });

      await engine.trackHummingbotMetrics('test-strategy-1', hbMetrics);

      const storedMetrics = engine.getHummingbotMetrics('test-strategy-1');
      expect(storedMetrics).toHaveLength(1);
      expect(storedMetrics[0].strategyType).toBe('pure_market_making');
      expect(storedMetrics[0].connectionStability).toBe(0.95);

      const event = await eventPromise;
      expect(event).toBeDefined();
    });
  });

  describe('performance alerts', () => {
    beforeEach(() => {
      const alertConfig = {
        enabled: true,
        thresholds: {
          latencyWarning: 150,
          latencyCritical: 300,
          slippageWarning: 0.003,
          slippageCritical: 0.008,
          fillRateWarning: 0.7,
          fillRateCritical: 0.5,
          profitabilityWarning: -0.05,
          profitabilityCritical: -0.15
        },
        notificationChannels: ['dashboard' as const],
        cooldownPeriod: 60000
      };

      engine.configureAlerts('test-strategy-1', alertConfig);
    });

    it('should configure performance alerts', () => {
      const eventPromise = new Promise((resolve) => {
        engine.once('alertConfigurationUpdated', resolve);
      });

      const config = {
        enabled: true,
        thresholds: {
          latencyWarning: 200,
          latencyCritical: 500,
          slippageWarning: 0.005,
          slippageCritical: 0.01,
          fillRateWarning: 0.7,
          fillRateCritical: 0.5,
          profitabilityWarning: -0.1,
          profitabilityCritical: -0.25
        },
        notificationChannels: ['email' as const, 'webhook' as const],
        cooldownPeriod: 300000
      };

      engine.configureAlerts('test-strategy-2', config);

      return expect(eventPromise).resolves.toEqual({
        strategyId: 'test-strategy-2',
        config
      });
    });

    it('should generate performance alerts for high latency', async () => {
      // Add high latency metrics
      await engine.trackExecution('test-strategy-1', 'hummingbot', {
        latency: 400, // Above critical threshold
        slippage: 0.001,
        fillRate: 0.8,
        profitLoss: 5,
        volumeExecuted: 100
      });

      const alerts = engine.getPerformanceAlerts('test-strategy-1');
      const latencyAlert = alerts.find(alert => alert.data.metric === 'latency');

      expect(latencyAlert).toBeDefined();
      expect(latencyAlert!.severity).toBe('critical');
      expect(latencyAlert!.message).toContain('Critical latency');
    });

    it('should generate performance alerts for high slippage', async () => {
      await engine.trackExecution('test-strategy-1', 'hummingbot', {
        latency: 100,
        slippage: 0.009, // Above critical threshold
        fillRate: 0.8,
        profitLoss: 5,
        volumeExecuted: 100
      });

      const alerts = engine.getPerformanceAlerts('test-strategy-1');
      const slippageAlert = alerts.find(alert => alert.data.metric === 'slippage');

      expect(slippageAlert).toBeDefined();
      expect(slippageAlert!.severity).toBe('critical');
      expect(slippageAlert!.message).toContain('Critical slippage');
    });

    it('should generate performance alerts for low fill rate', async () => {
      await engine.trackExecution('test-strategy-1', 'hummingbot', {
        latency: 100,
        slippage: 0.001,
        fillRate: 0.4, // Below critical threshold
        profitLoss: 5,
        volumeExecuted: 100
      });

      const alerts = engine.getPerformanceAlerts('test-strategy-1');
      const fillRateAlert = alerts.find(alert => alert.data.metric === 'fillRate');

      expect(fillRateAlert).toBeDefined();
      expect(fillRateAlert!.severity).toBe('critical');
      expect(fillRateAlert!.message).toContain('Critical fill rate');
    });
  });

  describe('optimization suggestions', () => {
    beforeEach(async () => {
      // Add various performance scenarios
      for (let i = 0; i < 10; i++) {
        await engine.trackExecution('test-strategy-1', 'hummingbot', {
          latency: 350, // High latency
          slippage: 0.006, // High slippage
          fillRate: 0.5, // Low fill rate
          profitLoss: -2, // Negative profit
          volumeExecuted: 100,
          executionCost: 0.1
        });
      }
    });

    it('should generate optimization suggestions', async () => {
      const suggestions = await engine.generateOptimizationSuggestions('test-strategy-1');

      expect(suggestions.length).toBeGreaterThan(0);
      
      // Should have latency suggestion
      const latencySuggestion = suggestions.find(s => s.estimatedImpact.latency);
      expect(latencySuggestion).toBeDefined();
      expect(latencySuggestion!.priority).toBe('high');

      // Should have slippage suggestion
      const slippageSuggestion = suggestions.find(s => s.estimatedImpact.slippage);
      expect(slippageSuggestion).toBeDefined();
      expect(slippageSuggestion!.priority).toBe('high');

      // Should have fill rate suggestion
      const fillRateSuggestion = suggestions.find(s => s.estimatedImpact.fillRate);
      expect(fillRateSuggestion).toBeDefined();

      // Should have strategy pause suggestion due to losses
      const pauseSuggestion = suggestions.find(s => s.type === 'strategy_pause');
      expect(pauseSuggestion).toBeDefined();
      expect(pauseSuggestion!.priority).toBe('critical');
    });

    it('should sort suggestions by priority', async () => {
      const suggestions = await engine.generateOptimizationSuggestions('test-strategy-1');

      const priorities = suggestions.map(s => s.priority);
      const priorityOrder = ['critical', 'high', 'medium', 'low'];
      
      for (let i = 1; i < priorities.length; i++) {
        const currentIndex = priorityOrder.indexOf(priorities[i]);
        const previousIndex = priorityOrder.indexOf(priorities[i - 1]);
        expect(currentIndex).toBeGreaterThanOrEqual(previousIndex);
      }
    });
  });

  describe('performance scoring', () => {
    it('should calculate performance score', async () => {
      // Add good performance metrics
      for (let i = 0; i < 5; i++) {
        await engine.trackExecution('good-strategy', 'hummingbot', {
          latency: 80,
          slippage: 0.0008,
          fillRate: 0.9,
          profitLoss: 10,
          volumeExecuted: 100
        });
      }

      const score = engine.calculatePerformanceScore('good-strategy');
      expect(score).toBeGreaterThan(70); // Should be a good score
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should calculate low score for poor performance', async () => {
      // Add poor performance metrics
      for (let i = 0; i < 5; i++) {
        await engine.trackExecution('poor-strategy', 'hummingbot', {
          latency: 600,
          slippage: 0.02,
          fillRate: 0.3,
          profitLoss: -10,
          volumeExecuted: 100
        });
      }

      const score = engine.calculatePerformanceScore('poor-strategy');
      expect(score).toBeLessThan(30); // Should be a poor score
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('execution efficiency', () => {
    beforeEach(async () => {
      // Add mixed performance data
      for (let i = 0; i < 10; i++) {
        await engine.trackExecution('test-strategy-1', 'hummingbot', {
          latency: 100 + i * 10,
          slippage: 0.001 + i * 0.0001,
          fillRate: 0.8 + i * 0.01,
          profitLoss: 5 + i,
          volumeExecuted: 100,
          executionCost: 0.1 + i * 0.01
        });
      }
    });

    it('should calculate execution efficiency', () => {
      const efficiency = engine.calculateExecutionEfficiency('test-strategy-1');

      expect(efficiency.overall).toBeGreaterThan(0);
      expect(efficiency.overall).toBeLessThanOrEqual(1);
      expect(efficiency.latencyEfficiency).toBeGreaterThan(0);
      expect(efficiency.slippageEfficiency).toBeGreaterThan(0);
      expect(efficiency.fillRateEfficiency).toBeGreaterThan(0);
      expect(efficiency.costEfficiency).toBeGreaterThan(0);
    });

    it('should return zero efficiency for no data', () => {
      const efficiency = engine.calculateExecutionEfficiency('no-data-strategy');

      expect(efficiency.overall).toBe(0);
      expect(efficiency.latencyEfficiency).toBe(0);
      expect(efficiency.slippageEfficiency).toBe(0);
      expect(efficiency.fillRateEfficiency).toBe(0);
      expect(efficiency.costEfficiency).toBe(0);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty metrics gracefully', async () => {
      await expect(
        engine.compareExecutionMethods('empty-strategy')
      ).rejects.toThrow();
    });

    it('should handle single execution method', async () => {
      await engine.trackExecution('single-method', 'direct', {
        latency: 100,
        slippage: 0.001,
        fillRate: 0.8
      });

      await expect(
        engine.compareExecutionMethods('single-method')
      ).rejects.toThrow('Insufficient data for comparison');
    });

    it('should handle optimization with minimal data', async () => {
      const params: OptimizationParameters = {
        minDataPoints: 1,
        lookbackPeriod: 5,
        optimizationGoals: [{ metric: 'latency', target: 'minimize', weight: 1 }],
        constraints: [],
        riskTolerance: 'low'
      };

      await engine.trackExecution('minimal-data', 'hummingbot', {
        latency: 100,
        slippage: 0.001,
        fillRate: 0.8
      });

      const result = await engine.optimizeStrategyParameters(
        { ...mockStrategy, id: 'minimal-data' },
        params
      );

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should return empty suggestions for insufficient data', async () => {
      const suggestions = await engine.generateOptimizationSuggestions('no-data-strategy');
      expect(suggestions).toHaveLength(0);
    });

    it('should handle Hummingbot metrics cleanup', () => {
      // Add old Hummingbot metrics
      const oldMetrics = {
        strategyType: 'test',
        instanceId: 'test',
        configurationHash: 'test',
        hummingbotVersion: '1.0.0',
        gatewayLatency: 50,
        strategyRestarts: 0,
        errorCount: 0,
        warningCount: 0,
        inventorySkew: 0,
        spreadUtilization: 0,
        orderBookDepth: 0,
        competitorAnalysis: {
          competitorCount: 0,
          averageCompetitorSpread: 0,
          marketShareEstimate: 0
        },
        connectionStability: 1,
        apiResponseTime: 50,
        orderBookSyncLatency: 10,
        strategyHealthScore: 1
      };

      engine.trackHummingbotMetrics('cleanup-test', oldMetrics);
      
      // Manually set old timestamp
      const metrics = engine.getHummingbotMetrics('cleanup-test');
      (metrics[0] as any).timestamp = Date.now() - 40 * 24 * 60 * 60 * 1000;

      engine.cleanupOldMetrics(30 * 24 * 60 * 60 * 1000);

      const remainingMetrics = engine.getHummingbotMetrics('cleanup-test');
      expect(remainingMetrics).toHaveLength(0);
    });
  });
});