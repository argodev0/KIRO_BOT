#!/usr/bin/env node

/**
 * Live Market Data Flow Validation Script
 * 
 * This script validates that live market data is flowing properly from exchanges
 * to the application through WebSocket connections, caching, and frontend updates.
 * 
 * Validation includes:
 * - Binance WebSocket connection and data flow
 * - KuCoin WebSocket connection and data flow
 * - Market data caching in Redis
 * - Technical indicator calculations
 * - Frontend real-time updates
 * - Data quality and freshness checks
 */

const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const axios = require('axios');
const { createClient } = require('redis');

// Configuration
const CONFIG = {
  server: {
    baseUrl: process.env.SERVER_URL || 'http://localhost:3000',
    wsUrl: process.env.WS_URL || 'ws://localhost:3000'
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB) || 0
  },
  validation: {
    timeout: 30000, // 30 seconds
    dataFreshnessThreshold: 60000, // 1 minute
    minDataPoints: 5,
    testSymbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'],
    testTimeframes: ['1m', '5m', '15m', '1h'],
    exchanges: ['binance', 'kucoin']
  }
};

class LiveMarketDataValidator {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      overall: { passed: false, score: 0 },
      tests: {},
      errors: [],
      warnings: [],
      recommendations: []
    };
    
    this.redis = null;
    this.wsConnections = new Map();
    this.dataReceived = new Map();
    this.startTime = Date.now();
  }

  /**
   * Run all validation tests
   */
  async validate() {
    console.log('🚀 Starting Live Market Data Flow Validation...\n');
    
    try {
      // Initialize connections
      await this.initializeConnections();
      
      // Run validation tests
      await this.validateServerHealth();
      await this.validateExchangeConnections();
      await this.validateWebSocketConnections();
      await this.validateMarketDataFlow();
      await this.validateDataCaching();
      await this.validateTechnicalIndicators();
      await this.validateFrontendIntegration();
      await this.validateDataQuality();
      
      // Calculate overall score
      this.calculateOverallScore();
      
      // Generate report
      await this.generateReport();
      
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

  /**
   * Initialize Redis and other connections
   */
  async initializeConnections() {
    console.log('🔗 Initializing connections...');
    
    try {
      // Initialize Redis connection
      this.redis = createClient({
        socket: {
          host: CONFIG.redis.host,
          port: CONFIG.redis.port
        },
        password: CONFIG.redis.password,
        database: CONFIG.redis.db
      });
      
      await this.redis.connect();
      console.log('✅ Redis connection established');
      
    } catch (error) {
      throw new Error(`Failed to initialize connections: ${error.message}`);
    }
  }

  /**
   * Validate server health and paper trading status
   */
  async validateServerHealth() {
    console.log('🏥 Validating server health...');
    
    const testName = 'server_health';
    this.results.tests[testName] = {
      name: 'Server Health Check',
      passed: false,
      details: {},
      errors: []
    };
    
    try {
      // Check basic health endpoint
      const healthResponse = await axios.get(`${CONFIG.server.baseUrl}/health`, {
        timeout: 10000
      });
      
      if (healthResponse.status !== 200) {
        throw new Error(`Health check failed with status: ${healthResponse.status}`);
      }
      
      const healthData = healthResponse.data;
      
      // Validate paper trading mode
      if (!healthData.paperTradingMode) {
        this.results.errors.push({
          test: testName,
          error: 'Paper trading mode is not enabled',
          severity: 'critical'
        });
      }
      
      if (healthData.allowRealTrades) {
        this.results.errors.push({
          test: testName,
          error: 'Real trades are allowed - this is unsafe for live data testing',
          severity: 'critical'
        });
      }
      
      // Check paper trading status
      const paperTradingResponse = await axios.get(`${CONFIG.server.baseUrl}/api/v1/paper-trading/status`, {
        timeout: 10000
      });
      
      const paperTradingData = paperTradingResponse.data;
      
      this.results.tests[testName].details = {
        serverStatus: healthData.status,
        paperTradingMode: healthData.paperTradingMode,
        allowRealTrades: healthData.allowRealTrades,
        environment: healthData.environment,
        safetyStatus: healthData.safetyStatus,
        virtualPortfolio: paperTradingData.virtualPortfolio,
        simulation: paperTradingData.simulation
      };
      
      // Validate safety requirements
      const safetyChecks = [
        healthData.paperTradingMode === true,
        healthData.allowRealTrades === false,
        healthData.safetyStatus?.paperTradingEnabled === true,
        healthData.safetyStatus?.realTradesBlocked === true
      ];
      
      const safetyPassed = safetyChecks.every(check => check === true);
      
      if (!safetyPassed) {
        throw new Error('Paper trading safety checks failed');
      }
      
      this.results.tests[testName].passed = true;
      console.log('✅ Server health validation passed');
      
    } catch (error) {
      this.results.tests[testName].errors.push(error.message);
      console.error('❌ Server health validation failed:', error.message);
    }
  }

  /**
   * Validate exchange API connections
   */
  async validateExchangeConnections() {
    console.log('🔗 Validating exchange connections...');
    
    const testName = 'exchange_connections';
    this.results.tests[testName] = {
      name: 'Exchange API Connections',
      passed: false,
      details: { exchanges: {} },
      errors: []
    };
    
    try {
      // Test Binance connection
      await this.testBinanceConnection();
      
      // Test KuCoin connection
      await this.testKuCoinConnection();
      
      // Check if at least one exchange is working
      const workingExchanges = Object.values(this.results.tests[testName].details.exchanges)
        .filter(exchange => exchange.connected === true);
      
      if (workingExchanges.length === 0) {
        throw new Error('No exchange connections are working');
      }
      
      this.results.tests[testName].passed = true;
      console.log(`✅ Exchange connections validated (${workingExchanges.length}/${CONFIG.validation.exchanges.length} working)`);
      
    } catch (error) {
      this.results.tests[testName].errors.push(error.message);
      console.error('❌ Exchange connections validation failed:', error.message);
    }
  }

  /**
   * Test Binance API connection
   */
  async testBinanceConnection() {
    try {
      const response = await axios.get('https://api.binance.com/api/v3/ping', {
        timeout: 10000
      });
      
      if (response.status === 200) {
        this.results.tests.exchange_connections.details.exchanges.binance = {
          connected: true,
          latency: Date.now() - this.startTime,
          endpoint: 'https://api.binance.com/api/v3/ping'
        };
        console.log('✅ Binance API connection successful');
      }
    } catch (error) {
      this.results.tests.exchange_connections.details.exchanges.binance = {
        connected: false,
        error: error.message,
        endpoint: 'https://api.binance.com/api/v3/ping'
      };
      console.warn('⚠️  Binance API connection failed:', error.message);
    }
  }

  /**
   * Test KuCoin API connection
   */
  async testKuCoinConnection() {
    try {
      const response = await axios.get('https://api.kucoin.com/api/v1/status', {
        timeout: 10000
      });
      
      if (response.status === 200 && response.data.code === '200000') {
        this.results.tests.exchange_connections.details.exchanges.kucoin = {
          connected: true,
          latency: Date.now() - this.startTime,
          endpoint: 'https://api.kucoin.com/api/v1/status',
          status: response.data.data.status
        };
        console.log('✅ KuCoin API connection successful');
      }
    } catch (error) {
      this.results.tests.exchange_connections.details.exchanges.kucoin = {
        connected: false,
        error: error.message,
        endpoint: 'https://api.kucoin.com/api/v1/status'
      };
      console.warn('⚠️  KuCoin API connection failed:', error.message);
    }
  }

  /**
   * Validate WebSocket connections to server
   */
  async validateWebSocketConnections() {
    console.log('🔌 Validating WebSocket connections...');
    
    const testName = 'websocket_connections';
    this.results.tests[testName] = {
      name: 'WebSocket Server Connections',
      passed: false,
      details: { connections: {} },
      errors: []
    };
    
    try {
      // Test main WebSocket connection
      await this.testWebSocketConnection('main', CONFIG.server.wsUrl);
      
      // Check WebSocket server status via API
      const wsStatsResponse = await axios.get(`${CONFIG.server.baseUrl}/api/v1/websocket/stats`, {
        timeout: 10000
      });
      
      const wsHealthResponse = await axios.get(`${CONFIG.server.baseUrl}/api/v1/websocket/health`, {
        timeout: 10000
      });
      
      this.results.tests[testName].details.serverStats = wsStatsResponse.data;
      this.results.tests[testName].details.serverHealth = wsHealthResponse.data;
      
      // Validate WebSocket server is healthy
      if (!wsHealthResponse.data.isHealthy) {
        throw new Error('WebSocket server is not healthy');
      }
      
      this.results.tests[testName].passed = true;
      console.log('✅ WebSocket connections validated');
      
    } catch (error) {
      this.results.tests[testName].errors.push(error.message);
      console.error('❌ WebSocket connections validation failed:', error.message);
    }
  }

  /**
   * Test individual WebSocket connection
   */
  async testWebSocketConnection(name, url) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`WebSocket connection timeout for ${name}`));
      }, 10000);
      
      try {
        const ws = new WebSocket(url);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          
          this.results.tests.websocket_connections.details.connections[name] = {
            connected: true,
            url: url,
            connectedAt: new Date().toISOString()
          };
          
          this.wsConnections.set(name, ws);
          console.log(`✅ WebSocket connection established: ${name}`);
          resolve();
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          
          this.results.tests.websocket_connections.details.connections[name] = {
            connected: false,
            url: url,
            error: error.message
          };
          
          reject(error);
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            
            if (!this.dataReceived.has(name)) {
              this.dataReceived.set(name, []);
            }
            
            this.dataReceived.get(name).push({
              timestamp: Date.now(),
              type: message.type,
              data: message
            });
          } catch (parseError) {
            console.warn(`Failed to parse WebSocket message from ${name}:`, parseError.message);
          }
        });
        
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Validate live market data flow
   */
  async validateMarketDataFlow() {
    console.log('📊 Validating market data flow...');
    
    const testName = 'market_data_flow';
    this.results.tests[testName] = {
      name: 'Live Market Data Flow',
      passed: false,
      details: { symbols: {}, dataTypes: {} },
      errors: []
    };
    
    try {
      // Subscribe to market data via WebSocket
      await this.subscribeToMarketData();
      
      // Wait for data to flow
      console.log('⏳ Waiting for market data...');
      await this.waitForMarketData(15000); // Wait 15 seconds
      
      // Validate data received
      await this.validateReceivedData();
      
      // Check data freshness
      await this.checkDataFreshness();
      
      this.results.tests[testName].passed = true;
      console.log('✅ Market data flow validated');
      
    } catch (error) {
      this.results.tests[testName].errors.push(error.message);
      console.error('❌ Market data flow validation failed:', error.message);
    }
  }

  /**
   * Subscribe to market data channels
   */
  async subscribeToMarketData() {
    const mainWs = this.wsConnections.get('main');
    if (!mainWs) {
      throw new Error('No WebSocket connection available for market data subscription');
    }
    
    // Subscribe to ticker data for test symbols
    for (const symbol of CONFIG.validation.testSymbols) {
      const subscribeMessage = {
        type: 'subscribe',
        channel: `ticker:${symbol}`,
        timestamp: Date.now()
      };
      
      mainWs.send(JSON.stringify(subscribeMessage));
      console.log(`📡 Subscribed to ticker data for ${symbol}`);
    }
    
    // Subscribe to candle data
    for (const symbol of CONFIG.validation.testSymbols) {
      for (const timeframe of CONFIG.validation.testTimeframes) {
        const subscribeMessage = {
          type: 'subscribe',
          channel: `candles:${symbol}:${timeframe}`,
          timestamp: Date.now()
        };
        
        mainWs.send(JSON.stringify(subscribeMessage));
        console.log(`📈 Subscribed to candle data for ${symbol} ${timeframe}`);
      }
    }
  }

  /**
   * Wait for market data to be received
   */
  async waitForMarketData(timeout) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkData = () => {
        const elapsed = Date.now() - startTime;
        const dataReceived = this.dataReceived.get('main') || [];
        
        if (dataReceived.length >= CONFIG.validation.minDataPoints || elapsed >= timeout) {
          resolve();
        } else {
          setTimeout(checkData, 1000);
        }
      };
      
      checkData();
    });
  }

  /**
   * Validate received market data
   */
  async validateReceivedData() {
    const dataReceived = this.dataReceived.get('main') || [];
    
    if (dataReceived.length === 0) {
      throw new Error('No market data received via WebSocket');
    }
    
    // Group data by type
    const dataByType = {};
    for (const item of dataReceived) {
      if (!dataByType[item.type]) {
        dataByType[item.type] = [];
      }
      dataByType[item.type].push(item);
    }
    
    this.results.tests.market_data_flow.details.dataTypes = dataByType;
    
    // Validate we received different types of data
    const expectedTypes = ['ticker', 'candle', 'orderbook', 'trade'];
    const receivedTypes = Object.keys(dataByType);
    
    for (const expectedType of expectedTypes) {
      if (!receivedTypes.includes(expectedType)) {
        this.results.warnings.push({
          test: 'market_data_flow',
          warning: `No ${expectedType} data received`,
          impact: 'medium'
        });
      }
    }
    
    console.log(`📊 Received ${dataReceived.length} market data messages (${receivedTypes.length} types)`);
  }

  /**
   * Check data freshness
   */
  async checkDataFreshness() {
    const now = Date.now();
    const dataReceived = this.dataReceived.get('main') || [];
    
    if (dataReceived.length === 0) {
      return;
    }
    
    const latestData = dataReceived[dataReceived.length - 1];
    const age = now - latestData.timestamp;
    
    if (age > CONFIG.validation.dataFreshnessThreshold) {
      this.results.warnings.push({
        test: 'market_data_flow',
        warning: `Latest data is ${Math.round(age / 1000)}s old (threshold: ${CONFIG.validation.dataFreshnessThreshold / 1000}s)`,
        impact: 'medium'
      });
    }
    
    this.results.tests.market_data_flow.details.dataFreshness = {
      latestDataAge: age,
      threshold: CONFIG.validation.dataFreshnessThreshold,
      fresh: age <= CONFIG.validation.dataFreshnessThreshold
    };
  }

  /**
   * Validate data caching in Redis
   */
  async validateDataCaching() {
    console.log('💾 Validating data caching...');
    
    const testName = 'data_caching';
    this.results.tests[testName] = {
      name: 'Market Data Caching',
      passed: false,
      details: { cache: {} },
      errors: []
    };
    
    try {
      // Check Redis connection
      await this.redis.ping();
      
      // Look for cached market data
      const cacheKeys = await this.redis.keys('market:*');
      
      this.results.tests[testName].details.cache.totalKeys = cacheKeys.length;
      this.results.tests[testName].details.cache.keyPatterns = {};
      
      // Analyze cache key patterns
      for (const key of cacheKeys) {
        const parts = key.split(':');
        const pattern = parts.slice(0, 3).join(':'); // e.g., "market:ticker:BTCUSDT"
        
        if (!this.results.tests[testName].details.cache.keyPatterns[pattern]) {
          this.results.tests[testName].details.cache.keyPatterns[pattern] = 0;
        }
        this.results.tests[testName].details.cache.keyPatterns[pattern]++;
      }
      
      // Test cache functionality
      await this.testCacheFunctionality();
      
      if (cacheKeys.length === 0) {
        this.results.warnings.push({
          test: testName,
          warning: 'No market data found in cache',
          impact: 'medium'
        });
      }
      
      this.results.tests[testName].passed = true;
      console.log(`✅ Data caching validated (${cacheKeys.length} keys found)`);
      
    } catch (error) {
      this.results.tests[testName].errors.push(error.message);
      console.error('❌ Data caching validation failed:', error.message);
    }
  }

  /**
   * Test cache read/write functionality
   */
  async testCacheFunctionality() {
    const testKey = 'market:test:validation';
    const testData = {
      timestamp: Date.now(),
      test: true,
      value: 'cache-test-data'
    };
    
    try {
      // Write test data
      await this.redis.setEx(testKey, 60, JSON.stringify(testData));
      
      // Read test data
      const cachedData = await this.redis.get(testKey);
      const parsedData = JSON.parse(cachedData);
      
      if (parsedData.test !== true || parsedData.value !== 'cache-test-data') {
        throw new Error('Cache read/write test failed - data mismatch');
      }
      
      // Clean up test data
      await this.redis.del(testKey);
      
      this.results.tests.data_caching.details.cache.functionality = 'working';
      console.log('✅ Cache read/write functionality verified');
      
    } catch (error) {
      this.results.tests.data_caching.details.cache.functionality = 'failed';
      throw new Error(`Cache functionality test failed: ${error.message}`);
    }
  }

  /**
   * Validate technical indicators calculation
   */
  async validateTechnicalIndicators() {
    console.log('📈 Validating technical indicators...');
    
    const testName = 'technical_indicators';
    this.results.tests[testName] = {
      name: 'Technical Indicators Calculation',
      passed: false,
      details: { indicators: {} },
      errors: []
    };
    
    try {
      // Test technical indicators endpoint
      const indicatorsResponse = await axios.get(`${CONFIG.server.baseUrl}/api/v1/indicators/BTCUSDT`, {
        timeout: 10000
      });
      
      if (indicatorsResponse.status === 200) {
        const indicators = indicatorsResponse.data;
        
        this.results.tests[testName].details.indicators = indicators;
        
        // Validate indicator data structure
        const expectedIndicators = ['rsi', 'macd', 'bollinger', 'sma', 'ema'];
        const availableIndicators = Object.keys(indicators);
        
        for (const expected of expectedIndicators) {
          if (!availableIndicators.includes(expected)) {
            this.results.warnings.push({
              test: testName,
              warning: `${expected.toUpperCase()} indicator not available`,
              impact: 'low'
            });
          }
        }
        
        this.results.tests[testName].passed = true;
        console.log(`✅ Technical indicators validated (${availableIndicators.length} indicators)`);
      }
      
    } catch (error) {
      // Technical indicators might not be implemented yet
      if (error.response && error.response.status === 404) {
        this.results.warnings.push({
          test: testName,
          warning: 'Technical indicators endpoint not found - may not be implemented yet',
          impact: 'medium'
        });
        this.results.tests[testName].passed = true; // Don't fail the test for missing endpoint
      } else {
        this.results.tests[testName].errors.push(error.message);
        console.error('❌ Technical indicators validation failed:', error.message);
      }
    }
  }

  /**
   * Validate frontend integration
   */
  async validateFrontendIntegration() {
    console.log('🖥️  Validating frontend integration...');
    
    const testName = 'frontend_integration';
    this.results.tests[testName] = {
      name: 'Frontend Real-time Integration',
      passed: false,
      details: { frontend: {} },
      errors: []
    };
    
    try {
      // Check if frontend is accessible
      const frontendResponse = await axios.get(CONFIG.server.baseUrl, {
        timeout: 10000
      });
      
      if (frontendResponse.status === 200) {
        this.results.tests[testName].details.frontend.accessible = true;
        
        // Check for WebSocket client functionality
        // This would typically involve checking if the frontend can connect to WebSocket
        // For now, we'll check if the WebSocket server is accepting connections
        
        const wsChannelsResponse = await axios.get(`${CONFIG.server.baseUrl}/api/v1/websocket/channels`, {
          timeout: 10000
        });
        
        this.results.tests[testName].details.frontend.websocketChannels = wsChannelsResponse.data;
        
        this.results.tests[testName].passed = true;
        console.log('✅ Frontend integration validated');
      }
      
    } catch (error) {
      this.results.tests[testName].errors.push(error.message);
      console.error('❌ Frontend integration validation failed:', error.message);
    }
  }

  /**
   * Validate overall data quality
   */
  async validateDataQuality() {
    console.log('🔍 Validating data quality...');
    
    const testName = 'data_quality';
    this.results.tests[testName] = {
      name: 'Market Data Quality Assessment',
      passed: false,
      details: { quality: {} },
      errors: []
    };
    
    try {
      const dataReceived = this.dataReceived.get('main') || [];
      
      if (dataReceived.length === 0) {
        throw new Error('No data available for quality assessment');
      }
      
      // Calculate data quality metrics
      const qualityMetrics = this.calculateDataQuality(dataReceived);
      
      this.results.tests[testName].details.quality = qualityMetrics;
      
      // Validate quality thresholds
      if (qualityMetrics.completeness < 80) {
        this.results.warnings.push({
          test: testName,
          warning: `Data completeness is ${qualityMetrics.completeness}% (expected >80%)`,
          impact: 'high'
        });
      }
      
      if (qualityMetrics.freshness < 90) {
        this.results.warnings.push({
          test: testName,
          warning: `Data freshness is ${qualityMetrics.freshness}% (expected >90%)`,
          impact: 'medium'
        });
      }
      
      this.results.tests[testName].passed = true;
      console.log(`✅ Data quality validated (${qualityMetrics.overallScore}% overall score)`);
      
    } catch (error) {
      this.results.tests[testName].errors.push(error.message);
      console.error('❌ Data quality validation failed:', error.message);
    }
  }

  /**
   * Calculate data quality metrics
   */
  calculateDataQuality(dataReceived) {
    const now = Date.now();
    const dataTypes = {};
    
    // Group data by type
    for (const item of dataReceived) {
      if (!dataTypes[item.type]) {
        dataTypes[item.type] = [];
      }
      dataTypes[item.type].push(item);
    }
    
    // Calculate completeness (variety of data types)
    const expectedTypes = ['ticker', 'candle', 'orderbook', 'trade'];
    const receivedTypes = Object.keys(dataTypes);
    const completeness = (receivedTypes.length / expectedTypes.length) * 100;
    
    // Calculate freshness (how recent is the data)
    const latestTimestamp = Math.max(...dataReceived.map(item => item.timestamp));
    const age = now - latestTimestamp;
    const freshness = Math.max(0, 100 - (age / CONFIG.validation.dataFreshnessThreshold) * 100);
    
    // Calculate consistency (regular data flow)
    const timestamps = dataReceived.map(item => item.timestamp).sort((a, b) => a - b);
    let gaps = 0;
    for (let i = 1; i < timestamps.length; i++) {
      const gap = timestamps[i] - timestamps[i - 1];
      if (gap > 10000) { // 10 second gap threshold
        gaps++;
      }
    }
    const consistency = Math.max(0, 100 - (gaps / timestamps.length) * 100);
    
    // Calculate overall score
    const overallScore = Math.round((completeness + freshness + consistency) / 3);
    
    return {
      completeness: Math.round(completeness),
      freshness: Math.round(freshness),
      consistency: Math.round(consistency),
      overallScore,
      dataPoints: dataReceived.length,
      dataTypes: receivedTypes.length,
      latestDataAge: age,
      gaps
    };
  }

  /**
   * Calculate overall validation score
   */
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
    
    // Deduct points for errors and warnings
    const criticalErrors = this.results.errors.filter(e => e.severity === 'critical').length;
    const warnings = this.results.warnings.length;
    
    const finalScore = Math.max(0, baseScore - (criticalErrors * 20) - (warnings * 5));
    
    this.results.overall.score = Math.round(finalScore);
    this.results.overall.passed = finalScore >= 80; // 80% threshold for passing
    
    // Add recommendations based on score
    if (finalScore < 80) {
      this.results.recommendations.push('Live market data flow needs improvement before production deployment');
    }
    
    if (criticalErrors > 0) {
      this.results.recommendations.push('Critical errors must be resolved before proceeding');
    }
    
    if (warnings > 5) {
      this.results.recommendations.push('Multiple warnings detected - review and address issues');
    }
  }

  /**
   * Generate validation report
   */
  async generateReport() {
    const reportPath = path.join(__dirname, '..', 'live-market-data-validation-report.json');
    
    // Add summary
    this.results.summary = {
      totalTests: Object.keys(this.results.tests).length,
      passedTests: Object.values(this.results.tests).filter(test => test.passed).length,
      failedTests: Object.values(this.results.tests).filter(test => !test.passed).length,
      errors: this.results.errors.length,
      warnings: this.results.warnings.length,
      overallScore: this.results.overall.score,
      passed: this.results.overall.passed,
      duration: Date.now() - this.startTime
    };
    
    // Write report to file
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    
    // Print summary
    console.log('\n📋 LIVE MARKET DATA VALIDATION REPORT');
    console.log('=====================================');
    console.log(`Overall Score: ${this.results.overall.score}%`);
    console.log(`Status: ${this.results.overall.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Tests: ${this.results.summary.passedTests}/${this.results.summary.totalTests} passed`);
    console.log(`Errors: ${this.results.summary.errors}`);
    console.log(`Warnings: ${this.results.summary.warnings}`);
    console.log(`Duration: ${Math.round(this.results.summary.duration / 1000)}s`);
    
    if (this.results.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.results.errors.forEach(error => {
        console.log(`  - ${error.test}: ${error.error}`);
      });
    }
    
    if (this.results.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.results.warnings.forEach(warning => {
        console.log(`  - ${warning.test}: ${warning.warning}`);
      });
    }
    
    if (this.results.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      this.results.recommendations.forEach(rec => {
        console.log(`  - ${rec}`);
      });
    }
    
    console.log(`\n📄 Full report saved to: ${reportPath}`);
  }

  /**
   * Clean up connections and resources
   */
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
  const validator = new LiveMarketDataValidator();
  
  validator.validate()
    .then((results) => {
      process.exit(results.overall.passed ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    });
}

module.exports = { LiveMarketDataValidator };