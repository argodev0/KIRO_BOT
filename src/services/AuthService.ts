import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { config } from '@/config/config';
import { logger } from '@/utils/logger';
import {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  JwtPayload,
  ChangePasswordRequest,
  UserRole,
  Permission
} from '@/types/auth';

const prisma = new PrismaClient();

export class AuthService {
  private static readonly SALT_ROUNDS = config.security.bcryptRounds;
  private static readonly JWT_SECRET = config.jwt.secret;
  private static readonly JWT_EXPIRES_IN = config.jwt.expiresIn;


  /**
   * Register a new user
   */
  static async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email.toLowerCase() }
      });

      if (existingUser) {
        throw new Error('User already exists with this email');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(data.password, this.SALT_ROUNDS);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: data.email.toLowerCase(),
          passwordHash,
          firstName: data.firstName || null,
          lastName: data.lastName || null,
          role: UserRole.USER,
          isActive: true,
          isVerified: false
        }
      });

      // Generate tokens
      const { accessToken, refreshToken } = await this.generateTokens(user);

      logger.info(`New user registered: ${user.email}`);

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
          role: user.role as string,
          isVerified: user.isVerified
        },
        accessToken,
        refreshToken,
        expiresIn: this.getTokenExpirationTime()
      };
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Login user
   */
  static async login(data: LoginRequest): Promise<AuthResponse> {
    try {
      // Find user
      const user = await prisma.user.findUnique({
        where: { email: data.email.toLowerCase() }
      });

      if (!user || !user.isActive) {
        throw new Error('Invalid credentials');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(data.password, user.passwordHash);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // TODO: Implement MFA verification if enabled
      if (data.mfaCode) {
        // MFA verification logic would go here
        // For now, we'll skip MFA implementation
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });

      // Generate tokens
      const { accessToken, refreshToken } = await this.generateTokens(user);

      logger.info(`User logged in: ${user.email}`);

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
          role: user.role as string,
          isVerified: user.isVerified
        },
        accessToken,
        refreshToken,
        expiresIn: this.getTokenExpirationTime()
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      // Find refresh token
      const tokenRecord = await prisma.refreshToken.findUnique({
        where: { token: refreshToken }
      });

      if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
        throw new Error('Invalid or expired refresh token');
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { id: tokenRecord.userId }
      });

      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken } = await this.generateTokens(user);

      // Delete old refresh token
      await prisma.refreshToken.delete({
        where: { id: tokenRecord.id }
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
          role: user.role as string,
          isVerified: user.isVerified
        },
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: this.getTokenExpirationTime()
      };
    } catch (error) {
      logger.error('Token refresh error:', error);
      throw error;
    }
  }

  /**
   * Logout user (invalidate refresh token)
   */
  static async logout(refreshToken: string): Promise<void> {
    try {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken }
      });
      logger.info('User logged out successfully');
    } catch (error) {
      logger.error('Logout error:', error);
      throw error;
    }
  }

  /**
   * Change password
   */
  static async changePassword(userId: string, data: ChangePasswordRequest): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(data.newPassword, this.SALT_ROUNDS);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash }
      });

      // Invalidate all refresh tokens for this user
      await prisma.refreshToken.deleteMany({
        where: { userId }
      });

      logger.info(`Password changed for user: ${user.email}`);
    } catch (error) {
      logger.error('Change password error:', error);
      throw error;
    }
  }

  /**
   * Verify JWT token
   */
  static async verifyToken(token: string): Promise<JwtPayload> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as JwtPayload;
      
      // Verify user still exists and is active
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      return decoded;
    } catch (error) {
      logger.error('Token verification error:', error);
      throw new Error('Invalid token');
    }
  }

  /**
   * Get user permissions based on role
   */
  static getUserPermissions(role: UserRole): Permission[] {
    const permissions: Permission[] = [];

    switch (role) {
      case UserRole.SUPER_ADMIN:
        permissions.push(
          Permission.SYSTEM_ADMIN,
          Permission.USER_MANAGE,
          Permission.USER_VIEW
        );
        // Fall through to include admin permissions
      case UserRole.ADMIN:
        permissions.push(
          Permission.SYSTEM_MONITOR,
          Permission.ANALYTICS_EXPORT
        );
        // Fall through to include user permissions
      case UserRole.USER:
        permissions.push(
          Permission.TRADE_EXECUTE,
          Permission.TRADE_VIEW,
          Permission.TRADE_CANCEL,
          Permission.PORTFOLIO_VIEW,
          Permission.PORTFOLIO_MANAGE,
          Permission.GRID_CREATE,
          Permission.GRID_MANAGE,
          Permission.GRID_VIEW,
          Permission.ANALYTICS_VIEW
        );
        break;
    }

    return permissions;
  }

  /**
   * Check if user has specific permission
   */
  static hasPermission(userRole: UserRole, permission: Permission): boolean {
    const userPermissions = this.getUserPermissions(userRole);
    return userPermissions.includes(permission);
  }

  /**
   * Generate access and refresh tokens
   */
  private static async generateTokens(user: any): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const accessToken = jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN
    } as jwt.SignOptions);

    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7); // 7 days

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: refreshExpiresAt
      }
    });

    return { accessToken, refreshToken };
  }

  /**
   * Get token expiration time in seconds
   */
  private static getTokenExpirationTime(): number {
    const expiresIn = this.JWT_EXPIRES_IN;
    if (typeof expiresIn === 'string') {
      // Parse time string (e.g., '24h', '1d')
      const match = expiresIn.match(/^(\d+)([smhd])$/);
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2];
        switch (unit) {
          case 's': return value;
          case 'm': return value * 60;
          case 'h': return value * 60 * 60;
          case 'd': return value * 24 * 60 * 60;
        }
      }
    }
    return 24 * 60 * 60; // Default to 24 hours
  }

  /**
   * Clean up expired refresh tokens
   */
  static async cleanupExpiredTokens(): Promise<void> {
    try {
      const result = await prisma.refreshToken.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });
      logger.info(`Cleaned up ${result.count} expired refresh tokens`);
    } catch (error) {
      logger.error('Token cleanup error:', error);
    }
  }
}