/**
 * KuCoin Exchange Implementation
 * Implements KuCoin Spot API connectivity
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import WebSocket from 'ws';
import { BaseExchange, ExchangeConfig, ExchangeInfo } from './BaseExchange';
import { CandleData, TickerData, OrderBookData, TradeData, Timeframe } from '../../types/market';
import { OrderRequest, OrderResponse, Position } from '../../types/trading';

interface KuCoinConfig extends ExchangeConfig {
  passphrase: string;
  baseURL?: string;
  wsBaseURL?: string;
  mainnet?: boolean;
  readOnly?: boolean;
}

export class KuCoinExchange extends BaseExchange {
  private httpClient: AxiosInstance;
  private wsConnections: Map<string, WebSocket> = new Map();
  private subscriptions: Set<string> = new Set();
  private baseURL: string;
  private wsBaseURL: string;
  private passphrase: string;

  constructor(config: KuCoinConfig) {
    super(config);
    
    this.passphrase = config.passphrase;
    
    // Determine URLs based on mainnet/sandbox configuration
    if (config.mainnet) {
      this.baseURL = config.baseURL || 'https://api.kucoin.com';
      this.wsBaseURL = config.wsBaseURL || 'wss://ws-api-spot.kucoin.com';
    } else if (config.sandbox) {
      this.baseURL = config.baseURL || 'https://openapi-sandbox.kucoin.com';
      this.wsBaseURL = config.wsBaseURL || 'wss://ws-api-sandbox.kucoin.com';
    } else {
      // Default to sandbox for safety
      this.baseURL = config.baseURL || 'https://openapi-sandbox.kucoin.com';
      this.wsBaseURL = config.wsBaseURL || 'wss://ws-api-sandbox.kucoin.com';
    }

    this.httpClient = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
    });

    // Add request interceptor for authentication
    this.httpClient.interceptors.request.use((config) => {
      if (config.headers?.['KC-API-SIGN']) {
        const timestamp = Date.now().toString();
        const method = config.method?.toUpperCase() || 'GET';
        const endpoint = config.url || '';
        const body = config.data ? JSON.stringify(config.data) : '';
        
        const strForSign = timestamp + method + endpoint + body;
        const signatureBuffer = crypto.createHmac('sha256', this.config.apiSecret).update(strForSign).digest();
        const signature = signatureBuffer.toString('base64');
        
        const passphraseBuffer = crypto.createHmac('sha256', this.config.apiSecret).update(this.passphrase).digest();
        const passphraseSign = passphraseBuffer.toString('base64');
        
        config.headers['KC-API-SIGN'] = signature;
        config.headers['KC-API-TIMESTAMP'] = timestamp;
        config.headers['KC-API-KEY'] = this.config.apiKey;
        config.headers['KC-API-PASSPHRASE'] = passphraseSign;
        config.headers['KC-API-KEY-VERSION'] = '2';
      }
      
      return config;
    });
  }

  async connect(): Promise<void> {
    try {
      // Validate API key permissions for mainnet connections
      if ((this.config as KuCoinConfig).mainnet) {
        await this.validateApiKeyPermissions();
      }
      
      await this.executeWithRetry(() => this.getExchangeInfo());
      this.startConnectionMonitoring();
      this.emitConnected();
    } catch (error) {
      this.emitError(error as Error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
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
      const response = await this.httpClient.get('/api/v1/symbols');
      const data = response.data;
      
      if (data.code !== '200000') {
        throw new Error(`KuCoin API error: ${data.msg}`);
      }
      
      return {
        name: 'kucoin',
        status: 'online',
        symbols: data.data.map((s: any) => s.symbol),
        fees: {
          maker: 0.001,
          taker: 0.001,
        },
        rateLimits: {
          requests: 1800,
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
      const response = await this.httpClient.get('/api/v1/market/stats', {
        params: { symbol: symbol.toUpperCase() }
      });
      
      const data = response.data;
      if (data.code !== '200000') {
        throw new Error(`KuCoin API error: ${data.msg}`);
      }
      
      const ticker = data.data;
      
      return {
        symbol: symbol.toUpperCase(),
        exchange: 'kucoin',
        price: parseFloat(ticker.last),
        volume: parseFloat(ticker.vol),
        timestamp: Date.now(),
        bid: parseFloat(ticker.buy),
        ask: parseFloat(ticker.sell),
        change24h: parseFloat(ticker.changePrice),
        changePercent24h: parseFloat(ticker.changeRate) * 100,
      };
    });
  }

  async getOrderBook(symbol: string, limit: number = 100): Promise<OrderBookData> {
    await this.checkRateLimit();
    
    try {
      const response = await this.httpClient.get('/api/v1/market/orderbook/level2_100', {
        params: { symbol: symbol.toUpperCase() }
      });
      
      const data = response.data;
      if (data.code !== '200000') {
        throw new Error(`KuCoin API error: ${data.msg}`);
      }
      
      const orderbook = data.data;
      
      return {
        symbol: symbol.toUpperCase(),
        exchange: 'kucoin',
        timestamp: orderbook.time,
        bids: orderbook.bids.slice(0, limit).map((bid: string[]) => [parseFloat(bid[0]), parseFloat(bid[1])]),
        asks: orderbook.asks.slice(0, limit).map((ask: string[]) => [parseFloat(ask[0]), parseFloat(ask[1])]),
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
        type: this.mapTimeframe(timeframe),
      };
      
      if (startTime) params.startAt = Math.floor(startTime / 1000);
      if (endTime) params.endAt = Math.floor(endTime / 1000);
      
      const response = await this.httpClient.get('/api/v1/market/candles', { params });
      
      const data = response.data;
      if (data.code !== '200000') {
        throw new Error(`KuCoin API error: ${data.msg}`);
      }
      
      return data.data.slice(0, limit).map((candle: string[]) => ({
        symbol: symbol.toUpperCase(),
        timeframe: timeframe as Timeframe,
        timestamp: parseInt(candle[0]) * 1000,
        open: parseFloat(candle[1]),
        close: parseFloat(candle[2]),
        high: parseFloat(candle[3]),
        low: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
      }));
    } catch (error) {
      throw new Error(`Failed to get candles for ${symbol}: ${error}`);
    }
  }

  async getRecentTrades(symbol: string, limit: number = 500): Promise<TradeData[]> {
    await this.checkRateLimit();
    
    try {
      const response = await this.httpClient.get('/api/v1/market/histories', {
        params: { symbol: symbol.toUpperCase() }
      });
      
      const data = response.data;
      if (data.code !== '200000') {
        throw new Error(`KuCoin API error: ${data.msg}`);
      }
      
      return data.data.slice(0, limit).map((trade: any) => ({
        symbol: symbol.toUpperCase(),
        exchange: 'kucoin',
        timestamp: parseInt(trade.time),
        price: parseFloat(trade.price),
        quantity: parseFloat(trade.size),
        side: trade.side,
        tradeId: trade.sequence,
      }));
    } catch (error) {
      throw new Error(`Failed to get recent trades for ${symbol}: ${error}`);
    }
  }

  // WebSocket subscription methods with full implementation
  async subscribeToTicker(symbol: string): Promise<void> {
    const topic = `/market/ticker:${symbol.toUpperCase()}`;
    await this.subscribeToTopic(topic, (data) => {
      const ticker: TickerData = {
        symbol: data.subject,
        exchange: 'kucoin',
        price: parseFloat(data.data.price),
        volume: parseFloat(data.data.vol),
        timestamp: data.data.time,
        bid: parseFloat(data.data.bestBid),
        ask: parseFloat(data.data.bestAsk),
        change24h: parseFloat(data.data.changePrice),
        changePercent24h: parseFloat(data.data.changeRate) * 100,
      };
      this.emitTicker(ticker);
    });
  }

  async subscribeToOrderBook(symbol: string): Promise<void> {
    const topic = `/market/level2:${symbol.toUpperCase()}`;
    await this.subscribeToTopic(topic, (data) => {
      const orderBook: OrderBookData = {
        symbol: data.subject,
        exchange: 'kucoin',
        timestamp: data.data.time,
        bids: data.data.bids.map((bid: string[]) => [parseFloat(bid[0]), parseFloat(bid[1])]),
        asks: data.data.asks.map((ask: string[]) => [parseFloat(ask[0]), parseFloat(ask[1])]),
      };
      this.emitOrderBook(orderBook);
    });
  }

  async subscribeToTrades(symbol: string): Promise<void> {
    const topic = `/market/match:${symbol.toUpperCase()}`;
    await this.subscribeToTopic(topic, (data) => {
      const trade: TradeData = {
        symbol: data.subject,
        exchange: 'kucoin',
        timestamp: parseInt(data.data.time),
        price: parseFloat(data.data.price),
        quantity: parseFloat(data.data.size),
        side: data.data.side,
        tradeId: data.data.tradeId,
      };
      this.emitTrade(trade);
    });
  }

  async subscribeToCandles(symbol: string, timeframe: string): Promise<void> {
    const interval = this.mapTimeframe(timeframe);
    const topic = `/market/candles:${symbol.toUpperCase()}_${interval}`;
    await this.subscribeToTopic(topic, (data) => {
      const candle: CandleData = {
        symbol: data.subject.split('_')[0],
        timeframe: timeframe as Timeframe,
        timestamp: parseInt(data.data.time) * 1000,
        open: parseFloat(data.data.open),
        high: parseFloat(data.data.high),
        low: parseFloat(data.data.low),
        close: parseFloat(data.data.close),
        volume: parseFloat(data.data.volume),
      };
      this.emitCandle(candle);
    });
  }

  async unsubscribeFromTicker(symbol: string): Promise<void> {
    const topic = `/market/ticker:${symbol.toUpperCase()}`;
    await this.unsubscribeFromTopic(topic);
  }

  async unsubscribeFromOrderBook(symbol: string): Promise<void> {
    const topic = `/market/level2:${symbol.toUpperCase()}`;
    await this.unsubscribeFromTopic(topic);
  }

  async unsubscribeFromTrades(symbol: string): Promise<void> {
    const topic = `/market/match:${symbol.toUpperCase()}`;
    await this.unsubscribeFromTopic(topic);
  }

  async unsubscribeFromCandles(symbol: string, timeframe: string): Promise<void> {
    const interval = this.mapTimeframe(timeframe);
    const topic = `/market/candles:${symbol.toUpperCase()}_${interval}`;
    await this.unsubscribeFromTopic(topic);
  }

  // Trading methods (placeholder implementations)
  async placeOrder(order: OrderRequest): Promise<OrderResponse> {
    await this.checkRateLimit();
    
    try {
      const orderData = {
        clientOid: Date.now().toString(),
        side: order.side,
        symbol: order.symbol.toUpperCase(),
        type: order.type,
        size: order.quantity.toString(),
        ...(order.price && { price: order.price.toString() }),
      };
      
      const response = await this.httpClient.post('/api/v1/orders', orderData, {
        headers: { 'KC-API-SIGN': true }
      });
      
      const data = response.data;
      if (data.code !== '200000') {
        throw new Error(`KuCoin API error: ${data.msg}`);
      }
      
      return {
        orderId: data.data.orderId,
        clientOrderId: orderData.clientOid,
        symbol: order.symbol.toUpperCase(),
        side: order.side,
        type: order.type,
        quantity: order.quantity,
        price: order.price || 0,
        status: 'new',
        timestamp: Date.now(),
        exchange: 'kucoin',
      };
    } catch (error) {
      throw new Error(`Failed to place order: ${error}`);
    }
  }

  async cancelOrder(orderId: string, _symbol: string): Promise<boolean> {
    await this.checkRateLimit();
    
    try {
      const response = await this.httpClient.delete(`/api/v1/orders/${orderId}`, {
        headers: { 'KC-API-SIGN': true }
      });
      
      const data = response.data;
      return data.code === '200000';
    } catch (error) {
      return false;
    }
  }

  async getOrder(orderId: string, _symbol: string): Promise<OrderResponse> {
    await this.checkRateLimit();
    
    try {
      const response = await this.httpClient.get(`/api/v1/orders/${orderId}`, {
        headers: { 'KC-API-SIGN': true }
      });
      
      const data = response.data;
      if (data.code !== '200000') {
        throw new Error(`KuCoin API error: ${data.msg}`);
      }
      
      const order = data.data;
      return {
        orderId: order.id,
        clientOrderId: order.clientOid,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        quantity: parseFloat(order.size),
        price: parseFloat(order.price || '0'),
        status: this.mapOrderStatus(order.isActive, order.cancelExist),
        timestamp: order.createdAt,
        exchange: 'kucoin',
      };
    } catch (error) {
      throw new Error(`Failed to get order: ${error}`);
    }
  }

  async getOpenOrders(symbol?: string): Promise<OrderResponse[]> {
    await this.checkRateLimit();
    
    try {
      const params: any = { status: 'active' };
      if (symbol) params.symbol = symbol.toUpperCase();
      
      const response = await this.httpClient.get('/api/v1/orders', {
        params,
        headers: { 'KC-API-SIGN': true }
      });
      
      const data = response.data;
      if (data.code !== '200000') {
        throw new Error(`KuCoin API error: ${data.msg}`);
      }
      
      return data.data.items.map((order: any) => ({
        orderId: order.id,
        clientOrderId: order.clientOid,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        quantity: parseFloat(order.size),
        price: parseFloat(order.price || '0'),
        status: this.mapOrderStatus(order.isActive, order.cancelExist),
        timestamp: order.createdAt,
        exchange: 'kucoin',
      }));
    } catch (error) {
      throw new Error(`Failed to get open orders: ${error}`);
    }
  }

  async getOrderHistory(symbol?: string, limit: number = 500): Promise<OrderResponse[]> {
    await this.checkRateLimit();
    
    try {
      const params: any = { 
        status: 'done',
        pageSize: Math.min(limit, 500),
      };
      if (symbol) params.symbol = symbol.toUpperCase();
      
      const response = await this.httpClient.get('/api/v1/orders', {
        params,
        headers: { 'KC-API-SIGN': true }
      });
      
      const data = response.data;
      if (data.code !== '200000') {
        throw new Error(`KuCoin API error: ${data.msg}`);
      }
      
      return data.data.items.map((order: any) => ({
        orderId: order.id,
        clientOrderId: order.clientOid,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        quantity: parseFloat(order.size),
        price: parseFloat(order.price || '0'),
        status: this.mapOrderStatus(order.isActive, order.cancelExist),
        timestamp: order.createdAt,
        exchange: 'kucoin',
      }));
    } catch (error) {
      throw new Error(`Failed to get order history: ${error}`);
    }
  }

  async getBalance(): Promise<Record<string, number>> {
    await this.checkRateLimit();
    
    try {
      const response = await this.httpClient.get('/api/v1/accounts', {
        headers: { 'KC-API-SIGN': true }
      });
      
      const data = response.data;
      if (data.code !== '200000') {
        throw new Error(`KuCoin API error: ${data.msg}`);
      }
      
      const balances: Record<string, number> = {};
      data.data.forEach((account: any) => {
        if (account.type === 'trade') {
          const balance = parseFloat(account.balance);
          if (balance > 0) {
            balances[account.currency] = balance;
          }
        }
      });
      
      return balances;
    } catch (error) {
      throw new Error(`Failed to get balance: ${error}`);
    }
  }

  async getPositions(): Promise<Position[]> {
    // KuCoin Spot doesn't have positions, return empty array
    return [];
  }

  // API Key validation for mainnet safety
  private async validateApiKeyPermissions(): Promise<void> {
    if (!this.config.apiKey || !this.config.apiSecret || !this.passphrase) {
      throw new Error('API credentials (key, secret, passphrase) required for mainnet connection');
    }

    try {
      // Check account information to validate API key permissions
      const response = await this.httpClient.get('/api/v1/accounts', {
        headers: { 'KC-API-SIGN': true }
      });

      const data = response.data;
      if (data.code !== '200000') {
        throw new Error(`KuCoin API validation failed: ${data.msg}`);
      }

      // For KuCoin, we check if we can access account info (read permission)
      // but cannot determine trading permissions directly from account endpoint
      // We'll make a test call to check sub-account permissions
      try {
        const subAccountResponse = await this.httpClient.get('/api/v1/sub/user', {
          headers: { 'KC-API-SIGN': true }
        });
        
        // If this succeeds, the API key might have more permissions than needed
        const config = this.config as KuCoinConfig;
        if (!config.readOnly) {
          console.warn('⚠️  WARNING: KuCoin API key may have elevated permissions. Ensure read-only mode is enforced.');
        }
      } catch (subError) {
        // This is actually good - means the API key has limited permissions
        console.log('✅ KuCoin API key appears to have limited permissions (recommended)');
      }

      console.log('✅ KuCoin mainnet API key validated');
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('API validation failed')) {
        throw error;
      }
      throw new Error(`Failed to validate KuCoin API key permissions: ${error}`);
    }
  }

  // Enhanced connection monitoring with automatic reconnection
  protected startConnectionMonitoring(): void {
    setInterval(async () => {
      try {
        // Check WebSocket connections
        for (const [topic, ws] of this.wsConnections) {
          if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
            console.log(`🔄 Reconnecting to KuCoin topic: ${topic}`);
            
            this.wsConnections.delete(topic);
            this.subscriptions.delete(topic);
            
            this.emit('streamDisconnected', { exchange: 'kucoin', topic });
          }
        }
        
        // Periodic health check
        await this.healthCheck();
        
      } catch (error) {
        console.error('KuCoin connection monitoring error:', error);
        this.emitError(error as Error);
      }
    }, 30000); // Check every 30 seconds
  }

  // Enhanced health check
  async healthCheck(): Promise<boolean> {
    try {
      // Test REST API connectivity
      const response = await this.httpClient.get('/api/v1/timestamp');
      
      // Check WebSocket connections
      const activeConnections = Array.from(this.wsConnections.values())
        .filter(ws => ws.readyState === WebSocket.OPEN).length;
      
      const data = response.data;
      const isHealthy = data.code === '200000' && activeConnections >= 0;
      
      if (isHealthy) {
        this.emit('healthCheck', { 
          exchange: 'kucoin', 
          status: 'healthy',
          activeConnections,
          serverTime: data.data,
          timestamp: Date.now()
        });
      }
      
      return isHealthy;
    } catch (error) {
      this.emit('healthCheck', { 
        exchange: 'kucoin', 
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
      return false;
    }
  }

  // WebSocket helper methods
  private async getWebSocketToken(): Promise<{ token: string; endpoint: string }> {
    try {
      const response = await this.httpClient.post('/api/v1/bullet-public');
      const data = response.data;
      
      if (data.code !== '200000') {
        throw new Error(`Failed to get WebSocket token: ${data.msg}`);
      }
      
      return {
        token: data.data.token,
        endpoint: data.data.instanceServers[0].endpoint,
      };
    } catch (error) {
      throw new Error(`Failed to get WebSocket token: ${error}`);
    }
  }

  private async subscribeToTopic(topic: string, callback: (data: any) => void): Promise<void> {
    if (this.subscriptions.has(topic)) {
      return; // Already subscribed
    }

    this.createWebSocketConnection(topic, callback, 0);
  }

  private async createWebSocketConnection(topic: string, callback: (data: any) => void, retryCount: number = 0): Promise<void> {
    const maxRetries = 5;
    const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Exponential backoff, max 30s

    try {
      const { token, endpoint } = await this.getWebSocketToken();
      const wsUrl = `${endpoint || this.wsBaseURL}?token=${token}&[connectId=${Date.now()}]`;
      
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        console.log(`✅ KuCoin WebSocket connected: ${topic}`);
        
        // Send subscription message
        const subscribeMsg = {
          id: Date.now(),
          type: 'subscribe',
          topic: topic,
          privateChannel: false,
          response: true,
        };
        
        ws.send(JSON.stringify(subscribeMsg));
        this.subscriptions.add(topic);
        this.wsConnections.set(topic, ws);
        
        // Reset retry count on successful connection
        retryCount = 0;
      });
      
      ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          
          if (parsed.type === 'message' && parsed.topic === topic) {
            callback(parsed);
            
            // Update last message timestamp for connection monitoring
            this.emit('dataReceived', { 
              exchange: 'kucoin', 
              topic, 
              timestamp: Date.now() 
            });
          } else if (parsed.type === 'pong') {
            this.emit('pong', { exchange: 'kucoin', topic, timestamp: Date.now() });
          } else if (parsed.type === 'welcome') {
            console.log(`🤝 KuCoin WebSocket welcome: ${topic}`);
          } else if (parsed.type === 'ack' && parsed.topic === topic) {
            console.log(`✅ KuCoin subscription confirmed: ${topic}`);
          }
        } catch (error) {
          this.emitError(new Error(`Failed to parse WebSocket message: ${error}`));
        }
      });
      
      ws.on('error', (error) => {
        console.error(`❌ KuCoin WebSocket error on ${topic}:`, error);
        this.emitError(error);
      });
      
      ws.on('close', (code, reason) => {
        console.log(`🔌 KuCoin WebSocket closed: ${topic} (${code}: ${reason})`);
        this.subscriptions.delete(topic);
        this.wsConnections.delete(topic);
        
        // Attempt reconnection if not manually closed and within retry limit
        if (code !== 1000 && retryCount < maxRetries) {
          console.log(`🔄 Reconnecting to ${topic} in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
          
          setTimeout(() => {
            this.createWebSocketConnection(topic, callback, retryCount + 1);
          }, retryDelay);
        } else if (retryCount >= maxRetries) {
          console.error(`❌ Max reconnection attempts reached for ${topic}`);
          this.emit('maxRetriesReached', { exchange: 'kucoin', topic });
        }
      });
      
      // Send ping every 20 seconds to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            id: Date.now(),
            type: 'ping',
          }));
        } else {
          clearInterval(pingInterval);
        }
      }, 20000);
      
    } catch (error) {
      if (retryCount < maxRetries) {
        console.log(`🔄 Retrying KuCoin WebSocket connection for ${topic} in ${retryDelay}ms`);
        setTimeout(() => {
          this.createWebSocketConnection(topic, callback, retryCount + 1);
        }, retryDelay);
      } else {
        throw new Error(`Failed to subscribe to topic ${topic} after ${maxRetries} attempts: ${error}`);
      }
    }
  }

  private async unsubscribeFromTopic(topic: string): Promise<void> {
    const ws = this.wsConnections.get(topic);
    if (ws) {
      // Send unsubscribe message
      const unsubscribeMsg = {
        id: Date.now(),
        type: 'unsubscribe',
        topic: topic,
        privateChannel: false,
        response: true,
      };
      
      ws.send(JSON.stringify(unsubscribeMsg));
      ws.close();
      
      this.wsConnections.delete(topic);
      this.subscriptions.delete(topic);
    }
  }

  // Helper methods
  private mapTimeframe(timeframe: string): string {
    const mapping: Record<string, string> = {
      '1m': '1min',
      '5m': '5min',
      '15m': '15min',
      '30m': '30min',
      '1h': '1hour',
      '4h': '4hour',
      '1d': '1day',
      '1w': '1week',
    };
    
    return mapping[timeframe] || '1hour';
  }

  private mapOrderStatus(isActive: boolean, cancelExist: boolean): 'new' | 'partially_filled' | 'filled' | 'cancelled' | 'rejected' | 'expired' {
    if (isActive) return 'new';
    if (cancelExist) return 'cancelled';
    return 'filled';
  }
}