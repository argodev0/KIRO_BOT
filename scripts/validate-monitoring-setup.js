#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class MonitoringValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.passed = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '✅';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  error(message) {
    this.errors.push(message);
    this.log(message, 'error');
  }

  warning(message) {
    this.warnings.push(message);
    this.log(message, 'warning');
  }

  pass(message) {
    this.passed.push(message);
    this.log(message, 'pass');
  }

  // Validate Grafana dashboard files
  validateGrafanaDashboards() {
    this.log('\n=== Validating Grafana Dashboards ===');
    
    const dashboardDir = path.join(__dirname, '../monitoring/grafana/dashboards');
    const expectedDashboards = [
      'trading-bot-overview.json',
      'paper-trading-safety.json',
      'system-metrics.json',
      'trading-metrics.json',
      'real-time-data-feeds.json'
    ];

    if (!fs.existsSync(dashboardDir)) {
      this.error(`Dashboard directory does not exist: ${dashboardDir}`);
      return;
    }

    for (const dashboard of expectedDashboards) {
      const dashboardPath = path.join(dashboardDir, dashboard);
      
      if (!fs.existsSync(dashboardPath)) {
        this.error(`Dashboard file missing: ${dashboard}`);
        continue;
      }

      try {
        const content = fs.readFileSync(dashboardPath, 'utf8');
        const dashboardJson = JSON.parse(content);
        
        // Validate dashboard structure
        if (!dashboardJson.title) {
          this.error(`Dashboard ${dashboard} missing title`);
        } else {
          this.pass(`Dashboard ${dashboard} has valid title: ${dashboardJson.title}`);
        }

        if (!dashboardJson.panels || !Array.isArray(dashboardJson.panels)) {
          this.error(`Dashboard ${dashboard} missing or invalid panels`);
        } else {
          this.pass(`Dashboard ${dashboard} has ${dashboardJson.panels.length} panels`);
        }

        // Validate panel queries
        let validQueries = 0;
        for (const panel of dashboardJson.panels) {
          if (panel.targets && Array.isArray(panel.targets)) {
            for (const target of panel.targets) {
              if (target.expr) {
                validQueries++;
              }
            }
          }
        }
        
        if (validQueries > 0) {
          this.pass(`Dashboard ${dashboard} has ${validQueries} valid Prometheus queries`);
        } else {
          this.warning(`Dashboard ${dashboard} has no Prometheus queries`);
        }

      } catch (error) {
        this.error(`Dashboard ${dashboard} has invalid JSON: ${error.message}`);
      }
    }
  }

  // Validate Prometheus alert rules
  validatePrometheusAlerts() {
    this.log('\n=== Validating Prometheus Alert Rules ===');
    
    const rulesDir = path.join(__dirname, '../monitoring/prometheus/rules');
    const expectedRuleFiles = [
      'trading-bot-alerts.yml',
      'paper-trading-safety-alerts.yml',
      'real-time-data-alerts.yml'
    ];

    if (!fs.existsSync(rulesDir)) {
      this.error(`Rules directory does not exist: ${rulesDir}`);
      return;
    }

    for (const ruleFile of expectedRuleFiles) {
      const rulePath = path.join(rulesDir, ruleFile);
      
      if (!fs.existsSync(rulePath)) {
        this.error(`Alert rule file missing: ${ruleFile}`);
        continue;
      }

      try {
        const content = fs.readFileSync(rulePath, 'utf8');
        
        // Basic YAML validation (simple check)
        if (!content.includes('groups:')) {
          this.error(`Alert rule file ${ruleFile} missing groups section`);
          continue;
        }

        // Count alert rules
        const alertMatches = content.match(/- alert:/g);
        const alertCount = alertMatches ? alertMatches.length : 0;
        
        if (alertCount > 0) {
          this.pass(`Alert rule file ${ruleFile} contains ${alertCount} alert rules`);
        } else {
          this.warning(`Alert rule file ${ruleFile} contains no alert rules`);
        }

        // Check for required alert types
        const requiredAlerts = {
          'paper-trading-safety-alerts.yml': [
            'PaperTradingModeDisabled',
            'RealTradingAttemptDetected',
            'APIKeyPermissionViolation'
          ],
          'real-time-data-alerts.yml': [
            'AllExchangeConnectionsLost',
            'MarketDataStale',
            'WebSocketServerDown'
          ],
          'trading-bot-alerts.yml': [
            'TradingBotDown',
            'HighErrorRate',
            'PostgreSQLDown'
          ]
        };

        if (requiredAlerts[ruleFile]) {
          for (const requiredAlert of requiredAlerts[ruleFile]) {
            if (content.includes(`alert: ${requiredAlert}`)) {
              this.pass(`Required alert rule found: ${requiredAlert}`);
            } else {
              this.error(`Required alert rule missing: ${requiredAlert} in ${ruleFile}`);
            }
          }
        }

      } catch (error) {
        this.error(`Failed to validate alert rule file ${ruleFile}: ${error.message}`);
      }
    }
  }

  // Validate monitoring configuration files
  validateMonitoringConfig() {
    this.log('\n=== Validating Monitoring Configuration ===');
    
    const configFiles = [
      '../monitoring/prometheus/prometheus-prod.yml',
      '../monitoring/alertmanager/alertmanager-prod.yml',
      '../monitoring/grafana/provisioning/datasources/datasource.yml',
      '../monitoring/grafana/provisioning/dashboards/dashboard.yml'
    ];

    for (const configFile of configFiles) {
      const configPath = path.join(__dirname, configFile);
      
      if (!fs.existsSync(configPath)) {
        this.error(`Configuration file missing: ${configFile}`);
        continue;
      }

      try {
        const content = fs.readFileSync(configPath, 'utf8');
        
        // Validate Prometheus config
        if (configFile.includes('prometheus-prod.yml')) {
          if (content.includes('scrape_configs:')) {
            this.pass('Prometheus configuration has scrape configs');
          } else {
            this.error('Prometheus configuration missing scrape configs');
          }
          
          if (content.includes('rule_files:')) {
            this.pass('Prometheus configuration has rule files');
          } else {
            this.error('Prometheus configuration missing rule files');
          }
        }

        // Validate AlertManager config
        if (configFile.includes('alertmanager-prod.yml')) {
          if (content.includes('receivers:')) {
            this.pass('AlertManager configuration has receivers');
          } else {
            this.error('AlertManager configuration missing receivers');
          }
          
          if (content.includes('route:')) {
            this.pass('AlertManager configuration has routing');
          } else {
            this.error('AlertManager configuration missing routing');
          }
        }

        // Validate Grafana datasource config
        if (configFile.includes('datasource.yml')) {
          if (content.includes('prometheus')) {
            this.pass('Grafana datasource configuration includes Prometheus');
          } else {
            this.error('Grafana datasource configuration missing Prometheus');
          }
        }

      } catch (error) {
        this.error(`Failed to validate configuration file ${configFile}: ${error.message}`);
      }
    }
  }

  // Validate Docker monitoring setup
  validateDockerConfig() {
    this.log('\n=== Validating Docker Monitoring Configuration ===');
    
    const dockerFiles = [
      '../monitoring/docker-compose.monitoring.yml',
      '../monitoring/production-monitoring.yml'
    ];

    for (const dockerFile of dockerFiles) {
      const dockerPath = path.join(__dirname, dockerFile);
      
      if (!fs.existsSync(dockerPath)) {
        this.error(`Docker configuration file missing: ${dockerFile}`);
        continue;
      }

      try {
        const content = fs.readFileSync(dockerPath, 'utf8');
        
        // Check for required services
        const requiredServices = [
          'prometheus',
          'grafana',
          'alertmanager',
          'node-exporter'
        ];

        for (const service of requiredServices) {
          if (content.includes(`${service}:`)) {
            this.pass(`Docker config includes ${service} service`);
          } else {
            this.error(`Docker config missing ${service} service`);
          }
        }

        // Check for volume mounts
        if (content.includes('volumes:')) {
          this.pass(`Docker config includes volume definitions`);
        } else {
          this.warning(`Docker config missing volume definitions`);
        }

      } catch (error) {
        this.error(`Failed to validate Docker configuration ${dockerFile}: ${error.message}`);
      }
    }
  }

  // Validate monitoring service files
  validateMonitoringServices() {
    this.log('\n=== Validating Monitoring Service Files ===');
    
    const serviceFiles = [
      '../src/services/MonitoringService.ts',
      '../src/services/PaperTradingSafetyMonitor.ts',
      '../src/services/RealTimeDataMonitor.ts',
      '../src/services/AlertNotificationService.ts'
    ];

    for (const serviceFile of serviceFiles) {
      const servicePath = path.join(__dirname, serviceFile);
      
      if (!fs.existsSync(servicePath)) {
        this.error(`Monitoring service file missing: ${serviceFile}`);
        continue;
      }

      try {
        const content = fs.readFileSync(servicePath, 'utf8');
        
        // Check for required imports
        if (content.includes('prom-client')) {
          this.pass(`Service ${serviceFile} imports prom-client`);
        } else {
          this.error(`Service ${serviceFile} missing prom-client import`);
        }

        // Check for metric definitions
        const metricTypes = ['Counter', 'Gauge', 'Histogram'];
        let hasMetrics = false;
        
        for (const metricType of metricTypes) {
          if (content.includes(`new ${metricType}(`)) {
            hasMetrics = true;
            break;
          }
        }
        
        if (hasMetrics) {
          this.pass(`Service ${serviceFile} defines Prometheus metrics`);
        } else {
          this.warning(`Service ${serviceFile} may not define Prometheus metrics`);
        }

        // Check for singleton pattern (if applicable)
        if (content.includes('getInstance()')) {
          this.pass(`Service ${serviceFile} implements singleton pattern`);
        }

      } catch (error) {
        this.error(`Failed to validate service file ${serviceFile}: ${error.message}`);
      }
    }
  }

  // Test metric endpoints (if services are running)
  testMetricEndpoints() {
    this.log('\n=== Testing Metric Endpoints ===');
    this.warning('Endpoint testing requires services to be running - skipping for file validation');
  }

  // Validate alert rule syntax (basic)
  validateAlertRuleSyntax() {
    this.log('\n=== Validating Alert Rule Syntax ===');
    
    const rulesDir = path.join(__dirname, '../monitoring/prometheus/rules');
    
    if (!fs.existsSync(rulesDir)) {
      this.error('Rules directory does not exist');
      return;
    }

    const ruleFiles = fs.readdirSync(rulesDir).filter(file => file.endsWith('.yml'));
    
    for (const ruleFile of ruleFiles) {
      const rulePath = path.join(rulesDir, ruleFile);
      const content = fs.readFileSync(rulePath, 'utf8');
      
      // Check for common syntax issues
      const lines = content.split('\n');
      let lineNumber = 0;
      
      for (const line of lines) {
        lineNumber++;
        
        // Check for proper indentation in YAML
        if (line.trim().startsWith('- alert:') && !line.startsWith('      - alert:') && !line.startsWith('  - alert:')) {
          // This is a basic check - real YAML validation would be more complex
        }
        
        // Check for required fields in alert rules
        if (line.includes('- alert:')) {
          const parts = line.split('- alert:');
          if (parts.length > 1) {
            const alertName = parts[1].trim();
            if (alertName) {
              this.pass(`Found alert rule: ${alertName} in ${ruleFile}`);
            }
          }
        }
      }
    }
  }

  // Generate validation report
  generateReport() {
    this.log('\n=== Monitoring Setup Validation Report ===');
    
    const total = this.passed.length + this.warnings.length + this.errors.length;
    
    this.log(`\nSummary:`);
    this.log(`✅ Passed: ${this.passed.length}`);
    this.log(`⚠️  Warnings: ${this.warnings.length}`);
    this.log(`❌ Errors: ${this.errors.length}`);
    this.log(`📊 Total Checks: ${total}`);
    
    if (this.errors.length > 0) {
      this.log('\n❌ Critical Issues Found:');
      this.errors.forEach(error => this.log(`   - ${error}`));
    }
    
    if (this.warnings.length > 0) {
      this.log('\n⚠️  Warnings:');
      this.warnings.forEach(warning => this.log(`   - ${warning}`));
    }
    
    const successRate = total > 0 ? ((this.passed.length / total) * 100).toFixed(1) : 0;
    this.log(`\n📈 Success Rate: ${successRate}%`);
    
    if (this.errors.length === 0) {
      this.log('\n🎉 Monitoring setup validation completed successfully!');
      return true;
    } else {
      this.log('\n🚨 Monitoring setup validation failed. Please fix the errors above.');
      return false;
    }
  }

  // Run all validations
  async runAllValidations() {
    this.log('🔍 Starting monitoring setup validation...\n');
    
    this.validateGrafanaDashboards();
    this.validatePrometheusAlerts();
    this.validateMonitoringConfig();
    this.validateDockerConfig();
    this.validateMonitoringServices();
    this.validateAlertRuleSyntax();
    
    // Test endpoints (optional - may not be running)
    this.testMetricEndpoints();
    
    return this.generateReport();
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new MonitoringValidator();
  
  validator.runAllValidations()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Validation failed with error:', error);
      process.exit(1);
    });
}

module.exports = MonitoringValidator;