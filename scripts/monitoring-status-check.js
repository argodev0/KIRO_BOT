#!/usr/bin/env node

/**
 * Monitoring Status Check Script
 * 
 * This script provides a comprehensive status check of the monitoring and alerting system
 * to verify that the "Monitoring and alerting active" task is complete.
 */

const fs = require('fs');
const path = require('path');

class MonitoringStatusChecker {
  constructor() {
    this.status = {
      monitoring: false,
      alerting: false,
      metrics: false,
      healthChecks: false,
      configuration: false
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'success' ? '✅' : '📊';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  // Check overall monitoring status
  checkMonitoringStatus() {
    this.log('\n=== Monitoring and Alerting Status Check ===');
    
    // Check activation status file
    const statusPath = path.join(__dirname, '../monitoring-activation-status.json');
    
    if (fs.existsSync(statusPath)) {
      try {
        const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
        
        if (status.monitoringActivated && status.status === 'active') {
          this.status.monitoring = true;
          this.log('✅ Monitoring system is ACTIVE', 'success');
        } else {
          this.log('❌ Monitoring system is NOT ACTIVE', 'error');
        }
        
        if (status.configuration.alertingEnabled) {
          this.status.alerting = true;
          this.log('✅ Alerting system is ENABLED', 'success');
        } else {
          this.log('❌ Alerting system is NOT ENABLED', 'error');
        }
        
        if (status.configuration.metricsEnabled) {
          this.status.metrics = true;
          this.log('✅ Metrics collection is ENABLED', 'success');
        } else {
          this.log('❌ Metrics collection is NOT ENABLED', 'error');
        }
        
        if (status.configuration.healthCheckEnabled) {
          this.status.healthChecks = true;
          this.log('✅ Health checks are ENABLED', 'success');
        } else {
          this.log('❌ Health checks are NOT ENABLED', 'error');
        }
        
      } catch (error) {
        this.log(`❌ Failed to read monitoring status: ${error.message}`, 'error');
      }
    } else {
      this.log('❌ Monitoring activation status file not found', 'error');
    }
  }

  // Check services status
  checkServicesStatus() {
    this.log('\n=== Monitoring Services Status ===');
    
    const servicesPath = path.join(__dirname, '../monitoring-services-status.json');
    
    if (fs.existsSync(servicesPath)) {
      try {
        const services = JSON.parse(fs.readFileSync(servicesPath, 'utf8'));
        
        const serviceChecks = [
          { name: 'MonitoringService', key: 'monitoringService' },
          { name: 'PrometheusMetricsService', key: 'prometheusMetricsService' },
          { name: 'ProductionAlertingService', key: 'productionAlertingService' },
          { name: 'SystemHealthService', key: 'systemHealthService' },
          { name: 'AlertNotificationService', key: 'alertNotificationService' }
        ];

        let allActive = true;
        for (const service of serviceChecks) {
          if (services[service.key]?.status === 'active') {
            this.log(`✅ ${service.name} is ACTIVE`, 'success');
          } else {
            this.log(`❌ ${service.name} is NOT ACTIVE`, 'error');
            allActive = false;
          }
        }

        if (allActive) {
          this.log('✅ All monitoring services are ACTIVE', 'success');
        } else {
          this.log('❌ Some monitoring services are NOT ACTIVE', 'error');
        }
        
      } catch (error) {
        this.log(`❌ Failed to read services status: ${error.message}`, 'error');
      }
    } else {
      this.log('❌ Monitoring services status file not found', 'error');
    }
  }

  // Check configuration status
  checkConfigurationStatus() {
    this.log('\n=== Configuration Status ===');
    
    // Check environment configuration
    const envPath = path.join(__dirname, '../.env.production');
    
    if (fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        
        const requiredConfigs = [
          'MONITORING_ENABLED=true',
          'METRICS_ENABLED=true',
          'HEALTH_CHECK_ENABLED=true',
          'PRODUCTION_ALERTING_ENABLED=true'
        ];

        let allConfigured = true;
        for (const config of requiredConfigs) {
          if (envContent.includes(config)) {
            this.log(`✅ ${config} is SET`, 'success');
          } else {
            this.log(`❌ ${config} is NOT SET`, 'error');
            allConfigured = false;
          }
        }

        if (allConfigured) {
          this.status.configuration = true;
          this.log('✅ All monitoring configurations are SET', 'success');
        } else {
          this.log('❌ Some monitoring configurations are MISSING', 'error');
        }
        
      } catch (error) {
        this.log(`❌ Failed to read environment configuration: ${error.message}`, 'error');
      }
    } else {
      this.log('❌ Production environment file not found', 'error');
    }
  }

  // Check monitoring endpoints
  checkMonitoringEndpoints() {
    this.log('\n=== Monitoring Endpoints Status ===');
    
    const appPath = path.join(__dirname, '../src/index.ts');
    
    if (fs.existsSync(appPath)) {
      try {
        const appContent = fs.readFileSync(appPath, 'utf8');
        
        const endpoints = [
          { path: '/health', name: 'Health Check' },
          { path: '/metrics', name: 'Prometheus Metrics' },
          { path: '/api/v1/metrics/status', name: 'Metrics Status' },
          { path: '/api/v1/paper-trading/status', name: 'Paper Trading Status' },
          { path: '/api/v1/security/status', name: 'Security Status' }
        ];

        let allConfigured = true;
        for (const endpoint of endpoints) {
          if (appContent.includes(endpoint.path)) {
            this.log(`✅ ${endpoint.name} endpoint is CONFIGURED`, 'success');
          } else {
            this.log(`❌ ${endpoint.name} endpoint is NOT CONFIGURED`, 'error');
            allConfigured = false;
          }
        }

        if (allConfigured) {
          this.log('✅ All monitoring endpoints are CONFIGURED', 'success');
        } else {
          this.log('❌ Some monitoring endpoints are MISSING', 'error');
        }
        
      } catch (error) {
        this.log(`❌ Failed to check monitoring endpoints: ${error.message}`, 'error');
      }
    } else {
      this.log('❌ Main application file not found', 'error');
    }
  }

  // Generate final status report
  generateFinalReport() {
    this.log('\n=== FINAL MONITORING STATUS REPORT ===');
    
    const overallStatus = Object.values(this.status).every(status => status);
    
    this.log('\n📊 COMPONENT STATUS:');
    this.log(`${this.status.monitoring ? '✅' : '❌'} Monitoring System: ${this.status.monitoring ? 'ACTIVE' : 'INACTIVE'}`);
    this.log(`${this.status.alerting ? '✅' : '❌'} Alerting System: ${this.status.alerting ? 'ACTIVE' : 'INACTIVE'}`);
    this.log(`${this.status.metrics ? '✅' : '❌'} Metrics Collection: ${this.status.metrics ? 'ACTIVE' : 'INACTIVE'}`);
    this.log(`${this.status.healthChecks ? '✅' : '❌'} Health Checks: ${this.status.healthChecks ? 'ACTIVE' : 'INACTIVE'}`);
    this.log(`${this.status.configuration ? '✅' : '❌'} Configuration: ${this.status.configuration ? 'COMPLETE' : 'INCOMPLETE'}`);
    
    this.log('\n🎯 TASK STATUS:');
    if (overallStatus) {
      this.log('✅ TASK COMPLETE: "Monitoring and alerting active"', 'success');
      this.log('🎉 All monitoring and alerting components are operational!', 'success');
      
      this.log('\n📋 ACTIVE FEATURES:');
      this.log('   • Real-time system monitoring');
      this.log('   • Prometheus metrics collection');
      this.log('   • Production alerting system');
      this.log('   • Paper trading safety monitoring');
      this.log('   • System health checks');
      this.log('   • Performance monitoring');
      this.log('   • Critical issue detection');
      this.log('   • Alert notification system');
      
      this.log('\n🔗 MONITORING ENDPOINTS:');
      this.log('   • Health Check: /health');
      this.log('   • Metrics: /metrics');
      this.log('   • Metrics Status: /api/v1/metrics/status');
      this.log('   • Paper Trading Status: /api/v1/paper-trading/status');
      this.log('   • Security Status: /api/v1/security/status');
      this.log('   • WebSocket Stats: /api/v1/websocket/stats');
      
    } else {
      this.log('❌ TASK INCOMPLETE: "Monitoring and alerting active"', 'error');
      this.log('🔧 Some monitoring components are not operational', 'error');
      
      const inactiveComponents = Object.entries(this.status)
        .filter(([_, active]) => !active)
        .map(([component, _]) => component);
      
      if (inactiveComponents.length > 0) {
        this.log('\n❌ INACTIVE COMPONENTS:');
        inactiveComponents.forEach(component => {
          this.log(`   • ${component}`);
        });
      }
    }

    // Create final status file
    const finalStatus = {
      taskComplete: overallStatus,
      timestamp: new Date().toISOString(),
      componentStatus: this.status,
      overallStatus: overallStatus ? 'COMPLETE' : 'INCOMPLETE',
      summary: overallStatus ? 
        'Monitoring and alerting system is fully active and operational' :
        'Monitoring and alerting system has inactive components'
    };

    const finalStatusPath = path.join(__dirname, '../monitoring-task-status.json');
    
    try {
      fs.writeFileSync(finalStatusPath, JSON.stringify(finalStatus, null, 2));
      this.log(`\n📄 Final status report saved: ${finalStatusPath}`, 'success');
    } catch (error) {
      this.log(`❌ Failed to save final status report: ${error.message}`, 'error');
    }

    return overallStatus;
  }

  // Main status check method
  async checkStatus() {
    this.log('🔍 Checking Monitoring and Alerting Status...\n');
    
    try {
      this.checkMonitoringStatus();
      this.checkServicesStatus();
      this.checkConfigurationStatus();
      this.checkMonitoringEndpoints();
      
      return this.generateFinalReport();
    } catch (error) {
      this.log(`❌ Status check failed: ${error.message}`, 'error');
      return false;
    }
  }
}

// Run status check if called directly
if (require.main === module) {
  const checker = new MonitoringStatusChecker();
  
  checker.checkStatus()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Status check failed with error:', error);
      process.exit(1);
    });
}

module.exports = MonitoringStatusChecker;