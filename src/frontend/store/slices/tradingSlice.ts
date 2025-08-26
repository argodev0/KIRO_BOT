import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface TradingSignal {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number[];
  reasoning: {
    technical: string;
    patterns: string;
    elliottWave: string;
    fibonacci: string;
  };
  status: 'pending' | 'active' | 'filled' | 'cancelled';
  timestamp: number;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  stopLoss?: number;
  takeProfit?: number[];
  timestamp: number;
}

export interface Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop';
  quantity: number;
  price?: number;
  stopPrice?: number;
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
  timestamp: number;
}

export interface TradingState {
  signals: TradingSignal[];
  positions: Position[];
  orders: Order[];
  portfolio: {
    totalBalance: number;
    availableBalance: number;
    totalUnrealizedPnl: number;
    totalRealizedPnl: number;
    maxDrawdown: number;
    currentDrawdown: number;
  };
  paperTrading: {
    isEnabled: boolean;
    initialBalance: number;
    virtualBalance: number;
    totalPaperTrades: number;
    paperTradingStartDate: number;
  };
  botStatus: 'stopped' | 'running' | 'paused';
  isLoading: boolean;
  error: string | null;
}

const initialState: TradingState = {
  signals: [],
  positions: [],
  orders: [],
  portfolio: {
    totalBalance: 10000, // Default virtual balance
    availableBalance: 10000,
    totalUnrealizedPnl: 0,
    totalRealizedPnl: 0,
    maxDrawdown: 0,
    currentDrawdown: 0,
  },
  paperTrading: {
    isEnabled: true, // Always enabled in this deployment
    initialBalance: 10000,
    virtualBalance: 10000,
    totalPaperTrades: 0,
    paperTradingStartDate: Date.now(),
  },
  botStatus: 'stopped',
  isLoading: false,
  error: null,
};

const tradingSlice = createSlice({
  name: 'trading',
  initialState,
  reducers: {
    addSignal: (state, action: PayloadAction<TradingSignal>) => {
      state.signals.unshift(action.payload);
      // Keep only last 100 signals
      if (state.signals.length > 100) {
        state.signals = state.signals.slice(0, 100);
      }
    },
    updateSignal: (state, action: PayloadAction<Partial<TradingSignal> & { id: string }>) => {
      const index = state.signals.findIndex(signal => signal.id === action.payload.id);
      if (index !== -1) {
        state.signals[index] = { ...state.signals[index], ...action.payload };
      }
    },
    addPosition: (state, action: PayloadAction<Position>) => {
      state.positions.push(action.payload);
    },
    updatePosition: (state, action: PayloadAction<Partial<Position> & { id: string }>) => {
      const index = state.positions.findIndex(position => position.id === action.payload.id);
      if (index !== -1) {
        state.positions[index] = { ...state.positions[index], ...action.payload };
      }
    },
    removePosition: (state, action: PayloadAction<string>) => {
      state.positions = state.positions.filter(position => position.id !== action.payload);
    },
    addOrder: (state, action: PayloadAction<Order>) => {
      state.orders.unshift(action.payload);
      // Keep only last 200 orders
      if (state.orders.length > 200) {
        state.orders = state.orders.slice(0, 200);
      }
    },
    updateOrder: (state, action: PayloadAction<Partial<Order> & { id: string }>) => {
      const index = state.orders.findIndex(order => order.id === action.payload.id);
      if (index !== -1) {
        state.orders[index] = { ...state.orders[index], ...action.payload };
      }
    },
    updatePortfolio: (state, action: PayloadAction<Partial<TradingState['portfolio']>>) => {
      state.portfolio = { ...state.portfolio, ...action.payload };
    },
    updatePaperTradingStats: (state, action: PayloadAction<Partial<TradingState['paperTrading']>>) => {
      state.paperTrading = { ...state.paperTrading, ...action.payload };
    },
    incrementPaperTradeCount: (state) => {
      state.paperTrading.totalPaperTrades += 1;
    },
    setBotStatus: (state, action: PayloadAction<TradingState['botStatus']>) => {
      state.botStatus = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearTradingData: (state) => {
      state.signals = [];
      state.positions = [];
      state.orders = [];
      state.portfolio = initialState.portfolio;
      state.botStatus = 'stopped';
    },
  },
});

export const {
  addSignal,
  updateSignal,
  addPosition,
  updatePosition,
  removePosition,
  addOrder,
  updateOrder,
  updatePortfolio,
  updatePaperTradingStats,
  incrementPaperTradeCount,
  setBotStatus,
  setLoading,
  setError,
  clearTradingData,
} = tradingSlice.actions;

export default tradingSlice.reducer;