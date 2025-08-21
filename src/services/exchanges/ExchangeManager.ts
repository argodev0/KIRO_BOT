/**
 * Exchange Manager
 * Manages multiple exchange connections and provides unified interface
 */

import { EventEmitter } from 'events';
import { BaseExchange, ExchangeConfig } from './BaseExchange';
import { BinanceExchange } from './BinanceExchange';
import { KuCoinExchange } from './KuCoinExchange';
import { CandleData, TickerData, OrderBookData, TradeData } from '../../types/market';
import { OrderRequest, OrderResponse, Position } from '../../types/trading';

export type ExchangeName = 'binance' | 'kucoin';

export interface ExchangeManagerConfig {
  exchanges: {
    [key in ExchangeName]?: ExchangeConfig & { 
      enabled: boolean;
      passphrase?: string; // For KuCoin
    };
  };
  defaultExchange?: ExchangeName;
}

export class ExchangeManager extends EventEmitter {
  private exchanges: Map<ExchangeName, BaseExchange> = new Map();
  private config: ExchangeManagerConfig;
  private defaultExchange: ExchangeName;

  constructor(config: ExchangeManagerConfig) {
    super();
    this.config = config;
    this.defaultExchange = config.defaultExchange || 'binance';
  }

  /**
   * Initialize all enabled exchanges
   */
  async initialize(): Promise<void> {
    const initPromises: Promise<void>[] = [];

    for (const [exchangeName, exchangeConfig] of Object.entries(this.config.exchanges)) {
      if (exchangeConfig.enabled) {
        const exchange = this.createExchange(exchangeName as ExchangeName, exchangeConfig);
        this.exchanges.set(exchangeName as ExchangeName, exchange);
        
        // Set up event forwarding
        this.setupEventForwarding(exchange, exchangeName as ExchangeName);
        
        // Connect to exchange
        initPromises.push(exchange.connect());
      }
    }

    await Promise.all(initPromises);
    this.emit('initialized');
  }

  /**
   * Disconnect from all exchanges
   */
  async shutdown(): Promise<void> {
    const disconnectPromises: Promise<void>[] = [];

    for (const exchange of this.exchanges.values()) {
      disconnectPromises.push(exchange.disconnect());
    }

    await Promise.all(disconnectPromises);
    this.exchanges.clear();
    this.emit('shutdown');
  }

  /**
   * Get exchange instance
   */
  getExchange(name: ExchangeName): BaseExchange | undefined {
    return this.exchanges.get(name);
  }

  /**
   * Get all available exchanges
   */
  getAvailableExchanges(): ExchangeName[] {
    return Array.from(this.exchanges.keys());
  }

  /**
   * Check if exchange is connected
   */
  isExchangeConnected(name: ExchangeName): boolean {
    const exchange = this.exchanges.get(name);
    return exchange ? exchange.isConnected() : false;
  }

  /**
   * Get market data from specific exchange or default
   */
  async getTicker(symbol: string, exchange?: ExchangeName): Promise<TickerData> {
    const exchangeInstance = this.getExchangeInstance(exchange);
    return exchangeInstance.getTicker(symbol);
  }

  async getOrderBook(symbol: string, limit?: number, exchange?: ExchangeName): Promise<OrderBookData> {
    const exchangeInstance = this.getExchangeInstance(exchange);
    return exchangeInstance.getOrderBook(symbol, limit);
  }

  async getCandles(
    symbol: string,
    timeframe: string,
    limit?: number,
    startTime?: number,
    endTime?: number,
    exchange?: ExchangeName
  ): Promise<CandleData[]> {
    const exchangeInstance = this.getExchangeInstance(exchange);
    return exchangeInstance.getCandles(symbol, timeframe, limit, startTime, endTime);
  }

  async getRecentTrades(symbol: string, limit?: number, exchange?: ExchangeName): Promise<TradeData[]> {
    const exchangeInstance = this.getExchangeInstance(exchange);
    return exchangeInstance.getRecentTrades(symbol, limit);
  }

  /**
   * Subscribe to market data streams
   */
  async subscribeToTicker(symbol: string, exchange?: ExchangeName): Promise<void> {
    const exchangeInstance = this.getExchangeInstance(exchange);
    return exchangeInstance.subscribeToTicker(symbol);
  }

  async subscribeToOrderBook(symbol: string, exchange?: ExchangeName): Promise<void> {
    const exchangeInstance = this.getExchangeInstance(exchange);
    return exchangeInstance.subscribeToOrderBook(symbol);
  }

  async subscribeToTrades(symbol: string, exchange?: ExchangeName): Promise<void> {
    const exchangeInstance = this.getExchangeInstance(exchange);
    return exchangeInstance.subscribeToTrades(symbol);
  }

  async subscribeToCandles(symbol: string, timeframe: string, exchange?: ExchangeName): Promise<void> {
    const exchangeInstance = this.getExchangeInstance(exchange);
    return exchangeInstance.subscribeToCandles(symbol, timeframe);
  }

  /**
   * Trading operations
   */
  async placeOrder(order: OrderRequest, exchange?: ExchangeName): Promise<OrderResponse> {
    const exchangeInstance = this.getExchangeInstance(exchange);
    return exchangeInstance.placeOrder(order);
  }

  async cancelOrder(orderId: string, symbol: string, exchange?: ExchangeName): Promise<boolean> {
    const exchangeInstance = this.getExchangeInstance(exchange);
    return exchangeInstance.cancelOrder(orderId, symbol);
  }

  async getOrder(orderId: string, symbol: string, exchange?: ExchangeName): Promise<OrderResponse> {
    const exchangeInstance = this.getExchangeInstance(exchange);
    return exchangeInstance.getOrder(orderId, symbol);
  }

  async getOpenOrders(symbol?: string, exchange?: ExchangeName): Promise<OrderResponse[]> {
    const exchangeInstance = this.getExchangeInstance(exchange);
    return exchangeInstance.getOpenOrders(symbol);
  }

  async getOrderHistory(symbol?: string, limit?: number, exchange?: ExchangeName): Promise<OrderResponse[]> {
    const exchangeInstance = this.getExchangeInstance(exchange);
    return exchangeInstance.getOrderHistory(symbol, limit);
  }

  /**
   * Account operations
   */
  async getBalance(exchange?: ExchangeName): Promise<Record<string, number>> {
    const exchangeInstance = this.getExchangeInstance(exchange);
    return exchangeInstance.getBalance();
  }

  async getPositions(exchange?: ExchangeName): Promise<Position[]> {
    const exchangeInstance = this.getExchangeInstance(exchange);
    return exchangeInstance.getPositions();
  }

  /**
   * Multi-exchange operations
   */
  async getTickerFromAllExchanges(symbol: string): Promise<Record<ExchangeName, TickerData>> {
    const results: Record<string, TickerData> = {};
    const promises: Promise<void>[] = [];

    for (const [name, exchange] of this.exchanges) {
      promises.push(
        exchange.getTicker(symbol)
          .then(ticker => { results[name] = ticker; })
          .catch(error => { 
            console.error(`Failed to get ticker from ${name}:`, error);
          })
      );
    }

    await Promise.all(promises);
    return results as Record<ExchangeName, TickerData>;
  }

  async getCandlesFromAllExchanges(
    symbol: string,
    timeframe: string,
    limit?: number
  ): Promise<Record<ExchangeName, CandleData[]>> {
    const results: Record<string, CandleData[]> = {};
    const promises: Promise<void>[] = [];

    for (const [name, exchange] of this.exchanges) {
      promises.push(
        exchange.getCandles(symbol, timeframe, limit)
          .then(candles => { results[name] = candles; })
          .catch(error => { 
            console.error(`Failed to get candles from ${name}:`, error);
          })
      );
    }

    await Promise.all(promises);
    return results as Record<ExchangeName, CandleData[]>;
  }

  /**
   * Health check for all exchanges
   */
  async healthCheck(): Promise<Record<ExchangeName, boolean>> {
    const results: Record<string, boolean> = {};
    const promises: Promise<void>[] = [];

    for (const [name, exchange] of this.exchanges) {
      promises.push(
        exchange.healthCheck()
          .then(isHealthy => { results[name] = isHealthy; })
          .catch(() => { results[name] = false; })
      );
    }

    await Promise.all(promises);
    return results as Record<ExchangeName, boolean>;
  }

  /**
   * Get exchange statistics
   */
  getStatistics(): Record<ExchangeName, { connected: boolean; subscriptions: number }> {
    const stats: Record<string, { connected: boolean; subscriptions: number }> = {};

    for (const [name, exchange] of this.exchanges) {
      stats[name] = {
        connected: exchange.isConnected(),
        subscriptions: 0, // Would need to track this in BaseExchange
      };
    }

    return stats as Record<ExchangeName, { connected: boolean; subscriptions: number }>;
  }

  // Private methods
  private createExchange(name: ExchangeName, config: any): BaseExchange {
    switch (name) {
      case 'binance':
        return new BinanceExchange(config);
      case 'kucoin':
        return new KuCoinExchange(config);
      default:
        throw new Error(`Unsupported exchange: ${name}`);
    }
  }

  private setupEventForwarding(exchange: BaseExchange, name: ExchangeName): void {
    // Forward all exchange events with exchange name prefix
    exchange.on('ticker', (data) => {
      this.emit('ticker', { exchange: name, data });
    });

    exchange.on('orderbook', (data) => {
      this.emit('orderbook', { exchange: name, data });
    });

    exchange.on('trade', (data) => {
      this.emit('trade', { exchange: name, data });
    });

    exchange.on('candle', (data) => {
      this.emit('candle', { exchange: name, data });
    });

    exchange.on('connected', () => {
      this.emit('exchangeConnected', name);
    });

    exchange.on('disconnected', () => {
      this.emit('exchangeDisconnected', name);
    });

    exchange.on('error', (error) => {
      this.emit('exchangeError', { exchange: name, error });
    });
  }

  private getExchangeInstance(exchange?: ExchangeName): BaseExchange {
    const exchangeName = exchange || this.defaultExchange;
    const exchangeInstance = this.exchanges.get(exchangeName);
    
    if (!exchangeInstance) {
      throw new Error(`Exchange ${exchangeName} is not available or not connected`);
    }
    
    return exchangeInstance;
  }
}