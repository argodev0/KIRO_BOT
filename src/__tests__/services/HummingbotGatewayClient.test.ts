/**
 * Unit tests for HummingbotGatewayClient
 */

import axios from 'axios';
import { HummingbotGatewayClient } from '../../services/HummingbotGatewayClient';
import { HBStrategy } from '../../types';

// Mock axios
jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

describe('HummingbotGatewayClient', () => {
  let client: HummingbotGatewayClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    };

    mockAxios.create.mockReturnValue(mockAxiosInstance);

    // Create client instance
    client = new HummingbotGatewayClient({
      baseURL: 'http://localhost:5000/api/v1',
      timeout: 10000,
      retryAttempts: 2,
      authToken: 'test-token',
      rateLimitPerSecond: 5
    });
  });

  afterEach(() => {
    client.removeAllListeners();
  });

  describe('Constructor', () => {
    it('should create client with default configuration', () => {
      const defaultClient = new HummingbotGatewayClient({});
      expect(defaultClient).toBeDefined();
    });

    it('should create axios instance with correct configuration', () => {
      expect(mockAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:5000/api/v1',
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AI-Crypto-Trading-Bot-Gateway-Client/1.0',
          'Authorization': 'Bearer test-token'
        }
      });
    });

    it('should setup interceptors', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('testConnection', () => {
    it('should return true for successful connection test', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: { success: true },
        config: { headers: { 'X-Request-ID': 'test-id' } }
      });

      const result = await client.testConnection();
      expect(result).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health');
    });

    it('should return false for failed connection test', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Connection failed'));

      const result = await client.testConnection();
      expect(result).toBe(false);
    });

    it('should emit connection test failed event', (done) => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Connection failed'));

      client.on('connection:test_failed', (error) => {
        expect(error).toBeDefined();
        done();
      });

      client.testConnection();
    });
  });

  describe('getHealth', () => {
    it('should return health status', async () => {
      const mockHealthStatus = {
        instanceId: 'test-instance',
        status: 'running',
        uptime: 3600,
        lastHealthCheck: Date.now(),
        healthScore: 95,
        issues: [],
        metrics: {
          cpuUsage: 50,
          memoryUsage: 60,
          diskUsage: 30,
          networkLatency: 10,
          errorRate: 1,
          responseTime: 100,
          activeConnections: 5,
          queueDepth: 0
        }
      };

      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: { success: true, data: mockHealthStatus },
        config: { headers: { 'X-Request-ID': 'test-id' } }
      });

      const health = await client.getHealth();
      expect(health).toEqual(mockHealthStatus);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health/detailed');
    });
  });

  describe('getSupportedStrategies', () => {
    it('should return list of supported strategies', async () => {
      const mockStrategies = ['pure_market_making', 'grid_trading', 'arbitrage'];

      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: { success: true, data: mockStrategies },
        config: { headers: { 'X-Request-ID': 'test-id' } }
      });

      const strategies = await client.getSupportedStrategies();
      expect(strategies).toEqual(mockStrategies);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/strategies/supported');
    });
  });

  describe('createStrategy', () => {
    const mockStrategy: HBStrategy = {
      type: 'pure_market_making',
      exchange: 'binance',
      tradingPair: 'BTC-USDT',
      parameters: {
        bidSpread: 0.1,
        askSpread: 0.1,
        orderAmount: 100
      },
      riskLimits: {
        maxPositionSize: 1000,
        maxDailyLoss: 100,
        maxOpenOrders: 10,
        maxSlippage: 0.5
      },
      executionSettings: {
        orderRefreshTime: 30,
        orderRefreshTolerance: 0.1,
        filledOrderDelay: 5,
        orderOptimization: true,
        addTransactionCosts: true,
        priceSource: 'current_market'
      }
    };

    it('should create strategy successfully', async () => {
      const mockExecution = {
        id: 'strategy-1',
        strategyType: 'pure_market_making',
        instanceId: 'test-instance',
        status: 'active',
        startTime: Date.now(),
        parameters: mockStrategy.parameters,
        performance: {
          totalTrades: 0,
          successfulTrades: 0,
          totalVolume: 0,
          totalPnL: 0,
          averageLatency: 0,
          averageSlippage: 0,
          fillRate: 0,
          maxDrawdown: 0,
          currentDrawdown: 0,
          profitFactor: 0,
          sharpeRatio: 0,
          winRate: 0
        },
        orders: [],
        trades: [],
        errors: []
      };

      mockAxiosInstance.post.mockResolvedValue({
        status: 200,
        data: { success: true, data: mockExecution },
        config: { headers: { 'X-Request-ID': 'test-id' } }
      });

      const execution = await client.createStrategy(mockStrategy);
      expect(execution).toEqual(mockExecution);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/strategies', mockStrategy);
    });

    it('should handle strategy creation failure', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        response: {
          status: 400,
          data: { error: 'Invalid strategy configuration' }
        },
        config: { headers: { 'X-Request-ID': 'test-id' } }
      });

      await expect(client.createStrategy(mockStrategy))
        .rejects.toMatchObject({
          message: 'Invalid strategy configuration'
        });
    });
  });

  describe('getStrategy', () => {
    it('should get strategy by ID', async () => {
      const mockExecution = {
        id: 'strategy-1',
        strategyType: 'pure_market_making',
        status: 'active'
      };

      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: { success: true, data: mockExecution },
        config: { headers: { 'X-Request-ID': 'test-id' } }
      });

      const execution = await client.getStrategy('strategy-1');
      expect(execution).toEqual(mockExecution);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/strategies/strategy-1');
    });
  });

  describe('startStrategy', () => {
    it('should start strategy successfully', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        status: 200,
        data: { success: true, data: { success: true } },
        config: { headers: { 'X-Request-ID': 'test-id' } }
      });

      const result = await client.startStrategy('strategy-1');
      expect(result).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/strategies/strategy-1/start');
    });

    it('should handle start strategy failure', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        status: 200,
        data: { success: true, data: { success: false } },
        config: { headers: { 'X-Request-ID': 'test-id' } }
      });

      const result = await client.startStrategy('strategy-1');
      expect(result).toBe(false);
    });
  });

  describe('stopStrategy', () => {
    it('should stop strategy successfully', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        status: 200,
        data: { success: true, data: { success: true } },
        config: { headers: { 'X-Request-ID': 'test-id' } }
      });

      const result = await client.stopStrategy('strategy-1');
      expect(result).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/strategies/strategy-1/stop');
    });
  });

  describe('getStrategyMetrics', () => {
    it('should get strategy performance metrics', async () => {
      const mockMetrics = {
        totalTrades: 100,
        totalVolume: 50000,
        totalPnL: 1000,
        averageLatency: 150,
        fillRate: 0.95,
        winRate: 0.6
      };

      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: { success: true, data: mockMetrics },
        config: { headers: { 'X-Request-ID': 'test-id' } }
      });

      const metrics = await client.getStrategyMetrics('strategy-1');
      expect(metrics).toEqual(mockMetrics);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/strategies/strategy-1/metrics');
    });
  });

  describe('getStrategyOrders', () => {
    it('should get strategy orders', async () => {
      const mockOrders = [
        {
          orderId: 'order-1',
          strategyId: 'strategy-1',
          symbol: 'BTC-USDT',
          side: 'buy',
          type: 'limit',
          quantity: 0.001,
          price: 50000,
          status: 'open',
          filledQuantity: 0,
          timestamp: Date.now(),
          exchange: 'binance'
        }
      ];

      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: { success: true, data: mockOrders },
        config: { headers: { 'X-Request-ID': 'test-id' } }
      });

      const orders = await client.getStrategyOrders('strategy-1');
      expect(orders).toEqual(mockOrders);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/strategies/strategy-1/orders');
    });
  });

  describe('validateStrategy', () => {
    const mockStrategy: HBStrategy = {
      type: 'pure_market_making',
      exchange: 'binance',
      tradingPair: 'BTC-USDT',
      parameters: {},
      riskLimits: {
        maxPositionSize: 1000,
        maxDailyLoss: 100,
        maxOpenOrders: 10,
        maxSlippage: 0.5
      },
      executionSettings: {
        orderRefreshTime: 30,
        orderRefreshTolerance: 0.1,
        filledOrderDelay: 5,
        orderOptimization: true,
        addTransactionCosts: true,
        priceSource: 'current_market'
      }
    };

    it('should validate strategy successfully', async () => {
      const mockValidation = {
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: []
      };

      mockAxiosInstance.post.mockResolvedValue({
        status: 200,
        data: { success: true, data: mockValidation },
        config: { headers: { 'X-Request-ID': 'test-id' } }
      });

      const validation = await client.validateStrategy(mockStrategy);
      expect(validation).toEqual(mockValidation);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/strategies/validate', mockStrategy);
    });

    it('should return validation errors', async () => {
      const mockValidation = {
        isValid: false,
        errors: [
          { field: 'parameters.bidSpread', message: 'Bid spread is required', code: 'REQUIRED' }
        ],
        warnings: [],
        suggestions: []
      };

      mockAxiosInstance.post.mockResolvedValue({
        status: 200,
        data: { success: true, data: mockValidation },
        config: { headers: { 'X-Request-ID': 'test-id' } }
      });

      const validation = await client.validateStrategy(mockStrategy);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(1);
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits', async () => {
      // Mock multiple rapid requests
      const promises = [];
      for (let i = 0; i < 10; i++) {
        mockAxiosInstance.get.mockResolvedValue({
          status: 200,
          data: { success: true },
          config: { headers: { 'X-Request-ID': `test-id-${i}` } }
        });
        promises.push(client.testConnection());
      }

      // All requests should complete, but some may be delayed due to rate limiting
      const results = await Promise.all(promises);
      expect(results.every(r => r === true)).toBe(true);
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed requests', async () => {
      // First call fails, second succeeds
      mockAxiosInstance.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          status: 200,
          data: { success: true },
          config: { headers: { 'X-Request-ID': 'test-id' } }
        });

      const result = await client.testConnection();
      expect(result).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retry attempts', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Persistent error'));

      await expect(client.testConnection()).rejects.toThrow('Persistent error');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });

  describe('Error Handling', () => {
    it('should transform axios errors correctly', async () => {
      const axiosError = {
        response: {
          status: 400,
          data: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: { field: 'value' }
          }
        },
        config: { headers: { 'X-Request-ID': 'test-id' } }
      };

      mockAxiosInstance.get.mockRejectedValue(axiosError);

      try {
        await client.testConnection();
      } catch (error: any) {
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.message).toBe('Invalid request');
        expect(error.details).toEqual({ field: 'value' });
        expect(error.requestId).toBe('test-id');
      }
    });

    it('should handle network errors', async () => {
      const networkError = {
        code: 'ECONNREFUSED',
        message: 'Connection refused',
        config: { headers: { 'X-Request-ID': 'test-id' } }
      };

      mockAxiosInstance.get.mockRejectedValue(networkError);

      try {
        await client.testConnection();
      } catch (error: any) {
        expect(error.code).toBe('ECONNREFUSED');
        expect(error.message).toBe('Connection refused');
      }
    });
  });

  describe('Metrics', () => {
    it('should track request metrics', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: { success: true },
        config: { 
          headers: { 'X-Request-ID': 'test-id' },
          metadata: { startTime: Date.now() - 100 }
        }
      });

      await client.testConnection();

      const metrics = client.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
    });

    it('should track failed requests', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Request failed'));

      try {
        await client.testConnection();
      } catch (error) {
        // Expected to fail
      }

      const metrics = client.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(1);
    });

    it('should reset metrics', () => {
      client.resetMetrics();
      const metrics = client.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.averageResponseTime).toBe(0);
    });
  });

  describe('Event Emissions', () => {
    it('should emit request start events', (done) => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: { success: true },
        config: { headers: { 'X-Request-ID': 'test-id' } }
      });

      client.on('request:start', (event) => {
        expect(event.requestId).toBe('test-id');
        expect(event.method).toBe('get');
        expect(event.url).toBe('/health');
        done();
      });

      client.testConnection();
    });

    it('should emit request success events', (done) => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: { success: true },
        config: { 
          headers: { 'X-Request-ID': 'test-id' },
          method: 'get',
          url: '/health',
          metadata: { startTime: Date.now() - 100 }
        }
      });

      client.on('request:success', (event) => {
        expect(event.requestId).toBe('test-id');
        expect(event.status).toBe(200);
        expect(event.responseTime).toBeGreaterThan(0);
        done();
      });

      client.testConnection();
    });

    it('should emit request error events', (done) => {
      mockAxiosInstance.get.mockRejectedValue({
        message: 'Request failed',
        config: { 
          headers: { 'X-Request-ID': 'test-id' },
          method: 'get',
          url: '/health',
          metadata: { startTime: Date.now() - 100 }
        }
      });

      client.on('request:error', (event) => {
        expect(event.requestId).toBe('test-id');
        expect(event.error).toBe('Request failed');
        done();
      });

      client.testConnection().catch(() => {
        // Expected to fail
      });
    });
  });
});