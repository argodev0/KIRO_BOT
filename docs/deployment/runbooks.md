# Operational Runbooks

This document contains detailed runbooks for common operational scenarios and incident response procedures.

## Table of Contents

1. [Alert Response Procedures](#alert-response-procedures)
2. [Service Recovery Procedures](#service-recovery-procedures)
3. [Performance Troubleshooting](#performance-troubleshooting)
4. [Security Incident Response](#security-incident-response)
5. [Backup and Recovery Procedures](#backup-and-recovery-procedures)
6. [Maintenance Procedures](#maintenance-procedures)
7. [Emergency Procedures](#emergency-procedures)

## Alert Response Procedures

### TradingBotDown

**Severity**: Critical  
**Response Time**: Immediate (< 2 minutes)

#### Symptoms
- Trading bot backend service is not responding
- Health check endpoints returning errors
- No trading activity for extended period

#### Investigation Steps
1. **Check Pod Status**
   ```bash
   kubectl get pods -n trading-bot -l app=backend
   kubectl describe pod <backend-pod> -n trading-bot
   ```

2. **Review Recent Logs**
   ```bash
   kubectl logs deployment/backend -n trading-bot --tail=100
   kubectl logs deployment/backend -n trading-bot --previous
   ```

3. **Check Resource Usage**
   ```bash
   kubectl top pods -n trading-bot
   kubectl describe node <node-name>
   ```

4. **Verify Dependencies**
   ```bash
   kubectl get pods -n trading-bot -l app=postgres
   kubectl get pods -n trading-bot -l app=redis
   kubectl get pods -n trading-bot -l app=rabbitmq
   ```

#### Resolution Steps
1. **If Pod is CrashLooping**:
   ```bash
   # Check for resource constraints
   kubectl describe pod <backend-pod> -n trading-bot
   
   # Increase resources if needed
   kubectl patch deployment backend -n trading-bot -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","resources":{"limits":{"memory":"4Gi","cpu":"2"}}}]}}}}'
   ```

2. **If Pod is Pending**:
   ```bash
   # Check node resources
   kubectl describe nodes
   
   # Scale down other services if needed
   kubectl scale deployment frontend --replicas=1 -n trading-bot
   ```

3. **If Application Error**:
   ```bash
   # Restart deployment
   kubectl rollout restart deployment/backend -n trading-bot
   
   # Monitor rollout
   kubectl rollout status deployment/backend -n trading-bot
   ```

4. **If Database Connection Issues**:
   ```bash
   # Check database connectivity
   kubectl exec -it deployment/backend -n trading-bot -- pg_isready -h postgres-service -p 5432
   
   # Restart database if needed
   kubectl delete pod -l app=postgres -n trading-bot
   ```

#### Escalation
- If service is not restored within 10 minutes, escalate to senior engineer
- If data corruption is suspected, escalate to database administrator
- If security breach is suspected, escalate to security team

### DatabaseDown

**Severity**: Critical  
**Response Time**: Immediate (< 2 minutes)

#### Symptoms
- Database connection failures
- Backend services unable to start
- Data persistence issues

#### Investigation Steps
1. **Check Database Pod Status**
   ```bash
   kubectl get pods -n trading-bot -l app=postgres
   kubectl describe pod <postgres-pod> -n trading-bot
   ```

2. **Check Database Logs**
   ```bash
   kubectl logs <postgres-pod> -n trading-bot --tail=100
   ```

3. **Check Storage**
   ```bash
   kubectl get pvc -n trading-bot
   kubectl describe pvc postgres-pvc -n trading-bot
   ```

4. **Check Node Resources**
   ```bash
   kubectl describe node <node-name>
   df -h  # On the node where postgres is running
   ```

#### Resolution Steps
1. **If Pod is Not Running**:
   ```bash
   # Check for resource issues
   kubectl describe pod <postgres-pod> -n trading-bot
   
   # Delete pod to trigger restart
   kubectl delete pod <postgres-pod> -n trading-bot
   ```

2. **If Storage Issues**:
   ```bash
   # Check PVC status
   kubectl get pvc -n trading-bot
   
   # If PVC is pending, check storage class
   kubectl get storageclass
   ```

3. **If Corruption Suspected**:
   ```bash
   # Stop all applications
   kubectl scale deployment backend --replicas=0 -n trading-bot
   
   # Run database recovery
   kubectl exec -it <postgres-pod> -n trading-bot -- pg_resetwal /var/lib/postgresql/data
   ```

4. **If Complete Failure**:
   ```bash
   # Restore from backup
   kubectl create job --from=cronjob/postgres-backup restore-$(date +%s) -n trading-bot
   
   # Follow backup restoration procedure
   ```

#### Escalation
- If database cannot be restored within 15 minutes, escalate to DBA
- If data loss is confirmed, escalate to management
- Consider activating disaster recovery procedures

### ExchangeConnectionLost

**Severity**: Critical  
**Response Time**: < 5 minutes

#### Symptoms
- Exchange API calls failing
- No market data updates
- Order execution failures

#### Investigation Steps
1. **Check Exchange Status**
   ```bash
   # Test external connectivity
   kubectl exec -it deployment/backend -n trading-bot -- curl -s "https://api.binance.com/api/v3/ping"
   kubectl exec -it deployment/backend -n trading-bot -- curl -s "https://api.kucoin.com/api/v1/timestamp"
   ```

2. **Check API Keys**
   ```bash
   # Verify secrets exist
   kubectl get secret exchange-api-secrets -n trading-bot -o yaml
   
   # Check for API key expiration in logs
   kubectl logs deployment/backend -n trading-bot | grep -i "api.*key\|unauthorized\|forbidden"
   ```

3. **Check Rate Limiting**
   ```bash
   # Look for rate limit errors
   kubectl logs deployment/backend -n trading-bot | grep -i "rate.*limit\|429\|too.*many"
   ```

4. **Check Network Connectivity**
   ```bash
   # Test DNS resolution
   kubectl exec -it deployment/backend -n trading-bot -- nslookup api.binance.com
   
   # Check network policies
   kubectl get networkpolicy -n trading-bot
   ```

#### Resolution Steps
1. **If API Key Issues**:
   ```bash
   # Update API keys
   kubectl create secret generic exchange-api-secrets \
     --from-literal=BINANCE_API_KEY=new-key \
     --from-literal=BINANCE_API_SECRET=new-secret \
     --dry-run=client -o yaml | kubectl apply -f -
   
   # Restart backend to pick up new keys
   kubectl rollout restart deployment/backend -n trading-bot
   ```

2. **If Rate Limiting**:
   ```bash
   # Reduce API call frequency (temporary)
   kubectl set env deployment/backend API_RATE_LIMIT_DELAY=1000 -n trading-bot
   
   # Scale down to reduce load
   kubectl scale deployment backend --replicas=1 -n trading-bot
   ```

3. **If Network Issues**:
   ```bash
   # Check and update network policies
   kubectl apply -f k8s/network-policies.yaml
   
   # Restart networking components if needed
   kubectl delete pod -l app=backend -n trading-bot
   ```

4. **If Exchange Maintenance**:
   ```bash
   # Enable simulation mode temporarily
   kubectl set env deployment/backend SIMULATE_TRADING=true -n trading-bot
   
   # Monitor exchange status pages
   # Resume normal operation when exchange is available
   ```

#### Escalation
- If connection cannot be restored within 15 minutes, escalate to network team
- If multiple exchanges are affected, escalate to management
- Consider switching to backup exchanges if available

### HighRiskExposure

**Severity**: Critical  
**Response Time**: Immediate (< 1 minute)

#### Symptoms
- Portfolio risk exposure above 80% of limits
- Large position sizes relative to account balance
- Rapid increase in open positions

#### Investigation Steps
1. **Check Current Positions**
   ```bash
   # Query current positions from database
   kubectl exec -it <postgres-pod> -n trading-bot -- psql -U postgres -d trading_bot -c "SELECT symbol, side, size, entry_price, unrealized_pnl FROM positions WHERE status = 'open';"
   ```

2. **Check Risk Metrics**
   ```bash
   # Check risk exposure metrics
   kubectl logs deployment/backend -n trading-bot | grep -i "risk\|exposure\|position.*size"
   ```

3. **Review Recent Trades**
   ```bash
   # Check recent trade executions
   kubectl exec -it <postgres-pod> -n trading-bot -- psql -U postgres -d trading_bot -c "SELECT * FROM trade_executions WHERE executed_at > NOW() - INTERVAL '1 hour' ORDER BY executed_at DESC;"
   ```

#### Resolution Steps
1. **Immediate Risk Reduction**:
   ```bash
   # Enable emergency risk mode
   kubectl set env deployment/backend EMERGENCY_RISK_MODE=true -n trading-bot
   
   # Reduce position sizes
   kubectl set env deployment/backend MAX_POSITION_SIZE_PERCENT=1 -n trading-bot
   ```

2. **Close High-Risk Positions**:
   ```bash
   # Trigger position closure via API
   kubectl exec -it deployment/backend -n trading-bot -- curl -X POST http://localhost:3000/api/risk/emergency-close \
     -H "Content-Type: application/json" \
     -d '{"reason": "high_risk_exposure"}'
   ```

3. **Halt New Trading**:
   ```bash
   # Disable new position opening
   kubectl set env deployment/backend ALLOW_NEW_POSITIONS=false -n trading-bot
   
   # Stop signal generation temporarily
   kubectl set env deployment/backend SIGNAL_GENERATION_ENABLED=false -n trading-bot
   ```

4. **Monitor and Adjust**:
   ```bash
   # Monitor position closure
   kubectl logs deployment/backend -n trading-bot -f | grep -i "position.*closed\|risk.*reduced"
   
   # Gradually re-enable trading with lower limits
   kubectl set env deployment/backend MAX_POSITION_SIZE_PERCENT=2 -n trading-bot
   ```

#### Escalation
- Immediately notify risk management team
- If positions cannot be closed within 5 minutes, escalate to senior trader
- Document incident for risk policy review

## Service Recovery Procedures

### Backend Service Recovery

#### Complete Service Restart
```bash
# 1. Scale down to zero
kubectl scale deployment backend --replicas=0 -n trading-bot

# 2. Wait for pods to terminate
kubectl wait --for=delete pod -l app=backend -n trading-bot --timeout=60s

# 3. Scale back up
kubectl scale deployment backend --replicas=3 -n trading-bot

# 4. Monitor startup
kubectl rollout status deployment/backend -n trading-bot
kubectl logs deployment/backend -n trading-bot -f
```

#### Rolling Update Recovery
```bash
# 1. Check rollout history
kubectl rollout history deployment/backend -n trading-bot

# 2. Rollback to previous version if needed
kubectl rollout undo deployment/backend -n trading-bot

# 3. Monitor rollback
kubectl rollout status deployment/backend -n trading-bot

# 4. Verify functionality
kubectl exec -it deployment/backend -n trading-bot -- curl -f http://localhost:8080/health
```

### Database Recovery

#### Minor Issues Recovery
```bash
# 1. Restart database pod
kubectl delete pod -l app=postgres -n trading-bot

# 2. Wait for pod to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n trading-bot --timeout=300s

# 3. Verify connectivity
kubectl exec -it deployment/backend -n trading-bot -- pg_isready -h postgres-service -p 5432

# 4. Check database integrity
kubectl exec -it <postgres-pod> -n trading-bot -- psql -U postgres -d trading_bot -c "SELECT pg_database_size('trading_bot');"
```

#### Major Issues Recovery
```bash
# 1. Stop all applications
kubectl scale deployment backend --replicas=0 -n trading-bot
kubectl scale deployment frontend --replicas=0 -n trading-bot

# 2. Create emergency backup
kubectl create job --from=cronjob/postgres-backup emergency-backup-$(date +%s) -n trading-bot

# 3. Restore from backup
kubectl exec -it backup-pod -n trading-bot -- /app/scripts/restore.sh --file /backups/latest-backup.sql.gz

# 4. Verify restoration
kubectl exec -it <postgres-pod> -n trading-bot -- psql -U postgres -d trading_bot -c "\dt"

# 5. Restart applications
kubectl scale deployment backend --replicas=3 -n trading-bot
kubectl scale deployment frontend --replicas=2 -n trading-bot
```

## Performance Troubleshooting

### High CPU Usage

#### Investigation
```bash
# 1. Identify high CPU pods
kubectl top pods -n trading-bot --sort-by=cpu

# 2. Check CPU metrics over time
kubectl exec -it <prometheus-pod> -n trading-bot -- promtool query instant 'rate(container_cpu_usage_seconds_total{namespace="trading-bot"}[5m])'

# 3. Analyze application performance
kubectl exec -it deployment/backend -n trading-bot -- node --prof-process --preprocess -j isolate-*.log > profile.json
```

#### Resolution
```bash
# 1. Scale horizontally
kubectl scale deployment backend --replicas=5 -n trading-bot

# 2. Increase CPU limits
kubectl patch deployment backend -n trading-bot -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","resources":{"limits":{"cpu":"2"}}}]}}}}'

# 3. Enable CPU throttling protection
kubectl set env deployment/backend NODE_OPTIONS="--max-old-space-size=2048" -n trading-bot

# 4. Optimize application (if needed)
kubectl set env deployment/backend ENABLE_PROFILING=true -n trading-bot
```

### High Memory Usage

#### Investigation
```bash
# 1. Check memory usage
kubectl top pods -n trading-bot --sort-by=memory

# 2. Analyze memory leaks
kubectl exec -it deployment/backend -n trading-bot -- node --inspect=0.0.0.0:9229 dist/index.js &
# Connect with Chrome DevTools for heap analysis

# 3. Check for memory pressure
kubectl describe node <node-name> | grep -A 5 "Conditions"
```

#### Resolution
```bash
# 1. Increase memory limits
kubectl patch deployment backend -n trading-bot -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","resources":{"limits":{"memory":"4Gi"}}}]}}}}'

# 2. Enable garbage collection optimization
kubectl set env deployment/backend NODE_OPTIONS="--max-old-space-size=3072 --optimize-for-size" -n trading-bot

# 3. Restart pods to clear memory
kubectl rollout restart deployment/backend -n trading-bot

# 4. Scale horizontally to distribute load
kubectl scale deployment backend --replicas=4 -n trading-bot
```

### Slow Database Queries

#### Investigation
```bash
# 1. Check slow query log
kubectl exec -it <postgres-pod> -n trading-bot -- psql -U postgres -d trading_bot -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# 2. Check active queries
kubectl exec -it <postgres-pod> -n trading-bot -- psql -U postgres -d trading_bot -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';"

# 3. Check database locks
kubectl exec -it <postgres-pod> -n trading-bot -- psql -U postgres -d trading_bot -c "SELECT * FROM pg_locks WHERE NOT granted;"
```

#### Resolution
```bash
# 1. Kill long-running queries
kubectl exec -it <postgres-pod> -n trading-bot -- psql -U postgres -d trading_bot -c "SELECT pg_terminate_backend(<pid>);"

# 2. Add missing indexes
kubectl exec -it <postgres-pod> -n trading-bot -- psql -U postgres -d trading_bot -c "CREATE INDEX CONCURRENTLY idx_trades_timestamp ON trade_executions(executed_at);"

# 3. Update table statistics
kubectl exec -it <postgres-pod> -n trading-bot -- psql -U postgres -d trading_bot -c "ANALYZE;"

# 4. Increase database resources
kubectl patch statefulset postgres -n trading-bot -p '{"spec":{"template":{"spec":{"containers":[{"name":"postgres","resources":{"limits":{"memory":"2Gi","cpu":"1"}}}]}}}}'
```

## Security Incident Response

### Suspected Breach

#### Immediate Actions (< 5 minutes)
```bash
# 1. Isolate affected systems
kubectl patch deployment backend -n trading-bot -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","env":[{"name":"EMERGENCY_MODE","value":"true"}]}]}}}}'

# 2. Stop all trading activities
kubectl set env deployment/backend TRADING_ENABLED=false -n trading-bot

# 3. Capture evidence
kubectl logs deployment/backend -n trading-bot > incident-logs-$(date +%s).log
kubectl get events -n trading-bot > incident-events-$(date +%s).log

# 4. Notify security team
# Send alert to security team with incident details
```

#### Investigation (< 30 minutes)
```bash
# 1. Check for unauthorized access
kubectl exec -it <postgres-pod> -n trading-bot -- psql -U postgres -d trading_bot -c "SELECT * FROM audit_logs WHERE created_at > NOW() - INTERVAL '24 hours' ORDER BY created_at DESC;"

# 2. Review API access logs
kubectl logs deployment/backend -n trading-bot | grep -E "(401|403|suspicious|unauthorized)" > security-analysis.log

# 3. Check for data exfiltration
kubectl exec -it <postgres-pod> -n trading-bot -- psql -U postgres -d trading_bot -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM trade_executions;"

# 4. Analyze network traffic
kubectl exec -it deployment/backend -n trading-bot -- netstat -an | grep ESTABLISHED
```

#### Containment (< 1 hour)
```bash
# 1. Rotate all secrets
kubectl delete secret trading-bot-secrets exchange-api-secrets -n trading-bot
# Recreate with new values

# 2. Update API keys
# Generate new exchange API keys
# Update secrets with new keys

# 3. Force password reset for all users
kubectl exec -it <postgres-pod> -n trading-bot -- psql -U postgres -d trading_bot -c "UPDATE users SET password_reset_required = true;"

# 4. Enable additional security measures
kubectl set env deployment/backend MFA_REQUIRED=true -n trading-bot
kubectl set env deployment/backend SESSION_TIMEOUT=300 -n trading-bot
```

### API Key Compromise

#### Immediate Response
```bash
# 1. Disable compromised keys immediately
kubectl set env deployment/backend BINANCE_API_ENABLED=false -n trading-bot
kubectl set env deployment/backend KUCOIN_API_ENABLED=false -n trading-bot

# 2. Check recent API usage
# Review exchange account activity for unauthorized trades

# 3. Generate new API keys
# Create new keys on exchange platforms with restricted permissions

# 4. Update secrets
kubectl create secret generic exchange-api-secrets \
  --from-literal=BINANCE_API_KEY=new-key \
  --from-literal=BINANCE_API_SECRET=new-secret \
  --dry-run=client -o yaml | kubectl apply -f -
```

#### Recovery
```bash
# 1. Verify new keys work
kubectl exec -it deployment/backend -n trading-bot -- curl -H "X-MBX-APIKEY: new-key" "https://api.binance.com/api/v3/account"

# 2. Re-enable trading gradually
kubectl set env deployment/backend BINANCE_API_ENABLED=true -n trading-bot
kubectl set env deployment/backend MAX_POSITION_SIZE_PERCENT=1 -n trading-bot

# 3. Monitor for suspicious activity
kubectl logs deployment/backend -n trading-bot -f | grep -i "api\|trade\|order"

# 4. Document incident
# Create incident report with timeline and lessons learned
```

## Backup and Recovery Procedures

### Emergency Backup Creation

```bash
# 1. Create immediate backup
kubectl create job --from=cronjob/postgres-backup emergency-backup-$(date +%s) -n trading-bot

# 2. Wait for completion
kubectl wait --for=condition=complete job/emergency-backup-<timestamp> -n trading-bot --timeout=600s

# 3. Verify backup
kubectl logs job/emergency-backup-<timestamp> -n trading-bot

# 4. Download backup locally (if needed)
kubectl cp trading-bot/backup-pod:/backups/emergency-backup-<timestamp>.sql.gz ./emergency-backup.sql.gz
```

### Point-in-Time Recovery

```bash
# 1. Stop all applications
kubectl scale deployment backend --replicas=0 -n trading-bot
kubectl scale deployment frontend --replicas=0 -n trading-bot

# 2. Create current state backup
kubectl create job --from=cronjob/postgres-backup pre-recovery-backup-$(date +%s) -n trading-bot

# 3. Restore to specific point in time
kubectl exec -it backup-pod -n trading-bot -- /app/scripts/restore.sh --file /backups/backup-<timestamp>.sql.gz

# 4. Verify data integrity
kubectl exec -it <postgres-pod> -n trading-bot -- psql -U postgres -d trading_bot -c "SELECT COUNT(*) FROM trade_executions WHERE executed_at < '<target-time>';"

# 5. Restart applications
kubectl scale deployment backend --replicas=3 -n trading-bot
kubectl scale deployment frontend --replicas=2 -n trading-bot
```

### Disaster Recovery

#### Complete System Recovery
```bash
# 1. Provision new cluster (if needed)
# Follow cluster setup procedures

# 2. Restore from backup
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml  # Use backup secrets
kubectl apply -f k8s/postgres.yaml

# 3. Wait for database to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n trading-bot --timeout=600s

# 4. Restore database
kubectl exec -it backup-pod -n trading-bot -- /app/scripts/restore.sh --s3-key backups/latest-backup.sql.gz

# 5. Deploy applications
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/monitoring.yaml

# 6. Verify system functionality
kubectl exec -it deployment/backend -n trading-bot -- curl -f http://localhost:8080/health
```

## Maintenance Procedures

### Planned Maintenance Window

#### Pre-Maintenance (T-24 hours)
```bash
# 1. Notify users
kubectl set env deployment/backend MAINTENANCE_NOTICE="Scheduled maintenance in 24 hours" -n trading-bot

# 2. Create backup
kubectl create job --from=cronjob/postgres-backup pre-maintenance-backup-$(date +%s) -n trading-bot

# 3. Prepare rollback plan
kubectl get deployment backend -n trading-bot -o yaml > backend-rollback.yaml

# 4. Test procedures in staging
# Run maintenance procedures in staging environment first
```

#### During Maintenance
```bash
# 1. Enable maintenance mode
kubectl set env deployment/backend MAINTENANCE_MODE=true -n trading-bot
kubectl set env deployment/frontend MAINTENANCE_MODE=true -n trading-bot

# 2. Scale down non-essential services
kubectl scale deployment frontend --replicas=1 -n trading-bot

# 3. Perform updates
kubectl set image deployment/backend backend=trading-bot/backend:v1.1.0 -n trading-bot
kubectl rollout status deployment/backend -n trading-bot

# 4. Run database migrations (if needed)
kubectl exec -it deployment/backend -n trading-bot -- npm run migrate

# 5. Verify functionality
kubectl exec -it deployment/backend -n trading-bot -- npm run test:smoke
```

#### Post-Maintenance
```bash
# 1. Disable maintenance mode
kubectl set env deployment/backend MAINTENANCE_MODE=false -n trading-bot
kubectl set env deployment/frontend MAINTENANCE_MODE=false -n trading-bot

# 2. Scale services back up
kubectl scale deployment frontend --replicas=2 -n trading-bot

# 3. Monitor system health
kubectl get pods -n trading-bot
kubectl logs deployment/backend -n trading-bot -f

# 4. Verify trading functionality
# Test order placement and execution
# Verify market data feeds
# Check risk management systems

# 5. Document maintenance
# Update maintenance log with changes made
```

### Security Updates

#### Critical Security Patch
```bash
# 1. Assess urgency and impact
# Review security advisory details
# Determine if immediate patching is required

# 2. Prepare updated images
docker build -f docker/Dockerfile.backend -t trading-bot/backend:security-patch .
docker push trading-bot/backend:security-patch

# 3. Deploy to staging first
kubectl set image deployment/backend backend=trading-bot/backend:security-patch -n trading-bot-staging
# Run security tests

# 4. Deploy to production
kubectl set image deployment/backend backend=trading-bot/backend:security-patch -n trading-bot
kubectl rollout status deployment/backend -n trading-bot

# 5. Verify security fix
# Run security scans
# Test affected functionality
# Monitor for issues
```

## Emergency Procedures

### Complete System Shutdown

#### Immediate Shutdown
```bash
# 1. Stop all trading immediately
kubectl set env deployment/backend EMERGENCY_SHUTDOWN=true -n trading-bot

# 2. Close all open positions (if safe to do so)
kubectl exec -it deployment/backend -n trading-bot -- curl -X POST http://localhost:3000/api/emergency/close-all-positions

# 3. Scale down all services
kubectl scale deployment backend --replicas=0 -n trading-bot
kubectl scale deployment frontend --replicas=0 -n trading-bot

# 4. Create emergency backup
kubectl create job --from=cronjob/postgres-backup emergency-shutdown-backup-$(date +%s) -n trading-bot

# 5. Notify stakeholders
# Send emergency notification to all stakeholders
```

#### Controlled Shutdown
```bash
# 1. Enable graceful shutdown mode
kubectl set env deployment/backend GRACEFUL_SHUTDOWN=true -n trading-bot

# 2. Wait for current operations to complete
kubectl logs deployment/backend -n trading-bot -f | grep -i "shutdown\|complete"

# 3. Stop accepting new requests
kubectl patch service backend-service -n trading-bot -p '{"spec":{"selector":{"app":"maintenance"}}}'

# 4. Scale down gradually
kubectl scale deployment backend --replicas=1 -n trading-bot
sleep 60
kubectl scale deployment backend --replicas=0 -n trading-bot

# 5. Shutdown supporting services
kubectl scale deployment frontend --replicas=0 -n trading-bot
```

### Data Loss Recovery

#### Immediate Response
```bash
# 1. Stop all write operations
kubectl scale deployment backend --replicas=0 -n trading-bot

# 2. Assess data loss scope
kubectl exec -it <postgres-pod> -n trading-bot -- psql -U postgres -d trading_bot -c "SELECT COUNT(*) FROM trade_executions WHERE executed_at > '<last-known-good-time>';"

# 3. Identify last good backup
kubectl exec -it backup-pod -n trading-bot -- /app/scripts/restore.sh --list

# 4. Calculate recovery point
# Determine acceptable data loss vs. recovery time
```

#### Recovery Process
```bash
# 1. Restore from backup
kubectl exec -it backup-pod -n trading-bot -- /app/scripts/restore.sh --file /backups/backup-<timestamp>.sql.gz

# 2. Replay transactions (if possible)
# Use transaction logs or external records to replay lost transactions

# 3. Verify data integrity
kubectl exec -it <postgres-pod> -n trading-bot -- psql -U postgres -d trading_bot -c "SELECT * FROM data_integrity_check();"

# 4. Reconcile with external systems
# Compare with exchange records
# Verify account balances
# Check position accuracy

# 5. Restart services gradually
kubectl scale deployment backend --replicas=1 -n trading-bot
# Monitor for issues before scaling up
```

### Network Partition Recovery

#### Detection and Assessment
```bash
# 1. Check cluster connectivity
kubectl get nodes
kubectl get pods -n trading-bot -o wide

# 2. Identify partitioned nodes
kubectl describe nodes | grep -A 5 "Conditions"

# 3. Check service availability
kubectl get endpoints -n trading-bot
```

#### Recovery Actions
```bash
# 1. Drain affected nodes
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data

# 2. Reschedule pods to healthy nodes
kubectl get pods -n trading-bot -o wide | grep <affected-node>
kubectl delete pod <pod-name> -n trading-bot

# 3. Verify service restoration
kubectl get pods -n trading-bot
kubectl exec -it deployment/backend -n trading-bot -- curl -f http://localhost:8080/health

# 4. Monitor for split-brain scenarios
# Check for duplicate services or data inconsistencies
```

This runbook provides detailed procedures for handling various operational scenarios. Always follow the principle of "stop, assess, act" and escalate when in doubt. Regular drills and updates to these procedures are essential for maintaining operational readiness.