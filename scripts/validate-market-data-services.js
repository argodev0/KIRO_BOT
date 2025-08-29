#!/usr/bin/env node

/**
 * Market Data Services Validation
 * 
 * This script validates the individual market data services without
 * requiring the full server to be running. It tests:
 * - Binance WebSocket connectivity
 * - KuCoin WebSocket connectivity  
 * - Redis connectivity
 * - Data flow and processing
 */

const WebSocket = require('ws');
const axios = require('axios');
const { createClient } = require('redis');

// Configuration
const CONFIG = {
  exchanges: {
    binance: {
      wsUrl: 'wss://stream.binance.com:9443/ws',
      apiUrl: 'https://api.binance.com/api/v3',
      testSymbol: 'BTCUSDT'
    },
    kucoin: {
      apiUrl: 'https://api.kucoin.com',
      testSymbol: 'BTC-USDT'
    }
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB) || 0
  },
  timeout: 15000, // 15 seconds
  dataWaitTime: 10000 // 10 seconds to wait for data
};

class MarketDataServicesValidator {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      overall: { passed: false, score: 0 },
      tests: {},
      errors: [],
      warnings: []
    };
    
    this.redis = null;
    this.wsConnections = new Map();
    this.dataReceived = new Map();
  }

  async validate() {
    console.log('🚀 Starting Market Data Services Validation...\n');
    
    try {
      await this.testExchangeAPIs();
      await this.testRedisConnectivity();
      await this.testBinanceWebSocket();
      await this.testKuCoinWebSocket();
      await this.testDataFlow();
      
      this.calculateOverallScore();
      this.generateReport();
      
    } catch (error) {
      this.results.errors.push({
        test: 'validation_setup',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      console.error('❌ Validation setup failed:', error.message);
    } finally {
      await this.cleanup();
    }
    
    return this.results;
  }

  async testExchangeAPIs() {
    console.log('🔗 Testing exchange API connectivity...');
    
    // Test Binance API
    const binanceTest = 'binance_api';
    this.results.tests[binanceTest] = {
      name: 'Binance API Connectivity',
      passed: false,
      details: {}
    };
    
    try {
      const response = await axios.get(`${CONFIG.exchanges.binance.apiUrl}/ping`, {
        timeout: CONFIG.timeout
      });
      
      if (response.status === 200) {
        this.results.tests[binanceTest].passed = true;
        this.results.tests[binanceTest].details = {
          status: response.status,
          latency: Date.now() - Date.now() // Simplified
        };
        console.log('✅ Binance API connectivity verified');
      }
    } catch (error) {
      this.results.tests[binanceTest].details.error = error.message;
      console.error('❌ Binance API connectivity failed:', error.message);
    }
    
    // Test KuCoin API
    const kucoinTest = 'kucoin_api';
    this.results.tests[kucoinTest] = {
      name: 'KuCoin API Connectivity',
      passed: false,
      details: {}
    };
    
    try {
      const response = await axios.get(`${CONFIG.exchanges.kucoin.apiUrl}/api/v1/status`, {
        timeout: CONFIG.timeout
      });
      
      if (response.status === 200 && response.data.code === '200000') {
        this.results.tests[kucoinTest].passed = true;
        this.results.tests[kucoinTest].details = {
          status: response.status,
          serviceStatus: response.data.data.status
        };
        console.log('✅ KuCoin API connectivity verified');
      }
    } catch (error) {
      this.results.tests[kucoinTest].details.error = error.message;
      console.error('❌ KuCoin API connectivity failed:', error.message);
    }
  }

  async testRedisConnectivity() {
    console.log('💾 Testing Redis connectivity...');
    
    const testName = 'redis_connectivity';
    this.results.tests[testName] = {
      name: 'Redis Connectivity',
      passed: false,
      details: {}
    };
    
    try {
      this.redis = createClient({
        socket: {
          host: CONFIG.redis.host,
          port: CONFIG.redis.port
        },
        password: CONFIG.redis.password,
        database: CONFIG.redis.db
      });
      
      await this.redis.connect();
      
      // Test basic operations
      const testKey = 'market:test:validation';
      const testValue = JSON.stringify({
        timestamp: Date.now(),
        test: true
      });
      
      await this.redis.setEx(testKey, 60, testValue);
      const retrieved = await this.redis.get(testKey);
      
      if (retrieved === testValue) {
        this.results.tests[testName].passed = true;
        this.results.tests[testName].details = {
          connected: true,
          readWrite: true,
          host: CONFIG.redis.host,
          port: CONFIG.redis.port
        };
        console.log('✅ Redis connectivity verified');
        
        // Clean up test key
        await this.redis.del(testKey);
      } else {
        throw new Error('Redis read/write test failed');
      }
      
    } catch (error) {
      this.results.tests[testName].details.error = error.message;
      console.error('❌ Redis connectivity failed:', error.message);
    }
  }

  async testBinanceWebSocket() {
    console.log('🟡 Testing Binance WebSocket connectivity...');
    
    const testName = 'binance_websocket';
    this.results.tests[testName] = {
      name: 'Binance WebSocket Connectivity',
      passed: false,
      details: {}
    };
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.results.tests[testName].details.error = 'WebSocket connection timeout';
        console.error('❌ Binance WebSocket connection timeout');
        resolve();
      }, CONFIG.timeout);
      
      try {
        const symbol = CONFIG.exchanges.binance.testSymbol.toLowerCase();
        const wsUrl = `${CONFIG.exchanges.binance.wsUrl}/${symbol}@ticker`;
        
        const ws = new WebSocket(wsUrl);
        
        ws.on('open', () => {
          console.log('🔗 Binance WebSocket connected');
          this.results.tests[testName].details.connected = true;
        });
        
        ws.on('message', (data) => {
          try {
            const parsed = JSON.parse(data.toString());
            
            if (parsed.s && parsed.c) { // Symbol and close price
              clearTimeout(timeout);
              
              this.results.tests[testName].passed = true;
              this.results.tests[testName].details = {
                connected: true,
                dataReceived: true,
                symbol: parsed.s,
                price: parsed.c,
                timestamp: parsed.E
              };
              
              if (!this.dataReceived.has('binance')) {
                this.dataReceived.set('binance', []);
              }
              this.dataReceived.get('binance').push({
                type: 'ticker',
                symbol: parsed.s,
                price: parsed.c,
                timestamp: Date.now()
              });
              
              console.log(`✅ Binance WebSocket data received: ${parsed.s} @ ${parsed.c}`);
              ws.close();
              resolve();
            }
          } catch (parseError) {
            console.warn('⚠️  Failed to parse Binance WebSocket message');
          }
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          this.results.tests[testName].details.error = error.message;
          console.error('❌ Binance WebSocket error:', error.message);
          resolve();
        });
        
        ws.on('close', () => {
          if (!this.results.tests[testName].passed) {
            clearTimeout(timeout);
            this.results.tests[testName].details.error = 'WebSocket closed without receiving data';
            console.error('❌ Binance WebSocket closed without receiving data');
            resolve();
          }
        });
        
        this.wsConnections.set('binance', ws);
        
      } catch (error) {
        clearTimeout(timeout);
        this.results.tests[testName].details.error = error.message;
        console.error('❌ Binance WebSocket test failed:', error.message);
        resolve();
      }
    });
  }

  async testKuCoinWebSocket() {
    console.log('🟢 Testing KuCoin WebSocket connectivity...');
    
    const testName = 'kucoin_websocket';
    this.results.tests[testName] = {
      name: 'KuCoin WebSocket Connectivity',
      passed: false,
      details: {}
    };
    
    try {
      // First, get WebSocket token from KuCoin API
      const tokenResponse = await axios.post(`${CONFIG.exchanges.kucoin.apiUrl}/api/v1/bullet-public`);
      
      if (tokenResponse.data.code !== '200000') {
        throw new Error('Failed to get KuCoin WebSocket token');
      }
      
      const tokenData = tokenResponse.data.data;
      const wsUrl = `${tokenData.instanceServers[0].endpoint}?token=${tokenData.token}&[connectId=${Date.now()}]`;
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.results.tests[testName].details.error = 'WebSocket connection timeout';
          console.error('❌ KuCoin WebSocket connection timeout');
          resolve();
        }, CONFIG.timeout);
        
        try {
          const ws = new WebSocket(wsUrl);
          
          ws.on('open', () => {
            console.log('🔗 KuCoin WebSocket connected');
            
            // Subscribe to ticker data
            const subscribeMsg = {
              id: Date.now(),
              type: 'subscribe',
              topic: `/market/ticker:${CONFIG.exchanges.kucoin.testSymbol}`,
              privateChannel: false,
              response: true
            };
            
            ws.send(JSON.stringify(subscribeMsg));
            this.results.tests[testName].details.connected = true;
          });
          
          ws.on('message', (data) => {
            try {
              const parsed = JSON.parse(data.toString());
              
              if (parsed.type === 'message' && parsed.data && parsed.data.price) {
                clearTimeout(timeout);
                
                this.results.tests[testName].passed = true;
                this.results.tests[testName].details = {
                  connected: true,
                  dataReceived: true,
                  symbol: parsed.subject,
                  price: parsed.data.price,
                  timestamp: parsed.data.time
                };
                
                if (!this.dataReceived.has('kucoin')) {
                  this.dataReceived.set('kucoin', []);
                }
                this.dataReceived.get('kucoin').push({
                  type: 'ticker',
                  symbol: parsed.subject,
                  price: parsed.data.price,
                  timestamp: Date.now()
                });
                
                console.log(`✅ KuCoin WebSocket data received: ${parsed.subject} @ ${parsed.data.price}`);
                ws.close();
                resolve();
              } else if (parsed.type === 'welcome') {
                console.log('🤝 KuCoin WebSocket welcome received');
              } else if (parsed.type === 'ack') {
                console.log('✅ KuCoin subscription confirmed');
              }
            } catch (parseError) {
              console.warn('⚠️  Failed to parse KuCoin WebSocket message');
            }
          });
          
          ws.on('error', (error) => {
            clearTimeout(timeout);
            this.results.tests[testName].details.error = error.message;
            console.error('❌ KuCoin WebSocket error:', error.message);
            resolve();
          });
          
          ws.on('close', () => {
            if (!this.results.tests[testName].passed) {
              clearTimeout(timeout);
              this.results.tests[testName].details.error = 'WebSocket closed without receiving data';
              console.error('❌ KuCoin WebSocket closed without receiving data');
              resolve();
            }
          });
          
          this.wsConnections.set('kucoin', ws);
          
        } catch (error) {
          clearTimeout(timeout);
          this.results.tests[testName].details.error = error.message;
          console.error('❌ KuCoin WebSocket test failed:', error.message);
          resolve();
        }
      });
      
    } catch (error) {
      this.results.tests[testName].details.error = error.message;
      console.error('❌ KuCoin WebSocket test failed:', error.message);
    }
  }

  async testDataFlow() {
    console.log('📊 Testing data flow and processing...');
    
    const testName = 'data_flow';
    this.results.tests[testName] = {
      name: 'Market Data Flow',
      passed: false,
      details: {}
    };
    
    try {
      const binanceData = this.dataReceived.get('binance') || [];
      const kucoinData = this.dataReceived.get('kucoin') || [];
      const totalData = binanceData.length + kucoinData.length;
      
      if (totalData > 0) {
        this.results.tests[testName].passed = true;
        this.results.tests[testName].details = {
          binanceMessages: binanceData.length,
          kucoinMessages: kucoinData.length,
          totalMessages: totalData,
          dataTypes: [...new Set([...binanceData, ...kucoinData].map(d => d.type))],
          symbols: [...new Set([...binanceData, ...kucoinData].map(d => d.symbol))]
        };
        
        console.log(`✅ Data flow verified: ${totalData} messages received`);
        
        // Test Redis caching if available
        if (this.redis && totalData > 0) {
          await this.testDataCaching(binanceData, kucoinData);
        } else if (totalData > 0) {
          // Still run caching test to show it's skipped
          await this.testDataCaching(binanceData, kucoinData);
        }
        
      } else {
        this.results.tests[testName].details.error = 'No market data received from any exchange';
        console.error('❌ No market data received from any exchange');
      }
      
    } catch (error) {
      this.results.tests[testName].details.error = error.message;
      console.error('❌ Data flow test failed:', error.message);
    }
  }

  async testDataCaching(binanceData, kucoinData) {
    console.log('💾 Testing data caching...');
    
    const testName = 'data_caching';
    this.results.tests[testName] = {
      name: 'Data Caching',
      passed: false,
      details: {}
    };
    
    // Skip caching test if Redis is not available
    if (!this.redis) {
      this.results.tests[testName].details.error = 'Redis not available';
      console.log('⚠️  Skipping data caching test - Redis not available');
      return;
    }
    
    try {
      let cachedCount = 0;
      
      // Cache some sample data
      for (const data of [...binanceData, ...kucoinData].slice(0, 5)) {
        const key = `market:test:${data.symbol}:${data.type}`;
        const value = JSON.stringify(data);
        
        await this.redis.setEx(key, 300, value); // 5 minutes TTL
        cachedCount++;
      }
      
      // Verify cached data can be retrieved
      const testKey = `market:test:${binanceData[0]?.symbol || 'BTCUSDT'}:ticker`;
      const cached = await this.redis.get(testKey);
      
      if (cached) {
        const parsedCached = JSON.parse(cached);
        
        this.results.tests[testName].passed = true;
        this.results.tests[testName].details = {
          cached: true,
          cachedItems: cachedCount,
          retrievalTest: 'passed',
          sampleData: parsedCached
        };
        
        console.log(`✅ Data caching verified: ${cachedCount} items cached`);
        
        // Clean up test cache keys
        const keys = await this.redis.keys('market:test:*');
        if (keys.length > 0) {
          await this.redis.del(keys);
        }
        
      } else {
        throw new Error('Failed to retrieve cached data');
      }
      
    } catch (error) {
      this.results.tests[testName].details.error = error.message;
      console.error('❌ Data caching test failed:', error.message);
    }
  }

  calculateOverallScore() {
    const tests = Object.values(this.results.tests);
    const passedTests = tests.filter(test => test.passed);
    const totalTests = tests.length;
    
    if (totalTests === 0) {
      this.results.overall.score = 0;
      this.results.overall.passed = false;
      return;
    }
    
    const baseScore = (passedTests.length / totalTests) * 100;
    const criticalErrors = this.results.errors.filter(e => e.severity === 'critical').length;
    const warnings = this.results.warnings.length;
    
    const finalScore = Math.max(0, baseScore - (criticalErrors * 20) - (warnings * 5));
    
    this.results.overall.score = Math.round(finalScore);
    this.results.overall.passed = finalScore >= 70; // 70% threshold for passing
  }

  generateReport() {
    console.log('\n📋 MARKET DATA SERVICES VALIDATION REPORT');
    console.log('==========================================');
    
    const tests = Object.entries(this.results.tests);
    const passedTests = tests.filter(([_, test]) => test.passed);
    
    console.log(`Overall Score: ${this.results.overall.score}%`);
    console.log(`Status: ${this.results.overall.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Tests: ${passedTests.length}/${tests.length} passed`);
    console.log(`Errors: ${this.results.errors.length}`);
    console.log(`Warnings: ${this.results.warnings.length}`);
    
    console.log('\nTest Details:');
    for (const [name, test] of tests) {
      const status = test.passed ? '✅' : '❌';
      console.log(`  ${status} ${test.name}: ${test.passed ? 'PASSED' : 'FAILED'}`);
      
      if (test.details.error) {
        console.log(`      Error: ${test.details.error}`);
      } else if (test.passed && test.details) {
        // Show some key details for passed tests
        if (test.details.symbol && test.details.price) {
          console.log(`      Data: ${test.details.symbol} @ ${test.details.price}`);
        } else if (test.details.totalMessages) {
          console.log(`      Messages: ${test.details.totalMessages}`);
        } else if (test.details.connected) {
          console.log(`      Status: Connected`);
        }
      }
    }
    
    if (this.results.errors.length > 0) {
      console.log('\nErrors:');
      this.results.errors.forEach(error => {
        console.log(`  - ${error.test}: ${error.error}`);
      });
    }
    
    if (this.results.warnings.length > 0) {
      console.log('\nWarnings:');
      this.results.warnings.forEach(warning => {
        console.log(`  - ${warning.test}: ${warning.warning}`);
      });
    }
    
    console.log(`\nTimestamp: ${this.results.timestamp}`);
    
    // Summary for live market data status
    const dataFlowing = this.results.tests.data_flow?.passed || false;
    const exchangesWorking = [
      this.results.tests.binance_websocket?.passed,
      this.results.tests.kucoin_websocket?.passed
    ].filter(Boolean).length;
    
    console.log('\n🎯 LIVE MARKET DATA STATUS:');
    console.log(`   Data Flowing: ${dataFlowing ? '✅ YES' : '❌ NO'}`);
    console.log(`   Working Exchanges: ${exchangesWorking}/2`);
    console.log(`   Redis Available: ${this.results.tests.redis_connectivity?.passed ? '✅ YES' : '❌ NO'}`);
    
    if (dataFlowing && exchangesWorking > 0) {
      console.log('\n✅ Live market data is flowing properly!');
    } else {
      console.log('\n❌ Live market data flow needs attention.');
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');
    
    try {
      // Close WebSocket connections
      for (const [name, ws] of this.wsConnections) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }
      
      // Close Redis connection
      if (this.redis) {
        await this.redis.disconnect();
      }
      
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup error:', error.message);
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new MarketDataServicesValidator();
  
  validator.validate()
    .then((results) => {
      process.exit(results.overall.passed ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    });
}

module.exports = { MarketDataServicesValidator };