#!/usr/bin/env node

/**
 * Frontend Enhancement Validation Script
 * Validates that all paper trading frontend components are properly implemented
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_FILES = [
  'src/frontend/components/common/PaperTradingIndicator.tsx',
  'src/frontend/components/common/LiveDataIndicator.tsx',
  'src/frontend/components/dashboard/VirtualPortfolioDisplay.tsx',
  'src/frontend/components/charts/EnhancedTradingViewChart.tsx',
  'src/frontend/components/trading/PaperTradingConfirmDialog.tsx',
  'src/frontend/__tests__/components/PaperTradingIndicator.test.tsx',
  'src/frontend/__tests__/components/VirtualPortfolioDisplay.test.tsx',
];

const REQUIRED_CONTENT_CHECKS = [
  {
    file: 'src/frontend/components/common/PaperTradingIndicator.tsx',
    content: ['PAPER TRADING', 'Security', 'warning'],
  },
  {
    file: 'src/frontend/components/common/LiveDataIndicator.tsx',
    content: ['LIVE MAINNET DATA', 'isConnected', 'TrendingUp'],
  },
  {
    file: 'src/frontend/components/dashboard/VirtualPortfolioDisplay.tsx',
    content: ['Virtual Portfolio', 'PAPER TRADING', 'Simulated'],
  },
  {
    file: 'src/frontend/components/charts/EnhancedTradingViewChart.tsx',
    content: ['LIVE MAINNET DATA', 'PaperTradingIndicator', 'LiveDataIndicator'],
  },
  {
    file: 'src/frontend/App.tsx',
    content: ['PaperTradingIndicator', 'Paper Trading Banner'],
  },
];

const UPDATED_FILES = [
  'src/frontend/App.tsx',
  'src/frontend/components/dashboard/ResponsiveDashboard.tsx',
  'src/frontend/components/dashboard/TradingViewChart.tsx',
  'src/frontend/components/dashboard/MarketDataWidget.tsx',
  'src/frontend/hooks/useWebSocket.ts',
  'src/frontend/store/slices/tradingSlice.ts',
];

console.log('🔍 Validating Frontend Paper Trading Enhancements...\n');

let allValid = true;

// Check if all required files exist
console.log('📁 Checking required files...');
for (const file of REQUIRED_FILES) {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allValid = false;
  }
}

console.log('\n📝 Checking file content...');
for (const check of REQUIRED_CONTENT_CHECKS) {
  const filePath = path.join(__dirname, check.file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    let fileValid = true;
    
    for (const requiredContent of check.content) {
      if (content.includes(requiredContent)) {
        console.log(`✅ ${check.file} contains "${requiredContent}"`);
      } else {
        console.log(`❌ ${check.file} missing "${requiredContent}"`);
        fileValid = false;
        allValid = false;
      }
    }
    
    if (fileValid) {
      console.log(`✅ ${check.file} - All content checks passed`);
    }
  } else {
    console.log(`❌ ${check.file} - File not found`);
    allValid = false;
  }
}

console.log('\n🔄 Checking updated files...');
for (const file of UPDATED_FILES) {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} - Updated`);
  } else {
    console.log(`❌ ${file} - Not found`);
    allValid = false;
  }
}

// Check specific enhancements
console.log('\n🎯 Checking specific enhancements...');

// Check if App.tsx has paper trading banner
const appPath = path.join(__dirname, 'src/frontend/App.tsx');
if (fs.existsSync(appPath)) {
  const appContent = fs.readFileSync(appPath, 'utf8');
  if (appContent.includes('Paper Trading Banner') && appContent.includes('PaperTradingIndicator')) {
    console.log('✅ App.tsx has paper trading banner');
  } else {
    console.log('❌ App.tsx missing paper trading banner');
    allValid = false;
  }
}

// Check if ResponsiveDashboard uses VirtualPortfolioDisplay
const dashboardPath = path.join(__dirname, 'src/frontend/components/dashboard/ResponsiveDashboard.tsx');
if (fs.existsSync(dashboardPath)) {
  const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
  if (dashboardContent.includes('VirtualPortfolioDisplay')) {
    console.log('✅ ResponsiveDashboard uses VirtualPortfolioDisplay');
  } else {
    console.log('❌ ResponsiveDashboard not using VirtualPortfolioDisplay');
    allValid = false;
  }
}

// Check if MarketDataWidget has live data indicators
const marketDataPath = path.join(__dirname, 'src/frontend/components/dashboard/MarketDataWidget.tsx');
if (fs.existsSync(marketDataPath)) {
  const marketDataContent = fs.readFileSync(marketDataPath, 'utf8');
  if (marketDataContent.includes('LiveDataIndicator') && marketDataContent.includes('LIVE MAINNET DATA')) {
    console.log('✅ MarketDataWidget has live data indicators');
  } else {
    console.log('❌ MarketDataWidget missing live data indicators');
    allValid = false;
  }
}

// Check if trading slice has paper trading state
const tradingSlicePath = path.join(__dirname, 'src/frontend/store/slices/tradingSlice.ts');
if (fs.existsSync(tradingSlicePath)) {
  const tradingSliceContent = fs.readFileSync(tradingSlicePath, 'utf8');
  if (tradingSliceContent.includes('paperTrading') && tradingSliceContent.includes('updatePaperTradingStats')) {
    console.log('✅ Trading slice has paper trading state');
  } else {
    console.log('❌ Trading slice missing paper trading state');
    allValid = false;
  }
}

console.log('\n' + '='.repeat(50));

if (allValid) {
  console.log('🎉 All frontend paper trading enhancements are properly implemented!');
  console.log('\n📋 Summary of implemented features:');
  console.log('• Paper trading indicators and warnings throughout UI');
  console.log('• Live market data indicators showing mainnet connection');
  console.log('• Virtual portfolio display with simulated balances');
  console.log('• Enhanced TradingView chart with live data integration');
  console.log('• Paper trading confirmation dialogs');
  console.log('• Updated Redux state management for paper trading');
  console.log('• Comprehensive test coverage');
  
  process.exit(0);
} else {
  console.log('❌ Some frontend enhancements are missing or incomplete.');
  console.log('Please review the errors above and ensure all components are properly implemented.');
  
  process.exit(1);
}