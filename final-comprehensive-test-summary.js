#!/usr/bin/env node

/**
 * Final Comprehensive Test Summary
 * Consolidates all pre-deployment testing results
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

const fs = require('fs');

class FinalTestSummary {
  constructor() {
    this.summary = {
      timestamp: new Date().toISOString(),
      testSuites: {},
      overallResults: {
        totalPassed: 0,
        totalFailed: 0,
        totalCritical: 0,
        successRate: 0,
        deploymentReady: false
      },
      criticalIssues: [],
      recommendations: []
    };
  }

  loadTestResults() {
    console.log('📊 Loading test results from all validation suites...\n');
    
    // Load production validation suite results
    if (fs.existsSync('production-validation-suite-report.json')) {
      const prodResults = JSON.parse(fs.readFileSync('production-validation-suite-report.json', 'utf8'));
      this.summary.testSuites.productionValidation = {
        name: 'Production Validation Suite',
        passed: (prodResults.summary && prodResults.summary.totalPassed) || 0,
        failed: (prodResults.summary && prodResults.summary.totalFailed) || 0,
        critical: (prodResults.summary && prodResults.summary.totalCritical) || 0,
        success: (prodResults.summary && prodResults.summary.overallSuccess) || false,
        recommendations: prodResults.recommendations || []
      };
      
      // Extract critical issues
      if (prodResults.recommendations) {
        prodResults.recommendations.forEach(rec => {
          if (rec.priority === 'CRITICAL') {
            this.summary.criticalIssues.push({
              source: 'Production Validation',
              issue: rec.message,
              action: rec.action
            });
          }
        });
      }
    }
    
    // Load paper trading safety results
    if (fs.existsSync('paper-trading-safety-report.json')) {
      const safetyResults = JSON.parse(fs.readFileSync('paper-trading-safety-report.json', 'utf8'));
      this.summary.testSuites.paperTradingSafety = {
        name: 'Paper Trading Safety Verification',
        passed: safetyResults.passed || 0,
        failed: safetyResults.failed || 0,
        critical: safetyResults.critical || 0,
        success: safetyResults.critical === 0,
        safetyScore: safetyResults.passed / (safetyResults.passed + safetyResults.failed + safetyResults.critical) * 100
      };
      
      // Extract critical safety issues
      const criticalTests = (safetyResults.tests && safetyResults.tests.filter(t => t.level === 'critical')) || [];
      criticalTests.forEach(test => {
        this.summary.criticalIssues.push({
          source: 'Paper Trading Safety',
          issue: test.message,
          action: 'Fix immediately before deployment'
        });
      });
    }
    
    // Load core functionality results
    if (fs.existsSync('core-functionality-test-report.json')) {
      const coreResults = JSON.parse(fs.readFileSync('core-functionality-test-report.json', 'utf8'));
      this.summary.testSuites.coreFunctionality = {
        name: 'Core Functionality Tests',
        passed: coreResults.passed || 0,
        failed: coreResults.failed || 0,
        critical: 0,
        success: coreResults.failed === 0,
        successRate: coreResults.passed / (coreResults.passed + coreResults.failed) * 100
      };
    }
    
    // Load integration test results
    if (fs.existsSync('comprehensive-integration-test-report.json')) {
      const integrationResults = JSON.parse(fs.readFileSync('comprehensive-integration-test-report.json', 'utf8'));
      this.summary.testSuites.integration = {
        name: 'Comprehensive Integration Tests',
        passed: integrationResults.passed || 0,
        failed: integrationResults.failed || 0,
        critical: integrationResults.critical || 0,
        success: integrationResults.critical === 0 && integrationResults.failed === 0,
        successRate: integrationResults.passed / (integrationResults.passed + integrationResults.failed + integrationResults.critical) * 100
      };
      
      // Extract critical integration issues
      const criticalTests = (integrationResults.tests && integrationResults.tests.filter(t => t.level === 'critical')) || [];
      criticalTests.forEach(test => {
        this.summary.criticalIssues.push({
          source: 'Integration Tests',
          issue: test.message,
          action: 'Fix critical integration issue'
        });
      });
    }
    
    // Load smoke test results
    if (fs.existsSync('production-smoke-test-report.json')) {
      const smokeResults = JSON.parse(fs.readFileSync('production-smoke-test-report.json', 'utf8'));
      this.summary.testSuites.smokeTests = {
        name: 'Production Smoke Tests',
        passed: smokeResults.passed || 0,
        failed: smokeResults.failed || 0,
        critical: 0,
        success: smokeResults.failed === 0,
        successRate: smokeResults.passed / (smokeResults.passed + smokeResults.failed) * 100 || 0
      };
    }
  }

  calculateOverallResults() {
    console.log('🧮 Calculating overall test results...\n');
    
    let totalPassed = 0;
    let totalFailed = 0;
    let totalCritical = 0;
    let allSuitesSuccess = true;
    
    Object.values(this.summary.testSuites).forEach(suite => {
      totalPassed += suite.passed || 0;
      totalFailed += suite.failed || 0;
      totalCritical += suite.critical || 0;
      
      if (!suite.success) {
        allSuitesSuccess = false;
      }
    });
    
    const totalTests = totalPassed + totalFailed + totalCritical;
    const successRate = totalTests > 0 ? (totalPassed / totalTests * 100) : 0;
    
    this.summary.overallResults = {
      totalPassed,
      totalFailed,
      totalCritical,
      successRate: parseFloat(successRate.toFixed(1)),
      deploymentReady: totalCritical === 0 && allSuitesSuccess
    };
  }

  generateRecommendations() {
    console.log('💡 Generating deployment recommendations...\n');
    
    // Critical issues block deployment
    if (this.summary.overallResults.totalCritical > 0) {
      this.summary.recommendations.push({
        priority: 'CRITICAL',
        category: 'Deployment Blocker',
        message: `${this.summary.overallResults.totalCritical} critical issues detected`,
        action: 'DO NOT DEPLOY - Fix all critical issues immediately',
        blocking: true
      });
    }
    
    // Paper trading safety assessment
    const safetyResults = this.summary.testSuites.paperTradingSafety;
    if (safetyResults && safetyResults.safetyScore < 90) {
      this.summary.recommendations.push({
        priority: 'HIGH',
        category: 'Safety',
        message: `Paper trading safety score is ${safetyResults.safetyScore.toFixed(1)}%`,
        action: 'Improve safety mechanisms before deployment',
        blocking: safetyResults.safetyScore < 70
      });
    }
    
    // Integration issues
    const integrationResults = this.summary.testSuites.integration;
    if (integrationResults && !integrationResults.success) {
      this.summary.recommendations.push({
        priority: 'HIGH',
        category: 'Integration',
        message: 'Integration tests failed',
        action: 'Fix component integration issues',
        blocking: integrationResults.critical > 0
      });
    }
    
    // Smoke test failures
    const smokeResults = this.summary.testSuites.smokeTests;
    if (smokeResults && !smokeResults.success) {
      this.summary.recommendations.push({
        priority: 'MEDIUM',
        category: 'Smoke Tests',
        message: 'Production smoke tests failed',
        action: 'Start services and validate endpoints before deployment',
        blocking: false
      });
    }
    
    // Success case
    if (this.summary.overallResults.deploymentReady) {
      this.summary.recommendations.push({
        priority: 'INFO',
        category: 'Success',
        message: 'All critical tests passed',
        action: 'System is ready for production deployment',
        blocking: false
      });
    }
  }

  printSummary() {
    console.log('='.repeat(80));
    console.log('🎯 FINAL COMPREHENSIVE TEST SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`📅 Generated: ${this.summary.timestamp}`);
    console.log(`✅ Total Passed: ${this.summary.overallResults.totalPassed}`);
    console.log(`❌ Total Failed: ${this.summary.overallResults.totalFailed}`);
    console.log(`🚨 Total Critical: ${this.summary.overallResults.totalCritical}`);
    console.log(`📈 Overall Success Rate: ${this.summary.overallResults.successRate}%`);
    
    console.log('\n📊 Test Suite Results:');
    Object.values(this.summary.testSuites).forEach(suite => {
      const status = suite.success ? '✅ PASSED' : '❌ FAILED';
      const rate = suite.successRate ? ` (${suite.successRate.toFixed(1)}%)` : '';
      console.log(`  ${status}: ${suite.name}${rate}`);
      
      if (suite.critical > 0) {
        console.log(`    🚨 Critical Issues: ${suite.critical}`);
      }
      if (suite.failed > 0) {
        console.log(`    ❌ Failed Tests: ${suite.failed}`);
      }
    });
    
    // Critical Issues
    if (this.summary.criticalIssues.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES:');
      this.summary.criticalIssues.forEach((issue, index) => {
        console.log(`  ${index + 1}. [${issue.source}] ${issue.issue}`);
        console.log(`     Action: ${issue.action}`);
      });
    }
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    this.summary.recommendations.forEach(rec => {
      const priorityEmoji = {
        'CRITICAL': '🚨',
        'HIGH': '⚠️',
        'MEDIUM': '📋',
        'INFO': '💡'
      };
      
      const blockingText = rec.blocking ? ' [BLOCKING]' : '';
      console.log(`  ${priorityEmoji[rec.priority]} ${rec.priority}${blockingText}: ${rec.message}`);
      console.log(`     Action: ${rec.action}`);
    });
    
    console.log('\n' + '='.repeat(80));
    
    // Final Assessment
    if (this.summary.overallResults.deploymentReady) {
      console.log('🎉 COMPREHENSIVE TESTING PASSED - READY FOR PRODUCTION! 🎉');
      console.log('✅ All critical safety mechanisms validated');
      console.log('✅ System integration verified');
      console.log('✅ Paper trading enforcement confirmed');
    } else if (this.summary.overallResults.totalCritical > 0) {
      console.log('🚨 CRITICAL FAILURES - DO NOT DEPLOY TO PRODUCTION! 🚨');
      console.log('❌ Fix all critical issues before proceeding');
      console.log('🛡️  Paper trading safety must be ensured');
    } else {
      console.log('⚠️  TESTING ISSUES DETECTED - REVIEW BEFORE DEPLOYMENT ⚠️');
      console.log('🔧 Address failed tests and warnings');
      console.log('📋 Consider additional validation');
    }
    
    console.log('='.repeat(80));
  }

  saveReport() {
    const reportPath = 'final-comprehensive-test-summary.json';
    fs.writeFileSync(reportPath, JSON.stringify(this.summary, null, 2));
    console.log(`\n📄 Final test summary saved to: ${reportPath}`);
    
    return this.summary.overallResults.deploymentReady;
  }

  run() {
    console.log('📋 Generating Final Comprehensive Test Summary...\n');
    
    this.loadTestResults();
    this.calculateOverallResults();
    this.generateRecommendations();
    this.printSummary();
    
    const deploymentReady = this.saveReport();
    
    // Exit with appropriate code
    if (this.summary.overallResults.totalCritical > 0) {
      process.exit(2); // Critical failures
    } else if (!deploymentReady) {
      process.exit(1); // Non-critical failures
    } else {
      process.exit(0); // Success
    }
  }
}

// Run if called directly
if (require.main === module) {
  const summary = new FinalTestSummary();
  summary.run();
}

module.exports = FinalTestSummary;