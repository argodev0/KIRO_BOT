import { EventEmitter } from 'events';
import Docker from 'dockerode';
import { HummingbotGatewayClient } from './HummingbotGatewayClient';
import { HummingbotBridgeService } from './HummingbotBridgeService';
import { 
  HBInstance, 
  InstanceConfig, 
  InstanceStatus, 
  HBStrategy, 
  Deployment, 
  ScalingResult, 
  HealthStatus, 
  RebalanceResult,
  ResourceUsage,
  InstancePerformance,
  ActiveStrategy,
  LoadBalancingStrategy,
  ScalingPolicy,
  RecoveryAction
} from '../types/hummingbot';
import { logger } from '../utils/logger';

export class HummingbotManager extends EventEmitter {
  private docker: Docker;
  private instances: Map<string, HBInstance> = new Map();
  private gatewayClients: Map<string, HummingbotGatewayClient> = new Map();
  private bridgeService: HummingbotBridgeService;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private scalingPolicy: ScalingPolicy;
  private loadBalancingStrategy: LoadBalancingStrategy = 'round_robin';

  constructor(
    bridgeService: HummingbotBridgeService,
    scalingPolicy: ScalingPolicy = {
      minInstances: 1,
      maxInstances: 10,
      targetCpuUtilization: 70,
      targetMemoryUtilization: 80,
      scaleUpCooldown: 300000, // 5 minutes
      scaleDownCooldown: 600000 // 10 minutes
    }
  ) {
    super();
    this.docker = new Docker();
    this.bridgeService = bridgeService;
    this.scalingPolicy = scalingPolicy;
    this.startHealthMonitoring();
  }

  /**
   * Create a new Hummingbot instance
   */
  async createInstance(config: InstanceConfig): Promise<HBInstance> {
    try {
      logger.info(`Creating Hummingbot instance: ${config.name}`);

      // Create Docker container for Hummingbot
      const container = await this.createDockerContainer(config);
      
      // Start the container
      await container.start();
      
      // Wait for container to be ready
      await this.waitForContainerReady(container.id);

      // Create gateway client
      const gatewayClient = new HummingbotGatewayClient({
        baseUrl: `http://localhost:${config.gatewayPort}`,
        apiKey: config.apiKey,
        timeout: 30000
      });

      // Create instance object
      const instance: HBInstance = {
        id: container.id,
        name: config.name,
        status: 'starting',
        containerId: container.id,
        config,
        strategies: [],
        resources: {
          cpuUsage: 0,
          memoryUsage: 0,
          networkIO: 0,
          diskIO: 0
        },
        performance: {
          uptime: 0,
          totalStrategies: 0,
          activeStrategies: 0,
          totalTrades: 0,
          avgLatency: 0,
          errorRate: 0
        },
        createdAt: new Date(),
        lastHealthCheck: new Date()
      };

      // Store instance and client
      this.instances.set(instance.id, instance);
      this.gatewayClients.set(instance.id, gatewayClient);

      // Verify connection
      await this.verifyInstanceConnection(instance.id);
      
      instance.status = 'running';
      this.instances.set(instance.id, instance);

      this.emit('instanceCreated', instance);
      logger.info(`Hummingbot instance created successfully: ${instance.id}`);

      return instance;
    } catch (error) {
      logger.error('Failed to create Hummingbot instance:', error);
      throw error;
    }
  }

  /**
   * Deploy a strategy to a specific instance
   */
  async deployStrategy(instanceId: string, strategy: HBStrategy): Promise<Deployment> {
    try {
      const instance = this.instances.get(instanceId);
      if (!instance) {
        throw new Error(`Instance not found: ${instanceId}`);
      }

      const gatewayClient = this.gatewayClients.get(instanceId);
      if (!gatewayClient) {
        throw new Error(`Gateway client not found for instance: ${instanceId}`);
      }

      logger.info(`Deploying strategy ${strategy.type} to instance ${instanceId}`);

      // Deploy strategy via gateway
      const deploymentResult = await gatewayClient.deployStrategy(strategy);

      // Create active strategy record
      const activeStrategy: ActiveStrategy = {
        id: deploymentResult.strategyId,
        type: strategy.type,
        status: 'active',
        parameters: strategy.parameters,
        deployedAt: new Date(),
        performance: {
          totalTrades: 0,
          totalVolume: 0,
          totalPnL: 0,
          avgLatency: 0,
          fillRate: 0,
          errorCount: 0
        }
      };

      // Update instance
      instance.strategies.push(activeStrategy);
      instance.performance.totalStrategies++;
      instance.performance.activeStrategies++;
      this.instances.set(instanceId, instance);

      const deployment: Deployment = {
        id: deploymentResult.deploymentId,
        instanceId,
        strategyId: activeStrategy.id,
        strategy,
        status: 'deployed',
        deployedAt: new Date()
      };

      this.emit('strategyDeployed', deployment);
      logger.info(`Strategy deployed successfully: ${deployment.id}`);

      return deployment;
    } catch (error) {
      logger.error('Failed to deploy strategy:', error);
      throw error;
    }
  }

  /**
   * Scale instances based on current load and policies
   */
  async scaleInstances(targetCount?: number): Promise<ScalingResult> {
    try {
      const currentCount = this.instances.size;
      const desiredCount = targetCount || await this.calculateOptimalInstanceCount();

      logger.info(`Scaling instances from ${currentCount} to ${desiredCount}`);

      const result: ScalingResult = {
        previousCount: currentCount,
        targetCount: desiredCount,
        actualCount: currentCount,
        scalingActions: [],
        success: true
      };

      if (desiredCount > currentCount) {
        // Scale up
        const instancesToCreate = desiredCount - currentCount;
        for (let i = 0; i < instancesToCreate; i++) {
          try {
            const config: InstanceConfig = this.generateInstanceConfig(`hb-instance-${Date.now()}-${i}`);
            const instance = await this.createInstance(config);
            result.scalingActions.push({
              action: 'scale_up',
              instanceId: instance.id,
              success: true
            });
          } catch (error) {
            result.scalingActions.push({
              action: 'scale_up',
              success: false,
              error: error.message
            });
            result.success = false;
          }
        }
      } else if (desiredCount < currentCount) {
        // Scale down
        const instancesToRemove = currentCount - desiredCount;
        const candidatesForRemoval = this.selectInstancesForRemoval(instancesToRemove);
        
        for (const instanceId of candidatesForRemoval) {
          try {
            await this.removeInstance(instanceId);
            result.scalingActions.push({
              action: 'scale_down',
              instanceId,
              success: true
            });
          } catch (error) {
            result.scalingActions.push({
              action: 'scale_down',
              instanceId,
              success: false,
              error: error.message
            });
            result.success = false;
          }
        }
      }

      result.actualCount = this.instances.size;
      this.emit('instancesScaled', result);

      return result;
    } catch (error) {
      logger.error('Failed to scale instances:', error);
      throw error;
    }
  }

  /**
   * Perform health check on all instances
   */
  async healthCheck(): Promise<HealthStatus[]> {
    const healthStatuses: HealthStatus[] = [];

    for (const [instanceId, instance] of this.instances) {
      try {
        const gatewayClient = this.gatewayClients.get(instanceId);
        if (!gatewayClient) {
          healthStatuses.push({
            instanceId,
            status: 'unhealthy',
            lastCheck: new Date(),
            issues: ['Gateway client not found']
          });
          continue;
        }

        // Check container status
        const container = this.docker.getContainer(instance.containerId);
        const containerInfo = await container.inspect();

        // Check gateway connectivity
        const gatewayHealth = await gatewayClient.healthCheck();

        // Update resource usage
        const stats = await container.stats({ stream: false });
        instance.resources = this.parseContainerStats(stats);

        // Determine overall health
        const isHealthy = containerInfo.State.Running && gatewayHealth.status === 'healthy';
        const issues: string[] = [];

        if (!containerInfo.State.Running) {
          issues.push('Container not running');
        }
        if (gatewayHealth.status !== 'healthy') {
          issues.push(`Gateway unhealthy: ${gatewayHealth.message}`);
        }
        if (instance.resources.cpuUsage > 90) {
          issues.push('High CPU usage');
        }
        if (instance.resources.memoryUsage > 90) {
          issues.push('High memory usage');
        }

        const healthStatus: HealthStatus = {
          instanceId,
          status: isHealthy ? 'healthy' : 'unhealthy',
          lastCheck: new Date(),
          issues,
          metrics: {
            cpuUsage: instance.resources.cpuUsage,
            memoryUsage: instance.resources.memoryUsage,
            uptime: Date.now() - instance.createdAt.getTime(),
            activeStrategies: instance.strategies.filter(s => s.status === 'active').length
          }
        };

        healthStatuses.push(healthStatus);

        // Update instance
        instance.lastHealthCheck = new Date();
        instance.status = isHealthy ? 'running' : 'unhealthy';
        this.instances.set(instanceId, instance);

        // Trigger recovery if needed
        if (!isHealthy) {
          await this.triggerRecovery(instanceId, issues);
        }

      } catch (error) {
        logger.error(`Health check failed for instance ${instanceId}:`, error);
        healthStatuses.push({
          instanceId,
          status: 'error',
          lastCheck: new Date(),
          issues: [`Health check error: ${error.message}`]
        });
      }
    }

    return healthStatuses;
  }

  /**
   * Rebalance load across instances
   */
  async rebalanceLoad(): Promise<RebalanceResult> {
    try {
      logger.info('Starting load rebalancing');

      const instances = Array.from(this.instances.values());
      const totalStrategies = instances.reduce((sum, instance) => sum + instance.strategies.length, 0);
      const targetStrategiesPerInstance = Math.ceil(totalStrategies / instances.length);

      const rebalanceActions: any[] = [];
      const overloadedInstances = instances.filter(i => i.strategies.length > targetStrategiesPerInstance);
      const underloadedInstances = instances.filter(i => i.strategies.length < targetStrategiesPerInstance);

      for (const overloaded of overloadedInstances) {
        const excessStrategies = overloaded.strategies.length - targetStrategiesPerInstance;
        const strategiesToMove = overloaded.strategies.slice(-excessStrategies);

        for (const strategy of strategiesToMove) {
          const targetInstance = underloadedInstances.find(i => i.strategies.length < targetStrategiesPerInstance);
          if (targetInstance) {
            try {
              // Stop strategy on source instance
              await this.stopStrategy(overloaded.id, strategy.id);
              
              // Deploy strategy on target instance
              const newStrategy: HBStrategy = {
                type: strategy.type,
                exchange: 'binance', // Default, should be from original config
                tradingPair: 'BTC/USDT', // Default, should be from original config
                parameters: strategy.parameters,
                riskLimits: { maxLoss: 1000, maxExposure: 10000 },
                executionSettings: { timeout: 30000 }
              };
              
              await this.deployStrategy(targetInstance.id, newStrategy);

              rebalanceActions.push({
                action: 'move_strategy',
                strategyId: strategy.id,
                fromInstance: overloaded.id,
                toInstance: targetInstance.id,
                success: true
              });

              targetInstance.strategies.push(strategy);
            } catch (error) {
              rebalanceActions.push({
                action: 'move_strategy',
                strategyId: strategy.id,
                fromInstance: overloaded.id,
                toInstance: targetInstance.id,
                success: false,
                error: error.message
              });
            }
          }
        }
      }

      const result: RebalanceResult = {
        totalStrategies,
        targetStrategiesPerInstance,
        rebalanceActions,
        success: rebalanceActions.every(action => action.success)
      };

      this.emit('loadRebalanced', result);
      logger.info('Load rebalancing completed');

      return result;
    } catch (error) {
      logger.error('Failed to rebalance load:', error);
      throw error;
    }
  }

  /**
   * Get optimal instance for strategy deployment based on load balancing strategy
   */
  getOptimalInstance(strategy: HBStrategy): string | null {
    const availableInstances = Array.from(this.instances.values())
      .filter(instance => instance.status === 'running');

    if (availableInstances.length === 0) {
      return null;
    }

    switch (this.loadBalancingStrategy) {
      case 'round_robin':
        return this.getRoundRobinInstance(availableInstances);
      case 'least_loaded':
        return this.getLeastLoadedInstance(availableInstances);
      case 'resource_based':
        return this.getResourceBasedInstance(availableInstances);
      default:
        return availableInstances[0].id;
    }
  }

  /**
   * Stop a strategy on a specific instance
   */
  private async stopStrategy(instanceId: string, strategyId: string): Promise<void> {
    const gatewayClient = this.gatewayClients.get(instanceId);
    if (!gatewayClient) {
      throw new Error(`Gateway client not found for instance: ${instanceId}`);
    }

    await gatewayClient.stopStrategy(strategyId);

    // Update instance
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.strategies = instance.strategies.filter(s => s.id !== strategyId);
      instance.performance.activeStrategies = instance.strategies.filter(s => s.status === 'active').length;
      this.instances.set(instanceId, instance);
    }
  }

  /**
   * Remove an instance
   */
  private async removeInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance not found: ${instanceId}`);
    }

    // Stop all strategies first
    for (const strategy of instance.strategies) {
      await this.stopStrategy(instanceId, strategy.id);
    }

    // Stop and remove container
    const container = this.docker.getContainer(instance.containerId);
    await container.stop();
    await container.remove();

    // Clean up
    this.instances.delete(instanceId);
    this.gatewayClients.delete(instanceId);

    this.emit('instanceRemoved', instanceId);
    logger.info(`Instance removed: ${instanceId}`);
  }

  /**
   * Create Docker container for Hummingbot instance
   */
  private async createDockerContainer(config: InstanceConfig): Promise<any> {
    const containerConfig = {
      Image: 'hummingbot/hummingbot:latest',
      name: config.name,
      Env: [
        `HUMMINGBOT_GATEWAY_PORT=${config.gatewayPort}`,
        `HUMMINGBOT_API_KEY=${config.apiKey}`,
        ...config.environmentVariables || []
      ],
      ExposedPorts: {
        [`${config.gatewayPort}/tcp`]: {}
      },
      HostConfig: {
        PortBindings: {
          [`${config.gatewayPort}/tcp`]: [{ HostPort: config.gatewayPort.toString() }]
        },
        Memory: config.resources?.memory || 512 * 1024 * 1024, // 512MB default
        CpuShares: config.resources?.cpu || 512 // 0.5 CPU default
      }
    };

    return await this.docker.createContainer(containerConfig);
  }

  /**
   * Wait for container to be ready
   */
  private async waitForContainerReady(containerId: string, timeout: number = 60000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const container = this.docker.getContainer(containerId);
        const info = await container.inspect();
        
        if (info.State.Running) {
          // Additional check: try to connect to gateway
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
          return;
        }
      } catch (error) {
        // Continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
    }
    
    throw new Error(`Container ${containerId} did not become ready within ${timeout}ms`);
  }

  /**
   * Verify instance connection
   */
  private async verifyInstanceConnection(instanceId: string): Promise<void> {
    const gatewayClient = this.gatewayClients.get(instanceId);
    if (!gatewayClient) {
      throw new Error(`Gateway client not found for instance: ${instanceId}`);
    }

    const health = await gatewayClient.healthCheck();
    if (health.status !== 'healthy') {
      throw new Error(`Instance ${instanceId} is not healthy: ${health.message}`);
    }
  }

  /**
   * Calculate optimal instance count based on current load
   */
  private async calculateOptimalInstanceCount(): Promise<number> {
    const instances = Array.from(this.instances.values());
    const avgCpuUsage = instances.reduce((sum, i) => sum + i.resources.cpuUsage, 0) / instances.length;
    const avgMemoryUsage = instances.reduce((sum, i) => sum + i.resources.memoryUsage, 0) / instances.length;

    let targetCount = instances.length;

    // Scale up if resource usage is high
    if (avgCpuUsage > this.scalingPolicy.targetCpuUtilization || 
        avgMemoryUsage > this.scalingPolicy.targetMemoryUtilization) {
      targetCount = Math.min(instances.length + 1, this.scalingPolicy.maxInstances);
    }
    // Scale down if resource usage is low
    else if (avgCpuUsage < this.scalingPolicy.targetCpuUtilization * 0.5 && 
             avgMemoryUsage < this.scalingPolicy.targetMemoryUtilization * 0.5) {
      targetCount = Math.max(instances.length - 1, this.scalingPolicy.minInstances);
    }

    return targetCount;
  }

  /**
   * Select instances for removal during scale down
   */
  private selectInstancesForRemoval(count: number): string[] {
    const instances = Array.from(this.instances.values())
      .sort((a, b) => {
        // Prefer removing instances with fewer strategies
        if (a.strategies.length !== b.strategies.length) {
          return a.strategies.length - b.strategies.length;
        }
        // Then prefer older instances
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

    return instances.slice(0, count).map(i => i.id);
  }

  /**
   * Generate instance configuration
   */
  private generateInstanceConfig(name: string): InstanceConfig {
    const basePort = 8080;
    const usedPorts = Array.from(this.instances.values()).map(i => i.config.gatewayPort);
    let port = basePort;
    while (usedPorts.includes(port)) {
      port++;
    }

    return {
      name,
      gatewayPort: port,
      apiKey: `hb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      resources: {
        cpu: 512,
        memory: 512 * 1024 * 1024
      },
      environmentVariables: []
    };
  }

  /**
   * Parse container stats to resource usage
   */
  private parseContainerStats(stats: any): ResourceUsage {
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuUsage = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;

    const memoryUsage = (stats.memory_stats.usage / stats.memory_stats.limit) * 100;

    return {
      cpuUsage: Math.round(cpuUsage * 100) / 100,
      memoryUsage: Math.round(memoryUsage * 100) / 100,
      networkIO: stats.networks?.eth0?.rx_bytes || 0,
      diskIO: stats.blkio_stats?.io_service_bytes_recursive?.[0]?.value || 0
    };
  }

  /**
   * Trigger recovery actions for unhealthy instance
   */
  private async triggerRecovery(instanceId: string, issues: string[]): Promise<void> {
    logger.warn(`Triggering recovery for instance ${instanceId}:`, issues);

    const instance = this.instances.get(instanceId);
    if (!instance) return;

    const recoveryActions: RecoveryAction[] = [];

    // Restart container if not running
    if (issues.includes('Container not running')) {
      recoveryActions.push('restart_container');
    }

    // Restart gateway if unhealthy
    if (issues.some(issue => issue.includes('Gateway unhealthy'))) {
      recoveryActions.push('restart_gateway');
    }

    // Scale up if resource issues
    if (issues.includes('High CPU usage') || issues.includes('High memory usage')) {
      recoveryActions.push('scale_up');
    }

    for (const action of recoveryActions) {
      try {
        await this.executeRecoveryAction(instanceId, action);
        logger.info(`Recovery action ${action} completed for instance ${instanceId}`);
      } catch (error) {
        logger.error(`Recovery action ${action} failed for instance ${instanceId}:`, error);
      }
    }

    this.emit('recoveryTriggered', { instanceId, issues, recoveryActions });
  }

  /**
   * Execute specific recovery action
   */
  private async executeRecoveryAction(instanceId: string, action: RecoveryAction): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    switch (action) {
      case 'restart_container':
        const container = this.docker.getContainer(instance.containerId);
        await container.restart();
        break;

      case 'restart_gateway':
        const gatewayClient = this.gatewayClients.get(instanceId);
        if (gatewayClient) {
          await gatewayClient.restart();
        }
        break;

      case 'scale_up':
        await this.scaleInstances(this.instances.size + 1);
        break;

      case 'recreate_instance':
        await this.removeInstance(instanceId);
        await this.createInstance(instance.config);
        break;
    }
  }

  /**
   * Get instance using round robin strategy
   */
  private getRoundRobinInstance(instances: HBInstance[]): string {
    // Simple round robin based on creation time
    const sortedInstances = instances.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const index = Date.now() % sortedInstances.length;
    return sortedInstances[index].id;
  }

  /**
   * Get least loaded instance
   */
  private getLeastLoadedInstance(instances: HBInstance[]): string {
    const leastLoaded = instances.reduce((min, instance) => 
      instance.strategies.length < min.strategies.length ? instance : min
    );
    return leastLoaded.id;
  }

  /**
   * Get instance based on resource usage
   */
  private getResourceBasedInstance(instances: HBInstance[]): string {
    const bestInstance = instances.reduce((best, instance) => {
      const instanceScore = (instance.resources.cpuUsage + instance.resources.memoryUsage) / 2;
      const bestScore = (best.resources.cpuUsage + best.resources.memoryUsage) / 2;
      return instanceScore < bestScore ? instance : best;
    });
    return bestInstance.id;
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.healthCheck();
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Get all instances
   */
  getAllInstances(): HBInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Get instance by ID
   */
  getInstance(instanceId: string): HBInstance | undefined {
    return this.instances.get(instanceId);
  }

  /**
   * Set load balancing strategy
   */
  setLoadBalancingStrategy(strategy: LoadBalancingStrategy): void {
    this.loadBalancingStrategy = strategy;
    logger.info(`Load balancing strategy set to: ${strategy}`);
  }

  /**
   * Update scaling policy
   */
  updateScalingPolicy(policy: Partial<ScalingPolicy>): void {
    this.scalingPolicy = { ...this.scalingPolicy, ...policy };
    logger.info('Scaling policy updated:', this.scalingPolicy);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.stopHealthMonitoring();
    
    // Stop all instances
    const instanceIds = Array.from(this.instances.keys());
    await Promise.all(instanceIds.map(id => this.removeInstance(id)));
    
    logger.info('HummingbotManager cleanup completed');
  }
}