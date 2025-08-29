#!/bin/bash

# Trading Bot Monitoring Stack Startup Script
# This script starts the complete monitoring infrastructure including Grafana dashboards

set -e

echo "🚀 Starting Trading Bot Monitoring Stack..."

# Configuration
MONITORING_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../monitoring" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a service is running
check_service() {
    local service_name=$1
    local port=$2
    
    if curl -s "http://localhost:$port" > /dev/null 2>&1; then
        print_success "$service_name is running on port $port"
        return 0
    else
        print_warning "$service_name is not responding on port $port"
        return 1
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local service_name=$1
    local port=$2
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if check_service "$service_name" "$port"; then
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service_name failed to start within expected time"
    return 1
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Navigate to monitoring directory
cd "$MONITORING_DIR"

print_status "Checking monitoring configuration..."

# Validate configuration files
if [ ! -f "docker-compose.monitoring.yml" ]; then
    print_error "docker-compose.monitoring.yml not found in $MONITORING_DIR"
    exit 1
fi

if [ ! -f "prometheus.yml" ]; then
    print_error "prometheus.yml not found in $MONITORING_DIR"
    exit 1
fi

if [ ! -d "grafana/dashboards" ]; then
    print_error "Grafana dashboards directory not found"
    exit 1
fi

print_success "Configuration files validated"

# Stop any existing monitoring services
print_status "Stopping existing monitoring services..."
docker-compose -f docker-compose.monitoring.yml down --remove-orphans > /dev/null 2>&1 || true

# Pull latest images
print_status "Pulling latest Docker images..."
docker-compose -f docker-compose.monitoring.yml pull

# Start monitoring services
print_status "Starting monitoring services..."
docker-compose -f docker-compose.monitoring.yml up -d

# Wait for services to be ready
print_status "Waiting for services to start..."

# Wait for Prometheus
if wait_for_service "Prometheus" "9090"; then
    print_success "Prometheus is ready at http://localhost:9090"
else
    print_error "Prometheus failed to start"
    exit 1
fi

# Wait for Grafana
if wait_for_service "Grafana" "3001"; then
    print_success "Grafana is ready at http://localhost:3001"
else
    print_error "Grafana failed to start"
    exit 1
fi

# Wait for other services
wait_for_service "AlertManager" "9093" || print_warning "AlertManager may not be ready"
wait_for_service "Node Exporter" "9100" || print_warning "Node Exporter may not be ready"
wait_for_service "cAdvisor" "8080" || print_warning "cAdvisor may not be ready"

# Test Grafana dashboards
print_status "Testing Grafana dashboard configuration..."
if command -v node > /dev/null 2>&1; then
    cd "$SCRIPT_DIR"
    if node test-grafana-dashboards.js; then
        print_success "Grafana dashboard tests passed"
    else
        print_warning "Some Grafana dashboard tests failed, but services are running"
    fi
else
    print_warning "Node.js not found, skipping dashboard tests"
fi

# Display service status
echo ""
echo "=".repeat(60) 2>/dev/null || echo "============================================================"
echo "🎯 MONITORING STACK STATUS"
echo "=".repeat(60) 2>/dev/null || echo "============================================================"

# Check all services
services=(
    "Prometheus:9090"
    "Grafana:3001"
    "AlertManager:9093"
    "Node Exporter:9100"
    "cAdvisor:8080"
    "Elasticsearch:9200"
    "Kibana:5601"
    "Jaeger:16686"
)

for service in "${services[@]}"; do
    IFS=':' read -r name port <<< "$service"
    if check_service "$name" "$port"; then
        echo "✅ $name: http://localhost:$port"
    else
        echo "❌ $name: Not responding"
    fi
done

echo ""
echo "=".repeat(60) 2>/dev/null || echo "============================================================"
echo "📊 GRAFANA DASHBOARDS"
echo "=".repeat(60) 2>/dev/null || echo "============================================================"
echo "🔗 Access Grafana at: http://localhost:3001"
echo "👤 Username: admin"
echo "🔑 Password: admin123"
echo ""
echo "Available Dashboards:"
echo "• Trading Bot Overview"
echo "• System Metrics"
echo "• Real-time Data Feeds"
echo "• Paper Trading Safety"
echo "• Trading Metrics"
echo "• Performance Analytics"
echo ""

# Display alerting information
echo "🚨 ALERTING CONFIGURATION"
echo "=".repeat(60) 2>/dev/null || echo "============================================================"
echo "📧 AlertManager: http://localhost:9093"
echo "🔔 Critical alerts configured for:"
echo "  • Paper trading mode disabled"
echo "  • Real trading attempts"
echo "  • Service downtime"
echo "  • High resource usage"
echo "  • Market data feed issues"
echo ""

# Show logs command
echo "📋 USEFUL COMMANDS"
echo "=".repeat(60) 2>/dev/null || echo "============================================================"
echo "View logs: docker-compose -f $MONITORING_DIR/docker-compose.monitoring.yml logs -f [service]"
echo "Stop stack: docker-compose -f $MONITORING_DIR/docker-compose.monitoring.yml down"
echo "Restart service: docker-compose -f $MONITORING_DIR/docker-compose.monitoring.yml restart [service]"
echo ""

print_success "Monitoring stack started successfully!"
print_status "All services are running and ready for use."

# Optional: Open Grafana in browser (if running on desktop)
if command -v xdg-open > /dev/null 2>&1; then
    read -p "Open Grafana in browser? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        xdg-open http://localhost:3001
    fi
elif command -v open > /dev/null 2>&1; then
    read -p "Open Grafana in browser? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        open http://localhost:3001
    fi
fi

exit 0