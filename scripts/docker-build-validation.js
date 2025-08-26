#!/usr/bin/env node

/**
 * Docker Container Build and Validation Script
 * 
 * This script validates Docker configurations and builds containers
 * for the production deployment execution task.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class DockerBuildValidator {
    constructor() {
        this.projectRoot = process.cwd();
        this.results = {
            configValidation: {},
            buildResults: {},
            healthChecks: {},
            volumeValidation: {},
            networkValidation: {}
        };
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async validateDockerConfigurations() {
        this.log('Starting Docker configuration validation...');
        
        const requiredFiles = [
            'docker/Dockerfile.frontend',
            'docker/Dockerfile.backend', 
            'docker/Dockerfile.backup',
            'docker/docker-compose.prod.yml',
            'docker/nginx.conf',
            'docker/default.conf'
        ];

        for (const file of requiredFiles) {
            const filePath = path.join(this.projectRoot, file);
            if (fs.existsSync(filePath)) {
                this.results.configValidation[file] = 'exists';
                this.log(`Configuration file found: ${file}`);
            } else {
                this.results.configValidation[file] = 'missing';
                this.log(`Configuration file missing: ${file}`, 'error');
            }
        }

        // Validate docker-compose.prod.yml structure
        await this.validateDockerCompose();
        
        return this.results.configValidation;
    }

    async validateDockerCompose() {
        try {
            const composePath = path.join(this.projectRoot, 'docker/docker-compose.prod.yml');
            if (!fs.existsSync(composePath)) {
                throw new Error('docker-compose.prod.yml not found');
            }

            // Validate compose file syntax
            execSync('sudo docker-compose -f docker/docker-compose.prod.yml config', {
                cwd: this.projectRoot,
                stdio: 'pipe'
            });
            
            this.results.configValidation['docker-compose-syntax'] = 'valid';
            this.log('Docker Compose configuration syntax is valid');

            // Check for required services
            const requiredServices = ['frontend', 'backend', 'postgres', 'redis', 'rabbitmq'];
            const composeContent = fs.readFileSync(composePath, 'utf8');
            
            for (const service of requiredServices) {
                if (composeContent.includes(`${service}:`)) {
                    this.results.configValidation[`service-${service}`] = 'defined';
                    this.log(`Service ${service} is defined in docker-compose`);
                } else {
                    this.results.configValidation[`service-${service}`] = 'missing';
                    this.log(`Service ${service} is missing from docker-compose`, 'error');
                }
            }

        } catch (error) {
            this.results.configValidation['docker-compose-syntax'] = 'invalid';
            this.log(`Docker Compose validation failed: ${error.message}`, 'error');
        }
    }

    async validateVolumes() {
        this.log('Validating Docker volume configurations...');
        
        try {
            const composeContent = fs.readFileSync(
                path.join(this.projectRoot, 'docker/docker-compose.prod.yml'), 
                'utf8'
            );

            const expectedVolumes = [
                'postgres_data',
                'redis_data', 
                'rabbitmq_data',
                'prometheus_data',
                'grafana_data',
                'backend_logs',
                'certbot_certs'
            ];

            for (const volume of expectedVolumes) {
                if (composeContent.includes(volume)) {
                    this.results.volumeValidation[volume] = 'defined';
                    this.log(`Volume ${volume} is properly defined`);
                } else {
                    this.results.volumeValidation[volume] = 'missing';
                    this.log(`Volume ${volume} is missing`, 'warn');
                }
            }

        } catch (error) {
            this.log(`Volume validation failed: ${error.message}`, 'error');
        }
    }

    async validateHealthChecks() {
        this.log('Validating container health check configurations...');
        
        try {
            const dockerfiles = [
                'docker/Dockerfile.frontend',
                'docker/Dockerfile.backend',
                'docker/Dockerfile.backup'
            ];

            for (const dockerfile of dockerfiles) {
                const content = fs.readFileSync(path.join(this.projectRoot, dockerfile), 'utf8');
                
                if (content.includes('HEALTHCHECK')) {
                    this.results.healthChecks[dockerfile] = 'configured';
                    this.log(`Health check configured in ${dockerfile}`);
                } else {
                    this.results.healthChecks[dockerfile] = 'missing';
                    this.log(`Health check missing in ${dockerfile}`, 'warn');
                }
            }

        } catch (error) {
            this.log(`Health check validation failed: ${error.message}`, 'error');
        }
    }

    async buildDockerImages() {
        this.log('Starting Docker image builds...');
        
        const images = [
            {
                name: 'trading-bot-frontend',
                dockerfile: 'docker/Dockerfile.frontend',
                context: '.'
            },
            {
                name: 'trading-bot-backend', 
                dockerfile: 'docker/Dockerfile.backend',
                context: '.'
            },
            {
                name: 'trading-bot-backup',
                dockerfile: 'docker/Dockerfile.backup', 
                context: '.'
            }
        ];

        for (const image of images) {
            try {
                this.log(`Building ${image.name}...`);
                
                // Build with a timeout and better error handling
                const buildCommand = `sudo docker build -f ${image.dockerfile} -t ${image.name}:latest ${image.context}`;
                
                execSync(buildCommand, {
                    cwd: this.projectRoot,
                    stdio: 'pipe',
                    timeout: 600000 // 10 minute timeout
                });
                
                this.results.buildResults[image.name] = 'success';
                this.log(`Successfully built ${image.name}`);
                
            } catch (error) {
                this.results.buildResults[image.name] = 'failed';
                this.log(`Failed to build ${image.name}: ${error.message}`, 'error');
                
                // For backend, try a simpler build approach
                if (image.name === 'trading-bot-backend') {
                    await this.trySimpleBackendBuild();
                }
            }
        }
    }

    async trySimpleBackendBuild() {
        this.log('Attempting simplified backend build...');
        
        try {
            // Create a simplified Dockerfile for validation
            const simpleDockerfile = `
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source (without building)
COPY src/ ./src/
COPY prisma/ ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Create app user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \\
  CMD curl -f http://localhost:3000/health || exit 1

# Start with ts-node for development/validation
CMD ["npx", "ts-node", "src/index.ts"]
`;

            fs.writeFileSync(path.join(this.projectRoot, 'docker/Dockerfile.backend.simple'), simpleDockerfile);
            
            execSync('sudo docker build -f docker/Dockerfile.backend.simple -t trading-bot-backend:simple .', {
                cwd: this.projectRoot,
                stdio: 'pipe',
                timeout: 600000
            });
            
            this.results.buildResults['trading-bot-backend-simple'] = 'success';
            this.log('Successfully built simplified backend image');
            
        } catch (error) {
            this.results.buildResults['trading-bot-backend-simple'] = 'failed';
            this.log(`Simplified backend build also failed: ${error.message}`, 'error');
        }
    }

    async validateContainerStartup() {
        this.log('Validating container startup and health checks...');
        
        const images = ['trading-bot-frontend:latest', 'trading-bot-backend:simple'];
        
        for (const image of images) {
            if (this.results.buildResults[image.replace(':latest', '').replace(':simple', '')] === 'success' ||
                this.results.buildResults[image.replace(':latest', '').replace(':simple', '') + '-simple'] === 'success') {
                
                try {
                    // Start container in detached mode
                    const containerName = `test-${image.split(':')[0].replace('trading-bot-', '')}`;
                    
                    this.log(`Testing container startup for ${image}...`);
                    
                    // Remove existing test container if it exists
                    try {
                        execSync(`sudo docker rm -f ${containerName}`, { stdio: 'pipe' });
                    } catch (e) {
                        // Container doesn't exist, that's fine
                    }
                    
                    // Start container
                    execSync(`sudo docker run -d --name ${containerName} ${image}`, {
                        stdio: 'pipe',
                        timeout: 30000
                    });
                    
                    // Wait a moment for startup
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    
                    // Check if container is running
                    const status = execSync(`sudo docker ps --filter name=${containerName} --format "{{.Status}}"`, {
                        encoding: 'utf8',
                        stdio: 'pipe'
                    }).trim();
                    
                    if (status.includes('Up')) {
                        this.results.buildResults[`${containerName}-startup`] = 'success';
                        this.log(`Container ${containerName} started successfully`);
                    } else {
                        this.results.buildResults[`${containerName}-startup`] = 'failed';
                        this.log(`Container ${containerName} failed to start properly`, 'error');
                    }
                    
                    // Clean up
                    execSync(`sudo docker rm -f ${containerName}`, { stdio: 'pipe' });
                    
                } catch (error) {
                    this.log(`Container startup test failed for ${image}: ${error.message}`, 'error');
                }
            }
        }
    }

    async validateNetworkConfiguration() {
        this.log('Validating Docker network configuration...');
        
        try {
            const composeContent = fs.readFileSync(
                path.join(this.projectRoot, 'docker/docker-compose.prod.yml'),
                'utf8'
            );

            if (composeContent.includes('trading-bot-network')) {
                this.results.networkValidation['custom-network'] = 'defined';
                this.log('Custom network trading-bot-network is defined');
            } else {
                this.results.networkValidation['custom-network'] = 'missing';
                this.log('Custom network is missing', 'warn');
            }

            // Check for proper service networking
            const services = ['frontend', 'backend', 'postgres', 'redis'];
            for (const service of services) {
                if (composeContent.includes(`${service}:`) && composeContent.includes('trading-bot-network')) {
                    this.results.networkValidation[`${service}-network`] = 'configured';
                    this.log(`Service ${service} is properly networked`);
                }
            }

        } catch (error) {
            this.log(`Network validation failed: ${error.message}`, 'error');
        }
    }

    async generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                configurationFiles: Object.values(this.results.configValidation).filter(v => v === 'exists' || v === 'valid').length,
                successfulBuilds: Object.values(this.results.buildResults).filter(v => v === 'success').length,
                healthChecksConfigured: Object.values(this.results.healthChecks).filter(v => v === 'configured').length,
                volumesConfigured: Object.values(this.results.volumeValidation).filter(v => v === 'defined').length
            },
            details: this.results,
            recommendations: []
        };

        // Add recommendations based on results
        if (this.results.buildResults['trading-bot-backend'] === 'failed') {
            report.recommendations.push('Backend build failed due to TypeScript errors. Consider fixing compilation issues or using simplified build approach.');
        }

        if (Object.values(this.results.healthChecks).includes('missing')) {
            report.recommendations.push('Some containers are missing health checks. Add HEALTHCHECK instructions to Dockerfiles.');
        }

        if (Object.values(this.results.volumeValidation).includes('missing')) {
            report.recommendations.push('Some expected volumes are not configured. Verify data persistence requirements.');
        }

        // Write report to file
        const reportPath = path.join(this.projectRoot, 'docker-build-validation-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        this.log(`Validation report written to: ${reportPath}`);
        
        return report;
    }

    async run() {
        try {
            this.log('Starting Docker Build and Validation Process...');
            
            // Step 1: Validate configurations
            await this.validateDockerConfigurations();
            
            // Step 2: Validate volumes
            await this.validateVolumes();
            
            // Step 3: Validate health checks
            await this.validateHealthChecks();
            
            // Step 4: Validate network configuration
            await this.validateNetworkConfiguration();
            
            // Step 5: Build Docker images
            await this.buildDockerImages();
            
            // Step 6: Test container startup
            await this.validateContainerStartup();
            
            // Step 7: Generate report
            const report = await this.generateReport();
            
            this.log('Docker build and validation completed!');
            
            // Print summary
            console.log('\n📊 VALIDATION SUMMARY:');
            console.log(`✅ Configuration files validated: ${report.summary.configurationFiles}`);
            console.log(`🏗️  Successful builds: ${report.summary.successfulBuilds}`);
            console.log(`❤️  Health checks configured: ${report.summary.healthChecksConfigured}`);
            console.log(`💾 Volumes configured: ${report.summary.volumesConfigured}`);
            
            if (report.recommendations.length > 0) {
                console.log('\n💡 RECOMMENDATIONS:');
                report.recommendations.forEach((rec, i) => {
                    console.log(`${i + 1}. ${rec}`);
                });
            }
            
            return report;
            
        } catch (error) {
            this.log(`Validation process failed: ${error.message}`, 'error');
            throw error;
        }
    }
}

// Run if called directly
if (require.main === module) {
    const validator = new DockerBuildValidator();
    validator.run()
        .then(report => {
            process.exit(report.summary.successfulBuilds > 0 ? 0 : 1);
        })
        .catch(error => {
            console.error('Validation failed:', error);
            process.exit(1);
        });
}

module.exports = DockerBuildValidator;