import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { logger } from '../utils/logger';

export class MonitoringService {
  private static instance: MonitoringService;
  
  // System metrics
  private readonly httpRequestDuration: Histogram<string>;
  private readonly httpRequestTotal: Counter<string>;
  private readonly activeConnections: Gauge<string>;
  private readonly systemMemoryUsage: Gauge<string>;
  private readonly systemCpuUsage: Gauge<string>;
  
  // Trading metrics
  private readonly tradesExecuted: Counter<string>;
  private readonly signalsGenerated: Counter<string>;
  private readonly orderLatency: Histogram<string>;
  private readonly portfolioValue: Gauge<string>;
  private readonly riskExposure: Gauge<string>;
  
  // Error metrics
  private readonly errorTotal: Counter<string>;
  private readonly exchangeErrors: Counter<string>;
  private readonly databaseErrors: Counter<string>;

  private constructor() {
    // Enable default metrics collection
    collectDefaultMetrics({ register });

    // HTTP metrics
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5]
    });

    this.httpRequestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code']
    });

    this.activeConnections = new Gauge({
      name: 'active_connections_total',
      help: 'Number of active connections'
    });

    // System metrics
    this.systemMemoryUsage = new Gauge({
      name: 'system_memory_usage_bytes',
      help: 'System memory usage in bytes'
    });

    this.systemCpuUsage = new Gauge({
      name: 'system_cpu_usage_percent',
      help: 'System CPU usage percentage'
    });

    // Trading metrics
    this.tradesExecuted = new Counter({
      name: 'trades_executed_total',
      help: 'Total number of trades executed',
      labelNames: ['symbol', 'side', 'exchange', 'status']
    });

    this.signalsGenerated = new Counter({
      name: 'signals_generated_total',
      help: 'Total number of trading signals generated',
      labelNames: ['symbol', 'direction', 'confidence_level']
    });

    this.orderLatency = new Histogram({
      name: 'order_execution_latency_seconds',
      help: 'Order execution latency in seconds',
      labelNames: ['exchange', 'order_type'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2]
    });

    this.portfolioValue = new Gauge({
      name: 'portfolio_value_usd',
      help: 'Current portfolio value in USD',
      labelNames: ['user_id']
    });

    this.riskExposure = new Gauge({
      name: 'risk_exposure_percent',
      help: 'Current risk exposure as percentage of portfolio',
      labelNames: ['user_id']
    });

    // Error metrics
    this.errorTotal = new Counter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['service', 'error_type', 'severity']
    });

    this.exchangeErrors = new Counter({
      name: 'exchange_errors_total',
      help: 'Total number of exchange API errors',
      labelNames: ['exchange', 'error_code', 'endpoint']
    });

    this.databaseErrors = new Counter({
      name: 'database_errors_total',
      help: 'Total number of database errors',
      labelNames: ['operation', 'table', 'error_type']
    });

    // Register all metrics
    register.registerMetric(this.httpRequestDuration);
    register.registerMetric(this.httpRequestTotal);
    register.registerMetric(this.activeConnections);
    register.registerMetric(this.systemMemoryUsage);
    register.registerMetric(this.systemCpuUsage);
    register.registerMetric(this.tradesExecuted);
    register.registerMetric(this.signalsGenerated);
    register.registerMetric(this.orderLatency);
    register.registerMetric(this.portfolioValue);
    register.registerMetric(this.riskExposure);
    register.registerMetric(this.errorTotal);
    register.registerMetric(this.exchangeErrors);
    register.registerMetric(this.databaseErrors);

    this.startSystemMetricsCollection();
  }

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  // HTTP metrics methods
  public recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    this.httpRequestDuration.observe({ method, route, status_code: statusCode.toString() }, duration);
    this.httpRequestTotal.inc({ method, route, status_code: statusCode.toString() });
  }

  public incrementActiveConnections(): void {
    this.activeConnections.inc();
  }

  public decrementActiveConnections(): void {
    this.activeConnections.dec();
  }

  // Trading metrics methods
  public recordTradeExecution(symbol: string, side: string, exchange: string, status: string): void {
    this.tradesExecuted.inc({ symbol, side, exchange, status });
  }

  public recordSignalGeneration(symbol: string, direction: string, confidence: number): void {
    const confidenceLevel = confidence >= 0.8 ? 'high' : confidence >= 0.6 ? 'medium' : 'low';
    this.signalsGenerated.inc({ symbol, direction, confidence_level: confidenceLevel });
  }

  public recordOrderLatency(exchange: string, orderType: string, latency: number): void {
    this.orderLatency.observe({ exchange, order_type: orderType }, latency);
  }

  public updatePortfolioValue(userId: string, value: number): void {
    this.portfolioValue.set({ user_id: userId }, value);
  }

  public updateRiskExposure(userId: string, exposure: number): void {
    this.riskExposure.set({ user_id: userId }, exposure);
  }

  // Error metrics methods
  public recordError(service: string, errorType: string, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    this.errorTotal.inc({ service, error_type: errorType, severity });
  }

  public recordExchangeError(exchange: string, errorCode: string, endpoint: string): void {
    this.exchangeErrors.inc({ exchange, error_code: errorCode, endpoint });
  }

  public recordDatabaseError(operation: string, table: string, errorType: string): void {
    this.databaseErrors.inc({ operation, table, error_type: errorType });
  }

  // System metrics collection
  private startSystemMetricsCollection(): void {
    setInterval(() => {
      try {
        const memUsage = process.memoryUsage();
        this.systemMemoryUsage.set(memUsage.heapUsed);

        // CPU usage calculation (simplified)
        const cpuUsage = process.cpuUsage();
        const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
        this.systemCpuUsage.set(cpuPercent);
      } catch (error) {
        logger.error('Error collecting system metrics:', error);
      }
    }, 5000); // Collect every 5 seconds
  }

  // Get metrics for Prometheus scraping
  public async getMetrics(): Promise<string> {
    return register.metrics();
  }

  // Health check
  public getHealthStatus(): { status: string; timestamp: number; metrics: any } {
    return {
      status: 'healthy',
      timestamp: Date.now(),
      metrics: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      }
    };
  }
}