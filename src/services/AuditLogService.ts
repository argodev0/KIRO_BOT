import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import { Request } from 'express';

export enum AuditEventType {
  // Authentication events
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  MFA_ENABLED = 'MFA_ENABLED',
  MFA_DISABLED = 'MFA_DISABLED',
  
  // Trading events
  TRADE_EXECUTED = 'TRADE_EXECUTED',
  ORDER_PLACED = 'ORDER_PLACED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  POSITION_OPENED = 'POSITION_OPENED',
  POSITION_CLOSED = 'POSITION_CLOSED',
  
  // Configuration events
  API_KEY_ADDED = 'API_KEY_ADDED',
  API_KEY_REMOVED = 'API_KEY_REMOVED',
  RISK_SETTINGS_CHANGED = 'RISK_SETTINGS_CHANGED',
  STRATEGY_CONFIGURED = 'STRATEGY_CONFIGURED',
  BOT_STARTED = 'BOT_STARTED',
  BOT_STOPPED = 'BOT_STOPPED',
  
  // Security events
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  DATA_EXPORT = 'DATA_EXPORT',
  
  // System events
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  BACKUP_CREATED = 'BACKUP_CREATED',
  BACKUP_RESTORED = 'BACKUP_RESTORED',
  MAINTENANCE_MODE = 'MAINTENANCE_MODE'
}

export enum AuditSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface AuditLogEntry {
  id?: string;
  userId?: string;
  sessionId?: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

export interface AuditLogFilter {
  userId?: string;
  eventType?: AuditEventType;
  severity?: AuditSeverity;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  success?: boolean;
}

export class AuditLogService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Log an audit event
   */
  async logEvent(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          sessionId: entry.sessionId,
          eventType: entry.eventType,
          severity: entry.severity,
          description: entry.description,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          timestamp: entry.timestamp,
          success: entry.success,
          errorMessage: entry.errorMessage
        }
      });

      // Also log to application logger for immediate visibility
      const logLevel = this.getLogLevel(entry.severity);
      logger[logLevel](`AUDIT: ${entry.eventType} - ${entry.description}`, {
        userId: entry.userId,
        success: entry.success,
        metadata: entry.metadata
      });

      // Check for critical events that need immediate attention
      if (entry.severity === AuditSeverity.CRITICAL) {
        await this.handleCriticalEvent(entry);
      }
    } catch (error) {
      logger.error('Failed to log audit event:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  /**
   * Log authentication event
   */
  async logAuthEvent(
    eventType: AuditEventType,
    userId: string | undefined,
    success: boolean,
    req: Request,
    errorMessage?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const severity = this.getAuthEventSeverity(eventType, success);
    
    await this.logEvent({
      userId,
      sessionId: req.sessionID,
      eventType,
      severity,
      description: this.getEventDescription(eventType, success),
      metadata,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      timestamp: new Date(),
      success,
      errorMessage
    });
  }

  /**
   * Log trading event
   */
  async logTradingEvent(
    eventType: AuditEventType,
    userId: string,
    success: boolean,
    metadata: Record<string, any>,
    req?: Request,
    errorMessage?: string
  ): Promise<void> {
    await this.logEvent({
      userId,
      sessionId: req?.sessionID,
      eventType,
      severity: success ? AuditSeverity.MEDIUM : AuditSeverity.HIGH,
      description: this.getEventDescription(eventType, success),
      metadata,
      ipAddress: req ? this.getClientIP(req) : undefined,
      userAgent: req?.get('User-Agent'),
      timestamp: new Date(),
      success,
      errorMessage
    });
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    eventType: AuditEventType,
    userId: string | undefined,
    description: string,
    req: Request,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      userId,
      sessionId: req.sessionID,
      eventType,
      severity: AuditSeverity.HIGH,
      description,
      metadata,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      timestamp: new Date(),
      success: false
    });
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(
    filter: AuditLogFilter,
    page: number = 1,
    limit: number = 100
  ): Promise<{ logs: AuditLogEntry[]; total: number }> {
    try {
      const where: any = {};

      if (filter.userId) where.userId = filter.userId;
      if (filter.eventType) where.eventType = filter.eventType;
      if (filter.severity) where.severity = filter.severity;
      if (filter.ipAddress) where.ipAddress = filter.ipAddress;
      if (filter.success !== undefined) where.success = filter.success;
      
      if (filter.startDate || filter.endDate) {
        where.timestamp = {};
        if (filter.startDate) where.timestamp.gte = filter.startDate;
        if (filter.endDate) where.timestamp.lte = filter.endDate;
      }

      const [logs, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        this.prisma.auditLog.count({ where })
      ]);

      return {
        logs: logs.map(log => ({
          ...log,
          metadata: log.metadata ? JSON.parse(log.metadata) : undefined
        })),
        total
      };
    } catch (error) {
      logger.error('Failed to retrieve audit logs:', error);
      throw new Error('Failed to retrieve audit logs');
    }
  }

  /**
   * Get security summary for a user
   */
  async getSecuritySummary(userId: string, days: number = 30): Promise<{
    totalEvents: number;
    failedLogins: number;
    suspiciousActivities: number;
    lastLogin: Date | null;
    recentIPs: string[];
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [totalEvents, failedLogins, suspiciousActivities, lastLogin, recentEvents] = await Promise.all([
        this.prisma.auditLog.count({
          where: { userId, timestamp: { gte: startDate } }
        }),
        this.prisma.auditLog.count({
          where: {
            userId,
            eventType: AuditEventType.LOGIN_FAILED,
            timestamp: { gte: startDate }
          }
        }),
        this.prisma.auditLog.count({
          where: {
            userId,
            eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
            timestamp: { gte: startDate }
          }
        }),
        this.prisma.auditLog.findFirst({
          where: {
            userId,
            eventType: AuditEventType.LOGIN,
            success: true
          },
          orderBy: { timestamp: 'desc' }
        }),
        this.prisma.auditLog.findMany({
          where: {
            userId,
            timestamp: { gte: startDate },
            ipAddress: { not: null }
          },
          select: { ipAddress: true },
          distinct: ['ipAddress'],
          take: 10
        })
      ]);

      return {
        totalEvents,
        failedLogins,
        suspiciousActivities,
        lastLogin: lastLogin?.timestamp || null,
        recentIPs: recentEvents.map(e => e.ipAddress).filter(Boolean) as string[]
      };
    } catch (error) {
      logger.error('Failed to get security summary:', error);
      throw new Error('Failed to get security summary');
    }
  }

  /**
   * Clean up old audit logs
   */
  async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await this.prisma.auditLog.deleteMany({
        where: {
          timestamp: { lt: cutoffDate },
          severity: { not: AuditSeverity.CRITICAL } // Keep critical events longer
        }
      });

      logger.info(`Cleaned up ${result.count} old audit log entries`);
      return result.count;
    } catch (error) {
      logger.error('Failed to cleanup old audit logs:', error);
      throw new Error('Failed to cleanup old audit logs');
    }
  }

  /**
   * Export audit logs for compliance
   */
  async exportAuditLogs(
    filter: AuditLogFilter,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    try {
      const { logs } = await this.getAuditLogs(filter, 1, 10000); // Large limit for export

      if (format === 'csv') {
        return this.convertToCSV(logs);
      }

      return JSON.stringify(logs, null, 2);
    } catch (error) {
      logger.error('Failed to export audit logs:', error);
      throw new Error('Failed to export audit logs');
    }
  }

  private getLogLevel(severity: AuditSeverity): 'info' | 'warn' | 'error' {
    switch (severity) {
      case AuditSeverity.LOW:
        return 'info';
      case AuditSeverity.MEDIUM:
        return 'info';
      case AuditSeverity.HIGH:
        return 'warn';
      case AuditSeverity.CRITICAL:
        return 'error';
      default:
        return 'info';
    }
  }

  private getAuthEventSeverity(eventType: AuditEventType, success: boolean): AuditSeverity {
    if (!success) {
      return eventType === AuditEventType.LOGIN_FAILED ? AuditSeverity.MEDIUM : AuditSeverity.HIGH;
    }
    
    switch (eventType) {
      case AuditEventType.LOGIN:
      case AuditEventType.LOGOUT:
        return AuditSeverity.LOW;
      case AuditEventType.PASSWORD_CHANGE:
      case AuditEventType.MFA_ENABLED:
      case AuditEventType.MFA_DISABLED:
        return AuditSeverity.MEDIUM;
      default:
        return AuditSeverity.LOW;
    }
  }

  private getEventDescription(eventType: AuditEventType, success: boolean): string {
    const status = success ? 'successful' : 'failed';
    
    switch (eventType) {
      case AuditEventType.LOGIN:
        return `User login ${status}`;
      case AuditEventType.LOGOUT:
        return `User logout ${status}`;
      case AuditEventType.LOGIN_FAILED:
        return 'Failed login attempt';
      case AuditEventType.TRADE_EXECUTED:
        return `Trade execution ${status}`;
      case AuditEventType.ORDER_PLACED:
        return `Order placement ${status}`;
      case AuditEventType.API_KEY_ADDED:
        return `API key addition ${status}`;
      case AuditEventType.SUSPICIOUS_ACTIVITY:
        return 'Suspicious activity detected';
      default:
        return `${eventType} ${status}`;
    }
  }

  private getClientIP(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           'unknown';
  }

  private async handleCriticalEvent(entry: AuditLogEntry): Promise<void> {
    // Implement critical event handling (notifications, alerts, etc.)
    logger.error(`CRITICAL AUDIT EVENT: ${entry.eventType}`, {
      userId: entry.userId,
      description: entry.description,
      metadata: entry.metadata
    });
    
    // Could trigger notifications, alerts, or automatic responses
  }

  private convertToCSV(logs: AuditLogEntry[]): string {
    const headers = [
      'Timestamp', 'User ID', 'Event Type', 'Severity', 'Description',
      'Success', 'IP Address', 'User Agent', 'Error Message'
    ];
    
    const rows = logs.map(log => [
      log.timestamp.toISOString(),
      log.userId || '',
      log.eventType,
      log.severity,
      log.description,
      log.success.toString(),
      log.ipAddress || '',
      log.userAgent || '',
      log.errorMessage || ''
    ]);
    
    return [headers, ...rows].map(row => 
      row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(',')
    ).join('\n');
  }
}