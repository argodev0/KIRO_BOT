import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { logger } from './logger';

// Enable default Node.js metrics collection
collectDefaultMetrics({ 
  register,
  prefix: 'kiro_bot_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
  eventLoopMonitoringPrecision: 5
});

// HTTP Metrics
export const httpRequestsTotal = new Counter({
  name: 'kiro_bot_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestDuration = new Histogram({
  name: 'kiro_bot_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
});

export const httpRequestSize = new Histogram({
  name: 'kiro_bot_http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
});

export const httpResponseSize = new Histogram({
  name: 'kiro_bot_http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 1000, 10000, 100000, 1000000],
});

// Trading Metrics
export const tradingSignalsTotal = new Counter({
  name: 'kiro_bot_trading_signals_total',
  help: 'Total number of trading signals generated',
  labelNames: ['symbol', 'direction', 'status', 'strategy', 'confidence_level'],
});

export const tradeExecutionsTotal = new Counter({
  name: 'kiro_bot_trade_executions_total',
  help: 'Total number of trade executions',
  labelNames: ['symbol', 'side', 'exchange', 'type', 'status'],
});

export const orderLatency = new Histogram({
  name: 'kiro_bot_order_execution_latency_seconds',
  help: 'Order execution latency in seconds',
  labelNames: ['exchange', 'order_type', 'symbol'],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const portfolioValue = new Gauge({
  name: 'kiro_bot_portfolio_value_usd',
  help: 'Current portfolio value in USD',
  labelNames: ['user_id', 'type'],
});

export const activePositions = new Gauge({
  name: 'kiro_bot_active_positions_count',
  help: 'Number of active trading positions',
  labelNames: ['user_id', 'symbol', 'side'],
});

export const riskExposure = new Gauge({
  name: 'kiro_bot_risk_exposure_percent',
  help: 'Current risk exposure as percentage of portfolio',
  labelNames: ['user_id'],
});

export const profitLoss = new Gauge({
  name: 'kiro_bot_profit_loss_usd',
  help: 'Current profit/loss in USD',
  labelNames: ['user_id', 'type', 'period'],
});

// Paper Trading Specific Metrics
export const paperTradesTotal = new Counter({
  name: 'kiro_bot_paper_trades_total',
  help: 'Total number of paper trades executed',
  labelNames: ['symbol', 'side', 'exchange', 'strategy'],
});

export const virtualBalanceTotal = new Gauge({
  name: 'kiro_bot_virtual_balance_usd',
  help: 'Virtual balance in USD for paper trading',
  labelNames: ['user_id', 'currency'],
});

export const paperTradingPnL = new Gauge({
  name: 'kiro_bot_paper_trading_pnl_usd',
  help: 'Paper trading profit/loss in USD',
  labelNames: ['user_id', 'period'],
});

export const paperTradingWinRate = new Gauge({
  name: 'kiro_bot_paper_trading_win_rate_percent',
  help: 'Paper trading win rate percentage',
  labelNames: ['user_id', 'strategy'],
});

export const paperTradingDrawdown = new Gauge({
  name: 'kiro_bot_paper_trading_drawdown_percent',
  help: 'Paper trading maximum drawdown percentage',
  labelNames: ['user_id'],
});

// System Performance Metrics
export const databaseConnections = new Gauge({
  name: 'kiro_bot_database_connections_active',
  help: 'Number of active database connections',
  labelNames: ['database', 'state'],
});

export const databaseQueryDuration = new Histogram({
  name: 'kiro_bot_database_query_duration_seconds',
  help: 'Database query execution time in seconds',
  labelNames: ['operation', 'table', 'status'],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const redisConnections = new Gauge({
  name: 'kiro_bot_redis_connections_active',
  help: 'Number of active Redis connections',
  labelNames: ['instance', 'state'],
});

export const redisOperationDuration = new Histogram({
  name: 'kiro_bot_redis_operation_duration_seconds',
  help: 'Redis operation execution time in seconds',
  labelNames: ['operation', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

export const rabbitmqMessages = new Counter({
  name: 'kiro_bot_rabbitmq_messages_total',
  help: 'Total number of RabbitMQ messages processed',
  labelNames: ['queue', 'status', 'operation'],
});

export const rabbitmqQueueSize = new Gauge({
  name: 'kiro_bot_rabbitmq_queue_size',
  help: 'Number of messages in RabbitMQ queues',
  labelNames: ['queue'],
});

// Market Data Metrics
export const marketDataUpdates = new Counter({
  name: 'kiro_bot_market_data_updates_total',
  help: 'Total number of market data updates received',
  labelNames: ['symbol', 'exchange', 'timeframe', 'type'],
});

export const marketDataLatency = new Histogram({
  name: 'kiro_bot_market_data_latency_seconds',
  help: 'Market data update latency in seconds',
  labelNames: ['exchange', 'symbol'],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const websocketConnections = new Gauge({
  name: 'kiro_bot_websocket_connections_active',
  help: 'Number of active WebSocket connections',
  labelNames: ['exchange', 'type', 'status'],
});

export const websocketMessages = new Counter({
  name: 'kiro_bot_websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['exchange', 'direction', 'type'],
});

export const websocketReconnections = new Counter({
  name: 'kiro_bot_websocket_reconnections_total',
  help: 'Total number of WebSocket reconnections',
  labelNames: ['exchange', 'reason'],
});

// Technical Analysis Metrics
export const technicalIndicatorCalculations = new Counter({
  name: 'kiro_bot_technical_indicator_calculations_total',
  help: 'Total number of technical indicator calculations',
  labelNames: ['indicator', 'symbol', 'timeframe'],
});

export const technicalIndicatorLatency = new Histogram({
  name: 'kiro_bot_technical_indicator_latency_seconds',
  help: 'Technical indicator calculation latency in seconds',
  labelNames: ['indicator', 'symbol'],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1],
});

// Error and Security Metrics
export const errorsTotal = new Counter({
  name: 'kiro_bot_errors_total',
  help: 'Total number of errors',
  labelNames: ['service', 'type', 'severity'],
});

export const exchangeErrors = new Counter({
  name: 'kiro_bot_exchange_errors_total',
  help: 'Total number of exchange API errors',
  labelNames: ['exchange', 'error_code', 'endpoint'],
});

export const securityEvents = new Counter({
  name: 'kiro_bot_security_events_total',
  help: 'Total number of security events',
  labelNames: ['event_type', 'severity', 'source'],
});

export const rateLimitHits = new Counter({
  name: 'kiro_bot_rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['endpoint', 'ip', 'user_id'],
});

export const authenticationAttempts = new Counter({
  name: 'kiro_bot_authentication_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['method', 'status', 'source'],
});

// Business Metrics
export const activeUsers = new Gauge({
  name: 'kiro_bot_active_users_total',
  help: 'Number of active users',
  labelNames: ['period'],
});

export const tradingStrategiesActive = new Gauge({
  name: 'kiro_bot_trading_strategies_active',
  help: 'Number of active trading strategies',
  labelNames: ['strategy_type'],
});

export const apiCallsTotal = new Counter({
  name: 'kiro_bot_api_calls_total',
  help: 'Total number of API calls made',
  labelNames: ['service', 'endpoint', 'status'],
});

export const cacheHitRate = new Gauge({
  name: 'kiro_bot_cache_hit_rate_percent',
  help: 'Cache hit rate percentage',
  labelNames: ['cache_type'],
});

export const systemUptime = new Gauge({
  name: 'kiro_bot_system_uptime_seconds',
  help: 'System uptime in seconds',
});

// Resource Utilization Metrics
export const memoryUsage = new Gauge({
  name: 'kiro_bot_memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type'],
});

export const cpuUsage = new Gauge({
  name: 'kiro_bot_cpu_usage_percent',
  help: 'CPU usage percentage',
  labelNames: ['core'],
});

export const diskUsage = new Gauge({
  name: 'kiro_bot_disk_usage_bytes',
  help: 'Disk usage in bytes',
  labelNames: ['mount_point', 'type'],
});

export const networkIO = new Counter({
  name: 'kiro_bot_network_io_bytes_total',
  help: 'Total network I/O in bytes',
  labelNames: ['direction', 'interface'],
});

// Register all metrics
const metrics = [
  httpRequestsTotal,
  httpRequestDuration,
  httpRequestSize,
  httpResponseSize,
  tradingSignalsTotal,
  tradeExecutionsTotal,
  orderLatency,
  portfolioValue,
  activePositions,
  riskExposure,
  profitLoss,
  paperTradesTotal,
  virtualBalanceTotal,
  paperTradingPnL,
  paperTradingWinRate,
  paperTradingDrawdown,
  databaseConnections,
  databaseQueryDuration,
  redisConnections,
  redisOperationDuration,
  rabbitmqMessages,
  rabbitmqQueueSize,
  marketDataUpdates,
  marketDataLatency,
  websocketConnections,
  websocketMessages,
  websocketReconnections,
  technicalIndicatorCalculations,
  technicalIndicatorLatency,
  errorsTotal,
  exchangeErrors,
  securityEvents,
  rateLimitHits,
  authenticationAttempts,
  activeUsers,
  tradingStrategiesActive,
  apiCallsTotal,
  cacheHitRate,
  systemUptime,
  memoryUsage,
  cpuUsage,
  diskUsage,
  networkIO,
];

// Register all metrics with Prometheus
metrics.forEach(metric => {
  try {
    register.registerMetric(metric as any);
  } catch (error) {
    // Metric might already be registered, ignore
    logger.debug(`Metric already registered`);
  }
});

logger.info(`Registered ${metrics.length} custom Prometheus metrics`);

export { register };