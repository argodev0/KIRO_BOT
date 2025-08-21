/**
 * Analysis Validation Schemas
 * Joi validation schemas for technical analysis data structures
 */

import Joi from 'joi';

// Pattern type validation
const patternTypes = [
  'doji', 'hammer', 'hanging_man', 'shooting_star', 'inverted_hammer',
  'engulfing_bullish', 'engulfing_bearish', 'harami_bullish', 'harami_bearish',
  'morning_star', 'evening_star', 'piercing_line', 'dark_cloud_cover',
  'spinning_top', 'marubozu_bullish', 'marubozu_bearish',
  'three_white_soldiers', 'three_black_crows',
  'long_legged_doji', 'dragonfly_doji', 'gravestone_doji'
];

const waveTypes = [
  'wave_1', 'wave_2', 'wave_3', 'wave_4', 'wave_5',
  'wave_a', 'wave_b', 'wave_c',
  'wave_w', 'wave_x', 'wave_y', 'wave_z'
];

const waveDegrees = [
  'subminuette', 'minuette', 'minute', 'minor', 'intermediate',
  'primary', 'cycle', 'supercycle', 'grand_supercycle'
];

// Technical indicators validation
export const waveTrendDataSchema = Joi.object({
  wt1: Joi.number().required(),
  wt2: Joi.number().required(),
  signal: Joi.string().required().valid('buy', 'sell', 'neutral'),
  divergence: Joi.string().optional().valid('bullish', 'bearish').allow(null)
});

export const technicalIndicatorsSchema = Joi.object({
  rsi: Joi.number().min(0).max(100).required(),
  waveTrend: waveTrendDataSchema.required(),
  pvt: Joi.number().required(),
  supportLevels: Joi.array().items(Joi.number().positive()).required(),
  resistanceLevels: Joi.array().items(Joi.number().positive()).required(),
  trend: Joi.string().required().valid('bullish', 'bearish', 'sideways'),
  momentum: Joi.string().required().valid('strong', 'weak', 'neutral'),
  volatility: Joi.number().min(0).required()
});

// Candlestick pattern validation
export const candlestickPatternSchema = Joi.object({
  type: Joi.string().required().valid(...patternTypes),
  confidence: Joi.number().min(0).max(1).required(),
  startIndex: Joi.number().integer().min(0).required(),
  endIndex: Joi.number().integer().min(0).required(),
  direction: Joi.string().required().valid('bullish', 'bearish'),
  strength: Joi.string().required().valid('weak', 'moderate', 'strong'),
  description: Joi.string().required().min(5).max(200),
  reliability: Joi.number().min(0).max(1).required()
}).custom((value, helpers) => {
  if (value.endIndex <= value.startIndex) {
    return helpers.error('any.invalid', { message: 'End index must be greater than start index' });
  }
  return value;
});

// Elliott Wave validation
export const waveSchema = Joi.object({
  id: Joi.string().required(),
  type: Joi.string().required().valid(...waveTypes),
  degree: Joi.string().required().valid(...waveDegrees),
  startPrice: Joi.number().positive().required(),
  endPrice: Joi.number().positive().required(),
  startTime: Joi.number().integer().positive().required(),
  endTime: Joi.number().integer().positive().required(),
  length: Joi.number().positive().required(),
  duration: Joi.number().positive().required(),
  fibonacciRatio: Joi.number().positive().optional()
}).custom((value, helpers) => {
  if (value.endTime <= value.startTime) {
    return helpers.error('any.invalid', { message: 'End time must be greater than start time' });
  }
  return value;
});

export const waveTargetSchema = Joi.object({
  price: Joi.number().positive().required(),
  probability: Joi.number().min(0).max(1).required(),
  type: Joi.string().required().valid('fibonacci_extension', 'fibonacci_retracement', 'wave_equality', 'channel_projection'),
  description: Joi.string().required().min(5).max(200)
});

export const waveStructureSchema = Joi.object({
  waves: Joi.array().items(waveSchema).required().min(1),
  currentWave: waveSchema.required(),
  waveCount: Joi.number().integer().min(1).required(),
  degree: Joi.string().required().valid(...waveDegrees),
  validity: Joi.number().min(0).max(1).required(),
  nextTargets: Joi.array().items(waveTargetSchema).required(),
  invalidationLevel: Joi.number().positive().required()
});

// Fibonacci validation
export const fibonacciLevelSchema = Joi.object({
  ratio: Joi.number().positive().required(),
  price: Joi.number().positive().required(),
  type: Joi.string().required().valid('retracement', 'extension'),
  strength: Joi.number().min(0).max(1).required(),
  description: Joi.string().required().min(5).max(100)
});

export const timeFibonacciSchema = Joi.object({
  ratio: Joi.number().positive().required(),
  timestamp: Joi.number().integer().positive().required(),
  description: Joi.string().required().min(5).max(100)
});

export const confluenceFactorSchema = Joi.object({
  type: Joi.string().required().valid('fibonacci', 'support_resistance', 'elliott_wave', 'pattern', 'indicator'),
  description: Joi.string().required().min(5).max(200),
  weight: Joi.number().min(0).max(1).required()
});

export const confluenceZoneSchema = Joi.object({
  priceLevel: Joi.number().positive().required(),
  strength: Joi.number().min(0).max(1).required(),
  factors: Joi.array().items(confluenceFactorSchema).required().min(1),
  type: Joi.string().required().valid('support', 'resistance', 'reversal'),
  reliability: Joi.number().min(0).max(1).required()
});

export const fibonacciLevelsSchema = Joi.object({
  retracements: Joi.array().items(fibonacciLevelSchema).required(),
  extensions: Joi.array().items(fibonacciLevelSchema).required(),
  timeProjections: Joi.array().items(timeFibonacciSchema).required(),
  confluenceZones: Joi.array().items(confluenceZoneSchema).required(),
  highPrice: Joi.number().positive().required(),
  lowPrice: Joi.number().positive().required(),
  swingHigh: Joi.number().positive().required(),
  swingLow: Joi.number().positive().required()
}).custom((value, helpers) => {
  if (value.lowPrice >= value.highPrice) {
    return helpers.error('any.invalid', { message: 'Low price must be less than high price' });
  }
  if (value.swingLow >= value.swingHigh) {
    return helpers.error('any.invalid', { message: 'Swing low must be less than swing high' });
  }
  return value;
});

// Market regime validation
export const marketRegimeSchema = Joi.object({
  type: Joi.string().required().valid('trending', 'ranging', 'breakout', 'reversal'),
  strength: Joi.number().min(0).max(1).required(),
  duration: Joi.number().positive().required(),
  volatility: Joi.string().required().valid('low', 'medium', 'high'),
  volume: Joi.string().required().valid('low', 'medium', 'high'),
  confidence: Joi.number().min(0).max(1).required()
});

// Volume analysis validation
export const volumeNodeSchema = Joi.object({
  price: Joi.number().positive().required(),
  volume: Joi.number().min(0).required(),
  percentage: Joi.number().min(0).max(100).required()
});

export const volumeProfileSchema = Joi.object({
  volumeByPrice: Joi.array().items(volumeNodeSchema).required().min(1),
  poc: Joi.number().positive().required(),
  valueAreaHigh: Joi.number().positive().required(),
  valueAreaLow: Joi.number().positive().required(),
  volumeTrend: Joi.string().required().valid('increasing', 'decreasing', 'stable'),
  volumeStrength: Joi.number().min(0).max(1).required()
}).custom((value, helpers) => {
  if (value.valueAreaLow >= value.valueAreaHigh) {
    return helpers.error('any.invalid', { message: 'Value area low must be less than value area high' });
  }
  return value;
});

// Main analysis results validation
export const analysisResultsSchema = Joi.object({
  symbol: Joi.string().required().min(3).max(20),
  timeframe: Joi.string().required().valid('1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'),
  timestamp: Joi.number().integer().positive().required(),
  technical: technicalIndicatorsSchema.required(),
  patterns: Joi.array().items(candlestickPatternSchema).required(),
  elliottWave: waveStructureSchema.required(),
  fibonacci: fibonacciLevelsSchema.required(),
  confluence: Joi.array().items(confluenceZoneSchema).required(),
  marketRegime: marketRegimeSchema.required(),
  volumeProfile: volumeProfileSchema.required()
});

// Multi-timeframe analysis validation
export const multiTimeframeAnalysisSchema = Joi.object({
  symbol: Joi.string().required().min(3).max(20),
  timestamp: Joi.number().integer().positive().required(),
  timeframes: Joi.object().pattern(
    Joi.string().valid('1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'),
    analysisResultsSchema
  ).required(),
  consensus: Joi.object({
    direction: Joi.string().required().valid('bullish', 'bearish', 'neutral'),
    strength: Joi.number().min(0).max(1).required(),
    confluence: Joi.number().min(0).max(1).required()
  }).required()
});

// Signal filter validation
export const signalFilterSchema = Joi.object({
  minConfidence: Joi.number().min(0).max(1).required(),
  requiredPatterns: Joi.array().items(Joi.string().valid(...patternTypes)).optional(),
  requiredIndicators: Joi.array().items(Joi.string()).optional(),
  minConfluence: Joi.number().min(0).max(1).required(),
  timeframes: Joi.array().items(Joi.string().valid('1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M')).optional()
});

// Analysis configuration validation
export const analysisConfigSchema = Joi.object({
  indicators: Joi.object({
    rsi: Joi.object({
      period: Joi.number().integer().min(2).max(100).required(),
      overbought: Joi.number().min(50).max(100).required(),
      oversold: Joi.number().min(0).max(50).required()
    }).required(),
    waveTrend: Joi.object({
      n1: Joi.number().integer().min(1).max(50).required(),
      n2: Joi.number().integer().min(1).max(50).required()
    }).required(),
    pvt: Joi.object({
      period: Joi.number().integer().min(1).max(100).required()
    }).required()
  }).required(),
  patterns: Joi.object({
    minBodySize: Joi.number().min(0).max(1).required(),
    minWickRatio: Joi.number().min(0).max(10).required(),
    lookbackPeriod: Joi.number().integer().min(5).max(100).required()
  }).required(),
  elliottWave: Joi.object({
    minWaveLength: Joi.number().min(0).required(),
    maxWaveLength: Joi.number().min(0).required(),
    fibonacciTolerance: Joi.number().min(0).max(1).required()
  }).required(),
  fibonacci: Joi.object({
    levels: Joi.array().items(Joi.number().positive()).required().min(1),
    confluenceDistance: Joi.number().min(0).required()
  }).required()
});

// Validation functions
export const validateTechnicalIndicators = (data: any) => {
  return technicalIndicatorsSchema.validate(data);
};

export const validateCandlestickPattern = (data: any) => {
  return candlestickPatternSchema.validate(data);
};

export const validateWaveStructure = (data: any) => {
  return waveStructureSchema.validate(data);
};

export const validateFibonacciLevels = (data: any) => {
  return fibonacciLevelsSchema.validate(data);
};

export const validateConfluenceZone = (data: any) => {
  return confluenceZoneSchema.validate(data);
};

export const validateMarketRegime = (data: any) => {
  return marketRegimeSchema.validate(data);
};

export const validateVolumeProfile = (data: any) => {
  return volumeProfileSchema.validate(data);
};

export const validateAnalysisResults = (data: any) => {
  return analysisResultsSchema.validate(data);
};

export const validateMultiTimeframeAnalysis = (data: any) => {
  return multiTimeframeAnalysisSchema.validate(data);
};

export const validateSignalFilter = (data: any) => {
  return signalFilterSchema.validate(data);
};

export const validateAnalysisConfig = (data: any) => {
  return analysisConfigSchema.validate(data);
};