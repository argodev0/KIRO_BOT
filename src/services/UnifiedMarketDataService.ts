/**
 * Unified Market Data Service
 * Combines Binance and KuCoin WebSocket services to provide a unified interface
 * for real-time market data streaming with connection pooling and rate limit management
 */

import { EventEmitter } from 'events';
import { BinanceWebSocketService } from './BinanceWebSocketService';
import { KuCoinWebSocketService } from './KuCoinWebSocketService';
import { logger } from '../utils/logger';
import { CandleData, TickerData, OrderBookData, TradeData, Timeframe } from '../types/market';

export interface UnifiedMarketDataConfig {
  binance?: {
    enabled: boolean;
    config?: any;
  };
  kucoin?: {
    enabled: boolean;
    config?: any;
  };
  defaultExchange?: 'binance' | 'kucoin';
  aggregateData?: boolean;
  cacheEnabled?: boolean;
  cacheTimeout?: number;
}

export interface ExchangeData<T> {
  binance?: T;
  kucoin?: T;
}

export interface AggregatedTicker extends TickerData {
  exchanges: string[];
  averagePrice?: number;
  totalVolume?: number;
  priceSpread?: number;
  binanceData?: TickerData;
  kucoinData?: TickerData;
}

export interface UnifiedConnectionStats {
  binance?: any;
  kucoin?: any;
  totalConnections: number;
  healthyConnections: number;
  unhealthyConnections: number;
  overallHealth: boolean;
}

export class UnifiedMarketDataService extends EventEmitter {
  private config: UnifiedMarketDataConfig;
  private binanceService?: BinanceWebSocketService;
  private kucoinService?: KuCoinWebSocketService;
  private dataCache: Map<string, { data: any; timestamp: number }> = new Map();
  private isRunning: boolean = false;

  constructor(config: UnifiedMarketDataConfig) {
    super();
    this.config = {
      defaultExchange: 'binance',
      aggregateData: true,
      cacheEnabled: true,
      cacheTimeout: 5000, // 5 seconds
      ...config
    };

    this.initializeServices();
  }

  /**
   * Start all enabled market data services
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('UnifiedMarketDataService is already running');
      return;
    }

    try {
      logger.info('🚀 Starting Unified Market Data Service...');

      const startPromises: Promise<void>[] = [];

      if (this.binanceService) {
        startPromises.push(this.binanceService.start());
      }

      if (this.kucoinService) {
        startPromises.push(this.kucoinService.start());
      }

      await Promise.all(startPromises);

      this.isRunning = true;
      this.emit('started');

      logger.info('✅ Unified Market Data Service started successfully');
    } catch (error) {
      logger.error('❌ Failed to start UnifiedMarketDataService:', error);
      throw error;
    }
  }

  /**
   * Stop all market data services
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info('🛑 Stopping Unified Market Data Service...');

      const stopPromises: Promise<void>[] = [];

      if (this.binanceService) {
        stopPromises.push(this.binanceService.stop());
      }

      if (this.kucoinService) {
        stopPromises.push(this.kucoinService.stop());
      }

      await Promise.all(stopPromises);

      this.dataCache.clear();
      this.isRunning = false;
      this.emit('stopped');

      logger.info('✅ Unified Market Data Service stopped');
    } catch (error) {
      logger.error('❌ Error stopping UnifiedMarketDataService:', error);
      throw error;
    }
  }

  /**
   * Subscribe to ticker data from all enabled exchanges
   */
  async subscribeToTicker(symbol: string, exchanges?: ('binance' | 'kucoin')[]): Promise<void> {
    const targetExchanges = exchanges || this.getEnabledExchanges();

    const subscriptionPromises: Promise<void>[] = [];

    for (const exchange of targetExchanges) {
      if (exchange === 'binance' && this.binanceService) {
        subscriptionPromises.push(this.binanceService.subscribeToTicker(symbol));
      } else if (exchange === 'kucoin' && this.kucoinService) {
        subscriptionPromises.push(this.kucoinService.subscribeToTicker(symbol));
      }
    }

    await Promise.all(subscriptionPromises);
    logger.info(`📊 Subscribed to ticker data for ${symbol} on ${targetExchanges.join(', ')}`);
  }

  /**
   * Subscribe to order book data from all enabled exchanges
   */
  async subscribeToOrderBook(symbol: string, exchanges?: ('binance' | 'kucoin')[]): Promise<void> {
    const targetExchanges = exchanges || this.getEnabledExchanges();

    const subscriptionPromises: Promise<void>[] = [];

    for (const exchange of targetExchanges) {
      if (exchange === 'binance' && this.binanceService) {
        subscriptionPromises.push(this.binanceService.subscribeToOrderBook(symbol));
      } else if (exchange === 'kucoin' && this.kucoinService) {
        subscriptionPromises.push(this.kucoinService.subscribeToOrderBook(symbol));
      }
    }

    await Promise.all(subscriptionPromises);
    logger.info(`📈 Subscribed to order book data for ${symbol} on ${targetExchanges.join(', ')}`);
  }

  /**
   * Subscribe to trade data from all enabled exchanges
   */
  async subscribeToTrades(symbol: string, exchanges?: ('binance' | 'kucoin')[]): Promise<void> {
    const targetExchanges = exchanges || this.getEnabledExchanges();

    const subscriptionPromises: Promise<void>[] = [];

    for (const exchange of targetExchanges) {
      if (exchange === 'binance' && this.binanceService) {
        subscriptionPromises.push(this.binanceService.subscribeToTrades(symbol));
      } else if (exchange === 'kucoin' && this.kucoinService) {
        subscriptionPromises.push(this.kucoinService.subscribeToTrades(symbol));
      }
    }

    await Promise.all(subscriptionPromises);
    logger.info(`💹 Subscribed to trade data for ${symbol} on ${targetExchanges.join(', ')}`);
  }

  /**
   * Subscribe to candle data from all enabled exchanges
   */
  async subscribeToCandles(symbol: string, timeframe: Timeframe, exchanges?: ('binance' | 'kucoin')[]): Promise<void> {
    const targetExchanges = exchanges || this.getEnabledExchanges();

    const subscriptionPromises: Promise<void>[] = [];

    for (const exchange of targetExchanges) {
      if (exchange === 'binance' && this.binanceService) {
        subscriptionPromises.push(this.binanceService.subscribeToCandles(symbol, timeframe));
      } else if (exchange === 'kucoin' && this.kucoinService) {
        subscriptionPromises.push(this.kucoinService.subscribeToCandles(symbol, timeframe));
      }
    }

    await Promise.all(subscriptionPromises);
    logger.info(`🕯️ Subscribed to candle data for ${symbol} ${timeframe} on ${targetExchanges.join(', ')}`);
  }

  /**
   * Subscribe to all major trading pairs on all enabled exchanges
   */
  async subscribeToMajorTradingPairs(): Promise<void> {
    logger.info('🚀 Subscribing to major trading pairs on all enabled exchanges...');

    const subscriptionPromises: Promise<void>[] = [];

    if (this.binanceService) {
      subscriptionPromises.push(this.binanceService.subscribeToMajorTradingPairs());
    }

    if (this.kucoinService) {
      subscriptionPromises.push(this.kucoinService.subscribeToMajorTradingPairs());
    }

    await Promise.all(subscriptionPromises);
    logger.info('✅ Successfully subscribed to major trading pairs on all exchanges');
  }

  /**
   * Subscribe to complete data for a symbol on all enabled exchanges
   */
  async subscribeToSymbolComplete(symbol: string, timeframes?: Timeframe[]): Promise<void> {
    logger.info(`📊 Subscribing to complete data for ${symbol} on all enabled exchanges...`);

    const subscriptionPromises: Promise<void>[] = [];

    if (this.binanceService) {
      subscriptionPromises.push(this.binanceService.subscribeToSymbolComplete(symbol, timeframes));
    }

    if (this.kucoinService) {
      subscriptionPromises.push(this.kucoinService.subscribeToSymbolComplete(symbol, timeframes));
    }

    await Promise.all(subscriptionPromises);
    logger.info(`✅ Complete subscription for ${symbol} successful on all exchanges`);
  }

  /**
   * Unsubscribe from all streams for a symbol
   */
  async unsubscribeFromSymbol(symbol: string): Promise<void> {
    const unsubscribePromises: Promise<void>[] = [];

    if (this.binanceService) {
      unsubscribePromises.push(this.binanceService.unsubscribeFromSymbol(symbol));
    }

    if (this.kucoinService) {
      unsubscribePromises.push(this.kucoinService.unsubscribeFromSymbol(symbol));
    }

    await Promise.all(unsubscribePromises);
    logger.info(`🔌 Unsubscribed from all streams for ${symbol} on all exchanges`);
  }

  /**
   * Get aggregated ticker data from cache or live data
   */
  getAggregatedTicker(symbol: string): AggregatedTicker | null {
    if (!this.config.cacheEnabled) {
      return null;
    }

    const cacheKey = `ticker:${symbol}`;
    const cached = this.dataCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < (this.config.cacheTimeout || 5000)) {
      return cached.data;
    }

    return null;
  }

  /**
   * Get connection statistics from all services
   */
  getConnectionStats(): UnifiedConnectionStats {
    const stats: UnifiedConnectionStats = {
      totalConnections: 0,
      healthyConnections: 0,
      unhealthyConnections: 0,
      overallHealth: true
    };

    if (this.binanceService) {
      const binanceStats = this.binanceService.getConnectionStats();
      stats.binance = binanceStats;
      stats.totalConnections += binanceStats.totalConnections;
      stats.healthyConnections += binanceStats.healthyConnections;
      stats.unhealthyConnections += binanceStats.unhealthyConnections;
      
      if (!this.binanceService.isHealthy()) {
        stats.overallHealth = false;
      }
    }

    if (this.kucoinService) {
      const kucoinStats = this.kucoinService.getConnectionStats();
      stats.kucoin = kucoinStats;
      stats.totalConnections += kucoinStats.totalConnections;
      stats.healthyConnections += kucoinStats.healthyConnections;
      stats.unhealthyConnections += kucoinStats.unhealthyConnections;
      
      if (!this.kucoinService.isHealthy()) {
        stats.overallHealth = false;
      }
    }

    return stats;
  }

  /**
   * Check if the unified service is healthy
   */
  isHealthy(): boolean {
    if (!this.isRunning) {
      return false;
    }

    let hasHealthyService = false;

    if (this.binanceService && this.binanceService.isHealthy()) {
      hasHealthyService = true;
    }

    if (this.kucoinService && this.kucoinService.isHealthy()) {
      hasHealthyService = true;
    }

    return hasHealthyService;
  }

  /**
   * Get list of enabled exchanges
   */
  getEnabledExchanges(): ('binance' | 'kucoin')[] {
    const enabled: ('binance' | 'kucoin')[] = [];

    if (this.config.binance?.enabled && this.binanceService) {
      enabled.push('binance');
    }

    if (this.config.kucoin?.enabled && this.kucoinService) {
      enabled.push('kucoin');
    }

    return enabled;
  }

  // Private methods

  private initializeServices(): void {
    // Initialize Binance service
    if (this.config.binance?.enabled) {
      this.binanceService = new BinanceWebSocketService(this.config.binance.config);
      this.setupBinanceEventHandlers();
    }

    // Initialize KuCoin service
    if (this.config.kucoin?.enabled) {
      this.kucoinService = new KuCoinWebSocketService(this.config.kucoin.config);
      this.setupKuCoinEventHandlers();
    }
  }

  private setupBinanceEventHandlers(): void {
    if (!this.binanceService) return;

    this.binanceService.on('ticker', (ticker: TickerData) => {
      this.handleTickerData('binance', ticker);
      this.emit('ticker', { exchange: 'binance', data: ticker });
    });

    this.binanceService.on('orderbook', (orderbook: OrderBookData) => {
      this.emit('orderbook', { exchange: 'binance', data: orderbook });
    });

    this.binanceService.on('trade', (trade: TradeData) => {
      this.emit('trade', { exchange: 'binance', data: trade });
    });

    this.binanceService.on('candle', (candle: CandleData) => {
      this.emit('candle', { exchange: 'binance', data: candle });
    });

    this.binanceService.on('started', () => {
      this.emit('exchangeStarted', 'binance');
    });

    this.binanceService.on('stopped', () => {
      this.emit('exchangeStopped', 'binance');
    });

    this.binanceService.on('streamConnected', (data) => {
      this.emit('streamConnected', { exchange: 'binance', ...data });
    });

    this.binanceService.on('streamDisconnected', (data) => {
      this.emit('streamDisconnected', { exchange: 'binance', ...data });
    });

    this.binanceService.on('healthCheck', (data) => {
      this.emit('healthCheck', { exchange: 'binance', ...data });
    });
  }

  private setupKuCoinEventHandlers(): void {
    if (!this.kucoinService) return;

    this.kucoinService.on('ticker', (ticker: TickerData) => {
      this.handleTickerData('kucoin', ticker);
      this.emit('ticker', { exchange: 'kucoin', data: ticker });
    });

    this.kucoinService.on('orderbook', (orderbook: OrderBookData) => {
      this.emit('orderbook', { exchange: 'kucoin', data: orderbook });
    });

    this.kucoinService.on('trade', (trade: TradeData) => {
      this.emit('trade', { exchange: 'kucoin', data: trade });
    });

    this.kucoinService.on('candle', (candle: CandleData) => {
      this.emit('candle', { exchange: 'kucoin', data: candle });
    });

    this.kucoinService.on('started', () => {
      this.emit('exchangeStarted', 'kucoin');
    });

    this.kucoinService.on('stopped', () => {
      this.emit('exchangeStopped', 'kucoin');
    });

    this.kucoinService.on('streamConnected', (data) => {
      this.emit('streamConnected', { exchange: 'kucoin', ...data });
    });

    this.kucoinService.on('streamDisconnected', (data) => {
      this.emit('streamDisconnected', { exchange: 'kucoin', ...data });
    });

    this.kucoinService.on('healthCheck', (data) => {
      this.emit('healthCheck', { exchange: 'kucoin', ...data });
    });
  }

  private handleTickerData(exchange: 'binance' | 'kucoin', ticker: TickerData): void {
    if (!this.config.aggregateData || !this.config.cacheEnabled) {
      return;
    }

    const cacheKey = `ticker:${ticker.symbol}`;
    const cached = this.dataCache.get(cacheKey);

    if (cached) {
      // Update existing aggregated data
      const aggregated = cached.data as AggregatedTicker;
      
      if (exchange === 'binance') {
        aggregated.binanceData = ticker;
      } else {
        aggregated.kucoinData = ticker;
      }

      // Recalculate aggregated values
      this.updateAggregatedTicker(aggregated);
      
      this.dataCache.set(cacheKey, {
        data: aggregated,
        timestamp: Date.now()
      });
    } else {
      // Create new aggregated ticker
      const aggregated: AggregatedTicker = {
        ...ticker,
        exchanges: [exchange],
        binanceData: exchange === 'binance' ? ticker : undefined,
        kucoinData: exchange === 'kucoin' ? ticker : undefined,
      };

      this.dataCache.set(cacheKey, {
        data: aggregated,
        timestamp: Date.now()
      });
    }

    // Emit aggregated ticker update
    const updatedAggregated = this.dataCache.get(cacheKey)?.data;
    if (updatedAggregated) {
      this.emit('aggregatedTicker', updatedAggregated);
    }
  }

  private updateAggregatedTicker(aggregated: AggregatedTicker): void {
    const prices: number[] = [];
    const volumes: number[] = [];
    const exchanges: string[] = [];

    if (aggregated.binanceData) {
      prices.push(aggregated.binanceData.price);
      volumes.push(aggregated.binanceData.volume);
      exchanges.push('binance');
    }

    if (aggregated.kucoinData) {
      prices.push(aggregated.kucoinData.price);
      volumes.push(aggregated.kucoinData.volume);
      exchanges.push('kucoin');
    }

    if (prices.length > 0) {
      aggregated.averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      aggregated.totalVolume = volumes.reduce((sum, volume) => sum + volume, 0);
      aggregated.priceSpread = prices.length > 1 ? Math.max(...prices) - Math.min(...prices) : 0;
      aggregated.exchanges = exchanges;
      
      // Use the most recent price as the main price
      const latestData = aggregated.binanceData && aggregated.kucoinData
        ? (aggregated.binanceData.timestamp > aggregated.kucoinData.timestamp ? aggregated.binanceData : aggregated.kucoinData)
        : (aggregated.binanceData || aggregated.kucoinData);
      
      if (latestData) {
        aggregated.price = latestData.price;
        aggregated.timestamp = latestData.timestamp;
        aggregated.bid = latestData.bid;
        aggregated.ask = latestData.ask;
        aggregated.change24h = latestData.change24h;
        aggregated.changePercent24h = latestData.changePercent24h;
      }
    }
  }
}