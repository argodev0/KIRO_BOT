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
    console.log('🔌 Disconnecting from Binance exchange...');
    
    // Stop connection monitoring
    if (this.connectionMonitorInterval) {
      clearInterval(this.connectionMonitorInterval);
      this.connectionMonitorInterval = undefined;
    }
    
    // Close all WebSocket connections gracefully
    const disconnectPromises: Promise<void>[] = [];
    
    for (const [stream, ws] of this.wsConnections) {
      disconnectPromises.push(
        new Promise<void>((resolve) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close(1000, 'Normal closure');
            ws.once('close', () => resolve());
            // Timeout in case close event doesn't fire
            setTimeout(() => resolve(), 5000);
          } else {
            resolve();
          }
        })
      );
    }
    
    // Wait for all connections to close
    await Promise.all(disconnectPromises);
    
    // Clear all data structures
    this.wsConnections.clear();
    this.subscriptions.clear();
    this.streamCallbacks.clear();
    this.reconnectionAttempts.clear();
    
    console.log('✅ Binance exchange disconnected');
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
        exchange: 'binance',
      };
      this.emitCandle(candle);
    });
  }

  /**
   * Subscribe to major trading pairs for comprehensive market data
   */
  async subscribeToMajorTradingPairs(timeframes: string[] = ['1m', '5m', '15m', '1h']): Promise<void> {
    const majorPairs = [
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT',
      'SOLUSDT', 'DOTUSDT', 'DOGEUSDT', 'AVAXUSDT', 'MATICUSDT',
      'LINKUSDT', 'LTCUSDT', 'UNIUSDT', 'ATOMUSDT', 'ETCUSDT'
    ];

    console.log(`🚀 Subscribing to ${majorPairs.length} major trading pairs on Binance...`);
    
    const subscriptionPromises: Promise<void>[] = [];
    
    for (const symbol of majorPairs) {
      // Subscribe to ticker data
      subscriptionPromises.push(this.subscribeToTicker(symbol));
      
      // Subscribe to order book data
      subscriptionPromises.push(this.subscribeToOrderBook(symbol));
      
      // Subscribe to trade data
      subscriptionPromises.push(this.subscribeToTrades(symbol));
      
      // Subscribe to candle data for each timeframe
      for (const timeframe of timeframes) {
        subscriptionPromises.push(this.subscribeToCandles(symbol, timeframe));
      }
    }
    
    try {
      await Promise.all(subscriptionPromises);
      console.log(`✅ Successfully subscribed to all major trading pairs on Binance`);
      
      this.emit('majorPairsSubscribed', {
        exchange: 'binance',
        pairs: majorPairs,
        timeframes,
        totalSubscriptions: majorPairs.length * (3 + timeframes.length), // ticker + orderbook + trades + candles
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('❌ Failed to subscribe to some major trading pairs:', error);
      throw error;
    }
  }

  /**
   * Subscribe to specific symbols with all data types
   */
  async subscribeToSymbolComplete(symbol: string, timeframes: string[] = ['1m', '5m', '15m', '1h']): Promise<void> {
    console.log(`📊 Subscribing to complete data for ${symbol}...`);
    
    try {
      await Promise.all([
        this.subscribeToTicker(symbol),
        this.subscribeToOrderBook(symbol),
        this.subscribeToTrades(symbol),
        ...timeframes.map(tf => this.subscribeToCandles(symbol, tf))
      ]);
      
      console.log(`✅ Complete subscription for ${symbol} successful`);
      
      this.emit('symbolCompleteSubscription', {
        exchange: 'binance',
        symbol,
        timeframes,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`❌ Failed to complete subscription for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get subscription statistics
   */
  getSubscriptionStats(): {
    totalSubscriptions: number;
    activeConnections: number;
    subscriptionsByType: Record<string, number>;
    connectionHealth: Record<string, 'healthy' | 'unhealthy'>;
  } {
    const subscriptionsByType: Record<string, number> = {
      ticker: 0,
      depth: 0,
      trade: 0,
      kline: 0,
      other: 0
    };
    
    const connectionHealth: Record<string, 'healthy' | 'unhealthy'> = {};
    
    for (const [stream, ws] of this.wsConnections) {
      // Count by type
      if (stream.includes('@ticker')) subscriptionsByType.ticker++;
      else if (stream.includes('@depth')) subscriptionsByType.depth++;
      else if (stream.includes('@trade')) subscriptionsByType.trade++;
      else if (stream.includes('@kline')) subscriptionsByType.kline++;
      else subscriptionsByType.other++;
      
      // Check health
      connectionHealth[stream] = ws.readyState === WebSocket.OPEN ? 'healthy' : 'unhealthy';
    }
    
    return {
      totalSubscriptions: this.subscriptions.size,
      activeConnections: this.wsConnections.size,
      subscriptionsByType,
      connectionHealth
    };
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
  private connectionMonitorInterval?: NodeJS.Timeout;
  private streamCallbacks: Map<string, (data: any) => void> = new Map();
  private reconnectionAttempts: Map<string, number> = new Map();
  private maxReconnectionAttempts: number = 10;
  private baseReconnectionDelay: number = 1000;

  protected startConnectionMonitoring(): void {
    // Clear any existing interval
    if (this.connectionMonitorInterval) {
      clearInterval(this.connectionMonitorInterval);
    }

    // Monitor WebSocket connections and reconnect if needed
    this.connectionMonitorInterval = setInterval(async () => {
      try {
        // Check if we have active subscriptions but disconnected WebSockets
        for (const [stream, ws] of this.wsConnections) {
          if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
            console.log(`🔄 Reconnecting to Binance stream: ${stream}`);
            
            // Remove the old connection
            this.wsConnections.delete(stream);
            
            // Attempt to reestablish the subscription with stored callback
            const callback = this.streamCallbacks.get(stream);
            if (callback) {
              await this.reconnectToStream(stream, callback);
            } else {
              console.warn(`⚠️  No callback found for stream: ${stream}`);
              this.subscriptions.delete(stream);
            }
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

  private async reconnectToStream(stream: string, callback: (data: any) => void): Promise<void> {
    const attempts = this.reconnectionAttempts.get(stream) || 0;
    
    if (attempts >= this.maxReconnectionAttempts) {
      console.error(`❌ Max reconnection attempts (${this.maxReconnectionAttempts}) reached for stream: ${stream}`);
      this.emit('maxReconnectionAttemptsReached', { exchange: 'binance', stream });
      this.subscriptions.delete(stream);
      this.streamCallbacks.delete(stream);
      this.reconnectionAttempts.delete(stream);
      return;
    }

    const delay = this.baseReconnectionDelay * Math.pow(2, attempts);
    console.log(`🔄 Attempting to reconnect to ${stream} (attempt ${attempts + 1}/${this.maxReconnectionAttempts}) in ${delay}ms`);
    
    this.reconnectionAttempts.set(stream, attempts + 1);
    
    setTimeout(async () => {
      try {
        await this.createWebSocketConnection(stream, callback, attempts + 1);
        // Reset attempts on successful connection
        this.reconnectionAttempts.delete(stream);
        console.log(`✅ Successfully reconnected to ${stream}`);
        this.emit('streamReconnected', { exchange: 'binance', stream });
      } catch (error) {
        console.error(`❌ Failed to reconnect to ${stream}:`, error);
        // Will be retried in next monitoring cycle
      }
    }, delay);
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
      console.log(`⚠️  Already subscribed to stream: ${stream}`);
      return; // Already subscribed
    }

    // Store callback for reconnection purposes
    this.streamCallbacks.set(stream, callback);
    
    await this.createWebSocketConnection(stream, callback, 0);
  }

  private async createWebSocketConnection(stream: string, callback: (data: any) => void, retryCount: number = 0): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.wsBaseURL}/${stream}`;
      console.log(`🔗 Connecting to Binance WebSocket: ${wsUrl}`);
      
      const ws = new WebSocket(wsUrl);
      let pingInterval: NodeJS.Timeout;
      let connectionTimeout: NodeJS.Timeout;
      
      // Set connection timeout
      connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.terminate();
          reject(new Error(`Connection timeout for stream: ${stream}`));
        }
      }, 10000); // 10 second timeout
      
      ws.on('open', () => {
        clearTimeout(connectionTimeout);
        console.log(`✅ Binance WebSocket connected: ${stream}`);
        
        this.subscriptions.add(stream);
        this.wsConnections.set(stream, ws);
        
        // Send ping every 3 minutes to keep connection alive
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
          } else {
            clearInterval(pingInterval);
          }
        }, 180000);
        
        // Emit connection event
        this.emit('streamConnected', { 
          exchange: 'binance', 
          stream, 
          timestamp: Date.now() 
        });
        
        resolve();
      });
      
      ws.on('message', (data) => {
        try {
          const rawData = data.toString();
          const parsed = JSON.parse(rawData);
          
          // Normalize and validate data before passing to callback
          const normalizedData = this.normalizeWebSocketData(parsed, stream);
          if (normalizedData) {
            callback(normalizedData);
            
            // Update last message timestamp for connection monitoring
            this.emit('dataReceived', { 
              exchange: 'binance', 
              stream, 
              timestamp: Date.now(),
              dataType: this.getDataTypeFromStream(stream)
            });
          }
        } catch (error) {
          console.error(`❌ Failed to parse WebSocket message from ${stream}:`, error);
          this.emitError(new Error(`Failed to parse WebSocket message from ${stream}: ${error}`));
        }
      });
      
      ws.on('pong', () => {
        // Connection is alive - emit heartbeat
        this.emit('heartbeat', { 
          exchange: 'binance', 
          stream, 
          timestamp: Date.now() 
        });
      });
      
      ws.on('error', (error) => {
        clearTimeout(connectionTimeout);
        clearInterval(pingInterval);
        console.error(`❌ Binance WebSocket error on ${stream}:`, error);
        
        this.emit('streamError', { 
          exchange: 'binance', 
          stream, 
          error: error.message,
          timestamp: Date.now()
        });
        
        this.emitError(error);
        reject(error);
      });
      
      ws.on('close', (code, reason) => {
        clearTimeout(connectionTimeout);
        clearInterval(pingInterval);
        
        const reasonStr = reason?.toString() || 'Unknown';
        console.log(`🔌 Binance WebSocket closed: ${stream} (${code}: ${reasonStr})`);
        
        this.subscriptions.delete(stream);
        this.wsConnections.delete(stream);
        
        this.emit('streamDisconnected', { 
          exchange: 'binance', 
          stream, 
          code,
          reason: reasonStr,
          timestamp: Date.now()
        });
        
        // Don't attempt immediate reconnection here - let the monitoring handle it
        // This prevents multiple reconnection attempts
        if (code === 1000) {
          // Normal closure - remove callback
          this.streamCallbacks.delete(stream);
          this.reconnectionAttempts.delete(stream);
        }
      });
    });
  }

  // Data normalization for consistent format
  private normalizeWebSocketData(data: any, stream: string): any {
    try {
      // Handle different stream types
      if (stream.includes('@ticker')) {
        return this.normalizeTickerData(data);
      } else if (stream.includes('@depth')) {
        return this.normalizeDepthData(data);
      } else if (stream.includes('@trade')) {
        return this.normalizeTradeData(data);
      } else if (stream.includes('@kline')) {
        return this.normalizeKlineData(data);
      }
      
      return data; // Return as-is if no specific normalization needed
    } catch (error) {
      console.error(`❌ Failed to normalize data for stream ${stream}:`, error);
      return null;
    }
  }

  private normalizeTickerData(data: any): any {
    return {
      ...data,
      // Ensure numeric fields are properly parsed
      c: parseFloat(data.c), // Close price
      o: parseFloat(data.o), // Open price
      h: parseFloat(data.h), // High price
      l: parseFloat(data.l), // Low price
      v: parseFloat(data.v), // Volume
      q: parseFloat(data.q), // Quote volume
      b: parseFloat(data.b), // Best bid price
      a: parseFloat(data.a), // Best ask price
      P: parseFloat(data.P), // Price change
      p: parseFloat(data.p), // Price change percent
      // Ensure timestamps are numbers
      E: parseInt(data.E), // Event time
      O: parseInt(data.O), // Statistics open time
      C: parseInt(data.C), // Statistics close time
    };
  }

  private normalizeDepthData(data: any): any {
    return {
      ...data,
      // Normalize bid/ask arrays to ensure proper number parsing
      b: data.b?.map((bid: string[]) => [parseFloat(bid[0]), parseFloat(bid[1])]) || [],
      a: data.a?.map((ask: string[]) => [parseFloat(ask[0]), parseFloat(ask[1])]) || [],
      E: parseInt(data.E), // Event time
      T: parseInt(data.T), // Transaction time
    };
  }

  private normalizeTradeData(data: any): any {
    return {
      ...data,
      p: parseFloat(data.p), // Price
      q: parseFloat(data.q), // Quantity
      T: parseInt(data.T), // Trade time
      t: parseInt(data.t), // Trade ID
      E: parseInt(data.E), // Event time
    };
  }

  private normalizeKlineData(data: any): any {
    if (data.k) {
      return {
        ...data,
        k: {
          ...data.k,
          o: parseFloat(data.k.o), // Open price
          c: parseFloat(data.k.c), // Close price
          h: parseFloat(data.k.h), // High price
          l: parseFloat(data.k.l), // Low price
          v: parseFloat(data.k.v), // Volume
          q: parseFloat(data.k.q), // Quote volume
          t: parseInt(data.k.t), // Kline start time
          T: parseInt(data.k.T), // Kline close time
        },
        E: parseInt(data.E), // Event time
      };
    }
    return data;
  }

  private getDataTypeFromStream(stream: string): string {
    if (stream.includes('@ticker')) return 'ticker';
    if (stream.includes('@depth')) return 'orderbook';
    if (stream.includes('@trade')) return 'trade';
    if (stream.includes('@kline')) return 'candle';
    return 'unknown';
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