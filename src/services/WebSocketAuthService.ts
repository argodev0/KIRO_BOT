/**
 * WebSocket Authentication Service
 * Handles authentication, authorization, and security for WebSocket connections
 */

import jwt from 'jsonwebtoken';
import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { config } from '@/config/config';
import { AuthUser, JWTPayload } from '@/types';
import { AuthenticatedSocket } from './WebSocketServer';

export interface AuthenticationResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
  permissions?: string[];
  sessionId?: string;
}

export interface SecurityPolicy {
  requireAuthentication: boolean;
  allowAnonymous: boolean;
  maxSessionDuration: number;
  requireTwoFactor: boolean;
  allowedOrigins: string[];
  blockedIPs: Set<string>;
  rateLimiting: {
    enabled: boolean;
    windowMs: number;
    maxAttempts: number;
  };
}

export interface SessionInfo {
  sessionId: string;
  userId: string;
  createdAt: number;
  lastActivity: number;
  ipAddress: string;
  userAgent?: string;
  permissions: string[];
  isValid: boolean;
}

export class WebSocketAuthService extends EventEmitter {
  private activeSessions: Map<string, SessionInfo> = new Map();
  private failedAttempts: Map<string, { count: number; lastAttempt: number }> = new Map();
  private securityPolicy: SecurityPolicy;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(policy?: Partial<SecurityPolicy>) {
    super();
    
    this.securityPolicy = {
      requireAuthentication: false, // Allow anonymous for public data
      allowAnonymous: true,
      maxSessionDuration: 24 * 60 * 60 * 1000, // 24 hours
      requireTwoFactor: false,
      allowedOrigins: [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'http://localhost:3000',
        'https://localhost:3000',
        'http://127.0.0.1:3000',
        'https://127.0.0.1:3000'
      ],
      blockedIPs: new Set(),
      rateLimiting: {
        enabled: true,
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxAttempts: 5
      },
      ...policy
    };

    this.startCleanupTask();
    logger.info('WebSocket Authentication Service initialized');
  }

  /**
   * Authenticate a WebSocket connection
   */
  public async authenticate(socket: AuthenticatedSocket): Promise<AuthenticationResult> {
    try {
      const ipAddress = socket.handshake.address;
      const origin = socket.handshake.headers.origin;
      const userAgent = socket.handshake.headers['user-agent'];

      // Check if IP is blocked
      if (this.securityPolicy.blockedIPs.has(ipAddress)) {
        logger.warn(`Blocked IP attempted connection: ${ipAddress}`);
        return {
          success: false,
          error: 'Access denied from this IP address'
        };
      }

      // Check origin if specified
      if (origin && !this.isOriginAllowed(origin)) {
        logger.warn(`Unauthorized origin: ${origin} from ${ipAddress}`);
        return {
          success: false,
          error: 'Unauthorized origin'
        };
      }

      // Check rate limiting for failed attempts
      if (this.isRateLimited(ipAddress)) {
        logger.warn(`Rate limited IP: ${ipAddress}`);
        return {
          success: false,
          error: 'Too many authentication attempts. Please try again later.'
        };
      }

      // Extract token from various sources
      const token = this.extractToken(socket);

      // Handle anonymous connections if allowed
      if (!token) {
        if (this.securityPolicy.allowAnonymous) {
          const sessionId = this.generateSessionId();
          logger.info(`Anonymous WebSocket connection accepted: ${socket.id} from ${ipAddress}`);
          
          return {
            success: true,
            sessionId,
            permissions: ['public_data', 'system_status']
          };
        } else {
          this.recordFailedAttempt(ipAddress);
          return {
            success: false,
            error: 'Authentication token required'
          };
        }
      }

      // Verify JWT token
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
      
      // Create user object (in production, fetch from database)
      const user: AuthUser = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role as 'user' | 'admin' | 'super_admin',
        isActive: true,
        isVerified: true
      };

      // Validate user status
      if (!user.isActive) {
        this.recordFailedAttempt(ipAddress);
        return {
          success: false,
          error: 'User account is inactive'
        };
      }

      if (!user.isVerified) {
        this.recordFailedAttempt(ipAddress);
        return {
          success: false,
          error: 'User account is not verified'
        };
      }

      // Generate session
      const sessionId = this.generateSessionId();
      const permissions = this.getUserPermissions(user);
      
      const sessionInfo: SessionInfo = {
        sessionId,
        userId: user.id,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        ipAddress,
        userAgent,
        permissions,
        isValid: true
      };

      this.activeSessions.set(sessionId, sessionInfo);

      // Clear failed attempts on successful auth
      this.failedAttempts.delete(ipAddress);

      logger.info(`WebSocket authentication successful: ${user.email} (${user.role}) from ${ipAddress}`);
      
      this.emit('authenticationSuccess', {
        userId: user.id,
        sessionId,
        ipAddress,
        userAgent,
        timestamp: Date.now()
      });

      return {
        success: true,
        user,
        sessionId,
        permissions
      };

    } catch (error) {
      const ipAddress = socket.handshake.address;
      this.recordFailedAttempt(ipAddress);
      
      logger.error(`WebSocket authentication failed from ${ipAddress}:`, error);
      
      this.emit('authenticationFailure', {
        ipAddress,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });

      return {
        success: false,
        error: 'Invalid authentication token'
      };
    }
  }

  /**
   * Validate an existing session
   */
  public validateSession(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;

    const now = Date.now();
    
    // Check if session has expired
    if (now - session.createdAt > this.securityPolicy.maxSessionDuration) {
      this.invalidateSession(sessionId);
      return false;
    }

    // Update last activity
    session.lastActivity = now;
    return session.isValid;
  }

  /**
   * Check if user has permission for a specific action
   */
  public hasPermission(sessionId: string, permission: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.isValid) return false;

    return session.permissions.includes(permission) || session.permissions.includes('*');
  }

  /**
   * Get user permissions based on role
   */
  private getUserPermissions(user: AuthUser): string[] {
    const basePermissions = [
      'public_data',
      'system_status',
      'market_data',
      'price_updates',
      'trading_signals'
    ];

    const userPermissions = [
      ...basePermissions,
      'user_portfolio',
      'user_trades',
      'user_positions',
      'user_alerts',
      'paper_trading'
    ];

    const adminPermissions = [
      ...userPermissions,
      'admin_alerts',
      'system_metrics',
      'all_trades',
      'risk_alerts',
      'user_management'
    ];

    const superAdminPermissions = [
      ...adminPermissions,
      '*' // All permissions
    ];

    switch (user.role) {
      case 'super_admin':
        return superAdminPermissions;
      case 'admin':
        return adminPermissions;
      case 'user':
        return userPermissions;
      default:
        return basePermissions;
    }
  }

  /**
   * Extract token from socket handshake
   */
  private extractToken(socket: AuthenticatedSocket): string | null {
    // Try multiple sources for the token
    return (
      socket.handshake.auth?.token ||
      socket.handshake.headers.authorization?.replace('Bearer ', '') ||
      socket.handshake.query?.token as string ||
      null
    );
  }

  /**
   * Check if origin is allowed
   */
  private isOriginAllowed(origin: string): boolean {
    // Allow localhost and configured origins
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return true;
    }

    return this.securityPolicy.allowedOrigins.some(allowed => 
      origin === allowed || origin.startsWith(allowed)
    );
  }

  /**
   * Check if IP is rate limited
   */
  private isRateLimited(ipAddress: string): boolean {
    if (!this.securityPolicy.rateLimiting.enabled) return false;

    const attempts = this.failedAttempts.get(ipAddress);
    if (!attempts) return false;

    const now = Date.now();
    const windowStart = now - this.securityPolicy.rateLimiting.windowMs;

    // Reset if outside window
    if (attempts.lastAttempt < windowStart) {
      this.failedAttempts.delete(ipAddress);
      return false;
    }

    return attempts.count >= this.securityPolicy.rateLimiting.maxAttempts;
  }

  /**
   * Record a failed authentication attempt
   */
  private recordFailedAttempt(ipAddress: string): void {
    const now = Date.now();
    const existing = this.failedAttempts.get(ipAddress);

    if (existing) {
      existing.count++;
      existing.lastAttempt = now;
    } else {
      this.failedAttempts.set(ipAddress, {
        count: 1,
        lastAttempt: now
      });
    }

    // Block IP if too many attempts
    if (existing && existing.count >= this.securityPolicy.rateLimiting.maxAttempts * 2) {
      this.securityPolicy.blockedIPs.add(ipAddress);
      logger.warn(`IP blocked due to excessive failed attempts: ${ipAddress}`);
      
      this.emit('ipBlocked', {
        ipAddress,
        attempts: existing.count,
        timestamp: now
      });
    }
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Invalidate a session
   */
  public invalidateSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.isValid = false;
      this.activeSessions.delete(sessionId);
      
      logger.info(`Session invalidated: ${sessionId} for user ${session.userId}`);
      
      this.emit('sessionInvalidated', {
        sessionId,
        userId: session.userId,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Invalidate all sessions for a user
   */
  public invalidateUserSessions(userId: string): number {
    let count = 0;
    
    for (const [sessionId, session] of this.activeSessions) {
      if (session.userId === userId) {
        this.invalidateSession(sessionId);
        count++;
      }
    }

    logger.info(`Invalidated ${count} sessions for user ${userId}`);
    return count;
  }

  /**
   * Get session information
   */
  public getSessionInfo(sessionId: string): SessionInfo | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Get all active sessions
   */
  public getActiveSessions(): SessionInfo[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get sessions for a specific user
   */
  public getUserSessions(userId: string): SessionInfo[] {
    return Array.from(this.activeSessions.values())
      .filter(session => session.userId === userId);
  }

  /**
   * Block an IP address
   */
  public blockIP(ipAddress: string, reason?: string): void {
    this.securityPolicy.blockedIPs.add(ipAddress);
    logger.warn(`IP blocked: ${ipAddress} - ${reason || 'Manual block'}`);
    
    this.emit('ipBlocked', {
      ipAddress,
      reason,
      timestamp: Date.now()
    });
  }

  /**
   * Unblock an IP address
   */
  public unblockIP(ipAddress: string): void {
    this.securityPolicy.blockedIPs.delete(ipAddress);
    this.failedAttempts.delete(ipAddress);
    logger.info(`IP unblocked: ${ipAddress}`);
    
    this.emit('ipUnblocked', {
      ipAddress,
      timestamp: Date.now()
    });
  }

  /**
   * Get security statistics
   */
  public getSecurityStats() {
    const now = Date.now();
    const windowStart = now - this.securityPolicy.rateLimiting.windowMs;
    
    const recentFailures = Array.from(this.failedAttempts.values())
      .filter(attempt => attempt.lastAttempt > windowStart)
      .reduce((sum, attempt) => sum + attempt.count, 0);

    return {
      activeSessions: this.activeSessions.size,
      blockedIPs: this.securityPolicy.blockedIPs.size,
      recentFailedAttempts: recentFailures,
      policy: {
        requireAuthentication: this.securityPolicy.requireAuthentication,
        allowAnonymous: this.securityPolicy.allowAnonymous,
        maxSessionDuration: this.securityPolicy.maxSessionDuration,
        rateLimitingEnabled: this.securityPolicy.rateLimiting.enabled
      },
      timestamp: now
    };
  }

  /**
   * Start cleanup task for expired sessions
   */
  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Clean up expired sessions and failed attempts
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let expiredSessions = 0;
    let cleanedAttempts = 0;

    // Clean expired sessions
    for (const [sessionId, session] of this.activeSessions) {
      if (now - session.createdAt > this.securityPolicy.maxSessionDuration) {
        this.invalidateSession(sessionId);
        expiredSessions++;
      }
    }

    // Clean old failed attempts
    const windowStart = now - this.securityPolicy.rateLimiting.windowMs;
    for (const [ip, attempts] of this.failedAttempts) {
      if (attempts.lastAttempt < windowStart) {
        this.failedAttempts.delete(ip);
        cleanedAttempts++;
      }
    }

    if (expiredSessions > 0 || cleanedAttempts > 0) {
      logger.debug(`Cleanup completed - Expired sessions: ${expiredSessions}, Cleaned attempts: ${cleanedAttempts}`);
    }
  }

  /**
   * Shutdown the authentication service
   */
  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Invalidate all sessions
    const sessionCount = this.activeSessions.size;
    this.activeSessions.clear();
    this.failedAttempts.clear();

    logger.info(`WebSocket Authentication Service shutdown - ${sessionCount} sessions invalidated`);
  }
}