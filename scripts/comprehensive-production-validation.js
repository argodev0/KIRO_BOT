#!/usr/bin/env node

/**
 * Comprehensive Production Environment Validation Script
 * 
 * This script performs comprehensive validation of the production environment
 * configuration to ensure all critical settings are properly configured.
 */

const fs = require('fs');
const path = require('path');

class ComprehensiveProductionValidator {
    constructor() {
        this.envFile = path.join(__dirname, '..', '.env.production');
        this.config = {};
        this.errors = [];
        this.warnings = [];
        this.validationResults = {
            paperTradingSafety: false,
            monitoringConfiguration: false,
            sslConfiguration: false,
            databaseConfiguration: false,
            securityCompliance: false,
            exchangeConfiguration: false,
            environmentVariableValidation: false
        };
    }

    /**
     * Main validation process
     */
    async validate() {
        console.log('🔍 Comprehensive Production Environment Validation');
        console.log('================================================');
        
        try {
            // Load configuration
            await this.loadConfiguration();
            
            // Run all validations
            await this.validatePaperTradingSafety();
            await this.validateMonitoringConfiguration();
            await this.validateSSLConfiguration();
            await this.validateDatabaseConfiguration();
            await this.validateSecurityCompliance();
            await this.validateExchangeConfiguration();
            await this.validateEnvironmentVariables();
            
            // Generate comprehensive report
            await this.generateComprehensiveReport();
            
            // Check overall status
            const allPassed = Object.values(this.validationResults).every(result => result === true);
            const safetyScore = this.calculateSafetyScore();
            
            console.log(`\n📊 Overall Safety Score: ${safetyScore}%`);
            
            if (allPassed && this.errors.length === 0 && safetyScore >= 90) {
                console.log('\n✅ All validations passed! Production environment is ready for deployment.');
                return true;
            } else {
                console.log('\n❌ Validation failed. Please fix the issues before deploying to production.');
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
            'PAPER_TRADING_VALIDATION': 'strict',
            'TRADING_SIMULATION_ONLY': 'true'
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
        
        // Validate paper trading enforcement
        if (this.config.PAPER_TRADING_ENFORCEMENT !== 'strict') {
            this.errors.push('PAPER_TRADING_ENFORCEMENT must be set to strict for maximum safety');
            safetyPassed = false;
        }
        
        this.validationResults.paperTradingSafety = safetyPassed;
        
        if (safetyPassed) {
            console.log('✅ Paper trading safety validation passed');
        } else {
            console.log('❌ Paper trading safety validation failed');
        }
    }

    /**
     * Validate monitoring configuration
     */
    async validateMonitoringConfiguration() {
        console.log('\n📊 Validating monitoring configuration...');
        
        let monitoringPassed = true;
        
        // Critical: MONITORING_ENABLED must be true
        if (this.config.MONITORING_ENABLED !== 'true') {
            this.errors.push('CRITICAL: MONITORING_ENABLED must be true for production monitoring');
            monitoringPassed = false;
        }
        
        // Required monitoring settings
        const monitoringSettings = {
            'METRICS_ENABLED': 'true',
            'HEALTH_CHECK_ENABLED': 'true',
            'LOG_FORMAT': 'json',
            'SECURITY_MONITORING_ENABLED': 'true',
            'AUDIT_LOGGING_ENABLED': 'true'
        };
        
        for (const [key, expectedValue] of Object.entries(monitoringSettings)) {
            if (this.config[key] !== expectedValue) {
                this.warnings.push(`${key} should be ${expectedValue} for proper monitoring`);
            }
        }
        
        // Validate Prometheus configuration
        const prometheusPort = parseInt(this.config.PROMETHEUS_PORT);
        if (!prometheusPort || prometheusPort < 1024 || prometheusPort > 65535) {
            this.errors.push('PROMETHEUS_PORT must be a valid port number between 1024 and 65535');
            monitoringPassed = false;
        }
        
        // Validate Grafana configuration
        const grafanaPort = parseInt(this.config.GRAFANA_PORT);
        if (!grafanaPort || grafanaPort < 1024 || grafanaPort > 65535) {
            this.errors.push('GRAFANA_PORT must be a valid port number between 1024 and 65535');
            monitoringPassed = false;
        }
        
        if (!this.config.GRAFANA_PASSWORD || this.config.GRAFANA_PASSWORD.length < 8) {
            this.errors.push('GRAFANA_PASSWORD must be at least 8 characters long');
            monitoringPassed = false;
        }
        
        // Validate log level
        const validLogLevels = ['error', 'warn', 'info', 'debug'];
        if (!validLogLevels.includes(this.config.LOG_LEVEL)) {
            this.warnings.push(`LOG_LEVEL should be one of: ${validLogLevels.join(', ')}`);
        }
        
        this.validationResults.monitoringConfiguration = monitoringPassed;
        
        if (monitoringPassed) {
            console.log('✅ Monitoring configuration validation passed');
        } else {
            console.log('❌ Monitoring configuration validation failed');
        }
    }

    /**
     * Validate SSL configuration
     */
    async validateSSLConfiguration() {
        console.log('\n🔒 Validating SSL configuration...');
        
        let sslPassed = true;
        
        // SSL must be enabled
        if (this.config.SSL_ENABLED !== 'true') {
            this.errors.push('CRITICAL: SSL_ENABLED must be true for production security');
            sslPassed = false;
        }
        
        // Domain validation
        if (!this.config.DOMAIN_NAME || this.config.DOMAIN_NAME === 'your-domain.com') {
            this.errors.push('DOMAIN_NAME must be set to a valid production domain');
            sslPassed = false;
        }
        
        // Let's Encrypt email validation
        if (!this.config.LETSENCRYPT_EMAIL || !this.config.LETSENCRYPT_EMAIL.includes('@') || 
            this.config.LETSENCRYPT_EMAIL === 'your-email@example.com') {
            this.errors.push('LETSENCRYPT_EMAIL must be set to a valid email address');
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
        
        // Check if SSL certificate files exist
        const sslDir = path.join(__dirname, '..', 'docker', 'ssl');
        const sslFiles = ['cert.pem', 'private.key', 'ca.pem'];
        
        for (const file of sslFiles) {
            const filePath = path.join(sslDir, file);
            if (fs.existsSync(filePath)) {
                console.log(`✅ SSL certificate file found: ${file}`);
            } else {
                this.warnings.push(`SSL certificate file not found: ${file} (may be generated at runtime)`);
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
            this.errors.push('DATABASE_URL must be a valid PostgreSQL connection string');
            dbPassed = false;
        }
        
        // SSL enforcement for database
        if (this.config.DATABASE_SSL !== 'true') {
            this.errors.push('CRITICAL: DATABASE_SSL must be true for production security');
            dbPassed = false;
        }
        
        // PostgreSQL password validation
        if (!this.config.POSTGRES_PASSWORD || this.config.POSTGRES_PASSWORD.length < 16) {
            this.errors.push('POSTGRES_PASSWORD must be at least 16 characters long');
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
        
        // Security features validation
        const securityFeatures = {
            'HELMET_ENABLED': 'true',
            'CSRF_PROTECTION': 'true',
            'SECURITY_HARDENING_ENABLED': 'true',
            'RATE_LIMITING_ENABLED': 'true',
            'INTRUSION_DETECTION_ENABLED': 'true'
        };
        
        for (const [key, expectedValue] of Object.entries(securityFeatures)) {
            if (this.config[key] !== expectedValue) {
                this.errors.push(`${key} must be ${expectedValue} for security compliance`);
                securityPassed = false;
            }
        }
        
        // Password strength validation
        const passwords = ['REDIS_PASSWORD', 'RABBITMQ_PASSWORD', 'GRAFANA_PASSWORD'];
        for (const passwordKey of passwords) {
            if (!this.config[passwordKey] || this.config[passwordKey].length < 16) {
                this.errors.push(`${passwordKey} must be at least 16 characters long`);
                securityPassed = false;
            }
        }
        
        // BCRYPT rounds validation
        const bcryptRounds = parseInt(this.config.BCRYPT_ROUNDS);
        if (!bcryptRounds || bcryptRounds < 12) {
            this.warnings.push('BCRYPT_ROUNDS should be at least 12 for security');
        }
        
        // Rate limiting validation
        if (!this.config.RATE_LIMIT_WINDOW_MS || !this.config.RATE_LIMIT_MAX) {
            this.warnings.push('Rate limiting should be configured for security');
        }
        
        this.validationResults.securityCompliance = securityPassed;
        
        if (securityPassed) {
            console.log('✅ Security compliance validation passed');
        } else {
            console.log('❌ Security compliance validation failed');
        }
    }

    /**
     * Validate exchange configuration
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
        
        // API key validation
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
     * Validate comprehensive environment variables
     */
    async validateEnvironmentVariables() {
        console.log('\n🔍 Validating comprehensive environment variables...');
        
        let envPassed = true;
        
        // Required environment variables
        const requiredVars = [
            'NODE_ENV',
            'PORT',
            'HOST',
            'DATABASE_URL',
            'REDIS_HOST',
            'REDIS_PORT',
            'JWT_SECRET',
            'ENCRYPTION_KEY'
        ];
        
        for (const varName of requiredVars) {
            if (!this.config[varName]) {
                this.errors.push(`Required environment variable ${varName} is not set`);
                envPassed = false;
            }
        }
        
        // Validate dangerous variables are not present
        const dangerousVars = [
            'ENABLE_REAL_TRADING',
            'PRODUCTION_TRADING',
            'ALLOW_WITHDRAWALS',
            'ENABLE_WITHDRAWALS',
            'REAL_MONEY_MODE',
            'LIVE_TRADING_MODE'
        ];
        
        for (const dangerousVar of dangerousVars) {
            if (this.config[dangerousVar] && this.config[dangerousVar] !== 'false') {
                this.errors.push(`CRITICAL: Dangerous environment variable ${dangerousVar} detected`);
                envPassed = false;
            }
        }
        
        // Validate port numbers
        const ports = ['PORT', 'REDIS_PORT', 'PROMETHEUS_PORT', 'GRAFANA_PORT'];
        for (const portVar of ports) {
            const port = parseInt(this.config[portVar]);
            if (this.config[portVar] && (isNaN(port) || port < 1 || port > 65535)) {
                this.errors.push(`${portVar} must be a valid port number between 1 and 65535`);
                envPassed = false;
            }
        }
        
        // Validate boolean values
        const booleanVars = [
            'PAPER_TRADING_MODE',
            'ALLOW_REAL_TRADES',
            'FORCE_PAPER_TRADING',
            'TRADING_SIMULATION_ONLY',
            'SSL_ENABLED',
            'DATABASE_SSL',
            'MONITORING_ENABLED',
            'METRICS_ENABLED',
            'HEALTH_CHECK_ENABLED'
        ];
        
        for (const boolVar of booleanVars) {
            if (this.config[boolVar] && !['true', 'false'].includes(this.config[boolVar])) {
                this.warnings.push(`${boolVar} should be either 'true' or 'false'`);
            }
        }
        
        this.validationResults.environmentVariableValidation = envPassed;
        
        if (envPassed) {
            console.log('✅ Environment variable validation passed');
        } else {
            console.log('❌ Environment variable validation failed');
        }
    }

    /**
     * Calculate overall safety score
     */
    calculateSafetyScore() {
        const totalChecks = Object.keys(this.validationResults).length;
        const passedChecks = Object.values(this.validationResults).filter(result => result === true).length;
        
        let baseScore = (passedChecks / totalChecks) * 100;
        
        // Deduct points for errors
        const criticalErrors = this.errors.filter(e => e.includes('CRITICAL')).length;
        const regularErrors = this.errors.length - criticalErrors;
        
        const deductions = (criticalErrors * 20) + (regularErrors * 10) + (this.warnings.length * 2);
        
        return Math.max(0, Math.round(baseScore - deductions));
    }

    /**
     * Generate comprehensive validation report
     */
    async generateComprehensiveReport() {
        console.log('\n📋 Comprehensive Validation Report');
        console.log('==================================');
        
        // Summary
        const totalChecks = Object.keys(this.validationResults).length;
        const passedChecks = Object.values(this.validationResults).filter(result => result === true).length;
        const safetyScore = this.calculateSafetyScore();
        
        console.log(`\nOverall Status: ${passedChecks}/${totalChecks} checks passed`);
        console.log(`Safety Score: ${safetyScore}%`);
        
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
        console.log(`  Trading Simulation Only: ${this.config.TRADING_SIMULATION_ONLY === 'true' ? '✅ ENFORCED' : '❌ NOT ENFORCED'}`);
        console.log(`  Monitoring Enabled: ${this.config.MONITORING_ENABLED === 'true' ? '✅ ENABLED' : '❌ DISABLED'}`);
        console.log(`  SSL Enabled: ${this.config.SSL_ENABLED === 'true' ? '✅ ENABLED' : '❌ DISABLED'}`);
        console.log(`  Database SSL: ${this.config.DATABASE_SSL === 'true' ? '✅ ENABLED' : '❌ DISABLED'}`);
        
        // Save comprehensive report to file
        const reportData = {
            timestamp: new Date().toISOString(),
            overallStatus: passedChecks === totalChecks && this.errors.length === 0,
            safetyScore: safetyScore,
            checksPassedRatio: `${passedChecks}/${totalChecks}`,
            validationResults: this.validationResults,
            errors: this.errors,
            warnings: this.warnings,
            configurationSummary: {
                paperTradingMode: this.config.PAPER_TRADING_MODE === 'true',
                realTradingBlocked: this.config.ALLOW_REAL_TRADES === 'false',
                forcePaperTrading: this.config.FORCE_PAPER_TRADING === 'true',
                tradingSimulationOnly: this.config.TRADING_SIMULATION_ONLY === 'true',
                monitoringEnabled: this.config.MONITORING_ENABLED === 'true',
                sslEnabled: this.config.SSL_ENABLED === 'true',
                databaseSsl: this.config.DATABASE_SSL === 'true',
                securityHardening: this.config.SECURITY_HARDENING_ENABLED === 'true'
            }
        };
        
        const reportPath = path.join(__dirname, '..', 'comprehensive-production-validation-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
        console.log(`\n📄 Comprehensive report saved to: ${reportPath}`);
        
        return reportData;
    }
}

// Main execution
if (require.main === module) {
    const validator = new ComprehensiveProductionValidator();
    validator.validate().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Comprehensive validation failed:', error);
        process.exit(1);
    });
}

module.exports = ComprehensiveProductionValidator;