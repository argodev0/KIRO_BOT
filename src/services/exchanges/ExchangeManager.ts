/**
 * Exchange Manager
 * Manages connections and interactions with multiple cryptocurrency exchanges
 */

import { EventEmitter } from 'events';
import { BinanceWebSocketService } from '../BinanceWebSocketService';
import { KuCoinWebSocketService } from '../KuCoinWebSocketService';
import { CandleData, TickerData, OrderBookData, TradeData, Timeframe } from '../../types/market';
import { logger } from '../../utils/logger';

export type ExchangeName = 'binance' | 'kucoin';

export interface ExchangeConfig {
  exchanges: {
    binance?: {
      enabled: boolean;
      testnet?: boolean;
      apiKey?: string;
      apiSecret?: string;
      readOnly?: boolean;
    };
    kucoin?: {
      enabled: boolean;
      sandbox?: boolean;
      apiKey?: string;
      apiSecret?: string;
      passphrase?: string;
      readOnly?: boolean;
    };
  };
  defaultExchange: ExchangeName;
}

export interface ExchangeStatus {
  name: ExchangeName;
  connected: boolean;
  healthy: boolean;
  lastPing: number;
  subscriptions: number;
  dataRate: number;
}

export class ExchangeManager extends EventEmitter {
  private config: ExchangeConfig;
  private exchanges: Map<ExchangeName, any> = new Map();
  private connectionStatus: Map<ExchangeName, boolean> = new Map();
  private isInitialized: boolean = false;

  constructor(config: ExchangeConfig) {
    super();
    this.config = config;
  }

  /**
   * Initialize all configured exchanges
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('ExchangeManager is already initialized');
      return;
    }

    try {
      logger.info('🔗 Initializing Exchange Manager...');

      // Initialize Binance if enabled
      if (this.config.exchanges.binance?.enabled) {
        await this.initializeBinance();
      }

      // Initialize KuCoin if enabled
      if (this.config.exchanges.kucoin?.enabled) {
        await this.initializeKuCoin();
      }

      this.isInitialized = true;
      this.emit('initialized');
      
      logger.info('✅ Exchange Manager initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Exchange Manager:', error);
      throw error;
    }
  }

  /**
   * Shutdown all exchange connections
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      logger.info('🛑 Shutting down Exchange Manager...');

      const shutdownPromises: Promise<void>[] = [];

      for (const [name, exchange] of this.exchanges) {
        if (exchange && typeof exchange.stop === 'function') {
          shutdownPromises.push(exchange.stop());
        }
      }

      await Promise.all(shutdownPromises);

      this.exchanges.clear();
      this.connectionStatus.clear();
      this.isInitialized = false;

      this.emit('shutdown');
      logger.info('✅ Exchange Manager shutdown completed');
    } catch (error) {
      logger.error('❌ Error during Exchange Manager shutdown:', error);
      throw error;
    }
  }

  /**
   * Get available exchanges
   */
  getAvailableExchanges(): ExchangeName[] {
    return Array.from(this.exchanges.keys());
  }

  /**
   * Check if an exchange is connected
   */
  isExchangeConnected(exchange: ExchangeName): boolean {
    return this.connectionStatus.get(exchange) || false;
  }

  /**
   * Get exchange instance
   */
  getExchange(exchange: ExchangeName): any {
    return this.exchanges.get(exchange);
  }

  /**
   * Subscribe to ticker data
   */
  async subscribeToTicker(symbol: string, exchange?: ExchangeName): Promise<void> {
    const targetExchange = exchange || this.config.defaultExchange;
    const exchangeInstance = this.exchanges.get(targetExchange);

    if (!exchangeInstance) {
      throw new Error(`Exchange ${targetExchange} is not available`);
    }

    if (typeof exchangeInstance.subscribeToTicker === 'function') {
      await exchangeInstance.subscribeToTicker(symbol);
    } else {
      throw new Error(`Exchange ${targetExchange} does not support ticker subscriptions`);
    }
  }

  /**
   * Subscribe to order book data
   */
  async subscribeToOrderBook(symbol: string, exchange?: ExchangeName): Promise<void> {
    const targetExchange = exchange || this.config.defaultExchange;
    const exchangeInstance = this.exchanges.get(targetExchange);

    if (!exchangeInstance) {
      throw new Error(`Exchange ${targetExchange} is not available`);
    }

    if (typeof exchangeInstance.subscribeToOrderBook === 'function') {
      await exchangeInstance.subscribeToOrderBook(symbol);
    } else {
      throw new Error(`Exchange ${targetExchange} does not support order book subscriptions`);
    }
  }

  /**
   * Subscribe to trade data
   */
  async subscribeToTrades(symbol: string, exchange?: ExchangeName): Promise<void> {
    const targetExchange = exchange || this.config.defaultExchange;
    const exchangeInstance = this.exchanges.get(targetExchange);

    if (!exchangeInstance) {
      throw new Error(`Exchange ${targetExchange} is not available`);
    }

    if (typeof exchangeInstance.subscribeToTrades === 'function') {
      await exchangeInstance.subscribeToTrades(symbol);
    } else {
      throw new Error(`Exchange ${targetExchange} does not support trade subscriptions`);
    }
  }

  /**
   * Subscribe to candle data
   */
  async subscribeToCandles(symbol: string, timeframe: Timeframe, exchange?: ExchangeName): Promise<void> {
    const targetExchange = exchange || this.config.defaultExchange;
    const exchangeInstance = this.exchanges.get(targetExchange);

    if (!exchangeInstance) {
      throw new Error(`Exchange ${targetExchange} is not available`);
    }

    if (typeof exchangeInstance.subscribeToCandles === 'function') {
      await exchangeInstance.subscribeToCandles(symbol, timeframe);
    } else {
      throw new Error(`Exchange ${targetExchange} does not support candle subscriptions`);
    }
  }

  /**
   * Get exchange status
   */
  getExchangeStatus(): Record<ExchangeName, ExchangeStatus> {
    const status: Record<string, ExchangeStatus> = {};

    for (const [name, exchange] of this.exchanges) {
      const connected = this.connectionStatus.get(name) || false;
      let healthy = false;
      let subscriptions = 0;

      if (exchange && typeof exchange.isHealthy === 'function') {
        healthy = exchange.isHealthy();
      }

      if (exchange && typeof exchange.getConnectionStats === 'function') {
        const stats = exchange.getConnectionStats();
        subscriptions = stats.totalConnections || 0;
      }

      status[name] = {
        name,
        connected,
        healthy,
        lastPing: Date.now(),
        subscriptions,
        dataRate: 0 // Would be calculated from actual data flow
      };
    }

    return status as Record<ExchangeName, ExchangeStatus>;
  }

  /**
   * Perform health check on all exchanges
   */
  async healthCheck(): Promise<Record<ExchangeName, boolean>> {
    const health: Record<string, boolean> = {};

    for (const [name, exchange] of this.exchanges) {
      try {
        if (exchange && typeof exchange.isHealthy === 'function') {
          health[name] = exchange.isHealthy();
        } else {
          health[name] = this.connectionStatus.get(name) || false;
        }
      } catch (error) {
        logger.error(`Health check failed for ${name}:`, error);
        health[name] = false;
      }
    }

    return health as Record<ExchangeName, boolean>;
  }

  // Private methods

  private async initializeBinance(): Promise<void> {
    try {
      logger.info('🟡 Initializing Binance exchange...');

      const binanceService = new BinanceWebSocketService({
        majorTradingPairs: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'],
        defaultTimeframes: ['1m', '5m', '15m', '1h']
      });

      await binanceService.start();
      this.exchanges.set('binance', binanceService);
      this.connectionStatus.set('binance', true);

      // Set up event forwarding
      binanceService.on('ticker', (data) => {
        this.emit('ticker', { exchange: 'binance', data });
      });

      binanceService.on('candle', (data) => {
        this.emit('candle', { exchange: 'binance', data });
      });

      binanceService.on('orderbook', (data) => {
        this.emit('orderbook', { exchange: 'binance', data });
      });

      binanceService.on('trade', (data) => {
        this.emit('trade', { exchange: 'binance', data });
      });

      binanceService.on('streamConnected', (data) => {
        this.emit('exchangeConnected', 'binance');
      });

      binanceService.on('streamDisconnected', (data) => {
        this.connectionStatus.set('binance', false);
        this.emit('exchangeDisconnected', 'binance');
      });

      binanceService.on('streamError', (data) => {
        this.emit('exchangeError', { exchange: 'binance', error: data.error });
      });

      logger.info('✅ Binance exchange initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize Binance exchange:', error);
      throw error;
    }
  }

  private async initializeKuCoin(): Promise<void> {
    try {
      logger.info('🟢 Initializing KuCoin exchange...');

      const kucoinService = new KuCoinWebSocketService({
        majorTradingPairs: ['BTC-USDT', 'ETH-USDT', 'BNB-USDT'],
        defaultTimeframes: ['1m', '5m', '15m', '1h']
      });

      await kucoinService.start();
      this.exchanges.set('kucoin', kucoinService);
      this.connectionStatus.set('kucoin', true);

      // Set up event forwarding
      kucoinService.on('ticker', (data) => {
        this.emit('ticker', { exchange: 'kucoin', data });
      });

      kucoinService.on('candle', (data) => {
        this.emit('candle', { exchange: 'kucoin', data });
      });

      kucoinService.on('orderbook', (data) => {
        this.emit('orderbook', { exchange: 'kucoin', data });
      });

      kucoinService.on('trade', (data) => {
        this.emit('trade', { exchange: 'kucoin', data });
      });

      kucoinService.on('streamConnected', (data) => {
        this.emit('exchangeConnected', 'kucoin');
      });

      kucoinService.on('streamDisconnected', (data) => {
        this.connectionStatus.set('kucoin', false);
        this.emit('exchangeDisconnected', 'kucoin');
      });

      kucoinService.on('streamError', (data) => {
        this.emit('exchangeError', { exchange: 'kucoin', error: data.error });
      });

      logger.info('✅ KuCoin exchange initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize KuCoin exchange:', error);
      throw error;
    }
  }
}