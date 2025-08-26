#!/usr/bin/env node

/**
 * Security Configuration Validation Script
 * Validates all security measures are properly configured and active
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class SecurityConfigurationValidator {
    constructor() {
        this.configPath = path.join(__dirname, '..', '.env.production');
        this.validationResults = {
            passwordSecurity: { passed: 0, total: 0, details: [] },
            encryptionSecurity: { passed: 0, total: 0, details: [] },
            monitoringSecurity: { passed: 0, total: 0, details: [] },
            hardeningSecurity: { passed: 0, total: 0, details: [] },
            auditSecurity: { passed: 0, total: 0, details: [] },
            paperTradingSecurity: { passed: 0, total: 0, details: [] }
        };
    }

    /**
     * Main validation execution
     */
    async execute() {
        console.log('🔍 Starting Security Configuration Validation...\n');

        try {
            // Load configuration
            const config = await this.loadConfiguration();

            // Run all validation checks
            await this.validatePasswordSecurity(config);
            await this.validateEncryptionSecurity(config);
            await this.validateMonitoringSecurity(config);
            await this.validateHardeningSecurity(config);
            await this.validateAuditSecurity(config);
            await this.validatePaperTradingSecurity(config);

            // Generate validation report
            this.generateValidationReport();

            // Check if all validations passed
            const overallResult = this.calculateOverallResult();
            
            if (overallResult.passed === overallResult.total) {
                console.log('\n✅ All security validations passed successfully!');
                console.log('🔐 Production environment is secure and ready for deployment.');
                return true;
            } else {
                console.log(`\n❌ Security validation failed: ${overallResult.passed}/${overallResult.total} checks passed`);
                console.log('🚨 Security issues must be resolved before deployment.');
                return false;
            }

        } catch (error) {
            console.error('\n❌ Security validation error:', error.message);
            return false;
        }
    }

    /**
     * Load and parse configuration
     */
    async loadConfiguration() {
        try {
            const configContent = await fs.readFile(this.configPath, 'utf8');
            const config = {};
            
            const lines = configContent.split('\n');
            for (const line of lines) {
                if (line.trim() && !line.startsWith('#')) {
                    const [key, ...valueParts] = line.split('=');
                    if (key && valueParts.length > 0) {
                        config[key.trim()] = valueParts.join('=').trim();
                    }
                }
            }
            
            return config;
        } catch (error) {
            throw new Error(`Failed to load configuration: ${error.message}`);
        }
    }

    /**
     * Validate password security
     */
    async validatePasswordSecurity(config) {
        console.log('🔑 Validating password security...');
        
        const passwordChecks = [
            {
                name: 'PostgreSQL Password',
                key: 'POSTGRES_PASSWORD',
                minLength: 16,
                requireComplexity: true
            },
            {
                name: 'Redis Password',
                key: 'REDIS_PASSWORD',
                minLength: 16,
                requireComplexity: true
            },
            {
                name: 'RabbitMQ Password',
                key: 'RABBITMQ_PASSWORD',
                minLength: 16,
                requireComplexity: true
            },
            {
                name: 'Grafana Password',
                key: 'GRAFANA_PASSWORD',
                minLength: 16,
                requireComplexity: true
            }
        ];

        for (const check of passwordChecks) {
            this.validationResults.passwordSecurity.total++;
            
            const password = config[check.key];
            if (!password) {
                this.validationResults.passwordSecurity.details.push({
                    name: check.name,
                    status: 'FAIL',
                    reason: 'Password not found in configuration'
                });
                continue;
            }

            const validation = this.validatePassword(password, check.minLength, check.requireComplexity);
            if (validation.valid) {
                this.validationResults.passwordSecurity.passed++;
                this.validationResults.passwordSecurity.details.push({
                    name: check.name,
                    status: 'PASS',
                    reason: 'Strong password configured'
                });
                console.log(`  ✓ ${check.name}: Strong password configured`);
            } else {
                this.validationResults.passwordSecurity.details.push({
                    name: check.name,
                    status: 'FAIL',
                    reason: validation.reason
                });
                console.log(`  ❌ ${check.name}: ${validation.reason}`);
            }
        }

        console.log(`  📊 Password Security: ${this.validationResults.passwordSecurity.passed}/${this.validationResults.passwordSecurity.total} passed\n`);
    }

    /**
     * Validate encryption security
     */
    async validateEncryptionSecurity(config) {
        console.log('🔐 Validating encryption security...');

        const encryptionChecks = [
            {
                name: 'JWT Secret',
                key: 'JWT_SECRET',
                minLength: 64,
                type: 'hex'
            },
            {
                name: 'JWT Refresh Secret',
                key: 'JWT_REFRESH_SECRET',
                minLength: 64,
                type: 'hex'
            },
            {
                name: 'Encryption Key',
                key: 'ENCRYPTION_KEY',
                minLength: 64,
                type: 'hex'
            },
            {
                name: 'Session Secret',
                key: 'SESSION_SECRET',
                minLength: 64,
                type: 'hex'
            },
            {
                name: 'CSRF Secret',
                key: 'CSRF_SECRET',
                minLength: 32,
                type: 'hex'
            }
        ];

        for (const check of encryptionChecks) {
            this.validationResults.encryptionSecurity.total++;
            
            const secret = config[check.key];
            if (!secret) {
                this.validationResults.encryptionSecurity.details.push({
                    name: check.name,
                    status: 'FAIL',
                    reason: 'Secret not found in configuration'
                });
                console.log(`  ❌ ${check.name}: Secret not found`);
                continue;
            }

            const validation = this.validateEncryptionKey(secret, check.minLength, check.type);
            if (validation.valid) {
                this.validationResults.encryptionSecurity.passed++;
                this.validationResults.encryptionSecurity.details.push({
                    name: check.name,
                    status: 'PASS',
                    reason: `Strong ${check.type} key (${secret.length} chars)`
                });
                console.log(`  ✓ ${check.name}: Strong ${check.type} key configured`);
            } else {
                this.validationResults.encryptionSecurity.details.push({
                    name: check.name,
                    status: 'FAIL',
                    reason: validation.reason
                });
                console.log(`  ❌ ${check.name}: ${validation.reason}`);
            }
        }

        console.log(`  📊 Encryption Security: ${this.validationResults.encryptionSecurity.passed}/${this.validationResults.encryptionSecurity.total} passed\n`);
    }

    /**
     * Validate monitoring security
     */
    async validateMonitoringSecurity(config) {
        console.log('📊 Validating monitoring security...');

        const monitoringChecks = [
            {
                name: 'Prometheus API Key',
                key: 'PROMETHEUS_API_KEY',
                required: true
            },
            {
                name: 'Grafana API Key',
                key: 'GRAFANA_API_KEY',
                required: true
            },
            {
                name: 'Security Monitoring Key',
                key: 'SECURITY_MONITORING_KEY',
                required: true
            },
            {
                name: 'Alert Webhook Token',
                key: 'ALERT_WEBHOOK_TOKEN',
                required: true
            },
            {
                name: 'Monitoring Enabled',
                key: 'SECURITY_MONITORING_ENABLED',
                expectedValue: 'true'
            }
        ];

        for (const check of monitoringChecks) {
            this.validationResults.monitoringSecurity.total++;
            
            const value = config[check.key];
            if (!value) {
                this.validationResults.monitoringSecurity.details.push({
                    name: check.name,
                    status: 'FAIL',
                    reason: 'Configuration value not found'
                });
                console.log(`  ❌ ${check.name}: Configuration not found`);
                continue;
            }

            if (check.expectedValue && value !== check.expectedValue) {
                this.validationResults.monitoringSecurity.details.push({
                    name: check.name,
                    status: 'FAIL',
                    reason: `Expected '${check.expectedValue}', got '${value}'`
                });
                console.log(`  ❌ ${check.name}: Expected '${check.expectedValue}', got '${value}'`);
                continue;
            }

            if (check.required && value.length < 16) {
                this.validationResults.monitoringSecurity.details.push({
                    name: check.name,
                    status: 'FAIL',
                    reason: 'Key too short (minimum 16 characters)'
                });
                console.log(`  ❌ ${check.name}: Key too short`);
                continue;
            }

            this.validationResults.monitoringSecurity.passed++;
            this.validationResults.monitoringSecurity.details.push({
                name: check.name,
                status: 'PASS',
                reason: 'Properly configured'
            });
            console.log(`  ✓ ${check.name}: Properly configured`);
        }

        console.log(`  📊 Monitoring Security: ${this.validationResults.monitoringSecurity.passed}/${this.validationResults.monitoringSecurity.total} passed\n`);
    }

    /**
     * Validate security hardening
     */
    async validateHardeningSecurity(config) {
        console.log('🛡️  Validating security hardening...');

        const hardeningChecks = [
            {
                name: 'Security Hardening Enabled',
                key: 'SECURITY_HARDENING_ENABLED',
                expectedValue: 'true'
            },
            {
                name: 'Rate Limiting Enabled',
                key: 'RATE_LIMITING_ENABLED',
                expectedValue: 'true'
            },
            {
                name: 'Intrusion Detection Enabled',
                key: 'INTRUSION_DETECTION_ENABLED',
                expectedValue: 'true'
            },
            {
                name: 'HSTS Enabled',
                key: 'HSTS_ENABLED',
                expectedValue: 'true'
            },
            {
                name: 'CSP Enabled',
                key: 'CSP_ENABLED',
                expectedValue: 'true'
            },
            {
                name: 'Session Security',
                key: 'SESSION_SECURE',
                expectedValue: 'true'
            },
            {
                name: 'HTTPS Only',
                key: 'SSL_ENABLED',
                expectedValue: 'true'
            }
        ];

        for (const check of hardeningChecks) {
            this.validationResults.hardeningSecurity.total++;
            
            const value = config[check.key];
            if (value === check.expectedValue) {
                this.validationResults.hardeningSecurity.passed++;
                this.validationResults.hardeningSecurity.details.push({
                    name: check.name,
                    status: 'PASS',
                    reason: 'Security feature enabled'
                });
                console.log(`  ✓ ${check.name}: Enabled`);
            } else {
                this.validationResults.hardeningSecurity.details.push({
                    name: check.name,
                    status: 'FAIL',
                    reason: `Expected '${check.expectedValue}', got '${value || 'undefined'}'`
                });
                console.log(`  ❌ ${check.name}: Not properly configured`);
            }
        }

        console.log(`  📊 Security Hardening: ${this.validationResults.hardeningSecurity.passed}/${this.validationResults.hardeningSecurity.total} passed\n`);
    }

    /**
     * Validate audit security
     */
    async validateAuditSecurity(config) {
        console.log('📝 Validating audit security...');

        const auditChecks = [
            {
                name: 'Audit Logging Enabled',
                key: 'AUDIT_LOGGING_ENABLED',
                expectedValue: 'true'
            },
            {
                name: 'Audit Log Encryption Key',
                key: 'AUDIT_LOG_ENCRYPTION_KEY',
                minLength: 64
            },
            {
                name: 'Log Level',
                key: 'LOG_LEVEL',
                expectedValue: 'info'
            },
            {
                name: 'Log Format',
                key: 'LOG_FORMAT',
                expectedValue: 'json'
            },
            {
                name: 'Audit Retention',
                key: 'AUDIT_RETENTION_DAYS',
                minValue: 365
            }
        ];

        for (const check of auditChecks) {
            this.validationResults.auditSecurity.total++;
            
            const value = config[check.key];
            if (!value) {
                this.validationResults.auditSecurity.details.push({
                    name: check.name,
                    status: 'FAIL',
                    reason: 'Configuration not found'
                });
                console.log(`  ❌ ${check.name}: Configuration not found`);
                continue;
            }

            let isValid = true;
            let reason = 'Properly configured';

            if (check.expectedValue && value !== check.expectedValue) {
                isValid = false;
                reason = `Expected '${check.expectedValue}', got '${value}'`;
            } else if (check.minLength && value.length < check.minLength) {
                isValid = false;
                reason = `Key too short (minimum ${check.minLength} characters)`;
            } else if (check.minValue && parseInt(value) < check.minValue) {
                isValid = false;
                reason = `Value too low (minimum ${check.minValue})`;
            }

            if (isValid) {
                this.validationResults.auditSecurity.passed++;
                this.validationResults.auditSecurity.details.push({
                    name: check.name,
                    status: 'PASS',
                    reason
                });
                console.log(`  ✓ ${check.name}: ${reason}`);
            } else {
                this.validationResults.auditSecurity.details.push({
                    name: check.name,
                    status: 'FAIL',
                    reason
                });
                console.log(`  ❌ ${check.name}: ${reason}`);
            }
        }

        console.log(`  📊 Audit Security: ${this.validationResults.auditSecurity.passed}/${this.validationResults.auditSecurity.total} passed\n`);
    }

    /**
     * Validate paper trading security
     */
    async validatePaperTradingSecurity(config) {
        console.log('📄 Validating paper trading security...');

        const paperTradingChecks = [
            {
                name: 'Paper Trading Mode',
                key: 'PAPER_TRADING_MODE',
                expectedValue: 'true'
            },
            {
                name: 'Real Trades Blocked',
                key: 'ALLOW_REAL_TRADES',
                expectedValue: 'false'
            },
            {
                name: 'Force Paper Trading',
                key: 'FORCE_PAPER_TRADING',
                expectedValue: 'true'
            },
            {
                name: 'Paper Trading Validation',
                key: 'PAPER_TRADING_VALIDATION',
                expectedValue: 'strict'
            },
            {
                name: 'Paper Trading Enforcement',
                key: 'PAPER_TRADING_ENFORCEMENT',
                expectedValue: 'strict'
            },
            {
                name: 'Binance Read Only',
                key: 'BINANCE_READ_ONLY',
                expectedValue: 'true'
            },
            {
                name: 'KuCoin Read Only',
                key: 'KUCOIN_READ_ONLY',
                expectedValue: 'true'
            }
        ];

        for (const check of paperTradingChecks) {
            this.validationResults.paperTradingSecurity.total++;
            
            const value = config[check.key];
            if (value === check.expectedValue) {
                this.validationResults.paperTradingSecurity.passed++;
                this.validationResults.paperTradingSecurity.details.push({
                    name: check.name,
                    status: 'PASS',
                    reason: 'Paper trading safety enforced'
                });
                console.log(`  ✓ ${check.name}: Safety enforced`);
            } else {
                this.validationResults.paperTradingSecurity.details.push({
                    name: check.name,
                    status: 'FAIL',
                    reason: `Expected '${check.expectedValue}', got '${value || 'undefined'}'`
                });
                console.log(`  ❌ ${check.name}: Safety not enforced`);
            }
        }

        console.log(`  📊 Paper Trading Security: ${this.validationResults.paperTradingSecurity.passed}/${this.validationResults.paperTradingSecurity.total} passed\n`);
    }

    /**
     * Validate password strength
     */
    validatePassword(password, minLength = 16, requireComplexity = true) {
        if (!password) {
            return { valid: false, reason: 'Password is empty' };
        }

        if (password.length < minLength) {
            return { valid: false, reason: `Password too short (minimum ${minLength} characters)` };
        }

        if (requireComplexity) {
            if (!/[A-Z]/.test(password)) {
                return { valid: false, reason: 'Password must contain uppercase letters' };
            }
            if (!/[a-z]/.test(password)) {
                return { valid: false, reason: 'Password must contain lowercase letters' };
            }
            if (!/[0-9]/.test(password)) {
                return { valid: false, reason: 'Password must contain numbers' };
            }
            if (!/[^A-Za-z0-9]/.test(password)) {
                return { valid: false, reason: 'Password must contain special characters' };
            }
        }

        return { valid: true, reason: 'Strong password' };
    }

    /**
     * Validate encryption key
     */
    validateEncryptionKey(key, minLength = 32, type = 'hex') {
        if (!key) {
            return { valid: false, reason: 'Key is empty' };
        }

        if (key.length < minLength) {
            return { valid: false, reason: `Key too short (minimum ${minLength} characters)` };
        }

        if (type === 'hex' && !/^[a-fA-F0-9]+$/.test(key)) {
            return { valid: false, reason: 'Key must be valid hexadecimal' };
        }

        return { valid: true, reason: `Strong ${type} key` };
    }

    /**
     * Calculate overall validation result
     */
    calculateOverallResult() {
        let totalPassed = 0;
        let totalChecks = 0;

        for (const category of Object.values(this.validationResults)) {
            totalPassed += category.passed;
            totalChecks += category.total;
        }

        return { passed: totalPassed, total: totalChecks };
    }

    /**
     * Generate detailed validation report
     */
    generateValidationReport() {
        console.log('📋 Security Validation Report');
        console.log('═'.repeat(80));

        for (const [categoryName, category] of Object.entries(this.validationResults)) {
            const categoryTitle = categoryName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            console.log(`\n${categoryTitle}: ${category.passed}/${category.total} passed`);
            console.log('─'.repeat(50));

            for (const detail of category.details) {
                const status = detail.status === 'PASS' ? '✓' : '❌';
                console.log(`  ${status} ${detail.name}: ${detail.reason}`);
            }
        }

        const overall = this.calculateOverallResult();
        console.log('\n' + '═'.repeat(80));
        console.log(`Overall Security Score: ${overall.passed}/${overall.total} (${Math.round(overall.passed / overall.total * 100)}%)`);
        console.log('═'.repeat(80));
    }
}

// Execute if run directly
if (require.main === module) {
    const validator = new SecurityConfigurationValidator();
    validator.execute().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Validation failed:', error);
        process.exit(1);
    });
}

module.exports = SecurityConfigurationValidator;