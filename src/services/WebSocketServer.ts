import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { logger } from '@/utils/logger';
import { config } from '@/config/config';
import { WebSocketMessage, AuthUser, JWTPayload } from '@/types';
import { RateLimiter } from '@/utils/RateLimiter';
import { EventEmitter } from 'events';
import { WebSocketStabilityManager } from './WebSocketStabilityManager';
import { WebSocketConnectionRecovery } from './WebSocketConnectionRecovery';

export interface AuthenticatedSocket extends Socket {
  user?: AuthUser;
  subscriptions?: Set<string>;
  rateLimiter?: RateLimiter;
  connectionId?: string;
  lastActivity?: number;
  connectionMetrics?: {
    messagesReceived: number;
    messagesSent: number;
    bytesReceived: number;
    bytesSent: number;
    connectTime: number;
  };
}

export interface WebSocketServerOptions {
  cors?: {
    origin: string | string[];
    credentials: boolean;
  };
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
  maxConnections?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
}

export interface ConnectionPool {
  activeConnections: Map<string, AuthenticatedSocket>;
  userConnections: Map<string, Set<string>>;
  channelSubscriptions: Map<string, Set<string>>;
  connectionMetrics: Map<string, any>;
}

export class WebSocketServer extends EventEmitter {
  private io: SocketIOServer;
  private connectionPool: ConnectionPool;
  private rateLimiters: Map<string, RateLimiter> = new Map();
  private heartbeatInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private options: WebSocketServerOptions;
  private isShuttingDown: boolean = false;
  private stabilityManager: WebSocketStabilityManager;
  private connectionRecovery: WebSocketConnectionRecovery;

  constructor(httpServer: HTTPServer, options?: WebSocketServerOptions) {
    super();
    
    this.options = {
      maxConnections: 1000,
      heartbeatInterval: 30000,
      connectionTimeout: 300000, // 5 minutes
      ...options
    };

    // Initialize connection pool
    this.connectionPool = {
      activeConnections: new Map(),
      userConnections: new Map(),
      channelSubscriptions: new Map(),
      connectionMetrics: new Map()
    };

    this.io = new SocketIOServer(httpServer, {
      cors: this.options.cors || {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: config.websocket.pingTimeout,
      pingInterval: config.websocket.pingInterval,
      maxHttpBufferSize: 1e6, // 1MB
      allowEIO3: true,
      connectTimeout: 45000,
      upgradeTimeout: 30000
    });

    // Initialize stability and recovery services
    this.stabilityManager = new WebSocketStabilityManager({
      heartbeatInterval: this.options.heartbeatInterval || 30000,
      connectionTimeout: this.options.connectionTimeout || 300000,
      enableAutoRecovery: true,
      enableConnectionPooling: true
    });

    this.connectionRecovery = new WebSocketConnectionRecovery({
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      enableCircuitBreaker: true
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.setupStabilityHandlers();
    this.startHeartbeat();
    this.startCleanupTask();
    
    logger.info('Enhanced WebSocket server initialized with stability management');
  }

  private setupMiddleware(): void {
    // Connection limit middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      if (this.isShuttingDown) {
        return next(new Error('Server is shutting down'));
      }

      if (this.connectionPool.activeConnections.size >= (this.options.maxConnections || 1000)) {
        logger.warn(`Connection limit reached: ${this.connectionPool.activeConnections.size}`);
        return next(new Error('Server connection limit reached'));
      }
      next();
    });

    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || 
                     socket.handshake.headers.authorization?.replace('Bearer ', '') ||
                     socket.handshake.query.token;
        
        if (!token) {
          // Allow anonymous connections for public data
          socket.user = undefined;
          socket.subscriptions = new Set();
          socket.connectionId = `anon_${socket.id}`;
          logger.info(`Anonymous WebSocket connection: ${socket.id}`);
          return next();
        }

        const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
        
        // In a real implementation, you would fetch user from database
        const user: AuthUser = {
          id: decoded.userId,
          email: decoded.email,
          role: decoded.role as 'user' | 'admin' | 'super_admin',
          isActive: true,
          isVerified: true
        };

        socket.user = user;
        socket.subscriptions = new Set();
        socket.connectionId = `user_${user.id}_${socket.id}`;
        
        // Initialize connection metrics
        socket.connectionMetrics = {
          messagesReceived: 0,
          messagesSent: 0,
          bytesReceived: 0,
          bytesSent: 0,
          connectTime: Date.now()
        };

        logger.info(`WebSocket authentication successful for user: ${user.email}`);
        next();
      } catch (error) {
        logger.error('WebSocket authentication failed:', error);
        next(new Error('Invalid authentication token'));
      }
    });

    // Rate limiting middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      const userId = socket.user?.id || socket.id;
      
      if (!this.rateLimiters.has(userId)) {
        const rateLimiter = new RateLimiter({
          windowMs: this.options.rateLimit?.windowMs || config.websocket.rateLimit.windowMs,
          maxRequests: this.options.rateLimit?.maxRequests || config.websocket.rateLimit.maxRequests
        });
        this.rateLimiters.set(userId, rateLimiter);
        socket.rateLimiter = rateLimiter;
      } else {
        socket.rateLimiter = this.rateLimiters.get(userId);
      }

      if (socket.rateLimiter && !socket.rateLimiter.checkLimit(userId)) {
        logger.warn(`Rate limit exceeded for user: ${userId}`);
        return next(new Error('Rate limit exceeded'));
      }
      next();
    });

    // Security middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      // Check for suspicious patterns
      const userAgent = socket.handshake.headers['user-agent'];
      const origin = socket.handshake.headers.origin;
      
      if (!userAgent || userAgent.length < 10) {
        logger.warn(`Suspicious connection attempt - no user agent: ${socket.id}`);
      }
      
      if (origin && !this.isAllowedOrigin(origin)) {
        logger.warn(`Connection from unauthorized origin: ${origin}`);
        return next(new Error('Unauthorized origin'));
      }
      
      next();
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
  }

  private setupStabilityHandlers(): void {
    // Stability Manager Events
    this.stabilityManager.on('connectionRegistered', (data) => {
      logger.debug(`Connection registered for stability monitoring: ${data.socketId}`);
    });

    this.stabilityManager.on('unhealthyConnection', (data) => {
      logger.warn(`Unhealthy connection detected: ${data.socketId}`);
      this.emit('unhealthyConnection', data);
    });

    this.stabilityManager.on('staleConnection', (data) => {
      logger.warn(`Stale connection detected: ${data.socketId}`);
      const socket = this.connectionPool.activeConnections.get(data.socketId);
      if (socket) {
        this.disconnectClient(data.socketId, 'Stale connection cleanup');
      }
    });

    this.stabilityManager.on('connectionRecovered', (data) => {
      logger.info(`Connection recovered: ${data.socketId}`);
      this.emit('connectionRecovered', data);
    });

    this.stabilityManager.on('highUnhealthyConnectionsAlert', (data) => {
      logger.error(`High number of unhealthy connections: ${data.metrics.unhealthyConnections}/${data.metrics.totalConnections}`);
      this.emit('stabilityAlert', data);
    });

    // Connection Recovery Events
    this.connectionRecovery.on('recoverySuccess', (data) => {
      logger.info(`Connection recovery successful: ${data.socketId} -> ${data.newSocketId}`);
      this.emit('connectionRecoverySuccess', data);
    });

    this.connectionRecovery.on('recoveryFailed', (data) => {
      logger.error(`Connection recovery failed: ${data.socketId} - ${data.reason}`);
      this.emit('connectionRecoveryFailed', data);
    });

    this.connectionRecovery.on('circuitBreakerOpened', (data) => {
      logger.warn(`Circuit breaker opened for connection: ${data.socketId}`);
      this.emit('circuitBreakerOpened', data);
    });
  }

  private handleConnection(socket: AuthenticatedSocket): void {
    const userId = socket.user?.id || 'anonymous';
    const connectionId = socket.connectionId || socket.id;
    
    logger.info(`WebSocket client connected: ${socket.id} (User: ${userId}, Connection: ${connectionId})`);

    // Add to connection pool
    this.connectionPool.activeConnections.set(socket.id, socket);
    
    // Track user connections
    if (socket.user?.id) {
      if (!this.connectionPool.userConnections.has(socket.user.id)) {
        this.connectionPool.userConnections.set(socket.user.id, new Set());
      }
      this.connectionPool.userConnections.get(socket.user.id)!.add(socket.id);
    }

    // Initialize activity tracking
    socket.lastActivity = Date.now();

    // Register with stability manager
    this.stabilityManager.registerConnection(socket);

    // Send welcome message with server capabilities
    const welcomeMessage = {
      type: 'connection',
      data: {
        socketId: socket.id,
        connectionId,
        userId: socket.user?.id,
        serverTime: Date.now(),
        capabilities: {
          channels: this.getAllowedChannels(socket.user),
          maxSubscriptions: 50,
          rateLimit: {
            windowMs: config.websocket.rateLimit.windowMs,
            maxRequests: config.websocket.rateLimit.maxRequests
          }
        },
        paperTradingMode: config.paperTrading.enabled
      },
      timestamp: Date.now()
    } as WebSocketMessage;

    socket.emit('connected', welcomeMessage);
    this.updateConnectionMetrics(socket, 'messagesSent', 1);

    // Set up message handlers with rate limiting
    this.setupMessageHandlers(socket);

    // Emit connection event
    this.emit('connection', {
      socketId: socket.id,
      userId: socket.user?.id,
      connectionId,
      timestamp: Date.now()
    });
  }

  private handleSubscription(socket: AuthenticatedSocket, channels: string[]): void {
    const validChannels = this.validateChannels(channels, socket.user);
    const subscribedChannels: string[] = [];
    const failedChannels: string[] = [];
    
    validChannels.forEach(channel => {
      try {
        // Check subscription limits
        if (socket.subscriptions && socket.subscriptions.size >= 50) {
          failedChannels.push(channel);
          return;
        }

        // Add to socket subscriptions
        socket.subscriptions?.add(channel);
        
        // Add to channel subscriptions map
        if (!this.connectionPool.channelSubscriptions.has(channel)) {
          this.connectionPool.channelSubscriptions.set(channel, new Set());
        }
        this.connectionPool.channelSubscriptions.get(channel)?.add(socket.id);
        
        // Join socket room for efficient broadcasting
        socket.join(channel);
        subscribedChannels.push(channel);

        // Send initial data for the channel if available
        this.sendInitialChannelData(socket, channel);
        
      } catch (error) {
        logger.error(`Failed to subscribe to channel ${channel}:`, error);
        failedChannels.push(channel);
      }
    });

    const response = {
      type: 'subscription_confirmed',
      data: {
        subscribed: subscribedChannels,
        failed: failedChannels,
        totalSubscriptions: socket.subscriptions?.size || 0,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    } as WebSocketMessage;

    socket.emit('subscription_confirmed', response);
    this.updateConnectionMetrics(socket, 'messagesSent', 1);

    logger.info(`Client ${socket.id} subscribed to ${subscribedChannels.length} channels: ${subscribedChannels.join(', ')}`);
    
    if (failedChannels.length > 0) {
      logger.warn(`Client ${socket.id} failed to subscribe to channels: ${failedChannels.join(', ')}`);
    }

    // Emit subscription event
    this.emit('subscription', {
      socketId: socket.id,
      userId: socket.user?.id,
      channels: subscribedChannels,
      timestamp: Date.now()
    });
  }

  private handleUnsubscription(socket: AuthenticatedSocket, channels: string[]): void {
    const unsubscribedChannels: string[] = [];
    
    channels.forEach(channel => {
      if (socket.subscriptions?.has(channel)) {
        // Remove from socket subscriptions
        socket.subscriptions.delete(channel);
        
        // Remove from channel subscriptions map
        this.connectionPool.channelSubscriptions.get(channel)?.delete(socket.id);
        
        // Clean up empty channel subscriptions
        if (this.connectionPool.channelSubscriptions.get(channel)?.size === 0) {
          this.connectionPool.channelSubscriptions.delete(channel);
        }
        
        // Leave socket room
        socket.leave(channel);
        unsubscribedChannels.push(channel);
      }
    });

    const response = {
      type: 'unsubscription_confirmed',
      data: {
        unsubscribed: unsubscribedChannels,
        remainingSubscriptions: Array.from(socket.subscriptions || []),
        totalSubscriptions: socket.subscriptions?.size || 0,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    } as WebSocketMessage;

    socket.emit('unsubscription_confirmed', response);
    this.updateConnectionMetrics(socket, 'messagesSent', 1);

    logger.info(`Client ${socket.id} unsubscribed from channels: ${unsubscribedChannels.join(', ')}`);

    // Emit unsubscription event
    this.emit('unsubscription', {
      socketId: socket.id,
      userId: socket.user?.id,
      channels: unsubscribedChannels,
      timestamp: Date.now()
    });
  }

  private setupMessageHandlers(socket: AuthenticatedSocket): void {
    // Handle subscription requests
    socket.on('subscribe', (data: { channels: string[] }) => {
      if (this.checkRateLimit(socket)) {
        this.handleSubscription(socket, data.channels);
        this.updateConnectionMetrics(socket, 'messagesReceived', 1);
        this.stabilityManager.updateActivity(socket.id, 'message_received');
      }
    });

    // Handle unsubscription requests
    socket.on('unsubscribe', (data: { channels: string[] }) => {
      if (this.checkRateLimit(socket)) {
        this.handleUnsubscription(socket, data.channels);
        this.updateConnectionMetrics(socket, 'messagesReceived', 1);
      }
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.lastActivity = Date.now();
      socket.emit('pong', { 
        timestamp: Date.now(),
        serverTime: Date.now()
      });
      this.updateConnectionMetrics(socket, 'messagesReceived', 1);
      this.updateConnectionMetrics(socket, 'messagesSent', 1);
      this.stabilityManager.updateActivity(socket.id, 'message_received');
      this.stabilityManager.handleHeartbeatResponse(socket.id);
    });

    // Handle market data requests
    socket.on('requestMarketData', (data: { symbols?: string[], timeframe?: string }) => {
      if (this.checkRateLimit(socket)) {
        this.handleMarketDataRequest(socket, data);
        this.updateConnectionMetrics(socket, 'messagesReceived', 1);
      }
    });

    // Handle portfolio data requests (paper trading only)
    socket.on('requestPortfolio', () => {
      if (this.checkRateLimit(socket) && socket.user) {
        this.handlePortfolioRequest(socket);
        this.updateConnectionMetrics(socket, 'messagesReceived', 1);
      }
    });

    // Handle custom message routing
    socket.on('message', (data: any) => {
      if (this.checkRateLimit(socket)) {
        this.handleCustomMessage(socket, data);
        this.updateConnectionMetrics(socket, 'messagesReceived', 1);
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`WebSocket error for client ${socket.id}:`, error);
      this.emit('error', { socketId: socket.id, error, timestamp: Date.now() });
    });
  }

  private handleDisconnection(socket: AuthenticatedSocket, reason: string): void {
    const userId = socket.user?.id || 'anonymous';
    const connectionId = socket.connectionId || socket.id;
    
    logger.info(`WebSocket client disconnected: ${socket.id} (User: ${userId}, Reason: ${reason})`);

    // Clean up subscriptions
    if (socket.subscriptions) {
      socket.subscriptions.forEach(channel => {
        this.connectionPool.channelSubscriptions.get(channel)?.delete(socket.id);
        // Clean up empty channel subscriptions
        if (this.connectionPool.channelSubscriptions.get(channel)?.size === 0) {
          this.connectionPool.channelSubscriptions.delete(channel);
        }
      });
    }

    // Remove from connection pool
    this.connectionPool.activeConnections.delete(socket.id);
    
    // Remove from user connections
    if (socket.user?.id) {
      const userConnections = this.connectionPool.userConnections.get(socket.user.id);
      if (userConnections) {
        userConnections.delete(socket.id);
        if (userConnections.size === 0) {
          this.connectionPool.userConnections.delete(socket.user.id);
        }
      }
    }
    
    // Clean up rate limiter
    const rateLimitKey = socket.user?.id || socket.id;
    this.rateLimiters.delete(rateLimitKey);

    // Clean up connection metrics
    this.connectionPool.connectionMetrics.delete(socket.id);

    // Unregister from stability manager
    this.stabilityManager.unregisterConnection(socket.id);

    // Emit disconnection event
    this.emit('disconnection', {
      socketId: socket.id,
      userId: socket.user?.id,
      connectionId,
      reason,
      timestamp: Date.now()
    });
  }

  private validateChannels(channels: string[], user?: AuthUser): string[] {
    const validChannels: string[] = [];
    const allowedChannels = this.getAllowedChannels(user);

    channels.forEach(channel => {
      if (allowedChannels.includes(channel)) {
        validChannels.push(channel);
      } else {
        logger.warn(`User ${user?.id} attempted to subscribe to unauthorized channel: ${channel}`);
      }
    });

    return validChannels;
  }

  private getAllowedChannels(user?: AuthUser): string[] {
    const baseChannels = [
      'market_data',
      'price_updates',
      'trading_signals',
      'system_status'
    ];

    if (!user) {
      return ['system_status']; // Anonymous users only get system status
    }

    const userChannels = [
      ...baseChannels,
      `user_${user.id}_trades`,
      `user_${user.id}_positions`,
      `user_${user.id}_alerts`
    ];

    if (user.role === 'admin' || user.role === 'super_admin') {
      userChannels.push(
        'admin_alerts',
        'system_metrics',
        'all_trades',
        'risk_alerts'
      );
    }

    return userChannels;
  }

  // Enhanced utility methods
  private checkRateLimit(socket: AuthenticatedSocket): boolean {
    if (!socket.rateLimiter) return true;
    
    const userId = socket.user?.id || socket.id;
    const allowed = socket.rateLimiter.checkLimit(userId);
    
    if (!allowed) {
      socket.emit('error', {
        type: 'rate_limit_exceeded',
        message: 'Rate limit exceeded. Please slow down.',
        timestamp: Date.now()
      });
      logger.warn(`Rate limit exceeded for socket ${socket.id} (user: ${userId})`);
    }
    
    return allowed;
  }

  private updateConnectionMetrics(socket: AuthenticatedSocket, metric: keyof NonNullable<AuthenticatedSocket['connectionMetrics']>, value: number): void {
    if (socket.connectionMetrics) {
      socket.connectionMetrics[metric] += value;
    }
  }

  private isAllowedOrigin(origin: string): boolean {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'https://localhost:3000',
      'http://127.0.0.1:3000',
      'https://127.0.0.1:3000'
    ].filter(Boolean);

    return allowedOrigins.includes(origin) || origin.includes('localhost');
  }

  private sendInitialChannelData(socket: AuthenticatedSocket, channel: string): void {
    // Send initial data based on channel type
    switch (channel) {
      case 'market_data':
        // Send latest market data if available
        socket.emit('message', {
          type: 'initial_market_data',
          channel,
          data: { message: 'Market data stream initialized' },
          timestamp: Date.now()
        });
        break;
      case 'system_status':
        socket.emit('message', {
          type: 'system_status',
          channel,
          data: {
            status: 'operational',
            paperTradingMode: config.paperTrading.enabled,
            timestamp: Date.now()
          },
          timestamp: Date.now()
        });
        break;
      default:
        // Send generic channel initialization
        socket.emit('message', {
          type: 'channel_initialized',
          channel,
          data: { message: `Subscribed to ${channel}` },
          timestamp: Date.now()
        });
    }
  }

  private handleMarketDataRequest(socket: AuthenticatedSocket, data: { symbols?: string[], timeframe?: string }): void {
    // Handle market data requests
    const response = {
      type: 'market_data_response',
      data: {
        symbols: data.symbols || [],
        timeframe: data.timeframe || '1m',
        message: 'Market data request processed',
        paperTradingMode: config.paperTrading.enabled
      },
      timestamp: Date.now()
    };

    socket.emit('message', response);
    this.updateConnectionMetrics(socket, 'messagesSent', 1);
  }

  private handlePortfolioRequest(socket: AuthenticatedSocket): void {
    if (!socket.user) return;

    // Handle portfolio data requests (paper trading only)
    const response = {
      type: 'portfolio_response',
      data: {
        userId: socket.user.id,
        paperTradingMode: true,
        message: 'Portfolio data request processed',
        virtualBalance: config.paperTrading.initialVirtualBalance
      },
      timestamp: Date.now()
    };

    socket.emit('message', response);
    this.updateConnectionMetrics(socket, 'messagesSent', 1);
  }

  private handleCustomMessage(socket: AuthenticatedSocket, data: any): void {
    // Handle custom message routing
    logger.debug(`Custom message from ${socket.id}:`, data);
    
    // Echo back for now - can be extended for specific message types
    socket.emit('message', {
      type: 'message_received',
      data: { received: true, originalType: data.type },
      timestamp: Date.now()
    });
    this.updateConnectionMetrics(socket, 'messagesSent', 1);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = this.options.connectionTimeout || 300000;

      this.connectionPool.activeConnections.forEach((socket, socketId) => {
        if (socket.lastActivity && (now - socket.lastActivity) > timeout) {
          logger.info(`Disconnecting inactive client: ${socketId}`);
          socket.disconnect(true);
        }
      });
    }, this.options.heartbeatInterval || 30000);
  }

  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, config.websocket.cleanupInterval);
  }

  private performCleanup(): void {
    // Clean up expired rate limiters
    const now = Date.now();
    for (const [key, rateLimiter] of this.rateLimiters) {
      if (rateLimiter && typeof rateLimiter.isExpired === 'function' && rateLimiter.isExpired()) {
        this.rateLimiters.delete(key);
      }
    }

    // Clean up empty channel subscriptions
    for (const [channel, subscribers] of this.connectionPool.channelSubscriptions) {
      if (subscribers.size === 0) {
        this.connectionPool.channelSubscriptions.delete(channel);
      }
    }

    logger.debug(`Cleanup completed. Active connections: ${this.connectionPool.activeConnections.size}`);
  }

  /**
   * Shutdown the WebSocket server gracefully
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down WebSocket server...');
    this.isShuttingDown = true;

    // Stop monitoring intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Stop stability services
    this.stabilityManager.stop();
    this.connectionRecovery.stop();

    // Disconnect all connections gracefully
    const connections = Array.from(this.connectionPool.activeConnections.values());
    const disconnectPromises = connections.map(socket => {
      return new Promise<void>((resolve) => {
        socket.on('disconnect', () => resolve());
        socket.disconnect(true);
        // Timeout after 5 seconds
        setTimeout(() => resolve(), 5000);
      });
    });

    // Wait for all connections to close or timeout
    await Promise.all(disconnectPromises);

    // Clear all data structures
    this.connectionPool.activeConnections.clear();
    this.connectionPool.userConnections.clear();
    this.connectionPool.channelSubscriptions.clear();
    this.connectionPool.connectionMetrics.clear();
    this.rateLimiters.clear();

    logger.info('WebSocket server shutdown complete');
  }

  // Enhanced public methods for broadcasting data
  public broadcastToChannel(channel: string, message: WebSocketMessage): void {
    const subscriberCount = this.connectionPool.channelSubscriptions.get(channel)?.size || 0;
    
    if (subscriberCount > 0) {
      this.io.to(channel).emit('message', message);
      logger.debug(`Broadcasted message to channel ${channel}: ${message.type} (${subscriberCount} subscribers)`);
      
      // Update metrics for all subscribers
      const subscribers = this.connectionPool.channelSubscriptions.get(channel);
      if (subscribers) {
        subscribers.forEach(socketId => {
          const socket = this.connectionPool.activeConnections.get(socketId);
          if (socket) {
            this.updateConnectionMetrics(socket, 'messagesSent', 1);
          }
        });
      }
      
      // Emit broadcast event for monitoring
      this.emit('broadcast', {
        channel,
        messageType: message.type,
        subscriberCount,
        timestamp: Date.now()
      });
    }
  }

  public broadcastToUser(userId: string, message: WebSocketMessage): void {
    const userSocketIds = this.connectionPool.userConnections.get(userId);
    
    if (userSocketIds && userSocketIds.size > 0) {
      userSocketIds.forEach(socketId => {
        const socket = this.connectionPool.activeConnections.get(socketId);
        if (socket) {
          socket.emit('message', message);
          this.updateConnectionMetrics(socket, 'messagesSent', 1);
        }
      });
      
      logger.debug(`Broadcasted message to user ${userId}: ${message.type} (${userSocketIds.size} connections)`);
      
      // Emit user broadcast event for monitoring
      this.emit('userBroadcast', {
        userId,
        messageType: message.type,
        connectionCount: userSocketIds.size,
        timestamp: Date.now()
      });
    }
  }

  public broadcastToAll(message: WebSocketMessage): void {
    const connectionCount = this.connectionPool.activeConnections.size;
    
    if (connectionCount > 0) {
      this.io.emit('message', message);
      
      // Update metrics for all connections
      this.connectionPool.activeConnections.forEach(socket => {
        this.updateConnectionMetrics(socket, 'messagesSent', 1);
      });
      
      logger.debug(`Broadcasted message to all clients: ${message.type} (${connectionCount} connections)`);
      
      // Emit global broadcast event for monitoring
      this.emit('globalBroadcast', {
        messageType: message.type,
        connectionCount,
        timestamp: Date.now()
      });
    }
  }

  // Enhanced public API methods
  public getConnectedClientsCount(): number {
    return this.connectionPool.activeConnections.size;
  }

  public getChannelSubscriptionsCount(channel: string): number {
    return this.connectionPool.channelSubscriptions.get(channel)?.size || 0;
  }

  public getClientSubscriptions(socketId: string): string[] {
    const socket = this.connectionPool.activeConnections.get(socketId);
    return socket?.subscriptions ? Array.from(socket.subscriptions) : [];
  }

  public getUserConnectionsCount(userId: string): number {
    return this.connectionPool.userConnections.get(userId)?.size || 0;
  }

  public disconnectClient(socketId: string, reason?: string): void {
    const socket = this.connectionPool.activeConnections.get(socketId);
    if (socket) {
      socket.disconnect(true);
      logger.info(`Forcibly disconnected client ${socketId}: ${reason || 'No reason provided'}`);
      
      this.emit('clientDisconnected', {
        socketId,
        userId: socket.user?.id,
        reason: reason || 'Manual disconnect',
        timestamp: Date.now()
      });
    }
  }

  public disconnectUser(userId: string, reason?: string): void {
    const userSocketIds = this.connectionPool.userConnections.get(userId);
    if (userSocketIds) {
      const disconnectedCount = userSocketIds.size;
      userSocketIds.forEach(socketId => {
        this.disconnectClient(socketId, reason);
      });
      logger.info(`Disconnected all connections for user ${userId}: ${reason || 'No reason provided'}`);
      
      this.emit('userDisconnected', {
        userId,
        connectionCount: disconnectedCount,
        reason: reason || 'Manual disconnect',
        timestamp: Date.now()
      });
    }
  }

  // Enhanced connection management methods
  public getConnectionsByIP(ipAddress: string): AuthenticatedSocket[] {
    return Array.from(this.connectionPool.activeConnections.values())
      .filter(socket => socket.handshake.address === ipAddress);
  }

  public disconnectByIP(ipAddress: string, reason?: string): number {
    const connections = this.getConnectionsByIP(ipAddress);
    connections.forEach(socket => {
      this.disconnectClient(socket.id, reason);
    });
    
    logger.info(`Disconnected ${connections.length} connections from IP ${ipAddress}: ${reason || 'No reason provided'}`);
    return connections.length;
  }

  public getConnectionsByUserAgent(userAgent: string): AuthenticatedSocket[] {
    return Array.from(this.connectionPool.activeConnections.values())
      .filter(socket => socket.handshake.headers['user-agent'] === userAgent);
  }

  // Resource management methods
  public optimizeConnections(): void {
    const now = Date.now();
    let optimizedCount = 0;

    // Remove stale connections
    this.connectionPool.activeConnections.forEach((socket, socketId) => {
      if (socket.lastActivity && (now - socket.lastActivity) > 600000) { // 10 minutes
        this.disconnectClient(socketId, 'Stale connection cleanup');
        optimizedCount++;
      }
    });

    // Clean up empty channel subscriptions
    for (const [channel, subscribers] of this.connectionPool.channelSubscriptions) {
      if (subscribers.size === 0) {
        this.connectionPool.channelSubscriptions.delete(channel);
      }
    }

    // Clean up empty user connections
    for (const [userId, connections] of this.connectionPool.userConnections) {
      if (connections.size === 0) {
        this.connectionPool.userConnections.delete(userId);
      }
    }

    if (optimizedCount > 0) {
      logger.info(`Connection optimization completed: ${optimizedCount} connections cleaned up`);
    }
  }

  // Batch operations for efficiency
  public broadcastBatch(broadcasts: Array<{
    type: 'channel' | 'user' | 'all';
    target?: string;
    message: WebSocketMessage;
  }>): void {
    broadcasts.forEach(({ type, target, message }) => {
      switch (type) {
        case 'channel':
          if (target) this.broadcastToChannel(target, message);
          break;
        case 'user':
          if (target) this.broadcastToUser(target, message);
          break;
        case 'all':
          this.broadcastToAll(message);
          break;
      }
    });

    logger.debug(`Executed batch broadcast: ${broadcasts.length} messages`);
  }

  public getServerStats() {
    const now = Date.now();
    const connectionMetrics = Array.from(this.connectionPool.activeConnections.values()).map(socket => ({
      socketId: socket.id,
      userId: socket.user?.id,
      connectionTime: socket.connectionMetrics?.connectTime ? now - socket.connectionMetrics.connectTime : 0,
      messagesReceived: socket.connectionMetrics?.messagesReceived || 0,
      messagesSent: socket.connectionMetrics?.messagesSent || 0,
      subscriptions: socket.subscriptions?.size || 0,
      lastActivity: socket.lastActivity ? now - socket.lastActivity : 0
    }));

    const stabilityMetrics = this.stabilityManager.getStabilityMetrics();
    const recoveryStats = this.connectionRecovery.getRecoveryStats();

    return {
      server: {
        isShuttingDown: this.isShuttingDown,
        uptime: now,
        maxConnections: this.options.maxConnections
      },
      connections: {
        total: this.connectionPool.activeConnections.size,
        authenticated: Array.from(this.connectionPool.activeConnections.values()).filter(s => s.user).length,
        anonymous: Array.from(this.connectionPool.activeConnections.values()).filter(s => !s.user).length,
        healthy: stabilityMetrics.healthyConnections,
        unhealthy: stabilityMetrics.unhealthyConnections,
        stale: stabilityMetrics.staleConnections
      },
      channels: {
        total: this.connectionPool.channelSubscriptions.size,
        stats: Array.from(this.connectionPool.channelSubscriptions.entries()).map(([channel, subscribers]) => ({
          channel,
          subscribers: subscribers.size
        }))
      },
      performance: {
        totalMessagesReceived: connectionMetrics.reduce((sum, c) => sum + c.messagesReceived, 0),
        totalMessagesSent: connectionMetrics.reduce((sum, c) => sum + c.messagesSent, 0),
        averageConnectionTime: connectionMetrics.length > 0 ? 
          connectionMetrics.reduce((sum, c) => sum + c.connectionTime, 0) / connectionMetrics.length : 0,
        rateLimiters: this.rateLimiters.size,
        errorRate: stabilityMetrics.errorRate
      },
      stability: stabilityMetrics,
      recovery: recoveryStats,
      connections_detail: connectionMetrics
    };
  }

  /**
   * Get stability report
   */
  public getStabilityReport() {
    return this.stabilityManager.getStabilityReport();
  }

  /**
   * Get recovery statistics
   */
  public getRecoveryStats() {
    return this.connectionRecovery.getRecoveryStats();
  }

  public getHealthStatus() {
    const stats = this.getServerStats();
    const memoryUsage = process.memoryUsage();
    
    return {
      status: this.isShuttingDown ? 'shutting_down' : 'healthy',
      websocket: {
        connections: stats.connections.total,
        channels: stats.channels.total,
        performance: stats.performance
      },
      memory: {
        rss: memoryUsage.rss,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external
      },
      timestamp: Date.now()
    };
  }

  public async shutdown(): Promise<void> {
    logger.info('Shutting down WebSocket server...');
    this.isShuttingDown = true;

    // Stop intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Notify all clients of shutdown
    this.broadcastToAll({
      type: 'server_shutdown',
      data: { message: 'Server is shutting down' },
      timestamp: Date.now()
    });

    // Wait a moment for messages to be sent
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Disconnect all clients
    this.connectionPool.activeConnections.forEach((socket, socketId) => {
      socket.disconnect(true);
    });

    // Clear all data structures
    this.connectionPool.activeConnections.clear();
    this.connectionPool.userConnections.clear();
    this.connectionPool.channelSubscriptions.clear();
    this.connectionPool.connectionMetrics.clear();
    this.rateLimiters.clear();

    // Close the Socket.IO server
    this.io.close();

    logger.info('WebSocket server shutdown complete');
  }
}