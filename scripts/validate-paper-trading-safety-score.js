#!/usr/bin/env node

/**
 * Paper Trading Safety Score Validation Script
 * Validates that the paper trading safety score exceeds 90%
 * Provides detailed reporting and recommendations for improvement
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
  console.log(colorize(`✓ ${message}`, 'green'));
}

function logWarning(message) {
  console.log(colorize(`⚠ ${message}`, 'yellow'));
}

function logError(message) {
  console.log(colorize(`✗ ${message}`, 'red'));
}

function logInfo(message) {
  console.log(colorize(`ℹ ${message}`, 'blue'));
}

class PaperTradingSafetyScoreValidator {
  constructor() {
    this.MINIMUM_SAFETY_SCORE = 90;
    this.MAX_TOTAL_SCORE = 100;
    this.violations = [];
    this.recommendations = [];
    this.report = null;
  }

  /**
   * Main validation function
   */
  async validateSafetyScore() {
    logSection('PAPER TRADING SAFETY SCORE VALIDATION');
    
    try {
      // Load environment variables
      this.loadEnvironmentVariables();
      
      // Calculate comprehensive safety score
      const report = await this.calculateComprehensiveSafetyScore();
      this.report = report;
      
      // Display results
      this.displayResults();
      
      // Save report
      this.saveReport();
      
      // Return success/failure
      return report.passed;
      
    } catch (error) {
      logError(`Validation failed: ${error.message}`);
      console.error(error);
      return false;
    }
  }

  /**
   * Load environment variables from .env.production
   */
  loadEnvironmentVariables() {
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

  /**
   * Calculate comprehensive safety score
   */
  async calculateComprehensiveSafetyScore() {
    logInfo('Calculating comprehensive paper trading safety score...');
    
    const components = {
      environment: this.calculateEnvironmentScore(),
      paperTradingGuard: this.calculatePaperTradingGuardScore(),
      apiPermissions: this.calculateApiPermissionsScore(),
      systemIntegrity: this.calculateSystemIntegrityScore(),
      productionSafety: this.calculateProductionSafetyScore()
    };
    
    const totalScore = Object.values(components).reduce((sum, comp) => sum + comp.score, 0);
    const maxScore = Object.values(components).reduce((sum, comp) => sum + comp.maxScore, 0);
    const percentage = Math.round((totalScore / maxScore) * 100);
    const passed = percentage >= this.MINIMUM_SAFETY_SCORE;
    
    return {
      totalScore,
      maxScore,
      percentage,
      passed,
      minimumRequired: this.MINIMUM_SAFETY_SCORE,
      components,
      violations: this.violations,
      recommendations: this.recommendations,
      lastValidation: Date.now()
    };
  }

  /**
   * Calculate environment safety score (30 points)
   */
  calculateEnvironmentScore() {
    logInfo('Evaluating environment safety...');
    
    const maxScore = 30;
    let score = maxScore;
    
    // Check TRADING_SIMULATION_ONLY
    if (process.env.TRADING_SIMULATION_ONLY !== 'true') {
      this.addViolation('TRADING_SIMULATION_ONLY_MISSING', 'critical', 
        'TRADING_SIMULATION_ONLY must be set to true', 'environment');
      score -= 10;
    } else {
      logSuccess('TRADING_SIMULATION_ONLY is properly set');
    }
    
    // Check PAPER_TRADING_MODE
    if (process.env.PAPER_TRADING_MODE !== 'true') {
      this.addViolation('PAPER_TRADING_MODE_DISABLED', 'critical',
        'PAPER_TRADING_MODE must be enabled', 'environment');
      score -= 10;
    } else {
      logSuccess('PAPER_TRADING_MODE is enabled');
    }
    
    // Check ALLOW_REAL_TRADES
    if (process.env.ALLOW_REAL_TRADES === 'true') {
      this.addViolation('REAL_TRADES_ENABLED', 'critical',
        'ALLOW_REAL_TRADES must be disabled', 'environment');
      score -= 15;
    } else {
      logSuccess('Real trades are disabled');
    }
    
    // Check for dangerous variables
    const dangerousVars = this.detectDangerousVariables();
    if (dangerousVars.length > 0) {
      this.addViolation('DANGEROUS_VARIABLES_DETECTED', 'critical',
        `Dangerous variables detected: ${dangerousVars.join(', ')}`, 'environment');
      score -= 10;
    } else {
      logSuccess('No dangerous environment variables detected');
    }
    
    // Check NODE_ENV
    if (process.env.NODE_ENV !== 'production') {
      this.addViolation('NODE_ENV_NOT_PRODUCTION', 'medium',
        'NODE_ENV should be set to production', 'environment');
      score -= 2;
    } else {
      logSuccess('NODE_ENV is set to production');
    }
    
    return { score: Math.max(0, score), maxScore, passed: score >= (maxScore * 0.9) };
  }

  /**
   * Calculate paper trading guard score (25 points)
   */
  calculatePaperTradingGuardScore() {
    logInfo('Evaluating paper trading guard configuration...');
    
    const maxScore = 25;
    let score = maxScore;
    
    // Check if paper trading guard files exist
    const guardFiles = [
      'src/middleware/paperTradingGuard.ts',
      'src/middleware/environmentSafety.ts',
      'src/services/PaperTradingSafetyMonitor.ts'
    ];
    
    for (const file of guardFiles) {
      const filePath = path.join(__dirname, '..', file);
      if (!fs.existsSync(filePath)) {
        this.addViolation('PAPER_TRADING_GUARD_FILE_MISSING', 'critical',
          `Paper trading guard file missing: ${file}`, 'paperTradingGuard');
        score -= 8;
      } else {
        logSuccess(`Paper trading guard file exists: ${file}`);
      }
    }
    
    // Check FORCE_PAPER_TRADING
    if (process.env.FORCE_PAPER_TRADING !== 'true') {
      this.addViolation('FORCE_PAPER_TRADING_DISABLED', 'high',
        'FORCE_PAPER_TRADING should be enabled', 'paperTradingGuard');
      score -= 5;
    } else {
      logSuccess('FORCE_PAPER_TRADING is enabled');
    }
    
    // Check PAPER_TRADING_VALIDATION
    if (process.env.PAPER_TRADING_VALIDATION !== 'strict') {
      this.addViolation('PAPER_TRADING_VALIDATION_NOT_STRICT', 'medium',
        'PAPER_TRADING_VALIDATION should be set to strict', 'paperTradingGuard');
      score -= 3;
    } else {
      logSuccess('PAPER_TRADING_VALIDATION is set to strict');
    }
    
    return { score: Math.max(0, score), maxScore, passed: score >= (maxScore * 0.9) };
  }

  /**
   * Calculate API permissions score (20 points)
   */
  calculateApiPermissionsScore() {
    logInfo('Evaluating API permissions configuration...');
    
    const maxScore = 20;
    let score = maxScore;
    
    // Check Binance configuration
    const binanceApiKey = process.env.BINANCE_API_KEY;
    const binanceReadOnly = process.env.BINANCE_READ_ONLY === 'true';
    
    if (binanceApiKey && binanceApiKey.trim() !== '') {
      if (!binanceReadOnly) {
        this.addViolation('BINANCE_NOT_READ_ONLY', 'critical',
          'Binance API key is not configured as read-only', 'apiPermissions');
        score -= 8;
      } else {
        logSuccess('Binance API key is configured as read-only');
      }
    } else {
      logSuccess('No Binance API key configured (safer)');
    }
    
    // Check KuCoin configuration
    const kucoinApiKey = process.env.KUCOIN_API_KEY;
    const kucoinReadOnly = process.env.KUCOIN_READ_ONLY === 'true';
    
    if (kucoinApiKey && kucoinApiKey.trim() !== '') {
      if (!kucoinReadOnly) {
        this.addViolation('KUCOIN_NOT_READ_ONLY', 'critical',
          'KuCoin API key is not configured as read-only', 'apiPermissions');
        score -= 8;
      } else {
        logSuccess('KuCoin API key is configured as read-only');
      }
    } else {
      logSuccess('No KuCoin API key configured (safer)');
    }
    
    // Check for API secrets (dangerous)
    const dangerousSecrets = ['BINANCE_API_SECRET', 'KUCOIN_API_SECRET', 'COINBASE_API_SECRET'];
    for (const secretVar of dangerousSecrets) {
      const secretValue = process.env[secretVar];
      if (secretValue && secretValue.trim() !== '' && !secretValue.startsWith('your-')) {
        this.addViolation('API_SECRET_DETECTED', 'critical',
          `Dangerous API secret detected: ${secretVar}`, 'apiPermissions');
        score -= 10;
      }
    }
    
    if (score === maxScore) {
      logSuccess('API permissions are properly configured');
    }
    
    return { score: Math.max(0, score), maxScore, passed: score >= (maxScore * 0.9) };
  }

  /**
   * Calculate system integrity score (15 points)
   */
  calculateSystemIntegrityScore() {
    logInfo('Evaluating system integrity...');
    
    const maxScore = 15;
    let score = maxScore;
    
    // Check virtual balance configuration
    const virtualBalanceUSD = process.env.VIRTUAL_BALANCE_USD;
    if (!virtualBalanceUSD || parseFloat(virtualBalanceUSD) <= 0) {
      this.addViolation('VIRTUAL_BALANCE_NOT_SET', 'medium',
        'Virtual balance is not properly configured', 'systemIntegrity');
      score -= 3;
    } else {
      logSuccess(`Virtual balance configured: $${virtualBalanceUSD}`);
    }
    
    // Check audit logging
    const auditLogEnabled = process.env.PAPER_TRADE_AUDIT_LOG === 'true';
    const auditLoggingEnabled = process.env.AUDIT_LOGGING_ENABLED === 'true';
    
    if (!auditLogEnabled || !auditLoggingEnabled) {
      this.addViolation('AUDIT_TRAIL_INCOMPLETE', 'medium',
        'Audit trail is not fully configured', 'systemIntegrity');
      score -= 4;
    } else {
      logSuccess('Audit logging is properly configured');
    }
    
    // Check monitoring
    const monitoringEnabled = process.env.MONITORING_ENABLED === 'true';
    const metricsEnabled = process.env.METRICS_ENABLED === 'true';
    
    if (!monitoringEnabled || !metricsEnabled) {
      this.addViolation('MONITORING_NOT_ACTIVE', 'medium',
        'System monitoring is not fully active', 'systemIntegrity');
      score -= 4;
    } else {
      logSuccess('System monitoring is active');
    }
    
    // Check security monitoring
    const securityMonitoringEnabled = process.env.SECURITY_MONITORING_ENABLED === 'true';
    if (!securityMonitoringEnabled) {
      this.addViolation('SECURITY_MONITORING_DISABLED', 'medium',
        'Security monitoring is not enabled', 'systemIntegrity');
      score -= 2;
    } else {
      logSuccess('Security monitoring is enabled');
    }
    
    return { score: Math.max(0, score), maxScore, passed: score >= (maxScore * 0.9) };
  }

  /**
   * Calculate production safety score (10 points)
   */
  calculateProductionSafetyScore() {
    logInfo('Evaluating production safety configuration...');
    
    const maxScore = 10;
    let score = maxScore;
    
    // Check FORCE_PAPER_TRADING
    if (process.env.FORCE_PAPER_TRADING !== 'true') {
      this.addViolation('PAPER_TRADING_NOT_FORCED', 'high',
        'Paper trading is not forced in production', 'productionSafety');
      score -= 3;
    } else {
      logSuccess('Paper trading is forced');
    }
    
    // Check security hardening
    const securityHardeningEnabled = process.env.SECURITY_HARDENING_ENABLED === 'true';
    if (!securityHardeningEnabled) {
      this.addViolation('SECURITY_HARDENING_DISABLED', 'medium',
        'Security hardening is not enabled', 'productionSafety');
      score -= 2;
    } else {
      logSuccess('Security hardening is enabled');
    }
    
    // Check alerting
    const criticalAlertEnabled = process.env.CRITICAL_ALERT_ENABLED === 'true';
    if (!criticalAlertEnabled) {
      this.addViolation('CRITICAL_ALERTS_DISABLED', 'medium',
        'Critical alerts are not enabled', 'productionSafety');
      score -= 2;
    } else {
      logSuccess('Critical alerts are enabled');
    }
    
    // Check SSL configuration
    const sslEnabled = process.env.SSL_ENABLED === 'true';
    if (!sslEnabled) {
      this.addViolation('SSL_NOT_ENABLED', 'medium',
        'SSL is not enabled', 'productionSafety');
      score -= 2;
    } else {
      logSuccess('SSL is enabled');
    }
    
    // Check HSTS
    const hstsEnabled = process.env.HSTS_ENABLED === 'true';
    if (!hstsEnabled) {
      this.addViolation('HSTS_NOT_ENABLED', 'low',
        'HSTS is not enabled', 'productionSafety');
      score -= 1;
    } else {
      logSuccess('HSTS is enabled');
    }
    
    return { score: Math.max(0, score), maxScore, passed: score >= (maxScore * 0.9) };
  }

  /**
   * Detect dangerous environment variables
   */
  detectDangerousVariables() {
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
    
    const detected = [];
    for (const varName of dangerousVars) {
      const value = process.env[varName];
      if (value && value.trim() !== '' && !value.startsWith('your-')) {
        detected.push(varName);
      }
    }
    
    return detected;
  }

  /**
   * Add violation to the list
   */
  addViolation(type, severity, message, component) {
    this.violations.push({ type, severity, message, component });
    
    if (severity === 'critical') {
      logError(`CRITICAL: ${message}`);
    } else if (severity === 'high') {
      logWarning(`HIGH: ${message}`);
    } else if (severity === 'medium') {
      logWarning(`MEDIUM: ${message}`);
    } else {
      logInfo(`LOW: ${message}`);
    }
  }

  /**
   * Display validation results
   */
  displayResults() {
    logSection('SAFETY SCORE VALIDATION RESULTS');
    
    const report = this.report;
    
    // Display overall score
    console.log('\n' + colorize('Overall Safety Score:', 'bright'));
    const scoreColor = report.passed ? 'green' : 'red';
    console.log(colorize(`  ${report.percentage}% (${report.totalScore}/${report.maxScore} points)`, scoreColor));
    console.log(colorize(`  Minimum Required: ${report.minimumRequired}%`, 'blue'));
    console.log(colorize(`  Status: ${report.passed ? 'PASSED' : 'FAILED'}`, scoreColor));
    
    // Display component scores
    console.log('\n' + colorize('Component Breakdown:', 'bright'));
    for (const [componentName, component] of Object.entries(report.components)) {
      const componentColor = component.passed ? 'green' : 'red';
      const percentage = Math.round((component.score / component.maxScore) * 100);
      console.log(colorize(`  ${componentName}: ${percentage}% (${component.score}/${component.maxScore})`, componentColor));
    }
    
    // Display violations
    if (report.violations.length > 0) {
      console.log('\n' + colorize('Security Violations:', 'bright'));
      const criticalViolations = report.violations.filter(v => v.severity === 'critical');
      const highViolations = report.violations.filter(v => v.severity === 'high');
      const mediumViolations = report.violations.filter(v => v.severity === 'medium');
      const lowViolations = report.violations.filter(v => v.severity === 'low');
      
      if (criticalViolations.length > 0) {
        console.log(colorize(`  Critical: ${criticalViolations.length}`, 'red'));
        criticalViolations.forEach(v => console.log(colorize(`    - ${v.message}`, 'red')));
      }
      
      if (highViolations.length > 0) {
        console.log(colorize(`  High: ${highViolations.length}`, 'yellow'));
        highViolations.forEach(v => console.log(colorize(`    - ${v.message}`, 'yellow')));
      }
      
      if (mediumViolations.length > 0) {
        console.log(colorize(`  Medium: ${mediumViolations.length}`, 'yellow'));
        mediumViolations.forEach(v => console.log(colorize(`    - ${v.message}`, 'yellow')));
      }
      
      if (lowViolations.length > 0) {
        console.log(colorize(`  Low: ${lowViolations.length}`, 'blue'));
        lowViolations.forEach(v => console.log(colorize(`    - ${v.message}`, 'blue')));
      }
    } else {
      console.log('\n' + colorize('No security violations detected!', 'green'));
    }
    
    // Display recommendations
    if (report.recommendations.length > 0) {
      console.log('\n' + colorize('Recommendations:', 'bright'));
      report.recommendations.forEach(rec => {
        console.log(colorize(`  • ${rec}`, 'cyan'));
      });
    }
    
    // Final status
    console.log('\n' + colorize('Final Status:', 'bright'));
    if (report.passed) {
      logSuccess(`Paper trading safety score validation PASSED (${report.percentage}%)`);
      logSuccess('System is safe for paper trading operation');
    } else {
      logError(`Paper trading safety score validation FAILED (${report.percentage}%)`);
      logError(`Score must be at least ${report.minimumRequired}% to pass`);
      logError('System is NOT safe for operation - fix violations before deployment');
    }
  }

  /**
   * Save validation report
   */
  saveReport() {
    const reportPath = path.join(__dirname, '..', 'paper-trading-safety-score-report.json');
    
    try {
      fs.writeFileSync(reportPath, JSON.stringify(this.report, null, 2));
      logSuccess(`Validation report saved to: ${reportPath}`);
    } catch (error) {
      logWarning(`Failed to save report: ${error.message}`);
    }
  }
}

// Main execution
async function main() {
  const validator = new PaperTradingSafetyScoreValidator();
  
  try {
    const passed = await validator.validateSafetyScore();
    
    if (passed) {
      console.log('\n' + colorize('🎉 PAPER TRADING SAFETY VALIDATION SUCCESSFUL! 🎉', 'green'));
      process.exit(0);
    } else {
      console.log('\n' + colorize('❌ PAPER TRADING SAFETY VALIDATION FAILED! ❌', 'red'));
      console.log(colorize('Fix the violations above before proceeding with deployment.', 'red'));
      process.exit(1);
    }
  } catch (error) {
    console.error('\n' + colorize('💥 VALIDATION ERROR! 💥', 'red'));
    console.error(colorize(error.message, 'red'));
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { PaperTradingSafetyScoreValidator };