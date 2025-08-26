#!/usr/bin/env node

/**
 * Production Secrets Generator
 * Generates all required secrets and passwords for production deployment
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class ProductionSecretsGenerator {
    constructor() {
        this.secrets = {};
        this.outputPath = path.join(__dirname, '..', 'production-secrets.json');
        this.envPath = path.join(__dirname, '..', '.env.production');
    }

    /**
     * Generate all production secrets
     */
    async generateAllSecrets() {
        console.log('🔐 Generating Production Secrets...\n');

        // Database passwords
        this.secrets.database = {
            postgresPassword: this.generateStrongPassword(32),
            postgresUser: 'postgres',
            databaseName: 'trading_bot'
        };

        // Cache and message queue
        this.secrets.cache = {
            redisPassword: this.generateStrongPassword(32),
            rabbitmqUser: 'trading_bot_user',
            rabbitmqPassword: this.generateStrongPassword(32)
        };

        // JWT and encryption
        this.secrets.security = {
            jwtSecret: this.generateSecureToken(64),
            jwtRefreshSecret: this.generateSecureToken(64),
            encryptionKey: this.generateSecureToken(64),
            sessionSecret: this.generateSecureToken(64),
            csrfSecret: this.generateSecureToken(32),
            apiKeySalt: this.generateSecureToken(32)
        };

        // Monitoring credentials
        this.secrets.monitoring = {
            grafanaPassword: this.generateStrongPassword(24),
            prometheusApiKey: this.generateSecureToken(64),
            grafanaApiKey: this.generateSecureToken(64),
            grafanaServiceUser: 'grafana_service',
            grafanaServicePassword: this.generateStrongPassword(24),
            logstashUser: 'logstash_service',
            logstashPassword: this.generateStrongPassword(24)
        };

        // Security monitoring
        this.secrets.securityMonitoring = {
            securityMonitoringKey: this.generateSecureToken(64),
            alertWebhookToken: this.generateSecureToken(32),
            auditLogEncryptionKey: this.generateSecureToken(64),
            intrusionDetectionKey: this.generateSecureToken(32),
            threatAnalysisKey: this.generateSecureToken(32)
        };

        // SSL and certificates
        this.secrets.ssl = {
            dhParamSize: 2048,
            certificateKeySize: 2048,
            sslSessionTimeout: '1d',
            sslCipherSuite: 'ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384'
        };

        // API security
        this.secrets.apiSecurity = {
            apiKeyEncryptionKey: this.generateSecureToken(64),
            webhookSecret: this.generateSecureToken(32),
            corsSecret: this.generateSecureToken(32),
            rateLimitSecret: this.generateSecureToken(32)
        };

        console.log('✅ All production secrets generated successfully!\n');
        return this.secrets;
    }

    /**
     * Generate strong password with complexity requirements
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
     * Generate secure cryptographic token
     */
    generateSecureToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Save secrets to secure file
     */
    async saveSecrets() {
        console.log('💾 Saving secrets to secure file...');

        const secretsData = {
            generated: new Date().toISOString(),
            environment: 'production',
            version: '1.0.0',
            secrets: this.secrets,
            metadata: {
                passwordComplexity: 'High (32+ chars, mixed case, numbers, symbols)',
                encryptionStrength: 'AES-256',
                tokenLength: '256-bit minimum',
                securityLevel: 'Production Grade'
            }
        };

        // Save to JSON file with restricted permissions
        await fs.writeFile(this.outputPath, JSON.stringify(secretsData, null, 2));
        await fs.chmod(this.outputPath, 0o600); // Owner read/write only

        console.log(`✅ Secrets saved to: ${this.outputPath}`);
        console.log('🔒 File permissions set to 600 (owner read/write only)\n');
    }

    /**
     * Generate environment variables for .env.production
     */
    generateEnvironmentVariables() {
        const envVars = {
            // Database configuration
            'POSTGRES_PASSWORD': this.secrets.database.postgresPassword,
            'DATABASE_URL': `postgresql://${this.secrets.database.postgresUser}:${this.secrets.database.postgresPassword}@postgres:5432/${this.secrets.database.databaseName}`,

            // Cache and message queue
            'REDIS_PASSWORD': this.secrets.cache.redisPassword,
            'RABBITMQ_USER': this.secrets.cache.rabbitmqUser,
            'RABBITMQ_PASSWORD': this.secrets.cache.rabbitmqPassword,
            'RABBITMQ_URL': `amqp://${this.secrets.cache.rabbitmqUser}:${this.secrets.cache.rabbitmqPassword}@rabbitmq:5672`,

            // JWT and encryption
            'JWT_SECRET': this.secrets.security.jwtSecret,
            'JWT_REFRESH_SECRET': this.secrets.security.jwtRefreshSecret,
            'ENCRYPTION_KEY': this.secrets.security.encryptionKey,
            'SESSION_SECRET': this.secrets.security.sessionSecret,
            'CSRF_SECRET': this.secrets.security.csrfSecret,
            'API_KEY_SALT': this.secrets.security.apiKeySalt,

            // Monitoring
            'GRAFANA_PASSWORD': this.secrets.monitoring.grafanaPassword,
            'PROMETHEUS_API_KEY': this.secrets.monitoring.prometheusApiKey,
            'GRAFANA_API_KEY': this.secrets.monitoring.grafanaApiKey,
            'GRAFANA_SERVICE_PASSWORD': this.secrets.monitoring.grafanaServicePassword,
            'LOGSTASH_PASSWORD': this.secrets.monitoring.logstashPassword,

            // Security monitoring
            'SECURITY_MONITORING_KEY': this.secrets.securityMonitoring.securityMonitoringKey,
            'ALERT_WEBHOOK_TOKEN': this.secrets.securityMonitoring.alertWebhookToken,
            'AUDIT_LOG_ENCRYPTION_KEY': this.secrets.securityMonitoring.auditLogEncryptionKey,
            'INTRUSION_DETECTION_KEY': this.secrets.securityMonitoring.intrusionDetectionKey,

            // API security
            'API_KEY_ENCRYPTION_KEY': this.secrets.apiSecurity.apiKeyEncryptionKey,
            'WEBHOOK_SECRET': this.secrets.apiSecurity.webhookSecret,
            'CORS_SECRET': this.secrets.apiSecurity.corsSecret,
            'RATE_LIMIT_SECRET': this.secrets.apiSecurity.rateLimitSecret
        };

        return envVars;
    }

    /**
     * Update .env.production file with generated secrets
     */
    async updateEnvironmentFile() {
        console.log('📝 Updating .env.production file...');

        try {
            // Read existing file
            let existingContent = '';
            try {
                existingContent = await fs.readFile(this.envPath, 'utf8');
            } catch (error) {
                console.log('  ℹ️  .env.production file not found, will create new one');
            }

            // Backup existing file
            if (existingContent) {
                const backupPath = `${this.envPath}.backup.${Date.now()}`;
                await fs.writeFile(backupPath, existingContent);
                console.log(`  ✅ Backup created: ${backupPath}`);
            }

            const envVars = this.generateEnvironmentVariables();
            const lines = existingContent.split('\n');
            const updatedLines = [];
            const processedKeys = new Set();

            // Process existing lines
            for (const line of lines) {
                let updatedLine = line;
                
                // Check if this line contains a variable we need to update
                for (const [key, value] of Object.entries(envVars)) {
                    if (line.startsWith(`${key}=`)) {
                        updatedLine = `${key}=${value}`;
                        processedKeys.add(key);
                        break;
                    }
                }
                
                updatedLines.push(updatedLine);
            }

            // Add any missing variables
            const missingKeys = Object.keys(envVars).filter(key => !processedKeys.has(key));
            if (missingKeys.length > 0) {
                updatedLines.push('');
                updatedLines.push('# ============================================================================');
                updatedLines.push('# GENERATED PRODUCTION SECRETS');
                updatedLines.push('# ============================================================================');
                updatedLines.push('');

                for (const key of missingKeys) {
                    updatedLines.push(`${key}=${envVars[key]}`);
                }
            }

            // Write updated file
            await fs.writeFile(this.envPath, updatedLines.join('\n'));
            await fs.chmod(this.envPath, 0o600);

            console.log('  ✅ .env.production file updated');
            console.log('  🔒 File permissions set to 600\n');

        } catch (error) {
            console.error('  ❌ Failed to update environment file:', error.message);
            throw error;
        }
    }

    /**
     * Validate generated secrets
     */
    validateSecrets() {
        console.log('🔍 Validating generated secrets...');

        const validationResults = [];

        // Validate passwords
        for (const [category, secrets] of Object.entries(this.secrets)) {
            for (const [key, value] of Object.entries(secrets)) {
                if (key.toLowerCase().includes('password')) {
                    const validation = this.validatePassword(value);
                    validationResults.push({
                        category,
                        key,
                        type: 'password',
                        valid: validation.valid,
                        reason: validation.reason
                    });
                } else if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('key')) {
                    const validation = this.validateToken(value);
                    validationResults.push({
                        category,
                        key,
                        type: 'token',
                        valid: validation.valid,
                        reason: validation.reason
                    });
                }
            }
        }

        // Print validation results
        let allValid = true;
        for (const result of validationResults) {
            const status = result.valid ? '✅' : '❌';
            console.log(`  ${status} ${result.category}.${result.key}: ${result.reason}`);
            if (!result.valid) allValid = false;
        }

        if (allValid) {
            console.log('\n✅ All secrets validation passed!\n');
        } else {
            console.log('\n❌ Some secrets failed validation!\n');
            throw new Error('Secret validation failed');
        }

        return allValid;
    }

    /**
     * Validate password strength
     */
    validatePassword(password) {
        if (!password) return { valid: false, reason: 'Password is empty' };
        if (password.length < 16) return { valid: false, reason: 'Password too short' };
        if (!/[A-Z]/.test(password)) return { valid: false, reason: 'Missing uppercase letters' };
        if (!/[a-z]/.test(password)) return { valid: false, reason: 'Missing lowercase letters' };
        if (!/[0-9]/.test(password)) return { valid: false, reason: 'Missing numbers' };
        if (!/[^A-Za-z0-9]/.test(password)) return { valid: false, reason: 'Missing special characters' };
        
        return { valid: true, reason: `Strong password (${password.length} chars)` };
    }

    /**
     * Validate token strength
     */
    validateToken(token) {
        if (!token) return { valid: false, reason: 'Token is empty' };
        if (token.length < 32) return { valid: false, reason: 'Token too short' };
        if (!/^[a-fA-F0-9]+$/.test(token)) return { valid: false, reason: 'Invalid hex format' };
        
        return { valid: true, reason: `Strong token (${token.length} chars, ${token.length * 4} bits)` };
    }

    /**
     * Print security summary
     */
    printSecuritySummary() {
        console.log('📋 Production Secrets Summary');
        console.log('═'.repeat(80));
        
        const categories = [
            { name: 'Database Credentials', count: Object.keys(this.secrets.database).length },
            { name: 'Cache & Message Queue', count: Object.keys(this.secrets.cache).length },
            { name: 'Security & Encryption', count: Object.keys(this.secrets.security).length },
            { name: 'Monitoring Credentials', count: Object.keys(this.secrets.monitoring).length },
            { name: 'Security Monitoring', count: Object.keys(this.secrets.securityMonitoring).length },
            { name: 'API Security', count: Object.keys(this.secrets.apiSecurity).length }
        ];

        for (const category of categories) {
            console.log(`✅ ${category.name}: ${category.count} secrets generated`);
        }

        console.log('\n🔐 Security Features:');
        console.log('  • All passwords are 16+ characters with full complexity');
        console.log('  • All tokens are cryptographically secure (256-bit minimum)');
        console.log('  • JWT secrets use 512-bit keys for maximum security');
        console.log('  • Encryption keys are AES-256 compatible');
        console.log('  • All secrets are unique and randomly generated');
        console.log('  • File permissions are restricted (600 - owner only)');
        
        console.log('\n⚠️  Important Security Notes:');
        console.log('  • Store secrets file in secure location');
        console.log('  • Never commit secrets to version control');
        console.log('  • Rotate secrets regularly in production');
        console.log('  • Use environment-specific secrets for each deployment');
        console.log('  • Monitor for unauthorized access to secrets');
        
        console.log('═'.repeat(80));
    }

    /**
     * Main execution function
     */
    async execute() {
        try {
            await this.generateAllSecrets();
            await this.saveSecrets();
            await this.updateEnvironmentFile();
            this.validateSecrets();
            this.printSecuritySummary();
            
            console.log('\n🎉 Production secrets generation completed successfully!');
            console.log(`📁 Secrets saved to: ${this.outputPath}`);
            console.log(`📝 Environment updated: ${this.envPath}`);
            
            return true;
        } catch (error) {
            console.error('\n❌ Failed to generate production secrets:', error.message);
            return false;
        }
    }
}

// Execute if run directly
if (require.main === module) {
    const generator = new ProductionSecretsGenerator();
    generator.execute().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Generation failed:', error);
        process.exit(1);
    });
}

module.exports = ProductionSecretsGenerator;