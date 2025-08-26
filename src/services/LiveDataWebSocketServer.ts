/**
 * Live Data WebSocket Server
 * Streams real-time market data to connected clients
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { LiveMarketDataService, AggregatedMarketData } from './LiveMarketDataService';
import { logger } from '../utils/logger';
import { config } from '../config/config';

export interface WebSocketClientInfo {
  id: string;
  connectedAt: number;
  subscriptions: Set<string>;
  lastActivity: number;
  ipAddress: string;
  userAgent?: string;
}

export class LiveDataWebSocketServer {
  private io: SocketIOServer;
  private liveDataService: LiveMarketDataService;
  private clients: Map<string, WebSocketClientInfo> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map(); // symbol -> client IDs
  
  // Rate limiting
  private rateLimitMap: Map<string, { count: number; resetTime: number }> = new Map();
  
  // Monitoring
  private cleanupInterval?: NodeJS.Timeout;
  private statsInterval?: NodeJS.Timeout;

  constructor(httpServer: HttpServer, liveDataService: LiveMarketDataService) {
    this.liveDataService = liveDataService;
    
    // Initialize Socket.IO server with CORS configuration
    this.io = new SocketIOServer(httpServer, {
      cors: config.websocket.cors,
      pingTimeout: config.websocket.pingTimeout,
      pingInterval: config.websocket.pingInterval,
      maxHttpBufferSize: 1e6, // 1MB
      transports: ['websocket', 'polling'],
    });
    
    this.setupEventHandlers();
    this.startMonitoring();
  }

  /**
   * Start the WebSocket server
   */
  start(): void {
    logger.info('🌐 Live Data WebSocket Server started');
    
    // Set up live data service event handlers
    this.setupLiveDataHandlers();
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    // Stop monitoring
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
    
    // Disconnect all clients
    this.io.disconnectSockets(true);
    
    // Close server
    this.io.close();
    
    logger.info('🛑 Live Data WebSocket Server stopped');
  }

  /**
   * Get server statistics
   */
  getStats(): {
    totalClients: number;
    activeSubscriptions: number;
    symbolSubscriptions: Record<string, number>;
    rateLimitViolations: number;
  } {
    const symbolSubscriptions: Record<string, number> = {};
    for (const [symbol, clientIds] of this.subscriptions) {
      symbolSubscriptions[symbol] = clientIds.size;
    }
    
    const rateLimitViolations = Array.from(this.rateLimitMap.values())
      .filter(limit => limit.count > config.websocket.rateLimit.maxRequests).length;

    return {
      totalClients: this.clients.size,
      activeSubscriptions: this.subscriptions.size,
      symbolSubscriptions,
      rateLimitViolations,
    };
  }

  /**
   * Broadcast market data update to subscribed clients
   */
  private broadcastMarketData(symbol: string, data: AggregatedMarketData): void {
    const clientIds = this.subscriptions.get(symbol);
    if (!clientIds || clientIds.size === 0) return;
    
    const payload = {
      type: 'marketData',
      symbol,
      data,
      timestamp: Date.now(),
    };
    
    // Broadcast to subscribed clients
    for (const clientId of clientIds) {
      const socket = this.io.sockets.sockets.get(clientId);
      if (socket) {
        socket.emit('marketData', payload);
      }
    }
    
    logger.debug(`📡 Broadcasted ${symbol} data to ${clientIds.size} clients`);
  }

  /**
   * Broadcast connection status updates
   */
  private broadcastConnectionStatus(exchange: string, status: 'connected' | 'disconnected' | 'error'): void {
    this.io.emit('exchangeStatus', {
      type: 'exchangeStatus',
      exchange,
      status,
      timestamp: Date.now(),
    });
  }

  /**
   * Set up Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      const clientInfo: WebSocketClientInfo = {
        id: socket.id,
        connectedAt: Date.now(),
        subscriptions: new Set(),
        lastActivity: Date.now(),
        ipAddress: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'],
      };
      
      this.clients.set(socket.id, clientInfo);
      
      logger.info(`👤 Client connected: ${socket.id} from ${clientInfo.ipAddress}`);
      
      // Send initial connection info
      socket.emit('connected', {
        clientId: socket.id,
        serverTime: Date.now(),
        availableSymbols: this.liveDataService.getAllMarketData(),
        connectionStatus: this.liveDataService.getConnectionStatus(),
      });
      
      // Handle subscription requests
      socket.on('subscribe', (data) => {
        this.handleSubscription(socket, data);
      });
      
      // Handle unsubscription requests
      socket.on('unsubscribe', (data) => {
        this.handleUnsubscription(socket, data);
      });
      
      // Handle ping for connection monitoring
      socket.on('ping', () => {
        const client = this.clients.get(socket.id);
        if (client) {
          client.lastActivity = Date.now();
        }
        socket.emit('pong', { timestamp: Date.now() });
      });
      
      // Handle market data requests
      socket.on('getMarketData', (data) => {
        this.handleMarketDataRequest(socket, data);
      });
      
      // Handle health status requests
      socket.on('getHealthStatus', () => {
        socket.emit('healthStatus', this.liveDataService.getHealthStatus());
      });
      
      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.handleDisconnection(socket, reason);
      });
      
      // Handle errors
      socket.on('error', (error) => {
        logger.error(`WebSocket error for client ${socket.id}:`, error);
      });
    });
  }

  /**
   * Set up live data service event handlers
   */
  private setupLiveDataHandlers(): void {
    // Handle market data updates
    this.liveDataService.on('marketDataUpdate', ({ symbol, data }) => {
      this.broadcastMarketData(symbol, data);
    });
    
    // Handle exchange connection events
    this.liveDataService.on('exchangeConnected', (exchange) => {
      this.broadcastConnectionStatus(exchange, 'connected');
    });
    
    this.liveDataService.on('exchangeDisconnected', (exchange) => {
      this.broadcastConnectionStatus(exchange, 'disconnected');
    });
    
    this.liveDataService.on('exchangeError', ({ exchange }) => {
      this.broadcastConnectionStatus(exchange, 'error');
    });
    
    // Handle health check results
    this.liveDataService.on('healthCheck', (health) => {
      this.io.emit('healthCheck', {
        type: 'healthCheck',
        data: health,
        timestamp: Date.now(),
      });
    });
    
    // Handle stale data warnings
    this.liveDataService.on('staleData', ({ symbol, age }) => {
      this.io.emit('dataWarning', {
        type: 'staleData',
        symbol,
        age,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Handle client subscription requests
   */
  private handleSubscription(socket: any, data: { symbols?: string[]; symbol?: string }): void {
    if (!this.checkRateLimit(socket.id)) {
      socket.emit('error', { message: 'Rate limit exceeded' });
      return;
    }
    
    const client = this.clients.get(socket.id);
    if (!client) return;
    
    client.lastActivity = Date.now();
    
    // Handle both single symbol and multiple symbols
    const symbols = data.symbols || (data.symbol ? [data.symbol] : []);
    
    for (const symbol of symbols) {
      const normalizedSymbol = symbol.toUpperCase();
      
      // Check if symbol is available
      const marketData = this.liveDataService.getMarketData(normalizedSymbol);
      if (!marketData) {
        socket.emit('error', { 
          message: `Symbol ${normalizedSymbol} not available`,
          symbol: normalizedSymbol 
        });
        continue;
      }
      
      // Add to client subscriptions
      client.subscriptions.add(normalizedSymbol);
      
      // Add to symbol subscriptions
      if (!this.subscriptions.has(normalizedSymbol)) {
        this.subscriptions.set(normalizedSymbol, new Set());
      }
      this.subscriptions.get(normalizedSymbol)!.add(socket.id);
      
      // Send current data immediately
      socket.emit('marketData', {
        type: 'marketData',
        symbol: normalizedSymbol,
        data: marketData,
        timestamp: Date.now(),
      });
      
      logger.debug(`📊 Client ${socket.id} subscribed to ${normalizedSymbol}`);
    }
    
    socket.emit('subscribed', { 
      symbols: Array.from(client.subscriptions),
      timestamp: Date.now(),
    });
  }

  /**
   * Handle client unsubscription requests
   */
  private handleUnsubscription(socket: any, data: { symbols?: string[]; symbol?: string }): void {
    const client = this.clients.get(socket.id);
    if (!client) return;
    
    client.lastActivity = Date.now();
    
    // Handle both single symbol and multiple symbols
    const symbols = data.symbols || (data.symbol ? [data.symbol] : []);
    
    for (const symbol of symbols) {
      const normalizedSymbol = symbol.toUpperCase();
      
      // Remove from client subscriptions
      client.subscriptions.delete(normalizedSymbol);
      
      // Remove from symbol subscriptions
      const symbolSubs = this.subscriptions.get(normalizedSymbol);
      if (symbolSubs) {
        symbolSubs.delete(socket.id);
        if (symbolSubs.size === 0) {
          this.subscriptions.delete(normalizedSymbol);
        }
      }
      
      logger.debug(`📊 Client ${socket.id} unsubscribed from ${normalizedSymbol}`);
    }
    
    socket.emit('unsubscribed', { 
      symbols,
      remainingSubscriptions: Array.from(client.subscriptions),
      timestamp: Date.now(),
    });
  }

  /**
   * Handle market data requests
   */
  private handleMarketDataRequest(socket: any, data: { symbol?: string; symbols?: string[] }): void {
    if (!this.checkRateLimit(socket.id)) {
      socket.emit('error', { message: 'Rate limit exceeded' });
      return;
    }
    
    const client = this.clients.get(socket.id);
    if (!client) return;
    
    client.lastActivity = Date.now();
    
    if (data.symbol) {
      // Single symbol request
      const marketData = this.liveDataService.getMarketData(data.symbol.toUpperCase());
      socket.emit('marketDataResponse', {
        symbol: data.symbol.toUpperCase(),
        data: marketData,
        timestamp: Date.now(),
      });
    } else if (data.symbols) {
      // Multiple symbols request
      const response: Record<string, any> = {};
      for (const symbol of data.symbols) {
        const normalizedSymbol = symbol.toUpperCase();
        response[normalizedSymbol] = this.liveDataService.getMarketData(normalizedSymbol);
      }
      socket.emit('marketDataResponse', {
        data: response,
        timestamp: Date.now(),
      });
    } else {
      // All symbols request
      socket.emit('marketDataResponse', {
        data: this.liveDataService.getAllMarketData(),
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(socket: any, reason: string): void {
    const client = this.clients.get(socket.id);
    if (!client) return;
    
    logger.info(`👤 Client disconnected: ${socket.id} (${reason})`);
    
    // Remove from all symbol subscriptions
    for (const symbol of client.subscriptions) {
      const symbolSubs = this.subscriptions.get(symbol);
      if (symbolSubs) {
        symbolSubs.delete(socket.id);
        if (symbolSubs.size === 0) {
          this.subscriptions.delete(symbol);
        }
      }
    }
    
    // Remove client info
    this.clients.delete(socket.id);
    this.rateLimitMap.delete(socket.id);
  }

  /**
   * Check rate limiting for a client
   */
  private checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const windowMs = config.websocket.rateLimit.windowMs;
    const maxRequests = config.websocket.rateLimit.maxRequests;
    
    let limit = this.rateLimitMap.get(clientId);
    
    if (!limit || now > limit.resetTime) {
      // Reset or create new limit window
      limit = {
        count: 1,
        resetTime: now + windowMs,
      };
      this.rateLimitMap.set(clientId, limit);
      return true;
    }
    
    if (limit.count >= maxRequests) {
      return false;
    }
    
    limit.count++;
    return true;
  }

  /**
   * Start monitoring and cleanup tasks
   */
  private startMonitoring(): void {
    // Cleanup inactive clients every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveClients();
    }, 300000);
    
    // Log statistics every minute
    this.statsInterval = setInterval(() => {
      const stats = this.getStats();
      logger.info(`📊 WebSocket Stats: ${stats.totalClients} clients, ${stats.activeSubscriptions} subscriptions`);
    }, 60000);
  }

  /**
   * Clean up inactive clients
   */
  private cleanupInactiveClients(): void {
    const now = Date.now();
    const inactiveThreshold = 300000; // 5 minutes
    
    for (const [clientId, client] of this.clients) {
      if (now - client.lastActivity > inactiveThreshold) {
        const socket = this.io.sockets.sockets.get(clientId);
        if (socket) {
          logger.info(`🧹 Disconnecting inactive client: ${clientId}`);
          socket.disconnect(true);
        }
      }
    }
    
    // Clean up rate limit map
    for (const [clientId, limit] of this.rateLimitMap) {
      if (now > limit.resetTime && !this.clients.has(clientId)) {
        this.rateLimitMap.delete(clientId);
      }
    }
  }
}