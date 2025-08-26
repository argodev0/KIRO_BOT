#!/usr/bin/env node

/**
 * Simple Paper Trading Safety Check
 * 
 * Basic verification of paper trading safety mechanisms without Jest dependencies
 */

const fs = require('fs');
const path = require('path');

class SimplePaperTradingSafetyChecker {
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
          { pattern: /allowRealTrades\s*[:=]\s*true/i, description: 'Real trades enabled' },
          { pattern: /PAPER_TRADING_MODE\s*[:=]\s*false/i, description: 'Paper trading disabled' },
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
      const dockerProdPath = 'docker/docker-compose.prod.yml';
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
      
    } catch (error) {
      this.log('critical', 'Frontend safety indicator verification failed', error.message);
    }
  }

  async run() {
    console.log('🛡️  Starting Simple Paper Trading Safety Check...\n');
    
    await this.verifyEnvironmentConfiguration();
    await this.verifyCodeSafetyMechanisms();
    await this.verifyConfigurationFiles();
    await this.verifyFrontendSafetyIndicators();
    
    // Generate comprehensive safety report
    console.log('\n🛡️  Paper Trading Safety Check Summary:');
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
    const reportPath = 'simple-paper-trading-safety-report.json';
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
  const checker = new SimplePaperTradingSafetyChecker();
  checker.run().catch(error => {
    console.error('Safety check failed:', error);
    process.exit(1);
  });
}

module.exports = SimplePaperTradingSafetyChecker;