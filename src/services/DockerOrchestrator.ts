import Docker from 'dockerode';
import { EventEmitter } from 'events';
import { InstanceConfig, ResourceUsage } from '../types/hummingbot';
import { logger } from '../utils/logger';

export interface ContainerInfo {
  id: string;
  name: string;
  status: string;
  image: string;
  ports: Record<string, any>;
  created: Date;
  state: any;
}

export interface ContainerStats {
  cpuUsage: number;
  memoryUsage: number;
  memoryLimit: number;
  networkIO: {
    rx: number;
    tx: number;
  };
  diskIO: {
    read: number;
    write: number;
  };
}

export class DockerOrchestrator extends EventEmitter {
  private docker: Docker;
  private containers: Map<string, Docker.Container> = new Map();
  private networks: Map<string, Docker.Network> = new Map();

  constructor() {
    super();
    this.docker = new Docker();
    this.initializeNetworks();
  }

  /**
   * Create and start a Hummingbot container
   */
  async createHummingbotContainer(config: InstanceConfig): Promise<Docker.Container> {
    try {
      logger.info(`Creating Hummingbot container: ${config.name}`);

      // Ensure Hummingbot image is available
      await this.ensureHummingbotImage();

      // Create container configuration
      const containerConfig = this.buildContainerConfig(config);

      // Create container
      const container = await this.docker.createContainer(containerConfig);
      this.containers.set(container.id, container);

      // Start container
      await container.start();

      // Wait for container to be ready
      await this.waitForContainerReady(container, config.gatewayPort);

      this.emit('containerCreated', {
        containerId: container.id,
        name: config.name,
        config
      });

      logger.info(`Hummingbot container created and started: ${container.id}`);
      return container;

    } catch (error) {
      logger.error(`Failed to create Hummingbot container ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * Stop and remove a container
   */
  async removeContainer(containerId: string): Promise<void> {
    try {
      const container = this.containers.get(containerId) || this.docker.getContainer(containerId);
      
      // Stop container gracefully
      try {
        await container.stop({ t: 10 }); // 10 second timeout
      } catch (error) {
        logger.warn(`Failed to stop container gracefully ${containerId}:`, error);
        // Force kill if graceful stop fails
        await container.kill();
      }

      // Remove container
      await container.remove({ force: true });
      this.containers.delete(containerId);

      this.emit('containerRemoved', containerId);
      logger.info(`Container removed: ${containerId}`);

    } catch (error) {
      logger.error(`Failed to remove container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Get container information
   */
  async getContainerInfo(containerId: string): Promise<ContainerInfo> {
    try {
      const container = this.containers.get(containerId) || this.docker.getContainer(containerId);
      const info = await container.inspect();

      return {
        id: info.Id,
        name: info.Name.replace('/', ''),
        status: info.State.Status,
        image: info.Config.Image,
        ports: info.NetworkSettings.Ports,
        created: new Date(info.Created),
        state: info.State
      };

    } catch (error) {
      logger.error(`Failed to get container info ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Get container statistics
   */
  async getContainerStats(containerId: string): Promise<ContainerStats> {
    try {
      const container = this.containers.get(containerId) || this.docker.getContainer(containerId);
      const stats = await container.stats({ stream: false });

      return this.parseContainerStats(stats);

    } catch (error) {
      logger.error(`Failed to get container stats ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Restart a container
   */
  async restartContainer(containerId: string): Promise<void> {
    try {
      const container = this.containers.get(containerId) || this.docker.getContainer(containerId);
      await container.restart({ t: 10 });

      this.emit('containerRestarted', containerId);
      logger.info(`Container restarted: ${containerId}`);

    } catch (error) {
      logger.error(`Failed to restart container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Scale containers based on target count
   */
  async scaleContainers(
    currentContainers: string[],
    targetCount: number,
    configTemplate: InstanceConfig
  ): Promise<{ created: string[]; removed: string[] }> {
    const currentCount = currentContainers.length;
    const created: string[] = [];
    const removed: string[] = [];

    try {
      if (targetCount > currentCount) {
        // Scale up - create new containers
        const containersToCreate = targetCount - currentCount;
        
        for (let i = 0; i < containersToCreate; i++) {
          const config: InstanceConfig = {
            ...configTemplate,
            name: `${configTemplate.name}-${Date.now()}-${i}`,
            gatewayPort: configTemplate.gatewayPort + currentCount + i + 1
          };

          const container = await this.createHummingbotContainer(config);
          created.push(container.id);
        }

      } else if (targetCount < currentCount) {
        // Scale down - remove excess containers
        const containersToRemove = currentCount - targetCount;
        const containersToRemoveIds = currentContainers.slice(-containersToRemove);

        for (const containerId of containersToRemoveIds) {
          await this.removeContainer(containerId);
          removed.push(containerId);
        }
      }

      logger.info(`Container scaling completed: ${created.length} created, ${removed.length} removed`);
      return { created, removed };

    } catch (error) {
      logger.error('Container scaling failed:', error);
      throw error;
    }
  }

  /**
   * Health check for all managed containers
   */
  async healthCheckContainers(): Promise<Map<string, boolean>> {
    const healthStatus = new Map<string, boolean>();

    for (const [containerId, container] of this.containers) {
      try {
        const info = await container.inspect();
        const isHealthy = info.State.Running && info.State.Health?.Status !== 'unhealthy';
        healthStatus.set(containerId, isHealthy);

        if (!isHealthy) {
          this.emit('containerUnhealthy', {
            containerId,
            status: info.State.Status,
            health: info.State.Health
          });
        }

      } catch (error) {
        logger.error(`Health check failed for container ${containerId}:`, error);
        healthStatus.set(containerId, false);
      }
    }

    return healthStatus;
  }

  /**
   * Get logs from a container
   */
  async getContainerLogs(containerId: string, options: {
    tail?: number;
    since?: number;
    follow?: boolean;
  } = {}): Promise<string> {
    try {
      const container = this.containers.get(containerId) || this.docker.getContainer(containerId);
      
      const logOptions = {
        stdout: true,
        stderr: true,
        tail: options.tail || 100,
        since: options.since || 0,
        follow: options.follow || false
      };

      const logs = await container.logs(logOptions);
      return logs.toString();

    } catch (error) {
      logger.error(`Failed to get logs for container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Execute command in container
   */
  async execInContainer(containerId: string, command: string[]): Promise<string> {
    try {
      const container = this.containers.get(containerId) || this.docker.getContainer(containerId);
      
      const exec = await container.exec({
        Cmd: command,
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start({ hijack: true, stdin: false });
      
      return new Promise((resolve, reject) => {
        let output = '';
        
        stream.on('data', (chunk: Buffer) => {
          output += chunk.toString();
        });

        stream.on('end', () => {
          resolve(output);
        });

        stream.on('error', (error: Error) => {
          reject(error);
        });
      });

    } catch (error) {
      logger.error(`Failed to execute command in container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * List all Hummingbot containers
   */
  async listHummingbotContainers(): Promise<ContainerInfo[]> {
    try {
      const containers = await this.docker.listContainers({ all: true });
      const hummingbotContainers = containers.filter(container => 
        container.Image.includes('hummingbot') || 
        container.Names.some(name => name.includes('hummingbot'))
      );

      return hummingbotContainers.map(container => ({
        id: container.Id,
        name: container.Names[0].replace('/', ''),
        status: container.Status,
        image: container.Image,
        ports: container.Ports.reduce((acc, port) => {
          if (port.PublicPort) {
            acc[`${port.PrivatePort}/${port.Type}`] = port.PublicPort;
          }
          return acc;
        }, {} as Record<string, any>),
        created: new Date(container.Created * 1000),
        state: container.State
      }));

    } catch (error) {
      logger.error('Failed to list Hummingbot containers:', error);
      throw error;
    }
  }

  /**
   * Clean up orphaned containers
   */
  async cleanupOrphanedContainers(): Promise<string[]> {
    try {
      const allContainers = await this.listHummingbotContainers();
      const orphanedContainers = allContainers.filter(container => 
        container.status.includes('Exited') || container.status.includes('Dead')
      );

      const removedContainers: string[] = [];

      for (const container of orphanedContainers) {
        try {
          await this.removeContainer(container.id);
          removedContainers.push(container.id);
        } catch (error) {
          logger.warn(`Failed to remove orphaned container ${container.id}:`, error);
        }
      }

      logger.info(`Cleaned up ${removedContainers.length} orphaned containers`);
      return removedContainers;

    } catch (error) {
      logger.error('Failed to cleanup orphaned containers:', error);
      throw error;
    }
  }

  /**
   * Build container configuration
   */
  private buildContainerConfig(config: InstanceConfig): any {
    const networkName = 'hummingbot-network';
    
    return {
      Image: 'hummingbot/hummingbot:latest',
      name: config.name,
      Env: [
        `HUMMINGBOT_GATEWAY_PORT=${config.gatewayPort}`,
        `HUMMINGBOT_API_KEY=${config.apiKey}`,
        'HUMMINGBOT_LOG_LEVEL=INFO',
        'HUMMINGBOT_STRATEGY_FILE_PREFIX=conf_',
        ...(config.environmentVariables || [])
      ],
      ExposedPorts: {
        [`${config.gatewayPort}/tcp`]: {},
        '8080/tcp': {}, // Default Hummingbot client port
        '5000/tcp': {}  // Default gateway port
      },
      HostConfig: {
        PortBindings: {
          [`${config.gatewayPort}/tcp`]: [{ HostPort: config.gatewayPort.toString() }],
          '8080/tcp': [{ HostPort: '0' }], // Auto-assign port
          '5000/tcp': [{ HostPort: '0' }]  // Auto-assign port
        },
        Memory: config.resources?.memory || 1024 * 1024 * 1024, // 1GB default
        CpuShares: config.resources?.cpu || 1024, // 1 CPU default
        RestartPolicy: {
          Name: 'unless-stopped'
        },
        NetworkMode: networkName
      },
      NetworkingConfig: {
        EndpointsConfig: {
          [networkName]: {}
        }
      },
      Labels: {
        'hummingbot.instance': 'true',
        'hummingbot.name': config.name,
        'hummingbot.gateway-port': config.gatewayPort.toString()
      },
      Healthcheck: {
        Test: [`CMD-SHELL`, `curl -f http://localhost:${config.gatewayPort}/health || exit 1`],
        Interval: 30000000000, // 30 seconds in nanoseconds
        Timeout: 10000000000,   // 10 seconds in nanoseconds
        Retries: 3,
        StartPeriod: 60000000000 // 60 seconds in nanoseconds
      }
    };
  }

  /**
   * Ensure Hummingbot image is available
   */
  private async ensureHummingbotImage(): Promise<void> {
    try {
      const images = await this.docker.listImages();
      const hummingbotImage = images.find(image => 
        image.RepoTags?.some(tag => tag.includes('hummingbot'))
      );

      if (!hummingbotImage) {
        logger.info('Pulling Hummingbot image...');
        await this.docker.pull('hummingbot/hummingbot:latest');
        logger.info('Hummingbot image pulled successfully');
      }

    } catch (error) {
      logger.error('Failed to ensure Hummingbot image:', error);
      throw error;
    }
  }

  /**
   * Initialize Docker networks
   */
  private async initializeNetworks(): Promise<void> {
    try {
      const networkName = 'hummingbot-network';
      const networks = await this.docker.listNetworks();
      
      const existingNetwork = networks.find(network => network.Name === networkName);
      
      if (!existingNetwork) {
        logger.info(`Creating Docker network: ${networkName}`);
        const network = await this.docker.createNetwork({
          Name: networkName,
          Driver: 'bridge',
          IPAM: {
            Config: [{
              Subnet: '172.20.0.0/16'
            }]
          }
        });
        
        this.networks.set(networkName, network);
        logger.info(`Docker network created: ${networkName}`);
      } else {
        const network = this.docker.getNetwork(existingNetwork.Id);
        this.networks.set(networkName, network);
        logger.info(`Using existing Docker network: ${networkName}`);
      }

    } catch (error) {
      logger.error('Failed to initialize Docker networks:', error);
      throw error;
    }
  }

  /**
   * Wait for container to be ready
   */
  private async waitForContainerReady(
    container: Docker.Container, 
    gatewayPort: number, 
    timeout: number = 120000
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const info = await container.inspect();
        
        if (info.State.Running) {
          // Check if health check is passing
          if (info.State.Health?.Status === 'healthy') {
            return;
          }
          
          // If no health check, wait a bit more and assume ready
          if (!info.State.Health) {
            await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
            return;
          }
        }
      } catch (error) {
        // Continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
    }
    
    throw new Error(`Container ${container.id} did not become ready within ${timeout}ms`);
  }

  /**
   * Parse container statistics
   */
  private parseContainerStats(stats: any): ContainerStats {
    // CPU usage calculation
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (stats.precpu_stats.cpu_usage?.total_usage || 0);
    const systemDelta = stats.cpu_stats.system_cpu_usage - (stats.precpu_stats.system_cpu_usage || 0);
    const cpuUsage = systemDelta > 0 ? (cpuDelta / systemDelta) * (stats.cpu_stats.online_cpus || 1) * 100 : 0;

    // Memory usage
    const memoryUsage = stats.memory_stats.usage || 0;
    const memoryLimit = stats.memory_stats.limit || 0;

    // Network I/O
    const networks = stats.networks || {};
    const networkIO = Object.values(networks).reduce((acc: any, network: any) => ({
      rx: acc.rx + (network.rx_bytes || 0),
      tx: acc.tx + (network.tx_bytes || 0)
    }), { rx: 0, tx: 0 });

    // Disk I/O
    const blkioStats = stats.blkio_stats?.io_service_bytes_recursive || [];
    const diskIO = blkioStats.reduce((acc: any, stat: any) => {
      if (stat.op === 'Read') acc.read += stat.value || 0;
      if (stat.op === 'Write') acc.write += stat.value || 0;
      return acc;
    }, { read: 0, write: 0 });

    return {
      cpuUsage: Math.round(cpuUsage * 100) / 100,
      memoryUsage,
      memoryLimit,
      networkIO,
      diskIO
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      // Stop all managed containers
      const containerIds = Array.from(this.containers.keys());
      await Promise.all(containerIds.map(id => this.removeContainer(id)));

      // Clean up networks if needed
      // Note: We don't remove the network as other containers might be using it

      logger.info('DockerOrchestrator cleanup completed');

    } catch (error) {
      logger.error('DockerOrchestrator cleanup failed:', error);
      throw error;
    }
  }
}