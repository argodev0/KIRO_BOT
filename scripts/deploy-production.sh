#!/bin/bash

# Production Deployment Script for AI Crypto Trading Bot
# This script handles secure production deployment with paper trading enforcement

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$PROJECT_ROOT/docker"
ENV_FILE="$PROJECT_ROOT/.env.production"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_critical() {
    echo -e "${RED}🚨 CRITICAL: $1${NC}"
}

# Function to validate environment file
validate_environment() {
    log_info "Validating production environment configuration..."
    
    if [ ! -f "$ENV_FILE" ]; then
        log_error "Production environment file not found: $ENV_FILE"
        log_info "Creating template from .env.example..."
        cp "$PROJECT_ROOT/.env.example" "$ENV_FILE"
        log_warning "Please configure $ENV_FILE before deployment"
        return 1
    fi
    
    # Source environment file
    source "$ENV_FILE"
    
    # Critical paper trading safety checks
    local errors=()
    
    if [ "$PAPER_TRADING_MODE" != "true" ]; then
        errors+=("PAPER_TRADING_MODE must be 'true' for production safety")
    fi
    
    if [ "$ALLOW_REAL_TRADES" = "true" ]; then
        errors+=("ALLOW_REAL_TRADES must be 'false' for production safety")
    fi
    
    if [ "$FORCE_PAPER_TRADING" != "true" ]; then
        errors+=("FORCE_PAPER_TRADING must be 'true' for production safety")
    fi
    
    if [ "$NODE_ENV" != "production" ]; then
        errors+=("NODE_ENV must be 'production'")
    fi
    
    # Exchange API safety checks
    if [ "$BINANCE_READ_ONLY" != "true" ]; then
        errors+=("BINANCE_READ_ONLY must be 'true' for paper trading safety")
    fi
    
    if [ "$KUCOIN_READ_ONLY" != "true" ]; then
        errors+=("KUCOIN_READ_ONLY must be 'true' for paper trading safety")
    fi
    
    if [ "$BINANCE_SANDBOX" = "true" ]; then
        errors+=("BINANCE_SANDBOX must be 'false' for mainnet data")
    fi
    
    if [ "$KUCOIN_SANDBOX" = "true" ]; then
        errors+=("KUCOIN_SANDBOX must be 'false' for mainnet data")
    fi
    
    # SSL configuration checks
    if [ "$SSL_ENABLED" != "true" ]; then
        errors+=("SSL_ENABLED must be 'true' for production")
    fi
    
    if [ -z "$DOMAIN_NAME" ] || [ "$DOMAIN_NAME" = "localhost" ]; then
        errors+=("DOMAIN_NAME must be set to your actual domain")
    fi
    
    if [ -z "$LETSENCRYPT_EMAIL" ] || [ "$LETSENCRYPT_EMAIL" = "admin@example.com" ]; then
        errors+=("LETSENCRYPT_EMAIL must be set to your actual email")
    fi
    
    # Security checks
    if [ -z "$JWT_SECRET" ] || [ ${#JWT_SECRET} -lt 32 ]; then
        errors+=("JWT_SECRET must be at least 32 characters long")
    fi
    
    if [ -z "$POSTGRES_PASSWORD" ] || [ ${#POSTGRES_PASSWORD} -lt 12 ]; then
        errors+=("POSTGRES_PASSWORD must be at least 12 characters long")
    fi
    
    # Report validation results
    if [ ${#errors[@]} -gt 0 ]; then
        log_critical "Environment validation failed:"
        for error in "${errors[@]}"; do
            log_error "  - $error"
        done
        return 1
    fi
    
    log_success "Environment validation passed"
    log_success "Paper trading safety confirmed"
    log_success "SSL configuration validated"
    log_success "Security configuration validated"
    
    return 0
}

# Function to validate Docker setup
validate_docker() {
    log_info "Validating Docker setup..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        return 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        return 1
    fi
    
    # Check if Docker Compose is available
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        return 1
    fi
    
    # Check if production Docker files exist
    local required_files=(
        "$DOCKER_DIR/docker-compose.prod.yml"
        "$DOCKER_DIR/Dockerfile.backend"
        "$DOCKER_DIR/Dockerfile.frontend"
        "$DOCKER_DIR/nginx/production.conf"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "Required Docker file not found: $file"
            return 1
        fi
    done
    
    log_success "Docker setup validation passed"
    return 0
}

# Function to run pre-deployment tests
run_tests() {
    log_info "Running pre-deployment tests..."
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies..."
        npm ci
    fi
    
    # Run linting
    log_info "Running linting..."
    if ! npm run lint; then
        log_error "Linting failed"
        return 1
    fi
    
    # Run type checking
    log_info "Running type checking..."
    if ! npm run type-check; then
        log_error "Type checking failed"
        return 1
    fi
    
    # Run unit tests
    log_info "Running unit tests..."
    if ! npm test -- --run; then
        log_error "Unit tests failed"
        return 1
    fi
    
    # Run paper trading safety tests
    log_info "Running paper trading safety tests..."
    if ! npm test -- --run src/__tests__/paperTradingSafety.test.ts; then
        log_error "Paper trading safety tests failed"
        return 1
    fi
    
    log_success "All tests passed"
    return 0
}

# Function to build Docker images
build_images() {
    log_info "Building Docker images..."
    
    cd "$PROJECT_ROOT"
    
    # Build backend image
    log_info "Building backend image..."
    if ! docker build -f docker/Dockerfile.backend -t trading-bot-backend:latest .; then
        log_error "Backend image build failed"
        return 1
    fi
    
    # Build frontend image
    log_info "Building frontend image..."
    if ! docker build -f docker/Dockerfile.frontend -t trading-bot-frontend:latest .; then
        log_error "Frontend image build failed"
        return 1
    fi
    
    log_success "Docker images built successfully"
    return 0
}

# Function to setup SSL certificates
setup_ssl() {
    log_info "Setting up SSL certificates..."
    
    # Run SSL setup script
    if ! "$DOCKER_DIR/scripts/ssl-setup.sh" setup; then
        log_error "SSL setup failed"
        return 1
    fi
    
    log_success "SSL setup completed"
    return 0
}

# Function to deploy services
deploy_services() {
    log_info "Deploying production services..."
    
    cd "$PROJECT_ROOT"
    
    # Copy environment file for Docker Compose
    cp "$ENV_FILE" "$DOCKER_DIR/.env"
    
    # Deploy with Docker Compose
    log_info "Starting services with Docker Compose..."
    if ! docker-compose -f docker/docker-compose.prod.yml up -d; then
        log_error "Service deployment failed"
        return 1
    fi
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker-compose -f docker/docker-compose.prod.yml ps | grep -q "Up (healthy)"; then
            log_success "Services are healthy"
            break
        fi
        
        attempt=$((attempt + 1))
        log_info "Waiting for services... ($attempt/$max_attempts)"
        sleep 10
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "Services failed to become healthy within timeout"
        return 1
    fi
    
    log_success "Production services deployed successfully"
    return 0
}

# Function to run post-deployment validation
validate_deployment() {
    log_info "Running post-deployment validation..."
    
    # Check service health
    log_info "Checking service health..."
    if ! curl -f http://localhost/health &> /dev/null; then
        log_error "Frontend health check failed"
        return 1
    fi
    
    if ! curl -f http://localhost:3000/health &> /dev/null; then
        log_error "Backend health check failed"
        return 1
    fi
    
    # Validate paper trading mode
    log_info "Validating paper trading mode..."
    local response=$(curl -s http://localhost:3000/api/config/trading-mode)
    if [[ "$response" != *"paper_trading"* ]]; then
        log_error "Paper trading mode validation failed"
        return 1
    fi
    
    # Check SSL if domain is configured
    if [ "$DOMAIN_NAME" != "localhost" ]; then
        log_info "Checking SSL certificate..."
        if ! curl -f "https://$DOMAIN_NAME/health" &> /dev/null; then
            log_warning "SSL health check failed - certificate may still be provisioning"
        else
            log_success "SSL certificate is working"
        fi
    fi
    
    log_success "Post-deployment validation passed"
    return 0
}

# Function to display deployment summary
show_summary() {
    log_success "🚀 Production deployment completed successfully!"
    echo ""
    echo "📋 Deployment Summary:"
    echo "====================="
    echo "🔒 Paper Trading Mode: ENABLED"
    echo "🚫 Real Trading: DISABLED"
    echo "🌐 SSL: ENABLED"
    echo "📊 Monitoring: ENABLED"
    echo ""
    echo "🌍 Access URLs:"
    if [ "$DOMAIN_NAME" != "localhost" ]; then
        echo "  Frontend: https://$DOMAIN_NAME"
        echo "  API: https://$DOMAIN_NAME/api"
    else
        echo "  Frontend: http://localhost"
        echo "  API: http://localhost:3000"
    fi
    echo "  Grafana: http://localhost:3001"
    echo "  Prometheus: http://localhost:9090"
    echo ""
    echo "📝 Next Steps:"
    echo "  1. Monitor logs: docker-compose -f docker/docker-compose.prod.yml logs -f"
    echo "  2. Check service status: docker-compose -f docker/docker-compose.prod.yml ps"
    echo "  3. View monitoring: http://localhost:3001 (admin/admin)"
    echo ""
    log_warning "⚠️  Remember: This system is in PAPER TRADING MODE ONLY"
    log_warning "   No real money will be traded - all trades are simulated"
}

# Function to handle cleanup on failure
cleanup_on_failure() {
    log_error "Deployment failed - cleaning up..."
    
    # Stop services
    docker-compose -f docker/docker-compose.prod.yml down || true
    
    # Remove environment file copy
    rm -f "$DOCKER_DIR/.env" || true
    
    log_info "Cleanup completed"
}

# Main deployment function
main() {
    echo "🚀 AI Crypto Trading Bot - Production Deployment"
    echo "================================================"
    echo ""
    
    # Trap errors for cleanup
    trap cleanup_on_failure ERR
    
    # Validation phase
    log_info "Phase 1: Validation"
    validate_environment || exit 1
    validate_docker || exit 1
    
    # Testing phase
    log_info "Phase 2: Testing"
    if [ "${SKIP_TESTS:-false}" != "true" ]; then
        run_tests || exit 1
    else
        log_warning "Skipping tests (SKIP_TESTS=true)"
    fi
    
    # Build phase
    log_info "Phase 3: Building"
    build_images || exit 1
    
    # SSL setup phase
    log_info "Phase 4: SSL Setup"
    setup_ssl || exit 1
    
    # Deployment phase
    log_info "Phase 5: Deployment"
    deploy_services || exit 1
    
    # Validation phase
    log_info "Phase 6: Post-deployment Validation"
    validate_deployment || exit 1
    
    # Success
    show_summary
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "validate")
        log_info "Running validation only..."
        validate_environment
        validate_docker
        ;;
    "test")
        log_info "Running tests only..."
        run_tests
        ;;
    "build")
        log_info "Building images only..."
        build_images
        ;;
    "ssl")
        log_info "Setting up SSL only..."
        setup_ssl
        ;;
    "help")
        echo "Production Deployment Script"
        echo "==========================="
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  deploy   - Full production deployment (default)"
        echo "  validate - Validate configuration only"
        echo "  test     - Run tests only"
        echo "  build    - Build Docker images only"
        echo "  ssl      - Setup SSL certificates only"
        echo "  help     - Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  SKIP_TESTS=true - Skip test execution"
        ;;
    *)
        log_error "Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac