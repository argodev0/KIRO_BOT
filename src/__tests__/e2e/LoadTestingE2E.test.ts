/**
 * Load Testing for AI Crypto Trading Bot
 * Tests system performance under realistic market data volumes
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { performance } from 'perf_hooks';
import { WebSocket } from 'ws';

interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  requestsPerSecond: number;
  duration: number;
}

interface WebSocketLoadResult {
  connections: number;
  messagesReceived: number;
  averageLatency: number;
  connectionErrors: number;
  messageErrors: number;
}

class LoadTester {
  private baseUrl: string;
  private wsUrl: string;
  private authToken: string;

  constructor(baseUrl: string, wsUrl: string, authToken: string) {
    this.baseUrl = baseUrl;
    this.wsUrl = wsUrl;
    this.authToken = authToken;
  }

  async runHttpLoadTest(
    endpoint: string,
    concurrency: number,
    duration: number,
    method: string = 'GET',
    body?: any
  ): Promise<LoadTestResult> {
    const results: number[] = [];
    const startTime = performance.now();
    const endTime = startTime + duration;
    
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;

    // Create concurrent workers
    const workers = Array(concurrency).fill(0).map(() => 
      this.createHttpWorker(endpoint, endTime, method, body, results)
    );

    // Wait for all workers to complete
    const workerResults = await Promise.all(workers);
    
    // Aggregate results
    workerResults.forEach(result => {
      totalRequests += result.requests;
      successfulRequests += result.successful;
      failedRequests += result.failed;
    });

    const actualDuration = performance.now() - startTime;
    const sortedLatencies = results.sort((a, b) => a - b);
    
    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageLatency: results.reduce((sum, lat) => sum + lat, 0) / results.length || 0,
      p95Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0,
      p99Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0,
      requestsPerSecond: successfulRequests / (actualDuration / 1000),
      duration: actualDuration
    };
  }

  private async createHttpWorker(
    endpoint: string,
    endTime: number,
    method: string,
    body: any,
    results: number[]
  ): Promise<{ requests: number; successful: number; failed: number }> {
    let requests = 0;
    let successful = 0;
    let failed = 0;

    while (performance.now() < endTime) {
      try {
        const startTime = performance.now();
        
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          method,
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json'
          },
          body: body ? JSON.stringify(body) : undefined
        });

        const latency = performance.now() - startTime;
        results.push(latency);
        requests++;

        if (response.ok) {
          successful++;
        } else {
          failed++;
        }
      } catch (error) {
        requests++;
        failed++;
      }

      // Small delay to prevent overwhelming the server
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
    }

    return { requests, successful, failed };
  }

  async runWebSocketLoadTest(
    concurrency: number,
    duration: number
  ): Promise<WebSocketLoadResult> {
    const connections: WebSocket[] = [];
    const latencies: number[] = [];
    let messagesReceived = 0;
    let connectionErrors = 0;
    let messageErrors = 0;

    // Create concurrent WebSocket connections
    const connectionPromises = Array(concurrency).fill(0).map(() => 
      this.createWebSocketConnection(latencies, duration)
    );

    const results = await Promise.all(connectionPromises);
    
    // Aggregate results
    results.forEach(result => {
      if (result.connected) {
        messagesReceived += result.messages;
      } else {
        connectionErrors++;
      }
      messageErrors += result.errors;
    });

    return {
      connections: results.filter(r => r.connected).length,
      messagesReceived,
      averageLatency: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length || 0,
      connectionErrors,
      messageErrors
    };
  }

  private createWebSocketConnection(
    latencies: number[],
    duration: number
  ): Promise<{ connected: boolean; messages: number; errors: number }> {
    return new Promise((resolve) => {
      let connected = false;
      let messages = 0;
      let errors = 0;

      try {
        const ws = new WebSocket(this.wsUrl);
        
        ws.on('open', () => {
          connected = true;
          
          // Subscribe to market data
          ws.send(JSON.stringify({
            type: 'subscribe',
            channel: 'ticker',
            symbol: 'BTCUSDT'
          }));

          // Send periodic ping messages
          const pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              const startTime = performance.now();
              ws.send(JSON.stringify({
                type: 'ping',
                timestamp: startTime
              }));
            }
          }, 1000);

          // Close connection after duration
          setTimeout(() => {
            clearInterval(pingInterval);
            ws.close();
          }, duration);
        });

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            messages++;
            
            if (message.type === 'pong' && message.timestamp) {
              const latency = performance.now() - message.timestamp;
              latencies.push(latency);
            }
          } catch (error) {
            errors++;
          }
        });

        ws.on('error', () => {
          errors++;
        });

        ws.on('close', () => {
          resolve({ connected, messages, errors });
        });

      } catch (error) {
        resolve({ connected: false, messages: 0, errors: 1 });
      }
    });
  }

  async runMarketDataStressTest(): Promise<LoadTestResult> {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT'];
    const timeframes = ['1m', '5m', '15m', '1h', '4h'];
    const requests: Promise<Response>[] = [];
    
    const startTime = performance.now();
    
    // Generate 1000 concurrent market data requests
    for (let i = 0; i < 1000; i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const timeframe = timeframes[Math.floor(Math.random() * timeframes.length)];
      
      requests.push(
        fetch(`${this.baseUrl}/api/market-data/candles/${symbol}?timeframe=${timeframe}&limit=100`, {
          headers: { 'Authorization': `Bearer ${this.authToken}` }
        })
      );
    }
    
    const responses = await Promise.all(requests.map(p => p.catch(() => null)));
    const endTime = performance.now();
    
    const successful = responses.filter(r => r && r.ok).length;
    const failed = responses.length - successful;
    
    return {
      totalRequests: requests.length,
      successfulRequests: successful,
      failedRequests: failed,
      averageLatency: 0, // Not measured in this test
      p95Latency: 0,
      p99Latency: 0,
      requestsPerSecond: successful / ((endTime - startTime) / 1000),
      duration: endTime - startTime
    };
  }

  async runSignalGenerationStressTest(): Promise<LoadTestResult> {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'];
    const requests: Promise<Response>[] = [];
    
    const startTime = performance.now();
    
    // Generate 100 concurrent signal generation requests
    for (let i = 0; i < 100; i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      
      requests.push(
        fetch(`${this.baseUrl}/api/signals/generate`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            symbol,
            forceGenerate: true
          })
        })
      );
    }
    
    const responses = await Promise.all(requests.map(p => p.catch(() => null)));
    const endTime = performance.now();
    
    const successful = responses.filter(r => r && r.ok).length;
    const failed = responses.length - successful;
    
    return {
      totalRequests: requests.length,
      successfulRequests: successful,
      failedRequests: failed,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      requestsPerSecond: successful / ((endTime - startTime) / 1000),
      duration: endTime - startTime
    };
  }
}

describe('Load Testing and Performance Validation', () => {
  let loadTester: LoadTester;
  const baseUrl = 'http://localhost:3001';
  const wsUrl = 'ws://localhost:3001';
  let authToken: string;

  beforeAll(async () => {
    // Setup test environment and get auth token
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
    
    loadTester = new LoadTester(baseUrl, wsUrl, authToken);
  }, 30000);

  describe('HTTP API Load Testing', () => {
    test('should handle market data API load', async () => {
      const result = await loadTester.runHttpLoadTest(
        '/api/market-data/ticker/BTCUSDT',
        20, // 20 concurrent users
        10000 // 10 seconds
      );

      console.log('Market Data API Load Test Results:', result);

      // Performance requirements
      expect(result.successfulRequests).toBeGreaterThan(0);
      expect(result.failedRequests / result.totalRequests).toBeLessThan(0.01); // <1% error rate
      expect(result.averageLatency).toBeLessThan(200); // <200ms average latency
      expect(result.p95Latency).toBeLessThan(500); // <500ms 95th percentile
      expect(result.requestsPerSecond).toBeGreaterThan(50); // >50 RPS
    }, 30000);

    test('should handle trading API load', async () => {
      const result = await loadTester.runHttpLoadTest(
        '/api/positions',
        15, // 15 concurrent users
        8000 // 8 seconds
      );

      console.log('Trading API Load Test Results:', result);

      expect(result.successfulRequests).toBeGreaterThan(0);
      expect(result.failedRequests / result.totalRequests).toBeLessThan(0.02); // <2% error rate
      expect(result.averageLatency).toBeLessThan(300); // <300ms average latency
      expect(result.requestsPerSecond).toBeGreaterThan(30); // >30 RPS
    }, 20000);

    test('should handle signal generation load', async () => {
      const result = await loadTester.runHttpLoadTest(
        '/api/signals/generate',
        5, // 5 concurrent users (signal generation is more intensive)
        10000, // 10 seconds
        'POST',
        { symbol: 'BTCUSDT', forceGenerate: true }
      );

      console.log('Signal Generation Load Test Results:', result);

      expect(result.successfulRequests).toBeGreaterThan(0);
      expect(result.failedRequests / result.totalRequests).toBeLessThan(0.05); // <5% error rate
      expect(result.averageLatency).toBeLessThan(2000); // <2s average latency
      expect(result.requestsPerSecond).toBeGreaterThan(2); // >2 RPS
    }, 25000);
  });

  describe('WebSocket Load Testing', () => {
    test('should handle concurrent WebSocket connections', async () => {
      const result = await loadTester.runWebSocketLoadTest(
        50, // 50 concurrent connections
        10000 // 10 seconds
      );

      console.log('WebSocket Load Test Results:', result);

      expect(result.connections).toBeGreaterThan(40); // At least 80% successful connections
      expect(result.messagesReceived).toBeGreaterThan(0);
      expect(result.connectionErrors / 50).toBeLessThan(0.1); // <10% connection error rate
      expect(result.averageLatency).toBeLessThan(100); // <100ms WebSocket latency
    }, 20000);

    test('should handle high-frequency market data streaming', async () => {
      const result = await loadTester.runWebSocketLoadTest(
        100, // 100 concurrent connections
        15000 // 15 seconds
      );

      console.log('High-Frequency WebSocket Test Results:', result);

      expect(result.connections).toBeGreaterThan(80); // At least 80% successful connections
      expect(result.messagesReceived).toBeGreaterThan(1000); // Should receive many messages
      expect(result.connectionErrors / 100).toBeLessThan(0.15); // <15% connection error rate
    }, 25000);
  });

  describe('Stress Testing with Realistic Market Data Volumes', () => {
    test('should handle market data stress test', async () => {
      const result = await loadTester.runMarketDataStressTest();

      console.log('Market Data Stress Test Results:', result);

      expect(result.successfulRequests).toBeGreaterThan(800); // At least 80% success rate
      expect(result.requestsPerSecond).toBeGreaterThan(100); // >100 RPS under stress
      expect(result.duration).toBeLessThan(15000); // Complete within 15 seconds
    }, 30000);

    test('should handle signal generation stress test', async () => {
      const result = await loadTester.runSignalGenerationStressTest();

      console.log('Signal Generation Stress Test Results:', result);

      expect(result.successfulRequests).toBeGreaterThan(80); // At least 80% success rate
      expect(result.requestsPerSecond).toBeGreaterThan(5); // >5 RPS under stress
      expect(result.duration).toBeLessThan(30000); // Complete within 30 seconds
    }, 45000);
  });

  describe('Memory and Resource Usage Under Load', () => {
    test('should maintain stable memory usage during load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Run multiple load tests simultaneously
      const promises = [
        loadTester.runHttpLoadTest('/api/market-data/ticker/BTCUSDT', 10, 5000),
        loadTester.runHttpLoadTest('/api/signals', 5, 5000),
        loadTester.runWebSocketLoadTest(25, 5000)
      ];
      
      await Promise.all(promises);
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;
      
      console.log(`Memory usage increase: ${memoryIncreasePercent.toFixed(2)}%`);
      
      // Memory usage should not increase by more than 50% during load testing
      expect(memoryIncreasePercent).toBeLessThan(50);
    }, 20000);

    test('should handle sustained load without degradation', async () => {
      const testDuration = 30000; // 30 seconds
      const measurements: LoadTestResult[] = [];
      
      // Run load test in 5-second intervals
      for (let i = 0; i < 6; i++) {
        const result = await loadTester.runHttpLoadTest(
          '/api/market-data/ticker/BTCUSDT',
          10,
          5000
        );
        measurements.push(result);
        
        console.log(`Interval ${i + 1} - RPS: ${result.requestsPerSecond.toFixed(2)}, Latency: ${result.averageLatency.toFixed(2)}ms`);
      }
      
      // Performance should remain stable (no significant degradation)
      const firstHalf = measurements.slice(0, 3);
      const secondHalf = measurements.slice(3, 6);
      
      const firstHalfAvgRPS = firstHalf.reduce((sum, r) => sum + r.requestsPerSecond, 0) / firstHalf.length;
      const secondHalfAvgRPS = secondHalf.reduce((sum, r) => sum + r.requestsPerSecond, 0) / secondHalf.length;
      
      const performanceDegradation = (firstHalfAvgRPS - secondHalfAvgRPS) / firstHalfAvgRPS;
      
      console.log(`Performance degradation: ${(performanceDegradation * 100).toFixed(2)}%`);
      
      // Performance degradation should be less than 20%
      expect(performanceDegradation).toBeLessThan(0.2);
    }, 45000);
  });

  describe('Concurrent User Simulation', () => {
    test('should simulate realistic trading session load', async () => {
      // Simulate 50 concurrent users performing various actions
      const userActions = [
        () => loadTester.runHttpLoadTest('/api/market-data/ticker/BTCUSDT', 1, 1000),
        () => loadTester.runHttpLoadTest('/api/signals', 1, 1000),
        () => loadTester.runHttpLoadTest('/api/positions', 1, 1000),
        () => loadTester.runHttpLoadTest('/api/grids', 1, 1000),
        () => loadTester.runWebSocketLoadTest(1, 5000)
      ];
      
      const concurrentUsers = 50;
      const userPromises = [];
      
      for (let i = 0; i < concurrentUsers; i++) {
        const action = userActions[Math.floor(Math.random() * userActions.length)];
        userPromises.push(action());
      }
      
      const startTime = performance.now();
      const results = await Promise.all(userPromises);
      const endTime = performance.now();
      
      const totalDuration = endTime - startTime;
      const successfulActions = results.filter(r => 
        'successfulRequests' in r ? r.successfulRequests > 0 : r.connections > 0
      ).length;
      
      console.log(`Concurrent user simulation: ${successfulActions}/${concurrentUsers} successful actions in ${totalDuration.toFixed(2)}ms`);
      
      expect(successfulActions / concurrentUsers).toBeGreaterThan(0.8); // 80% success rate
      expect(totalDuration).toBeLessThan(10000); // Complete within 10 seconds
    }, 30000);
  });
});