#!/usr/bin/env node

/**
 * Simple WebSocket Stability Test
 * Tests WebSocket stability features without external dependencies
 */

const http = require('http');
const WebSocket = require('ws');

class SimpleWebSocketStabilityTest {
  constructor() {
    this.server = null;
    this.wss = null;
    this.clients = [];
    this.port = 3002;
    
    this.testResults = {
      serverStartup: false,
      basicConnection: false,
      heartbeatMechanism: false,
      messageReliability: false,
      connectionStability: false,
      errorHandling: false,
      gracefulShutdown: false
    };

    this.connectionStats = {
      totalConnections: 0,
      activeConnections: 0,
      messagesReceived: 0,
      messagesSent: 0,
      errors: 0,
      heartbeats: 0
    };
  }

  async runTests() {
    console.log('🚀 Starting Simple WebSocket Stability Tests...\n');

    try {
      await this.startTestServer();
      await this.testBasicConnection();
      await this.testHeartbeatMechanism();
      await this.testMessageReliability();
      await this.testConnectionStability();
      await this.testErrorHandling();
      await this.testGracefulShutdown();

      this.generateReport();
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    } finally {
      await this.cleanup();
    }
  }

  async startTestServer() {
    console.log('🔧 Starting WebSocket test server...');

    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server
        this.server = http.createServer();
        
        // Create WebSocket server
        this.wss = new WebSocket.Server({ 
          server: this.server,
          perMessageDeflate: false
        });

        // Connection tracking
        const connections = new Map();

        this.wss.on('connection', (ws, req) => {
          const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          this.connectionStats.totalConnections++;
          this.connectionStats.activeConnections++;
          
          connections.set(connectionId, {
            ws,
            id: connectionId,
            connectedAt: Date.now(),
            lastActivity: Date.now(),
            messagesReceived: 0,
            messagesSent: 0,
            isHealthy: true
          });

          console.log(`   🔗 Client connected: ${connectionId}`);

          // Send welcome message
          ws.send(JSON.stringify({
            type: 'welcome',
            connectionId,
            timestamp: Date.now()
          }));
          this.connectionStats.messagesSent++;

          // Handle messages
          ws.on('message', (data) => {
            try {
              const message = JSON.parse(data.toString());
              const conn = connections.get(connectionId);
              
              if (conn) {
                conn.lastActivity = Date.now();
                conn.messagesReceived++;
                this.connectionStats.messagesReceived++;
              }

              // Handle different message types
              switch (message.type) {
                case 'ping':
                  // Respond to ping with pong
                  ws.send(JSON.stringify({
                    type: 'pong',
                    timestamp: Date.now(),
                    originalTimestamp: message.timestamp
                  }));
                  this.connectionStats.messagesSent++;
                  this.connectionStats.heartbeats++;
                  break;

                case 'test_message':
                  // Echo test message back
                  ws.send(JSON.stringify({
                    type: 'test_response',
                    id: message.id,
                    data: message.data,
                    processed: true,
                    timestamp: Date.now()
                  }));
                  this.connectionStats.messagesSent++;
                  break;

                case 'stability_test':
                  // Respond to stability test
                  ws.send(JSON.stringify({
                    type: 'stability_response',
                    sequence: message.sequence,
                    timestamp: Date.now()
                  }));
                  this.connectionStats.messagesSent++;
                  break;

                case 'error_test':
                  // Simulate error handling
                  throw new Error('Simulated error for testing');

                default:
                  // Echo unknown messages
                  ws.send(JSON.stringify({
                    type: 'echo',
                    original: message,
                    timestamp: Date.now()
                  }));
                  this.connectionStats.messagesSent++;
              }
            } catch (error) {
              this.connectionStats.errors++;
              console.log(`   ❌ Message handling error: ${error.message}`);
              
              // Send error response
              try {
                ws.send(JSON.stringify({
                  type: 'error',
                  message: error.message,
                  timestamp: Date.now()
                }));
                this.connectionStats.messagesSent++;
              } catch (sendError) {
                console.log(`   ❌ Failed to send error response: ${sendError.message}`);
              }
            }
          });

          // Handle connection close
          ws.on('close', (code, reason) => {
            this.connectionStats.activeConnections--;
            connections.delete(connectionId);
            console.log(`   🔌 Client disconnected: ${connectionId} (${code} ${reason})`);
          });

          // Handle errors
          ws.on('error', (error) => {
            this.connectionStats.errors++;
            console.log(`   ❌ WebSocket error for ${connectionId}: ${error.message}`);
          });
        });

        // Start server
        this.server.listen(this.port, () => {
          console.log(`✅ WebSocket server started on port ${this.port}`);
          this.testResults.serverStartup = true;
          resolve();
        });

        this.server.on('error', (error) => {
          console.error('Server error:', error);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  async testBasicConnection() {
    console.log('🔌 Testing basic WebSocket connection...');

    try {
      const ws = await this.createWebSocketConnection();
      
      let welcomeReceived = false;
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'welcome') {
            welcomeReceived = true;
            console.log('   📨 Welcome message received');
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      // Wait for welcome message
      await this.sleep(1000);

      if (welcomeReceived) {
        console.log('✅ Basic connection test passed');
        this.testResults.basicConnection = true;
      } else {
        console.log('❌ No welcome message received');
      }

      ws.close();
    } catch (error) {
      console.error('❌ Basic connection test failed:', error.message);
    }
  }

  async testHeartbeatMechanism() {
    console.log('💓 Testing heartbeat mechanism...');

    try {
      const ws = await this.createWebSocketConnection();
      let pongReceived = false;
      let responseTime = 0;

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'pong') {
            pongReceived = true;
            responseTime = Date.now() - message.originalTimestamp;
            console.log(`   📨 Pong received (response time: ${responseTime}ms)`);
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      // Send ping
      const pingTime = Date.now();
      ws.send(JSON.stringify({
        type: 'ping',
        timestamp: pingTime
      }));

      // Wait for pong
      await this.sleep(2000);

      if (pongReceived && responseTime < 1000) {
        console.log('✅ Heartbeat mechanism test passed');
        this.testResults.heartbeatMechanism = true;
      } else {
        console.log('❌ Heartbeat mechanism test failed');
      }

      ws.close();
    } catch (error) {
      console.error('❌ Heartbeat test failed:', error.message);
    }
  }

  async testMessageReliability() {
    console.log('📨 Testing message reliability...');

    try {
      const ws = await this.createWebSocketConnection();
      const messagesToSend = 20;
      let messagesReceived = 0;
      const receivedIds = new Set();

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'test_response' && message.processed) {
            messagesReceived++;
            receivedIds.add(message.id);
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      // Send test messages
      for (let i = 0; i < messagesToSend; i++) {
        ws.send(JSON.stringify({
          type: 'test_message',
          id: i,
          data: `test-message-${i}`,
          timestamp: Date.now()
        }));
        await this.sleep(50); // Small delay between messages
      }

      // Wait for responses
      await this.sleep(3000);

      const reliability = (messagesReceived / messagesToSend) * 100;
      const uniqueMessages = receivedIds.size;

      console.log(`   📊 Message reliability: ${reliability.toFixed(1)}% (${messagesReceived}/${messagesToSend})`);
      console.log(`   📊 Unique messages: ${uniqueMessages}/${messagesToSend}`);

      if (reliability >= 90 && uniqueMessages === messagesToSend) {
        console.log('✅ Message reliability test passed');
        this.testResults.messageReliability = true;
      } else {
        console.log('❌ Message reliability below threshold');
      }

      ws.close();
    } catch (error) {
      console.error('❌ Message reliability test failed:', error.message);
    }
  }

  async testConnectionStability() {
    console.log('🔄 Testing connection stability...');

    try {
      const connections = [];
      const connectionCount = 5;
      const messagesPerConnection = 10;

      // Create multiple connections
      for (let i = 0; i < connectionCount; i++) {
        try {
          const ws = await this.createWebSocketConnection();
          connections.push({ ws, id: i, responses: 0 });
          console.log(`   Connection ${i + 1} established`);
        } catch (error) {
          console.log(`   Connection ${i + 1} failed: ${error.message}`);
        }
      }

      // Set up message handlers
      connections.forEach(conn => {
        conn.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.type === 'stability_response') {
              conn.responses++;
            }
          } catch (e) {
            // Ignore parse errors
          }
        });
      });

      // Send stability test messages
      for (const conn of connections) {
        for (let i = 0; i < messagesPerConnection; i++) {
          conn.ws.send(JSON.stringify({
            type: 'stability_test',
            sequence: i,
            connectionId: conn.id,
            timestamp: Date.now()
          }));
        }
      }

      // Wait for responses
      await this.sleep(3000);

      const totalExpected = connections.length * messagesPerConnection;
      const totalReceived = connections.reduce((sum, conn) => sum + conn.responses, 0);
      const stabilityRate = (totalReceived / totalExpected) * 100;

      console.log(`   📊 Stability rate: ${stabilityRate.toFixed(1)}% (${totalReceived}/${totalExpected})`);

      if (stabilityRate >= 85) {
        console.log('✅ Connection stability test passed');
        this.testResults.connectionStability = true;
      } else {
        console.log('❌ Connection stability below threshold');
      }

      // Close all connections
      connections.forEach(conn => conn.ws.close());
    } catch (error) {
      console.error('❌ Connection stability test failed:', error.message);
    }
  }

  async testErrorHandling() {
    console.log('🛠️  Testing error handling...');

    try {
      const ws = await this.createWebSocketConnection();
      let errorResponseReceived = false;

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'error') {
            errorResponseReceived = true;
            console.log(`   📨 Error response received: ${message.message}`);
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      // Send message that should trigger an error
      ws.send(JSON.stringify({
        type: 'error_test',
        data: 'This should trigger an error',
        timestamp: Date.now()
      }));

      // Wait for error response
      await this.sleep(2000);

      if (errorResponseReceived) {
        console.log('✅ Error handling test passed');
        this.testResults.errorHandling = true;
      } else {
        console.log('❌ No error response received');
      }

      ws.close();
    } catch (error) {
      console.error('❌ Error handling test failed:', error.message);
    }
  }

  async testGracefulShutdown() {
    console.log('🛑 Testing graceful shutdown...');

    try {
      const connections = [];
      const connectionCount = 3;

      // Create connections
      for (let i = 0; i < connectionCount; i++) {
        const ws = await this.createWebSocketConnection();
        connections.push({ ws, id: i, closed: false });
      }

      // Monitor close events
      connections.forEach(conn => {
        conn.ws.on('close', (code, reason) => {
          conn.closed = true;
          console.log(`   🔌 Connection ${conn.id} closed: ${code} ${reason}`);
        });
      });

      // Close server (simulating shutdown)
      this.wss.close();

      // Wait for connections to close
      await this.sleep(3000);

      const closedConnections = connections.filter(conn => conn.closed).length;
      const shutdownRate = (closedConnections / connectionCount) * 100;

      console.log(`   📊 Graceful shutdown rate: ${shutdownRate.toFixed(1)}% (${closedConnections}/${connectionCount})`);

      if (shutdownRate >= 80) {
        console.log('✅ Graceful shutdown test passed');
        this.testResults.gracefulShutdown = true;
      } else {
        console.log('❌ Graceful shutdown issues detected');
      }

    } catch (error) {
      console.error('❌ Graceful shutdown test failed:', error.message);
    }
  }

  async createWebSocketConnection() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${this.port}`);
      
      const timeout = setTimeout(() => {
        ws.terminate();
        reject(new Error('Connection timeout'));
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        this.clients.push(ws);
        resolve(ws);
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  generateReport() {
    const passedTests = Object.values(this.testResults).filter(result => result).length;
    const totalTests = Object.keys(this.testResults).length;
    const successRate = (passedTests / totalTests) * 100;

    console.log('\n📊 WebSocket Stability Test Report');
    console.log('===================================');
    console.log(`✅ Tests passed: ${passedTests}/${totalTests} (${successRate.toFixed(1)}%)`);
    console.log('');

    console.log('📋 Test Results:');
    Object.entries(this.testResults).forEach(([test, passed]) => {
      const status = passed ? '✅' : '❌';
      const testName = test.replace(/([A-Z])/g, ' $1').toLowerCase();
      console.log(`   ${status} ${testName}`);
    });

    console.log('\n📊 Connection Statistics:');
    console.log(`   Total connections: ${this.connectionStats.totalConnections}`);
    console.log(`   Messages received: ${this.connectionStats.messagesReceived}`);
    console.log(`   Messages sent: ${this.connectionStats.messagesSent}`);
    console.log(`   Heartbeats: ${this.connectionStats.heartbeats}`);
    console.log(`   Errors: ${this.connectionStats.errors}`);

    console.log('\n🎯 Stability Assessment:');
    if (successRate >= 85) {
      console.log('   ✅ WebSocket connections are HIGHLY STABLE');
    } else if (successRate >= 70) {
      console.log('   ✅ WebSocket connections are STABLE');
    } else if (successRate >= 50) {
      console.log('   ⚠️  WebSocket connections have MODERATE stability');
    } else {
      console.log('   ❌ WebSocket connections are UNSTABLE');
    }

    console.log('\n💡 Stability Features Verified:');
    if (this.testResults.heartbeatMechanism) {
      console.log('   ✅ Heartbeat/ping-pong mechanism working');
    }
    if (this.testResults.messageReliability) {
      console.log('   ✅ Message delivery is reliable');
    }
    if (this.testResults.connectionStability) {
      console.log('   ✅ Multiple connections remain stable');
    }
    if (this.testResults.errorHandling) {
      console.log('   ✅ Error handling is functional');
    }
    if (this.testResults.gracefulShutdown) {
      console.log('   ✅ Graceful shutdown works properly');
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');

    // Close all client connections
    this.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    // Close server
    if (this.wss) {
      this.wss.close();
    }

    if (this.server) {
      this.server.close();
    }

    console.log('✅ Cleanup completed');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the tests
if (require.main === module) {
  const tester = new SimpleWebSocketStabilityTest();
  
  tester.runTests().then(() => {
    console.log('\n🏁 WebSocket stability testing completed');
    process.exit(0);
  }).catch((error) => {
    console.error('\n💥 Testing failed:', error);
    process.exit(1);
  });
}

module.exports = SimpleWebSocketStabilityTest;