/**
 * WebSocket Connection Recovery Service
 * Handles automatic reconnection and connection recovery
 */

import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { AuthenticatedSocket } from './WebSocketServer';

export interface RecoveryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterMax: number;
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  enableHealthCheck: boolean;
  healthCheckInterval: number;
}

export interface RecoveryAttempt {
  socketId: string;
  attempt: number;
  timestamp: number;
  delay: number;
  success: boolean;
  error?: Error;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailure: number;
  nextAttempt: number;
}

export class WebSocketConnectionRecovery extends EventEmitter {
  private config: RecoveryConfig;
  private recoveryAttempts: Map<string, RecoveryAttempt[]> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private activeRecoveries: Set<string> = new Set();
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config?: Partial<RecoveryConfig>) {
    super();
    
    this.config = {
      maxRetries: 5,
      initialDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      backoffMultiplier: 2,
      jitterMax: 1000, // 1 second
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000, // 1 minute
      enableHealthCheck: true,
      healthCheckInterval: 30000, // 30 seconds
      ...config
    };

    if (this.config.enableHealthCheck) {
      this.startHealthCheck();
    }

    logger.info('WebSocket Connection Recovery service initialized');
  }

  /**
   * Attempt to recover a failed connection
   */
  public async recoverConnection(
    socket: AuthenticatedSocket,
    createNewConnection: () => Promise<AuthenticatedSocket>
  ): Promise<boolean> {
    const socketId = socket.id;
    
    if (this.activeRecoveries.has(socketId)) {
      logger.debug(`Recovery already in progress for ${socketId}`);
      return false;
    }

    // Check circuit breaker
    if (this.config.enableCircuitBreaker && this.isCircuitBreakerOpen(socketId)) {
      logger.warn(`Circuit breaker open for ${socketId}, skipping recovery`);
      return false;
    }

    this.activeRecoveries.add(socketId);
    
    try {
      const success = await this.performRecovery(socket, createNewConnection);
      
      if (success) {
        this.resetCircuitBreaker(socketId);
        this.clearRecoveryHistory(socketId);
      } else {
        this.updateCircuitBreaker(socketId, false);
      }
      
      return success;
    } finally {
      this.activeRecoveries.delete(socketId);
    }
  }

  /**
   * Perform the actual recovery process
   */
  private async performRecovery(
    socket: AuthenticatedSocket,
    createNewConnection: () => Promise<AuthenticatedSocket>
  ): Promise<boolean> {
    const socketId = socket.id;
    const attempts = this.getRecoveryAttempts(socketId);
    const attemptNumber = attempts.length + 1;

    if (attemptNumber > this.config.maxRetries) {
      logger.error(`Max recovery attempts reached for ${socketId}`);
      this.emit('recoveryFailed', { socketId, reason: 'max_attempts_reached' });
      return false;
    }

    const delay = this.calculateDelay(attemptNumber);
    
    logger.info(`Starting recovery attempt ${attemptNumber} for ${socketId} (delay: ${delay}ms)`);
    
    const attempt: RecoveryAttempt = {
      socketId,
      attempt: attemptNumber,
      timestamp: Date.now(),
      delay,
      success: false
    };

    // Wait for the calculated delay
    await this.sleep(delay);

    try {
      // Attempt to create new connection
      const newSocket = await this.createConnectionWithTimeout(createNewConnection, 10000);
      
      // Verify the new connection is working
      const isHealthy = await this.verifyConnection(newSocket);
      
      if (isHealthy) {
        attempt.success = true;
        this.recordRecoveryAttempt(socketId, attempt);
        
        logger.info(`Connection recovery successful for ${socketId} on attempt ${attemptNumber}`);
        this.emit('recoverySuccess', { 
          socketId, 
          newSocketId: newSocket.id, 
          attempt: attemptNumber,
          totalTime: Date.now() - attempt.timestamp
        });
        
        return true;
      } else {
        throw new Error('New connection failed health check');
      }
    } catch (error) {
      attempt.error = error as Error;
      this.recordRecoveryAttempt(socketId, attempt);
      
      logger.warn(`Recovery attempt ${attemptNumber} failed for ${socketId}:`, error);
      this.emit('recoveryAttemptFailed', { 
        socketId, 
        attempt: attemptNumber, 
        error: error as Error 
      });

      // If not the last attempt, schedule next one
      if (attemptNumber < this.config.maxRetries) {
        setTimeout(() => {
          this.performRecovery(socket, createNewConnection);
        }, this.calculateDelay(attemptNumber + 1));
      }
      
      return false;
    }
  }

  /**
   * Create connection with timeout
   */
  private async createConnectionWithTimeout(
    createConnection: () => Promise<AuthenticatedSocket>,
    timeout: number
  ): Promise<AuthenticatedSocket> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Connection creation timeout'));
      }, timeout);

      createConnection()
        .then(socket => {
          clearTimeout(timer);
          resolve(socket);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Verify that a connection is healthy
   */
  private async verifyConnection(socket: AuthenticatedSocket): Promise<boolean> {
    return new Promise((resolve) => {
      let verified = false;
      
      const timeout = setTimeout(() => {
        if (!verified) {
          verified = true;
          resolve(false);
        }
      }, 5000);

      // Send ping and wait for pong
      const pingHandler = () => {
        if (!verified) {
          verified = true;
          clearTimeout(timeout);
          socket.off('pong', pingHandler);
          resolve(true);
        }
      };

      socket.on('pong', pingHandler);
      
      try {
        socket.emit('ping', { timestamp: Date.now() });
      } catch (error) {
        if (!verified) {
          verified = true;
          clearTimeout(timeout);
          resolve(false);
        }
      }
    });
  }

  /**
   * Calculate delay for next retry attempt
   */
  private calculateDelay(attemptNumber: number): number {
    const baseDelay = Math.min(
      this.config.initialDelay * Math.pow(this.config.backoffMultiplier, attemptNumber - 1),
      this.config.maxDelay
    );
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * this.config.jitterMax;
    
    return Math.floor(baseDelay + jitter);
  }

  /**
   * Record a recovery attempt
   */
  private recordRecoveryAttempt(socketId: string, attempt: RecoveryAttempt): void {
    if (!this.recoveryAttempts.has(socketId)) {
      this.recoveryAttempts.set(socketId, []);
    }
    
    const attempts = this.recoveryAttempts.get(socketId)!;
    attempts.push(attempt);
    
    // Keep only recent attempts (last 10)
    if (attempts.length > 10) {
      attempts.splice(0, attempts.length - 10);
    }
  }

  /**
   * Get recovery attempts for a socket
   */
  private getRecoveryAttempts(socketId: string): RecoveryAttempt[] {
    return this.recoveryAttempts.get(socketId) || [];
  }

  /**
   * Clear recovery history for a socket
   */
  private clearRecoveryHistory(socketId: string): void {
    this.recoveryAttempts.delete(socketId);
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitBreakerOpen(socketId: string): boolean {
    const breaker = this.circuitBreakers.get(socketId);
    if (!breaker) return false;

    const now = Date.now();
    
    if (breaker.state === 'open') {
      if (now >= breaker.nextAttempt) {
        // Transition to half-open
        breaker.state = 'half-open';
        logger.debug(`Circuit breaker transitioning to half-open for ${socketId}`);
        return false;
      }
      return true;
    }
    
    return false;
  }

  /**
   * Update circuit breaker state
   */
  private updateCircuitBreaker(socketId: string, success: boolean): void {
    if (!this.config.enableCircuitBreaker) return;

    let breaker = this.circuitBreakers.get(socketId);
    if (!breaker) {
      breaker = {
        state: 'closed',
        failures: 0,
        lastFailure: 0,
        nextAttempt: 0
      };
      this.circuitBreakers.set(socketId, breaker);
    }

    const now = Date.now();

    if (success) {
      if (breaker.state === 'half-open') {
        // Success in half-open state, close the circuit
        breaker.state = 'closed';
        breaker.failures = 0;
        logger.info(`Circuit breaker closed for ${socketId}`);
      }
    } else {
      breaker.failures++;
      breaker.lastFailure = now;

      if (breaker.failures >= this.config.circuitBreakerThreshold) {
        breaker.state = 'open';
        breaker.nextAttempt = now + this.config.circuitBreakerTimeout;
        logger.warn(`Circuit breaker opened for ${socketId} (failures: ${breaker.failures})`);
        
        this.emit('circuitBreakerOpened', { 
          socketId, 
          failures: breaker.failures,
          nextAttempt: breaker.nextAttempt
        });
      }
    }
  }

  /**
   * Reset circuit breaker
   */
  private resetCircuitBreaker(socketId: string): void {
    const breaker = this.circuitBreakers.get(socketId);
    if (breaker) {
      breaker.state = 'closed';
      breaker.failures = 0;
      breaker.lastFailure = 0;
      breaker.nextAttempt = 0;
    }
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health check on recovery service
   */
  private performHealthCheck(): void {
    const now = Date.now();
    const activeRecoveries = this.activeRecoveries.size;
    const totalAttempts = Array.from(this.recoveryAttempts.values())
      .reduce((sum, attempts) => sum + attempts.length, 0);
    
    const recentAttempts = Array.from(this.recoveryAttempts.values())
      .flat()
      .filter(attempt => now - attempt.timestamp < 300000); // Last 5 minutes
    
    const successfulAttempts = recentAttempts.filter(attempt => attempt.success).length;
    const successRate = recentAttempts.length > 0 ? 
      (successfulAttempts / recentAttempts.length) * 100 : 100;

    const openCircuitBreakers = Array.from(this.circuitBreakers.values())
      .filter(breaker => breaker.state === 'open').length;

    this.emit('healthCheck', {
      activeRecoveries,
      totalAttempts,
      recentAttempts: recentAttempts.length,
      successRate,
      openCircuitBreakers,
      timestamp: now
    });

    logger.debug(`Recovery service health - Active: ${activeRecoveries}, Success rate: ${successRate.toFixed(1)}%, Open breakers: ${openCircuitBreakers}`);
  }

  /**
   * Get recovery statistics
   */
  public getRecoveryStats(): {
    activeRecoveries: number;
    totalSockets: number;
    totalAttempts: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    averageRecoveryTime: number;
    circuitBreakers: {
      total: number;
      open: number;
      halfOpen: number;
      closed: number;
    };
  } {
    const allAttempts = Array.from(this.recoveryAttempts.values()).flat();
    const successfulRecoveries = allAttempts.filter(attempt => attempt.success).length;
    const failedRecoveries = allAttempts.filter(attempt => !attempt.success).length;
    
    const recoveryTimes = allAttempts
      .filter(attempt => attempt.success)
      .map(attempt => Date.now() - attempt.timestamp);
    
    const averageRecoveryTime = recoveryTimes.length > 0 ?
      recoveryTimes.reduce((sum, time) => sum + time, 0) / recoveryTimes.length : 0;

    const circuitBreakerStates = Array.from(this.circuitBreakers.values());
    const circuitBreakers = {
      total: circuitBreakerStates.length,
      open: circuitBreakerStates.filter(b => b.state === 'open').length,
      halfOpen: circuitBreakerStates.filter(b => b.state === 'half-open').length,
      closed: circuitBreakerStates.filter(b => b.state === 'closed').length
    };

    return {
      activeRecoveries: this.activeRecoveries.size,
      totalSockets: this.recoveryAttempts.size,
      totalAttempts: allAttempts.length,
      successfulRecoveries,
      failedRecoveries,
      averageRecoveryTime,
      circuitBreakers
    };
  }

  /**
   * Stop the recovery service
   */
  public stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.recoveryAttempts.clear();
    this.circuitBreakers.clear();
    this.activeRecoveries.clear();

    logger.info('WebSocket Connection Recovery service stopped');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}