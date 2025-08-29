import dotenv from 'dotenv';
import { validateProductionConfig } from './production';

// Load environment-specific configuration
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: envFile });

// Validate production configuration if in production mode
if (process.env.NODE_ENV === 'production') {
  try {
    validateProductionConfig();
  } catch (error) {
    console.error('❌ Production configuration validation failed:', error);
    process.exit(1);
  }
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || 'localhost',
  },

  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/trading_bot',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  exchanges: {
    binance: {
      apiKey: process.env.BINANCE_API_KEY || '',
      apiSecret: process.env.BINANCE_API_SECRET || '',
      sandbox: process.env.BINANCE_SANDBOX === 'true',
      mainnet: process.env.BINANCE_MAINNET === 'true',
      readOnly: process.env.BINANCE_READ_ONLY === 'true',
    },
    kucoin: {
      apiKey: process.env.KUCOIN_API_KEY || '',
      apiSecret: process.env.KUCOIN_API_SECRET || '',
      passphrase: process.env.KUCOIN_PASSPHRASE || '',
      sandbox: process.env.KUCOIN_SANDBOX === 'true',
      mainnet: process.env.KUCOIN_MAINNET === 'true',
      readOnly: process.env.KUCOIN_READ_ONLY === 'true',
    },
  },

  monitoring: {
    prometheusPort: parseInt(process.env.PROMETHEUS_PORT || '9090', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
    metricsEnabled: process.env.METRICS_ENABLED !== 'false',
    healthChecksEnabled: process.env.HEALTH_CHECKS_ENABLED !== 'false',
    performanceMonitoring: process.env.PERFORMANCE_MONITORING !== 'false',
    systemMetricsInterval: parseInt(process.env.SYSTEM_METRICS_INTERVAL || '30000', 10), // 30 seconds
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10), // 30 seconds
    alertThresholds: {
      memoryUsage: parseInt(process.env.MEMORY_ALERT_THRESHOLD || '85', 10), // 85%
      cpuUsage: parseInt(process.env.CPU_ALERT_THRESHOLD || '80', 10), // 80%
      diskUsage: parseInt(process.env.DISK_ALERT_THRESHOLD || '90', 10), // 90%
      eventLoopLag: parseInt(process.env.EVENT_LOOP_LAG_THRESHOLD || '100', 10), // 100ms
    },
    retention: {
      metricsHistory: parseInt(process.env.METRICS_HISTORY_RETENTION || '100', 10), // Keep last 100 measurements
      alertCooldown: parseInt(process.env.ALERT_COOLDOWN_MS || '300000', 10), // 5 minutes
    }
  },

  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  websocket: {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
    rateLimit: {
      windowMs: parseInt(process.env.WS_RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
      maxRequests: parseInt(process.env.WS_RATE_LIMIT_MAX || '100', 10),
    },
    pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '60000', 10),
    pingInterval: parseInt(process.env.WS_PING_INTERVAL || '25000', 10),
    heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000', 10),
    cleanupInterval: parseInt(process.env.WS_CLEANUP_INTERVAL || '300000', 10), // 5 minutes
  },

  // Paper Trading Configuration - CRITICAL SAFETY SETTINGS
  paperTrading: {
    enabled: process.env.PAPER_TRADING_MODE !== 'false', // Default enabled
    allowRealTrades: process.env.ALLOW_REAL_TRADES === 'true', // Explicit opt-in required
    forceMode: process.env.FORCE_PAPER_TRADING === 'true', // Force in production
    validation: process.env.PAPER_TRADING_VALIDATION || 'strict',
    initialVirtualBalance: {
      usd: parseFloat(process.env.VIRTUAL_BALANCE_USD || '100000'),
      btc: parseFloat(process.env.VIRTUAL_BALANCE_BTC || '10'),
      eth: parseFloat(process.env.VIRTUAL_BALANCE_ETH || '100'),
    },
    maxVirtualLeverage: parseFloat(process.env.MAX_VIRTUAL_LEVERAGE || '3'),
    virtualTradingFee: parseFloat(process.env.TRADING_FEE_SIMULATION || '0.001'), // 0.1%
    slippageSimulation: parseFloat(process.env.SLIPPAGE_SIMULATION || '0.0005'), // 0.05%
    enableRealisticFees: process.env.REALISTIC_FEES !== 'false',
    auditLog: process.env.PAPER_TRADE_AUDIT_LOG === 'true',
    apiKeyValidation: {
      enabled: true,
      requireReadOnly: true,
      blockTradingKeys: true,
      cacheValidationMs: parseInt(process.env.API_VALIDATION_CACHE_MS || '300000'), // 5 minutes
    },
    security: {
      auditAllOperations: true,
      blockRealMoneyOps: true,
      logSecurityEvents: true,
      alertOnViolations: true,
    }
  },

  // Production-specific configuration
  production: {
    ssl: {
      enabled: process.env.SSL_ENABLED === 'true',
      certPath: process.env.SSL_CERT_PATH || '/etc/nginx/ssl/cert.pem',
      keyPath: process.env.SSL_KEY_PATH || '/etc/nginx/ssl/private.key',
      caPath: process.env.SSL_CA_PATH || '/etc/nginx/ssl/ca.pem',
    },
    domain: {
      name: process.env.DOMAIN_NAME || 'localhost',
      letsEncryptEmail: process.env.LETSENCRYPT_EMAIL || '',
    },
    security: {
      helmet: process.env.HELMET_ENABLED === 'true',
      csrf: process.env.CSRF_PROTECTION === 'true',
      cors: process.env.CORS_ORIGIN || 'https://localhost',
    },
    monitoring: {
      metrics: process.env.METRICS_ENABLED === 'true',
      healthChecks: process.env.HEALTH_CHECK_ENABLED === 'true',
      logFormat: process.env.LOG_FORMAT || 'json',
    },
    performance: {
      maxConnections: parseInt(process.env.MAX_CONCURRENT_CONNECTIONS || '1000', 10),
      websocketMaxConnections: parseInt(process.env.WEBSOCKET_MAX_CONNECTIONS || '500', 10),
      apiTimeout: parseInt(process.env.API_TIMEOUT || '30000', 10),
      cacheTtl: parseInt(process.env.CACHE_TTL || '300', 10),
    },
    backup: {
      enabled: process.env.BACKUP_ENABLED === 'true',
      schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *',
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
      s3Backup: process.env.AWS_S3_BACKUP === 'true',
    },
    alerts: {
      webhookUrl: process.env.ALERT_WEBHOOK_URL || '',
      email: process.env.ALERT_EMAIL || '',
      criticalEnabled: process.env.CRITICAL_ALERT_ENABLED === 'true',
    },
  },

  // Environment validation for paper trading safety
  environment: {
    isPaperTradingMode: process.env.PAPER_TRADING_MODE === 'true',
    allowRealTrades: process.env.ALLOW_REAL_TRADES === 'true', // Explicit opt-in required
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    forcePaperTrading: process.env.FORCE_PAPER_TRADING === 'true',
  },
} as const;

// Export production validation function for use in application startup
export { performProductionStartupValidation } from './production';