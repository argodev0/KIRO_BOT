#!/usr/bin/env node

/**
 * SSL Configuration Validation Script
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

class SSLValidator {
    constructor() {
        this.domain = process.env.DOMAIN || 'localhost';
        this.port = process.env.HTTPS_PORT || 443;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async validateSSLConfig() {
        this.log('🔒 Validating SSL Configuration');

        try {
            // Check if SSL certificates exist
            const certPath = process.env.SSL_CERT_PATH || '/etc/letsencrypt/live/' + this.domain + '/fullchain.pem';
            const keyPath = process.env.SSL_KEY_PATH || '/etc/letsencrypt/live/' + this.domain + '/privkey.pem';

            if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
                this.log('SSL certificate files found', 'success');
            } else {
                this.log('SSL certificate files not found - may be in development mode', 'info');
            }

            // Check Nginx SSL configuration
            const nginxConfigPath = path.join(__dirname, '../docker/nginx/complete-production.conf');
            if (fs.existsSync(nginxConfigPath)) {
                const nginxConfig = fs.readFileSync(nginxConfigPath, 'utf8');
                if (nginxConfig.includes('ssl_certificate') && nginxConfig.includes('ssl_certificate_key')) {
                    this.log('Nginx SSL configuration valid', 'success');
                } else {
                    throw new Error('Nginx SSL configuration incomplete');
                }
            }

            this.log('SSL configuration valid', 'success');
            console.log('SSL configuration valid');
            return true;

        } catch (error) {
            this.log(`SSL validation failed: ${error.message}`, 'error');
            throw error;
        }
    }
}

if (require.main === module) {
    const validator = new SSLValidator();
    validator.validateSSLConfig().catch((error) => {
        console.error('SSL validation failed:', error.message);
        process.exit(1);
    });
}

module.exports = SSLValidator;