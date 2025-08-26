# Monitoring and Health Check System

## Overview

The KIRO_BOT monitoring system provides comprehensive observability for the production paper trading platform. It includes Prometheus metrics collection, structured logging with Winston, health check endpoints, and system performance monitoring.

## Components

### 1. MonitoringService

The core monitoring service that collects and exposes metrics:

- **Prometheus Metrics**: HTTP requests, trading operations, system resources
- **Health Checks**: Database, Redis, exchanges, WebSocket, filesystem
- **Service Status Tracking**: Real-time monitoring of all system components
- **Event Emission**: Status changes and alerts

#### Key Metrics

- `kiro_bot_http_requests_total`: Total HTTP requests by method, route, status
- `kiro_bot_http_request_duration_seconds`: HTTP request latency histogram
- `kiro_bot_trades_executed_total`: Total trades executed (including paper trades)
- `kiro_bot_paper_trades_total`: Paper trading specific metrics
- `kiro_bot_system_memory_usage_bytes`: Memory usage by type
- `kiro_bot_system_cpu_usage_percent`: CPU usage percentage
- `kiro_bot_errors_total`: Error counts by service and severity
- `kiro_bot_security_events_total`: Security event tracking

### 2. SystemPerformanceMonitor

Advanced system performance monitoring with alerting:

- **Resource Monitoring**: Memory, CPU, load average, disk space
- **Event Loop Monitoring**: JavaScript event loop lag detection
- **Performance Alerts**: Configurable thresholds with cooldown periods
- **Historical Data**: Performance trend tracking

#### Alert Thresholds (Configurable)

- Memory Usage: 85% (default)
- CPU Usage: 80% (default)
- Load Average: 2x CPU cores (default)
- Event Loop Lag: 100ms (default)
- Disk Space: 1GB minimum (default)

### 3. Health Check Endpoints

Comprehensive health check endpoints for different use cases:

#### `/health` - Basic Health Check
Simple endpoint for load balancers and basic monitoring.

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### `/health/detailed` - Detailed Health Information
Comprehensive system health with metrics and paper trading status.

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "production",
  "paperTrading": {
    "enabled": true,
    "allowRealTrades": false,
    "safetyMode": true
  },
  "checks": {
    "database": true,
    "redis": true,
    "exchanges": true,
    "websocket": true,
    "filesystem": true,
    "memory": true,
    "cpu": true
  },
  "system": {
    "memory": { ... },
    "cpu": { ... },
    "platform": { ... }
  },
  "performance": {
    "latency": { ... },
    "throughput": { ... },
    "errorRate": { ... }
  }
}
```

#### `/health/ready` - Readiness Probe
Kubernetes readiness probe - checks if service can handle traffic.

#### `/health/live` - Liveness Probe
Kubernetes liveness probe - checks if service should be restarted.

#### `/health/startup` - Startup Probe
Kubernetes startup probe - checks if service has started successfully.

#### `/health/deep` - Deep Health Check
Comprehensive validation including filesystem, memory pressure, and event loop.

#### `/health/metrics` - Prometheus Metrics
Prometheus-formatted metrics endpoint.

#### `/health/services` - Service Status
Current status of all monitored services.

### 4. Structured Logging

Enhanced Winston logging with production-ready configuration:

#### Log Levels
- `error`: Error conditions
- `warn`: Warning conditions
- `info`: Informational messages
- `http`: HTTP request logging
- `debug`: Debug information
- `trace`: Detailed trace information

#### Log Formats

**Production Format** (JSON):
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Request completed",
  "service": "kiro-bot",
  "environment": "production",
  "hostname": "server-01",
  "pid": 1234,
  "requestId": "uuid-here",
  "userId": "user-123",
  "method": "GET",
  "url": "/api/trading",
  "statusCode": 200,
  "duration": 150
}
```

**Development Format** (Colored):
```
2024-01-15 10:30:00:000 info: Request completed [RequestId: uuid-here]
```

#### Log Files (Production)

- `logs/error-YYYY-MM-DD.log`: Error logs only
- `logs/warn-YYYY-MM-DD.log`: Warning logs
- `logs/combined-YYYY-MM-DD.log`: All logs
- `logs/security-YYYY-MM-DD.log`: Security events (90-day retention)
- `logs/trading-YYYY-MM-DD.log`: Trading activities (90-day retention)

#### Specialized Loggers

```typescript
import { 
  securityLogger, 
  tradingLogger, 
  performanceLogger, 
  auditLogger 
} from '../utils/logger';

// Security events
securityLogger.warn('Suspicious request detected', { ip, pattern });

// Trading activities
tradingLogger.info('Paper trade executed', { symbol, side, amount });

// Performance metrics
performanceLogger.info('High latency detected', { endpoint, duration });

// Audit events
auditLogger.info('User login', { userId, ip, timestamp });
```

### 5. Monitoring Middleware

Request tracking and monitoring middleware:

- **Request Tracking**: Unique request IDs and timing
- **Response Monitoring**: Metrics collection on response
- **Error Monitoring**: Error tracking and logging
- **Security Monitoring**: Suspicious pattern detection
- **Paper Trading Monitoring**: Trading operation tracking

## Configuration

### Environment Variables

```bash
# Monitoring Configuration
METRICS_ENABLED=true
HEALTH_CHECKS_ENABLED=true
PERFORMANCE_MONITORING=true
SYSTEM_METRICS_INTERVAL=30000
HEALTH_CHECK_INTERVAL=30000

# Alert Thresholds
MEMORY_ALERT_THRESHOLD=85
CPU_ALERT_THRESHOLD=80
DISK_ALERT_THRESHOLD=90
EVENT_LOOP_LAG_THRESHOLD=100

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=json

# Retention Settings
METRICS_HISTORY_RETENTION=100
ALERT_COOLDOWN_MS=300000
```

### Configuration Object

```typescript
monitoring: {
  prometheusPort: 9090,
  logLevel: 'info',
  metricsEnabled: true,
  healthChecksEnabled: true,
  performanceMonitoring: true,
  systemMetricsInterval: 30000,
  healthCheckInterval: 30000,
  alertThresholds: {
    memoryUsage: 85,
    cpuUsage: 80,
    diskUsage: 90,
    eventLoopLag: 100
  },
  retention: {
    metricsHistory: 100,
    alertCooldown: 300000
  }
}
```

## Usage Examples

### Recording Custom Metrics

```typescript
import { MonitoringService } from '../services/MonitoringService';

const monitoring = MonitoringService.getInstance();

// Record HTTP request
monitoring.recordHttpRequest('GET', '/api/trading', 200, 0.150);

// Record paper trade
monitoring.recordPaperTrade('BTC/USDT', 'BUY', 'binance');

// Record security event
monitoring.recordSecurityEvent('suspicious_request', 'medium', '192.168.1.1');

// Update virtual balance
monitoring.updateVirtualBalance('user-123', 10000);
```

### Performance Monitoring

```typescript
import { SystemPerformanceMonitor } from '../services/SystemPerformanceMonitor';

const performance = SystemPerformanceMonitor.getInstance();

// Get current metrics
const metrics = performance.getCurrentMetrics();

// Update thresholds
performance.updateThresholds({
  maxMemoryUsage: 90,
  maxCpuUsage: 85
});

// Listen for alerts
performance.on('performance_alert', (alert) => {
  console.log('Performance alert:', alert);
});
```

### Health Checks

```typescript
import { MonitoringService } from '../services/MonitoringService';

const monitoring = MonitoringService.getInstance();

// Get system health
const health = monitoring.getSystemHealth();

// Get service statuses
const services = monitoring.getServiceStatuses();

// Listen for status changes
monitoring.on('service_status_change', (event) => {
  console.log('Service status changed:', event);
});
```

## Integration with External Systems

### Prometheus Integration

The system exposes metrics at `/health/metrics` in Prometheus format:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'kiro-bot'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/health/metrics'
    scrape_interval: 30s
```

### Grafana Dashboards

Key metrics to monitor in Grafana:

1. **System Health Dashboard**
   - Memory usage trends
   - CPU usage trends
   - Load average
   - Disk space
   - Event loop lag

2. **Application Performance Dashboard**
   - HTTP request rates
   - Response time percentiles
   - Error rates
   - Active connections

3. **Trading Activity Dashboard**
   - Paper trades executed
   - Virtual portfolio values
   - Trading signals generated
   - Exchange connection status

4. **Security Dashboard**
   - Security events
   - Failed authentication attempts
   - Suspicious requests
   - Rate limiting violations

### Kubernetes Integration

Health check endpoints are designed for Kubernetes probes:

```yaml
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: kiro-bot
    livenessProbe:
      httpGet:
        path: /health/live
        port: 3000
      initialDelaySeconds: 30
      periodSeconds: 10
    readinessProbe:
      httpGet:
        path: /health/ready
        port: 3000
      initialDelaySeconds: 5
      periodSeconds: 5
    startupProbe:
      httpGet:
        path: /health/startup
        port: 3000
      initialDelaySeconds: 10
      periodSeconds: 10
      failureThreshold: 30
```

## Alerting

### Alert Types

1. **Performance Alerts**
   - High memory usage
   - High CPU usage
   - High load average
   - Event loop lag
   - Low disk space

2. **Security Alerts**
   - Suspicious requests
   - Authentication failures
   - API abuse
   - Critical security events

3. **Service Alerts**
   - Service down
   - Service degraded
   - Connection failures
   - Health check failures

### Alert Handling

```typescript
// Listen for performance alerts
performanceMonitor.on('performance_alert', (alert) => {
  if (alert.severity === 'critical') {
    // Send immediate notification
    notificationService.sendCriticalAlert(alert);
  }
});

// Listen for security alerts
monitoring.on('security_alert', (alert) => {
  // Log security event
  securityLogger.warn('Security alert', alert);
  
  // Send notification if high severity
  if (alert.severity === 'high' || alert.severity === 'critical') {
    notificationService.sendSecurityAlert(alert);
  }
});
```

## Best Practices

1. **Metric Naming**: Use consistent naming with `kiro_bot_` prefix
2. **Label Usage**: Use labels for dimensions, avoid high cardinality
3. **Alert Thresholds**: Set appropriate thresholds based on baseline performance
4. **Log Levels**: Use appropriate log levels to avoid noise
5. **Retention**: Configure appropriate retention for different log types
6. **Performance**: Monitor the monitoring system itself for overhead
7. **Security**: Protect metrics endpoints in production
8. **Documentation**: Keep monitoring documentation up to date

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check for memory leaks in application code
   - Review metrics retention settings
   - Monitor garbage collection

2. **High CPU Usage**
   - Check for inefficient algorithms
   - Review monitoring intervals
   - Monitor event loop lag

3. **Missing Metrics**
   - Verify metrics are being recorded
   - Check Prometheus scraping configuration
   - Review metric registration

4. **Health Check Failures**
   - Check service dependencies
   - Review network connectivity
   - Verify configuration

### Debugging

```typescript
// Enable debug logging
process.env.LOG_LEVEL = 'debug';

// Check monitoring service status
const monitoring = MonitoringService.getInstance();
console.log('Service statuses:', monitoring.getServiceStatuses());

// Check performance metrics
const performance = SystemPerformanceMonitor.getInstance();
console.log('Current metrics:', performance.getCurrentMetrics());
```

This monitoring system provides comprehensive observability for the KIRO_BOT production paper trading platform, ensuring reliable operation and early detection of issues.