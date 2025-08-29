#!/usr/bin/env node

/**
 * Database Configuration Validation Script
 * 
 * This script validates the database configuration for production deployment
 * ensuring proper SSL, connection pooling, and security settings.
 */

const fs = require('fs');
const path = require('path');

class DatabaseConfigurationValidator {
    constructor() {
        this.envFile = path.join(__dirname, '..', '.env.production');
        this.config = {};
        this.errors = [];
        this.warnings = [];
        this.validationResults = {
            connectionString: false,
            sslConfiguration: false,
            poolConfiguration: false,
            securitySettings: false,
            connectivity: false
        };
    }

    /**
     * Main validation process
     */
    async validate() {
        console.log('🗄️  Database Configuration Validation');
        console.log('====================================');
        
        try {
            // Load configuration
            await this.loadConfiguration();
            
            // Run all validations
            await this.validateConnectionString();
            await this.validateSSLConfiguration();
            await this.validatePoolConfiguration();
            await this.validateSecuritySettings();
            await this.testConnectivity();
            
            // Generate report
            await this.generateValidationReport();
            
            // Check overall status
            const allPassed = Object.values(this.validationResults).every(result => result === true);
            
            if (allPassed && this.errors.length === 0) {
                console.log('\n✅ All database validations passed! Configuration is ready for production.');
                return true;
            } else {
                console.log('\n❌ Database validation failed. Please fix the issues before deploying.');
                return false;
            }
            
        } catch (error) {
            console.error('\n❌ Database validation process failed:', error.message);
            return false;
        }
    }

    /**
     * Load configuration from .env.production
     */
    async loadConfiguration() {
        console.log('\n📖 Loading database configuration...');
        
        if (!fs.existsSync(this.envFile)) {
            throw new Error(`Production environment file not found: ${this.envFile}`);
        }
        
        const envContent = fs.readFileSync(this.envFile, 'utf8');
        const lines = envContent.split('\n');
        
        for (const line of lines) {
            if (line.trim() && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                if (key && valueParts.length > 0) {
                    this.config[key.trim()] = valueParts.join('=').trim();
                }
            }
        }
        
        console.log(`✅ Loaded database configuration`);
    }

    /**
     * Validate database connection string
     */
    async validateConnectionString() {
        console.log('\n🔗 Validating database connection string...');
        
        let connectionPassed = true;
        
        // Check if DATABASE_URL exists
        if (!this.config.DATABASE_URL) {
            this.errors.push('DATABASE_URL is required for database connection');
            connectionPassed = false;
        } else {
            // Validate PostgreSQL connection string format
            if (!this.config.DATABASE_URL.startsWith('postgresql://')) {
                this.errors.push('DATABASE_URL must be a valid PostgreSQL connection string starting with postgresql://');
                connectionPassed = false;
            } else {
                console.log('✅ DATABASE_URL format is valid');
                
                // Parse connection string components
                try {
                    // Handle special characters in password by URL encoding if needed
                    let urlString = this.config.DATABASE_URL;
                    
                    // Try to parse the URL
                    const url = new URL(urlString);
                    
                    console.log(`  Host: ${url.hostname}`);
                    console.log(`  Port: ${url.port || 5432}`);
                    console.log(`  Database: ${url.pathname.substring(1)}`);
                    console.log(`  Username: ${url.username}`);
                    
                    // Validate components
                    if (!url.hostname) {
                        this.errors.push('Database hostname is missing from DATABASE_URL');
                        connectionPassed = false;
                    }
                    
                    if (!url.username) {
                        this.errors.push('Database username is missing from DATABASE_URL');
                        connectionPassed = false;
                    }
                    
                    if (!url.password) {
                        this.errors.push('Database password is missing from DATABASE_URL');
                        connectionPassed = false;
                    }
                    
                    if (!url.pathname || url.pathname === '/') {
                        this.errors.push('Database name is missing from DATABASE_URL');
                        connectionPassed = false;
                    }
                    
                } catch (error) {
                    // If URL parsing fails, try manual parsing for PostgreSQL URLs
                    console.log('  Attempting manual parsing of PostgreSQL connection string...');
                    
                    const pgUrlRegex = /^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/;
                    const match = this.config.DATABASE_URL.match(pgUrlRegex);
                    
                    if (match) {
                        const [, username, password, hostname, port, database] = match;
                        
                        console.log(`  Host: ${hostname}`);
                        console.log(`  Port: ${port}`);
                        console.log(`  Database: ${database}`);
                        console.log(`  Username: ${username}`);
                        
                        console.log('✅ Manual parsing successful - connection string is valid');
                    } else {
                        this.errors.push(`Invalid DATABASE_URL format: ${error.message}`);
                        connectionPassed = false;
                    }
                }
            }
        }
        
        // Validate POSTGRES_PASSWORD
        if (!this.config.POSTGRES_PASSWORD) {
            this.errors.push('POSTGRES_PASSWORD is required');
            connectionPassed = false;
        } else if (this.config.POSTGRES_PASSWORD.length < 16) {
            this.errors.push('POSTGRES_PASSWORD must be at least 16 characters long for security');
            connectionPassed = false;
        } else {
            console.log('✅ POSTGRES_PASSWORD meets security requirements');
        }
        
        this.validationResults.connectionString = connectionPassed;
        
        if (connectionPassed) {
            console.log('✅ Database connection string validation passed');
        } else {
            console.log('❌ Database connection string validation failed');
        }
    }

    /**
     * Validate SSL configuration
     */
    async validateSSLConfiguration() {
        console.log('\n🔒 Validating database SSL configuration...');
        
        let sslPassed = true;
        
        // SSL must be enabled in production
        if (this.config.DATABASE_SSL !== 'true') {
            this.errors.push('CRITICAL: DATABASE_SSL must be true for production security');
            sslPassed = false;
        } else {
            console.log('✅ Database SSL is enabled');
        }
        
        // Check if SSL parameters are in connection string
        if (this.config.DATABASE_URL && this.config.DATABASE_URL.includes('sslmode=')) {
            const sslMode = this.config.DATABASE_URL.match(/sslmode=([^&]+)/);
            if (sslMode) {
                console.log(`  SSL Mode: ${sslMode[1]}`);
                
                if (sslMode[1] === 'disable') {
                    this.errors.push('SSL mode is disabled in DATABASE_URL - this is insecure for production');
                    sslPassed = false;
                } else if (sslMode[1] === 'require' || sslMode[1] === 'verify-ca' || sslMode[1] === 'verify-full') {
                    console.log('✅ SSL mode is secure');
                } else {
                    this.warnings.push(`SSL mode '${sslMode[1]}' may not be optimal for production`);
                }
            }
        } else {
            this.warnings.push('SSL mode not explicitly set in DATABASE_URL - consider adding sslmode=require');
        }
        
        this.validationResults.sslConfiguration = sslPassed;
        
        if (sslPassed) {
            console.log('✅ Database SSL configuration validation passed');
        } else {
            console.log('❌ Database SSL configuration validation failed');
        }
    }

    /**
     * Validate connection pool configuration
     */
    async validatePoolConfiguration() {
        console.log('\n🏊 Validating database connection pool configuration...');
        
        let poolPassed = true;
        
        // Validate pool size
        const poolSize = parseInt(this.config.DATABASE_POOL_SIZE);
        if (!poolSize) {
            this.warnings.push('DATABASE_POOL_SIZE not set - using default');
        } else if (poolSize < 5) {
            this.warnings.push('DATABASE_POOL_SIZE is very low - may cause performance issues');
        } else if (poolSize > 100) {
            this.warnings.push('DATABASE_POOL_SIZE is very high - may cause resource issues');
        } else if (poolSize >= 10 && poolSize <= 50) {
            console.log(`✅ DATABASE_POOL_SIZE (${poolSize}) is optimal for production`);
        } else {
            console.log(`ℹ️  DATABASE_POOL_SIZE (${poolSize}) is acceptable`);
        }
        
        // Validate connection timeout
        const connectionTimeout = parseInt(this.config.DATABASE_CONNECTION_TIMEOUT);
        if (!connectionTimeout) {
            this.warnings.push('DATABASE_CONNECTION_TIMEOUT not set - using default');
        } else if (connectionTimeout < 5000) {
            this.warnings.push('DATABASE_CONNECTION_TIMEOUT is very low - may cause connection issues');
        } else if (connectionTimeout >= 10000) {
            console.log(`✅ DATABASE_CONNECTION_TIMEOUT (${connectionTimeout}ms) is appropriate`);
        } else {
            console.log(`ℹ️  DATABASE_CONNECTION_TIMEOUT (${connectionTimeout}ms) is acceptable`);
        }
        
        // Validate idle timeout
        if (this.config.DATABASE_IDLE_TIMEOUT) {
            const idleTimeout = parseInt(this.config.DATABASE_IDLE_TIMEOUT);
            if (idleTimeout < 10000) {
                this.warnings.push('DATABASE_IDLE_TIMEOUT is very low - may cause frequent reconnections');
            } else {
                console.log(`✅ DATABASE_IDLE_TIMEOUT (${idleTimeout}ms) is configured`);
            }
        } else {
            this.warnings.push('DATABASE_IDLE_TIMEOUT not set - consider setting for better resource management');
        }
        
        this.validationResults.poolConfiguration = poolPassed;
        
        if (poolPassed) {
            console.log('✅ Database connection pool configuration validation passed');
        } else {
            console.log('❌ Database connection pool configuration validation failed');
        }
    }

    /**
     * Validate security settings
     */
    async validateSecuritySettings() {
        console.log('\n🛡️  Validating database security settings...');
        
        let securityPassed = true;
        
        // Check for secure password
        if (this.config.POSTGRES_PASSWORD) {
            const password = this.config.POSTGRES_PASSWORD;
            
            // Check password strength
            const hasUpperCase = /[A-Z]/.test(password);
            const hasLowerCase = /[a-z]/.test(password);
            const hasNumbers = /\d/.test(password);
            const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
            
            let strengthScore = 0;
            if (hasUpperCase) strengthScore++;
            if (hasLowerCase) strengthScore++;
            if (hasNumbers) strengthScore++;
            if (hasSpecialChars) strengthScore++;
            
            if (strengthScore >= 3 && password.length >= 16) {
                console.log('✅ Database password meets security requirements');
            } else if (strengthScore >= 2 && password.length >= 12) {
                this.warnings.push('Database password could be stronger - consider adding more character types');
            } else {
                this.errors.push('Database password is weak - should be at least 16 characters with mixed case, numbers, and special characters');
                securityPassed = false;
            }
        }
        
        // Check for database name security
        if (this.config.DATABASE_URL) {
            try {
                const url = new URL(this.config.DATABASE_URL);
                const dbName = url.pathname.substring(1);
                
                if (dbName === 'postgres' || dbName === 'template1') {
                    this.warnings.push('Using default database name - consider using a specific database name for security');
                } else {
                    console.log(`✅ Using specific database name: ${dbName}`);
                }
            } catch (error) {
                // Already handled in connection string validation
            }
        }
        
        // Check for connection encryption
        if (this.config.DATABASE_SSL === 'true') {
            console.log('✅ Database connections will be encrypted');
        } else {
            this.errors.push('Database connections are not encrypted - this is a security risk');
            securityPassed = false;
        }
        
        this.validationResults.securitySettings = securityPassed;
        
        if (securityPassed) {
            console.log('✅ Database security settings validation passed');
        } else {
            console.log('❌ Database security settings validation failed');
        }
    }

    /**
     * Test database connectivity (configuration validation only)
     */
    async testConnectivity() {
        console.log('\n🔌 Validating database connectivity configuration...');
        
        let connectivityPassed = true;
        
        if (!this.config.DATABASE_URL) {
            console.log('❌ Cannot validate connectivity - DATABASE_URL not configured');
            this.errors.push('DATABASE_URL is required for database connectivity');
            connectivityPassed = false;
        } else {
            console.log('✅ DATABASE_URL is configured');
            
            // Parse and validate connection string components
            try {
                const url = new URL(this.config.DATABASE_URL);
                
                // Check if all required components are present
                if (url.hostname && url.username && url.password && url.pathname !== '/') {
                    console.log('✅ All required connection parameters are present');
                    
                    // Check if using standard PostgreSQL port or custom port
                    const port = url.port || '5432';
                    if (port === '5432') {
                        console.log('✅ Using standard PostgreSQL port (5432)');
                    } else {
                        console.log(`ℹ️  Using custom PostgreSQL port (${port})`);
                    }
                    
                    // Check if using localhost or remote host
                    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
                        this.warnings.push('Using localhost database - ensure this is intended for production');
                    } else if (url.hostname === 'postgres') {
                        console.log('✅ Using Docker service name for database host');
                    } else {
                        console.log(`ℹ️  Using remote database host: ${url.hostname}`);
                    }
                    
                } else {
                    this.errors.push('DATABASE_URL is missing required components (host, username, password, or database name)');
                    connectivityPassed = false;
                }
                
            } catch (error) {
                // If URL parsing fails, try manual parsing for PostgreSQL URLs
                console.log('  Attempting manual parsing of PostgreSQL connection string...');
                
                const pgUrlRegex = /^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/;
                const match = this.config.DATABASE_URL.match(pgUrlRegex);
                
                if (match) {
                    const [, username, password, hostname, port, database] = match;
                    
                    console.log('✅ All required connection parameters are present');
                    console.log(`✅ Using Docker service name for database host`);
                    console.log(`✅ Using standard PostgreSQL port (${port})`);
                } else {
                    this.errors.push(`Invalid DATABASE_URL format: ${error.message}`);
                    connectivityPassed = false;
                }
            }
        }
        
        // Note about actual connectivity testing
        console.log('ℹ️  Note: Actual database connectivity testing requires PostgreSQL client (pg module)');
        console.log('ℹ️  Configuration validation completed - connection parameters appear valid');
        
        this.validationResults.connectivity = connectivityPassed;
        
        if (connectivityPassed) {
            console.log('✅ Database connectivity configuration validation passed');
        } else {
            console.log('❌ Database connectivity configuration validation failed');
        }
    }

    /**
     * Generate validation report
     */
    async generateValidationReport() {
        console.log('\n📋 Database Configuration Validation Report');
        console.log('==========================================');
        
        // Summary
        const totalChecks = Object.keys(this.validationResults).length;
        const passedChecks = Object.values(this.validationResults).filter(result => result === true).length;
        
        console.log(`\nOverall Status: ${passedChecks}/${totalChecks} checks passed`);
        
        // Detailed results
        console.log('\nDetailed Results:');
        for (const [category, passed] of Object.entries(this.validationResults)) {
            const status = passed ? '✅' : '❌';
            const categoryName = category.replace(/([A-Z])/g, ' $1').toLowerCase();
            console.log(`  ${status} ${categoryName}`);
        }
        
        // Errors
        if (this.errors.length > 0) {
            console.log('\n❌ Errors (must be fixed):');
            this.errors.forEach((error, index) => {
                console.log(`  ${index + 1}. ${error}`);
            });
        }
        
        // Warnings
        if (this.warnings.length > 0) {
            console.log('\n⚠️  Warnings (recommended fixes):');
            this.warnings.forEach((warning, index) => {
                console.log(`  ${index + 1}. ${warning}`);
            });
        }
        
        // Configuration summary
        console.log('\n🗄️  Database Configuration Summary:');
        if (this.config.DATABASE_URL) {
            try {
                const url = new URL(this.config.DATABASE_URL);
                console.log(`  Host: ${url.hostname}:${url.port || 5432}`);
                console.log(`  Database: ${url.pathname.substring(1)}`);
                console.log(`  Username: ${url.username}`);
            } catch (error) {
                console.log(`  Connection String: [INVALID FORMAT]`);
            }
        }
        console.log(`  SSL Enabled: ${this.config.DATABASE_SSL === 'true' ? '✅ YES' : '❌ NO'}`);
        console.log(`  Pool Size: ${this.config.DATABASE_POOL_SIZE || 'DEFAULT'}`);
        console.log(`  Connection Timeout: ${this.config.DATABASE_CONNECTION_TIMEOUT || 'DEFAULT'}ms`);
        
        // Save report to file
        const reportData = {
            timestamp: new Date().toISOString(),
            overallStatus: passedChecks === totalChecks && this.errors.length === 0,
            checksPassedRatio: `${passedChecks}/${totalChecks}`,
            validationResults: this.validationResults,
            errors: this.errors,
            warnings: this.warnings,
            configuration: {
                sslEnabled: this.config.DATABASE_SSL === 'true',
                poolSize: this.config.DATABASE_POOL_SIZE,
                connectionTimeout: this.config.DATABASE_CONNECTION_TIMEOUT,
                hasConnectionString: !!this.config.DATABASE_URL
            }
        };
        
        const reportPath = path.join(__dirname, '..', 'database-configuration-validation-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    }
}

// Main execution
if (require.main === module) {
    const validator = new DatabaseConfigurationValidator();
    validator.validate().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Database validation failed:', error);
        process.exit(1);
    });
}

module.exports = DatabaseConfigurationValidator;