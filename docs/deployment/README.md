# Deployment Guide

This document provides comprehensive instructions for deploying the AI Crypto Trading Bot to different environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Docker Deployment](#docker-deployment)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [Helm Deployment](#helm-deployment)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Monitoring and Alerting](#monitoring-and-alerting)
8. [Backup and Recovery](#backup-and-recovery)
9. [Troubleshooting](#troubleshooting)
10. [Runbooks](#runbooks)

## Prerequisites

### Required Tools

- **Docker** (v20.10+)
- **Docker Compose** (v2.0+)
- **Kubernetes** (v1.25+)
- **kubectl** (v1.25+)
- **Helm** (v3.10+)
- **Node.js** (v18+)
- **npm** (v8+)

### Required Accounts and Access

- Container registry access (Docker Hub, AWS ECR, etc.)
- Kubernetes cluster access
- Exchange API keys (Binance, KuCoin)
- SMTP credentials for notifications
- Slack webhook (optional)
- AWS S3 bucket for backups (optional)

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/trading-bot.git
cd trading-bot
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the appropriate environment file:

```bash
# For development
cp environments/.env.development .env

# For staging
cp environments/.env.staging .env

# For production
cp environments/.env.production .env
```

### 4. Configure Secrets

Update the following secrets in your environment file or secret management system:

```bash
# Security
JWT_SECRET=your-jwt-secret-key
ENCRYPTION_KEY=your-32-character-encryption-key
SESSION_SECRET=your-session-secret

# Database
POSTGRES_PASSWORD=your-postgres-password

# Exchange APIs
BINANCE_API_KEY=your-binance-api-key
BINANCE_API_SECRET=your-binance-api-secret
KUCOIN_API_KEY=your-kucoin-api-key
KUCOIN_API_SECRET=your-kucoin-api-secret
KUCOIN_PASSPHRASE=your-kucoin-passphrase

# Notifications
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-smtp-password
SLACK_WEBHOOK_URL=your-slack-webhook-url

# Monitoring
GRAFANA_PASSWORD=your-grafana-password

# Backup (optional)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET=your-backup-bucket
```

## Docker Deployment

### Development Environment

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Environment

```bash
# Build and start production services
docker-compose -f docker/docker-compose.prod.yml up -d

# Scale services
docker-compose -f docker/docker-compose.prod.yml up -d --scale backend=3

# Update services
docker-compose -f docker/docker-compose.prod.yml pull
docker-compose -f docker/docker-compose.prod.yml up -d
```

## Kubernetes Deployment

### 1. Create Namespace

```bash
kubectl create namespace trading-bot
```

### 2. Create Secrets

```bash
# Create main secrets
kubectl create secret generic trading-bot-secrets \
  --from-literal=JWT_SECRET=your-jwt-secret \
  --from-literal=ENCRYPTION_KEY=your-encryption-key \
  --from-literal=POSTGRES_PASSWORD=your-postgres-password \
  --from-literal=GRAFANA_PASSWORD=your-grafana-password \
  -n trading-bot

# Create exchange API secrets
kubectl create secret generic exchange-api-secrets \
  --from-literal=BINANCE_API_KEY=your-binance-key \
  --from-literal=BINANCE_API_SECRET=your-binance-secret \
  --from-literal=KUCOIN_API_KEY=your-kucoin-key \
  --from-literal=KUCOIN_API_SECRET=your-kucoin-secret \
  --from-literal=KUCOIN_PASSPHRASE=your-kucoin-passphrase \
  -n trading-bot

# Create backup secrets (optional)
kubectl create secret generic backup-secrets \
  --from-literal=AWS_ACCESS_KEY_ID=your-aws-key \
  --from-literal=AWS_SECRET_ACCESS_KEY=your-aws-secret \
  --from-literal=AWS_S3_BUCKET=your-bucket \
  -n trading-bot
```

### 3. Deploy Services

```bash
# Deploy in order
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/rabbitmq.yaml

# Wait for databases to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n trading-bot --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n trading-bot --timeout=300s

# Deploy application
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml

# Deploy monitoring and backup
kubectl apply -f k8s/monitoring.yaml
kubectl apply -f k8s/alerting.yaml
kubectl apply -f k8s/backup.yaml
```

### 4. Verify Deployment

```bash
# Check pod status
kubectl get pods -n trading-bot

# Check services
kubectl get services -n trading-bot

# Check ingress
kubectl get ingress -n trading-bot

# View logs
kubectl logs -f deployment/backend -n trading-bot
```

## Helm Deployment

### 1. Add Helm Repositories

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
```

### 2. Install Dependencies

```bash
# Install PostgreSQL
helm install postgresql bitnami/postgresql \
  --namespace trading-bot \
  --create-namespace \
  --set auth.postgresPassword=your-password \
  --set auth.database=trading_bot

# Install Redis
helm install redis bitnami/redis \
  --namespace trading-bot \
  --set auth.password=your-redis-password

# Install RabbitMQ
helm install rabbitmq bitnami/rabbitmq \
  --namespace trading-bot \
  --set auth.password=your-rabbitmq-password
```

### 3. Deploy Trading Bot

```bash
# Install from local chart
helm install trading-bot ./k8s/helm \
  --namespace trading-bot \
  --values ./k8s/helm/values.yaml \
  --set global.environment=production

# Or install specific environment
helm install trading-bot ./k8s/helm \
  --namespace trading-bot \
  --values ./k8s/helm/values-production.yaml
```

### 4. Upgrade Deployment

```bash
# Upgrade with new values
helm upgrade trading-bot ./k8s/helm \
  --namespace trading-bot \
  --values ./k8s/helm/values.yaml \
  --set image.tag=v1.1.0

# Rollback if needed
helm rollback trading-bot 1 --namespace trading-bot
```

## CI/CD Pipeline

### GitHub Actions Setup

1. **Configure Secrets** in GitHub repository settings:
   - `CONTAINER_REGISTRY`: Container registry URL
   - `REGISTRY_USERNAME`: Registry username
   - `REGISTRY_PASSWORD`: Registry password
   - `KUBE_CONFIG_STAGING`: Base64 encoded kubeconfig for staging
   - `KUBE_CONFIG_PRODUCTION`: Base64 encoded kubeconfig for production
   - `SLACK_WEBHOOK_URL`: Slack webhook for notifications

2. **Pipeline Triggers**:
   - Push to `develop` branch → Deploy to staging
   - Push to `main` branch → Deploy to production
   - Pull requests → Run tests only

3. **Manual Deployment**:
   ```bash
   # Use deployment script
   ./scripts/deploy.sh --environment production --context prod-cluster
   
   # With dry run
   ./scripts/deploy.sh --environment staging --dry-run
   ```

### Deployment Script Usage

```bash
# Deploy to staging
./scripts/deploy.sh -e staging -c staging-cluster

# Deploy to production with confirmation
./scripts/deploy.sh -e production -c prod-cluster

# Dry run deployment
./scripts/deploy.sh -e production -c prod-cluster --dry-run

# Skip tests (not recommended for production)
./scripts/deploy.sh -e staging --skip-tests

# Force deployment without confirmation
./scripts/deploy.sh -e production --force
```

## Monitoring and Alerting

### Accessing Monitoring Tools

```bash
# Port forward to access locally
kubectl port-forward svc/prometheus-service 9090:9090 -n trading-bot
kubectl port-forward svc/grafana-service 3000:3000 -n trading-bot
kubectl port-forward svc/alertmanager-service 9093:9093 -n trading-bot

# Access via ingress (if configured)
# https://trading-bot.yourdomain.com/prometheus
# https://trading-bot.yourdomain.com/grafana
```

### Key Metrics to Monitor

- **Application Health**: Uptime, response times, error rates
- **Trading Performance**: Signal generation, order execution, P&L
- **System Resources**: CPU, memory, disk usage
- **Database Performance**: Connection count, query performance
- **Exchange Connectivity**: Connection status, API rate limits

### Alert Configuration

Alerts are configured in `k8s/alerting.yaml` and include:

- **Critical**: Service down, database unavailable, high risk exposure
- **Warning**: High resource usage, slow responses, trading anomalies
- **Info**: Deployment notifications, backup completion

## Backup and Recovery

### Automated Backups

Backups run automatically via CronJob:

```bash
# Check backup status
kubectl get cronjobs -n trading-bot
kubectl get jobs -n trading-bot

# View backup logs
kubectl logs job/postgres-backup-<timestamp> -n trading-bot
```

### Manual Backup

```bash
# Create immediate backup
kubectl create job --from=cronjob/postgres-backup manual-backup-$(date +%s) -n trading-bot

# Download backup locally
kubectl cp trading-bot/backup-pod:/backups/backup.sql.gz ./backup.sql.gz
```

### Restore from Backup

```bash
# List available backups
kubectl exec -it backup-pod -n trading-bot -- /app/scripts/restore.sh --list

# Restore from local file
kubectl exec -it backup-pod -n trading-bot -- /app/scripts/restore.sh --file /backups/backup.sql.gz

# Restore from S3
kubectl exec -it backup-pod -n trading-bot -- /app/scripts/restore.sh --s3-key backups/backup.sql.gz

# Test restore (dry run)
kubectl exec -it backup-pod -n trading-bot -- /app/scripts/restore.sh --file /backups/backup.sql.gz --test
```

## Troubleshooting

### Common Issues

#### 1. Pod Startup Issues

```bash
# Check pod status and events
kubectl describe pod <pod-name> -n trading-bot

# Check logs
kubectl logs <pod-name> -n trading-bot --previous

# Check resource constraints
kubectl top pods -n trading-bot
```

#### 2. Database Connection Issues

```bash
# Test database connectivity
kubectl exec -it <backend-pod> -n trading-bot -- pg_isready -h postgres-service -p 5432

# Check database logs
kubectl logs <postgres-pod> -n trading-bot

# Verify secrets
kubectl get secret trading-bot-secrets -n trading-bot -o yaml
```

#### 3. Exchange API Issues

```bash
# Check API key configuration
kubectl exec -it <backend-pod> -n trading-bot -- env | grep -E "(BINANCE|KUCOIN)"

# Test API connectivity
kubectl exec -it <backend-pod> -n trading-bot -- curl -s "https://api.binance.com/api/v3/ping"

# Check rate limiting
kubectl logs <backend-pod> -n trading-bot | grep -i "rate limit"
```

#### 4. Performance Issues

```bash
# Check resource usage
kubectl top pods -n trading-bot
kubectl top nodes

# Check HPA status
kubectl get hpa -n trading-bot

# Analyze slow queries
kubectl exec -it <postgres-pod> -n trading-bot -- psql -U postgres -d trading_bot -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
```

### Health Checks

```bash
# Application health
curl -f http://backend-service:3000/health

# Database health
kubectl exec -it <postgres-pod> -n trading-bot -- pg_isready

# Redis health
kubectl exec -it <redis-pod> -n trading-bot -- redis-cli ping

# RabbitMQ health
kubectl exec -it <rabbitmq-pod> -n trading-bot -- rabbitmq-diagnostics ping
```

## Runbooks

### Service Recovery Procedures

#### Backend Service Down

1. Check pod status: `kubectl get pods -n trading-bot`
2. Review logs: `kubectl logs deployment/backend -n trading-bot`
3. Check resource usage: `kubectl top pods -n trading-bot`
4. Restart if needed: `kubectl rollout restart deployment/backend -n trading-bot`
5. Scale up if overloaded: `kubectl scale deployment/backend --replicas=5 -n trading-bot`

#### Database Issues

1. Check database pod: `kubectl get pods -l app=postgres -n trading-bot`
2. Review database logs: `kubectl logs <postgres-pod> -n trading-bot`
3. Check disk space: `kubectl exec -it <postgres-pod> -n trading-bot -- df -h`
4. Verify connections: `kubectl exec -it <postgres-pod> -n trading-bot -- psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"`
5. Restart if needed: `kubectl delete pod <postgres-pod> -n trading-bot`

#### Exchange Connection Lost

1. Check network connectivity from backend pod
2. Verify API keys are correct and not expired
3. Check rate limiting status
4. Review exchange status pages
5. Restart backend service if needed

#### High Resource Usage

1. Identify resource-intensive pods: `kubectl top pods -n trading-bot`
2. Check HPA status: `kubectl get hpa -n trading-bot`
3. Scale manually if needed: `kubectl scale deployment/backend --replicas=<count> -n trading-bot`
4. Investigate root cause in application logs
5. Consider resource limit adjustments

### Emergency Procedures

#### Complete System Failure

1. **Immediate Actions**:
   - Stop all trading activities
   - Notify stakeholders
   - Assess scope of failure

2. **Recovery Steps**:
   - Check cluster health: `kubectl get nodes`
   - Verify namespace status: `kubectl get all -n trading-bot`
   - Restore from backup if needed
   - Restart services in dependency order

3. **Post-Recovery**:
   - Verify all services are healthy
   - Check data integrity
   - Resume trading gradually
   - Document incident and lessons learned

#### Data Corruption

1. **Immediate Actions**:
   - Stop all write operations
   - Create emergency backup
   - Assess corruption scope

2. **Recovery Steps**:
   - Restore from latest clean backup
   - Verify data integrity
   - Replay transactions if possible
   - Update application state

3. **Prevention**:
   - Increase backup frequency
   - Implement additional data validation
   - Review backup and recovery procedures

### Maintenance Procedures

#### Planned Maintenance

1. **Pre-maintenance**:
   - Schedule maintenance window
   - Notify users
   - Create backup
   - Prepare rollback plan

2. **During Maintenance**:
   - Enable maintenance mode
   - Perform updates
   - Test functionality
   - Monitor system health

3. **Post-maintenance**:
   - Disable maintenance mode
   - Verify all services
   - Monitor for issues
   - Document changes

#### Security Updates

1. **Assessment**:
   - Review security advisories
   - Assess impact and urgency
   - Plan update strategy

2. **Implementation**:
   - Update base images
   - Rebuild and test containers
   - Deploy to staging first
   - Deploy to production

3. **Verification**:
   - Run security scans
   - Verify functionality
   - Monitor for issues
   - Update documentation

This deployment guide provides comprehensive instructions for deploying and maintaining the AI Crypto Trading Bot in various environments. Always test deployments in staging before applying to production, and maintain regular backups and monitoring.