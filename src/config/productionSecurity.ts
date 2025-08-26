/**
 * Production Security Configuration
 * Comprehensive security settings for production deployment
 */

import { config } from './config';

export interface ProductionSecurityConfig {
  // Environment validation
  environment: {
    enforceHTTPS: boolean;
    requirePaperTradingMode: boolean;
    blockRealTradingEndpoints: boolean;
    validateEnvironmentVariables: boolean;
  };

  // Rate limiting configuration
  rateLimiting: {
    enabled: boolean;
    redis: {
      url: string;
      keyPrefix: string;
    };
    limits: {
      api: {
        points: number;
        duration: number;
        blockDuration: number;
      };
      auth: {
        points: number;
        duration: number;
        blockDuration: number;
      };
      trading: {
        points: number;
        duration: number;
        blockDuration: number;
      };
      admin: {
        points: number;
        duration: number;
        blockDuration: number;
      };
    };
    adaptiveThresholds: boolean;
  };

  // Input validation and sanitization
  inputValidation: {
    enabled: boolean;
    maxRequestSize: number;
    maxFieldLength: number;
    maxArrayLength: number;
    maxObjectDepth: number;
    sanitizeInput: boolean;
    validateFileUploads: boolean;
    allowedFileTypes: string[];
    maxFileSize: number;
  };

  // Intrusion detection
  intrusionDetection: {
    enabled: boolean;
    autoBlockThreshold: number;
    blockDuration: number;
    monitorSuspiciousPatterns: boolean;
    detectBotTraffic: boolean;
    analyzeUserAgents: boolean;
    trackFailedAttempts: boolean;
  };

  // API security
  apiSecurity: {
    enforceApiKeyValidation: boolean;
    blockTradingApiKeys: boolean;
    validateApiKeyPermissions: boolean;
    requireReadOnlyPermissions: boolean;
    logApiKeyUsage: boolean;
  };

  // CORS configuration
  cors: {
    enabled: boolean;
    strictOriginValidation: boolean;
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    credentials: boolean;
    maxAge: number;
  };

  // Security headers
  securityHeaders: {
    enabled: boolean;
    hsts: {
      enabled: boolean;
      maxAge: number;
      includeSubDomains: boolean;
      preload: boolean;
    };
    csp: {
      enabled: boolean;
      reportOnly: boolean;
      directives: Record<string, string[]>;
    };
    frameOptions: string;
    contentTypeOptions: boolean;
    xssProtection: boolean;
    referrerPolicy: string;
    permissionsPolicy: string;
  };

  // Audit logging
  auditLogging: {
    enabled: boolean;
    logAllRequests: boolean;
    logFailedRequests: boolean;
    logSecurityEvents: boolean;
    logApiKeyUsage: boolean;
    retentionDays: number;
    sensitiveDataMasking: boolean;
    realTimeAlerts: boolean;
  };

  // Monitoring and alerting
  monitoring: {
    enabled: boolean;
    metricsCollection: boolean;
    securityDashboard: boolean;
    alerting: {
      enabled: boolean;
      channels: string[];
      thresholds: {
        rateLimitViolations: number;
        intrusionAttempts: number;
        suspiciousActivities: number;
        failedAuthentications: number;
      };
    };
  };

  // IP management
  ipManagement: {
    enabled: boolean;
    autoBlocking: boolean;
    whitelist: string[];
    blacklist: string[];
    geoBlocking: {
      enabled: boolean;
      allowedCountries: string[];
      blockedCountries: string[];
    };
  };

  // Session security
  sessionSecurity: {
    enabled: boolean;
    secure: boolean;
    httpOnly: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    maxAge: number;
    regenerateOnAuth: boolean;
    invalidateOnSuspicious: boolean;
  };

  // Encryption settings
  encryption: {
    algorithm: string;
    keyLength: number;
    ivLength: number;
    tagLength: number;
    keyRotationDays: number;
    encryptSensitiveData: boolean;
  };
}

export const productionSecurityConfig: ProductionSecurityConfig = {
  environment: {
    enforceHTTPS: config.env === 'production',
    requirePaperTradingMode: true,
    blockRealTradingEndpoints: true,
    validateEnvironmentVariables: true
  },

  rateLimiting: {
    enabled: true,
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      keyPrefix: 'security_rl'
    },
    limits: {
      api: {
        points: parseInt(process.env.RATE_LIMIT_API_POINTS || '1000'),
        duration: parseInt(process.env.RATE_LIMIT_API_DURATION || '900'),
        blockDuration: parseInt(process.env.RATE_LIMIT_API_BLOCK || '900')
      },
      auth: {
        points: parseInt(process.env.RATE_LIMIT_AUTH_POINTS || '10'),
        duration: parseInt(process.env.RATE_LIMIT_AUTH_DURATION || '900'),
        blockDuration: parseInt(process.env.RATE_LIMIT_AUTH_BLOCK || '3600')
      },
      trading: {
        points: parseInt(process.env.RATE_LIMIT_TRADING_POINTS || '100'),
        duration: parseInt(process.env.RATE_LIMIT_TRADING_DURATION || '60'),
        blockDuration: parseInt(process.env.RATE_LIMIT_TRADING_BLOCK || '300')
      },
      admin: {
        points: parseInt(process.env.RATE_LIMIT_ADMIN_POINTS || '50'),
        duration: parseInt(process.env.RATE_LIMIT_ADMIN_DURATION || '3600'),
        blockDuration: parseInt(process.env.RATE_LIMIT_ADMIN_BLOCK || '3600')
      }
    },
    adaptiveThresholds: process.env.ADAPTIVE_RATE_LIMITING === 'true'
  },

  inputValidation: {
    enabled: true,
    maxRequestSize: parseInt(process.env.MAX_REQUEST_SIZE || '10485760'), // 10MB
    maxFieldLength: parseInt(process.env.MAX_FIELD_LENGTH || '10000'),
    maxArrayLength: parseInt(process.env.MAX_ARRAY_LENGTH || '1000'),
    maxObjectDepth: parseInt(process.env.MAX_OBJECT_DEPTH || '10'),
    sanitizeInput: true,
    validateFileUploads: true,
    allowedFileTypes: ['.jpg', '.jpeg', '.png', '.pdf', '.csv'],
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880') // 5MB
  },

  intrusionDetection: {
    enabled: true,
    autoBlockThreshold: parseInt(process.env.INTRUSION_AUTO_BLOCK_THRESHOLD || '5'),
    blockDuration: parseInt(process.env.INTRUSION_BLOCK_DURATION || '86400'), // 24 hours
    monitorSuspiciousPatterns: true,
    detectBotTraffic: true,
    analyzeUserAgents: true,
    trackFailedAttempts: true
  },

  apiSecurity: {
    enforceApiKeyValidation: true,
    blockTradingApiKeys: true,
    validateApiKeyPermissions: true,
    requireReadOnlyPermissions: true,
    logApiKeyUsage: true
  },

  cors: {
    enabled: true,
    strictOriginValidation: config.env === 'production',
    allowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || '').split(',').filter(Boolean),
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
      'X-Request-ID',
      'X-Requested-With',
      'Accept',
      'Origin'
    ],
    exposedHeaders: ['X-Request-ID', 'X-Rate-Limit-Remaining', 'X-Rate-Limit-Reset'],
    credentials: true,
    maxAge: 86400 // 24 hours
  },

  securityHeaders: {
    enabled: true,
    hsts: {
      enabled: config.env === 'production',
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    csp: {
      enabled: true,
      reportOnly: config.env === 'development',
      directives: {
        'default-src': ["'self'"],
        'script-src': [
          "'self'",
          "'unsafe-eval'", // Required for TradingView
          "https://cdn.jsdelivr.net",
          "https://unpkg.com"
        ],
        'style-src': [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdn.jsdelivr.net"
        ],
        'font-src': [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdn.jsdelivr.net"
        ],
        'img-src': [
          "'self'",
          "data:",
          "https:",
          "blob:"
        ],
        'connect-src': [
          "'self'",
          "https://api.binance.com",
          "https://api.kucoin.com",
          "wss://stream.binance.com",
          "wss://ws-api.kucoin.com"
        ],
        'frame-src': [
          "'self'",
          "https://www.tradingview.com"
        ],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'upgrade-insecure-requests': []
      }
    },
    frameOptions: 'DENY',
    contentTypeOptions: true,
    xssProtection: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: 'geolocation=(), microphone=(), camera=()'
  },

  auditLogging: {
    enabled: true,
    logAllRequests: config.env === 'production',
    logFailedRequests: true,
    logSecurityEvents: true,
    logApiKeyUsage: true,
    retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '365'),
    sensitiveDataMasking: true,
    realTimeAlerts: config.env === 'production'
  },

  monitoring: {
    enabled: true,
    metricsCollection: true,
    securityDashboard: true,
    alerting: {
      enabled: config.env === 'production',
      channels: (process.env.ALERT_CHANNELS || 'email,slack').split(','),
      thresholds: {
        rateLimitViolations: parseInt(process.env.ALERT_RATE_LIMIT_THRESHOLD || '100'),
        intrusionAttempts: parseInt(process.env.ALERT_INTRUSION_THRESHOLD || '10'),
        suspiciousActivities: parseInt(process.env.ALERT_SUSPICIOUS_THRESHOLD || '50'),
        failedAuthentications: parseInt(process.env.ALERT_AUTH_FAILURE_THRESHOLD || '20')
      }
    }
  },

  ipManagement: {
    enabled: true,
    autoBlocking: true,
    whitelist: (process.env.IP_WHITELIST || '').split(',').filter(Boolean),
    blacklist: (process.env.IP_BLACKLIST || '').split(',').filter(Boolean),
    geoBlocking: {
      enabled: process.env.GEO_BLOCKING_ENABLED === 'true',
      allowedCountries: (process.env.ALLOWED_COUNTRIES || '').split(',').filter(Boolean),
      blockedCountries: (process.env.BLOCKED_COUNTRIES || '').split(',').filter(Boolean)
    }
  },

  sessionSecurity: {
    enabled: true,
    secure: config.env === 'production',
    httpOnly: true,
    sameSite: config.env === 'production' ? 'strict' : 'lax',
    maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000'), // 24 hours
    regenerateOnAuth: true,
    invalidateOnSuspicious: true
  },

  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    tagLength: 16,
    keyRotationDays: parseInt(process.env.KEY_ROTATION_DAYS || '90'),
    encryptSensitiveData: true
  }
};

/**
 * Validate production security configuration
 */
export function validateProductionSecurityConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate required environment variables
  const requiredEnvVars = [
    'REDIS_URL',
    'CORS_ALLOWED_ORIGINS'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`);
    }
  }

  // Validate paper trading mode in production
  if (config.env === 'production' && !config.paperTradingMode) {
    errors.push('Paper trading mode must be enabled in production');
  }

  // Validate HTTPS enforcement in production
  if (config.env === 'production' && !productionSecurityConfig.environment.enforceHTTPS) {
    errors.push('HTTPS must be enforced in production');
  }

  // Validate CORS origins
  if (productionSecurityConfig.cors.allowedOrigins.length === 0) {
    errors.push('At least one CORS origin must be configured');
  }

  // Validate rate limiting configuration
  if (productionSecurityConfig.rateLimiting.enabled && !productionSecurityConfig.rateLimiting.redis.url) {
    errors.push('Redis URL is required for rate limiting');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get security configuration for specific environment
 */
export function getSecurityConfigForEnvironment(env: string): Partial<ProductionSecurityConfig> {
  const baseConfig = { ...productionSecurityConfig };

  switch (env) {
    case 'development':
      return {
        ...baseConfig,
        environment: {
          ...baseConfig.environment,
          enforceHTTPS: false
        },
        cors: {
          ...baseConfig.cors,
          strictOriginValidation: false,
          allowedOrigins: [
            ...baseConfig.cors.allowedOrigins,
            'http://localhost:3000',
            'http://127.0.0.1:3000'
          ]
        },
        securityHeaders: {
          ...baseConfig.securityHeaders,
          hsts: {
            ...baseConfig.securityHeaders.hsts,
            enabled: false
          },
          csp: {
            ...baseConfig.securityHeaders.csp,
            reportOnly: true
          }
        },
        sessionSecurity: {
          ...baseConfig.sessionSecurity,
          secure: false,
          sameSite: 'lax'
        }
      };

    case 'production':
      return {
        ...baseConfig,
        environment: {
          ...baseConfig.environment,
          enforceHTTPS: true
        },
        auditLogging: {
          ...baseConfig.auditLogging,
          logAllRequests: true,
          realTimeAlerts: true
        },
        monitoring: {
          ...baseConfig.monitoring,
          alerting: {
            ...baseConfig.monitoring.alerting,
            enabled: true
          }
        }
      };

    default:
      return baseConfig;
  }
}

export default productionSecurityConfig;