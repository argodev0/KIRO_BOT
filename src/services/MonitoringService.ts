import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import { EventEmitter } from 'events';
import * as os from 'os';
import * as fs from 'fs';
import { promisify } from 'util';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: boolean;
    redis: boolean;
    exchanges: boolean;
    websocket: boolean;
    filesystem: boolean;
    memory: boolean;
    cpu: boolean;
  };
  metrics: {
    uptime: number;
    memory: NodeJS.MemoryUsage;
    cpu: NodeJS.CpuUsage;
    loadAverage: number[];
    freeMemory: number;
    totalMemory: number;
  };
  timestamp: number;
}

interface ServiceStatus {
  name: string;
  status: 'up' | 'down' | 'degraded';
  lastCheck: number;
  responseTime?: number;
  error?: string;
}

export class MonitoringService extends EventEmitter {
  private static instance: MonitoringService;
  
  // System metrics
  private readonly httpRequestDuration: Histogram<string>;
  private readonly httpRequestTotal: Counter<string>;
  private readonly activeConnections: Gauge<string>;
  private readonly systemMemoryUsage: Gauge<string>;
  private readonly systemCpuUsage: Gauge<string>;
  private readonly systemLoadAverage: Gauge<string>;
  private readonly diskUsage: Gauge<string>;
  private readonly networkConnections: Gauge<string>;
  
  // Trading metrics
  private readonly tradesExecuted: Counter<string>;
  private readonly signalsGenerated: Counter<string>;
  private readonly orderLatency: Histogram<string>;
  private readonly portfolioValue: Gauge<string>;
  private readonly riskExposure: Gauge<string>;
  private readonly paperTradesTotal: Counter<string>;
  private readonly virtualBalanceTotal: Gauge<string>;
  
  // Error metrics
  private readonly errorTotal: Counter<string>;
  private readonly exchangeErrors: Counter<string>;
  private readonly databaseErrors: Counter<string>;
  private readonly websocketErrors: Counter<string>;
  private readonly securityEvents: Counter<string>;
  
  // Service health tracking
  private serviceStatuses: Map<string, ServiceStatus> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsCollectionInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    
    // Enable default metrics collection
    collectDefaultMetrics({ 
      register,
      prefix: 'kiro_bot_',
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
    });

    // HTTP metrics
    this.httpRequestDuration = new Histogram({
      name: 'kiro_bot_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
    });

    this.httpRequestTotal = new Counter({
      name: 'kiro_bot_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code']
    });

    this.activeConnections = new Gauge({
      name: 'kiro_bot_active_connections_total',
      help: 'Number of active connections',
      labelNames: ['type']
    });

    // Enhanced system metrics
    this.systemMemoryUsage = new Gauge({
      name: 'kiro_bot_system_memory_usage_bytes',
      help: 'System memory usage in bytes',
      labelNames: ['type']
    });

    this.systemCpuUsage = new Gauge({
      name: 'kiro_bot_system_cpu_usage_percent',
      help: 'System CPU usage percentage'
    });

    this.systemLoadAverage = new Gauge({
      name: 'kiro_bot_system_load_average',
      help: 'System load average',
      labelNames: ['period']
    });

    this.diskUsage = new Gauge({
      name: 'kiro_bot_disk_usage_bytes',
      help: 'Disk usage in bytes',
      labelNames: ['type']
    });

    this.networkConnections = new Gauge({
      name: 'kiro_bot_network_connections_total',
      help: 'Number of network connections',
      labelNames: ['state']
    });

    // Trading metrics
    this.tradesExecuted = new Counter({
      name: 'kiro_bot_trades_executed_total',
      help: 'Total number of trades executed',
      labelNames: ['symbol', 'side', 'exchange', 'status', 'type']
    });

    this.signalsGenerated = new Counter({
      name: 'kiro_bot_signals_generated_total',
      help: 'Total number of trading signals generated',
      labelNames: ['symbol', 'direction', 'confidence_level', 'strategy']
    });

    this.orderLatency = new Histogram({
      name: 'kiro_bot_order_execution_latency_seconds',
      help: 'Order execution latency in seconds',
      labelNames: ['exchange', 'order_type'],
      buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
    });

    this.portfolioValue = new Gauge({
      name: 'kiro_bot_portfolio_value_usd',
      help: 'Current portfolio value in USD',
      labelNames: ['user_id', 'type']
    });

    this.riskExposure = new Gauge({
      name: 'kiro_bot_risk_exposure_percent',
      help: 'Current risk exposure as percentage of portfolio',
      labelNames: ['user_id']
    });

    // Paper trading specific metrics
    this.paperTradesTotal = new Counter({
      name: 'kiro_bot_paper_trades_total',
      help: 'Total number of paper trades executed',
      labelNames: ['symbol', 'side', 'exchange']
    });

    this.virtualBalanceTotal = new Gauge({
      name: 'kiro_bot_virtual_balance_usd',
      help: 'Virtual balance in USD for paper trading',
      labelNames: ['user_id']
    });

    // Enhanced error metrics
    this.errorTotal = new Counter({
      name: 'kiro_bot_errors_total',
      help: 'Total number of errors',
      labelNames: ['service', 'error_type', 'severity']
    });

    this.exchangeErrors = new Counter({
      name: 'kiro_bot_exchange_errors_total',
      help: 'Total number of exchange API errors',
      labelNames: ['exchange', 'error_code', 'endpoint']
    });

    this.databaseErrors = new Counter({
      name: 'kiro_bot_database_errors_total',
      help: 'Total number of database errors',
      labelNames: ['operation', 'table', 'error_type']
    });

    this.websocketErrors = new Counter({
      name: 'kiro_bot_websocket_errors_total',
      help: 'Total number of WebSocket errors',
      labelNames: ['exchange', 'error_type']
    });

    this.securityEvents = new Counter({
      name: 'kiro_bot_security_events_total',
      help: 'Total number of security events',
      labelNames: ['event_type', 'severity', 'source']
    });

    // Register all metrics
    this.registerMetrics();
    
    // Start monitoring services
    this.startSystemMetricsCollection();
    this.startHealthChecks();
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

  // Register all metrics with Prometheus
  private registerMetrics(): void {
    const metrics = [
      this.httpRequestDuration,
      this.httpRequestTotal,
      this.activeConnections,
      this.systemMemoryUsage,
      this.systemCpuUsage,
      this.systemLoadAverage,
      this.diskUsage,
      this.networkConnections,
      this.tradesExecuted,
      this.signalsGenerated,
      this.orderLatency,
      this.portfolioValue,
      this.riskExposure,
      this.paperTradesTotal,
      this.virtualBalanceTotal,
      this.errorTotal,
      this.exchangeErrors,
      this.databaseErrors,
      this.websocketErrors,
      this.securityEvents
    ];

    metrics.forEach(metric => register.registerMetric(metric));
  }

  // Enhanced system metrics collection
  private startSystemMetricsCollection(): void {
    if (!config.monitoring.metricsEnabled) {
      logger.info('Metrics collection disabled by configuration');
      return;
    }

    const interval = config.monitoring.systemMetricsInterval || 30000;
    this.metricsCollectionInterval = setInterval(() => {
      try {
        this.collectSystemMetrics();
      } catch (error) {
        logger.error('Error collecting system metrics:', error);
        this.recordError('monitoring', 'metrics_collection_failed', 'medium');
      }
    }, interval);
    
    logger.info(`System metrics collection started with ${interval}ms interval`);
  }

  private collectSystemMetrics(): void {
    // Memory metrics
    const memUsage = process.memoryUsage();
    this.systemMemoryUsage.set({ type: 'heap_used' }, memUsage.heapUsed);
    this.systemMemoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal);
    this.systemMemoryUsage.set({ type: 'external' }, memUsage.external);
    this.systemMemoryUsage.set({ type: 'rss' }, memUsage.rss);

    // System memory
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    this.systemMemoryUsage.set({ type: 'system_free' }, freeMem);
    this.systemMemoryUsage.set({ type: 'system_total' }, totalMem);
    this.systemMemoryUsage.set({ type: 'system_used' }, totalMem - freeMem);

    // CPU usage
    const cpuUsage = process.cpuUsage();
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000;
    this.systemCpuUsage.set(cpuPercent);

    // Load average
    const loadAvg = os.loadavg();
    this.systemLoadAverage.set({ period: '1m' }, loadAvg[0]);
    this.systemLoadAverage.set({ period: '5m' }, loadAvg[1]);
    this.systemLoadAverage.set({ period: '15m' }, loadAvg[2]);

    // Disk usage (simplified - would need more sophisticated implementation for production)
    try {
      const stats = fs.statSync('.');
      this.diskUsage.set({ type: 'available' }, stats.size || 0);
    } catch (error) {
      // Ignore disk stats errors for now
    }
  }

  // Health check system
  private startHealthChecks(): void {
    if (!config.monitoring.healthChecksEnabled) {
      logger.info('Health checks disabled by configuration');
      return;
    }

    const interval = config.monitoring.healthCheckInterval || 30000;
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks().catch(error => {
        logger.error('Health check failed:', error);
      });
    }, interval);
    
    logger.info(`Health checks started with ${interval}ms interval`);
  }

  private async performHealthChecks(): Promise<void> {
    const checks = [
      this.checkDatabaseHealth(),
      this.checkRedisHealth(),
      this.checkExchangeHealth(),
      this.checkWebSocketHealth(),
      this.checkFilesystemHealth()
    ];

    const results = await Promise.allSettled(checks);
    
    results.forEach((result, index) => {
      const serviceName = ['database', 'redis', 'exchanges', 'websocket', 'filesystem'][index];
      
      if (result.status === 'fulfilled') {
        this.updateServiceStatus(serviceName, result.value);
      } else {
        this.updateServiceStatus(serviceName, {
          name: serviceName,
          status: 'down',
          lastCheck: Date.now(),
          error: result.reason?.message || 'Unknown error'
        });
      }
    });
  }

  private async checkDatabaseHealth(): Promise<ServiceStatus> {
    const startTime = Date.now();
    try {
      // This would be implemented with actual database connection check
      // For now, simulate a health check
      await new Promise(resolve => setTimeout(resolve, 10));
      
      return {
        name: 'database',
        status: 'up',
        lastCheck: Date.now(),
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'down',
        lastCheck: Date.now(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkRedisHealth(): Promise<ServiceStatus> {
    const startTime = Date.now();
    try {
      // This would be implemented with actual Redis connection check
      await new Promise(resolve => setTimeout(resolve, 5));
      
      return {
        name: 'redis',
        status: 'up',
        lastCheck: Date.now(),
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'redis',
        status: 'down',
        lastCheck: Date.now(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkExchangeHealth(): Promise<ServiceStatus> {
    const startTime = Date.now();
    try {
      // This would check exchange API connectivity
      await new Promise(resolve => setTimeout(resolve, 50));
      
      return {
        name: 'exchanges',
        status: 'up',
        lastCheck: Date.now(),
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'exchanges',
        status: 'down',
        lastCheck: Date.now(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkWebSocketHealth(): Promise<ServiceStatus> {
    const startTime = Date.now();
    try {
      // This would check WebSocket server health
      await new Promise(resolve => setTimeout(resolve, 5));
      
      return {
        name: 'websocket',
        status: 'up',
        lastCheck: Date.now(),
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'websocket',
        status: 'down',
        lastCheck: Date.now(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkFilesystemHealth(): Promise<ServiceStatus> {
    const startTime = Date.now();
    try {
      // Check if we can write to the filesystem
      const testFile = '/tmp/kiro_bot_health_check';
      await promisify(fs.writeFile)(testFile, 'health check');
      await promisify(fs.unlink)(testFile);
      
      return {
        name: 'filesystem',
        status: 'up',
        lastCheck: Date.now(),
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'filesystem',
        status: 'down',
        lastCheck: Date.now(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private updateServiceStatus(serviceName: string, status: ServiceStatus): void {
    const previousStatus = this.serviceStatuses.get(serviceName);
    this.serviceStatuses.set(serviceName, status);

    // Emit events for status changes
    if (previousStatus && previousStatus.status !== status.status) {
      this.emit('service_status_change', {
        service: serviceName,
        previousStatus: previousStatus.status,
        currentStatus: status.status,
        timestamp: Date.now()
      });

      logger.info(`Service ${serviceName} status changed: ${previousStatus.status} -> ${status.status}`);
    }
  }

  // Get comprehensive health status
  public getSystemHealth(): SystemHealth {
    const services = Array.from(this.serviceStatuses.values());
    const allHealthy = services.every(s => s.status === 'up');
    const anyDegraded = services.some(s => s.status === 'degraded');
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (!allHealthy) {
      overallStatus = anyDegraded ? 'degraded' : 'unhealthy';
    }

    // Check system resource health
    const memUsage = process.memoryUsage();
    const memoryHealthy = memUsage.heapUsed < (memUsage.heapTotal * 0.9);
    const cpuHealthy = true; // Would implement actual CPU health check

    return {
      status: overallStatus,
      checks: {
        database: this.serviceStatuses.get('database')?.status === 'up' || false,
        redis: this.serviceStatuses.get('redis')?.status === 'up' || false,
        exchanges: this.serviceStatuses.get('exchanges')?.status === 'up' || false,
        websocket: this.serviceStatuses.get('websocket')?.status === 'up' || false,
        filesystem: this.serviceStatuses.get('filesystem')?.status === 'up' || false,
        memory: memoryHealthy,
        cpu: cpuHealthy
      },
      metrics: {
        uptime: process.uptime(),
        memory: memUsage,
        cpu: process.cpuUsage(),
        loadAverage: os.loadavg(),
        freeMemory: os.freemem(),
        totalMemory: os.totalmem()
      },
      timestamp: Date.now()
    };
  }

  // Get metrics for Prometheus scraping
  public async getMetrics(): Promise<string> {
    return register.metrics();
  }

  // Legacy health check for backward compatibility
  public getHealthStatus(): { status: string; timestamp: number; metrics: any } {
    const systemHealth = this.getSystemHealth();
    return {
      status: systemHealth.status,
      timestamp: systemHealth.timestamp,
      metrics: systemHealth.metrics
    };
  }

  // Get service statuses
  public getServiceStatuses(): ServiceStatus[] {
    return Array.from(this.serviceStatuses.values());
  }

  // Paper trading specific methods
  public recordPaperTrade(symbol: string, side: string, exchange: string): void {
    this.paperTradesTotal.inc({ symbol, side, exchange });
    this.tradesExecuted.inc({ symbol, side, exchange, status: 'executed', type: 'paper' });
  }

  public updateVirtualBalance(userId: string, balance: number): void {
    this.virtualBalanceTotal.set({ user_id: userId }, balance);
    this.portfolioValue.set({ user_id: userId, type: 'virtual' }, balance);
  }

  // Security event tracking
  public recordSecurityEvent(eventType: string, severity: 'low' | 'medium' | 'high' | 'critical', source: string): void {
    this.securityEvents.inc({ event_type: eventType, severity, source });
    
    if (severity === 'critical' || severity === 'high') {
      this.emit('security_alert', {
        eventType,
        severity,
        source,
        timestamp: Date.now()
      });
    }
  }

  // WebSocket error tracking
  public recordWebSocketError(exchange: string, errorType: string): void {
    this.websocketErrors.inc({ exchange, error_type: errorType });
  }

  // Cleanup method
  public stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = null;
    }
  }
}