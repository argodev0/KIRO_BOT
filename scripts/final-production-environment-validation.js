#!/usr/bin/env node

/**
 * Final Production Environment Validation Script
 * 
 * This script runs all production environment validations to ensure
 * the system is ready for deployment with proper configuration.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class FinalProductionEnvironmentValidator {
    constructor() {
        this.results = {
            comprehensiveValidation: null,
            databaseValidation: null,
            sslConfiguration: null,
            environmentValidation: null
        };
        this.overallStatus = false;
        this.errors = [];
        this.warnings = [];
    }

    /**
     * Main validation process
     */
    async validate() {
        console.log('🚀 Final Production Environment Validation');
        console.log('==========================================');
        console.log('This script validates all production environment configurations');
        console.log('to ensure the system is ready for secure deployment.\n');
        
        try {
            // Run comprehensive production validation
            await this.runComprehensiveValidation();
            
            // Run database configuration validation
            await this.runDatabaseValidation();
            
            // Validate SSL configuration
            await this.validateSSLConfiguration();
            
            // Run environment variable validation
            await this.runEnvironmentValidation();
            
            // Generate final report
            await this.generateFinalReport();
            
            // Determine overall status
            this.determineOverallStatus();
            
            // Display final results
            this.displayFinalResults();
            
            return this.overallStatus;
            
        } catch (error) {
            console.error('\n❌ Final validation process failed:', error.message);
            return false;
        }
    }

    /**
     * Run comprehensive production validation
     */
    async runComprehensiveValidation() {
        console.log('📊 Running comprehensive production validation...');
        
        try {
            const output = execSync('node scripts/comprehensive-production-validation.js', {
                cwd: process.cwd(),
                encoding: 'utf8',
                stdio: 'pipe'
            });
            
            this.results.comprehensiveValidation = {
                passed: true,
                output: output,
                safetyScore: this.extractSafetyScore(output)
            };
            
            console.log('✅ Comprehensive production validation passed');
            
        } catch (error) {
            this.results.comprehensiveValidation = {
                passed: false,
                output: error.stdout || error.message,
                error: error.message
            };
            
            console.log('❌ Comprehensive production validation failed');
            this.errors.push('Comprehensive production validation failed');
        }
    }

    /**
     * Run database configuration validation
     */
    async runDatabaseValidation() {
        console.log('🗄️  Running database configuration validation...');
        
        try {
            const output = execSync('node scripts/validate-database-configuration.js', {
                cwd: process.cwd(),
                encoding: 'utf8',
                stdio: 'pipe'
            });
            
            this.results.databaseValidation = {
                passed: true,
                output: output
            };
            
            console.log('✅ Database configuration validation passed');
            
        } catch (error) {
            this.results.databaseValidation = {
                passed: false,
                output: error.stdout || error.message,
                error: error.message
            };
            
            console.log('❌ Database configuration validation failed');
            this.errors.push('Database configuration validation failed');
        }
    }

    /**
     * Validate SSL configuration
     */
    async validateSSLConfiguration() {
        console.log('🔒 Validating SSL configuration...');
        
        const sslDir = path.join(process.cwd(), 'docker', 'ssl');
        const requiredFiles = ['cert.pem', 'private.key', 'ca.pem'];
        
        let sslPassed = true;
        const sslStatus = [];
        
        // Check if SSL directory exists
        if (!fs.existsSync(sslDir)) {
            sslPassed = false;
            sslStatus.push('SSL directory does not exist');
            this.errors.push('SSL directory missing');
        } else {
            // Check for required SSL files
            for (const file of requiredFiles) {
                const filePath = path.join(sslDir, file);
                if (fs.existsSync(filePath)) {
                    sslStatus.push(`✅ ${file} exists`);
                } else {
                    sslPassed = false;
                    sslStatus.push(`❌ ${file} missing`);
                    this.errors.push(`SSL file missing: ${file}`);
                }
            }
        }
        
        // Check environment variables
        const envFile = path.join(process.cwd(), '.env.production');
        if (fs.existsSync(envFile)) {
            const envContent = fs.readFileSync(envFile, 'utf8');
            
            if (envContent.includes('SSL_ENABLED=true')) {
                sslStatus.push('✅ SSL_ENABLED=true in environment');
            } else {
                sslPassed = false;
                sslStatus.push('❌ SSL_ENABLED not set to true');
                this.errors.push('SSL not enabled in environment');
            }
        }
        
        this.results.sslConfiguration = {
            passed: sslPassed,
            status: sslStatus
        };
        
        if (sslPassed) {
            console.log('✅ SSL configuration validation passed');
        } else {
            console.log('❌ SSL configuration validation failed');
        }
    }

    /**
     * Run environment variable validation
     */
    async runEnvironmentValidation() {
        console.log('🔍 Running environment variable validation...');
        
        const envFile = path.join(process.cwd(), '.env.production');
        
        if (!fs.existsSync(envFile)) {
            this.results.environmentValidation = {
                passed: false,
                error: 'Production environment file not found'
            };
            this.errors.push('Production environment file missing');
            console.log('❌ Environment variable validation failed');
            return;
        }
        
        const envContent = fs.readFileSync(envFile, 'utf8');
        const config = {};
        
        // Parse environment variables
        const lines = envContent.split('\n');
        for (const line of lines) {
            if (line.trim() && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                if (key && valueParts.length > 0) {
                    config[key.trim()] = valueParts.join('=').trim();
                }
            }
        }
        
        // Critical validations
        const criticalChecks = {
            'MONITORING_ENABLED': 'true',
            'PAPER_TRADING_MODE': 'true',
            'ALLOW_REAL_TRADES': 'false',
            'TRADING_SIMULATION_ONLY': 'true',
            'SSL_ENABLED': 'true',
            'DATABASE_SSL': 'true'
        };
        
        let envPassed = true;
        const envStatus = [];
        
        for (const [key, expectedValue] of Object.entries(criticalChecks)) {
            if (config[key] === expectedValue) {
                envStatus.push(`✅ ${key}=${expectedValue}`);
            } else {
                envPassed = false;
                envStatus.push(`❌ ${key} should be ${expectedValue}, got ${config[key] || 'undefined'}`);
                this.errors.push(`Environment variable ${key} not properly configured`);
            }
        }
        
        this.results.environmentValidation = {
            passed: envPassed,
            status: envStatus,
            configCount: Object.keys(config).length
        };
        
        if (envPassed) {
            console.log('✅ Environment variable validation passed');
        } else {
            console.log('❌ Environment variable validation failed');
        }
    }

    /**
     * Extract safety score from output
     */
    extractSafetyScore(output) {
        const match = output.match(/Safety Score: (\d+)%/);
        return match ? parseInt(match[1]) : 0;
    }

    /**
     * Determine overall status
     */
    determineOverallStatus() {
        const allValidationsPassed = Object.values(this.results).every(result => 
            result && result.passed === true
        );
        
        const safetyScore = this.results.comprehensiveValidation?.safetyScore || 0;
        const hasNoCriticalErrors = this.errors.length === 0;
        
        this.overallStatus = allValidationsPassed && safetyScore >= 90 && hasNoCriticalErrors;
    }

    /**
     * Display final results
     */
    displayFinalResults() {
        console.log('\n📋 Final Production Environment Validation Results');
        console.log('=================================================');
        
        // Overall status
        const statusIcon = this.overallStatus ? '✅' : '❌';
        const statusText = this.overallStatus ? 'READY FOR PRODUCTION' : 'NOT READY FOR PRODUCTION';
        console.log(`\n${statusIcon} Overall Status: ${statusText}`);
        
        // Safety score
        const safetyScore = this.results.comprehensiveValidation?.safetyScore || 0;
        console.log(`📊 Safety Score: ${safetyScore}%`);
        
        // Individual validation results
        console.log('\n📝 Individual Validation Results:');
        
        for (const [validation, result] of Object.entries(this.results)) {
            const icon = result?.passed ? '✅' : '❌';
            const name = validation.replace(/([A-Z])/g, ' $1').toLowerCase();
            console.log(`  ${icon} ${name}`);
        }
        
        // Errors
        if (this.errors.length > 0) {
            console.log('\n❌ Critical Issues (must be fixed):');
            this.errors.forEach((error, index) => {
                console.log(`  ${index + 1}. ${error}`);
            });
        }
        
        // Warnings
        if (this.warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            this.warnings.forEach((warning, index) => {
                console.log(`  ${index + 1}. ${warning}`);
            });
        }
        
        // Production readiness summary
        console.log('\n🔒 Production Readiness Summary:');
        console.log(`  Paper Trading Safety: ${this.results.comprehensiveValidation?.passed ? '✅ ENFORCED' : '❌ FAILED'}`);
        console.log(`  Database Configuration: ${this.results.databaseValidation?.passed ? '✅ VALID' : '❌ INVALID'}`);
        console.log(`  SSL Configuration: ${this.results.sslConfiguration?.passed ? '✅ CONFIGURED' : '❌ MISSING'}`);
        console.log(`  Environment Variables: ${this.results.environmentValidation?.passed ? '✅ VALID' : '❌ INVALID'}`);
        console.log(`  Monitoring Enabled: ${this.results.environmentValidation?.status?.some(s => s.includes('MONITORING_ENABLED=true')) ? '✅ YES' : '❌ NO'}`);
        
        // Next steps
        if (this.overallStatus) {
            console.log('\n🚀 Next Steps:');
            console.log('  1. The production environment is properly configured');
            console.log('  2. All safety mechanisms are in place');
            console.log('  3. The system is ready for deployment');
            console.log('  4. Run: docker-compose -f docker-compose.prod.yml up -d');
        } else {
            console.log('\n🔧 Required Actions:');
            console.log('  1. Fix all critical issues listed above');
            console.log('  2. Re-run this validation script');
            console.log('  3. Ensure safety score is above 90%');
            console.log('  4. Verify all validations pass before deployment');
        }
    }

    /**
     * Generate final report
     */
    async generateFinalReport() {
        const reportData = {
            timestamp: new Date().toISOString(),
            overallStatus: this.overallStatus,
            safetyScore: this.results.comprehensiveValidation?.safetyScore || 0,
            validationResults: this.results,
            errors: this.errors,
            warnings: this.warnings,
            productionReadiness: {
                paperTradingSafety: this.results.comprehensiveValidation?.passed || false,
                databaseConfiguration: this.results.databaseValidation?.passed || false,
                sslConfiguration: this.results.sslConfiguration?.passed || false,
                environmentVariables: this.results.environmentValidation?.passed || false,
                monitoringEnabled: this.results.environmentValidation?.status?.some(s => s.includes('MONITORING_ENABLED=true')) || false
            }
        };
        
        const reportPath = path.join(process.cwd(), 'final-production-environment-validation-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
        
        console.log(`\n📄 Final validation report saved to: ${reportPath}`);
    }
}

// Main execution
if (require.main === module) {
    const validator = new FinalProductionEnvironmentValidator();
    validator.validate().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Final validation failed:', error);
        process.exit(1);
    });
}

module.exports = FinalProductionEnvironmentValidator;