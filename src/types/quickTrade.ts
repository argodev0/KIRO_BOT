export interface NKNProbabilityAnalysis {
  entryProbability: number;
  exitProbability: number;
  confidenceScore: number;
  timeHorizon: number;
  riskScore: number;
  marketRegime: 'trending' | 'ranging' | 'volatile' | 'stable';
}

export interface LinearRegressionAnalysis {
  slope: number;
  intercept: number;
  rSquared: number;
  trendStrength: number;
  directionalBias: 'bullish' | 'bearish' | 'neutral';
  trendProbability: number;
  supportLevel: number;
  resistanceLevel: number;
}

export interface VolatilityMetrics {
  currentVolatility: number;
  historicalVolatility: number;
  volatilityRatio: number;
  volatilityTrend: 'increasing' | 'decreasing' | 'stable';
  atr: number;
  bollingerBandWidth: number;
}

export interface QuickTradePosition {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  entryTime: number;
  probabilityScore: number;
  riskScore: number;
  targetPrice?: number;
  stopLoss?: number;
  hedgePositionId?: string;
}

export interface HedgeModeConfig {
  enabled: boolean;
  activationThreshold: number;
  hedgeRatio: number;
  maxHedgePositions: number;
  hedgeDelayMs: number;
  correlationThreshold: number;
}

export interface QuickTradeConfig {
  maxConcurrentPositions: number;
  maxPositionSize: number;
  minProbabilityThreshold: number;
  maxRiskPerTrade: number;
  hedgeMode: HedgeModeConfig;
  executionTimeoutMs: number;
  slippageTolerance: number;
  minTrendStrength: number;
}

export interface MarketConditions {
  volatility: VolatilityMetrics;
  trend: LinearRegressionAnalysis;
  probability: NKNProbabilityAnalysis;
  liquidity: number;
  spread: number;
  volume: number;
  timestamp: number;
}

export interface QuickTradeSignal {
  id: string;
  symbol: string;
  action: 'enter_long' | 'enter_short' | 'exit' | 'hedge';
  confidence: number;
  urgency: 'low' | 'medium' | 'high';
  positionSize: number;
  targetPrice: number;
  stopLoss: number;
  timeToLive: number;
  marketConditions: MarketConditions;
  nknAnalysis: NKNProbabilityAnalysis;
  regressionAnalysis: LinearRegressionAnalysis;
}

export interface RiskMetrics {
  totalExposure: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  maxConsecutiveLosses: number;
}

export interface ExecutionResult {
  success: boolean;
  positionId?: string;
  executedPrice: number;
  executedSize: number;
  slippage: number;
  latency: number;
  error?: string;
  timestamp: number;
}