# Production Environment Setup Guide

## 🚨 Critical Issues Identified

The environment preparation script has identified the following critical issues that must be resolved before proceeding with production deployment:

### 1. Node.js Version Compatibility ❌
- **Current Version:** v12.22.9
- **Required Version:** >=18.0.0
- **Impact:** Critical - Many dependencies require Node.js 18+

### 2. Docker Installation ❌
- **Status:** Not installed or not in PATH
- **Required:** Docker Engine for containerized deployment
- **Impact:** Critical - Production deployment requires Docker

### 3. Docker Compose Installation ❌
- **Status:** Not installed or not in PATH
- **Required:** Docker Compose for multi-container orchestration
- **Impact:** Critical - Production stack uses docker-compose

## 🔧 Resolution Steps

### Step 1: Node.js Upgrade

#### Option A: Using Node Version Manager (NVM) - Recommended
```bash
# Install NVM (if not already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell configuration
source ~/.bashrc

# Install Node.js 18 (LTS)
nvm install 18
nvm use 18
nvm alias default 18

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show compatible npm version
```

#### Option B: Direct Installation
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL/Fedora
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs npm

# Verify installation
node --version
npm --version
```

### Step 2: Docker Installation

#### Ubuntu/Debian
```bash
# Update package index
sudo apt-get update

# Install required packages
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group (optional, for non-root access)
sudo usermod -aG docker $USER
```

#### CentOS/RHEL/Fedora
```bash
# Install required packages
sudo dnf install -y dnf-plugins-core

# Add Docker repository
sudo dnf config-manager \
    --add-repo \
    https://download.docker.com/linux/fedora/docker-ce.repo

# Install Docker Engine
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group (optional)
sudo usermod -aG docker $USER
```

### Step 3: Docker Compose Installation

#### Method 1: Using Docker Compose Plugin (Recommended)
```bash
# Docker Compose is included with Docker Desktop and Docker Engine installations
# Verify installation
docker compose version
```

#### Method 2: Standalone Installation
```bash
# Download Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make executable
sudo chmod +x /usr/local/bin/docker-compose

# Create symlink (optional)
sudo ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose

# Verify installation
docker-compose --version
```

### Step 4: Verification

After completing the installations, run the environment preparation script again:

```bash
node scripts/environment-preparation.js
```

Expected output should show all checks passing:
```
📈 ENVIRONMENT PREPARATION RESULTS:
   Total Checks: 21
   Passed: 21
   Failed: 0
   Warnings: 0
   Success Rate: 100.0%

🎉 ENVIRONMENT PREPARATION COMPLETED SUCCESSFULLY!
```

## 🔍 Current System Status

### ✅ Passed Checks (17/21)
- Operating System Compatibility (Linux x64)
- System Memory (sufficient)
- CPU Cores (adequate)
- Disk Space (available)
- NPM Installation and compatibility
- Git Installation
- System Resources (load, memory, temp directory)
- File System Permissions
- Network Connectivity (DNS, Internet, NPM Registry)

### ❌ Failed Checks (4/21)
- Node.js Version Compatibility (v12.22.9 → need >=18.0.0)
- Docker Installation (missing)
- Docker Compose Installation (missing)
- Docker Service Status (not running)

## 🚀 Next Steps After Resolution

Once all environment issues are resolved:

1. **Re-run Environment Preparation**
   ```bash
   node scripts/environment-preparation.js
   ```

2. **Proceed to Dependency Installation**
   ```bash
   npm install
   ```

3. **Run Security Audit**
   ```bash
   npm audit
   ```

4. **Validate TypeScript Compilation**
   ```bash
   npm run build
   ```

5. **Configure Production Environment**
   ```bash
   cp .env.production.template .env.production
   # Edit .env.production with actual values
   ```

## 🔒 Security Considerations

### Node.js Security
- Always use LTS (Long Term Support) versions
- Regularly update to latest patch versions
- Run `npm audit` to check for vulnerabilities

### Docker Security
- Keep Docker Engine updated
- Use official base images
- Scan images for vulnerabilities
- Follow Docker security best practices

### System Security
- Keep OS packages updated
- Configure firewall rules
- Use non-root users where possible
- Enable audit logging

## 📊 System Requirements Summary

### Minimum Requirements
- **OS:** Linux, macOS, or Windows
- **Node.js:** >=18.0.0 (LTS recommended)
- **Memory:** 2GB RAM minimum, 4GB recommended
- **CPU:** 2 cores minimum, 4 cores recommended
- **Disk:** 10GB free space minimum
- **Docker:** Latest stable version
- **Docker Compose:** v2.0+ or plugin

### Recommended Production Environment
- **OS:** Ubuntu 20.04 LTS or newer
- **Node.js:** 18.x LTS or 20.x LTS
- **Memory:** 8GB RAM or more
- **CPU:** 4+ cores
- **Disk:** 50GB+ SSD storage
- **Network:** Stable internet connection
- **Monitoring:** Sufficient resources for Prometheus/Grafana

## 🆘 Troubleshooting

### Common Issues

#### Node.js Installation Issues
```bash
# Clear npm cache
npm cache clean --force

# Verify PATH
echo $PATH

# Check Node.js installation location
which node
which npm
```

#### Docker Permission Issues
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Logout and login again, or run:
newgrp docker

# Test Docker access
docker run hello-world
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

## 📞 Support

If you encounter issues during environment setup:

1. Check the generated report: `test-results/environment-preparation-report.json`
2. Review system logs for error details
3. Ensure all prerequisites are met
4. Try running individual commands manually to isolate issues

---

**Important:** Do not proceed with production deployment until all environment preparation checks pass successfully. The paper trading system requires a properly configured environment to ensure all safety mechanisms function correctly.