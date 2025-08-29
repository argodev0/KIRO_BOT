/**
 * WebSocket Stability Enhancer
 * Provides stability improvements for existing WebSocket connections
 */

import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { AuthenticatedSocket } from './WebSocketServer';

export interface StabilityConfig {
  heartbeatInterval: number;
  connectionTimeout: number;
  maxMissedHeartbeats: number;
  enableAutoReconnect: boolean;
  reconnectDelay: number;
  maxReconnectAttempts: number;
  enableHealthMonitoring: boolean;
  healthCheckInterval: number;
}

export interface ConnectionStatus {
  socketId: string;
  isHealthy: boolean;
  lastSeen: number;
  missedHeartbeats: number;
  reconnectAttempts: number;
  connectionTime: number;
  totalMessages: number;
  errors: number;
}

export class WebSocketStabilityEnhancer extends EventEmitter {
  private config: StabilityConfig;
  private connections: Map<string, ConnectionStatus> = new Map();
  private heartbeatInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private isActive: boolean = false;

  constructor(config?: Partial<StabilityConfig>) {
    super();
    
    this.config = {
      heartbeatInterval: 30000, // 30 seconds
      connectionTimeout: 300000, // 5 minutes
      maxMissedHeartbeats: 3,
      enableAutoReconnect: true,
      reconnectDelay: 5000, // 5 seconds
      maxReconnectAttempts: 3,
      enableHealthMonitoring: true,
      healthCheckInterval: 60000, // 1 minute
      ...config
    };

    logger.info('WebSocket Stability Enhancer initialized');
  }

  /**
   * Start stability monitoring
   */
  public start(): void {
    if (this.isActive) {
      logger.warn('Stability enhancer already active');
      return;
    }

    this.isActive = true;

    // Start heartbeat monitoring
    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeatCheck();
    }, this.config.heartbeatInterval);

    // Start health monitoring
    if (this.config.enableHealthMonitoring) {
      this.healthCheckInterval = setInterval(() => {
        this.performHealthCheck();
      }, this.config.healthCheckInterval);
    }

    logger.info('WebSocket stability monitoring started');
    this.emit('started');
  }

  /**
   * Stop stability monitoring
   */
  public stop(): void {
    if (!this.isActive) return;

    this.isActive = false;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    this.connections.clear();

    logger.info('WebSocket stability monitoring stopped');
    this.emit('stopped');
  }

  /**
   * Register a connection for monitoring
   */
  public registerConnection(socket: AuthenticatedSocket): void {
    const status: ConnectionStatus = {
      socketId: socket.id,
      isHealthy: true,
      lastSeen: Date.now(),
      missedHeartbeats: 0,
      reconnectAttempts: 0,
      connectionTime: Date.now(),
      totalMessages: 0,
      errors: 0
    };

    this.connections.set(socket.id, status);

    // Set up socket event listeners
    this.setupSocketMonitoring(socket);

    logger.debug(`Connection registered for stability monitoring: ${socket.id}`);
    this.emit('connectionRegistered', { socketId: socket.id });
  }

  /**
   * Unregister a connection
   */
  public unregisterConnection(socketId: string): void {
    const status = this.connections.get(socketId);
    if (status) {
      this.connections.delete(socketId);
      logger.debug(`Connection unregistered: ${socketId}`);
      this.emit('connectionUnregistered', { socketId });
    }
  }

  /**
   * Update connection activity
   */
  public updateActivity(socketId: string): void {
    const status = this.connections.get(socketId);
    if (status) {
      status.lastSeen = Date.now();
      status.missedHeartbeats = 0;
      status.totalMessages++;
      
      if (!status.isHealthy) {
        status.isHealthy = true;
        logger.info(`Connection recovered: ${socketId}`);
        this.emit('connectionRecovered', { socketId });
      }
    }
  }

  /**
   * Record connection error
   */
  public recordError(socketId: string, error: Error): void {
    const status = this.connections.get(socketId);
    if (status) {
      status.errors++;
      logger.warn(`Connection error recorded for ${socketId}:`, error.message);
      this.emit('connectionError', { socketId, error });
    }
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(socketId: string): ConnectionStatus | null {
    return this.connections.get(socketId) || null;
  }

  /**
   * Get all connection statuses
   */
  public getAllConnectionStatuses(): ConnectionStatus[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get stability metrics
   */
  public getStabilityMetrics(): {
    totalConnections: number;
    healthyConnections: number;
    unhealthyConnections: number;
    averageUptime: number;
    totalMessages: number;
    totalErrors: number;
    errorRate: number;
  } {
    const connections = Array.from(this.connections.values());
    const now = Date.now();
    
    const healthyConnections = connections.filter(c => c.isHealthy).length;
    const unhealthyConnections = connections.filter(c => !c.isHealthy).length;
    
    const totalUptime = connections.reduce((sum, c) => sum + (now - c.connectionTime), 0);
    const averageUptime = connections.length > 0 ? totalUptime / connections.length : 0;
    
    const totalMessages = connections.reduce((sum, c) => sum + c.totalMessages, 0);
    const totalErrors = connections.reduce((sum, c) => sum + c.errors, 0);
    const errorRate = totalMessages > 0 ? (totalErrors / totalMessages) * 100 : 0;

    return {
      totalConnections: connections.length,
      healthyConnections,
      unhealthyConnections,
      averageUptime,
      totalMessages,
      totalErrors,
      errorRate
    };
  }

  /**
   * Set up monitoring for a socket
   */
  private setupSocketMonitoring(socket: AuthenticatedSocket): void {
    // Monitor all message events
    const originalEmit = socket.emit.bind(socket);
    socket.emit = (...args: any[]) => {
      this.updateActivity(socket.id);
      return originalEmit(...args);
    };

    // Monitor incoming messages
    socket.on('message', () => {
      this.updateActivity(socket.id);
    });

    // Monitor pong responses
    socket.on('pong', () => {
      this.updateActivity(socket.id);
    });

    // Monitor errors
    socket.on('error', (error) => {
      this.recordError(socket.id, error);
    });

    // Monitor disconnection
    socket.on('disconnect', () => {
      this.unregisterConnection(socket.id);
    });

    // Send initial heartbeat
    this.sendHeartbeat(socket);
  }

  /**
   * Send heartbeat to a socket
   */
  private sendHeartbeat(socket: AuthenticatedSocket): void {
    try {
      socket.emit('heartbeat', {
        type: 'heartbeat',
        timestamp: Date.now(),
        serverTime: Date.now()
      });
    } catch (error) {
      this.recordError(socket.id, error as Error);
    }
  }

  /**
   * Perform heartbeat check on all connections
   */
  private performHeartbeatCheck(): void {
    if (!this.isActive) return;

    const now = Date.now();
    let unhealthyCount = 0;

    for (const [socketId, status] of this.connections) {
      const timeSinceLastSeen = now - status.lastSeen;
      
      if (timeSinceLastSeen > this.config.heartbeatInterval) {
        status.missedHeartbeats++;
        
        if (status.missedHeartbeats >= this.config.maxMissedHeartbeats) {
          if (status.isHealthy) {
            status.isHealthy = false;
            unhealthyCount++;
            
            logger.warn(`Connection became unhealthy: ${socketId} (missed ${status.missedHeartbeats} heartbeats)`);
            this.emit('connectionUnhealthy', { 
              socketId, 
              missedHeartbeats: status.missedHeartbeats 
            });
          }
        }
      }
    }

    if (unhealthyCount > 0) {
      logger.warn(`Heartbeat check found ${unhealthyCount} unhealthy connections`);
    }

    this.emit('heartbeatCheck', {
      totalConnections: this.connections.size,
      unhealthyConnections: unhealthyCount,
      timestamp: now
    });
  }

  /**
   * Perform comprehensive health check
   */
  private performHealthCheck(): void {
    if (!this.isActive) return;

    const metrics = this.getStabilityMetrics();
    const now = Date.now();

    logger.debug(`Health check - Total: ${metrics.totalConnections}, Healthy: ${metrics.healthyConnections}, Error rate: ${metrics.errorRate.toFixed(2)}%`);

    // Check for high error rate
    if (metrics.errorRate > 10) {
      logger.warn(`High error rate detected: ${metrics.errorRate.toFixed(2)}%`);
      this.emit('highErrorRate', { errorRate: metrics.errorRate });
    }

    // Check for too many unhealthy connections
    if (metrics.unhealthyConnections > metrics.totalConnections * 0.2) {
      logger.warn(`High number of unhealthy connections: ${metrics.unhealthyConnections}/${metrics.totalConnections}`);
      this.emit('highUnhealthyConnections', { 
        unhealthy: metrics.unhealthyConnections,
        total: metrics.totalConnections
      });
    }

    this.emit('healthCheck', {
      metrics,
      timestamp: now
    });
  }

  /**
   * Attempt to recover unhealthy connections
   */
  public async recoverUnhealthyConnections(): Promise<number> {
    const unhealthyConnections = Array.from(this.connections.values())
      .filter(status => !status.isHealthy);

    let recoveredCount = 0;

    for (const status of unhealthyConnections) {
      try {
        // Reset heartbeat counter
        status.missedHeartbeats = 0;
        status.lastSeen = Date.now();
        status.isHealthy = true;
        
        recoveredCount++;
        
        logger.info(`Attempted recovery for connection: ${status.socketId}`);
        this.emit('recoveryAttempt', { socketId: status.socketId });
        
      } catch (error) {
        logger.error(`Recovery failed for ${status.socketId}:`, error);
      }
    }

    if (recoveredCount > 0) {
      logger.info(`Recovery attempted for ${recoveredCount} connections`);
    }

    return recoveredCount;
  }

  /**
   * Get detailed stability report
   */
  public getStabilityReport(): {
    isActive: boolean;
    config: StabilityConfig;
    metrics: ReturnType<typeof this.getStabilityMetrics>;
    connections: ConnectionStatus[];
    uptime: number;
  } {
    return {
      isActive: this.isActive,
      config: this.config,
      metrics: this.getStabilityMetrics(),
      connections: this.getAllConnectionStatuses(),
      uptime: Date.now()
    };
  }
}