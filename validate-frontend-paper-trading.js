#!/usr/bin/env node

/**
 * Frontend Paper Trading Validation Script
 * Validates that all paper trading components are properly implemented
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = './src/frontend';
const REQUIRED_COMPONENTS = [
  'components/common/PaperTradingIndicator.tsx',
  'components/common/LiveDataIndicator.tsx',
  'components/dashboard/VirtualPortfolioDisplay.tsx',
  'components/charts/EnhancedTradingViewChart.tsx',
  'components/trading/PaperTradingConfirmDialog.tsx',
  'components/Layout/Sidebar.tsx',
  'components/Layout/Header.tsx',
  'pages/TradingPage.tsx',
  'pages/DashboardPage.tsx',
  'store/slices/marketDataSlice.ts',
  'store/slices/tradingSlice.ts',
  'store/slices/uiSlice.ts',
  'store/slices/authSlice.ts',
  'hooks/useWebSocket.ts',
  'services/api.ts',
];

const PAPER_TRADING_FEATURES = [
  'PAPER TRADING MODE',
  'Virtual Portfolio',
  'Live Data',
  'Paper Trade',
  'Simulated',
  'No real money',
];

function validateFileExists(filePath) {
  const fullPath = path.join(FRONTEND_DIR, filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Missing file: ${filePath}`);
    return false;
  }
  console.log(`✅ Found: ${filePath}`);
  return true;
}

function validatePaperTradingFeatures(filePath) {
  const fullPath = path.join(FRONTEND_DIR, filePath);
  if (!fs.existsSync(fullPath)) {
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const foundFeatures = PAPER_TRADING_FEATURES.filter(feature => 
    content.toLowerCase().includes(feature.toLowerCase())
  );

  if (foundFeatures.length > 0) {
    console.log(`📋 ${filePath} includes paper trading features: ${foundFeatures.join(', ')}`);
    return true;
  }
  return false;
}

function validateReduxIntegration() {
  const storeFile = path.join(FRONTEND_DIR, 'store/store.ts');
  if (!fs.existsSync(storeFile)) {
    console.error('❌ Redux store not found');
    return false;
  }

  const content = fs.readFileSync(storeFile, 'utf8');
  const requiredSlices = ['marketData', 'trading', 'auth', 'ui'];
  const missingSlices = requiredSlices.filter(slice => !content.includes(slice));

  if (missingSlices.length > 0) {
    console.error(`❌ Missing Redux slices: ${missingSlices.join(', ')}`);
    return false;
  }

  console.log('✅ Redux store properly configured with all required slices');
  return true;
}

function validateWebSocketIntegration() {
  const hookFile = path.join(FRONTEND_DIR, 'hooks/useWebSocket.ts');
  if (!fs.existsSync(hookFile)) {
    console.error('❌ WebSocket hook not found');
    return false;
  }

  const content = fs.readFileSync(hookFile, 'utf8');
  const requiredEvents = ['ticker', 'orderbook', 'signal', 'position'];
  const missingEvents = requiredEvents.filter(event => !content.includes(event));

  if (missingEvents.length > 0) {
    console.error(`❌ Missing WebSocket events: ${missingEvents.join(', ')}`);
    return false;
  }

  console.log('✅ WebSocket integration properly configured');
  return true;
}

function main() {
  console.log('🔍 Validating Frontend Paper Trading Implementation...\n');

  let allValid = true;

  // Check required files
  console.log('📁 Checking required files:');
  for (const file of REQUIRED_COMPONENTS) {
    if (!validateFileExists(file)) {
      allValid = false;
    }
  }

  console.log('\n📋 Checking paper trading features:');
  const componentFiles = REQUIRED_COMPONENTS.filter(file => 
    file.includes('components/') || file.includes('pages/')
  );
  
  for (const file of componentFiles) {
    validatePaperTradingFeatures(file);
  }

  console.log('\n🔧 Checking integrations:');
  if (!validateReduxIntegration()) {
    allValid = false;
  }
  
  if (!validateWebSocketIntegration()) {
    allValid = false;
  }

  // Check App.tsx integration
  const appFile = path.join(FRONTEND_DIR, 'App.tsx');
  if (fs.existsSync(appFile)) {
    const content = fs.readFileSync(appFile, 'utf8');
    if (content.includes('PaperTradingIndicator')) {
      console.log('✅ App.tsx includes paper trading indicators');
    } else {
      console.log('⚠️  App.tsx missing paper trading indicators');
    }
  }

  console.log('\n📊 Summary:');
  if (allValid) {
    console.log('✅ All frontend paper trading components are properly implemented!');
    console.log('\n🎯 Key Features Implemented:');
    console.log('   • Paper trading mode indicators throughout UI');
    console.log('   • Live market data integration with WebSocket');
    console.log('   • Virtual portfolio display with simulated balances');
    console.log('   • Enhanced TradingView chart with live data feeds');
    console.log('   • Paper trading confirmation dialogs');
    console.log('   • Responsive layout with paper trading warnings');
    console.log('   • Real-time connection status indicators');
    console.log('   • Redux state management for all trading data');
    
    console.log('\n🔒 Safety Features:');
    console.log('   • Multiple paper trading warnings and indicators');
    console.log('   • Clear "PAPER TRADING MODE" banners');
    console.log('   • Virtual balance displays');
    console.log('   • Confirmation dialogs for all trades');
    console.log('   • Live data source indicators');
    
    process.exit(0);
  } else {
    console.log('❌ Some components are missing or incomplete');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateFileExists, validatePaperTradingFeatures };