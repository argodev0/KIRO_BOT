/**
 * KuCoin Exchange Integration Tests
 * Tests for KuCoin API connectivity and functionality
 */

import { KuCoinExchange } from '../../../services/exchanges/KuCoinExchange';
import axios from 'axios';

// Mock axios and WebSocket
jest.mock('axios');
jest.mock('ws', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1, // OPEN
  }));
});

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('KuCoinExchange Integration Tests', () => {
  let exchange: KuCoinExchange;
  let mockAxiosInstance: any;

  const mockConfig = {
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    passphrase: 'test-passphrase',
    sandbox: true,
    rateLimits: {
      requests: 1800,
      interval: 60000,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: {
          use: jest.fn(),
        },
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    
    exchange = new KuCoinExchange(mockConfig);
  });

  describe('Connection Management', () => {
    it('should connect successfully with valid credentials', async () => {
      const mockExchangeInfo = {
        code: '200000',
        data: [
          { symbol: 'BTC-USDT' },
          { symbol: 'ETH-USDT' },
        ],
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockExchangeInfo });

      await expect(exchange.connect()).resolves.not.toThrow();
      expect(exchange.isConnected()).toBe(true);
    });

    it('should handle API errors during connection', async () => {
      const mockErrorResponse = {
        code: '400001',
        msg: 'Invalid API key',
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockErrorResponse });

      await expect(exchange.connect()).rejects.toThrow('KuCoin API error: Invalid API key');
    });

    it('should emit connection events', async () => {
      const mockExchangeInfo = {
        code: '200000',
        data: [],
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockExchangeInfo });

      const connectedSpy = jest.fn();
      exchange.on('connected', connectedSpy);

      await exchange.connect();
      expect(connectedSpy).toHaveBeenCalled();
    });

    it('should disconnect and clean up WebSocket connections', async () => {
      const mockExchangeInfo = {
        code: '200000',
        data: [],
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockExchangeInfo });

      await exchange.connect();
      await exchange.disconnect();
      
      expect(exchange.isConnected()).toBe(false);
    });
  });

  describe('Market Data API', () => {
    it('should fetch ticker data correctly', async () => {
      const mockTicker = {
        code: '200000',
        data: {
          symbol: 'BTC-USDT',
          last: '50000.00',
          vol: '1000.00',
          buy: '49999.00',
          sell: '50001.00',
          changePrice: '500.00',
          changeRate: '0.01',
        },
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockTicker });

      const ticker = await exchange.getTicker('BTC-USDT');

      expect(ticker).toEqual({
        symbol: 'BTC-USDT',
        exchange: 'kucoin',
        price: 50000,
        volume: 1000,
        timestamp: expect.any(Number),
        bid: 49999,
        ask: 50001,
        change24h: 500,
        changePercent24h: 1,
      });
    });

    it('should fetch order book data correctly', async () => {
      const mockOrderBook = {
        code: '200000',
        data: {
          time: Date.now(),
          bids: [['49999.00', '1.00'], ['49998.00', '2.00']],
          asks: [['50001.00', '1.50'], ['50002.00', '2.50']],
        },
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockOrderBook });

      const orderBook = await exchange.getOrderBook('BTC-USDT', 100);

      expect(orderBook).toEqual({
        symbol: 'BTC-USDT',
        exchange: 'kucoin',
        timestamp: mockOrderBook.data.time,
        bids: [[49999, 1], [49998, 2]],
        asks: [[50001, 1.5], [50002, 2.5]],
      });
    });

    it('should fetch candle data correctly', async () => {
      const mockCandles = {
        code: '200000',
        data: [
          ['1640995200', '50000.00', '50500.00', '51000.00', '49000.00', '100.00', '5000000.00'],
          ['1640998800', '50500.00', '51000.00', '51500.00', '49500.00', '150.00', '7500000.00'],
        ],
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockCandles });

      const candles = await exchange.getCandles('BTC-USDT', '1h', 2);

      expect(candles).toHaveLength(2);
      expect(candles[0]).toEqual({
        symbol: 'BTC-USDT',
        timeframe: '1h',
        timestamp: 1640995200000,
        open: 50000,
        high: 51000,
        low: 49000,
        close: 50500,
        volume: 100,
      });
    });

    it('should fetch recent trades correctly', async () => {
      const mockTrades = {
        code: '200000',
        data: [
          {
            sequence: '1234567890',
            time: '1640995200000',
            price: '50000.00',
            size: '0.001',
            side: 'buy',
          },
        ],
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockTrades });

      const trades = await exchange.getRecentTrades('BTC-USDT', 1);

      expect(trades).toHaveLength(1);
      expect(trades[0]).toEqual({
        symbol: 'BTC-USDT',
        exchange: 'kucoin',
        timestamp: 1640995200000,
        price: 50000,
        quantity: 0.001,
        side: 'buy',
        tradeId: '1234567890',
      });
    });

    it('should handle API errors gracefully', async () => {
      const apiError = {
        code: '400001',
        msg: 'Invalid symbol',
      };

      mockAxiosInstance.get.mockResolvedValue({ data: apiError });

      await expect(exchange.getTicker('INVALID')).rejects.toThrow('KuCoin API error: Invalid symbol');
    });
  });

  describe('Trading Operations', () => {
    it('should place orders correctly', async () => {
      const mockOrderResponse = {
        code: '200000',
        data: {
          orderId: 'test-order-123',
        },
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockOrderResponse });

      const orderRequest = {
        symbol: 'BTC-USDT',
        side: 'buy' as const,
        type: 'limit' as const,
        quantity: 0.001,
        price: 50000,
        exchange: 'kucoin',
      };

      const result = await exchange.placeOrder(orderRequest);

      expect(result).toEqual({
        orderId: 'test-order-123',
        clientOrderId: expect.any(String),
        symbol: 'BTC-USDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.001,
        price: 50000,
        status: 'new',
        timestamp: expect.any(Number),
        exchange: 'kucoin',
      });
    });

    it('should cancel orders correctly', async () => {
      const mockCancelResponse = {
        code: '200000',
        data: {
          cancelledOrderIds: ['test-order-123'],
        },
      };

      mockAxiosInstance.delete.mockResolvedValue({ data: mockCancelResponse });

      const result = await exchange.cancelOrder('test-order-123', 'BTC-USDT');
      expect(result).toBe(true);
    });

    it('should fetch order details correctly', async () => {
      const mockOrderDetails = {
        code: '200000',
        data: {
          id: 'test-order-123',
          clientOid: 'client-123',
          symbol: 'BTC-USDT',
          side: 'buy',
          type: 'limit',
          size: '0.001',
          price: '50000.00',
          isActive: false,
          cancelExist: false,
          createdAt: Date.now(),
        },
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockOrderDetails });

      const order = await exchange.getOrder('test-order-123', 'BTC-USDT');

      expect(order).toEqual({
        orderId: 'test-order-123',
        clientOrderId: 'client-123',
        symbol: 'BTC-USDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.001,
        price: 50000,
        status: 'filled',
        timestamp: mockOrderDetails.data.createdAt,
        exchange: 'kucoin',
      });
    });

    it('should fetch account balance correctly', async () => {
      const mockBalance = {
        code: '200000',
        data: [
          { currency: 'BTC', type: 'trade', balance: '1.50000000' },
          { currency: 'USDT', type: 'trade', balance: '10000.00000000' },
          { currency: 'ETH', type: 'trade', balance: '0.00000000' },
        ],
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockBalance });

      const balance = await exchange.getBalance();

      expect(balance).toEqual({
        BTC: 1.5,
        USDT: 10000,
      });
    });
  });

  describe('WebSocket Token Management', () => {
    it('should fetch WebSocket token successfully', async () => {
      const mockTokenResponse = {
        code: '200000',
        data: {
          token: 'test-ws-token',
          instanceServers: [
            {
              endpoint: 'wss://ws-api-spot.kucoin.com/',
              encrypt: true,
              protocol: 'websocket',
              pingInterval: 18000,
              pingTimeout: 10000,
            },
          ],
        },
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockTokenResponse });

      // Access private method for testing
      const getWebSocketToken = (exchange as any).getWebSocketToken.bind(exchange);
      const tokenData = await getWebSocketToken();

      expect(tokenData).toEqual({
        token: 'test-ws-token',
        endpoint: 'wss://ws-api-spot.kucoin.com/',
      });
    });

    it('should handle WebSocket token errors', async () => {
      const mockErrorResponse = {
        code: '400001',
        msg: 'Invalid request',
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockErrorResponse });

      const getWebSocketToken = (exchange as any).getWebSocketToken.bind(exchange);
      
      await expect(getWebSocketToken()).rejects.toThrow('Failed to get WebSocket token: Invalid request');
    });
  });

  describe('Health Monitoring', () => {
    it('should perform health checks', async () => {
      const mockExchangeInfo = {
        code: '200000',
        data: [],
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockExchangeInfo });

      const isHealthy = await exchange.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should detect unhealthy state', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Server error'));

      const isHealthy = await exchange.healthCheck();
      expect(isHealthy).toBe(false);
    });

    it('should emit health check events', async () => {
      const healthCheckSpy = jest.fn();
      exchange.on('healthCheck', healthCheckSpy);

      const mockExchangeInfo = {
        code: '200000',
        data: [],
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockExchangeInfo });

      await exchange.healthCheck();
      
      expect(healthCheckSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          responseTime: expect.any(Number),
          timestamp: expect.any(Number),
        })
      );
    });
  });

  describe('Error Handling and Retry Logic', () => {
    it('should handle network errors with retry', async () => {
      const networkError = new Error('ECONNRESET');
      mockAxiosInstance.get
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({ 
          data: { 
            code: '200000', 
            data: { last: '50000' } 
          } 
        });

      const retryAttemptSpy = jest.fn();
      exchange.on('retryAttempt', retryAttemptSpy);

      const ticker = await exchange.getTicker('BTC-USDT');
      
      expect(retryAttemptSpy).toHaveBeenCalled();
      expect(ticker.price).toBe(50000);
    });

    it('should emit error events for unrecoverable errors', async () => {
      const errorSpy = jest.fn();
      exchange.on('error', errorSpy);

      const criticalError = new Error('Authentication failed');
      mockAxiosInstance.get.mockRejectedValue(criticalError);

      await expect(exchange.getTicker('BTC-USDT')).rejects.toThrow();
      
      // Wait for error event to be emitted
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should handle rate limiting correctly', async () => {
      const rateLimitSpy = jest.fn();

      // Create exchange with very low rate limit for testing
      const limitedExchange = new KuCoinExchange({
        ...mockConfig,
        rateLimits: { requests: 1, interval: 1000 }
      });
      
      limitedExchange.on('rateLimitHit', rateLimitSpy);

      mockAxiosInstance.get.mockResolvedValue({ 
        data: { 
          code: '200000', 
          data: { last: '50000' } 
        } 
      });

      // First request should succeed
      await limitedExchange.getTicker('BTC-USDT');
      
      // Second request should trigger rate limit
      const secondPromise = limitedExchange.getTicker('BTC-USDT');
      
      // Wait for rate limit to be triggered
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(rateLimitSpy).toHaveBeenCalled();
      
      // Clean up
      await secondPromise;
    });
  });

  describe('Data Validation', () => {
    it('should validate symbol format', async () => {
      const mockTicker = {
        code: '200000',
        data: {
          symbol: 'BTC-USDT',
          last: '50000.00',
          vol: '1000.00',
          buy: '49999.00',
          sell: '50001.00',
          changePrice: '500.00',
          changeRate: '0.01',
        },
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockTicker });

      // Test with various symbol formats
      await expect(exchange.getTicker('BTC-USDT')).resolves.toBeDefined();
      await expect(exchange.getTicker('BTCUSDT')).resolves.toBeDefined();
    });

    it('should handle malformed API responses', async () => {
      const malformedResponse = {
        code: '200000',
        data: {
          // Missing required fields
          symbol: 'BTC-USDT',
        },
      };

      mockAxiosInstance.get.mockResolvedValue({ data: malformedResponse });

      // Should handle gracefully and provide default values
      const ticker = await exchange.getTicker('BTC-USDT');
      expect(ticker.symbol).toBe('BTC-USDT');
      expect(ticker.exchange).toBe('kucoin');
    });
  });
});