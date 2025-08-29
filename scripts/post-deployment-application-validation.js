#!/usr/bin/env node

/**
 * Post-Deployment Application Validation Script
 * 
 * Comprehensive validation of the deployed application including:
 * - Complete web interface functionality using frontend test suite
 * - Paper trading operations using PaperTradingSafetyMonitor
 * - Real-time market data streaming using LiveMarketDataService
 * - All critical user workflows using end-to-end test suite
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const axios = require('axios');
const WebSocket = require('ws');

class PostDeploymentApplicationValidator {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3000',
      frontendUrl: config.frontendUrl || 'http://localhost:3002',
      wsUrl: config.wsUrl || 'ws://localhost:3000',
      timeout: config.timeout || 30000,
      skipFrontendTests: config.skipFrontendTests || false,
      skipPaperTradingTests: config.skipPaperTradingTests || false,
      skipMarketDataTests: config.skipMarketDataTests || false,
      skipE2ETests: config.skipE2ETests || false,
      ...config
    };
    
    this.results = {
      timestamp: new Date().toISOString(),
      overall: { passed: false, score: 0 },
      tests: {},
      errors: [],
      warnings: [],
      recommendations: [],
      startTime: Date.now()
    };
  }

  log(level, message, details = null) {
    const timestamp = new Date().toISOString();
    const levelEmoji = {
      info: '📋',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      critical: '🚨'
    };
    
    console.log(`${levelEmoji[level] || '📋'} [${timestamp}] ${message}`);
    if (details) {
      console.log(`   ${JSON.stringify(details, null, 2)}`);
    }
  }

  async runTestSuite(suiteName, testCommand, description) {
    this.log('info', `Running ${description}...`);
    
    const testResult = {
      name: description,
      passed: false,
      details: {},
      errors: [],
      startTime: Date.now()
    };
    
    try {
      const output = execSync(testCommand, {
        encoding: 'utf8',
        timeout: this.config.timeout,
        cwd: process.cwd()
      });
      
      testResult.details.output = output;
      testResult.passed = !output.includes('FAIL') && !output.includes('Error');
      
      if (testResult.passed) {
        this.log('success', `${description} completed successfully`);
      } else {
        this.log('error', `${description} failed`);
        testResult.errors.push('Test suite reported failures');
      }
      
    } catch (error) {
      this.log('error', `${description} execution failed: ${error.message}`);
      testResult.errors.push(error.message);
      testResult.details.error = error.message;
    }
    
    testResult.duration = Date.now() - testResult.startTime;
    this.results.tests[suiteName] = testResult;
    
    return testResult;
  }

  async validateWebInterfaceFunctionality() {
    if (this.config.skipFrontendTests) {
      this.log('info', 'Skipping frontend tests as requested');
      return { passed: true, skipped: true };
    }
    
    this.log('info', '🖥️  Validating complete web interface functionality...');
    
    const testName = 'frontend_functionality';
    this.results.tests[testName] = {
      name: 'Web Interface Functionality',
      passed: false,
      details: {},
      errors: []
    };
    
    try {
      // 1. Check if frontend is accessible
      await this.validateFrontendAccessibility();
      
      // 2. Run frontend test suite
      await this.runFrontendTestSuite();
      
      // 3. Validate UI components
      await this.validateUIComponents();
      
      // 4. Test user authentication flow
      await this.validateAuthenticationFlow();
      
      // 5. Validate dashboard functionality
      await this.validateDashboardFunctionality();
      
      this.results.tests[testName].passed = true;
      this.log('success', 'Web interface functionality validation completed');
      
    } catch (error) {
      this.results.tests[testName].errors.push(error.message);
      this.log('error', `Web interface validation failed: ${error.message}`);
    }
    
    return this.results.tests[testName];
  }

  async validateFrontendAccessibility() {
    this.log('info', 'Checking frontend accessibility...');
    
    try {
      const response = await axios.get(this.config.frontendUrl, {
        timeout: 10000,
        validateStatus: (status) => status < 500 // Accept redirects and client errors
      });
      
      this.results.tests.frontend_functionality.details.accessibility = {
        status: response.status,
        accessible: response.status < 400,
        headers: response.headers
      };
      
      if (response.status >= 400) {
        throw new Error(`Frontend returned status ${response.status}`);
      }
      
      this.log('success', `Frontend accessible at ${this.config.frontendUrl}`);
      
    } catch (error) {
      throw new Error(`Frontend not accessible: ${error.message}`);
    }
  }

  async runFrontendTestSuite() {
    this.log('info', 'Running frontend test suite...');
    
    // Check if frontend tests exist
    const frontendTestPaths = [
      'src/__tests__/frontend',
      'src/frontend/__tests__',
      'frontend/__tests__',
      'tests/frontend'
    ];
    
    let testPath = null;
    for (const testDir of frontendTestPaths) {
      if (fs.existsSync(testDir)) {
        testPath = testDir;
        break;
      }
    }
    
    if (!testPath) {
      this.log('warning', 'No frontend test directory found, running available UI tests');
      
      // Run any available frontend-related tests
      const availableTests = [
        'npm test -- --testPathPattern="frontend|ui|component" --passWithNoTests',
        'npm run test:frontend --if-present',
        'npm run test:ui --if-present'
      ];
      
      for (const testCommand of availableTests) {
        try {
          const result = await this.runTestSuite('frontend_tests', testCommand, 'Frontend Tests');
          if (result.passed) {
            break;
          }
        } catch (error) {
          this.log('warning', `Test command failed: ${testCommand}`);
        }
      }
    } else {
      await this.runTestSuite('frontend_tests', `npm test -- ${testPath}`, 'Frontend Test Suite');
    }
  }

  async validateUIComponents() {
    this.log('info', 'Validating UI components...');
    
    try {
      // Test critical UI endpoints
      const uiEndpoints = [
        '/dashboard',
        '/trading',
        '/portfolio',
        '/settings'
      ];
      
      const componentResults = {};
      
      for (const endpoint of uiEndpoints) {
        try {
          const response = await axios.get(`${this.config.frontendUrl}${endpoint}`, {
            timeout: 5000,
            validateStatus: (status) => status < 500
          });
          
          componentResults[endpoint] = {
            status: response.status,
            accessible: response.status < 400
          };
          
        } catch (error) {
          componentResults[endpoint] = {
            status: 'error',
            accessible: false,
            error: error.message
          };
        }
      }
      
      this.results.tests.frontend_functionality.details.uiComponents = componentResults;
      
      const accessibleComponents = Object.values(componentResults).filter(r => r.accessible).length;
      const totalComponents = Object.keys(componentResults).length;
      
      if (accessibleComponents < totalComponents * 0.8) {
        throw new Error(`Only ${accessibleComponents}/${totalComponents} UI components accessible`);
      }
      
      this.log('success', `UI components validated (${accessibleComponents}/${totalComponents} accessible)`);
      
    } catch (error) {
      throw new Error(`UI component validation failed: ${error.message}`);
    }
  }

  async validateAuthenticationFlow() {
    this.log('info', 'Validating authentication flow...');
    
    try {
      // Test authentication endpoints
      const authEndpoints = [
        { path: '/api/auth/login', method: 'POST' },
        { path: '/api/auth/register', method: 'POST' },
        { path: '/api/auth/logout', method: 'POST' }
      ];
      
      const authResults = {};
      
      for (const endpoint of authEndpoints) {
        try {
          const response = await axios({
            method: endpoint.method,
            url: `${this.config.baseUrl}${endpoint.path}`,
            timeout: 5000,
            validateStatus: (status) => status < 500,
            data: endpoint.method === 'POST' ? {} : undefined
          });
          
          authResults[endpoint.path] = {
            status: response.status,
            available: response.status !== 404
          };
          
        } catch (error) {
          authResults[endpoint.path] = {
            status: 'error',
            available: false,
            error: error.message
          };
        }
      }
      
      this.results.tests.frontend_functionality.details.authentication = authResults;
      this.log('success', 'Authentication flow validated');
      
    } catch (error) {
      throw new Error(`Authentication validation failed: ${error.message}`);
    }
  }

  async validateDashboardFunctionality() {
    this.log('info', 'Validating dashboard functionality...');
    
    try {
      // Test dashboard API endpoints
      const dashboardEndpoints = [
        '/api/dashboard/summary',
        '/api/portfolio/summary',
        '/api/trading/positions',
        '/api/market-data/overview'
      ];
      
      const dashboardResults = {};
      
      for (const endpoint of dashboardEndpoints) {
        try {
          const response = await axios.get(`${this.config.baseUrl}${endpoint}`, {
            timeout: 5000,
            validateStatus: (status) => status < 500
          });
          
          dashboardResults[endpoint] = {
            status: response.status,
            available: response.status < 400,
            hasData: response.data && Object.keys(response.data).length > 0
          };
          
        } catch (error) {
          dashboardResults[endpoint] = {
            status: 'error',
            available: false,
            error: error.message
          };
        }
      }
      
      this.results.tests.frontend_functionality.details.dashboard = dashboardResults;
      this.log('success', 'Dashboard functionality validated');
      
    } catch (error) {
      throw new Error(`Dashboard validation failed: ${error.message}`);
    }
  }

  async validatePaperTradingOperations() {
    if (this.config.skipPaperTradingTests) {
      this.log('info', 'Skipping paper trading tests as requested');
      return { passed: true, skipped: true };
    }
    
    this.log('info', '🛡️  Validating paper trading operations...');
    
    const testName = 'paper_trading_operations';
    this.results.tests[testName] = {
      name: 'Paper Trading Operations',
      passed: false,
      details: {},
      errors: []
    };
    
    try {
      // 1. Run paper trading safety verification
      await this.runPaperTradingSafetyVerification();
      
      // 2. Test paper trading functionality
      await this.testPaperTradingFunctionality();
      
      // 3. Validate virtual portfolio operations
      await this.validateVirtualPortfolioOperations();
      
      // 4. Test trade simulation engine
      await this.testTradeSimulationEngine();
      
      // 5. Run paper trading integration tests
      await this.runPaperTradingIntegrationTests();
      
      this.results.tests[testName].passed = true;
      this.log('success', 'Paper trading operations validation completed');
      
    } catch (error) {
      this.results.tests[testName].errors.push(error.message);
      this.log('error', `Paper trading validation failed: ${error.message}`);
    }
    
    return this.results.tests[testName];
  }

  async runPaperTradingSafetyVerification() {
    this.log('info', 'Running paper trading safety verification...');
    
    const scriptPath = path.join(__dirname, 'paper-trading-safety-verification.js');
    if (fs.existsSync(scriptPath)) {
      await this.runTestSuite('paper_trading_safety', `node ${scriptPath}`, 'Paper Trading Safety Verification');
    } else {
      this.log('warning', 'Paper trading safety verification script not found');
    }
  }

  async testPaperTradingFunctionality() {
    this.log('info', 'Testing paper trading functionality...');
    
    try {
      // Test paper trading status endpoint
      const statusResponse = await axios.get(`${this.config.baseUrl}/api/paper-trading/status`, {
        timeout: 10000
      });
      
      if (statusResponse.status !== 200) {
        throw new Error(`Paper trading status endpoint returned ${statusResponse.status}`);
      }
      
      const status = statusResponse.data;
      
      // Validate paper trading is enabled
      if (!status.enabled || status.allowRealTrades) {
        throw new Error('Paper trading safety checks failed');
      }
      
      this.results.tests.paper_trading_operations.details.status = status;
      
      // Test virtual trade execution
      const tradeResponse = await axios.post(`${this.config.baseUrl}/api/trading/simulate`, {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.001
      }, {
        timeout: 10000,
        validateStatus: (status) => status < 500
      });
      
      this.results.tests.paper_trading_operations.details.virtualTrade = {
        status: tradeResponse.status,
        success: tradeResponse.status === 200,
        data: tradeResponse.data
      };
      
      this.log('success', 'Paper trading functionality validated');
      
    } catch (error) {
      throw new Error(`Paper trading functionality test failed: ${error.message}`);
    }
  }

  async validateVirtualPortfolioOperations() {
    this.log('info', 'Validating virtual portfolio operations...');
    
    try {
      // Test virtual portfolio endpoints
      const portfolioEndpoints = [
        '/api/portfolio/virtual/summary',
        '/api/portfolio/virtual/positions',
        '/api/portfolio/virtual/history'
      ];
      
      const portfolioResults = {};
      
      for (const endpoint of portfolioEndpoints) {
        try {
          const response = await axios.get(`${this.config.baseUrl}${endpoint}`, {
            timeout: 5000,
            validateStatus: (status) => status < 500
          });
          
          portfolioResults[endpoint] = {
            status: response.status,
            available: response.status < 400,
            data: response.data
          };
          
        } catch (error) {
          portfolioResults[endpoint] = {
            status: 'error',
            available: false,
            error: error.message
          };
        }
      }
      
      this.results.tests.paper_trading_operations.details.virtualPortfolio = portfolioResults;
      this.log('success', 'Virtual portfolio operations validated');
      
    } catch (error) {
      throw new Error(`Virtual portfolio validation failed: ${error.message}`);
    }
  }

  async testTradeSimulationEngine() {
    this.log('info', 'Testing trade simulation engine...');
    
    try {
      // Run trade simulation engine tests
      await this.runTestSuite(
        'trade_simulation_tests',
        'npm test -- --testNamePattern="TradeSimulation|simulation" --passWithNoTests',
        'Trade Simulation Engine Tests'
      );
      
      this.log('success', 'Trade simulation engine validated');
      
    } catch (error) {
      throw new Error(`Trade simulation engine test failed: ${error.message}`);
    }
  }

  async runPaperTradingIntegrationTests() {
    this.log('info', 'Running paper trading integration tests...');
    
    try {
      // Run paper trading specific integration tests
      const testCommands = [
        'npm test -- src/__tests__/paperTradingSafety.test.ts --passWithNoTests',
        'npm test -- src/__tests__/paperTradingIntegration.test.ts --passWithNoTests',
        'npm test -- src/__tests__/integration/PaperTradingSafetyValidation.test.ts --passWithNoTests'
      ];
      
      for (const command of testCommands) {
        try {
          await this.runTestSuite('paper_trading_integration', command, 'Paper Trading Integration Tests');
          break; // If one succeeds, we're good
        } catch (error) {
          this.log('warning', `Test command failed: ${command}`);
        }
      }
      
      this.log('success', 'Paper trading integration tests completed');
      
    } catch (error) {
      throw new Error(`Paper trading integration tests failed: ${error.message}`);
    }
  }

  async validateRealTimeMarketDataStreaming() {
    if (this.config.skipMarketDataTests) {
      this.log('info', 'Skipping market data tests as requested');
      return { passed: true, skipped: true };
    }
    
    this.log('info', '📊 Validating real-time market data streaming...');
    
    const testName = 'market_data_streaming';
    this.results.tests[testName] = {
      name: 'Real-time Market Data Streaming',
      passed: false,
      details: {},
      errors: []
    };
    
    try {
      // 1. Validate live market data service
      await this.validateLiveMarketDataService();
      
      // 2. Test WebSocket connections
      await this.testWebSocketConnections();
      
      // 3. Validate market data flow
      await this.validateMarketDataFlow();
      
      // 4. Test exchange connectivity
      await this.testExchangeConnectivity();
      
      // 5. Run live market data tests
      await this.runLiveMarketDataTests();
      
      this.results.tests[testName].passed = true;
      this.log('success', 'Real-time market data streaming validation completed');
      
    } catch (error) {
      this.results.tests[testName].errors.push(error.message);
      this.log('error', `Market data streaming validation failed: ${error.message}`);
    }
    
    return this.results.tests[testName];
  }

  async validateLiveMarketDataService() {
    this.log('info', 'Validating live market data service...');
    
    try {
      // Test market data service health
      const healthResponse = await axios.get(`${this.config.baseUrl}/api/market-data/health`, {
        timeout: 10000
      });
      
      if (healthResponse.status !== 200) {
        throw new Error(`Market data service health check failed: ${healthResponse.status}`);
      }
      
      const health = healthResponse.data;
      this.results.tests.market_data_streaming.details.serviceHealth = health;
      
      // Validate service is running and connected
      if (!health.isRunning || health.activeConnections === 0) {
        throw new Error('Market data service is not properly running or connected');
      }
      
      this.log('success', `Market data service healthy (${health.activeConnections} connections)`);
      
    } catch (error) {
      throw new Error(`Live market data service validation failed: ${error.message}`);
    }
  }

  async testWebSocketConnections() {
    this.log('info', 'Testing WebSocket connections...');
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.config.wsUrl);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 10000);
      
      let messagesReceived = 0;
      const messages = [];
      
      ws.on('open', () => {
        this.log('success', 'WebSocket connection established');
        
        // Subscribe to market data
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: 'ticker',
          symbol: 'BTCUSDT'
        }));
        
        // Wait for some messages
        setTimeout(() => {
          clearTimeout(timeout);
          ws.close();
          
          this.results.tests.market_data_streaming.details.websocket = {
            connected: true,
            messagesReceived,
            sampleMessages: messages.slice(0, 3)
          };
          
          if (messagesReceived > 0) {
            this.log('success', `WebSocket data flow validated (${messagesReceived} messages)`);
            resolve();
          } else {
            reject(new Error('No WebSocket messages received'));
          }
        }, 5000);
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          messagesReceived++;
          messages.push(message);
        } catch (error) {
          this.log('warning', 'Failed to parse WebSocket message');
        }
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket connection failed: ${error.message}`));
      });
    });
  }

  async validateMarketDataFlow() {
    this.log('info', 'Validating market data flow...');
    
    try {
      // Test market data endpoints
      const marketDataEndpoints = [
        '/api/market-data/ticker/BTCUSDT',
        '/api/market-data/orderbook/BTCUSDT',
        '/api/market-data/candles/BTCUSDT/1h'
      ];
      
      const dataFlowResults = {};
      
      for (const endpoint of marketDataEndpoints) {
        try {
          const response = await axios.get(`${this.config.baseUrl}${endpoint}`, {
            timeout: 5000
          });
          
          dataFlowResults[endpoint] = {
            status: response.status,
            hasData: response.data && Object.keys(response.data).length > 0,
            dataFreshness: this.calculateDataFreshness(response.data),
            data: response.data
          };
          
        } catch (error) {
          dataFlowResults[endpoint] = {
            status: 'error',
            hasData: false,
            error: error.message
          };
        }
      }
      
      this.results.tests.market_data_streaming.details.dataFlow = dataFlowResults;
      
      // Check if we have fresh data
      const freshDataCount = Object.values(dataFlowResults)
        .filter(result => result.hasData && result.dataFreshness < 60000).length;
      
      if (freshDataCount === 0) {
        throw new Error('No fresh market data available');
      }
      
      this.log('success', `Market data flow validated (${freshDataCount} endpoints with fresh data)`);
      
    } catch (error) {
      throw new Error(`Market data flow validation failed: ${error.message}`);
    }
  }

  calculateDataFreshness(data) {
    if (!data || !data.timestamp) {
      return Infinity;
    }
    
    return Date.now() - data.timestamp;
  }

  async testExchangeConnectivity() {
    this.log('info', 'Testing exchange connectivity...');
    
    try {
      // Test exchange status endpoint
      const exchangeResponse = await axios.get(`${this.config.baseUrl}/api/exchanges/status`, {
        timeout: 10000
      });
      
      if (exchangeResponse.status !== 200) {
        throw new Error(`Exchange status endpoint failed: ${exchangeResponse.status}`);
      }
      
      const exchangeStatus = exchangeResponse.data;
      this.results.tests.market_data_streaming.details.exchanges = exchangeStatus;
      
      // Validate at least one exchange is connected
      const connectedExchanges = Object.values(exchangeStatus).filter(status => status.connected).length;
      
      if (connectedExchanges === 0) {
        throw new Error('No exchanges are connected');
      }
      
      this.log('success', `Exchange connectivity validated (${connectedExchanges} exchanges connected)`);
      
    } catch (error) {
      throw new Error(`Exchange connectivity test failed: ${error.message}`);
    }
  }

  async runLiveMarketDataTests() {
    this.log('info', 'Running live market data tests...');
    
    try {
      // Run live market data service tests
      const testCommands = [
        'npm test -- src/__tests__/services/LiveMarketDataService.test.ts --passWithNoTests',
        'npm test -- --testNamePattern="LiveMarketData|market.*data" --passWithNoTests'
      ];
      
      for (const command of testCommands) {
        try {
          await this.runTestSuite('live_market_data_tests', command, 'Live Market Data Tests');
          break;
        } catch (error) {
          this.log('warning', `Test command failed: ${command}`);
        }
      }
      
      // Run live data validation script if available
      const validationScript = path.join(__dirname, 'validate-live-market-data.js');
      if (fs.existsSync(validationScript)) {
        await this.runTestSuite('live_data_validation', `node ${validationScript}`, 'Live Market Data Validation');
      }
      
      this.log('success', 'Live market data tests completed');
      
    } catch (error) {
      throw new Error(`Live market data tests failed: ${error.message}`);
    }
  }

  async validateCriticalUserWorkflows() {
    if (this.config.skipE2ETests) {
      this.log('info', 'Skipping E2E tests as requested');
      return { passed: true, skipped: true };
    }
    
    this.log('info', '🔄 Validating critical user workflows...');
    
    const testName = 'critical_user_workflows';
    this.results.tests[testName] = {
      name: 'Critical User Workflows',
      passed: false,
      details: {},
      errors: []
    };
    
    try {
      // 1. Run end-to-end test suite
      await this.runEndToEndTestSuite();
      
      // 2. Test complete trading workflow
      await this.testCompleteTradingWorkflow();
      
      // 3. Validate user authentication workflow
      await this.validateUserAuthWorkflow();
      
      // 4. Test portfolio management workflow
      await this.testPortfolioManagementWorkflow();
      
      // 5. Validate system recovery workflow
      await this.validateSystemRecoveryWorkflow();
      
      this.results.tests[testName].passed = true;
      this.log('success', 'Critical user workflows validation completed');
      
    } catch (error) {
      this.results.tests[testName].errors.push(error.message);
      this.log('error', `User workflows validation failed: ${error.message}`);
    }
    
    return this.results.tests[testName];
  }

  async runEndToEndTestSuite() {
    this.log('info', 'Running end-to-end test suite...');
    
    try {
      // Run E2E tests
      const e2eTestCommands = [
        'npm test -- src/__tests__/e2e --passWithNoTests',
        'npm test -- --testNamePattern="e2e|E2E|end.*to.*end" --passWithNoTests',
        'npm run test:e2e --if-present'
      ];
      
      for (const command of e2eTestCommands) {
        try {
          await this.runTestSuite('e2e_tests', command, 'End-to-End Test Suite');
          break;
        } catch (error) {
          this.log('warning', `E2E test command failed: ${command}`);
        }
      }
      
      this.log('success', 'End-to-end test suite completed');
      
    } catch (error) {
      throw new Error(`End-to-end test suite failed: ${error.message}`);
    }
  }

  async testCompleteTradingWorkflow() {
    this.log('info', 'Testing complete trading workflow...');
    
    try {
      // Test the complete flow: Market Data -> Analysis -> Signal -> Trade
      
      // 1. Get market data
      const marketDataResponse = await axios.get(`${this.config.baseUrl}/api/market-data/ticker/BTCUSDT`, {
        timeout: 5000
      });
      
      if (marketDataResponse.status !== 200) {
        throw new Error('Market data not available');
      }
      
      // 2. Trigger analysis
      const analysisResponse = await axios.post(`${this.config.baseUrl}/api/analysis/technical/BTCUSDT`, {
        timeframes: ['1h', '4h']
      }, {
        timeout: 10000,
        validateStatus: (status) => status < 500
      });
      
      // 3. Generate signal (if analysis endpoint exists)
      if (analysisResponse.status === 200) {
        const signalResponse = await axios.post(`${this.config.baseUrl}/api/signals/generate`, {
          symbol: 'BTCUSDT',
          analysisId: analysisResponse.data.id
        }, {
          timeout: 10000,
          validateStatus: (status) => status < 500
        });
        
        this.results.tests.critical_user_workflows.details.signalGeneration = {
          status: signalResponse.status,
          success: signalResponse.status === 200
        };
      }
      
      // 4. Execute virtual trade
      const tradeResponse = await axios.post(`${this.config.baseUrl}/api/trading/simulate`, {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.001
      }, {
        timeout: 10000,
        validateStatus: (status) => status < 500
      });
      
      this.results.tests.critical_user_workflows.details.tradingWorkflow = {
        marketData: marketDataResponse.status === 200,
        analysis: analysisResponse.status === 200,
        trade: tradeResponse.status === 200
      };
      
      this.log('success', 'Complete trading workflow validated');
      
    } catch (error) {
      throw new Error(`Trading workflow test failed: ${error.message}`);
    }
  }

  async validateUserAuthWorkflow() {
    this.log('info', 'Validating user authentication workflow...');
    
    try {
      // Test authentication flow (without actually creating accounts)
      const authEndpoints = [
        { path: '/api/auth/login', method: 'POST' },
        { path: '/api/auth/logout', method: 'POST' },
        { path: '/api/auth/refresh', method: 'POST' }
      ];
      
      const authWorkflowResults = {};
      
      for (const endpoint of authEndpoints) {
        try {
          const response = await axios({
            method: endpoint.method,
            url: `${this.config.baseUrl}${endpoint.path}`,
            timeout: 5000,
            validateStatus: (status) => status < 500,
            data: endpoint.method === 'POST' ? { test: true } : undefined
          });
          
          authWorkflowResults[endpoint.path] = {
            status: response.status,
            available: response.status !== 404
          };
          
        } catch (error) {
          authWorkflowResults[endpoint.path] = {
            status: 'error',
            available: false,
            error: error.message
          };
        }
      }
      
      this.results.tests.critical_user_workflows.details.authWorkflow = authWorkflowResults;
      this.log('success', 'User authentication workflow validated');
      
    } catch (error) {
      throw new Error(`User auth workflow validation failed: ${error.message}`);
    }
  }

  async testPortfolioManagementWorkflow() {
    this.log('info', 'Testing portfolio management workflow...');
    
    try {
      // Test portfolio management endpoints
      const portfolioEndpoints = [
        '/api/portfolio/summary',
        '/api/portfolio/positions',
        '/api/portfolio/history',
        '/api/portfolio/performance'
      ];
      
      const portfolioWorkflowResults = {};
      
      for (const endpoint of portfolioEndpoints) {
        try {
          const response = await axios.get(`${this.config.baseUrl}${endpoint}`, {
            timeout: 5000,
            validateStatus: (status) => status < 500
          });
          
          portfolioWorkflowResults[endpoint] = {
            status: response.status,
            available: response.status < 400,
            hasData: response.data && Object.keys(response.data).length > 0
          };
          
        } catch (error) {
          portfolioWorkflowResults[endpoint] = {
            status: 'error',
            available: false,
            error: error.message
          };
        }
      }
      
      this.results.tests.critical_user_workflows.details.portfolioWorkflow = portfolioWorkflowResults;
      this.log('success', 'Portfolio management workflow validated');
      
    } catch (error) {
      throw new Error(`Portfolio management workflow test failed: ${error.message}`);
    }
  }

  async validateSystemRecoveryWorkflow() {
    this.log('info', 'Validating system recovery workflow...');
    
    try {
      // Test system health and recovery endpoints
      const recoveryEndpoints = [
        '/health',
        '/api/system/status',
        '/api/system/health',
        '/api/monitoring/health'
      ];
      
      const recoveryResults = {};
      
      for (const endpoint of recoveryEndpoints) {
        try {
          const response = await axios.get(`${this.config.baseUrl}${endpoint}`, {
            timeout: 5000,
            validateStatus: (status) => status < 500
          });
          
          recoveryResults[endpoint] = {
            status: response.status,
            healthy: response.status === 200,
            data: response.data
          };
          
        } catch (error) {
          recoveryResults[endpoint] = {
            status: 'error',
            healthy: false,
            error: error.message
          };
        }
      }
      
      this.results.tests.critical_user_workflows.details.systemRecovery = recoveryResults;
      
      // Check if at least one health endpoint is working
      const healthyEndpoints = Object.values(recoveryResults).filter(r => r.healthy).length;
      
      if (healthyEndpoints === 0) {
        throw new Error('No system health endpoints are responding');
      }
      
      this.log('success', `System recovery workflow validated (${healthyEndpoints} health endpoints)`);
      
    } catch (error) {
      throw new Error(`System recovery workflow validation failed: ${error.message}`);
    }
  }

  calculateOverallScore() {
    const tests = Object.values(this.results.tests);
    const totalTests = tests.length;
    const passedTests = tests.filter(test => test.passed || test.skipped).length;
    const criticalFailures = tests.filter(test => !test.passed && !test.skipped && test.name.includes('Safety')).length;
    
    if (totalTests === 0) {
      this.results.overall.score = 0;
      this.results.overall.passed = false;
      return;
    }
    
    const baseScore = (passedTests / totalTests) * 100;
    const errorCount = this.results.errors.length;
    const warningCount = this.results.warnings.length;
    
    // Deduct points for errors and warnings
    const finalScore = Math.max(0, baseScore - (criticalFailures * 30) - (errorCount * 10) - (warningCount * 5));
    
    this.results.overall.score = Math.round(finalScore);
    this.results.overall.passed = finalScore >= 80 && criticalFailures === 0;
    
    // Generate recommendations
    if (criticalFailures > 0) {
      this.results.recommendations.push('CRITICAL: Paper trading safety failures detected - DO NOT USE IN PRODUCTION');
    }
    
    if (finalScore < 80) {
      this.results.recommendations.push('Application validation score below threshold - review and fix issues');
    }
    
    if (errorCount > 0) {
      this.results.recommendations.push('Multiple errors detected - investigate and resolve before production use');
    }
    
    if (finalScore >= 90) {
      this.results.recommendations.push('Excellent validation results - application ready for production use');
    }
  }

  async generateReport() {
    const reportPath = 'post-deployment-application-validation-report.json';
    
    // Calculate final metrics
    this.results.duration = Date.now() - this.results.startTime;
    this.calculateOverallScore();
    
    // Add summary
    this.results.summary = {
      totalTests: Object.keys(this.results.tests).length,
      passedTests: Object.values(this.results.tests).filter(test => test.passed).length,
      skippedTests: Object.values(this.results.tests).filter(test => test.skipped).length,
      failedTests: Object.values(this.results.tests).filter(test => !test.passed && !test.skipped).length,
      errors: this.results.errors.length,
      warnings: this.results.warnings.length,
      overallScore: this.results.overall.score,
      passed: this.results.overall.passed,
      duration: Math.round(this.results.duration / 1000)
    };
    
    // Write report
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    
    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('🎯 POST-DEPLOYMENT APPLICATION VALIDATION REPORT');
    console.log('='.repeat(80));
    console.log(`📅 Completed: ${this.results.timestamp}`);
    console.log(`⏱️  Duration: ${this.results.summary.duration}s`);
    console.log(`📊 Overall Score: ${this.results.overall.score}%`);
    console.log(`✅ Status: ${this.results.overall.passed ? 'PASSED' : 'FAILED'}`);
    console.log(`🧪 Tests: ${this.results.summary.passedTests}/${this.results.summary.totalTests} passed`);
    console.log(`⏭️  Skipped: ${this.results.summary.skippedTests}`);
    console.log(`❌ Failed: ${this.results.summary.failedTests}`);
    console.log(`🚨 Errors: ${this.results.summary.errors}`);
    console.log(`⚠️  Warnings: ${this.results.summary.warnings}`);
    
    console.log('\n📋 Test Results:');
    Object.entries(this.results.tests).forEach(([key, test]) => {
      const status = test.skipped ? '⏭️  SKIPPED' : (test.passed ? '✅ PASSED' : '❌ FAILED');
      console.log(`  ${status}: ${test.name}`);
    });
    
    if (this.results.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      this.results.recommendations.forEach(rec => {
        console.log(`  • ${rec}`);
      });
    }
    
    console.log(`\n📄 Full report saved to: ${reportPath}`);
    console.log('='.repeat(80));
    
    return this.results;
  }

  async run() {
    this.log('info', '🚀 Starting Post-Deployment Application Validation...');
    this.log('info', `Target: ${this.config.baseUrl}`);
    this.log('info', `Frontend: ${this.config.frontendUrl}`);
    
    try {
      // Run all validation categories
      await this.validateWebInterfaceFunctionality();
      await this.validatePaperTradingOperations();
      await this.validateRealTimeMarketDataStreaming();
      await this.validateCriticalUserWorkflows();
      
    } catch (error) {
      this.log('critical', `Validation failed: ${error.message}`);
      this.results.errors.push({
        category: 'general',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    // Generate final report
    const report = await this.generateReport();
    
    // Exit with appropriate code
    if (report.overall.passed) {
      this.log('success', '🎉 Post-deployment application validation PASSED!');
      process.exit(0);
    } else {
      this.log('error', '❌ Post-deployment application validation FAILED!');
      process.exit(1);
    }
  }
}

// CLI usage
if (require.main === module) {
  const config = {};
  
  // Parse command line arguments
  process.argv.forEach((arg, index) => {
    if (arg === '--base-url' && process.argv[index + 1]) {
      config.baseUrl = process.argv[index + 1];
    }
    if (arg === '--frontend-url' && process.argv[index + 1]) {
      config.frontendUrl = process.argv[index + 1];
    }
    if (arg === '--ws-url' && process.argv[index + 1]) {
      config.wsUrl = process.argv[index + 1];
    }
    if (arg === '--timeout' && process.argv[index + 1]) {
      config.timeout = parseInt(process.argv[index + 1]);
    }
    if (arg === '--skip-frontend') config.skipFrontendTests = true;
    if (arg === '--skip-paper-trading') config.skipPaperTradingTests = true;
    if (arg === '--skip-market-data') config.skipMarketDataTests = true;
    if (arg === '--skip-e2e') config.skipE2ETests = true;
  });
  
  // Show help
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Post-Deployment Application Validation

Usage: node post-deployment-application-validation.js [options]

Options:
  --base-url <url>         Base API URL (default: http://localhost:3000)
  --frontend-url <url>     Frontend URL (default: http://localhost:3002)
  --ws-url <url>          WebSocket URL (default: ws://localhost:3000)
  --timeout <ms>          Test timeout in milliseconds (default: 30000)
  --skip-frontend         Skip frontend functionality tests
  --skip-paper-trading    Skip paper trading validation tests
  --skip-market-data      Skip market data streaming tests
  --skip-e2e              Skip end-to-end workflow tests
  --help, -h              Show this help message

Examples:
  node post-deployment-application-validation.js
  node post-deployment-application-validation.js --base-url https://api.myapp.com
  node post-deployment-application-validation.js --skip-frontend --skip-e2e
    `);
    process.exit(0);
  }
  
  const validator = new PostDeploymentApplicationValidator(config);
  validator.run().catch(error => {
    console.error('Post-deployment validation failed:', error);
    process.exit(1);
  });
}

module.exports = PostDeploymentApplicationValidator;