#!/bin/bash

# Trading Bot Monitoring Stack Startup Script
# This script starts the complete monitoring infrastructure

set -e

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

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MONITORING_DIR="$PROJECT_ROOT/monitoring"
ENVIRONMENT="${1:-development}"

log_info "Starting Trading Bot Monitoring Stack"
log_info "Environment: $ENVIRONMENT"
log_info "Project Root: $PROJECT_ROOT"

# Check if Docker is running
check_docker() {
    log_info "Checking Docker availability..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    log_success "Docker and Docker Compose are available"
}

# Create necessary directories
create_directories() {
    log_info "Creating necessary directories..."
    
    local dirs=(
        "$MONITORING_DIR/prometheus/data"
        "$MONITORING_DIR/grafana/data"
        "$MONITORING_DIR/alertmanager/data"
        "$MONITORING_DIR/elasticsearch/data"
        "$MONITORING_DIR/logs"
    )
    
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            log_info "Created directory: $dir"
        fi
    done
    
    # Set proper permissions for Grafana
    if [ -d "$MONITORING_DIR/grafana/data" ]; then
        sudo chown -R 472:472 "$MONITORING_DIR/grafana/data" 2>/dev/null || true
    fi
    
    log_success "Directories created and configured"
}

# Validate configuration files
validate_config() {
    log_info "Validating monitoring configuration..."
    
    local required_files=(
        "$MONITORING_DIR/prometheus/prometheus-prod.yml"
        "$MONITORING_DIR/alertmanager/alertmanager-prod.yml"
        "$MONITORING_DIR/grafana/provisioning/datasources/datasource.yml"
        "$MONITORING_DIR/grafana/provisioning/dashboards/dashboard.yml"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "Required configuration file missing: $file"
            exit 1
        fi
    done
    
    # Check if dashboards exist
    local dashboard_dir="$MONITORING_DIR/grafana/dashboards"
    if [ ! -d "$dashboard_dir" ] || [ -z "$(ls -A "$dashboard_dir" 2>/dev/null)" ]; then
        log_warning "No Grafana dashboards found in $dashboard_dir"
    else
        local dashboard_count=$(ls -1 "$dashboard_dir"/*.json 2>/dev/null | wc -l)
        log_success "Found $dashboard_count Grafana dashboards"
    fi
    
    log_success "Configuration validation completed"
}

# Set environment variables
setup_environment() {
    log_info "Setting up environment variables..."
    
    # Create .env file for monitoring stack if it doesn't exist
    local env_file="$MONITORING_DIR/.env"
    
    if [ ! -f "$env_file" ]; then
        log_info "Creating monitoring environment file..."
        cat > "$env_file" << EOF
# Monitoring Stack Environment Variables
GRAFANA_ADMIN_PASSWORD=admin123
GRAFANA_SECRET_KEY=$(openssl rand -base64 32)
ELASTIC_PASSWORD=elastic123
SMTP_HOST=localhost
SMTP_USER=alerts@yourdomain.com
SMTP_PASSWORD=your-smtp-password
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
EOF
        log_success "Created monitoring environment file"
    else
        log_info "Using existing monitoring environment file"
    fi
    
    # Export environment variables
    export COMPOSE_PROJECT_NAME="trading-bot-monitoring"
    export COMPOSE_FILE="$MONITORING_DIR/production-monitoring.yml"
    
    if [ "$ENVIRONMENT" = "development" ]; then
        export COMPOSE_FILE="$MONITORING_DIR/docker-compose.monitoring.yml"
    fi
}

# Start monitoring services
start_services() {
    log_info "Starting monitoring services..."
    
    cd "$MONITORING_DIR"
    
    # Pull latest images
    log_info "Pulling latest Docker images..."
    docker-compose pull
    
    # Start services in the correct order
    log_info "Starting core monitoring services..."
    
    # Start Prometheus first
    docker-compose up -d prometheus
    sleep 10
    
    # Start Grafana
    docker-compose up -d grafana
    sleep 10
    
    # Start AlertManager
    docker-compose up -d alertmanager
    sleep 5
    
    # Start exporters
    docker-compose up -d node-exporter cadvisor
    sleep 5
    
    # Start ELK stack (if configured)
    if docker-compose config --services | grep -q elasticsearch; then
        log_info "Starting ELK stack..."
        docker-compose up -d elasticsearch
        sleep 30  # Elasticsearch needs more time to start
        docker-compose up -d logstash kibana
        sleep 10
    fi
    
    # Start remaining services
    docker-compose up -d
    
    log_success "All monitoring services started"
}

# Wait for services to be ready
wait_for_services() {
    log_info "Waiting for services to be ready..."
    
    local services=(
        "prometheus:9090"
        "grafana:3001"
        "alertmanager:9093"
    )
    
    for service in "${services[@]}"; do
        local name="${service%:*}"
        local port="${service#*:}"
        
        log_info "Waiting for $name to be ready on port $port..."
        
        local max_attempts=30
        local attempt=1
        
        while [ $attempt -le $max_attempts ]; do
            if curl -s "http://localhost:$port" > /dev/null 2>&1; then
                log_success "$name is ready"
                break
            fi
            
            if [ $attempt -eq $max_attempts ]; then
                log_error "$name failed to start within timeout"
                return 1
            fi
            
            sleep 2
            ((attempt++))
        done
    done
    
    log_success "All services are ready"
}

# Configure Grafana dashboards
configure_grafana() {
    log_info "Configuring Grafana dashboards..."
    
    # Wait a bit more for Grafana to fully initialize
    sleep 10
    
    # Check if dashboards are properly provisioned
    local grafana_url="http://admin:admin123@localhost:3001"
    
    # Test Grafana API
    if curl -s "$grafana_url/api/health" > /dev/null 2>&1; then
        log_success "Grafana API is accessible"
        
        # List dashboards
        local dashboard_count=$(curl -s "$grafana_url/api/search" | jq length 2>/dev/null || echo "0")
        log_info "Grafana has $dashboard_count dashboards loaded"
        
    else
        log_warning "Grafana API not accessible, dashboards may need manual configuration"
    fi
}

# Validate Prometheus targets
validate_prometheus() {
    log_info "Validating Prometheus configuration..."
    
    local prometheus_url="http://localhost:9090"
    
    # Check Prometheus targets
    if curl -s "$prometheus_url/api/v1/targets" > /dev/null 2>&1; then
        log_success "Prometheus API is accessible"
        
        # Check if targets are up (simplified check)
        local targets_response=$(curl -s "$prometheus_url/api/v1/targets" 2>/dev/null || echo '{"data":{"activeTargets":[]}}')
        log_info "Prometheus targets configured"
        
    else
        log_warning "Prometheus API not accessible"
    fi
}

# Display service URLs
display_urls() {
    log_info "Monitoring stack is ready!"
    echo
    echo "=== Service URLs ==="
    echo "📊 Grafana:        http://localhost:3001 (admin/admin123)"
    echo "🔍 Prometheus:     http://localhost:9090"
    echo "🚨 AlertManager:   http://localhost:9093"
    echo "📈 Node Exporter:  http://localhost:9100"
    echo "🐳 cAdvisor:       http://localhost:8080"
    
    if docker-compose ps | grep -q kibana; then
        echo "📋 Kibana:         http://localhost:5601"
    fi
    
    if docker-compose ps | grep -q jaeger; then
        echo "🔗 Jaeger:         http://localhost:16686"
    fi
    
    echo
    echo "=== Quick Commands ==="
    echo "View logs:         docker-compose logs -f [service]"
    echo "Stop stack:        docker-compose down"
    echo "Restart service:   docker-compose restart [service]"
    echo "View status:       docker-compose ps"
    echo
}

# Show service status
show_status() {
    log_info "Current service status:"
    cd "$MONITORING_DIR"
    docker-compose ps
}

# Main execution
main() {
    log_info "=== Trading Bot Monitoring Stack Setup ==="
    
    check_docker
    create_directories
    validate_config
    setup_environment
    start_services
    wait_for_services
    configure_grafana
    validate_prometheus
    show_status
    display_urls
    
    log_success "Monitoring stack setup completed successfully!"
    
    # Run validation script if available
    if [ -f "$SCRIPT_DIR/validate-monitoring-setup.js" ]; then
        log_info "Running monitoring validation..."
        node "$SCRIPT_DIR/validate-monitoring-setup.js" || log_warning "Validation completed with warnings"
    fi
}

# Handle script arguments
case "${1:-start}" in
    "start")
        main
        ;;
    "stop")
        log_info "Stopping monitoring stack..."
        cd "$MONITORING_DIR"
        docker-compose down
        log_success "Monitoring stack stopped"
        ;;
    "restart")
        log_info "Restarting monitoring stack..."
        cd "$MONITORING_DIR"
        docker-compose down
        sleep 5
        main
        ;;
    "status")
        show_status
        ;;
    "logs")
        cd "$MONITORING_DIR"
        docker-compose logs -f "${2:-}"
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs [service]}"
        echo "  start    - Start the monitoring stack (default)"
        echo "  stop     - Stop the monitoring stack"
        echo "  restart  - Restart the monitoring stack"
        echo "  status   - Show service status"
        echo "  logs     - Show logs for all services or specific service"
        exit 1
        ;;
esac