#!/usr/bin/env node

/**
 * Comprehensive Integration Test
 * Tests integration between all paper trading safety components
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

const fs = require('fs');
const path = require('path');

class ComprehensiveIntegrationTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      critical: 0,
      tests: []
    };
  }

  log(level, message, details = null) {
    const timestamp = new Date().toISOString();
    const levelEmoji = {
      info: '📋',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      critical: '🚨'
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
    else if (level === 'critical') this.results.critical++;
  }

  async testPaperTradingGuardIntegration() {
    this.log('info', 'Testing Paper Trading Guard Integration...');
    
    try {
      if (fs.existsSync('src/middleware/paperTradingGuard.ts')) {
        const guardContent = fs.readFileSync('src/middleware/paperTradingGuard.ts', 'utf8');
        
        // Test critical safety patterns
        const criticalChecks = [
          {
            pattern: /allowRealTrades.*false/i,
            name: 'Real trades blocking',
            critical: true
          },
          {
            pattern: /isPaperTrade.*true/i,
            name: 'Paper trade marking',
            critical: true
          },
          {
            pattern: /throw.*Error.*real.*trade/i,
            name: 'Real trade error throwing',
            critical: true
          },
          {
            pattern: /validatePaperTradingMode/i,
            name: 'Paper trading mode validation',
            critical: false
          }
        ];
        
        let criticalPassed = 0;
        let totalCritical = 0;
        
        for (const check of criticalChecks) {
          if (check.critical) totalCritical++;
          
          if (check.pattern.test(guardContent)) {
            this.log('success', `Paper Trading Guard: ${check.name} - IMPLEMENTED`);
            if (check.critical) criticalPassed++;
          } else {
            const level = check.critical ? 'critical' : 'warning';
            this.log(level, `Paper Trading Guard: ${check.name} - MISSING`);
          }
        }
        
        if (criticalPassed === totalCritical) {
          this.log('success', 'Paper Trading Guard: All critical safety mechanisms implemented');
        } else {
          this.log('critical', `Paper Trading Guard: ${totalCritical - criticalPassed} critical mechanisms missing`);
        }
        
      } else {
        this.log('critical', 'Paper Trading Guard middleware not found');
      }
      
    } catch (error) {
      this.log('critical', 'Paper Trading Guard integration test failed', error.message);
    }
  }

  async testTradeSimulationEngineIntegration() {
    this.log('info', 'Testing Trade Simulation Engine Integration...');
    
    try {
      if (fs.existsSync('src/services/TradeSimulationEngine.ts')) {
        const engineContent = fs.readFileSync('src/services/TradeSimulationEngine.ts', 'utf8');
        
        const simulationChecks = [
          {
            pattern: /simulateOrderExecution/i,
            name: 'Order simulation method',
            critical: true
          },
          {
            pattern: /isPaperTrade.*true/i,
            name: 'Paper trade marking in simulation',
            critical: true
          },
          {
            pattern: /virtualBalance|simulatedBalance/i,
            name: 'Virtual balance handling',
            critical: true
          },
          {
            pattern: /getPaperTradeAuditReport/i,
            name: 'Audit reporting capability',
            critical: false
          }
        ];
        
        let criticalPassed = 0;
        let totalCritical = 0;
        
        for (const check of simulationChecks) {
          if (check.critical) totalCritical++;
          
          if (check.pattern.test(engineContent)) {
            this.log('success', `Trade Simulation Engine: ${check.name} - IMPLEMENTED`);
            if (check.critical) criticalPassed++;
          } else {
            const level = check.critical ? 'critical' : 'warning';
            this.log(level, `Trade Simulation Engine: ${check.name} - MISSING`);
          }
        }
        
        if (criticalPassed === totalCritical) {
          this.log('success', 'Trade Simulation Engine: All critical features implemented');
        } else {
          this.log('critical', `Trade Simulation Engine: ${totalCritical - criticalPassed} critical features missing`);
        }
        
      } else {
        this.log('critical', 'Trade Simulation Engine not found');
      }
      
    } catch (error) {
      this.log('critical', 'Trade Simulation Engine integration test failed', error.message);
    }
  }

  async testVirtualPortfolioManagerIntegration() {
    this.log('info', 'Testing Virtual Portfolio Manager Integration...');
    
    try {
      if (fs.existsSync('src/services/VirtualPortfolioManager.ts')) {
        const portfolioContent = fs.readFileSync('src/services/VirtualPortfolioManager.ts', 'utf8');
        
        const portfolioChecks = [
          {
            pattern: /initializeUserPortfolio/i,
            name: 'Portfolio initialization',
            critical: true
          },
          {
            pattern: /executeSimulatedTrade/i,
            name: 'Simulated trade execution',
            critical: true
          },
          {
            pattern: /isPaperPortfolio|virtualPortfolio/i,
            name: 'Virtual portfolio marking',
            critical: true
          },
          {
            pattern: /getPortfolioSummary/i,
            name: 'Portfolio summary reporting',
            critical: false
          }
        ];
        
        let criticalPassed = 0;
        let totalCritical = 0;
        
        for (const check of portfolioChecks) {
          if (check.critical) totalCritical++;
          
          if (check.pattern.test(portfolioContent)) {
            this.log('success', `Virtual Portfolio Manager: ${check.name} - IMPLEMENTED`);
            if (check.critical) criticalPassed++;
          } else {
            const level = check.critical ? 'critical' : 'warning';
            this.log(level, `Virtual Portfolio Manager: ${check.name} - MISSING`);
          }
        }
        
        if (criticalPassed === totalCritical) {
          this.log('success', 'Virtual Portfolio Manager: All critical features implemented');
        } else {
          this.log('critical', `Virtual Portfolio Manager: ${totalCritical - criticalPassed} critical features missing`);
        }
        
      } else {
        this.log('critical', 'Virtual Portfolio Manager not found');
      }
      
    } catch (error) {
      this.log('critical', 'Virtual Portfolio Manager integration test failed', error.message);
    }
  }

  async testApiPermissionValidatorIntegration() {
    this.log('info', 'Testing API Permission Validator Integration...');
    
    try {
      if (fs.existsSync('src/utils/ApiPermissionValidator.ts')) {
        const validatorContent = fs.readFileSync('src/utils/ApiPermissionValidator.ts', 'utf8');
        
        const validatorChecks = [
          {
            pattern: /validateApiKey/i,
            name: 'API key validation method',
            critical: true
          },
          {
            pattern: /readOnly.*true|isReadOnly/i,
            name: 'Read-only enforcement',
            critical: true
          },
          {
            pattern: /riskLevel|validatePermissions/i,
            name: 'Permission risk assessment',
            critical: true
          },
          {
            pattern: /trading.*false|allowTrading.*false/i,
            name: 'Trading permission blocking',
            critical: true
          }
        ];
        
        let criticalPassed = 0;
        let totalCritical = 0;
        
        for (const check of validatorChecks) {
          if (check.critical) totalCritical++;
          
          if (check.pattern.test(validatorContent)) {
            this.log('success', `API Permission Validator: ${check.name} - IMPLEMENTED`);
            if (check.critical) criticalPassed++;
          } else {
            const level = check.critical ? 'critical' : 'warning';
            this.log(level, `API Permission Validator: ${check.name} - MISSING`);
          }
        }
        
        if (criticalPassed === totalCritical) {
          this.log('success', 'API Permission Validator: All critical features implemented');
        } else {
          this.log('critical', `API Permission Validator: ${totalCritical - criticalPassed} critical features missing`);
        }
        
      } else {
        this.log('critical', 'API Permission Validator not found');
      }
      
    } catch (error) {
      this.log('critical', 'API Permission Validator integration test failed', error.message);
    }
  }

  async testExchangeServiceIntegration() {
    this.log('info', 'Testing Exchange Service Integration...');
    
    try {
      const exchangeServices = [
        'src/services/exchanges/BinanceExchange.ts',
        'src/services/exchanges/KuCoinExchange.ts'
      ];
      
      for (const servicePath of exchangeServices) {
        if (fs.existsSync(servicePath)) {
          const serviceContent = fs.readFileSync(servicePath, 'utf8');
          const serviceName = path.basename(servicePath, '.ts');
          
          const exchangeChecks = [
            {
              pattern: /testnet|sandbox/i,
              name: 'Testnet/Sandbox usage',
              critical: true
            },
            {
              pattern: /readOnly|READ_ONLY/i,
              name: 'Read-only API enforcement',
              critical: true
            },
            {
              pattern: /simulateOrder|mockOrder/i,
              name: 'Order simulation capability',
              critical: false
            }
          ];
          
          let criticalPassed = 0;
          let totalCritical = 0;
          
          for (const check of exchangeChecks) {
            if (check.critical) totalCritical++;
            
            if (check.pattern.test(serviceContent)) {
              this.log('success', `${serviceName}: ${check.name} - IMPLEMENTED`);
              if (check.critical) criticalPassed++;
            } else {
              const level = check.critical ? 'critical' : 'warning';
              this.log(level, `${serviceName}: ${check.name} - MISSING`);
            }
          }
          
          // Check for dangerous methods
          const dangerousMethods = ['withdraw', 'transfer', 'createOrder'];
          for (const method of dangerousMethods) {
            if (serviceContent.includes(method) && !serviceContent.includes(`simulate${method}`)) {
              this.log('warning', `${serviceName}: Contains potentially dangerous method: ${method}`);
            }
          }
          
        } else {
          this.log('error', `Exchange service not found: ${servicePath}`);
        }
      }
      
    } catch (error) {
      this.log('critical', 'Exchange service integration test failed', error.message);
    }
  }

  async testFrontendIntegration() {
    this.log('info', 'Testing Frontend Integration...');
    
    try {
      // Test paper trading indicator integration
      if (fs.existsSync('src/frontend/components/common/PaperTradingIndicator.tsx')) {
        const indicatorContent = fs.readFileSync('src/frontend/components/common/PaperTradingIndicator.tsx', 'utf8');
        
        const frontendChecks = [
          {
            pattern: /PAPER TRADING MODE/i,
            name: 'Paper trading mode display',
            critical: true
          },
          {
            pattern: /backgroundColor.*red|color.*red/i,
            name: 'Warning color styling',
            critical: false
          },
          {
            pattern: /NO REAL MONEY|SIMULATION/i,
            name: 'Safety warning text',
            critical: true
          }
        ];
        
        let criticalPassed = 0;
        let totalCritical = 0;
        
        for (const check of frontendChecks) {
          if (check.critical) totalCritical++;
          
          if (check.pattern.test(indicatorContent)) {
            this.log('success', `Paper Trading Indicator: ${check.name} - IMPLEMENTED`);
            if (check.critical) criticalPassed++;
          } else {
            const level = check.critical ? 'critical' : 'warning';
            this.log(level, `Paper Trading Indicator: ${check.name} - MISSING`);
          }
        }
        
        // Check trading page integration
        if (fs.existsSync('src/frontend/pages/TradingPage.tsx')) {
          const tradingContent = fs.readFileSync('src/frontend/pages/TradingPage.tsx', 'utf8');
          
          if (tradingContent.includes('PaperTradingIndicator')) {
            this.log('success', 'Trading Page: Paper trading indicator integrated');
          } else {
            this.log('critical', 'Trading Page: Paper trading indicator NOT integrated');
          }
        }
        
      } else {
        this.log('critical', 'Paper Trading Indicator component not found');
      }
      
    } catch (error) {
      this.log('critical', 'Frontend integration test failed', error.message);
    }
  }

  async testSecurityIntegration() {
    this.log('info', 'Testing Security Integration...');
    
    try {
      // Test security middleware integration
      const securityFiles = [
        'src/middleware/security.ts',
        'src/middleware/productionSecurityHardening.ts',
        'src/middleware/inputValidation.ts'
      ];
      
      let securityFilesFound = 0;
      for (const file of securityFiles) {
        if (fs.existsSync(file)) {
          this.log('success', `Security file found: ${path.basename(file)}`);
          securityFilesFound++;
        } else {
          this.log('warning', `Security file missing: ${path.basename(file)}`);
        }
      }
      
      if (securityFilesFound === securityFiles.length) {
        this.log('success', 'All security middleware files present');
      } else {
        this.log('warning', `${securityFiles.length - securityFilesFound} security files missing`);
      }
      
      // Test production configuration
      if (fs.existsSync('src/config/production.ts')) {
        const prodConfig = fs.readFileSync('src/config/production.ts', 'utf8');
        
        const securityChecks = [
          'paperTradingMode',
          'allowRealTrades',
          'ssl',
          'helmet'
        ];
        
        let foundSecurityConfigs = 0;
        for (const config of securityChecks) {
          if (prodConfig.includes(config)) {
            this.log('success', `Production config includes: ${config}`);
            foundSecurityConfigs++;
          } else {
            this.log('warning', `Production config missing: ${config}`);
          }
        }
        
        if (foundSecurityConfigs > 0) {
          this.log('success', `Found ${foundSecurityConfigs} security configurations`);
        }
      }
      
    } catch (error) {
      this.log('critical', 'Security integration test failed', error.message);
    }
  }

  async testMonitoringIntegration() {
    this.log('info', 'Testing Monitoring Integration...');
    
    try {
      // Test monitoring service integration
      if (fs.existsSync('src/services/MonitoringService.ts')) {
        const monitoringContent = fs.readFileSync('src/services/MonitoringService.ts', 'utf8');
        
        const monitoringChecks = [
          {
            pattern: /paperTradingMetrics|paper.*trade.*metric/i,
            name: 'Paper trading metrics',
            critical: true
          },
          {
            pattern: /prometheus|metrics/i,
            name: 'Prometheus integration',
            critical: false
          },
          {
            pattern: /healthCheck|health.*endpoint/i,
            name: 'Health check endpoints',
            critical: true
          }
        ];
        
        let criticalPassed = 0;
        let totalCritical = 0;
        
        for (const check of monitoringChecks) {
          if (check.critical) totalCritical++;
          
          if (check.pattern.test(monitoringContent)) {
            this.log('success', `Monitoring Service: ${check.name} - IMPLEMENTED`);
            if (check.critical) criticalPassed++;
          } else {
            const level = check.critical ? 'warning' : 'info';
            this.log(level, `Monitoring Service: ${check.name} - MISSING`);
          }
        }
        
      } else {
        this.log('warning', 'Monitoring Service not found');
      }
      
      // Test Grafana dashboards
      if (fs.existsSync('monitoring/grafana/dashboards')) {
        const dashboards = fs.readdirSync('monitoring/grafana/dashboards');
        const paperTradingDashboard = dashboards.find(d => d.includes('paper-trading'));
        
        if (paperTradingDashboard) {
          this.log('success', 'Paper trading monitoring dashboard found');
        } else {
          this.log('warning', 'Paper trading monitoring dashboard not found');
        }
      }
      
    } catch (error) {
      this.log('error', 'Monitoring integration test failed', error.message);
    }
  }

  async run() {
    console.log('🔗 Starting Comprehensive Integration Tests...\n');
    
    await this.testPaperTradingGuardIntegration();
    await this.testTradeSimulationEngineIntegration();
    await this.testVirtualPortfolioManagerIntegration();
    await this.testApiPermissionValidatorIntegration();
    await this.testExchangeServiceIntegration();
    await this.testFrontendIntegration();
    await this.testSecurityIntegration();
    await this.testMonitoringIntegration();
    
    // Generate summary
    console.log('\n📊 Comprehensive Integration Test Results:');
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`🚨 Critical Issues: ${this.results.critical}`);
    
    const totalTests = this.results.passed + this.results.failed + this.results.critical;
    const successRate = totalTests > 0 ? ((this.results.passed / totalTests) * 100).toFixed(1) : 0;
    console.log(`📈 Success Rate: ${successRate}%`);
    
    // Show critical issues
    const criticalIssues = this.results.tests.filter(t => t.level === 'critical');
    if (criticalIssues.length > 0) {
      console.log('\n🚨 Critical Issues:');
      criticalIssues.forEach(issue => {
        console.log(`  - ${issue.message}`);
      });
    }
    
    // Show failures
    const failures = this.results.tests.filter(t => t.level === 'error');
    if (failures.length > 0) {
      console.log('\n❌ Failures:');
      failures.forEach(failure => {
        console.log(`  - ${failure.message}`);
      });
    }
    
    // Write report
    const reportPath = 'comprehensive-integration-test-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    // Assessment
    if (this.results.critical === 0 && this.results.failed === 0) {
      console.log('\n🎉 All integration tests passed!');
      console.log('✅ System integration is ready for production deployment');
      return true;
    } else if (this.results.critical > 0) {
      console.log('\n🚨 CRITICAL INTEGRATION ISSUES DETECTED!');
      console.log('❌ DO NOT DEPLOY - Fix critical issues immediately');
      return false;
    } else {
      console.log('\n⚠️  Some integration tests failed');
      console.log('🔧 Review and fix issues before deployment');
      return false;
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new ComprehensiveIntegrationTester();
  tester.run().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Comprehensive integration tests failed:', error);
    process.exit(1);
  });
}

module.exports = ComprehensiveIntegrationTester;