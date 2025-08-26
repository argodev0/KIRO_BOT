#!/usr/bin/env node

/**
 * API Key Permissions Validation Script
 * Validates that exchange API keys have only READ-ONLY permissions
 */

const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// Logging functions
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  critical: (msg) => console.log(`${colors.red}🚨 CRITICAL: ${msg}${colors.reset}`),
};

// Load environment variables
function loadEnvironment() {
  const envPath = path.join(__dirname, '..', '.env.production');
  
  if (!fs.existsSync(envPath)) {
    log.error('Production environment file not found: .env.production');
    return null;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key] = valueParts.join('=');
      }
    }
  });
  
  return env;
}

// Binance API signature
function createBinanceSignature(queryString, secret) {
  return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
}

// KuCoin API signature
function createKuCoinSignature(timestamp, method, requestPath, body, secret) {
  const message = timestamp + method + requestPath + body;
  return crypto.createHmac('sha256', secret).update(message).digest('base64');
}

// Make HTTPS request
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: response, headers: res.headers });
        } catch (error) {
          resolve({ statusCode: res.statusCode, data: data, headers: res.headers });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

// Validate Binance API permissions
async function validateBinancePermissions(apiKey, apiSecret) {
  log.info('Validating Binance API permissions...');
  
  try {
    // Test account info endpoint (requires API key)
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = createBinanceSignature(queryString, apiSecret);
    
    const options = {
      hostname: 'api.binance.com',
      port: 443,
      path: `/api/v3/account?${queryString}&signature=${signature}`,
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Content-Type': 'application/json'
      }
    };
    
    const response = await makeRequest(options);
    
    if (response.statusCode === 200) {
      log.success('Binance API key is valid and has account access');
      
      // Check if account has trading permissions by examining the response
      if (response.data.canTrade === false) {
        log.success('Binance API key has READ-ONLY permissions (canTrade: false)');
        return { valid: true, readOnly: true, permissions: response.data };
      } else if (response.data.canTrade === true) {
        log.critical('Binance API key has TRADING permissions - SECURITY RISK!');
        return { valid: true, readOnly: false, permissions: response.data };
      } else {
        log.warning('Cannot determine Binance trading permissions from response');
        return { valid: true, readOnly: null, permissions: response.data };
      }
    } else {
      log.error(`Binance API validation failed: ${response.statusCode}`);
      log.error(`Response: ${JSON.stringify(response.data)}`);
      return { valid: false, readOnly: null, error: response.data };
    }
    
  } catch (error) {
    log.error(`Binance API validation error: ${error.message}`);
    return { valid: false, readOnly: null, error: error.message };
  }
}

// Validate KuCoin API permissions
async function validateKuCoinPermissions(apiKey, apiSecret, passphrase) {
  log.info('Validating KuCoin API permissions...');
  
  try {
    // Test account info endpoint
    const timestamp = Date.now().toString();
    const method = 'GET';
    const requestPath = '/api/v1/accounts';
    const body = '';
    
    const signature = createKuCoinSignature(timestamp, method, requestPath, body, apiSecret);
    const passphraseSignature = crypto.createHmac('sha256', passphrase).update(apiSecret).digest('base64');
    
    const options = {
      hostname: 'api.kucoin.com',
      port: 443,
      path: requestPath,
      method: method,
      headers: {
        'KC-API-KEY': apiKey,
        'KC-API-SIGN': signature,
        'KC-API-TIMESTAMP': timestamp,
        'KC-API-PASSPHRASE': passphraseSignature,
        'KC-API-KEY-VERSION': '2',
        'Content-Type': 'application/json'
      }
    };
    
    const response = await makeRequest(options);
    
    if (response.statusCode === 200 && response.data.code === '200000') {
      log.success('KuCoin API key is valid and has account access');
      
      // Test trading endpoint to check permissions
      const tradingTestOptions = {
        hostname: 'api.kucoin.com',
        port: 443,
        path: '/api/v1/orders/test',
        method: 'POST',
        headers: {
          'KC-API-KEY': apiKey,
          'KC-API-SIGN': signature,
          'KC-API-TIMESTAMP': timestamp,
          'KC-API-PASSPHRASE': passphraseSignature,
          'KC-API-KEY-VERSION': '2',
          'Content-Type': 'application/json'
        }
      };
      
      const testOrderData = JSON.stringify({
        clientOid: 'test-' + Date.now(),
        side: 'buy',
        symbol: 'BTC-USDT',
        type: 'limit',
        size: '0.001',
        price: '1'
      });
      
      try {
        const tradingResponse = await makeRequest(tradingTestOptions, testOrderData);
        
        if (tradingResponse.statusCode === 403 || 
            (tradingResponse.data.code && tradingResponse.data.code.includes('permission'))) {
          log.success('KuCoin API key has READ-ONLY permissions (trading blocked)');
          return { valid: true, readOnly: true, accounts: response.data.data };
        } else {
          log.critical('KuCoin API key has TRADING permissions - SECURITY RISK!');
          return { valid: true, readOnly: false, accounts: response.data.data };
        }
      } catch (tradingError) {
        log.success('KuCoin API key appears to have READ-only permissions (trading test failed)');
        return { valid: true, readOnly: true, accounts: response.data.data };
      }
      
    } else {
      log.error(`KuCoin API validation failed: ${response.statusCode}`);
      log.error(`Response: ${JSON.stringify(response.data)}`);
      return { valid: false, readOnly: null, error: response.data };
    }
    
  } catch (error) {
    log.error(`KuCoin API validation error: ${error.message}`);
    return { valid: false, readOnly: null, error: error.message };
  }
}

// Test paper trading API endpoint
async function testPaperTradingEndpoint() {
  log.info('Testing paper trading API endpoint...');
  
  try {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/config/trading-mode',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const response = await makeRequest(options);
    
    if (response.statusCode === 200) {
      if (response.data.mode === 'paper_trading' || 
          JSON.stringify(response.data).includes('paper_trading')) {
        log.success('Paper trading mode confirmed via API');
        return { paperTradingEnabled: true, response: response.data };
      } else {
        log.critical('Paper trading mode NOT confirmed via API');
        return { paperTradingEnabled: false, response: response.data };
      }
    } else {
      log.warning('Cannot reach paper trading API endpoint');
      return { paperTradingEnabled: null, error: 'API not accessible' };
    }
    
  } catch (error) {
    log.warning(`Paper trading API test error: ${error.message}`);
    return { paperTradingEnabled: null, error: error.message };
  }
}

// Generate validation report
function generateReport(results) {
  const reportPath = path.join(__dirname, '..', 'logs', `api_permissions_report_${Date.now()}.json`);
  
  // Ensure logs directory exists
  const logsDir = path.dirname(reportPath);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  const report = {
    timestamp: new Date().toISOString(),
    overall_status: 'UNKNOWN',
    critical_issues: 0,
    warnings: 0,
    results: results
  };
  
  // Determine overall status
  let criticalIssues = 0;
  let warnings = 0;
  
  if (results.binance && results.binance.valid && results.binance.readOnly === false) {
    criticalIssues++;
  }
  
  if (results.kucoin && results.kucoin.valid && results.kucoin.readOnly === false) {
    criticalIssues++;
  }
  
  if (results.paperTrading && results.paperTrading.paperTradingEnabled === false) {
    criticalIssues++;
  }
  
  if (results.binance && !results.binance.valid) {
    warnings++;
  }
  
  if (results.kucoin && !results.kucoin.valid) {
    warnings++;
  }
  
  report.critical_issues = criticalIssues;
  report.warnings = warnings;
  
  if (criticalIssues > 0) {
    report.overall_status = 'CRITICAL';
  } else if (warnings > 0) {
    report.overall_status = 'WARNING';
  } else {
    report.overall_status = 'SAFE';
  }
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log.success(`Validation report saved: ${reportPath}`);
  
  return report;
}

// Main validation function
async function validateApiPermissions() {
  console.log('🔐 API Key Permissions Validation');
  console.log('=================================');
  console.log('');
  
  const env = loadEnvironment();
  if (!env) {
    process.exit(1);
  }
  
  const results = {};
  
  // Validate Binance API
  if (env.BINANCE_API_KEY && env.BINANCE_API_SECRET) {
    log.info('Phase 1: Binance API Validation');
    results.binance = await validateBinancePermissions(env.BINANCE_API_KEY, env.BINANCE_API_SECRET);
    console.log('');
  } else {
    log.warning('Binance API credentials not found in environment');
    results.binance = { valid: false, readOnly: null, error: 'Credentials not configured' };
  }
  
  // Validate KuCoin API
  if (env.KUCOIN_API_KEY && env.KUCOIN_API_SECRET && env.KUCOIN_PASSPHRASE) {
    log.info('Phase 2: KuCoin API Validation');
    results.kucoin = await validateKuCoinPermissions(
      env.KUCOIN_API_KEY, 
      env.KUCOIN_API_SECRET, 
      env.KUCOIN_PASSPHRASE
    );
    console.log('');
  } else {
    log.warning('KuCoin API credentials not found in environment');
    results.kucoin = { valid: false, readOnly: null, error: 'Credentials not configured' };
  }
  
  // Test paper trading endpoint
  log.info('Phase 3: Paper Trading API Validation');
  results.paperTrading = await testPaperTradingEndpoint();
  console.log('');
  
  // Generate report
  const report = generateReport(results);
  
  // Display summary
  console.log('📊 Validation Summary');
  console.log('====================');
  console.log(`Overall Status: ${report.overall_status}`);
  console.log(`Critical Issues: ${report.critical_issues}`);
  console.log(`Warnings: ${report.warnings}`);
  console.log('');
  
  // Detailed results
  if (results.binance) {
    const status = results.binance.readOnly === true ? '✅ READ-ONLY' : 
                   results.binance.readOnly === false ? '🚨 TRADING ENABLED' : '⚠️  UNKNOWN';
    console.log(`Binance API: ${status}`);
  }
  
  if (results.kucoin) {
    const status = results.kucoin.readOnly === true ? '✅ READ-ONLY' : 
                   results.kucoin.readOnly === false ? '🚨 TRADING ENABLED' : '⚠️  UNKNOWN';
    console.log(`KuCoin API: ${status}`);
  }
  
  if (results.paperTrading) {
    const status = results.paperTrading.paperTradingEnabled === true ? '✅ ENABLED' : 
                   results.paperTrading.paperTradingEnabled === false ? '🚨 DISABLED' : '⚠️  UNKNOWN';
    console.log(`Paper Trading: ${status}`);
  }
  
  console.log('');
  
  // Final result
  if (report.critical_issues > 0) {
    log.critical('CRITICAL SECURITY ISSUES DETECTED!');
    log.error('Trading permissions found - this violates paper trading safety');
    log.error('Please use READ-ONLY API keys for production deployment');
    process.exit(1);
  } else if (report.warnings > 0) {
    log.warning('Some API validations failed - check configuration');
    process.exit(0);
  } else {
    log.success('🎉 All API permissions are safe for paper trading!');
    process.exit(0);
  }
}

// Handle command line arguments
const command = process.argv[2];

switch (command) {
  case 'binance':
    const env = loadEnvironment();
    if (env && env.BINANCE_API_KEY && env.BINANCE_API_SECRET) {
      validateBinancePermissions(env.BINANCE_API_KEY, env.BINANCE_API_SECRET)
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    } else {
      log.error('Binance API credentials not found');
      process.exit(1);
    }
    break;
  case 'kucoin':
    const envKu = loadEnvironment();
    if (envKu && envKu.KUCOIN_API_KEY && envKu.KUCOIN_API_SECRET && envKu.KUCOIN_PASSPHRASE) {
      validateKuCoinPermissions(envKu.KUCOIN_API_KEY, envKu.KUCOIN_API_SECRET, envKu.KUCOIN_PASSPHRASE)
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    } else {
      log.error('KuCoin API credentials not found');
      process.exit(1);
    }
    break;
  case 'paper-trading':
    testPaperTradingEndpoint()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
    break;
  case 'help':
    console.log('API Key Permissions Validation Script');
    console.log('=====================================');
    console.log('');
    console.log('Usage: node validate-api-permissions.js [test_type]');
    console.log('');
    console.log('Test Types:');
    console.log('  (none)        - Run all validations (default)');
    console.log('  binance       - Validate Binance API only');
    console.log('  kucoin        - Validate KuCoin API only');
    console.log('  paper-trading - Test paper trading endpoint only');
    console.log('  help          - Show this help message');
    break;
  default:
    validateApiPermissions();
    break;
}