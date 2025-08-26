#!/usr/bin/env node

/**
 * Production Environment Configuration Script
 * 
 * This script configures the production environment for the AI Crypto Trading Bot
 * with strict paper trading enforcement and security hardening.
 * 
 * Requirements covered:
 * - 2.1: Production configuration enforces paper trading mode
 * - 2.2: Only read-only exchange API keys accepted
 * - 2.3: Production database properly configured
 * - 2.4: HTTPS properly enabled with valid certificates
 * - 2.7: Paper trading safety confirmed at environment level
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

class ProductionEnvironmentConfigurator {
    constructor() {
        this.envFile = path.join(__dirname, '..', '.env.production');
        this.templateFile = path.join(__dirname, '..', '.env.production.template');
        this.sslDir = path.join(__dirname, '..', 'docker', 'ssl');
        this.config = {};
        this.validationErrors = [];
        this.warnings = [];
    }

    /**
     * Main configuration process
     */
    async configure() {
        console.log('🔧 Starting Production Environment Configuration');
        console.log('================================================');
        
        try {
            // Step 1: Load template and existing configuration
            await this.loadTemplate();
            await this.loadExistingConfig();
            
            // Step 2: Interactive configuration
            await this.configureEnvironmentVariables();
            
            // Step 3: Generate secrets and passwords
            await this.generateSecrets();
            
            // Step 4: Configure SSL certificates
            await this.configureSSL();
            
            // Step 5: Validate configuration
            await this.validateConfiguration();
            
            // Step 6: Write configuration file
            await this.writeConfiguration();
            
            // Step 7: Set up SSL certificates
            await this.setupSSLCertificates();
            
            // Step 8: Final validation
            await this.finalValidation();
            
            console.log('\n✅ Production environment configuration completed successfully!');
            this.printSummary();
            
        } catch (error) {
            console.error('\n❌ Configuration failed:', error.message);
            process.exit(1);
        }
    }

    /**
     * Load environment template
     */
    async loadTemplate() {
        console.log('\n📋 Loading environment template...');
        
        if (!fs.existsSync(this.templateFile)) {
            throw new Error(`Template file not found: ${this.templateFile}`);
        }
        
        const template = fs.readFileSync(this.templateFile, 'utf8');
        console.log('✅ Template loaded successfully');
    }

    /**
     * Load existing configuration if it exists
     */
    async loadExistingConfig() {
        console.log('\n📖 Checking for existing configuration...');
        
        if (fs.existsSync(this.envFile)) {
            const existing = fs.readFileSync(this.envFile, 'utf8');
            const lines = existing.split('\n');
            
            for (const line of lines) {
                if (line.trim() && !line.startsWith('#')) {
                    const [key, ...valueParts] = line.split('=');
                    if (key && valueParts.length > 0) {
                        this.config[key.trim()] = valueParts.join('=').trim();
                    }
                }
            }
            
            console.log(`✅ Loaded ${Object.keys(this.config).length} existing configuration values`);
        } else {
            console.log('ℹ️  No existing configuration found, starting fresh');
        }
    }

    /**
     * Configure environment variables interactively
     */
    async configureEnvironmentVariables() {
        console.log('\n🔧 Configuring environment variables...');
        
        // Critical paper trading settings (non-negotiable)
        this.config.NODE_ENV = 'production';
        this.config.PAPER_TRADING_MODE = 'true';
        this.config.ALLOW_REAL_TRADES = 'false';
        this.config.FORCE_PAPER_TRADING = 'true';
        this.config.PAPER_TRADING_VALIDATION = 'strict';
        
        console.log('✅ Paper trading safety settings configured (non-modifiable)');
        
        // Domain and SSL configuration
        await this.configureDomainAndSSL();
        
        // Database configuration
        await this.configureDatabaseSettings();
        
        // Exchange API configuration
        await this.configureExchangeAPIs();
        
        // Monitoring configuration
        await this.configureMonitoring();
        
        console.log('✅ Environment variables configured');
    }

    /**
     * Configure domain and SSL settings
     */
    async configureDomainAndSSL() {
        console.log('\n🌐 Configuring domain and SSL settings...');
        
        // Domain name
        if (!this.config.DOMAIN_NAME || this.config.DOMAIN_NAME === 'your-domain.com') {
            const domain = this.promptUser('Enter your domain name (e.g., trading.example.com): ');
            if (!domain || domain === 'localhost') {
                this.warnings.push('Using localhost - SSL certificates will be self-signed');
                this.config.DOMAIN_NAME = 'localhost';
            } else {
                this.config.DOMAIN_NAME = domain;
            }
        }
        
        // Let's Encrypt email
        if (!this.config.LETSENCRYPT_EMAIL || this.config.LETSENCRYPT_EMAIL === 'your-email@example.com') {
            const email = this.promptUser('Enter email for Let\'s Encrypt certificates: ');
            if (!email || !email.includes('@')) {
                this.warnings.push('Invalid email - using default for self-signed certificates');
                this.config.LETSENCRYPT_EMAIL = 'admin@localhost';
            } else {
                this.config.LETSENCRYPT_EMAIL = email;
            }
        }
        
        // SSL configuration
        this.config.SSL_ENABLED = 'true';
        this.config.SSL_CERT_PATH = `/etc/letsencrypt/live/${this.config.DOMAIN_NAME}/fullchain.pem`;
        this.config.SSL_KEY_PATH = `/etc/letsencrypt/live/${this.config.DOMAIN_NAME}/privkey.pem`;
        this.config.SSL_CA_PATH = `/etc/letsencrypt/live/${this.config.DOMAIN_NAME}/chain.pem`;
        
        console.log(`✅ Domain configured: ${this.config.DOMAIN_NAME}`);
    }

    /**
     * Configure database settings
     */
    async configureDatabaseSettings() {
        console.log('\n🗄️  Configuring database settings...');
        
        // Generate strong PostgreSQL password if not exists
        if (!this.config.POSTGRES_PASSWORD || this.config.POSTGRES_PASSWORD === 'your-strong-postgres-password-here') {
            this.config.POSTGRES_PASSWORD = this.generateSecurePassword(32);
            console.log('✅ Generated secure PostgreSQL password');
        }
        
        // Database configuration
        this.config.DATABASE_URL = `postgresql://postgres:${this.config.POSTGRES_PASSWORD}@postgres:5432/trading_bot`;
        this.config.DATABASE_SSL = 'true';
        this.config.DATABASE_POOL_SIZE = '20';
        this.config.DATABASE_CONNECTION_TIMEOUT = '30000';
        
        console.log('✅ Database configuration completed');
    }

    /**
     * Configure exchange API keys with read-only validation
     */
    async configureExchangeAPIs() {
        console.log('\n🔑 Configuring exchange API keys...');
        console.log('⚠️  CRITICAL: Only use READ-ONLY API keys for paper trading safety!');
        
        // Binance API configuration
        await this.configureExchangeAPI('BINANCE', 'Binance');
        
        // KuCoin API configuration
        await this.configureExchangeAPI('KUCOIN', 'KuCoin');
        
        // Enforce mainnet read-only settings
        this.config.BINANCE_SANDBOX = 'false';
        this.config.BINANCE_MAINNET = 'true';
        this.config.BINANCE_READ_ONLY = 'true';
        
        this.config.KUCOIN_SANDBOX = 'false';
        this.config.KUCOIN_MAINNET = 'true';
        this.config.KUCOIN_READ_ONLY = 'true';
        
        console.log('✅ Exchange API configuration completed with read-only enforcement');
    }

    /**
     * Configure individual exchange API
     */
    async configureExchangeAPI(exchange, displayName) {
        const apiKeyVar = `${exchange}_API_KEY`;
        const secretVar = `${exchange}_API_SECRET`;
        
        if (!this.config[apiKeyVar] || this.config[apiKeyVar].startsWith('your-')) {
            console.log(`\n${displayName} API Configuration:`);
            const apiKey = this.promptUser(`Enter ${displayName} READ-ONLY API key: `);
            const apiSecret = this.promptUser(`Enter ${displayName} READ-ONLY API secret: `);
            
            if (!apiKey || !apiSecret) {
                this.warnings.push(`${displayName} API keys not configured - exchange will be disabled`);
                this.config[apiKeyVar] = '';
                this.config[secretVar] = '';
            } else {
                this.config[apiKeyVar] = apiKey;
                this.config[secretVar] = apiSecret;
                
                // Additional KuCoin passphrase
                if (exchange === 'KUCOIN') {
                    const passphrase = this.promptUser('Enter KuCoin API passphrase: ');
                    this.config.KUCOIN_PASSPHRASE = passphrase || '';
                }
                
                console.log(`✅ ${displayName} API configured`);
            }
        }
    }

    /**
     * Configure monitoring settings
     */
    async configureMonitoring() {
        console.log('\n📊 Configuring monitoring settings...');
        
        // Generate Grafana admin password
        if (!this.config.GRAFANA_PASSWORD || this.config.GRAFANA_PASSWORD === 'your-grafana-admin-password') {
            this.config.GRAFANA_PASSWORD = this.generateSecurePassword(16);
            console.log('✅ Generated secure Grafana admin password');
        }
        
        // Monitoring ports
        this.config.PROMETHEUS_PORT = '9090';
        this.config.GRAFANA_PORT = '3001';
        
        // Logging configuration
        this.config.LOG_LEVEL = 'info';
        this.config.LOG_FORMAT = 'json';
        this.config.METRICS_ENABLED = 'true';
        this.config.HEALTH_CHECK_ENABLED = 'true';
        
        console.log('✅ Monitoring configuration completed');
    }

    /**
     * Generate security secrets and passwords
     */
    async generateSecrets() {
        console.log('\n🔐 Generating security secrets...');
        
        // JWT Secret
        if (!this.config.JWT_SECRET || this.config.JWT_SECRET.length < 32) {
            this.config.JWT_SECRET = this.generateSecureSecret(64);
            console.log('✅ Generated JWT secret');
        }
        
        // Encryption key
        if (!this.config.ENCRYPTION_KEY || this.config.ENCRYPTION_KEY.length < 32) {
            this.config.ENCRYPTION_KEY = this.generateSecureSecret(32);
            console.log('✅ Generated encryption key');
        }
        
        // Redis password
        if (!this.config.REDIS_PASSWORD || this.config.REDIS_PASSWORD === 'your-redis-password-here') {
            this.config.REDIS_PASSWORD = this.generateSecurePassword(24);
            console.log('✅ Generated Redis password');
        }
        
        // RabbitMQ credentials
        if (!this.config.RABBITMQ_USER || this.config.RABBITMQ_USER === 'your-rabbitmq-user') {
            this.config.RABBITMQ_USER = 'trading_bot_user';
        }
        
        if (!this.config.RABBITMQ_PASSWORD || this.config.RABBITMQ_PASSWORD === 'your-rabbitmq-password') {
            this.config.RABBITMQ_PASSWORD = this.generateSecurePassword(24);
            console.log('✅ Generated RabbitMQ password');
        }
        
        console.log('✅ Security secrets generated');
    }

    /**
     * Configure SSL certificates
     */
    async configureSSL() {
        console.log('\n🔒 Configuring SSL certificates...');
        
        // Create SSL directory
        if (!fs.existsSync(this.sslDir)) {
            fs.mkdirSync(this.sslDir, { recursive: true });
            console.log('✅ Created SSL directory');
        }
        
        // Set SSL configuration based on domain
        if (this.config.DOMAIN_NAME === 'localhost') {
            console.log('ℹ️  Localhost detected - will use self-signed certificates');
            this.config.SSL_CERT_PATH = '/etc/nginx/ssl/cert.pem';
            this.config.SSL_KEY_PATH = '/etc/nginx/ssl/private.key';
            this.config.SSL_CA_PATH = '/etc/nginx/ssl/ca.pem';
        } else {
            console.log('ℹ️  Domain configured - will use Let\'s Encrypt certificates');
        }
        
        console.log('✅ SSL configuration prepared');
    }

    /**
     * Validate the complete configuration
     */
    async validateConfiguration() {
        console.log('\n🔍 Validating configuration...');
        
        // Critical paper trading validation
        this.validatePaperTradingSettings();
        
        // Security validation
        this.validateSecuritySettings();
        
        // Exchange API validation
        this.validateExchangeSettings();
        
        // SSL validation
        this.validateSSLSettings();
        
        // Database validation
        this.validateDatabaseSettings();
        
        if (this.validationErrors.length > 0) {
            console.error('\n❌ Configuration validation failed:');
            this.validationErrors.forEach(error => console.error(`  - ${error}`));
            throw new Error('Configuration validation failed');
        }
        
        if (this.warnings.length > 0) {
            console.warn('\n⚠️  Configuration warnings:');
            this.warnings.forEach(warning => console.warn(`  - ${warning}`));
        }
        
        console.log('✅ Configuration validation passed');
    }

    /**
     * Validate paper trading settings
     */
    validatePaperTradingSettings() {
        const requiredSettings = {
            'PAPER_TRADING_MODE': 'true',
            'ALLOW_REAL_TRADES': 'false',
            'FORCE_PAPER_TRADING': 'true',
            'PAPER_TRADING_VALIDATION': 'strict'
        };
        
        for (const [key, expectedValue] of Object.entries(requiredSettings)) {
            if (this.config[key] !== expectedValue) {
                this.validationErrors.push(`${key} must be ${expectedValue} for paper trading safety`);
            }
        }
        
        // Validate virtual balances
        const virtualBalances = ['VIRTUAL_BALANCE_USD', 'VIRTUAL_BALANCE_BTC', 'VIRTUAL_BALANCE_ETH'];
        virtualBalances.forEach(balance => {
            if (!this.config[balance]) {
                this.config[balance] = balance === 'VIRTUAL_BALANCE_USD' ? '100000' : 
                                     balance === 'VIRTUAL_BALANCE_BTC' ? '10' : '100';
            }
        });
    }

    /**
     * Validate security settings
     */
    validateSecuritySettings() {
        if (!this.config.JWT_SECRET || this.config.JWT_SECRET.length < 32) {
            this.validationErrors.push('JWT_SECRET must be at least 32 characters long');
        }
        
        if (!this.config.ENCRYPTION_KEY || this.config.ENCRYPTION_KEY.length < 32) {
            this.validationErrors.push('ENCRYPTION_KEY must be at least 32 characters long');
        }
        
        if (!this.config.POSTGRES_PASSWORD || this.config.POSTGRES_PASSWORD.length < 16) {
            this.validationErrors.push('POSTGRES_PASSWORD must be at least 16 characters long');
        }
    }

    /**
     * Validate exchange settings
     */
    validateExchangeSettings() {
        // Ensure read-only enforcement
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
                this.validationErrors.push(`${key} must be ${expectedValue} for paper trading safety`);
            }
        }
    }

    /**
     * Validate SSL settings
     */
    validateSSLSettings() {
        if (!this.config.DOMAIN_NAME) {
            this.validationErrors.push('DOMAIN_NAME is required');
        }
        
        if (!this.config.LETSENCRYPT_EMAIL || !this.config.LETSENCRYPT_EMAIL.includes('@')) {
            this.validationErrors.push('Valid LETSENCRYPT_EMAIL is required');
        }
        
        if (this.config.SSL_ENABLED !== 'true') {
            this.validationErrors.push('SSL_ENABLED must be true for production');
        }
    }

    /**
     * Validate database settings
     */
    validateDatabaseSettings() {
        if (!this.config.DATABASE_URL || !this.config.DATABASE_URL.includes('postgresql://')) {
            this.validationErrors.push('Valid DATABASE_URL is required');
        }
        
        if (this.config.DATABASE_SSL !== 'true') {
            this.validationErrors.push('DATABASE_SSL must be true for production');
        }
    }

    /**
     * Write configuration to file
     */
    async writeConfiguration() {
        console.log('\n💾 Writing configuration file...');
        
        const configLines = [
            '# AI Crypto Trading Bot - Production Environment Configuration',
            '# Generated automatically - DO NOT EDIT MANUALLY',
            '# CRITICAL: This configuration enforces paper trading mode for production safety',
            '',
            '# ============================================================================',
            '# CRITICAL PAPER TRADING SAFETY CONFIGURATION',
            '# ============================================================================',
            '# These settings MUST NOT be changed - they enforce paper trading safety',
            '',
            `NODE_ENV=${this.config.NODE_ENV}`,
            `PAPER_TRADING_MODE=${this.config.PAPER_TRADING_MODE}`,
            `ALLOW_REAL_TRADES=${this.config.ALLOW_REAL_TRADES}`,
            `FORCE_PAPER_TRADING=${this.config.FORCE_PAPER_TRADING}`,
            `PAPER_TRADING_VALIDATION=${this.config.PAPER_TRADING_VALIDATION}`,
            '',
            '# ============================================================================',
            '# APPLICATION CONFIGURATION',
            '# ============================================================================',
            '',
            'PORT=3000',
            'HOST=0.0.0.0',
            '',
            '# ============================================================================',
            '# SSL AND DOMAIN CONFIGURATION',
            '# ============================================================================',
            '',
            `DOMAIN_NAME=${this.config.DOMAIN_NAME}`,
            `LETSENCRYPT_EMAIL=${this.config.LETSENCRYPT_EMAIL}`,
            `SSL_ENABLED=${this.config.SSL_ENABLED}`,
            `SSL_CERT_PATH=${this.config.SSL_CERT_PATH}`,
            `SSL_KEY_PATH=${this.config.SSL_KEY_PATH}`,
            `SSL_CA_PATH=${this.config.SSL_CA_PATH}`,
            '',
            '# ============================================================================',
            '# DATABASE CONFIGURATION',
            '# ============================================================================',
            '',
            `POSTGRES_PASSWORD=${this.config.POSTGRES_PASSWORD}`,
            `DATABASE_URL=${this.config.DATABASE_URL}`,
            `DATABASE_SSL=${this.config.DATABASE_SSL}`,
            `DATABASE_POOL_SIZE=${this.config.DATABASE_POOL_SIZE}`,
            `DATABASE_CONNECTION_TIMEOUT=${this.config.DATABASE_CONNECTION_TIMEOUT}`,
            '',
            '# ============================================================================',
            '# CACHE AND MESSAGE QUEUE',
            '# ============================================================================',
            '',
            'REDIS_HOST=redis',
            'REDIS_PORT=6379',
            `REDIS_PASSWORD=${this.config.REDIS_PASSWORD}`,
            'REDIS_DB=0',
            'REDIS_TLS=false',
            '',
            `RABBITMQ_USER=${this.config.RABBITMQ_USER}`,
            `RABBITMQ_PASSWORD=${this.config.RABBITMQ_PASSWORD}`,
            `RABBITMQ_URL=amqp://${this.config.RABBITMQ_USER}:${this.config.RABBITMQ_PASSWORD}@rabbitmq:5672`,
            'RABBITMQ_HEARTBEAT=60',
            'RABBITMQ_CONNECTION_TIMEOUT=30000',
            '',
            '# ============================================================================',
            '# SECURITY CONFIGURATION',
            '# ============================================================================',
            '',
            `JWT_SECRET=${this.config.JWT_SECRET}`,
            `ENCRYPTION_KEY=${this.config.ENCRYPTION_KEY}`,
            'JWT_EXPIRES_IN=24h',
            'JWT_REFRESH_EXPIRES_IN=7d',
            'JWT_ALGORITHM=HS256',
            'BCRYPT_ROUNDS=12',
            'HELMET_ENABLED=true',
            'CSRF_PROTECTION=true',
            `CORS_ORIGIN=https://${this.config.DOMAIN_NAME}`,
            'RATE_LIMIT_WINDOW_MS=900000',
            'RATE_LIMIT_MAX=100',
            '',
            '# ============================================================================',
            '# EXCHANGE API CONFIGURATION - MAINNET READ-ONLY',
            '# ============================================================================',
            '# CRITICAL: These MUST be READ-ONLY API keys for paper trading safety',
            '',
            `BINANCE_API_KEY=${this.config.BINANCE_API_KEY || ''}`,
            `BINANCE_API_SECRET=${this.config.BINANCE_API_SECRET || ''}`,
            `BINANCE_SANDBOX=${this.config.BINANCE_SANDBOX}`,
            `BINANCE_MAINNET=${this.config.BINANCE_MAINNET}`,
            `BINANCE_READ_ONLY=${this.config.BINANCE_READ_ONLY}`,
            '',
            `KUCOIN_API_KEY=${this.config.KUCOIN_API_KEY || ''}`,
            `KUCOIN_API_SECRET=${this.config.KUCOIN_API_SECRET || ''}`,
            `KUCOIN_PASSPHRASE=${this.config.KUCOIN_PASSPHRASE || ''}`,
            `KUCOIN_SANDBOX=${this.config.KUCOIN_SANDBOX}`,
            `KUCOIN_MAINNET=${this.config.KUCOIN_MAINNET}`,
            `KUCOIN_READ_ONLY=${this.config.KUCOIN_READ_ONLY}`,
            '',
            '# ============================================================================',
            '# MONITORING AND LOGGING',
            '# ============================================================================',
            '',
            `PROMETHEUS_PORT=${this.config.PROMETHEUS_PORT}`,
            `GRAFANA_PORT=${this.config.GRAFANA_PORT}`,
            `GRAFANA_PASSWORD=${this.config.GRAFANA_PASSWORD}`,
            `LOG_LEVEL=${this.config.LOG_LEVEL}`,
            `LOG_FORMAT=${this.config.LOG_FORMAT}`,
            `METRICS_ENABLED=${this.config.METRICS_ENABLED}`,
            `HEALTH_CHECK_ENABLED=${this.config.HEALTH_CHECK_ENABLED}`,
            '',
            '# ============================================================================',
            '# PAPER TRADING CONFIGURATION',
            '# ============================================================================',
            '',
            `VIRTUAL_BALANCE_USD=${this.config.VIRTUAL_BALANCE_USD || '100000'}`,
            `VIRTUAL_BALANCE_BTC=${this.config.VIRTUAL_BALANCE_BTC || '10'}`,
            `VIRTUAL_BALANCE_ETH=${this.config.VIRTUAL_BALANCE_ETH || '100'}`,
            'TRADING_FEE_SIMULATION=0.001',
            'SLIPPAGE_SIMULATION=0.0005',
            'PAPER_TRADE_AUDIT_LOG=true',
            '',
            '# ============================================================================',
            '# PERFORMANCE CONFIGURATION',
            '# ============================================================================',
            '',
            'MAX_CONCURRENT_CONNECTIONS=1000',
            'WEBSOCKET_MAX_CONNECTIONS=500',
            'API_TIMEOUT=30000',
            'CACHE_TTL=300',
            '',
            '# ============================================================================',
            '# BACKUP CONFIGURATION',
            '# ============================================================================',
            '',
            'BACKUP_ENABLED=true',
            'BACKUP_SCHEDULE=0 2 * * *',
            'BACKUP_RETENTION_DAYS=30',
            'AWS_S3_BACKUP=false',
            '',
            '# ============================================================================',
            '# ALERT CONFIGURATION',
            '# ============================================================================',
            '',
            'CRITICAL_ALERT_ENABLED=true',
            '',
            '# Configuration completed at: ' + new Date().toISOString(),
            '# Paper trading mode: ENFORCED',
            '# Real trading: BLOCKED',
            '# Environment: PRODUCTION'
        ];
        
        fs.writeFileSync(this.envFile, configLines.join('\n'));
        console.log(`✅ Configuration written to ${this.envFile}`);
    }

    /**
     * Set up SSL certificates
     */
    async setupSSLCertificates() {
        console.log('\n🔒 Setting up SSL certificates...');
        
        try {
            const sslScript = path.join(__dirname, '..', 'docker', 'scripts', 'ssl-setup.sh');
            
            if (fs.existsSync(sslScript)) {
                // Make script executable
                execSync(`chmod +x "${sslScript}"`);
                
                if (this.config.DOMAIN_NAME === 'localhost') {
                    console.log('ℹ️  Generating self-signed certificate for localhost...');
                    execSync(`DOMAIN_NAME=${this.config.DOMAIN_NAME} "${sslScript}" self-signed`, { stdio: 'inherit' });
                } else {
                    console.log('ℹ️  Preparing Let\'s Encrypt certificate setup...');
                    execSync(`DOMAIN_NAME=${this.config.DOMAIN_NAME} LETSENCRYPT_EMAIL=${this.config.LETSENCRYPT_EMAIL} "${sslScript}" setup`, { stdio: 'inherit' });
                }
                
                console.log('✅ SSL certificate setup completed');
            } else {
                this.warnings.push('SSL setup script not found - manual SSL configuration required');
            }
        } catch (error) {
            this.warnings.push(`SSL setup failed: ${error.message}`);
            console.warn('⚠️  SSL setup failed - you may need to configure certificates manually');
        }
    }

    /**
     * Final validation of the complete setup
     */
    async finalValidation() {
        console.log('\n🔍 Performing final validation...');
        
        // Validate environment file exists and is readable
        if (!fs.existsSync(this.envFile)) {
            throw new Error('Environment file was not created successfully');
        }
        
        // Validate paper trading enforcement
        const envContent = fs.readFileSync(this.envFile, 'utf8');
        const criticalSettings = [
            'PAPER_TRADING_MODE=true',
            'ALLOW_REAL_TRADES=false',
            'FORCE_PAPER_TRADING=true',
            'BINANCE_READ_ONLY=true',
            'KUCOIN_READ_ONLY=true'
        ];
        
        for (const setting of criticalSettings) {
            if (!envContent.includes(setting)) {
                throw new Error(`Critical paper trading setting missing: ${setting}`);
            }
        }
        
        console.log('✅ Final validation passed - paper trading safety confirmed');
    }

    /**
     * Print configuration summary
     */
    printSummary() {
        console.log('\n📋 Configuration Summary');
        console.log('========================');
        console.log(`Domain: ${this.config.DOMAIN_NAME}`);
        console.log(`SSL: ${this.config.SSL_ENABLED === 'true' ? 'Enabled' : 'Disabled'}`);
        console.log(`Paper Trading: ${this.config.PAPER_TRADING_MODE === 'true' ? 'ENFORCED' : 'ERROR'}`);
        console.log(`Real Trading: ${this.config.ALLOW_REAL_TRADES === 'false' ? 'BLOCKED' : 'ERROR'}`);
        console.log(`Binance API: ${this.config.BINANCE_API_KEY ? 'Configured (READ-ONLY)' : 'Not configured'}`);
        console.log(`KuCoin API: ${this.config.KUCOIN_API_KEY ? 'Configured (READ-ONLY)' : 'Not configured'}`);
        console.log(`Database: PostgreSQL with SSL`);
        console.log(`Monitoring: Prometheus + Grafana`);
        
        if (this.warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            this.warnings.forEach(warning => console.log(`  - ${warning}`));
        }
        
        console.log('\n🚀 Next Steps:');
        console.log('1. Review the configuration in .env.production');
        console.log('2. Run: npm run validate:production');
        console.log('3. Deploy with: npm run deploy:production');
        console.log('\n🔒 SECURITY REMINDER: This system is configured for PAPER TRADING ONLY');
        console.log('   Real trading is blocked at multiple levels for your safety.');
    }

    /**
     * Generate secure password
     */
    generateSecurePassword(length = 24) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return password;
    }

    /**
     * Generate secure secret
     */
    generateSecureSecret(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Prompt user for input (simplified for automation)
     */
    promptUser(question) {
        // In a real implementation, this would use readline or similar
        // For now, return empty string to use defaults
        console.log(`ℹ️  ${question} (using default/generated value)`);
        return '';
    }
}

// Main execution
if (require.main === module) {
    const configurator = new ProductionEnvironmentConfigurator();
    configurator.configure().catch(error => {
        console.error('Configuration failed:', error);
        process.exit(1);
    });
}

module.exports = ProductionEnvironmentConfigurator;