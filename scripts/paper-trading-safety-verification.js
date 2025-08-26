#!/usr/bin/env node

/**
 * Paper Trading Safety Verification Script
 * 
 * Comprehensive verification of paper trading safety mechanisms
 * Requirements: 3.7, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class PaperTradingSafetyVerifier {
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
    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
    
    if (details) {
      console.log(`  Details: ${JSON.stringify(details, null, 2)}`);
    }
    
    this.results.tests.push({
      timestamp,
      level,
      message,
      details
    });
    
    if (level === 'critical') this.results.critical++;
    else if (level === 'error') this.results.failed++;
    else if (level === 'info') this.results.passed++;
  }

  async verifyEnvironmentConfiguration() {
    this.log('info', 'Verifying environment configuration for paper trading safety...');
    
    try {
      // Check production environment file
      const prodEnvPath = '.env.production';
      if (!fs.existsSync(prodEnvPath)) {
        this.log('critical', 'Production environment file missing', { file: prodEnvPath });
        return;
      }
      
      const envContent = fs.readFileSync(prodEnvPath, 'utf8');
      
      // Critical safety checks
      const safetyChecks = [
        { key: 'PAPER_TRADING_MODE', value: 'true', critical: true },
        { key: 'ALLOW_REAL_TRADES', value: 'false', critical: true },
        { key: 'NODE_ENV', value: 'production', critical: false },
        { key: 'TRADING_SIMULATION_ONLY', value: 'true', critical: true }
      ];
      
      for (const check of safetyChecks) {
        const pattern = new RegExp(`${check.key}\\s*=\\s*${check.value}`, 'i');
        if (pattern.test(envContent)) {
          this.log('info', `Environment safety check passed: ${check.key}=${check.value}`);
        } else {
          const level = check.critical ? 'critical' : 'error';
          this.log(level, `Environment safety check FAILED: ${check.key} must be ${check.value}`, {
            expected: check.value,
            found: this.extractEnvValue(envContent, check.key)
          });
        }
      }
      
      // Check for dangerous environment variables
      const dangerousVars = [
        'BINANCE_API_SECRET',
        'KUCOIN_API_SECRET',
        'ENABLE_REAL_TRADING',
        'PRODUCTION_TRADING'
      ];
      
      for (const dangerVar of dangerousVars) {
        if (envContent.includes(dangerVar)) {
          this.log('critical', `DANGEROUS: Found potentially unsafe environment variable: ${dangerVar}`);
        }
      }
      
    } catch (error) {
      this.log('critical', 'Environment configuration verification failed', error.message);
    }
  }

  extractEnvValue(content, key) {
    const match = content.match(new RegExp(`${key}\\s*=\\s*(.+)`));
    return match ? match[1].trim() : 'NOT_FOUND';
  }

  async verifyCodeSafetyMechanisms() {
    this.log('info', 'Verifying code-level safety mechanisms...');
    
    try {
      // Check paper trading guard middleware
      const guardPath = 'src/middleware/paperTradingGuard.ts';
      if (fs.existsSync(guardPath)) {
        const guardContent = fs.readFileSync(guardPath, 'utf8');
        
        // Check for critical safety patterns
        const safetyPatterns = [
          { pattern: /PAPER_TRADING_MODE.*true/i, description: 'Paper trading mode enforcement' },
          { pattern: /allowRealTrades.*false/i, description: 'Real trades blocking' },
          { pattern: /throw.*Error.*real.*trade/i, description: 'Real trade error throwing' },
          { pattern: /isPaperTrade.*true/i, description: 'Paper trade marking' }
        ];
        
        for (const safety of safetyPatterns) {
          if (safety.pattern.test(guardContent)) {
            this.log('info', `Code safety pattern found: ${safety.description}`);
          } else {
            this.log('error', `Code safety pattern MISSING: ${safety.description}`);
          }
        }
        
        // Check for dangerous patterns
        const dangerousPatterns = [
          { pattern: /allowRealTrades.*true/i, description: 'Real trades enabled' },
          { pattern: /PAPER_TRADING_MODE.*false/i, description: 'Paper trading disabled' },
          { pattern: /executeRealTrade/i, description: 'Real trade execution function' }
        ];
        
        for (const danger of dangerousPatterns) {
          if (danger.pattern.test(guardContent)) {
            this.log('critical', `DANGEROUS CODE PATTERN: ${danger.description}`);
          }
        }
        
      } else {
        this.log('critical', 'Paper trading guard middleware not found', { file: guardPath });
      }
      
      // Check trade simulation engine
      const simulationPath = 'src/services/TradeSimulationEngine.ts';
      if (fs.existsSync(simulationPath)) {
        const simulationContent = fs.readFileSync(simulationPath, 'utf8');
        
        if (simulationContent.includes('isPaperTrade: true')) {
          this.log('info', 'Trade simulation engine properly marks paper trades');
        } else {
          this.log('error', 'Trade simulation engine does not properly mark paper trades');
        }
        
        if (simulationContent.includes('simulateOrderExecution')) {
          this.log('info', 'Trade simulation engine has simulation methods');
        } else {
          this.log('error', 'Trade simulation engine missing simulation methods');
        }
      } else {
        this.log('critical', 'Trade simulation engine not found', { file: simulationPath });
      }
      
    } catch (error) {
      this.log('critical', 'Code safety mechanism verification failed', error.message);
    }
  }

  async verifyApiKeyPermissions() {
    this.log('info', 'Verifying API key permission restrictions...');
    
    try {
      // Check API permission validator
      const validatorPath = 'src/utils/ApiPermissionValidator.ts';
      if (fs.existsSync(validatorPath)) {
        const validatorContent = fs.readFileSync(validatorPath, 'utf8');
        
        // Check for read-only enforcement
        const permissionChecks = [
          { pattern: /readOnly.*true/i, description: 'Read-only enforcement' },
          { pattern: /trading.*false/i, description: 'Trading permission blocking' },
          { pattern: /withdraw.*false/i, description: 'Withdrawal permission blocking' },
          { pattern: /validatePermissions/i, description: 'Permission validation function' }
        ];
        
        for (const check of permissionChecks) {
          if (check.pattern.test(validatorContent)) {
            this.log('info', `API permission check found: ${check.description}`);
          } else {
            this.log('error', `API permission check MISSING: ${check.description}`);
          }
        }
        
      } else {
        this.log('critical', 'API permission validator not found', { file: validatorPath });
      }
      
      // Check exchange service configurations
      const exchangeServices = [
        'src/services/exchanges/BinanceExchange.ts',
        'src/services/exchanges/KuCoinExchange.ts'
      ];
      
      for (const servicePath of exchangeServices) {
        if (fs.existsSync(servicePath)) {
          const serviceContent = fs.readFileSync(servicePath, 'utf8');
          
          // Check for read-only API usage
          if (serviceContent.includes('testnet') || serviceContent.includes('sandbox')) {
            this.log('info', `Exchange service uses testnet/sandbox: ${path.basename(servicePath)}`);
          }
          
          if (serviceContent.includes('readOnly') || serviceContent.includes('READ_ONLY')) {
            this.log('info', `Exchange service enforces read-only: ${path.basename(servicePath)}`);
          } else {
            this.log('error', `Exchange service may not enforce read-only: ${path.basename(servicePath)}`);
          }
          
          // Check for dangerous trading methods
          const dangerousMethods = ['createOrder', 'cancelOrder', 'withdraw', 'transfer'];
          for (const method of dangerousMethods) {
            if (serviceContent.includes(method) && !serviceContent.includes(`simulate${method}`)) {
              this.log('error', `Exchange service contains dangerous method: ${method} in ${path.basename(servicePath)}`);
            }
          }
          
        } else {
          this.log('error', `Exchange service not found: ${servicePath}`);
        }
      }
      
    } catch (error) {
      this.log('critical', 'API key permission verification failed', error.message);
    }
  }

  async verifyDatabaseSafety() {
    this.log('info', 'Verifying database safety mechanisms...');
    
    try {
      // Check Prisma schema for paper trading fields
      const schemaPath = 'prisma/schema.prisma';
      if (fs.existsSync(schemaPath)) {
        const schemaContent = fs.readFileSync(schemaPath, 'utf8');
        
        // Check for paper trading fields in trade models
        const safetyFields = [
          'isPaperTrade',
          'simulatedTrade',
          'virtualBalance',
          'paperTradingMode'
        ];
        
        for (const field of safetyFields) {
          if (schemaContent.includes(field)) {
            this.log('info', `Database safety field found: ${field}`);
          } else {
            this.log('error', `Database safety field MISSING: ${field}`);
          }
        }
        
        // Check for dangerous real money fields
        const dangerousFields = [
          'realBalance',
          'actualTrade',
          'liveTrading'
        ];
        
        for (const field of dangerousFields) {
          if (schemaContent.includes(field)) {
            this.log('critical', `DANGEROUS database field found: ${field}`);
          }
        }
        
      } else {
        this.log('error', 'Prisma schema not found', { file: schemaPath });
      }
      
      // Check database initialization scripts
      const initScriptPath = 'database/init/01-init.sql';
      if (fs.existsSync(initScriptPath)) {
        const initContent = fs.readFileSync(initScriptPath, 'utf8');
        
        if (initContent.includes('paper_trading_mode')) {
          this.log('info', 'Database initialization includes paper trading configuration');
        } else {
          this.log('error', 'Database initialization missing paper trading configuration');
        }
      }
      
    } catch (error) {
      this.log('critical', 'Database safety verification failed', error.message);
    }
  }

  async verifyFrontendSafetyIndicators() {
    this.log('info', 'Verifying frontend safety indicators...');
    
    try {
      // Check paper trading indicator component
      const indicatorPath = 'src/frontend/components/common/PaperTradingIndicator.tsx';
      if (fs.existsSync(indicatorPath)) {
        const indicatorContent = fs.readFileSync(indicatorPath, 'utf8');
        
        const safetyElements = [
          'PAPER TRADING MODE',
          'SIMULATION ONLY',
          'NO REAL MONEY',
          'backgroundColor.*red'
        ];
        
        for (const element of safetyElements) {
          const pattern = new RegExp(element, 'i');
          if (pattern.test(indicatorContent)) {
            this.log('info', `Frontend safety element found: ${element}`);
          } else {
            this.log('error', `Frontend safety element MISSING: ${element}`);
          }
        }
        
      } else {
        this.log('critical', 'Paper trading indicator component not found', { file: indicatorPath });
      }
      
      // Check trading page for safety warnings
      const tradingPagePath = 'src/frontend/pages/TradingPage.tsx';
      if (fs.existsSync(tradingPagePath)) {
        const tradingContent = fs.readFileSync(tradingPagePath, 'utf8');
        
        if (tradingContent.includes('PaperTradingIndicator')) {
          this.log('info', 'Trading page includes paper trading indicator');
        } else {
          this.log('error', 'Trading page missing paper trading indicator');
        }
        
        if (tradingContent.includes('confirm') || tradingContent.includes('warning')) {
          this.log('info', 'Trading page includes confirmation/warning dialogs');
        } else {
          this.log('error', 'Trading page missing confirmation/warning dialogs');
        }
      }
      
      // Check virtual portfolio display
      const portfolioPath = 'src/frontend/components/dashboard/VirtualPortfolioDisplay.tsx';
      if (fs.existsSync(portfolioPath)) {
        const portfolioContent = fs.readFileSync(portfolioPath, 'utf8');
        
        if (portfolioContent.includes('virtual') || portfolioContent.includes('simulated')) {
          this.log('info', 'Portfolio display clearly indicates virtual/simulated balances');
        } else {
          this.log('error', 'Portfolio display may not clearly indicate virtual balances');
        }
      }
      
    } catch (error) {
      this.log('critical', 'Frontend safety indicator verification failed', error.message);
    }
  }

  async verifyTestCoverage() {
    this.log('info', 'Verifying paper trading safety test coverage...');
    
    try {
      // Check for paper trading specific tests
      const testFiles = [
        'src/__tests__/comprehensive/PaperTradingGuardTests.test.ts',
        'src/__tests__/paperTradingSafety.test.ts',
        'src/__tests__/paperTradingIntegration.test.ts'
      ];
      
      for (const testFile of testFiles) {
        if (fs.existsSync(testFile)) {
          const testContent = fs.readFileSync(testFile, 'utf8');
          
          // Check for critical test scenarios
          const testScenarios = [
            'real trade blocked',
            'paper trade only',
            'api permission',
            'virtual balance',
            'simulation engine'
          ];
          
          for (const scenario of testScenarios) {
            const pattern = new RegExp(scenario, 'i');
            if (pattern.test(testContent)) {
              this.log('info', `Test scenario found in ${path.basename(testFile)}: ${scenario}`);
            }
          }
          
        } else {
          this.log('error', `Paper trading test file not found: ${testFile}`);
        }
      }
      
      // Try to run paper trading specific tests
      try {
        const testOutput = execSync('npm test -- --testNamePattern="paper.*trading" --passWithNoTests --silent', 
          { encoding: 'utf8', timeout: 30000 });
        
        if (testOutput.includes('PASS')) {
          this.log('info', 'Paper trading tests can be executed successfully');
        } else {
          this.log('error', 'Paper trading tests may have issues');
        }
      } catch (error) {
        this.log('error', 'Could not execute paper trading tests', error.message);
      }
      
    } catch (error) {
      this.log('critical', 'Test coverage verification failed', error.message);
    }
  }

  async verifyConfigurationFiles() {
    this.log('info', 'Verifying configuration files for safety...');
    
    try {
      // Check production configuration
      const prodConfigPath = 'src/config/production.ts';
      if (fs.existsSync(prodConfigPath)) {
        const configContent = fs.readFileSync(prodConfigPath, 'utf8');
        
        const safetyConfigs = [
          'paperTradingMode: true',
          'allowRealTrades: false',
          'tradingSimulation: true'
        ];
        
        for (const config of safetyConfigs) {
          if (configContent.includes(config)) {
            this.log('info', `Production config safety setting found: ${config}`);
          } else {
            this.log('error', `Production config safety setting MISSING: ${config}`);
          }
        }
        
      } else {
        this.log('critical', 'Production configuration file not found', { file: prodConfigPath });
      }
      
      // Check Docker production configuration
      const dockerProdPath = 'docker-compose.prod.yml';
      if (fs.existsSync(dockerProdPath)) {
        const dockerContent = fs.readFileSync(dockerProdPath, 'utf8');
        
        if (dockerContent.includes('PAPER_TRADING_MODE=true')) {
          this.log('info', 'Docker production config enforces paper trading mode');
        } else {
          this.log('error', 'Docker production config missing paper trading enforcement');
        }
        
        if (dockerContent.includes('ALLOW_REAL_TRADES=false')) {
          this.log('info', 'Docker production config blocks real trades');
        } else {
          this.log('error', 'Docker production config missing real trade blocking');
        }
        
      } else {
        this.log('error', 'Docker production configuration not found', { file: dockerProdPath });
      }
      
    } catch (error) {
      this.log('critical', 'Configuration file verification failed', error.message);
    }
  }

  async run() {
    console.log('🛡️  Starting Paper Trading Safety Verification...\n');
    
    await this.verifyEnvironmentConfiguration();
    await this.verifyCodeSafetyMechanisms();
    await this.verifyApiKeyPermissions();
    await this.verifyDatabaseSafety();
    await this.verifyFrontendSafetyIndicators();
    await this.verifyTestCoverage();
    await this.verifyConfigurationFiles();
    
    // Generate comprehensive safety report
    console.log('\n🛡️  Paper Trading Safety Verification Summary:');
    console.log(`✅ Safety Checks Passed: ${this.results.passed}`);
    console.log(`⚠️  Warnings: ${this.results.failed}`);
    console.log(`🚨 Critical Issues: ${this.results.critical}`);
    
    const totalChecks = this.results.passed + this.results.failed + this.results.critical;
    const safetyScore = totalChecks > 0 ? ((this.results.passed / totalChecks) * 100).toFixed(1) : 0;
    console.log(`🔒 Safety Score: ${safetyScore}%`);
    
    // Show critical issues
    if (this.results.critical > 0) {
      console.log('\n🚨 CRITICAL SAFETY ISSUES DETECTED:');
      this.results.tests
        .filter(test => test.level === 'critical')
        .forEach(test => {
          console.log(`  ❌ ${test.message}`);
          if (test.details) {
            console.log(`     ${JSON.stringify(test.details)}`);
          }
        });
    }
    
    // Write detailed safety report
    const reportPath = 'paper-trading-safety-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n📄 Detailed safety report saved to: ${reportPath}`);
    
    // Safety assessment
    if (this.results.critical > 0) {
      console.log('\n🚨 CRITICAL SAFETY FAILURES - DO NOT DEPLOY TO PRODUCTION!');
      console.log('Fix all critical issues before proceeding.');
      process.exit(1);
    } else if (this.results.failed > 0) {
      console.log('\n⚠️  Safety warnings detected - Review before deployment');
      process.exit(1);
    } else {
      console.log('\n🎉 All paper trading safety checks passed!');
      console.log('✅ System is safe for production deployment');
      process.exit(0);
    }
  }
}

// Run verification if called directly
if (require.main === module) {
  const verifier = new PaperTradingSafetyVerifier();
  verifier.run().catch(error => {
    console.error('Safety verification failed:', error);
    process.exit(1);
  });
}

module.exports = PaperTradingSafetyVerifier;