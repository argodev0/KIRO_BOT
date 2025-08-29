#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class AlertingImplementationValidator {
  constructor() {
    this.basePath = path.join(__dirname, '..');
    this.validationResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
  }

  async validateImplementation() {
    console.log('🔍 Validating Production Alerting System Implementation...\n');

    // Check required files
    await this.validateRequiredFiles();
    
    // Check service implementations
    await this.validateServiceImplementations();
    
    // Check middleware integration
    await this.validateMiddlewareIntegration();
    
    // Check API routes
    await this.validateAPIRoutes();
    
    // Check configuration files
    await this.validateConfigurationFiles();
    
    // Check documentation
    await this.validateDocumentation();

    this.printResults();
    return this.validationResults;
  }

  async validateRequiredFiles() {
    console.log('📁 Validating Required Files...');

    const requiredFiles = [
      'src/services/ProductionAlertingService.ts',
      'src/controllers/AlertingController.ts',
      'src/routes/alerting.ts',
      'src/middleware/alertingIntegration.ts',
      'scripts/test-production-alerting.js',
      '.env.alerting.example',
      'PRODUCTION_ALERTING_SYSTEM_IMPLEMENTATION.md'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(this.basePath, file);
      if (fs.existsSync(filePath)) {
        this.recordTest(`File exists: ${file}`, true, 'File found');
      } else {
        this.recordTest(`File exists: ${file}`, false, 'File not found');
      }
    }
  }

  async validateServiceImplementations() {
    console.log('🔧 Validating Service Implementations...');

    try {
      // Check ProductionAlertingService
      const alertingServicePath = path.join(this.basePath, 'src/services/ProductionAlertingService.ts');
      if (fs.existsSync(alertingServicePath)) {
        const content = fs.readFileSync(alertingServicePath, 'utf8');
        
        const requiredMethods = [
          'detectCriticalIssue',
          'resolveCriticalIssue',
          'updatePerformanceMetric',
          'checkPaperTradingSafety',
          'sendImmediateAlert',
          'testAlertingSystem'
        ];

        for (const method of requiredMethods) {
          if (content.includes(method)) {
            this.recordTest(`ProductionAlertingService.${method}`, true, 'Method implemented');
          } else {
            this.recordTest(`ProductionAlertingService.${method}`, false, 'Method not found');
          }
        }

        // Check for critical features
        const criticalFeatures = [
          'email notifications',
          'webhook notifications',
          'slack notifications',
          'paper trading safety',
          'performance monitoring',
          'escalation rules'
        ];

        for (const feature of criticalFeatures) {
          const featurePattern = feature.replace(/\s+/g, '.*');
          const regex = new RegExp(featurePattern, 'i');
          if (regex.test(content)) {
            this.recordTest(`Feature: ${feature}`, true, 'Feature implemented');
          } else {
            this.recordTest(`Feature: ${feature}`, false, 'Feature not found');
          }
        }
      }

      // Check AlertingController
      const controllerPath = path.join(this.basePath, 'src/controllers/AlertingController.ts');
      if (fs.existsSync(controllerPath)) {
        const content = fs.readFileSync(controllerPath, 'utf8');
        
        const requiredEndpoints = [
          'getCriticalIssues',
          'createCriticalIssue',
          'resolveCriticalIssue',
          'getPerformanceMetrics',
          'updatePerformanceMetric',
          'testAlertingSystem',
          'receiveWebhookAlert'
        ];

        for (const endpoint of requiredEndpoints) {
          if (content.includes(endpoint)) {
            this.recordTest(`AlertingController.${endpoint}`, true, 'Endpoint implemented');
          } else {
            this.recordTest(`AlertingController.${endpoint}`, false, 'Endpoint not found');
          }
        }
      }

    } catch (error) {
      this.recordTest('Service Implementation Validation', false, error.message);
    }
  }

  async validateMiddlewareIntegration() {
    console.log('🔗 Validating Middleware Integration...');

    try {
      const middlewarePath = path.join(this.basePath, 'src/middleware/alertingIntegration.ts');
      if (fs.existsSync(middlewarePath)) {
        const content = fs.readFileSync(middlewarePath, 'utf8');
        
        const requiredMiddleware = [
          'requestMonitoring',
          'errorTracking',
          'securityMonitoring',
          'paperTradingSafetyMonitoring',
          'systemHealthMonitoring'
        ];

        for (const middleware of requiredMiddleware) {
          if (content.includes(middleware)) {
            this.recordTest(`Middleware: ${middleware}`, true, 'Middleware implemented');
          } else {
            this.recordTest(`Middleware: ${middleware}`, false, 'Middleware not found');
          }
        }
      }

      // Check main application integration
      const indexPath = path.join(this.basePath, 'src/index.ts');
      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath, 'utf8');
        
        if (content.includes('ProductionAlertingService')) {
          this.recordTest('Main App Integration: ProductionAlertingService', true, 'Service imported');
        } else {
          this.recordTest('Main App Integration: ProductionAlertingService', false, 'Service not imported');
        }

        if (content.includes('alertingIntegration')) {
          this.recordTest('Main App Integration: alertingIntegration', true, 'Middleware imported');
        } else {
          this.recordTest('Main App Integration: alertingIntegration', false, 'Middleware not imported');
        }

        if (content.includes('/api/alerting')) {
          this.recordTest('Main App Integration: alerting routes', true, 'Routes mounted');
        } else {
          this.recordTest('Main App Integration: alerting routes', false, 'Routes not mounted');
        }
      }

    } catch (error) {
      this.recordTest('Middleware Integration Validation', false, error.message);
    }
  }

  async validateAPIRoutes() {
    console.log('🛣️ Validating API Routes...');

    try {
      const routesPath = path.join(this.basePath, 'src/routes/alerting.ts');
      if (fs.existsSync(routesPath)) {
        const content = fs.readFileSync(routesPath, 'utf8');
        
        const requiredRoutes = [
          'GET.*issues',
          'POST.*issues',
          'PATCH.*resolve',
          'GET.*metrics',
          'POST.*metrics',
          'GET.*thresholds',
          'POST.*webhook',
          'POST.*test',
          'GET.*health'
        ];

        for (const route of requiredRoutes) {
          const regex = new RegExp(route, 'i');
          if (regex.test(content)) {
            this.recordTest(`Route: ${route}`, true, 'Route defined');
          } else {
            this.recordTest(`Route: ${route}`, false, 'Route not found');
          }
        }

        // Check for authentication middleware
        if (content.includes('auth')) {
          this.recordTest('Route Security: Authentication', true, 'Auth middleware applied');
        } else {
          this.recordTest('Route Security: Authentication', false, 'Auth middleware not found');
        }

        // Check for input validation
        if (content.includes('inputValidation')) {
          this.recordTest('Route Security: Input Validation', true, 'Validation middleware applied');
        } else {
          this.recordTest('Route Security: Input Validation', false, 'Validation middleware not found');
        }
      }

    } catch (error) {
      this.recordTest('API Routes Validation', false, error.message);
    }
  }

  async validateConfigurationFiles() {
    console.log('⚙️ Validating Configuration Files...');

    try {
      const envExamplePath = path.join(this.basePath, '.env.alerting.example');
      if (fs.existsSync(envExamplePath)) {
        const content = fs.readFileSync(envExamplePath, 'utf8');
        
        const requiredEnvVars = [
          'PRODUCTION_ALERTING_ENABLED',
          'EMAIL_ALERTS_ENABLED',
          'SLACK_ALERTS_ENABLED',
          'WEBHOOK_ALERTS_ENABLED',
          'SMTP_HOST',
          'SLACK_WEBHOOK_URL',
          'PAPER_TRADING_SAFETY_SCORE_THRESHOLD'
        ];

        for (const envVar of requiredEnvVars) {
          if (content.includes(envVar)) {
            this.recordTest(`Environment Variable: ${envVar}`, true, 'Variable documented');
          } else {
            this.recordTest(`Environment Variable: ${envVar}`, false, 'Variable not documented');
          }
        }
      }

      // Check for Grafana alert rules
      const grafanaAlertsPath = path.join(this.basePath, 'monitoring/grafana/provisioning/alerting/alert-rules.yml');
      if (fs.existsSync(grafanaAlertsPath)) {
        this.recordTest('Grafana Alert Rules', true, 'Alert rules file exists');
      } else {
        this.recordTest('Grafana Alert Rules', false, 'Alert rules file not found');
      }

      // Check for Prometheus alert rules
      const prometheusRulesPath = path.join(this.basePath, 'monitoring/prometheus/rules');
      if (fs.existsSync(prometheusRulesPath)) {
        const files = fs.readdirSync(prometheusRulesPath);
        const alertFiles = files.filter(f => f.includes('alert') && f.endsWith('.yml'));
        if (alertFiles.length > 0) {
          this.recordTest('Prometheus Alert Rules', true, `Found ${alertFiles.length} alert rule files`);
        } else {
          this.recordTest('Prometheus Alert Rules', false, 'No alert rule files found');
        }
      }

    } catch (error) {
      this.recordTest('Configuration Files Validation', false, error.message);
    }
  }

  async validateDocumentation() {
    console.log('📚 Validating Documentation...');

    try {
      const docPath = path.join(this.basePath, 'PRODUCTION_ALERTING_SYSTEM_IMPLEMENTATION.md');
      if (fs.existsSync(docPath)) {
        const content = fs.readFileSync(docPath, 'utf8');
        
        const requiredSections = [
          'Overview',
          'Features Implemented',
          'Architecture',
          'Configuration',
          'API Endpoints',
          'Usage Examples',
          'Notification Channels',
          'Testing',
          'Security Considerations',
          'Troubleshooting'
        ];

        for (const section of requiredSections) {
          if (content.includes(section)) {
            this.recordTest(`Documentation Section: ${section}`, true, 'Section present');
          } else {
            this.recordTest(`Documentation Section: ${section}`, false, 'Section missing');
          }
        }

        // Check for code examples
        const codeBlockCount = (content.match(/```/g) || []).length / 2;
        if (codeBlockCount >= 10) {
          this.recordTest('Documentation: Code Examples', true, `Found ${codeBlockCount} code examples`);
        } else {
          this.recordTest('Documentation: Code Examples', false, `Only ${codeBlockCount} code examples found`);
        }
      }

    } catch (error) {
      this.recordTest('Documentation Validation', false, error.message);
    }
  }

  recordTest(testName, passed, details) {
    this.validationResults.total++;
    if (passed) {
      this.validationResults.passed++;
      console.log(`  ✅ ${testName}: ${details}`);
    } else {
      this.validationResults.failed++;
      console.log(`  ❌ ${testName}: ${details}`);
    }
    
    this.validationResults.details.push({
      name: testName,
      passed,
      details,
      timestamp: new Date().toISOString()
    });
  }

  printResults() {
    console.log('\n' + '='.repeat(70));
    console.log('📋 PRODUCTION ALERTING SYSTEM IMPLEMENTATION VALIDATION');
    console.log('='.repeat(70));
    console.log(`Total Checks: ${this.validationResults.total}`);
    console.log(`Passed: ${this.validationResults.passed} ✅`);
    console.log(`Failed: ${this.validationResults.failed} ❌`);
    console.log(`Success Rate: ${((this.validationResults.passed / this.validationResults.total) * 100).toFixed(1)}%`);
    console.log('='.repeat(70));
    
    if (this.validationResults.failed > 0) {
      console.log('\n❌ FAILED VALIDATIONS:');
      this.validationResults.details
        .filter(test => !test.passed)
        .forEach(test => {
          console.log(`  • ${test.name}: ${test.details}`);
        });
    }
    
    console.log('\n🎯 IMPLEMENTATION STATUS:');
    
    if (this.validationResults.failed === 0) {
      console.log('  ✅ All validations passed! Production alerting system is fully implemented.');
      console.log('  🚀 Ready for testing and deployment.');
    } else if (this.validationResults.failed <= 3) {
      console.log('  ⚠️  Minor issues found. Implementation is mostly complete.');
      console.log('  🔧 Address the failed validations for full compliance.');
    } else {
      console.log('  ❌ Multiple issues found. Implementation needs attention.');
      console.log('  📝 Review and fix the failed validations before proceeding.');
    }
    
    console.log('\n📋 NEXT STEPS:');
    console.log('  1. Fix any failed validations');
    console.log('  2. Configure environment variables (.env.alerting.example)');
    console.log('  3. Run the test suite: node scripts/test-production-alerting.js');
    console.log('  4. Deploy and monitor the alerting system');
    
    // Save results to file
    const resultsFile = `alerting-implementation-validation-${Date.now()}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(this.validationResults, null, 2));
    console.log(`\n📄 Detailed results saved to: ${resultsFile}`);
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new AlertingImplementationValidator();
  
  validator.validateImplementation()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}

module.exports = AlertingImplementationValidator;