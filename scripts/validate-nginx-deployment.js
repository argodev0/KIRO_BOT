#!/usr/bin/env node

/**
 * Nginx Deployment Validation Script
 * Validates the complete Nginx reverse proxy and SSL configuration
 * for the Paper Trading Bot production deployment
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  domain: process.env.DOMAIN_NAME || 'localhost',
  timeout: parseInt(process.env.TEST_TIMEOUT) || 10000,
  retries: parseInt(process.env.TEST_RETRIES) || 3,
  verbose: process.env.VERBOSE === 'true'
};

// Test results storage
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
};

// Utility functions
const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  warning: (msg) => console.log(`⚠️  ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
  debug: (msg) => config.verbose && console.log(`🔍 ${msg}`)
};

// Test result recording
function recordTest(name, status, message, details = null) {
  const test = { name, status, message, details, timestamp: new Date().toISOString() };
  results.tests.push(test);
  
  switch (status) {
    case 'PASS':
      results.passed++;
      log.success(`${name}: ${message}`);
      break;
    case 'FAIL':
      results.failed++;
      log.error(`${name}: ${message}`);
      break;
    case 'WARN':
      results.warnings++;
      log.warning(`${name}: ${message}`);
      break;
    default:
      log.info(`${name}: ${message}`);
  }
  
  if (details && config.verbose) {
    log.debug(`Details: ${JSON.stringify(details, null, 2)}`);
  }
}

// HTTP request helper with timeout and retries
function makeRequest(options, retries = config.retries) {
  return new Promise((resolve, reject) => {
    const client = options.protocol === 'https:' ? https : http;
    
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
          url: `${options.protocol}//${options.hostname}:${options.port}${options.path}`
        });
      });
    });
    
    req.setTimeout(config.timeout, () => {
      req.destroy();
      if (retries > 0) {
        log.debug(`Request timeout, retrying... (${retries} attempts left)`);
        setTimeout(() => {
          makeRequest(options, retries - 1).then(resolve).catch(reject);
        }, 1000);
      } else {
        reject(new Error('Request timeout'));
      }
    });
    
    req.on('error', (err) => {
      if (retries > 0) {
        log.debug(`Request error: ${err.message}, retrying... (${retries} attempts left)`);
        setTimeout(() => {
          makeRequest(options, retries - 1).then(resolve).catch(reject);
        }, 1000);
      } else {
        reject(err);
      }
    });
    
    req.end();
  });
}

// Test HTTP to HTTPS redirect
async function testHttpRedirect() {
  try {
    const response = await makeRequest({
      hostname: config.domain,
      port: 80,
      path: '/health',
      method: 'GET',
      protocol: 'http:'
    });
    
    if (response.statusCode === 301 || response.statusCode === 302) {
      const location = response.headers.location;
      if (location && location.startsWith('https://')) {
        recordTest('HTTP to HTTPS Redirect', 'PASS', 
          `Correctly redirects to HTTPS (${response.statusCode})`, 
          { location, statusCode: response.statusCode });
      } else {
        recordTest('HTTP to HTTPS Redirect', 'FAIL', 
          'Redirects but not to HTTPS URL', 
          { location, statusCode: response.statusCode });
      }
    } else {
      recordTest('HTTP to HTTPS Redirect', 'FAIL', 
        `Expected redirect (301/302), got ${response.statusCode}`);
    }
  } catch (error) {
    recordTest('HTTP to HTTPS Redirect', 'FAIL', 
      `Request failed: ${error.message}`);
  }
}

// Test HTTPS endpoint and SSL
async function testHttpsEndpoint() {
  if (config.domain === 'localhost') {
    recordTest('HTTPS Endpoint', 'INFO', 'Skipping HTTPS test for localhost');
    return;
  }
  
  try {
    const response = await makeRequest({
      hostname: config.domain,
      port: 443,
      path: '/health',
      method: 'GET',
      protocol: 'https:',
      rejectUnauthorized: false // Allow self-signed certs for testing
    });
    
    if (response.statusCode === 200) {
      recordTest('HTTPS Endpoint', 'PASS', 
        'HTTPS endpoint is accessible', 
        { statusCode: response.statusCode });
    } else {
      recordTest('HTTPS Endpoint', 'WARN', 
        `HTTPS accessible but returned ${response.statusCode}`);
    }
  } catch (error) {
    recordTest('HTTPS Endpoint', 'FAIL', 
      `HTTPS request failed: ${error.message}`);
  }
}

// Test security headers
async function testSecurityHeaders() {
  const protocol = config.domain === 'localhost' ? 'http:' : 'https:';
  const port = config.domain === 'localhost' ? 80 : 443;
  
  try {
    const response = await makeRequest({
      hostname: config.domain,
      port: port,
      path: '/health',
      method: 'HEAD',
      protocol: protocol
    });
    
    const requiredHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'x-xss-protection',
      'x-paper-trading-mode'
    ];
    
    const missingHeaders = [];
    const presentHeaders = {};
    
    requiredHeaders.forEach(header => {
      if (response.headers[header]) {
        presentHeaders[header] = response.headers[header];
      } else {
        missingHeaders.push(header);
      }
    });
    
    if (missingHeaders.length === 0) {
      recordTest('Security Headers', 'PASS', 
        'All required security headers present', 
        presentHeaders);
    } else {
      recordTest('Security Headers', 'FAIL', 
        `Missing headers: ${missingHeaders.join(', ')}`, 
        { present: presentHeaders, missing: missingHeaders });
    }
  } catch (error) {
    recordTest('Security Headers', 'FAIL', 
      `Failed to check headers: ${error.message}`);
  }
}

// Test paper trading headers
async function testPaperTradingHeaders() {
  const protocol = config.domain === 'localhost' ? 'http:' : 'https:';
  const port = config.domain === 'localhost' ? 80 : 443;
  
  try {
    const response = await makeRequest({
      hostname: config.domain,
      port: port,
      path: '/api/trading/',
      method: 'HEAD',
      protocol: protocol
    });
    
    const paperTradingHeaders = [
      'x-paper-trading-mode',
      'x-trading-environment',
      'x-real-trading-status',
      'x-financial-risk'
    ];
    
    const foundHeaders = {};
    let criticalMissing = [];
    
    paperTradingHeaders.forEach(header => {
      if (response.headers[header]) {
        foundHeaders[header] = response.headers[header];
      } else {
        criticalMissing.push(header);
      }
    });
    
    // Check for paper trading mode specifically
    if (response.headers['x-paper-trading-mode'] === 'true') {
      recordTest('Paper Trading Headers', 'PASS', 
        'Paper trading mode is properly enforced', 
        foundHeaders);
    } else if (response.headers['x-paper-trading-mode']) {
      recordTest('Paper Trading Headers', 'WARN', 
        `Paper trading mode header present but value is: ${response.headers['x-paper-trading-mode']}`);
    } else {
      recordTest('Paper Trading Headers', 'FAIL', 
        'CRITICAL: Paper trading mode header missing - SAFETY RISK!', 
        { missing: criticalMissing, found: foundHeaders });
    }
  } catch (error) {
    recordTest('Paper Trading Headers', 'FAIL', 
      `Failed to check paper trading headers: ${error.message}`);
  }
}

// Test API endpoints
async function testApiEndpoints() {
  const protocol = config.domain === 'localhost' ? 'http:' : 'https:';
  const port = config.domain === 'localhost' ? 80 : 443;
  
  const endpoints = [
    { path: '/health', expectedCodes: [200] },
    { path: '/api/health', expectedCodes: [200, 404] },
    { path: '/api/trading/', expectedCodes: [200, 401, 403, 404, 405] },
    { path: '/api/market/', expectedCodes: [200, 401, 403, 404, 405] }
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest({
        hostname: config.domain,
        port: port,
        path: endpoint.path,
        method: 'GET',
        protocol: protocol
      });
      
      if (endpoint.expectedCodes.includes(response.statusCode)) {
        recordTest(`API Endpoint ${endpoint.path}`, 'PASS', 
          `Responded with expected status ${response.statusCode}`);
      } else {
        recordTest(`API Endpoint ${endpoint.path}`, 'WARN', 
          `Unexpected status ${response.statusCode} (expected: ${endpoint.expectedCodes.join(', ')})`);
      }
    } catch (error) {
      recordTest(`API Endpoint ${endpoint.path}`, 'FAIL', 
        `Request failed: ${error.message}`);
    }
  }
}

// Test WebSocket proxy configuration
async function testWebSocketProxy() {
  const protocol = config.domain === 'localhost' ? 'http:' : 'https:';
  const port = config.domain === 'localhost' ? 80 : 443;
  
  try {
    const response = await makeRequest({
      hostname: config.domain,
      port: port,
      path: '/socket.io/',
      method: 'GET',
      protocol: protocol,
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'Sec-WebSocket-Version': '13'
      }
    });
    
    // Check if the response indicates WebSocket upgrade capability
    if (response.statusCode === 101 || 
        response.statusCode === 400 || // Bad request is expected without proper WebSocket handshake
        response.headers['upgrade'] || 
        response.headers['connection']) {
      recordTest('WebSocket Proxy', 'PASS', 
        'WebSocket proxy is configured and responding');
    } else {
      recordTest('WebSocket Proxy', 'INFO', 
        `WebSocket endpoint accessible (status: ${response.statusCode})`);
    }
    
    // Check for paper trading headers on WebSocket endpoint
    if (response.headers['x-paper-trading-mode']) {
      recordTest('WebSocket Paper Trading', 'PASS', 
        'Paper trading headers present on WebSocket endpoint');
    } else {
      recordTest('WebSocket Paper Trading', 'WARN', 
        'Paper trading headers not detected on WebSocket endpoint');
    }
  } catch (error) {
    recordTest('WebSocket Proxy', 'FAIL', 
      `WebSocket test failed: ${error.message}`);
  }
}

// Test rate limiting
async function testRateLimiting() {
  const protocol = config.domain === 'localhost' ? 'http:' : 'https:';
  const port = config.domain === 'localhost' ? 80 : 443;
  
  log.info('Testing rate limiting (making rapid requests)...');
  
  let rateLimitTriggered = false;
  const requests = [];
  
  // Make 20 rapid requests
  for (let i = 0; i < 20; i++) {
    requests.push(
      makeRequest({
        hostname: config.domain,
        port: port,
        path: '/health',
        method: 'GET',
        protocol: protocol
      }).catch(err => ({ error: err.message }))
    );
  }
  
  try {
    const responses = await Promise.all(requests);
    
    for (const response of responses) {
      if (response.statusCode === 429) {
        rateLimitTriggered = true;
        break;
      }
    }
    
    if (rateLimitTriggered) {
      recordTest('Rate Limiting', 'PASS', 
        'Rate limiting is active (HTTP 429 detected)');
    } else {
      recordTest('Rate Limiting', 'INFO', 
        'Rate limiting not triggered (may be configured with higher limits)');
    }
  } catch (error) {
    recordTest('Rate Limiting', 'FAIL', 
      `Rate limiting test failed: ${error.message}`);
  }
}

// Validate configuration files
async function validateConfigFiles() {
  const configFiles = [
    'docker/nginx/production.conf',
    'docker/nginx/complete-production.conf',
    'docker/nginx/security.conf',
    'docker/nginx/websocket.conf',
    'docker/nginx/nginx.conf'
  ];
  
  let allFilesExist = true;
  const missingFiles = [];
  
  for (const file of configFiles) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      log.debug(`Configuration file exists: ${file}`);
    } else {
      allFilesExist = false;
      missingFiles.push(file);
    }
  }
  
  if (allFilesExist) {
    recordTest('Configuration Files', 'PASS', 
      'All required Nginx configuration files are present');
  } else {
    recordTest('Configuration Files', 'FAIL', 
      `Missing configuration files: ${missingFiles.join(', ')}`);
  }
}

// Generate comprehensive report
function generateReport() {
  console.log('\n📋 Nginx Deployment Validation Report');
  console.log('=====================================');
  console.log(`Domain: ${config.domain}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Total Tests: ${results.tests.length}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Warnings: ${results.warnings}`);
  console.log('');
  
  // Critical issues
  const criticalIssues = results.tests.filter(t => 
    t.status === 'FAIL' && t.name.includes('Paper Trading')
  );
  
  if (criticalIssues.length > 0) {
    console.log('🚨 CRITICAL SECURITY ISSUES:');
    criticalIssues.forEach(issue => {
      console.log(`   - ${issue.name}: ${issue.message}`);
    });
    console.log('');
  }
  
  // Summary
  if (results.failed === 0) {
    console.log('✅ All critical tests passed - Nginx configuration is ready for production');
  } else if (criticalIssues.length === 0) {
    console.log('⚠️  Some tests failed but no critical security issues detected');
  } else {
    console.log('❌ CRITICAL ISSUES DETECTED - DO NOT DEPLOY TO PRODUCTION');
  }
  
  console.log('');
  console.log('📝 Recommendations:');
  console.log('   - Monitor nginx access and error logs');
  console.log('   - Regularly test SSL certificate renewal');
  console.log('   - Verify paper trading mode is always enforced');
  console.log('   - Review rate limiting settings based on usage');
  console.log('');
  
  // Save detailed report
  const reportData = {
    summary: {
      domain: config.domain,
      timestamp: new Date().toISOString(),
      totalTests: results.tests.length,
      passed: results.passed,
      failed: results.failed,
      warnings: results.warnings,
      criticalIssues: criticalIssues.length
    },
    tests: results.tests,
    config: config
  };
  
  const reportPath = path.join(process.cwd(), 'nginx-validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  console.log(`📄 Detailed report saved to: ${reportPath}`);
  
  // Exit with appropriate code
  process.exit(criticalIssues.length > 0 ? 2 : (results.failed > 0 ? 1 : 0));
}

// Main execution
async function main() {
  console.log('🚀 Starting Nginx Deployment Validation');
  console.log('========================================');
  console.log(`Testing domain: ${config.domain}`);
  console.log(`Timeout: ${config.timeout}ms`);
  console.log(`Retries: ${config.retries}`);
  console.log('');
  
  // Run all tests
  await validateConfigFiles();
  await testHttpRedirect();
  await testHttpsEndpoint();
  await testSecurityHeaders();
  await testPaperTradingHeaders();
  await testApiEndpoints();
  await testWebSocketProxy();
  await testRateLimiting();
  
  // Generate final report
  generateReport();
}

// Handle command line arguments
if (require.main === module) {
  const command = process.argv[2] || 'all';
  
  switch (command) {
    case 'all':
      main().catch(console.error);
      break;
    case 'security':
      testSecurityHeaders().then(() => testPaperTradingHeaders()).then(generateReport).catch(console.error);
      break;
    case 'ssl':
      testHttpRedirect().then(() => testHttpsEndpoint()).then(generateReport).catch(console.error);
      break;
    case 'api':
      testApiEndpoints().then(generateReport).catch(console.error);
      break;
    case 'websocket':
      testWebSocketProxy().then(generateReport).catch(console.error);
      break;
    case 'help':
      console.log('Nginx Deployment Validation Script');
      console.log('==================================');
      console.log('');
      console.log('Usage: node validate-nginx-deployment.js [command]');
      console.log('');
      console.log('Commands:');
      console.log('  all       - Run all validation tests (default)');
      console.log('  security  - Test security headers only');
      console.log('  ssl       - Test SSL configuration only');
      console.log('  api       - Test API endpoints only');
      console.log('  websocket - Test WebSocket configuration only');
      console.log('  help      - Show this help message');
      console.log('');
      console.log('Environment Variables:');
      console.log('  DOMAIN_NAME   - Domain to test (default: localhost)');
      console.log('  TEST_TIMEOUT  - Request timeout in ms (default: 10000)');
      console.log('  TEST_RETRIES  - Number of retries (default: 3)');
      console.log('  VERBOSE       - Enable verbose output (default: false)');
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "node validate-nginx-deployment.js help" for usage information');
      process.exit(1);
  }
}