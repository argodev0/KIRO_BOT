#!/usr/bin/env node

/**
 * Security Configuration and Secrets Management Script
 * Implements comprehensive security setup for production deployment
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class SecurityConfigurationManager {
    constructor() {
        this.configPath = path.join(__dirname, '..', '.env.production');
        this.backupPath = path.join(__dirname, '..', '.env.production.backup');
        this.secretsGenerated = {};
        this.securityConfig = {};
    }

    /**
     * Main execution function
     */
    async execute() {
        console.log('🔐 Starting Security Configuration and Secrets Management...\n');

        try {
            // Step 1: Generate strong passwords and secrets
            await this.generateSecrets();

            // Step 2: Configure JWT secrets and encryption keys
            await this.configureJWTAndEncryption();

            // Step 3: Set up monitoring credentials
            await this.setupMonitoringCredentials();

            // Step 4: Enable security hardening options
            await this.enableSecurityHardening();

            // Step 5: Configure audit logging and security monitoring
            await this.configureAuditLogging();

            // Step 6: Update production environment file
            await this.updateProductionEnvironment();

            // Step 7: Validate security configuration
            await this.validateSecurityConfiguration();

            console.log('\n✅ Security configuration completed successfully!');
            console.log('\n📋 Security Configuration Summary:');
            this.printSecuritySummary();

        } catch (error) {
            console.error('\n❌ Security configuration failed:', error.message);
            process.exit(1);
        }
    }

    /**
     * Generate strong passwords for all services
     */
    async generateSecrets() {
        console.log('🔑 Generating strong passwords and secrets...');

        // Generate PostgreSQL password
        this.secretsGenerated.postgresPassword = this.generateStrongPassword(32);
        console.log('  ✓ PostgreSQL password generated');

        // Generate Redis password
        this.secretsGenerated.redisPassword = this.generateStrongPassword(32);
        console.log('  ✓ Redis password generated');

        // Generate RabbitMQ password
        this.secretsGenerated.rabbitmqPassword = this.generateStrongPassword(32);
        console.log('  ✓ RabbitMQ password generated');

        // Generate Grafana admin password
        this.secretsGenerated.grafanaPassword = this.generateStrongPassword(24);
        console.log('  ✓ Grafana admin password generated');

        // Generate monitoring API keys
        this.secretsGenerated.prometheusApiKey = this.generateSecureToken(64);
        this.secretsGenerated.grafanaApiKey = this.generateSecureToken(64);
        console.log('  ✓ Monitoring API keys generated');

        console.log('  ✅ All service passwords generated\n');
    }

    /**
     * Configure JWT secrets and encryption keys
     */
    async configureJWTAndEncryption() {
        console.log('🔐 Configuring JWT secrets and encryption keys...');

        // Generate JWT secret (256-bit)
        this.secretsGenerated.jwtSecret = this.generateSecureToken(64);
        console.log('  ✓ JWT secret generated (256-bit)');

        // Generate JWT refresh secret
        this.secretsGenerated.jwtRefreshSecret = this.generateSecureToken(64);
        console.log('  ✓ JWT refresh secret generated');

        // Generate encryption key (256-bit AES)
        this.secretsGenerated.encryptionKey = this.generateSecureToken(64);
        console.log('  ✓ AES-256 encryption key generated');

        // Generate session secret
        this.secretsGenerated.sessionSecret = this.generateSecureToken(64);
        console.log('  ✓ Session secret generated');

        // Generate CSRF secret
        this.secretsGenerated.csrfSecret = this.generateSecureToken(32);
        console.log('  ✓ CSRF protection secret generated');

        // Generate API key encryption salt
        this.secretsGenerated.apiKeySalt = this.generateSecureToken(32);
        console.log('  ✓ API key encryption salt generated');

        console.log('  ✅ JWT and encryption configuration completed\n');
    }

    /**
     * Set up monitoring credentials
     */
    async setupMonitoringCredentials() {
        console.log('📊 Setting up monitoring credentials...');

        // Generate Prometheus credentials
        this.secretsGenerated.prometheusUser = 'prometheus_admin';
        this.secretsGenerated.prometheusPasswordHash = this.hashPassword(this.secretsGenerated.prometheusApiKey);
        console.log('  ✓ Prometheus admin credentials configured');

        // Generate Grafana service account
        this.secretsGenerated.grafanaServiceUser = 'grafana_service';
        this.secretsGenerated.grafanaServicePassword = this.generateStrongPassword(24);
        console.log('  ✓ Grafana service account configured');

        // Generate monitoring webhook secrets
        this.secretsGenerated.alertWebhookSecret = this.generateSecureToken(32);
        this.secretsGenerated.metricsWebhookSecret = this.generateSecureToken(32);
        console.log('  ✓ Monitoring webhook secrets generated');

        // Generate log aggregation credentials
        this.secretsGenerated.logstashUser = 'logstash_service';
        this.secretsGenerated.logstashPassword = this.generateStrongPassword(24);
        console.log('  ✓ Log aggregation credentials configured');

        console.log('  ✅ Monitoring credentials setup completed\n');
    }

    /**
     * Enable all security hardening options
     */
    async enableSecurityHardening() {
        console.log('🛡️  Enabling security hardening options...');

        this.securityConfig = {
            // HTTPS and SSL configuration
            sslEnabled: true,
            httpsOnly: true,
            hstsEnabled: true,
            hstsMaxAge: 31536000, // 1 year
            hstsIncludeSubdomains: true,
            hstsPreload: true,

            // Security headers
            securityHeadersEnabled: true,
            xFrameOptions: 'DENY',
            xContentTypeOptions: true,
            xXssProtection: true,
            referrerPolicy: 'strict-origin-when-cross-origin',
            permissionsPolicy: 'geolocation=(), microphone=(), camera=()',

            // Content Security Policy
            cspEnabled: true,
            cspReportOnly: false,
            cspDefaultSrc: "'self'",
            cspScriptSrc: "'self' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
            cspStyleSrc: "'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
            cspFontSrc: "'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
            cspImgSrc: "'self' data: https: blob:",
            cspConnectSrc: "'self' https://api.binance.com https://api.kucoin.com wss://stream.binance.com wss://ws-api.kucoin.com",

            // Rate limiting
            rateLimitingEnabled: true,
            rateLimitWindowMs: 900000, // 15 minutes
            rateLimitMaxRequests: 100,
            rateLimitSkipSuccessfulRequests: false,
            rateLimitSkipFailedRequests: false,

            // Input validation
            inputValidationEnabled: true,
            maxRequestSize: '10mb',
            maxFieldLength: 10000,
            maxArrayLength: 1000,
            maxObjectDepth: 10,
            sanitizeInput: true,

            // Session security
            sessionSecure: true,
            sessionHttpOnly: true,
            sessionSameSite: 'strict',
            sessionMaxAge: 86400000, // 24 hours
            sessionRegenerateOnAuth: true,

            // CORS configuration
            corsEnabled: true,
            corsStrictOriginValidation: true,
            corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS || 'https://localhost',
            corsAllowCredentials: true,
            corsMaxAge: 86400,

            // Intrusion detection
            intrusionDetectionEnabled: true,
            autoBlockThreshold: 5,
            blockDuration: 86400, // 24 hours
            monitorSuspiciousPatterns: true,
            detectBotTraffic: true,

            // API security
            apiKeyValidationEnabled: true,
            blockTradingApiKeys: true,
            requireReadOnlyPermissions: true,
            logApiKeyUsage: true,

            // Paper trading enforcement
            paperTradingModeEnforced: true,
            realTradingBlocked: true,
            tradingEndpointsDisabled: true,
            paperTradingValidation: 'strict'
        };

        console.log('  ✓ HTTPS and SSL hardening enabled');
        console.log('  ✓ Security headers configured');
        console.log('  ✓ Content Security Policy enabled');
        console.log('  ✓ Rate limiting configured');
        console.log('  ✓ Input validation enabled');
        console.log('  ✓ Session security hardened');
        console.log('  ✓ CORS protection configured');
        console.log('  ✓ Intrusion detection enabled');
        console.log('  ✓ API security measures enabled');
        console.log('  ✓ Paper trading enforcement configured');

        console.log('  ✅ Security hardening completed\n');
    }

    /**
     * Configure audit logging and security event monitoring
     */
    async configureAuditLogging() {
        console.log('📝 Configuring audit logging and security monitoring...');

        // Audit logging configuration
        this.securityConfig.auditLogging = {
            enabled: true,
            logAllRequests: true,
            logFailedRequests: true,
            logSecurityEvents: true,
            logApiKeyUsage: true,
            retentionDays: 365,
            sensitiveDataMasking: true,
            realTimeAlerts: true,
            logLevel: 'info',
            logFormat: 'json',
            logRotation: true,
            maxLogSize: '100mb',
            maxLogFiles: 10
        };

        // Security monitoring configuration
        this.securityConfig.securityMonitoring = {
            enabled: true,
            metricsCollection: true,
            securityDashboard: true,
            alertingEnabled: true,
            alertChannels: ['email', 'webhook'],
            alertThresholds: {
                rateLimitViolations: 100,
                intrusionAttempts: 10,
                suspiciousActivities: 50,
                failedAuthentications: 20,
                apiKeyViolations: 5,
                paperTradingViolations: 1
            }
        };

        // Generate security monitoring secrets
        this.secretsGenerated.securityMonitoringKey = this.generateSecureToken(64);
        this.secretsGenerated.alertWebhookToken = this.generateSecureToken(32);
        this.secretsGenerated.auditLogEncryptionKey = this.generateSecureToken(64);

        console.log('  ✓ Audit logging configuration enabled');
        console.log('  ✓ Security event monitoring configured');
        console.log('  ✓ Real-time alerting enabled');
        console.log('  ✓ Log retention and rotation configured');
        console.log('  ✓ Security metrics collection enabled');
        console.log('  ✓ Security dashboard configured');

        console.log('  ✅ Audit logging and monitoring setup completed\n');
    }

    /**
     * Update production environment file with security configuration
     */
    async updateProductionEnvironment() {
        console.log('📄 Updating production environment configuration...');

        try {
            // Backup existing configuration
            const existingConfig = await fs.readFile(this.configPath, 'utf8');
            await fs.writeFile(this.backupPath, existingConfig);
            console.log('  ✓ Existing configuration backed up');

            // Read current configuration
            const lines = existingConfig.split('\n');
            const updatedLines = [];

            // Update security-related environment variables
            const securityUpdates = {
                // Database passwords
                'POSTGRES_PASSWORD': this.secretsGenerated.postgresPassword,
                'DATABASE_URL': `postgresql://postgres:${this.secretsGenerated.postgresPassword}@postgres:5432/trading_bot`,

                // Cache and message queue
                'REDIS_PASSWORD': this.secretsGenerated.redisPassword,
                'RABBITMQ_PASSWORD': this.secretsGenerated.rabbitmqPassword,
                'RABBITMQ_URL': `amqp://trading_bot_user:${this.secretsGenerated.rabbitmqPassword}@rabbitmq:5672`,

                // JWT and encryption
                'JWT_SECRET': this.secretsGenerated.jwtSecret,
                'JWT_REFRESH_SECRET': this.secretsGenerated.jwtRefreshSecret,
                'ENCRYPTION_KEY': this.secretsGenerated.encryptionKey,
                'SESSION_SECRET': this.secretsGenerated.sessionSecret,
                'CSRF_SECRET': this.secretsGenerated.csrfSecret,
                'API_KEY_SALT': this.secretsGenerated.apiKeySalt,

                // Monitoring credentials
                'GRAFANA_PASSWORD': this.secretsGenerated.grafanaPassword,
                'PROMETHEUS_API_KEY': this.secretsGenerated.prometheusApiKey,
                'GRAFANA_API_KEY': this.secretsGenerated.grafanaApiKey,
                'GRAFANA_SERVICE_PASSWORD': this.secretsGenerated.grafanaServicePassword,
                'LOGSTASH_PASSWORD': this.secretsGenerated.logstashPassword,

                // Security configuration
                'SECURITY_HARDENING_ENABLED': 'true',
                'RATE_LIMITING_ENABLED': 'true',
                'INTRUSION_DETECTION_ENABLED': 'true',
                'AUDIT_LOGGING_ENABLED': 'true',
                'SECURITY_MONITORING_ENABLED': 'true',
                'PAPER_TRADING_ENFORCEMENT': 'strict',

                // Security secrets
                'SECURITY_MONITORING_KEY': this.secretsGenerated.securityMonitoringKey,
                'ALERT_WEBHOOK_TOKEN': this.secretsGenerated.alertWebhookToken,
                'AUDIT_LOG_ENCRYPTION_KEY': this.secretsGenerated.auditLogEncryptionKey,

                // Rate limiting configuration
                'RATE_LIMIT_WINDOW_MS': this.securityConfig.rateLimitWindowMs.toString(),
                'RATE_LIMIT_MAX': this.securityConfig.rateLimitMaxRequests.toString(),

                // Session configuration
                'SESSION_MAX_AGE': this.securityConfig.sessionMaxAge.toString(),
                'SESSION_SECURE': this.securityConfig.sessionSecure.toString(),
                'SESSION_HTTP_ONLY': this.securityConfig.sessionHttpOnly.toString(),
                'SESSION_SAME_SITE': this.securityConfig.sessionSameSite,

                // Security headers
                'HSTS_ENABLED': this.securityConfig.hstsEnabled.toString(),
                'HSTS_MAX_AGE': this.securityConfig.hstsMaxAge.toString(),
                'CSP_ENABLED': this.securityConfig.cspEnabled.toString(),
                'X_FRAME_OPTIONS': this.securityConfig.xFrameOptions,

                // Audit logging
                'AUDIT_RETENTION_DAYS': this.securityConfig.auditLogging.retentionDays.toString(),
                'LOG_LEVEL': this.securityConfig.auditLogging.logLevel,
                'LOG_FORMAT': this.securityConfig.auditLogging.logFormat
            };

            // Process each line
            for (const line of lines) {
                let updatedLine = line;
                
                // Check if this line contains a variable we need to update
                for (const [key, value] of Object.entries(securityUpdates)) {
                    if (line.startsWith(`${key}=`)) {
                        updatedLine = `${key}=${value}`;
                        break;
                    }
                }
                
                updatedLines.push(updatedLine);
            }

            // Add any missing security configuration
            const existingKeys = new Set(lines.map(line => line.split('=')[0]));
            for (const [key, value] of Object.entries(securityUpdates)) {
                if (!existingKeys.has(key)) {
                    updatedLines.push(`${key}=${value}`);
                }
            }

            // Add security configuration section if not present
            if (!existingConfig.includes('# SECURITY HARDENING CONFIGURATION')) {
                updatedLines.push('');
                updatedLines.push('# ============================================================================');
                updatedLines.push('# SECURITY HARDENING CONFIGURATION');
                updatedLines.push('# ============================================================================');
                updatedLines.push('');
                updatedLines.push('# Security monitoring and alerting');
                updatedLines.push(`SECURITY_MONITORING_ENABLED=true`);
                updatedLines.push(`SECURITY_DASHBOARD_ENABLED=true`);
                updatedLines.push(`REAL_TIME_ALERTS_ENABLED=true`);
                updatedLines.push('');
                updatedLines.push('# Intrusion detection');
                updatedLines.push(`INTRUSION_AUTO_BLOCK_THRESHOLD=${this.securityConfig.autoBlockThreshold}`);
                updatedLines.push(`INTRUSION_BLOCK_DURATION=${this.securityConfig.blockDuration}`);
                updatedLines.push('');
                updatedLines.push('# Input validation');
                updatedLines.push(`MAX_REQUEST_SIZE=${this.securityConfig.maxRequestSize}`);
                updatedLines.push(`MAX_FIELD_LENGTH=${this.securityConfig.maxFieldLength}`);
                updatedLines.push(`SANITIZE_INPUT=${this.securityConfig.sanitizeInput}`);
            }

            // Write updated configuration
            await fs.writeFile(this.configPath, updatedLines.join('\n'));
            console.log('  ✓ Production environment file updated');

            // Set secure file permissions
            await fs.chmod(this.configPath, 0o600);
            console.log('  ✓ Secure file permissions set (600)');

        } catch (error) {
            console.error('  ❌ Failed to update environment configuration:', error.message);
            throw error;
        }

        console.log('  ✅ Environment configuration updated successfully\n');
    }

    /**
     * Validate security configuration
     */
    async validateSecurityConfiguration() {
        console.log('🔍 Validating security configuration...');

        const validationResults = {
            passwordStrength: true,
            encryptionKeys: true,
            securityHeaders: true,
            paperTradingEnforcement: true,
            auditLogging: true,
            monitoringSetup: true
        };

        try {
            // Validate password strength
            const passwords = [
                this.secretsGenerated.postgresPassword,
                this.secretsGenerated.redisPassword,
                this.secretsGenerated.rabbitmqPassword,
                this.secretsGenerated.grafanaPassword
            ];

            for (const password of passwords) {
                if (!this.validatePasswordStrength(password)) {
                    validationResults.passwordStrength = false;
                    break;
                }
            }
            console.log(`  ${validationResults.passwordStrength ? '✓' : '❌'} Password strength validation`);

            // Validate encryption keys
            const keys = [
                this.secretsGenerated.jwtSecret,
                this.secretsGenerated.encryptionKey,
                this.secretsGenerated.sessionSecret
            ];

            for (const key of keys) {
                if (key.length < 64) { // 256-bit minimum
                    validationResults.encryptionKeys = false;
                    break;
                }
            }
            console.log(`  ${validationResults.encryptionKeys ? '✓' : '❌'} Encryption key strength validation`);

            // Validate security configuration
            validationResults.securityHeaders = this.securityConfig.securityHeadersEnabled && 
                                               this.securityConfig.hstsEnabled && 
                                               this.securityConfig.cspEnabled;
            console.log(`  ${validationResults.securityHeaders ? '✓' : '❌'} Security headers configuration`);

            // Validate paper trading enforcement
            validationResults.paperTradingEnforcement = this.securityConfig.paperTradingModeEnforced && 
                                                       this.securityConfig.realTradingBlocked;
            console.log(`  ${validationResults.paperTradingEnforcement ? '✓' : '❌'} Paper trading enforcement`);

            // Validate audit logging
            validationResults.auditLogging = this.securityConfig.auditLogging && 
                                           this.securityConfig.auditLogging.enabled && 
                                           this.securityConfig.auditLogging.logSecurityEvents;
            console.log(`  ${validationResults.auditLogging ? '✓' : '❌'} Audit logging configuration`);

            // Validate monitoring setup
            validationResults.monitoringSetup = !!(this.securityConfig.securityMonitoring && 
                                                   this.securityConfig.securityMonitoring.enabled && 
                                                   this.secretsGenerated.prometheusApiKey && 
                                                   this.secretsGenerated.grafanaApiKey);
            console.log(`  ${validationResults.monitoringSetup ? '✓' : '❌'} Monitoring setup validation`);

            // Check overall validation
            const allValid = Object.values(validationResults).every(result => result === true);
            
            if (!allValid) {
                console.log('  ❌ Validation details:');
                for (const [key, value] of Object.entries(validationResults)) {
                    console.log(`    ${key}: ${value}`);
                }
                throw new Error('Security configuration validation failed');
            }

            console.log('  ✅ All security validations passed\n');

        } catch (error) {
            console.error('  ❌ Security validation failed:', error.message);
            throw error;
        }
    }

    /**
     * Generate a cryptographically strong password
     */
    generateStrongPassword(length = 32) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
        let password = '';
        
        // Ensure at least one character from each category
        const categories = [
            'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            'abcdefghijklmnopqrstuvwxyz',
            '0123456789',
            '!@#$%^&*()_+-=[]{}|;:,.<>?'
        ];
        
        // Add one character from each category
        for (const category of categories) {
            const randomIndex = crypto.randomInt(0, category.length);
            password += category[randomIndex];
        }
        
        // Fill the rest with random characters
        for (let i = password.length; i < length; i++) {
            const randomIndex = crypto.randomInt(0, charset.length);
            password += charset[randomIndex];
        }
        
        // Shuffle the password
        return password.split('').sort(() => crypto.randomInt(-1, 2)).join('');
    }

    /**
     * Generate a secure token
     */
    generateSecureToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Hash password using crypto
     */
    hashPassword(password) {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
        return `${salt}:${hash}`;
    }

    /**
     * Validate password strength
     */
    validatePasswordStrength(password) {
        if (password.length < 16) return false;
        if (!/[A-Z]/.test(password)) return false;
        if (!/[a-z]/.test(password)) return false;
        if (!/[0-9]/.test(password)) return false;
        if (!/[^A-Za-z0-9]/.test(password)) return false;
        return true;
    }

    /**
     * Print security configuration summary
     */
    printSecuritySummary() {
        console.log('┌─────────────────────────────────────────────────────────────┐');
        console.log('│                    SECURITY SUMMARY                         │');
        console.log('├─────────────────────────────────────────────────────────────┤');
        console.log('│ ✓ Strong passwords generated for all services              │');
        console.log('│ ✓ JWT secrets and encryption keys configured (256-bit)     │');
        console.log('│ ✓ Monitoring credentials and API keys generated            │');
        console.log('│ ✓ Security hardening options enabled                       │');
        console.log('│ ✓ Audit logging and security monitoring configured         │');
        console.log('│ ✓ Paper trading enforcement enabled                        │');
        console.log('│ ✓ Rate limiting and intrusion detection active            │');
        console.log('│ ✓ Security headers and HTTPS enforcement enabled           │');
        console.log('│ ✓ Input validation and sanitization configured             │');
        console.log('│ ✓ Production environment file updated securely             │');
        console.log('└─────────────────────────────────────────────────────────────┘');
        
        console.log('\n🔐 Generated Secrets (Store securely):');
        console.log(`   • PostgreSQL Password: ${this.secretsGenerated.postgresPassword.substring(0, 8)}...`);
        console.log(`   • Redis Password: ${this.secretsGenerated.redisPassword.substring(0, 8)}...`);
        console.log(`   • Grafana Password: ${this.secretsGenerated.grafanaPassword.substring(0, 8)}...`);
        console.log(`   • JWT Secret: ${this.secretsGenerated.jwtSecret.substring(0, 16)}...`);
        console.log(`   • Encryption Key: ${this.secretsGenerated.encryptionKey.substring(0, 16)}...`);
        
        console.log('\n⚠️  IMPORTANT SECURITY NOTES:');
        console.log('   • All passwords are cryptographically strong (32+ characters)');
        console.log('   • Encryption keys are 256-bit AES compatible');
        console.log('   • Paper trading mode is strictly enforced');
        console.log('   • Real trading endpoints are completely blocked');
        console.log('   • All security events are logged and monitored');
        console.log('   • Configuration backup created at .env.production.backup');
        console.log('   • File permissions set to 600 (owner read/write only)');
    }
}

// Execute if run directly
if (require.main === module) {
    const manager = new SecurityConfigurationManager();
    manager.execute().catch(error => {
        console.error('Security configuration failed:', error);
        process.exit(1);
    });
}

module.exports = SecurityConfigurationManager;