import request from 'supertest';
import app from '@/index';

describe('Basic API Tests', () => {
  describe('Health and Status Endpoints', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
    });

    it('should return API status', async () => {
      const response = await request(app)
        .get('/api/v1/status')
        .expect(200);

      expect(response.body.message).toBe('AI Crypto Trading Bot API');
      expect(response.body.version).toBe('1.0.0');
      expect(response.body.status).toBe('running');
    });

    it('should return 404 for non-existent API endpoint', async () => {
      const response = await request(app)
        .get('/api/v1/non-existent')
        .expect(404);

      expect(response.body.error).toBe('NOT_FOUND');
    });
  });

  describe('API Documentation', () => {
    it('should serve OpenAPI spec as JSON', async () => {
      const response = await request(app)
        .get('/api/docs.json')
        .expect(200);

      expect(response.body.openapi).toBe('3.0.0');
      expect(response.body.info.title).toBe('AI Crypto Trading Bot API');
    });
  });

  describe('Rate Limiting', () => {
    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/v1/status')
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });
});