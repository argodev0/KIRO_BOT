import { EventEmitter } from 'events';
import { PerformanceAnalyticsEngine } from './PerformanceAnalyticsEngine';
import { HummingbotBridgeService } from './HummingbotBridgeService';
import { 
  OptimizationParameters,
  OptimizationResult,
  PerformanceComparison,
  ExecutionMethod,
  AdvancedAnalytics,
  BenchmarkComparison,
  OptimizationBacktest,
  PerformanceOptimizationSuggestion,
  AlertConfiguration
} from '../types/performance';
import { HBStrategy } from '../types/hummingbot';

export interface OptimizationSchedule {
  strategyId: string;
  frequency: 'hourly' | 'daily' | 'weekly';
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
}

export interface OptimizationPolicy {
  autoApply: boolean;
  confidenceThreshold: number;
  maxParameterChange: number;
  requireBacktestValidation: boolean;
  rollbackOnDegradation: boolean;
  emergencyOptimization: boolean;
  maxOptimizationsPerDay: number;
}

export interface PerformanceBenchmark {
  name: string;
  description: string;
  targetMetrics: {
    latency: number;
    slippage: number;
    fillRate: number;
    profitability: number;
  };
  weight: number;
}

export class PerformanceOptimizationService extends EventEmitter {
  private optimizationSchedules: Map<string, OptimizationSchedule> = new Map();
  private optimizationPolicies: Map<string, OptimizationPolicy> = new Map();
  private benchmarks: Map<string, BenchmarkComparison[]> = new Map();
  private optimizationHistory: Map<string, OptimizationResult[]> = new Map();
  private performanceBenchmarks: Map<string, PerformanceBenchmark[]> = new Map();
  private optimizationCounts: Map<string, { date: string; count: number }> = new Map();
  private schedulerInterval?: NodeJS.Timeout;

  constructor(
    private performanceEngine: PerformanceAnalyticsEngine,
    private bridgeService: HummingbotBridgeService
  ) {
    super();
    this.startOptimizationScheduler();
    this.setupEventListeners();
  }

  /**
   * Schedule automatic optimization for a strategy
   */
  scheduleOptimization(
    strategyId: string,
    schedule: Omit<OptimizationSchedule, 'strategyId'>
  ): void {
    const optimizationSchedule: OptimizationSchedule = {
      strategyId,
      ...schedule,
      nextRun: this.calculateNextRun(schedule.frequency)
    };

    this.optimizationSchedules.set(strategyId, optimizationSchedule);
    this.emit('optimizationScheduled', optimizationSchedule);
  }

  /**
   * Set optimization policy for a strategy
   */
  setOptimizationPolicy(strategyId: string, policy: OptimizationPolicy): void {
    this.optimizationPolicies.set(strategyId, policy);
    this.emit('policyUpdated', { strategyId, policy });
  }

  /**
   * Run comprehensive optimization for a strategy
   */
  async optimizeStrategy(
    strategy: HBStrategy,
    parameters: OptimizationParameters
  ): Promise<OptimizationResult> {
    try {
      // Check if optimization is allowed
      if (!this.canOptimize(strategy.id)) {
        throw new Error('Optimization limit reached for today');
      }

      this.emit('optimizationStarted', { strategyId: strategy.id });

      // Record optimization attempt
      this.recordOptimization(strategy.id);

      // Get current performance baseline
      const currentMetrics = this.performanceEngine.getStrategyMetrics(strategy.id);
      if (currentMetrics.length < parameters.minDataPoints) {
        throw new Error(`Insufficient data: ${currentMetrics.length} < ${parameters.minDataPoints}`);
      }

      // Run optimization
      const optimizationResult = await this.performanceEngine.optimizeStrategyParameters(
        strategy,
        parameters
      );

      // Enhance with advanced analytics
      const enhancedResult = await this.enhanceOptimizationResult(
        optimizationResult,
        strategy,
        parameters
      );

      // Apply optimization if policy allows
      const policy = this.optimizationPolicies.get(strategy.id);
      if (policy?.autoApply && enhancedResult.confidence >= policy.confidenceThreshold) {
        await this.applyOptimization(strategy, enhancedResult, policy);
      }

      // Store optimization history
      this.storeOptimizationResult(strategy.id, enhancedResult);

      this.emit('optimizationCompleted', enhancedResult);
      return enhancedResult;

    } catch (error) {
      this.emit('optimizationFailed', { strategyId: strategy.id, error });
      throw error;
    }
  }

  /**
   * Compare strategy performance against benchmarks
   */
  async benchmarkStrategy(
    strategyId: string,
    benchmarkNames: string[] = ['market', 'buy_hold', 'simple_ma']
  ): Promise<BenchmarkComparison[]> {
    const strategyMetrics = this.performanceEngine.getStrategyMetrics(strategyId);
    if (strategyMetrics.length === 0) {
      throw new Error('No performance data available for strategy');
    }

    const comparisons: BenchmarkComparison[] = [];

    for (const benchmarkName of benchmarkNames) {
      const benchmarkMetrics = await this.getBenchmarkMetrics(benchmarkName, strategyMetrics);
      
      const comparison: BenchmarkComparison = {
        benchmarkName,
        benchmarkMetrics,
        relativePerformance: {
          latency: this.calculateRelativePerformance(
            strategyMetrics.reduce((sum, m) => sum + m.latency, 0) / strategyMetrics.length,
            benchmarkMetrics.averageLatency
          ),
          slippage: this.calculateRelativePerformance(
            strategyMetrics.reduce((sum, m) => sum + m.slippage, 0) / strategyMetrics.length,
            benchmarkMetrics.averageSlippage
          ),
          fillRate: this.calculateRelativePerformance(
            strategyMetrics.reduce((sum, m) => sum + m.fillRate, 0) / strategyMetrics.length,
            benchmarkMetrics.averageFillRate
          ),
          profitability: this.calculateRelativePerformance(
            strategyMetrics.reduce((sum, m) => sum + m.profitLoss, 0),
            benchmarkMetrics.totalProfitLoss
          )
        },
        ranking: await this.calculatePerformanceRanking(strategyId, benchmarkName)
      };

      comparisons.push(comparison);
    }

    this.benchmarks.set(strategyId, comparisons);
    return comparisons;
  }

  /**
   * Analyze execution method effectiveness
   */
  async analyzeExecutionMethods(strategyId: string): Promise<{
    currentMethod: ExecutionMethod;
    recommendedMethod: ExecutionMethod;
    comparison: PerformanceComparison;
    switchBenefit: number;
  }> {
    const comparison = await this.performanceEngine.compareExecutionMethods(strategyId);
    
    const currentMethod = this.getCurrentExecutionMethod(strategyId);
    const recommendedMethod = comparison.recommendation === 'maintain' 
      ? currentMethod 
      : comparison.recommendation as ExecutionMethod;

    const switchBenefit = this.calculateSwitchBenefit(comparison, currentMethod, recommendedMethod);

    return {
      currentMethod,
      recommendedMethod,
      comparison,
      switchBenefit
    };
  }

  /**
   * Generate advanced analytics for a strategy
   */
  async generateAdvancedAnalytics(strategyId: string): Promise<AdvancedAnalytics> {
    const metrics = this.performanceEngine.getStrategyMetrics(strategyId);
    if (metrics.length < 20) {
      throw new Error('Insufficient data for advanced analytics');
    }

    return {
      correlationAnalysis: await this.performCorrelationAnalysis(metrics),
      seasonalityPatterns: await this.detectSeasonalityPatterns(metrics),
      marketRegimeAnalysis: await this.analyzeMarketRegime(metrics),
      predictiveMetrics: await this.generatePredictiveMetrics(metrics)
    };
  }

  /**
   * Run comprehensive backtesting for optimization parameters
   */
  async runOptimizationBacktest(
    strategy: HBStrategy,
    optimizedParameters: Record<string, any>,
    historicalData: any[]
  ): Promise<OptimizationBacktest> {
    // Simulate strategy performance with optimized parameters
    const backtestMetrics = await this.simulateStrategyPerformance(
      strategy,
      optimizedParameters,
      historicalData
    );

    const riskMetrics = this.calculateRiskMetrics(backtestMetrics);
    const drawdownAnalysis = this.analyzeDrawdowns(backtestMetrics);
    const stressTestResults = await this.runStressTests(strategy, optimizedParameters);

    return {
      parameters: optimizedParameters,
      performance: backtestMetrics,
      riskMetrics,
      drawdownAnalysis,
      stressTestResults
    };
  }

  /**
   * Monitor optimization performance and trigger rollbacks if needed
   */
  async monitorOptimizationPerformance(strategyId: string): Promise<void> {
    const policy = this.optimizationPolicies.get(strategyId);
    if (!policy?.rollbackOnDegradation) return;

    const recentMetrics = this.performanceEngine.getStrategyMetrics(strategyId).slice(-10);
    const historicalMetrics = this.performanceEngine.getStrategyMetrics(strategyId).slice(-30, -10);

    if (recentMetrics.length < 5 || historicalMetrics.length < 10) return;

    const recentPerformance = this.calculateAveragePerformance(recentMetrics);
    const historicalPerformance = this.calculateAveragePerformance(historicalMetrics);

    const degradation = this.calculatePerformanceDegradation(recentPerformance, historicalPerformance);

    if (degradation > 0.2) { // 20% degradation threshold
      await this.rollbackOptimization(strategyId);
    }
  }

  private async enhanceOptimizationResult(
    result: OptimizationResult,
    strategy: HBStrategy,
    parameters: OptimizationParameters
  ): Promise<OptimizationResult> {
    // Add advanced backtesting
    const backtestResult = await this.runOptimizationBacktest(
      strategy,
      result.optimizedParameters,
      this.performanceEngine.getStrategyMetrics(strategy.id)
    );

    // Enhance with risk analysis
    const riskAnalysis = await this.analyzeOptimizationRisk(result, strategy);

    // Add confidence adjustments based on market conditions
    const adjustedConfidence = await this.adjustConfidenceForMarketConditions(
      result.confidence,
      strategy.id
    );

    return {
      ...result,
      confidence: adjustedConfidence,
      backtestResults: backtestResult.performance,
      recommendations: [
        ...result.recommendations,
        ...riskAnalysis.recommendations
      ]
    };
  }

  private async applyOptimization(
    strategy: HBStrategy,
    optimization: OptimizationResult,
    policy: OptimizationPolicy
  ): Promise<void> {
    try {
      // Validate parameter changes don't exceed policy limits
      const parameterChanges = this.calculateParameterChanges(
        strategy.parameters,
        optimization.optimizedParameters
      );

      if (parameterChanges.maxChange > policy.maxParameterChange) {
        throw new Error(`Parameter change exceeds policy limit: ${parameterChanges.maxChange} > ${policy.maxParameterChange}`);
      }

      // Apply optimization to Hummingbot
      const updatedStrategy = { ...strategy, parameters: optimization.optimizedParameters };
      await this.bridgeService.updateStrategy(
        strategy.id!,
        updatedStrategy
      );

      this.emit('optimizationApplied', {
        strategyId: strategy.id,
        optimization,
        appliedAt: Date.now()
      });

    } catch (error) {
      this.emit('optimizationApplicationFailed', {
        strategyId: strategy.id,
        optimization,
        error
      });
      throw error;
    }
  }

  private async rollbackOptimization(strategyId: string): Promise<void> {
    const history = this.optimizationHistory.get(strategyId) || [];
    if (history.length < 2) return;

    const previousOptimization = history[history.length - 2];
    
    try {
      // Get current strategy and update with previous parameters
      const currentStrategy = await this.getStrategyById(strategyId);
      if (currentStrategy) {
        const rolledBackStrategy = { ...currentStrategy, parameters: previousOptimization.originalParameters };
        await this.bridgeService.updateStrategy(strategyId, rolledBackStrategy);
      }

      this.emit('optimizationRolledBack', {
        strategyId,
        rolledBackTo: previousOptimization,
        rolledBackAt: Date.now()
      });

    } catch (error) {
      this.emit('rollbackFailed', { strategyId, error });
      throw error;
    }
  }

  private startOptimizationScheduler(): void {
    this.schedulerInterval = setInterval(() => {
      this.runScheduledOptimizations();
    }, 60 * 1000); // Check every minute
  }

  private async runScheduledOptimizations(): Promise<void> {
    const now = Date.now();

    for (const [strategyId, schedule] of this.optimizationSchedules.entries()) {
      if (schedule.enabled && schedule.nextRun && now >= schedule.nextRun) {
        try {
          // Get strategy and run optimization
          const strategy = await this.getStrategyById(strategyId);
          if (strategy) {
            const defaultParams: OptimizationParameters = {
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

            await this.optimizeStrategy(strategy, defaultParams);
          }

          // Update schedule
          schedule.lastRun = now;
          schedule.nextRun = this.calculateNextRun(schedule.frequency);

        } catch (error) {
          console.error(`Scheduled optimization failed for strategy ${strategyId}:`, error);
        }
      }
    }
  }

  private calculateNextRun(frequency: 'hourly' | 'daily' | 'weekly'): number {
    const now = Date.now();
    switch (frequency) {
      case 'hourly':
        return now + 60 * 60 * 1000;
      case 'daily':
        return now + 24 * 60 * 60 * 1000;
      case 'weekly':
        return now + 7 * 24 * 60 * 60 * 1000;
      default:
        return now + 24 * 60 * 60 * 1000;
    }
  }

  private setupEventListeners(): void {
    this.performanceEngine.on('performanceDegradation', async (degradation) => {
      await this.handlePerformanceDegradation(degradation);
    });

    this.performanceEngine.on('optimizationCompleted', (result) => {
      this.storeOptimizationResult(result.strategyId, result);
    });
  }

  private async handlePerformanceDegradation(degradation: any): Promise<void> {
    const policy = this.optimizationPolicies.get(degradation.strategyId);
    
    if (policy?.autoApply && degradation.severity === 'high') {
      // Trigger emergency optimization
      try {
        const strategy = await this.getStrategyById(degradation.strategyId);
        if (strategy) {
          const emergencyParams: OptimizationParameters = {
            minDataPoints: 10,
            lookbackPeriod: 20,
            optimizationGoals: [
              { metric: 'profitability', target: 'maximize', weight: 0.5 },
              { metric: 'fillRate', target: 'maximize', weight: 0.5 }
            ],
            constraints: [],
            riskTolerance: 'high'
          };

          await this.optimizeStrategy(strategy, emergencyParams);
        }
      } catch (error) {
        console.error('Emergency optimization failed:', error);
      }
    }
  }

  private storeOptimizationResult(strategyId: string, result: OptimizationResult): void {
    if (!this.optimizationHistory.has(strategyId)) {
      this.optimizationHistory.set(strategyId, []);
    }

    const history = this.optimizationHistory.get(strategyId)!;
    history.push(result);

    // Keep only last 50 optimization results
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
  }

  // Helper methods for calculations and analysis
  private calculateRelativePerformance(strategyValue: number, benchmarkValue: number): number {
    return (strategyValue - benchmarkValue) / benchmarkValue;
  }

  private async getBenchmarkMetrics(benchmarkName: string, strategyMetrics: any[]): Promise<any> {
    // Simplified benchmark calculation - in practice, this would use real benchmark data
    const avgLatency = strategyMetrics.reduce((sum, m) => sum + m.latency, 0) / strategyMetrics.length;
    const avgSlippage = strategyMetrics.reduce((sum, m) => sum + m.slippage, 0) / strategyMetrics.length;
    const avgFillRate = strategyMetrics.reduce((sum, m) => sum + m.fillRate, 0) / strategyMetrics.length;
    const totalPnL = strategyMetrics.reduce((sum, m) => sum + m.profitLoss, 0);

    // Apply benchmark adjustments
    const benchmarkMultiplier = benchmarkName === 'market' ? 1.1 : benchmarkName === 'buy_hold' ? 0.8 : 1.0;

    return {
      totalExecutions: strategyMetrics.length,
      averageLatency: avgLatency * benchmarkMultiplier,
      averageSlippage: avgSlippage * benchmarkMultiplier,
      averageFillRate: avgFillRate / benchmarkMultiplier,
      totalProfitLoss: totalPnL / benchmarkMultiplier,
      totalVolume: strategyMetrics.reduce((sum, m) => sum + m.volumeExecuted, 0),
      averageExecutionCost: strategyMetrics.reduce((sum, m) => sum + m.executionCost, 0) / strategyMetrics.length,
      successRate: avgFillRate / benchmarkMultiplier,
      averageSpread: strategyMetrics.reduce((sum, m) => sum + m.averageSpread, 0) / strategyMetrics.length,
      averageMarketImpact: strategyMetrics.reduce((sum, m) => sum + m.marketImpact, 0) / strategyMetrics.length
    };
  }

  private async calculatePerformanceRanking(strategyId: string, benchmarkName: string): Promise<number> {
    // Simplified ranking calculation
    return Math.floor(Math.random() * 100) + 1; // 1-100 percentile
  }

  private getCurrentExecutionMethod(strategyId: string): ExecutionMethod {
    const recentMetrics = this.performanceEngine.getStrategyMetrics(strategyId).slice(-10);
    const hummingbotCount = recentMetrics.filter(m => m.executionMethod === 'hummingbot').length;
    const directCount = recentMetrics.filter(m => m.executionMethod === 'direct').length;

    if (hummingbotCount > directCount) return 'hummingbot';
    if (directCount > hummingbotCount) return 'direct';
    return 'hybrid';
  }

  private calculateSwitchBenefit(
    comparison: PerformanceComparison,
    currentMethod: ExecutionMethod,
    recommendedMethod: ExecutionMethod
  ): number {
    if (currentMethod === recommendedMethod) return 0;

    // Calculate weighted benefit of switching
    const improvements = comparison.improvement;
    return (
      improvements.latency * 0.2 +
      improvements.slippage * 0.3 +
      improvements.fillRate * 0.2 +
      improvements.profitability * 0.3
    ) * comparison.confidence;
  }

  // Placeholder methods for advanced analytics (would be implemented with real algorithms)
  private async performCorrelationAnalysis(metrics: any[]): Promise<Record<string, number>> {
    return {
      'latency_slippage': 0.3,
      'fillRate_profitability': 0.7,
      'volume_marketImpact': 0.5
    };
  }

  private async detectSeasonalityPatterns(metrics: any[]): Promise<Record<string, number>> {
    return {
      'hourly_pattern': 0.2,
      'daily_pattern': 0.1,
      'weekly_pattern': 0.05
    };
  }

  private async analyzeMarketRegime(metrics: any[]): Promise<any> {
    return {
      currentRegime: 'trending' as const,
      regimeConfidence: 0.8,
      optimalStrategy: 'momentum_following'
    };
  }

  private async generatePredictiveMetrics(metrics: any[]): Promise<any> {
    const recentMetrics = metrics.slice(-10);
    return {
      expectedLatency: recentMetrics.reduce((sum, m) => sum + m.latency, 0) / recentMetrics.length,
      expectedSlippage: recentMetrics.reduce((sum, m) => sum + m.slippage, 0) / recentMetrics.length,
      expectedFillRate: recentMetrics.reduce((sum, m) => sum + m.fillRate, 0) / recentMetrics.length,
      confidenceInterval: 0.95
    };
  }

  private async simulateStrategyPerformance(
    strategy: HBStrategy,
    parameters: Record<string, any>,
    historicalData: any[]
  ): Promise<any> {
    // Simplified simulation - apply parameter improvements to historical data
    const improvementFactor = 1.05; // Assume 5% improvement
    
    return {
      totalExecutions: historicalData.length,
      averageLatency: historicalData.reduce((sum, m) => sum + m.latency, 0) / historicalData.length * 0.95,
      averageSlippage: historicalData.reduce((sum, m) => sum + m.slippage, 0) / historicalData.length * 0.95,
      averageFillRate: Math.min(historicalData.reduce((sum, m) => sum + m.fillRate, 0) / historicalData.length * improvementFactor, 1),
      totalProfitLoss: historicalData.reduce((sum, m) => sum + m.profitLoss, 0) * improvementFactor,
      totalVolume: historicalData.reduce((sum, m) => sum + m.volumeExecuted, 0),
      averageExecutionCost: historicalData.reduce((sum, m) => sum + m.executionCost, 0) / historicalData.length * 0.95,
      successRate: Math.min(historicalData.filter(m => m.fillRate > 0.8).length / historicalData.length * improvementFactor, 1),
      averageSpread: historicalData.reduce((sum, m) => sum + m.averageSpread, 0) / historicalData.length,
      averageMarketImpact: historicalData.reduce((sum, m) => sum + m.marketImpact, 0) / historicalData.length * 0.95
    };
  }

  private calculateRiskMetrics(metrics: any): Record<string, number> {
    // Simplified risk calculation
    return {
      volatility: 0.15,
      sharpeRatio: 1.2,
      maxDrawdown: -0.05,
      valueAtRisk95: -0.02,
      valueAtRisk99: -0.04,
      winRate: 0.65
    };
  }

  private analyzeDrawdowns(metrics: any): any {
    return {
      maxDrawdown: -0.05,
      drawdownDuration: 3600000, // 1 hour in ms
      recoveryTime: 7200000 // 2 hours in ms
    };
  }

  private async runStressTests(strategy: HBStrategy, parameters: Record<string, any>): Promise<any> {
    return {
      highVolatility: await this.simulateStrategyPerformance(strategy, parameters, []),
      lowLiquidity: await this.simulateStrategyPerformance(strategy, parameters, []),
      marketCrash: await this.simulateStrategyPerformance(strategy, parameters, [])
    };
  }

  private calculateAveragePerformance(metrics: any[]): number {
    return metrics.reduce((sum, m) => sum + m.profitLoss, 0) / metrics.length;
  }

  private calculatePerformanceDegradation(recent: number, historical: number): number {
    return (historical - recent) / Math.abs(historical);
  }

  private calculateParameterChanges(
    original: Record<string, any>,
    optimized: Record<string, any>
  ): { maxChange: number; changes: Record<string, number> } {
    const changes: Record<string, number> = {};
    let maxChange = 0;

    for (const [key, value] of Object.entries(optimized)) {
      if (key in original) {
        const change = Math.abs((value - original[key]) / original[key]);
        changes[key] = change;
        maxChange = Math.max(maxChange, change);
      }
    }

    return { maxChange, changes };
  }

  private async analyzeOptimizationRisk(
    result: OptimizationResult,
    strategy: HBStrategy
  ): Promise<{ recommendations: string[] }> {
    const recommendations: string[] = [];

    if (result.confidence < 0.7) {
      recommendations.push('Low confidence optimization - consider gathering more data');
    }

    const parameterChanges = this.calculateParameterChanges(
      result.originalParameters,
      result.optimizedParameters
    );

    if (parameterChanges.maxChange > 0.5) {
      recommendations.push('Large parameter changes detected - consider gradual implementation');
    }

    return { recommendations };
  }

  private async adjustConfidenceForMarketConditions(
    confidence: number,
    strategyId: string
  ): Promise<number> {
    // Simplified market condition adjustment
    const marketVolatility = Math.random(); // Would use real market data
    
    if (marketVolatility > 0.8) {
      return confidence * 0.8; // Reduce confidence in high volatility
    }
    
    return confidence;
  }

  /**
   * Generate comprehensive optimization suggestions
   */
  async generateComprehensiveOptimizationSuggestions(
    strategyId: string
  ): Promise<PerformanceOptimizationSuggestion[]> {
    const suggestions = await this.performanceEngine.generateOptimizationSuggestions(strategyId);
    const benchmarkComparisons = this.benchmarks.get(strategyId) || [];
    const optimizationHistory = this.getOptimizationHistory(strategyId);

    // Add benchmark-based suggestions
    for (const benchmark of benchmarkComparisons) {
      if (benchmark.relativePerformance.profitability < -0.1) {
        suggestions.push({
          type: 'parameter_adjustment',
          priority: 'high',
          description: `Performance is ${Math.abs(benchmark.relativePerformance.profitability * 100).toFixed(1)}% below ${benchmark.benchmarkName} benchmark`,
          expectedImprovement: Math.abs(benchmark.relativePerformance.profitability * 100),
          implementationComplexity: 'medium',
          estimatedImpact: {
            profitability: Math.abs(benchmark.relativePerformance.profitability)
          },
          actionRequired: 'Review strategy parameters against benchmark performance'
        });
      }
    }

    // Add historical optimization suggestions
    if (optimizationHistory.length > 0) {
      const lastOptimization = optimizationHistory[optimizationHistory.length - 1];
      const timeSinceLastOptimization = Date.now() - lastOptimization.timestamp;
      const daysSinceOptimization = timeSinceLastOptimization / (24 * 60 * 60 * 1000);

      if (daysSinceOptimization > 7 && lastOptimization.confidence > 0.8) {
        suggestions.push({
          type: 'parameter_adjustment',
          priority: 'low',
          description: 'Strategy has not been optimized in over a week. Consider running optimization.',
          expectedImprovement: 5,
          implementationComplexity: 'easy',
          estimatedImpact: { profitability: 0.05 },
          actionRequired: 'Run strategy optimization'
        });
      }
    }

    return suggestions;
  }

  /**
   * Set performance benchmarks for a strategy
   */
  setPerformanceBenchmarks(strategyId: string, benchmarks: PerformanceBenchmark[]): void {
    this.performanceBenchmarks.set(strategyId, benchmarks);
    this.emit('benchmarksUpdated', { strategyId, benchmarks });
  }

  /**
   * Evaluate strategy against custom benchmarks
   */
  async evaluateAgainstBenchmarks(strategyId: string): Promise<{
    overallScore: number;
    benchmarkResults: Array<{
      benchmark: PerformanceBenchmark;
      score: number;
      gaps: Record<string, number>;
    }>;
  }> {
    const benchmarks = this.performanceBenchmarks.get(strategyId) || [];
    if (benchmarks.length === 0) {
      throw new Error('No benchmarks configured for strategy');
    }

    const metrics = this.performanceEngine.getStrategyMetrics(strategyId);
    if (metrics.length === 0) {
      throw new Error('No performance data available');
    }

    const recentMetrics = metrics.slice(-20);
    const avgLatency = recentMetrics.reduce((sum, m) => sum + m.latency, 0) / recentMetrics.length;
    const avgSlippage = recentMetrics.reduce((sum, m) => sum + m.slippage, 0) / recentMetrics.length;
    const avgFillRate = recentMetrics.reduce((sum, m) => sum + m.fillRate, 0) / recentMetrics.length;
    const totalPnL = recentMetrics.reduce((sum, m) => sum + m.profitLoss, 0);
    const totalVolume = recentMetrics.reduce((sum, m) => sum + m.volumeExecuted, 0);
    const profitability = totalVolume > 0 ? totalPnL / totalVolume : 0;

    const benchmarkResults = benchmarks.map(benchmark => {
      const latencyScore = Math.max(0, Math.min(100, 
        100 - ((avgLatency - benchmark.targetMetrics.latency) / benchmark.targetMetrics.latency) * 100
      ));
      const slippageScore = Math.max(0, Math.min(100,
        100 - ((avgSlippage - benchmark.targetMetrics.slippage) / benchmark.targetMetrics.slippage) * 100
      ));
      const fillRateScore = Math.min(100, (avgFillRate / benchmark.targetMetrics.fillRate) * 100);
      const profitabilityScore = profitability >= benchmark.targetMetrics.profitability ? 100 :
        Math.max(0, (profitability / benchmark.targetMetrics.profitability) * 100);

      const score = (latencyScore + slippageScore + fillRateScore + profitabilityScore) / 4;

      return {
        benchmark,
        score,
        gaps: {
          latency: (avgLatency - benchmark.targetMetrics.latency) / benchmark.targetMetrics.latency,
          slippage: (avgSlippage - benchmark.targetMetrics.slippage) / benchmark.targetMetrics.slippage,
          fillRate: (avgFillRate - benchmark.targetMetrics.fillRate) / benchmark.targetMetrics.fillRate,
          profitability: (profitability - benchmark.targetMetrics.profitability) / benchmark.targetMetrics.profitability
        }
      };
    });

    const overallScore = benchmarkResults.reduce((sum, result) => 
      sum + (result.score * result.benchmark.weight), 0
    ) / benchmarkResults.reduce((sum, result) => sum + result.benchmark.weight, 0);

    return { overallScore, benchmarkResults };
  }

  /**
   * Configure alerts for performance monitoring
   */
  configurePerformanceAlerts(strategyId: string, config: AlertConfiguration): void {
    this.performanceEngine.configureAlerts(strategyId, config);
    this.emit('alertConfigurationSet', { strategyId, config });
  }

  /**
   * Get performance degradation alerts
   */
  getPerformanceAlerts(strategyId: string, timeframe?: number): any[] {
    return this.performanceEngine.getPerformanceAlerts(strategyId, timeframe);
  }

  /**
   * Calculate optimization ROI
   */
  calculateOptimizationROI(strategyId: string): {
    totalOptimizations: number;
    successfulOptimizations: number;
    averageImprovement: number;
    totalROI: number;
    bestOptimization: OptimizationResult | null;
  } {
    const history = this.getOptimizationHistory(strategyId);
    if (history.length === 0) {
      return {
        totalOptimizations: 0,
        successfulOptimizations: 0,
        averageImprovement: 0,
        totalROI: 0,
        bestOptimization: null
      };
    }

    const successfulOptimizations = history.filter(opt => 
      opt.projectedImprovement.totalProfitLoss > opt.currentPerformance.totalProfitLoss
    );

    const improvements = successfulOptimizations.map(opt => 
      (opt.projectedImprovement.totalProfitLoss - opt.currentPerformance.totalProfitLoss) / 
      Math.abs(opt.currentPerformance.totalProfitLoss)
    );

    const averageImprovement = improvements.length > 0 ? 
      improvements.reduce((sum, imp) => sum + imp, 0) / improvements.length : 0;

    const totalROI = history.reduce((sum, opt) => {
      const improvement = opt.projectedImprovement.totalProfitLoss - opt.currentPerformance.totalProfitLoss;
      return sum + improvement;
    }, 0);

    const bestOptimization = history.reduce((best, current) => {
      if (!best) return current;
      const currentImprovement = current.projectedImprovement.totalProfitLoss - current.currentPerformance.totalProfitLoss;
      const bestImprovement = best.projectedImprovement.totalProfitLoss - best.currentPerformance.totalProfitLoss;
      return currentImprovement > bestImprovement ? current : best;
    }, null as OptimizationResult | null);

    return {
      totalOptimizations: history.length,
      successfulOptimizations: successfulOptimizations.length,
      averageImprovement,
      totalROI,
      bestOptimization
    };
  }

  /**
   * Check if optimization is allowed based on policy
   */
  private canOptimize(strategyId: string): boolean {
    const policy = this.optimizationPolicies.get(strategyId);
    if (!policy) return true;

    const today = new Date().toISOString().split('T')[0];
    const optimizationCount = this.optimizationCounts.get(strategyId);

    if (optimizationCount && optimizationCount.date === today) {
      return optimizationCount.count < policy.maxOptimizationsPerDay;
    }

    return true;
  }

  /**
   * Record optimization attempt
   */
  private recordOptimization(strategyId: string): void {
    const today = new Date().toISOString().split('T')[0];
    const current = this.optimizationCounts.get(strategyId);

    if (current && current.date === today) {
      current.count++;
    } else {
      this.optimizationCounts.set(strategyId, { date: today, count: 1 });
    }
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStatistics(): {
    totalStrategies: number;
    activeOptimizations: number;
    scheduledOptimizations: number;
    averageOptimizationFrequency: number;
    successRate: number;
  } {
    const totalStrategies = this.optimizationHistory.size;
    const activeOptimizations = Array.from(this.optimizationSchedules.values())
      .filter(schedule => schedule.enabled).length;
    const scheduledOptimizations = this.optimizationSchedules.size;

    let totalOptimizations = 0;
    let successfulOptimizations = 0;

    for (const history of this.optimizationHistory.values()) {
      totalOptimizations += history.length;
      successfulOptimizations += history.filter(opt => opt.confidence > 0.7).length;
    }

    const successRate = totalOptimizations > 0 ? successfulOptimizations / totalOptimizations : 0;
    const averageOptimizationFrequency = totalStrategies > 0 ? totalOptimizations / totalStrategies : 0;

    return {
      totalStrategies,
      activeOptimizations,
      scheduledOptimizations,
      averageOptimizationFrequency,
      successRate
    };
  }

  /**
   * Get optimization history for a strategy
   */
  getOptimizationHistory(strategyId: string): OptimizationResult[] {
    return this.optimizationHistory.get(strategyId) || [];
  }

  /**
   * Get current optimization schedules
   */
  getOptimizationSchedules(): Map<string, OptimizationSchedule> {
    return new Map(this.optimizationSchedules);
  }

  /**
   * Get strategy by ID (helper method)
   */
  private async getStrategyById(strategyId: string): Promise<HBStrategy | null> {
    // This would typically query a database or strategy registry
    // For now, return a mock strategy based on the ID
    return {
      id: strategyId,
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
  }

  /**
   * Stop the optimization service
   */
  stop(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = undefined;
    }
    this.removeAllListeners();
  }
}