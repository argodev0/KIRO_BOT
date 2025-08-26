#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestRunner {
  constructor() {
    this.results = {
      unit: { passed: false, coverage: 0, duration: 0 },
      integration: { passed: false, coverage: 0, duration: 0 },
      frontend: { passed: false, coverage: 0, duration: 0 },
      security: { passed: false, coverage: 0, duration: 0 },
      performance: { passed: false, duration: 0 },
      e2e: { passed: false, duration: 0 }
    };
    
    this.thresholds = {
      coverage: {
        overall: 85,
        services: 90,
        models: 85
      },
      performance: {
        signalGeneration: 10,
        technicalAnalysis: 100,
        apiResponse: 200
      }
    };
  }

  async runAllTests() {
    console.log('🚀 Starting Comprehensive Test Suite');
    console.log('=====================================\n');

    try {
      // Run tests in parallel where possible
      await this.runParallelTests();
      
      // Run sequential tests that require isolation
      await this.runSequentialTests();
      
      // Generate final report
      this.generateReport();
      
      // Check quality gates
      const passed = this.checkQualityGates();
      
      if (passed) {
        console.log('✅ All tests passed! Quality gates satisfied.');
        process.exit(0);
      } else {
        console.log('❌ Some tests failed or quality gates not met.');
        process.exit(1);
      }
      
    } catch (error) {
      console.error('💥 Test suite failed:', error.message);
      process.exit(1);
    }
  }

  async runParallelTests() {
    console.log('📋 Running parallel test suites...\n');
    
    const parallelTests = [
      { name: 'unit', command: 'npm run test:unit' },
      { name: 'frontend', command: 'npm run test:frontend' },
      { name: 'security', command: 'npm run test:security' }
    ];

    const promises = parallelTests.map(test => this.runTestSuite(test));
    await Promise.all(promises);
  }

  async runSequentialTests() {
    console.log('\n📋 Running sequential test suites...\n');
    
    const sequentialTests = [
      { name: 'integration', command: 'npm run test:integration' },
      { name: 'performance', command: 'npm run test:performance' },
      { name: 'e2e', command: 'npm run test:e2e' }
    ];

    for (const test of sequentialTests) {
      await this.runTestSuite(test);
    }
  }

  async runTestSuite(testConfig) {
    const { name, command } = testConfig;
    console.log(`🧪 Running ${name} tests...`);
    
    const startTime = Date.now();
    
    try {
      const result = await this.executeCommand(command);
      const duration = Date.now() - startTime;
      
      this.results[name] = {
        passed: result.exitCode === 0,
        duration,
        output: result.output,
        coverage: this.extractCoverage(result.output)
      };
      
      if (result.exitCode === 0) {
        console.log(`✅ ${name} tests passed (${duration}ms)`);
      } else {
        console.log(`❌ ${name} tests failed (${duration}ms)`);
        console.log(`Error: ${result.stderr}`);
      }
      
    } catch (error) {
      console.log(`💥 ${name} tests crashed: ${error.message}`);
      this.results[name].passed = false;
    }
  }

  executeCommand(command) {
    return new Promise((resolve) => {
      const [cmd, ...args] = command.split(' ');
      const child = spawn(cmd, args, { 
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true 
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (exitCode) => {
        resolve({
          exitCode,
          output: stdout,
          stderr,
        });
      });
    });
  }

  extractCoverage(output) {
    // Extract coverage percentage from Jest output
    const coverageMatch = output.match(/All files[^|]*\|\s*(\d+\.?\d*)/);
    return coverageMatch ? parseFloat(coverageMatch[1]) : 0;
  }

  generateReport() {
    console.log('\n📊 Test Results Summary');
    console.log('=======================\n');
    
    const table = [];
    
    Object.entries(this.results).forEach(([testType, result]) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const duration = `${result.duration}ms`;
      const coverage = result.coverage ? `${result.coverage}%` : 'N/A';
      
      table.push({
        'Test Suite': testType.toUpperCase(),
        'Status': status,
        'Duration': duration,
        'Coverage': coverage
      });
    });
    
    console.table(table);
    
    // Generate detailed coverage report
    this.generateCoverageReport();
    
    // Generate performance report
    this.generatePerformanceReport();
    
    // Save results to file
    this.saveResults();
  }

  generateCoverageReport() {
    console.log('\n📈 Coverage Analysis');
    console.log('===================\n');
    
    const coverageResults = Object.entries(this.results)
      .filter(([_, result]) => result.coverage > 0)
      .map(([testType, result]) => ({
        testType,
        coverage: result.coverage,
        threshold: this.thresholds.coverage.overall,
        passed: result.coverage >= this.thresholds.coverage.overall
      }));
    
    coverageResults.forEach(({ testType, coverage, threshold, passed }) => {
      const status = passed ? '✅' : '❌';
      console.log(`${status} ${testType}: ${coverage}% (threshold: ${threshold}%)`);
    });
    
    // Overall coverage calculation
    const totalCoverage = coverageResults.reduce((sum, r) => sum + r.coverage, 0) / coverageResults.length;
    const overallPassed = totalCoverage >= this.thresholds.coverage.overall;
    
    console.log(`\n${overallPassed ? '✅' : '❌'} Overall Coverage: ${totalCoverage.toFixed(1)}%`);
  }

  generatePerformanceReport() {
    console.log('\n⚡ Performance Analysis');
    console.log('======================\n');
    
    const performanceResult = this.results.performance;
    
    if (performanceResult.output) {
      // Extract performance metrics from output
      const metrics = this.extractPerformanceMetrics(performanceResult.output);
      
      Object.entries(metrics).forEach(([metric, value]) => {
        const threshold = this.thresholds.performance[metric];
        if (threshold) {
          const passed = value <= threshold;
          const status = passed ? '✅' : '❌';
          console.log(`${status} ${metric}: ${value}ms (threshold: ${threshold}ms)`);
        }
      });
    }
  }

  extractPerformanceMetrics(output) {
    const metrics = {};
    
    // Extract metrics from benchmark output
    const lines = output.split('\n');
    lines.forEach(line => {
      if (line.includes('Signal Generation:')) {
        const match = line.match(/(\d+\.?\d*)ms/);
        if (match) metrics.signalGeneration = parseFloat(match[1]);
      }
      if (line.includes('Technical Analysis:')) {
        const match = line.match(/(\d+\.?\d*)ms/);
        if (match) metrics.technicalAnalysis = parseFloat(match[1]);
      }
    });
    
    return metrics;
  }

  checkQualityGates() {
    console.log('\n🚪 Quality Gates Check');
    console.log('=====================\n');
    
    let allPassed = true;
    
    // Check test results
    Object.entries(this.results).forEach(([testType, result]) => {
      if (!result.passed) {
        console.log(`❌ ${testType} tests failed`);
        allPassed = false;
      }
    });
    
    // Check coverage thresholds
    const coverageResults = Object.entries(this.results)
      .filter(([_, result]) => result.coverage > 0);
    
    coverageResults.forEach(([testType, result]) => {
      if (result.coverage < this.thresholds.coverage.overall) {
        console.log(`❌ ${testType} coverage below threshold: ${result.coverage}% < ${this.thresholds.coverage.overall}%`);
        allPassed = false;
      }
    });
    
    // Check performance thresholds
    if (this.results.performance.output) {
      const metrics = this.extractPerformanceMetrics(this.results.performance.output);
      
      Object.entries(metrics).forEach(([metric, value]) => {
        const threshold = this.thresholds.performance[metric];
        if (threshold && value > threshold) {
          console.log(`❌ ${metric} performance regression: ${value}ms > ${threshold}ms`);
          allPassed = false;
        }
      });
    }
    
    if (allPassed) {
      console.log('✅ All quality gates passed');
    }
    
    return allPassed;
  }

  saveResults() {
    const reportData = {
      timestamp: new Date().toISOString(),
      results: this.results,
      thresholds: this.thresholds,
      summary: {
        totalTests: Object.keys(this.results).length,
        passedTests: Object.values(this.results).filter(r => r.passed).length,
        totalDuration: Object.values(this.results).reduce((sum, r) => sum + r.duration, 0),
        overallCoverage: this.calculateOverallCoverage()
      }
    };
    
    // Save to JSON file
    const reportPath = path.join(process.cwd(), 'test-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    
    // Save to HTML report
    this.generateHtmlReport(reportData);
    
    console.log(`\n📄 Test results saved to: ${reportPath}`);
  }

  calculateOverallCoverage() {
    const coverageResults = Object.values(this.results)
      .filter(result => result.coverage > 0)
      .map(result => result.coverage);
    
    return coverageResults.length > 0 
      ? coverageResults.reduce((sum, coverage) => sum + coverage, 0) / coverageResults.length
      : 0;
  }

  generateHtmlReport(reportData) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>AI Crypto Trading Bot - Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #e8f4fd; padding: 15px; border-radius: 5px; flex: 1; }
        .test-results { margin: 20px 0; }
        .test-item { margin: 10px 0; padding: 10px; border-left: 4px solid #ddd; }
        .passed { border-left-color: #4caf50; }
        .failed { border-left-color: #f44336; }
        .coverage-bar { background: #ddd; height: 20px; border-radius: 10px; overflow: hidden; }
        .coverage-fill { height: 100%; background: #4caf50; transition: width 0.3s; }
    </style>
</head>
<body>
    <div class="header">
        <h1>AI Crypto Trading Bot - Test Report</h1>
        <p>Generated: ${reportData.timestamp}</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>Total Tests</h3>
            <p>${reportData.summary.totalTests}</p>
        </div>
        <div class="metric">
            <h3>Passed</h3>
            <p>${reportData.summary.passedTests}</p>
        </div>
        <div class="metric">
            <h3>Duration</h3>
            <p>${reportData.summary.totalDuration}ms</p>
        </div>
        <div class="metric">
            <h3>Coverage</h3>
            <p>${reportData.summary.overallCoverage.toFixed(1)}%</p>
        </div>
    </div>
    
    <div class="test-results">
        <h2>Test Results</h2>
        ${Object.entries(reportData.results).map(([testType, result]) => `
            <div class="test-item ${result.passed ? 'passed' : 'failed'}">
                <h3>${testType.toUpperCase()}</h3>
                <p>Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}</p>
                <p>Duration: ${result.duration}ms</p>
                ${result.coverage ? `
                    <p>Coverage: ${result.coverage}%</p>
                    <div class="coverage-bar">
                        <div class="coverage-fill" style="width: ${result.coverage}%"></div>
                    </div>
                ` : ''}
            </div>
        `).join('')}
    </div>
</body>
</html>`;
    
    const htmlPath = path.join(process.cwd(), 'test-report.html');
    fs.writeFileSync(htmlPath, html);
    console.log(`📄 HTML report saved to: ${htmlPath}`);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const testType = args[0];
  
  const runner = new TestRunner();
  
  if (testType && testType !== 'all') {
    // Run specific test suite
    await runner.runTestSuite({ name: testType, command: `npm run test:${testType}` });
    runner.generateReport();
  } else {
    // Run all tests
    await runner.runAllTests();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = TestRunner;