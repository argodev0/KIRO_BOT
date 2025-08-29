/**
 * WebSocket Connection Manager
 * Advanced connection pooling and resource management for WebSocket connections
 */

import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { config } from '@/config/config';
import { AuthenticatedSocket } from './WebSocketServer';

export interface ConnectionPoolConfig {
  maxConnections: number;
  maxConnectionsPerUser: number;
  connectionTimeout: number;
  heartbeatInterval: number;
  cleanupInterval: number;
  rateLimitWindow: number;
  rateLimitMax: number;
}

export interface ConnectionMetrics {
  totalConnections: number;
  authenticatedConnections: number;
  anonymousConnections: number;
  uniqueUsers: number;
  totalChannelSubscriptions: number;
  messagesPerSecond: number;
  averageConnectionDuration: number;
  memoryUsage: number;
}

export interface ConnectionInfo {
  socketId: string;
  userId?: string;
  connectionTime: number;
  lastActivity: number;
  subscriptions: string[];
  messagesReceived: number;
  messagesSent: number;
  ipAddress: string;
  userAgent?: string;
  isAuthenticated: boolean;
}

export class WebSocketConnectionManager extends EventEmitter {
  private connections: Map<string, AuthenticatedSocket> = new Map();
  private userConnections: Map<string, Set<string>> = new Map();
  private connectionsByIP: Map<string, Set<string>> = new Map();
  private channelSubscriptions: Map<string, Set<string>> = new Map();
  private connectionMetrics: Map<string, any> = new Map();
  private messageRates: Map<string, number[]> = new Map();
  
  private config: ConnectionPoolConfig;
  private heartbeatInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  
  private isShuttingDown: boolean = false;

  constructor(config?: Partial<ConnectionPoolConfig>) {
    super();
    
    this.config = {
      maxConnections: 1000,
      maxConnectionsPerUser: 10,
      connectionTimeout: 300000, // 5 minutes
      heartbeatInterval: 30000, // 30 seconds
      cleanupInterval: 60000, // 1 minute
      rateLimitWindow: 60000, // 1 minute
      rateLimitMax: 100,
      ...config
    };

    this.startMonitoring();
    logger.info('WebSocket Connection Manager initialized');
  }

  /**
   * Add a new connection to the pool
   */
  public addConnection(socket: AuthenticatedSocket): boolean {
    if (this.isShuttingDown) {
      logger.warn(`Rejecting connection ${socket.id} - server is shutting down`);
      return false;
    }

    // Check global connection limit
    if (this.connections.size >= this.config.maxConnections) {
      logger.warn(`Connection limit reached: ${this.connections.size}/${this.config.maxConnections}`);
      this.emit('connectionLimitReached', { 
        current: this.connections.size, 
        max: this.config.maxConnections 
      });
      return false;
    }

    // Check per-user connection limit
    if (socket.user?.id) {
      const userConnectionCount = this.userConnections.get(socket.user.id)?.size || 0;
      if (userConnectionCount >= this.config.maxConnectionsPerUser) {
        logger.warn(`User connection limit reached for ${socket.user.id}: ${userConnectionCount}/${this.config.maxConnectionsPerUser}`);
        return false;
      }
    }

    // Check IP-based limits (prevent abuse)
    const ipAddress = socket.handshake.address;
    const ipConnections = this.connectionsByIP.get(ipAddress)?.size || 0;
    if (ipConnections >= 20) { // Max 20 connections per IP
      logger.warn(`IP connection limit reached for ${ipAddress}: ${ipConnections}/20`);
      return false;
    }

    // Add to connection pool
    this.connections.set(socket.id, socket);
    
    // Track user connections
    if (socket.user?.id) {
      if (!this.userConnections.has(socket.user.id)) {
        this.userConnections.set(socket.user.id, new Set());
      }
      this.userConnections.get(socket.user.id)!.add(socket.id);
    }

    // Track IP connections
    if (!this.connectionsByIP.has(ipAddress)) {
      this.connectionsByIP.set(ipAddress, new Set());
    }
    this.connectionsByIP.get(ipAddress)!.add(socket.id);

    // Initialize connection metrics
    this.connectionMetrics.set(socket.id, {
      connectTime: Date.now(),
      lastActivity: Date.now(),
      messagesReceived: 0,
      messagesSent: 0,
      bytesReceived: 0,
      bytesSent: 0,
      subscriptions: new Set()
    });

    // Initialize message rate tracking
    this.messageRates.set(socket.id, []);

    logger.info(`Connection added: ${socket.id} (User: ${socket.user?.id || 'anonymous'}, Total: ${this.connections.size})`);
    
    this.emit('connectionAdded', {
      socketId: socket.id,
      userId: socket.user?.id,
      totalConnections: this.connections.size,
      timestamp: Date.now()
    });

    return true;
  }

  /**
   * Remove a connection from the pool
   */
  public removeConnection(socketId: string): void {
    const socket = this.connections.get(socketId);
    if (!socket) return;

    // Remove from main connections
    this.connections.delete(socketId);

    // Remove from user connections
    if (socket.user?.id) {
      const userConnections = this.userConnections.get(socket.user.id);
      if (userConnections) {
        userConnections.delete(socketId);
        if (userConnections.size === 0) {
          this.userConnections.delete(socket.user.id);
        }
      }
    }

    // Remove from IP connections
    const ipAddress = socket.handshake.address;
    const ipConnections = this.connectionsByIP.get(ipAddress);
    if (ipConnections) {
      ipConnections.delete(socketId);
      if (ipConnections.size === 0) {
        this.connectionsByIP.delete(ipAddress);
      }
    }

    // Clean up channel subscriptions
    const metrics = this.connectionMetrics.get(socketId);
    if (metrics?.subscriptions) {
      metrics.subscriptions.forEach((channel: string) => {
        const channelSubs = this.channelSubscriptions.get(channel);
        if (channelSubs) {
          channelSubs.delete(socketId);
          if (channelSubs.size === 0) {
            this.channelSubscriptions.delete(channel);
          }
        }
      });
    }

    // Clean up metrics and rate tracking
    this.connectionMetrics.delete(socketId);
    this.messageRates.delete(socketId);

    logger.info(`Connection removed: ${socketId} (User: ${socket.user?.id || 'anonymous'}, Remaining: ${this.connections.size})`);
    
    this.emit('connectionRemoved', {
      socketId,
      userId: socket.user?.id,
      totalConnections: this.connections.size,
      timestamp: Date.now()
    });
  }

  /**
   * Subscribe a connection to a channel
   */
  public subscribeToChannel(socketId: string, channel: string): boolean {
    const socket = this.connections.get(socketId);
    if (!socket) return false;

    // Add to channel subscriptions
    if (!this.channelSubscriptions.has(channel)) {
      this.channelSubscriptions.set(channel, new Set());
    }
    this.channelSubscriptions.get(channel)!.add(socketId);

    // Update connection metrics
    const metrics = this.connectionMetrics.get(socketId);
    if (metrics) {
      metrics.subscriptions.add(channel);
      metrics.lastActivity = Date.now();
    }

    this.emit('channelSubscription', {
      socketId,
      userId: socket.user?.id,
      channel,
      subscriberCount: this.channelSubscriptions.get(channel)!.size,
      timestamp: Date.now()
    });

    return true;
  }

  /**
   * Unsubscribe a connection from a channel
   */
  public unsubscribeFromChannel(socketId: string, channel: string): boolean {
    const socket = this.connections.get(socketId);
    if (!socket) return false;

    // Remove from channel subscriptions
    const channelSubs = this.channelSubscriptions.get(channel);
    if (channelSubs) {
      channelSubs.delete(socketId);
      if (channelSubs.size === 0) {
        this.channelSubscriptions.delete(channel);
      }
    }

    // Update connection metrics
    const metrics = this.connectionMetrics.get(socketId);
    if (metrics) {
      metrics.subscriptions.delete(channel);
      metrics.lastActivity = Date.now();
    }

    this.emit('channelUnsubscription', {
      socketId,
      userId: socket.user?.id,
      channel,
      subscriberCount: channelSubs?.size || 0,
      timestamp: Date.now()
    });

    return true;
  }

  /**
   * Update message metrics for a connection
   */
  public updateMessageMetrics(socketId: string, type: 'received' | 'sent', bytes: number = 0): void {
    const metrics = this.connectionMetrics.get(socketId);
    if (!metrics) return;

    const now = Date.now();
    metrics.lastActivity = now;

    if (type === 'received') {
      metrics.messagesReceived++;
      metrics.bytesReceived += bytes;
    } else {
      metrics.messagesSent++;
      metrics.bytesSent += bytes;
    }

    // Update message rate tracking
    const rates = this.messageRates.get(socketId);
    if (rates) {
      rates.push(now);
      // Keep only last minute of data
      const cutoff = now - this.config.rateLimitWindow;
      while (rates.length > 0 && rates[0] < cutoff) {
        rates.shift();
      }
    }
  }

  /**
   * Check if a connection is within rate limits
   */
  public checkRateLimit(socketId: string): boolean {
    const rates = this.messageRates.get(socketId);
    if (!rates) return true;

    const now = Date.now();
    const cutoff = now - this.config.rateLimitWindow;
    
    // Clean old entries
    while (rates.length > 0 && rates[0] < cutoff) {
      rates.shift();
    }

    return rates.length < this.config.rateLimitMax;
  }

  /**
   * Get connection information
   */
  public getConnectionInfo(socketId: string): ConnectionInfo | null {
    const socket = this.connections.get(socketId);
    const metrics = this.connectionMetrics.get(socketId);
    
    if (!socket || !metrics) return null;

    return {
      socketId,
      userId: socket.user?.id,
      connectionTime: metrics.connectTime,
      lastActivity: metrics.lastActivity,
      subscriptions: Array.from(metrics.subscriptions),
      messagesReceived: metrics.messagesReceived,
      messagesSent: metrics.messagesSent,
      ipAddress: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent'],
      isAuthenticated: !!socket.user
    };
  }

  /**
   * Get comprehensive metrics
   */
  public getMetrics(): ConnectionMetrics {
    const now = Date.now();
    const connections = Array.from(this.connections.values());
    const metrics = Array.from(this.connectionMetrics.values());

    const totalMessages = metrics.reduce((sum, m) => sum + m.messagesReceived + m.messagesSent, 0);
    const totalDuration = metrics.reduce((sum, m) => sum + (now - m.connectTime), 0);
    
    // Calculate messages per second over last minute
    const messagesLastMinute = Array.from(this.messageRates.values())
      .flat()
      .filter(timestamp => timestamp > now - 60000)
      .length;

    return {
      totalConnections: this.connections.size,
      authenticatedConnections: connections.filter(s => s.user).length,
      anonymousConnections: connections.filter(s => !s.user).length,
      uniqueUsers: this.userConnections.size,
      totalChannelSubscriptions: this.channelSubscriptions.size,
      messagesPerSecond: messagesLastMinute / 60,
      averageConnectionDuration: metrics.length > 0 ? totalDuration / metrics.length : 0,
      memoryUsage: process.memoryUsage().heapUsed
    };
  }

  /**
   * Get connections by user ID
   */
  public getUserConnections(userId: string): AuthenticatedSocket[] {
    const socketIds = this.userConnections.get(userId);
    if (!socketIds) return [];

    return Array.from(socketIds)
      .map(id => this.connections.get(id))
      .filter(socket => socket !== undefined) as AuthenticatedSocket[];
  }

  /**
   * Get channel subscribers
   */
  public getChannelSubscribers(channel: string): AuthenticatedSocket[] {
    const socketIds = this.channelSubscriptions.get(channel);
    if (!socketIds) return [];

    return Array.from(socketIds)
      .map(id => this.connections.get(id))
      .filter(socket => socket !== undefined) as AuthenticatedSocket[];
  }

  /**
   * Disconnect user connections
   */
  public disconnectUser(userId: string, reason?: string): number {
    const connections = this.getUserConnections(userId);
    connections.forEach(socket => {
      socket.disconnect(true);
    });
    
    logger.info(`Disconnected ${connections.length} connections for user ${userId}: ${reason || 'No reason'}`);
    return connections.length;
  }

  /**
   * Start monitoring and cleanup tasks
   */
  private startMonitoring(): void {
    // Heartbeat to check connection health
    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeat();
    }, this.config.heartbeatInterval);

    // Cleanup inactive connections
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);

    // Emit metrics periodically
    this.metricsInterval = setInterval(() => {
      this.emit('metrics', this.getMetrics());
    }, 30000); // Every 30 seconds
  }

  /**
   * Perform heartbeat check
   */
  private performHeartbeat(): void {
    const now = Date.now();
    const timeout = this.config.connectionTimeout;
    const staleConnections: string[] = [];

    this.connectionMetrics.forEach((metrics, socketId) => {
      if (now - metrics.lastActivity > timeout) {
        staleConnections.push(socketId);
      }
    });

    // Disconnect stale connections
    staleConnections.forEach(socketId => {
      const socket = this.connections.get(socketId);
      if (socket) {
        logger.info(`Disconnecting stale connection: ${socketId}`);
        socket.disconnect(true);
      }
    });

    if (staleConnections.length > 0) {
      this.emit('staleConnectionsRemoved', {
        count: staleConnections.length,
        socketIds: staleConnections,
        timestamp: now
      });
    }
  }

  /**
   * Perform cleanup tasks
   */
  private performCleanup(): void {
    // Clean up empty channel subscriptions
    for (const [channel, subscribers] of this.channelSubscriptions) {
      if (subscribers.size === 0) {
        this.channelSubscriptions.delete(channel);
      }
    }

    // Clean up empty user connections
    for (const [userId, connections] of this.userConnections) {
      if (connections.size === 0) {
        this.userConnections.delete(userId);
      }
    }

    // Clean up empty IP connections
    for (const [ip, connections] of this.connectionsByIP) {
      if (connections.size === 0) {
        this.connectionsByIP.delete(ip);
      }
    }

    // Clean up old message rate data
    const now = Date.now();
    const cutoff = now - this.config.rateLimitWindow;
    
    this.messageRates.forEach((rates, socketId) => {
      while (rates.length > 0 && rates[0] < cutoff) {
        rates.shift();
      }
    });

    logger.debug(`Cleanup completed - Connections: ${this.connections.size}, Channels: ${this.channelSubscriptions.size}`);
  }

  /**
   * Shutdown the connection manager
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down WebSocket Connection Manager...');
    this.isShuttingDown = true;

    // Stop monitoring intervals
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.metricsInterval) clearInterval(this.metricsInterval);

    // Disconnect all connections
    const connectionIds = Array.from(this.connections.keys());
    for (const socketId of connectionIds) {
      const socket = this.connections.get(socketId);
      if (socket) {
        socket.disconnect(true);
      }
    }

    // Clear all data structures
    this.connections.clear();
    this.userConnections.clear();
    this.connectionsByIP.clear();
    this.channelSubscriptions.clear();
    this.connectionMetrics.clear();
    this.messageRates.clear();

    logger.info('WebSocket Connection Manager shutdown complete');
  }

  /**
   * Get detailed statistics
   */
  public getDetailedStats() {
    const metrics = this.getMetrics();
    const now = Date.now();

    return {
      ...metrics,
      config: this.config,
      isShuttingDown: this.isShuttingDown,
      uptime: now,
      connections: {
        byUser: Array.from(this.userConnections.entries()).map(([userId, socketIds]) => ({
          userId,
          connectionCount: socketIds.size,
          socketIds: Array.from(socketIds)
        })),
        byIP: Array.from(this.connectionsByIP.entries()).map(([ip, socketIds]) => ({
          ip,
          connectionCount: socketIds.size
        }))
      },
      channels: Array.from(this.channelSubscriptions.entries()).map(([channel, subscribers]) => ({
        channel,
        subscriberCount: subscribers.size
      })),
      performance: {
        memoryUsage: process.memoryUsage(),
        eventLoopLag: process.hrtime()
      }
    };
  }
}