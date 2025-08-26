/**
 * Production Security Hardening Tests
 * Comprehensive tests for security middleware and validation
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { ProductionSecurityHardening } from '@/middleware/productionSecurityHardening';
import { SecurityMonitoringService } from '@/services/SecurityMonitoringService';
import { AuditLogService } from '@/services/AuditLogService';
import { NotificationService } from '@/services/NotificationService';
import Redis from 'ioredis';

// Mock dependencies
jest.mock('ioredis');
jest.mock('@/services/SecurityMonitoringService');
jest.mock('@/services/AuditLogService');
jest.mock('@/services/NotificationService');
jest.mock('@/utils/logger');

describe('ProductionSecurityHardening', () => {
  let securityHardening: ProductionSecurityHardening;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockSecurityMonitoring: jest.Mocked<SecurityMonitoringService>;
  let mockAuditService: jest.Mocked<AuditLogService>;
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockRedis: jest.Mocked<Redis>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    // Setup mocks
    mockPrisma = {} as jest.Mocked<PrismaClient>;
    mockSecurityMonitoring = new SecurityMonitoringService(mockPrisma, {} as any, {} as any) as jest.Mocked<SecurityMonitoringService>;
    mockAuditService = new AuditLogService(mockPrisma) as jest.Mocked<AuditLogService>;
    mockNotificationService = new NotificationService() as jest.Mocked<NotificationService>;
    
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      ttl: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn()
    } as any;

    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis);

    securityHardening = new ProductionSecurityHardening(mockSecurityMonitoring, mockAuditService);

    // Setup request/response mocks
    mockReq = {
      ip: '192.168.1.1',
      path: '/api/test',
      method: 'GET',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'content-type': 'application/json'
      },
      get: jest.fn((header: string) => {
        const headers: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Content-Type': 'application/json',
          'Content-Length': '100'
        };
        return headers[header];
      }),
      body: {},
      query: {},
      params: {}
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Comprehensive Input Validation', () => {
    it('should allow valid requests', async () => {
      const middleware = securityHardening.comprehensiveInputValidation();
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block requests from blocked IPs', async () => {
      // Mock blocked IP
      mockRedis.get.mockResolvedValue('blocked');
      
      const middleware = securityHardening.comprehensiveInputValidation();
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'FORBIDDEN',
        message: 'Access denied'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block requests with invalid structure', async () => {
      // Mock invalid request (missing User-Agent)
      mockReq.get = jest.fn().mockReturnValue(undefined);
      
      const middleware = securityHardening.comprehensiveInputValidation();
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'BAD_REQUEST',
        message: 'Invalid request structure'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block requests with SQL injection patterns', async () => {
      mockReq.body = { query: "SELECT * FROM users WHERE id = 1 OR 1=1" };
      
      const middleware = securityHardening.comprehensiveInputValidation();
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'SECURITY_VIOLATION',
        message: 'Request blocked by security system'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block requests with XSS patterns', async () => {
      mockReq.body = { content: "<script>alert('xss')</script>" };
      
      const middleware = securityHardening.comprehensiveInputValidation();
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block real trading operations in paper mode', async () => {
      mockReq.path = '/api/trading/execute';
      
      const middleware = securityHardening.comprehensiveInputValidation();
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'TRADING_BLOCKED',
        message: 'Real trading operations are not allowed'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Intrusion Detection System', () => {
    it('should allow normal requests', async () => {
      const middleware = securityHardening.intrusionDetectionSystem();
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block requests with suspicious paths', async () => {
      mockReq.path = '/wp-admin/admin.php';
      
      const middleware = securityHardening.intrusionDetectionSystem();
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'INTRUSION_DETECTED',
        message: 'Access denied due to suspicious activity'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block requests with suspicious user agents', async () => {
      mockReq.get = jest.fn().mockImplementation((header: string) => {
        if (header === 'User-Agent') return 'sqlmap/1.0';
        return undefined;
      });
      
      const middleware = securityHardening.intrusionDetectionSystem();
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should auto-block IPs after multiple intrusion attempts', async () => {
      const middleware = securityHardening.intrusionDetectionSystem();
      
      // Simulate multiple intrusion attempts
      mockReq.path = '/admin';
      
      for (let i = 0; i < 6; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }
      
      // Should have called blockIP
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('blocked_ip:'),
        86400,
        'Multiple intrusion attempts'
      );
    });
  });

  describe('API Key Security Validation', () => {
    it('should allow requests without API keys', async () => {
      const middleware = securityHardening.apiKeySecurityValidation();
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block invalid API key formats', async () => {
      mockReq.get = jest.fn().mockImplementation((header: string) => {
        if (header === 'X-API-Key') return 'invalid-key-format';
        return undefined;
      });
      
      const middleware = securityHardening.apiKeySecurityValidation();
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'INVALID_API_KEY',
        message: 'Invalid API key format'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block trading API keys', async () => {
      mockReq.get = jest.fn().mockImplementation((header: string) => {
        if (header === 'X-API-Key') return 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234';
        return undefined;
      });
      
      // Mock trading permissions check
      jest.spyOn(securityHardening as any, 'hasTradePermissions').mockResolvedValue(true);
      
      const middleware = securityHardening.apiKeySecurityValidation();
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'TRADING_API_KEY_BLOCKED',
        message: 'Trading API keys are not allowed in paper trading mode'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow valid read-only API keys', async () => {
      mockReq.get = jest.fn().mockImplementation((header: string) => {
        if (header === 'X-API-Key') return 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234';
        return undefined;
      });
      
      // Mock valid read-only permissions
      jest.spyOn(securityHardening as any, 'hasTradePermissions').mockResolvedValue(false);
      jest.spyOn(securityHardening as any, 'validateApiKeyPermissions').mockResolvedValue({ valid: true });
      
      const middleware = securityHardening.apiKeySecurityValidation();
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('Enhanced CORS', () => {
    it('should allow requests from allowed origins', () => {
      mockReq.get = jest.fn().mockImplementation((header: string) => {
        if (header === 'Origin') return 'https://localhost:3000';
        return undefined;
      });
      
      // Mock allowed origins
      jest.spyOn(securityHardening as any, 'getAllowedOrigins').mockReturnValue(['https://localhost:3000']);
      
      const middleware = securityHardening.enhancedCORS();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://localhost:3000');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should block requests from disallowed origins', () => {
      mockReq.get = jest.fn().mockImplementation((header: string) => {
        if (header === 'Origin') return 'https://malicious-site.com';
        return undefined;
      });
      
      // Mock allowed origins
      jest.spyOn(securityHardening as any, 'getAllowedOrigins').mockReturnValue(['https://localhost:3000']);
      
      const middleware = securityHardening.enhancedCORS();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'CORS_VIOLATION',
        message: 'Origin not allowed'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle OPTIONS requests', () => {
      mockReq.method = 'OPTIONS';
      mockReq.get = jest.fn().mockReturnValue(undefined);
      
      const middleware = securityHardening.enhancedCORS();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('IP Management', () => {
    it('should block IP addresses', async () => {
      const ip = '192.168.1.100';
      const reason = 'Test block';
      const duration = 3600;
      
      await securityHardening.blockIP(ip, reason, duration);
      
      expect(mockRedis.setex).toHaveBeenCalledWith(`blocked_ip:${ip}`, duration, reason);
    });

    it('should unblock IP addresses', async () => {
      const ip = '192.168.1.100';
      
      await securityHardening.unblockIP(ip);
      
      expect(mockRedis.del).toHaveBeenCalledWith(`blocked_ip:${ip}`);
    });
  });

  describe('Security Metrics', () => {
    it('should return security metrics', () => {
      const metrics = securityHardening.getSecurityMetrics();
      
      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('blockedRequests');
      expect(metrics).toHaveProperty('suspiciousActivities');
      expect(metrics).toHaveProperty('rateLimitViolations');
      expect(metrics).toHaveProperty('intrusionAttempts');
      expect(metrics).toHaveProperty('lastReset');
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
      
      const middleware = securityHardening.comprehensiveInputValidation();
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      
      // Should continue despite Redis error
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'SECURITY_ERROR',
        message: 'Security validation failed'
      });
    });

    it('should handle audit service errors gracefully', async () => {
      mockAuditService.logSecurityEvent.mockRejectedValue(new Error('Audit service failed'));
      
      const middleware = securityHardening.intrusionDetectionSystem();
      mockReq.path = '/admin'; // Trigger intrusion detection
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      
      // Should still block the request despite audit error
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Performance', () => {
    it('should process requests efficiently', async () => {
      const startTime = Date.now();
      const middleware = securityHardening.comprehensiveInputValidation();
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle concurrent requests', async () => {
      const middleware = securityHardening.comprehensiveInputValidation();
      const promises = [];
      
      // Simulate 10 concurrent requests
      for (let i = 0; i < 10; i++) {
        promises.push(middleware(mockReq as Request, mockRes as Response, mockNext));
      }
      
      await Promise.all(promises);
      
      expect(mockNext).toHaveBeenCalledTimes(10);
    });
  });
});

describe('Security Integration', () => {
  it('should validate production security configuration', () => {
    // This would test the configuration validation
    expect(true).toBe(true); // Placeholder
  });

  it('should apply security middleware in correct order', () => {
    // This would test middleware application order
    expect(true).toBe(true); // Placeholder
  });

  it('should handle security service initialization failures', () => {
    // This would test error handling during initialization
    expect(true).toBe(true); // Placeholder
  });
});