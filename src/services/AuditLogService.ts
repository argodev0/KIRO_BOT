import { logger, auditLogger } from '@/utils/logger';
import { Request } from 'express';

export interface AuditEvent {
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  requestId?: string;
  sourceIp?: string;
  userAgent?: string;
  oldValue?: any;
  newValue?: any;
  success: boolean;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface TradingAuditEvent extends AuditEvent {
  symbol?: string;
  exchange?: string;
  orderType?: string;
  quantity?: number;
  price?: number;
  orderId?: string;
  tradeId?: string;
  strategy?: string;
  paperTrade: boolean;
}

export interface SecurityAuditEvent extends AuditEvent {
  eventType: 'authentication' | 'authorization' | 'access_denied' | 'suspicious_activity' | 'configuration_change';
  severity: 'low' | 'medium' | 'high' | 'critical';
  endpoint?: string;
  method?: string;
  statusCode?: number;
}

export interface ConfigurationAuditEvent extends AuditEvent {
  configType: 'bot_settings' | 'api_keys' | 'trading_parameters' | 'security_settings' | 'environment';
  configKey: string;
}

export class AuditLogService {
  private static instance: AuditLogService;

  public static getInstance(): AuditLogService {
    if (!AuditLogService.instance) {
      AuditLogService.instance = new AuditLogService();
    }
    return AuditLogService.instance;
  }

  /**
   * Log a general audit event
   */
  public logAuditEvent(event: AuditEvent): void {
    try {
      auditLogger.info('Audit Event', {
        eventType: 'audit',
        timestamp: new Date().toISOString(),
        ...event
      });
    } catch (error) {
      logger.error('Failed to log audit event', { error: error.message, event });
    }
  }

  /**
   * Log trading-related audit events
   */
  public logTradingAuditEvent(event: TradingAuditEvent): void {
    try {
      auditLogger.info('Trading Audit Event', {
        eventType: 'trading_audit',
        timestamp: new Date().toISOString(),
        trading: {
          symbol: event.symbol,
          exchange: event.exchange,
          orderType: event.orderType,
          quantity: event.quantity,
          price: event.price,
          orderId: event.orderId,
          tradeId: event.tradeId,
          strategy: event.strategy,
          paperTrade: event.paperTrade
        },
        ...event
      });

      // Also log to trading-specific logger
      logger.info(`Trading Action: ${event.action}`, {
        category: 'trading',
        ...event
      });
    } catch (error) {
      logger.error('Failed to log trading audit event', { error: error.message, event });
    }
  }

  /**
   * Log security-related audit events
   */
  public logSecurityAuditEvent(event: SecurityAuditEvent): void {
    try {
      auditLogger.warn('Security Audit Event', {
        eventType: 'security_audit',
        timestamp: new Date().toISOString(),
        security: {
          eventType: event.eventType,
          severity: event.severity,
          sourceIp: event.sourceIp,
          userAgent: event.userAgent,
          endpoint: event.endpoint,
          method: event.method,
          statusCode: event.statusCode
        },
        ...event
      });

      // Also log to security-specific logger
      logger.warn(`Security Event: ${event.action}`, {
        category: 'security',
        ...event
      });
    } catch (error) {
      logger.error('Failed to log security audit event', { error: error.message, event });
    }
  }

  /**
   * Log configuration change audit events
   */
  public logConfigurationAuditEvent(event: ConfigurationAuditEvent): void {
    try {
      auditLogger.info('Configuration Audit Event', {
        eventType: 'configuration_audit',
        timestamp: new Date().toISOString(),
        configuration: {
          configType: event.configType,
          configKey: event.configKey
        },
        ...event
      });
    } catch (error) {
      logger.error('Failed to log configuration audit event', { error: error.message, event });
    }
  }

  /**
   * Extract request context for audit logging
   */
  public extractRequestContext(req: Request): Partial<AuditEvent> {
    return {
      requestId: req.headers['x-request-id'] as string || req.id,
      sourceIp: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      userId: (req as any).user?.id || (req as any).userId
    };
  }

  /**
   * Log user authentication events
   */
  public logAuthenticationEvent(
    action: 'login_attempt' | 'login_success' | 'login_failure' | 'logout' | 'token_refresh',
    userId: string,
    req: Request,
    success: boolean,
    reason?: string
  ): void {
    const context = this.extractRequestContext(req);
    
    this.logSecurityAuditEvent({
      action,
      resource: 'authentication',
      resourceId: userId,
      success,
      reason,
      eventType: 'authentication',
      severity: success ? 'low' : 'medium',
      endpoint: req.path,
      method: req.method,
      statusCode: success ? 200 : 401,
      ...context
    });
  }

  /**
   * Log API access events
   */
  public logApiAccessEvent(
    action: string,
    endpoint: string,
    req: Request,
    success: boolean,
    statusCode: number,
    reason?: string
  ): void {
    const context = this.extractRequestContext(req);
    
    this.logSecurityAuditEvent({
      action,
      resource: 'api_endpoint',
      resourceId: endpoint,
      success,
      reason,
      eventType: success ? 'authentication' : 'access_denied',
      severity: success ? 'low' : 'medium',
      endpoint,
      method: req.method,
      statusCode,
      ...context
    });
  }

  /**
   * Log trading operations
   */
  public logTradingOperation(
    action: 'order_create' | 'order_cancel' | 'order_modify' | 'trade_execute' | 'signal_generate',
    symbol: string,
    exchange: string,
    req: Request,
    success: boolean,
    details: {
      orderType?: string;
      quantity?: number;
      price?: number;
      orderId?: string;
      tradeId?: string;
      strategy?: string;
      paperTrade: boolean;
    },
    reason?: string
  ): void {
    const context = this.extractRequestContext(req);
    
    this.logTradingAuditEvent({
      action,
      resource: 'trading_operation',
      resourceId: details.orderId || details.tradeId,
      success,
      reason,
      symbol,
      exchange,
      orderType: details.orderType,
      quantity: details.quantity,
      price: details.price,
      orderId: details.orderId,
      tradeId: details.tradeId,
      strategy: details.strategy,
      paperTrade: details.paperTrade,
      ...context
    });
  }

  /**
   * Log configuration changes
   */
  public logConfigurationChange(
    configType: ConfigurationAuditEvent['configType'],
    configKey: string,
    oldValue: any,
    newValue: any,
    req: Request,
    success: boolean,
    reason?: string
  ): void {
    const context = this.extractRequestContext(req);
    
    this.logConfigurationAuditEvent({
      action: 'configuration_change',
      resource: 'configuration',
      resourceId: configKey,
      success,
      reason,
      configType,
      configKey,
      oldValue: this.sanitizeValue(oldValue),
      newValue: this.sanitizeValue(newValue),
      ...context
    });
  }

  /**
   * Log paper trading safety events
   */
  public logPaperTradingSafetyEvent(
    action: 'safety_check' | 'real_trade_blocked' | 'unsafe_operation_detected',
    details: {
      safetyScore?: number;
      violationType?: string;
      blockedOperation?: string;
      environment?: string;
    },
    req: Request,
    success: boolean,
    reason?: string
  ): void {
    const context = this.extractRequestContext(req);
    
    this.logSecurityAuditEvent({
      action,
      resource: 'paper_trading_safety',
      success,
      reason,
      eventType: 'suspicious_activity',
      severity: success ? 'low' : 'high',
      metadata: details,
      ...context
    });
  }

  /**
   * Sanitize sensitive values for logging
   */
  private sanitizeValue(value: any): any {
    if (typeof value !== 'object' || value === null) {
      return value;
    }

    const sanitized = { ...value };
    const sensitiveKeys = ['password', 'secret', 'key', 'token', 'apiKey', 'privateKey'];
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  /**
   * Log system health events
   */
  public logSystemHealthEvent(
    component: string,
    status: 'healthy' | 'degraded' | 'unhealthy',
    metrics?: Record<string, any>,
    reason?: string
  ): void {
    this.logAuditEvent({
      action: 'health_check',
      resource: 'system_component',
      resourceId: component,
      success: status === 'healthy',
      reason,
      metadata: {
        status,
        metrics
      }
    });
  }

  /**
   * Log data retention and cleanup events
   */
  public logDataRetentionEvent(
    action: 'cleanup_started' | 'cleanup_completed' | 'retention_policy_applied',
    dataType: string,
    recordsAffected: number,
    success: boolean,
    reason?: string
  ): void {
    this.logAuditEvent({
      action,
      resource: 'data_retention',
      resourceId: dataType,
      success,
      reason,
      metadata: {
        recordsAffected,
        dataType
      }
    });
  }
}

// Export singleton instance
export const auditLogService = AuditLogService.getInstance();