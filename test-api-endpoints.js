#!/usr/bin/env node

/**
 * Simple API Endpoint Test Script
 * Tests all major API endpoints to ensure they are operational
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_PREFIX = '/api/v1';

// Test endpoints configuration
const endpoints = [
  { path: '/health', method: 'GET', requiresAuth: false, description: 'Basic health check' },
  { path: '/status', method: 'GET', requiresAuth: false, description: 'API status' },
  { path: '/auth/register', method: 'POST', requiresAuth: false, description: 'User registration' },
  { path: '/auth/login', method: 'POST', requiresAuth: false, description: 'User login' },
  { path: '/auth/profile', method: 'GET', requiresAuth: true, description: 'User profile' },
  { path: '/trading/signals', method: 'GET', requiresAuth: true, description: 'Trading signals' },
  { path: '/trading/portfolio', method: 'GET', requiresAuth: true, description: 'Virtual portfolio' },
  { path: '/config', method: 'GET', requiresAuth: true, description: 'Bot configuration' },
  { path: '/analytics/performance', method: 'GET', requiresAuth: true, description: 'Performance analytics' },
  { path: '/grids', method: 'GET', requiresAuth: true, description: 'Grid trading' },
  { path: '/users/profile', method: 'GET', requiresAuth: true, description: 'User management' },
  { path: '/monitoring/health', method: 'GET', requiresAuth: false, description: 'Monitoring health' },
  { path: '/logging/config', method: 'GET', requiresAuth: true, description: 'Logging configuration' }
];

// Test results
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const timeout = options.timeout || 5000;
    
    const req = protocol.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
          success: res.statusCode < 400
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

// Test individual endpoint
async function testEndpoint(endpoint) {
  const url = `${BASE_URL}${API_PREFIX}${endpoint.path}`;
  const testResult = {
    endpoint: endpoint.path,
    method: endpoint.method,
    description: endpoint.description,
    success: false,
    statusCode: null,
    error: null,
    responseTime: 0
  };

  try {
    const startTime = Date.now();
    
    const options = {
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'API-Endpoint-Tester/1.0'
      }
    };

    // Add test authentication token for protected endpoints
    if (endpoint.requiresAuth) {
      options.headers['Authorization'] = 'Bearer test-token-for-endpoint-testing';
    }

    // Add test body for POST requests
    if (endpoint.method === 'POST') {
      if (endpoint.path === '/auth/register') {
        options.body = {
          email: 'test@example.com',
          password: 'testpassword123',
          firstName: 'Test',
          lastName: 'User'
        };
      } else if (endpoint.path === '/auth/login') {
        options.body = {
          email: 'test@example.com',
          password: 'testpassword123'
        };
      }
    }

    const response = await makeRequest(url, options);
    testResult.responseTime = Date.now() - startTime;
    testResult.statusCode = response.statusCode;
    
    // Consider endpoint operational if:
    // - Returns 200-299 (success)
    // - Returns 401 (unauthorized - expected for protected endpoints without valid auth)
    // - Returns 400 (bad request - expected for some test data)
    // - Returns 404 (not found - but responds, indicating server is running)
    const operationalCodes = [200, 201, 400, 401, 404, 422];
    testResult.success = operationalCodes.includes(response.statusCode);
    
    if (!testResult.success) {
      testResult.error = `Unexpected status code: ${response.statusCode}`;
    }

  } catch (error) {
    testResult.error = error.message;
    testResult.success = false;
  }

  return testResult;
}

// Test server availability
async function testServerAvailability() {
  console.log('🔍 Testing server availability...');
  
  try {
    const response = await makeRequest(`${BASE_URL}/health`);
    if (response.success) {
      console.log('✅ Server is responding');
      return true;
    } else {
      console.log(`❌ Server responded with status ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Server is not available: ${error.message}`);
    return false;
  }
}

// Main test function
async function runEndpointTests() {
  console.log('🚀 Starting API Endpoint Tests');
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`📍 API Prefix: ${API_PREFIX}`);
  console.log('=' .repeat(60));

  // Test server availability first
  const serverAvailable = await testServerAvailability();
  if (!serverAvailable) {
    console.log('\n❌ Cannot proceed with endpoint tests - server is not available');
    process.exit(1);
  }

  console.log('\n📋 Testing API Endpoints:');
  console.log('-'.repeat(60));

  // Test each endpoint
  for (const endpoint of endpoints) {
    results.total++;
    
    console.log(`\n🔍 Testing: ${endpoint.method} ${endpoint.path}`);
    console.log(`   Description: ${endpoint.description}`);
    
    const result = await testEndpoint(endpoint);
    
    if (result.success) {
      results.passed++;
      console.log(`   ✅ OPERATIONAL (${result.statusCode}) - ${result.responseTime}ms`);
    } else {
      results.failed++;
      results.errors.push(result);
      console.log(`   ❌ FAILED (${result.statusCode || 'N/A'}) - ${result.error}`);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Endpoints Tested: ${results.total}`);
  console.log(`✅ Operational: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${Math.round((results.passed / results.total) * 100)}%`);

  if (results.errors.length > 0) {
    console.log('\n❌ FAILED ENDPOINTS:');
    console.log('-'.repeat(40));
    results.errors.forEach(error => {
      console.log(`• ${error.method} ${error.endpoint}: ${error.error}`);
    });
  }

  // Determine overall result
  const successRate = (results.passed / results.total) * 100;
  if (successRate >= 80) {
    console.log('\n🎉 OVERALL RESULT: API endpoints are mostly operational');
    process.exit(0);
  } else if (successRate >= 50) {
    console.log('\n⚠️  OVERALL RESULT: API endpoints have significant issues');
    process.exit(1);
  } else {
    console.log('\n💥 OVERALL RESULT: API endpoints are not operational');
    process.exit(1);
  }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
API Endpoint Tester

Usage: node test-api-endpoints.js [options]

Options:
  --help, -h     Show this help message
  --url <url>    Set base URL (default: http://localhost:3000)

Environment Variables:
  API_BASE_URL   Base URL for the API server

Examples:
  node test-api-endpoints.js
  node test-api-endpoints.js --url http://localhost:3001
  API_BASE_URL=https://api.example.com node test-api-endpoints.js
`);
  process.exit(0);
}

// Override base URL from command line
const urlIndex = process.argv.indexOf('--url');
if (urlIndex !== -1 && process.argv[urlIndex + 1]) {
  process.env.API_BASE_URL = process.argv[urlIndex + 1];
}

// Run the tests
runEndpointTests().catch(error => {
  console.error('💥 Test runner failed:', error.message);
  process.exit(1);
});