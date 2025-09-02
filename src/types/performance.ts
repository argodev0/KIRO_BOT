export type ExecutionMethod = 'direct' | 'hummingbot' | 'hybrid';

export interface ExecutionMetrics {
  strategyId: string;
  executionMethod: ExecutionMethod;
  timestamp: number;
  latency: number; // milliseconds
  slippage: number; // percentage
  fillRate: number; // percentage (0-1)
  executionCost: number; // in base currency
  profitLoss: number; // in base currency
  volumeExecuted: number; // in base currency
  ordersPlaced: number;
  ordersFilled: number;
  averageSpread: number; // percentage
  marketImpact: number; // percentage
}

export interface StrategyPerformance {
  totalExecutions: number;
  averageLatency: number;
  averageSlippage: number;
  averageFillRate: number;
  totalProfitLoss: number;
  totalVolume: number;
  averageExecutionCost: number;
  successRate: number;
  averageSpread: number;
  averageMarketImpact: number;
}

export interface PerformanceComparison {
  strategyId: string;
  timeframe: number;
  directExecution: StrategyPerformance;
  hummingbotExecution: StrategyPerformance;
  improvement: {
    latency: number; // percentage improvement (positive = better)
    slippage: number;
    fillRate: number;
    profitability: number;
    executionCost: number;
  };
  recommendation: 'direct' | 'hummingbot' | 'maintain';
  confidence: number; // 0-1
}

export interface OptimizationParameters {
  minDataPoints: number;
  lookbackPeriod: number; // number of recent executions to consider
  optimizationGoals: OptimizationGoal[];
  constraints: OptimizationConstraint[];
  riskTolerance: 'low' | 'medium' | 'high';
}

export interface OptimizationGoal {
  metric: 'latency' | 'slippage' | 'fillRate' | 'profitability' | 'cost';
  target: 'minimize' | 'maximize';
  weight: number; // 0-1
}

export interface OptimizationConstraint {
  parameter: string;
  minValue?: number;
  maxValue?: number;
  stepSize?: number;
}

export interface OptimizationResult {
  strategyId: string;
  timestamp: number;
  originalParameters: Record<string, any>;
  optimizedParameters: Record<string, any>;
  currentPerformance: StrategyPerformance;
  projectedImprovement: StrategyPerformance;
  confidence: number; // 0-1
  backtestResults: StrategyPerformance;
  recommendations: string[];
}

export interface PerformanceDegradation {
  strategyId: string;
  timestamp: number;
  degradationType: ('latency' | 'slippage' | 'fillRate' | 'profitability')[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  metrics: {
    latencyChange: number; // percentage change
    slippageChange: number;
    fillRateChange: number;
    profitabilityChange: number;
  };
  recommendations: string[];
}

export interface PerformanceReport {
  strategyId: string;
  timeframe: number;
  generatedAt: number;
  totalExecutions: number;
  executionBreakdown: {
    direct: number;
    hummingbot: number;
  };
  overallPerformance: StrategyPerformance;
  executionMethodComparison: PerformanceComparison | null;
  performanceTrends: Record<string, number>;
  optimizationHistory: OptimizationResult[];
  recommendations: string[];
  riskMetrics: Record<string, number>;
}

export interface PerformanceAlert {
  type: 'degradation' | 'optimization' | 'comparison';
  severity: 'low' | 'medium' | 'high' | 'critical';
  strategyId: string;
  message: string;
  timestamp: number;
  data: any;
}

export interface HummingbotSpecificMetrics {
  strategyType: string;
  instanceId: string;
  configurationHash: string;
  hummingbotVersion: string;
  gatewayLatency: number;
  strategyRestarts: number;
  errorCount: number;
  warningCount: number;
  inventorySkew: number;
  spreadUtilization: number;
  orderBookDepth: number;
  competitorAnalysis: {
    competitorCount: number;
    averageCompetitorSpread: number;
    marketShareEstimate: number;
  };
  connectionStability: number; // 0-1 score
  apiResponseTime: number;
  orderBookSyncLatency: number;
  strategyHealthScore: number; // 0-1 score
}

export interface PerformanceThresholds {
  latencyWarning: number;
  latencyCritical: number;
  slippageWarning: number;
  slippageCritical: number;
  fillRateWarning: number;
  fillRateCritical: number;
  profitabilityWarning: number;
  profitabilityCritical: number;
}

export interface AlertConfiguration {
  enabled: boolean;
  thresholds: PerformanceThresholds;
  notificationChannels: ('email' | 'webhook' | 'dashboard')[];
  cooldownPeriod: number; // milliseconds
}

export interface PerformanceOptimizationSuggestion {
  type: 'parameter_adjustment' | 'execution_method_switch' | 'strategy_pause' | 'risk_reduction';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  expectedImprovement: number; // percentage
  implementationComplexity: 'easy' | 'medium' | 'hard';
  estimatedImpact: {
    latency?: number;
    slippage?: number;
    fillRate?: number;
    profitability?: number;
  };
  actionRequired: string;
  parameters?: Record<string, any>;
}

export interface AdvancedAnalytics {
  correlationAnalysis: Record<string, number>;
  seasonalityPatterns: Record<string, number>;
  marketRegimeAnalysis: {
    currentRegime: 'trending' | 'ranging' | 'volatile';
    regimeConfidence: number;
    optimalStrategy: string;
  };
  predictiveMetrics: {
    expectedLatency: number;
    expectedSlippage: number;
    expectedFillRate: number;
    confidenceInterval: number;
  };
}

export interface BenchmarkComparison {
  benchmarkName: string;
  benchmarkMetrics: StrategyPerformance;
  relativePerformance: {
    latency: number;
    slippage: number;
    fillRate: number;
    profitability: number;
  };
  ranking: number; // 1-100 percentile
}

export interface OptimizationBacktest {
  parameters: Record<string, any>;
  performance: StrategyPerformance;
  riskMetrics: Record<string, number>;
  drawdownAnalysis: {
    maxDrawdown: number;
    drawdownDuration: number;
    recoveryTime: number;
  };
  stressTestResults: {
    highVolatility: StrategyPerformance;
    lowLiquidity: StrategyPerformance;
    marketCrash: StrategyPerformance;
  };
}