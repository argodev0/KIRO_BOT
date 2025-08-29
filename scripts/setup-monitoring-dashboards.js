#!/usr/bin/env node

/**
 * Monitoring Dashboard Setup Script
 * 
 * Configures and validates Grafana dashboards and Prometheus alerts
 * for production deployment completion
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class MonitoringDashboardSetup {
  constructor() {
    this.grafanaUrl = process.env.GRAFANA_URL || 'http://localhost:3001';
    this.grafanaUser = process.env.GRAFANA_USER || 'admin';
    this.grafanaPassword = process.env.GRAFANA_PASSWORD || 'admin';
    this.prometheusUrl = process.env.PROMETHEUS_URL || 'http://localhost:9090';
    
    this.dashboardsPath = path.join(__dirname, '../monitoring/grafana/dashboards');
    this.alertsPath = path.join(__dirname, '../monitoring/prometheus/rules');
    
    this.results = {
      dashboards: [],
      alerts: [],
      dataSource: null,
      notifications: [],
      summary: {
        dashboardsConfigured: 0,
        alertsConfigured: 0,
        errors: 0
      }
    };
  }

  log(level, message, details = null) {
    const timestamp = new Date().toISOString();
    const levelEmoji = {
      info: '📊',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    
    console.log(`${levelEmoji[level] || '📊'} [${timestamp}] ${message}`);
    if (details) {
      console.log(`   ${JSON.stringify(details, null, 2)}`);
    }
  }

  async setupGrafanaDataSource() {
    this.log('info', 'Setting up Prometheus data source in Grafana...');
    
    const dataSourceConfig = {
      name: 'Prometheus',
      type: 'prometheus',
      url: this.prometheusUrl,
      access: 'proxy',
      isDefault: true,
      basicAuth: false,
      jsonData: {
        httpMethod: 'POST',
        manageAlerts: true,
        alertmanagerUid: 'alertmanager'
      }
    };
    
    try {
      // Check if data source already exists
      const checkCmd = `curl -s -u ${this.grafanaUser}:${this.grafanaPassword} "${this.grafanaUrl}/api/datasources/name/Prometheus"`;
      
      try {
        execSync(checkCmd, { stdio: 'pipe' });
        this.log('info', 'Prometheus data source already exists');
        this.results.dataSource = { status: 'exists', config: dataSourceConfig };
      } catch (error) {
        // Data source doesn't exist, create it
        const createCmd = `curl -X POST -H "Content-Type: application/json" -u ${this.grafanaUser}:${this.grafanaPassword} "${this.grafanaUrl}/api/datasources" -d '${JSON.stringify(dataSourceConfig)}'`;
        
        const result = execSync(createCmd, { encoding: 'utf8' });
        this.log('success', 'Prometheus data source created successfully');
        this.results.dataSource = { status: 'created', config: dataSourceConfig, result: JSON.parse(result) };
      }
    } catch (error) {
      this.log('error', 'Failed to setup Prometheus data source', { error: error.message });
      this.results.summary.errors++;
      this.results.dataSource = { status: 'error', error: error.message };
    }
  }

  async configureDashboards() {
    this.log('info', 'Configuring Grafana dashboards...');
    
    if (!fs.existsSync(this.dashboardsPath)) {
      this.log('error', 'Dashboards directory not found', { path: this.dashboardsPath });
      this.results.summary.errors++;
      return;
    }
    
    const dashboardFiles = fs.readdirSync(this.dashboardsPath).filter(file => file.endsWith('.json'));
    
    for (const dashboardFile of dashboardFiles) {
      await this.configureDashboard(dashboardFile);
    }
    
    this.log('success', `Configured ${this.results.summary.dashboardsConfigured} dashboards`);
  }

  async configureDashboard(dashboardFile) {
    const dashboardPath = path.join(this.dashboardsPath, dashboardFile);
    const dashboardName = path.basename(dashboardFile, '.json');
    
    try {
      this.log('info', `Configuring dashboard: ${dashboardName}`);
      
      // Read dashboard JSON
      const dashboardJson = JSON.parse(fs.readFileSync(dashboardPath, 'utf8'));
      
      // Prepare dashboard for import
      const dashboardPayload = {
        dashboard: {
          ...dashboardJson,
          id: null, // Let Grafana assign ID
          uid: dashboardName.replace(/[^a-zA-Z0-9-]/g, '-'), // Clean UID
          title: dashboardJson.title || dashboardName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        },
        folderId: 0,
        overwrite: true
      };
      
      // Import dashboard
      const importCmd = `curl -X POST -H "Content-Type: application/json" -u ${this.grafanaUser}:${this.grafanaPassword} "${this.grafanaUrl}/api/dashboards/db" -d '${JSON.stringify(dashboardPayload)}'`;
      
      const result = execSync(importCmd, { encoding: 'utf8' });
      const importResult = JSON.parse(result);
      
      if (importResult.status === 'success') {
        this.log('success', `Dashboard configured: ${dashboardName}`);
        this.results.dashboards.push({
          name: dashboardName,
          status: 'success',
          url: `${this.grafanaUrl}/d/${importResult.uid}/${dashboardName}`,
          result: importResult
        });
        this.results.summary.dashboardsConfigured++;
      } else {
        throw new Error(`Import failed: ${importResult.message || 'Unknown error'}`);
      }
      
    } catch (error) {
      this.log('error', `Failed to configure dashboard: ${dashboardName}`, { error: error.message });
      this.results.dashboards.push({
        name: dashboardName,
        status: 'error',
        error: error.message
      });
      this.results.summary.errors++;
    }
  }

  async configureAlerts() {
    this.log('info', 'Configuring Prometheus alert rules...');
    
    if (!fs.existsSync(this.alertsPath)) {
      this.log('error', 'Alert rules directory not found', { path: this.alertsPath });
      this.results.summary.errors++;
      return;
    }
    
    const alertFiles = fs.readdirSync(this.alertsPath).filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));
    
    for (const alertFile of alertFiles) {
      await this.configureAlertRule(alertFile);
    }
    
    this.log('success', `Configured ${this.results.summary.alertsConfigured} alert rule files`);
  }

  async configureAlertRule(alertFile) {
    const alertPath = path.join(this.alertsPath, alertFile);
    const alertName = path.basename(alertFile, path.extname(alertFile));
    
    try {
      this.log('info', `Validating alert rules: ${alertName}`);
      
      // Validate alert rules syntax
      const validateCmd = `promtool check rules "${alertPath}"`;
      execSync(validateCmd, { stdio: 'pipe' });
      
      this.log('success', `Alert rules validated: ${alertName}`);
      this.results.alerts.push({
        name: alertName,
        status: 'validated',
        path: alertPath
      });
      this.results.summary.alertsConfigured++;
      
    } catch (error) {
      this.log('error', `Failed to validate alert rules: ${alertName}`, { error: error.message });
      this.results.alerts.push({
        name: alertName,
        status: 'error',
        error: error.message,
        path: alertPath
      });
      this.results.summary.errors++;
    }
  }

  async setupNotificationChannels() {
    this.log('info', 'Setting up notification channels...');
    
    const notificationChannels = [
      {
        name: 'critical-alerts',
        type: 'slack',
        settings: {
          url: process.env.SLACK_WEBHOOK_URL || '',
          channel: '#trading-bot-alerts',
          title: 'Trading Bot Critical Alert',
          text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        }
      },
      {
        name: 'email-alerts',
        type: 'email',
        settings: {
          addresses: process.env.ALERT_EMAIL_ADDRESSES || 'admin@example.com',
          subject: 'Trading Bot Alert: {{ .GroupLabels.alertname }}'
        }
      }
    ];
    
    for (const channel of notificationChannels) {
      await this.setupNotificationChannel(channel);
    }
  }

  async setupNotificationChannel(channel) {
    try {
      this.log('info', `Setting up notification channel: ${channel.name}`);
      
      const channelPayload = {
        name: channel.name,
        type: channel.type,
        settings: channel.settings,
        isDefault: channel.name === 'critical-alerts'
      };
      
      // Check if channel exists
      const checkCmd = `curl -s -u ${this.grafanaUser}:${this.grafanaPassword} "${this.grafanaUrl}/api/alert-notifications"`;
      const existingChannels = JSON.parse(execSync(checkCmd, { encoding: 'utf8' }));
      
      const existingChannel = existingChannels.find(ch => ch.name === channel.name);
      
      if (existingChannel) {
        this.log('info', `Notification channel already exists: ${channel.name}`);
        this.results.notifications.push({
          name: channel.name,
          status: 'exists',
          id: existingChannel.id
        });
      } else {
        // Create new channel
        const createCmd = `curl -X POST -H "Content-Type: application/json" -u ${this.grafanaUser}:${this.grafanaPassword} "${this.grafanaUrl}/api/alert-notifications" -d '${JSON.stringify(channelPayload)}'`;
        
        const result = execSync(createCmd, { encoding: 'utf8' });
        const createResult = JSON.parse(result);
        
        this.log('success', `Notification channel created: ${channel.name}`);
        this.results.notifications.push({
          name: channel.name,
          status: 'created',
          id: createResult.id,
          result: createResult
        });
      }
      
    } catch (error) {
      this.log('error', `Failed to setup notification channel: ${channel.name}`, { error: error.message });
      this.results.notifications.push({
        name: channel.name,
        status: 'error',
        error: error.message
      });
      this.results.summary.errors++;
    }
  }

  async validateMonitoringStack() {
    this.log('info', 'Validating monitoring stack...');
    
    const validations = [
      {
        name: 'Prometheus Health',
        test: async () => {
          const cmd = `curl -s "${this.prometheusUrl}/-/healthy"`;
          const result = execSync(cmd, { encoding: 'utf8' });
          return result.trim() === 'Prometheus is Healthy.';
        }
      },
      {
        name: 'Grafana Health',
        test: async () => {
          const cmd = `curl -s "${this.grafanaUrl}/api/health"`;
          const result = JSON.parse(execSync(cmd, { encoding: 'utf8' }));
          return result.database === 'ok';
        }
      },
      {
        name: 'Prometheus Targets',
        test: async () => {
          const cmd = `curl -s "${this.prometheusUrl}/api/v1/targets"`;
          const result = JSON.parse(execSync(cmd, { encoding: 'utf8' }));
          return result.status === 'success' && result.data.activeTargets.length > 0;
        }
      },
      {
        name: 'Alert Rules Loaded',
        test: async () => {
          const cmd = `curl -s "${this.prometheusUrl}/api/v1/rules"`;
          const result = JSON.parse(execSync(cmd, { encoding: 'utf8' }));
          return result.status === 'success' && result.data.groups.length > 0;
        }
      }
    ];
    
    for (const validation of validations) {
      try {
        const passed = await validation.test();
        if (passed) {
          this.log('success', `Validation passed: ${validation.name}`);
        } else {
          this.log('error', `Validation failed: ${validation.name}`);
          this.results.summary.errors++;
        }
      } catch (error) {
        this.log('error', `Validation error: ${validation.name}`, { error: error.message });
        this.results.summary.errors++;
      }
    }
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.results.summary,
      dataSource: this.results.dataSource,
      dashboards: this.results.dashboards,
      alerts: this.results.alerts,
      notifications: this.results.notifications,
      dashboardUrls: this.results.dashboards
        .filter(d => d.status === 'success')
        .map(d => ({ name: d.name, url: d.url })),
      recommendations: this.generateRecommendations()
    };
    
    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.results.summary.errors > 0) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Configuration',
        message: `${this.results.summary.errors} configuration errors detected`,
        action: 'Review and fix configuration errors before proceeding'
      });
    }
    
    if (this.results.summary.dashboardsConfigured === 0) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Dashboards',
        message: 'No dashboards configured',
        action: 'Configure monitoring dashboards for operational visibility'
      });
    }
    
    if (this.results.summary.alertsConfigured === 0) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Alerts',
        message: 'No alert rules configured',
        action: 'Configure alert rules for proactive monitoring'
      });
    }
    
    if (this.results.notifications.length === 0) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Notifications',
        message: 'No notification channels configured',
        action: 'Setup notification channels for alert delivery'
      });
    }
    
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'INFO',
        category: 'Success',
        message: 'Monitoring stack configured successfully',
        action: 'Monitor dashboards and validate alert functionality'
      });
    }
    
    return recommendations;
  }

  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 MONITORING DASHBOARD SETUP SUMMARY');
    console.log('='.repeat(80));
    
    const report = this.generateReport();
    
    console.log(`📅 Completed: ${report.timestamp}`);
    console.log(`📊 Dashboards Configured: ${report.summary.dashboardsConfigured}`);
    console.log(`🚨 Alert Rules Configured: ${report.summary.alertsConfigured}`);
    console.log(`📧 Notification Channels: ${report.notifications.length}`);
    console.log(`❌ Errors: ${report.summary.errors}`);
    
    if (report.dashboardUrls.length > 0) {
      console.log('\n📊 Available Dashboards:');
      report.dashboardUrls.forEach(dashboard => {
        console.log(`  • ${dashboard.name}: ${dashboard.url}`);
      });
    }
    
    console.log('\n💡 Recommendations:');
    report.recommendations.forEach(rec => {
      const priorityEmoji = {
        'HIGH': '⚠️',
        'MEDIUM': '📋',
        'INFO': '💡'
      };
      
      console.log(`  ${priorityEmoji[rec.priority]} ${rec.priority}: ${rec.message}`);
      console.log(`     Action: ${rec.action}`);
    });
    
    console.log('\n' + '='.repeat(80));
    
    if (report.summary.errors === 0) {
      console.log('✅ MONITORING SETUP COMPLETED SUCCESSFULLY! ✅');
    } else {
      console.log('⚠️  MONITORING SETUP COMPLETED WITH ERRORS ⚠️');
    }
    
    console.log('='.repeat(80));
    
    return report;
  }

  async run() {
    this.log('info', '📊 Starting Monitoring Dashboard Setup...');
    
    try {
      await this.setupGrafanaDataSource();
      await this.configureDashboards();
      await this.configureAlerts();
      await this.setupNotificationChannels();
      await this.validateMonitoringStack();
      
    } catch (error) {
      this.log('error', `Monitoring setup error: ${error.message}`);
      this.results.summary.errors++;
    }
    
    // Generate and save report
    const report = this.printSummary();
    
    const reportPath = 'monitoring-dashboard-setup-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Setup report saved to: ${reportPath}`);
    
    // Exit with appropriate code
    if (report.summary.errors > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

// CLI usage
if (require.main === module) {
  // Show help
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Monitoring Dashboard Setup

Usage: node setup-monitoring-dashboards.js [options]

Environment Variables:
  GRAFANA_URL              Grafana URL (default: http://localhost:3001)
  GRAFANA_USER             Grafana username (default: admin)
  GRAFANA_PASSWORD         Grafana password (default: admin)
  PROMETHEUS_URL           Prometheus URL (default: http://localhost:9090)
  SLACK_WEBHOOK_URL        Slack webhook for notifications
  ALERT_EMAIL_ADDRESSES    Email addresses for alerts

Examples:
  node setup-monitoring-dashboards.js
  GRAFANA_URL=https://grafana.example.com node setup-monitoring-dashboards.js
    `);
    process.exit(0);
  }
  
  const setup = new MonitoringDashboardSetup();
  setup.run().catch(error => {
    console.error('Monitoring dashboard setup failed:', error);
    process.exit(1);
  });
}

module.exports = MonitoringDashboardSetup;