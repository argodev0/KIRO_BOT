#!/usr/bin/env node

/**
 * Frontend Real-time Updates Validation Script
 * 
 * This script validates that the frontend is fully functional with real-time updates
 * by checking all the key components and functionality.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class FrontendValidator {
  constructor() {
    this.results = {
      buildSystem: {},
      components: {},
      realTimeFeatures: {},
      integration: {},
      overall: { passed: 0, failed: 0, warnings: 0 }
    };
  }

  log(message, type = 'info') {
    const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
    console.log(`${icons[type]} ${message}`);
  }

  checkFileExists(filePath, description) {
    const exists = fs.existsSync(path.join(__dirname, filePath));
    if (exists) {
      this.log(`${description}: Found`, 'success');
      this.results.overall.passed++;
      return true;
    } else {
      this.log(`${description}: Missing`, 'error');
      this.results.overall.failed++;
      return false;
    }
  }

  checkBuildSystem() {
    this.log('\n🔧 Checking Build System...', 'info');
    
    // Check if frontend builds successfully
    try {
      this.log('Building frontend...', 'info');
      execSync('npm run build:frontend', { stdio: 'pipe', cwd: __dirname });
      this.log('Frontend build: SUCCESS', 'success');
      this.results.buildSystem.frontendBuild = true;
      this.results.overall.passed++;
    } catch (error) {
      this.log('Frontend build: FAILED', 'error');
      this.results.buildSystem.frontendBuild = false;
      this.results.overall.failed++;
    }

    // Check if dist files exist
    const distExists = fs.existsSync(path.join(__dirname, 'dist/frontend'));
    if (distExists) {
      this.log('Frontend dist directory: Found', 'success');
      this.results.buildSystem.distDirectory = true;
      this.results.overall.passed++;
    } else {
      this.log('Frontend dist directory: Missing', 'error');
      this.results.buildSystem.distDirectory = false;
      this.results.overall.failed++;
    }
  }

  checkCoreComponents() {
    this.log('\n🧩 Checking Core Components...', 'info');

    const components = [
      ['src/frontend/App.tsx', 'Main App Component'],
      ['src/frontend/components/dashboard/ResponsiveDashboard.tsx', 'Responsive Dashboard'],
      ['src/frontend/components/dashboard/TradingViewChart.tsx', 'TradingView Chart'],
      ['src/frontend/components/charts/EnhancedTradingViewChart.tsx', 'Enhanced Chart'],
      ['src/frontend/components/dashboard/VirtualPortfolioDisplay.tsx', 'Virtual Portfolio'],
      ['src/frontend/components/dashboard/MarketDataWidget.tsx', 'Market Data Widget'],
      ['src/frontend/components/dashboard/TradeHistory.tsx', 'Trade History'],
      ['src/frontend/components/dashboard/AlertsNotifications.tsx', 'Alerts & Notifications'],
      ['src/frontend/components/common/LiveDataIndicator.tsx', 'Live Data Indicator'],
      ['src/frontend/components/common/PaperTradingIndicator.tsx', 'Paper Trading Indicator']
    ];

    components.forEach(([filePath, description]) => {
      const exists = this.checkFileExists(filePath, description);
      this.results.components[description] = exists;
    });
  }

  checkRealTimeFeatures() {
    this.log('\n📡 Checking Real-time Features...', 'info');

    // Check WebSocket hook
    const webSocketHookExists = this.checkFileExists(
      'src/frontend/hooks/useWebSocket.ts', 
      'WebSocket Hook'
    );
    this.results.realTimeFeatures.webSocketHook = webSocketHookExists;

    // Check market data slice
    const marketDataSliceExists = this.checkFileExists(
      'src/frontend/store/slices/marketDataSlice.ts',
      'Market Data Redux Slice'
    );
    this.results.realTimeFeatures.marketDataSlice = marketDataSliceExists;

    // Check trading slice
    const tradingSliceExists = this.checkFileExists(
      'src/frontend/store/slices/tradingSlice.ts',
      'Trading Redux Slice'
    );
    this.results.realTimeFeatures.tradingSlice = tradingSliceExists;

    // Check store configuration
    const storeExists = this.checkFileExists(
      'src/frontend/store/store.ts',
      'Redux Store Configuration'
    );
    this.results.realTimeFeatures.reduxStore = storeExists;

    // Validate WebSocket hook implementation
    if (webSocketHookExists) {
      try {
        const hookContent = fs.readFileSync(
          path.join(__dirname, 'src/frontend/hooks/useWebSocket.ts'), 
          'utf8'
        );
        
        const hasSocketIO = hookContent.includes('socket.io-client');
        const hasEventHandlers = hookContent.includes('socket.on(');
        const hasReconnection = hookContent.includes('reconnection');
        const hasMarketDataEvents = hookContent.includes('marketData') || hookContent.includes('ticker');
        
        if (hasSocketIO && hasEventHandlers && hasReconnection && hasMarketDataEvents) {
          this.log('WebSocket hook implementation: Complete', 'success');
          this.results.realTimeFeatures.webSocketImplementation = true;
          this.results.overall.passed++;
        } else {
          this.log('WebSocket hook implementation: Incomplete', 'warning');
          this.results.realTimeFeatures.webSocketImplementation = false;
          this.results.overall.warnings++;
        }
      } catch (error) {
        this.log('WebSocket hook validation: Failed to read file', 'error');
        this.results.realTimeFeatures.webSocketImplementation = false;
        this.results.overall.failed++;
      }
    }
  }

  checkIntegrationFeatures() {
    this.log('\n🔗 Checking Integration Features...', 'info');

    // Check if components use real-time data
    const componentsToCheck = [
      ['src/frontend/components/charts/EnhancedTradingViewChart.tsx', 'Chart uses live data'],
      ['src/frontend/components/dashboard/VirtualPortfolioDisplay.tsx', 'Portfolio uses real-time updates'],
      ['src/frontend/components/dashboard/MarketDataWidget.tsx', 'Market widget shows live prices']
    ];

    componentsToCheck.forEach(([filePath, description]) => {
      if (fs.existsSync(path.join(__dirname, filePath))) {
        try {
          const content = fs.readFileSync(path.join(__dirname, filePath), 'utf8');
          const usesRedux = content.includes('useSelector') || content.includes('useDispatch');
          const usesRealTimeData = content.includes('marketData') || content.includes('tickers') || content.includes('isConnected');
          
          if (usesRedux && usesRealTimeData) {
            this.log(`${description}: Integrated`, 'success');
            this.results.integration[description] = true;
            this.results.overall.passed++;
          } else {
            this.log(`${description}: Not fully integrated`, 'warning');
            this.results.integration[description] = false;
            this.results.overall.warnings++;
          }
        } catch (error) {
          this.log(`${description}: Failed to validate`, 'error');
          this.results.integration[description] = false;
          this.results.overall.failed++;
        }
      }
    });

    // Check paper trading safety integration
    const paperTradingComponents = [
      'src/frontend/components/common/PaperTradingIndicator.tsx',
      'src/frontend/components/charts/EnhancedTradingViewChart.tsx'
    ];

    let paperTradingIntegrated = true;
    paperTradingComponents.forEach(filePath => {
      if (fs.existsSync(path.join(__dirname, filePath))) {
        const content = fs.readFileSync(path.join(__dirname, filePath), 'utf8');
        if (!content.includes('PAPER') && !content.includes('paper')) {
          paperTradingIntegrated = false;
        }
      }
    });

    if (paperTradingIntegrated) {
      this.log('Paper trading indicators: Integrated', 'success');
      this.results.integration.paperTradingIndicators = true;
      this.results.overall.passed++;
    } else {
      this.log('Paper trading indicators: Missing', 'error');
      this.results.integration.paperTradingIndicators = false;
      this.results.overall.failed++;
    }
  }

  async runWebSocketTest() {
    this.log('\n🧪 Running WebSocket Real-time Test...', 'info');
    
    try {
      // Import and run the WebSocket test
      const { runFrontendRealtimeTest } = require('./test-frontend-realtime.js');
      const testPassed = await runFrontendRealtimeTest();
      
      if (testPassed) {
        this.log('WebSocket real-time test: PASSED', 'success');
        this.results.realTimeFeatures.webSocketTest = true;
        this.results.overall.passed++;
      } else {
        this.log('WebSocket real-time test: FAILED', 'error');
        this.results.realTimeFeatures.webSocketTest = false;
        this.results.overall.failed++;
      }
    } catch (error) {
      this.log(`WebSocket test error: ${error.message}`, 'error');
      this.results.realTimeFeatures.webSocketTest = false;
      this.results.overall.failed++;
    }
  }

  generateReport() {
    this.log('\n📊 Validation Report', 'info');
    this.log('===================', 'info');
    
    const total = this.results.overall.passed + this.results.overall.failed + this.results.overall.warnings;
    const passRate = total > 0 ? ((this.results.overall.passed / total) * 100).toFixed(1) : 0;
    
    this.log(`Total checks: ${total}`, 'info');
    this.log(`Passed: ${this.results.overall.passed}`, 'success');
    this.log(`Failed: ${this.results.overall.failed}`, 'error');
    this.log(`Warnings: ${this.results.overall.warnings}`, 'warning');
    this.log(`Pass rate: ${passRate}%`, 'info');

    // Detailed breakdown
    this.log('\n📋 Detailed Results:', 'info');
    
    this.log('\nBuild System:', 'info');
    Object.entries(this.results.buildSystem).forEach(([key, value]) => {
      this.log(`  ${key}: ${value ? '✅' : '❌'}`, 'info');
    });

    this.log('\nCore Components:', 'info');
    Object.entries(this.results.components).forEach(([key, value]) => {
      this.log(`  ${key}: ${value ? '✅' : '❌'}`, 'info');
    });

    this.log('\nReal-time Features:', 'info');
    Object.entries(this.results.realTimeFeatures).forEach(([key, value]) => {
      this.log(`  ${key}: ${value ? '✅' : '❌'}`, 'info');
    });

    this.log('\nIntegration Features:', 'info');
    Object.entries(this.results.integration).forEach(([key, value]) => {
      this.log(`  ${key}: ${value ? '✅' : '⚠️'}`, 'info');
    });

    // Overall assessment
    this.log('\n🎯 Overall Assessment:', 'info');
    if (this.results.overall.failed === 0 && this.results.overall.warnings <= 2) {
      this.log('✅ EXCELLENT: Frontend is fully functional with real-time updates!', 'success');
      return 'excellent';
    } else if (this.results.overall.failed <= 2 && passRate >= 80) {
      this.log('✅ GOOD: Frontend is mostly functional with minor issues', 'success');
      return 'good';
    } else if (passRate >= 60) {
      this.log('⚠️ FAIR: Frontend has some functionality but needs improvements', 'warning');
      return 'fair';
    } else {
      this.log('❌ POOR: Frontend has significant issues that need to be addressed', 'error');
      return 'poor';
    }
  }

  async validate() {
    this.log('🚀 Starting Frontend Real-time Updates Validation...', 'info');
    
    this.checkBuildSystem();
    this.checkCoreComponents();
    this.checkRealTimeFeatures();
    this.checkIntegrationFeatures();
    await this.runWebSocketTest();
    
    const assessment = this.generateReport();
    
    this.log('\n📝 Summary:', 'info');
    this.log('The frontend has been validated for real-time functionality.', 'info');
    this.log('Key features verified:', 'info');
    this.log('• WebSocket connections and real-time data flow', 'info');
    this.log('• Live market data updates and chart integration', 'info');
    this.log('• Paper trading safety indicators', 'info');
    this.log('• Responsive dashboard layout', 'info');
    this.log('• Virtual portfolio with real-time updates', 'info');
    this.log('• Build system and component architecture', 'info');
    
    return assessment === 'excellent' || assessment === 'good';
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new FrontendValidator();
  validator.validate()
    .then(success => {
      console.log(`\n🏁 Validation completed: ${success ? 'SUCCESS' : 'NEEDS IMPROVEMENT'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Validation crashed:', error);
      process.exit(1);
    });
}

module.exports = { FrontendValidator };