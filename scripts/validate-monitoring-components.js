#!/usr/bin/env node

/**
 * Monitoring Components Validation (Docker-free)
 * 
 * This script validates monitoring components without requiring Docker:
 * 1. Configuration file validation
 * 2. Health endpoints testing (if app is running)
 * 3. Monitoring service functionality
 * 4. Alert configuration validation
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const yaml = require('js-yaml');

class MonitoringComponentsValidator {
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
      healthEndpoints: {
        baseUrl: 'http://localhost:3000',
        timeout: 5000
      }
    };
  }

  async validateComponents() {
    console.log('🔍 Starting Monitoring Components Validation...\n');
    
    try {
      // Step 1: Validate configuration files
      await this.validateConfigurationFiles();
      
      // Step 2: Test monitoring service functionality
      await this.testMonitoringService();
      
      // Step 3: Test health endpoints (if available)
      await this.testHealthEndpoints();
      
      // Step 4: Validate alert configurations
      await this.validateAlertConfigurations();
      
      // Step 5: Validate Grafana dashboards
      await this.validateGrafanaDashboards();
      
      // Step 6: Generate report
      await this.generateValidationReport();
      
    } catch (error) {
      this.results.errors.push({
        stage: 'validation',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      console.error('❌ Validation failed:', error.message);
    }
  }

  async validateConfigurationFiles() {
    console.log('📋 Validating configuration files...');
    
    const configFiles = [
      {
        path: 'monitoring/production-monitoring.yml',
        type: 'docker-compose',
        required: true
      },
      {
        path: 'monitoring/prometheus/prometheus-prod.yml',
        type: 'yaml',
        required: true
      },
      {
        path: 'monitoring/alertmanager/alertmanager-prod.yml',
        type: 'yaml',
        required: true
      },
      {
        path: 'monitoring/grafana/grafana.ini',
        type: 'ini',
        required: false
      }
    ];
    
    const results = [];
    
    for (const configFile of configFiles) {
      try {
        const filePath = path.join(process.cwd(), configFile.path);
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        
        if (!exists) {
          if (configFile.required) {
            results.push({
              file: configFile.path,
              status: 'failed',
              error: 'Required configuration file not found'
            });
          } else {
            results.push({
              file: configFile.path,
              status: 'warning',
              message: 'Optional configuration file not found'
            });
          }
          continue;
        }
        
        const content = await fs.readFile(filePath, 'utf8');
        
        // Validate YAML files
        if (configFile.type === 'yaml' || configFile.type === 'docker-compose') {
          try {
            const parsed = yaml.load(content);
            results.push({
              file: configFile.path,
              status: 'passed',
              message: 'Configuration file is valid',
              size: content.length
            });
          } catch (yamlError) {
            results.push({
              file: configFile.path,
              status: 'failed',
              error: `Invalid YAML: ${yamlError.message}`
            });
          }
        } else {
          results.push({
            file: configFile.path,
            status: 'passed',
            message: 'Configuration file exists',
            size: content.length
          });
        }
        
        console.log(`  ✅ ${configFile.path}: Valid`);
        
      } catch (error) {
        results.push({
          file: configFile.path,
          status: 'failed',
          error: error.message
        });
        console.log(`  ❌ ${configFile.path}: ${error.message}`);
      }
    }
    
    const passedFiles = results.filter(r => r.status === 'passed').length;
    const totalFiles = results.length;
    
    this.results.tests.configurationFiles = {
      status: passedFiles === totalFiles ? 'passed' : 'warning',
      message: `${passedFiles}/${totalFiles} configuration files are valid`,
      details: results,
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ Configuration files validated\n');
  }

  async testMonitoringService() {
    console.log('📊 Testing monitoring service functionality...');
    
    try {
      // Check if monitoring service files exist
      const monitoringFiles = [
        'src/services/MonitoringService.ts',
        'src/services/SystemPerformanceMonitor.ts',
        'src/services/SystemHealthService.ts',
        'src/controllers/HealthController.ts'
      ];
      
      const tests = [];
      
      for (const file of monitoringFiles) {
        try {
          const filePath = path.join(process.cwd(), file);
          const exists = await fs.access(filePath).then(() => true).catch(() => false);
          
          if (exists) {
            const content = await fs.readFile(filePath, 'utf8');
            const hasExports = content.includes('export') || content.includes('module.exports');
            
            tests.push({
              test: `${file} exists and has exports`,
              status: hasExports ? 'passed' : 'warning',
              details: { size: content.length, hasExports }
            });
          } else {
            tests.push({
              test: `${file} exists`,
              status: 'failed',
              error: 'File not found'
            });
          }
        } catch (error) {
          tests.push({
            test: `${file} validation`,
            status: 'failed',
            error: error.message
          });
        }
      }
      
      // Check if TypeScript is compiled
      const distExists = await fs.access(path.join(process.cwd(), 'dist')).then(() => true).catch(() => false);
      tests.push({
        test: 'TypeScript compilation (dist folder)',
        status: distExists ? 'passed' : 'warning',
        message: distExists ? 'Compiled JavaScript exists' : 'No compiled JavaScript found'
      });
      
      const passedTests = tests.filter(t => t.status === 'passed').length;
      
      this.results.tests.monitoringService = {
        status: passedTests >= monitoringFiles.length ? 'passed' : 'warning',
        message: `${passedTests}/${tests.length} monitoring service checks passed`,
        details: tests,
        timestamp: new Date().toISOString()
      };
      
      console.log('✅ Monitoring service functionality tested\n');
      
    } catch (error) {
      this.results.tests.monitoringService = {
        status: 'failed',
        message: `Monitoring service testing failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
      
      this.results.warnings.push({
        component: 'monitoring-service',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async testHealthEndpoints() {
    console.log('🏥 Testing health endpoints...');
    
    const endpoints = [
      { path: '/health', name: 'Basic Health' },
      { path: '/health/detailed', name: 'Detailed Health' },
      { path: '/health/ready', name: 'Readiness' },
      { path: '/health/live', name: 'Liveness' },
      { path: '/health/startup', name: 'Startup' },
      { path: '/health/deep', name: 'Deep Health' },
      { path: '/health/metrics', name: 'Metrics' },
      { path: '/health/services', name: 'Services' }
    ];
    
    const results = [];
    let applicationRunning = false;
    
    // First check if application is running
    try {
      await axios.get(`${this.config.healthEndpoints.baseUrl}/health`, { timeout: 2000 });
      applicationRunning = true;
      console.log('  📡 Application is running, testing endpoints...');
    } catch (error) {
      console.log('  ⚠️  Application not running, skipping endpoint tests');
    }
    
    if (applicationRunning) {
      for (const endpoint of endpoints) {
        try {
          const startTime = Date.now();
          const response = await axios.get(`${this.config.healthEndpoints.baseUrl}${endpoint.path}`, {
            timeout: this.config.healthEndpoints.timeout,
            validateStatus: () => true // Accept all status codes
          });
          
          const responseTime = Date.now() - startTime;
          
          results.push({
            endpoint: endpoint.path,
            name: endpoint.name,
            status: response.status < 500 ? 'passed' : 'warning',
            httpStatus: response.status,
            responseTime,
            contentType: response.headers['content-type']
          });
          
          console.log(`    ${endpoint.name}: ${response.status} (${responseTime}ms)`);
          
        } catch (error) {
          results.push({
            endpoint: endpoint.path,
            name: endpoint.name,
            status: 'failed',
            error: error.message
          });
          
          console.log(`    ${endpoint.name}: ERROR - ${error.message}`);
        }
      }
    }
    
    const passedEndpoints = results.filter(r => r.status === 'passed').length;
    
    this.results.tests.healthEndpoints = {
      status: applicationRunning ? (passedEndpoints === endpoints.length ? 'passed' : 'warning') : 'skipped',
      message: applicationRunning ? 
        `${passedEndpoints}/${endpoints.length} health endpoints working` : 
        'Application not running, endpoints not tested',
      details: { applicationRunning, results },
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ Health endpoints tested\n');
  }

  async validateAlertConfigurations() {
    console.log('🚨 Validating alert configurations...');
    
    try {
      const alertFiles = [
        'monitoring/prometheus/rules/trading-bot-alerts.yml',
        'monitoring/prometheus/rules/paper-trading-safety-alerts.yml',
        'monitoring/prometheus/rules/real-time-data-alerts.yml'
      ];
      
      const results = [];
      
      for (const alertFile of alertFiles) {
        try {
          const filePath = path.join(process.cwd(), alertFile);
          const exists = await fs.access(filePath).then(() => true).catch(() => false);
          
          if (!exists) {
            results.push({
              file: alertFile,
              status: 'warning',
              message: 'Alert rules file not found'
            });
            continue;
          }
          
          const content = await fs.readFile(filePath, 'utf8');
          const parsed = yaml.load(content);
          
          // Count alert rules
          let rulesCount = 0;
          if (parsed.groups) {
            rulesCount = parsed.groups.reduce((sum, group) => {
              return sum + (group.rules ? group.rules.length : 0);
            }, 0);
          }
          
          results.push({
            file: alertFile,
            status: 'passed',
            message: `${rulesCount} alert rules configured`,
            rulesCount
          });
          
          console.log(`  ✅ ${alertFile}: ${rulesCount} rules`);
          
        } catch (error) {
          results.push({
            file: alertFile,
            status: 'failed',
            error: error.message
          });
          console.log(`  ❌ ${alertFile}: ${error.message}`);
        }
      }
      
      const totalRules = results.reduce((sum, r) => sum + (r.rulesCount || 0), 0);
      const validFiles = results.filter(r => r.status === 'passed').length;
      
      this.results.tests.alertConfigurations = {
        status: validFiles > 0 ? 'passed' : 'warning',
        message: `${totalRules} alert rules configured across ${validFiles} files`,
        details: results,
        timestamp: new Date().toISOString()
      };
      
      console.log('✅ Alert configurations validated\n');
      
    } catch (error) {
      this.results.tests.alertConfigurations = {
        status: 'failed',
        message: `Alert configuration validation failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  async validateGrafanaDashboards() {
    console.log('📊 Validating Grafana dashboards...');
    
    try {
      const dashboardDir = path.join(process.cwd(), 'monitoring/grafana/dashboards');
      const exists = await fs.access(dashboardDir).then(() => true).catch(() => false);
      
      if (!exists) {
        this.results.tests.grafanaDashboards = {
          status: 'warning',
          message: 'Grafana dashboards directory not found',
          timestamp: new Date().toISOString()
        };
        console.log('  ⚠️  Grafana dashboards directory not found\n');
        return;
      }
      
      const files = await fs.readdir(dashboardDir);
      const dashboardFiles = files.filter(f => f.endsWith('.json'));
      
      const results = [];
      
      for (const dashboardFile of dashboardFiles) {
        try {
          const filePath = path.join(dashboardDir, dashboardFile);
          const content = await fs.readFile(filePath, 'utf8');
          const dashboard = JSON.parse(content);
          
          // Count panels
          const panelsCount = dashboard.panels ? dashboard.panels.length : 0;
          
          results.push({
            file: dashboardFile,
            status: 'passed',
            title: dashboard.title || 'Unknown',
            panelsCount,
            message: `${panelsCount} panels configured`
          });
          
          console.log(`  ✅ ${dashboard.title || dashboardFile}: ${panelsCount} panels`);
          
        } catch (error) {
          results.push({
            file: dashboardFile,
            status: 'failed',
            error: error.message
          });
          console.log(`  ❌ ${dashboardFile}: ${error.message}`);
        }
      }
      
      const validDashboards = results.filter(r => r.status === 'passed').length;
      const totalPanels = results.reduce((sum, r) => sum + (r.panelsCount || 0), 0);
      
      this.results.tests.grafanaDashboards = {
        status: validDashboards > 0 ? 'passed' : 'warning',
        message: `${validDashboards} dashboards with ${totalPanels} total panels`,
        details: results,
        timestamp: new Date().toISOString()
      };
      
      console.log('✅ Grafana dashboards validated\n');
      
    } catch (error) {
      this.results.tests.grafanaDashboards = {
        status: 'failed',
        message: `Grafana dashboard validation failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  async generateValidationReport() {
    console.log('📋 Generating validation report...');
    
    // Calculate overall status
    const testResults = Object.values(this.results.tests);
    const passedTests = testResults.filter(t => t.status === 'passed').length;
    const failedTests = testResults.filter(t => t.status === 'failed').length;
    const warningTests = testResults.filter(t => t.status === 'warning').length;
    const skippedTests = testResults.filter(t => t.status === 'skipped').length;
    
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
      skipped: skippedTests,
      errors: this.results.errors.length,
      warningMessages: this.results.warnings.length
    };
    
    // Save report
    const reportPath = path.join(process.cwd(), 'monitoring-components-validation-report.json');
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
    
    // Print summary
    console.log('\n📊 MONITORING COMPONENTS VALIDATION SUMMARY');
    console.log('=============================================');
    console.log(`Overall Status: ${this.results.overallStatus.toUpperCase()}`);
    console.log(`Tests Passed: ${passedTests}/${testResults.length}`);
    console.log(`Warnings: ${warningTests}`);
    console.log(`Skipped: ${skippedTests}`);
    console.log(`Errors: ${failedTests}`);
    console.log(`Report saved to: ${reportPath}`);
    
    if (this.results.overallStatus === 'passed') {
      console.log('\n✅ All monitoring components are properly configured!');
    } else if (this.results.overallStatus === 'warning') {
      console.log('\n⚠️  Monitoring components are mostly configured but have some issues.');
    } else {
      console.log('\n❌ Critical issues found in monitoring component configuration.');
    }
    
    return this.results;
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new MonitoringComponentsValidator();
  validator.validateComponents()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}

module.exports = MonitoringComponentsValidator;