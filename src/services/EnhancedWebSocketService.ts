/**
 * Enhanced WebSocket Service
 * Comprehensive WebSocket server implementation with advanced features
 */

import { Server as HTTPServer } from 'http';
import { EventEmitter } from 'events';
import { WebSocketServer, AuthenticatedSocket } from './WebSocketServer';
import { WebSocketConnectionManager } from './WebSocketConnectionManager';
import { WebSocketAuthService } from './WebSocketAuthService';
import { DataBroadcastService } from './DataBroadcastService';
import { WebSocketClientManager } from './WebSocketClientManager';
import { logger } from '@/utils/logger';
import { config } from '@/config/config';
import { WebSocketMessage } from '@/types';

export interface WebSocketServiceConfig {
  maxConnections: number;
  maxConnectionsPerUser: number;
  connectionTimeout: number;
  heartbeatInterval: number;
  cleanupInterval: number;
  rateLimitWindow: number;
  rateLimitMax: number;
  enableAuthentication: boolean;
  allowAnonymous: boolean;
  enableMetrics: boolean;
  enableResourceOptimization: boolean;
}

export interface WebSocketServiceStats {
  server: any;
  connectionManager: any;
  auth: any;
  clientManager: any;
  broadcast: any;
  performance: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    eventLoopLag: number;
    totalBroadcasts: number;
    totalConnections: number;
    totalDisconnections: number;
  };
}

export class EnhancedWebSocketService extends EventEmitter {
  private wsServer: WebSocketServer;
  private connectionManager: WebSocketConnectionManager;
  private authService: WebSocketAuthService;
  private broadcastService: DataBroadcastService;
  private clientManager: WebSocketClientManager;
  
  private config: WebSocketServiceConfig;
  private startTime: number;
  private performanceMetrics: {
    totalBroadcasts: number;
    totalConnections: number;
    totalDisconnections: number;
    totalErrors: number;
  };
  
  private optimizationInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private isShuttingDown: boolean = false;

  constructor(httpServer: HTTPServer, config?: Partial<WebSocketServiceConfig>) {
    super();
    
    this.config = {
      maxConnections: 1000,
      maxConnectionsPerUser: 10,
      connectionTimeout: 300000, // 5 minutes
      heartbeatInterval: 30000, // 30 seconds
      cleanupInterval: 60000, // 1 minute
      rateLimitWindow: 60000, // 1 minute
      rateLimitMax: 100,
      enableAuthentication: true,
      allowAnonymous: true,
      enableMetrics: true,
      enableResourceOptimization: true,
      ...config
    };

    this.startTime = Date.now();
    this.performanceMetrics = {
      totalBroadcasts: 0,
      totalConnections: 0,
      totalDisconnections: 0,
      totalErrors: 0
    };

    // Initialize services
    this.initializeServices(httpServer);
    this.setupEventHandlers();
    this.startMonitoring();

    logger.info('Enhanced WebSocket Service initialized with advanced features');
  }

  private initializeServices(httpServer: HTTPServer): void {
    // Initialize connection manager
    this.connectionManager = new WebSocketConnectionManager({
      maxConnections: this.config.maxConnections,
      maxConnectionsPerUser: this.config.maxConnectionsPerUser,
      connectionTimeout: this.config.connectionTimeout,
      heartbeatInterval: this.config.heartbeatInterval,
      cleanupInterval: this.config.cleanupInterval,
      rateLimitWindow: this.config.rateLimitWindow,
      rateLimitMax: this.config.rateLimitMax
    });

    // Initialize authentication service
    this.authService = new WebSocketAuthService({
      requireAuthentication: this.config.enableAuthentication,
      allowAnonymous: this.config.allowAnonymous,
      maxSessionDuration: 24 * 60 * 60 * 1000, // 24 hours
      allowedOrigins: [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'http://localhost:3000',
        'https://localhost:3000',
        'http://127.0.0.1:3000',
        'https://127.0.0.1:3000'
      ]
    });

    // Initialize WebSocket server
    this.wsServer = new WebSocketServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || config.websocket.cors.origin,
        credentials: true
      },
      rateLimit: {
        windowMs: this.config.rateLimitWindow,
        maxRequests: this.config.rateLimitMax
      },
      maxConnections: this.config.maxConnections,
      heartbeatInterval: this.config.heartbeatInterval,
      connectionTimeout: this.config.connectionTimeout
    });

    // Initialize broadcast service
    this.broadcastService = new DataBroadcastService(this.wsServer);

    // Initialize client manager
    this.clientManager = new WebSocketClientManager();
  }

  private setupEventHandlers(): void {
    // WebSocket Server Events
    this.wsServer.on('connection', (data) => {
      this.performanceMetrics.totalConnections++;
      this.connectionManager.addConnection(data as any);
      this.clientManager.registerClient(data as any);
      
      logger.info(`WebSocket connection established: ${data.socketId} (User: ${data.userId})`);
      this.emit('connection', data);
    });

    this.wsServer.on('disconnection', (data) => {
      this.performanceMetrics.totalDisconnections++;
      this.connectionManager.removeConnection(data.socketId);
      this.clientManager.unregisterClient(data.socketId);
      
      logger.info(`WebSocket connection closed: ${data.socketId} (Reason: ${data.reason})`);
      this.emit('disconnection', data);
    });

    this.wsServer.on('subscription', (data) => {
      data.channels.forEach(channel => {
        this.connectionManager.subscribeToChannel(data.socketId, channel);
        this.clientManager.addClientSubscription(data.socketId, channel);
      });
      
      logger.debug(`Channel subscription: ${data.channels.join(', ')} by ${data.socketId}`);
      this.emit('subscription', data);
    });

    this.wsServer.on('unsubscription', (data) => {
      data.channels.forEach(channel => {
        this.connectionManager.unsubscribeFromChannel(data.socketId, channel);
        this.clientManager.removeClientSubscription(data.socketId, channel);
      });
      
      logger.debug(`Channel unsubscription: ${data.channels.join(', ')} by ${data.socketId}`);
      this.emit('unsubscription', data);
    });

    this.wsServer.on('broadcast', (data) => {
      this.performanceMetrics.totalBroadcasts++;
      this.emit('broadcast', data);
    });

    this.wsServer.on('error', (data) => {
      this.performanceMetrics.totalErrors++;
      logger.error(`WebSocket error on ${data.socketId}:`, data.error);
      this.emit('error', data);
    });

    // Connection Manager Events
    this.connectionManager.on('connectionLimitReached', (data) => {
      logger.warn(`WebSocket connection limit reached: ${data.current}/${data.max}`);
      this.emit('connectionLimitReached', data);
    });

    this.connectionManager.on('metrics', (metrics) => {
      if (this.config.enableMetrics) {
        logger.debug(`WebSocket metrics - Connections: ${metrics.totalConnections}, Messages/sec: ${metrics.messagesPerSecond.toFixed(2)}`);
        this.emit('metrics', metrics);
      }
    });

    this.connectionManager.on('staleConnectionsRemoved', (data) => {
      logger.info(`Removed ${data.count} stale connections`);
      this.emit('staleConnectionsRemoved', data);
    });

    // Authentication Service Events
    this.authService.on('authenticationFailure', (data) => {
      logger.warn(`WebSocket auth failure from ${data.ipAddress}: ${data.error}`);
      this.emit('authenticationFailure', data);
    });

    this.authService.on('ipBlocked', (data) => {
      logger.warn(`IP blocked for WebSocket abuse: ${data.ipAddress}`);
      this.emit('ipBlocked', data);
    });

    this.authService.on('sessionInvalidated', (data) => {
      logger.info(`WebSocket session invalidated: ${data.sessionId} for user ${data.userId}`);
      this.emit('sessionInvalidated', data);
    });
  }

  private startMonitoring(): void {
    if (this.config.enableResourceOptimization) {
      // Resource optimization every 5 minutes
      this.optimizationInterval = setInterval(() => {
        this.optimizeResources();
      }, 300000);
    }

    if (this.config.enableMetrics) {
      // Metrics collection every 30 seconds
      this.metricsInterval = setInterval(() => {
        this.collectMetrics();
      }, 30000);
    }
  }

  private optimizeResources(): void {
    if (this.isShuttingDown) return;

    try {
      // Optimize WebSocket server connections
      this.wsServer.optimizeConnections();

      // Clean up inactive clients
      const inactiveClients = this.clientManager.getInactiveClients(600000); // 10 minutes
      inactiveClients.forEach(client => {
        this.wsServer.disconnectClient(client.socketId, 'Resource optimization cleanup');
      });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      logger.debug('WebSocket resource optimization completed');
    } catch (error) {
      logger.error('Error during WebSocket resource optimization:', error);
    }
  }

  private collectMetrics(): void {
    if (this.isShuttingDown) return;

    try {
      const metrics = this.getComprehensiveStats();
      this.emit('metricsCollected', metrics);
    } catch (error) {
      logger.error('Error collecting WebSocket metrics:', error);
    }
  }

  // Public API Methods

  /**
   * Start the WebSocket service
   */
  public start(): void {
    logger.info('🌐 Enhanced WebSocket Service started');
    this.emit('serviceStarted', { timestamp: Date.now() });
  }

  /**
   * Stop the WebSocket service
   */
  public async stop(): Promise<void> {
    logger.info('Stopping Enhanced WebSocket Service...');
    this.isShuttingDown = true;

    // Stop monitoring intervals
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Shutdown services in order
    await Promise.all([
      this.wsServer.shutdown(),
      this.connectionManager.shutdown(),
      this.clientManager.shutdown()
    ]);

    this.authService.shutdown();
    this.broadcastService.cleanup();

    logger.info('🛑 Enhanced WebSocket Service stopped');
    this.emit('serviceStopped', { timestamp: Date.now() });
  }

  /**
   * Broadcast message to a channel
   */
  public broadcastToChannel(channel: string, message: WebSocketMessage): void {
    this.wsServer.broadcastToChannel(channel, message);
  }

  /**
   * Broadcast message to a user
   */
  public broadcastToUser(userId: string, message: WebSocketMessage): void {
    this.wsServer.broadcastToUser(userId, message);
  }

  /**
   * Broadcast message to all clients
   */
  public broadcastToAll(message: WebSocketMessage): void {
    this.wsServer.broadcastToAll(message);
  }

  /**
   * Broadcast batch messages
   */
  public broadcastBatch(broadcasts: Array<{
    type: 'channel' | 'user' | 'all';
    target?: string;
    message: WebSocketMessage;
  }>): void {
    this.wsServer.broadcastBatch(broadcasts);
  }

  /**
   * Disconnect a client
   */
  public disconnectClient(socketId: string, reason?: string): void {
    this.wsServer.disconnectClient(socketId, reason);
  }

  /**
   * Disconnect all connections for a user
   */
  public disconnectUser(userId: string, reason?: string): void {
    this.wsServer.disconnectUser(userId, reason);
  }

  /**
   * Disconnect connections by IP address
   */
  public disconnectByIP(ipAddress: string, reason?: string): number {
    return this.wsServer.disconnectByIP(ipAddress, reason);
  }

  /**
   * Get comprehensive service statistics
   */
  public getComprehensiveStats(): WebSocketServiceStats {
    const memoryUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime;

    return {
      server: this.wsServer.getServerStats(),
      connectionManager: this.connectionManager.getDetailedStats(),
      auth: this.authService.getSecurityStats(),
      clientManager: this.clientManager.getClientStats(),
      broadcast: this.broadcastService.getStats(),
      performance: {
        uptime,
        memoryUsage,
        eventLoopLag: 0, // Would need additional monitoring
        totalBroadcasts: this.performanceMetrics.totalBroadcasts,
        totalConnections: this.performanceMetrics.totalConnections,
        totalDisconnections: this.performanceMetrics.totalDisconnections
      }
    };
  }

  /**
   * Get health status
   */
  public getHealthStatus() {
    const stats = this.getComprehensiveStats();
    const isHealthy = !this.isShuttingDown && 
                     stats.server.connections.total < this.config.maxConnections * 0.9;

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      websocket: {
        connections: stats.server.connections.total,
        channels: stats.server.channels.total,
        performance: stats.performance
      },
      memory: stats.performance.memoryUsage,
      uptime: stats.performance.uptime,
      timestamp: Date.now()
    };
  }

  /**
   * Get available channels for a user
   */
  public getAvailableChannels(userId?: string, userRole?: string) {
    return this.clientManager.getAvailableChannels(userId, userRole);
  }

  /**
   * Validate channel access for a user
   */
  public validateChannelAccess(channel: string, userId?: string, userRole?: string): boolean {
    return this.clientManager.validateChannelAccess(channel, userId, userRole);
  }

  /**
   * Get connection information
   */
  public getConnectionInfo(socketId: string) {
    return this.connectionManager.getConnectionInfo(socketId);
  }

  /**
   * Get user connections
   */
  public getUserConnections(userId: string) {
    return this.connectionManager.getUserConnections(userId);
  }

  /**
   * Get channel subscribers
   */
  public getChannelSubscribers(channel: string) {
    return this.connectionManager.getChannelSubscribers(channel);
  }

  // Broadcast Service Proxy Methods
  public broadcastMarketData(data: any): void {
    this.broadcastService.emit('market_data', data);
  }

  public broadcastTradingSignal(data: any): void {
    this.broadcastService.emit('trading_signal', data);
  }

  public broadcastTradeExecution(data: any): void {
    this.broadcastService.emit('trade_execution', data);
  }

  public broadcastPositionUpdate(data: any): void {
    this.broadcastService.emit('position_update', data);
  }

  public broadcastSystemStatus(data: any): void {
    this.broadcastService.emit('system_status', data);
  }

  public broadcastUserAlert(data: any): void {
    this.broadcastService.emit('user_alert', data);
  }

  public broadcastRiskAlert(data: any): void {
    this.broadcastService.broadcastRiskAlert(data);
  }

  public broadcastGridUpdate(data: any): void {
    this.broadcastService.broadcastGridUpdate(data);
  }

  public broadcastPerformanceMetrics(data: any): void {
    this.broadcastService.broadcastPerformanceMetrics(data);
  }
}