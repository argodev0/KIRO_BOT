#!/bin/bash

# Comprehensive Health Check Script
# Validates all system components and paper trading safety

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env.production"
HEALTH_LOG="$PROJECT_ROOT/logs/health_check_$(date +%Y%m%d_%H%M%S).log"

# Create logs directory
mkdir -p "$PROJECT_ROOT/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1"
    echo -e "${BLUE}ℹ️  $1${NC}"
    echo "$msg" >> "$HEALTH_LOG"
}

log_success() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: $1"
    echo -e "${GREEN}✅ $1${NC}"
    echo "$msg" >> "$HEALTH_LOG"
}

log_warning() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1"
    echo -e "${YELLOW}⚠️  $1${NC}"
    echo "$msg" >> "$HEALTH_LOG"
}

log_error() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1"
    echo -e "${RED}❌ $1${NC}"
    echo "$msg" >> "$HEALTH_LOG"
}

# Health check results
HEALTH_RESULTS=()
CRITICAL_FAILURES=0
WARNING_COUNT=0

add_result() {
    local component="$1"
    local status="$2"
    local message="$3"
    
    HEALTH_RESULTS+=("{\"component\": \"$component\", \"status\": \"$status\", \"message\": \"$message\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}")
    
    if [ "$status" = "CRITICAL" ]; then
        CRITICAL_FAILURES=$((CRITICAL_FAILURES + 1))
    elif [ "$status" = "WARNING" ]; then
        WARNING_COUNT=$((WARNING_COUNT + 1))
    fi
}

# Docker container health checks
check_container_health() {
    log_info "Checking Docker container health..."
    
    local containers=("trading-bot-frontend" "trading-bot-backend" "trading-bot-postgres" "trading-bot-redis" "trading-bot-rabbitmq")
    
    for container in "${containers[@]}"; do
        if docker ps --filter "name=$container" --filter "status=running" | grep -q "$container"; then
            local health_status
            health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "no-healthcheck")
            
            case "$health_status" in
                "healthy")
                    log_success "$container is healthy"
                    add_result "$container" "HEALTHY" "Container is running and healthy"
                    ;;
                "unhealthy")
                    log_error "$container is unhealthy"
                    add_result "$container" "CRITICAL" "Container is running but unhealthy"
                    ;;
                "starting")
                    log_warning "$container is starting"
                    add_result "$container" "WARNING" "Container is still starting up"
                    ;;
                "no-healthcheck")
                    log_warning "$container has no health check configured"
                    add_result "$container" "WARNING" "No health check configured"
                    ;;
                *)
                    log_warning "$container health status unknown: $health_status"
                    add_result "$container" "WARNING" "Unknown health status: $health_status"
                    ;;
            esac
        else
            log_error "$container is not running"
            add_result "$container" "CRITICAL" "Container is not running"
        fi
    done
}

# Service endpoint health checks
check_service_endpoints() {
    log_info "Checking service endpoints..."
    
    # Frontend health check
    if curl -f -s -m 10 http://localhost/health > /dev/null 2>&1; then
        log_success "Frontend endpoint is responding"
        add_result "frontend-endpoint" "HEALTHY" "Frontend health endpoint responding"
    else
        log_error "Frontend endpoint is not responding"
        add_result "frontend-endpoint" "CRITICAL" "Frontend health endpoint not responding"
    fi
    
    # Backend health check
    if curl -f -s -m 10 http://localhost:3000/health > /dev/null 2>&1; then
        log_success "Backend endpoint is responding"
        add_result "backend-endpoint" "HEALTHY" "Backend health endpoint responding"
        
        # Check API response time
        local response_time
        response_time=$(curl -o /dev/null -s -w '%{time_total}' -m 10 http://localhost:3000/health)
        
        if (( $(echo "$response_time > 2.0" | bc -l) )); then
            log_warning "Backend response time is slow: ${response_time}s"
            add_result "backend-performance" "WARNING" "Slow response time: ${response_time}s"
        else
            log_success "Backend response time is good: ${response_time}s"
            add_result "backend-performance" "HEALTHY" "Good response time: ${response_time}s"
        fi
    else
        log_error "Backend endpoint is not responding"
        add_result "backend-endpoint" "CRITICAL" "Backend health endpoint not responding"
    fi
    
    # Prometheus health check
    if curl -f -s -m 10 http://localhost:9090/-/healthy > /dev/null 2>&1; then
        log_success "Prometheus is responding"
        add_result "prometheus" "HEALTHY" "Prometheus health endpoint responding"
    else
        log_warning "Prometheus is not responding"
        add_result "prometheus" "WARNING" "Prometheus health endpoint not responding"
    fi
    
    # Grafana health check
    if curl -f -s -m 10 http://localhost:3001/api/health > /dev/null 2>&1; then
        log_success "Grafana is responding"
        add_result "grafana" "HEALTHY" "Grafana health endpoint responding"
    else
        log_warning "Grafana is not responding"
        add_result "grafana" "WARNING" "Grafana health endpoint not responding"
    fi
}

# Database connectivity and performance
check_database_health() {
    log_info "Checking database health..."
    
    # PostgreSQL connectivity
    if docker exec trading-bot-postgres pg_isready -U postgres -d trading_bot > /dev/null 2>&1; then
        log_success "PostgreSQL is accepting connections"
        add_result "postgres-connectivity" "HEALTHY" "PostgreSQL accepting connections"
        
        # Check database performance
        local query_time
        query_time=$(docker exec trading-bot-postgres bash -c "time psql -U postgres -d trading_bot -c 'SELECT 1;' > /dev/null" 2>&1 | grep real | awk '{print $2}')
        
        log_info "Database query time: $query_time"
        add_result "postgres-performance" "HEALTHY" "Query time: $query_time"
        
        # Check database size
        local db_size
        db_size=$(docker exec trading-bot-postgres psql -U postgres -d trading_bot -t -c "SELECT pg_size_pretty(pg_database_size('trading_bot'));" | xargs)
        
        log_info "Database size: $db_size"
        add_result "postgres-size" "HEALTHY" "Database size: $db_size"
        
        # Check active connections
        local active_connections
        active_connections=$(docker exec trading-bot-postgres psql -U postgres -d trading_bot -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" | xargs)
        
        log_info "Active database connections: $active_connections"
        add_result "postgres-connections" "HEALTHY" "Active connections: $active_connections"
        
    else
        log_error "PostgreSQL is not accepting connections"
        add_result "postgres-connectivity" "CRITICAL" "PostgreSQL not accepting connections"
    fi
    
    # Redis connectivity
    if docker exec trading-bot-redis redis-cli ping > /dev/null 2>&1; then
        log_success "Redis is responding"
        add_result "redis-connectivity" "HEALTHY" "Redis responding to ping"
        
        # Check Redis memory usage
        local redis_memory
        redis_memory=$(docker exec trading-bot-redis redis-cli info memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')
        
        log_info "Redis memory usage: $redis_memory"
        add_result "redis-memory" "HEALTHY" "Memory usage: $redis_memory"
        
    else
        log_error "Redis is not responding"
        add_result "redis-connectivity" "CRITICAL" "Redis not responding to ping"
    fi
    
    # RabbitMQ connectivity
    if docker exec trading-bot-rabbitmq rabbitmq-diagnostics ping > /dev/null 2>&1; then
        log_success "RabbitMQ is responding"
        add_result "rabbitmq-connectivity" "HEALTHY" "RabbitMQ responding to ping"
        
        # Check RabbitMQ queues
        local queue_count
        queue_count=$(docker exec trading-bot-rabbitmq rabbitmqctl list_queues 2>/dev/null | wc -l || echo "0")
        
        log_info "RabbitMQ queues: $queue_count"
        add_result "rabbitmq-queues" "HEALTHY" "Queue count: $queue_count"
        
    else
        log_error "RabbitMQ is not responding"
        add_result "rabbitmq-connectivity" "CRITICAL" "RabbitMQ not responding to ping"
    fi
}

# Paper trading safety validation
check_paper_trading_safety() {
    log_info "Checking paper trading safety..."
    
    # Load environment variables
    if [ -f "$ENV_FILE" ]; then
        source "$ENV_FILE"
        
        # Check critical environment variables
        if [ "$PAPER_TRADING_MODE" = "true" ]; then
            log_success "PAPER_TRADING_MODE is enabled"
            add_result "paper-trading-env" "HEALTHY" "PAPER_TRADING_MODE=true"
        else
            log_error "PAPER_TRADING_MODE is not enabled"
            add_result "paper-trading-env" "CRITICAL" "PAPER_TRADING_MODE=$PAPER_TRADING_MODE"
        fi
        
        if [ "$ALLOW_REAL_TRADES" = "false" ]; then
            log_success "ALLOW_REAL_TRADES is disabled"
            add_result "real-trades-env" "HEALTHY" "ALLOW_REAL_TRADES=false"
        else
            log_error "ALLOW_REAL_TRADES is enabled - CRITICAL SAFETY ISSUE"
            add_result "real-trades-env" "CRITICAL" "ALLOW_REAL_TRADES=$ALLOW_REAL_TRADES"
        fi
        
        if [ "$FORCE_PAPER_TRADING" = "true" ]; then
            log_success "FORCE_PAPER_TRADING is enabled"
            add_result "force-paper-trading" "HEALTHY" "FORCE_PAPER_TRADING=true"
        else
            log_error "FORCE_PAPER_TRADING is not enabled"
            add_result "force-paper-trading" "CRITICAL" "FORCE_PAPER_TRADING=$FORCE_PAPER_TRADING"
        fi
        
    else
        log_error "Environment file not found: $ENV_FILE"
        add_result "environment-file" "CRITICAL" "Environment file not found"
    fi
    
    # Check API endpoint for paper trading mode
    local api_response
    if api_response=$(curl -f -s -m 10 http://localhost:3000/api/config/trading-mode 2>/dev/null); then
        if echo "$api_response" | grep -q "paper_trading"; then
            log_success "API confirms paper trading mode"
            add_result "api-paper-trading" "HEALTHY" "API confirms paper trading mode"
        else
            log_error "API does not confirm paper trading mode"
            add_result "api-paper-trading" "CRITICAL" "API response: $api_response"
        fi
    else
        log_warning "Could not check API paper trading mode"
        add_result "api-paper-trading" "WARNING" "API not accessible for paper trading check"
    fi
}

# SSL certificate validation
check_ssl_certificates() {
    log_info "Checking SSL certificates..."
    
    if [ -f "$ENV_FILE" ]; then
        source "$ENV_FILE"
        
        if [ "$SSL_ENABLED" = "true" ] && [ "$DOMAIN_NAME" != "localhost" ]; then
            # Check if certificate files exist
            if docker exec trading-bot-frontend test -f "/etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem" 2>/dev/null; then
                log_success "SSL certificate files exist"
                add_result "ssl-files" "HEALTHY" "Certificate files present"
                
                # Check certificate expiry
                local cert_expiry
                cert_expiry=$(docker exec trading-bot-frontend openssl x509 -in "/etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem" -noout -enddate 2>/dev/null | cut -d= -f2 || echo "unknown")
                
                log_info "SSL certificate expires: $cert_expiry"
                add_result "ssl-expiry" "HEALTHY" "Expires: $cert_expiry"
                
                # Test HTTPS connectivity
                if curl -f -s -m 10 "https://$DOMAIN_NAME/health" > /dev/null 2>&1; then
                    log_success "HTTPS endpoint is responding"
                    add_result "https-connectivity" "HEALTHY" "HTTPS endpoint responding"
                else
                    log_warning "HTTPS endpoint is not responding"
                    add_result "https-connectivity" "WARNING" "HTTPS endpoint not responding"
                fi
                
            else
                log_warning "SSL certificate files not found"
                add_result "ssl-files" "WARNING" "Certificate files not found"
            fi
        else
            log_info "SSL is disabled or using localhost"
            add_result "ssl-config" "HEALTHY" "SSL disabled or localhost mode"
        fi
    fi
}

# System resource monitoring
check_system_resources() {
    log_info "Checking system resources..."
    
    # Disk usage
    local disk_usage
    disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ "$disk_usage" -gt 90 ]; then
        log_error "Disk usage is critical: ${disk_usage}%"
        add_result "disk-usage" "CRITICAL" "Disk usage: ${disk_usage}%"
    elif [ "$disk_usage" -gt 80 ]; then
        log_warning "Disk usage is high: ${disk_usage}%"
        add_result "disk-usage" "WARNING" "Disk usage: ${disk_usage}%"
    else
        log_success "Disk usage is normal: ${disk_usage}%"
        add_result "disk-usage" "HEALTHY" "Disk usage: ${disk_usage}%"
    fi
    
    # Memory usage
    local memory_usage
    memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    
    if [ "$memory_usage" -gt 90 ]; then
        log_error "Memory usage is critical: ${memory_usage}%"
        add_result "memory-usage" "CRITICAL" "Memory usage: ${memory_usage}%"
    elif [ "$memory_usage" -gt 80 ]; then
        log_warning "Memory usage is high: ${memory_usage}%"
        add_result "memory-usage" "WARNING" "Memory usage: ${memory_usage}%"
    else
        log_success "Memory usage is normal: ${memory_usage}%"
        add_result "memory-usage" "HEALTHY" "Memory usage: ${memory_usage}%"
    fi
    
    # Load average
    local load_avg
    load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    
    log_info "System load average: $load_avg"
    add_result "load-average" "HEALTHY" "Load average: $load_avg"
    
    # Docker system resources
    local docker_containers
    docker_containers=$(docker ps | wc -l)
    
    log_info "Running Docker containers: $docker_containers"
    add_result "docker-containers" "HEALTHY" "Running containers: $docker_containers"
}

# Network connectivity checks
check_network_connectivity() {
    log_info "Checking network connectivity..."
    
    # Check external API connectivity (Binance)
    if curl -f -s -m 10 "https://api.binance.com/api/v3/ping" > /dev/null 2>&1; then
        log_success "Binance API is reachable"
        add_result "binance-connectivity" "HEALTHY" "Binance API reachable"
    else
        log_warning "Binance API is not reachable"
        add_result "binance-connectivity" "WARNING" "Binance API not reachable"
    fi
    
    # Check external API connectivity (KuCoin)
    if curl -f -s -m 10 "https://api.kucoin.com/api/v1/timestamp" > /dev/null 2>&1; then
        log_success "KuCoin API is reachable"
        add_result "kucoin-connectivity" "HEALTHY" "KuCoin API reachable"
    else
        log_warning "KuCoin API is not reachable"
        add_result "kucoin-connectivity" "WARNING" "KuCoin API not reachable"
    fi
    
    # Check DNS resolution
    if nslookup google.com > /dev/null 2>&1; then
        log_success "DNS resolution is working"
        add_result "dns-resolution" "HEALTHY" "DNS resolution working"
    else
        log_error "DNS resolution is not working"
        add_result "dns-resolution" "CRITICAL" "DNS resolution not working"
    fi
}

# Generate health report
generate_health_report() {
    local report_file="$PROJECT_ROOT/logs/health_report_$(date +%Y%m%d_%H%M%S).json"
    
    # Convert results array to JSON
    local results_json="["
    local first=true
    for result in "${HEALTH_RESULTS[@]}"; do
        if [ "$first" = true ]; then
            first=false
        else
            results_json+=","
        fi
        results_json+="$result"
    done
    results_json+="]"
    
    # Overall health status
    local overall_status="HEALTHY"
    if [ $CRITICAL_FAILURES -gt 0 ]; then
        overall_status="CRITICAL"
    elif [ $WARNING_COUNT -gt 0 ]; then
        overall_status="WARNING"
    fi
    
    cat > "$report_file" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "overall_status": "$overall_status",
    "critical_failures": $CRITICAL_FAILURES,
    "warnings": $WARNING_COUNT,
    "total_checks": ${#HEALTH_RESULTS[@]},
    "results": $results_json
}
EOF
    
    log_success "Health report generated: $report_file"
    
    # Display summary
    echo ""
    echo "🏥 Health Check Summary"
    echo "======================"
    echo "Overall Status: $overall_status"
    echo "Critical Failures: $CRITICAL_FAILURES"
    echo "Warnings: $WARNING_COUNT"
    echo "Total Checks: ${#HEALTH_RESULTS[@]}"
    echo ""
    
    if [ $CRITICAL_FAILURES -gt 0 ]; then
        echo -e "${RED}❌ CRITICAL ISSUES DETECTED - IMMEDIATE ATTENTION REQUIRED${NC}"
        return 1
    elif [ $WARNING_COUNT -gt 0 ]; then
        echo -e "${YELLOW}⚠️  WARNINGS DETECTED - MONITORING RECOMMENDED${NC}"
        return 0
    else
        echo -e "${GREEN}✅ ALL SYSTEMS HEALTHY${NC}"
        return 0
    fi
}

# Main health check function
main() {
    echo "🏥 Comprehensive Health Check"
    echo "============================"
    echo ""
    
    log_info "Starting comprehensive health check..."
    log_info "Log file: $HEALTH_LOG"
    
    # Run all health checks
    check_container_health
    check_service_endpoints
    check_database_health
    check_paper_trading_safety
    check_ssl_certificates
    check_system_resources
    check_network_connectivity
    
    # Generate and display report
    generate_health_report
}

# Handle command line arguments
case "${1:-full}" in
    "full")
        main
        ;;
    "containers")
        check_container_health
        generate_health_report
        ;;
    "services")
        check_service_endpoints
        generate_health_report
        ;;
    "database")
        check_database_health
        generate_health_report
        ;;
    "paper-trading")
        check_paper_trading_safety
        generate_health_report
        ;;
    "ssl")
        check_ssl_certificates
        generate_health_report
        ;;
    "resources")
        check_system_resources
        generate_health_report
        ;;
    "network")
        check_network_connectivity
        generate_health_report
        ;;
    "help")
        cat << EOF
Comprehensive Health Check Script
================================

Usage: $0 [check_type]

Check Types:
  full          - Run all health checks (default)
  containers    - Check Docker container health
  services      - Check service endpoints
  database      - Check database connectivity and performance
  paper-trading - Check paper trading safety configuration
  ssl           - Check SSL certificates
  resources     - Check system resources
  network       - Check network connectivity
  help          - Show this help message

EOF
        ;;
    *)
        log_error "Unknown check type: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac