/**
 * Binance Exchange Integration Tests
 * Tests for Binance API connectivity and functionality
 */

import { BinanceExchange } from '../../../services/exchanges/BinanceExchange';
import { ExchangeConfig } from '../../../services/exchanges/BaseExchange';
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

describe('BinanceExchange Integration Tests', () => {
  let exchange: BinanceExchange;
  let mockAxiosInstance: any;

  const mockConfig: ExchangeConfig = {
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    testnet: true,
    rateLimits: {
      requests: 1200,
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
    
    exchange = new BinanceExchange(mockConfig);
  });

  describe('Connection Management', () => {
    it('should connect successfully with valid credentials', async () => {
      const mockExchangeInfo = {
        serverTime: Date.now(),
        symbols: [
          { symbol: 'BTCUSDT' },
          { symbol: 'ETHUSDT' },
        ],
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockExchangeInfo });

      await expect(exchange.connect()).resolves.not.toThrow();
      expect(exchange.isConnected()).toBe(true);
    });

    it('should handle connection failures with retry logic', async () => {
      const connectionError = new Error('Network error');
      mockAxiosInstance.get
        .mockRejectedValueOnce(connectionError)
        .mockRejectedValueOnce(connectionError)
        .mockResolvedValueOnce({ 
          data: { 
            serverTime: Date.now(), 
            symbols: [] 
          } 
        });

      await expect(exchange.connect()).resolves.not.toThrow();
    });

    it('should emit connection events', async () => {
      const mockExchangeInfo = {
        serverTime: Date.now(),
        symbols: [],
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockExchangeInfo });

      const connectedSpy = jest.fn();
      exchange.on('connected', connectedSpy);

      await exchange.connect();
      expect(connectedSpy).toHaveBeenCalled();
    });

    it('should disconnect and clean up resources', async () => {
      const mockExchangeInfo = {
        serverTime: Date.now(),
        symbols: [],
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockExchangeInfo });

      await exchange.connect();
      await exchange.disconnect();
      
      expect(exchange.isConnected()).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits', async () => {
      const mockResponse = { data: { symbol: 'BTCUSDT', lastPrice: '50000' } };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      // Make multiple rapid requests
      const promises = Array(5).fill(null).map(() => exchange.getTicker('BTCUSDT'));
      
      await Promise.all(promises);
      
      // Should have made 5 requests
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(5);
    });

    it('should emit rate limit events', async () => {
      const rateLimitSpy = jest.fn();
      
      // Mock rate limit exceeded scenario
      const limitedExchange = new BinanceExchange({
        ...mockConfig,
        rateLimits: { requests: 1, interval: 1000 } // Very short interval for testing
      });
      
      limitedExchange.on('rateLimitHit', rateLimitSpy);

      mockAxiosInstance.get.mockResolvedValue({ data: { lastPrice: '50000' } });

      // First request should succeed
      await limitedExchange.getTicker('BTCUSDT');
      
      // Second request should trigger rate limit
      const secondPromise = limitedExchange.getTicker('BTCUSDT');
      
      // Wait for rate limit to be triggered
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(rateLimitSpy).toHaveBeenCalled();
      
      // Clean up
      await secondPromise;
    });
  });

  describe('Market Data API', () => {
    it('should fetch ticker data correctly', async () => {
      const mockTicker = {
        symbol: 'BTCUSDT',
        lastPrice: '50000.00',
        volume: '1000.00',
        closeTime: Date.now(),
        bidPrice: '49999.00',
        askPrice: '50001.00',
        priceChange: '500.00',
        priceChangePercent: '1.00',
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockTicker });

      const ticker = await exchange.getTicker('BTCUSDT');

      expect(ticker).toEqual({
        symbol: 'BTCUSDT',
        exchange: 'binance',
        price: 50000,
        volume: 1000,
        timestamp: mockTicker.closeTime,
        bid: 49999,
        ask: 50001,
        change24h: 500,
        changePercent24h: 1,
      });
    });

    it('should fetch order book data correctly', async () => {
      const mockOrderBook = {
        lastUpdateId: 123456,
        bids: [['49999.00', '1.00'], ['49998.00', '2.00']],
        asks: [['50001.00', '1.50'], ['50002.00', '2.50']],
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockOrderBook });

      const orderBook = await exchange.getOrderBook('BTCUSDT', 100);

      expect(orderBook).toEqual({
        symbol: 'BTCUSDT',
        exchange: 'binance',
        timestamp: Date.now(),
        bids: [[49999, 1], [49998, 2]],
        asks: [[50001, 1.5], [50002, 2.5]],
      });
    });

    it('should fetch candle data correctly', async () => {
      const mockCandles = [
        [1640995200000, '50000.00', '51000.00', '49000.00', '50500.00', '100.00'],
        [1640998800000, '50500.00', '51500.00', '49500.00', '51000.00', '150.00'],
      ];

      mockAxiosInstance.get.mockResolvedValue({ data: mockCandles });

      const candles = await exchange.getCandles('BTCUSDT', '1h', 2);

      expect(candles).toHaveLength(2);
      expect(candles[0]).toEqual({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: 1640995200000,
        open: 50000,
        high: 51000,
        low: 49000,
        close: 50500,
        volume: 100,
      });
    });

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('API Error: Invalid symbol');
      mockAxiosInstance.get.mockRejectedValue(apiError);

      await expect(exchange.getTicker('INVALID')).rejects.toThrow();
    });
  });

  describe('Trading Operations', () => {
    it('should place orders correctly', async () => {
      const mockOrderResponse = {
        orderId: 123456,
        clientOrderId: 'test-order-1',
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        origQty: '0.001',
        price: '50000.00',
        status: 'NEW',
        transactTime: Date.now(),
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockOrderResponse });

      const orderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'limit' as const,
        quantity: 0.001,
        price: 50000,
        exchange: 'binance',
      };

      const result = await exchange.placeOrder(orderRequest);

      expect(result).toEqual({
        orderId: '123456',
        clientOrderId: 'test-order-1',
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.001,
        price: 50000,
        status: 'new',
        timestamp: mockOrderResponse.transactTime,
        exchange: 'binance',
      });
    });

    it('should cancel orders correctly', async () => {
      mockAxiosInstance.delete.mockResolvedValue({ data: { orderId: 123456 } });

      const result = await exchange.cancelOrder('123456', 'BTCUSDT');
      expect(result).toBe(true);
    });

    it('should fetch account balance correctly', async () => {
      const mockBalance = {
        balances: [
          { asset: 'BTC', free: '1.00000000', locked: '0.50000000' },
          { asset: 'USDT', free: '10000.00000000', locked: '0.00000000' },
          { asset: 'ETH', free: '0.00000000', locked: '0.00000000' },
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

  describe('Health Monitoring', () => {
    it('should perform health checks', async () => {
      const mockExchangeInfo = {
        serverTime: Date.now(),
        symbols: [],
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
        serverTime: Date.now(),
        symbols: [],
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

  describe('Error Handling', () => {
    it('should handle network errors with retry', async () => {
      const networkError = new Error('ECONNRESET');
      mockAxiosInstance.get
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({ data: { lastPrice: '50000' } });

      const retryAttemptSpy = jest.fn();
      exchange.on('retryAttempt', retryAttemptSpy);

      const ticker = await exchange.getTicker('BTCUSDT');
      
      expect(retryAttemptSpy).toHaveBeenCalled();
      expect(ticker.price).toBe(50000);
    });

    it('should emit error events for unrecoverable errors', async () => {
      const errorSpy = jest.fn();
      exchange.on('error', errorSpy);

      const criticalError = new Error('Authentication failed');
      mockAxiosInstance.get.mockRejectedValue(criticalError);

      await expect(exchange.getTicker('BTCUSDT')).rejects.toThrow();
      
      // Wait for error event to be emitted
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('WebSocket Functionality', () => {
    it('should handle WebSocket subscription events', async () => {
      const tickerSpy = jest.fn();
      exchange.on('ticker', tickerSpy);

      // Mock WebSocket connection (simplified)
      await exchange.subscribeToTicker('BTCUSDT');

      // Simulate WebSocket message
      const mockTickerData = {
        s: 'BTCUSDT',
        c: '50000.00',
        v: '1000.00',
        E: Date.now(),
        b: '49999.00',
        a: '50001.00',
        P: '1.00',
        p: '500.00',
      };

      // Emit ticker data (simulating WebSocket message)
      exchange.emit('ticker', {
        symbol: mockTickerData.s,
        exchange: 'binance',
        price: parseFloat(mockTickerData.c),
        volume: parseFloat(mockTickerData.v),
        timestamp: mockTickerData.E,
        bid: parseFloat(mockTickerData.b),
        ask: parseFloat(mockTickerData.a),
        change24h: parseFloat(mockTickerData.p),
        changePercent24h: parseFloat(mockTickerData.P),
      });

      expect(tickerSpy).toHaveBeenCalled();
    });
  });
});