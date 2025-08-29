import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import { config } from '@/config/config';
import { AuthenticatedRequest } from '@/types/auth';
import crypto from 'crypto';

export interface SessionData {
  id: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface SessionOptions {
  maxAge: number; // Session duration in milliseconds
  maxSessions: number; // Maximum concurrent sessions per user
  secure: boolean; // Require HTTPS
  httpOnly: boolean; // Prevent client-side access
  sameSite: 'strict' | 'lax' | 'none';
  rolling: boolean; // Extend session on activity
}

export class SessionManagementService {
  private prisma: PrismaClient;
  private options: SessionOptions;
  private activeSessions: Map<string, SessionData> = new Map();

  constructor(prisma: PrismaClient, options?: Partial<SessionOptions>) {
    this.prisma = prisma;
    this.options = {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      maxSessions: 5, // 5 concurrent sessions per user
      secure: config.env === 'production',
      httpOnly: true,
      sameSite: 'strict',
      rolling: true,
      ...options
    };

    // Clean up expired sessions every hour
    setInterval(() => {
      this.cleanupExpiredSessions().catch(error => {
        logger.error('Session cleanup error:', error);
      });
    }, 60 * 60 * 1000);
  }

  /**
   * Create a new session
   */
  async createSession(
    userId: string,
    req: Request,
    metadata?: Record<string, any>
  ): Promise<SessionData> {
    try {
      const sessionId = this.generateSessionId();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.options.maxAge);
      const ipAddress = this.getClientIP(req);
      const userAgent = req.get('User-Agent') || '';

      // Check if user has too many active sessions
      await this.enforceSessionLimit(userId);

      const sessionData: SessionData = {
        id: sessionId,
        userId,
        ipAddress,
        userAgent,
        createdAt: now,
        lastActivity: now,
        expiresAt,
        isActive: true,
        metadata
      };

      // Store in database
      await this.prisma.userSession.create({
        data: {
          id: sessionId,
          userId,
          ipAddress,
          userAgent,
          createdAt: now,
          lastActivity: now,
          expiresAt,
          isActive: true,
          metadata: metadata ? JSON.stringify(metadata) : null
        }
      });

      // Store in memory cache
      this.activeSessions.set(sessionId, sessionData);

      logger.info(`Session created for user ${userId}: ${sessionId}`);
      return sessionData;
    } catch (error) {
      logger.error('Error creating session:', error);
      throw error;
    }
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      // Check memory cache first
      const cachedSession = this.activeSessions.get(sessionId);
      if (cachedSession && cachedSession.expiresAt > new Date()) {
        return cachedSession;
      }

      // Fetch from database
      const session = await this.prisma.userSession.findUnique({
        where: { id: sessionId }
      });

      if (!session || !session.isActive || session.expiresAt < new Date()) {
        return null;
      }

      const sessionData: SessionData = {
        id: session.id,
        userId: session.userId,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        expiresAt: session.expiresAt,
        isActive: session.isActive,
        metadata: session.metadata ? JSON.parse(session.metadata) : undefined
      };

      // Update memory cache
      this.activeSessions.set(sessionId, sessionData);

      return sessionData;
    } catch (error) {
      logger.error('Error getting session:', error);
      return null;
    }
  }

  /**
   * Update session activity
   */
  async updateActivity(sessionId: string): Promise<void> {
    try {
      const now = new Date();
      let expiresAt = now;

      if (this.options.rolling) {
        expiresAt = new Date(now.getTime() + this.options.maxAge);
      }

      // Update database
      await this.prisma.userSession.update({
        where: { id: sessionId },
        data: {
          lastActivity: now,
          ...(this.options.rolling && { expiresAt })
        }
      });

      // Update memory cache
      const cachedSession = this.activeSessions.get(sessionId);
      if (cachedSession) {
        cachedSession.lastActivity = now;
        if (this.options.rolling) {
          cachedSession.expiresAt = expiresAt;
        }
      }
    } catch (error) {
      logger.error('Error updating session activity:', error);
    }
  }

  /**
   * Destroy session
   */
  async destroySession(sessionId: string): Promise<void> {
    try {
      // Remove from database
      await this.prisma.userSession.update({
        where: { id: sessionId },
        data: { isActive: false }
      });

      // Remove from memory cache
      this.activeSessions.delete(sessionId);

      logger.info(`Session destroyed: ${sessionId}`);
    } catch (error) {
      logger.error('Error destroying session:', error);
    }
  }

  /**
   * Destroy all sessions for a user
   */
  async destroyUserSessions(userId: string): Promise<void> {
    try {
      // Update database
      await this.prisma.userSession.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false }
      });

      // Remove from memory cache
      for (const [sessionId, session] of this.activeSessions.entries()) {
        if (session.userId === userId) {
          this.activeSessions.delete(sessionId);
        }
      }

      logger.info(`All sessions destroyed for user: ${userId}`);
    } catch (error) {
      logger.error('Error destroying user sessions:', error);
    }
  }

  /**
   * Get active sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionData[]> {
    try {
      const sessions = await this.prisma.userSession.findMany({
        where: {
          userId,
          isActive: true,
          expiresAt: { gt: new Date() }
        },
        orderBy: { lastActivity: 'desc' }
      });

      return sessions.map(session => ({
        id: session.id,
        userId: session.userId,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        expiresAt: session.expiresAt,
        isActive: session.isActive,
        metadata: session.metadata ? JSON.parse(session.metadata) : undefined
      }));
    } catch (error) {
      logger.error('Error getting user sessions:', error);
      return [];
    }
  }

  /**
   * Session middleware
   */
  middleware() {
    return async (req: any, res: Response, next: NextFunction): Promise<void> => {
      try {
        const sessionId = req.cookies?.sessionId || req.headers['x-session-id'];

        if (sessionId) {
          const session = await this.getSession(sessionId as string);
          
          if (session) {
            // Validate session
            if (this.validateSession(session, req as any)) {
              req.session = session;
              await this.updateActivity(sessionId as string);
            } else {
              // Invalid session, destroy it
              await this.destroySession(sessionId as string);
              this.clearSessionCookie(res);
            }
          }
        }

        next();
      } catch (error) {
        logger.error('Session middleware error:', error);
        next();
      }
    };
  }

  /**
   * Require session middleware
   */
  requireSession() {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.session) {
        res.status(401).json({
          error: 'SESSION_REQUIRED',
          message: 'Valid session required'
        });
        return;
      }
      next();
    };
  }

  /**
   * Set session cookie
   */
  setSessionCookie(res: Response, sessionId: string): void {
    res.cookie('sessionId', sessionId, {
      maxAge: this.options.maxAge,
      secure: this.options.secure,
      httpOnly: this.options.httpOnly,
      sameSite: this.options.sameSite,
      path: '/'
    });
  }

  /**
   * Clear session cookie
   */
  clearSessionCookie(res: Response): void {
    res.clearCookie('sessionId', {
      secure: this.options.secure,
      httpOnly: this.options.httpOnly,
      sameSite: this.options.sameSite,
      path: '/'
    });
  }

  /**
   * Clean up expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    try {
      const now = new Date();

      // Clean up database
      const result = await this.prisma.userSession.updateMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { isActive: false }
          ]
        },
        data: { isActive: false }
      });

      // Clean up memory cache
      for (const [sessionId, session] of this.activeSessions.entries()) {
        if (session.expiresAt < now || !session.isActive) {
          this.activeSessions.delete(sessionId);
        }
      }

      logger.info(`Cleaned up ${result.count} expired sessions`);
    } catch (error) {
      logger.error('Session cleanup error:', error);
    }
  }

  /**
   * Enforce session limit per user
   */
  private async enforceSessionLimit(userId: string): Promise<void> {
    try {
      const activeSessions = await this.getUserSessions(userId);

      if (activeSessions.length >= this.options.maxSessions) {
        // Remove oldest sessions
        const sessionsToRemove = activeSessions
          .sort((a, b) => a.lastActivity.getTime() - b.lastActivity.getTime())
          .slice(0, activeSessions.length - this.options.maxSessions + 1);

        for (const session of sessionsToRemove) {
          await this.destroySession(session.id);
        }

        logger.info(`Enforced session limit for user ${userId}, removed ${sessionsToRemove.length} sessions`);
      }
    } catch (error) {
      logger.error('Error enforcing session limit:', error);
    }
  }

  /**
   * Validate session
   */
  private validateSession(session: SessionData, req: Request): boolean {
    const now = new Date();

    // Check expiration
    if (session.expiresAt < now) {
      return false;
    }

    // Check if session is active
    if (!session.isActive) {
      return false;
    }

    // Validate IP address (optional strict mode)
    if (config.env === 'production') {
      const currentIP = this.getClientIP(req);
      if (session.ipAddress !== currentIP) {
        logger.warn(`Session IP mismatch: ${session.id} (${session.ipAddress} vs ${currentIP})`);
        // In production, you might want to invalidate the session
        // return false;
      }
    }

    return true;
  }

  /**
   * Generate secure session ID
   */
  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
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

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    totalActiveSessions: number;
    sessionsPerUser: Record<string, number>;
    memoryCache: number;
    oldestSession: Date | null;
    newestSession: Date | null;
  }> {
    try {
      const activeSessions = await this.prisma.userSession.findMany({
        where: {
          isActive: true,
          expiresAt: { gt: new Date() }
        },
        select: {
          userId: true,
          createdAt: true
        }
      });

      const sessionsPerUser: Record<string, number> = {};
      let oldestSession: Date | null = null;
      let newestSession: Date | null = null;

      for (const session of activeSessions) {
        sessionsPerUser[session.userId] = (sessionsPerUser[session.userId] || 0) + 1;
        
        if (!oldestSession || session.createdAt < oldestSession) {
          oldestSession = session.createdAt;
        }
        
        if (!newestSession || session.createdAt > newestSession) {
          newestSession = session.createdAt;
        }
      }

      return {
        totalActiveSessions: activeSessions.length,
        sessionsPerUser,
        memoryCache: this.activeSessions.size,
        oldestSession,
        newestSession
      };
    } catch (error) {
      logger.error('Error getting session stats:', error);
      return {
        totalActiveSessions: 0,
        sessionsPerUser: {},
        memoryCache: this.activeSessions.size,
        oldestSession: null,
        newestSession: null
      };
    }
  }
}