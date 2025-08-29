const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ProductionEnvironmentValidator {
    constructor() {
        this.validationResults = {
            paperTradingSafety: {},
            environmentConfiguration: {},
            dockerConfiguration: {},
            sslConfiguration: {},
            databaseConfiguration: {},
            monitoringConfiguration: {},
            securityConfiguration: {},
            dependencyValidation: {},
            networkConfiguration: {},
            backupConfiguration: {},
            overallScore: 0,
            criticalIssues: [],
            warnings: [],
            recommendations: []
        };
        
        this.criticalEnvVars = [
            'NODE_ENV',
            'PAPER_TRADING_MODE',
            'TRADING_SIMULATION_ONLY',
            'ALLOW_REAL_TRADES',
            'DATABASE_URL',
            'REDIS_HOST',
            'JWT_SECRET',
            'MONITORING_ENABLED'
        ];
    }

    async validateProductionEnvironment() {
        console.log('Starting Comprehensive Production Environment Validation...');
        console.log('Current working directory:', process.cwd());
        
        try {
            await this.validatePaperTradingSafety();
            await this.validateEnvironmentConfiguration();
            await this.validateDockerConfiguration();
            await this.validateSSLConfiguration();
            await this.validateDatabaseConfiguration();
            await this.validateMonitoringConfiguration();
            await this.validateSecurityConfiguration();
            await this.validateDependencies();
            await this.validateNetworkConfiguration();
            await this.validateBackupConfiguration();
            
            this.calculateOverallScore();
            await this.generateValidationReport();
            
            return this.validationResults;
            
        } catch (error) {
            console.error('Critical error during validation:', error.message);
            this.validationResults.criticalIssues.push({
                category: 'validation_error',
                issue: error.message,
                severity: 'critical'
            });
            return this.validationResults;
        }
    }

    async validatePaperTradingSafety() {
        console.log('Validating Paper Trading Safety Configuration...');
        
        const safetyChecks = {
            paperTradingMode: false,
            tradingSimulationOnly: false,
            realTradesBlocked: false,
            apiKeysReadOnly: false,
            safetyScore: 0
        };

        try {
            const envPath = path.join(process.cwd(), '.env.production');
            if (fs.existsSync(envPath)) {
                const envContent = fs.readFileSync(envPath, 'utf8');
                
                safetyChecks.paperTradingMode = envContent.includes('PAPER_TRADING_MODE=true');
                safetyChecks.tradingSimulationOnly = envContent.includes('TRADING_SIMULATION_ONLY=true');
                safetyChecks.realTradesBlocked = envContent.includes('ALLOW_REAL_TRADES=false');
                
                const binanceReadOnly = envContent.includes('BINANCE_READ_ONLY=true');
                const kucoinReadOnly = envContent.includes('KUCOIN_READ_ONLY=true');
                safetyChecks.apiKeysReadOnly = binanceReadOnly && kucoinReadOnly;
                
                const safetyPoints = [
                    safetyChecks.paperTradingMode,
                    safetyChecks.tradingSimulationOnly,
                    safetyChecks.realTradesBlocked,
                    safetyChecks.apiKeysReadOnly
                ].filter(Boolean).length;
                
                safetyChecks.safetyScore = (safetyPoints / 4) * 100;
                
                if (safetyChecks.safetyScore < 90) {
                    this.validationResults.criticalIssues.push({
                        category: 'paper_trading_safety',
                        issue: `Paper trading safety score is ${safetyChecks.safetyScore}% (minimum required: 90%)`,
                        severity: 'critical'
                    });
                }
                
            } else {
                this.validationResults.criticalIssues.push({
                    category: 'paper_trading_safety',
                    issue: 'Production environment file (.env.production) not found',
                    severity: 'critical'
                });
            }
            
            this.validationResults.paperTradingSafety = safetyChecks;
            console.log(`   Paper Trading Safety Score: ${safetyChecks.safetyScore}%`);
            
        } catch (error) {
            console.error('   Paper trading safety validation failed:', error.message);
            this.validationResults.criticalIssues.push({
                category: 'paper_trading_safety',
                issue: `Validation failed: ${error.message}`,
                severity: 'critical'
            });
        }
    }

    async validateEnvironmentConfiguration() {
        console.log('Validating Environment Configuration...');
        
        const envChecks = {
            fileExists: false,
            allRequiredVarsPresent: false,
            productionMode: false,
            secretsSecure: false,
            missingVars: []
        };

        try {
            const envPath = path.join(process.cwd(), '.env.production');
            envChecks.fileExists = fs.existsSync(envPath);
            
            if (envChecks.fileExists) {
                const envContent = fs.readFileSync(envPath, 'utf8');
                
                const missingVars = this.criticalEnvVars.filter(varName => {
                    return !envContent.includes(`${varName}=`);
                });
                
                envChecks.missingVars = missingVars;
                envChecks.allRequiredVarsPresent = missingVars.length === 0;
                envChecks.productionMode = envContent.includes('NODE_ENV=production');
                
                const hasSecureJWT = !envContent.includes('default-jwt-secret');
                const hasSecureEncryption = !envContent.includes('default-encryption-key');
                envChecks.secretsSecure = hasSecureJWT && hasSecureEncryption;
                
                if (missingVars.length > 0) {
                    this.validationResults.criticalIssues.push({
                        category: 'environment_config',
                        issue: `Missing required environment variables: ${missingVars.join(', ')}`,
                        severity: 'critical'
                    });
                }
                
            } else {
                this.validationResults.criticalIssues.push({
                    category: 'environment_config',
                    issue: 'Production environment file not found',
                    severity: 'critical'
                });
            }
            
            this.validationResults.environmentConfiguration = envChecks;
            console.log(`   Environment Configuration: ${envChecks.allRequiredVarsPresent ? 'Valid' : 'Issues Found'}`);
            
        } catch (error) {
            console.error('   Environment configuration validation failed:', error.message);
            this.validationResults.criticalIssues.push({
                category: 'environment_config',
                issue: `Validation failed: ${error.message}`,
                severity: 'critical'
            });
        }
    }

    async validateDockerConfiguration() {
        console.log('Validating Docker Configuration...');
        
        const dockerChecks = {
            composeFileExists: false,
            dockerfilesExist: false,
            healthChecksConfigured: false,
            resourceLimitsSet: false,
            networksConfigured: false,
            volumesConfigured: false
        };

        try {
            const composePath = path.join(process.cwd(), 'docker-compose.prod.yml');
            dockerChecks.composeFileExists = fs.existsSync(composePath);
            
            if (dockerChecks.composeFileExists) {
                const composeContent = fs.readFileSync(composePath, 'utf8');
                
                dockerChecks.healthChecksConfigured = composeContent.includes('healthcheck:');
                dockerChecks.resourceLimitsSet = composeContent.includes('deploy:') && 
                                                composeContent.includes('resources:');
                dockerChecks.networksConfigured = composeContent.includes('networks:');
                dockerChecks.volumesConfigured = composeContent.includes('volumes:');
            }
            
            const frontendDockerfile = path.join(process.cwd(), 'docker/Dockerfile.frontend');
            const backendDockerfile = path.join(process.cwd(), 'docker/Dockerfile.backend');
            dockerChecks.dockerfilesExist = fs.existsSync(frontendDockerfile) && 
                                           fs.existsSync(backendDockerfile);
            
            if (!dockerChecks.composeFileExists) {
                this.validationResults.criticalIssues.push({
                    category: 'docker_config',
                    issue: 'Production docker-compose file not found',
                    severity: 'critical'
                });
            }
            
            if (!dockerChecks.dockerfilesExist) {
                this.validationResults.criticalIssues.push({
                    category: 'docker_config',
                    issue: 'Required Dockerfiles not found',
                    severity: 'critical'
                });
            }
            
            this.validationResults.dockerConfiguration = dockerChecks;
            console.log(`   Docker Configuration: ${dockerChecks.composeFileExists ? 'Valid' : 'Issues Found'}`);
            
        } catch (error) {
            console.error('   Docker configuration validation failed:', error.message);
            this.validationResults.criticalIssues.push({
                category: 'docker_config',
                issue: `Validation failed: ${error.message}`,
                severity: 'critical'
            });
        }
    }

    async validateSSLConfiguration() {
        console.log('Validating SSL Configuration...');
        
        const sslChecks = {
            certificatesExist: false,
            nginxConfigured: false,
            sslEnabled: false,
            securityHeadersConfigured: false
        };

        try {
            const sslDir = path.join(process.cwd(), 'docker/ssl');
            const certExists = fs.existsSync(path.join(sslDir, 'cert.pem'));
            const keyExists = fs.existsSync(path.join(sslDir, 'private.key'));
            sslChecks.certificatesExist = certExists && keyExists;
            
            const nginxConfigPath = path.join(process.cwd(), 'docker/nginx/complete-production.conf');
            if (fs.existsSync(nginxConfigPath)) {
                const nginxContent = fs.readFileSync(nginxConfigPath, 'utf8');
                sslChecks.nginxConfigured = nginxContent.includes('ssl_certificate') && 
                                           nginxContent.includes('ssl_certificate_key');
                sslChecks.securityHeadersConfigured = nginxContent.includes('add_header Strict-Transport-Security');
            }
            
            const envPath = path.join(process.cwd(), '.env.production');
            if (fs.existsSync(envPath)) {
                const envContent = fs.readFileSync(envPath, 'utf8');
                sslChecks.sslEnabled = envContent.includes('SSL_ENABLED=true');
            }
            
            if (!sslChecks.certificatesExist) {
                this.validationResults.warnings.push({
                    category: 'ssl_config',
                    issue: 'SSL certificates not found - using self-signed certificates',
                    severity: 'warning'
                });
            }
            
            this.validationResults.sslConfiguration = sslChecks;
            console.log(`   SSL Configuration: ${sslChecks.sslEnabled ? 'Enabled' : 'Disabled'}`);
            
        } catch (error) {
            console.error('   SSL configuration validation failed:', error.message);
            this.validationResults.warnings.push({
                category: 'ssl_config',
                issue: `Validation failed: ${error.message}`,
                severity: 'warning'
            });
        }
    }

    async validateDatabaseConfiguration() {
        console.log('Validating Database Configuration...');
        
        const dbChecks = {
            configurationValid: false,
            initScriptsExist: false,
            backupConfigured: false,
            connectionPoolConfigured: false
        };

        try {
            const initDir = path.join(process.cwd(), 'database/init');
            dbChecks.initScriptsExist = fs.existsSync(initDir) && 
                                       fs.existsSync(path.join(initDir, '01-init.sql'));
            
            const envPath = path.join(process.cwd(), '.env.production');
            if (fs.existsSync(envPath)) {
                const envContent = fs.readFileSync(envPath, 'utf8');
                dbChecks.configurationValid = envContent.includes('DATABASE_URL=postgresql://');
                dbChecks.connectionPoolConfigured = envContent.includes('DATABASE_POOL_SIZE=');
            }
            
            const composePath = path.join(process.cwd(), 'docker-compose.prod.yml');
            if (fs.existsSync(composePath)) {
                const composeContent = fs.readFileSync(composePath, 'utf8');
                dbChecks.backupConfigured = composeContent.includes('backup:');
            }
            
            if (!dbChecks.configurationValid) {
                this.validationResults.criticalIssues.push({
                    category: 'database_config',
                    issue: 'Database configuration invalid or missing',
                    severity: 'critical'
                });
            }
            
            this.validationResults.databaseConfiguration = dbChecks;
            console.log(`   Database Configuration: ${dbChecks.configurationValid ? 'Valid' : 'Issues Found'}`);
            
        } catch (error) {
            console.error('   Database configuration validation failed:', error.message);
            this.validationResults.criticalIssues.push({
                category: 'database_config',
                issue: `Validation failed: ${error.message}`,
                severity: 'critical'
            });
        }
    }

    async validateMonitoringConfiguration() {
        console.log('Validating Monitoring Configuration...');
        
        const monitoringChecks = {
            prometheusConfigured: false,
            grafanaConfigured: false,
            alertingConfigured: false,
            dashboardsExist: false,
            metricsEnabled: false
        };

        try {
            const prometheusConfigPath = path.join(process.cwd(), 'monitoring/prometheus.yml');
            monitoringChecks.prometheusConfigured = fs.existsSync(prometheusConfigPath);
            
            const grafanaProvisioningPath = path.join(process.cwd(), 'monitoring/grafana/provisioning');
            monitoringChecks.grafanaConfigured = fs.existsSync(grafanaProvisioningPath);
            
            const dashboardsPath = path.join(process.cwd(), 'monitoring/grafana/dashboards');
            monitoringChecks.dashboardsExist = fs.existsSync(dashboardsPath);
            
            const alertmanagerPath = path.join(process.cwd(), 'monitoring/alertmanager');
            monitoringChecks.alertingConfigured = fs.existsSync(alertmanagerPath);
            
            const envPath = path.join(process.cwd(), '.env.production');
            if (fs.existsSync(envPath)) {
                const envContent = fs.readFileSync(envPath, 'utf8');
                monitoringChecks.metricsEnabled = envContent.includes('MONITORING_ENABLED=true');
            }
            
            if (!monitoringChecks.prometheusConfigured) {
                this.validationResults.warnings.push({
                    category: 'monitoring_config',
                    issue: 'Prometheus configuration not found',
                    severity: 'warning'
                });
            }
            
            this.validationResults.monitoringConfiguration = monitoringChecks;
            console.log(`   Monitoring Configuration: ${monitoringChecks.metricsEnabled ? 'Enabled' : 'Disabled'}`);
            
        } catch (error) {
            console.error('   Monitoring configuration validation failed:', error.message);
            this.validationResults.warnings.push({
                category: 'monitoring_config',
                issue: `Validation failed: ${error.message}`,
                severity: 'warning'
            });
        }
    }

    async validateSecurityConfiguration() {
        console.log('Validating Security Configuration...');
        
        const securityChecks = {
            jwtConfigured: false,
            encryptionConfigured: false,
            rateLimitingEnabled: false,
            corsConfigured: false,
            helmetEnabled: false,
            auditLoggingEnabled: false
        };

        try {
            const envPath = path.join(process.cwd(), '.env.production');
            if (fs.existsSync(envPath)) {
                const envContent = fs.readFileSync(envPath, 'utf8');
                
                securityChecks.jwtConfigured = envContent.includes('JWT_SECRET=') && 
                                              !envContent.includes('default-jwt-secret');
                securityChecks.encryptionConfigured = envContent.includes('ENCRYPTION_KEY=') && 
                                                     !envContent.includes('default-encryption-key');
                securityChecks.rateLimitingEnabled = envContent.includes('RATE_LIMIT_WINDOW_MS=');
                securityChecks.corsConfigured = envContent.includes('CORS_ORIGIN=');
                securityChecks.helmetEnabled = envContent.includes('HELMET_ENABLED=true');
                securityChecks.auditLoggingEnabled = envContent.includes('AUDIT_LOGGING_ENABLED=true');
            }
            
            if (!securityChecks.jwtConfigured) {
                this.validationResults.criticalIssues.push({
                    category: 'security_config',
                    issue: 'JWT secret not properly configured',
                    severity: 'critical'
                });
            }
            
            if (!securityChecks.encryptionConfigured) {
                this.validationResults.criticalIssues.push({
                    category: 'security_config',
                    issue: 'Encryption key not properly configured',
                    severity: 'critical'
                });
            }
            
            this.validationResults.securityConfiguration = securityChecks;
            console.log(`   Security Configuration: ${securityChecks.jwtConfigured && securityChecks.encryptionConfigured ? 'Secure' : 'Issues Found'}`);
            
        } catch (error) {
            console.error('   Security configuration validation failed:', error.message);
            this.validationResults.criticalIssues.push({
                category: 'security_config',
                issue: `Validation failed: ${error.message}`,
                severity: 'critical'
            });
        }
    }

    async validateDependencies() {
        console.log('Validating Dependencies...');
        
        const depChecks = {
            packageJsonExists: false,
            nodeModulesExists: false,
            prismaConfigured: false,
            typescriptConfigured: false,
            buildSuccessful: false
        };

        try {
            const packageJsonPath = path.join(process.cwd(), 'package.json');
            depChecks.packageJsonExists = fs.existsSync(packageJsonPath);
            
            const nodeModulesPath = path.join(process.cwd(), 'node_modules');
            depChecks.nodeModulesExists = fs.existsSync(nodeModulesPath);
            
            const prismaSchemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
            depChecks.prismaConfigured = fs.existsSync(prismaSchemaPath);
            
            const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
            depChecks.typescriptConfigured = fs.existsSync(tsconfigPath);
            
            try {
                execSync('npm run build --if-present', { stdio: 'pipe', timeout: 30000 });
                depChecks.buildSuccessful = true;
            } catch (buildError) {
                this.validationResults.warnings.push({
                    category: 'dependencies',
                    issue: 'Build process failed or not configured',
                    severity: 'warning'
                });
            }
            
            if (!depChecks.nodeModulesExists) {
                this.validationResults.criticalIssues.push({
                    category: 'dependencies',
                    issue: 'Dependencies not installed (node_modules missing)',
                    severity: 'critical'
                });
            }
            
            this.validationResults.dependencyValidation = depChecks;
            console.log(`   Dependencies: ${depChecks.nodeModulesExists ? 'Installed' : 'Missing'}`);
            
        } catch (error) {
            console.error('   Dependency validation failed:', error.message);
            this.validationResults.warnings.push({
                category: 'dependencies',
                issue: `Validation failed: ${error.message}`,
                severity: 'warning'
            });
        }
    }

    async validateNetworkConfiguration() {
        console.log('Validating Network Configuration...');
        
        const networkChecks = {
            dockerNetworkConfigured: false,
            portMappingsValid: false,
            firewallConfigured: false,
            loadBalancingConfigured: false
        };

        try {
            const composePath = path.join(process.cwd(), 'docker-compose.prod.yml');
            if (fs.existsSync(composePath)) {
                const composeContent = fs.readFileSync(composePath, 'utf8');
                networkChecks.dockerNetworkConfigured = composeContent.includes('networks:') && 
                                                       composeContent.includes('trading-bot-network');
                networkChecks.portMappingsValid = composeContent.includes('ports:');
            }
            
            const nginxConfigPath = path.join(process.cwd(), 'docker/nginx/complete-production.conf');
            if (fs.existsSync(nginxConfigPath)) {
                const nginxContent = fs.readFileSync(nginxConfigPath, 'utf8');
                networkChecks.loadBalancingConfigured = nginxContent.includes('upstream') || 
                                                       nginxContent.includes('proxy_pass');
            }
            
            this.validationResults.networkConfiguration = networkChecks;
            console.log(`   Network Configuration: ${networkChecks.dockerNetworkConfigured ? 'Valid' : 'Basic'}`);
            
        } catch (error) {
            console.error('   Network configuration validation failed:', error.message);
            this.validationResults.warnings.push({
                category: 'network_config',
                issue: `Validation failed: ${error.message}`,
                severity: 'warning'
            });
        }
    }

    async validateBackupConfiguration() {
        console.log('Validating Backup Configuration...');
        
        const backupChecks = {
            backupServiceConfigured: false,
            scheduleConfigured: false,
            retentionPolicySet: false,
            backupScriptsExist: false
        };

        try {
            const composePath = path.join(process.cwd(), 'docker-compose.prod.yml');
            if (fs.existsSync(composePath)) {
                const composeContent = fs.readFileSync(composePath, 'utf8');
                backupChecks.backupServiceConfigured = composeContent.includes('backup:');
            }
            
            const backupScriptPath = path.join(process.cwd(), 'docker/scripts/backup.sh');
            backupChecks.backupScriptsExist = fs.existsSync(backupScriptPath);
            
            const envPath = path.join(process.cwd(), '.env.production');
            if (fs.existsSync(envPath)) {
                const envContent = fs.readFileSync(envPath, 'utf8');
                backupChecks.scheduleConfigured = envContent.includes('BACKUP_SCHEDULE=');
                backupChecks.retentionPolicySet = envContent.includes('BACKUP_RETENTION_DAYS=');
            }
            
            this.validationResults.backupConfiguration = backupChecks;
            console.log(`   Backup Configuration: ${backupChecks.backupServiceConfigured ? 'Configured' : 'Not Configured'}`);
            
        } catch (error) {
            console.error('   Backup configuration validation failed:', error.message);
            this.validationResults.warnings.push({
                category: 'backup_config',
                issue: `Validation failed: ${error.message}`,
                severity: 'warning'
            });
        }
    }

    calculateOverallScore() {
        const categories = [
            'paperTradingSafety',
            'environmentConfiguration',
            'dockerConfiguration',
            'sslConfiguration',
            'databaseConfiguration',
            'monitoringConfiguration',
            'securityConfiguration',
            'dependencyValidation',
            'networkConfiguration',
            'backupConfiguration'
        ];

        let totalScore = 0;
        let maxScore = 0;

        categories.forEach(category => {
            const categoryData = this.validationResults[category];
            if (categoryData) {
                const categoryScore = Object.values(categoryData).filter(value => 
                    typeof value === 'boolean' ? value : false
                ).length;
                const categoryMax = Object.values(categoryData).filter(value => 
                    typeof value === 'boolean'
                ).length;
                
                totalScore += categoryScore;
                maxScore += categoryMax;
            }
        });

        this.validationResults.overallScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
        
        if (this.validationResults.paperTradingSafety.safetyScore) {
            this.validationResults.overallScore = Math.round(
                (this.validationResults.overallScore * 0.7) + 
                (this.validationResults.paperTradingSafety.safetyScore * 0.3)
            );
        }
    }

    async generateValidationReport() {
        const report = {
            timestamp: new Date().toISOString(),
            environment: 'production',
            overallScore: this.validationResults.overallScore,
            status: this.getValidationStatus(),
            summary: this.generateSummary(),
            details: this.validationResults,
            recommendations: this.generateRecommendations()
        };

        const reportPath = path.join(process.cwd(), 'production-environment-validation-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log('\nProduction Environment Validation Report');
        console.log('='.repeat(50));
        console.log(`Overall Score: ${report.overallScore}%`);
        console.log(`Status: ${report.status}`);
        console.log(`Critical Issues: ${this.validationResults.criticalIssues.length}`);
        console.log(`Warnings: ${this.validationResults.warnings.length}`);
        console.log(`Report saved to: ${reportPath}`);
        
        if (this.validationResults.criticalIssues.length > 0) {
            console.log('\nCritical Issues:');
            this.validationResults.criticalIssues.forEach((issue, index) => {
                console.log(`   ${index + 1}. [${issue.category}] ${issue.issue}`);
            });
        }
        
        if (this.validationResults.warnings.length > 0) {
            console.log('\nWarnings:');
            this.validationResults.warnings.forEach((warning, index) => {
                console.log(`   ${index + 1}. [${warning.category}] ${warning.issue}`);
            });
        }
        
        console.log('\n' + '='.repeat(50));
        
        return report;
    }

    getValidationStatus() {
        if (this.validationResults.criticalIssues.length > 0) {
            return 'FAILED - Critical issues must be resolved';
        } else if (this.validationResults.overallScore < 80) {
            return 'WARNING - Improvements recommended';
        } else if (this.validationResults.overallScore < 95) {
            return 'GOOD - Minor improvements possible';
        } else {
            return 'EXCELLENT - Production ready';
        }
    }

    generateSummary() {
        return {
            paperTradingSafetyScore: this.validationResults.paperTradingSafety.safetyScore || 0,
            criticalIssuesCount: this.validationResults.criticalIssues.length,
            warningsCount: this.validationResults.warnings.length,
            configurationComplete: this.validationResults.overallScore >= 80,
            productionReady: this.validationResults.criticalIssues.length === 0 && 
                           this.validationResults.overallScore >= 90
        };
    }

    generateRecommendations() {
        const recommendations = [];
        
        if (this.validationResults.paperTradingSafety.safetyScore < 90) {
            recommendations.push('Ensure all paper trading safety mechanisms are properly configured');
        }
        
        if (this.validationResults.criticalIssues.length > 0) {
            recommendations.push('Resolve all critical issues before deployment');
        }
        
        if (!this.validationResults.sslConfiguration.certificatesExist) {
            recommendations.push('Configure proper SSL certificates for production');
        }
        
        if (!this.validationResults.monitoringConfiguration.prometheusConfigured) {
            recommendations.push('Set up comprehensive monitoring and alerting');
        }
        
        if (!this.validationResults.backupConfiguration.backupServiceConfigured) {
            recommendations.push('Configure automated backup system');
        }
        
        return recommendations;
    }
}

async function main() {
    const validator = new ProductionEnvironmentValidator();
    const results = await validator.validateProductionEnvironment();
    
    if (results.criticalIssues.length > 0) {
        process.exit(1);
    } else if (results.warnings.length > 0) {
        process.exit(2);
    } else {
        process.exit(0);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { ProductionEnvironmentValidator };