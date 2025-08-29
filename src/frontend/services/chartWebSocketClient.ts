import { io, Socket } from 'socket.io-client';
import { store } from '../store/store';
import { 
  updateTicker, 
  updateCandles, 
  setConnectionStatus 
} from '../store/slices/marketDataSlice';

export interface ChartWebSocketClient {
  connect(): void;
  disconnect(): void;
  subscribeToSymbol(symbol: string): void;
  unsubscribeFromSymbol(symbol: string): void;
  requestCandles(symbol: string, timeframe: string, limit?: number): void;
  isConnected(): boolean;
}

export interface MarketDataUpdate {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
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

export interface CandleUpdate {
  symbol: string;
  timeframe: string;
  candles: CandleData[];
}

class ChartWebSocketClientImpl implements ChartWebSocketClient {
  private socket: Socket | null = null;
  private subscriptions: Set<string> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isManualDisconnect = false;

  constructor(private url: string = 'http://localhost:3001') {}

  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    this.isManualDisconnect = false;
    
    this.socket = io(this.url, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
    });

    this.setupEventHandlers();
  }

  disconnect(): void {
    this.isManualDisconnect = true;
    this.subscriptions.clear();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    store.dispatch(setConnectionStatus(false));
  }

  subscribeToSymbol(symbol: string): void {
    if (!this.socket?.connected) {
      console.warn('Cannot subscribe: WebSocket not connected');
      return;
    }

    this.subscriptions.add(symbol);
    this.socket.emit('subscribe', { symbols: [symbol] });
    
    console.log(`📊 Subscribed to ${symbol} market data`);
  }

  unsubscribeFromSymbol(symbol: string): void {
    if (!this.socket?.connected) {
      return;
    }

    this.subscriptions.delete(symbol);
    this.socket.emit('unsubscribe', { symbols: [symbol] });
    
    console.log(`📊 Unsubscribed from ${symbol} market data`);
  }

  requestCandles(symbol: string, timeframe: string, limit: number = 100): void {
    if (!this.socket?.connected) {
      console.warn('Cannot request candles: WebSocket not connected');
      return;
    }

    this.socket.emit('getCandles', {
      symbol,
      timeframe,
      limit
    });
    
    console.log(`📈 Requested ${limit} candles for ${symbol} ${timeframe}`);
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('📡 Chart WebSocket connected');
      this.reconnectAttempts = 0;
      store.dispatch(setConnectionStatus(true));
      
      // Resubscribe to all symbols
      if (this.subscriptions.size > 0) {
        this.socket?.emit('subscribe', { 
          symbols: Array.from(this.subscriptions) 
        });
      }
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('📡 Chart WebSocket disconnected:', reason);
      store.dispatch(setConnectionStatus(false));
      
      // Attempt to reconnect if not manual disconnect
      if (!this.isManualDisconnect && reason === 'io server disconnect') {
        this.handleReconnection();
      }
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('📡 Chart WebSocket connection error:', error);
      store.dispatch(setConnectionStatus(false));
      this.handleReconnection();
    });

    // Market data events
    this.socket.on('marketData', (data: any) => {
      this.handleMarketDataUpdate(data);
    });

    this.socket.on('ticker', (data: MarketDataUpdate) => {
      store.dispatch(updateTicker(data));
    });

    this.socket.on('priceUpdate', (data: MarketDataUpdate) => {
      store.dispatch(updateTicker(data));
    });

    this.socket.on('candles', (data: CandleUpdate) => {
      store.dispatch(updateCandles(data));
    });

    this.socket.on('candleUpdate', (data: CandleUpdate) => {
      store.dispatch(updateCandles(data));
    });

    // Subscription confirmations
    this.socket.on('subscribed', (data: { symbols: string[] }) => {
      console.log('📊 Subscription confirmed for:', data.symbols);
    });

    this.socket.on('unsubscribed', (data: { symbols: string[] }) => {
      console.log('📊 Unsubscription confirmed for:', data.symbols);
    });

    // Error handling
    this.socket.on('error', (error: any) => {
      console.error('📡 Chart WebSocket error:', error);
    });

    // Health check
    this.socket.on('ping', () => {
      this.socket?.emit('pong', { timestamp: Date.now() });
    });
  }

  private handleMarketDataUpdate(data: any): void {
    try {
      if (data.type === 'ticker' || data.type === 'marketData') {
        const tickerData: MarketDataUpdate = {
          symbol: data.symbol,
          price: data.data?.price || data.price,
          change24h: data.data?.change24h || data.change24h || 0,
          changePercent24h: data.data?.changePercent24h || data.changePercent24h || 0,
          volume24h: data.data?.volume24h || data.volume24h || 0,
          high24h: data.data?.high24h || data.high24h || 0,
          low24h: data.data?.low24h || data.low24h || 0,
          timestamp: data.timestamp || Date.now()
        };
        
        store.dispatch(updateTicker(tickerData));
      } else if (data.type === 'candles') {
        const candleData: CandleUpdate = {
          symbol: data.symbol,
          timeframe: data.timeframe,
          candles: data.data || data.candles
        };
        
        store.dispatch(updateCandles(candleData));
      }
    } catch (error) {
      console.error('Error processing market data update:', error);
    }
  }

  private handleReconnection(): void {
    if (this.isManualDisconnect || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    console.log(`📡 Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (!this.isManualDisconnect && !this.socket?.connected) {
        this.connect();
      }
    }, delay);
  }
}

// Singleton instance
let chartWebSocketClient: ChartWebSocketClient | null = null;

export const getChartWebSocketClient = (): ChartWebSocketClient => {
  if (!chartWebSocketClient) {
    const wsUrl = process.env.REACT_APP_WS_URL || 'http://localhost:3001';
    chartWebSocketClient = new ChartWebSocketClientImpl(wsUrl);
  }
  return chartWebSocketClient;
};

export const createChartWebSocketClient = (url?: string): ChartWebSocketClient => {
  return new ChartWebSocketClientImpl(url);
};

export default getChartWebSocketClient;