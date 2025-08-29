#!/usr/bin/env node

/**
 * Prometheus Metrics Collection Test
 * 
 * This script tests the Prometheus metrics collection system to ensure:
 * 1. Prometheus server configuration is correct
 * 2. Custom metrics are being collected properly
 * 3. System performance metrics are available
 * 4. Business metrics for paper trading are tracked
 * 5. All alert rules are properly configured
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class PrometheusMetricsTest {
  constructor() {
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    this.prometheusUrl = process.env.PROMETHEUS_URL || 'http://localhost:9090';
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: [],
      details: []
    };
  }

  async runAllTests() {
    console.log('🔍 Starting Prometheus Metrics Collection Tests...\n');

    try {
      // Test 1: Verify metrics endpoint is accessible
      await this.testMetricsEndpoint();

      // Test 2: Verify Prometheus configuration files
      await this.testPrometheusConfiguration();

      // Test 3: Verify alert rules configuration
      await this.testAlertRulesConfiguration();

      // Test 4: Test custom metrics collection
      await this.testCustomMetricsCollection();

      // Test 5: Test system performance metrics
      await this.testSystemPerformanceMetrics();

      // Test 6: Test business metrics for paper trading
      await this.testPaperTradingMetrics();

      // Test 7: Test metrics service status
      await this.testMetricsServiceStatus();

      // Test 8: Verify Prometheus server connectivity (if available)
      await this.testPrometheusServerConnectivity();

      // Test 9: Test metrics format and structure
      await this.testMetricsFormat();

      // Test 10: Test alert rules syntax
      await this.testAlertRulesSyntax();

    } catch (error) {
      this.recordError('Test execution failed', error);
    }

    this.printResults();
    return this.testResults;
  }

  async testMetricsEndpoint() {
    console.log('📊 Testing metrics endpoint accessibility...');
    
    try {
      const response = await axios.get(`${this.baseUrl}/metrics`, {
        timeout: 10000,
        headers: {
          'Accept': 'text/plain'
        }
      });

      if (response.status === 200) {
        this.recordSuccess('Metrics endpoint is accessible');
        
        // Check if response contains Prometheus metrics
        const metricsContent = response.data;
        if (metricsContent.includes('# HELP') && metricsContent.includes('# TYPE')) {
          this.recordSuccess('Metrics endpoint returns valid Prometheus format');
        } else {
          this.recordFailure('Metrics endpoint does not return valid Prometheus format');
        }

        // Check for custom metrics
        const customMetrics = [
          'kiro_bot_http_requests_total',
          'kiro_bot_paper_trades_total',
          'kiro_bot_websocket_connections_active',
          'kiro_bot_trading_signals_total',
          'kiro_bot_system_uptime_seconds'
        ];

        for (const metric of customMetrics) {
          if (metricsContent.includes(metric)) {
            this.recordSuccess(`Custom metric found: ${metric}`);
          } else {
            this.recordFailure(`Custom metric missing: ${metric}`);
          }
        }

      } else {
        this.recordFailure(`Metrics endpoint returned status ${response.status}`);
      }
    } catch (error) {
      this.recordError('Failed to access metrics endpoint', error);
    }
  }

  async testPrometheusConfiguration() {
    console.log('⚙️  Testing Prometheus configuration files...');

    const configFiles = [
      'monitoring/prometheus.yml',
      'monitoring/prometheus/prometheus-prod.yml'
    ];

    for (const configFile of configFiles) {
      try {
        const configPath = path.join(process.cwd(), configFile);
        
        if (fs.existsSync(configPath)) {
          this.recordSuccess(`Configuration file exists: ${configFile}`);
          
          const configContent = fs.readFileSync(configPath, 'utf8');
          const config = yaml.load(configContent);
          
          // Validate configuration structure
          if (config.global && config.scrape_configs) {
            this.recordSuccess(`Valid Prometheus configuration: ${configFile}`);
            
            // Check for trading bot specific scrape configs
            const tradingBotJobs = config.scrape_configs.filter(job => 
              job.job_name && job.job_name.includes('trading-bot')
            );
            
            if (tradingBotJobs.length > 0) {
              this.recordSuccess(`Trading bot scrape configs found: ${tradingBotJobs.length} jobs`);
            } else {
              this.recordFailure(`No trading bot specific scrape configs found in ${configFile}`);
            }
            
          } else {
            this.recordFailure(`Invalid Prometheus configuration structure: ${configFile}`);
          }
        } else {
          this.recordFailure(`Configuration file missing: ${configFile}`);
        }
      } catch (error) {
        this.recordError(`Failed to validate configuration file: ${configFile}`, error);
      }
    }
  }

  async testAlertRulesConfiguration() {
    console.log('🚨 Testing alert rules configuration...');

    const alertRuleFiles = [
      'monitoring/prometheus/rules/trading-bot-alerts.yml',
      'monitoring/prometheus/rules/paper-trading-safety-alerts.yml',
      'monitoring/prometheus/rules/real-time-data-alerts.yml'
    ];

    for (const ruleFile of alertRuleFiles) {
      try {
        const rulePath = path.join(process.cwd(), ruleFile);
        
        if (fs.existsSync(rulePath)) {
          this.recordSuccess(`Alert rules file exists: ${ruleFile}`);
          
          const rulesContent = fs.readFileSync(rulePath, 'utf8');
          const rules = yaml.load(rulesContent);
          
          if (rules.groups && Array.isArray(rules.groups)) {
            this.recordSuccess(`Valid alert rules structure: ${ruleFile}`);
            
            let totalRules = 0;
            for (const group of rules.groups) {
              if (group.rules && Array.isArray(group.rules)) {
                totalRules += group.rules.length;
              }
            }
            
            this.recordSuccess(`Alert rules count: ${totalRules} rules in ${ruleFile}`);
            
            // Validate critical safety alerts for paper trading
            if (ruleFile.includes('paper-trading-safety')) {
              const criticalAlerts = rules.groups.flatMap(group => 
                group.rules.filter(rule => 
                  rule.labels && rule.labels.severity === 'critical'
                )
              );
              
              if (criticalAlerts.length > 0) {
                this.recordSuccess(`Critical paper trading safety alerts: ${criticalAlerts.length} alerts`);
              } else {
                this.recordFailure('No critical paper trading safety alerts found');
              }
            }
            
          } else {
            this.recordFailure(`Invalid alert rules structure: ${ruleFile}`);
          }
        } else {
          this.recordFailure(`Alert rules file missing: ${ruleFile}`);
        }
      } catch (error) {
        this.recordError(`Failed to validate alert rules file: ${ruleFile}`, error);
      }
    }
  }

  async testCustomMetricsCollection() {
    console.log('📈 Testing custom metrics collection...');

    try {
      // Make some requests to generate metrics
      await this.generateTestMetrics();
      
      // Wait a moment for metrics to be collected
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const response = await axios.get(`${this.baseUrl}/metrics`);
      const metricsContent = response.data;
      
      // Test HTTP metrics
      if (metricsContent.includes('kiro_bot_http_requests_total')) {
        this.recordSuccess('HTTP request metrics are being collected');
      } else {
        this.recordFailure('HTTP request metrics not found');
      }
      
      // Test system metrics
      if (metricsContent.includes('kiro_bot_memory_usage_bytes')) {
        this.recordSuccess('Memory usage metrics are being collected');
      } else {
        this.recordFailure('Memory usage metrics not found');
      }
      
      // Test Node.js default metrics
      if (metricsContent.includes('nodejs_version_info')) {
        this.recordSuccess('Node.js default metrics are being collected');
      } else {
        this.recordFailure('Node.js default metrics not found');
      }
      
    } catch (error) {
      this.recordError('Failed to test custom metrics collection', error);
    }
  }

  async testSystemPerformanceMetrics() {
    console.log('⚡ Testing system performance metrics...');

    try {
      const response = await axios.get(`${this.baseUrl}/metrics`);
      const metricsContent = response.data;
      
      const performanceMetrics = [
        'kiro_bot_cpu_usage_percent',
        'kiro_bot_memory_usage_bytes',
        'kiro_bot_system_uptime_seconds',
        'kiro_bot_disk_usage_bytes',
        'kiro_bot_network_io_bytes_total'
      ];
      
      for (const metric of performanceMetrics) {
        if (metricsContent.includes(metric)) {
          this.recordSuccess(`Performance metric found: ${metric}`);
        } else {
          this.recordFailure(`Performance metric missing: ${metric}`);
        }
      }
      
      // Test resource utilization metrics
      const resourceMetrics = [
        'kiro_bot_database_connections_active',
        'kiro_bot_redis_connections_active',
        'kiro_bot_websocket_connections_active'
      ];
      
      for (const metric of resourceMetrics) {
        if (metricsContent.includes(metric)) {
          this.recordSuccess(`Resource utilization metric found: ${metric}`);
        } else {
          this.recordFailure(`Resource utilization metric missing: ${metric}`);
        }
      }
      
    } catch (error) {
      this.recordError('Failed to test system performance metrics', error);
    }
  }

  async testPaperTradingMetrics() {
    console.log('💰 Testing paper trading business metrics...');

    try {
      const response = await axios.get(`${this.baseUrl}/metrics`);
      const metricsContent = response.data;
      
      const paperTradingMetrics = [
        'kiro_bot_paper_trades_total',
        'kiro_bot_virtual_balance_usd',
        'kiro_bot_paper_trading_pnl_usd',
        'kiro_bot_paper_trading_win_rate_percent',
        'kiro_bot_paper_trading_drawdown_percent'
      ];
      
      for (const metric of paperTradingMetrics) {
        if (metricsContent.includes(metric)) {
          this.recordSuccess(`Paper trading metric found: ${metric}`);
        } else {
          this.recordFailure(`Paper trading metric missing: ${metric}`);
        }
      }
      
      // Test trading operation metrics
      const tradingMetrics = [
        'kiro_bot_trading_signals_total',
        'kiro_bot_trade_executions_total',
        'kiro_bot_order_execution_latency_seconds',
        'kiro_bot_portfolio_value_usd'
      ];
      
      for (const metric of tradingMetrics) {
        if (metricsContent.includes(metric)) {
          this.recordSuccess(`Trading operation metric found: ${metric}`);
        } else {
          this.recordFailure(`Trading operation metric missing: ${metric}`);
        }
      }
      
    } catch (error) {
      this.recordError('Failed to test paper trading metrics', error);
    }
  }

  async testMetricsServiceStatus() {
    console.log('🔧 Testing metrics service status...');

    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/metrics/status`);
      
      if (response.status === 200) {
        this.recordSuccess('Metrics service status endpoint is accessible');
        
        const status = response.data;
        if (status.isCollecting !== undefined) {
          this.recordSuccess(`Metrics collection status: ${status.isCollecting ? 'Active' : 'Inactive'}`);
        }
        
        if (status.config) {
          this.recordSuccess('Metrics service configuration is available');
        }
        
        if (status.uptime !== undefined) {
          this.recordSuccess(`Metrics service uptime: ${status.uptime}ms`);
        }
        
      } else {
        this.recordFailure(`Metrics service status returned status ${response.status}`);
      }
    } catch (error) {
      this.recordError('Failed to test metrics service status', error);
    }
  }

  async testPrometheusServerConnectivity() {
    console.log('🔗 Testing Prometheus server connectivity...');

    try {
      const response = await axios.get(`${this.prometheusUrl}/api/v1/status/config`, {
        timeout: 5000
      });
      
      if (response.status === 200) {
        this.recordSuccess('Prometheus server is accessible');
        
        // Test if our metrics endpoint is configured
        const config = response.data;
        if (config.data && config.data.yaml) {
          if (config.data.yaml.includes('trading-bot')) {
            this.recordSuccess('Trading bot metrics are configured in Prometheus');
          } else {
            this.recordFailure('Trading bot metrics not configured in Prometheus');
          }
        }
      } else {
        this.recordFailure(`Prometheus server returned status ${response.status}`);
      }
    } catch (error) {
      // This is not a critical failure as Prometheus might not be running
      this.recordFailure('Prometheus server is not accessible (this is expected if not running)');
    }
  }

  async testMetricsFormat() {
    console.log('📋 Testing metrics format and structure...');

    try {
      const response = await axios.get(`${this.baseUrl}/metrics`);
      const metricsContent = response.data;
      
      // Test Prometheus format compliance
      const lines = metricsContent.split('\n');
      let helpLines = 0;
      let typeLines = 0;
      let metricLines = 0;
      
      for (const line of lines) {
        if (line.startsWith('# HELP')) helpLines++;
        if (line.startsWith('# TYPE')) typeLines++;
        if (line && !line.startsWith('#')) metricLines++;
      }
      
      if (helpLines > 0) {
        this.recordSuccess(`Found ${helpLines} HELP lines in metrics`);
      } else {
        this.recordFailure('No HELP lines found in metrics');
      }
      
      if (typeLines > 0) {
        this.recordSuccess(`Found ${typeLines} TYPE lines in metrics`);
      } else {
        this.recordFailure('No TYPE lines found in metrics');
      }
      
      if (metricLines > 0) {
        this.recordSuccess(`Found ${metricLines} metric value lines`);
      } else {
        this.recordFailure('No metric value lines found');
      }
      
      // Test for proper metric naming (should start with kiro_bot_)
      const customMetricLines = lines.filter(line => 
        line && !line.startsWith('#') && line.includes('kiro_bot_')
      );
      
      if (customMetricLines.length > 0) {
        this.recordSuccess(`Found ${customMetricLines.length} custom kiro_bot metrics`);
      } else {
        this.recordFailure('No custom kiro_bot metrics found');
      }
      
    } catch (error) {
      this.recordError('Failed to test metrics format', error);
    }
  }

  async testAlertRulesSyntax() {
    console.log('✅ Testing alert rules syntax...');

    const alertRuleFiles = [
      'monitoring/prometheus/rules/trading-bot-alerts.yml',
      'monitoring/prometheus/rules/paper-trading-safety-alerts.yml',
      'monitoring/prometheus/rules/real-time-data-alerts.yml'
    ];

    for (const ruleFile of alertRuleFiles) {
      try {
        const rulePath = path.join(process.cwd(), ruleFile);
        
        if (fs.existsSync(rulePath)) {
          const rulesContent = fs.readFileSync(rulePath, 'utf8');
          const rules = yaml.load(rulesContent);
          
          // Validate each rule group
          for (const group of rules.groups || []) {
            if (!group.name) {
              this.recordFailure(`Group missing name in ${ruleFile}`);
              continue;
            }
            
            for (const rule of group.rules || []) {
              // Validate required fields
              if (!rule.alert) {
                this.recordFailure(`Rule missing alert name in group ${group.name}`);
                continue;
              }
              
              if (!rule.expr) {
                this.recordFailure(`Rule ${rule.alert} missing expression`);
                continue;
              }
              
              if (!rule.labels || !rule.labels.severity) {
                this.recordFailure(`Rule ${rule.alert} missing severity label`);
                continue;
              }
              
              if (!rule.annotations || !rule.annotations.summary) {
                this.recordFailure(`Rule ${rule.alert} missing summary annotation`);
                continue;
              }
              
              // All validations passed for this rule
              this.recordSuccess(`Alert rule validated: ${rule.alert}`);
            }
          }
        }
      } catch (error) {
        this.recordError(`Failed to validate alert rules syntax: ${ruleFile}`, error);
      }
    }
  }

  async generateTestMetrics() {
    // Generate some test traffic to create metrics
    const endpoints = [
      '/health',
      '/api/v1/paper-trading/status',
      '/api/v1/security/status',
      '/api/v1/websocket/stats'
    ];

    for (const endpoint of endpoints) {
      try {
        await axios.get(`${this.baseUrl}${endpoint}`, { timeout: 5000 });
      } catch (error) {
        // Ignore errors, we just want to generate some metrics
      }
    }
  }

  recordSuccess(message) {
    this.testResults.passed++;
    this.testResults.details.push({ type: 'success', message });
    console.log(`  ✅ ${message}`);
  }

  recordFailure(message) {
    this.testResults.failed++;
    this.testResults.details.push({ type: 'failure', message });
    console.log(`  ❌ ${message}`);
  }

  recordError(message, error) {
    this.testResults.failed++;
    this.testResults.errors.push({ message, error: error.message });
    this.testResults.details.push({ type: 'error', message: `${message}: ${error.message}` });
    console.log(`  🚨 ${message}: ${error.message}`);
  }

  printResults() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 PROMETHEUS METRICS COLLECTION TEST RESULTS');
    console.log('='.repeat(80));
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`🚨 Errors: ${this.testResults.errors.length}`);
    
    const total = this.testResults.passed + this.testResults.failed;
    const successRate = total > 0 ? ((this.testResults.passed / total) * 100).toFixed(1) : 0;
    console.log(`📈 Success Rate: ${successRate}%`);
    
    if (this.testResults.errors.length > 0) {
      console.log('\n🚨 ERRORS:');
      this.testResults.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.message}`);
        console.log(`   ${error.error}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    
    if (this.testResults.failed === 0 && this.testResults.errors.length === 0) {
      console.log('🎉 ALL PROMETHEUS METRICS TESTS PASSED!');
      console.log('✅ Prometheus metrics collection is properly configured');
      console.log('✅ Custom trading metrics are being collected');
      console.log('✅ System performance metrics are available');
      console.log('✅ Paper trading business metrics are tracked');
      console.log('✅ Alert rules are properly configured');
    } else {
      console.log('⚠️  SOME TESTS FAILED - Review the issues above');
    }
    
    console.log('='.repeat(80));
  }
}

// Run the tests if this script is executed directly
if (require.main === module) {
  const test = new PrometheusMetricsTest();
  test.runAllTests()
    .then((results) => {
      process.exit(results.failed === 0 && results.errors.length === 0 ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = PrometheusMetricsTest;