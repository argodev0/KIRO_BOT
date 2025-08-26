#!/usr/bin/env node

/**
 * Simple Final Validation Script
 * 
 * Validates the system without external dependencies
 */

const fs = require('fs');
const path = require('path');

class SimpleFinalValidator {
    constructor() {
        this.validationResults = [];
        this.criticalErrors = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    validate(description, validationFn, critical = false) {
        try {
            this.log(`Validating: ${description}`);
            const result = validationFn();
            this.validationResults.push({ description, status: 'passed', result });
            this.log(`✅ PASSED: ${description}`, 'success');
            return result;
        } catch (error) {
            this.validationResults.push({ description, status: 'failed', error: error.message });
            if (critical) {
                this.criticalErrors.push({ description, error: error.message });
                this.log(`❌ CRITICAL FAILURE: ${description} - ${error.message}`, 'error');
            } else {
                this.log(`⚠️ WARNING: ${description} - ${error.message}`, 'warning');
            }
            return false;
        }
    }

    runFinalValidation() {
        this.log('🚀 Starting Simple Final Integration Validation');
        this.log('===============================================');

        // Phase 1: File Structure Validation
        this.log('📁 Phase 1: File Structure Validation');
        this.validateFileStructure();

        // Phase 2: Configuration Validation
        this.log('⚙️ Phase 2: Configuration Validation');
        this.validateConfigurations();

        // Phase 3: Paper Trading Safety Validation
        this.log('🛡️ Phase 3: Paper Trading Safety Validation');
        this.validatePaperTradingSafety();

        // Phase 4: Production Infrastructure Validation
        this.log('🏗️ Phase 4: Production Infrastructure Validation');
        this.validateProductionInfrastructure();

        // Phase 5: Frontend Components Validation
        this.log('🎨 Phase 5: Frontend Components Validation');
        this.validateFrontendComponents();

        // Phase 6: Test Scripts Validation
        this.log('🧪 Phase 6: Test Scripts Validation');
        this.validateTestScripts();

        this.generateFinalReport();
    }

    validateFileStructure() {
        // Core application files
        this.validate('Main application entry point', () => {
            if (!fs.existsSync(path.join(__dirname, '../src/index.ts'))) {
                throw new Error('Main application entry point not found');
            }
            return 'Main entry point exists';
        }, true);

        this.validate('Package.json configuration', () => {
            const packagePath = path.join(__dirname, '../package.json');
            if (!fs.existsSync(packagePath)) {
                throw new Error('package.json not found');
            }
            const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            if (!pkg.scripts || !pkg.scripts['test:final-integration']) {
                throw new Error('Final integration test script not configured');
            }
            return 'Package.json properly configured';
        }, true);

        this.validate('TypeScript configuration', () => {
            if (!fs.existsSync(path.join(__dirname, '../tsconfig.json'))) {
                throw new Error('tsconfig.json not found');
            }
            return 'TypeScript configuration exists';
        }, true);

        this.validate('Database schema', () => {
            if (!fs.existsSync(path.join(__dirname, '../prisma/schema.prisma'))) {
                throw new Error('Database schema not found');
            }
            return 'Database schema exists';
        }, true);
    }

    validateConfigurations() {
        this.validate('Production environment template', () => {
            const envPath = path.join(__dirname, '../.env.production.template');
            if (!fs.existsSync(envPath)) {
                throw new Error('Production environment template not found');
            }
            const envContent = fs.readFileSync(envPath, 'utf8');
            const requiredVars = ['NODE_ENV', 'PAPER_TRADING_MODE', 'DATABASE_URL'];
            for (const varName of requiredVars) {
                if (!envContent.includes(varName)) {
                    throw new Error(`Required environment variable ${varName} not in template`);
                }
            }
            return 'Production environment template valid';
        }, true);

        this.validate('Docker production configuration', () => {
            const dockerPath = path.join(__dirname, '../docker/docker-compose.prod.yml');
            if (!fs.existsSync(dockerPath)) {
                throw new Error('Docker production configuration not found');
            }
            const dockerContent = fs.readFileSync(dockerPath, 'utf8');
            if (!dockerContent.includes('restart: unless-stopped')) {
                throw new Error('Docker configuration missing restart policies');
            }
            return 'Docker production configuration valid';
        }, true);

        this.validate('Nginx configuration', () => {
            const nginxPath = path.join(__dirname, '../docker/nginx/complete-production.conf');
            if (!fs.existsSync(nginxPath)) {
                throw new Error('Nginx configuration not found');
            }
            const nginxContent = fs.readFileSync(nginxPath, 'utf8');
            if (!nginxContent.includes('proxy_pass') || !nginxContent.includes('ssl_certificate')) {
                throw new Error('Nginx configuration incomplete');
            }
            return 'Nginx configuration valid';
        }, true);
    }

    validatePaperTradingSafety() {
        this.validate('Paper trading guard middleware', () => {
            const guardPath = path.join(__dirname, '../src/middleware/paperTradingGuard.ts');
            if (!fs.existsSync(guardPath)) {
                throw new Error('Paper trading guard middleware not found');
            }
            const guardContent = fs.readFileSync(guardPath, 'utf8');
            if (!guardContent.includes('isPaperTrade') || !guardContent.includes('blockRealMoneyOperations')) {
                throw new Error('Paper trading guard missing critical functions');
            }
            return 'Paper trading guard middleware valid';
        }, true);

        this.validate('Virtual portfolio manager', () => {
            const portfolioPath = path.join(__dirname, '../src/services/VirtualPortfolioManager.ts');
            if (!fs.existsSync(portfolioPath)) {
                throw new Error('Virtual portfolio manager not found');
            }
            const portfolioContent = fs.readFileSync(portfolioPath, 'utf8');
            if (!portfolioContent.includes('virtualBalance') || !portfolioContent.includes('simulatedTrade')) {
                throw new Error('Virtual portfolio manager missing critical functions');
            }
            return 'Virtual portfolio manager valid';
        }, true);

        this.validate('Trade simulation engine', () => {
            const enginePath = path.join(__dirname, '../src/services/TradeSimulationEngine.ts');
            if (!fs.existsSync(enginePath)) {
                throw new Error('Trade simulation engine not found');
            }
            const engineContent = fs.readFileSync(enginePath, 'utf8');
            if (!engineContent.includes('simulateOrderExecution') || !engineContent.includes('slippage')) {
                throw new Error('Trade simulation engine missing critical functions');
            }
            return 'Trade simulation engine valid';
        }, true);

        this.validate('API permission validator', () => {
            const validatorPath = path.join(__dirname, '../src/utils/ApiPermissionValidator.ts');
            if (!fs.existsSync(validatorPath)) {
                throw new Error('API permission validator not found');
            }
            const validatorContent = fs.readFileSync(validatorPath, 'utf8');
            if (!validatorContent.includes('validateApiKey') || !validatorContent.includes('isReadOnly')) {
                throw new Error('API permission validator missing critical functions');
            }
            return 'API permission validator valid';
        }, true);
    }

    validateProductionInfrastructure() {
        this.validate('Monitoring configuration', () => {
            const prometheusPath = path.join(__dirname, '../monitoring/prometheus.yml');
            if (!fs.existsSync(prometheusPath)) {
                throw new Error('Prometheus configuration not found');
            }
            const prometheusContent = fs.readFileSync(prometheusPath, 'utf8');
            if (!prometheusContent.includes('scrape_configs')) {
                throw new Error('Prometheus configuration incomplete');
            }
            return 'Monitoring configuration valid';
        }, true);

        this.validate('Grafana dashboards', () => {
            const dashboardsPath = path.join(__dirname, '../monitoring/grafana/dashboards');
            if (!fs.existsSync(dashboardsPath)) {
                throw new Error('Grafana dashboards directory not found');
            }
            const requiredDashboards = [
                'trading-bot-overview.json',
                'paper-trading-safety.json',
                'system-metrics.json'
            ];
            for (const dashboard of requiredDashboards) {
                const dashboardPath = path.join(dashboardsPath, dashboard);
                if (!fs.existsSync(dashboardPath)) {
                    throw new Error(`Required dashboard ${dashboard} not found`);
                }
            }
            return 'Grafana dashboards valid';
        }, true);

        this.validate('Health controller', () => {
            const healthPath = path.join(__dirname, '../src/controllers/HealthController.ts');
            if (!fs.existsSync(healthPath)) {
                throw new Error('Health controller not found');
            }
            const healthContent = fs.readFileSync(healthPath, 'utf8');
            if (!healthContent.includes('basicHealth') || !healthContent.includes('detailedHealth')) {
                throw new Error('Health controller missing critical endpoints');
            }
            return 'Health controller valid';
        }, true);

        this.validate('Security middleware', () => {
            const securityPath = path.join(__dirname, '../src/middleware/security.ts');
            if (!fs.existsSync(securityPath)) {
                throw new Error('Security middleware not found');
            }
            const securityContent = fs.readFileSync(securityPath, 'utf8');
            if (!securityContent.includes('helmet') || !securityContent.includes('cors')) {
                throw new Error('Security middleware missing critical protections');
            }
            return 'Security middleware valid';
        }, true);
    }

    validateFrontendComponents() {
        this.validate('React application structure', () => {
            const appPath = path.join(__dirname, '../src/frontend/App.tsx');
            if (!fs.existsSync(appPath)) {
                throw new Error('React App component not found');
            }
            const appContent = fs.readFileSync(appPath, 'utf8');
            if (!appContent.includes('PaperTradingIndicator') || !appContent.includes('Routes')) {
                throw new Error('React App missing critical components');
            }
            return 'React application structure valid';
        }, true);

        this.validate('Paper trading indicators', () => {
            const indicatorPath = path.join(__dirname, '../src/frontend/components/common/PaperTradingIndicator.tsx');
            if (!fs.existsSync(indicatorPath)) {
                throw new Error('Paper trading indicator component not found');
            }
            const indicatorContent = fs.readFileSync(indicatorPath, 'utf8');
            if (!indicatorContent.includes('PAPER TRADING') || !indicatorContent.includes('warning')) {
                throw new Error('Paper trading indicator missing critical features');
            }
            return 'Paper trading indicators valid';
        }, true);

        this.validate('Virtual portfolio display', () => {
            const portfolioPath = path.join(__dirname, '../src/frontend/components/dashboard/VirtualPortfolioDisplay.tsx');
            if (!fs.existsSync(portfolioPath)) {
                throw new Error('Virtual portfolio display component not found');
            }
            const portfolioContent = fs.readFileSync(portfolioPath, 'utf8');
            if (!portfolioContent.includes('Virtual Portfolio') || !portfolioContent.includes('Simulated')) {
                throw new Error('Virtual portfolio display missing critical features');
            }
            return 'Virtual portfolio display valid';
        }, true);

        this.validate('TradingView chart integration', () => {
            const chartPath = path.join(__dirname, '../src/frontend/components/charts/EnhancedTradingViewChart.tsx');
            if (!fs.existsSync(chartPath)) {
                throw new Error('TradingView chart component not found');
            }
            const chartContent = fs.readFileSync(chartPath, 'utf8');
            if (!chartContent.includes('TradingView') || !chartContent.includes('LIVE DATA')) {
                throw new Error('TradingView chart missing critical features');
            }
            return 'TradingView chart integration valid';
        }, true);
    }

    validateTestScripts() {
        this.validate('Final integration test scripts', () => {
            const scripts = [
                'final-integration-test.js',
                'system-validation.js',
                'e2e-requirements-validation.js',
                'run-final-integration.js'
            ];
            
            for (const script of scripts) {
                const scriptPath = path.join(__dirname, script);
                if (!fs.existsSync(scriptPath)) {
                    throw new Error(`Test script ${script} not found`);
                }
            }
            return 'Final integration test scripts valid';
        }, true);

        this.validate('Production validation scripts', () => {
            const scripts = [
                'production-readiness-validation.js',
                'production-smoke-tests.js',
                'paper-trading-safety-verification.js',
                'validate-api-permissions.js'
            ];
            
            for (const script of scripts) {
                const scriptPath = path.join(__dirname, script);
                if (!fs.existsSync(scriptPath)) {
                    throw new Error(`Production validation script ${script} not found`);
                }
            }
            return 'Production validation scripts valid';
        }, true);

        this.validate('Monitoring validation scripts', () => {
            const scripts = [
                'validate-monitoring-setup.js',
                'validate-nginx-deployment.js',
                'validate-localhost-features.js'
            ];
            
            for (const script of scripts) {
                const scriptPath = path.join(__dirname, script);
                if (!fs.existsSync(scriptPath)) {
                    throw new Error(`Monitoring validation script ${script} not found`);
                }
            }
            return 'Monitoring validation scripts valid';
        }, true);

        this.validate('Performance and security test scripts', () => {
            const scripts = [
                'performance-benchmarking.js',
                'load-test.js'
            ];
            
            for (const script of scripts) {
                const scriptPath = path.join(__dirname, script);
                if (!fs.existsSync(scriptPath)) {
                    throw new Error(`Performance/security test script ${script} not found`);
                }
            }
            return 'Performance and security test scripts valid';
        }, true);
    }

    generateFinalReport() {
        this.log('📊 Generating Final Validation Report');
        this.log('====================================');

        const totalValidations = this.validationResults.length;
        const passedValidations = this.validationResults.filter(r => r.status === 'passed').length;
        const failedValidations = this.validationResults.filter(r => r.status === 'failed').length;
        const successRate = ((passedValidations / totalValidations) * 100).toFixed(1);

        console.log(`\n📈 FINAL VALIDATION RESULTS:`);
        console.log(`   Total Validations: ${totalValidations}`);
        console.log(`   Passed: ${passedValidations}`);
        console.log(`   Failed: ${failedValidations}`);
        console.log(`   Success Rate: ${successRate}%`);
        console.log(`   Critical Errors: ${this.criticalErrors.length}`);

        if (this.criticalErrors.length > 0) {
            console.log(`\n❌ CRITICAL ERRORS:`);
            this.criticalErrors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error.description}`);
                console.log(`      Error: ${error.error}`);
            });
        }

        // Generate report file
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalValidations,
                passed: passedValidations,
                failed: failedValidations,
                successRate: `${successRate}%`,
                criticalErrors: this.criticalErrors.length
            },
            validations: this.validationResults,
            criticalErrors: this.criticalErrors,
            systemInfo: {
                nodeVersion: process.version,
                platform: process.platform,
                environment: process.env.NODE_ENV || 'development'
            },
            requirements: {
                allComponentsPresent: this.criticalErrors.length === 0,
                paperTradingSafetyImplemented: this.validationResults.filter(v => 
                    v.description.includes('paper trading') && v.status === 'passed'
                ).length > 0,
                productionInfrastructureReady: this.validationResults.filter(v => 
                    v.description.includes('production') && v.status === 'passed'
                ).length > 0,
                frontendComponentsComplete: this.validationResults.filter(v => 
                    v.description.includes('React') && v.status === 'passed'
                ).length > 0,
                testingInfrastructureReady: this.validationResults.filter(v => 
                    v.description.includes('test') && v.status === 'passed'
                ).length > 0
            }
        };

        // Ensure test-results directory exists
        const testResultsDir = path.join(__dirname, '../test-results');
        if (!fs.existsSync(testResultsDir)) {
            fs.mkdirSync(testResultsDir, { recursive: true });
        }

        fs.writeFileSync(
            path.join(testResultsDir, 'simple-final-validation-report.json'),
            JSON.stringify(report, null, 2)
        );

        if (this.criticalErrors.length === 0) {
            this.log('🎉 ALL CRITICAL VALIDATIONS PASSED!', 'success');
            this.log('✅ System components are properly implemented and configured.', 'success');
            this.log('✅ Paper trading safety mechanisms are in place.', 'success');
            this.log('✅ Production infrastructure is configured.', 'success');
            this.log('✅ Frontend components are implemented.', 'success');
            this.log('✅ Testing infrastructure is ready.', 'success');
            this.log('', 'info');
            this.log('🚀 SYSTEM IS READY FOR FINAL INTEGRATION TESTING!', 'success');
            this.log('', 'info');
            this.log('Next steps:', 'info');
            this.log('1. Install dependencies with a compatible Node.js version (>=18)', 'info');
            this.log('2. Run the complete test suite: npm run test:final-integration', 'info');
            this.log('3. Deploy to production environment', 'info');
            this.log('4. Verify paper trading mode is enforced', 'info');
            return true;
        } else {
            this.log('❌ CRITICAL VALIDATION ERRORS FOUND', 'error');
            this.log('Please fix critical issues before proceeding with integration testing.', 'error');
            return false;
        }
    }
}

// Run validation if this script is executed directly
if (require.main === module) {
    const validator = new SimpleFinalValidator();
    const success = validator.runFinalValidation();
    process.exit(success ? 0 : 1);
}

module.exports = SimpleFinalValidator;