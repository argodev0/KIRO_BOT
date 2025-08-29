/**
 * WebSocket Stability Manager
 * Enhances WebSocket connection stability with advanced features
 */

import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { AuthenticatedSocket } from './WebSocketServer';

export interface StabilityConfig {
  heartbeatInterval: number;
  connectionTimeout: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  maxReconnectDelay: number;
  healthCheckInterval: number;
  staleConnectionThreshold: number;
  enableAutoRecovery: boolean;
  enableConnectionPooling: boolean;
  maxConnectionsPerIP: number;
  enableRateLimiting: boolean;
  rateLimitWindow: number;
  rateLimitMax: number;
}

export interface ConnectionHealth {
  socketId: string;
  isHealthy: boolean;
  lastHeartbeat: number;
  lastActivity: number;
  missedHeartbeats: number;
  connectionTime: number;
  messagesReceived: number;
  messagesSent: number;
  errors: number;
  reconnectAttempts: number;
}

export interface StabilityMetrics {
  totalConnections: number;
  healthyConnections: number;
  unhealthyConnections: number;
  staleConnections: number;
  totalReconnections: number;
  failedReconnections: number;
  averageConnectionTime: number;
  averageResponseTime: number;
  errorRate: number;
  uptime: number;
}

export class WebSocketStabilityManager extends EventEmitter {
  private config: StabilityConfig;
  private connectionHealth: Map<string, ConnectionHealth> = new Map();
  private heartbeatInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private startTime: number;
  private metrics: {
    totalReconnections: number;
    failedReconnections: number;
    totalErrors: number;
    totalMessages: number;
  };

  constructor(config?: Partial<StabilityConfig>) {
    super();
    
    this.config = {
      heartbeatInterval: 30000, // 30 seconds
      connectionTimeout: 300000, // 5 minutes
      maxReconnectAttempts: 5,
      reconnectDelay: 1000, // 1 second
      maxReconnectDelay: 30000, // 30 seconds
      healthCheckInterval: 60000, // 1 minute
      staleConnectionThreshold: 600000, // 10 minutes
      enableAutoRecovery: true,
      enableConnectionPooling: true,
      maxConnectionsPerIP: 10,
      enableRateLimiting: true,
      rateLimitWindow: 60000, // 1 minute
      rateLimitMax: 100,
      ...config
    };

    this.startTime = Date.now();
    this.metrics = {
      totalReconnections: 0,
      failedReconnections: 0,
      totalErrors: 0,
      totalMessages: 0
    };

    this.startMonitoring();
    logger.info('WebSocket Stability Manager initialized');
  }

  /**
   * Register a new connection for monitoring
   */
  public registerConnection(socket: AuthenticatedSocket): void {
    const health: ConnectionHealth = {
      socketId: socket.id,
      isHealthy: true,
      lastHeartbeat: Date.now(),
      lastActivity: Date.now(),
      missedHeartbeats: 0,
      connectionTime: Date.now(),
      messagesReceived: 0,
      messagesSent: 0,
      errors: 0,
      reconnectAttempts: 0
    };

    this.connectionHealth.set(socket.id, health);
    
    // Set up socket event listeners for stability monitoring
    this.setupSocketMonitoring(socket);
    
    logger.debug(`Connection registered for stability monitoring: ${socket.id}`);
    this.emit('connectionRegistered', { socketId: socket.id, health });
  }

  /**
   * Unregister a connection from monitoring
   */
  public unregisterConnection(socketId: string): void {
    const health = this.connectionHealth.get(socketId);
    if (health) {
      this.connectionHealth.delete(socketId);
      logger.debug(`Connection unregistered from stability monitoring: ${socketId}`);
      this.emit('connectionUnregistered', { socketId, health });
    }
  }

  /**
   * Update connection activity
   */
  public updateActivity(socketId: string, type: 'message_received' | 'message_sent' | 'error'): void {
    const health = this.connectionHealth.get(socketId);
    if (health) {
      health.lastActivity = Date.now();
      
      switch (type) {
        case 'message_received':
          health.messagesReceived++;
          this.metrics.totalMessages++;
          break;
        case 'message_sent':
          health.messagesSent++;
          this.metrics.totalMessages++;
          break;
        case 'error':
          health.errors++;
          this.metrics.totalErrors++;
          break;
      }
    }
  }

  /**
   * Send heartbeat to a connection
   */
  public sendHeartbeat(socket: AuthenticatedSocket): void {
    const health = this.connectionHealth.get(socket.id);
    if (!health) return;

    try {
      const heartbeatMessage = {
        type: 'heartbeat',
        timestamp: Date.now(),
        serverTime: Date.now()
      };

      socket.emit('heartbeat', heartbeatMessage);
      health.lastHeartbeat = Date.now();
      
      logger.debug(`Heartbeat sent to ${socket.id}`);
    } catch (error) {
      logger.error(`Failed to send heartbeat to ${socket.id}:`, error);
      this.handleConnectionError(socket.id, error as Error);
    }
  }

  /**
   * Handle heartbeat response
   */
  public handleHeartbeatResponse(socketId: string): void {
    const health = this.connectionHealth.get(socketId);
    if (health) {
      health.missedHeartbeats = 0;
      health.isHealthy = true;
      health.lastActivity = Date.now();
      
      logger.debug(`Heartbeat response received from ${socketId}`);
    }
  }

  /**
   * Check connection health
   */
  public checkConnectionHealth(socketId: string): boolean {
    const health = this.connectionHealth.get(socketId);
    if (!health) return false;

    const now = Date.now();
    const timeSinceLastActivity = now - health.lastActivity;
    const timeSinceLastHeartbeat = now - health.lastHeartbeat;

    // Check if connection is stale
    if (timeSinceLastActivity > this.config.staleConnectionThreshold) {
      health.isHealthy = false;
      this.emit('staleConnection', { socketId, health });
      return false;
    }

    // Check missed heartbeats
    if (timeSinceLastHeartbeat > this.config.heartbeatInterval * 2) {
      health.missedHeartbeats++;
      
      if (health.missedHeartbeats >= 3) {
        health.isHealthy = false;
        this.emit('unhealthyConnection', { socketId, health });
        return false;
      }
    }

    return health.isHealthy;
  }

  /**
   * Get connection health status
   */
  public getConnectionHealth(socketId: string): ConnectionHealth | null {
    return this.connectionHealth.get(socketId) || null;
  }

  /**
   * Get all unhealthy connections
   */
  public getUnhealthyConnections(): ConnectionHealth[] {
    return Array.from(this.connectionHealth.values()).filter(health => !health.isHealthy);
  }

  /**
   * Get stability metrics
   */
  public getStabilityMetrics(): StabilityMetrics {
    const connections = Array.from(this.connectionHealth.values());
    const now = Date.now();
    
    const healthyConnections = connections.filter(h => h.isHealthy).length;
    const unhealthyConnections = connections.filter(h => !h.isHealthy).length;
    const staleConnections = connections.filter(h => 
      now - h.lastActivity > this.config.staleConnectionThreshold
    ).length;

    const totalConnectionTime = connections.reduce((sum, h) => sum + (now - h.connectionTime), 0);
    const averageConnectionTime = connections.length > 0 ? totalConnectionTime / connections.length : 0;

    const totalMessages = this.metrics.totalMessages;
    const uptime = now - this.startTime;
    const errorRate = totalMessages > 0 ? (this.metrics.totalErrors / totalMessages) * 100 : 0;

    return {
      totalConnections: connections.length,
      healthyConnections,
      unhealthyConnections,
      staleConnections,
      totalReconnections: this.metrics.totalReconnections,
      failedReconnections: this.metrics.failedReconnections,
      averageConnectionTime,
      averageResponseTime: 0, // Would need additional tracking
      errorRate,
      uptime
    };
  }

  /**
   * Attempt to recover an unhealthy connection
   */
  public async recoverConnection(socket: AuthenticatedSocket): Promise<boolean> {
    if (!this.config.enableAutoRecovery) return false;

    const health = this.connectionHealth.get(socket.id);
    if (!health) return false;

    try {
      logger.info(`Attempting to recover connection: ${socket.id}`);
      
      // Reset health status
      health.missedHeartbeats = 0;
      health.lastActivity = Date.now();
      health.reconnectAttempts++;

      // Send recovery heartbeat
      this.sendHeartbeat(socket);

      // Wait for response
      await this.sleep(5000);

      // Check if recovery was successful
      const isRecovered = this.checkConnectionHealth(socket.id);
      
      if (isRecovered) {
        health.isHealthy = true;
        this.metrics.totalReconnections++;
        logger.info(`Connection recovery successful: ${socket.id}`);
        this.emit('connectionRecovered', { socketId: socket.id, health });
        return true;
      } else {
        this.metrics.failedReconnections++;
        logger.warn(`Connection recovery failed: ${socket.id}`);
        this.emit('connectionRecoveryFailed', { socketId: socket.id, health });
        return false;
      }
    } catch (error) {
      this.metrics.failedReconnections++;
      logger.error(`Connection recovery error for ${socket.id}:`, error);
      this.emit('connectionRecoveryError', { socketId: socket.id, error });
      return false;
    }
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(socketId: string, error: Error): void {
    const health = this.connectionHealth.get(socketId);
    if (health) {
      health.errors++;
      health.isHealthy = false;
      this.metrics.totalErrors++;
    }

    logger.error(`Connection error for ${socketId}:`, error);
    this.emit('connectionError', { socketId, error, health });
  }

  /**
   * Set up socket monitoring
   */
  private setupSocketMonitoring(socket: AuthenticatedSocket): void {
    // Monitor message events
    const originalEmit = socket.emit.bind(socket);
    socket.emit = (...args: any[]) => {
      this.updateActivity(socket.id, 'message_sent');
      return originalEmit(...args);
    };

    // Monitor incoming messages
    socket.on('message', () => {
      this.updateActivity(socket.id, 'message_received');
    });

    // Monitor pong responses (heartbeat responses)
    socket.on('pong', () => {
      this.handleHeartbeatResponse(socket.id);
    });

    // Monitor errors
    socket.on('error', (error) => {
      this.handleConnectionError(socket.id, error);
    });

    // Monitor disconnection
    socket.on('disconnect', () => {
      this.unregisterConnection(socket.id);
    });
  }

  /**
   * Start monitoring processes
   */
  private startMonitoring(): void {
    // Heartbeat interval
    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeatCheck();
    }, this.config.heartbeatInterval);

    // Health check interval
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);

    // Cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.config.healthCheckInterval * 2);

    logger.info('WebSocket stability monitoring started');
  }

  /**
   * Perform heartbeat check on all connections
   */
  private performHeartbeatCheck(): void {
    const connections = Array.from(this.connectionHealth.keys());
    
    connections.forEach(socketId => {
      const isHealthy = this.checkConnectionHealth(socketId);
      if (!isHealthy) {
        logger.debug(`Unhealthy connection detected: ${socketId}`);
      }
    });

    this.emit('heartbeatCheck', {
      totalConnections: connections.length,
      timestamp: Date.now()
    });
  }

  /**
   * Perform comprehensive health check
   */
  private performHealthCheck(): void {
    const metrics = this.getStabilityMetrics();
    const unhealthyConnections = this.getUnhealthyConnections();

    logger.debug(`Health check - Total: ${metrics.totalConnections}, Healthy: ${metrics.healthyConnections}, Unhealthy: ${metrics.unhealthyConnections}`);

    // Emit health check event
    this.emit('healthCheck', {
      metrics,
      unhealthyConnections: unhealthyConnections.map(h => h.socketId),
      timestamp: Date.now()
    });

    // Alert if too many unhealthy connections
    if (metrics.unhealthyConnections > metrics.totalConnections * 0.2) {
      logger.warn(`High number of unhealthy connections: ${metrics.unhealthyConnections}/${metrics.totalConnections}`);
      this.emit('highUnhealthyConnectionsAlert', { metrics });
    }
  }

  /**
   * Perform cleanup of stale data
   */
  private performCleanup(): void {
    const now = Date.now();
    const staleThreshold = this.config.staleConnectionThreshold;
    let cleanedUp = 0;

    // Remove stale connection health records
    for (const [socketId, health] of this.connectionHealth.entries()) {
      if (now - health.lastActivity > staleThreshold * 2) {
        this.connectionHealth.delete(socketId);
        cleanedUp++;
      }
    }

    if (cleanedUp > 0) {
      logger.debug(`Cleaned up ${cleanedUp} stale connection health records`);
    }

    this.emit('cleanup', {
      cleanedUp,
      remaining: this.connectionHealth.size,
      timestamp: now
    });
  }

  /**
   * Stop monitoring
   */
  public stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.connectionHealth.clear();
    logger.info('WebSocket stability monitoring stopped');
  }

  /**
   * Get detailed stability report
   */
  public getStabilityReport(): {
    metrics: StabilityMetrics;
    connections: ConnectionHealth[];
    config: StabilityConfig;
    uptime: number;
  } {
    return {
      metrics: this.getStabilityMetrics(),
      connections: Array.from(this.connectionHealth.values()),
      config: this.config,
      uptime: Date.now() - this.startTime
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}