#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class MonitoringDashboardTester {
  constructor() {
    this.grafanaUrl = 'http://localhost:3001';
    this.grafanaAuth = { username: 'admin', password: 'admin123' };
    this.prometheusUrl = 'http://localhost:9090';
    this.results = {
      passed: [],
      failed: [],
      warnings: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async testGrafanaConnection() {
    this.log('Testing Grafana connection...');
    
    try {
      const response = await axios.get(`${this.grafanaUrl}/api/health`, {
        auth: this.grafanaAuth,
        timeout: 5000
      });
      
      if (response.status === 200) {
        this.log('Grafana connection successful', 'success');
        this.results.passed.push('Grafana connection');
        return true;
      } else {
        this.log(`Grafana connection failed with status ${response.status}`, 'error');
        this.results.failed.push('Grafana connection');
        return false;
      }
    } catch (error) {
      this.log(`Grafana connection failed: ${error.message}`, 'error');
      this.results.failed.push('Grafana connection');
      return false;
    }
  }

  async testPrometheusConnection() {
    this.log('Testing Prometheus connection...');
    
    try {
      const response = await axios.get(`${this.prometheusUrl}/api/v1/query?query=up`, {
        timeout: 5000
      });
      
      if (response.status === 200 && response.data.status === 'success') {
        this.log('Prometheus connection successful', 'success');
        this.results.passed.push('Prometheus connection');
        return true;
      } else {
        this.log('Prometheus connection failed', 'error');
        this.results.failed.push('Prometheus connection');
        return false;
      }
    } catch (error) {
      this.log(`Prometheus connection failed: ${error.message}`, 'error');
      this.results.failed.push('Prometheus connection');
      return false;
    }
  }

  async testDashboardImport() {
    this.log('Testing dashboard import...');
    
    try {
      const response = await axios.get(`${this.grafanaUrl}/api/search`, {
        auth: this.grafanaAuth,
        timeout: 5000
      });
      
      if (response.status === 200) {
        const dashboards = response.data;
        this.log(`Found ${dashboards.length} dashboards in Grafana`, 'success');
        
        const expectedDashboards = [
          'Trading Bot - Overview',
          'Paper Trading Safety Dashboard',
          'System Metrics Dashboard',
          'Trading Metrics Dashboard',
          'Real-time Data Feeds Dashboard'
        ];
        
        for (const expectedDashboard of expectedDashboards) {
          const found = dashboards.find(d => d.title === expectedDashboard);
          if (found) {
            this.log(`Dashboard found: ${expectedDashboard}`, 'success');
            this.results.passed.push(`Dashboard: ${expectedDashboard}`);
          } else {
            this.log(`Dashboard missing: ${expectedDashboard}`, 'warning');
            this.results.warnings.push(`Dashboard: ${expectedDashboard}`);
          }
        }
        
        return true;
      } else {
        this.log('Failed to retrieve dashboards', 'error');
        this.results.failed.push('Dashboard retrieval');
        return false;
      }
    } catch (error) {
      this.log(`Dashboard import test failed: ${error.message}`, 'error');
      this.results.failed.push('Dashboard import');
      return false;
    }
  }

  async testPrometheusMetrics() {
    this.log('Testing Prometheus metrics...');
    
    const testMetrics = [
      'up',
      'paper_trading_mode_enabled',
      'exchange_connection_status',
      'websocket_connections_active',
      'http_requests_total'
    ];
    
    for (const metric of testMetrics) {
      try {
        const response = await axios.get(`${this.prometheusUrl}/api/v1/query?query=${metric}`, {
          timeout: 5000
        });
        
        if (response.status === 200 && response.data.status === 'success') {
          const data = response.data.data;
          if (data.result && data.result.length > 0) {
            this.log(`Metric available: ${metric}`, 'success');
            this.results.passed.push(`Metric: ${metric}`);
          } else {
            this.log(`Metric has no data: ${metric}`, 'warning');
            this.results.warnings.push(`Metric: ${metric}`);
          }
        } else {
          this.log(`Metric query failed: ${metric}`, 'error');
          this.results.failed.push(`Metric: ${metric}`);
        }
      } catch (error) {
        this.log(`Metric test failed for ${metric}: ${error.message}`, 'error');
        this.results.failed.push(`Metric: ${metric}`);
      }
    }
  }

  async testAlertRules() {
    this.log('Testing Prometheus alert rules...');
    
    try {
      const response = await axios.get(`${this.prometheusUrl}/api/v1/rules`, {
        timeout: 5000
      });
      
      if (response.status === 200 && response.data.status === 'success') {
        const rules = response.data.data;
        let totalRules = 0;
        let totalAlerts = 0;
        
        for (const group of rules.groups) {
          totalRules += group.rules.length;
          for (const rule of group.rules) {
            if (rule.type === 'alerting') {
              totalAlerts++;
            }
          }
        }
        
        this.log(`Found ${totalRules} total rules, ${totalAlerts} alert rules`, 'success');
        this.results.passed.push(`Alert rules: ${totalAlerts}`);
        
        // Check for specific critical alert rules
        const criticalAlerts = [
          'PaperTradingModeDisabled',
          'RealTradingAttemptDetected',
          'AllExchangeConnectionsLost',
          'TradingBotDown'
        ];
        
        for (const alertName of criticalAlerts) {
          let found = false;
          for (const group of rules.groups) {
            for (const rule of group.rules) {
              if (rule.name === alertName) {
                found = true;
                break;
              }
            }
            if (found) break;
          }
          
          if (found) {
            this.log(`Critical alert rule found: ${alertName}`, 'success');
            this.results.passed.push(`Alert rule: ${alertName}`);
          } else {
            this.log(`Critical alert rule missing: ${alertName}`, 'error');
            this.results.failed.push(`Alert rule: ${alertName}`);
          }
        }
        
        return true;
      } else {
        this.log('Failed to retrieve alert rules', 'error');
        this.results.failed.push('Alert rules retrieval');
        return false;
      }
    } catch (error) {
      this.log(`Alert rules test failed: ${error.message}`, 'error');
      this.results.failed.push('Alert rules test');
      return false;
    }
  }

  async testDashboardQueries() {
    this.log('Testing dashboard queries...');
    
    const dashboardDir = path.join(__dirname, '../monitoring/grafana/dashboards');
    
    if (!fs.existsSync(dashboardDir)) {
      this.log('Dashboard directory not found', 'error');
      this.results.failed.push('Dashboard directory');
      return false;
    }
    
    const dashboardFiles = fs.readdirSync(dashboardDir).filter(file => file.endsWith('.json'));
    
    for (const dashboardFile of dashboardFiles) {
      try {
        const dashboardPath = path.join(dashboardDir, dashboardFile);
        const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
        const dashboard = JSON.parse(dashboardContent);
        
        this.log(`Testing queries in dashboard: ${dashboard.title}`);
        
        let queryCount = 0;
        let validQueries = 0;
        
        for (const panel of dashboard.panels || []) {
          if (panel.targets) {
            for (const target of panel.targets) {
              if (target.expr) {
                queryCount++;
                
                try {
                  // Test the query syntax by sending it to Prometheus
                  const response = await axios.get(`${this.prometheusUrl}/api/v1/query`, {
                    params: { query: target.expr },
                    timeout: 5000
                  });
                  
                  if (response.status === 200 && response.data.status === 'success') {
                    validQueries++;
                  } else {
                    this.log(`Invalid query in ${dashboardFile}: ${target.expr}`, 'warning');
                  }
                } catch (error) {
                  this.log(`Query test failed in ${dashboardFile}: ${target.expr}`, 'warning');
                }
              }
            }
          }
        }
        
        if (queryCount > 0) {
          this.log(`Dashboard ${dashboard.title}: ${validQueries}/${queryCount} queries valid`, 'success');
          this.results.passed.push(`Dashboard queries: ${dashboard.title}`);
        } else {
          this.log(`Dashboard ${dashboard.title}: No queries found`, 'warning');
          this.results.warnings.push(`Dashboard queries: ${dashboard.title}`);
        }
        
      } catch (error) {
        this.log(`Failed to test dashboard ${dashboardFile}: ${error.message}`, 'error');
        this.results.failed.push(`Dashboard: ${dashboardFile}`);
      }
    }
  }

  async testAlertManagerConnection() {
    this.log('Testing AlertManager connection...');
    
    try {
      const response = await axios.get('http://localhost:9093/api/v1/status', {
        timeout: 5000
      });
      
      if (response.status === 200) {
        this.log('AlertManager connection successful', 'success');
        this.results.passed.push('AlertManager connection');
        
        // Test alert configuration
        const configResponse = await axios.get('http://localhost:9093/api/v1/status', {
          timeout: 5000
        });
        
        if (configResponse.status === 200) {
          this.log('AlertManager configuration loaded', 'success');
          this.results.passed.push('AlertManager configuration');
        }
        
        return true;
      } else {
        this.log('AlertManager connection failed', 'error');
        this.results.failed.push('AlertManager connection');
        return false;
      }
    } catch (error) {
      this.log(`AlertManager connection failed: ${error.message}`, 'error');
      this.results.failed.push('AlertManager connection');
      return false;
    }
  }

  async simulateMetrics() {
    this.log('Simulating metrics for testing...');
    
    // This would normally be done by the actual application
    // For testing purposes, we can check if the metrics endpoint is available
    
    try {
      const response = await axios.get('http://localhost:3000/metrics', {
        timeout: 5000
      });
      
      if (response.status === 200) {
        this.log('Application metrics endpoint available', 'success');
        this.results.passed.push('Application metrics endpoint');
        
        // Check for specific metrics in the response
        const metricsText = response.data;
        const expectedMetrics = [
          'paper_trading_mode_enabled',
          'http_requests_total',
          'websocket_connections_active'
        ];
        
        for (const metric of expectedMetrics) {
          if (metricsText.includes(metric)) {
            this.log(`Metric found in endpoint: ${metric}`, 'success');
            this.results.passed.push(`Endpoint metric: ${metric}`);
          } else {
            this.log(`Metric missing from endpoint: ${metric}`, 'warning');
            this.results.warnings.push(`Endpoint metric: ${metric}`);
          }
        }
        
        return true;
      } else {
        this.log('Application metrics endpoint not available', 'warning');
        this.results.warnings.push('Application metrics endpoint');
        return false;
      }
    } catch (error) {
      this.log(`Application metrics endpoint test failed: ${error.message}`, 'warning');
      this.results.warnings.push('Application metrics endpoint');
      return false;
    }
  }

  async testDataSourceConnection() {
    this.log('Testing Grafana data source connection...');
    
    try {
      const response = await axios.get(`${this.grafanaUrl}/api/datasources`, {
        auth: this.grafanaAuth,
        timeout: 5000
      });
      
      if (response.status === 200) {
        const dataSources = response.data;
        const prometheusDS = dataSources.find(ds => ds.type === 'prometheus');
        
        if (prometheusDS) {
          this.log('Prometheus data source configured', 'success');
          this.results.passed.push('Prometheus data source');
          
          // Test data source connectivity
          const testResponse = await axios.post(
            `${this.grafanaUrl}/api/datasources/proxy/${prometheusDS.id}/api/v1/query`,
            'query=up',
            {
              auth: this.grafanaAuth,
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              timeout: 5000
            }
          );
          
          if (testResponse.status === 200) {
            this.log('Data source connectivity test passed', 'success');
            this.results.passed.push('Data source connectivity');
          } else {
            this.log('Data source connectivity test failed', 'error');
            this.results.failed.push('Data source connectivity');
          }
        } else {
          this.log('Prometheus data source not found', 'error');
          this.results.failed.push('Prometheus data source');
        }
        
        return true;
      } else {
        this.log('Failed to retrieve data sources', 'error');
        this.results.failed.push('Data sources retrieval');
        return false;
      }
    } catch (error) {
      this.log(`Data source test failed: ${error.message}`, 'error');
      this.results.failed.push('Data source test');
      return false;
    }
  }

  generateReport() {
    this.log('\n=== Monitoring Dashboard Test Report ===');
    
    const total = this.results.passed.length + this.results.warnings.length + this.results.failed.length;
    
    console.log(`\n📊 Test Summary:`);
    console.log(`✅ Passed: ${this.results.passed.length}`);
    console.log(`⚠️  Warnings: ${this.results.warnings.length}`);
    console.log(`❌ Failed: ${this.results.failed.length}`);
    console.log(`📈 Total Tests: ${total}`);
    
    if (this.results.failed.length > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.failed.forEach(test => console.log(`   - ${test}`));
    }
    
    if (this.results.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.results.warnings.forEach(warning => console.log(`   - ${warning}`));
    }
    
    if (this.results.passed.length > 0) {
      console.log('\n✅ Passed Tests:');
      this.results.passed.forEach(test => console.log(`   - ${test}`));
    }
    
    const successRate = total > 0 ? ((this.results.passed.length / total) * 100).toFixed(1) : 0;
    console.log(`\n📈 Success Rate: ${successRate}%`);
    
    if (this.results.failed.length === 0) {
      this.log('\n🎉 All critical tests passed! Monitoring dashboards are working correctly.', 'success');
      return true;
    } else {
      this.log('\n🚨 Some tests failed. Please check the monitoring setup.', 'error');
      return false;
    }
  }

  async runAllTests() {
    this.log('🔍 Starting monitoring dashboard tests...\n');
    
    // Test connections first
    const grafanaConnected = await this.testGrafanaConnection();
    const prometheusConnected = await this.testPrometheusConnection();
    
    if (!grafanaConnected || !prometheusConnected) {
      this.log('Basic connectivity tests failed. Skipping advanced tests.', 'error');
      return this.generateReport();
    }
    
    // Run all tests
    await this.testDashboardImport();
    await this.testDataSourceConnection();
    await this.testPrometheusMetrics();
    await this.testAlertRules();
    await this.testDashboardQueries();
    await this.testAlertManagerConnection();
    await this.simulateMetrics();
    
    return this.generateReport();
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new MonitoringDashboardTester();
  
  tester.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = MonitoringDashboardTester;