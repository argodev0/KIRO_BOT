import { register, Counter, Histogram, Gauge } from 'prom-client';

// HTTP Metrics
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

// Trading Metrics
export const tradingSignalsTotal = new Counter({
  name: 'trading_signals_total',
  help: 'Total number of trading signals generated',
  labelNames: ['symbol', 'direction', 'status'],
});

export const tradeExecutionsTotal = new Counter({
  name: 'trade_executions_total',
  help: 'Total number of trade executions',
  labelNames: ['symbol', 'side', 'exchange'],
});

export const portfolioValue = new Gauge({
  name: 'portfolio_value_usd',
  help: 'Current portfolio value in USD',
  labelNames: ['user_id'],
});

export const activePositions = new Gauge({
  name: 'active_positions_count',
  help: 'Number of active trading positions',
  labelNames: ['user_id'],
});

// System Metrics
export const databaseConnections = new Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections',
});

export const redisConnections = new Gauge({
  name: 'redis_connections_active',
  help: 'Number of active Redis connections',
});

export const rabbitmqMessages = new Counter({
  name: 'rabbitmq_messages_total',
  help: 'Total number of RabbitMQ messages processed',
  labelNames: ['queue', 'status'],
});

// Market Data Metrics
export const marketDataUpdates = new Counter({
  name: 'market_data_updates_total',
  help: 'Total number of market data updates received',
  labelNames: ['symbol', 'exchange', 'timeframe'],
});

export const websocketConnections = new Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections',
  labelNames: ['exchange'],
});

// Error Metrics
export const errorsTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'severity'],
});

// Register default metrics
register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDuration);
register.registerMetric(tradingSignalsTotal);
register.registerMetric(tradeExecutionsTotal);
register.registerMetric(portfolioValue);
register.registerMetric(activePositions);
register.registerMetric(databaseConnections);
register.registerMetric(redisConnections);
register.registerMetric(rabbitmqMessages);
register.registerMetric(marketDataUpdates);
register.registerMetric(websocketConnections);
register.registerMetric(errorsTotal);

export { register };