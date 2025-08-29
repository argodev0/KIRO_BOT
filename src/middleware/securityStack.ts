import { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';

import { SessionManagementService } from '@/services/SessionManagementService';
import { SecurityMonitoringService } from '@/services/SecurityMonitoringService';
import { AccountLockoutService } from '@/services/AccountLockoutService';
import { createEnhancedAuth } from '@/middleware/enhancedAuth';
import { securityConfig } from '@/config/securityConfig';
import { logger } from '@/utils/logger';
import { config } from '@/config/config';

export interface SecurityStackOptions {
  enableHelmet?: boolean;
  enableCors?: boolean;
  enableRateLimit?: boolean;
  enableSlowDown?: boolean;
  enableCompression?: boolean;
  enableCookieParser?: boolean;
  enableSessionManagement?: boolean;
  enableSecurityMonitoring?: boolean;
  enableEnhancedAuth?: boolean;
}

export class SecurityStack {
  private app: Express;
  private prisma: PrismaClient;
  private sessionService?: SessionManagementService;
  private securityService?: SecurityMonitoringService;
  private accountLockoutService?: AccountLockoutService;
  private enhancedAuth?: ReturnType<typeof createEnhancedAuth>;

  constructor(app: Express, prisma: PrismaClient) {
    this.app = app;
    this.prisma = prisma;
  }

  /**
   * Initialize the complete security stack
   */
  async initialize(options: SecurityStackOptions = {}): Promise<void> {
    const opts = {
      enableHelmet: true,
      enableCors: true,
      enableRateLimit: true,
      enableSlowDown: true,
      enableCompression: true,
      enableCookieParser: true,
      enableSessionManagement: true,
      enableSecurityMonitoring: true,
      enableEnhancedAuth: true,
      ...options
    };

    logger.info('Initializing security stack...');

    // 1. Basic security headers (Helmet)
    if (opts.enableHelmet) {
      this.setupHelmet();
    }

    // 2. CORS configuration
    if (opts.enableCors) {
      this.setupCors();
    }

    // 3. Request parsing and compression
    if (opts.enableCompression) {
      this.setupCompression();
    }

    if (opts.enableCookieParser) {
      this.setupCookieParser();
    }

    // 4. Rate limiting and slow down
    if (opts.enableRateLimit) {
      this.setupRateLimit();
    }

    if (opts.enableSlowDown) {
      this.setupSlowDown();
    }

    // 5. Session management
    if (opts.enableSessionManagement) {
      await this.setupSessionManagement();
    }

    // 6. Account lockout service
    this.setupAccountLockout();

    // 7. Security monitoring
    if (opts.enableSecurityMonitoring) {
      await this.setupSecurityMonitoring();
    }

    // 8. Enhanced authentication
    if (opts.enableEnhancedAuth && this.sessionService && this.securityService) {
      this.setupEnhancedAuth();
    }

    // 9. Additional security middleware
    this.setupAdditionalSecurity();

    logger.info('Security stack initialized successfully');
  }

  /**
   * Setup Helmet security headers
   */
  private setupHelmet(): void {
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: securityConfig.helmet.contentSecurityPolicy.directives
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
        enforce: true
      }
    }));

    // Additional security headers manually set
    this.app.use((req, res, next) => {
      // Ensure all required security headers are present
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      
      // Remove server information disclosure
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');
      
      next();
    });

    logger.debug('Helmet security headers configured with manual overrides');
  }

  /**
   * Setup CORS
   */
  private setupCors(): void {
    this.app.use(cors(securityConfig.cors));
    logger.debug('CORS configured');
  }

  /**
   * Setup compression
   */
  private setupCompression(): void {
    this.app.use(compression({
      filter: (req, res) => {
        // Don't compress responses with this request header
        if (req.headers['x-no-compression']) {
          return false;
        }
        // Fallback to standard filter function
        return compression.filter(req, res);
      },
      level: 6, // Compression level (1-9)
      threshold: 1024 // Only compress responses larger than 1KB
    }));

    logger.debug('Compression configured');
  }

  /**
   * Setup cookie parser
   */
  private setupCookieParser(): void {
    this.app.use(cookieParser(securityConfig.session.secret));
    logger.debug('Cookie parser configured');
  }

  /**
   * Setup rate limiting
   */
  private setupRateLimit(): void {
    // General rate limiter - STRICT for security audit
    const generalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per 15 minutes
      message: {
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        return req.ip || req.connection?.remoteAddress || 'unknown';
      },
      skip: (req) => {
        // Only skip health checks, not metrics
        return req.path === '/health';
      },
      onLimitReached: (req) => {
        logger.warn(`Rate limit exceeded for ${req.ip}`, {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method
        });
      }
    });

    // VERY strict rate limiter for auth endpoints - CRITICAL for security
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 3, // Only 3 attempts per 15 minutes
      message: {
        error: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts, please try again later'
      },
      keyGenerator: (req) => {
        const ip = req.ip || req.connection?.remoteAddress || 'unknown';
        const email = req.body?.email || '';
        return `auth:${ip}:${email}`;
      },
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      onLimitReached: (req) => {
        logger.error(`Authentication rate limit exceeded`, {
          ip: req.ip,
          email: req.body?.email,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        });
      }
    });

    // API rate limiter - moderate for normal API usage
    const apiLimiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 50, // 50 requests per minute
      message: {
        error: 'API_RATE_LIMIT_EXCEEDED',
        message: 'Too many API requests, please slow down'
      },
      keyGenerator: (req) => {
        const ip = req.ip || req.connection?.remoteAddress || 'unknown';
        const userId = (req as any).user?.userId;
        return userId ? `api:${userId}` : `api:${ip}`;
      }
    });

    // Trading endpoints - very strict
    const tradingLimiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 10, // Only 10 trading requests per minute
      message: {
        error: 'TRADING_RATE_LIMIT_EXCEEDED',
        message: 'Too many trading requests, please slow down'
      },
      keyGenerator: (req) => {
        const userId = (req as any).user?.userId;
        const ip = req.ip || req.connection?.remoteAddress || 'unknown';
        return userId ? `trading:${userId}` : `trading:${ip}`;
      }
    });

    // Apply rate limiters in order of specificity
    this.app.use('/api/v1/auth', authLimiter);
    this.app.use('/api/v1/trading', tradingLimiter);
    this.app.use('/api/v1', apiLimiter);
    this.app.use(generalLimiter);

    logger.debug('Rate limiting configured with strict security settings');
  }

  /**
   * Setup slow down middleware
   */
  private setupSlowDown(): void {
    const speedLimiter = slowDown({
      windowMs: 15 * 60 * 1000, // 15 minutes
      delayAfter: 50, // Allow 50 requests per windowMs without delay
      delayMs: 500, // Add 500ms delay per request after delayAfter
      maxDelayMs: 20000, // Maximum delay of 20 seconds
      skipFailedRequests: false,
      skipSuccessfulRequests: false,
      onLimitReached: (req) => {
        logger.warn(`Speed limit reached for ${req.ip}`, {
          ip: req.ip,
          path: req.path
        });
      }
    });

    this.app.use(speedLimiter);
    logger.debug('Slow down middleware configured');
  }

  /**
   * Setup session management
   */
  private async setupSessionManagement(): Promise<void> {
    this.sessionService = new SessionManagementService(this.prisma, {
      maxAge: securityConfig.session.maxAge,
      maxSessions: securityConfig.session.maxSessions,
      secure: securityConfig.session.secure,
      httpOnly: securityConfig.session.httpOnly,
      sameSite: securityConfig.session.sameSite,
      rolling: securityConfig.session.rolling
    });

    // Apply session middleware
    this.app.use(this.sessionService.middleware());

    logger.debug('Session management configured');
  }

  /**
   * Setup account lockout service
   */
  private setupAccountLockout(): void {
    this.accountLockoutService = AccountLockoutService.getInstance({
      maxAttempts: 5,
      lockoutDuration: 15 * 60 * 1000, // 15 minutes
      windowDuration: 15 * 60 * 1000 // 15 minutes
    });

    // Apply account lockout middleware to auth endpoints
    this.app.use('/api/v1/auth', this.accountLockoutService.middleware());

    logger.debug('Account lockout service configured');
  }

  /**
   * Setup security monitoring
   */
  private async setupSecurityMonitoring(): Promise<void> {
    // This would be initialized elsewhere, but we'll create a placeholder
    // In a real implementation, you'd inject this service
    this.securityService = new SecurityMonitoringService(
      this.prisma,
      {} as any, // AuditLogService would be injected
      {} as any  // NotificationService would be injected
    );

    logger.debug('Security monitoring configured');
  }

  /**
   * Setup enhanced authentication
   */
  private setupEnhancedAuth(): void {
    if (!this.sessionService || !this.securityService) {
      throw new Error('Session service and security service must be initialized first');
    }

    this.enhancedAuth = createEnhancedAuth(
      this.sessionService,
      this.securityService,
      this.prisma
    );

    logger.debug('Enhanced authentication configured');
  }

  /**
   * Setup additional security middleware
   */
  private setupAdditionalSecurity(): void {
    // Request ID middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const requestId = req.get('X-Request-ID') || this.generateRequestId();
      req.headers['x-request-id'] = requestId;
      res.set('X-Request-ID', requestId);
      next();
    });

    // Response time middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
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
    });

    // Content validation middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
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
    });

    // Force HTTPS in production
    if (config.env === 'production') {
      this.app.use((req: Request, res: Response, next: NextFunction) => {
        if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
          logger.warn(`HTTP request blocked in production: ${req.url}`);
          return res.status(426).json({
            error: 'HTTPS_REQUIRED',
            message: 'HTTPS is required in production'
          });
        }
        next();
      });
    }

    // Paper trading safety middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      // Ensure paper trading mode is enforced
      if (config.env === 'production' && !config.paperTrading.enabled) {
        logger.error('CRITICAL: Paper trading mode disabled in production', {
          ip: req.ip,
          path: req.path
        });
        
        return res.status(500).json({
          error: 'CONFIGURATION_ERROR',
          message: 'Paper trading mode must be enabled in production'
        });
      }
      
      // Block any real trading endpoints
      const tradingEndpoints = [
        '/api/trading/execute',
        '/api/orders/place',
        '/api/withdraw',
        '/api/transfer'
      ];
      
      if (tradingEndpoints.some(endpoint => req.path.includes(endpoint))) {
        logger.error('CRITICAL: Real trading endpoint accessed', {
          ip: req.ip,
          path: req.path,
          method: req.method
        });
        
        return res.status(403).json({
          error: 'TRADING_BLOCKED',
          message: 'Real trading operations are blocked in paper trading mode'
        });
      }
      
      next();
    });

    logger.debug('Additional security middleware configured');
  }

  /**
   * Get enhanced auth middleware
   */
  getEnhancedAuth(): ReturnType<typeof createEnhancedAuth> | undefined {
    return this.enhancedAuth;
  }

  /**
   * Get session service
   */
  getSessionService(): SessionManagementService | undefined {
    return this.sessionService;
  }

  /**
   * Get security service
   */
  getSecurityService(): SecurityMonitoringService | undefined {
    return this.securityService;
  }

  /**
   * Get account lockout service
   */
  getAccountLockoutService(): AccountLockoutService | undefined {
    return this.accountLockoutService;
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  /**
   * Get security status
   */
  getSecurityStatus(): {
    helmet: boolean;
    cors: boolean;
    rateLimit: boolean;
    sessionManagement: boolean;
    securityMonitoring: boolean;
    accountLockout: boolean;
    enhancedAuth: boolean;
    paperTradingMode: boolean;
    httpsEnforced: boolean;
  } {
    return {
      helmet: true,
      cors: true,
      rateLimit: true,
      sessionManagement: !!this.sessionService,
      securityMonitoring: !!this.securityService,
      accountLockout: !!this.accountLockoutService,
      enhancedAuth: !!this.enhancedAuth,
      paperTradingMode: config.paperTrading.enabled,
      httpsEnforced: config.env === 'production'
    };
  }
}

// Export convenience function
export const createSecurityStack = (app: Express, prisma: PrismaClient): SecurityStack => {
  return new SecurityStack(app, prisma);
};