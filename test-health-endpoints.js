#!/usr/bin/env node

/**
 * Comprehensive Health Endpoints Test
 * Tests all health check endpoints to ensure they are working correctly
 */

const http = require('http');
const https = require('https');

// Configuration
const config = {
  host: process.env.TEST_HOST || 'localhost',
  port: process.env.TEST_PORT || 3000,
  protocol: process.env.TEST_PROTOCOL || 'http',
  timeout: 10000
};

// Health endpoints to test
const healthEndpoints = [
  // Basic health endpoints
  { path: '/api/v1/health', name: 'Basic Health Check', critical: true },
  { path: '/api/v1/health/detailed', name: 'Detailed Health Check', critical: true },
  { path: '/api/v1/health/ready', name: 'Readiness Probe', critical: true },
  { path: '/api/v1/health/live', name: 'Liveness Probe', critical: true },
  { path: '/api/v1/health/startup', name: 'Startup Probe', critical: false },
  { path: '/api/v1/health/deep', name: 'Deep Health Check', critical: false },
  
  // System health endpoints
  { path: '/api/v1/health/system', name: 'System Health', critical: true },
  { path: '/api/v1/health/all-services', name: 'All Services Health', critical: true },
  { path: '/api/v1/health/infrastructure', name: 'Infrastructure Health', critical: true },
  { path: '/api/v1/health/external-services', name: 'External Services Health', critical: false },
  { path: '/api/v1/health/application', name: 'Application Health', critical: true },
  
  // Service-specific health endpoints
  { path: '/api/v1/health/database', name: 'Database Health', critical: true },
  { path: '/api/v1/health/redis', name: 'Redis Health', critical: false },
  { path: '/api/v1/health/exchanges', name: 'Exchanges Health', critical: false },
  { path: '/api/v1/health/websocket', name: 'WebSocket Health', critical: false },
  { path: '/api/v1/health/paper-trading-safety', name: 'Paper Trading Safety', critical: true },
  
  // Status endpoints
  { path: '/api/v1/status', name: 'API Status', critical: true },
  { path: '/api/v1/status/endpoints', name: 'Endpoints Status', critical: false },
  { path: '/api/v1/status/services', name: 'Services Status', critical: true },
  { path: '/api/v1/status/paper-trading', name: 'Paper Trading Status', critical: true },
  { path: '/api/v1/status/health-summary', name: 'Health Summary', critical: true },
  { path: '/api/v1/status/connectivity', name: 'Connectivity Status', critical: true },
  
  // Monitoring endpoints
  { path: '/api/v1/health/metrics', name: 'Prometheus Metrics', critical: false },
  { path: '/api/v1/health/services', name: 'Service Status', critical: true }
];

// Test results
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  critical_failed: 0,
  results: []
};

/**
 * Make HTTP request to test endpoint
 */
function makeRequest(endpoint) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const client = config.protocol === 'https' ? https : http;
    
    const options = {
      hostname: config.host,
      port: config.port,
      path: endpoint.path,
      method: 'GET',
      timeout: config.timeout,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Health-Endpoint-Test/1.0'
      }
    };

    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        
        try {
          let parsedData = null;
          if (res.headers['content-type']?.includes('application/json')) {
            parsedData = JSON.parse(data);
          }
          
          resolve({
            success: true,
            statusCode: res.statusCode,
            responseTime,
            data: parsedData,
            rawData: data,
            headers: res.headers
          });
        } catch (parseError) {
          resolve({
            success: true,
            statusCode: res.statusCode,
            responseTime,
            data: null,
            rawData: data,
            headers: res.headers,
            parseError: parseError.message
          });
        }
      });
    });

    req.on('error', (error) => {
      const responseTime = Date.now() - startTime;
      resolve({
        success: false,
        error: error.message,
        responseTime
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const responseTime = Date.now() - startTime;
      resolve({
        success: false,
        error: 'Request timeout',
        responseTime
      });
    });

    req.end();
  });
}

/**
 * Test a single health endpoint
 */
async function testEndpoint(endpoint) {
  console.log(`Testing ${endpoint.name} (${endpoint.path})...`);
  
  const result = await makeRequest(endpoint);
  
  const testResult = {
    endpoint: endpoint.path,
    name: endpoint.name,
    critical: endpoint.critical,
    success: result.success,
    statusCode: result.statusCode,
    responseTime: result.responseTime,
    error: result.error,
    issues: []
  };

  // Analyze the result
  if (!result.success) {
    testResult.issues.push(`Request failed: ${result.error}`);
  } else {
    // Check status code
    if (result.statusCode >= 500) {
      testResult.issues.push(`Server error: HTTP ${result.statusCode}`);
    } else if (result.statusCode >= 400) {
      testResult.issues.push(`Client error: HTTP ${result.statusCode}`);
    }
    
    // Check response time
    if (result.responseTime > 5000) {
      testResult.issues.push(`Slow response: ${result.responseTime}ms`);
    }
    
    // Check response format for JSON endpoints
    if (result.headers['content-type']?.includes('application/json')) {
      if (!result.data && !result.parseError) {
        testResult.issues.push('Empty JSON response');
      } else if (result.parseError) {
        testResult.issues.push(`JSON parse error: ${result.parseError}`);
      } else {
        // Validate common health check fields
        if (endpoint.path.includes('/health/') || endpoint.path.includes('/status/')) {
          if (!result.data.timestamp) {
            testResult.issues.push('Missing timestamp field');
          }
          
          if (endpoint.path.includes('/health/') && !result.data.status && !result.data.overall) {
            testResult.issues.push('Missing status/overall field');
          }
        }
      }
    }
  }

  // Determine if test passed
  const passed = result.success && 
                 result.statusCode < 500 && 
                 testResult.issues.length === 0;

  testResult.passed = passed;
  
  // Update counters
  testResults.total++;
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${endpoint.name}: PASSED (${result.responseTime}ms)`);
  } else {
    testResults.failed++;
    if (endpoint.critical) {
      testResults.critical_failed++;
    }
    console.log(`❌ ${endpoint.name}: FAILED`);
    testResult.issues.forEach(issue => {
      console.log(`   - ${issue}`);
    });
  }

  testResults.results.push(testResult);
  return testResult;
}

/**
 * Run all health endpoint tests
 */
async function runHealthTests() {
  console.log('🏥 Starting Health Endpoints Test Suite');
  console.log(`Testing ${healthEndpoints.length} endpoints on ${config.protocol}://${config.host}:${config.port}`);
  console.log('=' .repeat(80));

  const startTime = Date.now();

  // Test all endpoints
  for (const endpoint of healthEndpoints) {
    await testEndpoint(endpoint);
  }

  const totalTime = Date.now() - startTime;

  // Generate summary report
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed} ✅`);
  console.log(`Failed: ${testResults.failed} ❌`);
  console.log(`Critical Failed: ${testResults.critical_failed} 🚨`);
  console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  console.log(`Total Time: ${totalTime}ms`);

  // Show failed tests
  if (testResults.failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    testResults.results
      .filter(r => !r.passed)
      .forEach(result => {
        console.log(`  ${result.critical ? '🚨' : '⚠️'} ${result.name} (${result.endpoint})`);
        result.issues.forEach(issue => {
          console.log(`     - ${issue}`);
        });
      });
  }

  // Show critical failures
  if (testResults.critical_failed > 0) {
    console.log('\n🚨 CRITICAL FAILURES:');
    testResults.results
      .filter(r => !r.passed && r.critical)
      .forEach(result => {
        console.log(`  🚨 ${result.name}: ${result.issues.join(', ')}`);
      });
  }

  // Generate recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  if (testResults.critical_failed > 0) {
    console.log('  🚨 CRITICAL: Fix critical health endpoints before deployment');
    console.log('  - Critical endpoints are required for production readiness');
    console.log('  - Review server logs for detailed error information');
  } else if (testResults.failed > 0) {
    console.log('  ⚠️ WARNING: Some non-critical endpoints are failing');
    console.log('  - Consider fixing these for better monitoring coverage');
  } else {
    console.log('  ✅ All health endpoints are working correctly');
    console.log('  - System is ready for production deployment');
    console.log('  - Health monitoring is fully functional');
  }

  // Save detailed results to file
  const reportData = {
    timestamp: new Date().toISOString(),
    config,
    summary: {
      total: testResults.total,
      passed: testResults.passed,
      failed: testResults.failed,
      critical_failed: testResults.critical_failed,
      success_rate: ((testResults.passed / testResults.total) * 100).toFixed(1),
      total_time: totalTime
    },
    results: testResults.results
  };

  require('fs').writeFileSync(
    'health-endpoints-test-report.json',
    JSON.stringify(reportData, null, 2)
  );

  console.log('\n📄 Detailed report saved to: health-endpoints-test-report.json');

  // Exit with appropriate code
  process.exit(testResults.critical_failed > 0 ? 1 : 0);
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Health Endpoints Test Suite');
  console.log('');
  console.log('Usage: node test-health-endpoints.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h     Show this help message');
  console.log('  --host HOST    Test host (default: localhost)');
  console.log('  --port PORT    Test port (default: 3000)');
  console.log('  --https        Use HTTPS protocol');
  console.log('');
  console.log('Environment Variables:');
  console.log('  TEST_HOST      Test host');
  console.log('  TEST_PORT      Test port');
  console.log('  TEST_PROTOCOL  Protocol (http or https)');
  process.exit(0);
}

// Parse command line arguments
const hostIndex = process.argv.indexOf('--host');
if (hostIndex !== -1 && process.argv[hostIndex + 1]) {
  config.host = process.argv[hostIndex + 1];
}

const portIndex = process.argv.indexOf('--port');
if (portIndex !== -1 && process.argv[portIndex + 1]) {
  config.port = parseInt(process.argv[portIndex + 1]);
}

if (process.argv.includes('--https')) {
  config.protocol = 'https';
}

// Run the tests
runHealthTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});