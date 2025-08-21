import request from 'supertest';
import app from '../index';

describe('Application Setup', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version');
    });
  });

  describe('GET /api/v1/status', () => {
    it('should return API status', async () => {
      const response = await request(app)
        .get('/api/v1/status')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'AI Crypto Trading Bot API');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('status', 'running');
    });
  });

  describe('GET /metrics', () => {
    it('should return Prometheus metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.text).toContain('# HELP');
      expect(response.headers['content-type']).toContain('text/plain');
    });
  });

  describe('Error handling', () => {
    it('should handle 404 errors', async () => {
      await request(app)
        .get('/nonexistent-route')
        .expect(404);
    });
  });
});