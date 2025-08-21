import { Request, Response } from 'express';
import { AuthService } from '@/services/AuthService';
import { logger } from '@/utils/logger';
import { AuthenticatedRequest } from '@/middleware/auth';
import {
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  ChangePasswordRequest,

} from '@/types/auth';

export class AuthController {
  /**
   * Register a new user
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const data: RegisterRequest = req.body;
      const result = await AuthService.register(data);
      
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result
      });
    } catch (error) {
      logger.error('Registration error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          res.status(409).json({
            error: 'USER_EXISTS',
            message: error.message
          });
          return;
        }
      }
      
      res.status(400).json({
        error: 'REGISTRATION_FAILED',
        message: 'Failed to register user'
      });
    }
  }

  /**
   * Login user
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const data: LoginRequest = req.body;
      const result = await AuthService.login(data);
      
      res.json({
        success: true,
        message: 'Login successful',
        data: result
      });
    } catch (error) {
      logger.error('Login error:', error);
      
      res.status(401).json({
        error: 'LOGIN_FAILED',
        message: 'Invalid credentials'
      });
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken }: RefreshTokenRequest = req.body;
      const result = await AuthService.refreshToken(refreshToken);
      
      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: result
      });
    } catch (error) {
      logger.error('Token refresh error:', error);
      
      res.status(401).json({
        error: 'TOKEN_REFRESH_FAILED',
        message: 'Invalid or expired refresh token'
      });
    }
  }

  /**
   * Logout user
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken }: RefreshTokenRequest = req.body;
      await AuthService.logout(refreshToken);
      
      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      logger.error('Logout error:', error);
      
      res.status(400).json({
        error: 'LOGOUT_FAILED',
        message: 'Failed to logout'
      });
    }
  }

  /**
   * Get current user profile
   */
  static async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required'
        });
        return;
      }

      // In a real implementation, you might want to fetch fresh user data from database
      res.json({
        success: true,
        data: {
          user: req.user,
          permissions: AuthService.getUserPermissions(req.user.role as any)
        }
      });
    } catch (error) {
      logger.error('Get profile error:', error);
      
      res.status(500).json({
        error: 'PROFILE_FETCH_FAILED',
        message: 'Failed to fetch user profile'
      });
    }
  }

  /**
   * Change password
   */
  static async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required'
        });
        return;
      }

      const data: ChangePasswordRequest = req.body;
      await AuthService.changePassword(req.user.userId, data);
      
      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      logger.error('Change password error:', error);
      
      if (error instanceof Error && error.message.includes('incorrect')) {
        res.status(400).json({
          error: 'INVALID_PASSWORD',
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        error: 'PASSWORD_CHANGE_FAILED',
        message: 'Failed to change password'
      });
    }
  }

  /**
   * Request password reset
   */
  static async requestPasswordReset(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;
      
      // TODO: Implement password reset email sending
      // For now, just log the request
      logger.info(`Password reset requested for email: ${email}`);
      
      // Always return success to prevent email enumeration
      res.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      });
    } catch (error) {
      logger.error('Password reset request error:', error);
      
      res.status(500).json({
        error: 'PASSWORD_RESET_FAILED',
        message: 'Failed to process password reset request'
      });
    }
  }

  /**
   * Confirm password reset
   */
  static async confirmPasswordReset(_req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement password reset token verification and password update
      logger.info('Password reset confirmation requested');
      
      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      logger.error('Password reset confirmation error:', error);
      
      res.status(400).json({
        error: 'PASSWORD_RESET_FAILED',
        message: 'Invalid or expired reset token'
      });
    }
  }

  /**
   * Verify token (for client-side token validation)
   */
  static async verifyToken(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'INVALID_TOKEN',
          message: 'Invalid token'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Token is valid',
        data: {
          user: req.user,
          permissions: AuthService.getUserPermissions(req.user.role as any)
        }
      });
    } catch (error) {
      logger.error('Token verification error:', error);
      
      res.status(401).json({
        error: 'TOKEN_VERIFICATION_FAILED',
        message: 'Token verification failed'
      });
    }
  }

  /**
   * Get user permissions
   */
  static async getPermissions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required'
        });
        return;
      }

      const permissions = AuthService.getUserPermissions(req.user.role as any);
      
      res.json({
        success: true,
        data: {
          permissions,
          role: req.user.role
        }
      });
    } catch (error) {
      logger.error('Get permissions error:', error);
      
      res.status(500).json({
        error: 'PERMISSIONS_FETCH_FAILED',
        message: 'Failed to fetch user permissions'
      });
    }
  }
}