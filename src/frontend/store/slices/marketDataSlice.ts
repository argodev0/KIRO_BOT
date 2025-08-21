import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface TickerData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  timestamp: number;
}

export interface OrderBookData {
  symbol: string;
  bids: [number, number][];
  asks: [number, number][];
  timestamp: number;
}

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketDataState {
  tickers: Record<string, TickerData>;
  orderBooks: Record<string, OrderBookData>;
  candles: Record<string, CandleData[]>;
  selectedSymbol: string;
  selectedTimeframe: string;
  isConnected: boolean;
  lastUpdate: number;
}

const initialState: MarketDataState = {
  tickers: {},
  orderBooks: {},
  candles: {},
  selectedSymbol: 'BTCUSDT',
  selectedTimeframe: '1h',
  isConnected: false,
  lastUpdate: 0,
};

const marketDataSlice = createSlice({
  name: 'marketData',
  initialState,
  reducers: {
    updateTicker: (state, action: PayloadAction<TickerData>) => {
      state.tickers[action.payload.symbol] = action.payload;
      state.lastUpdate = Date.now();
    },
    updateOrderBook: (state, action: PayloadAction<OrderBookData>) => {
      state.orderBooks[action.payload.symbol] = action.payload;
      state.lastUpdate = Date.now();
    },
    updateCandles: (state, action: PayloadAction<{ symbol: string; timeframe: string; candles: CandleData[] }>) => {
      const key = `${action.payload.symbol}_${action.payload.timeframe}`;
      state.candles[key] = action.payload.candles;
      state.lastUpdate = Date.now();
    },
    setSelectedSymbol: (state, action: PayloadAction<string>) => {
      state.selectedSymbol = action.payload;
    },
    setSelectedTimeframe: (state, action: PayloadAction<string>) => {
      state.selectedTimeframe = action.payload;
    },
    setConnectionStatus: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
    },
    clearMarketData: (state) => {
      state.tickers = {};
      state.orderBooks = {};
      state.candles = {};
      state.isConnected = false;
    },
  },
});

export const {
  updateTicker,
  updateOrderBook,
  updateCandles,
  setSelectedSymbol,
  setSelectedTimeframe,
  setConnectionStatus,
  clearMarketData,
} = marketDataSlice.actions;

export default marketDataSlice.reducer;