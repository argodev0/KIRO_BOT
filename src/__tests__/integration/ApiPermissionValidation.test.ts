/**
 * API Permission Validation Integration Tests
 * Tests the complete API permission validation system with realistic scenarios
 */

import { 
  apiPermissionValidator, 
  ApiKeyValidation, 
  ExchangeApiInfo,
  ApiPermissionValidationError 
} from '../../utils/ApiPermissionValidator';
import { 
  apiPermissionGuard,
  validateExchangeApiKey 
} from '../../middleware/apiPermissionGuard';

// Mock the logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('API Permission Validation Integration', () => {
  beforeEach(() => {
    // Clear cache before each test
    apiPermissionValidator.clearCache();
    apiPermissionGuard.clearCache();
  });

  describe('Binance API Key Validation', () => {
    it('should validate safe Binance testnet API key', async () => {
      const apiInfo: ExchangeApiInfo = {
        exchange: 'binance',
        apiKey: 'test_binance_readonly_key_12345',
        apiSecret: 'test_secret',
        sandbox: true,
        testConnection: false
      };

      const validation = await apiPermissionValidator.validateApiKey(apiInfo);

      expect(validation.isValid).toBe(true);
      expect(validation.exchange).toBe('binance');
      expect(validation.riskLevel).toBe('low');
      expect(validation.violations.length).toBeLessThanOrEqual(1);
      if (validation.violations.length > 0) {
        expect(validation.violations[0].severity).toBe('low');
      }
    });

    it('should detect dangerous Binance API key patterns', async () => {
      const apiInfo: ExchangeApiInfo = {
        exchange: 'binance',
        apiKey: 'binance_trade_enabled_key_with_withdraw_permissions',
        apiSecret: 'dangerous_secret',
        sandbox: false,
        testConnection: false
      };

      await expect(apiPermissionValidator.validateApiKey(apiInfo))
        .rejects.toThrow(ApiPermissionValidationError);
    });

    it('should flag mainnet API keys as medium risk', async () => {
      const apiInfo: ExchangeApiInfo = {
        exchange: 'binance',
        apiKey: 'mainnet_readonly_key_12345',
        apiSecret: 'mainnet_secret',
        sandbox: false,
        testConnection: false
      };

      const validation = await apiPermissionValidator.validateApiKey(apiInfo);

      expect(validation.isValid).toBe(true);
      expect(validation.riskLevel).toBe('medium');
      expect(validation.violations.some(v => v.detected === 'mainnet_key')).toBe(true);
    });

    it('should validate short API keys as potentially safer', async () => {
      const apiInfo: ExchangeApiInfo = {
        exchange: 'binance',
        apiKey: 'short_key_123', // Less than 64 characters
        apiSecret: 'short_secret',
        sandbox: true,
        testConnection: false
      };

      const validation = await apiPermissionValidator.validateApiKey(apiInfo);

      expect(validation.isValid).toBe(true);
      expect(validation.violations.some(v => v.detected === 'short_key')).toBe(true);
    });
  });

  describe('KuCoin API Key Validation', () => {
    it('should validate safe KuCoin sandbox API key', async () => {
      const apiInfo: ExchangeApiInfo = {
        exchange: 'kucoin',
        apiKey: 'kucoin_readonly_sandbox_key',
        apiSecret: 'sandbox_secret',
        sandbox: true,
        testConnection: false
      };

      const validation = await apiPermissionValidator.validateApiKey(apiInfo);

      expect(validation.isValid).toBe(true);
      expect(validation.exchange).toBe('kucoin');
      expect(validation.riskLevel).toBe('low');
    });

    it('should flag KuCoin API keys with passphrase as high risk', async () => {
      const apiInfo: ExchangeApiInfo = {
        exchange: 'kucoin',
        apiKey: 'kucoin_key_with_passphrase',
        apiSecret: 'secret_with_passphrase',
        passphrase: 'trading_passphrase',
        sandbox: false,
        testConnection: false
      };

      await expect(apiPermissionValidator.validateApiKey(apiInfo)).rejects.toThrow('API key validation failed');
      
      // Test that the error contains the expected violation
      try {
        await apiPermissionValidator.validateApiKey(apiInfo);
      } catch (error: any) {
        expect(error.message).toContain('KuCoin API key has passphrase');
      }
    });

    it('should flag mainnet KuCoin API keys', async () => {
      const apiInfo: ExchangeApiInfo = {
        exchange: 'kucoin',
        apiKey: 'kucoin_mainnet_key',
        apiSecret: 'mainnet_secret',
        sandbox: false,
        testConnection: false
      };

      const validation = await apiPermissionValidator.validateApiKey(apiInfo);

      expect(validation.violations.some(v => v.detected === 'mainnet_key')).toBe(true);
    });
  });

  describe('Generic Exchange API Key Validation', () => {
    it('should validate unknown exchange with minimal risk', async () => {
      const apiInfo: ExchangeApiInfo = {
        exchange: 'unknown_exchange',
        apiKey: 'simple_readonly_key',
        sandbox: true,
        testConnection: false
      };

      const validation = await apiPermissionValidator.validateApiKey(apiInfo);

      expect(validation.isValid).toBe(true);
      expect(validation.exchange).toBe('unknown_exchange');
      expect(validation.riskLevel).toBe('low');
    });

    it('should flag API keys with secrets as high risk', async () => {
      const apiInfo: ExchangeApiInfo = {
        exchange: 'generic_exchange',
        apiKey: 'generic_key',
        apiSecret: 'generic_secret',
        sandbox: false,
        testConnection: false
      };

      await expect(apiPermissionValidator.validateApiKey(apiInfo)).rejects.toThrow('API key validation failed');
      
      // Test that the error contains the expected violation
      try {
        await apiPermissionValidator.validateApiKey(apiInfo);
      } catch (error: any) {
        expect(error.message).toContain('API secret provided');
      }
    });
  });

  describe('Dangerous Pattern Detection', () => {
    const dangerousPatterns = [
      'trade_enabled_key',
      'withdraw_permissions_key',
      'futures_trading_key',
      'margin_enabled_key'
    ];

    dangerousPatterns.forEach(pattern => {
      it(`should detect dangerous pattern: ${pattern}`, async () => {
        const apiInfo: ExchangeApiInfo = {
          exchange: 'test_exchange',
          apiKey: pattern,
          sandbox: true,
          testConnection: false
        };

        await expect(apiPermissionValidator.validateApiKey(apiInfo))
          .rejects.toThrow(ApiPermissionValidationError);
      });
    });
  });

  describe('Multiple API Key Validation', () => {
    it('should validate multiple safe API keys', async () => {
      const apiInfos: ExchangeApiInfo[] = [
        {
          exchange: 'binance',
          apiKey: 'safe_binance_readonly_key',
          sandbox: true,
          testConnection: false
        },
        {
          exchange: 'kucoin',
          apiKey: 'safe_kucoin_readonly_key',
          sandbox: true,
          testConnection: false
        }
      ];

      const results = await apiPermissionValidator.validateMultipleApiKeys(apiInfos);

      expect(results.size).toBe(2);
      expect(results.get('binance')?.isValid).toBe(true);
      expect(results.get('kucoin')?.isValid).toBe(true);
    });

    it('should handle mixed safe and dangerous API keys', async () => {
      const apiInfos: ExchangeApiInfo[] = [
        {
          exchange: 'binance',
          apiKey: 'safe_binance_readonly_key',
          sandbox: true,
          testConnection: false
        },
        {
          exchange: 'kucoin',
          apiKey: 'dangerous_trade_enabled_key',
          sandbox: false,
          testConnection: false
        }
      ];

      const results = await apiPermissionValidator.validateMultipleApiKeys(apiInfos);

      expect(results.size).toBe(2);
      expect(results.get('binance')?.isValid).toBe(true);
      expect(results.get('kucoin')?.isValid).toBe(false);
      expect(results.get('kucoin')?.riskLevel).toBe('critical');
    });
  });

  describe('Caching Behavior', () => {
    it('should cache validation results', async () => {
      const apiInfo: ExchangeApiInfo = {
        exchange: 'binance',
        apiKey: 'cached_test_key',
        sandbox: true,
        testConnection: false
      };

      // First validation
      const validation1 = await apiPermissionValidator.validateApiKey(apiInfo);
      
      // Second validation should use cache
      const validation2 = await apiPermissionValidator.validateApiKey(apiInfo);

      expect(validation1).toEqual(validation2);
      
      const cacheStats = apiPermissionValidator.getCacheStats();
      expect(cacheStats.size).toBe(1);
      expect(cacheStats.entries).toContain('binance_cached_test_key');
    });

    it('should clear cache when requested', async () => {
      const apiInfo: ExchangeApiInfo = {
        exchange: 'binance',
        apiKey: 'cache_clear_test_key',
        sandbox: true,
        testConnection: false
      };

      await apiPermissionValidator.validateApiKey(apiInfo);
      
      let cacheStats = apiPermissionValidator.getCacheStats();
      expect(cacheStats.size).toBe(1);

      apiPermissionValidator.clearCache();
      
      cacheStats = apiPermissionValidator.getCacheStats();
      expect(cacheStats.size).toBe(0);
    });
  });

  describe('Integration with API Permission Guard', () => {
    it('should validate exchange API key through guard', async () => {
      const validation = await validateExchangeApiKey(
        'binance',
        'integration_test_key',
        'integration_test_secret',
        undefined,
        true
      );

      expect(validation.exchange).toBe('binance');
      expect(validation.isValid).toBe(true);
    });

    it('should enforce read-only API keys', () => {
      apiPermissionGuard.enforceReadOnlyApiKeys();
      
      const config = apiPermissionGuard.getConfig();
      expect(config.blockTradingPermissions).toBe(true);
      expect(config.maxRiskLevel).toBe('low');
      expect(config.strictMode).toBe(true);
    });
  });

  describe('Risk Level Calculation', () => {
    it('should calculate low risk for safe API keys', async () => {
      const apiInfo: ExchangeApiInfo = {
        exchange: 'binance',
        apiKey: 'safe_readonly_key',
        sandbox: true,
        testConnection: false
      };

      const validation = await apiPermissionValidator.validateApiKey(apiInfo);
      expect(validation.riskLevel).toBe('low');
    });

    it('should calculate medium risk for mainnet keys', async () => {
      const apiInfo: ExchangeApiInfo = {
        exchange: 'binance',
        apiKey: 'mainnet_readonly_key',
        sandbox: false,
        testConnection: false
      };

      const validation = await apiPermissionValidator.validateApiKey(apiInfo);
      expect(validation.riskLevel).toBe('medium');
    });

    it('should calculate high risk for keys with secrets', async () => {
      const apiInfo: ExchangeApiInfo = {
        exchange: 'generic',
        apiKey: 'key_with_secret',
        apiSecret: 'secret_value',
        sandbox: false,
        testConnection: false
      };

      await expect(apiPermissionValidator.validateApiKey(apiInfo)).rejects.toThrow('API key validation failed');
    });

    it('should calculate critical risk for dangerous patterns', async () => {
      const apiInfo: ExchangeApiInfo = {
        exchange: 'binance',
        apiKey: 'trade_withdraw_enabled_key',
        sandbox: false,
        testConnection: false
      };

      await expect(apiPermissionValidator.validateApiKey(apiInfo))
        .rejects.toThrow(ApiPermissionValidationError);
    });
  });

  describe('Empty and Invalid API Keys', () => {
    it('should handle empty API keys safely', async () => {
      const apiInfo: ExchangeApiInfo = {
        exchange: 'binance',
        apiKey: '',
        sandbox: true,
        testConnection: false
      };

      const validation = await apiPermissionValidator.validateApiKey(apiInfo);

      expect(validation.isValid).toBe(true);
      expect(validation.isReadOnly).toBe(true);
      expect(validation.riskLevel).toBe('low');
      expect(validation.violations).toHaveLength(0);
    });

    it('should handle null/undefined API keys safely', async () => {
      const apiInfo: ExchangeApiInfo = {
        exchange: 'binance',
        apiKey: null as any,
        sandbox: true,
        testConnection: false
      };

      const validation = await apiPermissionValidator.validateApiKey(apiInfo);

      expect(validation.isValid).toBe(true);
      expect(validation.isReadOnly).toBe(true);
      expect(validation.riskLevel).toBe('low');
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      // Mock a validation error scenario
      const originalValidateApiKey = apiPermissionValidator.validateApiKey;
      
      jest.spyOn(apiPermissionValidator, 'validateApiKey').mockImplementation(async () => {
        throw new Error('Network error');
      });

      const apiInfo: ExchangeApiInfo = {
        exchange: 'binance',
        apiKey: 'error_test_key',
        sandbox: true,
        testConnection: false
      };

      await expect(apiPermissionValidator.validateApiKey(apiInfo)).rejects.toThrow('Network error');

      // Restore original method
      jest.restoreAllMocks();
    });
  });
});