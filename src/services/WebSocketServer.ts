import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { logger } from '@/utils/logger';
import { config } from '@/config/config';
import { WebSocketMessage, AuthUser, JWTPayload } from '@/types';
import { RateLimiter } from '@/utils/RateLimiter';

export interface AuthenticatedSocket extends Socket {
  user?: AuthUser;
  subscriptions?: Set<string>;
  rateLimiter?: RateLimiter;
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
}

export class WebSocketServer {
  private io: SocketIOServer;
  private connectedClients: Map<string, AuthenticatedSocket> = new Map();
  private channelSubscriptions: Map<string, Set<string>> = new Map();
  private rateLimiters: Map<string, RateLimiter> = new Map();

  constructor(httpServer: HTTPServer, options?: WebSocketServerOptions) {
    this.io = new SocketIOServer(httpServer, {
      cors: options?.cors || {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    
    logger.info('WebSocket server initialized');
  }

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
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
        
        // Initialize rate limiter for this user
        const rateLimiter = new RateLimiter({
          windowMs: 60000, // 1 minute
          maxRequests: 100 // 100 requests per minute
        });
        socket.rateLimiter = rateLimiter;
        this.rateLimiters.set(socket.id, rateLimiter);

        logger.info(`WebSocket authentication successful for user: ${user.email}`);
        next();
      } catch (error) {
        logger.error('WebSocket authentication failed:', error);
        next(new Error('Invalid authentication token'));
      }
    });

    // Rate limiting middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      const rateLimiter = socket.rateLimiter;
      if (rateLimiter && !rateLimiter.checkLimit(socket.user?.id || socket.id)) {
        return next(new Error('Rate limit exceeded'));
      }
      next();
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: AuthenticatedSocket): void {
    const userId = socket.user?.id || 'anonymous';
    logger.info(`WebSocket client connected: ${socket.id} (User: ${userId})`);

    // Store connected client
    this.connectedClients.set(socket.id, socket);

    // Send welcome message
    socket.emit('connected', {
      type: 'connection',
      data: {
        socketId: socket.id,
        userId: socket.user?.id,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    } as WebSocketMessage);

    // Handle subscription requests
    socket.on('subscribe', (data: { channels: string[] }) => {
      this.handleSubscription(socket, data.channels);
    });

    // Handle unsubscription requests
    socket.on('unsubscribe', (data: { channels: string[] }) => {
      this.handleUnsubscription(socket, data.channels);
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`WebSocket error for client ${socket.id}:`, error);
    });
  }

  private handleSubscription(socket: AuthenticatedSocket, channels: string[]): void {
    const validChannels = this.validateChannels(channels, socket.user);
    
    validChannels.forEach(channel => {
      // Add to socket subscriptions
      socket.subscriptions?.add(channel);
      
      // Add to channel subscriptions map
      if (!this.channelSubscriptions.has(channel)) {
        this.channelSubscriptions.set(channel, new Set());
      }
      this.channelSubscriptions.get(channel)?.add(socket.id);
      
      // Join socket room for efficient broadcasting
      socket.join(channel);
    });

    socket.emit('subscription_confirmed', {
      type: 'subscription_confirmed',
      data: {
        channels: validChannels,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    } as WebSocketMessage);

    logger.info(`Client ${socket.id} subscribed to channels: ${validChannels.join(', ')}`);
  }

  private handleUnsubscription(socket: AuthenticatedSocket, channels: string[]): void {
    channels.forEach(channel => {
      // Remove from socket subscriptions
      socket.subscriptions?.delete(channel);
      
      // Remove from channel subscriptions map
      this.channelSubscriptions.get(channel)?.delete(socket.id);
      
      // Leave socket room
      socket.leave(channel);
    });

    socket.emit('unsubscription_confirmed', {
      type: 'unsubscription_confirmed',
      data: {
        channels: channels,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    } as WebSocketMessage);

    logger.info(`Client ${socket.id} unsubscribed from channels: ${channels.join(', ')}`);
  }

  private handleDisconnection(socket: AuthenticatedSocket, reason: string): void {
    const userId = socket.user?.id || 'anonymous';
    logger.info(`WebSocket client disconnected: ${socket.id} (User: ${userId}, Reason: ${reason})`);

    // Clean up subscriptions
    if (socket.subscriptions) {
      socket.subscriptions.forEach(channel => {
        this.channelSubscriptions.get(channel)?.delete(socket.id);
      });
    }

    // Remove from connected clients
    this.connectedClients.delete(socket.id);
    
    // Clean up rate limiter
    this.rateLimiters.delete(socket.id);
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

  // Public methods for broadcasting data
  public broadcastToChannel(channel: string, message: WebSocketMessage): void {
    this.io.to(channel).emit('message', message);
    logger.debug(`Broadcasted message to channel ${channel}: ${message.type}`);
  }

  public broadcastToUser(userId: string, message: WebSocketMessage): void {
    const userSockets = Array.from(this.connectedClients.values())
      .filter(socket => socket.user?.id === userId);

    userSockets.forEach(socket => {
      socket.emit('message', message);
    });

    logger.debug(`Broadcasted message to user ${userId}: ${message.type}`);
  }

  public broadcastToAll(message: WebSocketMessage): void {
    this.io.emit('message', message);
    logger.debug(`Broadcasted message to all clients: ${message.type}`);
  }

  public getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  public getChannelSubscriptionsCount(channel: string): number {
    return this.channelSubscriptions.get(channel)?.size || 0;
  }

  public getClientSubscriptions(socketId: string): string[] {
    const socket = this.connectedClients.get(socketId);
    return socket?.subscriptions ? Array.from(socket.subscriptions) : [];
  }

  public disconnectClient(socketId: string, reason?: string): void {
    const socket = this.connectedClients.get(socketId);
    if (socket) {
      socket.disconnect(true);
      logger.info(`Forcibly disconnected client ${socketId}: ${reason || 'No reason provided'}`);
    }
  }

  public getServerStats() {
    return {
      connectedClients: this.connectedClients.size,
      totalChannels: this.channelSubscriptions.size,
      channelStats: Array.from(this.channelSubscriptions.entries()).map(([channel, subscribers]) => ({
        channel,
        subscribers: subscribers.size
      }))
    };
  }
}