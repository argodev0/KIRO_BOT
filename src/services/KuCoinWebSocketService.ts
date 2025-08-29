/**
 * KuCoin WebSocket Service
 * Dedicated service for KuCoin WebSocket integration with automatic reconnection,
 * real-time market data streaming, connection pooling, and rate limit management
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import axios from 'axios';
import { logger } from '../utils/logger';
import { CandleData, TickerData, OrderBookData, TradeData, Timeframe } from '../types/market';

export interface KuCoinWebSocketConfig {
  baseURL?: string;
  wsBaseURL?: string;
  maxReconnectionAttempts?: number;
  reconnectionDelay?: number;
  pingInterval?: number;
  connectionTimeout?: number;
  enableHeartbeat?: boolean;
  majorTradingPairs?: string[];
  defaultTimeframes?: Timeframe[];
  maxConnectionsPerEndpoint?: number;
  connectionPoolSize?: number;
}

export interface KuCoinStreamData {
  id: string;
  type: string;
  topic: string;
  subject: string;
  data: any;
}

export interface KuCoinConnectionStats {
  totalConnections: number;
  healthyConnections: number;
  unhealthyConnections: number;
  subscriptionsByType: Record<string, number>;
  lastDataReceived: Record<string, number>;
  reconnectionAttempts: Record<string, number>;
  connectionPoolUtilization: number;
  rateLimitStatus: {
    tokensUsed: number;
    tokensRemaining: number;
    resetTime: number;
  };
}

export interface KuCoinWebSocketToken {
  token: string;
  endpoint: string;
  protocol: string;
  encrypt: boolean;
  pingInterval: number;
  pingTimeout: number;
}

export class KuCoinWebSocketService extends EventEmitter {
  private config: Required<KuCoinWebSocketConfig>;
  private connections: Map<string, WebSocket> = new Map();
  private connectionPool: WebSocket[] = [];
  private subscriptions: Set<string> = new Set();
  private streamCallbacks: Map<string, (data: any) => void> = new Map();
  private reconnectionAttempts: Map<string, number> = new Map();
  private lastDataReceived: Map<string, number> = new Map();
  private pingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private connectionMonitor?: NodeJS.Timeout;
  private tokenCache: { token: KuCoinWebSocketToken; expires: number } | null = null;
  private rateLimitTokens: number = 100;
  private rateLimitResetTime: number = 0;
  private isRunning: boolean = false;

  constructor(config: KuCoinWebSocketConfig = {}) {
    super();
    
    this.config = {
      baseURL: config.baseURL || 'https://api.kucoin.com',
      wsBaseURL: config.wsBaseURL || 'wss://ws-api-spot.kucoin.com',
      maxReconnectionAttempts: config.maxReconnectionAttempts || 10,
      reconnectionDelay: config.reconnectionDelay || 1000,
      pingInterval: config.pingInterval || 20000, // 20 seconds as per KuCoin docs
      connectionTimeout: config.connectionTimeout || 10000,
      enableHeartbeat: config.enableHeartbeat ?? true,
      majorTradingPairs: config.majorTradingPairs || [
        'BTC-USDT', 'ETH-USDT', 'BNB-USDT', 'ADA-USDT', 'XRP-USDT',
        'SOL-USDT', 'DOT-USDT', 'DOGE-USDT', 'AVAX-USDT', 'MATIC-USDT',
        'LINK-USDT', 'LTC-USDT', 'UNI-USDT', 'ATOM-USDT', 'ETC-USDT'
      ],
      defaultTimeframes: config.defaultTimeframes || ['1m', '5m', '15m', '1h'],
      maxConnectionsPerEndpoint: config.maxConnectionsPerEndpoint || 50,
      connectionPoolSize: config.connectionPoolSize || 10
    };
  }

  /**
   * Start the KuCoin WebSocket service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('KuCoinWebSocketService is already running');
      return;
    }

    try {
      logger.info('🚀 Starting KuCoin WebSocket Service...');
      
      // Initialize connection pool
      await this.initializeConnectionPool();
      
      // Start connection monitoring
      this.startConnectionMonitoring();
      
      // Initialize rate limiting
      this.initializeRateLimiting();
      
      this.isRunning = true;
      this.emit('started');
      
      logger.info('✅ KuCoin WebSocket Service started successfully');
    } catch (error) {
      logger.error('❌ Failed to start KuCoinWebSocketService:', error);
      throw error;
    }
  }

  /**
   * Stop the KuCoin WebSocket service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info('🛑 Stopping KuCoin WebSocket Service...');
      
      // Stop connection monitoring
      if (this.connectionMonitor) {
        clearInterval(this.connectionMonitor);
        this.connectionMonitor = undefined;
      }
      
      // Close all connections
      await this.disconnectAll();
      
      // Clear connection pool
      await this.clearConnectionPool();
      
      this.isRunning = false;
      this.emit('stopped');
      
      logger.info('✅ KuCoin WebSocket Service stopped');
    } catch (error) {
      logger.error('❌ Error stopping KuCoinWebSocketService:', error);
      throw error;
    }
  }

  /**
   * Subscribe to ticker data for a symbol
   */
  async subscribeToTicker(symbol: string): Promise<void> {
    const topic = `/market/ticker:${this.normalizeSymbol(symbol)}`;
    
    await this.subscribeToStream(topic, (data) => {
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
      
      this.emit('ticker', ticker);
      this.emit('data', { type: 'ticker', symbol, data: ticker });
    });
  }

  /**
   * Subscribe to order book data for a symbol
   */
  async subscribeToOrderBook(symbol: string, levels: number = 20): Promise<void> {
    const topic = `/market/level2:${this.normalizeSymbol(symbol)}`;
    
    await this.subscribeToStream(topic, (data) => {
      const orderBook: OrderBookData = {
        symbol: data.subject,
        exchange: 'kucoin',
        timestamp: data.data.time,
        bids: data.data.bids?.slice(0, levels).map((bid: string[]) => [parseFloat(bid[0]), parseFloat(bid[1])]) || [],
        asks: data.data.asks?.slice(0, levels).map((ask: string[]) => [parseFloat(ask[0]), parseFloat(ask[1])]) || [],
      };
      
      this.emit('orderbook', orderBook);
      this.emit('data', { type: 'orderbook', symbol, data: orderBook });
    });
  }

  /**
   * Subscribe to trade data for a symbol
   */
  async subscribeToTrades(symbol: string): Promise<void> {
    const topic = `/market/match:${this.normalizeSymbol(symbol)}`;
    
    await this.subscribeToStream(topic, (data) => {
      const trade: TradeData = {
        symbol: data.subject,
        exchange: 'kucoin',
        timestamp: parseInt(data.data.time),
        price: parseFloat(data.data.price),
        quantity: parseFloat(data.data.size),
        side: data.data.side,
        tradeId: data.data.tradeId,
      };
      
      this.emit('trade', trade);
      this.emit('data', { type: 'trade', symbol, data: trade });
    });
  }

  /**
   * Subscribe to candle data for a symbol and timeframe
   */
  async subscribeToCandles(symbol: string, timeframe: Timeframe): Promise<void> {
    const interval = this.mapTimeframe(timeframe);
    const topic = `/market/candles:${this.normalizeSymbol(symbol)}_${interval}`;
    
    await this.subscribeToStream(topic, (data) => {
      const candle: CandleData = {
        symbol: data.subject.split('_')[0],
        timeframe,
        timestamp: parseInt(data.data.time) * 1000,
        open: parseFloat(data.data.open),
        high: parseFloat(data.data.high),
        low: parseFloat(data.data.low),
        close: parseFloat(data.data.close),
        volume: parseFloat(data.data.volume),
        exchange: 'kucoin',
      };
      
      this.emit('candle', candle);
      this.emit('data', { type: 'candle', symbol, timeframe, data: candle });
    });
  }

  /**
   * Subscribe to all major trading pairs with complete data
   */
  async subscribeToMajorTradingPairs(): Promise<void> {
    logger.info(`🚀 Subscribing to ${this.config.majorTradingPairs.length} major trading pairs on KuCoin...`);
    
    const subscriptionPromises: Promise<void>[] = [];
    
    for (const symbol of this.config.majorTradingPairs) {
      // Subscribe to all data types for each major pair
      subscriptionPromises.push(
        this.subscribeToTicker(symbol),
        this.subscribeToOrderBook(symbol),
        this.subscribeToTrades(symbol)
      );
      
      // Subscribe to candles for each timeframe
      for (const timeframe of this.config.defaultTimeframes) {
        subscriptionPromises.push(this.subscribeToCandles(symbol, timeframe));
      }
    }
    
    try {
      await Promise.all(subscriptionPromises);
      
      const totalSubscriptions = this.config.majorTradingPairs.length * (3 + this.config.defaultTimeframes.length);
      logger.info(`✅ Successfully subscribed to ${totalSubscriptions} KuCoin streams for major trading pairs`);
      
      this.emit('majorPairsSubscribed', {
        pairs: this.config.majorTradingPairs,
        timeframes: this.config.defaultTimeframes,
        totalSubscriptions,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('❌ Failed to subscribe to KuCoin major trading pairs:', error);
      throw error;
    }
  }

  /**
   * Subscribe to a specific symbol with all data types
   */
  async subscribeToSymbolComplete(symbol: string, timeframes?: Timeframe[]): Promise<void> {
    const targetTimeframes = timeframes || this.config.defaultTimeframes;
    
    logger.info(`📊 Subscribing to complete KuCoin data for ${symbol}...`);
    
    try {
      await Promise.all([
        this.subscribeToTicker(symbol),
        this.subscribeToOrderBook(symbol),
        this.subscribeToTrades(symbol),
        ...targetTimeframes.map(tf => this.subscribeToCandles(symbol, tf))
      ]);
      
      logger.info(`✅ Complete KuCoin subscription for ${symbol} successful`);
      
      this.emit('symbolSubscribed', {
        symbol,
        timeframes: targetTimeframes,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error(`❌ Failed to complete KuCoin subscription for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe from a stream
   */
  async unsubscribe(topic: string): Promise<void> {
    const connection = this.connections.get(topic);
    if (connection) {
      // Send unsubscribe message
      const unsubscribeMsg = {
        id: Date.now(),
        type: 'unsubscribe',
        topic: topic,
        privateChannel: false,
        response: true,
      };
      
      connection.send(JSON.stringify(unsubscribeMsg));
      connection.close(1000, 'Unsubscribe requested');
      this.cleanupStream(topic);
      logger.info(`🔌 Unsubscribed from KuCoin topic: ${topic}`);
    }
  }

  /**
   * Unsubscribe from all streams for a symbol
   */
  async unsubscribeFromSymbol(symbol: string): Promise<void> {
    const normalizedSymbol = this.normalizeSymbol(symbol);
    const symbolStreams = Array.from(this.subscriptions).filter(topic => 
      topic.includes(normalizedSymbol)
    );
    
    const unsubscribePromises = symbolStreams.map(topic => this.unsubscribe(topic));
    await Promise.all(unsubscribePromises);
    
    logger.info(`🔌 Unsubscribed from all KuCoin streams for ${symbol}`);
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): KuCoinConnectionStats {
    const subscriptionsByType: Record<string, number> = {
      ticker: 0,
      level2: 0,
      match: 0,
      candles: 0,
      other: 0
    };
    
    let healthyConnections = 0;
    let unhealthyConnections = 0;
    
    for (const [topic, ws] of this.connections) {
      // Count by type
      if (topic.includes('/market/ticker:')) subscriptionsByType.ticker++;
      else if (topic.includes('/market/level2:')) subscriptionsByType.level2++;
      else if (topic.includes('/market/match:')) subscriptionsByType.match++;
      else if (topic.includes('/market/candles:')) subscriptionsByType.candles++;
      else subscriptionsByType.other++;
      
      // Count health
      if (ws.readyState === WebSocket.OPEN) {
        healthyConnections++;
      } else {
        unhealthyConnections++;
      }
    }
    
    const lastDataReceived: Record<string, number> = {};
    const reconnectionAttempts: Record<string, number> = {};
    
    for (const [topic, timestamp] of this.lastDataReceived) {
      lastDataReceived[topic] = timestamp;
    }
    
    for (const [topic, attempts] of this.reconnectionAttempts) {
      reconnectionAttempts[topic] = attempts;
    }
    
    return {
      totalConnections: this.connections.size,
      healthyConnections,
      unhealthyConnections,
      subscriptionsByType,
      lastDataReceived,
      reconnectionAttempts,
      connectionPoolUtilization: this.connectionPool.length / this.config.connectionPoolSize,
      rateLimitStatus: {
        tokensUsed: 100 - this.rateLimitTokens,
        tokensRemaining: this.rateLimitTokens,
        resetTime: this.rateLimitResetTime
      }
    };
  }

  /**
   * Check if service is healthy
   */
  isHealthy(): boolean {
    if (!this.isRunning) {
      return false;
    }
    
    const stats = this.getConnectionStats();
    
    // If no connections, service is healthy if running (ready to accept connections)
    if (stats.totalConnections === 0) {
      return true;
    }
    
    // If there are connections, 80% should be healthy
    const healthyRatio = stats.healthyConnections / stats.totalConnections;
    return healthyRatio >= 0.8 && this.rateLimitTokens > 10; // Also check rate limit
  }

  // Private methods

  private async initializeConnectionPool(): Promise<void> {
    logger.info(`🔗 Initializing KuCoin connection pool with ${this.config.connectionPoolSize} connections...`);
    
    const poolPromises: Promise<void>[] = [];
    
    for (let i = 0; i < this.config.connectionPoolSize; i++) {
      poolPromises.push(this.createPoolConnection());
    }
    
    await Promise.all(poolPromises);
    logger.info(`✅ KuCoin connection pool initialized with ${this.connectionPool.length} connections`);
  }

  private async createPoolConnection(): Promise<void> {
    try {
      const tokenData = await this.getWebSocketToken();
      const wsUrl = `${tokenData.endpoint}?token=${tokenData.token}&[connectId=${Date.now()}]`;
      
      const ws = new WebSocket(wsUrl);
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.terminate();
          reject(new Error('Pool connection timeout'));
        }, this.config.connectionTimeout);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          this.connectionPool.push(ws);
          resolve();
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
        
        ws.on('close', () => {
          // Remove from pool
          const index = this.connectionPool.indexOf(ws);
          if (index > -1) {
            this.connectionPool.splice(index, 1);
          }
        });
      });
    } catch (error) {
      logger.error('❌ Failed to create pool connection:', error);
      throw error;
    }
  }

  private async clearConnectionPool(): Promise<void> {
    const closePromises = this.connectionPool.map(ws => {
      return new Promise<void>((resolve) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Service shutdown');
          ws.once('close', () => resolve());
          setTimeout(() => resolve(), 5000); // Timeout
        } else {
          resolve();
        }
      });
    });
    
    await Promise.all(closePromises);
    this.connectionPool.length = 0;
  }

  private initializeRateLimiting(): void {
    // KuCoin allows 100 connections per 10 seconds
    this.rateLimitTokens = 100;
    this.rateLimitResetTime = Date.now() + 10000;
    
    // Reset rate limit tokens every 10 seconds
    setInterval(() => {
      this.rateLimitTokens = 100;
      this.rateLimitResetTime = Date.now() + 10000;
    }, 10000);
  }

  private async checkRateLimit(): Promise<void> {
    if (this.rateLimitTokens <= 0) {
      const waitTime = this.rateLimitResetTime - Date.now();
      if (waitTime > 0) {
        logger.warn(`⏳ KuCoin rate limit hit, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    this.rateLimitTokens--;
  }

  private async getWebSocketToken(): Promise<KuCoinWebSocketToken> {
    // Check cache first
    if (this.tokenCache && this.tokenCache.expires > Date.now()) {
      return this.tokenCache.token;
    }
    
    try {
      const response = await axios.post(`${this.config.baseURL}/api/v1/bullet-public`);
      const data = response.data;
      
      if (data.code !== '200000') {
        throw new Error(`Failed to get KuCoin WebSocket token: ${data.msg}`);
      }
      
      const tokenData: KuCoinWebSocketToken = {
        token: data.data.token,
        endpoint: data.data.instanceServers[0].endpoint,
        protocol: data.data.instanceServers[0].protocol,
        encrypt: data.data.instanceServers[0].encrypt,
        pingInterval: data.data.instanceServers[0].pingInterval,
        pingTimeout: data.data.instanceServers[0].pingTimeout,
      };
      
      // Cache token for 23 hours (tokens expire in 24 hours)
      this.tokenCache = {
        token: tokenData,
        expires: Date.now() + (23 * 60 * 60 * 1000)
      };
      
      return tokenData;
    } catch (error) {
      throw new Error(`Failed to get KuCoin WebSocket token: ${error}`);
    }
  }

  private async subscribeToStream(topic: string, callback: (data: any) => void): Promise<void> {
    if (this.subscriptions.has(topic)) {
      logger.warn(`⚠️  Already subscribed to KuCoin topic: ${topic}`);
      return;
    }

    // Check rate limit
    await this.checkRateLimit();
    
    // Store callback for reconnection
    this.streamCallbacks.set(topic, callback);
    
    await this.createConnection(topic, callback);
  }

  private async createConnection(topic: string, callback: (data: any) => void): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const tokenData = await this.getWebSocketToken();
        const wsUrl = `${tokenData.endpoint}?token=${tokenData.token}&[connectId=${Date.now()}]`;
        
        logger.debug(`🔗 Connecting to KuCoin: ${topic}`);
        
        const ws = new WebSocket(wsUrl);
        let connectionTimeout: NodeJS.Timeout;
        
        // Set connection timeout
        connectionTimeout = setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING) {
            ws.terminate();
            reject(new Error(`KuCoin connection timeout for topic: ${topic}`));
          }
        }, this.config.connectionTimeout);
        
        ws.on('open', () => {
          clearTimeout(connectionTimeout);
          logger.info(`✅ Connected to KuCoin topic: ${topic}`);
          
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
          this.connections.set(topic, ws);
          this.reconnectionAttempts.delete(topic); // Reset attempts on successful connection
          
          // Start heartbeat if enabled
          if (this.config.enableHeartbeat) {
            this.startHeartbeat(topic, ws, tokenData.pingInterval);
          }
          
          this.emit('streamConnected', { topic, timestamp: Date.now() });
          resolve();
        });
        
        ws.on('message', (data) => {
          try {
            const parsed = JSON.parse(data.toString());
            
            if (parsed.type === 'message' && parsed.topic === topic) {
              callback(parsed);
              this.lastDataReceived.set(topic, Date.now());
              
              this.emit('dataReceived', {
                topic,
                dataType: this.getDataTypeFromTopic(topic),
                timestamp: Date.now()
              });
            } else if (parsed.type === 'pong') {
              this.emit('heartbeat', { topic, timestamp: Date.now() });
            } else if (parsed.type === 'welcome') {
              logger.debug(`🤝 KuCoin WebSocket welcome: ${topic}`);
            } else if (parsed.type === 'ack' && parsed.topic === topic) {
              logger.debug(`✅ KuCoin subscription confirmed: ${topic}`);
            }
          } catch (error) {
            logger.error(`❌ Failed to parse KuCoin message from ${topic}:`, error);
            this.emit('parseError', { topic, error: (error as Error).message });
          }
        });
        
        ws.on('error', (error) => {
          clearTimeout(connectionTimeout);
          logger.error(`❌ KuCoin WebSocket error on ${topic}:`, error);
          
          this.emit('streamError', {
            topic,
            error: error.message,
            timestamp: Date.now()
          });
          
          reject(error);
        });
        
        ws.on('close', (code, reason) => {
          clearTimeout(connectionTimeout);
          this.cleanupStream(topic);
          
          const reasonStr = reason?.toString() || 'Unknown';
          logger.info(`🔌 KuCoin stream closed: ${topic} (${code}: ${reasonStr})`);
          
          this.emit('streamDisconnected', {
            topic,
            code,
            reason: reasonStr,
            timestamp: Date.now()
          });
          
          // Schedule reconnection if not a normal closure
          if (code !== 1000 && this.isRunning) {
            this.scheduleReconnection(topic);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private scheduleReconnection(topic: string): void {
    const attempts = this.reconnectionAttempts.get(topic) || 0;
    
    if (attempts >= this.config.maxReconnectionAttempts) {
      logger.error(`❌ Max reconnection attempts reached for KuCoin topic: ${topic}`);
      this.emit('maxReconnectionAttemptsReached', { topic });
      this.cleanupStream(topic, true);
      return;
    }
    
    const delay = this.config.reconnectionDelay * Math.pow(2, attempts);
    const maxDelay = 30000; // Max 30 seconds
    const actualDelay = Math.min(delay, maxDelay);
    
    logger.info(`🔄 Scheduling KuCoin reconnection for ${topic} in ${actualDelay}ms (attempt ${attempts + 1}/${this.config.maxReconnectionAttempts})`);
    
    this.reconnectionAttempts.set(topic, attempts + 1);
    
    setTimeout(async () => {
      if (this.isRunning && this.streamCallbacks.has(topic)) {
        try {
          const callback = this.streamCallbacks.get(topic)!;
          await this.createConnection(topic, callback);
          logger.info(`✅ Successfully reconnected to KuCoin ${topic}`);
          this.emit('streamReconnected', { topic, attempts: attempts + 1 });
        } catch (error) {
          logger.error(`❌ Failed to reconnect to KuCoin ${topic}:`, error);
          // Will be retried in next cycle if within limits
        }
      }
    }, actualDelay);
  }

  private startHeartbeat(topic: string, ws: WebSocket, pingInterval: number): void {
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          id: Date.now(),
          type: 'ping',
        }));
      } else {
        clearInterval(interval);
        this.pingIntervals.delete(topic);
      }
    }, pingInterval || this.config.pingInterval);
    
    this.pingIntervals.set(topic, interval);
  }

  private cleanupStream(topic: string, removeCallback: boolean = false): void {
    this.connections.delete(topic);
    this.subscriptions.delete(topic);
    this.lastDataReceived.delete(topic);
    
    // Clear ping interval
    const pingInterval = this.pingIntervals.get(topic);
    if (pingInterval) {
      clearInterval(pingInterval);
      this.pingIntervals.delete(topic);
    }
    
    if (removeCallback) {
      this.streamCallbacks.delete(topic);
      this.reconnectionAttempts.delete(topic);
    }
  }

  private async disconnectAll(): Promise<void> {
    const disconnectPromises: Promise<void>[] = [];
    
    for (const [topic, ws] of this.connections) {
      disconnectPromises.push(
        new Promise<void>((resolve) => {
          if (ws.readyState === WebSocket.OPEN) {
            // Send unsubscribe message
            const unsubscribeMsg = {
              id: Date.now(),
              type: 'unsubscribe',
              topic: topic,
              privateChannel: false,
              response: true,
            };
            
            ws.send(JSON.stringify(unsubscribeMsg));
            ws.close(1000, 'Service shutdown');
            ws.once('close', () => resolve());
            setTimeout(() => resolve(), 5000); // Timeout
          } else {
            resolve();
          }
        })
      );
    }
    
    await Promise.all(disconnectPromises);
    
    // Clear all data structures
    this.connections.clear();
    this.subscriptions.clear();
    this.streamCallbacks.clear();
    this.reconnectionAttempts.clear();
    this.lastDataReceived.clear();
    
    // Clear all intervals
    for (const interval of this.pingIntervals.values()) {
      clearInterval(interval);
    }
    this.pingIntervals.clear();
  }

  private startConnectionMonitoring(): void {
    this.connectionMonitor = setInterval(() => {
      this.monitorConnections();
    }, 30000); // Check every 30 seconds
  }

  private monitorConnections(): void {
    const now = Date.now();
    const staleThreshold = 120000; // 2 minutes
    
    // Check for stale connections
    for (const [topic, timestamp] of this.lastDataReceived) {
      const age = now - timestamp;
      if (age > staleThreshold) {
        logger.warn(`⚠️  Stale KuCoin data detected for ${topic}: ${Math.round(age / 1000)}s old`);
        this.emit('staleData', { topic, age });
      }
    }
    
    // Check connection health
    const stats = this.getConnectionStats();
    this.emit('healthCheck', {
      isHealthy: this.isHealthy(),
      stats,
      timestamp: now
    });
    
    // Maintain connection pool
    this.maintainConnectionPool();
  }

  private async maintainConnectionPool(): Promise<void> {
    const targetSize = this.config.connectionPoolSize;
    const currentSize = this.connectionPool.length;
    
    if (currentSize < targetSize) {
      const needed = targetSize - currentSize;
      logger.debug(`🔧 Maintaining KuCoin connection pool: adding ${needed} connections`);
      
      const addPromises: Promise<void>[] = [];
      for (let i = 0; i < needed; i++) {
        addPromises.push(this.createPoolConnection().catch(error => {
          logger.error('❌ Failed to add pool connection:', error);
        }));
      }
      
      await Promise.all(addPromises);
    }
  }

  private normalizeSymbol(symbol: string): string {
    // Convert from Binance format (BTCUSDT) to KuCoin format (BTC-USDT)
    if (!symbol.includes('-') && symbol.length > 3) {
      // Try to split common pairs
      const commonQuotes = ['USDT', 'USDC', 'BTC', 'ETH', 'BNB'];
      for (const quote of commonQuotes) {
        if (symbol.endsWith(quote)) {
          const base = symbol.slice(0, -quote.length);
          return `${base}-${quote}`;
        }
      }
    }
    
    return symbol.toUpperCase();
  }

  private mapTimeframe(timeframe: Timeframe): string {
    const mapping: Record<Timeframe, string> = {
      '1m': '1min',
      '5m': '5min',
      '15m': '15min',
      '30m': '30min',
      '1h': '1hour',
      '4h': '4hour',
      '1d': '1day',
      '1w': '1week',
      '1M': '1month',
    };
    
    return mapping[timeframe] || '1hour';
  }

  private getDataTypeFromTopic(topic: string): string {
    if (topic.includes('/market/ticker:')) return 'ticker';
    if (topic.includes('/market/level2:')) return 'orderbook';
    if (topic.includes('/market/match:')) return 'trade';
    if (topic.includes('/market/candles:')) return 'candle';
    return 'unknown';
  }
}