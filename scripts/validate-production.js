#!/usr/bin/env node

/**
 * Production Configuration Validation Script
 * 
 * This script validates the production environment configuration
 * to ensure all critical settings are properly configured for
 * safe paper trading deployment.
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Logging functions
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  critical: (msg) => console.log(`${colors.red}🚨 CRITICAL: ${msg}${colors.reset}`),
};

// Load environment variables from .env.production
function loadProductionEnv() {
  const envPath = path.join(__dirname, '..', '.env.production');
  
  if (!fs.existsSync(envPath)) {
    log.error('Production environment file not found: .env.production');
    log.info('Copy .env.production.template to .env.production and configure it');
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

// Validation functions
const validators = {
  // Critical paper trading safety validation
  paperTradingSafety: (env) => {
    const errors = [];
    
    if (env.PAPER_TRADING_MODE !== 'true') {
      errors.push('PAPER_TRADING_MODE must be "true" for production safety');
    }
    
    if (env.ALLOW_REAL_TRADES === 'true') {
      errors.push('ALLOW_REAL_TRADES must be "false" for production safety');
    }
    
    if (env.FORCE_PAPER_TRADING !== 'true') {
      errors.push('FORCE_PAPER_TRADING must be "true" for production safety');
    }
    
    if (!['strict', 'moderate'].includes(env.PAPER_TRADING_VALIDATION)) {
      errors.push('PAPER_TRADING_VALIDATION must be "strict" or "moderate"');
    }
    
    return errors;
  },
  
  // Exchange API safety validation
  exchangeApiSafety: (env) => {
    const errors = [];
    
    // Binance validation
    if (env.BINANCE_SANDBOX === 'true') {
      errors.push('BINANCE_SANDBOX must be "false" for mainnet data');
    }
    
    if (env.BINANCE_MAINNET !== 'true') {
      errors.push('BINANCE_MAINNET must be "true" for production');
    }
    
    if (env.BINANCE_READ_ONLY !== 'true') {
      errors.push('BINANCE_READ_ONLY must be "true" for paper trading safety');
    }
    
    // KuCoin validation
    if (env.KUCOIN_SANDBOX === 'true') {
      errors.push('KUCOIN_SANDBOX must be "false" for mainnet data');
    }
    
    if (env.KUCOIN_MAINNET !== 'true') {
      errors.push('KUCOIN_MAINNET must be "true" for production');
    }
    
    if (env.KUCOIN_READ_ONLY !== 'true') {
      errors.push('KUCOIN_READ_ONLY must be "true" for paper trading safety');
    }
    
    return errors;
  },
  
  // SSL configuration validation
  sslConfiguration: (env) => {
    const errors = [];
    
    if (env.SSL_ENABLED !== 'true') {
      errors.push('SSL_ENABLED must be "true" for production');
    }
    
    if (!env.DOMAIN_NAME || env.DOMAIN_NAME === 'your-domain.com') {
      errors.push('DOMAIN_NAME must be set to your actual domain');
    }
    
    if (!env.LETSENCRYPT_EMAIL || env.LETSENCRYPT_EMAIL === 'your-email@example.com') {
      errors.push('LETSENCRYPT_EMAIL must be set to your actual email');
    }
    
    return errors;
  },
  
  // Security configuration validation
  securityConfiguration: (env) => {
    const errors = [];
    
    if (env.NODE_ENV !== 'production') {
      errors.push('NODE_ENV must be "production"');
    }
    
    if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long');
    }
    
    if (env.JWT_SECRET === 'your-super-secret-jwt-key-at-least-32-characters-long') {
      errors.push('JWT_SECRET must be changed from the template default');
    }
    
    if (!env.POSTGRES_PASSWORD || env.POSTGRES_PASSWORD.length < 12) {
      errors.push('POSTGRES_PASSWORD must be at least 12 characters long');
    }
    
    if (env.POSTGRES_PASSWORD === 'your-strong-postgres-password-here') {
      errors.push('POSTGRES_PASSWORD must be changed from the template default');
    }
    
    if (env.HELMET_ENABLED !== 'true') {
      errors.push('HELMET_ENABLED must be "true" for security');
    }
    
    if (env.CSRF_PROTECTION !== 'true') {
      errors.push('CSRF_PROTECTION must be "true" for security');
    }
    
    const bcryptRounds = parseInt(env.BCRYPT_ROUNDS);
    if (isNaN(bcryptRounds) || bcryptRounds < 12) {
      errors.push('BCRYPT_ROUNDS must be at least 12 for production');
    }
    
    return errors;
  },
  
  // Database configuration validation
  databaseConfiguration: (env) => {
    const errors = [];
    
    if (!env.DATABASE_URL || !env.DATABASE_URL.startsWith('postgresql://')) {
      errors.push('DATABASE_URL must be a valid PostgreSQL connection string');
    }
    
    if (env.DATABASE_SSL !== 'true') {
      errors.push('DATABASE_SSL must be "true" for production');
    }
    
    const poolSize = parseInt(env.DATABASE_POOL_SIZE);
    if (isNaN(poolSize) || poolSize < 10 || poolSize > 50) {
      errors.push('DATABASE_POOL_SIZE should be between 10-50 for production');
    }
    
    return errors;
  },
  
  // Monitoring configuration validation
  monitoringConfiguration: (env) => {
    const errors = [];
    
    if (env.METRICS_ENABLED !== 'true') {
      errors.push('METRICS_ENABLED must be "true" for production monitoring');
    }
    
    if (env.HEALTH_CHECK_ENABLED !== 'true') {
      errors.push('HEALTH_CHECK_ENABLED must be "true" for production');
    }
    
    if (!['error', 'warn', 'info', 'debug'].includes(env.LOG_LEVEL)) {
      errors.push('LOG_LEVEL must be one of: error, warn, info, debug');
    }
    
    if (!['json', 'text'].includes(env.LOG_FORMAT)) {
      errors.push('LOG_FORMAT must be "json" or "text"');
    }
    
    return errors;
  },
  
  // API key validation (basic checks)
  apiKeyValidation: (env) => {
    const warnings = [];
    
    if (!env.BINANCE_API_KEY || env.BINANCE_API_KEY === 'your-binance-read-only-api-key') {
      warnings.push('BINANCE_API_KEY should be set to your actual Binance API key');
    }
    
    if (!env.KUCOIN_API_KEY || env.KUCOIN_API_KEY === 'your-kucoin-read-only-api-key') {
      warnings.push('KUCOIN_API_KEY should be set to your actual KuCoin API key');
    }
    
    return warnings;
  },
};

// Main validation function
function validateProductionConfig() {
  log.info('🔍 Validating production configuration...');
  console.log('');
  
  const env = loadProductionEnv();
  if (!env) {
    return false;
  }
  
  let hasErrors = false;
  let hasWarnings = false;
  
  // Run all validations
  const validationResults = [
    { name: 'Paper Trading Safety', validator: validators.paperTradingSafety, critical: true },
    { name: 'Exchange API Safety', validator: validators.exchangeApiSafety, critical: true },
    { name: 'SSL Configuration', validator: validators.sslConfiguration, critical: false },
    { name: 'Security Configuration', validator: validators.securityConfiguration, critical: true },
    { name: 'Database Configuration', validator: validators.databaseConfiguration, critical: false },
    { name: 'Monitoring Configuration', validator: validators.monitoringConfiguration, critical: false },
    { name: 'API Key Validation', validator: validators.apiKeyValidation, critical: false },
  ];
  
  validationResults.forEach(({ name, validator, critical }) => {
    log.info(`Validating ${name}...`);
    
    const issues = validator(env);
    
    if (issues.length === 0) {
      log.success(`${name} validation passed`);
    } else {
      issues.forEach(issue => {
        if (critical) {
          log.critical(issue);
          hasErrors = true;
        } else {
          log.warning(issue);
          hasWarnings = true;
        }
      });
    }
    
    console.log('');
  });
  
  // Summary
  console.log('🏁 Validation Summary');
  console.log('====================');
  
  if (hasErrors) {
    log.critical('Configuration validation FAILED');
    log.error('Critical errors must be fixed before deployment');
    return false;
  } else if (hasWarnings) {
    log.warning('Configuration validation passed with warnings');
    log.warning('Consider addressing warnings before deployment');
    return true;
  } else {
    log.success('Configuration validation PASSED');
    log.success('✅ Paper trading safety confirmed');
    log.success('✅ Exchange API safety confirmed');
    log.success('✅ Security configuration validated');
    log.success('Ready for production deployment!');
    return true;
  }
}

// Additional validation functions
function validateDockerFiles() {
  log.info('🐳 Validating Docker configuration...');
  
  const requiredFiles = [
    'docker/docker-compose.prod.yml',
    'docker/Dockerfile.backend',
    'docker/Dockerfile.frontend',
    'docker/nginx/production.conf',
  ];
  
  const missingFiles = requiredFiles.filter(file => {
    const filePath = path.join(__dirname, '..', file);
    return !fs.existsSync(filePath);
  });
  
  if (missingFiles.length > 0) {
    log.error('Missing Docker configuration files:');
    missingFiles.forEach(file => log.error(`  - ${file}`));
    return false;
  }
  
  log.success('Docker configuration files found');
  return true;
}

function validateScripts() {
  log.info('📜 Validating deployment scripts...');
  
  const requiredScripts = [
    'scripts/deploy-production.sh',
    'docker/scripts/ssl-setup.sh',
    'docker/scripts/ssl-renew.sh',
  ];
  
  const missingScripts = requiredScripts.filter(script => {
    const scriptPath = path.join(__dirname, '..', script);
    return !fs.existsSync(scriptPath);
  });
  
  if (missingScripts.length > 0) {
    log.error('Missing deployment scripts:');
    missingScripts.forEach(script => log.error(`  - ${script}`));
    return false;
  }
  
  log.success('Deployment scripts found');
  return true;
}

// Main execution
function main() {
  console.log('🚀 AI Crypto Trading Bot - Production Configuration Validation');
  console.log('==============================================================');
  console.log('');
  
  const configValid = validateProductionConfig();
  const dockerValid = validateDockerFiles();
  const scriptsValid = validateScripts();
  
  console.log('');
  
  if (configValid && dockerValid && scriptsValid) {
    log.success('🎉 All validations passed! Ready for production deployment.');
    log.info('Next steps:');
    log.info('  1. Run: ./scripts/deploy-production.sh');
    log.info('  2. Monitor deployment logs');
    log.info('  3. Verify paper trading mode is active');
    process.exit(0);
  } else {
    log.error('❌ Validation failed. Please fix the issues above before deployment.');
    process.exit(1);
  }
}

// Handle command line arguments
const command = process.argv[2];

switch (command) {
  case 'config':
    validateProductionConfig() ? process.exit(0) : process.exit(1);
    break;
  case 'docker':
    validateDockerFiles() ? process.exit(0) : process.exit(1);
    break;
  case 'scripts':
    validateScripts() ? process.exit(0) : process.exit(1);
    break;
  case 'help':
    console.log('Production Configuration Validation Script');
    console.log('=========================================');
    console.log('');
    console.log('Usage: node validate-production.js [command]');
    console.log('');
    console.log('Commands:');
    console.log('  (none)   - Run all validations (default)');
    console.log('  config   - Validate configuration only');
    console.log('  docker   - Validate Docker files only');
    console.log('  scripts  - Validate deployment scripts only');
    console.log('  help     - Show this help message');
    break;
  default:
    main();
    break;
}