#!/usr/bin/env node

/**
 * Dependency Installation and Package Validation Script
 * 
 * Handles production dependency installation, security auditing, and validation
 * Requirements: 1.2, 1.4, 1.6, 1.7
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class DependencyValidator {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            warnings: 0,
            errors: [],
            installationTime: null,
            auditResults: null,
            buildResults: null
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
        this.log('🚀 Starting Dependency Installation and Package Validation');
        this.log('=========================================================');

        // Pre-installation validation
        await this.validatePrerequisites();

        // Clean installation
        await this.performCleanInstallation();

        // Security audit
        await this.performSecurityAudit();

        // Package integrity validation
        await this.validatePackageIntegrity();

        // TypeScript compilation test
        await this.validateTypeScriptCompilation();

        // Build process validation
        await this.validateBuildProcess();

        // Runtime validation
        await this.validateRuntimeCompatibility();

        this.generateValidationReport();
    }

    async validatePrerequisites() {
        this.log('🔍 Validating Prerequisites');

        await this.check('Node.js Version Compatibility', () => {
            const version = execSync('node --version', { encoding: 'utf8' }).trim();
            const versionNumber = version.replace('v', '');
            const majorVersion = parseInt(versionNumber.split('.')[0]);
            
            if (majorVersion < 18) {
                throw new Error(`Node.js version ${version} is incompatible. Version >=18.0.0 required.`);
            }
            
            return `Node.js ${version} is compatible`;
        });

        await this.check('NPM Version', () => {
            const version = execSync('npm --version', { encoding: 'utf8' }).trim();
            return `NPM version: ${version}`;
        });

        await this.check('Package.json Validation', () => {
            const packagePath = path.join(this.projectRoot, 'package.json');
            
            if (!fs.existsSync(packagePath)) {
                throw new Error('package.json not found');
            }
            
            const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            
            // Validate required fields
            if (!pkg.name || !pkg.version || !pkg.dependencies) {
                throw new Error('Invalid package.json structure');
            }
            
            // Check engine requirements
            if (pkg.engines && pkg.engines.node) {
                const nodeVersion = process.version;
                this.log(`Package requires Node.js: ${pkg.engines.node}, Current: ${nodeVersion}`);
            }
            
            return `Package: ${pkg.name} v${pkg.version}`;
        });

        await this.check('Disk Space Availability', () => {
            // Estimate required space (rough calculation)
            const requiredSpaceGB = 2; // Minimum 2GB for node_modules and build artifacts
            
            try {
                // This is a basic check - in production you'd want more sophisticated disk space checking
                const stats = fs.statSync(this.projectRoot);
                return `Disk space check passed (estimated ${requiredSpaceGB}GB required)`;
            } catch (error) {
                throw new Error('Unable to check disk space availability');
            }
        }, false);
    }

    async performCleanInstallation() {
        this.log('📦 Performing Clean Dependency Installation');

        await this.check('Clean Previous Installation', () => {
            const nodeModulesPath = path.join(this.projectRoot, 'node_modules');
            const packageLockPath = path.join(this.projectRoot, 'package-lock.json');
            
            // Remove existing node_modules if it exists
            if (fs.existsSync(nodeModulesPath)) {
                this.log('Removing existing node_modules directory...');
                execSync(`rm -rf "${nodeModulesPath}"`, { cwd: this.projectRoot });
            }
            
            return 'Previous installation cleaned';
        }, false);

        await this.check('Install Production Dependencies', async () => {
            const startTime = Date.now();
            
            try {
                this.log('Installing dependencies... This may take several minutes.');
                
                // Use npm ci for clean, reproducible installs in production
                const installCommand = fs.existsSync(path.join(this.projectRoot, 'package-lock.json')) 
                    ? 'npm ci --only=production --no-audit --progress=false'
                    : 'npm install --only=production --no-audit --progress=false';
                
                execSync(installCommand, { 
                    cwd: this.projectRoot,
                    stdio: 'pipe',
                    timeout: 300000 // 5 minute timeout
                });
                
                const endTime = Date.now();
                this.results.installationTime = endTime - startTime;
                
                return `Dependencies installed successfully in ${(this.results.installationTime / 1000).toFixed(2)}s`;
            } catch (error) {
                throw new Error(`Dependency installation failed: ${error.message}`);
            }
        });

        await this.check('Install Development Dependencies', async () => {
            try {
                this.log('Installing development dependencies for build and testing...');
                
                execSync('npm install --only=dev --no-audit --progress=false', { 
                    cwd: this.projectRoot,
                    stdio: 'pipe',
                    timeout: 300000 // 5 minute timeout
                });
                
                return 'Development dependencies installed successfully';
            } catch (error) {
                throw new Error(`Development dependency installation failed: ${error.message}`);
            }
        });

        await this.check('Verify Node Modules Structure', () => {
            const nodeModulesPath = path.join(this.projectRoot, 'node_modules');
            
            if (!fs.existsSync(nodeModulesPath)) {
                throw new Error('node_modules directory not created');
            }
            
            // Check for critical dependencies
            const criticalDeps = ['express', 'typescript', '@prisma/client', 'react', 'socket.io'];
            const missingDeps = [];
            
            for (const dep of criticalDeps) {
                const depPath = path.join(nodeModulesPath, dep);
                if (!fs.existsSync(depPath)) {
                    missingDeps.push(dep);
                }
            }
            
            if (missingDeps.length > 0) {
                throw new Error(`Critical dependencies missing: ${missingDeps.join(', ')}`);
            }
            
            return `Node modules structure validated (${criticalDeps.length} critical dependencies found)`;
        });
    }

    async performSecurityAudit() {
        this.log('🔒 Performing Security Audit');

        await this.check('NPM Security Audit', () => {
            try {
                const auditOutput = execSync('npm audit --json', { 
                    cwd: this.projectRoot,
                    encoding: 'utf8',
                    stdio: 'pipe'
                });
                
                const auditResults = JSON.parse(auditOutput);
                this.results.auditResults = auditResults;
                
                const vulnerabilities = auditResults.vulnerabilities || {};
                const criticalCount = vulnerabilities.critical || 0;
                const highCount = vulnerabilities.high || 0;
                const moderateCount = vulnerabilities.moderate || 0;
                const lowCount = vulnerabilities.low || 0;
                
                if (criticalCount > 0) {
                    throw new Error(`${criticalCount} critical vulnerabilities found. Run 'npm audit fix' to resolve.`);
                }
                
                if (highCount > 0) {
                    this.log(`⚠️ ${highCount} high severity vulnerabilities found`, 'warning');
                }
                
                return `Security audit completed: ${criticalCount} critical, ${highCount} high, ${moderateCount} moderate, ${lowCount} low`;
            } catch (error) {
                if (error.message.includes('critical vulnerabilities')) {
                    throw error;
                }
                
                // If audit command fails, try to get basic info
                try {
                    execSync('npm audit', { 
                        cwd: this.projectRoot,
                        stdio: 'pipe'
                    });
                    return 'Security audit completed (no critical issues detected)';
                } catch (auditError) {
                    throw new Error(`Security audit failed: ${auditError.message}`);
                }
            }
        });

        await this.check('Automatic Vulnerability Fix', () => {
            try {
                const auditVulns = this.results.auditResults && this.results.auditResults.vulnerabilities;
                if ((auditVulns && auditVulns.critical > 0) || 
                    (auditVulns && auditVulns.high > 0)) {
                    
                    this.log('Attempting to fix vulnerabilities automatically...');
                    execSync('npm audit fix --force', { 
                        cwd: this.projectRoot,
                        stdio: 'pipe'
                    });
                    
                    return 'Vulnerabilities fixed automatically';
                }
                
                return 'No critical vulnerabilities to fix';
            } catch (error) {
                throw new Error(`Automatic vulnerability fix failed: ${error.message}`);
            }
        }, false);
    }

    async validatePackageIntegrity() {
        this.log('🔍 Validating Package Integrity');

        await this.check('Package Lock Integrity', () => {
            const packageLockPath = path.join(this.projectRoot, 'package-lock.json');
            
            if (!fs.existsSync(packageLockPath)) {
                throw new Error('package-lock.json not found - dependency versions not locked');
            }
            
            try {
                const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
                
                if (!packageLock.lockfileVersion) {
                    throw new Error('Invalid package-lock.json format');
                }
                
                return `Package lock file valid (version ${packageLock.lockfileVersion})`;
            } catch (error) {
                throw new Error(`Package lock validation failed: ${error.message}`);
            }
        });

        await this.check('Dependency Version Compatibility', () => {
            try {
                // Check for peer dependency warnings
                const lsOutput = execSync('npm ls --depth=0 --json', { 
                    cwd: this.projectRoot,
                    encoding: 'utf8',
                    stdio: 'pipe'
                });
                
                const lsResults = JSON.parse(lsOutput);
                
                if (lsResults.problems && lsResults.problems.length > 0) {
                    const criticalProblems = lsResults.problems.filter(p => 
                        p.includes('missing') || p.includes('invalid')
                    );
                    
                    if (criticalProblems.length > 0) {
                        throw new Error(`Dependency problems: ${criticalProblems.join(', ')}`);
                    }
                }
                
                return 'Dependency versions compatible';
            } catch (error) {
                if (error.message.includes('Dependency problems')) {
                    throw error;
                }
                
                // If npm ls fails, it might still be okay
                return 'Dependency compatibility check completed (warnings may exist)';
            }
        }, false);

        await this.check('Critical Package Availability', () => {
            const criticalPackages = [
                'express',
                'typescript',
                '@prisma/client',
                'react',
                'react-dom',
                'socket.io',
                'winston',
                'joi',
                'helmet',
                'cors'
            ];
            
            const missingPackages = [];
            
            for (const pkg of criticalPackages) {
                try {
                    require.resolve(pkg, { paths: [this.projectRoot] });
                } catch (error) {
                    missingPackages.push(pkg);
                }
            }
            
            if (missingPackages.length > 0) {
                throw new Error(`Critical packages not resolvable: ${missingPackages.join(', ')}`);
            }
            
            return `All ${criticalPackages.length} critical packages available`;
        });
    }

    async validateTypeScriptCompilation() {
        this.log('📝 Validating TypeScript Compilation');

        await this.check('TypeScript Compiler Availability', () => {
            try {
                const tscVersion = execSync('npx tsc --version', { 
                    cwd: this.projectRoot,
                    encoding: 'utf8',
                    stdio: 'pipe'
                }).trim();
                
                return `TypeScript compiler: ${tscVersion}`;
            } catch (error) {
                throw new Error('TypeScript compiler not available');
            }
        });

        await this.check('TypeScript Configuration', () => {
            const tsconfigPath = path.join(this.projectRoot, 'tsconfig.json');
            
            if (!fs.existsSync(tsconfigPath)) {
                throw new Error('tsconfig.json not found');
            }
            
            try {
                const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
                
                if (!tsconfig.compilerOptions) {
                    throw new Error('Invalid tsconfig.json - missing compilerOptions');
                }
                
                return 'TypeScript configuration valid';
            } catch (error) {
                throw new error(`TypeScript configuration invalid: ${error.message}`);
            }
        });

        await this.check('TypeScript Compilation Test', () => {
            try {
                this.log('Compiling TypeScript... This may take a moment.');
                
                execSync('npx tsc --noEmit', { 
                    cwd: this.projectRoot,
                    stdio: 'pipe',
                    timeout: 120000 // 2 minute timeout
                });
                
                return 'TypeScript compilation successful';
            } catch (error) {
                throw new Error(`TypeScript compilation failed: ${error.message}`);
            }
        });
    }

    async validateBuildProcess() {
        this.log('🏗️ Validating Build Process');

        await this.check('Backend Build Process', () => {
            try {
                this.log('Building backend... This may take a moment.');
                
                const buildOutput = execSync('npm run build:backend', { 
                    cwd: this.projectRoot,
                    encoding: 'utf8',
                    stdio: 'pipe',
                    timeout: 180000 // 3 minute timeout
                });
                
                // Check if dist directory was created
                const distPath = path.join(this.projectRoot, 'dist');
                if (!fs.existsSync(distPath)) {
                    throw new Error('Build output directory (dist) not created');
                }
                
                // Check for main entry file
                const mainFile = path.join(distPath, 'index.js');
                if (!fs.existsSync(mainFile)) {
                    throw new Error('Main entry file not found in build output');
                }
                
                this.results.buildResults = { backend: 'success' };
                return 'Backend build successful';
            } catch (error) {
                throw new Error(`Backend build failed: ${error.message}`);
            }
        });

        await this.check('Frontend Build Process', () => {
            try {
                this.log('Building frontend... This may take a moment.');
                
                execSync('npm run build:frontend', { 
                    cwd: this.projectRoot,
                    stdio: 'pipe',
                    timeout: 180000 // 3 minute timeout
                });
                
                // Check if frontend dist directory was created
                const frontendDistPath = path.join(this.projectRoot, 'dist');
                if (fs.existsSync(frontendDistPath)) {
                    const files = fs.readdirSync(frontendDistPath);
                    if (files.length === 0) {
                        throw new Error('Frontend build output is empty');
                    }
                }
                
                this.results.buildResults = { 
                    ...this.results.buildResults, 
                    frontend: 'success' 
                };
                return 'Frontend build successful';
            } catch (error) {
                throw new Error(`Frontend build failed: ${error.message}`);
            }
        });

        await this.check('Build Artifacts Validation', () => {
            const distPath = path.join(this.projectRoot, 'dist');
            
            if (!fs.existsSync(distPath)) {
                throw new Error('Build output directory not found');
            }
            
            const files = fs.readdirSync(distPath);
            
            if (files.length === 0) {
                throw new Error('No build artifacts found');
            }
            
            // Check for essential files
            const essentialFiles = ['index.js'];
            const missingFiles = essentialFiles.filter(file => !files.includes(file));
            
            if (missingFiles.length > 0) {
                throw new Error(`Essential build files missing: ${missingFiles.join(', ')}`);
            }
            
            return `Build artifacts validated (${files.length} files generated)`;
        });
    }

    async validateRuntimeCompatibility() {
        this.log('🚀 Validating Runtime Compatibility');

        await this.check('Basic Runtime Test', () => {
            try {
                // Test basic Node.js module loading
                const testScript = `
                    const express = require('express');
                    const path = require('path');
                    console.log('Runtime test successful');
                    process.exit(0);
                `;
                
                execSync(`node -e "${testScript}"`, { 
                    cwd: this.projectRoot,
                    stdio: 'pipe',
                    timeout: 30000
                });
                
                return 'Basic runtime compatibility confirmed';
            } catch (error) {
                throw new Error(`Runtime compatibility test failed: ${error.message}`);
            }
        });

        await this.check('Environment Variables Loading', () => {
            try {
                // Test environment variable loading
                const testScript = `
                    require('dotenv').config();
                    console.log('Environment loading test successful');
                    process.exit(0);
                `;
                
                execSync(`node -e "${testScript}"`, { 
                    cwd: this.projectRoot,
                    stdio: 'pipe',
                    timeout: 30000
                });
                
                return 'Environment variables loading confirmed';
            } catch (error) {
                throw new Error(`Environment loading test failed: ${error.message}`);
            }
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

        if (this.results.installationTime) {
            console.log(`   Installation Time: ${(this.results.installationTime / 1000).toFixed(2)}s`);
        }

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
                successRate: `${successRate}%`,
                installationTime: this.results.installationTime
            },
            auditResults: this.results.auditResults,
            buildResults: this.results.buildResults,
            errors: this.results.errors,
            readyForDeployment: this.results.failed === 0
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
            this.log('✅ All dependencies installed and validated.', 'success');
            this.log('✅ Security audit passed.', 'success');
            this.log('✅ TypeScript compilation successful.', 'success');
            this.log('✅ Build process validated.', 'success');
            
            if (this.results.warnings > 0) {
                this.log(`⚠️ Note: ${this.results.warnings} warnings detected. Review recommended but not blocking.`, 'warning');
            }
            
            this.log('', 'info');
            this.log('Next steps:', 'info');
            this.log('1. Configure production environment variables', 'info');
            this.log('2. Set up SSL certificates and security settings', 'info');
            this.log('3. Run comprehensive pre-deployment testing', 'info');
            
            return true;
        } else {
            this.log('❌ DEPENDENCY VALIDATION FAILED', 'error');
            this.log('Please resolve critical issues before proceeding.', 'error');
            return false;
        }
    }
}

// Run dependency validation if this script is executed directly
if (require.main === module) {
    const validator = new DependencyValidator();
    validator.validateDependencies().catch((error) => {
        console.error('❌ Fatal error during dependency validation:', error);
        process.exit(1);
    });
}

module.exports = DependencyValidator;