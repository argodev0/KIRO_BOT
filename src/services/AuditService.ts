/**
 * Audit Service
 * Comprehensive audit logging for compliance and security
 */

import { PrismaClient } from '@prisma/client';
import { productionLogger } from './ProductionLoggingService';
import crypto from 'crypto';

interface AuditEntry {
  id?: string;
  userId: string;
  sessionId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  outcome: 'success' | 'failure' | 'partial';
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'authentication' | 'authorization' | 'data_access' | 'data_modification' | 'configuration' | 'trading' | 'financial';
}

interface ComplianceReport {
  startDate: Date;
  endDate: Date;
  totalEvents: number;
  eventsByCategory: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  failedEvents: number;
  suspiciousActivities: AuditEntry[];
  dataAccessEvents: AuditEntry[];
  configurationChanges: AuditEntry[];
  tradingActivities: AuditEntry[];
}

interface DataAccessAudit {
  userId: string;
  dataType: string;
  operation: 'read' | 'write' | 'delete' | 'export';
  recordCount?: number;
  sensitiveData: boolean;
  justification?: string;
}

interface ConfigurationChangeAudit {
  userId: string;
  configType: string;
  oldValue?: any;
  newValue?: any;
  changeReason?: string;
  approvedBy?: string;
}

interface TradingAudit {
  userId: string;
  tradeId?: string;
  signalId?: string;
  action: 'signal_generated' | 'trade_executed' | 'position_opened' | 'position_closed' | 'risk_limit_hit' | 'emergency_stop';
  symbol?: string;
  amount?: number;
  price?: number;
  exchange?: string;
}

export class AuditService {
  private prisma: PrismaClient;
  private retentionPeriodDays: number;

  constructor() {
    this.prisma = new PrismaClient();
    this.retentionPeriodDays = parseInt(process.env.AUDIT_RETENTION_DAYS || '2555'); // 7 years default
  }

  /**
   * Log a general audit event
   */
  async logAuditEvent(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<string> {
    const auditId = this.generateAuditId();
    const timestamp = new Date();

    const auditEntry: AuditEntry = {
      id: auditId,
      timestamp,
      ...entry
    };

    try {
      // Store in database
      await this.prisma.auditLog.create({
        data: {
          id: auditId,
          userId: entry.userId,
          sessionId: entry.sessionId,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          outcome: entry.outcome,
          details: JSON.stringify(entry.details),
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          timestamp,
          severity: entry.severity,
          category: entry.category
        }
      });

      // Also log to file system
      productionLogger.logAuditEvent({
        eventType: 'audit',
        userId: entry.userId,
        resource: entry.resource,
        action: entry.action,
        outcome: entry.outcome,
        timestamp,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        details: entry.details
      });

      // Alert on critical events
      if (entry.severity === 'critical') {
        await this.alertCriticalAuditEvent(auditEntry);
      }

      return auditId;
    } catch (error) {
      productionLogger.error('Failed to log audit event', error as Error, {
        action: entry.action,
        resource: entry.resource,
        userId: entry.userId
      });
      throw error;
    }
  }

  /**
   * Log authentication events
   */
  async logAuthentication(
    userId: string,
    action: 'login' | 'logout' | 'login_failed' | 'password_change' | 'mfa_enabled' | 'mfa_disabled',
    outcome: 'success' | 'failure',
    details: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    return this.logAuditEvent({
      userId,
      action: `auth_${action}`,
      resource: 'authentication',
      outcome,
      details,
      ipAddress,
      userAgent,
      severity: outcome === 'failure' ? 'medium' : 'low',
      category: 'authentication'
    });
  }

  /**
   * Log authorization events
   */
  async logAuthorization(
    userId: string,
    action: string,
    resource: string,
    outcome: 'success' | 'failure',
    details: Record<string, any>,
    ipAddress?: string
  ): Promise<string> {
    return this.logAuditEvent({
      userId,
      action: `authz_${action}`,
      resource,
      outcome,
      details,
      ipAddress,
      severity: outcome === 'failure' ? 'medium' : 'low',
      category: 'authorization'
    });
  }

  /**
   * Log data access events
   */
  async logDataAccess(audit: DataAccessAudit, ipAddress?: string, userAgent?: string): Promise<string> {
    const severity = audit.sensitiveData ? 'high' : 'medium';
    
    return this.logAuditEvent({
      userId: audit.userId,
      action: `data_${audit.operation}`,
      resource: audit.dataType,
      outcome: 'success',
      details: {
        operation: audit.operation,
        recordCount: audit.recordCount,
        sensitiveData: audit.sensitiveData,
        justification: audit.justification
      },
      ipAddress,
      userAgent,
      severity,
      category: 'data_access'
    });
  }

  /**
   * Log configuration changes
   */
  async logConfigurationChange(
    audit: ConfigurationChangeAudit,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    return this.logAuditEvent({
      userId: audit.userId,
      action: 'config_change',
      resource: audit.configType,
      outcome: 'success',
      details: {
        oldValue: this.sanitizeConfigValue(audit.oldValue),
        newValue: this.sanitizeConfigValue(audit.newValue),
        changeReason: audit.changeReason,
        approvedBy: audit.approvedBy
      },
      ipAddress,
      userAgent,
      severity: 'high',
      category: 'configuration'
    });
  }

  /**
   * Log trading activities
   */
  async logTradingActivity(
    audit: TradingAudit,
    outcome: 'success' | 'failure' | 'partial',
    details: Record<string, any> = {},
    ipAddress?: string
  ): Promise<string> {
    const severity = audit.action.includes('emergency') ? 'critical' : 'medium';
    
    return this.logAuditEvent({
      userId: audit.userId,
      action: audit.action,
      resource: 'trading',
      resourceId: audit.tradeId || audit.signalId,
      outcome,
      details: {
        ...details,
        symbol: audit.symbol,
        amount: audit.amount,
        price: audit.price,
        exchange: audit.exchange,
        tradeId: audit.tradeId,
        signalId: audit.signalId
      },
      ipAddress,
      severity,
      category: 'trading'
    });
  }

  /**
   * Log financial events
   */
  async logFinancialEvent(
    userId: string,
    action: string,
    amount: number,
    currency: string,
    details: Record<string, any>,
    outcome: 'success' | 'failure' = 'success'
  ): Promise<string> {
    return this.logAuditEvent({
      userId,
      action: `financial_${action}`,
      resource: 'financial',
      outcome,
      details: {
        ...details,
        amount,
        currency
      },
      severity: 'high',
      category: 'financial'
    });
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(startDate: Date, endDate: Date): Promise<ComplianceReport> {
    try {
      const auditEntries = await this.prisma.auditLog.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: {
          timestamp: 'desc'
        }
      });

      const totalEvents = auditEntries.length;
      const eventsByCategory: Record<string, number> = {};
      const eventsBySeverity: Record<string, number> = {};
      let failedEvents = 0;

      const suspiciousActivities: AuditEntry[] = [];
      const dataAccessEvents: AuditEntry[] = [];
      const configurationChanges: AuditEntry[] = [];
      const tradingActivities: AuditEntry[] = [];

      for (const entry of auditEntries) {
        // Count by category
        eventsByCategory[entry.category] = (eventsByCategory[entry.category] || 0) + 1;
        
        // Count by severity
        eventsBySeverity[entry.severity] = (eventsBySeverity[entry.severity] || 0) + 1;
        
        // Count failures
        if (entry.outcome === 'failure') {
          failedEvents++;
        }

        // Categorize events
        const auditEntry: AuditEntry = {
          id: entry.id,
          userId: entry.userId,
          sessionId: entry.sessionId || undefined,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId || undefined,
          outcome: entry.outcome as 'success' | 'failure' | 'partial',
          details: JSON.parse(entry.details),
          ipAddress: entry.ipAddress || undefined,
          userAgent: entry.userAgent || undefined,
          timestamp: entry.timestamp,
          severity: entry.severity as 'low' | 'medium' | 'high' | 'critical',
          category: entry.category as any
        };

        if (entry.severity === 'critical' || this.isSuspiciousActivity(auditEntry)) {
          suspiciousActivities.push(auditEntry);
        }

        if (entry.category === 'data_access') {
          dataAccessEvents.push(auditEntry);
        }

        if (entry.category === 'configuration') {
          configurationChanges.push(auditEntry);
        }

        if (entry.category === 'trading') {
          tradingActivities.push(auditEntry);
        }
      }

      return {
        startDate,
        endDate,
        totalEvents,
        eventsByCategory,
        eventsBySeverity,
        failedEvents,
        suspiciousActivities,
        dataAccessEvents,
        configurationChanges,
        tradingActivities
      };
    } catch (error) {
      productionLogger.error('Failed to generate compliance report', error as Error);
      throw error;
    }
  }

  /**
   * Get audit trail for specific user
   */
  async getUserAuditTrail(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 1000
  ): Promise<AuditEntry[]> {
    try {
      const whereClause: any = { userId };
      
      if (startDate || endDate) {
        whereClause.timestamp = {};
        if (startDate) whereClause.timestamp.gte = startDate;
        if (endDate) whereClause.timestamp.lte = endDate;
      }

      const entries = await this.prisma.auditLog.findMany({
        where: whereClause,
        orderBy: { timestamp: 'desc' },
        take: limit
      });

      return entries.map(entry => ({
        id: entry.id,
        userId: entry.userId,
        sessionId: entry.sessionId || undefined,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId || undefined,
        outcome: entry.outcome as 'success' | 'failure' | 'partial',
        details: JSON.parse(entry.details),
        ipAddress: entry.ipAddress || undefined,
        userAgent: entry.userAgent || undefined,
        timestamp: entry.timestamp,
        severity: entry.severity as 'low' | 'medium' | 'high' | 'critical',
        category: entry.category as any
      }));
    } catch (error) {
      productionLogger.error('Failed to get user audit trail', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Search audit logs
   */
  async searchAuditLogs(
    filters: {
      userId?: string;
      action?: string;
      resource?: string;
      category?: string;
      severity?: string;
      outcome?: string;
      startDate?: Date;
      endDate?: Date;
    },
    limit: number = 1000,
    offset: number = 0
  ): Promise<{ entries: AuditEntry[]; total: number }> {
    try {
      const whereClause: any = {};

      if (filters.userId) whereClause.userId = filters.userId;
      if (filters.action) whereClause.action = { contains: filters.action };
      if (filters.resource) whereClause.resource = filters.resource;
      if (filters.category) whereClause.category = filters.category;
      if (filters.severity) whereClause.severity = filters.severity;
      if (filters.outcome) whereClause.outcome = filters.outcome;

      if (filters.startDate || filters.endDate) {
        whereClause.timestamp = {};
        if (filters.startDate) whereClause.timestamp.gte = filters.startDate;
        if (filters.endDate) whereClause.timestamp.lte = filters.endDate;
      }

      const [entries, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where: whereClause,
          orderBy: { timestamp: 'desc' },
          take: limit,
          skip: offset
        }),
        this.prisma.auditLog.count({ where: whereClause })
      ]);

      return {
        entries: entries.map(entry => ({
          id: entry.id,
          userId: entry.userId,
          sessionId: entry.sessionId || undefined,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId || undefined,
          outcome: entry.outcome as 'success' | 'failure' | 'partial',
          details: JSON.parse(entry.details),
          ipAddress: entry.ipAddress || undefined,
          userAgent: entry.userAgent || undefined,
          timestamp: entry.timestamp,
          severity: entry.severity as 'low' | 'medium' | 'high' | 'critical',
          category: entry.category as any
        })),
        total
      };
    } catch (error) {
      productionLogger.error('Failed to search audit logs', error as Error, { filters });
      throw error;
    }
  }

  /**
   * Clean up old audit logs based on retention policy
   */
  async cleanupOldAuditLogs(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionPeriodDays);

      const result = await this.prisma.auditLog.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate
          }
        }
      });

      productionLogger.info('Audit log cleanup completed', {
        deletedRecords: result.count,
        cutoffDate: cutoffDate.toISOString()
      });

      return result.count;
    } catch (error) {
      productionLogger.error('Failed to cleanup old audit logs', error as Error);
      throw error;
    }
  }

  /**
   * Export audit logs for compliance
   */
  async exportAuditLogs(
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    try {
      const entries = await this.prisma.auditLog.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { timestamp: 'asc' }
      });

      if (format === 'json') {
        return JSON.stringify(entries, null, 2);
      } else {
        // CSV format
        const headers = ['id', 'userId', 'action', 'resource', 'outcome', 'timestamp', 'severity', 'category'];
        const csvRows = [headers.join(',')];
        
        for (const entry of entries) {
          const row = [
            entry.id,
            entry.userId,
            entry.action,
            entry.resource,
            entry.outcome,
            entry.timestamp.toISOString(),
            entry.severity,
            entry.category
          ];
          csvRows.push(row.join(','));
        }
        
        return csvRows.join('\n');
      }
    } catch (error) {
      productionLogger.error('Failed to export audit logs', error as Error);
      throw error;
    }
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private sanitizeConfigValue(value: any): any {
    if (typeof value === 'string' && this.isSensitiveValue(value)) {
      return this.maskSensitiveData(value);
    }
    return value;
  }

  private isSensitiveValue(value: string): boolean {
    const sensitivePatterns = ['password', 'secret', 'key', 'token', 'api'];
    return sensitivePatterns.some(pattern => 
      value.toLowerCase().includes(pattern)
    );
  }

  private maskSensitiveData(value: string): string {
    if (value.length < 4) return '***';
    return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
  }

  private isSuspiciousActivity(entry: AuditEntry): boolean {
    // Define suspicious activity patterns
    const suspiciousPatterns = [
      'multiple_failed_logins',
      'unusual_data_access',
      'unauthorized_config_change',
      'suspicious_trading_pattern',
      'api_abuse'
    ];

    return suspiciousPatterns.some(pattern => 
      entry.action.includes(pattern) || 
      entry.details.suspicious === true
    );
  }

  private async alertCriticalAuditEvent(entry: AuditEntry): Promise<void> {
    // Implementation would send alerts for critical audit events
    productionLogger.error('CRITICAL AUDIT EVENT', undefined, {
      auditId: entry.id,
      userId: entry.userId,
      action: entry.action,
      resource: entry.resource
    });

    // In production, this would integrate with alerting systems
  }
}

export const auditService = new AuditService();