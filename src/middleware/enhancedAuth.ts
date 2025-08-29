import { Request, Response, NextFunction } from 'express';
import { AuthService } from '@/services/AuthService';
import { SessionManagementService } from '@/services/SessionManagementService';
import { SecurityMonitoringService } from '@/services/SecurityMonitoringService';
import { logger } from '@/utils/logger';
import { config } from '@/config/config';
import { UserRole, Permission, JwtPayload } from '@/types/auth';
import { PrismaClient } from '@prisma/client';

export interface EnhancedAuthenticatedRequest extends Request {
  user?: JwtPayload;
  session?: any;
  authMethod?: 'jwt' | 'session' | 'apikey';
  securityContext?: {
    ipAddress: string;
    userAgent: string;
    riskScore: number;
    isNewDevice: boolean;
    isSuspicious: boolean;
  };
}

export class EnhancedAuthMiddleware {
  private sessionService: SessionManagementService;
  private securityService: SecurityMonitoringService;
  private prisma: PrismaClient;

  constructor(
    sessionService: SessionManagementService,
    securityService: SecurityMonitoringService,
    prisma: PrismaClient
  ) {
    this.sessionService = sessionService;
    this.securityService = securityService;
    this.prisma = prisma;
  }

  /**
   * Enhanced JWT authentication with session management
   */
  authenticate = async (
    req: EnhancedAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const sessionId = req.cookies?.sessionId || req.headers['x-session-id'];
      const apiKey = req.headers['x-api-key'];

      let user: JwtPayload | null = null;
      let authMethod: 'jwt' | 'session' | 'apikey' | null = null;

      // Try JWT authentication first
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        try {
          user = await AuthService.verifyToken(token);
          authMethod = 'jwt';
          
          // Create or update session for JWT users
          if (user && !sessionId) {
            const session = await this.sessionService.createSession(
              user.userId,
              req,
              { authMethod: 'jwt', loginTime: new Date() }
            );
            this.sessionService.setSessionCookie(res, session.id);
          }
        } catch (error) {
          logger.debug('JWT verification failed:', error);
        }
      }

      // Try session authentication if JWT failed
      if (!user && sessionId) {
        const session = await this.sessionService.getSession(sessionId as string);
        if (session) {
          // Get user from session
          const dbUser = await this.prisma.user.findUnique({
            where: { id: session.userId }
          });
          
          if (dbUser && dbUser.isActive) {
            user = {
              userId: dbUser.id,
              email: dbUser.email,
              role: dbUser.role
            };
            authMethod = 'session';
            req.session = session;
          }
        }
      }

      // Try API key authentication if others failed
      if (!user && apiKey) {
        try {
          const apiKeyRecord = await this.prisma.apiKey.findUnique({
            where: { key: apiKey as string, isActive: true },
            include: { user: true }
          });

          if (apiKeyRecord && apiKeyRecord.user.isActive) {
            // Check API key expiration
            if (!apiKeyRecord.expiresAt || apiKeyRecord.expiresAt > new Date()) {
              user = {
                userId: apiKeyRecord.user.id,
                email: apiKeyRecord.user.email,
                role: apiKeyRecord.user.role
              };
              authMethod = 'apikey';

              // Update API key last used
              await this.prisma.apiKey.update({
                where: { id: apiKeyRecord.id },
                data: { lastUsedAt: new Date() }
              });
            }
          }
        } catch (error) {
          logger.debug('API key verification failed:', error);
        }
      }

      if (!user) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required'
        });
        return;
      }

      // Build security context
      const securityContext = await this.buildSecurityContext(req, user);

      // Check for suspicious activity
      if (securityContext.isSuspicious) {
        await this.securityService.logSecurityEvent(
          user.userId,
          'SUSPICIOUS_LOGIN_ATTEMPT',
          {
            ipAddress: securityContext.ipAddress,
            userAgent: securityContext.userAgent,
            riskScore: securityContext.riskScore,
            authMethod
          }
        );

        // Block high-risk requests
        if (securityContext.riskScore > 80) {
          res.status(403).json({
            error: 'SECURITY_VIOLATION',
            message: 'Request blocked due to suspicious activity'
          });
          return;
        }
      }

      // Set request properties
      req.user = user;
      req.authMethod = authMethod;
      req.securityContext = securityContext;

      // Log successful authentication
      logger.debug(`User authenticated: ${user.email} via ${authMethod}`);

      next();
    } catch (error) {
      logger.error('Enhanced authentication error:', error);
      res.status(500).json({
        error: 'AUTHENTICATION_ERROR',
        message: 'Authentication failed'
      });
    }
  };

  /**
   * Optional authentication (doesn't fail if no credentials)
   */
  optionalAuth = async (
    req: EnhancedAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Try to authenticate, but don't fail if no credentials
      const authHeader = req.headers.authorization;
      const sessionId = req.cookies?.sessionId;
      const apiKey = req.headers['x-api-key'];

      if (authHeader || sessionId || apiKey) {
        await this.authenticate(req, res, next);
      } else {
        next();
      }
    } catch (error) {
      // Continue without authentication for optional auth
      logger.debug('Optional authentication failed:', error);
      next();
    }
  };

  /**
   * Role-based authorization
   */
  authorize = (allowedRoles: UserRole[]) => {
    return (req: EnhancedAuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required'
        });
        return;
      }

      const userRole = req.user.role as UserRole;
      
      if (!allowedRoles.includes(userRole)) {
        res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Insufficient permissions'
        });
        return;
      }

      next();
    };
  };

  /**
   * Permission-based authorization
   */
  requirePermission = (permission: Permission) => {
    return (req: EnhancedAuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required'
        });
        return;
      }

      const userRole = req.user.role as UserRole;
      
      if (!AuthService.hasPermission(userRole, permission)) {
        res.status(403).json({
          error: 'FORBIDDEN',
          message: `Permission required: ${permission}`
        });
        return;
      }

      next();
    };
  };

  /**
   * Multi-factor authentication requirement
   */
  requireMFA = async (
    req: EnhancedAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required'
        });
        return;
      }

      // Check if user has MFA enabled
      const user = await this.prisma.user.findUnique({
        where: { id: req.user.userId }
      });

      if (!user?.mfaEnabled) {
        res.status(403).json({
          error: 'MFA_REQUIRED',
          message: 'Multi-factor authentication must be enabled'
        });
        return;
      }

      // Check if current session is MFA verified
      if (req.session && !req.session.metadata?.mfaVerified) {
        res.status(403).json({
          error: 'MFA_VERIFICATION_REQUIRED',
          message: 'MFA verification required for this session'
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('MFA requirement check error:', error);
      res.status(500).json({
        error: 'MFA_CHECK_ERROR',
        message: 'Failed to verify MFA requirement'
      });
    }
  };

  /**
   * Device trust verification
   */
  requireTrustedDevice = async (
    req: EnhancedAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user || !req.securityContext) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required'
        });
        return;
      }

      // Check if device is trusted
      if (req.securityContext.isNewDevice) {
        res.status(403).json({
          error: 'DEVICE_VERIFICATION_REQUIRED',
          message: 'Device verification required for new devices'
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Device trust verification error:', error);
      res.status(500).json({
        error: 'DEVICE_VERIFICATION_ERROR',
        message: 'Failed to verify device trust'
      });
    }
  };

  /**
   * Rate limiting by user
   */
  userRateLimit = (maxRequests: number, windowMs: number) => {
    const userRequests = new Map<string, { count: number; resetTime: number }>();

    return (req: EnhancedAuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        return next();
      }

      const userId = req.user.userId;
      const now = Date.now();
      const userRecord = userRequests.get(userId);

      if (!userRecord || now >= userRecord.resetTime) {
        userRequests.set(userId, { count: 1, resetTime: now + windowMs });
        return next();
      }

      if (userRecord.count >= maxRequests) {
        const retryAfter = Math.ceil((userRecord.resetTime - now) / 1000);
        res.set('Retry-After', retryAfter.toString());
        
        res.status(429).json({
          error: 'USER_RATE_LIMIT_EXCEEDED',
          message: 'Too many requests for this user',
          retryAfter
        });
        return;
      }

      userRecord.count++;
      next();
    };
  };

  /**
   * Build security context for request
   */
  private async buildSecurityContext(
    req: Request,
    user: JwtPayload
  ): Promise<{
    ipAddress: string;
    userAgent: string;
    riskScore: number;
    isNewDevice: boolean;
    isSuspicious: boolean;
  }> {
    const ipAddress = this.getClientIP(req);
    const userAgent = req.get('User-Agent') || '';

    // Calculate risk score based on various factors
    let riskScore = 0;

    // Check for new IP address
    const recentLogins = await this.prisma.userSession.findMany({
      where: {
        userId: user.userId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      },
      select: { ipAddress: true }
    });

    const knownIPs = new Set(recentLogins.map(login => login.ipAddress));
    const isNewIP = !knownIPs.has(ipAddress);

    if (isNewIP) {
      riskScore += 30;
    }

    // Check for suspicious user agent
    const suspiciousUAPatterns = [
      /bot|crawler|spider|scraper/i,
      /curl|wget|python|perl/i,
      /sqlmap|nikto|nmap|masscan/i
    ];

    const hasSuspiciousUA = suspiciousUAPatterns.some(pattern => pattern.test(userAgent));
    if (hasSuspiciousUA) {
      riskScore += 50;
    }

    // Check for unusual timing patterns
    const lastLogin = await this.prisma.userSession.findFirst({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' }
    });

    if (lastLogin) {
      const timeSinceLastLogin = Date.now() - lastLogin.createdAt.getTime();
      // Very quick successive logins might be suspicious
      if (timeSinceLastLogin < 60000) { // Less than 1 minute
        riskScore += 20;
      }
    }

    // Check geolocation (simplified - in production you'd use a GeoIP service)
    // For now, we'll just check if it's a private IP
    const isPrivateIP = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(ipAddress);
    if (!isPrivateIP && config.env === 'production') {
      // Public IP in production might need additional verification
      riskScore += 10;
    }

    return {
      ipAddress,
      userAgent,
      riskScore,
      isNewDevice: isNewIP,
      isSuspicious: riskScore > 50
    };
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           'unknown';
  }
}

// Convenience middleware functions
export const createEnhancedAuth = (
  sessionService: SessionManagementService,
  securityService: SecurityMonitoringService,
  prisma: PrismaClient
) => {
  const authMiddleware = new EnhancedAuthMiddleware(sessionService, securityService, prisma);

  return {
    authenticate: authMiddleware.authenticate,
    optionalAuth: authMiddleware.optionalAuth,
    authorize: authMiddleware.authorize,
    requirePermission: authMiddleware.requirePermission,
    requireMFA: authMiddleware.requireMFA,
    requireTrustedDevice: authMiddleware.requireTrustedDevice,
    userRateLimit: authMiddleware.userRateLimit,
    
    // Convenience methods
    adminOnly: authMiddleware.authorize([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
    superAdminOnly: authMiddleware.authorize([UserRole.SUPER_ADMIN]),
    
    // Permission shortcuts
    requireTradePermission: authMiddleware.requirePermission(Permission.TRADE_EXECUTE),
    requireViewPermission: authMiddleware.requirePermission(Permission.TRADE_VIEW),
    requireSystemPermission: authMiddleware.requirePermission(Permission.SYSTEM_ADMIN)
  };
};