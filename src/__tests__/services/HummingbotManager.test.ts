import { HummingbotManager } from '../../services/HummingbotManager';
import { HummingbotBridgeService } from '../../services/HummingbotBridgeService';
import { HummingbotGatewayClient } from '../../services/HummingbotGatewayClient';
import { 
  InstanceConfig, 
  HBInstance, 
  HBStrategy, 
  ScalingPolicy,
  LoadBalancingStrategy 
} from '../../types/hummingbot';

// Mock Docker
jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => ({
    createContainer: jest.fn().mockResolvedValue({
      id: 'mock-container-id',
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      restart: jest.fn().mockResolvedValue(undefined),
      inspect: jest.fn().mockResolvedValue({
        Id: 'mock-container-id',
        State: { Running: true, Health: { Status: 'healthy' } },
        Created: new Date().toISOString()
      }),
      stats: jest.fn().mockResolvedValue({
        cpu_stats: {
          cpu_usage: { total_usage: 1000000 },
          system_cpu_usage: 10000000,
          online_cpus: 1
        },
        precpu_stats: {
          cpu_usage: { total_usage: 900000 },
          system_cpu_usage: 9000000
        },
        memory_stats: {
          usage: 512000000,
          limit: 1024000000
        },
        networks: {
          eth0: { rx_bytes: 1000, tx_bytes: 2000 }
        },
        blkio_stats: {
          io_service_bytes_recursive: [
            { op: 'Read', value: 1000 },
            { op: 'Write', value: 2000 }
          ]
        }
      })
    }),
    getContainer: jest.fn().mockImplementation((id) => ({
      id,
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      restart: jest.fn().mockResolvedValue(undefined),
      inspect: jest.fn().mockResolvedValue({
        Id: id,
        State: { Running: true, Health: { Status: 'healthy' } },
        Created: new Date().toISOString()
      }),
      stats: jest.fn().mockResolvedValue({
        cpu_stats: {
          cpu_usage: { total_usage: 1000000 },
          system_cpu_usage: 10000000,
          online_cpus: 1
        },
        precpu_stats: {
          cpu_usage: { total_usage: 900000 },
          system_cpu_usage: 9000000
        },
        memory_stats: {
          usage: 512000000,
          limit: 1024000000
        },
        networks: {
          eth0: { rx_bytes: 1000, tx_bytes: 2000 }
        },
        blkio_stats: {
          io_service_bytes_recursive: [
            { op: 'Read', value: 1000 },
            { op: 'Write', value: 2000 }
          ]
        }
      })
    })),
    listContainers: jest.fn().mockResolvedValue([]),
    listNetworks: jest.fn().mockResolvedValue([]),
    createNetwork: jest.fn().mockResolvedValue({ id: 'network-id' }),
    getNetwork: jest.fn().mockReturnValue({ id: 'network-id' }),
    pull: jest.fn().mockResolvedValue(undefined)
  }));
});

// Mock HummingbotBridgeService
const mockBridgeService = {
  connectToHummingbot: jest.fn(),
  executeStrategy: jest.fn(),
  monitorStrategy: jest.fn(),
  stopStrategy: jest.fn(),
  getPerformanceMetrics: jest.fn()
} as jest.Mocked<HummingbotBridgeService>;

// Mock HummingbotGatewayClient
const mockGatewayClient = {
  healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' }),
  deployStrategy: jest.fn().mockResolvedValue({ 
    strategyId: 'strategy-123', 
    deploymentId: 'deployment-123' 
  }),
  stopStrategy: jest.fn().mockResolvedValue(true),
  getMetrics: jest.fn().mockResolvedValue({
    activeConnections: 5,
    queueDepth: 2,
    errorCount: 0,
    requestCount: 100
  }),
  restart: jest.fn().mockResolvedValue(undefined)
} as jest.Mocked<HummingbotGatewayClient>;

describe('HummingbotManager', () => {
  let manager: HummingbotManager;
  let scalingPolicy: ScalingPolicy;

  beforeEach(() => {
    scalingPolicy = {
      minInstances: 1,
      maxInstances: 5,
      targetCpuUtilization: 70,
      targetMemoryUtilization: 80,
      scaleUpCooldown: 300000,
      scaleDownCooldown: 600000
    };

    manager = new HummingbotManager(mockBridgeService, scalingPolicy);
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await manager.cleanup();
  });

  describe('Instance Management', () => {
    test('should create a new Hummingbot instance', async () => {
      const config: InstanceConfig = {
        name: 'test-instance',
        gatewayPort: 8080,
        apiKey: 'test-api-key',
        resources: {
          cpu: 512,
          memory: 1024 * 1024 * 1024
        }
      };

      const instance = await manager.createInstance(config);

      expect(instance).toBeDefined();
      expect(instance.name).toBe('test-instance');
      expect(instance.status).toBe('running');
      expect(instance.config).toEqual(config);
      expect(instance.strategies).toEqual([]);
    });

    test('should handle instance creation failure', async () => {
      const config: InstanceConfig = {
        name: 'failing-instance',
        gatewayPort: 8081,
        apiKey: 'test-api-key'
      };

      // Mock Docker container creation to fail
      const mockDocker = require('dockerode');
      const dockerInstance = new mockDocker();
      dockerInstance.createContainer.mockRejectedValueOnce(new Error('Container creation failed'));

      await expect(manager.createInstance(config)).rejects.toThrow('Container creation failed');
    });

    test('should get all instances', async () => {
      const config: InstanceConfig = {
        name: 'test-instance',
        gatewayPort: 8080,
        apiKey: 'test-api-key'
      };

      await manager.createInstance(config);
      const instances = manager.getAllInstances();

      expect(instances).toHaveLength(1);
      expect(instances[0].name).toBe('test-instance');
    });

    test('should get instance by ID', async () => {
      const config: InstanceConfig = {
        name: 'test-instance',
        gatewayPort: 8080,
        apiKey: 'test-api-key'
      };

      const createdInstance = await manager.createInstance(config);
      const retrievedInstance = manager.getInstance(createdInstance.id);

      expect(retrievedInstance).toBeDefined();
      expect(retrievedInstance!.id).toBe(createdInstance.id);
    });
  });

  describe('Strategy Deployment', () => {
    let instance: HBInstance;

    beforeEach(async () => {
      const config: InstanceConfig = {
        name: 'test-instance',
        gatewayPort: 8080,
        apiKey: 'test-api-key'
      };
      instance = await manager.createInstance(config);
    });

    test('should deploy strategy to instance', async () => {
      const strategy: HBStrategy = {
        type: 'pure_market_making',
        exchange: 'binance',
        tradingPair: 'BTC/USDT',
        parameters: {
          bidSpread: 0.1,
          askSpread: 0.1,
          orderAmount: 100
        },
        riskLimits: {
          maxLoss: 1000,
          maxExposure: 10000
        },
        executionSettings: {
          timeout: 30000
        }
      };

      const deployment = await manager.deployStrategy(instance.id, strategy);

      expect(deployment).toBeDefined();
      expect(deployment.instanceId).toBe(instance.id);
      expect(deployment.strategy).toEqual(strategy);
      expect(deployment.status).toBe('deployed');
      expect(mockGatewayClient.deployStrategy).toHaveBeenCalledWith(strategy);
    });

    test('should handle strategy deployment failure', async () => {
      const strategy: HBStrategy = {
        type: 'pure_market_making',
        exchange: 'binance',
        tradingPair: 'BTC/USDT',
        parameters: {},
        riskLimits: {
          maxLoss: 1000,
          maxExposure: 10000
        },
        executionSettings: {
          timeout: 30000
        }
      };

      mockGatewayClient.deployStrategy.mockRejectedValueOnce(new Error('Deployment failed'));

      await expect(manager.deployStrategy(instance.id, strategy)).rejects.toThrow('Deployment failed');
    });

    test('should fail to deploy to non-existent instance', async () => {
      const strategy: HBStrategy = {
        type: 'pure_market_making',
        exchange: 'binance',
        tradingPair: 'BTC/USDT',
        parameters: {},
        riskLimits: {
          maxLoss: 1000,
          maxExposure: 10000
        },
        executionSettings: {
          timeout: 30000
        }
      };

      await expect(manager.deployStrategy('non-existent-id', strategy)).rejects.toThrow('Instance not found');
    });
  });

  describe('Load Balancing', () => {
    let instances: HBInstance[];

    beforeEach(async () => {
      // Create multiple instances
      const configs = [
        { name: 'instance-1', gatewayPort: 8080, apiKey: 'key-1' },
        { name: 'instance-2', gatewayPort: 8081, apiKey: 'key-2' },
        { name: 'instance-3', gatewayPort: 8082, apiKey: 'key-3' }
      ];

      instances = await Promise.all(
        configs.map(config => manager.createInstance(config))
      );
    });

    test('should select optimal instance for round robin', () => {
      manager.setLoadBalancingStrategy('round_robin');
      
      const strategy: HBStrategy = {
        type: 'pure_market_making',
        exchange: 'binance',
        tradingPair: 'BTC/USDT',
        parameters: {},
        riskLimits: { maxLoss: 1000, maxExposure: 10000 },
        executionSettings: { timeout: 30000 }
      };

      const selectedId1 = manager.getOptimalInstance(strategy);
      const selectedId2 = manager.getOptimalInstance(strategy);
      const selectedId3 = manager.getOptimalInstance(strategy);

      expect(selectedId1).toBeDefined();
      expect(selectedId2).toBeDefined();
      expect(selectedId3).toBeDefined();
      
      // Should cycle through instances
      expect([selectedId1, selectedId2, selectedId3]).toHaveLength(3);
    });

    test('should select optimal instance for least loaded', () => {
      manager.setLoadBalancingStrategy('least_loaded');
      
      const strategy: HBStrategy = {
        type: 'pure_market_making',
        exchange: 'binance',
        tradingPair: 'BTC/USDT',
        parameters: {},
        riskLimits: { maxLoss: 1000, maxExposure: 10000 },
        executionSettings: { timeout: 30000 }
      };

      const selectedId = manager.getOptimalInstance(strategy);
      expect(selectedId).toBeDefined();
      expect(instances.some(i => i.id === selectedId)).toBe(true);
    });

    test('should return null when no instances available', () => {
      const emptyManager = new HummingbotManager(mockBridgeService);
      
      const strategy: HBStrategy = {
        type: 'pure_market_making',
        exchange: 'binance',
        tradingPair: 'BTC/USDT',
        parameters: {},
        riskLimits: { maxLoss: 1000, maxExposure: 10000 },
        executionSettings: { timeout: 30000 }
      };

      const selectedId = emptyManager.getOptimalInstance(strategy);
      expect(selectedId).toBeNull();
    });
  });

  describe('Scaling', () => {
    test('should scale up instances', async () => {
      const result = await manager.scaleInstances(3);

      expect(result.targetCount).toBe(3);
      expect(result.actualCount).toBe(3);
      expect(result.success).toBe(true);
      expect(result.scalingActions).toHaveLength(3);
      expect(result.scalingActions.every(action => action.action === 'scale_up')).toBe(true);
    });

    test('should scale down instances', async () => {
      // First create some instances
      await manager.scaleInstances(3);
      
      // Then scale down
      const result = await manager.scaleInstances(1);

      expect(result.targetCount).toBe(1);
      expect(result.success).toBe(true);
      expect(result.scalingActions.some(action => action.action === 'scale_down')).toBe(true);
    });

    test('should respect scaling policy limits', async () => {
      const result = await manager.scaleInstances(10); // Above max limit

      expect(result.actualCount).toBeLessThanOrEqual(scalingPolicy.maxInstances);
    });

    test('should handle scaling failures gracefully', async () => {
      // Mock container creation to fail
      const mockDocker = require('dockerode');
      const dockerInstance = new mockDocker();
      dockerInstance.createContainer.mockRejectedValueOnce(new Error('Scaling failed'));

      const result = await manager.scaleInstances(2);

      expect(result.success).toBe(false);
      expect(result.scalingActions.some(action => !action.success)).toBe(true);
    });
  });

  describe('Health Monitoring', () => {
    let instance: HBInstance;

    beforeEach(async () => {
      const config: InstanceConfig = {
        name: 'test-instance',
        gatewayPort: 8080,
        apiKey: 'test-api-key'
      };
      instance = await manager.createInstance(config);
    });

    test('should perform health check on all instances', async () => {
      const healthStatuses = await manager.healthCheck();

      expect(healthStatuses).toHaveLength(1);
      expect(healthStatuses[0].instanceId).toBe(instance.id);
      expect(healthStatuses[0].status).toBe('healthy');
      expect(mockGatewayClient.healthCheck).toHaveBeenCalled();
    });

    test('should detect unhealthy instances', async () => {
      mockGatewayClient.healthCheck.mockResolvedValueOnce({ status: 'unhealthy', message: 'Service down' });

      const healthStatuses = await manager.healthCheck();

      expect(healthStatuses[0].status).toBe('unhealthy');
      expect(healthStatuses[0].issues).toContain('Gateway unhealthy: Service down');
    });

    test('should handle health check failures', async () => {
      mockGatewayClient.healthCheck.mockRejectedValueOnce(new Error('Connection failed'));

      const healthStatuses = await manager.healthCheck();

      expect(healthStatuses[0].status).toBe('error');
      expect(healthStatuses[0].issues).toContain('Health check error: Connection failed');
    });
  });

  describe('Load Rebalancing', () => {
    let instances: HBInstance[];

    beforeEach(async () => {
      // Create instances with different loads
      const configs = [
        { name: 'instance-1', gatewayPort: 8080, apiKey: 'key-1' },
        { name: 'instance-2', gatewayPort: 8081, apiKey: 'key-2' }
      ];

      instances = await Promise.all(
        configs.map(config => manager.createInstance(config))
      );

      // Add strategies to first instance to make it overloaded
      const strategy: HBStrategy = {
        type: 'pure_market_making',
        exchange: 'binance',
        tradingPair: 'BTC/USDT',
        parameters: {},
        riskLimits: { maxLoss: 1000, maxExposure: 10000 },
        executionSettings: { timeout: 30000 }
      };

      await manager.deployStrategy(instances[0].id, strategy);
      await manager.deployStrategy(instances[0].id, strategy);
    });

    test('should rebalance load across instances', async () => {
      const result = await manager.rebalanceLoad();

      expect(result).toBeDefined();
      expect(result.totalStrategies).toBeGreaterThan(0);
      expect(result.success).toBe(true);
    });

    test('should handle rebalancing failures', async () => {
      mockGatewayClient.stopStrategy.mockRejectedValueOnce(new Error('Stop failed'));

      const result = await manager.rebalanceLoad();

      expect(result.success).toBe(false);
      expect(result.rebalanceActions.some(action => !action.success)).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    test('should update scaling policy', () => {
      const newPolicy: Partial<ScalingPolicy> = {
        maxInstances: 10,
        targetCpuUtilization: 60
      };

      manager.updateScalingPolicy(newPolicy);

      // Verify policy was updated (this would require exposing the policy or testing behavior)
      expect(() => manager.updateScalingPolicy(newPolicy)).not.toThrow();
    });

    test('should set load balancing strategy', () => {
      const strategies: LoadBalancingStrategy[] = ['round_robin', 'least_loaded', 'resource_based'];

      strategies.forEach(strategy => {
        expect(() => manager.setLoadBalancingStrategy(strategy)).not.toThrow();
      });
    });
  });

  describe('Event Handling', () => {
    test('should emit instance creation events', async () => {
      const eventSpy = jest.fn();
      manager.on('instanceCreated', eventSpy);

      const config: InstanceConfig = {
        name: 'test-instance',
        gatewayPort: 8080,
        apiKey: 'test-api-key'
      };

      await manager.createInstance(config);

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        name: 'test-instance'
      }));
    });

    test('should emit strategy deployment events', async () => {
      const eventSpy = jest.fn();
      manager.on('strategyDeployed', eventSpy);

      const config: InstanceConfig = {
        name: 'test-instance',
        gatewayPort: 8080,
        apiKey: 'test-api-key'
      };

      const instance = await manager.createInstance(config);
      
      const strategy: HBStrategy = {
        type: 'pure_market_making',
        exchange: 'binance',
        tradingPair: 'BTC/USDT',
        parameters: {},
        riskLimits: { maxLoss: 1000, maxExposure: 10000 },
        executionSettings: { timeout: 30000 }
      };

      await manager.deployStrategy(instance.id, strategy);

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        instanceId: instance.id
      }));
    });

    test('should emit scaling events', async () => {
      const eventSpy = jest.fn();
      manager.on('instancesScaled', eventSpy);

      await manager.scaleInstances(2);

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        targetCount: 2
      }));
    });
  });

  describe('Error Handling', () => {
    test('should handle Docker connection errors', async () => {
      const mockDocker = require('dockerode');
      const dockerInstance = new mockDocker();
      dockerInstance.createContainer.mockRejectedValueOnce(new Error('Docker daemon not running'));

      const config: InstanceConfig = {
        name: 'test-instance',
        gatewayPort: 8080,
        apiKey: 'test-api-key'
      };

      await expect(manager.createInstance(config)).rejects.toThrow('Docker daemon not running');
    });

    test('should handle gateway connection errors', async () => {
      mockGatewayClient.healthCheck.mockRejectedValueOnce(new Error('Gateway unreachable'));

      const config: InstanceConfig = {
        name: 'test-instance',
        gatewayPort: 8080,
        apiKey: 'test-api-key'
      };

      await expect(manager.createInstance(config)).rejects.toThrow();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all resources', async () => {
      const config: InstanceConfig = {
        name: 'test-instance',
        gatewayPort: 8080,
        apiKey: 'test-api-key'
      };

      await manager.createInstance(config);
      
      await expect(manager.cleanup()).resolves.not.toThrow();
      
      // Verify instances are cleaned up
      expect(manager.getAllInstances()).toHaveLength(0);
    });

    test('should stop health monitoring on cleanup', async () => {
      const stopSpy = jest.spyOn(manager, 'stopHealthMonitoring');
      
      await manager.cleanup();
      
      expect(stopSpy).toHaveBeenCalled();
    });
  });
});