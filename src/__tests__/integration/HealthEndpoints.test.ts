import request from 'supertest';
import express from 'express';
import healthRoutes from '../../routes/health';
import { MonitoringService } from '../../services/MonitoringService';
import { SystemPerformanceMonitor } from '../../services/SystemPerformanceMonitor';

// Mock logger to avoid console output during tests
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  },
  logPerformanceMetric: jest.fn(),
  logSecurityEvent: jest.fn(),
  logTradingActivity: jest.fn()
}));

describe('Health Endpoints Integration Tests', () => {
  let app: express.Application;
  let monitoringService: MonitoringService;
  let performanceMonitor: SystemPerformanceMonitor;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/health', healthRoutes);
    
    monitoringService = MonitoringService.getInstance();
    performanceMonitor = SystemPerformanceMonitor.getInstance();
  });

  afterAll(() => {
    monitoringService.stop();
    performanceMonitor.stop();
  });

  describe('GET /health', () => {
    it('should return basic health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([200, 503]);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);
    });

    it('should respond quickly', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/health');
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should respond within 1 second
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed health information', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([200, 503]);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('paperTrading');
      expect(response.body).toHaveProperty('checks');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('system');
      expect(response.body).toHaveProperty('performance');
      expect(response.body).toHaveProperty('responseTime');

      // Verify paper trading information
      expect(response.body.paperTrading).toHaveProperty('enabled');
      expect(response.body.paperTrading).toHaveProperty('allowRealTrades');
      expect(response.body.paperTrading).toHaveProperty('safetyMode');

      // Verify system information
      expect(response.body.system).toHaveProperty('memory');
      expect(response.body.system).toHaveProperty('cpu');
      expect(response.body.system).toHaveProperty('platform');

      // Verify performance metrics
      expect(response.body.performance).toHaveProperty('latency');
      expect(response.body.performance).toHaveProperty('throughput');
      expect(response.body.performance).toHaveProperty('errorRate');
    });

    it('should include response time measurement', async () => {
      const response = await request(app)
        .get('/health/detailed');

      expect(response.body.responseTime).toBeDefined();
      expect(typeof response.body.responseTime).toBe('number');
      expect(response.body.responseTime).toBeGreaterThan(0);
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app)
        .get('/health/ready')
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([200, 503]);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('criticalServices');
      expect(['ready', 'not_ready']).toContain(response.body.status);
    });

    it('should check critical services', async () => {
      const response = await request(app)
        .get('/health/ready');

      expect(response.body.criticalServices).toBeDefined();
      expect(typeof response.body.criticalServices).toBe('object');
    });
  });

  describe('GET /health/live', () => {
    it('should return liveness status', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([200, 503]);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(['alive', 'unhealthy']).toContain(response.body.status);
    });

    it('should include memory usage information', async () => {
      const response = await request(app)
        .get('/health/live');

      if (response.body.status === 'alive') {
        expect(response.body).toHaveProperty('uptime');
        expect(response.body).toHaveProperty('memoryUsage');
        expect(response.body.memoryUsage).toHaveProperty('used');
        expect(response.body.memoryUsage).toHaveProperty('total');
        expect(response.body.memoryUsage).toHaveProperty('percentage');
      }
    });
  });

  describe('GET /health/startup', () => {
    it('should return startup status', async () => {
      const response = await request(app)
        .get('/health/startup')
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([200, 503]);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(['started', 'starting', 'failed']).toContain(response.body.status);
    });

    it('should show started status after sufficient uptime', async () => {
      // Since the process has been running for a while during tests, it should be started
      const response = await request(app)
        .get('/health/startup');

      if (process.uptime() > 10) {
        expect(response.body.status).toBe('started');
        expect(response.body).toHaveProperty('startTime');
      }
    });
  });

  describe('GET /health/deep', () => {
    it('should return deep health check results', async () => {
      const response = await request(app)
        .get('/health/deep')
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([200, 503]);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('checks');
      expect(response.body).toHaveProperty('duration');
      expect(['healthy', 'unhealthy']).toContain(response.body.status);
    });

    it('should perform comprehensive checks', async () => {
      const response = await request(app)
        .get('/health/deep');

      expect(response.body.checks).toBeDefined();
      expect(typeof response.body.checks).toBe('object');
      
      // Should include various health checks
      const checks = response.body.checks;
      expect(checks).toHaveProperty('filesystem');
      expect(checks).toHaveProperty('memory_pressure');
      expect(checks).toHaveProperty('event_loop');
      expect(checks).toHaveProperty('paper_trading_safety');

      // Each check should have status and message
      Object.values(checks).forEach((check: any) => {
        expect(check).toHaveProperty('status');
        expect(check).toHaveProperty('message');
        expect(['pass', 'warn', 'fail']).toContain(check.status);
      });
    });

    it('should measure execution time', async () => {
      const response = await request(app)
        .get('/health/deep');

      expect(response.body.duration).toBeDefined();
      expect(typeof response.body.duration).toBe('number');
      expect(response.body.duration).toBeGreaterThan(0);
    });
  });

  describe('GET /health/metrics', () => {
    it('should return Prometheus metrics', async () => {
      const response = await request(app)
        .get('/health/metrics')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/plain/);
      expect(response.text).toBeDefined();
      expect(response.text.length).toBeGreaterThan(0);
      
      // Should contain some basic Prometheus metrics
      expect(response.text).toMatch(/# HELP/);
      expect(response.text).toMatch(/# TYPE/);
    });

    it('should include custom metrics', async () => {
      // Record some metrics first
      monitoringService.recordHttpRequest('GET', '/test', 200, 0.1);
      monitoringService.recordPaperTrade('BTC/USDT', 'BUY', 'binance');

      const response = await request(app)
        .get('/health/metrics')
        .expect(200);

      // Should contain our custom metrics
      expect(response.text).toMatch(/kiro_bot_/);
    });
  });

  describe('GET /health/services', () => {
    it('should return service statuses', async () => {
      const response = await request(app)
        .get('/health/services')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
      expect(Array.isArray(response.body.services)).toBe(true);
    });

    it('should include service details', async () => {
      const response = await request(app)
        .get('/health/services');

      response.body.services.forEach((service: any) => {
        expect(service).toHaveProperty('name');
        expect(service).toHaveProperty('status');
        expect(service).toHaveProperty('lastCheck');
        expect(['up', 'down', 'degraded']).toContain(service.status);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid routes gracefully', async () => {
      const response = await request(app)
        .get('/health/invalid')
        .expect(404);

      // Express should handle this with default 404
    });

    it('should handle server errors gracefully', async () => {
      // This test would require mocking internal services to throw errors
      // For now, we just verify that the endpoints don't crash
      const endpoints = [
        '/health',
        '/health/detailed',
        '/health/ready',
        '/health/live',
        '/health/startup',
        '/health/deep',
        '/health/metrics',
        '/health/services'
      ];

      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        expect(response.status).not.toBe(500);
      }
    });
  });

  describe('Performance', () => {
    it('should handle concurrent requests', async () => {
      const promises = [];
      const concurrentRequests = 10;

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(request(app).get('/health'));
      }

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBeOneOf([200, 503]);
      });
    });

    it('should respond within acceptable time limits', async () => {
      const endpoints = [
        { path: '/health', maxTime: 500 },
        { path: '/health/ready', maxTime: 1000 },
        { path: '/health/live', maxTime: 500 },
        { path: '/health/startup', maxTime: 500 }
      ];

      for (const endpoint of endpoints) {
        const startTime = Date.now();
        await request(app).get(endpoint.path);
        const duration = Date.now() - startTime;
        
        expect(duration).toBeLessThan(endpoint.maxTime);
      }
    });
  });
});

// Custom Jest matcher
expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected.join(', ')}`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
    }
  }
}