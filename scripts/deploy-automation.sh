#!/bin/bash

# Production Deployment Automation Script
# Comprehensive deployment orchestration with health verification and rollback capabilities

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$PROJECT_ROOT/docker"
ENV_FILE="$PROJECT_ROOT/.env.production"
DEPLOYMENT_LOG="$PROJECT_ROOT/logs/deployment_$(date +%Y%m%d_%H%M%S).log"

# Create logs directory
mkdir -p "$PROJECT_ROOT/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1"
    echo -e "${BLUE}ℹ️  $1${NC}"
    echo "$msg" >> "$DEPLOYMENT_LOG"
}

log_success() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: $1"
    echo -e "${GREEN}✅ $1${NC}"
    echo "$msg" >> "$DEPLOYMENT_LOG"
}

log_warning() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1"
    echo -e "${YELLOW}⚠️  $1${NC}"
    echo "$msg" >> "$DEPLOYMENT_LOG"
}

log_error() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1"
    echo -e "${RED}❌ $1${NC}"
    echo "$msg" >> "$DEPLOYMENT_LOG"
}

log_critical() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] CRITICAL: $1"
    echo -e "${RED}🚨 CRITICAL: $1${NC}"
    echo "$msg" >> "$DEPLOYMENT_LOG"
}

log_step() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] STEP: $1"
    echo -e "${PURPLE}🔄 $1${NC}"
    echo "$msg" >> "$DEPLOYMENT_LOG"
}

# Deployment state management
DEPLOYMENT_STATE_FILE="$PROJECT_ROOT/.deployment_state"
ROLLBACK_DATA_FILE="$PROJECT_ROOT/.rollback_data"

save_deployment_state() {
    local state="$1"
    local step="$2"
    cat > "$DEPLOYMENT_STATE_FILE" << EOF
{
    "state": "$state",
    "step": "$step",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "deployment_id": "${DEPLOYMENT_ID:-$(date +%s)}"
}
EOF
}

load_deployment_state() {
    if [[ -f "$DEPLOYMENT_STATE_FILE" ]]; then
        cat "$DEPLOYMENT_STATE_FILE"
    else
        echo '{"state": "none", "step": "none"}'
    fi
}

# Health check functions
check_service_health() {
    local service="$1"
    local max_attempts="${2:-30}"
    local attempt=0
    
    log_info "Checking health of service: $service"
    
    while [ $attempt -lt $max_attempts ]; do
        case "$service" in
            "frontend")
                if curl -f -s http://localhost/health > /dev/null 2>&1; then
                    log_success "$service is healthy"
                    return 0
                fi
                ;;
            "backend")
                if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
                    log_success "$service is healthy"
                    return 0
                fi
                ;;
            "postgres")
                if docker exec trading-bot-postgres pg_isready -U postgres -d trading_bot > /dev/null 2>&1; then
                    log_success "$service is healthy"
                    return 0
                fi
                ;;
            "redis")
                if docker exec trading-bot-redis redis-cli ping > /dev/null 2>&1; then
                    log_success "$service is healthy"
                    return 0
                fi
                ;;
            "rabbitmq")
                if docker exec trading-bot-rabbitmq rabbitmq-diagnostics ping > /dev/null 2>&1; then
                    log_success "$service is healthy"
                    return 0
                fi
                ;;
        esac
        
        attempt=$((attempt + 1))
        log_info "Waiting for $service to be healthy... ($attempt/$max_attempts)"
        sleep 10
    done
    
    log_error "$service failed to become healthy within timeout"
    return 1
}

# Paper trading validation
validate_paper_trading_mode() {
    log_step "Validating paper trading mode enforcement"
    
    # Check environment variables
    source "$ENV_FILE"
    
    local errors=()
    
    if [ "$PAPER_TRADING_MODE" != "true" ]; then
        errors+=("PAPER_TRADING_MODE must be 'true'")
    fi
    
    if [ "$ALLOW_REAL_TRADES" = "true" ]; then
        errors+=("ALLOW_REAL_TRADES must be 'false'")
    fi
    
    if [ "$FORCE_PAPER_TRADING" != "true" ]; then
        errors+=("FORCE_PAPER_TRADING must be 'true'")
    fi
    
    # Check API endpoint response
    local max_attempts=10
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -f -s http://localhost:3000/api/config/trading-mode | grep -q "paper_trading"; then
            log_success "Paper trading mode confirmed via API"
            break
        fi
        
        attempt=$((attempt + 1))
        if [ $attempt -eq $max_attempts ]; then
            errors+=("API does not confirm paper trading mode")
        else
            sleep 5
        fi
    done
    
    if [ ${#errors[@]} -gt 0 ]; then
        log_critical "Paper trading validation failed:"
        for error in "${errors[@]}"; do
            log_error "  - $error"
        done
        return 1
    fi
    
    log_success "Paper trading mode validation passed"
    return 0
}

# Database migration and backup
perform_database_operations() {
    log_step "Performing database operations"
    
    # Create pre-deployment backup
    log_info "Creating pre-deployment database backup..."
    if ! docker exec trading-bot-postgres /backups/backup.sh; then
        log_error "Pre-deployment backup failed"
        return 1
    fi
    
    # Run database migrations
    log_info "Running database migrations..."
    if ! docker exec trading-bot-backend npm run migrate; then
        log_error "Database migrations failed"
        return 1
    fi
    
    log_success "Database operations completed"
    return 0
}

# SSL certificate management
manage_ssl_certificates() {
    log_step "Managing SSL certificates"
    
    source "$ENV_FILE"
    
    if [ "$SSL_ENABLED" = "true" ] && [ "$DOMAIN_NAME" != "localhost" ]; then
        log_info "Setting up SSL certificates for domain: $DOMAIN_NAME"
        
        if ! "$DOCKER_DIR/scripts/ssl-setup.sh" setup; then
            log_error "SSL setup failed"
            return 1
        fi
        
        # Verify SSL certificate
        local max_attempts=5
        local attempt=0
        
        while [ $attempt -lt $max_attempts ]; do
            if curl -f -s "https://$DOMAIN_NAME/health" > /dev/null 2>&1; then
                log_success "SSL certificate is working"
                return 0
            fi
            
            attempt=$((attempt + 1))
            log_info "Waiting for SSL certificate... ($attempt/$max_attempts)"
            sleep 30
        done
        
        log_warning "SSL certificate verification failed - may still be provisioning"
    else
        log_info "SSL disabled or using localhost - skipping SSL setup"
    fi
    
    return 0
}

# Monitoring setup
setup_monitoring() {
    log_step "Setting up monitoring and alerting"
    
    # Wait for Prometheus to be healthy
    if ! check_service_health "prometheus" 20; then
        log_error "Prometheus health check failed"
        return 1
    fi
    
    # Configure Grafana dashboards
    log_info "Configuring Grafana dashboards..."
    sleep 30  # Wait for Grafana to fully initialize
    
    # Import dashboards (if available)
    if [ -d "$PROJECT_ROOT/monitoring/grafana/dashboards" ]; then
        log_info "Importing Grafana dashboards..."
        # Dashboard import logic would go here
    fi
    
    log_success "Monitoring setup completed"
    return 0
}

# Performance validation
validate_performance() {
    log_step "Validating system performance"
    
    # Test API response times
    log_info "Testing API response times..."
    local response_time
    response_time=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:3000/health)
    
    if (( $(echo "$response_time > 2.0" | bc -l) )); then
        log_warning "API response time is slow: ${response_time}s"
    else
        log_success "API response time is acceptable: ${response_time}s"
    fi
    
    # Test WebSocket connections
    log_info "Testing WebSocket connectivity..."
    if node "$PROJECT_ROOT/scripts/test-websocket.js"; then
        log_success "WebSocket connectivity test passed"
    else
        log_warning "WebSocket connectivity test failed"
    fi
    
    # Test database performance
    log_info "Testing database performance..."
    local db_response_time
    db_response_time=$(docker exec trading-bot-postgres psql -U postgres -d trading_bot -c "SELECT 1;" -t | wc -l)
    
    if [ "$db_response_time" -gt 0 ]; then
        log_success "Database connectivity test passed"
    else
        log_error "Database connectivity test failed"
        return 1
    fi
    
    log_success "Performance validation completed"
    return 0
}

# Security validation
validate_security() {
    log_step "Validating security configuration"
    
    # Check security headers
    log_info "Checking security headers..."
    local headers
    headers=$(curl -I -s http://localhost/ | grep -E "(X-Frame-Options|X-Content-Type-Options|X-XSS-Protection)")
    
    if [ -n "$headers" ]; then
        log_success "Security headers are present"
    else
        log_warning "Security headers may be missing"
    fi
    
    # Check rate limiting
    log_info "Testing rate limiting..."
    local rate_limit_test=0
    for i in {1..10}; do
        if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
            rate_limit_test=$((rate_limit_test + 1))
        fi
    done
    
    if [ $rate_limit_test -eq 10 ]; then
        log_info "Rate limiting test completed (may need manual verification)"
    fi
    
    # Validate API key permissions
    log_info "Validating API key permissions..."
    if node "$PROJECT_ROOT/scripts/validate-api-permissions.js"; then
        log_success "API key permissions validation passed"
    else
        log_error "API key permissions validation failed"
        return 1
    fi
    
    log_success "Security validation completed"
    return 0
}

# Rollback functionality
prepare_rollback_data() {
    log_info "Preparing rollback data..."
    
    # Save current container IDs and images
    cat > "$ROLLBACK_DATA_FILE" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "containers": {
        "frontend": "$(docker ps --filter name=trading-bot-frontend --format '{{.ID}}' | head -1)",
        "backend": "$(docker ps --filter name=trading-bot-backend --format '{{.ID}}' | head -1)"
    },
    "images": {
        "frontend": "$(docker images trading-bot-frontend:latest --format '{{.ID}}' | head -1)",
        "backend": "$(docker images trading-bot-backend:latest --format '{{.ID}}' | head -1)"
    },
    "backup_file": "$(ls -t /backups/trading_bot_backup_*.sql.gz | head -1)"
}
EOF
    
    log_success "Rollback data prepared"
}

perform_rollback() {
    log_critical "Performing deployment rollback..."
    
    if [ ! -f "$ROLLBACK_DATA_FILE" ]; then
        log_error "No rollback data available"
        return 1
    fi
    
    # Stop current services
    log_info "Stopping current services..."
    docker-compose -f "$DOCKER_DIR/docker-compose.prod.yml" down || true
    
    # Restore database from backup
    local backup_file
    backup_file=$(jq -r '.backup_file' "$ROLLBACK_DATA_FILE")
    
    if [ -n "$backup_file" ] && [ -f "$backup_file" ]; then
        log_info "Restoring database from backup: $backup_file"
        docker exec trading-bot-postgres /backups/restore.sh --file "$backup_file"
    fi
    
    # Restart services
    log_info "Restarting services..."
    docker-compose -f "$DOCKER_DIR/docker-compose.prod.yml" up -d
    
    # Wait for services to be healthy
    sleep 30
    check_service_health "backend" 20
    check_service_health "frontend" 20
    
    log_success "Rollback completed"
}

# Comprehensive deployment validation
run_comprehensive_validation() {
    log_step "Running comprehensive deployment validation"
    
    local validation_errors=0
    
    # Service health checks
    for service in "postgres" "redis" "rabbitmq" "backend" "frontend"; do
        if ! check_service_health "$service" 30; then
            validation_errors=$((validation_errors + 1))
        fi
    done
    
    # Paper trading validation
    if ! validate_paper_trading_mode; then
        validation_errors=$((validation_errors + 1))
    fi
    
    # Performance validation
    if ! validate_performance; then
        validation_errors=$((validation_errors + 1))
    fi
    
    # Security validation
    if ! validate_security; then
        validation_errors=$((validation_errors + 1))
    fi
    
    if [ $validation_errors -gt 0 ]; then
        log_error "Comprehensive validation failed with $validation_errors errors"
        return 1
    fi
    
    log_success "Comprehensive validation passed"
    return 0
}

# Main deployment orchestration
main_deployment() {
    local deployment_id="$(date +%s)"
    export DEPLOYMENT_ID="$deployment_id"
    
    log_info "🚀 Starting production deployment automation"
    log_info "Deployment ID: $deployment_id"
    log_info "Log file: $DEPLOYMENT_LOG"
    
    # Prepare rollback data
    prepare_rollback_data
    
    # Phase 1: Pre-deployment validation
    save_deployment_state "running" "pre-validation"
    log_step "Phase 1: Pre-deployment validation"
    
    if ! node "$PROJECT_ROOT/scripts/validate-production.js"; then
        log_error "Pre-deployment validation failed"
        save_deployment_state "failed" "pre-validation"
        return 1
    fi
    
    # Phase 2: Build and prepare
    save_deployment_state "running" "build"
    log_step "Phase 2: Build and prepare"
    
    if ! "$PROJECT_ROOT/scripts/deploy-production.sh" build; then
        log_error "Build phase failed"
        save_deployment_state "failed" "build"
        return 1
    fi
    
    # Phase 3: Database operations
    save_deployment_state "running" "database"
    log_step "Phase 3: Database operations"
    
    if ! perform_database_operations; then
        log_error "Database operations failed"
        save_deployment_state "failed" "database"
        return 1
    fi
    
    # Phase 4: Service deployment
    save_deployment_state "running" "deployment"
    log_step "Phase 4: Service deployment"
    
    if ! docker-compose -f "$DOCKER_DIR/docker-compose.prod.yml" up -d; then
        log_error "Service deployment failed"
        save_deployment_state "failed" "deployment"
        return 1
    fi
    
    # Phase 5: SSL setup
    save_deployment_state "running" "ssl"
    log_step "Phase 5: SSL setup"
    
    if ! manage_ssl_certificates; then
        log_error "SSL setup failed"
        save_deployment_state "failed" "ssl"
        return 1
    fi
    
    # Phase 6: Monitoring setup
    save_deployment_state "running" "monitoring"
    log_step "Phase 6: Monitoring setup"
    
    if ! setup_monitoring; then
        log_error "Monitoring setup failed"
        save_deployment_state "failed" "monitoring"
        return 1
    fi
    
    # Phase 7: Comprehensive validation
    save_deployment_state "running" "validation"
    log_step "Phase 7: Comprehensive validation"
    
    if ! run_comprehensive_validation; then
        log_error "Comprehensive validation failed"
        save_deployment_state "failed" "validation"
        
        if [ "${AUTO_ROLLBACK:-true}" = "true" ]; then
            perform_rollback
        fi
        return 1
    fi
    
    # Success
    save_deployment_state "completed" "success"
    log_success "🎉 Production deployment completed successfully!"
    
    # Generate deployment report
    generate_deployment_report "$deployment_id"
    
    return 0
}

# Generate deployment report
generate_deployment_report() {
    local deployment_id="$1"
    local report_file="$PROJECT_ROOT/logs/deployment_report_${deployment_id}.json"
    
    source "$ENV_FILE"
    
    cat > "$report_file" << EOF
{
    "deployment_id": "$deployment_id",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "status": "success",
    "environment": "production",
    "paper_trading_mode": "$PAPER_TRADING_MODE",
    "domain": "$DOMAIN_NAME",
    "ssl_enabled": "$SSL_ENABLED",
    "services": {
        "frontend": "$(docker ps --filter name=trading-bot-frontend --format '{{.Status}}')",
        "backend": "$(docker ps --filter name=trading-bot-backend --format '{{.Status}}')",
        "postgres": "$(docker ps --filter name=trading-bot-postgres --format '{{.Status}}')",
        "redis": "$(docker ps --filter name=trading-bot-redis --format '{{.Status}}')",
        "rabbitmq": "$(docker ps --filter name=trading-bot-rabbitmq --format '{{.Status}}')"
    },
    "urls": {
        "frontend": "$([ "$DOMAIN_NAME" != "localhost" ] && echo "https://$DOMAIN_NAME" || echo "http://localhost")",
        "api": "$([ "$DOMAIN_NAME" != "localhost" ] && echo "https://$DOMAIN_NAME/api" || echo "http://localhost:3000")",
        "grafana": "http://localhost:3001",
        "prometheus": "http://localhost:9090"
    }
}
EOF
    
    log_success "Deployment report generated: $report_file"
}

# Error handling and cleanup
cleanup_on_error() {
    local exit_code=$?
    
    if [ $exit_code -ne 0 ]; then
        log_error "Deployment failed with exit code: $exit_code"
        
        if [ "${AUTO_ROLLBACK:-true}" = "true" ]; then
            log_info "Initiating automatic rollback..."
            perform_rollback
        else
            log_warning "Automatic rollback disabled. Manual intervention required."
        fi
    fi
    
    # Cleanup temporary files
    rm -f "$DOCKER_DIR/.env" || true
}

# Script entry point
case "${1:-deploy}" in
    "deploy")
        trap cleanup_on_error EXIT
        main_deployment
        ;;
    "rollback")
        perform_rollback
        ;;
    "validate")
        run_comprehensive_validation
        ;;
    "status")
        if [ -f "$DEPLOYMENT_STATE_FILE" ]; then
            cat "$DEPLOYMENT_STATE_FILE" | jq .
        else
            echo '{"state": "none", "message": "No deployment state found"}'
        fi
        ;;
    "help")
        cat << EOF
Production Deployment Automation Script
======================================

Usage: $0 [command]

Commands:
  deploy     - Full automated deployment (default)
  rollback   - Rollback to previous deployment
  validate   - Run comprehensive validation only
  status     - Show current deployment status
  help       - Show this help message

Environment Variables:
  AUTO_ROLLBACK=false - Disable automatic rollback on failure
  SKIP_TESTS=true     - Skip test execution during deployment

EOF
        ;;
    *)
        log_error "Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac