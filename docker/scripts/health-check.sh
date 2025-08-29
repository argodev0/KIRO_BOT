#!/bin/bash

# Comprehensive Health Check Script for Trading Bot Services
# This script validates all services are running properly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="${1:-docker-compose.prod.yml}"
TIMEOUT=30
RETRY_COUNT=3

echo -e "${YELLOW}Starting comprehensive health check for Trading Bot services...${NC}"

# Function to check service health
check_service_health() {
    local service_name=$1
    local health_endpoint=$2
    local expected_status=${3:-200}
    
    echo -n "Checking $service_name health... "
    
    for i in $(seq 1 $RETRY_COUNT); do
        if curl -f -s --max-time $TIMEOUT "$health_endpoint" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Healthy${NC}"
            return 0
        fi
        
        if [ $i -lt $RETRY_COUNT ]; then
            echo -n "retrying... "
            sleep 5
        fi
    done
    
    echo -e "${RED}✗ Unhealthy${NC}"
    return 1
}

# Function to check container status
check_container_status() {
    local container_name=$1
    
    echo -n "Checking $container_name container status... "
    
    if docker ps --filter "name=$container_name" --filter "status=running" --format "{{.Names}}" | grep -q "$container_name"; then
        echo -e "${GREEN}✓ Running${NC}"
        return 0
    else
        echo -e "${RED}✗ Not running${NC}"
        return 1
    fi
}

# Function to check paper trading safety
check_paper_trading_safety() {
    echo -n "Checking paper trading safety... "
    
    # Check environment variables
    if curl -f -s --max-time $TIMEOUT "http://localhost:3000/api/health/paper-trading" | grep -q "paper_trading_mode.*true"; then
        echo -e "${GREEN}✓ Paper trading mode active${NC}"
        return 0
    else
        echo -e "${RED}✗ Paper trading mode not confirmed${NC}"
        return 1
    fi
}

# Main health check execution
main() {
    local exit_code=0
    
    echo "=== Container Status Check ==="
    check_container_status "trading-bot-frontend" || exit_code=1
    check_container_status "trading-bot-backend" || exit_code=1
    check_container_status "trading-bot-postgres" || exit_code=1
    check_container_status "trading-bot-redis" || exit_code=1
    check_container_status "trading-bot-rabbitmq" || exit_code=1
    check_container_status "trading-bot-prometheus" || exit_code=1
    check_container_status "trading-bot-grafana" || exit_code=1
    
    echo ""
    echo "=== Service Health Check ==="
    check_service_health "Frontend" "http://localhost/health.html" || exit_code=1
    check_service_health "Backend API" "http://localhost:3000/health" || exit_code=1
    check_service_health "PostgreSQL" "http://localhost:3000/api/health/database" || exit_code=1
    check_service_health "Redis" "http://localhost:3000/api/health/redis" || exit_code=1
    check_service_health "RabbitMQ Management" "http://localhost:15672" || exit_code=1
    check_service_health "Prometheus" "http://localhost:9090/-/healthy" || exit_code=1
    check_service_health "Grafana" "http://localhost:3001/api/health" || exit_code=1
    
    echo ""
    echo "=== Paper Trading Safety Check ==="
    check_paper_trading_safety || exit_code=1
    
    echo ""
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓ All services are healthy and paper trading is properly configured!${NC}"
    else
        echo -e "${RED}✗ Some services are unhealthy or paper trading safety is not confirmed!${NC}"
    fi
    
    return $exit_code
}

# Run main function
main "$@"