# Production Deployment Automation

This document describes the comprehensive deployment automation system for the AI Crypto Trading Bot production environment with paper trading enforcement.

## Overview

The deployment automation system provides:

- **Automated deployment orchestration** with health verification
- **Docker container orchestration** with health checks and restart policies
- **Database migration automation** with backup and rollback capabilities
- **Comprehensive backup automation** with cloud storage and retention policies
- **Production environment validation** with paper trading safety checks
- **Monitoring and alerting setup** with Grafana dashboards and Prometheus metrics
- **SSL certificate management** with Let's Encrypt automation
- **Security hardening** with firewall, rate limiting, and intrusion detection

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                Production Orchestrator                      │
│                (production-orchestrator.sh)                │
└─────────────────┬───────────────────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
┌─────────┐ ┌─────────────┐ ┌─────────────┐
│ Deploy  │ │ Health      │ │ Backup      │
│ Auto    │ │ Check       │ │ Auto        │
└─────────┘ └─────────────┘ └─────────────┘
    │             │             │
    ▼             ▼             ▼
┌─────────┐ ┌─────────────┐ ┌─────────────┐
│Database │ │ Validation  │ │ Monitoring  │
│Migration│ │ Scripts     │ │ Setup       │
└─────────┘ └─────────────┘ └─────────────┘
```

## Scripts Overview

### 1. Production Orchestrator (`production-orchestrator.sh`)

**Master deployment script** that coordinates all automation components.

```bash
# Full deployment
./scripts/production-orchestrator.sh deploy

# Check system status
./scripts/production-orchestrator.sh status

# Run health checks
./scripts/production-orchestrator.sh health
```

**Features:**
- Complete deployment orchestration
- Prerequisites validation
- Error handling and rollback
- Comprehensive logging
- Status monitoring

### 2. Deployment Automation (`deploy-automation.sh`)

**Core deployment engine** with health verification and rollback capabilities.

```bash
# Automated deployment
./scripts/deploy-automation.sh deploy

# Rollback deployment
./scripts/deploy-automation.sh rollback

# Check deployment status
./scripts/deploy-automation.sh status
```

**Features:**
- Multi-phase deployment process
- Health checks for all services
- Paper trading validation
- SSL certificate management
- Automatic rollback on failure

### 3. Health Check System (`health-check.sh`)

**Comprehensive health monitoring** for all system components.

```bash
# Full health check
./scripts/health-check.sh full

# Check specific components
./scripts/health-check.sh containers
./scripts/health-check.sh database
./scripts/health-check.sh paper-trading
```

**Monitors:**
- Docker container health
- Service endpoint availability
- Database connectivity and performance
- Paper trading safety configuration
- SSL certificate status
- System resource usage
- Network connectivity

### 4. Database Migration (`database-migration.sh`)

**Automated database migrations** with backup and rollback support.

```bash
# Run migrations
./scripts/database-migration.sh migrate

# Check migration status
./scripts/database-migration.sh status

# Generate new migration
./scripts/database-migration.sh generate add_new_table
```

**Features:**
- Automatic backup before migrations
- Migration tracking and validation
- Rollback capabilities
- Performance monitoring
- Checksum verification

### 5. Backup Automation (`backup-automation.sh`)

**Comprehensive backup solution** with scheduling and cloud storage.

```bash
# Run backup
./scripts/backup-automation.sh run

# Setup automated scheduling
./scripts/backup-automation.sh schedule

# List available backups
./scripts/backup-automation.sh list
```

**Backup Types:**
- Database backups (PostgreSQL)
- Application source code
- Configuration files
- Encrypted storage
- S3 cloud backup with retention

## Deployment Process

### Phase 1: Prerequisites and Validation

1. **System Prerequisites Check**
   - Docker and Docker Compose availability
   - Required commands (node, npm, curl, jq)
   - File permissions and directory structure

2. **Configuration Validation**
   - Production environment variables
   - Paper trading safety settings
   - SSL configuration
   - Security settings

3. **API Permissions Validation**
   - Binance API read-only verification
   - KuCoin API read-only verification
   - Paper trading endpoint testing

### Phase 2: Database Setup

1. **Pre-deployment Backup**
   - Automatic database backup creation
   - Backup verification and encryption

2. **Database Migrations**
   - Schema migration execution
   - Migration tracking and validation
   - Performance monitoring

### Phase 3: Application Deployment

1. **Docker Image Building**
   - Frontend and backend image creation
   - Image optimization and security scanning

2. **Service Deployment**
   - Docker Compose orchestration
   - Health check configuration
   - Resource limit enforcement

3. **SSL Certificate Management**
   - Let's Encrypt certificate provisioning
   - Automatic renewal setup
   - HTTPS configuration

### Phase 4: Monitoring and Automation

1. **Monitoring Stack Setup**
   - Prometheus metrics collection
   - Grafana dashboard configuration
   - Alert rule deployment

2. **Backup Automation**
   - Scheduled backup configuration
   - Cloud storage setup
   - Retention policy enforcement

### Phase 5: Health Validation

1. **Service Health Checks**
   - Container health verification
   - Endpoint availability testing
   - Performance validation

2. **Paper Trading Safety**
   - Environment variable verification
   - API endpoint testing
   - Trading permission validation

3. **Security Validation**
   - SSL certificate verification
   - Security header testing
   - Rate limiting validation

## Configuration

### Environment Variables

**Critical Paper Trading Safety:**
```bash
PAPER_TRADING_MODE=true
ALLOW_REAL_TRADES=false
FORCE_PAPER_TRADING=true
PAPER_TRADING_VALIDATION=strict
```

**Database Configuration:**
```bash
DATABASE_URL=postgresql://postgres:password@postgres:5432/trading_bot
DATABASE_SSL=true
DATABASE_POOL_SIZE=20
```

**SSL Configuration:**
```bash
SSL_ENABLED=true
DOMAIN_NAME=your-domain.com
LETSENCRYPT_EMAIL=your-email@example.com
```

**Backup Configuration:**
```bash
BACKUP_RETENTION_DAYS=30
BACKUP_SCHEDULE="0 2 * * *"
AWS_S3_BUCKET=your-backup-bucket
BACKUP_ENCRYPTION=true
```

### Docker Compose Configuration

The production Docker Compose file includes:

- **Health checks** for all services
- **Resource limits** and reservations
- **Restart policies** for high availability
- **Volume management** for data persistence
- **Network isolation** for security
- **Environment variable** injection

## Monitoring and Alerting

### Prometheus Metrics

- **System metrics**: CPU, memory, disk usage
- **Application metrics**: Response times, error rates
- **Trading metrics**: Paper trade execution rates
- **Security metrics**: Failed login attempts, blocked IPs

### Grafana Dashboards

- **System Overview**: Infrastructure health
- **Application Performance**: API response times
- **Trading Activity**: Paper trading statistics
- **Security Monitoring**: Security events and alerts

### Health Check Endpoints

- `/health` - Application health status
- `/api/health` - API service health
- `/metrics` - Prometheus metrics endpoint

## Backup and Recovery

### Backup Types

1. **Database Backups**
   - Full PostgreSQL dumps
   - Compressed and encrypted
   - Daily automated backups

2. **Application Backups**
   - Source code archives
   - Configuration files
   - Docker images

3. **Configuration Backups**
   - Environment files
   - Docker Compose configurations
   - SSL certificates

### Recovery Procedures

1. **Database Recovery**
   ```bash
   ./scripts/backup-automation.sh restore /path/to/backup.sql.gz
   ```

2. **Full System Recovery**
   ```bash
   ./scripts/deploy-automation.sh rollback
   ```

3. **Configuration Recovery**
   - Restore from configuration backups
   - Verify environment variables
   - Restart services

## Security Features

### Paper Trading Safety

- **Multi-layer validation** of paper trading mode
- **API key permission verification** (read-only only)
- **Real trading operation blocking**
- **Continuous monitoring** of trading mode

### Infrastructure Security

- **SSL/TLS encryption** with Let's Encrypt
- **Firewall configuration** with UFW
- **Intrusion detection** with Fail2Ban
- **Rate limiting** on all endpoints
- **Input validation** and sanitization

### Access Control

- **API key management** with permission validation
- **Database access controls** with SSL
- **Container isolation** with Docker networks
- **Log access controls** with proper permissions

## Troubleshooting

### Common Issues

1. **Deployment Failures**
   - Check prerequisites with `./scripts/production-orchestrator.sh status`
   - Review logs in `logs/` directory
   - Verify environment configuration

2. **Health Check Failures**
   - Run individual health checks: `./scripts/health-check.sh [component]`
   - Check Docker container status: `docker ps -a`
   - Review service logs: `docker-compose logs [service]`

3. **Paper Trading Issues**
   - Verify environment variables: `./scripts/validate-production.js`
   - Check API permissions: `./scripts/validate-api-permissions.js`
   - Test paper trading endpoint

### Log Files

- **Orchestrator logs**: `logs/orchestrator_*.log`
- **Deployment logs**: `logs/deployment_*.log`
- **Health check logs**: `logs/health_check_*.log`
- **Backup logs**: `logs/backup_*.log`
- **Migration logs**: `logs/migration_*.log`

### Recovery Commands

```bash
# Check system status
./scripts/production-orchestrator.sh status

# Run health checks
./scripts/health-check.sh full

# Restart services
docker-compose -f docker/docker-compose.prod.yml restart

# View logs
docker-compose -f docker/docker-compose.prod.yml logs -f

# Rollback deployment
./scripts/deploy-automation.sh rollback
```

## Best Practices

### Deployment

1. **Always validate** configuration before deployment
2. **Create backups** before major changes
3. **Monitor health checks** during deployment
4. **Test paper trading** mode after deployment
5. **Verify SSL certificates** are working

### Monitoring

1. **Set up alerts** for critical metrics
2. **Monitor disk space** and resource usage
3. **Check backup success** regularly
4. **Review security logs** for anomalies
5. **Test recovery procedures** periodically

### Security

1. **Use read-only API keys** only
2. **Keep SSL certificates** up to date
3. **Monitor failed login attempts**
4. **Regular security updates**
5. **Audit paper trading** configuration

## Support and Maintenance

### Regular Tasks

- **Daily**: Monitor health checks and alerts
- **Weekly**: Review backup success and logs
- **Monthly**: Update SSL certificates and security patches
- **Quarterly**: Test recovery procedures and update documentation

### Maintenance Windows

- **Planned maintenance**: Use blue-green deployment
- **Emergency maintenance**: Use rollback procedures
- **Security updates**: Apply immediately with testing

### Contact and Escalation

For deployment issues:
1. Check logs and run diagnostics
2. Review troubleshooting guide
3. Use rollback procedures if necessary
4. Document issues for future prevention

---

**⚠️ IMPORTANT SAFETY NOTICE**

This system is configured for **PAPER TRADING ONLY**. All trading operations are simulated and no real money is at risk. The deployment automation includes multiple safety checks to ensure this configuration is maintained.

- ✅ Paper trading mode is enforced at multiple levels
- ✅ Real trading operations are blocked
- ✅ API keys are validated for read-only permissions
- ✅ Continuous monitoring ensures safety compliance