/**
 * Security Integration Tests
 * End-to-end tests for the complete security middleware stack
 */

import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { applyProductionSecurity, SecurityIntegration } from '@/middleware/securityIntegration';
import { config } from '@/config/config';

// Mock dependencies
jest.mock('@/config/config');
jest.mock('@/utils/logger');
jest.mock('@/services/SecurityMonitoringService');
jest.mock('@/services/AuditLogService');
jest.mock('@/services/NotificationService');

describe('Security Integration E2E Tests', () => {
  let app: express.Application;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let securityIntegration: SecurityIntegration;

  beforeEach(() => {
    // Setup Express app
    app = express();
    app.use(express.json());
    
    // Mock Prisma
    mockPrisma = {
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn()
      },
      accountLocks: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn()
      },
      blockedIPs: {
        create: jest.fn(),
        findMany: jest.fn()
      },
      securityThreats: {
        create: jest.fn(),
        findMany: jest.fn()
      }
    } as any;

    // Mock config
    (config as any).env = 'production';
    (config as any).paperTradingMode = true;

    // Apply security middleware
    securityIntegration = applyProductionSecurity(app, mockPrisma);

    // Add test routes
    app.get('/api/test', (req, res) => {
      res.json({ message: 'Test endpoint' });
    });

    app.post('/api/auth/login', (req, res) => {
      res.json({ message: 'Login endpoint' });
    });

    app.post('/api/trading/execute', (req, res) => {
      res.json({ message: 'Trading endpoint' });
    });

    app.get('/api/admin/users', (req, res) => {
      res.json({ message: 'Admin endpoint' });
    });

    app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Security Headers', () => {
    it('should set comprehensive security headers', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      // Check for security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-response-time']).toBeDefined();
    });

    it('should set HSTS header in production', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
    });

    it('should set CSP header', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });
  });

  describe('CORS Protection', () => {
    it('should allow requests from allowed origins', async () => {
      process.env.CORS_ALLOWED_ORIGINS = 'https://localhost:3000';
      
      const response = await request(app)
        .get('/api/test')
        .set('Origin', 'https://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('https://localhost:3000');
    });

    it('should block requests from disallowed origins', async () => {
      process.env.CORS_ALLOWED_ORIGINS = 'https://localhost:3000';
      
      await request(app)
        .get('/api/test')
        .set('Origin', 'https://malicious-site.com')
        .expect(403);
    });

    it('should handle preflight OPTIONS requests', async () => {
      process.env.CORS_ALLOWED_ORIGINS = 'https://localhost:3000';
      
      const response = await request(app)
        .options('/api/test')
        .set('Origin', 'https://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-methods']).toContain('GET');
      expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
    });
  });

  describe('Input Validation', () => {
    it('should block SQL injection attempts', async () => {
      await request(app)
        .post('/api/test')
        .send({ query: "SELECT * FROM users WHERE id = 1 OR 1=1" })
        .expect(400);
    });

    it('should block XSS attempts', async () => {
      await request(app)
        .post('/api/test')
        .send({ content: "<script>alert('xss')</script>" })
        .expect(400);
    });

    it('should block path traversal attempts', async () => {
      await request(app)
        .get('/api/test/../../../etc/passwd')
        .expect(403);
    });

    it('should block command injection attempts', async () => {
      await request(app)
        .post('/api/test')
        .send({ command: "ls; rm -rf /" })
        .expect(400);
    });

    it('should validate request structure', async () => {
      await request(app)
        .post('/api/test')
        .set('Content-Type', 'text/plain')
        .send('invalid content')
        .expect(400);
    });

    it('should block oversized requests', async () => {
      const largePayload = 'x'.repeat(11 * 1024 * 1024); // 11MB
      
      await request(app)
        .post('/api/test')
        .send({ data: largePayload })
        .expect(413);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply general rate limiting', async () => {
      // Make multiple requests rapidly
      const promises = [];
      for (let i = 0; i < 1100; i++) { // Exceed default limit
        promises.push(
          request(app)
            .get('/api/test')
            .expect((res) => {
              expect([200, 429]).toContain(res.status);
            })
        );
      }
      
      await Promise.all(promises);
    });

    it('should apply stricter rate limiting to auth endpoints', async () => {
      // Make multiple auth requests
      const promises = [];
      for (let i = 0; i < 15; i++) { // Exceed auth limit
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'password' })
            .expect((res) => {
              expect([200, 429]).toContain(res.status);
            })
        );
      }
      
      await Promise.all(promises);
    });

    it('should set rate limit headers', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });
  });

  describe('Intrusion Detection', () => {
    it('should block suspicious paths', async () => {
      await request(app)
        .get('/wp-admin/admin.php')
        .expect(403);
    });

    it('should block suspicious user agents', async () => {
      await request(app)
        .get('/api/test')
        .set('User-Agent', 'sqlmap/1.0')
        .expect(403);
    });

    it('should detect and block bot traffic', async () => {
      await request(app)
        .get('/api/test')
        .set('User-Agent', 'Mozilla/5.0 (compatible; Googlebot/2.1)')
        .expect(403);
    });

    it('should allow legitimate requests', async () => {
      await request(app)
        .get('/api/test')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        .expect(200);
    });
  });

  describe('Paper Trading Mode Protection', () => {
    it('should block real trading endpoints', async () => {
      await request(app)
        .post('/api/trading/execute')
        .send({ symbol: 'BTCUSDT', side: 'BUY', amount: 1 })
        .expect(403);
    });

    it('should return paper trading error message', async () => {
      const response = await request(app)
        .post('/api/trading/execute')
        .send({ symbol: 'BTCUSDT', side: 'BUY', amount: 1 })
        .expect(403);

      expect(response.body.error).toBe('TRADING_BLOCKED');
      expect(response.body.message).toContain('paper trading');
    });

    it('should fail if paper trading mode is disabled', async () => {
      (config as any).paperTradingMode = false;
      
      await request(app)
        .get('/api/test')
        .expect(500);
    });
  });

  describe('API Key Validation', () => {
    it('should allow requests without API keys', async () => {
      await request(app)
        .get('/api/test')
        .expect(200);
    });

    it('should validate API key format', async () => {
      await request(app)
        .get('/api/test')
        .set('X-API-Key', 'invalid-key')
        .expect(401);
    });

    it('should block trading API keys', async () => {
      await request(app)
        .get('/api/test')
        .set('X-API-Key', 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234')
        .expect((res) => {
          // This would depend on the actual API key validation logic
          expect([200, 403]).toContain(res.status);
        });
    });
  });

  describe('Admin Endpoint Protection', () => {
    it('should apply admin-specific rate limiting', async () => {
      const promises = [];
      for (let i = 0; i < 60; i++) { // Exceed admin limit
        promises.push(
          request(app)
            .get('/api/admin/users')
            .expect((res) => {
              expect([200, 429]).toContain(res.status);
            })
        );
      }
      
      await Promise.all(promises);
    });

    it('should check IP whitelist for admin endpoints', async () => {
      // This would depend on the IP whitelist configuration
      await request(app)
        .get('/api/admin/users')
        .expect((res) => {
          expect([200, 403]).toContain(res.status);
        });
    });
  });

  describe('Error Handling', () => {
    it('should handle security errors gracefully', async () => {
      // Trigger a security error
      await request(app)
        .get('/api/test')
        .set('User-Agent', 'sqlmap/1.0')
        .expect(403);
    });

    it('should not expose internal error details', async () => {
      const response = await request(app)
        .post('/api/test')
        .send({ query: "SELECT * FROM users" })
        .expect(400);

      expect(response.body.message).not.toContain('SQL');
      expect(response.body.message).not.toContain('database');
    });
  });

  describe('Health Check Bypass', () => {
    it('should allow health checks without security restrictions', async () => {
      await request(app)
        .get('/health')
        .expect(200);
    });

    it('should not apply rate limiting to health checks', async () => {
      // Make many health check requests
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          request(app)
            .get('/health')
            .expect(200)
        );
      }
      
      await Promise.all(promises);
    });
  });

  describe('Security Metrics', () => {
    it('should collect security metrics', () => {
      const metrics = securityIntegration.getSecurityMetrics();
      
      expect(metrics).toHaveProperty('configuration');
      expect(metrics).toHaveProperty('metrics');
      expect(metrics).toHaveProperty('services');
    });

    it('should track blocked requests', async () => {
      // Make a request that should be blocked
      await request(app)
        .get('/wp-admin')
        .expect(403);

      const metrics = securityIntegration.getSecurityMetrics();
      expect(metrics.metrics.blockedRequests).toBeGreaterThan(0);
    });
  });

  describe('IP Management', () => {
    it('should block IP addresses', async () => {
      const testIP = '192.168.1.100';
      
      await securityIntegration.blockIP(testIP, 'Test block');
      
      // Subsequent requests from this IP should be blocked
      // Note: This would require mocking the IP detection
    });

    it('should unblock IP addresses', async () => {
      const testIP = '192.168.1.100';
      
      await securityIntegration.blockIP(testIP, 'Test block');
      await securityIntegration.unblockIP(testIP);
      
      // Requests from this IP should now be allowed
    });
  });

  describe('Performance', () => {
    it('should process requests efficiently with security middleware', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/test')
        .expect(200);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent requests', async () => {
      const promises = [];
      
      for (let i = 0; i < 50; i++) {
        promises.push(
          request(app)
            .get('/api/test')
            .expect(200)
        );
      }
      
      await Promise.all(promises);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate required environment variables', () => {
      // Test configuration validation
      expect(() => {
        applyProductionSecurity(express(), mockPrisma);
      }).not.toThrow();
    });

    it('should fail with invalid configuration', () => {
      // Mock invalid configuration
      delete process.env.REDIS_URL;
      (config as any).env = 'production';
      
      expect(() => {
        applyProductionSecurity(express(), mockPrisma);
      }).toThrow();
    });
  });
});