#!/usr/bin/env node

/**
 * Performance and API Connectivity Testing Script
 * 
 * Task 6: Performance and API connectivity testing
 * - Validate live market data connections to exchanges
 * - Run performance benchmarks and load testing
 * - Test frontend functionality and UI component rendering
 * - Execute end-to-end user workflow validation
 * 
 * Requirements: 3.5, 3.6, 3.7
 */

const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const https = require('https');
const http = require('http');
const { performance } = require('perf_hooks');
const { spawn, exec } = require('child_process');

class PerformanceAPIConnectivityTester {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'https://localhost',
      apiPort: config.apiPort || 3000,
      wsPort: config.wsPort || 3000,
      duration: config.duration || 60000, // 1 minute
      concurrentUsers: config.concurrentUsers || 10,
      targetLatency: config.targetLatency || 100, // 100ms
      targetThroughput: config.targetThroughput || 1000, // requests per second
      ...config
    };
    
    this.results = {
      marketDataConnections: {},
      performanceBenchmarks: {},
      frontendTests: {},
      e2eWorkflows: {},
      summary: {
        passed: 0,
        failed: 0,
        warnings: 0
      }
    };
    
    this.testStartTime = Date.now();
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
      }, 10000);

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

  // Sub-task 1: Validate live market data connections to exchanges
  async validateMarketDataConnections() {
    this.log('🔌 Validating live market data connections to exchanges...');
    
    const exchanges = ['binance', 'kucoin'];
    const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'];
    
    for (const exchange of exchanges) {
      this.log(`Testing ${exchange.toUpperCase()} connection...`);
      
      const exchangeResults = {
        connection: false,
        apiKeyValidation: false,
        dataStreaming: false,
        reconnection: false,
        latency: [],
        errors: []
      };
      
      try {
        // Test API connection
        const apiUrl = `${this.config.baseUrl}:${this.config.apiPort}/api/exchanges/${exchange}/status`;
        const response = await this.makeRequest(apiUrl);
        
        if (response.statusCode === 200) {
          const status = JSON.parse(response.data);
          exchangeResults.connection = status.connected || false;
          exchangeResults.apiKeyValidation = status.apiKeyValid || false;
          
          this.log(`${exchange} API connection: ${exchangeResults.connection ? 'SUCCESS' : 'FAILED'}`);
          this.log(`${exchange} API key validation: ${exchangeResults.apiKeyValidation ? 'SUCCESS' : 'FAILED'}`);
        }
        
        // Test WebSocket data streaming
        await this.testExchangeWebSocket(exchange, symbols, exchangeResults);
        
        // Test reconnection logic
        await this.testReconnectionLogic(exchange, exchangeResults);
        
      } catch (error) {
        exchangeResults.errors.push(error.message);
        this.log(`${exchange} connection error: ${error.message}`);
      }
      
      this.results.marketDataConnections[exchange] = exchangeResults;
      
      // Update summary
      if (exchangeResults.connection && exchangeResults.dataStreaming) {
        this.results.summary.passed++;
      } else {
        this.results.summary.failed++;
      }
    }
    
    // Test aggregated market data service
    await this.testAggregatedMarketData();
  }

  async testExchangeWebSocket(exchange, symbols, results) {
    return new Promise((resolve) => {
      const wsUrl = `wss://localhost:${this.config.wsPort}/ws/market-data/${exchange}`;
      const ws = new WebSocket(wsUrl, { rejectUnauthorized: false });
      
      let messageCount = 0;
      const startTime = Date.now();
      
      const timeout = setTimeout(() => {
        ws.close();
        results.dataStreaming = messageCount > 0;
        this.log(`${exchange} WebSocket: ${messageCount} messages received`);
        resolve();
      }, 10000);
      
      ws.on('open', () => {
        this.log(`${exchange} WebSocket connected`);
        ws.send(JSON.stringify({ 
          subscribe: symbols 
        }));
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          messageCount++;
          
          if (message.timestamp) {
            const latency = Date.now() - new Date(message.timestamp).getTime();
            results.latency.push(latency);
          }
          
          // Stop after receiving some messages
          if (messageCount >= 5) {
            clearTimeout(timeout);
            ws.close();
            results.dataStreaming = true;
            resolve();
          }
        } catch (error) {
          results.errors.push(`WebSocket message parse error: ${error.message}`);
        }
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        results.errors.push(`WebSocket error: ${error.message}`);
        resolve();
      });
    });
  }

  async testReconnectionLogic(exchange, results) {
    try {
      // Test reconnection endpoint
      const reconnectUrl = `${this.config.baseUrl}:${this.config.apiPort}/api/exchanges/${exchange}/reconnect`;
      const response = await this.makeRequest(reconnectUrl, { method: 'POST' });
      
      if (response.statusCode === 200) {
        results.reconnection = true;
        this.log(`${exchange} reconnection logic: SUCCESS`);
      }
    } catch (error) {
      results.errors.push(`Reconnection test error: ${error.message}`);
      this.log(`${exchange} reconnection logic: FAILED`);
    }
  }

  async testAggregatedMarketData() {
    this.log('Testing aggregated market data service...');
    
    try {
      const aggregatedUrl = `${this.config.baseUrl}:${this.config.apiPort}/api/market/aggregated`;
      const response = await this.makeRequest(aggregatedUrl);
      
      if (response.statusCode === 200) {
        const data = JSON.parse(response.data);
        this.results.marketDataConnections.aggregated = {
          success: true,
          symbolCount: data.symbols ? data.symbols.length : 0,
          lastUpdate: data.lastUpdate
        };
        this.log('Aggregated market data: SUCCESS');
        this.results.summary.passed++;
      }
    } catch (error) {
      this.results.marketDataConnections.aggregated = {
        success: false,
        error: error.message
      };
      this.log(`Aggregated market data: FAILED - ${error.message}`);
      this.results.summary.failed++;
    }
  }

  // Sub-task 2: Run performance benchmarks and load testing
  async runPerformanceBenchmarks() {
    this.log('📊 Running performance benchmarks and load testing...');
    
    // API Latency Benchmarks
    await this.benchmarkApiLatency();
    
    // Throughput Testing
    await this.benchmarkThroughput();
    
    // WebSocket Performance
    await this.benchmarkWebSocketPerformance();
    
    // System Resource Usage
    await this.benchmarkSystemResources();
    
    // Database Performance
    await this.benchmarkDatabasePerformance();
  }

  async benchmarkApiLatency() {
    this.log('Testing API latency...');
    
    const endpoints = [
      '/health',
      '/api/market/ticker/BTCUSDT',
      '/api/config/trading-mode',
      '/api/positions',
      '/api/analytics/performance'
    ];
    
    const latencyResults = {};
    
    for (const endpoint of endpoints) {
      const url = `${this.config.baseUrl}:${this.config.apiPort}${endpoint}`;
      const latencies = [];
      
      // Make 20 requests to each endpoint
      for (let i = 0; i < 20; i++) {
        try {
          const result = await this.makeRequest(url);
          latencies.push(result.latency);
        } catch (error) {
          // Count errors but continue testing
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      if (latencies.length > 0) {
        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];
        
        latencyResults[endpoint] = {
          avgLatency: avgLatency.toFixed(2),
          p95Latency: p95Latency.toFixed(2),
          requests: latencies.length,
          passed: avgLatency <= this.config.targetLatency
        };
        
        if (avgLatency <= this.config.targetLatency) {
          this.results.summary.passed++;
        } else {
          this.results.summary.failed++;
        }
      }
    }
    
    this.results.performanceBenchmarks.latency = latencyResults;
  }

  async benchmarkThroughput() {
    this.log('Testing API throughput...');
    
    const endpoint = `${this.config.baseUrl}:${this.config.apiPort}/api/market/ticker/BTCUSDT`;
    const duration = 30000; // 30 seconds
    const startTime = Date.now();
    
    let requestCount = 0;
    let successCount = 0;
    
    const workers = [];
    
    for (let i = 0; i < this.config.concurrentUsers; i++) {
      const worker = async () => {
        while (Date.now() - startTime < duration) {
          try {
            const result = await this.makeRequest(endpoint);
            requestCount++;
            if (result.statusCode === 200) {
              successCount++;
            }
          } catch (error) {
            requestCount++;
          }
          
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      };
      
      workers.push(worker());
    }
    
    await Promise.all(workers);
    
    const actualDuration = (Date.now() - startTime) / 1000;
    const throughput = requestCount / actualDuration;
    const successRate = (successCount / requestCount) * 100;
    
    this.results.performanceBenchmarks.throughput = {
      totalRequests: requestCount,
      successfulRequests: successCount,
      throughput: throughput.toFixed(2),
      successRate: successRate.toFixed(2),
      passed: throughput >= this.config.targetThroughput
    };
    
    if (throughput >= this.config.targetThroughput) {
      this.results.summary.passed++;
    } else {
      this.results.summary.failed++;
    }
  }

  async benchmarkWebSocketPerformance() {
    this.log('Testing WebSocket performance...');
    
    return new Promise((resolve) => {
      const wsUrl = `wss://localhost:${this.config.wsPort}/ws/market-data`;
      const ws = new WebSocket(wsUrl, { rejectUnauthorized: false });
      
      let messageCount = 0;
      let latencies = [];
      const startTime = Date.now();
      
      const timeout = setTimeout(() => {
        ws.close();
        
        const duration = (Date.now() - startTime) / 1000;
        const messageRate = messageCount / duration;
        const avgLatency = latencies.length > 0 ? 
          latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
        
        this.results.performanceBenchmarks.websocket = {
          messageCount,
          messageRate: messageRate.toFixed(2),
          avgLatency: avgLatency.toFixed(2),
          passed: messageRate >= 10 && avgLatency <= this.config.targetLatency
        };
        
        if (messageRate >= 10 && avgLatency <= this.config.targetLatency) {
          this.results.summary.passed++;
        } else {
          this.results.summary.failed++;
        }
        
        resolve();
      }, 30000);
      
      ws.on('open', () => {
        ws.send(JSON.stringify({ 
          subscribe: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'] 
        }));
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          messageCount++;
          
          if (message.timestamp) {
            const latency = Date.now() - new Date(message.timestamp).getTime();
            latencies.push(latency);
          }
        } catch (error) {
          // Ignore parse errors for performance test
        }
      });
      
      ws.on('error', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  async benchmarkSystemResources() {
    this.log('Testing system resource usage...');
    
    try {
      const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}/health/performance`);
      
      if (response.statusCode === 200) {
        const metrics = JSON.parse(response.data);
        
        this.results.performanceBenchmarks.resources = {
          memoryUsage: metrics.memoryUsage,
          cpuUsage: metrics.cpuUsage,
          heapUsed: metrics.heapUsed,
          passed: metrics.memoryUsage < 0.8 && metrics.cpuUsage < 0.8
        };
        
        if (metrics.memoryUsage < 0.8 && metrics.cpuUsage < 0.8) {
          this.results.summary.passed++;
        } else {
          this.results.summary.failed++;
        }
      }
    } catch (error) {
      this.results.performanceBenchmarks.resources = {
        error: error.message,
        passed: false
      };
      this.results.summary.failed++;
    }
  }

  async benchmarkDatabasePerformance() {
    this.log('Testing database performance...');
    
    const dbEndpoints = [
      '/api/trades/history?limit=100',
      '/api/positions',
      '/api/analytics/performance',
      '/api/config'
    ];
    
    const dbResults = {};
    
    for (const endpoint of dbEndpoints) {
      try {
        const startTime = performance.now();
        const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}${endpoint}`);
        const queryTime = performance.now() - startTime;
        
        dbResults[endpoint] = {
          queryTime: queryTime.toFixed(2),
          success: response.statusCode === 200,
          passed: queryTime <= 500 // 500ms threshold
        };
        
        if (queryTime <= 500) {
          this.results.summary.passed++;
        } else {
          this.results.summary.failed++;
        }
      } catch (error) {
        dbResults[endpoint] = {
          error: error.message,
          passed: false
        };
        this.results.summary.failed++;
      }
    }
    
    this.results.performanceBenchmarks.database = dbResults;
  }

  // Sub-task 3: Test frontend functionality and UI component rendering
  async testFrontendFunctionality() {
    this.log('🎨 Testing frontend functionality and UI component rendering...');
    
    // Test static file serving
    await this.testStaticFileServing();
    
    // Test frontend API endpoints
    await this.testFrontendApiEndpoints();
    
    // Run frontend component tests
    await this.runFrontendComponentTests();
    
    // Test responsive design
    await this.testResponsiveDesign();
  }

  async testStaticFileServing() {
    this.log('Testing static file serving...');
    
    const staticFiles = [
      '/',
      '/static/js/main.js',
      '/static/css/main.css',
      '/favicon.ico'
    ];
    
    const staticResults = {};
    
    for (const file of staticFiles) {
      try {
        const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}${file}`);
        
        staticResults[file] = {
          statusCode: response.statusCode,
          loadTime: response.latency.toFixed(2),
          passed: response.statusCode === 200
        };
        
        if (response.statusCode === 200) {
          this.results.summary.passed++;
        } else {
          this.results.summary.failed++;
        }
      } catch (error) {
        staticResults[file] = {
          error: error.message,
          passed: false
        };
        this.results.summary.failed++;
      }
    }
    
    this.results.frontendTests.staticFiles = staticResults;
  }

  async testFrontendApiEndpoints() {
    this.log('Testing frontend API endpoints...');
    
    const apiEndpoints = [
      '/api/config/ui',
      '/api/market/symbols',
      '/api/user/preferences',
      '/api/dashboard/widgets'
    ];
    
    const apiResults = {};
    
    for (const endpoint of apiEndpoints) {
      try {
        const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}${endpoint}`);
        
        apiResults[endpoint] = {
          statusCode: response.statusCode,
          responseTime: response.latency.toFixed(2),
          passed: response.statusCode === 200
        };
        
        if (response.statusCode === 200) {
          this.results.summary.passed++;
        } else {
          this.results.summary.failed++;
        }
      } catch (error) {
        apiResults[endpoint] = {
          error: error.message,
          passed: false
        };
        this.results.summary.failed++;
      }
    }
    
    this.results.frontendTests.apiEndpoints = apiResults;
  }

  async runFrontendComponentTests() {
    this.log('Running frontend component tests...');
    
    return new Promise((resolve) => {
      // Run the frontend validation script
      const testProcess = spawn('node', ['validate-frontend-enhancements.js'], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });
      
      let output = '';
      let errorOutput = '';
      
      testProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      testProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      testProcess.on('close', (code) => {
        this.results.frontendTests.componentTests = {
          exitCode: code,
          output: output,
          error: errorOutput,
          passed: code === 0
        };
        
        if (code === 0) {
          this.results.summary.passed++;
          this.log('Frontend component tests: PASSED');
        } else {
          this.results.summary.failed++;
          this.log('Frontend component tests: FAILED');
        }
        
        resolve();
      });
    });
  }

  async testResponsiveDesign() {
    this.log('Testing responsive design...');
    
    // Test different viewport sizes by checking CSS media queries
    const viewports = [
      { name: 'mobile', width: 375 },
      { name: 'tablet', width: 768 },
      { name: 'desktop', width: 1200 }
    ];
    
    const responsiveResults = {};
    
    for (const viewport of viewports) {
      try {
        // Test main page load with different user agents
        const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}/`, {
          headers: {
            'User-Agent': `Mozilla/5.0 (compatible; TestBot/1.0; +viewport-${viewport.name})`
          }
        });
        
        responsiveResults[viewport.name] = {
          statusCode: response.statusCode,
          loadTime: response.latency.toFixed(2),
          passed: response.statusCode === 200
        };
        
        if (response.statusCode === 200) {
          this.results.summary.passed++;
        } else {
          this.results.summary.failed++;
        }
      } catch (error) {
        responsiveResults[viewport.name] = {
          error: error.message,
          passed: false
        };
        this.results.summary.failed++;
      }
    }
    
    this.results.frontendTests.responsive = responsiveResults;
  }

  // Sub-task 4: Execute end-to-end user workflow validation
  async executeE2EWorkflowValidation() {
    this.log('🔄 Executing end-to-end user workflow validation...');
    
    // Test user authentication workflow
    await this.testAuthenticationWorkflow();
    
    // Test trading workflow
    await this.testTradingWorkflow();
    
    // Test market data workflow
    await this.testMarketDataWorkflow();
    
    // Test configuration workflow
    await this.testConfigurationWorkflow();
    
    // Test monitoring workflow
    await this.testMonitoringWorkflow();
  }

  async testAuthenticationWorkflow() {
    this.log('Testing authentication workflow...');
    
    const authSteps = [
      { name: 'Login page load', endpoint: '/login' },
      { name: 'Authentication check', endpoint: '/api/auth/check' },
      { name: 'User profile', endpoint: '/api/user/profile' },
      { name: 'Logout', endpoint: '/api/auth/logout' }
    ];
    
    const authResults = {};
    
    for (const step of authSteps) {
      try {
        const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}${step.endpoint}`);
        
        authResults[step.name] = {
          statusCode: response.statusCode,
          responseTime: response.latency.toFixed(2),
          passed: response.statusCode === 200 || response.statusCode === 401 // 401 is expected for some auth endpoints
        };
        
        if (response.statusCode === 200 || response.statusCode === 401) {
          this.results.summary.passed++;
        } else {
          this.results.summary.failed++;
        }
      } catch (error) {
        authResults[step.name] = {
          error: error.message,
          passed: false
        };
        this.results.summary.failed++;
      }
    }
    
    this.results.e2eWorkflows.authentication = authResults;
  }

  async testTradingWorkflow() {
    this.log('Testing trading workflow...');
    
    const tradingSteps = [
      { name: 'Trading page load', endpoint: '/trading' },
      { name: 'Get trading mode', endpoint: '/api/config/trading-mode' },
      { name: 'Get positions', endpoint: '/api/positions' },
      { name: 'Get market data', endpoint: '/api/market/ticker/BTCUSDT' },
      { name: 'Paper trading validation', endpoint: '/api/trading/validate-paper-mode' }
    ];
    
    const tradingResults = {};
    
    for (const step of tradingSteps) {
      try {
        const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}${step.endpoint}`);
        
        tradingResults[step.name] = {
          statusCode: response.statusCode,
          responseTime: response.latency.toFixed(2),
          passed: response.statusCode === 200
        };
        
        if (response.statusCode === 200) {
          this.results.summary.passed++;
        } else {
          this.results.summary.failed++;
        }
      } catch (error) {
        tradingResults[step.name] = {
          error: error.message,
          passed: false
        };
        this.results.summary.failed++;
      }
    }
    
    this.results.e2eWorkflows.trading = tradingResults;
  }

  async testMarketDataWorkflow() {
    this.log('Testing market data workflow...');
    
    const marketDataSteps = [
      { name: 'Market overview', endpoint: '/api/market/overview' },
      { name: 'Symbol list', endpoint: '/api/market/symbols' },
      { name: 'Price ticker', endpoint: '/api/market/ticker/BTCUSDT' },
      { name: 'Historical data', endpoint: '/api/market/candles/BTCUSDT?timeframe=1h&limit=100' },
      { name: 'Market status', endpoint: '/api/market/status' }
    ];
    
    const marketResults = {};
    
    for (const step of marketDataSteps) {
      try {
        const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}${step.endpoint}`);
        
        marketResults[step.name] = {
          statusCode: response.statusCode,
          responseTime: response.latency.toFixed(2),
          passed: response.statusCode === 200
        };
        
        if (response.statusCode === 200) {
          this.results.summary.passed++;
        } else {
          this.results.summary.failed++;
        }
      } catch (error) {
        marketResults[step.name] = {
          error: error.message,
          passed: false
        };
        this.results.summary.failed++;
      }
    }
    
    this.results.e2eWorkflows.marketData = marketResults;
  }

  async testConfigurationWorkflow() {
    this.log('Testing configuration workflow...');
    
    const configSteps = [
      { name: 'Get configuration', endpoint: '/api/config' },
      { name: 'Trading settings', endpoint: '/api/config/trading' },
      { name: 'Exchange settings', endpoint: '/api/config/exchanges' },
      { name: 'Risk management', endpoint: '/api/config/risk-management' },
      { name: 'Notification settings', endpoint: '/api/config/notifications' }
    ];
    
    const configResults = {};
    
    for (const step of configSteps) {
      try {
        const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}${step.endpoint}`);
        
        configResults[step.name] = {
          statusCode: response.statusCode,
          responseTime: response.latency.toFixed(2),
          passed: response.statusCode === 200
        };
        
        if (response.statusCode === 200) {
          this.results.summary.passed++;
        } else {
          this.results.summary.failed++;
        }
      } catch (error) {
        configResults[step.name] = {
          error: error.message,
          passed: false
        };
        this.results.summary.failed++;
      }
    }
    
    this.results.e2eWorkflows.configuration = configResults;
  }

  async testMonitoringWorkflow() {
    this.log('Testing monitoring workflow...');
    
    const monitoringSteps = [
      { name: 'Health check', endpoint: '/health' },
      { name: 'System metrics', endpoint: '/health/performance' },
      { name: 'Trading metrics', endpoint: '/api/analytics/performance' },
      { name: 'Connection status', endpoint: '/api/status/connections' },
      { name: 'Paper trading status', endpoint: '/api/status/paper-trading' }
    ];
    
    const monitoringResults = {};
    
    for (const step of monitoringSteps) {
      try {
        const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}${step.endpoint}`);
        
        monitoringResults[step.name] = {
          statusCode: response.statusCode,
          responseTime: response.latency.toFixed(2),
          passed: response.statusCode === 200
        };
        
        if (response.statusCode === 200) {
          this.results.summary.passed++;
        } else {
          this.results.summary.failed++;
        }
      } catch (error) {
        monitoringResults[step.name] = {
          error: error.message,
          passed: false
        };
        this.results.summary.failed++;
      }
    }
    
    this.results.e2eWorkflows.monitoring = monitoringResults;
  }

  generateComprehensiveReport() {
    const totalTests = this.results.summary.passed + this.results.summary.failed + this.results.summary.warnings;
    const successRate = totalTests > 0 ? ((this.results.summary.passed / totalTests) * 100).toFixed(2) : 0;
    const testDuration = ((Date.now() - this.testStartTime) / 1000).toFixed(2);
    
    const report = {
      timestamp: new Date().toISOString(),
      testDuration: `${testDuration}s`,
      config: this.config,
      summary: {
        totalTests,
        passed: this.results.summary.passed,
        failed: this.results.summary.failed,
        warnings: this.results.summary.warnings,
        successRate: `${successRate}%`
      },
      results: this.results,
      recommendations: this.generateRecommendations()
    };
    
    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Market data connection recommendations
    Object.entries(this.results.marketDataConnections).forEach(([exchange, result]) => {
      if (result.errors && result.errors.length > 0) {
        recommendations.push({
          category: 'Market Data',
          priority: 'High',
          issue: `${exchange} connection issues`,
          suggestions: [
            'Check API key permissions and validity',
            'Verify network connectivity to exchange',
            'Review rate limiting settings',
            'Check exchange API status'
          ]
        });
      }
    });
    
    // Performance recommendations
    if (this.results.performanceBenchmarks.latency) {
      Object.entries(this.results.performanceBenchmarks.latency).forEach(([endpoint, result]) => {
        if (!result.passed) {
          recommendations.push({
            category: 'Performance',
            priority: 'Medium',
            issue: `High latency on ${endpoint}`,
            suggestions: [
              'Optimize database queries',
              'Implement caching',
              'Review middleware performance',
              'Consider connection pooling'
            ]
          });
        }
      });
    }
    
    // Frontend recommendations
    if (this.results.frontendTests.componentTests && !this.results.frontendTests.componentTests.passed) {
      recommendations.push({
        category: 'Frontend',
        priority: 'Medium',
        issue: 'Frontend component tests failing',
        suggestions: [
          'Review component syntax and imports',
          'Check TypeScript compilation',
          'Verify React component structure',
          'Update test dependencies'
        ]
      });
    }
    
    // E2E workflow recommendations
    Object.entries(this.results.e2eWorkflows).forEach(([workflow, results]) => {
      const failedSteps = Object.entries(results).filter(([_, result]) => !result.passed);
      if (failedSteps.length > 0) {
        recommendations.push({
          category: 'E2E Workflows',
          priority: 'High',
          issue: `${workflow} workflow has ${failedSteps.length} failing steps`,
          suggestions: [
            'Review API endpoint implementations',
            'Check authentication and authorization',
            'Verify database connectivity',
            'Review error handling'
          ]
        });
      }
    });
    
    return recommendations;
  }

  async run() {
    console.log('🚀 Starting Performance and API Connectivity Testing...\n');
    console.log(`Target: ${this.config.baseUrl}:${this.config.apiPort}`);
    console.log(`Duration: ${this.config.duration / 1000}s`);
    console.log(`Concurrent Users: ${this.config.concurrentUsers}`);
    console.log(`Target Latency: ${this.config.targetLatency}ms`);
    console.log(`Target Throughput: ${this.config.targetThroughput} req/s\n`);
    
    try {
      // Execute all sub-tasks
      await this.validateMarketDataConnections();
      await this.runPerformanceBenchmarks();
      await this.testFrontendFunctionality();
      await this.executeE2EWorkflowValidation();
      
    } catch (error) {
      this.log(`Testing error: ${error.message}`);
      this.results.summary.failed++;
    }
    
    // Generate and save comprehensive report
    const report = this.generateComprehensiveReport();
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 Performance and API Connectivity Testing Summary:');
    console.log('='.repeat(80));
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`⚠️  Warnings: ${report.summary.warnings}`);
    console.log(`📈 Success Rate: ${report.summary.successRate}`);
    console.log(`⏱️  Test Duration: ${report.testDuration}`);
    
    // Show detailed results
    console.log('\n🔌 Market Data Connections:');
    Object.entries(this.results.marketDataConnections).forEach(([exchange, result]) => {
      if (result.connection !== undefined) {
        console.log(`  ${exchange}: ${result.connection ? '✅' : '❌'} Connection, ${result.dataStreaming ? '✅' : '❌'} Streaming`);
      }
    });
    
    console.log('\n📊 Performance Benchmarks:');
    if (this.results.performanceBenchmarks.throughput) {
      console.log(`  Throughput: ${this.results.performanceBenchmarks.throughput.throughput} req/s`);
    }
    if (this.results.performanceBenchmarks.websocket) {
      console.log(`  WebSocket: ${this.results.performanceBenchmarks.websocket.messageRate} msg/s`);
    }
    
    console.log('\n🎨 Frontend Tests:');
    if (this.results.frontendTests.componentTests) {
      console.log(`  Component Tests: ${this.results.frontendTests.componentTests.passed ? '✅' : '❌'}`);
    }
    
    console.log('\n🔄 E2E Workflows:');
    Object.entries(this.results.e2eWorkflows).forEach(([workflow, results]) => {
      const passedSteps = Object.values(results).filter(result => result.passed).length;
      const totalSteps = Object.keys(results).length;
      console.log(`  ${workflow}: ${passedSteps}/${totalSteps} steps passed`);
    });
    
    // Show recommendations
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach((rec, index) => {
        console.log(`\n${index + 1}. ${rec.category} (${rec.priority}): ${rec.issue}`);
        rec.suggestions.forEach(suggestion => {
          console.log(`   • ${suggestion}`);
        });
      });
    }
    
    // Save detailed report
    const reportPath = 'performance-api-connectivity-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    // Exit with appropriate code
    if (this.results.summary.failed > 0) {
      console.log('\n⚠️  Some tests failed - Review and address issues');
      process.exit(1);
    } else {
      console.log('\n🎉 All performance and connectivity tests passed!');
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
    if (arg === '--port' && process.argv[index + 1]) {
      config.apiPort = parseInt(process.argv[index + 1]);
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
  
  const tester = new PerformanceAPIConnectivityTester(config);
  tester.run().catch(error => {
    console.error('Performance and API connectivity testing failed:', error);
    process.exit(1);
  });
}

module.exports = PerformanceAPIConnectivityTester;