/**
 * API Key Permission Validator
 * Validates that API keys only have read-only permissions for paper trading safety
 */

import { logger } from './logger';

export interface ApiKeyValidation {
  isValid: boolean;
  isReadOnly: boolean;
  permissions: string[];
  violations: ApiKeyViolation[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  exchange: string;
}

export interface ApiKeyViolation {
  type: 'trading_permission' | 'withdrawal_permission' | 'futures_permission' | 'margin_permission' | 'suspicious_pattern';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detected: string;
}

export interface ExchangeApiInfo {
  exchange: string;
  apiKey: string;
  apiSecret?: string;
  passphrase?: string;
  sandbox: boolean;
  testConnection?: boolean;
}

export class ApiPermissionValidationError extends Error {
  public readonly violations: ApiKeyViolation[];
  public readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';

  constructor(message: string, violations: ApiKeyViolation[], riskLevel: 'low' | 'medium' | 'high' | 'critical') {
    super(message);
    this.name = 'ApiPermissionValidationError';
    this.violations = violations;
    this.riskLevel = riskLevel;
  }
}

export class ApiPermissionValidator {
  private static instance: ApiPermissionValidator;
  private validationCache: Map<string, ApiKeyValidation> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Dangerous permission patterns that indicate trading capabilities
  private readonly DANGEROUS_PATTERNS = {
    trading: [
      'trade', 'order', 'buy', 'sell', 'execute', 'place',
      'cancel', 'modify', 'position', 'leverage'
    ],
    withdrawal: [
      'withdraw', 'transfer', 'send', 'move', 'deposit',
      'payment', 'payout', 'remit'
    ],
    futures: [
      'futures', 'derivative', 'contract', 'perpetual',
      'swap', 'option', 'margin'
    ],
    margin: [
      'margin', 'borrow', 'lend', 'loan', 'credit',
      'leverage', 'collateral'
    ]
  };

  // Safe permission patterns that are read-only
  private readonly SAFE_PATTERNS = [
    'read', 'view', 'get', 'fetch', 'query', 'list',
    'history', 'balance', 'account', 'info', 'status',
    'ticker', 'orderbook', 'candle', 'kline', 'market'
  ];

  private constructor() {
    logger.info('API Permission Validator initialized', {
      isPaperTrading: true,
      dangerousPatterns: Object.keys(this.DANGEROUS_PATTERNS),
      safePatterns: this.SAFE_PATTERNS.length
    });
  }

  public static getInstance(): ApiPermissionValidator {
    if (!ApiPermissionValidator.instance) {
      ApiPermissionValidator.instance = new ApiPermissionValidator();
    }
    return ApiPermissionValidator.instance;
  }

  /**
   * Validate API key permissions for paper trading safety
   */
  public async validateApiKey(apiInfo: ExchangeApiInfo): Promise<ApiKeyValidation> {
    try {
      const cacheKey = `${apiInfo.exchange}_${apiInfo.apiKey}`;
      
      // Check cache first
      const cached = this.getCachedValidation(cacheKey);
      if (cached) {
        return cached;
      }

      logger.info(`Validating API key permissions for ${apiInfo.exchange}`, {
        exchange: apiInfo.exchange,
        sandbox: apiInfo.sandbox,
        isPaperTrading: true
      });

      // Perform validation
      const validation = await this.performValidation(apiInfo);

      // Cache the result
      this.cacheValidation(cacheKey, validation);

      // Log validation result
      this.logValidationResult(validation);

      // Throw error if critical violations found
      if (validation.riskLevel === 'critical' || !validation.isReadOnly) {
        throw new ApiPermissionValidationError(
          `API key validation failed: ${validation.violations.map(v => v.message).join(', ')}`,
          validation.violations,
          validation.riskLevel
        );
      }

      return validation;
    } catch (error) {
      logger.error(`API key validation failed for ${apiInfo.exchange}:`, error);
      
      if (error instanceof ApiPermissionValidationError) {
        throw error;
      }

      // Return safe default for unknown errors
      return {
        isValid: false,
        isReadOnly: false,
        permissions: [],
        violations: [{
          type: 'suspicious_pattern',
          message: 'API key validation failed due to unknown error',
          severity: 'critical',
          detected: 'validation_error'
        }],
        riskLevel: 'critical',
        exchange: apiInfo.exchange
      };
    }
  }

  /**
   * Perform the actual API key validation
   */
  private async performValidation(apiInfo: ExchangeApiInfo): Promise<ApiKeyValidation> {
    const violations: ApiKeyViolation[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Basic validation
    if (!apiInfo.apiKey || apiInfo.apiKey.trim() === '') {
      return {
        isValid: true,
        isReadOnly: true,
        permissions: [],
        violations: [],
        riskLevel: 'low',
        exchange: apiInfo.exchange
      };
    }

    // Check for dangerous patterns in API key itself
    const keyViolations = this.checkApiKeyPatterns(apiInfo.apiKey, apiInfo.exchange);
    violations.push(...keyViolations);

    // Check exchange-specific validation
    const exchangeViolations = await this.validateExchangeSpecific(apiInfo);
    violations.push(...exchangeViolations);

    // Determine overall risk level
    riskLevel = this.calculateRiskLevel(violations);

    // Determine if key is read-only
    const isReadOnly = this.isReadOnlyKey(violations);

    return {
      isValid: violations.length === 0 || riskLevel !== 'critical',
      isReadOnly,
      permissions: this.extractPermissions(violations),
      violations,
      riskLevel,
      exchange: apiInfo.exchange
    };
  }

  /**
   * Check API key for dangerous patterns
   */
  private checkApiKeyPatterns(apiKey: string, _exchange: string): ApiKeyViolation[] {
    const violations: ApiKeyViolation[] = [];
    const keyLower = apiKey.toLowerCase();

    // Check for trading permissions
    for (const pattern of this.DANGEROUS_PATTERNS.trading) {
      if (keyLower.includes(pattern)) {
        violations.push({
          type: 'trading_permission',
          message: `API key may have trading permissions (detected: ${pattern})`,
          severity: 'critical',
          detected: pattern
        });
      }
    }

    // Check for withdrawal permissions
    for (const pattern of this.DANGEROUS_PATTERNS.withdrawal) {
      if (keyLower.includes(pattern)) {
        violations.push({
          type: 'withdrawal_permission',
          message: `API key may have withdrawal permissions (detected: ${pattern})`,
          severity: 'critical',
          detected: pattern
        });
      }
    }

    // Check for futures permissions
    for (const pattern of this.DANGEROUS_PATTERNS.futures) {
      if (keyLower.includes(pattern)) {
        violations.push({
          type: 'futures_permission',
          message: `API key may have futures trading permissions (detected: ${pattern})`,
          severity: 'critical',
          detected: pattern
        });
      }
    }

    // Check for margin permissions
    for (const pattern of this.DANGEROUS_PATTERNS.margin) {
      if (keyLower.includes(pattern)) {
        violations.push({
          type: 'margin_permission',
          message: `API key may have margin trading permissions (detected: ${pattern})`,
          severity: 'critical',
          detected: pattern
        });
      }
    }

    return violations;
  }

  /**
   * Validate exchange-specific API key properties
   */
  private async validateExchangeSpecific(apiInfo: ExchangeApiInfo): Promise<ApiKeyViolation[]> {
    const violations: ApiKeyViolation[] = [];

    switch (apiInfo.exchange.toLowerCase()) {
      case 'binance':
        violations.push(...await this.validateBinanceApi(apiInfo));
        break;
      case 'kucoin':
        violations.push(...await this.validateKuCoinApi(apiInfo));
        break;
      default:
        // Generic validation for unknown exchanges
        violations.push(...this.validateGenericApi(apiInfo));
    }

    return violations;
  }

  /**
   * Validate Binance API key
   */
  private async validateBinanceApi(apiInfo: ExchangeApiInfo): Promise<ApiKeyViolation[]> {
    const violations: ApiKeyViolation[] = [];

    // Binance API keys should be read-only for paper trading
    // In a real implementation, you would make an API call to check permissions
    // For now, we'll do pattern-based validation

    // Check if using testnet (safer)
    if (!apiInfo.sandbox && !apiInfo.apiKey.includes('test')) {
      violations.push({
        type: 'suspicious_pattern',
        message: 'Using mainnet API key - ensure it has read-only permissions',
        severity: 'medium',
        detected: 'mainnet_key'
      });
    }

    // Binance API keys with trading permissions often have specific patterns
    if (apiInfo.apiKey.length < 64) {
      violations.push({
        type: 'suspicious_pattern',
        message: 'API key format may indicate limited permissions (good for paper trading)',
        severity: 'low',
        detected: 'short_key'
      });
    }

    return violations;
  }

  /**
   * Validate KuCoin API key
   */
  private async validateKuCoinApi(apiInfo: ExchangeApiInfo): Promise<ApiKeyViolation[]> {
    const violations: ApiKeyViolation[] = [];

    // KuCoin requires passphrase for trading operations
    if (apiInfo.passphrase && apiInfo.passphrase.trim() !== '') {
      violations.push({
        type: 'trading_permission',
        message: 'KuCoin API key has passphrase - may indicate trading permissions',
        severity: 'high',
        detected: 'passphrase_present'
      });
    }

    // Check if using sandbox
    if (!apiInfo.sandbox) {
      violations.push({
        type: 'suspicious_pattern',
        message: 'Using KuCoin mainnet API - ensure read-only permissions',
        severity: 'medium',
        detected: 'mainnet_key'
      });
    }

    return violations;
  }

  /**
   * Generic API validation for unknown exchanges
   */
  private validateGenericApi(apiInfo: ExchangeApiInfo): ApiKeyViolation[] {
    const violations: ApiKeyViolation[] = [];

    // If API secret is provided, it might indicate trading capabilities
    if (apiInfo.apiSecret && apiInfo.apiSecret.trim() !== '') {
      violations.push({
        type: 'trading_permission',
        message: 'API secret provided - may indicate trading permissions',
        severity: 'high',
        detected: 'api_secret_present'
      });
    }

    return violations;
  }

  /**
   * Calculate overall risk level based on violations
   */
  private calculateRiskLevel(violations: ApiKeyViolation[]): 'low' | 'medium' | 'high' | 'critical' {
    if (violations.length === 0) {
      return 'low';
    }

    const criticalViolations = violations.filter(v => v.severity === 'critical');
    const highViolations = violations.filter(v => v.severity === 'high');
    const mediumViolations = violations.filter(v => v.severity === 'medium');

    if (criticalViolations.length > 0) {
      return 'critical';
    }
    if (highViolations.length > 1) {
      return 'critical';
    }
    if (highViolations.length > 0) {
      return 'high';
    }
    if (mediumViolations.length > 2) {
      return 'high';
    }
    if (mediumViolations.length > 0) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Determine if API key is read-only based on violations
   */
  private isReadOnlyKey(violations: ApiKeyViolation[]): boolean {
    const dangerousViolations = violations.filter(v => 
      v.type === 'trading_permission' || 
      v.type === 'withdrawal_permission' ||
      v.type === 'futures_permission' ||
      v.type === 'margin_permission'
    );

    return dangerousViolations.length === 0;
  }

  /**
   * Extract detected permissions from violations
   */
  private extractPermissions(violations: ApiKeyViolation[]): string[] {
    return violations.map(v => v.detected).filter(Boolean);
  }

  /**
   * Get cached validation result
   */
  private getCachedValidation(cacheKey: string): ApiKeyValidation | null {
    const expiry = this.cacheExpiry.get(cacheKey);
    if (expiry && Date.now() < expiry) {
      return this.validationCache.get(cacheKey) || null;
    }

    // Remove expired cache entry
    this.validationCache.delete(cacheKey);
    this.cacheExpiry.delete(cacheKey);
    return null;
  }

  /**
   * Cache validation result
   */
  private cacheValidation(cacheKey: string, validation: ApiKeyValidation): void {
    this.validationCache.set(cacheKey, validation);
    this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_DURATION);

    // Clean up old cache entries
    this.cleanupCache();
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (now >= expiry) {
        this.validationCache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }
  }

  /**
   * Log validation result
   */
  private logValidationResult(validation: ApiKeyValidation): void {
    const logLevel = validation.riskLevel === 'critical' ? 'error' :
                    validation.riskLevel === 'high' ? 'warn' : 'info';

    logger[logLevel]('API key validation completed', {
      exchange: validation.exchange,
      isValid: validation.isValid,
      isReadOnly: validation.isReadOnly,
      riskLevel: validation.riskLevel,
      violationCount: validation.violations.length,
      violations: validation.violations.map(v => ({
        type: v.type,
        severity: v.severity,
        detected: v.detected
      })),
      isPaperTrading: true
    });
  }

  /**
   * Validate multiple API keys
   */
  public async validateMultipleApiKeys(apiInfos: ExchangeApiInfo[]): Promise<Map<string, ApiKeyValidation>> {
    const results = new Map<string, ApiKeyValidation>();

    for (const apiInfo of apiInfos) {
      try {
        const validation = await this.validateApiKey(apiInfo);
        results.set(apiInfo.exchange, validation);
      } catch (error) {
        logger.error(`Failed to validate API key for ${apiInfo.exchange}:`, error);
        
        // Add failed validation result
        results.set(apiInfo.exchange, {
          isValid: false,
          isReadOnly: false,
          permissions: [],
          violations: [{
            type: 'suspicious_pattern',
            message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            severity: 'critical',
            detected: 'validation_failure'
          }],
          riskLevel: 'critical',
          exchange: apiInfo.exchange
        });
      }
    }

    return results;
  }

  /**
   * Clear validation cache
   */
  public clearCache(): void {
    this.validationCache.clear();
    this.cacheExpiry.clear();
    logger.info('API key validation cache cleared');
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.validationCache.size,
      entries: Array.from(this.validationCache.keys())
    };
  }
}

// Export singleton instance and validation function
export const apiPermissionValidator = ApiPermissionValidator.getInstance();

export const validateApiKeyPermissions = async (apiInfo: ExchangeApiInfo): Promise<ApiKeyValidation> => {
  return apiPermissionValidator.validateApiKey(apiInfo);
};