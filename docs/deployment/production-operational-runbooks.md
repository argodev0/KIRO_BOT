# Production Operational Runbooks

**Version:** 1.0  
**Last Updated:** 2025-08-29  
**System:** AI Crypto Trading Bot - Paper Trading System  

## Table of Contents

1. [System Overview](#system-overview)
2. [Daily Operations](#daily-operations)
3. [Incident Response](#incident-response)
4. [Monitoring and Alerting](#monitoring-and-alerting)
5. [Maintenance Procedures](#maintenance-procedures)
6. [Emergency Procedures](#emergency-procedures)
7. [Troubleshooting Guide](#troubleshooting-guide)

## System Overview

### Architecture Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   Application   │    │    Database     │
│     (Nginx)     │────│   (Node.js)     │────│  (PostgreSQL)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │              │      Cache      │              │
         └──────────────│     (Redis)     │──────────────┘
                        └─────────────────┘
                                 │
                        ┌─────────────────┐
                        │   Monitoring    │
                        │ (Prometheus +   │
                        │    Grafana)     │
                        └─────────────────┘
```

### Key Services
- **Backend API:** Port 3000 (Internal), Port 443 (External HTTPS)
- **Frontend:** Port 3002 (Internal), Port 443 (External HTTPS)
- **Database:** PostgreSQL on port 5432
- **Cache:** Redis on port 6379
- **Monitoring:** Prometheus (9090), Grafana (3001)

### Critical Safety Features
- **Paper Trading Mode:** All trades are simulated
- **Real Trade Blocking:** No real money transactions possible
- **API Restrictions:** Read-only exchange API keys only
- **Safety Monitoring:** Continuous validation of paper trading mode

## Daily Operations

### Morning Checklist (Start of Trading Day)

#### 1. System Health Verification (5 minutes)
```bash
# Check all services are running
docker-compose -f docker/docker-compose.prod.yml ps

# Verify application health
curl -f https://localhost/api/health/detailed

# Check database connectivity
docker exec -it trading-bot-postgres pg_isready -U postgres

# Verify Redis cache
docker exec -it trading-bot-redis redis-cli ping
```

#### 2. Paper Trading Safety Verification (3 minutes)
```bash
# Verify paper trading mode is active
curl -s https://localhost/api/health/safety | jq '.paperTradingMode'
# Expected: true

# Check for any real trading attempts (should be 0)
curl -s https://localhost/api/health/safety | jq '.realTradesBlocked'

# Verify virtual balance tracking
curl -s https://localhost/api/portfolio/summary | jq '.isVirtual'
# Expected: true
```

#### 3. Market Data Connectivity (2 minutes)
```bash
# Test Binance connection
curl -s https://localhost/api/market-data/binance/status

# Test KuCoin connection  
curl -s https://localhost/api/market-data/kucoin/status

# Verify WebSocket connections
curl -s https://localhost/api/health/websockets
```

#### 4. Monitoring Dashboard Review (5 minutes)
- Open Grafana: https://localhost:3001
- Review "Trading Bot Overview" dashboard
- Check "Paper Trading Safety" dashboard
- Verify "System Metrics" dashboard
- Confirm no critical alerts

### Evening Checklist (End of Trading Day)

#### 1. Daily Performance Review (10 minutes)
```bash
# Generate daily performance report
curl -X POST https://localhost/api/reports/daily-performance

# Check trading activity summary
curl -s https://localhost/api/reports/trading-summary/today

# Verify backup completion
docker logs trading-bot-backup | tail -20
```

#### 2. System Maintenance (5 minutes)
```bash
# Clean up old logs (keep last 7 days)
docker exec -it trading-bot-backend npm run cleanup:logs

# Optimize database
docker exec -it trading-bot-postgres psql -U postgres -d trading_bot -c "VACUUM ANALYZE;"

# Clear Redis cache of expired data
docker exec -it trading-bot-redis redis-cli FLUSHEXPIRED
```

#### 3. Security Audit (3 minutes)
```bash
# Check for security events
curl -s https://localhost/api/security/audit/today

# Verify no unauthorized access attempts
docker logs trading-bot-nginx | grep -E "(401|403|429)" | tail -10

# Check API key usage
curl -s https://localhost/api/security/api-usage/summary
```

## Incident Response

### Alert Response Matrix

| Alert | Severity | Response Time | Escalation |
|-------|----------|---------------|------------|
| TradingBotDown | Critical | < 2 minutes | Immediate |
| DatabaseDown | Critical | < 2 minutes | Immediate |
| PaperTradingViolation | Critical | < 1 minute | Immediate |
| ExchangeConnectionLost | High | < 5 minutes | 15 minutes |
| HighMemoryUsage | Medium | < 15 minutes | 1 hour |
| SlowResponse | Low | < 30 minutes | 4 hours |

### Critical Alert: TradingBotDown

**Symptoms:**
- Health check endpoints returning 5xx errors
- Application containers not responding
- No trading activity for > 5 minutes

**Immediate Response (< 2 minutes):**
```bash
# 1. Check container status
docker-compose -f docker/docker-compose.prod.yml ps

# 2. Check recent logs
docker logs trading-bot-backend --tail=50

# 3. Check system resources
docker stats --no-stream

# 4. Attempt service restart
docker-compose -f docker/docker-compose.prod.yml restart backend
```

**Investigation Steps:**
```bash
# Check for resource exhaustion
free -h
df -h

# Check for port conflicts
netstat -tulpn | grep :3000

# Review error logs
docker logs trading-bot-backend --since=10m | grep -i error

# Check database connectivity
docker exec -it trading-bot-backend pg_isready -h postgres -p 5432
```

**Resolution Actions:**
```bash
# If container crashed - restart
docker-compose -f docker/docker-compose.prod.yml up -d backend

# If resource issue - scale up
docker-compose -f docker/docker-compose.prod.yml up -d --scale backend=2

# If database issue - restart database
docker-compose -f docker/docker-compose.prod.yml restart postgres

# Verify recovery
curl -f https://localhost/api/health
```

### Critical Alert: PaperTradingViolation

**Symptoms:**
- Real trading attempt detected
- Paper trading mode disabled
- Safety checks failing

**IMMEDIATE RESPONSE (< 1 minute):**
```bash
# 1. EMERGENCY STOP - Disable all trading
curl -X POST https://localhost/api/emergency/stop-all-trading

# 2. Verify paper trading mode
curl -s https://localhost/api/health/safety

# 3. Check for real trades
curl -s https://localhost/api/audit/real-trades/today

# 4. Isolate system if needed
docker-compose -f docker/docker-compose.prod.yml stop backend
```

**Investigation:**
```bash
# Check configuration
docker exec -it trading-bot-backend env | grep -E "(PAPER_TRADING|ALLOW_REAL)"

# Review recent code changes
git log --oneline -10

# Check database for real trade records
docker exec -it trading-bot-postgres psql -U postgres -d trading_bot -c "SELECT * FROM trade_executions WHERE is_paper_trade = false;"

# Review audit logs
docker exec -it trading-bot-postgres psql -U postgres -d trading_bot -c "SELECT * FROM audit_logs WHERE event_type = 'REAL_TRADE_ATTEMPT';"
```

**Resolution:**
```bash
# 1. Fix configuration
docker-compose -f docker/docker-compose.prod.yml down
# Update .env.production with correct values
docker-compose -f docker/docker-compose.prod.yml up -d

# 2. Verify safety mechanisms
curl -s https://localhost/api/health/safety | jq '.paperTradingMode'

# 3. Run safety validation
node scripts/paper-trading-safety-verification.js

# 4. Document incident
echo "$(date): Paper trading violation resolved" >> incidents.log
```

### High Alert: ExchangeConnectionLost

**Symptoms:**
- Exchange API calls failing
- Market data not updating
- WebSocket connections dropped

**Response Actions:**
```bash
# 1. Test external connectivity
curl -s "https://api.binance.com/api/v3/ping"
curl -s "https://api.kucoin.com/api/v1/timestamp"

# 2. Check API keys and rate limits
docker logs trading-bot-backend | grep -i "api.*key\|rate.*limit\|429"

# 3. Verify network connectivity
docker exec -it trading-bot-backend nslookup api.binance.com

# 4. Check WebSocket connections
curl -s https://localhost/api/health/websockets
```

**Resolution:**
```bash
# If rate limited - reduce frequency
curl -X POST https://localhost/api/config/rate-limit -d '{"delay": 2000}'

# If API key issue - rotate keys (if available)
# Update secrets and restart

# If network issue - check firewall/proxy
docker exec -it trading-bot-backend traceroute api.binance.com

# Enable simulation mode temporarily
curl -X POST https://localhost/api/config/simulation-mode -d '{"enabled": true}'
```

## Monitoring and Alerting

### Key Metrics to Monitor

#### System Metrics
- **CPU Usage:** < 80% average
- **Memory Usage:** < 85% of allocated
- **Disk Usage:** < 90% of available
- **Network I/O:** Monitor for anomalies

#### Application Metrics
- **Response Time:** < 200ms average
- **Error Rate:** < 1% of requests
- **Active Connections:** Monitor trends
- **Queue Depth:** < 100 pending items

#### Trading Metrics
- **Paper Trades:** All trades marked as simulated
- **Virtual Balance:** Tracking accuracy
- **Market Data Latency:** < 500ms
- **WebSocket Uptime:** > 99.9%

### Grafana Dashboard URLs

1. **System Overview:** https://localhost:3001/d/system-overview
2. **Trading Metrics:** https://localhost:3001/d/trading-metrics
3. **Paper Trading Safety:** https://localhost:3001/d/paper-trading-safety
4. **Performance Analytics:** https://localhost:3001/d/performance-analytics
5. **Real-time Data Feeds:** https://localhost:3001/d/real-time-data-feeds

### Alert Configuration

#### Critical Alerts (Immediate Response)
```yaml
# Paper Trading Violation
- alert: PaperTradingViolation
  expr: paper_trading_mode != 1
  for: 0s
  labels:
    severity: critical
  annotations:
    summary: "Paper trading mode disabled - CRITICAL SAFETY VIOLATION"

# Service Down
- alert: TradingBotDown
  expr: up{job="trading-bot"} == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Trading bot service is down"

# Database Down
- alert: DatabaseDown
  expr: up{job="postgres"} == 0
  for: 30s
  labels:
    severity: critical
  annotations:
    summary: "Database service is down"
```

#### Warning Alerts (Monitor Closely)
```yaml
# High Memory Usage
- alert: HighMemoryUsage
  expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.85
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High memory usage detected"

# Slow Response Time
- alert: SlowResponseTime
  expr: http_request_duration_seconds{quantile="0.95"} > 1
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "API response time is slow"
```

## Maintenance Procedures

### Weekly Maintenance (Sundays, 2:00 AM UTC)

#### 1. System Updates (30 minutes)
```bash
# 1. Create backup before maintenance
docker exec -it trading-bot-postgres pg_dump -U postgres trading_bot > backup_pre_maintenance_$(date +%Y%m%d).sql

# 2. Update system packages (if needed)
sudo apt update && sudo apt upgrade -y

# 3. Update Docker images
docker-compose -f docker/docker-compose.prod.yml pull

# 4. Restart services with new images
docker-compose -f docker/docker-compose.prod.yml up -d

# 5. Verify all services are healthy
./scripts/health-check.sh
```

#### 2. Database Maintenance (15 minutes)
```bash
# 1. Vacuum and analyze database
docker exec -it trading-bot-postgres psql -U postgres -d trading_bot -c "VACUUM ANALYZE;"

# 2. Reindex if needed
docker exec -it trading-bot-postgres psql -U postgres -d trading_bot -c "REINDEX DATABASE trading_bot;"

# 3. Update statistics
docker exec -it trading-bot-postgres psql -U postgres -d trading_bot -c "ANALYZE;"

# 4. Check database size and growth
docker exec -it trading-bot-postgres psql -U postgres -d trading_bot -c "SELECT pg_size_pretty(pg_database_size('trading_bot'));"
```

#### 3. Log Rotation and Cleanup (10 minutes)
```bash
# 1. Rotate application logs
docker exec -it trading-bot-backend npm run logs:rotate

# 2. Clean old Docker logs
docker system prune -f --volumes --filter "until=168h"

# 3. Archive old backup files
find ./backups -name "*.sql" -mtime +30 -exec gzip {} \;
find ./backups -name "*.sql.gz" -mtime +90 -delete

# 4. Clean Redis expired keys
docker exec -it trading-bot-redis redis-cli FLUSHEXPIRED
```

### Monthly Maintenance (First Sunday, 1:00 AM UTC)

#### 1. Security Updates (45 minutes)
```bash
# 1. Update SSL certificates (if needed)
./docker/scripts/ssl-renew.sh

# 2. Rotate API keys (if scheduled)
# Follow API key rotation procedure

# 3. Update security configurations
# Review and update security headers, firewall rules

# 4. Run security audit
node scripts/comprehensive-security-audit.js

# 5. Update dependencies
npm audit fix
docker build --no-cache -f docker/Dockerfile.backend .
```

#### 2. Performance Optimization (30 minutes)
```bash
# 1. Run performance benchmarks
node scripts/performance-benchmarking.js

# 2. Analyze slow queries
docker exec -it trading-bot-postgres psql -U postgres -d trading_bot -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# 3. Optimize database indexes
# Review and add indexes for slow queries

# 4. Update monitoring thresholds
# Adjust alert thresholds based on performance trends
```

## Emergency Procedures

### Complete System Shutdown

#### Planned Shutdown
```bash
# 1. Notify users (if applicable)
curl -X POST https://localhost/api/notifications/maintenance

# 2. Stop accepting new requests
curl -X POST https://localhost/api/maintenance/enable

# 3. Wait for current operations to complete
sleep 60

# 4. Graceful shutdown
docker-compose -f docker/docker-compose.prod.yml down

# 5. Create emergency backup
docker run --rm -v trading-bot_postgres_data:/data -v $(pwd)/backups:/backup alpine tar czf /backup/emergency_backup_$(date +%Y%m%d_%H%M%S).tar.gz /data
```

#### Emergency Shutdown
```bash
# 1. Immediate stop all services
docker-compose -f docker/docker-compose.prod.yml kill

# 2. Stop Docker daemon if needed
sudo systemctl stop docker

# 3. Document emergency reason
echo "$(date): Emergency shutdown - Reason: [REASON]" >> emergency.log
```

### Disaster Recovery

#### Data Recovery from Backup
```bash
# 1. Stop all services
docker-compose -f docker/docker-compose.prod.yml down

# 2. Restore database from backup
docker run --rm -v trading-bot_postgres_data:/data -v $(pwd)/backups:/backup alpine tar xzf /backup/emergency_backup_YYYYMMDD_HHMMSS.tar.gz -C /

# 3. Start database only
docker-compose -f docker/docker-compose.prod.yml up -d postgres

# 4. Verify data integrity
docker exec -it trading-bot-postgres psql -U postgres -d trading_bot -c "SELECT COUNT(*) FROM trade_executions;"

# 5. Start remaining services
docker-compose -f docker/docker-compose.prod.yml up -d
```

#### Complete System Recovery
```bash
# 1. Provision new infrastructure (if needed)
# Follow infrastructure setup procedures

# 2. Restore from backup
./scripts/restore-from-backup.sh /path/to/backup

# 3. Update DNS/load balancer (if needed)
# Point traffic to new infrastructure

# 4. Verify system functionality
./scripts/comprehensive-smoke-tests.js

# 5. Resume normal operations
curl -X POST https://localhost/api/maintenance/disable
```

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue: High CPU Usage
**Symptoms:** CPU usage > 90%, slow response times
**Investigation:**
```bash
# Check process usage
docker exec -it trading-bot-backend top

# Check for infinite loops
docker exec -it trading-bot-backend ps aux | grep node

# Review recent code changes
git log --oneline -5
```
**Solution:**
```bash
# Scale horizontally
docker-compose -f docker/docker-compose.prod.yml up -d --scale backend=2

# Restart service
docker-compose -f docker/docker-compose.prod.yml restart backend

# Optimize code if needed
```

#### Issue: Memory Leaks
**Symptoms:** Memory usage continuously increasing
**Investigation:**
```bash
# Monitor memory usage over time
docker stats trading-bot-backend

# Check for memory leaks in logs
docker logs trading-bot-backend | grep -i "memory\|heap"

# Generate heap dump
docker exec -it trading-bot-backend kill -USR2 $(pgrep node)
```
**Solution:**
```bash
# Restart service to clear memory
docker-compose -f docker/docker-compose.prod.yml restart backend

# Increase memory limits if needed
# Update docker-compose.yml with higher memory limits

# Fix memory leaks in code
```

#### Issue: Database Connection Errors
**Symptoms:** "Connection refused" or "Too many connections"
**Investigation:**
```bash
# Check database status
docker exec -it trading-bot-postgres pg_isready

# Check connection count
docker exec -it trading-bot-postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Check for long-running queries
docker exec -it trading-bot-postgres psql -U postgres -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';"
```
**Solution:**
```bash
# Kill long-running queries
docker exec -it trading-bot-postgres psql -U postgres -c "SELECT pg_terminate_backend(PID);"

# Restart database if needed
docker-compose -f docker/docker-compose.prod.yml restart postgres

# Increase connection limits if needed
```

### Performance Optimization

#### Database Optimization
```bash
# Add missing indexes
docker exec -it trading-bot-postgres psql -U postgres -d trading_bot -c "CREATE INDEX CONCURRENTLY idx_trades_timestamp ON trade_executions(executed_at);"

# Update table statistics
docker exec -it trading-bot-postgres psql -U postgres -d trading_bot -c "ANALYZE;"

# Optimize configuration
# Update postgresql.conf for better performance
```

#### Application Optimization
```bash
# Enable Node.js performance monitoring
docker exec -it trading-bot-backend node --prof app.js

# Optimize garbage collection
# Set NODE_OPTIONS="--max-old-space-size=2048"

# Enable clustering
# Update application to use cluster module
```

### Contact Information

**Primary On-Call:** [Your Team]  
**Secondary On-Call:** [Backup Team]  
**Escalation:** [Management Team]  

**Emergency Contacts:**
- System Administrator: [Contact Info]
- Database Administrator: [Contact Info]
- Security Team: [Contact Info]
- Management: [Contact Info]

---

**Document Version:** 1.0  
**Last Review:** 2025-08-29  
**Next Review:** 2025-09-29  
**Approved By:** [Approval Required]