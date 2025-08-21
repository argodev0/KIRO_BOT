/**
 * System Recovery and Failover E2E Tests
 * Tests system recovery scenarios and failover mechanisms
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { spawn, ChildProcess } from 'child_process';
import { performance } from 'perf_hooks';

interface RecoveryScenario {
  name: string;
  failureType: 'database' | 'redis' | 'rabbitmq' | 'exchange' | 'network';
  duration: number;
  expectedBehavior: string;
}

class SystemRecoveryTester {
  private baseUrl: string;
  private authToken: string;
  private monitoringProcess: ChildProcess | null = null;

  constructor(baseUrl: string, authToken: string) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  async startSystemMonitoring(): Promise<void> {
    // Start monitoring process to track system health
    this.monitoringProcess = spawn('node', ['scripts/system-monitor.js'], {
      stdio: 'pipe'
    });
  }

  async stopSystemMonitoring(): Promise<void> {
    if (this.monitoringProcess) {
      this.monitoringProcess.kill();
      this.monitoringProcess = null;
    }
  }

  async getSystemHealth(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/system/health`, {
      headers: { 'Authorization': `Bearer ${this.authToken}` }
    });
    return response.json();
  }

  async simulateComponentFailure(component: string, duration: number): Promise<void> {
    await fetch(`${this.baseUrl}/api/test/simulate-failure`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ component, duration })
    });
  }

  async simulateNetworkPartition(duration: number): Promise<void> {
    await fetch(`${this.baseUrl}/api/test/network-partition`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ duration })
    });
  }

  async triggerFailover(component: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/system/failover`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ component })
    });
    return response.json();
  }

  async waitForRecovery(component: string, maxWaitTime: number = 30000): Promise<boolean> {
    const startTime = performance.now();
    
    while (performance.now() - startTime < maxWaitTime) {
      try {
        const health = await this.getSystemHealth();
        if (health.components[component]?.status === 'healthy') {
          return true;
        }
      } catch (error) {
        // Continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return false;
  }

  async validateDataConsistency(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/test/validate-consistency`, {
      headers: { 'Authorization': `Bearer ${this.authToken}` }
    });
    return response.json();
  }

  async getRecoveryMetrics(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/system/recovery-metrics`, {
      headers: { 'Authorization': `Bearer ${this.authToken}` }
    });
    return response.json();
  }

  async testServiceAvailability(): Promise<{ [key: string]: boolean }> {
    const services = [
      'market-data',
      'signal-generation',
      'trading-execution',
      'risk-management',
      'websocket'
    ];

    const availability: { [key: string]: boolean } = {};

    for (const service of services) {
      try {
        const response = await fetch(`${this.baseUrl}/api/${service}/health`, {
          headers: { 'Authorization': `Bearer ${this.authToken}` },
          timeout: 5000
        });
        availability[service] = response.ok;
      } catch (error) {
        availability[service] = false;
      }
    }

    return availability;
  }
}

describe('System Recovery and Failover E2E Tests', () => {
  let recoveryTester: SystemRecoveryTester;
  const baseUrl = 'http://localhost:3001';
  let authToken: string;

  beforeAll(async () => {
    // Get auth token
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'TestPassword123!'
      })
    });
    
    const loginData = await loginResponse.json();
    authToken = loginData.token;
    
    recoveryTester = new SystemRecoveryTester(baseUrl, authToken);
    await recoveryTester.startSystemMonitoring();
  }, 30000);

  afterAll(async () => {
    await recoveryTester.stopSystemMonitoring();
  });

  describe('Database Failure and Recovery', () => {
    test('should handle PostgreSQL connection loss and recovery', async () => {
      // Get baseline system health
      const initialHealth = await recoveryTester.getSystemHealth();
      expect(initialHealth.components.database.status).toBe('healthy');

      // Simulate database failure
      await recoveryTester.simulateComponentFailure('postgresql', 10000); // 10 seconds

      // Wait for failure detection
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check system response to database failure
      const failureHealth = await recoveryTester.getSystemHealth();
      expect(failureHealth.components.database.status).toBe('unhealthy');

      // System should switch to degraded mode
      expect(failureHealth.systemMode).toBe('degraded');

      // Test service availability during failure
      const availability = await recoveryTester.testServiceAvailability();
      
      // Critical services should still be available (using cache/fallback)
      expect(availability['market-data']).toBe(true); // Should use Redis cache
      expect(availability['websocket']).toBe(true);   // Should continue streaming
      
      // Services requiring database writes should be degraded
      expect(availability['trading-execution']).toBe(false);

      // Wait for automatic recovery
      const recovered = await recoveryTester.waitForRecovery('database', 15000);
      expect(recovered).toBe(true);

      // Verify full functionality restored
      const recoveryHealth = await recoveryTester.getSystemHealth();
      expect(recoveryHealth.components.database.status).toBe('healthy');
      expect(recoveryHealth.systemMode).toBe('normal');

      // Validate data consistency after recovery
      const consistencyCheck = await recoveryTester.validateDataConsistency();
      expect(consistencyCheck.isConsistent).toBe(true);
      expect(consistencyCheck.dataLoss).toBe(false);
    }, 30000);

    test('should handle database failover to backup instance', async () => {
      // Trigger database failover
      const failoverResult = await recoveryTester.triggerFailover('database');
      expect(failoverResult.success).toBe(true);
      expect(failoverResult.newPrimary).toBeDefined();

      // Verify system continues operating on backup
      const health = await recoveryTester.getSystemHealth();
      expect(health.components.database.status).toBe('healthy');
      expect(health.components.database.instance).toBe(failoverResult.newPrimary);

      // Test full functionality on backup database
      const availability = await recoveryTester.testServiceAvailability();
      Object.values(availability).forEach(isAvailable => {
        expect(isAvailable).toBe(true);
      });

      // Validate no data loss during failover
      const consistencyCheck = await recoveryTester.validateDataConsistency();
      expect(consistencyCheck.isConsistent).toBe(true);
    }, 20000);
  });

  describe('Redis Cache Failure and Recovery', () => {
    test('should handle Redis failure gracefully', async () => {
      // Simulate Redis failure
      await recoveryTester.simulateComponentFailure('redis', 8000);

      // Wait for failure detection
      await new Promise(resolve => setTimeout(resolve, 2000));

      // System should detect Redis failure
      const health = await recoveryTester.getSystemHealth();
      expect(health.components.redis.status).toBe('unhealthy');

      // Market data service should fallback to direct database queries
      const marketDataResponse = await fetch(`${baseUrl}/api/market-data/ticker/BTCUSDT`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      expect(marketDataResponse.ok).toBe(true);
      
      // Response should be slower but functional
      const responseTime = performance.now();
      await marketDataResponse.json();
      const endTime = performance.now();
      
      // Should still respond within acceptable limits (though slower)
      expect(endTime - responseTime).toBeLessThan(1000);

      // Wait for Redis recovery
      const recovered = await recoveryTester.waitForRecovery('redis', 12000);
      expect(recovered).toBe(true);

      // Verify cache is rebuilt
      const finalHealth = await recoveryTester.getSystemHealth();
      expect(finalHealth.components.redis.status).toBe('healthy');
      expect(finalHealth.components.redis.cacheHitRate).toBeGreaterThan(0);
    }, 25000);

    test('should rebuild cache after Redis recovery', async () => {
      // Clear Redis cache
      await fetch(`${baseUrl}/api/test/clear-cache`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      // Trigger cache rebuild
      await fetch(`${baseUrl}/api/system/rebuild-cache`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      // Wait for cache rebuild
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Verify cache is populated
      const health = await recoveryTester.getSystemHealth();
      expect(health.components.redis.cacheSize).toBeGreaterThan(0);
      expect(health.components.redis.status).toBe('healthy');

      // Test cache performance
      const startTime = performance.now();
      await fetch(`${baseUrl}/api/market-data/ticker/BTCUSDT`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const cacheResponseTime = performance.now() - startTime;

      expect(cacheResponseTime).toBeLessThan(100); // Should be fast with cache
    }, 15000);
  });

  describe('Message Queue Failure and Recovery', () => {
    test('should handle RabbitMQ failure and message persistence', async () => {
      // Generate some signals before failure
      await fetch(`${baseUrl}/api/signals/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ symbol: 'BTCUSDT', forceGenerate: true })
      });

      // Simulate RabbitMQ failure
      await recoveryTester.simulateComponentFailure('rabbitmq', 12000);

      // Wait for failure detection
      await new Promise(resolve => setTimeout(resolve, 2000));

      // System should detect message queue failure
      const health = await recoveryTester.getSystemHealth();
      expect(health.components.messageQueue.status).toBe('unhealthy');

      // System should queue messages locally during outage
      const signalResponse = await fetch(`${baseUrl}/api/signals/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ symbol: 'ETHUSDT', forceGenerate: true })
      });

      expect(signalResponse.ok).toBe(true);

      // Wait for RabbitMQ recovery
      const recovered = await recoveryTester.waitForRecovery('messageQueue', 15000);
      expect(recovered).toBe(true);

      // Verify queued messages are processed after recovery
      await new Promise(resolve => setTimeout(resolve, 3000));

      const finalHealth = await recoveryTester.getSystemHealth();
      expect(finalHealth.components.messageQueue.status).toBe('healthy');
      expect(finalHealth.components.messageQueue.queuedMessages).toBe(0); // All processed
    }, 30000);

    test('should handle message queue failover', async () => {
      // Trigger message queue failover
      const failoverResult = await recoveryTester.triggerFailover('messageQueue');
      expect(failoverResult.success).toBe(true);

      // Verify messaging continues on backup queue
      const health = await recoveryTester.getSystemHealth();
      expect(health.components.messageQueue.status).toBe('healthy');

      // Test message processing on backup
      const signalResponse = await fetch(`${baseUrl}/api/signals/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ symbol: 'BTCUSDT', forceGenerate: true })
      });

      expect(signalResponse.ok).toBe(true);

      // Verify message was processed
      await new Promise(resolve => setTimeout(resolve, 2000));
      const finalHealth = await recoveryTester.getSystemHealth();
      expect(finalHealth.components.messageQueue.messagesProcessed).toBeGreaterThan(0);
    }, 15000);
  });

  describe('Exchange Connectivity Failure and Recovery', () => {
    test('should handle single exchange failure with automatic failover', async () => {
      // Simulate Binance exchange failure
      await recoveryTester.simulateComponentFailure('binance', 10000);

      // Wait for failure detection
      await new Promise(resolve => setTimeout(resolve, 2000));

      // System should detect exchange failure
      const health = await recoveryTester.getSystemHealth();
      expect(health.components.exchanges.binance.status).toBe('unhealthy');

      // Trading should automatically route to KuCoin
      const tradeResponse = await fetch(`${baseUrl}/api/trading/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          symbol: 'BTCUSDT',
          side: 'buy',
          size: 0.001,
          // Don't specify exchange - should auto-route to available exchange
        })
      });

      if (tradeResponse.ok) {
        const tradeResult = await tradeResponse.json();
        expect(tradeResult.exchange).toBe('kucoin'); // Should route to KuCoin
      }

      // Market data should continue from available exchanges
      const marketDataResponse = await fetch(`${baseUrl}/api/market-data/ticker/BTCUSDT`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      expect(marketDataResponse.ok).toBe(true);
      const marketData = await marketDataResponse.json();
      expect(marketData.source).toBe('kucoin'); // Should come from KuCoin

      // Wait for Binance recovery
      const recovered = await recoveryTester.waitForRecovery('binance', 15000);
      expect(recovered).toBe(true);

      // Verify load balancing resumes
      const finalHealth = await recoveryTester.getSystemHealth();
      expect(finalHealth.components.exchanges.binance.status).toBe('healthy');
    }, 25000);

    test('should handle multiple exchange failures gracefully', async () => {
      // Simulate both exchanges failing
      await Promise.all([
        recoveryTester.simulateComponentFailure('binance', 8000),
        recoveryTester.simulateComponentFailure('kucoin', 8000)
      ]);

      // Wait for failure detection
      await new Promise(resolve => setTimeout(resolve, 3000));

      // System should enter emergency mode
      const health = await recoveryTester.getSystemHealth();
      expect(health.systemMode).toBe('emergency');
      expect(health.components.exchanges.binance.status).toBe('unhealthy');
      expect(health.components.exchanges.kucoin.status).toBe('unhealthy');

      // New trades should be rejected
      const tradeResponse = await fetch(`${baseUrl}/api/trading/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          symbol: 'BTCUSDT',
          side: 'buy',
          size: 0.001
        })
      });

      expect(tradeResponse.status).toBe(503); // Service unavailable

      // Market data should use cached/historical data
      const marketDataResponse = await fetch(`${baseUrl}/api/market-data/ticker/BTCUSDT`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (marketDataResponse.ok) {
        const marketData = await marketDataResponse.json();
        expect(marketData.source).toBe('cache');
        expect(marketData.stale).toBe(true);
      }

      // Wait for at least one exchange to recover
      const binanceRecovered = await recoveryTester.waitForRecovery('binance', 12000);
      const kucoinRecovered = await recoveryTester.waitForRecovery('kucoin', 12000);

      expect(binanceRecovered || kucoinRecovered).toBe(true);

      // System should exit emergency mode
      const finalHealth = await recoveryTester.getSystemHealth();
      expect(finalHealth.systemMode).not.toBe('emergency');
    }, 30000);
  });

  describe('Network Partition Recovery', () => {
    test('should handle network partition and split-brain prevention', async () => {
      // Simulate network partition
      await recoveryTester.simulateNetworkPartition(15000);

      // Wait for partition detection
      await new Promise(resolve => setTimeout(resolve, 3000));

      // System should detect network issues
      const health = await recoveryTester.getSystemHealth();
      expect(health.networkStatus).toBe('partitioned');

      // System should prevent split-brain scenarios
      expect(health.leaderElection.isLeader).toBeDefined();
      
      // Only leader should continue processing
      if (health.leaderElection.isLeader) {
        // Leader should continue limited operations
        const availability = await recoveryTester.testServiceAvailability();
        expect(availability['market-data']).toBe(true);
      } else {
        // Non-leader should be in standby mode
        expect(health.systemMode).toBe('standby');
      }

      // Wait for network recovery
      await new Promise(resolve => setTimeout(resolve, 18000));

      // Verify network partition is resolved
      const finalHealth = await recoveryTester.getSystemHealth();
      expect(finalHealth.networkStatus).toBe('connected');
      expect(finalHealth.systemMode).toBe('normal');

      // All services should be available
      const availability = await recoveryTester.testServiceAvailability();
      Object.values(availability).forEach(isAvailable => {
        expect(isAvailable).toBe(true);
      });
    }, 40000);
  });

  describe('Recovery Performance and Metrics', () => {
    test('should meet recovery time objectives (RTO)', async () => {
      const recoveryScenarios: RecoveryScenario[] = [
        { name: 'Database failure', failureType: 'database', duration: 5000, expectedBehavior: 'failover' },
        { name: 'Redis failure', failureType: 'redis', duration: 3000, expectedBehavior: 'degraded_mode' },
        { name: 'Exchange failure', failureType: 'exchange', duration: 2000, expectedBehavior: 'reroute' }
      ];

      for (const scenario of recoveryScenarios) {
        console.log(`Testing recovery scenario: ${scenario.name}`);
        
        const startTime = performance.now();
        
        // Simulate failure
        await recoveryTester.simulateComponentFailure(scenario.failureType, scenario.duration);
        
        // Wait for recovery
        const recovered = await recoveryTester.waitForRecovery(scenario.failureType, 20000);
        
        const recoveryTime = performance.now() - startTime;
        
        expect(recovered).toBe(true);
        
        // Recovery Time Objective: < 30 seconds for all scenarios
        expect(recoveryTime).toBeLessThan(30000);
        
        console.log(`${scenario.name} recovery time: ${recoveryTime.toFixed(2)}ms`);
        
        // Wait between scenarios
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }, 120000);

    test('should maintain Recovery Point Objective (RPO)', async () => {
      // Generate some data before failure
      const preFailureSignals = [];
      for (let i = 0; i < 5; i++) {
        const response = await fetch(`${baseUrl}/api/signals/generate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ symbol: 'BTCUSDT', forceGenerate: true })
        });
        
        if (response.ok) {
          const signal = await response.json();
          preFailureSignals.push(signal.id);
        }
      }

      // Simulate database failure and recovery
      await recoveryTester.simulateComponentFailure('database', 8000);
      await recoveryTester.waitForRecovery('database', 15000);

      // Verify data integrity after recovery
      const consistencyCheck = await recoveryTester.validateDataConsistency();
      expect(consistencyCheck.isConsistent).toBe(true);
      
      // RPO: Maximum 1 minute of data loss acceptable
      expect(consistencyCheck.dataLossWindow).toBeLessThan(60000);

      // Verify pre-failure signals are still present
      for (const signalId of preFailureSignals) {
        const signalResponse = await fetch(`${baseUrl}/api/signals/${signalId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        expect(signalResponse.ok).toBe(true);
      }
    }, 30000);

    test('should provide comprehensive recovery metrics', async () => {
      // Simulate a failure and recovery cycle
      await recoveryTester.simulateComponentFailure('redis', 5000);
      await recoveryTester.waitForRecovery('redis', 10000);

      // Get recovery metrics
      const metrics = await recoveryTester.getRecoveryMetrics();

      expect(metrics).toHaveProperty('totalFailures');
      expect(metrics).toHaveProperty('averageRecoveryTime');
      expect(metrics).toHaveProperty('successfulRecoveries');
      expect(metrics).toHaveProperty('failedRecoveries');
      expect(metrics).toHaveProperty('mttr'); // Mean Time To Recovery
      expect(metrics).toHaveProperty('mtbf'); // Mean Time Between Failures

      // Verify metrics are reasonable
      expect(metrics.averageRecoveryTime).toBeLessThan(30000);
      expect(metrics.successfulRecoveries).toBeGreaterThan(0);
      expect(metrics.mttr).toBeLessThan(60000); // Less than 1 minute MTTR
    }, 20000);
  });
});