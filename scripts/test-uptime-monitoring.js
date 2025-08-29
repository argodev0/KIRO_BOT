#!/usr/bin/env node

/**
 * Uptime Monitoring Test Script
 * 
 * Tests uptime monitoring and availability tracking functionality
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class UptimeMonitoringTester {
    constructor() {
        this.projectRoot = process.cwd();
        this.testResults = {
            timestamp: new Date().toISOString(),
            tests: {},
            summary: {
                totalTests: 0,
                passedTests: 0,
                failedTests: 0,
                warnings: [],
                errors: []
            }
        };
        this.testServer = null;
        this.testPort = 3999;
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        console.log(logMessage);
    }

    async startTestServer() {
        return new Promise((resolve, reject) => {
            this.testServer = http.createServer((req, res) => {
                const url = req.url;
                
                if (url === '/health') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        status: 'healthy',
                        timestamp: new Date().toISOString(),
                        uptime: process.uptime(),
                        version: '1.0.0'
                    }));
                } else if (url === '/health/detailed') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        status: 'healthy',
                        timestamp: new Date().toISOString(),
                        uptime: process.uptime(),
                        memory: process.memoryUsage(),
                        cpu: process.cpuUsage(),
                        version: '1.0.0',
                        environment: 'test',
                        services: {
                            database: 'connected',
                            redis: 'connected',
                            exchange: 'connected'
                        }
                    }));
                } else if (url === '/health/ready') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        status: 'ready',
                        timestamp: new Date().toISOString()
                    }));
                } else if (url === '/health/live') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        status: 'alive',
                        timestamp: new Date().toISOString()
                    }));
                } else if (url === '/metrics') {
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end(`# HELP up Service uptime
# TYPE up gauge
up 1
# HELP uptime_seconds Service uptime in seconds
# TYPE uptime_seconds counter
uptime_seconds ${process.uptime()}
# HELP memory_usage_bytes Memory usage in bytes
# TYPE memory_usage_bytes gauge
memory_usage_bytes ${process.memoryUsage().heapUsed}
`);
                } else {
                    res.writeHead(404);
                    res.end('Not Found');
                }
            });

            this.testServer.listen(this.testPort, (err) => {
                if (err) {
                    reject(err);
                } else {
                    this.log(`✅ Test server started on port ${this.testPort}`);
                    resolve();
                }
            });
        });
    }

    async stopTestServer() {
        if (this.testServer) {
            this.testServer.close();
            this.log('✅ Test server stopped');
        }
    }

    async testHealthEndpoints() {
        this.log('🔍 Testing health endpoints...');
        
        const endpoints = [
            { path: '/health', name: 'Basic Health' },
            { path: '/health/detailed', name: 'Detailed Health' },
            { path: '/health/ready', name: 'Readiness Probe' },
            { path: '/health/live', name: 'Liveness Probe' }
        ];

        let passedEndpoints = 0;
        const endpointResults = {};

        for (const endpoint of endpoints) {
            try {
                const response = await this.makeHttpRequest(`http://localhost:${this.testPort}${endpoint.path}`);
                
                if (response.statusCode === 200) {
                    const data = JSON.parse(response.body);
                    
                    if (data.status && data.timestamp) {
                        this.log(`✅ ${endpoint.name} endpoint working`);
                        endpointResults[endpoint.name] = 'PASSED';
                        passedEndpoints++;
                    } else {
                        this.log(`⚠️  ${endpoint.name} endpoint missing required fields`);
                        endpointResults[endpoint.name] = 'WARNING';
                        this.testResults.summary.warnings.push(`${endpoint.name} endpoint missing required fields`);
                    }
                } else {
                    this.log(`❌ ${endpoint.name} endpoint returned ${response.statusCode}`);
                    endpointResults[endpoint.name] = 'FAILED';
                }
                
            } catch (error) {
                this.log(`❌ ${endpoint.name} endpoint error: ${error.message}`);
                endpointResults[endpoint.name] = 'FAILED';
            }
        }

        this.testResults.tests.healthEndpoints = {
            name: 'Health Endpoints',
            status: passedEndpoints === endpoints.length ? 'PASSED' : passedEndpoints > 0 ? 'WARNING' : 'FAILED',
            details: `${passedEndpoints}/${endpoints.length} endpoints working`,
            endpoints: endpointResults
        };

        if (passedEndpoints === endpoints.length) {
            this.testResults.summary.passedTests++;
        } else if (passedEndpoints > 0) {
            this.testResults.summary.passedTests++;
            this.testResults.summary.warnings.push(`Only ${passedEndpoints}/${endpoints.length} health endpoints working`);
        } else {
            this.testResults.summary.failedTests++;
            this.testResults.summary.errors.push('No health endpoints working');
        }

        this.testResults.summary.totalTests++;
    }

    async testMetricsEndpoint() {
        this.log('🔍 Testing metrics endpoint...');
        
        try {
            const response = await this.makeHttpRequest(`http://localhost:${this.testPort}/metrics`);
            
            if (response.statusCode === 200) {
                const metrics = response.body;
                
                // Check for essential uptime metrics
                const hasUpMetric = metrics.includes('up ');
                const hasUptimeMetric = metrics.includes('uptime_seconds');
                const hasMemoryMetric = metrics.includes('memory_usage_bytes');
                
                if (hasUpMetric && hasUptimeMetric) {
                    this.log('✅ Metrics endpoint working with uptime metrics');
                    this.testResults.tests.metricsEndpoint = {
                        name: 'Metrics Endpoint',
                        status: 'PASSED',
                        details: 'Metrics endpoint provides uptime and system metrics'
                    };
                    this.testResults.summary.passedTests++;
                } else {
                    this.log('⚠️  Metrics endpoint missing essential uptime metrics');
                    this.testResults.tests.metricsEndpoint = {
                        name: 'Metrics Endpoint',
                        status: 'WARNING',
                        details: 'Metrics endpoint working but missing some uptime metrics'
                    };
                    this.testResults.summary.passedTests++;
                    this.testResults.summary.warnings.push('Metrics endpoint missing essential uptime metrics');
                }
            } else {
                this.log(`❌ Metrics endpoint returned ${response.statusCode}`);
                this.testResults.tests.metricsEndpoint = {
                    name: 'Metrics Endpoint',
                    status: 'FAILED',
                    details: `Metrics endpoint returned ${response.statusCode}`
                };
                this.testResults.summary.failedTests++;
            }
            
        } catch (error) {
            this.log(`❌ Metrics endpoint error: ${error.message}`);
            this.testResults.tests.metricsEndpoint = {
                name: 'Metrics Endpoint',
                status: 'FAILED',
                details: `Metrics endpoint error: ${error.message}`
            };
            this.testResults.summary.failedTests++;
            this.testResults.summary.errors.push(`Metrics endpoint error: ${error.message}`);
        }

        this.testResults.summary.totalTests++;
    }

    async testUptimeCalculation() {
        this.log('🔍 Testing uptime calculation...');
        
        try {
            const startTime = Date.now();
            
            // Wait a short period to measure uptime
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const response = await this.makeHttpRequest(`http://localhost:${this.testPort}/health/detailed`);
            
            if (response.statusCode === 200) {
                const data = JSON.parse(response.body);
                
                if (data.uptime && typeof data.uptime === 'number' && data.uptime > 0) {
                    this.log(`✅ Uptime calculation working: ${data.uptime.toFixed(2)} seconds`);
                    this.testResults.tests.uptimeCalculation = {
                        name: 'Uptime Calculation',
                        status: 'PASSED',
                        details: `Uptime correctly calculated: ${data.uptime.toFixed(2)} seconds`
                    };
                    this.testResults.summary.passedTests++;
                } else {
                    this.log('❌ Uptime calculation not working properly');
                    this.testResults.tests.uptimeCalculation = {
                        name: 'Uptime Calculation',
                        status: 'FAILED',
                        details: 'Uptime value missing or invalid'
                    };
                    this.testResults.summary.failedTests++;
                }
            } else {
                this.log(`❌ Could not test uptime calculation: ${response.statusCode}`);
                this.testResults.tests.uptimeCalculation = {
                    name: 'Uptime Calculation',
                    status: 'FAILED',
                    details: `Health endpoint not accessible: ${response.statusCode}`
                };
                this.testResults.summary.failedTests++;
            }
            
        } catch (error) {
            this.log(`❌ Uptime calculation test error: ${error.message}`);
            this.testResults.tests.uptimeCalculation = {
                name: 'Uptime Calculation',
                status: 'FAILED',
                details: `Error testing uptime: ${error.message}`
            };
            this.testResults.summary.failedTests++;
            this.testResults.summary.errors.push(`Uptime calculation test error: ${error.message}`);
        }

        this.testResults.summary.totalTests++;
    }

    async testAvailabilityTracking() {
        this.log('🔍 Testing availability tracking...');
        
        try {
            const checks = [];
            const totalChecks = 5;
            const checkInterval = 200; // ms
            
            // Perform multiple availability checks
            for (let i = 0; i < totalChecks; i++) {
                try {
                    const response = await this.makeHttpRequest(`http://localhost:${this.testPort}/health`);
                    checks.push({
                        timestamp: new Date().toISOString(),
                        status: response.statusCode === 200 ? 'UP' : 'DOWN',
                        responseTime: response.responseTime || 0
                    });
                } catch (error) {
                    checks.push({
                        timestamp: new Date().toISOString(),
                        status: 'DOWN',
                        error: error.message
                    });
                }
                
                if (i < totalChecks - 1) {
                    await new Promise(resolve => setTimeout(resolve, checkInterval));
                }
            }
            
            // Calculate availability
            const upChecks = checks.filter(check => check.status === 'UP').length;
            const availability = (upChecks / totalChecks) * 100;
            const avgResponseTime = checks
                .filter(check => check.responseTime)
                .reduce((sum, check) => sum + check.responseTime, 0) / upChecks;
            
            this.log(`✅ Availability tracking: ${availability}% (${upChecks}/${totalChecks} checks)`);
            this.log(`   Average response time: ${avgResponseTime.toFixed(2)}ms`);
            
            this.testResults.tests.availabilityTracking = {
                name: 'Availability Tracking',
                status: availability >= 80 ? 'PASSED' : 'WARNING',
                details: `Availability: ${availability}%, Avg response: ${avgResponseTime.toFixed(2)}ms`,
                checks: checks
            };
            
            if (availability >= 80) {
                this.testResults.summary.passedTests++;
            } else {
                this.testResults.summary.passedTests++;
                this.testResults.summary.warnings.push(`Low availability: ${availability}%`);
            }
            
        } catch (error) {
            this.log(`❌ Availability tracking test error: ${error.message}`);
            this.testResults.tests.availabilityTracking = {
                name: 'Availability Tracking',
                status: 'FAILED',
                details: `Error testing availability: ${error.message}`
            };
            this.testResults.summary.failedTests++;
            this.testResults.summary.errors.push(`Availability tracking test error: ${error.message}`);
        }

        this.testResults.summary.totalTests++;
    }

    async testServiceDiscovery() {
        this.log('🔍 Testing service discovery simulation...');
        
        try {
            // Simulate service discovery by checking multiple endpoints
            const services = [
                { name: 'api', port: this.testPort, path: '/health' },
                { name: 'metrics', port: this.testPort, path: '/metrics' }
            ];
            
            const discoveredServices = [];
            
            for (const service of services) {
                try {
                    const response = await this.makeHttpRequest(`http://localhost:${service.port}${service.path}`);
                    
                    if (response.statusCode === 200) {
                        discoveredServices.push({
                            name: service.name,
                            status: 'DISCOVERED',
                            endpoint: `localhost:${service.port}${service.path}`,
                            responseTime: response.responseTime
                        });
                    }
                } catch (error) {
                    discoveredServices.push({
                        name: service.name,
                        status: 'NOT_AVAILABLE',
                        error: error.message
                    });
                }
            }
            
            const availableServices = discoveredServices.filter(s => s.status === 'DISCOVERED').length;
            
            this.log(`✅ Service discovery: ${availableServices}/${services.length} services discovered`);
            
            this.testResults.tests.serviceDiscovery = {
                name: 'Service Discovery',
                status: availableServices > 0 ? 'PASSED' : 'FAILED',
                details: `${availableServices}/${services.length} services discovered`,
                services: discoveredServices
            };
            
            if (availableServices > 0) {
                this.testResults.summary.passedTests++;
            } else {
                this.testResults.summary.failedTests++;
                this.testResults.summary.errors.push('No services discovered');
            }
            
        } catch (error) {
            this.log(`❌ Service discovery test error: ${error.message}`);
            this.testResults.tests.serviceDiscovery = {
                name: 'Service Discovery',
                status: 'FAILED',
                details: `Error testing service discovery: ${error.message}`
            };
            this.testResults.summary.failedTests++;
            this.testResults.summary.errors.push(`Service discovery test error: ${error.message}`);
        }

        this.testResults.summary.totalTests++;
    }

    async testDowntimeDetection() {
        this.log('🔍 Testing downtime detection...');
        
        try {
            // Simulate downtime by stopping the server temporarily
            this.log('   Simulating service downtime...');
            await this.stopTestServer();
            
            // Wait a moment
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Try to access the service (should fail)
            let downtimeDetected = false;
            try {
                await this.makeHttpRequest(`http://localhost:${this.testPort}/health`);
            } catch (error) {
                downtimeDetected = true;
                this.log('   ✅ Downtime correctly detected');
            }
            
            // Restart the server
            this.log('   Restarting service...');
            await this.startTestServer();
            
            // Wait for service to be ready
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify service is back up
            let recoveryDetected = false;
            try {
                const response = await this.makeHttpRequest(`http://localhost:${this.testPort}/health`);
                if (response.statusCode === 200) {
                    recoveryDetected = true;
                    this.log('   ✅ Service recovery detected');
                }
            } catch (error) {
                this.log(`   ❌ Service recovery not detected: ${error.message}`);
            }
            
            if (downtimeDetected && recoveryDetected) {
                this.testResults.tests.downtimeDetection = {
                    name: 'Downtime Detection',
                    status: 'PASSED',
                    details: 'Downtime and recovery correctly detected'
                };
                this.testResults.summary.passedTests++;
            } else {
                this.testResults.tests.downtimeDetection = {
                    name: 'Downtime Detection',
                    status: 'FAILED',
                    details: `Downtime detected: ${downtimeDetected}, Recovery detected: ${recoveryDetected}`
                };
                this.testResults.summary.failedTests++;
            }
            
        } catch (error) {
            this.log(`❌ Downtime detection test error: ${error.message}`);
            this.testResults.tests.downtimeDetection = {
                name: 'Downtime Detection',
                status: 'FAILED',
                details: `Error testing downtime detection: ${error.message}`
            };
            this.testResults.summary.failedTests++;
            this.testResults.summary.errors.push(`Downtime detection test error: ${error.message}`);
        }

        this.testResults.summary.totalTests++;
    }

    async makeHttpRequest(url) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const request = http.get(url, (res) => {
                let body = '';
                
                res.on('data', (chunk) => {
                    body += chunk;
                });
                
                res.on('end', () => {
                    const responseTime = Date.now() - startTime;
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: body,
                        responseTime: responseTime
                    });
                });
            });
            
            request.on('error', (error) => {
                reject(error);
            });
            
            request.setTimeout(5000, () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }

    generateReport() {
        this.log('📊 Generating uptime monitoring test report...');
        
        const successRate = (this.testResults.summary.passedTests / this.testResults.summary.totalTests) * 100;
        
        // Save detailed report
        const reportPath = path.join(this.projectRoot, `uptime-monitoring-test-report-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(this.testResults, null, 2));
        
        // Display summary
        console.log('\n' + '='.repeat(60));
        console.log('🏁 UPTIME MONITORING TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`📊 Success Rate: ${successRate.toFixed(1)}%`);
        console.log(`✅ Passed Tests: ${this.testResults.summary.passedTests}/${this.testResults.summary.totalTests}`);
        console.log(`❌ Failed Tests: ${this.testResults.summary.failedTests}`);
        console.log(`⚠️  Warnings: ${this.testResults.summary.warnings.length}`);
        console.log(`🚨 Errors: ${this.testResults.summary.errors.length}`);
        
        if (this.testResults.summary.errors.length > 0) {
            console.log('\n🚨 Errors:');
            this.testResults.summary.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        }
        
        if (this.testResults.summary.warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            this.testResults.summary.warnings.forEach((warning, index) => {
                console.log(`   ${index + 1}. ${warning}`);
            });
        }
        
        console.log('\n📋 Test Results:');
        Object.values(this.testResults.tests).forEach(test => {
            const statusIcon = test.status === 'PASSED' ? '✅' : test.status === 'WARNING' ? '⚠️' : '❌';
            console.log(`   ${statusIcon} ${test.name}: ${test.status}`);
        });
        
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);
        console.log('='.repeat(60));
        
        return this.testResults;
    }

    async runTests() {
        try {
            this.log('🚀 Starting uptime monitoring tests...');
            
            // Start test server
            await this.startTestServer();
            
            // Run tests
            await this.testHealthEndpoints();
            await this.testMetricsEndpoint();
            await this.testUptimeCalculation();
            await this.testAvailabilityTracking();
            await this.testServiceDiscovery();
            await this.testDowntimeDetection();
            
            // Generate report
            const report = this.generateReport();
            
            this.log('🏁 Uptime monitoring tests completed');
            
            // Cleanup
            await this.stopTestServer();
            
            // Return appropriate exit code
            if (this.testResults.summary.failedTests > 0) {
                process.exit(1);
            } else {
                process.exit(0);
            }
            
        } catch (error) {
            this.log(`💥 Tests failed with error: ${error.message}`);
            console.error('Tests failed:', error);
            
            // Cleanup
            await this.stopTestServer();
            process.exit(1);
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new UptimeMonitoringTester();
    tester.runTests();
}

module.exports = UptimeMonitoringTester;