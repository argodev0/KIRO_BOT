#!/usr/bin/env node

/**
 * Production Configuration Validation Script
 * 
 * This script validates the production environment configuration
 * to ensure paper trading safety and security compliance.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ProductionConfigValidator {
    constructor() {
        this.envFile = path.join(__dirname, '..', '.env.production');
        this.config = {};
        this.errors = [];
        this.warnings = [];
        this.validationResults = {
            paperTradingSafety: false,
            securityCompliance: false,
            sslConfiguration: false,
            databaseConfiguration: false,
            exchangeConfiguration: false,
            monitoringConfiguration: false
        };
    }

    /**
     * Main validation process
     */
    async validate() {
        console.log('🔍 Production Configuration Validation');
        console.log('======================================');
        
        try {
            // Load configuration
            await this.loadConfiguration();
            
            // Run all validations
            await this.validatePaperTradingSafety();
            await this.validateSecurityCompliance();
            await this.validateSSLConfiguration();
            await this.validateDatabaseConfiguration();
            await this.validateExchangeConfiguration();
            await this.validateMonitoringConfiguration();
            
            // Generate report
            await this.generateValidationReport();
            
            // Check overall status
            const allPassed = Object.values(this.validationResults).every(result => result === true);
            
            if (allPassed && this.errors.length === 0) {
                console.log('\n✅ All validations passed! Configuration is ready for production.');
                return true;
            } else {
                console.log('\n❌ Validation failed. Please fix the issues before deploying.');
                return false;
            }
            
        } catch (error) {
            console.error('\n❌ Validation process failed:', error.message);
            return false;
        }
    }

    /**
     * Load configuration from .env.production
     */
    async loadConfiguration() {
        console.log('\n📖 Loading production configuration...');
        
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
     * Validate paper trading safety settings
     */
    async validatePaperTradingSafety() {
        console.log('\n🔒 Validating paper trading safety...');
        
        const criticalSettings = {
            'NODE_ENV': 'production',
            'PAPER_TRADING_MODE': 'true',
            'ALLOW_REAL_TRADES': 'false',
            'FORCE_PAPER_TRADING': 'true',
            'PAPER_TRADING_VALIDATION': 'strict'
        };
        
        let safetyPassed = true;
        
        for (const [key, expectedValue] of Object.entries(criticalSettings)) {
            if (this.config[key] !== expectedValue) {
                this.errors.push(`CRITICAL: ${key} must be ${expectedValue} for paper trading safety`);
                safetyPassed = false;
            }
        }
        
        // Validate virtual balances are set
        const virtualBalances = ['VIRTUAL_BALANCE_USD', 'VIRTUAL_BALANCE_BTC', 'VIRTUAL_BALANCE_ETH'];
        for (const balance of virtualBalances) {
            if (!this.config[balance] || parseFloat(this.config[balance]) <= 0) {
                this.errors.push(`${balance} must be set to a positive value for paper trading`);
                safetyPassed = false;
            }
        }
        
        // Validate paper trading audit logging
        if (this.config.PAPER_TRADE_AUDIT_LOG !== 'true') {
            this.warnings.push('PAPER_TRADE_AUDIT_LOG should be enabled for compliance');
        }
        
        this.validationResults.paperTradingSafety = safetyPassed;
        
        if (safetyPassed) {
            console.log('✅ Paper trading safety validation passed');
        } else {
            console.log('❌ Paper trading safety validation failed');
        }
    }

    /**
     * Validate security compliance
     */
    async validateSecurityCompliance() {
        console.log('\n🛡️  Validating security compliance...');
        
        let securityPassed = true;
        
        // JWT Secret validation
        if (!this.config.JWT_SECRET || this.config.JWT_SECRET.length < 32) {
            this.errors.push('JWT_SECRET must be at least 32 characters long');
            securityPassed = false;
        }
        
        // Encryption key validation
        if (!this.config.ENCRYPTION_KEY || this.config.ENCRYPTION_KEY.length < 32) {
            this.errors.push('ENCRYPTION_KEY must be at least 32 characters long');
            securityPassed = false;
        }
        
        // Password strength validation
        const passwords = ['POSTGRES_PASSWORD', 'REDIS_PASSWORD', 'RABBITMQ_PASSWORD', 'GRAFANA_PASSWORD'];
        for (const passwordKey of passwords) {
            if (!this.config[passwordKey] || this.config[passwordKey].length < 16) {
                this.errors.push(`${passwordKey} must be at least 16 characters long`);
                securityPassed = false;
            }
        }
        
        // Security features validation
        const securityFeatures = {
            'HELMET_ENABLED': 'true',
            'CSRF_PROTECTION': 'true',
            'DATABASE_SSL': 'true',
            'SSL_ENABLED': 'true'
        };
        
        for (const [key, expectedValue] of Object.entries(securityFeatures)) {
            if (this.config[key] !== expectedValue) {
                this.errors.push(`${key} must be ${expectedValue} for security compliance`);
                securityPassed = false;
            }
        }
        
        // Rate limiting validation
        if (!this.config.RATE_LIMIT_WINDOW_MS || !this.config.RATE_LIMIT_MAX) {
            this.warnings.push('Rate limiting should be configured for security');
        }
        
        // BCRYPT rounds validation
        const bcryptRounds = parseInt(this.config.BCRYPT_ROUNDS);
        if (!bcryptRounds || bcryptRounds < 12) {
            this.warnings.push('BCRYPT_ROUNDS should be at least 12 for security');
        }
        
        this.validationResults.securityCompliance = securityPassed;
        
        if (securityPassed) {
            console.log('✅ Security compliance validation passed');
        } else {
            console.log('❌ Security compliance validation failed');
        }
    }

    /**
     * Validate SSL configuration
     */
    async validateSSLConfiguration() {
        console.log('\n🔒 Validating SSL configuration...');
        
        let sslPassed = true;
        
        // Domain validation
        if (!this.config.DOMAIN_NAME) {
            this.errors.push('DOMAIN_NAME is required for SSL configuration');
            sslPassed = false;
        } else if (this.config.DOMAIN_NAME === 'your-domain.com') {
            this.errors.push('DOMAIN_NAME must be changed from template default');
            sslPassed = false;
        }
        
        // Let's Encrypt email validation
        if (!this.config.LETSENCRYPT_EMAIL || !this.config.LETSENCRYPT_EMAIL.includes('@')) {
            this.errors.push('Valid LETSENCRYPT_EMAIL is required for SSL certificates');
            sslPassed = false;
        } else if (this.config.LETSENCRYPT_EMAIL === 'your-email@example.com') {
            this.errors.push('LETSENCRYPT_EMAIL must be changed from template default');
            sslPassed = false;
        }
        
        // SSL paths validation
        const sslPaths = ['SSL_CERT_PATH', 'SSL_KEY_PATH', 'SSL_CA_PATH'];
        for (const pathKey of sslPaths) {
            if (!this.config[pathKey]) {
                this.errors.push(`${pathKey} is required for SSL configuration`);
                sslPassed = false;
            }
        }
        
        // CORS origin validation
        if (this.config.CORS_ORIGIN && !this.config.CORS_ORIGIN.startsWith('https://')) {
            this.warnings.push('CORS_ORIGIN should use HTTPS in production');
        }
        
        this.validationResults.sslConfiguration = sslPassed;
        
        if (sslPassed) {
            console.log('✅ SSL configuration validation passed');
        } else {
            console.log('❌ SSL configuration validation failed');
        }
    }

    /**
     * Validate database configuration
     */
    async validateDatabaseConfiguration() {
        console.log('\n🗄️  Validating database configuration...');
        
        let dbPassed = true;
        
        // Database URL validation
        if (!this.config.DATABASE_URL || !this.config.DATABASE_URL.startsWith('postgresql://')) {
            this.errors.push('Valid PostgreSQL DATABASE_URL is required');
            dbPassed = false;
        }
        
        // SSL enforcement
        if (this.config.DATABASE_SSL !== 'true') {
            this.errors.push('DATABASE_SSL must be true for production');
            dbPassed = false;
        }
        
        // Connection pool validation
        const poolSize = parseInt(this.config.DATABASE_POOL_SIZE);
        if (!poolSize || poolSize < 10 || poolSize > 50) {
            this.warnings.push('DATABASE_POOL_SIZE should be between 10 and 50 for optimal performance');
        }
        
        // Connection timeout validation
        const timeout = parseInt(this.config.DATABASE_CONNECTION_TIMEOUT);
        if (!timeout || timeout < 10000) {
            this.warnings.push('DATABASE_CONNECTION_TIMEOUT should be at least 10000ms');
        }
        
        this.validationResults.databaseConfiguration = dbPassed;
        
        if (dbPassed) {
            console.log('✅ Database configuration validation passed');
        } else {
            console.log('❌ Database configuration validation failed');
        }
    }

    /**
     * Validate exchange API configuration
     */
    async validateExchangeConfiguration() {
        console.log('\n🔑 Validating exchange API configuration...');
        
        let exchangePassed = true;
        
        // Critical read-only enforcement
        const readOnlySettings = {
            'BINANCE_SANDBOX': 'false',
            'BINANCE_MAINNET': 'true',
            'BINANCE_READ_ONLY': 'true',
            'KUCOIN_SANDBOX': 'false',
            'KUCOIN_MAINNET': 'true',
            'KUCOIN_READ_ONLY': 'true'
        };
        
        for (const [key, expectedValue] of Object.entries(readOnlySettings)) {
            if (this.config[key] !== expectedValue) {
                this.errors.push(`CRITICAL: ${key} must be ${expectedValue} for paper trading safety`);
                exchangePassed = false;
            }
        }
        
        // API key validation (check if configured)
        const exchanges = ['BINANCE', 'KUCOIN'];
        let configuredExchanges = 0;
        
        for (const exchange of exchanges) {
            const apiKey = this.config[`${exchange}_API_KEY`];
            const apiSecret = this.config[`${exchange}_API_SECRET`];
            
            if (apiKey && apiSecret && !apiKey.startsWith('your-') && !apiSecret.startsWith('your-')) {
                configuredExchanges++;
                console.log(`✅ ${exchange} API configured`);
                
                // Additional validation for KuCoin passphrase
                if (exchange === 'KUCOIN') {
                    const passphrase = this.config.KUCOIN_PASSPHRASE;
                    if (!passphrase || passphrase.startsWith('your-')) {
                        this.warnings.push('KUCOIN_PASSPHRASE should be configured if using KuCoin API');
                    }
                }
            } else {
                console.log(`ℹ️  ${exchange} API not configured (will be disabled)`);
            }
        }
        
        if (configuredExchanges === 0) {
            this.warnings.push('No exchange APIs configured - market data will be limited');
        }
        
        this.validationResults.exchangeConfiguration = exchangePassed;
        
        if (exchangePassed) {
            console.log('✅ Exchange API configuration validation passed');
        } else {
            console.log('❌ Exchange API configuration validation failed');
        }
    }

    /**
     * Validate monitoring configuration
     */
    async validateMonitoringConfiguration() {
        console.log('\n📊 Validating monitoring configuration...');
        
        let monitoringPassed = true;
        
        // Required monitoring settings
        const monitoringSettings = {
            'METRICS_ENABLED': 'true',
            'HEALTH_CHECK_ENABLED': 'true',
            'LOG_LEVEL': ['info', 'warn', 'error'],
            'LOG_FORMAT': 'json'
        };
        
        for (const [key, expectedValue] of Object.entries(monitoringSettings)) {
            if (Array.isArray(expectedValue)) {
                if (!expectedValue.includes(this.config[key])) {
                    this.warnings.push(`${key} should be one of: ${expectedValue.join(', ')}`);
                }
            } else if (this.config[key] !== expectedValue) {
                this.warnings.push(`${key} should be ${expectedValue} for proper monitoring`);
            }
        }
        
        // Port validation
        const ports = ['PROMETHEUS_PORT', 'GRAFANA_PORT'];
        for (const portKey of ports) {
            const port = parseInt(this.config[portKey]);
            if (!port || port < 1024 || port > 65535) {
                this.warnings.push(`${portKey} should be a valid port number between 1024 and 65535`);
            }
        }
        
        // Grafana password validation
        if (!this.config.GRAFANA_PASSWORD || this.config.GRAFANA_PASSWORD.length < 8) {
            this.errors.push('GRAFANA_PASSWORD must be at least 8 characters long');
            monitoringPassed = false;
        }
        
        this.validationResults.monitoringConfiguration = monitoringPassed;
        
        if (monitoringPassed) {
            console.log('✅ Monitoring configuration validation passed');
        } else {
            console.log('❌ Monitoring configuration validation failed');
        }
    }

    /**
     * Generate validation report
     */
    async generateValidationReport() {
        console.log('\n📋 Validation Report');
        console.log('===================');
        
        // Summary
        const totalChecks = Object.keys(this.validationResults).length;
        const passedChecks = Object.values(this.validationResults).filter(result => result === true).length;
        
        console.log(`\nOverall Status: ${passedChecks}/${totalChecks} checks passed`);
        
        // Detailed results
        console.log('\nDetailed Results:');
        for (const [category, passed] of Object.entries(this.validationResults)) {
            const status = passed ? '✅' : '❌';
            const categoryName = category.replace(/([A-Z])/g, ' $1').toLowerCase();
            console.log(`  ${status} ${categoryName}`);
        }
        
        // Errors
        if (this.errors.length > 0) {
            console.log('\n❌ Errors (must be fixed):');
            this.errors.forEach((error, index) => {
                console.log(`  ${index + 1}. ${error}`);
            });
        }
        
        // Warnings
        if (this.warnings.length > 0) {
            console.log('\n⚠️  Warnings (recommended fixes):');
            this.warnings.forEach((warning, index) => {
                console.log(`  ${index + 1}. ${warning}`);
            });
        }
        
        // Paper trading safety summary
        console.log('\n🔒 Paper Trading Safety Summary:');
        console.log(`  Paper Trading Mode: ${this.config.PAPER_TRADING_MODE === 'true' ? '✅ ENFORCED' : '❌ NOT ENFORCED'}`);
        console.log(`  Real Trading Blocked: ${this.config.ALLOW_REAL_TRADES === 'false' ? '✅ BLOCKED' : '❌ ALLOWED'}`);
        console.log(`  Force Paper Trading: ${this.config.FORCE_PAPER_TRADING === 'true' ? '✅ ENABLED' : '❌ DISABLED'}`);
        console.log(`  Binance Read-Only: ${this.config.BINANCE_READ_ONLY === 'true' ? '✅ ENFORCED' : '❌ NOT ENFORCED'}`);
        console.log(`  KuCoin Read-Only: ${this.config.KUCOIN_READ_ONLY === 'true' ? '✅ ENFORCED' : '❌ NOT ENFORCED'}`);
        
        // Save report to file
        const reportData = {
            timestamp: new Date().toISOString(),
            overallStatus: passedChecks === totalChecks && this.errors.length === 0,
            checksPassedRatio: `${passedChecks}/${totalChecks}`,
            validationResults: this.validationResults,
            errors: this.errors,
            warnings: this.warnings,
            paperTradingSafety: {
                paperTradingMode: this.config.PAPER_TRADING_MODE === 'true',
                realTradingBlocked: this.config.ALLOW_REAL_TRADES === 'false',
                forcePaperTrading: this.config.FORCE_PAPER_TRADING === 'true',
                binanceReadOnly: this.config.BINANCE_READ_ONLY === 'true',
                kucoinReadOnly: this.config.KUCOIN_READ_ONLY === 'true'
            }
        };
        
        const reportPath = path.join(__dirname, '..', 'production-config-validation-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    }
}

// Main execution
if (require.main === module) {
    const validator = new ProductionConfigValidator();
    validator.validate().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Validation failed:', error);
        process.exit(1);
    });
}

module.exports = ProductionConfigValidator;