/**
 * Virtual Portfolio Hook
 * Manages virtual portfolio data and real-time updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { updatePortfolio, updatePaperTradingStats, addPosition, updatePosition, removePosition } from '../store/slices/tradingSlice';

export interface VirtualPortfolioData {
  userId: string;
  totalBalance: number;
  availableBalance: number;
  lockedBalance: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  equity: number;
  positions: VirtualPosition[];
  tradeHistory: SimulatedTrade[];
  performance: PerformanceMetrics;
  isPaperPortfolio: true;
}

export interface VirtualPosition {
  id: string;
  userId: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  stopLoss?: number;
  takeProfit?: number[];
  createdAt: Date;
  updatedAt: Date;
  isPaperPosition: true;
}

export interface SimulatedTrade {
  id: string;
  userId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  fee: number;
  slippage: number;
  executedAt: Date;
  isPaperTrade: true;
  orderId?: string;
  signalId?: string;
}

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  currentDrawdown: number;
  sharpeRatio: number;
  totalReturn: number;
  totalReturnPercent: number;
}

export interface PortfolioWebSocketMessage {
  type: 'INITIAL_PORTFOLIO_DATA' | 'PORTFOLIO_UPDATE' | 'POSITIONS_UPDATE' | 'TRADE_EXECUTED' | 'BALANCE_UPDATE' | 'POSITION_UPDATE';
  data: any;
  timestamp: number;
}

export interface UseVirtualPortfolioReturn {
  portfolio: VirtualPortfolioData | null;
  positions: VirtualPosition[];
  tradeHistory: SimulatedTrade[];
  performance: PerformanceMetrics | null;
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  refreshPortfolio: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  refreshPerformance: () => Promise<void>;
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
}

export const useVirtualPortfolio = (): UseVirtualPortfolioReturn => {
  const [portfolio, setPortfolio] = useState<VirtualPortfolioData | null>(null);
  const [positions, setPositions] = useState<VirtualPosition[]>([]);
  const [tradeHistory, setTradeHistory] = useState<SimulatedTrade[]>([]);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dispatch = useDispatch();

  /**
   * Fetch portfolio data from API
   */
  const refreshPortfolio = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/v1/trading/portfolio', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch portfolio: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        setPortfolio(result.data);
        
        // Update Redux store
        dispatch(updatePortfolio({
          totalBalance: result.data.totalBalance,
          availableBalance: result.data.availableBalance,
          totalUnrealizedPnl: result.data.totalUnrealizedPnl,
          totalRealizedPnl: result.data.totalRealizedPnl
        }));

        dispatch(updatePaperTradingStats({
          virtualBalance: result.data.totalBalance,
          totalPaperTrades: result.data.performance?.totalTrades || 0
        }));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch portfolio';
      setError(errorMessage);
      console.error('Portfolio fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  /**
   * Fetch trading history from API
   */
  const refreshHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/v1/trading/portfolio/history?limit=100', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch trading history: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        setTradeHistory(result.data);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch trading history';
      setError(errorMessage);
      console.error('Trading history fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Fetch performance metrics from API
   */
  const refreshPerformance = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/v1/trading/portfolio/performance', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch performance metrics: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        setPerformance(result.data.performance);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch performance metrics';
      setError(errorMessage);
      console.error('Performance fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Fetch positions from API
   */
  const refreshPositions = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/trading/portfolio/positions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch positions: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        setPositions(result.data);
        
        // Update Redux store positions
        result.data.forEach((position: VirtualPosition) => {
          dispatch(updatePosition({
            id: position.id,
            symbol: position.symbol,
            side: position.side,
            size: position.size,
            entryPrice: position.entryPrice,
            currentPrice: position.currentPrice,
            unrealizedPnl: position.unrealizedPnl
          }));
        });
      }
    } catch (err) {
      console.error('Positions fetch error:', err);
    }
  }, [dispatch]);

  /**
   * Handle WebSocket messages
   */
  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    try {
      const message: PortfolioWebSocketMessage = JSON.parse(event.data);
      
      switch (message.type) {
        case 'INITIAL_PORTFOLIO_DATA':
          setPortfolio(message.data);
          setPositions(message.data.positions || []);
          setTradeHistory(message.data.tradeHistory || []);
          setPerformance(message.data.performance || null);
          break;

        case 'PORTFOLIO_UPDATE':
          setPortfolio(prev => prev ? { ...prev, ...message.data } : null);
          
          // Update Redux store
          dispatch(updatePortfolio({
            totalBalance: message.data.totalBalance,
            availableBalance: message.data.availableBalance,
            totalUnrealizedPnl: message.data.totalUnrealizedPnl,
            totalRealizedPnl: message.data.totalRealizedPnl
          }));
          break;

        case 'POSITIONS_UPDATE':
          setPositions(message.data);
          
          // Update Redux store positions
          message.data.forEach((position: VirtualPosition) => {
            dispatch(updatePosition({
              id: position.id,
              symbol: position.symbol,
              side: position.side,
              size: position.size,
              entryPrice: position.entryPrice,
              currentPrice: position.currentPrice,
              unrealizedPnl: position.unrealizedPnl
            }));
          });
          break;

        case 'TRADE_EXECUTED':
          setTradeHistory(prev => [message.data, ...prev.slice(0, 99)]);
          
          // Refresh portfolio and positions after trade
          setTimeout(() => {
            refreshPortfolio();
            refreshPositions();
          }, 500);
          break;

        case 'BALANCE_UPDATE':
          if (message.data.balance) {
            setPortfolio(prev => prev ? {
              ...prev,
              totalBalance: message.data.balance.totalBalance,
              availableBalance: message.data.balance.availableBalance,
              lockedBalance: message.data.balance.lockedBalance
            } : null);
          }
          break;

        case 'POSITION_UPDATE':
          if (message.data.position) {
            setPositions(prev => {
              const existingIndex = prev.findIndex(p => p.id === message.data.position.id);
              if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = message.data.position;
                return updated;
              } else {
                return [...prev, message.data.position];
              }
            });
          }
          break;

        default:
          console.log('Unknown WebSocket message type:', message.type);
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  }, [dispatch, refreshPortfolio, refreshPositions]);

  /**
   * Connect to WebSocket
   */
  const connectWebSocket = useCallback(() => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No auth token available for WebSocket connection');
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/portfolio?token=${token}`;
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('Virtual portfolio WebSocket connected');
        setIsConnected(true);
        setError(null);

        // Subscribe to portfolio updates
        wsRef.current?.send(JSON.stringify({
          type: 'SUBSCRIBE',
          channels: ['portfolio', 'positions', 'trades']
        }));

        // Request initial data
        wsRef.current?.send(JSON.stringify({
          type: 'REQUEST_PORTFOLIO'
        }));
      };

      wsRef.current.onmessage = handleWebSocketMessage;

      wsRef.current.onclose = (event) => {
        console.log('Virtual portfolio WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);

        // Attempt to reconnect after 3 seconds
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };

      wsRef.current.onerror = (error) => {
        console.error('Virtual portfolio WebSocket error:', error);
        setError('WebSocket connection error');
        setIsConnected(false);
      };

    } catch (err) {
      console.error('Failed to connect WebSocket:', err);
      setError('Failed to establish WebSocket connection');
    }
  }, [handleWebSocketMessage]);

  /**
   * Disconnect WebSocket
   */
  const disconnectWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  /**
   * Initialize data on mount
   */
  useEffect(() => {
    refreshPortfolio();
    refreshHistory();
    refreshPerformance();
    refreshPositions();
    connectWebSocket();

    return () => {
      disconnectWebSocket();
    };
  }, [refreshPortfolio, refreshHistory, refreshPerformance, refreshPositions, connectWebSocket, disconnectWebSocket]);

  /**
   * Periodic refresh when not connected to WebSocket
   */
  useEffect(() => {
    if (!isConnected) {
      const interval = setInterval(() => {
        refreshPortfolio();
        refreshPositions();
      }, 10000); // Refresh every 10 seconds when not connected

      return () => clearInterval(interval);
    }
  }, [isConnected, refreshPortfolio, refreshPositions]);

  return {
    portfolio,
    positions,
    tradeHistory,
    performance,
    isLoading,
    error,
    isConnected,
    refreshPortfolio,
    refreshHistory,
    refreshPerformance,
    connectWebSocket,
    disconnectWebSocket
  };
};