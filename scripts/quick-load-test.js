#!/usr/bin/env node

/**
 * Quick Load Testing for Production Readiness Validation
 * 
 * Task: Load testing successful
 * - Validates system can handle expected production load
 * - Tests API endpoints under concurrent load
 * - Validates WebSocket connections under stress
 * - Measures performance metrics and resource usage
 * 
 * Requirements: 8.3
 */

const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const { performance } = require('perf_hooks');
const fs = require('fs');

class QuickLoadTester {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3000',
      wsUrl: config.wsUrl || 'ws://localhost:3000',
      duration: config.duration || 60000, // 1 minute
      concurrentUsers: config.concurrentUsers || 25,
      rampUpTime: config.rampUpTime || 10000, // 10 seconds
      targetLatency: config.targetLatency || 500, // 500ms for quick test
      targetThroughput: config.targetThroughput || 100, // 100 req/s
      ...config
    };
    
    this.results = {
      loadTests: {},
      performanceTests: {},
      stressTests: {},
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      }
    };
    
    this.startTime = Date.now();
  }

  log(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data) {
      console.log(`  ${JSON.stringify(data, null, 2)}`);
    }
  }

  async run() {
    console.log('🚀 Starting Quick Load Testing Suite...\n');
    console.log(`Target: ${this.config.baseUrl}`);
    console.log(`Duration: ${this.config.duration / 1000}s`);
    console.log(`Concurrent Users: ${this.config.concurrentUsers}`);
    console.log(`Target Latency: ${this.config.targetLatency}ms`);
    console.log(`Target Throughput: ${this.config.targetThroughput} req/s\n`);
    
    try {
      // Run load tests
      await this.runAPILoadTest();
      await this.runWebSocketLoadTest();
      await this.runStressTest();
      
      // Generate report
      const report = this.generateReport();
      this.saveReport(report);
      this.displaySummary(report);
      
      // Determine success
      const success = this.results.summary.failed === 0;
      
      if (success) {
        console.log('\n🎉 Load testing PASSED - System ready for production!');
        process.exit(0);
      } else {
        console.log('\n⚠️  Load testing FAILED - System needs optimization');
        process.exit(1);
      }
      
    } catch (error) {
      console.error('Load testing error:', error.message);
      process.exit(1);
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

  async runAPILoadTest() {
    this.log('📊 Running API Load Test...');
    
    const endpoints = [
      { path: '/health', name: 'Health Check', expectedLatency: 100 },
      { path: '/api/v1/paper-trading/status', name: 'Paper Trading Status', expectedLatency: 200 },
      { path: '/api/v1/market/ticker/BTCUSDT', name: 'Market Data', expectedLatency: 300 },
      { path: '/api/v1/positions', name: 'Positions', expectedLatency: 400 },
      { path: '/api/v1/config', name: 'Configuration', expectedLatency: 200 }
    ];
    
    for (const endpoint of endpoints) {
      const testResult = await this.testEndpointLoad(endpoint);
      this.results.loadTests[endpoint.name] = testResult;
      
      if (testResult.passed) {
        this.results.summary.passed++;
      } else {
        this.results.summary.failed++;
      }
      this.results.summary.totalTests++;
    }
  }

  async testEndpointLoad(endpoint) {
    this.log(`Testing ${endpoint.name}...`);
    
    const concurrentRequests = 20;
    const iterations = 5;
    const results = { requests: 0, responses: 0, errors: 0, latencies: [] };
    
    for (let i = 0; i < iterations; i++) {
      const promises = [];
      
      for (let j = 0; j < concurrentRequests; j++) {
        results.requests++;
        
        const promise = this.makeRequest(`${this.config.baseUrl}${endpoint.path}`)
          .then(response => {
            results.responses++;
            results.latencies.push(response.latency);
          })
          .catch(error => {
            results.errors++;
          });
        
        promises.push(promise);
      }
      
      await Promise.all(promises);
      
      // Small delay between iterations
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const avgLatency = results.latencies.length > 0 ? 
      results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length : Infinity;
    const errorRate = (results.errors / results.requests) * 100;
    const passed = avgLatency <= endpoint.expectedLatency && errorRate < 5;
    
    const testResult = {
      endpoint: endpoint.path,
      requests: results.requests,
      responses: results.responses,
      errors: results.errors,
      avgLatency: avgLatency.toFixed(2),
      errorRate: errorRate.toFixed(2),
      expectedLatency: endpoint.expectedLatency,
      passed
    };
    
    this.log(`${endpoint.name} completed`, testResult);
    return testResult;
  }

  async runWebSocketLoadTest() {
    this.log('🔌 Running WebSocket Load Test...');
    
    return new Promise((resolve) => {
      const connections = 10;
      const duration = 30000; // 30 seconds
      const metrics = {
        connectionsEstablished: 0,
        messagesReceived: 0,
        messagesSent: 0,
        errors: 0,
        latencies: []
      };
      
      const activeConnections = new Set();
      
      // Create WebSocket connections
      for (let i = 0; i < connections; i++) {
        setTimeout(() => {
          this.createWebSocketConnection(metrics, activeConnections);
        }, i * 100);
      }
      
      // Wait for test duration
      setTimeout(() => {
        // Close all connections
        activeConnections.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        });
        
        const messageRate = metrics.messagesReceived / (duration / 1000);
        const avgLatency = metrics.latencies.length > 0 ? 
          metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length : 0;
        const errorRate = (metrics.errors / connections) * 100;
        
        const passed = (
          metrics.connectionsEstablished >= connections * 0.7 && // 70% connection success
          messageRate >= 0.5 && // At least 0.5 messages per second
          avgLatency <= 1000 && // Max 1000ms latency
          errorRate < 20 // Less than 20% error rate
        );
        
        this.results.loadTests['WebSocket Connections'] = {
          connections,
          connectionsEstablished: metrics.connectionsEstablished,
          messagesReceived: metrics.messagesReceived,
          messageRate: messageRate.toFixed(2),
          avgLatency: avgLatency.toFixed(2),
          errorRate: errorRate.toFixed(2),
          passed
        };
        
        if (passed) {
          this.results.summary.passed++;
        } else {
          this.results.summary.failed++;
        }
        this.results.summary.totalTests++;
        
        this.log('WebSocket test completed', this.results.loadTests['WebSocket Connections']);
        resolve();
      }, duration);
    });
  }

  createWebSocketConnection(metrics, activeConnections) {
    try {
      const wsUrl = this.config.wsUrl.replace('http', 'ws') + '/ws';
      const ws = new WebSocket(wsUrl);
      
      activeConnections.add(ws);
      
      ws.on('open', () => {
        metrics.connectionsEstablished++;
        
        // Send test messages
        const interval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const message = JSON.stringify({
              type: 'ping',
              timestamp: Date.now()
            });
            ws.send(message);
            metrics.messagesSent++;
          } else {
            clearInterval(interval);
          }
        }, 2000);
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
        activeConnections.delete(ws);
      });
      
    } catch (error) {
      metrics.errors++;
    }
  }

  async runStressTest() {
    this.log('⚡ Running Stress Test...');
    
    const concurrentRequests = 50;
    const startTime = performance.now();
    const promises = [];
    const results = { success: 0, errors: 0, latencies: [] };
    
    // Simulate high load
    for (let i = 0; i < concurrentRequests; i++) {
      const endpoint = i % 2 === 0 ? '/health' : '/api/v1/paper-trading/status';
      
      const promise = this.makeRequest(`${this.config.baseUrl}${endpoint}`)
        .then(response => {
          results.success++;
          results.latencies.push(response.latency);
        })
        .catch(() => {
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
    
    const passed = (
      errorRate < 10 && // Less than 10% error rate
      avgLatency < 2000 && // Less than 2000ms average latency
      throughput > 10 // At least 10 req/s
    );
    
    this.results.stressTests['High Load Test'] = {
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
    
    this.log('Stress test completed', this.results.stressTests['High Load Test']);
  }

  generateReport() {
    const endTime = Date.now();
    const totalDuration = (endTime - this.startTime) / 1000;
    
    return {
      timestamp: new Date().toISOString(),
      duration: `${totalDuration.toFixed(2)}s`,
      config: this.config,
      summary: {
        totalTests: this.results.summary.totalTests,
        passed: this.results.summary.passed,
        failed: this.results.summary.failed,
        successRate: this.results.summary.totalTests > 0 ? 
          ((this.results.summary.passed / this.results.summary.totalTests) * 100).toFixed(2) + '%' : '0%'
      },
      loadTests: this.results.loadTests,
      stressTests: this.results.stressTests,
      assessment: this.generateAssessment(),
      recommendations: this.generateRecommendations()
    };
  }

  generateAssessment() {
    const successRate = this.results.summary.totalTests > 0 ? 
      (this.results.summary.passed / this.results.summary.totalTests) : 0;
    
    let grade, status;
    
    if (successRate >= 0.9) {
      grade = 'A';
      status = 'Excellent - Production Ready';
    } else if (successRate >= 0.8) {
      grade = 'B';
      status = 'Good - Minor Optimizations Needed';
    } else if (successRate >= 0.7) {
      grade = 'C';
      status = 'Fair - Significant Improvements Required';
    } else if (successRate >= 0.6) {
      grade = 'D';
      status = 'Poor - Major Issues Need Resolution';
    } else {
      grade = 'F';
      status = 'Failed - System Not Ready for Production';
    }
    
    return {
      grade,
      status,
      successRate: (successRate * 100).toFixed(2) + '%',
      readyForProduction: successRate >= 0.8
    };
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Check API performance
    const apiTests = Object.values(this.results.loadTests).filter(test => test.endpoint);
    const failedApiTests = apiTests.filter(test => !test.passed);
    
    if (failedApiTests.length > 0) {
      recommendations.push({
        category: 'API Performance',
        priority: 'High',
        issue: `${failedApiTests.length} API endpoints failed performance tests`,
        suggestions: [
          'Optimize database queries',
          'Implement response caching',
          'Add connection pooling',
          'Review endpoint logic for bottlenecks'
        ]
      });
    }
    
    // Check WebSocket performance
    const wsTest = this.results.loadTests['WebSocket Connections'];
    if (wsTest && !wsTest.passed) {
      recommendations.push({
        category: 'WebSocket Performance',
        priority: 'Medium',
        issue: 'WebSocket connections failed performance tests',
        suggestions: [
          'Optimize WebSocket message handling',
          'Implement connection pooling',
          'Add message queuing for high load',
          'Review WebSocket server configuration'
        ]
      });
    }
    
    // Check stress test results
    const stressTest = this.results.stressTests['High Load Test'];
    if (stressTest && !stressTest.passed) {
      recommendations.push({
        category: 'System Scalability',
        priority: 'High',
        issue: 'System failed under high load conditions',
        suggestions: [
          'Implement horizontal scaling',
          'Add load balancing',
          'Optimize resource usage',
          'Consider infrastructure upgrades'
        ]
      });
    }
    
    return recommendations;
  }

  saveReport(report) {
    const reportPath = 'quick-load-test-report.json';
    
    try {
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      this.log(`📄 Report saved to: ${reportPath}`);
    } catch (error) {
      this.log(`❌ Failed to save report: ${error.message}`);
    }
  }

  displaySummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 QUICK LOAD TEST SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\n🕒 Duration: ${report.duration}`);
    console.log(`📈 Success Rate: ${report.summary.successRate}`);
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    
    console.log('\n🎯 Assessment:');
    console.log(`  Grade: ${report.assessment.grade}`);
    console.log(`  Status: ${report.assessment.status}`);
    console.log(`  Production Ready: ${report.assessment.readyForProduction ? 'YES' : 'NO'}`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec.category}: ${rec.issue}`);
      });
    }
    
    console.log('\n📋 Test Results:');
    Object.entries(report.loadTests).forEach(([name, result]) => {
      const status = result.passed ? '✅' : '❌';
      console.log(`  ${status} ${name}: ${result.passed ? 'PASSED' : 'FAILED'}`);
    });
    
    Object.entries(report.stressTests).forEach(([name, result]) => {
      const status = result.passed ? '✅' : '❌';
      console.log(`  ${status} ${name}: ${result.passed ? 'PASSED' : 'FAILED'}`);
    });
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
  });
  
  const tester = new QuickLoadTester(config);
  tester.run().catch(error => {
    console.error('Quick load test failed:', error);
    process.exit(1);
  });
}

module.exports = QuickLoadTester;