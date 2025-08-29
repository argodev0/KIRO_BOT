/**
 * API Permission Guard Middleware
 * Integrates with ApiPermissionValidator to enforce read-only API key restrictions
 * Provides comprehensive API key validation and trading permission blocking
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { 
  apiPermissionValidator, 
  ApiKeyValidation, 
  ExchangeApiInfo,
  ApiPermissionValidationError 
} from '../utils/ApiPermissionValidator';

export interface ApiPermissionGuardConfig {
  enabled: boolean;
  strictMode: boolean;
  allowedExchanges: string[];
  maxRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  cacheValidations: boolean;
  blockTradingPermissions: boolean;
}

export interface ApiKeyContext {
  exchange: string;
  apiKey: string;
  apiSecret?: string;
  passphrase?: string;
  sandbox: boolean;
  validation?: ApiKeyValidation;
}

export class ApiPermissionGuardError extends Error {
  public readonly code: string;
  public readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';
  public readonly exchange: string;

  constructor(
    message: string, 
    code: string, 
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    exchange: string
  ) {
    super(message);
    this.name = 'ApiPermissionGuardError';
    this.code = code;
    this.riskLevel = riskLevel;
    this.exchange = exchange;
  }
}

export class ApiPermissionGuard {
  private static instance: ApiPermissionGuard;
  private config: ApiPermissionGuardConfig;
  private validationCache: Map<string, { validation: ApiKeyValidation; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.config = {
      enabled: true,
      strictMode: true,
      allowedExchanges: ['binance', 'kucoin'],
      maxRiskLevel: 'medium', // Only allow low to medium risk API keys
      cacheValidations: true,
      blockTradingPermissions: true
    };

    logger.info('API Permission Guard initialized', {
      enabled: this.config.enabled,
      strictMode: this.config.strictMode,
      allowedExchanges: this.config.allowedExchanges,
      maxRiskLevel: this.config.maxRiskLevel
    });
  }

  public static getInstance(): ApiPermissionGuard {
    if (!ApiPermissionGuard.instance) {
      ApiPermissionGuard.instance = new ApiPermissionGuard();
    }
    return ApiPermissionGuard.instance;
  }

  /**
   * Middleware to validate API key permissions for all exchange-related requests
   */
  public validateApiPermissions() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!this.config.enabled) {
          return next();
        }

        // Extract API key information from request
        const apiKeyContexts = this.extractApiKeyContexts(req);

        if (apiKeyContexts.length === 0) {
          // No API keys found, continue
          return next();
        }

        // Validate all API keys
        const validationResults = await this.validateAllApiKeys(apiKeyContexts);

        // Check if any validations failed
        const failedValidations = validationResults.filter(result => 
          !result.validation.isValid || 
          !result.validation.isReadOnly ||
          this.isRiskLevelTooHigh(result.validation.riskLevel)
        );

        if (failedValidations.length > 0) {
          this.handleValidationFailures(failedValidations, res);
          return;
        }

        // Add validation results to request context
        (req as any).apiKeyValidations = validationResults;

        // Log successful validation
        logger.info('API key permissions validated successfully', {
          validatedKeys: validationResults.length,
          exchanges: validationResults.map(r => r.exchange)
        });

        next();
      } catch (error) {
        this.handleApiPermissionError(error as Error, res);
      }
    };
  }

  /**
   * Middleware specifically for trading endpoints
   */
  public validateTradingApiPermissions() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!this.config.enabled) {
          return next();
        }

        // This is a trading endpoint, so we need strict validation
        const apiKeyContexts = this.extractApiKeyContexts(req);

        if (apiKeyContexts.length === 0) {
          throw new ApiPermissionGuardError(
            'Trading endpoints require API key validation',
            'MISSING_API_KEYS',
            'critical',
            'unknown'
          );
        }

        // Validate all API keys with strict trading permission checks
        const validationResults = await this.validateTradingApiKeys(apiKeyContexts);

        // All API keys must be read-only for trading endpoints
        const tradingPermissionViolations = validationResults.filter(result => 
          !result.validation.isReadOnly
        );

        if (tradingPermissionViolations.length > 0) {
          throw new ApiPermissionGuardError(
            `Trading permissions detected in API keys: ${tradingPermissionViolations.map(v => v.exchange).join(', ')}`,
            'TRADING_PERMISSIONS_DETECTED',
            'critical',
            tradingPermissionViolations[0].exchange
          );
        }

        // Add validation results to request context
        (req as any).apiKeyValidations = validationResults;

        logger.info('Trading API key permissions validated successfully', {
          validatedKeys: validationResults.length,
          exchanges: validationResults.map(r => r.exchange),
          allReadOnly: validationResults.every(r => r.validation.isReadOnly)
        });

        next();
      } catch (error) {
        this.handleApiPermissionError(error as Error, res);
      }
    };
  }

  /**
   * Extract API key contexts from request
   */
  private extractApiKeyContexts(req: Request): ApiKeyContext[] {
    const contexts: ApiKeyContext[] = [];

    // Check headers for API keys
    const binanceApiKey = req.get('X-MBX-APIKEY') || process.env.BINANCE_API_KEY;
    const kucoinApiKey = req.get('KC-API-KEY') || process.env.KUCOIN_API_KEY;

    // Check request body for API keys
    const bodyApiKeys = req.body?.apiKeys || {};

    // Add Binance context if available
    if (binanceApiKey) {
      contexts.push({
        exchange: 'binance',
        apiKey: binanceApiKey,
        apiSecret: process.env.BINANCE_API_SECRET,
        sandbox: process.env.BINANCE_TESTNET === 'true'
      });
    }

    // Add KuCoin context if available
    if (kucoinApiKey) {
      contexts.push({
        exchange: 'kucoin',
        apiKey: kucoinApiKey,
        apiSecret: process.env.KUCOIN_API_SECRET,
        passphrase: process.env.KUCOIN_PASSPHRASE,
        sandbox: process.env.KUCOIN_SANDBOX === 'true'
      });
    }

    // Add API keys from request body
    Object.entries(bodyApiKeys).forEach(([exchange, keyInfo]: [string, any]) => {
      if (keyInfo && keyInfo.apiKey) {
        contexts.push({
          exchange: exchange.toLowerCase(),
          apiKey: keyInfo.apiKey,
          apiSecret: keyInfo.apiSecret,
          passphrase: keyInfo.passphrase,
          sandbox: keyInfo.sandbox || false
        });
      }
    });

    return contexts;
  }

  /**
   * Validate all API keys
   */
  private async validateAllApiKeys(contexts: ApiKeyContext[]): Promise<Array<ApiKeyContext & { validation: ApiKeyValidation }>> {
    const results: Array<ApiKeyContext & { validation: ApiKeyValidation }> = [];

    for (const context of contexts) {
      try {
        // Check cache first
        let validation: ApiKeyValidation;
        
        if (this.config.cacheValidations) {
          const cached = this.getCachedValidation(context);
          if (cached) {
            validation = cached;
          } else {
            validation = await this.performApiKeyValidation(context);
            this.cacheValidation(context, validation);
          }
        } else {
          validation = await this.performApiKeyValidation(context);
        }

        results.push({
          ...context,
          validation
        });
      } catch (error) {
        logger.error(`API key validation failed for ${context.exchange}:`, error);
        
        // Add failed validation result
        results.push({
          ...context,
          validation: {
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
            exchange: context.exchange
          }
        });
      }
    }

    return results;
  }

  /**
   * Validate API keys specifically for trading endpoints
   */
  private async validateTradingApiKeys(contexts: ApiKeyContext[]): Promise<Array<ApiKeyContext & { validation: ApiKeyValidation }>> {
    const results = await this.validateAllApiKeys(contexts);

    // Additional validation for trading endpoints
    for (const result of results) {
      if (!result.validation.isReadOnly) {
        logger.error(`Trading permissions detected in ${result.exchange} API key`, {
          exchange: result.exchange,
          violations: result.validation.violations,
          riskLevel: result.validation.riskLevel
        });
      }

      // Check for specific trading permission violations
      const tradingViolations = result.validation.violations.filter(v => 
        v.type === 'trading_permission' || 
        v.type === 'withdrawal_permission' ||
        v.type === 'futures_permission' ||
        v.type === 'margin_permission'
      );

      if (tradingViolations.length > 0) {
        throw new ApiPermissionGuardError(
          `Trading permissions detected in ${result.exchange} API key: ${tradingViolations.map(v => v.message).join(', ')}`,
          'TRADING_PERMISSIONS_DETECTED',
          'critical',
          result.exchange
        );
      }
    }

    return results;
  }

  /**
   * Perform API key validation using the ApiPermissionValidator
   */
  private async performApiKeyValidation(context: ApiKeyContext): Promise<ApiKeyValidation> {
    const apiInfo: ExchangeApiInfo = {
      exchange: context.exchange,
      apiKey: context.apiKey,
      apiSecret: context.apiSecret,
      passphrase: context.passphrase,
      sandbox: context.sandbox,
      testConnection: true
    };

    return await apiPermissionValidator.validateApiKey(apiInfo);
  }

  /**
   * Check if risk level is too high
   */
  private isRiskLevelTooHigh(riskLevel: 'low' | 'medium' | 'high' | 'critical'): boolean {
    const riskLevels = ['low', 'medium', 'high', 'critical'];
    const maxIndex = riskLevels.indexOf(this.config.maxRiskLevel);
    const currentIndex = riskLevels.indexOf(riskLevel);
    
    return currentIndex > maxIndex;
  }

  /**
   * Handle validation failures
   */
  private handleValidationFailures(
    failures: Array<ApiKeyContext & { validation: ApiKeyValidation }>, 
    res: Response
  ): void {
    const criticalFailures = failures.filter(f => f.validation.riskLevel === 'critical');
    
    if (criticalFailures.length > 0) {
      const error = new ApiPermissionGuardError(
        `Critical API key validation failures: ${criticalFailures.map(f => f.exchange).join(', ')}`,
        'CRITICAL_API_VALIDATION_FAILURE',
        'critical',
        criticalFailures[0].exchange
      );
      
      this.handleApiPermissionError(error, res);
      return;
    }

    // Handle non-critical failures
    const error = new ApiPermissionGuardError(
      `API key validation failures: ${failures.map(f => f.exchange).join(', ')}`,
      'API_VALIDATION_FAILURE',
      'high',
      failures[0].exchange
    );
    
    this.handleApiPermissionError(error, res);
  }

  /**
   * Handle API permission errors
   */
  private handleApiPermissionError(error: Error, res: Response): void {
    if (error instanceof ApiPermissionGuardError) {
      logger.error('API Permission Guard Error:', {
        code: error.code,
        message: error.message,
        riskLevel: error.riskLevel,
        exchange: error.exchange
      });

      const statusCode = error.riskLevel === 'critical' ? 403 : 400;

      res.status(statusCode).json({
        error: error.code,
        message: error.message,
        riskLevel: error.riskLevel,
        exchange: error.exchange,
        paperTradingMode: true,
        timestamp: Date.now()
      });
    } else if (error instanceof ApiPermissionValidationError) {
      logger.error('API Permission Validation Error:', {
        message: error.message,
        violations: error.violations,
        riskLevel: error.riskLevel
      });

      res.status(403).json({
        error: 'API_PERMISSION_VALIDATION_ERROR',
        message: error.message,
        violations: error.violations,
        riskLevel: error.riskLevel,
        paperTradingMode: true,
        timestamp: Date.now()
      });
    } else {
      logger.error('Unexpected API permission error:', error);
      
      res.status(500).json({
        error: 'API_PERMISSION_GUARD_ERROR',
        message: 'An unexpected error occurred during API permission validation',
        paperTradingMode: true,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get cached validation
   */
  private getCachedValidation(context: ApiKeyContext): ApiKeyValidation | null {
    const cacheKey = `${context.exchange}_${context.apiKey}`;
    const cached = this.validationCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.validation;
    }

    // Remove expired cache entry
    this.validationCache.delete(cacheKey);
    return null;
  }

  /**
   * Cache validation result
   */
  private cacheValidation(context: ApiKeyContext, validation: ApiKeyValidation): void {
    const cacheKey = `${context.exchange}_${context.apiKey}`;
    this.validationCache.set(cacheKey, {
      validation,
      timestamp: Date.now()
    });

    // Clean up old cache entries
    this.cleanupCache();
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.validationCache.entries()) {
      if (now - cached.timestamp >= this.CACHE_DURATION) {
        this.validationCache.delete(key);
      }
    }
  }

  /**
   * Get configuration
   */
  public getConfig(): ApiPermissionGuardConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<ApiPermissionGuardConfig>): void {
    this.config = { ...this.config, ...updates };
    
    logger.info('API Permission Guard configuration updated', {
      config: this.config
    });
  }

  /**
   * Clear validation cache
   */
  public clearCache(): void {
    this.validationCache.clear();
    logger.info('API Permission Guard cache cleared');
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

  /**
   * Validate specific exchange API key
   */
  public async validateExchangeApiKey(
    exchange: string, 
    apiKey: string, 
    apiSecret?: string, 
    passphrase?: string,
    sandbox: boolean = false
  ): Promise<ApiKeyValidation> {
    const context: ApiKeyContext = {
      exchange: exchange.toLowerCase(),
      apiKey,
      apiSecret,
      passphrase,
      sandbox
    };

    return await this.performApiKeyValidation(context);
  }

  /**
   * Block trading permissions enforcement
   */
  public enforceReadOnlyApiKeys(): void {
    this.config.blockTradingPermissions = true;
    this.config.maxRiskLevel = 'low';
    this.config.strictMode = true;

    logger.warn('Read-only API key enforcement activated', {
      blockTradingPermissions: this.config.blockTradingPermissions,
      maxRiskLevel: this.config.maxRiskLevel,
      strictMode: this.config.strictMode
    });
  }
}

// Export singleton instance and middleware functions
export const apiPermissionGuard = ApiPermissionGuard.getInstance();

export const validateApiPermissions = apiPermissionGuard.validateApiPermissions();
export const validateTradingApiPermissions = apiPermissionGuard.validateTradingApiPermissions();

// Export validation function for direct use
export const validateExchangeApiKey = async (
  exchange: string, 
  apiKey: string, 
  apiSecret?: string, 
  passphrase?: string,
  sandbox: boolean = false
): Promise<ApiKeyValidation> => {
  return apiPermissionGuard.validateExchangeApiKey(exchange, apiKey, apiSecret, passphrase, sandbox);
};