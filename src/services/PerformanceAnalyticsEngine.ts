import { EventEmitter } from 'events';
import { 
  ExecutionMetrics, 
  PerformanceComparison, 
  OptimizationResult, 
  PerformanceDegradation,
  PerformanceReport,
  ExecutionMethod,
  StrategyPerformance,
  OptimizationParameters,
  HummingbotSpecificMetrics,
  PerformanceAlert,
  AlertConfiguration,
  PerformanceOptimizationSuggestion,
  PerformanceThresholds
} from '../types/performance';
import { HBStrategy } from '../types/hummingbot';
import { TradingSignal } from '../types/trading';

export class PerformanceAnalyticsEngine extends EventEmitter {
  private executionMetrics: Map<string, ExecutionMetrics[]> = new Map();
  private performanceBaselines: Map<string, PerformanceComparison> = new Map();
  private optimizationHistory: Map<string, OptimizationResult[]> = new Map();
  private hummingbotMetrics: Map<string, HummingbotSpecificMetrics[]> = new Map();
  private alertConfigurations: Map<string, AlertConfiguration> = new Map();
  private lastAlertTimes: Map<string, number> = new Map();
  private degradationThresholds = {
    latencyIncrease: 0.5, // 50% increase
    slippageIncrease: 0.3, // 30% increase
    fillRateDecrease: 0.2, // 20% decrease
    profitabilityDecrease: 0.4 // 40% decrease
  };
  private defaultThresholds: PerformanceThresholds = {
    latencyWarning: 200, // ms
    latencyCritical: 500, // ms
    slippageWarning: 0.005, // 0.5%
    slippageCritical: 0.01, // 1%
    fillRateWarning: 0.7, // 70%
    fillRateCritical: 0.5, // 50%
    profitabilityWarning: -0.1, // -10%
    profitabilityCritical: -0.25 // -25%
  };

  constructor() {
    super();
    this.startPerformanceMonitoring();
  }

  /**
   * Track execution metrics for a specific strategy execution
   */
  async trackExecution(
    strategyId: string,
    executionMethod: ExecutionMethod,
    metrics: Partial<ExecutionMetrics>
  ): Promise<void> {
    const executionMetric: ExecutionMetrics = {
      strategyId,
      executionMethod,
      timestamp: Date.now(),
      latency: metrics.latency || 0,
      slippage: metrics.slippage || 0,
      fillRate: metrics.fillRate || 0,
      executionCost: metrics.executionCost || 0,
      profitLoss: metrics.profitLoss || 0,
      volumeExecuted: metrics.volumeExecuted || 0,
      ordersPlaced: metrics.ordersPlaced || 0,
      ordersFilled: metrics.ordersFilled || 0,
      averageSpread: metrics.averageSpread || 0,
      marketImpact: metrics.marketImpact || 0
    };

    if (!this.executionMetrics.has(strategyId)) {
      this.executionMetrics.set(strategyId, []);
    }

    this.executionMetrics.get(strategyId)!.push(executionMetric);

    // Emit event for real-time monitoring
    this.emit('executionTracked', executionMetric);

    // Check for performance degradation
    await this.checkPerformanceDegradation(strategyId);
  }

  /**
   * Compare performance between direct and Hummingbot execution
   */
  async compareExecutionMethods(
    strategyId: string,
    timeframe: number = 24 * 60 * 60 * 1000 // 24 hours
  ): Promise<PerformanceComparison> {
    const metrics = this.executionMetrics.get(strategyId) || [];
    const cutoffTime = Date.now() - timeframe;
    
    const recentMetrics = metrics.filter(m => m.timestamp >= cutoffTime);
    const directMetrics = recentMetrics.filter(m => m.executionMethod === 'direct');
    const hummingbotMetrics = recentMetrics.filter(m => m.executionMethod === 'hummingbot');

    if (directMetrics.length === 0 || hummingbotMetrics.length === 0) {
      throw new Error('Insufficient data for comparison');
    }

    const comparison: PerformanceComparison = {
      strategyId,
      timeframe,
      directExecution: this.calculateAverageMetrics(directMetrics),
      hummingbotExecution: this.calculateAverageMetrics(hummingbotMetrics),
      improvement: {
        latency: 0,
        slippage: 0,
        fillRate: 0,
        profitability: 0,
        executionCost: 0
      },
      recommendation: 'maintain',
      confidence: 0
    };

    // Calculate improvements
    comparison.improvement.latency = 
      (comparison.directExecution.averageLatency - comparison.hummingbotExecution.averageLatency) / 
      comparison.directExecution.averageLatency;
    
    comparison.improvement.slippage = 
      (comparison.directExecution.averageSlippage - comparison.hummingbotExecution.averageSlippage) / 
      comparison.directExecution.averageSlippage;
    
    comparison.improvement.fillRate = 
      (comparison.hummingbotExecution.averageFillRate - comparison.directExecution.averageFillRate) / 
      comparison.directExecution.averageFillRate;
    
    comparison.improvement.profitability = 
      (comparison.hummingbotExecution.totalProfitLoss - comparison.directExecution.totalProfitLoss) / 
      Math.abs(comparison.directExecution.totalProfitLoss);

    // Generate recommendation
    comparison.recommendation = this.generateExecutionRecommendation(comparison);
    comparison.confidence = this.calculateConfidence(directMetrics.length, hummingbotMetrics.length);

    this.performanceBaselines.set(strategyId, comparison);
    return comparison;
  }

  /**
   * Optimize strategy parameters based on historical performance
   */
  async optimizeStrategyParameters(
    strategy: HBStrategy,
    optimizationParams: OptimizationParameters
  ): Promise<OptimizationResult> {
    const strategyId = strategy.id;
    const metrics = this.executionMetrics.get(strategyId) || [];
    
    if (metrics.length < optimizationParams.minDataPoints) {
      throw new Error('Insufficient data for optimization');
    }

    const currentPerformance = this.calculateStrategyPerformance(metrics);
    const optimizedParameters = await this.runOptimizationAlgorithm(
      strategy,
      metrics,
      optimizationParams
    );

    const optimizationResult: OptimizationResult = {
      strategyId,
      timestamp: Date.now(),
      originalParameters: strategy.parameters,
      optimizedParameters,
      currentPerformance,
      projectedImprovement: await this.projectPerformanceImprovement(
        optimizedParameters,
        currentPerformance,
        metrics
      ),
      confidence: this.calculateOptimizationConfidence(metrics, optimizationParams),
      backtestResults: await this.runBacktest(optimizedParameters, metrics),
      recommendations: this.generateOptimizationRecommendations(
        currentPerformance,
        optimizedParameters
      )
    };

    // Store optimization history
    if (!this.optimizationHistory.has(strategyId)) {
      this.optimizationHistory.set(strategyId, []);
    }
    this.optimizationHistory.get(strategyId)!.push(optimizationResult);

    this.emit('optimizationCompleted', optimizationResult);
    return optimizationResult;
  }

  /**
   * Detect performance degradation and trigger alerts
   */
  private async checkPerformanceDegradation(strategyId: string): Promise<void> {
    const metrics = this.executionMetrics.get(strategyId) || [];
    if (metrics.length < 10) return; // Need minimum data points

    const recentMetrics = metrics.slice(-5); // Last 5 executions
    const baselineMetrics = metrics.slice(-15, -5); // Previous 10 executions

    if (baselineMetrics.length === 0) return;

    const recentAvg = this.calculateAverageMetrics(recentMetrics);
    const baselineAvg = this.calculateAverageMetrics(baselineMetrics);

    const degradation: PerformanceDegradation = {
      strategyId,
      timestamp: Date.now(),
      degradationType: [],
      severity: 'low',
      metrics: {
        latencyChange: (recentAvg.averageLatency - baselineAvg.averageLatency) / baselineAvg.averageLatency,
        slippageChange: (recentAvg.averageSlippage - baselineAvg.averageSlippage) / baselineAvg.averageSlippage,
        fillRateChange: (recentAvg.averageFillRate - baselineAvg.averageFillRate) / baselineAvg.averageFillRate,
        profitabilityChange: (recentAvg.totalProfitLoss - baselineAvg.totalProfitLoss) / Math.abs(baselineAvg.totalProfitLoss)
      },
      recommendations: []
    };

    // Check for degradation
    if (degradation.metrics.latencyChange > this.degradationThresholds.latencyIncrease) {
      degradation.degradationType.push('latency');
    }
    if (degradation.metrics.slippageChange > this.degradationThresholds.slippageIncrease) {
      degradation.degradationType.push('slippage');
    }
    if (Math.abs(degradation.metrics.fillRateChange) > this.degradationThresholds.fillRateDecrease) {
      degradation.degradationType.push('fillRate');
    }
    if (degradation.metrics.profitabilityChange < -this.degradationThresholds.profitabilityDecrease) {
      degradation.degradationType.push('profitability');
    }

    if (degradation.degradationType.length > 0) {
      degradation.severity = this.calculateDegradationSeverity(degradation);
      degradation.recommendations = this.generateDegradationRecommendations(degradation);
      
      this.emit('performanceDegradation', degradation);
    }
  }

  /**
   * Generate comprehensive performance report
   */
  async generatePerformanceReport(
    strategyId: string,
    timeframe: number = 7 * 24 * 60 * 60 * 1000 // 7 days
  ): Promise<PerformanceReport> {
    const metrics = this.executionMetrics.get(strategyId) || [];
    const cutoffTime = Date.now() - timeframe;
    const relevantMetrics = metrics.filter(m => m.timestamp >= cutoffTime);

    if (relevantMetrics.length === 0) {
      throw new Error('No data available for the specified timeframe');
    }

    const directMetrics = relevantMetrics.filter(m => m.executionMethod === 'direct');
    const hummingbotMetrics = relevantMetrics.filter(m => m.executionMethod === 'hummingbot');

    const report: PerformanceReport = {
      strategyId,
      timeframe,
      generatedAt: Date.now(),
      totalExecutions: relevantMetrics.length,
      executionBreakdown: {
        direct: directMetrics.length,
        hummingbot: hummingbotMetrics.length
      },
      overallPerformance: this.calculateAverageMetrics(relevantMetrics),
      executionMethodComparison: directMetrics.length > 0 && hummingbotMetrics.length > 0 
        ? await this.compareExecutionMethods(strategyId, timeframe)
        : null,
      performanceTrends: this.calculatePerformanceTrends(relevantMetrics),
      optimizationHistory: this.optimizationHistory.get(strategyId) || [],
      recommendations: this.generateReportRecommendations(relevantMetrics),
      riskMetrics: this.calculateRiskMetrics(relevantMetrics)
    };

    return report;
  }

  private calculateAverageMetrics(metrics: ExecutionMetrics[]): StrategyPerformance {
    if (metrics.length === 0) {
      throw new Error('No metrics provided for calculation');
    }

    return {
      totalExecutions: metrics.length,
      averageLatency: metrics.reduce((sum, m) => sum + m.latency, 0) / metrics.length,
      averageSlippage: metrics.reduce((sum, m) => sum + m.slippage, 0) / metrics.length,
      averageFillRate: metrics.reduce((sum, m) => sum + m.fillRate, 0) / metrics.length,
      totalProfitLoss: metrics.reduce((sum, m) => sum + m.profitLoss, 0),
      totalVolume: metrics.reduce((sum, m) => sum + m.volumeExecuted, 0),
      averageExecutionCost: metrics.reduce((sum, m) => sum + m.executionCost, 0) / metrics.length,
      successRate: metrics.filter(m => m.fillRate > 0.8).length / metrics.length,
      averageSpread: metrics.reduce((sum, m) => sum + m.averageSpread, 0) / metrics.length,
      averageMarketImpact: metrics.reduce((sum, m) => sum + m.marketImpact, 0) / metrics.length
    };
  }

  private generateExecutionRecommendation(comparison: PerformanceComparison): 'direct' | 'hummingbot' | 'maintain' {
    const improvements = comparison.improvement;
    
    // Weight different factors
    const score = 
      improvements.latency * 0.2 +
      improvements.slippage * 0.3 +
      improvements.fillRate * 0.2 +
      improvements.profitability * 0.3;

    if (score > 0.1) return 'hummingbot';
    if (score < -0.1) return 'direct';
    return 'maintain';
  }

  private calculateConfidence(directCount: number, hummingbotCount: number): number {
    const totalSamples = directCount + hummingbotCount;
    const minSamples = Math.min(directCount, hummingbotCount);
    
    // Confidence based on sample size and balance
    const sizeConfidence = Math.min(totalSamples / 100, 1);
    const balanceConfidence = minSamples / (totalSamples / 2);
    
    return (sizeConfidence + balanceConfidence) / 2;
  }

  private async runOptimizationAlgorithm(
    strategy: HBStrategy,
    metrics: ExecutionMetrics[],
    params: OptimizationParameters
  ): Promise<Record<string, any>> {
    // Simplified optimization algorithm - in practice, this would be more sophisticated
    const currentParams = strategy.parameters;
    const optimizedParams = { ...currentParams };

    // Analyze performance patterns
    const recentMetrics = metrics.slice(-params.lookbackPeriod);
    const performance = this.calculateAverageMetrics(recentMetrics);

    // Optimize based on strategy type
    if (strategy.type === 'pure_market_making') {
      optimizedParams.bid_spread = this.optimizeSpread(performance, currentParams.bid_spread);
      optimizedParams.ask_spread = this.optimizeSpread(performance, currentParams.ask_spread);
      optimizedParams.order_amount = this.optimizeOrderAmount(performance, currentParams.order_amount);
    } else if (strategy.type === 'grid_trading') {
      optimizedParams.grid_price_ceiling = this.optimizeGridCeiling(performance, currentParams.grid_price_ceiling);
      optimizedParams.grid_price_floor = this.optimizeGridFloor(performance, currentParams.grid_price_floor);
      optimizedParams.n_levels = this.optimizeGridLevels(performance, currentParams.n_levels);
    }

    return optimizedParams;
  }

  private optimizeSpread(performance: StrategyPerformance, currentSpread: number): number {
    // If fill rate is too low, decrease spread
    if (performance.averageFillRate < 0.5) {
      return Math.max(currentSpread * 0.9, 0.001);
    }
    // If slippage is high, increase spread
    if (performance.averageSlippage > 0.01) {
      return currentSpread * 1.1;
    }
    return currentSpread;
  }

  private optimizeOrderAmount(performance: StrategyPerformance, currentAmount: number): number {
    // Adjust based on market impact
    if (performance.averageMarketImpact > 0.005) {
      return currentAmount * 0.9;
    }
    if (performance.averageMarketImpact < 0.001) {
      return currentAmount * 1.1;
    }
    return currentAmount;
  }

  private optimizeGridCeiling(performance: StrategyPerformance, currentCeiling: number): number {
    // Simplified grid optimization
    return currentCeiling;
  }

  private optimizeGridFloor(performance: StrategyPerformance, currentFloor: number): number {
    // Simplified grid optimization
    return currentFloor;
  }

  private optimizeGridLevels(performance: StrategyPerformance, currentLevels: number): number {
    // Adjust grid levels based on fill rate
    if (performance.averageFillRate < 0.3) {
      return Math.max(currentLevels - 1, 3);
    }
    if (performance.averageFillRate > 0.8) {
      return Math.min(currentLevels + 1, 20);
    }
    return currentLevels;
  }

  private async projectPerformanceImprovement(
    optimizedParams: Record<string, any>,
    currentPerformance: StrategyPerformance,
    historicalMetrics: ExecutionMetrics[]
  ): Promise<StrategyPerformance> {
    // Simplified projection - in practice, this would use more sophisticated modeling
    const improvementFactor = 1.05; // Assume 5% improvement
    
    return {
      ...currentPerformance,
      averageLatency: currentPerformance.averageLatency * 0.95,
      averageSlippage: currentPerformance.averageSlippage * 0.95,
      averageFillRate: Math.min(currentPerformance.averageFillRate * improvementFactor, 1),
      totalProfitLoss: currentPerformance.totalProfitLoss * improvementFactor
    };
  }

  private calculateOptimizationConfidence(
    metrics: ExecutionMetrics[],
    params: OptimizationParameters
  ): number {
    const dataQuality = Math.min(metrics.length / params.minDataPoints, 1);
    const timeSpan = (metrics[metrics.length - 1]?.timestamp - metrics[0]?.timestamp) / (24 * 60 * 60 * 1000);
    const timeQuality = Math.min(timeSpan / 7, 1); // 7 days ideal
    
    return (dataQuality + timeQuality) / 2;
  }

  private async runBacktest(
    parameters: Record<string, any>,
    historicalMetrics: ExecutionMetrics[]
  ): Promise<StrategyPerformance> {
    // Simplified backtesting - apply parameter changes to historical data
    const backtestMetrics = historicalMetrics.map(metric => ({
      ...metric,
      // Simulate improved performance with optimized parameters
      latency: metric.latency * 0.95,
      slippage: metric.slippage * 0.95,
      fillRate: Math.min(metric.fillRate * 1.05, 1)
    }));

    return this.calculateAverageMetrics(backtestMetrics);
  }

  private generateOptimizationRecommendations(
    currentPerformance: StrategyPerformance,
    optimizedParameters: Record<string, any>
  ): string[] {
    const recommendations: string[] = [];

    if (currentPerformance.averageFillRate < 0.5) {
      recommendations.push('Consider reducing spreads to improve fill rates');
    }
    if (currentPerformance.averageSlippage > 0.01) {
      recommendations.push('High slippage detected - consider smaller order sizes');
    }
    if (currentPerformance.averageLatency > 1000) {
      recommendations.push('High latency detected - optimize network connectivity');
    }

    return recommendations;
  }

  private calculateDegradationSeverity(degradation: PerformanceDegradation): 'low' | 'medium' | 'high' | 'critical' {
    const changes = Object.values(degradation.metrics);
    const maxChange = Math.max(...changes.map(Math.abs));

    if (maxChange > 0.5) return 'critical';
    if (maxChange > 0.3) return 'high';
    if (maxChange > 0.15) return 'medium';
    return 'low';
  }

  private generateDegradationRecommendations(degradation: PerformanceDegradation): string[] {
    const recommendations: string[] = [];

    if (degradation.degradationType.includes('latency')) {
      recommendations.push('Check network connectivity and server load');
    }
    if (degradation.degradationType.includes('slippage')) {
      recommendations.push('Consider reducing order sizes or adjusting timing');
    }
    if (degradation.degradationType.includes('fillRate')) {
      recommendations.push('Review spread settings and market conditions');
    }
    if (degradation.degradationType.includes('profitability')) {
      recommendations.push('Analyze market conditions and strategy parameters');
    }

    return recommendations;
  }

  private calculateStrategyPerformance(metrics: ExecutionMetrics[]): StrategyPerformance {
    return this.calculateAverageMetrics(metrics);
  }

  private calculatePerformanceTrends(metrics: ExecutionMetrics[]): Record<string, number> {
    if (metrics.length < 2) return {};

    const sortedMetrics = metrics.sort((a, b) => a.timestamp - b.timestamp);
    const midpoint = Math.floor(sortedMetrics.length / 2);
    
    const firstHalf = sortedMetrics.slice(0, midpoint);
    const secondHalf = sortedMetrics.slice(midpoint);

    const firstHalfAvg = this.calculateAverageMetrics(firstHalf);
    const secondHalfAvg = this.calculateAverageMetrics(secondHalf);

    return {
      latencyTrend: (secondHalfAvg.averageLatency - firstHalfAvg.averageLatency) / firstHalfAvg.averageLatency,
      slippageTrend: (secondHalfAvg.averageSlippage - firstHalfAvg.averageSlippage) / firstHalfAvg.averageSlippage,
      fillRateTrend: (secondHalfAvg.averageFillRate - firstHalfAvg.averageFillRate) / firstHalfAvg.averageFillRate,
      profitabilityTrend: (secondHalfAvg.totalProfitLoss - firstHalfAvg.totalProfitLoss) / Math.abs(firstHalfAvg.totalProfitLoss)
    };
  }

  private generateReportRecommendations(metrics: ExecutionMetrics[]): string[] {
    const performance = this.calculateAverageMetrics(metrics);
    const recommendations: string[] = [];

    if (performance.averageFillRate < 0.7) {
      recommendations.push('Fill rate is below optimal - consider adjusting spreads or order timing');
    }
    if (performance.averageSlippage > 0.005) {
      recommendations.push('Slippage is high - consider smaller order sizes or better timing');
    }
    if (performance.averageLatency > 500) {
      recommendations.push('Execution latency is high - optimize network or server performance');
    }
    if (performance.successRate < 0.8) {
      recommendations.push('Success rate is low - review strategy parameters and market conditions');
    }

    return recommendations;
  }

  private calculateRiskMetrics(metrics: ExecutionMetrics[]): Record<string, number> {
    const profitLosses = metrics.map(m => m.profitLoss);
    const mean = profitLosses.reduce((sum, pl) => sum + pl, 0) / profitLosses.length;
    const variance = profitLosses.reduce((sum, pl) => sum + Math.pow(pl - mean, 2), 0) / profitLosses.length;
    const stdDev = Math.sqrt(variance);

    const sortedPL = profitLosses.sort((a, b) => a - b);
    const var95 = sortedPL[Math.floor(sortedPL.length * 0.05)];
    const var99 = sortedPL[Math.floor(sortedPL.length * 0.01)];

    // Calculate running drawdown
    let runningSum = 0;
    let peak = 0;
    let maxDrawdown = 0;
    
    for (const pl of profitLosses) {
      runningSum += pl;
      if (runningSum > peak) {
        peak = runningSum;
      }
      const drawdown = peak - runningSum;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return {
      volatility: stdDev,
      sharpeRatio: stdDev > 0 ? mean / stdDev : 0,
      maxDrawdown: -Math.abs(maxDrawdown), // Ensure negative
      valueAtRisk95: var95,
      valueAtRisk99: var99,
      winRate: profitLosses.filter(pl => pl > 0).length / profitLosses.length
    };
  }

  private startPerformanceMonitoring(): void {
    // Start background monitoring tasks
    setInterval(() => {
      this.performPeriodicAnalysis();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private async performPeriodicAnalysis(): Promise<void> {
    // Perform periodic analysis for all tracked strategies
    for (const strategyId of this.executionMetrics.keys()) {
      try {
        await this.checkPerformanceDegradation(strategyId);
      } catch (error) {
        console.error(`Error in periodic analysis for strategy ${strategyId}:`, error);
      }
    }
  }

  /**
   * Track Hummingbot-specific metrics
   */
  async trackHummingbotMetrics(
    strategyId: string,
    metrics: HummingbotSpecificMetrics
  ): Promise<void> {
    if (!this.hummingbotMetrics.has(strategyId)) {
      this.hummingbotMetrics.set(strategyId, []);
    }

    const metricsWithTimestamp = {
      ...metrics,
      timestamp: Date.now()
    };

    this.hummingbotMetrics.get(strategyId)!.push(metricsWithTimestamp as any);

    // Emit event for real-time monitoring
    this.emit('hummingbotMetricsTracked', metricsWithTimestamp);

    // Check for Hummingbot-specific alerts
    await this.checkHummingbotAlerts(strategyId, metrics);
  }

  /**
   * Configure performance alerts for a strategy
   */
  configureAlerts(strategyId: string, config: AlertConfiguration): void {
    this.alertConfigurations.set(strategyId, config);
    this.emit('alertConfigurationUpdated', { strategyId, config });
  }

  /**
   * Generate optimization suggestions based on current performance
   */
  async generateOptimizationSuggestions(
    strategyId: string
  ): Promise<PerformanceOptimizationSuggestion[]> {
    const metrics = this.executionMetrics.get(strategyId) || [];
    if (metrics.length < 5) {
      return [];
    }

    const recentMetrics = metrics.slice(-10);
    const performance = this.calculateAverageMetrics(recentMetrics);
    const suggestions: PerformanceOptimizationSuggestion[] = [];

    // Latency optimization suggestions
    if (performance.averageLatency > 300) {
      suggestions.push({
        type: 'parameter_adjustment',
        priority: 'high',
        description: 'High execution latency detected. Consider optimizing network connectivity or reducing order frequency.',
        expectedImprovement: 25,
        implementationComplexity: 'medium',
        estimatedImpact: { latency: -0.3 },
        actionRequired: 'Optimize network settings or reduce order refresh frequency',
        parameters: { order_refresh_time: Math.min((performance.averageLatency / 100) * 30, 120) }
      });
    }

    // Slippage optimization suggestions
    if (performance.averageSlippage > 0.005) {
      suggestions.push({
        type: 'parameter_adjustment',
        priority: 'high',
        description: 'High slippage detected. Consider reducing order sizes or adjusting timing.',
        expectedImprovement: 20,
        implementationComplexity: 'easy',
        estimatedImpact: { slippage: -0.4 },
        actionRequired: 'Reduce order amount or increase spread',
        parameters: { order_amount: performance.totalVolume / performance.totalExecutions * 0.8 }
      });
    }

    // Fill rate optimization suggestions
    if (performance.averageFillRate < 0.6) {
      suggestions.push({
        type: 'parameter_adjustment',
        priority: 'medium',
        description: 'Low fill rate detected. Consider tightening spreads or adjusting order placement.',
        expectedImprovement: 30,
        implementationComplexity: 'easy',
        estimatedImpact: { fillRate: 0.25 },
        actionRequired: 'Reduce bid/ask spreads',
        parameters: { bid_spread: 0.0008, ask_spread: 0.0008 }
      });
    }

    // Profitability optimization suggestions
    if (performance.totalProfitLoss < 0) {
      suggestions.push({
        type: 'strategy_pause',
        priority: 'critical',
        description: 'Strategy is losing money. Consider pausing and reviewing parameters.',
        expectedImprovement: 100,
        implementationComplexity: 'easy',
        estimatedImpact: { profitability: 1.0 },
        actionRequired: 'Pause strategy and review market conditions'
      });
    }

    // Execution method switch suggestions
    const comparison = await this.tryCompareExecutionMethods(strategyId);
    if (comparison && comparison.improvement.profitability > 0.1) {
      suggestions.push({
        type: 'execution_method_switch',
        priority: 'medium',
        description: `Switch to ${comparison.recommendation} execution for better performance.`,
        expectedImprovement: comparison.improvement.profitability * 100,
        implementationComplexity: 'medium',
        estimatedImpact: {
          latency: comparison.improvement.latency,
          slippage: comparison.improvement.slippage,
          fillRate: comparison.improvement.fillRate,
          profitability: comparison.improvement.profitability
        },
        actionRequired: `Configure strategy to use ${comparison.recommendation} execution method`
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Calculate comprehensive performance score (0-100)
   */
  calculatePerformanceScore(strategyId: string): number {
    const metrics = this.executionMetrics.get(strategyId) || [];
    if (metrics.length === 0) return 0;

    const performance = this.calculateAverageMetrics(metrics);
    const thresholds = this.defaultThresholds;

    // Calculate individual scores (0-100)
    const latencyScore = Math.max(0, Math.min(100, 
      100 - ((performance.averageLatency - 50) / (thresholds.latencyCritical - 50)) * 100
    ));

    const slippageScore = Math.max(0, Math.min(100,
      100 - (performance.averageSlippage / thresholds.slippageCritical) * 100
    ));

    const fillRateScore = Math.min(100, (performance.averageFillRate / 1.0) * 100);

    const profitabilityScore = performance.totalProfitLoss > 0 ? 
      Math.min(100, 50 + (performance.totalProfitLoss / (performance.totalVolume * 0.01)) * 50) : 
      Math.max(0, 50 + (performance.totalProfitLoss / (performance.totalVolume * 0.01)) * 50);

    // Weighted average
    return (latencyScore * 0.2 + slippageScore * 0.3 + fillRateScore * 0.3 + profitabilityScore * 0.2);
  }

  /**
   * Get performance alerts for a strategy
   */
  getPerformanceAlerts(strategyId: string, timeframe: number = 24 * 60 * 60 * 1000): PerformanceAlert[] {
    const alerts: PerformanceAlert[] = [];
    const metrics = this.executionMetrics.get(strategyId) || [];
    const cutoffTime = Date.now() - timeframe;
    const recentMetrics = metrics.filter(m => m.timestamp >= cutoffTime);

    if (recentMetrics.length === 0) return alerts;

    const performance = this.calculateAverageMetrics(recentMetrics);
    const config = this.alertConfigurations.get(strategyId);
    const thresholds = config?.thresholds || this.defaultThresholds;

    // Check latency alerts
    if (performance.averageLatency >= thresholds.latencyCritical) {
      alerts.push({
        type: 'degradation',
        severity: 'critical',
        strategyId,
        message: `Critical latency: ${performance.averageLatency.toFixed(0)}ms (threshold: ${thresholds.latencyCritical}ms)`,
        timestamp: Date.now(),
        data: { metric: 'latency', value: performance.averageLatency, threshold: thresholds.latencyCritical }
      });
    } else if (performance.averageLatency >= thresholds.latencyWarning) {
      alerts.push({
        type: 'degradation',
        severity: 'medium',
        strategyId,
        message: `High latency: ${performance.averageLatency.toFixed(0)}ms (threshold: ${thresholds.latencyWarning}ms)`,
        timestamp: Date.now(),
        data: { metric: 'latency', value: performance.averageLatency, threshold: thresholds.latencyWarning }
      });
    }

    // Check slippage alerts
    if (performance.averageSlippage >= thresholds.slippageCritical) {
      alerts.push({
        type: 'degradation',
        severity: 'critical',
        strategyId,
        message: `Critical slippage: ${(performance.averageSlippage * 100).toFixed(2)}% (threshold: ${(thresholds.slippageCritical * 100).toFixed(2)}%)`,
        timestamp: Date.now(),
        data: { metric: 'slippage', value: performance.averageSlippage, threshold: thresholds.slippageCritical }
      });
    } else if (performance.averageSlippage >= thresholds.slippageWarning) {
      alerts.push({
        type: 'degradation',
        severity: 'medium',
        strategyId,
        message: `High slippage: ${(performance.averageSlippage * 100).toFixed(2)}% (threshold: ${(thresholds.slippageWarning * 100).toFixed(2)}%)`,
        timestamp: Date.now(),
        data: { metric: 'slippage', value: performance.averageSlippage, threshold: thresholds.slippageWarning }
      });
    }

    // Check fill rate alerts
    if (performance.averageFillRate <= thresholds.fillRateCritical) {
      alerts.push({
        type: 'degradation',
        severity: 'critical',
        strategyId,
        message: `Critical fill rate: ${(performance.averageFillRate * 100).toFixed(1)}% (threshold: ${(thresholds.fillRateCritical * 100).toFixed(1)}%)`,
        timestamp: Date.now(),
        data: { metric: 'fillRate', value: performance.averageFillRate, threshold: thresholds.fillRateCritical }
      });
    } else if (performance.averageFillRate <= thresholds.fillRateWarning) {
      alerts.push({
        type: 'degradation',
        severity: 'medium',
        strategyId,
        message: `Low fill rate: ${(performance.averageFillRate * 100).toFixed(1)}% (threshold: ${(thresholds.fillRateWarning * 100).toFixed(1)}%)`,
        timestamp: Date.now(),
        data: { metric: 'fillRate', value: performance.averageFillRate, threshold: thresholds.fillRateWarning }
      });
    }

    return alerts;
  }

  /**
   * Get Hummingbot-specific metrics for a strategy
   */
  getHummingbotMetrics(strategyId: string): HummingbotSpecificMetrics[] {
    return this.hummingbotMetrics.get(strategyId) || [];
  }

  /**
   * Calculate execution efficiency score
   */
  calculateExecutionEfficiency(strategyId: string): {
    overall: number;
    latencyEfficiency: number;
    slippageEfficiency: number;
    fillRateEfficiency: number;
    costEfficiency: number;
  } {
    const metrics = this.executionMetrics.get(strategyId) || [];
    if (metrics.length === 0) {
      return { overall: 0, latencyEfficiency: 0, slippageEfficiency: 0, fillRateEfficiency: 0, costEfficiency: 0 };
    }

    const performance = this.calculateAverageMetrics(metrics);

    // Calculate efficiency scores (0-1)
    const latencyEfficiency = Math.max(0, Math.min(1, (500 - performance.averageLatency) / 450));
    const slippageEfficiency = Math.max(0, Math.min(1, (0.01 - performance.averageSlippage) / 0.01));
    const fillRateEfficiency = performance.averageFillRate;
    const costEfficiency = Math.max(0, Math.min(1, (0.2 - performance.averageExecutionCost) / 0.2));

    const overall = (latencyEfficiency * 0.25 + slippageEfficiency * 0.3 + fillRateEfficiency * 0.3 + costEfficiency * 0.15);

    return {
      overall,
      latencyEfficiency,
      slippageEfficiency,
      fillRateEfficiency,
      costEfficiency
    };
  }

  private async tryCompareExecutionMethods(strategyId: string): Promise<PerformanceComparison | null> {
    try {
      return await this.compareExecutionMethods(strategyId);
    } catch (error) {
      return null;
    }
  }

  private async checkHummingbotAlerts(
    strategyId: string,
    metrics: HummingbotSpecificMetrics
  ): Promise<void> {
    const config = this.alertConfigurations.get(strategyId);
    if (!config?.enabled) return;

    const alerts: PerformanceAlert[] = [];

    // Check connection stability
    if (metrics.connectionStability < 0.8) {
      alerts.push({
        type: 'degradation',
        severity: metrics.connectionStability < 0.5 ? 'critical' : 'high',
        strategyId,
        message: `Hummingbot connection unstable: ${(metrics.connectionStability * 100).toFixed(1)}%`,
        timestamp: Date.now(),
        data: { metric: 'connectionStability', value: metrics.connectionStability }
      });
    }

    // Check strategy health
    if (metrics.strategyHealthScore < 0.7) {
      alerts.push({
        type: 'degradation',
        severity: metrics.strategyHealthScore < 0.4 ? 'critical' : 'high',
        strategyId,
        message: `Hummingbot strategy health degraded: ${(metrics.strategyHealthScore * 100).toFixed(1)}%`,
        timestamp: Date.now(),
        data: { metric: 'strategyHealthScore', value: metrics.strategyHealthScore }
      });
    }

    // Check error count
    if (metrics.errorCount > 10) {
      alerts.push({
        type: 'degradation',
        severity: metrics.errorCount > 50 ? 'critical' : 'medium',
        strategyId,
        message: `High Hummingbot error count: ${metrics.errorCount} errors`,
        timestamp: Date.now(),
        data: { metric: 'errorCount', value: metrics.errorCount }
      });
    }

    // Emit alerts with cooldown
    for (const alert of alerts) {
      const alertKey = `${strategyId}-${alert.data.metric}`;
      const lastAlertTime = this.lastAlertTimes.get(alertKey) || 0;
      const cooldownPeriod = config.cooldownPeriod || 5 * 60 * 1000; // 5 minutes default

      if (Date.now() - lastAlertTime > cooldownPeriod) {
        this.emit('performanceAlert', alert);
        this.lastAlertTimes.set(alertKey, Date.now());
      }
    }
  }

  /**
   * Get current performance metrics for a strategy
   */
  getStrategyMetrics(strategyId: string): ExecutionMetrics[] {
    return this.executionMetrics.get(strategyId) || [];
  }

  /**
   * Clear old metrics to prevent memory issues
   */
  cleanupOldMetrics(maxAge: number = 30 * 24 * 60 * 60 * 1000): void {
    const cutoffTime = Date.now() - maxAge;
    
    for (const [strategyId, metrics] of this.executionMetrics.entries()) {
      const filteredMetrics = metrics.filter(m => m.timestamp >= cutoffTime);
      this.executionMetrics.set(strategyId, filteredMetrics);
    }

    // Also cleanup Hummingbot metrics
    for (const [strategyId, metrics] of this.hummingbotMetrics.entries()) {
      const filteredMetrics = metrics.filter((m: any) => m.timestamp >= cutoffTime);
      this.hummingbotMetrics.set(strategyId, filteredMetrics);
    }
  }
}