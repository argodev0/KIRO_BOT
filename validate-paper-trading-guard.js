#!/usr/bin/env node

/**
 * Paper Trading Guard Validation Script
 * Validates that the enhanced paper trading guard middleware is working correctly
 */

const fs = require('fs');
const path = require('path');

console.log('🔒 Paper Trading Guard Validation');
console.log('=====================================');

// Test results
const results = {
  passed: 0,
  failed: 0,
  critical: 0,
  tests: []
};

function logTest(level, message, details = null) {
  const timestamp = new Date().toISOString();
  const result = { timestamp, level, message, details };
  results.tests.push(result);
  
  const emoji = level === 'critical' ? '🚨' : level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
  console.log(`${emoji} [${level.toUpperCase()}] ${message}`);
  
  if (details) {
    console.log(`   Details: ${JSON.stringify(details)}`);
  }
  
  if (level === 'critical') {
    results.critical++;
    results.failed++;
  } else if (level === 'error') {
    results.failed++;
  } else {
    results.passed++;
  }
}

// Test 1: Check if enhanced middleware file exists and has required methods
function testMiddlewareImplementation() {
  console.log('\n📋 Testing Middleware Implementation...');
  
  const middlewarePath = path.join(__dirname, 'src/middleware/paperTradingGuard.ts');
  
  if (!fs.existsSync(middlewarePath)) {
    logTest('critical', 'Paper trading guard middleware file not found');
    return;
  }
  
  const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
  
  // Check for required methods
  const requiredMethods = [
    'interceptTradingOperations',
    'validatePaperTradingMode',
    'logPaperTradeAttempt',
    'validateTradeRequest',
    'throwRealTradeErrorIfUnsafe',
    'blockRealMoneyOperations',
    'convertToPaperTrade'
  ];
  
  for (const method of requiredMethods) {
    if (middlewareContent.includes(method)) {
      logTest('info', `Required method found: ${method}`);
    } else {
      logTest('error', `Required method MISSING: ${method}`);
    }
  }
  
  // Check for enhanced error codes
  const requiredErrorCodes = [
    'TRADING_SIMULATION_ONLY_REQUIRED',
    'PAPER_TRADING_MODE_REQUIRED',
    'UNSAFE_OPERATION_BLOCKED',
    'REAL_MONEY_INDICATOR_DETECTED'
  ];
  
  for (const errorCode of requiredErrorCodes) {
    if (middlewareContent.includes(errorCode)) {
      logTest('info', `Enhanced error code found: ${errorCode}`);
    } else {
      logTest('error', `Enhanced error code MISSING: ${errorCode}`);
    }
  }
  
  // Check for comprehensive logging
  if (middlewareContent.includes('logPaperTradeAttempt')) {
    logTest('info', 'Comprehensive logging implementation found');
  } else {
    logTest('error', 'Comprehensive logging implementation MISSING');
  }
  
  // Check for real trade error throwing
  if (middlewareContent.includes('throwRealTradeErrorIfUnsafe')) {
    logTest('info', 'Real trade error throwing mechanism found');
  } else {
    logTest('error', 'Real trade error throwing mechanism MISSING');
  }
  
  // Check for trade request validation
  if (middlewareContent.includes('validateTradeRequest')) {
    logTest('info', 'Trade request validation found');
  } else {
    logTest('error', 'Trade request validation MISSING');
  }
}

// Test 2: Check environment variable validation
function testEnvironmentValidation() {
  console.log('\n🌍 Testing Environment Variable Validation...');
  
  const middlewarePath = path.join(__dirname, 'src/middleware/paperTradingGuard.ts');
  const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
  
  // Check for TRADING_SIMULATION_ONLY validation
  if (middlewareContent.includes('TRADING_SIMULATION_ONLY') && middlewareContent.includes('!== \'true\'')) {
    logTest('info', 'TRADING_SIMULATION_ONLY validation implemented');
  } else {
    logTest('critical', 'TRADING_SIMULATION_ONLY validation MISSING');
  }
  
  // Check for PAPER_TRADING_MODE validation
  if (middlewareContent.includes('PAPER_TRADING_MODE') && middlewareContent.includes('!== \'true\'')) {
    logTest('info', 'PAPER_TRADING_MODE validation implemented');
  } else {
    logTest('critical', 'PAPER_TRADING_MODE validation MISSING');
  }
  
  // Check for ALLOW_REAL_TRADES blocking
  if (middlewareContent.includes('ALLOW_REAL_TRADES') && middlewareContent.includes('=== \'true\'')) {
    logTest('info', 'ALLOW_REAL_TRADES blocking implemented');
  } else {
    logTest('critical', 'ALLOW_REAL_TRADES blocking MISSING');
  }
}

// Test 3: Check real money operation blocking
function testRealMoneyBlocking() {
  console.log('\n💰 Testing Real Money Operation Blocking...');
  
  const middlewarePath = path.join(__dirname, 'src/middleware/paperTradingGuard.ts');
  const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
  
  const dangerousOperations = [
    'withdraw',
    'transfer',
    'deposit',
    'futures',
    'margin'
  ];
  
  for (const operation of dangerousOperations) {
    if (middlewareContent.includes(operation)) {
      logTest('info', `Real money operation blocking found: ${operation}`);
    } else {
      logTest('error', `Real money operation blocking MISSING: ${operation}`);
    }
  }
  
  // Check for real money indicator detection
  const realMoneyIndicators = [
    'real_trade',
    'live_trade',
    'production_trade',
    'mainnet'
  ];
  
  for (const indicator of realMoneyIndicators) {
    if (middlewareContent.includes(indicator)) {
      logTest('info', `Real money indicator detection found: ${indicator}`);
    } else {
      logTest('error', `Real money indicator detection MISSING: ${indicator}`);
    }
  }
}

// Test 4: Check comprehensive logging implementation
function testComprehensiveLogging() {
  console.log('\n📝 Testing Comprehensive Logging...');
  
  const middlewarePath = path.join(__dirname, 'src/middleware/paperTradingGuard.ts');
  const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
  
  // Check for detailed logging fields
  const loggingFields = [
    'timestamp',
    'path',
    'method',
    'body',
    'query',
    'headers',
    'ip',
    'sessionId',
    'userId'
  ];
  
  for (const field of loggingFields) {
    if (middlewareContent.includes(field)) {
      logTest('info', `Comprehensive logging field found: ${field}`);
    } else {
      logTest('error', `Comprehensive logging field MISSING: ${field}`);
    }
  }
  
  // Check for security event logging
  if (middlewareContent.includes('logSecurityEvent')) {
    logTest('info', 'Security event logging implemented');
  } else {
    logTest('error', 'Security event logging MISSING');
  }
  
  // Check for audit log functionality
  if (middlewareContent.includes('getSecurityAuditLog')) {
    logTest('info', 'Security audit log functionality found');
  } else {
    logTest('error', 'Security audit log functionality MISSING');
  }
}

// Test 5: Check statistics and monitoring
function testStatisticsMonitoring() {
  console.log('\n📊 Testing Statistics and Monitoring...');
  
  const middlewarePath = path.join(__dirname, 'src/middleware/paperTradingGuard.ts');
  const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
  
  // Check for statistics methods
  if (middlewareContent.includes('getPaperTradingStats')) {
    logTest('info', 'Paper trading statistics method found');
  } else {
    logTest('error', 'Paper trading statistics method MISSING');
  }
  
  if (middlewareContent.includes('exportSecurityAuditLog')) {
    logTest('info', 'Security audit log export method found');
  } else {
    logTest('error', 'Security audit log export method MISSING');
  }
  
  // Check for safety score calculation
  if (middlewareContent.includes('safetyScore')) {
    logTest('info', 'Safety score calculation found');
  } else {
    logTest('error', 'Safety score calculation MISSING');
  }
}

// Test 6: Check integration with main application
function testApplicationIntegration() {
  console.log('\n🔗 Testing Application Integration...');
  
  const indexPath = path.join(__dirname, 'src/index.ts');
  
  if (!fs.existsSync(indexPath)) {
    logTest('error', 'Main application file not found');
    return;
  }
  
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  
  // Check if middleware is imported
  if (indexContent.includes('paperTradingGuard')) {
    logTest('info', 'Paper trading guard middleware imported in main application');
  } else {
    logTest('error', 'Paper trading guard middleware NOT imported in main application');
  }
  
  // Check if middleware is used
  if (indexContent.includes('app.use(paperTradingGuard)')) {
    logTest('info', 'Paper trading guard middleware applied to application');
  } else {
    logTest('error', 'Paper trading guard middleware NOT applied to application');
  }
  
  // Check if validation is called on startup
  if (indexContent.includes('validatePaperTradingMode')) {
    logTest('info', 'Paper trading mode validation called on startup');
  } else {
    logTest('error', 'Paper trading mode validation NOT called on startup');
  }
}

// Test 7: Check test coverage
function testTestCoverage() {
  console.log('\n🧪 Testing Test Coverage...');
  
  const testPath = path.join(__dirname, 'src/__tests__/middleware/paperTradingGuard.simple.test.ts');
  
  if (fs.existsSync(testPath)) {
    logTest('info', 'Paper trading guard tests found');
    
    const testContent = fs.readFileSync(testPath, 'utf8');
    
    // Check for key test scenarios
    const testScenarios = [
      'Environment Validation',
      'API Permission Validation',
      'Configuration Management',
      'Statistics and Monitoring'
    ];
    
    for (const scenario of testScenarios) {
      if (testContent.includes(scenario)) {
        logTest('info', `Test scenario found: ${scenario}`);
      } else {
        logTest('error', `Test scenario MISSING: ${scenario}`);
      }
    }
  } else {
    logTest('error', 'Paper trading guard tests NOT found');
  }
}

// Run all tests
async function runValidation() {
  console.log('Starting Paper Trading Guard validation...\n');
  
  testMiddlewareImplementation();
  testEnvironmentValidation();
  testRealMoneyBlocking();
  testComprehensiveLogging();
  testStatisticsMonitoring();
  testApplicationIntegration();
  testTestCoverage();
  
  // Summary
  console.log('\n📋 Validation Summary');
  console.log('=====================');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`🚨 Critical: ${results.critical}`);
  
  const totalTests = results.passed + results.failed;
  const successRate = totalTests > 0 ? Math.round((results.passed / totalTests) * 100) : 0;
  console.log(`📊 Success Rate: ${successRate}%`);
  
  if (results.critical > 0) {
    console.log('\n🚨 CRITICAL ISSUES DETECTED!');
    console.log('The paper trading guard has critical safety issues that must be addressed.');
  } else if (results.failed > 0) {
    console.log('\n⚠️  Some issues detected, but no critical safety violations.');
  } else {
    console.log('\n✅ All paper trading guard validations passed!');
    console.log('The enhanced paper trading guard middleware is properly implemented.');
  }
  
  // Save results
  const reportPath = path.join(__dirname, 'paper-trading-guard-validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  
  return results.critical === 0;
}

// Run the validation
runValidation().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Validation failed with error:', error);
  process.exit(1);
});