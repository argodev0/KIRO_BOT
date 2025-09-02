/**
 * Hummingbot Safety Monitor Service
 * Creates safety monitors that prevent real trades in paper trading mode
 * and implements risk limit enforcement for Hummingbot strategies
 */

import { EventEmitter } from 'events';
import { HummingbotBridgeService } from './HummingbotBridgeService';
import { PaperTradingSafetyMonitor } from './PaperTradingSafetyMonitor';
import { AuditLogService } from './AuditLogService';
import { RiskManagementService } from './RiskManagementService';
import { 
  HBStrategy, 
  StrategyExecution, 
  HBInstance,
  SafetyViolation,
  RiskLimitViolation,
  EmergencyShutdownReason
} from '../types';
import { logger } from '../utils/logger';

export interface HummingbotSafetyConfig {
  enableRealTradeBlocking: boolean;
  enableRiskLimitEnforcement: boolean;
  enableEmergencyShutdown: boolean;
  riskLimits: {
    maxPositionSize: number;
    maxDailyLoss: number;
    maxTotalExposure: number;
    maxConcurrentStrategies: number;
    maxLeverage: number;
  };
  monitoringInterval: number;
  alertThresholds: {
    highRiskScore: number;
    criticalDrawdown: number;
    highLatency: number;
    lowFillRate: number;
  };
}

export interface HummingbotSafetyStatus {
  paperTradingModeActive: boolean;
  realTradesBlocked: number;
  riskViolations: number;
  emergencyShutdownsTriggered: number;
  activeStrategies: number;
  totalExposure: number;
  lastSafetyCheck: number;
  safetyScore: number;
  violations: SafetyViolation[];
}

export interface StrategyRiskAssessment {
  strategyId: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  violations: RiskLimitViolation[];
  recommendations: string[];
  lastAssessment: number;
}

export class HummingbotSafetyMonitor extends EventEmitter {
  private bridgeService: HummingbotBridgeService;
  private paperTradingSafetyMonitor: PaperTradingSafetyMonitor;
  private auditService: AuditLogService;
  private riskService: RiskManagementService;
  private config: HummingbotSafetyConfig;
  
  private safetyStatus: HummingbotSafetyStatus;
  private strategyRiskAssessments: Map<string, StrategyRiskAssessment> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private emergencyShutdownActive = false;

  constructor(
    bridgeService: HummingbotBridgeService,
    config: Partial<HummingbotSafetyConfig> = {}
  ) {
    super();
    
    this.bridgeService = bridgeService;
    this.paperTradingSafetyMonitor = PaperTradingSafetyMonitor.getInstance();
    this.auditService = AuditLogService.getInstance();
    this.riskService = new RiskManagementService();
    
    this.config = {
      enableRealTradeBlocking: true,
      enableRiskLimitEnforcement: true,
      enableEmergencyShutdown: true,
      riskLimits: {
        maxPositionSize: 10000,
        maxDailyLoss: 5000,
        maxTotalExposure: 50000,
        maxConcurrentStrategies: 10,
        maxLeverage: 5
      },
      monitoringInterval: 10000, // 10 seconds
      alertThresholds: {
        highRiskScore: 80,
        criticalDrawdown: 0.15,
        highLatency: 2000,
        lowFillRate: 0.5
      },
      ...config
    };

    this.initializeSafetyStatus();
    this.setupEventHandlers();
    this.startMonitoring();
  }

  /**
   * Validate strategy before deployment
   */
  async validateStrategyDeployment(strategy: HBStrategy, instanceId: string): Promise<void> {
    try {
      logger.info(`Validating strategy deployment: ${strategy.type} on instance ${instanceId}`);

      // Check if paper trading mode is enabled
      if (!this.paperTradingSafetyMonitor.isPaperTradingModeEnabled()) {
        const violation: SafetyViolation = {
          type: 'paper_trading_disabled',
          severity: 'critical',
          message: 'Paper trading mode must be enabled for Hummingbot strategy deployment',
          timestamp: Date.now(),
          strategyId: undefined,
          instanceId
        };
        
        this.recordSafetyViolation(violation);
        throw new Error(violation.message);
      }

      // Validate risk limits
      await this.validateStrategyRiskLimits(strategy);

      // Check concurrent strategy limits
      await this.validateConcurrentStrategyLimits(instanceId);

      // Validate instance health
      await this.validateInstanceHealth(instanceId);

      // Block real trades if in paper trading mode
      if (this.config.enableRealTradeBlocking) {
        await this.blockRealTrades(strategy, instanceId);
      }

      this.auditService.logTradingAuditEvent({
        action: 'strategy_validation',
        resource: 'hummingbot_strategy',
        resourceId: strategy.type,
        success: true,
        strategy: strategy.type,
        paperTrade: true,
        metadata: { instanceId, riskLimits: strategy.riskLimits }
      });

      logger.info(`Strategy validation passed: ${strategy.type}`);
    } catch (error) {
      this.auditService.logTradingAuditEvent({
        action: 'strategy_validation',
        resource: 'hummingbot_strategy',
        resourceId: strategy.type,
        success: false,
        strategy: strategy.type,
        paperTrade: true,
        reason: error instanceof Error ? error.message : 'Unknown error',
        metadata: { instanceId }
      });

      logger.error('Strategy validation failed:', error);
      throw error;
    }
  }

  /**
   * Monitor strategy execution for safety violations
   */
  async monitorStrategyExecution(execution: StrategyExecution): Promise<void> {
    try {
      const assessment = await this.assessStrategyRisk(execution);
      this.strategyRiskAssessments.set(execution.id, assessment);

      // Check for violations
      if (assessment.riskLevel === 'critical') {
        await this.handleCriticalRisk(execution, assessment);
      } else if (assessment.riskLevel === 'high') {
        await this.handleHighRisk(execution, assessment);
      }

      // Update safety status
      this.updateSafetyStatus();

      this.emit('strategy:monitored', { execution, assessment });
    } catch (error) {
      logger.error('Error monitoring strategy execution:', error);
      this.emit('monitoring:error', { executionId: execution.id, error });
    }
  }

  /**
   * Enforce risk limits for active strategies
   */
  async enforceRiskLimits(): Promise<void> {
    if (!this.config.enableRiskLimitEnforcement) {
      return;
    }

    try {
      const connections = this.bridgeService.getConnections();
      
      for (const [instanceId, connection] of connections) {
        if (connection.status !== 'connected') continue;

        // Get instance strategies (this would need to be implemented in bridge service)
        const strategies = await this.getInstanceStrategies(instanceId);
        
        for (const strategy of strategies) {
          await this.enforceStrategyRiskLimits(strategy, instanceId);
        }
      }

      // Check total exposure across all instances
      await this.enforceGlobalRiskLimits();

    } catch (error) {
      logger.error('Error enforcing risk limits:', error);
      this.emit('risk_enforcement:error', error);
    }
  }

  /**
   * Execute emergency shutdown for critical violations
   */
  async executeEmergencyShutdown(reason: EmergencyShutdownReason): Promise<void> {
    if (this.emergencyShutdownActive) {
      logger.warn('Emergency shutdown already active');
      return;
    }

    try {
      this.emergencyShutdownActive = true;
      
      logger.error('HUMMINGBOT EMERGENCY SHUTDOWN INITIATED', {
        reason: reason.type,
        message: reason.message,
        severity: reason.severity
      });

      // Stop all Hummingbot strategies
      await this.stopAllHummingbotStrategies();

      // Disconnect all Hummingbot instances
      await this.disconnectAllInstances();

      // Trigger system-wide emergency shutdown
      // Map Hummingbot emergency reason to RiskManagement reason
      const riskServiceReason = {
        type: reason.type === 'security_breach' ? 'system_error' as const : reason.type,
        message: reason.message,
        severity: reason.severity,
        timestamp: reason.timestamp
      };
      await this.riskService.executeEmergencyShutdown(riskServiceReason);

      // Record emergency shutdown
      this.auditService.logSecurityAuditEvent({
        action: 'emergency_shutdown',
        resource: 'hummingbot_system',
        success: true,
        eventType: 'suspicious_activity',
        severity: 'critical',
        metadata: { reason, timestamp: Date.now() }
      });

      this.safetyStatus.emergencyShutdownsTriggered++;
      this.emit('emergency:shutdown_completed', reason);

      logger.info('Hummingbot emergency shutdown completed');
    } catch (error) {
      logger.error('Error during emergency shutdown:', error);
      this.emit('emergency:shutdown_failed', { reason, error });
      throw error;
    }
  }

  /**
   * Get current safety status
   */
  getSafetyStatus(): HummingbotSafetyStatus {
    return { ...this.safetyStatus };
  }

  /**
   * Get strategy risk assessment
   */
  getStrategyRiskAssessment(strategyId: string): StrategyRiskAssessment | undefined {
    return this.strategyRiskAssessments.get(strategyId);
  }

  /**
   * Get all strategy risk assessments
   */
  getAllStrategyRiskAssessments(): StrategyRiskAssessment[] {
    return Array.from(this.strategyRiskAssessments.values());
  }

  /**
   * Reset emergency shutdown state
   */
  resetEmergencyShutdown(): void {
    this.emergencyShutdownActive = false;
    logger.info('Hummingbot emergency shutdown state reset');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    logger.info('Hummingbot safety monitoring stopped');
  }

  // Private methods

  private initializeSafetyStatus(): void {
    this.safetyStatus = {
      paperTradingModeActive: this.paperTradingSafetyMonitor.isPaperTradingModeEnabled(),
      realTradesBlocked: 0,
      riskViolations: 0,
      emergencyShutdownsTriggered: 0,
      activeStrategies: 0,
      totalExposure: 0,
      lastSafetyCheck: Date.now(),
      safetyScore: 100,
      violations: []
    };
  }

  private setupEventHandlers(): void {
    // Listen to paper trading safety monitor events
    this.paperTradingSafetyMonitor.on('critical_safety_violation', async (event) => {
      await this.handlePaperTradingSafetyViolation(event);
    });

    this.paperTradingSafetyMonitor.on('real_trading_attempt_blocked', (event) => {
      this.safetyStatus.realTradesBlocked++;
      this.emit('real_trade:blocked', event);
    });

    // Listen to bridge service events
    this.bridgeService.on('strategy:failed', async (event) => {
      await this.handleStrategyFailure(event);
    });

    this.bridgeService.on('connection:failed', async (event) => {
      await this.handleConnectionFailure(event);
    });
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performSafetyCheck();
      } catch (error) {
        logger.error('Safety check failed:', error);
      }
    }, this.config.monitoringInterval);

    logger.info('Hummingbot safety monitoring started');
  }

  private async performSafetyCheck(): Promise<void> {
    this.safetyStatus.lastSafetyCheck = Date.now();

    // Check paper trading mode
    this.safetyStatus.paperTradingModeActive = this.paperTradingSafetyMonitor.isPaperTradingModeEnabled();

    // Enforce risk limits
    await this.enforceRiskLimits();

    // Update active strategies count
    this.safetyStatus.activeStrategies = this.strategyRiskAssessments.size;

    // Calculate total exposure
    this.safetyStatus.totalExposure = this.calculateTotalExposure();

    // Calculate safety score
    this.safetyStatus.safetyScore = this.calculateSafetyScore();

    // Check for emergency conditions
    await this.checkEmergencyConditions();

    this.emit('safety:check_completed', this.safetyStatus);
  }

  private async validateStrategyRiskLimits(strategy: HBStrategy): Promise<void> {
    const violations: RiskLimitViolation[] = [];

    // Check position size limit
    if (strategy.riskLimits.maxPositionSize > this.config.riskLimits.maxPositionSize) {
      violations.push({
        type: 'max_position_size',
        message: `Strategy position size ${strategy.riskLimits.maxPositionSize} exceeds limit ${this.config.riskLimits.maxPositionSize}`,
        currentValue: strategy.riskLimits.maxPositionSize,
        maxAllowed: this.config.riskLimits.maxPositionSize,
        severity: 'high'
      });
    }

    // Check leverage limit
    const leverage = strategy.executionSettings?.leverage || 1;
    if (leverage > this.config.riskLimits.maxLeverage) {
      violations.push({
        type: 'max_leverage',
        message: `Strategy leverage ${leverage} exceeds limit ${this.config.riskLimits.maxLeverage}`,
        currentValue: leverage,
        maxAllowed: this.config.riskLimits.maxLeverage,
        severity: 'critical'
      });
    }

    if (violations.length > 0) {
      const violation: SafetyViolation = {
        type: 'risk_limit_violation',
        severity: violations.some(v => v.severity === 'critical') ? 'critical' : 'high',
        message: `Strategy risk limits violated: ${violations.map(v => v.message).join(', ')}`,
        timestamp: Date.now(),
        metadata: { violations }
      };

      this.recordSafetyViolation(violation);
      throw new Error(violation.message);
    }
  }

  private async validateConcurrentStrategyLimits(instanceId: string): Promise<void> {
    const activeStrategies = this.strategyRiskAssessments.size;
    
    if (activeStrategies >= this.config.riskLimits.maxConcurrentStrategies) {
      const violation: SafetyViolation = {
        type: 'max_concurrent_strategies',
        severity: 'high',
        message: `Maximum concurrent strategies limit reached: ${this.config.riskLimits.maxConcurrentStrategies}`,
        timestamp: Date.now(),
        instanceId
      };

      this.recordSafetyViolation(violation);
      throw new Error(violation.message);
    }
  }

  private async validateInstanceHealth(instanceId: string): Promise<void> {
    const connection = this.bridgeService.getConnection(instanceId);
    
    if (!connection || connection.status !== 'connected') {
      const violation: SafetyViolation = {
        type: 'instance_unhealthy',
        severity: 'high',
        message: `Instance ${instanceId} is not healthy or connected`,
        timestamp: Date.now(),
        instanceId
      };

      this.recordSafetyViolation(violation);
      throw new Error(violation.message);
    }
  }

  private async blockRealTrades(strategy: HBStrategy, instanceId: string): Promise<void> {
    // Ensure strategy is configured for paper trading only
    if (!this.paperTradingSafetyMonitor.isPaperTradingModeEnabled()) {
      this.paperTradingSafetyMonitor.recordRealTradingAttemptBlocked(
        'system',
        `hummingbot_strategy_${strategy.type}`,
        'paper_trading_mode_required'
      );
      
      throw new Error('Real trading blocked: Paper trading mode must be enabled');
    }

    // Add paper trading flags to strategy
    strategy.executionSettings = {
      ...strategy.executionSettings,
      paperTradingMode: true,
      simulationOnly: true,
      preventRealTrades: true
    };

    logger.info(`Real trades blocked for strategy ${strategy.type} on instance ${instanceId}`);
  }

  private async assessStrategyRisk(execution: StrategyExecution): Promise<StrategyRiskAssessment> {
    let riskScore = 0;
    const violations: RiskLimitViolation[] = [];
    const recommendations: string[] = [];

    // Assess performance metrics
    const performance = execution.performance;
    
    // High drawdown risk
    if (performance.currentDrawdown > this.config.alertThresholds.criticalDrawdown) {
      riskScore += 30;
      violations.push({
        type: 'high_drawdown',
        message: `Current drawdown ${(performance.currentDrawdown * 100).toFixed(2)}% exceeds critical threshold`,
        currentValue: performance.currentDrawdown,
        maxAllowed: this.config.alertThresholds.criticalDrawdown,
        severity: 'critical'
      });
      recommendations.push('Consider reducing position sizes or stopping strategy');
    }

    // Low fill rate risk
    if (performance.fillRate < this.config.alertThresholds.lowFillRate) {
      riskScore += 20;
      violations.push({
        type: 'low_fill_rate',
        message: `Fill rate ${(performance.fillRate * 100).toFixed(2)}% is below threshold`,
        currentValue: performance.fillRate,
        maxAllowed: this.config.alertThresholds.lowFillRate,
        severity: 'medium'
      });
      recommendations.push('Review order placement strategy and market conditions');
    }

    // High latency risk
    if (performance.averageLatency > this.config.alertThresholds.highLatency) {
      riskScore += 15;
      violations.push({
        type: 'high_latency',
        message: `Average latency ${performance.averageLatency}ms exceeds threshold`,
        currentValue: performance.averageLatency,
        maxAllowed: this.config.alertThresholds.highLatency,
        severity: 'medium'
      });
      recommendations.push('Check network connectivity and system performance');
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (riskScore >= 80) {
      riskLevel = 'critical';
    } else if (riskScore >= 60) {
      riskLevel = 'high';
    } else if (riskScore >= 30) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    return {
      strategyId: execution.id,
      riskScore,
      riskLevel,
      violations,
      recommendations,
      lastAssessment: Date.now()
    };
  }

  private async handleCriticalRisk(execution: StrategyExecution, assessment: StrategyRiskAssessment): Promise<void> {
    logger.error(`Critical risk detected for strategy ${execution.id}:`, assessment);

    // Stop the strategy immediately
    try {
      await this.bridgeService.stopStrategy(execution.id);
      
      const violation: SafetyViolation = {
        type: 'critical_risk_detected',
        severity: 'critical',
        message: `Strategy ${execution.id} stopped due to critical risk (score: ${assessment.riskScore})`,
        timestamp: Date.now(),
        strategyId: execution.id,
        metadata: { assessment }
      };

      this.recordSafetyViolation(violation);
      this.emit('strategy:critical_risk', { execution, assessment });
    } catch (error) {
      logger.error('Failed to stop critical risk strategy:', error);
    }
  }

  private async handleHighRisk(execution: StrategyExecution, assessment: StrategyRiskAssessment): Promise<void> {
    logger.warn(`High risk detected for strategy ${execution.id}:`, assessment);

    const violation: SafetyViolation = {
      type: 'high_risk_detected',
      severity: 'high',
      message: `Strategy ${execution.id} has high risk (score: ${assessment.riskScore})`,
      timestamp: Date.now(),
      strategyId: execution.id,
      metadata: { assessment }
    };

    this.recordSafetyViolation(violation);
    this.emit('strategy:high_risk', { execution, assessment });
  }

  private async getInstanceStrategies(instanceId: string): Promise<StrategyExecution[]> {
    // This would need to be implemented in the bridge service
    // For now, return empty array
    return [];
  }

  private async enforceStrategyRiskLimits(strategy: StrategyExecution, instanceId: string): Promise<void> {
    const assessment = this.strategyRiskAssessments.get(strategy.id);
    if (!assessment) return;

    // Check if strategy violates risk limits
    const criticalViolations = assessment.violations.filter(v => v.severity === 'critical');
    
    if (criticalViolations.length > 0) {
      logger.warn(`Enforcing risk limits for strategy ${strategy.id}:`, criticalViolations);
      
      try {
        await this.bridgeService.stopStrategy(strategy.id);
        this.safetyStatus.riskViolations++;
        
        this.emit('risk_limit:enforced', { strategyId: strategy.id, violations: criticalViolations });
      } catch (error) {
        logger.error('Failed to enforce risk limits:', error);
      }
    }
  }

  private async enforceGlobalRiskLimits(): Promise<void> {
    const totalExposure = this.calculateTotalExposure();
    
    if (totalExposure > this.config.riskLimits.maxTotalExposure) {
      const violation: SafetyViolation = {
        type: 'max_total_exposure',
        severity: 'critical',
        message: `Total exposure ${totalExposure} exceeds limit ${this.config.riskLimits.maxTotalExposure}`,
        timestamp: Date.now(),
        metadata: { totalExposure, limit: this.config.riskLimits.maxTotalExposure }
      };

      this.recordSafetyViolation(violation);
      
      // Trigger emergency shutdown if exposure is too high
      if (totalExposure > this.config.riskLimits.maxTotalExposure * 1.5) {
        await this.executeEmergencyShutdown({
          type: 'risk_violation',
          message: `Total exposure ${totalExposure} critically exceeds limits`,
          severity: 'critical',
          timestamp: Date.now()
        });
      }
    }
  }

  private calculateTotalExposure(): number {
    // Calculate total exposure across all strategies
    let totalExposure = 0;
    
    for (const assessment of this.strategyRiskAssessments.values()) {
      // This would need actual position data from strategies
      // For now, use a placeholder calculation
      totalExposure += 1000; // Placeholder
    }
    
    return totalExposure;
  }

  private calculateSafetyScore(): number {
    let score = 100;
    
    // Deduct points for violations
    score -= this.safetyStatus.violations.length * 5;
    
    // Deduct points for high risk strategies
    const highRiskStrategies = Array.from(this.strategyRiskAssessments.values())
      .filter(a => a.riskLevel === 'high' || a.riskLevel === 'critical').length;
    score -= highRiskStrategies * 10;
    
    // Deduct points if paper trading is disabled
    if (!this.safetyStatus.paperTradingModeActive) {
      score -= 50;
    }
    
    return Math.max(0, score);
  }

  private async checkEmergencyConditions(): Promise<void> {
    const criticalConditions: string[] = [];
    
    // Check if paper trading is disabled
    if (!this.safetyStatus.paperTradingModeActive) {
      criticalConditions.push('Paper trading mode disabled');
    }
    
    // Check safety score
    if (this.safetyStatus.safetyScore < 20) {
      criticalConditions.push(`Safety score critically low: ${this.safetyStatus.safetyScore}`);
    }
    
    // Check for too many critical risk strategies
    const criticalRiskStrategies = Array.from(this.strategyRiskAssessments.values())
      .filter(a => a.riskLevel === 'critical').length;
    
    if (criticalRiskStrategies > 2) {
      criticalConditions.push(`Too many critical risk strategies: ${criticalRiskStrategies}`);
    }
    
    // Trigger emergency shutdown if conditions are met
    if (criticalConditions.length > 0 && this.config.enableEmergencyShutdown) {
      await this.executeEmergencyShutdown({
        type: 'system_error',
        message: `Emergency conditions detected: ${criticalConditions.join(', ')}`,
        severity: 'critical',
        timestamp: Date.now()
      });
    }
  }

  private recordSafetyViolation(violation: SafetyViolation): void {
    this.safetyStatus.violations.push(violation);
    this.safetyStatus.riskViolations++;
    
    // Keep only last 100 violations
    if (this.safetyStatus.violations.length > 100) {
      this.safetyStatus.violations = this.safetyStatus.violations.slice(-100);
    }
    
    this.emit('safety:violation', violation);
    
    // Log to audit service
    this.auditService.logSecurityAuditEvent({
      action: 'safety_violation',
      resource: 'hummingbot_safety',
      success: false,
      eventType: 'suspicious_activity',
      severity: violation.severity,
      metadata: violation
    });
  }

  private async handlePaperTradingSafetyViolation(event: any): Promise<void> {
    const violation: SafetyViolation = {
      type: 'paper_trading_safety_violation',
      severity: 'critical',
      message: `Paper trading safety violation: ${event.message}`,
      timestamp: Date.now(),
      metadata: event
    };

    this.recordSafetyViolation(violation);
    
    // Stop all Hummingbot strategies if critical
    if (event.type === 'paper_trading_disabled') {
      await this.executeEmergencyShutdown({
        type: 'system_error',
        message: 'Paper trading disabled - stopping all Hummingbot operations',
        severity: 'critical',
        timestamp: Date.now()
      });
    }
  }

  private async handleStrategyFailure(event: any): Promise<void> {
    const violation: SafetyViolation = {
      type: 'strategy_failure',
      severity: 'medium',
      message: `Strategy execution failed: ${event.error?.message || 'Unknown error'}`,
      timestamp: Date.now(),
      strategyId: event.strategy?.id,
      metadata: event
    };

    this.recordSafetyViolation(violation);
  }

  private async handleConnectionFailure(event: any): Promise<void> {
    const violation: SafetyViolation = {
      type: 'connection_failure',
      severity: 'high',
      message: `Hummingbot connection failed: ${event.error?.message || 'Unknown error'}`,
      timestamp: Date.now(),
      instanceId: event.instanceId,
      metadata: event
    };

    this.recordSafetyViolation(violation);
  }

  private async stopAllHummingbotStrategies(): Promise<void> {
    logger.info('Stopping all Hummingbot strategies...');
    
    const stopPromises: Promise<void>[] = [];
    
    for (const strategyId of this.strategyRiskAssessments.keys()) {
      stopPromises.push(
        this.bridgeService.stopStrategy(strategyId).then(() => {
          // Strategy stopped successfully
        }).catch(error => {
          logger.error(`Failed to stop strategy ${strategyId}:`, error);
        })
      );
    }
    
    await Promise.allSettled(stopPromises);
    logger.info('All Hummingbot strategies stop commands sent');
  }

  private async disconnectAllInstances(): Promise<void> {
    logger.info('Disconnecting all Hummingbot instances...');
    
    try {
      await this.bridgeService.disconnectAll();
      logger.info('All Hummingbot instances disconnected');
    } catch (error) {
      logger.error('Error disconnecting Hummingbot instances:', error);
    }
  }

  private updateSafetyStatus(): void {
    this.safetyStatus.activeStrategies = this.strategyRiskAssessments.size;
    this.safetyStatus.totalExposure = this.calculateTotalExposure();
    this.safetyStatus.safetyScore = this.calculateSafetyScore();
    this.safetyStatus.lastSafetyCheck = Date.now();
  }
}

export default HummingbotSafetyMonitor;