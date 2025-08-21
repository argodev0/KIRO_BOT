/**
 * Analytics and Performance Types
 * Type definitions for performance analytics and reporting
 */

export interface PerformanceAnalytics {
  userId: string;
  period: AnalyticsPeriod;
  startDate: Date;
  endDate: Date;
  
  // Core performance metrics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  
  // Financial metrics
  totalReturn: number;
  totalReturnPercentage: number;
  realizedPnl: number;
  unrealizedPnl: number;
  maxDrawdown: number;
  currentDrawdown: number;
  
  // Risk-adjusted metrics
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxConsecutiveLosses: number;
  maxConsecutiveWins: number;
  
  // Trading frequency metrics
  averageTradesPerDay: number;
  averageHoldingTime: number; // in hours
  
  // Pattern-specific analytics
  patternAnalytics: PatternAnalytics[];
  
  // Elliott Wave analytics
  elliottWaveAnalytics: ElliottWaveAnalytics;
  
  // Fibonacci analytics
  fibonacciAnalytics: FibonacciAnalytics;
  
  // Grid trading analytics
  gridAnalytics?: GridAnalytics;
  
  calculatedAt: Date;
}

export interface PatternAnalytics {
  patternType: string;
  totalSignals: number;
  successfulSignals: number;
  successRate: number;
  averageReturn: number;
  averageHoldingTime: number;
  confidenceDistribution: ConfidenceDistribution;
}

export interface ElliottWaveAnalytics {
  totalWaveAnalyses: number;
  correctWaveIdentifications: number;
  waveAccuracy: number;
  
  // Wave-specific performance
  impulseWavePerformance: WavePerformance;
  correctiveWavePerformance: WavePerformance;
  
  // Wave degree accuracy
  waveDegreeAccuracy: Record<string, number>;
  
  // Target achievement rates
  waveTargetAccuracy: number;
  fibonacciProjectionAccuracy: number;
}

export interface WavePerformance {
  totalTrades: number;
  successfulTrades: number;
  successRate: number;
  averageReturn: number;
  averageAccuracy: number;
}

export interface FibonacciAnalytics {
  totalFibonacciSignals: number;
  successfulRetracements: number;
  successfulExtensions: number;
  
  // Level-specific performance
  retracementLevelPerformance: Record<string, LevelPerformance>;
  extensionLevelPerformance: Record<string, LevelPerformance>;
  
  // Confluence zone performance
  confluenceZoneAccuracy: number;
  goldenRatioPerformance: LevelPerformance;
  
  // Time-based Fibonacci accuracy
  timeFibonacciAccuracy: number;
}

export interface LevelPerformance {
  totalTests: number;
  successfulTests: number;
  accuracy: number;
  averageReactionStrength: number;
  averageHoldTime: number;
}

export interface GridAnalytics {
  totalGrids: number;
  activeGrids: number;
  completedGrids: number;
  
  // Performance metrics
  totalGridProfit: number;
  averageGridProfit: number;
  gridSuccessRate: number;
  
  // Strategy-specific performance
  elliottWaveGridPerformance: GridStrategyPerformance;
  fibonacciGridPerformance: GridStrategyPerformance;
  standardGridPerformance: GridStrategyPerformance;
  
  // Grid efficiency metrics
  averageGridDuration: number;
  averageFillRate: number;
  optimalSpacingAnalysis: SpacingAnalysis;
}

export interface GridStrategyPerformance {
  totalGrids: number;
  successfulGrids: number;
  successRate: number;
  averageProfit: number;
  averageDuration: number;
}

export interface SpacingAnalysis {
  optimalSpacing: number;
  spacingPerformanceMap: Record<string, number>;
  recommendedSpacing: number;
}

export interface ConfidenceDistribution {
  low: number; // 0-40%
  medium: number; // 40-70%
  high: number; // 70-100%
}

export interface TradeAnalytics {
  tradeId: string;
  signalId?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  
  // Performance metrics
  realizedPnl?: number | undefined;
  returnPercentage?: number | undefined;
  holdingTime?: number | undefined; // in hours
  
  // Analysis context
  patternType?: string | undefined;
  elliottWaveContext?: ElliottWaveContext | undefined;
  fibonacciContext?: FibonacciContext | undefined;
  confidenceScore?: number | undefined;
  
  // Execution metrics
  slippage?: number | undefined;
  executionTime?: number | undefined; // in milliseconds
  
  // Timestamps
  entryTime: Date;
  exitTime?: Date | undefined;
}

export interface ElliottWaveContext {
  waveType: 'impulse' | 'corrective';
  wavePosition: string; // e.g., "Wave 3", "Wave A"
  waveDegree: string;
  waveTargets: number[];
  actualWaveCompletion?: boolean;
}

export interface FibonacciContext {
  levelType: 'retracement' | 'extension';
  level: number; // e.g., 0.618, 1.618
  confluenceZone: boolean;
  priceReaction: 'strong' | 'moderate' | 'weak';
}

export interface PortfolioPerformance {
  userId: string;
  timestamp: Date;
  
  // Portfolio composition
  totalValue: number;
  cashBalance: number;
  positionsValue: number;
  
  // Performance metrics
  dailyReturn: number;
  weeklyReturn: number;
  monthlyReturn: number;
  yearlyReturn: number;
  
  // Risk metrics
  volatility: number;
  beta?: number;
  var95: number; // Value at Risk 95%
  expectedShortfall: number;
  
  // Allocation metrics
  assetAllocation: AssetAllocation[];
  concentrationRisk: number;
  correlationMatrix?: Record<string, Record<string, number>>;
}

export interface AssetAllocation {
  symbol: string;
  allocation: number; // percentage
  value: number;
  return24h: number;
  volatility: number;
}

export interface AnalyticsReport {
  id: string;
  userId: string;
  reportType: ReportType;
  period: AnalyticsPeriod;
  data: PerformanceAnalytics | PatternAnalytics[] | ElliottWaveAnalytics | FibonacciAnalytics;
  generatedAt: Date;
  format: 'json' | 'pdf' | 'csv';
}

export interface AnalyticsVisualization {
  chartType: ChartType;
  title: string;
  data: ChartData;
  config: ChartConfig;
}

export interface ChartData {
  labels: string[];
  datasets: Dataset[];
}

export interface Dataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string;
  borderWidth?: number;
  fill?: boolean;
}

export interface ChartConfig {
  responsive: boolean;
  maintainAspectRatio: boolean;
  scales?: any;
  plugins?: any;
  interaction?: any;
}

// Enums
export enum AnalyticsPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  ALL_TIME = 'all_time',
  CUSTOM = 'custom'
}

export enum ReportType {
  PERFORMANCE_SUMMARY = 'performance_summary',
  PATTERN_ANALYSIS = 'pattern_analysis',
  ELLIOTT_WAVE_ANALYSIS = 'elliott_wave_analysis',
  FIBONACCI_ANALYSIS = 'fibonacci_analysis',
  GRID_ANALYSIS = 'grid_analysis',
  RISK_ANALYSIS = 'risk_analysis',
  PORTFOLIO_ANALYSIS = 'portfolio_analysis'
}

export enum ChartType {
  LINE = 'line',
  BAR = 'bar',
  PIE = 'pie',
  DOUGHNUT = 'doughnut',
  SCATTER = 'scatter',
  AREA = 'area',
  CANDLESTICK = 'candlestick',
  HEATMAP = 'heatmap'
}

// Analytics calculation interfaces
export interface AnalyticsCalculator {
  calculatePerformanceMetrics(trades: TradeAnalytics[]): PerformanceMetrics;
  calculateSharpeRatio(returns: number[], riskFreeRate?: number): number;
  calculateMaxDrawdown(portfolioValues: number[]): number;
  calculateWinRate(trades: TradeAnalytics[]): number;
}

export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
}

// Database interfaces for analytics storage
export interface AnalyticsStorage {
  storePerformanceMetrics(userId: string, metrics: PerformanceAnalytics): Promise<void>;
  getPerformanceMetrics(userId: string, period: AnalyticsPeriod): Promise<PerformanceAnalytics | null>;
  storeTradeAnalytics(trade: TradeAnalytics): Promise<void>;
  getTradeAnalytics(userId: string, filters?: TradeAnalyticsFilters): Promise<TradeAnalytics[]>;
}

export interface TradeAnalyticsFilters {
  symbol?: string;
  startDate?: Date;
  endDate?: Date;
  patternType?: string;
  minConfidence?: number;
  maxConfidence?: number;
}