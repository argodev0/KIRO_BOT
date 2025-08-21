/**
 * Trading Validation Schemas
 * Joi validation schemas for trading-related data structures
 */

import Joi from 'joi';

// Trading signal validation
export const signalReasoningSchema = Joi.object({
  technical: Joi.object({
    indicators: Joi.array().items(Joi.string()).required(),
    confluence: Joi.number().min(0).max(1).required(),
    trend: Joi.string().required()
  }).required(),
  patterns: Joi.object({
    detected: Joi.array().items(Joi.string()).required(),
    strength: Joi.number().min(0).max(1).required()
  }).required(),
  elliottWave: Joi.object({
    currentWave: Joi.string().required(),
    wavePosition: Joi.string().required(),
    validity: Joi.number().min(0).max(1).required()
  }).required(),
  fibonacci: Joi.object({
    levels: Joi.array().items(Joi.number().positive()).required(),
    confluence: Joi.number().min(0).max(1).required()
  }).required(),
  volume: Joi.object({
    profile: Joi.string().required(),
    strength: Joi.number().min(0).max(1).required()
  }).required(),
  summary: Joi.string().required().min(10).max(500)
});

export const tradingSignalSchema = Joi.object({
  id: Joi.string().optional(),
  symbol: Joi.string().required().min(3).max(20),
  direction: Joi.string().required().valid('long', 'short'),
  confidence: Joi.number().min(0).max(1).required(),
  entryPrice: Joi.number().positive().required(),
  stopLoss: Joi.number().positive().optional(),
  takeProfit: Joi.array().items(Joi.number().positive()).min(1).required(),
  reasoning: signalReasoningSchema.required(),
  timestamp: Joi.number().integer().positive().required(),
  status: Joi.string().optional().valid('pending', 'active', 'executed', 'cancelled', 'expired', 'closed'),
  technicalScore: Joi.number().min(0).max(1).optional(),
  patternScore: Joi.number().min(0).max(1).optional(),
  elliottWaveScore: Joi.number().min(0).max(1).optional(),
  fibonacciScore: Joi.number().min(0).max(1).optional(),
  volumeScore: Joi.number().min(0).max(1).optional()
}).custom((value, helpers) => {
  // Validate stop loss vs entry price
  if (value.stopLoss) {
    if (value.direction === 'long' && value.stopLoss >= value.entryPrice) {
      return helpers.error('any.invalid', { message: 'Stop loss must be below entry price for long positions' });
    }
    if (value.direction === 'short' && value.stopLoss <= value.entryPrice) {
      return helpers.error('any.invalid', { message: 'Stop loss must be above entry price for short positions' });
    }
  }
  
  // Validate take profit levels
  for (const tp of value.takeProfit) {
    if (value.direction === 'long' && tp <= value.entryPrice) {
      return helpers.error('any.invalid', { message: 'Take profit must be above entry price for long positions' });
    }
    if (value.direction === 'short' && tp >= value.entryPrice) {
      return helpers.error('any.invalid', { message: 'Take profit must be below entry price for short positions' });
    }
  }
  
  return value;
});

// Order validation
export const orderRequestSchema = Joi.object({
  symbol: Joi.string().required().min(3).max(20),
  side: Joi.string().required().valid('buy', 'sell'),
  type: Joi.string().required().valid('market', 'limit', 'stop', 'stop_limit'),
  quantity: Joi.number().positive().required(),
  price: Joi.number().positive().when('type', {
    is: Joi.string().valid('limit', 'stop_limit'),
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  stopPrice: Joi.number().positive().when('type', {
    is: Joi.string().valid('stop', 'stop_limit'),
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  timeInForce: Joi.string().optional().valid('GTC', 'IOC', 'FOK'),
  exchange: Joi.string().required().min(2).max(50),
  clientOrderId: Joi.string().optional().max(100)
});

export const orderResponseSchema = Joi.object({
  orderId: Joi.string().required(),
  clientOrderId: Joi.string().optional(),
  symbol: Joi.string().required().min(3).max(20),
  side: Joi.string().required().valid('buy', 'sell'),
  type: Joi.string().required(),
  quantity: Joi.number().positive().required(),
  price: Joi.number().positive().optional(),
  status: Joi.string().required().valid('new', 'partially_filled', 'filled', 'cancelled', 'rejected', 'expired'),
  timestamp: Joi.number().integer().positive().required(),
  exchange: Joi.string().required().min(2).max(50)
});

export const orderUpdateSchema = Joi.object({
  orderId: Joi.string().required(),
  status: Joi.string().required().valid('new', 'partially_filled', 'filled', 'cancelled', 'rejected', 'expired'),
  filledQuantity: Joi.number().min(0).required(),
  remainingQuantity: Joi.number().min(0).required(),
  averagePrice: Joi.number().positive().optional(),
  fee: Joi.number().min(0).optional(),
  timestamp: Joi.number().integer().positive().required()
}).custom((value, helpers) => {
  // Validate quantity relationships
  if (value.filledQuantity + value.remainingQuantity <= 0) {
    return helpers.error('any.invalid', { message: 'Filled + remaining quantity must be positive' });
  }
  return value;
});

// Position validation
export const positionSchema = Joi.object({
  id: Joi.string().required(),
  symbol: Joi.string().required().min(3).max(20),
  side: Joi.string().required().valid('long', 'short'),
  size: Joi.number().positive().required(),
  entryPrice: Joi.number().positive().required(),
  currentPrice: Joi.number().positive().required(),
  unrealizedPnl: Joi.number().required(),
  realizedPnl: Joi.number().optional(),
  stopLoss: Joi.number().positive().optional(),
  takeProfit: Joi.array().items(Joi.number().positive()).optional(),
  timestamp: Joi.number().integer().positive().required(),
  exchange: Joi.string().required().min(2).max(50)
});

export const portfolioSchema = Joi.object({
  totalBalance: Joi.number().min(0).required(),
  availableBalance: Joi.number().min(0).required(),
  positions: Joi.array().items(positionSchema).required(),
  totalUnrealizedPnl: Joi.number().required(),
  totalRealizedPnl: Joi.number().required(),
  maxDrawdown: Joi.number().min(0).max(1).required(),
  currentDrawdown: Joi.number().min(0).max(1).required(),
  equity: Joi.number().min(0).required(),
  margin: Joi.number().min(0).optional(),
  freeMargin: Joi.number().min(0).optional()
}).custom((value, helpers) => {
  // Validate balance relationships
  if (value.availableBalance > value.totalBalance) {
    return helpers.error('any.invalid', { message: 'Available balance cannot exceed total balance' });
  }
  return value;
});

// Risk management validation
export const riskParametersSchema = Joi.object({
  maxRiskPerTrade: Joi.number().min(0).max(1).required(),
  maxDailyLoss: Joi.number().min(0).max(1).required(),
  maxTotalExposure: Joi.number().min(1).required(),
  maxDrawdown: Joi.number().min(0).max(1).required(),
  stopLossRequired: Joi.boolean().required(),
  maxLeverage: Joi.number().min(1).max(1000).required()
});

export const riskViolationSchema = Joi.object({
  type: Joi.string().required().valid('max_risk_per_trade', 'max_daily_loss', 'max_exposure', 'max_drawdown', 'missing_stop_loss'),
  message: Joi.string().required(),
  currentValue: Joi.number().required(),
  maxAllowed: Joi.number().required()
});

export const riskValidationSchema = Joi.object({
  isValid: Joi.boolean().required(),
  violations: Joi.array().items(riskViolationSchema).required(),
  maxAllowedSize: Joi.number().min(0).required(),
  riskPercentage: Joi.number().min(0).max(1).required(),
  currentExposure: Joi.number().min(0).required()
});

export const drawdownStatusSchema = Joi.object({
  current: Joi.number().min(0).max(1).required(),
  maximum: Joi.number().min(0).max(1).required(),
  isViolation: Joi.boolean().required(),
  actionRequired: Joi.string().required().valid('none', 'reduce_positions', 'emergency_close')
});

// Trade execution validation
export const tradeExecutionSchema = Joi.object({
  id: Joi.string().required(),
  signalId: Joi.string().optional(),
  symbol: Joi.string().required().min(3).max(20),
  side: Joi.string().required().valid('buy', 'sell'),
  quantity: Joi.number().positive().required(),
  price: Joi.number().positive().required(),
  fee: Joi.number().min(0).optional(),
  exchange: Joi.string().required().min(2).max(50),
  orderId: Joi.string().optional(),
  realizedPnl: Joi.number().optional(),
  executedAt: Joi.number().integer().positive().required()
});

export const executionResultSchema = Joi.object({
  success: Joi.boolean().required(),
  orderId: Joi.string().optional(),
  executedQuantity: Joi.number().min(0).required(),
  averagePrice: Joi.number().positive().optional(),
  fee: Joi.number().min(0).optional(),
  error: Joi.string().optional(),
  timestamp: Joi.number().integer().positive().required()
});

// Validation functions
export const validateTradingSignal = (data: any) => {
  return tradingSignalSchema.validate(data);
};

export const validateOrderRequest = (data: any) => {
  return orderRequestSchema.validate(data);
};

export const validateOrderResponse = (data: any) => {
  return orderResponseSchema.validate(data);
};

export const validateOrderUpdate = (data: any) => {
  return orderUpdateSchema.validate(data);
};

export const validatePosition = (data: any) => {
  return positionSchema.validate(data);
};

export const validatePortfolio = (data: any) => {
  return portfolioSchema.validate(data);
};

export const validateRiskParameters = (data: any) => {
  return riskParametersSchema.validate(data);
};

export const validateRiskValidation = (data: any) => {
  return riskValidationSchema.validate(data);
};

export const validateDrawdownStatus = (data: any) => {
  return drawdownStatusSchema.validate(data);
};

export const validateTradeExecution = (data: any) => {
  return tradeExecutionSchema.validate(data);
};

export const validateExecutionResult = (data: any) => {
  return executionResultSchema.validate(data);
};