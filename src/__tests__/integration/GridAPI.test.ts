import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '@/index';

const prisma = new PrismaClient();

describe('Grid Trading API', () => {
  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    // Clean up test data
    await prisma.grid.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'grid-test' } }
    });

    // Create test user
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'grid-test@example.com',
        password: 'TestPassword123!',
        firstName: 'Grid',
        lastName: 'Test'
      });

    accessToken = registerResponse.body.data.accessToken;
    userId = registerResponse.body.data.user.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.grid.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'grid-test' } }
    });
    await prisma.$disconnect();
  });

  describe('POST /api/v1/grids', () => {
    it('should create a new grid successfully', async () => {
      const gridData = {
        symbol: 'BTCUSDT',
        strategy: 'fibonacci',
        basePrice: 45000,
        spacing: 0.02,
        levels: [
          { price: 44000, quantity: 0.001, side: 'buy' },
          { price: 46000, quantity: 0.001, side: 'sell' }
        ]
      };

      const response = await request(app)
        .post('/api/v1/grids')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(gridData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.symbol).toBe(gridData.symbol);
      expect(response.body.data.strategy).toBe(gridData.strategy);
      expect(response.body.data.status).toBe('ACTIVE');
    });

    it('should validate grid creation request', async () => {
      const invalidGridData = {
        symbol: 'BTCUSDT',
        strategy: 'invalid-strategy', // Invalid strategy
        basePrice: 45000,
        spacing: 0.02,
        levels: [
          { price: 44000, quantity: 0.001, side: 'buy' }
        ]
      };

      const response = await request(app)
        .post('/api/v1/grids')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidGridData)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('should require minimum number of levels', async () => {
      const gridData = {
        symbol: 'BTCUSDT',
        strategy: 'fibonacci',
        basePrice: 45000,
        spacing: 0.02,
        levels: [
          { price: 44000, quantity: 0.001, side: 'buy' }
          // Missing second level
        ]
      };

      const response = await request(app)
        .post('/api/v1/grids')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(gridData)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('should reject unauthenticated requests', async () => {
      const gridData = {
        symbol: 'BTCUSDT',
        strategy: 'fibonacci',
        basePrice: 45000,
        spacing: 0.02,
        levels: [
          { price: 44000, quantity: 0.001, side: 'buy' },
          { price: 46000, quantity: 0.001, side: 'sell' }
        ]
      };

      const response = await request(app)
        .post('/api/v1/grids')
        .send(gridData)
        .expect(401);

      expect(response.body.error).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/v1/grids', () => {
    beforeAll(async () => {
      // Create test grids
      await prisma.grid.createMany({
        data: [
          {
            userId,
            symbol: 'ETHUSDT',
            strategy: 'ELLIOTT_WAVE',
            basePrice: 3000,
            spacing: 0.03,
            levels: [
              { price: 2900, quantity: 0.01, side: 'buy' },
              { price: 3100, quantity: 0.01, side: 'sell' }
            ],
            status: 'ACTIVE'
          },
          {
            userId,
            symbol: 'ADAUSDT',
            strategy: 'STANDARD',
            basePrice: 0.5,
            spacing: 0.05,
            levels: [
              { price: 0.48, quantity: 100, side: 'buy' },
              { price: 0.52, quantity: 100, side: 'sell' }
            ],
            status: 'PAUSED'
          }
        ]
      });
    });

    it('should get user grids successfully', async () => {
      const response = await request(app)
        .get('/api/v1/grids')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.pagination).toBeDefined();
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/grids?page=1&limit=1')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(1);
      expect(response.body.data.length).toBeLessThanOrEqual(1);
    });

    it('should support filtering by status', async () => {
      const response = await request(app)
        .get('/api/v1/grids?status=ACTIVE')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      if (response.body.data.length > 0) {
        expect(response.body.data[0].status).toBe('ACTIVE');
      }
    });

    it('should support filtering by symbol', async () => {
      const response = await request(app)
        .get('/api/v1/grids?symbol=ETHUSDT')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      if (response.body.data.length > 0) {
        expect(response.body.data[0].symbol).toBe('ETHUSDT');
      }
    });

    it('should support filtering by strategy', async () => {
      const response = await request(app)
        .get('/api/v1/grids?strategy=ELLIOTT_WAVE')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      if (response.body.data.length > 0) {
        expect(response.body.data[0].strategy).toBe('ELLIOTT_WAVE');
      }
    });
  });

  describe('GET /api/v1/grids/:id', () => {
    let gridId: string;

    beforeAll(async () => {
      const grid = await prisma.grid.findFirst({
        where: { userId }
      });
      gridId = grid!.id;
    });

    it('should get specific grid successfully', async () => {
      const response = await request(app)
        .get(`/api/v1/grids/${gridId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(gridId);
    });

    it('should return 404 for non-existent grid', async () => {
      const response = await request(app)
        .get('/api/v1/grids/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.error).toBe('GRID_NOT_FOUND');
    });
  });

  describe('PUT /api/v1/grids/:id', () => {
    let gridId: string;

    beforeAll(async () => {
      const grid = await prisma.grid.findFirst({
        where: { userId, status: 'ACTIVE' }
      });
      gridId = grid!.id;
    });

    it('should update grid successfully', async () => {
      const updateData = {
        status: 'paused'
      };

      const response = await request(app)
        .put(`/api/v1/grids/${gridId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('PAUSED');
    });

    it('should validate update request', async () => {
      const invalidUpdateData = {
        status: 'invalid-status'
      };

      const response = await request(app)
        .put(`/api/v1/grids/${gridId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidUpdateData)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent grid', async () => {
      const updateData = {
        status: 'active'
      };

      const response = await request(app)
        .put('/api/v1/grids/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.error).toBe('GRID_NOT_FOUND');
    });
  });

  describe('POST /api/v1/grids/:id/close', () => {
    let gridId: string;

    beforeAll(async () => {
      // Create a new grid for closing
      const grid = await prisma.grid.create({
        data: {
          userId,
          symbol: 'DOTUSDT',
          strategy: 'FIBONACCI',
          basePrice: 10,
          spacing: 0.02,
          levels: [
            { price: 9.8, quantity: 1, side: 'buy' },
            { price: 10.2, quantity: 1, side: 'sell' }
          ],
          status: 'ACTIVE'
        }
      });
      gridId = grid.id;
    });

    it('should close grid successfully', async () => {
      const response = await request(app)
        .post(`/api/v1/grids/${gridId}/close`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ reason: 'Test closure' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Grid closed successfully');
    });

    it('should return 404 for non-existent grid', async () => {
      const response = await request(app)
        .post('/api/v1/grids/non-existent-id/close')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ reason: 'Test closure' })
        .expect(404);

      expect(response.body.error).toBe('GRID_NOT_FOUND');
    });
  });

  describe('GET /api/v1/grids/:id/performance', () => {
    let gridId: string;

    beforeAll(async () => {
      const grid = await prisma.grid.findFirst({
        where: { userId }
      });
      gridId = grid!.id;
    });

    it('should get grid performance successfully', async () => {
      const response = await request(app)
        .get(`/api/v1/grids/${gridId}/performance`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should return 404 for non-existent grid', async () => {
      const response = await request(app)
        .get('/api/v1/grids/non-existent-id/performance')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.error).toBe('GRID_NOT_FOUND');
    });
  });

  describe('GET /api/v1/grids/stats', () => {
    it('should get grid statistics successfully', async () => {
      const response = await request(app)
        .get('/api/v1/grids/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalGrids).toBeDefined();
      expect(response.body.data.totalProfit).toBeDefined();
      expect(response.body.data.breakdown).toBeDefined();
    });
  });
});