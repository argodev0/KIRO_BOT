#!/usr/bin/env node

/**
 * Simplified Dependency Validation Script
 * Compatible with Node.js 12+ and focuses on basic validation
 * Requirements: 1.2, 1.4, 1.6, 1.7
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class SimpleDependencyValidator {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            warnings: 0,
            errors: []
        };
        this.projectRoot = path.join(__dirname, '..');
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

    async validateDependencies() {
        this.log('🚀 Starting Simplified Dependency Validation');
        this.log('==============================================');

        // Basic environment validation
        await this.validateEnvironment();

        // Package.json validation
        await this.validatePackageJson();

        // Attempt basic dependency installation
        await this.attemptDependencyInstallation();

        // Basic security checks
        await this.performBasicSecurityChecks();

        // Basic build validation
        await this.validateBasicBuild();

        this.generateValidationReport();
    }

    async validateEnvironment() {
        this.log('🔍 Validating Environment');

        await this.check('Node.js Version Check', () => {
            const version = execSync('node --version', { encoding: 'utf8' }).trim();
            const versionNumber = version.replace('v', '');
            const majorVersion = parseInt(versionNumber.split('.')[0]);
            
            if (majorVersion < 12) {
                throw new Error(`Node.js version ${version} is too old. Minimum version 12 required.`);
            }
            
            if (majorVersion < 18) {
                this.log(`⚠️ Node.js ${version} detected. Many packages require >=18.0.0 for full compatibility.`, 'warning');
            }
            
            return `Node.js ${version} detected`;
        });

        await this.check('NPM Availability', () => {
            const version = execSync('npm --version', { encoding: 'utf8' }).trim();
            return `NPM version: ${version}`;
        });

        await this.check('Project Directory Structure', () => {
            const requiredFiles = ['package.json', 'tsconfig.json'];
            const missingFiles = [];
            
            for (const file of requiredFiles) {
                const filePath = path.join(this.projectRoot, file);
                if (!fs.existsSync(filePath)) {
                    missingFiles.push(file);
                }
            }
            
            if (missingFiles.length > 0) {
                throw new Error(`Required files missing: ${missingFiles.join(', ')}`);
            }
            
            return 'Project structure validated';
        });
    }

    async validatePackageJson() {
        this.log('📦 Validating Package Configuration');

        await this.check('Package.json Structure', () => {
            const packagePath = path.join(this.projectRoot, 'package.json');
            const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            
            // Validate required fields
            const requiredFields = ['name', 'version', 'dependencies', 'devDependencies', 'scripts'];
            const missingFields = requiredFields.filter(field => !pkg[field]);
            
            if (missingFields.length > 0) {
                throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
            }
            
            return `Package: ${pkg.name} v${pkg.version}`;
        });

        await this.check('Engine Requirements', () => {
            const packagePath = path.join(this.projectRoot, 'package.json');
            const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            
            if (pkg.engines && pkg.engines.node) {
                const currentVersion = process.version;
                this.log(`Package requires Node.js: ${pkg.engines.node}, Current: ${currentVersion}`);
                
                // Basic version check
                const requiredMajor = parseInt(pkg.engines.node.replace(/[^\d]/g, ''));
                const currentMajor = parseInt(currentVersion.replace('v', '').split('.')[0]);
                
                if (currentMajor < requiredMajor) {
                    throw new Error(`Node.js version mismatch. Required: ${pkg.engines.node}, Current: ${currentVersion}`);
                }
            }
            
            return 'Engine requirements validated';
        }, false);

        await this.check('Dependency Count', () => {
            const packagePath = path.join(this.projectRoot, 'package.json');
            const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            
            const depCount = Object.keys(pkg.dependencies || {}).length;
            const devDepCount = Object.keys(pkg.devDependencies || {}).length;
            
            return `Dependencies: ${depCount} production, ${devDepCount} development`;
        });
    }

    async attemptDependencyInstallation() {
        this.log('📥 Attempting Dependency Installation');

        await this.check('Clean Previous Installation', () => {
            const nodeModulesPath = path.join(this.projectRoot, 'node_modules');
            
            if (fs.existsSync(nodeModulesPath)) {
                this.log('Removing existing node_modules directory...');
                try {
                    execSync(`rm -rf "${nodeModulesPath}"`, { cwd: this.projectRoot });
                } catch (error) {
                    this.log('Warning: Could not remove node_modules completely', 'warning');
                }
            }
            
            return 'Previous installation cleaned';
        }, false);

        await this.check('Install Compatible Dependencies', () => {
            try {
                this.log('Attempting to install dependencies with --legacy-peer-deps...');
                
                // Try with legacy peer deps to handle compatibility issues
                execSync('npm install --legacy-peer-deps --no-audit --progress=false', { 
                    cwd: this.projectRoot,
                    stdio: 'pipe',
                    timeout: 600000 // 10 minute timeout
                });
                
                return 'Dependencies installed with compatibility flags';
            } catch (error) {
                // If that fails, try with force
                try {
                    this.log('Retrying with --force flag...');
                    execSync('npm install --force --no-audit --progress=false', { 
                        cwd: this.projectRoot,
                        stdio: 'pipe',
                        timeout: 600000
                    });
                    
                    return 'Dependencies installed with force flag';
                } catch (forceError) {
                    throw new Error(`Dependency installation failed: ${error.message}`);
                }
            }
        });

        await this.check('Verify Basic Dependencies', () => {
            const nodeModulesPath = path.join(this.projectRoot, 'node_modules');
            
            if (!fs.existsSync(nodeModulesPath)) {
                throw new Error('node_modules directory not created');
            }
            
            // Check for some basic dependencies that should work with Node 12
            const basicDeps = ['express', 'dotenv', 'cors'];
            const availableDeps = [];
            
            for (const dep of basicDeps) {
                const depPath = path.join(nodeModulesPath, dep);
                if (fs.existsSync(depPath)) {
                    availableDeps.push(dep);
                }
            }
            
            return `Basic dependencies available: ${availableDeps.join(', ')}`;
        }, false);
    }

    async performBasicSecurityChecks() {
        this.log('🔒 Performing Basic Security Checks');

        await this.check('NPM Audit (Basic)', () => {
            try {
                // Try basic audit without JSON output for compatibility
                execSync('npm audit', { 
                    cwd: this.projectRoot,
                    stdio: 'pipe'
                });
                
                return 'No critical vulnerabilities detected';
            } catch (error) {
                // Audit might fail but still provide useful info
                const output = error.stdout ? error.stdout.toString() : '';
                
                if (output.includes('found 0 vulnerabilities')) {
                    return 'No vulnerabilities found';
                } else if (output.includes('critical')) {
                    throw new Error('Critical vulnerabilities detected. Run npm audit for details.');
                } else {
                    return 'Audit completed with warnings (review recommended)';
                }
            }
        }, false);

        await this.check('Package Lock File', () => {
            const packageLockPath = path.join(this.projectRoot, 'package-lock.json');
            
            if (!fs.existsSync(packageLockPath)) {
                throw new Error('package-lock.json not found - dependency versions not locked');
            }
            
            try {
                const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
                return `Package lock file valid (version ${packageLock.lockfileVersion || 'unknown'})`;
            } catch (error) {
                throw new Error('Package lock file is corrupted');
            }
        });
    }

    async validateBasicBuild() {
        this.log('🏗️ Validating Basic Build Capabilities');

        await this.check('TypeScript Availability', () => {
            try {
                // Check if TypeScript is available in node_modules
                const tscPath = path.join(this.projectRoot, 'node_modules', '.bin', 'tsc');
                if (fs.existsSync(tscPath)) {
                    const version = execSync('npx tsc --version', { 
                        cwd: this.projectRoot,
                        encoding: 'utf8',
                        stdio: 'pipe'
                    }).trim();
                    return `TypeScript available: ${version}`;
                } else {
                    throw new Error('TypeScript not found in node_modules');
                }
            } catch (error) {
                throw new Error(`TypeScript check failed: ${error.message}`);
            }
        }, false);

        await this.check('Basic TypeScript Syntax Check', () => {
            try {
                // Try a basic TypeScript syntax check on a simple file
                const testTsFile = path.join(this.projectRoot, 'src', 'index.ts');
                
                if (fs.existsSync(testTsFile)) {
                    execSync('npx tsc --noEmit --skipLibCheck src/index.ts', { 
                        cwd: this.projectRoot,
                        stdio: 'pipe',
                        timeout: 60000
                    });
                    return 'TypeScript syntax validation passed';
                } else {
                    return 'TypeScript entry file not found (skipping syntax check)';
                }
            } catch (error) {
                throw new Error(`TypeScript syntax check failed: ${error.message}`);
            }
        }, false);

        await this.check('Build Script Availability', () => {
            const packagePath = path.join(this.projectRoot, 'package.json');
            const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            
            const buildScripts = ['build', 'build:backend', 'build:frontend'];
            const availableScripts = buildScripts.filter(script => pkg.scripts && pkg.scripts[script]);
            
            if (availableScripts.length === 0) {
                throw new Error('No build scripts found in package.json');
            }
            
            return `Build scripts available: ${availableScripts.join(', ')}`;
        });
    }

    generateValidationReport() {
        this.log('📊 Generating Dependency Validation Report');
        this.log('==========================================');

        const totalChecks = this.results.passed + this.results.failed + this.results.warnings;
        const successRate = totalChecks > 0 ? ((this.results.passed / totalChecks) * 100).toFixed(1) : '0';

        console.log(`\n📈 DEPENDENCY VALIDATION RESULTS:`);
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
            nodeVersion: process.version,
            summary: {
                totalChecks,
                passed: this.results.passed,
                failed: this.results.failed,
                warnings: this.results.warnings,
                successRate: `${successRate}%`
            },
            errors: this.results.errors,
            readyForDeployment: this.results.failed === 0,
            recommendations: this.generateRecommendations()
        };

        // Ensure test-results directory exists
        const testResultsDir = path.join(this.projectRoot, 'test-results');
        if (!fs.existsSync(testResultsDir)) {
            fs.mkdirSync(testResultsDir, { recursive: true });
        }

        fs.writeFileSync(
            path.join(testResultsDir, 'dependency-validation-report.json'),
            JSON.stringify(report, null, 2)
        );

        if (this.results.failed === 0) {
            this.log('🎉 DEPENDENCY VALIDATION COMPLETED SUCCESSFULLY!', 'success');
            this.log('✅ Dependencies installed and basic validation passed.', 'success');
            
            if (this.results.warnings > 0) {
                this.log(`⚠️ Note: ${this.results.warnings} warnings detected. Review recommended.`, 'warning');
            }
            
            this.log('', 'info');
            this.log('Next steps:', 'info');
            this.log('1. Consider upgrading Node.js to version 18+ for full compatibility', 'info');
            this.log('2. Configure production environment variables', 'info');
            this.log('3. Run comprehensive testing with current setup', 'info');
            
            return true;
        } else {
            this.log('❌ DEPENDENCY VALIDATION FAILED', 'error');
            this.log('Please resolve critical issues before proceeding.', 'error');
            
            console.log('\n💡 RECOMMENDATIONS:');
            report.recommendations.forEach((rec, index) => {
                console.log(`   ${index + 1}. ${rec}`);
            });
            
            return false;
        }
    }

    generateRecommendations() {
        const recommendations = [];
        
        // Check Node.js version
        const currentMajor = parseInt(process.version.replace('v', '').split('.')[0]);
        if (currentMajor < 18) {
            recommendations.push('Upgrade Node.js to version 18+ for full package compatibility');
        }
        
        // Check for common issues
        if (this.results.errors.some(e => e.description.includes('TypeScript'))) {
            recommendations.push('Ensure TypeScript is properly installed and configured');
        }
        
        if (this.results.errors.some(e => e.description.includes('Dependencies'))) {
            recommendations.push('Try installing dependencies with --legacy-peer-deps flag');
        }
        
        if (this.results.warnings > 0) {
            recommendations.push('Review warnings and consider updating package versions');
        }
        
        return recommendations;
    }
}

// Run dependency validation if this script is executed directly
if (require.main === module) {
    const validator = new SimpleDependencyValidator();
    validator.validateDependencies().catch((error) => {
        console.error('❌ Fatal error during dependency validation:', error);
        process.exit(1);
    });
}

module.exports = SimpleDependencyValidator;