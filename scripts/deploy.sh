#!/bin/bash

# Deployment Script for Trading Bot
# Supports multiple environments with proper validation

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/tmp/deploy-$(date +%Y%m%d_%H%M%S).log"

# Default values
ENVIRONMENT=""
NAMESPACE="trading-bot"
KUBECTL_CONTEXT=""
DRY_RUN=false
SKIP_TESTS=false
FORCE_DEPLOY=false

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Usage information
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Options:
    -e, --environment ENV   Target environment (development|staging|production)
    -n, --namespace NS      Kubernetes namespace (default: trading-bot)
    -c, --context CTX       Kubectl context to use
    -d, --dry-run          Perform dry run without actual deployment
    -s, --skip-tests       Skip pre-deployment tests
    -f, --force            Force deployment without confirmation
    -h, --help             Show this help message

Examples:
    $0 --environment staging --context staging-cluster
    $0 --environment production --context prod-cluster --dry-run
    $0 --environment development --skip-tests
EOF
}

# Validate environment
validate_environment() {
    case "$ENVIRONMENT" in
        development|staging|production)
            log "Deploying to environment: $ENVIRONMENT"
            ;;
        *)
            error_exit "Invalid environment: $ENVIRONMENT. Must be development, staging, or production"
            ;;
    esac
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check required tools
    local required_tools=("kubectl" "docker" "helm")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            error_exit "Required tool not found: $tool"
        fi
    done
    
    # Check kubectl context
    if [[ -n "$KUBECTL_CONTEXT" ]]; then
        if ! kubectl config get-contexts "$KUBECTL_CONTEXT" >/dev/null 2>&1; then
            error_exit "Kubectl context not found: $KUBECTL_CONTEXT"
        fi
        kubectl config use-context "$KUBECTL_CONTEXT"
    fi
    
    # Check cluster connectivity
    if ! kubectl cluster-info >/dev/null 2>&1; then
        error_exit "Cannot connect to Kubernetes cluster"
    fi
    
    log "Prerequisites check passed"
}

# Load environment configuration
load_environment_config() {
    local env_file="${PROJECT_ROOT}/environments/.env.${ENVIRONMENT}"
    
    if [[ ! -f "$env_file" ]]; then
        error_exit "Environment file not found: $env_file"
    fi
    
    log "Loading environment configuration: $env_file"
    
    # Export environment variables
    set -a
    source "$env_file"
    set +a
}

# Run pre-deployment tests
run_pre_deployment_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log "Skipping pre-deployment tests"
        return 0
    fi
    
    log "Running pre-deployment tests..."
    
    cd "$PROJECT_ROOT"
    
    # Run linting
    npm run lint || error_exit "Linting failed"
    
    # Run unit tests
    npm run test:unit || error_exit "Unit tests failed"
    
    # Run security tests
    npm run test:security || error_exit "Security tests failed"
    
    log "Pre-deployment tests passed"
}

# Build and push images
build_and_push_images() {
    log "Building and pushing Docker images..."
    
    local registry="${CONTAINER_REGISTRY:-localhost:5000}"
    local tag="${ENVIRONMENT}-$(git rev-parse --short HEAD)"
    
    # Build backend image
    log "Building backend image..."
    docker build -f docker/Dockerfile.backend -t "${registry}/trading-bot/backend:${tag}" .
    docker push "${registry}/trading-bot/backend:${tag}"
    
    # Build frontend image
    log "Building frontend image..."
    docker build -f docker/Dockerfile.frontend -t "${registry}/trading-bot/frontend:${tag}" .
    docker push "${registry}/trading-bot/frontend:${tag}"
    
    # Update image tags in manifests
    sed -i "s|trading-bot/backend:latest|${registry}/trading-bot/backend:${tag}|g" k8s/backend.yaml
    sed -i "s|trading-bot/frontend:latest|${registry}/trading-bot/frontend:${tag}|g" k8s/frontend.yaml
    
    log "Images built and pushed successfully"
}

# Deploy to Kubernetes
deploy_to_kubernetes() {
    log "Deploying to Kubernetes..."
    
    # Create namespace if it doesn't exist
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply manifests
    local manifests=(
        "k8s/namespace.yaml"
        "k8s/secrets.yaml"
        "k8s/configmap.yaml"
        "k8s/postgres.yaml"
        "k8s/redis.yaml"
        "k8s/rabbitmq.yaml"
        "k8s/backend.yaml"
        "k8s/frontend.yaml"
        "k8s/monitoring.yaml"
        "k8s/backup.yaml"
    )
    
    for manifest in "${manifests[@]}"; do
        log "Applying manifest: $manifest"
        if [[ "$DRY_RUN" == "true" ]]; then
            kubectl apply -f "$manifest" --dry-run=client -o yaml
        else
            kubectl apply -f "$manifest"
        fi
    done
    
    if [[ "$DRY_RUN" == "false" ]]; then
        # Wait for deployments to be ready
        log "Waiting for deployments to be ready..."
        kubectl rollout status deployment/backend -n "$NAMESPACE" --timeout=600s
        kubectl rollout status deployment/frontend -n "$NAMESPACE" --timeout=600s
        
        # Wait for stateful sets to be ready
        kubectl rollout status statefulset/postgres -n "$NAMESPACE" --timeout=600s
    fi
    
    log "Kubernetes deployment completed"
}

# Run post-deployment tests
run_post_deployment_tests() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log "Skipping post-deployment tests (dry run)"
        return 0
    fi
    
    log "Running post-deployment tests..."
    
    # Get service endpoints
    local backend_service=$(kubectl get service backend-service -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}')
    local frontend_service=$(kubectl get service frontend-service -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}')
    
    # Test backend health
    kubectl run test-backend --rm -i --restart=Never --image=curlimages/curl -- \
        curl -f "http://${backend_service}:3000/health" || error_exit "Backend health check failed"
    
    # Test frontend health
    kubectl run test-frontend --rm -i --restart=Never --image=curlimages/curl -- \
        curl -f "http://${frontend_service}/health" || error_exit "Frontend health check failed"
    
    log "Post-deployment tests passed"
}

# Generate deployment report
generate_deployment_report() {
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local git_commit=$(git rev-parse HEAD)
    local git_branch=$(git rev-parse --abbrev-ref HEAD)
    
    cat > "/tmp/deployment_report_$(date +%Y%m%d_%H%M%S).json" << EOF
{
    "timestamp": "$timestamp",
    "environment": "$ENVIRONMENT",
    "namespace": "$NAMESPACE",
    "git_commit": "$git_commit",
    "git_branch": "$git_branch",
    "kubectl_context": "$KUBECTL_CONTEXT",
    "dry_run": $DRY_RUN,
    "status": "success"
}
EOF
    
    log "Deployment report generated"
}

# Rollback deployment
rollback_deployment() {
    log "Rolling back deployment..."
    
    kubectl rollout undo deployment/backend -n "$NAMESPACE"
    kubectl rollout undo deployment/frontend -n "$NAMESPACE"
    
    kubectl rollout status deployment/backend -n "$NAMESPACE" --timeout=300s
    kubectl rollout status deployment/frontend -n "$NAMESPACE" --timeout=300s
    
    log "Rollback completed"
}

# Cleanup on exit
cleanup() {
    local exit_code=$?
    
    if [[ $exit_code -ne 0 ]]; then
        log "Deployment failed with exit code: $exit_code"
        
        if [[ "$DRY_RUN" == "false" && "$ENVIRONMENT" == "production" ]]; then
            read -p "Do you want to rollback? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                rollback_deployment
            fi
        fi
    fi
    
    log "Deployment log saved to: $LOG_FILE"
}

# Main deployment process
main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -c|--context)
                KUBECTL_CONTEXT="$2"
                shift 2
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -s|--skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            -f|--force)
                FORCE_DEPLOY=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                error_exit "Unknown option: $1"
                ;;
        esac
    done
    
    # Validate required arguments
    if [[ -z "$ENVIRONMENT" ]]; then
        error_exit "Environment must be specified with --environment"
    fi
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    log "=== Starting deployment process ==="
    log "Environment: $ENVIRONMENT"
    log "Namespace: $NAMESPACE"
    log "Dry run: $DRY_RUN"
    
    # Validate environment
    validate_environment
    
    # Check prerequisites
    check_prerequisites
    
    # Load environment configuration
    load_environment_config
    
    # Confirmation for production
    if [[ "$ENVIRONMENT" == "production" && "$FORCE_DEPLOY" == "false" && "$DRY_RUN" == "false" ]]; then
        read -p "Are you sure you want to deploy to PRODUCTION? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "Deployment cancelled by user"
            exit 0
        fi
    fi
    
    # Run pre-deployment tests
    run_pre_deployment_tests
    
    # Build and push images
    if [[ "$DRY_RUN" == "false" ]]; then
        build_and_push_images
    fi
    
    # Deploy to Kubernetes
    deploy_to_kubernetes
    
    # Run post-deployment tests
    run_post_deployment_tests
    
    # Generate deployment report
    generate_deployment_report
    
    log "=== Deployment completed successfully ==="
}

# Run main function
main "$@"