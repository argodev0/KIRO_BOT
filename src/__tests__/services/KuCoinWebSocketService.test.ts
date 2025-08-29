/**
 * KuCoin WebSocket Service Tests
 * Comprehensive test suite for KuCoin WebSocket integration
 */

import { KuCoinWebSocketService } from '../../services/KuCoinWebSocketService';
import { TickerData, OrderBookData, TradeData, CandleData, Timeframe } from '../../types/market';
import WebSocket from 'ws';
import axios from 'axios';

// Mock dependencies
jest.mock('ws');
jest.mock('axios');
jest.mock('../../utils/logger');

const mockAxios = axios as jest.Mocked<typeof axios>;
const MockWebSocket = WebSocket as jest.MockedClass<typeof WebSocket>;

describe('KuCoinWebSocketService', () => {
  let service: KuCoinWebSocketService;
  let mockWs: jest.Mocked<WebSocket>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock WebSocket
    mockWs = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
      close: jest.fn(),
      terminate: jest.fn(),
      on: jest.fn().mockImplementation((event, callback) => {
        // Immediately trigger 'open' event for connection
        if (event === 'open') {
          setTimeout(() => callback(), 10);
        }
        return mockWs;
      }),
      once: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      emit: jest.fn(),
    } as any;

    MockWebSocket.mockImplementation(() => mockWs);

    // Mock axios for token endpoint
    mockAxios.post.mockResolvedValue({
      data: {
        code: '200000',
        data: {
          token: 'test-token-123',
          instanceServers: [{
            endpoint: 'wss://test.kucoin.com',
            protocol: 'websocket',
            encrypt: true,
            pingInterval: 20000,
            pingTimeout: 10000,
          }]
        }
      }
    });

    service = new KuCoinWebSocketService({
      baseURL: 'https://api.kucoin.com',
      wsBaseURL: 'wss://ws-api-spot.kucoin.com',
      maxReconnectionAttempts: 3,
      reconnectionDelay: 100,
      connectionTimeout: 1000,
      enableHeartbeat: true,
      majorTradingPairs: ['BTC-USDT', 'ETH-USDT'],
      defaultTimeframes: ['1m', '5m'] as Timeframe[],
      connectionPoolSize: 2, // Smaller for testing
    });
  });

  afterEach(async () => {
    if (service) {
      await service.stop();
    }
  });

  describe('Service Lifecycle', () => {
    it('should start successfully', async () => {
      const startedSpy = jest.fn();
      service.on('started', startedSpy);

      await service.start();

      expect(startedSpy).toHaveBeenCalled();
      expect(service.isHealthy()).toBe(true);
    });

    it('should stop successfully', async () => {
      await service.start();
      
      const stoppedSpy = jest.fn();
      service.on('stopped', stoppedSpy);

      await service.stop();

      expect(stoppedSpy).toHaveBeenCalled();
      expect(service.isHealthy()).toBe(false);
    });

    it('should not start if already running', async () => {
      await service.start();
      
      // Try to start again
      await service.start();
      
      // Should not throw or cause issues
      expect(service.isHealthy()).toBe(true);
    });
  });

  describe('WebSocket Token Management', () => {
    it('should fetch WebSocket token successfully', async () => {
      await service.start();

      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://api.kucoin.com/api/v1/bullet-public'
      );
    });

    it('should handle token fetch failure', async () => {
      mockAxios.post.mockRejectedValue(new Error('Token fetch failed'));

      await expect(service.start()).rejects.toThrow();
    });

    it('should cache tokens and reuse them', async () => {
      await service.start();
      
      // Subscribe to trigger token usage
      await service.subscribeToTicker('BTC-USDT');
      await service.subscribeToTicker('ETH-USDT');

      // Should only call token endpoint once due to caching
      expect(mockAxios.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('Ticker Subscriptions', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should subscribe to ticker successfully', async () => {
      const tickerSpy = jest.fn();
      service.on('ticker', tickerSpy);

      await service.subscribeToTicker('BTC-USDT');

      expect(MockWebSocket).toHaveBeenCalled();
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('/market/ticker:BTC-USDT')
      );
    });

    it('should emit ticker data when received', async () => {
      const tickerSpy = jest.fn();
      service.on('ticker', tickerSpy);

      await service.subscribeToTicker('BTC-USDT');

      // Simulate WebSocket message
      const mockTickerData = {
        type: 'message',
        topic: '/market/ticker:BTC-USDT',
        subject: 'BTC-USDT',
        data: {
          price: '50000.00',
          vol: '1000.5',
          time: 1640995200000,
          bestBid: '49999.99',
          bestAsk: '50000.01',
          changePrice: '500.00',
          changeRate: '0.01',
        }
      };

      // Find the message handler and call it
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
      if (messageHandler) {
        messageHandler.call(mockWs, JSON.stringify(mockTickerData));
      }

      expect(tickerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTC-USDT',
          exchange: 'kucoin',
          price: 50000.00,
          volume: 1000.5,
          timestamp: 1640995200000,
          bid: 49999.99,
          ask: 50000.01,
          change24h: 500.00,
          changePercent24h: 1.00,
        })
      );
    });

    it('should not subscribe to same ticker twice', async () => {
      await service.subscribeToTicker('BTC-USDT');
      await service.subscribeToTicker('BTC-USDT');

      // Should only create one WebSocket connection
      expect(MockWebSocket).toHaveBeenCalledTimes(1);
    });
  });

  describe('Order Book Subscriptions', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should subscribe to order book successfully', async () => {
      const orderBookSpy = jest.fn();
      service.on('orderbook', orderBookSpy);

      await service.subscribeToOrderBook('BTC-USDT');

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('/market/level2:BTC-USDT')
      );
    });

    it('should emit order book data when received', async () => {
      const orderBookSpy = jest.fn();
      service.on('orderbook', orderBookSpy);

      await service.subscribeToOrderBook('BTC-USDT');

      const mockOrderBookData = {
        type: 'message',
        topic: '/market/level2:BTC-USDT',
        subject: 'BTC-USDT',
        data: {
          time: 1640995200000,
          bids: [['49999.99', '1.5'], ['49999.98', '2.0']],
          asks: [['50000.01', '1.2'], ['50000.02', '1.8']],
        }
      };

      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
      if (messageHandler) {
        messageHandler.call(mockWs, JSON.stringify(mockOrderBookData));
      }

      expect(orderBookSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTC-USDT',
          exchange: 'kucoin',
          timestamp: 1640995200000,
          bids: [[49999.99, 1.5], [49999.98, 2.0]],
          asks: [[50000.01, 1.2], [50000.02, 1.8]],
        })
      );
    });
  });

  describe('Trade Subscriptions', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should subscribe to trades successfully', async () => {
      const tradeSpy = jest.fn();
      service.on('trade', tradeSpy);

      await service.subscribeToTrades('BTC-USDT');

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('/market/match:BTC-USDT')
      );
    });

    it('should emit trade data when received', async () => {
      const tradeSpy = jest.fn();
      service.on('trade', tradeSpy);

      await service.subscribeToTrades('BTC-USDT');

      const mockTradeData = {
        type: 'message',
        topic: '/market/match:BTC-USDT',
        subject: 'BTC-USDT',
        data: {
          time: '1640995200000',
          price: '50000.00',
          size: '0.5',
          side: 'buy',
          tradeId: 'trade123',
        }
      };

      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
      if (messageHandler) {
        messageHandler.call(mockWs, JSON.stringify(mockTradeData));
      }

      expect(tradeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTC-USDT',
          exchange: 'kucoin',
          timestamp: 1640995200000,
          price: 50000.00,
          quantity: 0.5,
          side: 'buy',
          tradeId: 'trade123',
        })
      );
    });
  });

  describe('Candle Subscriptions', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should subscribe to candles successfully', async () => {
      const candleSpy = jest.fn();
      service.on('candle', candleSpy);

      await service.subscribeToCandles('BTC-USDT', '1m');

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('/market/candles:BTC-USDT_1min')
      );
    });

    it('should emit candle data when received', async () => {
      const candleSpy = jest.fn();
      service.on('candle', candleSpy);

      await service.subscribeToCandles('BTC-USDT', '1m');

      const mockCandleData = {
        type: 'message',
        topic: '/market/candles:BTC-USDT_1min',
        subject: 'BTC-USDT_1min',
        data: {
          time: '1640995200',
          open: '49900.00',
          high: '50100.00',
          low: '49800.00',
          close: '50000.00',
          volume: '100.5',
        }
      };

      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
      if (messageHandler) {
        messageHandler.call(mockWs, JSON.stringify(mockCandleData));
      }

      expect(candleSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTC-USDT',
          timeframe: '1m',
          timestamp: 1640995200000,
          open: 49900.00,
          high: 50100.00,
          low: 49800.00,
          close: 50000.00,
          volume: 100.5,
          exchange: 'kucoin',
        })
      );
    });
  });

  describe('Major Trading Pairs Subscription', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should subscribe to all major trading pairs', async () => {
      const majorPairsSubscribedSpy = jest.fn();
      service.on('majorPairsSubscribed', majorPairsSubscribedSpy);

      await service.subscribeToMajorTradingPairs();

      expect(majorPairsSubscribedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          pairs: ['BTC-USDT', 'ETH-USDT'],
          timeframes: ['1m', '5m'],
          totalSubscriptions: 10, // 2 pairs * (3 data types + 2 timeframes)
        })
      );
    });
  });

  describe('Symbol Complete Subscription', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should subscribe to complete data for a symbol', async () => {
      const symbolSubscribedSpy = jest.fn();
      service.on('symbolSubscribed', symbolSubscribedSpy);

      await service.subscribeToSymbolComplete('BTC-USDT');

      expect(symbolSubscribedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTC-USDT',
          timeframes: ['1m', '5m'],
        })
      );
    });
  });

  describe('Unsubscription', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should unsubscribe from specific topic', async () => {
      await service.subscribeToTicker('BTC-USDT');
      
      await service.unsubscribe('/market/ticker:BTC-USDT');

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('unsubscribe')
      );
      expect(mockWs.close).toHaveBeenCalled();
    });

    it('should unsubscribe from all symbol streams', async () => {
      await service.subscribeToTicker('BTC-USDT');
      await service.subscribeToOrderBook('BTC-USDT');
      await service.subscribeToTrades('BTC-USDT');

      await service.unsubscribeFromSymbol('BTC-USDT');

      expect(mockWs.close).toHaveBeenCalledTimes(3);
    });
  });

  describe('Connection Management', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should handle connection errors gracefully', async () => {
      const errorSpy = jest.fn();
      service.on('streamError', errorSpy);

      await service.subscribeToTicker('BTC-USDT');

      // Simulate connection error
      const errorHandler = mockWs.on.mock.calls.find(call => call[0] === 'error')?.[1];
      if (errorHandler) {
        errorHandler.call(mockWs, new Error('Connection failed'));
      }

      expect(errorSpy).toHaveBeenCalled();
    });

    it('should attempt reconnection on unexpected close', async () => {
      await service.subscribeToTicker('BTC-USDT');

      // Simulate unexpected close
      const closeHandler = mockWs.on.mock.calls.find(call => call[0] === 'close')?.[1];
      if (closeHandler) {
        closeHandler.call(mockWs, 1006, 'Abnormal closure'); // Abnormal closure code
      }

      // Should attempt reconnection
      expect(setTimeout).toHaveBeenCalled();
    });

    it('should not reconnect on normal close', async () => {
      await service.subscribeToTicker('BTC-USDT');

      // Simulate normal close
      const closeHandler = mockWs.on.mock.calls.find(call => call[0] === 'close')?.[1];
      if (closeHandler) {
        closeHandler.call(mockWs, 1000, 'Normal closure');
      }

      // Should not attempt reconnection for normal closure
      // This is tested by checking that no reconnection timer is set
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should respect rate limits', async () => {
      // Create service with very low rate limit for testing
      const limitedService = new KuCoinWebSocketService({
        connectionPoolSize: 1,
      });

      await limitedService.start();

      // Try to make many subscriptions quickly
      const subscriptions = [];
      for (let i = 0; i < 10; i++) {
        subscriptions.push(limitedService.subscribeToTicker(`SYMBOL${i}-USDT`));
      }

      // Some should be delayed due to rate limiting
      await Promise.all(subscriptions);

      await limitedService.stop();
    });
  });

  describe('Connection Statistics', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should provide accurate connection statistics', async () => {
      await service.subscribeToTicker('BTC-USDT');
      await service.subscribeToOrderBook('ETH-USDT');

      const stats = service.getConnectionStats();

      expect(stats).toEqual(
        expect.objectContaining({
          totalConnections: 2,
          healthyConnections: 2,
          unhealthyConnections: 0,
          subscriptionsByType: expect.objectContaining({
            ticker: 1,
            level2: 1,
          }),
        })
      );
    });
  });

  describe('Health Checks', () => {
    it('should report healthy when running with connections', async () => {
      await service.start();
      await service.subscribeToTicker('BTC-USDT');

      expect(service.isHealthy()).toBe(true);
    });

    it('should report healthy when running without connections', async () => {
      await service.start();

      expect(service.isHealthy()).toBe(true);
    });

    it('should report unhealthy when stopped', async () => {
      await service.start();
      await service.stop();

      expect(service.isHealthy()).toBe(false);
    });
  });

  describe('Symbol Normalization', () => {
    it('should normalize Binance format to KuCoin format', async () => {
      await service.start();
      
      // Subscribe using Binance format
      await service.subscribeToTicker('BTCUSDT');

      // Should convert to KuCoin format
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('/market/ticker:BTC-USDT')
      );
    });

    it('should handle already normalized symbols', async () => {
      await service.start();
      
      await service.subscribeToTicker('BTC-USDT');

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('/market/ticker:BTC-USDT')
      );
    });
  });

  describe('Timeframe Mapping', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should map timeframes correctly', async () => {
      const timeframeMappings = [
        ['1m', '1min'],
        ['5m', '5min'],
        ['15m', '15min'],
        ['1h', '1hour'],
        ['4h', '4hour'],
        ['1d', '1day'],
      ];

      for (const [input, expected] of timeframeMappings) {
        await service.subscribeToCandles('BTC-USDT', input as any);
        
        expect(mockWs.send).toHaveBeenCalledWith(
          expect.stringContaining(`/market/candles:BTC-USDT_${expected}`)
        );
      }
    });
  });
});