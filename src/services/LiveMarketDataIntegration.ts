/**
 * Live Market Data Integration Service
 * 
 * This service integrates all market data components and ensures proper
 * data flow from exchanges to frontend through WebSocket connections,
 * caching, and real-time updates.
 */

import { EventEmitter } from 'events';
import { BinanceWebSocketService } from './BinanceWebSocketService';
import { KuCoinWebSocketService } from './KuCoinWebSocketService';
import { MarketDataCacheService } from './MarketDataCacheService';
import { TechnicalIndicatorEngine } from './TechnicalIndicatorEngine';
import { WebSocketServer } from './WebSocketServer';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { CandleData, TickerData, OrderBookData, TradeData, Timeframe } from '../types/market';

export interface LiveMarketDataConfig {
  exchanges: {
    binance: {
      enabled: boolean;
      symbols: string[];
      timeframes: Timeframe[];
    };
    kucoin: {
      enabled: boolean;
      symbols: string[];
      timeframes: Timeframe[];
    };
  };
  cache: {
    enabled: boolean;
    redis: {
      host: string;
      port: number;
      password?: string;
      db: number;
    };
    ttl: {
      ticker: number;
      candle: number;
      orderbook: number;
      aggregated: number;
    };
  };
  websocket: {
    enabled: boolean;
    broadcastChannels: string[];
  };
  indicators: {
    enabled: boolean;
    symbols: string[];
    timeframes: Timeframe[];
  };
}

export interface MarketDataStats {
  exchanges: {
    binance: {
      connected: boolean;
      subscriptions: number;
      lastDataReceived: number;
      dataRate: number;
    };
    kucoin: {
      connected: boolean;
      subscriptions: number;
      lastDataReceived: number;
      dataRate: number;
    };
  };
  cache: {
    totalKeys: number;
    hitRate: number;
    memoryUsage: number;
  };
  websocket: {
    connections: number;
    broadcasts: number;
    channels: string[];
  };
  indicators: {
    symbols: number;
    calculations: number;
    lastUpdate: number;
  };
  overall: {
    dataFlowing: boolean;
    healthScore: number;
    uptime: number;
  };
}

export class LiveMarketDataIntegration extends EventEmitter {
  private config: LiveMarketDataConfig;
  private isRunning: boolean = false;
  private startTime: number = 0;
  
  // Service instances
  private binanceService?: BinanceWebSocketService;
  private kucoinService?: KuCoinWebSocketService;
  private cacheService?: MarketDataCacheService;
  private indicatorEngine?: TechnicalIndicatorEngine;
  private wsServer?: WebSocketServer;
  
  // Data tracking
  private dataStats = {
    binance: { received: 0, lastReceived: 0 },
    kucoin: { received: 0, lastReceived: 0 },
    cache: { hits: 0, misses: 0 },
    websocket: { broadcasts: 0 },
    indicators: { calculations: 0, lastUpdate: 0 }
  };
  
  // Monitoring
  private healthCheckInterval?: NodeJS.Timeout;
  private statsInterval?: NodeJS.Timeout;

  constructor(config: LiveMarketDataConfig) {
    super();
    this.config = config;
  }

  /**
   * Start the live market data integration
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('LiveMarketDataIntegration is already running');
      return;
    }

    try {
      logger.info('🚀 Starting Live Market Data Integration...');
      this.startTime = Date.now();
      
      // Validate paper trading mode
      this.validatePaperTradingMode();
      
      // Initialize services in order
      await this.initializeCacheService();
      await this.initializeExchangeServices();
      await this.initializeIndicatorEngine();
      await this.initializeWebSocketIntegration();
      
      // Start monitoring
      this.startMonitoring();
      
      // Subscribe to market data
      await this.subscribeToMarketData();
      
      this.isRunning = true;
      this.emit('started');
      
      logger.info('✅ Live Market Data Integration started successfully');
      
    } catch (error) {
      logger.error('❌ Failed to start LiveMarketDataIntegration:', error);
      await this.stop(); // Cleanup on failure
      throw error;
    }
  }

  /**
   * Stop the integration
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info('🛑 Stopping Live Market Data Integration...');
      
      // Stop monitoring
      this.stopMonitoring();
      
      // Stop services
      if (this.binanceService) {
        await this.binanceService.stop();
      }
      
      if (this.kucoinService) {
        await this.kucoinService.stop();
      }
      
      if (this.cacheService) {
        await this.cacheService.stop();
      }
      
      if (this.indicatorEngine) {
        await this.indicatorEngine.stop();
      }
      
      this.isRunning = false;
      this.emit('stopped');
      
      logger.info('✅ Live Market Data Integration stopped');
      
    } catch (error) {
      logger.error('❌ Error stopping LiveMarketDataIntegration:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive statistics
   */
  getStats(): MarketDataStats {
    const now = Date.now();
    
    return {
      exchanges: {
        binance: {
          connected: this.binanceService?.isHealthy() || false,
          subscriptions: this.binanceService?.getConnectionStats().totalConnections || 0,
          lastDataReceived: this.dataStats.binance.lastReceived,
          dataRate: this.calculateDataRate('binance')
        },
        kucoin: {
          connected: this.kucoinService?.isHealthy() || false,
          subscriptions: this.kucoinService?.getConnectionStats().totalConnections || 0,
          lastDataReceived: this.dataStats.kucoin.lastReceived,
          dataRate: this.calculateDataRate('kucoin')
        }
      },
      cache: {
        totalKeys: this.cacheService?.getCacheStats().totalKeys || 0,
        hitRate: this.cacheService?.getCacheStats().hitRate || 0,
        memoryUsage: this.cacheService?.getCacheStats().memoryUsage || 0
      },
      websocket: {
        connections: this.wsServer?.getConnectionCount() || 0,
        broadcasts: this.dataStats.websocket.broadcasts,
        channels: this.config.websocket.broadcastChannels
      },
      indicators: {
        symbols: this.config.indicators.symbols.length,
        calculations: this.dataStats.indicators.calculations,
        lastUpdate: this.dataStats.indicators.lastUpdate
      },
      overall: {
        dataFlowing: this.isDataFlowing(),
        healthScore: this.calculateHealthScore(),
        uptime: now - this.startTime
      }
    };
  }

  /**
   * Check if the integration is healthy
   */
  isHealthy(): boolean {
    if (!this.isRunning) {
      return false;
    }
    
    const healthScore = this.calculateHealthScore();
    return healthScore >= 80; // 80% threshold
  }

  /**
   * Get available symbols
   */
  getAvailableSymbols(): string[] {
    const symbols = new Set<string>();
    
    if (this.config.exchanges.binance.enabled) {
      this.config.exchanges.binance.symbols.forEach(symbol => symbols.add(symbol));
    }
    
    if (this.config.exchanges.kucoin.enabled) {
      this.config.exchanges.kucoin.symbols.forEach(symbol => symbols.add(symbol));
    }
    
    return Array.from(symbols);
  }

  /**
   * Subscribe to additional symbol
   */
  async subscribeToSymbol(symbol: string, timeframes?: Timeframe[]): Promise<void> {
    const targetTimeframes = timeframes || this.config.exchanges.binance.timeframes;
    
    try {
      if (this.binanceService && this.config.exchanges.binance.enabled) {
        await this.binanceService.subscribeToSymbolComplete(symbol, targetTimeframes);
      }
      
      if (this.kucoinService && this.config.exchanges.kucoin.enabled) {
        await this.kucoinService.subscribeToSymbolComplete(symbol, targetTimeframes);
      }
      
      logger.info(`✅ Subscribed to ${symbol} on available exchanges`);
      this.emit('symbolSubscribed', { symbol, timeframes: targetTimeframes });
      
    } catch (error) {
      logger.error(`❌ Failed to subscribe to ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe from symbol
   */
  async unsubscribeFromSymbol(symbol: string): Promise<void> {
    try {
      if (this.binanceService) {
        await this.binanceService.unsubscribeFromSymbol(symbol);
      }
      
      if (this.kucoinService) {
        await this.kucoinService.unsubscribeFromSymbol(symbol);
      }
      
      logger.info(`✅ Unsubscribed from ${symbol} on all exchanges`);
      this.emit('symbolUnsubscribed', { symbol });
      
    } catch (error) {
      logger.error(`❌ Failed to unsubscribe from ${symbol}:`, error);
      throw error;
    }
  }

  // Private methods

  private validatePaperTradingMode(): void {
    if (!config.paperTrading.enabled) {
      throw new Error('SECURITY: Paper trading mode must be enabled for live market data');
    }
    
    if (config.paperTrading.allowRealTrades) {
      throw new Error('SECURITY: Real trades must be disabled when using live market data');
    }
    
    logger.info('✅ Paper trading mode validation passed');
  }

  private async initializeCacheService(): Promise<void> {
    if (!this.config.cache.enabled) {
      logger.info('📦 Cache service disabled');
      return;
    }
    
    logger.info('📦 Initializing cache service...');
    
    this.cacheService = new MarketDataCacheService({
      redis: this.config.cache.redis,
      ttl: this.config.cache.ttl,
      aggregation: {
        enabled: true,
        timeframes: ['1m', '5m', '15m', '1h'],
        batchSize: 100,
        flushInterval: 5000
      },
      persistence: {
        enabled: true,
        batchSize: 50,
        flushInterval: 10000,
        retentionDays: 30
      }
    });
    
    await this.cacheService.start();
    
    // Set up cache event handlers
    this.cacheService.on('cached', (data) => {
      this.dataStats.cache.hits++;
      this.emit('dataCached', data);
    });
    
    this.cacheService.on('error', (error) => {
      logger.error('Cache service error:', error);
      this.emit('cacheError', error);
    });
    
    logger.info('✅ Cache service initialized');
  }

  private async initializeExchangeServices(): Promise<void> {
    // Initialize Binance service
    if (this.config.exchanges.binance.enabled) {
      logger.info('🟡 Initializing Binance WebSocket service...');
      
      this.binanceService = new BinanceWebSocketService({
        majorTradingPairs: this.config.exchanges.binance.symbols,
        defaultTimeframes: this.config.exchanges.binance.timeframes
      });
      
      await this.binanceService.start();
      this.setupBinanceEventHandlers();
      
      logger.info('✅ Binance WebSocket service initialized');
    }
    
    // Initialize KuCoin service
    if (this.config.exchanges.kucoin.enabled) {
      logger.info('🟢 Initializing KuCoin WebSocket service...');
      
      this.kucoinService = new KuCoinWebSocketService({
        majorTradingPairs: this.config.exchanges.kucoin.symbols,
        defaultTimeframes: this.config.exchanges.kucoin.timeframes
      });
      
      await this.kucoinService.start();
      this.setupKuCoinEventHandlers();
      
      logger.info('✅ KuCoin WebSocket service initialized');
    }
  }

  private async initializeIndicatorEngine(): Promise<void> {
    if (!this.config.indicators.enabled) {
      logger.info('📊 Technical indicators disabled');
      return;
    }
    
    logger.info('📊 Initializing technical indicator engine...');
    
    this.indicatorEngine = new TechnicalIndicatorEngine({
      symbols: this.config.indicators.symbols,
      timeframes: this.config.indicators.timeframes,
      indicators: ['rsi', 'macd', 'bollinger', 'sma', 'ema'],
      updateInterval: 5000, // 5 seconds
      cacheResults: true
    });
    
    await this.indicatorEngine.start();
    
    // Set up indicator event handlers
    this.indicatorEngine.on('indicatorsCalculated', (data) => {
      this.dataStats.indicators.calculations++;
      this.dataStats.indicators.lastUpdate = Date.now();
      this.emit('indicatorsUpdated', data);
      
      // Broadcast to WebSocket clients
      if (this.wsServer) {
        if (this.wsServer && typeof this.wsServer.broadcast === 'function') {
          this.wsServer.broadcast(`indicators:${data.symbol}`, {
          type: 'indicators',
          symbol: data.symbol,
          timeframe: data.timeframe,
          indicators: data.indicators,
          timestamp: Date.now()
        });
        this.dataStats.websocket.broadcasts++;
        }
      }
    });
    
    logger.info('✅ Technical indicator engine initialized');
  }

  private async initializeWebSocketIntegration(): Promise<void> {
    if (!this.config.websocket.enabled || !this.wsServer) {
      logger.info('🔌 WebSocket integration disabled or server not available');
      return;
    }
    
    logger.info('🔌 Setting up WebSocket integration...');
    
    // WebSocket integration is handled through event handlers
    // The WebSocket server should already be initialized in the main application
    
    logger.info('✅ WebSocket integration ready');
  }

  private setupBinanceEventHandlers(): void {
    if (!this.binanceService) return;
    
    this.binanceService.on('ticker', (ticker: TickerData) => {
      this.handleTickerData(ticker, 'binance');
    });
    
    this.binanceService.on('candle', (candle: CandleData) => {
      this.handleCandleData(candle, 'binance');
    });
    
    this.binanceService.on('orderbook', (orderbook: OrderBookData) => {
      this.handleOrderBookData(orderbook, 'binance');
    });
    
    this.binanceService.on('trade', (trade: TradeData) => {
      this.handleTradeData(trade, 'binance');
    });
    
    this.binanceService.on('streamConnected', (data) => {
      logger.info(`🟡 Binance stream connected: ${data.stream}`);
      this.emit('exchangeStreamConnected', { exchange: 'binance', stream: data.stream });
    });
    
    this.binanceService.on('streamDisconnected', (data) => {
      logger.warn(`🟡 Binance stream disconnected: ${data.stream}`);
      this.emit('exchangeStreamDisconnected', { exchange: 'binance', stream: data.stream });
    });
  }

  private setupKuCoinEventHandlers(): void {
    if (!this.kucoinService) return;
    
    this.kucoinService.on('ticker', (ticker: TickerData) => {
      this.handleTickerData(ticker, 'kucoin');
    });
    
    this.kucoinService.on('candle', (candle: CandleData) => {
      this.handleCandleData(candle, 'kucoin');
    });
    
    this.kucoinService.on('orderbook', (orderbook: OrderBookData) => {
      this.handleOrderBookData(orderbook, 'kucoin');
    });
    
    this.kucoinService.on('trade', (trade: TradeData) => {
      this.handleTradeData(trade, 'kucoin');
    });
    
    this.kucoinService.on('streamConnected', (data) => {
      logger.info(`🟢 KuCoin stream connected: ${data.topic}`);
      this.emit('exchangeStreamConnected', { exchange: 'kucoin', stream: data.topic });
    });
    
    this.kucoinService.on('streamDisconnected', (data) => {
      logger.warn(`🟢 KuCoin stream disconnected: ${data.topic}`);
      this.emit('exchangeStreamDisconnected', { exchange: 'kucoin', stream: data.topic });
    });
  }

  private async handleTickerData(ticker: TickerData, exchange: string): Promise<void> {
    try {
      // Update stats
      this.dataStats[exchange as 'binance' | 'kucoin'].received++;
      this.dataStats[exchange as 'binance' | 'kucoin'].lastReceived = Date.now();
      
      // Cache the data
      if (this.cacheService) {
        await this.cacheService.cacheTicker(ticker);
      }
      
      // Broadcast to WebSocket clients
      if (this.wsServer) {
        if (this.wsServer && typeof this.wsServer.broadcast === 'function') {
          this.wsServer.broadcast(`ticker:${ticker.symbol}`, {
          type: 'ticker',
          exchange,
          symbol: ticker.symbol,
          data: ticker,
          timestamp: Date.now()
        });
        this.dataStats.websocket.broadcasts++;
        }
      }
      
      // Emit event
      this.emit('tickerReceived', { ticker, exchange });
      
    } catch (error) {
      logger.error(`Error handling ticker data from ${exchange}:`, error);
    }
  }

  private async handleCandleData(candle: CandleData, exchange: string): Promise<void> {
    try {
      // Update stats
      this.dataStats[exchange as 'binance' | 'kucoin'].received++;
      this.dataStats[exchange as 'binance' | 'kucoin'].lastReceived = Date.now();
      
      // Cache the data
      if (this.cacheService) {
        await this.cacheService.cacheCandle(candle);
      }
      
      // Update technical indicators
      if (this.indicatorEngine) {
        if (this.indicatorEngine && typeof this.indicatorEngine.updateCandle === 'function') {
          await this.indicatorEngine.updateCandle(candle);
        }
      }
      
      // Broadcast to WebSocket clients
      if (this.wsServer) {
        if (this.wsServer && typeof this.wsServer.broadcast === 'function') {
          this.wsServer.broadcast(`candles:${candle.symbol}:${candle.timeframe}`, {
          type: 'candle',
          exchange,
          symbol: candle.symbol,
          timeframe: candle.timeframe,
          data: candle,
          timestamp: Date.now()
        });
        this.dataStats.websocket.broadcasts++;
        }
      }
      
      // Emit event
      this.emit('candleReceived', { candle, exchange });
      
    } catch (error) {
      logger.error(`Error handling candle data from ${exchange}:`, error);
    }
  }

  private async handleOrderBookData(orderbook: OrderBookData, exchange: string): Promise<void> {
    try {
      // Update stats
      this.dataStats[exchange as 'binance' | 'kucoin'].received++;
      this.dataStats[exchange as 'binance' | 'kucoin'].lastReceived = Date.now();
      
      // Cache the data
      if (this.cacheService) {
        await this.cacheService.cacheOrderBook(orderbook);
      }
      
      // Broadcast to WebSocket clients (throttled for orderbook updates)
      if (this.wsServer && Date.now() % 1000 < 100) { // Only broadcast ~10% of orderbook updates
        if (this.wsServer && typeof this.wsServer.broadcast === 'function') {
          this.wsServer.broadcast(`orderbook:${orderbook.symbol}`, {
          type: 'orderbook',
          exchange,
          symbol: orderbook.symbol,
          data: orderbook,
          timestamp: Date.now()
        });
        this.dataStats.websocket.broadcasts++;
        }
      }
      
      // Emit event
      this.emit('orderbookReceived', { orderbook, exchange });
      
    } catch (error) {
      logger.error(`Error handling orderbook data from ${exchange}:`, error);
    }
  }

  private async handleTradeData(trade: TradeData, exchange: string): Promise<void> {
    try {
      // Update stats
      this.dataStats[exchange as 'binance' | 'kucoin'].received++;
      this.dataStats[exchange as 'binance' | 'kucoin'].lastReceived = Date.now();
      
      // Broadcast to WebSocket clients
      if (this.wsServer) {
        if (this.wsServer && typeof this.wsServer.broadcast === 'function') {
          this.wsServer.broadcast(`trades:${trade.symbol}`, {
          type: 'trade',
          exchange,
          symbol: trade.symbol,
          data: trade,
          timestamp: Date.now()
        });
        this.dataStats.websocket.broadcasts++;
        }
      }
      
      // Emit event
      this.emit('tradeReceived', { trade, exchange });
      
    } catch (error) {
      logger.error(`Error handling trade data from ${exchange}:`, error);
    }
  }

  private async subscribeToMarketData(): Promise<void> {
    logger.info('📡 Subscribing to market data...');
    
    try {
      // Subscribe to Binance data
      if (this.binanceService && this.config.exchanges.binance.enabled) {
        await this.binanceService.subscribeToMajorTradingPairs();
        logger.info('✅ Subscribed to Binance major trading pairs');
      }
      
      // Subscribe to KuCoin data
      if (this.kucoinService && this.config.exchanges.kucoin.enabled) {
        await this.kucoinService.subscribeToMajorTradingPairs();
        logger.info('✅ Subscribed to KuCoin major trading pairs');
      }
      
      logger.info('✅ Market data subscriptions completed');
      
    } catch (error) {
      logger.error('❌ Failed to subscribe to market data:', error);
      throw error;
    }
  }

  private startMonitoring(): void {
    // Health check every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000);
    
    // Stats update every 60 seconds
    this.statsInterval = setInterval(() => {
      this.updateStats();
    }, 60000);
  }

  private stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
    
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = undefined;
    }
  }

  private performHealthCheck(): void {
    const stats = this.getStats();
    const isHealthy = this.isHealthy();
    
    this.emit('healthCheck', {
      isHealthy,
      stats,
      timestamp: Date.now()
    });
    
    if (!isHealthy) {
      logger.warn('⚠️  Live market data integration health check failed');
    }
  }

  private updateStats(): void {
    const stats = this.getStats();
    
    this.emit('statsUpdate', {
      stats,
      timestamp: Date.now()
    });
    
    logger.debug(`📊 Market data stats - Health: ${stats.overall.healthScore}%, Data flowing: ${stats.overall.dataFlowing}`);
  }

  private calculateDataRate(exchange: 'binance' | 'kucoin'): number {
    const stats = this.dataStats[exchange];
    const uptime = (Date.now() - this.startTime) / 1000; // seconds
    
    if (uptime === 0) return 0;
    
    return Math.round(stats.received / uptime * 60); // messages per minute
  }

  private isDataFlowing(): boolean {
    const now = Date.now();
    const threshold = 60000; // 1 minute
    
    const binanceFlowing = !this.config.exchanges.binance.enabled || 
      (now - this.dataStats.binance.lastReceived) < threshold;
    
    const kucoinFlowing = !this.config.exchanges.kucoin.enabled || 
      (now - this.dataStats.kucoin.lastReceived) < threshold;
    
    return binanceFlowing && kucoinFlowing;
  }

  private calculateHealthScore(): number {
    let score = 0;
    let maxScore = 0;
    
    // Exchange connectivity (40 points)
    if (this.config.exchanges.binance.enabled) {
      maxScore += 20;
      if (this.binanceService?.isHealthy()) {
        score += 20;
      }
    }
    
    if (this.config.exchanges.kucoin.enabled) {
      maxScore += 20;
      if (this.kucoinService?.isHealthy()) {
        score += 20;
      }
    }
    
    // Cache service (20 points)
    if (this.config.cache.enabled) {
      maxScore += 20;
      if (this.cacheService) {
        const cacheStats = this.cacheService.getCacheStats();
        if (cacheStats.hitRate > 80) {
          score += 20;
        } else if (cacheStats.hitRate > 50) {
          score += 10;
        }
      }
    }
    
    // Data flow (20 points)
    maxScore += 20;
    if (this.isDataFlowing()) {
      score += 20;
    }
    
    // WebSocket broadcasting (10 points)
    if (this.config.websocket.enabled) {
      maxScore += 10;
      if (this.wsServer && this.dataStats.websocket.broadcasts > 0) {
        score += 10;
      }
    }
    
    // Technical indicators (10 points)
    if (this.config.indicators.enabled) {
      maxScore += 10;
      if (this.indicatorEngine && this.dataStats.indicators.calculations > 0) {
        score += 10;
      }
    }
    
    return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  }
}