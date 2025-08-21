import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from '@/config/config';
import { logger } from '@/utils/logger';
import { SecurityMonitoringService } from '@/services/SecurityMonitoringService';

/**
 * Security headers middleware using Helmet
 */
export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
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
      upgradeInsecureRequests: [],
    },
  },
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  // X-Frame-Options
  frameguard: {
    action: 'deny'
  },
  
  // X-Content-Type-Options
  noSniff: true,
  
  // X-XSS-Protection
  xssFilter: true,
  
  // Referrer Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },
  
  // Hide X-Powered-By header
  hidePoweredBy: true,
  
  // DNS Prefetch Control
  dnsPrefetchControl: {
    allow: false
  },
  
  // Expect-CT
  expectCt: {
    maxAge: 86400, // 24 hours
    enforce: true
  }
});

/**
 * CORS configuration
 */
export const corsOptions = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      config.websocket.cors.origin,
      'https://localhost:3000',
      'https://127.0.0.1:3000'
    ];
    
    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000');
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
  maxAge: 86400 // 24 hours
});

/**
 * Force HTTPS in production
 */
export const forceHTTPS = (req: Request, res: Response, next: NextFunction): void => {
  if (config.env === 'production' && !req.secure && req.get('x-forwarded-proto') !== 'https') {
    logger.warn(`HTTP request blocked in production: ${req.url}`);
    return res.status(426).json({
      error: 'HTTPS_REQUIRED',
      message: 'HTTPS is required in production'
    });
  }
  next();
};

/**
 * Request validation middleware
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  // Check for required headers
  if (!req.get('User-Agent')) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'User-Agent header is required'
    });
  }
  
  // Validate Content-Type for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Content-Type must be application/json'
      });
    }
  }
  
  // Check request size
  const contentLength = parseInt(req.get('Content-Length') || '0', 10);
  if (contentLength > 10 * 1024 * 1024) { // 10MB limit
    return res.status(413).json({
      error: 'PAYLOAD_TOO_LARGE',
      message: 'Request payload too large'
    });
  }
  
  next();
};

/**
 * IP whitelist middleware (for admin endpoints)
 */
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = getClientIP(req);
    
    if (!allowedIPs.includes(clientIP) && !allowedIPs.includes('*')) {
      logger.warn(`IP not whitelisted: ${clientIP}`);
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'IP address not allowed'
      });
    }
    
    next();
  };
};

/**
 * Security monitoring middleware
 */
export const securityMonitoring = (securityService: SecurityMonitoringService) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Skip monitoring for health checks and static assets
      if (req.path === '/health' || req.path.startsWith('/static/')) {
        return next();
      }
      
      const userId = (req as any).user?.userId;
      
      // Monitor the request
      if (userId) {
        await securityService.monitorActivity(userId, 'API_REQUEST' as any, req);
      }
      
      next();
    } catch (error) {
      logger.error('Security monitoring error:', error);
      res.status(403).json({
        error: 'SECURITY_VIOLATION',
        message: 'Request blocked by security monitoring'
      });
    }
  };
};

/**
 * Request ID middleware
 */
export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.get('X-Request-ID') || generateRequestId();
  req.headers['x-request-id'] = requestId;
  res.set('X-Request-ID', requestId);
  next();
};

/**
 * Response time middleware
 */
export const responseTime = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    res.set('X-Response-Time', `${duration}ms`);
    
    // Log slow requests
    if (duration > 1000) {
      logger.warn(`Slow request: ${req.method} ${req.path} - ${duration}ms`);
    }
  });
  
  next();
};

/**
 * Content validation middleware
 */
export const validateContent = (req: Request, res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === 'object') {
    // Remove null bytes
    const cleanBody = JSON.parse(JSON.stringify(req.body).replace(/\0/g, ''));
    req.body = cleanBody;
    
    // Check for suspicious patterns
    const bodyString = JSON.stringify(req.body);
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i,
      /eval\(/i,
      /document\./i,
      /window\./i
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(bodyString)) {
        logger.warn(`Suspicious content detected: ${req.method} ${req.path}`);
        return res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'Invalid content detected'
        });
      }
    }
  }
  
  next();
};

/**
 * API key validation middleware
 */
export const validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.get('X-API-Key');
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'API key required'
    });
  }
  
  // Validate API key format
  if (!/^[a-zA-Z0-9]{32,64}$/.test(apiKey)) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid API key format'
    });
  }
  
  // TODO: Validate against database
  next();
};

/**
 * WebSocket security middleware
 */
export const websocketSecurity = {
  /**
   * Validate WebSocket connection
   */
  validateConnection: (socket: any, next: (err?: Error) => void) => {
    try {
      // Check origin
      const origin = socket.handshake.headers.origin;
      const allowedOrigins = [config.websocket.cors.origin];
      
      if (origin && !allowedOrigins.includes(origin)) {
        logger.warn(`WebSocket connection blocked from origin: ${origin}`);
        return next(new Error('Origin not allowed'));
      }
      
      // Rate limiting
      const ip = getClientIP(socket.handshake);
      // TODO: Implement WebSocket rate limiting
      
      next();
    } catch (error) {
      logger.error('WebSocket security validation error:', error);
      next(new Error('Security validation failed'));
    }
  },
  
  /**
   * Validate WebSocket message
   */
  validateMessage: (socket: any, data: any, next: (err?: Error) => void) => {
    try {
      // Check message size
      const messageSize = JSON.stringify(data).length;
      if (messageSize > 64 * 1024) { // 64KB limit
        return next(new Error('Message too large'));
      }
      
      // Validate message structure
      if (!data.type || typeof data.type !== 'string') {
        return next(new Error('Invalid message format'));
      }
      
      next();
    } catch (error) {
      logger.error('WebSocket message validation error:', error);
      next(new Error('Message validation failed'));
    }
  }
};

/**
 * TLS configuration for HTTPS server
 */
export const tlsOptions = {
  // Minimum TLS version
  secureProtocol: 'TLSv1_2_method',
  
  // Cipher suites (prefer strong ciphers)
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
  
  // Honor cipher order
  honorCipherOrder: true,
  
  // Disable weak protocols
  secureOptions: require('constants').SSL_OP_NO_SSLv2 | 
                 require('constants').SSL_OP_NO_SSLv3 | 
                 require('constants').SSL_OP_NO_TLSv1 | 
                 require('constants').SSL_OP_NO_TLSv1_1
};

// Helper functions
function getClientIP(req: any): string {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.handshake?.address ||
         'unknown';
}

function generateRequestId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}