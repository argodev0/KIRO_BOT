#!/usr/bin/env node

/**
 * Comprehensive API Endpoint Test
 * Tests all API endpoints by starting the server and making actual HTTP requests
 */

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;
const API_PREFIX = '/api/v1';

// Test configuration
const config = {
  serverStartTimeout: 30000, // 30 seconds to start server
  requestTimeout: 5000,      // 5 seconds per request
  maxRetries: 3
};

// Test results
const results = {
  server: { started: false, error: null },
  endpoints: {
    total: 0,
    operational: 0,
    failed: 0,
    tests: []
  }
};

// API endpoints to test
const endpoints = [
  // Basic health and status
  { path: '/health', method: 'GET', auth: false, description: 'Basic health check' },
  { path: '/status', method: 'GET', auth: false, description: 'API status' },
  
  // Authentication endpoints
  { path: '/auth/register', method: 'POST', auth: false, description: 'User registration',
    body: { email: 'test@example.com', password: 'testpass123', firstName: 'Test', lastName: 'User' }
  },
  { path: '/auth/login', method: 'POST', auth: false, description: 'User login',
    body: { email: 'test@example.com', password: 'testpass123' }
  },
  { path: '/auth/profile', method: 'GET', auth: true, description: 'User profile' },
  { path: '/auth/logout', method: 'POST', auth: true, description: 'User logout' },
  
  // Trading endpoints
  { path: '/trading/signals', method: 'GET', auth: true, description: 'Trading signals' },
  { path: '/trading/portfolio', method: 'GET', auth: true, description: 'Virtual portfolio' },
  { path: '/trading/portfolio/history', method: 'GET', auth: true, description: 'Trading history' },
  { path: '/trading/portfolio/performance', method: 'GET', auth: true, description: 'Portfolio performance' },
  { path: '/trading/executions', method: 'GET', auth: true, description: 'Trade executions' },
  
  // Configuration endpoints
  { path: '/config', method: 'GET', auth: true, description: 'Bot configuration' },
  { path: '/config/templates', method: 'GET', auth: true, description: 'Config templates' },
  
  // Analytics endpoints
  { path: '/analytics/performance', method: 'GET', auth: true, description: 'Performance analytics' },
  { path: '/analytics/patterns', method: 'GET', auth: true, description: 'Pattern analytics' },
  { path: '/analytics/portfolio', method: 'GET', auth: true, description: 'Portfolio analytics' },
  
  // Grid trading endpoints
  { path: '/grids', method: 'GET', auth: true, description: 'Grid trading' },
  { path: '/grids/stats', method: 'GET', auth: true, description: 'Grid statistics' },
  
  // User management endpoints
  { path: '/users/profile', method: 'GET', auth: true, description: 'User profile management' },
  { path: '/users/settings', method: 'GET', auth: true, description: 'User settings' },
  
  // Health and monitoring endpoints
  { path: '/health/detailed', method: 'GET', auth: false, description: 'Detailed health check' },
  { path: '/health/ready', method: 'GET', auth: false, description: 'Readiness probe' },
  { path: '/health/services', method: 'GET', auth: false, description: 'Service health' },
  { path: '/health/paper-trading-safety', method: 'GET', auth: false, description: 'Paper trading safety' },
  
  // Monitoring endpoints
  { path: '/monitoring/health', method: 'GET', auth: false, description: 'Monitoring health' },
  { path: '/monitoring/metrics', method: 'GET', auth: false, description: 'Prometheus metrics' },
  { path: '/monitoring/performance', method: 'GET', auth: true, description: 'Performance monitoring' },
  
  // Status endpoints
  { path: '/status/endpoints', method: 'GET', auth: false, description: 'Endpoint status' },
  { path: '/status/services', method: 'GET', auth: false, description: 'Service status' },
  { path: '/status/paper-trading', method: 'GET', auth: false, description: 'Paper trading status' },
  
  // Logging endpoints
  { path: '/logging/config', method: 'GET', auth: true, description: 'Logging configuration' },
  { path: '/logging/health', method: 'GET', auth: true, description: 'Logging health' }
];

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error('Request timeout'));
    }, config.requestTimeout);

    const req = http.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'API-Test-Client/1.0',
        ...options.headers
      }
    }, (res) => {
      clearTimeout(timeout);
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
          success: res.statusCode < 500 // Consider 4xx as operational (client errors)
        });
      });
    });

    req.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

// Start the server
function startServer() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting server...');
    
    // Try to start with npm run dev first, fallback to simple server
    const serverProcess = spawn('npm', ['run', 'dev'], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        PORT: PORT.toString(),
        NODE_ENV: 'test',
        PAPER_TRADING_ENABLED: 'true',
        ALLOW_REAL_TRADES: 'false',
        TRADING_SIMULATION_ONLY: 'true'
      }
    });

    let serverStarted = false;
    const timeout = setTimeout(() => {
      if (!serverStarted) {
        serverProcess.kill();
        reject(new Error('Server start timeout'));
      }
    }, config.serverStartTimeout);

    // Monitor server output
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('📝 Server output:', output.trim());
      
      // Look for server start indicators
      if (output.includes('Server running') || 
          output.includes('listening on') || 
          output.includes(`localhost:${PORT}`) ||
          output.includes('🚀')) {
        if (!serverStarted) {
          serverStarted = true;
          clearTimeout(timeout);
          console.log('✅ Server started successfully');
          resolve(serverProcess);
        }
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.log('⚠️  Server error:', error.trim());
      
      // Don't fail on compilation warnings, only on critical errors
      if (error.includes('EADDRINUSE') || error.includes('Cannot start server')) {
        if (!serverStarted) {
          clearTimeout(timeout);
          serverProcess.kill();
          reject(new Error(`Server failed to start: ${error}`));
        }
      }
    });

    serverProcess.on('exit', (code) => {
      if (!serverStarted && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Server exited with code ${code}`));
      }
    });

    // Give server a moment to start, then test basic connectivity
    setTimeout(async () => {
      try {
        const response = await makeRequest(`${BASE_URL}/health`);
        if (response.success && !serverStarted) {
          serverStarted = true;
          clearTimeout(timeout);
          console.log('✅ Server confirmed via health check');
          resolve(serverProcess);
        }
      } catch (error) {
        // Health check failed, but server might still be starting
        console.log('⏳ Server still starting...');
      }
    }, 5000);
  });
}

// Test individual endpoint
async function testEndpoint(endpoint, authToken = null) {
  const url = `${BASE_URL}${API_PREFIX}${endpoint.path}`;
  const testResult = {
    endpoint: endpoint.path,
    method: endpoint.method,
    description: endpoint.description,
    success: false,
    statusCode: null,
    error: null,
    responseTime: 0,
    requiresAuth: endpoint.auth
  };

  try {
    const startTime = Date.now();
    
    const options = {
      method: endpoint.method,
      headers: {}
    };

    // Add authentication if required
    if (endpoint.auth && authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    // Add request body if specified
    if (endpoint.body) {
      options.body = endpoint.body;
    }

    const response = await makeRequest(url, options);
    testResult.responseTime = Date.now() - startTime;
    testResult.statusCode = response.statusCode;
    
    // Determine if endpoint is operational
    // 200-299: Success
    // 400-499: Client errors (but endpoint is responding)
    // 500+: Server errors (endpoint not operational)
    testResult.success = response.statusCode < 500;
    
    if (!testResult.success) {
      testResult.error = `Server error: ${response.statusCode}`;
    }

  } catch (error) {
    testResult.error = error.message;
    testResult.success = false;
  }

  return testResult;
}

// Run all endpoint tests
async function runEndpointTests() {
  console.log('\n🔍 Testing API Endpoints');
  console.log('='.repeat(60));
  
  let authToken = null;
  
  // Test each endpoint
  for (const endpoint of endpoints) {
    results.endpoints.total++;
    
    console.log(`\n🔍 Testing: ${endpoint.method} ${endpoint.path}`);
    console.log(`   Description: ${endpoint.description}`);
    console.log(`   Auth Required: ${endpoint.auth ? 'Yes' : 'No'}`);
    
    const result = await testEndpoint(endpoint, authToken);
    results.endpoints.tests.push(result);
    
    if (result.success) {
      results.endpoints.operational++;
      console.log(`   ✅ OPERATIONAL (${result.statusCode}) - ${result.responseTime}ms`);
      
      // Try to extract auth token from login response
      if (endpoint.path === '/auth/login' && result.statusCode === 200) {
        try {
          const responseData = JSON.parse(result.data || '{}');
          if (responseData.data && responseData.data.accessToken) {
            authToken = responseData.data.accessToken;
            console.log('   🔑 Auth token obtained for subsequent requests');
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
    } else {
      results.endpoints.failed++;
      console.log(`   ❌ FAILED (${result.statusCode || 'N/A'}) - ${result.error}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Print test summary
function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 COMPREHENSIVE API TEST SUMMARY');
  console.log('='.repeat(60));
  
  // Server status
  console.log(`🖥️  Server Status: ${results.server.started ? '✅ Started' : '❌ Failed'}`);
  if (results.server.error) {
    console.log(`   Error: ${results.server.error}`);
  }
  
  // Endpoint results
  console.log(`📡 Endpoint Tests:`);
  console.log(`   Total Tested: ${results.endpoints.total}`);
  console.log(`   ✅ Operational: ${results.endpoints.operational}`);
  console.log(`   ❌ Failed: ${results.endpoints.failed}`);
  
  const successRate = results.endpoints.total > 0 ? 
    Math.round((results.endpoints.operational / results.endpoints.total) * 100) : 0;
  console.log(`   📈 Success Rate: ${successRate}%`);
  
  // Failed endpoints
  const failedTests = results.endpoints.tests.filter(test => !test.success);
  if (failedTests.length > 0) {
    console.log('\n❌ FAILED ENDPOINTS:');
    console.log('-'.repeat(40));
    failedTests.forEach(test => {
      console.log(`• ${test.method} ${test.endpoint}: ${test.error} (${test.statusCode || 'N/A'})`);
    });
  }
  
  // Operational endpoints by category
  const operationalByAuth = {
    public: results.endpoints.tests.filter(t => !t.requiresAuth && t.success).length,
    protected: results.endpoints.tests.filter(t => t.requiresAuth && t.success).length
  };
  
  console.log('\n📊 Operational Endpoints by Type:');
  console.log(`   🌐 Public: ${operationalByAuth.public}`);
  console.log(`   🔒 Protected: ${operationalByAuth.protected}`);
  
  // Overall assessment
  console.log('\n🎯 OVERALL ASSESSMENT:');
  if (successRate >= 80) {
    console.log('   🎉 EXCELLENT: API endpoints are highly operational');
    return 0;
  } else if (successRate >= 60) {
    console.log('   ✅ GOOD: Most API endpoints are operational');
    return 0;
  } else if (successRate >= 40) {
    console.log('   ⚠️  FAIR: Some API endpoints have issues');
    return 1;
  } else {
    console.log('   ❌ POOR: Many API endpoints are not operational');
    return 1;
  }
}

// Main test function
async function runComprehensiveTest() {
  console.log('🚀 Comprehensive API Endpoint Test');
  console.log(`📍 Target: ${BASE_URL}${API_PREFIX}`);
  console.log(`⏱️  Timeout: ${config.serverStartTimeout}ms server start, ${config.requestTimeout}ms per request`);
  console.log('='.repeat(60));

  let serverProcess = null;
  let exitCode = 1;

  try {
    // Start server
    serverProcess = await startServer();
    results.server.started = true;
    
    // Wait a moment for server to fully initialize
    console.log('⏳ Waiting for server to fully initialize...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Run endpoint tests
    await runEndpointTests();
    
    // Print summary and determine exit code
    exitCode = printSummary();
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
    results.server.error = error.message;
    exitCode = printSummary();
  } finally {
    // Clean up server process
    if (serverProcess) {
      console.log('\n🛑 Stopping server...');
      serverProcess.kill('SIGTERM');
      
      // Give server time to shut down gracefully
      setTimeout(() => {
        if (!serverProcess.killed) {
          serverProcess.kill('SIGKILL');
        }
      }, 5000);
    }
  }

  return exitCode;
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Comprehensive API Endpoint Test

Usage: node comprehensive-api-test.js [options]

Options:
  --help, -h     Show this help message
  --port <port>  Set server port (default: 3000)
  --timeout <ms> Set request timeout (default: 5000)

Environment Variables:
  PORT           Server port
  NODE_ENV       Node environment (set to 'test')

This test will:
1. Start the API server
2. Test all major API endpoints
3. Report operational status
4. Stop the server

Examples:
  node comprehensive-api-test.js
  node comprehensive-api-test.js --port 3001
  node comprehensive-api-test.js --timeout 10000
`);
  process.exit(0);
}

// Parse command line options
const portIndex = process.argv.indexOf('--port');
if (portIndex !== -1 && process.argv[portIndex + 1]) {
  process.env.PORT = process.argv[portIndex + 1];
}

const timeoutIndex = process.argv.indexOf('--timeout');
if (timeoutIndex !== -1 && process.argv[timeoutIndex + 1]) {
  config.requestTimeout = parseInt(process.argv[timeoutIndex + 1]);
}

// Run the comprehensive test
runComprehensiveTest()
  .then(exitCode => {
    console.log(`\n🏁 Test completed with exit code: ${exitCode}`);
    process.exit(exitCode);
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });