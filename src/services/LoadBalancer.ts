import { EventEmitter } from 'events';
import { 
  HBInstance, 
  HBStrategy, 
  LoadBalancingStrategy, 
  ResourceUsage,
  StrategyCoordination,
  LoadBalancingConfig
} from '../types/hummingbot';
import { logger } from '../utils/logger';

export interface LoadBalancingDecision {
  selectedInstance: string;
  reason: string;
  confidence: number;
  alternatives: Array<{
    instanceId: string;
    score: number;
    reason: string;
  }>;
}

export interface LoadMetrics {
  instanceId: string;
  cpuLoad: number;
  memoryLoad: number;
  networkLoad: number;
  strategyCount: number;
  responseTime: number;
  errorRate: number;
  healthScore: number;
  capacity: number;
}

export class LoadBalancer extends EventEmitter {
  private strategy: LoadBalancingStrategy;
  private config: LoadBalancingConfig;
  private instanceMetrics: Map<string, LoadMetrics> = new Map();
  private roundRobinIndex: number = 0;
  private weights: Map<string, number> = new Map();

  constructor(
    strategy: LoadBalancingStrategy = 'round_robin',
    config: LoadBalancingConfig = {
      algorithm: 'round_robin',
      healthCheckEnabled: true,
      healthCheckInterval: 30000,
      failoverEnabled: true,
      failoverThreshold: 3,
      sessionAffinity: false
    }
  ) {
    super();
    this.strategy = strategy;
    this.config = config;
  }

  /**
   * Select the best instance for strategy deployment
   */
  selectInstance(
    availableInstances: HBInstance[],
    strategy: HBStrategy,
    constraints?: StrategyCoordination
  ): LoadBalancingDecision {
    try {
      // Filter healthy instances
      const healthyInstances = this.filterHealthyInstances(availableInstances);
      
      if (healthyInstances.length === 0) {
        throw new Error('No healthy instances available for load balancing');
      }

      // Apply constraints if provided
      const eligibleInstances = constraints 
        ? this.applyConstraints(healthyInstances, constraints)
        : healthyInstances;

      if (eligibleInstances.length === 0) {
        throw new Error('No instances meet the specified constraints');
      }

      // Select instance based on strategy
      const decision = this.executeLoadBalancingStrategy(eligibleInstances, strategy);

      this.emit('instanceSelected', {
        strategy: this.strategy,
        selectedInstance: decision.selectedInstance,
        totalInstances: availableInstances.length,
        eligibleInstances: eligibleInstances.length
      });

      return decision;

    } catch (error) {
      logger.error('Load balancing failed:', error);
      throw error;
    }
  }

  /**
   * Update metrics for an instance
   */
  updateInstanceMetrics(instanceId: string, metrics: Partial<LoadMetrics>): void {
    const existingMetrics = this.instanceMetrics.get(instanceId) || {
      instanceId,
      cpuLoad: 0,
      memoryLoad: 0,
      networkLoad: 0,
      strategyCount: 0,
      responseTime: 0,
      errorRate: 0,
      healthScore: 100,
      capacity: 100
    };

    const updatedMetrics = { ...existingMetrics, ...metrics };
    this.instanceMetrics.set(instanceId, updatedMetrics);

    this.emit('metricsUpdated', { instanceId, metrics: updatedMetrics });
  }

  /**
   * Get current load distribution
   */
  getLoadDistribution(): Map<string, LoadMetrics> {
    return new Map(this.instanceMetrics);
  }

  /**
   * Rebalance strategies across instances
   */
  async rebalanceStrategies(instances: HBInstance[]): Promise<{
    recommendations: Array<{
      strategyId: string;
      fromInstance: string;
      toInstance: string;
      reason: string;
      priority: number;
    }>;
    expectedImprovement: number;
  }> {
    try {
      const recommendations: Array<{
        strategyId: string;
        fromInstance: string;
        toInstance: string;
        reason: string;
        priority: number;
      }> = [];

      // Calculate current load imbalance
      const loadImbalance = this.calculateLoadImbalance(instances);
      
      if (loadImbalance < 0.2) { // Less than 20% imbalance
        return { recommendations: [], expectedImprovement: 0 };
      }

      // Find overloaded and underloaded instances
      const overloadedInstances = instances.filter(instance => {
        const metrics = this.instanceMetrics.get(instance.id);
        return metrics && this.calculateInstanceLoad(metrics) > 80; // 80% threshold
      });

      const underloadedInstances = instances.filter(instance => {
        const metrics = this.instanceMetrics.get(instance.id);
        return metrics && this.calculateInstanceLoad(metrics) < 50; // 50% threshold
      });

      // Generate rebalancing recommendations
      for (const overloaded of overloadedInstances) {
        const strategiesToMove = this.selectStrategiesForMigration(overloaded);
        
        for (const strategy of strategiesToMove) {
          const targetInstance = this.findBestTargetInstance(
            underloadedInstances,
            strategy,
            overloaded.id
          );

          if (targetInstance) {
            recommendations.push({
              strategyId: strategy.id,
              fromInstance: overloaded.id,
              toInstance: targetInstance.id,
              reason: `Rebalance from overloaded instance (${this.calculateInstanceLoad(this.instanceMetrics.get(overloaded.id)!)}%) to underloaded instance (${this.calculateInstanceLoad(this.instanceMetrics.get(targetInstance.id)!)}%)`,
              priority: this.calculateMigrationPriority(strategy, overloaded, targetInstance)
            });
          }
        }
      }

      // Sort recommendations by priority
      recommendations.sort((a, b) => b.priority - a.priority);

      const expectedImprovement = this.calculateExpectedImprovement(recommendations, instances);

      this.emit('rebalanceRecommendations', {
        recommendationCount: recommendations.length,
        expectedImprovement,
        loadImbalance
      });

      return { recommendations, expectedImprovement };

    } catch (error) {
      logger.error('Strategy rebalancing failed:', error);
      throw error;
    }
  }

  /**
   * Set instance weights for weighted load balancing
   */
  setInstanceWeights(weights: Map<string, number>): void {
    this.weights = new Map(weights);
    logger.info('Instance weights updated:', Object.fromEntries(weights));
  }

  /**
   * Update load balancing strategy
   */
  setStrategy(strategy: LoadBalancingStrategy): void {
    this.strategy = strategy;
    this.emit('strategyChanged', strategy);
    logger.info(`Load balancing strategy changed to: ${strategy}`);
  }

  /**
   * Update load balancing configuration
   */
  updateConfig(config: Partial<LoadBalancingConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('configUpdated', this.config);
    logger.info('Load balancing configuration updated');
  }

  /**
   * Get load balancing statistics
   */
  getStatistics(): {
    strategy: LoadBalancingStrategy;
    totalRequests: number;
    averageResponseTime: number;
    failoverCount: number;
    instanceDistribution: Record<string, number>;
    healthyInstances: number;
    totalInstances: number;
  } {
    const instanceDistribution: Record<string, number> = {};
    let totalRequests = 0;
    let totalResponseTime = 0;
    let healthyInstances = 0;

    for (const [instanceId, metrics] of this.instanceMetrics) {
      instanceDistribution[instanceId] = metrics.strategyCount;
      totalRequests += metrics.strategyCount;
      totalResponseTime += metrics.responseTime;
      if (metrics.healthScore > 70) healthyInstances++;
    }

    return {
      strategy: this.strategy,
      totalRequests,
      averageResponseTime: totalRequests > 0 ? totalResponseTime / this.instanceMetrics.size : 0,
      failoverCount: 0, // TODO: Track failover count
      instanceDistribution,
      healthyInstances,
      totalInstances: this.instanceMetrics.size
    };
  }

  /**
   * Execute the selected load balancing strategy
   */
  private executeLoadBalancingStrategy(
    instances: HBInstance[],
    strategy: HBStrategy
  ): LoadBalancingDecision {
    switch (this.strategy) {
      case 'round_robin':
        return this.roundRobinSelection(instances);
      
      case 'least_loaded':
        return this.leastLoadedSelection(instances);
      
      case 'resource_based':
        return this.resourceBasedSelection(instances, strategy);
      
      default:
        return this.roundRobinSelection(instances);
    }
  }

  /**
   * Round robin instance selection
   */
  private roundRobinSelection(instances: HBInstance[]): LoadBalancingDecision {
    const selectedInstance = instances[this.roundRobinIndex % instances.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % instances.length;

    const alternatives = instances
      .filter(instance => instance.id !== selectedInstance.id)
      .map((instance, index) => ({
        instanceId: instance.id,
        score: instances.length - index,
        reason: `Round robin alternative #${index + 1}`
      }));

    return {
      selectedInstance: selectedInstance.id,
      reason: `Round robin selection (index: ${this.roundRobinIndex - 1})`,
      confidence: 0.8,
      alternatives
    };
  }

  /**
   * Least loaded instance selection
   */
  private leastLoadedSelection(instances: HBInstance[]): LoadBalancingDecision {
    const instanceLoads = instances.map(instance => {
      const metrics = this.instanceMetrics.get(instance.id);
      const load = metrics ? this.calculateInstanceLoad(metrics) : 0;
      return { instance, load };
    });

    instanceLoads.sort((a, b) => a.load - b.load);
    const selectedInstance = instanceLoads[0].instance;

    const alternatives = instanceLoads
      .slice(1)
      .map((item, index) => ({
        instanceId: item.instance.id,
        score: 100 - item.load,
        reason: `Load: ${item.load.toFixed(1)}%`
      }));

    return {
      selectedInstance: selectedInstance.id,
      reason: `Least loaded instance (load: ${instanceLoads[0].load.toFixed(1)}%)`,
      confidence: 0.9,
      alternatives
    };
  }

  /**
   * Resource-based instance selection
   */
  private resourceBasedSelection(instances: HBInstance[], strategy: HBStrategy): LoadBalancingDecision {
    const resourceScores = instances.map(instance => {
      const metrics = this.instanceMetrics.get(instance.id);
      if (!metrics) {
        return { instance, score: 0, details: 'No metrics available' };
      }

      // Calculate resource score based on strategy requirements
      const cpuScore = Math.max(0, 100 - metrics.cpuLoad);
      const memoryScore = Math.max(0, 100 - metrics.memoryLoad);
      const networkScore = Math.max(0, 100 - metrics.networkLoad);
      const healthScore = metrics.healthScore;
      const capacityScore = metrics.capacity;

      // Weight scores based on strategy type
      let weightedScore = 0;
      switch (strategy.type) {
        case 'grid_trading':
          // Grid trading needs good CPU and network
          weightedScore = cpuScore * 0.4 + networkScore * 0.3 + healthScore * 0.2 + capacityScore * 0.1;
          break;
        case 'arbitrage':
          // Arbitrage needs excellent network and response time
          weightedScore = networkScore * 0.5 + cpuScore * 0.2 + healthScore * 0.2 + capacityScore * 0.1;
          break;
        case 'pure_market_making':
          // Market making needs balanced resources
          weightedScore = (cpuScore + memoryScore + networkScore + healthScore) / 4;
          break;
        default:
          weightedScore = (cpuScore + memoryScore + networkScore + healthScore + capacityScore) / 5;
      }

      return {
        instance,
        score: weightedScore,
        details: `CPU: ${cpuScore.toFixed(1)}, Memory: ${memoryScore.toFixed(1)}, Network: ${networkScore.toFixed(1)}, Health: ${healthScore.toFixed(1)}`
      };
    });

    resourceScores.sort((a, b) => b.score - a.score);
    const selectedInstance = resourceScores[0].instance;

    const alternatives = resourceScores
      .slice(1)
      .map(item => ({
        instanceId: item.instance.id,
        score: item.score,
        reason: item.details
      }));

    return {
      selectedInstance: selectedInstance.id,
      reason: `Best resource match for ${strategy.type} (score: ${resourceScores[0].score.toFixed(1)})`,
      confidence: 0.95,
      alternatives
    };
  }

  /**
   * Filter healthy instances
   */
  private filterHealthyInstances(instances: HBInstance[]): HBInstance[] {
    return instances.filter(instance => {
      if (instance.status !== 'running') return false;
      
      const metrics = this.instanceMetrics.get(instance.id);
      if (!metrics) return true; // Assume healthy if no metrics yet
      
      return metrics.healthScore > 50 && metrics.errorRate < 10;
    });
  }

  /**
   * Apply constraints to instance selection
   */
  private applyConstraints(
    instances: HBInstance[],
    constraints: StrategyCoordination
  ): HBInstance[] {
    return instances.filter(instance => {
      // Check resource allocation constraints
      if (constraints.resourceAllocation) {
        const metrics = this.instanceMetrics.get(instance.id);
        if (metrics) {
          const currentLoad = this.calculateInstanceLoad(metrics);
          const requiredCapacity = constraints.resourceAllocation.cpuAllocation || 0;
          if (currentLoad + requiredCapacity > 90) return false;
        }
      }

      // Check other constraints
      for (const constraint of constraints.constraints || []) {
        if (!this.evaluateConstraint(instance, constraint)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Evaluate a single constraint
   */
  private evaluateConstraint(instance: HBInstance, constraint: any): boolean {
    // Implementation depends on constraint types
    // This is a simplified version
    switch (constraint.type) {
      case 'resource':
        const metrics = this.instanceMetrics.get(instance.id);
        if (metrics && constraint.constraint === 'max_cpu') {
          return metrics.cpuLoad <= constraint.value;
        }
        break;
      case 'market':
        // Check if instance supports the required market
        return true; // Simplified
      default:
        return true;
    }
    return true;
  }

  /**
   * Calculate overall load for an instance
   */
  private calculateInstanceLoad(metrics: LoadMetrics): number {
    return (metrics.cpuLoad + metrics.memoryLoad + metrics.networkLoad) / 3;
  }

  /**
   * Calculate load imbalance across instances
   */
  private calculateLoadImbalance(instances: HBInstance[]): number {
    const loads = instances.map(instance => {
      const metrics = this.instanceMetrics.get(instance.id);
      return metrics ? this.calculateInstanceLoad(metrics) : 0;
    });

    if (loads.length === 0) return 0;

    const maxLoad = Math.max(...loads);
    const minLoad = Math.min(...loads);
    const avgLoad = loads.reduce((sum, load) => sum + load, 0) / loads.length;

    return avgLoad > 0 ? (maxLoad - minLoad) / avgLoad : 0;
  }

  /**
   * Select strategies for migration from overloaded instance
   */
  private selectStrategiesForMigration(instance: HBInstance): any[] {
    // Sort strategies by resource usage and select least critical ones
    return instance.strategies
      .filter(strategy => strategy.status === 'active')
      .sort((a, b) => {
        // Prefer moving strategies with lower performance impact
        return (a.performance?.totalTrades || 0) - (b.performance?.totalTrades || 0);
      })
      .slice(0, Math.ceil(instance.strategies.length * 0.3)); // Move up to 30% of strategies
  }

  /**
   * Find best target instance for strategy migration
   */
  private findBestTargetInstance(
    candidates: HBInstance[],
    strategy: any,
    excludeInstanceId: string
  ): HBInstance | null {
    const eligibleCandidates = candidates.filter(instance => instance.id !== excludeInstanceId);
    
    if (eligibleCandidates.length === 0) return null;

    // Use resource-based selection for migration target
    const mockStrategy: HBStrategy = {
      type: 'pure_market_making', // Default type
      exchange: 'binance',
      tradingPair: 'BTC/USDT',
      parameters: {},
      riskLimits: { maxLoss: 1000, maxExposure: 10000 },
      executionSettings: { timeout: 30000 }
    };

    const decision = this.resourceBasedSelection(eligibleCandidates, mockStrategy);
    return eligibleCandidates.find(instance => instance.id === decision.selectedInstance) || null;
  }

  /**
   * Calculate migration priority
   */
  private calculateMigrationPriority(
    strategy: any,
    fromInstance: HBInstance,
    toInstance: HBInstance
  ): number {
    const fromMetrics = this.instanceMetrics.get(fromInstance.id);
    const toMetrics = this.instanceMetrics.get(toInstance.id);

    if (!fromMetrics || !toMetrics) return 0;

    const fromLoad = this.calculateInstanceLoad(fromMetrics);
    const toLoad = this.calculateInstanceLoad(toMetrics);
    const loadDifference = fromLoad - toLoad;

    // Higher priority for larger load differences
    return Math.max(0, loadDifference);
  }

  /**
   * Calculate expected improvement from rebalancing
   */
  private calculateExpectedImprovement(
    recommendations: any[],
    instances: HBInstance[]
  ): number {
    if (recommendations.length === 0) return 0;

    const currentImbalance = this.calculateLoadImbalance(instances);
    
    // Estimate improvement based on number of migrations and load differences
    const totalPriority = recommendations.reduce((sum, rec) => sum + rec.priority, 0);
    const avgPriority = totalPriority / recommendations.length;
    
    // Simplified calculation - in practice, this would be more sophisticated
    return Math.min(currentImbalance * 0.5, avgPriority * 0.1);
  }
}