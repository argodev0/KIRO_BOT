/**
 * Grid Trading Types and Interfaces
 * Core data structures for grid trading strategies
 */

import { WaveStructure, FibonacciLevels } from './analysis';

// Grid trading types
export interface Grid {
  id: string;
  symbol: string;
  strategy: GridStrategy;
  levels: GridLevel[];
  basePrice: number;
  spacing: number;
  totalProfit: number;
  status: GridStatus;
  metadata?: GridMetadata;
  createdAt: number;
  updatedAt: number;
  closedAt?: number;
}

export type GridStrategy = 'elliott_wave' | 'fibonacci' | 'standard' | 'dynamic';
export type GridStatus = 'active' | 'paused' | 'closed' | 'error';

export interface GridLevel {
  price: number;
  quantity: number;
  side: 'buy' | 'sell';
  orderId?: string;
  filled: boolean;
  filledAt?: number;
  profit?: number;
  fibonacciLevel?: number;
  waveContext?: WaveContext;
}

export interface GridMetadata {
  elliottWave?: WaveStructure;
  fibonacci?: FibonacciLevels;
  riskParameters?: GridRiskParameters;
  performance?: GridPerformance;
}

export interface WaveContext {
  currentWave: string;
  waveType: 'impulse' | 'corrective';
  wavePosition: number;
  expectedDirection: 'up' | 'down';
}

export interface GridRiskParameters {
  maxLevels: number;
  maxExposure: number;
  stopLoss?: number;
  takeProfit?: number;
  maxDrawdown: number;
}

export interface GridPerformance {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalFees: number;
  netProfit: number;
  maxDrawdown: number;
  sharpeRatio?: number;
}

// Grid configuration
export interface GridConfig {
  symbol: string;
  strategy: GridStrategy;
  basePrice?: number;
  spacing?: number;
  levels?: number;
  quantity?: number;
  riskParameters: GridRiskParameters;
  
  // Strategy-specific config
  elliottWaveConfig?: ElliottWaveGridConfig;
  fibonacciConfig?: FibonacciGridConfig;
  dynamicConfig?: DynamicGridConfig;
}

export interface ElliottWaveGridConfig {
  waveAnalysis: WaveStructure;
  longWaves: string[]; // e.g., ['wave_1', 'wave_3', 'wave_5']
  shortWaves: string[]; // e.g., ['wave_a', 'wave_b', 'wave_c']
  invalidationLevel: number;
  waveTargets: number[];
}

export interface FibonacciGridConfig {
  fibonacciLevels: FibonacciLevels;
  useRetracements: boolean;
  useExtensions: boolean;
  goldenRatioEmphasis: boolean;
  confluenceZones: boolean;
}

export interface DynamicGridConfig {
  volatilityAdjustment: boolean;
  volumeAdjustment: boolean;
  trendAdjustment: boolean;
  rebalanceFrequency: number; // minutes
  adaptationSpeed: number; // 0-1
}

// Grid calculation results
export interface GridCalculationResult {
  levels: GridLevel[];
  totalLevels: number;
  totalQuantity: number;
  requiredBalance: number;
  estimatedProfit: number;
  riskAssessment: GridRiskAssessment;
}

export interface GridRiskAssessment {
  maxPossibleLoss: number;
  maxExposure: number;
  breakEvenPrice: number;
  liquidationRisk: number;
  recommendation: 'safe' | 'moderate' | 'risky' | 'dangerous';
}

// Grid monitoring
export interface GridMonitoringData {
  gridId: string;
  currentPrice: number;
  activeLevels: number;
  filledLevels: number;
  pendingOrders: number;
  unrealizedPnl: number;
  realizedPnl: number;
  performance: GridPerformance;
  riskMetrics: GridRiskMetrics;
}

export interface GridRiskMetrics {
  currentExposure: number;
  maxExposureReached: number;
  drawdown: number;
  marginUtilization: number;
  liquidationDistance: number;
}

// Grid events
export interface GridEvent {
  gridId: string;
  type: GridEventType;
  timestamp: number;
  data: any;
  description: string;
}

export type GridEventType = 
  | 'grid_created' | 'grid_started' | 'grid_paused' | 'grid_closed'
  | 'level_filled' | 'level_cancelled' | 'level_modified'
  | 'profit_taken' | 'stop_loss_hit' | 'invalidation_triggered'
  | 'rebalance_executed' | 'risk_violation' | 'error_occurred';

// Grid optimization
export interface GridOptimizationParams {
  symbol: string;
  strategy: GridStrategy;
  timeframe: string;
  lookbackPeriod: number;
  optimizationMetric: 'profit' | 'sharpe_ratio' | 'win_rate' | 'drawdown';
}

export interface GridOptimizationResult {
  optimalSpacing: number;
  optimalLevels: number;
  optimalQuantity: number;
  expectedReturn: number;
  expectedRisk: number;
  backtestResults: GridBacktestResult;
}

export interface GridBacktestResult {
  totalTrades: number;
  winRate: number;
  totalProfit: number;
  maxDrawdown: number;
  sharpeRatio: number;
  calmarRatio: number;
  profitFactor: number;
}