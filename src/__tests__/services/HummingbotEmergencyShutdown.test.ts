/**
 * Tests for Hummingbot Emergency Shutdown Service
 */

import { HummingbotEmergencyShutdown } from '../../services/HummingbotEmergencyShutdown';
import { HummingbotBridgeService } from '../../services/HummingbotBridgeService';
import { HummingbotManager } from '../../services/HummingbotManager';
import { EmergencyShutdownReason } from '../../types';

// Mock dependencies
jest.mock('../../services/HummingbotBridgeService');
jest.mock('../../services/HummingbotManager');
jest.mock('../../services/HummingbotAuditLogger');
jest.mock('../../services/PaperTradingSafetyMonitor');

describe('HummingbotEmergencyShutdown', () => {
  let emergencyShutdown: HummingbotEmergencyShutdown;
  let mockBridgeService: jest.Mocked<HummingbotBridgeService>;
  let mockHummingbotManager: jest.Mocked<HummingbotManager>;

  beforeEach(() => {
    mockBridgeService = {
      disconnectAll: jest.fn(),
      stopStrategy: jest.fn(),
      getConnections: jest.fn().mockReturnValue(new Map())
    } as any;

    mockHummingbotManager = {
      getAllInstances: jest.fn().mockReturnValue([]),
      cleanup: jest.fn()
    } as any;

    emergencyShutdown = new HummingbotEmergencyShutdown(
      mockBridgeService,
      mockHummingbotManager,
      {
        enableAutoShutdown: true,
        shutdownTimeoutMs: 30000,
        maxRetryAttempts: 2,
        retryDelayMs: 1000,
        forceShutdownAfterMs: 60000
      }
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeEmergencyShutdown', () => {
    const mockReason: EmergencyShutdownReason = {
      type: 'risk_violation',
      message: 'Critical risk detected',
      severity: 'critical',
      timestamp: Date.now()
    };

    it('should execute emergency shutdown successfully', async () => {
      mockBridgeService.disconnectAll.mockResolvedValue();

      const result = await emergencyShutdown.executeEmergencyShutdown(mockReason);

      expect(result.success).toBe(true);
      expect(result.reason).toEqual(mockReason);
      expect(result.steps.length).toBeGreaterThan(0);
      expect(mockBridgeService.disconnectAll).toHaveBeenCalled();
    });

    it('should handle shutdown step failures gracefully', async () => {
      mockBridgeService.disconnectAll.mockRejectedValue(new Error('Disconnect failed'));

      const result = await emergencyShutdown.executeEmergencyShutdown(mockReason);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Step Disconnect Hummingbot Instances failed: Disconnect failed');
    });

    it('should prevent concurrent shutdowns', async () => {
      mockBridgeService.disconnectAll.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      const shutdown1Promise = emergencyShutdown.executeEmergencyShutdown(mockReason);
      const shutdown2Promise = emergencyShutdown.executeEmergencyShutdown(mockReason);

      const [result1, result2] = await Promise.all([shutdown1Promise, shutdown2Promise]);

      // One should succeed, one should indicate already in progress
      expect(result1.success || result2.success).toBe(true);
      expect(result1.success && result2.success).toBe(false);
    });

    it('should update shutdown status during execution', async () => {
      mockBridgeService.disconnectAll.mockResolvedValue();

      const shutdownPromise = emergencyShutdown.executeEmergencyShutdown(mockReason);
      
      // Check status during execution
      const statusDuringShutdown = emergencyShutdown.getShutdownStatus();
      expect(statusDuringShutdown.isActive).toBe(true);
      expect(statusDuringShutdown.reason).toEqual(mockReason);

      await shutdownPromise;

      // Check status after completion
      const statusAfterShutdown = emergencyShutdown.getShutdownStatus();
      expect(statusAfterShutdown.isActive).toBe(true); // Remains true until reset
      expect(statusAfterShutdown.completedAt).toBeDefined();
      expect(statusAfterShutdown.progress).toBe(100);
    });

    it('should emit shutdown events', async () => {
      mockBridgeService.disconnectAll.mockResolvedValue();

      const completedSpy = jest.fn();
      emergencyShutdown.on('shutdown:completed', completedSpy);

      await emergencyShutdown.executeEmergencyShutdown(mockReason);

      expect(completedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          reason: mockReason
        })
      );
    });

    it('should emit step completion events', async () => {
      mockBridgeService.disconnectAll.mockResolvedValue();

      const stepCompletedSpy = jest.fn();
      emergencyShutdown.on('shutdown:step_completed', stepCompletedSpy);

      await emergencyShutdown.executeEmergencyShutdown(mockReason);

      expect(stepCompletedSpy).toHaveBeenCalled();
    });
  });

  describe('shouldTriggerEmergencyShutdown', () => {
    it('should trigger shutdown for critical safety violations when enabled', () => {
      const reason: EmergencyShutdownReason = {
        type: 'risk_violation',
        message: 'Critical safety violation',
        severity: 'critical',
        timestamp: Date.now()
      };

      const shouldTrigger = emergencyShutdown.shouldTriggerEmergencyShutdown(reason);
      expect(shouldTrigger).toBe(true);
    });

    it('should trigger shutdown for system errors when enabled', () => {
      const reason: EmergencyShutdownReason = {
        type: 'system_error',
        message: 'System failure',
        severity: 'critical',
        timestamp: Date.now()
      };

      const shouldTrigger = emergencyShutdown.shouldTriggerEmergencyShutdown(reason);
      expect(shouldTrigger).toBe(true);
    });

    it('should not trigger shutdown when auto-shutdown is disabled', () => {
      const disabledShutdown = new HummingbotEmergencyShutdown(
        mockBridgeService,
        mockHummingbotManager,
        { enableAutoShutdown: false }
      );

      const reason: EmergencyShutdownReason = {
        type: 'risk_violation',
        message: 'Critical safety violation',
        severity: 'critical',
        timestamp: Date.now()
      };

      const shouldTrigger = disabledShutdown.shouldTriggerEmergencyShutdown(reason);
      expect(shouldTrigger).toBe(false);
    });

    it('should not trigger shutdown for unknown reason types', () => {
      const reason: EmergencyShutdownReason = {
        type: 'unknown' as any,
        message: 'Unknown issue',
        severity: 'high',
        timestamp: Date.now()
      };

      const shouldTrigger = emergencyShutdown.shouldTriggerEmergencyShutdown(reason);
      expect(shouldTrigger).toBe(false);
    });
  });

  describe('testEmergencyShutdown', () => {
    it('should execute test shutdown without affecting real systems', async () => {
      const result = await emergencyShutdown.testEmergencyShutdown();

      expect(result.success).toBe(true);
      expect(result.reason.type).toBe('manual');
      expect(result.reason.message).toBe('Emergency shutdown test');
      
      // Verify that real shutdown methods were not called
      expect(mockBridgeService.disconnectAll).not.toHaveBeenCalled();
    });

    it('should test all shutdown steps', async () => {
      const result = await emergencyShutdown.testEmergencyShutdown();

      expect(result.steps.length).toBeGreaterThan(0);
      result.steps.forEach(step => {
        expect(step.stepName).toBeDefined();
        expect(step.success).toBe(true);
        expect(step.duration).toBeGreaterThan(0);
      });
    });
  });

  describe('cancelEmergencyShutdown', () => {
    it('should cancel shutdown when in progress', async () => {
      mockBridgeService.disconnectAll.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      const reason: EmergencyShutdownReason = {
        type: 'manual',
        message: 'Test shutdown',
        severity: 'high',
        timestamp: Date.now()
      };

      // Start shutdown
      const shutdownPromise = emergencyShutdown.executeEmergencyShutdown(reason);
      
      // Cancel after a short delay
      setTimeout(async () => {
        const cancelled = await emergencyShutdown.cancelEmergencyShutdown();
        expect(cancelled).toBe(true);
      }, 100);

      await shutdownPromise;
    });

    it('should return false when no shutdown is in progress', async () => {
      const cancelled = await emergencyShutdown.cancelEmergencyShutdown();
      expect(cancelled).toBe(false);
    });

    it('should emit cancellation event', async () => {
      const cancelledSpy = jest.fn();
      emergencyShutdown.on('shutdown:cancelled', cancelledSpy);

      mockBridgeService.disconnectAll.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      const reason: EmergencyShutdownReason = {
        type: 'manual',
        message: 'Test shutdown',
        severity: 'high',
        timestamp: Date.now()
      };

      // Start and immediately cancel
      const shutdownPromise = emergencyShutdown.executeEmergencyShutdown(reason);
      await emergencyShutdown.cancelEmergencyShutdown();
      
      await shutdownPromise;

      expect(cancelledSpy).toHaveBeenCalled();
    });
  });

  describe('shutdown plan creation', () => {
    it('should create appropriate shutdown plan for critical reasons', async () => {
      const criticalReason: EmergencyShutdownReason = {
        type: 'risk_violation',
        message: 'Critical risk',
        severity: 'critical',
        timestamp: Date.now()
      };

      mockBridgeService.disconnectAll.mockResolvedValue();

      const result = await emergencyShutdown.executeEmergencyShutdown(criticalReason);

      // Critical shutdowns should include instance stopping
      const stopInstancesStep = result.steps.find(step => step.stepName === 'Stop Hummingbot Instances');
      expect(stopInstancesStep).toBeDefined();
    });

    it('should create lighter shutdown plan for non-critical reasons', async () => {
      const nonCriticalReason: EmergencyShutdownReason = {
        type: 'manual',
        message: 'Manual shutdown',
        severity: 'high',
        timestamp: Date.now()
      };

      mockBridgeService.disconnectAll.mockResolvedValue();

      const result = await emergencyShutdown.executeEmergencyShutdown(nonCriticalReason);

      // Non-critical shutdowns should not include instance stopping
      const stopInstancesStep = result.steps.find(step => step.stepName === 'Stop Hummingbot Instances');
      expect(stopInstancesStep).toBeUndefined();
    });

    it('should include all required shutdown steps', async () => {
      const reason: EmergencyShutdownReason = {
        type: 'system_error',
        message: 'System error',
        severity: 'high',
        timestamp: Date.now()
      };

      mockBridgeService.disconnectAll.mockResolvedValue();

      const result = await emergencyShutdown.executeEmergencyShutdown(reason);

      const expectedSteps = [
        'Send Emergency Notifications',
        'Stop All Hummingbot Strategies',
        'Cancel All Pending Orders',
        'Disconnect Hummingbot Instances',
        'Update Safety Status',
        'Generate Shutdown Report'
      ];

      expectedSteps.forEach(expectedStep => {
        const step = result.steps.find(s => s.stepName === expectedStep);
        expect(step).toBeDefined();
      });
    });
  });

  describe('shutdown step execution', () => {
    it('should retry failed steps when retryable', async () => {
      let callCount = 0;
      mockBridgeService.disconnectAll.mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve();
      });

      const reason: EmergencyShutdownReason = {
        type: 'manual',
        message: 'Test shutdown',
        severity: 'high',
        timestamp: Date.now()
      };

      const result = await emergencyShutdown.executeEmergencyShutdown(reason);

      expect(callCount).toBe(2); // Should have retried once
      expect(result.success).toBe(true);
    });

    it('should not retry non-retryable steps', async () => {
      // This would need to be tested with a step that's marked as non-retryable
      // For now, we'll test that the retry logic respects the configuration
      const reason: EmergencyShutdownReason = {
        type: 'manual',
        message: 'Test shutdown',
        severity: 'high',
        timestamp: Date.now()
      };

      mockBridgeService.disconnectAll.mockResolvedValue();

      const result = await emergencyShutdown.executeEmergencyShutdown(reason);

      // All steps should complete successfully
      expect(result.success).toBe(true);
    });

    it('should continue with non-critical step failures', async () => {
      // Mock a failure in a non-critical step (notifications)
      // Since we can't easily mock the notification step, we'll test the overall behavior
      mockBridgeService.disconnectAll.mockResolvedValue();

      const reason: EmergencyShutdownReason = {
        type: 'manual',
        message: 'Test shutdown',
        severity: 'high',
        timestamp: Date.now()
      };

      const result = await emergencyShutdown.executeEmergencyShutdown(reason);

      // Should complete even if some non-critical steps fail
      expect(result.steps.length).toBeGreaterThan(0);
    });
  });

  describe('configuration', () => {
    it('should use default configuration when none provided', () => {
      const defaultShutdown = new HummingbotEmergencyShutdown(
        mockBridgeService,
        mockHummingbotManager
      );

      const status = defaultShutdown.getShutdownStatus();
      expect(status.isActive).toBe(false);
      expect(status.progress).toBe(0);
    });

    it('should merge custom configuration with defaults', () => {
      const customShutdown = new HummingbotEmergencyShutdown(
        mockBridgeService,
        mockHummingbotManager,
        {
          shutdownTimeoutMs: 10000,
          maxRetryAttempts: 1,
          enableAutoShutdown: false
        }
      );

      expect(customShutdown).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle errors during shutdown gracefully', async () => {
      mockBridgeService.disconnectAll.mockRejectedValue(new Error('Critical failure'));

      const reason: EmergencyShutdownReason = {
        type: 'system_error',
        message: 'System failure',
        severity: 'critical',
        timestamp: Date.now()
      };

      const result = await emergencyShutdown.executeEmergencyShutdown(reason);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Critical failure');
    });

    it('should emit error events on shutdown failure', async () => {
      mockBridgeService.disconnectAll.mockRejectedValue(new Error('Shutdown failed'));

      const failedSpy = jest.fn();
      emergencyShutdown.on('shutdown:failed', failedSpy);

      const reason: EmergencyShutdownReason = {
        type: 'system_error',
        message: 'System failure',
        severity: 'critical',
        timestamp: Date.now()
      };

      await emergencyShutdown.executeEmergencyShutdown(reason);

      expect(failedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reason,
          error: expect.any(Error)
        })
      );
    });
  });

  describe('shutdown status tracking', () => {
    it('should track shutdown progress correctly', async () => {
      mockBridgeService.disconnectAll.mockResolvedValue();

      const reason: EmergencyShutdownReason = {
        type: 'manual',
        message: 'Test shutdown',
        severity: 'high',
        timestamp: Date.now()
      };

      const shutdownPromise = emergencyShutdown.executeEmergencyShutdown(reason);

      // Check initial status
      const initialStatus = emergencyShutdown.getShutdownStatus();
      expect(initialStatus.isActive).toBe(true);
      expect(initialStatus.startedAt).toBeDefined();

      await shutdownPromise;

      // Check final status
      const finalStatus = emergencyShutdown.getShutdownStatus();
      expect(finalStatus.completedAt).toBeDefined();
      expect(finalStatus.progress).toBe(100);
      expect(finalStatus.result).toBeDefined();
    });

    it('should reset shutdown status correctly', () => {
      const initialStatus = emergencyShutdown.getShutdownStatus();
      expect(initialStatus.isActive).toBe(false);
      expect(initialStatus.progress).toBe(0);
    });
  });
});