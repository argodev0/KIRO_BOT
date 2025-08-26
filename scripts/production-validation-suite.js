#!/usr/bin/env node

/**
 * Production Validation Suite
 * 
 * Master script that orchestrates all production validation and testing
 * Requirements: 3.7, 5.5, 7.2, 7.3, 7.4, 7.5, 7.7
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

class ProductionValidationSuite {
  constructor(config = {}) {
    this.config = {
      skipReadiness: config.skipReadiness || false,
      skipSafety: config.skipSafety || false,
      skipSmokeTests: config.skipSmokeTests || false,
      skipPerformance: config.skipPerformance || false,
      baseUrl: config.baseUrl || 'https://localhost',
      apiPort: config.apiPort || 3000,
      frontendPort: config.frontendPort || 3002,
      generateReport: config.generateReport !== false,
      ...config
    };
    
    this.results = {
      readiness: null,
      safety: null,
      smokeTests: null,
      performance: null,
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

  async runProductionReadinessValidation() {
    if (this.config.skipReadiness) {
      this.log('info', 'Skipping production readiness validation');
      return { success: true, skipped: true };
    }
    
    this.log('info', '🚀 Starting Production Readiness Validation...');
    
    const scriptPath = path.join(__dirname, 'production-readiness-validation.js');
    if (!fs.existsSync(scriptPath)) {
      this.log('error', 'Production readiness validation script not found');
      return { success: false, error: 'Script not found' };
    }
    
    const result = await this.runScript(scriptPath, [], 'Production Readiness Validation');
    
    // Try to read the generated report
    try {
      const reportPath = 'production-readiness-report.json';
      if (fs.existsSync(reportPath)) {
        const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        result.reportData = reportData;
        
        this.results.overall.passed += reportData.passed || 0;
        this.results.overall.failed += reportData.failed || 0;
      }
    } catch (error) {
      this.log('warning', 'Could not read readiness validation report');
    }
    
    this.results.readiness = result;
    return result;
  }

  async runPaperTradingSafetyVerification() {
    if (this.config.skipSafety) {
      this.log('info', 'Skipping paper trading safety verification');
      return { success: true, skipped: true };
    }
    
    this.log('info', '🛡️ Starting Paper Trading Safety Verification...');
    
    const scriptPath = path.join(__dirname, 'paper-trading-safety-verification.js');
    if (!fs.existsSync(scriptPath)) {
      this.log('error', 'Paper trading safety verification script not found');
      return { success: false, error: 'Script not found' };
    }
    
    const result = await this.runScript(scriptPath, [], 'Paper Trading Safety Verification');
    
    // Try to read the generated report
    try {
      const reportPath = 'paper-trading-safety-report.json';
      if (fs.existsSync(reportPath)) {
        const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        result.reportData = reportData;
        
        this.results.overall.passed += reportData.passed || 0;
        this.results.overall.failed += reportData.failed || 0;
        this.results.overall.critical += reportData.critical || 0;
      }
    } catch (error) {
      this.log('warning', 'Could not read safety verification report');
    }
    
    this.results.safety = result;
    return result;
  }

  async runProductionSmokeTests() {
    if (this.config.skipSmokeTests) {
      this.log('info', 'Skipping production smoke tests');
      return { success: true, skipped: true };
    }
    
    this.log('info', '🧪 Starting Production Smoke Tests...');
    
    const scriptPath = path.join(__dirname, 'production-smoke-tests.js');
    if (!fs.existsSync(scriptPath)) {
      this.log('error', 'Production smoke tests script not found');
      return { success: false, error: 'Script not found' };
    }
    
    const args = [
      '--url', this.config.baseUrl,
      '--api-port', this.config.apiPort.toString(),
      '--frontend-port', this.config.frontendPort.toString()
    ];
    
    const result = await this.runScript(scriptPath, args, 'Production Smoke Tests');
    
    // Try to read the generated report
    try {
      const reportPath = 'production-smoke-test-report.json';
      if (fs.existsSync(reportPath)) {
        const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        result.reportData = reportData;
        
        this.results.overall.passed += reportData.passed || 0;
        this.results.overall.failed += reportData.failed || 0;
      }
    } catch (error) {
      this.log('warning', 'Could not read smoke test report');
    }
    
    this.results.smokeTests = result;
    return result;
  }

  async runPerformanceBenchmarking() {
    if (this.config.skipPerformance) {
      this.log('info', 'Skipping performance benchmarking');
      return { success: true, skipped: true };
    }
    
    this.log('info', '📊 Starting Performance Benchmarking...');
    
    const scriptPath = path.join(__dirname, 'performance-benchmarking.js');
    if (!fs.existsSync(scriptPath)) {
      this.log('error', 'Performance benchmarking script not found');
      return { success: false, error: 'Script not found' };
    }
    
    const args = [
      '--url', this.config.baseUrl,
      '--duration', '60', // 60 seconds
      '--users', '5', // 5 concurrent users for testing
      '--target-latency', '100',
      '--target-throughput', '100'
    ];
    
    const result = await this.runScript(scriptPath, args, 'Performance Benchmarking');
    
    // Try to read the generated report
    try {
      const reportPath = 'performance-benchmark-report.json';
      if (fs.existsSync(reportPath)) {
        const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        result.reportData = reportData;
        
        if (reportData.summary) {
          this.results.overall.passed += reportData.summary.passed || 0;
          this.results.overall.failed += reportData.summary.failed || 0;
        }
      }
    } catch (error) {
      this.log('warning', 'Could not read performance benchmark report');
    }
    
    this.results.performance = result;
    return result;
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
        readiness: this.results.readiness ? {
          success: this.results.readiness.success,
          skipped: this.results.readiness.skipped || false,
          reportData: this.results.readiness.reportData || null
        } : null,
        safety: this.results.safety ? {
          success: this.results.safety.success,
          skipped: this.results.safety.skipped || false,
          reportData: this.results.safety.reportData || null
        } : null,
        smokeTests: this.results.smokeTests ? {
          success: this.results.smokeTests.success,
          skipped: this.results.smokeTests.skipped || false,
          reportData: this.results.smokeTests.reportData || null
        } : null,
        performance: this.results.performance ? {
          success: this.results.performance.success,
          skipped: this.results.performance.skipped || false,
          reportData: this.results.performance.reportData || null
        } : null
      },
      recommendations: this.generateRecommendations()
    };
    
    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Check for critical safety issues
    if (this.results.overall.critical > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        category: 'Safety',
        message: 'Critical paper trading safety issues detected',
        action: 'DO NOT DEPLOY - Fix all critical safety issues immediately'
      });
    }
    
    // Check for failed validations
    if (this.results.readiness && !this.results.readiness.success) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Readiness',
        message: 'Production readiness validation failed',
        action: 'Review and fix configuration issues before deployment'
      });
    }
    
    if (this.results.safety && !this.results.safety.success) {
      recommendations.push({
        priority: 'CRITICAL',
        category: 'Safety',
        message: 'Paper trading safety verification failed',
        action: 'Fix all safety mechanisms before proceeding'
      });
    }
    
    if (this.results.smokeTests && !this.results.smokeTests.success) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Functionality',
        message: 'Production smoke tests failed',
        action: 'Investigate and fix failing endpoints/features'
      });
    }
    
    if (this.results.performance && !this.results.performance.success) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Performance',
        message: 'Performance benchmarks not met',
        action: 'Optimize system performance before high-load deployment'
      });
    }
    
    // Success recommendations
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'INFO',
        category: 'Success',
        message: 'All validation tests passed',
        action: 'System is ready for production deployment'
      });
    }
    
    return recommendations;
  }

  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 PRODUCTION VALIDATION SUITE SUMMARY');
    console.log('='.repeat(80));
    
    const report = this.generateConsolidatedReport();
    
    console.log(`📅 Completed: ${report.timestamp}`);
    console.log(`⏱️  Duration: ${report.duration}`);
    console.log(`✅ Total Passed: ${report.summary.totalPassed}`);
    console.log(`❌ Total Failed: ${report.summary.totalFailed}`);
    console.log(`🚨 Critical Issues: ${report.summary.totalCritical}`);
    
    console.log('\n📊 Test Results:');
    
    const tests = [
      { name: 'Production Readiness', result: report.results.readiness },
      { name: 'Paper Trading Safety', result: report.results.safety },
      { name: 'Smoke Tests', result: report.results.smokeTests },
      { name: 'Performance Benchmarks', result: report.results.performance }
    ];
    
    tests.forEach(test => {
      if (test.result === null) {
        console.log(`  ⏭️  ${test.name}: Not Run`);
      } else if (test.result.skipped) {
        console.log(`  ⏭️  ${test.name}: Skipped`);
      } else if (test.result.success) {
        console.log(`  ✅ ${test.name}: PASSED`);
      } else {
        console.log(`  ❌ ${test.name}: FAILED`);
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
      console.log('🎉 VALIDATION SUITE PASSED - READY FOR PRODUCTION! 🎉');
    } else if (report.summary.totalCritical > 0) {
      console.log('🚨 CRITICAL FAILURES - DO NOT DEPLOY TO PRODUCTION! 🚨');
    } else {
      console.log('⚠️  VALIDATION ISSUES DETECTED - REVIEW BEFORE DEPLOYMENT ⚠️');
    }
    
    console.log('='.repeat(80));
    
    return report;
  }

  async run() {
    this.log('info', '🚀 Starting Production Validation Suite...');
    this.log('info', `Target Environment: ${this.config.baseUrl}:${this.config.apiPort}`);
    
    try {
      // Run all validation steps
      await this.runProductionReadinessValidation();
      await this.runPaperTradingSafetyVerification();
      await this.runProductionSmokeTests();
      await this.runPerformanceBenchmarking();
      
    } catch (error) {
      this.log('critical', `Validation suite error: ${error.message}`);
      this.results.overall.failed++;
    }
    
    // Generate and save consolidated report
    const report = this.printSummary();
    
    if (this.config.generateReport) {
      const reportPath = 'production-validation-suite-report.json';
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
    if (arg === '--skip-readiness') config.skipReadiness = true;
    if (arg === '--skip-safety') config.skipSafety = true;
    if (arg === '--skip-smoke-tests') config.skipSmokeTests = true;
    if (arg === '--skip-performance') config.skipPerformance = true;
    if (arg === '--no-report') config.generateReport = false;
    
    if (arg === '--url' && process.argv[index + 1]) {
      config.baseUrl = process.argv[index + 1];
    }
    if (arg === '--api-port' && process.argv[index + 1]) {
      config.apiPort = parseInt(process.argv[index + 1]);
    }
    if (arg === '--frontend-port' && process.argv[index + 1]) {
      config.frontendPort = parseInt(process.argv[index + 1]);
    }
  });
  
  // Show help
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Production Validation Suite

Usage: node production-validation-suite.js [options]

Options:
  --url <url>              Base URL for testing (default: https://localhost)
  --api-port <port>        API port (default: 3000)
  --frontend-port <port>   Frontend port (default: 3002)
  --skip-readiness         Skip production readiness validation
  --skip-safety            Skip paper trading safety verification
  --skip-smoke-tests       Skip production smoke tests
  --skip-performance       Skip performance benchmarking
  --no-report              Don't generate consolidated report
  --help, -h               Show this help message

Examples:
  node production-validation-suite.js
  node production-validation-suite.js --url https://myapp.com --api-port 443
  node production-validation-suite.js --skip-performance
    `);
    process.exit(0);
  }
  
  const suite = new ProductionValidationSuite(config);
  suite.run().catch(error => {
    console.error('Production validation suite failed:', error);
    process.exit(1);
  });
}

module.exports = ProductionValidationSuite;