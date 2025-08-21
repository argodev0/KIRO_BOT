#!/usr/bin/env node

/**
 * Integration Test Runner for AI Crypto Trading Bot
 * Runs comprehensive end-to-end and integration tests
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class IntegrationTestRunner {
  constructor() {
    this.testSuites = [
      {
        name: 'Complete Workflow E2E',
        command: 'npm run test -- --testPathPattern=CompleteWorkflowE2E',
        timeout: 120000,
        critical: true
      },
      {
        name: 'Load Testing E2E',
        command: 'npm run test -- --testPathPattern=LoadTestingE2E',
        timeout: 180000,
        critical: true
      },
      {
        name: 'Risk Management E2E',
        command: 'npm run test -- --testPathPattern=RiskManagementE2E',
        timeout: 90000,
        critical: true
      },
      {
        name: 'System Recovery E2E',
        command: 'npm run test -- --testPathPattern=SystemRecoveryE2E',
        timeout: 240000,
        critical: true
      },
      {
        name: 'Security Penetration Testing',
        command: 'npm run test -- --testPathPattern=PenetrationTestingE2E',
        timeout: 150000,
        critical: true
      },
      {
        name: 'User Acceptance Testing',
        command: 'npm run test -- --testPathPattern=UserAcceptanceE2E',
        timeout: 120000,
        critical: false
      }
    ];
    
    this.results = [];
  }

  async runAllTests() {
    console.log('🚀 Starting Final Integration Testing Suite');
    console.log('==========================================\n');

    for (const suite of this.testSuites) {
      await this.runTestSuite(suite);
    }

    this.generateFinalReport();
    this.checkQualityGates();
  }

  async runTestSuite(suite) {
    console.log(`📋 Running ${suite.name}...`);
    
    const startTime = Date.now();
    
    try {
      const result = await this.executeCommand(suite.command, suite.timeout);
      const duration = Date.now() - startTime;
      
      const testResult = {
        name: suite.name,
        passed: result.exitCode === 0,
        duration,
        critical: suite.critical,
        output: result.output,
        error: result.stderr
      };
      
      this.results.push(testResult);
      
      if (testResult.passed) {
        console.log(`✅ ${suite.name} passed (${duration}ms)`);
      } else {
        console.log(`❌ ${suite.name} failed (${duration}ms)`);
        if (suite.critical) {
          console.log(`🚨 Critical test failed: ${suite.name}`);
        }
      }
      
    } catch (error) {
      console.log(`💥 ${suite.name} crashed: ${error.message}`);
      this.results.push({
        name: suite.name,
        passed: false,
        critical: suite.critical,
        error: error.message
      });
    }
    
    console.log(''); // Empty line for readability
  }

  executeCommand(command, timeout) {
    return new Promise((resolve, reject) => {
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
      
      const timeoutId = setTimeout(() => {
        child.kill();
        reject(new Error(`Test timeout after ${timeout}ms`));
      }, timeout);
      
      child.on('close', (exitCode) => {
        clearTimeout(timeoutId);
        resolve({
          exitCode,
          output: stdout,
          stderr
        });
      });
      
      child.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  generateFinalReport() {
    console.log('\n📊 Final Integration Test Results');
    console.log('=================================\n');
    
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const criticalTests = this.results.filter(r => r.critical).length;
    const criticalPassed = this.results.filter(r => r.critical && r.passed).length;
    
    console.log(`Total Test Suites: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Critical Tests: ${criticalTests}`);
    console.log(`Critical Passed: ${criticalPassed}`);
    console.log(`Pass Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%`);
    console.log(`Critical Pass Rate: ${((criticalPassed / criticalTests) * 100).toFixed(2)}%\n`);
    
    // Detailed results
    console.log('Detailed Results:');
    console.log('-----------------');
    
    this.results.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const critical = result.critical ? '[CRITICAL]' : '[OPTIONAL]';
      const duration = result.duration ? `(${result.duration}ms)` : '';
      
      console.log(`${status} ${critical} ${result.name} ${duration}`);
      
      if (!result.passed && result.error) {
        console.log(`    Error: ${result.error}`);
      }
    });
    
    // Save results to file
    this.saveResults();
  }

  checkQualityGates() {
    console.log('\n🚪 Quality Gates Check');
    console.log('=====================\n');
    
    const criticalTests = this.results.filter(r => r.critical);
    const criticalPassed = criticalTests.filter(r => r.passed);
    const criticalPassRate = (criticalPassed.length / criticalTests.length) * 100;
    
    const allTests = this.results;
    const allPassed = allTests.filter(r => r.passed);
    const overallPassRate = (allPassed.length / allTests.length) * 100;
    
    let qualityGatesPassed = true;
    
    // Quality Gate 1: All critical tests must pass
    if (criticalPassRate < 100) {
      console.log('❌ Quality Gate 1 FAILED: Not all critical tests passed');
      console.log(`   Critical pass rate: ${criticalPassRate.toFixed(2)}% (Required: 100%)`);
      qualityGatesPassed = false;
    } else {
      console.log('✅ Quality Gate 1 PASSED: All critical tests passed');
    }
    
    // Quality Gate 2: Overall pass rate must be >= 90%
    if (overallPassRate < 90) {
      console.log('❌ Quality Gate 2 FAILED: Overall pass rate too low');
      console.log(`   Overall pass rate: ${overallPassRate.toFixed(2)}% (Required: ≥90%)`);
      qualityGatesPassed = false;
    } else {
      console.log('✅ Quality Gate 2 PASSED: Overall pass rate acceptable');
    }
    
    // Quality Gate 3: No test suite should take longer than 4 minutes
    const longRunningTests = this.results.filter(r => r.duration > 240000);
    if (longRunningTests.length > 0) {
      console.log('⚠️  Quality Gate 3 WARNING: Some tests took longer than 4 minutes');
      longRunningTests.forEach(test => {
        console.log(`   ${test.name}: ${test.duration}ms`);
      });
    } else {
      console.log('✅ Quality Gate 3 PASSED: All tests completed within time limits');
    }
    
    console.log('\n' + '='.repeat(50));
    
    if (qualityGatesPassed) {
      console.log('🎉 ALL QUALITY GATES PASSED!');
      console.log('✅ System is ready for production deployment');
      process.exit(0);
    } else {
      console.log('❌ QUALITY GATES FAILED!');
      console.log('🚫 System is NOT ready for production deployment');
      console.log('📋 Please fix failing tests before proceeding');
      process.exit(1);
    }
  }

  saveResults() {
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: this.results.length,
        passedTests: this.results.filter(r => r.passed).length,
        failedTests: this.results.filter(r => !r.passed).length,
        criticalTests: this.results.filter(r => r.critical).length,
        criticalPassed: this.results.filter(r => r.critical && r.passed).length,
        totalDuration: this.results.reduce((sum, r) => sum + (r.duration || 0), 0)
      },
      results: this.results,
      qualityGates: {
        criticalTestsPass: this.results.filter(r => r.critical).every(r => r.passed),
        overallPassRate: (this.results.filter(r => r.passed).length / this.results.length) * 100,
        maxTestDuration: Math.max(...this.results.map(r => r.duration || 0))
      }
    };
    
    // Save JSON report
    const jsonPath = path.join(process.cwd(), 'integration-test-results.json');
    fs.writeFileSync(jsonPath, JSON.stringify(reportData, null, 2));
    
    // Save HTML report
    this.generateHtmlReport(reportData);
    
    console.log(`\n📄 Test results saved to: ${jsonPath}`);
  }

  generateHtmlReport(reportData) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>AI Crypto Trading Bot - Integration Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
        .metric.success { border-left-color: #28a745; }
        .metric.warning { border-left-color: #ffc107; }
        .metric.danger { border-left-color: #dc3545; }
        .test-results { margin: 30px 0; }
        .test-item { margin: 10px 0; padding: 15px; border-radius: 8px; border-left: 4px solid #ddd; }
        .test-item.passed { background: #d4edda; border-left-color: #28a745; }
        .test-item.failed { background: #f8d7da; border-left-color: #dc3545; }
        .test-item.critical { font-weight: bold; }
        .quality-gates { background: #e9ecef; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .gate { margin: 10px 0; padding: 10px; border-radius: 4px; }
        .gate.passed { background: #d4edda; color: #155724; }
        .gate.failed { background: #f8d7da; color: #721c24; }
        .timestamp { text-align: center; color: #6c757d; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 AI Crypto Trading Bot</h1>
            <h2>Final Integration Test Report</h2>
        </div>
        
        <div class="summary">
            <div class="metric ${reportData.summary.passedTests === reportData.summary.totalTests ? 'success' : 'danger'}">
                <h3>Overall Results</h3>
                <p>${reportData.summary.passedTests}/${reportData.summary.totalTests} Passed</p>
                <p>${((reportData.summary.passedTests / reportData.summary.totalTests) * 100).toFixed(1)}%</p>
            </div>
            <div class="metric ${reportData.summary.criticalPassed === reportData.summary.criticalTests ? 'success' : 'danger'}">
                <h3>Critical Tests</h3>
                <p>${reportData.summary.criticalPassed}/${reportData.summary.criticalTests} Passed</p>
                <p>${((reportData.summary.criticalPassed / reportData.summary.criticalTests) * 100).toFixed(1)}%</p>
            </div>
            <div class="metric">
                <h3>Total Duration</h3>
                <p>${(reportData.summary.totalDuration / 1000).toFixed(1)}s</p>
            </div>
            <div class="metric ${reportData.qualityGates.maxTestDuration < 240000 ? 'success' : 'warning'}">
                <h3>Max Test Duration</h3>
                <p>${(reportData.qualityGates.maxTestDuration / 1000).toFixed(1)}s</p>
            </div>
        </div>
        
        <div class="quality-gates">
            <h3>🚪 Quality Gates</h3>
            <div class="gate ${reportData.qualityGates.criticalTestsPass ? 'passed' : 'failed'}">
                ${reportData.qualityGates.criticalTestsPass ? '✅' : '❌'} Critical Tests: ${reportData.qualityGates.criticalTestsPass ? 'PASSED' : 'FAILED'}
            </div>
            <div class="gate ${reportData.qualityGates.overallPassRate >= 90 ? 'passed' : 'failed'}">
                ${reportData.qualityGates.overallPassRate >= 90 ? '✅' : '❌'} Overall Pass Rate: ${reportData.qualityGates.overallPassRate.toFixed(1)}% (Required: ≥90%)
            </div>
            <div class="gate ${reportData.qualityGates.maxTestDuration < 240000 ? 'passed' : 'failed'}">
                ${reportData.qualityGates.maxTestDuration < 240000 ? '✅' : '⚠️'} Performance: Max ${(reportData.qualityGates.maxTestDuration / 1000).toFixed(1)}s (Target: <240s)
            </div>
        </div>
        
        <div class="test-results">
            <h3>📋 Test Suite Results</h3>
            ${reportData.results.map(result => `
                <div class="test-item ${result.passed ? 'passed' : 'failed'} ${result.critical ? 'critical' : ''}">
                    <h4>${result.passed ? '✅' : '❌'} ${result.name} ${result.critical ? '[CRITICAL]' : ''}</h4>
                    <p>Duration: ${result.duration ? (result.duration / 1000).toFixed(1) + 's' : 'N/A'}</p>
                    ${result.error ? `<p><strong>Error:</strong> ${result.error}</p>` : ''}
                </div>
            `).join('')}
        </div>
        
        <div class="timestamp">
            <p>Report generated: ${reportData.timestamp}</p>
        </div>
    </div>
</body>
</html>`;
    
    const htmlPath = path.join(process.cwd(), 'integration-test-report.html');
    fs.writeFileSync(htmlPath, html);
    console.log(`📄 HTML report saved to: ${htmlPath}`);
  }
}

// CLI interface
async function main() {
  const runner = new IntegrationTestRunner();
  
  try {
    await runner.runAllTests();
  } catch (error) {
    console.error('Integration test runner failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = IntegrationTestRunner;