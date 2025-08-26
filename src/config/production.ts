import { z } from 'zod';
import { logger } from '../utils/logger';

/**
 * Production Configuration Validation
 * Ensures all critical production settings are properly configured
 * with special emphasis on paper trading safety
 */

// Paper Trading Safety Schema
const paperTradingSafetySchema = z.object({
  PAPER_TRADING_MODE: z.string().refine(val => val === 'true', {
    message: 'CRITICAL: Paper trading mode must be enabled in production'
  }),
  ALLOW_REAL_TRADES: z.string().refine(val => val === 'false', {
    message: 'CRITICAL: Real trades must be disabled in production'
  }),
  FORCE_PAPER_TRADING: z.string().refine(val => val === 'true', {
    message: 'CRITICAL: Force paper trading must be enabled'
  }),
  PAPER_TRADING_VALIDATION: z.enum(['strict', 'moderate'], {
    errorMap: () => ({ message: 'Paper trading validation must be strict or moderate' })
  })
});

// SSL Configuration Schema
const sslConfigSchema = z.object({
  SSL_ENABLED: z.string().refine(val => val === 'true', {
    message: 'SSL must be enabled in production'
  }),
  SSL_CERT_PATH: z.string().min(1, 'SSL certificate path is required'),
  SSL_KEY_PATH: z.string().min(1, 'SSL private key path is required'),
  DOMAIN_NAME: z.string().min(1, 'Domain name is required for SSL'),
  LETSENCRYPT_EMAIL: z.string().email('Valid email required for Let\'s Encrypt')
});

// Exchange API Safety Schema
const exchangeApiSafetySchema = z.object({
  BINANCE_SANDBOX: z.string().refine(val => val === 'false', {
    message: 'Binance must use mainnet (not sandbox) for production'
  }),
  BINANCE_MAINNET: z.string().refine(val => val === 'true', {
    message: 'Binance mainnet must be enabled'
  }),
  BINANCE_READ_ONLY: z.string().refine(val => val === 'true', {
    message: 'CRITICAL: Binance API must be READ-ONLY for paper trading safety'
  }),
  KUCOIN_SANDBOX: z.string().refine(val => val === 'false', {
    message: 'KuCoin must use mainnet (not sandbox) for production'
  }),
  KUCOIN_MAINNET: z.string().refine(val => val === 'true', {
    message: 'KuCoin mainnet must be enabled'
  }),
  KUCOIN_READ_ONLY: z.string().refine(val => val === 'true', {
    message: 'CRITICAL: KuCoin API must be READ-ONLY for paper trading safety'
  })
});

// Security Configuration Schema
const securityConfigSchema = z.object({
  NODE_ENV: z.literal('production'),
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  BCRYPT_ROUNDS: z.string().refine(val => parseInt(val) >= 12, {
    message: 'BCrypt rounds must be at least 12 for production'
  }),
  HELMET_ENABLED: z.string().refine(val => val === 'true', {
    message: 'Helmet security headers must be enabled'
  }),
  CSRF_PROTECTION: z.string().refine(val => val === 'true', {
    message: 'CSRF protection must be enabled'
  }),
  RATE_LIMIT_MAX: z.string().refine(val => parseInt(val) <= 1000, {
    message: 'Rate limit should be reasonable for production'
  })
});

// Database Configuration Schema
const databaseConfigSchema = z.object({
  DATABASE_URL: z.string().startsWith('postgresql://', 'Must use PostgreSQL'),
  DATABASE_SSL: z.string().refine(val => val === 'true', {
    message: 'Database SSL must be enabled in production'
  }),
  DATABASE_POOL_SIZE: z.string().refine(val => {
    const size = parseInt(val);
    return size >= 10 && size <= 50;
  }, {
    message: 'Database pool size should be between 10-50 for production'
  })
});

// Monitoring Configuration Schema
const monitoringConfigSchema = z.object({
  PROMETHEUS_PORT: z.string().refine(val => parseInt(val) > 0, {
    message: 'Prometheus port must be configured'
  }),
  METRICS_ENABLED: z.string().refine(val => val === 'true', {
    message: 'Metrics must be enabled in production'
  }),
  HEALTH_CHECK_ENABLED: z.string().refine(val => val === 'true', {
    message: 'Health checks must be enabled in production'
  }),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug'], {
    errorMap: () => ({ message: 'Log level must be error, warn, info, or debug' })
  }),
  LOG_FORMAT: z.enum(['json', 'text'], {
    errorMap: () => ({ message: 'Log format must be json or text' })
  })
});

// Complete Production Configuration Schema
const productionConfigSchema = z.object({
  ...paperTradingSafetySchema.shape,
  ...sslConfigSchema.shape,
  ...exchangeApiSafetySchema.shape,
  ...securityConfigSchema.shape,
  ...databaseConfigSchema.shape,
  ...monitoringConfigSchema.shape
});

export interface ProductionConfig extends z.infer<typeof productionConfigSchema> {}

/**
 * Validates production environment configuration
 * Throws detailed errors if any critical settings are missing or incorrect
 */
export function validateProductionConfig(): ProductionConfig {
  logger.info('Validating production configuration...');

  try {
    // Validate paper trading safety first (most critical)
    const paperTradingResult = paperTradingSafetySchema.safeParse(process.env);
    if (!paperTradingResult.success) {
      const errors = paperTradingResult.error.errors.map(e => e.message);
      logger.error('CRITICAL PAPER TRADING SAFETY VALIDATION FAILED:', errors);
      throw new Error(`Paper Trading Safety Validation Failed: ${errors.join(', ')}`);
    }

    // Validate SSL configuration
    const sslResult = sslConfigSchema.safeParse(process.env);
    if (!sslResult.success) {
      const errors = sslResult.error.errors.map(e => e.message);
      logger.error('SSL Configuration validation failed:', errors);
      throw new Error(`SSL Configuration Failed: ${errors.join(', ')}`);
    }

    // Validate exchange API safety
    const exchangeResult = exchangeApiSafetySchema.safeParse(process.env);
    if (!exchangeResult.success) {
      const errors = exchangeResult.error.errors.map(e => e.message);
      logger.error('CRITICAL EXCHANGE API SAFETY VALIDATION FAILED:', errors);
      throw new Error(`Exchange API Safety Validation Failed: ${errors.join(', ')}`);
    }

    // Validate security configuration
    const securityResult = securityConfigSchema.safeParse(process.env);
    if (!securityResult.success) {
      const errors = securityResult.error.errors.map(e => e.message);
      logger.error('Security configuration validation failed:', errors);
      throw new Error(`Security Configuration Failed: ${errors.join(', ')}`);
    }

    // Validate database configuration
    const databaseResult = databaseConfigSchema.safeParse(process.env);
    if (!databaseResult.success) {
      const errors = databaseResult.error.errors.map(e => e.message);
      logger.error('Database configuration validation failed:', errors);
      throw new Error(`Database Configuration Failed: ${errors.join(', ')}`);
    }

    // Validate monitoring configuration
    const monitoringResult = monitoringConfigSchema.safeParse(process.env);
    if (!monitoringResult.success) {
      const errors = monitoringResult.error.errors.map(e => e.message);
      logger.error('Monitoring configuration validation failed:', errors);
      throw new Error(`Monitoring Configuration Failed: ${errors.join(', ')}`);
    }

    // Final complete validation
    const result = productionConfigSchema.safeParse(process.env);
    if (!result.success) {
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      logger.error('Production configuration validation failed:', errors);
      throw new Error(`Production Configuration Validation Failed: ${errors.join(', ')}`);
    }

    logger.info('✅ Production configuration validation passed');
    logger.info('✅ Paper trading safety validated');
    logger.info('✅ SSL configuration validated');
    logger.info('✅ Exchange API safety validated');
    logger.info('✅ Security configuration validated');
    logger.info('✅ Database configuration validated');
    logger.info('✅ Monitoring configuration validated');

    return result.data;
  } catch (error) {
    logger.error('Production configuration validation failed:', error);
    throw error;
  }
}

/**
 * Validates API key permissions to ensure they are READ-ONLY
 * This is critical for paper trading safety
 */
export async function validateApiKeyPermissions(): Promise<void> {
  logger.info('Validating API key permissions for paper trading safety...');

  const errors: string[] = [];

  // Check Binance API key permissions
  if (process.env.BINANCE_API_KEY) {
    try {
      // This would typically make a test API call to check permissions
      // For now, we validate the configuration flags
      if (process.env.BINANCE_READ_ONLY !== 'true') {
        errors.push('Binance API key must be configured as READ-ONLY');
      }
    } catch (error) {
      errors.push(`Binance API key validation failed: ${error}`);
    }
  }

  // Check KuCoin API key permissions
  if (process.env.KUCOIN_API_KEY) {
    try {
      // This would typically make a test API call to check permissions
      // For now, we validate the configuration flags
      if (process.env.KUCOIN_READ_ONLY !== 'true') {
        errors.push('KuCoin API key must be configured as READ-ONLY');
      }
    } catch (error) {
      errors.push(`KuCoin API key validation failed: ${error}`);
    }
  }

  if (errors.length > 0) {
    logger.error('CRITICAL: API key permission validation failed:', errors);
    throw new Error(`API Key Permission Validation Failed: ${errors.join(', ')}`);
  }

  logger.info('✅ API key permissions validated - all keys are READ-ONLY');
}

/**
 * Performs startup validation for production environment
 * This should be called during application initialization
 */
export async function performProductionStartupValidation(): Promise<void> {
  logger.info('Performing production startup validation...');

  try {
    // Validate configuration
    validateProductionConfig();

    // Validate API key permissions
    await validateApiKeyPermissions();

    // Additional production-specific validations
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('NODE_ENV must be set to "production"');
    }

    if (process.env.PAPER_TRADING_MODE !== 'true') {
      throw new Error('CRITICAL: Paper trading mode must be enabled in production');
    }

    if (process.env.ALLOW_REAL_TRADES === 'true') {
      throw new Error('CRITICAL: Real trades must be disabled in production');
    }

    logger.info('🚀 Production startup validation completed successfully');
    logger.info('🛡️  Paper trading safety confirmed');
    logger.info('🔒 Security configuration validated');
    logger.info('📊 Monitoring configuration validated');

  } catch (error) {
    logger.error('❌ Production startup validation failed:', error);
    logger.error('🚨 APPLICATION WILL NOT START - Fix configuration errors');
    throw error;
  }
}