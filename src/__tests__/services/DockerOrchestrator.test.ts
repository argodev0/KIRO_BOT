
import { DockerOrchestrator } from '../../services/DockerOrchestrator';
import { InstanceConfig } from '../../types/hummingbot';

// Mock dockerode
jest.mock('dockerode', () => {
  const mockContainer = {
    id: 'mock-container-id',
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    restart: jest.fn().mockResolvedValue(undefined),
    inspect: jest.fn().mockResolvedValue({
      Id: 'mock-container-id',
      Name: '/test-container',
      State: { 
        Running: true, 
        Status: 'running',
        Health: { Status: 'healthy' } 
      },
      Config: { Image: 'hummingbot/hummingbot:latest' },
      NetworkSettings: { Ports: {} },
      Created: new Date().toISOString()
    }),
    stats: jest.fn().mockResolvedValue({
      cpu_stats: {
        cpu_usage: { total_usage: 2000000 },
        system_cpu_usage: 20000000,
        online_cpus: 2
      },
      precpu_stats: {
        cpu_usage: { total_usage: 1000000 },
        system_cpu_usage: 10000000
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
    }),
    logs: jest.fn().mockResolvedValue(Buffer.from('Container logs')),
    exec: jest.fn().mockResolvedValue({
      start: jest.fn().mockResolvedValue({
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('Command output'));
          } else if (event === 'end') {
            callback();
          }
        })
      })
    })
  };

  const mockNetwork = {
    id: 'network-id'
  };

  return jest.fn().mockImplementation(() => ({
    createContainer: jest.fn().mockResolvedValue(mockContainer),
    getContainer: jest.fn().mockReturnValue(mockContainer),
    listContainers: jest.fn().mockResolvedValue([
      {
        Id: 'container-1',
        Names: ['/hummingbot-instance-1'],
        Image: 'hummingbot/hummingbot:latest',
        Status: 'Up 5 minutes',
        Ports: [{ PrivatePort: 8080, PublicPort: 8080, Type: 'tcp' }],
        Created: Math.floor(Date.now() / 1000),
        State: 'running'
      }
    ]),
    listImages: jest.fn().mockResolvedValue([
      {
        RepoTags: ['hummingbot/hummingbot:latest']
    ]),
    pull: jest.fn().mockResolvedValue(undefined),
    listNetworks: jest.fn().mockResolvedValue([
      {
        Id: 'network-id',
        Name: 'hummingbot-network'
      }
    ]),
    createNetwork: jest.fn().mockResolvedValue(mockNetwork),
    getNetwork: jest.fn().mockReturnValue(mockNetwork)
  }));
});

describe('DockerOrchestrator', () => {
  let orchestrator: DockerOrchestrator;

  beforeEach(() => {
    orchestrator = new DockerOrchestrator();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await orchestrator.cleanup();
  });

  describe('Container Management', () => {
    test('should create Hummingbot container successfully', async () => {
      const config: InstanceConfig = {
        name: 'test-hummingbot',
        gatewayPort: 8080,
        apiKey: 'test-api-key',
        resources: {
          cpu: 1024,
          memory: 1024 * 1024 * 1024
        },
        environmentVariables: ['TEST_VAR=test_value']
      };

      const container = await orchestrator.createHummingbotContainer(config);

      expect(container).toBeDefined();
      expect(container.id).toBe('mock-container-id');
      expect(container.start).toHaveBeenCalled();
    });

    test('should handle container creation failure', async () => {
      const config: InstanceConfig = {
        name: 'failing-container',
        gatewayPort: 8081,
        apiKey: 'test-api-key'
      };

      const mockDocker = require('dockerode');
      const dockerInstance = new mockDocker();
      dockerInstance.createContainer.mockRejectedValueOnce(new Error('Container creation failed'));

      // Create new orchestrator instance to use the mocked failure
      const failingOrchestrator = new DockerOrchestrator();

      await expect(failingOrchestrator.createHummingbotContainer(config)).rejects.toThrow('Container creation failed');
    });

    test('should remove container successfully', async () => {
      const containerId = 'mock-container-id';

      await orchestrator.removeContainer(containerId);

      const mockDocker = require('dockerode');
      const dockerInstance = new mockDocker();
      const mockContainer = dockerInstance.getContainer();
      
      expect(mockContainer.stop).toHaveBeenCalled();
      expect(mockContainer.remove).toHaveBeenCalled();
    });

    test('should handle container removal failure gracefully', async () => {
      const containerId = 'failing-container-id';

      const mockDocker = require('dockerode');
      const dockerInstance = new mockDocker();
      const mockContainer = dockerInstance.getContainer();
      mockContainer.stop.mockRejectedValueOnce(new Error('Stop failed'));
      mockContainer.kill = jest.fn().mockResolvedValue(undefined);

      await orchestrator.removeContainer(containerId);

      expect(mockContainer.kill).toHaveBeenCalled();
      expect(mockContainer.remove).toHaveBeenCalled();
    });

    test('should get container information', async () => {
      const containerId = 'mock-container-id';

      const info = await orchestrator.getContainerInfo(containerId);

      expect(info).toBeDefined();
      expect(info.id).toBe('mock-container-id');
      expect(info.name).toBe('test-container');
      expect(info.status).toBe('running');
      expect(info.image).toBe('hummingbot/hummingbot:latest');
    });

    test('should get container statistics', async () => {
      const containerId = 'mock-container-id';

      const stats = await orchestrator.getContainerStats(containerId);

      expect(stats).toBeDefined();
      expect(stats.cpuUsage).toBeGreaterThan(0);
      expect(stats.memoryUsage).toBeGreaterThan(0);
      expect(stats.memoryLimit).toBeGreaterThan(0);
      expect(stats.networkIO).toBeDefined();
      expect(stats.diskIO).toBeDefined();
    });

    test('should restart container', async () => {
      const containerId = 'mock-container-id';

      await orchestrator.restartContainer(containerId);

      const mockDocker = require('dockerode');
      const dockerInstance = new mockDocker();
      const mockContainer = dockerInstance.getContainer();
      
      expect(mockContainer.restart).toHaveBeenCalledWith({ t: 10 });
    });
  });

  describe('Container Scaling', () => {
    test('should scale up containers', async () => {
      const currentContainers = ['container-1'];
      const targetCount = 3;
      const configTemplate: InstanceConfig = {
        name: 'hummingbot-template',
        gatewayPort: 8080,
        apiKey: 'template-key'
      };

      const result = await orchestrator.scaleContainers(currentContainers, targetCount, configTemplate);

      expect(result.created).toHaveLength(2); // 3 - 1 = 2 new containers
      expect(result.removed).toHaveLength(0);
    });

    test('should scale down containers', async () => {
      const currentContainers = ['container-1', 'container-2', 'container-3'];
      const targetCount = 1;
      const configTemplate: InstanceConfig = {
        name: 'hummingbot-template',
        gatewayPort: 8080,
        apiKey: 'template-key'
      };

      const result = await orchestrator.scaleContainers(currentContainers, targetCount, configTemplate);

      expect(result.created).toHaveLength(0);
      expect(result.removed).toHaveLength(2); // 3 - 1 = 2 containers removed
    });

    test('should handle scaling failures', async () => {
      const currentContainers: string[] = [];
      const targetCount = 2;
      const configTemplate: InstanceConfig = {
        name: 'failing-template',
        gatewayPort: 8080,
        apiKey: 'template-key'
      };

      const mockDocker = require('dockerode');
      const dockerInstance = new mockDocker();
      dockerInstance.createContainer.mockRejectedValueOnce(new Error('Scaling failed'));

      await expect(orchestrator.scaleContainers(currentContainers, targetCount, configTemplate)).rejects.toThrow('Scaling failed');
    });
  });

  describe('Health Monitoring', () => {
    test('should perform health check on containers', async () => {
      // First create a container to monitor
      const config: InstanceConfig = {
        name: 'health-test-container',
        gatewayPort: 8080,
        apiKey: 'test-key'
      };

      const container = await orchestrator.createHummingbotContainer(config);
      
      const healthStatus = await orchestrator.healthCheckContainers();

      expect(healthStatus).toBeDefined();
      expect(healthStatus.has(container.id)).toBe(true);
      expect(healthStatus.get(container.id)).toBe(true);
    });

    test('should detect unhealthy containers', async () => {
      const config: InstanceConfig = {
        name: 'unhealthy-container',
        gatewayPort: 8080,
        apiKey: 'test-key'
      };

      const container = await orchestrator.createHummingbotContainer(config);

      // Mock container as unhealthy
      const mockDocker = require('dockerode');
      const dockerInstance = new mockDocker();
      const mockContainer = dockerInstance.getContainer();
      mockContainer.inspect.mockResolvedValueOnce({
        Id: container.id,
        State: { Running: false, Health: { Status: 'unhealthy' } }
      });

      const healthStatus = await orchestrator.healthCheckContainers();

      expect(healthStatus.get(container.id)).toBe(false);
    });
  });

  describe('Container Operations', () => {
    test('should get container logs', async () => {
      const containerId = 'mock-container-id';
      const options = { tail: 50, since: Date.now() - 3600000 };

      const logs = await orchestrator.getContainerLogs(containerId, options);

      expect(logs).toBe('Container logs');
    });

    test('should execute command in container', async () => {
      const containerId = 'mock-container-id';
      const command = ['ls', '-la'];

      const output = await orchestrator.execInContainer(containerId, command);

      expect(output).toBe('Command output');
    });

    test('should list Hummingbot containers', async () => {
      const containers = await orchestrator.listHummingbotContainers();

      expect(containers).toHaveLength(1);
      expect(containers[0].name).toBe('hummingbot-instance-1');
      expect(containers[0].image).toBe('hummingbot/hummingbot:latest');
    });

    test('should cleanup orphaned containers', async () => {
      // Mock a dead container
      const mockDocker = require('dockerode');
      const dockerInstance = new mockDocker();
      dockerInstance.listContainers.mockResolvedValueOnce([
        {
          Id: 'dead-container',
          Names: ['/dead-hummingbot'],
          Image: 'hummingbot/hummingbot:latest',
          Status: 'Exited (1) 5 minutes ago',
          Ports: [],
          Created: Math.floor(Date.now() / 1000),
          State: 'exited'
        }
      ]);

      const removedContainers = await orchestrator.cleanupOrphanedContainers();

      expect(removedContainers).toContain('dead-container');
    });
  });

  describe('Network Management', () => {
    test('should initialize Docker networks on construction', () => {
      // Network initialization happens in constructor
      // We can verify it doesn't throw errors
      expect(() => new DockerOrchestrator()).not.toThrow();
    });

    test('should handle existing network', async () => {
      // Mock existing network
      const mockDocker = require('dockerode');
      const dockerInstance = new mockDocker();
      dockerInstance.listNetworks.mockResolvedValueOnce([
        {
          Id: 'existing-network-id',
          Name: 'hummingbot-network'
        }
      ]);

      // Should not throw when network already exists
      expect(() => new DockerOrchestrator()).not.toThrow();
    });
  });

  describe('Image Management', () => {
    test('should ensure Hummingbot image is available', async () => {
      const config: InstanceConfig = {
        name: 'test-container',
        gatewayPort: 8080,
        apiKey: 'test-key'
      };

      // This should not throw and should pull image if needed
      await expect(orchestrator.createHummingbotContainer(config)).resolves.toBeDefined();
    });

    test('should pull image if not available', async () => {
      const mockDocker = require('dockerode');
      const dockerInstance = new mockDocker();
      dockerInstance.listImages.mockResolvedValueOnce([]); // No images available

      const config: InstanceConfig = {
        name: 'test-container',
        gatewayPort: 8080,
        apiKey: 'test-key'
      };

      await orchestrator.createHummingbotContainer(config);

      expect(dockerInstance.pull).toHaveBeenCalledWith('hummingbot/hummingbot:latest');
    });
  });

  describe('Error Handling', () => {
    test('should handle Docker daemon connection errors', async () => {
      const mockDocker = require('dockerode');
      const dockerInstance = new mockDocker();
      dockerInstance.createContainer.mockRejectedValueOnce(new Error('Cannot connect to Docker daemon'));

      const config: InstanceConfig = {
        name: 'test-container',
        gatewayPort: 8080,
        apiKey: 'test-key'
      };

      await expect(orchestrator.createHummingbotContainer(config)).rejects.toThrow('Cannot connect to Docker daemon');
    });

    test('should handle container inspection errors', async () => {
      const mockDocker = require('dockerode');
      const dockerInstance = new mockDocker();
      const mockContainer = dockerInstance.getContainer();
      mockContainer.inspect.mockRejectedValueOnce(new Error('Container not found'));

      await expect(orchestrator.getContainerInfo('non-existent-container')).rejects.toThrow('Container not found');
    });

    test('should handle stats collection errors', async () => {
      const mockDocker = require('dockerode');
      const dockerInstance = new mockDocker();
      const mockContainer = dockerInstance.getContainer();
      mockContainer.stats.mockRejectedValueOnce(new Error('Stats not available'));

      await expect(orchestrator.getContainerStats('container-id')).rejects.toThrow('Stats not available');
    });
  });

  describe('Event Handling', () => {
    test('should emit container creation events', async () => {
      const eventSpy = jest.fn();
      orchestrator.on('containerCreated', eventSpy);

      const config: InstanceConfig = {
        name: 'event-test-container',
        gatewayPort: 8080,
        apiKey: 'test-key'
      };

      await orchestrator.createHummingbotContainer(config);

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        containerId: 'mock-container-id',
        name: 'event-test-container'
      }));
    });

    test('should emit container removal events', async () => {
      const eventSpy = jest.fn();
      orchestrator.on('containerRemoved', eventSpy);

      await orchestrator.removeContainer('mock-container-id');

      expect(eventSpy).toHaveBeenCalledWith('mock-container-id');
    });

    test('should emit container restart events', async () => {
      const eventSpy = jest.fn();
      orchestrator.on('containerRestarted', eventSpy);

      await orchestrator.restartContainer('mock-container-id');

      expect(eventSpy).toHaveBeenCalledWith('mock-container-id');
    });

    test('should emit unhealthy container events', async () => {
      const eventSpy = jest.fn();
      orchestrator.on('containerUnhealthy', eventSpy);

      // Create container first
      const config: InstanceConfig = {
        name: 'unhealthy-test',
        gatewayPort: 8080,
        apiKey: 'test-key'
      };
      const container = await orchestrator.createHummingbotContainer(config);

      // Mock unhealthy state
      const mockDocker = require('dockerode');
      const dockerInstance = new mockDocker();
      const mockContainer = dockerInstance.getContainer();
      mockContainer.inspect.mockResolvedValueOnce({
        Id: container.id,
        State: { Running: false, Health: { Status: 'unhealthy' } }
      });

      await orchestrator.healthCheckContainers();

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        containerId: container.id
      }));
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all resources', async () => {
      // Create some containers first
      const config: InstanceConfig = {
        name: 'cleanup-test',
        gatewayPort: 8080,
        apiKey: 'test-key'
      };

      await orchestrator.createHummingbotContainer(config);

      // Cleanup should not throw
      await expect(orchestrator.cleanup()).resolves.not.toThrow();
    });

    test('should handle cleanup errors gracefully', async () => {
      const mockDocker = require('dockerode');
      const dockerInstance = new mockDocker();
      const mockContainer = dockerInstance.getContainer();
      mockContainer.stop.mockRejectedValueOnce(new Error('Cleanup failed'));

      // Create container first
      const config: InstanceConfig = {
        name: 'cleanup-error-test',
        gatewayPort: 8080,
        apiKey: 'test-key'
      };
      await orchestrator.createHummingbotContainer(config);

      // Cleanup should handle errors gracefully
      await expect(orchestrator.cleanup()).rejects.toThrow('Cleanup failed');
    });
  });
});