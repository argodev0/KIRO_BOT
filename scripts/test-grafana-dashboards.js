#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Test script for Grafana Dashboard System
 * Validates dashboard configurations and tests Grafana connectivity
 */

const GRAFANA_URL = process.env.GRAFANA_URL || 'http://localhost:3001';
const GRAFANA_USER = process.env.GRAFANA_USER || 'admin';
const GRAFANA_PASSWORD = process.env.GRAFANA_PASSWORD || 'admin123';

class GrafanaDashboardTester {
  constructor() {
    this.dashboardsPath = path.join(__dirname, '../monitoring/grafana/dashboards');
    this.results = {
      dashboardValidation: [],
      connectivityTest: null,
      alertingTest: null,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0
    };
  }

  /**
   * Run all Grafana dashboard tests
   */
  async runAllTests() {
    console.log('🚀 Starting Grafana Dashboard System Tests...\n');

    try {
      // Test 1: Validate dashboard JSON files
      await this.validateDashboardFiles();

      // Test 2: Test Grafana connectivity
      await this.testGrafanaConnectivity();

      // Test 3: Test alerting configuration
      await this.testAlertingConfiguration();

      // Test 4: Validate provisioning configuration
      await this.validateProvisioningConfig();

      // Generate test report
      this.generateTestReport();

    } catch (error) {
      console.error('❌ Test execution failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Validate all dashboard JSON files
   */
  async validateDashboardFiles() {
    console.log('📊 Validating Dashboard Files...');
    
    const dashboardFiles = fs.readdirSync(this.dashboardsPath)
      .filter(file => file.endsWith('.json'));

    for (const file of dashboardFiles) {
      const filePath = path.join(this.dashboardsPath, file);
      const testResult = {
        test: `Dashboard Validation: ${file}`,
        status: 'PASS',
        details: [],
        errors: []
      };

      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const dashboard = JSON.parse(content);

        // Validate required dashboard properties
        this.validateDashboardStructure(dashboard, testResult);

        // Validate panels
        this.validateDashboardPanels(dashboard, testResult);

        // Validate datasources
        this.validateDashboardDatasources(dashboard, testResult);

        this.results.passedTests++;
        console.log(`  ✅ ${file} - Valid dashboard configuration`);

      } catch (error) {
        testResult.status = 'FAIL';
        testResult.errors.push(`JSON parsing error: ${error.message}`);
        this.results.failedTests++;
        console.log(`  ❌ ${file} - ${error.message}`);
      }

      this.results.dashboardValidation.push(testResult);
      this.results.totalTests++;
    }
  }

  /**
   * Validate dashboard structure
   */
  validateDashboardStructure(dashboard, testResult) {
    const requiredFields = ['title', 'panels', 'uid', 'version'];
    
    for (const field of requiredFields) {
      if (!dashboard[field]) {
        testResult.errors.push(`Missing required field: ${field}`);
        testResult.status = 'FAIL';
      }
    }

    // Validate UID format
    if (dashboard.uid && !/^[a-zA-Z0-9_-]+$/.test(dashboard.uid)) {
      testResult.errors.push('Invalid UID format');
      testResult.status = 'FAIL';
    }

    // Validate tags
    if (dashboard.tags && !Array.isArray(dashboard.tags)) {
      testResult.errors.push('Tags must be an array');
      testResult.status = 'FAIL';
    }

    testResult.details.push(`Title: ${dashboard.title}`);
    testResult.details.push(`UID: ${dashboard.uid}`);
    testResult.details.push(`Panels: ${dashboard.panels ? dashboard.panels.length : 0}`);
  }

  /**
   * Validate dashboard panels
   */
  validateDashboardPanels(dashboard, testResult) {
    if (!dashboard.panels || !Array.isArray(dashboard.panels)) {
      testResult.errors.push('Dashboard must have panels array');
      testResult.status = 'FAIL';
      return;
    }

    dashboard.panels.forEach((panel, index) => {
      if (!panel.title) {
        testResult.errors.push(`Panel ${index} missing title`);
        testResult.status = 'FAIL';
      }

      if (!panel.type) {
        testResult.errors.push(`Panel ${index} missing type`);
        testResult.status = 'FAIL';
      }

      if (!panel.targets || !Array.isArray(panel.targets)) {
        testResult.errors.push(`Panel ${index} missing targets`);
        testResult.status = 'FAIL';
      }

      // Validate grid position
      if (!panel.gridPos || typeof panel.gridPos !== 'object') {
        testResult.errors.push(`Panel ${index} missing gridPos`);
        testResult.status = 'FAIL';
      }
    });

    testResult.details.push(`Panel validation completed for ${dashboard.panels.length} panels`);
  }

  /**
   * Validate dashboard datasources
   */
  validateDashboardDatasources(dashboard, testResult) {
    const datasources = new Set();

    dashboard.panels.forEach(panel => {
      if (panel.targets) {
        panel.targets.forEach(target => {
          if (target.datasource && target.datasource.type) {
            datasources.add(target.datasource.type);
          }
        });
      }
    });

    testResult.details.push(`Datasources used: ${Array.from(datasources).join(', ')}`);

    // Check for Prometheus datasource
    if (!datasources.has('prometheus')) {
      testResult.errors.push('No Prometheus datasource found in panels');
      testResult.status = 'FAIL';
    }
  }

  /**
   * Test Grafana connectivity
   */
  async testGrafanaConnectivity() {
    console.log('\n🔗 Testing Grafana Connectivity...');
    
    const testResult = {
      test: 'Grafana Connectivity',
      status: 'PASS',
      details: [],
      errors: []
    };

    try {
      // Test basic connectivity
      const response = await axios.get(`${GRAFANA_URL}/api/health`, {
        timeout: 5000
      });

      if (response.status === 200) {
        testResult.details.push('Grafana health check passed');
        console.log('  ✅ Grafana is accessible');
      } else {
        throw new Error(`Unexpected status code: ${response.status}`);
      }

      // Test authentication
      const authResponse = await axios.get(`${GRAFANA_URL}/api/user`, {
        auth: {
          username: GRAFANA_USER,
          password: GRAFANA_PASSWORD
        },
        timeout: 5000
      });

      if (authResponse.status === 200) {
        testResult.details.push('Authentication successful');
        testResult.details.push(`User: ${authResponse.data.login}`);
        console.log('  ✅ Authentication successful');
      }

      this.results.passedTests++;

    } catch (error) {
      testResult.status = 'FAIL';
      testResult.errors.push(`Connectivity error: ${error.message}`);
      this.results.failedTests++;
      console.log(`  ❌ Grafana connectivity failed: ${error.message}`);
    }

    this.results.connectivityTest = testResult;
    this.results.totalTests++;
  }

  /**
   * Test alerting configuration
   */
  async testAlertingConfiguration() {
    console.log('\n🚨 Testing Alerting Configuration...');
    
    const testResult = {
      test: 'Alerting Configuration',
      status: 'PASS',
      details: [],
      errors: []
    };

    try {
      // Check alerting files exist
      const alertingPath = path.join(__dirname, '../monitoring/grafana/provisioning/alerting');
      
      const requiredFiles = [
        'alert-rules.yml',
        'contact-points.yml',
        'notification-policies.yml'
      ];

      for (const file of requiredFiles) {
        const filePath = path.join(alertingPath, file);
        if (fs.existsSync(filePath)) {
          testResult.details.push(`Found: ${file}`);
          console.log(`  ✅ ${file} exists`);
        } else {
          testResult.errors.push(`Missing: ${file}`);
          testResult.status = 'FAIL';
          console.log(`  ❌ ${file} missing`);
        }
      }

      // Validate alert rules YAML
      if (fs.existsSync(path.join(alertingPath, 'alert-rules.yml'))) {
        const alertRules = fs.readFileSync(path.join(alertingPath, 'alert-rules.yml'), 'utf8');
        if (alertRules.includes('paper-trading-mode-disabled')) {
          testResult.details.push('Paper trading safety alerts configured');
          console.log('  ✅ Paper trading safety alerts found');
        } else {
          testResult.errors.push('Paper trading safety alerts not found');
          testResult.status = 'FAIL';
        }
      }

      if (testResult.status === 'PASS') {
        this.results.passedTests++;
      } else {
        this.results.failedTests++;
      }

    } catch (error) {
      testResult.status = 'FAIL';
      testResult.errors.push(`Alerting configuration error: ${error.message}`);
      this.results.failedTests++;
      console.log(`  ❌ Alerting configuration failed: ${error.message}`);
    }

    this.results.alertingTest = testResult;
    this.results.totalTests++;
  }

  /**
   * Validate provisioning configuration
   */
  async validateProvisioningConfig() {
    console.log('\n⚙️ Validating Provisioning Configuration...');
    
    const testResult = {
      test: 'Provisioning Configuration',
      status: 'PASS',
      details: [],
      errors: []
    };

    try {
      const provisioningPath = path.join(__dirname, '../monitoring/grafana/provisioning');
      
      // Check datasources
      const datasourcePath = path.join(provisioningPath, 'datasources/datasource.yml');
      if (fs.existsSync(datasourcePath)) {
        const datasourceConfig = fs.readFileSync(datasourcePath, 'utf8');
        if (datasourceConfig.includes('prometheus')) {
          testResult.details.push('Prometheus datasource configured');
          console.log('  ✅ Prometheus datasource configured');
        } else {
          testResult.errors.push('Prometheus datasource not found');
          testResult.status = 'FAIL';
        }
      } else {
        testResult.errors.push('Datasource configuration missing');
        testResult.status = 'FAIL';
      }

      // Check dashboards provisioning
      const dashboardProvisioningPath = path.join(provisioningPath, 'dashboards/dashboard.yml');
      if (fs.existsSync(dashboardProvisioningPath)) {
        testResult.details.push('Dashboard provisioning configured');
        console.log('  ✅ Dashboard provisioning configured');
      } else {
        testResult.errors.push('Dashboard provisioning missing');
        testResult.status = 'FAIL';
      }

      if (testResult.status === 'PASS') {
        this.results.passedTests++;
      } else {
        this.results.failedTests++;
      }

    } catch (error) {
      testResult.status = 'FAIL';
      testResult.errors.push(`Provisioning validation error: ${error.message}`);
      this.results.failedTests++;
      console.log(`  ❌ Provisioning validation failed: ${error.message}`);
    }

    this.results.totalTests++;
  }

  /**
   * Generate comprehensive test report
   */
  generateTestReport() {
    console.log('\n📋 Generating Test Report...\n');

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: this.results.totalTests,
        passedTests: this.results.passedTests,
        failedTests: this.results.failedTests,
        successRate: ((this.results.passedTests / this.results.totalTests) * 100).toFixed(2)
      },
      results: this.results
    };

    // Save report to file
    const reportPath = path.join(__dirname, '../grafana-dashboard-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Display summary
    console.log('='.repeat(60));
    console.log('📊 GRAFANA DASHBOARD SYSTEM TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.passedTests}`);
    console.log(`Failed: ${report.summary.failedTests}`);
    console.log(`Success Rate: ${report.summary.successRate}%`);
    console.log('='.repeat(60));

    if (this.results.failedTests > 0) {
      console.log('\n❌ FAILED TESTS:');
      [
        ...this.results.dashboardValidation.filter(t => t.status === 'FAIL'),
        this.results.connectivityTest,
        this.results.alertingTest
      ].filter(Boolean).forEach(test => {
        if (test.status === 'FAIL') {
          console.log(`\n• ${test.test}:`);
          test.errors.forEach(error => console.log(`  - ${error}`));
        }
      });
    }

    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    // Exit with appropriate code
    if (this.results.failedTests > 0) {
      console.log('\n❌ Some tests failed. Please review the issues above.');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed! Grafana dashboard system is ready.');
      process.exit(0);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new GrafanaDashboardTester();
  tester.runAllTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = GrafanaDashboardTester;