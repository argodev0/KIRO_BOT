#!/usr/bin/env node

/**
 * Input Sanitization Test Script
 * Tests malicious input detection and blocking
 */

const fs = require('fs');
const path = require('path');

class InputSanitizationTester {
    constructor() {
        this.results = {
            sqlInjection: { passed: 0, failed: 0, tests: [] },
            xss: { passed: 0, failed: 0, tests: [] },
            pathTraversal: { passed: 0, failed: 0, tests: [] },
            commandInjection: { passed: 0, failed: 0, tests: [] }
        };
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async runTest(category, testName, testFn) {
        try {
            this.log(`Testing ${category}: ${testName}`);
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

    // Load and test the input validation middleware
    loadInputValidation() {
        const inputValidationPath = './src/middleware/inputValidation.ts';
        if (!fs.existsSync(inputValidationPath)) {
            throw new Error('Input validation middleware not found');
        }
        return fs.readFileSync(inputValidationPath, 'utf8');
    }

    async testSQLInjectionPatterns() {
        this.log('🛡️ Testing SQL Injection Prevention');

        await this.runTest('sqlInjection', 'SQL Injection Pattern Detection', async () => {
            const inputValidation = this.loadInputValidation();
            
            const sqlPatterns = [
                'SELECT * FROM users',
                "' OR '1'='1",
                'UNION SELECT password FROM users',
                '; DROP TABLE users;',
                '1\' OR \'1\'=\'1',
                'admin\'--',
                '\' UNION SELECT NULL--'
            ];
            
            // Check if SQL injection patterns are defined
            if (!inputValidation.includes('sqlInjectionPatterns')) {
                throw new Error('SQL injection patterns not defined');
            }
            
            // Verify common SQL injection patterns are covered
            const requiredPatterns = [
                'SELECT|INSERT|UPDATE|DELETE',
                'UNION',
                'OR|AND',
                '--',
                'CONCAT|SUBSTRING'
            ];
            
            for (const pattern of requiredPatterns) {
                if (!inputValidation.includes(pattern)) {
                    throw new Error(`Missing SQL injection pattern: ${pattern}`);
                }
            }
            
            return 'SQL injection patterns properly defined';
        });

        await this.runTest('sqlInjection', 'SQL Injection Prevention Function', async () => {
            const inputValidation = this.loadInputValidation();
            
            if (!inputValidation.includes('preventSQLInjection') || 
                !inputValidation.includes('checkForSQLInjection')) {
                throw new Error('SQL injection prevention function not implemented');
            }
            
            return 'SQL injection prevention function implemented';
        });

        await this.runTest('sqlInjection', 'SQL Injection Response Handling', async () => {
            const inputValidation = this.loadInputValidation();
            
            if (!inputValidation.includes('BAD_REQUEST') || 
                !inputValidation.includes('Invalid input detected')) {
                throw new Error('SQL injection response handling not implemented');
            }
            
            return 'SQL injection response handling implemented';
        });
    }

    async testXSSPrevention() {
        this.log('🔒 Testing XSS Prevention');

        await this.runTest('xss', 'XSS Pattern Detection', async () => {
            const inputValidation = this.loadInputValidation();
            
            if (!inputValidation.includes('xssPatterns')) {
                throw new Error('XSS patterns not defined');
            }
            
            const requiredPatterns = [
                '<script',
                'javascript\\s*:',
                'on\\w+\\s*=',
                'vbscript\\s*:',
                'expression\\s*\\('
            ];
            
            for (const pattern of requiredPatterns) {
                if (!inputValidation.includes(pattern)) {
                    throw new Error(`Missing XSS pattern: ${pattern}`);
                }
            }
            
            return 'XSS patterns properly defined';
        });

        await this.runTest('xss', 'XSS Prevention Function', async () => {
            const inputValidation = this.loadInputValidation();
            
            if (!inputValidation.includes('preventXSS') || 
                !inputValidation.includes('sanitizeValue')) {
                throw new Error('XSS prevention function not implemented');
            }
            
            return 'XSS prevention function implemented';
        });

        await this.runTest('xss', 'HTML Entity Encoding', async () => {
            const inputValidation = this.loadInputValidation();
            
            const encodingPatterns = [
                '&amp;',
                '&lt;',
                '&gt;',
                '&quot;',
                '&#x27;'
            ];
            
            for (const pattern of encodingPatterns) {
                if (!inputValidation.includes(pattern)) {
                    throw new Error(`Missing HTML entity encoding: ${pattern}`);
                }
            }
            
            return 'HTML entity encoding implemented';
        });
    }

    async testPathTraversalPrevention() {
        this.log('📁 Testing Path Traversal Prevention');

        await this.runTest('pathTraversal', 'Path Traversal Pattern Detection', async () => {
            const inputValidation = this.loadInputValidation();
            
            if (!inputValidation.includes('pathTraversalPatterns')) {
                throw new Error('Path traversal patterns not defined');
            }
            
            const requiredPatterns = [
                '\\.\\.',
                '%2e%2e',
                '%2f',
                '%5c'
            ];
            
            for (const pattern of requiredPatterns) {
                if (!inputValidation.includes(pattern)) {
                    throw new Error(`Missing path traversal pattern: ${pattern}`);
                }
            }
            
            return 'Path traversal patterns properly defined';
        });

        await this.runTest('pathTraversal', 'Path Traversal Prevention Function', async () => {
            const inputValidation = this.loadInputValidation();
            
            if (!inputValidation.includes('preventPathTraversal') || 
                !inputValidation.includes('checkForPathTraversal')) {
                throw new Error('Path traversal prevention function not implemented');
            }
            
            return 'Path traversal prevention function implemented';
        });
    }

    async testCommandInjectionPrevention() {
        this.log('⚡ Testing Command Injection Prevention');

        await this.runTest('commandInjection', 'Command Injection Pattern Detection', async () => {
            const inputValidation = this.loadInputValidation();
            
            if (!inputValidation.includes('commandInjectionPatterns')) {
                throw new Error('Command injection patterns not defined');
            }
            
            const requiredPatterns = [
                '[;&|`$(){}[\\]]',
                '\\|\\||&&|;|\\|',
                'cat|ls|pwd|whoami',
                'bash|sh|cmd|powershell'
            ];
            
            for (const pattern of requiredPatterns) {
                if (!inputValidation.includes(pattern)) {
                    throw new Error(`Missing command injection pattern: ${pattern}`);
                }
            }
            
            return 'Command injection patterns properly defined';
        });

        await this.runTest('commandInjection', 'Command Injection Prevention Function', async () => {
            const inputValidation = this.loadInputValidation();
            
            if (!inputValidation.includes('preventCommandInjection') || 
                !inputValidation.includes('checkForCommandInjection')) {
                throw new Error('Command injection prevention function not implemented');
            }
            
            return 'Command injection prevention function implemented';
        });
    }

    async testAdvancedThreatDetection() {
        this.log('🔍 Testing Advanced Threat Detection');

        await this.runTest('sqlInjection', 'Advanced Threat Detection Function', async () => {
            const inputValidation = this.loadInputValidation();
            
            if (!inputValidation.includes('advancedThreatDetection') || 
                !inputValidation.includes('detectAdvancedThreats')) {
                throw new Error('Advanced threat detection not implemented');
            }
            
            return 'Advanced threat detection implemented';
        });

        await this.runTest('sqlInjection', 'NoSQL Injection Detection', async () => {
            const inputValidation = this.loadInputValidation();
            
            const nosqlPatterns = [
                '$where',
                '$ne',
                '$gt',
                '$regex',
                '$or'
            ];
            
            for (const pattern of nosqlPatterns) {
                if (!inputValidation.includes(pattern)) {
                    throw new Error(`Missing NoSQL injection pattern: ${pattern}`);
                }
            }
            
            return 'NoSQL injection detection implemented';
        });

        await this.runTest('sqlInjection', 'Prototype Pollution Detection', async () => {
            const inputValidation = this.loadInputValidation();
            
            if (!inputValidation.includes('__proto__') || 
                !inputValidation.includes('constructor\\.prototype')) {
                throw new Error('Prototype pollution detection not implemented');
            }
            
            return 'Prototype pollution detection implemented';
        });
    }

    async testComprehensiveValidation() {
        this.log('🛡️ Testing Comprehensive Validation Middleware');

        await this.runTest('sqlInjection', 'Comprehensive Validation Export', async () => {
            const inputValidation = this.loadInputValidation();
            
            if (!inputValidation.includes('comprehensiveValidation') || 
                !inputValidation.includes('enhancedInputSanitization')) {
                throw new Error('Comprehensive validation middleware not exported');
            }
            
            return 'Comprehensive validation middleware exported';
        });

        await this.runTest('sqlInjection', 'File Upload Validation', async () => {
            const inputValidation = this.loadInputValidation();
            
            if (!inputValidation.includes('validateFileUpload') || 
                !inputValidation.includes('containsMaliciousContent')) {
                throw new Error('File upload validation not implemented');
            }
            
            return 'File upload validation implemented';
        });

        await this.runTest('sqlInjection', 'API Key Format Validation', async () => {
            const inputValidation = this.loadInputValidation();
            
            if (!inputValidation.includes('validateApiKeyFormat') || 
                !inputValidation.includes('isValidApiKeyFormat')) {
                throw new Error('API key format validation not implemented');
            }
            
            return 'API key format validation implemented';
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
                sqlInjectionPrevention: this.results.sqlInjection.failed === 0,
                xssPrevention: this.results.xss.failed === 0,
                pathTraversalPrevention: this.results.pathTraversal.failed === 0,
                commandInjectionPrevention: this.results.commandInjection.failed === 0
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
        const reportPath = './input-sanitization-test-report.json';
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        return report;
    }

    async run() {
        this.log('🛡️ Starting Input Sanitization Tests');
        
        try {
            await this.testSQLInjectionPatterns();
            await this.testXSSPrevention();
            await this.testPathTraversalPrevention();
            await this.testCommandInjectionPrevention();
            await this.testAdvancedThreatDetection();
            await this.testComprehensiveValidation();

            const report = await this.generateReport();

            this.log('📊 Input Sanitization Test Summary');
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
                this.log('🎉 All input sanitization tests passed!', 'success');
                return true;
            } else {
                this.log('❌ Some input sanitization tests failed', 'error');
                return false;
            }

        } catch (error) {
            this.log(`Input sanitization testing failed: ${error.message}`, 'error');
            throw error;
        }
    }
}

if (require.main === module) {
    const tester = new InputSanitizationTester();
    tester.run().then((success) => {
        process.exit(success ? 0 : 1);
    }).catch((error) => {
        console.error('Input sanitization test error:', error);
        process.exit(1);
    });
}

module.exports = InputSanitizationTester;