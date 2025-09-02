import { EventEmitter } from 'events';
import { 
  HBInstance, 
  HealthStatus, 
  HealthMetrics, 
  HealthIssue, 
  RecoveryAction,
  Alert,
  AlertType
} from '../types/hummingbot';
import { HummingbotGatewayClient } from './HummingbotGatewayClient';
import { DockerOrchestrator } from './DockerOrchestrator';
import { logger } from '../utils/logger';

export interface HealthCheckConfig {
  interval: number; // milliseconds
  timeout: number; // milliseconds
  retries: number;
  thresholds: {
    cpu: number; // percentage
    memory: number; // percentage
    disk: number; // percentage
    responseTime: number; // milliseconds
    errorRate: number; // percentage
  };
  recoveryActions: {
    enabled: boolean;
    autoRestart: boolean;
    autoScale: boolean;
    maxRecoveryAttempts: number;
  };
}

export interface HealthCheckResult {
  instanceId: string;
  timestamp: number;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
  metrics: HealthMetrics;
  issues: HealthIssue[];
  recommendations: string[];
  recoveryActions: RecoveryAction[];
}

export class HealthMonitor extends EventEmitter {
  private config: HealthCheckConfig;
  private dockerOrchestrator: DockerOrchestrator;
  private gatewayClients: Map<string, HummingbotGatewayClient> = new Map();
  private healthHistory: Map<string, HealthCheckResult[]> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private recoveryAttempts: Map<string, number> = new Map();
  private lastHealthCheck: Map<string, number> = new Map();

  constructor(
    dockerOrchestrator: DockerOrchestrator,
    config: Partial<HealthCheckConfig> = {}
  ) {
    super();
    this.dockerOrchestrator = dockerOrchestrator;
    this.config = {
      interval: 30000, // 30 seconds
      timeout: 10000, // 10 seconds
      retries: 3,
      thresholds: {
        cpu: 80,
        memory: 85,
        disk: 90,
        responseTime: 5000,
        errorRate: 5
      },
      recoveryActions: {
        enabled: true,
        autoRestart: true,
        autoScale: false,
        maxRecoveryAttempts: 3
      },
      ...config
    };
  }

  /**
   * Start health monitoring
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    logger.info('Starting health monitoring');
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        logger.error('Health monitoring cycle failed:', error);
      }
    }, this.config.interval);

    this.emit('monitoringStarted', this.config);
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Health monitoring stopped');
      this.emit('monitoringStopped');
    }
  }

  /**
   * Register instance for monitoring
   */
  registerInstance(instance: HBInstance, gatewayClient: HummingbotGatewayClient): void {
    this.gatewayClients.set(instance.id, gatewayClient);
    this.healthHistory.set(instance.id, []);
    this.recoveryAttempts.set(instance.id, 0);
    
    logger.info(`Instance registered for health monitoring: ${instance.id}`);
    this.emit('instanceRegistered', instance.id);
  }

  /**
   * Unregister instance from monitoring
   */
  unregisterInstance(instanceId: string): void {
    this.gatewayClients.delete(instanceId);
    this.healthHistory.delete(instanceId);
    this.recoveryAttempts.delete(instanceId);
    this.lastHealthCheck.delete(instanceId);
    
    logger.info(`Instance unregistered from health monitoring: ${instanceId}`);
    this.emit('instanceUnregistered', instanceId);
  }

  /**
   * Perform health check on a specific instance
   */
  async checkInstanceHealth(instanceId: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const gatewayClient = this.gatewayClients.get(instanceId);
      if (!gatewayClient) {
        throw new Error(`Gateway client not found for instance: ${instanceId}`);
      }

      // Collect health metrics
      const metrics = await this.collectHealthMetrics(instanceId, gatewayClient);
      
      // Analyze health status
      const analysis = this.analyzeHealth(instanceId, metrics);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(analysis);
      
      // Determine recovery actions
      const recoveryActions = this.determineRecoveryActions(analysis);

      const result: HealthCheckResult = {
        instanceId,
        timestamp: Date.now(),
        status: analysis.status,
        metrics,
        issues: analysis.issues,
        recommendations,
        recoveryActions
      };

      // Store in history
      this.updateHealthHistory(instanceId, result);
      
      // Update last check time
      this.lastHealthCheck.set(instanceId, Date.now());

      // Emit health check event
      this.emit('healthCheckCompleted', result);

      // Trigger recovery if needed
      if (result.status !== 'healthy' && this.config.recoveryActions.enabled) {
        await this.triggerRecoveryActions(instanceId, result);
      }

      return result;

    } catch (error) {
      logger.error(`Health check failed for instance ${instanceId}:`, error);
      
      const errorResult: HealthCheckResult = {
        instanceId,
        timestamp: Date.now(),
        status: 'critical',
        metrics: this.getDefaultMetrics(),
        issues: [{
          type: 'connectivity',
          severity: 'critical',
          description: `Health check failed: ${error.message}`,
          detectedAt: Date.now(),
          resolved: false
        }],
        recommendations: ['Check instance connectivity', 'Verify gateway service status'],
        recoveryActions: ['restart_container']
      };

      this.updateHealthHistory(instanceId, errorResult);
      this.emit('healthCheckFailed', { instanceId, error: error.message });

      return errorResult;
    }
  }

  /**
   * Get health status for all monitored instances
   */
  async getAllHealthStatuses(): Promise<HealthStatus[]> {
    const instanceIds = Array.from(this.gatewayClients.keys());
    const healthChecks = await Promise.allSettled(
      instanceIds.map(id => this.checkInstanceHealth(id))
    );

    return healthChecks.map((result, index) => {
      const instanceId = instanceIds[index];
      
      if (result.status === 'fulfilled') {
        const healthResult = result.value;
        return {
          instanceId,
          status: this.mapHealthStatusToInstanceStatus(healthResult.status),
          uptime: this.calculateUptime(instanceId),
          lastHealthCheck: healthResult.timestamp,
          healthScore: this.calculateHealthScore(healthResult.metrics),
          issues: healthResult.issues,
          metrics: healthResult.metrics
        };
      } else {
        return {
          instanceId,
          status: 'error',
          uptime: 0,
          lastHealthCheck: Date.now(),
          healthScore: 0,
          issues: [{
            type: 'connectivity',
            severity: 'critical',
            description: `Health check failed: ${result.reason}`,
            detectedAt: Date.now(),
            resolved: false
          }],
          metrics: this.getDefaultMetrics()
        };
      }
    });
  }

  /**
   * Get health history for an instance
   */
  getHealthHistory(instanceId: string, limit: number = 100): HealthCheckResult[] {
    const history = this.healthHistory.get(instanceId) || [];
    return history.slice(-limit);
  }

  /**
   * Get health trends for an instance
   */
  getHealthTrends(instanceId: string, timeWindow: number = 3600000): {
    cpuTrend: number[];
    memoryTrend: number[];
    responseTimeTrend: number[];
    errorRateTrend: number[];
    healthScoreTrend: number[];
  } {
    const history = this.healthHistory.get(instanceId) || [];
    const cutoffTime = Date.now() - timeWindow;
    const recentHistory = history.filter(h => h.timestamp > cutoffTime);

    return {
      cpuTrend: recentHistory.map(h => h.metrics.cpuUsage),
      memoryTrend: recentHistory.map(h => h.metrics.memoryUsage),
      responseTimeTrend: recentHistory.map(h => h.metrics.responseTime),
      errorRateTrend: recentHistory.map(h => h.metrics.errorRate),
      healthScoreTrend: recentHistory.map(h => this.calculateHealthScore(h.metrics))
    };
  }

  /**
   * Update health monitoring configuration
   */
  updateConfig(newConfig: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart monitoring with new config
    if (this.monitoringInterval) {
      this.stopMonitoring();
      this.startMonitoring();
    }

    this.emit('configUpdated', this.config);
    logger.info('Health monitoring configuration updated');
  }

  /**
   * Force health check on all instances
   */
  async forceHealthCheck(): Promise<HealthCheckResult[]> {
    const instanceIds = Array.from(this.gatewayClients.keys());
    const results = await Promise.allSettled(
      instanceIds.map(id => this.checkInstanceHealth(id))
    );

    return results
      .filter((result): result is PromiseFulfilledResult<HealthCheckResult> => 
        result.status === 'fulfilled')
      .map(result => result.value);
  }

  /**
   * Perform health checks on all registered instances
   */
  private async performHealthChecks(): Promise<void> {
    const instanceIds = Array.from(this.gatewayClients.keys());
    
    if (instanceIds.length === 0) {
      return;
    }

    logger.debug(`Performing health checks on ${instanceIds.length} instances`);

    const healthChecks = await Promise.allSettled(
      instanceIds.map(id => this.checkInstanceHealth(id))
    );

    const healthyCount = healthChecks.filter(result => 
      result.status === 'fulfilled' && result.value.status === 'healthy'
    ).length;

    const unhealthyCount = instanceIds.length - healthyCount;

    this.emit('healthCheckCycleCompleted', {
      totalInstances: instanceIds.length,
      healthyInstances: healthyCount,
      unhealthyInstances: unhealthyCount,
      timestamp: Date.now()
    });

    if (unhealthyCount > 0) {
      logger.warn(`Health check cycle completed: ${unhealthyCount} unhealthy instances detected`);
    }
  }

  /**
   * Collect health metrics for an instance
   */
  private async collectHealthMetrics(
    instanceId: string, 
    gatewayClient: HummingbotGatewayClient
  ): Promise<HealthMetrics> {
    const startTime = Date.now();

    // Get container stats
    const containerStats = await this.dockerOrchestrator.getContainerStats(instanceId);
    
    // Get gateway health
    const gatewayHealth = await gatewayClient.healthCheck();
    
    // Calculate response time
    const responseTime = Date.now() - startTime;

    // Get additional metrics from gateway
    const gatewayMetrics = await gatewayClient.getMetrics().catch(() => ({
      activeConnections: 0,
      queueDepth: 0,
      errorCount: 0,
      requestCount: 1
    }));

    const errorRate = gatewayMetrics.requestCount > 0 
      ? (gatewayMetrics.errorCount / gatewayMetrics.requestCount) * 100 
      : 0;

    return {
      cpuUsage: containerStats.cpuUsage,
      memoryUsage: (containerStats.memoryUsage / containerStats.memoryLimit) * 100,
      diskUsage: 0, // TODO: Implement disk usage calculation
      networkLatency: responseTime,
      errorRate,
      responseTime,
      activeConnections: gatewayMetrics.activeConnections,
      queueDepth: gatewayMetrics.queueDepth
    };
  }

  /**
   * Analyze health status based on metrics
   */
  private analyzeHealth(instanceId: string, metrics: HealthMetrics): {
    status: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
    issues: HealthIssue[];
  } {
    const issues: HealthIssue[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' | 'critical' = 'healthy';

    // Check CPU usage
    if (metrics.cpuUsage > this.config.thresholds.cpu) {
      const severity = metrics.cpuUsage > 95 ? 'critical' : 
                     metrics.cpuUsage > 90 ? 'high' : 'medium';
      issues.push({
        type: 'resource',
        severity,
        description: `High CPU usage: ${metrics.cpuUsage.toFixed(1)}%`,
        detectedAt: Date.now(),
        resolved: false
      });
      
      if (severity === 'critical') status = 'critical';
      else if (status === 'healthy') status = 'degraded';
    }

    // Check memory usage
    if (metrics.memoryUsage > this.config.thresholds.memory) {
      const severity = metrics.memoryUsage > 95 ? 'critical' : 
                     metrics.memoryUsage > 90 ? 'high' : 'medium';
      issues.push({
        type: 'resource',
        severity,
        description: `High memory usage: ${metrics.memoryUsage.toFixed(1)}%`,
        detectedAt: Date.now(),
        resolved: false
      });
      
      if (severity === 'critical') status = 'critical';
      else if (status === 'healthy') status = 'degraded';
    }

    // Check response time
    if (metrics.responseTime > this.config.thresholds.responseTime) {
      const severity = metrics.responseTime > 10000 ? 'high' : 'medium';
      issues.push({
        type: 'performance',
        severity,
        description: `High response time: ${metrics.responseTime}ms`,
        detectedAt: Date.now(),
        resolved: false
      });
      
      if (status === 'healthy') status = 'degraded';
    }

    // Check error rate
    if (metrics.errorRate > this.config.thresholds.errorRate) {
      const severity = metrics.errorRate > 20 ? 'high' : 'medium';
      issues.push({
        type: 'performance',
        severity,
        description: `High error rate: ${metrics.errorRate.toFixed(1)}%`,
        detectedAt: Date.now(),
        resolved: false
      });
      
      if (status === 'healthy') status = 'degraded';
    }

    // Check queue depth
    if (metrics.queueDepth > 100) {
      issues.push({
        type: 'performance',
        severity: 'medium',
        description: `High queue depth: ${metrics.queueDepth}`,
        detectedAt: Date.now(),
        resolved: false
      });
      
      if (status === 'healthy') status = 'degraded';
    }

    // Determine overall status
    if (issues.some(issue => issue.severity === 'critical')) {
      status = 'critical';
    } else if (issues.some(issue => issue.severity === 'high')) {
      status = 'unhealthy';
    } else if (issues.length > 0) {
      status = 'degraded';
    }

    return { status, issues };
  }

  /**
   * Generate recommendations based on health analysis
   */
  private generateRecommendations(analysis: {
    status: string;
    issues: HealthIssue[];
  }): string[] {
    const recommendations: string[] = [];

    for (const issue of analysis.issues) {
      switch (issue.type) {
        case 'resource':
          if (issue.description.includes('CPU')) {
            recommendations.push('Consider scaling up CPU resources or optimizing strategy parameters');
          } else if (issue.description.includes('memory')) {
            recommendations.push('Consider increasing memory allocation or reducing strategy complexity');
          }
          break;
        
        case 'performance':
          if (issue.description.includes('response time')) {
            recommendations.push('Check network connectivity and gateway performance');
          } else if (issue.description.includes('error rate')) {
            recommendations.push('Review logs for error patterns and consider strategy adjustments');
          } else if (issue.description.includes('queue depth')) {
            recommendations.push('Consider increasing processing capacity or reducing request rate');
          }
          break;
        
        case 'connectivity':
          recommendations.push('Check network connectivity and service availability');
          break;
      }
    }

    if (analysis.status === 'critical') {
      recommendations.push('Consider immediate intervention or failover to backup instance');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Determine recovery actions based on health analysis
   */
  private determineRecoveryActions(analysis: {
    status: string;
    issues: HealthIssue[];
  }): RecoveryAction[] {
    const actions: RecoveryAction[] = [];

    if (analysis.status === 'critical') {
      actions.push('restart_container');
    } else if (analysis.status === 'unhealthy') {
      if (analysis.issues.some(issue => issue.type === 'connectivity')) {
        actions.push('restart_gateway');
      }
      if (analysis.issues.some(issue => issue.type === 'resource')) {
        actions.push('scale_up');
      }
    }

    return actions;
  }

  /**
   * Trigger recovery actions for an instance
   */
  private async triggerRecoveryActions(
    instanceId: string, 
    healthResult: HealthCheckResult
  ): Promise<void> {
    const currentAttempts = this.recoveryAttempts.get(instanceId) || 0;
    
    if (currentAttempts >= this.config.recoveryActions.maxRecoveryAttempts) {
      logger.warn(`Max recovery attempts reached for instance ${instanceId}`);
      this.emit('maxRecoveryAttemptsReached', instanceId);
      return;
    }

    for (const action of healthResult.recoveryActions) {
      try {
        logger.info(`Triggering recovery action ${action} for instance ${instanceId}`);
        
        switch (action) {
          case 'restart_container':
            if (this.config.recoveryActions.autoRestart) {
              await this.dockerOrchestrator.restartContainer(instanceId);
            }
            break;
          
          case 'restart_gateway':
            const gatewayClient = this.gatewayClients.get(instanceId);
            if (gatewayClient) {
              await gatewayClient.restart();
            }
            break;
          
          case 'scale_up':
            if (this.config.recoveryActions.autoScale) {
              this.emit('scaleUpRequested', instanceId);
            }
            break;
        }

        this.emit('recoveryActionTriggered', {
          instanceId,
          action,
          attempt: currentAttempts + 1
        });

      } catch (error) {
        logger.error(`Recovery action ${action} failed for instance ${instanceId}:`, error);
        this.emit('recoveryActionFailed', {
          instanceId,
          action,
          error: error.message
        });
      }
    }

    this.recoveryAttempts.set(instanceId, currentAttempts + 1);
  }

  /**
   * Update health history for an instance
   */
  private updateHealthHistory(instanceId: string, result: HealthCheckResult): void {
    const history = this.healthHistory.get(instanceId) || [];
    history.push(result);
    
    // Keep only last 1000 entries
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
    
    this.healthHistory.set(instanceId, history);
  }

  /**
   * Calculate health score from metrics
   */
  private calculateHealthScore(metrics: HealthMetrics): number {
    const cpuScore = Math.max(0, 100 - metrics.cpuUsage);
    const memoryScore = Math.max(0, 100 - metrics.memoryUsage);
    const responseTimeScore = Math.max(0, 100 - (metrics.responseTime / 100));
    const errorRateScore = Math.max(0, 100 - metrics.errorRate * 10);
    
    return Math.round((cpuScore + memoryScore + responseTimeScore + errorRateScore) / 4);
  }

  /**
   * Calculate uptime for an instance
   */
  private calculateUptime(instanceId: string): number {
    const history = this.healthHistory.get(instanceId) || [];
    if (history.length === 0) return 0;
    
    const firstCheck = history[0].timestamp;
    return Date.now() - firstCheck;
  }

  /**
   * Map health status to instance status
   */
  private mapHealthStatusToInstanceStatus(
    healthStatus: string
  ): 'starting' | 'running' | 'stopping' | 'stopped' | 'error' | 'unhealthy' {
    switch (healthStatus) {
      case 'healthy':
      case 'degraded':
        return 'running';
      case 'unhealthy':
        return 'unhealthy';
      case 'critical':
        return 'error';
      default:
        return 'error';
    }
  }

  /**
   * Get default metrics for error cases
   */
  private getDefaultMetrics(): HealthMetrics {
    return {
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      networkLatency: 0,
      errorRate: 100,
      responseTime: 0,
      activeConnections: 0,
      queueDepth: 0
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopMonitoring();
    this.gatewayClients.clear();
    this.healthHistory.clear();
    this.recoveryAttempts.clear();
    this.lastHealthCheck.clear();
    
    logger.info('HealthMonitor cleanup completed');
  }
}