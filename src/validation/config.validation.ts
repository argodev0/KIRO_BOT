import Joi from 'joi';

// Strategy parameters validation schemas
const technicalAnalysisSchema = Joi.object({
  indicators: Joi.object({
    rsi: Joi.object({
      enabled: Joi.boolean().required(),
      period: Joi.number().integer().min(2).max(100).required(),
      overbought: Joi.number().min(50).max(100).required(),
      oversold: Joi.number().min(0).max(50).required()
    }).required(),
    waveTrend: Joi.object({
      enabled: Joi.boolean().required(),
      n1: Joi.number().integer().min(1).max(50).required(),
      n2: Joi.number().integer().min(1).max(100).required()
    }).required(),
    pvt: Joi.object({
      enabled: Joi.boolean().required(),
      period: Joi.number().integer().min(1).max(100).required()
    }).required()
  }).required(),
  patterns: Joi.object({
    enabled: Joi.boolean().required(),
    minConfidence: Joi.number().min(0).max(100).required(),
    patternTypes: Joi.array().items(Joi.string()).min(1).required()
  }).required(),
  confluence: Joi.object({
    minFactors: Joi.number().integer().min(1).max(10).required(),
    requiredIndicators: Joi.array().items(Joi.string()).min(1).required()
  }).required()
});

const elliottWaveSchema = Joi.object({
  enabled: Joi.boolean().required(),
  minWaveValidity: Joi.number().min(0).max(100).required(),
  waveTargets: Joi.boolean().required(),
  fibonacciProjections: Joi.boolean().required(),
  invalidationRules: Joi.boolean().required()
});

const fibonacciSchema = Joi.object({
  enabled: Joi.boolean().required(),
  retracementLevels: Joi.array().items(Joi.number().min(0).max(1)).min(1).required(),
  extensionLevels: Joi.array().items(Joi.number().min(1)).min(1).required(),
  confluenceDistance: Joi.number().min(0).max(1).required(),
  goldenRatioEmphasis: Joi.boolean().required()
});

const gridTradingSchema = Joi.object({
  enabled: Joi.boolean().required(),
  strategy: Joi.string().valid('elliott_wave', 'fibonacci', 'standard', 'dynamic').required(),
  spacing: Joi.number().min(0.001).max(1).required(),
  levels: Joi.number().integer().min(2).max(50).required(),
  dynamicAdjustment: Joi.boolean().required()
});

const multiStrategySchema = Joi.object({
  strategies: Joi.array().items(
    Joi.string().valid('technical_analysis', 'elliott_wave', 'fibonacci_confluence', 'grid_trading')
  ).min(2).required(),
  weights: Joi.object().pattern(
    Joi.string().valid('technical_analysis', 'elliott_wave', 'fibonacci_confluence', 'grid_trading'),
    Joi.number().min(0).max(1)
  ).required(),
  consensusRequired: Joi.number().min(0).max(1).required()
});

const strategyParametersSchema = Joi.object({
  technicalAnalysis: technicalAnalysisSchema,
  elliottWave: elliottWaveSchema,
  fibonacci: fibonacciSchema,
  gridTrading: gridTradingSchema,
  multiStrategy: multiStrategySchema
}).or('technicalAnalysis', 'elliottWave', 'fibonacci', 'gridTrading', 'multiStrategy');

// Trading hours validation
const tradingSessionSchema = Joi.object({
  name: Joi.string().required(),
  startTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  endTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  daysOfWeek: Joi.array().items(Joi.number().integer().min(0).max(6)).min(1).max(7).required()
});

const tradingHoursSchema = Joi.object({
  enabled: Joi.boolean().required(),
  timezone: Joi.string().required(),
  sessions: Joi.array().items(tradingSessionSchema).min(1).required()
});

// Strategy validation
const strategySchema = Joi.object({
  type: Joi.string().valid('technical_analysis', 'elliott_wave', 'fibonacci_confluence', 'grid_trading', 'multi_strategy').required(),
  parameters: strategyParametersSchema.required(),
  timeframes: Joi.array().items(Joi.string().valid('1m', '5m', '15m', '30m', '1h', '4h', '1d')).min(1).required(),
  symbols: Joi.array().items(Joi.string()).min(1).required(),
  maxConcurrentTrades: Joi.number().integer().min(1).max(20).required(),
  tradingHours: tradingHoursSchema
});

// Risk management validation
const emergencyStopSchema = Joi.object({
  enabled: Joi.boolean().required(),
  triggers: Joi.object({
    maxDailyLoss: Joi.boolean().required(),
    maxDrawdown: Joi.boolean().required(),
    consecutiveLosses: Joi.object({
      enabled: Joi.boolean().required(),
      count: Joi.number().integer().min(1).max(20).required()
    }).required(),
    marketVolatility: Joi.object({
      enabled: Joi.boolean().required(),
      threshold: Joi.number().min(0).max(1).required()
    }).required()
  }).required(),
  actions: Joi.object({
    closeAllPositions: Joi.boolean().required(),
    pauseTrading: Joi.boolean().required(),
    sendNotification: Joi.boolean().required()
  }).required()
});

const positionSizingSchema = Joi.object({
  method: Joi.string().valid('fixed', 'percentage', 'kelly', 'volatility_adjusted').required(),
  baseSize: Joi.number().min(0.001).max(100).required(),
  maxSize: Joi.number().min(0.001).max(100).required(),
  volatilityAdjustment: Joi.boolean().required(),
  correlationAdjustment: Joi.boolean().required()
});

const correlationLimitsSchema = Joi.object({
  enabled: Joi.boolean().required(),
  maxCorrelatedPositions: Joi.number().integer().min(1).max(10).required(),
  correlationThreshold: Joi.number().min(0).max(1).required(),
  timeframe: Joi.string().valid('1m', '5m', '15m', '30m', '1h', '4h', '1d').required()
});

const drawdownStepSchema = Joi.object({
  threshold: Joi.number().min(0).max(100).required(),
  action: Joi.string().valid('reduce_size', 'pause_trading', 'close_positions').required(),
  parameter: Joi.number().min(0).max(100).required()
});

const drawdownProtectionSchema = Joi.object({
  enabled: Joi.boolean().required(),
  maxDrawdown: Joi.number().min(0).max(100).required(),
  reductionSteps: Joi.array().items(drawdownStepSchema).min(1).required(),
  recoveryThreshold: Joi.number().min(0).max(100).required()
});

const riskManagementSchema = Joi.object({
  maxRiskPerTrade: Joi.number().min(0.1).max(20).required(),
  maxDailyLoss: Joi.number().min(1).max(50).required(),
  maxTotalExposure: Joi.number().min(1).max(20).required(),
  maxDrawdown: Joi.number().min(1).max(50).required(),
  stopLossRequired: Joi.boolean().required(),
  maxLeverage: Joi.number().min(1).max(100).required(),
  emergencyStop: emergencyStopSchema.required(),
  positionSizing: positionSizingSchema.required(),
  correlationLimits: correlationLimitsSchema.required(),
  drawdownProtection: drawdownProtectionSchema.required()
});

// Signal filters validation
const confidenceFilterSchema = Joi.object({
  enabled: Joi.boolean().required(),
  minConfidence: Joi.number().min(0).max(100).required(),
  maxSignalsPerHour: Joi.number().integer().min(1).max(100).required(),
  cooldownPeriod: Joi.number().integer().min(0).max(1440).required()
});

const technicalFilterSchema = Joi.object({
  enabled: Joi.boolean().required(),
  requiredIndicators: Joi.array().items(Joi.string()).min(0).required(),
  indicatorThresholds: Joi.object().pattern(Joi.string(), Joi.number()).required(),
  trendAlignment: Joi.boolean().required()
});

const patternFilterSchema = Joi.object({
  enabled: Joi.boolean().required(),
  allowedPatterns: Joi.array().items(Joi.string()).min(0).required(),
  minPatternStrength: Joi.number().min(0).max(100).required(),
  multiTimeframeConfirmation: Joi.boolean().required()
});

const confluenceFilterSchema = Joi.object({
  enabled: Joi.boolean().required(),
  minConfluenceFactors: Joi.number().integer().min(1).max(10).required(),
  requiredFactorTypes: Joi.array().items(Joi.string()).min(0).required(),
  confluenceWeight: Joi.number().min(0).max(1).required()
});

const timeframeFilterSchema = Joi.object({
  enabled: Joi.boolean().required(),
  primaryTimeframe: Joi.string().valid('1m', '5m', '15m', '30m', '1h', '4h', '1d').required(),
  confirmationTimeframes: Joi.array().items(
    Joi.string().valid('1m', '5m', '15m', '30m', '1h', '4h', '1d')
  ).min(0).required(),
  alignmentRequired: Joi.boolean().required()
});

const volumeFilterSchema = Joi.object({
  enabled: Joi.boolean().required(),
  minVolumeRatio: Joi.number().min(0.1).max(10).required(),
  volumeTrendRequired: Joi.boolean().required(),
  unusualVolumeDetection: Joi.boolean().required()
});

const signalFiltersSchema = Joi.object({
  confidence: confidenceFilterSchema.required(),
  technical: technicalFilterSchema.required(),
  patterns: patternFilterSchema.required(),
  confluence: confluenceFilterSchema.required(),
  timeframe: timeframeFilterSchema.required(),
  volume: volumeFilterSchema.required()
});

// Exchange configuration validation
const exchangeSchema = Joi.object({
  name: Joi.string().valid('binance', 'kucoin').required(),
  enabled: Joi.boolean().required(),
  apiKey: Joi.string().when('enabled', { is: true, then: Joi.required() }),
  apiSecret: Joi.string().when('enabled', { is: true, then: Joi.required() }),
  testnet: Joi.boolean().required(),
  rateLimits: Joi.object({
    ordersPerSecond: Joi.number().integer().min(1).max(100).required(),
    requestsPerMinute: Joi.number().integer().min(1).max(6000).required()
  }).required(),
  fees: Joi.object({
    maker: Joi.number().min(0).max(0.01).required(),
    taker: Joi.number().min(0).max(0.01).required()
  }).required(),
  symbols: Joi.array().items(Joi.string()).min(1).required()
});

// Notification configuration validation
const emailNotificationSchema = Joi.object({
  enabled: Joi.boolean().required(),
  address: Joi.string().email().when('enabled', { is: true, then: Joi.required() }),
  events: Joi.array().items(
    Joi.string().valid('signal_generated', 'trade_executed', 'position_closed', 'risk_violation', 'emergency_stop', 'grid_level_filled', 'system_error')
  ).min(0).required()
});

const webhookNotificationSchema = Joi.object({
  enabled: Joi.boolean().required(),
  url: Joi.string().uri().when('enabled', { is: true, then: Joi.required() }),
  events: Joi.array().items(
    Joi.string().valid('signal_generated', 'trade_executed', 'position_closed', 'risk_violation', 'emergency_stop', 'grid_level_filled', 'system_error')
  ).min(0).required(),
  headers: Joi.object().pattern(Joi.string(), Joi.string())
});

const inAppNotificationSchema = Joi.object({
  enabled: Joi.boolean().required(),
  events: Joi.array().items(
    Joi.string().valid('signal_generated', 'trade_executed', 'position_closed', 'risk_violation', 'emergency_stop', 'grid_level_filled', 'system_error')
  ).min(0).required(),
  sound: Joi.boolean().required()
});

const notificationsSchema = Joi.object({
  email: emailNotificationSchema.required(),
  webhook: webhookNotificationSchema.required(),
  inApp: inAppNotificationSchema.required()
});

// Main configuration schemas
export const createConfigSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500),
  strategy: strategySchema.required(),
  riskManagement: riskManagementSchema.required(),
  signalFilters: signalFiltersSchema.required(),
  gridConfig: Joi.object(), // Grid config validation would be more complex
  exchanges: Joi.array().items(exchangeSchema).min(1).required(),
  notifications: notificationsSchema.required()
});

export const updateConfigSchema = Joi.object({
  name: Joi.string().min(1).max(100),
  description: Joi.string().max(500),
  isActive: Joi.boolean(),
  strategy: strategySchema,
  riskManagement: riskManagementSchema,
  signalFilters: signalFiltersSchema,
  gridConfig: Joi.object(),
  exchanges: Joi.array().items(exchangeSchema).min(1),
  notifications: notificationsSchema
});

export const controlBotSchema = Joi.object({
  action: Joi.string().valid('start', 'stop', 'pause', 'resume').required(),
  confirmation: Joi.boolean(),
  reason: Joi.string().max(200)
});

export const backupConfigSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500)
});