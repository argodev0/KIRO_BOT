/**
 * KuCoin Market Data Integration Tests
 * Integration tests for KuCoin WebSocket service with real-time data streaming
 */

import { KuCoinWebSocketService } from '../../services/KuCoinWebSocketService';
import { UnifiedMarketDataService } from '../../services/UnifiedMarketDataService';
import { TickerData, OrderBookData, TradeData, CandleData } from '../../types/market';

describe('KuCoin Market Data Integration', () => {
  let kucoinService: KuCoinWebSocketService;
  let unifiedService: UnifiedMarketDataService;

  beforeEach(() => {
    kucoinService = new KuCoinWebSocketService({
      baseURL: 'https://api.kucoin.com',
      wsBaseURL: 'wss://ws-api-spot.kucoin.com',
      maxReconnectionAttempts: 3,
      reconnectionDelay: 1000,
      connectionTimeout: 10000,
      enableHeartbeat: true,
      majorTradingPairs: ['BTC-USDT', 'ETH-USDT', 'BNB-USDT'],
      defaultTimeframes: ['1m', '5m', '15m'],
      connectionPoolSize: 5,
    });

    unifiedService = new UnifiedMarketDataService({
      binance: { enabled: false },
      kucoin: { 
        enabled: true,
        config: {
          majorTradingPairs: ['BTC-USDT', 'ETH-USDT'],
          defaultTimeframes: ['1min', '5min'],
        }
      },
      defaultExchange: 'kucoin',
      aggregateData: true,
      cacheEnabled: true,
    });
  });

  afterEach(async () => {
    if (kucoinService) {
      await kucoinService.stop();
    }
    if (unifiedService) {
      await unifiedService.stop();
    }
  });

  describe('KuCoin Service Integration', () => {
    it('should start and connect successfully', async () => {
      const startedPromise = new Promise<void>((resolve) => {
        kucoinService.once('started', resolve);
      });

      await kucoinService.start();
      await startedPromise;

      expect(kucoinService.isHealthy()).toBe(true);
    }, 15000);

    it('should subscribe to ticker and receive data', async () => {
      await kucoinService.start();

      const tickerPromise = new Promise<TickerData>((resolve) => {
        kucoinService.once('ticker', resolve);
      });

      await kucoinService.subscribeToTicker('BTC-USDT');

      const ticker = await tickerPromise;

      expect(ticker).toEqual(
        expect.objectContaining({
          symbol: expect.stringContaining('BTC'),
          exchange: 'kucoin',
          price: expect.any(Number),
          volume: expect.any(Number),
          timestamp: expect.any(Number),
          bid: expect.any(Number),
          ask: expect.any(Number),
        })
      );
    }, 20000);

    it('should subscribe to order book and receive data', async () => {
      await kucoinService.start();

      const orderBookPromise = new Promise<OrderBookData>((resolve) => {
        kucoinService.once('orderbook', resolve);
      });

      await kucoinService.subscribeToOrderBook('BTC-USDT');

      const orderBook = await orderBookPromise;

      expect(orderBook).toEqual(
        expect.objectContaining({
          symbol: expect.stringContaining('BTC'),
          exchange: 'kucoin',
          timestamp: expect.any(Number),
          bids: expect.arrayContaining([
            expect.arrayContaining([expect.any(Number), expect.any(Number)])
          ]),
          asks: expect.arrayContaining([
            expect.arrayContaining([expect.any(Number), expect.any(Number)])
          ]),
        })
      );
    }, 20000);

    it('should subscribe to trades and receive data', async () => {
      await kucoinService.start();

      const tradePromise = new Promise<TradeData>((resolve) => {
        kucoinService.once('trade', resolve);
      });

      await kucoinService.subscribeToTrades('BTC-USDT');

      const trade = await tradePromise;

      expect(trade).toEqual(
        expect.objectContaining({
          symbol: expect.stringContaining('BTC'),
          exchange: 'kucoin',
          timestamp: expect.any(Number),
          price: expect.any(Number),
          quantity: expect.any(Number),
          side: expect.stringMatching(/^(buy|sell)$/),
          tradeId: expect.any(String),
        })
      );
    }, 20000);

    it('should subscribe to candles and receive data', async () => {
      await kucoinService.start();

      const candlePromise = new Promise<CandleData>((resolve) => {
        kucoinService.once('candle', resolve);
      });

      await kucoinService.subscribeToCandles('BTC-USDT', '1m');

      const candle = await candlePromise;

      expect(candle).toEqual(
        expect.objectContaining({
          symbol: expect.stringContaining('BTC'),
          timeframe: '1m',
          exchange: 'kucoin',
          timestamp: expect.any(Number),
          open: expect.any(Number),
          high: expect.any(Number),
          low: expect.any(Number),
          close: expect.any(Number),
          volume: expect.any(Number),
        })
      );
    }, 20000);

    it('should handle multiple simultaneous subscriptions', async () => {
      await kucoinService.start();

      const dataPromises = [
        new Promise<TickerData>((resolve) => kucoinService.once('ticker', resolve)),
        new Promise<OrderBookData>((resolve) => kucoinService.once('orderbook', resolve)),
        new Promise<TradeData>((resolve) => kucoinService.once('trade', resolve)),
      ];

      // Subscribe to multiple data types for the same symbol
      await Promise.all([
        kucoinService.subscribeToTicker('BTC-USDT'),
        kucoinService.subscribeToOrderBook('BTC-USDT'),
        kucoinService.subscribeToTrades('BTC-USDT'),
      ]);

      const [ticker, orderBook, trade] = await Promise.all(dataPromises);

      expect(ticker.exchange).toBe('kucoin');
      expect(orderBook.exchange).toBe('kucoin');
      expect(trade.exchange).toBe('kucoin');
    }, 25000);

    it('should subscribe to major trading pairs successfully', async () => {
      await kucoinService.start();

      const majorPairsPromise = new Promise<any>((resolve) => {
        kucoinService.once('majorPairsSubscribed', resolve);
      });

      await kucoinService.subscribeToMajorTradingPairs();

      const result = await majorPairsPromise;

      expect(result).toEqual(
        expect.objectContaining({
          pairs: expect.arrayContaining(['BTC-USDT', 'ETH-USDT', 'BNB-USDT']),
          timeframes: expect.arrayContaining(['1min', '5min', '15min']),
          totalSubscriptions: expect.any(Number),
        })
      );
    }, 30000);

    it('should provide accurate connection statistics', async () => {
      await kucoinService.start();
      
      // Subscribe to some streams
      await kucoinService.subscribeToTicker('BTC-USDT');
      await kucoinService.subscribeToOrderBook('ETH-USDT');

      // Wait a bit for connections to establish
      await new Promise(resolve => setTimeout(resolve, 2000));

      const stats = kucoinService.getConnectionStats();

      expect(stats).toEqual(
        expect.objectContaining({
          totalConnections: expect.any(Number),
          healthyConnections: expect.any(Number),
          subscriptionsByType: expect.objectContaining({
            ticker: expect.any(Number),
            level2: expect.any(Number),
          }),
          connectionPoolUtilization: expect.any(Number),
          rateLimitStatus: expect.objectContaining({
            tokensUsed: expect.any(Number),
            tokensRemaining: expect.any(Number),
            resetTime: expect.any(Number),
          }),
        })
      );

      expect(stats.totalConnections).toBeGreaterThan(0);
      expect(stats.healthyConnections).toBeGreaterThan(0);
    }, 15000);
  });

  describe('Unified Service Integration', () => {
    it('should start with KuCoin service enabled', async () => {
      const startedPromise = new Promise<void>((resolve) => {
        unifiedService.once('started', resolve);
      });

      await unifiedService.start();
      await startedPromise;

      expect(unifiedService.isHealthy()).toBe(true);
      expect(unifiedService.getEnabledExchanges()).toEqual(['kucoin']);
    }, 15000);

    it('should forward KuCoin ticker events', async () => {
      await unifiedService.start();

      const tickerPromise = new Promise<any>((resolve) => {
        unifiedService.once('ticker', resolve);
      });

      await unifiedService.subscribeToTicker('BTC-USDT');

      const tickerEvent = await tickerPromise;

      expect(tickerEvent).toEqual(
        expect.objectContaining({
          exchange: 'kucoin',
          data: expect.objectContaining({
            symbol: expect.stringContaining('BTC'),
            exchange: 'kucoin',
            price: expect.any(Number),
          }),
        })
      );
    }, 20000);

    it('should aggregate connection statistics', async () => {
      await unifiedService.start();
      
      await unifiedService.subscribeToTicker('BTC-USDT');
      
      // Wait for connections to establish
      await new Promise(resolve => setTimeout(resolve, 2000));

      const stats = unifiedService.getConnectionStats();

      expect(stats).toEqual(
        expect.objectContaining({
          kucoin: expect.objectContaining({
            totalConnections: expect.any(Number),
            healthyConnections: expect.any(Number),
          }),
          totalConnections: expect.any(Number),
          healthyConnections: expect.any(Number),
          overallHealth: expect.any(Boolean),
        })
      );

      expect(stats.totalConnections).toBeGreaterThan(0);
    }, 15000);

    it('should handle symbol normalization between exchanges', async () => {
      await unifiedService.start();

      // Subscribe using Binance format (should be converted to KuCoin format)
      await unifiedService.subscribeToTicker('BTCUSDT');

      const tickerPromise = new Promise<any>((resolve) => {
        unifiedService.once('ticker', resolve);
      });

      const tickerEvent = await tickerPromise;

      expect(tickerEvent.exchange).toBe('kucoin');
      expect(tickerEvent.data.symbol).toMatch(/BTC.*USDT/);
    }, 20000);
  });

  describe('Error Handling and Resilience', () => {
    it('should handle connection failures gracefully', async () => {
      const errorPromise = new Promise<any>((resolve) => {
        kucoinService.once('streamError', resolve);
      });

      await kucoinService.start();

      // Try to subscribe to an invalid symbol to trigger an error
      await kucoinService.subscribeToTicker('INVALID-SYMBOL');

      // Should not throw, but may emit error events
      expect(kucoinService.isHealthy()).toBe(true);
    }, 15000);

    it('should maintain health status during normal operations', async () => {
      await kucoinService.start();
      
      expect(kucoinService.isHealthy()).toBe(true);

      await kucoinService.subscribeToTicker('BTC-USDT');
      
      // Wait for subscription to establish
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      expect(kucoinService.isHealthy()).toBe(true);
    }, 15000);

    it('should handle rate limiting appropriately', async () => {
      await kucoinService.start();

      // Make multiple rapid subscriptions
      const subscriptions = [];
      for (let i = 0; i < 5; i++) {
        subscriptions.push(kucoinService.subscribeToTicker(`SYMBOL${i}-USDT`));
      }

      // Should handle rate limiting without throwing errors
      await Promise.allSettled(subscriptions);

      expect(kucoinService.isHealthy()).toBe(true);
    }, 20000);
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple symbol subscriptions efficiently', async () => {
      await kucoinService.start();

      const symbols = ['BTC-USDT', 'ETH-USDT', 'BNB-USDT', 'ADA-USDT', 'XRP-USDT'];
      const startTime = Date.now();

      const subscriptionPromises = symbols.map(symbol => 
        kucoinService.subscribeToTicker(symbol)
      );

      await Promise.all(subscriptionPromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete subscriptions within reasonable time
      expect(duration).toBeLessThan(10000); // 10 seconds
      expect(kucoinService.isHealthy()).toBe(true);

      const stats = kucoinService.getConnectionStats();
      expect(stats.totalConnections).toBeGreaterThanOrEqual(symbols.length);
    }, 20000);

    it('should maintain connection pool efficiently', async () => {
      await kucoinService.start();

      // Wait for connection pool to initialize
      await new Promise(resolve => setTimeout(resolve, 3000));

      const stats = kucoinService.getConnectionStats();
      
      expect(stats.connectionPoolUtilization).toBeGreaterThan(0);
      expect(stats.connectionPoolUtilization).toBeLessThanOrEqual(1);
    }, 10000);
  });

  describe('Data Quality and Consistency', () => {
    it('should receive consistent ticker data format', async () => {
      await kucoinService.start();

      const tickerPromise = new Promise<TickerData>((resolve) => {
        kucoinService.once('ticker', resolve);
      });

      await kucoinService.subscribeToTicker('BTC-USDT');

      const ticker = await tickerPromise;

      // Validate data types and ranges
      expect(typeof ticker.price).toBe('number');
      expect(ticker.price).toBeGreaterThan(0);
      expect(typeof ticker.volume).toBe('number');
      expect(ticker.volume).toBeGreaterThanOrEqual(0);
      expect(typeof ticker.timestamp).toBe('number');
      expect(ticker.timestamp).toBeGreaterThan(Date.now() - 60000); // Within last minute
      expect(ticker.bid).toBeLessThanOrEqual(ticker.ask);
    }, 20000);

    it('should receive valid order book data', async () => {
      await kucoinService.start();

      const orderBookPromise = new Promise<OrderBookData>((resolve) => {
        kucoinService.once('orderbook', resolve);
      });

      await kucoinService.subscribeToOrderBook('BTC-USDT');

      const orderBook = await orderBookPromise;

      // Validate order book structure
      expect(Array.isArray(orderBook.bids)).toBe(true);
      expect(Array.isArray(orderBook.asks)).toBe(true);
      expect(orderBook.bids.length).toBeGreaterThan(0);
      expect(orderBook.asks.length).toBeGreaterThan(0);

      // Validate bid/ask ordering
      if (orderBook.bids.length > 1) {
        expect(orderBook.bids[0][0]).toBeGreaterThanOrEqual(orderBook.bids[1][0]);
      }
      if (orderBook.asks.length > 1) {
        expect(orderBook.asks[0][0]).toBeLessThanOrEqual(orderBook.asks[1][0]);
      }
    }, 20000);
  });
});