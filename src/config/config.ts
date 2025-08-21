import dotenv from 'dotenv';

dotenv.config();

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
    },
    kucoin: {
      apiKey: process.env.KUCOIN_API_KEY || '',
      apiSecret: process.env.KUCOIN_API_SECRET || '',
      passphrase: process.env.KUCOIN_PASSPHRASE || '',
      sandbox: process.env.KUCOIN_SANDBOX === 'true',
    },
  },

  monitoring: {
    prometheusPort: parseInt(process.env.PROMETHEUS_PORT || '9090', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
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
} as const;