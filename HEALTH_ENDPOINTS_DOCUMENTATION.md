# Health Check and Status Endpoints Documentation

## Overview
This document provides comprehensive documentation for all health check and status endpoints implemented in the AI Crypto Trading Bot system.

## Base URLs
- Development: `http://localhost:3000`
- Production: `https://your-domain.com`

## Health Check Endpoints (`/api/v1/health`)

### Basic Health Check
**GET** `/api/v1/health`

Simple health check endpoint optimized for load balancers and basic monitoring.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-27T10:30:00.000Z"
}
```

**Status Codes:**
- `200` - Service is healthy
- `503` - Service is unhealthy

---

### Detailed Health Check
**GET** `/api/v1/health/detailed`

Comprehensive health check with detailed system information and metrics.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-27T10:30:00.000Z",
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
    "websocket": true
  },
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 15,
      "lastCheck": "2025-01-27T10:30:00.000Z"
    }
  },
  "system": {
    "memory": {
      "used": 134217728,
      "total": 268435456,
      "usage": "50.0%"
    },
    "cpu": {
      "usage": 25.5,
      "loadAverage": [0.5, 0.3, 0.2],
      "cores": 4
    }
  },
  "responseTime": 45
}
```

---

### Kubernetes Probes

#### Readiness Probe
**GET** `/api/v1/health/ready`

Determines if the application is ready to serve traffic.

**Response:**
```json
{
  "status": "ready",
  "timestamp": "2025-01-27T10:30:00.000Z",
  "criticalServices": {
    "database": true,
    "redis": true
  }
}
```

#### Liveness Probe
**GET** `/api/v1/health/live`

Determines if the application is alive and should not be restarted.

**Response:**
```json
{
  "status": "alive",
  "timestamp": "2025-01-27T10:30:00.000Z",
  "uptime": 3600,
  "memoryUsage": {
    "used": 134217728,
    "total": 268435456,
    "percentage": "50.0%"
  }
}
```

#### Startup Probe
**GET** `/api/v1/health/startup`

Determines if the application has started successfully.

**Response:**
```json
{
  "status": "started",
  "timestamp": "2025-01-27T10:30:00.000Z",
  "uptime": 3600,
  "startTime": "2025-01-27T09:30:00.000Z"
}
```

---

### System Health Endpoints

#### System Health
**GET** `/api/v1/health/system`

Comprehensive system health report including all services and metrics.

**Response:**
```json
{
  "overall": "healthy",
  "timestamp": "2025-01-27T10:30:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "production",
  "services": {
    "database": {
      "status": "healthy",
      "message": "Database connection is healthy",
      "responseTime": 15,
      "details": {
        "connected": true,
        "queryTime": 15
      }
    },
    "redis": {
      "status": "healthy",
      "message": "Redis connection is healthy",
      "responseTime": 8,
      "details": {
        "connected": true,
        "ping": "PONG",
        "readWrite": true
      }
    }
  },
  "metrics": {
    "memory": {
      "systemFree": 1073741824,
      "systemTotal": 4294967296,
      "usage": "75.0%"
    },
    "cpu": {
      "usage": 25.5,
      "loadAverage": [0.5, 0.3, 0.2],
      "cores": 4
    }
  }
}
```

#### All Services Health
**GET** `/api/v1/health/all-services`

Health status of all monitored services with summary statistics.

**Response:**
```json
{
  "overall": "healthy",
  "timestamp": "2025-01-27T10:30:00.000Z",
  "responseTime": 25,
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 15,
      "message": "Database connection is healthy"
    },
    "redis": {
      "status": "healthy", 
      "responseTime": 8,
      "message": "Redis connection is healthy"
    }
  },
  "summary": {
    "total": 8,
    "healthy": 7,
    "degraded": 1,
    "unhealthy": 0
  }
}
```---


### Service-Specific Health Endpoints

#### Database Health
**GET** `/api/v1/health/database`

Specific health check for PostgreSQL database connectivity and performance.

**Response:**
```json
{
  "service": "database",
  "status": "healthy",
  "message": "Database connection is healthy",
  "responseTime": 15,
  "timestamp": "2025-01-27T10:30:00.000Z",
  "details": {
    "connected": true,
    "queryTime": 15,
    "serverTime": "2025-01-27T10:30:00.000Z"
  }
}
```

#### Redis Health
**GET** `/api/v1/health/redis`

Specific health check for Redis cache connectivity and operations.

**Response:**
```json
{
  "service": "redis",
  "status": "healthy",
  "message": "Redis connection is healthy",
  "responseTime": 8,
  "timestamp": "2025-01-27T10:30:00.000Z",
  "details": {
    "connected": true,
    "ping": "PONG",
    "readWrite": true
  }
}
```

#### Exchange APIs Health
**GET** `/api/v1/health/exchanges`

Health check for all configured exchange API connections.

**Response:**
```json
{
  "service": "exchanges",
  "status": "healthy",
  "message": "2/2 exchanges healthy",
  "responseTime": 120,
  "timestamp": "2025-01-27T10:30:00.000Z",
  "exchangeDetails": {
    "binance": {
      "status": "healthy",
      "message": "Exchange connection healthy",
      "responseTime": 85,
      "details": {
        "connected": true,
        "apiTest": true
      }
    },
    "kucoin": {
      "status": "healthy",
      "message": "Exchange connection healthy", 
      "responseTime": 95,
      "details": {
        "connected": true,
        "apiTest": true
      }
    }
  },
  "details": {
    "totalExchanges": 2,
    "healthyExchanges": 2,
    "availableExchanges": ["binance", "kucoin"]
  }
}
```

#### WebSocket Health
**GET** `/api/v1/health/websocket`

Health check for WebSocket server functionality.

**Response:**
```json
{
  "service": "websocket",
  "status": "healthy",
  "message": "WebSocket server is running",
  "responseTime": 5,
  "timestamp": "2025-01-27T10:30:00.000Z",
  "details": {
    "running": true,
    "connections": 15
  }
}
```

#### Paper Trading Safety
**GET** `/api/v1/health/paper-trading-safety`

Validates paper trading safety configuration and compliance.

**Response:**
```json
{
  "service": "paperTradingSafety",
  "status": "healthy",
  "message": "Paper trading safety score: 100%",
  "responseTime": 10,
  "timestamp": "2025-01-27T10:30:00.000Z",
  "details": {
    "safetyScore": 100,
    "checks": {
      "paperTradingEnabled": true,
      "realTradesDisabled": true,
      "simulationOnlySet": true,
      "noProductionKeys": true
    },
    "environment": {
      "NODE_ENV": "production",
      "TRADING_SIMULATION_ONLY": "true"
    }
  }
}
```

---

## Status Endpoints (`/api/v1/status`)

### API Status
**GET** `/api/v1/status`

Comprehensive API status information including all services and endpoints.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-27T10:30:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "uptime": 3600,
  "responseTime": 45,
  "paperTradingMode": {
    "enabled": true,
    "allowRealTrades": false,
    "safetyStatus": "SAFE",
    "safetyScore": 100,
    "virtualBalance": 10000
  },
  "endpoints": {
    "/api/v1/health": {
      "status": "healthy",
      "responseTime": 15,
      "lastChecked": "2025-01-27T10:30:00.000Z"
    }
  },
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 15,
      "message": "Database connection is healthy"
    }
  },
  "system": {
    "memory": {
      "usage": "75.0%"
    },
    "cpu": {
      "usage": 25.5
    }
  },
  "configuration": {
    "database": "connected",
    "redis": "connected",
    "exchanges": {
      "binance": "enabled",
      "kucoin": "enabled"
    },
    "monitoring": {
      "prometheus": "enabled",
      "grafana": "enabled"
    }
  }
}
```

### Services Status
**GET** `/api/v1/status/services`

Detailed status information for all external services and dependencies.

**Response:**
```json
{
  "timestamp": "2025-01-27T10:30:00.000Z",
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 15,
      "message": "Database connection is healthy",
      "lastChecked": "2025-01-27T10:30:00.000Z",
      "details": {
        "connected": true,
        "queryTime": 15
      }
    },
    "binance_api": {
      "status": "healthy",
      "responseTime": 85,
      "message": "Exchange connection healthy",
      "lastChecked": "2025-01-27T10:30:00.000Z",
      "type": "Exchange API",
      "exchange": "binance"
    }
  },
  "summary": {
    "total": 8,
    "healthy": 7,
    "degraded": 1,
    "unhealthy": 0
  }
}
```

### Paper Trading Status
**GET** `/api/v1/status/paper-trading`

Detailed paper trading safety configuration and status.

**Response:**
```json
{
  "timestamp": "2025-01-27T10:30:00.000Z",
  "paperTradingMode": true,
  "allowRealTrades": false,
  "safetyStatus": "SAFE",
  "safetyScore": 100,
  "status": "healthy",
  "message": "Paper trading safety score: 100%",
  "responseTime": 10,
  "checks": {
    "paperTradingEnabled": true,
    "realTradesDisabled": true,
    "simulationOnlySet": true,
    "noProductionKeys": true
  },
  "environment": {
    "NODE_ENV": "production",
    "TRADING_SIMULATION_ONLY": "true"
  },
  "recommendations": [
    "All critical safety checks are passing",
    "Paper trading mode is properly configured"
  ]
}
```

---

## Monitoring Integration

### Prometheus Metrics
**GET** `/api/v1/health/metrics`

Prometheus-compatible metrics endpoint for monitoring integration.

**Response Format:** `text/plain`
```
# HELP nodejs_heap_size_total_bytes Process heap size from Node.js in bytes.
# TYPE nodejs_heap_size_total_bytes gauge
nodejs_heap_size_total_bytes 268435456

# HELP trading_bot_health_check_duration_seconds Time spent on health checks
# TYPE trading_bot_health_check_duration_seconds histogram
trading_bot_health_check_duration_seconds_bucket{le="0.1"} 45
trading_bot_health_check_duration_seconds_bucket{le="0.5"} 120
trading_bot_health_check_duration_seconds_bucket{le="1"} 150
trading_bot_health_check_duration_seconds_bucket{le="+Inf"} 150
trading_bot_health_check_duration_seconds_sum 12.5
trading_bot_health_check_duration_seconds_count 150

# HELP trading_bot_service_status Current status of services (1=healthy, 0=unhealthy)
# TYPE trading_bot_service_status gauge
trading_bot_service_status{service="database"} 1
trading_bot_service_status{service="redis"} 1
trading_bot_service_status{service="exchanges"} 1
```

---

## Error Responses

All endpoints return standardized error responses when issues occur:

### Service Unavailable (503)
```json
{
  "status": "unhealthy",
  "error": "Service temporarily unavailable",
  "timestamp": "2025-01-27T10:30:00.000Z",
  "details": {
    "service": "database",
    "message": "Connection timeout"
  }
}
```

### Internal Server Error (500)
```json
{
  "status": "error",
  "error": "Internal server error",
  "timestamp": "2025-01-27T10:30:00.000Z"
}
```

---

## Usage Examples

### Kubernetes Configuration
```yaml
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: trading-bot
    image: trading-bot:latest
    livenessProbe:
      httpGet:
        path: /api/v1/health/live
        port: 3000
      initialDelaySeconds: 30
      periodSeconds: 10
    readinessProbe:
      httpGet:
        path: /api/v1/health/ready
        port: 3000
      initialDelaySeconds: 5
      periodSeconds: 5
    startupProbe:
      httpGet:
        path: /api/v1/health/startup
        port: 3000
      initialDelaySeconds: 10
      periodSeconds: 10
      failureThreshold: 30
```

### Load Balancer Configuration
```nginx
upstream trading_bot {
    server 10.0.1.10:3000;
    server 10.0.1.11:3000;
    server 10.0.1.12:3000;
}

location /health {
    proxy_pass http://trading_bot/api/v1/health;
    proxy_connect_timeout 1s;
    proxy_read_timeout 1s;
}
```

### Monitoring Script
```bash
#!/bin/bash
# Simple health check script
HEALTH_URL="http://localhost:3000/api/v1/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -eq 200 ]; then
    echo "Service is healthy"
    exit 0
else
    echo "Service is unhealthy (HTTP $RESPONSE)"
    exit 1
fi
```

---

## Security Considerations

- All health endpoints are publicly accessible for monitoring purposes
- Sensitive configuration details are not exposed in responses
- Rate limiting is applied to prevent abuse
- CORS headers are configured for cross-origin monitoring tools
- Authentication is not required for basic health checks
- Detailed endpoints may require authentication in production environments