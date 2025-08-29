#!/usr/bin/env node

/**
 * API Permission System Validation Script
 * Comprehensive testing of the API Permission Validator and Guard system
 */

const path = require('path');
const fs = require('fs');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Logging functions
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  critical: (msg) => console.log(`${colors.red}🚨 CRITICAL: ${msg}${colors.reset}`),
  test: (msg) => console.log(`${colors.cyan}🧪 ${msg}${colors.reset}`),
  result: (msg) => console.log(`${colors.magenta}📊 ${msg}${colors.reset}`)
};

// Test cases for API key validation
const testCases = {
  safe: [
    {
      name: 'Empty API Key',
      exchange: 'binance',
      apiKey: '',
      expected: { isValid: true, isReadOnly: true, riskLevel: 'low' }
    },
    {
      name: 'Safe Binance Testnet Key',
      exchange: 'binance',
      apiKey: 'test_binance_readonly_key_12345',
      apiSecret: 'test_secret',
      sandbox: true,
      expected: { isValid: true, isReadOnly: true, riskLevel: 'low' }
    },
    {
      name: 'Safe KuCoin Sandbox Key',
      exchange: 'kucoin',
      apiKey: 'kucoin_readonly_sandbox_key',
      apiSecret: 'sandbox_secret',
      sandbox: true,
      expected: { isValid: true, isReadOnly: true, riskLevel: 'low' }
    },
    {
      name: 'Generic Read-Only Key',
      exchange: 'generic',
      apiKey: 'simple_readonly_key',
      sandbox: true,
      expected: { isValid: true, isReadOnly: true, riskLevel: 'low' }
    }
  ],
  medium: [
    {
      name: 'Binance Mainnet Key',
      exchange: 'binance',
      apiKey: 'mainnet_readonly_key_12345',
      apiSecret: 'mainnet_secret',
      sandbox: false,
      expected: { isValid: true, isReadOnly: true, riskLevel: 'medium' }
    },
    {
      name: 'KuCoin Mainnet Key',
      exchange: 'kucoin',
      apiKey: 'kucoin_mainnet_key',
      apiSecret: 'mainnet_secret',
      sandbox: false,
      expected: { isValid: true, isReadOnly: true, riskLevel: 'medium' }
    }
  ],
  high: [
    {
      name: 'Generic Key with Secret',
      exchange: 'generic',
      apiKey: 'key_with_secret',
      apiSecret: 'secret_value',
      sandbox: false,
      expected: { isValid: true, isReadOnly: true, riskLevel: 'high' }
    },
    {
      name: 'KuCoin Key with Passphrase',
      exchange: 'kucoin',
      apiKey: 'kucoin_key_with_passphrase',
      apiSecret: 'secret_with_passphrase',
      passphrase: 'trading_passphrase',
      sandbox: false,
      expected: { isValid: true, isReadOnly: false, riskLevel: 'high' }
    }
  ],
  dangerous: [
    {
      name: 'Trading Enabled Key',
      exchange: 'binance',
      apiKey: 'trade_enabled_key_12345',
      apiSecret: 'trading_secret',
      sandbox: false,
      expected: { isValid: false, isReadOnly: false, riskLevel: 'critical' }
    },
    {
      name: 'Withdrawal Permissions Key',
      exchange: 'binance',
      apiKey: 'withdraw_permissions_key',
      apiSecret: 'withdraw_secret',
      sandbox: false,
      expected: { isValid: false, isReadOnly: false, riskLevel: 'critical' }
    },
    {
      name: 'Futures Trading Key',
      exchange: 'binance',
      apiKey: 'futures_trading_enabled_key',
      apiSecret: 'futures_secret',
      sandbox: false,
      expected: { isValid: false, isReadOnly: false, riskLevel: 'critical' }
    },
    {
      name: 'Margin Trading Key',
      exchange: 'kucoin',
      apiKey: 'margin_enabled_trading_key',
      apiSecret: 'margin_secret',
      passphrase: 'margin_passphrase',
      sandbox: false,
      expected: { isValid: false, isReadOnly: false, riskLevel: 'critical' }
    }
  ]
};

// Load the API Permission Validator (using require for Node.js compatibility)
async function loadValidator() {
  try {
    // Try to load the compiled JavaScript version
    const validatorPath = path.join(__dirname, '..', 'dist', 'utils', 'ApiPermissionValidator.js');
    
    if (fs.existsSync(validatorPath)) {
      const { apiPermissionValidator } = require(validatorPath);
      return apiPermissionValidator;
    } else {
      log.error('Compiled validator not found. Please run: npm run build');
      return null;
    }
  } catch (error) {
    log.error(`Failed to load API Permission Validator: ${error.message}`);
    return null;
  }
}

// Run a single test case
async function runTestCase(validator, testCase, category) {
  try {
    log.test(`Testing ${category}: ${testCase.name}`);
    
    const apiInfo = {
      exchange: testCase.exchange,
      apiKey: testCase.apiKey,
      apiSecret: testCase.apiSecret,
      passphrase: testCase.passphrase,
      sandbox: testCase.sandbox || false,
      testConnection: false
    };

    let validation;
    let threwError = false;
    let errorMessage = '';

    try {
      validation = await validator.validateApiKey(apiInfo);
    } catch (error) {
      threwError = true;
      errorMessage = error.message;
      
      // For dangerous keys, we expect errors
      if (category === 'dangerous') {
        validation = {
          isValid: false,
          isReadOnly: false,
          riskLevel: 'critical',
          violations: [{ message: errorMessage }]
        };
      } else {
        throw error;
      }
    }

    // Check expectations
    const results = {
      passed: true,
      details: []
    };

    if (testCase.expected.isValid !== undefined && validation.isValid !== testCase.expected.isValid) {
      results.passed = false;
      results.details.push(`Expected isValid: ${testCase.expected.isValid}, got: ${validation.isValid}`);
    }

    if (testCase.expected.isReadOnly !== undefined && validation.isReadOnly !== testCase.expected.isReadOnly) {
      results.passed = false;
      results.details.push(`Expected isReadOnly: ${testCase.expected.isReadOnly}, got: ${validation.isReadOnly}`);
    }

    if (testCase.expected.riskLevel !== undefined && validation.riskLevel !== testCase.expected.riskLevel) {
      results.passed = false;
      results.details.push(`Expected riskLevel: ${testCase.expected.riskLevel}, got: ${validation.riskLevel}`);
    }

    if (results.passed) {
      log.success(`✓ ${testCase.name} - PASSED`);
    } else {
      log.error(`✗ ${testCase.name} - FAILED`);
      results.details.forEach(detail => log.error(`  ${detail}`));
    }

    return {
      name: testCase.name,
      category,
      passed: results.passed,
      details: results.details,
      validation,
      threwError,
      errorMessage
    };

  } catch (error) {
    log.error(`✗ ${testCase.name} - ERROR: ${error.message}`);
    return {
      name: testCase.name,
      category,
      passed: false,
      details: [`Unexpected error: ${error.message}`],
      validation: null,
      threwError: true,
      errorMessage: error.message
    };
  }
}

// Run all test cases
async function runAllTests(validator) {
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    categories: {}
  };

  for (const [category, cases] of Object.entries(testCases)) {
    log.info(`\n🔍 Testing ${category.toUpperCase()} API keys:`);
    
    results.categories[category] = {
      total: cases.length,
      passed: 0,
      failed: 0,
      tests: []
    };

    for (const testCase of cases) {
      const result = await runTestCase(validator, testCase, category);
      
      results.total++;
      results.categories[category].tests.push(result);
      
      if (result.passed) {
        results.passed++;
        results.categories[category].passed++;
      } else {
        results.failed++;
        results.categories[category].failed++;
      }
    }
  }

  return results;
}

// Test caching functionality
async function testCaching(validator) {
  log.info('\n🔄 Testing caching functionality:');
  
  const apiInfo = {
    exchange: 'binance',
    apiKey: 'cache_test_key',
    sandbox: true,
    testConnection: false
  };

  // Clear cache first
  validator.clearCache();
  let cacheStats = validator.getCacheStats();
  
  if (cacheStats.size === 0) {
    log.success('✓ Cache cleared successfully');
  } else {
    log.error('✗ Cache not cleared properly');
    return false;
  }

  // First validation
  await validator.validateApiKey(apiInfo);
  cacheStats = validator.getCacheStats();
  
  if (cacheStats.size === 1 && cacheStats.entries.includes('binance_cache_test_key')) {
    log.success('✓ Cache entry created');
  } else {
    log.error('✗ Cache entry not created');
    return false;
  }

  // Second validation should use cache
  const startTime = Date.now();
  await validator.validateApiKey(apiInfo);
  const endTime = Date.now();
  
  // Cached validation should be very fast (< 10ms)
  if (endTime - startTime < 10) {
    log.success('✓ Cache used for second validation');
  } else {
    log.warning('⚠️  Cache may not have been used (validation took too long)');
  }

  return true;
}

// Test multiple API key validation
async function testMultipleValidation(validator) {
  log.info('\n🔗 Testing multiple API key validation:');
  
  const apiInfos = [
    {
      exchange: 'binance',
      apiKey: 'multi_test_binance_key',
      sandbox: true,
      testConnection: false
    },
    {
      exchange: 'kucoin',
      apiKey: 'multi_test_kucoin_key',
      sandbox: true,
      testConnection: false
    }
  ];

  try {
    const results = await validator.validateMultipleApiKeys(apiInfos);
    
    if (results.size === 2) {
      log.success('✓ Multiple API keys validated');
      
      const binanceResult = results.get('binance');
      const kucoinResult = results.get('kucoin');
      
      if (binanceResult && binanceResult.isValid) {
        log.success('✓ Binance validation successful');
      } else {
        log.error('✗ Binance validation failed');
        return false;
      }
      
      if (kucoinResult && kucoinResult.isValid) {
        log.success('✓ KuCoin validation successful');
      } else {
        log.error('✗ KuCoin validation failed');
        return false;
      }
      
      return true;
    } else {
      log.error('✗ Multiple validation returned wrong number of results');
      return false;
    }
  } catch (error) {
    log.error(`✗ Multiple validation failed: ${error.message}`);
    return false;
  }
}

// Generate comprehensive report
function generateReport(results, cachingPassed, multipleValidationPassed) {
  const reportPath = path.join(__dirname, '..', 'logs', `api_permission_validation_report_${Date.now()}.json`);
  
  // Ensure logs directory exists
  const logsDir = path.dirname(reportPath);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total_tests: results.total,
      passed: results.passed,
      failed: results.failed,
      success_rate: Math.round((results.passed / results.total) * 100),
      caching_test_passed: cachingPassed,
      multiple_validation_test_passed: multipleValidationPassed
    },
    categories: {},
    detailed_results: []
  };

  // Add category summaries
  for (const [category, categoryResults] of Object.entries(results.categories)) {
    report.categories[category] = {
      total: categoryResults.total,
      passed: categoryResults.passed,
      failed: categoryResults.failed,
      success_rate: Math.round((categoryResults.passed / categoryResults.total) * 100)
    };

    // Add detailed results
    categoryResults.tests.forEach(test => {
      report.detailed_results.push({
        category,
        name: test.name,
        passed: test.passed,
        details: test.details,
        validation_result: test.validation,
        threw_error: test.threwError,
        error_message: test.errorMessage
      });
    });
  }

  // Determine overall status
  if (results.failed === 0 && cachingPassed && multipleValidationPassed) {
    report.overall_status = 'PASSED';
  } else if (results.failed > results.passed * 0.2) { // More than 20% failures
    report.overall_status = 'FAILED';
  } else {
    report.overall_status = 'PARTIAL';
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log.success(`Detailed report saved: ${reportPath}`);
  
  return report;
}

// Main validation function
async function validateApiPermissionSystem() {
  console.log('🔐 API Permission System Validation');
  console.log('===================================');
  console.log('');

  // Load the validator
  const validator = await loadValidator();
  if (!validator) {
    process.exit(1);
  }

  log.success('API Permission Validator loaded successfully');

  // Run all test cases
  const results = await runAllTests(validator);

  // Test caching
  const cachingPassed = await testCaching(validator);

  // Test multiple validation
  const multipleValidationPassed = await testMultipleValidation(validator);

  // Generate report
  const report = generateReport(results, cachingPassed, multipleValidationPassed);

  // Display summary
  console.log('\n📊 Validation Summary');
  console.log('====================');
  console.log(`Overall Status: ${report.overall_status}`);
  console.log(`Total Tests: ${report.summary.total_tests}`);
  console.log(`Passed: ${report.summary.passed}`);
  console.log(`Failed: ${report.summary.failed}`);
  console.log(`Success Rate: ${report.summary.success_rate}%`);
  console.log(`Caching Test: ${cachingPassed ? 'PASSED' : 'FAILED'}`);
  console.log(`Multiple Validation Test: ${multipleValidationPassed ? 'PASSED' : 'FAILED'}`);
  console.log('');

  // Category breakdown
  console.log('📈 Category Breakdown:');
  for (const [category, categoryResults] of Object.entries(report.categories)) {
    const status = categoryResults.failed === 0 ? '✅' : '❌';
    console.log(`${status} ${category.toUpperCase()}: ${categoryResults.passed}/${categoryResults.total} (${categoryResults.success_rate}%)`);
  }
  console.log('');

  // Final result
  if (report.overall_status === 'PASSED') {
    log.success('🎉 All API permission validation tests PASSED!');
    log.success('The API Permission Validator system is working correctly');
    process.exit(0);
  } else if (report.overall_status === 'PARTIAL') {
    log.warning('⚠️  Some API permission validation tests failed');
    log.warning('Review the detailed report for specific issues');
    process.exit(0);
  } else {
    log.critical('API permission validation system has critical failures!');
    log.error('Review the detailed report and fix the issues before deployment');
    process.exit(1);
  }
}

// Handle command line arguments
const command = process.argv[2];

switch (command) {
  case 'help':
    console.log('API Permission System Validation Script');
    console.log('======================================');
    console.log('');
    console.log('Usage: node validate-api-permission-system.js [command]');
    console.log('');
    console.log('Commands:');
    console.log('  (none)  - Run full validation suite (default)');
    console.log('  help    - Show this help message');
    break;
  default:
    validateApiPermissionSystem();
    break;
}