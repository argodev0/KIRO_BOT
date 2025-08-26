/**
 * Comprehensive Paper Trading Guard Tests
 * Unit tests for paper trading guard and safety mechanisms
 * Requirements: 3.1, 3.2
 */

import { Request, Response, NextFunction } from 'express';
import { PaperTradingGuard, PaperTradingError, PAPER_TRADING_ERRORS } from '../../middleware/paperTradingGuard';
import { ApiPermissionValidator, ApiPermissionValidationError } from '../../utils/ApiPermissionValidator';
import { EnvironmentValidator, EnvironmentValidationError } from '../../utils/EnvironmentValidator';

describe('Comprehensive Paper Trading Guard Tests', () => {
  let paperTradingGuard: PaperTradingGuard;
  let apiPermissionValidator: ApiPermissionValidator;
  let environmentValidator: EnvironmentValidator;

  beforeEach(() => {
    paperTradingGuard = PaperTradingGuard.getInstance();
    apiPermissionValidator = ApiPermissionValidator.getInstance();
    environmentValidator = EnvironmentValidator.getInstance();
    
    // Clear any cached validations
    apiPermissionValidator.clearCache();
  });

  describe('Paper Trading Mode Enforcement', () => {
    test('should enforce paper trading mode at startup', () => {
      expect(() => paperTradingGuard.validatePaperTradingMode()).not.toThrow();
      
      const config = paperTradingGuard.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.allowRealTrades).toBe(false);
    });

    test('should prevent disabling paper trading mode', () => {
      // Attempt to force disable paper trading
      paperTradingGuard.forcePaperTradingMode();
      
      const config = paperTradingGuard.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.allowRealTrades).toBe(false);
    });

    test('should log security events for paper trading validation', () => {
      const initialLogLength = paperTradingGuard.getSecurityAuditLog().length;
      
      paperTradingGuard.validatePaperTradingMode();
      
      const newLogLength = paperTradingGuard.getSecurityAuditLog().length;
      expect(newLogLength).toBeGreaterThan(initialLogLength);
      
      const latestLog = paperTradingGuard.getSecurityAuditLog().slice(-1)[0];
      expect(latestLog.event).toBe('paper_trading_validation_success');
      expect(latestLog.riskLevel).toBe('low');
    });

    test('should maintain audit log size limits', () => {
      // Generate many validation events
      for (let i = 0; i < 1100; i++) {
        paperTradingGuard.validatePaperTradingMode();
      }
      
      const auditLog = paperTradingGuard.getSecurityAuditLog();
      expect(auditLog.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Trading Operation Interception', () => {
    test('should intercept and convert trading operations to paper trades', () => {
      const mockReq = {
        path: '/api/trading/orders',
        method: 'POST',
        body: { 
          symbol: 'BTCUSDT', 
          side: 'buy', 
          quantity: 0.001,
          type: 'market'
        },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('test-agent')
      } as unknown as Request;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;

      const mockNext = jest.fn();

      const middleware = paperTradingGuard.interceptTradingOperations();
      middleware(mockReq, mockRes, mockNext);

      expect((mockReq as any).isPaperTrade).toBe(true);
      expect((mockReq as any).paperTradingMode).toBe(true);
      expect(mockReq.body.isPaperTrade).toBe(true);
      expect(mockReq.body.paperTradingMode).toBe(true);
      expect(mockReq.body.virtualTrade).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should block real money operations with critical error', () => {
      const dangerousOperations = [
        '/api/withdraw',
        '/api/transfer', 
        '/api/futures/trade',
        '/api/margin/borrow',
        '/api/deposit',
        '/api/lending/create'
      ];

      dangerousOperations.forEach(path => {
        const mockReq = {
          path,
          method: 'POST',
          body: { amount: 1000, currency: 'USDT' },
          ip: '127.0.0.1',
          get: jest.fn().mockReturnValue('test-agent')
        } as unknown as Request;

        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as unknown as Response;

        const mockNext = jest.fn();

        const middleware = paperTradingGuard.interceptTradingOperations();
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'REAL_MONEY_OPERATION',
            riskLevel: 'critical',
            paperTradingMode: true
          })
        );
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    test('should detect dangerous operations in request body', () => {
      const mockReq = {
        path: '/api/trading/advanced',
        method: 'POST',
        body: { 
          action: 'withdraw',
          amount: 500,
          destination: 'external_wallet'
        },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('test-agent')
      } as unknown as Request;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;

      const mockNext = jest.fn();

      const middleware = paperTradingGuard.interceptTradingOperations();
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should allow safe trading operations', () => {
      const safeOperations = [
        '/api/trading/signals',
        '/api/trading/history',
        '/api/trading/portfolio',
        '/api/market/data',
        '/api/analysis/technical'
      ];

      safeOperations.forEach(path => {
        const mockReq = {
          path,
          method: 'GET',
          body: {},
          ip: '127.0.0.1',
          get: jest.fn().mockReturnValue('test-agent')
        } as unknown as Request;

        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as unknown as Response;

        const mockNext = jest.fn();

        const middleware = paperTradingGuard.interceptTradingOperations();
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });
    });
  });

  describe('API Key Permission Validation', () => {
    test('should validate safe read-only API keys', async () => {
      const safeApiInfo = {
        exchange: 'binance',
        apiKey: 'readonly_test_key_12345',
        sandbox: true,
        testConnection: false
      };

      const result = await apiPermissionValidator.validateApiKey(safeApiInfo);

      expect(result.isValid).toBe(true);
      expect(result.isReadOnly).toBe(true);
      expect(result.riskLevel).toBe('low');
      expect(result.violations).toHaveLength(0);
    });

    test('should reject API keys with trading permissions', async () => {
      const dangerousApiInfo = {
        exchange: 'binance',
        apiKey: 'trading_key_with_trade_permissions',
        sandbox: false,
        testConnection: false
      };

      await expect(
        apiPermissionValidator.validateApiKey(dangerousApiInfo)
      ).rejects.toThrow(ApiPermissionValidationError);
    });

    test('should reject API keys with withdrawal permissions', async () => {
      const withdrawalApiInfo = {
        exchange: 'binance',
        apiKey: 'withdraw_key_with_withdraw_access',
        sandbox: false,
        testConnection: false
      };

      await expect(
        apiPermissionValidator.validateApiKey(withdrawalApiInfo)
      ).rejects.toThrow(ApiPermissionValidationError);
    });

    test('should handle KuCoin passphrase validation', async () => {
      const kucoinApiInfo = {
        exchange: 'kucoin',
        apiKey: 'kucoin_key_123',
        passphrase: 'trading_passphrase',
        sandbox: false,
        testConnection: false
      };

      await expect(
        apiPermissionValidator.validateApiKey(kucoinApiInfo)
      ).rejects.toThrow(ApiPermissionValidationError);
    });

    test('should cache validation results', async () => {
      const apiInfo = {
        exchange: 'binance',
        apiKey: 'test_key_for_caching',
        sandbox: true,
        testConnection: false
      };

      const result1 = await apiPermissionValidator.validateApiKey(apiInfo);
      const result2 = await apiPermissionValidator.validateApiKey(apiInfo);

      expect(result1).toEqual(result2);
      
      const cacheStats = apiPermissionValidator.getCacheStats();
      expect(cacheStats.size).toBeGreaterThan(0);
    });

    test('should validate multiple API keys', async () => {
      const apiInfos = [
        {
          exchange: 'binance',
          apiKey: 'safe_binance_key',
          sandbox: true
        },
        {
          exchange: 'kucoin', 
          apiKey: 'safe_kucoin_key',
          sandbox: true
        }
      ];

      const results = await apiPermissionValidator.validateMultipleApiKeys(apiInfos);

      expect(results.size).toBe(2);
      expect(results.get('binance')).toBeDefined();
      expect(results.get('kucoin')).toBeDefined();
    });
  });

  describe('Environment Validation', () => {
    test('should validate safe paper trading environment', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        PAPER_TRADING_MODE: 'true',
        ALLOW_REAL_TRADES: 'false',
        NODE_ENV: 'test'
      };

      expect(() => environmentValidator.validateEnvironment()).not.toThrow();

      process.env = originalEnv;
    });

    test('should reject unsafe environment configuration', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        PAPER_TRADING_MODE: 'false',
        ALLOW_REAL_TRADES: 'true',
        NODE_ENV: 'production'
      };

      expect(() => environmentValidator.validateEnvironment()).toThrow(EnvironmentValidationError);

      process.env = originalEnv;
    });

    test('should provide comprehensive environment status', () => {
      const status = environmentValidator.getEnvironmentStatus();

      expect(status).toHaveProperty('isPaperTradingMode');
      expect(status).toHaveProperty('allowRealTrades');
      expect(status).toHaveProperty('environment');
      expect(status).toHaveProperty('isProduction');
      expect(status).toHaveProperty('configuredExchanges');
      expect(Array.isArray(status.configuredExchanges)).toBe(true);
    });
  });

  describe('Security Audit Trail', () => {
    test('should maintain comprehensive audit log', () => {
      // Generate various security events
      paperTradingGuard.validatePaperTradingMode();
      
      try {
        paperTradingGuard.validateApiPermissions('dangerous_key_with_trade', 'binance');
      } catch (error) {
        // Expected to fail
      }

      const auditLog = paperTradingGuard.getSecurityAuditLog();
      expect(auditLog.length).toBeGreaterThan(0);

      const recentEvents = auditLog.filter(
        event => Date.now() - event.timestamp < 10000
      );
      expect(recentEvents.length).toBeGreaterThan(0);

      // Verify audit log structure
      recentEvents.forEach(event => {
        expect(event).toHaveProperty('timestamp');
        expect(event).toHaveProperty('event');
        expect(event).toHaveProperty('details');
        expect(event).toHaveProperty('riskLevel');
        expect(['low', 'medium', 'high', 'critical']).toContain(event.riskLevel);
      });
    });

    test('should log different risk levels appropriately', () => {
      const initialLogLength = paperTradingGuard.getSecurityAuditLog().length;

      // Generate events of different risk levels
      paperTradingGuard.validatePaperTradingMode(); // Low risk
      
      try {
        paperTradingGuard.validateApiPermissions('trading_key', 'binance'); // Critical risk
      } catch (error) {
        // Expected
      }

      const auditLog = paperTradingGuard.getSecurityAuditLog();
      const newEvents = auditLog.slice(initialLogLength);

      const lowRiskEvents = newEvents.filter(e => e.riskLevel === 'low');
      const criticalRiskEvents = newEvents.filter(e => e.riskLevel === 'critical');

      expect(lowRiskEvents.length).toBeGreaterThan(0);
      expect(criticalRiskEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle PaperTradingError appropriately', () => {
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;

      const error = new PaperTradingError(
        'Test paper trading error',
        'TEST_ERROR',
        'critical'
      );

      // Simulate error handling
      const middleware = paperTradingGuard.interceptTradingOperations();
      const mockReq = {
        path: '/api/withdraw',
        method: 'POST',
        body: {},
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('test-agent')
      } as unknown as Request;

      const mockNext = jest.fn();

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'REAL_MONEY_OPERATION',
          riskLevel: 'critical',
          paperTradingMode: true
        })
      );
    });

    test('should handle unexpected errors gracefully', () => {
      const mockReq = {
        path: '/api/trading/orders',
        method: 'POST',
        body: null, // This might cause issues
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('test-agent')
      } as unknown as Request;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;

      const mockNext = jest.fn();

      const middleware = paperTradingGuard.interceptTradingOperations();
      
      // Should not throw, should handle gracefully
      expect(() => middleware(mockReq, mockRes, mockNext)).not.toThrow();
    });
  });

  describe('Integration with Other Components', () => {
    test('should work with API permission validator', async () => {
      const result = paperTradingGuard.validateApiPermissions('safe_readonly_key', 'binance');
      
      expect(result.isValid).toBe(true);
      expect(result.riskLevel).toBe('low');
      expect(result.violations).toHaveLength(0);
    });

    test('should maintain consistency across validation methods', () => {
      // Test that different validation methods are consistent
      expect(() => paperTradingGuard.validatePaperTradingMode()).not.toThrow();
      
      const config = paperTradingGuard.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.allowRealTrades).toBe(false);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle high volume of validation requests', () => {
      const startTime = Date.now();
      
      // Perform many validations
      for (let i = 0; i < 1000; i++) {
        paperTradingGuard.validatePaperTradingMode();
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
    });

    test('should maintain audit log performance', () => {
      const startTime = Date.now();
      
      // Generate many audit entries
      for (let i = 0; i < 100; i++) {
        try {
          paperTradingGuard.validateApiPermissions(`test_key_${i}`, 'test');
        } catch (error) {
          // Expected to fail
        }
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should maintain performance even with many entries
      expect(duration).toBeLessThan(2000);
      
      const auditLog = paperTradingGuard.getSecurityAuditLog();
      expect(auditLog.length).toBeLessThanOrEqual(1000); // Size limit enforced
    });
  });
});