import { Request, Response, NextFunction } from 'express';
import { AuthService } from '@/services/AuthService';
import { logger } from '@/utils/logger';
import { UserRole, Permission, JwtPayload } from '@/types/auth';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

/**
 * JWT Authentication middleware
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Access token required'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      const decoded = await AuthService.verifyToken(token);
      req.user = decoded;
      next();
    } catch (error) {
      res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      });
      return;
    }
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Authentication failed'
    });
  }
};

/**
 * Role-based authorization middleware
 */
export const authorize = (allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
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
 * Permission-based authorization middleware
 */
export const requirePermission = (permission: Permission) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
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
 * Optional authentication middleware (doesn't fail if no token)
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = await AuthService.verifyToken(token);
        req.user = decoded;
      } catch (error) {
        // Ignore token errors for optional auth
        logger.debug('Optional auth token verification failed:', error);
      }
    }
    
    next();
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    next(); // Continue without authentication
  }
};

/**
 * Admin only middleware
 */
export const adminOnly = authorize([UserRole.ADMIN, UserRole.SUPER_ADMIN]);

/**
 * Super admin only middleware
 */
export const superAdminOnly = authorize([UserRole.SUPER_ADMIN]);

/**
 * Self or admin middleware (user can access their own resources or admin can access any)
 */
export const selfOrAdmin = (getUserId: (req: AuthenticatedRequest) => string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
      return;
    }

    const userRole = req.user.role as UserRole;
    const requestedUserId = getUserId(req);
    
    // Allow if user is accessing their own resource or if user is admin
    if (req.user.userId === requestedUserId || 
        userRole === UserRole.ADMIN || 
        userRole === UserRole.SUPER_ADMIN) {
      next();
      return;
    }

    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Can only access your own resources'
    });
  };
};