/**
 * Live Market Data Service
 * Handles real-time market data aggregation from mainnet exchanges
 * with WebSocket streaming and connection validation
 */

import { EventEmitter } from 'events';
import { createClient, RedisClientType } from 'redis';
import { CandleData, TickerData, OrderBookData, TradeData, Timeframe } from '../types/market';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export type ExchangeName = 'binance' | 'kucoin';

export interface LiveMarketDataConfig {
  exchanges: {
    binance: {
      enabled: boolean;
      mainnet: boolean;
      readOnly: boolean;
      apiKey: string;
      apiSecret: string;
    };
    kucoin: {
      enabled: boolean;
      mainnet: boolean;
      readOnly: boolean;
      apiKey: string;
      apiSecret: string;
      passphrase: string;
    };
  };
  symbols: string[];
  timeframes: Timeframe[];
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  streaming: {
    maxConnections: number;
    heartbeatInterval: number;
    reconnectDelay: number;
    maxReconnectAttempts: number;
  };
}

export interface AggregatedMarketData {
  symbol: string;
  timestamp: number;
  exchanges: {
    [key in ExchangeName]?: {
      ticker?: TickerData;
      orderBook?: OrderBookData;
      lastTrade?: TradeData;
      candles?: Record<Timeframe, CandleData>;
      connectionStatus: 'connected' | 'disconnected' | 'error';
      lastUpdate: number;
    };
  };
  aggregated: {
    averagePrice: number;
    totalVolume: number;
    priceSpread: number;
    bestBid: number;
    bestAsk: number;
    confidence: number;
  };
}

export class LiveMarketDataService extends EventEmitter {
  private redis: RedisClientType;
  private config: LiveMarketDataConfig;
  private isRunning: boolean = false;
  
  // Data storage
  private marketData: Map<string, AggregatedMarketData> = new Map();
  private connectionStatus: Map<ExchangeName, boolean> = new Map();
  private lastDataReceived: Map<string, number> = new Map(); // symbol -> timestamp
  
  // Monitoring
  private healthCheckInterval?: NodeJS.Timeout;
  private dataQualityInterval?: NodeJS.Timeout;
  private connectionMonitorInterval?: NodeJS.Timeout;

  constructor(config: LiveMarketDataConfig) {
    super();
    this.config = config;
    
    // Initialize Redis client
    const redisConfig: any = {
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      database: config.redis.db,
    };
    
    if (config.redis.password) {
      redisConfig.password = config.redis.password;
    }
    
    this.redis = createClient(redisConfig);
  }

  /**
   * Start the live market data service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('LiveMarketDataService is already running');
      return;
    }

    try {
      logger.info('🚀 Starting Live Market Data Service...');
      
      // Validate paper trading mode
      this.validatePaperTradingMode();
      
      // Connect to Redis
      await this.redis.connect();
      logger.info('✅ Redis connected');
      
      // Initialize and connect to exchanges
      await this.exchangeManager.initialize();
      logger.info('✅ Exchange connections established');
      
      // Validate exchange connections are mainnet and read-only
      await this.validateExchangeConnections();
      
      // Subscribe to market data for configured symbols
      await this.subscribeToMarketData();
      logger.info('✅ Market data subscriptions active');
      
      // Start monitoring services
      this.startMonitoring();
      
      this.isRunning = true;
      this.emit('started');
      logger.info('🎯 Live Market Data Service started successfully');
      
    } catch (error) {
      logger.error('❌ Failed to start LiveMarketDataService:', error);
      throw error;
    }
  }

  /**
   * Stop the service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info('🛑 Stopping Live Market Data Service...');
      
      // Stop monitoring
      this.stopMonitoring();
      
      // Shutdown exchange connections
      await this.exchangeManager.shutdown();
      
      // Close Redis connection
      await this.redis.disconnect();
      
      this.isRunning = false;
      this.emit('stopped');
      logger.info('✅ Live Market Data Service stopped');
      
    } catch (error) {
      logger.error('❌ Error stopping LiveMarketDataService:', error);
      throw error;
    }
  }

  /**
   * Get aggregated market data for a symbol
   */
  getMarketData(symbol: string): AggregatedMarketData | undefined {
    return this.marketData.get(symbol.toUpperCase());
  }

  /**
   * Get all market data
   */
  getAllMarketData(): Record<string, AggregatedMarketData> {
    const result: Record<string, AggregatedMarketData> = {};
    for (const [symbol, data] of this.marketData) {
      result[symbol] = data;
    }
    return result;
  }

  /**
   * Get connection status for all exchanges
   */
  getConnectionStatus(): Record<ExchangeName, boolean> {
    const status: Record<string, boolean> = {};
    for (const [exchange, connected] of this.connectionStatus) {
      status[exchange] = connected;
    }
    return status as Record<ExchangeName, boolean>;
  }

  /**
   * Get service health status
   */
  getHealthStatus(): {
    isRunning: boolean;
    exchanges: Record<ExchangeName, boolean>;
    dataFreshness: Record<string, number>;
    totalSymbols: number;
    activeConnections: number;
  } {
    const exchanges = this.getConnectionStatus();
    const activeConnections = Object.values(exchanges).filter(Boolean).length;
    
    const dataFreshness: Record<string, number> = {};
    const now = Date.now();
    for (const [symbol, timestamp] of this.lastDataReceived) {
      dataFreshness[symbol] = now - timestamp;
    }

    return {
      isRunning: this.isRunning,
      exchanges,
      dataFreshness,
      totalSymbols: this.config.symbols.length,
      activeConnections,
    };
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

  private async validateExchangeConnections(): Promise<void> {
    const availableExchanges = this.exchangeManager.getAvailableExchanges();
    
    for (const exchangeName of availableExchanges) {
      const isConnected = this.exchangeManager.isExchangeConnected(exchangeName);
      if (!isConnected) {
        throw new Error(`Exchange ${exchangeName} is not connected`);
      }
      
      // Perform health check
      const exchange = this.exchangeManager.getExchange(exchangeName);
      if (exchange) {
        const isHealthy = await exchange.healthCheck();
        if (!isHealthy) {
          throw new Error(`Exchange ${exchangeName} failed health check`);
        }
      }
      
      this.connectionStatus.set(exchangeName, true);
      logger.info(`✅ ${exchangeName} mainnet connection validated`);
    }
  }

  private async subscribeToMarketData(): Promise<void> {
    const availableExchanges = this.exchangeManager.getAvailableExchanges();
    
    for (const symbol of this.config.symbols) {
      // Initialize market data structure
      const marketData: AggregatedMarketData = {
        symbol: symbol.toUpperCase(),
        timestamp: Date.now(),
        exchanges: {},
        aggregated: {
          averagePrice: 0,
          totalVolume: 0,
          priceSpread: 0,
          bestBid: 0,
          bestAsk: 0,
          confidence: 0,
        },
      };
      
      for (const exchange of availableExchanges) {
        marketData.exchanges[exchange] = {
          connectionStatus: 'connected',
          lastUpdate: Date.now(),
          candles: {} as Record<Timeframe, CandleData>,
        };
        
        try {
          // Subscribe to ticker updates
          await this.exchangeManager.subscribeToTicker(symbol, exchange);
          
          // Subscribe to order book updates
          await this.exchangeManager.subscribeToOrderBook(symbol, exchange);
          
          // Subscribe to trade updates
          await this.exchangeManager.subscribeToTrades(symbol, exchange);
          
          // Subscribe to candle updates for each timeframe
          for (const timeframe of this.config.timeframes) {
            await this.exchangeManager.subscribeToCandles(symbol, timeframe, exchange);
          }
          
          logger.info(`📊 Subscribed to ${symbol} on ${exchange}`);
          
        } catch (error) {
          logger.error(`❌ Failed to subscribe to ${symbol} on ${exchange}:`, error);
          if (marketData.exchanges[exchange]) {
            marketData.exchanges[exchange]!.connectionStatus = 'error';
          }
        }
      }
      
      this.marketData.set(symbol.toUpperCase(), marketData);
    }
  }

  private setupEventHandlers(): void {
    // Handle ticker updates
    this.exchangeManager.on('ticker', ({ exchange, data }) => {
      this.updateTickerData(data, exchange);
    });
    
    // Handle order book updates
    this.exchangeManager.on('orderbook', ({ exchange, data }) => {
      this.updateOrderBookData(data, exchange);
    });
    
    // Handle trade updates
    this.exchangeManager.on('trade', ({ exchange, data }) => {
      this.updateTradeData(data, exchange);
    });
    
    // Handle candle updates
    this.exchangeManager.on('candle', ({ exchange, data }) => {
      this.updateCandleData(data, exchange);
    });
    
    // Handle connection events
    this.exchangeManager.on('exchangeConnected', (exchange) => {
      this.connectionStatus.set(exchange, true);
      this.emit('exchangeConnected', exchange);
      logger.info(`🔗 ${exchange} connected`);
    });
    
    this.exchangeManager.on('exchangeDisconnected', (exchange) => {
      this.connectionStatus.set(exchange, false);
      this.emit('exchangeDisconnected', exchange);
      logger.warn(`🔌 ${exchange} disconnected`);
    });
    
    this.exchangeManager.on('exchangeError', ({ exchange, error }) => {
      this.connectionStatus.set(exchange, false);
      this.emit('exchangeError', { exchange, error });
      logger.error(`❌ ${exchange} error:`, error);
    });
  }

  private updateTickerData(ticker: TickerData, exchange: ExchangeName): void {
    const symbol = ticker.symbol.toUpperCase();
    const marketData = this.marketData.get(symbol);
    
    if (marketData && marketData.exchanges[exchange]) {
      marketData.exchanges[exchange]!.ticker = ticker;
      marketData.exchanges[exchange]!.lastUpdate = Date.now();
      marketData.timestamp = Date.now();
      
      this.updateAggregatedData(marketData);
      this.lastDataReceived.set(symbol, Date.now());
      
      // Cache in Redis
      this.cacheMarketData(symbol, marketData);
      
      // Emit update
      this.emit('ticker', { symbol, exchange, data: ticker });
      this.emit('marketDataUpdate', { symbol, data: marketData });
    }
  }

  private updateOrderBookData(orderBook: OrderBookData, exchange: ExchangeName): void {
    const symbol = orderBook.symbol.toUpperCase();
    const marketData = this.marketData.get(symbol);
    
    if (marketData && marketData.exchanges[exchange]) {
      marketData.exchanges[exchange]!.orderBook = orderBook;
      marketData.exchanges[exchange]!.lastUpdate = Date.now();
      marketData.timestamp = Date.now();
      
      this.updateAggregatedData(marketData);
      this.lastDataReceived.set(symbol, Date.now());
      
      // Emit update
      this.emit('orderbook', { symbol, exchange, data: orderBook });
      this.emit('marketDataUpdate', { symbol, data: marketData });
    }
  }

  private updateTradeData(trade: TradeData, exchange: ExchangeName): void {
    const symbol = trade.symbol.toUpperCase();
    const marketData = this.marketData.get(symbol);
    
    if (marketData && marketData.exchanges[exchange]) {
      marketData.exchanges[exchange]!.lastTrade = trade;
      marketData.exchanges[exchange]!.lastUpdate = Date.now();
      marketData.timestamp = Date.now();
      
      this.updateAggregatedData(marketData);
      this.lastDataReceived.set(symbol, Date.now());
      
      // Emit update
      this.emit('trade', { symbol, exchange, data: trade });
      this.emit('marketDataUpdate', { symbol, data: marketData });
    }
  }

  private updateCandleData(candle: CandleData, exchange: ExchangeName): void {
    const symbol = candle.symbol.toUpperCase();
    const marketData = this.marketData.get(symbol);
    
    if (marketData && marketData.exchanges[exchange]) {
      if (!marketData.exchanges[exchange]!.candles) {
        marketData.exchanges[exchange]!.candles = {} as Record<Timeframe, CandleData>;
      }
      
      marketData.exchanges[exchange]!.candles![candle.timeframe as Timeframe] = candle;
      marketData.exchanges[exchange]!.lastUpdate = Date.now();
      marketData.timestamp = Date.now();
      
      this.updateAggregatedData(marketData);
      this.lastDataReceived.set(symbol, Date.now());
      
      // Emit update
      this.emit('candle', { symbol, exchange, timeframe: candle.timeframe, data: candle });
      this.emit('marketDataUpdate', { symbol, data: marketData });
    }
  }

  private updateAggregatedData(marketData: AggregatedMarketData): void {
    const exchanges = Object.values(marketData.exchanges).filter(ex => ex && ex.ticker);
    
    if (exchanges.length === 0) return;
    
    // Calculate aggregated metrics
    const prices = exchanges.map(ex => ex.ticker!.price);
    const volumes = exchanges.map(ex => ex.ticker!.volume);
    const bids = exchanges.map(ex => ex.ticker!.bid).filter(bid => bid > 0);
    const asks = exchanges.map(ex => ex.ticker!.ask).filter(ask => ask > 0);
    
    marketData.aggregated.averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    marketData.aggregated.totalVolume = volumes.reduce((sum, vol) => sum + vol, 0);
    marketData.aggregated.bestBid = Math.max(...bids);
    marketData.aggregated.bestAsk = Math.min(...asks);
    marketData.aggregated.priceSpread = marketData.aggregated.bestAsk - marketData.aggregated.bestBid;
    
    // Calculate confidence based on data freshness and exchange count
    const now = Date.now();
    const freshness = exchanges.map(ex => Math.max(0, 1 - (now - ex.lastUpdate) / 60000)); // 1 minute decay
    const avgFreshness = freshness.reduce((sum, f) => sum + f, 0) / freshness.length;
    marketData.aggregated.confidence = Math.min(100, avgFreshness * exchanges.length * 50);
  }

  private async cacheMarketData(symbol: string, data: AggregatedMarketData): Promise<void> {
    try {
      const key = `live:market:${symbol}`;
      await this.redis.setEx(key, 60, JSON.stringify(data)); // Cache for 1 minute
    } catch (error) {
      logger.error('Failed to cache market data:', error);
    }
  }

  private startMonitoring(): void {
    // Health check every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.exchangeManager.healthCheck();
        this.emit('healthCheck', health);
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    }, 30000);
    
    // Data quality check every 60 seconds
    this.dataQualityInterval = setInterval(() => {
      this.checkDataQuality();
    }, 60000);
    
    // Connection monitoring every 15 seconds
    this.connectionMonitorInterval = setInterval(() => {
      this.monitorConnections();
    }, 15000);
  }

  private stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.dataQualityInterval) {
      clearInterval(this.dataQualityInterval);
    }
    if (this.connectionMonitorInterval) {
      clearInterval(this.connectionMonitorInterval);
    }
  }

  private checkDataQuality(): void {
    const now = Date.now();
    const staleThreshold = 120000; // 2 minutes
    
    for (const [symbol, timestamp] of this.lastDataReceived) {
      const age = now - timestamp;
      if (age > staleThreshold) {
        logger.warn(`⚠️  Stale data detected for ${symbol}: ${Math.round(age / 1000)}s old`);
        this.emit('staleData', { symbol, age });
      }
    }
  }

  private monitorConnections(): void {
    const availableExchanges = this.exchangeManager.getAvailableExchanges();
    
    for (const exchange of availableExchanges) {
      const isConnected = this.exchangeManager.isExchangeConnected(exchange);
      const wasConnected = this.connectionStatus.get(exchange);
      
      if (wasConnected && !isConnected) {
        logger.warn(`🔌 Connection lost to ${exchange}`);
        this.emit('connectionLost', exchange);
      } else if (!wasConnected && isConnected) {
        logger.info(`🔗 Connection restored to ${exchange}`);
        this.emit('connectionRestored', exchange);
      }
      
      this.connectionStatus.set(exchange, isConnected);
    }
  }
}