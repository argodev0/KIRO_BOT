#!/bin/bash

# Infrastructure Health Check Script
# Comprehensive monitoring and health validation for the trading bot infrastructure

set -euo pipefail

# Configuration
NAMESPACE="trading-bot"
LOG_FILE="/tmp/infrastructure-health-$(date +%Y%m%d_%H%M%S).log"
ALERT_THRESHOLD_CPU=80
ALERT_THRESHOLD_MEMORY=85
ALERT_THRESHOLD_DISK=90
TIMEOUT=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Colored output functions
success() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}❌ $1${NC}" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}" | tee -a "$LOG_FILE"
}

# Check if kubectl is available and configured
check_kubectl() {
    if ! command -v kubectl >/dev/null 2>&1; then
        error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    if ! kubectl cluster-info >/dev/null 2>&1; then
        error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    success "kubectl is configured and cluster is accessible"
}

# Check namespace existence
check_namespace() {
    if kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
        success "Namespace '$NAMESPACE' exists"
    else
        error "Namespace '$NAMESPACE' does not exist"
        return 1
    fi
}

# Check cluster nodes health
check_cluster_nodes() {
    info "Checking cluster nodes health..."
    
    local nodes_ready=0
    local nodes_total=0
    
    while IFS= read -r line; do
        nodes_total=$((nodes_total + 1))
        if echo "$line" | grep -q "Ready"; then
            nodes_ready=$((nodes_ready + 1))
            success "Node: $line"
        else
            warning "Node: $line"
        fi
    done < <(kubectl get nodes --no-headers | awk '{print $1 " - " $2}')
    
    if [ "$nodes_ready" -eq "$nodes_total" ]; then
        success "All $nodes_total nodes are ready"
    else
        warning "$nodes_ready out of $nodes_total nodes are ready"
    fi
    
    # Check node resource usage
    info "Checking node resource usage..."
    kubectl top nodes 2>/dev/null || warning "Node metrics not available"
}

# Check pod health
check_pods() {
    info "Checking pod health in namespace '$NAMESPACE'..."
    
    local pods_running=0
    local pods_total=0
    local failed_pods=()
    
    if ! kubectl get pods -n "$NAMESPACE" >/dev/null 2>&1; then
        warning "No pods found in namespace '$NAMESPACE'"
        return 0
    fi
    
    while IFS= read -r line; do
        pods_total=$((pods_total + 1))
        local pod_name=$(echo "$line" | awk '{print $1}')
        local pod_status=$(echo "$line" | awk '{print $3}')
        local pod_ready=$(echo "$line" | awk '{print $2}')
        
        if [[ "$pod_status" == "Running" && "$pod_ready" =~ ^[0-9]+/[0-9]+$ ]]; then
            local ready_count=$(echo "$pod_ready" | cut -d'/' -f1)
            local total_count=$(echo "$pod_ready" | cut -d'/' -f2)
            
            if [ "$ready_count" -eq "$total_count" ]; then
                pods_running=$((pods_running + 1))
                success "Pod $pod_name: $pod_status ($pod_ready)"
            else
                warning "Pod $pod_name: $pod_status ($pod_ready) - Not all containers ready"
                failed_pods+=("$pod_name")
            fi
        else
            error "Pod $pod_name: $pod_status ($pod_ready)"
            failed_pods+=("$pod_name")
        fi
    done < <(kubectl get pods -n "$NAMESPACE" --no-headers)
    
    if [ "$pods_running" -eq "$pods_total" ]; then
        success "All $pods_total pods are running and ready"
    else
        warning "$pods_running out of $pods_total pods are running and ready"
        
        # Show details for failed pods
        for pod in "${failed_pods[@]}"; do
            info "Describing failed pod: $pod"
            kubectl describe pod "$pod" -n "$NAMESPACE" | tail -20 | tee -a "$LOG_FILE"
        done
    fi
}

# Check services and endpoints
check_services() {
    info "Checking services and endpoints..."
    
    if ! kubectl get services -n "$NAMESPACE" >/dev/null 2>&1; then
        warning "No services found in namespace '$NAMESPACE'"
        return 0
    fi
    
    while IFS= read -r line; do
        local service_name=$(echo "$line" | awk '{print $1}')
        local service_type=$(echo "$line" | awk '{print $2}')
        local cluster_ip=$(echo "$line" | awk '{print $3}')
        local ports=$(echo "$line" | awk '{print $5}')
        
        # Check if service has endpoints
        local endpoints=$(kubectl get endpoints "$service_name" -n "$NAMESPACE" -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null || echo "")
        
        if [ -n "$endpoints" ]; then
            success "Service $service_name ($service_type): $cluster_ip:$ports - Endpoints: $(echo $endpoints | wc -w)"
        else
            warning "Service $service_name ($service_type): $cluster_ip:$ports - No endpoints"
        fi
    done < <(kubectl get services -n "$NAMESPACE" --no-headers)
}

# Check persistent volumes
check_storage() {
    info "Checking persistent volumes and claims..."
    
    # Check PVCs
    if kubectl get pvc -n "$NAMESPACE" >/dev/null 2>&1; then
        while IFS= read -r line; do
            local pvc_name=$(echo "$line" | awk '{print $1}')
            local pvc_status=$(echo "$line" | awk '{print $2}')
            local pvc_volume=$(echo "$line" | awk '{print $3}')
            local pvc_capacity=$(echo "$line" | awk '{print $4}')
            
            if [ "$pvc_status" == "Bound" ]; then
                success "PVC $pvc_name: $pvc_status to $pvc_volume ($pvc_capacity)"
            else
                warning "PVC $pvc_name: $pvc_status"
            fi
        done < <(kubectl get pvc -n "$NAMESPACE" --no-headers)
    else
        info "No persistent volume claims found"
    fi
    
    # Check storage usage in pods
    info "Checking storage usage in pods..."
    local pods=$(kubectl get pods -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    
    for pod in $pods; do
        if kubectl exec "$pod" -n "$NAMESPACE" -- df -h 2>/dev/null | grep -E "^/dev|^overlay" >/dev/null; then
            local disk_usage=$(kubectl exec "$pod" -n "$NAMESPACE" -- df -h 2>/dev/null | grep -E "^/dev|^overlay" | awk '{print $5}' | sed 's/%//' | sort -nr | head -1)
            
            if [ "$disk_usage" -gt "$ALERT_THRESHOLD_DISK" ]; then
                warning "Pod $pod: High disk usage ($disk_usage%)"
            else
                success "Pod $pod: Disk usage OK ($disk_usage%)"
            fi
        fi
    done
}

# Check resource usage
check_resource_usage() {
    info "Checking resource usage..."
    
    # Check pod resource usage
    if kubectl top pods -n "$NAMESPACE" >/dev/null 2>&1; then
        while IFS= read -r line; do
            local pod_name=$(echo "$line" | awk '{print $1}')
            local cpu_usage=$(echo "$line" | awk '{print $2}' | sed 's/m//')
            local memory_usage=$(echo "$line" | awk '{print $3}' | sed 's/Mi//')
            
            # Get resource limits
            local cpu_limit=$(kubectl get pod "$pod_name" -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].resources.limits.cpu}' 2>/dev/null | sed 's/m//' || echo "1000")
            local memory_limit=$(kubectl get pod "$pod_name" -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].resources.limits.memory}' 2>/dev/null | sed 's/Mi//' | sed 's/Gi/000/' || echo "1000")
            
            # Calculate usage percentages
            local cpu_percent=$((cpu_usage * 100 / cpu_limit))
            local memory_percent=$((memory_usage * 100 / memory_limit))
            
            if [ "$cpu_percent" -gt "$ALERT_THRESHOLD_CPU" ] || [ "$memory_percent" -gt "$ALERT_THRESHOLD_MEMORY" ]; then
                warning "Pod $pod_name: High resource usage - CPU: ${cpu_percent}%, Memory: ${memory_percent}%"
            else
                success "Pod $pod_name: Resource usage OK - CPU: ${cpu_percent}%, Memory: ${memory_percent}%"
            fi
        done < <(kubectl top pods -n "$NAMESPACE" --no-headers 2>/dev/null)
    else
        warning "Pod metrics not available"
    fi
}

# Check application health endpoints
check_application_health() {
    info "Checking application health endpoints..."
    
    # Check backend health
    local backend_pods=$(kubectl get pods -n "$NAMESPACE" -l app=backend -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    
    for pod in $backend_pods; do
        if kubectl exec "$pod" -n "$NAMESPACE" -- curl -f -s http://localhost:8080/health --max-time 10 >/dev/null 2>&1; then
            success "Backend pod $pod: Health check passed"
        else
            error "Backend pod $pod: Health check failed"
        fi
    done
    
    # Check frontend health
    local frontend_pods=$(kubectl get pods -n "$NAMESPACE" -l app=frontend -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    
    for pod in $frontend_pods; do
        if kubectl exec "$pod" -n "$NAMESPACE" -- curl -f -s http://localhost/health --max-time 10 >/dev/null 2>&1; then
            success "Frontend pod $pod: Health check passed"
        else
            error "Frontend pod $pod: Health check failed"
        fi
    done
}

# Check database connectivity
check_database_health() {
    info "Checking database health..."
    
    # Check PostgreSQL
    local postgres_pods=$(kubectl get pods -n "$NAMESPACE" -l app=postgres -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    
    for pod in $postgres_pods; do
        if kubectl exec "$pod" -n "$NAMESPACE" -- pg_isready -U postgres >/dev/null 2>&1; then
            success "PostgreSQL pod $pod: Database is ready"
            
            # Check database size and connections
            local db_size=$(kubectl exec "$pod" -n "$NAMESPACE" -- psql -U postgres -d trading_bot -t -c "SELECT pg_size_pretty(pg_database_size('trading_bot'));" 2>/dev/null | xargs || echo "Unknown")
            local connections=$(kubectl exec "$pod" -n "$NAMESPACE" -- psql -U postgres -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | xargs || echo "Unknown")
            
            info "PostgreSQL pod $pod: Database size: $db_size, Active connections: $connections"
        else
            error "PostgreSQL pod $pod: Database is not ready"
        fi
    done
    
    # Check Redis
    local redis_pods=$(kubectl get pods -n "$NAMESPACE" -l app=redis -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    
    for pod in $redis_pods; do
        if kubectl exec "$pod" -n "$NAMESPACE" -- redis-cli ping >/dev/null 2>&1; then
            success "Redis pod $pod: Redis is responding"
            
            # Check Redis memory usage
            local redis_memory=$(kubectl exec "$pod" -n "$NAMESPACE" -- redis-cli info memory | grep used_memory_human | cut -d: -f2 | tr -d '\r' || echo "Unknown")
            info "Redis pod $pod: Memory usage: $redis_memory"
        else
            error "Redis pod $pod: Redis is not responding"
        fi
    done
    
    # Check RabbitMQ
    local rabbitmq_pods=$(kubectl get pods -n "$NAMESPACE" -l app=rabbitmq -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    
    for pod in $rabbitmq_pods; do
        if kubectl exec "$pod" -n "$NAMESPACE" -- rabbitmq-diagnostics ping >/dev/null 2>&1; then
            success "RabbitMQ pod $pod: RabbitMQ is responding"
        else
            error "RabbitMQ pod $pod: RabbitMQ is not responding"
        fi
    done
}

# Check monitoring stack
check_monitoring() {
    info "Checking monitoring stack..."
    
    # Check Prometheus
    local prometheus_pods=$(kubectl get pods -n "$NAMESPACE" -l app=prometheus -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    
    for pod in $prometheus_pods; do
        if kubectl exec "$pod" -n "$NAMESPACE" -- wget -q --spider http://localhost:9090/-/healthy --timeout=10 2>/dev/null; then
            success "Prometheus pod $pod: Prometheus is healthy"
        else
            warning "Prometheus pod $pod: Prometheus health check failed"
        fi
    done
    
    # Check Grafana
    local grafana_pods=$(kubectl get pods -n "$NAMESPACE" -l app=grafana -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    
    for pod in $grafana_pods; do
        if kubectl exec "$pod" -n "$NAMESPACE" -- curl -f -s http://localhost:3000/api/health --max-time 10 >/dev/null 2>&1; then
            success "Grafana pod $pod: Grafana is healthy"
        else
            warning "Grafana pod $pod: Grafana health check failed"
        fi
    done
    
    # Check Alertmanager
    local alertmanager_pods=$(kubectl get pods -n "$NAMESPACE" -l app=alertmanager -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    
    for pod in $alertmanager_pods; do
        if kubectl exec "$pod" -n "$NAMESPACE" -- wget -q --spider http://localhost:9093/-/healthy --timeout=10 2>/dev/null; then
            success "Alertmanager pod $pod: Alertmanager is healthy"
        else
            warning "Alertmanager pod $pod: Alertmanager health check failed"
        fi
    done
}

# Check ingress and external access
check_ingress() {
    info "Checking ingress and external access..."
    
    if kubectl get ingress -n "$NAMESPACE" >/dev/null 2>&1; then
        while IFS= read -r line; do
            local ingress_name=$(echo "$line" | awk '{print $1}')
            local hosts=$(echo "$line" | awk '{print $3}')
            local address=$(echo "$line" | awk '{print $4}')
            
            if [ -n "$address" ] && [ "$address" != "<none>" ]; then
                success "Ingress $ingress_name: $hosts -> $address"
                
                # Test external connectivity if possible
                for host in $(echo "$hosts" | tr ',' ' '); do
                    if curl -f -s -k "https://$host/health" --max-time 10 >/dev/null 2>&1; then
                        success "External access to $host: OK"
                    else
                        warning "External access to $host: Failed or not configured"
                    fi
                done
            else
                warning "Ingress $ingress_name: No external address assigned"
            fi
        done < <(kubectl get ingress -n "$NAMESPACE" --no-headers)
    else
        info "No ingress resources found"
    fi
}

# Check backup status
check_backups() {
    info "Checking backup status..."
    
    # Check backup CronJobs
    if kubectl get cronjobs -n "$NAMESPACE" >/dev/null 2>&1; then
        while IFS= read -r line; do
            local cronjob_name=$(echo "$line" | awk '{print $1}')
            local schedule=$(echo "$line" | awk '{print $2}')
            local suspend=$(echo "$line" | awk '{print $3}')
            local active=$(echo "$line" | awk '{print $4}')
            local last_schedule=$(echo "$line" | awk '{print $5}')
            
            if [ "$suspend" == "False" ]; then
                success "CronJob $cronjob_name: Active ($schedule) - Last run: $last_schedule"
            else
                warning "CronJob $cronjob_name: Suspended"
            fi
        done < <(kubectl get cronjobs -n "$NAMESPACE" --no-headers)
        
        # Check recent backup jobs
        info "Checking recent backup jobs..."
        kubectl get jobs -n "$NAMESPACE" --sort-by=.metadata.creationTimestamp | tail -5 | tee -a "$LOG_FILE"
    else
        warning "No backup CronJobs found"
    fi
}

# Check security configurations
check_security() {
    info "Checking security configurations..."
    
    # Check if pods are running as non-root
    local pods=$(kubectl get pods -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    
    for pod in $pods; do
        local run_as_user=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.spec.securityContext.runAsUser}' 2>/dev/null || echo "")
        local run_as_non_root=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.spec.securityContext.runAsNonRoot}' 2>/dev/null || echo "")
        
        if [ "$run_as_non_root" == "true" ] || ([ -n "$run_as_user" ] && [ "$run_as_user" != "0" ]); then
            success "Pod $pod: Running as non-root user"
        else
            warning "Pod $pod: May be running as root"
        fi
    done
    
    # Check network policies
    if kubectl get networkpolicy -n "$NAMESPACE" >/dev/null 2>&1; then
        local policy_count=$(kubectl get networkpolicy -n "$NAMESPACE" --no-headers | wc -l)
        success "Network policies: $policy_count policies found"
    else
        warning "No network policies found"
    fi
    
    # Check secrets
    if kubectl get secrets -n "$NAMESPACE" >/dev/null 2>&1; then
        local secret_count=$(kubectl get secrets -n "$NAMESPACE" --no-headers | grep -v "default-token" | wc -l)
        success "Secrets: $secret_count custom secrets found"
    else
        warning "No custom secrets found"
    fi
}

# Generate summary report
generate_summary() {
    info "Generating health check summary..."
    
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local total_checks=0
    local passed_checks=0
    local warning_checks=0
    local failed_checks=0
    
    # Count check results from log
    total_checks=$(grep -c "✅\|⚠️\|❌" "$LOG_FILE" || echo "0")
    passed_checks=$(grep -c "✅" "$LOG_FILE" || echo "0")
    warning_checks=$(grep -c "⚠️" "$LOG_FILE" || echo "0")
    failed_checks=$(grep -c "❌" "$LOG_FILE" || echo "0")
    
    # Generate JSON report
    cat > "infrastructure-health-report-$(date +%Y%m%d_%H%M%S).json" << EOF
{
    "timestamp": "$timestamp",
    "namespace": "$NAMESPACE",
    "summary": {
        "total_checks": $total_checks,
        "passed_checks": $passed_checks,
        "warning_checks": $warning_checks,
        "failed_checks": $failed_checks,
        "health_score": $(( passed_checks * 100 / (total_checks > 0 ? total_checks : 1) ))
    },
    "cluster_info": {
        "nodes": $(kubectl get nodes -o json | jq '.items | length'),
        "pods": $(kubectl get pods -n "$NAMESPACE" -o json 2>/dev/null | jq '.items | length' || echo "0"),
        "services": $(kubectl get services -n "$NAMESPACE" -o json 2>/dev/null | jq '.items | length' || echo "0")
    },
    "log_file": "$LOG_FILE"
}
EOF
    
    echo ""
    info "=== HEALTH CHECK SUMMARY ==="
    info "Timestamp: $timestamp"
    info "Namespace: $NAMESPACE"
    info "Total Checks: $total_checks"
    success "Passed: $passed_checks"
    warning "Warnings: $warning_checks"
    error "Failed: $failed_checks"
    info "Health Score: $(( passed_checks * 100 / (total_checks > 0 ? total_checks : 1) ))%"
    info "Log File: $LOG_FILE"
    echo ""
    
    if [ "$failed_checks" -gt 0 ]; then
        error "Infrastructure health check completed with failures"
        return 1
    elif [ "$warning_checks" -gt 0 ]; then
        warning "Infrastructure health check completed with warnings"
        return 0
    else
        success "Infrastructure health check completed successfully"
        return 0
    fi
}

# Main execution
main() {
    log "=== Starting Infrastructure Health Check ==="
    log "Namespace: $NAMESPACE"
    log "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    
    # Run all health checks
    check_kubectl
    check_namespace
    check_cluster_nodes
    check_pods
    check_services
    check_storage
    check_resource_usage
    check_application_health
    check_database_health
    check_monitoring
    check_ingress
    check_backups
    check_security
    
    # Generate summary
    generate_summary
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --cpu-threshold)
            ALERT_THRESHOLD_CPU="$2"
            shift 2
            ;;
        --memory-threshold)
            ALERT_THRESHOLD_MEMORY="$2"
            shift 2
            ;;
        --disk-threshold)
            ALERT_THRESHOLD_DISK="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -n, --namespace NS        Kubernetes namespace (default: trading-bot)"
            echo "  -t, --timeout SECONDS     Timeout for checks (default: 30)"
            echo "  --cpu-threshold PERCENT   CPU usage alert threshold (default: 80)"
            echo "  --memory-threshold PERCENT Memory usage alert threshold (default: 85)"
            echo "  --disk-threshold PERCENT  Disk usage alert threshold (default: 90)"
            echo "  -h, --help               Show this help message"
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main "$@"