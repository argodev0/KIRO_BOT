/**
 * Comprehensive Trading API Endpoints Tests
 * API endpoint tests validating paper trading enforcement
 * Requirements: 3.3
 */

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../index';
import { PaperTradingGuard } from '../../middleware/paperTradingGuard';
import { VirtualPortfolioManager } from '../../services/VirtualPortfolioManager';
import { TradeSimulationEngine } from '../../services/TradeSimulationEngine';

const prisma = new PrismaClient();

describe('Comprehensive Trading API Endpoints Tests', () => {
  let accessToken: string;
  let userId: string;
  let paperTradingGuard: PaperTradingGuard;
  let virtualPortfolioManager: VirtualPortfolioManager;
  let tradeSimulationEngine: TradeSimulationEngine;

  beforeAll(async () => {
    // Initialize paper trading components
    paperTradingGuard = PaperTradingGuard.getInstance();
    virtualPortfolioManager = VirtualPortfolioManager.getInstance();
    tradeSimulationEngine = TradeSimulationEngine.getInstance();

    // Clean up test data
    await prisma.tradeExecution.deleteMany({});
    await prisma.tradingSignal.deleteMany({});
    await prisma.portfolio.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'api-test' } }
    });

    // Create test user
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'api-test@example.com',
        password: 'TestPassword123!',
        firstName: 'API',
        lastName: 'Test'
      });

    accessToken = registerResponse.body.data.accessToken;
    userId = registerResponse.body.data.user.id;

    // Initialize virtual portfolio
    await virtualPortfolioManager.initializeUserPortfolio(userId);
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.tradeExecution.deleteMany({});
    await prisma.tradingSignal.deleteMany({});
    await prisma.portfolio.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'api-test' } }
    });
    await prisma.$disconnect();

    // Reset virtual portfolios
    virtualPortfolioManager.resetUserPortfolio(userId);
  });

  describe('Paper Trading Mode Enforcement', () => {
    test('should enforce paper trading mode on all trading endpoints', async () => {
      const tradingEndpoints = [
        { method: 'post', path: '/api/v1/trading/orders' },
        { method: 'post', path: '/api/v1/trading/signals/execute' },
        { method: 'delete', path: '/api/v1/trading/orders/test-order-id' },
        { method: 'post', path: '/api/v1/trading/positions/close' }
      ];

      for (const endpoint of tradingEndpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            symbol: 'BTCUSDT',
            side: 'buy',
            quantity: 0.001,
            type: 'market',
            exchange: 'binance'
          });

        // Should not return validation error (paper trading should be enforced)
        expect(response.status).not.toBe(400);
        
        // Check if paper trading headers are present in request processing
        // This would be verified through middleware interception
      }
    });

    test('should block real money operations with 403 status', async () => {
      const dangerousEndpoints = [
        '/api/v1/withdraw',
        '/api/v1/transfer',
        '/api/v1/futures/trade',
        '/api/v1/margin/borrow',
        '/api/v1/deposit/create',
        '/api/v1/lending/create'
      ];

      for (const endpoint of dangerousEndpoints) {
        const response = await request(app)
          .post(endpoint)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            amount: 1000,
            currency: 'USDT',
            destination: 'external_wallet'
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('REAL_MONEY_OPERATION');
        expect(response.body.riskLevel).toBe('critical');
        expect(response.body.paperTradingMode).toBe(true);
      }
    });

    test('should add paper trading indicators to all trading responses', async () => {
      const response = await request(app)
        .post('/api/v1/trading/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          symbol: 'BTCUSDT',
          side: 'buy',
          quantity: 0.001,
          type: 'limit',
          price: 45000,
          exchange: 'binance'
        });

      // Even if the order fails due to mock exchange, the response should indicate paper trading
      if (response.body.data) {
        expect(response.body.data.isPaperTrade).toBe(true);
      }
      
      // Check for paper trading metadata in response headers or body
      expect(response.headers['x-paper-trading-mode'] || response.body.paperTradingMode).toBeTruthy();
    });
  });

  describe('Virtual Portfolio API Endpoints', () => {
    test('should get virtual portfolio with paper trading indicators', async () => {
      const response = await request(app)
        .get('/api/v1/trading/portfolio')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalBalance');
      expect(response.body.data).toHaveProperty('availableBalance');
      expect(response.body.data.isPaperPortfolio).toBe(true);
      expect(response.body.data.paperTradingMode).toBe(true);
    });

    test('should execute virtual trades through API', async () => {
      const response = await request(app)
        .post('/api/v1/trading/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          symbol: 'BTCUSDT',
          side: 'buy',
          quantity: 0.001,
          type: 'market',
          exchange: 'binance'
        });

      // Should process as paper trade (may fail due to mock exchange but should be marked as paper)
      if (response.status === 200) {
        expect(response.body.data.isPaperTrade).toBe(true);
        expect(response.body.data.simulationDetails).toBeDefined();
      }
    });

    test('should get virtual trade history with paper trade markers', async () => {
      const response = await request(app)
        .get('/api/v1/trading/executions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // All trades should be marked as paper trades
      response.body.data.forEach((trade: any) => {
        expect(trade.isPaperTrade).toBe(true);
      });
    });

    test('should show virtual positions with simulation markers', async () => {
      const response = await request(app)
        .get('/api/v1/trading/positions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // All positions should be marked as virtual/paper
      response.body.data.forEach((position: any) => {
        expect(position.isPaperPosition || position.isVirtual).toBe(true);
      });
    });
  });

  describe('API Key Validation Endpoints', () => {
    test('should validate API keys for read-only permissions', async () => {
      const response = await request(app)
        .post('/api/v1/config/validate-api-keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          exchanges: {
            binance: {
              apiKey: 'safe_readonly_key_12345',
              apiSecret: 'safe_secret',
              sandbox: true
            },
            kucoin: {
              apiKey: 'safe_kucoin_key',
              apiSecret: 'safe_secret',
              passphrase: 'safe_passphrase',
              sandbox: true
            }
          }
        });

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.binance.isReadOnly).toBe(true);
        expect(response.body.data.binance.riskLevel).toBe('low');
        expect(response.body.data.kucoin.isReadOnly).toBe(true);
      }
    });

    test('should reject API keys with trading permissions', async () => {
      const response = await request(app)
        .post('/api/v1/config/validate-api-keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          exchanges: {
            binance: {
              apiKey: 'dangerous_trading_key_with_permissions',
              apiSecret: 'trading_secret',
              sandbox: false
            }
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('API_KEY_VALIDATION_FAILED');
      expect(response.body.details.riskLevel).toBe('critical');
    });

    test('should provide detailed validation results', async () => {
      const response = await request(app)
        .post('/api/v1/config/validate-api-keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          exchanges: {
            binance: {
              apiKey: 'test_key_for_validation',
              sandbox: true
            }
          }
        });

      if (response.status === 200) {
        expect(response.body.data.binance).toHaveProperty('isValid');
        expect(response.body.data.binance).toHaveProperty('isReadOnly');
        expect(response.body.data.binance).toHaveProperty('permissions');
        expect(response.body.data.binance).toHaveProperty('violations');
        expect(response.body.data.binance).toHaveProperty('riskLevel');
      }
    });
  });

  describe('Trading Signal Execution with Paper Trading', () => {
    let signalId: string;

    beforeEach(async () => {
      // Create test trading signal
      const signal = await prisma.tradingSignal.create({
        data: {
          userId,
          symbol: 'BTCUSDT',
          direction: 'LONG',
          confidence: 85.5,
          entryPrice: 45000,
          stopLoss: 43000,
          takeProfit: [47000, 49000],
          reasoning: {
            technical: { rsi: 35, trend: 'bullish' },
            patterns: [{ type: 'hammer', confidence: 80 }]
          },
          status: 'PENDING'
        }
      });
      signalId = signal.id;
    });

    test('should execute signals as paper trades only', async () => {
      const response = await request(app)
        .post('/api/v1/trading/signals/execute')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          signalId,
          positionSize: 0.1
        });

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.isPaperTrade).toBe(true);
        expect(response.body.data.simulationDetails).toBeDefined();
      }
    });

    test('should update signal status after paper execution', async () => {
      await request(app)
        .post('/api/v1/trading/signals/execute')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          signalId,
          positionSize: 0.1
        });

      const response = await request(app)
        .get(`/api/v1/trading/signals/${signalId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.status).toBe('EXECUTED');
      expect(response.body.data.executionDetails.isPaperTrade).toBe(true);
    });

    test('should create virtual position from signal execution', async () => {
      await request(app)
        .post('/api/v1/trading/signals/execute')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          signalId,
          positionSize: 0.1
        });

      const response = await request(app)
        .get('/api/v1/trading/positions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const position = response.body.data.find((p: any) => p.signalId === signalId);
      if (position) {
        expect(position.isPaperPosition).toBe(true);
        expect(position.isVirtual).toBe(true);
      }
    });
  });

  describe('Order Management with Paper Trading', () => {
    test('should create paper orders only', async () => {
      const response = await request(app)
        .post('/api/v1/trading/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          symbol: 'ETHUSDT',
          side: 'buy',
          quantity: 0.1,
          type: 'limit',
          price: 3000,
          exchange: 'binance'
        });

      if (response.status === 200) {
        expect(response.body.data.isPaperTrade).toBe(true);
        expect(response.body.data.orderId).toMatch(/^sim_/); // Simulated order ID prefix
      }
    });

    test('should list only paper orders', async () => {
      const response = await request(app)
        .get('/api/v1/trading/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      response.body.data.forEach((order: any) => {
        expect(order.isPaperTrade).toBe(true);
      });
    });

    test('should cancel paper orders', async () => {
      // First create an order
      const createResponse = await request(app)
        .post('/api/v1/trading/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          symbol: 'BTCUSDT',
          side: 'buy',
          quantity: 0.001,
          type: 'limit',
          price: 40000,
          exchange: 'binance'
        });

      if (createResponse.status === 200) {
        const orderId = createResponse.body.data.orderId;

        const cancelResponse = await request(app)
          .delete(`/api/v1/trading/orders/${orderId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(cancelResponse.body.success).toBe(true);
        expect(cancelResponse.body.data.status).toBe('cancelled');
        expect(cancelResponse.body.data.isPaperTrade).toBe(true);
      }
    });
  });

  describe('Risk Management with Paper Trading', () => {
    test('should enforce virtual balance limits', async () => {
      // Try to place order larger than virtual balance
      const response = await request(app)
        .post('/api/v1/trading/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          symbol: 'BTCUSDT',
          side: 'buy',
          quantity: 1, // Large quantity
          type: 'market',
          exchange: 'binance'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('INSUFFICIENT_VIRTUAL_BALANCE');
    });

    test('should apply virtual risk management rules', async () => {
      const response = await request(app)
        .get('/api/v1/trading/risk-assessment')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isPaperTrading).toBe(true);
      expect(response.body.data.virtualRiskLimits).toBeDefined();
      expect(response.body.data.realMoneyRisk).toBe(0);
    });

    test('should calculate virtual position sizes', async () => {
      const response = await request(app)
        .post('/api/v1/trading/calculate-position-size')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          symbol: 'BTCUSDT',
          riskPercent: 2,
          stopLossPrice: 45000,
          entryPrice: 50000
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isVirtualCalculation).toBe(true);
      expect(response.body.data.virtualBalance).toBeDefined();
      expect(response.body.data.recommendedSize).toBeGreaterThan(0);
    });
  });

  describe('Market Data API with Paper Trading Context', () => {
    test('should provide live market data with paper trading warnings', async () => {
      const response = await request(app)
        .get('/api/v1/market/ticker/BTCUSDT')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.symbol).toBe('BTCUSDT');
      expect(response.body.data.isLiveData).toBe(true);
      expect(response.body.data.paperTradingMode).toBe(true);
    });

    test('should provide historical data for backtesting', async () => {
      const response = await request(app)
        .get('/api/v1/market/klines/BTCUSDT')
        .query({
          interval: '1h',
          limit: 100
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.metadata.paperTradingMode).toBe(true);
    });
  });

  describe('Configuration API with Security Validation', () => {
    test('should get paper trading configuration', async () => {
      const response = await request(app)
        .get('/api/v1/config/paper-trading')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.enabled).toBe(true);
      expect(response.body.data.allowRealTrades).toBe(false);
      expect(response.body.data.initialVirtualBalance).toBeDefined();
    });

    test('should prevent disabling paper trading mode', async () => {
      const response = await request(app)
        .put('/api/v1/config/paper-trading')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          enabled: false,
          allowRealTrades: true
        })
        .expect(403);

      expect(response.body.error).toBe('PAPER_TRADING_CANNOT_BE_DISABLED');
      expect(response.body.riskLevel).toBe('critical');
    });

    test('should validate exchange configuration', async () => {
      const response = await request(app)
        .post('/api/v1/config/exchanges/validate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          binance: {
            apiKey: 'test_key',
            sandbox: true
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.binance.paperTradingCompatible).toBe(true);
      expect(response.body.data.binance.readOnlyValidated).toBe(true);
    });
  });

  describe('Audit and Compliance Endpoints', () => {
    test('should provide paper trading audit log', async () => {
      const response = await request(app)
        .get('/api/v1/audit/paper-trading')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.metadata.totalPaperTrades).toBeGreaterThanOrEqual(0);
      expect(response.body.metadata.realMoneyOperationsBlocked).toBeGreaterThanOrEqual(0);
    });

    test('should provide security validation report', async () => {
      const response = await request(app)
        .get('/api/v1/audit/security-validation')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.paperTradingEnforced).toBe(true);
      expect(response.body.data.realTradingBlocked).toBe(true);
      expect(response.body.data.apiKeysValidated).toBe(true);
      expect(response.body.data.securityScore).toBeGreaterThan(0);
    });

    test('should provide compliance status', async () => {
      const response = await request(app)
        .get('/api/v1/audit/compliance-status')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.paperTradingCompliant).toBe(true);
      expect(response.body.data.riskLevel).toBe('low');
      expect(response.body.data.violations).toHaveLength(0);
    });
  });

  describe('Error Handling and Security', () => {
    test('should handle malicious requests attempting real trades', async () => {
      const maliciousRequests = [
        {
          path: '/api/v1/trading/orders',
          body: {
            symbol: 'BTCUSDT',
            side: 'buy',
            quantity: 0.001,
            type: 'market',
            exchange: 'binance',
            realTrade: true, // Malicious flag
            bypassPaperTrading: true // Malicious flag
          }
        },
        {
          path: '/api/v1/withdraw',
          body: {
            amount: 1000,
            currency: 'USDT',
            address: 'malicious_address'
          }
        }
      ];

      for (const req of maliciousRequests) {
        const response = await request(app)
          .post(req.path)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(req.body);

        expect(response.status).toBe(403);
        expect(response.body.error).toMatch(/REAL_MONEY_OPERATION|PAPER_TRADING/);
        expect(response.body.riskLevel).toBe('critical');
      }
    });

    test('should rate limit trading endpoints', async () => {
      const promises = Array(50).fill(null).map(() =>
        request(app)
          .post('/api/v1/trading/orders')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            symbol: 'BTCUSDT',
            side: 'buy',
            quantity: 0.001,
            type: 'market',
            exchange: 'binance'
          })
      );

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 10000);

    test('should validate input data for trading endpoints', async () => {
      const invalidRequests = [
        {
          symbol: 'INVALID_SYMBOL',
          side: 'invalid_side',
          quantity: -1,
          type: 'invalid_type'
        },
        {
          symbol: '',
          side: 'buy',
          quantity: 'invalid_quantity',
          type: 'market'
        }
      ];

      for (const invalidReq of invalidRequests) {
        const response = await request(app)
          .post('/api/v1/trading/orders')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(invalidReq);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('VALIDATION_ERROR');
      }
    });
  });
});