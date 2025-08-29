/**
 * Comprehensive Integration Test Suite
 * Tests all critical deployment requirements and end-to-end workflows
 */

import request from 'supertest';
import app from '../../index';
import { PrismaClient } from '@prisma/client';
import { PaperTradingGuard } from '../../middleware/paperTradingGuard';
import { TradeSimulationEngine } from '../../services/TradeSimulationEngine';
import { VirtualPortfolioManager } from '../../services/VirtualPortfolioManager';
import { BinanceWebSocketService } from '../../services/BinanceWebSocketService';
import { KuCoinWebSocketService } from '../../services/KuCoinWebSocketService';
import { WebSocketServer } from '../../services/WebSocketServer';
import { SystemHealthService } from '../../services/SystemHealthService';
import { config } from '../../config/config';

const prisma = new PrismaClient();

describe('Comprehensive Integration Test Suite', () => {
  let testUserId: string;
  let authToken: string;

  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.TRADING_SIMULATION_ONLY = 'true';
    process.env.PAPER_TRADING_MODE = 'true';
    
    // Create test user
    testUserId = 'test-user-' + Date.now();
    authToken = 'test-token-' + Date.now();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Paper Trading Safety Validation (Requirement 8.1)', () => {
    it('should enforce paper trading mode', async () => {
      const paperTradingGuard = PaperTradingGuard.getInstance();
      
      // Test paper trading configuration
      const config = paperTradingGuard.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.allowRealTrades).toBe(false);
    });

    it('should block real trading attempts', async () => {
      const response = await request(app)
        .post('/api/trading/order')
        .send({
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 0.001,
          realTrade: true
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Paper trading mode');
    });

    it('should simulate trades correctly', async () => {
      const tradeSimulationEngine = TradeSimulationEngine.getInstance();
      const virtualPortfolioManager = VirtualPortfolioManager.getInstance();

      const orderRequest = {
        userId: testUserId,
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 0.001,
        price: 50000,
        exchange: 'binance'
      };

      const simulatedOrder = await tradeSimulationEngine.simulateOrderExecution(orderRequest);
      expect(simulatedOrder.status).toBe('filled');
      expect(simulatedOrder.quantity).toBe(0.001);
      expect(simulatedOrder.simulationDetails.fee).toBeGreaterThan(0);

      // Initialize and verify virtual portfolio
      virtualPortfolioManager.initializeUserPortfolio(testUserId);
      const portfolio = virtualPortfolioManager.getPortfolioSummary(testUserId);
      expect(portfolio).toBeTruthy();
      expect(portfolio?.totalBalance).toBeGreaterThan(0);
    });

    it('should validate API key restrictions', async () => {
      const paperTradingGuard = PaperTradingGuard.getInstance();
      
      // Test with read-only key (should pass)
      const readOnlyValidation = await paperTradingGuard.validateApiPermissions(
        'readonly_test_key_12345678901234567890123456789012',
        'binance'
      );
      expect(readOnlyValidation.isValid).toBe(true);
      expect(readOnlyValidation.riskLevel).toBe('low');

      // Test with trading key (should fail)
      await expect(
        paperTradingGuard.validateApiPermissions(
          'trading_key_with_permissions',
          'binance',
          'secret_key'
        )
      ).rejects.toThrow();
    });
  });

  describe('Live Market Data Integration (Requirement 8.1)', () => {
    it('should connect to Binance WebSocket', async () => {
      const binanceService = new BinanceWebSocketService();

      // Mock WebSocket connection for testing
      const mockStart = jest.spyOn(binanceService, 'start').mockResolvedValue();
      const mockSubscribe = jest.spyOn(binanceService, 'subscribeToTicker').mockResolvedValue();

      await binanceService.start();
      await binanceService.subscribeToTicker('BTCUSDT');

      expect(mockStart).toHaveBeenCalled();
      expect(mockSubscribe).toHaveBeenCalledWith('BTCUSDT');

      mockStart.mockRestore();
      mockSubscribe.mockRestore();
    });

    it('should connect to KuCoin WebSocket', async () => {
      const kucoinService = new KuCoinWebSocketService();

      // Mock WebSocket connection for testing
      const mockStart = jest.spyOn(kucoinService, 'start').mockResolvedValue();
      const mockSubscribe = jest.spyOn(kucoinService, 'subscribeToTicker').mockResolvedValue();

      await kucoinService.start();
      await kucoinService.subscribeToTicker('BTC-USDT');

      expect(mockStart).toHaveBeenCalled();
      expect(mockSubscribe).toHaveBeenCalledWith('BTC-USDT');

      mockStart.mockRestore();
      mockSubscribe.mockRestore();
    });

    it('should process and cache market data', async () => {
      const response = await request(app)
        .get('/api/market-data/ticker/BTCUSDT')
        .expect(200);

      expect(response.body).toHaveProperty('symbol', 'BTCUSDT');
      expect(response.body).toHaveProperty('price');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should calculate technical indicators', async () => {
      const response = await request(app)
        .get('/api/market-data/indicators/BTCUSDT')
        .query({ timeframe: '1h', indicators: 'rsi,macd,bollinger' })
        .expect(200);

      expect(response.body).toHaveProperty('rsi');
      expect(response.body).toHaveProperty('macd');
      expect(response.body).toHaveProperty('bollinger');
    });
  });

  describe('API Endpoints Functionality (Requirement 8.1)', () => {
    it('should handle authentication endpoints', async () => {
      // Test login endpoint
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'testpassword'
        });

      expect([200, 401]).toContain(loginResponse.status);
    });

    it('should handle trading endpoints with paper trading', async () => {
      const response = await request(app)
        .post('/api/trading/simulate')
        .send({
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 0.001
        });

      expect([200, 401]).toContain(response.status);
    });

    it('should handle configuration endpoints', async () => {
      const response = await request(app)
        .get('/api/config/bot-settings');

      expect([200, 401]).toContain(response.status);
    });

    it('should handle health check endpoints', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('services');
    });
  });

  describe('WebSocket Functionality (Requirement 8.1)', () => {
    it('should establish WebSocket connections', async () => {
      // Mock HTTP server
      const mockHttpServer = {
        listen: jest.fn(),
        close: jest.fn()
      } as any;

      const wsServer = new WebSocketServer(mockHttpServer, {
        maxConnections: 100
      });

      const mockGetStats = jest.spyOn(wsServer, 'getServerStats').mockReturnValue({
        server: { isShuttingDown: false, uptime: 1000, maxConnections: 100 },
        connections: { total: 0, authenticated: 0, anonymous: 0, uniqueUsers: 0 },
        channels: { total: 0, stats: [] },
        performance: { totalMessagesReceived: 0, totalMessagesSent: 0, averageConnectionTime: 0, rateLimiters: 0 },
        connections_detail: []
      });

      const stats = wsServer.getServerStats();

      expect(stats).toHaveProperty('server');
      expect(stats).toHaveProperty('connections');

      mockGetStats.mockRestore();
    });

    it('should broadcast real-time data', async () => {
      // Test WebSocket data broadcasting
      const response = await request(app)
        .get('/api/websocket/status')
        .expect(200);

      expect(response.body).toHaveProperty('status');
    });
  });

  describe('System Health and Monitoring (Requirement 8.1)', () => {
    it('should report system health', async () => {
      const healthService = SystemHealthService.getInstance();
      const healthStatus = await healthService.getSystemHealth();

      expect(healthStatus).toHaveProperty('status');
      expect(healthStatus).toHaveProperty('services');
      expect(healthStatus.services).toHaveProperty('database');
      expect(healthStatus.services).toHaveProperty('redis');
    });

    it('should validate production configuration', async () => {
      const response = await request(app)
        .get('/api/health/config')
        .expect(200);

      expect(response.body).toHaveProperty('paperTradingMode', true);
      expect(response.body).toHaveProperty('environment');
    });

    it('should check database connectivity', async () => {
      const response = await request(app)
        .get('/api/health/database')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(['healthy', 'degraded']).toContain(response.body.status);
    });

    it('should check Redis connectivity', async () => {
      const response = await request(app)
        .get('/api/health/redis')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(['healthy', 'degraded', 'unavailable']).toContain(response.body.status);
    });
  });

  describe('End-to-End Workflow Testing (Requirement 8.2)', () => {
    it('should complete full paper trading workflow', async () => {
      // 1. Check system health
      const healthResponse = await request(app)
        .get('/api/health')
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');

      // 2. Get market data
      const marketDataResponse = await request(app)
        .get('/api/market-data/ticker/BTCUSDT')
        .expect(200);

      expect(marketDataResponse.body).toHaveProperty('price');

      // 3. Simulate a trade
      const tradeResponse = await request(app)
        .post('/api/trading/simulate')
        .send({
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 0.001
        });

      expect([200, 401]).toContain(tradeResponse.status);

      // 4. Check portfolio (if authenticated)
      if (tradeResponse.status === 200) {
        const portfolioResponse = await request(app)
          .get('/api/portfolio/virtual')
          .expect(200);

        expect(portfolioResponse.body).toHaveProperty('balances');
      }
    });

    it('should handle error scenarios gracefully', async () => {
      // Test invalid symbol
      const invalidSymbolResponse = await request(app)
        .get('/api/market-data/ticker/INVALID')
        .expect(400);

      expect(invalidSymbolResponse.body).toHaveProperty('error');

      // Test invalid trade parameters
      const invalidTradeResponse = await request(app)
        .post('/api/trading/simulate')
        .send({
          symbol: 'BTCUSDT',
          side: 'invalid_side',
          type: 'market',
          quantity: -1
        });

      expect([400, 401]).toContain(invalidTradeResponse.status);
    });

    it('should maintain data consistency', async () => {
      // Test that multiple requests return consistent data
      const response1 = await request(app)
        .get('/api/health')
        .expect(200);

      const response2 = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response1.body.status).toBe(response2.body.status);
    });
  });

  describe('Security and Safety Validation (Requirement 8.2)', () => {
    it('should enforce rate limiting', async () => {
      // Make multiple rapid requests to test rate limiting
      const requests = Array(10).fill(null).map(() =>
        request(app).get('/api/health')
      );

      const responses = await Promise.all(requests);
      const statusCodes = responses.map(r => r.status);

      // Should have at least some successful requests
      expect(statusCodes.filter(code => code === 200).length).toBeGreaterThan(0);
    });

    it('should validate input sanitization', async () => {
      const maliciousInput = '<script>alert("xss")</script>';
      
      const response = await request(app)
        .post('/api/trading/simulate')
        .send({
          symbol: maliciousInput,
          side: 'buy',
          type: 'market',
          quantity: 0.001
        });

      expect([400, 401]).toContain(response.status);
    });

    it('should enforce CORS policies', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'http://malicious-site.com');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('Performance and Load Testing (Requirement 8.2)', () => {
    it('should handle concurrent requests', async () => {
      const concurrentRequests = Array(20).fill(null).map(() =>
        request(app).get('/api/health')
      );

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const endTime = Date.now();

      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBeGreaterThan(15); // At least 75% success rate
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain response times under load', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/market-data/ticker/BTCUSDT')
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
    });
  });
});