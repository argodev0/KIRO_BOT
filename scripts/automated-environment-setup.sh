#!/bin/bash

# Automated Environment Setup Script
# This script automates the installation of Node.js 18+ and Docker
# Requirements: 1.1, 1.3, 1.5

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_error "This script should not be run as root for security reasons"
        log_info "Please run as a regular user. The script will use sudo when needed."
        exit 1
    fi
}

# Check if sudo is available
check_sudo() {
    if ! command -v sudo &> /dev/null; then
        log_error "sudo is required but not installed"
        exit 1
    fi
    
    # Test sudo access
    if ! sudo -n true 2>/dev/null; then
        log_info "This script requires sudo access. You may be prompted for your password."
        sudo -v
    fi
}

# Update system packages
update_system() {
    log_info "Updating system packages..."
    sudo apt-get update -y
    log_success "System packages updated"
}

# Install Node.js using NodeSource repository
install_nodejs() {
    log_info "Installing Node.js 18..."
    
    # Check if Node.js 18+ is already installed
    if command -v node &> /dev/null; then
        current_version=$(node --version | sed 's/v//')
        major_version=$(echo $current_version | cut -d. -f1)
        
        if [ "$major_version" -ge 18 ]; then
            log_success "Node.js $current_version is already installed and compatible"
            return 0
        else
            log_warning "Node.js $current_version is installed but incompatible. Upgrading..."
        fi
    fi
    
    # Install prerequisites
    log_info "Installing Node.js prerequisites..."
    sudo apt-get install -y ca-certificates curl gnupg
    
    # Add NodeSource repository
    log_info "Adding NodeSource repository..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    
    # Install Node.js
    log_info "Installing Node.js..."
    sudo apt-get install -y nodejs
    
    # Verify installation
    if command -v node &> /dev/null && command -v npm &> /dev/null; then
        node_version=$(node --version)
        npm_version=$(npm --version)
        log_success "Node.js $node_version and npm $npm_version installed successfully"
    else
        log_error "Node.js installation failed"
        exit 1
    fi
}

# Install Docker
install_docker() {
    log_info "Installing Docker..."
    
    # Check if Docker is already installed
    if command -v docker &> /dev/null; then
        docker_version=$(docker --version)
        log_success "Docker is already installed: $docker_version"
        
        # Check if user is in docker group
        if groups $USER | grep -q docker; then
            log_success "User is already in docker group"
        else
            log_info "Adding user to docker group..."
            sudo usermod -aG docker $USER
            log_warning "You need to log out and back in for docker group changes to take effect"
        fi
        return 0
    fi
    
    # Install prerequisites
    log_info "Installing Docker prerequisites..."
    sudo apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Add Docker GPG key
    log_info "Adding Docker GPG key..."
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    # Add Docker repository
    log_info "Adding Docker repository..."
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Update package index
    sudo apt-get update -y
    
    # Install Docker
    log_info "Installing Docker Engine..."
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Add user to docker group
    log_info "Adding user to docker group..."
    sudo usermod -aG docker $USER
    
    # Start and enable Docker service
    log_info "Starting Docker service..."
    sudo systemctl start docker
    sudo systemctl enable docker
    
    # Verify installation
    if command -v docker &> /dev/null; then
        docker_version=$(docker --version)
        log_success "Docker installed successfully: $docker_version"
        log_warning "You need to log out and back in for docker group changes to take effect"
    else
        log_error "Docker installation failed"
        exit 1
    fi
}

# Install Docker Compose (standalone)
install_docker_compose() {
    log_info "Installing Docker Compose..."
    
    # Check if docker-compose is already installed
    if command -v docker-compose &> /dev/null; then
        compose_version=$(docker-compose --version)
        log_success "Docker Compose is already installed: $compose_version"
        return 0
    fi
    
    # Check if Docker Compose plugin is available
    if docker compose version &> /dev/null; then
        compose_version=$(docker compose version)
        log_success "Docker Compose plugin is available: $compose_version"
        
        # Create symlink for backward compatibility
        if [ ! -f /usr/local/bin/docker-compose ]; then
            log_info "Creating docker-compose symlink for backward compatibility..."
            sudo ln -s /usr/bin/docker /usr/local/bin/docker-compose
        fi
        return 0
    fi
    
    # Download and install Docker Compose
    log_info "Downloading Docker Compose..."
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep -oP '"tag_name": "\K(.*)(?=")')
    sudo curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    
    # Make executable
    sudo chmod +x /usr/local/bin/docker-compose
    
    # Verify installation
    if command -v docker-compose &> /dev/null; then
        compose_version=$(docker-compose --version)
        log_success "Docker Compose installed successfully: $compose_version"
    else
        log_error "Docker Compose installation failed"
        exit 1
    fi
}

# Test installations
test_installations() {
    log_info "Testing installations..."
    
    # Test Node.js
    if command -v node &> /dev/null && command -v npm &> /dev/null; then
        node_version=$(node --version)
        npm_version=$(npm --version)
        log_success "✓ Node.js $node_version"
        log_success "✓ npm $npm_version"
        
        # Check version compatibility
        major_version=$(echo $node_version | sed 's/v//' | cut -d. -f1)
        if [ "$major_version" -ge 18 ]; then
            log_success "✓ Node.js version is compatible (>=18.0.0)"
        else
            log_error "✗ Node.js version is incompatible (<18.0.0)"
            exit 1
        fi
    else
        log_error "✗ Node.js or npm not found"
        exit 1
    fi
    
    # Test Docker
    if command -v docker &> /dev/null; then
        docker_version=$(docker --version)
        log_success "✓ Docker: $docker_version"
        
        # Test Docker without sudo (if user is in docker group)
        if groups $USER | grep -q docker; then
            if docker ps &> /dev/null; then
                log_success "✓ Docker is accessible without sudo"
            else
                log_warning "⚠ Docker requires sudo (group changes need session restart)"
            fi
        else
            log_warning "⚠ User not in docker group (group changes need session restart)"
        fi
    else
        log_error "✗ Docker not found"
        exit 1
    fi
    
    # Test Docker Compose
    if command -v docker-compose &> /dev/null; then
        compose_version=$(docker-compose --version)
        log_success "✓ Docker Compose: $compose_version"
    elif docker compose version &> /dev/null; then
        compose_version=$(docker compose version)
        log_success "✓ Docker Compose (plugin): $compose_version"
    else
        log_error "✗ Docker Compose not found"
        exit 1
    fi
}

# Create post-installation script
create_post_install_script() {
    log_info "Creating post-installation validation script..."
    
    cat > post-install-validation.sh << 'EOF'
#!/bin/bash

# Post-Installation Validation Script
# Run this after logging out and back in to test Docker group membership

echo "=== Post-Installation Validation ==="

# Test Node.js
echo "Testing Node.js..."
node --version
npm --version

# Test Docker
echo "Testing Docker..."
docker --version
docker ps

# Test Docker Compose
echo "Testing Docker Compose..."
if command -v docker-compose &> /dev/null; then
    docker-compose --version
else
    docker compose version
fi

# Test Docker Hello World
echo "Testing Docker with Hello World..."
docker run --rm hello-world

echo "✅ All tests passed! Environment is ready for deployment."
EOF

    chmod +x post-install-validation.sh
    log_success "Created post-install-validation.sh"
}

# Main installation function
main() {
    echo "========================================"
    echo "  Automated Environment Setup Script"
    echo "========================================"
    echo ""
    
    log_info "Starting automated environment setup..."
    
    # Pre-flight checks
    check_root
    check_sudo
    
    # System update
    update_system
    
    # Install Node.js
    install_nodejs
    
    # Install Docker
    install_docker
    
    # Install Docker Compose
    install_docker_compose
    
    # Test installations
    test_installations
    
    # Create post-installation script
    create_post_install_script
    
    echo ""
    echo "========================================"
    echo "  Installation Complete!"
    echo "========================================"
    echo ""
    log_success "Environment setup completed successfully!"
    echo ""
    log_info "Next steps:"
    echo "1. Log out and log back in to activate Docker group membership"
    echo "2. Run './post-install-validation.sh' to verify everything works"
    echo "3. Run 'node scripts/environment-preparation-comprehensive.js' to validate the environment"
    echo "4. Proceed with dependency installation: 'npm install'"
    echo ""
    log_warning "IMPORTANT: You must log out and back in for Docker group changes to take effect!"
}

# Run main function
main "$@"