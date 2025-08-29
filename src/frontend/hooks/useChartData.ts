import { useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import { 
  setSelectedSymbol, 
  setSelectedTimeframe,
  updateTicker,
  updateCandles 
} from '../store/slices/marketDataSlice';
import { getChartWebSocketClient } from '../services/chartWebSocketClient';

export interface UseChartDataOptions {
  symbol?: string;
  timeframe?: string;
  autoSubscribe?: boolean;
  enableRealTimeUpdates?: boolean;
}

export interface UseChartDataReturn {
  // Data
  currentSymbol: string;
  currentTimeframe: string;
  candles: any[];
  ticker: any;
  isConnected: boolean;
  lastUpdate: number;
  
  // Actions
  setSymbol: (symbol: string) => void;
  setTimeframe: (timeframe: string) => void;
  subscribeToSymbol: (symbol: string) => void;
  unsubscribeFromSymbol: (symbol: string) => void;
  requestCandles: (symbol?: string, timeframe?: string, limit?: number) => void;
  refreshData: () => void;
  
  // Connection management
  connect: () => void;
  disconnect: () => void;
}

export const useChartData = (options: UseChartDataOptions = {}): UseChartDataReturn => {
  const {
    symbol: propSymbol,
    timeframe: propTimeframe,
    autoSubscribe = true,
    enableRealTimeUpdates = true
  } = options;

  const dispatch = useDispatch();
  const wsClient = useRef(getChartWebSocketClient());
  const subscriptionsRef = useRef<Set<string>>(new Set());

  const {
    selectedSymbol,
    selectedTimeframe,
    candles,
    tickers,
    isConnected,
    lastUpdate
  } = useSelector((state: RootState) => state.marketData);

  // Use prop values or store values
  const currentSymbol = propSymbol || selectedSymbol;
  const currentTimeframe = propTimeframe || selectedTimeframe;
  const candleKey = `${currentSymbol}_${currentTimeframe}`;
  const currentCandles = candles[candleKey] || [];
  const currentTicker = tickers[currentSymbol];

  // Connect to WebSocket on mount
  useEffect(() => {
    if (enableRealTimeUpdates) {
      wsClient.current.connect();
    }

    return () => {
      // Clean up subscriptions on unmount
      subscriptionsRef.current.forEach(symbol => {
        wsClient.current.unsubscribeFromSymbol(symbol);
      });
      subscriptionsRef.current.clear();
    };
  }, [enableRealTimeUpdates]);

  // Auto-subscribe to symbol when it changes
  useEffect(() => {
    if (autoSubscribe && enableRealTimeUpdates && currentSymbol) {
      subscribeToSymbol(currentSymbol);
      requestCandles(currentSymbol, currentTimeframe);
    }

    return () => {
      if (currentSymbol && subscriptionsRef.current.has(currentSymbol)) {
        unsubscribeFromSymbol(currentSymbol);
      }
    };
  }, [currentSymbol, currentTimeframe, autoSubscribe, enableRealTimeUpdates]);

  // Actions
  const setSymbol = useCallback((symbol: string) => {
    if (!propSymbol) {
      dispatch(setSelectedSymbol(symbol));
    }
  }, [dispatch, propSymbol]);

  const setTimeframe = useCallback((timeframe: string) => {
    if (!propTimeframe) {
      dispatch(setSelectedTimeframe(timeframe));
    }
  }, [dispatch, propTimeframe]);

  const subscribeToSymbol = useCallback((symbol: string) => {
    if (!subscriptionsRef.current.has(symbol)) {
      wsClient.current.subscribeToSymbol(symbol);
      subscriptionsRef.current.add(symbol);
    }
  }, []);

  const unsubscribeFromSymbol = useCallback((symbol: string) => {
    if (subscriptionsRef.current.has(symbol)) {
      wsClient.current.unsubscribeFromSymbol(symbol);
      subscriptionsRef.current.delete(symbol);
    }
  }, []);

  const requestCandles = useCallback((
    symbol: string = currentSymbol,
    timeframe: string = currentTimeframe,
    limit: number = 100
  ) => {
    wsClient.current.requestCandles(symbol, timeframe, limit);
  }, [currentSymbol, currentTimeframe]);

  const refreshData = useCallback(() => {
    // Refresh current symbol data
    if (currentSymbol) {
      requestCandles(currentSymbol, currentTimeframe);
      
      // Re-subscribe to ensure fresh data
      unsubscribeFromSymbol(currentSymbol);
      setTimeout(() => {
        subscribeToSymbol(currentSymbol);
      }, 100);
    }
  }, [currentSymbol, currentTimeframe, requestCandles, subscribeToSymbol, unsubscribeFromSymbol]);

  const connect = useCallback(() => {
    wsClient.current.connect();
  }, []);

  const disconnect = useCallback(() => {
    wsClient.current.disconnect();
    subscriptionsRef.current.clear();
  }, []);

  return {
    // Data
    currentSymbol,
    currentTimeframe,
    candles: currentCandles,
    ticker: currentTicker,
    isConnected,
    lastUpdate,
    
    // Actions
    setSymbol,
    setTimeframe,
    subscribeToSymbol,
    unsubscribeFromSymbol,
    requestCandles,
    refreshData,
    
    // Connection management
    connect,
    disconnect
  };
};

export default useChartData;