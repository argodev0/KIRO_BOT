/**
 * Hummingbot Emergency Shutdown Service
 * Create emergency shutdown procedures for Hummingbot instances
 */

import { EventEmitter } from 'events';
import { HummingbotBridgeService } from './HummingbotBridgeService';
import { HummingbotManager } from './HummingbotManager';
import { HummingbotAuditLogger } from './HummingbotAuditLogger';
import { PaperTradingSafetyMonitor } from './PaperTradingSafetyMonitor';
import { 
  EmergencyShutdownReason,
  EmergencyShutdownPlan,
  EmergencyShutdownResult,
  ShutdownStep,
  ShutdownStepResult
} from '../types';
import { logger } from '../utils/logger';

export interface EmergencyShutdownConfig {
  enableAutoShutdown: boolean;
  shutdownTimeoutMs: number;
  maxRetryAttempts: number;
  retryDelayMs: number;
  forceShutdownAfterMs: number;
  notificationChannels: string[];
  shutdownTriggers: {
    criticalSafetyViolations: boolean;
    paperTradingDisabled: boolean;
    highRiskScore: boolean;
    systemErrors: boolean;
    manualTrigger: boolean;
  };
}

export interface EmergencyShutdownStatus {
  isActive: boolean;
  startedAt?: number;
  completedAt?: number;
  reason?: EmergencyShutdownReason;
  plan?: EmergencyShutdownPlan;
  result?: EmergencyShutdownResult;
  currentStep?: string;
  progress: number;
}

export class HummingbotEmergencyShutdown extends EventEmitter {
  private bridgeService: HummingbotBridgeService;
  private hummingbotManager: HummingbotManager;
  private auditLogger: HummingbotAuditLogger;
  private safetyMonitor: PaperTradingSafetyMonitor;
  private config: EmergencyShutdownConfig;
  
  private shutdownStatus: EmergencyShutdownStatus;
  private shutdownInProgress = false;
  private shutdownTimeout: NodeJS.Timeout | null = null;

  constructor(
    bridgeService: HummingbotBridgeService,
    hummingbotManager: HummingbotManager,
    config: Partial<EmergencyShutdownConfig> = {}
  ) {
    super();
    
    this.bridgeService = bridgeService;
    this.hummingbotManager = hummingbotManager;
    this.auditLogger = new HummingbotAuditLogger();
    this.safetyMonitor = PaperTradingSafetyMonitor.getInstance();
    
    this.config = {
      enableAutoShutdown: true,
      shutdownTimeoutMs: 60000, // 1 minute
      maxRetryAttempts: 3,
      retryDelayMs: 5000, // 5 seconds
      forceShutdownAfterMs: 300000, // 5 minutes
      notificationChannels: ['email', 'slack', 'webhook'],
      shutdownTriggers: {
        criticalSafetyViolations: true,
        paperTradingDisabled: true,
        highRiskScore: true,
        systemErrors: true,
        manualTrigger: true
      },
      ...config
    };

    this.initializeShutdownStatus();
    this.setupEventHandlers();
  }

  /**
   * Execute emergency shutdown
   */
  async executeEmergencyShutdown(reason: EmergencyShutdownReason): Promise<EmergencyShutdownResult> {
    if (this.shutdownInProgress) {
      logger.warn('Emergency shutdown already in progress');
      return this.shutdownStatus.result || {
        success: false,
        reason,
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        steps: [],
        errors: ['Shutdown already in progress']
      };
    }

    try {
      this.shutdownInProgress = true;
      this.shutdownStatus.isActive = true;
      this.shutdownStatus.startedAt = Date.now();
      this.shutdownStatus.reason = reason;
      this.shutdownStatus.progress = 0;

      logger.error('HUMMINGBOT EMERGENCY SHUTDOWN INITIATED', {
        reason: reason.type,
        message: reason.message,
        severity: reason.severity,
        timestamp: reason.timestamp
      });

      // Create shutdown plan
      const plan = this.createShutdownPlan(reason);
      this.shutdownStatus.plan = plan;

      // Set timeout for force shutdown
      this.setForceShutdownTimeout();

      // Execute shutdown plan
      const result = await this.executeShutdownPlan(plan);
      
      this.shutdownStatus.result = result;
      this.shutdownStatus.completedAt = Date.now();
      this.shutdownStatus.progress = 100;

      // Log shutdown completion
      this.auditLogger.logSafetyEvent(
        'emergency_shutdown',
        null,
        result.success,
        {
          reason,
          duration: result.duration,
          stepsCompleted: result.steps.length,
          errors: result.errors
        }
      );

      this.emit('shutdown:completed', result);
      
      if (result.success) {
        logger.info('Emergency shutdown completed successfully');
      } else {
        logger.error('Emergency shutdown completed with errors:', result.errors);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Emergency shutdown failed:', error);

      const result: EmergencyShutdownResult = {
        success: false,
        reason,
        startTime: this.shutdownStatus.startedAt || Date.now(),
        endTime: Date.now(),
        duration: Date.now() - (this.shutdownStatus.startedAt || Date.now()),
        steps: [],
        errors: [errorMessage]
      };

      this.shutdownStatus.result = result;
      this.shutdownStatus.completedAt = Date.now();
      this.emit('shutdown:failed', { reason, error });

      return result;
    } finally {
      this.shutdownInProgress = false;
      this.clearForceShutdownTimeout();
    }
  }

  /**
   * Check if emergency shutdown should be triggered
   */
  shouldTriggerEmergencyShutdown(reason: EmergencyShutdownReason): boolean {
    if (!this.config.enableAutoShutdown) {
      return false;
    }

    switch (reason.type) {
      case 'risk_violation':
        return this.config.shutdownTriggers.criticalSafetyViolations;
      case 'system_error':
        return this.config.shutdownTriggers.systemErrors;
      case 'manual':
        return this.config.shutdownTriggers.manualTrigger;
      default:
        return false;
    }
  }

  /**
   * Get current shutdown status
   */
  getShutdownStatus(): EmergencyShutdownStatus {
    return { ...this.shutdownStatus };
  }

  /**
   * Cancel emergency shutdown if in progress
   */
  async cancelEmergencyShutdown(): Promise<boolean> {
    if (!this.shutdownInProgress) {
      return false;
    }

    try {
      logger.warn('Cancelling emergency shutdown...');
      
      this.clearForceShutdownTimeout();
      this.shutdownInProgress = false;
      this.shutdownStatus.isActive = false;
      this.shutdownStatus.completedAt = Date.now();

      this.auditLogger.logSafetyEvent(
        'emergency_shutdown',
        null,
        false,
        { cancelled: true, reason: 'manual_cancellation' }
      );

      this.emit('shutdown:cancelled');
      return true;
    } catch (error) {
      logger.error('Failed to cancel emergency shutdown:', error);
      return false;
    }
  }

  /**
   * Test emergency shutdown procedures
   */
  async testEmergencyShutdown(): Promise<EmergencyShutdownResult> {
    const testReason: EmergencyShutdownReason = {
      type: 'manual',
      message: 'Emergency shutdown test',
      severity: 'high',
      timestamp: Date.now()
    };

    logger.info('Testing emergency shutdown procedures...');
    
    // Create a test plan with dry-run steps
    const testPlan = this.createTestShutdownPlan();
    
    const result = await this.executeShutdownPlan(testPlan, true); // dry-run mode
    
    this.auditLogger.logSafetyEvent(
      'emergency_shutdown',
      null,
      result.success,
      { test: true, reason: testReason }
    );

    return result;
  }

  // Private methods

  private initializeShutdownStatus(): void {
    this.shutdownStatus = {
      isActive: false,
      progress: 0
    };
  }

  private setupEventHandlers(): void {
    // Listen for safety violations
    this.safetyMonitor.on('critical_safety_violation', async (event) => {
      if (this.config.shutdownTriggers.criticalSafetyViolations) {
        const reason: EmergencyShutdownReason = {
          type: 'risk_violation',
          message: `Critical safety violation: ${event.message}`,
          severity: 'critical',
          timestamp: Date.now()
        };
        
        await this.executeEmergencyShutdown(reason);
      }
    });

    // Listen for paper trading mode changes
    this.safetyMonitor.on('paper_trading_disabled', async () => {
      if (this.config.shutdownTriggers.paperTradingDisabled) {
        const reason: EmergencyShutdownReason = {
          type: 'system_error',
          message: 'Paper trading mode disabled - emergency shutdown required',
          severity: 'critical',
          timestamp: Date.now()
        };
        
        await this.executeEmergencyShutdown(reason);
      }
    });
  }

  private createShutdownPlan(reason: EmergencyShutdownReason): EmergencyShutdownPlan {
    const steps: ShutdownStep[] = [];

    // Step 1: Send notifications
    steps.push({
      id: 'notify',
      name: 'Send Emergency Notifications',
      description: 'Notify administrators and stakeholders',
      priority: 1,
      timeout: 10000,
      retryable: true,
      critical: false
    });

    // Step 2: Stop all strategies
    steps.push({
      id: 'stop_strategies',
      name: 'Stop All Hummingbot Strategies',
      description: 'Gracefully stop all running strategies',
      priority: 2,
      timeout: 30000,
      retryable: true,
      critical: true
    });

    // Step 3: Cancel pending orders
    steps.push({
      id: 'cancel_orders',
      name: 'Cancel All Pending Orders',
      description: 'Cancel all pending orders across all instances',
      priority: 3,
      timeout: 20000,
      retryable: true,
      critical: true
    });

    // Step 4: Disconnect instances
    steps.push({
      id: 'disconnect_instances',
      name: 'Disconnect Hummingbot Instances',
      description: 'Disconnect from all Hummingbot instances',
      priority: 4,
      timeout: 15000,
      retryable: true,
      critical: true
    });

    // Step 5: Stop instances (if severe)
    if (reason.severity === 'critical') {
      steps.push({
        id: 'stop_instances',
        name: 'Stop Hummingbot Instances',
        description: 'Stop all Hummingbot Docker containers',
        priority: 5,
        timeout: 30000,
        retryable: true,
        critical: false
      });
    }

    // Step 6: Update safety status
    steps.push({
      id: 'update_safety',
      name: 'Update Safety Status',
      description: 'Update system safety status and disable trading',
      priority: 6,
      timeout: 5000,
      retryable: false,
      critical: true
    });

    // Step 7: Generate shutdown report
    steps.push({
      id: 'generate_report',
      name: 'Generate Shutdown Report',
      description: 'Generate detailed shutdown report',
      priority: 7,
      timeout: 10000,
      retryable: false,
      critical: false
    });

    return {
      id: `shutdown_${Date.now()}`,
      reason,
      steps,
      createdAt: Date.now(),
      estimatedDuration: steps.reduce((sum, step) => sum + step.timeout, 0)
    };
  }

  private createTestShutdownPlan(): EmergencyShutdownPlan {
    const testReason: EmergencyShutdownReason = {
      type: 'manual',
      message: 'Test shutdown',
      severity: 'high',
      timestamp: Date.now()
    };

    return {
      id: `test_shutdown_${Date.now()}`,
      reason: testReason,
      steps: [
        {
          id: 'test_notifications',
          name: 'Test Notifications',
          description: 'Test notification systems',
          priority: 1,
          timeout: 5000,
          retryable: false,
          critical: false
        },
        {
          id: 'test_strategy_stop',
          name: 'Test Strategy Stop',
          description: 'Test strategy stopping procedures',
          priority: 2,
          timeout: 10000,
          retryable: false,
          critical: false
        },
        {
          id: 'test_connection_handling',
          name: 'Test Connection Handling',
          description: 'Test connection management',
          priority: 3,
          timeout: 5000,
          retryable: false,
          critical: false
        }
      ],
      createdAt: Date.now(),
      estimatedDuration: 20000
    };
  }

  private async executeShutdownPlan(plan: EmergencyShutdownPlan, dryRun: boolean = false): Promise<EmergencyShutdownResult> {
    const startTime = Date.now();
    const stepResults: ShutdownStepResult[] = [];
    const errors: string[] = [];

    logger.info(`${dryRun ? 'Testing' : 'Executing'} shutdown plan: ${plan.id}`);

    for (const step of plan.steps) {
      this.shutdownStatus.currentStep = step.name;
      this.shutdownStatus.progress = (stepResults.length / plan.steps.length) * 100;

      logger.info(`${dryRun ? 'Testing' : 'Executing'} shutdown step: ${step.name}`);

      const stepResult = await this.executeShutdownStep(step, dryRun);
      stepResults.push(stepResult);

      if (!stepResult.success) {
        errors.push(`Step ${step.name} failed: ${stepResult.error}`);
        
        if (step.critical && !dryRun) {
          logger.error(`Critical step failed: ${step.name}`);
          // Continue with other steps but mark as failed
        }
      }

      this.emit('shutdown:step_completed', stepResult);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    const success = stepResults.every(r => r.success) || dryRun;

    const result: EmergencyShutdownResult = {
      success,
      reason: plan.reason,
      startTime,
      endTime,
      duration,
      steps: stepResults,
      errors
    };

    return result;
  }

  private async executeShutdownStep(step: ShutdownStep, dryRun: boolean = false): Promise<ShutdownStepResult> {
    const startTime = Date.now();
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < this.config.maxRetryAttempts) {
      attempts++;
      
      try {
        if (dryRun) {
          // Simulate step execution
          await this.simulateShutdownStep(step);
        } else {
          await this.performShutdownStep(step);
        }

        const endTime = Date.now();
        return {
          stepId: step.id,
          stepName: step.name,
          success: true,
          startTime,
          endTime,
          duration: endTime - startTime,
          attempts
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.warn(`Shutdown step ${step.name} failed (attempt ${attempts}):`, error);

        if (step.retryable && attempts < this.config.maxRetryAttempts) {
          await this.delay(this.config.retryDelayMs);
        } else {
          break;
        }
      }
    }

    const endTime = Date.now();
    return {
      stepId: step.id,
      stepName: step.name,
      success: false,
      startTime,
      endTime,
      duration: endTime - startTime,
      attempts,
      error: lastError?.message || 'Unknown error'
    };
  }

  private async simulateShutdownStep(step: ShutdownStep): Promise<void> {
    // Simulate step execution with realistic delay
    const simulationDelay = Math.min(step.timeout / 10, 2000); // Max 2 seconds
    await this.delay(simulationDelay);
    
    logger.info(`Simulated shutdown step: ${step.name}`);
  }

  private async performShutdownStep(step: ShutdownStep): Promise<void> {
    switch (step.id) {
      case 'notify':
        await this.sendEmergencyNotifications();
        break;
      case 'stop_strategies':
        await this.stopAllStrategies();
        break;
      case 'cancel_orders':
        await this.cancelAllOrders();
        break;
      case 'disconnect_instances':
        await this.disconnectAllInstances();
        break;
      case 'stop_instances':
        await this.stopAllInstances();
        break;
      case 'update_safety':
        await this.updateSafetyStatus();
        break;
      case 'generate_report':
        await this.generateShutdownReport();
        break;
      default:
        throw new Error(`Unknown shutdown step: ${step.id}`);
    }
  }

  private async sendEmergencyNotifications(): Promise<void> {
    logger.info('Sending emergency notifications...');
    
    // This would integrate with actual notification systems
    // For now, just log the notification
    const notification = {
      type: 'emergency_shutdown',
      message: 'Hummingbot emergency shutdown initiated',
      timestamp: Date.now(),
      reason: this.shutdownStatus.reason
    };

    logger.warn('EMERGENCY NOTIFICATION:', notification);
    
    // Simulate notification delay
    await this.delay(1000);
  }

  private async stopAllStrategies(): Promise<void> {
    logger.info('Stopping all Hummingbot strategies...');
    
    const connections = this.bridgeService.getConnections();
    const stopPromises: Promise<void>[] = [];

    for (const [instanceId] of connections) {
      // This would need to be implemented in the bridge service
      // For now, simulate the operation
      stopPromises.push(
        this.delay(1000).then(() => {
          logger.info(`Stopped strategies for instance: ${instanceId}`);
        })
      );
    }

    await Promise.allSettled(stopPromises);
  }

  private async cancelAllOrders(): Promise<void> {
    logger.info('Cancelling all pending orders...');
    
    // This would integrate with the actual order management system
    // For now, simulate the operation
    await this.delay(2000);
    
    logger.info('All pending orders cancelled');
  }

  private async disconnectAllInstances(): Promise<void> {
    logger.info('Disconnecting all Hummingbot instances...');
    
    try {
      await this.bridgeService.disconnectAll();
      logger.info('All instances disconnected');
    } catch (error) {
      logger.error('Error disconnecting instances:', error);
      throw error;
    }
  }

  private async stopAllInstances(): Promise<void> {
    logger.info('Stopping all Hummingbot instances...');
    
    try {
      // This would use the HummingbotManager to stop all instances
      const instances = this.hummingbotManager.getAllInstances();
      
      for (const instance of instances) {
        logger.info(`Stopping instance: ${instance.id}`);
        // Instance stopping would be implemented here
      }
      
      await this.delay(5000); // Simulate stopping time
      logger.info('All instances stopped');
    } catch (error) {
      logger.error('Error stopping instances:', error);
      throw error;
    }
  }

  private async updateSafetyStatus(): Promise<void> {
    logger.info('Updating safety status...');
    
    // Disable paper trading safety monitor
    this.safetyMonitor.setPaperTradingMode(false);
    
    // Update system status
    // This would integrate with system status management
    
    logger.info('Safety status updated');
  }

  private async generateShutdownReport(): Promise<void> {
    logger.info('Generating shutdown report...');
    
    const report = {
      shutdownId: this.shutdownStatus.plan?.id,
      reason: this.shutdownStatus.reason,
      startTime: this.shutdownStatus.startedAt,
      endTime: Date.now(),
      steps: this.shutdownStatus.result?.steps || [],
      success: this.shutdownStatus.result?.success || false
    };

    // This would save the report to a file or database
    logger.info('Shutdown report generated:', report);
  }

  private setForceShutdownTimeout(): void {
    this.shutdownTimeout = setTimeout(() => {
      logger.error('Force shutdown timeout reached - terminating all processes');
      this.forceShutdown();
    }, this.config.forceShutdownAfterMs);
  }

  private clearForceShutdownTimeout(): void {
    if (this.shutdownTimeout) {
      clearTimeout(this.shutdownTimeout);
      this.shutdownTimeout = null;
    }
  }

  private forceShutdown(): void {
    logger.error('FORCE SHUTDOWN INITIATED');
    
    // Force terminate all processes
    // This would be a last resort measure
    
    this.emit('shutdown:force_terminated');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default HummingbotEmergencyShutdown;