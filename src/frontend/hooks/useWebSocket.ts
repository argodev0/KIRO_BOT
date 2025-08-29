import React, { useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import {
  updateTicker,
  updateOrderBook,
  updateCandles,
  setConnectionStatus,
} from '../store/slices/marketDataSlice';
import {
  addSignal,
  updateSignal,
  addPosition,
  updatePosition,
  removePosition,
  addOrder,
  updateOrder,
  updatePortfolio,
  setBotStatus,
  setError,
} from '../store/slices/tradingSlice';

interface UseWebSocketOptions {
  url?: string;
  autoConnect?: boolean;
}

interface WebSocketHook {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, data?: any) => void;
}

export const useWebSocket = (isAuthenticated: boolean, options: UseWebSocketOptions = {}): WebSocketHook => {
  const { url = 'http://localhost:3001', autoConnect = true } = options;
  const dispatch = useDispatch();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    const socket = io(url, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      maxReconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      dispatch(setConnectionStatus(true));
    });

    socket.on('disconnect', (reason: string) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
      dispatch(setConnectionStatus(false));
      
      // Attempt to reconnect if disconnected unexpectedly
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    });

    socket.on('connect_error', (error: Error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
      dispatch(setConnectionStatus(false));
    });

    // Market data events
    socket.on('ticker', (data: any) => {
      dispatch(updateTicker(data));
    });

    socket.on('marketData', (data: any) => {
      // Handle real-time market data updates
      if (data.type === 'ticker') {
        dispatch(updateTicker(data.data));
      } else if (data.type === 'candles') {
        dispatch(updateCandles({
          symbol: data.symbol,
          timeframe: data.timeframe,
          candles: data.data
        }));
      }
    });

    socket.on('orderbook', (data: any) => {
      dispatch(updateOrderBook(data));
    });

    socket.on('candles', (data: any) => {
      dispatch(updateCandles(data));
    });

    // Handle real-time price updates
    socket.on('priceUpdate', (data: any) => {
      dispatch(updateTicker({
        symbol: data.symbol,
        price: data.price,
        change24h: data.change24h || 0,
        changePercent24h: data.changePercent24h || 0,
        volume24h: data.volume24h || 0,
        high24h: data.high24h || data.price,
        low24h: data.low24h || data.price,
        timestamp: data.timestamp || Date.now()
      }));
    });

    // Handle candle updates for real-time charts
    socket.on('candleUpdate', (data: any) => {
      dispatch(updateCandles({
        symbol: data.symbol,
        timeframe: data.timeframe,
        candles: data.candles
      }));
    });

    // Trading events
    socket.on('signal', (data: any) => {
      dispatch(addSignal(data));
    });

    socket.on('signal_update', (data: any) => {
      dispatch(updateSignal(data));
    });

    socket.on('position', (data: any) => {
      dispatch(addPosition(data));
    });

    socket.on('position_update', (data: any) => {
      dispatch(updatePosition(data));
    });

    socket.on('position_closed', (data: any) => {
      dispatch(removePosition(data.id));
    });

    socket.on('order', (data: any) => {
      dispatch(addOrder(data));
    });

    socket.on('order_update', (data: any) => {
      dispatch(updateOrder(data));
    });

    // Portfolio updates
    socket.on('portfolio_update', (data: any) => {
      dispatch(updatePortfolio(data));
    });

    socket.on('bot_status', (data: any) => {
      dispatch(setBotStatus(data.status));
    });

    socket.on('error', (data: any) => {
      dispatch(setError(data.message));
      console.error('WebSocket error:', data);
    });

    // Risk management alerts
    socket.on('risk_alert', (data: any) => {
      console.warn('Risk alert:', data);
    });

  }, [url, dispatch]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      dispatch(setConnectionStatus(false));
    }
  }, [dispatch]);

  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  useEffect(() => {
    if (autoConnect && isAuthenticated) {
      connect();
    } else if (!isAuthenticated) {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [connect, disconnect, autoConnect, isAuthenticated]);

  return {
    isConnected,
    connect,
    disconnect,
    emit,
  };
};

export default useWebSocket;