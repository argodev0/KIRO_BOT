/**
 * Base Exchange Interface
 * Abstract base class for all exchange implementations
 */

import { EventEmitter } from 'events';
import { CandleData, TickerData, OrderBookData, TradeData } from '../../types/market';
import { OrderRequest, OrderResponse, Position } from '../../types/trading';

export interface ExchangeConfig {
  apiKey: string;
  apiSecret: string;
  sandbox?: boolean;
  testnet?: boolean;
  rateLimits?: {
    requests: number;
    interval: number;
  };
}

export interface ExchangeInfo {
  name: string;
  status: 'online' | 'offline' | 'maintenance';
  symbols: string[];
  fees: {
    maker: number;
    taker: number;
  };
  rateLimits: {
    requests: number;
    interval: number;
  };
}

export abstract class BaseExchange extends EventEmitter {
  protected config: ExchangeConfig;
  protected connected: boolean = false;
  protected rateLimitCounter: number = 0;
  protected rateLimitResetTime: number = 0;

  constructor(config: ExchangeConfig) {
    super();
    this.config = config;
  }

  // Abstract methods that must be implemented by each exchange
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract getExchangeInfo(): Promise<ExchangeInfo>;
  abstract getSymbols(): Promise<string[]>;
  
  // Market data methods
  abstract getTicker(symbol: string): Promise<TickerData>;
  abstract getOrderBook(symbol: string, limit?: number): Promise<OrderBookData>;
  abstract getCandles(
    symbol: string,
    timeframe: string,
    limit?: number,
    startTime?: number,
    endTime?: number
  ): Promise<CandleData[]>;
  abstract getRecentTrades(symbol: string, limit?: number): Promise<TradeData[]>;

  // WebSocket subscriptions
  abstract subscribeToTicker(symbol: string): Promise<void>;
  abstract subscribeToOrderBook(symbol: string): Promise<void>;
  abstract subscribeToTrades(symbol: string): Promise<void>;
  abstract subscribeToCandles(symbol: string, timeframe: string): Promise<void>;
  abstract unsubscribeFromTicker(symbol: string): Promise<void>;
  abstract unsubscribeFromOrderBook(symbol: string): Promise<void>;
  abstract unsubscribeFromTrades(symbol: string): Promise<void>;
  abstract unsubscribeFromCandles(symbol: string, timeframe: string): Promise<void>;

  // Trading methods
  abstract placeOrder(order: OrderRequest): Promise<OrderResponse>;
  abstract cancelOrder(orderId: string, symbol: string): Promise<boolean>;
  abstract getOrder(orderId: string, symbol: string): Promise<OrderResponse>;
  abstract getOpenOrders(symbol?: string): Promise<OrderResponse[]>;
  abstract getOrderHistory(symbol?: string, limit?: number): Promise<OrderResponse[]>;

  // Account methods
  abstract getBalance(): Promise<Record<string, number>>;
  abstract getPositions(): Promise<Position[]>;

  // Enhanced rate limiting with exponential backoff
  protected async checkRateLimit(): Promise<void> {
    const now = Date.now();
    
    if (now > this.rateLimitResetTime) {
      this.rateLimitCounter = 0;
      this.rateLimitResetTime = now + (this.config.rateLimits?.interval || 60000);
    }

    if (this.rateLimitCounter >= (this.config.rateLimits?.requests || 1200)) {
      const waitTime = this.rateLimitResetTime - now;
      this.emit('rateLimitHit', { waitTime, resetTime: this.rateLimitResetTime });
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.rateLimitCounter = 0;
      this.rateLimitResetTime = now + (this.config.rateLimits?.interval || 60000);
    }

    this.rateLimitCounter++;
  }

  // Enhanced error handling with retry logic
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          this.emitError(lastError);
          throw lastError;
        }
        
        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        this.emit('retryAttempt', { attempt: attempt + 1, delay, error: lastError.message });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  // Connection status
  isConnected(): boolean {
    return this.connected;
  }

  // Enhanced health check with detailed status
  async healthCheck(): Promise<boolean> {
    try {
      const startTime = Date.now();
      await this.getExchangeInfo();
      const responseTime = Date.now() - startTime;
      
      this.emit('healthCheck', { 
        status: 'healthy', 
        responseTime,
        timestamp: Date.now()
      });
      
      return true;
    } catch (error) {
      this.emit('healthCheck', { 
        status: 'unhealthy', 
        error: (error as Error).message,
        timestamp: Date.now()
      });
      return false;
    }
  }

  // Connection monitoring with automatic reconnection
  protected startConnectionMonitoring(intervalMs: number = 30000): void {
    setInterval(async () => {
      if (this.connected) {
        const isHealthy = await this.healthCheck();
        if (!isHealthy) {
          this.emit('connectionDegraded');
          await this.attemptReconnection();
        }
      }
    }, intervalMs);
  }

  protected async attemptReconnection(maxAttempts: number = 5): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.emit('reconnectionAttempt', { attempt, maxAttempts });
        await this.connect();
        this.emit('reconnectionSuccess', { attempt });
        return;
      } catch (error) {
        this.emit('reconnectionFailed', { 
          attempt, 
          error: (error as Error).message,
          willRetry: attempt < maxAttempts
        });
        
        if (attempt < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    this.emit('reconnectionExhausted', { maxAttempts });
  }

  // Event handlers for WebSocket data
  protected emitTicker(data: TickerData): void {
    this.emit('ticker', data);
  }

  protected emitOrderBook(data: OrderBookData): void {
    this.emit('orderbook', data);
  }

  protected emitTrade(data: TradeData): void {
    this.emit('trade', data);
  }

  protected emitCandle(data: CandleData): void {
    this.emit('candle', data);
  }

  protected emitError(error: Error): void {
    this.emit('error', error);
  }

  protected emitConnected(): void {
    this.connected = true;
    this.emit('connected');
  }

  protected emitDisconnected(): void {
    this.connected = false;
    this.emit('disconnected');
  }
}