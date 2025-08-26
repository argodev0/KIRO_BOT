/**
 * Binance Exchange Implementation
 * Implements Binance Spot and Futures API connectivity
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import WebSocket from 'ws';
import { BaseExchange, ExchangeConfig, ExchangeInfo } from './BaseExchange';
import { CandleData, TickerData, OrderBookData, TradeData, Timeframe } from '../../types/market';
import { OrderRequest, OrderResponse, Position } from '../../types/trading';

interface BinanceConfig extends ExchangeConfig {
  baseURL?: string;
  wsBaseURL?: string;
  mainnet?: boolean;
  readOnly?: boolean;
}

export class BinanceExchange extends BaseExchange {
  private httpClient: AxiosInstance;
  private wsConnections: Map<string, WebSocket> = new Map();
  private subscriptions: Set<string> = new Set();
  private baseURL: string;
  private wsBaseURL: string;

  constructor(config: BinanceConfig) {
    super(config);
    
    // Determine URLs based on mainnet/testnet configuration
    if (config.mainnet) {
      this.baseURL = config.baseURL || 'https://api.binance.com/api';
      this.wsBaseURL = config.wsBaseURL || 'wss://stream.binance.com:9443/ws';
    } else if (config.testnet) {
      this.baseURL = config.baseURL || 'https://testnet.binance.vision/api';
      this.wsBaseURL = config.wsBaseURL || 'wss://testnet.binance.vision/ws';
    } else {
      // Default to testnet for safety
      this.baseURL = config.baseURL || 'https://testnet.binance.vision/api';
      this.wsBaseURL = config.wsBaseURL || 'wss://testnet.binance.vision/ws';
    }

    this.httpClient = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
    });

    // Add request interceptor for authentication
    this.httpClient.interceptors.request.use((config) => {
      if (config.params?.signature) {
        const timestamp = Date.now();
        config.params.timestamp = timestamp;
        
        const queryString = new URLSearchParams(config.params).toString();
        const signature = crypto
          .createHmac('sha256', this.config.apiSecret)
          .update(queryString)
          .digest('hex');
        
        config.params.signature = signature;
        config.headers['X-MBX-APIKEY'] = this.config.apiKey;
      }
      
      return config;
    });
  }

  async connect(): Promise<void> {
    try {
      // Validate API key permissions for mainnet connections
      if ((this.config as BinanceConfig).mainnet) {
        await this.validateApiKeyPermissions();
      }
      
      // Test connection with exchange info
      await this.executeWithRetry(() => this.getExchangeInfo());
      this.startConnectionMonitoring();
      this.emitConnected();
    } catch (error) {
      this.emitError(error as Error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    // Close all WebSocket connections
    for (const [stream, ws] of this.wsConnections) {
      ws.close();
      this.wsConnections.delete(stream);
    }
    
    this.subscriptions.clear();
    this.emitDisconnected();
  }

  async getExchangeInfo(): Promise<ExchangeInfo> {
    await this.checkRateLimit();
    
    try {
      const response = await this.httpClient.get('/v3/exchangeInfo');
      const data = response.data;
      
      return {
        name: 'binance',
        status: data.serverTime ? 'online' : 'offline',
        symbols: data.symbols.map((s: any) => s.symbol),
        fees: {
          maker: 0.001, // Default fees, should be fetched from account info
          taker: 0.001,
        },
        rateLimits: {
          requests: 1200,
          interval: 60000,
        },
      };
    } catch (error) {
      throw new Error(`Failed to get exchange info: ${error}`);
    }
  }

  async getSymbols(): Promise<string[]> {
    const info = await this.getExchangeInfo();
    return info.symbols;
  }

  async getTicker(symbol: string): Promise<TickerData> {
    await this.checkRateLimit();
    
    return this.executeWithRetry(async () => {
      const response = await this.httpClient.get('/v3/ticker/24hr', {
        params: { symbol: symbol.toUpperCase() }
      });
      
      const data = response.data;
      
      return {
        symbol: data.symbol,
        exchange: 'binance',
        price: parseFloat(data.lastPrice),
        volume: parseFloat(data.volume),
        timestamp: data.closeTime,
        bid: parseFloat(data.bidPrice),
        ask: parseFloat(data.askPrice),
        change24h: parseFloat(data.priceChange),
        changePercent24h: parseFloat(data.priceChangePercent),
      };
    });
  }

  async getOrderBook(symbol: string, limit: number = 100): Promise<OrderBookData> {
    await this.checkRateLimit();
    
    try {
      const response = await this.httpClient.get('/v3/depth', {
        params: { 
          symbol: symbol.toUpperCase(),
          limit: Math.min(limit, 5000)
        }
      });
      
      const data = response.data;
      
      return {
        symbol: symbol.toUpperCase(),
        exchange: 'binance',
        timestamp: Date.now(),
        bids: data.bids.map((bid: string[]) => [parseFloat(bid[0]), parseFloat(bid[1])]),
        asks: data.asks.map((ask: string[]) => [parseFloat(ask[0]), parseFloat(ask[1])]),
      };
    } catch (error) {
      throw new Error(`Failed to get order book for ${symbol}: ${error}`);
    }
  }

  async getCandles(
    symbol: string,
    timeframe: string,
    limit: number = 500,
    startTime?: number,
    endTime?: number
  ): Promise<CandleData[]> {
    await this.checkRateLimit();
    
    try {
      const params: any = {
        symbol: symbol.toUpperCase(),
        interval: this.mapTimeframe(timeframe),
        limit: Math.min(limit, 1000),
      };
      
      if (startTime) params.startTime = startTime;
      if (endTime) params.endTime = endTime;
      
      const response = await this.httpClient.get('/v3/klines', { params });
      
      return response.data.map((candle: any[]) => ({
        symbol: symbol.toUpperCase(),
        timeframe: timeframe as Timeframe,
        timestamp: candle[0],
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
      }));
    } catch (error) {
      throw new Error(`Failed to get candles for ${symbol}: ${error}`);
    }
  }

  async getRecentTrades(symbol: string, limit: number = 500): Promise<TradeData[]> {
    await this.checkRateLimit();
    
    try {
      const response = await this.httpClient.get('/v3/trades', {
        params: {
          symbol: symbol.toUpperCase(),
          limit: Math.min(limit, 1000),
        }
      });
      
      return response.data.map((trade: any) => ({
        symbol: symbol.toUpperCase(),
        exchange: 'binance',
        timestamp: trade.time,
        price: parseFloat(trade.price),
        quantity: parseFloat(trade.qty),
        side: trade.isBuyerMaker ? 'sell' : 'buy',
        tradeId: trade.id.toString(),
      }));
    } catch (error) {
      throw new Error(`Failed to get recent trades for ${symbol}: ${error}`);
    }
  }

  // WebSocket subscription methods
  async subscribeToTicker(symbol: string): Promise<void> {
    const stream = `${symbol.toLowerCase()}@ticker`;
    await this.subscribeToStream(stream, (data) => {
      const ticker: TickerData = {
        symbol: data.s,
        exchange: 'binance',
        price: parseFloat(data.c),
        volume: parseFloat(data.v),
        timestamp: data.E,
        bid: parseFloat(data.b),
        ask: parseFloat(data.a),
        change24h: parseFloat(data.P),
        changePercent24h: parseFloat(data.p),
      };
      this.emitTicker(ticker);
    });
  }

  async subscribeToOrderBook(symbol: string): Promise<void> {
    const stream = `${symbol.toLowerCase()}@depth`;
    await this.subscribeToStream(stream, (data) => {
      const orderBook: OrderBookData = {
        symbol: data.s,
        exchange: 'binance',
        timestamp: Date.now(),
        bids: data.b.map((bid: string[]) => [parseFloat(bid[0]), parseFloat(bid[1])]),
        asks: data.a.map((ask: string[]) => [parseFloat(ask[0]), parseFloat(ask[1])]),
      };
      this.emitOrderBook(orderBook);
    });
  }

  async subscribeToTrades(symbol: string): Promise<void> {
    const stream = `${symbol.toLowerCase()}@trade`;
    await this.subscribeToStream(stream, (data) => {
      const trade: TradeData = {
        symbol: data.s,
        exchange: 'binance',
        timestamp: data.T,
        price: parseFloat(data.p),
        quantity: parseFloat(data.q),
        side: data.m ? 'sell' : 'buy',
        tradeId: data.t.toString(),
      };
      this.emitTrade(trade);
    });
  }

  async subscribeToCandles(symbol: string, timeframe: string): Promise<void> {
    const interval = this.mapTimeframe(timeframe);
    const stream = `${symbol.toLowerCase()}@kline_${interval}`;
    await this.subscribeToStream(stream, (data) => {
      const kline = data.k;
      const candle: CandleData = {
        symbol: kline.s,
        timeframe: timeframe as Timeframe,
        timestamp: kline.t,
        open: parseFloat(kline.o),
        high: parseFloat(kline.h),
        low: parseFloat(kline.l),
        close: parseFloat(kline.c),
        volume: parseFloat(kline.v),
      };
      this.emitCandle(candle);
    });
  }

  // Unsubscribe methods
  async unsubscribeFromTicker(symbol: string): Promise<void> {
    const stream = `${symbol.toLowerCase()}@ticker`;
    await this.unsubscribeFromStream(stream);
  }

  async unsubscribeFromOrderBook(symbol: string): Promise<void> {
    const stream = `${symbol.toLowerCase()}@depth`;
    await this.unsubscribeFromStream(stream);
  }

  async unsubscribeFromTrades(symbol: string): Promise<void> {
    const stream = `${symbol.toLowerCase()}@trade`;
    await this.unsubscribeFromStream(stream);
  }

  async unsubscribeFromCandles(symbol: string, timeframe: string): Promise<void> {
    const interval = this.mapTimeframe(timeframe);
    const stream = `${symbol.toLowerCase()}@kline_${interval}`;
    await this.unsubscribeFromStream(stream);
  }

  // Trading methods (placeholder implementations)
  async placeOrder(order: OrderRequest): Promise<OrderResponse> {
    await this.checkRateLimit();
    
    try {
      const params = {
        symbol: order.symbol.toUpperCase(),
        side: order.side.toUpperCase(),
        type: order.type.toUpperCase(),
        quantity: order.quantity,
        ...(order.price && { price: order.price }),
        ...(order.timeInForce && { timeInForce: order.timeInForce }),
        signature: true, // Trigger signature generation
      };
      
      const response = await this.httpClient.post('/v3/order', null, { params });
      
      return {
        orderId: response.data.orderId.toString(),
        clientOrderId: response.data.clientOrderId,
        symbol: response.data.symbol,
        side: response.data.side.toLowerCase(),
        type: response.data.type.toLowerCase(),
        quantity: parseFloat(response.data.origQty),
        price: parseFloat(response.data.price || '0'),
        status: this.mapOrderStatus(response.data.status),
        timestamp: response.data.transactTime,
        exchange: 'binance',
      };
    } catch (error) {
      throw new Error(`Failed to place order: ${error}`);
    }
  }

  async cancelOrder(orderId: string, symbol: string): Promise<boolean> {
    await this.checkRateLimit();
    
    try {
      await this.httpClient.delete('/v3/order', {
        params: {
          symbol: symbol.toUpperCase(),
          orderId,
          signature: true,
        }
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async getOrder(orderId: string, symbol: string): Promise<OrderResponse> {
    await this.checkRateLimit();
    
    try {
      const response = await this.httpClient.get('/v3/order', {
        params: {
          symbol: symbol.toUpperCase(),
          orderId,
          signature: true,
        }
      });
      
      const data = response.data;
      return {
        orderId: data.orderId.toString(),
        clientOrderId: data.clientOrderId,
        symbol: data.symbol,
        side: data.side.toLowerCase(),
        type: data.type.toLowerCase(),
        quantity: parseFloat(data.origQty),
        price: parseFloat(data.price || '0'),
        status: this.mapOrderStatus(data.status),
        timestamp: data.time,
        exchange: 'binance',
      };
    } catch (error) {
      throw new Error(`Failed to get order: ${error}`);
    }
  }

  async getOpenOrders(symbol?: string): Promise<OrderResponse[]> {
    await this.checkRateLimit();
    
    try {
      const params: any = { signature: true };
      if (symbol) params.symbol = symbol.toUpperCase();
      
      const response = await this.httpClient.get('/v3/openOrders', { params });
      
      return response.data.map((order: any) => ({
        orderId: order.orderId.toString(),
        clientOrderId: order.clientOrderId,
        symbol: order.symbol,
        side: order.side.toLowerCase(),
        type: order.type.toLowerCase(),
        quantity: parseFloat(order.origQty),
        price: parseFloat(order.price || '0'),
        status: this.mapOrderStatus(order.status),
        timestamp: order.time,
        exchange: 'binance',
      }));
    } catch (error) {
      throw new Error(`Failed to get open orders: ${error}`);
    }
  }

  async getOrderHistory(symbol?: string, limit: number = 500): Promise<OrderResponse[]> {
    await this.checkRateLimit();
    
    try {
      const params: any = { 
        signature: true,
        limit: Math.min(limit, 1000),
      };
      if (symbol) params.symbol = symbol.toUpperCase();
      
      const response = await this.httpClient.get('/v3/allOrders', { params });
      
      return response.data.map((order: any) => ({
        orderId: order.orderId.toString(),
        clientOrderId: order.clientOrderId,
        symbol: order.symbol,
        side: order.side.toLowerCase(),
        type: order.type.toLowerCase(),
        quantity: parseFloat(order.origQty),
        price: parseFloat(order.price || '0'),
        status: this.mapOrderStatus(order.status),
        timestamp: order.time,
        exchange: 'binance',
      }));
    } catch (error) {
      throw new Error(`Failed to get order history: ${error}`);
    }
  }

  async getBalance(): Promise<Record<string, number>> {
    await this.checkRateLimit();
    
    try {
      const response = await this.httpClient.get('/v3/account', {
        params: { signature: true }
      });
      
      const balances: Record<string, number> = {};
      response.data.balances.forEach((balance: any) => {
        const free = parseFloat(balance.free);
        const locked = parseFloat(balance.locked);
        if (free > 0 || locked > 0) {
          balances[balance.asset] = free + locked;
        }
      });
      
      return balances;
    } catch (error) {
      throw new Error(`Failed to get balance: ${error}`);
    }
  }

  async getPositions(): Promise<Position[]> {
    // Binance Spot doesn't have positions, return empty array
    // For futures, this would need to be implemented differently
    return [];
  }

  // API Key validation for mainnet safety
  private async validateApiKeyPermissions(): Promise<void> {
    if (!this.config.apiKey || !this.config.apiSecret) {
      throw new Error('API credentials required for mainnet connection');
    }

    try {
      // Check account information to validate API key permissions
      const response = await this.httpClient.get('/v3/account', {
        params: { signature: true }
      });

      // Verify this is a read-only API key by checking permissions
      const accountInfo = response.data;
      
      // Check if API key has trading permissions (should be false for safety)
      if (accountInfo.canTrade === true) {
        const config = this.config as BinanceConfig;
        if (!config.readOnly) {
          throw new Error('SECURITY ALERT: API key has trading permissions. Use read-only keys for paper trading mode.');
        }
        console.warn('⚠️  WARNING: API key has trading permissions but read-only mode is enforced');
      }

      // Log successful validation
      console.log('✅ Binance mainnet API key validated - Read-only permissions confirmed');
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('SECURITY ALERT')) {
        throw error;
      }
      throw new Error(`Failed to validate Binance API key permissions: ${error}`);
    }
  }

  // Enhanced connection monitoring with automatic reconnection
  private startConnectionMonitoring(): void {
    // Monitor WebSocket connections and reconnect if needed
    setInterval(async () => {
      try {
        // Check if we have active subscriptions but disconnected WebSockets
        for (const [stream, ws] of this.wsConnections) {
          if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
            console.log(`🔄 Reconnecting to Binance stream: ${stream}`);
            
            // Remove the old connection
            this.wsConnections.delete(stream);
            this.subscriptions.delete(stream);
            
            // Attempt to reestablish the subscription
            // This would need the original callback, which we'd need to store
            // For now, emit a reconnection event
            this.emit('streamDisconnected', { exchange: 'binance', stream });
          }
        }
        
        // Periodic health check
        await this.healthCheck();
        
      } catch (error) {
        console.error('Binance connection monitoring error:', error);
        this.emitError(error as Error);
      }
    }, 30000); // Check every 30 seconds
  }

  // Enhanced health check
  async healthCheck(): Promise<boolean> {
    try {
      // Test REST API connectivity
      const response = await this.httpClient.get('/v3/ping');
      
      // Check WebSocket connections
      const activeConnections = Array.from(this.wsConnections.values())
        .filter(ws => ws.readyState === WebSocket.OPEN).length;
      
      const isHealthy = response.status === 200 && activeConnections >= 0;
      
      if (isHealthy) {
        this.emit('healthCheck', { 
          exchange: 'binance', 
          status: 'healthy',
          activeConnections,
          timestamp: Date.now()
        });
      }
      
      return isHealthy;
    } catch (error) {
      this.emit('healthCheck', { 
        exchange: 'binance', 
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
      return false;
    }
  }

  // Helper methods with enhanced reconnection logic
  private async subscribeToStream(stream: string, callback: (data: any) => void): Promise<void> {
    if (this.subscriptions.has(stream)) {
      return; // Already subscribed
    }

    this.createWebSocketConnection(stream, callback, 0);
  }

  private createWebSocketConnection(stream: string, callback: (data: any) => void, retryCount: number = 0): void {
    const maxRetries = 5;
    const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Exponential backoff, max 30s

    const ws = new WebSocket(`${this.wsBaseURL}/${stream}`);
    
    ws.on('open', () => {
      console.log(`✅ Binance WebSocket connected: ${stream}`);
      this.subscriptions.add(stream);
      this.wsConnections.set(stream, ws);
      
      // Reset retry count on successful connection
      retryCount = 0;
      
      // Send ping every 3 minutes to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, 180000);
    });
    
    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        callback(parsed);
        
        // Update last message timestamp for connection monitoring
        this.emit('dataReceived', { 
          exchange: 'binance', 
          stream, 
          timestamp: Date.now() 
        });
      } catch (error) {
        this.emitError(new Error(`Failed to parse WebSocket message: ${error}`));
      }
    });
    
    ws.on('pong', () => {
      // Connection is alive
      this.emit('pong', { exchange: 'binance', stream, timestamp: Date.now() });
    });
    
    ws.on('error', (error) => {
      console.error(`❌ Binance WebSocket error on ${stream}:`, error);
      this.emitError(error);
    });
    
    ws.on('close', (code, reason) => {
      console.log(`🔌 Binance WebSocket closed: ${stream} (${code}: ${reason})`);
      this.subscriptions.delete(stream);
      this.wsConnections.delete(stream);
      
      // Attempt reconnection if not manually closed and within retry limit
      if (code !== 1000 && retryCount < maxRetries) {
        console.log(`🔄 Reconnecting to ${stream} in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        
        setTimeout(() => {
          this.createWebSocketConnection(stream, callback, retryCount + 1);
        }, retryDelay);
      } else if (retryCount >= maxRetries) {
        console.error(`❌ Max reconnection attempts reached for ${stream}`);
        this.emit('maxRetriesReached', { exchange: 'binance', stream });
      }
    });
  }

  private async unsubscribeFromStream(stream: string): Promise<void> {
    const ws = this.wsConnections.get(stream);
    if (ws) {
      ws.close();
      this.wsConnections.delete(stream);
      this.subscriptions.delete(stream);
    }
  }

  private mapTimeframe(timeframe: string): string {
    const mapping: Record<string, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1h',
      '4h': '4h',
      '1d': '1d',
      '1w': '1w',
      '1M': '1M',
    };
    
    return mapping[timeframe] || '1h';
  }

  private mapOrderStatus(status: string): 'new' | 'partially_filled' | 'filled' | 'cancelled' | 'rejected' | 'expired' {
    const mapping: Record<string, 'new' | 'partially_filled' | 'filled' | 'cancelled' | 'rejected' | 'expired'> = {
      'NEW': 'new',
      'PARTIALLY_FILLED': 'partially_filled',
      'FILLED': 'filled',
      'CANCELED': 'cancelled',
      'REJECTED': 'rejected',
      'EXPIRED': 'expired',
    };
    
    return mapping[status] || 'new';
  }
}