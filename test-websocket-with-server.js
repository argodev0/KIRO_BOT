#!/usr/bin/env node

/**
 * WebSocket Stability Test with Server Startup
 * Starts the server and tests WebSocket connection stability
 */

const { spawn } = require('child_process');
const WebSocket = require('ws');
const path = require('path');

class WebSocketServerTester {
  constructor() {
    this.serverProcess = null;
    this.serverReady = false;
    this.testResults = {
      serverStartup: false,
      basicConnection: false,
      messageExchange: false,
      multipleConnections: false,
      connectionStability: false
    };
  }

  async runTests() {
    console.log('🚀 Starting WebSocket Server and Stability Tests...\n');

    try {
      // Start the server
      await this.startServer();
      
      // Wait for server to be ready
      await this.waitForServer();
      
      // Run WebSocket tests
      await this.testBasicConnection();
      await this.testMessageExchange();
      await this.testMultipleConnections();
      await this.testConnectionStability();
      
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    } finally {
      await this.stopServer();
    }
  }

  async startServer() {
    console.log('🔧 Starting server...');
    
    return new Promise((resolve, reject) => {
      // Start the server process
      this.serverProcess = spawn('npm', ['run', 'dev'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'development' }
      });

      let serverOutput = '';
      
      this.serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        serverOutput += output;
        
        // Check if server is ready
        if (output.includes('server started') || output.includes('listening on') || output.includes('Enhanced WebSocket server ready')) {
          console.log('✅ Server started successfully');
          this.testResults.serverStartup = true;
          this.serverReady = true;
          resolve();
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        const error = data.toString();
        console.log('Server stderr:', error);
        
        // Don't reject on warnings, only on critical errors
        if (error.includes('EADDRINUSE') || error.includes('Cannot start server')) {
          reject(new Error(`Server startup failed: ${error}`));
        }
      });

      this.serverProcess.on('error', (error) => {
        console.error('Server process error:', error);
        reject(error);
      });

      this.serverProcess.on('exit', (code) => {
        if (code !== 0 && !this.serverReady) {
          reject(new Error(`Server exited with code ${code}`));
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!this.serverReady) {
          reject(new Error('Server startup timeout'));
        }
      }, 30000);
    });
  }

  async waitForServer() {
    console.log('⏳ Waiting for server to be ready...');
    
    // Additional wait to ensure WebSocket server is fully initialized
    await this.sleep(3000);
    
    // Try to connect to health endpoint
    try {
      const response = await fetch('http://localhost:3000/health');
      if (response.ok) {
        console.log('✅ Server health check passed');
      }
    } catch (error) {
      console.log('⚠️  Health check failed, but continuing with WebSocket tests');
    }
  }

  async testBasicConnection() {
    console.log('🔌 Testing basic WebSocket connection...');
    
    try {
      const ws = await this.createConnection('ws://localhost:3000');
      
      console.log('✅ Basic WebSocket connection successful');
      this.testResults.basicConnection = true;
      
      ws.close();
      
    } catch (error) {
      console.error('❌ Basic connection failed:', error.message);
    }
  }

  async testMessageExchange() {
    console.log('💬 Testing message exchange...');
    
    try {
      const ws = await this.createConnection('ws://localhost:3000');
      
      let messageReceived = false;
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          console.log('📨 Received message:', message.type);
          messageReceived = true;
        } catch (e) {
          console.log('📨 Received raw message:', data.toString());
          messageReceived = true;
        }
      });

      // Send a test message
      ws.send(JSON.stringify({
        type: 'test',
        data: 'Hello WebSocket!',
        timestamp: Date.now()
      }));

      // Wait for response
      await this.sleep(2000);
      
      if (messageReceived) {
        console.log('✅ Message exchange successful');
        this.testResults.messageExchange = true;
      } else {
        console.log('⚠️  No message received, but connection is stable');
      }
      
      ws.close();
      
    } catch (error) {
      console.error('❌ Message exchange failed:', error.message);
    }
  }

  async testMultipleConnections() {
    console.log('🔗 Testing multiple connections...');
    
    try {
      const connections = [];
      const connectionCount = 5;
      
      // Create multiple connections
      for (let i = 0; i < connectionCount; i++) {
        try {
          const ws = await this.createConnection('ws://localhost:3000');
          connections.push(ws);
          console.log(`   Connection ${i + 1} established`);
        } catch (error) {
          console.log(`   Connection ${i + 1} failed: ${error.message}`);
        }
      }
      
      console.log(`✅ Successfully created ${connections.length}/${connectionCount} connections`);
      
      if (connections.length >= connectionCount * 0.8) {
        this.testResults.multipleConnections = true;
      }
      
      // Close all connections
      connections.forEach((ws, index) => {
        ws.close();
        console.log(`   Connection ${index + 1} closed`);
      });
      
    } catch (error) {
      console.error('❌ Multiple connections test failed:', error.message);
    }
  }

  async testConnectionStability() {
    console.log('🔄 Testing connection stability...');
    
    try {
      const ws = await this.createConnection('ws://localhost:3000');
      let connectionStable = true;
      let messagesExchanged = 0;
      
      ws.on('message', () => {
        messagesExchanged++;
      });

      ws.on('error', (error) => {
        console.log('Connection error:', error.message);
        connectionStable = false;
      });

      ws.on('close', (code, reason) => {
        if (code !== 1000) {
          console.log(`Connection closed unexpectedly: ${code} ${reason}`);
          connectionStable = false;
        }
      });

      // Send periodic messages to test stability
      for (let i = 0; i < 10; i++) {
        ws.send(JSON.stringify({
          type: 'stability_test',
          sequence: i,
          timestamp: Date.now()
        }));
        
        await this.sleep(500);
      }
      
      // Wait for final responses
      await this.sleep(2000);
      
      if (connectionStable) {
        console.log('✅ Connection remained stable during test');
        console.log(`📊 Messages exchanged: ${messagesExchanged}`);
        this.testResults.connectionStability = true;
      } else {
        console.log('❌ Connection stability issues detected');
      }
      
      ws.close();
      
    } catch (error) {
      console.error('❌ Connection stability test failed:', error.message);
    }
  }

  async createConnection(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const timeout = setTimeout(() => {
        ws.terminate();
        reject(new Error('Connection timeout'));
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        resolve(ws);
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async stopServer() {
    if (this.serverProcess) {
      console.log('🛑 Stopping server...');
      
      // Send SIGTERM for graceful shutdown
      this.serverProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await this.sleep(3000);
      
      // Force kill if still running
      if (!this.serverProcess.killed) {
        this.serverProcess.kill('SIGKILL');
      }
      
      console.log('✅ Server stopped');
    }
  }

  generateReport() {
    const passedTests = Object.values(this.testResults).filter(result => result).length;
    const totalTests = Object.keys(this.testResults).length;
    const successRate = (passedTests / totalTests) * 100;

    console.log('\n📊 WebSocket Stability Test Report');
    console.log('=====================================');
    console.log(`✅ Tests passed: ${passedTests}/${totalTests} (${successRate.toFixed(1)}%)`);
    console.log('');

    console.log('📋 Test Results:');
    Object.entries(this.testResults).forEach(([test, passed]) => {
      const status = passed ? '✅' : '❌';
      const testName = test.replace(/([A-Z])/g, ' $1').toLowerCase();
      console.log(`   ${status} ${testName}`);
    });

    console.log('\n🎯 WebSocket Assessment:');
    if (successRate >= 80) {
      console.log('   ✅ WebSocket connections are STABLE');
    } else if (successRate >= 60) {
      console.log('   ⚠️  WebSocket connections have MODERATE stability issues');
    } else {
      console.log('   ❌ WebSocket connections are UNSTABLE');
    }

    if (!this.testResults.basicConnection) {
      console.log('\n💡 Recommendations:');
      console.log('   - Check if WebSocket server is properly initialized');
      console.log('   - Verify WebSocket endpoint configuration');
      console.log('   - Check for port conflicts or firewall issues');
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the tests
if (require.main === module) {
  const tester = new WebSocketServerTester();
  
  tester.runTests().then(() => {
    console.log('\n🏁 WebSocket testing completed');
    process.exit(0);
  }).catch((error) => {
    console.error('\n💥 Testing failed:', error);
    process.exit(1);
  });
}

module.exports = WebSocketServerTester;