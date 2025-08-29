#!/usr/bin/env node

/**
 * Production Deployment Handover Report Generator
 * 
 * Generates comprehensive handover documentation for production deployment completion
 * Requirements: All requirements final validation (Task 14)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DeploymentHandoverReportGenerator {
  constructor() {
    this.projectRoot = process.cwd();
    this.reportsDir = path.join(this.projectRoot, 'deployment-reports');
    this.timestamp = new Date().toISOString();
    
    this.handoverData = {
      metadata: {
        projectName: 'AI Crypto Trading Bot - Paper Trading System',
        version: '1.0',
        generatedAt: this.timestamp,
        generatedBy: 'Production Deployment Team'
      },
      validationResults: null,
      infrastructure: null,
      monitoring: null,
      documentation: null,
      operationalReadiness: null,
      recommendations: [],
      nextSteps: []
    };
    
    // Ensure reports directory exists
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  log(level, message, details = null) {
    const timestamp = new Date().toISOString();
    const levelEmoji = {
      info: '📋',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    
    console.log(`${levelEmoji[level] || '📋'} [${timestamp}] ${message}`);
    if (details) {
      console.log(`   ${JSON.stringify(details, null, 2)}`);
    }
  }

  async collectValidationResults() {
    this.log('info', 'Collecting validation results...');
    
    const validationFiles = [
      'production-validation-suite-report.json',
      'production-readiness-report.json',
      'paper-trading-safety-report.json',
      'production-smoke-test-report.json',
      'performance-benchmark-report.json'
    ];
    
    const validationResults = {
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        critical: 0,
        overallStatus: 'UNKNOWN'
      },
      reports: {}
    };
    
    for (const file of validationFiles) {
      const filePath = path.join(this.projectRoot, file);
      if (fs.existsSync(filePath)) {
        try {
          const reportData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          validationResults.reports[file] = reportData;
          
          // Aggregate summary data
          if (reportData.summary) {
            validationResults.summary.totalTests += reportData.summary.totalPassed || 0;
            validationResults.summary.totalTests += reportData.summary.totalFailed || 0;
            validationResults.summary.passed += reportData.summary.totalPassed || 0;
            validationResults.summary.failed += reportData.summary.totalFailed || 0;
            validationResults.summary.critical += reportData.summary.totalCritical || 0;
          }
          
          this.log('success', `Loaded validation report: ${file}`);
        } catch (error) {
          this.log('error', `Failed to load validation report: ${file}`, { error: error.message });
        }
      } else {
        this.log('warning', `Validation report not found: ${file}`);
      }
    }
    
    // Determine overall status
    if (validationResults.summary.critical > 0) {
      validationResults.summary.overallStatus = 'CRITICAL_FAILURE';
    } else if (validationResults.summary.failed > 0) {
      validationResults.summary.overallStatus = 'FAILED';
    } else if (validationResults.summary.passed > 0) {
      validationResults.summary.overallStatus = 'PASSED';
    }
    
    this.handoverData.validationResults = validationResults;
  }

  async assessInfrastructureReadiness() {
    this.log('info', 'Assessing infrastructure readiness...');
    
    const infrastructure = {
      docker: {
        installed: false,
        version: null,
        composeVersion: null
      },
      nodejs: {
        installed: false,
        version: null,
        compatible: false
      },
      services: {
        configured: [],
        missing: []
      },
      configuration: {
        environment: null,
        ssl: null,
        monitoring: null
      }
    };
    
    try {
      // Check Docker
      const dockerVersion = execSync('docker --version', { encoding: 'utf8' }).trim();
      infrastructure.docker.installed = true;
      infrastructure.docker.version = dockerVersion;
      
      const composeVersion = execSync('docker-compose --version', { encoding: 'utf8' }).trim();
      infrastructure.docker.composeVersion = composeVersion;
      
      this.log('success', 'Docker installation verified', { version: dockerVersion });
    } catch (error) {
      this.log('error', 'Docker not installed or not accessible');
    }
    
    try {
      // Check Node.js
      const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
      infrastructure.nodejs.installed = true;
      infrastructure.nodejs.version = nodeVersion;
      
      const versionNumber = parseFloat(nodeVersion.replace('v', ''));
      infrastructure.nodejs.compatible = versionNumber >= 18.0;
      
      this.log('success', 'Node.js installation verified', { version: nodeVersion, compatible: infrastructure.nodejs.compatible });
    } catch (error) {
      this.log('error', 'Node.js not installed or not accessible');
    }
    
    // Check Docker Compose configuration
    const composeFile = path.join(this.projectRoot, 'docker/docker-compose.prod.yml');
    if (fs.existsSync(composeFile)) {
      try {
        const composeContent = fs.readFileSync(composeFile, 'utf8');
        const services = composeContent.match(/^\s*([a-zA-Z0-9_-]+):/gm);
        if (services) {
          infrastructure.services.configured = services.map(s => s.replace(':', '').trim());
        }
        this.log('success', 'Docker Compose configuration found', { services: infrastructure.services.configured });
      } catch (error) {
        this.log('error', 'Failed to parse Docker Compose configuration');
      }
    }
    
    // Check environment configuration
    const envFile = path.join(this.projectRoot, '.env.production');
    if (fs.existsSync(envFile)) {
      infrastructure.configuration.environment = 'configured';
      this.log('success', 'Production environment configuration found');
    } else {
      infrastructure.configuration.environment = 'missing';
      this.log('warning', 'Production environment configuration missing');
    }
    
    this.handoverData.infrastructure = infrastructure;
  }

  async assessMonitoringSetup() {
    this.log('info', 'Assessing monitoring setup...');
    
    const monitoring = {
      prometheus: {
        configured: false,
        configFile: null
      },
      grafana: {
        configured: false,
        dashboards: []
      },
      alerts: {
        configured: false,
        ruleFiles: []
      },
      healthChecks: {
        implemented: false,
        endpoints: []
      }
    };
    
    // Check Prometheus configuration
    const prometheusConfig = path.join(this.projectRoot, 'monitoring/prometheus.yml');
    if (fs.existsSync(prometheusConfig)) {
      monitoring.prometheus.configured = true;
      monitoring.prometheus.configFile = prometheusConfig;
      this.log('success', 'Prometheus configuration found');
    }
    
    // Check Grafana dashboards
    const dashboardsDir = path.join(this.projectRoot, 'monitoring/grafana/dashboards');
    if (fs.existsSync(dashboardsDir)) {
      const dashboardFiles = fs.readdirSync(dashboardsDir).filter(f => f.endsWith('.json'));
      monitoring.grafana.configured = dashboardFiles.length > 0;
      monitoring.grafana.dashboards = dashboardFiles;
      this.log('success', `Found ${dashboardFiles.length} Grafana dashboards`);
    }
    
    // Check alert rules
    const alertsDir = path.join(this.projectRoot, 'monitoring/prometheus/rules');
    if (fs.existsSync(alertsDir)) {
      const alertFiles = fs.readdirSync(alertsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
      monitoring.alerts.configured = alertFiles.length > 0;
      monitoring.alerts.ruleFiles = alertFiles;
      this.log('success', `Found ${alertFiles.length} alert rule files`);
    }
    
    // Check health check endpoints
    const healthRoutes = path.join(this.projectRoot, 'src/routes/health.ts');
    if (fs.existsSync(healthRoutes)) {
      monitoring.healthChecks.implemented = true;
      monitoring.healthChecks.endpoints = ['/health', '/health/detailed', '/health/safety'];
      this.log('success', 'Health check endpoints implemented');
    }
    
    this.handoverData.monitoring = monitoring;
  }

  async assessDocumentation() {
    this.log('info', 'Assessing documentation completeness...');
    
    const documentation = {
      deployment: {
        guides: [],
        runbooks: [],
        procedures: []
      },
      operational: {
        runbooks: false,
        procedures: false,
        troubleshooting: false
      },
      api: {
        documentation: false,
        swagger: false
      },
      user: {
        guides: [],
        tutorials: []
      }
    };
    
    // Check deployment documentation
    const deploymentDocsDir = path.join(this.projectRoot, 'docs/deployment');
    if (fs.existsSync(deploymentDocsDir)) {
      const deploymentFiles = fs.readdirSync(deploymentDocsDir);
      documentation.deployment.guides = deploymentFiles.filter(f => f.includes('GUIDE') || f.includes('README'));
      documentation.deployment.runbooks = deploymentFiles.filter(f => f.includes('runbook'));
      documentation.deployment.procedures = deploymentFiles.filter(f => f.includes('PROCEDURE') || f.includes('ROLLBACK'));
      
      documentation.operational.runbooks = deploymentFiles.some(f => f.includes('runbook'));
      documentation.operational.procedures = deploymentFiles.some(f => f.includes('PROCEDURE'));
      
      this.log('success', `Found ${deploymentFiles.length} deployment documentation files`);
    }
    
    // Check API documentation
    const swaggerConfig = path.join(this.projectRoot, 'src/config/swagger.ts');
    if (fs.existsSync(swaggerConfig)) {
      documentation.api.swagger = true;
      this.log('success', 'Swagger API documentation configured');
    }
    
    // Check user documentation
    const userDocsDir = path.join(this.projectRoot, 'docs');
    if (fs.existsSync(userDocsDir)) {
      const userFiles = fs.readdirSync(userDocsDir).filter(f => f.includes('USER') || f.includes('GUIDE'));
      documentation.user.guides = userFiles;
      this.log('success', `Found ${userFiles.length} user documentation files`);
    }
    
    this.handoverData.documentation = documentation;
  }

  async assessOperationalReadiness() {
    this.log('info', 'Assessing operational readiness...');
    
    const operational = {
      backupSystem: {
        configured: false,
        automated: false,
        tested: false
      },
      security: {
        ssl: false,
        authentication: false,
        authorization: false,
        auditing: false
      },
      scalability: {
        horizontal: false,
        vertical: false,
        loadBalancing: false
      },
      maintenance: {
        procedures: false,
        automation: false,
        scheduling: false
      }
    };
    
    // Check backup system
    const backupScript = path.join(this.projectRoot, 'scripts/backup-automation.sh');
    if (fs.existsSync(backupScript)) {
      operational.backupSystem.configured = true;
      operational.backupSystem.automated = true;
      this.log('success', 'Backup automation configured');
    }
    
    // Check security configuration
    const securityConfig = path.join(this.projectRoot, 'src/config/security.ts');
    if (fs.existsSync(securityConfig)) {
      operational.security.authentication = true;
      operational.security.authorization = true;
      this.log('success', 'Security configuration found');
    }
    
    const sslConfig = path.join(this.projectRoot, 'docker/scripts/ssl-setup.sh');
    if (fs.existsSync(sslConfig)) {
      operational.security.ssl = true;
      this.log('success', 'SSL configuration found');
    }
    
    // Check scalability configuration
    const dockerCompose = path.join(this.projectRoot, 'docker/docker-compose.prod.yml');
    if (fs.existsSync(dockerCompose)) {
      const composeContent = fs.readFileSync(dockerCompose, 'utf8');
      operational.scalability.horizontal = composeContent.includes('replicas') || composeContent.includes('scale');
      operational.scalability.loadBalancing = composeContent.includes('nginx') || composeContent.includes('load');
      this.log('success', 'Scalability configuration assessed');
    }
    
    this.handoverData.operationalReadiness = operational;
  }

  generateRecommendations() {
    this.log('info', 'Generating recommendations...');
    
    const recommendations = [];
    
    // Validation-based recommendations
    if (this.handoverData.validationResults?.summary.critical > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        category: 'Safety',
        issue: 'Critical safety violations detected',
        action: 'DO NOT DEPLOY - Fix all critical safety issues immediately',
        impact: 'Risk of real money trading in production'
      });
    }
    
    if (this.handoverData.validationResults?.summary.failed > 0) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Testing',
        issue: `${this.handoverData.validationResults.summary.failed} tests failing`,
        action: 'Fix all failing tests before deployment',
        impact: 'Deployment may fail or system may be unstable'
      });
    }
    
    // Infrastructure-based recommendations
    if (!this.handoverData.infrastructure?.nodejs.compatible) {
      recommendations.push({
        priority: 'CRITICAL',
        category: 'Infrastructure',
        issue: 'Node.js version incompatible (requires >=18.0.0)',
        action: 'Upgrade Node.js to version 18 or higher',
        impact: 'Application will not start or dependencies will fail'
      });
    }
    
    if (!this.handoverData.infrastructure?.docker.installed) {
      recommendations.push({
        priority: 'CRITICAL',
        category: 'Infrastructure',
        issue: 'Docker not installed',
        action: 'Install Docker and Docker Compose',
        impact: 'Cannot deploy containerized application'
      });
    }
    
    // Monitoring-based recommendations
    if (!this.handoverData.monitoring?.prometheus.configured) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Monitoring',
        issue: 'Prometheus monitoring not configured',
        action: 'Configure Prometheus metrics collection',
        impact: 'No system monitoring or alerting capability'
      });
    }
    
    if (!this.handoverData.monitoring?.grafana.configured) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Monitoring',
        issue: 'Grafana dashboards not configured',
        action: 'Setup Grafana dashboards for operational visibility',
        impact: 'Limited operational visibility and troubleshooting capability'
      });
    }
    
    // Documentation-based recommendations
    if (!this.handoverData.documentation?.operational.runbooks) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Documentation',
        issue: 'Operational runbooks missing',
        action: 'Complete operational runbooks and procedures',
        impact: 'Difficult incident response and maintenance'
      });
    }
    
    // Success recommendations
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'INFO',
        category: 'Success',
        issue: 'All deployment prerequisites met',
        action: 'Proceed with production deployment',
        impact: 'System ready for production use'
      });
    }
    
    this.handoverData.recommendations = recommendations;
  }

  generateNextSteps() {
    this.log('info', 'Generating next steps...');
    
    const nextSteps = [];
    
    // Determine deployment readiness
    const criticalIssues = this.handoverData.recommendations.filter(r => r.priority === 'CRITICAL').length;
    const highIssues = this.handoverData.recommendations.filter(r => r.priority === 'HIGH').length;
    
    if (criticalIssues > 0) {
      nextSteps.push({
        phase: 'IMMEDIATE',
        title: 'Resolve Critical Issues',
        description: 'Fix all critical issues before proceeding',
        estimatedTime: '2-4 hours',
        tasks: this.handoverData.recommendations
          .filter(r => r.priority === 'CRITICAL')
          .map(r => r.action)
      });
    }
    
    if (highIssues > 0) {
      nextSteps.push({
        phase: 'SHORT_TERM',
        title: 'Resolve High Priority Issues',
        description: 'Fix high priority issues for stable deployment',
        estimatedTime: '1-2 hours',
        tasks: this.handoverData.recommendations
          .filter(r => r.priority === 'HIGH')
          .map(r => r.action)
      });
    }
    
    if (criticalIssues === 0 && highIssues === 0) {
      nextSteps.push({
        phase: 'DEPLOYMENT',
        title: 'Execute Production Deployment',
        description: 'System ready for production deployment',
        estimatedTime: '30-60 minutes',
        tasks: [
          'Run final validation suite',
          'Create pre-deployment backup',
          'Execute deployment script',
          'Validate post-deployment functionality',
          'Activate monitoring and alerting'
        ]
      });
    }
    
    nextSteps.push({
      phase: 'POST_DEPLOYMENT',
      title: 'Post-Deployment Operations',
      description: 'Ongoing operational activities',
      estimatedTime: 'Continuous',
      tasks: [
        'Monitor system health and performance',
        'Validate paper trading safety daily',
        'Review and respond to alerts',
        'Perform regular maintenance',
        'Update documentation as needed'
      ]
    });
    
    this.handoverData.nextSteps = nextSteps;
  }

  generateHandoverReport() {
    const report = {
      ...this.handoverData,
      executiveSummary: this.generateExecutiveSummary(),
      deploymentReadiness: this.assessDeploymentReadiness(),
      riskAssessment: this.generateRiskAssessment()
    };
    
    return report;
  }

  generateExecutiveSummary() {
    const criticalIssues = this.handoverData.recommendations.filter(r => r.priority === 'CRITICAL').length;
    const highIssues = this.handoverData.recommendations.filter(r => r.priority === 'HIGH').length;
    const totalTests = this.handoverData.validationResults?.summary.totalTests || 0;
    const passedTests = this.handoverData.validationResults?.summary.passed || 0;
    
    let status = 'READY';
    let statusDescription = 'System is ready for production deployment';
    
    if (criticalIssues > 0) {
      status = 'BLOCKED';
      statusDescription = `Deployment blocked by ${criticalIssues} critical issue(s)`;
    } else if (highIssues > 0) {
      status = 'CONDITIONAL';
      statusDescription = `Deployment possible after resolving ${highIssues} high priority issue(s)`;
    }
    
    return {
      status,
      statusDescription,
      testResults: {
        total: totalTests,
        passed: passedTests,
        successRate: totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0
      },
      criticalIssues,
      highIssues,
      recommendation: status === 'READY' ? 'PROCEED WITH DEPLOYMENT' : 'RESOLVE ISSUES BEFORE DEPLOYMENT'
    };
  }

  assessDeploymentReadiness() {
    const readiness = {
      infrastructure: 'UNKNOWN',
      testing: 'UNKNOWN',
      security: 'UNKNOWN',
      monitoring: 'UNKNOWN',
      documentation: 'UNKNOWN',
      overall: 'UNKNOWN'
    };
    
    // Infrastructure readiness
    if (this.handoverData.infrastructure?.nodejs.compatible && this.handoverData.infrastructure?.docker.installed) {
      readiness.infrastructure = 'READY';
    } else {
      readiness.infrastructure = 'NOT_READY';
    }
    
    // Testing readiness
    const testStatus = this.handoverData.validationResults?.summary.overallStatus;
    if (testStatus === 'PASSED') {
      readiness.testing = 'READY';
    } else if (testStatus === 'CRITICAL_FAILURE') {
      readiness.testing = 'CRITICAL';
    } else {
      readiness.testing = 'NOT_READY';
    }
    
    // Security readiness
    if (this.handoverData.operationalReadiness?.security.ssl && 
        this.handoverData.operationalReadiness?.security.authentication) {
      readiness.security = 'READY';
    } else {
      readiness.security = 'NOT_READY';
    }
    
    // Monitoring readiness
    if (this.handoverData.monitoring?.prometheus.configured && 
        this.handoverData.monitoring?.grafana.configured) {
      readiness.monitoring = 'READY';
    } else {
      readiness.monitoring = 'PARTIAL';
    }
    
    // Documentation readiness
    if (this.handoverData.documentation?.operational.runbooks && 
        this.handoverData.documentation?.deployment.guides.length > 0) {
      readiness.documentation = 'READY';
    } else {
      readiness.documentation = 'PARTIAL';
    }
    
    // Overall readiness
    const criticalAreas = [readiness.infrastructure, readiness.testing, readiness.security];
    if (criticalAreas.includes('CRITICAL') || criticalAreas.includes('NOT_READY')) {
      readiness.overall = 'NOT_READY';
    } else if (readiness.monitoring === 'READY' && readiness.documentation === 'READY') {
      readiness.overall = 'READY';
    } else {
      readiness.overall = 'CONDITIONAL';
    }
    
    return readiness;
  }

  generateRiskAssessment() {
    const risks = [];
    
    // Critical safety risk
    if (this.handoverData.validationResults?.summary.critical > 0) {
      risks.push({
        category: 'Safety',
        level: 'CRITICAL',
        description: 'Paper trading safety violations detected',
        impact: 'Risk of real money trading in production',
        probability: 'HIGH',
        mitigation: 'Fix all safety violations before deployment'
      });
    }
    
    // Infrastructure risk
    if (!this.handoverData.infrastructure?.nodejs.compatible) {
      risks.push({
        category: 'Infrastructure',
        level: 'HIGH',
        description: 'Node.js version incompatibility',
        impact: 'Application startup failure',
        probability: 'HIGH',
        mitigation: 'Upgrade Node.js to compatible version'
      });
    }
    
    // Monitoring risk
    if (!this.handoverData.monitoring?.prometheus.configured) {
      risks.push({
        category: 'Operations',
        level: 'MEDIUM',
        description: 'Limited monitoring capability',
        impact: 'Delayed incident detection and response',
        probability: 'MEDIUM',
        mitigation: 'Configure comprehensive monitoring'
      });
    }
    
    return risks;
  }

  async generateMarkdownReport() {
    const report = this.generateHandoverReport();
    
    const markdown = `# Production Deployment Handover Report

**Project:** ${report.metadata.projectName}  
**Version:** ${report.metadata.version}  
**Generated:** ${report.metadata.generatedAt}  
**Generated By:** ${report.metadata.generatedBy}  

## Executive Summary

**Deployment Status:** ${report.executiveSummary.status}  
**Status Description:** ${report.executiveSummary.statusDescription}  
**Recommendation:** ${report.executiveSummary.recommendation}  

### Test Results Summary
- **Total Tests:** ${report.executiveSummary.testResults.total}
- **Passed:** ${report.executiveSummary.testResults.passed}
- **Success Rate:** ${report.executiveSummary.testResults.successRate}%
- **Critical Issues:** ${report.executiveSummary.criticalIssues}
- **High Priority Issues:** ${report.executiveSummary.highIssues}

## Deployment Readiness Assessment

| Component | Status | Notes |
|-----------|--------|-------|
| Infrastructure | ${report.deploymentReadiness.infrastructure} | Node.js and Docker requirements |
| Testing | ${report.deploymentReadiness.testing} | Validation suite results |
| Security | ${report.deploymentReadiness.security} | SSL and authentication |
| Monitoring | ${report.deploymentReadiness.monitoring} | Prometheus and Grafana |
| Documentation | ${report.deploymentReadiness.documentation} | Runbooks and procedures |
| **Overall** | **${report.deploymentReadiness.overall}** | **Combined assessment** |

## Critical Issues and Recommendations

${report.recommendations.map(rec => `
### ${rec.priority}: ${rec.issue}
- **Category:** ${rec.category}
- **Action Required:** ${rec.action}
- **Impact:** ${rec.impact}
`).join('\n')}

## Infrastructure Status

### Node.js Environment
- **Installed:** ${report.infrastructure?.nodejs.installed ? 'Yes' : 'No'}
- **Version:** ${report.infrastructure?.nodejs.version || 'Unknown'}
- **Compatible:** ${report.infrastructure?.nodejs.compatible ? 'Yes' : 'No'}

### Docker Environment
- **Installed:** ${report.infrastructure?.docker.installed ? 'Yes' : 'No'}
- **Version:** ${report.infrastructure?.docker.version || 'Unknown'}
- **Compose Version:** ${report.infrastructure?.docker.composeVersion || 'Unknown'}

### Configured Services
${report.infrastructure?.services.configured.map(service => `- ${service}`).join('\n') || 'None configured'}

## Monitoring and Alerting

### Prometheus
- **Configured:** ${report.monitoring?.prometheus.configured ? 'Yes' : 'No'}
- **Config File:** ${report.monitoring?.prometheus.configFile || 'Not found'}

### Grafana Dashboards
- **Configured:** ${report.monitoring?.grafana.configured ? 'Yes' : 'No'}
- **Dashboard Count:** ${report.monitoring?.grafana.dashboards.length || 0}
- **Dashboards:** ${report.monitoring?.grafana.dashboards.join(', ') || 'None'}

### Alert Rules
- **Configured:** ${report.monitoring?.alerts.configured ? 'Yes' : 'No'}
- **Rule Files:** ${report.monitoring?.alerts.ruleFiles.join(', ') || 'None'}

### Health Checks
- **Implemented:** ${report.monitoring?.healthChecks.implemented ? 'Yes' : 'No'}
- **Endpoints:** ${report.monitoring?.healthChecks.endpoints.join(', ') || 'None'}

## Documentation Status

### Deployment Documentation
- **Guides:** ${report.documentation?.deployment.guides.length || 0} files
- **Runbooks:** ${report.documentation?.deployment.runbooks.length || 0} files
- **Procedures:** ${report.documentation?.deployment.procedures.length || 0} files

### Operational Documentation
- **Runbooks:** ${report.documentation?.operational.runbooks ? 'Available' : 'Missing'}
- **Procedures:** ${report.documentation?.operational.procedures ? 'Available' : 'Missing'}
- **Troubleshooting:** ${report.documentation?.operational.troubleshooting ? 'Available' : 'Missing'}

## Risk Assessment

${report.riskAssessment.map(risk => `
### ${risk.level} Risk: ${risk.description}
- **Category:** ${risk.category}
- **Impact:** ${risk.impact}
- **Probability:** ${risk.probability}
- **Mitigation:** ${risk.mitigation}
`).join('\n')}

## Next Steps

${report.nextSteps.map(step => `
### ${step.phase}: ${step.title}
**Description:** ${step.description}  
**Estimated Time:** ${step.estimatedTime}  

**Tasks:**
${step.tasks.map(task => `- ${task}`).join('\n')}
`).join('\n')}

## Operational Handover

### Key Contacts
- **Development Team:** [To be filled]
- **DevOps Team:** [To be filled]
- **Operations Team:** [To be filled]
- **On-Call Engineer:** [To be filled]

### Important URLs
- **Application:** https://localhost (after deployment)
- **Grafana Dashboards:** https://localhost:3001
- **Prometheus Metrics:** https://localhost:9090
- **Health Checks:** https://localhost/api/health

### Critical Files and Locations
- **Environment Config:** \`.env.production\`
- **Docker Compose:** \`docker/docker-compose.prod.yml\`
- **Deployment Script:** \`scripts/deploy-production.sh\`
- **Backup Scripts:** \`scripts/backup-automation.sh\`
- **Runbooks:** \`docs/deployment/production-operational-runbooks.md\`

### Daily Operations Checklist
1. Verify system health via health endpoints
2. Check paper trading safety status
3. Review Grafana dashboards for anomalies
4. Validate backup completion
5. Monitor alert notifications

### Emergency Procedures
- **Emergency Stop:** \`curl -X POST https://localhost/api/emergency/stop-all-trading\`
- **Service Restart:** \`docker-compose -f docker/docker-compose.prod.yml restart\`
- **Rollback:** Follow procedures in \`docs/deployment/ROLLBACK_PROCEDURES.md\`

---

**Report Generated:** ${this.timestamp}  
**Next Review:** ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}  
**Document Version:** 1.0  
`;

    return markdown;
  }

  async run() {
    this.log('info', '📋 Generating Production Deployment Handover Report...');
    
    try {
      await this.collectValidationResults();
      await this.assessInfrastructureReadiness();
      await this.assessMonitoringSetup();
      await this.assessDocumentation();
      await this.assessOperationalReadiness();
      
      this.generateRecommendations();
      this.generateNextSteps();
      
      // Generate reports
      const jsonReport = this.generateHandoverReport();
      const markdownReport = await this.generateMarkdownReport();
      
      // Save reports
      const jsonPath = path.join(this.reportsDir, 'production-deployment-handover-report.json');
      const markdownPath = path.join(this.reportsDir, 'production-deployment-handover-report.md');
      
      fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
      fs.writeFileSync(markdownPath, markdownReport);
      
      this.log('success', 'Handover reports generated successfully');
      console.log(`\n📄 JSON Report: ${jsonPath}`);
      console.log(`📄 Markdown Report: ${markdownPath}`);
      
      // Print summary
      console.log('\n' + '='.repeat(80));
      console.log('📋 PRODUCTION DEPLOYMENT HANDOVER SUMMARY');
      console.log('='.repeat(80));
      console.log(`🎯 Status: ${jsonReport.executiveSummary.status}`);
      console.log(`📊 Test Success Rate: ${jsonReport.executiveSummary.testResults.successRate}%`);
      console.log(`🚨 Critical Issues: ${jsonReport.executiveSummary.criticalIssues}`);
      console.log(`⚠️  High Priority Issues: ${jsonReport.executiveSummary.highIssues}`);
      console.log(`💡 Recommendation: ${jsonReport.executiveSummary.recommendation}`);
      console.log('='.repeat(80));
      
      // Exit with appropriate code
      if (jsonReport.executiveSummary.criticalIssues > 0) {
        process.exit(2); // Critical issues
      } else if (jsonReport.executiveSummary.highIssues > 0) {
        process.exit(1); // High priority issues
      } else {
        process.exit(0); // Ready for deployment
      }
      
    } catch (error) {
      this.log('error', `Handover report generation failed: ${error.message}`);
      process.exit(1);
    }
  }
}

// CLI usage
if (require.main === module) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Production Deployment Handover Report Generator

Usage: node generate-deployment-handover-report.js

This script generates comprehensive handover documentation including:
- Validation results summary
- Infrastructure readiness assessment
- Monitoring and alerting status
- Documentation completeness
- Risk assessment and recommendations
- Next steps and operational procedures

Output:
- JSON report: deployment-reports/production-deployment-handover-report.json
- Markdown report: deployment-reports/production-deployment-handover-report.md

Exit Codes:
- 0: Ready for deployment
- 1: High priority issues (conditional deployment)
- 2: Critical issues (deployment blocked)
    `);
    process.exit(0);
  }
  
  const generator = new DeploymentHandoverReportGenerator();
  generator.run().catch(error => {
    console.error('Handover report generation failed:', error);
    process.exit(1);
  });
}

module.exports = DeploymentHandoverReportGenerator;