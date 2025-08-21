import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '@/index';

const prisma = new PrismaClient();

describe('Trading API', () => {
  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    // Clean up test data
    await prisma.tradeExecution.deleteMany({});
    await prisma.tradingSignal.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'trading-test' } }
    });

    // Create test user
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'trading-test@example.com',
        password: 'TestPassword123!',
        firstName: 'Trading',
        lastName: 'Test'
      });

    accessToken = registerResponse.body.data.accessToken;
    userId = registerResponse.body.data.user.id;

    // Create test portfolio
    await prisma.portfolio.create({
      data: {
        userId,
        totalBalance: 10000,
        availableBalance: 8000,
        positions: [],
        totalUnrealizedPnl: 0,
        totalRealizedPnl: 0,
        maxDrawdown: 0,
        currentDrawdown: 0
      }
    });

    // Create test trading signal
    await prisma.tradingSignal.create({
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
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.tradeExecution.deleteMany({});
    await prisma.tradingSignal.deleteMany({});
    await prisma.portfolio.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'trading-test' } }
    });
    await prisma.$disconnect();
  });

  describe('GET /api/v1/trading/signals', () => {
    it('should get trading signals for authenticated user', async () => {
      const response = await request(app)
        .get('/api/v1/trading/signals')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/v1/trading/signals')
        .expect(401);

      expect(response.body.error).toBe('UNAUTHORIZED');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/trading/signals?page=1&limit=5')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
    });

    it('should support filtering by status', async () => {
      const response = await request(app)
        .get('/api/v1/trading/signals?status=PENDING')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      if (response.body.data.length > 0) {
        expect(response.body.data[0].status).toBe('PENDING');
      }
    });
  });

  describe('GET /api/v1/trading/signals/:id', () => {
    let signalId: string;

    beforeAll(async () => {
      const signal = await prisma.tradingSignal.findFirst({
        where: { userId }
      });
      signalId = signal!.id;
    });

    it('should get specific trading signal', async () => {
      const response = await request(app)
        .get(`/api/v1/trading/signals/${signalId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(signalId);
    });

    it('should return 404 for non-existent signal', async () => {
      const response = await request(app)
        .get('/api/v1/trading/signals/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.error).toBe('SIGNAL_NOT_FOUND');
    });
  });

  describe('POST /api/v1/trading/signals/execute', () => {
    let signalId: string;

    beforeAll(async () => {
      // Create a fresh signal for execution
      const signal = await prisma.tradingSignal.create({
        data: {
          userId,
          symbol: 'ETHUSDT',
          direction: 'LONG',
          confidence: 75.0,
          entryPrice: 3000,
          stopLoss: 2900,
          takeProfit: [3200, 3400],
          reasoning: {
            technical: { rsi: 40, trend: 'bullish' }
          },
          status: 'PENDING'
        }
      });
      signalId = signal.id;
    });

    it('should execute trading signal successfully', async () => {
      const response = await request(app)
        .post('/api/v1/trading/signals/execute')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          signalId,
          positionSize: 0.1
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Signal executed successfully');
    });

    it('should reject execution of non-existent signal', async () => {
      const response = await request(app)
        .post('/api/v1/trading/signals/execute')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          signalId: 'non-existent-id',
          positionSize: 0.1
        })
        .expect(404);

      expect(response.body.error).toBe('SIGNAL_NOT_FOUND');
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/v1/trading/signals/execute')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          // Missing signalId
          positionSize: 0.1
        })
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/trading/signals/:id/cancel', () => {
    let signalId: string;

    beforeAll(async () => {
      const signal = await prisma.tradingSignal.create({
        data: {
          userId,
          symbol: 'ADAUSDT',
          direction: 'SHORT',
          confidence: 70.0,
          entryPrice: 0.5,
          stopLoss: 0.52,
          takeProfit: [0.48, 0.46],
          reasoning: {
            technical: { rsi: 70, trend: 'bearish' }
          },
          status: 'PENDING'
        }
      });
      signalId = signal.id;
    });

    it('should cancel trading signal successfully', async () => {
      const response = await request(app)
        .post(`/api/v1/trading/signals/${signalId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Signal cancelled successfully');
    });

    it('should return 404 for non-existent signal', async () => {
      const response = await request(app)
        .post('/api/v1/trading/signals/non-existent-id/cancel')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.error).toBe('SIGNAL_NOT_FOUND');
    });
  });

  describe('GET /api/v1/trading/executions', () => {
    it('should get trade executions for authenticated user', async () => {
      const response = await request(app)
        .get('/api/v1/trading/executions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it('should support filtering by symbol', async () => {
      const response = await request(app)
        .get('/api/v1/trading/executions?symbol=BTCUSDT')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should support filtering by exchange', async () => {
      const response = await request(app)
        .get('/api/v1/trading/executions?exchange=binance')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/trading/orders', () => {
    it('should validate order placement request', async () => {
      const response = await request(app)
        .post('/api/v1/trading/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'limit',
          quantity: 0.001,
          price: 45000,
          exchange: 'binance'
        })
        .expect(500); // Will fail due to mock exchange, but validation should pass

      // Should not be a validation error
      expect(response.body.error).not.toBe('VALIDATION_ERROR');
    });

    it('should reject invalid order parameters', async () => {
      const response = await request(app)
        .post('/api/v1/trading/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          symbol: 'BTCUSDT',
          side: 'invalid-side', // Invalid side
          type: 'limit',
          quantity: 0.001,
          price: 45000,
          exchange: 'binance'
        })
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('should require price for limit orders', async () => {
      const response = await request(app)
        .post('/api/v1/trading/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'limit',
          quantity: 0.001,
          // Missing price for limit order
          exchange: 'binance'
        })
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on trading endpoints', async () => {
      // Make multiple requests to test rate limiting
      const promises = Array(35).fill(null).map(() =>
        request(app)
          .get('/api/v1/trading/signals')
          .set('Authorization', `Bearer ${accessToken}`)
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 10000);
  });
});