#!/usr/bin/env node

/**
 * Docker Data Persistence and Restart Policy Validation Script
 * 
 * This script validates data persistence configurations and restart policies
 * for the production deployment execution task.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class DockerPersistenceValidator {
    constructor() {
        this.projectRoot = process.cwd();
        this.results = {
            volumeTests: {},
            restartPolicyTests: {},
            healthCheckTests: {},
            networkTests: {}
        };
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async validateVolumePersistence() {
        this.log('Testing Docker volume persistence...');
        
        const volumeTests = [
            {
                name: 'postgres_data',
                service: 'postgres',
                testPath: '/var/lib/postgresql/data',
                description: 'PostgreSQL data persistence'
            },
            {
                name: 'redis_data', 
                service: 'redis',
                testPath: '/data',
                description: 'Redis data persistence'
            },
            {
                name: 'rabbitmq_data',
                service: 'rabbitmq', 
                testPath: '/var/lib/rabbitmq',
                description: 'RabbitMQ data persistence'
            },
            {
                name: 'backend_logs',
                service: 'backend',
                testPath: '/app/logs',
                description: 'Backend logs persistence'
            }
        ];

        for (const test of volumeTests) {
            try {
                // Check if volume is defined in docker-compose
                const composeContent = fs.readFileSync(
                    path.join(this.projectRoot, 'docker/docker-compose.prod.yml'),
                    'utf8'
                );

                if (composeContent.includes(`${test.name}:`)) {
                    this.results.volumeTests[test.name] = {
                        defined: true,
                        service: test.service,
                        testPath: test.testPath,
                        description: test.description,
                        status: 'configured'
                    };
                    this.log(`Volume ${test.name} is properly configured for ${test.description}`);
                } else {
                    this.results.volumeTests[test.name] = {
                        defined: false,
                        status: 'missing'
                    };
                    this.log(`Volume ${test.name} is missing from configuration`, 'warn');
                }

            } catch (error) {
                this.results.volumeTests[test.name] = {
                    defined: false,
                    status: 'error',
                    error: error.message
                };
                this.log(`Error testing volume ${test.name}: ${error.message}`, 'error');
            }
        }
    }

    async validateRestartPolicies() {
        this.log('Validating Docker restart policies...');
        
        try {
            const composeContent = fs.readFileSync(
                path.join(this.projectRoot, 'docker/docker-compose.prod.yml'),
                'utf8'
            );

            const services = ['frontend', 'backend', 'postgres', 'redis', 'rabbitmq', 'prometheus', 'grafana'];
            
            for (const service of services) {
                // Look for restart policy in service definition
                const serviceRegex = new RegExp(`${service}:[\\s\\S]*?restart:\\s*(\\S+)`, 'i');
                const match = composeContent.match(serviceRegex);
                
                if (match) {
                    const restartPolicy = match[1];
                    this.results.restartPolicyTests[service] = {
                        configured: true,
                        policy: restartPolicy,
                        status: restartPolicy === 'unless-stopped' ? 'optimal' : 'configured'
                    };
                    this.log(`Service ${service} has restart policy: ${restartPolicy}`);
                } else {
                    this.results.restartPolicyTests[service] = {
                        configured: false,
                        status: 'missing'
                    };
                    this.log(`Service ${service} is missing restart policy`, 'warn');
                }
            }

        } catch (error) {
            this.log(`Error validating restart policies: ${error.message}`, 'error');
        }
    }

    async validateHealthChecks() {
        this.log('Validating health check configurations...');
        
        try {
            const composeContent = fs.readFileSync(
                path.join(this.projectRoot, 'docker/docker-compose.prod.yml'),
                'utf8'
            );

            const services = ['frontend', 'backend', 'postgres', 'redis', 'rabbitmq'];
            
            for (const service of services) {
                // Look for healthcheck in service definition
                const healthcheckRegex = new RegExp(`${service}:[\\s\\S]*?healthcheck:`, 'i');
                const match = composeContent.match(healthcheckRegex);
                
                if (match) {
                    this.results.healthCheckTests[service] = {
                        configured: true,
                        status: 'configured'
                    };
                    this.log(`Service ${service} has health check configured`);
                } else {
                    this.results.healthCheckTests[service] = {
                        configured: false,
                        status: 'missing'
                    };
                    this.log(`Service ${service} is missing health check`, 'warn');
                }
            }

        } catch (error) {
            this.log(`Error validating health checks: ${error.message}`, 'error');
        }
    }

    async validateNetworkConfiguration() {
        this.log('Validating Docker network configuration...');
        
        try {
            const composeContent = fs.readFileSync(
                path.join(this.projectRoot, 'docker/docker-compose.prod.yml'),
                'utf8'
            );

            // Check for custom network definition
            if (composeContent.includes('trading-bot-network:')) {
                this.results.networkTests['custom-network'] = {
                    defined: true,
                    status: 'configured'
                };
                this.log('Custom network trading-bot-network is defined');
            } else {
                this.results.networkTests['custom-network'] = {
                    defined: false,
                    status: 'missing'
                };
                this.log('Custom network is missing', 'warn');
            }

            // Check service network assignments
            const services = ['frontend', 'backend', 'postgres', 'redis', 'rabbitmq'];
            for (const service of services) {
                const networkRegex = new RegExp(`${service}:[\\s\\S]*?networks:[\\s\\S]*?- trading-bot-network`, 'i');
                const match = composeContent.match(networkRegex);
                
                if (match) {
                    this.results.networkTests[`${service}-network`] = {
                        assigned: true,
                        status: 'configured'
                    };
                    this.log(`Service ${service} is assigned to custom network`);
                } else {
                    this.results.networkTests[`${service}-network`] = {
                        assigned: false,
                        status: 'missing'
                    };
                    this.log(`Service ${service} is not assigned to custom network`, 'warn');
                }
            }

        } catch (error) {
            this.log(`Error validating network configuration: ${error.message}`, 'error');
        }
    }

    async testContainerDependencies() {
        this.log('Validating container dependencies...');
        
        try {
            const composeContent = fs.readFileSync(
                path.join(this.projectRoot, 'docker/docker-compose.prod.yml'),
                'utf8'
            );

            const dependencyTests = [
                {
                    service: 'backend',
                    expectedDeps: ['postgres', 'redis', 'rabbitmq'],
                    description: 'Backend service dependencies'
                },
                {
                    service: 'frontend', 
                    expectedDeps: ['backend'],
                    description: 'Frontend service dependencies'
                }
            ];

            for (const test of dependencyTests) {
                const serviceRegex = new RegExp(`${test.service}:[\\s\\S]*?depends_on:([\\s\\S]*?)(?=\\n\\s{0,2}\\w|\\n\\n|$)`, 'i');
                const match = composeContent.match(serviceRegex);
                
                if (match) {
                    const dependsOnSection = match[1];
                    const foundDeps = [];
                    
                    for (const dep of test.expectedDeps) {
                        if (dependsOnSection.includes(dep)) {
                            foundDeps.push(dep);
                        }
                    }
                    
                    this.results.networkTests[`${test.service}-dependencies`] = {
                        configured: true,
                        expected: test.expectedDeps,
                        found: foundDeps,
                        status: foundDeps.length === test.expectedDeps.length ? 'complete' : 'partial'
                    };
                    
                    this.log(`${test.description}: ${foundDeps.length}/${test.expectedDeps.length} dependencies configured`);
                } else {
                    this.results.networkTests[`${test.service}-dependencies`] = {
                        configured: false,
                        status: 'missing'
                    };
                    this.log(`${test.description}: No dependencies configured`, 'warn');
                }
            }

        } catch (error) {
            this.log(`Error validating dependencies: ${error.message}`, 'error');
        }
    }

    async generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                volumesConfigured: Object.values(this.results.volumeTests).filter(v => v.status === 'configured').length,
                restartPoliciesConfigured: Object.values(this.results.restartPolicyTests).filter(v => v.configured).length,
                healthChecksConfigured: Object.values(this.results.healthCheckTests).filter(v => v.configured).length,
                networkConfigured: Object.values(this.results.networkTests).filter(v => v.status === 'configured' || v.assigned).length
            },
            details: this.results,
            recommendations: []
        };

        // Add recommendations based on results
        const missingVolumes = Object.entries(this.results.volumeTests).filter(([_, v]) => v.status !== 'configured');
        if (missingVolumes.length > 0) {
            report.recommendations.push(`${missingVolumes.length} volumes are not properly configured for data persistence.`);
        }

        const missingRestartPolicies = Object.entries(this.results.restartPolicyTests).filter(([_, v]) => !v.configured);
        if (missingRestartPolicies.length > 0) {
            report.recommendations.push(`${missingRestartPolicies.length} services are missing restart policies.`);
        }

        const missingHealthChecks = Object.entries(this.results.healthCheckTests).filter(([_, v]) => !v.configured);
        if (missingHealthChecks.length > 0) {
            report.recommendations.push(`${missingHealthChecks.length} services are missing health checks.`);
        }

        // Write report to file
        const reportPath = path.join(this.projectRoot, 'docker-persistence-validation-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        this.log(`Persistence validation report written to: ${reportPath}`);
        
        return report;
    }

    async run() {
        try {
            this.log('Starting Docker Persistence and Configuration Validation...');
            
            // Step 1: Validate volume persistence
            await this.validateVolumePersistence();
            
            // Step 2: Validate restart policies
            await this.validateRestartPolicies();
            
            // Step 3: Validate health checks
            await this.validateHealthChecks();
            
            // Step 4: Validate network configuration
            await this.validateNetworkConfiguration();
            
            // Step 5: Test container dependencies
            await this.testContainerDependencies();
            
            // Step 6: Generate report
            const report = await this.generateReport();
            
            this.log('Docker persistence and configuration validation completed!');
            
            // Print summary
            console.log('\n📊 PERSISTENCE VALIDATION SUMMARY:');
            console.log(`💾 Volumes configured: ${report.summary.volumesConfigured}`);
            console.log(`🔄 Restart policies configured: ${report.summary.restartPoliciesConfigured}`);
            console.log(`❤️  Health checks configured: ${report.summary.healthChecksConfigured}`);
            console.log(`🌐 Network configurations: ${report.summary.networkConfigured}`);
            
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
    const validator = new DockerPersistenceValidator();
    validator.run()
        .then(report => {
            const totalIssues = report.recommendations.length;
            process.exit(totalIssues === 0 ? 0 : 1);
        })
        .catch(error => {
            console.error('Validation failed:', error);
            process.exit(1);
        });
}

module.exports = DockerPersistenceValidator;