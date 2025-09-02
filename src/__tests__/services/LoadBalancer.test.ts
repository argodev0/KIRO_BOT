import { LoadBalancer } from '../../services/LoadBalancer';
import { 
  HBInstance, 
  HBStrategy, 
  LoadBalancingStrategy, 
  LoadBalancingConfig,
  StrategyCoordination
} from '../../types/hummingbot';

describe('LoadBalancer', () => {
  let loadBalancer: LoadBalancer;
  let mockInstances: HBInstance[];
  let mockStrategy: HBStrategy;

  beforeEach(() => {
    const config: LoadBalancingConfig = {
      algorithm: 'round_robin',
      healthCheckEnabled: true,
      healthCheckInterval: 30000,
      failoverEnabled: true,
      failoverThreshold: 3,
      sessionAffinity: false
    };

    loadBalancer = new LoadBalancer('round_robin', config);

    // Create mock instances
    mockInstances = [
      {
        id: 'instance-1',
        name: 'hummingbot-1',
        status: 'running',
        containerId: 'container-1',
        config: {
          name: 'hummingbot-1',
          gatewayPort: 8080,
          apiKey: 'key-1'
        },
        strategies: [],
        resources: {
          cpuUsage: 30,
          memoryUsage: 40,
          networkIO: 1000,
          diskIO: 500
        },
        performance: {
          uptime: 3600000,
          totalStrategies: 2,
          activeStrategies: 1,
          totalTrades: 100,
          avgLatency: 50,
          errorRate: 1
        },
        createdAt: new Date(Date.now() - 3600000),
        lastHealthCheck: new Date()
      },
      {
        id: 'instance-2',
        name: 'hummingbot-2',
        status: 'running',
        containerId: 'container-2',
        config: {
          name: 'hummingbot-2',
          gatewayPort: 8081,
          apiKey: 'key-2'
        },
        strategies: [
          {
            id: 'strategy-1',
            type: 'pure_market_making',
            status: 'active',
            parameters: {},
            deployedAt: new Date(),
            performance: {
              totalTrades: 50,
              totalVolume: 10000,
              totalPnL: 100,
              avgLatency: 60,
              fillRate: 95,
              errorCount: 2
            }
          }
        ],
        resources: {
          cpuUsage: 60,
          memoryUsage: 70,
          networkIO: 2000,
          diskIO: 1000
        },
        performance: {
          uptime: 7200000,
          totalStrategies: 3,
          activeStrategies: 2,
          totalTrades: 200,
          avgLatency: 60,
          errorRate: 2
        },
        createdAt: new Date(Date.now() - 7200000),
        lastHealthCheck: new Date()
      },
      {
        id: 'instance-3',
        name: 'hummingbot-3',
        status: 'running',
        containerId: 'container-3',
        config: {
          name: 'hummingbot-3',
          gatewayPort: 8082,
          apiKey: 'key-3'
        },
        strategies: [],
        resources: {
          cpuUsage: 20,
          memoryUsage: 30,
          networkIO: 500,
          diskIO: 250
        },
        performance: {
          uptime: 1800000,
          totalStrategies: 1,
          activeStrategies: 0,
          totalTrades: 25,
          avgLatency: 40,
          errorRate: 0.5
        },
        createdAt: new Date(Date.now() - 1800000),
        lastHealthCheck: new Date()
      }
    ];

    mockStrategy = {
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

    // Update metrics for all instances
    mockInstances.forEach(instance => {
      loadBalancer.updateInstanceMetrics(instance.id, {
        instanceId: instance.id,
        cpuLoad: instance.resources.cpuUsage,
        memoryLoad: instance.resources.memoryUsage,
        networkLoad: (instance.resources.networkIO / 10000) * 100, // Convert to percentage
        strategyCount: instance.strategies.length,
        responseTime: instance.performance.avgLatency,
        errorRate: instance.performance.errorRate,
        healthScore: 100 - instance.performance.errorRate * 10,
        capacity: 100 - Math.max(instance.resources.cpuUsage, instance.resources.memoryUsage)
      });
    });
  });

  describe('Instance Selection', () => {
    test('should select instance using round robin strategy', () => {
      loadBalancer.setStrategy('round_robin');

      const decision1 = loadBalancer.selectInstance(mockInstances, mockStrategy);
      const decision2 = loadBalancer.selectInstance(mockInstances, mockStrategy);
      const decision3 = loadBalancer.selectInstance(mockInstances, mockStrategy);
      const decision4 = loadBalancer.selectInstance(mockInstances, mockStrategy);

      expect(decision1.selectedInstance).toBeDefined();
      expect(decision2.selectedInstance).toBeDefined();
      expect(decision3.selectedInstance).toBeDefined();
      expect(decision4.selectedInstance).toBeDefined();

      // Should cycle through instances
      expect(decision1.selectedInstance).not.toBe(decision2.selectedInstance);
      expect(decision2.selectedInstance).not.toBe(decision3.selectedInstance);
      expect(decision4.selectedInstance).toBe(decision1.selectedInstance); // Should cycle back
    });

    test('should select instance using least loaded strategy', () => {
      loadBalancer.setStrategy('least_loaded');

      const decision = loadBalancer.selectInstance(mockInstances, mockStrategy);

      // Should select instance-3 as it has the least strategies (0)
      expect(decision.selectedInstance).toBe('instance-3');
      expect(decision.reason).toContain('Least loaded');
      expect(decision.confidence).toBeGreaterThan(0.8);
    });

    test('should select instance using resource-based strategy', () => {
      loadBalancer.setStrategy('resource_based');

      const decision = loadBalancer.selectInstance(mockInstances, mockStrategy);

      // Should select instance with best resource availability
      expect(decision.selectedInstance).toBeDefined();
      expect(decision.reason).toContain('Best resource match');
      expect(decision.confidence).toBeGreaterThan(0.9);
      expect(decision.alternatives).toBeDefined();
    });

    test('should handle different strategy types for resource-based selection', () => {
      loadBalancer.setStrategy('resource_based');

      const gridStrategy: HBStrategy = {
        ...mockStrategy,
        type: 'grid_trading'
      };

      const arbitrageStrategy: HBStrategy = {
        ...mockStrategy,
        type: 'arbitrage'
      };

      const gridDecision = loadBalancer.selectInstance(mockInstances, gridStrategy);
      const arbitrageDecision = loadBalancer.selectInstance(mockInstances, arbitrageStrategy);

      expect(gridDecision.selectedInstance).toBeDefined();
      expect(arbitrageDecision.selectedInstance).toBeDefined();
      expect(gridDecision.reason).toContain('grid_trading');
      expect(arbitrageDecision.reason).toContain('arbitrage');
    });

    test('should filter out unhealthy instances', () => {
      // Mark one instance as unhealthy
      const unhealthyInstances = [...mockInstances];
      unhealthyInstances[1].status = 'error';

      loadBalancer.updateInstanceMetrics('instance-2', {
        instanceId: 'instance-2',
        cpuLoad: 60,
        memoryLoad: 70,
        networkLoad: 20,
        strategyCount: 1,
        responseTime: 60,
        errorRate: 15, // High error rate
        healthScore: 30, // Low health score
        capacity: 30
      });

      const decision = loadBalancer.selectInstance(unhealthyInstances, mockStrategy);

      // Should not select the unhealthy instance
      expect(decision.selectedInstance).not.toBe('instance-2');
    });

    test('should throw error when no healthy instances available', () => {
      const unhealthyInstances = mockInstances.map(instance => ({
        ...instance,
        status: 'error' as const
      }));

      expect(() => {
        loadBalancer.selectInstance(unhealthyInstances, mockStrategy);
      }).toThrow('No healthy instances available');
    });

    test('should apply constraints when provided', () => {
      const constraints: StrategyCoordination = {
        strategyId: 'test-strategy',
        coordinationType: 'independent',
        priority: 1,
        resourceAllocation: {
          cpuAllocation: 50, // Requires 50% CPU
          memoryAllocation: 1024 * 1024 * 1024,
          networkBandwidth: 1000,
          storageAllocation: 1024 * 1024 * 1024,
          priority: 1
        },
        constraints: [
          {
            type: 'resource',
            constraint: 'max_cpu',
            value: 70,
            enforced: true
          }
        ]
      };

      const decision = loadBalancer.selectInstance(mockInstances, mockStrategy, constraints);

      // Should select an instance that meets the constraints
      expect(decision.selectedInstance).toBeDefined();
      
      // Should not select instance-2 which has 60% CPU + 50% required = 110% > 90% limit
      expect(decision.selectedInstance).not.toBe('instance-2');
    });

    test('should throw error when no instances meet constraints', () => {
      const strictConstraints: StrategyCoordination = {
        strategyId: 'test-strategy',
        coordinationType: 'independent',
        priority: 1,
        resourceAllocation: {
          cpuAllocation: 80, // Very high CPU requirement
          memoryAllocation: 1024 * 1024 * 1024,
          networkBandwidth: 1000,
          storageAllocation: 1024 * 1024 * 1024,
          priority: 1
        },
        constraints: []
      };

      expect(() => {
        loadBalancer.selectInstance(mockInstances, mockStrategy, strictConstraints);
      }).toThrow('No instances meet the specified constraints');
    });
  });

  describe('Metrics Management', () => {
    test('should update instance metrics', () => {
      const newMetrics = {
        instanceId: 'instance-1',
        cpuLoad: 45,
        memoryLoad: 55,
        networkLoad: 15,
        strategyCount: 3,
        responseTime: 75,
        errorRate: 2,
        healthScore: 85,
        capacity: 45
      };

      loadBalancer.updateInstanceMetrics('instance-1', newMetrics);

      const distribution = loadBalancer.getLoadDistribution();
      const updatedMetrics = distribution.get('instance-1');

      expect(updatedMetrics).toEqual(newMetrics);
    });

    test('should get current load distribution', () => {
      const distribution = loadBalancer.getLoadDistribution();

      expect(distribution.size).toBe(3);
      expect(distribution.has('instance-1')).toBe(true);
      expect(distribution.has('instance-2')).toBe(true);
      expect(distribution.has('instance-3')).toBe(true);
    });

    test('should emit metrics updated events', () => {
      const eventSpy = jest.fn();
      loadBalancer.on('metricsUpdated', eventSpy);

      const newMetrics = {
        cpuLoad: 50,
        memoryLoad: 60
      };

      loadBalancer.updateInstanceMetrics('instance-1', newMetrics);

      expect(eventSpy).toHaveBeenCalledWith({
        instanceId: 'instance-1',
        metrics: expect.objectContaining(newMetrics)
      });
    });
  });

  describe('Load Rebalancing', () => {
    test('should generate rebalancing recommendations', async () => {
      // Create imbalanced load by updating metrics
      loadBalancer.updateInstanceMetrics('instance-1', {
        instanceId: 'instance-1',
        cpuLoad: 90, // Overloaded
        memoryLoad: 85,
        networkLoad: 30,
        strategyCount: 5,
        responseTime: 100,
        errorRate: 3,
        healthScore: 70,
        capacity: 10
      });

      loadBalancer.updateInstanceMetrics('instance-3', {
        instanceId: 'instance-3',
        cpuLoad: 20, // Underloaded
        memoryLoad: 25,
        networkLoad: 5,
        strategyCount: 0,
        responseTime: 30,
        errorRate: 0.5,
        healthScore: 95,
        capacity: 75
      });

      const result = await loadBalancer.rebalanceStrategies(mockInstances);

      expect(result.recommendations).toBeDefined();
      expect(result.expectedImprovement).toBeGreaterThanOrEqual(0);

      if (result.recommendations.length > 0) {
        expect(result.recommendations[0]).toHaveProperty('strategyId');
        expect(result.recommendations[0]).toHaveProperty('fromInstance');
        expect(result.recommendations[0]).toHaveProperty('toInstance');
        expect(result.recommendations[0]).toHaveProperty('reason');
        expect(result.recommendations[0]).toHaveProperty('priority');
      }
    });

    test('should not recommend rebalancing when load is balanced', async () => {
      // All instances have similar load
      mockInstances.forEach((instance, index) => {
        loadBalancer.updateInstanceMetrics(instance.id, {
          instanceId: instance.id,
          cpuLoad: 50 + index * 2, // Similar CPU loads
          memoryLoad: 55 + index * 2,
          networkLoad: 10,
          strategyCount: 1,
          responseTime: 50,
          errorRate: 1,
          healthScore: 90,
          capacity: 45
        });
      });

      const result = await loadBalancer.rebalanceStrategies(mockInstances);

      expect(result.recommendations).toHaveLength(0);
      expect(result.expectedImprovement).toBe(0);
    });

    test('should emit rebalance recommendations events', async () => {
      const eventSpy = jest.fn();
      loadBalancer.on('rebalanceRecommendations', eventSpy);

      await loadBalancer.rebalanceStrategies(mockInstances);

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        recommendationCount: expect.any(Number),
        expectedImprovement: expect.any(Number),
        loadImbalance: expect.any(Number)
      }));
    });
  });

  describe('Configuration Management', () => {
    test('should set instance weights', () => {
      const weights = new Map([
        ['instance-1', 1.0],
        ['instance-2', 0.5],
        ['instance-3', 1.5]
      ]);

      expect(() => loadBalancer.setInstanceWeights(weights)).not.toThrow();
    });

    test('should update load balancing strategy', () => {
      const strategies: LoadBalancingStrategy[] = ['round_robin', 'least_loaded', 'resource_based'];

      strategies.forEach(strategy => {
        loadBalancer.setStrategy(strategy);
        // Verify strategy change doesn't break selection
        const decision = loadBalancer.selectInstance(mockInstances, mockStrategy);
        expect(decision.selectedInstance).toBeDefined();
      });
    });

    test('should update configuration', () => {
      const newConfig = {
        healthCheckInterval: 60000,
        failoverThreshold: 5
      };

      expect(() => loadBalancer.updateConfig(newConfig)).not.toThrow();
    });

    test('should emit strategy change events', () => {
      const eventSpy = jest.fn();
      loadBalancer.on('strategyChanged', eventSpy);

      loadBalancer.setStrategy('least_loaded');

      expect(eventSpy).toHaveBeenCalledWith('least_loaded');
    });

    test('should emit config update events', () => {
      const eventSpy = jest.fn();
      loadBalancer.on('configUpdated', eventSpy);

      const newConfig = { healthCheckInterval: 45000 };
      loadBalancer.updateConfig(newConfig);

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining(newConfig));
    });
  });

  describe('Statistics', () => {
    test('should get load balancing statistics', () => {
      const stats = loadBalancer.getStatistics();

      expect(stats).toHaveProperty('strategy');
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('averageResponseTime');
      expect(stats).toHaveProperty('failoverCount');
      expect(stats).toHaveProperty('instanceDistribution');
      expect(stats).toHaveProperty('healthyInstances');
      expect(stats).toHaveProperty('totalInstances');

      expect(stats.strategy).toBe('round_robin');
      expect(stats.totalInstances).toBe(3);
      expect(stats.healthyInstances).toBeGreaterThan(0);
    });

    test('should calculate correct instance distribution', () => {
      const stats = loadBalancer.getStatistics();

      expect(stats.instanceDistribution).toHaveProperty('instance-1');
      expect(stats.instanceDistribution).toHaveProperty('instance-2');
      expect(stats.instanceDistribution).toHaveProperty('instance-3');

      expect(stats.instanceDistribution['instance-1']).toBe(0); // No strategies
      expect(stats.instanceDistribution['instance-2']).toBe(1); // One strategy
      expect(stats.instanceDistribution['instance-3']).toBe(0); // No strategies
    });
  });

  describe('Error Handling', () => {
    test('should handle empty instance list', () => {
      expect(() => {
        loadBalancer.selectInstance([], mockStrategy);
      }).toThrow('No healthy instances available');
    });

    test('should handle invalid strategy type', () => {
      const invalidStrategy = {
        ...mockStrategy,
        type: 'invalid_strategy' as any
      };

      // Should still work with default handling
      const decision = loadBalancer.selectInstance(mockInstances, invalidStrategy);
      expect(decision.selectedInstance).toBeDefined();
    });

    test('should handle missing metrics gracefully', () => {
      const instancesWithoutMetrics = mockInstances.map(instance => ({
        ...instance,
        id: `new-${instance.id}` // Different IDs so no metrics exist
      }));

      // Should still work, assuming healthy if no metrics
      const decision = loadBalancer.selectInstance(instancesWithoutMetrics, mockStrategy);
      expect(decision.selectedInstance).toBeDefined();
    });

    test('should handle rebalancing with no strategies', async () => {
      const emptyInstances = mockInstances.map(instance => ({
        ...instance,
        strategies: []
      }));

      const result = await loadBalancer.rebalanceStrategies(emptyInstances);

      expect(result.recommendations).toHaveLength(0);
      expect(result.expectedImprovement).toBe(0);
    });
  });

  describe('Performance', () => {
    test('should handle large number of instances efficiently', () => {
      const manyInstances: HBInstance[] = [];
      
      for (let i = 0; i < 100; i++) {
        manyInstances.push({
          ...mockInstances[0],
          id: `instance-${i}`,
          name: `hummingbot-${i}`
        });
      }

      const startTime = Date.now();
      const decision = loadBalancer.selectInstance(manyInstances, mockStrategy);
      const endTime = Date.now();

      expect(decision.selectedInstance).toBeDefined();
      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
    });

    test('should handle frequent metric updates efficiently', () => {
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        loadBalancer.updateInstanceMetrics('instance-1', {
          instanceId: 'instance-1',
          cpuLoad: Math.random() * 100,
          memoryLoad: Math.random() * 100,
          networkLoad: Math.random() * 100,
          strategyCount: Math.floor(Math.random() * 10),
          responseTime: Math.random() * 1000,
          errorRate: Math.random() * 10,
          healthScore: Math.random() * 100,
          capacity: Math.random() * 100
        });
      }

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});