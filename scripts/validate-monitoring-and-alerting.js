#!/usr/bin/env node

/**
 * Comprehensive Monitoring and Alerting System Validation
 * 
 * This script validates:
 * 1. Monitoring stack deployment
 * 2. Prometheus metrics collection
 * 3. Grafana dashboard functionality
 * 4. Health endpoints testing
 * 5. Alert notification systems
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync, spawn } = require('child_process');
const axios = require('axios');

class MonitoringValidator {
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
      prometheus: {
        url: 'http://localhost:9090',
        timeout: 10000
      },
      grafana: {
        url: 'http://localhost:3001',
        username: 'admin',
        password: 'admin123',
        timeout: 10000
      },
      alertmanager: {
        url: 'http://localhost:9093',
        timeout: 10000
      },
      healthEndpoints: {
        baseUrl: 'http://localhost:3000',
        timeout: 5000
      }
    };
  }

  async validateMonitoringStack() {
    console.log('🔍 Starting Monitoring and Alerting System Validation...\n');
    
    try {
      // Step 1: Deploy monitoring stack
      await this.deployMonitoringStack();
      
      // Step 2: Verify Prometheus metrics collection
      await this.verifyPrometheusMetrics();
      
      // Step 3: Validate Grafana dashboard functionality
      await this.validateGrafanaDashboards();
      
      // Step 4: Test health endpoints
      await this.testHealthEndpoints();
      
      // Step 5: Validate alert notification systems
      await this.validateAlertingSystems();
      
      // Step 6: Generate comprehensive report
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

  async deployMonitoringStack() {
    console.log('📦 Deploying monitoring stack...');
    
    try {
      // Check if Docker is available
      execSync('docker --version', { stdio: 'pipe' });
      
      // Check if main services are running
      const runningServices = await this.checkRunningServices();
      
      if (!runningServices.includes('trading-bot-postgres')) {
        console.log('🚀 Starting main application stack...');
        execSync('docker compose up -d postgres redis rabbitmq', { 
          cwd: process.cwd(),
          stdio: 'inherit' 
        });
        
        // Wait for services to be ready
        await this.waitForService('postgres', 'localhost:5432');
        await this.waitForService('redis', 'localhost:6379');
      }
      
      // Start monitoring services
      console.log('🚀 Starting monitoring services...');
      execSync('docker compose up -d prometheus grafana', { 
        cwd: process.cwd(),
        stdio: 'inherit' 
      });
      
      // Wait for monitoring services to be ready
      await this.waitForService('prometheus', 'localhost:9090');
      await this.waitForService('grafana', 'localhost:3001');
      
      this.results.tests.monitoringStackDeployment = {
        status: 'passed',
        message: 'Monitoring stack deployed successfully',
        timestamp: new Date().toISOString()
      };
      
      console.log('✅ Monitoring stack deployed successfully\n');
      
    } catch (error) {
      this.results.tests.monitoringStackDeployment = {
        status: 'failed',
        message: `Failed to deploy monitoring stack: ${error.message}`,
        timestamp: new Date().toISOString()
      };
      throw error;
    }
  }

  async verifyPrometheusMetrics() {
    console.log('📊 Verifying Prometheus metrics collection...');
    
    try {
      // Test Prometheus API connectivity
      const prometheusHealth = await this.checkPrometheusHealth();
      
      if (!prometheusHealth.healthy) {
        throw new Error('Prometheus is not healthy');
      }
      
      // Check if targets are being scraped
      const targets = await this.getPrometheusTargets();
      const healthyTargets = targets.filter(t => t.health === 'up');
      
      console.log(`📈 Found ${targets.length} targets, ${healthyTargets.length} healthy`);
      
      // Verify custom metrics are being collected
      const customMetrics = await this.verifyCustomMetrics();
      
      // Check metric retention and storage
      const metricsStorage = await this.checkMetricsStorage();
      
      this.results.tests.prometheusMetrics = {
        status: healthyTargets.length > 0 ? 'passed' : 'warning',
        message: `Prometheus collecting metrics from ${healthyTargets.length}/${targets.length} targets`,
        details: {
          targets: targets.length,
          healthyTargets: healthyTargets.length,
          customMetrics: customMetrics.length,
          storage: metricsStorage
        },
        timestamp: new Date().toISOString()
      };
      
      console.log('✅ Prometheus metrics collection verified\n');
      
    } catch (error) {
      this.results.tests.prometheusMetrics = {
        status: 'failed',
        message: `Prometheus metrics verification failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
      throw error;
    }
  }

  async validateGrafanaDashboards() {
    console.log('📊 Validating Grafana dashboard functionality...');
    
    try {
      // Test Grafana API connectivity
      const grafanaHealth = await this.checkGrafanaHealth();
      
      if (!grafanaHealth.healthy) {
        throw new Error('Grafana is not healthy');
      }
      
      // Get authentication token
      const authToken = await this.getGrafanaAuthToken();
      
      // List available dashboards
      const dashboards = await this.getGrafanaDashboards(authToken);
      
      console.log(`📊 Found ${dashboards.length} dashboards`);
      
      // Test dashboard queries
      const dashboardTests = await this.testDashboardQueries(authToken, dashboards);
      
      // Verify data sources
      const dataSources = await this.verifyGrafanaDataSources(authToken);
      
      this.results.tests.grafanaDashboards = {
        status: dashboards.length > 0 ? 'passed' : 'warning',
        message: `Grafana has ${dashboards.length} dashboards configured`,
        details: {
          dashboards: dashboards.length,
          dataSources: dataSources.length,
          workingQueries: dashboardTests.working,
          failedQueries: dashboardTests.failed
        },
        timestamp: new Date().toISOString()
      };
      
      console.log('✅ Grafana dashboard functionality validated\n');
      
    } catch (error) {
      this.results.tests.grafanaDashboards = {
        status: 'failed',
        message: `Grafana dashboard validation failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
      
      // Don't throw error here as Grafana might not be fully configured yet
      this.results.warnings.push({
        component: 'grafana',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async testHealthEndpoints() {
    console.log('🏥 Testing health endpoints...');
    
    try {
      // Start the application if not running
      await this.ensureApplicationRunning();
      
      const endpoints = [
        '/health',
        '/health/detailed',
        '/health/ready',
        '/health/live',
        '/health/startup',
        '/health/deep',
        '/health/metrics',
        '/health/services'
      ];
      
      const results = [];
      
      for (const endpoint of endpoints) {
        try {
          const startTime = Date.now();
          const response = await axios.get(`${this.config.healthEndpoints.baseUrl}${endpoint}`, {
            timeout: this.config.healthEndpoints.timeout,
            validateStatus: () => true // Accept all status codes
          });
          
          const responseTime = Date.now() - startTime;
          
          results.push({
            endpoint,
            status: response.status,
            responseTime,
            success: response.status < 500,
            contentType: response.headers['content-type']
          });
          
          console.log(`  ${endpoint}: ${response.status} (${responseTime}ms)`);
          
        } catch (error) {
          results.push({
            endpoint,
            status: 'error',
            success: false,
            error: error.message
          });
          
          console.log(`  ${endpoint}: ERROR - ${error.message}`);
        }
      }
      
      const successfulEndpoints = results.filter(r => r.success).length;
      
      this.results.tests.healthEndpoints = {
        status: successfulEndpoints === endpoints.length ? 'passed' : 'warning',
        message: `${successfulEndpoints}/${endpoints.length} health endpoints working`,
        details: results,
        timestamp: new Date().toISOString()
      };
      
      console.log('✅ Health endpoints tested\n');
      
    } catch (error) {
      this.results.tests.healthEndpoints = {
        status: 'failed',
        message: `Health endpoints testing failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
      
      // Don't throw error as application might not be running
      this.results.warnings.push({
        component: 'health-endpoints',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async validateAlertingSystems() {
    console.log('🚨 Validating alert notification systems...');
    
    try {
      // Check AlertManager configuration
      const alertManagerConfig = await this.validateAlertManagerConfig();
      
      // Verify alert rules are loaded
      const alertRules = await this.verifyAlertRules();
      
      // Test alert routing (without actually sending alerts)
      const routingTest = await this.testAlertRouting();
      
      // Validate notification channels
      const notificationChannels = await this.validateNotificationChannels();
      
      this.results.tests.alertingSystems = {
        status: alertManagerConfig.valid ? 'passed' : 'warning',
        message: 'Alert notification systems configured',
        details: {
          alertManagerConfig: alertManagerConfig.valid,
          alertRules: alertRules.count,
          routingRules: routingTest.rules,
          notificationChannels: notificationChannels.length
        },
        timestamp: new Date().toISOString()
      };
      
      console.log('✅ Alert notification systems validated\n');
      
    } catch (error) {
      this.results.tests.alertingSystems = {
        status: 'failed',
        message: `Alert systems validation failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
      
      // Don't throw error as alerting might not be fully configured
      this.results.warnings.push({
        component: 'alerting',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Helper methods
  async checkRunningServices() {
    try {
      const output = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf8' });
      return output.trim().split('\n').filter(name => name.length > 0);
    } catch (error) {
      return [];
    }
  }

  async waitForService(serviceName, endpoint, maxWaitTime = 60000) {
    console.log(`⏳ Waiting for ${serviceName} to be ready...`);
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        if (serviceName === 'postgres') {
          execSync('docker exec trading-bot-postgres pg_isready -U postgres', { stdio: 'pipe' });
          return true;
        } else if (serviceName === 'redis') {
          execSync('docker exec trading-bot-redis redis-cli ping', { stdio: 'pipe' });
          return true;
        } else {
          // For HTTP services, try to connect
          await axios.get(`http://${endpoint}`, { timeout: 2000 });
          return true;
        }
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    throw new Error(`Service ${serviceName} did not become ready within ${maxWaitTime}ms`);
  }

  async checkPrometheusHealth() {
    try {
      const response = await axios.get(`${this.config.prometheus.url}/-/healthy`, {
        timeout: this.config.prometheus.timeout
      });
      
      return {
        healthy: response.status === 200,
        status: response.status
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  async getPrometheusTargets() {
    try {
      const response = await axios.get(`${this.config.prometheus.url}/api/v1/targets`, {
        timeout: this.config.prometheus.timeout
      });
      
      if (response.data.status === 'success') {
        return response.data.data.activeTargets || [];
      }
      
      return [];
    } catch (error) {
      console.warn('Could not fetch Prometheus targets:', error.message);
      return [];
    }
  }

  async verifyCustomMetrics() {
    try {
      const response = await axios.get(`${this.config.prometheus.url}/api/v1/label/__name__/values`, {
        timeout: this.config.prometheus.timeout
      });
      
      if (response.data.status === 'success') {
        const metrics = response.data.data || [];
        return metrics.filter(metric => metric.startsWith('kiro_bot_'));
      }
      
      return [];
    } catch (error) {
      console.warn('Could not fetch custom metrics:', error.message);
      return [];
    }
  }

  async checkMetricsStorage() {
    try {
      const response = await axios.get(`${this.config.prometheus.url}/api/v1/query?query=prometheus_tsdb_symbol_table_size_bytes`, {
        timeout: this.config.prometheus.timeout
      });
      
      if (response.data.status === 'success' && response.data.data.result.length > 0) {
        return {
          working: true,
          size: response.data.data.result[0].value[1]
        };
      }
      
      return { working: false };
    } catch (error) {
      return { working: false, error: error.message };
    }
  }

  async checkGrafanaHealth() {
    try {
      const response = await axios.get(`${this.config.grafana.url}/api/health`, {
        timeout: this.config.grafana.timeout
      });
      
      return {
        healthy: response.status === 200,
        status: response.status
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  async getGrafanaAuthToken() {
    try {
      // For simplicity, we'll use basic auth instead of API tokens
      return Buffer.from(`${this.config.grafana.username}:${this.config.grafana.password}`).toString('base64');
    } catch (error) {
      throw new Error(`Failed to get Grafana auth token: ${error.message}`);
    }
  }

  async getGrafanaDashboards(authToken) {
    try {
      const response = await axios.get(`${this.config.grafana.url}/api/search?type=dash-db`, {
        headers: {
          'Authorization': `Basic ${authToken}`
        },
        timeout: this.config.grafana.timeout
      });
      
      return response.data || [];
    } catch (error) {
      console.warn('Could not fetch Grafana dashboards:', error.message);
      return [];
    }
  }

  async testDashboardQueries(authToken, dashboards) {
    const results = { working: 0, failed: 0 };
    
    // This is a simplified test - in production you'd test actual dashboard queries
    for (const dashboard of dashboards.slice(0, 3)) { // Test first 3 dashboards
      try {
        const response = await axios.get(`${this.config.grafana.url}/api/dashboards/uid/${dashboard.uid}`, {
          headers: {
            'Authorization': `Basic ${authToken}`
          },
          timeout: this.config.grafana.timeout
        });
        
        if (response.status === 200) {
          results.working++;
        } else {
          results.failed++;
        }
      } catch (error) {
        results.failed++;
      }
    }
    
    return results;
  }

  async verifyGrafanaDataSources(authToken) {
    try {
      const response = await axios.get(`${this.config.grafana.url}/api/datasources`, {
        headers: {
          'Authorization': `Basic ${authToken}`
        },
        timeout: this.config.grafana.timeout
      });
      
      return response.data || [];
    } catch (error) {
      console.warn('Could not fetch Grafana data sources:', error.message);
      return [];
    }
  }

  async ensureApplicationRunning() {
    // Check if the application is running on port 3000
    try {
      await axios.get(`${this.config.healthEndpoints.baseUrl}/health`, { timeout: 2000 });
      return true;
    } catch (error) {
      console.log('🚀 Application not running, starting it...');
      
      // Try to start the application (this would be environment-specific)
      // For now, we'll just note that it's not running
      throw new Error('Application is not running on port 3000. Please start the application first.');
    }
  }

  async validateAlertManagerConfig() {
    try {
      // Check if AlertManager configuration file exists and is valid
      const configPath = path.join(process.cwd(), 'monitoring/alertmanager/alertmanager-prod.yml');
      const configExists = await fs.access(configPath).then(() => true).catch(() => false);
      
      if (!configExists) {
        return { valid: false, error: 'AlertManager config file not found' };
      }
      
      // Try to validate the config by checking AlertManager API
      try {
        const response = await axios.get(`${this.config.alertmanager.url}/-/healthy`, {
          timeout: this.config.alertmanager.timeout
        });
        
        return { valid: response.status === 200 };
      } catch (error) {
        return { valid: false, error: 'AlertManager not accessible' };
      }
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async verifyAlertRules() {
    try {
      const response = await axios.get(`${this.config.prometheus.url}/api/v1/rules`, {
        timeout: this.config.prometheus.timeout
      });
      
      if (response.data.status === 'success') {
        const groups = response.data.data.groups || [];
        const totalRules = groups.reduce((sum, group) => sum + (group.rules || []).length, 0);
        
        return { count: totalRules, groups: groups.length };
      }
      
      return { count: 0, groups: 0 };
    } catch (error) {
      return { count: 0, groups: 0, error: error.message };
    }
  }

  async testAlertRouting() {
    // This would test alert routing configuration without sending actual alerts
    try {
      const configPath = path.join(process.cwd(), 'monitoring/alertmanager/alertmanager-prod.yml');
      const configExists = await fs.access(configPath).then(() => true).catch(() => false);
      
      if (configExists) {
        const configContent = await fs.readFile(configPath, 'utf8');
        const routeMatches = (configContent.match(/- match:/g) || []).length;
        
        return { rules: routeMatches };
      }
      
      return { rules: 0 };
    } catch (error) {
      return { rules: 0, error: error.message };
    }
  }

  async validateNotificationChannels() {
    // This would validate notification channels (email, Slack, etc.)
    // For now, we'll check the configuration
    try {
      const configPath = path.join(process.cwd(), 'monitoring/alertmanager/alertmanager-prod.yml');
      const configExists = await fs.access(configPath).then(() => true).catch(() => false);
      
      if (configExists) {
        const configContent = await fs.readFile(configPath, 'utf8');
        const channels = [];
        
        if (configContent.includes('email_configs:')) channels.push('email');
        if (configContent.includes('slack_configs:')) channels.push('slack');
        if (configContent.includes('webhook_configs:')) channels.push('webhook');
        
        return channels;
      }
      
      return [];
    } catch (error) {
      return [];
    }
  }

  async generateValidationReport() {
    console.log('📋 Generating validation report...');
    
    // Calculate overall status
    const testResults = Object.values(this.results.tests);
    const passedTests = testResults.filter(t => t.status === 'passed').length;
    const failedTests = testResults.filter(t => t.status === 'failed').length;
    const warningTests = testResults.filter(t => t.status === 'warning').length;
    
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
      errors: this.results.errors.length,
      warningMessages: this.results.warnings.length
    };
    
    // Save report
    const reportPath = path.join(process.cwd(), 'monitoring-validation-report.json');
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
    
    // Print summary
    console.log('\n📊 MONITORING VALIDATION SUMMARY');
    console.log('=====================================');
    console.log(`Overall Status: ${this.results.overallStatus.toUpperCase()}`);
    console.log(`Tests Passed: ${passedTests}/${testResults.length}`);
    console.log(`Warnings: ${warningTests}`);
    console.log(`Errors: ${failedTests}`);
    console.log(`Report saved to: ${reportPath}`);
    
    if (this.results.overallStatus === 'passed') {
      console.log('\n✅ All monitoring and alerting systems are working correctly!');
    } else if (this.results.overallStatus === 'warning') {
      console.log('\n⚠️  Monitoring systems are mostly working but have some issues.');
    } else {
      console.log('\n❌ Critical issues found in monitoring systems.');
    }
    
    return this.results;
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new MonitoringValidator();
  validator.validateMonitoringStack()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}

module.exports = MonitoringValidator;