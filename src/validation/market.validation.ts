/**
 * Market Data Validation Schemas
 * Joi validation schemas for market data structures
 */

import Joi from 'joi';

// Base validation schemas
export const candleDataSchema = Joi.object({
  symbol: Joi.string().required().min(3).max(20),
  timeframe: Joi.string().required().valid('1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'),
  timestamp: Joi.number().integer().positive().required(),
  open: Joi.number().positive().required(),
  high: Joi.number().positive().required(),
  low: Joi.number().positive().required(),
  close: Joi.number().positive().required(),
  volume: Joi.number().min(0).required()
}).custom((value, helpers) => {
  // Validate OHLC relationships
  if (value.high < Math.max(value.open, value.close)) {
    return helpers.error('any.custom', { message: 'High must be >= max(open, close)' });
  }
  if (value.low > Math.min(value.open, value.close)) {
    return helpers.error('any.custom', { message: 'Low must be <= min(open, close)' });
  }
  return value;
}, 'OHLC validation');

export const tickerDataSchema = Joi.object({
  symbol: Joi.string().required().min(3).max(20),
  exchange: Joi.string().required().min(2).max(50),
  price: Joi.number().positive().required(),
  volume: Joi.number().min(0).required(),
  timestamp: Joi.number().integer().positive().required(),
  bid: Joi.number().positive().required(),
  ask: Joi.number().positive().required(),
  change24h: Joi.number().optional(),
  changePercent24h: Joi.number().optional()
}).custom((value, helpers) => {
  // Validate bid/ask spread
  if (value.bid >= value.ask) {
    return helpers.error('any.custom', { message: 'Bid must be less than ask' });
  }
  return value;
}, 'Bid/Ask validation');

export const orderBookDataSchema = Joi.object({
  symbol: Joi.string().required().min(3).max(20),
  exchange: Joi.string().required().min(2).max(50),
  timestamp: Joi.number().integer().positive().required(),
  bids: Joi.array().items(
    Joi.array().ordered(
      Joi.number().positive().required(), // price
      Joi.number().min(0).required()      // quantity
    ).length(2)
  ).required().min(1),
  asks: Joi.array().items(
    Joi.array().ordered(
      Joi.number().positive().required(), // price
      Joi.number().min(0).required()      // quantity
    ).length(2)
  ).required().min(1)
}).custom((value, helpers) => {
  // Validate bid/ask order
  const highestBid = Math.max(...value.bids.map((bid: [number, number]) => bid[0]));
  const lowestAsk = Math.min(...value.asks.map((ask: [number, number]) => ask[0]));
  
  if (highestBid >= lowestAsk) {
    return helpers.error('any.custom', { message: 'Highest bid must be less than lowest ask' });
  }
  
  return value;
}, 'Order book validation');

export const tradeDataSchema = Joi.object({
  symbol: Joi.string().required().min(3).max(20),
  exchange: Joi.string().required().min(2).max(50),
  timestamp: Joi.number().integer().positive().required(),
  price: Joi.number().positive().required(),
  quantity: Joi.number().positive().required(),
  side: Joi.string().required().valid('buy', 'sell'),
  tradeId: Joi.string().required().min(1).max(100)
});

export const marketContextSchema = Joi.object({
  symbol: Joi.string().required().min(3).max(20),
  timeframe: Joi.string().required().valid('1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'),
  trend: Joi.string().required().valid('bullish', 'bearish', 'sideways'),
  volatility: Joi.string().required().valid('low', 'medium', 'high'),
  volume: Joi.string().required().valid('low', 'medium', 'high'),
  marketRegime: Joi.string().required().valid('trending', 'ranging')
});

export const supportResistanceLevelSchema = Joi.object({
  price: Joi.number().positive().required(),
  strength: Joi.number().min(0).max(1).required(),
  type: Joi.string().required().valid('support', 'resistance'),
  touches: Joi.number().integer().min(1).required(),
  lastTouch: Joi.number().integer().positive().required()
});

export const exchangeInfoSchema = Joi.object({
  name: Joi.string().required().min(2).max(50),
  status: Joi.string().required().valid('online', 'offline', 'maintenance'),
  rateLimits: Joi.object({
    requests: Joi.number().integer().positive().required(),
    interval: Joi.number().integer().positive().required()
  }).required(),
  symbols: Joi.array().items(Joi.string().min(3).max(20)).required(),
  fees: Joi.object({
    maker: Joi.number().min(0).max(1).required(),
    taker: Joi.number().min(0).max(1).required()
  }).required()
});

export const marketDataSubscriptionSchema = Joi.object({
  symbol: Joi.string().required().min(3).max(20),
  exchange: Joi.string().required().min(2).max(50),
  type: Joi.string().required().valid('ticker', 'orderbook', 'trades', 'candles'),
  timeframe: Joi.string().optional().valid('1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'),
  callback: Joi.function().required()
});

// Validation functions
export const validateCandleData = (data: any) => {
  return candleDataSchema.validate(data);
};

export const validateTickerData = (data: any) => {
  return tickerDataSchema.validate(data);
};

export const validateOrderBookData = (data: any) => {
  return orderBookDataSchema.validate(data);
};

export const validateTradeData = (data: any) => {
  return tradeDataSchema.validate(data);
};

export const validateMarketContext = (data: any) => {
  return marketContextSchema.validate(data);
};

export const validateSupportResistanceLevel = (data: any) => {
  return supportResistanceLevelSchema.validate(data);
};

export const validateExchangeInfo = (data: any) => {
  return exchangeInfoSchema.validate(data);
};

export const validateMarketDataSubscription = (data: any) => {
  return marketDataSubscriptionSchema.validate(data);
};