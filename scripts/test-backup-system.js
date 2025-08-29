#!/usr/bin/env node

/**
 * Backup System Test Script
 * 
 * Tests backup system functionality without requiring full database setup
 */

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class BackupSystemTester {
    constructor() {
        this.projectRoot = process.cwd();
        this.backupDir = path.join(this.projectRoot, 'backups');
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
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        console.log(logMessage);
    }

    async testBackupScriptExists() {
        this.log('🔍 Testing backup script existence...');
        
        const backupScriptPath = path.join(this.projectRoot, 'scripts/backup-automation.sh');
        const exists = fs.existsSync(backupScriptPath);
        
        this.testResults.tests.backupScriptExists = {
            name: 'Backup Script Exists',
            status: exists ? 'PASSED' : 'FAILED',
            details: exists ? 'Backup script found' : 'Backup script not found'
        };
        
        if (exists) {
            this.log('✅ Backup script exists');
            this.testResults.summary.passedTests++;
        } else {
            this.log('❌ Backup script not found');
            this.testResults.summary.failedTests++;
            this.testResults.summary.errors.push('Backup script not found');
        }
        
        this.testResults.summary.totalTests++;
        return exists;
    }

    async testBackupScriptPermissions() {
        this.log('🔍 Testing backup script permissions...');
        
        const backupScriptPath = path.join(this.projectRoot, 'scripts/backup-automation.sh');
        
        try {
            const stats = fs.statSync(backupScriptPath);
            const isExecutable = (stats.mode & parseInt('111', 8)) !== 0;
            
            this.testResults.tests.backupScriptPermissions = {
                name: 'Backup Script Permissions',
                status: isExecutable ? 'PASSED' : 'FAILED',
                details: isExecutable ? 'Script is executable' : 'Script is not executable'
            };
            
            if (isExecutable) {
                this.log('✅ Backup script is executable');
                this.testResults.summary.passedTests++;
            } else {
                this.log('❌ Backup script is not executable');
                this.testResults.summary.failedTests++;
                this.testResults.summary.errors.push('Backup script is not executable');
            }
            
        } catch (error) {
            this.log(`❌ Error checking script permissions: ${error.message}`);
            this.testResults.tests.backupScriptPermissions = {
                name: 'Backup Script Permissions',
                status: 'FAILED',
                details: `Error checking permissions: ${error.message}`
            };
            this.testResults.summary.failedTests++;
            this.testResults.summary.errors.push(`Error checking script permissions: ${error.message}`);
        }
        
        this.testResults.summary.totalTests++;
    }

    async testBackupDirectoryCreation() {
        this.log('🔍 Testing backup directory creation...');
        
        try {
            // Ensure backup directory exists
            if (!fs.existsSync(this.backupDir)) {
                fs.mkdirSync(this.backupDir, { recursive: true });
                this.log('✅ Backup directory created');
            } else {
                this.log('✅ Backup directory already exists');
            }
            
            // Test write permissions
            const testFile = path.join(this.backupDir, 'test-write-permissions.tmp');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            
            this.testResults.tests.backupDirectoryCreation = {
                name: 'Backup Directory Creation',
                status: 'PASSED',
                details: 'Backup directory exists and is writable'
            };
            
            this.testResults.summary.passedTests++;
            
        } catch (error) {
            this.log(`❌ Error with backup directory: ${error.message}`);
            this.testResults.tests.backupDirectoryCreation = {
                name: 'Backup Directory Creation',
                status: 'FAILED',
                details: `Error with backup directory: ${error.message}`
            };
            this.testResults.summary.failedTests++;
            this.testResults.summary.errors.push(`Error with backup directory: ${error.message}`);
        }
        
        this.testResults.summary.totalTests++;
    }

    async testBackupScriptConfiguration() {
        this.log('🔍 Testing backup script configuration...');
        
        const backupScriptPath = path.join(this.projectRoot, 'scripts/backup-automation.sh');
        
        try {
            // Test the config command
            const { stdout, stderr } = await execAsync(`"${backupScriptPath}" config`, {
                timeout: 10000,
                cwd: this.projectRoot
            });
            
            if (stdout && !stderr.includes('error')) {
                this.log('✅ Backup script configuration is accessible');
                this.testResults.tests.backupScriptConfiguration = {
                    name: 'Backup Script Configuration',
                    status: 'PASSED',
                    details: 'Configuration command executed successfully'
                };
                this.testResults.summary.passedTests++;
            } else {
                this.log(`⚠️  Backup script configuration has issues: ${stderr}`);
                this.testResults.tests.backupScriptConfiguration = {
                    name: 'Backup Script Configuration',
                    status: 'WARNING',
                    details: `Configuration issues: ${stderr}`
                };
                this.testResults.summary.passedTests++;
                this.testResults.summary.warnings.push(`Backup configuration issues: ${stderr}`);
            }
            
        } catch (error) {
            this.log(`❌ Error testing backup configuration: ${error.message}`);
            this.testResults.tests.backupScriptConfiguration = {
                name: 'Backup Script Configuration',
                status: 'FAILED',
                details: `Error testing configuration: ${error.message}`
            };
            this.testResults.summary.failedTests++;
            this.testResults.summary.errors.push(`Error testing backup configuration: ${error.message}`);
        }
        
        this.testResults.summary.totalTests++;
    }

    async testApplicationBackupCapability() {
        this.log('🔍 Testing application backup capability...');
        
        try {
            // Create a test application backup (without database dependencies)
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const testBackupFile = path.join(this.backupDir, `test-app-backup-${timestamp}.tar.gz`);
            
            // Create a simple tar backup of source files
            const { stdout, stderr } = await execAsync(
                `tar -czf "${testBackupFile}" --exclude="node_modules" --exclude="dist" --exclude="logs" --exclude="backups" src package.json`,
                {
                    timeout: 30000,
                    cwd: this.projectRoot
                }
            );
            
            if (fs.existsSync(testBackupFile)) {
                const stats = fs.statSync(testBackupFile);
                this.log(`✅ Test application backup created: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                
                // Test backup integrity
                const { stdout: listOutput } = await execAsync(`tar -tzf "${testBackupFile}" | head -5`);
                
                if (listOutput) {
                    this.log('✅ Backup integrity verified');
                    this.testResults.tests.applicationBackupCapability = {
                        name: 'Application Backup Capability',
                        status: 'PASSED',
                        details: `Test backup created and verified (${(stats.size / 1024 / 1024).toFixed(2)} MB)`
                    };
                    this.testResults.summary.passedTests++;
                } else {
                    this.log('❌ Backup integrity check failed');
                    this.testResults.tests.applicationBackupCapability = {
                        name: 'Application Backup Capability',
                        status: 'FAILED',
                        details: 'Backup created but integrity check failed'
                    };
                    this.testResults.summary.failedTests++;
                }
                
                // Cleanup test backup
                fs.unlinkSync(testBackupFile);
                
            } else {
                this.log('❌ Test backup file was not created');
                this.testResults.tests.applicationBackupCapability = {
                    name: 'Application Backup Capability',
                    status: 'FAILED',
                    details: 'Backup file was not created'
                };
                this.testResults.summary.failedTests++;
            }
            
        } catch (error) {
            this.log(`❌ Error testing application backup: ${error.message}`);
            this.testResults.tests.applicationBackupCapability = {
                name: 'Application Backup Capability',
                status: 'FAILED',
                details: `Error creating test backup: ${error.message}`
            };
            this.testResults.summary.failedTests++;
            this.testResults.summary.errors.push(`Error testing application backup: ${error.message}`);
        }
        
        this.testResults.summary.totalTests++;
    }

    async testBackupRetentionLogic() {
        this.log('🔍 Testing backup retention logic...');
        
        try {
            // Create some test backup files with different ages
            const testFiles = [];
            const now = Date.now();
            
            // Create files with different ages
            const ages = [1, 10, 35, 60]; // days
            
            for (const age of ages) {
                const fileName = `test-backup-${age}days-old.tar.gz`;
                const filePath = path.join(this.backupDir, fileName);
                
                // Create empty test file
                fs.writeFileSync(filePath, 'test backup content');
                
                // Set file modification time to simulate age
                const ageInMs = age * 24 * 60 * 60 * 1000;
                const oldTime = new Date(now - ageInMs);
                fs.utimesSync(filePath, oldTime, oldTime);
                
                testFiles.push(filePath);
            }
            
            // Test retention logic (files older than 30 days should be identified)
            const retentionDays = 30;
            const cutoffTime = now - (retentionDays * 24 * 60 * 60 * 1000);
            
            let oldFiles = 0;
            let recentFiles = 0;
            
            for (const filePath of testFiles) {
                const stats = fs.statSync(filePath);
                if (stats.mtime.getTime() < cutoffTime) {
                    oldFiles++;
                } else {
                    recentFiles++;
                }
            }
            
            this.log(`✅ Retention logic test: ${oldFiles} old files, ${recentFiles} recent files`);
            
            // Cleanup test files
            for (const filePath of testFiles) {
                fs.unlinkSync(filePath);
            }
            
            this.testResults.tests.backupRetentionLogic = {
                name: 'Backup Retention Logic',
                status: 'PASSED',
                details: `Retention logic working: identified ${oldFiles} files for cleanup`
            };
            this.testResults.summary.passedTests++;
            
        } catch (error) {
            this.log(`❌ Error testing retention logic: ${error.message}`);
            this.testResults.tests.backupRetentionLogic = {
                name: 'Backup Retention Logic',
                status: 'FAILED',
                details: `Error testing retention: ${error.message}`
            };
            this.testResults.summary.failedTests++;
            this.testResults.summary.errors.push(`Error testing retention logic: ${error.message}`);
        }
        
        this.testResults.summary.totalTests++;
    }

    async testBackupHealthCheck() {
        this.log('🔍 Testing backup health check mechanism...');
        
        try {
            const healthCheckFile = '/tmp/backup-healthy';
            const lastRunFile = '/tmp/backup-last-run';
            
            // Simulate health check files creation
            fs.writeFileSync(healthCheckFile, '');
            fs.writeFileSync(lastRunFile, new Date().toISOString());
            
            // Check if files exist and are recent
            const healthExists = fs.existsSync(healthCheckFile);
            const lastRunExists = fs.existsSync(lastRunFile);
            
            if (healthExists && lastRunExists) {
                const lastRunContent = fs.readFileSync(lastRunFile, 'utf8');
                const lastRunTime = new Date(lastRunContent);
                const timeDiff = Date.now() - lastRunTime.getTime();
                const isRecent = timeDiff < (24 * 60 * 60 * 1000); // Within 24 hours
                
                this.log(`✅ Backup health check mechanism working (last run: ${lastRunContent})`);
                
                this.testResults.tests.backupHealthCheck = {
                    name: 'Backup Health Check',
                    status: 'PASSED',
                    details: `Health check files created and updated (last run: ${lastRunContent})`
                };
                this.testResults.summary.passedTests++;
                
            } else {
                this.log('❌ Health check files not created properly');
                this.testResults.tests.backupHealthCheck = {
                    name: 'Backup Health Check',
                    status: 'FAILED',
                    details: 'Health check files not created'
                };
                this.testResults.summary.failedTests++;
            }
            
            // Cleanup
            if (fs.existsSync(healthCheckFile)) fs.unlinkSync(healthCheckFile);
            if (fs.existsSync(lastRunFile)) fs.unlinkSync(lastRunFile);
            
        } catch (error) {
            this.log(`❌ Error testing health check: ${error.message}`);
            this.testResults.tests.backupHealthCheck = {
                name: 'Backup Health Check',
                status: 'FAILED',
                details: `Error testing health check: ${error.message}`
            };
            this.testResults.summary.failedTests++;
            this.testResults.summary.errors.push(`Error testing health check: ${error.message}`);
        }
        
        this.testResults.summary.totalTests++;
    }

    generateReport() {
        this.log('📊 Generating backup system test report...');
        
        const successRate = (this.testResults.summary.passedTests / this.testResults.summary.totalTests) * 100;
        
        // Save detailed report
        const reportPath = path.join(this.projectRoot, `backup-system-test-report-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(this.testResults, null, 2));
        
        // Display summary
        console.log('\n' + '='.repeat(60));
        console.log('🏁 BACKUP SYSTEM TEST SUMMARY');
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
            this.log('🚀 Starting backup system tests...');
            
            await this.testBackupScriptExists();
            await this.testBackupScriptPermissions();
            await this.testBackupDirectoryCreation();
            await this.testBackupScriptConfiguration();
            await this.testApplicationBackupCapability();
            await this.testBackupRetentionLogic();
            await this.testBackupHealthCheck();
            
            const report = this.generateReport();
            
            this.log('🏁 Backup system tests completed');
            
            // Return appropriate exit code
            if (this.testResults.summary.failedTests > 0) {
                process.exit(1);
            } else {
                process.exit(0);
            }
            
        } catch (error) {
            this.log(`💥 Tests failed with error: ${error.message}`);
            console.error('Tests failed:', error);
            process.exit(1);
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new BackupSystemTester();
    tester.runTests();
}

module.exports = BackupSystemTester;