/**
 * Grid Trading Validation Schemas
 * Joi validation schemas for grid trading data structures
 */

import Joi from 'joi';

// Grid level validation
export const gridLevelSchema = Joi.object({
  price: Joi.number().positive().required(),
  quantity: Joi.number().positive().required(),
  side: Joi.string().required().valid('buy', 'sell'),
  orderId: Joi.string().optional(),
  filled: Joi.boolean().required(),
  filledAt: Joi.number().integer().positive().optional(),
  profit: Joi.number().optional(),
  fibonacciLevel: Joi.number().positive().optional(),
  waveContext: Joi.object({
    currentWave: Joi.string().required(),
    waveType: Joi.string().required().valid('impulse', 'corrective'),
    wavePosition: Joi.number().integer().min(1).required(),
    expectedDirection: Joi.string().required().valid('up', 'down')
  }).optional()
});

// Grid performance validation
export const gridPerformanceSchema = Joi.object({
  totalTrades: Joi.number().integer().min(0).required(),
  winningTrades: Joi.number().integer().min(0).required(),
  losingTrades: Joi.number().integer().min(0).required(),
  winRate: Joi.number().min(0).max(1).required(),
  totalProfit: Joi.number().required(),
  totalFees: Joi.number().min(0).required(),
  netProfit: Joi.number().required(),
  maxDrawdown: Joi.number().min(0).max(1).required(),
  sharpeRatio: Joi.number().optional()
}).custom((value, helpers) => {
  // Validate trade counts
  if (value.winningTrades + value.losingTrades !== value.totalTrades) {
    return helpers.error('any.invalid', { message: 'Winning + losing trades must equal total trades' });
  }
  
  // Validate win rate calculation
  const expectedWinRate = value.totalTrades > 0 ? value.winningTrades / value.totalTrades : 0;
  if (Math.abs(value.winRate - expectedWinRate) > 0.001) {
    return helpers.error('any.invalid', { message: 'Win rate calculation is incorrect' });
  }
  
  return value;
});

// Grid risk parameters validation
export const gridRiskParametersSchema = Joi.object({
  maxLevels: Joi.number().integer().min(1).max(1000).required(),
  maxExposure: Joi.number().positive().required(),
  stopLoss: Joi.number().positive().optional(),
  takeProfit: Joi.number().positive().optional(),
  maxDrawdown: Joi.number().min(0).max(1).required()
});

// Grid metadata validation
export const gridMetadataSchema = Joi.object({
  elliottWave: Joi.object({
    waves: Joi.array().required(),
    currentWave: Joi.object().required(),
    waveCount: Joi.number().integer().required(),
    degree: Joi.string().required(),
    validity: Joi.number().min(0).max(1).required(),
    nextTargets: Joi.array().required(),
    invalidationLevel: Joi.number().positive().required()
  }).optional(),
  fibonacci: Joi.object({
    retracements: Joi.array().required(),
    extensions: Joi.array().required(),
    timeProjections: Joi.array().required(),
    confluenceZones: Joi.array().required(),
    highPrice: Joi.number().positive().required(),
    lowPrice: Joi.number().positive().required(),
    swingHigh: Joi.number().positive().required(),
    swingLow: Joi.number().positive().required()
  }).optional(),
  riskParameters: gridRiskParametersSchema.optional(),
  performance: gridPerformanceSchema.optional()
});

// Main grid validation
export const gridSchema = Joi.object({
  id: Joi.string().required(),
  symbol: Joi.string().required().min(3).max(20),
  strategy: Joi.string().required().valid('elliott_wave', 'fibonacci', 'standard', 'dynamic'),
  levels: Joi.array().items(gridLevelSchema).required().min(1),
  basePrice: Joi.number().positive().required(),
  spacing: Joi.number().positive().required(),
  totalProfit: Joi.number().required(),
  status: Joi.string().required().valid('active', 'paused', 'closed', 'error'),
  metadata: gridMetadataSchema.optional(),
  createdAt: Joi.number().integer().positive().required(),
  updatedAt: Joi.number().integer().positive().required(),
  closedAt: Joi.number().integer().positive().optional()
}).custom((value, helpers) => {
  // Validate timestamps
  if (value.updatedAt < value.createdAt) {
    return helpers.error('any.invalid', { message: 'Updated timestamp must be >= created timestamp' });
  }
  
  if (value.closedAt && value.closedAt < value.createdAt) {
    return helpers.error('any.invalid', { message: 'Closed timestamp must be >= created timestamp' });
  }
  
  // Validate grid levels are sorted by price
  const prices = value.levels.map((level: any) => level.price);
  const sortedPrices = [...prices].sort((a: number, b: number) => a - b);
  if (!prices.every((price: number, index: number) => price === sortedPrices[index])) {
    return helpers.error('grid.unsortedLevels');
  }
  
  return value;
});

// Grid configuration validation
export const elliottWaveGridConfigSchema = Joi.object({
  waveAnalysis: Joi.object().required(),
  longWaves: Joi.array().items(Joi.string()).required().min(1),
  shortWaves: Joi.array().items(Joi.string()).required().min(1),
  invalidationLevel: Joi.number().positive().required(),
  waveTargets: Joi.array().items(Joi.number().positive()).required()
});

export const fibonacciGridConfigSchema = Joi.object({
  fibonacciLevels: Joi.object().required(),
  useRetracements: Joi.boolean().required(),
  useExtensions: Joi.boolean().required(),
  goldenRatioEmphasis: Joi.boolean().required(),
  confluenceZones: Joi.boolean().required()
});

export const dynamicGridConfigSchema = Joi.object({
  volatilityAdjustment: Joi.boolean().required(),
  volumeAdjustment: Joi.boolean().required(),
  trendAdjustment: Joi.boolean().required(),
  rebalanceFrequency: Joi.number().integer().min(1).required(),
  adaptationSpeed: Joi.number().min(0).max(1).required()
});

export const gridConfigSchema = Joi.object({
  symbol: Joi.string().required().min(3).max(20),
  strategy: Joi.string().required().valid('elliott_wave', 'fibonacci', 'standard', 'dynamic'),
  basePrice: Joi.number().positive().optional(),
  spacing: Joi.number().positive().optional(),
  levels: Joi.number().integer().min(1).max(1000).optional(),
  quantity: Joi.number().positive().optional(),
  riskParameters: gridRiskParametersSchema.required(),
  elliottWaveConfig: elliottWaveGridConfigSchema.when('strategy', {
    is: 'elliott_wave',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  fibonacciConfig: fibonacciGridConfigSchema.when('strategy', {
    is: 'fibonacci',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  dynamicConfig: dynamicGridConfigSchema.when('strategy', {
    is: 'dynamic',
    then: Joi.required(),
    otherwise: Joi.optional()
  })
});

// Grid calculation result validation
export const gridRiskAssessmentSchema = Joi.object({
  maxPossibleLoss: Joi.number().required(),
  maxExposure: Joi.number().positive().required(),
  breakEvenPrice: Joi.number().positive().required(),
  liquidationRisk: Joi.number().min(0).max(1).required(),
  recommendation: Joi.string().required().valid('safe', 'moderate', 'risky', 'dangerous')
});

export const gridCalculationResultSchema = Joi.object({
  levels: Joi.array().items(gridLevelSchema).required().min(1),
  totalLevels: Joi.number().integer().min(1).required(),
  totalQuantity: Joi.number().positive().required(),
  requiredBalance: Joi.number().positive().required(),
  estimatedProfit: Joi.number().required(),
  riskAssessment: gridRiskAssessmentSchema.required()
}).custom((value, helpers) => {
  // Validate level count matches
  if (value.levels.length !== value.totalLevels) {
    return helpers.error('any.invalid', { message: 'Level count must match total levels' });
  }
  
  // Validate total quantity calculation
  const calculatedQuantity = value.levels.reduce((sum: number, level: any) => sum + level.quantity, 0);
  if (Math.abs(calculatedQuantity - value.totalQuantity) > 0.00000001) {
    return helpers.error('any.invalid', { message: 'Total quantity calculation is incorrect' });
  }
  
  return value;
});

// Grid monitoring validation
export const gridRiskMetricsSchema = Joi.object({
  currentExposure: Joi.number().min(0).required(),
  maxExposureReached: Joi.number().min(0).required(),
  drawdown: Joi.number().min(0).max(1).required(),
  marginUtilization: Joi.number().min(0).max(1).required(),
  liquidationDistance: Joi.number().min(0).required()
});

export const gridMonitoringDataSchema = Joi.object({
  gridId: Joi.string().required(),
  currentPrice: Joi.number().positive().required(),
  activeLevels: Joi.number().integer().min(0).required(),
  filledLevels: Joi.number().integer().min(0).required(),
  pendingOrders: Joi.number().integer().min(0).required(),
  unrealizedPnl: Joi.number().required(),
  realizedPnl: Joi.number().required(),
  performance: gridPerformanceSchema.required(),
  riskMetrics: gridRiskMetricsSchema.required()
});

// Grid event validation
export const gridEventSchema = Joi.object({
  gridId: Joi.string().required(),
  type: Joi.string().required().valid(
    'grid_created', 'grid_started', 'grid_paused', 'grid_closed',
    'level_filled', 'level_cancelled', 'level_modified',
    'profit_taken', 'stop_loss_hit', 'invalidation_triggered',
    'rebalance_executed', 'risk_violation', 'error_occurred'
  ),
  timestamp: Joi.number().integer().positive().required(),
  data: Joi.any().required(),
  description: Joi.string().required().min(5).max(500)
});

// Grid optimization validation
export const gridOptimizationParamsSchema = Joi.object({
  symbol: Joi.string().required().min(3).max(20),
  strategy: Joi.string().required().valid('elliott_wave', 'fibonacci', 'standard', 'dynamic'),
  timeframe: Joi.string().required().valid('1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'),
  lookbackPeriod: Joi.number().integer().min(1).max(10000).required(),
  optimizationMetric: Joi.string().required().valid('profit', 'sharpe_ratio', 'win_rate', 'drawdown')
});

export const gridBacktestResultSchema = Joi.object({
  totalTrades: Joi.number().integer().min(0).required(),
  winRate: Joi.number().min(0).max(1).required(),
  totalProfit: Joi.number().required(),
  maxDrawdown: Joi.number().min(0).max(1).required(),
  sharpeRatio: Joi.number().required(),
  calmarRatio: Joi.number().required(),
  profitFactor: Joi.number().min(0).required()
});

export const gridOptimizationResultSchema = Joi.object({
  optimalSpacing: Joi.number().positive().required(),
  optimalLevels: Joi.number().integer().min(1).required(),
  optimalQuantity: Joi.number().positive().required(),
  expectedReturn: Joi.number().required(),
  expectedRisk: Joi.number().min(0).required(),
  backtestResults: gridBacktestResultSchema.required()
});

// Validation functions
export const validateGrid = (data: any) => {
  return gridSchema.validate(data);
};

export const validateGridLevel = (data: any) => {
  return gridLevelSchema.validate(data);
};

export const validateGridConfig = (data: any) => {
  return gridConfigSchema.validate(data);
};

export const validateGridCalculationResult = (data: any) => {
  return gridCalculationResultSchema.validate(data);
};

export const validateGridMonitoringData = (data: any) => {
  return gridMonitoringDataSchema.validate(data);
};

export const validateGridEvent = (data: any) => {
  return gridEventSchema.validate(data);
};

export const validateGridOptimizationParams = (data: any) => {
  return gridOptimizationParamsSchema.validate(data);
};

export const validateGridOptimizationResult = (data: any) => {
  return gridOptimizationResultSchema.validate(data);
};

export const validateGridPerformance = (data: any) => {
  return gridPerformanceSchema.validate(data);
};

export const validateGridRiskParameters = (data: any) => {
  return gridRiskParametersSchema.validate(data);
};