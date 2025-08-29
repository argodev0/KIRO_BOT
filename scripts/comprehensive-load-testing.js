#!/usr/bin/env node

/**
 * Comprehensive Load Testing and Performance Validation
 * 
 * Task 25: Implement Load Testing and Performance Validation
 * - Create load testing scenarios for production traffic simulation
 * - Build performance benchmarking for API and WebSocket services
 * - Implement stress testing for market data processing
 * - Add memory and resource usage optimization testing
 * 
 * Requirements: 8.3
 */

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const WebSocket = require('ws');
const https = require('https');
const http = require('http');
const { performance } = require('perf_hooks');

class ComprehensiveLoadTester {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'https://localhost',
      apiPort: config.apiPort || 3000,
      wsPort: config.wsPort || 3000,
      duration: config.duration || 300000, // 5 minutes
      concurrentUsers: config.concurrentUsers || 50,
      rampUpTime: config.rampUpTime || 30000, // 30 seconds
      targetLatency: config.targetLatency || 200, // 200ms
      targetThroughput: config.targetThroughput || 500, // requests per second
      memoryThreshold: config.memoryThreshold || 0.85, // 85% memory usage
      cpuThreshold: config.cpuThreshold || 0.80, // 80% CPU usage
      ...config
    };
    
    this.results = {
      loadTests: {},
      performanceBenchmarks: {},
      stressTests: {},
      resourceTests: {},
      summary: {
        passed: 0,
        failed: 0,
        warnings: 0,
        totalTests: 0
      }
    };
    
    this.testStartTime = Date.now();
    this.activeConnections = new Set();
    this.resourceMonitor = null;
  }

  log(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data) {
      console.log(`  Data: ${JSON.stringify(data, null, 2)}`);
    }
  }

  async makeRequest(url, options = {}) {
    const startTime = performance.now();
    
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 15000);

      const req = protocol.get(url, {
        ...options,
        rejectUnauthorized: false
      }, (res) => {
        clearTimeout(timeout);
        const endTime = performance.now();
        const latency = endTime - startTime;
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            latency,
            data,
            timestamp: Date.now()
          });
        });
      });

      req.on('error', (error) => {
        clearTimeout(timeout);
        const endTime = performance.now();
        const latency = endTime - startTime;
        
        reject({
          error: error.message,
          latency,
          timestamp: Date.now()
        });
      });
    });
  }

  // Sub-task 1: Create load testing scenarios for production traffic simulation
  async runProductionTrafficSimulation() {
    this.log('🚀 Running production traffic simulation scenarios...');
    
    const scenarios = [
      {
        name: 'Normal Trading Hours',
        concurrency: this.config.concurrentUsers,
        duration: this.config.duration,
        pattern: 'steady'
      },
      {
        name: 'Peak Trading Hours',
        concurrency: this.config.concurrentUsers * 2,
        duration: this.config.duration / 2,
        pattern: 'spike'
      },
      {
        name: 'Market Volatility',
        concurrency: this.config.concurrentUsers * 1.5,
        duration: this.config.duration / 3,
        pattern: 'burst'
      },
      {
        name: 'Off-Peak Hours',
        concurrency: Math.floor(this.config.concurrentUsers * 0.3),
        duration: this.config.duration / 4,
        pattern: 'minimal'
      }
    ];
    
    for (const scenario of scenarios) {
      this.log(`Running scenario: ${scenario.name}`);
      await this.runTrafficScenario(scenario);
    }
  }

  async runTrafficScenario(scenario) {
    const scenarioResults = {
      name: scenario.name,
      requests: 0,
      responses: 0,
      errors: 0,
      latencies: [],
      throughput: 0,
      errorRate: 0,
      passed: false
    };
    
    const startTime = performance.now();
    const endTime = startTime + scenario.duration;
    const workers = [];
    
    // Create workers based on scenario pattern
    for (let i = 0; i < scenario.concurrency; i++) {
      const delay = this.calculateWorkerDelay(i, scenario);
      setTimeout(() => {
        workers.push(this.createTrafficWorker(endTime, scenarioResults));
      }, delay);
    }
    
    // Wait for scenario completion
    await new Promise(resolve => setTimeout(resolve, scenario.duration + this.config.rampUpTime));
    
    // Calculate results
    const actualDuration = (performance.now() - startTime) / 1000;
    scenarioResults.throughput = scenarioResults.responses / actualDuration;
    scenarioResults.errorRate = (scenarioResults.errors / scenarioResults.requests) * 100;
    scenarioResults.passed = this.evaluateScenarioResults(scenarioResults);
    
    this.results.loadTests[scenario.name] = scenarioResults;
    
    if (scenarioResults.passed) {
      this.results.summary.passed++;
    } else {
      this.results.summary.failed++;
    }
    this.results.summary.totalTests++;
    
    this.log(`Scenario ${scenario.name} completed`, {
      throughput: `${scenarioResults.throughput.toFixed(2)} req/s`,
      errorRate: `${scenarioResults.errorRate.toFixed(2)}%`,
      avgLatency: scenarioResults.latencies.length > 0 ? 
        `${(scenarioResults.latencies.reduce((a, b) => a + b, 0) / scenarioResults.latencies.length).toFixed(2)}ms` : 'N/A'
    });
  }

  calculateWorkerDelay(workerIndex, scenario) {
    switch (scenario.pattern) {
      case 'spike':
        return Math.random() * 1000; // Quick ramp-up
      case 'burst':
        return (workerIndex % 10) * 100; // Burst pattern
      case 'minimal':
        return workerIndex * 2000; // Slow ramp-up
      case 'steady':
      default:
        return (workerIndex / scenario.concurrency) * this.config.rampUpTime;
    }
  }

  async createTrafficWorker(endTime, results) {
    const endpoints = [
      '/health',
      '/api/market/ticker/BTCUSDT',
      '/api/market/ticker/ETHUSDT',
      '/api/positions',
      '/api/config/trading-mode',
      '/api/analytics/performance',
      '/api/market/symbols',
      '/api/status/connections',
      '/metrics'
    ];

    while (performance.now() < endTime) {
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      
      try {
        results.requests++;
        const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}${endpoint}`);
        
        results.responses++;
        results.latencies.push(response.latency);
        
      } catch (error) {
        results.errors++;
      }
      
      // Realistic delay between requests
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));
    }
  }

  evaluateScenarioResults(results) {
    const avgLatency = results.latencies.length > 0 ? 
      results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length : Infinity;
    
    return (
      results.errorRate < 5 && // Less than 5% error rate
      avgLatency < this.config.targetLatency && // Within latency target
      results.throughput > this.config.targetThroughput * 0.5 // At least 50% of target throughput
    );
  }

  // Sub-task 2: Build performance benchmarking for API and WebSocket services
  async runPerformanceBenchmarking() {
    this.log('📊 Running performance benchmarking for API and WebSocket services...');
    
    await this.benchmarkAPIEndpoints();
    await this.benchmarkWebSocketServices();
    await this.benchmarkDatabaseOperations();
    await this.benchmarkCacheOperations();
  }

  async benchmarkAPIEndpoints() {
    this.log('Benchmarking API endpoints...');
    
    const endpoints = [
      { path: '/health', category: 'health', expectedLatency: 50 },
      { path: '/api/market/ticker/BTCUSDT', category: 'market-data', expectedLatency: 100 },
      { path: '/api/positions', category: 'trading', expectedLatency: 150 },
      { path: '/api/config', category: 'configuration', expectedLatency: 100 },
      { path: '/api/analytics/performance', category: 'analytics', expectedLatency: 200 },
      { path: '/metrics', category: 'monitoring', expectedLatency: 100 }
    ];
    
    const benchmarkResults = {};
    
    for (const endpoint of endpoints) {
      const endpointResults = await this.benchmarkSingleEndpoint(endpoint);
      benchmarkResults[endpoint.path] = endpointResults;
      
      if (endpointResults.passed) {
        this.results.summary.passed++;
      } else {
        this.results.summary.failed++;
      }
      this.results.summary.totalTests++;
    }
    
    this.results.performanceBenchmarks.apiEndpoints = benchmarkResults;
  }

  async benchmarkSingleEndpoint(endpoint) {
    const iterations = 100;
    const latencies = [];
    const errors = [];
    
    this.log(`Benchmarking ${endpoint.path}...`);
    
    for (let i = 0; i < iterations; i++) {
      try {
        const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}${endpoint.path}`);
        latencies.push(response.latency);
      } catch (error) {
        errors.push(error.error || error.message);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    const stats = this.calculateLatencyStats(latencies);
    const errorRate = (errors.length / iterations) * 100;
    const passed = stats.avg <= endpoint.expectedLatency && errorRate < 2;
    
    return {
      category: endpoint.category,
      iterations,
      latencyStats: stats,
      errorRate: errorRate.toFixed(2),
      errors: errors.slice(0, 5), // Keep first 5 errors
      passed,
      expectedLatency: endpoint.expectedLatency
    };
  }

  async benchmarkWebSocketServices() {
    this.log('Benchmarking WebSocket services...');
    
    const wsTests = [
      { name: 'Market Data Stream', connections: 10, duration: 30000 },
      { name: 'Trading Updates', connections: 5, duration: 20000 },
      { name: 'System Notifications', connections: 3, duration: 15000 }
    ];
    
    const wsResults = {};
    
    for (const test of wsTests) {
      const testResults = await this.benchmarkWebSocketTest(test);
      wsResults[test.name] = testResults;
      
      if (testResults.passed) {
        this.results.summary.passed++;
      } else {
        this.results.summary.failed++;
      }
      this.results.summary.totalTests++;
    }
    
    this.results.performanceBenchmarks.webSocket = wsResults;
  }

  async benchmarkWebSocketTest(test) {
    return new Promise((resolve) => {
      const connections = [];
      const metrics = {
        connectionsEstablished: 0,
        messagesReceived: 0,
        messagesSent: 0,
        errors: 0,
        latencies: []
      };
      
      // Create multiple WebSocket connections
      for (let i = 0; i < test.connections; i++) {
        setTimeout(() => {
          this.createBenchmarkWebSocket(metrics);
        }, i * 100);
      }
      
      // Wait for test duration
      setTimeout(() => {
        // Close all connections
        this.activeConnections.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        });
        this.activeConnections.clear();
        
        const messageRate = metrics.messagesReceived / (test.duration / 1000);
        const avgLatency = metrics.latencies.length > 0 ? 
          metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length : 0;
        
        const passed = (
          metrics.connectionsEstablished >= test.connections * 0.8 && // 80% connection success
          messageRate >= 1 && // At least 1 message per second
          avgLatency <= 500 // Max 500ms latency
        );
        
        resolve({
          connectionsEstablished: metrics.connectionsEstablished,
          messagesReceived: metrics.messagesReceived,
          messageRate: messageRate.toFixed(2),
          avgLatency: avgLatency.toFixed(2),
          errorRate: ((metrics.errors / test.connections) * 100).toFixed(2),
          passed
        });
      }, test.duration);
    });
  }

  createBenchmarkWebSocket(metrics) {
    try {
      const wsUrl = `wss://localhost:${this.config.wsPort}/ws/market-data`;
      const ws = new WebSocket(wsUrl, { rejectUnauthorized: false });
      
      this.activeConnections.add(ws);
      
      ws.on('open', () => {
        metrics.connectionsEstablished++;
        
        // Subscribe to market data
        const subscribeMessage = JSON.stringify({
          type: 'subscribe',
          channels: ['ticker', 'trades'],
          symbols: ['BTCUSDT', 'ETHUSDT']
        });
        
        ws.send(subscribeMessage);
        metrics.messagesSent++;
        
        // Send periodic ping messages
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const pingMessage = JSON.stringify({
              type: 'ping',
              timestamp: Date.now()
            });
            ws.send(pingMessage);
            metrics.messagesSent++;
          } else {
            clearInterval(pingInterval);
          }
        }, 5000);
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          metrics.messagesReceived++;
          
          if (message.type === 'pong' && message.timestamp) {
            const latency = Date.now() - message.timestamp;
            metrics.latencies.push(latency);
          }
        } catch (error) {
          metrics.errors++;
        }
      });
      
      ws.on('error', () => {
        metrics.errors++;
      });
      
      ws.on('close', () => {
        this.activeConnections.delete(ws);
      });
      
    } catch (error) {
      metrics.errors++;
    }
  }

  async benchmarkDatabaseOperations() {
    this.log('Benchmarking database operations...');
    
    const dbOperations = [
      { name: 'Read Operations', endpoint: '/api/positions', expectedLatency: 100 },
      { name: 'Write Operations', endpoint: '/api/config', expectedLatency: 200 },
      { name: 'Complex Queries', endpoint: '/api/analytics/performance', expectedLatency: 300 },
      { name: 'Aggregations', endpoint: '/api/market/aggregated', expectedLatency: 250 }
    ];
    
    const dbResults = {};
    
    for (const operation of dbOperations) {
      const operationResults = await this.benchmarkSingleEndpoint(operation);
      dbResults[operation.name] = operationResults;
      
      if (operationResults.passed) {
        this.results.summary.passed++;
      } else {
        this.results.summary.failed++;
      }
      this.results.summary.totalTests++;
    }
    
    this.results.performanceBenchmarks.database = dbResults;
  }

  async benchmarkCacheOperations() {
    this.log('Benchmarking cache operations...');
    
    const cacheOperations = [
      { name: 'Cache Hit', endpoint: '/api/market/ticker/BTCUSDT', expectedLatency: 50 },
      { name: 'Cache Miss', endpoint: '/api/market/ticker/NEWCOIN', expectedLatency: 150 }
    ];
    
    const cacheResults = {};
    
    for (const operation of cacheOperations) {
      const operationResults = await this.benchmarkSingleEndpoint(operation);
      cacheResults[operation.name] = operationResults;
      
      if (operationResults.passed) {
        this.results.summary.passed++;
      } else {
        this.results.summary.failed++;
      }
      this.results.summary.totalTests++;
    }
    
    this.results.performanceBenchmarks.cache = cacheResults;
  }

  // Sub-task 3: Implement stress testing for market data processing
  async runMarketDataStressTesting() {
    this.log('⚡ Running stress testing for market data processing...');
    
    await this.stressTestMarketDataIngestion();
    await this.stressTestTechnicalIndicators();
    await this.stressTestDataAggregation();
    await this.stressTestRealTimeProcessing();
  }

  async stressTestMarketDataIngestion() {
    this.log('Stress testing market data ingestion...');
    
    const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT', 'BNBUSDT', 'XRPUSDT', 'SOLUSDT'];
    const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
    const concurrentRequests = 200;
    
    const startTime = performance.now();
    const promises = [];
    const results = { success: 0, errors: 0, latencies: [] };
    
    for (let i = 0; i < concurrentRequests; i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const timeframe = timeframes[Math.floor(Math.random() * timeframes.length)];
      
      const promise = this.makeRequest(
        `${this.config.baseUrl}:${this.config.apiPort}/api/market/candles/${symbol}?timeframe=${timeframe}&limit=1000`
      ).then(response => {
        results.success++;
        results.latencies.push(response.latency);
      }).catch(() => {
        results.errors++;
      });
      
      promises.push(promise);
    }
    
    await Promise.all(promises);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const throughput = concurrentRequests / (duration / 1000);
    const errorRate = (results.errors / concurrentRequests) * 100;
    const avgLatency = results.latencies.length > 0 ? 
      results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length : 0;
    
    const passed = errorRate < 10 && avgLatency < 2000 && throughput > 10;
    
    this.results.stressTests.marketDataIngestion = {
      concurrentRequests,
      duration: duration.toFixed(2),
      throughput: throughput.toFixed(2),
      errorRate: errorRate.toFixed(2),
      avgLatency: avgLatency.toFixed(2),
      passed
    };
    
    if (passed) {
      this.results.summary.passed++;
    } else {
      this.results.summary.failed++;
    }
    this.results.summary.totalTests++;
    
    this.log('Market data ingestion stress test completed', this.results.stressTests.marketDataIngestion);
  }

  async stressTestTechnicalIndicators() {
    this.log('Stress testing technical indicators calculation...');
    
    const indicators = ['rsi', 'macd', 'bollinger', 'ema', 'sma'];
    const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'];
    const concurrentRequests = 100;
    
    const startTime = performance.now();
    const promises = [];
    const results = { success: 0, errors: 0, latencies: [] };
    
    for (let i = 0; i < concurrentRequests; i++) {
      const indicator = indicators[Math.floor(Math.random() * indicators.length)];
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      
      const promise = this.makeRequest(
        `${this.config.baseUrl}:${this.config.apiPort}/api/indicators/${indicator}/${symbol}?period=14&limit=100`
      ).then(response => {
        results.success++;
        results.latencies.push(response.latency);
      }).catch(() => {
        results.errors++;
      });
      
      promises.push(promise);
    }
    
    await Promise.all(promises);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const throughput = concurrentRequests / (duration / 1000);
    const errorRate = (results.errors / concurrentRequests) * 100;
    const avgLatency = results.latencies.length > 0 ? 
      results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length : 0;
    
    const passed = errorRate < 15 && avgLatency < 3000 && throughput > 5;
    
    this.results.stressTests.technicalIndicators = {
      concurrentRequests,
      duration: duration.toFixed(2),
      throughput: throughput.toFixed(2),
      errorRate: errorRate.toFixed(2),
      avgLatency: avgLatency.toFixed(2),
      passed
    };
    
    if (passed) {
      this.results.summary.passed++;
    } else {
      this.results.summary.failed++;
    }
    this.results.summary.totalTests++;
    
    this.log('Technical indicators stress test completed', this.results.stressTests.technicalIndicators);
  }

  async stressTestDataAggregation() {
    this.log('Stress testing data aggregation...');
    
    const aggregationTypes = ['volume', 'price', 'trades', 'orderbook'];
    const timeRanges = ['1h', '4h', '1d', '7d'];
    const concurrentRequests = 50;
    
    const startTime = performance.now();
    const promises = [];
    const results = { success: 0, errors: 0, latencies: [] };
    
    for (let i = 0; i < concurrentRequests; i++) {
      const type = aggregationTypes[Math.floor(Math.random() * aggregationTypes.length)];
      const range = timeRanges[Math.floor(Math.random() * timeRanges.length)];
      
      const promise = this.makeRequest(
        `${this.config.baseUrl}:${this.config.apiPort}/api/analytics/aggregation?type=${type}&range=${range}`
      ).then(response => {
        results.success++;
        results.latencies.push(response.latency);
      }).catch(() => {
        results.errors++;
      });
      
      promises.push(promise);
    }
    
    await Promise.all(promises);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const throughput = concurrentRequests / (duration / 1000);
    const errorRate = (results.errors / concurrentRequests) * 100;
    const avgLatency = results.latencies.length > 0 ? 
      results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length : 0;
    
    const passed = errorRate < 20 && avgLatency < 5000 && throughput > 2;
    
    this.results.stressTests.dataAggregation = {
      concurrentRequests,
      duration: duration.toFixed(2),
      throughput: throughput.toFixed(2),
      errorRate: errorRate.toFixed(2),
      avgLatency: avgLatency.toFixed(2),
      passed
    };
    
    if (passed) {
      this.results.summary.passed++;
    } else {
      this.results.summary.failed++;
    }
    this.results.summary.totalTests++;
    
    this.log('Data aggregation stress test completed', this.results.stressTests.dataAggregation);
  }

  async stressTestRealTimeProcessing() {
    this.log('Stress testing real-time data processing...');
    
    return new Promise((resolve) => {
      const connections = 20;
      const duration = 60000; // 1 minute
      const metrics = {
        connectionsEstablished: 0,
        messagesProcessed: 0,
        processingLatencies: [],
        errors: 0
      };
      
      // Create multiple WebSocket connections for real-time data
      for (let i = 0; i < connections; i++) {
        setTimeout(() => {
          this.createRealTimeStressConnection(metrics);
        }, i * 50);
      }
      
      setTimeout(() => {
        // Close all connections
        this.activeConnections.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        });
        this.activeConnections.clear();
        
        const messageRate = metrics.messagesProcessed / (duration / 1000);
        const avgProcessingLatency = metrics.processingLatencies.length > 0 ? 
          metrics.processingLatencies.reduce((a, b) => a + b, 0) / metrics.processingLatencies.length : 0;
        const errorRate = (metrics.errors / connections) * 100;
        
        const passed = (
          metrics.connectionsEstablished >= connections * 0.8 &&
          messageRate >= 50 && // At least 50 messages per second
          avgProcessingLatency <= 100 && // Max 100ms processing latency
          errorRate < 10
        );
        
        this.results.stressTests.realTimeProcessing = {
          connections,
          connectionsEstablished: metrics.connectionsEstablished,
          messagesProcessed: metrics.messagesProcessed,
          messageRate: messageRate.toFixed(2),
          avgProcessingLatency: avgProcessingLatency.toFixed(2),
          errorRate: errorRate.toFixed(2),
          passed
        };
        
        if (passed) {
          this.results.summary.passed++;
        } else {
          this.results.summary.failed++;
        }
        this.results.summary.totalTests++;
        
        this.log('Real-time processing stress test completed', this.results.stressTests.realTimeProcessing);
        resolve();
      }, duration);
    });
  }

  createRealTimeStressConnection(metrics) {
    try {
      const wsUrl = `wss://localhost:${this.config.wsPort}/ws/market-data`;
      const ws = new WebSocket(wsUrl, { rejectUnauthorized: false });
      
      this.activeConnections.add(ws);
      
      ws.on('open', () => {
        metrics.connectionsEstablished++;
        
        // Subscribe to high-frequency data
        ws.send(JSON.stringify({
          type: 'subscribe',
          channels: ['ticker', 'trades', 'orderbook'],
          symbols: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT']
        }));
      });
      
      ws.on('message', (data) => {
        const receiveTime = Date.now();
        
        try {
          const message = JSON.parse(data);
          metrics.messagesProcessed++;
          
          // Simulate processing time
          if (message.timestamp) {
            const processingLatency = receiveTime - new Date(message.timestamp).getTime();
            metrics.processingLatencies.push(processingLatency);
          }
        } catch (error) {
          metrics.errors++;
        }
      });
      
      ws.on('error', () => {
        metrics.errors++;
      });
      
      ws.on('close', () => {
        this.activeConnections.delete(ws);
      });
      
    } catch (error) {
      metrics.errors++;
    }
  }

  // Sub-task 4: Add memory and resource usage optimization testing
  async runResourceUsageOptimizationTesting() {
    this.log('💻 Running memory and resource usage optimization testing...');
    
    await this.startResourceMonitoring();
    await this.testMemoryUsageUnderLoad();
    await this.testCPUUsageUnderLoad();
    await this.testConnectionPooling();
    await this.testGarbageCollection();
    await this.stopResourceMonitoring();
  }

  async startResourceMonitoring() {
    this.log('Starting resource monitoring...');
    
    this.resourceMetrics = {
      memory: [],
      cpu: [],
      connections: [],
      gc: []
    };
    
    this.resourceMonitor = setInterval(async () => {
      try {
        const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}/health/performance`);
        
        if (response.statusCode === 200) {
          const metrics = JSON.parse(response.data);
          
          this.resourceMetrics.memory.push({
            timestamp: Date.now(),
            heapUsed: metrics.heapUsed || 0,
            heapTotal: metrics.heapTotal || 0,
            external: metrics.external || 0,
            rss: metrics.rss || 0
          });
          
          this.resourceMetrics.cpu.push({
            timestamp: Date.now(),
            usage: metrics.cpuUsage || 0,
            loadAverage: metrics.loadAverage || []
          });
          
          this.resourceMetrics.connections.push({
            timestamp: Date.now(),
            active: metrics.activeConnections || 0,
            total: metrics.totalConnections || 0
          });
        }
      } catch (error) {
        // Ignore monitoring errors
      }
    }, 1000);
  }

  async stopResourceMonitoring() {
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
      this.resourceMonitor = null;
    }
  }

  async testMemoryUsageUnderLoad() {
    this.log('Testing memory usage under load...');
    
    const initialMemory = this.getCurrentMemoryUsage();
    
    // Generate memory load
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(
        this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}/api/market/candles/BTCUSDT?limit=1000`)
          .catch(() => {})
      );
    }
    
    await Promise.all(promises);
    
    // Wait for potential memory cleanup
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const finalMemory = this.getCurrentMemoryUsage();
    const memoryIncrease = finalMemory - initialMemory;
    const memoryIncreasePercent = (memoryIncrease / initialMemory) * 100;
    
    const passed = memoryIncreasePercent < 50; // Less than 50% memory increase
    
    this.results.resourceTests.memoryUsage = {
      initialMemory: (initialMemory / 1024 / 1024).toFixed(2) + ' MB',
      finalMemory: (finalMemory / 1024 / 1024).toFixed(2) + ' MB',
      memoryIncrease: (memoryIncrease / 1024 / 1024).toFixed(2) + ' MB',
      memoryIncreasePercent: memoryIncreasePercent.toFixed(2) + '%',
      passed
    };
    
    if (passed) {
      this.results.summary.passed++;
    } else {
      this.results.summary.failed++;
    }
    this.results.summary.totalTests++;
    
    this.log('Memory usage test completed', this.results.resourceTests.memoryUsage);
  }

  async testCPUUsageUnderLoad() {
    this.log('Testing CPU usage under load...');
    
    const cpuMetricsBefore = this.resourceMetrics.cpu.slice(-5); // Last 5 measurements
    
    // Generate CPU load
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(
        this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}/api/indicators/rsi/BTCUSDT?period=14&limit=1000`)
          .catch(() => {})
      );
    }
    
    await Promise.all(promises);
    
    // Wait for CPU measurements
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    const cpuMetricsAfter = this.resourceMetrics.cpu.slice(-5); // Last 5 measurements
    
    const avgCpuBefore = cpuMetricsBefore.length > 0 ? 
      cpuMetricsBefore.reduce((sum, m) => sum + m.usage, 0) / cpuMetricsBefore.length : 0;
    const avgCpuAfter = cpuMetricsAfter.length > 0 ? 
      cpuMetricsAfter.reduce((sum, m) => sum + m.usage, 0) / cpuMetricsAfter.length : 0;
    
    const cpuIncrease = avgCpuAfter - avgCpuBefore;
    const passed = avgCpuAfter < this.config.cpuThreshold; // Below CPU threshold
    
    this.results.resourceTests.cpuUsage = {
      avgCpuBefore: (avgCpuBefore * 100).toFixed(2) + '%',
      avgCpuAfter: (avgCpuAfter * 100).toFixed(2) + '%',
      cpuIncrease: (cpuIncrease * 100).toFixed(2) + '%',
      threshold: (this.config.cpuThreshold * 100).toFixed(2) + '%',
      passed
    };
    
    if (passed) {
      this.results.summary.passed++;
    } else {
      this.results.summary.failed++;
    }
    this.results.summary.totalTests++;
    
    this.log('CPU usage test completed', this.results.resourceTests.cpuUsage);
  }

  async testConnectionPooling() {
    this.log('Testing connection pooling efficiency...');
    
    const connectionsBefore = this.getCurrentConnectionCount();
    
    // Create multiple concurrent connections
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(
        this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}/api/market/ticker/BTCUSDT`)
          .catch(() => {})
      );
    }
    
    await Promise.all(promises);
    
    const connectionsAfter = this.getCurrentConnectionCount();
    const connectionIncrease = connectionsAfter - connectionsBefore;
    
    // Good connection pooling should reuse connections
    const passed = connectionIncrease < 10; // Less than 10 new connections for 20 requests
    
    this.results.resourceTests.connectionPooling = {
      connectionsBefore,
      connectionsAfter,
      connectionIncrease,
      efficiency: ((20 - connectionIncrease) / 20 * 100).toFixed(2) + '%',
      passed
    };
    
    if (passed) {
      this.results.summary.passed++;
    } else {
      this.results.summary.failed++;
    }
    this.results.summary.totalTests++;
    
    this.log('Connection pooling test completed', this.results.resourceTests.connectionPooling);
  }

  async testGarbageCollection() {
    this.log('Testing garbage collection efficiency...');
    
    const initialHeap = this.getCurrentHeapUsage();
    
    // Generate objects that should be garbage collected
    const promises = [];
    for (let i = 0; i < 200; i++) {
      promises.push(
        this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}/api/market/symbols`)
          .catch(() => {})
      );
    }
    
    await Promise.all(promises);
    
    // Force garbage collection if possible
    if (global.gc) {
      global.gc();
    }
    
    // Wait for GC
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const finalHeap = this.getCurrentHeapUsage();
    const heapIncrease = finalHeap - initialHeap;
    const heapIncreasePercent = (heapIncrease / initialHeap) * 100;
    
    // Good GC should keep heap growth minimal
    const passed = heapIncreasePercent < 30; // Less than 30% heap increase
    
    this.results.resourceTests.garbageCollection = {
      initialHeap: (initialHeap / 1024 / 1024).toFixed(2) + ' MB',
      finalHeap: (finalHeap / 1024 / 1024).toFixed(2) + ' MB',
      heapIncrease: (heapIncrease / 1024 / 1024).toFixed(2) + ' MB',
      heapIncreasePercent: heapIncreasePercent.toFixed(2) + '%',
      passed
    };
    
    if (passed) {
      this.results.summary.passed++;
    } else {
      this.results.summary.failed++;
    }
    this.results.summary.totalTests++;
    
    this.log('Garbage collection test completed', this.results.resourceTests.garbageCollection);
  }

  getCurrentMemoryUsage() {
    const memoryMetrics = this.resourceMetrics.memory.slice(-1)[0];
    return memoryMetrics ? memoryMetrics.rss : process.memoryUsage().rss;
  }

  getCurrentHeapUsage() {
    const memoryMetrics = this.resourceMetrics.memory.slice(-1)[0];
    return memoryMetrics ? memoryMetrics.heapUsed : process.memoryUsage().heapUsed;
  }

  getCurrentConnectionCount() {
    const connectionMetrics = this.resourceMetrics.connections.slice(-1)[0];
    return connectionMetrics ? connectionMetrics.active : 0;
  }

  calculateLatencyStats(latencies) {
    if (latencies.length === 0) {
      return { min: '0.00', max: '0.00', avg: '0.00', p50: '0.00', p95: '0.00', p99: '0.00' };
    }
    
    const sorted = latencies.sort((a, b) => a - b);
    
    return {
      min: sorted[0].toFixed(2),
      max: sorted[sorted.length - 1].toFixed(2),
      avg: (sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2),
      p50: sorted[Math.floor(sorted.length * 0.5)].toFixed(2),
      p95: sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
      p99: sorted[Math.floor(sorted.length * 0.99)].toFixed(2)
    };
  }

  generateComprehensiveReport() {
    const testDuration = ((Date.now() - this.testStartTime) / 1000).toFixed(2);
    const successRate = this.results.summary.totalTests > 0 ? 
      ((this.results.summary.passed / this.results.summary.totalTests) * 100).toFixed(2) : 0;
    
    const report = {
      timestamp: new Date().toISOString(),
      testDuration: `${testDuration}s`,
      config: this.config,
      summary: {
        totalTests: this.results.summary.totalTests,
        passed: this.results.summary.passed,
        failed: this.results.summary.failed,
        warnings: this.results.summary.warnings,
        successRate: `${successRate}%`
      },
      results: {
        loadTests: this.results.loadTests,
        performanceBenchmarks: this.results.performanceBenchmarks,
        stressTests: this.results.stressTests,
        resourceTests: this.results.resourceTests
      },
      resourceMetrics: this.generateResourceSummary(),
      recommendations: this.generateOptimizationRecommendations()
    };
    
    return report;
  }

  generateResourceSummary() {
    if (!this.resourceMetrics || this.resourceMetrics.memory.length === 0) {
      return null;
    }
    
    const memoryStats = this.calculateResourceStats(this.resourceMetrics.memory, 'heapUsed');
    const cpuStats = this.calculateResourceStats(this.resourceMetrics.cpu, 'usage');
    
    return {
      memory: {
        avgHeapUsed: (memoryStats.avg / 1024 / 1024).toFixed(2) + ' MB',
        maxHeapUsed: (memoryStats.max / 1024 / 1024).toFixed(2) + ' MB',
        samples: memoryStats.samples
      },
      cpu: {
        avgUsage: (cpuStats.avg * 100).toFixed(2) + '%',
        maxUsage: (cpuStats.max * 100).toFixed(2) + '%',
        samples: cpuStats.samples
      }
    };
  }

  calculateResourceStats(metrics, field) {
    if (metrics.length === 0) {
      return { avg: 0, max: 0, samples: 0 };
    }
    
    const values = metrics.map(m => m[field]).filter(v => v !== undefined);
    
    return {
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      max: Math.max(...values),
      samples: values.length
    };
  }

  generateOptimizationRecommendations() {
    const recommendations = [];
    
    // Load test recommendations
    Object.entries(this.results.loadTests).forEach(([scenario, result]) => {
      if (!result.passed) {
        if (result.errorRate > 5) {
          recommendations.push({
            category: 'Reliability',
            priority: 'High',
            issue: `High error rate in ${scenario} (${result.errorRate}%)`,
            suggestions: [
              'Implement circuit breakers',
              'Add retry logic with exponential backoff',
              'Review error handling in critical paths',
              'Monitor external service dependencies'
            ]
          });
        }
        
        if (result.throughput < this.config.targetThroughput * 0.5) {
          recommendations.push({
            category: 'Performance',
            priority: 'High',
            issue: `Low throughput in ${scenario} (${result.throughput} req/s)`,
            suggestions: [
              'Implement horizontal scaling',
              'Optimize database queries',
              'Add caching layers',
              'Consider async processing'
            ]
          });
        }
      }
    });
    
    // Performance benchmark recommendations
    Object.entries(this.results.performanceBenchmarks.apiEndpoints || {}).forEach(([endpoint, result]) => {
      if (!result.passed) {
        recommendations.push({
          category: 'API Performance',
          priority: 'Medium',
          issue: `Slow response time for ${endpoint} (${result.latencyStats.avg}ms)`,
          suggestions: [
            'Optimize endpoint logic',
            'Add response caching',
            'Review database queries',
            'Consider pagination for large datasets'
          ]
        });
      }
    });
    
    // Resource usage recommendations
    if (this.results.resourceTests.memoryUsage && !this.results.resourceTests.memoryUsage.passed) {
      recommendations.push({
        category: 'Memory Management',
        priority: 'High',
        issue: `High memory usage increase (${this.results.resourceTests.memoryUsage.memoryIncreasePercent})`,
        suggestions: [
          'Review memory leaks',
          'Implement object pooling',
          'Optimize data structures',
          'Add memory monitoring alerts'
        ]
      });
    }
    
    if (this.results.resourceTests.cpuUsage && !this.results.resourceTests.cpuUsage.passed) {
      recommendations.push({
        category: 'CPU Optimization',
        priority: 'High',
        issue: `High CPU usage (${this.results.resourceTests.cpuUsage.avgCpuAfter})`,
        suggestions: [
          'Optimize computational algorithms',
          'Implement CPU-intensive task queuing',
          'Consider worker processes',
          'Profile and optimize hot code paths'
        ]
      });
    }
    
    return recommendations;
  }

  async run() {
    console.log('🚀 Starting Comprehensive Load Testing and Performance Validation...\n');
    console.log(`Target: ${this.config.baseUrl}:${this.config.apiPort}`);
    console.log(`Duration: ${this.config.duration / 1000}s`);
    console.log(`Concurrent Users: ${this.config.concurrentUsers}`);
    console.log(`Target Latency: ${this.config.targetLatency}ms`);
    console.log(`Target Throughput: ${this.config.targetThroughput} req/s\n`);
    
    this.results.resourceTests = {};
    
    try {
      // Run all test suites
      await this.runProductionTrafficSimulation();
      await this.runPerformanceBenchmarking();
      await this.runMarketDataStressTesting();
      await this.runResourceUsageOptimizationTesting();
      
    } catch (error) {
      this.log(`Load testing error: ${error.message}`);
      this.results.summary.failed++;
    }
    
    // Generate and save comprehensive report
    const report = this.generateComprehensiveReport();
    
    console.log('\n📊 Comprehensive Load Testing Summary:');
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`⚠️  Warnings: ${report.summary.warnings}`);
    console.log(`📈 Success Rate: ${report.summary.successRate}%`);
    console.log(`⏱️  Test Duration: ${report.testDuration}`);
    
    // Show key metrics
    if (report.resourceMetrics) {
      console.log(`\n💻 Resource Usage:`);
      console.log(`Memory: ${report.resourceMetrics.memory.avgHeapUsed} (avg), ${report.resourceMetrics.memory.maxHeapUsed} (max)`);
      console.log(`CPU: ${report.resourceMetrics.cpu.avgUsage} (avg), ${report.resourceMetrics.cpu.maxUsage} (max)`);
    }
    
    // Show recommendations
    if (report.recommendations.length > 0) {
      console.log('\n💡 Optimization Recommendations:');
      report.recommendations.forEach(rec => {
        console.log(`\n${rec.category} (${rec.priority}): ${rec.issue}`);
        rec.suggestions.forEach(suggestion => {
          console.log(`  • ${suggestion}`);
        });
      });
    }
    
    // Save detailed report
    const reportPath = 'comprehensive-load-testing-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    // Exit with appropriate code
    if (this.results.summary.failed > 0) {
      console.log('\n⚠️  Some load tests failed - Review and optimize');
      process.exit(1);
    } else {
      console.log('\n🎉 All load tests passed!');
      process.exit(0);
    }
  }
}

// CLI usage
if (require.main === module) {
  const config = {};
  
  // Parse command line arguments
  process.argv.forEach((arg, index) => {
    if (arg === '--url' && process.argv[index + 1]) {
      config.baseUrl = process.argv[index + 1];
    }
    if (arg === '--duration' && process.argv[index + 1]) {
      config.duration = parseInt(process.argv[index + 1]) * 1000;
    }
    if (arg === '--users' && process.argv[index + 1]) {
      config.concurrentUsers = parseInt(process.argv[index + 1]);
    }
    if (arg === '--target-latency' && process.argv[index + 1]) {
      config.targetLatency = parseInt(process.argv[index + 1]);
    }
    if (arg === '--target-throughput' && process.argv[index + 1]) {
      config.targetThroughput = parseInt(process.argv[index + 1]);
    }
  });
  
  const tester = new ComprehensiveLoadTester(config);
  tester.run().catch(error => {
    console.error('Comprehensive load testing failed:', error);
    process.exit(1);
  });
}

module.exports = ComprehensiveLoadTester;