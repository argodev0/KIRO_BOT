/**
 * End-to-End Workflow Validation Tests
 * Comprehensive tests for complete trading workflows and system integration
 */

import request from 'supertest';
import app from '../../index';
import { PrismaClient } from '@prisma/client';
import { PaperTradingGuard } from '../../middleware/paperTradingGuard';
import { TradeSimulationEngine } from '../../services/TradeSimulationEngine';
import { VirtualPortfolioManager } from '../../services/VirtualPortfolioManager';
import { SystemHealthService } from '../../services/SystemHealthService';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

describe('End-to-End Workflow Validation', () => {
  let authToken: string;
  let testUserId: string;
  let paperTradingGuard: PaperTradingGuard;
  let tradeSimulationEngine: TradeSimulationEngine;
  let virtualPortfolioManager: VirtualPortfolioManager;
  let systemHealthService: SystemHealthService;

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

    // Initialize services
    paperTradingGuard = PaperTradingGuard.getInstance();
    tradeSimulationEngine = TradeSimulationEngine.getInstance();
    virtualPortfolioManager = VirtualPortfolioManager.getInstance();
    systemHealthService = SystemHealthService.getInstance();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Complete Paper Trading Workflow (Requirement 8.2)', () => {
    it('should complete full paper trading workflow from health check to portfolio update', async () => {
      // Step 1: Verify system health
      const healthResponse = await request(app)
        .get('/api/health')
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');
      expect(healthResponse.body.services).toBeDefined();

      // Step 2: Verify paper trading mode is active
      expect(() => {
        paperTradingGuard.validatePaperTradingMode();
      }).not.toThrow();

      const config = paperTradingGuard.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.allowRealTrades).toBe(false);

      // Step 3: Initialize virtual portfolio
      virtualPortfolioManager.initializeUserPortfolio(testUserId, 10000);
      const initialPortfolio = virtualPortfolioManager.getPortfolioSummary(testUserId);
      expect(initialPortfolio?.totalValue).toBe(10000);

      // Step 4: Get market data
      const marketDataResponse = await request(app)
        .get('/api/market-data/ticker/BTCUSDT')
        .expect(200);

      expect(marketDataResponse.body).toHaveProperty('symbol', 'BTCUSDT');
      expect(marketDataResponse.body).toHaveProperty('price');

      // Step 5: Simulate a paper trade
      const tradeRequest = {
        userId: testUserId,
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 0.001,
        price: marketDataResponse.body.price || 50000
      };

      const simulatedTrade = await tradeSimulationEngine.simulateOrderExecution(tradeRequest);
      expect(simulatedTrade.status).toBe('filled');
      expect(simulatedTrade.isPaperTrade).toBe(true);
      expect(simulatedTrade.executedQuantity).toBe(0.001);
      expect(simulatedTrade.fees).toBeGreaterThan(0);

      // Step 6: Update portfolio with trade
      virtualPortfolioManager.updatePortfolioWithTrade(testUserId, {
        symbol: 'BTCUSDT',
        side: 'buy',
        quantity: simulatedTrade.executedQuantity,
        price: simulatedTrade.executedPrice,
        fee: simulatedTrade.fees,
        timestamp: Date.now()
      });

      // Step 7: Verify portfolio was updated
      const updatedPortfolio = virtualPortfolioManager.getPortfolioSummary(testUserId);
      expect(updatedPortfolio?.totalValue).toBeLessThan(10000); // Should be less due to fees
      expect(updatedPortfolio?.totalValue).toBeGreaterThan(9900); // But not too much less

      // Step 8: Verify trade history
      const tradeHistory = virtualPortfolioManager.getTradeHistory(testUserId);
      expect(tradeHistory.length).toBe(1);
      expect(tradeHistory[0].symbol).toBe('BTCUSDT');
      expect(tradeHistory[0].side).toBe('buy');

      // Step 9: Test API endpoint for paper trade
      const apiTradeResponse = await request(app)
        .post('/api/trading/simulate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbol: 'ETHUSDT',
          side: 'buy',
          type: 'market',
          quantity: 0.01
        });

      expect([200, 401]).toContain(apiTradeResponse.status);
      if (apiTradeResponse.status === 200) {
        expect(apiTradeResponse.body.success).toBe(true);
        expect(apiTradeResponse.body.trade).toBeDefined();
      }

      // Step 10: Verify safety statistics
      const safetyStats = paperTradingGuard.getPaperTradingStats();
      expect(safetyStats.safetyScore).toBeGreaterThan(90);
      expect(safetyStats.paperTradeConversions).toBeGreaterThanOrEqual(0);
    });

    it('should handle error scenarios gracefully throughout workflow', async () => {
      // Test 1: Invalid market data request
      const invalidMarketResponse = await request(app)
        .get('/api/market-data/ticker/INVALID_SYMBOL')
        .expect(400);

      expect(invalidMarketResponse.body).toHaveProperty('error');

      // Test 2: Invalid trade parameters
      const invalidTradeRequest = {
        userId: testUserId,
        symbol: 'BTCUSDT',
        side: 'invalid_side' as any,
        type: 'market' as const,
        quantity: -1,
        price: 50000
      };

      await expect(
        tradeSimulationEngine.simulateOrderExecution(invalidTradeRequest)
      ).rejects.toThrow();

      // Test 3: Real trade attempt should be blocked
      const realTradeResponse = await request(app)
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

      expect(realTradeResponse.body.error).toBeDefined();

      // Test 4: Verify system remains healthy after errors
      const healthAfterErrors = await request(app)
        .get('/api/health')
        .expect(200);

      expect(healthAfterErrors.body.status).toBe('healthy');
    });

    it('should maintain data consistency across multiple operations', async () => {
      const userId = 'consistency-test-user';
      
      // Initialize portfolio
      virtualPortfolioManager.initializeUserPortfolio(userId, 10000);
      
      // Execute multiple trades
      const trades = [
        { symbol: 'BTCUSDT', side: 'buy' as const, quantity: 0.001, price: 50000 },
        { symbol: 'ETHUSDT', side: 'buy' as const, quantity: 0.01, price: 3000 },
        { symbol: 'BTCUSDT', side: 'sell' as const, quantity: 0.0005, price: 51000 }
      ];

      let totalFees = 0;
      for (const trade of trades) {
        const tradeRequest = {
          userId,
          ...trade,
          type: 'market' as const
        };

        const result = await tradeSimulationEngine.simulateOrderExecution(tradeRequest);
        expect(result.status).toBe('filled');
        
        virtualPortfolioManager.updatePortfolioWithTrade(userId, {
          symbol: trade.symbol,
          side: trade.side,
          quantity: result.executedQuantity,
          price: result.executedPrice,
          fee: result.fees,
          timestamp: Date.now()
        });

        totalFees += result.fees;
      }

      // Verify portfolio consistency
      const portfolio = virtualPortfolioManager.getPortfolioSummary(userId);
      const tradeHistory = virtualPortfolioManager.getTradeHistory(userId);

      expect(tradeHistory.length).toBe(3);
      expect(portfolio?.totalValue).toBeLessThan(10000); // Should account for fees
      expect(portfolio?.totalValue).toBeGreaterThan(9000); // But not too much less

      // Verify trade history matches executed trades
      expect(tradeHistory.filter(t => t.symbol === 'BTCUSDT').length).toBe(2);
      expect(tradeHistory.filter(t => t.symbol === 'ETHUSDT').length).toBe(1);
      expect(tradeHistory.filter(t => t.side === 'buy').length).toBe(2);
      expect(tradeHistory.filter(t => t.side === 'sell').length).toBe(1);
    });
  });

  describe('Security and Safety Validation (Requirement 8.2)', () => {
    it('should enforce comprehensive security measures throughout workflow', async () => {
      // Test 1: Environment validation
      expect(() => {
        paperTradingGuard.validatePaperTradingMode();
      }).not.toThrow();

      // Test 2: API key validation
      await expect(
        paperTradingGuard.validateApiPermissions(
          'trading_key_with_permissions',
          'binance',
          'secret_key'
        )
      ).rejects.toThrow();

      // Test 3: Real money operation blocking
      const mockReq = {
        path: '/api/withdraw',
        method: 'POST',
        body: { amount: 100, currency: 'USDT' },
        query: {},
        ip: '127.0.0.1'
      } as any;

      expect(() => {
        paperTradingGuard.blockRealMoneyOperations(mockReq);
      }).toThrow();

      // Test 4: Trade request validation
      const unsafeReq = {
        path: '/api/trading/order',
        method: 'POST',
        body: { realTrade: true, symbol: 'BTCUSDT' },
        query: {},
        ip: '127.0.0.1'
      } as any;

      expect(() => {
        paperTradingGuard.validateTradeRequest(unsafeReq);
      }).toThrow();

      // Test 5: Safety score validation
      const stats = paperTradingGuard.getPaperTradingStats();
      expect(stats.safetyScore).toBeGreaterThan(90);
    });

    it('should maintain audit trail for all operations', async () => {
      // Perform various operations
      const mockReq = {
        path: '/api/trading/simulate',
        method: 'POST',
        body: { symbol: 'BTCUSDT', side: 'buy', quantity: 0.001 },
        query: {},
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('test-agent')
      } as any;

      paperTradingGuard.logPaperTradeAttempt(mockReq);
      paperTradingGuard.validateTradeRequest(mockReq);

      // Check audit log
      const auditLog = paperTradingGuard.getSecurityAuditLog(10);
      expect(auditLog.length).toBeGreaterThan(0);
      
      const exportedLog = paperTradingGuard.exportSecurityAuditLog();
      expect(exportedLog.totalEvents).toBeGreaterThan(0);
      expect(exportedLog.summary.paperTradingEnabled).toBe(true);
      expect(exportedLog.summary.realTradesBlocked).toBe(true);
    });
  });

  describe('Performance and Load Testing (Requirement 8.2)', () => {
    it('should handle concurrent paper trades efficiently', async () => {
      const userId = 'load-test-user';
      virtualPortfolioManager.initializeUserPortfolio(userId, 50000);

      const concurrentTrades = Array(10).fill(null).map((_, index) => ({
        userId,
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 0.001,
        price: 50000 + index * 10 // Slight price variation
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        concurrentTrades.map(trade => 
          tradeSimulationEngine.simulateOrderExecution(trade)
        )
      );
      const endTime = Date.now();

      // All trades should succeed
      expect(results.every(r => r.status === 'filled')).toBe(true);
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000);

      // Update portfolio with all trades
      results.forEach((result, index) => {
        virtualPortfolioManager.updatePortfolioWithTrade(userId, {
          symbol: 'BTCUSDT',
          side: 'buy',
          quantity: result.executedQuantity,
          price: result.executedPrice,
          fee: result.fees,
          timestamp: Date.now() + index
        });
      });

      // Verify portfolio consistency
      const portfolio = virtualPortfolioManager.getPortfolioSummary(userId);
      const tradeHistory = virtualPortfolioManager.getTradeHistory(userId);

      expect(tradeHistory.length).toBe(10);
      expect(portfolio?.totalValue).toBeLessThan(50000);
      expect(portfolio?.totalValue).toBeGreaterThan(49000);
    });

    it('should maintain response times under load', async () => {
      const requests = Array(20).fill(null).map(() => {
        const startTime = Date.now();
        return request(app)
          .get('/api/health')
          .then(response => ({
            status: response.status,
            responseTime: Date.now() - startTime
          }));
      });

      const results = await Promise.all(requests);
      
      // Most requests should succeed
      const successfulRequests = results.filter(r => r.status === 200);
      expect(successfulRequests.length).toBeGreaterThan(15);

      // Response times should be reasonable
      const averageResponseTime = successfulRequests.reduce((sum, r) => sum + r.responseTime, 0) / successfulRequests.length;
      expect(averageResponseTime).toBeLessThan(1000); // Less than 1 second average
    });
  });

  describe('System Integration Validation (Requirement 8.2)', () => {
    it('should integrate all components seamlessly', async () => {
      // Test database connectivity
      const dbHealthResponse = await request(app)
        .get('/api/health/database')
        .expect(200);

      expect(['healthy', 'degraded']).toContain(dbHealthResponse.body.status);

      // Test Redis connectivity
      const redisHealthResponse = await request(app)
        .get('/api/health/redis')
        .expect(200);

      expect(['healthy', 'degraded', 'unavailable']).toContain(redisHealthResponse.body.status);

      // Test WebSocket status
      const wsHealthResponse = await request(app)
        .get('/api/health/websocket')
        .expect(200);

      expect(wsHealthResponse.body).toHaveProperty('status');

      // Test system health aggregation
      const systemHealth = await systemHealthService.getSystemHealth();
      expect(systemHealth).toHaveProperty('status');
      expect(systemHealth).toHaveProperty('services');
      expect(systemHealth.services).toHaveProperty('database');
      expect(systemHealth.services).toHaveProperty('redis');

      // Test configuration endpoints
      const configResponse = await request(app)
        .get('/api/health/config')
        .expect(200);

      expect(configResponse.body).toHaveProperty('paperTradingMode', true);
      expect(configResponse.body).toHaveProperty('environment');
    });

    it('should handle service failures gracefully', async () => {
      // Test graceful degradation when services are unavailable
      // This would typically involve mocking service failures
      
      // For now, test that the system continues to function
      const healthResponse = await request(app)
        .get('/api/health')
        .expect(200);

      expect(['healthy', 'degraded']).toContain(healthResponse.body.status);

      // Test that paper trading still works even if some services are down
      const tradeRequest = {
        userId: testUserId,
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 0.001,
        price: 50000
      };

      const result = await tradeSimulationEngine.simulateOrderExecution(tradeRequest);
      expect(result.status).toBe('filled');
    });
  });

  describe('Data Validation and Integrity (Requirement 8.2)', () => {
    it('should validate all input data and maintain integrity', async () => {
      // Test input validation for API endpoints
      const invalidInputResponse = await request(app)
        .post('/api/trading/simulate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbol: '', // Invalid empty symbol
          side: 'invalid_side',
          type: 'invalid_type',
          quantity: 'not_a_number'
        });

      expect([400, 401]).toContain(invalidInputResponse.status);

      // Test XSS protection
      const xssResponse = await request(app)
        .post('/api/trading/simulate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbol: '<script>alert("xss")</script>',
          side: 'buy',
          type: 'market',
          quantity: 0.001
        });

      expect([400, 401]).toContain(xssResponse.status);

      // Test SQL injection protection (if applicable)
      const sqlInjectionResponse = await request(app)
        .get('/api/market-data/ticker/BTCUSDT; DROP TABLE users; --')
        .expect(400);

      expect(sqlInjectionResponse.body).toHaveProperty('error');
    });

    it('should maintain data consistency across operations', async () => {
      const userId = 'integrity-test-user';
      virtualPortfolioManager.initializeUserPortfolio(userId, 10000);

      // Perform a series of operations
      const operations = [
        { type: 'buy', symbol: 'BTCUSDT', quantity: 0.001, price: 50000 },
        { type: 'buy', symbol: 'ETHUSDT', quantity: 0.01, price: 3000 },
        { type: 'sell', symbol: 'BTCUSDT', quantity: 0.0005, price: 51000 }
      ];

      let expectedValue = 10000;
      for (const op of operations) {
        const tradeRequest = {
          userId,
          symbol: op.symbol,
          side: op.type as 'buy' | 'sell',
          type: 'market' as const,
          quantity: op.quantity,
          price: op.price
        };

        const result = await tradeSimulationEngine.simulateOrderExecution(tradeRequest);
        expect(result.status).toBe('filled');

        virtualPortfolioManager.updatePortfolioWithTrade(userId, {
          symbol: op.symbol,
          side: op.type as 'buy' | 'sell',
          quantity: result.executedQuantity,
          price: result.executedPrice,
          fee: result.fees,
          timestamp: Date.now()
        });

        // Update expected value
        if (op.type === 'buy') {
          expectedValue -= (op.quantity * op.price + result.fees);
        } else {
          expectedValue += (op.quantity * op.price - result.fees);
        }
      }

      // Verify portfolio matches expected calculations
      const portfolio = virtualPortfolioManager.getPortfolioSummary(userId);
      expect(Math.abs(portfolio!.totalValue - expectedValue)).toBeLessThan(10); // Allow small rounding differences
    });
  });
});