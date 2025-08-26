#!/usr/bin/env node

/**
 * Environment Readiness Validation Script
 * 
 * This script validates that the environment is ready for production deployment
 * after Node.js and Docker have been installed.
 * 
 * Requirements: 1.1, 1.3, 1.5
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class EnvironmentValidator {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      phase: 'environment-validation',
      validations: {},
      passed: 0,
      failed: 0,
      warnings: 0,
      ready: false
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: '\x1b[36m',    // Cyan
      success: '\x1b[32m', // Green
      warning: '\x1b[33m', // Yellow
      error: '\x1b[31m',   // Red
      reset: '\x1b[0m'     // Reset
    };
    
    const color = colors[type] || colors.info;
    console.log(`${color}[${timestamp}] [${type.toUpperCase()}] ${message}${colors.reset}`);
  }

  async executeCommand(command, options = {}) {
    try {
      const result = execSync(command, { 
        encoding: 'utf8', 
        stdio: options.silent ? 'pipe' : 'inherit',
        timeout: options.timeout || 30000,
        ...options 
      });
      return { success: true, output: result.trim() };
    } catch (error) {
      return { 
        success: false, 
        error: error.message, 
        output: (error.stdout || error.stderr || '').trim()
      };
    }
  }

  compareVersions(version1, version2) {
    const v1parts = version1.split('.').map(Number);
    const v2parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;
      
      if (v1part > v2part) return 1;
      if (v1part < v2part) return -1;
    }
    return 0;
  }

  async validateNodeJS() {
    this.log('=== Node.js Validation ===');
    
    const validation = {
      name: 'Node.js',
      tests: {},
      passed: true,
      critical: true
    };

    // Test Node.js installation
    const nodeTest = await this.executeCommand('node --version', { silent: true });
    validation.tests.installation = {
      name: 'Node.js Installation',
      passed: nodeTest.success,
      output: nodeTest.output,
      error: nodeTest.error
    };

    if (nodeTest.success) {
      const version = nodeTest.output.replace('v', '');
      const isCompatible = this.compareVersions(version, '18.0.0') >= 0;
      
      validation.tests.version = {
        name: 'Node.js Version Compatibility',
        passed: isCompatible,
        output: `v${version} (required: >=18.0.0)`,
        version: version,
        required: '18.0.0'
      };

      if (isCompatible) {
        this.log(`✓ Node.js v${version} is compatible`);
      } else {
        this.log(`✗ Node.js v${version} is incompatible (required: >=18.0.0)`, 'error');
        validation.passed = false;
      }
    } else {
      this.log('✗ Node.js is not installed', 'error');
      validation.passed = false;
    }

    // Test npm installation
    const npmTest = await this.executeCommand('npm --version', { silent: true });
    validation.tests.npm = {
      name: 'npm Installation',
      passed: npmTest.success,
      output: npmTest.output,
      error: npmTest.error
    };

    if (npmTest.success) {
      this.log(`✓ npm v${npmTest.output} is available`);
    } else {
      this.log('✗ npm is not available', 'error');
      validation.passed = false;
    }

    this.results.validations.nodejs = validation;
    if (validation.passed) {
      this.results.passed++;
    } else {
      this.results.failed++;
    }

    return validation.passed;
  }

  async validateDocker() {
    this.log('=== Docker Validation ===');
    
    const validation = {
      name: 'Docker',
      tests: {},
      passed: true,
      critical: true
    };

    // Test Docker installation
    const dockerTest = await this.executeCommand('docker --version', { silent: true });
    validation.tests.installation = {
      name: 'Docker Installation',
      passed: dockerTest.success,
      output: dockerTest.output,
      error: dockerTest.error
    };

    if (dockerTest.success) {
      this.log(`✓ Docker is installed: ${dockerTest.output}`);
    } else {
      this.log('✗ Docker is not installed', 'error');
      validation.passed = false;
    }

    // Test Docker service
    const dockerServiceTest = await this.executeCommand('docker info', { silent: true });
    validation.tests.service = {
      name: 'Docker Service',
      passed: dockerServiceTest.success,
      output: dockerServiceTest.success ? 'Docker daemon is running' : dockerServiceTest.error
    };

    if (dockerServiceTest.success) {
      this.log('✓ Docker daemon is running');
    } else {
      this.log('✗ Docker daemon is not accessible', 'error');
      validation.passed = false;
    }

    // Test Docker permissions (user in docker group)
    const dockerPermTest = await this.executeCommand('docker ps', { silent: true });
    validation.tests.permissions = {
      name: 'Docker Permissions',
      passed: dockerPermTest.success,
      output: dockerPermTest.success ? 'User can access Docker without sudo' : 'User needs sudo for Docker'
    };

    if (dockerPermTest.success) {
      this.log('✓ User can access Docker without sudo');
    } else {
      this.log('⚠ User may need sudo for Docker (check group membership)', 'warning');
      this.results.warnings++;
    }

    this.results.validations.docker = validation;
    if (validation.passed) {
      this.results.passed++;
    } else {
      this.results.failed++;
    }

    return validation.passed;
  }

  async validateDockerCompose() {
    this.log('=== Docker Compose Validation ===');
    
    const validation = {
      name: 'Docker Compose',
      tests: {},
      passed: false,
      critical: true
    };

    // Test Docker Compose (standalone)
    const composeTest = await this.executeCommand('docker-compose --version', { silent: true });
    validation.tests.standalone = {
      name: 'Docker Compose (standalone)',
      passed: composeTest.success,
      output: composeTest.output,
      error: composeTest.error
    };

    // Test Docker Compose (plugin)
    const composePluginTest = await this.executeCommand('docker compose version', { silent: true });
    validation.tests.plugin = {
      name: 'Docker Compose (plugin)',
      passed: composePluginTest.success,
      output: composePluginTest.output,
      error: composePluginTest.error
    };

    if (composeTest.success) {
      this.log(`✓ Docker Compose (standalone) is available: ${composeTest.output}`);
      validation.passed = true;
    } else if (composePluginTest.success) {
      this.log(`✓ Docker Compose (plugin) is available: ${composePluginTest.output}`);
      validation.passed = true;
    } else {
      this.log('✗ Docker Compose is not available', 'error');
    }

    this.results.validations.dockerCompose = validation;
    if (validation.passed) {
      this.results.passed++;
    } else {
      this.results.failed++;
    }

    return validation.passed;
  }

  async validateProjectStructure() {
    this.log('=== Project Structure Validation ===');
    
    const validation = {
      name: 'Project Structure',
      tests: {},
      passed: true,
      critical: false
    };

    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'docker/docker-compose.prod.yml',
      '.env.production.template',
      'scripts/deploy-production.sh'
    ];

    const requiredDirectories = [
      'src',
      'docker',
      'scripts',
      'monitoring'
    ];

    // Check required files
    for (const file of requiredFiles) {
      const exists = fs.existsSync(path.join(process.cwd(), file));
      validation.tests[`file_${file.replace(/[^a-zA-Z0-9]/g, '_')}`] = {
        name: `Required file: ${file}`,
        passed: exists,
        output: exists ? 'File exists' : 'File missing'
      };

      if (exists) {
        this.log(`✓ ${file} exists`);
      } else {
        this.log(`✗ ${file} is missing`, 'error');
        validation.passed = false;
      }
    }

    // Check required directories
    for (const dir of requiredDirectories) {
      const exists = fs.existsSync(path.join(process.cwd(), dir));
      validation.tests[`dir_${dir}`] = {
        name: `Required directory: ${dir}`,
        passed: exists,
        output: exists ? 'Directory exists' : 'Directory missing'
      };

      if (exists) {
        this.log(`✓ ${dir}/ directory exists`);
      } else {
        this.log(`✗ ${dir}/ directory is missing`, 'error');
        validation.passed = false;
      }
    }

    this.results.validations.projectStructure = validation;
    if (validation.passed) {
      this.results.passed++;
    } else {
      this.results.failed++;
    }

    return validation.passed;
  }

  async validateSystemResources() {
    this.log('=== System Resources Validation ===');
    
    const validation = {
      name: 'System Resources',
      tests: {},
      passed: true,
      critical: false
    };

    // Check available disk space
    const diskTest = await this.executeCommand('df -h .', { silent: true });
    if (diskTest.success) {
      const lines = diskTest.output.split('\n');
      const dataLine = lines[1];
      const parts = dataLine.split(/\s+/);
      const available = parts[3];
      
      validation.tests.diskSpace = {
        name: 'Disk Space',
        passed: true,
        output: `Available: ${available}`
      };
      
      this.log(`✓ Disk space available: ${available}`);
    }

    // Check memory
    const memTest = await this.executeCommand('free -h', { silent: true });
    if (memTest.success) {
      const lines = memTest.output.split('\n');
      const memLine = lines[1];
      const parts = memLine.split(/\s+/);
      const total = parts[1];
      const available = parts[6] || parts[3];
      
      validation.tests.memory = {
        name: 'Memory',
        passed: true,
        output: `Total: ${total}, Available: ${available}`
      };
      
      this.log(`✓ Memory - Total: ${total}, Available: ${available}`);
    }

    this.results.validations.systemResources = validation;
    this.results.passed++;

    return validation.passed;
  }

  async testDockerFunctionality() {
    this.log('=== Docker Functionality Test ===');
    
    const validation = {
      name: 'Docker Functionality',
      tests: {},
      passed: true,
      critical: true
    };

    // Test Docker hello-world
    this.log('Testing Docker with hello-world container...');
    const helloWorldTest = await this.executeCommand('docker run --rm hello-world', { silent: true, timeout: 60000 });
    
    validation.tests.helloWorld = {
      name: 'Docker Hello World Test',
      passed: helloWorldTest.success,
      output: helloWorldTest.success ? 'Hello World container ran successfully' : helloWorldTest.error
    };

    if (helloWorldTest.success) {
      this.log('✓ Docker hello-world test passed');
    } else {
      this.log('✗ Docker hello-world test failed', 'error');
      validation.passed = false;
    }

    this.results.validations.dockerFunctionality = validation;
    if (validation.passed) {
      this.results.passed++;
    } else {
      this.results.failed++;
    }

    return validation.passed;
  }

  generateReadinessReport() {
    this.log('=== Generating Readiness Report ===');
    
    const criticalValidations = Object.values(this.results.validations)
      .filter(v => v.critical);
    
    const criticalPassed = criticalValidations.filter(v => v.passed).length;
    const criticalTotal = criticalValidations.length;
    
    this.results.ready = criticalPassed === criticalTotal && this.results.failed === 0;
    
    const report = {
      ...this.results,
      summary: {
        totalValidations: Object.keys(this.results.validations).length,
        criticalValidations: criticalTotal,
        criticalPassed: criticalPassed,
        readyForDeployment: this.results.ready,
        nextSteps: []
      }
    };

    // Generate next steps
    if (this.results.ready) {
      report.summary.nextSteps = [
        '✅ Environment is ready for production deployment!',
        'Next: Run dependency installation with "npm install"',
        'Then: Configure production environment variables',
        'Finally: Execute deployment with "./scripts/deploy-production.sh"'
      ];
    } else {
      report.summary.nextSteps = [
        '❌ Environment is not ready for deployment',
        'Please resolve the failed validations above',
        'Re-run this script after making corrections'
      ];

      // Add specific recommendations
      Object.entries(this.results.validations).forEach(([key, validation]) => {
        if (!validation.passed && validation.critical) {
          switch (key) {
            case 'nodejs':
              report.summary.nextSteps.push('- Install or upgrade Node.js to version 18+');
              break;
            case 'docker':
              report.summary.nextSteps.push('- Install Docker and ensure the service is running');
              break;
            case 'dockerCompose':
              report.summary.nextSteps.push('- Install Docker Compose');
              break;
            case 'dockerFunctionality':
              report.summary.nextSteps.push('- Fix Docker permissions or service issues');
              break;
          }
        }
      });
    }

    // Save report
    const reportFile = path.join(process.cwd(), 'environment-readiness-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    this.log(`✓ Readiness report saved: ${reportFile}`);
    
    return report;
  }

  async run() {
    try {
      this.log('Starting Environment Readiness Validation');
      this.log('='.repeat(50));

      // Run all validations
      await this.validateNodeJS();
      await this.validateDocker();
      await this.validateDockerCompose();
      await this.validateProjectStructure();
      await this.validateSystemResources();
      await this.testDockerFunctionality();

      // Generate final report
      const report = this.generateReadinessReport();

      // Final summary
      this.log('='.repeat(50));
      this.log('ENVIRONMENT READINESS SUMMARY');
      this.log('='.repeat(50));
      
      this.log(`Total Validations: ${report.summary.totalValidations}`);
      this.log(`Passed: ${this.results.passed}`);
      this.log(`Failed: ${this.results.failed}`);
      this.log(`Warnings: ${this.results.warnings}`);
      
      if (report.summary.readyForDeployment) {
        this.log('✅ ENVIRONMENT IS READY FOR DEPLOYMENT!', 'success');
      } else {
        this.log('❌ ENVIRONMENT IS NOT READY FOR DEPLOYMENT', 'error');
      }

      this.log('\nNext Steps:');
      report.summary.nextSteps.forEach(step => this.log(`  ${step}`));

      this.log(`\nDetailed report: environment-readiness-report.json`);

      return report;

    } catch (error) {
      this.log(`Fatal error during validation: ${error.message}`, 'error');
      throw error;
    }
  }
}

// Run the validation if called directly
if (require.main === module) {
  const validator = new EnvironmentValidator();
  validator.run()
    .then(report => {
      process.exit(report.summary.readyForDeployment ? 0 : 1);
    })
    .catch(error => {
      console.error('Environment validation failed:', error);
      process.exit(1);
    });
}

module.exports = EnvironmentValidator;