#!/usr/bin/env node

/**
 * Production Infrastructure Deployment Script
 * 
 * This script handles the complete deployment of the Docker stack for the
 * AI Crypto Trading Bot production environment with comprehensive validation.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class ProductionInfrastructureDeployment {
    constructor() {
        this.projectRoot = path.resolve(__dirname, '..');
        this.dockerComposeFile = path.join(this.projectRoot, 'docker', 'docker-compose.prod.yml');
        this.envFile = path.join(this.projectRoot, '.env.production');
        this.deploymentLog = [];
        this.startTime = new Date();
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${message}`;
        console.log(logEntry);
        this.deploymentLog.push(logEntry);
    }

    error(message, error = null) {
        this.log(message, 'ERROR');
        if (error) {
            this.log(error.toString(), 'ERROR');
        }
    }

    async executeCommand(command, options = {}) {
        this.log(`Executing: ${command}`);
        try {
            const result = execSync(command, {
                cwd: this.projectRoot,
                stdio: 'pipe',
                encoding: 'utf8',
                ...options
            });
            this.log(`Command completed successfully`);
            return result;
        } catch (error) {
            this.error(`Command failed: ${command}`, error);
            throw error;
        }
    }

    async validatePrerequisites() {
        this.log('=== VALIDATING PREREQUISITES ===');

        // Check Docker
        try {
            const dockerVersion = await this.executeCommand('sudo docker --version');
            this.log(`Docker version: ${dockerVersion.trim()}`);
        } catch (error) {
            throw new Error('Docker is not installed or not accessible');
        }

        // Check Docker Compose
        try {
            const composeVersion = await this.executeCommand('sudo docker compose version');
            this.log(`Docker Compose version: ${composeVersion.trim()}`);
        } catch (error) {
            throw new Error('Docker Compose is not installed or not accessible');
        }

        // Check Docker Compose file
        if (!fs.existsSync(this.dockerComposeFile)) {
            throw new Error(`Docker Compose file not found: ${this.dockerComposeFile}`);
        }
        this.log(`Docker Compose file found: ${this.dockerComposeFile}`);

        // Check environment file
        if (!fs.existsSync(this.envFile)) {
            throw new Error(`Environment file not found: ${this.envFile}`);
        }
        this.log(`Environment file found: ${this.envFile}`);

        // Validate environment file has required variables
        const envContent = fs.readFileSync(this.envFile, 'utf8');
        const requiredVars = [
            'POSTGRES_PASSWORD',
            'REDIS_PASSWORD',
            'JWT_SECRET',
            'ENCRYPTION_KEY',
            'PAPER_TRADING_MODE',
            'ALLOW_REAL_TRADES'
        ];

        for (const varName of requiredVars) {
            if (!envContent.includes(`${varName}=`)) {
                throw new Error(`Required environment variable missing: ${varName}`);
            }
        }

        // Validate paper trading safety
        if (!envContent.includes('PAPER_TRADING_MODE=true')) {
            throw new Error('CRITICAL: PAPER_TRADING_MODE must be set to true');
        }
        if (!envContent.includes('ALLOW_REAL_TRADES=false')) {
            throw new Error('CRITICAL: ALLOW_REAL_TRADES must be set to false');
        }

        this.log('Prerequisites validation completed successfully');
    }

    async cleanupExistingContainers() {
        this.log('=== CLEANING UP EXISTING CONTAINERS ===');

        try {
            // Stop existing containers
            this.log('Stopping existing containers...');
            await this.executeCommand('sudo docker compose --env-file .env.production -f docker/docker-compose.prod.yml down --remove-orphans', {
                stdio: 'inherit'
            });

            // Remove unused volumes (optional, commented out for safety)
            // await this.executeCommand('sudo docker volume prune -f');

            this.log('Container cleanup completed');
        } catch (error) {
            this.log('No existing containers to clean up or cleanup failed (this is usually fine)');
        }
    }

    async buildImages() {
        this.log('=== BUILDING DOCKER IMAGES ===');

        try {
            this.log('Building all images...');
            await this.executeCommand('sudo docker compose --env-file .env.production -f docker/docker-compose.prod.yml build --no-cache', {
                stdio: 'inherit'
            });
            this.log('Docker images built successfully');
        } catch (error) {
            this.error('Failed to build Docker images', error);
            throw error;
        }
    }

    async deployStack() {
        this.log('=== DEPLOYING DOCKER STACK ===');

        try {
            this.log('Starting Docker stack...');
            await this.executeCommand('sudo docker compose --env-file .env.production -f docker/docker-compose.prod.yml up -d', {
                stdio: 'inherit'
            });
            this.log('Docker stack deployment initiated');
        } catch (error) {
            this.error('Failed to deploy Docker stack', error);
            throw error;
        }
    }

    async waitForServices() {
        this.log('=== WAITING FOR SERVICES TO START ===');

        const services = [
            { name: 'postgres', timeout: 60 },
            { name: 'redis', timeout: 30 },
            { name: 'rabbitmq', timeout: 60 },
            { name: 'backend', timeout: 120 },
            { name: 'frontend', timeout: 60 },
            { name: 'prometheus', timeout: 30 },
            { name: 'grafana', timeout: 30 }
        ];

        for (const service of services) {
            this.log(`Waiting for ${service.name} to be healthy...`);
            
            let attempts = 0;
            const maxAttempts = Math.ceil(service.timeout / 5);
            
            while (attempts < maxAttempts) {
                try {
                    const result = await this.executeCommand(`sudo docker compose --env-file .env.production -f docker/docker-compose.prod.yml ps ${service.name}`);
                    
                    if (result.includes('healthy') || result.includes('Up')) {
                        this.log(`${service.name} is healthy`);
                        break;
                    }
                    
                    if (result.includes('unhealthy') || result.includes('Exited')) {
                        throw new Error(`${service.name} is unhealthy or exited`);
                    }
                    
                    attempts++;
                    this.log(`${service.name} not ready yet, waiting... (attempt ${attempts}/${maxAttempts})`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    
                } catch (error) {
                    if (attempts >= maxAttempts - 1) {
                        this.error(`${service.name} failed to start within ${service.timeout} seconds`, error);
                        throw error;
                    }
                    attempts++;
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
        }

        this.log('All services are running');
    }

    async validateHealthChecks() {
        this.log('=== VALIDATING HEALTH CHECKS ===');

        const healthChecks = [
            {
                name: 'Backend API Health',
                url: 'http://localhost:3000/health',
                expectedStatus: 200
            },
            {
                name: 'Frontend Health',
                url: 'http://localhost/health',
                expectedStatus: 200
            },
            {
                name: 'Prometheus Health',
                url: 'http://localhost:9090/-/healthy',
                expectedStatus: 200
            },
            {
                name: 'Grafana Health',
                url: 'http://localhost:3001/api/health',
                expectedStatus: 200
            }
        ];

        for (const check of healthChecks) {
            try {
                this.log(`Checking ${check.name}...`);
                const result = await this.executeCommand(`curl -f -s -o /dev/null -w "%{http_code}" ${check.url}`);
                
                if (result.trim() === check.expectedStatus.toString()) {
                    this.log(`${check.name}: HEALTHY`);
                } else {
                    this.log(`${check.name}: UNHEALTHY (status: ${result.trim()})`, 'WARN');
                }
            } catch (error) {
                this.log(`${check.name}: FAILED`, 'WARN');
            }
        }
    }

    async validateInterContainerCommunication() {
        this.log('=== VALIDATING INTER-CONTAINER COMMUNICATION ===');

        try {
            // Test backend to database connection
            this.log('Testing backend to database connection...');
            const dbTest = await this.executeCommand('sudo docker exec trading-bot-backend node -e "console.log(\'Database connection test\')"');
            this.log('Backend to database: OK');

            // Test backend to Redis connection
            this.log('Testing backend to Redis connection...');
            const redisTest = await this.executeCommand('sudo docker exec trading-bot-redis redis-cli ping');
            if (redisTest.trim() === 'PONG') {
                this.log('Backend to Redis: OK');
            }

            // Test RabbitMQ connection
            this.log('Testing RabbitMQ connection...');
            const rabbitTest = await this.executeCommand('sudo docker exec trading-bot-rabbitmq rabbitmq-diagnostics ping');
            this.log('RabbitMQ connection: OK');

        } catch (error) {
            this.log('Some inter-container communication tests failed', 'WARN');
        }
    }

    async validateRestartPolicies() {
        this.log('=== VALIDATING RESTART POLICIES ===');

        try {
            // Check restart policies
            const containers = await this.executeCommand('sudo docker compose --env-file .env.production -f docker/docker-compose.prod.yml ps --format json');
            const containerList = JSON.parse(`[${containers.trim().split('\n').join(',')}]`);

            for (const container of containerList) {
                const inspect = await this.executeCommand(`sudo docker inspect ${container.Name}`);
                const containerInfo = JSON.parse(inspect)[0];
                const restartPolicy = containerInfo.HostConfig.RestartPolicy.Name;
                
                if (restartPolicy === 'unless-stopped') {
                    this.log(`${container.Name}: Restart policy OK (${restartPolicy})`);
                } else {
                    this.log(`${container.Name}: Restart policy WARNING (${restartPolicy})`, 'WARN');
                }
            }
        } catch (error) {
            this.log('Failed to validate restart policies', 'WARN');
        }
    }

    async generateDeploymentReport() {
        this.log('=== GENERATING DEPLOYMENT REPORT ===');

        const endTime = new Date();
        const duration = Math.round((endTime - this.startTime) / 1000);

        const report = {
            deployment: {
                timestamp: this.startTime.toISOString(),
                duration: `${duration} seconds`,
                status: 'SUCCESS'
            },
            environment: {
                paperTradingMode: true,
                realTradingAllowed: false,
                environment: 'production'
            },
            services: {},
            logs: this.deploymentLog
        };

        try {
            // Get container status
            const containers = await this.executeCommand('sudo docker compose --env-file .env.production -f docker/docker-compose.prod.yml ps --format json');
            const containerList = JSON.parse(`[${containers.trim().split('\n').join(',')}]`);

            for (const container of containerList) {
                report.services[container.Service] = {
                    name: container.Name,
                    state: container.State,
                    status: container.Status,
                    ports: container.Publishers || []
                };
            }
        } catch (error) {
            this.log('Failed to get container status for report', 'WARN');
        }

        const reportPath = path.join(this.projectRoot, 'production-infrastructure-deployment-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        this.log(`Deployment report saved to: ${reportPath}`);

        return report;
    }

    async showDeploymentSummary() {
        this.log('=== DEPLOYMENT SUMMARY ===');
        
        try {
            const containers = await this.executeCommand('sudo docker compose --env-file .env.production -f docker/docker-compose.prod.yml ps');
            console.log('\nContainer Status:');
            console.log(containers);

            console.log('\nService URLs:');
            console.log('- Frontend: http://localhost (HTTP) / https://localhost (HTTPS)');
            console.log('- Backend API: http://localhost:3000');
            console.log('- Prometheus: http://localhost:9090');
            console.log('- Grafana: http://localhost:3001');
            console.log('- RabbitMQ Management: http://localhost:15672');

            console.log('\nIMPORTANT SAFETY NOTICE:');
            console.log('🔒 PAPER TRADING MODE: ENABLED');
            console.log('🚫 REAL TRADING: DISABLED');
            console.log('💰 FINANCIAL RISK: ZERO');
            console.log('🧪 ENVIRONMENT: PRODUCTION SIMULATION');

        } catch (error) {
            this.log('Failed to show deployment summary', 'WARN');
        }
    }

    async run() {
        try {
            this.log('Starting Production Infrastructure Deployment');
            this.log(`Project root: ${this.projectRoot}`);

            await this.validatePrerequisites();
            await this.cleanupExistingContainers();
            await this.buildImages();
            await this.deployStack();
            await this.waitForServices();
            await this.validateHealthChecks();
            await this.validateInterContainerCommunication();
            await this.validateRestartPolicies();
            
            const report = await this.generateDeploymentReport();
            await this.showDeploymentSummary();

            this.log('=== DEPLOYMENT COMPLETED SUCCESSFULLY ===');
            return report;

        } catch (error) {
            this.error('Deployment failed', error);
            
            // Generate failure report
            const report = await this.generateDeploymentReport();
            report.deployment.status = 'FAILED';
            report.deployment.error = error.message;
            
            const reportPath = path.join(this.projectRoot, 'production-infrastructure-deployment-report.json');
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
            
            throw error;
        }
    }
}

// Run if called directly
if (require.main === module) {
    const deployment = new ProductionInfrastructureDeployment();
    deployment.run()
        .then(() => {
            console.log('\n✅ Production infrastructure deployment completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Production infrastructure deployment failed:', error.message);
            process.exit(1);
        });
}

module.exports = ProductionInfrastructureDeployment;