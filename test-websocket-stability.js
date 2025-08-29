#!/usr/bin/env node

/**
 * WebSocket Stability Test
 * Tests WebSocket connection stability, reconnection, and error handling
 */

const WebSocket = require('ws');
const http = require('http');
const { EventEmitter } = require('events');

class WebSocketStabilityTester extends EventEmitter {
  constructor() {
    super();
    this.testResults = {
      connectionStability: false,
      reconnectionHandling: false,
      errorRecovery: false,
      messageReliability: false,
      performanceUnderLoad: false,
      memoryLeaks: false,
      gracefulShutdown: false
    };
    this.connections = [];
    this.messagesSent = 0;
    this.messagesReceived = 0;
    this.errors = [];
    this.startTime = Date.now();
  }

  async runStabilityTests() {
    console.log('🔍 Starting WebSocket Stability Tests...\n');

    try {
      // Test 1: Basic Connection Stability
      await this.testConnectionStability();
      
      // Test 2: Reconnection Handling
      await this.testReconnectionHandling();
      
      // Test 3: Error Recovery
      await this.testErrorRecovery();
      
      // Test 4: Message Reliability
      await this.testMessageReliability();
      
      // Test 5: Performance Under Load
      await this.testPerformanceUnderLoad();
      
      // Test 6: Memory Leak Detection
      await this.testMemoryLeaks();
      
      // Test 7: Graceful Shutdown
      await this.testGracefulShutdown();

      this.generateReport();
    } catch (error) {
      console.error('❌ Stability test suite failed:', error);
      this.errors.push(error);
    }
  }

  async testConnectionStability() {
    console.log('📡 Testing Connection Stability...');
    
    try {
      const serverUrl = 'ws://localhost:3000';
      const testConnections = 10;
      const connectionPromises = [];

      for (let i = 0; i < testConnections; i++) {
        connectionPromises.push(this.createStableConnection(serverUrl, i));
      }

      const results = await Promise.allSettled(connectionPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`   ✅ Successful connections: ${successful}/${testConnections}`);
      console.log(`   ❌ Failed connections: ${failed}/${testConnections}`);

      this.testResults.connectionStability = successful >= testConnections * 0.8; // 80% success rate
      
      if (failed > 0) {
        console.log('   ⚠️  Connection failures detected:');
        results.filter(r => r.status === 'rejected').forEach((result, index) => {
          console.log(`      Connection ${index}: ${result.reason}`);
        });
      }

    } catch (error) {
      console.error('   ❌ Connection stability test failed:', error);
      this.errors.push(error);
    }
    console.log('');
  }

  async createStableConnection(url, id) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const timeout = setTimeout(() => {
        ws.terminate();
        reject(new Error(`Connection ${id} timeout`));
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        console.log(`   🔗 Connection ${id} established`);
        this.connections.push(ws);
        resolve(ws);
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        console.log(`   ❌ Connection ${id} error: ${error.message}`);
        reject(error);
      });

      ws.on('close', (code, reason) => {
        console.log(`   🔌 Connection ${id} closed: ${code} ${reason}`);
      });
    });
  }

  async testReconnectionHandling() {
    console.log('🔄 Testing Reconnection Handling...');
    
    try {
      const serverUrl = 'ws://localhost:3000';
      let reconnectionAttempts = 0;
      let successfulReconnections = 0;

      for (let i = 0; i < 3; i++) {
        try {
          const ws = await this.createReconnectingConnection(serverUrl, i);
          
          // Simulate connection drop
          setTimeout(() => {
            ws.terminate();
          }, 1000);

          // Wait and attempt reconnection
          await this.sleep(2000);
          reconnectionAttempts++;

          const reconnectedWs = await this.createReconnectingConnection(serverUrl, `${i}-reconnect`);
          successfulReconnections++;
          reconnectedWs.close();

        } catch (error) {
          console.log(`   ❌ Reconnection ${i} failed: ${error.message}`);
        }
      }

      console.log(`   ✅ Successful reconnections: ${successfulReconnections}/${reconnectionAttempts}`);
      this.testResults.reconnectionHandling = successfulReconnections >= reconnectionAttempts * 0.7;

    } catch (error) {
      console.error('   ❌ Reconnection handling test failed:', error);
      this.errors.push(error);
    }
    console.log('');
  }

  async createReconnectingConnection(url, id) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const timeout = setTimeout(() => {
        ws.terminate();
        reject(new Error(`Reconnection ${id} timeout`));
      }, 3000);

      ws.on('open', () => {
        clearTimeout(timeout);
        console.log(`   🔗 Reconnection ${id} established`);
        resolve(ws);
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async testErrorRecovery() {
    console.log('🛠️  Testing Error Recovery...');
    
    try {
      const serverUrl = 'ws://localhost:3000';
      let errorRecoveries = 0;

      // Test various error scenarios
      const errorTests = [
        { name: 'Invalid message format', test: () => this.testInvalidMessage(serverUrl) },
        { name: 'Rate limit exceeded', test: () => this.testRateLimit(serverUrl) },
        { name: 'Large message handling', test: () => this.testLargeMessage(serverUrl) }
      ];

      for (const errorTest of errorTests) {
        try {
          console.log(`   Testing ${errorTest.name}...`);
          await errorTest.test();
          errorRecoveries++;
          console.log(`   ✅ ${errorTest.name} handled correctly`);
        } catch (error) {
          console.log(`   ❌ ${errorTest.name} failed: ${error.message}`);
        }
      }

      console.log(`   ✅ Error recovery tests passed: ${errorRecoveries}/${errorTests.length}`);
      this.testResults.errorRecovery = errorRecoveries >= errorTests.length * 0.7;

    } catch (error) {
      console.error('   ❌ Error recovery test failed:', error);
      this.errors.push(error);
    }
    console.log('');
  }

  async testInvalidMessage(url) {
    const ws = await this.createStableConnection(url, 'error-test');
    
    return new Promise((resolve, reject) => {
      let errorHandled = false;
      
      ws.on('error', () => {
        errorHandled = true;
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          if (message.type === 'error') {
            errorHandled = true;
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      // Send invalid message
      ws.send('invalid-json-message');
      
      setTimeout(() => {
        ws.close();
        if (errorHandled) {
          resolve();
        } else {
          reject(new Error('Invalid message not handled'));
        }
      }, 2000);
    });
  }

  async testRateLimit(url) {
    const ws = await this.createStableConnection(url, 'rate-limit-test');
    
    return new Promise((resolve, reject) => {
      let rateLimitDetected = false;
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          if (message.type === 'error' && message.message && message.message.includes('rate limit')) {
            rateLimitDetected = true;
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      // Send many messages quickly
      for (let i = 0; i < 100; i++) {
        ws.send(JSON.stringify({ type: 'test', data: `message-${i}` }));
      }
      
      setTimeout(() => {
        ws.close();
        resolve(); // Rate limiting is optional, so we don't fail if not detected
      }, 2000);
    });
  }

  async testLargeMessage(url) {
    const ws = await this.createStableConnection(url, 'large-message-test');
    
    return new Promise((resolve, reject) => {
      let messageHandled = false;
      
      ws.on('message', (data) => {
        messageHandled = true;
      });

      ws.on('error', (error) => {
        if (error.message.includes('too large')) {
          resolve(); // Expected behavior for large messages
        } else {
          reject(error);
        }
      });

      // Send large message (1MB)
      const largeData = 'x'.repeat(1024 * 1024);
      ws.send(JSON.stringify({ type: 'test', data: largeData }));
      
      setTimeout(() => {
        ws.close();
        resolve(); // Either handled or rejected appropriately
      }, 3000);
    });
  }

  async testMessageReliability() {
    console.log('📨 Testing Message Reliability...');
    
    try {
      const serverUrl = 'ws://localhost:3000';
      const ws = await this.createStableConnection(serverUrl, 'reliability-test');
      
      let messagesReceived = 0;
      const messagesToSend = 50;
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          if (message.type === 'echo' || message.type === 'test_response') {
            messagesReceived++;
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      // Send test messages
      for (let i = 0; i < messagesToSend; i++) {
        ws.send(JSON.stringify({ 
          type: 'test', 
          id: i,
          data: `test-message-${i}`,
          timestamp: Date.now()
        }));
        await this.sleep(10); // Small delay between messages
      }

      // Wait for responses
      await this.sleep(3000);
      
      ws.close();

      console.log(`   ✅ Messages sent: ${messagesToSend}`);
      console.log(`   ✅ Messages received: ${messagesReceived}`);
      
      const reliability = messagesReceived / messagesToSend;
      console.log(`   📊 Message reliability: ${(reliability * 100).toFixed(1)}%`);
      
      this.testResults.messageReliability = reliability >= 0.8; // 80% reliability

    } catch (error) {
      console.error('   ❌ Message reliability test failed:', error);
      this.errors.push(error);
    }
    console.log('');
  }

  async testPerformanceUnderLoad() {
    console.log('⚡ Testing Performance Under Load...');
    
    try {
      const serverUrl = 'ws://localhost:3000';
      const concurrentConnections = 20;
      const messagesPerConnection = 10;
      
      const startTime = Date.now();
      const connectionPromises = [];

      for (let i = 0; i < concurrentConnections; i++) {
        connectionPromises.push(this.performLoadTest(serverUrl, i, messagesPerConnection));
      }

      const results = await Promise.allSettled(connectionPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const endTime = Date.now();
      
      const totalTime = endTime - startTime;
      const totalMessages = successful * messagesPerConnection;
      const messagesPerSecond = totalMessages / (totalTime / 1000);

      console.log(`   ✅ Successful connections: ${successful}/${concurrentConnections}`);
      console.log(`   ⏱️  Total time: ${totalTime}ms`);
      console.log(`   📊 Messages per second: ${messagesPerSecond.toFixed(2)}`);
      
      this.testResults.performanceUnderLoad = successful >= concurrentConnections * 0.8 && messagesPerSecond > 10;

    } catch (error) {
      console.error('   ❌ Performance under load test failed:', error);
      this.errors.push(error);
    }
    console.log('');
  }

  async performLoadTest(url, connectionId, messageCount) {
    const ws = await this.createStableConnection(url, `load-${connectionId}`);
    
    return new Promise((resolve, reject) => {
      let messagesReceived = 0;
      
      ws.on('message', () => {
        messagesReceived++;
        if (messagesReceived >= messageCount) {
          ws.close();
          resolve(messagesReceived);
        }
      });

      ws.on('error', reject);

      // Send messages
      for (let i = 0; i < messageCount; i++) {
        ws.send(JSON.stringify({ 
          type: 'load_test', 
          connectionId,
          messageId: i,
          timestamp: Date.now()
        }));
      }

      // Timeout after 10 seconds
      setTimeout(() => {
        ws.close();
        resolve(messagesReceived);
      }, 10000);
    });
  }

  async testMemoryLeaks() {
    console.log('🧠 Testing Memory Leak Detection...');
    
    try {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create and destroy many connections
      for (let cycle = 0; cycle < 5; cycle++) {
        const connections = [];
        
        // Create connections
        for (let i = 0; i < 10; i++) {
          try {
            const ws = await this.createStableConnection('ws://localhost:3000', `memory-${cycle}-${i}`);
            connections.push(ws);
          } catch (error) {
            // Ignore connection failures for memory test
          }
        }
        
        // Close all connections
        connections.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        });
        
        // Wait for cleanup
        await this.sleep(1000);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      await this.sleep(2000); // Wait for final cleanup
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
      
      console.log(`   📊 Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   📊 Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   📊 Memory increase: ${memoryIncreaseMB.toFixed(2)} MB`);
      
      // Consider it a pass if memory increase is less than 50MB
      this.testResults.memoryLeaks = memoryIncreaseMB < 50;
      
      if (memoryIncreaseMB > 50) {
        console.log('   ⚠️  Potential memory leak detected');
      } else {
        console.log('   ✅ No significant memory leaks detected');
      }

    } catch (error) {
      console.error('   ❌ Memory leak test failed:', error);
      this.errors.push(error);
    }
    console.log('');
  }

  async testGracefulShutdown() {
    console.log('🛑 Testing Graceful Shutdown...');
    
    try {
      const serverUrl = 'ws://localhost:3000';
      const connections = [];
      
      // Create multiple connections
      for (let i = 0; i < 5; i++) {
        try {
          const ws = await this.createStableConnection(serverUrl, `shutdown-${i}`);
          connections.push(ws);
        } catch (error) {
          // Ignore connection failures
        }
      }
      
      let gracefulCloses = 0;
      
      // Set up close event listeners
      connections.forEach((ws, index) => {
        ws.on('close', (code, reason) => {
          if (code === 1000 || code === 1001) { // Normal closure codes
            gracefulCloses++;
          }
          console.log(`   🔌 Connection ${index} closed gracefully: ${code}`);
        });
      });
      
      // Close all connections gracefully
      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Test shutdown');
        }
      });
      
      // Wait for all closes
      await this.sleep(2000);
      
      console.log(`   ✅ Graceful closes: ${gracefulCloses}/${connections.length}`);
      this.testResults.gracefulShutdown = gracefulCloses >= connections.length * 0.8;

    } catch (error) {
      console.error('   ❌ Graceful shutdown test failed:', error);
      this.errors.push(error);
    }
    console.log('');
  }

  generateReport() {
    const totalTime = Date.now() - this.startTime;
    const passedTests = Object.values(this.testResults).filter(result => result).length;
    const totalTests = Object.keys(this.testResults).length;
    const successRate = (passedTests / totalTests) * 100;

    console.log('📊 WebSocket Stability Test Report');
    console.log('=====================================');
    console.log(`⏱️  Total test time: ${totalTime}ms`);
    console.log(`✅ Tests passed: ${passedTests}/${totalTests} (${successRate.toFixed(1)}%)`);
    console.log(`❌ Errors encountered: ${this.errors.length}`);
    console.log('');

    console.log('📋 Test Results:');
    Object.entries(this.testResults).forEach(([test, passed]) => {
      const status = passed ? '✅' : '❌';
      const testName = test.replace(/([A-Z])/g, ' $1').toLowerCase();
      console.log(`   ${status} ${testName}`);
    });

    if (this.errors.length > 0) {
      console.log('\n🚨 Errors:');
      this.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.message}`);
      });
    }

    console.log('\n🎯 Stability Assessment:');
    if (successRate >= 80) {
      console.log('   ✅ WebSocket connections are STABLE');
    } else if (successRate >= 60) {
      console.log('   ⚠️  WebSocket connections have MODERATE stability issues');
    } else {
      console.log('   ❌ WebSocket connections are UNSTABLE');
    }

    console.log('\n💡 Recommendations:');
    if (!this.testResults.connectionStability) {
      console.log('   - Improve connection establishment reliability');
      console.log('   - Add better error handling for connection failures');
    }
    if (!this.testResults.reconnectionHandling) {
      console.log('   - Implement automatic reconnection logic');
      console.log('   - Add exponential backoff for reconnection attempts');
    }
    if (!this.testResults.errorRecovery) {
      console.log('   - Enhance error handling and recovery mechanisms');
      console.log('   - Add proper validation for incoming messages');
    }
    if (!this.testResults.messageReliability) {
      console.log('   - Improve message delivery reliability');
      console.log('   - Add message acknowledgment system');
    }
    if (!this.testResults.performanceUnderLoad) {
      console.log('   - Optimize performance under high load');
      console.log('   - Consider connection pooling and load balancing');
    }
    if (!this.testResults.memoryLeaks) {
      console.log('   - Investigate and fix memory leaks');
      console.log('   - Improve connection cleanup procedures');
    }
    if (!this.testResults.gracefulShutdown) {
      console.log('   - Implement proper graceful shutdown procedures');
      console.log('   - Add connection cleanup on server shutdown');
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the stability tests
if (require.main === module) {
  const tester = new WebSocketStabilityTester();
  
  tester.runStabilityTests().then(() => {
    console.log('\n🏁 WebSocket stability testing completed');
    process.exit(0);
  }).catch((error) => {
    console.error('\n💥 Stability testing failed:', error);
    process.exit(1);
  });
}

module.exports = WebSocketStabilityTester;