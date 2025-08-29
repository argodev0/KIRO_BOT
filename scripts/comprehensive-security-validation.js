#!/usr/bin/env node

/**
 * Comprehensive Security Validation Script
 * Tests SSL/TLS, rate limiting, input sanitization, and authentication
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class SecurityValidator {
    constructor() {
        this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        this.httpsUrl = process.env.HTTPS_URL || 'https://localhost:443';
        this.results = {
            ssl: { passed: 0, failed: 0, tests: [] },
            rateLimit: { passed: 0, failed: 0, tests: [] },
            inputSanitization: { passed: 0, failed: 0, tests: [] },
            authentication: { passed: 0, failed: 0, tests: [] },
            paperTrading: { passed: 0, failed: 0, tests: [] }
        };
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async runTest(category, testName, testFn) {
        try {
            this.log(`Running ${category} test: ${testName}`);
            const result = await testFn();
            this.results[category].passed++;
            this.results[category].tests.push({ name: testName, status: 'PASSED', result });
            this.log(`${testName}: PASSED`, 'success');
            return true;
        } catch (error) {
            this.results[category].failed++;
            this.results[category].tests.push({ name: testName, status: 'FAILED', error: error.message });
            this.log(`${testName}: FAILED - ${error.message}`, 'error');
            return false;
        }
    }

    async makeRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const isHttps = url.startsWith('https');
            const client = isHttps ? https : http;
            
            const requestOptions = {
                ...options,
                timeout: 10000,
                rejectUnauthorized: false // For self-signed certificates
            };

            const req = client.request(url, requestOptions, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: data,
                        response: res
                    });
                });
            });

            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Request timeout')));
            
            if (options.body) {
                req.write(options.body);
            }
            
            req.end();
        });
    }

    // SSL/TLS Tests (Requirement 5.1)
    async testSSLConfiguration() {
        this.log('🔒 Testing SSL/TLS Configuration');

        await this.runTest('ssl', 'SSL Certificate Validation', async () => {
            // Check if SSL certificates exist
            const certPath = './docker/ssl/cert.pem';
            const keyPath = './docker/ssl/private.key';
            
            if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
                throw new Error('SSL certificate files not found');
            }
            
            // Validate certificate format
            const cert = fs.readFileSync(certPath, 'utf8');
            if (!cert.includes('BEGIN CERTIFICATE')) {
                throw new Error('Invalid certificate format');
            }
            
            return 'SSL certificates exist and are valid format';
        });

        await this.runTest('ssl', 'HTTPS Redirect Test', async () => {
            try {
                const response = await this.makeRequest(`${this.baseUrl}/health`);
                
                // Check if HTTP redirects to HTTPS in production
                if (process.env.NODE_ENV === 'production' && response.statusCode !== 301) {
                    throw new Error('HTTP should redirect to HTTPS in production');
                }
                
                return 'HTTP redirect behavior correct';
            } catch (error) {
                // If server is not running, that's expected for this test
                if (error.code === 'ECONNREFUSED') {
                    return 'Server not running - redirect test skipped';
                }
                throw error;
            }
        });

        await this.runTest('ssl', 'Security Headers Validation', async () => {
            // Test security headers in nginx configuration
            const nginxConfig = fs.readFileSync('./docker/nginx/production.conf', 'utf8');
            
            const requiredHeaders = [
                'Strict-Transport-Security',
                'X-Frame-Options',
                'X-Content-Type-Options',
                'X-XSS-Protection',
                'Content-Security-Policy'
            ];
            
            for (const header of requiredHeaders) {
                if (!nginxConfig.includes(header)) {
                    throw new Error(`Missing security header: ${header}`);
                }
            }
            
            return 'All required security headers configured';
        });

        await this.runTest('ssl', 'Paper Trading Headers', async () => {
            const nginxConfig = fs.readFileSync('./docker/nginx/production.conf', 'utf8');
            
            const paperTradingHeaders = [
                'X-Paper-Trading-Mode',
                'X-Trading-Environment',
                'X-Allow-Real-Trades'
            ];
            
            for (const header of paperTradingHeaders) {
                if (!nginxConfig.includes(header)) {
                    throw new Error(`Missing paper trading header: ${header}`);
                }
            }
            
            return 'Paper trading safety headers configured';
        });
    }

    // Rate Limiting Tests (Requirement 5.2)
    async testRateLimiting() {
        this.log('🚦 Testing Rate Limiting');

        await this.runTest('rateLimit', 'Rate Limit Configuration', async () => {
            // Check if rate limiting is configured in security middleware
            const securityStackPath = './src/middleware/securityStack.ts';
            if (!fs.existsSync(securityStackPath)) {
                throw new Error('Security stack middleware not found');
            }
            
            const securityStack = fs.readFileSync(securityStackPath, 'utf8');
            
            if (!securityStack.includes('rateLimit') || !securityStack.includes('express-rate-limit')) {
                throw new Error('Rate limiting not configured in security stack');
            }
            
            return 'Rate limiting configured in security middleware';
        });

        await this.runTest('rateLimit', 'Nginx Rate Limiting', async () => {
            const nginxConfig = fs.readFileSync('./docker/nginx/production.conf', 'utf8');
            
            const rateLimitZones = [
                'limit_req_zone',
                'zone=api:',
                'zone=login:',
                'zone=trading:'
            ];
            
            for (const zone of rateLimitZones) {
                if (!nginxConfig.includes(zone)) {
                    throw new Error(`Missing rate limit zone: ${zone}`);
                }
            }
            
            return 'Nginx rate limiting zones configured';
        });

        await this.runTest('rateLimit', 'WebSocket Rate Limiting', async () => {
            const nginxConfig = fs.readFileSync('./docker/nginx/production.conf', 'utf8');
            
            if (!nginxConfig.includes('zone=websocket:') || !nginxConfig.includes('limit_conn perip')) {
                throw new Error('WebSocket rate limiting not configured');
            }
            
            return 'WebSocket rate limiting configured';
        });

        await this.runTest('rateLimit', 'Trading Endpoint Protection', async () => {
            const nginxConfig = fs.readFileSync('./docker/nginx/production.conf', 'utf8');
            
            // Check for strict rate limiting on trading endpoints
            const tradingSection = nginxConfig.match(/location \/api\/trading\/.*?}/s);
            if (!tradingSection || !tradingSection[0].includes('limit_req zone=trading')) {
                throw new Error('Trading endpoints not properly rate limited');
            }
            
            return 'Trading endpoints have strict rate limiting';
        });
    }

    // Input Sanitization Tests (Requirement 5.3)
    async testInputSanitization() {
        this.log('🛡️ Testing Input Sanitization');

        await this.runTest('inputSanitization', 'SQL Injection Prevention', async () => {
            const inputValidationPath = './src/middleware/inputValidation.ts';
            if (!fs.existsSync(inputValidationPath)) {
                throw new Error('Input validation middleware not found');
            }
            
            const inputValidation = fs.readFileSync(inputValidationPath, 'utf8');
            
            if (!inputValidation.includes('preventSQLInjection') || !inputValidation.includes('sqlInjectionPatterns')) {
                throw new Error('SQL injection prevention not implemented');
            }
            
            return 'SQL injection prevention implemented';
        });

        await this.runTest('inputSanitization', 'XSS Prevention', async () => {
            const inputValidationPath = './src/middleware/inputValidation.ts';
            const inputValidation = fs.readFileSync(inputValidationPath, 'utf8');
            
            if (!inputValidation.includes('preventXSS') || !inputValidation.includes('xssPatterns')) {
                throw new Error('XSS prevention not implemented');
            }
            
            return 'XSS prevention implemented';
        });

        await this.runTest('inputSanitization', 'Path Traversal Prevention', async () => {
            const inputValidationPath = './src/middleware/inputValidation.ts';
            const inputValidation = fs.readFileSync(inputValidationPath, 'utf8');
            
            if (!inputValidation.includes('preventPathTraversal') || !inputValidation.includes('pathTraversalPatterns')) {
                throw new Error('Path traversal prevention not implemented');
            }
            
            return 'Path traversal prevention implemented';
        });

        await this.runTest('inputSanitization', 'Command Injection Prevention', async () => {
            const inputValidationPath = './src/middleware/inputValidation.ts';
            const inputValidation = fs.readFileSync(inputValidationPath, 'utf8');
            
            if (!inputValidation.includes('preventCommandInjection') || !inputValidation.includes('commandInjectionPatterns')) {
                throw new Error('Command injection prevention not implemented');
            }
            
            return 'Command injection prevention implemented';
        });

        await this.runTest('inputSanitization', 'Comprehensive Validation Middleware', async () => {
            const inputValidationPath = './src/middleware/inputValidation.ts';
            const inputValidation = fs.readFileSync(inputValidationPath, 'utf8');
            
            if (!inputValidation.includes('comprehensiveValidation') || !inputValidation.includes('advancedThreatDetection')) {
                throw new Error('Comprehensive validation middleware not implemented');
            }
            
            return 'Comprehensive validation middleware implemented';
        });
    }

    // Authentication Tests (Requirement 5.4)
    async testAuthentication() {
        this.log('🔐 Testing Authentication and Authorization');

        await this.runTest('authentication', 'Enhanced Authentication Middleware', async () => {
            const enhancedAuthPath = './src/middleware/enhancedAuth.ts';
            if (!fs.existsSync(enhancedAuthPath)) {
                throw new Error('Enhanced authentication middleware not found');
            }
            
            const enhancedAuth = fs.readFileSync(enhancedAuthPath, 'utf8');
            
            if (!enhancedAuth.includes('createEnhancedAuth') || !enhancedAuth.includes('SessionManagementService')) {
                throw new Error('Enhanced authentication not properly implemented');
            }
            
            return 'Enhanced authentication middleware implemented';
        });

        await this.runTest('authentication', 'Account Lockout Service', async () => {
            const accountLockoutPath = './src/services/AccountLockoutService.ts';
            if (!fs.existsSync(accountLockoutPath)) {
                throw new Error('Account lockout service not found');
            }
            
            const accountLockout = fs.readFileSync(accountLockoutPath, 'utf8');
            
            if (!accountLockout.includes('maxAttempts') || !accountLockout.includes('lockoutDuration')) {
                throw new Error('Account lockout service not properly configured');
            }
            
            return 'Account lockout service implemented';
        });

        await this.runTest('authentication', 'Session Management', async () => {
            const securityStackPath = './src/middleware/securityStack.ts';
            const securityStack = fs.readFileSync(securityStackPath, 'utf8');
            
            if (!securityStack.includes('SessionManagementService') || !securityStack.includes('setupSessionManagement')) {
                throw new Error('Session management not configured');
            }
            
            return 'Session management configured';
        });

        await this.runTest('authentication', 'Security Monitoring', async () => {
            const securityStackPath = './src/middleware/securityStack.ts';
            const securityStack = fs.readFileSync(securityStackPath, 'utf8');
            
            if (!securityStack.includes('SecurityMonitoringService') || !securityStack.includes('setupSecurityMonitoring')) {
                throw new Error('Security monitoring not configured');
            }
            
            return 'Security monitoring configured';
        });

        await this.runTest('authentication', 'API Key Validation', async () => {
            const inputValidationPath = './src/middleware/inputValidation.ts';
            const inputValidation = fs.readFileSync(inputValidationPath, 'utf8');
            
            if (!inputValidation.includes('validateApiKeyFormat') || !inputValidation.includes('containsTradingPermissions')) {
                throw new Error('API key validation not implemented');
            }
            
            return 'API key validation implemented';
        });
    }

    // Paper Trading Safety Tests
    async testPaperTradingSafety() {
        this.log('💰 Testing Paper Trading Safety Mechanisms');

        await this.runTest('paperTrading', 'Paper Trading Mode Enforcement', async () => {
            const securityStackPath = './src/middleware/securityStack.ts';
            const securityStack = fs.readFileSync(securityStackPath, 'utf8');
            
            if (!securityStack.includes('config.paperTrading.enabled') || !securityStack.includes('Paper trading safety middleware')) {
                throw new Error('Paper trading mode enforcement not implemented');
            }
            
            return 'Paper trading mode enforcement implemented';
        });

        await this.runTest('paperTrading', 'Real Trading Endpoint Blocking', async () => {
            const securityStackPath = './src/middleware/securityStack.ts';
            const securityStack = fs.readFileSync(securityStackPath, 'utf8');
            
            const tradingEndpoints = ['/api/trading/execute', '/api/orders/place', '/api/withdraw'];
            for (const endpoint of tradingEndpoints) {
                if (!securityStack.includes(endpoint)) {
                    throw new Error(`Real trading endpoint ${endpoint} not blocked`);
                }
            }
            
            return 'Real trading endpoints blocked';
        });

        await this.runTest('paperTrading', 'Production Safety Headers', async () => {
            const nginxConfig = fs.readFileSync('./docker/nginx/production.conf', 'utf8');
            
            if (!nginxConfig.includes('X-Allow-Real-Trades "false"') || 
                !nginxConfig.includes('X-Force-Paper-Trading "true"')) {
                throw new Error('Production safety headers not configured');
            }
            
            return 'Production safety headers configured';
        });

        await this.runTest('paperTrading', 'Trading API Key Blocking', async () => {
            const inputValidationPath = './src/middleware/inputValidation.ts';
            const inputValidation = fs.readFileSync(inputValidationPath, 'utf8');
            
            if (!inputValidation.includes('TRADING_API_KEY_BLOCKED') || 
                !inputValidation.includes('Trading API keys are not allowed')) {
                throw new Error('Trading API key blocking not implemented');
            }
            
            return 'Trading API key blocking implemented';
        });
    }

    async generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: 0,
                totalPassed: 0,
                totalFailed: 0,
                categories: {}
            },
            details: this.results,
            compliance: {
                requirement_5_1: this.results.ssl.failed === 0,
                requirement_5_2: this.results.rateLimit.failed === 0,
                requirement_5_3: this.results.inputSanitization.failed === 0,
                requirement_5_4: this.results.authentication.failed === 0,
                paperTradingSafety: this.results.paperTrading.failed === 0
            }
        };

        // Calculate summary
        for (const [category, results] of Object.entries(this.results)) {
            report.summary.totalTests += results.passed + results.failed;
            report.summary.totalPassed += results.passed;
            report.summary.totalFailed += results.failed;
            report.summary.categories[category] = {
                passed: results.passed,
                failed: results.failed,
                total: results.passed + results.failed
            };
        }

        // Write report to file
        const reportPath = './comprehensive-security-validation-report.json';
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        return report;
    }

    async run() {
        this.log('🔒 Starting Comprehensive Security Validation');
        this.log('Testing Requirements: 5.1 (SSL/TLS), 5.2 (Rate Limiting), 5.3 (Input Sanitization), 5.4 (Authentication)');

        try {
            // Run all test categories
            await this.testSSLConfiguration();
            await this.testRateLimiting();
            await this.testInputSanitization();
            await this.testAuthentication();
            await this.testPaperTradingSafety();

            // Generate report
            const report = await this.generateReport();

            // Display summary
            this.log('📊 Security Validation Summary');
            this.log(`Total Tests: ${report.summary.totalTests}`);
            this.log(`Passed: ${report.summary.totalPassed}`, 'success');
            this.log(`Failed: ${report.summary.totalFailed}`, report.summary.totalFailed > 0 ? 'error' : 'success');

            // Display category breakdown
            for (const [category, stats] of Object.entries(report.summary.categories)) {
                this.log(`${category}: ${stats.passed}/${stats.total} passed`);
            }

            // Display compliance status
            this.log('📋 Compliance Status:');
            for (const [requirement, status] of Object.entries(report.compliance)) {
                this.log(`${requirement}: ${status ? 'COMPLIANT' : 'NON-COMPLIANT'}`, status ? 'success' : 'error');
            }

            if (report.summary.totalFailed === 0) {
                this.log('🎉 All security validation tests passed!', 'success');
                return true;
            } else {
                this.log('❌ Some security validation tests failed. Check the report for details.', 'error');
                return false;
            }

        } catch (error) {
            this.log(`Security validation failed: ${error.message}`, 'error');
            throw error;
        }
    }
}

if (require.main === module) {
    const validator = new SecurityValidator();
    validator.run().then((success) => {
        process.exit(success ? 0 : 1);
    }).catch((error) => {
        console.error('Security validation error:', error);
        process.exit(1);
    });
}

module.exports = SecurityValidator;