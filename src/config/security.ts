import { config } from './config';

export const securityConfig = {
  // Encryption settings
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    tagLength: 16,
    keyRotationDays: 90
  },

  // Password policy
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    specialChars: '@$!%*?&',
    maxAge: 90, // days
    historyCount: 5, // prevent reuse of last N passwords
    lockoutAttempts: 5,
    lockoutDuration: 15 // minutes
  },

  // Session management
  session: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    renewThreshold: 15 * 60 * 1000, // 15 minutes
    maxConcurrent: 3, // max concurrent sessions per user
    idleTimeout: 30 * 60 * 1000, // 30 minutes
    absoluteTimeout: 8 * 60 * 60 * 1000 // 8 hours
  },

  // Rate limiting
  rateLimit: {
    // Authentication endpoints
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxAttempts: 5,
      blockDuration: 15 * 60 * 1000 // 15 minutes
    },
    
    // API endpoints
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1000,
      skipSuccessfulRequests: false
    },
    
    // WebSocket connections
    websocket: {
      windowMs: 60 * 1000, // 1 minute
      maxConnections: 10,
      maxMessages: 100
    }
  },

  // Input validation
  validation: {
    maxRequestSize: 10 * 1024 * 1024, // 10MB
    maxFieldLength: 10000,
    maxArrayLength: 1000,
    maxObjectDepth: 10,
    allowedFileTypes: ['.jpg', '.jpeg', '.png', '.pdf', '.csv'],
    maxFileSize: 5 * 1024 * 1024, // 5MB
    scanUploads: true
  },

  // Security monitoring
  monitoring: {
    // Suspicious activity thresholds
    failedLoginThreshold: 5,
    rapidApiCallsThreshold: 1000,
    multipleIpThreshold: 5,
    unusualTradingThreshold: 100,
    configChangesThreshold: 10,
    dataExportThreshold: 5,
    
    // Time windows (minutes)
    failedLoginWindow: 15,
    rapidApiCallsWindow: 5,
    multipleIpWindow: 60,
    unusualTradingWindow: 60,
    configChangesWindow: 30,
    dataExportWindow: 60,
    
    // Actions
    enableAutoLock: true,
    enableIpBlocking: true,
    enableNotifications: true,
    enableMfaRequirement: true
  },

  // Audit logging
  audit: {
    retentionDays: 365,
    criticalRetentionDays: 2555, // 7 years
    logLevel: 'info',
    includeRequestBodies: false,
    includeResponseBodies: false,
    maskSensitiveFields: true,
    sensitiveFields: [
      'password',
      'passwordHash',
      'apiKey',
      'apiSecret',
      'passphrase',
      'token',
      'refreshToken',
      'encryptedData'
    ]
  },

  // CORS settings
  cors: {
    allowedOrigins: [
      config.websocket.cors.origin,
      'https://localhost:3000',
      'https://127.0.0.1:3000'
    ],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
      'X-Request-ID'
    ],
    exposedHeaders: ['X-Request-ID', 'X-Rate-Limit-Remaining'],
    credentials: true,
    maxAge: 86400 // 24 hours
  },

  // Content Security Policy
  csp: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "https:"],
    scriptSrc: ["'self'", "'unsafe-eval'"], // Required for TradingView charts
    connectSrc: ["'self'", "wss:", "https:"],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    upgradeInsecureRequests: config.env === 'production'
  },

  // TLS/SSL settings
  tls: {
    minVersion: 'TLSv1.2',
    ciphers: [
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES128-SHA256',
      'ECDHE-RSA-AES256-SHA384',
      'ECDHE-RSA-AES256-SHA256',
      'ECDHE-RSA-AES128-SHA',
      'ECDHE-RSA-AES256-SHA',
      'AES128-GCM-SHA256',
      'AES256-GCM-SHA384',
      'AES128-SHA256',
      'AES256-SHA256',
      'AES128-SHA',
      'AES256-SHA'
    ].join(':'),
    honorCipherOrder: true,
    dhparam: process.env.DH_PARAM_FILE
  },

  // API security
  api: {
    requireApiKey: false, // Set to true for API key authentication
    apiKeyHeader: 'X-API-Key',
    apiKeyLength: 64,
    enableSwagger: config.env !== 'production',
    swaggerAuth: config.env === 'production'
  },

  // File upload security
  upload: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'text/csv',
      'application/json'
    ],
    scanForMalware: true,
    quarantinePath: '/tmp/quarantine',
    virusTotalApiKey: process.env.VIRUSTOTAL_API_KEY
  },

  // IP whitelist for admin functions
  adminWhitelist: process.env.ADMIN_IP_WHITELIST?.split(',') || [],

  // Security headers
  headers: {
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    frameOptions: 'DENY',
    contentTypeOptions: 'nosniff',
    xssProtection: '1; mode=block',
    referrerPolicy: 'strict-origin-when-cross-origin',
    expectCt: {
      maxAge: 86400, // 24 hours
      enforce: true
    }
  },

  // Environment-specific overrides
  ...(config.env === 'development' && {
    cors: {
      allowedOrigins: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://localhost:3000',
        'https://127.0.0.1:3000'
      ]
    },
    csp: {
      upgradeInsecureRequests: false
    }
  }),

  ...(config.env === 'production' && {
    session: {
      secure: true,
      sameSite: 'strict'
    },
    audit: {
      includeRequestBodies: false,
      includeResponseBodies: false
    }
  })
};

export default securityConfig;