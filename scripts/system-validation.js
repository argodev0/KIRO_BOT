#!/usr/bin/env node

/**
 * System Validation Script
 * 
 * Validates all system layers and components for production readiness
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class SystemValidator {
    constructor() {
        this.validationResults = [];
        this.criticalErrors = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async validate(description, validationFn, critical = false) {
        try {
            this.log(`Validating: ${description}`);
            const result = await validationFn();
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
            throw error;
        }
    }

    async validateSystemLayers() {
        this.log('🔍 Starting System Layer Validation');
        this.log('===================================');

        // Layer 1: Infrastructure Validation
        await this.validateInfrastructure();

        // Layer 2: Application Layer Validation
        await this.validateApplicationLayer();

        // Layer 3: Paper Trading Layer Validation
        await this.validatePaperTradingLayer();

        // Layer 4: Security Layer Validation
        await this.validateSecurityLayer();

        // Layer 5: Monitoring Layer Validation
        await this.validateMonitoringLayer();

        // Layer 6: Frontend Layer Validation
        await this.validateFrontendLayer();

        this.generateValidationReport();
    }

    async validateInfrastructure() {
        this.log('🏗️ Validating Infrastructure Layer');

        await this.validate('Docker Environment', async () => {
            const result = execSync('docker --version', { encoding: 'utf8' });
            if (!result.includes('Docker version')) {
                throw new Error('Docker not available');
            }
            return result.trim();
        }, true);

        await this.validate('Docker Compose', async () => {
            const result = execSync('docker-compose --version', { encoding: 'utf8' });
            if (!result.includes('docker-compose version')) {
                throw new Error('Docker Compose not available');
            }
            return result.trim();
        }, true);

        await this.validate('Production Docker Configuration', async () => {
            const configPath = path.join(__dirname, '../docker/docker-compose.prod.yml');
            if (!fs.existsSync(configPath)) {
                throw new Error('Production Docker configuration not found');
            }
            const config = fs.readFileSync(configPath, 'utf8');
            if (!config.includes('restart: unless-stopped')) {
                throw new Error('Production Docker config missing restart policies');
            }
            return 'Production Docker configuration valid';
        }, true);

        await this.validate('Nginx Configuration', async () => {
            const nginxPath = path.join(__dirname, '../docker/nginx/complete-production.conf');
            if (!fs.existsSync(nginxPath)) {
                throw new Error('Nginx configuration not found');
            }
            const config = fs.readFileSync(nginxPath, 'utf8');
            if (!config.includes('ssl_certificate') || !config.includes('proxy_pass')) {
                throw new Error('Nginx configuration incomplete');
            }
            return 'Nginx configuration valid';
        }, true);

        await this.validate('Database Configuration', async () => {
            const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
            if (!fs.existsSync(schemaPath)) {
                throw new Error('Database schema not found');
            }
            return 'Database configuration valid';
        }, true);
    }

    async validateApplicationLayer() {
        this.log('🚀 Validating Application Layer');

        await this.validate('Node.js Dependencies', async () => {
            const packagePath = path.join(__dirname, '../package.json');
            if (!fs.existsSync(packagePath)) {
                throw new Error('package.json not found');
            }
            const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            const requiredDeps = ['express', 'prisma', 'redis', 'ws', 'axios'];
            for (const dep of requiredDeps) {
                if (!pkg.dependencies[dep] && !pkg.devDependencies[dep]) {
                    throw new Error(`Required dependency ${dep} not found`);
                }
            }
            return 'All required dependencies present';
        }, true);

        await this.validate('TypeScript Configuration', async () => {
            const tsconfigPath = path.join(__dirname, '../tsconfig.json');
            if (!fs.existsSync(tsconfigPath)) {
                throw new Error('tsconfig.json not found');
            }
            return 'TypeScript configuration valid';
        }, true);

        await this.validate('Environment Configuration', async () => {
            const envTemplatePath = path.join(__dirname, '../.env.production.template');
            if (!fs.existsSync(envTemplatePath)) {
                throw new Error('Production environment template not found');
            }
            const envTemplate = fs.readFileSync(envTemplatePath, 'utf8');
            const requiredVars = ['NODE_ENV', 'DATABASE_URL', 'REDIS_URL', 'PAPER_TRADING_MODE'];
            for (const varName of requiredVars) {
                if (!envTemplate.includes(varName)) {
                    throw new Error(`Required environment variable ${varName} not in template`);
                }
            }
            return 'Environment configuration valid';
        }, true);

        await this.validate('API Routes Configuration', async () => {
            const routesPath = path.join(__dirname, '../src/routes');
            if (!fs.existsSync(routesPath)) {
                throw new Error('API routes directory not found');
            }
            const requiredRoutes = ['health.ts', 'trading.ts', 'market-data.ts'];
            for (const route of requiredRoutes) {
                const routePath = path.join(routesPath, route);
                if (!fs.existsSync(routePath)) {
                    throw new Error(`Required route ${route} not found`);
                }
            }
            return 'API routes configuration valid';
        }, true);
    }

    async validatePaperTradingLayer() {
        this.log('🛡️ Validating Paper Trading Layer');

        await this.validate('Paper Trading Guard Middleware', async () => {
            const guardPath = path.join(__dirname, '../src/middleware/paperTradingGuard.ts');
            if (!fs.existsSync(guardPath)) {
                throw new Error('Paper trading guard middleware not found');
            }
            const guardCode = fs.readFileSync(guardPath, 'utf8');
            if (!guardCode.includes('isPaperTrade') || !guardCode.includes('blockRealTrades')) {
                throw new Error('Paper trading guard missing critical functions');
            }
            return 'Paper trading guard middleware valid';
        }, true);

        await this.validate('Virtual Portfolio Manager', async () => {
            const portfolioPath = path.join(__dirname, '../src/services/VirtualPortfolioManager.ts');
            if (!fs.existsSync(portfolioPath)) {
                throw new Error('Virtual portfolio manager not found');
            }
            const portfolioCode = fs.readFileSync(portfolioPath, 'utf8');
            if (!portfolioCode.includes('virtualBalance') || !portfolioCode.includes('simulatedTrade')) {
                throw new Error('Virtual portfolio manager missing critical functions');
            }
            return 'Virtual portfolio manager valid';
        }, true);

        await this.validate('Trade Simulation Engine', async () => {
            const enginePath = path.join(__dirname, '../src/services/TradeSimulationEngine.ts');
            if (!fs.existsSync(enginePath)) {
                throw new Error('Trade simulation engine not found');
            }
            const engineCode = fs.readFileSync(enginePath, 'utf8');
            if (!engineCode.includes('simulateOrder') || !engineCode.includes('applySlippage')) {
                throw new Error('Trade simulation engine missing critical functions');
            }
            return 'Trade simulation engine valid';
        }, true);

        await this.validate('API Permission Validator', async () => {
            const validatorPath = path.join(__dirname, '../src/utils/ApiPermissionValidator.ts');
            if (!fs.existsSync(validatorPath)) {
                throw new Error('API permission validator not found');
            }
            const validatorCode = fs.readFileSync(validatorPath, 'utf8');
            if (!validatorCode.includes('validatePermissions') || !validatorCode.includes('READ_ONLY')) {
                throw new Error('API permission validator missing critical functions');
            }
            return 'API permission validator valid';
        }, true);
    }

    async validateSecurityLayer() {
        this.log('🔒 Validating Security Layer');

        await this.validate('Security Middleware', async () => {
            const securityPath = path.join(__dirname, '../src/middleware/security.ts');
            if (!fs.existsSync(securityPath)) {
                throw new Error('Security middleware not found');
            }
            const securityCode = fs.readFileSync(securityPath, 'utf8');
            if (!securityCode.includes('helmet') || !securityCode.includes('cors')) {
                throw new Error('Security middleware missing critical protections');
            }
            return 'Security middleware valid';
        }, true);

        await this.validate('Input Validation', async () => {
            const validationPath = path.join(__dirname, '../src/middleware/inputValidation.ts');
            if (!fs.existsSync(validationPath)) {
                throw new Error('Input validation middleware not found');
            }
            const validationCode = fs.readFileSync(validationPath, 'utf8');
            if (!validationCode.includes('sanitize') || !validationCode.includes('validate')) {
                throw new Error('Input validation middleware missing critical functions');
            }
            return 'Input validation valid';
        }, true);

        await this.validate('Rate Limiting', async () => {
            const rateLimitPath = path.join(__dirname, '../src/middleware/rateLimiter.ts');
            if (!fs.existsSync(rateLimitPath)) {
                throw new Error('Rate limiter middleware not found');
            }
            const rateLimitCode = fs.readFileSync(rateLimitPath, 'utf8');
            if (!rateLimitCode.includes('rateLimit') || !rateLimitCode.includes('windowMs')) {
                throw new Error('Rate limiter missing critical configuration');
            }
            return 'Rate limiting valid';
        }, true);

        await this.validate('Production Security Hardening', async () => {
            const hardeningPath = path.join(__dirname, '../src/middleware/productionSecurityHardening.ts');
            if (!fs.existsSync(hardeningPath)) {
                throw new Error('Production security hardening not found');
            }
            const hardeningCode = fs.readFileSync(hardeningPath, 'utf8');
            if (!hardeningCode.includes('securityHeaders') || !hardeningCode.includes('auditLog')) {
                throw new Error('Production security hardening missing critical features');
            }
            return 'Production security hardening valid';
        }, true);
    }

    async validateMonitoringLayer() {
        this.log('📊 Validating Monitoring Layer');

        await this.validate('Monitoring Service', async () => {
            const monitoringPath = path.join(__dirname, '../src/services/MonitoringService.ts');
            if (!fs.existsSync(monitoringPath)) {
                throw new Error('Monitoring service not found');
            }
            const monitoringCode = fs.readFileSync(monitoringPath, 'utf8');
            if (!monitoringCode.includes('prometheus') || !monitoringCode.includes('metrics')) {
                throw new Error('Monitoring service missing critical features');
            }
            return 'Monitoring service valid';
        }, true);

        await this.validate('Health Controller', async () => {
            const healthPath = path.join(__dirname, '../src/controllers/HealthController.ts');
            if (!fs.existsSync(healthPath)) {
                throw new Error('Health controller not found');
            }
            const healthCode = fs.readFileSync(healthPath, 'utf8');
            if (!healthCode.includes('healthCheck') || !healthCode.includes('status')) {
                throw new Error('Health controller missing critical endpoints');
            }
            return 'Health controller valid';
        }, true);

        await this.validate('Prometheus Configuration', async () => {
            const prometheusPath = path.join(__dirname, '../monitoring/prometheus.yml');
            if (!fs.existsSync(prometheusPath)) {
                throw new Error('Prometheus configuration not found');
            }
            const prometheusConfig = fs.readFileSync(prometheusPath, 'utf8');
            if (!prometheusConfig.includes('scrape_configs') || !prometheusConfig.includes('job_name')) {
                throw new Error('Prometheus configuration incomplete');
            }
            return 'Prometheus configuration valid';
        }, true);

        await this.validate('Grafana Dashboards', async () => {
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
    }

    async validateFrontendLayer() {
        this.log('🎨 Validating Frontend Layer');

        await this.validate('React Application Structure', async () => {
            const appPath = path.join(__dirname, '../src/frontend/App.tsx');
            if (!fs.existsSync(appPath)) {
                throw new Error('React App component not found');
            }
            const appCode = fs.readFileSync(appPath, 'utf8');
            if (!appCode.includes('PaperTradingIndicator') || !appCode.includes('Router')) {
                throw new Error('React App missing critical components');
            }
            return 'React application structure valid';
        }, true);

        await this.validate('Paper Trading Indicators', async () => {
            const indicatorPath = path.join(__dirname, '../src/frontend/components/common/PaperTradingIndicator.tsx');
            if (!fs.existsSync(indicatorPath)) {
                throw new Error('Paper trading indicator component not found');
            }
            const indicatorCode = fs.readFileSync(indicatorPath, 'utf8');
            if (!indicatorCode.includes('PAPER TRADING') || !indicatorCode.includes('warning')) {
                throw new Error('Paper trading indicator missing critical features');
            }
            return 'Paper trading indicators valid';
        }, true);

        await this.validate('Virtual Portfolio Display', async () => {
            const portfolioPath = path.join(__dirname, '../src/frontend/components/dashboard/VirtualPortfolioDisplay.tsx');
            if (!fs.existsSync(portfolioPath)) {
                throw new Error('Virtual portfolio display component not found');
            }
            const portfolioCode = fs.readFileSync(portfolioPath, 'utf8');
            if (!portfolioCode.includes('virtualBalance') || !portfolioCode.includes('simulated')) {
                throw new Error('Virtual portfolio display missing critical features');
            }
            return 'Virtual portfolio display valid';
        }, true);

        await this.validate('Trading View Chart Integration', async () => {
            const chartPath = path.join(__dirname, '../src/frontend/components/charts/EnhancedTradingViewChart.tsx');
            if (!fs.existsSync(chartPath)) {
                throw new Error('TradingView chart component not found');
            }
            const chartCode = fs.readFileSync(chartPath, 'utf8');
            if (!chartCode.includes('TradingView') || !chartCode.includes('realtime')) {
                throw new Error('TradingView chart missing critical features');
            }
            return 'TradingView chart integration valid';
        }, true);

        await this.validate('Vite Configuration', async () => {
            const vitePath = path.join(__dirname, '../vite.config.ts');
            if (!fs.existsSync(vitePath)) {
                throw new Error('Vite configuration not found');
            }
            const viteConfig = fs.readFileSync(vitePath, 'utf8');
            if (!viteConfig.includes('react') || !viteConfig.includes('build')) {
                throw new Error('Vite configuration incomplete');
            }
            return 'Vite configuration valid';
        }, true);
    }

    generateValidationReport() {
        this.log('📋 Generating System Validation Report');
        this.log('====================================');

        const totalValidations = this.validationResults.length;
        const passedValidations = this.validationResults.filter(r => r.status === 'passed').length;
        const failedValidations = this.validationResults.filter(r => r.status === 'failed').length;
        const successRate = ((passedValidations / totalValidations) * 100).toFixed(2);

        console.log(`\n📊 SYSTEM VALIDATION RESULTS:`);
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

        // Generate detailed report
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
            }
        };

        // Ensure test-results directory exists
        const testResultsDir = path.join(__dirname, '../test-results');
        if (!fs.existsSync(testResultsDir)) {
            fs.mkdirSync(testResultsDir, { recursive: true });
        }

        fs.writeFileSync(
            path.join(testResultsDir, 'system-validation-report.json'),
            JSON.stringify(report, null, 2)
        );

        if (this.criticalErrors.length === 0) {
            this.log('🎉 ALL CRITICAL VALIDATIONS PASSED! System layers are properly configured.', 'success');
            return true;
        } else {
            this.log('❌ Critical validation errors found. Please fix before proceeding.', 'error');
            return false;
        }
    }
}

// Run validation if this script is executed directly
if (require.main === module) {
    const validator = new SystemValidator();
    validator.validateSystemLayers().catch((error) => {
        console.error('❌ Fatal error during system validation:', error);
        process.exit(1);
    });
}

module.exports = SystemValidator;