/**
 * Trading Types and Interfaces
 * Core data structures for trading signals, orders, and positions
 */

// Trading signal types
export interface TradingSignal {
  id?: string;
  symbol: string;
  direction: 'long' | 'short';
  confidence: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit: number[];
  reasoning: SignalReasoning;
  timestamp: number;
  status?: SignalStatus;
  
  // Analysis scores
  technicalScore?: number;
  patternScore?: number;
  elliottWaveScore?: number;
  fibonacciScore?: number;
  volumeScore?: number;
}

export interface SignalReasoning {
  technical: {
    indicators: string[];
    confluence: number;
    trend: string;
  };
  patterns: {
    detected: string[];
    strength: number;
  };
  elliottWave: {
    currentWave: string;
    wavePosition: string;
    validity: number;
  };
  fibonacci: {
    levels: number[];
    confluence: number;
  };
  volume: {
    profile: string;
    strength: number;
  };
  summary: string;
}

export type SignalStatus = 'pending' | 'active' | 'executed' | 'cancelled' | 'expired' | 'closed';

// Order types
export interface OrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  exchange: string;
  clientOrderId?: string;
}

export interface OrderResponse {
  orderId: string;
  clientOrderId?: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: string;
  quantity: number;
  price?: number;
  status: OrderStatus;
  timestamp: number;
  exchange: string;
}

export type OrderStatus = 'new' | 'partially_filled' | 'filled' | 'cancelled' | 'rejected' | 'expired';

export interface OrderUpdate {
  orderId: string;
  status: OrderStatus;
  filledQuantity: number;
  remainingQuantity: number;
  averagePrice?: number;
  fee?: number;
  timestamp: number;
}

// Position types
export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  realizedPnl?: number;
  stopLoss?: number;
  takeProfit?: number[];
  timestamp: number;
  exchange: string;
}

export interface Portfolio {
  totalBalance: number;
  availableBalance: number;
  positions: Position[];
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  maxDrawdown: number;
  currentDrawdown: number;
  equity: number;
  margin?: number;
  freeMargin?: number;
}

// Trade execution types
export interface TradeExecution {
  id: string;
  signalId?: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  fee?: number;
  exchange: string;
  orderId?: string;
  realizedPnl?: number;
  executedAt: number;
}

export interface ExecutionResult {
  success: boolean;
  orderId?: string;
  executedQuantity: number;
  averagePrice?: number;
  fee?: number;
  error?: string;
  timestamp: number;
}

// Risk management types
export interface RiskParameters {
  maxRiskPerTrade: number; // Percentage of account balance
  maxDailyLoss: number; // Percentage of account balance
  maxTotalExposure: number; // Multiple of account balance
  maxDrawdown: number; // Percentage
  stopLossRequired: boolean;
  maxLeverage: number;
}

export interface RiskValidation {
  isValid: boolean;
  violations: RiskViolation[];
  maxAllowedSize: number;
  riskPercentage: number;
  currentExposure: number;
}

export interface RiskViolation {
  type: 'max_risk_per_trade' | 'max_daily_loss' | 'max_exposure' | 'max_drawdown' | 'missing_stop_loss';
  message: string;
  currentValue: number;
  maxAllowed: number;
}

export interface DrawdownStatus {
  current: number;
  maximum: number;
  isViolation: boolean;
  actionRequired: 'none' | 'reduce_positions' | 'emergency_close';
}