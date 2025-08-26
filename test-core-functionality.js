#!/usr/bin/env node

/**
 * Core Functionality Test Runner
 * Tests critical paper trading safety mechanisms without Jest
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

const fs = require('fs');
const path = require('path');

class CoreFunctionalityTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  log(level, message, details = null) {
    const timestamp = new Date().toISOString();
    const levelEmoji = {
      info: '📋',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    };
    
    console.log(`${levelEmoji[level] || '📋'} [${timestamp}] ${message}`);
    if (details) {
      console.log(`   ${JSON.stringify(details, null, 2)}`);
    }
    
    this.results.tests.push({
      timestamp,
      level,
      message,
      details
    });
    
    if (level === 'success') this.results.passed++;
    else if (level === 'error') this.results.failed++;
  }

  async testEnvironmentConfiguration() {
    this.log('info', 'Testing environment configuration...');
    
    try {
      // Test production environment file exists
      if (fs.existsSync('.env.production')) {
        const envContent = fs.readFileSync('.env.production', 'utf8');
        
        // Critical safety checks
        const checks = [
          { key: 'PAPER_TRADING_MODE', value: 'true', found: envContent.includes('PAPER_TRADING_MODE=true') },
          { key: 'ALLOW_REAL_TRADES', value: 'false', found: envContent.includes('ALLOW_REAL_TRADES=false') },
          { key: 'NODE_ENV', value: 'production', found: envContent.includes('NODE_ENV=production') }
        ];
        
        let allPassed = true;
        for (const check of checks) {
          if (check.found) {
            this.log('success', `Environment check passed: ${check.key}=${check.value}`);
          } else {
            this.log('error', `Environment check FAILED: ${check.key} should be ${check.value}`);
            allPassed = false;
          }
        }
        
        if (allPassed) {
          this.log('success', 'All critical environment variables are properly configured');
        }
        
      } else {
        this.log('error', 'Production environment file not found');
      }
      
    } catch (error) {
      this.log('error', 'Environment configuration test failed', error.message);
    }
  }

  async testCodeStructure() {
    this.log('info', 'Testing code structure and safety mechanisms...');
    
    try {
      // Check critical files exist
      const criticalFiles = [
        'src/middleware/paperTradingGuard.ts',
        'src/services/TradeSimulationEngine.ts',
        'src/services/VirtualPortfolioManager.ts',
        'src/utils/ApiPermissionValidator.ts',
        'src/config/production.ts'
      ];
      
      let allFilesExist = true;
      for (const file of criticalFiles) {
        if (fs.existsSync(file)) {
          this.log('success', `Critical file found: ${file}`);
        } else {
          this.log('error', `Critical file missing: ${file}`);
          allFilesExist = false;
        }
      }
      
      if (allFilesExist) {
        this.log('success', 'All critical code files are present');
      }
      
      // Check paper trading guard content
      if (fs.existsSync('src/middleware/paperTradingGuard.ts')) {
        const guardContent = fs.readFileSync('src/middleware/paperTradingGuard.ts', 'utf8');
        
        const safetyPatterns = [
          { pattern: /allowRealTrades.*false/i, description: 'Real trades blocking' },
          { pattern: /isPaperTrade.*true/i, description: 'Paper trade marking' },
          { pattern: /PAPER_TRADING_MODE/i, description: 'Paper trading mode check' }
        ];
        
        for (const safety of safetyPatterns) {
          if (safety.pattern.test(guardContent)) {
            this.log('success', `Safety mechanism found: ${safety.description}`);
          } else {
            this.log('warning', `Safety mechanism may be missing: ${safety.description}`);
          }
        }
      }
      
    } catch (error) {
      this.log('error', 'Code structure test failed', error.message);
    }
  }

  async testDatabaseSchema() {
    this.log('info', 'Testing database schema for paper trading safety...');
    
    try {
      if (fs.existsSync('prisma/schema.prisma')) {
        const schemaContent = fs.readFileSync('prisma/schema.prisma', 'utf8');
        
        // Check for paper trading related fields
        const safetyFields = [
          'isPaperTrade',
          'virtualBalance',
          'simulatedTrade'
        ];
        
        let foundFields = 0;
        for (const field of safetyFields) {
          if (schemaContent.includes(field)) {
            this.log('success', `Database safety field found: ${field}`);
            foundFields++;
          } else {
            this.log('warning', `Database safety field missing: ${field}`);
          }
        }
        
        if (foundFields > 0) {
          this.log('success', `Found ${foundFields} paper trading safety fields in database schema`);
        } else {
          this.log('error', 'No paper trading safety fields found in database schema');
        }
        
      } else {
        this.log('error', 'Prisma schema file not found');
      }
      
    } catch (error) {
      this.log('error', 'Database schema test failed', error.message);
    }
  }

  async testFrontendSafety() {
    this.log('info', 'Testing frontend safety indicators...');
    
    try {
      // Check paper trading indicator component
      if (fs.existsSync('src/frontend/components/common/PaperTradingIndicator.tsx')) {
        const indicatorContent = fs.readFileSync('src/frontend/components/common/PaperTradingIndicator.tsx', 'utf8');
        
        const safetyElements = [
          'PAPER TRADING MODE',
          'NO REAL MONEY',
          'SIMULATION'
        ];
        
        let foundElements = 0;
        for (const element of safetyElements) {
          if (indicatorContent.includes(element)) {
            this.log('success', `Frontend safety element found: ${element}`);
            foundElements++;
          } else {
            this.log('warning', `Frontend safety element missing: ${element}`);
          }
        }
        
        if (foundElements > 0) {
          this.log('success', `Found ${foundElements} frontend safety indicators`);
        }
        
      } else {
        this.log('error', 'Paper trading indicator component not found');
      }
      
      // Check trading page
      if (fs.existsSync('src/frontend/pages/TradingPage.tsx')) {
        const tradingContent = fs.readFileSync('src/frontend/pages/TradingPage.tsx', 'utf8');
        
        if (tradingContent.includes('PaperTradingIndicator')) {
          this.log('success', 'Trading page includes paper trading indicator');
        } else {
          this.log('warning', 'Trading page may not include paper trading indicator');
        }
      }
      
    } catch (error) {
      this.log('error', 'Frontend safety test failed', error.message);
    }
  }

  async testConfigurationFiles() {
    this.log('info', 'Testing configuration files...');
    
    try {
      // Check TypeScript configuration
      if (fs.existsSync('tsconfig.json')) {
        this.log('success', 'TypeScript configuration found');
      } else {
        this.log('error', 'TypeScript configuration missing');
      }
      
      // Check package.json
      if (fs.existsSync('package.json')) {
        const packageContent = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        
        // Check for required dependencies
        const requiredDeps = [
          'express',
          'ws',
          'redis',
          'winston',
          'helmet',
          'cors'
        ];
        
        let foundDeps = 0;
        for (const dep of requiredDeps) {
          if (packageContent.dependencies && packageContent.dependencies[dep]) {
            this.log('success', `Required dependency found: ${dep}`);
            foundDeps++;
          } else {
            this.log('warning', `Required dependency missing: ${dep}`);
          }
        }
        
        if (foundDeps === requiredDeps.length) {
          this.log('success', 'All required dependencies are present');
        }
        
        // Check for test scripts
        if (packageContent.scripts && packageContent.scripts.test) {
          this.log('success', 'Test script configuration found');
        } else {
          this.log('warning', 'Test script configuration missing');
        }
        
      } else {
        this.log('error', 'Package.json not found');
      }
      
    } catch (error) {
      this.log('error', 'Configuration files test failed', error.message);
    }
  }

  async testSecurityConfiguration() {
    this.log('info', 'Testing security configuration...');
    
    try {
      // Check security middleware
      if (fs.existsSync('src/middleware/security.ts')) {
        this.log('success', 'Security middleware found');
      } else {
        this.log('warning', 'Security middleware not found');
      }
      
      // Check production security
      if (fs.existsSync('src/middleware/productionSecurityHardening.ts')) {
        this.log('success', 'Production security hardening found');
      } else {
        this.log('warning', 'Production security hardening not found');
      }
      
      // Check SSL configuration
      const sslFiles = [
        'docker/nginx/production.conf',
        'docker/nginx/security.conf',
        'docker/scripts/ssl-setup.sh'
      ];
      
      let foundSslFiles = 0;
      for (const file of sslFiles) {
        if (fs.existsSync(file)) {
          this.log('success', `SSL configuration found: ${file}`);
          foundSslFiles++;
        } else {
          this.log('warning', `SSL configuration missing: ${file}`);
        }
      }
      
      if (foundSslFiles > 0) {
        this.log('success', `Found ${foundSslFiles} SSL configuration files`);
      }
      
    } catch (error) {
      this.log('error', 'Security configuration test failed', error.message);
    }
  }

  async testMonitoringSetup() {
    this.log('info', 'Testing monitoring setup...');
    
    try {
      // Check monitoring files
      const monitoringFiles = [
        'monitoring/prometheus.yml',
        'monitoring/docker-compose.monitoring.yml'
      ];
      
      let foundMonitoringFiles = 0;
      for (const file of monitoringFiles) {
        if (fs.existsSync(file)) {
          this.log('success', `Monitoring file found: ${file}`);
          foundMonitoringFiles++;
        } else {
          this.log('warning', `Monitoring file missing: ${file}`);
        }
      }
      
      // Check Grafana dashboards
      if (fs.existsSync('monitoring/grafana/dashboards')) {
        const dashboards = fs.readdirSync('monitoring/grafana/dashboards');
        const jsonDashboards = dashboards.filter(f => f.endsWith('.json'));
        
        if (jsonDashboards.length > 0) {
          this.log('success', `Found ${jsonDashboards.length} Grafana dashboards`);
        } else {
          this.log('warning', 'No Grafana dashboards found');
        }
      }
      
      if (foundMonitoringFiles > 0) {
        this.log('success', 'Monitoring setup is configured');
      }
      
    } catch (error) {
      this.log('error', 'Monitoring setup test failed', error.message);
    }
  }

  async run() {
    console.log('🧪 Starting Core Functionality Tests...\n');
    
    await this.testEnvironmentConfiguration();
    await this.testCodeStructure();
    await this.testDatabaseSchema();
    await this.testFrontendSafety();
    await this.testConfigurationFiles();
    await this.testSecurityConfiguration();
    await this.testMonitoringSetup();
    
    // Generate summary
    console.log('\n📊 Core Functionality Test Results:');
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    
    const totalTests = this.results.passed + this.results.failed;
    const successRate = totalTests > 0 ? ((this.results.passed / totalTests) * 100).toFixed(1) : 0;
    console.log(`📈 Success Rate: ${successRate}%`);
    
    // Show failures
    const failures = this.results.tests.filter(t => t.level === 'error');
    if (failures.length > 0) {
      console.log('\n❌ Failures:');
      failures.forEach(failure => {
        console.log(`  - ${failure.message}`);
      });
    }
    
    // Show warnings
    const warnings = this.results.tests.filter(t => t.level === 'warning');
    if (warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      warnings.forEach(warning => {
        console.log(`  - ${warning.message}`);
      });
    }
    
    // Write report
    const reportPath = 'core-functionality-test-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    // Assessment
    if (this.results.failed === 0) {
      console.log('\n🎉 All core functionality tests passed!');
      console.log('✅ System appears ready for comprehensive testing');
      return true;
    } else {
      console.log('\n⚠️  Some core functionality tests failed');
      console.log('🔧 Review and fix issues before proceeding');
      return false;
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new CoreFunctionalityTester();
  tester.run().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Core functionality tests failed:', error);
    process.exit(1);
  });
}

module.exports = CoreFunctionalityTester;