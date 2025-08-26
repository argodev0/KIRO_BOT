#!/usr/bin/env node

/**
 * WebSocket Connectivity Test Script
 * Tests WebSocket connections for real-time data streaming
 */

const WebSocket = require('ws');

// Configuration
const WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'ws://localhost:3000';
const TEST_TIMEOUT = 30000; // 30 seconds
const PING_INTERVAL = 5000; // 5 seconds

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// Logging functions
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
};

// Test results
let testResults = {
  connection: false,
  authentication: false,
  dataReceived: false,
  pingPong: false,
  reconnection: false,
  errors: []
};

// Test WebSocket connection
async function testWebSocketConnection() {
  return new Promise((resolve, reject) => {
    log.info('Testing WebSocket connection...');
    
    const ws = new WebSocket(WEBSOCKET_URL);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Connection timeout'));
    }, TEST_TIMEOUT);
    
    ws.on('open', () => {
      clearTimeout(timeout);
      log.success('WebSocket connection established');
      testResults.connection = true;
      
      // Test ping/pong
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, PING_INTERVAL);
      
      ws.on('pong', () => {
        log.success('Ping/pong test passed');
        testResults.pingPong = true;
      });
      
      // Test data subscription
      ws.send(JSON.stringify({
        type: 'subscribe',
        channel: 'market_data',
        symbols: ['BTCUSDT', 'ETHUSDT']
      }));
      
      // Listen for messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          log.info(`Received message: ${message.type}`);
          
          if (message.type === 'market_data') {
            log.success('Market data received');
            testResults.dataReceived = true;
          }
          
          if (message.type === 'auth_success') {
            log.success('Authentication successful');
            testResults.authentication = true;
          }
          
        } catch (error) {
          log.warning(`Failed to parse message: ${error.message}`);
        }
      });
      
      // Complete test after receiving data or timeout
      setTimeout(() => {
        clearInterval(pingInterval);
        ws.close();
        resolve(testResults);
      }, 10000);
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      log.error(`WebSocket error: ${error.message}`);
      testResults.errors.push(error.message);
      reject(error);
    });
    
    ws.on('close', (code, reason) => {
      log.info(`WebSocket closed: ${code} - ${reason}`);
    });
  });
}

// Test WebSocket reconnection
async function testWebSocketReconnection() {
  return new Promise((resolve, reject) => {
    log.info('Testing WebSocket reconnection...');
    
    let connectionCount = 0;
    const maxConnections = 3;
    
    function connect() {
      const ws = new WebSocket(WEBSOCKET_URL);
      
      ws.on('open', () => {
        connectionCount++;
        log.success(`Connection ${connectionCount} established`);
        
        if (connectionCount === 1) {
          // Close first connection to test reconnection
          setTimeout(() => {
            ws.close();
          }, 1000);
        } else if (connectionCount === maxConnections) {
          log.success('Reconnection test passed');
          testResults.reconnection = true;
          ws.close();
          resolve(testResults);
        }
      });
      
      ws.on('close', () => {
        if (connectionCount < maxConnections) {
          // Attempt reconnection
          setTimeout(connect, 2000);
        }
      });
      
      ws.on('error', (error) => {
        log.error(`Reconnection test error: ${error.message}`);
        testResults.errors.push(error.message);
        reject(error);
      });
    }
    
    connect();
    
    // Timeout for reconnection test
    setTimeout(() => {
      if (connectionCount < maxConnections) {
        reject(new Error('Reconnection test timeout'));
      }
    }, TEST_TIMEOUT);
  });
}

// Test WebSocket performance
async function testWebSocketPerformance() {
  return new Promise((resolve, reject) => {
    log.info('Testing WebSocket performance...');
    
    const ws = new WebSocket(WEBSOCKET_URL);
    const startTime = Date.now();
    let messageCount = 0;
    let totalLatency = 0;
    
    ws.on('open', () => {
      const connectionTime = Date.now() - startTime;
      log.info(`Connection established in ${connectionTime}ms`);
      
      // Send test messages
      const testInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN && messageCount < 10) {
          const timestamp = Date.now();
          ws.send(JSON.stringify({
            type: 'ping_test',
            timestamp: timestamp
          }));
        } else {
          clearInterval(testInterval);
        }
      }, 1000);
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'pong_test' && message.timestamp) {
            const latency = Date.now() - message.timestamp;
            totalLatency += latency;
            messageCount++;
            log.info(`Message ${messageCount} latency: ${latency}ms`);
            
            if (messageCount >= 10) {
              const avgLatency = totalLatency / messageCount;
              log.success(`Average latency: ${avgLatency.toFixed(2)}ms`);
              ws.close();
              resolve({ averageLatency: avgLatency, messageCount });
            }
          }
        } catch (error) {
          log.warning(`Performance test message parse error: ${error.message}`);
        }
      });
      
      // Timeout for performance test
      setTimeout(() => {
        ws.close();
        if (messageCount > 0) {
          const avgLatency = totalLatency / messageCount;
          resolve({ averageLatency: avgLatency, messageCount });
        } else {
          reject(new Error('No performance data received'));
        }
      }, 15000);
    });
    
    ws.on('error', (error) => {
      log.error(`Performance test error: ${error.message}`);
      reject(error);
    });
  });
}

// Main test function
async function runWebSocketTests() {
  console.log('🔌 WebSocket Connectivity Test');
  console.log('==============================');
  console.log('');
  
  try {
    // Test basic connection
    log.info('Phase 1: Basic Connection Test');
    await testWebSocketConnection();
    
    console.log('');
    
    // Test reconnection
    log.info('Phase 2: Reconnection Test');
    await testWebSocketReconnection();
    
    console.log('');
    
    // Test performance
    log.info('Phase 3: Performance Test');
    const performanceResults = await testWebSocketPerformance();
    
    console.log('');
    
    // Display results
    console.log('📊 Test Results Summary');
    console.log('======================');
    console.log(`Connection: ${testResults.connection ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Authentication: ${testResults.authentication ? '✅ PASS' : '⚠️  SKIP'}`);
    console.log(`Data Received: ${testResults.dataReceived ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Ping/Pong: ${testResults.pingPong ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Reconnection: ${testResults.reconnection ? '✅ PASS' : '❌ FAIL'}`);
    
    if (performanceResults) {
      console.log(`Average Latency: ${performanceResults.averageLatency.toFixed(2)}ms`);
      console.log(`Messages Processed: ${performanceResults.messageCount}`);
    }
    
    if (testResults.errors.length > 0) {
      console.log('');
      console.log('❌ Errors Encountered:');
      testResults.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    }
    
    // Overall result
    const passedTests = Object.values(testResults).filter(result => result === true).length;
    const totalTests = Object.keys(testResults).length - 1; // Exclude errors array
    
    console.log('');
    if (passedTests >= totalTests - 1) { // Allow one optional test to fail
      log.success(`🎉 WebSocket tests passed (${passedTests}/${totalTests})`);
      process.exit(0);
    } else {
      log.error(`❌ WebSocket tests failed (${passedTests}/${totalTests})`);
      process.exit(1);
    }
    
  } catch (error) {
    log.error(`WebSocket test failed: ${error.message}`);
    process.exit(1);
  }
}

// Handle command line arguments
const command = process.argv[2];

switch (command) {
  case 'connection':
    testWebSocketConnection()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
    break;
  case 'reconnection':
    testWebSocketReconnection()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
    break;
  case 'performance':
    testWebSocketPerformance()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
    break;
  case 'help':
    console.log('WebSocket Connectivity Test Script');
    console.log('==================================');
    console.log('');
    console.log('Usage: node test-websocket.js [test_type]');
    console.log('');
    console.log('Test Types:');
    console.log('  (none)       - Run all tests (default)');
    console.log('  connection   - Test basic connection only');
    console.log('  reconnection - Test reconnection logic only');
    console.log('  performance  - Test performance metrics only');
    console.log('  help         - Show this help message');
    console.log('');
    console.log('Environment Variables:');
    console.log('  WEBSOCKET_URL - WebSocket server URL (default: ws://localhost:3000)');
    break;
  default:
    runWebSocketTests();
    break;
}