import { Counter, Gauge, Histogram, register } from 'prom-client';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

interface ExchangeConnectionStatus {
  exchange: string;
  connected: boolean;
  lastUpdate: number;
  latency: number;
  errorCount: number;
  reconnectCount: number;
}

interface DataFeedHealth {
  totalConnections: number;
  activeConnections: number;
  averageLatency: number;
  updateRate: number;
  errorRate: number;
  lastHealthCheck: number;
}

export class RealTimeDataMonitor extends EventEmitter {
  private static instance: RealTimeDataMonitor;
  
  // Exchange Connection Metrics
  private readonly exchangeConnectionStatus: Gauge<string>;
  private readonly marketDataLatency: Gauge<string>;
  private readonly marketDataUpdates: Counter<string>;
  private readonly marketDataErrors: Counter<string>;
  private readonly exchangeReconnections: Counter<string>;
  private readonly exchangeApiRateLimitHits: Counter<string>;
  private readonly exchangeApiRateLimitUsage: Gauge<string>;
  
  // WebSocket Metrics
  private readonly websocketConnectionsActive: Gauge<string>;
  private readonly websocketMessagesSent: Counter<string>;
  private readonly websocketMessagesReceived: Counter<string>;
  private readonly websocketConnectionDrops: Counter<string>;
  private readonly websocketConnectionErrors: Counter<string>;
  private readonly websocketServerStatus: Gauge<string>;
  
  // Data Processing Metrics
  private readonly marketDataProcessingDelay: Gauge<string>;
  private readonly marketDataBufferOverflow: Counter<string>;
  private readonly marketDataGaps: Counter<string>;
  private readonly marketDataLastUpdateTimestamp: Gauge<string>;
  private readonly activeMarketDataSubscriptions: Gauge<string>;
  
  // Performance Metrics
  private readonly signalGenerationDuration: Histogram<string>;
  private readonly dataProcessingThroughput: Gauge<string>;
  
  // Price Data Metrics (for consistency checking)
  private readonly binancePrice: Gauge<string>;
  private readonly kucoinPrice: Gauge<string>;
  
  // Connection status tracking
  private connectionStatuses: Map<string, ExchangeConnectionStatus> = new Map();
  private dataFeedHealth: DataFeedHealth;
  private monitoringInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    
    // Initialize exchange connection metrics
    this.exchangeConnectionStatus = new Gauge({
      name: 'exchange_connection_status',
      help: 'Exchange connection status (1 = connected, 0 = disconnected)',
      labelNames: ['exchange']
    });

    this.marketDataLatency = new Gauge({
      name: 'market_data_latency_ms',
      help: 'Market data latency in milliseconds',
      labelNames: ['exchange']
    });

    this.marketDataUpdates = new Counter({
      name: 'market_data_updates_total',
      help: 'Total number of market data updates received',
      labelNames: ['exchange', 'symbol', 'type']
    });

    this.marketDataErrors = new Counter({
      name: 'market_data_errors_total',
      help: 'Total number of market data errors',
      labelNames: ['exchange', 'error_type']
    });

    this.exchangeReconnections = new Counter({
      name: 'exchange_reconnections_total',
      help: 'Total number of exchange reconnections',
      labelNames: ['exchange', 'reason']
    });

    this.exchangeApiRateLimitHits = new Counter({
      name: 'exchange_api_rate_limit_hits_total',
      help: 'Total number of API rate limit hits',
      labelNames: ['exchange', 'endpoint']
    });

    this.exchangeApiRateLimitUsage = new Gauge({
      name: 'exchange_api_rate_limit_usage',
      help: 'Current API rate limit usage (0-1)',
      labelNames: ['exchange']
    });

    // Initialize WebSocket metrics
    this.websocketConnectionsActive = new Gauge({
      name: 'websocket_connections_active',
      help: 'Number of active WebSocket connections'
    });

    this.websocketMessagesSent = new Counter({
      name: 'websocket_messages_sent_total',
      help: 'Total number of WebSocket messages sent',
      labelNames: ['message_type']
    });

    this.websocketMessagesReceived = new Counter({
      name: 'websocket_messages_received_total',
      help: 'Total number of WebSocket messages received',
      labelNames: ['exchange', 'message_type']
    });

    this.websocketConnectionDrops = new Counter({
      name: 'websocket_connection_drops_total',
      help: 'Total number of WebSocket connection drops',
      labelNames: ['exchange', 'reason']
    });

    this.websocketConnectionErrors = new Counter({
      name: 'websocket_connection_errors_total',
      help: 'Total number of WebSocket connection errors',
      labelNames: ['exchange', 'error_type']
    });

    this.websocketServerStatus = new Gauge({
      name: 'websocket_server_status',
      help: 'WebSocket server status (1 = running, 0 = stopped)'
    });

    // Initialize data processing metrics
    this.marketDataProcessingDelay = new Gauge({
      name: 'market_data_processing_delay_ms',
      help: 'Market data processing delay in milliseconds'
    });

    this.marketDataBufferOverflow = new Counter({
      name: 'market_data_buffer_overflow_total',
      help: 'Total number of market data buffer overflow events'
    });

    this.marketDataGaps = new Counter({
      name: 'market_data_gaps_total',
      help: 'Total number of market data gaps detected',
      labelNames: ['exchange', 'symbol']
    });

    this.marketDataLastUpdateTimestamp = new Gauge({
      name: 'market_data_last_update_timestamp',
      help: 'Timestamp of last market data update'
    });

    this.activeMarketDataSubscriptions = new Gauge({
      name: 'active_market_data_subscriptions',
      help: 'Number of active market data subscriptions'
    });

    // Initialize performance metrics
    this.signalGenerationDuration = new Histogram({
      name: 'signal_generation_duration_seconds',
      help: 'Time taken to generate trading signals',
      labelNames: ['strategy', 'symbol'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
    });

    this.dataProcessingThroughput = new Gauge({
      name: 'data_processing_throughput_per_second',
      help: 'Data processing throughput per second'
    });

    // Initialize price data metrics
    this.binancePrice = new Gauge({
      name: 'binance_price',
      help: 'Current price from Binance',
      labelNames: ['symbol']
    });

    this.kucoinPrice = new Gauge({
      name: 'kucoin_price',
      help: 'Current price from KuCoin',
      labelNames: ['symbol']
    });

    // Initialize data feed health
    this.dataFeedHealth = {
      totalConnections: 0,
      activeConnections: 0,
      averageLatency: 0,
      updateRate: 0,
      errorRate: 0,
      lastHealthCheck: Date.now()
    };

    // Register metrics
    this.registerMetrics();
    
    // Start monitoring
    this.startMonitoring();
    
    // Set initial WebSocket server status
    this.setWebSocketServerStatus(true);
  }

  public static getInstance(): RealTimeDataMonitor {
    if (!RealTimeDataMonitor.instance) {
      RealTimeDataMonitor.instance = new RealTimeDataMonitor();
    }
    return RealTimeDataMonitor.instance;
  }

  private registerMetrics(): void {
    const metrics = [
      this.exchangeConnectionStatus,
      this.marketDataLatency,
      this.marketDataUpdates,
      this.marketDataErrors,
      this.exchangeReconnections,
      this.exchangeApiRateLimitHits,
      this.exchangeApiRateLimitUsage,
      this.websocketConnectionsActive,
      this.websocketMessagesSent,
      this.websocketMessagesReceived,
      this.websocketConnectionDrops,
      this.websocketConnectionErrors,
      this.websocketServerStatus,
      this.marketDataProcessingDelay,
      this.marketDataBufferOverflow,
      this.marketDataGaps,
      this.marketDataLastUpdateTimestamp,
      this.activeMarketDataSubscriptions,
      this.signalGenerationDuration,
      this.dataProcessingThroughput,
      this.binancePrice,
      this.kucoinPrice
    ];

    metrics.forEach(metric => register.registerMetric(metric));
  }

  // Exchange Connection Management
  public setExchangeConnectionStatus(exchange: string, connected: boolean, latency?: number): void {
    const status = this.connectionStatuses.get(exchange) || {
      exchange,
      connected: false,
      lastUpdate: 0,
      latency: 0,
      errorCount: 0,
      reconnectCount: 0
    };

    const wasConnected = status.connected;
    status.connected = connected;
    status.lastUpdate = Date.now();
    
    if (latency !== undefined) {
      status.latency = latency;
      this.marketDataLatency.set({ exchange }, latency);
    }

    this.connectionStatuses.set(exchange, status);
    this.exchangeConnectionStatus.set({ exchange }, connected ? 1 : 0);

    // Emit connection status change events
    if (wasConnected !== connected) {
      if (connected) {
        this.emit('exchange_connected', { exchange, timestamp: Date.now() });
        logger.info(`Exchange ${exchange} connected`);
      } else {
        this.emit('exchange_disconnected', { exchange, timestamp: Date.now() });
        logger.warn(`Exchange ${exchange} disconnected`);
      }
    }
  }

  public recordExchangeReconnection(exchange: string, reason: string): void {
    this.exchangeReconnections.inc({ exchange, reason });
    
    const status = this.connectionStatuses.get(exchange);
    if (status) {
      status.reconnectCount++;
    }

    this.emit('exchange_reconnection', { exchange, reason, timestamp: Date.now() });
    logger.info(`Exchange ${exchange} reconnected: ${reason}`);
  }

  // Market Data Updates
  public recordMarketDataUpdate(exchange: string, symbol: string, type: string, latency?: number): void {
    this.marketDataUpdates.inc({ exchange, symbol, type });
    this.marketDataLastUpdateTimestamp.set(Date.now());
    
    if (latency !== undefined) {
      this.marketDataLatency.set({ exchange }, latency);
    }
  }

  public recordMarketDataError(exchange: string, errorType: string): void {
    this.marketDataErrors.inc({ exchange, error_type: errorType });
    
    const status = this.connectionStatuses.get(exchange);
    if (status) {
      status.errorCount++;
    }

    this.emit('market_data_error', { exchange, errorType, timestamp: Date.now() });
    logger.warn(`Market data error on ${exchange}: ${errorType}`);
  }

  public recordMarketDataGap(exchange: string, symbol: string): void {
    this.marketDataGaps.inc({ exchange, symbol });
    
    this.emit('market_data_gap', { exchange, symbol, timestamp: Date.now() });
    logger.warn(`Market data gap detected: ${exchange} ${symbol}`);
  }

  // API Rate Limiting
  public recordApiRateLimitHit(exchange: string, endpoint: string): void {
    this.exchangeApiRateLimitHits.inc({ exchange, endpoint });
    
    this.emit('api_rate_limit_hit', { exchange, endpoint, timestamp: Date.now() });
    logger.warn(`API rate limit hit: ${exchange} ${endpoint}`);
  }

  public updateApiRateLimitUsage(exchange: string, usage: number): void {
    this.exchangeApiRateLimitUsage.set({ exchange }, usage);
    
    if (usage > 0.8) {
      this.emit('api_rate_limit_warning', { exchange, usage, timestamp: Date.now() });
    }
  }

  // WebSocket Management
  public setWebSocketServerStatus(running: boolean): void {
    this.websocketServerStatus.set(running ? 1 : 0);
    
    if (running) {
      logger.info('WebSocket server is running');
    } else {
      logger.error('WebSocket server is stopped');
      this.emit('websocket_server_down', { timestamp: Date.now() });
    }
  }

  public updateActiveWebSocketConnections(count: number): void {
    this.websocketConnectionsActive.set(count);
    this.dataFeedHealth.activeConnections = count;
  }

  public recordWebSocketMessage(type: 'sent' | 'received', messageType: string, exchange?: string): void {
    if (type === 'sent') {
      this.websocketMessagesSent.inc({ message_type: messageType });
    } else {
      this.websocketMessagesReceived.inc({ exchange: exchange || 'unknown', message_type: messageType });
    }
  }

  public recordWebSocketConnectionDrop(exchange: string, reason: string): void {
    this.websocketConnectionDrops.inc({ exchange, reason });
    
    this.emit('websocket_connection_drop', { exchange, reason, timestamp: Date.now() });
    logger.warn(`WebSocket connection dropped: ${exchange} - ${reason}`);
  }

  public recordWebSocketError(exchange: string, errorType: string): void {
    this.websocketConnectionErrors.inc({ exchange, error_type: errorType });
    
    this.emit('websocket_error', { exchange, errorType, timestamp: Date.now() });
    logger.error(`WebSocket error: ${exchange} - ${errorType}`);
  }

  // Data Processing
  public recordProcessingDelay(delayMs: number): void {
    this.marketDataProcessingDelay.set(delayMs);
    
    if (delayMs > 1000) {
      this.emit('high_processing_delay', { delay: delayMs, timestamp: Date.now() });
    }
  }

  public recordBufferOverflow(): void {
    this.marketDataBufferOverflow.inc();
    
    this.emit('buffer_overflow', { timestamp: Date.now() });
    logger.error('Market data buffer overflow detected');
  }

  public updateActiveSubscriptions(count: number): void {
    this.activeMarketDataSubscriptions.set(count);
  }

  public updateDataProcessingThroughput(throughput: number): void {
    this.dataProcessingThroughput.set(throughput);
  }

  // Signal Generation Performance
  public recordSignalGenerationTime(strategy: string, symbol: string, durationSeconds: number): void {
    this.signalGenerationDuration.observe({ strategy, symbol }, durationSeconds);
  }

  // Price Data (for consistency checking)
  public updateBinancePrice(symbol: string, price: number): void {
    this.binancePrice.set({ symbol }, price);
  }

  public updateKuCoinPrice(symbol: string, price: number): void {
    this.kucoinPrice.set({ symbol }, price);
  }

  // Health Monitoring
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Check every 30 seconds
    
    logger.info('Real-time data monitoring started');
  }

  private performHealthCheck(): void {
    this.dataFeedHealth.lastHealthCheck = Date.now();
    
    // Calculate average latency
    const latencies = Array.from(this.connectionStatuses.values()).map(s => s.latency);
    this.dataFeedHealth.averageLatency = latencies.length > 0 
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
      : 0;
    
    // Count active connections
    const activeConnections = Array.from(this.connectionStatuses.values()).filter(s => s.connected).length;
    this.dataFeedHealth.activeConnections = activeConnections;
    this.dataFeedHealth.totalConnections = this.connectionStatuses.size;
    
    // Check for stale connections
    const now = Date.now();
    for (const [exchange, status] of this.connectionStatuses) {
      if (status.connected && (now - status.lastUpdate) > 300000) { // 5 minutes
        this.emit('stale_connection', { exchange, lastUpdate: status.lastUpdate, timestamp: now });
        logger.warn(`Stale connection detected for ${exchange}`);
      }
    }
    
    // Emit health status
    this.emit('health_check', {
      health: this.dataFeedHealth,
      timestamp: now
    });
  }

  // Status Getters
  public getConnectionStatuses(): ExchangeConnectionStatus[] {
    return Array.from(this.connectionStatuses.values());
  }

  public getDataFeedHealth(): DataFeedHealth {
    return { ...this.dataFeedHealth };
  }

  public getExchangeConnectionStatus(exchange: string): ExchangeConnectionStatus | undefined {
    return this.connectionStatuses.get(exchange);
  }

  public isExchangeConnected(exchange: string): boolean {
    const status = this.connectionStatuses.get(exchange);
    return status ? status.connected : false;
  }

  public getAllExchangesConnected(): boolean {
    return Array.from(this.connectionStatuses.values()).every(s => s.connected);
  }

  public getAverageLatency(): number {
    return this.dataFeedHealth.averageLatency;
  }

  // Cleanup
  public stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    logger.info('Real-time data monitoring stopped');
  }
}