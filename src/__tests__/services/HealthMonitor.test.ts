import { HealthMonitor } from '../../services/HealthMonitor';
import { DockerOrchestrator } from '../../services/DockerOrchestrator';
import { HummingbotGatewayClient } from '../../services/HummingbotGatewayClient';
import { HBInstance, HealthCheckConfig } from '../../types/hummingbot';

// Mock DockerOrchestrator
const mockDockerOrchestrator = {
  getContainerStats: jest.fn().mockResolvedValue({
    cpuUsage: 45.5,
    memoryUsage: 512000000,
    memoryLimit: 1024000000,
    networkIO: { rx: 1000, tx: 2000 },
    diskIO: { read: 500, write: 1000 }
  }),
  restartContainer: jest.fn().mockResolvedValue(undefined)
} as jest.Mocked<DockerOrchestrator>;

// Mock HummingbotGatewayClient
const mockGatewayClient = {
  healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' }),
  getMetrics: jest.fn().mockResolvedValue({
    activeConnections: 5,
    queueDepth: 2,
    errorCount: 1,
    requestCount: 100
  }),
  restart: jest.fn().mockResolvedValue(undefined)
} as jest.Mocked<HummingbotGatewayClient>;

describe('HealthMonitor', () => {
  let healthMonitor: HealthMonitor;
  let mockInstance: HBInstance;
  let config: HealthCheckConfig;

  beforeEach(() => {
    config = {
      interval: 1000, // 1 second for testing
      timeout: 5000,
      retries: 2,
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
      }
    };

    healthMonitor = new HealthMonitor(mockDockerOrchestrator, config);

    mockInstance = {
      id: 'test-instance-1',
      name: 'hummingbot-test',
      status: 'running',
      containerId: 'container-123',
      config: {
        name: 'hummingbot-test',
        gatewayPort: 8080,
        apiKey: 'test-key'
      },
      strategies: [],
      resources: {
        cpuUsage: 45,
        memoryUsage: 50,
        networkIO: 1000,
        diskIO: 500
      },
      performance: {
        uptime: 3600000,
        totalStrategies: 1,
        activeStrategies: 1,
        totalTrades: 50,
        avgLatency: 100,
        errorRate: 1
      },
      createdAt: new Date(Date.now() - 3600000),
      lastHealthCheck: new Date()
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    healthMonitor.stopMonitoring();
    healthMonitor.cleanup();
  });

  describe('Health Check Operations', () => {
    beforeEach(() => {
      healthMonitor.registerInstance(mockInstance, mockGatewayClient);
    });

    test('should perform health check on registered instance', async () => {
      const result = await healthMonitor.checkInstanceHealth(mockInstance.id);

      expect(result).toBeDefined();
      expect(result.instanceId).toBe(mockInstance.id);
      expect(result.status).toBe('healthy');
      expect(result.metrics).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(result.recommendations).toBeDefined();

      expect(mockDockerOrchestrator.getContainerStats).toHaveBeenCalledWith(mockInstance.id);
      expect(mockGatewayClient.healthCheck).toHaveBeenCalled();
      expect(mockGatewayClient.getMetrics).toHaveBeenCalled();
    });

    test('should detect high CPU usage', async () => {
      mockDockerOrchestrator.getContainerStats.mockResolvedValueOnce({
        cpuUsage: 95, // Above threshold
        memoryUsage: 512000000,
        memoryLimit: 1024000000,
        networkIO: { rx: 1000, tx: 2000 },
        diskIO: { read: 500, write: 1000 }
      });

      const result = await healthMonitor.checkInstanceHealth(mockInstance.id);

      expect(result.status).toBe('critical');
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('resource');
      expect(result.issues[0].severity).toBe('critical');
      expect(result.issues[0].description).toContain('High CPU usage');
    });

    test('should detect high memory usage', async () => {
      mockDockerOrchestrator.getContainerStats.mockResolvedValueOnce({
        cpuUsage: 45,
        memoryUsage: 950000000, // 95% of limit
        memoryLimit: 1000000000,
        networkIO: { rx: 1000, tx: 2000 },
        diskIO: { read: 500, write: 1000 }
      });

      const result = await healthMonitor.checkInstanceHealth(mockInstance.id);

      expect(result.status).toBe('critical');
      expect(result.issues.some(issue => 
        issue.type === 'resource' && issue.description.includes('High memory usage')
      )).toBe(true);
    });

    test('should detect high error rate', async () => {
      mockGatewayClient.getMetrics.mockResolvedValueOnce({
        activeConnections: 5,
        queueDepth: 2,
        errorCount: 10, // High error count
        requestCount: 100
      });

      const result = await healthMonitor.checkInstanceHealth(mockInstance.id);

      expect(result.status).toBe('degraded');
      expect(result.issues.some(issue => 
        issue.type === 'performance' && issue.description.includes('High error rate')
      )).toBe(true);
    });

    test('should detect high queue depth', async () => {
      mockGatewayClient.getMetrics.mockResolvedValueOnce({
        activeConnections: 5,
        queueDepth: 150, // Above threshold
        errorCount: 1,
        requestCount: 100
      });

      const result = await healthMonitor.checkInstanceHealth(mockInstance.id);

      expect(result.status).toBe('degraded');
      expect(result.issues.some(issue => 
        issue.type === 'performance' && issue.description.includes('High queue depth')
      )).toBe(true);
    });

    test('should handle health check failures', async () => {
      mockGatewayClient.healthCheck.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await healthMonitor.checkInstanceHealth(mockInstance.id);

      expect(result.status).toBe('critical');
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('connectivity');
      expect(result.issues[0].severity).toBe('critical');
      expect(result.issues[0].description).toContain('Health check failed');
    });

    test('should handle non-existent instance', async () => {
      await expect(healthMonitor.checkInstanceHealth('non-existent-id'))
        .rejects.toThrow('Gateway client not found');
    });
  });

  describe('Monitoring Lifecycle', () => {
    test('should start and stop monitoring', () => {
      expect(() => healthMonitor.startMonitoring()).not.toThrow();
      expect(() => healthMonitor.stopMonitoring()).not.toThrow();
    });

    test('should emit monitoring events', () => {
      const startSpy = jest.fn();
      const stopSpy = jest.fn();

      healthMonitor.on('monitoringStarted', startSpy);
      healthMonitor.on('monitoringStopped', stopSpy);

      healthMonitor.startMonitoring();
      healthMonitor.stopMonitoring();

      expect(startSpy).toHaveBeenCalledWith(config);
      expect(stopSpy).toHaveBeenCalled();
    });

    test('should restart monitoring when already running', () => {
      healthMonitor.startMonitoring();
      
      // Starting again should restart
      expect(() => healthMonitor.startMonitoring()).not.toThrow();
      
      healthMonitor.stopMonitoring();
    });
  });

  describe('Instance Registration', () => {
    test('should register instance for monitoring', () => {
      const eventSpy = jest.fn();
      healthMonitor.on('instanceRegistered', eventSpy);

      healthMonitor.registerInstance(mockInstance, mockGatewayClient);

      expect(eventSpy).toHaveBeenCalledWith(mockInstance.id);
    });

    test('should unregister instance from monitoring', () => {
      const eventSpy = jest.fn();
      healthMonitor.on('instanceUnregistered', eventSpy);

      healthMonitor.registerInstance(mockInstance, mockGatewayClient);
      healthMonitor.unregisterInstance(mockInstance.id);

      expect(eventSpy).toHaveBeenCalledWith(mockInstance.id);
    });

    test('should handle multiple instance registrations', () => {
      const instance2: HBInstance = {
        ...mockInstance,
        id: 'test-instance-2',
        name: 'hummingbot-test-2'
      };

      const client2 = { ...mockGatewayClient };

      healthMonitor.registerInstance(mockInstance, mockGatewayClient);
      healthMonitor.registerInstance(instance2, client2);

      expect(() => healthMonitor.registerInstance(mockInstance, mockGatewayClient)).not.toThrow();
      expect(() => healthMonitor.registerInstance(instance2, client2)).not.toThrow();
    });
  });

  describe('Health Status Aggregation', () => {
    beforeEach(() => {
      healthMonitor.registerInstance(mockInstance, mockGatewayClient);
    });

    test('should get health status for all instances', async () => {
      const statuses = await healthMonitor.getAllHealthStatuses();

      expect(statuses).toHaveLength(1);
      expect(statuses[0].instanceId).toBe(mockInstance.id);
      expect(statuses[0].status).toBe('running');
      expect(statuses[0].healthScore).toBeGreaterThan(0);
    });

    test('should handle multiple instances', async () => {
      const instance2: HBInstance = {
        ...mockInstance,
        id: 'test-instance-2',
        name: 'hummingbot-test-2'
      };

      const client2 = { ...mockGatewayClient };
      healthMonitor.registerInstance(instance2, client2);

      const statuses = await healthMonitor.getAllHealthStatuses();

      expect(statuses).toHaveLength(2);
      expect(statuses.map(s => s.instanceId)).toContain(mockInstance.id);
      expect(statuses.map(s => s.instanceId)).toContain(instance2.id);
    });

    test('should handle health check failures in aggregation', async () => {
      mockGatewayClient.healthCheck.mockRejectedValueOnce(new Error('Failed'));

      const statuses = await healthMonitor.getAllHealthStatuses();

      expect(statuses).toHaveLength(1);
      expect(statuses[0].status).toBe('error');
      expect(statuses[0].healthScore).toBe(0);
    });
  });

  describe('Health History', () => {
    beforeEach(() => {
      healthMonitor.registerInstance(mockInstance, mockGatewayClient);
    });

    test('should maintain health history', async () => {
      await healthMonitor.checkInstanceHealth(mockInstance.id);
      await healthMonitor.checkInstanceHealth(mockInstance.id);

      const history = healthMonitor.getHealthHistory(mockInstance.id);

      expect(history).toHaveLength(2);
      expect(history[0].instanceId).toBe(mockInstance.id);
      expect(history[1].instanceId).toBe(mockInstance.id);
    });

    test('should limit health history size', async () => {
      // Perform many health checks
      for (let i = 0; i < 1005; i++) {
        await healthMonitor.checkInstanceHealth(mockInstance.id);
      }

      const history = healthMonitor.getHealthHistory(mockInstance.id);

      expect(history.length).toBeLessThanOrEqual(1000);
    });

    test('should get limited health history', async () => {
      // Perform several health checks
      for (let i = 0; i < 10; i++) {
        await healthMonitor.checkInstanceHealth(mockInstance.id);
      }

      const history = healthMonitor.getHealthHistory(mockInstance.id, 5);

      expect(history).toHaveLength(5);
    });

    test('should get health trends', async () => {
      // Perform health checks with varying metrics
      for (let i = 0; i < 5; i++) {
        mockDockerOrchestrator.getContainerStats.mockResolvedValueOnce({
          cpuUsage: 40 + i * 10,
          memoryUsage: 500000000 + i * 50000000,
          memoryLimit: 1024000000,
          networkIO: { rx: 1000, tx: 2000 },
          diskIO: { read: 500, write: 1000 }
        });

        await healthMonitor.checkInstanceHealth(mockInstance.id);
      }

      const trends = healthMonitor.getHealthTrends(mockInstance.id);

      expect(trends.cpuTrend).toHaveLength(5);
      expect(trends.memoryTrend).toHaveLength(5);
      expect(trends.responseTimeTrend).toHaveLength(5);
      expect(trends.errorRateTrend).toHaveLength(5);
      expect(trends.healthScoreTrend).toHaveLength(5);

      // Verify trends show increasing values
      expect(trends.cpuTrend[4]).toBeGreaterThan(trends.cpuTrend[0]);
    });
  });

  describe('Recovery Actions', () => {
    beforeEach(() => {
      healthMonitor.registerInstance(mockInstance, mockGatewayClient);
    });

    test('should trigger recovery for critical issues', async () => {
      const eventSpy = jest.fn();
      healthMonitor.on('recoveryActionTriggered', eventSpy);

      // Mock critical CPU usage
      mockDockerOrchestrator.getContainerStats.mockResolvedValueOnce({
        cpuUsage: 98,
        memoryUsage: 512000000,
        memoryLimit: 1024000000,
        networkIO: { rx: 1000, tx: 2000 },
        diskIO: { read: 500, write: 1000 }
      });

      await healthMonitor.checkInstanceHealth(mockInstance.id);

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        instanceId: mockInstance.id,
        action: 'restart_container',
        attempt: 1
      }));

      expect(mockDockerOrchestrator.restartContainer).toHaveBeenCalledWith(mockInstance.id);
    });

    test('should trigger gateway restart for connectivity issues', async () => {
      const eventSpy = jest.fn();
      healthMonitor.on('recoveryActionTriggered', eventSpy);

      mockGatewayClient.healthCheck.mockResolvedValueOnce({ 
        status: 'unhealthy', 
        message: 'Gateway down' 
      });

      await healthMonitor.checkInstanceHealth(mockInstance.id);

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        instanceId: mockInstance.id,
        action: 'restart_gateway'
      }));

      expect(mockGatewayClient.restart).toHaveBeenCalled();
    });

    test('should respect max recovery attempts', async () => {
      const eventSpy = jest.fn();
      const maxAttemptsSpy = jest.fn();
      healthMonitor.on('recoveryActionTriggered', eventSpy);
      healthMonitor.on('maxRecoveryAttemptsReached', maxAttemptsSpy);

      // Mock persistent critical issue
      mockDockerOrchestrator.getContainerStats.mockResolvedValue({
        cpuUsage: 98,
        memoryUsage: 512000000,
        memoryLimit: 1024000000,
        networkIO: { rx: 1000, tx: 2000 },
        diskIO: { read: 500, write: 1000 }
      });

      // Trigger multiple health checks to exceed max attempts
      for (let i = 0; i < 5; i++) {
        await healthMonitor.checkInstanceHealth(mockInstance.id);
      }

      expect(maxAttemptsSpy).toHaveBeenCalledWith(mockInstance.id);
      expect(eventSpy).toHaveBeenCalledTimes(3); // Max attempts
    });

    test('should handle recovery action failures', async () => {
      const eventSpy = jest.fn();
      healthMonitor.on('recoveryActionFailed', eventSpy);

      mockDockerOrchestrator.restartContainer.mockRejectedValueOnce(new Error('Restart failed'));

      // Mock critical issue
      mockDockerOrchestrator.getContainerStats.mockResolvedValueOnce({
        cpuUsage: 98,
        memoryUsage: 512000000,
        memoryLimit: 1024000000,
        networkIO: { rx: 1000, tx: 2000 },
        diskIO: { read: 500, write: 1000 }
      });

      await healthMonitor.checkInstanceHealth(mockInstance.id);

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        instanceId: mockInstance.id,
        action: 'restart_container',
        error: 'Restart failed'
      }));
    });

    test('should disable recovery actions when configured', async () => {
      const disabledConfig = {
        ...config,
        recoveryActions: {
          ...config.recoveryActions,
          enabled: false
        }
      };

      const disabledMonitor = new HealthMonitor(mockDockerOrchestrator, disabledConfig);
      disabledMonitor.registerInstance(mockInstance, mockGatewayClient);

      const eventSpy = jest.fn();
      disabledMonitor.on('recoveryActionTriggered', eventSpy);

      // Mock critical issue
      mockDockerOrchestrator.getContainerStats.mockResolvedValueOnce({
        cpuUsage: 98,
        memoryUsage: 512000000,
        memoryLimit: 1024000000,
        networkIO: { rx: 1000, tx: 2000 },
        diskIO: { read: 500, write: 1000 }
      });

      await disabledMonitor.checkInstanceHealth(mockInstance.id);

      expect(eventSpy).not.toHaveBeenCalled();
      expect(mockDockerOrchestrator.restartContainer).not.toHaveBeenCalled();

      disabledMonitor.cleanup();
    });
  });

  describe('Configuration Management', () => {
    test('should update configuration', () => {
      const newConfig = {
        interval: 60000,
        thresholds: {
          cpu: 90,
          memory: 90,
          disk: 95,
          responseTime: 10000,
          errorRate: 10
        }
      };

      expect(() => healthMonitor.updateConfig(newConfig)).not.toThrow();
    });

    test('should restart monitoring when config updated', () => {
      healthMonitor.startMonitoring();

      const newConfig = { interval: 30000 };
      healthMonitor.updateConfig(newConfig);

      // Should restart monitoring with new interval
      expect(() => healthMonitor.updateConfig(newConfig)).not.toThrow();
    });

    test('should emit config update events', () => {
      const eventSpy = jest.fn();
      healthMonitor.on('configUpdated', eventSpy);

      const newConfig = { interval: 45000 };
      healthMonitor.updateConfig(newConfig);

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining(newConfig));
    });
  });

  describe('Force Health Check', () => {
    beforeEach(() => {
      healthMonitor.registerInstance(mockInstance, mockGatewayClient);
    });

    test('should force health check on all instances', async () => {
      const results = await healthMonitor.forceHealthCheck();

      expect(results).toHaveLength(1);
      expect(results[0].instanceId).toBe(mockInstance.id);
      expect(mockGatewayClient.healthCheck).toHaveBeenCalled();
    });

    test('should handle failures in force health check', async () => {
      mockGatewayClient.healthCheck.mockRejectedValueOnce(new Error('Force check failed'));

      const results = await healthMonitor.forceHealthCheck();

      // Should return empty array if all checks fail
      expect(results).toHaveLength(0);
    });
  });

  describe('Event Handling', () => {
    beforeEach(() => {
      healthMonitor.registerInstance(mockInstance, mockGatewayClient);
    });

    test('should emit health check completed events', async () => {
      const eventSpy = jest.fn();
      healthMonitor.on('healthCheckCompleted', eventSpy);

      await healthMonitor.checkInstanceHealth(mockInstance.id);

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        instanceId: mockInstance.id,
        status: 'healthy'
      }));
    });

    test('should emit health check failed events', async () => {
      const eventSpy = jest.fn();
      healthMonitor.on('healthCheckFailed', eventSpy);

      mockGatewayClient.healthCheck.mockRejectedValueOnce(new Error('Check failed'));

      await healthMonitor.checkInstanceHealth(mockInstance.id);

      expect(eventSpy).toHaveBeenCalledWith({
        instanceId: mockInstance.id,
        error: 'Check failed'
      });
    });

    test('should emit health check cycle events during monitoring', (done) => {
      const eventSpy = jest.fn();
      healthMonitor.on('healthCheckCycleCompleted', eventSpy);

      healthMonitor.startMonitoring();

      // Wait for at least one cycle to complete
      setTimeout(() => {
        healthMonitor.stopMonitoring();
        expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
          totalInstances: 1,
          healthyInstances: expect.any(Number),
          unhealthyInstances: expect.any(Number)
        }));
        done();
      }, 1500); // Wait longer than the monitoring interval
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all resources', () => {
      healthMonitor.registerInstance(mockInstance, mockGatewayClient);
      healthMonitor.startMonitoring();

      expect(() => healthMonitor.cleanup()).not.toThrow();
    });

    test('should stop monitoring on cleanup', () => {
      healthMonitor.startMonitoring();
      
      const stopSpy = jest.spyOn(healthMonitor, 'stopMonitoring');
      healthMonitor.cleanup();

      expect(stopSpy).toHaveBeenCalled();
    });
  });
});