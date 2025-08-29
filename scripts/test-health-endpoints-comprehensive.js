#!/usr/bin/env node

/**
 * Comprehensive Health Endpoints Testing
 * 
 * This script starts the application and tests all health endpoints
 */

const { spawn } = require('child_process');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class HealthEndpointsTester {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      overallStatus: 'unknown',
      tests: {},
      errors: [],
      warnings: [],
      summary: {}
    };
    
    this.config = {
      baseUrl: 'http://localhost:3000',
      timeout: 10000,
      startupWaitTime: 15000
    };
    
    this.appProcess = null;
  }

  async runTests() {
    console.log('🔍 Starting Comprehensive Health Endpoints Testing...\n');
    
    try {
      // Step 1: Start the application
      await this.startApplication();
      
      // Step 2: Wait for application to be ready
      await this.waitForApplication();
      
      // Step 3: Test all health endpoints
      await this.testAllHealthEndpoints();
      
      // Step 4: Test metrics endpoint specifically
      await this.testMetricsEndpoint();
      
      // Step 5: Test error handling
      await this.testErrorHandling();
      
      // Step 6: Generate report
      await this.generateReport();
      
    } catch (error) {
      this.results.errors.push({
        stage: 'testing',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      console.error('❌ Testing failed:', error.message);
    } finally {
      // Always cleanup
      await this.cleanup();
    }
  }

  async startApplication() {
    console.log('🚀 Starting application...');
    
    try {
      // Check if application is already running
      try {
        await axios.get(`${this.config.baseUrl}/health`, { timeout: 2000 });
        console.log('  ✅ Application already running');
        return;
      } catch (error) {
        // Application not running, start it
      }
      
      // Compile TypeScript first
      console.log('  📦 Compiling TypeScript...');
      await this.runCommand('npm', ['run', 'build']);
      
      // Start the application
      console.log('  🚀 Starting server...');
      this.appProcess = spawn('npm', ['start'], {
        cwd: process.cwd(),
        stdio: 'pipe',
        detached: false
      });
      
      // Handle process output
      this.appProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Server running') || output.includes('listening')) {
          console.log('  ✅ Server started successfully');
        }
      });
      
      this.appProcess.stderr.on('data', (data) => {
        const error = data.toString();
        if (!error.includes('warning') && !error.includes('deprecated')) {
          console.log('  ⚠️  Server error:', error.trim());
        }
      });
      
      this.appProcess.on('error', (error) => {
        console.error('  ❌ Failed to start application:', error.message);
      });
      
      console.log('  ⏳ Waiting for application to start...');
      
    } catch (error) {
      throw new Error(`Failed to start application: ${error.message}`);
    }
  }

  async waitForApplication() {
    console.log('⏳ Waiting for application to be ready...');
    
    const maxWaitTime = this.config.startupWaitTime;
    const checkInterval = 1000;
    let waitTime = 0;
    
    while (waitTime < maxWaitTime) {
      try {
        const response = await axios.get(`${this.config.baseUrl}/health`, { 
          timeout: 2000,
          validateStatus: () => true 
        });
        
        if (response.status < 500) {
          console.log('  ✅ Application is ready');
          return;
        }
      } catch (error) {
        // Continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waitTime += checkInterval;
      
      if (waitTime % 5000 === 0) {
        console.log(`  ⏳ Still waiting... (${waitTime / 1000}s)`);
      }
    }
    
    throw new Error('Application did not become ready within the timeout period');
  }

  async testAllHealthEndpoints() {
    console.log('🏥 Testing all health endpoints...');
    
    const endpoints = [
      { path: '/health', name: 'Basic Health', expectedStatus: [200, 503] },
      { path: '/health/detailed', name: 'Detailed Health', expectedStatus: [200, 503] },
      { path: '/health/ready', name: 'Readiness', expectedStatus: [200, 503] },
      { path: '/health/live', name: 'Liveness', expectedStatus: [200, 503] },
      { path: '/health/startup', name: 'Startup', expectedStatus: [200, 503] },
      { path: '/health/deep', name: 'Deep Health', expectedStatus: [200, 503] },
      { path: '/health/services', name: 'Services', expectedStatus: [200] },
      { path: '/health/system', name: 'System Health', expectedStatus: [200, 503] },
      { path: '/health/database', name: 'Database Health', expectedStatus: [200, 503] },
      { path: '/health/redis', name: 'Redis Health', expectedStatus: [200, 503] },
      { path: '/health/exchanges', name: 'Exchanges Health', expectedStatus: [200, 503] },
      { path: '/health/websocket', name: 'WebSocket Health', expectedStatus: [200, 503] },
      { path: '/health/paper-trading-safety', name: 'Paper Trading Safety', expectedStatus: [200, 503] }
    ];
    
    const results = [];
    
    for (const endpoint of endpoints) {
      try {
        const startTime = Date.now();
        const response = await axios.get(`${this.config.baseUrl}${endpoint.path}`, {
          timeout: this.config.timeout,
          validateStatus: () => true
        });
        
        const responseTime = Date.now() - startTime;
        const statusOk = endpoint.expectedStatus.includes(response.status);
        
        results.push({
          endpoint: endpoint.path,
          name: endpoint.name,
          status: statusOk ? 'passed' : 'failed',
          httpStatus: response.status,
          responseTime,
          contentType: response.headers['content-type'],
          bodySize: JSON.stringify(response.data).length,
          hasRequiredFields: this.validateResponseStructure(endpoint.path, response.data)
        });
        
        const statusIcon = statusOk ? '✅' : '❌';
        console.log(`  ${statusIcon} ${endpoint.name}: ${response.status} (${responseTime}ms)`);
        
      } catch (error) {
        results.push({
          endpoint: endpoint.path,
          name: endpoint.name,
          status: 'failed',
          error: error.message
        });
        
        console.log(`  ❌ ${endpoint.name}: ERROR - ${error.message}`);
      }
    }
    
    const passedEndpoints = results.filter(r => r.status === 'passed').length;
    
    this.results.tests.healthEndpoints = {
      status: passedEndpoints === endpoints.length ? 'passed' : 'warning',
      message: `${passedEndpoints}/${endpoints.length} health endpoints working correctly`,
      details: results,
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ Health endpoints tested\n');
  }

  async testMetricsEndpoint() {
    console.log('📊 Testing metrics endpoint...');
    
    try {
      const startTime = Date.now();
      const response = await axios.get(`${this.config.baseUrl}/health/metrics`, {
        timeout: this.config.timeout,
        validateStatus: () => true
      });
      
      const responseTime = Date.now() - startTime;
      
      const tests = [];
      
      // Test response status
      tests.push({
        test: 'HTTP Status',
        status: response.status === 200 ? 'passed' : 'failed',
        details: { httpStatus: response.status }
      });
      
      // Test content type
      const isTextPlain = response.headers['content-type']?.includes('text/plain');
      tests.push({
        test: 'Content Type',
        status: isTextPlain ? 'passed' : 'failed',
        details: { contentType: response.headers['content-type'] }
      });
      
      // Test metrics format
      const hasPrometheusFormat = typeof response.data === 'string' && 
                                  response.data.includes('# HELP') && 
                                  response.data.includes('# TYPE');
      tests.push({
        test: 'Prometheus Format',
        status: hasPrometheusFormat ? 'passed' : 'failed',
        details: { hasHelp: response.data.includes('# HELP'), hasType: response.data.includes('# TYPE') }
      });
      
      // Test custom metrics
      const hasCustomMetrics = response.data.includes('kiro_bot_');
      tests.push({
        test: 'Custom Metrics',
        status: hasCustomMetrics ? 'passed' : 'warning',
        details: { hasCustomMetrics }
      });
      
      const passedTests = tests.filter(t => t.status === 'passed').length;
      
      this.results.tests.metricsEndpoint = {
        status: passedTests >= 3 ? 'passed' : 'warning',
        message: `${passedTests}/${tests.length} metrics tests passed`,
        details: {
          responseTime,
          metricsSize: response.data.length,
          tests
        },
        timestamp: new Date().toISOString()
      };
      
      console.log('✅ Metrics endpoint tested\n');
      
    } catch (error) {
      this.results.tests.metricsEndpoint = {
        status: 'failed',
        message: `Metrics endpoint test failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
      
      console.log('❌ Metrics endpoint test failed\n');
    }
  }

  async testErrorHandling() {
    console.log('🔧 Testing error handling...');
    
    const errorTests = [
      { path: '/health/nonexistent', expectedStatus: 404, name: 'Non-existent endpoint' },
      { path: '/health/../../../etc/passwd', expectedStatus: [400, 404], name: 'Path traversal attempt' }
    ];
    
    const results = [];
    
    for (const test of errorTests) {
      try {
        const response = await axios.get(`${this.config.baseUrl}${test.path}`, {
          timeout: this.config.timeout,
          validateStatus: () => true
        });
        
        const expectedStatuses = Array.isArray(test.expectedStatus) ? test.expectedStatus : [test.expectedStatus];
        const statusOk = expectedStatuses.includes(response.status);
        
        results.push({
          test: test.name,
          status: statusOk ? 'passed' : 'failed',
          httpStatus: response.status,
          expected: test.expectedStatus
        });
        
        const statusIcon = statusOk ? '✅' : '❌';
        console.log(`  ${statusIcon} ${test.name}: ${response.status}`);
        
      } catch (error) {
        results.push({
          test: test.name,
          status: 'failed',
          error: error.message
        });
        
        console.log(`  ❌ ${test.name}: ERROR - ${error.message}`);
      }
    }
    
    const passedTests = results.filter(r => r.status === 'passed').length;
    
    this.results.tests.errorHandling = {
      status: passedTests === errorTests.length ? 'passed' : 'warning',
      message: `${passedTests}/${errorTests.length} error handling tests passed`,
      details: results,
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ Error handling tested\n');
  }

  validateResponseStructure(endpoint, data) {
    if (!data || typeof data !== 'object') return false;
    
    // Basic fields all health endpoints should have
    const hasBasicFields = data.status && data.timestamp;
    
    // Endpoint-specific validation
    switch (endpoint) {
      case '/health/detailed':
        return hasBasicFields && data.uptime !== undefined && data.system;
      case '/health/services':
        return data.timestamp && (data.services || data.systemHealth);
      case '/health/deep':
        return hasBasicFields && (data.checks || data.error);
      default:
        return hasBasicFields;
    }
  }

  async runCommand(command, args) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        cwd: process.cwd(),
        stdio: 'pipe'
      });
      
      let output = '';
      let error = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Command failed with code ${code}: ${error}`));
        }
      });
      
      process.on('error', (err) => {
        reject(err);
      });
    });
  }

  async cleanup() {
    console.log('🧹 Cleaning up...');
    
    if (this.appProcess) {
      try {
        // Gracefully terminate the process
        this.appProcess.kill('SIGTERM');
        
        // Wait a bit for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Force kill if still running
        if (!this.appProcess.killed) {
          this.appProcess.kill('SIGKILL');
        }
        
        console.log('  ✅ Application stopped');
      } catch (error) {
        console.log('  ⚠️  Error stopping application:', error.message);
      }
    }
  }

  async generateReport() {
    console.log('📋 Generating test report...');
    
    // Calculate overall status
    const testResults = Object.values(this.results.tests);
    const passedTests = testResults.filter(t => t.status === 'passed').length;
    const failedTests = testResults.filter(t => t.status === 'failed').length;
    const warningTests = testResults.filter(t => t.status === 'warning').length;
    
    if (failedTests === 0 && warningTests === 0) {
      this.results.overallStatus = 'passed';
    } else if (failedTests === 0) {
      this.results.overallStatus = 'warning';
    } else {
      this.results.overallStatus = 'failed';
    }
    
    this.results.summary = {
      totalTests: testResults.length,
      passed: passedTests,
      failed: failedTests,
      warnings: warningTests,
      errors: this.results.errors.length,
      warningMessages: this.results.warnings.length
    };
    
    // Save report
    const reportPath = path.join(process.cwd(), 'health-endpoints-test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
    
    // Print summary
    console.log('\n📊 HEALTH ENDPOINTS TEST SUMMARY');
    console.log('==================================');
    console.log(`Overall Status: ${this.results.overallStatus.toUpperCase()}`);
    console.log(`Tests Passed: ${passedTests}/${testResults.length}`);
    console.log(`Warnings: ${warningTests}`);
    console.log(`Errors: ${failedTests}`);
    console.log(`Report saved to: ${reportPath}`);
    
    if (this.results.overallStatus === 'passed') {
      console.log('\n✅ All health endpoints are working correctly!');
    } else if (this.results.overallStatus === 'warning') {
      console.log('\n⚠️  Health endpoints are mostly working but have some issues.');
    } else {
      console.log('\n❌ Critical issues found with health endpoints.');
    }
    
    return this.results;
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new HealthEndpointsTester();
  tester.runTests()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Testing failed:', error);
      process.exit(1);
    });
}

module.exports = HealthEndpointsTester;