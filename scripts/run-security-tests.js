#!/usr/bin/env node

/**
 * Security Test Runner
 * Executes comprehensive security testing including Jest tests and custom security audit
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class SecurityTestRunner {
  constructor() {
    this.results = {
      jestSecurityTests: null,
      penetrationTests: null,
      paperTradingSafetyTests: null,
      comprehensiveAudit: null,
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        criticalIssues: 0
      }
    };
  }

  async runAllSecurityTests() {
    console.log('🔐 Starting Comprehensive Security Testing Suite');
    console.log('================================================');

    try {
      // Phase 1: Jest Security Tests
      await this.runJestSecurityTests();

      // Phase 2: Paper Trading Safety Tests
      await this.runPaperTradingSafetyTests();

      // Phase 3: Penetration Testing
      await this.runPenetrationTests();

      // Phase 4: Comprehensive Security Audit
      await this.runComprehensiveAudit();

      // Phase 5: Generate Final Report
      await this.generateFinalReport();

      console.log('✅ All security tests completed');

    } catch (error) {
      console.error('❌ Security testing failed:', error.message);
      throw error;
    }
  }

  async runJestSecurityTests() {
    console.log('\n🧪 Running Jest Security Tests');
    console.log('--------------------------------');

    try {
      const result = execSync('npm run test:security -- --verbose', { 
        encoding: 'utf8',
        cwd: path.join(__dirname, '..')
      });

      this.results.jestSecurityTests = {
        status: 'passed',
        output: result,
        timestamp: new Date().toISOString()
      };

      console.log('✅ Jest security tests passed');

    } catch (error) {
      this.results.jestSecurityTests = {
        status: 'failed',
        output: error.stdout || error.message,
        error: error.message,
        timestamp: new Date().toISOString()
      };

      console.log('❌ Jest security tests failed');
      console.log(error.stdout || error.message);
    }
  }

  async runPaperTradingSafetyTests() {
    console.log('\n🛡️ Running Paper Trading Safety Tests');
    console.log('--------------------------------------');

    try {
      const result = execSync('npm run test:paper-trading', { 
        encoding: 'utf8',
        cwd: path.join(__dirname, '..')
      });

      this.results.paperTradingSafetyTests = {
        status: 'passed',
        output: result,
        timestamp: new Date().toISOString()
      };

      console.log('✅ Paper trading safety tests passed');

    } catch (error) {
      this.results.paperTradingSafetyTests = {
        status: 'failed',
        output: error.stdout || error.message,
        error: error.message,
        timestamp: new Date().toISOString()
      };

      console.log('❌ Paper trading safety tests failed');
      console.log(error.stdout || error.message);
    }
  } 
 async runPenetrationTests() {
    console.log('\n🎯 Running Penetration Tests');
    console.log('-----------------------------');

    try {
      const result = execSync('npm test -- --testPathPattern=PenetrationTestingE2E', { 
        encoding: 'utf8',
        cwd: path.join(__dirname, '..')
      });

      this.results.penetrationTests = {
        status: 'passed',
        output: result,
        timestamp: new Date().toISOString()
      };

      console.log('✅ Penetration tests passed');

    } catch (error) {
      this.results.penetrationTests = {
        status: 'failed',
        output: error.stdout || error.message,
        error: error.message,
        timestamp: new Date().toISOString()
      };

      console.log('❌ Penetration tests failed');
      console.log(error.stdout || error.message);
    }
  }

  async runComprehensiveAudit() {
    console.log('\n🔍 Running Comprehensive Security Audit');
    console.log('----------------------------------------');

    try {
      const result = execSync('node scripts/comprehensive-security-audit.js', { 
        encoding: 'utf8',
        cwd: path.join(__dirname, '..')
      });

      this.results.comprehensiveAudit = {
        status: 'passed',
        output: result,
        timestamp: new Date().toISOString()
      };

      console.log('✅ Comprehensive security audit passed');

    } catch (error) {
      this.results.comprehensiveAudit = {
        status: error.code === 2 ? 'warning' : 'failed',
        output: error.stdout || error.message,
        error: error.message,
        exitCode: error.code,
        timestamp: new Date().toISOString()
      };

      if (error.code === 2) {
        console.log('⚠️ Comprehensive security audit completed with warnings');
      } else {
        console.log('❌ Comprehensive security audit failed');
      }
      console.log(error.stdout || error.message);
    }
  }

  async generateFinalReport() {
    console.log('\n📊 Generating Final Security Report');
    console.log('-----------------------------------');

    // Calculate summary statistics
    const testSuites = [
      this.results.jestSecurityTests,
      this.results.paperTradingSafetyTests,
      this.results.penetrationTests,
      this.results.comprehensiveAudit
    ];

    this.results.summary.totalTests = testSuites.length;
    this.results.summary.passedTests = testSuites.filter(t => t && t.status === 'passed').length;
    this.results.summary.failedTests = testSuites.filter(t => t && t.status === 'failed').length;

    // Load comprehensive audit report if available
    let auditReport = null;
    const auditReportPath = path.join(__dirname, '..', 'comprehensive-security-audit-report.json');
    
    if (fs.existsSync(auditReportPath)) {
      try {
        auditReport = JSON.parse(fs.readFileSync(auditReportPath, 'utf8'));
        this.results.summary.criticalIssues = auditReport.summary.criticalVulnerabilities;
      } catch (error) {
        console.log('Warning: Could not parse audit report');
      }
    }

    // Create final report
    const finalReport = {
      metadata: {
        timestamp: new Date().toISOString(),
        testSuite: 'Comprehensive Security Testing Suite v1.0',
        environment: process.env.NODE_ENV || 'development'
      },
      summary: this.results.summary,
      testResults: this.results,
      auditReport,
      recommendations: this.generateRecommendations(),
      deploymentStatus: this.determineDeploymentStatus()
    };

    // Save final report
    const reportPath = path.join(__dirname, '..', 'security-testing-final-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));

    // Print summary
    this.printFinalSummary(finalReport);

    return finalReport;
  }  g
enerateRecommendations() {
    const recommendations = [];

    // Check Jest security tests
    if (this.results.jestSecurityTests?.status === 'failed') {
      recommendations.push({
        priority: 'HIGH',
        category: 'Unit Tests',
        message: 'Security unit tests are failing',
        action: 'Fix failing security unit tests before deployment'
      });
    }

    // Check paper trading safety
    if (this.results.paperTradingSafetyTests?.status === 'failed') {
      recommendations.push({
        priority: 'CRITICAL',
        category: 'Paper Trading Safety',
        message: 'Paper trading safety tests are failing',
        action: 'Fix all paper trading safety issues immediately'
      });
    }

    // Check penetration tests
    if (this.results.penetrationTests?.status === 'failed') {
      recommendations.push({
        priority: 'HIGH',
        category: 'Penetration Testing',
        message: 'Penetration tests detected vulnerabilities',
        action: 'Address all penetration testing findings'
      });
    }

    // Check comprehensive audit
    if (this.results.comprehensiveAudit?.status === 'failed') {
      recommendations.push({
        priority: 'CRITICAL',
        category: 'Security Audit',
        message: 'Comprehensive security audit found critical issues',
        action: 'Address all critical security vulnerabilities'
      });
    } else if (this.results.comprehensiveAudit?.status === 'warning') {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Security Audit',
        message: 'Comprehensive security audit found issues requiring review',
        action: 'Review and address security audit findings'
      });
    }

    // Critical issues check
    if (this.results.summary.criticalIssues > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        category: 'Critical Vulnerabilities',
        message: `${this.results.summary.criticalIssues} critical security vulnerabilities found`,
        action: 'Fix all critical vulnerabilities before deployment'
      });
    }

    return recommendations;
  }

  determineDeploymentStatus() {
    const criticalFailures = [
      this.results.paperTradingSafetyTests?.status === 'failed',
      this.results.comprehensiveAudit?.status === 'failed',
      this.results.summary.criticalIssues > 0
    ].filter(Boolean).length;

    const highRiskFailures = [
      this.results.jestSecurityTests?.status === 'failed',
      this.results.penetrationTests?.status === 'failed',
      this.results.comprehensiveAudit?.status === 'warning'
    ].filter(Boolean).length;

    if (criticalFailures > 0) {
      return {
        status: 'BLOCKED',
        reason: 'Critical security vulnerabilities found',
        recommendation: 'DO NOT DEPLOY - Fix all critical issues first'
      };
    } else if (highRiskFailures > 1) {
      return {
        status: 'REVIEW_REQUIRED',
        reason: 'Multiple high-risk security issues found',
        recommendation: 'Review all security issues before deployment'
      };
    } else if (highRiskFailures > 0) {
      return {
        status: 'CAUTION',
        reason: 'Some security issues found',
        recommendation: 'Deploy with caution after reviewing issues'
      };
    } else {
      return {
        status: 'APPROVED',
        reason: 'All security tests passed',
        recommendation: 'Safe to deploy'
      };
    }
  }

  printFinalSummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log('🔐 SECURITY TESTING FINAL REPORT');
    console.log('='.repeat(60));

    console.log(`\n📊 Test Suite Summary:`);
    console.log(`   Total Test Suites: ${report.summary.totalTests}`);
    console.log(`   Passed: ${report.summary.passedTests}`);
    console.log(`   Failed: ${report.summary.failedTests}`);
    console.log(`   Critical Issues: ${report.summary.criticalIssues}`);

    console.log(`\n🧪 Individual Test Results:`);
    console.log(`   Jest Security Tests: ${this.getStatusIcon(this.results.jestSecurityTests?.status)}`);
    console.log(`   Paper Trading Safety: ${this.getStatusIcon(this.results.paperTradingSafetyTests?.status)}`);
    console.log(`   Penetration Tests: ${this.getStatusIcon(this.results.penetrationTests?.status)}`);
    console.log(`   Comprehensive Audit: ${this.getStatusIcon(this.results.comprehensiveAudit?.status)}`);

    console.log(`\n🚀 Deployment Status: ${report.deploymentStatus.status}`);
    console.log(`   Reason: ${report.deploymentStatus.reason}`);
    console.log(`   Recommendation: ${report.deploymentStatus.recommendation}`);

    if (report.recommendations.length > 0) {
      console.log(`\n💡 Key Recommendations:`);
      report.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. [${rec.priority}] ${rec.message}`);
      });
    }

    console.log(`\n📄 Detailed report saved to: security-testing-final-report.json`);
    console.log('='.repeat(60));
  }

  getStatusIcon(status) {
    switch (status) {
      case 'passed': return '✅ PASSED';
      case 'failed': return '❌ FAILED';
      case 'warning': return '⚠️ WARNING';
      default: return '❓ UNKNOWN';
    }
  }
}

// Main execution
async function main() {
  const runner = new SecurityTestRunner();
  
  try {
    await runner.runAllSecurityTests();
    
    // Exit with appropriate code based on deployment status
    const deploymentStatus = runner.results.summary.criticalIssues > 0 || 
                            runner.results.paperTradingSafetyTests?.status === 'failed' ||
                            runner.results.comprehensiveAudit?.status === 'failed';
    
    if (deploymentStatus) {
      console.log('\n🚨 SECURITY TESTING FAILED - DEPLOYMENT BLOCKED!');
      process.exit(1);
    } else {
      console.log('\n✅ Security testing completed successfully!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n❌ Security testing suite failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = SecurityTestRunner;