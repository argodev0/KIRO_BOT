import { Response } from 'express';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import { PrismaClient } from '@prisma/client';
import { UserRole } from '@/types/auth';

const prisma = new PrismaClient();

export class UserController {
  /**
   * Get user profile
   */
  static async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
          lastLoginAt: true,
          riskSettings: true
        }
      });

      if (!user) {
        res.status(404).json({
          error: 'USER_NOT_FOUND',
          message: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        data: user
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
   * Update user profile
   */
  static async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { firstName, lastName, email } = req.body;
      const updateData: any = {};

      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (email !== undefined) {
        // Check if email is already taken
        const existingUser = await prisma.user.findFirst({
          where: {
            email: email.toLowerCase(),
            id: { not: req.user.userId }
          }
        });

        if (existingUser) {
          res.status(409).json({
            error: 'EMAIL_TAKEN',
            message: 'Email is already taken'
          });
          return;
        }

        updateData.email = email.toLowerCase();
        updateData.isVerified = false; // Require re-verification for email changes
      }

      const updatedUser = await prisma.user.update({
        where: { id: req.user.userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
          lastLoginAt: true
        }
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser
      });
    } catch (error) {
      logger.error('Update profile error:', error);
      res.status(500).json({
        error: 'PROFILE_UPDATE_FAILED',
        message: 'Failed to update profile'
      });
    }
  }

  /**
   * Get user settings
   */
  static async getSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
          riskSettings: true,
          apiKeys: true
        }
      });

      if (!user) {
        res.status(404).json({
          error: 'USER_NOT_FOUND',
          message: 'User not found'
        });
        return;
      }

      // Don't expose actual API keys, just metadata
      const apiKeysMetadata = user.apiKeys ? 
        Object.keys(user.apiKeys as any).map(exchange => ({
          exchange,
          configured: true,
          lastUpdated: new Date() // In real implementation, track this
        })) : [];

      res.json({
        success: true,
        data: {
          riskSettings: user.riskSettings || {},
          apiKeys: apiKeysMetadata
        }
      });
    } catch (error) {
      logger.error('Get settings error:', error);
      res.status(500).json({
        error: 'SETTINGS_FETCH_FAILED',
        message: 'Failed to fetch user settings'
      });
    }
  }

  /**
   * Update risk settings
   */
  static async updateRiskSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const riskSettings = req.body;

      // Validate risk settings
      const validSettings = {
        maxRiskPerTrade: Math.min(Math.max(riskSettings.maxRiskPerTrade || 3, 0.1), 10),
        maxDailyLoss: Math.min(Math.max(riskSettings.maxDailyLoss || 5, 1), 20),
        maxTotalExposure: Math.min(Math.max(riskSettings.maxTotalExposure || 5, 1), 10),
        stopLossPercentage: Math.min(Math.max(riskSettings.stopLossPercentage || 2, 0.5), 10),
        takeProfitRatio: Math.min(Math.max(riskSettings.takeProfitRatio || 2, 1), 10)
      };

      await prisma.user.update({
        where: { id: req.user.userId },
        data: { riskSettings: validSettings }
      });

      res.json({
        success: true,
        message: 'Risk settings updated successfully',
        data: validSettings
      });
    } catch (error) {
      logger.error('Update risk settings error:', error);
      res.status(500).json({
        error: 'RISK_SETTINGS_UPDATE_FAILED',
        message: 'Failed to update risk settings'
      });
    }
  }

  /**
   * Update API keys
   */
  static async updateApiKeys(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { exchange, apiKey, apiSecret, passphrase } = req.body;

      if (!['binance', 'kucoin'].includes(exchange)) {
        res.status(400).json({
          error: 'INVALID_EXCHANGE',
          message: 'Unsupported exchange'
        });
        return;
      }

      // Get current API keys
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { apiKeys: true }
      });

      const currentApiKeys = (user?.apiKeys as any) || {};

      // Update API keys (in real implementation, encrypt these)
      const updatedApiKeys = {
        ...currentApiKeys,
        [exchange]: {
          apiKey: apiKey ? `***${apiKey.slice(-4)}` : undefined, // Mask for storage
          apiSecret: apiSecret ? '***ENCRYPTED***' : undefined,
          passphrase: passphrase ? '***ENCRYPTED***' : undefined,
          updatedAt: new Date().toISOString()
        }
      };

      await prisma.user.update({
        where: { id: req.user.userId },
        data: { apiKeys: updatedApiKeys }
      });

      res.json({
        success: true,
        message: 'API keys updated successfully'
      });
    } catch (error) {
      logger.error('Update API keys error:', error);
      res.status(500).json({
        error: 'API_KEYS_UPDATE_FAILED',
        message: 'Failed to update API keys'
      });
    }
  }

  /**
   * Get all users (admin only)
   */
  static async getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { page = 1, limit = 20, role, isActive } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where: any = {};
      if (role) where.role = role;
      if (isActive !== undefined) where.isActive = isActive === 'true';

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            isVerified: true,
            createdAt: true,
            lastLoginAt: true
          }
        }),
        prisma.user.count({ where })
      ]);

      res.json({
        success: true,
        data: users,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
          hasNext: skip + Number(limit) < total,
          hasPrev: Number(page) > 1
        }
      });
    } catch (error) {
      logger.error('Get users error:', error);
      res.status(500).json({
        error: 'USERS_FETCH_FAILED',
        message: 'Failed to fetch users'
      });
    }
  }

  /**
   * Update user role (admin only)
   */
  static async updateUserRole(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const { role } = req.body;

      if (!Object.values(UserRole).includes(role)) {
        res.status(400).json({
          error: 'INVALID_ROLE',
          message: 'Invalid user role'
        });
        return;
      }

      // Prevent self-demotion from SUPER_ADMIN
      if (req.user.userId === id && req.user.role === UserRole.SUPER_ADMIN && role !== UserRole.SUPER_ADMIN) {
        res.status(400).json({
          error: 'SELF_DEMOTION_FORBIDDEN',
          message: 'Cannot demote yourself from Super Admin'
        });
        return;
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { role },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          isVerified: true
        }
      });

      res.json({
        success: true,
        message: 'User role updated successfully',
        data: updatedUser
      });
    } catch (error) {
      logger.error('Update user role error:', error);
      res.status(500).json({
        error: 'USER_ROLE_UPDATE_FAILED',
        message: 'Failed to update user role'
      });
    }
  }

  /**
   * Deactivate user (admin only)
   */
  static async deactivateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { id } = req.params;

      // Prevent self-deactivation
      if (req.user.userId === id) {
        res.status(400).json({
          error: 'SELF_DEACTIVATION_FORBIDDEN',
          message: 'Cannot deactivate your own account'
        });
        return;
      }

      await prisma.user.update({
        where: { id },
        data: { isActive: false }
      });

      // Invalidate all refresh tokens for the user
      await prisma.refreshToken.deleteMany({
        where: { userId: id }
      });

      res.json({
        success: true,
        message: 'User deactivated successfully'
      });
    } catch (error) {
      logger.error('Deactivate user error:', error);
      res.status(500).json({
        error: 'USER_DEACTIVATION_FAILED',
        message: 'Failed to deactivate user'
      });
    }
  }

  /**
   * Get audit logs
   */
  static async getAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const { page = 1, limit = 20, userId, action } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where: any = {};
      
      // Regular users can only see their own logs
      if (req.user.role === UserRole.USER) {
        where.userId = req.user.userId;
      } else if (userId) {
        where.userId = userId;
      }
      
      if (action) where.action = action;

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }),
        prisma.auditLog.count({ where })
      ]);

      res.json({
        success: true,
        data: logs,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
          hasNext: skip + Number(limit) < total,
          hasPrev: Number(page) > 1
        }
      });
    } catch (error) {
      logger.error('Get audit logs error:', error);
      res.status(500).json({
        error: 'AUDIT_LOGS_FETCH_FAILED',
        message: 'Failed to fetch audit logs'
      });
    }
  }
}