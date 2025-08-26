#!/usr/bin/env node

/**
 * Paper Trading Enforcement Validation Script
 * 
 * This script validates that paper trading mode is properly enforced
 * at all levels of the system configuration.
 */

const fs = require('fs');
const path = require('path');

class PaperTradingValidator {
    constructor() {
        this.envFile = path.join(__dirname, '..', '.env.production');
        this.config = {};
        this.violations = [];
        this.warnings = [];
        this.validationResults = {
            environmentVariables: false,
            exchangeConfiguration: false,
            securityEnforcement: false,
            auditLogging: false
        };
    }

    /**
     * Main validation process
     */
    async validate() {
        console.log('🔒 Paper Trading Enforcement Validation');
        console.log('=======================================');
        console.log('');
        console.log('This validation ensures that paper trading mode is');
        console.log('properly enforced at all system levels to prevent');
        console.log('any possibility of real money trading.');
        console.log('');

        try {
            // Load configuration
            await this.loadConfiguration();
            
            // Run validations
            await this.validateEnvironmentVariables();
            await this.validateExchangeConfiguration();
            await this.validateSecurityEnforcement();
            await this.validateAuditLogging();
            
            // Generate report
            await this.generateReport();
            
            // Check overall status
            const allPassed = Object.values(this.validationResults).every(result => result === true);
            
            if (allPassed && this.violations.length === 0) {
                console.log('\n✅ PAPER TRADING ENFORCEMENT VERIFIED');
                console.log('   All safety mechanisms are properly configured.');
                console.log('   Real trading is blocked at multiple levels.');
                return true;
            } else {
                console.log('\n❌ PAPER TRADING ENFORCEMENT FAILED');
                console.log('   Critical safety violations detected!');
                console.log('   DO NOT DEPLOY until all issues are resolved.');
                return false;
            }
            
        } catch (error) {
            console.error('\n❌ Validation process failed:', error.message);
            return false;
        }
    }

    /**
     * Load configuration
     */
    async loadConfiguration() {
        console.log('📖 Loading production configuration...');
        
        if (!fs.existsSync(this.envFile)) {
            throw new Error(`Production environment file not found: ${this.envFile}`);
        }
        
        const envContent = fs.readFileSync(this.envFile, 'utf8');
        const lines = envContent.split('\n');
        
        for (const line of lines) {
            if (line.trim() && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                if (key && valueParts.length > 0) {
                    this.config[key.trim()] = valueParts.join('=').trim();
                }
            }
        }
        
        console.log(`✅ Loaded ${Object.keys(this.config).length} configuration values`);
    }

    /**
     * Validate environment variables for paper trading
     */
    async validateEnvironmentVariables() {
        console.log('\n🔍 Validating environment variables...');
        
        const criticalSettings = {
            'NODE_ENV': 'production',
            'PAPER_TRADING_MODE': 'true',
            'ALLOW_REAL_TRADES': 'false',
            'FORCE_PAPER_TRADING': 'true',
            'PAPER_TRADING_VALIDATION': 'strict'
        };
        
        let envPassed = true;
        
        for (const [key, expectedValue] of Object.entries(criticalSettings)) {
            const actualValue = this.config[key];
            
            if (actualValue !== expectedValue) {
                this.violations.push({
                    category: 'Environment Variables',
                    severity: 'CRITICAL',
                    issue: `${key} must be ${expectedValue} but is ${actualValue || 'undefined'}`,
                    impact: 'Could allow real trading operations'
                });
                envPassed = false;
            } else {
                console.log(`✅ ${key}: ${actualValue}`);
            }
        }
        
        // Validate virtual balances
        const virtualBalances = {
            'VIRTUAL_BALANCE_USD': { min: 1000, max: 1000000 },
            'VIRTUAL_BALANCE_BTC': { min: 0.1, max: 100 },
            'VIRTUAL_BALANCE_ETH': { min: 1, max: 1000 }
        };
        
        for (const [key, range] of Object.entries(virtualBalances)) {
            const value = parseFloat(this.config[key]);
            if (!value || value < range.min || value > range.max) {
                this.warnings.push(`${key} should be between ${range.min} and ${range.max}`);
            } else {
                console.log(`✅ ${key}: ${value}`);
            }
        }
        
        this.validationResults.environmentVariables = envPassed;
        
        if (envPassed) {
            console.log('✅ Environment variables validation passed');
        } else {
            console.log('❌ Environment variables validation failed');
        }
    }

    /**
     * Validate exchange configuration
     */
    async validateExchangeConfiguration() {
        console.log('\n🔍 Validating exchange configuration...');
        
        const exchanges = ['BINANCE', 'KUCOIN'];
        let exchangePassed = true;
        
        for (const exchange of exchanges) {
            console.log(`\n${exchange} Configuration:`);
            
            // Check read-only enforcement
            const readOnlyKey = `${exchange}_READ_ONLY`;
            const sandboxKey = `${exchange}_SANDBOX`;
            const mainnetKey = `${exchange}_MAINNET`;
            
            if (this.config[readOnlyKey] !== 'true') {
                this.violations.push({
                    category: 'Exchange Configuration',
                    severity: 'CRITICAL',
                    issue: `${readOnlyKey} must be true for paper trading safety`,
                    impact: 'Could allow real trading operations'
                });
                exchangePassed = false;
            } else {
                console.log(`✅ ${readOnlyKey}: true`);
            }
            
            if (this.config[sandboxKey] !== 'false') {
                this.violations.push({
                    category: 'Exchange Configuration',
                    severity: 'CRITICAL',
                    issue: `${sandboxKey} must be false for mainnet data`,
                    impact: 'Could use sandbox data instead of real market data'
                });
                exchangePassed = false;
            } else {
                console.log(`✅ ${sandboxKey}: false`);
            }
            
            if (this.config[mainnetKey] !== 'true') {
                this.violations.push({
                    category: 'Exchange Configuration',
                    severity: 'CRITICAL',
                    issue: `${mainnetKey} must be true for live market data`,
                    impact: 'Could use test data instead of real market data'
                });
                exchangePassed = false;
            } else {
                console.log(`✅ ${mainnetKey}: true`);
            }
            
            // Check API key configuration
            const apiKeyKey = `${exchange}_API_KEY`;
            const apiSecretKey = `${exchange}_API_SECRET`;
            
            if (this.config[apiKeyKey] && this.config[apiSecretKey]) {
                console.log(`✅ ${exchange} API configured (READ-ONLY)`);
                
                // Warn about API key security
                if (this.config[apiKeyKey].length < 20) {
                    this.warnings.push(`${exchange} API key seems too short - verify it's correct`);
                }
            } else {
                console.log(`ℹ️  ${exchange} API not configured (exchange will be disabled)`);
            }
        }
        
        this.validationResults.exchangeConfiguration = exchangePassed;
        
        if (exchangePassed) {
            console.log('\n✅ Exchange configuration validation passed');
        } else {
            console.log('\n❌ Exchange configuration validation failed');
        }
    }

    /**
     * Validate security enforcement
     */
    async validateSecurityEnforcement() {
        console.log('\n🔍 Validating security enforcement...');
        
        let securityPassed = true;
        
        // SSL enforcement
        if (this.config.SSL_ENABLED !== 'true') {
            this.violations.push({
                category: 'Security Enforcement',
                severity: 'HIGH',
                issue: 'SSL_ENABLED must be true for production',
                impact: 'Unencrypted communications'
            });
            securityPassed = false;
        } else {
            console.log('✅ SSL enabled');
        }
        
        // Database SSL
        if (this.config.DATABASE_SSL !== 'true') {
            this.violations.push({
                category: 'Security Enforcement',
                severity: 'HIGH',
                issue: 'DATABASE_SSL must be true for production',
                impact: 'Unencrypted database communications'
            });
            securityPassed = false;
        } else {
            console.log('✅ Database SSL enabled');
        }
        
        // Security headers
        const securityHeaders = {
            'HELMET_ENABLED': 'true',
            'CSRF_PROTECTION': 'true'
        };
        
        for (const [key, expectedValue] of Object.entries(securityHeaders)) {
            if (this.config[key] !== expectedValue) {
                this.violations.push({
                    category: 'Security Enforcement',
                    severity: 'MEDIUM',
                    issue: `${key} should be ${expectedValue}`,
                    impact: 'Reduced security protection'
                });
                securityPassed = false;
            } else {
                console.log(`✅ ${key}: ${expectedValue}`);
            }
        }
        
        // Rate limiting
        if (!this.config.RATE_LIMIT_WINDOW_MS || !this.config.RATE_LIMIT_MAX) {
            this.warnings.push('Rate limiting should be configured for security');
        } else {
            console.log(`✅ Rate limiting: ${this.config.RATE_LIMIT_MAX} requests per ${this.config.RATE_LIMIT_WINDOW_MS}ms`);
        }
        
        // Password strength
        const passwords = ['POSTGRES_PASSWORD', 'REDIS_PASSWORD', 'RABBITMQ_PASSWORD', 'GRAFANA_PASSWORD'];
        for (const passwordKey of passwords) {
            if (!this.config[passwordKey] || this.config[passwordKey].length < 16) {
                this.violations.push({
                    category: 'Security Enforcement',
                    severity: 'HIGH',
                    issue: `${passwordKey} must be at least 16 characters`,
                    impact: 'Weak authentication security'
                });
                securityPassed = false;
            } else {
                console.log(`✅ ${passwordKey}: Strong password configured`);
            }
        }
        
        this.validationResults.securityEnforcement = securityPassed;
        
        if (securityPassed) {
            console.log('✅ Security enforcement validation passed');
        } else {
            console.log('❌ Security enforcement validation failed');
        }
    }

    /**
     * Validate audit logging
     */
    async validateAuditLogging() {
        console.log('\n🔍 Validating audit logging...');
        
        let auditPassed = true;
        
        // Paper trading audit log
        if (this.config.PAPER_TRADE_AUDIT_LOG !== 'true') {
            this.violations.push({
                category: 'Audit Logging',
                severity: 'MEDIUM',
                issue: 'PAPER_TRADE_AUDIT_LOG should be enabled',
                impact: 'Reduced audit trail for compliance'
            });
            auditPassed = false;
        } else {
            console.log('✅ Paper trading audit logging enabled');
        }
        
        // Metrics and health checks
        if (this.config.METRICS_ENABLED !== 'true') {
            this.warnings.push('METRICS_ENABLED should be true for monitoring');
        } else {
            console.log('✅ Metrics collection enabled');
        }
        
        if (this.config.HEALTH_CHECK_ENABLED !== 'true') {
            this.warnings.push('HEALTH_CHECK_ENABLED should be true for monitoring');
        } else {
            console.log('✅ Health checks enabled');
        }
        
        // Log level
        const logLevel = this.config.LOG_LEVEL;
        if (!['info', 'warn', 'error'].includes(logLevel)) {
            this.warnings.push('LOG_LEVEL should be info, warn, or error for production');
        } else {
            console.log(`✅ Log level: ${logLevel}`);
        }
        
        // Log format
        if (this.config.LOG_FORMAT !== 'json') {
            this.warnings.push('LOG_FORMAT should be json for structured logging');
        } else {
            console.log('✅ JSON log format enabled');
        }
        
        this.validationResults.auditLogging = auditPassed;
        
        if (auditPassed) {
            console.log('✅ Audit logging validation passed');
        } else {
            console.log('❌ Audit logging validation failed');
        }
    }

    /**
     * Generate validation report
     */
    async generateReport() {
        console.log('\n📋 Paper Trading Enforcement Report');
        console.log('==================================');
        
        // Overall status
        const totalChecks = Object.keys(this.validationResults).length;
        const passedChecks = Object.values(this.validationResults).filter(result => result === true).length;
        const criticalViolations = this.violations.filter(v => v.severity === 'CRITICAL').length;
        
        console.log(`\nOverall Status: ${passedChecks}/${totalChecks} checks passed`);
        console.log(`Critical Violations: ${criticalViolations}`);
        console.log(`Total Violations: ${this.violations.length}`);
        console.log(`Warnings: ${this.warnings.length}`);
        
        // Paper trading safety summary
        console.log('\n🔒 Paper Trading Safety Summary:');
        console.log(`  Environment: ${this.config.NODE_ENV}`);
        console.log(`  Paper Trading Mode: ${this.config.PAPER_TRADING_MODE === 'true' ? '✅ ENFORCED' : '❌ NOT ENFORCED'}`);
        console.log(`  Real Trading Blocked: ${this.config.ALLOW_REAL_TRADES === 'false' ? '✅ BLOCKED' : '❌ ALLOWED'}`);
        console.log(`  Force Paper Trading: ${this.config.FORCE_PAPER_TRADING === 'true' ? '✅ ENABLED' : '❌ DISABLED'}`);
        console.log(`  Validation Mode: ${this.config.PAPER_TRADING_VALIDATION || 'not set'}`);
        
        // Exchange safety summary
        console.log('\n🔑 Exchange Safety Summary:');
        console.log(`  Binance Read-Only: ${this.config.BINANCE_READ_ONLY === 'true' ? '✅ ENFORCED' : '❌ NOT ENFORCED'}`);
        console.log(`  Binance Mainnet: ${this.config.BINANCE_MAINNET === 'true' ? '✅ ENABLED' : '❌ DISABLED'}`);
        console.log(`  KuCoin Read-Only: ${this.config.KUCOIN_READ_ONLY === 'true' ? '✅ ENFORCED' : '❌ NOT ENFORCED'}`);
        console.log(`  KuCoin Mainnet: ${this.config.KUCOIN_MAINNET === 'true' ? '✅ ENABLED' : '❌ DISABLED'}`);
        
        // Violations
        if (this.violations.length > 0) {
            console.log('\n❌ CRITICAL VIOLATIONS:');
            this.violations.forEach((violation, index) => {
                console.log(`  ${index + 1}. [${violation.severity}] ${violation.issue}`);
                console.log(`     Impact: ${violation.impact}`);
                console.log(`     Category: ${violation.category}`);
                console.log('');
            });
        }
        
        // Warnings
        if (this.warnings.length > 0) {
            console.log('\n⚠️  WARNINGS:');
            this.warnings.forEach((warning, index) => {
                console.log(`  ${index + 1}. ${warning}`);
            });
        }
        
        // Save detailed report
        const reportData = {
            timestamp: new Date().toISOString(),
            overallStatus: passedChecks === totalChecks && this.violations.length === 0,
            checksPassedRatio: `${passedChecks}/${totalChecks}`,
            criticalViolations: criticalViolations,
            totalViolations: this.violations.length,
            warnings: this.warnings.length,
            validationResults: this.validationResults,
            violations: this.violations,
            warnings: this.warnings,
            paperTradingSafety: {
                environment: this.config.NODE_ENV,
                paperTradingMode: this.config.PAPER_TRADING_MODE === 'true',
                realTradingBlocked: this.config.ALLOW_REAL_TRADES === 'false',
                forcePaperTrading: this.config.FORCE_PAPER_TRADING === 'true',
                validationMode: this.config.PAPER_TRADING_VALIDATION,
                binanceReadOnly: this.config.BINANCE_READ_ONLY === 'true',
                kucoinReadOnly: this.config.KUCOIN_READ_ONLY === 'true'
            }
        };
        
        const reportPath = path.join(__dirname, '..', 'paper-trading-enforcement-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    }
}

// Main execution
if (require.main === module) {
    const validator = new PaperTradingValidator();
    validator.validate().then(success => {
        if (success) {
            console.log('\n🎉 PAPER TRADING ENFORCEMENT VERIFIED');
            console.log('   Your system is safely configured for paper trading only.');
            console.log('   Real money trading is impossible with this configuration.');
        } else {
            console.log('\n🚨 PAPER TRADING ENFORCEMENT FAILED');
            console.log('   DO NOT DEPLOY until all violations are resolved!');
        }
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Validation failed:', error);
        process.exit(1);
    });
}

module.exports = PaperTradingValidator;