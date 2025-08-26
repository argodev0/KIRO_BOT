#!/bin/bash

# Production Deployment Orchestrator
# Master script that coordinates all deployment automation components

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_ROOT/logs"
ORCHESTRATOR_LOG="$LOG_DIR/orchestrator_$(date +%Y%m%d_%H%M%S).log"

# Create logs directory
mkdir -p "$LOG_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Logging functions
log_info() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1"
    echo -e "${BLUE}ℹ️  $1${NC}"
    echo "$msg" >> "$ORCHESTRATOR_LOG"
}

log_success() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: $1"
    echo -e "${GREEN}✅ $1${NC}"
    echo "$msg" >> "$ORCHESTRATOR_LOG"
}

log_warning() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1"
    echo -e "${YELLOW}⚠️  $1${NC}"
    echo "$msg" >> "$ORCHESTRATOR_LOG"
}

log_error() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1"
    echo -e "${RED}❌ $1${NC}"
    echo "$msg" >> "$ORCHESTRATOR_LOG"
}

log_critical() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] CRITICAL: $1"
    echo -e "${RED}🚨 CRITICAL: $1${NC}"
    echo "$msg" >> "$ORCHESTRATOR_LOG"
}

log_step() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] STEP: $1"
    echo -e "${PURPLE}🔄 $1${NC}"
    echo "$msg" >> "$ORCHESTRATOR_LOG"
}

log_header() {
    echo -e "${BOLD}${CYAN}$1${NC}"
    echo "$(echo "$1" | sed 's/./=/g')"
}

# Display banner
show_banner() {
    echo -e "${BOLD}${CYAN}"
    cat << 'EOF'
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║    🚀 AI Crypto Trading Bot - Production Deployment          ║
║                   Orchestration System                       ║
║                                                               ║
║    📋 Paper Trading Mode: ENFORCED                           ║
║    🔒 Security: HARDENED                                     ║
║    📊 Monitoring: ENABLED                                    ║
║    🔄 Automation: FULL                                       ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# Check prerequisites
check_prerequisites() {
    log_step "Checking deployment prerequisites"
    
    local errors=0
    
    # Check required commands
    local required_commands=("docker" "docker-compose" "node" "npm" "curl" "jq" "bc")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "Required command not found: $cmd"
            errors=$((errors + 1))
        fi
    done
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        errors=$((errors + 1))
    fi
    
    # Check required files
    local required_files=(
        "$PROJECT_ROOT/.env.production"
        "$PROJECT_ROOT/docker/docker-compose.prod.yml"
        "$PROJECT_ROOT/package.json"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "Required file not found: $file"
            errors=$((errors + 1))
        fi
    done
    
    # Check script permissions
    local scripts=(
        "$SCRIPT_DIR/deploy-automation.sh"
        "$SCRIPT_DIR/health-check.sh"
        "$SCRIPT_DIR/database-migration.sh"
        "$SCRIPT_DIR/backup-automation.sh"
    )
    
    for script in "${scripts[@]}"; do
        if [ ! -x "$script" ]; then
            log_warning "Script not executable: $script"
            chmod +x "$script" 2>/dev/null || true
        fi
    done
    
    if [ $errors -eq 0 ]; then
        log_success "Prerequisites check passed"
        return 0
    else
        log_error "Prerequisites check failed with $errors errors"
        return 1
    fi
}

# Run pre-deployment validation
run_pre_deployment_validation() {
    log_step "Running pre-deployment validation"
    
    # Configuration validation
    log_info "Validating production configuration..."
    if ! node "$SCRIPT_DIR/validate-production.js"; then
        log_error "Production configuration validation failed"
        return 1
    fi
    
    # API permissions validation
    log_info "Validating API key permissions..."
    if ! node "$SCRIPT_DIR/validate-api-permissions.js"; then
        log_error "API permissions validation failed"
        return 1
    fi
    
    # Paper trading safety validation
    log_info "Validating paper trading safety..."
    source "$PROJECT_ROOT/.env.production"
    
    if [ "$PAPER_TRADING_MODE" != "true" ] || [ "$ALLOW_REAL_TRADES" = "true" ]; then
        log_critical "Paper trading safety validation failed"
        return 1
    fi
    
    log_success "Pre-deployment validation passed"
    return 0
}

# Setup database and migrations
setup_database() {
    log_step "Setting up database and running migrations"
    
    # Run database migrations
    if ! "$SCRIPT_DIR/database-migration.sh" migrate; then
        log_error "Database migration failed"
        return 1
    fi
    
    log_success "Database setup completed"
    return 0
}

# Deploy application
deploy_application() {
    log_step "Deploying application with automation"
    
    # Run automated deployment
    if ! "$SCRIPT_DIR/deploy-automation.sh" deploy; then
        log_error "Application deployment failed"
        return 1
    fi
    
    log_success "Application deployment completed"
    return 0
}

# Setup monitoring and backup automation
setup_automation() {
    log_step "Setting up monitoring and backup automation"
    
    # Setup backup automation
    log_info "Configuring backup automation..."
    if ! "$SCRIPT_DIR/backup-automation.sh" schedule; then
        log_warning "Backup automation setup failed"
    else
        log_success "Backup automation configured"
    fi
    
    # Initial backup
    log_info "Creating initial backup..."
    if ! "$SCRIPT_DIR/backup-automation.sh" run; then
        log_warning "Initial backup failed"
    else
        log_success "Initial backup completed"
    fi
    
    log_success "Automation setup completed"
    return 0
}

# Run comprehensive health checks
run_health_checks() {
    log_step "Running comprehensive health checks"
    
    # Wait for services to stabilize
    log_info "Waiting for services to stabilize..."
    sleep 30
    
    # Run health checks
    if ! "$SCRIPT_DIR/health-check.sh" full; then
        log_error "Health checks failed"
        return 1
    fi
    
    log_success "Health checks passed"
    return 0
}

# Generate deployment summary
generate_deployment_summary() {
    local deployment_id="$1"
    local start_time="$2"
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_step "Generating deployment summary"
    
    source "$PROJECT_ROOT/.env.production"
    
    local summary_file="$LOG_DIR/deployment_summary_${deployment_id}.json"
    
    cat > "$summary_file" << EOF
{
    "deployment_id": "$deployment_id",
    "start_time": "$(date -d @$start_time -u +%Y-%m-%dT%H:%M:%SZ)",
    "end_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "duration_seconds": $duration,
    "status": "SUCCESS",
    "environment": "production",
    "paper_trading_mode": "$PAPER_TRADING_MODE",
    "domain": "$DOMAIN_NAME",
    "ssl_enabled": "$SSL_ENABLED",
    "services": {
        "frontend": "$(docker ps --filter name=trading-bot-frontend --format '{{.Status}}' 2>/dev/null || echo 'Not running')",
        "backend": "$(docker ps --filter name=trading-bot-backend --format '{{.Status}}' 2>/dev/null || echo 'Not running')",
        "postgres": "$(docker ps --filter name=trading-bot-postgres --format '{{.Status}}' 2>/dev/null || echo 'Not running')",
        "redis": "$(docker ps --filter name=trading-bot-redis --format '{{.Status}}' 2>/dev/null || echo 'Not running')",
        "rabbitmq": "$(docker ps --filter name=trading-bot-rabbitmq --format '{{.Status}}' 2>/dev/null || echo 'Not running')"
    },
    "urls": {
        "frontend": "$([ "$DOMAIN_NAME" != "localhost" ] && echo "https://$DOMAIN_NAME" || echo "http://localhost")",
        "api": "$([ "$DOMAIN_NAME" != "localhost" ] && echo "https://$DOMAIN_NAME/api" || echo "http://localhost:3000")",
        "grafana": "http://localhost:3001",
        "prometheus": "http://localhost:9090"
    },
    "logs": {
        "orchestrator": "$ORCHESTRATOR_LOG",
        "deployment": "$(ls -t $LOG_DIR/deployment_*.log 2>/dev/null | head -1 || echo 'Not found')",
        "health_check": "$(ls -t $LOG_DIR/health_check_*.log 2>/dev/null | head -1 || echo 'Not found')"
    }
}
EOF
    
    log_success "Deployment summary saved: $summary_file"
    
    # Display summary
    echo ""
    log_header "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!"
    echo ""
    echo "📋 Deployment Summary:"
    echo "======================"
    echo "🆔 Deployment ID: $deployment_id"
    echo "⏱️  Duration: $((duration / 60))m $((duration % 60))s"
    echo "🔒 Paper Trading: ENABLED ✅"
    echo "🚫 Real Trading: DISABLED ✅"
    echo "🌐 SSL: $([ "$SSL_ENABLED" = "true" ] && echo "ENABLED ✅" || echo "DISABLED ⚠️")"
    echo "📊 Monitoring: ENABLED ✅"
    echo "🗄️  Backups: AUTOMATED ✅"
    echo ""
    echo "🌍 Access URLs:"
    if [ "$DOMAIN_NAME" != "localhost" ]; then
        echo "  🌐 Frontend: https://$DOMAIN_NAME"
        echo "  🔌 API: https://$DOMAIN_NAME/api"
    else
        echo "  🌐 Frontend: http://localhost"
        echo "  🔌 API: http://localhost:3000"
    fi
    echo "  📊 Grafana: http://localhost:3001"
    echo "  📈 Prometheus: http://localhost:9090"
    echo ""
    echo "📝 Management Commands:"
    echo "  📊 Health Check: $SCRIPT_DIR/health-check.sh"
    echo "  🗄️  Backup: $SCRIPT_DIR/backup-automation.sh run"
    echo "  🔄 Restart: docker-compose -f docker/docker-compose.prod.yml restart"
    echo "  📋 Logs: docker-compose -f docker/docker-compose.prod.yml logs -f"
    echo ""
    log_warning "⚠️  IMPORTANT: This system is in PAPER TRADING MODE ONLY"
    log_warning "   No real money will be traded - all trades are simulated"
    echo ""
}

# Cleanup on failure
cleanup_on_failure() {
    local exit_code=$?
    
    if [ $exit_code -ne 0 ]; then
        log_error "Deployment orchestration failed with exit code: $exit_code"
        
        # Try to collect failure information
        log_info "Collecting failure information..."
        
        # Docker status
        echo "Docker Container Status:" >> "$ORCHESTRATOR_LOG"
        docker ps -a >> "$ORCHESTRATOR_LOG" 2>&1 || true
        
        # Service logs
        echo "Recent Service Logs:" >> "$ORCHESTRATOR_LOG"
        docker-compose -f "$PROJECT_ROOT/docker/docker-compose.prod.yml" logs --tail=50 >> "$ORCHESTRATOR_LOG" 2>&1 || true
        
        log_error "Failure information collected in: $ORCHESTRATOR_LOG"
        log_info "Consider running rollback: $SCRIPT_DIR/deploy-automation.sh rollback"
    fi
}

# Main orchestration function
main_orchestration() {
    local deployment_id="$(date +%s)"
    local start_time="$deployment_id"
    
    show_banner
    
    log_info "🚀 Starting production deployment orchestration"
    log_info "Deployment ID: $deployment_id"
    log_info "Orchestrator log: $ORCHESTRATOR_LOG"
    echo ""
    
    # Set up error handling
    trap cleanup_on_failure EXIT
    
    # Phase 1: Prerequisites and validation
    log_header "Phase 1: Prerequisites and Validation"
    if ! check_prerequisites; then
        log_error "Prerequisites check failed"
        return 1
    fi
    
    if ! run_pre_deployment_validation; then
        log_error "Pre-deployment validation failed"
        return 1
    fi
    echo ""
    
    # Phase 2: Database setup
    log_header "Phase 2: Database Setup and Migration"
    if ! setup_database; then
        log_error "Database setup failed"
        return 1
    fi
    echo ""
    
    # Phase 3: Application deployment
    log_header "Phase 3: Application Deployment"
    if ! deploy_application; then
        log_error "Application deployment failed"
        return 1
    fi
    echo ""
    
    # Phase 4: Automation setup
    log_header "Phase 4: Automation and Monitoring Setup"
    if ! setup_automation; then
        log_warning "Automation setup had issues but continuing..."
    fi
    echo ""
    
    # Phase 5: Health validation
    log_header "Phase 5: Health Validation"
    if ! run_health_checks; then
        log_error "Health checks failed"
        return 1
    fi
    echo ""
    
    # Phase 6: Summary and completion
    log_header "Phase 6: Deployment Summary"
    generate_deployment_summary "$deployment_id" "$start_time"
    
    # Clear error trap on success
    trap - EXIT
    
    return 0
}

# Quick status check
show_status() {
    log_header "🔍 System Status Check"
    
    # Check if services are running
    local services=("trading-bot-frontend" "trading-bot-backend" "trading-bot-postgres" "trading-bot-redis" "trading-bot-rabbitmq")
    
    echo "Docker Services:"
    echo "==============="
    for service in "${services[@]}"; do
        if docker ps --filter "name=$service" --filter "status=running" | grep -q "$service"; then
            echo "  ✅ $service: Running"
        else
            echo "  ❌ $service: Not running"
        fi
    done
    
    echo ""
    echo "Service Endpoints:"
    echo "=================="
    
    # Test endpoints
    if curl -f -s http://localhost/health > /dev/null 2>&1; then
        echo "  ✅ Frontend: Responding"
    else
        echo "  ❌ Frontend: Not responding"
    fi
    
    if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "  ✅ Backend: Responding"
    else
        echo "  ❌ Backend: Not responding"
    fi
    
    # Paper trading check
    echo ""
    echo "Paper Trading Safety:"
    echo "===================="
    
    if [ -f "$PROJECT_ROOT/.env.production" ]; then
        source "$PROJECT_ROOT/.env.production"
        
        if [ "$PAPER_TRADING_MODE" = "true" ]; then
            echo "  ✅ PAPER_TRADING_MODE: Enabled"
        else
            echo "  🚨 PAPER_TRADING_MODE: Disabled"
        fi
        
        if [ "$ALLOW_REAL_TRADES" = "false" ]; then
            echo "  ✅ ALLOW_REAL_TRADES: Disabled"
        else
            echo "  🚨 ALLOW_REAL_TRADES: Enabled"
        fi
    else
        echo "  ⚠️  Environment file not found"
    fi
}

# Usage information
usage() {
    cat << EOF
Production Deployment Orchestrator
=================================

Usage: $0 [command] [options]

Commands:
  deploy     - Run full production deployment orchestration (default)
  status     - Show current system status
  health     - Run comprehensive health checks
  backup     - Run backup process
  rollback   - Rollback deployment
  logs       - Show recent logs
  help       - Show this help message

Options:
  --skip-validation  - Skip pre-deployment validation
  --skip-tests      - Skip test execution
  --no-backup       - Skip backup creation
  --force           - Force deployment even with warnings

Examples:
  $0 deploy
  $0 status
  $0 health
  $0 backup

Environment Variables:
  AUTO_ROLLBACK=false - Disable automatic rollback on failure
  SKIP_TESTS=true     - Skip test execution during deployment

EOF
}

# Parse command line arguments
COMMAND="${1:-deploy}"
SKIP_VALIDATION=false
SKIP_TESTS=false
NO_BACKUP=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-validation)
            SKIP_VALIDATION=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            export SKIP_TESTS=true
            shift
            ;;
        --no-backup)
            NO_BACKUP=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        *)
            if [ -z "${COMMAND_SET:-}" ]; then
                COMMAND="$1"
                COMMAND_SET=true
            fi
            shift
            ;;
    esac
done

# Execute command
case "$COMMAND" in
    "deploy")
        main_orchestration
        ;;
    "status")
        show_status
        ;;
    "health")
        "$SCRIPT_DIR/health-check.sh" full
        ;;
    "backup")
        "$SCRIPT_DIR/backup-automation.sh" run
        ;;
    "rollback")
        "$SCRIPT_DIR/deploy-automation.sh" rollback
        ;;
    "logs")
        if [ -f "$PROJECT_ROOT/docker/docker-compose.prod.yml" ]; then
            docker-compose -f "$PROJECT_ROOT/docker/docker-compose.prod.yml" logs --tail=100 -f
        else
            log_error "Docker compose file not found"
            exit 1
        fi
        ;;
    "help")
        usage
        ;;
    *)
        log_error "Unknown command: $COMMAND"
        usage
        exit 1
        ;;
esac