# AI Crypto Trading Bot - System Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Components](#components)
4. [API Documentation](#api-documentation)
5. [Database Schema](#database-schema)
6. [Security](#security)
7. [Monitoring](#monitoring)
8. [Deployment](#deployment)
9. [Troubleshooting](#troubleshooting)

## System Overview

The AI Crypto Trading Bot is a comprehensive cryptocurrency trading system that combines advanced technical analysis, machine learning, and automated trading capabilities. The system operates 24/7, analyzing market conditions across multiple exchanges and executing trades based on Elliott Wave theory, Fibonacci analysis, candlestick patterns, and technical indicators.

### Key Features

- **Multi-Exchange Support**: Binance and KuCoin integration
- **Advanced Technical Analysis**: Elliott Wave, Fibonacci, RSI, MACD, Wave Trend
- **Pattern Recognition**: Candlestick patterns and chart formations
- **Grid Trading**: Elliott Wave-based and Fibonacci-spaced grid strategies
- **Risk Management**: Comprehensive position sizing and risk controls
- **Real-time Data**: WebSocket streaming and real-time analysis
- **Web Interface**: Professional trading dashboard with TradingView charts
- **Security**: Multi-factor authentication, encrypted API keys, audit logging

### System Requirements

- **Runtime**: Node.js 18+
- **Database**: PostgreSQL 13+
- **Cache**: Redis 6+
- **Message Queue**: RabbitMQ 3.8+
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)

## Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Exchanges     │    │   Data Layer    │    │  Analysis       │
│                 │    │                 │    │  Engine         │
│ • Binance API   │───▶│ • Data Ingestion│───▶│ • Technical     │
│ • KuCoin API    │    │ • Validation    │    │   Analysis      │
│ • WebSocket     │    │ • Normalization │    │ • Pattern       │
│   Streams       │    │ • Caching       │    │   Recognition   │
└─────────────────┘    └─────────────────┘    │ • Elliott Wave  │
                                              │ • Fibonacci     │
                                              └─────────────────┘
                                                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web App       │    │   Trading       │    │   Signal        │
│                 │    │   Core          │    │   Engine        │
│ • React UI      │◀───│                 │◀───│                 │
│ • TradingView   │    │ • Execution     │    │ • Generation    │
│ • WebSocket     │    │ • Risk Mgmt     │    │ • Filtering     │
│ • Dashboard     │    │ • Position Mgmt │    │ • Validation    │
└─────────────────┘    │ • Grid Trading  │    └─────────────────┘
                       └─────────────────┘
                                │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Infrastructure │    │   Database      │    │   Monitoring    │
│                 │    │                 │    │                 │
│ • Docker        │    │ • PostgreSQL    │    │ • Prometheus    │
│ • Kubernetes    │    │ • Redis Cache   │    │ • Grafana       │
│ • Load Balancer │    │ • RabbitMQ      │    │ • ELK Stack     │
│ • SSL/TLS       │    │ • Backups       │    │ • Alerting      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Microservices Architecture

The system is built using a microservices architecture with the following services:

1. **API Gateway**: Express.js REST API and WebSocket server
2. **Data Ingestion Service**: Market data collection and normalization
3. **Analysis Service**: Technical analysis and pattern recognition
4. **Signal Service**: Trading signal generation and filtering
5. **Trading Service**: Order execution and position management
6. **Risk Service**: Risk management and compliance
7. **Grid Service**: Grid trading strategy management
8. **Notification Service**: Alerts and notifications
9. **Analytics Service**: Performance tracking and reporting

## Components

### Data Ingestion Service

**Purpose**: Collect, validate, and normalize market data from multiple exchanges.

**Key Features**:
- Real-time WebSocket connections to exchanges
- Rate limiting and connection management
- Data validation and quality control
- Multi-timeframe aggregation
- Historical data backfill

**Configuration**:
```typescript
interface DataIngestionConfig {
  exchanges: {
    binance: {
      apiKey: string;
      secretKey: string;
      rateLimits: {
        requests: number;
        window: number;
      };
    };
    kucoin: {
      apiKey: string;
      secretKey: string;
      passphrase: string;
    };
  };
  symbols: string[];
  timeframes: string[];
  batchSize: number;
}
```

### Technical Analysis Service

**Purpose**: Perform comprehensive technical analysis on market data.

**Indicators Supported**:
- **RSI (Relative Strength Index)**: Momentum oscillator
- **MACD (Moving Average Convergence Divergence)**: Trend following
- **Wave Trend**: Custom oscillator for trend identification
- **PVT (Price Volume Trend)**: Volume-based indicator
- **Support/Resistance**: Dynamic level detection
- **Market Regime**: Trending vs ranging classification

**Elliott Wave Analysis**:
- Wave structure identification (impulse/corrective)
- Wave degree classification (Minute, Minor, Intermediate, Primary)
- Fibonacci wave relationships
- Wave target calculations
- Invalidation rules

**Fibonacci Analysis**:
- Retracement levels (23.6%, 38.2%, 50%, 61.8%, 78.6%)
- Extension levels (127.2%, 161.8%, 261.8%)
- Time-based Fibonacci
- Confluence zone detection

### Pattern Recognition Service

**Purpose**: Identify candlestick patterns and chart formations.

**Candlestick Patterns**:
- **Reversal Patterns**: Doji, Hammer, Shooting Star, Engulfing
- **Continuation Patterns**: Spinning Top, Marubozu
- **Complex Patterns**: Three White Soldiers, Three Black Crows

**Chart Patterns**:
- Head and Shoulders
- Triangles (Ascending, Descending, Symmetrical)
- Flags and Pennants
- Double Top/Bottom

**Pattern Scoring**:
```typescript
interface PatternScore {
  strength: 'weak' | 'moderate' | 'strong';
  confidence: number; // 0-1
  context: {
    volume: number;
    trend: string;
    support: number;
    resistance: number;
  };
}
```

### Signal Generation Engine

**Purpose**: Aggregate analysis results and generate trading signals.

**Signal Weighting**:
- Technical Analysis: 30%
- Candlestick Patterns: 20%
- Elliott Wave: 25%
- Fibonacci: 20%
- Volume Analysis: 5%

**Signal Structure**:
```typescript
interface TradingSignal {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number[];
  reasoning: {
    technical: TechnicalReasoning;
    patterns: PatternReasoning;
    elliottWave: WaveReasoning;
    fibonacci: FibonacciReasoning;
  };
  timeframe: string;
  timestamp: number;
  expiresAt: number;
}
```

### Risk Management Service

**Purpose**: Enforce risk controls and position sizing.

**Risk Limits**:
- Maximum risk per trade: 3% of account balance
- Maximum daily loss: 5% of account balance
- Maximum total exposure: 5x account balance
- Maximum drawdown: 15% from peak

**Position Sizing**:
```typescript
function calculatePositionSize(
  signal: TradingSignal,
  accountBalance: number,
  riskPercentage: number
): number {
  const riskAmount = accountBalance * riskPercentage;
  const stopDistance = Math.abs(signal.entryPrice - signal.stopLoss);
  const stopPercentage = stopDistance / signal.entryPrice;
  
  return riskAmount / (signal.entryPrice * stopPercentage);
}
```

### Grid Trading Service

**Purpose**: Implement advanced grid trading strategies.

**Grid Types**:
1. **Elliott Wave Grid**: Places grids based on wave structure
2. **Fibonacci Grid**: Uses golden ratio spacing
3. **Standard Grid**: Fixed percentage spacing

**Grid Configuration**:
```typescript
interface GridConfig {
  symbol: string;
  strategy: 'elliott-wave' | 'fibonacci' | 'standard';
  basePrice: number;
  gridCount: number;
  spacing: number | 'fibonacci';
  investment: number;
  stopLoss?: number;
  takeProfit?: number;
}
```

## API Documentation

### Authentication

All API endpoints require JWT authentication:

```http
Authorization: Bearer <jwt_token>
```

### Core Endpoints

#### Market Data

```http
GET /api/market-data/ticker/:symbol
GET /api/market-data/candles/:symbol?timeframe=1h&limit=100
GET /api/market-data/orderbook/:symbol
GET /api/market-data/trades/:symbol
```

#### Analysis

```http
POST /api/analysis/technical/:symbol
POST /api/analysis/elliott-wave/:symbol
POST /api/analysis/fibonacci/:symbol
POST /api/analysis/patterns/:symbol
```

#### Signals

```http
GET /api/signals
POST /api/signals/generate
POST /api/signals/scan
PUT /api/signals/:id/status
```

#### Trading

```http
GET /api/positions
POST /api/trading/execute
POST /api/trading/validate-order
DELETE /api/trading/cancel/:orderId
```

#### Grid Trading

```http
GET /api/grids
POST /api/grids/create
GET /api/grids/:id/status
POST /api/grids/:id/adjust
DELETE /api/grids/:id
```

#### Risk Management

```http
GET /api/risk/metrics
POST /api/risk/validate
PUT /api/risk/limits
POST /api/emergency/shutdown
```

### WebSocket Events

#### Market Data Streams

```javascript
// Subscribe to ticker updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'ticker',
  symbol: 'BTCUSDT'
}));

// Subscribe to signal notifications
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'signals'
}));
```

#### Event Types

```typescript
interface WebSocketEvent {
  type: 'ticker' | 'signal' | 'trade' | 'position' | 'grid';
  channel: string;
  data: any;
  timestamp: number;
}
```

## Database Schema

### Core Tables

#### Users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  mfa_secret VARCHAR(255),
  api_keys JSONB,
  risk_settings JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Trading Signals
```sql
CREATE TABLE trading_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  symbol VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL,
  confidence DECIMAL(5,2) NOT NULL,
  entry_price DECIMAL(20,8) NOT NULL,
  stop_loss DECIMAL(20,8),
  take_profit JSONB,
  reasoning JSONB,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);
```

#### Trade Executions
```sql
CREATE TABLE trade_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES trading_signals(id),
  user_id UUID REFERENCES users(id),
  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(10) NOT NULL,
  quantity DECIMAL(20,8) NOT NULL,
  price DECIMAL(20,8) NOT NULL,
  fee DECIMAL(20,8),
  exchange VARCHAR(50) NOT NULL,
  order_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending',
  executed_at TIMESTAMP DEFAULT NOW()
);
```

#### Grid Trading
```sql
CREATE TABLE grids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  symbol VARCHAR(20) NOT NULL,
  strategy VARCHAR(50) NOT NULL,
  levels JSONB NOT NULL,
  base_price DECIMAL(20,8) NOT NULL,
  spacing DECIMAL(10,4) NOT NULL,
  total_profit DECIMAL(20,8) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Indexes

```sql
-- Performance indexes
CREATE INDEX idx_signals_user_status ON trading_signals(user_id, status);
CREATE INDEX idx_signals_symbol_created ON trading_signals(symbol, created_at);
CREATE INDEX idx_executions_user_symbol ON trade_executions(user_id, symbol);
CREATE INDEX idx_grids_user_status ON grids(user_id, status);

-- Time-series indexes
CREATE INDEX idx_market_data_symbol_time ON market_data(symbol, timestamp);
CREATE INDEX idx_analysis_results_time ON analysis_results(timestamp);
```

## Security

### Authentication & Authorization

**Multi-Factor Authentication (MFA)**:
- TOTP-based 2FA using Google Authenticator
- Backup codes for account recovery
- Session management with JWT tokens

**API Security**:
- Rate limiting per user and endpoint
- Request validation and sanitization
- CORS configuration
- Security headers (HSTS, CSP, X-Frame-Options)

### Data Protection

**Encryption**:
- API keys encrypted at rest using AES-256
- TLS 1.3 for data in transit
- Database encryption for sensitive fields

**Access Control**:
- Role-based permissions (User, Admin, System)
- API key scoping and permissions
- Audit logging for all actions

### Security Headers

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

## Monitoring

### Metrics Collection

The application exposes comprehensive metrics using the `prom-client` library at the `/metrics` endpoint.

**System Metrics**:
- CPU, Memory, Disk usage
- Network I/O and latency
- Database connection pool status
- Cache hit rates

**Application Metrics**:
- API request rates and latency
- Signal generation performance
- Trade execution success rates
- Risk limit violations

**Business Metrics**:
- Trading performance (P&L, win rate)
- Signal accuracy and profitability
- User engagement and activity
- System uptime and availability

### Prometheus Configuration

The application uses the `prom-client` library for metrics collection and exposure.

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'trading-bot'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 5s

  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']
```

### Grafana Dashboards

**System Overview Dashboard**:
- System health indicators
- Resource utilization
- Error rates and latency
- Active users and sessions

**Trading Performance Dashboard**:
- P&L tracking
- Signal performance
- Risk metrics
- Exchange connectivity status

**Technical Analysis Dashboard**:
- Indicator calculations per second
- Pattern detection accuracy
- Elliott Wave analysis performance
- Market regime classification

### Alerting Rules

```yaml
groups:
  - name: trading_bot_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"

      - alert: DatabaseConnectionFailure
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection failed"

      - alert: ExchangeConnectivityIssue
        expr: exchange_connection_status == 0
        for: 30s
        labels:
          severity: warning
        annotations:
          summary: "Exchange connectivity issue"
```

## Deployment

### Docker Configuration

**Dockerfile**:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY public/ ./public/

EXPOSE 3000

USER node

CMD ["node", "dist/index.js"]
```

**Docker Compose**:
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/trading_bot
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
      - rabbitmq

  postgres:
    image: postgres:13
    environment:
      POSTGRES_DB: trading_bot
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6-alpine
    volumes:
      - redis_data:/data

  rabbitmq:
    image: rabbitmq:3-management
    environment:
      RABBITMQ_DEFAULT_USER: user
      RABBITMQ_DEFAULT_PASS: pass
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

volumes:
  postgres_data:
  redis_data:
  rabbitmq_data:
```

### Kubernetes Deployment

**Deployment Manifest**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: trading-bot
spec:
  replicas: 3
  selector:
    matchLabels:
      app: trading-bot
  template:
    metadata:
      labels:
        app: trading-bot
    spec:
      containers:
      - name: trading-bot
        image: trading-bot:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: trading-bot-secrets
              key: database-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Environment Configuration

**Production Environment Variables**:
```bash
# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/trading_bot
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://user:pass@localhost:5672

# Security
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key
MFA_ISSUER=AI-Crypto-Trading-Bot

# Exchange APIs
BINANCE_API_KEY=your-binance-api-key
BINANCE_SECRET_KEY=your-binance-secret-key
KUCOIN_API_KEY=your-kucoin-api-key
KUCOIN_SECRET_KEY=your-kucoin-secret-key
KUCOIN_PASSPHRASE=your-kucoin-passphrase

# Monitoring
PROMETHEUS_ENABLED=true
GRAFANA_URL=http://localhost:3001
```

### Setup Validation

The project includes validation scripts to ensure all dependencies and configurations are correct:

```bash
# Validate basic setup
node scripts/validate-setup.js

# Validate monitoring configuration
node validate-monitoring.js

# Validate security configuration
node validate-security.js
```

The setup validation script checks for the correct `prom-client` package (the official Prometheus client for Node.js) along with other critical dependencies.

## Troubleshooting

### Common Issues

#### Database Connection Issues

**Symptoms**:
- Application fails to start
- "Connection refused" errors
- Timeout errors

**Solutions**:
1. Check database service status
2. Verify connection string
3. Check firewall rules
4. Validate credentials

```bash
# Test database connection
psql -h localhost -U user -d trading_bot -c "SELECT 1;"

# Check connection pool status
curl http://localhost:3000/api/system/health | jq '.database'
```

#### Exchange API Issues

**Symptoms**:
- Market data not updating
- Trade execution failures
- Rate limit errors

**Solutions**:
1. Verify API credentials
2. Check rate limits
3. Monitor exchange status
4. Review API permissions

```bash
# Check exchange connectivity
curl http://localhost:3000/api/system/health | jq '.exchanges'

# Test API credentials
curl -X POST http://localhost:3000/api/test/exchange-connection \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"exchange": "binance"}'
```

#### Performance Issues

**Symptoms**:
- Slow API responses
- High CPU/memory usage
- Signal generation delays

**Solutions**:
1. Check system resources
2. Review database queries
3. Monitor cache hit rates
4. Analyze bottlenecks

```bash
# Check system metrics
curl http://localhost:3000/metrics | grep -E "(cpu|memory|response_time)"

# Analyze slow queries
psql -d trading_bot -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

### Log Analysis

**Application Logs**:
```bash
# View recent logs
docker logs trading-bot --tail 100 -f

# Search for errors
docker logs trading-bot 2>&1 | grep -i error

# Filter by component
docker logs trading-bot 2>&1 | grep "SignalEngine"
```

**Database Logs**:
```bash
# PostgreSQL logs
tail -f /var/log/postgresql/postgresql-13-main.log

# Slow query log
grep "duration:" /var/log/postgresql/postgresql-13-main.log
```

### Health Checks

**System Health Endpoint**:
```http
GET /api/system/health
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 86400,
  "components": {
    "database": {
      "status": "healthy",
      "responseTime": 5,
      "connections": {
        "active": 10,
        "idle": 5,
        "total": 15
      }
    },
    "redis": {
      "status": "healthy",
      "responseTime": 2,
      "memory": "256MB",
      "hitRate": 0.95
    },
    "exchanges": {
      "binance": {
        "status": "healthy",
        "latency": 45,
        "rateLimitRemaining": 1000
      },
      "kucoin": {
        "status": "healthy",
        "latency": 52,
        "rateLimitRemaining": 800
      }
    }
  },
  "metrics": {
    "requestsPerSecond": 150,
    "averageResponseTime": 85,
    "errorRate": 0.001,
    "activeUsers": 25
  }
}
```

### Emergency Procedures

#### System Shutdown

```bash
# Graceful shutdown
curl -X POST http://localhost:3000/api/emergency/shutdown \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "maintenance", "graceful": true}'

# Immediate shutdown
docker stop trading-bot
```

#### Data Recovery

```bash
# Database backup
pg_dump trading_bot > backup_$(date +%Y%m%d_%H%M%S).sql

# Database restore
psql trading_bot < backup_20240115_103000.sql

# Redis backup
redis-cli BGSAVE
```

#### Rollback Procedures

```bash
# Application rollback
kubectl rollout undo deployment/trading-bot

# Database migration rollback
npm run migrate:rollback

# Configuration rollback
git checkout HEAD~1 -- config/
```

This documentation provides comprehensive coverage of the AI Crypto Trading Bot system, including architecture, components, deployment, and troubleshooting procedures. It serves as the primary reference for developers, operators, and users of the system.