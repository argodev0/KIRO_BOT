#!/usr/bin/env node

/**
 * Final Integration and System Testing Script
 * 
 * This script performs comprehensive end-to-end validation of the entire
 * production paper trading system, verifying all requirements are met.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const WebSocket = require('ws');

class FinalIntegrationTester {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            errors: []
        };
        this.baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
        this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async test(description, testFn) {
        try {
            this.log(`Testing: ${description}`);
            await testFn();
            this.results.passed++;
            this.log(`✅ PASSED: ${description}`, 'success');
        } catch (error) {
            this.results.failed++;
            this.results.errors.push({ description, error: error.message });
            this.log(`❌ FAILED: ${description} - ${error.message}`, 'error');
        }
    }

    async runAllTests() {
        this.log('🚀 Starting Final Integration and System Testing');
        this.log('================================================');

        // 1. Component Integration Tests
        await this.testComponentIntegration();

        // 2. Complete Test Suite Execution
        await this.runCompleteTestSuite();

        // 3. Paper Trading Enforcement Validation
        await this.validatePaperTradingEnforcement();

        // 4. Production Deployment Verification
        await this.verifyProductionDeployment();

        // 5. Performance and Security Tests
        await this.runPerformanceAndSecurityTests();

        // 6. End-to-End Workflow Tests
        await this.runEndToEndWorkflowTests();

        this.generateFinalReport();
    }

    async testComponentIntegration() {
        this.log('🔧 Testing Component Integration');

        await this.test('Database Connection', async () => {
            const result = execSync('npm run test:db-connection', { encoding: 'utf8' });
            if (!result.includes('Database connection successful')) {
                throw new Error('Database connection failed');
            }
        });

        await this.test('Redis Cache Connection', async () => {
            const result = execSync('npm run test:redis-connection', { encoding: 'utf8' });
            if (!result.includes('Redis connection successful')) {
                throw new Error('Redis connection failed');
            }
        });

        await this.test('Exchange API Connections', async () => {
            const result = execSync('node scripts/validate-api-permissions.js', { encoding: 'utf8' });
            if (!result.includes('All API validations passed')) {
                throw new Error('Exchange API validation failed');
            }
        });

        await this.test('WebSocket Server Integration', async () => {
            const result = execSync('node scripts/test-websocket.js', { encoding: 'utf8' });
            if (!result.includes('WebSocket tests passed')) {
                throw new Error('WebSocket integration failed');
            }
        });

        await this.test('Frontend Component Integration', async () => {
            const result = execSync('npm run test:frontend-integration', { encoding: 'utf8' });
            if (result.includes('FAIL') || result.includes('Error')) {
                throw new Error('Frontend integration tests failed');
            }
        });
    }

    async runCompleteTestSuite() {
        this.log('🧪 Running Complete Test Suite');

        await this.test('Unit Tests', async () => {
            const result = execSync('npm test -- --run --reporter=json', { encoding: 'utf8' });
            const testResults = JSON.parse(result);
            if (testResults.numFailedTests > 0) {
                throw new Error(`${testResults.numFailedTests} unit tests failed`);
            }
        });

        await this.test('Integration Tests', async () => {
            const result = execSync('npm run test:integration -- --run', { encoding: 'utf8' });
            if (result.includes('FAIL') || result.includes('Error')) {
                throw new Error('Integration tests failed');
            }
        });

        await this.test('Security Tests', async () => {
            const result = execSync('npm run test:security -- --run', { encoding: 'utf8' });
            if (result.includes('FAIL') || result.includes('Error')) {
                throw new Error('Security tests failed');
            }
        });

        await this.test('Performance Tests', async () => {
            const result = execSync('node scripts/performance-benchmarking.js', { encoding: 'utf8' });
            if (!result.includes('Performance benchmarks passed')) {
                throw new Error('Performance tests failed');
            }
        });

        await this.test('E2E Tests', async () => {
            const result = execSync('npm run test:e2e -- --run', { encoding: 'utf8' });
            if (result.includes('FAIL') || result.includes('Error')) {
                throw new Error('E2E tests failed');
            }
        });
    }

    async validatePaperTradingEnforcement() {
        this.log('🛡️ Validating Paper Trading Enforcement');

        await this.test('Paper Trading Safety Verification', async () => {
            const result = execSync('node scripts/paper-trading-safety-verification.js', { encoding: 'utf8' });
            if (!result.includes('All paper trading safety checks passed')) {
                throw new Error('Paper trading safety verification failed');
            }
        });

        await this.test('API Key Permission Validation', async () => {
            const result = execSync('node scripts/validate-api-permissions.js', { encoding: 'utf8' });
            if (!result.includes('All API validations passed')) {
                throw new Error('API key permission validation failed');
            }
        });

        await this.test('Real Trading Block Verification', async () => {
            try {
                const response = await axios.post(`${this.baseUrl}/api/trading/order`, {
                    symbol: 'BTCUSDT',
                    side: 'BUY',
                    type: 'MARKET',
                    quantity: 0.001
                });
                
                if (!response.data.isPaperTrade) {
                    throw new Error('Real trading was not blocked');
                }
            } catch (error) {
                if (!error.message.includes('paper trading') && !error.message.includes('blocked')) {
                    throw error;
                }
            }
        });

        await this.test('Virtual Portfolio Validation', async () => {
            const response = await axios.get(`${this.baseUrl}/api/portfolio/virtual`);
            if (!response.data.isVirtual || response.data.realMoney) {
                throw new Error('Virtual portfolio validation failed');
            }
        });
    }

    async verifyProductionDeployment() {
        this.log('🚀 Verifying Production Deployment');

        await this.test('Production Readiness Validation', async () => {
            const result = execSync('node scripts/production-readiness-validation.js', { encoding: 'utf8' });
            if (!result.includes('Production readiness validation passed')) {
                throw new Error('Production readiness validation failed');
            }
        });

        await this.test('Production Smoke Tests', async () => {
            const result = execSync('node scripts/production-smoke-tests.js', { encoding: 'utf8' });
            if (!result.includes('All smoke tests passed')) {
                throw new Error('Production smoke tests failed');
            }
        });

        await this.test('SSL Configuration Validation', async () => {
            if (process.env.NODE_ENV === 'production') {
                const result = execSync('node scripts/validate-ssl-config.js', { encoding: 'utf8' });
                if (!result.includes('SSL configuration valid')) {
                    throw new Error('SSL configuration validation failed');
                }
            }
        });

        await this.test('Nginx Configuration Validation', async () => {
            const result = execSync('node scripts/validate-nginx-deployment.js', { encoding: 'utf8' });
            if (!result.includes('Nginx configuration valid')) {
                throw new Error('Nginx configuration validation failed');
            }
        });

        await this.test('Health Endpoints Validation', async () => {
            const response = await axios.get(`${this.baseUrl}/health`);
            if (response.data.status !== 'healthy') {
                throw new Error('Health endpoints validation failed');
            }
        });

        await this.test('Monitoring System Validation', async () => {
            const result = execSync('node scripts/validate-monitoring-setup.js', { encoding: 'utf8' });
            if (!result.includes('Monitoring setup valid')) {
                throw new Error('Monitoring system validation failed');
            }
        });
    }

    async runPerformanceAndSecurityTests() {
        this.log('⚡ Running Performance and Security Tests');

        await this.test('Load Testing', async () => {
            const result = execSync('node scripts/load-test.js', { encoding: 'utf8' });
            if (!result.includes('Load test passed')) {
                throw new Error('Load testing failed');
            }
        });

        await this.test('Security Hardening Validation', async () => {
            const result = execSync('npm run test:security-hardening -- --run', { encoding: 'utf8' });
            if (result.includes('FAIL') || result.includes('Error')) {
                throw new Error('Security hardening validation failed');
            }
        });

        await this.test('Rate Limiting Validation', async () => {
            let rateLimitHit = false;
            for (let i = 0; i < 100; i++) {
                try {
                    await axios.get(`${this.baseUrl}/api/market-data`);
                } catch (error) {
                    if (error.response && error.response.status === 429) {
                        rateLimitHit = true;
                        break;
                    }
                }
            }
            if (!rateLimitHit) {
                throw new Error('Rate limiting not working properly');
            }
        });

        await this.test('Input Validation Testing', async () => {
            try {
                await axios.post(`${this.baseUrl}/api/trading/order`, {
                    symbol: '<script>alert("xss")</script>',
                    side: 'INVALID',
                    quantity: 'not_a_number'
                });
                throw new Error('Input validation should have rejected malicious input');
            } catch (error) {
                if (error.response && error.response.status === 400) {
                    // Expected validation error
                    return;
                }
                throw error;
            }
        });
    }

    async runEndToEndWorkflowTests() {
        this.log('🔄 Running End-to-End Workflow Tests');

        await this.test('Complete Trading Workflow', async () => {
            // 1. Get market data
            const marketData = await axios.get(`${this.baseUrl}/api/market-data/BTCUSDT`);
            if (!marketData.data.price) {
                throw new Error('Market data not available');
            }

            // 2. Place paper trade
            const tradeResponse = await axios.post(`${this.baseUrl}/api/trading/order`, {
                symbol: 'BTCUSDT',
                side: 'BUY',
                type: 'MARKET',
                quantity: 0.001
            });

            if (!tradeResponse.data.isPaperTrade) {
                throw new Error('Trade was not executed as paper trade');
            }

            // 3. Check virtual portfolio
            const portfolio = await axios.get(`${this.baseUrl}/api/portfolio/virtual`);
            if (!portfolio.data.isVirtual) {
                throw new Error('Portfolio is not virtual');
            }

            // 4. Verify trade history
            const history = await axios.get(`${this.baseUrl}/api/trading/history`);
            const lastTrade = history.data[0];
            if (!lastTrade.isPaperTrade) {
                throw new Error('Trade history does not show paper trade');
            }
        });

        await this.test('Real-time Data Streaming', async () => {
            return new Promise((resolve, reject) => {
                const ws = new WebSocket(`ws://localhost:3001`);
                let dataReceived = false;

                ws.on('open', () => {
                    ws.send(JSON.stringify({ action: 'subscribe', symbol: 'BTCUSDT' }));
                });

                ws.on('message', (data) => {
                    const message = JSON.parse(data);
                    if (message.type === 'market_data' && message.data.price) {
                        dataReceived = true;
                        ws.close();
                        resolve();
                    }
                });

                ws.on('error', (error) => {
                    reject(new Error(`WebSocket error: ${error.message}`));
                });

                setTimeout(() => {
                    if (!dataReceived) {
                        ws.close();
                        reject(new Error('No real-time data received within timeout'));
                    }
                }, 10000);
            });
        });

        await this.test('Frontend Paper Trading Indicators', async () => {
            const result = execSync('node scripts/validate-frontend-paper-trading.js', { encoding: 'utf8' });
            if (!result.includes('Paper trading indicators validated')) {
                throw new Error('Frontend paper trading indicators validation failed');
            }
        });

        await this.test('Localhost Hosting Validation', async () => {
            const result = execSync('node scripts/validate-localhost-features.js', { encoding: 'utf8' });
            if (!result.includes('Localhost hosting validation passed')) {
                throw new Error('Localhost hosting validation failed');
            }
        });
    }

    generateFinalReport() {
        this.log('📊 Generating Final Integration Test Report');
        this.log('===========================================');

        const totalTests = this.results.passed + this.results.failed;
        const successRate = ((this.results.passed / totalTests) * 100).toFixed(2);

        console.log(`\n📈 FINAL TEST RESULTS:`);
        console.log(`   Total Tests: ${totalTests}`);
        console.log(`   Passed: ${this.results.passed}`);
        console.log(`   Failed: ${this.results.failed}`);
        console.log(`   Success Rate: ${successRate}%`);

        if (this.results.failed > 0) {
            console.log(`\n❌ FAILED TESTS:`);
            this.results.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error.description}`);
                console.log(`      Error: ${error.error}`);
            });
        }

        // Generate detailed report file
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests,
                passed: this.results.passed,
                failed: this.results.failed,
                successRate: `${successRate}%`
            },
            errors: this.results.errors,
            systemInfo: {
                nodeVersion: process.version,
                platform: process.platform,
                environment: process.env.NODE_ENV || 'development'
            }
        };

        fs.writeFileSync(
            path.join(__dirname, '../test-results/final-integration-report.json'),
            JSON.stringify(report, null, 2)
        );

        if (this.results.failed === 0) {
            this.log('🎉 ALL TESTS PASSED! System is ready for production deployment.', 'success');
            process.exit(0);
        } else {
            this.log('❌ Some tests failed. Please review and fix issues before deployment.', 'error');
            process.exit(1);
        }
    }
}

// Run the tests if this script is executed directly
if (require.main === module) {
    const tester = new FinalIntegrationTester();
    tester.runAllTests().catch((error) => {
        console.error('❌ Fatal error during testing:', error);
        process.exit(1);
    });
}

module.exports = FinalIntegrationTester;