/**
 * Binance WebSocket Service
 * Dedicated service for Binance WebSocket integration with automatic reconnection,
 * real-time price data subscription, error handling, and data normalization
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { CandleData, TickerData, OrderBookData, TradeData, Timeframe } from '../types/market';

export interface BinanceWebSocketConfig {
  baseURL?: string;
  maxReconnectionAttempts?: number;
  reconnectionDelay?: number;
  pingInterval?: number;
  connectionTimeout?: number;
  enableHeartbeat?: boolean;
  majorTradingPairs?: string[];
  defaultTimeframes?: Timeframe[];
}

export interface BinanceStreamData {
  stream: string;
  data: any;
}

export interface ConnectionStats {
  totalConnections: number;
  healthyConnections: number;
  unhealthyConnections: number;
  subscriptionsByType: Record<string, number>;
  lastDataReceived: Record<string, number>;
  reconnectionAttempts: Record<string, number>;
}

export class BinanceWebSocketService extends EventEmitter {
  private config: Required<BinanceWebSocketConfig>;
  private connections: Map<string, WebSocket> = new Map();
  private subscriptions: Set<string> = new Set();
  private streamCallbacks: Map<string, (data: any) => void> = new Map();
  private reconnectionAttempts: Map<string, number> = new Map();
  private lastDataReceived: Map<string, number> = new Map();
  private pingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private connectionMonitor?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(config: BinanceWebSocketConfig = {}) {
    super();
    
    this.config = {
      baseURL: config.baseURL || 'wss://stream.binance.com:9443/ws',
      maxReconnectionAttempts: config.maxReconnectionAttempts || 10,
      reconnectionDelay: config.reconnectionDelay || 1000,
      pingInterval: config.pingInterval || 180000, // 3 minutes
      connectionTimeout: config.connectionTimeout || 10000, // 10 seconds
      enableHeartbeat: config.enableHeartbeat ?? true,
      majorTradingPairs: config.majorTradingPairs || [
        'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT',
        'SOLUSDT', 'DOTUSDT', 'DOGEUSDT', 'AVAXUSDT', 'MATICUSDT',
        'LINKUSDT', 'LTCUSDT', 'UNIUSDT', 'ATOMUSDT', 'ETCUSDT'
      ],
      defaultTimeframes: config.defaultTimeframes || ['1m', '5m', '15m', '1h']
    };
  }

  /**
   * Start the WebSocket service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('BinanceWebSocketService is already running');
      return;
    }

    try {
      logger.info('🚀 Starting Binance WebSocket Service...');
      
      // Start connection monitoring
      this.startConnectionMonitoring();
      
      this.isRunning = true;
      this.emit('started');
      
      logger.info('✅ Binance WebSocket Service started successfully');
    } catch (error) {
      logger.error('❌ Failed to start BinanceWebSocketService:', error);
      throw error;
    }
  }

  /**
   * Stop the WebSocket service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info('🛑 Stopping Binance WebSocket Service...');
      
      // Stop connection monitoring
      if (this.connectionMonitor) {
        clearInterval(this.connectionMonitor);
        this.connectionMonitor = undefined;
      }
      
      // Close all connections
      await this.disconnectAll();
      
      this.isRunning = false;
      this.emit('stopped');
      
      logger.info('✅ Binance WebSocket Service stopped');
    } catch (error) {
      logger.error('❌ Error stopping BinanceWebSocketService:', error);
      throw error;
    }
  }

  /**
   * Subscribe to ticker data for a symbol
   */
  async subscribeToTicker(symbol: string): Promise<void> {
    const stream = `${symbol.toLowerCase()}@ticker`;
    
    await this.subscribeToStream(stream, (data) => {
      const ticker: TickerData = {
        symbol: data.s,
        exchange: 'binance',
        price: data.c,
        volume: data.v,
        timestamp: data.E,
        bid: data.b,
        ask: data.a,
        change24h: data.P,
        changePercent24h: data.p,
      };
      
      this.emit('ticker', ticker);
      this.emit('data', { type: 'ticker', symbol, data: ticker });
    });
  }

  /**
   * Subscribe to order book data for a symbol
   */
  async subscribeToOrderBook(symbol: string, levels: number = 20): Promise<void> {
    const stream = `${symbol.toLowerCase()}@depth${levels}`;
    
    await this.subscribeToStream(stream, (data) => {
      const orderBook: OrderBookData = {
        symbol: data.s,
        exchange: 'binance',
        timestamp: data.E,
        bids: data.b,
        asks: data.a,
      };
      
      this.emit('orderbook', orderBook);
      this.emit('data', { type: 'orderbook', symbol, data: orderBook });
    });
  }

  /**
   * Subscribe to trade data for a symbol
   */
  async subscribeToTrades(symbol: string): Promise<void> {
    const stream = `${symbol.toLowerCase()}@trade`;
    
    await this.subscribeToStream(stream, (data) => {
      const trade: TradeData = {
        symbol: data.s,
        exchange: 'binance',
        timestamp: data.T,
        price: data.p,
        quantity: data.q,
        side: data.m ? 'sell' : 'buy',
        tradeId: data.t.toString(),
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
    const stream = `${symbol.toLowerCase()}@kline_${interval}`;
    
    await this.subscribeToStream(stream, (data) => {
      const kline = data.k;
      const candle: CandleData = {
        symbol: kline.s,
        timeframe,
        timestamp: kline.t,
        open: kline.o,
        high: kline.h,
        low: kline.l,
        close: kline.c,
        volume: kline.v,
        exchange: 'binance',
      };
      
      this.emit('candle', candle);
      this.emit('data', { type: 'candle', symbol, timeframe, data: candle });
    });
  }

  /**
   * Subscribe to all major trading pairs with complete data
   */
  async subscribeToMajorTradingPairs(): Promise<void> {
    logger.info(`🚀 Subscribing to ${this.config.majorTradingPairs.length} major trading pairs...`);
    
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
      logger.info(`✅ Successfully subscribed to ${totalSubscriptions} streams for major trading pairs`);
      
      this.emit('majorPairsSubscribed', {
        pairs: this.config.majorTradingPairs,
        timeframes: this.config.defaultTimeframes,
        totalSubscriptions,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('❌ Failed to subscribe to major trading pairs:', error);
      throw error;
    }
  }

  /**
   * Subscribe to a specific symbol with all data types
   */
  async subscribeToSymbolComplete(symbol: string, timeframes?: Timeframe[]): Promise<void> {
    const targetTimeframes = timeframes || this.config.defaultTimeframes;
    
    logger.info(`📊 Subscribing to complete data for ${symbol}...`);
    
    try {
      await Promise.all([
        this.subscribeToTicker(symbol),
        this.subscribeToOrderBook(symbol),
        this.subscribeToTrades(symbol),
        ...targetTimeframes.map(tf => this.subscribeToCandles(symbol, tf))
      ]);
      
      logger.info(`✅ Complete subscription for ${symbol} successful`);
      
      this.emit('symbolSubscribed', {
        symbol,
        timeframes: targetTimeframes,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error(`❌ Failed to complete subscription for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe from a stream
   */
  async unsubscribe(stream: string): Promise<void> {
    const connection = this.connections.get(stream);
    if (connection) {
      connection.close(1000, 'Unsubscribe requested');
      this.cleanupStream(stream);
      logger.info(`🔌 Unsubscribed from stream: ${stream}`);
    }
  }

  /**
   * Unsubscribe from all streams for a symbol
   */
  async unsubscribeFromSymbol(symbol: string): Promise<void> {
    const symbolStreams = Array.from(this.subscriptions).filter(stream => 
      stream.includes(symbol.toLowerCase())
    );
    
    const unsubscribePromises = symbolStreams.map(stream => this.unsubscribe(stream));
    await Promise.all(unsubscribePromises);
    
    logger.info(`🔌 Unsubscribed from all streams for ${symbol}`);
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): ConnectionStats {
    const subscriptionsByType: Record<string, number> = {
      ticker: 0,
      depth: 0,
      trade: 0,
      kline: 0,
      other: 0
    };
    
    let healthyConnections = 0;
    let unhealthyConnections = 0;
    
    for (const [stream, ws] of this.connections) {
      // Count by type
      if (stream.includes('@ticker')) subscriptionsByType.ticker++;
      else if (stream.includes('@depth')) subscriptionsByType.depth++;
      else if (stream.includes('@trade')) subscriptionsByType.trade++;
      else if (stream.includes('@kline')) subscriptionsByType.kline++;
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
    
    for (const [stream, timestamp] of this.lastDataReceived) {
      lastDataReceived[stream] = timestamp;
    }
    
    for (const [stream, attempts] of this.reconnectionAttempts) {
      reconnectionAttempts[stream] = attempts;
    }
    
    return {
      totalConnections: this.connections.size,
      healthyConnections,
      unhealthyConnections,
      subscriptionsByType,
      lastDataReceived,
      reconnectionAttempts
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
    return healthyRatio >= 0.8;
  }

  // Private methods

  private async subscribeToStream(stream: string, callback: (data: any) => void): Promise<void> {
    if (this.subscriptions.has(stream)) {
      logger.warn(`⚠️  Already subscribed to stream: ${stream}`);
      return;
    }

    // Store callback for reconnection
    this.streamCallbacks.set(stream, callback);
    
    await this.createConnection(stream, callback);
  }

  private async createConnection(stream: string, callback: (data: any) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.config.baseURL}/${stream}`;
      logger.debug(`🔗 Connecting to: ${wsUrl}`);
      
      const ws = new WebSocket(wsUrl);
      let connectionTimeout: NodeJS.Timeout;
      
      // Set connection timeout
      connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.terminate();
          reject(new Error(`Connection timeout for stream: ${stream}`));
        }
      }, this.config.connectionTimeout);
      
      ws.on('open', () => {
        clearTimeout(connectionTimeout);
        logger.info(`✅ Connected to stream: ${stream}`);
        
        this.subscriptions.add(stream);
        this.connections.set(stream, ws);
        this.reconnectionAttempts.delete(stream); // Reset attempts on successful connection
        
        // Start heartbeat if enabled
        if (this.config.enableHeartbeat) {
          this.startHeartbeat(stream, ws);
        }
        
        this.emit('streamConnected', { stream, timestamp: Date.now() });
        resolve();
      });
      
      ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          const normalizedData = this.normalizeData(parsed, stream);
          
          if (normalizedData) {
            callback(normalizedData);
            this.lastDataReceived.set(stream, Date.now());
            
            this.emit('dataReceived', {
              stream,
              dataType: this.getDataTypeFromStream(stream),
              timestamp: Date.now()
            });
          }
        } catch (error) {
          logger.error(`❌ Failed to parse message from ${stream}:`, error);
          this.emit('parseError', { stream, error: (error as Error).message });
        }
      });
      
      ws.on('pong', () => {
        this.emit('heartbeat', { stream, timestamp: Date.now() });
      });
      
      ws.on('error', (error) => {
        clearTimeout(connectionTimeout);
        logger.error(`❌ WebSocket error on ${stream}:`, error);
        
        this.emit('streamError', {
          stream,
          error: error.message,
          timestamp: Date.now()
        });
        
        reject(error);
      });
      
      ws.on('close', (code, reason) => {
        clearTimeout(connectionTimeout);
        this.cleanupStream(stream);
        
        const reasonStr = reason?.toString() || 'Unknown';
        logger.info(`🔌 Stream closed: ${stream} (${code}: ${reasonStr})`);
        
        this.emit('streamDisconnected', {
          stream,
          code,
          reason: reasonStr,
          timestamp: Date.now()
        });
        
        // Schedule reconnection if not a normal closure
        if (code !== 1000 && this.isRunning) {
          this.scheduleReconnection(stream);
        }
      });
    });
  }

  private scheduleReconnection(stream: string): void {
    const attempts = this.reconnectionAttempts.get(stream) || 0;
    
    if (attempts >= this.config.maxReconnectionAttempts) {
      logger.error(`❌ Max reconnection attempts reached for stream: ${stream}`);
      this.emit('maxReconnectionAttemptsReached', { stream });
      this.cleanupStream(stream, true);
      return;
    }
    
    const delay = this.config.reconnectionDelay * Math.pow(2, attempts);
    const maxDelay = 30000; // Max 30 seconds
    const actualDelay = Math.min(delay, maxDelay);
    
    logger.info(`🔄 Scheduling reconnection for ${stream} in ${actualDelay}ms (attempt ${attempts + 1}/${this.config.maxReconnectionAttempts})`);
    
    this.reconnectionAttempts.set(stream, attempts + 1);
    
    setTimeout(async () => {
      if (this.isRunning && this.streamCallbacks.has(stream)) {
        try {
          const callback = this.streamCallbacks.get(stream)!;
          await this.createConnection(stream, callback);
          logger.info(`✅ Successfully reconnected to ${stream}`);
          this.emit('streamReconnected', { stream, attempts: attempts + 1 });
        } catch (error) {
          logger.error(`❌ Failed to reconnect to ${stream}:`, error);
          // Will be retried in next cycle if within limits
        }
      }
    }, actualDelay);
  }

  private startHeartbeat(stream: string, ws: WebSocket): void {
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(interval);
        this.pingIntervals.delete(stream);
      }
    }, this.config.pingInterval);
    
    this.pingIntervals.set(stream, interval);
  }

  private cleanupStream(stream: string, removeCallback: boolean = false): void {
    this.connections.delete(stream);
    this.subscriptions.delete(stream);
    this.lastDataReceived.delete(stream);
    
    // Clear ping interval
    const pingInterval = this.pingIntervals.get(stream);
    if (pingInterval) {
      clearInterval(pingInterval);
      this.pingIntervals.delete(stream);
    }
    
    if (removeCallback) {
      this.streamCallbacks.delete(stream);
      this.reconnectionAttempts.delete(stream);
    }
  }

  private async disconnectAll(): Promise<void> {
    const disconnectPromises: Promise<void>[] = [];
    
    for (const [stream, ws] of this.connections) {
      disconnectPromises.push(
        new Promise<void>((resolve) => {
          if (ws.readyState === WebSocket.OPEN) {
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
    for (const [stream, timestamp] of this.lastDataReceived) {
      const age = now - timestamp;
      if (age > staleThreshold) {
        logger.warn(`⚠️  Stale data detected for ${stream}: ${Math.round(age / 1000)}s old`);
        this.emit('staleData', { stream, age });
      }
    }
    
    // Check connection health
    const stats = this.getConnectionStats();
    this.emit('healthCheck', {
      isHealthy: this.isHealthy(),
      stats,
      timestamp: now
    });
  }

  private normalizeData(data: any, stream: string): any {
    try {
      if (stream.includes('@ticker')) {
        return this.normalizeTickerData(data);
      } else if (stream.includes('@depth')) {
        return this.normalizeDepthData(data);
      } else if (stream.includes('@trade')) {
        return this.normalizeTradeData(data);
      } else if (stream.includes('@kline')) {
        return this.normalizeKlineData(data);
      }
      
      return data;
    } catch (error) {
      logger.error(`❌ Failed to normalize data for stream ${stream}:`, error);
      return null;
    }
  }

  private normalizeTickerData(data: any): any {
    return {
      ...data,
      c: parseFloat(data.c), // Close price
      o: parseFloat(data.o), // Open price
      h: parseFloat(data.h), // High price
      l: parseFloat(data.l), // Low price
      v: parseFloat(data.v), // Volume
      q: parseFloat(data.q), // Quote volume
      b: parseFloat(data.b), // Best bid
      a: parseFloat(data.a), // Best ask
      P: parseFloat(data.P), // Price change
      p: parseFloat(data.p), // Price change percent
      E: parseInt(data.E), // Event time
    };
  }

  private normalizeDepthData(data: any): any {
    return {
      ...data,
      b: data.b?.map((bid: string[]) => [parseFloat(bid[0]), parseFloat(bid[1])]) || [],
      a: data.a?.map((ask: string[]) => [parseFloat(ask[0]), parseFloat(ask[1])]) || [],
      E: parseInt(data.E),
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
          o: parseFloat(data.k.o), // Open
          c: parseFloat(data.k.c), // Close
          h: parseFloat(data.k.h), // High
          l: parseFloat(data.k.l), // Low
          v: parseFloat(data.k.v), // Volume
          q: parseFloat(data.k.q), // Quote volume
          t: parseInt(data.k.t), // Start time
          T: parseInt(data.k.T), // Close time
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

  private mapTimeframe(timeframe: Timeframe): string {
    const mapping: Record<Timeframe, string> = {
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
}