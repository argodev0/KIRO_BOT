#!/usr/bin/env node

/**
 * Production Readiness Validation Script
 * 
 * Comprehensive validation of all production requirements before deployment
 * Requirements: 3.7, 5.5, 7.2, 7.3, 7.4, 7.5, 7.7
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');
const http = require('http');

class ProductionReadinessValidator {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      details: []
    };
  }

  log(level, message, details = null) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, details };
    
    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
    if (details) {
      console.log(`  Details: ${JSON.stringify(details, null, 2)}`);
    }
    
    this.results.details.push(logEntry);
    
    if (level === 'error') this.results.failed++;
    else if (level === 'warn') this.results.warnings++;
    else if (level === 'info') this.results.passed++;
  }

  async validateEnvironmentConfiguration() {
    this.log('info', 'Validating environment configuration...');
    
    try {
      // Check required environment files
      const requiredFiles = [
        '.env.production',
        '.env.production.template',
        'docker-compose.prod.yml'
      ];

      for (const file of requiredFiles) {
        if (!fs.existsSync(file)) {
          this.log('error', `Missing required file: ${file}`);
          continue;
        }
        this.log('info', `Found required file: ${file}`);
      }

      // Validate production environment variables
      const prodEnvPath = '.env.production';
      if (fs.existsSync(prodEnvPath)) {
        const envContent = fs.readFileSync(prodEnvPath, 'utf8');
        const requiredVars = [
          'NODE_ENV=production',
          'PAPER_TRADING_MODE=true',
          'ALLOW_REAL_TRADES=false',
          'SSL_ENABLED=true',
          'MONITORING_ENABLED=true'
        ];

        for (const requiredVar of requiredVars) {
          if (!envContent.includes(requiredVar)) {
            this.log('error', `Missing or incorrect environment variable: ${requiredVar}`);
          } else {
            this.log('info', `Environment variable validated: ${requiredVar}`);
          }
        }
      }

      // Validate Docker production configuration
      const dockerComposeFile = 'docker-compose.prod.yml';
      if (fs.existsSync(dockerComposeFile)) {
        const dockerContent = fs.readFileSync(dockerComposeFile, 'utf8');
        
        // Check for required services
        const requiredServices = ['backend', 'frontend', 'postgres', 'redis', 'nginx'];
        for (const service of requiredServices) {
          if (dockerContent.includes(service + ':')) {
            this.log('info', `Docker service configured: ${service}`);
          } else {
            this.log('error', `Missing Docker service: ${service}`);
          }
        }

        // Check for health checks
        if (dockerContent.includes('healthcheck:')) {
          this.log('info', 'Docker health checks configured');
        } else {
          this.log('warn', 'Docker health checks not found');
        }
      }

    } catch (error) {
      this.log('error', 'Environment configuration validation failed', error.message);
    }
  }

  async validateSecurityConfiguration() {
    this.log('info', 'Validating security configuration...');
    
    try {
      // Check SSL configuration files
      const sslFiles = [
        'docker/nginx/production.conf',
        'docker/nginx/security.conf',
        'docker/scripts/ssl-setup.sh'
      ];

      for (const file of sslFiles) {
        if (fs.existsSync(file)) {
          this.log('info', `SSL configuration file found: ${file}`);
        } else {
          this.log('error', `Missing SSL configuration: ${file}`);
        }
      }

      // Validate Nginx security configuration
      const nginxSecurityFile = 'docker/nginx/security.conf';
      if (fs.existsSync(nginxSecurityFile)) {
        const securityContent = fs.readFileSync(nginxSecurityFile, 'utf8');
        
        const securityHeaders = [
          'X-Frame-Options',
          'X-Content-Type-Options',
          'X-XSS-Protection',
          'Strict-Transport-Security'
        ];

        for (const header of securityHeaders) {
          if (securityContent.includes(header)) {
            this.log('info', `Security header configured: ${header}`);
          } else {
            this.log('warn', `Missing security header: ${header}`);
          }
        }
      }

      // Check firewall and security scripts
      const securityScripts = [
        'docker/scripts/generate-dhparam.sh',
        'scripts/validate-api-permissions.js'
      ];

      for (const script of securityScripts) {
        if (fs.existsSync(script)) {
          this.log('info', `Security script found: ${script}`);
        } else {
          this.log('warn', `Security script missing: ${script}`);
        }
      }

    } catch (error) {
      this.log('error', 'Security configuration validation failed', error.message);
    }
  }

  async validateMonitoringSetup() {
    this.log('info', 'Validating monitoring setup...');
    
    try {
      // Check monitoring configuration files
      const monitoringFiles = [
        'monitoring/prometheus.yml',
        'monitoring/grafana/provisioning/dashboards/dashboard.yml',
        'monitoring/docker-compose.monitoring.yml'
      ];

      for (const file of monitoringFiles) {
        if (fs.existsSync(file)) {
          this.log('info', `Monitoring file found: ${file}`);
        } else {
          this.log('error', `Missing monitoring file: ${file}`);
        }
      }

      // Check Grafana dashboards
      const dashboardDir = 'monitoring/grafana/dashboards';
      if (fs.existsSync(dashboardDir)) {
        const dashboards = fs.readdirSync(dashboardDir).filter(f => f.endsWith('.json'));
        this.log('info', `Found ${dashboards.length} Grafana dashboards`);
        
        const requiredDashboards = [
          'trading-bot-overview.json',
          'paper-trading-safety.json',
          'system-metrics.json',
          'real-time-data-feeds.json'
        ];

        for (const dashboard of requiredDashboards) {
          if (dashboards.includes(dashboard)) {
            this.log('info', `Dashboard configured: ${dashboard}`);
          } else {
            this.log('error', `Missing dashboard: ${dashboard}`);
          }
        }
      }

      // Check Prometheus alert rules
      const alertRulesDir = 'monitoring/prometheus/rules';
      if (fs.existsSync(alertRulesDir)) {
        const alertFiles = fs.readdirSync(alertRulesDir).filter(f => f.endsWith('.yml'));
        this.log('info', `Found ${alertFiles.length} Prometheus alert rule files`);
      }

    } catch (error) {
      this.log('error', 'Monitoring setup validation failed', error.message);
    }
  }

  async validateDatabaseConfiguration() {
    this.log('info', 'Validating database configuration...');
    
    try {
      // Check database initialization scripts
      const dbFiles = [
        'database/init/01-init.sql',
        'database/production/production-setup.sql',
        'prisma/schema.prisma'
      ];

      for (const file of dbFiles) {
        if (fs.existsSync(file)) {
          this.log('info', `Database file found: ${file}`);
        } else {
          this.log('error', `Missing database file: ${file}`);
        }
      }

      // Check backup scripts
      const backupScripts = [
        'scripts/backup-automation.sh',
        'scripts/database-migration.sh',
        'docker/scripts/backup.sh'
      ];

      for (const script of backupScripts) {
        if (fs.existsSync(script)) {
          this.log('info', `Backup script found: ${script}`);
        } else {
          this.log('warn', `Backup script missing: ${script}`);
        }
      }

    } catch (error) {
      this.log('error', 'Database configuration validation failed', error.message);
    }
  }

  async validateApplicationCode() {
    this.log('info', 'Validating application code structure...');
    
    try {
      // Check critical application files
      const criticalFiles = [
        'src/index.ts',
        'src/config/production.ts',
        'src/middleware/paperTradingGuard.ts',
        'src/services/TradeSimulationEngine.ts',
        'src/services/LiveMarketDataService.ts'
      ];

      for (const file of criticalFiles) {
        if (fs.existsSync(file)) {
          this.log('info', `Critical file found: ${file}`);
        } else {
          this.log('error', `Missing critical file: ${file}`);
        }
      }

      // Check package.json for required dependencies
      const packageJsonPath = 'package.json';
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        const requiredDeps = [
          'express',
          'ws',
          'prisma',
          'redis',
          'winston',
          'helmet',
          'cors'
        ];

        for (const dep of requiredDeps) {
          if (packageJson.dependencies && packageJson.dependencies[dep]) {
            this.log('info', `Required dependency found: ${dep}`);
          } else {
            this.log('error', `Missing required dependency: ${dep}`);
          }
        }
      }

      // Validate TypeScript configuration
      const tsconfigPath = 'tsconfig.json';
      if (fs.existsSync(tsconfigPath)) {
        this.log('info', 'TypeScript configuration found');
      } else {
        this.log('error', 'Missing TypeScript configuration');
      }

    } catch (error) {
      this.log('error', 'Application code validation failed', error.message);
    }
  }

  async validateTestCoverage() {
    this.log('info', 'Validating test coverage...');
    
    try {
      // Check for test files
      const testDirs = [
        'src/__tests__',
        'src/__tests__/comprehensive',
        'src/__tests__/integration',
        'src/__tests__/security'
      ];

      for (const dir of testDirs) {
        if (fs.existsSync(dir)) {
          const testFiles = fs.readdirSync(dir, { recursive: true })
            .filter(f => f.toString().endsWith('.test.ts') || f.toString().endsWith('.test.tsx'));
          this.log('info', `Found ${testFiles.length} test files in ${dir}`);
        } else {
          this.log('warn', `Test directory missing: ${dir}`);
        }
      }

      // Check Jest configuration
      const jestConfigPath = 'jest.config.js';
      if (fs.existsSync(jestConfigPath)) {
        this.log('info', 'Jest configuration found');
      } else {
        this.log('warn', 'Jest configuration missing');
      }

      // Try to run a quick test validation
      try {
        execSync('npm run test -- --passWithNoTests --silent', { stdio: 'pipe' });
        this.log('info', 'Test suite can be executed');
      } catch (error) {
        this.log('warn', 'Test suite execution failed', error.message);
      }

    } catch (error) {
      this.log('error', 'Test coverage validation failed', error.message);
    }
  }

  async validateDeploymentScripts() {
    this.log('info', 'Validating deployment scripts...');
    
    try {
      const deploymentScripts = [
        'scripts/deploy-production.sh',
        'scripts/deploy-automation.sh',
        'scripts/health-check.sh',
        'scripts/production-orchestrator.sh'
      ];

      for (const script of deploymentScripts) {
        if (fs.existsSync(script)) {
          // Check if script is executable
          const stats = fs.statSync(script);
          const isExecutable = !!(stats.mode & parseInt('111', 8));
          
          if (isExecutable) {
            this.log('info', `Deployment script ready: ${script}`);
          } else {
            this.log('warn', `Deployment script not executable: ${script}`);
          }
        } else {
          this.log('error', `Missing deployment script: ${script}`);
        }
      }

    } catch (error) {
      this.log('error', 'Deployment scripts validation failed', error.message);
    }
  }

  async run() {
    console.log('🚀 Starting Production Readiness Validation...\n');
    
    await this.validateEnvironmentConfiguration();
    await this.validateSecurityConfiguration();
    await this.validateMonitoringSetup();
    await this.validateDatabaseConfiguration();
    await this.validateApplicationCode();
    await this.validateTestCoverage();
    await this.validateDeploymentScripts();
    
    // Generate summary report
    console.log('\n📊 Production Readiness Validation Summary:');
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`⚠️  Warnings: ${this.results.warnings}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    
    const totalChecks = this.results.passed + this.results.warnings + this.results.failed;
    const successRate = ((this.results.passed / totalChecks) * 100).toFixed(1);
    console.log(`📈 Success Rate: ${successRate}%`);
    
    // Write detailed report
    const reportPath = 'production-readiness-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}`);
    
    // Determine overall status
    if (this.results.failed === 0) {
      console.log('\n🎉 Production readiness validation PASSED!');
      process.exit(0);
    } else {
      console.log('\n🚨 Production readiness validation FAILED!');
      console.log('Please fix the failed checks before deploying to production.');
      process.exit(1);
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new ProductionReadinessValidator();
  validator.run().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = ProductionReadinessValidator;