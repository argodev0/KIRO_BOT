#!/usr/bin/env node

/**
 * Performance Benchmarking Script
 * 
 * Comprehensive performance benchmarking for real-time data processing
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */

const WebSocket = require('ws');
const https = require('https');
const http = require('http');
const { performance } = require('perf_hooks');
const fs = require('fs');

class PerformanceBenchmarker {
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
    
    this.metrics = {
      latency: [],
      throughput: [],
      errors: [],
      websocketMetrics: [],
      memoryUsage: [],
      cpuUsage: []
    };
    
    this.results = {
      summary: {},
      details: {},
      passed: 0,
      failed: 0
    };
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

  async benchmarkApiLatency() {
    this.log('🚀 Benchmarking API latency...');
    
    const endpoints = [
      '/health',
      '/api/market/ticker/BTCUSDT',
      '/api/config/trading-mode',
      '/metrics'
    ];
    
    const latencyResults = [];
    
    for (const endpoint of endpoints) {
      const url = `${this.config.baseUrl}:${this.config.apiPort}${endpoint}`;
      const endpointLatencies = [];
      
      // Make 50 requests to each endpoint
      for (let i = 0; i < 50; i++) {
        try {
          const result = await this.makeRequest(url);
          endpointLatencies.push(result.latency);
          this.metrics.latency.push({
            endpoint,
            latency: result.latency,
            timestamp: result.timestamp
          });
        } catch (error) {
          this.metrics.errors.push({
            endpoint,
            error: error.error || error.message,
            timestamp: error.timestamp || Date.now()
          });
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      if (endpointLatencies.length > 0) {
        const avgLatency = endpointLatencies.reduce((a, b) => a + b, 0) / endpointLatencies.length;
        const p95Latency = endpointLatencies.sort((a, b) => a - b)[Math.floor(endpointLatencies.length * 0.95)];
        const maxLatency = Math.max(...endpointLatencies);
        
        latencyResults.push({
          endpoint,
          avgLatency: avgLatency.toFixed(2),
          p95Latency: p95Latency.toFixed(2),
          maxLatency: maxLatency.toFixed(2),
          requests: endpointLatencies.length
        });
        
        this.log(`Endpoint: ${endpoint}`, {
          avgLatency: `${avgLatency.toFixed(2)}ms`,
          p95Latency: `${p95Latency.toFixed(2)}ms`,
          maxLatency: `${maxLatency.toFixed(2)}ms`
        });
        
        // Check against target latency
        if (avgLatency <= this.config.targetLatency) {
          this.results.passed++;
        } else {
          this.results.failed++;
          this.log(`❌ Latency target missed for ${endpoint}: ${avgLatency.toFixed(2)}ms > ${this.config.targetLatency}ms`);
        }
      }
    }
    
    this.results.details.latency = latencyResults;
  }

  async benchmarkThroughput() {
    this.log('📊 Benchmarking API throughput...');
    
    const endpoint = `${this.config.baseUrl}:${this.config.apiPort}/api/market/ticker/BTCUSDT`;
    const duration = 30000; // 30 seconds
    const startTime = Date.now();
    
    let requestCount = 0;
    let successCount = 0;
    let errorCount = 0;
    
    const workers = [];
    
    // Create concurrent workers
    for (let i = 0; i < this.config.concurrentUsers; i++) {
      const worker = async () => {
        while (Date.now() - startTime < duration) {
          try {
            const result = await this.makeRequest(endpoint);
            requestCount++;
            if (result.statusCode === 200) {
              successCount++;
            }
            
            this.metrics.throughput.push({
              timestamp: Date.now(),
              latency: result.latency,
              success: result.statusCode === 200
            });
            
          } catch (error) {
            requestCount++;
            errorCount++;
            this.metrics.errors.push({
              endpoint: 'throughput-test',
              error: error.error || error.message,
              timestamp: Date.now()
            });
          }
          
          // Small delay to prevent overwhelming
          await new Promise(resolve => setTimeout(resolve, 5));
        }
      };
      
      workers.push(worker());
    }
    
    await Promise.all(workers);
    
    const actualDuration = (Date.now() - startTime) / 1000;
    const throughput = requestCount / actualDuration;
    const successRate = (successCount / requestCount) * 100;
    
    const throughputResult = {
      totalRequests: requestCount,
      successfulRequests: successCount,
      errorRequests: errorCount,
      duration: actualDuration.toFixed(2),
      throughput: throughput.toFixed(2),
      successRate: successRate.toFixed(2)
    };
    
    this.log('Throughput Results', throughputResult);
    
    // Check against target throughput
    if (throughput >= this.config.targetThroughput) {
      this.results.passed++;
    } else {
      this.results.failed++;
      this.log(`❌ Throughput target missed: ${throughput.toFixed(2)} < ${this.config.targetThroughput} req/s`);
    }
    
    this.results.details.throughput = throughputResult;
  }

  async benchmarkWebSocketPerformance() {
    this.log('🔌 Benchmarking WebSocket performance...');
    
    return new Promise((resolve, reject) => {
      const wsUrl = `wss://localhost:${this.config.wsPort}/ws/market-data`;
      const ws = new WebSocket(wsUrl, {
        rejectUnauthorized: false
      });
      
      let messageCount = 0;
      let latencies = [];
      const startTime = Date.now();
      let firstMessageTime = null;
      
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket benchmark timeout'));
      }, 60000);
      
      ws.on('open', () => {
        this.log('WebSocket connected, subscribing to data...');
        ws.send(JSON.stringify({ 
          subscribe: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT'] 
        }));
      });
      
      ws.on('message', (data) => {
        const receiveTime = Date.now();
        
        if (!firstMessageTime) {
          firstMessageTime = receiveTime;
        }
        
        try {
          const message = JSON.parse(data);
          messageCount++;
          
          // Calculate latency if timestamp is available
          if (message.timestamp) {
            const latency = receiveTime - new Date(message.timestamp).getTime();
            latencies.push(latency);
          }
          
          this.metrics.websocketMetrics.push({
            messageCount,
            timestamp: receiveTime,
            messageType: message.type || 'unknown',
            symbol: message.symbol || 'unknown'
          });
          
          // Stop after 30 seconds of data
          if (receiveTime - firstMessageTime > 30000) {
            clearTimeout(timeout);
            ws.close();
            
            const duration = (receiveTime - firstMessageTime) / 1000;
            const messageRate = messageCount / duration;
            const avgLatency = latencies.length > 0 ? 
              latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
            
            const wsResult = {
              totalMessages: messageCount,
              duration: duration.toFixed(2),
              messageRate: messageRate.toFixed(2),
              avgLatency: avgLatency.toFixed(2),
              connectionTime: (firstMessageTime - startTime).toFixed(2)
            };
            
            this.log('WebSocket Results', wsResult);
            
            // Check WebSocket performance targets
            if (messageRate >= 10 && avgLatency <= this.config.targetLatency) {
              this.results.passed++;
            } else {
              this.results.failed++;
              this.log(`❌ WebSocket performance targets missed`);
            }
            
            this.results.details.websocket = wsResult;
            resolve();
          }
          
        } catch (error) {
          this.metrics.errors.push({
            endpoint: 'websocket',
            error: error.message,
            timestamp: receiveTime
          });
        }
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        this.log(`WebSocket error: ${error.message}`);
        this.results.failed++;
        resolve();
      });
    });
  }

  async benchmarkSystemResources() {
    this.log('💻 Benchmarking system resource usage...');
    
    const duration = 30000; // 30 seconds
    const interval = 1000; // 1 second intervals
    const startTime = Date.now();
    
    const resourceMonitor = setInterval(async () => {
      try {
        // Get system metrics from health endpoint
        const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}/health/performance`);
        
        if (response.statusCode === 200) {
          const metrics = JSON.parse(response.data);
          
          this.metrics.memoryUsage.push({
            timestamp: Date.now(),
            memoryUsage: metrics.memoryUsage || 0,
            heapUsed: metrics.heapUsed || 0,
            heapTotal: metrics.heapTotal || 0
          });
          
          this.metrics.cpuUsage.push({
            timestamp: Date.now(),
            cpuUsage: metrics.cpuUsage || 0,
            loadAverage: metrics.loadAverage || []
          });
        }
        
      } catch (error) {
        this.log(`Resource monitoring error: ${error.message}`);
      }
      
      if (Date.now() - startTime >= duration) {
        clearInterval(resourceMonitor);
      }
    }, interval);
    
    // Wait for monitoring to complete
    await new Promise(resolve => setTimeout(resolve, duration + 1000));
    
    // Analyze resource usage
    if (this.metrics.memoryUsage.length > 0) {
      const avgMemory = this.metrics.memoryUsage.reduce((sum, m) => sum + m.memoryUsage, 0) / this.metrics.memoryUsage.length;
      const maxMemory = Math.max(...this.metrics.memoryUsage.map(m => m.memoryUsage));
      
      const resourceResult = {
        avgMemoryUsage: (avgMemory * 100).toFixed(2),
        maxMemoryUsage: (maxMemory * 100).toFixed(2),
        samples: this.metrics.memoryUsage.length
      };
      
      this.log('Resource Usage Results', resourceResult);
      
      // Check resource usage targets
      if (avgMemory < 0.8 && maxMemory < 0.9) { // 80% avg, 90% max
        this.results.passed++;
      } else {
        this.results.failed++;
        this.log(`❌ Resource usage targets exceeded`);
      }
      
      this.results.details.resources = resourceResult;
    }
  }

  async benchmarkDataProcessingPipeline() {
    this.log('⚡ Benchmarking data processing pipeline...');
    
    const testData = [];
    const batchSize = 100;
    const batches = 10;
    
    // Generate test market data
    for (let batch = 0; batch < batches; batch++) {
      const batchData = [];
      for (let i = 0; i < batchSize; i++) {
        batchData.push({
          symbol: 'BTCUSDT',
          price: 50000 + Math.random() * 1000,
          volume: Math.random() * 100,
          timestamp: Date.now() + (i * 1000)
        });
      }
      testData.push(batchData);
    }
    
    const processingTimes = [];
    
    for (const batch of testData) {
      const startTime = performance.now();
      
      try {
        // Send batch to processing endpoint
        const response = await this.makeRequest(`${this.config.baseUrl}:${this.config.apiPort}/api/market/process-batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: batch })
        });
        
        const endTime = performance.now();
        const processingTime = endTime - startTime;
        processingTimes.push(processingTime);
        
        if (response.statusCode !== 200) {
          this.metrics.errors.push({
            endpoint: 'data-processing',
            error: `Processing failed with status ${response.statusCode}`,
            timestamp: Date.now()
          });
        }
        
      } catch (error) {
        this.metrics.errors.push({
          endpoint: 'data-processing',
          error: error.message,
          timestamp: Date.now()
        });
      }
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (processingTimes.length > 0) {
      const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      const maxProcessingTime = Math.max(...processingTimes);
      const throughputPerSecond = (batchSize * 1000) / avgProcessingTime;
      
      const pipelineResult = {
        avgProcessingTime: avgProcessingTime.toFixed(2),
        maxProcessingTime: maxProcessingTime.toFixed(2),
        throughputPerSecond: throughputPerSecond.toFixed(2),
        batchesProcessed: processingTimes.length
      };
      
      this.log('Data Processing Results', pipelineResult);
      
      // Check processing performance targets
      if (avgProcessingTime <= 500 && throughputPerSecond >= 100) { // 500ms avg, 100 items/sec
        this.results.passed++;
      } else {
        this.results.failed++;
        this.log(`❌ Data processing targets missed`);
      }
      
      this.results.details.dataProcessing = pipelineResult;
    }
  }

  generatePerformanceReport() {
    const report = {
      timestamp: new Date().toISOString(),
      config: this.config,
      summary: {
        totalTests: this.results.passed + this.results.failed,
        passed: this.results.passed,
        failed: this.results.failed,
        successRate: ((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(2)
      },
      benchmarks: this.results.details,
      metrics: {
        latencyStats: this.calculateLatencyStats(),
        throughputStats: this.calculateThroughputStats(),
        errorStats: this.calculateErrorStats()
      },
      recommendations: this.generateRecommendations()
    };
    
    return report;
  }

  calculateLatencyStats() {
    if (this.metrics.latency.length === 0) return null;
    
    const latencies = this.metrics.latency.map(m => m.latency);
    latencies.sort((a, b) => a - b);
    
    return {
      count: latencies.length,
      min: latencies[0].toFixed(2),
      max: latencies[latencies.length - 1].toFixed(2),
      avg: (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2),
      p50: latencies[Math.floor(latencies.length * 0.5)].toFixed(2),
      p95: latencies[Math.floor(latencies.length * 0.95)].toFixed(2),
      p99: latencies[Math.floor(latencies.length * 0.99)].toFixed(2)
    };
  }

  calculateThroughputStats() {
    if (this.metrics.throughput.length === 0) return null;
    
    const successfulRequests = this.metrics.throughput.filter(m => m.success).length;
    const totalRequests = this.metrics.throughput.length;
    
    return {
      totalRequests,
      successfulRequests,
      successRate: ((successfulRequests / totalRequests) * 100).toFixed(2),
      avgLatency: (this.metrics.throughput.reduce((sum, m) => sum + m.latency, 0) / totalRequests).toFixed(2)
    };
  }

  calculateErrorStats() {
    const errorsByEndpoint = {};
    
    this.metrics.errors.forEach(error => {
      if (!errorsByEndpoint[error.endpoint]) {
        errorsByEndpoint[error.endpoint] = [];
      }
      errorsByEndpoint[error.endpoint].push(error.error);
    });
    
    return {
      totalErrors: this.metrics.errors.length,
      errorsByEndpoint,
      errorRate: ((this.metrics.errors.length / (this.metrics.latency.length + this.metrics.throughput.length)) * 100).toFixed(2)
    };
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Latency recommendations
    const latencyStats = this.calculateLatencyStats();
    if (latencyStats && parseFloat(latencyStats.avg) > this.config.targetLatency) {
      recommendations.push({
        category: 'Latency',
        issue: `Average latency (${latencyStats.avg}ms) exceeds target (${this.config.targetLatency}ms)`,
        suggestions: [
          'Optimize database queries',
          'Implement caching for frequently accessed data',
          'Consider connection pooling',
          'Review middleware performance'
        ]
      });
    }
    
    // Throughput recommendations
    const throughputResult = this.results.details.throughput;
    if (throughputResult && parseFloat(throughputResult.throughput) < this.config.targetThroughput) {
      recommendations.push({
        category: 'Throughput',
        issue: `Throughput (${throughputResult.throughput} req/s) below target (${this.config.targetThroughput} req/s)`,
        suggestions: [
          'Implement horizontal scaling',
          'Optimize API endpoints',
          'Use load balancing',
          'Consider async processing for heavy operations'
        ]
      });
    }
    
    // Error rate recommendations
    const errorStats = this.calculateErrorStats();
    if (errorStats && parseFloat(errorStats.errorRate) > 5) {
      recommendations.push({
        category: 'Reliability',
        issue: `Error rate (${errorStats.errorRate}%) is high`,
        suggestions: [
          'Implement circuit breakers',
          'Add retry logic with exponential backoff',
          'Improve error handling',
          'Monitor external service dependencies'
        ]
      });
    }
    
    return recommendations;
  }

  async run() {
    console.log('🚀 Starting Performance Benchmarking...\n');
    console.log(`Target: ${this.config.baseUrl}`);
    console.log(`Duration: ${this.config.duration / 1000}s`);
    console.log(`Concurrent Users: ${this.config.concurrentUsers}`);
    console.log(`Target Latency: ${this.config.targetLatency}ms`);
    console.log(`Target Throughput: ${this.config.targetThroughput} req/s\n`);
    
    try {
      await this.benchmarkApiLatency();
      await this.benchmarkThroughput();
      await this.benchmarkWebSocketPerformance();
      await this.benchmarkSystemResources();
      await this.benchmarkDataProcessingPipeline();
      
    } catch (error) {
      this.log(`Benchmarking error: ${error.message}`);
      this.results.failed++;
    }
    
    // Generate and save report
    const report = this.generatePerformanceReport();
    
    console.log('\n📊 Performance Benchmarking Summary:');
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`📈 Success Rate: ${report.summary.successRate}%`);
    
    if (report.metrics.latencyStats) {
      console.log(`⚡ Avg Latency: ${report.metrics.latencyStats.avg}ms`);
      console.log(`📊 P95 Latency: ${report.metrics.latencyStats.p95}ms`);
    }
    
    if (report.benchmarks.throughput) {
      console.log(`🚀 Throughput: ${report.benchmarks.throughput.throughput} req/s`);
    }
    
    // Show recommendations
    if (report.recommendations.length > 0) {
      console.log('\n💡 Performance Recommendations:');
      report.recommendations.forEach(rec => {
        console.log(`\n${rec.category}: ${rec.issue}`);
        rec.suggestions.forEach(suggestion => {
          console.log(`  • ${suggestion}`);
        });
      });
    }
    
    // Save detailed report
    const reportPath = 'performance-benchmark-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    // Exit with appropriate code
    if (this.results.failed > 0) {
      console.log('\n⚠️  Performance targets not met - Review and optimize');
      process.exit(1);
    } else {
      console.log('\n🎉 All performance benchmarks passed!');
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
  
  const benchmarker = new PerformanceBenchmarker(config);
  benchmarker.run().catch(error => {
    console.error('Performance benchmarking failed:', error);
    process.exit(1);
  });
}

module.exports = PerformanceBenchmarker;