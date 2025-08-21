import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import { AuditLogService, AuditEventType, AuditSeverity } from './AuditLogService';
import { NotificationService } from './NotificationService';
import { Request } from 'express';

export interface SuspiciousActivityRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  threshold: number;
  timeWindowMinutes: number;
  severity: AuditSeverity;
  action: SecurityAction;
}

export enum SecurityAction {
  LOG_ONLY = 'LOG_ONLY',
  WARN_USER = 'WARN_USER',
  LOCK_ACCOUNT = 'LOCK_ACCOUNT',
  REQUIRE_MFA = 'REQUIRE_MFA',
  BLOCK_IP = 'BLOCK_IP'
}

export interface SecurityThreat {
  id: string;
  userId?: string;
  ipAddress?: string;
  threatType: string;
  severity: AuditSeverity;
  description: string;
  detectedAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata: Record<string, any>;
}

export interface AccountLockInfo {
  userId: string;
  lockedAt: Date;
  lockReason: string;
  lockDuration?: number; // minutes, undefined for manual unlock
  unlockAt?: Date;
  attemptCount: number;
}

export class SecurityMonitoringService {
  private prisma: PrismaClient;
  private auditLogService: AuditLogService;
  private notificationService: NotificationService;
  private suspiciousActivityRules: SuspiciousActivityRule[];
  private blockedIPs: Set<string> = new Set();

  constructor(
    prisma: PrismaClient,
    auditLogService: AuditLogService,
    notificationService: NotificationService
  ) {
    this.prisma = prisma;
    this.auditLogService = auditLogService;
    this.notificationService = notificationService;
    this.suspiciousActivityRules = this.getDefaultRules();
    this.loadBlockedIPs();
  }

  /**
   * Monitor user activity for suspicious patterns
   */
  async monitorActivity(userId: string, eventType: AuditEventType, req: Request): Promise<void> {
    try {
      const ipAddress = this.getClientIP(req);
      
      // Check if IP is blocked
      if (this.blockedIPs.has(ipAddress)) {
        throw new Error('Access denied from blocked IP address');
      }

      // Check if account is locked
      const lockInfo = await this.getAccountLockInfo(userId);
      if (lockInfo && !this.isLockExpired(lockInfo)) {
        throw new Error('Account is locked due to security concerns');
      }

      // Run suspicious activity detection
      await this.detectSuspiciousActivity(userId, eventType, ipAddress, req);
      
    } catch (error) {
      logger.error('Security monitoring error:', error);
      throw error;
    }
  }

  /**
   * Detect suspicious activity based on rules
   */
  private async detectSuspiciousActivity(
    userId: string,
    eventType: AuditEventType,
    ipAddress: string,
    req: Request
  ): Promise<void> {
    const now = new Date();
    
    for (const rule of this.suspiciousActivityRules) {
      if (!rule.enabled) continue;

      const windowStart = new Date(now.getTime() - rule.timeWindowMinutes * 60 * 1000);
      let count = 0;
      let shouldTrigger = false;

      switch (rule.id) {
        case 'failed_login_attempts':
          count = await this.countFailedLogins(userId, ipAddress, windowStart);
          shouldTrigger = count >= rule.threshold;
          break;

        case 'rapid_api_calls':
          count = await this.countApiCalls(userId, windowStart);
          shouldTrigger = count >= rule.threshold;
          break;

        case 'multiple_ip_access':
          count = await this.countUniqueIPs(userId, windowStart);
          shouldTrigger = count >= rule.threshold;
          break;

        case 'unusual_trading_volume':
          count = await this.countTradingEvents(userId, windowStart);
          shouldTrigger = count >= rule.threshold;
          break;

        case 'configuration_changes':
          count = await this.countConfigChanges(userId, windowStart);
          shouldTrigger = count >= rule.threshold;
          break;

        case 'data_export_attempts':
          count = await this.countDataExports(userId, windowStart);
          shouldTrigger = count >= rule.threshold;
          break;
      }

      if (shouldTrigger) {
        await this.handleSuspiciousActivity(rule, userId, ipAddress, count, req);
      }
    }
  }

  /**
   * Handle detected suspicious activity
   */
  private async handleSuspiciousActivity(
    rule: SuspiciousActivityRule,
    userId: string,
    ipAddress: string,
    count: number,
    req: Request
  ): Promise<void> {
    const threat: SecurityThreat = {
      id: `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      ipAddress,
      threatType: rule.id,
      severity: rule.severity,
      description: `${rule.description} (${count} occurrences in ${rule.timeWindowMinutes} minutes)`,
      detectedAt: new Date(),
      resolved: false,
      metadata: {
        rule: rule.name,
        count,
        threshold: rule.threshold,
        timeWindow: rule.timeWindowMinutes
      }
    };

    // Log the threat
    await this.logSecurityThreat(threat);

    // Execute the action
    switch (rule.action) {
      case SecurityAction.LOG_ONLY:
        // Already logged above
        break;

      case SecurityAction.WARN_USER:
        await this.warnUser(userId, threat);
        break;

      case SecurityAction.LOCK_ACCOUNT:
        await this.lockAccount(userId, rule.name, 60); // 1 hour lock
        break;

      case SecurityAction.REQUIRE_MFA:
        await this.requireMFA(userId);
        break;

      case SecurityAction.BLOCK_IP:
        await this.blockIP(ipAddress, rule.name);
        break;
    }

    // Log audit event
    await this.auditLogService.logSecurityEvent(
      AuditEventType.SUSPICIOUS_ACTIVITY,
      userId,
      threat.description,
      req,
      threat.metadata
    );
  }

  /**
   * Lock user account
   */
  async lockAccount(userId: string, reason: string, durationMinutes?: number): Promise<void> {
    try {
      const lockInfo: AccountLockInfo = {
        userId,
        lockedAt: new Date(),
        lockReason: reason,
        lockDuration: durationMinutes,
        unlockAt: durationMinutes ? new Date(Date.now() + durationMinutes * 60 * 1000) : undefined,
        attemptCount: 1
      };

      await this.prisma.accountLocks.upsert({
        where: { userId },
        update: {
          lockedAt: lockInfo.lockedAt,
          lockReason: lockInfo.lockReason,
          lockDuration: lockInfo.lockDuration,
          unlockAt: lockInfo.unlockAt,
          attemptCount: { increment: 1 }
        },
        create: {
          userId: lockInfo.userId,
          lockedAt: lockInfo.lockedAt,
          lockReason: lockInfo.lockReason,
          lockDuration: lockInfo.lockDuration,
          unlockAt: lockInfo.unlockAt,
          attemptCount: lockInfo.attemptCount
        }
      });

      // Notify user
      await this.notificationService.sendSecurityAlert(userId, {
        type: 'account_locked',
        message: `Your account has been locked due to: ${reason}`,
        severity: 'high',
        timestamp: new Date()
      });

      logger.warn(`Account locked for user ${userId}: ${reason}`);
    } catch (error) {
      logger.error('Failed to lock account:', error);
      throw new Error('Failed to lock account');
    }
  }

  /**
   * Unlock user account
   */
  async unlockAccount(userId: string, unlockedBy: string): Promise<void> {
    try {
      await this.prisma.accountLocks.update({
        where: { userId },
        data: {
          unlocked: true,
          unlockedAt: new Date(),
          unlockedBy
        }
      });

      // Notify user
      await this.notificationService.sendSecurityAlert(userId, {
        type: 'account_unlocked',
        message: 'Your account has been unlocked',
        severity: 'medium',
        timestamp: new Date()
      });

      logger.info(`Account unlocked for user ${userId} by ${unlockedBy}`);
    } catch (error) {
      logger.error('Failed to unlock account:', error);
      throw new Error('Failed to unlock account');
    }
  }

  /**
   * Block IP address
   */
  async blockIP(ipAddress: string, reason: string, durationMinutes?: number): Promise<void> {
    try {
      this.blockedIPs.add(ipAddress);

      await this.prisma.blockedIPs.create({
        data: {
          ipAddress,
          reason,
          blockedAt: new Date(),
          expiresAt: durationMinutes ? new Date(Date.now() + durationMinutes * 60 * 1000) : undefined
        }
      });

      logger.warn(`IP address blocked: ${ipAddress} - ${reason}`);
    } catch (error) {
      logger.error('Failed to block IP:', error);
    }
  }

  /**
   * Check if account is locked
   */
  async getAccountLockInfo(userId: string): Promise<AccountLockInfo | null> {
    try {
      const lock = await this.prisma.accountLocks.findUnique({
        where: { userId }
      });

      if (!lock || lock.unlocked) {
        return null;
      }

      return {
        userId: lock.userId,
        lockedAt: lock.lockedAt,
        lockReason: lock.lockReason,
        lockDuration: lock.lockDuration,
        unlockAt: lock.unlockAt,
        attemptCount: lock.attemptCount
      };
    } catch (error) {
      logger.error('Failed to get account lock info:', error);
      return null;
    }
  }

  /**
   * Get security threats
   */
  async getSecurityThreats(
    userId?: string,
    resolved?: boolean,
    limit: number = 100
  ): Promise<SecurityThreat[]> {
    try {
      const where: any = {};
      if (userId) where.userId = userId;
      if (resolved !== undefined) where.resolved = resolved;

      const threats = await this.prisma.securityThreats.findMany({
        where,
        orderBy: { detectedAt: 'desc' },
        take: limit
      });

      return threats.map(threat => ({
        id: threat.id,
        userId: threat.userId,
        ipAddress: threat.ipAddress,
        threatType: threat.threatType,
        severity: threat.severity as AuditSeverity,
        description: threat.description,
        detectedAt: threat.detectedAt,
        resolved: threat.resolved,
        resolvedAt: threat.resolvedAt,
        metadata: threat.metadata ? JSON.parse(threat.metadata) : {}
      }));
    } catch (error) {
      logger.error('Failed to get security threats:', error);
      throw new Error('Failed to get security threats');
    }
  }

  private isLockExpired(lockInfo: AccountLockInfo): boolean {
    if (!lockInfo.unlockAt) return false;
    return new Date() > lockInfo.unlockAt;
  }

  private async countFailedLogins(userId: string, ipAddress: string, since: Date): Promise<number> {
    return this.prisma.auditLog.count({
      where: {
        userId,
        ipAddress,
        eventType: AuditEventType.LOGIN_FAILED,
        timestamp: { gte: since }
      }
    });
  }

  private async countApiCalls(userId: string, since: Date): Promise<number> {
    return this.prisma.auditLog.count({
      where: {
        userId,
        timestamp: { gte: since }
      }
    });
  }

  private async countUniqueIPs(userId: string, since: Date): Promise<number> {
    const result = await this.prisma.auditLog.findMany({
      where: {
        userId,
        timestamp: { gte: since },
        ipAddress: { not: null }
      },
      select: { ipAddress: true },
      distinct: ['ipAddress']
    });
    return result.length;
  }

  private async countTradingEvents(userId: string, since: Date): Promise<number> {
    return this.prisma.auditLog.count({
      where: {
        userId,
        eventType: { in: [AuditEventType.TRADE_EXECUTED, AuditEventType.ORDER_PLACED] },
        timestamp: { gte: since }
      }
    });
  }

  private async countConfigChanges(userId: string, since: Date): Promise<number> {
    return this.prisma.auditLog.count({
      where: {
        userId,
        eventType: { in: [AuditEventType.RISK_SETTINGS_CHANGED, AuditEventType.STRATEGY_CONFIGURED] },
        timestamp: { gte: since }
      }
    });
  }

  private async countDataExports(userId: string, since: Date): Promise<number> {
    return this.prisma.auditLog.count({
      where: {
        userId,
        eventType: AuditEventType.DATA_EXPORT,
        timestamp: { gte: since }
      }
    });
  }

  private async logSecurityThreat(threat: SecurityThreat): Promise<void> {
    await this.prisma.securityThreats.create({
      data: {
        id: threat.id,
        userId: threat.userId,
        ipAddress: threat.ipAddress,
        threatType: threat.threatType,
        severity: threat.severity,
        description: threat.description,
        detectedAt: threat.detectedAt,
        resolved: threat.resolved,
        metadata: JSON.stringify(threat.metadata)
      }
    });
  }

  private async warnUser(userId: string, threat: SecurityThreat): Promise<void> {
    await this.notificationService.sendSecurityAlert(userId, {
      type: 'suspicious_activity',
      message: `Suspicious activity detected: ${threat.description}`,
      severity: 'medium',
      timestamp: new Date()
    });
  }

  private async requireMFA(userId: string): Promise<void> {
    // Set flag requiring MFA for next login
    await this.prisma.users.update({
      where: { id: userId },
      data: { requireMfaReset: true }
    });
  }

  private getClientIP(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           'unknown';
  }

  private async loadBlockedIPs(): Promise<void> {
    try {
      const blockedIPs = await this.prisma.blockedIPs.findMany({
        where: {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      });

      this.blockedIPs = new Set(blockedIPs.map(ip => ip.ipAddress));
    } catch (error) {
      logger.error('Failed to load blocked IPs:', error);
    }
  }

  private getDefaultRules(): SuspiciousActivityRule[] {
    return [
      {
        id: 'failed_login_attempts',
        name: 'Multiple Failed Login Attempts',
        description: 'Multiple failed login attempts from same IP',
        enabled: true,
        threshold: 5,
        timeWindowMinutes: 15,
        severity: AuditSeverity.HIGH,
        action: SecurityAction.LOCK_ACCOUNT
      },
      {
        id: 'rapid_api_calls',
        name: 'Rapid API Calls',
        description: 'Unusually high number of API calls',
        enabled: true,
        threshold: 1000,
        timeWindowMinutes: 5,
        severity: AuditSeverity.MEDIUM,
        action: SecurityAction.WARN_USER
      },
      {
        id: 'multiple_ip_access',
        name: 'Multiple IP Access',
        description: 'Account accessed from multiple IP addresses',
        enabled: true,
        threshold: 5,
        timeWindowMinutes: 60,
        severity: AuditSeverity.MEDIUM,
        action: SecurityAction.REQUIRE_MFA
      },
      {
        id: 'unusual_trading_volume',
        name: 'Unusual Trading Volume',
        description: 'Unusually high trading activity',
        enabled: true,
        threshold: 100,
        timeWindowMinutes: 60,
        severity: AuditSeverity.HIGH,
        action: SecurityAction.WARN_USER
      },
      {
        id: 'configuration_changes',
        name: 'Rapid Configuration Changes',
        description: 'Multiple configuration changes in short time',
        enabled: true,
        threshold: 10,
        timeWindowMinutes: 30,
        severity: AuditSeverity.MEDIUM,
        action: SecurityAction.WARN_USER
      },
      {
        id: 'data_export_attempts',
        name: 'Multiple Data Export Attempts',
        description: 'Multiple data export attempts',
        enabled: true,
        threshold: 5,
        timeWindowMinutes: 60,
        severity: AuditSeverity.HIGH,
        action: SecurityAction.LOCK_ACCOUNT
      }
    ];
  }
}