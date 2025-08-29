#!/usr/bin/env node

/**
 * Final Paper Trading Safety Score Validation
 * Comprehensive validation that the system achieves 90%+ safety score
 * This script is the final check for the deployment readiness task
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function logSection(title) {
  console.log('\n' + colorize('='.repeat(80), 'cyan'));
  console.log(colorize(`  ${title}`, 'cyan'));
  console.log(colorize('='.repeat(80), 'cyan'));
}

function logSuccess(message) {
  console.log(colorize(`✅ ${message}`, 'green'));
}

function logWarning(message) {
  console.log(colorize(`⚠️  ${message}`, 'yellow'));
}

function logError(message) {
  console.log(colorize(`❌ ${message}`, 'red'));
}

function logInfo(message) {
  console.log(colorize(`ℹ️  ${message}`, 'blue'));
}

async function validateFinalSafetyScore() {
  logSection('FINAL PAPER TRADING SAFETY SCORE VALIDATION');
  
  try {
    // Load environment variables
    loadEnvironmentVariables();
    
    // Run the main validation script
    logInfo('Running comprehensive safety score validation...');
    const { spawn } = require('child_process');
    
    const validationProcess = spawn('node', ['scripts/validate-paper-trading-safety-score.js'], {
      cwd: __dirname + '/..',
      stdio: 'pipe'
    });
    
    let output = '';
    let errorOutput = '';
    
    validationProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    validationProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    const exitCode = await new Promise((resolve) => {
      validationProcess.on('close', resolve);
    });
    
    if (exitCode === 0) {
      logSuccess('Primary safety score validation PASSED');
      
      // Parse the output to extract the safety score
      const scoreMatch = output.match(/(\d+)%\s*\(\d+\/\d+\s*points\)/);
      const safetyScore = scoreMatch ? parseInt(scoreMatch[1]) : 0;
      
      if (safetyScore >= 90) {
        logSuccess(`Safety score: ${safetyScore}% (meets 90% requirement)`);
        
        // Additional validations
        await performAdditionalValidations();
        
        // Generate final report
        generateFinalReport(safetyScore, true);
        
        logSection('FINAL VALIDATION RESULT');
        console.log(colorize('🎉 PAPER TRADING SAFETY SCORE VALIDATION SUCCESSFUL! 🎉', 'green'));
        console.log(colorize(`✅ Safety Score: ${safetyScore}% (Required: 90%)`, 'green'));
        console.log(colorize('✅ System is SAFE for paper trading operation', 'green'));
        console.log(colorize('✅ Deployment readiness: APPROVED', 'green'));
        
        return true;
      } else {
        logError(`Safety score ${safetyScore}% is below required 90%`);
        generateFinalReport(safetyScore, false);
        return false;
      }
    } else {
      logError('Primary safety score validation FAILED');
      console.log('Validation output:', output);
      console.log('Error output:', errorOutput);
      generateFinalReport(0, false);
      return false;
    }
    
  } catch (error) {
    logError(`Final validation failed: ${error.message}`);
    console.error(error);
    generateFinalReport(0, false);
    return false;
  }
}

function loadEnvironmentVariables() {
  logInfo('Loading environment configuration...');
  
  const envPath = path.join(__dirname, '..', '.env.production');
  
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.production file not found');
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n');
  
  for (const line of envLines) {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=');
        process.env[key] = value;
      }
    }
  }
  
  logSuccess('Environment configuration loaded');
}

async function performAdditionalValidations() {
  logInfo('Performing additional safety validations...');
  
  // Check critical environment variables
  const criticalVars = {
    'TRADING_SIMULATION_ONLY': 'true',
    'PAPER_TRADING_MODE': 'true',
    'ALLOW_REAL_TRADES': 'false',
    'FORCE_PAPER_TRADING': 'true',
    'PAPER_TRADING_VALIDATION': 'strict'
  };
  
  let allCriticalVarsPassed = true;
  
  for (const [varName, expectedValue] of Object.entries(criticalVars)) {
    const actualValue = process.env[varName];
    if (actualValue === expectedValue) {
      logSuccess(`${varName} = ${actualValue} ✓`);
    } else {
      logError(`${varName} = ${actualValue} (expected: ${expectedValue}) ✗`);
      allCriticalVarsPassed = false;
    }
  }
  
  // Check for dangerous variables
  const dangerousVars = [
    'BINANCE_API_SECRET',
    'KUCOIN_API_SECRET',
    'COINBASE_API_SECRET',
    'ENABLE_REAL_TRADING',
    'PRODUCTION_TRADING',
    'ALLOW_WITHDRAWALS',
    'ENABLE_WITHDRAWALS',
    'REAL_MONEY_MODE',
    'LIVE_TRADING_MODE'
  ];
  
  let noDangerousVars = true;
  
  for (const varName of dangerousVars) {
    const value = process.env[varName];
    if (value && value.trim() !== '' && !value.startsWith('your-')) {
      logError(`Dangerous variable detected: ${varName}`);
      noDangerousVars = false;
    }
  }
  
  if (noDangerousVars) {
    logSuccess('No dangerous environment variables detected');
  }
  
  // Check file existence
  const requiredFiles = [
    'src/services/PaperTradingSafetyScoreValidator.ts',
    'src/middleware/safetyScoreEnforcement.ts',
    'src/middleware/paperTradingGuard.ts',
    'src/middleware/environmentSafety.ts',
    'src/services/PaperTradingSafetyMonitor.ts',
    'src/utils/EnvironmentValidator.ts'
  ];
  
  let allFilesExist = true;
  
  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      logSuccess(`Required file exists: ${file}`);
    } else {
      logError(`Required file missing: ${file}`);
      allFilesExist = false;
    }
  }
  
  // Check production configuration
  const productionChecks = {
    'NODE_ENV': 'production',
    'MONITORING_ENABLED': 'true',
    'SECURITY_HARDENING_ENABLED': 'true',
    'AUDIT_LOGGING_ENABLED': 'true',
    'SSL_ENABLED': 'true'
  };
  
  let allProductionChecksPassed = true;
  
  for (const [varName, expectedValue] of Object.entries(productionChecks)) {
    const actualValue = process.env[varName];
    if (actualValue === expectedValue) {
      logSuccess(`Production check: ${varName} = ${actualValue} ✓`);
    } else {
      logWarning(`Production check: ${varName} = ${actualValue} (expected: ${expectedValue})`);
      // Don't fail for production checks, just warn
    }
  }
  
  if (allCriticalVarsPassed && noDangerousVars && allFilesExist) {
    logSuccess('All additional validations passed');
  } else {
    throw new Error('Additional validations failed');
  }
}

function generateFinalReport(safetyScore, passed) {
  const report = {
    timestamp: new Date().toISOString(),
    safetyScore: safetyScore,
    minimumRequired: 90,
    passed: passed,
    status: passed ? 'SAFE' : 'UNSAFE',
    deploymentReady: passed,
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      TRADING_SIMULATION_ONLY: process.env.TRADING_SIMULATION_ONLY,
      PAPER_TRADING_MODE: process.env.PAPER_TRADING_MODE,
      ALLOW_REAL_TRADES: process.env.ALLOW_REAL_TRADES,
      FORCE_PAPER_TRADING: process.env.FORCE_PAPER_TRADING,
      PAPER_TRADING_VALIDATION: process.env.PAPER_TRADING_VALIDATION
    },
    validation: {
      primaryValidation: passed,
      additionalValidations: passed,
      criticalEnvironmentVariables: passed,
      noDangerousVariables: passed,
      requiredFilesExist: passed,
      productionConfiguration: passed
    },
    summary: passed ? 
      'Paper trading safety score validation PASSED. System is safe for deployment.' :
      'Paper trading safety score validation FAILED. System is NOT safe for deployment.'
  };
  
  const reportPath = path.join(__dirname, '..', 'final-safety-score-validation-report.json');
  
  try {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    logSuccess(`Final validation report saved to: ${reportPath}`);
  } catch (error) {
    logWarning(`Failed to save final report: ${error.message}`);
  }
}

// Main execution
async function main() {
  try {
    const passed = await validateFinalSafetyScore();
    
    if (passed) {
      console.log('\n' + colorize('🎉 FINAL PAPER TRADING SAFETY VALIDATION SUCCESSFUL! 🎉', 'green'));
      console.log(colorize('✅ System is ready for deployment with 90%+ safety score', 'green'));
      process.exit(0);
    } else {
      console.log('\n' + colorize('❌ FINAL PAPER TRADING SAFETY VALIDATION FAILED! ❌', 'red'));
      console.log(colorize('🚫 System is NOT ready for deployment', 'red'));
      process.exit(1);
    }
  } catch (error) {
    console.error('\n' + colorize('💥 FINAL VALIDATION ERROR! 💥', 'red'));
    console.error(colorize(error.message, 'red'));
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { validateFinalSafetyScore };