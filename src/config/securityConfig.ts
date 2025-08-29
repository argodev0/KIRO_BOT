import { config } from './config';
import { Request } from 'express';

export interface SecurityConfig {
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
    algorithm: string;
    issuer: string;
    audience: string;
  };
  
  session: {
    maxAge: number;
    maxSessions: number;
    secure: boolean;
    httpOnly: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    rolling: boolean;
    name: string;
    secret: string;
  };
  
  cors: {
    origin: string | string[] | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void);
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    maxAge: number;
    preflightContinue: boolean;
    optionsSuccessStatus: number;
  };
  
  rateLimit: {
    windowMs: number;
    max: number;
    message: string;
    standardHeaders: boolean;
    legacyHeaders: boolean;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
    keyGenerator: (req: Request) => string;
  };
  
  helmet: {
    contentSecurityPolicy: {
      directives: Record<string, string[]>;
    };
    hsts: {
      maxAge: number;
      includeSubDomains: boolean;
      preload: boolean;
    };
    frameguard: {
      action: string;
    };
    noSniff: boolean;
    xssFilter: boolean;
    referrerPolicy: {
      policy: string;
    };
    hidePoweredBy: boolean;
    dnsPrefetchControl: {
      allow: boolean;
    };
    expectCt: {
      maxAge: number;
      enforce: boolean;
    };
  };
  
  encryption: {
    algorithm: string;
    keyLength: number;
    ivLength: number;
    saltLength: number;
    iterations: number;
  };
  
  validation: {
    maxRequestSize: string;
    maxFieldSize: number;
    maxFields: number;
    maxFiles: number;
    maxFileSize: number;
  };
  
  monitoring: {
    enableSecurityLogs: boolean;
    enableAuditLogs: boolean;
    enableMetrics: boolean;
    logLevel: string;
    alertThresholds: {
      failedLogins: number;
      suspiciousActivity: number;
      rateLimitViolations: number;
    };
  };
  
  apiSecurity: {
    requireApiKey: boolean;
    apiKeyHeader: string;
    apiKeyLength: number;
    apiKeyExpiration: number;
    maxApiKeysPerUser: number;
  };
  
  deviceTrust: {
    enableDeviceFingerprinting: boolean;
    trustNewDevices: boolean;
    deviceTrustDuration: number;
    maxTrustedDevices: number;
  };
  
  mfa: {
    enabled: boolean;
    required: boolean;
    methods: string[];
    backupCodesCount: number;
    totpWindow: number;
  };
}

export const securityConfig: SecurityConfig = {
  jwt: {
    secret: config.jwt.secret,
    expiresIn: config.jwt.expiresIn,
    refreshExpiresIn: config.jwt.refreshExpiresIn,
    algorithm: 'HS256',
    issuer: 'kiro-trading-bot',
    audience: 'kiro-trading-bot-users'
  },
  
  session: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    maxSessions: 5,
    secure: config.env === 'production',
    httpOnly: true,
    sameSite: 'strict',
    rolling: true,
    name: 'sessionId',
    secret: process.env.SESSION_SECRET || config.jwt.secret
  },
  
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = [
        config.websocket.cors.origin,
        'https://localhost:3000',
        'https://127.0.0.1:3000'
      ];
      
      if (config.env === 'development') {
        allowedOrigins.push(
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'http://localhost:5173', // Vite dev server
          'http://127.0.0.1:5173'
        );
      }
      
      // Allow requests with no origin (mobile apps, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
      'X-Request-ID',
      'X-Session-ID',
      'X-CSRF-Token'
    ],
    exposedHeaders: [
      'X-Request-ID',
      'X-Rate-Limit-Remaining',
      'X-Rate-Limit-Reset',
      'X-Response-Time'
    ],
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204
  },
  
  rateLimit: {
    windowMs: config.security.rateLimitWindowMs,
    max: config.security.rateLimitMax,
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    keyGenerator: (req: Request) => {
      // Use IP + User ID if authenticated, otherwise just IP
      const ip = req.ip || req.connection?.remoteAddress || 'unknown';
      const userId = (req as any).user?.userId;
      return userId ? `${ip}:${userId}` : ip;
    }
  },
  
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'", "'unsafe-eval'"], // Required for TradingView charts
        connectSrc: ["'self'", "wss:", "https:", "ws:"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: config.env === 'production' ? [] : undefined
      }
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    frameguard: {
      action: 'deny'
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    },
    hidePoweredBy: true,
    dnsPrefetchControl: {
      allow: false
    },
    expectCt: {
      maxAge: 86400, // 24 hours
      enforce: config.env === 'production'
    }
  },
  
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    saltLength: 32,
    iterations: 100000
  },
  
  validation: {
    maxRequestSize: '10mb',
    maxFieldSize: 1024 * 1024, // 1MB
    maxFields: 100,
    maxFiles: 10,
    maxFileSize: 5 * 1024 * 1024 // 5MB
  },
  
  monitoring: {
    enableSecurityLogs: true,
    enableAuditLogs: true,
    enableMetrics: config.monitoring.metricsEnabled,
    logLevel: config.monitoring.logLevel,
    alertThresholds: {
      failedLogins: 5,
      suspiciousActivity: 10,
      rateLimitViolations: 20
    }
  },
  
  apiSecurity: {
    requireApiKey: false, // Optional for most endpoints
    apiKeyHeader: 'X-API-Key',
    apiKeyLength: 64,
    apiKeyExpiration: 365 * 24 * 60 * 60 * 1000, // 1 year
    maxApiKeysPerUser: 10
  },
  
  deviceTrust: {
    enableDeviceFingerprinting: true,
    trustNewDevices: false,
    deviceTrustDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
    maxTrustedDevices: 10
  },
  
  mfa: {
    enabled: true,
    required: false, // Optional by default
    methods: ['totp', 'sms', 'email'],
    backupCodesCount: 10,
    totpWindow: 1 // Allow 1 step tolerance
  }
};

// Environment-specific overrides
if (config.env === 'production') {
  // Production security hardening
  securityConfig.session.secure = true;
  securityConfig.session.sameSite = 'strict';
  securityConfig.helmet.hsts.maxAge = 63072000; // 2 years
  securityConfig.helmet.expectCt.enforce = true;
  securityConfig.deviceTrust.trustNewDevices = false;
  securityConfig.mfa.required = true; // Require MFA in production
  
  // Stricter rate limiting in production
  securityConfig.rateLimit.max = 50;
  securityConfig.rateLimit.windowMs = 15 * 60 * 1000; // 15 minutes
  
  // Enhanced monitoring in production
  securityConfig.monitoring.alertThresholds.failedLogins = 3;
  securityConfig.monitoring.alertThresholds.suspiciousActivity = 5;
}

if (config.env === 'development') {
  // Development convenience settings
  securityConfig.session.secure = false;
  securityConfig.helmet.contentSecurityPolicy.directives.connectSrc?.push('http:', 'ws:');
  securityConfig.deviceTrust.trustNewDevices = true;
  securityConfig.mfa.required = false;
  
  // More lenient rate limiting in development
  securityConfig.rateLimit.max = 1000;
  securityConfig.rateLimit.windowMs = 60 * 1000; // 1 minute
}

// Paper trading security overrides
if (config.paperTrading.enabled) {
  // Additional security for paper trading mode
  securityConfig.monitoring.enableAuditLogs = true;
  securityConfig.monitoring.enableSecurityLogs = true;
  
  // Log all trading operations in paper mode
  securityConfig.monitoring.logLevel = 'debug';
}

export default securityConfig;