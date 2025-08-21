/**
 * Market Data Types and Interfaces
 * Core data structures for market data, order books, and trading information
 */

// Base market data interfaces
export interface CandleData {
  symbol: string;
  timeframe: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  exchange?: string;
}

export interface TickerData {
  symbol: string;
  exchange: string;
  price: number;
  volume: number;
  timestamp: number;
  bid: number;
  ask: number;
  change24h?: number;
  changePercent24h?: number;
}

export interface OrderBookData {
  symbol: string;
  exchange: string;
  timestamp: number;
  bids: [number, number][]; // [price, quantity]
  asks: [number, number][];
}

export interface TradeData {
  symbol: string;
  exchange: string;
  timestamp: number;
  price: number;
  quantity: number;
  side: 'buy' | 'sell';
  tradeId: string;
}

// Market analysis types
export interface MarketContext {
  symbol: string;
  timeframe: string;
  trend: 'bullish' | 'bearish' | 'sideways';
  volatility: 'low' | 'medium' | 'high';
  volume: 'low' | 'medium' | 'high';
  marketRegime: 'trending' | 'ranging';
}

export interface SupportResistanceLevel {
  price: number;
  strength: number;
  type: 'support' | 'resistance';
  touches: number;
  lastTouch: number;
}

// Timeframe definitions
export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1M';

export interface TimeframeData {
  timeframe: Timeframe;
  candles: CandleData[];
  lastUpdate: number;
}

// Exchange-related types
export interface ExchangeInfo {
  name: string;
  status: 'online' | 'offline' | 'maintenance';
  rateLimits: {
    requests: number;
    interval: number;
  };
  symbols: string[];
  fees: {
    maker: number;
    taker: number;
  };
}

export interface MarketDataSubscription {
  symbol: string;
  exchange: string;
  type: 'ticker' | 'orderbook' | 'trades' | 'candles';
  timeframe?: Timeframe;
  callback: (data: any) => void;
}