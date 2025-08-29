import { Router, Request, Response } from 'express';
import { AuthService } from '@/services/AuthService';
import { SessionManagementService } from '@/services/SessionManagementService';
import { logger } from '@/utils/logger';
import { 
  LoginRequest, 
  RegisterRequest, 
  RefreshTokenRequest,
  ChangePasswordRequest,
  AuthenticatedRequest
} from '@/types/auth';
import { authRateLimit, passwordResetRateLimit, registrationRateLimit } from '@/middleware/rateLimiter';
import { validateRequest } from '@/middleware/security';

const router = Router();

// Apply rate limiting to auth routes
router.use(authRateLimit);

/**
 * Register new user
 */
router.post('/register', registrationRateLimit, validateRequest, async (req: Request, res: Response) => {
  try {
    const registerData: RegisterRequest = req.body;

    // Validate required fields
    if (!registerData.email || !registerData.password) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Email and password are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(registerData.email)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid email format'
      });
    }

    // Validate password strength
    if (registerData.password.length < 8) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Password must be at least 8 characters long'
      });
    }

    const authResponse = await AuthService.register(registerData);

    // Create session for the new user
    const sessionService = req.app.get('sessionService') as SessionManagementService;
    if (sessionService) {
      const session = await sessionService.createSession(
        authResponse.user.id,
        req,
        { registrationTime: new Date(), authMethod: 'registration' }
      );
      sessionService.setSessionCookie(res, session.id);
    }

    logger.info(`User registered successfully: ${authResponse.user.email}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: authResponse
    });
  } catch (error: any) {
    logger.error('Registration error:', error);
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: 'USER_EXISTS',
        message: 'User already exists with this email'
      });
    }

    res.status(500).json({
      error: 'REGISTRATION_FAILED',
      message: 'Failed to register user'
    });
  }
});

/**
 * Login user
 */
router.post('/login', validateRequest, async (req: Request, res: Response) => {
  const accountLockout = (req as any).accountLockout;
  const identifier = `${req.ip}:${req.body?.email || ''}`;
  
  try {
    const loginData: LoginRequest = req.body;

    // Validate required fields
    if (!loginData.email || !loginData.password) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Email and password are required'
      });
    }

    const authResponse = await AuthService.login(loginData);

    // Record successful login (clears failed attempts)
    if (accountLockout) {
      accountLockout.recordSuccessfulAttempt(identifier);
    }

    // Create session for the logged-in user
    const sessionService = req.app.get('sessionService') as SessionManagementService;
    if (sessionService) {
      const session = await sessionService.createSession(
        authResponse.user.id,
        req,
        { loginTime: new Date(), authMethod: 'login' }
      );
      sessionService.setSessionCookie(res, session.id);
    }

    logger.info(`User logged in successfully: ${authResponse.user.email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: authResponse
    });
  } catch (error: any) {
    logger.error('Login error:', error);
    
    if (error.message.includes('Invalid credentials')) {
      // Record failed login attempt
      if (accountLockout) {
        const isAllowed = accountLockout.recordFailedAttempt(identifier);
        if (!isAllowed) {
          const lockoutStatus = accountLockout.getLockoutStatus(identifier);
          const retryAfter = Math.ceil(lockoutStatus.remainingTime / 1000);
          
          res.set('Retry-After', retryAfter.toString());
          return res.status(423).json({
            error: 'ACCOUNT_LOCKED',
            message: 'Account is temporarily locked due to too many failed attempts',
            retryAfter,
            remainingTime: lockoutStatus.remainingTime
          });
        }
      }
      
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    }

    res.status(500).json({
      error: 'LOGIN_FAILED',
      message: 'Failed to login'
    });
  }
});

/**
 * Refresh access token
 */
router.post('/refresh', validateRequest, async (req: Request, res: Response) => {
  try {
    const { refreshToken }: RefreshTokenRequest = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Refresh token is required'
      });
    }

    const authResponse = await AuthService.refreshToken(refreshToken);

    logger.info(`Token refreshed for user: ${authResponse.user.email}`);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: authResponse
    });
  } catch (error: any) {
    logger.error('Token refresh error:', error);
    
    if (error.message.includes('Invalid') || error.message.includes('expired')) {
      return res.status(401).json({
        error: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or expired refresh token'
      });
    }

    res.status(500).json({
      error: 'TOKEN_REFRESH_FAILED',
      message: 'Failed to refresh token'
    });
  }
});

/**
 * Logout user
 */
router.post('/logout', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { refreshToken } = req.body;
    const sessionId = req.cookies?.sessionId;

    // Logout from JWT system
    if (refreshToken) {
      await AuthService.logout(refreshToken);
    }

    // Destroy session
    const sessionService = req.app.get('sessionService') as SessionManagementService;
    if (sessionService && sessionId) {
      await sessionService.destroySession(sessionId);
      sessionService.clearSessionCookie(res);
    }

    logger.info(`User logged out: ${req.user?.email || 'unknown'}`);

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error: any) {
    logger.error('Logout error:', error);
    res.status(500).json({
      error: 'LOGOUT_FAILED',
      message: 'Failed to logout'
    });
  }
});

/**
 * Change password (requires authentication)
 */
router.post('/change-password', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const changePasswordData: ChangePasswordRequest = req.body;

    // Validate required fields
    if (!changePasswordData.currentPassword || !changePasswordData.newPassword) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Current password and new password are required'
      });
    }

    // Validate new password strength
    if (changePasswordData.newPassword.length < 8) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'New password must be at least 8 characters long'
      });
    }

    await AuthService.changePassword(req.user.userId, changePasswordData);

    // Destroy all sessions for this user (force re-login)
    const sessionService = req.app.get('sessionService') as SessionManagementService;
    if (sessionService) {
      await sessionService.destroyUserSessions(req.user.userId);
      sessionService.clearSessionCookie(res);
    }

    logger.info(`Password changed for user: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Password changed successfully. Please login again.'
    });
  } catch (error: any) {
    logger.error('Change password error:', error);
    
    if (error.message.includes('incorrect')) {
      return res.status(400).json({
        error: 'INVALID_PASSWORD',
        message: 'Current password is incorrect'
      });
    }

    res.status(500).json({
      error: 'PASSWORD_CHANGE_FAILED',
      message: 'Failed to change password'
    });
  }
});

/**
 * Get current user profile
 */
router.get('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    // Get user details from database
    const prisma = req.app.get('prisma');
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isVerified: true,
        createdAt: true,
        lastLoginAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    // Get session information
    const sessionService = req.app.get('sessionService') as SessionManagementService;
    let sessions = [];
    if (sessionService) {
      sessions = await sessionService.getUserSessions(req.user.userId);
    }

    res.json({
      success: true,
      data: {
        user,
        sessions: sessions.map(session => ({
          id: session.id,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          isCurrent: session.id === req.session?.id
        })),
        authMethod: req.authMethod,
        securityContext: req.securityContext
      }
    });
  } catch (error: any) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      error: 'PROFILE_FETCH_FAILED',
      message: 'Failed to fetch user profile'
    });
  }
});

/**
 * Get user sessions
 */
router.get('/sessions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const sessionService = req.app.get('sessionService') as SessionManagementService;
    if (!sessionService) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Session service not available'
      });
    }

    const sessions = await sessionService.getUserSessions(req.user.userId);

    res.json({
      success: true,
      data: {
        sessions: sessions.map(session => ({
          id: session.id,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          expiresAt: session.expiresAt,
          isCurrent: session.id === req.session?.id
        }))
      }
    });
  } catch (error: any) {
    logger.error('Get sessions error:', error);
    res.status(500).json({
      error: 'SESSIONS_FETCH_FAILED',
      message: 'Failed to fetch user sessions'
    });
  }
});

/**
 * Revoke a specific session
 */
router.delete('/sessions/:sessionId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const { sessionId } = req.params;
    const sessionService = req.app.get('sessionService') as SessionManagementService;
    
    if (!sessionService) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Session service not available'
      });
    }

    // Verify the session belongs to the current user
    const session = await sessionService.getSession(sessionId);
    if (!session || session.userId !== req.user.userId) {
      return res.status(404).json({
        error: 'SESSION_NOT_FOUND',
        message: 'Session not found'
      });
    }

    await sessionService.destroySession(sessionId);

    logger.info(`Session revoked: ${sessionId} by user: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Session revoked successfully'
    });
  } catch (error: any) {
    logger.error('Revoke session error:', error);
    res.status(500).json({
      error: 'SESSION_REVOKE_FAILED',
      message: 'Failed to revoke session'
    });
  }
});

/**
 * Revoke all sessions except current
 */
router.delete('/sessions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const sessionService = req.app.get('sessionService') as SessionManagementService;
    if (!sessionService) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Session service not available'
      });
    }

    const currentSessionId = req.session?.id;
    const sessions = await sessionService.getUserSessions(req.user.userId);

    // Revoke all sessions except the current one
    for (const session of sessions) {
      if (session.id !== currentSessionId) {
        await sessionService.destroySession(session.id);
      }
    }

    logger.info(`All sessions revoked except current for user: ${req.user.email}`);

    res.json({
      success: true,
      message: 'All other sessions revoked successfully'
    });
  } catch (error: any) {
    logger.error('Revoke all sessions error:', error);
    res.status(500).json({
      error: 'SESSIONS_REVOKE_FAILED',
      message: 'Failed to revoke sessions'
    });
  }
});

/**
 * Verify token endpoint
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Token is required'
      });
    }

    const decoded = await AuthService.verifyToken(token);

    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role
      }
    });
  } catch (error: any) {
    logger.error('Token verification error:', error);
    res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Invalid or expired token'
    });
  }
});

export default router;