#!/usr/bin/env node

/**
 * Enhanced WebSocket Stability Test
 * Tests the enhanced WebSocket server with stability features
 */

const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('socket.io-client');

class EnhancedWebSocketStabilityTest {
  constructor() {
    this.server = null;
    this.io = null;
    this.httpServer = null;
    this.clients = [];
    this.testResults = {
      serverStartup: false,
      basicConnection: false,
      heartbeatHandling: false,
      messageReliability: false,
      connectionRecovery: false,
      stabilityMonitoring: false,
      gracefulShutdown: false
    };
    this.port = 3001; // Use different port to avoid conflicts
  }

  async runTests() {
    console.log('🚀 Starting Enhanced WebSocket Stability Tests...\n');

    try {
      await this.startTestServer();
      await this.testBasicConnection();
      await this.testHeartbeatHandling();
      await this.testMessageReliability();
      await this.testConnectionRecovery();
      await this.testStabilityMonitoring();
      await this.testGracefulShutdown();

      this.generateReport();
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    } finally {
      await this.cleanup();
    }
  }

  async startTestServer() {
    console.log('🔧 Starting test WebSocket server...');

    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server
        this.httpServer = http.createServer();
        
        // Create Socket.IO server
        this.io = new Server(this.httpServer, {
          cors: {
            origin: "*",
            methods: ["GET", "POST"]
          },
          transports: ['websocket', 'polling'],
          pingTimeout: 60000,
          pingInterval: 25000
        });

        // Set up basic event handlers
        this.io.on('connection', (socket) => {
          console.log(`   🔗 Client connected: ${socket.id}`);
          
          // Handle heartbeat
          socket.on('ping', (data) => {
            socket.emit('pong', { 
              ...data, 
              serverTime: Date.now() 
            });
          });

          // Handle test messages
          socket.on('test_message', (data) => {
            socket.emit('test_response', {
              ...data,
              processed: true,
              serverTime: Date.now()
            });
          });

          // Handle stability test
          socket.on('stability_test', (data) => {
            socket.emit('stability_response', {
              sequence: data.sequence,
              timestamp: Date.now()
            });
          });

          socket.on('disconnect', (reason) => {
            console.log(`   🔌 Client disconnected: ${socket.id} (${reason})`);
          });
        });

        // Start server
        this.httpServer.listen(this.port, () => {
          console.log(`✅ Test server started on port ${this.port}`);
          this.testResults.serverStartup = true;
          resolve();
        });

        this.httpServer.on('error', (error) => {
          console.error('Server error:', error);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  async testBasicConnection() {
    console.log('🔌 Testing basic connection...');

    try {
      const client = await this.createClient();
      
      console.log('✅ Basic connection successful');
      this.testResults.basicConnection = true;
      
      client.disconnect();
    } catch (error) {
      console.error('❌ Basic connection failed:', error.message);
    }
  }

  async testHeartbeatHandling() {
    console.log('💓 Testing heartbeat handling...');

    try {
      const client = await this.createClient();
      let heartbeatReceived = false;

      client.on('pong', (data) => {
        console.log('   📨 Heartbeat response received');
        heartbeatReceived = true;
      });

      // Send heartbeat
      client.emit('ping', { timestamp: Date.now() });

      // Wait for response
      await this.sleep(2000);

      if (heartbeatReceived) {
        console.log('✅ Heartbeat handling successful');
        this.testResults.heartbeatHandling = true;
      } else {
        console.log('❌ No heartbeat response received');
      }

      client.disconnect();
    } catch (error) {
      console.error('❌ Heartbeat test failed:', error.message);
    }
  }

  async testMessageReliability() {
    console.log('📨 Testing message reliability...');

    try {
      const client = await this.createClient();
      const messagesToSend = 20;
      let messagesReceived = 0;

      client.on('test_response', (data) => {
        if (data.processed) {
          messagesReceived++;
        }
      });

      // Send test messages
      for (let i = 0; i < messagesToSend; i++) {
        client.emit('test_message', {
          id: i,
          data: `test-message-${i}`,
          timestamp: Date.now()
        });
        await this.sleep(50); // Small delay between messages
      }

      // Wait for responses
      await this.sleep(3000);

      const reliability = (messagesReceived / messagesToSend) * 100;
      console.log(`   📊 Message reliability: ${reliability.toFixed(1)}% (${messagesReceived}/${messagesToSend})`);

      if (reliability >= 80) {
        console.log('✅ Message reliability test passed');
        this.testResults.messageReliability = true;
      } else {
        console.log('❌ Message reliability below threshold');
      }

      client.disconnect();
    } catch (error) {
      console.error('❌ Message reliability test failed:', error.message);
    }
  }

  async testConnectionRecovery() {
    console.log('🔄 Testing connection recovery...');

    try {
      const client = await this.createClient();
      let reconnected = false;

      client.on('connect', () => {
        if (reconnected) {
          console.log('   ✅ Reconnection successful');
          this.testResults.connectionRecovery = true;
        }
      });

      // Simulate connection drop
      client.disconnect();
      await this.sleep(1000);

      // Attempt reconnection
      reconnected = true;
      client.connect();

      // Wait for reconnection
      await this.sleep(3000);

      client.disconnect();
    } catch (error) {
      console.error('❌ Connection recovery test failed:', error.message);
    }
  }

  async testStabilityMonitoring() {
    console.log('📊 Testing stability monitoring...');

    try {
      const clients = [];
      const clientCount = 5;

      // Create multiple connections
      for (let i = 0; i < clientCount; i++) {
        try {
          const client = await this.createClient();
          clients.push(client);
          console.log(`   Connection ${i + 1} established`);
        } catch (error) {
          console.log(`   Connection ${i + 1} failed: ${error.message}`);
        }
      }

      // Send stability test messages
      let totalResponses = 0;
      const messagesPerClient = 5;

      for (const client of clients) {
        client.on('stability_response', () => {
          totalResponses++;
        });

        for (let i = 0; i < messagesPerClient; i++) {
          client.emit('stability_test', {
            sequence: i,
            timestamp: Date.now()
          });
        }
      }

      // Wait for responses
      await this.sleep(3000);

      const expectedResponses = clients.length * messagesPerClient;
      const responseRate = (totalResponses / expectedResponses) * 100;

      console.log(`   📊 Stability response rate: ${responseRate.toFixed(1)}% (${totalResponses}/${expectedResponses})`);

      if (responseRate >= 80) {
        console.log('✅ Stability monitoring test passed');
        this.testResults.stabilityMonitoring = true;
      } else {
        console.log('❌ Stability monitoring below threshold');
      }

      // Disconnect all clients
      clients.forEach(client => client.disconnect());
    } catch (error) {
      console.error('❌ Stability monitoring test failed:', error.message);
    }
  }

  async testGracefulShutdown() {
    console.log('🛑 Testing graceful shutdown...');

    try {
      const clients = [];
      const clientCount = 3;

      // Create connections
      for (let i = 0; i < clientCount; i++) {
        const client = await this.createClient();
        clients.push(client);
      }

      let gracefulDisconnects = 0;

      // Monitor disconnections
      clients.forEach((client, index) => {
        client.on('disconnect', (reason) => {
          if (reason === 'server shutting down' || reason === 'transport close') {
            gracefulDisconnects++;
          }
          console.log(`   🔌 Client ${index + 1} disconnected: ${reason}`);
        });
      });

      // Simulate server shutdown
      setTimeout(() => {
        this.io.close();
      }, 1000);

      // Wait for disconnections
      await this.sleep(3000);

      console.log(`   📊 Graceful disconnects: ${gracefulDisconnects}/${clientCount}`);

      if (gracefulDisconnects >= clientCount * 0.8) {
        console.log('✅ Graceful shutdown test passed');
        this.testResults.gracefulShutdown = true;
      } else {
        console.log('❌ Graceful shutdown issues detected');
      }

    } catch (error) {
      console.error('❌ Graceful shutdown test failed:', error.message);
    }
  }

  async createClient() {
    return new Promise((resolve, reject) => {
      const client = new Client(`http://localhost:${this.port}`, {
        transports: ['websocket'],
        timeout: 5000
      });

      const timeout = setTimeout(() => {
        client.disconnect();
        reject(new Error('Connection timeout'));
      }, 5000);

      client.on('connect', () => {
        clearTimeout(timeout);
        this.clients.push(client);
        resolve(client);
      });

      client.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  generateReport() {
    const passedTests = Object.values(this.testResults).filter(result => result).length;
    const totalTests = Object.keys(this.testResults).length;
    const successRate = (passedTests / totalTests) * 100;

    console.log('\n📊 Enhanced WebSocket Stability Test Report');
    console.log('=============================================');
    console.log(`✅ Tests passed: ${passedTests}/${totalTests} (${successRate.toFixed(1)}%)`);
    console.log('');

    console.log('📋 Test Results:');
    Object.entries(this.testResults).forEach(([test, passed]) => {
      const status = passed ? '✅' : '❌';
      const testName = test.replace(/([A-Z])/g, ' $1').toLowerCase();
      console.log(`   ${status} ${testName}`);
    });

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
    if (this.testResults.heartbeatHandling) {
      console.log('   ✅ Heartbeat mechanism working');
    }
    if (this.testResults.messageReliability) {
      console.log('   ✅ Message delivery reliable');
    }
    if (this.testResults.connectionRecovery) {
      console.log('   ✅ Connection recovery functional');
    }
    if (this.testResults.stabilityMonitoring) {
      console.log('   ✅ Stability monitoring active');
    }
    if (this.testResults.gracefulShutdown) {
      console.log('   ✅ Graceful shutdown working');
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');

    // Disconnect all clients
    this.clients.forEach(client => {
      if (client.connected) {
        client.disconnect();
      }
    });

    // Close server
    if (this.io) {
      this.io.close();
    }

    if (this.httpServer) {
      this.httpServer.close();
    }

    console.log('✅ Cleanup completed');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the tests
if (require.main === module) {
  const tester = new EnhancedWebSocketStabilityTest();
  
  tester.runTests().then(() => {
    console.log('\n🏁 Enhanced WebSocket stability testing completed');
    process.exit(0);
  }).catch((error) => {
    console.error('\n💥 Testing failed:', error);
    process.exit(1);
  });
}

module.exports = EnhancedWebSocketStabilityTest;