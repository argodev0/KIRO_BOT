const http = require('http');
const WebSocket = require('ws');
const { performance } = require('perf_hooks');

class LoadTester {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
    this.wsUrl = options.wsUrl || 'ws://localhost:3000';
    this.concurrency = options.concurrency || 10;
    this.duration = options.duration || 60000; // 1 minute
    this.rampUpTime = options.rampUpTime || 10000; // 10 seconds
    
    this.results = {
      requests: 0,
      responses: 0,
      errors: 0,
      latencies: [],
      startTime: 0,
      endTime: 0
    };
  }

  async runHttpLoadTest() {
    console.log(`Starting HTTP load test...`);
    console.log(`Base URL: ${this.baseUrl}`);
    console.log(`Concurrency: ${this.concurrency}`);
    console.log(`Duration: ${this.duration}ms`);
    
    this.results.startTime = performance.now();
    const endTime = this.results.startTime + this.duration;
    
    const workers = [];
    
    // Ramp up workers gradually
    for (let i = 0; i < this.concurrency; i++) {
      setTimeout(() => {
        workers.push(this.createHttpWorker(endTime));
      }, (i / this.concurrency) * this.rampUpTime);
    }
    
    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, this.duration + this.rampUpTime));
    
    this.results.endTime = performance.now();
    this.printHttpResults();
  }

  async createHttpWorker(endTime) {
    const endpoints = [
      '/api/market-data/ticker/BTCUSDT',
      '/api/signals',
      '/api/positions',
      '/api/analytics/performance',
      '/api/grids'
    ];

    while (performance.now() < endTime) {
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      
      try {
        const startTime = performance.now();
        await this.makeHttpRequest(endpoint);
        const latency = performance.now() - startTime;
        
        this.results.responses++;
        this.results.latencies.push(latency);
      } catch (error) {
        this.results.errors++;
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    }
  }

  makeHttpRequest(endpoint) {
    return new Promise((resolve, reject) => {
      this.results.requests++;
      
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: endpoint,
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(5000, () => reject(new Error('Timeout')));
      req.end();
    });
  }

  async runWebSocketLoadTest() {
    console.log(`Starting WebSocket load test...`);
    console.log(`WebSocket URL: ${this.wsUrl}`);
    console.log(`Concurrent connections: ${this.concurrency}`);
    console.log(`Duration: ${this.duration}ms`);
    
    const wsResults = {
      connections: 0,
      messages: 0,
      errors: 0,
      latencies: []
    };

    const connections = [];
    
    // Create concurrent WebSocket connections
    for (let i = 0; i < this.concurrency; i++) {
      setTimeout(() => {
        this.createWebSocketConnection(wsResults);
      }, (i / this.concurrency) * this.rampUpTime);
    }
    
    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, this.duration + this.rampUpTime));
    
    // Close all connections
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    
    this.printWebSocketResults(wsResults);
  }

  createWebSocketConnection(results) {
    try {
      const ws = new WebSocket(this.wsUrl);
      
      ws.on('open', () => {
        results.connections++;
        
        // Subscribe to market data
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: 'ticker',
          symbol: 'BTCUSDT'
        }));
        
        // Send periodic messages
        const interval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const startTime = performance.now();
            ws.send(JSON.stringify({
              type: 'ping',
              timestamp: startTime
            }));
          } else {
            clearInterval(interval);
          }
        }, 1000);
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          if (message.type === 'pong' && message.timestamp) {
            const latency = performance.now() - message.timestamp;
            results.latencies.push(latency);
          }
          results.messages++;
        } catch (error) {
          results.errors++;
        }
      });
      
      ws.on('error', () => {
        results.errors++;
      });
      
    } catch (error) {
      results.errors++;
    }
  }

  printHttpResults() {
    const duration = (this.results.endTime - this.results.startTime) / 1000;
    const rps = this.results.responses / duration;
    const errorRate = (this.results.errors / this.results.requests) * 100;
    
    const sortedLatencies = this.results.latencies.sort((a, b) => a - b);
    const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] || 0;
    const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0;
    const p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0;
    const avgLatency = sortedLatencies.reduce((sum, lat) => sum + lat, 0) / sortedLatencies.length || 0;
    
    console.log('\n=== HTTP Load Test Results ===');
    console.log(`Duration: ${duration.toFixed(2)}s`);
    console.log(`Total Requests: ${this.results.requests}`);
    console.log(`Successful Responses: ${this.results.responses}`);
    console.log(`Errors: ${this.results.errors}`);
    console.log(`Error Rate: ${errorRate.toFixed(2)}%`);
    console.log(`Requests/sec: ${rps.toFixed(2)}`);
    console.log(`\nLatency Statistics:`);
    console.log(`  Average: ${avgLatency.toFixed(2)}ms`);
    console.log(`  50th percentile: ${p50.toFixed(2)}ms`);
    console.log(`  95th percentile: ${p95.toFixed(2)}ms`);
    console.log(`  99th percentile: ${p99.toFixed(2)}ms`);
  }

  printWebSocketResults(results) {
    console.log('\n=== WebSocket Load Test Results ===');
    console.log(`Connections: ${results.connections}`);
    console.log(`Messages: ${results.messages}`);
    console.log(`Errors: ${results.errors}`);
    
    if (results.latencies.length > 0) {
      const sortedLatencies = results.latencies.sort((a, b) => a - b);
      const avgLatency = sortedLatencies.reduce((sum, lat) => sum + lat, 0) / sortedLatencies.length;
      const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];
      
      console.log(`\nWebSocket Latency:`);
      console.log(`  Average: ${avgLatency.toFixed(2)}ms`);
      console.log(`  95th percentile: ${p95.toFixed(2)}ms`);
    }
  }

  async runMarketDataStressTest() {
    console.log('\n=== Market Data Stress Test ===');
    
    const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT'];
    const timeframes = ['1m', '5m', '15m', '1h', '4h'];
    
    const startTime = performance.now();
    const promises = [];
    
    // Simulate high-frequency market data requests
    for (let i = 0; i < 100; i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const timeframe = timeframes[Math.floor(Math.random() * timeframes.length)];
      
      promises.push(
        this.makeHttpRequest(`/api/market-data/candles/${symbol}?timeframe=${timeframe}&limit=100`)
          .catch(() => {}) // Ignore errors for stress test
      );
    }
    
    await Promise.all(promises);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`Processed 100 market data requests in ${duration.toFixed(2)}ms`);
    console.log(`Average: ${(duration / 100).toFixed(2)}ms per request`);
  }

  async runSignalGenerationStressTest() {
    console.log('\n=== Signal Generation Stress Test ===');
    
    const startTime = performance.now();
    const promises = [];
    
    // Simulate concurrent signal generation requests
    for (let i = 0; i < 50; i++) {
      promises.push(
        this.makeHttpRequest('/api/signals/generate')
          .catch(() => {}) // Ignore errors for stress test
      );
    }
    
    await Promise.all(promises);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`Generated 50 signals in ${duration.toFixed(2)}ms`);
    console.log(`Average: ${(duration / 50).toFixed(2)}ms per signal`);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'all';
  
  const options = {
    concurrency: parseInt(args[1]) || 10,
    duration: parseInt(args[2]) || 60000,
    baseUrl: args[3] || 'http://localhost:3000',
    wsUrl: args[4] || 'ws://localhost:3000'
  };
  
  const tester = new LoadTester(options);
  
  console.log('AI Crypto Trading Bot - Load Testing Tool');
  console.log('=========================================');
  
  try {
    switch (testType) {
      case 'http':
        await tester.runHttpLoadTest();
        break;
      case 'websocket':
        await tester.runWebSocketLoadTest();
        break;
      case 'stress':
        await tester.runMarketDataStressTest();
        await tester.runSignalGenerationStressTest();
        break;
      case 'all':
      default:
        await tester.runHttpLoadTest();
        await tester.runWebSocketLoadTest();
        await tester.runMarketDataStressTest();
        await tester.runSignalGenerationStressTest();
        break;
    }
  } catch (error) {
    console.error('Load test failed:', error.message);
    process.exit(1);
  }
  
  console.log('\nLoad testing completed!');
}

if (require.main === module) {
  main();
}

module.exports = LoadTester;