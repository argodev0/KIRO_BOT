/**
 * API Permission Guard Middleware Tests
 * Tests for API key validation and trading permission blocking
 */

import { Request, Response, NextFunction } from 'express';
import { 
  ApiPermissionGuard, 
  validateApiPermissions,
  validateTradingApiPermissions,
  validateExchangeApiKey
} from '../../middleware/apiPermissionGuard';
import { apiPermissionValidator } from '../../utils/ApiPermissionValidator';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock the logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock the ApiPermissionValidator
jest.mock('../../utils/ApiPermissionValidator', () => ({
  apiPermissionValidator: {
    validateApiKey: jest.fn()
  }
}));

describe('ApiPermissionGuard', () => {
  let guard: ApiPermissionGuard;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockValidateApiKey: jest.MockedFunction<typeof apiPermissionValidator.validateApiKey>;

  beforeEach(() => {
    guard = ApiPermissionGuard.getInstance();
    
    mockRequest = {
      get: jest.fn(),
      body: {},
      path: '/api/test',
      method: 'GET'
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    mockNext = jest.fn();
    
    mockValidateApiKey = apiPermissionValidator.validateApiKey as jest.MockedFunction<typeof apiPermissionValidator.validateApiKey>;
    
    // Clear any previous mock calls
    jest.clearAllMocks();
    
    // Clear cache
    guard.clearCache();
  });

  describe('validateApiPermissions middleware', () => {
    it('should pass through when no API keys are present', async () => {
      const middleware = guard.validateApiPermissions();
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should validate Binance API key from headers', async () => {
      const mockApiKey = 'test-binance-api-key';
      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'X-MBX-APIKEY') return mockApiKey;
        return undefined;
      });

      mockValidateApiKey.mockResolvedValue({
        isValid: true,
        isReadOnly: true,
        permissions: [],
        violations: [],
        riskLevel: 'low',
        exchange: 'binance'
      });

      const middleware = guard.validateApiPermissions();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockValidateApiKey).toHaveBeenCalledWith({
        exchange: 'binance',
        apiKey: mockApiKey,
        apiSecret: undefined,
        passphrase: undefined,
        sandbox: false,
        testConnection: true
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should validate KuCoin API key from headers', async () => {
      const mockApiKey = 'test-kucoin-api-key';
      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'KC-API-KEY') return mockApiKey;
        return undefined;
      });

      mockValidateApiKey.mockResolvedValue({
        isValid: true,
        isReadOnly: true,
        permissions: [],
        violations: [],
        riskLevel: 'low',
        exchange: 'kucoin'
      });

      const middleware = guard.validateApiPermissions();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockValidateApiKey).toHaveBeenCalledWith({
        exchange: 'kucoin',
        apiKey: mockApiKey,
        apiSecret: undefined,
        passphrase: undefined,
        sandbox: false,
        testConnection: true
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should validate API keys from request body', async () => {
      mockRequest.body = {
        apiKeys: {
          binance: {
            apiKey: 'body-binance-key',
            apiSecret: 'body-binance-secret',
            sandbox: true
          }
        }
      };

      mockValidateApiKey.mockResolvedValue({
        isValid: true,
        isReadOnly: true,
        permissions: [],
        violations: [],
        riskLevel: 'low',
        exchange: 'binance'
      });

      const middleware = guard.validateApiPermissions();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockValidateApiKey).toHaveBeenCalledWith({
        exchange: 'binance',
        apiKey: 'body-binance-key',
        apiSecret: 'body-binance-secret',
        passphrase: undefined,
        sandbox: true,
        testConnection: true
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should block API keys with trading permissions', async () => {
      const mockApiKey = 'trading-enabled-key';
      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'X-MBX-APIKEY') return mockApiKey;
        return undefined;
      });

      mockValidateApiKey.mockResolvedValue({
        isValid: true,
        isReadOnly: false, // Has trading permissions
        permissions: ['trade', 'order'],
        violations: [{
          type: 'trading_permission',
          message: 'API key has trading permissions',
          severity: 'critical',
          detected: 'trade'
        }],
        riskLevel: 'critical',
        exchange: 'binance'
      });

      const middleware = guard.validateApiPermissions();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'CRITICAL_API_VALIDATION_FAILURE',
          riskLevel: 'critical',
          paperTradingMode: true
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block API keys with high risk level', async () => {
      const mockApiKey = 'high-risk-key';
      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'X-MBX-APIKEY') return mockApiKey;
        return undefined;
      });

      mockValidateApiKey.mockResolvedValue({
        isValid: true,
        isReadOnly: true,
        permissions: [],
        violations: [{
          type: 'suspicious_pattern',
          message: 'Suspicious API key pattern',
          severity: 'high',
          detected: 'pattern'
        }],
        riskLevel: 'high', // Too high for default config
        exchange: 'binance'
      });

      const middleware = guard.validateApiPermissions();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should use cached validation results', async () => {
      const mockApiKey = 'cached-key';
      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'X-MBX-APIKEY') return mockApiKey;
        return undefined;
      });

      const mockValidation = {
        isValid: true,
        isReadOnly: true,
        permissions: [],
        violations: [],
        riskLevel: 'low' as const,
        exchange: 'binance'
      };

      mockValidateApiKey.mockResolvedValue(mockValidation);

      const middleware = guard.validateApiPermissions();
      
      // First call
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Second call should use cache
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockValidateApiKey).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledTimes(2);
    });
  });

  describe('validateTradingApiPermissions middleware', () => {
    it('should require API keys for trading endpoints', async () => {
      const middleware = guard.validateTradingApiPermissions();
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'MISSING_API_KEYS',
          riskLevel: 'critical'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should strictly validate trading API keys', async () => {
      const mockApiKey = 'trading-key';
      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'X-MBX-APIKEY') return mockApiKey;
        return undefined;
      });

      mockValidateApiKey.mockResolvedValue({
        isValid: true,
        isReadOnly: false, // Has trading permissions - should be blocked
        permissions: ['trade'],
        violations: [{
          type: 'trading_permission',
          message: 'API key has trading permissions',
          severity: 'critical',
          detected: 'trade'
        }],
        riskLevel: 'critical',
        exchange: 'binance'
      });

      const middleware = guard.validateTradingApiPermissions();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'TRADING_PERMISSIONS_DETECTED',
          riskLevel: 'critical'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow read-only API keys for trading endpoints', async () => {
      const mockApiKey = 'readonly-key';
      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'X-MBX-APIKEY') return mockApiKey;
        return undefined;
      });

      mockValidateApiKey.mockResolvedValue({
        isValid: true,
        isReadOnly: true, // Read-only - should be allowed
        permissions: [],
        violations: [],
        riskLevel: 'low',
        exchange: 'binance'
      });

      const middleware = guard.validateTradingApiPermissions();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('validateExchangeApiKey function', () => {
    it('should validate a specific exchange API key', async () => {
      const mockValidation = {
        isValid: true,
        isReadOnly: true,
        permissions: [],
        violations: [],
        riskLevel: 'low' as const,
        exchange: 'binance'
      };

      mockValidateApiKey.mockResolvedValue(mockValidation);

      const result = await validateExchangeApiKey('binance', 'test-key', 'test-secret');

      expect(mockValidateApiKey).toHaveBeenCalledWith({
        exchange: 'binance',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        passphrase: undefined,
        sandbox: false,
        testConnection: true
      });
      expect(result).toEqual(mockValidation);
    });

    it('should validate KuCoin API key with passphrase', async () => {
      const mockValidation = {
        isValid: true,
        isReadOnly: true,
        permissions: [],
        violations: [],
        riskLevel: 'low' as const,
        exchange: 'kucoin'
      };

      mockValidateApiKey.mockResolvedValue(mockValidation);

      const result = await validateExchangeApiKey(
        'kucoin', 
        'test-key', 
        'test-secret', 
        'test-passphrase',
        true
      );

      expect(mockValidateApiKey).toHaveBeenCalledWith({
        exchange: 'kucoin',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        passphrase: 'test-passphrase',
        sandbox: true,
        testConnection: true
      });
      expect(result).toEqual(mockValidation);
    });
  });

  describe('Configuration management', () => {
    it('should get current configuration', () => {
      const config = guard.getConfig();
      
      expect(config).toEqual({
        enabled: true,
        strictMode: true,
        allowedExchanges: ['binance', 'kucoin'],
        maxRiskLevel: 'medium',
        cacheValidations: true,
        blockTradingPermissions: true
      });
    });

    it('should update configuration', () => {
      guard.updateConfig({
        maxRiskLevel: 'low',
        strictMode: false
      });

      const config = guard.getConfig();
      expect(config.maxRiskLevel).toBe('low');
      expect(config.strictMode).toBe(false);
    });

    it('should enforce read-only API keys', () => {
      guard.enforceReadOnlyApiKeys();

      const config = guard.getConfig();
      expect(config.blockTradingPermissions).toBe(true);
      expect(config.maxRiskLevel).toBe('low');
      expect(config.strictMode).toBe(true);
    });
  });

  describe('Cache management', () => {
    it('should provide cache statistics', () => {
      const stats = guard.getCacheStats();
      
      expect(stats).toEqual({
        size: 0,
        entries: []
      });
    });

    it('should clear cache', () => {
      guard.clearCache();
      
      const stats = guard.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Error handling', () => {
    it('should handle ApiPermissionValidationError', async () => {
      const mockApiKey = 'error-key';
      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'X-MBX-APIKEY') return mockApiKey;
        return undefined;
      });

      const mockError = new Error('Validation failed');
      mockError.name = 'ApiPermissionValidationError';
      (mockError as any).violations = [{ type: 'test', message: 'Test violation' }];
      (mockError as any).riskLevel = 'critical';

      mockValidateApiKey.mockRejectedValue(mockError);

      const middleware = guard.validateApiPermissions();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should still continue with failed validation result
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle unexpected errors', async () => {
      const mockApiKey = 'error-key';
      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'X-MBX-APIKEY') return mockApiKey;
        return undefined;
      });

      mockValidateApiKey.mockRejectedValue(new Error('Unexpected error'));

      const middleware = guard.validateApiPermissions();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should continue with failed validation result
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Multiple API keys validation', () => {
    it('should validate multiple exchange API keys', async () => {
      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'X-MBX-APIKEY') return 'binance-key';
        if (header === 'KC-API-KEY') return 'kucoin-key';
        return undefined;
      });

      mockValidateApiKey
        .mockResolvedValueOnce({
          isValid: true,
          isReadOnly: true,
          permissions: [],
          violations: [],
          riskLevel: 'low',
          exchange: 'binance'
        })
        .mockResolvedValueOnce({
          isValid: true,
          isReadOnly: true,
          permissions: [],
          violations: [],
          riskLevel: 'low',
          exchange: 'kucoin'
        });

      const middleware = guard.validateApiPermissions();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockValidateApiKey).toHaveBeenCalledTimes(2);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should block if any API key has trading permissions', async () => {
      (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'X-MBX-APIKEY') return 'binance-key';
        if (header === 'KC-API-KEY') return 'kucoin-key';
        return undefined;
      });

      mockValidateApiKey
        .mockResolvedValueOnce({
          isValid: true,
          isReadOnly: true,
          permissions: [],
          violations: [],
          riskLevel: 'low',
          exchange: 'binance'
        })
        .mockResolvedValueOnce({
          isValid: true,
          isReadOnly: false, // Has trading permissions
          permissions: ['trade'],
          violations: [{
            type: 'trading_permission',
            message: 'Trading permissions detected',
            severity: 'critical',
            detected: 'trade'
          }],
          riskLevel: 'critical',
          exchange: 'kucoin'
        });

      const middleware = guard.validateApiPermissions();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});

describe('Exported middleware functions', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      get: jest.fn(),
      body: {},
      path: '/api/test',
      method: 'GET'
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    mockNext = jest.fn();
    
    jest.clearAllMocks();
  });

  it('should export validateApiPermissions middleware', async () => {
    await validateApiPermissions(mockRequest as Request, mockResponse as Response, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should export validateTradingApiPermissions middleware', async () => {
    await validateTradingApiPermissions(mockRequest as Request, mockResponse as Response, mockNext);
    expect(mockResponse.status).toHaveBeenCalledWith(403); // No API keys provided
  });
});