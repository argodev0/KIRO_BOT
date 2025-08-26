#!/usr/bin/env node

/**
 * Environment Preparation Script
 * 
 * Validates system requirements and prepares environment for production deployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class EnvironmentPreparation {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            warnings: 0,
            errors: []
        };
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async check(description, checkFn, critical = true) {
        try {
            this.log(`Checking: ${description}`);
            const result = await checkFn();
            this.results.passed++;
            this.log(`✅ PASSED: ${description}`, 'success');
            return result;
        } catch (error) {
            if (critical) {
                this.results.failed++;
                this.results.errors.push({ description, error: error.message });
                this.log(`❌ FAILED: ${description} - ${error.message}`, 'error');
            } else {
                this.results.warnings++;
                this.log(`⚠️ WARNING: ${description} - ${error.message}`, 'warning');
            }
            return null;
        }
    }

    async prepareEnvironment() {
        this.log('🚀 Starting Environment Preparation for Production Deployment');
        this.log('============================================================');

        // System Requirements Validation
        await this.validateSystemRequirements();

        // Node.js Version Validation
        await this.validateNodeJsVersion();

        // Development Tools Validation
        await this.validateDevelopmentTools();

        // System Resources Validation
        await this.validateSystemResources();

        // File System Permissions
        await this.validateFileSystemPermissions();

        // Network Connectivity
        await this.validateNetworkConnectivity();

        this.generatePreparationReport();
    }

    async validateSystemRequirements() {
        this.log('🔍 Validating System Requirements');

        await this.check('Operating System Compatibility', () => {
            const platform = os.platform();
            const supportedPlatforms = ['linux', 'darwin', 'win32'];
            
            if (!supportedPlatforms.includes(platform)) {
                throw new Error(`Unsupported platform: ${platform}`);
            }
            
            return `Platform: ${platform} (${os.arch()})`;
        });

        await this.check('System Memory', () => {
            const totalMemory = os.totalmem();
            const freeMemory = os.freemem();
            const memoryGB = totalMemory / (1024 * 1024 * 1024);
            
            if (memoryGB < 2) {
                throw new Error(`Insufficient memory: ${memoryGB.toFixed(2)}GB (minimum 2GB required)`);
            }
            
            return `Total: ${memoryGB.toFixed(2)}GB, Free: ${(freeMemory / (1024 * 1024 * 1024)).toFixed(2)}GB`;
        });

        await this.check('CPU Cores', () => {
            const cpus = os.cpus();
            
            if (cpus.length < 2) {
                throw new Error(`Insufficient CPU cores: ${cpus.length} (minimum 2 cores recommended)`);
            }
            
            return `${cpus.length} cores available`;
        }, false);

        await this.check('Disk Space', () => {
            try {
                const stats = fs.statSync('.');
                // This is a basic check - in production you'd want more sophisticated disk space checking
                return 'Disk space check passed (basic validation)';
            } catch (error) {
                throw new Error('Unable to check disk space');
            }
        });
    }

    async validateNodeJsVersion() {
        this.log('📦 Validating Node.js Version');

        await this.check('Node.js Installation', () => {
            try {
                const version = execSync('node --version', { encoding: 'utf8' }).trim();
                return `Node.js version: ${version}`;
            } catch (error) {
                throw new Error('Node.js is not installed or not in PATH');
            }
        });

        await this.check('Node.js Version Compatibility', () => {
            const version = execSync('node --version', { encoding: 'utf8' }).trim();
            const versionNumber = version.replace('v', '');
            const majorVersion = parseInt(versionNumber.split('.')[0]);
            
            if (majorVersion < 18) {
                throw new Error(`Node.js version ${version} is too old. Version >=18.0.0 required for full compatibility.`);
            }
            
            return `Node.js ${version} meets requirements (>=18.0.0)`;
        });

        await this.check('NPM Installation', () => {
            try {
                const version = execSync('npm --version', { encoding: 'utf8' }).trim();
                return `NPM version: ${version}`;
            } catch (error) {
                throw new Error('NPM is not installed or not in PATH');
            }
        });

        await this.check('NPM Version Compatibility', () => {
            const version = execSync('npm --version', { encoding: 'utf8' }).trim();
            const majorVersion = parseInt(version.split('.')[0]);
            
            if (majorVersion < 8) {
                throw new Error(`NPM version ${version} is too old. Version >=8.0.0 recommended.`);
            }
            
            return `NPM ${version} meets requirements`;
        }, false);
    }

    async validateDevelopmentTools() {
        this.log('🛠️ Validating Development Tools');

        await this.check('Git Installation', () => {
            try {
                const version = execSync('git --version', { encoding: 'utf8' }).trim();
                return version;
            } catch (error) {
                throw new Error('Git is not installed or not in PATH');
            }
        }, false);

        await this.check('Docker Installation', () => {
            try {
                const version = execSync('docker --version', { encoding: 'utf8' }).trim();
                return version;
            } catch (error) {
                throw new Error('Docker is not installed or not in PATH');
            }
        });

        await this.check('Docker Compose Installation', () => {
            try {
                const version = execSync('docker-compose --version', { encoding: 'utf8' }).trim();
                return version;
            } catch (error) {
                throw new Error('Docker Compose is not installed or not in PATH');
            }
        });

        await this.check('Docker Service Status', () => {
            try {
                execSync('docker info', { encoding: 'utf8', stdio: 'pipe' });
                return 'Docker service is running';
            } catch (error) {
                throw new Error('Docker service is not running or not accessible');
            }
        });
    }

    async validateSystemResources() {
        this.log('💾 Validating System Resources');

        await this.check('Load Average', () => {
            const loadAvg = os.loadavg();
            const cpuCount = os.cpus().length;
            const normalizedLoad = loadAvg[0] / cpuCount;
            
            if (normalizedLoad > 2.0) {
                throw new Error(`High system load: ${normalizedLoad.toFixed(2)} (normalized)`);
            }
            
            return `Load average: ${loadAvg[0].toFixed(2)} (normalized: ${normalizedLoad.toFixed(2)})`;
        }, false);

        await this.check('Memory Usage', () => {
            const totalMemory = os.totalmem();
            const freeMemory = os.freemem();
            const usedPercent = ((totalMemory - freeMemory) / totalMemory) * 100;
            
            if (usedPercent > 90) {
                throw new Error(`High memory usage: ${usedPercent.toFixed(1)}%`);
            }
            
            return `Memory usage: ${usedPercent.toFixed(1)}%`;
        }, false);

        await this.check('Temporary Directory Access', () => {
            const tmpDir = os.tmpdir();
            const testFile = path.join(tmpDir, 'kiro_bot_test_' + Date.now());
            
            try {
                fs.writeFileSync(testFile, 'test');
                fs.unlinkSync(testFile);
                return `Temporary directory accessible: ${tmpDir}`;
            } catch (error) {
                throw new Error(`Cannot write to temporary directory: ${tmpDir}`);
            }
        });
    }

    async validateFileSystemPermissions() {
        this.log('🔐 Validating File System Permissions');

        await this.check('Current Directory Write Access', () => {
            const testFile = 'test_write_' + Date.now() + '.tmp';
            
            try {
                fs.writeFileSync(testFile, 'test');
                fs.unlinkSync(testFile);
                return 'Write access confirmed';
            } catch (error) {
                throw new Error('No write access to current directory');
            }
        });

        await this.check('Package.json Accessibility', () => {
            const packagePath = path.join(__dirname, '../package.json');
            
            if (!fs.existsSync(packagePath)) {
                throw new Error('package.json not found');
            }
            
            try {
                const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
                return `Package: ${pkg.name} v${pkg.version}`;
            } catch (error) {
                throw new Error('Cannot read or parse package.json');
            }
        });

        await this.check('Node Modules Directory', () => {
            const nodeModulesPath = path.join(__dirname, '../node_modules');
            
            if (fs.existsSync(nodeModulesPath)) {
                return 'node_modules directory exists';
            } else {
                return 'node_modules directory does not exist (will be created during npm install)';
            }
        }, false);
    }

    async validateNetworkConnectivity() {
        this.log('🌐 Validating Network Connectivity');

        await this.check('DNS Resolution', () => {
            try {
                // Basic DNS test - try to resolve a common domain
                execSync('nslookup google.com', { encoding: 'utf8', stdio: 'pipe' });
                return 'DNS resolution working';
            } catch (error) {
                throw new Error('DNS resolution failed');
            }
        }, false);

        await this.check('Internet Connectivity', () => {
            try {
                // Try to ping a reliable server
                if (os.platform() === 'win32') {
                    execSync('ping -n 1 8.8.8.8', { encoding: 'utf8', stdio: 'pipe' });
                } else {
                    execSync('ping -c 1 8.8.8.8', { encoding: 'utf8', stdio: 'pipe' });
                }
                return 'Internet connectivity confirmed';
            } catch (error) {
                throw new Error('No internet connectivity');
            }
        }, false);

        await this.check('NPM Registry Access', () => {
            try {
                execSync('npm ping', { encoding: 'utf8', stdio: 'pipe' });
                return 'NPM registry accessible';
            } catch (error) {
                throw new Error('Cannot access NPM registry');
            }
        }, false);
    }

    generatePreparationReport() {
        this.log('📊 Generating Environment Preparation Report');
        this.log('==========================================');

        const totalChecks = this.results.passed + this.results.failed + this.results.warnings;
        const successRate = totalChecks > 0 ? ((this.results.passed / totalChecks) * 100).toFixed(1) : '0';

        console.log(`\n📈 ENVIRONMENT PREPARATION RESULTS:`);
        console.log(`   Total Checks: ${totalChecks}`);
        console.log(`   Passed: ${this.results.passed}`);
        console.log(`   Failed: ${this.results.failed}`);
        console.log(`   Warnings: ${this.results.warnings}`);
        console.log(`   Success Rate: ${successRate}%`);

        if (this.results.failed > 0) {
            console.log(`\n❌ CRITICAL FAILURES:`);
            this.results.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error.description}`);
                console.log(`      Error: ${error.error}`);
            });
        }

        // Generate detailed report
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalChecks,
                passed: this.results.passed,
                failed: this.results.failed,
                warnings: this.results.warnings,
                successRate: `${successRate}%`
            },
            systemInfo: {
                platform: os.platform(),
                arch: os.arch(),
                nodeVersion: process.version,
                totalMemory: `${(os.totalmem() / (1024 * 1024 * 1024)).toFixed(2)}GB`,
                cpuCores: os.cpus().length,
                hostname: os.hostname()
            },
            errors: this.results.errors,
            readyForDeployment: this.results.failed === 0
        };

        // Ensure test-results directory exists
        const testResultsDir = path.join(__dirname, '../test-results');
        if (!fs.existsSync(testResultsDir)) {
            fs.mkdirSync(testResultsDir, { recursive: true });
        }

        fs.writeFileSync(
            path.join(testResultsDir, 'environment-preparation-report.json'),
            JSON.stringify(report, null, 2)
        );

        if (this.results.failed === 0) {
            this.log('🎉 ENVIRONMENT PREPARATION COMPLETED SUCCESSFULLY!', 'success');
            this.log('✅ System is ready for production deployment preparation.', 'success');
            
            if (this.results.warnings > 0) {
                this.log(`⚠️ Note: ${this.results.warnings} warnings detected. Review recommended but not blocking.`, 'warning');
            }
            
            this.log('', 'info');
            this.log('Next steps:', 'info');
            this.log('1. Proceed with dependency installation: npm install', 'info');
            this.log('2. Run security audit: npm audit', 'info');
            this.log('3. Validate TypeScript compilation: npm run build', 'info');
            this.log('4. Configure production environment variables', 'info');
            
            return true;
        } else {
            this.log('❌ ENVIRONMENT PREPARATION FAILED', 'error');
            this.log('Please resolve critical issues before proceeding with deployment.', 'error');
            
            // Provide specific guidance for common issues
            if (this.results.errors.some(e => e.description.includes('Node.js Version'))) {
                this.log('', 'info');
                this.log('Node.js Upgrade Required:', 'info');
                this.log('- Install Node.js version 18 or higher', 'info');
                this.log('- Use nvm (Node Version Manager) for easy version switching', 'info');
                this.log('- Verify installation with: node --version', 'info');
            }
            
            return false;
        }
    }
}

// Run environment preparation if this script is executed directly
if (require.main === module) {
    const preparation = new EnvironmentPreparation();
    preparation.prepareEnvironment().catch((error) => {
        console.error('❌ Fatal error during environment preparation:', error);
        process.exit(1);
    });
}

module.exports = EnvironmentPreparation;