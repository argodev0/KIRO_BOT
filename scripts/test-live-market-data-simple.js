#!/usr/bin/env node

/**
 * Simple Live Market Data Test
 * 
 * This script performs a basic test to verify that live market data
 * services are properly integrated and functioning.
 */

const axios = require('axios');
const WebSocket = require('ws');

// Configuration
const CONFIG = {
  server: {
    baseUrl: process.env.SERVER_URL || 'http://localhost:3000',
    wsUrl: process.env.WS_URL || 'ws://localhost:3000'
  },
  timeout: 15000 // 15 seconds
};

class SimpleLiveMarketDataTest {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      passed: false,
      tests: {},
      errors: []
    };
  }

  async run() {
    console.log('🚀 Starting Simple Live Market Data Test...\n');
    
    try {
      await this.testServerHealth();
      await this.testMarketDataEndpoints();
      await this.testWebSocketConnection();
      
      this.calculateResults();
      this.printResults();
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      this.results.errors.push(error.message);
    }
    
    return this.results;
  }

  async testServerHealth() {
    console.log('🏥 Testing server health...');
    
    try {
      const response = await axios.get(`${CONFIG.server.baseUrl}/health`, {
        timeout: CONFIG.timeout
      });
      
      if (response.status === 200) {
        const data = response.data;
        
        this.results.tests.serverHealth = {
          passed: true,
          status: data.status,
          paperTradingMode: data.paperTradingMode,
          allowRealTrades: data.allowRealTrades,
          safetyStatus: data.safetyStatus
        };
        
        console.log('✅ Server health check passed');
        
        // Validate safety
        if (!data.paperTradingMode || data.allowRealTrades) {
          this.results.errors.push('SAFETY: Paper trading mode not properly configured');
        }
        
      } else {
        throw new Error(`Health check failed with status: ${response.status}`);
      }
      
    } catch (error) {
      this.results.tests.serverHealth = {
        passed: false,
        error: error.message
      };
      console.error('❌ Server health check failed:', error.message);
    }
  }

  async testMarketDataEndpoints() {
    console.log('📊 Testing market data endpoints...');
    
    // Test market data status endpoint
    try {
      const response = await axios.get(`${CONFIG.server.baseUrl}/api/v1/market-data/status`, {
        timeout: CONFIG.timeout
      });
      
      if (response.status === 200) {
        const data = response.data;
        
        this.results.tests.marketDataStatus = {
          passed: true,
          status: data.status,
          dataFlowing: data.dataFlowing,
          healthScore: data.healthScore,
          exchanges: data.exchanges,
          availableSymbols: data.availableSymbols?.length || 0
        };
        
        console.log(`✅ Market data status: ${data.status} (${data.healthScore}% health)`);
        
        if (data.status !== 'healthy') {
          this.results.errors.push(`Market data status is ${data.status}`);
        }
        
      } else {
        throw new Error(`Market data status failed with status: ${response.status}`);
      }
      
    } catch (error) {
      this.results.tests.marketDataStatus = {
        passed: false,
        error: error.message
      };
      console.error('❌ Market data status check failed:', error.message);
    }

    // Test symbols endpoint
    try {
      const response = await axios.get(`${CONFIG.server.baseUrl}/api/v1/market-data/symbols`, {
        timeout: CONFIG.timeout
      });
      
      if (response.status === 200) {
        const data = response.data;
        
        this.results.tests.marketDataSymbols = {
          passed: true,
          symbolCount: data.count,
          symbols: data.symbols
        };
        
        console.log(`✅ Available symbols: ${data.count}`);
        
      } else {
        throw new Error(`Symbols endpoint failed with status: ${response.status}`);
      }
      
    } catch (error) {
      this.results.tests.marketDataSymbols = {
        passed: false,
        error: error.message
      };
      console.error('❌ Symbols endpoint check failed:', error.message);
    }
  }

  async testWebSocketConnection() {
    console.log('🔌 Testing WebSocket connection...');
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.results.tests.websocketConnection = {
          passed: false,
          error: 'WebSocket connection timeout'
        };
        console.error('❌ WebSocket connection timeout');
        resolve();
      }, CONFIG.timeout);
      
      try {
        const ws = new WebSocket(CONFIG.server.wsUrl);
        let messageReceived = false;
        
        ws.on('open', () => {
          console.log('🔗 WebSocket connected');
          
          // Send a test message
          ws.send(JSON.stringify({
            type: 'ping',
            timestamp: Date.now()
          }));
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            messageReceived = true;
            
            console.log('📨 WebSocket message received:', message.type || 'unknown');
            
            clearTimeout(timeout);
            ws.close();
            
            this.results.tests.websocketConnection = {
              passed: true,
              messageReceived: true,
              messageType: message.type
            };
            
            console.log('✅ WebSocket connection test passed');
            resolve();
            
          } catch (parseError) {
            console.warn('⚠️  Failed to parse WebSocket message');
          }
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          
          this.results.tests.websocketConnection = {
            passed: false,
            error: error.message
          };
          
          console.error('❌ WebSocket connection error:', error.message);
          resolve();
        });
        
        ws.on('close', () => {
          if (!messageReceived) {
            clearTimeout(timeout);
            
            this.results.tests.websocketConnection = {
              passed: false,
              error: 'WebSocket closed without receiving messages'
            };
            
            console.error('❌ WebSocket closed without receiving messages');
            resolve();
          }
        });
        
      } catch (error) {
        clearTimeout(timeout);
        
        this.results.tests.websocketConnection = {
          passed: false,
          error: error.message
        };
        
        console.error('❌ WebSocket connection failed:', error.message);
        resolve();
      }
    });
  }

  calculateResults() {
    const tests = Object.values(this.results.tests);
    const passedTests = tests.filter(test => test.passed);
    
    this.results.passed = passedTests.length === tests.length && this.results.errors.length === 0;
  }

  printResults() {
    console.log('\n📋 SIMPLE LIVE MARKET DATA TEST RESULTS');
    console.log('========================================');
    
    const tests = Object.entries(this.results.tests);
    const passedTests = tests.filter(([_, test]) => test.passed);
    
    console.log(`Overall: ${this.results.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Tests: ${passedTests.length}/${tests.length} passed`);
    console.log(`Errors: ${this.results.errors.length}`);
    
    console.log('\nTest Details:');
    for (const [name, test] of tests) {
      const status = test.passed ? '✅' : '❌';
      console.log(`  ${status} ${name}: ${test.passed ? 'PASSED' : 'FAILED'}`);
      
      if (!test.passed && test.error) {
        console.log(`      Error: ${test.error}`);
      }
    }
    
    if (this.results.errors.length > 0) {
      console.log('\nErrors:');
      this.results.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    }
    
    console.log(`\nTimestamp: ${this.results.timestamp}`);
  }
}

// Run test if called directly
if (require.main === module) {
  const test = new SimpleLiveMarketDataTest();
  
  test.run()
    .then((results) => {
      process.exit(results.passed ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { SimpleLiveMarketDataTest };