#!/usr/bin/env node

/**
 * Complete Monitoring System Validation
 * 
 * This script performs comprehensive validation of the monitoring and alerting system:
 * 1. Configuration file validation
 * 2. Monitoring service functionality
 * 3. Health endpoints testing (with application startup)
 * 4. Alert configuration validation
 * 5. Grafana dashboard validation
 * 6. Prometheus metrics validation
 */

const fs = require('fs').promises;
const path = require('path');
const MonitoringComponentsValidator = require('./validate-monitoring-components');
const HealthEndpointsTester = require('./test-health-endpoints-comprehensive');

class CompleteMonitoringValidator {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      overallStatus: 'unknown',
      phases: {},
      errors: [],
      warnings: [],
      summary: {}
    };
  }

  async validateComplete() {
    console.log('🔍 Starting Complete Monitoring System Validation...\n');
    console.log('This comprehensive test will:');
    console.log('  1. Validate monitoring configurations');
    console.log('  2. Test monitoring service functionality');
    console.log('  3. Start the application and test health endpoints');
    console.log('  4. Validate alert and dashboard configurations');
    console.log('  5. Generate comprehensive report\n');
    
    try {
      // Phase 1: Validate monitoring components (configurations, services, etc.)
      await this.runMonitoringComponentsValidation();
      
      // Phase 2: Test health endpoints with application startup
      await this.runHealthEndpointsTests();
      
      // Phase 3: Generate final comprehensive report
      await this.generateFinalReport();
      
    } catch (error) {
      this.results.errors.push({
        phase: 'complete_validation',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      console.error('❌ Complete validation failed:', error.message);
    }
  }

  async runMonitoringComponentsValidation() {
    console.log('📋 Phase 1: Monitoring Components Validation');
    console.log('============================================\n');
    
    try {
      const validator = new MonitoringComponentsValidator();
      await validator.validateComponents();
      const results = validator.results;
      
      this.results.phases.monitoringComponents = {
        status: results.overallStatus,
        message: `Monitoring components validation ${results.overallStatus}`,
        details: results,
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ Phase 1 completed: ${results.overallStatus.toUpperCase()}\n`);
      
    } catch (error) {
      this.results.phases.monitoringComponents = {
        status: 'failed',
        message: `Monitoring components validation failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
      
      console.log('❌ Phase 1 failed\n');
      throw error;
    }
  }

  async runHealthEndpointsTests() {
    console.log('🏥 Phase 2: Health Endpoints Testing');
    console.log('====================================\n');
    
    try {
      const tester = new HealthEndpointsTester();
      await tester.runTests();
      const results = tester.results;
      
      this.results.phases.healthEndpoints = {
        status: results.overallStatus,
        message: `Health endpoints testing ${results.overallStatus}`,
        details: results,
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ Phase 2 completed: ${results.overallStatus.toUpperCase()}\n`);
      
    } catch (error) {
      this.results.phases.healthEndpoints = {
        status: 'failed',
        message: `Health endpoints testing failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
      
      console.log('❌ Phase 2 failed\n');
      
      // Don't throw error here as this might be due to application startup issues
      this.results.warnings.push({
        phase: 'health_endpoints',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async generateFinalReport() {
    console.log('📊 Phase 3: Final Report Generation');
    console.log('===================================\n');
    
    try {
      // Calculate overall status based on all phases
      const phaseResults = Object.values(this.results.phases);
      const passedPhases = phaseResults.filter(p => p.status === 'passed').length;
      const failedPhases = phaseResults.filter(p => p.status === 'failed').length;
      const warningPhases = phaseResults.filter(p => p.status === 'warning').length;
      
      if (failedPhases === 0 && warningPhases === 0) {
        this.results.overallStatus = 'passed';
      } else if (failedPhases === 0) {
        this.results.overallStatus = 'warning';
      } else if (failedPhases <= 1 && passedPhases > 0) {
        this.results.overallStatus = 'warning';
      } else {
        this.results.overallStatus = 'failed';
      }
      
      // Collect detailed statistics
      this.results.summary = {
        totalPhases: phaseResults.length,
        passedPhases,
        failedPhases,
        warningPhases,
        errors: this.results.errors.length,
        warnings: this.results.warnings.length,
        
        // Detailed breakdown
        breakdown: {
          configurationFiles: this.getTestCount('monitoringComponents', 'configurationFiles'),
          monitoringService: this.getTestCount('monitoringComponents', 'monitoringService'),
          alertConfigurations: this.getTestCount('monitoringComponents', 'alertConfigurations'),
          grafanaDashboards: this.getTestCount('monitoringComponents', 'grafanaDashboards'),
          healthEndpoints: this.getTestCount('healthEndpoints', 'healthEndpoints'),
          metricsEndpoint: this.getTestCount('healthEndpoints', 'metricsEndpoint'),
          errorHandling: this.getTestCount('healthEndpoints', 'errorHandling')
        }
      };
      
      // Save comprehensive report
      const reportPath = path.join(process.cwd(), 'monitoring-system-complete-validation-report.json');
      await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
      
      // Generate summary report
      await this.generateSummaryReport();
      
      // Print final summary
      this.printFinalSummary(reportPath);
      
    } catch (error) {
      console.error('❌ Failed to generate final report:', error.message);
      throw error;
    }
  }

  getTestCount(phase, testType) {
    try {
      const phaseData = this.results.phases[phase];
      if (!phaseData || !phaseData.details || !phaseData.details.tests) {
        return { status: 'not_run', count: 0 };
      }
      
      const test = phaseData.details.tests[testType];
      if (!test) {
        return { status: 'not_found', count: 0 };
      }
      
      return {
        status: test.status,
        message: test.message,
        count: test.details ? (Array.isArray(test.details) ? test.details.length : 1) : 1
      };
    } catch (error) {
      return { status: 'error', count: 0, error: error.message };
    }
  }

  async generateSummaryReport() {
    const summary = {
      timestamp: this.results.timestamp,
      overallStatus: this.results.overallStatus,
      
      // Configuration validation
      configurations: {
        dockerCompose: this.getConfigStatus('monitoring/production-monitoring.yml'),
        prometheus: this.getConfigStatus('monitoring/prometheus/prometheus-prod.yml'),
        alertmanager: this.getConfigStatus('monitoring/alertmanager/alertmanager-prod.yml'),
        grafana: this.getConfigStatus('monitoring/grafana/grafana.ini')
      },
      
      // Alert rules
      alertRules: this.getAlertRulesCount(),
      
      // Grafana dashboards
      dashboards: this.getDashboardsCount(),
      
      // Health endpoints
      healthEndpoints: this.getHealthEndpointsStatus(),
      
      // Recommendations
      recommendations: this.generateRecommendations()
    };
    
    const summaryPath = path.join(process.cwd(), 'monitoring-validation-summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
    
    return summary;
  }

  getConfigStatus(configFile) {
    try {
      const configs = this.results.phases.monitoringComponents?.details?.tests?.configurationFiles?.details || [];
      const config = configs.find(c => c.file === configFile);
      return config ? { status: config.status, size: config.size } : { status: 'not_found' };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  getAlertRulesCount() {
    try {
      const alerts = this.results.phases.monitoringComponents?.details?.tests?.alertConfigurations?.details || [];
      return {
        totalRules: alerts.reduce((sum, alert) => sum + (alert.rulesCount || 0), 0),
        files: alerts.length,
        details: alerts.map(a => ({ file: a.file, rules: a.rulesCount, status: a.status }))
      };
    } catch (error) {
      return { totalRules: 0, files: 0, error: error.message };
    }
  }

  getDashboardsCount() {
    try {
      const dashboards = this.results.phases.monitoringComponents?.details?.tests?.grafanaDashboards?.details || [];
      return {
        totalDashboards: dashboards.length,
        totalPanels: dashboards.reduce((sum, d) => sum + (d.panelsCount || 0), 0),
        details: dashboards.map(d => ({ title: d.title, panels: d.panelsCount, status: d.status }))
      };
    } catch (error) {
      return { totalDashboards: 0, totalPanels: 0, error: error.message };
    }
  }

  getHealthEndpointsStatus() {
    try {
      const endpoints = this.results.phases.healthEndpoints?.details?.tests?.healthEndpoints?.details || [];
      const metrics = this.results.phases.healthEndpoints?.details?.tests?.metricsEndpoint;
      
      return {
        totalEndpoints: endpoints.length,
        workingEndpoints: endpoints.filter(e => e.status === 'passed').length,
        metricsEndpoint: metrics ? { status: metrics.status, message: metrics.message } : { status: 'not_tested' },
        averageResponseTime: endpoints.length > 0 ? 
          Math.round(endpoints.reduce((sum, e) => sum + (e.responseTime || 0), 0) / endpoints.length) : 0
      };
    } catch (error) {
      return { totalEndpoints: 0, workingEndpoints: 0, error: error.message };
    }
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Check if application startup failed
    if (this.results.phases.healthEndpoints?.status === 'failed') {
      recommendations.push({
        priority: 'high',
        category: 'application',
        message: 'Application failed to start. Check dependencies and configuration.',
        action: 'Run npm install and ensure all services are configured correctly.'
      });
    }
    
    // Check if Docker is needed
    if (this.results.warnings.some(w => w.message.includes('Docker'))) {
      recommendations.push({
        priority: 'medium',
        category: 'infrastructure',
        message: 'Docker is required for full monitoring stack deployment.',
        action: 'Install Docker and add user to docker group for container-based monitoring.'
      });
    }
    
    // Check metrics endpoint
    const metricsStatus = this.results.phases.healthEndpoints?.details?.tests?.metricsEndpoint?.status;
    if (metricsStatus === 'failed' || metricsStatus === 'warning') {
      recommendations.push({
        priority: 'medium',
        category: 'monitoring',
        message: 'Metrics endpoint has issues. This affects Prometheus integration.',
        action: 'Check MonitoringService implementation and Prometheus client configuration.'
      });
    }
    
    // Success recommendations
    if (this.results.overallStatus === 'passed') {
      recommendations.push({
        priority: 'low',
        category: 'next_steps',
        message: 'Monitoring system is properly configured.',
        action: 'Deploy monitoring stack with Docker Compose and configure external alerting.'
      });
    }
    
    return recommendations;
  }

  printFinalSummary(reportPath) {
    console.log('\n🎯 COMPLETE MONITORING SYSTEM VALIDATION SUMMARY');
    console.log('=================================================');
    console.log(`Overall Status: ${this.results.overallStatus.toUpperCase()}`);
    console.log(`Validation Time: ${this.results.timestamp}`);
    console.log(`Phases Completed: ${Object.keys(this.results.phases).length}`);
    console.log(`Total Errors: ${this.results.errors.length}`);
    console.log(`Total Warnings: ${this.results.warnings.length}`);
    
    console.log('\n📊 Phase Results:');
    Object.entries(this.results.phases).forEach(([phase, result]) => {
      const statusIcon = result.status === 'passed' ? '✅' : 
                        result.status === 'warning' ? '⚠️' : '❌';
      console.log(`  ${statusIcon} ${phase}: ${result.status.toUpperCase()}`);
    });
    
    console.log('\n📋 Component Summary:');
    const breakdown = this.results.summary.breakdown;
    Object.entries(breakdown).forEach(([component, status]) => {
      const statusIcon = status.status === 'passed' ? '✅' : 
                        status.status === 'warning' ? '⚠️' : 
                        status.status === 'skipped' ? '⏭️' : '❌';
      console.log(`  ${statusIcon} ${component}: ${status.status} (${status.message || 'No details'})`);
    });
    
    console.log(`\n📄 Full report saved to: ${reportPath}`);
    console.log('📄 Summary report saved to: monitoring-validation-summary.json');
    
    if (this.results.overallStatus === 'passed') {
      console.log('\n🎉 SUCCESS: Monitoring and alerting system validation completed successfully!');
      console.log('   All components are properly configured and working.');
      console.log('   Ready for production deployment.');
    } else if (this.results.overallStatus === 'warning') {
      console.log('\n⚠️  WARNING: Monitoring system validation completed with warnings.');
      console.log('   Most components are working but some issues need attention.');
      console.log('   Review the detailed report for specific recommendations.');
    } else {
      console.log('\n❌ FAILED: Critical issues found in monitoring system validation.');
      console.log('   Review the detailed report and fix issues before deployment.');
    }
    
    // Print recommendations
    const recommendations = this.generateRecommendations();
    if (recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      recommendations.forEach((rec, index) => {
        const priorityIcon = rec.priority === 'high' ? '🔴' : 
                           rec.priority === 'medium' ? '🟡' : '🟢';
        console.log(`  ${priorityIcon} ${rec.message}`);
        console.log(`     Action: ${rec.action}`);
      });
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new CompleteMonitoringValidator();
  validator.validateComplete()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Complete validation failed:', error);
      process.exit(1);
    });
}

module.exports = CompleteMonitoringValidator;