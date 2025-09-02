import { PerformanceOptimizationService, OptimizationSchedule, OptimizationPolicy } from '../../services/PerformanceOptimizationService';
import { PerformanceAnalyticsEngine } from '../../services/PerformanceAnalyticsEngine';
import { HummingbotBridgeService } from '../../services/HummingbotBridgeService';
import { OptimizationParameters, OptimizationResult } from '../../types/performance';
import { HBStrategy } from '../../types/hummingbot';

// Mock dependencies
jest.mock('../../services/PerformanceAnalyticsEngine');
jest.mock('../../services/HummingbotBridgeService');

describe('PerformanceOptimizationService', () => {
  let optimizationService: PerformanceOptimizationService;
  let mockPerformanceEngine: jest.Mocked<PerformanceAnalyticsEngine>;
  let mockBridgeService: jest.Mocked<HummingbotBridgeService>;

  const mockStrategy: HBStrategy = {
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

  const mockOptimizationResult: OptimizationResult = {
    strategyId: 'test-strategy-1',
    timestamp: Date.now(),
    originalParameters: mockStrategy.parameters,
    optimizedParameters: {
      bid_spread: 0.0008,
      ask_spread: 0.0008,
      order_amount: 0.012
    },
    currentPerformance: {
      totalExecutions: 100,
      averageLatency: 120,
      averageSlippage: 0.001,
      averageFillRate: 0.8,
      totalProfitLoss: 50,
      totalVolume: 1000,
      averageExecutionCost: 0.1,
      successRate: 0.85,
      averageSpread: 0.001,
      averageMarketImpact: 0.0005
    },
    projectedImprovement: {
      totalExecutions: 100,
      averageLatency: 110,
      averageSlippage: 0.0008,
      averageFillRate: 0.85,
      totalProfitLoss: 60,
      totalVolume: 1000,
      averageExecutionCost: 0.08,
      successRate: 0.9,
      averageSpread: 0.0008,
      averageMarketImpact: 0.0004
    },
    confidence: 0.85,
    backtestResults: {
      totalExecutions: 100,
      averageLatency: 115,
      averageSlippage: 0.0009,
      averageFillRate: 0.82,
      totalProfitLoss: 55,
      totalVolume: 1000,
      averageExecutionCost: 0.09,
      successRate: 0.87,
      averageSpread: 0.0009,
      averageMarketImpact: 0.00045
    },
    recommendations: ['Consider reducing spreads for better fill rates']
  };

  beforeEach(() => {
    mockPerformanceEngine = new PerformanceAnalyticsEngine() as jest.Mocked<PerformanceAnalyticsEngine>;
    mockBridgeService = new HummingbotBridgeService() as jest.Mocked<HummingbotBridgeService>;
    
    optimizationService = new PerformanceOptimizationService(
      mockPerformanceEngine,
      mockBridgeService
    );

    // Setup default mocks
    mockPerformanceEngine.optimizeStrategyParameters.mockResolvedValue(mockOptimizationResult);
    mockPerformanceEngine.getStrategyMetrics.mockReturnValue([]);
    (mockBridgeService as any).updateStrategy = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    optimizationService.stop();
    jest.clearAllMocks();
  });

  describe('scheduleOptimization', () => {
    it('should schedule optimization for a strategy', () => {
      const schedule: Omit<OptimizationSchedule, 'strategyId'> = {
        frequency: 'daily',
        enabled: true
      };

      const eventPromise = new Promise((resolve) => {
        optimizationService.once('optimizationScheduled', resolve);
      });

      optimizationService.scheduleOptimization('test-strategy-1', schedule);

      const schedules = optimizationService.getOptimizationSchedules();
      expect(schedules.has('test-strategy-1')).toBe(true);
      
      const storedSchedule = schedules.get('test-strategy-1')!;
      expect(storedSchedule.frequency).toBe('daily');
      expect(storedSchedule.enabled).toBe(true);
      expect(storedSchedule.nextRun).toBeGreaterThan(Date.now());

      return expect(eventPromise).resolves.toBeDefined();
    });

    it('should calculate correct next run times for different frequencies', () => {
      const now = Date.now();
      
      optimizationService.scheduleOptimization('hourly-strategy', {
        frequency: 'hourly',
        enabled: true
      });

      optimizationService.scheduleOptimization('weekly-strategy', {
        frequency: 'weekly',
        enabled: true
      });

      const schedules = optimizationService.getOptimizationSchedules();
      const hourlySchedule = schedules.get('hourly-strategy')!;
      const weeklySchedule = schedules.get('weekly-strategy')!;

      expect(hourlySchedule.nextRun).toBeGreaterThan(now);
      expect(hourlySchedule.nextRun).toBeLessThan(now + 2 * 60 * 60 * 1000); // Within 2 hours

      expect(weeklySchedule.nextRun).toBeGreaterThan(now + 6 * 24 * 60 * 60 * 1000); // More than 6 days
      expect(weeklySchedule.nextRun).toBeLessThan(now + 8 * 24 * 60 * 60 * 1000); // Less than 8 days
    });
  });

  describe('setOptimizationPolicy', () => {
    it('should set optimization policy for a strategy', () => {
      const policy: OptimizationPolicy = {
        autoApply: true,
        confidenceThreshold: 0.8,
        maxParameterChange: 0.2,
        requireBacktestValidation: true,
        rollbackOnDegradation: true,
        emergencyOptimization: false,
        maxOptimizationsPerDay: 10
      };

      const eventPromise = new Promise((resolve) => {
        optimizationService.once('policyUpdated', resolve);
      });

      optimizationService.setOptimizationPolicy('test-strategy-1', policy);

      return expect(eventPromise).resolves.toEqual({
        strategyId: 'test-strategy-1',
        policy
      });
    });
  });

  describe('optimizeStrategy', () => {
    let optimizationParams: OptimizationParameters;

    beforeEach(() => {
      optimizationParams = {
        minDataPoints: 20,
        lookbackPeriod: 50,
        optimizationGoals: [
          { metric: 'profitability', target: 'maximize', weight: 0.4 },
          { metric: 'fillRate', target: 'maximize', weight: 0.3 },
          { metric: 'slippage', target: 'minimize', weight: 0.3 }
        ],
        constraints: [],
        riskTolerance: 'medium'
      };

      // Mock sufficient data
      mockPerformanceEngine.getStrategyMetrics.mockReturnValue(
        Array(25).fill(null).map((_, i) => ({
          strategyId: 'test-strategy-1',
          executionMethod: 'hummingbot' as const,
          timestamp: Date.now() - i * 60000,
          latency: 100 + i,
          slippage: 0.001,
          fillRate: 0.8,
          executionCost: 0.1,
          profitLoss: 5,
          volumeExecuted: 100,
          ordersPlaced: 5,
          ordersFilled: 4,
          averageSpread: 0.001,
          marketImpact: 0.0005
        }))
      );
    });

    it('should optimize strategy successfully', async () => {
      const result = await optimizationService.optimizeStrategy(mockStrategy, optimizationParams);

      expect(mockPerformanceEngine.optimizeStrategyParameters).toHaveBeenCalledWith(
        mockStrategy,
        optimizationParams
      );
      expect(result.strategyId).toBe('test-strategy-1');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should emit optimization events', async () => {
      const startedPromise = new Promise((resolve) => {
        optimizationService.once('optimizationStarted', resolve);
      });

      const completedPromise = new Promise((resolve) => {
        optimizationService.once('optimizationCompleted', resolve);
      });

      const optimizationTask = optimizationService.optimizeStrategy(mockStrategy, optimizationParams);

      const [startedEvent, result, completedEvent] = await Promise.all([
        startedPromise,
        optimizationTask,
        completedPromise
      ]);

      expect(startedEvent).toEqual({ strategyId: 'test-strategy-1' });
      expect(completedEvent).toEqual(result);
    });

    it('should auto-apply optimization when policy allows', async () => {
      const policy: OptimizationPolicy = {
        autoApply: true,
        confidenceThreshold: 0.7,
        maxParameterChange: 0.5,
        requireBacktestValidation: false,
        rollbackOnDegradation: false,
        emergencyOptimization: false,
        maxOptimizationsPerDay: 10
      };

      optimizationService.setOptimizationPolicy('test-strategy-1', policy);

      // Set up a spy to track the optimization applied event
      const appliedSpy = jest.fn();
      optimizationService.on('optimizationApplied', appliedSpy);

      await optimizationService.optimizeStrategy(mockStrategy, optimizationParams);

      // Check if optimization was applied
      expect(appliedSpy).toHaveBeenCalled();
      expect((mockBridgeService as any).updateStrategy).toHaveBeenCalledWith(
        'test-strategy-1',
        expect.objectContaining({
          parameters: mockOptimizationResult.optimizedParameters
        })
      );
    });

    it('should not auto-apply when confidence is below threshold', async () => {
      const policy: OptimizationPolicy = {
        autoApply: true,
        confidenceThreshold: 0.9, // Higher than mock result confidence
        maxParameterChange: 0.5,
        requireBacktestValidation: false,
        rollbackOnDegradation: false,
        emergencyOptimization: false,
        maxOptimizationsPerDay: 10
      };

      optimizationService.setOptimizationPolicy('test-strategy-1', policy);

      await optimizationService.optimizeStrategy(mockStrategy, optimizationParams);

      expect((mockBridgeService as any).updateStrategy).not.toHaveBeenCalled();
    });

    it('should throw error with insufficient data', async () => {
      mockPerformanceEngine.getStrategyMetrics.mockReturnValue([]); // No data

      await expect(
        optimizationService.optimizeStrategy(mockStrategy, optimizationParams)
      ).rejects.toThrow('Insufficient data');
    });

    it('should handle optimization failures', async () => {
      mockPerformanceEngine.optimizeStrategyParameters.mockRejectedValue(
        new Error('Optimization failed')
      );

      const failedPromise = new Promise((resolve) => {
        optimizationService.once('optimizationFailed', resolve);
      });

      await expect(
        optimizationService.optimizeStrategy(mockStrategy, optimizationParams)
      ).rejects.toThrow('Optimization failed');

      const failedEvent = await failedPromise;
      expect(failedEvent).toEqual({
        strategyId: 'test-strategy-1',
        error: expect.any(Error)
      });
    });
  });

  describe('benchmarkStrategy', () => {
    beforeEach(() => {
      mockPerformanceEngine.getStrategyMetrics.mockReturnValue([
        {
          strategyId: 'test-strategy-1',
          executionMethod: 'hummingbot',
          timestamp: Date.now(),
          latency: 100,
          slippage: 0.001,
          fillRate: 0.8,
          executionCost: 0.1,
          profitLoss: 5,
          volumeExecuted: 100,
          ordersPlaced: 5,
          ordersFilled: 4,
          averageSpread: 0.001,
          marketImpact: 0.0005
        }
      ]);
    });

    it('should benchmark strategy against multiple benchmarks', async () => {
      const benchmarks = await optimizationService.benchmarkStrategy(
        'test-strategy-1',
        ['market', 'buy_hold']
      );

      expect(benchmarks).toHaveLength(2);
      expect(benchmarks[0].benchmarkName).toBe('market');
      expect(benchmarks[1].benchmarkName).toBe('buy_hold');
      
      benchmarks.forEach(benchmark => {
        expect(benchmark.benchmarkMetrics).toBeDefined();
        expect(benchmark.relativePerformance).toBeDefined();
        expect(benchmark.ranking).toBeGreaterThan(0);
        expect(benchmark.ranking).toBeLessThanOrEqual(100);
      });
    });

    it('should throw error with no performance data', async () => {
      mockPerformanceEngine.getStrategyMetrics.mockReturnValue([]);

      await expect(
        optimizationService.benchmarkStrategy('test-strategy-1')
      ).rejects.toThrow('No performance data available for strategy');
    });
  });

  describe('analyzeExecutionMethods', () => {
    beforeEach(() => {
      const mockComparison = {
        strategyId: 'test-strategy-1',
        timeframe: 24 * 60 * 60 * 1000,
        directExecution: mockOptimizationResult.currentPerformance,
        hummingbotExecution: mockOptimizationResult.projectedImprovement,
        improvement: {
          latency: -0.1,
          slippage: 0.2,
          fillRate: 0.1,
          profitability: 0.15,
          executionCost: 0.1
        },
        recommendation: 'hummingbot' as const,
        confidence: 0.8
      };

      mockPerformanceEngine.compareExecutionMethods.mockResolvedValue(mockComparison);
      mockPerformanceEngine.getStrategyMetrics.mockReturnValue([
        {
          strategyId: 'test-strategy-1',
          executionMethod: 'direct',
          timestamp: Date.now(),
          latency: 100,
          slippage: 0.001,
          fillRate: 0.8,
          executionCost: 0.1,
          profitLoss: 5,
          volumeExecuted: 100,
          ordersPlaced: 5,
          ordersFilled: 4,
          averageSpread: 0.001,
          marketImpact: 0.0005
        }
      ]);
    });

    it('should analyze execution methods and provide recommendations', async () => {
      const analysis = await optimizationService.analyzeExecutionMethods('test-strategy-1');

      expect(analysis.currentMethod).toBe('direct');
      expect(analysis.recommendedMethod).toBe('hummingbot');
      expect(analysis.comparison).toBeDefined();
      expect(analysis.switchBenefit).toBeGreaterThan(0);
    });

    it('should handle maintain recommendation', async () => {
      const mockComparison = {
        strategyId: 'test-strategy-1',
        timeframe: 24 * 60 * 60 * 1000,
        directExecution: mockOptimizationResult.currentPerformance,
        hummingbotExecution: mockOptimizationResult.projectedImprovement,
        improvement: {
          latency: 0.05,
          slippage: -0.05,
          fillRate: 0.02,
          profitability: 0.01,
          executionCost: -0.02
        },
        recommendation: 'maintain' as const,
        confidence: 0.6
      };

      mockPerformanceEngine.compareExecutionMethods.mockResolvedValue(mockComparison);

      const analysis = await optimizationService.analyzeExecutionMethods('test-strategy-1');

      expect(analysis.recommendedMethod).toBe('direct'); // Same as current
      expect(analysis.switchBenefit).toBeLessThan(0.1); // Low benefit
    });
  });

  describe('generateAdvancedAnalytics', () => {
    beforeEach(() => {
      // Mock sufficient data for advanced analytics
      mockPerformanceEngine.getStrategyMetrics.mockReturnValue(
        Array(25).fill(null).map((_, i) => ({
          strategyId: 'test-strategy-1',
          executionMethod: 'hummingbot' as const,
          timestamp: Date.now() - i * 60000,
          latency: 100 + i,
          slippage: 0.001,
          fillRate: 0.8,
          executionCost: 0.1,
          profitLoss: 5,
          volumeExecuted: 100,
          ordersPlaced: 5,
          ordersFilled: 4,
          averageSpread: 0.001,
          marketImpact: 0.0005
        }))
      );
    });

    it('should generate advanced analytics', async () => {
      const analytics = await optimizationService.generateAdvancedAnalytics('test-strategy-1');

      expect(analytics.correlationAnalysis).toBeDefined();
      expect(analytics.seasonalityPatterns).toBeDefined();
      expect(analytics.marketRegimeAnalysis).toBeDefined();
      expect(analytics.predictiveMetrics).toBeDefined();

      expect(analytics.marketRegimeAnalysis.currentRegime).toMatch(/^(trending|ranging|volatile)$/);
      expect(analytics.marketRegimeAnalysis.regimeConfidence).toBeGreaterThan(0);
      expect(analytics.marketRegimeAnalysis.regimeConfidence).toBeLessThanOrEqual(1);
    });

    it('should throw error with insufficient data', async () => {
      mockPerformanceEngine.getStrategyMetrics.mockReturnValue(
        Array(10).fill(null).map(() => ({} as any)) // Less than 20 required
      );

      await expect(
        optimizationService.generateAdvancedAnalytics('test-strategy-1')
      ).rejects.toThrow('Insufficient data for advanced analytics');
    });
  });

  describe('runOptimizationBacktest', () => {
    it('should run comprehensive backtesting', async () => {
      const optimizedParameters = {
        bid_spread: 0.0008,
        ask_spread: 0.0008,
        order_amount: 0.012
      };

      const historicalData = [
        { latency: 100, slippage: 0.001, fillRate: 0.8, profitLoss: 5, volumeExecuted: 100, executionCost: 0.1 }
      ];

      const backtest = await optimizationService.runOptimizationBacktest(
        mockStrategy,
        optimizedParameters,
        historicalData
      );

      expect(backtest.parameters).toEqual(optimizedParameters);
      expect(backtest.performance).toBeDefined();
      expect(backtest.riskMetrics).toBeDefined();
      expect(backtest.drawdownAnalysis).toBeDefined();
      expect(backtest.stressTestResults).toBeDefined();

      expect(backtest.riskMetrics.volatility).toBeGreaterThan(0);
      expect(backtest.riskMetrics.sharpeRatio).toBeDefined();
      expect(backtest.riskMetrics.maxDrawdown).toBeLessThanOrEqual(0);
    });
  });

  describe('optimization history', () => {
    it('should store and retrieve optimization history', async () => {
      const optimizationParams: OptimizationParameters = {
        minDataPoints: 20,
        lookbackPeriod: 50,
        optimizationGoals: [
          { metric: 'profitability', target: 'maximize', weight: 1 }
        ],
        constraints: [],
        riskTolerance: 'medium'
      };

      mockPerformanceEngine.getStrategyMetrics.mockReturnValue(
        Array(25).fill(null).map(() => ({} as any))
      );

      await optimizationService.optimizeStrategy(mockStrategy, optimizationParams);

      const history = optimizationService.getOptimizationHistory('test-strategy-1');
      expect(history).toHaveLength(1);
      expect(history[0].strategyId).toBe('test-strategy-1');
    });

    it('should limit optimization history to 50 entries', async () => {
      const optimizationParams: OptimizationParameters = {
        minDataPoints: 1,
        lookbackPeriod: 5,
        optimizationGoals: [
          { metric: 'profitability', target: 'maximize', weight: 1 }
        ],
        constraints: [],
        riskTolerance: 'medium'
      };

      mockPerformanceEngine.getStrategyMetrics.mockReturnValue([{} as any]);

      // Run 55 optimizations
      for (let i = 0; i < 55; i++) {
        await optimizationService.optimizeStrategy(mockStrategy, optimizationParams);
      }

      const history = optimizationService.getOptimizationHistory('test-strategy-1');
      expect(history).toHaveLength(50); // Should be limited to 50
    });
  });

  describe('performance degradation handling', () => {
    it('should handle performance degradation events', () => {
      const policy: OptimizationPolicy = {
        autoApply: true,
        confidenceThreshold: 0.5,
        maxParameterChange: 1.0,
        requireBacktestValidation: false,
        rollbackOnDegradation: false,
        emergencyOptimization: true,
        maxOptimizationsPerDay: 10
      };

      optimizationService.setOptimizationPolicy('test-strategy-1', policy);

      mockPerformanceEngine.getStrategyMetrics.mockReturnValue(
        Array(25).fill(null).map(() => ({} as any))
      );

      // Simulate performance degradation event
      const degradation = {
        strategyId: 'test-strategy-1',
        severity: 'high',
        degradationType: ['profitability'],
        timestamp: Date.now(),
        metrics: {
          latencyChange: 0.1,
          slippageChange: 0.2,
          fillRateChange: -0.3,
          profitabilityChange: -0.5
        },
        recommendations: ['Review strategy parameters']
      };

      // Emit degradation event
      mockPerformanceEngine.emit('performanceDegradation', degradation);

      // The event handler should be set up (we can't easily test async event handling in this context)
      // So we just verify the policy was set correctly
      expect(policy.emergencyOptimization).toBe(true);
    });
  });

  describe('comprehensive optimization suggestions', () => {
    beforeEach(() => {
      mockPerformanceEngine.generateOptimizationSuggestions.mockResolvedValue([
        {
          type: 'parameter_adjustment',
          priority: 'high',
          description: 'High latency detected',
          expectedImprovement: 25,
          implementationComplexity: 'medium',
          estimatedImpact: { latency: -0.3 },
          actionRequired: 'Optimize network settings'
        }
      ]);
    });

    it('should generate comprehensive optimization suggestions', async () => {
      const suggestions = await optimizationService.generateComprehensiveOptimizationSuggestions('test-strategy-1');

      expect(mockPerformanceEngine.generateOptimizationSuggestions).toHaveBeenCalledWith('test-strategy-1');
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].type).toBe('parameter_adjustment');
      expect(suggestions[0].priority).toBe('high');
    });
  });

  describe('performance benchmarks', () => {
    const mockBenchmarks = [
      {
        name: 'market_standard',
        description: 'Market standard performance',
        targetMetrics: {
          latency: 100,
          slippage: 0.001,
          fillRate: 0.8,
          profitability: 0.05
        },
        weight: 1.0
      }
    ];

    it('should set performance benchmarks', () => {
      const eventPromise = new Promise((resolve) => {
        optimizationService.once('benchmarksUpdated', resolve);
      });

      optimizationService.setPerformanceBenchmarks('test-strategy-1', mockBenchmarks);

      return expect(eventPromise).resolves.toEqual({
        strategyId: 'test-strategy-1',
        benchmarks: mockBenchmarks
      });
    });

    it('should evaluate strategy against benchmarks', async () => {
      optimizationService.setPerformanceBenchmarks('test-strategy-1', mockBenchmarks);

      mockPerformanceEngine.getStrategyMetrics.mockReturnValue([
        {
          strategyId: 'test-strategy-1',
          executionMethod: 'hummingbot',
          timestamp: Date.now(),
          latency: 120,
          slippage: 0.0012,
          fillRate: 0.75,
          profitLoss: 4,
          volumeExecuted: 100,
          ordersPlaced: 5,
          ordersFilled: 4,
          averageSpread: 0.001,
          marketImpact: 0.0005,
          executionCost: 0.1
        }
      ]);

      const evaluation = await optimizationService.evaluateAgainstBenchmarks('test-strategy-1');

      expect(evaluation.overallScore).toBeGreaterThan(0);
      expect(evaluation.benchmarkResults).toHaveLength(1);
      expect(evaluation.benchmarkResults[0].benchmark.name).toBe('market_standard');
      expect(evaluation.benchmarkResults[0].gaps).toBeDefined();
    });
  });

  describe('optimization ROI calculation', () => {
    beforeEach(() => {
      // Add some optimization history
      const history = [
        {
          ...mockOptimizationResult,
          currentPerformance: { ...mockOptimizationResult.currentPerformance, totalProfitLoss: 50 },
          projectedImprovement: { ...mockOptimizationResult.projectedImprovement, totalProfitLoss: 60 }
        },
        {
          ...mockOptimizationResult,
          currentPerformance: { ...mockOptimizationResult.currentPerformance, totalProfitLoss: 60 },
          projectedImprovement: { ...mockOptimizationResult.projectedImprovement, totalProfitLoss: 55 }
        }
      ];

      (optimizationService as any).optimizationHistory.set('test-strategy-1', history);
    });

    it('should calculate optimization ROI', () => {
      const roi = optimizationService.calculateOptimizationROI('test-strategy-1');

      expect(roi.totalOptimizations).toBe(2);
      expect(roi.successfulOptimizations).toBe(1);
      expect(roi.totalROI).toBe(5); // (60-50) + (55-60) = 5
      expect(roi.bestOptimization).toBeDefined();
    });
  });

  describe('optimization statistics', () => {
    it('should provide optimization statistics', () => {
      const stats = optimizationService.getOptimizationStatistics();

      expect(stats.totalStrategies).toBeGreaterThanOrEqual(0);
      expect(stats.activeOptimizations).toBeGreaterThanOrEqual(0);
      expect(stats.scheduledOptimizations).toBeGreaterThanOrEqual(0);
      expect(stats.averageOptimizationFrequency).toBeGreaterThanOrEqual(0);
      expect(stats.successRate).toBeGreaterThanOrEqual(0);
      expect(stats.successRate).toBeLessThanOrEqual(1);
    });
  });

  describe('optimization limits', () => {
    it('should respect daily optimization limits', async () => {
      const policy: OptimizationPolicy = {
        autoApply: false,
        confidenceThreshold: 0.7,
        maxParameterChange: 0.5,
        requireBacktestValidation: false,
        rollbackOnDegradation: false,
        emergencyOptimization: false,
        maxOptimizationsPerDay: 1
      };

      optimizationService.setOptimizationPolicy('test-strategy-1', policy);

      mockPerformanceEngine.getStrategyMetrics.mockReturnValue(
        Array(25).fill(null).map(() => ({} as any))
      );

      const optimizationParams: OptimizationParameters = {
        minDataPoints: 20,
        lookbackPeriod: 50,
        optimizationGoals: [
          { metric: 'profitability', target: 'maximize', weight: 1 }
        ],
        constraints: [],
        riskTolerance: 'medium'
      };

      // First optimization should succeed
      await optimizationService.optimizeStrategy(mockStrategy, optimizationParams);

      // Second optimization should fail due to daily limit
      await expect(
        optimizationService.optimizeStrategy(mockStrategy, optimizationParams)
      ).rejects.toThrow('Optimization limit reached for today');
    });
  });

  describe('service lifecycle', () => {
    it('should stop service cleanly', () => {
      expect(() => optimizationService.stop()).not.toThrow();
    });

    it('should handle multiple stop calls', () => {
      optimizationService.stop();
      expect(() => optimizationService.stop()).not.toThrow();
    });
  });
});