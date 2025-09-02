import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { 
  HBConnection, 
  ConnectionRecoveryConfig,
  RecoveryAttempt,
  ConnectionState
} from '../types/hummingbot';

export interface RecoveryMetrics {
  totalAttempts: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  averageRecoveryTime: number;
  currentBackoffDelay: number;
}

export class HummingbotConnectionRecovery extends EventEmitter {
  private logger = logger;
  private config: ConnectionRecoveryConfig;
  private recoveryAttempts: Map<string, RecoveryAttempt> = new Map();
  private connectionStates: Map<string, ConnectionState> = new Map();
  private recoveryTimers: Map<string, NodeJS.Timeout> = new Map();
  private metrics: RecoveryMetrics;

  constructor(config: ConnectionRecoveryConfig) {
    super();
    this.config = config;
    this.metrics = {
      totalAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      averageRecoveryTime: 0,
      currentBackoffDelay: config.initialBackoffMs
    };
  }

  /**
   * Start recovery process for a failed connection
   */
  async startRecovery(
    instanceId: string, 
    connectionFactory: () => Promise<HBConnection>
  ): Promise<void> {
    if (this.recoveryAttempts.has(instanceId)) {
      this.logger.warn(`Recovery already in progress for instance ${instanceId}`);
      return;
    }

    const attempt: RecoveryAttempt = {
      instanceId,
      startTime: Date.now(),
      attemptCount: 0,
      maxAttempts: this.config.maxRetryAttempts,
      currentBackoff: this.config.initialBackoffMs,
      lastError: null
    };

    this.recoveryAttempts.set(instanceId, attempt);
    this.connectionStates.set(instanceId, 'recovering');

    this.emit('recovery-started', {
      instanceId,
      timestamp: Date.now()
    });

    await this.attemptRecoveryWithBackoff(instanceId, connectionFactory);
  }

  /**
   * Attempt recovery with exponential backoff
   */
  private async attemptRecoveryWithBackoff(
    instanceId: string,
    connectionFactory: () => Promise<HBConnection>
  ): Promise<void> {
    const attempt = this.recoveryAttempts.get(instanceId);
    if (!attempt) {
      return;
    }

    attempt.attemptCount++;
    this.metrics.totalAttempts++;

    this.logger.info(`Recovery attempt ${attempt.attemptCount} for instance ${instanceId}`, {
      backoffDelay: attempt.currentBackoff,
      maxAttempts: attempt.maxAttempts
    });

    try {
      // Wait for backoff delay
      await this.waitForBackoff(attempt.currentBackoff);

      // Attempt connection
      const connection = await this.attemptConnection(instanceId, connectionFactory);
      
      if (connection && connection.status === 'connected') {
        await this.handleSuccessfulRecovery(instanceId, connection);
      } else {
        throw new Error('Connection failed or not healthy');
      }
    } catch (error) {
      await this.handleFailedAttempt(instanceId, error as Error, connectionFactory);
    }
  }

  /**
   * Wait for backoff delay
   */
  private async waitForBackoff(delay: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, delay);
      // Store timer for potential cleanup
      this.recoveryTimers.set(`backoff-${Date.now()}`, timer);
    });
  }

  /**
   * Attempt to establish connection
   */
  private async attemptConnection(
    instanceId: string,
    connectionFactory: () => Promise<HBConnection>
  ): Promise<HBConnection> {
    const startTime = Date.now();
    
    try {
      const connection = await Promise.race([
        connectionFactory(),
        this.createTimeoutPromise(this.config.connectionTimeoutMs)
      ]);

      const connectionTime = Date.now() - startTime;
      
      this.logger.info(`Connection attempt completed for ${instanceId}`, {
        connectionTime,
        status: connection.status
      });

      return connection;
    } catch (error) {
      const connectionTime = Date.now() - startTime;
      
      this.logger.error(`Connection attempt failed for ${instanceId}`, {
        error: error.message,
        connectionTime
      });

      throw error;
    }
  }

  /**
   * Create timeout promise for connection attempts
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Connection timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      
      this.recoveryTimers.set(`timeout-${Date.now()}`, timer);
    });
  }

  /**
   * Handle successful recovery
   */
  private async handleSuccessfulRecovery(
    instanceId: string, 
    connection: HBConnection
  ): Promise<void> {
    const attempt = this.recoveryAttempts.get(instanceId);
    if (!attempt) {
      return;
    }

    const recoveryTime = Date.now() - attempt.startTime;
    
    // Update metrics
    this.metrics.successfulRecoveries++;
    this.metrics.averageRecoveryTime = 
      (this.metrics.averageRecoveryTime * (this.metrics.successfulRecoveries - 1) + recoveryTime) / 
      this.metrics.successfulRecoveries;

    // Update connection state
    this.connectionStates.set(instanceId, 'connected');

    // Clean up recovery attempt
    this.recoveryAttempts.delete(instanceId);

    // Reset backoff for this instance
    this.metrics.currentBackoffDelay = this.config.initialBackoffMs;

    this.logger.info(`Recovery successful for instance ${instanceId}`, {
      recoveryTime,
      attempts: attempt.attemptCount,
      connection: {
        instanceId: connection.instanceId,
        status: connection.status,
        apiVersion: connection.apiVersion
      }
    });

    this.emit('recovery-successful', {
      instanceId,
      recoveryTime,
      attempts: attempt.attemptCount,
      connection,
      timestamp: Date.now()
    });

    // Perform post-recovery validation
    await this.performPostRecoveryValidation(instanceId, connection);
  }

  /**
   * Handle failed recovery attempt
   */
  private async handleFailedAttempt(
    instanceId: string,
    error: Error,
    connectionFactory: () => Promise<HBConnection>
  ): Promise<void> {
    const attempt = this.recoveryAttempts.get(instanceId);
    if (!attempt) {
      return;
    }

    attempt.lastError = error;

    this.logger.warn(`Recovery attempt ${attempt.attemptCount} failed for ${instanceId}`, {
      error: error.message,
      remainingAttempts: attempt.maxAttempts - attempt.attemptCount
    });

    if (attempt.attemptCount >= attempt.maxAttempts) {
      await this.handleRecoveryFailure(instanceId);
    } else {
      // Calculate next backoff delay with jitter
      attempt.currentBackoff = Math.min(
        attempt.currentBackoff * this.config.backoffMultiplier,
        this.config.maxBackoffMs
      );

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * this.config.jitterMs;
      attempt.currentBackoff += jitter;

      this.metrics.currentBackoffDelay = attempt.currentBackoff;

      // Schedule next attempt
      const timer = setTimeout(() => {
        this.attemptRecoveryWithBackoff(instanceId, connectionFactory);
      }, 100); // Small delay before next attempt

      this.recoveryTimers.set(`retry-${instanceId}-${attempt.attemptCount}`, timer);
    }
  }

  /**
   * Handle complete recovery failure
   */
  private async handleRecoveryFailure(instanceId: string): Promise<void> {
    const attempt = this.recoveryAttempts.get(instanceId);
    if (!attempt) {
      return;
    }

    const totalTime = Date.now() - attempt.startTime;
    
    // Update metrics
    this.metrics.failedRecoveries++;

    // Update connection state
    this.connectionStates.set(instanceId, 'failed');

    // Clean up recovery attempt
    this.recoveryAttempts.delete(instanceId);

    this.logger.error(`Recovery failed for instance ${instanceId} after ${attempt.attemptCount} attempts`, {
      totalTime,
      lastError: attempt.lastError?.message
    });

    this.emit('recovery-failed', {
      instanceId,
      totalTime,
      attempts: attempt.attemptCount,
      lastError: attempt.lastError,
      timestamp: Date.now()
    });
  }

  /**
   * Perform post-recovery validation
   */
  private async performPostRecoveryValidation(
    instanceId: string, 
    connection: HBConnection
  ): Promise<void> {
    try {
      // Validate connection health
      const healthCheck = await this.validateConnectionHealth(connection);
      
      if (!healthCheck.isHealthy) {
        this.logger.warn(`Post-recovery validation failed for ${instanceId}`, {
          issues: healthCheck.issues
        });

        this.emit('post-recovery-validation-failed', {
          instanceId,
          issues: healthCheck.issues,
          timestamp: Date.now()
        });
      } else {
        this.logger.info(`Post-recovery validation successful for ${instanceId}`);
        
        this.emit('post-recovery-validation-successful', {
          instanceId,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      this.logger.error(`Post-recovery validation error for ${instanceId}`, error);
    }
  }

  /**
   * Validate connection health
   */
  private async validateConnectionHealth(connection: HBConnection): Promise<{
    isHealthy: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check connection status
    if (connection.status !== 'connected') {
      issues.push(`Connection status is ${connection.status}, expected 'connected'`);
    }

    // Check last ping time
    const timeSinceLastPing = Date.now() - connection.lastPing;
    if (timeSinceLastPing > this.config.maxPingAge) {
      issues.push(`Last ping was ${timeSinceLastPing}ms ago, exceeds maximum of ${this.config.maxPingAge}ms`);
    }

    // Check API version compatibility
    if (!this.isApiVersionSupported(connection.apiVersion)) {
      issues.push(`API version ${connection.apiVersion} is not supported`);
    }

    return {
      isHealthy: issues.length === 0,
      issues
    };
  }

  /**
   * Check if API version is supported
   */
  private isApiVersionSupported(version: string): boolean {
    // This would typically check against a list of supported versions
    return version && version.length > 0;
  }

  /**
   * Stop recovery for a specific instance
   */
  stopRecovery(instanceId: string): void {
    const attempt = this.recoveryAttempts.get(instanceId);
    if (attempt) {
      this.recoveryAttempts.delete(instanceId);
      this.connectionStates.set(instanceId, 'stopped');
      
      this.logger.info(`Recovery stopped for instance ${instanceId}`);
      
      this.emit('recovery-stopped', {
        instanceId,
        timestamp: Date.now()
      });
    }

    // Clear any pending timers for this instance
    this.clearTimersForInstance(instanceId);
  }

  /**
   * Clear timers for a specific instance
   */
  private clearTimersForInstance(instanceId: string): void {
    const timersToRemove: string[] = [];
    
    this.recoveryTimers.forEach((timer, key) => {
      if (key.includes(instanceId)) {
        clearTimeout(timer);
        timersToRemove.push(key);
      }
    });

    timersToRemove.forEach(key => {
      this.recoveryTimers.delete(key);
    });
  }

  /**
   * Get recovery status for an instance
   */
  getRecoveryStatus(instanceId: string): {
    isRecovering: boolean;
    attempt?: RecoveryAttempt;
    state: ConnectionState;
  } {
    return {
      isRecovering: this.recoveryAttempts.has(instanceId),
      attempt: this.recoveryAttempts.get(instanceId),
      state: this.connectionStates.get(instanceId) || 'unknown'
    };
  }

  /**
   * Get recovery metrics
   */
  getMetrics(): RecoveryMetrics {
    return { ...this.metrics };
  }

  /**
   * Get all connection states
   */
  getConnectionStates(): Map<string, ConnectionState> {
    return new Map(this.connectionStates);
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    // Clear all timers
    this.recoveryTimers.forEach(timer => clearTimeout(timer));
    this.recoveryTimers.clear();

    // Clear recovery attempts
    this.recoveryAttempts.clear();

    // Remove all listeners
    this.removeAllListeners();

    this.logger.info('Connection recovery service cleaned up');
  }
}