/**
 * Hummingbot Strategy Monitor and Real-time Tracking Service
 * Implements real-time strategy status tracking, performance metrics collection,
 * anomaly detection, and automatic adjustment triggers for Hummingbot strategies
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { 
  StrategyMetrics, 
  Anomaly, 
  Alert, 
  AlertCondition,
  HBStrategy,
  StrategyExecution,
  HBInstance,
  StrategyPerformance,
  AnomalyType,
  AlertType
} from '../types/hummingbot';
import { AnomalyDetectionService } from './AnomalyDetectionService';
import { AlertNotificationService } from './AlertNotificationService';
import { PerformanceMonitoringService } from './PerformanceMonitoringService';

export interface StrategyMonitorConfig {
  metricsCollectionInterval: number;
  anomalyDetectionInterval: number;
  alertCheckInterval: number;
  websocketReconnectDelay: number;
  maxReconnectAttempts: number;
  performanceThresholds: PerformanceThresholds;
  anomalyThresholds: AnomalyThresholds;
}

export interface PerformanceThresholds {
  maxExecutionLatency: number;
  minFillRate: number;
  maxSlippage: number;
  maxDrawdown: number;
  minProfitability: number;
  maxErrorRate: number;
}

export interface AnomalyThresholds {
  latencyMultiplier: number;
  fillRateDeviation: number;
  slippageMultiplier: number;
  volumeDeviation: number;
  priceDeviation: number;
  consecutiveErrors: number;
}

export interface StrategyAdjustment {
  strategyId: string;
  adjustmentType: 'parameter_update' | 'pause' | 'stop' | 'restart';
  parameters?: Record<string, any>;
  reason: string;
  timestamp: number;
}

export interface MonitoringSession {
  strategyId: string;
  instanceId: string;
  startTime: number;
  websocketConnection?: WebSocket;
  metricsHistory: StrategyMetrics[];
  anomalies: Anomaly[];
  alerts: Alert[];
  adjustments: StrategyAdjustment[];
  isActive: boolean;
}

export class HummingbotStrategyMonitor extends EventEmitter {
  private config: StrategyMonitorConfig;
  private monitoringSessions: Map<string, MonitoringSession> = new Map();
  private websocketConnections: Map<string, WebSocket> = new Map();
  private metricsCollectionTimer: NodeJS.Timeout | null = null;
  private anomalyDetectionTimer: NodeJS.Timeout | null = null;
  private alertCheckTimer: NodeJS.Timeout | null = null;
  
  private anomalyDetectionService: AnomalyDetectionService;
  private alertNotificationService: AlertNotificationService;
  private performanceMonitoringService: PerformanceMonitoringService;

  constructor(config: Partial<StrategyMonitorConfig> = {}) {
    super();
    
    this.config = {
      metricsCollectionInterval: 5000, // 5 seconds
      anomalyDetectionInterval: 10000, // 10 seconds
      alertCheckInterval: 15000, // 15 seconds
      websocketReconnectDelay: 5000, // 5 seconds
      maxReconnectAttempts: 5,
      performanceThresholds: {
        maxExecutionLatency: 1000, // 1 second
        minFillRate: 0.8, // 80%
        maxSlippage: 0.02, // 2%
        maxDrawdown: 0.1, // 10%
        minProfitability: -0.05, // -5%
        maxErrorRate: 0.05 // 5%
      },
      anomalyThresholds: {
        latencyMultiplier: 3.0,
        fillRateDeviation: 0.3,
        slippageMultiplier: 2.0,
        volumeDeviation: 0.5,
        priceDeviation: 0.1,
        consecutiveErrors: 5
      },
      ...config
    };

    this.anomalyDetectionService = AnomalyDetectionService.getInstance();
    this.alertNotificationService = AlertNotificationService.getInstance();
    this.performanceMonitoringService = PerformanceMonitoringService.getInstance();

    this.initializeMonitoring();
  }

  /**
   * Start monitoring a strategy with real-time WebSocket connection
   */
  public async startStrategyMonitoring(
    strategyId: string, 
    instanceId: string, 
    strategy: HBStrategy
  ): Promise<void> {
    try {
      logger.info(`Starting monitoring for strategy ${strategyId} on instance ${instanceId}`);

      // Create monitoring session
      const session: MonitoringSession = {
        strategyId,
        instanceId,
        startTime: Date.now(),
        metricsHistory: [],
        anomalies: [],
        alerts: [],
        adjustments: [],
        isActive: true
      };

      this.monitoringSessions.set(strategyId, session);

      // Establish WebSocket connection for real-time updates
      await this.establishWebSocketConnection(strategyId, instanceId);

      // Set up alert conditions for this strategy
      this.setupStrategyAlertConditions(strategyId, strategy);

      this.emit('monitoring_started', { strategyId, instanceId, timestamp: Date.now() });
      
      logger.info(`Monitoring started for strategy ${strategyId}`);
    } catch (error) {
      logger.error(`Failed to start monitoring for strategy ${strategyId}:`, error);
      throw error;
    }
  }

  /**
   * Stop monitoring a strategy
   */
  public async stopStrategyMonitoring(strategyId: string): Promise<void> {
    try {
      const session = this.monitoringSessions.get(strategyId);
      if (!session) {
        logger.warn(`No monitoring session found for strategy ${strategyId}`);
        return;
      }

      session.isActive = false;

      // Close WebSocket connection
      const wsConnection = this.websocketConnections.get(strategyId);
      if (wsConnection) {
        wsConnection.close();
        this.websocketConnections.delete(strategyId);
      }

      // Remove session
      this.monitoringSessions.delete(strategyId);

      this.emit('monitoring_stopped', { strategyId, timestamp: Date.now() });
      
      logger.info(`Monitoring stopped for strategy ${strategyId}`);
    } catch (error) {
      logger.error(`Failed to stop monitoring for strategy ${strategyId}:`, error);
      throw error;
    }
  }

  /**
   * Get real-time metrics for a strategy
   */
  public getStrategyMetrics(strategyId: string): StrategyMetrics | null {
    const session = this.monitoringSessions.get(strategyId);
    if (!session || session.metricsHistory.length === 0) {
      return null;
    }

    return session.metricsHistory[session.metricsHistory.length - 1];
  }

  /**
   * Get historical metrics for a strategy
   */
  public getStrategyMetricsHistory(strategyId: string, limit: number = 100): StrategyMetrics[] {
    const session = this.monitoringSessions.get(strategyId);
    if (!session) {
      return [];
    }

    return session.metricsHistory.slice(-limit);
  }

  /**
   * Get anomalies detected for a strategy
   */
  public getStrategyAnomalies(strategyId: string): Anomaly[] {
    const session = this.monitoringSessions.get(strategyId);
    return session ? session.anomalies : [];
  }

  /**
   * Get alerts for a strategy
   */
  public getStrategyAlerts(strategyId: string): Alert[] {
    const session = this.monitoringSessions.get(strategyId);
    return session ? session.alerts : [];
  }

  /**
   * Get adjustments made to a strategy
   */
  public getStrategyAdjustments(strategyId: string): StrategyAdjustment[] {
    const session = this.monitoringSessions.get(strategyId);
    return session ? session.adjustments : [];
  }

  /**
   * Manually trigger strategy adjustment
   */
  public async triggerStrategyAdjustment(
    strategyId: string, 
    adjustment: Omit<StrategyAdjustment, 'timestamp'>
  ): Promise<void> {
    try {
      const session = this.monitoringSessions.get(strategyId);
      if (!session) {
        throw new Error(`No monitoring session found for strategy ${strategyId}`);
      }

      const fullAdjustment: StrategyAdjustment = {
        ...adjustment,
        timestamp: Date.now()
      };

      // Execute the adjustment
      await this.executeStrategyAdjustment(fullAdjustment);

      // Record the adjustment
      session.adjustments.push(fullAdjustment);

      this.emit('strategy_adjusted', fullAdjustment);
      
      logger.info(`Strategy adjustment executed: ${strategyId} - ${adjustment.adjustmentType}`);
    } catch (error) {
      logger.error(`Failed to execute strategy adjustment for ${strategyId}:`, error);
      throw error;
    }
  }

  /**
   * Get monitoring status for all strategies
   */
  public getMonitoringStatus(): {
    totalStrategies: number;
    activeStrategies: number;
    totalAnomalies: number;
    totalAlerts: number;
    totalAdjustments: number;
  } {
    const sessions = Array.from(this.monitoringSessions.values());
    
    return {
      totalStrategies: sessions.length,
      activeStrategies: sessions.filter(s => s.isActive).length,
      totalAnomalies: sessions.reduce((sum, s) => sum + s.anomalies.length, 0),
      totalAlerts: sessions.reduce((sum, s) => sum + s.alerts.length, 0),
      totalAdjustments: sessions.reduce((sum, s) => sum + s.adjustments.length, 0)
    };
  }

  // Private methods

  private initializeMonitoring(): void {
    // Start metrics collection timer
    this.metricsCollectionTimer = setInterval(() => {
      this.collectMetricsForAllStrategies();
    }, this.config.metricsCollectionInterval);

    // Start anomaly detection timer
    this.anomalyDetectionTimer = setInterval(() => {
      this.performAnomalyDetection();
    }, this.config.anomalyDetectionInterval);

    // Start alert checking timer
    this.alertCheckTimer = setInterval(() => {
      this.checkAlertConditions();
    }, this.config.alertCheckInterval);

    logger.info('Hummingbot Strategy Monitor initialized');
  }

  private async establishWebSocketConnection(strategyId: string, instanceId: string): Promise<void> {
    try {
      // This would connect to the actual Hummingbot Gateway WebSocket endpoint
      // For now, we'll simulate the connection
      const wsUrl = `ws://localhost:8080/strategies/${strategyId}/stream`;
      
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        logger.info(`WebSocket connected for strategy ${strategyId}`);
        this.emit('websocket_connected', { strategyId, instanceId });
      });

      ws.on('message', (data: string) => {
        try {
          const message = JSON.parse(data);
          this.handleWebSocketMessage(strategyId, message);
        } catch (error) {
          logger.error(`Failed to parse WebSocket message for strategy ${strategyId}:`, error);
        }
      });

      ws.on('close', () => {
        logger.warn(`WebSocket disconnected for strategy ${strategyId}`);
        this.handleWebSocketDisconnection(strategyId);
      });

      ws.on('error', (error) => {
        logger.error(`WebSocket error for strategy ${strategyId}:`, error);
        this.handleWebSocketError(strategyId, error);
      });

      this.websocketConnections.set(strategyId, ws);
    } catch (error) {
      logger.error(`Failed to establish WebSocket connection for strategy ${strategyId}:`, error);
      throw error;
    }
  }

  private handleWebSocketMessage(strategyId: string, message: any): void {
    const session = this.monitoringSessions.get(strategyId);
    if (!session) return;

    switch (message.type) {
      case 'metrics_update':
        this.processMetricsUpdate(strategyId, message.data);
        break;
      case 'order_update':
        this.processOrderUpdate(strategyId, message.data);
        break;
      case 'trade_update':
        this.processTradeUpdate(strategyId, message.data);
        break;
      case 'error':
        this.processErrorUpdate(strategyId, message.data);
        break;
      default:
        logger.debug(`Unknown WebSocket message type: ${message.type}`);
    }
  }

  private processMetricsUpdate(strategyId: string, metricsData: any): void {
    const session = this.monitoringSessions.get(strategyId);
    if (!session) return;

    const metrics: StrategyMetrics = {
      strategyId,
      instanceId: session.instanceId,
      timestamp: Date.now(),
      executionLatency: metricsData.executionLatency || 0,
      fillRate: metricsData.fillRate || 0,
      slippage: metricsData.slippage || 0,
      profitLoss: metricsData.profitLoss || 0,
      riskExposure: metricsData.riskExposure || 0,
      orderBookDepth: metricsData.orderBookDepth || 0,
      spreadTightness: metricsData.spreadTightness || 0,
      inventoryBalance: metricsData.inventoryBalance || 0,
      activeOrders: metricsData.activeOrders || 0,
      completedTrades: metricsData.completedTrades || 0,
      errorCount: metricsData.errorCount || 0
    };

    // Add to metrics history
    session.metricsHistory.push(metrics);

    // Limit history size
    if (session.metricsHistory.length > 1000) {
      session.metricsHistory = session.metricsHistory.slice(-1000);
    }

    // Emit metrics update event
    this.emit('metrics_updated', { strategyId, metrics });

    // Record performance metrics
    this.performanceMonitoringService.recordLatency('strategy_execution', metrics.executionLatency);
    this.performanceMonitoringService.recordThroughput('strategy_trades', metrics.completedTrades);
  }

  private processOrderUpdate(strategyId: string, orderData: any): void {
    this.emit('order_updated', { strategyId, order: orderData });
  }

  private processTradeUpdate(strategyId: string, tradeData: any): void {
    this.emit('trade_updated', { strategyId, trade: tradeData });
  }

  private processErrorUpdate(strategyId: string, errorData: any): void {
    const session = this.monitoringSessions.get(strategyId);
    if (!session) return;

    logger.error(`Strategy error for ${strategyId}:`, errorData);
    
    this.emit('strategy_error', { strategyId, error: errorData });

    // Check if we need to trigger automatic adjustments
    this.checkForAutomaticAdjustments(strategyId, 'error', errorData);
  }

  private handleWebSocketDisconnection(strategyId: string): void {
    this.emit('websocket_disconnected', { strategyId });
    
    // Attempt to reconnect
    setTimeout(() => {
      this.attemptWebSocketReconnection(strategyId);
    }, this.config.websocketReconnectDelay);
  }

  private handleWebSocketError(strategyId: string, error: any): void {
    this.emit('websocket_error', { strategyId, error });
  }

  private async attemptWebSocketReconnection(strategyId: string): Promise<void> {
    const session = this.monitoringSessions.get(strategyId);
    if (!session || !session.isActive) return;

    try {
      await this.establishWebSocketConnection(strategyId, session.instanceId);
      logger.info(`WebSocket reconnected for strategy ${strategyId}`);
    } catch (error) {
      logger.error(`Failed to reconnect WebSocket for strategy ${strategyId}:`, error);
      
      // Schedule another reconnection attempt
      setTimeout(() => {
        this.attemptWebSocketReconnection(strategyId);
      }, this.config.websocketReconnectDelay * 2);
    }
  }

  private collectMetricsForAllStrategies(): void {
    for (const [strategyId, session] of this.monitoringSessions.entries()) {
      if (!session.isActive) continue;

      // If we don't have recent metrics from WebSocket, collect them manually
      const lastMetricsTime = session.metricsHistory.length > 0 
        ? session.metricsHistory[session.metricsHistory.length - 1].timestamp 
        : 0;
      
      const timeSinceLastMetrics = Date.now() - lastMetricsTime;
      
      if (timeSinceLastMetrics > this.config.metricsCollectionInterval * 2) {
        this.collectStrategyMetrics(strategyId);
      }
    }
  }

  private async collectStrategyMetrics(strategyId: string): Promise<void> {
    try {
      // This would make an API call to get current strategy metrics
      // For now, we'll simulate metrics collection
      const session = this.monitoringSessions.get(strategyId);
      if (!session) return;

      const simulatedMetrics: StrategyMetrics = {
        strategyId,
        instanceId: session.instanceId,
        timestamp: Date.now(),
        executionLatency: Math.random() * 500 + 100,
        fillRate: Math.random() * 0.3 + 0.7,
        slippage: Math.random() * 0.01,
        profitLoss: (Math.random() - 0.5) * 100,
        riskExposure: Math.random() * 0.5,
        orderBookDepth: Math.random() * 1000 + 500,
        spreadTightness: Math.random() * 0.002 + 0.001,
        inventoryBalance: Math.random() * 10000,
        activeOrders: Math.floor(Math.random() * 10),
        completedTrades: Math.floor(Math.random() * 50),
        errorCount: Math.floor(Math.random() * 3)
      };

      this.processMetricsUpdate(strategyId, simulatedMetrics);
    } catch (error) {
      logger.error(`Failed to collect metrics for strategy ${strategyId}:`, error);
    }
  }

  private performAnomalyDetection(): void {
    for (const [strategyId, session] of this.monitoringSessions.entries()) {
      if (!session.isActive || session.metricsHistory.length < 2) continue;

      const anomalies = this.detectStrategyAnomalies(strategyId, session);
      
      for (const anomaly of anomalies) {
        session.anomalies.push(anomaly);
        this.emit('anomaly_detected', { strategyId, anomaly });
        
        // Check if this anomaly requires automatic adjustment
        this.checkForAutomaticAdjustments(strategyId, 'anomaly', anomaly);
      }

      // Limit anomalies history
      if (session.anomalies.length > 100) {
        session.anomalies = session.anomalies.slice(-100);
      }
    }
  }

  private detectStrategyAnomalies(strategyId: string, session: MonitoringSession): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const recentMetrics = session.metricsHistory.slice(-10); // Last 10 metrics
    
    if (recentMetrics.length < 5) return anomalies;

    const currentMetrics = recentMetrics[recentMetrics.length - 1];
    const historicalMetrics = recentMetrics.slice(0, -1);

    // Calculate averages for comparison
    const avgLatency = historicalMetrics.reduce((sum, m) => sum + m.executionLatency, 0) / historicalMetrics.length;
    const avgFillRate = historicalMetrics.reduce((sum, m) => sum + m.fillRate, 0) / historicalMetrics.length;
    const avgSlippage = historicalMetrics.reduce((sum, m) => sum + m.slippage, 0) / historicalMetrics.length;

    // Detect high latency anomaly
    if (currentMetrics.executionLatency > avgLatency * this.config.anomalyThresholds.latencyMultiplier) {
      anomalies.push({
        id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        strategyId,
        type: 'high_latency',
        severity: 'high',
        description: `Execution latency ${currentMetrics.executionLatency}ms is ${this.config.anomalyThresholds.latencyMultiplier}x higher than average`,
        detectedAt: Date.now(),
        metrics: { current: currentMetrics.executionLatency, average: avgLatency },
        threshold: avgLatency * this.config.anomalyThresholds.latencyMultiplier,
        actualValue: currentMetrics.executionLatency,
        resolved: false
      });
    }

    // Detect low fill rate anomaly
    if (currentMetrics.fillRate < avgFillRate - this.config.anomalyThresholds.fillRateDeviation) {
      anomalies.push({
        id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        strategyId,
        type: 'low_fill_rate',
        severity: 'medium',
        description: `Fill rate ${(currentMetrics.fillRate * 100).toFixed(1)}% is significantly below average`,
        detectedAt: Date.now(),
        metrics: { current: currentMetrics.fillRate, average: avgFillRate },
        threshold: avgFillRate - this.config.anomalyThresholds.fillRateDeviation,
        actualValue: currentMetrics.fillRate,
        resolved: false
      });
    }

    // Detect high slippage anomaly
    if (currentMetrics.slippage > avgSlippage * this.config.anomalyThresholds.slippageMultiplier) {
      anomalies.push({
        id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        strategyId,
        type: 'high_slippage',
        severity: 'medium',
        description: `Slippage ${(currentMetrics.slippage * 100).toFixed(2)}% is ${this.config.anomalyThresholds.slippageMultiplier}x higher than average`,
        detectedAt: Date.now(),
        metrics: { current: currentMetrics.slippage, average: avgSlippage },
        threshold: avgSlippage * this.config.anomalyThresholds.slippageMultiplier,
        actualValue: currentMetrics.slippage,
        resolved: false
      });
    }

    // Detect consecutive errors
    const recentErrors = recentMetrics.filter(m => m.errorCount > 0).length;
    if (recentErrors >= this.config.anomalyThresholds.consecutiveErrors) {
      anomalies.push({
        id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        strategyId,
        type: 'high_error_rate',
        severity: 'critical',
        description: `High error rate detected: ${recentErrors} errors in recent metrics`,
        detectedAt: Date.now(),
        metrics: { errorCount: recentErrors },
        threshold: this.config.anomalyThresholds.consecutiveErrors,
        actualValue: recentErrors,
        resolved: false
      });
    }

    return anomalies;
  }

  private checkAlertConditions(): void {
    for (const [strategyId, session] of this.monitoringSessions.entries()) {
      if (!session.isActive || session.metricsHistory.length === 0) continue;

      const currentMetrics = session.metricsHistory[session.metricsHistory.length - 1];
      const alerts = this.evaluateAlertConditions(strategyId, currentMetrics);
      
      for (const alert of alerts) {
        session.alerts.push(alert);
        this.emit('alert_triggered', { strategyId, alert });
        
        // Send notification
        const mappedSeverity = alert.severity === 'error' ? 'critical' : alert.severity as 'info' | 'warning' | 'critical';
        this.alertNotificationService.processAlert({
          ruleId: alert.strategyId || 'default',
          name: alert.title,
          message: alert.message,
          severity: mappedSeverity,
          labels: alert.metadata || {},
          annotations: { strategyId: alert.strategyId || '', instanceId: alert.instanceId || '' }
        });
      }

      // Limit alerts history
      if (session.alerts.length > 50) {
        session.alerts = session.alerts.slice(-50);
      }
    }
  }

  private evaluateAlertConditions(strategyId: string, metrics: StrategyMetrics): Alert[] {
    const alerts: Alert[] = [];

    // High latency alert
    if (metrics.executionLatency > this.config.performanceThresholds.maxExecutionLatency) {
      alerts.push({
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        strategyId,
        instanceId: metrics.instanceId,
        type: 'performance_degradation',
        severity: 'warning',
        title: 'High Execution Latency',
        message: `Strategy ${strategyId} execution latency ${metrics.executionLatency}ms exceeds threshold`,
        timestamp: Date.now(),
        acknowledged: false,
        resolved: false,
        metadata: { latency: metrics.executionLatency, threshold: this.config.performanceThresholds.maxExecutionLatency }
      });
    }

    // Low fill rate alert
    if (metrics.fillRate < this.config.performanceThresholds.minFillRate) {
      alerts.push({
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        strategyId,
        instanceId: metrics.instanceId,
        type: 'performance_degradation',
        severity: 'warning',
        title: 'Low Fill Rate',
        message: `Strategy ${strategyId} fill rate ${(metrics.fillRate * 100).toFixed(1)}% below threshold`,
        timestamp: Date.now(),
        acknowledged: false,
        resolved: false,
        metadata: { fillRate: metrics.fillRate, threshold: this.config.performanceThresholds.minFillRate }
      });
    }

    // High slippage alert
    if (metrics.slippage > this.config.performanceThresholds.maxSlippage) {
      alerts.push({
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        strategyId,
        instanceId: metrics.instanceId,
        type: 'performance_degradation',
        severity: 'warning',
        title: 'High Slippage',
        message: `Strategy ${strategyId} slippage ${(metrics.slippage * 100).toFixed(2)}% exceeds threshold`,
        timestamp: Date.now(),
        acknowledged: false,
        resolved: false,
        metadata: { slippage: metrics.slippage, threshold: this.config.performanceThresholds.maxSlippage }
      });
    }

    // Error count alert
    if (metrics.errorCount > 0) {
      alerts.push({
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        strategyId,
        instanceId: metrics.instanceId,
        type: 'system_error',
        severity: metrics.errorCount > 5 ? 'critical' : 'warning',
        title: 'Strategy Errors Detected',
        message: `Strategy ${strategyId} has ${metrics.errorCount} errors`,
        timestamp: Date.now(),
        acknowledged: false,
        resolved: false,
        metadata: { errorCount: metrics.errorCount }
      });
    }

    return alerts;
  }

  private checkForAutomaticAdjustments(strategyId: string, trigger: string, data: any): void {
    const session = this.monitoringSessions.get(strategyId);
    if (!session) return;

    // Define automatic adjustment rules
    const adjustmentRules = this.getAutomaticAdjustmentRules(trigger, data);
    
    for (const rule of adjustmentRules) {
      if (rule.condition(data)) {
        const adjustment: StrategyAdjustment = {
          strategyId,
          adjustmentType: rule.adjustmentType,
          parameters: rule.parameters,
          reason: rule.reason,
          timestamp: Date.now()
        };

        // Execute the adjustment
        this.executeStrategyAdjustment(adjustment)
          .then(() => {
            session.adjustments.push(adjustment);
            this.emit('automatic_adjustment', adjustment);
            logger.info(`Automatic adjustment executed for strategy ${strategyId}: ${rule.reason}`);
          })
          .catch(error => {
            logger.error(`Failed to execute automatic adjustment for strategy ${strategyId}:`, error);
          });
      }
    }
  }

  private getAutomaticAdjustmentRules(trigger: string, data: any): Array<{
    condition: (data: any) => boolean;
    adjustmentType: StrategyAdjustment['adjustmentType'];
    parameters?: Record<string, any>;
    reason: string;
  }> {
    const rules: Array<{
      condition: (data: any) => boolean;
      adjustmentType: StrategyAdjustment['adjustmentType'];
      parameters?: Record<string, any>;
      reason: string;
    }> = [];

    if (trigger === 'anomaly') {
      // Pause strategy on critical anomalies
      rules.push({
        condition: (anomaly: Anomaly) => anomaly.severity === 'critical',
        adjustmentType: 'pause',
        reason: `Critical anomaly detected: ${data.type}`
      });

      // Adjust parameters on high latency
      rules.push({
        condition: (anomaly: Anomaly) => anomaly.type === 'high_latency',
        adjustmentType: 'parameter_update',
        parameters: { orderRefreshTime: 60 }, // Increase refresh time
        reason: 'High latency detected, increasing order refresh time'
      });
    }

    if (trigger === 'error') {
      // Stop strategy on consecutive critical errors
      rules.push({
        condition: (error: any) => error.severity === 'critical',
        adjustmentType: 'stop',
        reason: `Critical error detected: ${data.message}`
      });
    }

    return rules;
  }

  private async executeStrategyAdjustment(adjustment: StrategyAdjustment): Promise<void> {
    try {
      // This would make API calls to the Hummingbot Gateway to execute adjustments
      // For now, we'll simulate the adjustment execution
      
      switch (adjustment.adjustmentType) {
        case 'parameter_update':
          logger.info(`Updating parameters for strategy ${adjustment.strategyId}:`, adjustment.parameters);
          // API call to update strategy parameters
          break;
        
        case 'pause':
          logger.info(`Pausing strategy ${adjustment.strategyId}`);
          // API call to pause strategy
          break;
        
        case 'stop':
          logger.info(`Stopping strategy ${adjustment.strategyId}`);
          // API call to stop strategy
          break;
        
        case 'restart':
          logger.info(`Restarting strategy ${adjustment.strategyId}`);
          // API call to restart strategy
          break;
      }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      logger.error(`Failed to execute strategy adjustment:`, error);
      throw error;
    }
  }

  private setupStrategyAlertConditions(strategyId: string, strategy: HBStrategy): void {
    // Set up strategy-specific alert conditions
    const alertConditions: AlertCondition[] = [
      {
        id: `${strategyId}_high_latency`,
        name: 'High Execution Latency',
        description: 'Alert when execution latency exceeds threshold',
        enabled: true,
        conditions: [{
          metric: 'executionLatency',
          operator: 'gt',
          value: this.config.performanceThresholds.maxExecutionLatency,
          timeWindow: 60,
          aggregation: 'avg'
        }],
        actions: [{
          type: 'webhook',
          config: { url: '/api/alerts/strategy-latency' },
          enabled: true
        }],
        cooldownPeriod: 300 // 5 minutes
      },
      {
        id: `${strategyId}_low_fill_rate`,
        name: 'Low Fill Rate',
        description: 'Alert when fill rate drops below threshold',
        enabled: true,
        conditions: [{
          metric: 'fillRate',
          operator: 'lt',
          value: this.config.performanceThresholds.minFillRate,
          timeWindow: 300,
          aggregation: 'avg'
        }],
        actions: [{
          type: 'email',
          config: { to: 'trading-team@company.com' },
          enabled: true
        }],
        cooldownPeriod: 600 // 10 minutes
      }
    ];

    // Register alert conditions with the notification service
    for (const condition of alertConditions) {
      this.alertNotificationService.addAlertRule({
        id: condition.id,
        name: condition.name,
        condition: condition.description,
        severity: 'warning',
        enabled: condition.enabled,
        cooldownMs: condition.cooldownPeriod * 1000,
        channels: condition.actions.map(action => ({
          type: action.type as any,
          config: action.config,
          enabled: action.enabled
        }))
      });
    }
  }

  /**
   * Update monitoring configuration
   */
  public updateConfig(newConfig: Partial<StrategyMonitorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Strategy monitor configuration updated');
  }

  /**
   * Get current configuration
   */
  public getConfig(): StrategyMonitorConfig {
    return { ...this.config };
  }

  /**
   * Cleanup and stop monitoring
   */
  public stop(): void {
    // Stop all timers
    if (this.metricsCollectionTimer) {
      clearInterval(this.metricsCollectionTimer);
      this.metricsCollectionTimer = null;
    }

    if (this.anomalyDetectionTimer) {
      clearInterval(this.anomalyDetectionTimer);
      this.anomalyDetectionTimer = null;
    }

    if (this.alertCheckTimer) {
      clearInterval(this.alertCheckTimer);
      this.alertCheckTimer = null;
    }

    // Close all WebSocket connections
    for (const [strategyId, ws] of this.websocketConnections.entries()) {
      ws.close();
    }
    this.websocketConnections.clear();

    // Clear monitoring sessions
    this.monitoringSessions.clear();

    logger.info('Hummingbot Strategy Monitor stopped');
  }
}

export default HummingbotStrategyMonitor;