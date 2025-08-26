#!/usr/bin/env node

/**
 * Comprehensive Pre-Deployment Testing Script
 * 
 * Executes all required testing phases before production deployment
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class PreDeploymentTester {
  constructor() {
    this.results = {
      phases: {},
      summary: {
        totalPhases: 0,
        passedPhases: 0,
        failedPhases: 0,
        criticalFailures: 0
      },
      startTime: new Date(),
      endTime: null
    };
    
    this.testPhases = [
      {
        name: 'Unit Tests',
        description: 'Execute complete unit test suite with 100% pass requirement',
        command: 'npm run test:unit',
        critical: true,
        requirement: '3.1'
      },
      {
        name: 'Integration Tests',
        description: 'Run integration tests for all service interactions',
        command: 'npm run test:integration',
        critical: true,
        requirement: '3.2'
      },
      {
        name: 'Security Tests',
        description: 'Perform security testing and vulnerability validation',
        command: 'npm run test:security',
        critical: true,
        requirement: '3.3'
      },
      {
        name: 'Paper Trading Safety Tests',
        description: 'Execute paper trading safety tests to ensure no real money risk',
        command: 'npm run test:paper-trading',
        critical: true,
        requirement: '3.4'
      },
      {
        name: 'Frontend Tests',
        description: 'Test frontend components and user interface',
        command: 'npm run test:frontend',
        critical: false,
        requirement: '3.2'
      },
      {
        name: 'End-to-End Tests',
        description: 'Execute end-to-end user workflow tests',
        command: 'npm run test:e2e',
        critical: false,
        requirement: '3.2'
      },
      {
        name: 'Performance Tests',
        description: 'Run performance benchmarks and load tests',
        command: 'npm run test:benchmark',
        critical: false,
        requirement: '3.1'
      }
    ];
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      'info': 'ℹ️',
      'success': '✅',
      'warning': '⚠️',
      'error': '❌',
      'critical': '🚨'
    }[level] || 'ℹ️';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async validateEnvironment() {
    this.log('🔍 Validating test environment...');
    
    try {
      // Check Node.js version
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      if (majorVersion < 18) {
        throw new Error(`Node.js version ${nodeVersion} is too old. Requires >=18.0.0`);
      }
      
      this.log(`Node.js version: ${nodeVersion} ✓`);
      
      // Check if dependencies are installed
      if (!fs.existsSync('node_modules')) {
        this.log('Installing dependencies...', 'warning');
        execSync('npm install', { stdio: 'inherit' });
      }
      
      // Check if build is successful
      this.log('Verifying TypeScript compilation...');
      execSync('npm run build:backend', { stdio: 'pipe' });
      this.log('TypeScript compilation successful ✓');
      
      // Check test configuration
      if (!fs.existsSync('jest.config.js')) {
        throw new Error('Jest configuration not found');
      }
      
      this.log('Test environment validation complete ✓');
      return true;
      
    } catch (error) {
      this.log(`Environment validation failed: ${error.message}`, 'critical');
      throw error;
    }
  }

  async runTestPhase(phase) {
    this.log(`🧪 Starting ${phase.name}...`);
    this.log(`   Description: ${phase.description}`);
    this.log(`   Requirement: ${phase.requirement}`);
    this.log(`   Critical: ${phase.critical ? 'Yes' : 'No'}`);
    
    const startTime = Date.now();
    
    try {
      // Execute test command with timeout
      const result = await this.executeCommand(phase.command, {
        timeout: 300000, // 5 minutes timeout
        stdio: 'pipe'
      });
      
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      // Parse test results
      const testResults = this.parseTestOutput(result.stdout, result.stderr);
      
      const phaseResult = {
        name: phase.name,
        description: phase.description,
        requirement: phase.requirement,
        critical: phase.critical,
        status: 'passed',
        duration: `${duration}s`,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        testResults,
        output: result.stdout,
        errors: result.stderr
      };
      
      this.results.phases[phase.name] = phaseResult;
      this.results.summary.passedPhases++;
      
      this.log(`✅ ${phase.name} completed successfully in ${duration}s`, 'success');
      this.log(`   Tests: ${testResults.passed}/${testResults.total} passed`);
      
      if (testResults.failed > 0) {
        this.log(`   Failed tests: ${testResults.failed}`, 'warning');
      }
      
      return phaseResult;
      
    } catch (error) {
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      const phaseResult = {
        name: phase.name,
        description: phase.description,
        requirement: phase.requirement,
        critical: phase.critical,
        status: 'failed',
        duration: `${duration}s`,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        error: error.message,
        output: error.stdout || '',
        errors: error.stderr || ''
      };
      
      this.results.phases[phase.name] = phaseResult;
      this.results.summary.failedPhases++;
      
      if (phase.critical) {
        this.results.summary.criticalFailures++;
        this.log(`🚨 CRITICAL FAILURE: ${phase.name} failed in ${duration}s`, 'critical');
        this.log(`   Error: ${error.message}`, 'critical');
      } else {
        this.log(`⚠️ ${phase.name} failed in ${duration}s`, 'warning');
        this.log(`   Error: ${error.message}`, 'warning');
      }
      
      return phaseResult;
    }
  }

  async executeCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn('sh', ['-c', command], {
        stdio: 'pipe',
        ...options
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Command timeout: ${command}`));
      }, options.timeout || 300000);
      
      child.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          const error = new Error(`Command failed with code ${code}: ${command}`);
          error.stdout = stdout;
          error.stderr = stderr;
          error.code = code;
          reject(error);
        }
      });
      
      child.on('error', (error) => {
        clearTimeout(timeout);
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      });
    });
  }

  parseTestOutput(stdout, stderr) {
    const output = stdout + stderr;
    
    // Jest output parsing
    const jestSummaryMatch = output.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    if (jestSummaryMatch) {
      return {
        failed: parseInt(jestSummaryMatch[1]),
        passed: parseInt(jestSummaryMatch[2]),
        total: parseInt(jestSummaryMatch[3])
      };
    }
    
    // Alternative Jest format
    const jestAltMatch = output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    if (jestAltMatch) {
      return {
        failed: 0,
        passed: parseInt(jestAltMatch[1]),
        total: parseInt(jestAltMatch[2])
      };
    }
    
    // Generic test result parsing
    const passedMatch = output.match(/(\d+)\s+passing/i);
    const failedMatch = output.match(/(\d+)\s+failing/i);
    
    const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
    const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
    
    return {
      passed,
      failed,
      total: passed + failed
    };
  }

  async runPaperTradingSafetyVerification() {
    this.log('🛡️ Running comprehensive paper trading safety verification...');
    
    try {
      const safetyScript = path.join(__dirname, 'paper-trading-safety-verification.js');
      
      if (!fs.existsSync(safetyScript)) {
        throw new Error('Paper trading safety verification script not found');
      }
      
      const result = await this.executeCommand(`node ${safetyScript}`, {
        timeout: 120000 // 2 minutes
      });
      
      this.log('✅ Paper trading safety verification completed', 'success');
      
      // Check if safety report was generated
      const reportPath = 'paper-trading-safety-report.json';
      if (fs.existsSync(reportPath)) {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        
        if (report.critical > 0) {
          throw new Error(`Critical safety issues detected: ${report.critical}`);
        }
        
        this.log(`   Safety score: ${((report.passed / (report.passed + report.failed + report.critical)) * 100).toFixed(1)}%`);
      }
      
      return result;
      
    } catch (error) {
      this.log(`🚨 Paper trading safety verification failed: ${error.message}`, 'critical');
      throw error;
    }
  }

  async runPerformanceBenchmarks() {
    this.log('📊 Running performance benchmarks...');
    
    try {
      const benchmarkScript = path.join(__dirname, 'performance-benchmarking.js');
      
      if (!fs.existsSync(benchmarkScript)) {
        this.log('Performance benchmark script not found, skipping...', 'warning');
        return null;
      }
      
      const result = await this.executeCommand(`node ${benchmarkScript} --duration 30`, {
        timeout: 120000 // 2 minutes
      });
      
      this.log('✅ Performance benchmarks completed', 'success');
      
      // Check if benchmark report was generated
      const reportPath = 'performance-benchmark-report.json';
      if (fs.existsSync(reportPath)) {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        this.log(`   Success rate: ${report.summary.successRate}%`);
      }
      
      return result;
      
    } catch (error) {
      this.log(`⚠️ Performance benchmarks failed: ${error.message}`, 'warning');
      return null;
    }
  }

  async runSystemValidation() {
    this.log('🔍 Running system validation...');
    
    try {
      const validationScript = path.join(__dirname, 'system-validation.js');
      
      if (!fs.existsSync(validationScript)) {
        this.log('System validation script not found, skipping...', 'warning');
        return null;
      }
      
      const result = await this.executeCommand(`node ${validationScript}`, {
        timeout: 180000 // 3 minutes
      });
      
      this.log('✅ System validation completed', 'success');
      return result;
      
    } catch (error) {
      this.log(`⚠️ System validation failed: ${error.message}`, 'warning');
      return null;
    }
  }

  generateComprehensiveReport() {
    this.results.endTime = new Date();
    this.results.summary.totalPhases = this.testPhases.length;
    
    const duration = ((this.results.endTime - this.results.startTime) / 1000 / 60).toFixed(2);
    
    console.log('\n' + '='.repeat(80));
    console.log('📋 COMPREHENSIVE PRE-DEPLOYMENT TESTING REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Test Phases: ${this.results.summary.totalPhases}`);
    console.log(`   Passed Phases: ${this.results.summary.passedPhases}`);
    console.log(`   Failed Phases: ${this.results.summary.failedPhases}`);
    console.log(`   Critical Failures: ${this.results.summary.criticalFailures}`);
    console.log(`   Success Rate: ${((this.results.summary.passedPhases / this.results.summary.totalPhases) * 100).toFixed(1)}%`);
    console.log(`   Total Duration: ${duration} minutes`);
    
    console.log(`\n📝 PHASE DETAILS:`);
    for (const [phaseName, phaseResult] of Object.entries(this.results.phases)) {
      const status = phaseResult.status === 'passed' ? '✅' : '❌';
      const critical = phaseResult.critical ? '🚨' : '';
      
      console.log(`   ${status} ${critical} ${phaseName} (${phaseResult.duration})`);
      console.log(`      Requirement: ${phaseResult.requirement}`);
      
      if (phaseResult.testResults) {
        console.log(`      Tests: ${phaseResult.testResults.passed}/${phaseResult.testResults.total} passed`);
      }
      
      if (phaseResult.status === 'failed') {
        console.log(`      Error: ${phaseResult.error}`);
      }
    }
    
    // Show critical failures
    if (this.results.summary.criticalFailures > 0) {
      console.log(`\n🚨 CRITICAL FAILURES:`);
      for (const [phaseName, phaseResult] of Object.entries(this.results.phases)) {
        if (phaseResult.critical && phaseResult.status === 'failed') {
          console.log(`   ❌ ${phaseName}: ${phaseResult.error}`);
        }
      }
    }
    
    // Generate recommendations
    const recommendations = this.generateRecommendations();
    if (recommendations.length > 0) {
      console.log(`\n💡 RECOMMENDATIONS:`);
      recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }
    
    // Save detailed report
    const reportPath = 'comprehensive-pre-deployment-test-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    return this.results;
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.results.summary.criticalFailures > 0) {
      recommendations.push('Fix all critical test failures before proceeding with deployment');
    }
    
    if (this.results.summary.failedPhases > 0) {
      recommendations.push('Review and address all failed test phases');
    }
    
    const unitTestResult = this.results.phases['Unit Tests'];
    if (unitTestResult && unitTestResult.status === 'failed') {
      recommendations.push('Unit tests must pass with 100% success rate - fix failing unit tests');
    }
    
    const securityTestResult = this.results.phases['Security Tests'];
    if (securityTestResult && securityTestResult.status === 'failed') {
      recommendations.push('Security vulnerabilities detected - address all security issues');
    }
    
    const paperTradingResult = this.results.phases['Paper Trading Safety Tests'];
    if (paperTradingResult && paperTradingResult.status === 'failed') {
      recommendations.push('Paper trading safety issues detected - ensure no real money risk');
    }
    
    if (this.results.summary.passedPhases === this.results.summary.totalPhases) {
      recommendations.push('All tests passed - system is ready for deployment');
    }
    
    return recommendations;
  }

  async run() {
    console.log('🚀 Starting Comprehensive Pre-Deployment Testing...\n');
    console.log(`Test phases: ${this.testPhases.length}`);
    console.log(`Start time: ${this.results.startTime.toISOString()}\n`);
    
    try {
      // Phase 0: Environment validation
      await this.validateEnvironment();
      
      // Phase 1: Run all test phases
      for (const phase of this.testPhases) {
        await this.runTestPhase(phase);
        
        // Stop on critical failures if specified
        if (phase.critical && this.results.phases[phase.name].status === 'failed') {
          this.log(`🚨 Critical test phase failed: ${phase.name}`, 'critical');
          this.log('Stopping execution due to critical failure', 'critical');
          break;
        }
        
        // Small delay between phases
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Phase 2: Additional safety and performance checks
      try {
        await this.runPaperTradingSafetyVerification();
      } catch (error) {
        this.log(`Paper trading safety verification failed: ${error.message}`, 'critical');
        this.results.summary.criticalFailures++;
      }
      
      try {
        await this.runPerformanceBenchmarks();
      } catch (error) {
        this.log(`Performance benchmarks failed: ${error.message}`, 'warning');
      }
      
      try {
        await this.runSystemValidation();
      } catch (error) {
        this.log(`System validation failed: ${error.message}`, 'warning');
      }
      
    } catch (error) {
      this.log(`Fatal error during testing: ${error.message}`, 'critical');
      this.results.summary.criticalFailures++;
    }
    
    // Generate comprehensive report
    const report = this.generateComprehensiveReport();
    
    // Determine exit status
    if (report.summary.criticalFailures > 0) {
      console.log('\n🚨 CRITICAL FAILURES DETECTED - DO NOT DEPLOY!');
      console.log('Fix all critical issues before proceeding with production deployment.');
      process.exit(1);
    } else if (report.summary.failedPhases > 0) {
      console.log('\n⚠️ Some test phases failed - Review before deployment');
      console.log('Consider fixing non-critical issues for optimal production readiness.');
      process.exit(1);
    } else {
      console.log('\n🎉 ALL PRE-DEPLOYMENT TESTS PASSED!');
      console.log('✅ System is ready for production deployment');
      process.exit(0);
    }
  }
}

// CLI execution
if (require.main === module) {
  const tester = new PreDeploymentTester();
  
  // Handle process signals
  process.on('SIGINT', () => {
    console.log('\n⚠️ Testing interrupted by user');
    process.exit(1);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n⚠️ Testing terminated');
    process.exit(1);
  });
  
  tester.run().catch(error => {
    console.error('🚨 Fatal error during pre-deployment testing:', error);
    process.exit(1);
  });
}

module.exports = PreDeploymentTester;