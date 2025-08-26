#!/bin/bash

# Production Environment Setup Script
# Automates the installation of Node.js 18+ and Docker for production deployment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️ [$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ [$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️ [$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_error() {
    echo -e "${RED}❌ [$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_warning "This script is running as root. Some operations may require non-root user."
    fi
}

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            OS=$NAME
            VER=$VERSION_ID
        else
            OS="Unknown Linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macOS"
    else
        OS="Unknown"
    fi
    
    log_info "Detected OS: $OS"
}

# Check current Node.js version
check_nodejs() {
    log_info "Checking current Node.js installation..."
    
    if command -v node &> /dev/null; then
        CURRENT_NODE_VERSION=$(node --version)
        log_info "Current Node.js version: $CURRENT_NODE_VERSION"
        
        # Extract major version number
        MAJOR_VERSION=$(echo $CURRENT_NODE_VERSION | sed 's/v\([0-9]*\).*/\1/')
        
        if [ "$MAJOR_VERSION" -ge 18 ]; then
            log_success "Node.js version is compatible (>= 18.0.0)"
            return 0
        else
            log_warning "Node.js version $CURRENT_NODE_VERSION is too old. Need >= 18.0.0"
            return 1
        fi
    else
        log_warning "Node.js is not installed"
        return 1
    fi
}

# Install Node.js using NodeSource repository
install_nodejs_ubuntu() {
    log_info "Installing Node.js 18.x on Ubuntu/Debian..."
    
    # Update package index
    sudo apt-get update
    
    # Install required packages
    sudo apt-get install -y ca-certificates curl gnupg
    
    # Add NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    
    # Install Node.js
    sudo apt-get install -y nodejs
    
    log_success "Node.js installation completed"
}

# Install Node.js using NodeSource repository for CentOS/RHEL/Fedora
install_nodejs_centos() {
    log_info "Installing Node.js 18.x on CentOS/RHEL/Fedora..."
    
    # Add NodeSource repository
    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
    
    # Install Node.js
    sudo dnf install -y nodejs npm
    
    log_success "Node.js installation completed"
}

# Install Node.js using NVM (Node Version Manager)
install_nodejs_nvm() {
    log_info "Installing Node.js using NVM..."
    
    # Download and install NVM
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    
    # Source NVM
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
    
    # Install Node.js 18 LTS
    nvm install 18
    nvm use 18
    nvm alias default 18
    
    log_success "Node.js installation via NVM completed"
}

# Install Docker on Ubuntu/Debian
install_docker_ubuntu() {
    log_info "Installing Docker on Ubuntu/Debian..."
    
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
    
    log_success "Docker installation completed"
}

# Install Docker on CentOS/RHEL/Fedora
install_docker_centos() {
    log_info "Installing Docker on CentOS/RHEL/Fedora..."
    
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
    
    log_success "Docker installation completed"
}

# Check Docker installation
check_docker() {
    log_info "Checking Docker installation..."
    
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version)
        log_info "Docker version: $DOCKER_VERSION"
        
        # Check if Docker service is running
        if sudo systemctl is-active --quiet docker; then
            log_success "Docker service is running"
            return 0
        else
            log_warning "Docker is installed but service is not running"
            return 1
        fi
    else
        log_warning "Docker is not installed"
        return 1
    fi
}

# Add user to docker group
setup_docker_permissions() {
    log_info "Setting up Docker permissions..."
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    
    log_success "User added to docker group"
    log_warning "You may need to log out and log back in for group changes to take effect"
    log_info "Or run: newgrp docker"
}

# Verify installations
verify_installation() {
    log_info "Verifying installations..."
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        NPM_VERSION=$(npm --version)
        log_success "Node.js: $NODE_VERSION"
        log_success "NPM: $NPM_VERSION"
    else
        log_error "Node.js verification failed"
        return 1
    fi
    
    # Check Docker
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version)
        log_success "Docker: $DOCKER_VERSION"
        
        # Check Docker Compose
        if docker compose version &> /dev/null; then
            COMPOSE_VERSION=$(docker compose version)
            log_success "Docker Compose: $COMPOSE_VERSION"
        elif command -v docker-compose &> /dev/null; then
            COMPOSE_VERSION=$(docker-compose --version)
            log_success "Docker Compose: $COMPOSE_VERSION"
        else
            log_error "Docker Compose not found"
            return 1
        fi
    else
        log_error "Docker verification failed"
        return 1
    fi
    
    return 0
}

# Main installation function
main() {
    log_info "🚀 Starting Production Environment Setup"
    log_info "========================================"
    
    check_root
    detect_os
    
    # Check and install Node.js if needed
    if ! check_nodejs; then
        log_info "Node.js needs to be installed or upgraded..."
        
        read -p "Install Node.js 18.x? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            case "$OS" in
                *"Ubuntu"*|*"Debian"*)
                    install_nodejs_ubuntu
                    ;;
                *"CentOS"*|*"Red Hat"*|*"Fedora"*)
                    install_nodejs_centos
                    ;;
                *)
                    log_info "Using NVM for Node.js installation..."
                    install_nodejs_nvm
                    ;;
            esac
        else
            log_warning "Skipping Node.js installation"
        fi
    fi
    
    # Check and install Docker if needed
    if ! check_docker; then
        log_info "Docker needs to be installed..."
        
        read -p "Install Docker? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            case "$OS" in
                *"Ubuntu"*|*"Debian"*)
                    install_docker_ubuntu
                    ;;
                *"CentOS"*|*"Red Hat"*|*"Fedora"*)
                    install_docker_centos
                    ;;
                *)
                    log_error "Automatic Docker installation not supported for $OS"
                    log_info "Please install Docker manually: https://docs.docker.com/engine/install/"
                    ;;
            esac
            
            # Set up Docker permissions
            setup_docker_permissions
        else
            log_warning "Skipping Docker installation"
        fi
    fi
    
    # Verify all installations
    log_info "Verifying installations..."
    if verify_installation; then
        log_success "🎉 Environment setup completed successfully!"
        log_info ""
        log_info "Next steps:"
        log_info "1. Run environment preparation: node scripts/environment-preparation.js"
        log_info "2. Install dependencies: npm install"
        log_info "3. Configure production environment: cp .env.production.template .env.production"
        log_info ""
        log_warning "Note: If you added user to docker group, you may need to:"
        log_info "- Log out and log back in, OR"
        log_info "- Run: newgrp docker"
    else
        log_error "Environment setup failed. Please check the errors above."
        exit 1
    fi
}

# Run main function
main "$@"