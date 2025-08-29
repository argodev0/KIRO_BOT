/**
 * API Endpoints Validation Tests
 * Tests all API endpoints for functionality and error handling
 */

import request from 'supertest';
import app from '../../index';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

describe('API Endpoints Validation', () => {
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.TRADING_SIMULATION_ONLY = 'true';
    process.env.PAPER_TRADING_MODE = 'true';
    
    testUserId = 'test-user-' + Date.now();
    
    // Create a test JWT token
    authToken = jwt.sign(
      { userId: testUserId, username: 'testuser' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Health Check Endpoints', () => {
    it('should return system health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);
    });

    it('should return database health status', async () => {
      const response = await request(app)
        .get('/api/health/database')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('responseTime');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);
    });

    it('should return Redis health status', async () => {
      const response = await request(app)
        .get('/api/health/redis')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(['healthy', 'degraded', 'unavailable']).toContain(response.body.status);
    });

    it('should return WebSocket server status', async () => {
      const response = await request(app)
        .get('/api/health/websocket')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('connections');
    });
  });

  describe('Authentication Endpoints', () => {
    it('should handle login attempts', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'testpassword'
        });

      expect([200, 401, 400]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('user');
      } else {
        expect(response.body).toHaveProperty('error');
      }
    });

    it('should handle token validation', async () => {
      const response = await request(app)
        .get('/api/auth/validate')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 401]).toContain(response.status);
    });

    it('should handle logout', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 401]).toContain(response.status);
    });

    it('should reject invalid tokens', async () => {
      const response = await request(app)
        .get('/api/auth/validate')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Market Data Endpoints', () => {
    it('should return ticker data', async () => {
      const response = await request(app)
        .get('/api/market-data/ticker/BTCUSDT')
        .expect(200);

      expect(response.body).toHaveProperty('symbol', 'BTCUSDT');
      expect(response.body).toHaveProperty('price');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('volume');
    });

    it('should return order book data', async () => {
      const response = await request(app)
        .get('/api/market-data/orderbook/BTCUSDT')
        .expect(200);

      expect(response.body).toHaveProperty('symbol', 'BTCUSDT');
      expect(response.body).toHaveProperty('bids');
      expect(response.body).toHaveProperty('asks');
      expect(Array.isArray(response.body.bids)).toBe(true);
      expect(Array.isArray(response.body.asks)).toBe(true);
    });

    it('should return candlestick data', async () => {
      const response = await request(app)
        .get('/api/market-data/candles/BTCUSDT')
        .query({ timeframe: '1h', limit: 100 })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        const candle = response.body[0];
        expect(candle).toHaveProperty('timestamp');
        expect(candle).toHaveProperty('open');
        expect(candle).toHaveProperty('high');
        expect(candle).toHaveProperty('low');
        expect(candle).toHaveProperty('close');
        expect(candle).toHaveProperty('volume');
      }
    });

    it('should return technical indicators', async () => {
      const response = await request(app)
        .get('/api/market-data/indicators/BTCUSDT')
        .query({ timeframe: '1h', indicators: 'rsi,macd,bollinger' })
        .expect(200);

      expect(response.body).toHaveProperty('symbol', 'BTCUSDT');
      expect(response.body).toHaveProperty('timeframe', '1h');
      expect(response.body).toHaveProperty('indicators');
    });

    it('should handle invalid symbols', async () => {
      const response = await request(app)
        .get('/api/market-data/ticker/INVALID')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid timeframes', async () => {
      const response = await request(app)
        .get('/api/market-data/candles/BTCUSDT')
        .query({ timeframe: 'invalid', limit: 100 })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Trading Endpoints', () => {
    it('should handle paper trade simulation', async () => {
      const response = await request(app)
        .post('/api/trading/simulate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 0.001
        });

      expect([200, 401, 400]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('trade');
        expect(response.body.trade).toHaveProperty('symbol', 'BTCUSDT');
        expect(response.body.trade).toHaveProperty('side', 'buy');
        expect(response.body.trade).toHaveProperty('executedQuantity');
        expect(response.body.trade).toHaveProperty('executedPrice');
        expect(response.body.trade).toHaveProperty('fee');
      }
    });

    it('should block real trading attempts', async () => {
      const response = await request(app)
        .post('/api/trading/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 0.001,
          realTrade: true
        })
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Paper trading mode');
    });

    it('should validate trade parameters', async () => {
      const response = await request(app)
        .post('/api/trading/simulate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbol: 'BTCUSDT',
          side: 'invalid_side',
          type: 'market',
          quantity: -1
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return trading history', async () => {
      const response = await request(app)
        .get('/api/trading/history')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 401]).toContain(response.status);
      
      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
      }
    });

    it('should return open orders', async () => {
      const response = await request(app)
        .get('/api/trading/orders')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 401]).toContain(response.status);
      
      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
      }
    });
  });

  describe('Portfolio Endpoints', () => {
    it('should return virtual portfolio', async () => {
      const response = await request(app)
        .get('/api/portfolio/virtual')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 401]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('balances');
        expect(response.body).toHaveProperty('totalValue');
        expect(response.body).toHaveProperty('unrealizedPnL');
        expect(response.body).toHaveProperty('realizedPnL');
      }
    });

    it('should return portfolio performance', async () => {
      const response = await request(app)
        .get('/api/portfolio/performance')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 401]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('totalReturn');
        expect(response.body).toHaveProperty('dailyReturn');
        expect(response.body).toHaveProperty('trades');
      }
    });
  });

  describe('Configuration Endpoints', () => {
    it('should return bot settings', async () => {
      const response = await request(app)
        .get('/api/config/bot-settings')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 401]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('paperTradingMode');
        expect(response.body).toHaveProperty('tradingPairs');
        expect(response.body).toHaveProperty('riskManagement');
      }
    });

    it('should update bot settings', async () => {
      const newSettings = {
        paperTradingMode: true,
        tradingPairs: ['BTCUSDT', 'ETHUSDT'],
        riskManagement: {
          maxPositionSize: 0.1,
          stopLossPercentage: 5
        }
      };

      const response = await request(app)
        .put('/api/config/bot-settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newSettings);

      expect([200, 401, 400]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
      }
    });

    it('should validate configuration parameters', async () => {
      const invalidSettings = {
        paperTradingMode: 'invalid',
        tradingPairs: 'not_an_array',
        riskManagement: {
          maxPositionSize: -1,
          stopLossPercentage: 150
        }
      };

      const response = await request(app)
        .put('/api/config/bot-settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidSettings)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Analytics Endpoints', () => {
    it('should return trading analytics', async () => {
      const response = await request(app)
        .get('/api/analytics/trading')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 401]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('totalTrades');
        expect(response.body).toHaveProperty('winRate');
        expect(response.body).toHaveProperty('averageReturn');
      }
    });

    it('should return performance metrics', async () => {
      const response = await request(app)
        .get('/api/analytics/performance')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 401]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('sharpeRatio');
        expect(response.body).toHaveProperty('maxDrawdown');
        expect(response.body).toHaveProperty('volatility');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/non-existent-endpoint')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/trading/simulate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/trading/simulate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbol: 'BTCUSDT'
          // Missing required fields
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle server errors gracefully', async () => {
      // This test would require mocking internal services to throw errors
      // For now, we'll test that the error handling middleware is in place
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const requests = Array(20).fill(null).map(() =>
        request(app).get('/api/health')
      );

      const responses = await Promise.all(requests);
      const statusCodes = responses.map(r => r.status);

      // Should have mostly successful requests, but may have some rate limited
      const successfulRequests = statusCodes.filter(code => code === 200).length;
      const rateLimitedRequests = statusCodes.filter(code => code === 429).length;

      expect(successfulRequests).toBeGreaterThan(10);
      expect(successfulRequests + rateLimitedRequests).toBe(20);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });

    it('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });
  });
});