#!/bin/bash

# Docker Configuration Validation Script
# Validates all Docker files and configurations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Validating Docker configuration files...${NC}"

# Function to validate file exists
validate_file_exists() {
    local file_path=$1
    local description=$2
    
    echo -n "Checking $description... "
    
    if [ -f "$file_path" ]; then
        echo -e "${GREEN}✓ Found${NC}"
        return 0
    else
        echo -e "${RED}✗ Missing: $file_path${NC}"
        return 1
    fi
}

# Function to validate Docker Compose syntax
validate_compose_syntax() {
    local compose_file=$1
    local description=$2
    
    echo -n "Validating $description syntax... "
    
    if docker compose -f "$compose_file" config > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Valid${NC}"
        return 0
    else
        echo -e "${RED}✗ Invalid syntax${NC}"
        return 1
    fi
}

# Function to validate Dockerfile syntax
validate_dockerfile_syntax() {
    local dockerfile=$1
    local description=$2
    
    echo -n "Validating $description syntax... "
    
    # Basic syntax validation
    if grep -q "FROM" "$dockerfile" && grep -q "WORKDIR\|RUN\|COPY\|CMD" "$dockerfile"; then
        echo -e "${GREEN}✓ Valid${NC}"
        return 0
    else
        echo -e "${RED}✗ Invalid or incomplete${NC}"
        return 1
    fi
}

# Function to check paper trading environment variables
validate_paper_trading_config() {
    local compose_file=$1
    
    echo -n "Validating paper trading configuration... "
    
    if grep -q "PAPER_TRADING_MODE=true" "$compose_file" && \
       grep -q "ALLOW_REAL_TRADES=false" "$compose_file" && \
       grep -q "FORCE_PAPER_TRADING=true" "$compose_file"; then
        echo -e "${GREEN}✓ Paper trading properly configured${NC}"
        return 0
    else
        echo -e "${RED}✗ Paper trading configuration missing or incorrect${NC}"
        return 1
    fi
}

# Main validation function
main() {
    local exit_code=0
    
    echo "=== Docker File Validation ==="
    validate_file_exists "docker/Dockerfile.frontend" "Frontend Dockerfile" || exit_code=1
    validate_file_exists "docker/Dockerfile.backend" "Backend Dockerfile" || exit_code=1
    validate_file_exists "docker-compose.prod.yml" "Production Docker Compose (root)" || exit_code=1
    validate_file_exists "docker/docker-compose.prod.yml" "Production Docker Compose (docker/)" || exit_code=1
    
    echo ""
    echo "=== Docker Syntax Validation ==="
    validate_dockerfile_syntax "docker/Dockerfile.frontend" "Frontend Dockerfile" || exit_code=1
    validate_dockerfile_syntax "docker/Dockerfile.backend" "Backend Dockerfile" || exit_code=1
    
    echo ""
    echo "=== Docker Compose Validation ==="
    validate_compose_syntax "docker-compose.prod.yml" "Root Docker Compose" || exit_code=1
    
    echo ""
    echo "=== Paper Trading Safety Validation ==="
    validate_paper_trading_config "docker-compose.prod.yml" || exit_code=1
    
    echo ""
    echo "=== Additional Configuration Files ==="
    validate_file_exists "docker/nginx.conf" "Nginx configuration" || exit_code=1
    validate_file_exists "docker/default.conf" "Nginx default configuration" || exit_code=1
    validate_file_exists "vite.config.ts" "Vite configuration" || exit_code=1
    validate_file_exists "package.json" "Package.json" || exit_code=1
    
    echo ""
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓ All Docker configurations are valid!${NC}"
        echo ""
        echo "Next steps:"
        echo "1. Run: docker-compose -f docker-compose.prod.yml build"
        echo "2. Run: docker-compose -f docker-compose.prod.yml up -d"
        echo "3. Run: ./docker/scripts/health-check.sh"
    else
        echo -e "${RED}✗ Some Docker configurations are invalid or missing!${NC}"
        echo ""
        echo "Please fix the issues above before proceeding."
    fi
    
    return $exit_code
}

# Run main function
main "$@"