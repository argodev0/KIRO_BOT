#!/bin/bash

# Docker Build Test Script
# Tests that all Docker images can be built successfully

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Testing Docker image builds...${NC}"

# Function to test Docker image build
test_docker_build() {
    local dockerfile=$1
    local context=$2
    local image_name=$3
    local description=$4
    
    echo -n "Building $description... "
    
    if docker build -f "$dockerfile" -t "$image_name" "$context" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Success${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed${NC}"
        return 1
    fi
}

# Function to test Docker Compose build
test_compose_build() {
    local compose_file=$1
    local service_name=$2
    local description=$3
    
    echo -n "Building $description via Docker Compose... "
    
    if docker compose -f "$compose_file" build "$service_name" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Success${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed${NC}"
        return 1
    fi
}

# Function to cleanup test images
cleanup_test_images() {
    echo -n "Cleaning up test images... "
    
    docker rmi -f trading-bot-frontend-test trading-bot-backend-test > /dev/null 2>&1 || true
    
    echo -e "${GREEN}✓ Cleaned up${NC}"
}

# Main test function
main() {
    local exit_code=0
    
    echo "=== Individual Dockerfile Build Tests ==="
    test_docker_build "docker/Dockerfile.frontend" "." "trading-bot-frontend-test" "Frontend Docker image" || exit_code=1
    test_docker_build "docker/Dockerfile.backend" "." "trading-bot-backend-test" "Backend Docker image" || exit_code=1
    
    echo ""
    echo "=== Docker Compose Build Tests ==="
    test_compose_build "docker-compose.prod.yml" "frontend" "Frontend service" || exit_code=1
    test_compose_build "docker-compose.prod.yml" "backend" "Backend service" || exit_code=1
    
    echo ""
    echo "=== Cleanup ==="
    cleanup_test_images
    
    echo ""
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓ All Docker builds completed successfully!${NC}"
        echo ""
        echo "Docker configuration is ready for production deployment."
        echo ""
        echo "To deploy:"
        echo "1. Set environment variables in .env file"
        echo "2. Run: docker compose -f docker-compose.prod.yml up -d"
        echo "3. Run: ./docker/scripts/health-check.sh"
    else
        echo -e "${RED}✗ Some Docker builds failed!${NC}"
        echo ""
        echo "Please check the Docker configurations and try again."
        echo "Common issues:"
        echo "- Missing dependencies in package.json"
        echo "- Incorrect file paths in Dockerfiles"
        echo "- Build context issues"
    fi
    
    return $exit_code
}

# Run main function
main "$@"