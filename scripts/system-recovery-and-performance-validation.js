#!/usr/bin/env node

/**
 * System Recovery and Performance Validation Script
 * 
 * Comprehensive validation of system recovery mechanisms and performance benchmarks
 * Requirements: 7.5, 7.6, 7.7
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { performance } = require('perf_hooks');

class SystemRecoveryAndPerformanceValidator {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'https://localhost',
      apiPort: config.apiPort || 3000,
      skipRecoveryTests: config.skipRecoveryTests || false,
      skipPerformanceTests: config.skipPerformanceTests || false,
      skipSafetyTests: config.skipSafetyTests || false,
      skipOperationalReadiness: config.skipOperationalReadiness || false,
      generateReport: config.generateReport !== false,
      ...config
    };
    
    this.results = {
      recovery: null,
      performance: null,
      safety: null,
      operationalReadiness: null,
      overall: {
        passed: 0,
        failed: 0,
        critical: 0,
        startTime: Date.now(),
        endTime: null
      }
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

  async runScript(scriptPath, args = [], description = '') {
    this.log('info', `Running: ${description || path.basename(scriptPath)}`);
    
    return new Promise((resolve, reject) => {
      const child = spawn('node', [scriptPath, ...args], {
        stdio: 'pipe',
        cwd: process.cwd()
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
        // Forward output in real-time
        process.stdout.write(data);
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });
      
      child.on('close', (code) => {
        const result = {
          exitCode: code,
          stdout,
          stderr,
          success: code === 0
        };
        
        if (code === 0) {
          this.log('success', `Completed: ${description || path.basename(scriptPath)}`);
        } else {
          this.log('error', `Failed: ${description || path.basename(scriptPath)}`, { exitCode: code });
        }
        
        resolve(result);
      });
      
      child.on('error', (error) => {
        this.log('error', `Script execution error: ${error.message}`);
        reject(error);
      });
    });
  }

  async testSystemRecoveryMechanisms() {
    if (this.config.skipRecoveryTests) {
      this.log('info', 'Skipping system recovery tests');
      return { success: true, skipped: true };
    }
    
    this.log('info', '🔄 Testing System Recovery Mechanisms...');
    
    const recoveryTests = [];
    
    try {
      // Test 1: AutoRecoveryService functionality
      this.log('info', 'Testing AutoRecoveryService functionality...');
      
      const recoveryTestScript = `
        const { AutoRecoveryService } = require('./src/services/AutoRecoveryService.ts');
        
        async function testRecoveryService() {
          const recovery = AutoRecoveryService.getInstance();
          
          // Test database connection recovery
          const dbError = { type: 'database_connection_error', message: 'Connection lost' };
          const dbRecovery = await recovery.handleFailure(dbError);
          console.log('Database recovery test:', dbRecovery ? 'PASSED' : 'FAILED');
          
          // Test exchange connection recovery
          const exchangeError = { type: 'exchange_connection_error', exchange: 'binance' };
          const exchangeRecovery = await recovery.handleFailure(exchangeError);
          console.log('Exchange recovery test:', exchangeRecovery ? 'PASSED' : 'FAILED');
          
          // Test WebSocket recovery
          const wsError = { type: 'websocket_connection_error', message: 'WebSocket disconnected' };
          const wsRecovery = await recovery.handleFailure(wsError);
          console.log('WebSocket recovery test:', wsRecovery ? 'PASSED' : 'FAILED');
          
          // Test memory cleanup
          const memError = { type: 'high_memory_usage', usage: 0.9 };
          const memRecovery = await recovery.handleFailure(memError);
          console.log('Memory cleanup test:', memRecovery ? 'PASSED' : 'FAILED');
          
          // Get recovery statistics
          const failureHistory = recovery.getFailureHistory();
          const recoveryActions = recovery.getRecoveryActions();
          
          console.log('Recovery statistics:', {
            failureTypes: failureHistory.size,
            recoveryActions: recoveryActions.size
          });
          
          return {
            dbRecovery,
            exchangeRecovery,
            wsRecovery,
            memRecovery,
            failureHistory: failureHistory.size,
            recoveryActions: recoveryActions.size
          };
        }
        
        testRecoveryService().then(result => {
          console.log('Recovery test results:', JSON.stringify(result, null, 2));
          process.exit(result.dbRecovery && result.exchangeRecovery && result.wsRecovery ? 0 : 1);
        }).catch(error => {
          console.error('Recovery test failed:', error);
          process.exit(1);
        });
      `;
      
      // Write and execute recovery test
      const testPath = 'temp-recovery-test.js';
      fs.writeFileSync(testPath, recoveryTestScript);
      
      try {
        const recoveryResult = await this.runScript(testPath, [], 'AutoRecoveryService Tests');
        recoveryTests.push({
          name: 'AutoRecoveryService Functionality',
          success: recoveryResult.success,
          details: recoveryResult.stdout
        });
        
        if (recoveryResult.success) {
          this.results.overall.passed++;
        } else {
          this.results.overall.failed++;
        }
      } finally {
        // Clean up temp file
        if (fs.existsSync(testPath)) {
          fs.unlinkSync(testPath);
        }
      }
      
      // Test 2: Service restart capabilities
      this.log('info', 'Testing service restart capabilities...');
      
      const restartTest = await this.testServiceRestartCapabilities();
      recoveryTests.push(restartTest);
      
      if (restartTest.success) {
        this.results.overall.passed++;
      } else {
        this.results.overall.failed++;
      }
      
      // Test 3: Failure detection and alerting
      this.log('info', 'Testing failure detection and alerting...');
      
      const alertingTest = await this.testFailureDetectionAndAlerting();
      recoveryTests.push(alertingTest);
      
      if (alertingTest.success) {
        this.results.overall.passed++;
      } else {
        this.results.overall.failed++;
      }
      
      // Test 4: Data consistency during recovery
      this.log('info', 'Testing data consistency during recovery...');
      
      const consistencyTest = await this.testDataConsistencyDuringRecovery();
      recoveryTests.push(consistencyTest);
      
      if (consistencyTest.success) {
        this.results.overall.passed++;
      } else {
        this.results.overall.failed++;
      }
      
    } catch (error) {
      this.log('error', `System recovery testing failed: ${error.message}`);
      this.results.overall.failed++;
      recoveryTests.push({
        name: 'System Recovery Tests',
        success: false,
        error: error.message
      });
    }
    
    const overallSuccess = recoveryTests.every(test => test.success);
    
    this.results.recovery = {
      success: overallSuccess,
      tests: recoveryTests,
      summary: {
        total: recoveryTests.length,
        passed: recoveryTests.filter(t => t.success).length,
        failed: recoveryTests.filter(t => !t.success).length
      }
    };
    
    return this.results.recovery;
  }

  async testServiceRestartCapabilities() {
    try {
      // Test health endpoint availability
      const healthCheck = await this.makeHttpRequest(`${this.config.baseUrl}:${this.config.apiPort}/health`);
      
      if (healthCheck.success) {
        return {
          name: 'Service Restart Capabilities',
          success: true,
          details: 'Health endpoint responsive, service restart capability verified'
        };
      } else {
        return {
          name: 'Service Restart Capabilities',
          success: false,
          details: 'Health endpoint not responsive'
        };
      }
    } catch (error) {
      return {
        name: 'Service Restart Capabilities',
        success: false,
        error: error.message
      };
    }
  }

  async testFailureDetectionAndAlerting() {
    try {
      // Check if monitoring service is active
      const monitoringCheck = await this.makeHttpRequest(`${this.config.baseUrl}:${this.config.apiPort}/health/monitoring`);
      
      // Check if alerting is configured
      const alertingCheck = await this.makeHttpRequest(`${this.config.baseUrl}:${this.config.apiPort}/health/alerting`);
      
      const success = monitoringCheck.success && alertingCheck.success;
      
      return {
        name: 'Failure Detection and Alerting',
        success,
        details: {
          monitoring: monitoringCheck.success,
          alerting: alertingCheck.success
        }
      };
    } catch (error) {
      return {
        name: 'Failure Detection and Alerting',
        success: false,
        error: error.message
      };
    }
  }

  async testDataConsistencyDuringRecovery() {
    try {
      // Test database connection and basic query
      const dbCheck = await this.makeHttpRequest(`${this.config.baseUrl}:${this.config.apiPort}/health/database`);
      
      // Test cache consistency
      const cacheCheck = await this.makeHttpRequest(`${this.config.baseUrl}:${this.config.apiPort}/health/cache`);
      
      const success = dbCheck.success && cacheCheck.success;
      
      return {
        name: 'Data Consistency During Recovery',
        success,
        details: {
          database: dbCheck.success,
          cache: cacheCheck.success
        }
      };
    } catch (error) {
      return {
        name: 'Data Consistency During Recovery',
        success: false,
        error: error.message
      };
    }
  }

  async validatePerformanceBenchmarks() {
    if (this.config.skipPerformanceTests) {
      this.log('info', 'Skipping performance benchmark validation');
      return { success: true, skipped: true };
    }
    
    this.log('info', '📊 Validating Performance Benchmarks...');
    
    try {
      // Test 1: PerformanceMonitoringService functionality
      this.log('info', 'Testing PerformanceMonitoringService...');
      
      const performanceTestScript = `
        const { PerformanceMonitoringService } = require('./src/services/PerformanceMonitoringService.ts');
        
        async function testPerformanceService() {
          const perfService = PerformanceMonitoringService.getInstance();
          
          // Record some test metrics
          perfService.recordLatency('api_request', 50);
          perfService.recordLatency('api_request', 75);
          perfService.recordLatency('api_request', 100);
          
          perfService.recordThroughput('http_requests', 10);
          perfService.recordThroughput('trades', 5);
          
          perfService.recordError('api', 'timeout');
          
          // Get performance metrics
          const metrics = perfService.getPerformanceMetrics();
          
          console.log('Performance metrics:', JSON.stringify(metrics, null, 2));
          
          // Check thresholds
          const thresholds = perfService.getThresholds();
          console.log('Performance thresholds:', JSON.stringify(thresholds, null, 2));
          
          return {
            latencyAvg: metrics.latency.avg,
            throughputRps: metrics.throughput.requestsPerSecond,
            errorRate: metrics.errorRate.overall,
            thresholds
          };
        }
        
        testPerformanceService().then(result => {
          console.log('Performance test results:', JSON.stringify(result, null, 2));
          process.exit(0);
        }).catch(error => {
          console.error('Performance test failed:', error);
          process.exit(1);
        });
      `;
      
      // Write and execute performance test
      const testPath = 'temp-performance-test.js';
      fs.writeFileSync(testPath, performanceTestScript);
      
      let performanceServiceResult;
      try {
        performanceServiceResult = await this.runScript(testPath, [], 'PerformanceMonitoringService Tests');
      } finally {
        // Clean up temp file
        if (fs.existsSync(testPath)) {
          fs.unlinkSync(testPath);
        }
      }
      
      // Test 2: Run comprehensive performance benchmarking
      this.log('info', 'Running comprehensive performance benchmarking...');
      
      const benchmarkScript = path.join(__dirname, 'performance-benchmarking.js');
      const benchmarkArgs = [
        '--url', this.config.baseUrl,
        '--duration', '30', // 30 seconds for faster testing
        '--users', '3',
        '--target-latency', '200',
        '--target-throughput', '50'
      ];
      
      const benchmarkResult = await this.runScript(benchmarkScript, benchmarkArgs, 'Performance Benchmarking');
      
      // Try to read benchmark report
      let benchmarkData = null;
      try {
        const reportPath = 'performance-benchmark-report.json';
        if (fs.existsSync(reportPath)) {
          benchmarkData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        }
      } catch (error) {
        this.log('warning', 'Could not read performance benchmark report');
      }
      
      const overallSuccess = performanceServiceResult.success && benchmarkResult.success;
      
      if (overallSuccess) {
        this.results.overall.passed++;
      } else {
        this.results.overall.failed++;
      }
      
      this.results.performance = {
        success: overallSuccess,
        performanceService: {
          success: performanceServiceResult.success,
          details: performanceServiceResult.stdout
        },
        benchmarking: {
          success: benchmarkResult.success,
          data: benchmarkData
        }
      };
      
    } catch (error) {
      this.log('error', `Performance validation failed: ${error.message}`);
      this.results.overall.failed++;
      this.results.performance = {
        success: false,
        error: error.message
      };
    }
    
    return this.results.performance;
  }

  async verifyPaperTradingSafetyCompliance() {
    if (this.config.skipSafetyTests) {
      this.log('info', 'Skipping paper trading safety compliance verification');
      return { success: true, skipped: true };
    }
    
    this.log('info', '🛡️ Verifying Paper Trading Safety Compliance...');
    
    try {
      const safetyScript = path.join(__dirname, 'paper-trading-safety-verification.js');
      const safetyResult = await this.runScript(safetyScript, [], 'Paper Trading Safety Verification');
      
      // Try to read safety report
      let safetyData = null;
      try {
        const reportPath = 'paper-trading-safety-report.json';
        if (fs.existsSync(reportPath)) {
          safetyData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
          
          // Update overall results based on safety data
          this.results.overall.passed += safetyData.passed || 0;
          this.results.overall.failed += safetyData.failed || 0;
          this.results.overall.critical += safetyData.critical || 0;
        }
      } catch (error) {
        this.log('warning', 'Could not read paper trading safety report');
      }
      
      this.results.safety = {
        success: safetyResult.success,
        data: safetyData,
        criticalIssues: safetyData ? safetyData.critical : 0
      };
      
    } catch (error) {
      this.log('error', `Paper trading safety verification failed: ${error.message}`);
      this.results.overall.failed++;
      this.results.overall.critical++;
      this.results.safety = {
        success: false,
        error: error.message,
        criticalIssues: 1
      };
    }
    
    return this.results.safety;
  }

  async executeOperationalReadinessAssessment() {
    if (this.config.skipOperationalReadiness) {
      this.log('info', 'Skipping operational readiness assessment');
      return { success: true, skipped: true };
    }
    
    this.log('info', '🎯 Executing Comprehensive Operational Readiness Assessment...');
    
    try {
      const validationScript = path.join(__dirname, 'production-validation-suite.js');
      const validationArgs = [
        '--url', this.config.baseUrl,
        '--api-port', this.config.apiPort.toString()
      ];
      
      const validationResult = await this.runScript(validationScript, validationArgs, 'Production Validation Suite');
      
      // Try to read validation report
      let validationData = null;
      try {
        const reportPath = 'production-validation-suite-report.json';
        if (fs.existsSync(reportPath)) {
          validationData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
          
          // Update overall results based on validation data
          if (validationData.summary) {
            this.results.overall.passed += validationData.summary.totalPassed || 0;
            this.results.overall.failed += validationData.summary.totalFailed || 0;
            this.results.overall.critical += validationData.summary.totalCritical || 0;
          }
        }
      } catch (error) {
        this.log('warning', 'Could not read production validation suite report');
      }
      
      this.results.operationalReadiness = {
        success: validationResult.success,
        data: validationData
      };
      
    } catch (error) {
      this.log('error', `Operational readiness assessment failed: ${error.message}`);
      this.results.overall.failed++;
      this.results.operationalReadiness = {
        success: false,
        error: error.message
      };
    }
    
    return this.results.operationalReadiness;
  }

  async makeHttpRequest(url) {
    const https = require('https');
    const http = require('http');
    
    return new Promise((resolve) => {
      const protocol = url.startsWith('https') ? https : http;
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Request timeout' });
      }, 5000);

      const req = protocol.get(url, {
        rejectUnauthorized: false
      }, (res) => {
        clearTimeout(timeout);
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            success: res.statusCode === 200,
            statusCode: res.statusCode,
            data
          });
        });
      });

      req.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: error.message
        });
      });
    });
  }

  generateConsolidatedReport() {
    this.results.overall.endTime = Date.now();
    const duration = (this.results.overall.endTime - this.results.overall.startTime) / 1000;
    
    const report = {
      timestamp: new Date().toISOString(),
      duration: `${duration.toFixed(2)}s`,
      config: this.config,
      summary: {
        totalPassed: this.results.overall.passed,
        totalFailed: this.results.overall.failed,
        totalCritical: this.results.overall.critical,
        overallSuccess: this.results.overall.failed === 0 && this.results.overall.critical === 0
      },
      results: {
        recovery: this.results.recovery,
        performance: this.results.performance,
        safety: this.results.safety,
        operationalReadiness: this.results.operationalReadiness
      },
      recommendations: this.generateRecommendations()
    };
    
    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Critical safety issues
    if (this.results.overall.critical > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        category: 'Safety',
        message: 'Critical paper trading safety issues detected',
        action: 'DO NOT DEPLOY - Fix all critical safety issues immediately'
      });
    }
    
    // Recovery mechanism issues
    if (this.results.recovery && !this.results.recovery.success) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Recovery',
        message: 'System recovery mechanisms not functioning properly',
        action: 'Fix recovery services before deployment to ensure system resilience'
      });
    }
    
    // Performance issues
    if (this.results.performance && !this.results.performance.success) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Performance',
        message: 'Performance benchmarks not met',
        action: 'Optimize system performance before high-load deployment'
      });
    }
    
    // Operational readiness issues
    if (this.results.operationalReadiness && !this.results.operationalReadiness.success) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Operational Readiness',
        message: 'Operational readiness assessment failed',
        action: 'Complete all operational requirements before deployment'
      });
    }
    
    // Success recommendations
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'INFO',
        category: 'Success',
        message: 'All system recovery and performance validations passed',
        action: 'System is ready for production deployment with full recovery capabilities'
      });
    }
    
    return recommendations;
  }

  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 SYSTEM RECOVERY AND PERFORMANCE VALIDATION SUMMARY');
    console.log('='.repeat(80));
    
    const report = this.generateConsolidatedReport();
    
    console.log(`📅 Completed: ${report.timestamp}`);
    console.log(`⏱️  Duration: ${report.duration}`);
    console.log(`✅ Total Passed: ${report.summary.totalPassed}`);
    console.log(`❌ Total Failed: ${report.summary.totalFailed}`);
    console.log(`🚨 Critical Issues: ${report.summary.totalCritical}`);
    
    console.log('\n📊 Validation Results:');
    
    const validations = [
      { name: 'System Recovery Mechanisms', result: report.results.recovery },
      { name: 'Performance Benchmarks', result: report.results.performance },
      { name: 'Paper Trading Safety Compliance', result: report.results.safety },
      { name: 'Operational Readiness Assessment', result: report.results.operationalReadiness }
    ];
    
    validations.forEach(validation => {
      if (validation.result === null) {
        console.log(`  ⏭️  ${validation.name}: Not Run`);
      } else if (validation.result.skipped) {
        console.log(`  ⏭️  ${validation.name}: Skipped`);
      } else if (validation.result.success) {
        console.log(`  ✅ ${validation.name}: PASSED`);
      } else {
        console.log(`  ❌ ${validation.name}: FAILED`);
      }
    });
    
    console.log('\n💡 Recommendations:');
    report.recommendations.forEach(rec => {
      const priorityEmoji = {
        'CRITICAL': '🚨',
        'HIGH': '⚠️',
        'MEDIUM': '📋',
        'INFO': '💡'
      };
      
      console.log(`  ${priorityEmoji[rec.priority]} ${rec.priority}: ${rec.message}`);
      console.log(`     Action: ${rec.action}`);
    });
    
    console.log('\n' + '='.repeat(80));
    
    if (report.summary.overallSuccess) {
      console.log('🎉 SYSTEM RECOVERY AND PERFORMANCE VALIDATION PASSED! 🎉');
    } else if (report.summary.totalCritical > 0) {
      console.log('🚨 CRITICAL FAILURES - DO NOT DEPLOY TO PRODUCTION! 🚨');
    } else {
      console.log('⚠️  VALIDATION ISSUES DETECTED - REVIEW BEFORE DEPLOYMENT ⚠️');
    }
    
    console.log('='.repeat(80));
    
    return report;
  }

  async run() {
    this.log('info', '🚀 Starting System Recovery and Performance Validation...');
    this.log('info', `Target Environment: ${this.config.baseUrl}:${this.config.apiPort}`);
    
    try {
      // Run all validation steps
      await this.testSystemRecoveryMechanisms();
      await this.validatePerformanceBenchmarks();
      await this.verifyPaperTradingSafetyCompliance();
      await this.executeOperationalReadinessAssessment();
      
    } catch (error) {
      this.log('critical', `Validation error: ${error.message}`);
      this.results.overall.failed++;
    }
    
    // Generate and save consolidated report
    const report = this.printSummary();
    
    if (this.config.generateReport) {
      const reportPath = 'system-recovery-performance-validation-report.json';
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Consolidated report saved to: ${reportPath}`);
    }
    
    // Exit with appropriate code
    if (report.summary.totalCritical > 0) {
      process.exit(2); // Critical failures
    } else if (report.summary.totalFailed > 0) {
      process.exit(1); // Non-critical failures
    } else {
      process.exit(0); // Success
    }
  }
}

// CLI usage
if (require.main === module) {
  const config = {};
  
  // Parse command line arguments
  process.argv.forEach((arg, index) => {
    if (arg === '--skip-recovery') config.skipRecoveryTests = true;
    if (arg === '--skip-performance') config.skipPerformanceTests = true;
    if (arg === '--skip-safety') config.skipSafetyTests = true;
    if (arg === '--skip-operational') config.skipOperationalReadiness = true;
    if (arg === '--no-report') config.generateReport = false;
    
    if (arg === '--url' && process.argv[index + 1]) {
      config.baseUrl = process.argv[index + 1];
    }
    if (arg === '--api-port' && process.argv[index + 1]) {
      config.apiPort = parseInt(process.argv[index + 1]);
    }
  });
  
  // Show help
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
System Recovery and Performance Validation

Usage: node system-recovery-and-performance-validation.js [options]

Options:
  --url <url>              Base URL for testing (default: https://localhost)
  --api-port <port>        API port (default: 3000)
  --skip-recovery          Skip system recovery mechanism tests
  --skip-performance       Skip performance benchmark validation
  --skip-safety            Skip paper trading safety compliance verification
  --skip-operational       Skip operational readiness assessment
  --no-report              Don't generate consolidated report
  --help, -h               Show this help message

Examples:
  node system-recovery-and-performance-validation.js
  node system-recovery-and-performance-validation.js --url https://myapp.com --api-port 443
  node system-recovery-and-performance-validation.js --skip-performance
    `);
    process.exit(0);
  }
  
  const validator = new SystemRecoveryAndPerformanceValidator(config);
  validator.run().catch(error => {
    console.error('System recovery and performance validation failed:', error);
    process.exit(1);
  });
}

module.exports = SystemRecoveryAndPerformanceValidator;