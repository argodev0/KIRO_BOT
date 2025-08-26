#!/usr/bin/env node

/**
 * Comprehensive Environment Preparation Script
 * 
 * This script handles:
 * 1. System requirements validation
 * 2. Node.js version upgrade guidance
 * 3. Docker installation
 * 4. System dependencies verification
 * 5. Environment backup and rollback procedures
 * 
 * Requirements: 1.1, 1.3, 1.5
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');

class EnvironmentPreparation {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      phase: 'environment-preparation',
      checks: {},
      actions: [],
      errors: [],
      warnings: [],
      recommendations: []
    };
    
    this.requiredNodeVersion = '18.0.0';
    this.backupDir = path.join(process.cwd(), 'environment-backup');
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logMessage);
    
    if (type === 'error') {
      this.results.errors.push(message);
    } else if (type === 'warning') {
      this.results.warnings.push(message);
    }
  }

  async executeCommand(command, options = {}) {
    try {
      const result = execSync(command, { 
        encoding: 'utf8', 
        stdio: options.silent ? 'pipe' : 'inherit',
        ...options 
      });
      return { success: true, output: result };
    } catch (error) {
      return { 
        success: false, 
        error: error.message, 
        output: error.stdout || error.stderr || '' 
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

  async validateSystemRequirements() {
    this.log('=== System Requirements Validation ===');
    
    // Check operating system
    const platform = os.platform();
    const release = os.release();
    const arch = os.arch();
    
    this.log(`Operating System: ${platform} ${release} (${arch})`);
    this.results.checks.operatingSystem = {
      platform,
      release,
      arch,
      supported: platform === 'linux' || platform === 'darwin'
    };

    // Check available memory
    const totalMemory = Math.round(os.totalmem() / (1024 * 1024 * 1024));
    const freeMemory = Math.round(os.freemem() / (1024 * 1024 * 1024));
    
    this.log(`Memory: ${freeMemory}GB free / ${totalMemory}GB total`);
    this.results.checks.memory = {
      total: totalMemory,
      free: freeMemory,
      sufficient: totalMemory >= 4 // Minimum 4GB recommended
    };

    if (totalMemory < 4) {
      this.log('Warning: Less than 4GB RAM available. Consider upgrading for optimal performance.', 'warning');
    }

    // Check disk space
    const diskUsage = await this.executeCommand('df -h /', { silent: true });
    if (diskUsage.success) {
      this.log(`Disk Usage:\n${diskUsage.output}`);
    }

    return this.results.checks;
  }

  async validateCurrentNodeVersion() {
    this.log('=== Node.js Version Validation ===');
    
    const nodeVersion = await this.executeCommand('node --version', { silent: true });
    if (!nodeVersion.success) {
      this.log('Node.js is not installed', 'error');
      this.results.checks.nodejs = { installed: false };
      return false;
    }

    const currentVersion = nodeVersion.output.trim().replace('v', '');
    const versionComparison = this.compareVersions(currentVersion, this.requiredNodeVersion);
    
    this.log(`Current Node.js version: v${currentVersion}`);
    this.log(`Required Node.js version: >=${this.requiredNodeVersion}`);
    
    this.results.checks.nodejs = {
      installed: true,
      currentVersion,
      requiredVersion: this.requiredNodeVersion,
      compatible: versionComparison >= 0
    };

    if (versionComparison < 0) {
      this.log(`CRITICAL: Node.js version v${currentVersion} is below required v${this.requiredNodeVersion}`, 'error');
      return false;
    } else {
      this.log(`✓ Node.js version is compatible`);
      return true;
    }
  }

  async checkDockerInstallation() {
    this.log('=== Docker Installation Check ===');
    
    const dockerCheck = await this.executeCommand('docker --version', { silent: true });
    const dockerComposeCheck = await this.executeCommand('docker-compose --version', { silent: true });
    
    this.results.checks.docker = {
      dockerInstalled: dockerCheck.success,
      dockerComposeInstalled: dockerComposeCheck.success,
      dockerVersion: dockerCheck.success ? dockerCheck.output.trim() : null,
      dockerComposeVersion: dockerComposeCheck.success ? dockerComposeCheck.output.trim() : null
    };

    if (dockerCheck.success) {
      this.log(`✓ Docker installed: ${dockerCheck.output.trim()}`);
    } else {
      this.log('✗ Docker is not installed', 'error');
    }

    if (dockerComposeCheck.success) {
      this.log(`✓ Docker Compose installed: ${dockerComposeCheck.output.trim()}`);
    } else {
      this.log('✗ Docker Compose is not installed', 'error');
    }

    return dockerCheck.success && dockerComposeCheck.success;
  }

  async validateSystemDependencies() {
    this.log('=== System Dependencies Validation ===');
    
    const dependencies = [
      { name: 'git', command: 'git --version' },
      { name: 'curl', command: 'curl --version' },
      { name: 'wget', command: 'wget --version' },
      { name: 'unzip', command: 'unzip -v' },
      { name: 'build-essential', command: 'gcc --version' }
    ];

    const dependencyResults = {};

    for (const dep of dependencies) {
      const result = await this.executeCommand(dep.command, { silent: true });
      dependencyResults[dep.name] = {
        installed: result.success,
        version: result.success ? result.output.split('\n')[0] : null
      };

      if (result.success) {
        this.log(`✓ ${dep.name} is available`);
      } else {
        this.log(`✗ ${dep.name} is not available`, 'warning');
      }
    }

    this.results.checks.systemDependencies = dependencyResults;
    return dependencyResults;
  }

  async createEnvironmentBackup() {
    this.log('=== Creating Environment Backup ===');
    
    try {
      // Create backup directory
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }

      const backupData = {
        timestamp: new Date().toISOString(),
        system: {
          platform: os.platform(),
          release: os.release(),
          arch: os.arch()
        },
        environment: process.env,
        nodeVersion: process.version,
        npmVersion: await this.executeCommand('npm --version', { silent: true }),
        installedPackages: await this.executeCommand('npm list -g --depth=0', { silent: true }),
        currentDirectory: process.cwd()
      };

      // Save backup data
      const backupFile = path.join(this.backupDir, `environment-backup-${Date.now()}.json`);
      fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
      
      this.log(`✓ Environment backup created: ${backupFile}`);
      this.results.actions.push(`Environment backup created: ${backupFile}`);

      // Create rollback script
      const rollbackScript = this.createRollbackScript(backupData);
      const rollbackFile = path.join(this.backupDir, 'rollback.sh');
      fs.writeFileSync(rollbackFile, rollbackScript);
      fs.chmodSync(rollbackFile, '755');
      
      this.log(`✓ Rollback script created: ${rollbackFile}`);
      this.results.actions.push(`Rollback script created: ${rollbackFile}`);

      return { success: true, backupFile, rollbackFile };
    } catch (error) {
      this.log(`Error creating environment backup: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  createRollbackScript(backupData) {
    return `#!/bin/bash
# Environment Rollback Script
# Generated on: ${backupData.timestamp}

echo "=== Environment Rollback Script ==="
echo "This script provides guidance for rolling back environment changes"
echo "Original Node.js version: ${backupData.nodeVersion}"
echo "Original working directory: ${backupData.currentDirectory}"
echo ""

echo "To rollback Node.js version changes:"
echo "1. If using nvm: nvm use ${backupData.nodeVersion.replace('v', '')}"
echo "2. If using system package manager, reinstall the original version"
echo ""

echo "To restore global npm packages:"
echo "npm install -g $(echo '${JSON.stringify(backupData.installedPackages.output || '')}' | grep -oP '\\w+@[\\d\\.]+' | tr '\\n' ' ')"
echo ""

echo "Environment backup data is available in:"
echo "$(dirname "$0")/environment-backup-*.json"
echo ""

echo "Manual rollback steps:"
echo "1. Review the backup JSON file for original configuration"
echo "2. Uninstall Docker if it was installed by this script"
echo "3. Restore original Node.js version"
echo "4. Restore original npm packages"
echo "5. Check system configuration files"
`;
  }

  generateNodeUpgradeInstructions() {
    this.log('=== Node.js Upgrade Instructions ===');
    
    const instructions = {
      usingNvm: [
        'Using Node Version Manager (NVM) - RECOMMENDED:',
        '1. Install NVM if not already installed:',
        '   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash',
        '2. Reload your shell or run: source ~/.bashrc',
        '3. Install Node.js 18:',
        '   nvm install 18',
        '4. Use Node.js 18:',
        '   nvm use 18',
        '5. Set as default:',
        '   nvm alias default 18'
      ],
      usingNodeSource: [
        'Using NodeSource repository:',
        '1. Add NodeSource repository:',
        '   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -',
        '2. Install Node.js:',
        '   sudo apt-get install -y nodejs'
      ],
      usingSnap: [
        'Using Snap (Ubuntu):',
        '1. Install Node.js 18:',
        '   sudo snap install node --classic --channel=18'
      ]
    };

    this.log('\n' + instructions.usingNvm.join('\n'));
    this.log('\nAlternative methods:');
    this.log(instructions.usingNodeSource.join('\n'));
    this.log(instructions.usingSnap.join('\n'));

    this.results.recommendations.push('Upgrade Node.js to version 18 or higher using one of the provided methods');
    
    return instructions;
  }

  generateDockerInstallationInstructions() {
    this.log('=== Docker Installation Instructions ===');
    
    const instructions = {
      ubuntu: [
        'Docker Installation for Ubuntu:',
        '1. Update package index:',
        '   sudo apt-get update',
        '2. Install prerequisites:',
        '   sudo apt-get install ca-certificates curl gnupg lsb-release',
        '3. Add Docker GPG key:',
        '   sudo mkdir -p /etc/apt/keyrings',
        '   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg',
        '4. Add Docker repository:',
        '   echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null',
        '5. Update package index:',
        '   sudo apt-get update',
        '6. Install Docker:',
        '   sudo apt-get install docker-ce docker-ce-cli containerd.io docker-compose-plugin',
        '7. Add user to docker group:',
        '   sudo usermod -aG docker $USER',
        '8. Restart session or run:',
        '   newgrp docker',
        '9. Test installation:',
        '   docker run hello-world'
      ],
      dockerCompose: [
        'Docker Compose Installation:',
        '1. Download Docker Compose:',
        '   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose',
        '2. Make executable:',
        '   sudo chmod +x /usr/local/bin/docker-compose',
        '3. Test installation:',
        '   docker-compose --version'
      ]
    };

    this.log('\n' + instructions.ubuntu.join('\n'));
    this.log('\n' + instructions.dockerCompose.join('\n'));

    this.results.recommendations.push('Install Docker and Docker Compose using the provided instructions');
    
    return instructions;
  }

  async generateComprehensiveReport() {
    this.log('=== Generating Comprehensive Report ===');
    
    const report = {
      ...this.results,
      summary: {
        nodeJsCompatible: (this.results.checks.nodejs && this.results.checks.nodejs.compatible) || false,
        dockerInstalled: (this.results.checks.docker && this.results.checks.docker.dockerInstalled) || false,
        dockerComposeInstalled: (this.results.checks.docker && this.results.checks.docker.dockerComposeInstalled) || false,
        systemRequirementsMet: (this.results.checks.operatingSystem && this.results.checks.operatingSystem.supported) && (this.results.checks.memory && this.results.checks.memory.sufficient),
        readyForDeployment: false
      },
      nextSteps: []
    };

    // Determine readiness for deployment
    report.summary.readyForDeployment = 
      report.summary.nodeJsCompatible &&
      report.summary.dockerInstalled &&
      report.summary.dockerComposeInstalled &&
      report.summary.systemRequirementsMet;

    // Generate next steps
    if (!report.summary.nodeJsCompatible) {
      report.nextSteps.push('CRITICAL: Upgrade Node.js to version 18 or higher');
    }
    
    if (!report.summary.dockerInstalled) {
      report.nextSteps.push('REQUIRED: Install Docker');
    }
    
    if (!report.summary.dockerComposeInstalled) {
      report.nextSteps.push('REQUIRED: Install Docker Compose');
    }

    if (report.summary.readyForDeployment) {
      report.nextSteps.push('✓ Environment is ready for deployment');
      report.nextSteps.push('Next: Run dependency installation and validation');
    }

    // Save report
    const reportFile = path.join(process.cwd(), 'environment-preparation-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    this.log(`✓ Comprehensive report saved: ${reportFile}`);
    
    return report;
  }

  async run() {
    try {
      this.log('Starting Comprehensive Environment Preparation');
      this.log('='.repeat(50));

      // Step 1: Validate system requirements
      await this.validateSystemRequirements();

      // Step 2: Check current Node.js version
      const nodeCompatible = await this.validateCurrentNodeVersion();

      // Step 3: Check Docker installation
      const dockerInstalled = await this.checkDockerInstallation();

      // Step 4: Validate system dependencies
      await this.validateSystemDependencies();

      // Step 5: Create environment backup
      await this.createEnvironmentBackup();

      // Step 6: Generate upgrade instructions if needed
      if (!nodeCompatible) {
        this.generateNodeUpgradeInstructions();
      }

      if (!dockerInstalled) {
        this.generateDockerInstallationInstructions();
      }

      // Step 7: Generate comprehensive report
      const report = await this.generateComprehensiveReport();

      // Final summary
      this.log('='.repeat(50));
      this.log('ENVIRONMENT PREPARATION SUMMARY');
      this.log('='.repeat(50));
      
      if (report.summary.readyForDeployment) {
        this.log('✅ Environment is ready for production deployment!');
      } else {
        this.log('❌ Environment requires updates before deployment');
        this.log('\nRequired actions:');
        report.nextSteps.forEach(step => this.log(`  - ${step}`));
      }

      this.log(`\nDetailed report: environment-preparation-report.json`);
      this.log(`Environment backup: ${this.backupDir}`);

      return report;

    } catch (error) {
      this.log(`Fatal error during environment preparation: ${error.message}`, 'error');
      throw error;
    }
  }
}

// Run the environment preparation if called directly
if (require.main === module) {
  const prep = new EnvironmentPreparation();
  prep.run()
    .then(report => {
      process.exit(report.summary.readyForDeployment ? 0 : 1);
    })
    .catch(error => {
      console.error('Environment preparation failed:', error);
      process.exit(1);
    });
}

module.exports = EnvironmentPreparation;