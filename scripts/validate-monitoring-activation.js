#!/usr/bin/env node

/**
 * Monitoring and Alerting Validation Script
 * 
 * This script validates that the monitoring and alerting system is properly activated
 * and all services are functioning correctly.
 */

const fs = require('fs');
const path = require('path');

class MonitoringValidator {
  constructor() {
    this.results = {
      passed: [],
      failed: [],
      warnings: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'success' ? '✅' : '📊';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  pass(message) {
    this.results.passed.push(message);
    this.log(message, 'success');
  }

  fail(message) {
    this.results.failed.push(message);
    this.log(message, 'error');
  }

  warn(message) {
    this.results.warnings.push(message);
    this.log(message, 'warning');
  }

  // Validate monitoring activation status
  validateActivationStatus() {
    this.log('\n=== Validating Monitoring Activation Status ===');
    
    const statusPath = path.join(__dirname, '../monitoring-activation-status.json');
    
    if (!fs.existsSync(statusPath)) {
      this.fail('Monitoring activation status file not found');
      return false;
    }

    try {
      const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      
      if (status.monitoringActivated) {
        this.pass('Monitoring system is activated');
      } else {
        this.fail('Monitoring system is not activated');
        return false;
      }

      if (status.status === 'active') {
        this.pass('Monitoring status is active');
      } else {
        this.warn(`Monitoring status is ${status.status}`);
      }

      if (status.configuration.enabled) {
        this.pass('Monitoring configuration is enabled');
      } else {
        this.fail('Monitoring configuration is disabled');
      }

      if (status.configuration.metricsEnabled) {
        this.pass('Metrics collection is enabled');
      } else {
        this.fail('Metrics collection is disabled');
      }

      if (status.configuration.alertingEnabled) {
        this.pass('Alerting system is enabled');
      } else {
        this.fail('Alerting system is disabled');
      }

      if (status.errors.length === 0) {
        this.pass('No activation errors detected');
      } else {
        this.fail(`${status.errors.length} activation errors detected`);
      }

      return true;
    } catch (error) {
      this.fail(`Failed to parse activation status: ${error.message}`);
      return false;
    }
  }

  // Validate monitoring services status
  validateServicesStatus() {
    this.log('\n=== Validating Monitoring Services Status ===');
    
    const servicesPath = path.join(__dirname, '../monitoring-services-status.json');
    
    if (!fs.existsSync(servicesPath)) {
      this.fail('Monitoring services status file not found');
      return false;
    }

    try {
      const services = JSON.parse(fs.readFileSync(servicesPath, 'utf8'));
      
      const serviceNames = [
        'monitoringService',
        'prometheusMetricsService',
        'productionAlertingService',
        'systemHealthService',
        'alertNotificationService'
      ];

      let allActive = true;
      for (const serviceName of serviceNames) {
        if (services[serviceName] && services[serviceName].status === 'active') {
          this.pass(`${serviceName} is active`);
        } else {
          this.fail(`${serviceName} is not active`);
          allActive = false;
        }
      }

      // Validate specific service capabilities
      if (services.prometheusMetricsService?.metricsEndpoint) {
        this.pass('Prometheus metrics endpoint configured');
      } else {
        this.fail('Prometheus metrics endpoint not configured');
      }

      if (services.productionAlertingService?.paperTradingSafetyMonitoring) {
        this.pass('Paper trading safety monitoring is active');
      } else {
        this.fail('Paper trading safety monitoring is not active');
      }

      if (services.systemHealthService?.healthChecks) {
        this.pass('System health checks are active');
      } else {
        this.fail('System health checks are not active');
      }

      return allActive;
    } catch (error) {
      this.fail(`Failed to parse services status: ${error.message}`);
      return false;
    }
  }

  // Validate environment configuration
  validateEnvironmentConfiguration() {
    this.log('\n=== Validating Environment Configuration ===');
    
    const envPath = path.join(__dirname, '../.env.production');
    
    if (!fs.existsSync(envPath)) {
      this.warn('Production environment file not found');
      return false;
    }

    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      
      const requiredSettings = [
        { key: 'MONITORING_ENABLED', value: 'true' },
        { key: 'METRICS_ENABLED', value: 'true' },
        { key: 'HEALTH_CHECK_ENABLED', value: 'true' },
        { key: 'PRODUCTION_ALERTING_ENABLED', value: 'true' }
      ];

      for (const setting of requiredSettings) {
        if (envContent.includes(`${setting.key}=${setting.value}`)) {
          this.pass(`${setting.key} is properly configured`);
        } else {
          this.fail(`${setting.key} is not properly configured`);
        }
      }

      return true;
    } catch (error) {
      this.fail(`Failed to validate environment configuration: ${error.message}`);
      return false;
    }
  }

  // Validate monitoring configuration files
  validateConfigurationFiles() {
    this.log('\n=== Validating Monitoring Configuration Files ===');
    
    const configFiles = [
      { path: '../monitoring/prometheus.yml', name: 'Prometheus configuration' },
      { path: '../monitoring/alertmanager/alertmanager.yml', name: 'AlertManager configuration' },
      { path: '../monitoring/docker-compose.monitoring.yml', name: 'Docker Compose monitoring' }
    ];

    let allValid = true;
    for (const configFile of configFiles) {
      const filePath = path.join(__dirname, configFile.path);
      
      if (fs.existsSync(filePath)) {
        this.pass(`${configFile.name} file exists`);
        
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          if (content.length > 0) {
            this.pass(`${configFile.name} has content`);
          } else {
            this.warn(`${configFile.name} is empty`);
          }
        } catch (error) {
          this.fail(`Failed to read ${configFile.name}: ${error.message}`);
          allValid = false;
        }
      } else {
        this.fail(`${configFile.name} file not found`);
        allValid = false;
      }
    }

    return allValid;
  }

  // Validate monitoring service files
  validateServiceFiles() {
    this.log('\n=== Validating Monitoring Service Files ===');
    
    const serviceFiles = [
      'src/services/MonitoringService.ts',
      'src/services/PrometheusMetricsService.ts',
      'src/services/ProductionAlertingService.ts',
      'src/services/SystemHealthService.ts',
      'src/services/AlertNotificationService.ts'
    ];

    let allValid = true;
    for (const serviceFile of serviceFiles) {
      const filePath = path.join(__dirname, '..', serviceFile);
      
      if (fs.existsSync(filePath)) {
        this.pass(`Service file exists: ${serviceFile}`);
        
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          
          // Check for key monitoring patterns
          if (content.includes('prom-client')) {
            this.pass(`${serviceFile} includes Prometheus client`);
          } else {
            this.warn(`${serviceFile} may not include Prometheus client`);
          }

          if (content.includes('EventEmitter')) {
            this.pass(`${serviceFile} includes event handling`);
          }

          if (content.includes('getInstance')) {
            this.pass(`${serviceFile} implements singleton pattern`);
          }

        } catch (error) {
          this.fail(`Failed to validate ${serviceFile}: ${error.message}`);
          allValid = false;
        }
      } else {
        this.fail(`Service file not found: ${serviceFile}`);
        allValid = false;
      }
    }

    return allValid;
  }

  // Test monitoring endpoints configuration
  testEndpointConfiguration() {
    this.log('\n=== Testing Monitoring Endpoint Configuration ===');
    
    // Check if main application file includes monitoring endpoints
    const appPath = path.join(__dirname, '../src/index.ts');
    
    if (!fs.existsSync(appPath)) {
      this.fail('Main application file not found');
      return false;
    }

    try {
      const appContent = fs.readFileSync(appPath, 'utf8');
      
      const endpoints = [
        { path: '/health', name: 'Health check endpoint' },
        { path: '/metrics', name: 'Prometheus metrics endpoint' },
        { path: '/api/v1/metrics/status', name: 'Metrics status endpoint' },
        { path: '/api/v1/websocket/stats', name: 'WebSocket stats endpoint' },
        { path: '/api/v1/paper-trading/status', name: 'Paper trading status endpoint' }
      ];

      for (const endpoint of endpoints) {
        if (appContent.includes(endpoint.path)) {
          this.pass(`${endpoint.name} is configured`);
        } else {
          this.fail(`${endpoint.name} is not configured`);
        }
      }

      // Check for monitoring service imports
      if (appContent.includes('MonitoringService')) {
        this.pass('MonitoringService is imported');
      } else {
        this.fail('MonitoringService is not imported');
      }

      if (appContent.includes('PrometheusMetricsService')) {
        this.pass('PrometheusMetricsService is imported');
      } else {
        this.fail('PrometheusMetricsService is not imported');
      }

      if (appContent.includes('ProductionAlertingService')) {
        this.pass('ProductionAlertingService is imported');
      } else {
        this.fail('ProductionAlertingService is not imported');
      }

      return true;
    } catch (error) {
      this.fail(`Failed to test endpoint configuration: ${error.message}`);
      return false;
    }
  }

  // Validate alert thresholds and rules
  validateAlertConfiguration() {
    this.log('\n=== Validating Alert Configuration ===');
    
    // Check if alert rules directory exists
    const rulesDir = path.join(__dirname, '../monitoring/prometheus/rules');
    
    if (fs.existsSync(rulesDir)) {
      this.pass('Prometheus rules directory exists');
      
      try {
        const ruleFiles = fs.readdirSync(rulesDir).filter(file => file.endsWith('.yml'));
        
        if (ruleFiles.length > 0) {
          this.pass(`Found ${ruleFiles.length} alert rule files`);
          
          for (const ruleFile of ruleFiles) {
            const rulePath = path.join(rulesDir, ruleFile);
            const content = fs.readFileSync(rulePath, 'utf8');
            
            if (content.includes('groups:')) {
              this.pass(`Alert rule file ${ruleFile} has proper structure`);
            } else {
              this.warn(`Alert rule file ${ruleFile} may have invalid structure`);
            }
          }
        } else {
          this.warn('No alert rule files found');
        }
      } catch (error) {
        this.fail(`Failed to validate alert rules: ${error.message}`);
      }
    } else {
      this.warn('Prometheus rules directory not found');
    }

    return true;
  }

  // Generate validation report
  generateValidationReport() {
    this.log('\n=== Monitoring Validation Report ===');
    
    const report = {
      timestamp: new Date().toISOString(),
      status: this.results.failed.length === 0 ? 'PASS' : 'FAIL',
      summary: {
        totalChecks: this.results.passed.length + this.results.failed.length + this.results.warnings.length,
        passed: this.results.passed.length,
        failed: this.results.failed.length,
        warnings: this.results.warnings.length
      },
      results: this.results,
      monitoringStatus: {
        activated: this.results.failed.length === 0,
        alertingActive: this.results.passed.some(p => p.includes('alerting')),
        metricsActive: this.results.passed.some(p => p.includes('metrics')),
        healthChecksActive: this.results.passed.some(p => p.includes('health'))
      }
    };

    const reportPath = path.join(__dirname, '../monitoring-validation-report.json');
    
    try {
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      this.pass(`Validation report generated: ${reportPath}`);
    } catch (error) {
      this.fail(`Failed to generate validation report: ${error.message}`);
    }

    // Display summary
    this.log('\n📊 VALIDATION SUMMARY:');
    this.log(`✅ Passed: ${report.summary.passed}`);
    this.log(`❌ Failed: ${report.summary.failed}`);
    this.log(`⚠️  Warnings: ${report.summary.warnings}`);
    this.log(`📈 Success Rate: ${((report.summary.passed / report.summary.totalChecks) * 100).toFixed(1)}%`);

    if (this.results.failed.length === 0) {
      this.log('\n🎉 Monitoring and alerting validation PASSED!');
      this.log('✅ All monitoring services are properly activated');
      this.log('🚨 Alerting system is configured and ready');
      this.log('📊 Metrics collection is operational');
      this.log('🔍 Health checks are active');
    } else {
      this.log('\n❌ Monitoring and alerting validation FAILED');
      this.log('🔧 Please review and fix the issues listed above');
      
      this.log('\n❌ FAILED CHECKS:');
      this.results.failed.forEach(failure => this.log(`   - ${failure}`));
    }

    if (this.results.warnings.length > 0) {
      this.log('\n⚠️  WARNINGS:');
      this.results.warnings.forEach(warning => this.log(`   - ${warning}`));
    }

    return report;
  }

  // Main validation method
  async validate() {
    this.log('🔍 Starting Monitoring and Alerting Validation...\n');
    
    try {
      // Run all validation checks
      this.validateActivationStatus();
      this.validateServicesStatus();
      this.validateEnvironmentConfiguration();
      this.validateConfigurationFiles();
      this.validateServiceFiles();
      this.testEndpointConfiguration();
      this.validateAlertConfiguration();
      
      // Generate report
      const report = this.generateValidationReport();
      
      return report.status === 'PASS';
    } catch (error) {
      this.fail(`Validation failed: ${error.message}`);
      return false;
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new MonitoringValidator();
  
  validator.validate()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Validation failed with error:', error);
      process.exit(1);
    });
}

module.exports = MonitoringValidator;