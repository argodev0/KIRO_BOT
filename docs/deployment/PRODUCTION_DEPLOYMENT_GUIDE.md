# Production Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the AI Crypto Trading Bot to production environments. Follow these procedures carefully to ensure a secure, scalable, and reliable deployment.

## Prerequisites

### System Requirements
- **Operating System:** Ubuntu 20.04 LTS or later
- **CPU:** Minimum 4 cores, Recommended 8+ cores
- **RAM:** Minimum 16GB, Recommended 32GB+
- **Storage:** Minimum 500GB SSD, Recommended 1TB+ NVMe SSD
- **Network:** Stable internet connection with low latency to exchanges

### Required Software
- Docker Engine 20.10+
- Docker Compose 2.0+
- Kubernetes 1.24+ (for container orchestration)
- Helm 3.8+ (for Kubernetes deployments)
- PostgreSQL 14+
- Redis 7.0+
- RabbitMQ 3.10+

### Security Prerequisites
- SSL/TLS certificates for HTTPS
- Firewall configuration
- VPN access for administrative tasks
- Backup storage solution
- Monitoring infrastructure

## Pre-Deployment Checklist

### 1. Environment Preparation
- [ ] Provision production servers
- [ ] Configure network security groups
- [ ] Set up SSL certificates
- [ ] Configure DNS records
- [ ] Prepare backup storage
- [ ] Set up monitoring infrastructure

### 2. Security Configuration
- [ ] Generate production API keys
- [ ] Configure secrets management
- [ ] Set up firewall rules
- [ ] Configure VPN access
- [ ] Enable audit logging
- [ ] Set up intrusion detection

### 3. Database Setup
- [ ] Provision PostgreSQL cluster
- [ ] Configure replication
- [ ] Set up automated backups
- [ ] Create database indexes
- [ ] Configure connection pooling
- [ ] Test disaster recovery

## Step-by-Step Deployment

### Step 1: Infrastructure Setup

#### 1.1 Server Provisioning
```bash
# Create production servers (example using cloud provider CLI)
# Adjust commands based on your cloud provider

# Application servers
create-server --name trading-bot-app-01 --size large --image ubuntu-20.04
create-server --name trading-bot-app-02 --size large --image ubuntu-20.04

# Database servers
create-server --name trading-bot-db-01 --size xlarge --image ubuntu-20.04
create-server --name trading-bot-db-02 --size xlarge --image ubuntu-20.04

# Load balancer
create-load-balancer --name trading-bot-lb --type application
```

#### 1.2 Network Configuration
```bash
# Configure security groups
create-security-group --name trading-bot-app --rules "80,443,22"
create-security-group --name trading-bot-db --rules "5432"

# Configure firewall rules
ufw enable
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw deny 5432/tcp   # PostgreSQL (internal only)
```

### Step 2: Database Deployment

#### 2.1 PostgreSQL Cluster Setup
```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql-14 postgresql-contrib-14

# Configure PostgreSQL for production
sudo -u postgres psql << EOF
CREATE DATABASE trading_bot_prod;
CREATE USER trading_bot WITH ENCRYPTED PASSWORD 'SECURE_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE trading_bot_prod TO trading_bot;
ALTER USER trading_bot CREATEDB;
EOF

# Configure postgresql.conf for production
sudo nano /etc/postgresql/14/main/postgresql.conf
```

**Production PostgreSQL Configuration:**
```ini
# Memory settings
shared_buffers = 8GB
effective_cache_size = 24GB
work_mem = 256MB
maintenance_work_mem = 2GB

# Connection settings
max_connections = 200
shared_preload_libraries = 'pg_stat_statements'

# WAL settings
wal_level = replica
max_wal_senders = 3
wal_keep_size = 1GB

# Checkpoint settings
checkpoint_completion_target = 0.9
checkpoint_timeout = 15min

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_statement = 'all'
log_min_duration_statement = 1000
```

#### 2.2 Database Replication Setup
```bash
# On primary server
sudo -u postgres psql << EOF
CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'REPLICATION_PASSWORD';
EOF

# Configure pg_hba.conf
echo "host replication replicator STANDBY_IP/32 md5" >> /etc/postgresql/14/main/pg_hba.conf

# On standby server
sudo -u postgres pg_basebackup -h PRIMARY_IP -D /var/lib/postgresql/14/main -U replicator -P -v -R -W
```

### Step 3: Application Deployment

#### 3.1 Environment Configuration
```bash
# Create production environment file
cat > .env.production << EOF
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://trading_bot:PASSWORD@db-cluster:5432/trading_bot_prod
REDIS_URL=redis://redis-cluster:6379
RABBITMQ_URL=amqp://user:password@rabbitmq-cluster:5672

# Exchange APIs
BINANCE_API_KEY=ENCRYPTED_KEY
BINANCE_SECRET_KEY=ENCRYPTED_SECRET
KUCOIN_API_KEY=ENCRYPTED_KEY
KUCOIN_SECRET_KEY=ENCRYPTED_SECRET

# Security
JWT_SECRET=SECURE_JWT_SECRET
ENCRYPTION_KEY=SECURE_ENCRYPTION_KEY
API_RATE_LIMIT=1000

# Monitoring
PROMETHEUS_ENABLED=true
GRAFANA_ENABLED=true
LOG_LEVEL=info

# Alerts
ALERT_EMAIL=admin@company.com
SLACK_WEBHOOK=https://hooks.slack.com/services/...
EOF
```

#### 3.2 Docker Deployment
```bash
# Build production images
docker build -f docker/Dockerfile.backend -t trading-bot-backend:latest .
docker build -f docker/Dockerfile.frontend -t trading-bot-frontend:latest .

# Deploy using Docker Compose
docker-compose -f docker/docker-compose.prod.yml up -d

# Verify deployment
docker-compose -f docker/docker-compose.prod.yml ps
docker-compose -f docker/docker-compose.prod.yml logs
```

#### 3.3 Kubernetes Deployment (Alternative)
```bash
# Create namespace
kubectl create namespace trading-bot-prod

# Deploy using Helm
helm install trading-bot ./k8s/helm \
  --namespace trading-bot-prod \
  --values ./k8s/helm/values-prod.yaml

# Verify deployment
kubectl get pods -n trading-bot-prod
kubectl get services -n trading-bot-prod
```

### Step 4: SSL/TLS Configuration

#### 4.1 Certificate Installation
```bash
# Install Certbot for Let's Encrypt
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d trading-bot.yourdomain.com

# Configure auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### 4.2 Nginx Configuration
```nginx
server {
    listen 443 ssl http2;
    server_name trading-bot.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/trading-bot.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/trading-bot.yourdomain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        limit_req zone=api burst=10 nodelay;
        proxy_pass http://localhost:3000;
        # Additional API-specific headers
    }
}
```

### Step 5: Monitoring Setup

#### 5.1 Prometheus Configuration
```bash
# Deploy Prometheus
docker run -d \
  --name prometheus \
  -p 9090:9090 \
  -v ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus
```

#### 5.2 Grafana Setup
```bash
# Deploy Grafana
docker run -d \
  --name grafana \
  -p 3001:3000 \
  -e "GF_SECURITY_ADMIN_PASSWORD=SECURE_PASSWORD" \
  grafana/grafana
```

### Step 6: Backup Configuration

#### 6.1 Database Backups
```bash
# Create backup script
cat > /opt/scripts/backup-database.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/database"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="trading_bot_backup_${DATE}.sql"

mkdir -p $BACKUP_DIR
pg_dump -h localhost -U trading_bot trading_bot_prod > $BACKUP_DIR/$BACKUP_FILE
gzip $BACKUP_DIR/$BACKUP_FILE

# Keep only last 30 days of backups
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

# Upload to cloud storage
aws s3 cp $BACKUP_DIR/$BACKUP_FILE.gz s3://trading-bot-backups/database/
EOF

chmod +x /opt/scripts/backup-database.sh

# Schedule backups
crontab -e
# Add: 0 2 * * * /opt/scripts/backup-database.sh
```

#### 6.2 Application Backups
```bash
# Create application backup script
cat > /opt/scripts/backup-application.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/application"
DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR="/opt/trading-bot"

mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/app_backup_${DATE}.tar.gz -C $APP_DIR .

# Upload to cloud storage
aws s3 cp $BACKUP_DIR/app_backup_${DATE}.tar.gz s3://trading-bot-backups/application/
EOF

chmod +x /opt/scripts/backup-application.sh
```

## Post-Deployment Verification

### 1. Health Checks
```bash
# Check application health
curl -f http://localhost:3000/health || exit 1

# Check database connectivity
psql -h localhost -U trading_bot -d trading_bot_prod -c "SELECT 1;"

# Check Redis connectivity
redis-cli ping

# Check RabbitMQ
rabbitmqctl status
```

### 2. Performance Testing
```bash
# Run load tests
npm run test:load

# Monitor resource usage
htop
iotop
nethogs
```

### 3. Security Verification
```bash
# Run security scan
npm audit
docker scan trading-bot-backend:latest

# Check SSL configuration
ssllabs-scan --host=trading-bot.yourdomain.com
```

## Rollback Procedures

### 1. Application Rollback
```bash
# Stop current version
docker-compose -f docker/docker-compose.prod.yml down

# Deploy previous version
docker-compose -f docker/docker-compose.prod.yml up -d --scale app=0
docker tag trading-bot-backend:previous trading-bot-backend:latest
docker-compose -f docker/docker-compose.prod.yml up -d
```

### 2. Database Rollback
```bash
# Restore from backup
pg_restore -h localhost -U trading_bot -d trading_bot_prod /opt/backups/database/backup_file.sql
```

## Troubleshooting

### Common Issues

#### High CPU Usage
```bash
# Check processes
top -p $(pgrep -d',' node)

# Check application logs
docker logs trading-bot-backend

# Scale horizontally if needed
docker-compose -f docker/docker-compose.prod.yml up -d --scale app=3
```

#### Database Connection Issues
```bash
# Check PostgreSQL status
systemctl status postgresql

# Check connections
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"

# Restart if needed
systemctl restart postgresql
```

#### Memory Issues
```bash
# Check memory usage
free -h
cat /proc/meminfo

# Check for memory leaks
valgrind --tool=memcheck node dist/index.js
```

## Maintenance Procedures

### Regular Maintenance Tasks
- [ ] Weekly security updates
- [ ] Monthly performance reviews
- [ ] Quarterly disaster recovery tests
- [ ] Annual security audits

### Update Procedures
1. Test updates in staging environment
2. Schedule maintenance window
3. Create backup before updates
4. Deploy updates with rollback plan
5. Verify functionality post-update
6. Monitor for 24 hours after deployment

## Support and Escalation

### Contact Information
- **Primary Admin:** admin@company.com
- **Emergency Contact:** +1-XXX-XXX-XXXX
- **Slack Channel:** #trading-bot-alerts

### Escalation Matrix
1. **Level 1:** Application issues, performance degradation
2. **Level 2:** Security incidents, data corruption
3. **Level 3:** Complete system failure, data breach

This deployment guide ensures a secure, scalable, and maintainable production environment for the AI Crypto Trading Bot system.