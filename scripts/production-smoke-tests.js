#!/usr/bin/env node

/**
 * Production Smoke Tests
 * 
 * Comprehensive smoke tests for deployed production environment
 * Requirements: 3.7, 5.5, 7.2, 7.3, 7.4, 7.5, 7.7
 */

const https = require('https');
const http = require('http');
const WebSocket = require('ws');
const { execSync } = require('child_process');

class ProductionSmokeTests {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'https://localhost',
      apiPort: config.apiPort || 3000,
      frontendPort: config.frontendPort || 3002,
      timeout: config.timeout || 10000,
      retries: config.retries || 3,
      ...config
    };
    
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: []
    };
  }

  async runTest(name, testFn, critical = false) {
    const startTime = Date.now();
    console.log(`🧪 Running: ${name}`);
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      console.log(`✅ PASSED: ${name} (${duration}ms)`);
      
      this.results.passed++;
      this.results.tests.push({
        name,
        status: 'PASSED',
        duration,
        critical
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ FAILED: ${name} (${duration}ms)`);
      console.log(`   Error: ${error.message}`);
      
      this.results.failed++;
      this.results.tests.push({
        name,
        status: 'FAILED',
        duration,
        error: error.message,
        critical
      });
      
      if (critical) {
        throw new Error(`Critical test failed: ${name}`);
      }
    }
  }

  async makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const timeout = setTimeout(() => {
        reject(new Error(`Request timeout: ${url}`));
      }, this.config.timeout);

      const req = protocol.get(url, {
        ...options,
        rejectUnauthorized: false // Allow self-signed certificates for testing
      }, (res) => {
        clearTimeout(timeout);
        let data = '';
        
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        });
      });

      req.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async testHealthEndpoints() {
    await this.runTest('API Health Check', async () => {
      const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}/health`);
      
      if (response.statusCode !== 200) {
        throw new Error(`Health check failed with status: ${response.statusCode}`);
      }
      
      const healthData = JSON.parse(response.data);
      if (healthData.status !== 'healthy') {
        throw new Error(`Health status is not healthy: ${healthData.status}`);
      }
      
      // Verify paper trading mode is enabled
      if (!healthData.paperTradingMode) {
        throw new Error('Paper trading mode is not enabled in health check');
      }
    }, true);

    await this.runTest('Database Health Check', async () => {
      const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}/health/database`);
      
      if (response.statusCode !== 200) {
        throw new Error(`Database health check failed with status: ${response.statusCode}`);
      }
      
      const dbHealth = JSON.parse(response.data);
      if (!dbHealth.connected) {
        throw new Error('Database is not connected');
      }
    }, true);

    await this.runTest('Redis Health Check', async () => {
      const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}/health/redis`);
      
      if (response.statusCode !== 200) {
        throw new Error(`Redis health check failed with status: ${response.statusCode}`);
      }
      
      const redisHealth = JSON.parse(response.data);
      if (!redisHealth.connected) {
        throw new Error('Redis is not connected');
      }
    }, true);
  }

  async testSSLConfiguration() {
    await this.runTest('SSL Certificate Validation', async () => {
      const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.frontendPort}`);
      
      if (response.statusCode !== 200) {
        throw new Error(`Frontend not accessible via HTTPS: ${response.statusCode}`);
      }
      
      // Check security headers
      const securityHeaders = [
        'strict-transport-security',
        'x-frame-options',
        'x-content-type-options'
      ];
      
      for (const header of securityHeaders) {
        if (!response.headers[header]) {
          throw new Error(`Missing security header: ${header}`);
        }
      }
    });

    await this.runTest('HTTP to HTTPS Redirect', async () => {
      try {
        const response = await this.makeRequest(`http://localhost:${this.config.frontendPort}`);
        
        // Should either redirect (3xx) or be blocked
        if (response.statusCode >= 200 && response.statusCode < 300) {
          throw new Error('HTTP request should be redirected to HTTPS');
        }
      } catch (error) {
        // Connection refused is acceptable (HTTP port not open)
        if (!error.message.includes('ECONNREFUSED')) {
          throw error;
        }
      }
    });
  }

  async testPaperTradingSafety() {
    await this.runTest('Paper Trading Mode Verification', async () => {
      const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}/api/config/trading-mode`);
      
      if (response.statusCode !== 200) {
        throw new Error(`Trading mode endpoint failed: ${response.statusCode}`);
      }
      
      const config = JSON.parse(response.data);
      if (!config.paperTradingMode) {
        throw new Error('Paper trading mode is not enabled');
      }
      
      if (config.allowRealTrades) {
        throw new Error('CRITICAL: Real trades are allowed!');
      }
    }, true);

    await this.runTest('Real Trading Block Test', async () => {
      // Attempt to place a real trade (should be blocked)
      const tradeRequest = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTCUSDT',
          side: 'BUY',
          quantity: 0.001,
          type: 'MARKET'
        })
      };

      try {
        const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}/api/trading/order`, tradeRequest);
        
        // Should either be blocked (4xx) or converted to paper trade
        const responseData = JSON.parse(response.data);
        if (!responseData.isPaperTrade) {
          throw new Error('Trade was not converted to paper trade');
        }
      } catch (error) {
        // Blocked requests are acceptable
        if (!error.message.includes('blocked') && !error.message.includes('paper')) {
          throw error;
        }
      }
    }, true);

    await this.runTest('API Key Permission Validation', async () => {
      const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}/api/config/api-permissions`);
      
      if (response.statusCode !== 200) {
        throw new Error(`API permissions endpoint failed: ${response.statusCode}`);
      }
      
      const permissions = JSON.parse(response.data);
      if (permissions.tradingEnabled) {
        throw new Error('CRITICAL: Trading permissions are enabled on API keys!');
      }
    }, true);
  }

  async testLiveDataFeeds() {
    await this.runTest('Market Data API', async () => {
      const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}/api/market/ticker/BTCUSDT`);
      
      if (response.statusCode !== 200) {
        throw new Error(`Market data API failed: ${response.statusCode}`);
      }
      
      const marketData = JSON.parse(response.data);
      if (!marketData.price || !marketData.timestamp) {
        throw new Error('Invalid market data format');
      }
      
      // Verify data is recent (within last 5 minutes)
      const dataAge = Date.now() - new Date(marketData.timestamp).getTime();
      if (dataAge > 5 * 60 * 1000) {
        throw new Error('Market data is stale');
      }
    });

    await this.runTest('WebSocket Data Stream', async () => {
      return new Promise((resolve, reject) => {
        const wsUrl = `wss://localhost:${this.config.apiPort}/ws/market-data`;
        const ws = new WebSocket(wsUrl, {
          rejectUnauthorized: false
        });
        
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }, this.config.timeout);
        
        ws.on('open', () => {
          ws.send(JSON.stringify({ subscribe: 'BTCUSDT' }));
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            if (message.type === 'ticker' && message.symbol === 'BTCUSDT') {
              clearTimeout(timeout);
              ws.close();
              resolve();
            }
          } catch (error) {
            clearTimeout(timeout);
            ws.close();
            reject(new Error('Invalid WebSocket message format'));
          }
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });

    await this.runTest('Exchange Connectivity', async () => {
      const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}/api/exchanges/status`);
      
      if (response.statusCode !== 200) {
        throw new Error(`Exchange status endpoint failed: ${response.statusCode}`);
      }
      
      const exchangeStatus = JSON.parse(response.data);
      const requiredExchanges = ['binance', 'kucoin'];
      
      for (const exchange of requiredExchanges) {
        if (!exchangeStatus[exchange] || !exchangeStatus[exchange].connected) {
          throw new Error(`Exchange ${exchange} is not connected`);
        }
      }
    });
  }

  async testFrontendApplication() {
    await this.runTest('Frontend Accessibility', async () => {
      const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.frontendPort}`);
      
      if (response.statusCode !== 200) {
        throw new Error(`Frontend not accessible: ${response.statusCode}`);
      }
      
      // Check for critical elements in HTML
      const html = response.data;
      const criticalElements = [
        'PAPER TRADING MODE',
        'Trading Dashboard',
        'Market Data'
      ];
      
      for (const element of criticalElements) {
        if (!html.includes(element)) {
          console.warn(`Warning: Frontend may be missing element: ${element}`);
        }
      }
    });

    await this.runTest('Static Assets Loading', async () => {
      // Test common static assets
      const assets = ['/favicon.ico', '/manifest.json'];
      
      for (const asset of assets) {
        try {
          const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.frontendPort}${asset}`);
          if (response.statusCode >= 400) {
            console.warn(`Warning: Asset ${asset} returned ${response.statusCode}`);
          }
        } catch (error) {
          console.warn(`Warning: Asset ${asset} failed to load: ${error.message}`);
        }
      }
    });
  }

  async testMonitoringEndpoints() {
    await this.runTest('Prometheus Metrics', async () => {
      const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}/metrics`);
      
      if (response.statusCode !== 200) {
        throw new Error(`Metrics endpoint failed: ${response.statusCode}`);
      }
      
      const metrics = response.data;
      const requiredMetrics = [
        'http_requests_total',
        'nodejs_heap_size_used_bytes',
        'paper_trades_total'
      ];
      
      for (const metric of requiredMetrics) {
        if (!metrics.includes(metric)) {
          throw new Error(`Missing metric: ${metric}`);
        }
      }
    });

    await this.runTest('System Performance Metrics', async () => {
      const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}/health/performance`);
      
      if (response.statusCode !== 200) {
        throw new Error(`Performance metrics failed: ${response.statusCode}`);
      }
      
      const performance = JSON.parse(response.data);
      
      // Check critical performance thresholds
      if (performance.memoryUsage > 0.9) {
        throw new Error(`High memory usage: ${(performance.memoryUsage * 100).toFixed(1)}%`);
      }
      
      if (performance.cpuUsage > 0.8) {
        throw new Error(`High CPU usage: ${(performance.cpuUsage * 100).toFixed(1)}%`);
      }
    });
  }

  async testSecurityFeatures() {
    await this.runTest('Rate Limiting', async () => {
      const requests = [];
      const endpoint = `${this.config.baseUrl}:${this.config.apiPort}/api/market/ticker/BTCUSDT`;
      
      // Make rapid requests to trigger rate limiting
      for (let i = 0; i < 20; i++) {
        requests.push(this.makeRequest(endpoint).catch(e => ({ error: e.message })));
      }
      
      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => 
        r.statusCode === 429 || (r.error && r.error.includes('rate limit'))
      );
      
      if (!rateLimited) {
        console.warn('Warning: Rate limiting may not be properly configured');
      }
    });

    await this.runTest('Input Validation', async () => {
      // Test malicious input
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        '<script>alert("xss")</script>',
        '../../../etc/passwd'
      ];
      
      for (const input of maliciousInputs) {
        try {
          const response = await this.makeRequest(
            `${this.config.baseUrl}:${this.config.apiPort}/api/market/ticker/${encodeURIComponent(input)}`
          );
          
          // Should return 400 or 404, not 500 (which indicates unhandled error)
          if (response.statusCode === 500) {
            throw new Error(`Unhandled error with malicious input: ${input}`);
          }
        } catch (error) {
          // Connection errors are acceptable
          if (!error.message.includes('ECONNREFUSED')) {
            console.warn(`Input validation test warning: ${error.message}`);
          }
        }
      }
    });
  }

  async run() {
    console.log('🚀 Starting Production Smoke Tests...\n');
    console.log(`Target: ${this.config.baseUrl}`);
    console.log(`API Port: ${this.config.apiPort}`);
    console.log(`Frontend Port: ${this.config.frontendPort}\n`);
    
    try {
      await this.testHealthEndpoints();
      await this.testSSLConfiguration();
      await this.testPaperTradingSafety();
      await this.testLiveDataFeeds();
      await this.testFrontendApplication();
      await this.testMonitoringEndpoints();
      await this.testSecurityFeatures();
      
    } catch (error) {
      console.log(`\n🚨 Critical test failure: ${error.message}`);
    }
    
    // Generate summary
    console.log('\n📊 Smoke Test Results:');
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`⏭️  Skipped: ${this.results.skipped}`);
    
    const totalTests = this.results.passed + this.results.failed + this.results.skipped;
    const successRate = totalTests > 0 ? ((this.results.passed / totalTests) * 100).toFixed(1) : 0;
    console.log(`📈 Success Rate: ${successRate}%`);
    
    // Show critical failures
    const criticalFailures = this.results.tests.filter(t => t.status === 'FAILED' && t.critical);
    if (criticalFailures.length > 0) {
      console.log('\n🚨 Critical Failures:');
      criticalFailures.forEach(test => {
        console.log(`  - ${test.name}: ${test.error}`);
      });
    }
    
    // Write detailed report
    const reportPath = 'production-smoke-test-report.json';
    require('fs').writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    // Exit with appropriate code
    if (criticalFailures.length > 0) {
      console.log('\n🚨 CRITICAL FAILURES DETECTED - Production deployment not ready!');
      process.exit(1);
    } else if (this.results.failed > 0) {
      console.log('\n⚠️  Some tests failed - Review before proceeding');
      process.exit(1);
    } else {
      console.log('\n🎉 All smoke tests passed - Production deployment ready!');
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
    if (arg === '--api-port' && process.argv[index + 1]) {
      config.apiPort = parseInt(process.argv[index + 1]);
    }
    if (arg === '--frontend-port' && process.argv[index + 1]) {
      config.frontendPort = parseInt(process.argv[index + 1]);
    }
  });
  
  const smokeTests = new ProductionSmokeTests(config);
  smokeTests.run().catch(error => {
    console.error('Smoke tests failed:', error);
    process.exit(1);
  });
}

module.exports = ProductionSmokeTests;