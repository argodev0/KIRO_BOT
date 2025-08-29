import { EventEmitter } from 'events';
import { register } from 'prom-client';
import * as os from 'os';
import * as fs from 'fs';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import {
  // HTTP Metrics
  httpRequestsTotal,
  httpRequestDuration,
  httpRequestSize,
  httpResponseSize,
  
  // Trading Metrics
  tradingSignalsTotal,
  tradeExecutionsTotal,
  orderLatency,
  portfolioValue,
  activePositions,
  riskExposure,
  profitLoss,
  
  // Paper Trading Metrics
  paperTradesTotal,
  virtualBalanceTotal,
  paperTradingPnL,
  paperTradingWinRate,
  paperTradingDrawdown,
  
  // System Metrics
  databaseConnections,
  databaseQueryDuration,
  redisConnections,
  redisOperationDuration,
  rabbitmqMessages,
  rabbitmqQueueSize,
  
  // Market Data Metrics
  marketDataUpdates,
  marketDataLatency,
  websocketConnections,
  websocketMessages,
  websocketReconnections,
  
  // Technical Analysis Metrics
  technicalIndicatorCalculations,
  technicalIndicatorLatency,
  
  // Error and Security Metrics
  errorsTotal,
  exchangeErrors,
  securityEvents,
  rateLimitHits,
  authenticationAttempts,
  
  // Business Metrics
  activeUsers,
  tradingStrategiesActive,
  apiCallsTotal,
  cacheHitRate,
  systemUptime,
  
  // Resource Metrics
  memoryUsage,
  cpuUsage,
  diskUsage,
  networkIO,
} from '../utils/metrics';

interface MetricsCollectionConfig {
  enabled: boolean;
  interval: number;
  collectSystemMetrics: boolean;
  collectBusinessMetrics: boolean;
  collectTradingMetrics: boolean;
  collectPaperTradingMetrics: boolean;
}

interface SystemResourceMetrics {
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    systemFree: number;
    systemTotal: number;
    systemUsed: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  disk: {
    used: number;
    free: number;
    total: number;
  };
  network: {
    bytesReceived: number;
    bytesSent: number;
  };
}

interface TradingMetrics {
  totalTrades: number;
  totalSignals: number;
  activePositionsCount: number;
  totalPortfolioValue: number;
  averageOrderLatency: number;
  winRate: number;
  totalPnL: number;
}

interface PaperTradingMetrics {
  totalPaperTrades: number;
  virtualBalance: number;
  paperTradingPnL: number;
  paperTradingWinRate: number;
  maxDrawdown: number;
  activeStrategies: number;
}

export class PrometheusMetricsService extends EventEmitter {
  private static instance: PrometheusMetricsService;
  private config: MetricsCollectionConfig;
  private collectionInterval: NodeJS.Timeout | null = null;
  private isCollecting = false;
  private startTime = Date.now();
  
  // Metrics storage for calculations
  private metricsHistory: Map<string, number[]> = new Map();
  private lastNetworkStats = { bytesReceived: 0, bytesSent: 0 };
  private lastCpuUsage = process.cpuUsage();

  private constructor() {
    super();
    
    this.config = {
      enabled: config.monitoring?.metricsEnabled ?? true,
      interval: config.monitoring?.systemMetricsInterval ?? 30000,
      collectSystemMetrics: true,
      collectBusinessMetrics: true,
      collectTradingMetrics: true,
      collectPaperTradingMetrics: true,
    };
  }

  public static getInstance(): PrometheusMetricsService {
    if (!PrometheusMetricsService.instance) {
      PrometheusMetricsService.instance = new PrometheusMetricsService();
    }
    return PrometheusMetricsService.instance;
  }

  /**
   * Start metrics collection
   */
  public start(): void {
    if (!this.config.enabled) {
      logger.info('Prometheus metrics collection disabled by configuration');
      return;
    }

    if (this.isCollecting) {
      logger.warn('Prometheus metrics collection already running');
      return;
    }

    this.isCollecting = true;
    this.startTime = Date.now();
    
    // Initial metrics collection
    this.collectAllMetrics();
    
    // Start periodic collection
    this.collectionInterval = setInterval(() => {
      this.collectAllMetrics();
    }, this.config.interval);

    logger.info(`Prometheus metrics collection started with ${this.config.interval}ms interval`);
    this.emit('started', { interval: this.config.interval });
  }

  /**
   * Stop metrics collection
   */
  public stop(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    
    this.isCollecting = false;
    logger.info('Prometheus metrics collection stopped');
    this.emit('stopped');
  }

  /**
   * Collect all metrics
   */
  private async collectAllMetrics(): Promise<void> {
    try {
      const startTime = Date.now();
      
      if (this.config.collectSystemMetrics) {
        await this.collectSystemMetrics();
      }
      
      if (this.config.collectBusinessMetrics) {
        await this.collectBusinessMetrics();
      }
      
      if (this.config.collectTradingMetrics) {
        await this.collectTradingMetrics();
      }
      
      if (this.config.collectPaperTradingMetrics) {
        await this.collectPaperTradingMetrics();
      }
      
      const duration = Date.now() - startTime;
      logger.debug(`Metrics collection completed in ${duration}ms`);
      
      this.emit('metricsCollected', {
        duration,
        timestamp: Date.now(),
        systemMetrics: this.config.collectSystemMetrics,
        businessMetrics: this.config.collectBusinessMetrics,
        tradingMetrics: this.config.collectTradingMetrics,
        paperTradingMetrics: this.config.collectPaperTradingMetrics,
      });
      
    } catch (error) {
      logger.error('Error collecting metrics:', error);
      errorsTotal.inc({ service: 'metrics', type: 'collection_error', severity: 'medium' });
      this.emit('error', error);
    }
  }

  /**
   * Collect system performance and resource metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      // System uptime
      systemUptime.set(Date.now() - this.startTime);
      
      // Memory metrics
      const memUsage = process.memoryUsage();
      memoryUsage.set({ type: 'heap_used' }, memUsage.heapUsed);
      memoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal);
      memoryUsage.set({ type: 'external' }, memUsage.external);
      memoryUsage.set({ type: 'rss' }, memUsage.rss);
      
      const freeMem = os.freemem();
      const totalMem = os.totalmem();
      memoryUsage.set({ type: 'system_free' }, freeMem);
      memoryUsage.set({ type: 'system_total' }, totalMem);
      memoryUsage.set({ type: 'system_used' }, totalMem - freeMem);
      
      // CPU metrics
      const currentCpuUsage = process.cpuUsage(this.lastCpuUsage);
      const cpuPercent = (currentCpuUsage.user + currentCpuUsage.system) / 1000000;
      cpuUsage.set({ core: 'total' }, cpuPercent);
      this.lastCpuUsage = process.cpuUsage();
      
      // Load average
      const loadAvg = os.loadavg();
      cpuUsage.set({ core: 'load_1m' }, loadAvg[0]);
      cpuUsage.set({ core: 'load_5m' }, loadAvg[1]);
      cpuUsage.set({ core: 'load_15m' }, loadAvg[2]);
      
      // Disk usage (simplified)
      await this.collectDiskMetrics();
      
      // Network I/O (simplified)
      await this.collectNetworkMetrics();
      
    } catch (error) {
      logger.error('Error collecting system metrics:', error);
      errorsTotal.inc({ service: 'metrics', type: 'system_metrics_error', severity: 'low' });
    }
  }

  /**
   * Collect disk usage metrics
   */
  private async collectDiskMetrics(): Promise<void> {
    try {
      const stats = await promisify(fs.stat)('.');
      // This is a simplified implementation
      // In production, you'd want to use a proper disk usage library
      diskUsage.set({ mount_point: '/', type: 'used' }, stats.size || 0);
    } catch (error) {
      // Ignore disk stats errors for now
      logger.debug('Could not collect disk metrics:', error);
    }
  }

  /**
   * Collect network I/O metrics
   */
  private async collectNetworkMetrics(): Promise<void> {
    try {
      // This is a simplified implementation
      // In production, you'd want to read from /proc/net/dev or use a proper library
      const currentTime = Date.now();
      const bytesReceived = Math.floor(Math.random() * 1000000); // Placeholder
      const bytesSent = Math.floor(Math.random() * 1000000); // Placeholder
      
      if (this.lastNetworkStats.bytesReceived > 0) {
        const receivedDelta = bytesReceived - this.lastNetworkStats.bytesReceived;
        const sentDelta = bytesSent - this.lastNetworkStats.bytesSent;
        
        networkIO.inc({ direction: 'received', interface: 'eth0' }, Math.max(0, receivedDelta));
        networkIO.inc({ direction: 'sent', interface: 'eth0' }, Math.max(0, sentDelta));
      }
      
      this.lastNetworkStats = { bytesReceived, bytesSent };
    } catch (error) {
      logger.debug('Could not collect network metrics:', error);
    }
  }

  /**
   * Collect business metrics
   */
  private async collectBusinessMetrics(): Promise<void> {
    try {
      // Active users (would be implemented with actual user tracking)
      const activeUsersCount = await this.getActiveUsersCount();
      activeUsers.set({ period: '1h' }, activeUsersCount.hourly);
      activeUsers.set({ period: '24h' }, activeUsersCount.daily);
      activeUsers.set({ period: '7d' }, activeUsersCount.weekly);
      
      // Active trading strategies
      const activeStrategiesCount = await this.getActiveStrategiesCount();
      tradingStrategiesActive.set({ strategy_type: 'grid' }, activeStrategiesCount.grid);
      tradingStrategiesActive.set({ strategy_type: 'dca' }, activeStrategiesCount.dca);
      tradingStrategiesActive.set({ strategy_type: 'signal' }, activeStrategiesCount.signal);
      
      // Cache hit rates (would be implemented with actual cache statistics)
      const cacheStats = await this.getCacheStatistics();
      cacheHitRate.set({ cache_type: 'redis' }, cacheStats.redis);
      cacheHitRate.set({ cache_type: 'memory' }, cacheStats.memory);
      
    } catch (error) {
      logger.error('Error collecting business metrics:', error);
      errorsTotal.inc({ service: 'metrics', type: 'business_metrics_error', severity: 'low' });
    }
  }

  /**
   * Collect trading-specific metrics
   */
  private async collectTradingMetrics(): Promise<void> {
    try {
      // This would be implemented with actual trading data
      const tradingStats = await this.getTradingStatistics();
      
      // Update portfolio values
      Object.entries(tradingStats.portfolios).forEach(([userId, value]) => {
        portfolioValue.set({ user_id: userId, type: 'real' }, value);
      });
      
      // Update risk exposure
      Object.entries(tradingStats.riskExposures).forEach(([userId, exposure]) => {
        riskExposure.set({ user_id: userId }, exposure);
      });
      
      // Update P&L
      Object.entries(tradingStats.pnl).forEach(([userId, pnl]) => {
        profitLoss.set({ user_id: userId, type: 'realized', period: '24h' }, pnl.realized);
        profitLoss.set({ user_id: userId, type: 'unrealized', period: '24h' }, pnl.unrealized);
      });
      
    } catch (error) {
      logger.error('Error collecting trading metrics:', error);
      errorsTotal.inc({ service: 'metrics', type: 'trading_metrics_error', severity: 'medium' });
    }
  }

  /**
   * Collect paper trading specific metrics
   */
  private async collectPaperTradingMetrics(): Promise<void> {
    try {
      const paperTradingStats = await this.getPaperTradingStatistics();
      
      // Update virtual balances
      Object.entries(paperTradingStats.virtualBalances).forEach(([userId, balance]) => {
        virtualBalanceTotal.set({ user_id: userId, currency: 'USD' }, balance);
      });
      
      // Update paper trading P&L
      Object.entries(paperTradingStats.pnl).forEach(([userId, pnl]) => {
        paperTradingPnL.set({ user_id: userId, period: '24h' }, pnl.daily);
        paperTradingPnL.set({ user_id: userId, period: '7d' }, pnl.weekly);
        paperTradingPnL.set({ user_id: userId, period: '30d' }, pnl.monthly);
      });
      
      // Update win rates
      Object.entries(paperTradingStats.winRates).forEach(([userId, winRate]) => {
        paperTradingWinRate.set({ user_id: userId, strategy: 'all' }, winRate);
      });
      
      // Update drawdowns
      Object.entries(paperTradingStats.drawdowns).forEach(([userId, drawdown]) => {
        paperTradingDrawdown.set({ user_id: userId }, drawdown);
      });
      
    } catch (error) {
      logger.error('Error collecting paper trading metrics:', error);
      errorsTotal.inc({ service: 'metrics', type: 'paper_trading_metrics_error', severity: 'low' });
    }
  }

  // HTTP Metrics Recording Methods
  public recordHttpRequest(method: string, route: string, statusCode: number, duration: number, requestSize?: number, responseSize?: number): void {
    httpRequestsTotal.inc({ method, route, status_code: statusCode.toString() });
    httpRequestDuration.observe({ method, route, status_code: statusCode.toString() }, duration);
    
    if (requestSize !== undefined) {
      httpRequestSize.observe({ method, route }, requestSize);
    }
    
    if (responseSize !== undefined) {
      httpResponseSize.observe({ method, route, status_code: statusCode.toString() }, responseSize);
    }
  }

  // Trading Metrics Recording Methods
  public recordTradingSignal(symbol: string, direction: string, status: string, strategy: string, confidence: number): void {
    const confidenceLevel = confidence >= 0.8 ? 'high' : confidence >= 0.6 ? 'medium' : 'low';
    tradingSignalsTotal.inc({ symbol, direction, status, strategy, confidence_level: confidenceLevel });
  }

  public recordTradeExecution(symbol: string, side: string, exchange: string, type: string, status: string): void {
    tradeExecutionsTotal.inc({ symbol, side, exchange, type, status });
  }

  public recordOrderLatency(exchange: string, orderType: string, symbol: string, latency: number): void {
    orderLatency.observe({ exchange, order_type: orderType, symbol }, latency);
  }

  // Paper Trading Metrics Recording Methods
  public recordPaperTrade(symbol: string, side: string, exchange: string, strategy: string): void {
    paperTradesTotal.inc({ symbol, side, exchange, strategy });
  }

  // Market Data Metrics Recording Methods
  public recordMarketDataUpdate(symbol: string, exchange: string, timeframe: string, type: string): void {
    marketDataUpdates.inc({ symbol, exchange, timeframe, type });
  }

  public recordMarketDataLatency(exchange: string, symbol: string, latency: number): void {
    marketDataLatency.observe({ exchange, symbol }, latency);
  }

  // WebSocket Metrics Recording Methods
  public recordWebSocketMessage(exchange: string, direction: string, type: string): void {
    websocketMessages.inc({ exchange, direction, type });
  }

  public recordWebSocketReconnection(exchange: string, reason: string): void {
    websocketReconnections.inc({ exchange, reason });
  }

  // Technical Analysis Metrics Recording Methods
  public recordTechnicalIndicatorCalculation(indicator: string, symbol: string, timeframe: string): void {
    technicalIndicatorCalculations.inc({ indicator, symbol, timeframe });
  }

  public recordTechnicalIndicatorLatency(indicator: string, symbol: string, latency: number): void {
    technicalIndicatorLatency.observe({ indicator, symbol }, latency);
  }

  // Error and Security Metrics Recording Methods
  public recordError(service: string, type: string, severity: string): void {
    errorsTotal.inc({ service, type, severity });
  }

  public recordExchangeError(exchange: string, errorCode: string, endpoint: string): void {
    exchangeErrors.inc({ exchange, error_code: errorCode, endpoint });
  }

  public recordSecurityEvent(eventType: string, severity: string, source: string): void {
    securityEvents.inc({ event_type: eventType, severity, source });
  }

  public recordRateLimitHit(endpoint: string, ip: string, userId?: string): void {
    rateLimitHits.inc({ endpoint, ip, user_id: userId || 'anonymous' });
  }

  public recordAuthenticationAttempt(method: string, status: string, source: string): void {
    authenticationAttempts.inc({ method, status, source });
  }

  // Database Metrics Recording Methods
  public recordDatabaseQuery(operation: string, table: string, status: string, duration: number): void {
    databaseQueryDuration.observe({ operation, table, status }, duration);
  }

  public updateDatabaseConnections(database: string, state: string, count: number): void {
    databaseConnections.set({ database, state }, count);
  }

  // Redis Metrics Recording Methods
  public recordRedisOperation(operation: string, status: string, duration: number): void {
    redisOperationDuration.observe({ operation, status }, duration);
  }

  public updateRedisConnections(instance: string, state: string, count: number): void {
    redisConnections.set({ instance, state }, count);
  }

  // RabbitMQ Metrics Recording Methods
  public recordRabbitMQMessage(queue: string, status: string, operation: string): void {
    rabbitmqMessages.inc({ queue, status, operation });
  }

  public updateRabbitMQQueueSize(queue: string, size: number): void {
    rabbitmqQueueSize.set({ queue }, size);
  }

  // WebSocket Connection Tracking
  public updateWebSocketConnections(exchange: string, type: string, status: string, count: number): void {
    websocketConnections.set({ exchange, type, status }, count);
  }

  /**
   * Get Prometheus metrics
   */
  public async getMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * Get metrics registry
   */
  public getRegistry() {
    return register;
  }

  /**
   * Get collection status
   */
  public getStatus() {
    return {
      isCollecting: this.isCollecting,
      config: this.config,
      startTime: this.startTime,
      uptime: Date.now() - this.startTime,
    };
  }

  // Helper methods for data collection (these would be implemented with actual data sources)
  private async getActiveUsersCount(): Promise<{ hourly: number; daily: number; weekly: number }> {
    // This would be implemented with actual user tracking
    return {
      hourly: Math.floor(Math.random() * 100),
      daily: Math.floor(Math.random() * 500),
      weekly: Math.floor(Math.random() * 2000),
    };
  }

  private async getActiveStrategiesCount(): Promise<{ grid: number; dca: number; signal: number }> {
    // This would be implemented with actual strategy tracking
    return {
      grid: Math.floor(Math.random() * 50),
      dca: Math.floor(Math.random() * 30),
      signal: Math.floor(Math.random() * 20),
    };
  }

  private async getCacheStatistics(): Promise<{ redis: number; memory: number }> {
    // This would be implemented with actual cache statistics
    return {
      redis: Math.random() * 100,
      memory: Math.random() * 100,
    };
  }

  private async getTradingStatistics(): Promise<{
    portfolios: Record<string, number>;
    riskExposures: Record<string, number>;
    pnl: Record<string, { realized: number; unrealized: number }>;
  }> {
    // This would be implemented with actual trading data
    return {
      portfolios: {
        'user1': 10000 + Math.random() * 5000,
        'user2': 25000 + Math.random() * 10000,
      },
      riskExposures: {
        'user1': Math.random() * 50,
        'user2': Math.random() * 30,
      },
      pnl: {
        'user1': { realized: Math.random() * 1000 - 500, unrealized: Math.random() * 500 - 250 },
        'user2': { realized: Math.random() * 2000 - 1000, unrealized: Math.random() * 1000 - 500 },
      },
    };
  }

  private async getPaperTradingStatistics(): Promise<{
    virtualBalances: Record<string, number>;
    pnl: Record<string, { daily: number; weekly: number; monthly: number }>;
    winRates: Record<string, number>;
    drawdowns: Record<string, number>;
  }> {
    // This would be implemented with actual paper trading data
    return {
      virtualBalances: {
        'user1': 100000 + Math.random() * 20000,
        'user2': 50000 + Math.random() * 10000,
      },
      pnl: {
        'user1': { 
          daily: Math.random() * 2000 - 1000, 
          weekly: Math.random() * 5000 - 2500, 
          monthly: Math.random() * 10000 - 5000 
        },
        'user2': { 
          daily: Math.random() * 1000 - 500, 
          weekly: Math.random() * 2500 - 1250, 
          monthly: Math.random() * 5000 - 2500 
        },
      },
      winRates: {
        'user1': 55 + Math.random() * 20,
        'user2': 60 + Math.random() * 15,
      },
      drawdowns: {
        'user1': Math.random() * 15,
        'user2': Math.random() * 10,
      },
    };
  }
}