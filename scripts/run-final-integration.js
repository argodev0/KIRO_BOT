#!/usr/bin/env node

/**
 * Final Integration Test Orchestrator
 * 
 * Orchestrates the complete final integration and system testing process
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class FinalIntegrationOrchestrator {
    constructor() {
        this.testResults = {
            systemValidation: null,
            requirementsValidation: null,
            integrationTests: null,
            performanceTests: null,
            securityTests: null,
            deploymentVerification: null
        };
        this.startTime = Date.now();
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async runTest(testName, testCommand, critical = true) {
        try {
            this.log(`Starting ${testName}...`);
            const result = execSync(testCommand, { 
                encoding: 'utf8',
                stdio: 'pipe',
                maxBuffer: 1024 * 1024 * 10 // 10MB buffer
            });
            
            this.testResults[testName] = {
                status: 'passed',
                output: result,
                duration: Date.now() - this.startTime
            };
            
            this.log(`✅ ${testName} completed successfully`, 'success');
            return true;
        } catch (error) {
            this.testResults[testName] = {
                status: 'failed',
                error: error.message,
                output: error.stdout || '',
                stderr: error.stderr || '',
                duration: Date.now() - this.startTime
            };
            
            if (critical) {
                this.log(`❌ CRITICAL FAILURE: ${testName} - ${error.message}`, 'error');
                throw error;
            } else {
                this.log(`⚠️ WARNING: ${testName} failed - ${error.message}`, 'warning');
                return false;
            }
        }
    }

    async runFinalIntegration() {
        this.log('🚀 Starting Final Integration and System Testing');
        this.log('===============================================');
        this.log(`Start Time: ${new Date().toISOString()}`);
        this.log('');

        try {
            // Phase 1: System Layer Validation
            this.log('📋 Phase 1: System Layer Validation');
            await this.runTest('systemValidation', 'node scripts/system-validation.js', true);

            // Phase 2: Requirements Validation
            this.log('🎯 Phase 2: Requirements Validation');
            await this.runTest('requirementsValidation', 'node scripts/e2e-requirements-validation.js', true);

            // Phase 3: Complete Test Suite
            this.log('🧪 Phase 3: Complete Test Suite Execution');
            await this.runCompleteTestSuite();

            // Phase 4: Performance and Security Tests
            this.log('⚡ Phase 4: Performance and Security Tests');
            await this.runPerformanceAndSecurityTests();

            // Phase 5: Production Deployment Verification
            this.log('🚀 Phase 5: Production Deployment Verification');
            await this.runProductionVerification();

            // Phase 6: Final System Integration Test
            this.log('🔄 Phase 6: Final System Integration Test');
            await this.runTest('integrationTests', 'node scripts/final-integration-test.js', true);

            this.generateFinalReport();
            this.log('🎉 ALL FINAL INTEGRATION TESTS PASSED!', 'success');
            
        } catch (error) {
            this.log(`❌ Final integration testing failed: ${error.message}`, 'error');
            this.generateFailureReport();
            process.exit(1);
        }
    }

    async runCompleteTestSuite() {
        this.log('Running unit tests...');
        await this.runTest('unitTests', 'npm test -- --run --reporter=json', true);

        this.log('Running integration tests...');
        await this.runTest('integrationTestSuite', 'npm run test:integration -- --run', true);

        this.log('Running security tests...');
        await this.runTest('securityTestSuite', 'npm run test:security -- --run', true);

        this.log('Running E2E tests...');
        await this.runTest('e2eTests', 'npm run test:e2e -- --run', true);

        this.log('Running paper trading safety tests...');
        await this.runTest('paperTradingTests', 'npm run test:paper-trading -- --run', true);

        this.log('Running frontend tests...');
        await this.runTest('frontendTests', 'npm run test:frontend -- --run', true);
    }

    async runPerformanceAndSecurityTests() {
        this.log('Running performance benchmarks...');
        await this.runTest('performanceTests', 'node scripts/performance-benchmarking.js', true);

        this.log('Running security hardening validation...');
        await this.runTest('securityHardening', 'npm run test:security-hardening -- --run', true);

        this.log('Running load tests...');
        await this.runTest('loadTests', 'node scripts/load-test.js', false);

        this.log('Running paper trading safety verification...');
        await this.runTest('paperTradingSafety', 'node scripts/paper-trading-safety-verification.js', true);

        this.log('Running API permission validation...');
        await this.runTest('apiPermissions', 'node scripts/validate-api-permissions.js', true);
    }

    async runProductionVerification() {
        this.log('Running production readiness validation...');
        await this.runTest('productionReadiness', 'node scripts/production-readiness-validation.js', true);

        this.log('Running production smoke tests...');
        await this.runTest('productionSmokeTests', 'node scripts/production-smoke-tests.js', true);

        this.log('Running monitoring setup validation...');
        await this.runTest('monitoringValidation', 'node scripts/validate-monitoring-setup.js', true);

        this.log('Running Nginx deployment validation...');
        await this.runTest('nginxValidation', 'node scripts/validate-nginx-deployment.js', true);

        this.log('Running localhost hosting validation...');
        await this.runTest('localhostValidation', 'node scripts/validate-localhost-features.js', true);

        if (process.env.NODE_ENV === 'production') {
            this.log('Running SSL configuration validation...');
            await this.runTest('sslValidation', 'node scripts/validate-ssl-config.js', false);
        }
    }

    generateFinalReport() {
        const endTime = Date.now();
        const totalDuration = endTime - this.startTime;
        
        this.log('📊 Generating Final Integration Report');
        this.log('====================================');

        const passedTests = Object.values(this.testResults).filter(r => r && r.status === 'passed').length;
        const failedTests = Object.values(this.testResults).filter(r => r && r.status === 'failed').length;
        const totalTests = passedTests + failedTests;
        const successRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : '0';

        console.log(`\n📈 FINAL INTEGRATION TEST RESULTS:`);
        console.log(`   Total Duration: ${(totalDuration / 1000).toFixed(1)} seconds`);
        console.log(`   Total Tests: ${totalTests}`);
        console.log(`   Passed: ${passedTests}`);
        console.log(`   Failed: ${failedTests}`);
        console.log(`   Success Rate: ${successRate}%`);

        if (failedTests > 0) {
            console.log(`\n❌ FAILED TESTS:`);
            Object.entries(this.testResults).forEach(([testName, result]) => {
                if (result && result.status === 'failed') {
                    console.log(`   ${testName}: ${result.error}`);
                }
            });
        }

        // Generate comprehensive report
        const report = {
            timestamp: new Date().toISOString(),
            startTime: new Date(this.startTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
            totalDuration: `${(totalDuration / 1000).toFixed(1)} seconds`,
            summary: {
                totalTests,
                passed: passedTests,
                failed: failedTests,
                successRate: `${successRate}%`
            },
            testResults: this.testResults,
            systemInfo: {
                nodeVersion: process.version,
                platform: process.platform,
                architecture: process.arch,
                environment: process.env.NODE_ENV || 'development',
                timestamp: new Date().toISOString()
            },
            requirements: {
                allRequirementsMet: failedTests === 0,
                productionReady: failedTests === 0,
                paperTradingSafe: this.testResults.paperTradingSafety?.status === 'passed',
                securityHardened: this.testResults.securityHardening?.status === 'passed',
                performanceValidated: this.testResults.performanceTests?.status === 'passed'
            }
        };

        // Ensure test-results directory exists
        const testResultsDir = path.join(__dirname, '../test-results');
        if (!fs.existsSync(testResultsDir)) {
            fs.mkdirSync(testResultsDir, { recursive: true });
        }

        // Write comprehensive report
        fs.writeFileSync(
            path.join(testResultsDir, 'final-integration-report.json'),
            JSON.stringify(report, null, 2)
        );

        // Write summary report
        const summaryReport = {
            timestamp: report.timestamp,
            status: failedTests === 0 ? 'PASSED' : 'FAILED',
            summary: report.summary,
            requirements: report.requirements,
            criticalIssues: failedTests > 0 ? Object.entries(this.testResults)
                .filter(([_, result]) => result && result.status === 'failed')
                .map(([testName, result]) => ({ testName, error: result.error })) : []
        };

        fs.writeFileSync(
            path.join(testResultsDir, 'final-integration-summary.json'),
            JSON.stringify(summaryReport, null, 2)
        );

        if (failedTests === 0) {
            this.log('🎉 SYSTEM READY FOR PRODUCTION DEPLOYMENT!', 'success');
            this.log('All requirements validated, all tests passed, all safety mechanisms verified.', 'success');
        }
    }

    generateFailureReport() {
        const report = {
            timestamp: new Date().toISOString(),
            status: 'FAILED',
            error: 'Final integration testing failed',
            testResults: this.testResults,
            criticalFailures: Object.entries(this.testResults)
                .filter(([_, result]) => result && result.status === 'failed')
                .map(([testName, result]) => ({
                    testName,
                    error: result.error,
                    stderr: result.stderr
                }))
        };

        const testResultsDir = path.join(__dirname, '../test-results');
        if (!fs.existsSync(testResultsDir)) {
            fs.mkdirSync(testResultsDir, { recursive: true });
        }

        fs.writeFileSync(
            path.join(testResultsDir, 'final-integration-failure-report.json'),
            JSON.stringify(report, null, 2)
        );

        this.log('❌ FINAL INTEGRATION TESTING FAILED', 'error');
        this.log('Please review the failure report and fix critical issues before proceeding.', 'error');
    }
}

// Run orchestrator if this script is executed directly
if (require.main === module) {
    const orchestrator = new FinalIntegrationOrchestrator();
    orchestrator.runFinalIntegration().catch((error) => {
        console.error('❌ Fatal error in final integration orchestrator:', error);
        process.exit(1);
    });
}

module.exports = FinalIntegrationOrchestrator;