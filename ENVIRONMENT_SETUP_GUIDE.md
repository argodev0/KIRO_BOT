# Environment Setup Guide

This guide provides comprehensive instructions for preparing the production environment for the KIRO trading bot deployment.

## Overview

The environment preparation process involves:
1. **System Requirements Validation** - Check current system compatibility
2. **Node.js Upgrade** - Install Node.js 18+ for full dependency support
3. **Docker Installation** - Install Docker and Docker Compose for containerized deployment
4. **Environment Backup** - Create rollback procedures for safety
5. **Validation** - Verify all components are working correctly

## Current Status

Based on the initial assessment:
- ❌ **Node.js**: v12.22.9 (requires >=18.0.0)
- ❌ **Docker**: Not installed (required for deployment)
- ❌ **Docker Compose**: Not installed (required for orchestration)
- ✅ **System**: Ubuntu 22.04.5 LTS with 16GB RAM (compatible)
- ✅ **Dependencies**: Git, curl, wget, build tools available

## Quick Start (Automated)

For automated installation, run:

```bash
# Make the script executable
chmod +x scripts/automated-environment-setup.sh

# Run the automated setup
./scripts/automated-environment-setup.sh
```

This script will:
- Install Node.js 18 via NodeSource repository
- Install Docker CE with all components
- Install Docker Compose
- Configure user permissions
- Create validation scripts

**Important**: After running the automated setup, you must **log out and log back in** for Docker group changes to take effect.

## Manual Installation Steps

### Step 1: Environment Assessment

First, run the comprehensive environment check:

```bash
node scripts/environment-preparation-comprehensive.js
```

This will:
- Validate current system requirements
- Check Node.js and Docker installation status
- Create environment backup in `environment-backup/`
- Generate detailed report in `environment-preparation-report.json`
- Provide specific upgrade instructions

### Step 2: Node.js Upgrade

#### Option A: Using NodeSource Repository (Recommended)

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js 18
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version
```

#### Option B: Using Node Version Manager (NVM)

```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell
source ~/.bashrc

# Install and use Node.js 18
nvm install 18
nvm use 18
nvm alias default 18
```

#### Option C: Using Snap

```bash
# Install Node.js 18 via Snap
sudo snap install node --classic --channel=18
```

### Step 3: Docker Installation

#### Install Docker CE

```bash
# Update package index
sudo apt-get update

# Install prerequisites
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update package index
sudo apt-get update

# Install Docker
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker
```

#### Install Docker Compose (if not included)

```bash
# Download Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make executable
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker-compose --version
```

### Step 4: Post-Installation Validation

After installation, **log out and log back in** to activate Docker group membership, then run:

```bash
# Validate environment readiness
node scripts/validate-environment-readiness.js
```

This comprehensive validation will test:
- Node.js version compatibility (>=18.0.0)
- Docker installation and service status
- Docker Compose availability
- Docker functionality with hello-world test
- Project structure completeness
- System resources adequacy

## Validation Scripts

### Available Scripts

1. **`scripts/environment-preparation-comprehensive.js`**
   - Initial environment assessment
   - Creates backup and rollback procedures
   - Provides upgrade instructions
   - Generates detailed compatibility report

2. **`scripts/automated-environment-setup.sh`**
   - Automated Node.js and Docker installation
   - Handles prerequisites and configuration
   - Creates post-installation validation script
   - Provides step-by-step progress feedback

3. **`scripts/validate-environment-readiness.js`**
   - Comprehensive post-installation validation
   - Tests all critical components
   - Validates Docker functionality
   - Generates deployment readiness report

### Running Validations

```bash
# Initial assessment (works with any Node.js version)
node scripts/environment-preparation-comprehensive.js

# After installation (requires Node.js 18+)
node scripts/validate-environment-readiness.js

# Quick Docker test (after group membership activation)
./post-install-validation.sh
```

## Environment Backup and Rollback

### Backup Location

All environment backups are stored in:
```
environment-backup/
├── environment-backup-[timestamp].json  # System state backup
└── rollback.sh                         # Rollback instructions
```

### Rollback Procedures

If you need to rollback changes:

```bash
# Review rollback instructions
cat environment-backup/rollback.sh

# Follow the provided steps to:
# 1. Restore original Node.js version
# 2. Remove Docker if needed
# 3. Restore system configuration
```

## Troubleshooting

### Common Issues

#### Node.js Installation Issues

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules if exists
rm -rf node_modules

# Reinstall with new Node.js version
npm install
```

#### Docker Permission Issues

```bash
# Check if user is in docker group
groups $USER

# If not in docker group, add user
sudo usermod -aG docker $USER

# Log out and back in, then test
docker ps
```

#### Docker Service Issues

```bash
# Check Docker service status
sudo systemctl status docker

# Start Docker service
sudo systemctl start docker

# Enable Docker to start on boot
sudo systemctl enable docker
```

### Verification Commands

```bash
# Check versions
node --version    # Should be >=18.0.0
npm --version
docker --version
docker-compose --version

# Test Docker functionality
docker run --rm hello-world

# Test Docker Compose
docker-compose --version
# OR
docker compose version
```

## Next Steps After Environment Setup

Once the environment validation passes:

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Production Environment**
   ```bash
   cp .env.production.template .env.production
   # Edit .env.production with actual values
   ```

3. **Run Pre-deployment Tests**
   ```bash
   npm test
   npm run test:integration
   ```

4. **Execute Deployment**
   ```bash
   ./scripts/deploy-production.sh
   ```

## Security Considerations

- All scripts create backups before making changes
- Docker group membership is required but creates security implications
- Production environment variables should be properly secured
- API keys should be read-only and properly validated

## Support

If you encounter issues:

1. Check the generated reports:
   - `environment-preparation-report.json`
   - `environment-readiness-report.json`

2. Review the backup files in `environment-backup/`

3. Run individual validation commands to isolate issues

4. Consult the rollback procedures if needed

## Requirements Mapping

This environment setup addresses the following requirements:

- **Requirement 1.1**: Node.js version >=18.0.0 for full dependency compatibility
- **Requirement 1.3**: Docker and Docker Compose installation for containerized deployment
- **Requirement 1.5**: System dependencies verification and environment backup procedures

The setup ensures all critical blockers are resolved before proceeding with the deployment phase.