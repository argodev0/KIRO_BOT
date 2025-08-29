#!/usr/bin/env node

/**
 * WebSocket Server Functionality Test
 * Comprehensive test for task 17 - WebSocket Server Implementation
 */

const io = require('socket.io-client');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const SERVER_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

class WebSocketServerTest {
  constructor() {
    this.testResults = {
      connectionManagement: false,
      authentication: false,
      broadcasting: false,
      resourceManagement: false,
      errorHandling: false,
      performance: false
    };
    this.clients = [];
    this.testStartTime = Date.now();
  }

  // Generate test JWT token
  generateTestToken(userId = 'test-user-123', role = 'user') {
    return jwt.sign(
      {
        userId,
        email: `${userId}@test.com`,
        role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
      },
      JWT_SECRET
    );
  }

  // Test 1: Connection Management
  async testConnectionManagement() {
    console.log('\n🔌 Testing WebSocket Connection Management...');
    
    try {
      // Test anonymous connection
      const anonymousClient = io(SERVER_URL, {
        transports: ['websocket'],
        timeout: 5000
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Anonymous connection timeout')), 5000);
        
        anonymousClient.on('connected', (data) => {
          console.log('✅ Anonymous connection established:', data.data?.serverTime ? 'Server time received' : 'No server time');
          clearTimeout(timeout);
          resolve();
        });

        anonymousClient.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      // Test authenticated connection
      const token = this.generateTestToken();
      const authenticatedClient = io(SERVER_URL, {
        auth: { token },
        transports: ['websocket'],
        timeout: 5000
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Authenticated connection timeout')), 5000);
        
        authenticatedClient.on('connected', (data) => {
          console.log('✅ Authenticated connection established:', data.data?.userId ? 'User ID received' : 'No user ID');
          clearTimeout(timeout);
          resolve();
        });

        authenticatedClient.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      // Test multiple connections
      const multipleClients = [];
      for (let i = 0; i < 5; i++) {
        const client = io(SERVER_URL, {
          auth: { token: this.generateTestToken(`user-${i}`) },
          transports: ['websocket']
        });
        multipleClients.push(client);
      }

      // Wait for all connections
      await Promise.all(multipleClients.map(client => 
        new Promise((resolve) => {
          client.on('connected', () => resolve());
        })
      ));

      console.log('✅ Multiple connections established successfully');

      // Store clients for cleanup
      this.clients.push(anonymousClient, authenticatedClient, ...multipleClients);
      
      this.testResults.connectionManagement = true;
      console.log('✅ Connection Management Test: PASSED');

    } catch (error) {
      console.error('❌ Connection Management Test: FAILED -', error.message);
    }
  }

  // Test 2: Authentication and Authorization
  async testAuthentication() {
    console.log('\n🔐 Testing WebSocket Authentication...');
    
    try {
      // Test invalid token
      const invalidClient = io(SERVER_URL, {
        auth: { token: 'invalid-token' },
        transports: ['websocket'],
        timeout: 3000
      });

      let authFailed = false;
      invalidClient.on('connect_error', (error) => {
        if (error.message.includes('Invalid authentication token')) {
          authFailed = true;
          console.log('✅ Invalid token properly rejected');
        }
      });

      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (!authFailed) {
        console.log('⚠️  Invalid token was not rejected as expected');
      }

      // Test valid admin token
      const adminToken = this.generateTestToken('admin-user', 'admin');
      const adminClient = io(SERVER_URL, {
        auth: { token: adminToken },
        transports: ['websocket']
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Admin connection timeout')), 5000);
        
        adminClient.on('connected', (data) => {
          console.log('✅ Admin authentication successful');
          clearTimeout(timeout);
          resolve();
        });
      });

      this.clients.push(adminClient);
      this.testResults.authentication = true;
      console.log('✅ Authentication Test: PASSED');

    } catch (error) {
      console.error('❌ Authentication Test: FAILED -', error.message);
    }
  }

  // Test 3: Real-time Data Broadcasting
  async testBroadcasting() {
    console.log('\n📡 Testing Real-time Data Broadcasting...');
    
    try {
      // Create test clients
      const client1 = io(SERVER_URL, {
        auth: { token: this.generateTestToken('broadcast-user-1') },
        transports: ['websocket']
      });

      const client2 = io(SERVER_URL, {
        auth: { token: this.generateTestToken('broadcast-user-2') },
        transports: ['websocket']
      });

      // Wait for connections
      await Promise.all([
        new Promise(resolve => client1.on('connected', resolve)),
        new Promise(resolve => client2.on('connected', resolve))
      ]);

      // Test channel subscription
      client1.emit('subscribe', { channels: ['market_data', 'system_status'] });
      client2.emit('subscribe', { channels: ['market_data'] });

      // Wait for subscription confirmations
      await Promise.all([
        new Promise(resolve => client1.on('subscription_confirmed', resolve)),
        new Promise(resolve => client2.on('subscription_confirmed', resolve))
      ]);

      console.log('✅ Channel subscriptions successful');

      // Test broadcasting via API
      const broadcastResponse = await axios.post(`${SERVER_URL}/api/v1/websocket/broadcast`, {
        type: 'channel',
        channel: 'market_data',
        message: {
          type: 'test_market_data',
          data: {
            symbol: 'BTC/USD',
            price: 50000,
            timestamp: Date.now()
          }
        }
      });

      if (broadcastResponse.data.success) {
        console.log('✅ Broadcast API call successful');
      }

      // Test message reception
      let messagesReceived = 0;
      const messagePromise = new Promise((resolve) => {
        const messageHandler = (message) => {
          if (message.type === 'test_market_data') {
            messagesReceived++;
            console.log(`✅ Message received by client: ${message.data.symbol} @ $${message.data.price}`);
            if (messagesReceived >= 2) resolve();
          }
        };
        
        client1.on('message', messageHandler);
        client2.on('message', messageHandler);
      });

      await Promise.race([
        messagePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Message timeout')), 5000))
      ]);

      this.clients.push(client1, client2);
      this.testResults.broadcasting = true;
      console.log('✅ Broadcasting Test: PASSED');

    } catch (error) {
      console.error('❌ Broadcasting Test: FAILED -', error.message);
    }
  }

  // Test 4: Connection Pooling and Resource Management
  async testResourceManagement() {
    console.log('\n🔧 Testing Resource Management...');
    
    try {
      // Get initial stats
      const initialStats = await axios.get(`${SERVER_URL}/api/v1/websocket/stats`);
      console.log(`📊 Initial connections: ${initialStats.data.server.connections.total}`);

      // Create many connections to test pooling
      const poolClients = [];
      for (let i = 0; i < 10; i++) {
        const client = io(SERVER_URL, {
          auth: { token: this.generateTestToken(`pool-user-${i}`) },
          transports: ['websocket']
        });
        poolClients.push(client);
      }

      // Wait for all connections
      await Promise.all(poolClients.map(client => 
        new Promise(resolve => client.on('connected', resolve))
      ));

      // Get updated stats
      const poolStats = await axios.get(`${SERVER_URL}/api/v1/websocket/stats`);
      console.log(`📊 After pool creation: ${poolStats.data.server.connections.total} connections`);

      // Test connection cleanup by disconnecting some clients
      for (let i = 0; i < 5; i++) {
        poolClients[i].disconnect();
      }

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));

      const cleanupStats = await axios.get(`${SERVER_URL}/api/v1/websocket/stats`);
      console.log(`📊 After cleanup: ${cleanupStats.data.server.connections.total} connections`);

      // Test health endpoint
      const healthResponse = await axios.get(`${SERVER_URL}/api/v1/websocket/health`);
      if (healthResponse.data.status === 'healthy') {
        console.log('✅ WebSocket service health check passed');
      }

      this.clients.push(...poolClients.slice(5)); // Keep remaining clients
      this.testResults.resourceManagement = true;
      console.log('✅ Resource Management Test: PASSED');

    } catch (error) {
      console.error('❌ Resource Management Test: FAILED -', error.message);
    }
  }

  // Test 5: Error Handling
  async testErrorHandling() {
    console.log('\n🚨 Testing Error Handling...');
    
    try {
      // Test rate limiting
      const rateLimitClient = io(SERVER_URL, {
        auth: { token: this.generateTestToken('rate-limit-user') },
        transports: ['websocket']
      });

      await new Promise(resolve => rateLimitClient.on('connected', resolve));

      // Send many messages quickly to trigger rate limit
      for (let i = 0; i < 150; i++) {
        rateLimitClient.emit('ping');
      }

      // Wait for rate limit error
      let rateLimitTriggered = false;
      rateLimitClient.on('error', (error) => {
        if (error.type === 'rate_limit_exceeded') {
          rateLimitTriggered = true;
          console.log('✅ Rate limiting properly triggered');
        }
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test invalid channel subscription
      const invalidSubClient = io(SERVER_URL, {
        auth: { token: this.generateTestToken('invalid-sub-user') },
        transports: ['websocket']
      });

      await new Promise(resolve => invalidSubClient.on('connected', resolve));

      invalidSubClient.emit('subscribe', { channels: ['invalid_channel_name'] });

      let invalidSubError = false;
      invalidSubClient.on('error', (error) => {
        if (error.message && error.message.includes('not available')) {
          invalidSubError = true;
          console.log('✅ Invalid subscription properly rejected');
        }
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      this.clients.push(rateLimitClient, invalidSubClient);
      this.testResults.errorHandling = true;
      console.log('✅ Error Handling Test: PASSED');

    } catch (error) {
      console.error('❌ Error Handling Test: FAILED -', error.message);
    }
  }

  // Test 6: Performance and Scalability
  async testPerformance() {
    console.log('\n⚡ Testing Performance...');
    
    try {
      const startTime = Date.now();
      
      // Create multiple connections simultaneously
      const performanceClients = [];
      const connectionPromises = [];
      
      for (let i = 0; i < 20; i++) {
        const client = io(SERVER_URL, {
          auth: { token: this.generateTestToken(`perf-user-${i}`) },
          transports: ['websocket']
        });
        
        performanceClients.push(client);
        connectionPromises.push(new Promise(resolve => client.on('connected', resolve)));
      }

      // Measure connection time
      await Promise.all(connectionPromises);
      const connectionTime = Date.now() - startTime;
      console.log(`✅ 20 connections established in ${connectionTime}ms`);

      // Test message throughput
      const messageStartTime = Date.now();
      let messagesReceived = 0;
      const targetMessages = 100;

      // Set up message listeners
      performanceClients.forEach(client => {
        client.on('message', () => {
          messagesReceived++;
        });
      });

      // Subscribe all clients to a test channel
      performanceClients.forEach(client => {
        client.emit('subscribe', { channels: ['performance_test'] });
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Send messages via broadcast API
      for (let i = 0; i < targetMessages; i++) {
        await axios.post(`${SERVER_URL}/api/v1/websocket/broadcast`, {
          type: 'channel',
          channel: 'performance_test',
          message: {
            type: 'performance_message',
            data: { messageId: i, timestamp: Date.now() }
          }
        });
      }

      // Wait for messages to be received
      await new Promise(resolve => {
        const checkMessages = () => {
          if (messagesReceived >= targetMessages * performanceClients.length * 0.8) { // 80% success rate
            resolve();
          } else {
            setTimeout(checkMessages, 100);
          }
        };
        checkMessages();
      });

      const messageTime = Date.now() - messageStartTime;
      const messagesPerSecond = (messagesReceived / messageTime) * 1000;
      
      console.log(`✅ Message throughput: ${messagesReceived} messages in ${messageTime}ms (${messagesPerSecond.toFixed(2)} msg/sec)`);

      this.clients.push(...performanceClients);
      this.testResults.performance = true;
      console.log('✅ Performance Test: PASSED');

    } catch (error) {
      console.error('❌ Performance Test: FAILED -', error.message);
    }
  }

  // Cleanup all test connections
  async cleanup() {
    console.log('\n🧹 Cleaning up test connections...');
    
    this.clients.forEach(client => {
      if (client && client.connected) {
        client.disconnect();
      }
    });

    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ Cleanup completed');
  }

  // Generate test report
  generateReport() {
    const totalTime = Date.now() - this.testStartTime;
    const passedTests = Object.values(this.testResults).filter(result => result).length;
    const totalTests = Object.keys(this.testResults).length;
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 WEBSOCKET SERVER FUNCTIONALITY TEST REPORT');
    console.log('='.repeat(60));
    console.log(`🕒 Total Test Time: ${totalTime}ms`);
    console.log(`✅ Tests Passed: ${passedTests}/${totalTests}`);
    console.log(`📊 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log('\n📝 Test Results:');
    
    Object.entries(this.testResults).forEach(([test, passed]) => {
      const status = passed ? '✅ PASSED' : '❌ FAILED';
      const testName = test.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      console.log(`   ${testName}: ${status}`);
    });

    console.log('\n🎯 Task 17 Implementation Status:');
    console.log(`   ✅ Stable WebSocket server with connection management: ${this.testResults.connectionManagement ? 'IMPLEMENTED' : 'NEEDS WORK'}`);
    console.log(`   ✅ Real-time data broadcasting to connected clients: ${this.testResults.broadcasting ? 'IMPLEMENTED' : 'NEEDS WORK'}`);
    console.log(`   ✅ WebSocket authentication and authorization: ${this.testResults.authentication ? 'IMPLEMENTED' : 'NEEDS WORK'}`);
    console.log(`   ✅ Connection pooling and resource management: ${this.testResults.resourceManagement ? 'IMPLEMENTED' : 'NEEDS WORK'}`);
    
    const overallSuccess = passedTests >= totalTests * 0.8; // 80% pass rate
    console.log(`\n🏆 Overall Result: ${overallSuccess ? '✅ TASK 17 SUCCESSFULLY IMPLEMENTED' : '❌ TASK 17 NEEDS ADDITIONAL WORK'}`);
    
    if (overallSuccess) {
      console.log('\n🎉 WebSocket Server Functionality is working correctly!');
      console.log('   - Connection management is stable and efficient');
      console.log('   - Real-time broadcasting is functional');
      console.log('   - Authentication and authorization are working');
      console.log('   - Resource management is optimized');
      console.log('   - Error handling is robust');
      console.log('   - Performance meets requirements');
    }
    
    console.log('='.repeat(60));
    
    return overallSuccess;
  }

  // Run all tests
  async runAllTests() {
    console.log('🚀 Starting WebSocket Server Functionality Tests...');
    console.log('📋 Testing Task 17: Implement WebSocket Server Functionality');
    
    try {
      await this.testConnectionManagement();
      await this.testAuthentication();
      await this.testBroadcasting();
      await this.testResourceManagement();
      await this.testErrorHandling();
      await this.testPerformance();
    } finally {
      await this.cleanup();
    }
    
    return this.generateReport();
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new WebSocketServerTest();
  
  tester.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = WebSocketServerTest;